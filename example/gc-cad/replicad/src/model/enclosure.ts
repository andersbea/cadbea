import { makeBox, makeCylinder, compoundShapes, drawRectangle, drawRoundedRectangle, type Solid } from 'replicad'
import { BOARD, BATTERY, DISPLAY, ENC, FIT, LAYOUT, BUTTON, ANTENNA, USB_C, SEPARATOR } from './hardware'

const W = ENC.wall
const { outL: OL, outW: OW, lidSplitZ: SPLIT } = LAYOUT

// USB-C connector centre — the board's connector is centred on the board's
// own width, so this is centred on the board zone, not the whole enclosure.
const USB_CENTRE_Y = LAYOUT.boardY0 + ENC.boardClearance + BOARD.width / 2
const USB_NOTCH_Y1 = USB_CENTRE_Y - LAYOUT.notchWidth / 2
const USB_NOTCH_Y2 = USB_CENTRE_Y + LAYOUT.notchWidth / 2
const USB_OPENING_BOTTOM_Z = W + USB_C.protectiveLipH
const USB_OPENING_TOP_Z = USB_OPENING_BOTTOM_Z + USB_C.slotH

// PCB, display and buttons all move together to clear the magnetic adapter
// and battery connector at the USB end.
const BOARD_FRONT_X = ENC.boardClearanceFront + ENC.magneticAdapterExtra

// Button hole positions — shared between the lid's holes (buildLid) and the
// separate printed button plugs (buildButtons) so they can never drift apart.
const BTN_X = BOARD_FRONT_X + 3
const BTN1_Y = LAYOUT.boardY0 + ENC.boardClearance + 2
const BTN2_Y = LAYOUT.boardY0 + ENC.boardClearance + BOARD.width - 2

// ── Body ─────────────────────────────────────────────────────────────────────

