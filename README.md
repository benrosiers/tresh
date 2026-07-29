# Tresh

Tresh is a private, component-controlled visual CMS for publishing integrated websites. Its first integration is Atelier Expression.

> Repository visibility is public. Editing access, drafts, releases, media, and privileged publication remain protected by Supabase Auth, RLS, and server-side functions.

## Current status

Foundation step 1 is complete:

- React + TypeScript + Vite shell
- Puck, React Moveable, Supabase, and Zod dependencies declared
- Vitest and Playwright foundations
- GitHub Actions CI and GitHub Pages deployment workflows
- versioned site-document contract
- architecture and contribution boundaries
- Claude's HTML prototype preserved at `prototypes/tresh-editor-v0.html`

There is deliberately no fake save or publish operation in the React application.

## Local development

```bash
npm install
npm run dev
```

Tresh runs on `http://127.0.0.1:4326`.

## Verification

```bash
npm run check
npm run test:e2e:install
npm run test:e2e
```

## Environment

Copy `.env.example` to `.env.local` when the Supabase project exists. Never expose a service-role key or a deployment credential through a `VITE_` variable.

## Hosting

- `tresh.ca`: GitHub Pages from this repository.
- `atelierexpression.ca`: GitHub Pages from its own repository.
- backend: Supabase Auth, Postgres, Storage, and Edge Functions.

## License

No open-source license has been selected yet. Public visibility does not grant reuse rights by itself. A deliberate license decision will be made before a stable public release.
