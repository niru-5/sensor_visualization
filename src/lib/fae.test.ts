import { describe, expect, it } from 'vitest'
import { effectiveTargetFov, explainPairing, focalRangeForSensor, rankPairings, shareCardText } from './fae'
import { SEED_LENSES, SEED_SENSORS } from './seedData'
import type { Lens, Sensor } from './types'

/**
 * Fixture-driven tests for the FAE wizard flow.
 *
 * The scenarios below are modeled on the deployment walkthroughs Roboflow
 * publishes for production vision systems (conveyor inspection at a fixed
 * stand-off, parcel-dimensioning stations) — fixed working distance, a
 * required field of view, motion freezing the shutter choice, and a plant
 * network dictating the camera interface. The sensor/lens numbers themselves
 * come from this repo's hand-curated seed dataset (real datasheet values),
 * plus two small inline fixture cameras that carry the interface/shutter
 * metadata the seed entries predate. What these tests pin down is the
 * wizard's *math and ranking behavior* against hand-calculated values, not
 * the datasheets: every expectation below was computed by hand from the
 * thin-lens relations in optics.ts (which this module reuses, never
 * reimplements).
 */

function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`test fixture missing: ${what}`)
  return value
}

const imx264 = must(SEED_SENSORS.find((s) => s.id === 'seed-sensor-imx264'), 'IMX264')
const imx178 = must(SEED_SENSORS.find((s) => s.id === 'seed-sensor-imx178'), 'IMX178')
const imx267 = must(SEED_SENSORS.find((s) => s.id === 'seed-sensor-imx267'), 'IMX267')
const cil532 = must(SEED_LENSES.find((l) => l.id === 'seed-lens-commonlands-cil532'), 'CIL532 12mm')
const cil525 = must(SEED_LENSES.find((l) => l.id === 'seed-lens-commonlands-cil525'), 'CIL525 25mm')
const cil060 = must(SEED_LENSES.find((l) => l.id === 'seed-lens-commonlands-cil060'), 'CIL060 6mm')

/** Fixed-WD conveyor barcode station: global shutter, plant GigE network. */
const conveyorCam: Sensor = {
  id: 'fix-conveyor-cam',
  name: 'Fixture ConveyorCam (2048x1536, 2/3" global GigE)',
  widthMm: 8.8,
  heightMm: 6.6,
  resolutionH: 2048,
  resolutionV: 1536,
  mount: 'C',
  cameraInterface: 'GigE',
  shutter: 'global',
  source: 'manual',
}

/** Benchtop USB station cam: rolling shutter, USB3 — wrong for the conveyor. */
const benchCam: Sensor = {
  id: 'fix-bench-cam',
  name: 'Fixture BenchCam (2048x1536, rolling USB3)',
  widthMm: 8.8,
  heightMm: 6.6,
  resolutionH: 2048,
  resolutionV: 1536,
  mount: 'C',
  cameraInterface: 'USB3',
  shutter: 'rolling',
  source: 'manual',
}

describe('effectiveTargetFov', () => {
  it('passes an explicit FOV target through unchanged', () => {
    const t = effectiveTargetFov(imx264, { targetFovHmm: 300, targetFovVmm: 250, workingDistanceMm: 500 })
    expect(t.derivedFromFeature).toBe(false)
    expect(t.fovHmm).toBe(300)
    expect(t.fovVmm).toBe(250)
    expect(t.requiredMmPerPixel).toBeNull()
  })

  it('derives the required FOV from feature size via the 4px rule (0.5mm feature on IMX264)', () => {
    // 0.5mm / 4px = 0.125mm/px; frame must span 0.125 * 2464 = 308mm (H), 0.125 * 2056 = 257mm (V)
    const t = effectiveTargetFov(imx264, {
      targetFovHmm: 0,
      targetFovVmm: 0,
      workingDistanceMm: 500,
      featureSizeMm: 0.5,
      pixelsPerFeature: 4,
    })
    expect(t.derivedFromFeature).toBe(true)
    expect(t.requiredMmPerPixel).toBeCloseTo(0.125, 8)
    expect(t.fovHmm).toBeCloseTo(308, 8)
    expect(t.fovVmm).toBeCloseTo(257, 8)
  })
})

describe('focalRangeForSensor', () => {
  it('solves the focal range for IMX264, 300x250mm target @ 500mm WD ±10%', () => {
    // nominal H: f = 500 * 8.4996 / (300 + 8.4996) ≈ 13.78mm
    // nominal V: f = 500 * 7.0932 / (250 + 7.0932) ≈ 13.79mm
    // band corners (450/550mm WD): min ≈ 12.40mm, max ≈ 15.17mm
    const r = focalRangeForSensor(imx264, { targetFovHmm: 300, targetFovVmm: 250, workingDistanceMm: 500, workingDistanceTolerancePct: 10 })
    expect(r).not.toBeNull()
    expect(r!.nominalHmm).toBeCloseTo(13.78, 1)
    expect(r!.nominalVmm).toBeCloseTo(13.79, 1)
    expect(r!.minMm).toBeCloseTo(12.4, 1)
    expect(r!.maxMm).toBeCloseTo(15.17, 1)
    expect(r!.workingDistanceLoMm).toBe(450)
    expect(r!.workingDistanceHiMm).toBe(550)
  })

  it('returns null for non-physical inputs instead of dividing by nonsense', () => {
    expect(focalRangeForSensor(imx264, { targetFovHmm: 300, targetFovVmm: 250, workingDistanceMm: 0 })).toBeNull()
    expect(focalRangeForSensor(imx264, { targetFovHmm: 0, targetFovVmm: 250, workingDistanceMm: 500 })).toBeNull()
  })
})

