-- Tresh multisite account creation.
-- Adds the only authenticated write boundary needed to create a new site,
-- its owner membership, root page, and first draft atomically.

begin;

create or replace function public.create_tresh_site(
  p_name text,
  p_slug text,
  p_document jsonb,
  p_schema_version integer
)
returns table (
  id uuid,
  page_id uuid,
  slug text,
  name text,
  public_url text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_site_id uuid;
  v_page_id uuid;
  v_name text;
  v_slug text;
  v_page_title text;
  v_updated_at timestamptz;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'authentication required'
      using errcode = '42501';
  end if;

  v_name := trim(coalesce(p_name, ''));
  v_slug := lower(trim(coalesce(p_slug, '')));

  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'site name must contain between 2 and 120 characters'
      using errcode = '22023';
  end if;

  if v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
     or char_length(v_slug) > 63 then
    raise exception 'invalid site slug'
      using errcode = '22023';
  end if;

  if p_schema_version <> 1 then
    raise exception 'unsupported document schema version'
      using errcode = '22023';
  end if;

  if p_document is null
     or jsonb_typeof(p_document) <> 'object'
     or jsonb_typeof(p_document -> 'pages') <> 'array'
     or jsonb_array_length(p_document -> 'pages') < 1 then
    raise exception 'invalid site document'
      using errcode = '22023';
  end if;

  v_page_title := coalesce(
    nullif(trim(p_document #>> '{pages,0,title}'), ''),
    'Accueil'
  );

  insert into public.sites (
    slug,
    name,
    public_url,
    created_at,
    updated_at
  )
  values (
    v_slug,
    v_name,
    null,
    now(),
    now()
  )
  returning
    public.sites.id,
    public.sites.updated_at
  into
    v_site_id,
    v_updated_at;

  insert into public.site_members (
    site_id,
    user_id,
    role
  )
  values (
    v_site_id,
    v_user_id,
    'owner'
  );

  insert into public.pages (
    site_id,
    slug,
    title,
    created_at,
    updated_at
  )
  values (
    v_site_id,
    'home',
    v_page_title,
    now(),
    now()
  )
  returning public.pages.id into v_page_id;

  insert into public.page_drafts (
    page_id,
    document,
    schema_version,
    lock_version,
    updated_by,
    updated_at
  )
  values (
    v_page_id,
    p_document,
    p_schema_version,
    1,
    v_user_id,
    now()
  );

  return query
  select
    v_site_id,
    v_page_id,
    v_slug,
    v_name,
    null::text,
    v_updated_at;
end;
$$;

revoke all on function public.create_tresh_site(
  text,
  text,
  jsonb,
  integer
) from public, anon;

grant execute on function public.create_tresh_site(
  text,
  text,
  jsonb,
  integer
) to authenticated;

commit;
