import type { IncomingMessage, ServerResponse } from 'node:http'
import { extractFromUrl } from './_lib/extract.js'
import { isRateLimited } from './_lib/rateLimit.js'

interface VercelRequest extends IncomingMessage {
  body?: unknown
}
type VercelResponse = ServerResponse & {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
}

/**
 * POST /api/extract-datasheet { url, kind } -> ExtractResponse
 * Stateless: fetches the URL, extracts text, calls the model, returns
 * structured fields. Nothing is stored server-side (requirements.md §5).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' })
    return
  }

  const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? 'unknown'
  if (isRateLimited(ip)) {
    res.status(429).json({ error: 'Too many extraction requests — wait a minute and try again.' })
    return
  }

  const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as { url?: string; kind?: string }
  const { url, kind } = body ?? {}

  if (!url || (kind !== 'sensor' && kind !== 'lens')) {
    res.status(400).json({ error: 'Request must include { url, kind: "sensor" | "lens" }.' })
    return
  }

  try {
    const result = await extractFromUrl(url, kind)
    res.status('error' in result ? 422 : 200).json(result)
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Extraction failed.' })
  }
}