export function buildBody() {
  const bodyH = SPLIT
  // usb-slot — a CUTOUT into the front wall, not a protrusion out of the
  // box. The exterior stays a plain rectangle (no bump); only the interior
  // cavity extends locally, across just the connector's width + margin
  // (notchWidth) above the retained protective lip. The 4mm lip keeps the
  // board edge protected instead of leaving an opening from the floor up;
  // the USB plug still has its opening above the lip. The outer vertical-corner
  // fillet and floor chamfer are applied at the very end, on the otherwise-
  // finished solid, per this project's "chamfer/fillet last" rule (see
  // PARTS.md Known Issues).
  const rectProfile = (x1: number, y1: number, x2: number, y2: number) =>
    drawRectangle(x2 - x1, y2 - y1).translate((x1 + x2) / 2, (y1 + y2) / 2)

  // Keep the lower body at the finished footprint, then recess the upper
  // shoulder so a same-footprint lid can sit flush with the lower walls and
  // still retain the shoulder underneath its skirt.
  const bodyStepZ = SPLIT - FIT.skirtH
  const lowerOuterProfile = drawRoundedRectangle(OL, OW, ENC.cornerR).translate(OL / 2, OW / 2)
  const upperOuterL = OL - ENC.bodyTopInset * 2
  const upperOuterW = OW - ENC.bodyTopInset * 2
  const upperOuterProfile = drawRoundedRectangle(
    upperOuterL,
    upperOuterW,
    Math.max(ENC.cornerR - ENC.bodyTopInset, 0.5),
  ).translate(OL / 2, OW / 2)
  const sharpOuter = lowerOuterProfile.sketchOnPlane('XY', 0).extrude(bodyStepZ) as Solid
  const upperOuter = upperOuterProfile.sketchOnPlane('XY', bodyStepZ).extrude(bodyH - bodyStepZ) as Solid
  const steppedOuter = sharpOuter.fuse(upperOuter)

  // interior-cavity — ONE full-height opening spanning all three lanes
  // (battery, board, antenna), unioned with the notch cutout into a single
  // 2D profile before extruding, rather than two separate box cuts.
  //
  // cavityNotchMargin: the notch region is inset 0.3mm from notchY1/notchY2
  // (not flush with them) so its corners don't land exactly on cavityMain's
  // own corners at Y=W/OW-W where those happen to coincide in X too — found
  // via scripts/debug-watertight.mjs when an earlier version of this notch
  // (built as an exterior bump) put two independently-computed corners at
  // the exact same point and produced 2 real non-manifold edges (4
  // triangles sharing one edge) right there — same "independently-computed
  // but exactly coincident geometry" failure class as the lid's
  // corner-artifact saga (see PARTS.md Known Issues). Kept defensively here
  // even without the bump, since the underlying cause (near-exact geometry
  // from two different constructions meeting at a boolean) still applies to
  // any two independently-built profiles fused together. The cost is a
  // negligible ~0.3mm reduction in the notch's clear opening at its very
  // top/bottom corners.
  const cavityMain = rectProfile(W, W, OL - W, OW - W)
  // Match the lid opening exactly. A previous base-only 0.3mm margin made
  // the lid cutout wider and left a visible step/gap when assembled.
  const cavityNotch = rectProfile(0, USB_NOTCH_Y1, OL - W, USB_NOTCH_Y2)
  const cavityMainSolid = cavityMain.sketchOnPlane('XY', W).extrude(bodyH + 1 - W) as Solid
  const cavityNotchSolid = cavityNotch
    .sketchOnPlane('XY', USB_OPENING_BOTTOM_Z)
    .extrude(bodyH + 1 - USB_OPENING_BOTTOM_Z) as Solid

  // Side guides reach the USB-end board corners. Short inward returns there
  // prevent longitudinal play while the opposite PCB edge rests near the rear
  // inner wall. The 13 mm rear opening still provides a cable route.
  // Embed their bases in the floor for a sound fuse.
  const wallLen = BOARD.length / 2
  const wallX0 = BOARD_FRONT_X - SEPARATOR.boardClearance - ENC.sideGap
  const wallX1 = BOARD_FRONT_X + BOARD.length - (BOARD.length - wallLen) / 2
  const floorOverlap = 0.3
  // Locate both guides from the actual PCB edges, rather than centering the
  // antenna-side guide in the cable gap. Stop at PCB height so button flanges
  // can move above continuous guides without full-depth relief cutouts.
  const boardNearY = LAYOUT.boardY0 + ENC.boardClearance
  const boardFarY = boardNearY + BOARD.width
  const wallTopZ = W + SEPARATOR.height
  const boardAntennaWallY = boardFarY + SEPARATOR.boardClearance
  const antennaBoardWall = makeBox(
    [wallX0, boardAntennaWallY, W - floorOverlap],
    [wallX1, boardAntennaWallY + ENC.sideGap, wallTopZ],
  )
  const boardBatteryWallY = boardNearY - SEPARATOR.boardClearance - ENC.sideGap
  const boardBattWall = makeBox(
    [wallX0, boardBatteryWallY, W - floorOverlap],
    [wallX1, boardBatteryWallY + ENC.sideGap, wallTopZ],
  )
  // Each return reaches 3.5 mm across the PCB's front edge. The 0.25 mm
  // axial clearance lets the PCB slide in without an interference fit.
  const stopX1 = BOARD_FRONT_X - SEPARATOR.boardClearance
  const antennaCornerStop = makeBox(
    [wallX0, boardFarY - SEPARATOR.cornerGrip, W - floorOverlap],
    [stopX1, boardAntennaWallY + ENC.sideGap, wallTopZ],
  )
  const batteryCornerStop = makeBox(
    [wallX0, boardBatteryWallY, W - floorOverlap],
    [stopX1, boardNearY + SEPARATOR.cornerGrip, wallTopZ],
  )

  // Corner fillet — only the 4 real outer corners, positively selected by a
  // small box around each. `e.inDirection('Z')` alone (used when this was
  // just a plain box, pre-redesign) also matches the 1mm-thick separator
  // walls' own edges where they meet the outer shell — those can't take a
  // 3mm radius, and OCCT throws a bare WebAssembly.Exception with no useful
  // message when asked to. Found by bisecting the operation chain.
  return steppedOuter
    .cut(cavityMainSolid)
    .cut(cavityNotchSolid)
    .fuse(antennaBoardWall)
    .fuse(boardBattWall)
    .fuse(antennaCornerStop)
    .fuse(batteryCornerStop)
    .chamfer(1.0, (e) => e.inPlane('XY', 0))
}

// ── Lid ───────────────────────────────────────────────────────────────────────

