# ai-cad

A small, project-agnostic toolkit for reviewing a parametric CAD model built
with three.js (written for [replicad](https://replicad.xyz/) projects, but
not coupled to replicad specifically — anything that puts meshes into a
three.js scene works). Two pieces:

1. **`src/viewer.js`** — a generic viewer bootstrap (scene, camera, controls,
   lighting) plus bounding-box-derived standard camera views, so you don't
   hand-tune camera coordinates per project.
2. **`capture/`** — a Playwright-based CLI that drives that viewer headlessly
   to produce screenshots and multi-angle "contact sheet" grids, for a human
   or an AI agent to actually look at before calling a model change done.

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

## The `window.__aiCadViewer` contract

A consuming project's viewer entry point builds this object (via
`createViewer()` from `src/viewer.js`, or by hand if you need something
`createViewer` doesn't provide) and assigns it to `window.__aiCadViewer` once
the model is loaded and meshed:

```ts
interface AiCadViewer {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  controls: OrbitControls
  renderer: THREE.WebGLRenderer
  modelGroup: THREE.Group          // every model mesh is added here
  ready: boolean                   // capture.mjs waits for this to become true
  states: Record<string, (on: boolean) => void>   // e.g. { exploded: fn, section: fn }
  render(): void                   // force a render (used before each screenshot)
  setView(view: StandardView): void  // camera placement, derived from modelGroup's current visible bounding box
  setState(name: string | null): void  // turns `name` on and every other declared state off; null clears all
}
```

`createViewer(canvas, options?)` returns everything except `ready` (start it
`false`, flip to `true` once your model is built and meshed) and `states`
(start as `{}`, assign your own toggle functions — see below).

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
import { createViewer, addThreeGeometry } from 'ai-cad'

const viewer = createViewer(canvas)
// If your modeler's up-axis isn't three.js's Y-up (e.g. replicad is Z-up),
// rotate modelGroup yourself before/after adding meshes — the toolkit is
// convention-agnostic and just measures whatever's actually in the scene:
viewer.modelGroup.rotation.x = -Math.PI / 2

// ... build your model, addThreeGeometry(viewer.modelGroup, ...) for each part ...

viewer.states = { exploded: setExploded, section: setSection }
viewer.setView('iso')     // a sane initial camera, instead of hand-picked numbers
viewer.ready = true
window.__aiCadViewer = viewer
```

Add `ai-cad` as a dependency (this repo isn't published — use a `file:`
reference to wherever you cloned/placed it):

```json
{
  "dependencies": { "ai-cad": "file:../../ai-cad" },
  "peerDependencies": { "three": ">=0.160.0" }
}
```

Then create `ai-cad.config.mjs` in your project (wherever you'll run the
capture commands from — typically next to your `package.json`):

```js
export default {
  url: 'http://localhost:5173',       // your dev server
  outDir: './screenshots/latest',     // overwritten on every run
  title: 'My Enclosure',              // optional, used as the contact-sheet banner
  contactViews: ['iso', 'top', 'front', 'left'],  // optional, defaults to iso/iso-back/top/front
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
    "views": "node ../../ai-cad/capture/capture.mjs",
    "contact-sheet": "node ../../ai-cad/capture/contact-sheet.mjs"
  }
}
```

## Usage

Requires your project's dev server already running.

```bash
npm run views                          # every standard + extra view, full resolution
npm run views -- --view=iso,section    # a subset
npm run views -- --state=exploded      # apply a declared state to the standard views

npm run contact-sheet                  # one grid per state: default, exploded, section, …
npm run contact-sheet -- --view=iso,top,left,right   # override the angle set for the grids
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
