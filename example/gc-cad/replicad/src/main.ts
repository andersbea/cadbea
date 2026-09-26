import opencascade from 'replicad-opencascadejs'
import { setOC } from 'replicad'
import { syncGeometries } from 'replicad-threejs-helper'
import type * as THREE from 'three'
import { createViewer, addThreeGeometry } from 'cadbea'
import type { CadbeaViewer } from 'cadbea'
import { buildEnclosure } from './model/enclosure'
import { LAYOUT } from './model/hardware'

declare global {
  interface Window {
    __cadbeaViewer: CadbeaViewer
  }
}

const status = document.getElementById('status')!
function setStatus(msg: string) { status.textContent = msg }

const EXPLODE_MM = 38  // how far the lid lifts in local Z (replicad Z = up)
const EXPLODE_MS = 550 // animation duration, interactive use only
let lidAnimation: number | undefined

function cancelLidAnimation() {
  if (lidAnimation !== undefined) cancelAnimationFrame(lidAnimation)
  lidAnimation = undefined
}

function animateLid(
  parts: THREE.Object3D[],
  targetZ: number,
) {
  const fromZ = parts[0].position.z
  const start = performance.now()
  const step = (now: number) => {
    const t = Math.min((now - start) / EXPLODE_MS, 1)
    const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t // ease in-out quad
    const z = fromZ + (targetZ - fromZ) * e
    for (const part of parts) part.position.z = z
    if (t < 1) lidAnimation = requestAnimationFrame(step)
    else lidAnimation = undefined
  }
  lidAnimation = requestAnimationFrame(step)
}

