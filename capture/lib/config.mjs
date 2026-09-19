import path from 'path'
import { pathToFileURL } from 'url'

/** Minimal `--key=value` / `--flag` parser — no dependency needed for this. */
export function parseArgs() {
  const out = {}
  for (const arg of process.argv.slice(2)) {
    if (!arg.startsWith('--')) continue
    const [key, value] = arg.slice(2).split('=')
    out[key] = value ?? true
  }
  return out
}

/**
 * Loads a project's `ai-cad.config.mjs` (default export). See ../../README.md
 * for the shape: { url, outDir, extraViews?, contactViews?, title? }.
 */
export async function loadConfig(configPath) {
  const resolved = path.resolve(configPath)
  const mod = await import(pathToFileURL(resolved).href)
  return mod.default
}
