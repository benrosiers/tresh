# Step 4: accounts and immutable publication

This milestone adds two production boundaries:

1. authenticated users can edit their display name, avatar, and password inside Tresh;
2. `Publier` creates an immutable Supabase release and dispatches a GitHub Actions deployment without exposing credentials to the browser.

## Account behavior

- Login uses semantic `username` and `current-password` fields.
- Password change uses `username`, `current-password`, and two `new-password` fields so Chrome, Edge, and Windows password managers can recognize the operation.
- A password reset email opens Tresh in recovery mode and immediately presents the new-password form.
- Avatars are stored in the private `avatars` bucket under `<auth.uid()>/...` and are protected by Storage RLS.
- Display name and avatar path are stored in Supabase Auth user metadata.

## 1. Apply the database migration

In the Supabase SQL Editor, run:

```text
supabase/migrations/0002_accounts_and_releases.sql
```

This migration is intentionally safe to run after the existing core migration. It also adds the explicit Data API grants needed because automatic table exposure was disabled when the project was created.

Expected new tables:

- `page_revisions`
- `releases`
- `release_pages`

Expected new Storage bucket:

- `avatars` (private)

## 2. Install the Supabase CLI

From the Tresh repository:

```powershell
cd E:\Omni\tresh
npm install --save-dev supabase
npx supabase login
npx supabase link --project-ref xhwowxgaiqgmvoefzuic
```

Do not put a service-role or secret key in `.env.local`.

## 3. Create publication secrets

Generate two independent random values in PowerShell:

```powershell
$readKey = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
$reportKey = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))

"READ KEY  : $readKey"
"REPORT KEY: $reportKey"
```

Create a fine-grained GitHub personal access token that can access only `benrosiers/atelierexpression` and has **Actions: Read and write** permission. Store it in the Supabase Edge Function secrets, never in Vite.

```powershell
npx supabase secrets set `
  GITHUB_TOKEN="PASTE_FINE_GRAINED_GITHUB_TOKEN" `
  GITHUB_OWNER="benrosiers" `
  GITHUB_REPO="atelierexpression" `
  GITHUB_WORKFLOW_FILE="tresh-publish.yml" `
  GITHUB_REF="main" `
  TRESH_RELEASE_READ_KEY="$readKey" `
  TRESH_RELEASE_REPORT_KEY="$reportKey"
```

## 4. Deploy the Edge Functions

```powershell
npx supabase functions deploy publish-site
npx supabase functions deploy get-release --no-verify-jwt
npx supabase functions deploy report-release --no-verify-jwt
```

Functions:

- `publish-site`: authenticated Tresh request; creates a release and dispatches GitHub.
- `get-release`: narrow read endpoint used by GitHub Actions.
- `report-release`: receives success/failure from GitHub Actions.

## 5. Install the target repository integration

Copy the contents of:

```text
integrations/atelierexpression/
```

into the root of the public `benrosiers/atelierexpression` repository. This adds:

- `.github/workflows/tresh-publish.yml`
- `.github/scripts/fetch-tresh-release.mjs`
- `.github/scripts/report-tresh-release.mjs`
- `src/lib/treshRelease.ts`
- a placeholder `src/data/tresh-release.json`

The Astro page adapter must read `getTreshPage('home')`, render its `document` with Atelier Expression components, and keep the existing static/Supabase fallback when the function returns `null` during local development. The workflow replaces the placeholder JSON only inside the deployment workspace; it does not commit generated content back to the repository.

## 6. Add GitHub Actions secrets to `benrosiers/atelierexpression`

Repository **Settings → Secrets and variables → Actions → New repository secret**:

```text
TRESH_RELEASE_ENDPOINT
https://xhwowxgaiqgmvoefzuic.supabase.co/functions/v1/get-release

TRESH_RELEASE_READ_KEY
<the generated read key>

TRESH_RELEASE_REPORT_ENDPOINT
https://xhwowxgaiqgmvoefzuic.supabase.co/functions/v1/report-release

TRESH_RELEASE_REPORT_KEY
<the generated report key>
```

## 7. Configure GitHub Pages

In the Atelier Expression repository:

```text
Settings → Pages → Build and deployment → Source: GitHub Actions
```

## 8. Test publication

1. Sign in to Tresh with an `owner`, `admin`, or `publisher` account.
2. Make a small edit.
3. Wait for `Sauvegardé dans Tresh`.
4. Click `Publier`.
5. Confirm `Publier maintenant`.
6. Verify a new immutable row in `releases` and `page_revisions`.
7. Verify the `Publish Tresh release` workflow in GitHub Actions.

A failed GitHub dispatch or build updates the release to `failed`; the existing public site remains untouched.
