# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Read [`PROJECT_VISION.md`](PROJECT_VISION.md) before changing architecture — this repo is the current
implementation slice of a larger intended AI-first, TypeScript/Replicad CAD framework (see that file and
`docs/DESIGN_AND_RESEARCH.md`). `docs/IMPLEMENTATION_STATUS.md` tracks what's actually done vs. planned
and should be updated at the end of a work session (it records resume notes for the next session, e.g.
which physical validation is still outstanding, uncommitted work, dev-server ports in use).

## What this repo is

`cadbea` is a project-agnostic viewer bootstrap + screenshot/contact-sheet/watertightness-check harness
for reviewing three.js-based parametric CAD models (built for and tested against replicad, but not
coupled to it — anything that puts meshes into a three.js scene works). It is consumed via a `file:`
dependency by other projects (the bundled `example/` apps are both the test fixtures and the reference
integration pattern). There is no compile step for the library itself (plain ESM JS + JSDoc); `src/ui/`
is the one exception (JSX/React).

## Commands

Run from the repository root unless noted. On Windows PowerShell with restricted script execution, use
`npm.cmd`/`npx.cmd` instead of `npm`/`npx`.

```bash
npm ci                                   # root deps
npm --prefix example/gc-cad/replicad ci  # example app deps
npx playwright install chromium          # required once, for capture/check and browser tests

npm run example:dev                      # gc-cad example dev server (also starts the review bridge)
npm run example:typecheck
npm run example:build
npm run example:test                     # Playwright browser integration test; owns its own server

npm run file-viewer:dev                  # turnkey cadbea/ui example (zero project code)
npm run file-viewer:test

npm run bridge                           # start the review bridge standalone (bridge/review-bridge.mjs)
```

Against any running consumer dev server (standard pattern a consumer project wires into its own
`package.json`, see README "Project setup"):

```bash
node capture/check.mjs --config=./cadbea.config.mjs          # deterministic watertightness, every state
node capture/capture.mjs --config=./cadbea.config.mjs         # full-res standard+corner+extra views
node capture/contact-sheet.mjs --config=./cadbea.config.mjs   # one overview grid per declared state
```

There is no unit-test framework for the library itself. `npm run example:test` is the real coverage
(viewer states, mesh/geometry checks, camera views, state resets); `npm run file-viewer:test` covers the
generic file-drop model-loader path. Validate viewer/rendering changes against a live consumer with
`cadbea-check` plus inspection of full-resolution captures — contact-sheet cells are downscaled and can
hide or fake a defect (see README "Deterministic geometry checks" for why visual-only review is
insufficient and `checkGeometry()`/`checkWatertight()` exists).

## Architecture

**`src/viewer.js`** (`createViewer()`, `addThreeGeometry()`, `loadModelFile()`) is the entire public
engine API: scene/camera/controls/lighting bootstrap, bounding-box-derived standard (`iso`, `front`,
`top`, ...) and corner (`corner-tl`, ...) camera views, named-part selection (click or area-drag),
annotations, review-state serialization, optional webhook/SSE review events, and the mesh-level
watertightness checker. A consumer assigns the built object to `window.__cadbeaViewer` — this global
contract (fully typed in README.md) is the seam everything else in the repo talks through: `capture/`
drives it from outside via Playwright, and the browser console emits structured `[cadbea]` events plus a
`cadbea-review` `CustomEvent` off of it. Treat `window.__cadbeaViewer`'s shape as a stable public API;
changes to it are breaking changes for every consumer example and for `capture/`.

**`src/ui/`** is the optional React chrome (`cadbea/ui` export) built *on top of* that engine —
`CadbeaApp`, `Topbar`, `ReviewPanel`, `StatesToolbar`, `ModelLoader`, a `ThemeProvider`/`ThemeToggle` with
runtime `registerTheme()`, and shared primitives (`Button`/`Panel`/`Pill`/`Field`). Two integration
patterns, both producing the same `window.__cadbeaViewer` contract: **turnkey** (`mountCadbeaApp()` —
zero project code, drag-and-drop loader, see `example/file-viewer`) and **embedded** (project builds its
own viewer/geometry, then wraps it in `<CadbeaApp viewer={viewer}>`, see `example/gc-cad`). Raw JSX
source, no build step in this package — the consumer's own Vite + `@vitejs/plugin-react` processes it,
same as `src/viewer.js`. Keep model-specific behavior out of both `src/viewer.js` and `src/ui/`; it
belongs in a consumer project.

