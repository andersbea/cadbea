import { useEffect } from 'react'
import { Color } from 'three'
import { useTheme } from './ThemeProvider.jsx'

/**
 * Keeps the three.js scene's background color in step with the active
 * theme. The CSS tokens alone only repaint the chrome (cards, buttons,
 * pills) — the canvas has its own separate background
 * (`scene.background`, a plain THREE.Color set once at createViewer() time)
 * that CSS can't reach, so without this the viewport stays whatever color
 * it started as regardless of theme. Deferred to the next animation frame
 * so it reads `--cadbea-bg` *after* ThemeProvider (an ancestor, whose own
 * effect runs after this descendant's in the same commit) has applied the
 * new `data-theme` attribute, instead of racing it.
 * @param {{ viewer?: { scene?: { background?: unknown } } }} props
 */
export function ThemeSceneSync({ viewer }) {
  const { theme } = useTheme()

  useEffect(() => {
    if (!viewer?.scene) return undefined
    const frame = requestAnimationFrame(() => {
      const value = getComputedStyle(document.documentElement).getPropertyValue('--cadbea-bg').trim()
      if (value) viewer.scene.background = new Color(value)
    })
    return () => cancelAnimationFrame(frame)
  }, [theme, viewer])

  return null
}
