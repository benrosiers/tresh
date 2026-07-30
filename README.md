# Tresh

Tresh is a component-controlled visual CMS for editing and publishing integrated websites without exposing GitHub, builds, deployment hooks, or database concepts to the site owner.

The first integration target is `atelierexpression.ca`.

## Current milestone

The editor now includes the first production-facing draft boundary:

- React/TypeScript visual editor with Moveable interactions
- section creation, ordering, visibility, and confirmed deletion
- local autosave and undo/redo
- optional Supabase Auth gate
- cloud draft loading and saving through RLS-protected tables
- optimistic `lock_version` conflict protection
- local storage retained as an offline safety copy
- publication remains deliberately disabled until releases and GitHub Actions are implemented

See `docs/SUPABASE_SETUP.md` to enable authenticated cloud drafts.

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

The current **Publier** action intentionally explains that production publishing is unavailable. It does not show a fake progress sequence. Production publishing will require:

1. immutable page revisions and releases;
2. a privileged Edge Function;
3. the `benrosiers/atelierexpression` GitHub Actions workflow.

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
