import { describe, expect, it } from 'vitest'
import {
  checkImageCircle,
  checkMountCompatibility,
  computeFov,
  computeFovAxis,
  derivePixelPitchUm,
  focalLengthForFov,
  mmPerPixel,
  nyquistResolutionLpMm,
  sensorDiagonalMm,
  workingDistanceForFov,
} from './optics'
import { opticalFormatToMm } from './opticalFormats'

describe('sensorDiagonalMm', () => {
  it('matches the Sony IMX264 datasheet diagonal (~11.1mm, 2/3-type)', () => {
    // active area derived from 2464 x 2056 px at 3.45um pixel pitch
    const diagonal = sensorDiagonalMm({ widthMm: 8.4996, heightMm: 7.0932 })
    expect(diagonal).toBeCloseTo(11.07, 1)
  })
})

describe('derivePixelPitchUm', () => {
  it('derives ~3.45um for the IMX264 (8.4996mm / 2464px)', () => {
    const pitch = derivePixelPitchUm({
      widthMm: 8.4996,
      heightMm: 7.0932,
      resolutionH: 2464,
      resolutionV: 2056,
    })
    expect(pitch).toBeCloseTo(3.45, 2)
  })

  it('uses the explicit pixelPitchUm when provided, without recomputing', () => {
    const pitch = derivePixelPitchUm({
      widthMm: 8.5,
      heightMm: 7.1,
      resolutionH: 2464,
      resolutionV: 2056,
      pixelPitchUm: 3.45,
    })
    expect(pitch).toBe(3.45)
  })
})

describe('nyquistResolutionLpMm', () => {
  it('computes 500 / pixel pitch (um) for a 3.45um pixel', () => {
    // 1 / (2 * 0.00345mm) = 144.9 lp/mm
    expect(nyquistResolutionLpMm(3.45)).toBeCloseTo(144.93, 1)
  })
})

describe('computeFovAxis (thin-lens FOV)', () => {
  it('matches a hand-calculated reference case: 8.5mm sensor, 12mm lens, 300mm WD', () => {
    // magnification m = f / (WD - f) = 12 / (300 - 12) = 0.041666...
    // FOV = sensorDim / m = 8.5 / 0.041666... = 204.0mm
    const result = computeFovAxis(8.5, 12, 300)
    expect(result.risk).toBe('normal')
    expect(result.magnification).toBeCloseTo(0.041666, 5)
    expect(result.fovMm).toBeCloseTo(204.0, 1)
  })

  it('matches a second reference case: 6.6mm sensor, 25mm lens, 500mm WD', () => {
    // m = 25 / (500 - 25) = 0.052631...
    // FOV = 6.6 / 0.052631... = 125.4mm
    const result = computeFovAxis(6.6, 25, 500)
    expect(result.magnification).toBeCloseTo(0.052631, 5)
    expect(result.fovMm).toBeCloseTo(125.4, 1)
  })

  it('flags WD <= f as invalid rather than dividing by zero/negative', () => {
    expect(computeFovAxis(8.5, 12, 12).risk).toBe('invalid')
    expect(computeFovAxis(8.5, 12, 12).fovMm).toBeNull()
    expect(computeFovAxis(8.5, 12, 5).risk).toBe('invalid')
  })

  it('flags the macro/extreme-macro regimes by magnification thresholds', () => {
    // m = 12 / (18 - 12) = 2.0 -> extreme-macro
    expect(computeFovAxis(8.5, 12, 18).risk).toBe('extreme-macro')
    // m = 12 / (24 - 12) = 1.0 -> macro
    expect(computeFovAxis(8.5, 12, 24).risk).toBe('macro')
    // m = 12 / (300 - 12) ~ 0.0417 -> normal
    expect(computeFovAxis(8.5, 12, 300).risk).toBe('normal')
  })
})

