import { load } from 'cheerio'
import { DatasheetError } from './errors.js'

export interface FetchedContent {
  contentType: 'pdf' | 'html' | 'unknown'
  text: string
  /** Per-page readable character counts (PDFs only). Capped at MAX_PDF_PAGES. */
  pageCharCounts?: number[]
}

export const MAX_BYTES = 15 * 1024 * 1024 // 15MB — generous for a datasheet PDF, cheap to reject beyond this
export const MAX_PDF_PAGES = 20 // datasheets are short; cap for cost/latency
export const HTML_MAX_CHARS = 60_000 // bound model input + latency for bloated vendor pages
const FETCH_TIMEOUT_MS = 30_000
/** A PDF whose pages yield fewer readable chars than this is treated as
 * scanned/image-only (no OCR in this pipeline — see scope). */
const IMAGE_ONLY_MIN_CHARS = 10

/** Browser-like headers: many vendor/CDN hosts (Cloudflare, Akamai, vendor sites)
 * return 403 or a bot-challenge page to bare non-browser fetch clients. */
function fetchHeaders(): Record<string, string> {
  return {
    'User-Agent':
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 camera-selection-tool-datasheet-fetcher/1.0',
    Accept: 'application/pdf,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  }
}

/** True when the first bytes look like a PDF file (%PDF- magic number,
 * allowing for leading whitespace/BOM that some servers prepend). */
function looksLikePdf(buffer: Buffer): boolean {
  const head = buffer.subarray(0, 1024).toString('latin1').trimStart()
  return head.startsWith('%PDF-')
}

/** Fast-path signal for password-protected PDFs: an /Encrypt entry in the
 * trailer means pdfjs would fail with a password error — surface it directly
 * (also keeps the unit test from needing a real encrypted file). */
function looksEncrypted(buffer: Buffer): boolean {
  const head = buffer.subarray(0, Math.min(buffer.length, 8192)).toString('latin1')
  return /\/Encrypt\b/.test(head)
}

/** True when the extracted text has enough word characters to be a real page —
 * filters out binary blobs that decode to a few control/symbol chars. */
function hasReadableText(text: string): boolean {
  return (text.match(/[A-Za-z0-9]/g) ?? []).length >= 4
}

/** Fetches a datasheet URL server-side (the browser can't reliably do this — CORS) and returns extracted text. */
export async function fetchDatasheetText(url: string): Promise<FetchedContent> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new DatasheetError('INVALID_URL', 400, 'Not a valid URL.')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new DatasheetError('UNSUPPORTED_PROTOCOL', 400, 'Only http(s) URLs are supported.')
  }

  let res: Response
  try {
    res = await fetch(parsed.toString(), {
      headers: fetchHeaders(),
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new DatasheetError(
        'FETCH_TIMEOUT',
        502,
        'Fetching the datasheet timed out after 30s — the host may be slow or blocking automated requests.',
      )
    }
    throw new DatasheetError(
      'FETCH_FAILED',
      502,
      `Could not reach that URL (${err instanceof Error ? err.message : 'network error'}). Check the link or try downloading the PDF and opening it directly.`,
    )
  }
  if (res.status === 404) {
    throw new DatasheetError('UPSTREAM_NOT_FOUND', 502, 'That URL returned 404 (not found) — check the link.')
  }
  if (res.status === 403 || res.status === 401) {
    throw new DatasheetError(
      'UPSTREAM_FORBIDDEN',
      502,
      `The host refused the request (HTTP ${res.status}) — many vendor sites block automated downloads. Try downloading the PDF manually.`,
    )
  }
  if (!res.ok) {
    throw new DatasheetError('UPSTREAM_ERROR', 502, `Fetching the datasheet failed (HTTP ${res.status}).`)
  }

  const contentTypeHeader = res.headers.get('content-type') ?? ''
  const contentLength = Number(res.headers.get('content-length') ?? '0')
  if (contentLength > MAX_BYTES) {
    throw new DatasheetError('PAYLOAD_TOO_LARGE', 502, 'Datasheet is too large (>15MB) to process.')
  }

  const buffer = Buffer.from(await res.arrayBuffer())
  if (buffer.byteLength > MAX_BYTES) {
    // Catches hosts that lie about (or omit) content-length.
    throw new DatasheetError('PAYLOAD_TOO_LARGE', 502, 'Datasheet is too large (>15MB) to process.')
  }

  const header = (contentTypeHeader.split(';')[0] ?? '').trim().toLowerCase()
  const pathLooksPdf = parsed.pathname.toLowerCase().endsWith('.pdf')
  const bytesLookPdf = looksLikePdf(buffer)

  // Content-Type first, then URL, then magic bytes. Magic-byte sniffing
  // matters because many hosts serve PDFs as application/octet-stream (or
  // behind signed/download URLs with no .pdf path), which previously fell
  // through to HTML parsing and produced garbage/empty text.
  const isPdf = header === 'application/pdf' || bytesLookPdf || (pathLooksPdf && header === '')
  if (isPdf) {
    return await extractPdf(buffer)
  }
  // A .pdf path with a non-PDF content-type usually means an interstitial
  // (login wall, bot challenge, expired signed URL) — don't feed it to the
  // PDF parser; surface it as HTML/unknown so the empty-text path explains it.
  if (pathLooksPdf && (header === 'text/html' || header === 'application/xhtml+xml' || header === '')) {
    return { contentType: 'html', text: extractHtmlText(buffer.toString('utf-8')) }
  }

  const isHtml = header === 'text/html' || header === 'application/xhtml+xml'
  if (isHtml) {
    return { contentType: 'html', text: extractHtmlText(buffer.toString('utf-8')) }
  }

  if (header === '' || header === 'application/octet-stream' || header === 'binary/octet-stream') {
    const asHtml = extractHtmlText(buffer.toString('utf-8'))
    // Octet-stream HTML pages (some static hosts) still extract fine;
    // genuinely binary blobs yield nothing useful — report unsupported.
    if (hasReadableText(asHtml)) {
      return { contentType: 'unknown', text: asHtml }
    }
    throw new DatasheetError(
      'UNSUPPORTED_CONTENT',
      502,
      'That URL did not return a PDF or a readable web page (content-type: ' +
        `${contentTypeHeader || 'none'}). Try a direct PDF link or a vendor spec page.`,
    )
  }

  // Unknown content type — try HTML extraction as a best-effort fallback.
  return { contentType: 'unknown', text: extractHtmlText(buffer.toString('utf-8')) }
}

