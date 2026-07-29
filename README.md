# Tresh

Tresh is a component-controlled visual CMS for editing and publishing integrated websites without exposing GitHub, builds, deployment hooks, or database concepts to the site owner.

The first integration target is `atelierexpression.ca`.

## Current milestone

The React/TypeScript visual editor shell is now functional locally:

- desktop, tablet, and mobile previews;
- section filmstrip and reordering;
- layer selection, visibility, and locking;
- local addition and deletion of text, buttons, images, paints, and sections;
- Moveable drag, resize, and rotation controls;
- typed responsive placement inheritance;
- undo and redo;
- real browser-local draft persistence;
- no fake production publishing.

The original Claude prototype remains unchanged in `prototypes/tresh-editor-v0.html` as the UX reference.

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

1. Supabase authentication and RLS;
2. immutable page revisions and releases;
3. a privileged Edge Function;
4. the `benrosiers/atelierexpression` GitHub Actions workflow.

## Repository layout

```text
src/editor/            visual editor and document model
src/auth/              future authentication boundary
src/media/             future media library boundary
src/releases/          future release history boundary
src/integrations/      future site adapter boundary
supabase/              migrations and Edge Functions
prototypes/            non-production UX references
tests/                 unit tests
e2e/                   Playwright tests
docs/                  architecture decisions
```
