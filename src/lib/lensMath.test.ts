import { describe, expect, it } from 'vitest'
import { computeFovForLens } from './lensMath'

describe('computeFovForLens — entocentric (thin-lens) branch', () => {
  it('matches the thin-lens reference: 8.5mm sensor, 12mm lens, 300mm WD -> 204mm FOV', () => {
    const r = computeFovForLens(8.5, { lensType: 'entocentric', focalLengthMm: 12 }, 300)
    expect(r.limited).toBe(false)
    expect(r.risk).toBe('normal')
    expect(r.magnification).toBeCloseTo(0.041666, 5)
    expect(r.fovMm).toBeCloseTo(204.0, 1)
  })

  it('keeps the WD <= f invalid guard from computeFovAxis', () => {
    const r = computeFovForLens(8.5, { lensType: 'entocentric', focalLengthMm: 12 }, 12)
    expect(r.risk).toBe('invalid')
    expect(r.fovMm).toBeNull()
    expect(r.magnification).toBeNull()
  })

  it('keeps the macro risk bucket (m = 1.0 -> macro)', () => {
    const r = computeFovForLens(8.5, { lensType: 'entocentric', focalLengthMm: 12 }, 24)
    expect(r.risk).toBe('macro')
    expect(r.fovMm).toBeCloseTo(8.5, 2)
  })

  it('treats fixed-focus and varifocal as entocentric (thin-lens) designs', () => {
    const a = computeFovForLens(8.5, { lensType: 'fixed-focus', focalLengthMm: 12 }, 300)
    const b = computeFovForLens(8.5, { lensType: 'varifocal', focalLengthMm: 12 }, 300)
    expect(a.fovMm).toBeCloseTo(204.0, 1)
    expect(b.fovMm).toBeCloseTo(204.0, 1)
  })

  it('returns invalid when the focal length is missing', () => {
    const r = computeFovForLens(8.5, { lensType: 'entocentric' }, 300)
    expect(r.risk).toBe('invalid')
    expect(r.fovMm).toBeNull()
  })
})

describe('computeFovForLens — telecentric branch', () => {
  it('computes FOV = dim / m: 8.5mm sensor at 0.5x -> 17mm', () => {
    const r = computeFovForLens(8.5, { lensType: 'telecentric', magnification: 0.5 }, 120)
    expect(r.fovMm).toBeCloseTo(17.0, 6)
    expect(r.magnification).toBe(0.5)
    expect(r.limited).toBe(false)
    expect(r.risk).toBe('normal')
  })

  it('diverges from the thin-lens value at the same WD (telecentric is WD-independent)', () => {
    // A 12mm entocentric lens at 300mm WD gives ~204mm; a 0.5x telecentric
    // lens gives 17mm regardless of WD — the two branches must not agree.
    const thin = computeFovForLens(8.5, { lensType: 'entocentric', focalLengthMm: 12 }, 300)
    const tele = computeFovForLens(8.5, { lensType: 'telecentric', magnification: 0.5 }, 300)
    expect(thin.fovMm).toBeCloseTo(204.0, 1)
    expect(tele.fovMm).toBeCloseTo(17.0, 6)
    expect(Math.abs((thin.fovMm ?? 0) - (tele.fovMm ?? 0))).toBeGreaterThan(100)
  })

  it('holds FOV constant when WD changes inside the telecentric range', () => {
    const range: readonly [number, number] = [100, 140]
    const near = computeFovForLens(8.5, { lensType: 'telecentric', magnification: 0.5 }, 100, range)
    const far = computeFovForLens(8.5, { lensType: 'telecentric', magnification: 0.5 }, 140, range)
    expect(near.fovMm).toBe(far.fovMm)
    expect(near.limited).toBe(false)
    expect(far.limited).toBe(false)
  })

  it('flags limited (not rescaled) when WD falls below / above the telecentric range', () => {
    const range: readonly [number, number] = [100, 140]
    const below = computeFovForLens(8.5, { lensType: 'telecentric', magnification: 0.5 }, 60, range)
    const above = computeFovForLens(8.5, { lensType: 'telecentric', magnification: 0.5 }, 200, range)
    for (const r of [below, above]) {
      expect(r.limited).toBe(true)
      // WD gates the flag only — the FOV value itself is unchanged.
      expect(r.fovMm).toBeCloseTo(17.0, 6)
      expect(r.message).toMatch(/telecentric range/)
    }
  })

  it('returns invalid when magnification is missing or non-positive', () => {
    expect(computeFovForLens(8.5, { lensType: 'telecentric' }, 120).risk).toBe('invalid')
    expect(computeFovForLens(8.5, { lensType: 'telecentric', magnification: 0 }, 120).fovMm).toBeNull()
    expect(computeFovForLens(8.5, { lensType: 'telecentric', magnification: -0.5 }, 120).fovMm).toBeNull()
  })
})
