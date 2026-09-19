/**
 * Real-browser regression tests for the "3D model keeps flickering" bug on the
 * Camera comparison tab.
 *
 * The symptom was the whole page reloading every ~0.7s (see
 * scripts/devServer.test.ts for the root cause). These tests assert the
 * user-visible contract directly, so they catch that loop *and* any other
 * cause of the same symptom — a remounting <Canvas>, a lost WebGL context, a
 * sibling panel redrawing when it shouldn't:
 *
 *   - the page never navigates once loaded, even while the dev-server log
 *     file is being written to;
 *   - each panel keeps the same <canvas> element and the same WebGL context;
 *   - a panel only redraws when something about *it* changed.
 *
 * Run with `npm run test:e2e`. Needs Chrome/Chromium: set CHROME_PATH or
 * install google-chrome / chromium. Skipped (not failed) when none is found.
 */
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { chromium, type Browser, type Page } from 'playwright-core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer, type ViteDevServer } from 'vite'

const ROOT = resolve(import.meta.dirname, '..')
const RUN_ID = `${process.pid}-${Date.now().toString(36)}`
const CHROME = [process.env['CHROME_PATH'], '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(
  (p): p is string => !!p && existsSync(p),
)

const ACTIVE_TAB_KEY = 'camera-selection:activeTab'
const LOG_FILES = [
  join(ROOT, '.pi', 'tasks', `e2e-${RUN_ID}`, 'session.output'), // where the agent harness captures dev-server output
  join(ROOT, `e2e-probe-${RUN_ID}`, 'dev.output'), // any other non-source file under the root
]

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
  for (const fn of ['drawElements', 'drawArrays'] as const) {
    const original = WebGL2RenderingContext.prototype[fn] as (...a: unknown[]) => void
    ;(WebGL2RenderingContext.prototype as unknown as Record<string, unknown>)[fn] = function (this: WebGL2RenderingContext, ...a: unknown[]) {
      const canvas = this.canvas as Counted
      canvas.__draws = (canvas.__draws ?? 0) + 1
      return original.apply(this, a)
    }
  }
}

interface Snapshot {
  contexts: number
  lost: number
  /** Draw calls per <canvas>, in DOM order. */
  draws: number[]
  /** How many canvases still carry the marker set by markCanvases(). */
  marked: number
}

const markCanvases = (page: Page) => page.evaluate(() => document.querySelectorAll('canvas').forEach((c) => ((c as HTMLCanvasElement & { __mark?: boolean }).__mark = true)))

const snapshot = (page: Page): Promise<Snapshot> =>
  page.evaluate(() => {
    const w = window as unknown as { __contexts: number; __lost: number }
    const canvases = [...document.querySelectorAll('canvas')] as (HTMLCanvasElement & { __draws?: number; __mark?: boolean })[]
    return { contexts: w.__contexts, lost: w.__lost, draws: canvases.map((c) => c.__draws ?? 0), marked: canvases.filter((c) => c.__mark).length }
  })

/** Set the n-th working-distance slider to each value in turn (fires the same input events as a drag). */
async function setSlider(page: Page, index: number, valuesMm: number[]) {
  for (const v of valuesMm) {
    await page.locator('input[type=range]').nth(index).fill(String(v))
    await sleep(30)
  }
  await sleep(500) // let the demand-driven renderer settle
}

/** Drag the n-th working-distance slider across part of its range in small steps. */
async function dragSlider(page: Page, index: number, fromFrac: number, toFrac: number) {
  const box = await page.locator('input[type=range]').nth(index).boundingBox()
  if (!box) throw new Error(`slider ${index} not found`)
  const y = box.y + box.height / 2
  await page.mouse.move(box.x + box.width * fromFrac, y)
  await page.mouse.down()
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(box.x + box.width * (fromFrac + ((toFrac - fromFrac) * i) / 12), y)
    await sleep(30)
  }
  await page.mouse.up()
  await sleep(500) // let the demand-driven renderer settle
}

