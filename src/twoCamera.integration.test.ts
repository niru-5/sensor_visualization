import { beforeEach, describe, expect, it } from 'vitest'
import {
  CAMERAS_STORAGE_KEY,
  addCameraSlot,
  computeTwoCameraView,
  createSlot,
  loadCameraSlots,
  parseCameraSlots,
  saveCameraSlots,
  updateCameraSlot,
} from './lib/twoCamera'
import { SEED_LENSES, SEED_SENSORS } from './lib/seedData'

/**
 * Integration coverage for the 2-camera comparison flow without React:
 * exercises the same lib helpers + persistence key App.tsx wires together
 * (add second panel → change WD → FOV/flags/table/overlay update → reload).
 */

function must<T>(v: T | undefined, what: string): T {
  if (v === undefined) throw new Error(`fixture missing: ${what}`)
  return v
}

const imx264 = must(SEED_SENSORS.find((s) => s.id === 'seed-sensor-imx264'), 'IMX264')
const imx178 = must(SEED_SENSORS.find((s) => s.id === 'seed-sensor-imx178'), 'IMX178')
const cil532 = must(SEED_LENSES.find((l) => l.id === 'seed-lens-commonlands-cil532'), 'CIL532 12mm')
const cil525 = must(SEED_LENSES.find((l) => l.id === 'seed-lens-commonlands-cil525'), 'CIL525 25mm')

// Minimal in-memory localStorage so persistence is exercised under node.
function installMemoryStorage() {
  const store = new Map<string, string>()
  const storage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v))
    },
    removeItem: (k: string) => {
      store.delete(k)
    },
    clear: () => store.clear(),
  }
  Object.defineProperty(globalThis, 'window', { value: { localStorage: storage }, configurable: true, writable: true })
  return { store, storage }
}

beforeEach(() => {
  installMemoryStorage()
})

