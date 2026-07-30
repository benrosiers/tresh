-- Tresh accounts and immutable publication releases.
-- Apply after 0001_core_drafts.sql.

begin;

-- Explicit Data API privileges. These are required when new tables are not
-- automatically exposed during project creation.
grant usage on schema public to authenticated, service_role;
grant usage on type public.tresh_site_role to authenticated, service_role;
grant select on public.sites, public.site_members, public.pages, public.page_drafts to authenticated;
grant select, insert, update, delete on public.sites, public.site_members, public.pages, public.page_drafts to service_role;
grant execute on all functions in schema public to authenticated, service_role;

-- Private avatar bucket. Each authenticated user can access only their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "users read own avatars" on storage.objects;
drop policy if exists "users upload own avatars" on storage.objects;
drop policy if exists "users update own avatars" on storage.objects;
drop policy if exists "users delete own avatars" on storage.objects;

create policy "users read own avatars"
on storage.objects for select
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users upload own avatars"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users update own avatars"
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users delete own avatars"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

do $$
begin
  create type public.tresh_release_status as enum (
    'created',
    'dispatched',
    'deployed',
    'failed'
  );
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.page_revisions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages(id) on delete restrict,
  revision_number integer not null check (revision_number > 0),
  document jsonb not null,
  schema_version integer not null,
  draft_lock_version integer not null check (draft_lock_version > 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (page_id, revision_number)
);

create table if not exists public.releases (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete restrict,
  status public.tresh_release_status not null default 'created',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  dispatched_at timestamptz,
  deployed_at timestamptz,
  failed_at timestamptz,
  failure_message text,
  github_run_url text
);

create table if not exists public.release_pages (
  release_id uuid not null references public.releases(id) on delete restrict,
  page_id uuid not null references public.pages(id) on delete restrict,
  page_revision_id uuid not null references public.page_revisions(id) on delete restrict,
  primary key (release_id, page_id),
  unique (release_id, page_revision_id)
);

create index if not exists page_revisions_page_id_idx on public.page_revisions(page_id, revision_number desc);
create index if not exists releases_site_id_idx on public.releases(site_id, created_at desc);
create index if not exists release_pages_revision_id_idx on public.release_pages(page_revision_id);

create or replace function public.tresh_can_publish_site(p_site_id uuid)
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
      and membership.role in ('owner', 'admin', 'publisher')
  );
$$;

revoke all on function public.tresh_can_publish_site(uuid) from public;
grant execute on function public.tresh_can_publish_site(uuid) to authenticated, service_role;

create or replace function public.create_site_release(
  p_site_slug text,
  p_page_slug text,
  p_expected_lock_version integer
)
returns table (
  release_id uuid,
  revision_id uuid,
  revision_number integer,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_site_id uuid;
  v_page_id uuid;
  v_document jsonb;
  v_schema_version integer;
  v_lock_version integer;
  v_revision_number integer;
  v_revision_id uuid;
  v_release_id uuid;
  v_created_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select site.id, page.id
  into v_site_id, v_page_id
  from public.sites site
  join public.pages page on page.site_id = site.id
  where site.slug = p_site_slug
    and page.slug = p_page_slug;

  if v_site_id is null or not public.tresh_can_publish_site(v_site_id) then
    raise exception 'site publish permission required' using errcode = '42501';
  end if;

  select draft.document, draft.schema_version, draft.lock_version
  into v_document, v_schema_version, v_lock_version
  from public.page_drafts draft
  where draft.page_id = v_page_id
  for update;

  if not found then
    raise exception 'no saved draft exists for this page' using errcode = '22023';
  end if;

  if v_lock_version <> p_expected_lock_version then
    raise exception 'draft conflict' using errcode = '40001';
  end if;

  select coalesce(max(revision.revision_number), 0) + 1
  into v_revision_number
  from public.page_revisions revision
  where revision.page_id = v_page_id;

  insert into public.page_revisions (
    page_id,
    revision_number,
    document,
    schema_version,
    draft_lock_version,
    created_by
  ) values (
    v_page_id,
    v_revision_number,
    v_document,
    v_schema_version,
    v_lock_version,
    auth.uid()
  )
  returning id into v_revision_id;

  insert into public.releases (site_id, status, created_by)
  values (v_site_id, 'created', auth.uid())
  returning id, public.releases.created_at into v_release_id, v_created_at;

  insert into public.release_pages (release_id, page_id, page_revision_id)
  values (v_release_id, v_page_id, v_revision_id);

  return query select v_release_id, v_revision_id, v_revision_number, v_created_at;
end;
$$;

revoke all on function public.create_site_release(text, text, integer) from public;
grant execute on function public.create_site_release(text, text, integer) to authenticated;

create or replace function public.get_release_payload(p_release_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'releaseId', release.id,
    'status', release.status,
    'createdAt', release.created_at,
    'site', jsonb_build_object(
      'id', site.id,
      'slug', site.slug,
      'name', site.name,
      'publicUrl', site.public_url
    ),
    'pages', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', page.id,
          'slug', page.slug,
          'title', page.title,
          'revisionId', revision.id,
          'revisionNumber', revision.revision_number,
          'schemaVersion', revision.schema_version,
          'document', revision.document,
          'createdAt', revision.created_at
        ) order by page.slug
      ) filter (where page.id is not null),
      '[]'::jsonb
    )
  )
  from public.releases release
  join public.sites site on site.id = release.site_id
  left join public.release_pages release_page on release_page.release_id = release.id
  left join public.pages page on page.id = release_page.page_id
  left join public.page_revisions revision on revision.id = release_page.page_revision_id
  where release.id = p_release_id
  group by release.id, site.id;
$$;

revoke all on function public.get_release_payload(uuid) from public, anon, authenticated;
grant execute on function public.get_release_payload(uuid) to service_role;

create or replace function public.prevent_immutable_release_change()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Tresh release records are immutable';
end;
$$;

drop trigger if exists page_revisions_are_immutable on public.page_revisions;
create trigger page_revisions_are_immutable
before update or delete on public.page_revisions
for each row execute function public.prevent_immutable_release_change();

drop trigger if exists release_pages_are_immutable on public.release_pages;
create trigger release_pages_are_immutable
before update or delete on public.release_pages
for each row execute function public.prevent_immutable_release_change();

alter table public.page_revisions enable row level security;
alter table public.releases enable row level security;
alter table public.release_pages enable row level security;

drop policy if exists "members read page revisions" on public.page_revisions;
create policy "members read page revisions"
on public.page_revisions for select
to authenticated
using (
  exists (
    select 1
    from public.pages page
    where page.id = page_revisions.page_id
      and public.tresh_can_access_site(page.site_id)
  )
);

drop policy if exists "members read releases" on public.releases;
create policy "members read releases"
on public.releases for select
to authenticated
using (public.tresh_can_access_site(site_id));

drop policy if exists "members read release pages" on public.release_pages;
create policy "members read release pages"
on public.release_pages for select
to authenticated
using (
  exists (
    select 1
    from public.releases release
    where release.id = release_pages.release_id
      and public.tresh_can_access_site(release.site_id)
  )
);

grant usage on type public.tresh_release_status to authenticated, service_role;
grant select on public.page_revisions, public.releases, public.release_pages to authenticated;
grant select, insert, update, delete on public.page_revisions, public.releases, public.release_pages to service_role;
revoke insert, update, delete on public.page_revisions, public.releases, public.release_pages from anon, authenticated;

commit;
