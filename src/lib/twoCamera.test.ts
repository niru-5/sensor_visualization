import { describe, expect, it } from 'vitest'
import {
  CAMERAS_STORAGE_KEY,
  addCameraSlot,
  buildTableRow,
  clampWorkingDistance,
  computeTwoCameraView,
  createSlot,
  effectiveWorkingDistance,
  getSliderBounds,
  lensesInPlay,
  overlayLabel,
  panelLayout,
  parseCameraSlots,
  removeCameraSlot,
  resolveSlots,
  sensorsInPlay,
  sharedScaleMm,
  updateCameraSlot,
} from './twoCamera'
import { SEED_LENSES, SEED_SENSORS } from './seedData'

function must<T>(v: T | undefined, what: string): T {
  if (v === undefined) throw new Error(`fixture missing: ${what}`)
  return v
}

const imx264 = must(SEED_SENSORS.find((s) => s.id === 'seed-sensor-imx264'), 'IMX264')
const imx178 = must(SEED_SENSORS.find((s) => s.id === 'seed-sensor-imx178'), 'IMX178')
const imx267 = must(SEED_SENSORS.find((s) => s.id === 'seed-sensor-imx267'), 'IMX267')
const cil532 = must(SEED_LENSES.find((l) => l.id === 'seed-lens-commonlands-cil532'), 'CIL532')
const cil525 = must(SEED_LENSES.find((l) => l.id === 'seed-lens-commonlands-cil525'), 'CIL525')
const cil060 = must(SEED_LENSES.find((l) => l.id === 'seed-lens-commonlands-cil060'), 'CIL060')

describe('two-camera divergent configs', () => {
  it('config A (IMX264 + 25mm @300mm) vs config B (IMX178 + 6mm @500mm) diverge in FOV, coverage, and mount', () => {
    const camA = { ...createSlot(imx264.id, cil525.id, 300) }
    const camB = { ...createSlot(imx178.id, cil060.id, 500) }
    const view = computeTwoCameraView([imx264, imx178], [cil525, cil060], [camA, camB])

    expect(view.resolved).toHaveLength(2)
    // FOVs differ substantially: narrow 25mm vs wide 6mm
    const fovA = view.tableRows.find((r) => r.lensId === cil525.id)
    expect(fovA?.fovHmm).toBeCloseTo(93.5, 0)
    // Config B overlay shows the wide view at 500mm: 7.4304 * (500-6)/6 ≈ 611mm
    expect(view.overlays[1]).toMatch(/612 x 411mm @ 500mm/)
    // Coverage diverges: 25mm ok on IMX264 vs 6mm tight on IMX178 (9.0mm circle vs ~8.95mm diagonal)
    expect(view.tableRows.find((r) => r.lensId === cil525.id)?.coverage).toBe('ok')
    const rowB = buildTableRow(imx178, cil060, 500)
    expect(rowB.coverage).toBe('tight')
    // Mount diverges: C-on-C ok vs M12-on-CS mismatch
    expect(view.tableRows.find((r) => r.lensId === cil525.id)?.mountCompatible).toBe(true)
    expect(rowB.mountCompatible).toBe(false)
    // Shared scale is the max WD so both stages share 1:1 framing
    expect(view.sharedScale).toBe(500)
  })

  it('config C (IMX267 1-inch + 6mm M12) is vignetting/no-fit while config D (IMX264 + 12mm C) stays workable', () => {
    const camC = { ...createSlot(imx267.id, cil060.id, 500) }
    const camD = { ...createSlot(imx264.id, cil532.id, 500) }
    const view = computeTwoCameraView([imx267, imx264], [cil060, cil532], [camC, camD])

    const rowC = buildTableRow(imx267, cil060, 500)
    expect(rowC.coverage).toBe('vignetting')
    expect(rowC.mountCompatible).toBe(false)
    const rowD = buildTableRow(imx264, cil532, 500)
    expect(rowD.coverage).toBe('tight')
    expect(rowD.mountCompatible).toBe(true)
    expect(rowD.valid).toBe(true)
    // Both panels resolve; overlay for the failing pair still renders numbers + risk flag path
    expect(view.overlays).toHaveLength(2)
    expect(view.playSensors).toHaveLength(2)
    expect(view.playLenses).toHaveLength(2)
  })
})

