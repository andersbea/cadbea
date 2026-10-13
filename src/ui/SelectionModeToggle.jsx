import { useEffect, useState } from 'react'
import { ToggleButtonGroup } from './components/ToggleButtonGroup.jsx'
import { SelectPartIcon, SelectAreaIcon } from './icons.jsx'

/**
 * Part-click vs. area-drag selection mode, as a toolbar toggle — lives in
 * the topbar (via CadbeaApp) rather than inside the review panel, so it's
 * available regardless of whether that panel is scrolled out of view.
 * @param {{ viewer: import('../viewer.js').createViewer extends (...args: any) => infer R ? R : never }} props
 */
export function SelectionModeToggle({ viewer }) {
  const [mode, setMode] = useState(viewer.selectionMode)

  useEffect(() => viewer.onSelectionModeChange(setMode), [viewer])

  return (
    <ToggleButtonGroup
      value={mode}
      onChange={(value) => viewer.setSelectionMode(value)}
      options={[
        { value: 'part', label: 'Select part', icon: <SelectPartIcon />, title: 'Click a part to select it', testId: 'select-part-btn' },
        { value: 'area', label: 'Select area', icon: <SelectAreaIcon />, title: 'Drag to select a review area', testId: 'select-area-btn' },
      ]}
    />
  )
}
