#!/usr/bin/env node
/**
 * The primary tool for an agent reviewing a CAD model: one grid image per
 * declared viewer state (plus a baseline "default"), each grid holding
 * several angles of that state — an overview at a glance instead of opening
 * files one at a time. Follow up on anything suspicious with
 * `ai-cad-capture --view=<name> --state=<mode>` for a full-resolution look,
 * since a contact-sheet cell is downscaled.
 *
 * Usage (from a project directory with its dev server running):
 *   ai-cad-contact-sheet                     # overview: all 8 standard views
 *   ai-cad-contact-sheet --corners           # close-up: all 4 top-corner views
 *   ai-cad-contact-sheet --view=iso,top      # override the angle set explicitly
 *   ai-cad-contact-sheet --config=./ai-cad.config.mjs --out=./screenshots/latest
 */

import path from 'path'
import { mkdirSync } from 'fs'
import { writeFile } from 'fs/promises'
import { openViewer, setView, setState, stateNames, screenshotBuffer } from './lib/browser.mjs'
import { composeContactSheet } from './lib/compose.mjs'
import { parseArgs, loadConfig } from './lib/config.mjs'

// Overview grid: every standard angle in one image. Keep in sync with
// STANDARD_VIEWS in ../src/viewer.js.
const OVERVIEW_VIEWS = ['iso', 'iso-back', 'front', 'back', 'left', 'right', 'top', 'bottom']
// Close-up grid: every top corner, for spotting small defects a whole-model
// angle is too coarse to show. Keep in sync with CORNER_VIEWS.
const CORNER_VIEWS = ['corner-tl', 'corner-tr', 'corner-bl', 'corner-br']

async function main() {
  const args = parseArgs()
  const config = await loadConfig(args.config ?? './ai-cad.config.mjs')
  const url = args.url ?? config.url
  const outDir = path.resolve(args.out ?? config.outDir ?? './screenshots/latest')
  const viewNames = args.view
    ? String(args.view).split(',').map((s) => s.trim())
    : args.corners
      ? CORNER_VIEWS
      : config.contactViews ?? OVERVIEW_VIEWS

  // More cells → smaller cells, so an 8-up overview doesn't balloon in size.
  const cols = viewNames.length > 4 ? 4 : 2
  const cellWidth = viewNames.length > 4 ? 480 : 640
  const cellHeight = Math.round(cellWidth * (411 / 640))

  mkdirSync(outDir, { recursive: true })

  console.log(`Opening ${url} …`)
  const { browser, page } = await openViewer(url)

  const declaredStates = await stateNames(page)
  const modes = ['default', ...declaredStates]
  console.log(`Model ready. Modes: ${modes.join(', ')}. Angles per mode: ${viewNames.join(', ')}`)

  for (const mode of modes) {
    await setState(page, mode === 'default' ? null : mode)
    const cells = []
    for (const name of viewNames) {
      await setView(page, name)
      const buffer = await screenshotBuffer(page)
      cells.push({ buffer, label: name })
    }
    const title = config.title ? `${config.title} — ${mode}` : mode
    const sheet = await composeContactSheet(cells, { cols, cellWidth, cellHeight, title })
    const file = path.join(outDir, `contact-${mode}.png`)
    await writeFile(file, sheet)
    console.log(`  saved: contact-${mode}.png`)
  }

  await setState(page, null)
  await browser.close()
  console.log(`\nSaved to: ${outDir}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
