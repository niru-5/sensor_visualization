/**
 * Flow-redesign 3-pane coverage (real browser).
 *
 * Extends the `e2e/sharedViewStability.e2e.test.ts` pattern to the new
 * options / visualize / advise layout (`src/App.tsx`):
 *
 *   - all three panes render (left OptionsPanel, center SharedFovView
 *     single canvas, right AdvicePanel prompt box);
 *   - a left-pane filter narrows the camera options;
 *   - a right-pane prompt produces suggestion cards and [Use top-N in
 *     comparison] writes the pairs into the center slots — without
 *     remounting the shared canvas or creating a new WebGL context.
 *
 * Run with `npm run test:e2e`. Needs Chrome/Chromium: set CHROME_PATH or
 * install google-chrome / chromium. Skipped (not failed) when none is found.
 */
import { existsSync } from 'node:fs'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { chromium, type Browser, type Page } from 'playwright-core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer, type ViteDevServer } from 'vite'

const ROOT = resolve(import.meta.dirname, '..')
const CHROME = [process.env['CHROME_PATH'], '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(
  (p): p is string => !!p && existsSync(p),
)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Per-canvas WebGL bookkeeping, installed before any page script runs. */
function installProbe() {
  const w = window as unknown as { __contexts: number; __lost: number }
  w.__contexts = 0
  w.__lost = 0
  type Counted = HTMLCanvasElement & { __draws?: number }
  const getContext = HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext = function (this: Counted, ...args: Parameters<typeof getContext>) {
    w.__contexts++
    this.addEventListener('webglcontextlost', () => w.__lost++)
    return getContext.apply(this, args)
  } as typeof getContext
}

const markCanvases = (page: Page) => page.evaluate(() => document.querySelectorAll('canvas').forEach((c) => ((c as HTMLCanvasElement & { __mark?: boolean }).__mark = true)))

const snapshotCanvas = (page: Page): Promise<{ contexts: number; lost: number; count: number; marked: number }> =>
  page.evaluate(() => {
    const w = window as unknown as { __contexts: number; __lost: number }
    const canvases = [...document.querySelectorAll('canvas')] as (HTMLCanvasElement & { __mark?: boolean })[]
    return { contexts: w.__contexts, lost: w.__lost, count: canvases.length, marked: canvases.filter((c) => c.__mark).length }
  })

