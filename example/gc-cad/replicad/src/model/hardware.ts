// Hardware constants for the GC node enclosure.
// Source of truth: gc-cad/HARDWARE.md — update both files together.

// Heltec Wireless Tracker V2
// Datasheet:  https://resource.heltec.cn/download/Wireless_Tracker_V2/Wireless_Tracker_v2_Datasheet/Wireless%20Tracker%20v2.pdf
// Schematics: https://resource.heltec.cn/download/Wireless_Tracker_V2/Schematic
// Board STEP: gc-cad/Tracker-V2.3.1.step
// Purchase:   https://www.amazon.se/dp/B0GSZN129X
export const BOARD = {
  length: 52.00,          // mm — long axis (X in model)
  width: 25.40,           // mm — short axis (Y in model)
  pcbThickness: 1.60,     // mm
  componentHeight: 5.29,  // mm — corrected 2026-09-20: total assembled board depth measured
                           // at 9.2mm with calipers after first print (bottomHeight + pcbThickness
                           // + componentHeight = 9.2); bottomHeight/pcbThickness assumed unchanged,
                           // so this absorbed the full correction. Original estimate was 8.7mm.
  bottomHeight: 2.31,     // mm — tallest feature below PCB (connectors, passives)
} as const

// EEMB 852040 — 3.7V 620mAh LiPo
// Purchase: https://www.amazon.se/dp/B095VVWTSH
// Connector: 1.25mm JST — verify pitch on arrival; have 2.0mm→1.25mm adapter ready
export const BATTERY = {
  length: 42.0, // mm (shorter than board by 10mm)
  width: 20.5,  // mm
  height: 8.8,  // mm thickness
} as const

// Board component positions — measured 2026-09-07
// All from the front short face (the face with screen, USB-C, and buttons)
export const DISPLAY = {
  fromFront: 12,   // mm along long axis to near edge of display bezel
  fromEdge: 6,     // mm from board's Y=0 long edge to display near edge
  length: 22.3,    // mm along board long axis
  width: 13,       // mm along board short axis
} as const

// USB-C connector — front face, centered on board width
export const USB_C = {
  slotW: 10.5, // mm wide (plug + overmold clearance)
  slotH: 4.5,  // mm tall (plug + overmold clearance)
  protectiveLipH: 4.0, // mm of material retained above the enclosure floor at the opening
} as const

// Friction-fit lid retention — see HARDWARE.md for rationale
export const FIT = {
  skirtH: 2.5,        // mm — outer skirt insertion depth
  skirtWall: 1.0,     // mm — skirt wall thickness
  skirtClear: 0.25,   // mm per side — interference vs. body exterior (press-fit). Raised from
                       // 0.15 2026-10-04: review feedback reported the lid too loose after
                       // printing. Reprint and confirm before raising further.
} as const

// Enclosure design parameters — see HARDWARE.md for rationale
export const ENC = {
  magneticAdapterExtra: 4.95, // mm added between the PCB front edge and USB wall
  bodyTopInset: 1.0,     // mm per side; recessed upper shoulder for the flush lid
  wall: 2.5,            // mm
  boardClearance: 0.5,  // mm per side around board (width/Y direction — confirmed correct by first print fit)
  boardClearanceFront: 3.0, // mm — clearance the board's own front edge needs from the USB-C notch's
                              // cavity boundary, at the usb-slot end only (back end keeps the normal
                              // boardClearance). Found 2026-09-20: the USB-C connector overhangs the
                              // PCB's front edge. From 2026-09-21 (three-lane layout redesign) this is
                              // realized as a localized notch (see LAYOUT.notchDepth/notchWidth), not a
                              // uniform extension of the whole enclosure's length.
  notchMargin: 1.0,      // mm per side — USB-C notch width beyond the usb-slot's own 10.5mm width;
                          // user-confirmed 2026-09-21 ("same as it is in the previous model, perfect")
  battClearance: 0.3,   // mm per side around battery
  sideGap: 1.0,         // mm separator between board zone and battery zone
  cornerR: 3.0,         // mm outer vertical corner fillet
} as const

// Adjustable board guides, based on CAD review feedback (2026-09-23).
// Keep the PCB position fixed; move the guides within the existing lanes.
export const SEPARATOR = {
  boardClearance: 0.25, // mm per side; provisional sliding fit, verify in print
  height: 3.5, // mm above floor; cap to avoid button travel
  cornerGrip: 3.5, // mm of each USB-end PCB corner held by the return
} as const