describe('computeFov (both axes)', () => {
  it('computes horizontal and vertical FOV together for a sensor', () => {
    const result = computeFov({ widthMm: 8.5, heightMm: 7.1 }, 12, 300)
    expect(result.horizontal.fovMm).toBeCloseTo(204.0, 1)
    expect(result.vertical.fovMm).toBeCloseTo(170.4, 0)
  })
})

describe('workingDistanceForFov / focalLengthForFov (inverse solves)', () => {
  it('round-trips: solving for WD from a known FOV reproduces the original working distance', () => {
    const wd = workingDistanceForFov(204.0, 8.5, 12)
    expect(wd).toBeCloseTo(300, 0)
  })

  it('round-trips: solving for focal length from a known FOV reproduces the original focal length', () => {
    const f = focalLengthForFov(204.0, 8.5, 300)
    expect(f).toBeCloseTo(12, 1)
  })
})

describe('mmPerPixel', () => {
  it('divides FOV width by horizontal pixel count', () => {
    expect(mmPerPixel(204.0, 2464)).toBeCloseTo(0.0828, 3)
  })
})

describe('checkImageCircle', () => {
  it('flags vignetting when the image circle is smaller than the sensor diagonal', () => {
    const result = checkImageCircle({ imageCircleMm: 9.0 }, { widthMm: 8.8, heightMm: 6.6 }) // 2/3" sensor, diag 11.0mm
    expect(result.status).toBe('vignetting')
    expect(result.marginMm).toBeLessThan(0)
  })

  it('flags "tight" when the margin is under 10% of the sensor diagonal', () => {
    // Computar V1226-MPZ (16.0mm circle) vs IMX267 (1", diag ~16.05mm) — margin ~ -0.05mm actually vignetting;
    // use a deliberately tight-but-positive case instead: 11.6mm circle vs 11.0mm diagonal (0.6mm margin, 5.4%)
    const result = checkImageCircle({ imageCircleMm: 11.6 }, { widthMm: 8.8, heightMm: 6.6 })
    expect(result.status).toBe('tight')
  })

  it('flags "ok" when the image circle comfortably covers the sensor', () => {
    // Commonlands CIL525 (12.8mm circle) vs IMX264 (2/3", diag ~11.07mm)
    const result = checkImageCircle({ imageCircleMm: 12.8 }, { widthMm: 8.4996, heightMm: 7.0932 })
    expect(result.status).toBe('ok')
  })
})

describe('checkMountCompatibility', () => {
  it('matches identical mounts directly', () => {
    expect(checkMountCompatibility('C', 'C').compatible).toBe(true)
    expect(checkMountCompatibility('C', 'C').requiresSpacer).toBe(false)
  })

  it('allows C-mount lens on CS-mount body with a spacer', () => {
    const result = checkMountCompatibility('C', 'CS')
    expect(result.compatible).toBe(true)
    expect(result.requiresSpacer).toBe(true)
  })

  it('rejects CS-mount lens on C-mount body (insufficient back focal distance)', () => {
    const result = checkMountCompatibility('CS', 'C')
    expect(result.compatible).toBe(false)
  })

  it('rejects unrelated mount families (e.g. M12 lens on a C-mount body)', () => {
    expect(checkMountCompatibility('M12', 'C').compatible).toBe(false)
  })
})

describe('opticalFormatToMm', () => {
  it('resolves 2/3" to the standard 8.8 x 6.6mm dimensions', () => {
    expect(opticalFormatToMm('2/3"')).toEqual({ widthMm: 8.8, heightMm: 6.6 })
  })

  it('is tolerant of formatting variations (no quote mark, extra spaces)', () => {
    expect(opticalFormatToMm('1/1.8')).toEqual({ widthMm: 7.18, heightMm: 5.32 })
    expect(opticalFormatToMm(' 1" ')).toEqual({ widthMm: 13.2, heightMm: 8.8 })
  })

  it('returns null for an unrecognized format', () => {
    expect(opticalFormatToMm('7/8"')).toBeNull()
  })
})
