import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const githubToken = Deno.env.get('GITHUB_TOKEN');
  const githubOwner = Deno.env.get('GITHUB_OWNER') ?? 'benrosiers';
  const githubRepo = Deno.env.get('GITHUB_REPO') ?? 'atelierexpression';
  const workflowFile = Deno.env.get('GITHUB_WORKFLOW_FILE') ?? 'tresh-publish.yml';
  const githubRef = Deno.env.get('GITHUB_REF') ?? 'main';
  const authorization = request.headers.get('Authorization');

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) {
    return json({ error: 'publication environment is incomplete' }, 500);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: 'authentication required' }, 401);

  let body: { siteSlug?: unknown; pageSlug?: unknown; expectedLockVersion?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }

  const siteSlug = typeof body.siteSlug === 'string' ? body.siteSlug : '';
  const pageSlug = typeof body.pageSlug === 'string' ? body.pageSlug : '';
  const expectedLockVersion = typeof body.expectedLockVersion === 'number'
    ? body.expectedLockVersion
    : Number.NaN;

  if (!siteSlug || !pageSlug || !Number.isInteger(expectedLockVersion) || expectedLockVersion < 1) {
    return json({ error: 'invalid publication request' }, 400);
  }

  const { data: releaseRows, error: releaseError } = await userClient.rpc('create_site_release', {
    p_site_slug: siteSlug,
    p_page_slug: pageSlug,
    p_expected_lock_version: expectedLockVersion,
  });

  if (releaseError) return json({ error: releaseError.message }, releaseError.code === '42501' ? 403 : 409);

  const release = Array.isArray(releaseRows) ? releaseRows[0] : releaseRows;
  if (!release?.release_id || !release?.revision_id) {
    return json({ error: 'release creation returned no result' }, 500);
  }

  if (!githubToken) {
    await adminClient
      .from('releases')
      .update({
        status: 'failed',
        failed_at: new Date().toISOString(),
        failure_message: 'GITHUB_TOKEN is not configured',
      })
      .eq('id', release.release_id);
    return json({ error: 'GitHub publication is not configured' }, 503);
  }

  const dispatchResponse = await fetch(
    `https://api.github.com/repos/${githubOwner}/${githubRepo}/actions/workflows/${workflowFile}/dispatches`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${githubToken}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'tresh-publisher',
      },
      body: JSON.stringify({
        ref: githubRef,
        inputs: { release_id: release.release_id },
      }),
    },
  );

  if (!dispatchResponse.ok) {
    const failure = (await dispatchResponse.text()).slice(0, 1500);
    await adminClient
      .from('releases')
      .update({
        status: 'failed',
        failed_at: new Date().toISOString(),
        failure_message: `GitHub ${dispatchResponse.status}: ${failure}`,
      })
      .eq('id', release.release_id);
    return json({ error: 'GitHub refused the deployment request' }, 502);
  }

  const { error: statusError } = await adminClient
    .from('releases')
    .update({ status: 'dispatched', dispatched_at: new Date().toISOString() })
    .eq('id', release.release_id);

  if (statusError) return json({ error: statusError.message }, 500);

  return json({
    releaseId: release.release_id,
    revisionId: release.revision_id,
    revisionNumber: release.revision_number,
    status: 'dispatched',
  });
});
