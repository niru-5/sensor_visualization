import { describe, expect, it } from 'vitest'
import {
  FIT_MARGIN,
  STAGE_FOV_DEG,
  STAGE_VIEW_DIRECTION,
  computeFitDistance,
  computeStageFit,
  fitBoundingRadius,
  fitCameraPosition,
} from './stageFit'

describe('fitBoundingRadius', () => {
  it('covers apex + footprint corners (hypot of half-extents and wd/2)', () => {
    expect(fitBoundingRadius(3, 4, 10)).toBeCloseTo(Math.hypot(3, 4, 5), 9)
  })

  it('falls back to wd/2 for a degenerate (invalid-geometry) footprint', () => {
    expect(fitBoundingRadius(0, 0, 300)).toBeCloseTo(150, 9)
  })
})

describe('computeFitDistance', () => {
  const halfTan = Math.tan(((STAGE_FOV_DEG / 2) * Math.PI) / 180)

  it('equals r / tan(25°) * margin', () => {
    const r = Math.hypot(216, 144, 150)
    expect(computeFitDistance(216, 144, 300)).toBeCloseTo((r / halfTan) * FIT_MARGIN, 6)
  })

  it('pushes the camera out past the shared scale for a wide 6mm lens', () => {
    // ~36x24mm sensor, 6mm lens @300mm WD → ~1800x1200mm footprint
    const dist = computeFitDistance(900, 600, 300)
    expect(dist).toBeGreaterThan(300 * 2.2)
    expect(Number.isFinite(dist)).toBe(true)
  })

  it('frames a long-WD tele view without collapsing', () => {
    const dist = computeFitDistance(20, 15, 1500)
    expect(dist).toBeGreaterThan(1500)
    expect(Number.isFinite(dist)).toBe(true)
  })

  it('falls back to a WD-based distance for invalid geometry', () => {
    const dist = computeFitDistance(0, 0, 0)
    expect(Number.isFinite(dist)).toBe(true)
    expect(dist).toBeGreaterThan(0)
  })
})

describe('fitCameraPosition', () => {
  it('sits exactly one fit distance from the sphere centre along the 3/4-view direction', () => {
    const dist = 740
    const targetZ = 150
    const [x, y, z] = fitCameraPosition(dist, targetZ)
    expect(Math.hypot(x, y, z - targetZ)).toBeCloseTo(dist, 6)
    const len = Math.hypot(...STAGE_VIEW_DIRECTION)
    expect(x / dist).toBeCloseTo(STAGE_VIEW_DIRECTION[0] / len, 9)
    expect(y / dist).toBeCloseTo(STAGE_VIEW_DIRECTION[1] / len, 9)
    expect((z - targetZ) / dist).toBeCloseTo(STAGE_VIEW_DIRECTION[2] / len, 9)
  })
})

describe('computeStageFit', () => {
  it('ties fog to beyond the fit distance and scales grid/controls with it', () => {
    const s = 740
    const fit = computeStageFit(s)
    expect(fit.fogNearMm).toBeCloseTo(s * 1.2, 9)
    expect(fit.fogFarMm).toBeCloseTo(s * 4, 9)
    expect(fit.gridCellMm).toBeCloseTo(s / 30, 9)
    expect(fit.gridSectionMm).toBeCloseTo(s / 6, 9)
    expect(fit.controlsMaxDistanceMm).toBeGreaterThan(s)
    // Content (~1 fit distance from camera) stays clear of fog.
    expect(fit.fogNearMm).toBeGreaterThan(s)
  })
})
