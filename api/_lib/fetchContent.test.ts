import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchDatasheetText } from './fetchContent.js'

function mockFetchOnce(buffer: Uint8Array, headers: Record<string, string>, status = 200) {
  const get = (name: string) => headers[name.toLowerCase()] ?? null
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: { get },
    arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  })
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