async function main() {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement
  const explodeBtn = document.getElementById('explode-btn') as HTMLButtonElement
  const sectionBtn = document.getElementById('section-btn') as HTMLButtonElement
  const selectionName = document.getElementById('selection-name') as HTMLDivElement
  const selectionContext = document.getElementById('selection-context') as HTMLDivElement
  const annotationNote = document.getElementById('annotation-note') as HTMLTextAreaElement
  const markBtn = document.getElementById('mark-btn') as HTMLButtonElement
  const clearSelectionBtn = document.getElementById('clear-selection-btn') as HTMLButtonElement
  const annotations = document.getElementById('annotations') as HTMLUListElement
  const partModeBtn = document.getElementById('part-mode-btn') as HTMLButtonElement
  const areaModeBtn = document.getElementById('area-mode-btn') as HTMLButtonElement
  const printFiles = document.getElementById('print-files') as HTMLDivElement
  const bridgeStatus = document.getElementById('bridge-status') as HTMLDivElement

  const query = new URLSearchParams(location.search)
  const reviewWebhook = query.get('reviewWebhook') ?? 'http://127.0.0.1:8787/review'
  const bridgeHealthUrl = query.get('bridgeHealthUrl') ?? undefined
  const viewer = createViewer(canvas, {
    reviewWebhook,
    bridgeHealthUrl,
    printBundle: {
      label: 'Download all print files',
      url: '/dist/print/node-wireless-tracker-v2-print-files.zip',
      fileName: 'node-wireless-tracker-v2-print-files.zip',
    },
  })
  viewer.renderPrintFiles(printFiles)

  function renderBridgeStatus(status: { state: string, url: string | null, checkedAt: string | null, error: string | null }) {
    const labels: Record<string, string> = {
      disabled: 'Bridge not configured',
      checking: 'Checking bridge…',
      connected: 'Bridge connected',
      disconnected: 'Bridge disconnected',
    }
    bridgeStatus.textContent = labels[status.state] ?? 'Bridge status unknown'
    bridgeStatus.dataset.state = status.state
    bridgeStatus.title = status.error
      ? `${status.error}${status.url ? ` · ${status.url}` : ''}`
      : status.url ?? 'Add ?reviewWebhook=… to connect a review bridge'
  }
  viewer.onBridgeStatusChange(renderBridgeStatus)

  function renderReviewPanel() {
    const selection = viewer.selection
    selectionName.textContent = selection
      ? selection.kind === 'area' ? 'Focused review area' : `Selected: ${selection.name}`
      : viewer.selectionMode === 'area' ? 'Drag around an area to select it' : 'Click a visible part to select it'
    selectionContext.textContent = selection
      ? selection.kind === 'area'
        ? `View region: ${(selection.rect.width * 100).toFixed(1)}% × ${(selection.rect.height * 100).toFixed(1)}% of the canvas`
        : `Part ID: ${selection.partId}${selection.point ? ` | hit: ${selection.point.map((value) => value.toFixed(2)).join(', ')}` : ''}`
      : 'Selected geometry will be highlighted and included in review context.'
    markBtn.disabled = !selection
    annotations.replaceChildren(...viewer.annotations.map((annotation) => {
      const item = document.createElement('li')
      const target = annotation.selection?.kind === 'area'
        ? 'focused view area'
        : annotation.selection?.name ?? 'general review'
      const label = document.createElement('strong')
      label.textContent = target
      item.append(label, document.createTextNode(`: ${annotation.note}`))
      item.title = `${annotation.id} · ${annotation.state ?? 'default'} state`
      return item
    }))
  }

  viewer.onSelectionChange(renderReviewPanel)
  viewer.onSelectionModeChange(renderReviewPanel)
  function setSelectionMode(mode: 'part' | 'area') {
    viewer.setSelectionMode(mode)
    partModeBtn.classList.toggle('active', mode === 'part')
    areaModeBtn.classList.toggle('active', mode === 'area')
    setStatus(mode === 'area' ? 'Area selection: drag over the region to review' : 'Part selection: click a visible part')
    renderReviewPanel()
  }
  partModeBtn.addEventListener('click', () => setSelectionMode('part'))
  areaModeBtn.addEventListener('click', () => setSelectionMode('area'))
  markBtn.addEventListener('click', () => {
    if (!viewer.selection) return
    const note = annotationNote.value.trim()
    if (!note) {
      annotationNote.focus()
      return
    }
    viewer.addAnnotation(note)
    annotationNote.value = ''
    renderReviewPanel()
    setStatus('Review mark saved for the AI')
  })
  clearSelectionBtn.addEventListener('click', () => viewer.clearSelection())
  renderReviewPanel()
  // replicad models are Z-up; rotate so three.js's Y-up matches the viewer's
  // camera/orbit conventions. cadbea measures whatever's actually in the
  // scene, so this is purely this project's concern.
  viewer.modelGroup.rotation.x = -Math.PI / 2

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

  const { faceMesh: bodyFace, edges: bodyEdges } = addThreeGeometry(viewer.modelGroup, bodyGeo, 0x2a6db5, 0.92, 'body')
  const { faceMesh: lidFace, edges: lidEdges } = addThreeGeometry(viewer.modelGroup, lidGeo, 0x3a8fd5, 0.92, 'lid')
  const { faceMesh: bodySectionFace, edges: bodySectionEdges } = addThreeGeometry(viewer.modelGroup, bodySectionGeo, 0x2a6db5, 0.92, 'body-section')
  const { faceMesh: lidSectionFace, edges: lidSectionEdges } = addThreeGeometry(viewer.modelGroup, lidSectionGeo, 0x3a8fd5, 0.92, 'lid-section')
  // Printed separately, slotted into the lid — bright/opaque so they read as
  // distinct parts, not part of the lid-shell/lid-skirt solid.
  const { faceMesh: prgBtnFace, edges: prgBtnEdges } = addThreeGeometry(viewer.modelGroup, prgBtnGeo, 0xffcc33, 1.0, 'lid-button-prg')
  const { faceMesh: rstBtnFace, edges: rstBtnEdges } = addThreeGeometry(viewer.modelGroup, rstBtnGeo, 0xffcc33, 1.0, 'lid-button-rst')
  addThreeGeometry(viewer.modelGroup, boardGeo, 0x44bb66, 0.25, 'board-ref')
  addThreeGeometry(viewer.modelGroup, battGeo, 0xffaa22, 0.25, 'battery-ref')
  addThreeGeometry(viewer.modelGroup, antGeo, 0xff4444, 0.60, 'antenna-ref')

  bodySectionFace.visible = false
  lidSectionFace.visible = false
  bodySectionEdges.visible = false
  lidSectionEdges.visible = false
  bodyEdges.name = 'body-edges'
  lidEdges.name = 'lid-edges'
  bodySectionEdges.name = 'body-section-edges'
  lidSectionEdges.name = 'lid-section-edges'

  // ── Exploded state ──────────────────────────────────────────────────────
  // `animate` is skipped when driven programmatically (cadbea states) so a
  // capture script gets the settled end-state on the very next render,
  // instead of needing to know this project's animation duration.
  // Buttons are physically slotted into the lid, so they move with it.
  const lidAndButtons = [lidFace, lidEdges, prgBtnFace, prgBtnEdges, rstBtnFace, rstBtnEdges]
  let exploded = false
  function setExploded(on: boolean, opts: { animate?: boolean } = {}) {
    cancelLidAnimation()
    exploded = on
    explodeBtn.classList.toggle('active', exploded)
    explodeBtn.textContent = exploded ? 'Assembled' : 'Exploded view'
    const targetZ = exploded ? EXPLODE_MM : 0
    if (opts.animate ?? true) animateLid(lidAndButtons, targetZ)
    else {
      for (const part of lidAndButtons) part.position.z = targetZ
    }
  }
  explodeBtn.addEventListener('click', () => {
    setSection(false)
    setExploded(!exploded)
  })

  // ── Section state — swaps full body/lid for the cutaway halves ─────────
  let sectioned = false
  function setSection(on: boolean) {
    if (on) setExploded(false, { animate: false })
    sectioned = on
    sectionBtn.classList.toggle('active', sectioned)
    sectionBtn.textContent = sectioned ? 'Full view' : 'Section view'
    bodyFace.visible = !sectioned
    bodyEdges.visible = !sectioned
    lidFace.visible = !sectioned
    lidEdges.visible = !sectioned
    bodySectionFace.visible = sectioned
    bodySectionEdges.visible = sectioned
    lidSectionFace.visible = sectioned
    lidSectionEdges.visible = sectioned
  }
  sectionBtn.addEventListener('click', () => setSection(!sectioned))

  viewer.states = {
    exploded: (on) => setExploded(on, { animate: false }),
    section: setSection,
  }
  viewer.setView('iso')
  viewer.ready = true
  window.__cadbeaViewer = viewer

  const { outL, outW, outH } = LAYOUT
  setStatus(`GC Node Enclosure v0.1 — Heltec Wireless Tracker V2 + EEMB 852040  |  ${outL} × ${outW} × ${outH} mm`)
}

main().catch((err) => {
  console.error(err)
  setStatus(`Error: ${String(err)}`)
})
