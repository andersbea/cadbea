/**
 * Generic three.js viewer bootstrap for reviewing a parametric CAD model —
 * no knowledge of any particular model's geometry or dimensions. A project
 * builds its model, adds meshes to `viewer.modelGroup`, then exposes the
 * returned viewer as `window.__cadbeaViewer` so capture.mjs / contact-sheet.mjs
 * can drive it. See ../README.md for the full contract.
 *
 * Requires `three` and (for controls) `three/addons/controls/OrbitControls.js`
 * as peer dependencies of the consuming project.
 */

import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { STLLoader } from 'three/addons/loaders/STLLoader.js'

/** @typedef {'iso'|'iso-back'|'front'|'back'|'left'|'right'|'top'|'bottom'} StandardView */

/** @type {StandardView[]} */
export const STANDARD_VIEWS = ['iso', 'iso-back', 'front', 'back', 'left', 'right', 'top', 'bottom']

// Unit direction (from the model's centre) for each standard view, in world
// space. Deliberately axis-aligned and model-agnostic — a project's own
// "front" (e.g. a USB-C face) may land on any of these depending on how it
// orients its model; that's fine, these names describe camera placement, not
// physical semantics. A project that wants a named view tied to a specific
// physical feature should add it as an project-specific extra view (see
// README) rather than relying on these labels meaning anything physical.
const VIEW_DIRECTIONS = {
  iso: new THREE.Vector3(1, 0.8, 1),
  'iso-back': new THREE.Vector3(-1, 0.8, -1),
  front: new THREE.Vector3(0, 0.35, 1),
  back: new THREE.Vector3(0, 0.35, -1),
  left: new THREE.Vector3(-1, 0.35, 0),
  right: new THREE.Vector3(1, 0.35, 0),
  // Slight off-axis nudge on top/bottom avoids OrbitControls gimbal lock
  // when the view direction is exactly parallel to its up vector.
  top: new THREE.Vector3(0, 1, 0.01),
  bottom: new THREE.Vector3(0, -1, 0.01),
}

/**
 * Bounding box of only the currently-visible meshes under `root`. Plain
 * THREE.Box3.setFromObject() includes hidden meshes too (e.g. a toggled-off
 * section-cut mesh sitting alongside the full assembly), which would frame
 * every view around the union of all states ever added instead of what's
 * actually on screen.
 * @param {THREE.Object3D} root
 */
export function visibleBoundingBox(root) {
  const box = new THREE.Box3()
  root.traverse((obj) => {
    if (obj.isMesh && obj.visible) box.expandByObject(obj)
  })
  if (box.isEmpty()) box.setFromCenterAndSize(new THREE.Vector3(), new THREE.Vector3(1, 1, 1))
  return box
}

/**
 * Welds vertices within `tolerance` and counts, per edge, how many triangles
 * reference it. A closed, manifold solid has every edge shared by exactly 2
 * triangles — 1 means a real gap (boundary edge), >2 means non-manifold
 * geometry. This is the deterministic check to reach for instead of judging
 * holes from a screenshot: a translucent material or an unlucky viewing
 * angle can make a real gap invisible, or make a perfectly watertight mesh
 * *look* like it has one (a flat-shaded triangle at a tessellation seam
 * between two independently-meshed B-Rep faces can render near-black and
 * read as a hole even though it's fully connected on both sides).
 * @param {THREE.BufferGeometry} geometry
 * @param {number} tolerance
 */
function checkGeometryWatertight(geometry, tolerance) {
  const pos = geometry.attributes.position
  const index = geometry.index

  const key = (x, y, z) => `${Math.round(x / tolerance)},${Math.round(y / tolerance)},${Math.round(z / tolerance)}`
  const vmap = new Map()
  const weldedId = new Int32Array(pos.count)
  for (let i = 0; i < pos.count; i++) {
    const k = key(pos.getX(i), pos.getY(i), pos.getZ(i))
    if (!vmap.has(k)) vmap.set(k, vmap.size)
    weldedId[i] = vmap.get(k)
  }

  const edgeCount = new Map()
  const addEdge = (a, b) => {
    const k = a < b ? `${a}_${b}` : `${b}_${a}`
    edgeCount.set(k, (edgeCount.get(k) || 0) + 1)
  }

  const triangleCount = index ? index.count / 3 : pos.count / 3
  const vertexAt = (t) => (index ? index.getX(t) : t)
  for (let t = 0; t < triangleCount; t++) {
    const a = weldedId[vertexAt(t * 3)]
    const b = weldedId[vertexAt(t * 3 + 1)]
    const c = weldedId[vertexAt(t * 3 + 2)]
    addEdge(a, b); addEdge(b, c); addEdge(c, a)
  }

  let boundaryEdges = 0
  let nonManifoldEdges = 0
  for (const count of edgeCount.values()) {
    if (count === 1) boundaryEdges++
    else if (count > 2) nonManifoldEdges++
  }

  return { triangleCount, boundaryEdges, nonManifoldEdges, watertight: boundaryEdges === 0 && nonManifoldEdges === 0 }
}