export function buildLid() {
  const lidTopZ = SPLIT + W
  const { skirtH, skirtClear } = FIT
  const lidBottomZ = SPLIT - skirtH

  // The lid is dimensioned by its friction-fit lip. Its outer profile stays
  // constant from the top through the skirt, so the sides continue downward
  // without an outward ledge or an extra segment at the transition.
  const outerProfile = drawRoundedRectangle(OL, OW, ENC.cornerR).translate(OL / 2, OW / 2)

  // Keep the lip-sized outer profile constant through the complete lid. The
  // friction-fit sides continue down from the top, with no outward ledge or
  // separate segment at the shell/skirt transition.
  const lidBlank = outerProfile.sketchOnPlane('XY', lidBottomZ).extrude(lidTopZ - lidBottomZ) as Solid

  // Display window
  const dispX1 = BOARD_FRONT_X + DISPLAY.fromFront
  const dispX2 = dispX1 + DISPLAY.length
  const dispY1 = LAYOUT.boardY0 + ENC.boardClearance + DISPLAY.fromEdge
  const dispY2 = dispY1 + DISPLAY.width
  const displayWindow = makeBox(
    [dispX1, dispY1, SPLIT - 1],
    [dispX2, dispY2, lidTopZ + 1],
  )

  const lidWithWindow = lidBlank.cut(displayWindow)

  // USB-C access continues through the lid's front skirt. Without this
  // matching cut, the lid overlaps the upper part of the body opening and
  // makes it difficult to insert a cable into the connector.
  const usbLidOpening = makeBox(
    [-1, USB_NOTCH_Y1, USB_OPENING_BOTTOM_Z],
    [OL - W, USB_NOTCH_Y2, USB_OPENING_TOP_Z],
  )
  const lidWithUsbOpening = lidWithWindow.cut(usbLidOpening)

  // Button holes — buttons at front-face corners of board. Positions shared
  // with buildButtons() below via the module-level BTN_X/BTN1_Y/BTN2_Y.
  const btn1 = makeCylinder(BUTTON.holeR, W + 2, [BTN_X, BTN1_Y, SPLIT - 1], [0, 0, 1])
  const btn2 = makeCylinder(BUTTON.holeR, W + 2, [BTN_X, BTN2_Y, SPLIT - 1], [0, 0, 1])

  const lidWithHoles = lidWithUsbOpening.cut(btn1).cut(btn2)

  // Recess each button flange into the underside of the lid. Keeping the
  // flange below the lid would overlap the board's tallest components and
  // hold the switches pressed continuously.
  const buttonPocketR = BUTTON.holeR + BUTTON.flangeOverlap + BUTTON.flangeClearance
  const buttonPocketDepth = BUTTON.flangeThickness + BUTTON.flangeClearance
  const buttonPocket = (x: number, y: number) => makeCylinder(
    buttonPocketR,
    buttonPocketDepth,
    [x, y, SPLIT],
    [0, 0, 1],
  )
  const lidWithButtonPockets = lidWithHoles
    .cut(buttonPocket(BTN_X, BTN1_Y))
    .cut(buttonPocket(BTN_X, BTN2_Y))

  // Match the base's rounded outer corners inside the friction-fit lip. A
  // The inner profile follows the recessed upper body shoulder with the
  // configured fit clearance.
  const innerL = OL - ENC.bodyTopInset * 2 + skirtClear * 2
  const innerW = OW - ENC.bodyTopInset * 2 + skirtClear * 2
  const skirtInnerProfile = drawRoundedRectangle(
    innerL,
    innerW,
    Math.max(ENC.cornerR - ENC.bodyTopInset + skirtClear, 0.5),
  ).translate(OL / 2, OW / 2)
  const skirtInner = skirtInnerProfile
    .sketchOnPlane('XY', lidBottomZ - 1)
    .extrude(SPLIT - lidBottomZ + 1) as Solid
  const lidCut = lidWithButtonPockets.cut(skirtInner)

  // Chamfer the top rim — applied last, on the otherwise-finished solid, per
  // this project's "chamfer/fillet last" rule (see PARTS.md Known Issues).
  // Keep this after displayWindow/button-hole/skirtInner — all three cuts
  // happen before the chamfer, exactly the
  // ordering the rule exists to prevent. Restricted to straight (`LINE`)
  // edges since replicad/OCCT's `inPlane` filter is documented as working
  // "only in lines" without checking that assumption, so an unfiltered
  // `e.inPlane('XY', lidTopZ)` would also match the rounded corner's own
  // curved top-rim arc (planar, just not straight).
  return lidCut.chamfer(1.0, (e) => e.inPlane('XY', lidTopZ).ofCurveType('LINE'))
}

// ── Reference shapes ──────────────────────────────────────────────────────────

