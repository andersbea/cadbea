import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const ThemeContext = createContext(null)

const BUILTIN_THEMES = ['system', 'light', 'dark']
const THEME_STORAGE_KEY = 'cadbea:theme'
const CUSTOM_THEMES_STORAGE_KEY = 'cadbea:custom-themes'

function readStoredCustomThemes() {
  try {
    const raw = localStorage.getItem(CUSTOM_THEMES_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

/** Injects (or updates) a `:root[data-theme="name"] { --token: value; ... }` rule. */
function injectThemeStyle(name, tokens) {
  const id = `cadbea-theme-${name}`
  let style = document.getElementById(id)
  if (!style) {
    style = document.createElement('style')
    style.id = id
    document.head.append(style)
  }
  const body = Object.entries(tokens).map(([key, value]) => `${key}: ${value};`).join(' ')
  style.textContent = `:root[data-theme="${name}"] { ${body} }`
}

/**
 * Applies a `data-theme` attribute to `<html>` for the tokens in
 * `theme/tokens.css` to key off, persists the chosen theme, and lets a
 * consumer register further custom themes at runtime.
 * @param {{ children: import('react').ReactNode, defaultTheme?: string, storageKey?: string }} props
 */
export function ThemeProvider({ children, defaultTheme = 'system', storageKey = THEME_STORAGE_KEY }) {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem(storageKey) ?? defaultTheme
    } catch {
      return defaultTheme
    }
  })
  const [customThemes, setCustomThemes] = useState(() => readStoredCustomThemes())

  useEffect(() => {
    // Re-inject persisted custom themes' <style> tags on mount so they
    // survive a reload; new registrations inject their own immediately.
    for (const [name, tokens] of Object.entries(customThemes)) injectThemeStyle(name, tokens)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (theme === 'system') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem(storageKey, theme)
    } catch {
      // Storage can be disabled in private/embedded browser contexts.
    }
  }, [theme, storageKey])

  const registerTheme = useCallback((name, tokens) => {
    if (BUILTIN_THEMES.includes(name)) throw new Error(`"${name}" is a built-in theme name`)
    injectThemeStyle(name, tokens)
    setCustomThemes((prev) => {
      const next = { ...prev, [name]: tokens }
      try {
        localStorage.setItem(CUSTOM_THEMES_STORAGE_KEY, JSON.stringify(next))
      } catch {
        // Storage can be disabled in private/embedded browser contexts.
      }
      return next
    })
  }, [])

  const themes = useMemo(() => [...BUILTIN_THEMES, ...Object.keys(customThemes)], [customThemes])
  const value = useMemo(() => ({ theme, setTheme, themes, registerTheme }), [theme, themes, registerTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

/** @returns {{ theme: string, setTheme: (name: string) => void, themes: string[], registerTheme: (name: string, tokens: Record<string, string>) => void }} */
export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme() must be called within a <ThemeProvider>')
  return ctx
}