/**
 * Runs {@link checkGeometryWatertight} on every currently-visible mesh under
 * `root`. Name each mesh (`addThreeGeometry(..., name)`) so a failure is
 * actionable instead of an anonymous index.
 * @param {THREE.Object3D} root
 * @param {{ tolerance?: number }} [options]
 * @returns {Array<{ name: string, triangleCount: number, boundaryEdges: number, nonManifoldEdges: number, watertight: boolean }>}
 */
export function checkWatertight(root, options = {}) {
  const tolerance = options.tolerance ?? 1e-4
  const results = []
  root.traverse((obj) => {
    if (!obj.isMesh || !obj.visible) return
    results.push({ name: obj.name || '(unnamed)', ...checkGeometryWatertight(obj.geometry, tolerance) })
  })
  return results
}

/**
 * Camera position + orbit target for a standard view, framed to the given
 * bounding box.
 * @param {THREE.Box3} box
 * @param {StandardView} view
 */
export function computeStandardView(box, view) {
  const dir = VIEW_DIRECTIONS[view]
  if (!dir) throw new Error(`Unknown standard view "${view}". Known: ${STANDARD_VIEWS.join(', ')}`)
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  const diagonal = size.length() || 1
  const distance = diagonal * 1.5
  const position = center.clone().addScaledVector(dir.clone().normalize(), distance)
  return { position, target: center }
}

/** @typedef {'corner-tl'|'corner-tr'|'corner-bl'|'corner-br'} CornerView */

/** @type {CornerView[]} */
export const CORNER_VIEWS = ['corner-tl', 'corner-tr', 'corner-bl', 'corner-br']

/** @typedef {{ kind: 'part', partId: string, name: string, point?: [number, number, number], normal?: [number, number, number], faceIndex?: number }} PartSelection */
/** @typedef {{ dataUrl: string, width: number, height: number, crop: { x: number, y: number, width: number, height: number } }} ReviewSnapshot */
/** @typedef {{ kind: 'area', rect: { x: number, y: number, width: number, height: number }, screen: { width: number, height: number }, camera: { position: [number, number, number], target: [number, number, number] }, snapshot: ReviewSnapshot }} AreaSelection */
/** @typedef {PartSelection | AreaSelection} Selection */
/** @typedef {{ label: string, url: string, fileName?: string }} PrintFile */
/** @typedef {{ label: string, url: string, fileName?: string }} PrintBundle */
/** @typedef {{ id: string, note: string, selection: Selection | null, camera: { position: [number, number, number], target: [number, number, number] }, state: string | null, createdAt: string }} Annotation */

// [sign of X, sign of Z] for each of the box's 4 top vertices.
const CORNER_SIGNS = {
  'corner-tl': [-1, -1],
  'corner-tr': [1, -1],
  'corner-bl': [-1, 1],
  'corner-br': [1, 1],
}

/**
 * A close, elevated view looking down at one *top* corner of the bounding
 * box — for spotting a small defect (a gap, a tessellation artifact) that a
 * standard whole-model view is too coarse to show. This project's own
 * history is the reason this exists: a real corner defect was missed by
 * every standard view, and chasing it down needed a hand-aimed close-up
 * camera. Distance scales with the box's horizontal size, not its full
 * diagonal, so it stays a genuine close-up regardless of overall model size.
 * @param {THREE.Box3} box
 * @param {CornerView} corner
 */