export function boardOutline() {
  // Starts at Z=W (enclosure floor) — bottom components rest on floor.
  // Front edge (X) uses BOARD_FRONT_X (inside the usb-notch), not the plain
  // boardClearance — see HARDWARE.md: the USB-C connector overhangs the
  // PCB's front edge, so that end needs more room than a symmetric per-side
  // clearance gives.
  return makeBox(
    [BOARD_FRONT_X, LAYOUT.boardY0 + ENC.boardClearance, W],
    [
      BOARD_FRONT_X + BOARD.length,
      LAYOUT.boardY0 + ENC.boardClearance + BOARD.width,
      W + BOARD.bottomHeight + BOARD.pcbThickness + BOARD.componentHeight,
    ],
  )
}

export function batteryOutline() {
  const battY = LAYOUT.battY0 + ENC.battClearance
  return makeBox(
    [W + ENC.battClearance, battY, W],
    [W + ENC.battClearance + BATTERY.length, battY + BATTERY.width, W + BATTERY.height],
  )
}

export function antennaOutline() {
  // Flexible wire antenna in its own lane (2026-09-21 layout redesign) —
  // away from the battery, resolving the interference risk flagged in
  // HARDWARE.md. Lies flat on the floor along X, centred in its lane (Y)
  // and running the same length as the board, symmetric within the normal
  // (non-notch) internal length the same way the board is.
  const antY = LAYOUT.antennaY0 + LAYOUT.antennaLaneW / 2
  const antRadius = ANTENNA.diameter / 2
  const antX = W + ENC.boardClearance
  return makeCylinder(antRadius, ANTENNA.length, [antX, antY, W + antRadius], [1, 0, 0])
}

// ── Buttons (printed separately, slotted into the lid) ─────────────────────────

// A flanged plug that slides into a button hole from underneath before final
// assembly. The flange (wider than the hole) is built as its own solid and
// fused to the shaft, but — unlike lid-shell/lid-skirt — this is a fuse
// between two plain coaxial cylinders meeting at a flat disc, not two
// independently-computed *curved/filleted* surfaces, so it doesn't hit the
// tangent-fillet boolean issue documented in buildLid(). It still gets a
// small Z overlap (fuseOverlap) rather than an exact-coincident face,
// following the same general "give booleans real overlap, not a knife-edge
// touch" principle established earlier for lid-skirt's original fuse.
function buildLidButton(x: number, y: number) {
  const { holeR, shaftClearance, flangeOverlap, flangeThickness, capProtrusion, capProtrusionExtra, fuseOverlap } = BUTTON
  const easierPressProtrusion = capProtrusion + capProtrusionExtra
  const shaftR = holeR - shaftClearance
  const flangeR = holeR + flangeOverlap
  const flange = makeCylinder(flangeR, flangeThickness, [x, y, SPLIT], [0, 0, 1])
  const shaftH = W + easierPressProtrusion + fuseOverlap
  const shaft = makeCylinder(shaftR, shaftH, [x, y, SPLIT - fuseOverlap], [0, 0, 1])
  return flange.fuse(shaft)
}

export function buildButtons() {
  return {
    prgButton: buildLidButton(BTN_X, BTN1_Y),
    rstButton: buildLidButton(BTN_X, BTN2_Y),
  }
}

// ── Section view (cutaway for internal clearance checks — see PARTS.md `section`) ─

// Splits a shape at X = OL/2 and keeps the front half (containing usb-notch,
// usb-slot, and most of display-window), exposing a cross-section through
// interior-cavity and both separator walls (antenna|board, board|battery).
function frontHalf(shape: Solid) {
  const { negative } = shape.split('YZ', OL / 2)
  if (!negative) throw new Error('section split produced no front half')
  return negative
}

export function buildBodySection() {
  return frontHalf(buildBody())
}

export function buildLidSection() {
  return frontHalf(buildLid())
}

// ── Assembly ──────────────────────────────────────────────────────────────────

export function buildEnclosure() {
  const { prgButton, rstButton } = buildButtons()
  return {
    body: buildBody(),
    lid: buildLid(),
    bodySection: buildBodySection(),
    lidSection: buildLidSection(),
    prgButton,
    rstButton,
    boardRef: boardOutline(),
    battRef: batteryOutline(),
    antRef: antennaOutline(),
  }
}

export function main() {
  const { body, lid, prgButton, rstButton } = buildEnclosure()
  return compoundShapes([body, lid, prgButton, rstButton])
}
