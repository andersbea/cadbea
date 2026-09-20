#!/usr/bin/env node
/**
 * Captures one PNG per requested view — the 8 generic bounding-box-derived
 * standard views, the 4 generic top-corner close-ups, plus any
 * project-specific `extraViews` from the project's ai-cad.config.mjs. For a
 * fast multi-angle scan across states, use contact-sheet.mjs instead; use
 * this for a full-resolution look at one view.
 *
 * Usage (from a project directory with its dev server running):
 *   ai-cad-capture                          # all standard + corner + extra views, baseline state
 *   ai-cad-capture --view=iso,front         # subset (by name)
 *   ai-cad-capture --state=exploded         # apply a declared state to all standard/corner views
 *   ai-cad-capture --config=./ai-cad.config.mjs --out=./screenshots/latest
 */

import path from 'path'
import { mkdirSync } from 'fs'
import { writeFile } from 'fs/promises'
import { openViewer, setView, setCamera, setState, screenshotBuffer } from './lib/browser.mjs'
import { parseArgs, loadConfig } from './lib/config.mjs'

// Keep in sync with STANDARD_VIEWS/CORNER_VIEWS in ../src/viewer.js —
// duplicated as plain strings so this Node-side script never needs to
// import three.js. Both route through the same viewer.setView(name).
const STANDARD_VIEWS = ['iso', 'iso-back', 'front', 'back', 'left', 'right', 'top', 'bottom']
const CORNER_VIEWS = ['corner-tl', 'corner-tr', 'corner-bl', 'corner-br']

async function main() {
  const args = parseArgs()
  const config = await loadConfig(args.config ?? './ai-cad.config.mjs')
  const url = args.url ?? config.url
  const outDir = path.resolve(args.out ?? config.outDir ?? './screenshots/latest')
  const extraViews = config.extraViews ?? []

  const only = args.view ? new Set(String(args.view).split(',').map((s) => s.trim())) : null

  const views = [
    ...[...STANDARD_VIEWS, ...CORNER_VIEWS].map((name) => ({ name, kind: 'standard', state: args.state ?? null })),
    ...extraViews.map((v) => ({ ...v, kind: 'extra' })),
  ].filter((v) => !only || only.has(v.name))

  if (views.length === 0) {
    const known = [...STANDARD_VIEWS, ...CORNER_VIEWS, ...extraViews.map((v) => v.name)]
    console.error(`No matching views. Known: ${known.join(', ')}`)
    process.exit(1)
  }

  mkdirSync(outDir, { recursive: true })

  console.log(`Opening ${url} …`)
  const { browser, page } = await openViewer(url)
  console.log(`Model ready. Capturing ${views.length} view(s)…`)

  for (const v of views) {
    await setState(page, v.state ?? null)
    if (v.kind === 'standard') await setView(page, v.name)
    else await setCamera(page, v.camera, v.target)

    const buffer = await screenshotBuffer(page)
    const file = path.join(outDir, `${v.name}.png`)
    await writeFile(file, buffer)
    console.log(`  saved: ${v.name}.png`)
  }

  await setState(page, null)
  await browser.close()
  console.log(`\nSaved to: ${outDir}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