**`capture/`** — Node CLIs (`capture.mjs`, `contact-sheet.mjs`, `check.mjs`) and shared helpers
(`capture/lib/browser.mjs` Playwright driving, `compose.mjs` contact-sheet image composition,
`config.mjs` `cadbea.config.mjs` loading) that headlessly drive a running consumer's viewer through
`window.__cadbeaViewer`, waiting on `.ready`. These are the `cadbea-capture`/`cadbea-contact-sheet`/
`cadbea-check` bins.

**`bridge/`** (`review-bridge.mjs`, `start-bridge.mjs`, `notify-codex.mjs`) is a small standalone Node
HTTP server a consumer viewer POSTs review events to (`reviewWebhook` option) — persists history to
`.data/review-events.jsonl`, serves `/health` and `/events` (history) plus `/events/stream` (SSE for an
AI adapter that should react immediately), and queues new browser comments into a running Codex
conversation (`CODEX_THREAD_ID`/`CADBEA_CODEX_THREAD`). Restarting the bridge changes its target
conversation.

**`example/gc-cad/`** — a real TypeScript/Replicad consumer (Heltec Wireless Tracker V2 enclosure) used
as the integration fixture for the embedded `cadbea/ui` pattern; `replicad/src/model/` holds the
geometry, `replicad/src/main.tsx` is the viewer adapter (mesh names, exploded/section states). Its own
README (`PARTS.md` for the feature/issue registry, `HARDWARE.md` for fixed dimensions, `UPSTREAM.json`
for source provenance) documents model-specific details and known fit/print issues — those are specific
to that example model, not to `cadbea` itself, and shouldn't leak into the generic engine.

**`example/file-viewer/`** — a minimal Vite+React app proving the turnkey `cadbea/ui` pattern with zero
project code; also the fixture for the generic `.glb`/`.gltf`/`.stl` file-drop loader test.

## Key gotchas (hit for real, not precautionary — see README for full detail)

- `three` must resolve to one shared instance across a consumer project and `cadbea`. A Vite consumer
  needs `resolve: { preserveSymlinks: true }` (and, for `cadbea/ui`, also `dedupe: ['three', 'react',
  'react-dom']`, `@vitejs/plugin-react`, and specific `optimizeDeps.include`/`exclude` entries — see
  README "Additional Vite setup for cadbea/ui"). Don't let a physical `three` end up in `cadbea`'s own
  `node_modules` satisfying its peerDependency; delete it if `npm install` puts one there.
- Vite does **not** live-reload edits to `cadbea`'s own source when linked via `file:` from outside the
  consumer's project root. If an edit to this repo doesn't seem to take effect in a consumer, check for a
  `page reload …cadbea/src/…` line in that consumer's dev server output; if absent, kill the dev server
  and delete its `node_modules/.vite` before concluding the change had no effect.
- `checkGeometry()`'s default weld tolerance (1e-4) is a reasonable millimeter-scale default, not derived
  from anything — pass `{ tolerance }` for a model with different scale/precision.
- `visibleBoundingBox` only checks each mesh's own `.visible` flag, not full scene-graph inheritance.

## Coding style

Plain ESM JavaScript, two-space indentation, semicolons omitted, single-quoted strings. Small named
functions, JSDoc on exported APIs. camelCase for variables/functions, PascalCase for classes, kebab-case
for CLI view names (`corner-tl`). Keep `src/viewer.js` and `capture/` project-agnostic — anything
model-specific belongs in a consumer/example, not the library. `src/ui/` is JSX/React by necessity; keep
everything else framework-free.

## Commit style

Concise, imperative summaries ("Add …", "Fix …"), one focused change per commit. PRs should explain the
behavior change, identify affected commands/APIs, include validation results, and attach representative
screenshots/contact sheets for visual changes — mention any README or consumer-configuration updates
needed. Keep generated screenshots out of committed source unless intentionally used as documentation.
