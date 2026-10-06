import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  assemblePageText,
  fetchDatasheetText,
  HTML_MAX_CHARS,
  MAX_BYTES,
  MAX_PDF_PAGES,
} from './fetchContent.js'
import { DatasheetError } from './errors.js'

function mockFetchOnce(buffer: Uint8Array, headers: Record<string, string>, status = 200) {
  const get = (name: string) => headers[name.toLowerCase()] ?? null
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: { get },
    arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  })
}

function htmlFetch(html: string, contentType = 'text/html; charset=utf-8') {
  vi.stubGlobal('fetch', mockFetchOnce(new TextEncoder().encode(html), { 'content-type': contentType }))
}

/** Builds a minimal multi-page PDF with valid xref offsets (ASCII-only). */
function makeMinimalPdf(pages: string[][]): Uint8Array {
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
  const bodies: string[] = []
  bodies[1] = '<< /Type /Catalog /Pages 2 0 R >>'
  const kids = pages.map((_, i) => `${4 + i * 2} 0 R`).join(' ')
  bodies[2] = `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`
  bodies[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  const enc = new TextEncoder()
  pages.forEach((lines, i) => {
    const pageNum = 4 + i * 2
    const contentNum = 5 + i * 2
    const ops = lines.map((l, j) => `BT /F1 12 Tf 72 ${720 - j * 20} Td (${esc(l)}) Tj ET`).join('\n')
    const stream = ops ? `${ops}\n` : ''
    bodies[pageNum] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentNum} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`
    bodies[contentNum] = `<< /Length ${enc.encode(stream).length} >>\nstream\n${stream}endstream`
  })
  const maxObj = 3 + pages.length * 2
  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  for (let n = 1; n <= maxObj; n++) {
    offsets[n] = enc.encode(out).length
    out += `${n} 0 obj\n${bodies[n]}\nendobj\n`
  }
  const xrefPos = enc.encode(out).length
  out += `xref\n0 ${maxObj + 1}\n0000000000 65535 f \n`
  for (let n = 1; n <= maxObj; n++) {
    out += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`
  }
  out += `trailer\n<< /Size ${maxObj + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`
  return enc.encode(out)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchDatasheetText content-type detection', () => {
  it('rejects non-http(s) URLs', async () => {
    await expect(fetchDatasheetText('ftp://example.com/x.pdf')).rejects.toThrow(/only http/i)
  })

  it('rejects invalid URLs', async () => {
    await expect(fetchDatasheetText('not a url')).rejects.toThrow(/valid url/i)
  })

  it('treats application/octet-stream PDFs as PDF via magic bytes (not HTML garbage)', async () => {
    // Minimal valid one-page PDF header; pdfjs parse may still fail on such a
    // stub, but routing must reach the PDF branch (pdf error, not HTML fallback).
    const stub = new TextEncoder().encode('%PDF-1.4\n%stub\n')
    vi.stubGlobal('fetch', mockFetchOnce(stub, { 'content-type': 'application/octet-stream' }))
    const result = await fetchDatasheetText('https://example.com/download?token=abc').catch((e: Error) => e)
    // Either parsed text (contentType pdf) or a PDF-parse error — never silent HTML.
    if (result instanceof Error) {
      expect(result.message).toMatch(/pdf/i)
    } else {
      expect(result.contentType).toBe('pdf')
    }
    const [, init] = (vi.mocked(fetch).mock.calls[0] ?? []) as [string, RequestInit?]
    expect((init?.headers as Record<string, string>)['Accept']).toMatch(/application\/pdf/)
  })

  it('sends browser-like headers so vendor hosts do not 403 bare fetch clients', async () => {
    const html = new TextEncoder().encode('<html><body><p>specs</p></body></html>')
    vi.stubGlobal('fetch', mockFetchOnce(html, { 'content-type': 'text/html' }))
    await fetchDatasheetText('https://vendor.example/spec')
    const [, init] = (vi.mocked(fetch).mock.calls[0] ?? []) as [string, RequestInit?]
    const headers = init?.headers as Record<string, string>
    expect(headers['User-Agent']).toMatch(/Mozilla/)
    expect(init?.signal).toBeDefined()
  })

  it('explains 403 hosts instead of a bare HTTP status', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(new Uint8Array(0), {}, 403))
    await expect(fetchDatasheetText('https://vendor.example/ds.pdf')).rejects.toThrow(/refused|block/i)
  })

  it('extracts text from HTML spec pages', async () => {
    const html = new TextEncoder().encode(
      '<html><head><style>.x{}</style></head><body><h1>IMX264</h1><p>2/3 inch sensor</p></body></html>',
    )
    vi.stubGlobal('fetch', mockFetchOnce(html, { 'content-type': 'text/html; charset=utf-8' }))
    const result = await fetchDatasheetText('https://vendor.example/imx264')
    expect(result.contentType).toBe('html')
    expect(result.text).toMatch(/IMX264/)
    expect(result.text).not.toMatch(/\.x\{\}/)
  })

  it('rejects opaque binary blobs with a helpful message', async () => {
    const blob = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0xff, 0xfe])
    vi.stubGlobal('fetch', mockFetchOnce(blob, { 'content-type': 'application/octet-stream' }))
    await expect(fetchDatasheetText('https://example.com/blob')).rejects.toThrow(/did not return a pdf/i)
  })
})

