# Hardware Reference — Node Enclosure

> Imported upstream notes. See [the example README](README.md#known-baseline-limitations)
> for documentation/code differences. `Tracker-V2.3.1.step` and related-repo
> documents mentioned below are upstream references, not bundled assets.

Stable reference dimensions for the Guardian Chain node enclosure.
Update this file when hardware changes; model code reads constants from `replicad/src/model/hardware.ts` which mirrors these values.

---

## Board — Heltec Wireless Tracker V2

| Property | Value | Notes |
|---|---|---|
| PCB length | 52.00 mm | Long axis |
| PCB width | 25.40 mm | Short axis |
| Max component height (top) | 5.29 mm | **Corrected 2026-09-20** — first print's fit was much looser than expected; caliper-measured the assembled board's total depth (bottom connectors to tallest top component) at 9.2 mm. With bottom-side height (2.31mm) and PCB thickness (1.60mm) unchanged, this is what the top-component figure must be to match: 9.2 − 2.31 − 1.60 = 5.29mm. Original 8.7mm estimate was too high. |
| PCB thickness | 1.60 mm | Standard FR4 |
| Bottom-side height | 2.31 mm | Connectors / passives below PCB |
| LoRa connector | U.FL / IPEX | Ships with SMA pigtail; needs passthrough in enclosure |
| GPS antenna | Ceramic patch, on-board | No metal or carbon-fill above this area in lid |
| USB connector | USB-C | Programming + charging; needs side slot. **The connector overhangs the PCB's front edge** — discovered 2026-09-20 when the board couldn't be inserted after first print; see `boardClearanceFront` below. |
| Battery connector | 1.25 mm JST | On board underside, **at the same (front/USB-C) end of the board** — confirmed 2026-09-20. Its cable and the USB-C connector's overhang share the same end, so routing needs care (see cable passthrough below); it is not opposite the antenna's U.FL connector as originally assumed. |
| MCU | ESP32-S3FN8 | |
| Radio | SX1262, 863–928 MHz | |
| GNSS | UC6580 multi-GNSS | |

**Resources:**
- Datasheet: <https://resource.heltec.cn/download/Wireless_Tracker_V2/Wireless_Tracker_v2_Datasheet/Wireless%20Tracker%20v2.pdf>
- Schematics: <https://resource.heltec.cn/download/Wireless_Tracker_V2/Schematic>
- Board STEP file (in this repo): `Tracker-V2.3.1.step`
- Purchase (amazon.se, kr 512): <https://www.amazon.se/dp/B0GSZN129X>

---

## Battery — EEMB 852040

| Property | Value | Notes |
|---|---|---|
| Model | 852040 | Width × height × length code |
| Chemistry | LiPo 3.7 V | |
| Capacity | 620 mAh | ~10 days at 1-min beacon intervals |
| Length | 42.0 mm | |
| Width | 20.5 mm | |
| Thickness | 8.8 mm | |
| Connector | 1.25 mm JST (unconfirmed) | Listing upsells a 2.0 mm cable — verify on arrival; have 2.0 mm → 1.25 mm adapter ready |

**Resources:**
- Purchase (amazon.se, kr 122): <https://www.amazon.se/dp/B095VVWTSH>
- See `gc-node/docs/hardware.md` §Ordered for full procurement notes

---

## Board Component Positions (measured 2026-09-07)

All measurements from the **screen/front end** (short face that has the display, USB-C, and buttons).

| Feature | From front edge | From long edge | Size |
|---|---|---|---|
| Display bezel (near edge) | 12 mm | — | — |
| Display bezel (from long edge) | — | 6 mm | — |
| Display visible area | 12–34.3 mm along long axis | 6–19 mm along short axis | 22.3 × 13 mm |
| USB-C connector | 0 mm (at face) | centred on board width (~12.7 mm) | 10.5 × 4.5 mm slot |
| PRG button | 0 mm (at face) | ~2 mm from one long edge (top corner) | — |
| RST button | 0 mm (at face) | ~23 mm from same long edge (bottom corner) | — |

Notes:
- USB-C and display are on the **same short face** (the "front")
- Buttons are at the two long-edge corners of the front face — now modeled as `button-hole-prg`/`button-hole-rst` in the lid, each with a separate printed plug (see "Lid Button Plugs" below)
- LoRa antenna: U.FL/IPEX connector on board, antenna lays inside enclosure for v0.1
- Battery's JST connector is at the same end as USB-C (front) — see Board table above

---

## Enclosure Design Parameters

| Parameter | Value | Rationale |
|---|---|---|
| Wall thickness | 2.5 mm | PETG/ASA minimum for structural rigidity |
| Board clearance (width) | 0.5 mm | Per side, short axis (Y) — confirmed correct by first print, board "fits perfect on the short side" |
| Board clearance (length, USB end) | 7.95 mm from outside face | Original 3.0 mm for connector overhang plus 4.95 mm for the magnetic USB adapter and battery lead. The rear PCB edge sits 0.5 mm from the inner rear wall. |
| Board/enclosure length allowance | 0 mm extra | The former 2.0 mm loose length allowance is removed to stop fore-aft movement. |
| Body upper shoulder inset | 1.0 mm per side | Recessed from the full lower footprint so the flush lid can retain the shoulder |
| Battery clearance | 0.3 mm | Tighter fit to prevent rattle |
| Standoff height | 2.0 mm | Gap between battery top and PCB underside |
| Corner fillet (outer) | 3.0 mm | Ergonomic, avoids sharp edges |
| Corner fillet (inner) | 1.0 mm | Printability |
| Gasket groove width | 1.5 mm | Fits 1.5 mm OD TPU o-cord |
| Gasket groove depth | 1.0 mm | 67 % compression target |
| SMA hole diameter | 7.0 mm | Clears SMA bulk-head nut |
| USB-C slot width | 10.5 mm | USB-C plug + overmold clearance |
| USB-C slot height | 4.5 mm | USB-C plug height |
| USB-C protective lip | 4.0 mm | Material retained above the enclosure floor at the front opening to protect the board edge; the slot begins above this lip |
| Print material | PETG or ASA | Not PLA — deforms in hot vehicles |
| IP target | IP54 | Achievable with FDM + gasket |
| Lid skirt height | 2.5 mm | Outer skirt insertion depth for friction retention |
| Lid skirt wall | 1.0 mm | Skirt wall thickness (2–3 FDM perimeters) |
| Lid skirt clearance | 0.15 mm | Interference per side vs. body exterior (press-fit) |
| Cable routes | Open at both guide ends | The centered guides leave 13 mm of PCB length unobstructed at each end. The former 16 mm full-height cable cutouts are obsolete; check cable and connector fit with the actual hardware. |

---

## Layout — Three Lanes Side by Side (battery / board / antenna)

**Built 2026-09-21**, replacing the original two-lane (board/battery only)
layout. Driven by an antenna interference risk in the original layout: the
antenna wire sat directly above the battery with only ~0.9mm clearance,
close enough to a LiPo pouch's foil-like skin at 863–928MHz (~32cm
wavelength) to risk detuning. Discussed and confirmed via a side-by-side
diagram (`layout-check.html` artifact, not checked into this repo — see
`PARTS.md` Known Issues) before any geometry was touched. The antenna now
has its own lane, on the opposite side of the board from the battery, so
the board itself sits between them.

