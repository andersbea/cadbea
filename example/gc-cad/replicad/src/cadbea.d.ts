// cadbea (../../..) ships plain JS with JSDoc types, not a .d.ts, per
// its own README ("no TS build step yet"). This is the bridge until it gets
// one — move this into cadbea itself if/when it grows real TS tooling.
declare module 'cadbea' {
  import type * as THREE from 'three'
  import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

  export type StandardView = 'iso' | 'iso-back' | 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom'
  export const STANDARD_VIEWS: StandardView[]

  export type CornerView = 'corner-tl' | 'corner-tr' | 'corner-bl' | 'corner-br'
  export const CORNER_VIEWS: CornerView[]

  export interface CheckResult {
    name: string
    triangleCount: number
    boundaryEdges: number
    nonManifoldEdges: number
    watertight: boolean
  }

  export interface PartSelection {
    kind: 'part'
    partId: string
    name: string
    point?: [number, number, number]
    normal?: [number, number, number]
    faceIndex?: number
  }

  export interface AreaSelection {
    kind: 'area'
    rect: { x: number, y: number, width: number, height: number }
    screen: { width: number, height: number }
    camera: { position: [number, number, number], target: [number, number, number] }
    snapshot: { dataUrl: string; width: number; height: number; crop: { x: number; y: number; width: number; height: number } }
  }

  export type Selection = PartSelection | AreaSelection

  export interface PrintFile { label: string; url: string; fileName?: string }
  export interface PrintBundle { label: string; url: string; fileName?: string }

  export interface Annotation {
    id: string
    note: string
    selection: Selection | null
    camera: { position: [number, number, number], target: [number, number, number] }
    state: string | null
    createdAt: string
  }

  export interface BridgeStatus {
    state: 'disabled' | 'checking' | 'connected' | 'disconnected'
    url: string | null
    checkedAt: string | null
    error: string | null
  }

  export interface CadbeaViewer {
    scene: THREE.Scene
    camera: THREE.PerspectiveCamera
    controls: OrbitControls
    renderer: THREE.WebGLRenderer
    modelGroup: THREE.Group
    ready: boolean
    states: Record<string, (on: boolean) => void>
    selection: Selection | null
    annotations: Annotation[]
    printFiles: PrintFile[]
    printBundle: PrintBundle | null
    selectionMode: 'part' | 'area'
    bridgeStatus: BridgeStatus
    render(): void
    setView(view: StandardView | CornerView): void
    setState(name: string | null): void
    selectPart(partId: string): Selection
    clearSelection(): void
    selectArea(rect: { x: number, y: number, width: number, height: number }): Selection
    setSelectionMode(mode: 'part' | 'area'): 'part' | 'area'
    onSelectionChange(listener: (selection: Selection | null) => void): () => void
    onSelectionModeChange(listener: (mode: 'part' | 'area') => void): () => void
    getBridgeStatus(): BridgeStatus
    checkBridge(): Promise<BridgeStatus>
    onBridgeStatusChange(listener: (status: BridgeStatus) => void): () => void
    addAnnotation(note: string): Annotation
    removeAnnotation(id: string): void
    clearAnnotations(): void
    getReviewState(): {
      selection: Selection | null
      annotations: Annotation[]
      camera: { position: number[], target: number[] }
      state: string | null
      selectionMode: 'part' | 'area'
    }
    renderPrintFiles(container: HTMLElement): void
    checkGeometry(options?: { tolerance?: number }): CheckResult[]
  }

  export function createViewer(
    canvas: HTMLCanvasElement,
    options?: { background?: number; grid?: boolean; reviewWebhook?: string; bridgeHealthUrl?: string; bridgePollIntervalMs?: number; printFiles?: PrintFile[]; printBundle?: PrintBundle; cameraStorageKey?: string | false; stateStorageKey?: string | false; includeReviewSnapshots?: boolean },
  ): CadbeaViewer

  export function addThreeGeometry(
    group: THREE.Group,
    geo: { faces: THREE.BufferGeometry; lines: THREE.BufferGeometry },
    color?: number,
    opacity?: number,
    name?: string,
  ): { faceMesh: THREE.Mesh; edges: THREE.LineSegments }

  export function visibleBoundingBox(root: THREE.Object3D): THREE.Box3
  export function checkWatertight(root: THREE.Object3D, options?: { tolerance?: number }): CheckResult[]
  export function loadModelFile(
    file: File,
    viewer: CadbeaViewer,
    options?: { color?: number; opacity?: number },
  ): Promise<Array<{ faceMesh: THREE.Mesh; edges: THREE.LineSegments; name: string }>>
}

declare module 'cadbea/ui' {
  import type { ComponentType, ReactNode } from 'react'
  import type { Root } from 'react-dom/client'
  import type { CadbeaViewer } from 'cadbea'

  export const CadbeaApp: ComponentType<{
    viewer?: CadbeaViewer
    viewerOptions?: Record<string, unknown>
    title?: string
    status?: string
    showLoader?: boolean
    children?: ReactNode
  }>
  export function mountCadbeaApp(container: HTMLElement, props?: Record<string, unknown>): Root

  export const Topbar: ComponentType<{ status?: string; bridgeStatus?: unknown; children?: ReactNode }>
  export const StatesToolbar: ComponentType<{ viewer: CadbeaViewer }>
  export const ReviewPanel: ComponentType<{ viewer: CadbeaViewer; title?: string }>
  export const ModelLoader: ComponentType<{ viewer: CadbeaViewer }>
  export const SelectionModeToggle: ComponentType<{ viewer: CadbeaViewer }>
  export const DownloadPrintFilesButton: ComponentType<{ viewer: CadbeaViewer }>

  export const ThemeProvider: ComponentType<{ children?: ReactNode; defaultTheme?: string; storageKey?: string }>
  export function useTheme(): { theme: string; setTheme: (name: string) => void; themes: string[]; registerTheme: (name: string, tokens: Record<string, string>) => void }
  export const ThemeToggle: ComponentType<Record<string, never>>

  export const Button: ComponentType<{ as?: ComponentType | string; variant?: 'default' | 'primary' | 'ghost' | 'danger'; active?: boolean; className?: string; [prop: string]: unknown }>
  export const Panel: ComponentType<{ title?: string; className?: string; children?: ReactNode; [prop: string]: unknown }>
  export const Pill: ComponentType<{ state: string; className?: string; children?: ReactNode; [prop: string]: unknown }>
  export const Field: ComponentType<{ label?: string; as?: ComponentType | string; className?: string; [prop: string]: unknown }>
  export const ToggleButtonGroup: ComponentType<{
    value: string
    onChange: (value: string) => void
    options: { value: string; label: string; icon: ReactNode; title?: string; testId?: string }[]
    className?: string
  }>
}

declare module 'cadbea/ui/style.css'

declare module 'cadbea/bridge/vite-plugin' {
  import type { Plugin } from 'vite'

  /** Starts (or reuses an already-healthy) review bridge as a Vite dev-server plugin. */
  export function reviewBridgePlugin(): Plugin
}
