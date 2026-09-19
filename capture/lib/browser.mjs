/**
 * Shared Playwright driving code for capture.mjs and contact-sheet.mjs.
 * Talks only to the `window.__aiCadViewer` contract — see ../../README.md.
 */

import { chromium } from 'playwright'

export async function openViewer(url, { width = 1400, height = 900, readyTimeout = 120_000 } = {}) {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await page.setViewportSize({ width, height })
  await page.goto(url)
  await page.waitForFunction(() => window.__aiCadViewer?.ready === true, { timeout: readyTimeout })
  return { browser, page }
}

export async function forceRender(page) {
  await page.evaluate(() => window.__aiCadViewer.render())
  // Two rAFs so the frame is actually painted before Playwright reads pixels.
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
}

export async function setView(page, view) {
  await page.evaluate((v) => window.__aiCadViewer.setView(v), view)
  await forceRender(page)
}

/** For project-specific extra views the framework can't derive generically. */
export async function setCamera(page, position, target) {
  await page.evaluate(({ pos, tgt }) => {
    const { camera, controls } = window.__aiCadViewer
    camera.position.set(...pos)
    controls.target.set(...tgt)
    controls.update()
  }, { pos: position, tgt: target })
  await forceRender(page)
}

/** @param {string|null} state - null clears every declared state */
export async function setState(page, state) {
  await page.evaluate((s) => window.__aiCadViewer.setState(s), state)
  await forceRender(page)
}

export async function stateNames(page) {
  return page.evaluate(() => Object.keys(window.__aiCadViewer.states ?? {}))
}

export async function screenshotBuffer(page) {
  await forceRender(page)
  return page.screenshot()
}
