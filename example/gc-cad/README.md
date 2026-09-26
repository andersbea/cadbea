# GC CAD Enclosure Example

A working copy of the Guardian Chain enclosure project for the Heltec Wireless
Tracker V2, EEMB 852040 battery, and wire antenna. It demonstrates a TypeScript
Replicad consumer of `cadbea` and provides a real model for integration testing.
This is an unfinished design, not a validated manufacturing release.

## Run

From the `cadbea` repository root (Node.js 22 or newer recommended):

```sh
npm ci
npm --prefix example/gc-cad/replicad ci
npx playwright install chromium
npm run example:dev
```

Open http://127.0.0.1:5173. The server deliberately fails if that port is occupied,
so the capture tools cannot accidentally inspect another application.
On Windows PowerShell with restricted script execution, use `npm.cmd` and
`npx.cmd` instead of `npm` and `npx`.

## Build and Validate

From the repository root:

```sh
npm run example:typecheck
npm run example:build
npm run example:test
```

The build produces the viewer in `replicad/dist/`, four binary STLs, and one
`node-wireless-tracker-v2-print-files.zip` bundle in `replicad/dist/print/`.
Reference hardware and section-view solids are excluded from printable exports.

When the development page is running, the review panel exposes a download button
single download-all button so the complete model can be sent to a slicer or
3D-print workflow.

The browser integration test starts and stops its own Vite server and Chromium,
checks the public viewer contract in default/exploded/section states, verifies
visible mesh names and watertightness, checks all twelve cameras, and exercises
interactive state resets. It writes contact sheets and a JSON report under
`screenshots/validation/`. Failure exits nonzero; existing geometry failures
are not silently waived.

With the development server already running:

```sh
cd example/gc-cad/replicad
npm run check
npm run contact-sheet
npm run contact-sheet -- --corners --out=../screenshots/corners
npm run views -- --view=left,corner-tl --state=exploded
```

Review screenshots alongside numerical checks. A passing edge-adjacency check
does not establish correct fit, absence of degenerate geometry, or print quality.
Generated builds, STLs, and screenshots are ignored by Git.

The Vite config forces re-optimization of the linked `cadbea` package. Restart
the dev server after changing library source. The integration test uses a
separate cache directory so it exercises the current checkout instead of a
stale optimized dependency.

## Files and Parameters

- `replicad/src/model/enclosure.ts`: body, lid, buttons, reference shapes, assembly.
- `replicad/src/model/hardware.ts`: fixed hardware dimensions, design values,
  and derived layout. Keep it synchronized with [HARDWARE.md](HARDWARE.md).
- `replicad/src/main.ts`: viewer adapter, mesh names, exploded and section states.
- `replicad/cadbea.config.mjs`: capture URL and output paths.
- [PARTS.md](PARTS.md): inherited feature registry and unresolved model issues.
- [UPSTREAM.json](UPSTREAM.json): original source revision and file fingerprints.

Units are millimeters. Replicad uses Z-up; the adapter rotates the model into
the viewer's Y-up scene. The model is currently parameterized through source
constants, without live parameter controls. React, annotations, worker builds,
part folders, and reusable typed model contracts are future integration steps.

The review panel is the first implemented feedback loop. Click a visible mesh
to select and highlight it, write a note, and press **Mark for AI**. The page
stores the selected part ID, model-space hit point when the selection came from
the canvas, camera, state, and timestamp in `window.__cadbeaViewer` review state.
The current page keeps annotations in memory; persistence and sketch uploads
are planned extensions. Review events are also logged with the `[cadbea]`
prefix, which an AI browser harness can capture, and the library accepts an
optional `reviewWebhook` for a consumer-owned POST endpoint.

The review panel also shows the bridge connection state. When the webhook URL
ends in `/review`, the viewer automatically checks the matching `/health`
endpoint every five seconds. Use `?bridgeHealthUrl=...` when the bridge uses a
different health URL. An AI-side integration can consume new reviews without
polling through the bridge's Server-Sent Events endpoint:
`GET http://127.0.0.1:8787/events/stream`.

For the included local bridge, run `npm run bridge` from the repository root,
then open the page with
`?reviewWebhook=http://127.0.0.1:8787/review`. It receives JSON events for
state changes, selections, and annotations, persists them in
`bridge/.data/review-events.jsonl`, and exposes them at `GET /events`. The page
also logs each event with the `[cadbea]` prefix for browser automation.

## Provenance and Import Boundaries

Imported from `C:/dev/guardianchain-labs/gc-cad` at base commit
`5d94c150877da0ee00ff26275144afb8965ad0c2`, including the uncommitted hardware and
model changes listed in `UPSTREAM.json`. Its hashes describe the original files
before local integration edits, not the resulting example files. The original
project is not modified or automatically synchronized.

Geometry construction and hardware constants are retained. Local adaptations
change dependency paths, pin Replicad versions from the original lockfile,
add validation, and correct section-edge visibility and animation cancellation.
The example consumes `cadbea` through `file:../../..` and its installed CLI bins.

The original `.git`, installed dependencies, generated files, and `.claude`
configuration are omitted. The vendor `Tracker-V2.3.1.step` reference is also
omitted: the runnable model uses a simplified board box and does not load it.
Keep its upstream provenance and check its redistribution terms before adding
it as a packaged asset. The local source contains no license file; this import
does not assign a new license to its contents.

## Known Baseline Limitations

- The lid-corner defect remains open in the inherited notes, including a
  reported physical-print defect. It is not fixed by importing the example.
- The historical documents lag the latest code in places. In particular, the
  USB notch is now a cutout into a plain 58 x 63.5 mm body footprint, not an
  outward extension; the antenna occupies its own lane; and half-length
  separators replace the older cable-passthrough slots. Reconcile the registry
  before implementing further model changes.
- Button reach still needs a physical measurement. Fit, sealing, RF behavior,
  and manufacturing claims in the inherited notes are not certified by these tests.
- The kernel currently builds on the browser main thread. The local
  `src/cadbea.d.ts` bridges the library's JavaScript API until library-owned
  declarations are implemented.
