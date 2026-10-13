import { useEffect, useState } from 'react'
import { Panel } from './components/Panel.jsx'
import { Button } from './components/Button.jsx'
import { Field } from './components/Field.jsx'

/**
 * The AI review chrome: current selection, an annotation note field, and
 * the annotation list. The selection-mode toggle and print-files download
 * now live in the toolbar (`SelectionModeToggle`/`DownloadPrintFilesButton`,
 * rendered by `CadbeaApp`) instead of here, so they're available regardless
 * of whether this panel is scrolled out of view. Subscribes to the viewer's
 * own selection events, so it stays in sync whether the user clicked a part
 * or an AI tool drove the selection programmatically.
 * @param {{ viewer: import('../viewer.js').createViewer extends (...args: any) => infer R ? R : never, title?: string }} props
 */
export function ReviewPanel({ viewer, title = 'AI Review' }) {
  const [selection, setSelection] = useState(viewer.selection)
  const [selectionMode, setSelectionMode] = useState(viewer.selectionMode)
  const [annotations, setAnnotations] = useState(viewer.annotations)
  const [note, setNote] = useState('')

  useEffect(() => viewer.onSelectionChange(setSelection), [viewer])
  useEffect(() => viewer.onSelectionModeChange(setSelectionMode), [viewer])

  const selectionName = selection
    ? selection.kind === 'area'
      ? 'Focused review area'
      : `Selected: ${selection.name}`
    : selectionMode === 'area'
      ? 'Drag around an area to select it'
      : 'Click a visible part to select it'

  const selectionContext = selection
    ? selection.kind === 'area'
      ? `View region: ${(selection.rect.width * 100).toFixed(1)}% × ${(selection.rect.height * 100).toFixed(1)}% of the canvas`
      : `Part ID: ${selection.partId}${selection.point ? ` | hit: ${selection.point.map((v) => v.toFixed(2)).join(', ')}` : ''}`
    : 'Selected geometry will be highlighted and included in review context.'

  return (
    <Panel title={title} className="cadbea-review-panel">
      <div className="cadbea-selection-name">{selectionName}</div>
      <div className="cadbea-selection-context">{selectionContext}</div>
      <Field
        label="Note"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="What should the AI look at here?"
      />
      <div className="cadbea-review-actions">
        <Button
          variant="primary"
          disabled={!selection}
          onClick={() => {
            const text = note.trim()
            if (!text) return
            viewer.addAnnotation(text)
            setNote('')
            setAnnotations([...viewer.annotations])
          }}
        >
          Mark for AI
        </Button>
        <Button variant="ghost" onClick={() => viewer.clearSelection()}>Clear selection</Button>
      </div>
      <ul className="cadbea-annotations">
        {annotations.map((annotation) => {
          const target = annotation.selection?.kind === 'area'
            ? 'focused view area'
            : annotation.selection?.name ?? 'general review'
          return (
            <li key={annotation.id} title={`${annotation.id} · ${annotation.state ?? 'default'} state`}>
              <strong>{target}</strong>: {annotation.note}
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}
