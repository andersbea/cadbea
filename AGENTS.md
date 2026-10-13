# Repository Guidelines

## Project Direction

Read [`PROJECT_VISION.md`](PROJECT_VISION.md) before changing architecture.
This is an AI-first, TypeScript/Replicad CAD framework: prioritize reusable
parametric parts, typed contracts, browser review, snapshots, annotations, and
short feedback loops. Keep the viewer generic and make model-specific behavior
explicit through named parts, states, parameters, and metadata.

## Project Structure & Module Organization

- `src/viewer.js` is the public ESM viewer API: scene setup, camera views,
  mesh registration, generic model-file loading, and watertightness checks.
- `src/ui/` is the optional React chrome (`cadbea/ui`) built on that engine:
  topbar, review panel, theming, and the generic drag-and-drop model loader —
  raw JSX source, no build step in this package (the consumer's own Vite +
  `@vitejs/plugin-react` processes it, same as `src/viewer.js`).
- `capture/` contains the Node CLIs and shared helpers for Playwright browser
  driving, screenshots, contact-sheet composition, and configuration loading.
- `bridge/` is the standalone review-event HTTP server (`review-bridge.mjs`,
  bin `cadbea-bridge`) and its Vite auto-start plugin (`start-bridge.mjs`,
  package export `cadbea/bridge/vite-plugin`) — a consumer's own Vite config
  imports the plugin by that specifier (see `example/gc-cad/replicad/vite.config.ts`),
  never by a relative path into this package's source tree.
- `init/` (bin `cadbea-init`) scaffolds a review project in any folder — a
  full turnkey app in a clean folder, or just the `cadbea` dependency +
  `cadbea.config.mjs` + an agent-agnostic `AGENTS.md` section into an
  existing one. Not tied to any one coding agent's tooling on purpose —
  instructions are plain shell commands (`curl`/`grep` against the bridge).
- `README.md` documents the `window.__cadbeaViewer` contract, consumer setup,
  the `cadbea/ui` kit, and `cadbea-init` scaffolding.
- `example/gc-cad/` is a runnable Replicad consumer and integration fixture
  (embedded `cadbea/ui` pattern); its README records source provenance and
  known model limitations.
- `example/file-viewer/` is a minimal Vite+React app proving the turnkey
  `cadbea/ui` pattern: zero project code, drag in a `.glb`/`.gltf`/`.stl`.
- `PROJECT_VISION.md` records the intended AI workflow, model organization,
  documentation requirements, and research-informed roadmap.
- `package.json` exposes `cadbea-capture`, `cadbea-contact-sheet`,
  `cadbea-check`, `cadbea-bridge`, and `cadbea-init`; `node_modules/` is
  local-only and ignored.

## Build, Test, and Development Commands

The library has no compile step. For the bundled example, use `npm ci` and
`npm --prefix example/gc-cad/replicad ci`, then `npm run example:dev`,
`npm run example:typecheck`, `npm run example:build`, or `npm run example:test`.
The test owns its server and requires Chromium (`npx playwright install chromium`).
Always start the review bridge with the gc-cad app (the example dev command
does this automatically). Verify `/health` and its `codexThreadId` so new CAD
comments are queued to the intended conversation, not just saved to disk.
`npm run file-viewer:dev` / `npm run file-viewer:test` exercise the turnkey
`cadbea/ui` path (`example/file-viewer`) the same way.

Other consumer projects should run their dev server, then configure
`cadbea.config.mjs` and invoke the CLIs, for example:

```bash
npm run check                 # validate visible meshes in every declared state
npm run views                 # capture standard, corner, and extra views
npm run contact-sheet        # compose an overview grid per state
```

When working directly from this repository, use the equivalent entry points,
such as `node capture/check.mjs --config=./cadbea.config.mjs`.

## Running a review session on `example/gc-cad`

`npm run example:dev` starts the example's dev server and auto-starts the
review bridge (`http://127.0.0.1:8787`) via `reviewBridgePlugin()`. Open
`http://127.0.0.1:5173` so the model can be marked up. A comment only exists
once the user clicks **"Mark for AI"** — that's the `annotation-added` event
type; plain part selection fires a separate, much noisier `selection-changed`
event on every click, so don't treat that as a comment. Listen for comments
with whatever your tooling uses to watch a long-running process, e.g.:

```bash
curl -N -s http://127.0.0.1:8787/events/stream | grep --line-buffered '"type":"annotation-added"'
```

(or poll `GET http://127.0.0.1:8787/events` if your tooling can't hold a
process open). Treat `annotation.note` plus its `selection`/`camera`/`state`
as a real request about that specific part — read the referenced source,
make the change, then validate with `npm run check` (or the equivalent
`cadbea-check`) before considering it resolved. This same workflow, written
generically for any coding agent (not specific to this repository's own
paths/ports), is what `cadbea-init` writes into a *new* project's own
`AGENTS.md` — see the README's "Scaffolding a new project".

## Coding Style & Naming Conventions

Use plain ESM JavaScript with two-space indentation, semicolons omitted, and
single-quoted strings, matching the existing source. Prefer small named
functions and JSDoc annotations for exported APIs. Use camelCase for variables
and functions, PascalCase for classes (if introduced), and kebab-case for CLI
view names such as `corner-tl`. Keep viewer behavior project-agnostic and
preserve the documented `window.__cadbeaViewer` contract. `src/ui/` is the one
exception to "plain JavaScript": it's JSX/React, since the shared chrome
genuinely needs a component model — keep it framework-free everywhere else.

## Testing Guidelines

There is currently no unit-test framework or coverage threshold. Run
`npm run example:test` for browser integration coverage of viewer states,
mesh checks, camera views, and state resets, and `npm run file-viewer:test`
for the generic model-loader path (loads a fixture file through the real
file input, then checks it landed in the scene and is watertight). Validate
changes with the deterministic `cadbea-check` command against a running
consumer viewer, and inspect relevant full-resolution captures after changing
camera or rendering behavior. Name model parts in `addThreeGeometry()` so
check failures identify the affected geometry.

## Commit & Pull Request Guidelines

Recent commits use concise, imperative summaries (for example, “Add …” or
“Fix …”). Follow that style and keep each commit focused. Pull requests should
explain the behavior change, identify affected commands or APIs, include
validation results, and attach representative screenshots/contact sheets for
visual changes. Mention any README or consumer-configuration updates needed.

## Configuration & Dependency Notes

`three` is a peer dependency of consumers and should resolve to one shared
instance; Vite consumers should use `resolve.preserveSymlinks: true`. `react`
and `react-dom` are optional peer dependencies, needed only by projects that
use `cadbea/ui` — a project using it also needs `@vitejs/plugin-react` and
extra `optimizeDeps` entries; see the README's "Additional Vite setup for
cadbea/ui" for the exact config and why (both entries were hit as real
duplicate-instance/runtime bugs while building `example/gc-cad`, not added
speculatively). Keep generated screenshots outside committed source unless
they are intentionally part of documentation.
