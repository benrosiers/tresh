-- Tresh core: sites, memberships, pages, and optimistic-locking drafts.
-- Apply with `supabase db push` or through the Supabase SQL editor.

create extension if not exists pgcrypto;

create type public.tresh_site_role as enum (
  'owner',
  'admin',
  'editor',
  'publisher',
  'viewer'
);

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null,
  public_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.site_members (
  site_id uuid not null references public.sites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.tresh_site_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (site_id, user_id)
);

create table public.pages (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, slug)
);

create table public.page_drafts (
  page_id uuid primary key references public.pages(id) on delete cascade,
  document jsonb not null,
  schema_version integer not null,
  lock_version integer not null default 1 check (lock_version > 0),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now()
);

create index site_members_user_id_idx on public.site_members(user_id);
create index pages_site_id_idx on public.pages(site_id);

create or replace function public.tresh_can_access_site(p_site_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.site_members membership
    where membership.site_id = p_site_id
      and membership.user_id = auth.uid()
  );
$$;

create or replace function public.tresh_can_edit_site(p_site_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.site_members membership
    where membership.site_id = p_site_id
      and membership.user_id = auth.uid()
      and membership.role in ('owner', 'admin', 'editor', 'publisher')
  );
$$;

revoke all on function public.tresh_can_access_site(uuid) from public;
revoke all on function public.tresh_can_edit_site(uuid) from public;
grant execute on function public.tresh_can_access_site(uuid) to authenticated;
grant execute on function public.tresh_can_edit_site(uuid) to authenticated;

alter table public.sites enable row level security;
alter table public.site_members enable row level security;
alter table public.pages enable row level security;
alter table public.page_drafts enable row level security;

create policy "members read sites"
on public.sites for select
to authenticated
using (public.tresh_can_access_site(id));

create policy "members read memberships"
on public.site_members for select
to authenticated
using (public.tresh_can_access_site(site_id));

create policy "members read pages"
on public.pages for select
to authenticated
using (public.tresh_can_access_site(site_id));

create policy "members read drafts"
on public.page_drafts for select
to authenticated
using (
  exists (
    select 1
    from public.pages page
    where page.id = page_drafts.page_id
      and public.tresh_can_access_site(page.site_id)
  )
);

-- Draft writes go through this function only. The expected lock version prevents
-- one browser from silently overwriting a newer draft saved by another browser.
create or replace function public.save_page_draft(
  p_page_id uuid,
  p_document jsonb,
  p_schema_version integer,
  p_expected_lock_version integer
)
returns table (lock_version integer, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_site_id uuid;
  v_current_lock integer;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select page.site_id
  into v_site_id
  from public.pages page
  where page.id = p_page_id;

  if v_site_id is null or not public.tresh_can_edit_site(v_site_id) then
    raise exception 'site edit permission required' using errcode = '42501';
  end if;

  select draft.lock_version
  into v_current_lock
  from public.page_drafts draft
  where draft.page_id = p_page_id
  for update;

  if not found then
    if p_expected_lock_version <> 0 then
      raise exception 'draft conflict' using errcode = '40001';
    end if;

    insert into public.page_drafts (
      page_id, document, schema_version, lock_version, updated_by, updated_at
    ) values (
      p_page_id, p_document, p_schema_version, 1, auth.uid(), now()
    );
  else
    if v_current_lock <> p_expected_lock_version then
      raise exception 'draft conflict' using errcode = '40001';
    end if;

    update public.page_drafts
    set document = p_document,
        schema_version = p_schema_version,
        lock_version = page_drafts.lock_version + 1,
        updated_by = auth.uid(),
        updated_at = now()
    where page_id = p_page_id;
  end if;

  return query
  select draft.lock_version, draft.updated_at
  from public.page_drafts draft
  where draft.page_id = p_page_id;
end;
$$;

revoke all on function public.save_page_draft(uuid, jsonb, integer, integer) from public;
grant execute on function public.save_page_draft(uuid, jsonb, integer, integer) to authenticated;

revoke insert, update, delete on public.sites from anon, authenticated;
revoke insert, update, delete on public.site_members from anon, authenticated;
revoke insert, update, delete on public.pages from anon, authenticated;
revoke insert, update, delete on public.page_drafts from anon, authenticated;

grant select on public.sites, public.site_members, public.pages, public.page_drafts to authenticated;