export function computeCornerView(box, corner) {
  const signs = CORNER_SIGNS[corner]
  if (!signs) throw new Error(`Unknown corner view "${corner}". Known: ${CORNER_VIEWS.join(', ')}`)
  const [sx, sz] = signs
  const cornerPoint = new THREE.Vector3(
    sx > 0 ? box.max.x : box.min.x,
    box.max.y,
    sz > 0 ? box.max.z : box.min.z,
  )
  const size = box.getSize(new THREE.Vector3())
  const closeDistance = Math.max(Math.min(size.x, size.z) * 0.5, 1)
  // Steep (near-top-down, not a 3/4 iso-ish angle): a shallower elevation
  // hid a real defect at 2 of 4 corners in this project's own history —
  // some artifacts are only visible from close to directly above.
  const dir = new THREE.Vector3(sx * 0.35, 1, sz * 0.35).normalize()
  const position = cornerPoint.clone().addScaledVector(dir, closeDistance)
  // Look slightly past the corner (inward and down) so it sits inside the
  // frame instead of exactly at its edge.
  const inward = new THREE.Vector3(-sx, -0.4, -sz).normalize()
  const target = cornerPoint.clone().addScaledVector(inward, closeDistance * 0.25)
  return { position, target }
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ background?: number, grid?: boolean, reviewWebhook?: string, bridgeHealthUrl?: string, bridgePollIntervalMs?: number, printFiles?: PrintFile[], printBundle?: PrintBundle, cameraStorageKey?: string | false, stateStorageKey?: string | false, includeReviewSnapshots?: boolean }} [options]
 */
