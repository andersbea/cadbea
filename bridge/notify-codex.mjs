import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { delimiter, join } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)
export const threadId = process.env.CADBEA_CODEX_THREAD ?? process.env.CODEX_THREAD_ID

/** Queue a comment in the configured or launching Codex conversation. */
export async function notifyCodex(record, eventsPath) {
  if (!threadId || record.event.type !== 'annotation-added') return
  // Invoke the npm entry point directly; never interpolate comments into a shell.
  const cli = process.env.CADBEA_CODEX_CLI ?? (process.env.PATH ?? '').split(delimiter)
    .map((directory) => join(directory, 'node_modules', '@openai', 'codex', 'bin', 'codex.js'))
    .find((path) => existsSync(path))
  const message = `New user comment from the CAD web app. Review and respond using its saved selection, camera, and snapshot context.\nEvent received: ${record.receivedAt}\nEvent file: ${eventsPath}\nComment: ${JSON.stringify(record.event.annotation?.note ?? '')}`
  const args = ['queue', '--thread', threadId, '--message', message]
  const result = await run(cli ? process.execPath : 'codex', cli ? [cli, ...args] : args, {
    windowsHide: true, timeout: 30_000,
  })
  console.log(`[cadbea-bridge] ${result.stdout.trim()}`)
}