// Button holes in the lid, and the separate printed plugs that slot into
// them from underneath before final assembly — see HARDWARE.md.
export const BUTTON = {
  flangeClearance: 0.2,   // mm radial clearance for the recessed flange pocket
  wallClearance: 0.5,     // mm radial clearance between a flange and a divider wall
  capProtrusionExtra: 0.5, // mm additional press surface height for easier actuation
  holeR: 2.5,             // mm — hole radius in the lid (5mm dia)
  shaftClearance: 0.2,    // mm per side — shaft-to-hole clearance for a sliding fit
  flangeOverlap: 1.5,     // mm — flange radius grows this much beyond holeR, to catch the lid's inside face
  flangeThickness: 1.2,   // mm
  capProtrusion: 0.5,     // mm — how far the cap stands proud of the lid's outer face
  fuseOverlap: 0.3,       // mm — vertical overlap between flange and shaft at their fuse (avoids a coincident-face seam)
} as const

// Wire antenna reference (visualization/clearance-checking only) — moved to
// its own lane in the 2026-09-21 layout redesign, away from the battery
// (see HARDWARE.md "Layout Redesign" for the interference risk that drove
// this and the RF rationale for the board-separation distance below).
export const ANTENNA = {
  length: BOARD.length, // 52 mm — same length as the board, user-specified 2026-09-21
  diameter: 3.0,         // mm — user-specified 2026-09-21; likely a sleeved/loomed assembly, not bare wire
                          // (supersedes the old 1mm-dia "realistic thin wire" estimate)
  wiggle: 2.0,           // mm, total (not per side) — clearance in the antenna's lane beyond its own
                          // diameter; kept small since the wire is light and won't rattle
  boardSeparation: 5.0,  // mm — reserved Y-gap between the antenna lane and the board zone. Driven by
                          // the U.FL pigtail cable's rigidity needing more bend room than a simple
                          // divider — NOT the same as ENC.sideGap. Corrected 2026-09-21: this gap is
                          // mostly open air, not a thick wall — see LAYOUT.antennaBoardGapW and the
                          // separator wall notes in enclosure.ts.
} as const

// Derived layout — three lanes side by side (Y direction, low to high):
// battery, board, antenna. See HARDWARE.md "Layout Redesign" for the
// 2026-09-21 change from the original two-lane (board/battery) design.
export const LAYOUT = {
  antennaLaneW: ANTENNA.diameter + ANTENNA.wiggle,                       // 5.0 mm
  antennaBoardGapW: ANTENNA.boardSeparation,                             // 5.0 mm
  boardZoneW: BOARD.width + ENC.boardClearance * 2,                      // 26.4 mm
  battZoneW: BATTERY.width + ENC.battClearance * 2,                      // 21.1 mm
  get intW() {
    return this.battZoneW + ENC.sideGap + this.boardZoneW + this.antennaBoardGapW + this.antennaLaneW
  }, // 58.5 mm
  get outW() { return this.intW + ENC.wall * 2 },                        // 63.5 mm

  // Y boundaries of each lane (floor-to-ceiling), used throughout enclosure.ts
  get battY0() { return ENC.wall },
  get battY1() { return this.battY0 + this.battZoneW },
  get boardY0() { return this.battY1 + ENC.sideGap },
  get boardY1() { return this.boardY0 + this.boardZoneW },
  get antennaY0() { return this.boardY1 + this.antennaBoardGapW },
  get antennaY1() { return this.antennaY0 + this.antennaLaneW },          // == outW - wall

  // X (length) — the enclosure is a plain rectangle at this length on every
  // side, including at the usb-notch: the notch is a cutout into the wall,
  // not a protrusion out of it, so it never grows the exterior footprint.
  // PCB is 0.5 mm from the rear inner wall; the former 2 mm loose length
  // allowance is removed so the front stops can hold it against that wall.
  intL: BOARD.length + ENC.boardClearanceFront + ENC.magneticAdapterExtra + ENC.boardClearance - ENC.wall,
  get outL() { return this.intL + ENC.wall * 2 },                        // 62.95 mm

  // USB-C notch — a cutout in the front wall above the protective lip,
  // across notchWidth (centered on the connector) — not the whole board
  // lane, and not a step in the exterior boundary.
  notchWidth: USB_C.slotW + ENC.notchMargin * 2,                         // 12.5 mm

  // Z (height) — unchanged from the two-lane design; antenna now sits in
  // its own lane at floor level, no longer stacked above the battery, so it
  // no longer drives a height constraint.
  intH: BOARD.bottomHeight + BOARD.pcbThickness + BOARD.componentHeight + ENC.boardClearance, // 9.7 mm
  get outH() { return this.intH + ENC.wall * 2 },                        // 14.7 mm
  get lidSplitZ() { return ENC.wall + this.intH },                       // 12.2 mm
} as const
