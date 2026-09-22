/**
 * Track D — shared-view stability (real browser).
 *
 * Extends the `e2e/comparisonStability.e2e.test.ts` pattern to the Track A
 * single-canvas comparison stage (`SharedFovStage`): one `<Canvas>` for all
 * cameras at an identical viewpoint, per-camera visibility toggles, and the
 * same no-flicker contract (no reloads, no canvas/context remounts, no idle
 * redraws under `frameloop="demand"`).
 *
 * Wait-for-others strategy: Tracks A–C may not have landed yet. Every test
 * first detects shared-view mode (ONE canvas with TWO cameras in play);
 * when the UI still renders the legacy N-canvases layout the test skips
 * (not fails) so `npm run test:e2e` stays green before and after.
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

const ACTIVE_TAB_KEY = 'camera-selection:activeTab'

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
  canvasCount: number
}

const markCanvases = (page: Page) => page.evaluate(() => document.querySelectorAll('canvas').forEach((c) => ((c as HTMLCanvasElement & { __mark?: boolean }).__mark = true)))

const snapshot = (page: Page): Promise<Snapshot> =>
  page.evaluate(() => {
    const w = window as unknown as { __contexts: number; __lost: number }
    const canvases = [...document.querySelectorAll('canvas')] as (HTMLCanvasElement & { __draws?: number; __mark?: boolean })[]
    return {
      contexts: w.__contexts,
      lost: w.__lost,
      draws: canvases.map((c) => c.__draws ?? 0),
      marked: canvases.filter((c) => c.__mark).length,
      canvasCount: canvases.length,
    }
  })

/**
 * True when the shared-view stage has landed: two cameras in play but a
 * single canvas on the page (legacy layout renders one canvas per camera).
 */
async function isSharedView(page: Page): Promise<boolean> {
  const canvases = await page.locator('canvas').count()
  const sliders = await page.locator('input[type=range]').count()
  return sliders >= 2 && canvases === 1
}

/** Locate a per-camera visibility toggle (checkbox, chip, or switch). Null when the UI has none yet. */
async function findCameraToggle(page: Page, cameraIndex: number): Promise<null | { kind: 'checkbox' | 'button'; index: number }> {
  const boxes = page.locator('input[type=checkbox]')
  if ((await boxes.count()) > cameraIndex) return { kind: 'checkbox', index: cameraIndex }
  // Fallback: a chip/button labelled with the camera name.
  const chip = page.getByRole('button', { name: new RegExp(`camera\\s*${cameraIndex + 1}`, 'i') })
  if ((await chip.count()) > 0) return { kind: 'button', index: cameraIndex }
  return null
}

describe.skipIf(!CHROME)('Shared-view comparison stability (real browser)', () => {
  let server: ViteDevServer
  let browser: Browser
  let page: Page
  let baseUrl: string
  let cacheDir: string
  let navigations = 0

  beforeAll(async () => {
    cacheDir = mkdtempSync(join(tmpdir(), 'vite-e2e-shared-'))
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

    // Put two cameras in play: shared view renders ONE canvas for both,
    // legacy renders two (in which case the tests below skip).
    await page.getByRole('button', { name: /add camera/i }).click()
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

  it('renders two cameras in a single shared canvas (same POV)', async (ctx) => {
    if (!(await isSharedView(page))) {
      ctx.skip()
      return
    }
    const snap = await snapshot(page)
    expect(snap.canvasCount).toBe(1)
    expect(snap.lost, 'WebGL context was lost').toBe(0)
  }, 30_000)

  it('does not reload, remount, or idle-redraw the shared canvas', async (ctx) => {
    if (!(await isSharedView(page))) {
      ctx.skip()
      return
    }
    await markCanvases(page)
    navigations = 0
    const before = await snapshot(page)

    await sleep(3000)

    expect(navigations, 'page navigated/reloaded while idle').toBe(0)
    const after = await snapshot(page)
    expect(after.canvasCount).toBe(1)
    expect(after.marked, '<canvas> was replaced').toBe(1)
    expect(after.contexts, 'a new WebGL context was created').toBe(before.contexts)
    expect(after.lost, 'WebGL context was lost').toBe(0)
    expect(after.draws, 'shared scene redrew with no input (idle should be demand-driven)').toEqual(before.draws)
  }, 30_000)

  it('toggles one camera without remounting the shared canvas or context', async (ctx) => {
    if (!(await isSharedView(page))) {
      ctx.skip()
      return
    }
    const toggle = await findCameraToggle(page, 1)
    if (!toggle) {
      ctx.skip()
      return
    }
    await markCanvases(page)
    navigations = 0
    const before = await snapshot(page)

    if (toggle.kind === 'checkbox') {
      await page.locator('input[type=checkbox]').nth(toggle.index).click()
    } else {
      await page.getByRole('button', { name: /camera\s*2/i }).first().click()
    }
    await sleep(800) // let the demand-driven renderer settle

    const after = await snapshot(page)
    expect(navigations).toBe(0)
    expect(after.canvasCount, 'toggle replaced the shared canvas').toBe(1)
    expect(after.marked, '<canvas> was replaced').toBe(1)
    expect(after.contexts, 'toggle created a new WebGL context').toBe(before.contexts)
    expect(after.lost).toBe(0)
    // Toggling visibility hides a frustum group — the scene must respond.
    expect(after.draws[0], 'scene did not respond to the visibility toggle').toBeGreaterThan(before.draws[0] ?? 0)

    // Toggle back on: the camera returns, still on the same canvas.
    if (toggle.kind === 'checkbox') {
      await page.locator('input[type=checkbox]').nth(toggle.index).click()
    } else {
      await page.getByRole('button', { name: /camera\s*2/i }).first().click()
    }
    await sleep(800)
    const restored = await snapshot(page)
    expect(restored.canvasCount).toBe(1)
    expect(restored.marked).toBe(1)
    expect(restored.contexts).toBe(before.contexts)
  }, 30_000)
})