describe('two-camera integration flow', () => {
  it('add-2-panels: second panel seeds from the first and both resolve side by side', () => {
    let cameras = [createSlot(imx264.id, cil532.id, 300)]
    cameras = addCameraSlot(cameras)
    // Tweak one thing on panel 2: different lens, same sensor — the classic A/B.
    cameras = updateCameraSlot(cameras, cameras[1]!.id, { lensId: cil525.id }, [cil532, cil525])

    const view = computeTwoCameraView([imx264], [cil532, cil525], cameras)
    expect(view.resolved).toHaveLength(2)
    expect(view.playLenses).toHaveLength(2)
    // Both panels render (overlay labels present) at a shared 1:1 scale.
    expect(view.overlays).toHaveLength(2)
    expect(view.overlays[0]).toMatch(/@ 300mm/)
    expect(view.overlays[1]).toMatch(/@ 300mm/)
    expect(view.sharedScale).toBe(300)
    // Table covers both in-play lenses against camera 1's sensor.
    expect(view.tableRows.map((r) => r.lensId).sort()).toEqual([cil525.id, cil532.id].sort())
  })

  it('WD change updates FOV readout, risk flags, table rows, and overlay labels together', () => {
    let cameras = [createSlot(imx264.id, cil532.id, 300)]
    cameras = addCameraSlot(cameras)
    cameras = updateCameraSlot(cameras, cameras[1]!.id, { lensId: cil525.id }, [cil532, cil525])

    const before = computeTwoCameraView([imx264], [cil532, cil525], cameras)
    const fovBefore = before.tableRows.find((r) => r.lensId === cil532.id)?.fovHmm
    // 8.4996mm sensor, 12mm lens @300mm → ~204mm wide
    expect(fovBefore).toBeCloseTo(204.0, 0)

    // Move camera 1 far out: 300 → 600mm must shrink... grow FOV ~2x and refresh everything.
    cameras = updateCameraSlot(cameras, cameras[0]!.id, { workingDistanceMm: 600 })
    const after = computeTwoCameraView([imx264], [cil532, cil525], cameras)

    // 1) FOV readout value updates.
    const fovAfter = after.tableRows.find((r) => r.lensId === cil532.id)?.fovHmm
    expect(fovAfter).toBeCloseTo(416.5, 0)
    expect(fovAfter).toBeGreaterThan((fovBefore ?? 0) * 1.9)
    // 2) Risk flags recompute (normal at both WDs here; macro path pinned below).
    expect(after.tableRows.find((r) => r.lensId === cil532.id)?.risk).toBe('normal')
    expect(after.tableRows.find((r) => r.lensId === cil532.id)?.valid).toBe(true)
    // 3) Table WD tracks camera 1.
    expect(after.tableWd).toBe(600)
    // 4) Overlay label for the moved panel updates.
    expect(after.overlays[0]).toMatch(/@ 600mm/)
    // 5) Shared 1:1 scale follows the max WD.
    expect(after.sharedScale).toBe(600)
  })

  it('macro WD flags the risk path on FOV, table, and overlay simultaneously', () => {
    // 12mm lens at 24mm WD → m = 1.0 → macro regime.
    const cameras = [createSlot(imx264.id, cil532.id, 24)]
    const view = computeTwoCameraView([imx264], [cil532], cameras)
    expect(view.tableRows[0]?.risk).toBe('macro')
    expect(view.tableRows[0]?.valid).toBe(true)
    // Overlay still renders the (approximate) numbers; the readout badge path keys off the same risk.
    expect(view.overlays[0]).toMatch(/FOV/)
  })

  it('second panel with its own sensor+WD keeps an independent FOV while sharing scale', () => {
    let cameras = [createSlot(imx264.id, cil532.id, 300)]
    cameras = addCameraSlot(cameras)
    cameras = updateCameraSlot(cameras, cameras[1]!.id, { sensorId: imx178.id }, [cil532, cil525])
    cameras = updateCameraSlot(cameras, cameras[1]!.id, { workingDistanceMm: 800 })

    const view = computeTwoCameraView([imx264, imx178], [cil532], cameras)
    expect(view.playSensors).toHaveLength(2)
    expect(view.overlays[0]).toMatch(/@ 300mm/)
    expect(view.overlays[1]).toMatch(/@ 800mm/)
    expect(view.overlays[0]).not.toBe(view.overlays[1])
    expect(view.sharedScale).toBe(800)
  })

  it('reload persistence: saved slots survive a simulated reload via the same storage key', () => {
    let cameras = [createSlot(imx264.id, cil532.id, 300)]
    cameras = addCameraSlot(cameras)
    cameras = updateCameraSlot(cameras, cameras[1]!.id, { lensId: cil525.id }, [cil532, cil525])
    cameras = updateCameraSlot(cameras, cameras[0]!.id, { workingDistanceMm: 450 })

    saveCameraSlots(cameras)
    // Raw payload is under the namespaced cameras key.
    const w = globalThis as unknown as { window: { localStorage: Storage } }
    const raw = w.window.localStorage.getItem(CAMERAS_STORAGE_KEY)
    expect(raw).toBeTruthy()
    expect(parseCameraSlots(JSON.parse(raw!))).toHaveLength(2)

    // Simulated reload: fresh load from storage restores both panels incl. WD + lens picks.
    const reloaded = loadCameraSlots()
    expect(reloaded).toHaveLength(2)
    expect(reloaded?.[0]?.workingDistanceMm).toBe(450)
    expect(reloaded?.[1]?.lensId).toBe(cil525.id)

    const view = computeTwoCameraView([imx264], [cil532, cil525], reloaded!)
    expect(view.resolved).toHaveLength(2)
    expect(view.tableWd).toBe(450)
    expect(view.overlays[0]).toMatch(/@ 450mm/)
  })

  it('comparison caps at 3 panels: a fourth add is a no-op and oversize payloads are rejected', () => {
    let cameras = [createSlot(imx264.id, cil532.id, 300)]
    cameras = addCameraSlot(cameras)
    cameras = addCameraSlot(cameras)
    expect(cameras).toHaveLength(3)
    expect(addCameraSlot(cameras)).toHaveLength(3)

    const view = computeTwoCameraView([imx264], [cil532, cil525], cameras)
    expect(view.resolved).toHaveLength(3)
    expect(view.overlays).toHaveLength(3)

    const oversize = [1, 2, 3, 4].map((i) => ({ id: `cam-${i}`, sensorId: imx264.id, lensId: cil532.id, workingDistanceMm: 300 }))
    expect(parseCameraSlots(oversize)).toBeNull()
  })

  it('reload with corrupt storage falls back to null (caller shows a single fresh panel)', () => {
    const w = globalThis as unknown as { window: { localStorage: Storage } }
    w.window.localStorage.setItem(CAMERAS_STORAGE_KEY, 'not-json{{{')
    expect(loadCameraSlots()).toBeNull()
    w.window.localStorage.setItem(CAMERAS_STORAGE_KEY, JSON.stringify([]))
    expect(loadCameraSlots()).toBeNull()
  })
})
