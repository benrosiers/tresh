import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const reportKey = Deno.env.get('TRESH_RELEASE_REPORT_KEY');
  const suppliedToken = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';

  if (!supabaseUrl || !serviceRoleKey || !reportKey) {
    return json({ error: 'report endpoint is not configured' }, 500);
  }
  if (!suppliedToken || suppliedToken !== reportKey) return json({ error: 'unauthorized' }, 401);

  let body: { releaseId?: unknown; status?: unknown; runUrl?: unknown; message?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }

  const releaseId = typeof body.releaseId === 'string' ? body.releaseId : '';
  const status = body.status === 'deployed' || body.status === 'failed' ? body.status : null;
  const runUrl = typeof body.runUrl === 'string' ? body.runUrl.slice(0, 2000) : null;
  const message = typeof body.message === 'string' ? body.message.slice(0, 1500) : null;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(releaseId) || !status) {
    return json({ error: 'invalid report' }, 400);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const now = new Date().toISOString();
  const patch = status === 'deployed'
    ? {
        status,
        deployed_at: now,
        failed_at: null,
        failure_message: null,
        github_run_url: runUrl,
      }
    : {
        status,
        failed_at: now,
        failure_message: message ?? 'GitHub Actions deployment failed',
        github_run_url: runUrl,
      };

  const { error } = await adminClient.from('releases').update(patch).eq('id', releaseId);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
});
