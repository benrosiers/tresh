# Tresh architecture foundation

Tresh is a private visual CMS served as a static React application. It edits only sites that implement a Tresh site adapter.

## Boundary map

- **GitHub Pages:** static Tresh frontend and integrated public sites.
- **Supabase Auth:** user sessions.
- **Supabase Postgres + RLS:** organizations, sites, drafts, immutable revisions, releases, permissions, and audit events.
- **Supabase Storage:** uploaded media.
- **Supabase Edge Functions:** privileged publication and integration operations.
- **GitHub Actions:** deterministic validation, build, and GitHub Pages deployment.

## Editor split

- **Puck:** page structure and component configuration.
- **ArtScene + React Moveable:** controlled 2D positioning for decorative art, photographs, doodles, and selected content blocks.
- **Zod contracts:** all saved and published documents are schema-versioned and validated.

## Non-goals for the first release

- Arbitrary HTML, JavaScript, or CSS editing.
- Importing an arbitrary external website.
- Real-time multi-user collaboration.
- A generic marketplace or billing system.
