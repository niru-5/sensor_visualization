import 'dotenv/config'
import { createServer } from 'node:http'
import { extractFromUrl } from '../api/_lib/extract.js'
import { isRateLimited } from '../api/_lib/rateLimit.js'

const PORT = Number(process.env.API_PORT ?? 8787)

/**
 * Local stand-in for the Vercel serverless function during `npm run dev`
 * (see vite.config.ts's `server.proxy`). Same handler logic as
 * api/extract-datasheet.ts, just wired to plain node:http instead of the
 * Vercel request/response shape, since there's no `vercel dev` in this
 * environment.
 */
const server = createServer(async (req, res) => {
  if (req.method !== 'POST' || req.url !== '/api/extract-datasheet') {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Not found.' }))
    return
  }

  const ip = req.socket.remoteAddress ?? 'unknown'
  if (isRateLimited(ip)) {
    res.writeHead(429, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Too many extraction requests — wait a minute and try again.' }))
    return
  }

  let raw = ''
  for await (const chunk of req) raw += chunk
  const body = raw ? (JSON.parse(raw) as { url?: string; kind?: string }) : {}
  const { url, kind } = body

  if (!url || (kind !== 'sensor' && kind !== 'lens')) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Request must include { url, kind: "sensor" | "lens" }.' }))
    return
  }

  try {
    const result = await extractFromUrl(url, kind)
    res.writeHead('error' in result ? 422 : 200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(result))
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Extraction failed.' }))
  }
})

server.listen(PORT, () => {
  console.log(`[dev-api] extraction endpoint listening on http://localhost:${PORT}/api/extract-datasheet`)
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('[dev-api] ANTHROPIC_API_KEY is not set — extraction will fail at the model-call step. See docs/LEARNINGS.md.')
  }
})