describe('slot CRUD', () => {
  it('createSlot defaults bad WD to 300 and mints unique ids', () => {
    const a = createSlot(null, null)
    const b = createSlot(null, null, Number.NaN)
    expect(a.workingDistanceMm).toBe(300)
    expect(b.workingDistanceMm).toBe(300)
    expect(a.id).not.toBe(b.id)
  })

  it('addCameraSlot seeds from the last slot and stops at 3', () => {
    let slots = [createSlot(imx264.id, cil532.id, 400)]
    slots = addCameraSlot(slots)
    expect(slots).toHaveLength(2)
    expect(slots[1]?.sensorId).toBe(imx264.id)
    expect(slots[1]?.lensId).toBe(cil532.id)
    expect(slots[1]?.workingDistanceMm).toBe(400)
    slots = addCameraSlot(slots)
    expect(slots).toHaveLength(3)
    expect(addCameraSlot(slots)).toHaveLength(3)
    // A fourth add is a no-op at the cap.
    expect(addCameraSlot(addCameraSlot(slots))).toHaveLength(3)
  })

  it('removeCameraSlot keeps at least one panel and ignores unknown ids', () => {
    const one = [createSlot(null, null)]
    expect(removeCameraSlot(one, one[0]!.id)).toHaveLength(1)
    const two = addCameraSlot(one)
    expect(removeCameraSlot(two, 'nope')).toHaveLength(2)
    const removed = removeCameraSlot(two, two[0]!.id)
    expect(removed).toHaveLength(1)
  })

  it('updateCameraSlot patches fields and keeps the id stable', () => {
    const slots = [createSlot(null, null, 300)]
    const next = updateCameraSlot(slots, slots[0]!.id, { sensorId: imx264.id })
    expect(next[0]?.sensorId).toBe(imx264.id)
    expect(next[0]?.id).toBe(slots[0]?.id)
  })
})

describe('WD clamping edge cases (the slider/state desync fix)', () => {
  it('getSliderBounds mirrors the App slider: ceil(f)+1 .. max(min+100, 2000)', () => {
    expect(getSliderBounds(12)).toEqual({ min: 13, max: 2000 })
    expect(getSliderBounds(25)).toEqual({ min: 26, max: 2000 })
    expect(getSliderBounds(null)).toEqual({ min: 1, max: 2000 })
    expect(getSliderBounds(-5)).toEqual({ min: 1, max: 2000 })
  })

  it('clampWorkingDistance pins WD into range and repairs NaN', () => {
    expect(clampWorkingDistance(300, 12)).toBe(300)
    expect(clampWorkingDistance(5, 12)).toBe(13)
    expect(clampWorkingDistance(5000, 12)).toBe(2000)
    expect(clampWorkingDistance(Number.NaN, 12)).toBe(300)
  })

  it('switching to a longer lens re-clamps a now-invalid WD instead of leaving invalid FOV under a valid slider', () => {
    // WD 30 is valid for a 12mm lens but invalid for a 25mm... use a long lens to force the clamp:
    // stored WD 30 with a 60mm lens must clamp to 61.
    const longLens = { ...cil525, id: 'long-60', focalLengthMm: 60 }
    const slots = [{ ...createSlot(cil532.id, cil532.id, 30) }]
    const next = updateCameraSlot(slots, slots[0]!.id, { lensId: longLens.id }, [cil532, longLens])
    expect(next[0]?.workingDistanceMm).toBe(61)
    expect(effectiveWorkingDistance(next[0]!, longLens)).toBe(61)
  })

  it('WD at or below the focal length resolves to invalid FOV with a message (no divide-by-zero)', () => {
    const row = buildTableRow(imx264, cil525, 25)
    expect(row.valid).toBe(false)
    expect(row.fovHmm).toBeNull()
    expect(overlayLabel(imx264, cil525, 20)).toMatch(/greater than the focal length/)
  })
})