describe.skipIf(!CHROME)('Camera comparison tab stability (real browser)', () => {
  let server: ViteDevServer
  let browser: Browser
  let page: Page
  let baseUrl: string
  let cacheDir: string
  let navigations = 0

  /** Append to the dev-server log files for `ms`, like a terminal capture of forwarded console output. */
  async function writeLogsFor(ms: number) {
    const end = Date.now() + ms
    while (Date.now() < end) {
      for (const f of LOG_FILES) appendFileSync(f, '[web] [vite] (client) [console.warn] THREE.Clock: deprecated\n')
      await sleep(150)
    }
  }

  beforeAll(async () => {
    // Created before the server starts: Tailwind only watches files it saw at scan time.
    for (const f of LOG_FILES) {
      mkdirSync(resolve(f, '..'), { recursive: true })
      writeFileSync(f, '[web] pre-existing line\n')
    }
    cacheDir = mkdtempSync(join(tmpdir(), 'vite-e2e-cache-'))
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
    await page.addInitScript((key) => {
      try {
        localStorage.setItem(key, 'comparison')
        // Start every test from a single-camera comparison view.
        localStorage.removeItem('camera-selection-tool/cameras-v1')
      } catch {
        /* ignore */
      }
    }, ACTIVE_TAB_KEY)

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
    for (const f of LOG_FILES) rmSync(resolve(f, '..'), { recursive: true, force: true })
  })

  it('does not reload or remount the 3D canvas while idle, even as the dev-server log is written to', async () => {
    await markCanvases(page)
    navigations = 0
    const before = await snapshot(page)

    await writeLogsFor(3000)

    expect(navigations, 'page navigated/reloaded while idle').toBe(0)
    const after = await snapshot(page)
    expect(after.marked, '<canvas> was replaced').toBe(1)
    expect(after.contexts, 'a new WebGL context was created').toBe(before.contexts)
    expect(after.lost, 'WebGL context was lost').toBe(0)
    expect(after.draws, 'scene redrew with no input (idle should be demand-driven)').toEqual(before.draws)
  }, 30_000)

  it('updates the scene on a working-distance change without remounting the canvas', async () => {
    await markCanvases(page)
    navigations = 0
    const before = await snapshot(page)

    await dragSlider(page, 0, 0.3, 0.55)

    const after = await snapshot(page)
    expect(navigations).toBe(0)
    expect(after.marked, '<canvas> was replaced').toBe(1)
    expect(after.contexts).toBe(before.contexts)
    expect(after.lost).toBe(0)
    expect(after.draws[0], 'scene did not respond to the slider').toBeGreaterThan(before.draws[0] ?? 0)
  }, 30_000)

  it('keeps existing panels mounted when a camera is added, and only redraws the panel that changed', async () => {
    await page.getByRole('button', { name: /add camera/i }).click()
    await page.waitForFunction(() => document.querySelectorAll('canvas').length === 2)
    await sleep(1000)

    await markCanvases(page)
    navigations = 0
    const before = await snapshot(page)
    expect(before.draws).toHaveLength(2)

    // Camera 2 starts equal to camera 1 (300mm). Moving it *down* leaves the
    // shared scale (the max working distance) unchanged, so camera 1's scene
    // has no reason to redraw. (Exact values, not a mouse drag: pressing the
    // track at some fraction would jump above 300mm and legitimately rescale.)
    await setSlider(page, 1, [290, 270, 250, 230, 210, 190, 170, 150])

    const after = await snapshot(page)
    expect(navigations).toBe(0)
    expect(after.marked, 'a <canvas> was replaced').toBe(2)
    expect(after.contexts).toBe(before.contexts)
    expect(after.lost).toBe(0)
    expect(after.draws[1], 'camera 2 did not respond to its slider').toBeGreaterThan(before.draws[1] ?? 0)
    expect(after.draws[0], 'camera 1 redrew although nothing about it changed').toBe(before.draws[0])
  }, 30_000)
})