interface PdfPageItem {
  str?: unknown
  width?: unknown
  transform?: unknown
  hasEOL?: unknown
}

/**
 * Reassembles one page's text items into layout-preserving text.
 * - Newline when pdfjs flags end-of-line OR the baseline (y) jumps — keeps
 *   spec rows ("Resolution … 2448 x 2048") on their own lines instead of one
 *   long soup string.
 * - " | " when two runs share a baseline but are far apart horizontally —
 *   a cheap table-column heuristic so "Parameter | Value" pairs survive.
 */
export function assemblePageText(items: PdfPageItem[]): string {
  const lines: string[] = []
  let line = ''
  let prevEnd: number | null = null
  let prevY: number | null = null

  const pushLine = () => {
    if (line.trim()) lines.push(line.trimEnd())
    line = ''
    prevEnd = null
    prevY = null
  }

  for (const item of items) {
    const str = typeof item.str === 'string' ? item.str : ''
    const t = Array.isArray(item.transform) ? (item.transform as unknown[]) : null
    const x = t && typeof t[4] === 'number' ? (t[4] as number) : null
    const y = t && typeof t[5] === 'number' ? (t[5] as number) : null
    const width = typeof item.width === 'number' ? item.width : 0

    if (!str) {
      if (item.hasEOL === true) pushLine()
      continue
    }
    if (line && prevY !== null && y !== null && Math.abs(y - prevY) > 2) {
      // Baseline jumped — new row of text.
      pushLine()
    } else if (line && x !== null && prevEnd !== null && x - prevEnd > 8) {
      // Same baseline, wide horizontal gap — likely a table column gap.
      if (!line.endsWith(' ') && !line.endsWith('|')) line += ' '
      line += '| '
    } else if (line && !line.endsWith(' ') && !str.startsWith(' ')) {
      line += ' '
    }
    line += str
    if (x !== null) {
      prevEnd = x + width
    }
    if (y !== null) prevY = y
    if (item.hasEOL === true) pushLine()
  }
  pushLine()
  return lines.join('\n')
}

