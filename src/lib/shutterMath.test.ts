import { describe, expect, it } from 'vitest'
import { blurBudget, fpsCap, motionCheck, rollingSkew } from './shutterMath'

describe('blurBudget (t_exp <= blur_tol / v)', () => {
  it('freezes slow motion: 2ms at 10mm/s with 0.05mm/px GSD -> 0.4px blur', () => {
    // blur = 10mm/s * 0.002s = 0.02mm -> 0.02 / 0.05 = 0.4px < 1px
    const b = blurBudget(2, 10, 0.05)
    expect(b.blurMm).toBeCloseTo(0.02, 6)
    expect(b.blurPx).toBeCloseTo(0.4, 6)
    expect(b.frozen).toBe(true)
  })

  it('fails fast motion: 10ms at 100mm/s with 0.05mm/px GSD -> 20px blur', () => {
    // blur = 100 * 0.01 = 1mm -> 20px
    const b = blurBudget(10, 100, 0.05)
    expect(b.blurPx).toBeCloseTo(20, 6)
    expect(b.frozen).toBe(false)
    // cap = 1px * 0.05 / 100 * 1000 = 0.5ms
    expect(b.maxExpMs).toBeCloseTo(0.5, 6)
  })

  it('sits exactly on the freeze boundary: t_exp == blur_tol * gsd / v', () => {
    // 1px * 0.1mm/px / 50mm/s = 2ms -> blur is exactly 1px, still frozen (<=)
    const cap = ((1 * 0.1) / 50) * 1000
    expect(blurBudget(cap, 50, 0.1).frozen).toBe(true)
    // One microsecond over the cap breaks the freeze.
    expect(blurBudget(cap + 0.001, 50, 0.1).frozen).toBe(false)
  })

  it('honours a custom (sub-pixel) tolerance for measurement tasks', () => {
    // 0.4px blur passes the default 1px gate but fails a 0.25px gate.
    expect(blurBudget(2, 10, 0.05).frozen).toBe(true)
    expect(blurBudget(2, 10, 0.05, 0.25).frozen).toBe(false)
  })

  it('treats zero velocity as trivially frozen with an unbounded cap', () => {
    const b = blurBudget(100, 0, 0.05)
    expect(b.blurPx).toBe(0)
    expect(b.frozen).toBe(true)
    expect(b.maxExpMs).toBe(Number.POSITIVE_INFINITY)
  })

  it('rejects non-positive GSD and negative exposure', () => {
    expect(() => blurBudget(2, 10, 0)).toThrow(RangeError)
    expect(() => blurBudget(-1, 10, 0.05)).toThrow(RangeError)
  })
})

describe('rollingSkew (Δx = v * T_readout)', () => {
  it('computes skew: 100mm/s over a 10ms readout -> 1mm', () => {
    const s = rollingSkew(100, 10)
    expect(s.skewMm).toBeCloseTo(1.0, 9)
    expect(s.skewPx).toBeNull()
  })

  it('expresses skew in pixels when GSD is provided: 1mm at 0.05mm/px -> 20px', () => {
    const s = rollingSkew(100, 10, 0.05)
    expect(s.skewPx).toBeCloseTo(20, 6)
  })

  it('rejects a negative readout time', () => {
    expect(() => rollingSkew(100, -5)).toThrow(RangeError)
  })
})

describe('fpsCap (1000 / (t_exp + T_readout + overhead))', () => {
  it('caps at 100fps for 2ms exposure + 8ms readout', () => {
    const c = fpsCap(2, 8)
    expect(c.frameTimeMs).toBeCloseTo(10, 9)
    expect(c.maxFps).toBeCloseTo(100, 9)
    expect(c.limitingFactor).toBe('readout')
  })

  it('names exposure as the limiting factor when it dominates', () => {
    expect(fpsCap(20, 5).limitingFactor).toBe('exposure')
    expect(fpsCap(20, 5).maxFps).toBeCloseTo(40, 9)
  })

  it('adds overhead into the frame period', () => {
    // 2 + 8 + 2 = 12ms -> 83.33fps
    expect(fpsCap(2, 8, 2).maxFps).toBeCloseTo(83.333, 2)
  })
})

describe('motionCheck (global vs rolling branches)', () => {
  it('passes a global shutter on blur alone (no skew term)', () => {
    const m = motionCheck({ shutter: 'global', expMs: 2, velocityMmS: 10, gsdMmPx: 0.05 })
    expect(m.status).toBe('pass')
    expect(m.skewPx).toBeNull()
  })

  it('fails any shutter when blur exceeds tolerance', () => {
    const m = motionCheck({ shutter: 'global', expMs: 10, velocityMmS: 100, gsdMmPx: 0.05 })
    expect(m.status).toBe('fail')
    expect(m.blurPx).toBeCloseTo(20, 6)
  })

  it('warns (not fails) when blur passes but rolling skew exceeds 1px', () => {
    // Blur: 10mm/s * 2ms = 0.02mm -> 0.4px (passes).
    // Skew: 10mm/s * 20ms readout = 0.2mm -> 4px (exceeds 1px).
    const m = motionCheck({ shutter: 'rolling', expMs: 2, velocityMmS: 10, gsdMmPx: 0.05, readoutMs: 20 })
    expect(m.status).toBe('warn')
    expect(m.skewPx).toBeCloseTo(4, 6)
  })

  it('passes rolling when both blur and skew are within tolerance', () => {
    // Blur 0.4px; skew 10mm/s * 2ms = 0.02mm -> 0.4px.
    const m = motionCheck({ shutter: 'rolling', expMs: 2, velocityMmS: 10, gsdMmPx: 0.05, readoutMs: 2 })
    expect(m.status).toBe('pass')
    expect(m.skewPx).toBeCloseTo(0.4, 6)
  })
})
