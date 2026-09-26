#!/usr/bin/env node
/**
 * Deterministic geometric validation — run this alongside (or when short on
 * time, instead of) the contact sheet. A screenshot can miss a real gap
 * (hidden by translucency, a bad viewing angle) or "find" one that isn't
 * there (a tessellation-seam rendering artifact) — this doesn't judge
 * pixels, it checks edge adjacency on the actual tessellated mesh: a closed,
 * manifold solid has every edge shared by exactly 2 triangles.
 *
 * Exits non-zero if any visible part, in any declared state, isn't
 * watertight — safe to wire into a pre-commit or CI check.
 *
 * Usage:
 *   cadbea-check
 *   cadbea-check --config=./cadbea.config.mjs
 */

import { openViewer, setState, stateNames } from './lib/browser.mjs'
import { parseArgs, loadConfig } from './lib/config.mjs'

async function main() {
  const args = parseArgs()
  const config = await loadConfig(args.config ?? './cadbea.config.mjs')
  const url = args.url ?? config.url

  console.log(`Opening ${url} …`)
  const { browser, page } = await openViewer(url)

  const declaredStates = await stateNames(page)
  const modes = ['default', ...declaredStates]
  console.log(`Model ready. Checking modes: ${modes.join(', ')}`)

  let anyFailed = false
  let anyUnnamed = false
  for (const mode of modes) {
    await setState(page, mode === 'default' ? null : mode)
    const results = await page.evaluate((opts) => window.__cadbeaViewer.checkGeometry(opts), {})
    console.log(`\n${mode}:`)
    if (results.length === 0) console.log('  (no visible meshes)')
    for (const r of results) {
      const status = r.watertight ? ' OK ' : 'FAIL'
      console.log(`  [${status}] ${r.name}  (${r.triangleCount} tris, ${r.boundaryEdges} boundary, ${r.nonManifoldEdges} non-manifold)`)
      if (!r.watertight) anyFailed = true
      if (r.name === '(unnamed)') anyUnnamed = true
    }
  }

  await setState(page, null)
  await browser.close()

  if (anyUnnamed) {
    console.log('\nNote: one or more parts are "(unnamed)" — pass a name to addThreeGeometry() so a failure here is actionable.')
  }

  if (anyFailed) {
    console.log('\nNot watertight — see FAIL rows above. This means a real gap in that')
    console.log('part\'s geometry (not necessarily visible in a screenshot) — investigate')
    console.log('the boolean operations that built it before trusting a visual review.')
    process.exit(1)
  }
  console.log('\nAll visible parts are watertight in every state.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