async function extractPdf(buffer: Buffer): Promise<FetchedContent> {
  if (looksEncrypted(buffer)) {
    throw new DatasheetError(
      'PDF_ENCRYPTED',
      502,
      'That PDF is password-protected/encrypted and cannot be read — try a vendor spec page instead.',
    )
  }
  let pdfjs: typeof import('pdfjs-dist/legacy/build/pdf.mjs')
  try {
    pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  } catch {
    throw new DatasheetError(
      'PDF_READER_UNAVAILABLE',
      502,
      'The server could not load its PDF reader — try again or paste a vendor spec page instead.',
    )
  }
  let doc: Awaited<ReturnType<typeof pdfjs.getDocument>['promise']> | undefined
  try {
    const loaded = await pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useWorkerFetch: false,
      useSystemFonts: true,
    }).promise
    doc = loaded
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (/password|encrypted/i.test(msg)) {
      throw new DatasheetError(
        'PDF_ENCRYPTED',
        502,
        'That PDF is password-protected/encrypted and cannot be read — try a vendor spec page instead.',
      )
    }
    throw new DatasheetError(
      'PDF_CORRUPT',
      502,
      `Could not parse that file as a PDF (${msg || 'invalid or corrupted file'}). The link may point to a viewer page rather than the PDF itself.`,
    )
  }

  try {
    const pageCount = Math.min(doc.numPages, MAX_PDF_PAGES)
    const pageTexts: string[] = []
    const pageCharCounts: number[] = []
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const page = await doc.getPage(pageNum)
      const content = await page.getTextContent()
      const text = assemblePageText(content.items as PdfPageItem[])
      pageTexts.push(text)
      pageCharCounts.push(text.replace(/\s/g, '').length)
    }
    const totalReadable = pageCharCounts.reduce((a, b) => a + b, 0)
    if (totalReadable < IMAGE_ONLY_MIN_CHARS) {
      // Scanned/image-only PDFs extract to (near-)empty pages and the model
      // would just hallucinate — fail loudly with per-page evidence instead
      // of a generic "no text" message. No OCR in this pipeline by design.
      const counts = pageCharCounts.map((c, i) => `p${i + 1}:${c}`).join(' ')
      throw new DatasheetError(
        'PDF_IMAGE_ONLY',
        422,
        `That PDF appears to be scanned/image-only — pages 1-${pageCount} yielded no readable text ` +
          `(chars per page: ${counts}). Image-only PDFs are not supported; try a vendor spec page instead.`,
      )
    }
    return { contentType: 'pdf', text: pageTexts.join('\n\n'), pageCharCounts }
  } catch (err) {
    if (err instanceof DatasheetError) throw err
    throw new DatasheetError(
      'PDF_READ_ERROR',
      502,
      'Failed while reading pages from that PDF (it may be scanned/image-only, which is not supported).',
    )
  } finally {
    // pdfjs-dist v6 exposes cleanup on the loading task, not a typed
    // destroy() on the proxy — release pages best-effort and let GC handle
    // the rest. The optional call keeps this safe across pdfjs versions.
    await (doc as unknown as { destroy?: () => Promise<void> }).destroy?.().catch(() => undefined)
  }
}

/** Recursively flattens a JSON-LD node into "key: value" lines (depth-capped). */
function flattenJsonLd(value: unknown, prefix: string, out: string[], depth: number): void {
  if (out.length >= 60 || depth > 3) return
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length && out.length < 60; i++) {
      flattenJsonLd(value[i], `${prefix}[${i}]`, out, depth + 1)
    }
    return
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (key.startsWith('@') && key !== '@type') continue
      flattenJsonLd(entry, prefix ? `${prefix}.${key}` : key, out, depth + 1)
    }
    return
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const text = String(value).trim()
    if (text) out.push(`${prefix}: ${text}`.slice(0, 300))
  }
}

export function extractHtmlText(html: string): string {
  const $ = load(html)

  // JSON-LD product/spec blobs often hold the cleanest model numbers and
  // ratings on vendor pages — harvest before stripping scripts.
  const jsonLdLines: string[] = []
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).text().trim()
    if (!raw) return
    try {
      flattenJsonLd(JSON.parse(raw), '', jsonLdLines, 0)
    } catch {
      // Malformed JSON-LD is common (trailing commas, HTML entities) — skip it.
    }
  })

  // Meta spec fields: description/og/product tags frequently duplicate the
  // headline specs and survive even JS-heavy pages' SSR shells.
  const metaLines: string[] = []
  $('meta[name][content], meta[property][content], meta[itemprop][content]').each((_, el) => {
    if (metaLines.length >= 30) return
    const name = ($(el).attr('name') ?? $(el).attr('property') ?? $(el).attr('itemprop') ?? '').trim()
    const content = ($(el).attr('content') ?? '').trim()
    if (name && content) metaLines.push(`${name}: ${content}`.slice(0, 300))
  })

  // Spec tables row-wise: "Parameter | Value" rows become "Parameter: Value"
  // lines so the model sees pairs instead of a flattened word stream.
  const tableLines: string[] = []
  $('table').each((_, table) => {
    $(table)
      .find('tr')
      .each((_, row) => {
        if (tableLines.length >= 200) return
        const cells = $(row)
          .find('th, td')
          .toArray()
          .map((cell) => $(cell).text().replace(/\s+/g, ' ').trim())
          .filter((cell) => cell.length > 0)
        if (cells.length === 0) return
        tableLines.push((cells.length === 2 ? cells.join(': ') : cells.join(' | ')).slice(0, 300))
      })
  })
  $('table').remove()

  // Chrome/nav/search chrome adds noise and fake "spec-looking" strings.
  $('script, style, nav, footer, noscript, header, aside, form').remove()
  const bodyText = $('body').text().replace(/[ \t\f\v]+/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n').trim()

  const combined = [bodyText, ...tableLines, ...jsonLdLines, ...metaLines].filter((part) => part.length > 0).join('\n')
  return combined.length > HTML_MAX_CHARS ? combined.slice(0, HTML_MAX_CHARS) : combined
}
