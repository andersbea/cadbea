import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { composeContactSheet } from '../../../../capture/lib/compose.mjs'

// A real consumer integration test: owns its server/browser, uses an available
// port, and exercises the public viewer contract without a separately running app.
const root = fileURLToPath(new URL('..', import.meta.url))
const output = new URL('../../screenshots/validation/', import.meta.url)
const server = await createServer({
  root,
  cacheDir: '.vite-test-cache',
  optimizeDeps: { force: true },
  server: { host: '127.0.0.1', port: 0, strictPort: false },
})
let browser
const errors = []
const reviewEvents = []
const baselineNames = ['body', 'lid', 'lid-button-prg', 'lid-button-rst', 'board-ref', 'battery-ref', 'antenna-ref']
const views = ['iso', 'iso-back', 'front', 'back', 'left', 'right', 'top', 'bottom',
  'corner-tl', 'corner-tr', 'corner-bl', 'corner-br']
const report = { states: {}, views: [] }

try {
  await mkdir(output, { recursive: true })
  await server.listen()
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'info' && message.text().startsWith('[cadbea] ')) {
      reviewEvents.push(JSON.parse(message.text().slice('[cadbea] '.length)))
    }
    if (message.type() === 'error' || message.text().includes('Multiple instances of Three.js')) {
      errors.push(message.text())
    }
  })
  const started = performance.now()
  // Keep fixture annotations from notifying a developer's live Codex session.
  await page.goto(`${server.resolvedUrls.local[0]}?reviewWebhook=`)
  await page.waitForFunction(() => window.__cadbeaViewer?.ready === true
    || document.getElementById('status')?.textContent?.startsWith('Error:'), null, { timeout: 120_000 })
  assert.equal(await page.evaluate(() => window.__cadbeaViewer?.ready), true,
    await page.locator('#status').textContent())
  report.readyMs = Math.round(performance.now() - started)
  assert.deepEqual(await page.evaluate(() => Object.keys(window.__cadbeaViewer.states).sort()), ['exploded', 'section'])

  for (const state of ['default', 'exploded', 'section']) {
    const snapshot = await page.evaluate((stateName) => {
      const viewer = window.__cadbeaViewer
      viewer.setState(stateName === 'default' ? null : stateName)
      viewer.setView('iso')
      viewer.render()
      return {
        checks: viewer.checkGeometry(),
        objects: viewer.modelGroup.children.map((obj) => ({ name: obj.name, visible: obj.visible, z: obj.position.z })),
      }
    }, state)
    report.states[state] = snapshot.checks
    const expected = state === 'section'
      ? baselineNames.map((name) => name === 'body' || name === 'lid' ? `${name}-section` : name)
      : baselineNames
    assert.deepEqual(snapshot.checks.map(({ name }) => name).sort(), [...expected].sort())
    for (const check of snapshot.checks) {
      assert.ok(check.triangleCount > 0, `${state}/${check.name}: empty mesh`)
      assert.equal(check.watertight, true, `${state}/${check.name}: ${JSON.stringify(check)}`)
    }
    for (const name of ['body', 'lid']) {
      for (const suffix of ['', '-edges']) {
        assert.equal(snapshot.objects.find((obj) => obj.name === name + suffix).visible, state !== 'section')
        assert.equal(snapshot.objects.find((obj) => obj.name === name + '-section' + suffix).visible, state === 'section')
      }
    }
    for (const name of ['lid', 'lid-button-prg', 'lid-button-rst']) {
      assert.equal(snapshot.objects.find((obj) => obj.name === name).z, state === 'exploded' ? 38 : 0)
    }
    const cells = []
    for (const view of ['iso', 'left', 'top', 'corner-tl']) {
      await page.evaluate((name) => {
        window.__cadbeaViewer.setView(name)
        window.__cadbeaViewer.render()
      }, view)
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      cells.push({ label: view, buffer: await page.screenshot() })
    }
    await writeFile(new URL(`contact-${state}.png`, output),
      await composeContactSheet(cells, { cols: 2, title: `GC CAD validation - ${state}` }))
  }

  const review = await page.evaluate(() => {
    const viewer = window.__cadbeaViewer
    viewer.setState(null)
    const selection = viewer.selectPart('body')
    const annotation = viewer.addAnnotation('Check the USB-C clearance against the measured connector.')
    const state = viewer.getReviewState()
    viewer.clearSelection()
    return { selection, annotation, state, panel: document.getElementById('selection-name')?.textContent }
  })
  assert.equal(review.selection.partId, 'body')
  assert.equal(review.annotation.selection.partId, 'body')
  assert.equal(review.state.annotations.length, 1)
  assert.equal(review.state.selection.partId, 'body')
  assert.equal(review.panel, 'Click a visible part to select it')
  assert.ok(reviewEvents.some((event) => event.type === 'selection-changed' && event.selection.partId === 'body'))
  assert.ok(reviewEvents.some((event) => event.type === 'annotation-added' && event.annotation.id === review.annotation.id))

  const areaSelection = await page.evaluate(() => {
    const viewer = window.__cadbeaViewer
    viewer.setSelectionMode('area')
    const selection = viewer.selectArea({ x: 0.25, y: 0.25, width: 0.5, height: 0.5 })
    viewer.setSelectionMode('part')
    return selection
  })
  assert.equal(areaSelection.kind, 'area')
  assert.deepEqual(Object.keys(areaSelection.rect).sort(), ['height', 'width', 'x', 'y'])
  assert.ok(areaSelection.screen.width > 0 && areaSelection.screen.height > 0)
  assert.ok(areaSelection.snapshot.dataUrl.startsWith('data:image/png'))
  assert.ok(areaSelection.snapshot.crop.width > 0 && areaSelection.snapshot.crop.height > 0)
  assert.ok(reviewEvents.some((event) => event.type === 'area-selected' && event.selection.kind === 'area'))

  const printLinks = await page.locator('#print-files a[download]').evaluateAll((links) =>
    links.map((link) => ({ href: link.getAttribute('href'), download: link.getAttribute('download') })))
  assert.deepEqual(printLinks, [
    { href: '/dist/print/node-wireless-tracker-v2-print-files.zip', download: 'node-wireless-tracker-v2-print-files.zip' },
  ])

  for (const view of views) {
    const camera = await page.evaluate((name) => {
      const viewer = window.__cadbeaViewer
      viewer.setState(null)
      viewer.setView(name)
      return [...viewer.camera.position.toArray(), ...viewer.controls.target.toArray()]
    }, view)
    assert.ok(camera.every(Number.isFinite), `${view}: invalid camera`)
    report.views.push(view)
  }

  // A capture reset must win over any pending interactive animation.
  await page.locator('#explode-btn').click()
  await page.evaluate(() => window.__cadbeaViewer.setState(null))
  await page.waitForTimeout(650)
  assert.equal(await page.evaluate(() => window.__cadbeaViewer.modelGroup.getObjectByName('lid').position.z), 0)
  await page.locator('#section-btn').click()
  assert.equal(await page.evaluate(() => window.__cadbeaViewer.modelGroup.getObjectByName('body').visible), false)
  await page.locator('#explode-btn').click()
  assert.equal(await page.evaluate(() => window.__cadbeaViewer.modelGroup.getObjectByName('body-section').visible), false)
  await page.evaluate(() => window.__cadbeaViewer.setState(null))
  const persistedCamera = await page.evaluate(() => {
    const viewer = window.__cadbeaViewer
    viewer.camera.position.set(321, 222, 123)
    viewer.controls.target.set(11, 22, 33)
    viewer.controls.dispatchEvent({ type: 'change' })
    return { position: viewer.camera.position.toArray(), target: viewer.controls.target.toArray() }
  })
  await page.reload()
  await page.waitForFunction(() => window.__cadbeaViewer?.ready === true, null, { timeout: 120_000 })
  const restoredCamera = await page.evaluate(() => ({
    position: window.__cadbeaViewer.camera.position.toArray(),
    target: window.__cadbeaViewer.controls.target.toArray(),
  }))
  assert.ok(restoredCamera.position.every((value, index) => Math.abs(value - persistedCamera.position[index]) < 1e-9))
  assert.ok(restoredCamera.target.every((value, index) => Math.abs(value - persistedCamera.target[index]) < 1e-9))
  assert.deepEqual(errors, [], 'Browser errors or duplicate Three.js instances')
  report.passed = true
  console.log(`PASS: 3 states, 12 views, watertight meshes, visibility, and interactive state resets (${report.readyMs} ms to ready).`)
} finally {
  report.errors = errors
  await writeFile(new URL('report.json', output), JSON.stringify(report, null, 2))
  await browser?.close()
  await server.close()
}