describe('resolve / scale / dedupe / layout edge cases', () => {
  it('resolveSlots returns null for null/dangling ids (empty state stays visible)', () => {
    const resolved = resolveSlots([createSlot(null, null, 300)], [imx264], [cil532])
    expect(resolved[0]?.sensor).toBeNull()
    expect(resolved[0]?.lens).toBeNull()
    const dangling = resolveSlots(
      [{ ...createSlot('ghost-s', 'ghost-l', 300) }],
      [imx264],
      [cil532],
    )
    expect(dangling[0]?.sensor).toBeNull()
    expect(dangling[0]?.lens).toBeNull()
    // ...while valid ids still resolve.
    const ok = resolveSlots([createSlot(imx264.id, cil532.id, 300)], [imx264], [cil532])
    expect(ok[0]?.sensor?.id).toBe(imx264.id)
    expect(ok[0]?.lens?.id).toBe(cil532.id)
  })

  it('resolveSlots yields nulls (and the empty-state overlay) when the library is empty', () => {
    const resolved = resolveSlots([createSlot(null, null, 300)], [], [])
    expect(resolved[0]?.sensor).toBeNull()
    const view = computeTwoCameraView([], [], [createSlot(null, null, 300)])
    expect(view.overlays[0]).toMatch(/Add a sensor and a lens/)
    expect(view.tableRows).toEqual([])
    expect(view.sharedScale).toBe(300)
  })

  it('sharedScaleMm is the max effective WD across panels', () => {
    const resolved = resolveSlots(
      [createSlot(imx264.id, cil532.id, 300), createSlot(imx178.id, cil060.id, 800)],
      [imx264, imx178],
      [cil532, cil060],
    )
    expect(sharedScaleMm(resolved)).toBe(800)
    expect(sharedScaleMm([])).toBe(300)
  })

  it('in-play sets de-duplicate when both panels share hardware', () => {
    const resolved = resolveSlots(
      [createSlot(imx264.id, cil532.id, 300), createSlot(imx264.id, cil532.id, 500)],
      [imx264],
      [cil532],
    )
    expect(sensorsInPlay(resolved)).toHaveLength(1)
    expect(lensesInPlay(resolved)).toHaveLength(1)
  })

  it('panelLayout switches grid/height at 2+ panels', () => {
    expect(panelLayout(1)).toEqual({ gridColsClass: 'grid-cols-1', panelHeight: 'h-[480px]' })
    expect(panelLayout(2)).toEqual({ gridColsClass: 'grid-cols-1 md:grid-cols-2', panelHeight: 'h-[340px]' })
    expect(panelLayout(3)).toEqual({ gridColsClass: 'grid-cols-1 md:grid-cols-2', panelHeight: 'h-[340px]' })
  })

  it('comparison is capped at 3 cameras: resolve/compute ignore slots beyond the cap', () => {
    const four = [
      createSlot(imx264.id, cil532.id, 300),
      createSlot(imx264.id, cil532.id, 400),
      createSlot(imx264.id, cil532.id, 500),
      createSlot(imx264.id, cil532.id, 600),
    ]
    expect(resolveSlots(four, [imx264], [cil532])).toHaveLength(3)
    const view = computeTwoCameraView([imx264], [cil532], four)
    expect(view.resolved).toHaveLength(3)
    expect(view.overlays).toHaveLength(3)
    expect(view.sharedScale).toBe(500)
  })

  it('parseCameraSlots accepts good data and rejects corrupt/oversize payloads', () => {
    const good = [{ id: 'cam-1', sensorId: imx264.id, lensId: cil532.id, workingDistanceMm: 300 }]
    expect(parseCameraSlots(good)?.[0]?.workingDistanceMm).toBe(300)
    expect(parseCameraSlots([])).toBeNull()
    expect(parseCameraSlots({})).toBeNull()
    expect(parseCameraSlots([{ id: '', sensorId: null, lensId: null, workingDistanceMm: 300 }])).toBeNull()
    expect(parseCameraSlots([{ id: 'x', sensorId: null, lensId: null, workingDistanceMm: -5 }])?.[0]?.workingDistanceMm).toBe(300)
    const three = [1, 2, 3].map((i) => ({ id: `cam-${i}`, sensorId: null, lensId: null, workingDistanceMm: 300 }))
    expect(parseCameraSlots(three)).toHaveLength(3)
    const four = [1, 2, 3, 4].map((i) => ({ id: `cam-${i}`, sensorId: null, lensId: null, workingDistanceMm: 300 }))
    expect(parseCameraSlots(four)).toBeNull()
    const five = [1, 2, 3, 4, 5].map((i) => ({ id: `cam-${i}`, sensorId: null, lensId: null, workingDistanceMm: 300 }))
    expect(parseCameraSlots(five)).toBeNull()
  })

  it('storage key is namespaced away from the sensor/lens store', () => {
    expect(CAMERAS_STORAGE_KEY).not.toBe('camera-selection-tool/v1')
    expect(CAMERAS_STORAGE_KEY).toMatch(/cameras/)
  })
})
