import { Button } from '../components/Button.jsx'
import { useTheme } from './ThemeProvider.jsx'

const ICONS = { system: '◐', light: '☀', dark: '☾' }

/** Cycles through every available theme (built-in plus any registered via `registerTheme()`). */
export function ThemeToggle() {
  const { theme, setTheme, themes } = useTheme()

  const cycle = () => {
    const next = themes[(themes.indexOf(theme) + 1) % themes.length]
    setTheme(next)
  }

  return (
    <Button onClick={cycle} title={`Theme: ${theme} (click to change)`} aria-label="Change theme">
      {ICONS[theme] ?? '◑'}
    </Button>
  )
}
