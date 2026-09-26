import { describe, expect, it } from 'vitest'
import { estimateReadoutMs, shutterOverlayInfo } from './shutter'

describe('estimateReadoutMs', () => {
  it('inverts fps, rejects junk', () => {
    expect(estimateReadoutMs(100)).toBeCloseTo(10, 9)
    expect(estimateReadoutMs(0)).toBeNull()
    expect(estimateReadoutMs(NaN)).toBeNull()
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

  it('passes sub-pixel global blur', () => {
    const info = shutterOverlayInfo('global', 0.1, { targetVelocityMms: 50, exposureMs: 1 })
    expect(info.blurMm).toBeCloseTo(0.05, 9)
    expect(info.skewMm).toBeNull()
    expect(info.status).toBe('pass')
  })

  it('fails blur past the 1px tolerance', () => {
    const info = shutterOverlayInfo('global', 0.01, { targetVelocityMms: 1000, exposureMs: 1 })
    expect(info.blurMm).toBeCloseTo(1, 9)
    expect(info.status).toBe('fail')
  })

  it('warns on rolling skew past threshold even when blur passes', () => {
    // blur 0.5px (passes), skew 5px at 10ms readout (warns).
    const info = shutterOverlayInfo('rolling', 0.1, { targetVelocityMms: 50, exposureMs: 1, readoutMs: 10 })
    expect(info.status).toBe('warn')
    expect(info.skewMm).toBeCloseTo(0.5, 9)
    expect(info.readoutEstimated).toBe(false)
  })

  it('passes rolling when blur and skew both clear', () => {
    const info = shutterOverlayInfo('rolling', 0.1, { targetVelocityMms: 50, exposureMs: 1, readoutMs: 1 })
    expect(info.status).toBe('pass')
  })

  it('estimates skew from fpsHint flagged as estimate', () => {
    const info = shutterOverlayInfo('rolling', 0.1, { targetVelocityMms: 50, exposureMs: 1, fpsHint: 100 })
    expect(info.skewMm).toBeCloseTo(0.5, 9)
    expect(info.readoutEstimated).toBe(true)
    expect(info.message).toMatch(/estimated/)
  })

  it('stays advisory (unknown) without GSD even with motion input', () => {
    const info = shutterOverlayInfo('global', null, { targetVelocityMms: 100, exposureMs: 1 })
    expect(info.blurMm).toBeCloseTo(0.1, 9)
    expect(info.status).toBe('unknown')
  })

  it('stays advisory when rolling readout is unknowable', () => {
    const info = shutterOverlayInfo('rolling', 0.1, { targetVelocityMms: 50, exposureMs: 1 })
    expect(info.status).toBe('unknown')
    expect(info.label).toMatch(/skew unknown/)
  })
})