| Parameter | Value | Notes |
|---|---|---|
| Antenna length | 52.0 mm | Same length as `BOARD.length`, running the full lane (was a 40mm placeholder in the two-lane design) |
| Antenna diameter | 3.0 mm | User-specified — likely a sleeved/loomed assembly, not bare wire (supersedes the old 1mm-dia "realistic thin wire" estimate) |
| Antenna wiggle room | 2.0 mm total (not per side) | Clearance in the antenna's lane beyond its own diameter; kept small since the wire is light and won't rattle |
| Antenna-lane width (derived) | 3.0 + 2.0 | **5.0 mm** |
| Antenna–board separation | 5.0 mm reserved (air), not a thick wall | Driven by the U.FL pigtail cable's rigidity needing bend room. The physical wall between the lanes is slim — same style/thickness as the board–battery `sideGap` wall — mostly open air, not solid material filling the whole 5mm |
| USB-C notch width margin | 1.0 mm per side | Applied around the existing 10.5mm `usb-slot` width → notch width = 10.5 + 2×1.0 = **12.5 mm** |
| USB-C notch depth | `boardClearanceFront − boardClearance` = 3.0 − 0.5 | **2.5 mm** — the front wall steps out by this much, but only across the notch's 12.5mm width, not the whole board lane |
| Separator wall length | USB corner to 13 mm before rear edge | Side guides reach the USB-end board corners and stop at X=46.95 mm, leaving 13 mm open at the rear. Two 3.5 mm corner returns prevent fore-aft sliding. |

## Derived Internal Dimensions

Three lanes side by side, low-Y to high-Y: battery, board, antenna.

| Dimension | Calculation | Result |
|---|---|---|
| Antenna-lane width | 3.0 + 2.0 | 5.0 mm |
| Antenna–board gap | reserved spacing | 5.0 mm |
| Board zone width | 25.40 + 0.5×2 | 26.4 mm |
| Board–battery gap | separator (`sideGap`, unchanged) | 1.0 mm |
| Battery zone width | 20.50 + 0.3×2 | 21.1 mm |
| **Total internal width** | 5.0 + 5.0 + 26.4 + 1.0 + 21.1 | **58.5 mm** |
| Internal length (normal, non-notch) | 52.00 + 7.95 + 0.5 − 2.5 | 57.95 mm |
| Internal height | 2.31 + 1.60 + 5.29 + 0.5 | 9.7 mm |
| **External width** | 58.5 + 2.5×2 | **63.5 mm** |
| **External length** | 57.95 + 2.5×2 | **62.95 mm** |
| **External height** | 9.7 + 2.5×2 | **14.7 mm** |
| Lid split Z | 2.5 + 9.7 | **12.2 mm from bottom** |

