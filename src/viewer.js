/**
 * Generic three.js viewer bootstrap for reviewing a parametric CAD model —
 * no knowledge of any particular model's geometry or dimensions. A project
 * builds its model, adds meshes to `viewer.modelGroup`, then exposes the
 * returned viewer as `window.__aiCadViewer` so capture.mjs / contact-sheet.mjs
 * can drive it. See ../README.md for the full contract.
 *
 * Requires `three` and (for controls) `three/addons/controls/OrbitControls.js`
 * as peer dependencies of the consuming project.
 */

import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

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

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ background?: number, grid?: boolean }} [options]
 */
export function createViewer(canvas, options = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
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
    render() {
      renderer.render(scene, camera)
    },
    /** @param {StandardView} view */
    setView(view) {
      const box = visibleBoundingBox(modelGroup)
      const { position, target } = computeStandardView(box, view)
      camera.position.copy(position)
      controls.target.copy(target)
      controls.update()
    },
    /** Turns one named state on and every other declared state off. */
    setState(name) {
      // `this.states`, not a closed-over variable — a project typically
      // assigns `viewer.states = {...}` after createViewer() returns, which
      // replaces this property with a new object.
      for (const [key, fn] of Object.entries(this.states)) fn(key === name)
    },
  }

  return viewer
}

/**
 * Adds a replicad/three.js mesh (faces + edges) to a group and returns both,
 * so the caller can toggle visibility or drive an animation (e.g. exploding).
 * @param {THREE.Group} group
 * @param {{ faces: THREE.BufferGeometry, lines: THREE.BufferGeometry }} geo
 */
export function addThreeGeometry(group, geo, color = 0x3a7bd5, opacity = 0.92) {
  const faceMat = new THREE.MeshPhongMaterial({
    color,
    specular: 0x224488,
    shininess: 60,
    side: THREE.DoubleSide,
    transparent: true,
    opacity,
  })
  const faceMesh = new THREE.Mesh(geo.faces, faceMat)
  faceMesh.castShadow = true
  faceMesh.receiveShadow = true
  group.add(faceMesh)

  const edgeMat = new THREE.LineBasicMaterial({ color: 0x6090e0 })
  const edges = new THREE.LineSegments(geo.lines, edgeMat)
  group.add(edges)

  return { faceMesh, edges }
}
