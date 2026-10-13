import opencascade from 'replicad-opencascadejs'
import { setOC } from 'replicad'
import { syncGeometries } from 'replicad-threejs-helper'
import type * as THREE from 'three'
import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createViewer, addThreeGeometry } from 'cadbea'
import type { CadbeaViewer } from 'cadbea'
import { CadbeaApp, ToggleButtonGroup } from 'cadbea/ui'
import 'cadbea/ui/style.css'
import { Box, Boxes, Square, SplitSquareVertical } from 'lucide-react'
import { buildEnclosure } from './model/enclosure'
import { LAYOUT } from './model/hardware'

const EXPLODE_LID_MM = 38 // how far the lid lifts in local Z (replicad Z = up)
// The PRG/RST buttons are their own printed part, assembled by sliding into
// the lid from the body side before the lid goes on the body — so in an
// exploded diagram they belong in the gap between body and lid, not beyond
// the lid. Lifting them by the *same* amount as the lid made them look fused
// to it (no visible gap); lifting them *more* than the lid sent them flying
// past it instead. A smaller target than the lid's keeps them floating
// between the two, where they're actually assembled.
const EXPLODE_BUTTON_MM = 20
const EXPLODE_MS = 550 // animation duration, interactive use only

/** Everything the explode/section controls need once the model has been built and meshed. */
interface Model {
  lidFace: THREE.Mesh
  lidEdges: THREE.Object3D
  buttonParts: THREE.Object3D[]
  bodyFace: THREE.Mesh
  bodyEdges: THREE.Object3D
  bodySectionFace: THREE.Mesh
  bodySectionEdges: THREE.Object3D
  lidSectionFace: THREE.Mesh
  lidSectionEdges: THREE.Object3D
}

/** Animates one or more part groups toward their own target Z in lockstep — a
 * single eased motion, but the lid and the buttons can travel different
 * distances within it (see EXPLODE_BUTTON_EXTRA_MM above). */
function animateExplode(groups: { parts: THREE.Object3D[], targetZ: number }[], onFrame: (id: number) => void) {
  const fromZ = groups.map((g) => g.parts[0]?.position.z ?? 0)
  const start = performance.now()
  const step = (now: number) => {
    const t = Math.min((now - start) / EXPLODE_MS, 1)
    const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t // ease in-out quad
    groups.forEach((group, i) => {
      const z = fromZ[i] + (group.targetZ - fromZ[i]) * e
      for (const part of group.parts) part.position.z = z
    })
    if (t < 1) onFrame(requestAnimationFrame(step))
  }
  onFrame(requestAnimationFrame(step))
}

/** The explode/section controls — kept as hand-authored buttons (not the generic
 * StatesToolbar) because the exploded view needs interactive animation timing
 * that a generic per-state toggle doesn't provide. Exploded/assembled and
 * full/section are independent axes — either can be active with the other,
 * so section stays on while toggling explode and vice versa. */