export function createViewer(canvas, options = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(options.background ?? 0x0f0f1a)

  const modelGroup = new THREE.Group()
  scene.add(modelGroup)

  const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 5000)
  camera.position.set(100, 80, 100)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.06
  controls.update()

  // Keep the reviewer's last orbit angle, zoom, and pan across refreshes.
  // Consumers can use a model/version-specific key or pass false to opt out.
  const cameraStorageKey = options.cameraStorageKey === false
    ? null
    : options.cameraStorageKey ?? `cadbea:camera:${location.pathname}`
  let savedCamera = null
  let cameraRestored = false
  if (cameraStorageKey) {
    try {
      const stored = localStorage.getItem(cameraStorageKey)
      if (stored) savedCamera = JSON.parse(stored)
    } catch {
      savedCamera = null
    }
  }
  const saveCamera = () => {
    if (!cameraStorageKey) return
    try {
      localStorage.setItem(cameraStorageKey, JSON.stringify({
        position: camera.position.toArray(),
        target: controls.target.toArray(),
        zoom: camera.zoom,
      }))
    } catch {
      // Storage can be disabled in private/embedded browser contexts.
    }
  }
  controls.addEventListener('change', saveCamera)

  // Keep the active named state (exploded/section/...) across refreshes too,
  // for the same reason as the camera above. States are consumer-registered
  // after createViewer() returns (`viewer.states = {...}`), so the restore
  // happens lazily the first time that assignment is observed — see the
  // `states` accessor defined on `viewer` below — once the saved name is
  // confirmed to still exist on the newly assigned states.
  const stateStorageKey = options.stateStorageKey === false
    ? null
    : options.stateStorageKey ?? `cadbea:state:${location.pathname}`
  let savedStateName = null
  if (stateStorageKey) {
    try {
      savedStateName = localStorage.getItem(stateStorageKey) || null
    } catch {
      savedStateName = null
    }
  }

  scene.add(new THREE.AmbientLight(0x8090c0, 0.5))

  const key = new THREE.DirectionalLight(0xffffff, 1.2)
  key.position.set(100, 200, 80)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  scene.add(key)

  const fill = new THREE.DirectionalLight(0x4060a0, 0.4)
  fill.position.set(-80, 40, -60)
  scene.add(fill)

  const rim = new THREE.DirectionalLight(0xffa040, 0.3)
  rim.position.set(0, -80, 120)
  scene.add(rim)

  if (options.grid !== false) {
    scene.add(new THREE.GridHelper(300, 30, 0x2a2a4a, 0x1e1e34))
  }

  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  const selectionListeners = new Set()
  const selectionModeListeners = new Set()
  let selectedObject = null
  let selectedObjects = new Set()
  let pointerDown = null
  let areaDrag = null
  let currentState = null
  let annotationNumber = 0
  let selectionMode = 'part'
  const bridgeStatusListeners = new Set()
  const bridgeHealthUrl = options.bridgeHealthUrl
    ?? (options.reviewWebhook?.replace(/\/review\/?$/, '/health'))
  let bridgeStatus = {
    state: bridgeHealthUrl ? 'checking' : 'disabled',
    url: bridgeHealthUrl ?? null,
    checkedAt: null,
    error: null,
  }
  let bridgePollTimer = null

  const selectionOverlay = document.createElement('div')
  selectionOverlay.className = 'cadbea-selection-rectangle'
  Object.assign(selectionOverlay.style, {
    display: 'none', position: 'fixed', pointerEvents: 'none', zIndex: '10',
    border: '1px solid #ffc857', background: 'rgba(255, 200, 87, 0.16)',
  })
  document.body.append(selectionOverlay)

  const setHighlighted = (object, highlighted) => {
    if (!object?.material) return
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of materials) {
      if (!material.emissive) continue
      if (highlighted) {
        material.userData.cadbeaPreviousEmissive = material.emissive.clone()
        material.userData.cadbeaPreviousEmissiveIntensity = material.emissiveIntensity
        material.emissive.set(0xffb000)
        material.emissiveIntensity = 0.65
      } else if (material.userData.cadbeaPreviousEmissive) {
        material.emissive.copy(material.userData.cadbeaPreviousEmissive)
        material.emissiveIntensity = material.userData.cadbeaPreviousEmissiveIntensity
        delete material.userData.cadbeaPreviousEmissive
        delete material.userData.cadbeaPreviousEmissiveIntensity
      }
    }
  }

  const notifySelection = (selection) => {
    for (const listener of selectionListeners) listener(selection)
  }

  const cameraSnapshot = () => ({
    position: /** @type {[number, number, number]} */ (camera.position.toArray()),
    target: /** @type {[number, number, number]} */ (controls.target.toArray()),
  })

  const clearHighlights = () => {
    for (const object of selectedObjects) setHighlighted(object, false)
    selectedObjects = new Set()
    selectedObject = null
  }

  const highlightObjects = (objects) => {
    clearHighlights()
    selectedObjects = new Set(objects)
    for (const object of selectedObjects) setHighlighted(object, true)
    selectedObject = objects[0] ?? null
  }

  const setSelectionMode = (mode) => {
    if (mode !== 'part' && mode !== 'area') throw new Error(`Unknown selection mode "${mode}"`)
    selectionMode = mode
    controls.enabled = mode === 'part'
    for (const listener of selectionModeListeners) listener(mode)
    emitReviewEvent('selection-mode-changed', { mode })
    return mode
  }

  /**
   * Emits a structured browser-console event and optionally POSTs it to a
   * consumer-owned local webhook. Browser automation can listen for the
   * `[cadbea]` console prefix without requiring a server endpoint.
   */
  const emitReviewEvent = (type, data = {}) => {
    const event = {
      source: 'cadbea',
      type,
      createdAt: new Date().toISOString(),
      ...data,
      review: viewer.getReviewState(),
    }
    console.info(`[cadbea] ${JSON.stringify(event)}`)
    window.dispatchEvent(new CustomEvent('cadbea-review', { detail: event }))
    if (options.reviewWebhook) {
      const body = JSON.stringify(event)
      fetch(options.reviewWebhook, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        // Chromium limits keepalive request bodies to a small size. Area
        // snapshots are intentionally larger, so let those requests finish
        // normally while the page remains open.
        keepalive: body.length < 60_000,
      }).catch((error) => console.warn(`[cadbea] webhook failed: ${error.message}`))
    }
  }

  const notifyBridgeStatus = (next) => {
    bridgeStatus = { ...bridgeStatus, ...next }
    if (typeof viewer !== 'undefined') viewer.bridgeStatus = { ...bridgeStatus }
    for (const listener of bridgeStatusListeners) listener({ ...bridgeStatus })
  }

  const checkBridge = async () => {
    if (!bridgeHealthUrl) {
      notifyBridgeStatus({ state: 'disabled', checkedAt: new Date().toISOString(), error: null })
      return { ...bridgeStatus }
    }
    notifyBridgeStatus({ state: 'checking', error: null })
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2500)
    try {
      const response = await fetch(bridgeHealthUrl, { cache: 'no-store', signal: controller.signal })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || payload.ok !== true) throw new Error(`health check returned HTTP ${response.status}`)
      notifyBridgeStatus({ state: 'connected', checkedAt: new Date().toISOString(), error: null })
    } catch (error) {
      notifyBridgeStatus({
        state: 'disconnected',
        checkedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      clearTimeout(timeout)
    }
    return { ...bridgeStatus }
  }

  const tick = () => {
    requestAnimationFrame(tick)
    controls.update()
    renderer.render(scene, camera)
  }
  tick()

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  })

  const viewer = {
    scene,
    camera,
    controls,
    renderer,
    modelGroup,
    /** @type {Record<string, (on: boolean) => void>} */
    states: {},
    ready: false,
    /** @type {Selection | null} */
    selection: null,
    /** @type {Annotation[]} */
    annotations: [],
    bridgeStatus: { ...bridgeStatus },
    /** @type {PrintFile[]} */
    printFiles: options.printFiles ?? [],
    printBundle: options.printBundle ?? null,
    selectionMode,
    render() {
      renderer.render(scene, camera)
    },
    /** @param {StandardView | CornerView} view */
    setView(view) {
      if (!cameraRestored && savedCamera?.position && savedCamera?.target) {
        camera.position.fromArray(savedCamera.position)
        controls.target.fromArray(savedCamera.target)
        if (Number.isFinite(savedCamera.zoom)) camera.zoom = savedCamera.zoom
        camera.updateProjectionMatrix()
        controls.update()
        cameraRestored = true
        return
      }
      const box = visibleBoundingBox(modelGroup)
      const { position, target } = CORNER_VIEWS.includes(view)
        ? computeCornerView(box, view)
        : computeStandardView(box, view)
      camera.position.copy(position)
      controls.target.copy(target)
      controls.update()
      cameraRestored = true
    },
    /** Turns one named state on and every other declared state off. */
    setState(name) {
      // `this.states`, not a closed-over variable — a project typically
      // assigns `viewer.states = {...}` after createViewer() returns, which
      // replaces this property with a new object.
      for (const [key, fn] of Object.entries(this.states)) fn(key === name)
      currentState = name
      if (stateStorageKey) {
        try {
          if (name) localStorage.setItem(stateStorageKey, name)
          else localStorage.removeItem(stateStorageKey)
        } catch {
          // Storage can be disabled in private/embedded browser contexts.
        }
      }
      emitReviewEvent('state-changed', { state: name })
    },
    setSelectionMode(mode) {
      const result = setSelectionMode(mode)
      this.selectionMode = result
      return result
    },
    onSelectionModeChange(listener) {
      selectionModeListeners.add(listener)
      return () => selectionModeListeners.delete(listener)
    },
    /** Return the latest bridge health state. */
    getBridgeStatus() {
      return { ...bridgeStatus }
    },
    /** Check the configured review bridge immediately. */
    checkBridge,
    /** Subscribe to bridge health changes. */
    onBridgeStatusChange(listener) {
      bridgeStatusListeners.add(listener)
      listener({ ...bridgeStatus })
      return () => bridgeStatusListeners.delete(listener)
    },
    /** Select a named mesh part and return its AI-readable selection context. */
    selectPart(partId) {
      let object = null
      modelGroup.traverse((candidate) => {
        if (!object && candidate.isMesh && candidate.userData.cadbeaPart?.id === partId) object = candidate
      })
      if (!object) throw new Error(`Unknown selectable part "${partId}"`)
      highlightObjects([object])
      selectionOverlay.style.display = 'none'
      this.selection = { kind: 'part', partId, name: object.userData.cadbeaPart.name }
      notifySelection(this.selection)
      emitReviewEvent('selection-changed', { selection: this.selection })
      return this.selection
    },
    /** Clear the current selected part. */
    clearSelection() {
      clearHighlights()
      this.selection = null
      selectionOverlay.style.display = 'none'
      notifySelection(null)
      emitReviewEvent('selection-cleared')
    },
    /** Subscribe to clicks or programmatic selection changes. */
    onSelectionChange(listener) {
      selectionListeners.add(listener)
      return () => selectionListeners.delete(listener)
    },
    /** Select a normalized canvas rectangle (origin top-left) and report intersecting parts. */
    selectArea(rect) {
      const normalized = {
        x: Math.max(0, Math.min(1, rect.x)),
        y: Math.max(0, Math.min(1, rect.y)),
        width: Math.max(0, Math.min(1 - rect.x, rect.width)),
        height: Math.max(0, Math.min(1 - rect.y, rect.height)),
      }
      // An area is a visual focus for the AI, not a semantic part selection.
      // Clear any previous part highlight, but do not infer or expose parts
      // merely because their projected bounds overlap the review rectangle.
      clearHighlights()
      renderer.render(scene, camera)
      this.selection = {
        kind: 'area', rect: normalized,
        screen: { width: canvas.clientWidth, height: canvas.clientHeight },
        camera: cameraSnapshot(),
        snapshot: {
          dataUrl: options.includeReviewSnapshots === false ? '' : canvas.toDataURL('image/png'),
          width: canvas.width,
          height: canvas.height,
          crop: {
            x: normalized.x * canvas.width,
            y: normalized.y * canvas.height,
            width: normalized.width * canvas.width,
            height: normalized.height * canvas.height,
          },
        },
      }
      const canvasRect = canvas.getBoundingClientRect()
      Object.assign(selectionOverlay.style, {
        display: 'block',
        left: `${canvasRect.left + normalized.x * canvasRect.width}px`,
        top: `${canvasRect.top + normalized.y * canvasRect.height}px`,
        width: `${normalized.width * canvasRect.width}px`,
        height: `${normalized.height * canvasRect.height}px`,
      })
      notifySelection(this.selection)
      emitReviewEvent('area-selected', { selection: this.selection })
      return this.selection
    },
    /** Save a note with the current selection and review camera. */
    addAnnotation(note) {
      const text = String(note ?? '').trim()
      if (!text) throw new Error('Annotation note cannot be empty')
      const annotation = {
        id: `annotation-${++annotationNumber}`,
        note: text,
        selection: this.selection ? structuredClone(this.selection) : null,
        camera: cameraSnapshot(),
        state: currentState,
        createdAt: new Date().toISOString(),
      }
      this.annotations.push(annotation)
      emitReviewEvent('annotation-added', { annotation })
      return annotation
    },
    removeAnnotation(id) {
      this.annotations = this.annotations.filter((annotation) => annotation.id !== id)
      emitReviewEvent('annotation-removed', { annotationId: id })
    },
    clearAnnotations() {
      this.annotations = []
      emitReviewEvent('annotations-cleared')
    },
    /** Return a serializable review state for an AI tool or persistence layer. */
    getReviewState() {
      return {
        selection: this.selection ? structuredClone(this.selection) : null,
        annotations: structuredClone(this.annotations),
        camera: {
          position: this.camera.position.toArray(),
          target: this.controls.target.toArray(),
        },
        state: currentState,
        selectionMode,
      }
    },
    /** Render the consumer-provided printable files into an application-owned panel. */
    renderPrintFiles(container) {
      container.replaceChildren()
      const heading = document.createElement('h3')
      heading.textContent = '3D print files (STL)'
      container.append(heading)
      const bundle = options.printBundle
      const link = document.createElement('a')
      link.className = 'cadbea-download-all'
      link.href = bundle?.url ?? '#'
      link.download = bundle?.fileName ?? ''
      link.title = bundle ? 'Download all printable model files' : 'Download all printable model files individually'
      const icon = document.createElement('span')
      icon.setAttribute('aria-hidden', 'true')
      icon.textContent = '⇩'
      link.append(icon, document.createTextNode(` ${bundle?.label ?? 'Download all print files'}`))
      if (!bundle) {
        link.removeAttribute('download')
        link.addEventListener('click', (event) => {
          event.preventDefault()
          for (const file of this.printFiles) {
            const fileLink = document.createElement('a')
            fileLink.href = file.url
            fileLink.download = file.fileName ?? ''
            fileLink.click()
          }
        })
      }
      container.append(link)
    },
    /** @param {{ tolerance?: number }} [options] */
    checkGeometry(options) {
      return checkWatertight(modelGroup, options)
    },
  }

  // A consumer typically assigns `viewer.states = {...}` once, after
  // createViewer() returns and its model/states are ready. Intercept that
  // assignment to restore a saved state the same way setView() lazily
  // restores a saved camera — but only once, and only if the saved name is
  // still a key the consumer actually registered (a different model/example
  // reusing the same storage key may not declare it).
  let statesValue = viewer.states
  let stateRestoreAttempted = false
  Object.defineProperty(viewer, 'states', {
    enumerable: true,
    configurable: true,
    get() {
      return statesValue
    },
    set(value) {
      statesValue = value
      if (stateRestoreAttempted || !savedStateName) return
      if (Object.prototype.hasOwnProperty.call(value, savedStateName)) {
        stateRestoreAttempted = true
        viewer.setState(savedStateName)
      }
    },
  })

  if (bridgeHealthUrl) {
    checkBridge()
    const interval = Math.max(1000, options.bridgePollIntervalMs ?? 5000)
    bridgePollTimer = setInterval(checkBridge, interval)
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (selectionMode === 'area' && event.button === 0) {
      const rect = canvas.getBoundingClientRect()
      areaDrag = { x: event.clientX - rect.left, y: event.clientY - rect.top, endX: event.clientX - rect.left, endY: event.clientY - rect.top, width: 0, height: 0 }
      controls.enabled = false
      canvas.setPointerCapture(event.pointerId)
      return
    }
    pointerDown = { x: event.clientX, y: event.clientY }
  })
  canvas.addEventListener('pointermove', (event) => {
    if (!areaDrag) return
    const rect = canvas.getBoundingClientRect()
    const endX = Math.max(0, Math.min(rect.width, event.clientX - rect.left))
    const endY = Math.max(0, Math.min(rect.height, event.clientY - rect.top))
    areaDrag.endX = endX
    areaDrag.endY = endY
    const x = Math.min(areaDrag.x, endX)
    const y = Math.min(areaDrag.y, endY)
    areaDrag.width = Math.abs(endX - areaDrag.x)
    areaDrag.height = Math.abs(endY - areaDrag.y)
    Object.assign(selectionOverlay.style, {
      display: 'block', left: `${rect.left + x}px`, top: `${rect.top + y}px`,
      width: `${areaDrag.width}px`, height: `${areaDrag.height}px`,
    })
  })
  canvas.addEventListener('pointerup', (event) => {
    if (areaDrag) {
      const drag = areaDrag
      areaDrag = null
      selectionOverlay.style.display = 'none'
      if (drag.width >= 4 && drag.height >= 4) {
        const rect = canvas.getBoundingClientRect()
        viewer.selectArea({
          x: Math.min(drag.x, drag.endX) / rect.width,
          y: Math.min(drag.y, drag.endY) / rect.height,
          width: drag.width / rect.width,
          height: drag.height / rect.height,
        })
      } else viewer.clearSelection()
      return
    }
    if (!pointerDown || Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) > 5) {
      pointerDown = null
      return
    }
    pointerDown = null
    const rect = canvas.getBoundingClientRect()
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    )
    raycaster.setFromCamera(pointer, camera)
    const hit = raycaster.intersectObjects(modelGroup.children, true)
      .find((intersection) => intersection.object.visible && intersection.object.userData.cadbeaPart)
    if (!hit) {
      viewer.clearSelection()
      return
    }
    const part = hit.object.userData.cadbeaPart
    highlightObjects([hit.object])
    selectionOverlay.style.display = 'none'
    viewer.selection = {
      kind: 'part',
      partId: part.id,
      name: part.name,
      point: /** @type {[number, number, number]} */ (hit.point.toArray()),
      faceIndex: hit.faceIndex ?? undefined,
    }
    notifySelection(viewer.selection)
    emitReviewEvent('selection-changed', { selection: viewer.selection })
  })

  return viewer
}