describe('missing API key handling', () => {
  it('flags the sentinel error so handlers can return 503', async () => {
    const { isMissingApiKeyError, MISSING_API_KEY_MESSAGE } = await import('./callExtractionModel.js')
    expect(isMissingApiKeyError(new Error('MISSING_ANTHROPIC_API_KEY: nope'))).toBe(true)
    expect(isMissingApiKeyError(new Error('other'))).toBe(false)
    expect(MISSING_API_KEY_MESSAGE).not.toMatch(/LEARNINGS\.md/)
    expect(MISSING_API_KEY_MESSAGE).toMatch(/ANTHROPIC_API_KEY|manually/i)
  })
})

describe('PDF error taxonomy', () => {
  it('reports encrypted PDFs explicitly', async () => {
    const stub = new TextEncoder().encode('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R /Encrypt 5 0 R >>\nendobj\n')
    vi.stubGlobal('fetch', mockFetchOnce(stub, { 'content-type': 'application/pdf' }))
    const err = await fetchDatasheetText('https://example.com/enc.pdf').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(DatasheetError)
    expect((err as DatasheetError).code).toBe('PDF_ENCRYPTED')
    expect((err as DatasheetError).status).toBe(502)
    expect((err as Error).message).toMatch(/password-protected|encrypted/i)
  })

  it('reports corrupt PDFs explicitly', async () => {
    const stub = new TextEncoder().encode('%PDF-1.4\n% this is not a real pdf, just a header and garbage\n')
    vi.stubGlobal('fetch', mockFetchOnce(stub, { 'content-type': 'application/pdf' }))
    const err = await fetchDatasheetText('https://example.com/corrupt.pdf').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(DatasheetError)
    expect((err as DatasheetError).code).toBe('PDF_CORRUPT')
    expect((err as Error).message).toMatch(/could not parse that file as a pdf/i)
  })

  it('signals image-only PDFs with per-page evidence instead of generic 422', async () => {
    const pdf = makeMinimalPdf([[], [], []]) // 3 pages, no text runs
    vi.stubGlobal('fetch', mockFetchOnce(pdf, { 'content-type': 'application/pdf' }))
    const err = await fetchDatasheetText('https://example.com/scan.pdf').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(DatasheetError)
    expect((err as DatasheetError).code).toBe('PDF_IMAGE_ONLY')
    expect((err as DatasheetError).status).toBe(422)
    expect((err as Error).message).toMatch(/image-only/i)
    expect((err as Error).message).toMatch(/pages 1-3/)
  })

  it('parses real text PDFs with layout and per-page char counts', async () => {
    const pdf = makeMinimalPdf([
      ['Sony IMX264 global shutter', 'Resolution 2448 x 2048'],
      ['Pixel size 3.45 um'],
    ])
    vi.stubGlobal('fetch', mockFetchOnce(pdf, { 'content-type': 'application/pdf' }))
    const result = await fetchDatasheetText('https://example.com/imx264.pdf')
    expect(result.contentType).toBe('pdf')
    expect(result.text).toMatch(/IMX264/)
    expect(result.text).toMatch(/\n/) // layout newlines preserved, not one soup line
    expect(result.pageCharCounts).toHaveLength(2)
    expect(result.pageCharCounts?.every((c) => c > 0)).toBe(true)
  })

  it('caps PDF pages at MAX_PDF_PAGES', async () => {
    const pages = Array.from({ length: MAX_PDF_PAGES + 5 }, (_, i) => [`Page ${i + 1} sensor specs IMX264 resolution text`])
    const pdf = makeMinimalPdf(pages)
    vi.stubGlobal('fetch', mockFetchOnce(pdf, { 'content-type': 'application/pdf' }))
    const result = await fetchDatasheetText('https://example.com/big.pdf')
    expect(result.pageCharCounts).toHaveLength(MAX_PDF_PAGES)
    expect(result.text).toMatch(/Page 1/)
    expect(result.text).not.toMatch(new RegExp(`Page ${MAX_PDF_PAGES + 5}\\b`))
  })
})

