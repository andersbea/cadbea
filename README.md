# cadbea

## Runnable example

The [GC CAD enclosure](example/gc-cad/README.md) is a real TypeScript/Replicad
consumer and integration fixture. Install root dependencies with `npm ci`, then
run `npm --prefix example/gc-cad/replicad ci` and `npm run example:dev`.
`npm run example:build` builds the viewer and printable parts;
`npm run example:test` runs browser validation (install Chromium first with
`npx playwright install chromium`). See the example README for known model issues.

The example's AI review panel demonstrates the current selection contract:
click a visible named part to highlight it, add a note, and inspect the
serializable `window.__cadbeaViewer.getReviewState()` result.

A small, project-agnostic toolkit for reviewing a parametric CAD model built
with three.js (written for [replicad](https://replicad.xyz/) projects, but
not coupled to replicad specifically — anything that puts meshes into a
three.js scene works). Three pieces:

1. **`src/viewer.js`** — a generic viewer bootstrap (scene, camera, controls,
   lighting) plus bounding-box-derived standard camera views, so you don't
   hand-tune camera coordinates per project.
2. **`capture/`** — a Playwright-based CLI that drives that viewer headlessly
   to produce screenshots and multi-angle "contact sheet" grids, for a human
   or an AI agent to actually look at before calling a model change done.
3. **`capture/check.mjs`** — a deterministic watertightness check on the
   actual tessellated mesh, for catching (or ruling out) a real geometric gap
   without relying on judging it from a picture. See "Deterministic geometry
   checks" below — this exists because a screenshot review session on this
   toolkit's own first project spent a long time chasing what turned out to
   be a rendering artifact, and a longer time before that failing to notice a
   real gap that a translucent material was hiding.

Extracted from `gc-cad/replicad` in the guardianchain-labs project once it
became clear the viewer/capture code had no enclosure-specific logic in it —
the only project-specific things were hand-typed camera coordinates, which
are now derived live from the model's own bounding box instead.

## Why a contact sheet, not just the interactive viewer

An agent reviewing a CAD-by-code change can't drive a live WebGL canvas or
"look" at an orbiting 3D view. It can read a handful of static images. A
single screenshot from one angle is easy to misread — a translucent material
can make an internal feature look like it pokes through a wall when it
doesn't (or hide a real interference the same way). A grid of several angles,
one grid per model state (assembled, exploded, sectioned, whatever the
project defines), is what actually lets an agent — or a person skimming
quickly — catch a real problem instead of an optical illusion. `--view=` /
`--state=` narrow back down to one full-resolution shot once something looks
worth a closer look.

## Deterministic geometry checks

Screenshots — even a full contact sheet — are a judgment call: a translucent
material can make a real gap invisible, or make a fully watertight mesh
*look* like it has a hole (a flat-shaded triangle at the tessellation seam
between two independently-meshed B-Rep faces can render near-black from
some angles even though it's completely connected on both sides — this
toolkit hit exactly that case). Current research on LLM/agent-driven CAD
generation is consistent on the fix: pair visual review with a deterministic,
non-LLM geometric check, rather than trusting a picture (or a language model
looking at a picture) either way — see
[caliper-cad](https://github.com/danielesalpietro/caliper-cad) and
[CADSmith](https://arxiv.org/html/2603.26512) for two current approaches to
staged, programmatic validation of LLM-generated CAD geometry.

`checkGeometry()` (also exposed as `checkWatertight()`) does the CAD-kernel
version of that: it welds near-coincident vertices in each visible mesh's
*already-tessellated* geometry, then checks that every edge is shared by
exactly 2 triangles (closed, manifold) rather than 1 (a real boundary/gap) or
more than 2 (non-manifold). It works on whatever mesh is already in the
scene, so it has no dependency on replicad or any other specific modeler —
useful because most JS-facing CAD kernels (replicad included) don't expose
their native B-Rep validity checker (OpenCascade's `BRepCheck`) to
JavaScript, so this mesh-level check is the practical fallback.

```bash
npm run check                # every declared state; exits non-zero on any real gap
```

Reach for this *before* spending a long time trying to explain a suspicious
screenshot with geometry changes — it settles "is this actually a hole"
immediately, in either direction.

## The `window.__cadbeaViewer` contract

A consuming project's viewer entry point builds this object (via
`createViewer()` from `src/viewer.js`, or by hand if you need something
`createViewer` doesn't provide) and assigns it to `window.__cadbeaViewer` once
the model is loaded and meshed:

```ts
interface CadbeaViewer {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  controls: OrbitControls
  renderer: THREE.WebGLRenderer
  modelGroup: THREE.Group          // every model mesh is added here
  ready: boolean                   // capture.mjs waits for this to become true
  states: Record<string, (on: boolean) => void>   // e.g. { exploded: fn, section: fn }
  render(): void                   // force a render (used before each screenshot)
  setView(view: StandardView | CornerView): void  // camera placement, derived from modelGroup's current visible bounding box
  setState(name: string | null): void  // turns `name` on and every other declared state off; null clears all
  checkGeometry(options?: { tolerance?: number }): CheckResult[]  // watertightness, see "Deterministic geometry checks"
  selection: Selection | null
  annotations: Annotation[]
  printFiles: PrintFile[]
  selectionMode: 'part' | 'area'
  selectPart(partId: string): Selection
  selectArea(rect: { x: number, y: number, width: number, height: number }): Selection
  setSelectionMode(mode: 'part' | 'area'): 'part' | 'area'
  clearSelection(): void
  onSelectionChange(listener: (selection: Selection | null) => void): () => void
  addAnnotation(note: string): Annotation
  removeAnnotation(id: string): void
  clearAnnotations(): void
  getReviewState(): ReviewState
}

interface Selection {
  kind: 'part'
  partId: string
  name: string
  point?: [number, number, number]  // world-space mesh hit point when clicked
  normal?: [number, number, number]
  faceIndex?: number
}

interface AreaSelection {
  kind: 'area'
  rect: { x: number, y: number, width: number, height: number } // normalized to the canvas, origin top-left
  screen: { width: number, height: number }
  camera: { position: number[], target: number[] }
  snapshot: { dataUrl: string, width: number, height: number, crop: { x: number, y: number, width: number, height: number } }
}

interface PrintFile { label: string; url: string; fileName?: string }
interface PrintBundle { label: string; url: string; fileName?: string }

interface Annotation {
  id: string
  note: string
  selection: Selection | null
  camera: { position: [number, number, number], target: [number, number, number] }
  state: string | null
  createdAt: string
}

interface ReviewState {
  selection: Selection | null
  annotations: Annotation[]
  camera: { position: number[], target: number[] }
  state: string | null
  selectionMode: 'part' | 'area'
}

interface CheckResult {
  name: string             // from addThreeGeometry(..., name) — "(unnamed)" if you didn't pass one
  triangleCount: number
  boundaryEdges: number     // > 0 means a real gap
  nonManifoldEdges: number  // > 0 means non-manifold geometry (an edge shared by 3+ triangles)
  watertight: boolean       // boundaryEdges === 0 && nonManifoldEdges === 0
}
```

`createViewer(canvas, options?)` returns everything except `ready` (start it
`false`, flip to `true` once your model is built and meshed) and `states`
(start as `{}`, assign your own toggle functions — see below).

Meshes added through `addThreeGeometry(..., name)` are selectable by that name.
The viewer highlights clicked parts and exposes a serializable review state for
an AI tool or persistence layer. `addAnnotation()` captures the current part,
camera, state, and note. The generic viewer keeps annotations in memory; a
consumer owns persistence and any user-facing annotation UI. Review changes
also emit structured `[cadbea]` browser-console events and an
`cadbea-review` `CustomEvent`. Pass `reviewWebhook: '/__cadbea/review'` to POST
the same event to a consumer-owned endpoint. An agent connected through
Playwright can listen with `page.on('console', ...)` and parse the JSON after
the prefix.

When a webhook is configured, the viewer can monitor its bridge with
`getBridgeStatus()`, `checkBridge()`, and `onBridgeStatusChange()`. Set
`bridgeHealthUrl` explicitly when the webhook is not a standard `/review`
endpoint; otherwise the viewer derives `/health` from the webhook URL. Status
polling defaults to every five seconds and reports `connected`, `disconnected`,
`checking`, or `disabled`.

The bundled bridge also exposes `GET /events/stream` as a Server-Sent Events
feed for AI adapters that should react immediately to new browser reviews;
`GET /events` remains available for history and recovery after reconnects.

The gc-cad example starts the bridge automatically with `npm run example:dev`
and connects to `http://127.0.0.1:8787/review` by default. A healthy existing
bridge is reused. Override the endpoint with `?reviewWebhook=…`.
When started from Codex, the bridge uses `CODEX_THREAD_ID` to queue new comments
in that conversation with `codex queue`. Set `CADBEA_CODEX_THREAD` to target a
specific conversation when starting from another terminal. The Codex CLI must
be installed and able to access its local session. `CADBEA_CODEX_CLI` can specify
the CLI's JavaScript entry point. `/health` reports the target conversation;
notification failures are logged and comments remain in the event history.
Restart the bridge to change the target conversation. With a custom
`CADBEA_BRIDGE_PORT`, also pass the matching `reviewWebhook` URL to the viewer.

Set `printBundle` in `createViewer()` to let the library render one download-all
button with `viewer.renderPrintFiles(container)`. A `printFiles` array remains
available as a fallback when a consumer has no bundle endpoint. The viewer does
not assume a part naming scheme or hardcode a model's exports. Use
`setSelectionMode('area')` for drag selection; this temporarily disables orbit
controls. Area selections are visual focus regions, not part selections: review
state and webhook events contain the normalized rectangle, viewport size, and
camera plus a PNG data URL and pixel crop so an AI can inspect exactly what the
user marked. Pass `includeReviewSnapshots: false` when a consumer already owns
its screenshot pipeline and wants smaller events.

The viewer persists the last camera position, orbit target, and zoom in
`localStorage`, so a refresh after an AI model adjustment keeps the user's
view. Override the key with `cameraStorageKey`, or pass `false` to disable
persistence.

### Standard views

`STANDARD_VIEWS = ['iso', 'iso-back', 'front', 'back', 'left', 'right', 'top', 'bottom']`

Each is a camera placement along a world-space axis, computed from
`visibleBoundingBox(modelGroup)` — the bounding box of only the currently
*visible* meshes, so a hidden state's geometry (e.g. a section-cut mesh you
keep in the scene but toggle off) doesn't skew the framing. These are
deliberately axis-aligned and physically meaningless: your model's actual
"front" face might land on `left` depending on how you built/rotated it.
That's fine — they're for scanning multiple angles quickly, not for a view
tied to one physical feature. If you need the latter, add it as a project
`extraView` (below) with a hand-picked camera position.

### Corner views

`CORNER_VIEWS = ['corner-tl', 'corner-tr', 'corner-bl', 'corner-br']`

A close, elevated shot looking down at each *top* corner of the bounding
box — distance scales with the box's own horizontal size, so it stays a
genuine close-up regardless of model size. These exist because a standard
view is framed to the whole model and is too coarse to show a small defect
(a gap, a bad fillet/chamfer/fuse interaction) right at a corner — this
toolkit's own first real project spent a long debugging session on exactly
that before someone looked at a hand-aimed close-up camera and found it in
seconds. Same contract as standard views (`setView('corner-tl')`,
`cadbea-capture --view=corner-tl`, `cadbea-contact-sheet --corners` for all
four in one grid).

### States

Anything your model can toggle (exploded, sectioned, a lid open/closed, an
alternate configuration) — register it as a named function in `states` that
takes `on: boolean`. The contact-sheet tool discovers your states via
`Object.keys(viewer.states)` and generates one grid per state (turned on,
every other state off) plus a `default` grid with everything off. You don't
tell the toolkit what your states are named or how many there are.

```js
viewer.states = {
  exploded: (on) => { /* animate/move parts */ },
  section: (on) => { /* swap in a pre-built section-cut mesh */ },
}
```

## Project setup

```js
// main.js / main.ts, after building your model:
import { createViewer, addThreeGeometry } from 'cadbea'

const viewer = createViewer(canvas)
// If your modeler's up-axis isn't three.js's Y-up (e.g. replicad is Z-up),
// rotate modelGroup yourself before/after adding meshes — the toolkit is
// convention-agnostic and just measures whatever's actually in the scene:
viewer.modelGroup.rotation.x = -Math.PI / 2

// ... build your model — name each part so a checkGeometry() failure is
// actionable instead of an anonymous index:
addThreeGeometry(viewer.modelGroup, bodyGeo, 0x2a6db5, 0.92, 'body')

viewer.states = { exploded: setExploded, section: setSection }
viewer.setView('iso')     // a sane initial camera, instead of hand-picked numbers
viewer.ready = true
window.__cadbeaViewer = viewer
```

Add `cadbea` as a dependency (this repo isn't published — use a `file:`
reference to wherever you cloned/placed it):

```json
{
  "dependencies": { "cadbea": "file:../../cadbea" },
  "peerDependencies": { "three": ">=0.160.0" }
}
```

**If you're on Vite**, also add this — without it you will very likely load
*two* three.js instances (one from your project, one from `cadbea`'s own
resolution as a symlinked package), which breaks anything that does
`instanceof THREE.X` across the boundary (e.g. `BufferGeometryUtils`
functions silently no-op on a geometry your project created). Watch dev-tools
console for "Multiple instances of Three.js being imported" — if you see it,
this is why:

```ts
// vite.config.ts
export default defineConfig({
  resolve: { preserveSymlinks: true },
})
```

Also don't install a physical copy of `three` inside `cadbea`'s own
`node_modules` (delete it if `npm install` puts one there to satisfy the
peerDependency) — a local copy there is resolved *before* your project's,
recreating the same duplicate-instance problem `preserveSymlinks` is meant to
avoid.

**Vite will not live-reload edits to `cadbea`'s own source** the way it
reloads your project's `src/` — a `file:`-linked package outside your
project root isn't watched the same way. If you edit `cadbea` and a change
doesn't seem to take effect, check for a `page reload …cadbea/src/…` line in
the dev server's terminal output; if there isn't one, kill the dev server,
delete `node_modules/.vite`, and restart it before concluding the change had
no effect. (This cost real time in this project's history — see
`gc-cad/PARTS.md`'s "Known issues" table for the investigation it derailed.)

Then create `cadbea.config.mjs` in your project (wherever you'll run the
capture commands from — typically next to your `package.json`):

```js
export default {
  url: 'http://localhost:5173',       // your dev server
  outDir: './screenshots/latest',     // overwritten on every run
  title: 'My Enclosure',              // optional, used as the contact-sheet banner
  contactViews: ['iso', 'top', 'front', 'left'],  // optional, defaults to all 8 standard views
  extraViews: [                        // optional, project-specific camera shots
    { name: 'usb-face', camera: [-120, 15, -27], target: [29, 9, -27] },
    { name: 'my-section', camera: [50, 60, 40], target: [29, 9, -27], state: 'section' },
  ],
}
```

And wire up npm scripts pointing at wherever you placed this toolkit:

```json
{
  "scripts": {
    "views": "node ../../cadbea/capture/capture.mjs",
    "contact-sheet": "node ../../cadbea/capture/contact-sheet.mjs",
    "check": "node ../../cadbea/capture/check.mjs"
  }
}
```

## Usage

Requires your project's dev server already running.

```bash
npm run check                          # deterministic watertightness check, every declared state

npm run views                          # every standard + corner + extra view, full resolution
npm run views -- --view=iso,corner-tl  # a subset
npm run views -- --state=exploded      # apply a declared state to the standard/corner views

npm run contact-sheet                  # one overview grid per state (all 8 standard views)
npm run contact-sheet -- --corners     # one close-up grid per state (all 4 corner views)
npm run contact-sheet -- --view=iso,top,left,right   # override the angle set explicitly
```

## Known limitations

- `visibleBoundingBox` checks each mesh's own `.visible` flag, not full
  scene-graph visibility inheritance. Fine for the flat "everything is a
  direct child of `modelGroup`" structure this was built for; if you nest
  groups with their own visibility toggles, extend it.
- Contact-sheet cells are downscaled (640×411 by default) for a compact grid
  — always confirm anything suspicious with a full-resolution `capture.mjs`
  shot before concluding there's a real problem.
- No TypeScript build step yet (plain JS + JSDoc). Fine for a Vite consumer
  that processes source directly; revisit if this needs to ship compiled.
- `checkGeometry`'s default weld tolerance (1e-4, in your model's units) is a
  reasonable default for millimeter-scale parts but is not derived from
  anything — pass `{ tolerance }` if your model's scale or precision needs
  differ.
- `checkGeometry` checks the mesh already in the scene, at whatever
  `tolerance`/`angularTolerance` your project meshed it with — it can't
  catch a gap smaller than that tessellation's own resolution. It also only
  proves the *tessellated* mesh is watertight, not the underlying B-Rep
  (though the two should agree in practice; a B-Rep with a genuine gap
  should tessellate into a mesh with matching boundary edges).

## License

MIT — see [LICENSE](LICENSE).