describe.skipIf(!CHROME)('Flow-redesign 3-pane layout (real browser)', () => {
  let server: ViteDevServer
  let browser: Browser
  let page: Page
  let baseUrl: string
  let cacheDir: string
  let navigations = 0

  beforeAll(async () => {
    cacheDir = mkdtempSync(join(tmpdir(), 'vite-e2e-flow-'))
    server = await createServer({ root: ROOT, logLevel: 'silent', cacheDir, server: { host: '127.0.0.1', port: 0 } })
    await server.listen()
    const address = server.httpServer?.address()
    if (!address || typeof address === 'string') throw new Error('dev server did not bind a TCP port')
    baseUrl = `http://127.0.0.1:${address.port}`

    browser = await chromium.launch({
      executablePath: CHROME,
      headless: true,
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    })
    page = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage()
    await page.addInitScript(installProbe)
    await page.addInitScript(() => {
      try {
        // Start from seed library + a single empty comparison slot.
        localStorage.removeItem('camera-selection-tool/v1')
        localStorage.removeItem('camera-selection-tool/cameras-v1')
      } catch {
        /* ignore */
      }
    })

    // Warm-up load: Vite may pre-bundle dependencies and reload once the first
    // time it sees them. That is expected and must not count against the tests.
    await page.goto(baseUrl)
    await page.waitForSelector('canvas', { timeout: 60_000 })
    await page.waitForLoadState('networkidle')
    await sleep(1500)
    await page.reload()
    await page.waitForSelector('canvas')
    await sleep(1500)

    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) navigations++
    })
  }, 120_000)

  afterAll(async () => {
    await browser?.close()
    await server?.close()
    rmSync(cacheDir, { recursive: true, force: true })
  })

  it('renders all three panes: options left, shared stage center, advice right', async () => {
    // Left — options panel sections.
    for (const name of ['Cameras', 'Lenses', 'Environment']) {
      const heading = page.getByRole('heading', { name })
      expect(await heading.count(), `left pane heading "${name}" missing`).toBeGreaterThan(0)
      expect(await heading.first().isVisible(), `left pane heading "${name}" not visible`).toBe(true)
    }
    expect(await page.getByLabel('Search cameras').count(), 'camera search box missing').toBeGreaterThan(0)

    // Center — comparison stage: exactly one shared canvas.
    const comparison = page.getByRole('heading', { name: 'Comparison' })
    expect(await comparison.count(), 'center Comparison heading missing').toBeGreaterThan(0)
    expect(await page.locator('canvas').count(), 'center stage is not a single shared canvas').toBe(1)

    // Right — advice panel prompt box.
    const ask = page.getByRole('heading', { name: 'Ask' })
    expect(await ask.count(), 'right Ask heading missing').toBeGreaterThan(0)
    expect(await page.getByPlaceholder('What should I pick, and why?').count(), 'advice prompt box missing').toBeGreaterThan(0)
    expect(await page.getByRole('button', { name: 'Ask', exact: true }).count(), 'Ask button missing').toBeGreaterThan(0)
  }, 30_000)

  it('narrows the camera options when a left-pane filter is applied', async () => {
    const search = page.getByLabel('Search cameras')
    expect(await search.count(), 'camera search box missing').toBeGreaterThan(0)
    const emptyMsg = page.getByText('No cameras match these filters.')
    expect(await emptyMsg.count()).toBe(0)

    await search.fill('zzz-no-such-camera')
    await page.waitForFunction(() => document.body.textContent?.includes('No cameras match these filters.') ?? false)
    expect(await emptyMsg.count()).toBeGreaterThan(0)

    await search.fill('')
    await page.waitForFunction(() => !(document.body.textContent?.includes('No cameras match these filters.') ?? true))
    expect(await emptyMsg.count()).toBe(0)
    // Seed library is back: a known seed camera row renders.
    const seedRow = page.getByText('Sony IMX264 (2464 x 2056, 2/3")')
    expect(await seedRow.count(), 'seed camera row missing after clearing the filter').toBeGreaterThan(0)
  }, 30_000)

  it('drives a right-pane suggestion into the center comparison via Use-top-N', async () => {
    await markCanvases(page)
    navigations = 0
    const before = await snapshotCanvas(page)
    expect(before.count).toBe(1)

    await page.getByPlaceholder('What should I pick, and why?').fill(
      'inspect 2 mm screws on a 300 mm tray from 500 mm, GigE, line moves fast',
    )
    await page.getByRole('button', { name: 'Ask', exact: true }).click()

    // Suggestion cards render with verdict + evidence.
    await page.waitForFunction(() => /^Answer \(\d+\)$/.test(document.body.textContent ?? '') || [...document.querySelectorAll('h2')].some((h) => /^Answer \(\d+\)$/.test(h.textContent ?? '')))
    expect(await page.locator('article').count(), 'no suggestion cards rendered').toBeGreaterThan(0)

    // Use-top-N writes the pairs into the center slots.
    await page.getByRole('button', { name: /use top-2 in comparison/i }).click()
    await page.waitForFunction(() => document.querySelectorAll('input[type=range]').length === 2)
    await sleep(1000)

    await page.waitForFunction(() => document.body.textContent?.includes('Camera 2') ?? false)
    expect(await page.locator('input[type=range]').count(), 'Use-top-N did not write center slots').toBe(2)

    // The shared stage absorbed the new slots without remounting.
    const after = await snapshotCanvas(page)
    expect(navigations, 'page navigated while applying suggestions').toBe(0)
    expect(after.count, 'Use-top-N replaced the shared canvas').toBe(1)
    expect(after.marked, 'the shared <canvas> was replaced').toBe(1)
    expect(after.contexts, 'applying suggestions created a new WebGL context').toBe(before.contexts)
    expect(after.lost, 'WebGL context was lost').toBe(0)
  }, 30_000)
})