Profile: 62.95×63.5mm and flat (14.7mm). The lower body
keeps this full footprint, while its upper shoulder is inset 1.0mm per side.
The lid uses the same 62.95×63.5mm outer footprint and grabs that recessed
shoulder without an external overhang. The body and lid
share the USB-C opening, while the body retains a 4.0mm protective lip below it.
The lid's outer
profile is sized from its friction-fit lip and remains continuous down through
the skirt; it no longer has a narrower upper shell with a projecting lower
segment. The USB opening is cut through the lid's front skirt as well as the
body's front wall so a cable can be connected with the enclosure assembled.
Lid split is across the large flat face (Z = 12.2 mm from bottom). Lid adds
2.5 mm wall = 14.7 mm total.

---

## LoRa Antenna (visualization only)

The board ships with a U.FL/IPEX pigtail. As of the 2026-09-21 three-lane
layout, the antenna wire lies flat on the floor in its own lane, the same
length as the board, running parallel to it — not above the battery.

| Parameter | Value | Notes |
|---|---|---|
| Connector | U.FL / IPEX (board) | Pigtail to wire antenna |
| Antenna type | Flexible wire monopole (or sleeved assembly) | Ships attached to board |
| Model representation | 3mm dia cylinder, 52mm long, on the floor in `antenna-lane` | See "Layout" above for the lane/separation numbers |

**Interference risk — resolved by the 2026-09-21 layout redesign.** The
antenna previously sat directly above the battery with only ~0.9mm
clearance (a real detuning/coupling risk for a wire monopole this close to
a LiPo pouch's foil-like skin). It now has its own lane, separated from the
battery by the full width of the board plus two gaps (antenna–board 5.0mm +
board zone 26.4mm + board–battery 1.0mm ≈ 32mm center-to-center from the
battery), not stacked on top of it. Not RF-verified by measurement, but the
specific geometric risk that was flagged is gone by construction.

## Lid Button Plugs

The PRG/RST buttons are not pressed directly — `button-hole-prg`/`-rst` are
holes in the lid, and a **separately-printed plug** (own filament color
optional) slots into each from the underside before final assembly. A
flange wider than the hole sits in a recessed underside pocket and traps the
plug against the lid, so it can't be pushed out through the hole from either
direction; the shaft
passes through the hole and stands slightly proud outside for an easy press
transferring force down onto the board's actual tactile switch.

| Parameter | Value | Notes |
|---|---|---|
| Shaft clearance | 0.2 mm per side | Sliding fit through the 5mm-dia hole |
| Flange overlap | 1.5 mm | Flange radius = hole radius + this, so it can't pull through |
| Flange thickness | 1.2 mm | Recessed into the lid underside |
| Flange pocket clearance | 0.2 mm radial | Printable sliding clearance around the flange |
| Cap protrusion | 0.5 mm | How far the cap stands proud of the lid's outer face |

**Not yet verified:** the shaft's reach below the lid's inner face (to
actually contact the board's tactile switch) depends on the switch's height
and position, which haven't been measured — this is a placeholder length
until that's confirmed on the physical board.

## Board guide revision (2026-09-23)

CAD review identified excess lateral play at the antenna-side separator. Both
half-length separators now follow the PCB edges, with `SEPARATOR.boardClearance`
set to **0.25 mm per side** (adjustable, provisional print fit). Previously the
antenna-side clearance was 2.5 mm and the battery-side clearance was 0.5 mm.
The PCB, antenna lane, and enclosure footprint retain their positions.

Both guides stop at the PCB top: `SEPARATOR.height = BOARD.bottomHeight +
BOARD.pcbThickness`, **3.91 mm above the floor**, or Z=6.41 mm. This derived
height leaves 5.79 mm to the lid split and 5.49 mm below the modeled button
shaft's lower tip at rest. Full-depth button relief cuts are removed, leaving
continuous board guides. Button actuation and the 0.25 mm sliding clearance
still require a physical fit check; the board reference is a bounding box.

The guides are centered along the PCB (X=16–42 mm), leaving open routes at
both the USB end and the rear end. Their bases overlap the floor by 0.3 mm so
the printed body remains one solid.

## Magnetic USB adapter and board stops

The magnetic adapter and battery connector need an additional **4.95 mm** at
the USB end. The PCB front edge is now X=7.95 mm; the display window and both
buttons move with it. The external length grows to 62.95 mm while the PCB's
rear edge sits 0.5 mm from the rear inner wall. This removes the former 2 mm
extra length that allowed the PCB to slide fore and aft.

Both side guides extend to the USB-end corners and have short returns over
3.5 mm of each board corner. They are **3.5 mm above the floor**, with 0.25 mm
clearance from the PCB edges. The guides remain open at the rear for cable
routing. Adapter reach, button travel, and corner fit require a physical check.
