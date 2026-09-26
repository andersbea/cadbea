# Parts & Feature Registry — Node Enclosure

> Imported upstream registry, including historical issues. Some entries predate
> the current three-lane model; see [known baseline limitations](README.md#known-baseline-limitations).
> The upstream `.claude` skill mentioned below is not bundled in this example.

Canonical names for every named solid, cavity, and feature in the replicad
model. This is the shared vocabulary between you and Claude: refer to a part
by the name in this table and it maps unambiguously to a function/variable in
`replicad/src/model/enclosure.ts` and a color in the viewer.

Update this file in the same change that adds, renames, or removes a named
feature in the model. See `.claude/skills/cad-modeling/SKILL.md` for the
process this supports.

## Naming rules

- Names are `kebab-case`, physical-noun-first (`display-window`, not
  `window-display` or `winCutout`).
- A cavity/cutout that is *removed* from a solid is named for the opening it
  leaves, not the tool geometry (`usb-slot`, not `usb-cut-box`).
- Reference-only geometry (not printed, shown for clearance-checking) is
  suffixed `-ref`.
- Code identifiers should echo the registry name in camelCase
  (`board-zone-cavity` → `boardZoneCavity`). If code drifts from this table,
  fix the drift before adding new features.

## Top-level assembly

| Name | Code symbol | Status | Description |
|---|---|---|---|
| `body` | `buildBody()` | modeled | Lower shell with a full-size lower footprint and recessed upper shoulder |
| `lid` | `buildLid()` | modeled | Flush-footprint upper cover with an inner skirt that grabs the recessed body shoulder |
| `lid-button-prg` / `lid-button-rst` | `buildButtons()` | modeled | Separately-printed flanged plugs that slot into recessed underside pockets |
| `enclosure` | `buildEnclosure()` | modeled | `{ body, lid, prgButton, rstButton, boardRef, battRef, antRef }` |

## Body features (`buildBody`)

| Name | Code symbol | Color (viewer) | Status | Description |
|---|---|---|---|---|
| `body-shell` | `outer` | `0x2a6db5` | modeled | Full-size lower shell with a 1mm-per-side recessed upper shoulder |
| `board-zone-cavity` | `boardZoneCavity` | — (cut) | modeled | Full-height opening for the tracker board, central lane |
| `battery-zone-cavity` | `battZoneCavity` | — (cut) | modeled | Full-height opening for the battery, low-Y side |
| `usb-slot` | `usbSlot` | — (cut) | modeled | Front-face (X=0) cutout for the USB-C plug; the lower edge retains a 4mm protective lip above the floor |
| `floor-chamfer` | inline `.chamfer()` | — | modeled | 1mm chamfer on the bottom outer edge (Z=0) |

The guides start at the USB-end corners and leave the rear 13 mm open for
wiring, replacing the historical `cable-passthrough-front` and
`cable-passthrough-back` cutouts.

| Name | Code symbol | Status | Description |
|---|---|---|---|
| `antenna-board-separator-wall` | `antennaBoardWall` | modeled | USB-corner side guide, 0.25 mm from PCB edge, 3.5 mm above floor |
| `board-battery-separator-wall` | `boardBattWall` | modeled | Matching side guide at the opposite PCB edge |
| `antenna-board-corner-stop` | `antennaCornerStop` | modeled | 3.5 mm return across the USB-end PCB corner |
| `battery-board-corner-stop` | `batteryCornerStop` | modeled | Matching USB-end corner return |

## Lid features (`buildLid`)

| Name | Code symbol | Color (viewer) | Status | Description |
|---|---|---|---|---|
| `lid-shell` | full `outerProfile` solid | `0x3a8fd5` | modeled | Cover matching the body's full outer footprint |
| `lid-skirt` | lower region of the same solid | `0x3a8fd5` (same solid) | modeled | Inner rounded skirt clears and grabs the recessed body shoulder (`ENC.bodyTopInset`, `FIT.skirtClear`) |
| `display-window` | `displayWindow` | — (cut) | modeled | Cutout over the tracker's display, positioned from `DISPLAY.*` |
| `usb-lid-opening` | `usbLidOpening` | — (cut) | modeled | Bounded front-skirt cutout aligned with the 4.5mm USB-C access band, keeping the connector accessible while retaining the lid above it |
| `lid-top-chamfer` | inline `.chamfer()` | — | modeled | 1mm chamfer on the top outer edge |
| `button-hole-prg` | `btn1` | — (cut) | modeled | Hole radius `BUTTON.holeR`, near-edge corner (matches board's PRG button) — plugged by `lid-button-prg` |
| `button-hole-rst` | `btn2` | — (cut) | modeled | Hole radius `BUTTON.holeR`, far-edge corner (matches board's RST button) — plugged by `lid-button-rst` |
| `button-flange-pocket-prg` / `button-flange-pocket-rst` | `buttonPocket` | — (cut) | modeled | Underside counterbores that recess and capture the printed button flanges above the board |

## Reference-only geometry (visualization, not printed)

| Name | Code symbol | Color (viewer) | Description |
|---|---|---|---|
| `board-ref` | `boardOutline()` | `0x44bb66` (green) | Tracker board bounding box, for clearance checking |
| `battery-ref` | `batteryOutline()` | `0xffaa22` (orange) | Battery bounding box, for clearance checking |
| `antenna-ref` | `antennaOutline()` | `0xff4444` (red) | Wire antenna, illustrative only. Centered in whatever headroom remains above the battery — currently very tight (~0.9mm), see HARDWARE.md interference risk note. |

## Planned / not yet modeled

Tracked here so a name exists before the feature is built (see skill step 2).

| Name | Referenced in | Status | Notes |
|---|---|---|---|
| `gasket-groove` | `HARDWARE.md` Enclosure Design Parameters | planned | 1.5mm × 1.0mm groove at the body/lid split for TPU o-cord seal (IP54 target) — not yet cut into `body-shell`/`lid-skirt` |
| `sma-passthrough` | `HARDWARE.md` Enclosure Design Parameters | deferred (v2) | 7mm hole for SMA bulkhead nut — v0.1 keeps the antenna loose inside `battery-zone-cavity` per `antenna-ref` |
| `screw-boss` | — | undecided | Possible stronger alternative/supplement to `lid-skirt` friction fit |

## Known issues

| Issue | Where | Status | Notes |
|---|---|---|---|
| Dark corner artifact | `lid` corner, previously at the wide skirt base to narrow main slab transition, visible close-up from near-top angles (`corner-tl`/`corner-tr`/`corner-bl`/`corner-br`) | **RETEST after lip-sized lid change** | The former stepped transition has been removed in response to the second print's defect. Recheck corner captures and a physical print; watertightness alone does not rule out degenerate faces or slicer problems. |
| Mesh tessellation was very coarse | `replicad/src/main.ts` `.mesh()` calls | fixed | `angularTolerance: 30` was almost certainly being read as **radians** (OCCT's native unit), not degrees — 30 rad is a nearly-flat tolerance, producing visibly faceted curves (hexagonal button holes, chunky fillets) in every capture. Changed to `angularTolerance: 0.2` (~11°). Keep tolerance values in radians in mind for any new `.mesh()` call. |

## Viewer camera views and states

Capture tooling lives in [`cadbea`](../../..) (a standalone, model-agnostic
package — see its README for the `window.__cadbeaViewer` contract), driven
here via `replicad/cadbea.config.mjs`. Two kinds of view:

**Standard views** — 8 fixed names (`iso`, `iso-back`, `front`, `back`,
`left`, `right`, `top`, `bottom`), camera position derived live from the
model's own bounding box. These are axis-aligned, not physical — "front"
just means "camera at +world-Z", whatever that happens to line up with for a
given model. For *this* model, confirmed by capturing each and looking:

| Standard view | Physical face it shows |
|---|---|
| `left` | `usb-slot` face (model X=0) — the physical "front" of the enclosure |
| `right` | Opposite face (model X=`LAYOUT.outL`) — the blank back |
| `front` | Model Y=0 side — the board-zone side profile |
| `back` | Model Y=`LAYOUT.outW` side — the battery-zone side profile |
| `top` | `lid-shell` from above — `display-window` and button hole placement |
| `bottom` | `body-shell` from below — should stay featureless (no mounting bosses yet) |
| `iso` / `iso-back` | Whole assembly, angled from opposite corners |

If this mapping ever looks wrong after a model change (e.g. the model's
bounding box or orientation shifted), re-verify by capturing `left`/`right`
and checking which one shows `usb-slot` — don't assume the table above still
holds.

**Corner views** — 4 more fixed names (`corner-tl`, `corner-tr`, `corner-bl`,
`corner-br`), a close elevated shot looking down at each *top* corner of the
bounding box. These exist because the standard views above are framed to the
whole model and are too coarse to show a sub-mm defect at a corner — that's
exactly how the "Dark corner artifact" in Known Issues below was found, and
why the corner views were generalized into `cadbea` afterward instead of
staying a one-off hand-aimed camera in this project's config.

**States** — declared in `main.ts` (`viewer.states = { exploded, section }`)
and auto-discovered by the capture tooling; no per-view config needed to add
one. `exploded` lifts `lid` off `body`; `section` swaps in the `bodySection`/
`lidSection` cutaway (X-cut through `board-zone-cavity` + `battery-zone-cavity`,
confirming wall thickness and `board-ref`/`battery-ref` clearances).

`npm run contact-sheet` (in `replicad/`) generates one overview grid per
state (`default`, `exploded`, `section`) — all 8 standard angles in one
image, the first thing to look at. `npm run contact-sheet -- --corners` does
the same with the 4 corner views instead, for a close-up scan. `npm run
views -- --view=<name> --state=<name>` gets one full-resolution shot once
something looks worth a closer look.
