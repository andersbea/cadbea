import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { createServer } from 'vite'

// Proves the zero-code path end to end: mountCadbeaApp() with no viewer prop,
// load a fixture file through the real file input (not drag events, so this
// stays a plain Playwright setInputFiles() call), and confirm the part
// actually landed in the scene and is watertight.
const root = fileURLToPath(new URL('..', import.meta.url))
const fixture = fileURLToPath(new URL('../fixtures/cube.stl', import.meta.url))

const server = await createServer({
  root,
  cacheDir: '.vite-test-cache',
  optimizeDeps: { force: true },
  server: { host: '127.0.0.1', port: 0, strictPort: false },
})
let browser
const errors = []

try {
  await server.listen()
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } })
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error' || message.text().includes('Multiple instances of Three.js')) {
      errors.push(message.text())
    }
  })

  await page.goto(server.resolvedUrls.local[0])
  await page.waitForFunction(() => window.__cadbeaViewer?.ready === true, null, { timeout: 60_000 })

  await page.locator('input[type="file"]').setInputFiles(fixture)
  await page.waitForFunction(
    () => window.__cadbeaViewer.modelGroup.children.length > 0,
    null,
    { timeout: 15_000 },
  )

  const result = await page.evaluate(() => {
    const viewer = window.__cadbeaViewer
    return { checks: viewer.checkGeometry(), partNames: viewer.modelGroup.children.map((obj) => obj.name) }
  })
  assert.deepEqual(result.partNames, ['cube'])
  assert.equal(result.checks.length, 1)
  assert.equal(result.checks[0].watertight, true, JSON.stringify(result.checks[0]))
  assert.ok(result.checks[0].triangleCount > 0)

  const selection = await page.evaluate(() => window.__cadbeaViewer.selectPart('cube'))
  assert.equal(selection.partId, 'cube')

  assert.deepEqual(errors, [], 'Browser errors or duplicate instances')
  console.log('PASS: dropped-file model loaded, watertight, and selectable with zero project code.')
} finally {
  await browser?.close()
  await server.close()
}
