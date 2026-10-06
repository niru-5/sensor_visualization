/**
 * End-to-end tests for POST /api/extract-datasheet with mocked network +
 * mocked model. Global fetch stands in for vendor hosts; the Anthropic SDK
 * module is mocked so no API key or network is needed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Anthropic from '@anthropic-ai/sdk'
import handler from './extract-datasheet.js'

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(),
}))

const AnthropicMock = Anthropic as unknown as ReturnType<typeof vi.fn>
let createMock: ReturnType<typeof vi.fn>

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

function toolUseMessage(name: string, input: Record<string, unknown>) {
  return { content: [{ type: 'tool_use', id: 'toolu_1', name, input }] }
}

const SPEC_HTML =
  '<html><body><h1>Sony IMX264</h1><p>2/3 inch global shutter sensor, 2448 x 2048, 3.45um, 35.7fps</p></body></html>'

const SENSOR_INPUT = {
  name: 'Sony IMX264',
  opticalFormat: '2/3"',
  widthMm: 8.4,
  heightMm: 7.1,
  resolutionH: 2448,
  resolutionV: 2048,
  pixelPitchUm: 3.45,
  mount: 'C',
  cameraInterface: 'GigE Vision',
  shutter: 'global',
  fps: 35.7,
  trigger: 'hardware + software',
}

const LENS_INPUT = {
  name: 'LM25HC',
  focalLengthMm: 25,
  mount: 'C',
  imageCircleMm: 16,
  maxAperture: 1.4,
  resolvingPowerLpMm: 120,
  modMm: 100,
  distortionPct: -0.1,
  weightG: 50,
  driverNote: null,
}

type ReqInit = { method?: string; body?: unknown; ip?: string }
let ipSeq = 0

function callApi(init: ReqInit = {}) {
  const req = {
    method: init.method ?? 'POST',
    headers: { 'x-forwarded-for': init.ip ?? `10.9.${ipSeq++}.1` },
    body: init.body,
  }
  let statusCode = 0
  let payload: unknown
  const res = {
    status(code: number) {
      statusCode = code
      return res
    },
    json(body: unknown) {
      payload = body
    },
  }
  return handler(
    req as unknown as Parameters<typeof handler>[0],
    res as unknown as Parameters<typeof handler>[1],
  ).then(() => ({ statusCode, payload: payload as Record<string, unknown> }))
}

beforeEach(() => {
  // NOTE: ipSeq is intentionally NOT reset — the in-memory rate limiter
  // persists per test file, so every call needs a fresh IP except the
  // rate-limit test's fixed one.
  process.env.ANTHROPIC_API_KEY = 'test-key'
  createMock = vi.fn()
  // NOTE: function (not arrow) — the code does `new Anthropic(...)`.
  AnthropicMock.mockImplementation(function () {
    return { messages: { create: createMock } }
  } as never)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  process.env.ANTHROPIC_API_KEY = 'test-key'
})

describe('extract-datasheet happy paths', () => {
  it('extracts sensor specs with 200', async () => {
    htmlFetch(SPEC_HTML)
    createMock.mockResolvedValue(toolUseMessage('record_sensor_specs', SENSOR_INPUT))
    const { statusCode, payload } = await callApi({
      body: { url: 'https://vendor.example/imx264', kind: 'sensor' },
    })
    expect(statusCode).toBe(200)
    expect(payload['kind']).toBe('sensor')
    const fields = payload['fields'] as Record<string, { value: unknown; found: boolean }>
    expect(fields['name']).toEqual({ value: 'Sony IMX264', found: true })
    expect(fields['resolutionH']).toEqual({ value: 2448, found: true })
    expect(fields['mount']).toEqual({ value: 'C', found: true })
  })

  it('extracts lens specs with 200', async () => {
    htmlFetch('<html><body><h1>LM25HC</h1><p>25mm F1.4 C-mount lens</p></body></html>')
    createMock.mockResolvedValue(toolUseMessage('record_lens_specs', LENS_INPUT))
    const { statusCode, payload } = await callApi({
      body: { url: 'https://vendor.example/lm25hc', kind: 'lens' },
    })
    expect(statusCode).toBe(200)
    expect(payload['kind']).toBe('lens')
    const fields = payload['fields'] as Record<string, { value: unknown }>
    expect(fields['focalLengthMm']?.value).toBe(25)
    expect(fields['maxAperture']?.value).toBe(1.4)
  })

  it('sanitizes partial/garbage model output and still returns 200', async () => {
    htmlFetch(SPEC_HTML)
    createMock.mockResolvedValue(
      toolUseMessage('record_sensor_specs', {
        name: '  IMX264  ',
        opticalFormat: 'N/A',
        widthMm: 'unknown',
        heightMm: '',
        resolutionH: '2448',
        resolutionV: 2048,
        pixelPitchUm: '2/3"',
        mount: 'XYZ-mount',
        cameraInterface: 'none',
        shutter: '-',
        fps: 'N/A',
        trigger: '  hardware trigger  ',
        inventedKey: 'drop me',
      }),
    )
    const { statusCode, payload } = await callApi({
      body: { url: 'https://vendor.example/imx264', kind: 'sensor' },
    })
    expect(statusCode).toBe(200)
    const fields = payload['fields'] as Record<string, { value: unknown; found: boolean }>
    expect(fields['name']).toEqual({ value: 'IMX264', found: true })
    expect(fields['opticalFormat']).toEqual({ value: null, found: false })
    expect(fields['widthMm']).toEqual({ value: null, found: false })
    expect(fields['resolutionH']).toEqual({ value: 2448, found: true })
    expect(fields['pixelPitchUm']).toEqual({ value: null, found: false })
    expect(fields['mount']).toEqual({ value: null, found: false })
    expect(fields['fps']).toEqual({ value: null, found: false })
    expect(fields['trigger']).toEqual({ value: 'hardware trigger', found: true })
    expect(fields).not.toHaveProperty('inventedKey')
  })
})

describe('extract-datasheet upstream failures', () => {
  it('returns 422 with EMPTY_CONTENT when the page has no text', async () => {
    htmlFetch('<html><body>   </body></html>')
    const { statusCode, payload } = await callApi({
      body: { url: 'https://vendor.example/empty', kind: 'sensor' },
    })
    expect(statusCode).toBe(422)
    expect(payload['code']).toBe('EMPTY_CONTENT')
    expect(createMock).not.toHaveBeenCalled()
  })

  it('maps 404 to 502', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(new Uint8Array(0), {}, 404))
    const { statusCode, payload } = await callApi({
      body: { url: 'https://vendor.example/gone', kind: 'sensor' },
    })
    expect(statusCode).toBe(502)
    expect(payload['code']).toBe('UPSTREAM_NOT_FOUND')
  })

  it('maps 403 to 502', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(new Uint8Array(0), {}, 403))
    const { statusCode, payload } = await callApi({
      body: { url: 'https://vendor.example/blocked', kind: 'lens' },
    })
    expect(statusCode).toBe(502)
    expect(payload['code']).toBe('UPSTREAM_FORBIDDEN')
  })

  it('maps fetch timeouts to 502', async () => {
    const timeout = Object.assign(new Error('The operation timed out'), { name: 'TimeoutError' })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(timeout))
    const { statusCode, payload } = await callApi({
      body: { url: 'https://slow.example.com/ds.pdf', kind: 'sensor' },
    })
    expect(statusCode).toBe(502)
    expect(payload['code']).toBe('FETCH_TIMEOUT')
  })

  it('maps oversized datasheets to 502', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchOnce(new Uint8Array(8), {
        'content-type': 'application/pdf',
        'content-length': String(20 * 1024 * 1024),
      }),
    )
    const { statusCode, payload } = await callApi({
      body: { url: 'https://vendor.example/huge.pdf', kind: 'sensor' },
    })
    expect(statusCode).toBe(502)
    expect(payload['code']).toBe('PAYLOAD_TOO_LARGE')
  })
})

describe('extract-datasheet request/config failures', () => {
  it('returns 503 when the API key is missing', async () => {
    delete process.env.ANTHROPIC_API_KEY
    htmlFetch(SPEC_HTML)
    const { statusCode, payload } = await callApi({
      body: { url: 'https://vendor.example/imx264', kind: 'sensor' },
    })
    expect(statusCode).toBe(503)
    expect(payload['code']).toBe('MISSING_API_KEY')
  })

  it('returns 405 for non-POST methods', async () => {
    const { statusCode } = await callApi({ method: 'GET', body: { url: 'https://x.example', kind: 'sensor' } })
    expect(statusCode).toBe(405)
  })

  it('returns 400 for a missing kind', async () => {
    const { statusCode } = await callApi({ body: { url: 'https://vendor.example/x' } })
    expect(statusCode).toBe(400)
  })

  it('returns 400 for invalid JSON bodies', async () => {
    const { statusCode } = await callApi({ body: '{not valid json' })
    expect(statusCode).toBe(400)
  })

  it('returns 429 after too many requests from one IP', async () => {
    const ip = '10.8.8.8'
    htmlFetch(SPEC_HTML)
    createMock.mockResolvedValue(toolUseMessage('record_sensor_specs', SENSOR_INPUT))
    let last = { statusCode: 0, payload: {} as Record<string, unknown> }
    for (let i = 0; i < 11; i++) {
      last = await callApi({ body: { url: 'https://vendor.example/imx264', kind: 'sensor' }, ip })
    }
    expect(last.statusCode).toBe(429)
  })

  it('returns 500 when the model returns no tool_use block', async () => {
    htmlFetch(SPEC_HTML)
    createMock.mockResolvedValue({ content: [{ type: 'text', text: 'Sorry, no structured data.' }] })
    const { statusCode, payload } = await callApi({
      body: { url: 'https://vendor.example/imx264', kind: 'sensor' },
    })
    expect(statusCode).toBe(500)
    expect(payload['code']).toBe('MODEL_NO_TOOL_USE')
  })
})