describe('rankPairings', () => {
  it('ranks the 12mm CIL532 above the 25mm CIL525 for a 300x250mm target @ 500mm', () => {
    // 12mm: FOV ≈ 345.7 x 288.5mm (~15% off) + tight coverage (11.1 vs 11.07 diag) → 100-15-10 = 75
    // 25mm: FOV ≈ 161.5 x 134.8mm (~46% off), coverage ok → 100-40 = 60
    const { ranked, excluded } = rankPairings([imx264], [cil532, cil525], {
      targetFovHmm: 300,
      targetFovVmm: 250,
      workingDistanceMm: 500,
    })
    expect(excluded).toEqual([])
    expect(ranked).toHaveLength(2)
    expect(ranked[0]!.lensId).toBe(cil532.id)
    expect(ranked[0]!.score).toBe(75)
    expect(ranked[0]!.verdict).toBe('marginal')
    expect(ranked[0]!.fovHmm).toBeCloseTo(345.7, 0)
    expect(ranked[1]!.lensId).toBe(cil525.id)
    expect(ranked[1]!.score).toBe(60)
    expect(ranked[1]!.fovHmm).toBeCloseTo(161.5, 0)
  })

  it('flags vignetting + mount mismatch as no-fit (6mm M12 lens on the 1" IMX267)', () => {
    const { ranked } = rankPairings([imx267], [cil060], {
      targetFovHmm: 300,
      targetFovVmm: 250,
      workingDistanceMm: 500,
    })
    expect(ranked).toHaveLength(1)
    expect(ranked[0]!.coverage).toBe('vignetting')
    expect(ranked[0]!.mountCompatible).toBe(false)
    expect(ranked[0]!.verdict).toBe('no-fit')
    expect(ranked[0]!.reasons.join(' ')).toMatch(/Vignetting/)
  })

  it('marks WD <= f pairings invalid rather than scoring them', () => {
    const { ranked } = rankPairings([imx264], [cil525], {
      targetFovHmm: 300,
      targetFovVmm: 250,
      workingDistanceMm: 20, // below the 25mm focal length
    })
    expect(ranked).toHaveLength(1)
    expect(ranked[0]!.verdict).toBe('no-fit')
    expect(ranked[0]!.score).toBe(0)
  })

  it('hard-filters interface/shutter mismatches but only flags unknowns', () => {
    const lenses: Lens[] = [cil532]
    const { ranked, excluded } = rankPairings([conveyorCam, benchCam, imx264], lenses, {
      targetFovHmm: 300,
      targetFovVmm: 250,
      workingDistanceMm: 500,
      requiredInterface: 'GigE',
      requiredShutter: 'global',
    })
    // benchCam (USB3/rolling) is out entirely
    expect(excluded.length).toBeGreaterThan(0)
    expect(excluded.every((e) => e.sensorId === benchCam.id)).toBe(true)
    expect(excluded.map((e) => e.reason).join(' ')).toMatch(/USB3/)
    // conveyorCam passes clean; imx264 (no interface/shutter on record) stays but flagged
    const flagged = ranked.find((r) => r.sensorId === imx264.id)
    expect(flagged).toBeDefined()
    expect(flagged!.reasons.join(' ')).toMatch(/not specified/)
    expect(ranked.find((r) => r.sensorId === conveyorCam.id)).toBeDefined()
  })

  it('rewards ground resolution that satisfies the feature-size rule', () => {
    // 0.5mm feature @ 4px needs ≤0.125mm/px. 12mm @ 500mm on IMX264 gives
    // 345.65/2464 ≈ 0.1403mm/px — too coarse, so this pairing must say so.
    const { ranked } = rankPairings([imx264], [cil532], {
      targetFovHmm: 300,
      targetFovVmm: 250,
      workingDistanceMm: 500,
      featureSizeMm: 0.5,
      pixelsPerFeature: 4,
    })
    expect(ranked[0]!.mmPerPixelH).toBeCloseTo(0.1403, 3)
    expect(ranked[0]!.reasons.join(' ')).toMatch(/too few pixels/)
  })
})

describe('explainPairing', () => {
  it('explains the C-lens-on-CS-body spacer case (CIL532 on IMX178)', () => {
    const e = explainPairing(imx178, cil532)
    expect(e.mountHeadline).toMatch(/5mm spacer/)
    expect(e.mountBody).toMatch(/5mm spacer/)
    expect(e.coverageHeadline).toMatch(/comfortable/)
  })

  it('calls out failing coverage in plain language (CIL060 on IMX267)', () => {
    const e = explainPairing(imx267, cil060)
    expect(e.coverageHeadline).toMatch(/fails/)
    expect(e.coverageBody).toMatch(/vignette/)
  })
})

describe('shareCardText', () => {
  it('summarizes the top pick with its key numbers', () => {
    const inputs = { targetFovHmm: 300, targetFovVmm: 250, workingDistanceMm: 500 }
    const result = rankPairings([imx264], [cil532, cil525], inputs)
    const text = shareCardText(inputs, result)
    expect(text).toMatch(/CIL532/)
    expect(text).toMatch(/346/) // rounded FOV-H of the winner
    expect(text).toMatch(/MARGINAL/)
  })
})
