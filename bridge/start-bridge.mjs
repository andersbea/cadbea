import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { setTimeout } from 'node:timers/promises'

/** Start the review bridge with Vite, reusing a healthy bridge. */
export function reviewBridgePlugin() {
  return {
    name: 'cadbea-review-bridge',
    async configureServer(server) {
      const url = `http://127.0.0.1:${process.env.CADBEA_BRIDGE_PORT ?? 8787}/health`
      async function healthy() {
        try {
          const response = await fetch(url, { signal: AbortSignal.timeout(500) })
          const health = await response.json()
          return response.ok && health.ok && typeof health.eventsPath === 'string'
        } catch {
          return false
        }
      }
      if (await healthy()) return
      const child = spawn(process.execPath, [fileURLToPath(new URL('./review-bridge.mjs', import.meta.url))], {
        stdio: 'inherit', windowsHide: true,
      })
      let failure
      child.on('error', (error) => { failure = error })
      const stop = () => child.kill()
      process.once('exit', stop)
      server.httpServer?.once('close', () => {
        stop()
        process.removeListener('exit', stop)
      })
      for (let attempt = 0; attempt < 30; attempt++) {
        if (failure || child.exitCode !== null) break
        if (await healthy()) return
        await setTimeout(100)
      }
      stop()
      throw failure ?? new Error(`Review bridge failed to start at ${url}`)
    },
  }
}
