# Supabase setup for Tresh drafts

Tresh continues to work in local-only mode when Supabase variables are absent. Once this setup is complete, authenticated users load and save the Atelier Expression home-page draft through Supabase.

## 1. Create the project

Create a Supabase project, then apply:

```text
supabase/migrations/0001_core_drafts.sql
```

## 2. Configure authentication

In Supabase Auth URL configuration, add the environments in use:

```text
http://127.0.0.1:4326
http://localhost:4326
http://127.0.0.1:4327
http://localhost:4327
https://tresh.ca
```

Magic-link and password login are both supported.

## 3. Add environment variables

Copy `.env.example` to `.env.local`:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
VITE_TRESH_SITE_SLUG=atelier-expression
VITE_TRESH_PAGE_SLUG=home
```

The publishable key is allowed in the browser. Never place a service-role key in Vite variables or in the repository.

## 4. Sign in once

Run Tresh, request a magic link, and sign in. This creates the `auth.users` record.

## 5. Bootstrap Atelier Expression

In the Supabase SQL editor, replace the email and run:

```sql
with new_site as (
  insert into public.sites (slug, name, public_url)
  values ('atelier-expression', 'Atelier Expression', 'https://atelierexpression.ca')
  on conflict (slug) do update set name = excluded.name
  returning id
), resolved_site as (
  select id from new_site
  union all
  select id from public.sites where slug = 'atelier-expression'
  limit 1
), resolved_user as (
  select id from auth.users where email = 'CINDY_EMAIL_HERE'
)
insert into public.site_members (site_id, user_id, role)
select resolved_site.id, resolved_user.id, 'owner'
from resolved_site, resolved_user
on conflict (site_id, user_id) do update set role = excluded.role;

insert into public.pages (site_id, slug, title)
select id, 'home', 'Accueil'
from public.sites
where slug = 'atelier-expression'
on conflict (site_id, slug) do update set title = excluded.title;
```

Reload Tresh. The status bar should change from `Sauvegardé localement` to `Sauvegardé dans Tresh` after the first edit.

## Safety model

- Browser access uses the publishable key plus Postgres RLS.
- A user sees only sites where a `site_members` row exists.
- Draft writes use `save_page_draft`, which verifies edit permission server-side.
- `lock_version` rejects stale writes instead of silently overwriting newer work.
- Local storage remains an offline safety copy.
