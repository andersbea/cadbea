#!/usr/bin/env node
/**
 * The primary tool for an agent reviewing a CAD model: one grid image per
 * declared viewer state (plus a baseline "default"), each grid holding
 * several angles of that state. Meant for a fast scan for problems — follow
 * up on anything suspicious with `ai-cad-capture --view=<name> --state=<mode>`
 * for a full-resolution look, since a contact-sheet cell is downscaled.
 *
 * Usage (from a project directory with its dev server running):
 *   ai-cad-contact-sheet
 *   ai-cad-contact-sheet --view=iso,top      # override the angle set
 *   ai-cad-contact-sheet --config=./ai-cad.config.mjs --out=./screenshots/latest
 */

import path from 'path'
import { mkdirSync } from 'fs'
import { writeFile } from 'fs/promises'
import { openViewer, setView, setState, stateNames, screenshotBuffer } from './lib/browser.mjs'
import { composeContactSheet } from './lib/compose.mjs'
import { parseArgs, loadConfig } from './lib/config.mjs'

const DEFAULT_CONTACT_VIEWS = ['iso', 'iso-back', 'top', 'front']

async function main() {
  const args = parseArgs()
  const config = await loadConfig(args.config ?? './ai-cad.config.mjs')
  const url = args.url ?? config.url
  const outDir = path.resolve(args.out ?? config.outDir ?? './screenshots/latest')
  const viewNames = args.view
    ? String(args.view).split(',').map((s) => s.trim())
    : config.contactViews ?? DEFAULT_CONTACT_VIEWS

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
    const sheet = await composeContactSheet(cells, { cols: 2, title })
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
