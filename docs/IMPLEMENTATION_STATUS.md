# Implementation Status

_Last updated: 2026-10-04_

## Current State

The repository contains the initial `cadbea` viewer library and a runnable
GC-CAD Replicad example copied from `C:/dev/guardianchain-labs/gc-cad`.
The example is the current validation project and is served on port 5174;
port 5173 belongs to the original upstream project and should not be stopped.

## Implemented

- Generic Three.js viewer API with named-part selection and review annotations.
- Browser-console, `CustomEvent`, and optional webhook review events.
- Part-click mode and free area-focus mode. Area focus records a normalized
  screen rectangle, viewport, camera, and state; it does not assign parts.
- Persistent camera position, target, and zoom in `localStorage` across refreshes.
- Model-configured print bundle support with one download-all button.
- GC-CAD STL exports plus `node-wireless-tracker-v2-print-files.zip`.
- Exploded and section views, twelve camera views, mesh/watertightness checks,
  and browser integration coverage.
- GC-CAD USB-C body lip and matching bounded lid opening.
- GC-CAD body/lid USB-C cutouts now share identical bounds, removing the
  assembled step/gap reported through the review bridge.
- Recessed underside pockets for PRG/RST button flanges so they do not press
  continuously against the board.
- Button divider-wall reliefs and an additional 0.5 mm button cap protrusion
  prevent binding and improve actuation.
- Bridge health status is visible in the GC-CAD UI and exposed through the
  generic viewer API (`getBridgeStatus`, `checkBridge`, and
  `onBridgeStatusChange`).
- The bridge supports live Server-Sent Events at `/events/stream`, in addition
  to persisted history at `/events`; review logs include annotation text.
- Latest physical-fit revision: battery and antenna lanes are swapped, the
  enclosure gains 2 mm of internal length, and the base now has a 1 mm-per-side
  recessed upper shoulder for a flush-footprint lid.
- 2026-09-26: shared React UI kit (`cadbea/ui`) shipped — `CadbeaApp`,
  `ThemeProvider`/`ThemeToggle`/`registerTheme()`, `ReviewPanel`, `Topbar`,
  `StatesToolbar`, and shared `Button`/`Panel`/`Pill`/`Field` primitives,
  built on a new `loadModelFile()` engine export (`.glb`/`.gltf`/`.stl`).
  `example/gc-cad` migrated onto it (embedded pattern: `<CadbeaApp
  viewer={viewer}>`); new `example/file-viewer` proves the turnkey,
  zero-project-code pattern (`mountCadbeaApp()`). This is the React/Vite
  review shell PROJECT_VISION.md named as planned work, scoped to what the
  duplicated per-consumer chrome actually needed rather than the full
  long-term framework.
- 2026-10-04: viewer persists the active named state (`exploded`/`section`)
  across refreshes, the same way it already persisted the camera
  (`stateStorageKey`, mirroring `cameraStorageKey`) — fixes review state
  being silently wiped by Vite's own full-page reload after a source edit.
- 2026-10-04: the review bridge's Vite plugin is now a real package export
  (`cadbea/bridge/vite-plugin`) with a standalone bin (`cadbea-bridge`),
  instead of only being reachable via a relative path into `cadbea`'s source
  tree — `example/gc-cad` now imports it the same way an external consumer
  would. New `cadbea-init` bin scaffolds a review project (turnkey app in a
  clean folder, or just the dependency/config/docs into an existing one) and
  writes an agent-agnostic `AGENTS.md` section (plain shell/curl
  instructions) instead of a tool-specific skill file — see README
  "Scaffolding a new project". Packaged agent skills was the one
  PROJECT_VISION.md roadmap item still fully open; this is the first cut of
  it, intentionally agent-agnostic rather than tied to one coding tool.

## Validation

From the repository root:

```sh
npm.cmd run example:typecheck
npm.cmd run example:build
npm.cmd run example:test
```

All three passed at the time of this handoff. The development page is
`http://127.0.0.1:5174/`.

The latest validation after the button and USB revisions passed:

```sh
npm.cmd run example:typecheck
npm.cmd run example:build
npm.cmd run example:test
```

## Resume Notes

- Refresh the example after restarting Vite; linked `cadbea` source can remain
  stale in Vite's optimized dependency cache.
- A project using `cadbea/ui` needs the extra `optimizeDeps.include`
  (`react-dom/client`, `three`) and `optimizeDeps.exclude` (`cadbea`) entries
  documented in the README — without them, either `createRoot` fails at
  runtime or you get a duplicate Three.js instance. Both were hit for real
  migrating `example/gc-cad`, not precautionary.
- The bridge runs with `npm.cmd run bridge` on `http://127.0.0.1:8787`; use
  `?reviewWebhook=http%3A%2F%2F127.0.0.1%3A8787%2Freview` on the example URL.
- Browser reviews arrive as `annotation-added` events with focused-area
  snapshots. A connected AI adapter should consume `/events/stream`; the chat
  session itself cannot be automatically awakened by browser events.
- Physically inspect the latest USB cutout and button changes. Fit, switch
  height, connector dimensions, wall relief, and print tolerances remain to be
  confirmed with another print.
- Bambu Studio may require assigning transparent PETG in Prepare via
  `Change Filament` before slicing; the generated STL does not require PLA.
- Continue with parameter controls, sketch/image feedback, persistent review
  storage, worker-based Replicad builds, and reusable parametric hardware.
- Existing work is uncommitted; preserve the current working tree when resuming.
- The latest shoulder/lid and lane-swap changes are code-validated but still
  require another physical print. Verify board insertion, lid engagement,
  button actuation, and battery/antenna orientation before treating them as
  final.
