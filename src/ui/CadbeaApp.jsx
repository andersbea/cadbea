import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createViewer } from '../viewer.js'
import { ThemeProvider } from './theme/ThemeProvider.jsx'
import { ThemeToggle } from './theme/ThemeToggle.jsx'
import { ThemeSceneSync } from './theme/ThemeSceneSync.jsx'
import { Topbar } from './Topbar.jsx'
import { ReviewPanel } from './ReviewPanel.jsx'
import { ModelLoader } from './ModelLoader.jsx'
import { SelectionModeToggle } from './SelectionModeToggle.jsx'
import { DownloadPrintFilesButton } from './DownloadPrintFilesButton.jsx'
import './style.css'

/**
 * The shared review chrome. Two integration patterns:
 *
 * - Turnkey: no `viewer` prop — creates its own canvas + `createViewer()`
 *   and shows the generic model loader, for reviewing any exported file with
 *   no project code (see `mountCadbeaApp()` below for the zero-code form).
 * - Embedded: pass an already-created `viewer` (and have already built its
 *   model via `addThreeGeometry()`) — renders the chrome only, around a
 *   canvas the consumer owns. The model loader is hidden by default since a
 *   model already exists; pass `showLoader` to override.
 *
 * `window.__cadbeaViewer` is set either way. `viewer.ready` is only set
 * automatically for the turnkey path — an embedded viewer's `ready` means
 * "the consumer's own model finished building," which only the consumer
 * knows, exactly as a hand-wired `main.ts` sets it today. capture.mjs/check.mjs
 * wait on that flag regardless of which pattern a project uses.
 * @param {{ viewer?: ReturnType<typeof createViewer>, viewerOptions?: Parameters<typeof createViewer>[1], title?: string, status?: string, showLoader?: boolean, children?: import('react').ReactNode }} props
 */
export function CadbeaApp({ viewer: providedViewer, viewerOptions, title = 'AI Review', status, showLoader, children }) {
  const canvasRef = useRef(null)
  const [ownViewer, setOwnViewer] = useState(null)
  const [bridgeStatus, setBridgeStatus] = useState(null)
  const viewer = providedViewer ?? ownViewer

  useEffect(() => {
    if (providedViewer) {
      window.__cadbeaViewer = providedViewer
      return
    }
    const created = createViewer(canvasRef.current, viewerOptions)
    created.ready = true
    window.__cadbeaViewer = created
    setOwnViewer(created)
    // viewerOptions is only read on first mount — recreating the viewer on
    // every options-object identity change would drop the live scene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providedViewer])

  useEffect(() => {
    if (!viewer) return undefined
    return viewer.onBridgeStatusChange(setBridgeStatus)
  }, [viewer])

  if (!viewer) return <div className="cadbea-app"><canvas ref={canvasRef} /></div>

  const shouldShowLoader = showLoader ?? !providedViewer

  return (
    <ThemeProvider>
      <ThemeSceneSync viewer={viewer} />
      <div className="cadbea-app">
        {!providedViewer ? <canvas ref={canvasRef} /> : null}
        <Topbar status={status} bridgeStatus={bridgeStatus}>
          <SelectionModeToggle viewer={viewer} />
          {children}
          <DownloadPrintFilesButton viewer={viewer} />
          <ThemeToggle />
        </Topbar>
        <ReviewPanel viewer={viewer} title={title} />
        {shouldShowLoader ? <ModelLoader viewer={viewer} /> : null}
      </div>
    </ThemeProvider>
  )
}

/**
 * Zero-code turnkey mount: `mountCadbeaApp(document.getElementById('root'))`
 * is the entire integration for reviewing an exported model with no project
 * code at all.
 * @param {HTMLElement} container
 * @param {Parameters<typeof CadbeaApp>[0]} [props]
 */
export function mountCadbeaApp(container, props = {}) {
  const root = createRoot(container)
  root.render(<CadbeaApp {...props} />)
  return root
}
