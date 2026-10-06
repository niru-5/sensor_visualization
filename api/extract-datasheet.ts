import type { IncomingMessage, ServerResponse } from 'node:http'
import { isMissingApiKeyError, MISSING_API_KEY_MESSAGE } from './_lib/callExtractionModel.js'
import { isDatasheetError } from './_lib/errors.js'
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
 *
 * Status mapping comes from the typed DatasheetError taxonomy ({code,
 * status, message}) thrown by the pipeline — no regex-on-message matching.
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

  let body: { url?: string; kind?: string }
  try {
    body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as { url?: string; kind?: string }
  } catch {
    res.status(400).json({ error: 'Request body must be valid JSON { url, kind }.' })
    return
  }
  const { url, kind } = body ?? {}

  if (!url || (kind !== 'sensor' && kind !== 'lens')) {
    res.status(400).json({ error: 'Request must include { url, kind: "sensor" | "lens" }.' })
    return
  }

  try {
    const result = await extractFromUrl(url, kind)
    res.status(200).json(result)
  } catch (err) {
    if (isMissingApiKeyError(err)) {
      res.status(503).json({ error: MISSING_API_KEY_MESSAGE, code: 'MISSING_API_KEY' })
      return
    }
    if (isDatasheetError(err)) {
      res.status(err.status).json({ error: err.message, code: err.code })
      return
    }
    const message = err instanceof Error ? err.message : 'Extraction failed.'
    res.status(500).json({ error: message })
  }
}
