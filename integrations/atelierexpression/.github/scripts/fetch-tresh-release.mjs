import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const releaseId = process.env.TRESH_RELEASE_ID;
const endpoint = process.env.TRESH_RELEASE_ENDPOINT;
const token = process.env.TRESH_RELEASE_READ_KEY;
const output = resolve(process.env.TRESH_RELEASE_OUTPUT ?? 'src/data/tresh-release.json');

if (!releaseId || !endpoint || !token) {
  throw new Error('TRESH_RELEASE_ID, TRESH_RELEASE_ENDPOINT and TRESH_RELEASE_READ_KEY are required.');
}

const url = new URL(endpoint);
url.searchParams.set('release_id', releaseId);
const response = await fetch(url, {
  headers: { Authorization: `Bearer ${token}` },
});

if (!response.ok) {
  throw new Error(`Tresh release download failed (${response.status}): ${await response.text()}`);
}

const payload = await response.json();
if (!payload || payload.releaseId !== releaseId || !Array.isArray(payload.pages) || payload.pages.length === 0) {
  throw new Error('Tresh returned an invalid or empty release payload.');
}

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(`Tresh release ${releaseId} written to ${output}`);