/**
 * Adds a replicad/three.js mesh (faces + edges) to a group and returns both,
 * so the caller can toggle visibility or drive an animation (e.g. exploding).
 * @param {THREE.Group} group
 * @param {{ faces: THREE.BufferGeometry, lines: THREE.BufferGeometry }} geo
 * @param {number} [color]
 * @param {number} [opacity]
 * @param {string} [name] - identifies this part in checkGeometry() results; use your PARTS.md/naming-registry name
 */
export function addThreeGeometry(group, geo, color = 0x3a7bd5, opacity = 0.92, name = '') {
  const faceMat = new THREE.MeshPhongMaterial({
    color,
    specular: 0x224488,
    shininess: 60,
    side: THREE.DoubleSide,
    transparent: true,
    opacity,
  })
  // CAD kernels tessellate each B-Rep face independently, so vertices at a
  // shared edge between two faces are duplicated rather than shared — flat
  // per-triangle normals at that seam can then point every which way, and a
  // triangle whose normal happens to face away from every light renders
  // near-black. That reads as a hole even on a fully watertight mesh (this
  // one was verified watertight: 0 boundary/non-manifold edges). Welding
  // near-coincident vertices before computing normals lets normals average
  // across the seam instead, for smooth (not flat-faceted) shading there.
  mergeVertices(geo.faces)
  geo.faces.computeVertexNormals()
  const faceMesh = new THREE.Mesh(geo.faces, faceMat)
  faceMesh.name = name
  faceMesh.userData.cadbeaPart = { id: name || '(unnamed)', name: name || '(unnamed)' }
  faceMesh.castShadow = true
  faceMesh.receiveShadow = true
  group.add(faceMesh)

  const edgeMat = new THREE.LineBasicMaterial({ color: 0x6090e0 })
  const edges = new THREE.LineSegments(geo.lines, edgeMat)
  group.add(edges)

  return { faceMesh, edges }
}

