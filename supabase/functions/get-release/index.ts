import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const releaseReadKey = Deno.env.get('TRESH_RELEASE_READ_KEY');
  const suppliedToken = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';

  if (!supabaseUrl || !serviceRoleKey || !releaseReadKey) {
    return json({ error: 'release endpoint is not configured' }, 500);
  }
  if (!suppliedToken || suppliedToken !== releaseReadKey) return json({ error: 'unauthorized' }, 401);

  const url = new URL(request.url);
  const releaseId = url.searchParams.get('release_id') ?? '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(releaseId)) {
    return json({ error: 'invalid release id' }, 400);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await adminClient.rpc('get_release_payload', { p_release_id: releaseId });
  if (error) return json({ error: error.message }, 500);
  if (!data) return json({ error: 'release not found' }, 404);

  return json(data);
});
