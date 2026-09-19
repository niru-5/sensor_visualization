import { load } from 'cheerio'

export interface FetchedContent {
  contentType: 'pdf' | 'html' | 'unknown'
  text: string
}

const MAX_BYTES = 15 * 1024 * 1024 // 15MB — generous for a datasheet PDF, cheap to reject beyond this

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

  const res = await fetch(parsed.toString(), {
    headers: { 'User-Agent': 'camera-selection-tool-datasheet-fetcher/1.0' },
    redirect: 'follow',
  })
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

  const isPdf = contentTypeHeader.includes('application/pdf') || parsed.pathname.toLowerCase().endsWith('.pdf')
  if (isPdf) {
    return { contentType: 'pdf', text: await extractPdfText(buffer) }
  }

  const isHtml = contentTypeHeader.includes('text/html') || contentTypeHeader.includes('application/xhtml')
  if (isHtml) {
    return { contentType: 'html', text: extractHtmlText(buffer.toString('utf-8')) }
  }

  // Unknown content type — try HTML extraction as a best-effort fallback.
  return { contentType: 'unknown', text: extractHtmlText(buffer.toString('utf-8')) }
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    useSystemFonts: true,
  }).promise

  const pageTexts: string[] = []
  const pageCount = Math.min(doc.numPages, 20) // datasheets are short; cap for cost/latency
  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await doc.getPage(pageNum)
    const content = await page.getTextContent()
    const strings = content.items.map((item) => ('str' in item ? item.str : ''))
    pageTexts.push(strings.join(' '))
  }
  return pageTexts.join('\n\n')
}

function extractHtmlText(html: string): string {
  const $ = load(html)
  $('script, style, nav, footer, noscript').remove()
  return $('body').text().replace(/\s+/g, ' ').trim()
}