function ModelControls({ viewer, model }: { viewer: CadbeaViewer, model: Model }) {
  const [exploded, setExplodedFlag] = useState(false)
  const [sectioned, setSectionedFlag] = useState(false)
  // A ref, not useState: viewer.states registers these callbacks once (see
  // the effect below), so they must read the *current* animation id at call
  // time rather than close over whichever render's state value existed when
  // they were created — a stale id would silently fail to cancel it.
  const lidAnimation = useRef<number>()

  const setExploded = (on: boolean, opts: { animate?: boolean } = {}) => {
    if (lidAnimation.current !== undefined) cancelAnimationFrame(lidAnimation.current)
    setExplodedFlag(on)
    // Move both the full and the section-cut lid mesh together — section can
    // be active at the same time as exploded, and whichever one is actually
    // visible needs to carry the same offset (section/full share no mesh).
    const groups = [
      { parts: [model.lidFace, model.lidEdges, model.lidSectionFace, model.lidSectionEdges], targetZ: on ? EXPLODE_LID_MM : 0 },
      { parts: model.buttonParts, targetZ: on ? EXPLODE_BUTTON_MM : 0 },
    ]
    if (opts.animate ?? true) animateExplode(groups, (id) => { lidAnimation.current = id })
    else for (const group of groups) for (const part of group.parts) part.position.z = group.targetZ
  }

  const setSection = (on: boolean) => {
    setSectionedFlag(on)
    model.bodyFace.visible = !on
    model.bodyEdges.visible = !on
    model.lidFace.visible = !on
    model.lidEdges.visible = !on
    model.bodySectionFace.visible = on
    model.bodySectionEdges.visible = on
    model.lidSectionFace.visible = on
    model.lidSectionEdges.visible = on
  }

  useEffect(() => {
    viewer.states = {
      exploded: (on) => setExploded(on, { animate: false }),
      section: setSection,
    }
    viewer.setView('iso')
    // Registered once the model + buttons both exist; setExploded/setSection
    // close over the latest React state via the functions defined above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Single-key shortcuts: each flips its own axis, independent of the other
  // (E always flips exploded/assembled; S always flips full/section) —
  // ignored while a modifier is held or typing focus is elsewhere.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
      if (event.key === 'e' || event.key === 'E') setExploded(!exploded)
      else if (event.key === 's' || event.key === 'S') setSection(!sectioned)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exploded, sectioned])

  return (
    <>
      <ToggleButtonGroup
        value={exploded ? 'exploded' : 'assembled'}
        onChange={(value) => setExploded(value === 'exploded')}
        options={[
          { value: 'assembled', label: 'Assembled', icon: <Box size={14} />, title: 'Assembled view (E)', testId: 'assembled-btn' },
          { value: 'exploded', label: 'Exploded', icon: <Boxes size={14} />, title: 'Exploded view — separates parts along the assembly axis (E)', testId: 'explode-btn' },
        ]}
      />
      <ToggleButtonGroup
        value={sectioned ? 'section' : 'full'}
        onChange={(value) => setSection(value === 'section')}
        options={[
          { value: 'full', label: 'Full', icon: <Square size={14} />, title: 'Full view (S)', testId: 'full-btn' },
          { value: 'section', label: 'Section', icon: <SplitSquareVertical size={14} />, title: 'Section view — cuts the model to check internal fit; works together with exploded (S)', testId: 'section-btn' },
        ]}
      />
    </>
  )
}

