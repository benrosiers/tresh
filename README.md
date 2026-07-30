# Tresh

Tresh is a component-controlled visual CMS for editing and publishing integrated websites without exposing GitHub, builds, deployment hooks, or database concepts to the site owner.

The first integration target is `atelierexpression.ca`.

## Current milestone

The editor now includes the first production-facing draft boundary:

- React/TypeScript visual editor with Moveable interactions
- section creation, ordering, visibility, and confirmed deletion
- local autosave and undo/redo
- Supabase Auth with password-manager-friendly login and recovery
- account profile, private avatar upload, and in-app password change
- cloud draft loading and saving through RLS-protected tables
- optimistic `lock_version` conflict protection
- immutable page revisions and releases
- privileged Supabase Edge Function publication boundary
- GitHub Actions deployment template for Atelier Expression
- local storage retained as an offline safety copy

See `docs/SUPABASE_SETUP.md` for cloud drafts and `docs/STEP4_PUBLISHING.md` for account and publication setup.

## Development

```bash
npm install
npm run dev
```

The development server uses `http://127.0.0.1:4326`.

## Validation

```bash
npm run typecheck
npm test
npm run build
```

## Important boundary

The **Publier** action now calls a privileged Edge Function. It becomes operational after the Step 4 migration, function secrets, function deployment, and Atelier Expression workflow/adapter installation are completed. Credentials never enter the browser.

## Repository layout

```text
src/editor/            visual editor and document model
src/auth/              Supabase Auth gate and login UI
src/drafts/            local and Supabase draft persistence
src/media/             future media library boundary
src/releases/          future release history boundary
src/integrations/      future site adapter boundary
supabase/              migrations and Edge Functions
prototypes/            non-production UX references
tests/                 unit tests
e2e/                   Playwright tests
docs/                  architecture decisions
```
