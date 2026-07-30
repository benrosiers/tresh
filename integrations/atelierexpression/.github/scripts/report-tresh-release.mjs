const endpoint = process.env.TRESH_RELEASE_REPORT_ENDPOINT;
const token = process.env.TRESH_RELEASE_REPORT_KEY;
const releaseId = process.env.TRESH_RELEASE_ID;
const jobStatus = process.argv[2] ?? 'failure';

if (!endpoint || !token || !releaseId) {
  console.warn('Tresh release reporting is not configured; skipping.');
  process.exit(0);
}

const status = jobStatus === 'success' ? 'deployed' : 'failed';
const response = await fetch(endpoint, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    releaseId,
    status,
    runUrl: process.env.TRESH_GITHUB_RUN_URL,
    message: status === 'failed' ? `GitHub Actions job status: ${jobStatus}` : undefined,
  }),
});

if (!response.ok) {
  console.warn(`Tresh release reporting failed (${response.status}): ${await response.text()}`);
}