describe('assemblePageText layout heuristics', () => {
  it('keeps rows on separate lines and marks column gaps', () => {
    const text = assemblePageText([
      { str: 'Resolution', transform: [1, 0, 0, 1, 72, 720], width: 50, hasEOL: false },
      { str: '2448 x 2048', transform: [1, 0, 0, 1, 300, 720], width: 60, hasEOL: true },
      { str: 'FPS', transform: [1, 0, 0, 1, 72, 700], width: 20, hasEOL: false },
      { str: '35.7', transform: [1, 0, 0, 1, 300, 700], width: 20, hasEOL: true },
    ])
    const lines = text.split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatch(/Resolution.*\|.*2448 x 2048/)
    expect(lines[1]).toMatch(/FPS.*\|.*35\.7/)
  })
})

describe('size limits', () => {
  it('rejects oversized content-length headers without downloading', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchOnce(new Uint8Array(8), {
        'content-type': 'application/pdf',
        'content-length': String(20 * 1024 * 1024),
      }),
    )
    const err = await fetchDatasheetText('https://example.com/huge.pdf').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(DatasheetError)
    expect((err as DatasheetError).code).toBe('PAYLOAD_TOO_LARGE')
    expect((err as DatasheetError).status).toBe(502)
  })

  it('catches hosts that lie about content-length (small header, huge body)', async () => {
    const big = new Uint8Array(MAX_BYTES + 1) // zeros — content-agnostic, size check fires first
    vi.stubGlobal(
      'fetch',
      mockFetchOnce(big, { 'content-type': 'text/html', 'content-length': '100' }),
    )
    const err = await fetchDatasheetText('https://example.com/lie').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(DatasheetError)
    expect((err as DatasheetError).code).toBe('PAYLOAD_TOO_LARGE')
  })
})

describe('HTML upgrades', () => {
  it('extracts octet-stream HTML pages instead of rejecting them', async () => {
    htmlFetch(
      '<html><body><h1>LM25HC lens</h1><p>25mm F1.4 C-mount</p></body></html>',
      'application/octet-stream',
    )
    const result = await fetchDatasheetText('https://static.example.com/file?id=123')
    expect(result.text).toMatch(/LM25HC/)
  })

  it('strips header/aside/form chrome', async () => {
    htmlFetch(
      '<html><body><header>HEADERJUNK nav</header><aside>ASIDEJUNK promo</aside>' +
        '<form>FORMJUNK search</form><main><p>Real spec IMX264</p></main></body></html>',
    )
    const result = await fetchDatasheetText('https://vendor.example/spec')
    expect(result.text).toMatch(/Real spec IMX264/)
    expect(result.text).not.toMatch(/HEADERJUNK/)
    expect(result.text).not.toMatch(/ASIDEJUNK/)
    expect(result.text).not.toMatch(/FORMJUNK/)
  })

  it('extracts tables row-wise as "key: value"', async () => {
    htmlFetch(
      '<html><body><h1>Spec table</h1><table>' +
        '<tr><th>Resolution</th><td>2448 x 2048</td></tr>' +
        '<tr><td>Frame rate</td><td>35.7 fps</td></tr>' +
        '</table></body></html>',
    )
    const result = await fetchDatasheetText('https://vendor.example/spec')
    expect(result.text).toMatch(/Resolution: 2448 x 2048/)
    expect(result.text).toMatch(/Frame rate: 35\.7 fps/)
  })

  it('pulls JSON-LD and meta spec fields', async () => {
    htmlFetch(
      '<html><head>' +
        '<meta name="description" content="METASPEC IMX264 global shutter sensor">' +
        '<script type="application/ld+json">{"@type": "Product", "name": "JSONLD-IMX264", "model": "IMX264"}</script>' +
        '</head><body><p>page body</p></body></html>',
    )
    const result = await fetchDatasheetText('https://vendor.example/spec')
    expect(result.text).toMatch(/JSONLD-IMX264/)
    expect(result.text).toMatch(/METASPEC IMX264/)
  })

  it('caps HTML output chars', async () => {
    htmlFetch(`<html><body><p>${'spec-word '.repeat(20000)}</p></body></html>`)
    const result = await fetchDatasheetText('https://vendor.example/huge')
    expect(result.text.length).toBeLessThanOrEqual(HTML_MAX_CHARS)
  })
})
