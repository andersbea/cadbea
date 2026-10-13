import { useRef, useState } from 'react'
import { loadModelFile } from '../viewer.js'
import { Button } from './components/Button.jsx'

/**
 * Drag-and-drop (plus a real file input, so it stays keyboard-accessible and
 * Playwright-testable via `setInputFiles`) loader for reviewing an
 * already-exported model with zero project code. Supports .glb/.gltf/.stl —
 * see `loadModelFile()` in the engine for format details and limitations.
 * @param {{ viewer: import('../viewer.js').createViewer extends (...args: any) => infer R ? R : never }} props
 */
export function ModelLoader({ viewer }) {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const loadFiles = async (fileList) => {
    setError(null)
    setBusy(true)
    try {
      for (const file of fileList) {
        // eslint-disable-next-line no-await-in-loop -- files are added in drop order, not in parallel
        await loadModelFile(file, viewer)
      }
      viewer.setView('iso')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="cadbea-loader">
      <div
        className="cadbea-loader__dropzone"
        data-dragover={dragOver || undefined}
        onDragOver={(event) => {
          event.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragOver(false)
          if (event.dataTransfer.files.length) loadFiles(event.dataTransfer.files)
        }}
      >
        <p>Drag a .glb, .gltf, or .stl file here</p>
        <Button variant="primary" onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? 'Loading…' : 'Choose a file'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".glb,.gltf,.stl"
          onChange={(event) => {
            if (event.target.files?.length) loadFiles(event.target.files)
            event.target.value = ''
          }}
        />
        {error ? <div className="cadbea-loader__error">{error}</div> : null}
      </div>
    </div>
  )
}
