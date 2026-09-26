# Repository Guidelines

## Project Direction

Read [`PROJECT_VISION.md`](PROJECT_VISION.md) before changing architecture.
This is an AI-first, TypeScript/Replicad CAD framework: prioritize reusable
parametric parts, typed contracts, browser review, snapshots, annotations, and
short feedback loops. Keep the viewer generic and make model-specific behavior
explicit through named parts, states, parameters, and metadata.

## Project Structure & Module Organization

- `src/viewer.js` is the public ESM viewer API: scene setup, camera views,
  mesh registration, and watertightness checks.
- `capture/` contains the Node CLIs and shared helpers for Playwright browser
  driving, screenshots, contact-sheet composition, and configuration loading.
- `README.md` documents the `window.__cadbeaViewer` contract and consumer setup.
- `example/gc-cad/` is a runnable Replicad consumer and integration fixture;
  its README records source provenance and known model limitations.
- `PROJECT_VISION.md` records the intended AI workflow, model organization,
  documentation requirements, and research-informed roadmap.
- `package.json` exposes `cadbea-capture`, `cadbea-contact-sheet`, and
  `cadbea-check`; `node_modules/` is local-only and ignored.

## Build, Test, and Development Commands

The library has no compile step. For the bundled example, use `npm ci` and
`npm --prefix example/gc-cad/replicad ci`, then `npm run example:dev`,
`npm run example:typecheck`, `npm run example:build`, or `npm run example:test`.
The test owns its server and requires Chromium (`npx playwright install chromium`).
Always start the review bridge with the gc-cad app (the example dev command
does this automatically). Verify `/health` and its `codexThreadId` so new CAD
comments are queued to the intended conversation, not just saved to disk.
Other consumer projects should run their dev server, then configure
`cadbea.config.mjs` and invoke the CLIs, for example:

```bash
npm run check                 # validate visible meshes in every declared state
npm run views                 # capture standard, corner, and extra views
npm run contact-sheet        # compose an overview grid per state
```

When working directly from this repository, use the equivalent entry points,
such as `node capture/check.mjs --config=./cadbea.config.mjs`.

## Coding Style & Naming Conventions

Use plain ESM JavaScript with two-space indentation, semicolons omitted, and
single-quoted strings, matching the existing source. Prefer small named
functions and JSDoc annotations for exported APIs. Use camelCase for variables
and functions, PascalCase for classes (if introduced), and kebab-case for CLI
view names such as `corner-tl`. Keep viewer behavior project-agnostic and
preserve the documented `window.__cadbeaViewer` contract.

## Testing Guidelines

There is currently no unit-test framework or coverage threshold. Run
`npm run example:test` for browser integration coverage of viewer states,
mesh checks, camera views, and state resets. Validate
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
instance; Vite consumers should use `resolve.preserveSymlinks: true`. Keep
generated screenshots outside committed source unless they are intentionally
part of documentation.
