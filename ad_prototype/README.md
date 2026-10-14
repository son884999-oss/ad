# 홍보잇다 UI Prototype

React-based mobile and desktop UI prototype. The current app uses sample outputs for UI review; a successful UI build does not establish that all production AI features are connected.

## Current instructions

- [AGENTS.md](AGENTS.md): development environment and task entrypoint.
- [DESIGN_MAINTENANCE.md](DESIGN_MAINTENANCE.md): preserve the validated structure and refine it; additional professor feedback and user requests may change it.
- [Documentation index](docs/README.md): current references, feedback, and archived reports.

## Local preview and checks

Use `start-preview.cmd` on Windows, or follow [local preview instructions](docs/LOCAL_PREVIEW.md). Reuse an existing working server.

```shell
pnpm install --frozen-lockfile
pnpm dev --host 127.0.0.1 --port 5173
```

Relevant checks:

```shell
pnpm build
pnpm exec tsc --noEmit
node scripts/verify-documents.mjs
pnpm verify:mobile-flow
pnpm verify:submission
pnpm verify:results
pnpm verify:usability
```

The browser checks need the local preview running and an installed Playwright Chromium browser. `UI_BASE_URL` can point them to a different preview port. `UI_BROWSER_EXECUTABLE` can select an existing Chromium executable. There is no separate lint command; TypeScript, document links, and the focused browser checks are the current verification entrypoints.

Older professor/phase scripts retain historical selectors and evidence. They do not replace current UI verification. See the [final integration review](feedback/2026-10-14-final-integration-review.md) for the checks actually performed and their limits.

Keep the `ad_prototype` directory name: it is the configured Vercel Root Directory.