const gltfLoader = new GLTFLoader()
const stlLoader = new STLLoader()

/** Appends `-2`, `-3`, ... until `base` doesn't collide with an existing named part under `group`. */
function uniquePartName(group, base) {
  const existing = new Set()
  group.traverse((obj) => {
    if (obj.userData?.cadbeaPart) existing.add(obj.userData.cadbeaPart.name)
  })
  if (!existing.has(base)) return base
  let n = 2
  while (existing.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

/**
 * Tags and adds an already-built mesh the same way addThreeGeometry() does
 * (selectable, named, covered by checkGeometry()), deriving edge lines from
 * its own geometry so a loaded file matches the replicad-sourced visual
 * style. Reparents with `attach()` (not `add()`) when the mesh already has a
 * parent (e.g. a glTF scene graph node), which preserves its world transform
 * instead of resetting it to the group's origin.
 * @param {THREE.Group} group
 * @param {THREE.Mesh} mesh
 * @param {string} name
 */
function wrapLoadedMesh(group, mesh, name) {
  if (!mesh.geometry.attributes.normal) mesh.geometry.computeVertexNormals()
  mesh.userData.cadbeaPart = { id: name, name }
  mesh.name = name
  mesh.castShadow = true
  mesh.receiveShadow = true
  if (mesh.parent) group.attach(mesh)
  else group.add(mesh)
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry, 15),
    new THREE.LineBasicMaterial({ color: 0x6090e0 }),
  )
  mesh.add(edges)
  return { faceMesh: mesh, edges, name }
}

