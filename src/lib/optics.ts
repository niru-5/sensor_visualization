import type { Lens, MountType, Sensor } from './types'

/** Sensor diagonal, mm. */
export function sensorDiagonalMm(sensor: Pick<Sensor, 'widthMm' | 'heightMm'>): number {
  return Math.hypot(sensor.widthMm, sensor.heightMm)
}

/** Pixel pitch, derived from active area / resolution when not given directly. */
export function derivePixelPitchUm(
  sensor: Pick<Sensor, 'widthMm' | 'heightMm' | 'resolutionH' | 'resolutionV' | 'pixelPitchUm'>,
): number {
  if (sensor.pixelPitchUm) return sensor.pixelPitchUm
  const fromWidth = (sensor.widthMm / sensor.resolutionH) * 1000
  const fromHeight = (sensor.heightMm / sensor.resolutionV) * 1000
  return (fromWidth + fromHeight) / 2
}

/** Nyquist-limited resolving power of the sensor, line pairs/mm = 500 / pixel pitch (µm). */
export function nyquistResolutionLpMm(pixelPitchUm: number): number {
  return 500 / pixelPitchUm
}

export type FovRisk = 'normal' | 'macro' | 'extreme-macro' | 'invalid'

export interface FovAxisResult {
  /** Field of view along this axis, mm. Null when the input geometry is invalid (WD <= f). */
  fovMm: number | null
  /** Image/object magnification, f / (WD - f). Null when invalid. */
  magnification: number | null
  risk: FovRisk
  /** Human-readable explanation, present for macro/extreme-macro/invalid risk levels. */
  message?: string
}

/**
 * Thin-lens field of view along one axis: FOV = sensorDim * (WD - f) / f,
 * derived from magnification m = f / (WD - f) and FOV = sensorDim / m.
 *
 * Risk thresholds (a judgment call, not a standard — documented here and in
 * docs/LEARNINGS.md): magnification m is the image/object size ratio.
 * Typical machine-vision working distances keep m well under 0.5. As WD
 * approaches f, m grows without bound (macro/microscopy territory) — the
 * formula stays mathematically well-behaved, but the thin-lens
 * approximation itself (ignoring lens thickness, entrance pupil shift,
 * real MOD limits) gets less trustworthy the further out you go, so we
 * flag it rather than silently reporting a precise-looking number.
 *   m >= 2          -> 'extreme-macro'
 *   0.5 <= m < 2     -> 'macro'
 *   m < 0.5          -> 'normal'
 *   WD <= f          -> 'invalid' (no real image forms at or below the focal length)
 */
export function computeFovAxis(sensorDimMm: number, focalLengthMm: number, workingDistanceMm: number): FovAxisResult {
  if (workingDistanceMm <= focalLengthMm) {
    return {
      fovMm: null,
      magnification: null,
      risk: 'invalid',
      message:
        'Working distance must be greater than the focal length — no real image forms at or below the focal length.',
    }
  }

  const magnification = focalLengthMm / (workingDistanceMm - focalLengthMm)
  const fovMm = sensorDimMm / magnification

  if (magnification >= 2) {
    return {
      fovMm,
      magnification,
      risk: 'extreme-macro',
      message: 'Extreme macro regime (magnification >= 2x) — thin-lens approximation is increasingly unreliable here.',
    }
  }
  if (magnification >= 0.5) {
    return {
      fovMm,
      magnification,
      risk: 'macro',
      message: 'Macro regime (magnification >= 0.5x) — outside typical machine-vision working distances, treat as approximate.',
    }
  }
  return { fovMm, magnification, risk: 'normal' }
}

export interface FovResult {
  horizontal: FovAxisResult
  vertical: FovAxisResult
}

export function computeFov(sensor: Pick<Sensor, 'widthMm' | 'heightMm'>, focalLengthMm: number, workingDistanceMm: number): FovResult {
  return {
    horizontal: computeFovAxis(sensor.widthMm, focalLengthMm, workingDistanceMm),
    vertical: computeFovAxis(sensor.heightMm, focalLengthMm, workingDistanceMm),
  }
}

