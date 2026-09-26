import { describe, expect, it } from 'vitest'
import {
  blurVerdict,
  estimateReadoutMs,
  motionBlurMm,
  readoutSkewMm,
  shutterOverlayInfo,
} from './shutter'

describe('shutter math', () => {
  it('motionBlurMm computes v * t_exp', () => {
    expect(motionBlurMm(100, 0.001)).toBeCloseTo(0.1, 9)
  })

  it('readoutSkewMm computes v * T_readout', () => {
    expect(readoutSkewMm(100, 0.01)).toBeCloseTo(1, 9)
  })

  it('estimateReadoutMs inverts fps, rejects junk', () => {
    expect(estimateReadoutMs(100)).toBeCloseTo(10, 9)
    expect(estimateReadoutMs(0)).toBeNull()
    expect(estimateReadoutMs(NaN)).toBeNull()
  })

  it('blurVerdict buckets <1px pass / 1-3px warn / >3px fail / unknown without GSD', () => {
    expect(blurVerdict(0.05, 0.1)).toBe('pass')
    expect(blurVerdict(0.1, 0.1)).toBe('warn')
    expect(blurVerdict(0.5, 0.1)).toBe('fail')
    expect(blurVerdict(0.5, null)).toBe('unknown')
  })
})

describe('shutterOverlayInfo', () => {
  it('returns advisory unknown without motion input (global)', () => {
    const info = shutterOverlayInfo('global', 0.01)
    expect(info.status).toBe('unknown')
    expect(info.blurMm).toBeNull()
    expect(info.skewMm).toBeNull()
    expect(info.label).toMatch(/global/)
  })

  it('returns advisory unknown without motion input (rolling)', () => {
    const info = shutterOverlayInfo('rolling', 0.01)
    expect(info.status).toBe('unknown')
    expect(info.label).toMatch(/rolling/)
  })

  it('flags unknown shutter type for verification', () => {
    const info = shutterOverlayInfo(undefined, 0.01)
    expect(info.status).toBe('unknown')
    expect(info.label).toMatch(/verify datasheet/)
  })

  it('computes blur = v * t_exp and buckets sub-pixel as pass', () => {
    const info = shutterOverlayInfo('global', 0.1, { targetVelocityMms: 50, exposureMs: 1 })
    expect(info.blurMm).toBeCloseTo(0.05, 9)
    expect(info.skewMm).toBeNull()
    expect(info.status).toBe('pass')
  })

  it('buckets >3px blur as fail', () => {
    const info = shutterOverlayInfo('global', 0.01, { targetVelocityMms: 1000, exposureMs: 1 })
    expect(info.blurMm).toBeCloseTo(1, 9)
    expect(info.status).toBe('fail')
  })

  it('computes rolling skew from readoutMs', () => {
    const info = shutterOverlayInfo('rolling', 0.01, { targetVelocityMms: 100, exposureMs: 1, readoutMs: 10 })
    expect(info.skewMm).toBeCloseTo(1, 9)
    expect(info.readoutEstimated).toBe(false)
    expect(info.label).toMatch(/skew/)
  })

  it('estimates skew from fpsHint flagged as estimate', () => {
    const info = shutterOverlayInfo('rolling', 0.01, { targetVelocityMms: 100, exposureMs: 1, fpsHint: 100 })
    expect(info.skewMm).toBeCloseTo(1, 9)
    expect(info.readoutEstimated).toBe(true)
    expect(info.message).toMatch(/estimated/)
  })

  it('stays advisory (unknown) without GSD even with motion input', () => {
    const info = shutterOverlayInfo('global', null, { targetVelocityMms: 100, exposureMs: 1 })
    expect(info.blurMm).toBeCloseTo(0.1, 9)
    expect(info.status).toBe('unknown')
  })
})
