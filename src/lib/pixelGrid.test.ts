import { describe, expect, it } from 'vitest'
import {
  cameraColorForIndex,
  computePixelGrid,
  defaultContourEvery,
  formatGsdLabel,
} from './pixelGrid'

describe('computePixelGrid', () => {
  it('computes cols/rows 1:1 when under the cap', () => {
    const spec = computePixelGrid({
      fovHmm: 640,
      fovVmm: 480,
      resolutionH: 32,
      resolutionV: 24,
      workingDistanceMm: 500,
      focalLengthMm: 25,
    })
    expect(spec.valid).toBe(true)
    expect(spec.gridCols).toBe(32)
    expect(spec.gridRows).toBe(24)
    expect(spec.strideH).toBe(1)
    expect(spec.strideV).toBe(1)
    expect(spec.gsdH).toBeCloseTo(20, 6)
    expect(spec.gsdV).toBeCloseTo(20, 6)
  })

  it('caps huge resolutions with stride decimation (12 MP stays <= 40x40)', () => {
    const spec = computePixelGrid({
      fovHmm: 600,
      fovVmm: 450,
      resolutionH: 4000,
      resolutionV: 3000,
      workingDistanceMm: 500,
      focalLengthMm: 25,
    })
    expect(spec.valid).toBe(true)
    expect(spec.gridCols).toBeLessThanOrEqual(40)
    expect(spec.gridRows).toBeLessThanOrEqual(40)
    expect(spec.strideH).toBe(100)
    expect(spec.strideV).toBe(75)
    // Rendered cell = true GSD * stride
    expect(spec.cellSizeMmH).toBeCloseTo((600 / 4000) * 100, 6)
    expect(spec.cellSizeMmV).toBeCloseTo((450 / 3000) * 75, 6)
  })

  it('rejects invalid working distance (WD <= f)', () => {
    const atFocal = computePixelGrid({
      fovHmm: 100,
      fovVmm: 100,
      resolutionH: 10,
      resolutionV: 10,
      workingDistanceMm: 25,
      focalLengthMm: 25,
    })
    expect(atFocal.valid).toBe(false)
    expect(atFocal.gridCols).toBe(0)

    const insideFocal = computePixelGrid({
      fovHmm: 100,
      fovVmm: 100,
      resolutionH: 10,
      resolutionV: 10,
      workingDistanceMm: 10,
      focalLengthMm: 25,
    })
    expect(insideFocal.valid).toBe(false)
    expect(insideFocal.reason).toMatch(/focal length/i)
  })

  it('rejects zero/negative/NaN inputs', () => {
    for (const bad of [
      { fovHmm: 0, fovVmm: 100, resolutionH: 10, resolutionV: 10, workingDistanceMm: 500 },
      { fovHmm: 100, fovVmm: -5, resolutionH: 10, resolutionV: 10, workingDistanceMm: 500 },
      { fovHmm: 100, fovVmm: 100, resolutionH: 0, resolutionV: 10, workingDistanceMm: 500 },
      { fovHmm: 100, fovVmm: 100, resolutionH: 10, resolutionV: 10, workingDistanceMm: -1 },
      { fovHmm: NaN, fovVmm: 100, resolutionH: 10, resolutionV: 10, workingDistanceMm: 500 },
    ]) {
      expect(computePixelGrid(bad).valid).toBe(false)
    }
  })

  it('flags non-square pixels in the label', () => {
    const spec = computePixelGrid({
      fovHmm: 640,
      fovVmm: 480,
      resolutionH: 32,
      resolutionV: 12,
      workingDistanceMm: 500,
      focalLengthMm: 25,
    })
    expect(spec.valid).toBe(true)
    expect(spec.label).toContain('×')
  })

  it('honours a custom maxCells cap', () => {
    const spec = computePixelGrid({
      fovHmm: 100,
      fovVmm: 100,
      resolutionH: 100,
      resolutionV: 100,
      workingDistanceMm: 500,
      focalLengthMm: 25,
      maxCells: 10,
    })
    expect(spec.gridCols).toBeLessThanOrEqual(10)
    expect(spec.gridRows).toBeLessThanOrEqual(10)
    expect(spec.strideH).toBe(10)
  })
})

describe('formatGsdLabel', () => {
  it('formats like "1 px = X.XX mm"', () => {
    expect(formatGsdLabel(2.1)).toBe('1 px = 2.10 mm')
    expect(formatGsdLabel(0.005)).toMatch(/0\.0050/)
    expect(formatGsdLabel(0)).toBe('1 px = —')
    expect(formatGsdLabel(NaN)).toBe('1 px = —')
  })
})

describe('defaultContourEvery', () => {
  it('emphasises every 10th line on dense grids, 5th on medium, 1 on sparse', () => {
    expect(defaultContourEvery(40)).toBe(10)
    expect(defaultContourEvery(12)).toBe(5)
    expect(defaultContourEvery(4)).toBe(1)
    expect(defaultContourEvery(0)).toBe(1)
  })
})

describe('cameraColorForIndex', () => {
  it('uses the shared palette slots and cycles for N > 3', () => {
    expect(cameraColorForIndex(0)).toBe('#03a9f4')
    expect(cameraColorForIndex(1)).toBe('#f8982e')
    expect(cameraColorForIndex(2)).toBe('#22c55e')
    expect(cameraColorForIndex(3)).toBe('#03a9f4')
  })
})