function App() {
  const [viewer, setViewer] = useState<CadbeaViewer | null>(null)
  const [status, setStatus] = useState('Loading OpenCASCADE WASM…')
  const [model, setModel] = useState<Model | null>(null)

  useEffect(() => {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement
    const query = new URLSearchParams(location.search)
    const createdViewer = createViewer(canvas, {
      reviewWebhook: query.get('reviewWebhook') ?? 'http://127.0.0.1:8787/review',
      bridgeHealthUrl: query.get('bridgeHealthUrl') ?? undefined,
      printBundle: {
        label: 'Download all print files',
        url: '/dist/print/node-wireless-tracker-v2-print-files.zip',
        fileName: 'node-wireless-tracker-v2-print-files.zip',
      },
    })
    setViewer(createdViewer)
    // replicad models are Z-up; rotate so three.js's Y-up matches the
    // viewer's camera/orbit conventions. cadbea measures whatever's actually
    // in the scene, so this is purely this project's concern.
    createdViewer.modelGroup.rotation.x = -Math.PI / 2

    async function build() {
      setStatus('Loading OpenCASCADE WASM…')
      const OC = await opencascade()
      setOC(OC)

      setStatus('Building enclosure…')
      const { body, lid, bodySection, lidSection, prgButton, rstButton, boardRef, battRef, antRef } = buildEnclosure()

      setStatus('Meshing…')
      const [bodyGeo, lidGeo, bodySectionGeo, lidSectionGeo, prgBtnGeo, rstBtnGeo, boardGeo, battGeo, antGeo] = syncGeometries([
        { name: 'body', faces: body.mesh({ tolerance: 0.05, angularTolerance: 0.2 }) },
        { name: 'lid', faces: lid.mesh({ tolerance: 0.05, angularTolerance: 0.2 }) },
        { name: 'bodySection', faces: bodySection.mesh({ tolerance: 0.05, angularTolerance: 0.2 }) },
        { name: 'lidSection', faces: lidSection.mesh({ tolerance: 0.05, angularTolerance: 0.2 }) },
        { name: 'prgBtn', faces: prgButton.mesh({ tolerance: 0.05, angularTolerance: 0.2 }) },
        { name: 'rstBtn', faces: rstButton.mesh({ tolerance: 0.05, angularTolerance: 0.2 }) },
        { name: 'board', faces: boardRef.mesh({ tolerance: 0.05, angularTolerance: 0.2 }) },
        { name: 'batt', faces: battRef.mesh({ tolerance: 0.05, angularTolerance: 0.2 }) },
        { name: 'ant', faces: antRef.mesh({ tolerance: 0.05, angularTolerance: 0.2 }) },
      ])

      const { faceMesh: bodyFace, edges: bodyEdges } = addThreeGeometry(createdViewer.modelGroup, bodyGeo, 0x2a6db5, 0.92, 'body')
      const { faceMesh: lidFace, edges: lidEdges } = addThreeGeometry(createdViewer.modelGroup, lidGeo, 0x3a8fd5, 0.92, 'lid')
      const { faceMesh: bodySectionFace, edges: bodySectionEdges } = addThreeGeometry(createdViewer.modelGroup, bodySectionGeo, 0x2a6db5, 0.92, 'body-section')
      const { faceMesh: lidSectionFace, edges: lidSectionEdges } = addThreeGeometry(createdViewer.modelGroup, lidSectionGeo, 0x3a8fd5, 0.92, 'lid-section')
      // Printed separately, slotted into the lid — bright/opaque so they read
      // as distinct parts, not part of the lid-shell/lid-skirt solid.
      const { faceMesh: prgBtnFace, edges: prgBtnEdges } = addThreeGeometry(createdViewer.modelGroup, prgBtnGeo, 0xffcc33, 1.0, 'lid-button-prg')
      const { faceMesh: rstBtnFace, edges: rstBtnEdges } = addThreeGeometry(createdViewer.modelGroup, rstBtnGeo, 0xffcc33, 1.0, 'lid-button-rst')
      addThreeGeometry(createdViewer.modelGroup, boardGeo, 0x44bb66, 0.25, 'board-ref')
      addThreeGeometry(createdViewer.modelGroup, battGeo, 0xffaa22, 0.25, 'battery-ref')
      addThreeGeometry(createdViewer.modelGroup, antGeo, 0xff4444, 0.60, 'antenna-ref')

      bodySectionFace.visible = false
      lidSectionFace.visible = false
      bodySectionEdges.visible = false
      lidSectionEdges.visible = false
      bodyEdges.name = 'body-edges'
      lidEdges.name = 'lid-edges'
      bodySectionEdges.name = 'body-section-edges'
      lidSectionEdges.name = 'lid-section-edges'

      // Buttons are physically slotted into the lid, so they explode along
      // with it — just further, so they read as their own separate part.
      setModel({
        lidFace, lidEdges,
        buttonParts: [prgBtnFace, prgBtnEdges, rstBtnFace, rstBtnEdges],
        bodyFace, bodyEdges, bodySectionFace, bodySectionEdges, lidSectionFace, lidSectionEdges,
      })
      createdViewer.ready = true

      const { outL, outW, outH } = LAYOUT
      setStatus(`GC Node Enclosure v0.1 — Heltec Wireless Tracker V2 + EEMB 852040  |  ${outL} × ${outW} × ${outH} mm`)
    }

    build().catch((err) => {
      console.error(err)
      setStatus(`Error: ${String(err)}`)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!viewer) return null

  return (
    <CadbeaApp viewer={viewer} status={status} title="AI Review">
      {model ? <ModelControls viewer={viewer} model={model} /> : null}
    </CadbeaApp>
  )
}

createRoot(document.getElementById('app-root')!).render(<App />)