/** Solve for the working distance needed to achieve a target horizontal FOV. */
export function workingDistanceForFov(targetFovMm: number, sensorDimMm: number, focalLengthMm: number): number {
  // FOV = sensorDim * (WD - f) / f  =>  WD = f * (FOV / sensorDim + 1)
  return focalLengthMm * (targetFovMm / sensorDimMm + 1)
}

/** Solve for the focal length needed to achieve a target horizontal FOV at a given working distance. */
export function focalLengthForFov(targetFovMm: number, sensorDimMm: number, workingDistanceMm: number): number {
  // FOV = sensorDim * (WD - f) / f  =>  f = WD * sensorDim / (FOV + sensorDim)
  return (workingDistanceMm * sensorDimMm) / (targetFovMm + sensorDimMm)
}

/** Ground resolution: mm covered per pixel along an axis. */
export function mmPerPixel(fovMm: number, pixelCount: number): number {
  return fovMm / pixelCount
}

export type ImageCircleStatus = 'ok' | 'tight' | 'vignetting'

export interface ImageCircleCheck {
  status: ImageCircleStatus
  sensorDiagonalMm: number
  imageCircleMm: number
  marginMm: number
  message: string
}

/**
 * Compares a lens's image circle against the sensor diagonal. "Tight" is a
 * judgment-call threshold (margin under 10% of the sensor diagonal) meant to
 * catch real-world cases where a lens technically covers the sensor on
 * paper but leaves little room for manufacturing tolerance or corner
 * softness/vignetting in practice.
 */
export function checkImageCircle(lens: Pick<Lens, 'imageCircleMm'>, sensor: Pick<Sensor, 'widthMm' | 'heightMm'>): ImageCircleCheck {
  const diagonal = sensorDiagonalMm(sensor)
  const marginMm = lens.imageCircleMm - diagonal

  if (marginMm < 0) {
    return {
      status: 'vignetting',
      sensorDiagonalMm: diagonal,
      imageCircleMm: lens.imageCircleMm,
      marginMm,
      message: `Lens image circle (${lens.imageCircleMm.toFixed(1)}mm) is smaller than the sensor diagonal (${diagonal.toFixed(1)}mm) — expect vignetting in the corners.`,
    }
  }
  if (marginMm < diagonal * 0.1) {
    return {
      status: 'tight',
      sensorDiagonalMm: diagonal,
      imageCircleMm: lens.imageCircleMm,
      marginMm,
      message: `Image circle covers the sensor with only ${marginMm.toFixed(1)}mm margin — corners may be soft or slightly vignetted.`,
    }
  }
  return {
    status: 'ok',
    sensorDiagonalMm: diagonal,
    imageCircleMm: lens.imageCircleMm,
    marginMm,
    message: `Image circle comfortably covers the sensor (${marginMm.toFixed(1)}mm margin).`,
  }
}

export interface MountCheck {
  compatible: boolean
  requiresSpacer: boolean
  message: string
}

/**
 * C and CS mount share a thread but differ in flange-back distance
 * (C: 17.526mm, CS: 12.526mm — a 5mm difference). A C-mount lens can reach
 * focus on a CS-mount body with a 5mm spacer ring; a CS-mount lens can
 * never reach focus on a C-mount body (it would need a *negative* spacer).
 * Every other mount pairing is treated as an outright mismatch for v1 —
 * S-mount/M12, F-mount, etc. have no standard mechanical adapter path.
 */
export function checkMountCompatibility(lensMount: MountType, sensorMount: MountType): MountCheck {
  if (lensMount === sensorMount) {
    return { compatible: true, requiresSpacer: false, message: `${lensMount} mount matches directly.` }
  }
  if (lensMount === 'C' && sensorMount === 'CS') {
    return {
      compatible: true,
      requiresSpacer: true,
      message: 'C-mount lens on a CS-mount body needs a 5mm spacer/adapter ring to reach focus.',
    }
  }
  if (lensMount === 'CS' && sensorMount === 'C') {
    return {
      compatible: false,
      requiresSpacer: false,
      message: 'CS-mount lens cannot reach focus on a C-mount body (would require a negative spacer).',
    }
  }
  return {
    compatible: false,
    requiresSpacer: false,
    message: `${lensMount} and ${sensorMount} are different mount families — no standard adapter, verify mechanically before relying on this pairing.`,
  }
}
