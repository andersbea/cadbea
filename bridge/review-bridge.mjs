import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { notifyCodex, threadId } from './notify-codex.mjs'

const port = Number(process.env.CADBEA_BRIDGE_PORT ?? 8787)
const sessionId = randomUUID()
const eventsPath = join(dirname(fileURLToPath(import.meta.url)), '.data', 'review-events.jsonl')
const eventClients = new Set()

function cors(res) {
  res.setHeader('access-control-allow-origin', '*')
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS')
  res.setHeader('access-control-allow-headers', 'content-type')
}

function sendJson(res, status, value) {
  cors(res)
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(value))
}

async function readBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 25 * 1024 * 1024) throw new Error('Request body exceeds 25 MB')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

const server = createServer(async (req, res) => {
  cors(res)
  if (req.method === 'OPTIONS') return res.end()
  if (req.method === 'GET' && req.url === '/health') {
    return sendJson(res, 200, { ok: true, sessionId, eventsPath, codexThreadId: threadId ?? null })
  }
  if (req.method === 'GET' && req.url === '/events') {
    try {
      const content = await readFile(eventsPath, 'utf8')
      const events = content.trim() ? content.trim().split('\n').map((line) => JSON.parse(line)) : []
      return sendJson(res, 200, events)
    } catch (error) {
      if (error.code === 'ENOENT') return sendJson(res, 200, [])
      return sendJson(res, 500, { error: error.message })
    }
  }
  if (req.method === 'GET' && req.url === '/events/stream') {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    })
    res.write(`event: ready\ndata: ${JSON.stringify({ bridgeSessionId: sessionId })}\n\n`)
    eventClients.add(res)
    req.on('close', () => eventClients.delete(res))
    return
  }
  if (req.method === 'POST' && req.url === '/review') {
    try {
      const event = JSON.parse(await readBody(req))
      const record = { bridgeSessionId: sessionId, receivedAt: new Date().toISOString(), event }
      await mkdir(dirname(eventsPath), { recursive: true })
      await appendFile(eventsPath, `${JSON.stringify(record)}\n`, 'utf8')
      void notifyCodex(record, eventsPath).catch((error) => {
        console.error(`[cadbea-bridge] Codex notification failed; review remains saved: ${error.message}`)
      })
      const note = event.annotation?.note ?? event.review?.annotations?.at(-1)?.note
      const detail = note ? ` — ${note}` : ''
      console.log(`[cadbea-bridge] ${event.type ?? 'unknown'} received${detail}`)
      const message = `event: review\ndata: ${JSON.stringify(record)}\n\n`
      for (const client of eventClients) {
        try {
          client.write(message)
        } catch {
          eventClients.delete(client)
        }
      }
      return sendJson(res, 202, { accepted: true, bridgeSessionId: sessionId })
    } catch (error) {
      return sendJson(res, 400, { accepted: false, error: error.message })
    }
  }
  sendJson(res, 404, { error: 'Not found' })
})

server.listen(port, '127.0.0.1', () => {
  console.log(`[cadbea-bridge] listening at http://127.0.0.1:${port}`)
  console.log(`[cadbea-bridge] review endpoint: http://127.0.0.1:${port}/review`)
  console.log(`[cadbea-bridge] event queue: ${eventsPath}`)
  console.log(`[cadbea-bridge] Codex notifications: ${threadId ?? 'disabled (set CADBEA_CODEX_THREAD)'}`)
})
