# ADR 0001: Separate the editor from integrated websites

- Status: Accepted
- Date: 2026-07-29

## Decision

Tresh lives in its own public repository and is deployed independently from Atelier Expression. It stores mutable editorial state in Supabase and publishes immutable releases through server-side functions and GitHub Actions.

Atelier Expression remains the owner of its public rendering, components, styles, tests, and GitHub Pages deployment.

## Consequences

- Cindy uses only `tresh.ca`.
- The public repositories accept external proposals through pull requests, not direct writes.
- Tresh cannot edit an arbitrary site without a site adapter.
- Deployment credentials never enter the browser.