/**
 * Loads a single exported model file (glTF/GLB or STL) into
 * `viewer.modelGroup`, for reviewing an already-exported model with no
 * project-specific build script — the counterpart to addThreeGeometry() for
 * consumers that don't generate geometry themselves. Frame the camera to the
 * result with `viewer.setView('iso')` after loading (left to the caller,
 * which knows when a whole batch of dropped files is done).
 *
 * STEP is deliberately not supported here — it needs an OpenCascade/wasm
 * importer (e.g. occt-import-js), a much heavier dependency than this
 * generic loader is meant to carry.
 * @param {File} file
 * @param {ReturnType<typeof createViewer>} viewer
 * @param {{ color?: number, opacity?: number }} [options]
 * @returns {Promise<Array<{ faceMesh: THREE.Mesh, edges: THREE.LineSegments, name: string }>>}
 */
export async function loadModelFile(file, viewer, options = {}) {
  const ext = file.name.split('.').pop()?.toLowerCase()
  const baseName = file.name.replace(/\.[^./]+$/, '') || file.name
  const buffer = await file.arrayBuffer()
  const group = viewer.modelGroup

  if (ext === 'stl') {
    const geometry = stlLoader.parse(buffer)
    const material = new THREE.MeshPhongMaterial({
      color: options.color ?? 0x3a7bd5,
      specular: 0x224488,
      shininess: 60,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: options.opacity ?? 0.92,
    })
    const mesh = new THREE.Mesh(geometry, material)
    return [wrapLoadedMesh(group, mesh, uniquePartName(group, baseName))]
  }

  if (ext === 'gltf' || ext === 'glb') {
    const gltf = await new Promise((resolve, reject) => {
      gltfLoader.parse(buffer, '', resolve, reject)
    })
    const meshes = []
    gltf.scene.traverse((obj) => {
      if (obj.isMesh) meshes.push(obj)
    })
    if (meshes.length === 0) throw new Error(`"${file.name}" contains no meshes`)
    return meshes.map((mesh, i) => {
      const base = meshes.length > 1 ? `${baseName}-${mesh.name || i + 1}` : baseName
      return wrapLoadedMesh(group, mesh, uniquePartName(group, base))
    })
  }

  throw new Error(`Unsupported model file type ".${ext ?? ''}" — cadbea currently loads .glb, .gltf, and .stl`)
}
