/**
 * Dev-server stability: writes to files that are not part of the app must
 * never make the browser reload.
 *
 * Regression for the "3D model keeps flickering" bug. The comparison tab is
 * the only tab that mounts a WebGL <Canvas>, and mounting it logs a console
 * warning. Vite forwards browser console output to the dev-server terminal, the
 * agent harness captures that terminal into a file inside the project root
 * (`.pi/tasks/**\/*.output`), and Tailwind v4's Vite plugin used to auto-scan
 * and watch every non-gitignored file in the project — so that log write made
 * Vite send `full-reload`. The reloaded page mounted the canvas again, warned
 * again, and the loop repeated roughly every 0.7s.
 *
 * This starts a real Vite dev server with the project's own config and
 * listens on its HMR websocket, exactly as the browser does.
 */
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer, type ViteDevServer } from 'vite'

const ROOT = resolve(import.meta.dirname, '..')
const RUN_ID = `${process.pid}-${Date.now().toString(36)}`

/**
 * Files that must be inert. They are created *before* the server starts
 * because Tailwind only watches files that existed when it scanned.
 */
const PROBES = {
  'agent-harness log (.pi/tasks)': join(ROOT, '.pi', 'tasks', `vitest-${RUN_ID}`, 'session.output'),
  'any other non-source dir at the project root': join(ROOT, `vitest-probe-${RUN_ID}`, 'dev.output'),
} as const

interface HmrMessage {
  type: string
  [key: string]: unknown
}

let server: ViteDevServer
let baseUrl: string
let cacheDir: string
let socket: WebSocket
const received: HmrMessage[] = []

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Messages that make the client re-render or reload — anything but the handshake/ping. */
const disruptive = () => received.filter((m) => m.type === 'full-reload' || m.type === 'update')

beforeAll(async () => {
  for (const file of Object.values(PROBES)) {
    mkdirSync(resolve(file, '..'), { recursive: true })
    writeFileSync(file, '[web] pre-existing line\n')
  }

  // A throwaway cache dir keeps this test from touching node_modules/.vite,
  // which a developer's real dev server shares.
  cacheDir = mkdtempSync(join(tmpdir(), 'vite-cache-'))
  server = await createServer({
    root: ROOT,
    logLevel: 'silent',
    cacheDir,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { host: '127.0.0.1', port: 0 },
  })
  await server.listen()
  const address = server.httpServer?.address()
  if (!address || typeof address === 'string') throw new Error('dev server did not bind a TCP port')
  baseUrl = `http://127.0.0.1:${address.port}`

  // Requesting the stylesheet is what makes Tailwind scan the project and
  // register the files it will watch — same as the browser's first load.
  const css = await fetch(`${baseUrl}/src/index.css`)
  expect(css.ok).toBe(true)

  socket = new WebSocket(`ws://127.0.0.1:${address.port}/?token=${server.config.webSocketToken}`, 'vite-hmr')
  socket.addEventListener('message', (e) => received.push(JSON.parse(String(e.data)) as HmrMessage))
  await new Promise<void>((ok, fail) => {
    socket.addEventListener('open', () => ok())
    socket.addEventListener('error', () => fail(new Error('HMR websocket failed to connect')))
  })
  await sleep(200) // let the {"type":"connected"} handshake land
}, 30_000)

afterAll(async () => {
  socket?.close()
  await server?.close()
  rmSync(cacheDir, { recursive: true, force: true })
  rmSync(resolve(PROBES['agent-harness log (.pi/tasks)'], '..'), { recursive: true, force: true })
  rmSync(resolve(PROBES['any other non-source dir at the project root'], '..'), { recursive: true, force: true })
})

describe('dev server HMR', () => {
  it('delivers a full-reload to the test client when one is sent (positive control)', async () => {
    // Guards against a vacuous pass: if the socket/protocol setup were broken
    // the "no reload" assertions below would succeed for the wrong reason.
    received.length = 0
    server.environments.client.hot.send({ type: 'full-reload' })
    await sleep(200)
    expect(received.map((m) => m.type)).toContain('full-reload')
    received.length = 0
  })

  it.each(Object.entries(PROBES))('does not reload the page when %s is written', async (_label, file) => {
    received.length = 0
    // Repeated writes, like a terminal capture appending on every browser log line.
    for (let i = 0; i < 6; i++) {
      appendFileSync(file, `[web] [vite] (client) [console.warn] THREE.Clock: deprecated (${i})\n`)
      await sleep(100)
    }
    await sleep(500)
    expect(disruptive()).toEqual([])
  })

  it('still generates the utility classes the app uses (Tailwind sources not over-narrowed)', async () => {
    // Vite serves CSS as a JS module holding the stylesheet in a string literal.
    const module = await (await fetch(`${baseUrl}/src/index.css`)).text()
    const literal = /const __vite__css = ("(?:[^"\\]|\\.)*")/.exec(module)?.[1]
    expect(literal, 'could not find the stylesheet in the served module').toBeDefined()
    const css = JSON.parse(literal as string) as string
    // Classes used only in src/*.tsx (App.tsx, FovCone3D.tsx, ...).
    for (const cls of ['bg-slate-950', 'max-w-7xl', 'accent-sky-400', '320px_1fr']) {
      expect(css, `expected a rule for ${cls}`).toContain(cls)
    }
  })
})
