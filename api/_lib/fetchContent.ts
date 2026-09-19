import { load } from 'cheerio'

export interface FetchedContent {
  contentType: 'pdf' | 'html' | 'unknown'
  text: string
}

const MAX_BYTES = 15 * 1024 * 1024 // 15MB — generous for a datasheet PDF, cheap to reject beyond this
const FETCH_TIMEOUT_MS = 30_000

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

/** True when extracted text has enough word characters to be a real page —
 * filters out binary blobs that decode to a few control/symbol chars. */
/** True when extracted text has enough word characters to be a real page —
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
    throw new Error('Not a valid URL.')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http(s) URLs are supported.')
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
      throw new Error('Fetching the datasheet timed out after 30s — the host may be slow or blocking automated requests.')
    }
    throw new Error(
      `Could not reach that URL (${err instanceof Error ? err.message : 'network error'}). Check the link or try downloading the PDF and opening it directly.`,
    )
  }
  if (res.status === 404) {
    throw new Error('That URL returned 404 (not found) — check the link.')
  }
  if (res.status === 403 || res.status === 401) {
    throw new Error(
      `The host refused the request (HTTP ${res.status}) — many vendor sites block automated downloads. Try downloading the PDF manually.`,
    )
  }
  if (!res.ok) {
    throw new Error(`Fetching the datasheet failed (HTTP ${res.status}).`)
  }

  const contentTypeHeader = res.headers.get('content-type') ?? ''
  const contentLength = Number(res.headers.get('content-length') ?? '0')
  if (contentLength > MAX_BYTES) {
    throw new Error('Datasheet is too large (>15MB) to process.')
  }

  const buffer = Buffer.from(await res.arrayBuffer())
  if (buffer.byteLength > MAX_BYTES) {
    throw new Error('Datasheet is too large (>15MB) to process.')
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
    return { contentType: 'pdf', text: await extractPdfText(buffer) }
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
    throw new Error(
      'That URL did not return a PDF or a readable web page (content-type: ' +
        `${contentTypeHeader || 'none'}). Try a direct PDF link or a vendor spec page.`,
    )
  }

  // Unknown content type — try HTML extraction as a best-effort fallback.
  return { contentType: 'unknown', text: extractHtmlText(buffer.toString('utf-8')) }
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  let pdfjs: typeof import('pdfjs-dist/legacy/build/pdf.mjs')
  try {
    pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  } catch {
    throw new Error('The server could not load its PDF reader — try again or paste a vendor spec page instead.')
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
      throw new Error('That PDF is password-protected/encrypted and cannot be read — try a vendor spec page instead.')
    }
    throw new Error(
      `Could not parse that file as a PDF (${msg || 'invalid or corrupted file'}). The link may point to a viewer page rather than the PDF itself.`,
    )
  }

  try {
    const pageTexts: string[] = []
    const pageCount = Math.min(doc.numPages, 20) // datasheets are short; cap for cost/latency
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const page = await doc.getPage(pageNum)
      const content = await page.getTextContent()
      const strings = content.items.map((item) => ('str' in item ? item.str : ''))
      pageTexts.push(strings.join(' '))
    }
    return pageTexts.join('\n\n')
  } catch {
    throw new Error('Failed while reading pages from that PDF (it may be scanned/image-only, which is not supported).')
  } finally {
    // pdfjs-dist v6 exposes cleanup on the loading task, not a typed
    // destroy() on the proxy — release pages best-effort and let GC handle
    // the rest. The optional call keeps this safe across pdfjs versions.
    await (doc as unknown as { destroy?: () => Promise<void> }).destroy?.().catch(() => undefined)
  }
}

function extractHtmlText(html: string): string {
  const $ = load(html)
  $('script, style, nav, footer, noscript').remove()
  return $('body').text().replace(/\s+/g, ' ').trim()
}
