import { useState } from 'react'
import { Button } from './components/Button.jsx'

/**
 * Renders one toggle button per key in `viewer.states`, calling
 * `viewer.setState()`. Covers the common case of a project with no
 * per-state animation; a project like an exploded-view lid that needs custom
 * animation timing should keep hand-authored buttons instead (passed as
 * `<CadbeaApp>` children) and skip this component.
 * @param {{ viewer: import('../viewer.js').createViewer extends (...args: any) => infer R ? R : never }} props
 */
export function StatesToolbar({ viewer }) {
  const [active, setActive] = useState(null)
  const names = Object.keys(viewer.states ?? {})
  if (names.length === 0) return null

  return names.map((name) => (
    <Button
      key={name}
      active={active === name}
      onClick={() => {
        const next = active === name ? null : name
        viewer.setState(next)
        setActive(next)
      }}
    >
      {name}
    </Button>
  ))
}
