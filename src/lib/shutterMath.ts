import type { ShutterType } from './types'

/**
 * Shutter / motion math for machine vision.
 *
 * All functions are pure and unit-explicit (suffixes: `Ms` = milliseconds,
 * `MmS` = mm/s, `Mm` = mm, `Px` = pixels). Two judgment-call defaults live
 * here, documented at each use site:
 * - `DEFAULT_BLUR_TOLERANCE_PX = 1`: motion blur under one pixel counts as
 *   "frozen". Sub-pixel tolerances (0.5px) are common for measurement
 *   tasks — pass an explicit `blurTolerancePx` for those.
 * - `DEFAULT_SKEW_WARN_PX = 1`: rolling-shutter skew above one pixel earns
 *   a `warn` even when blur itself passes.
 */

/** Default motion-blur tolerance: blur under one pixel counts as frozen. */
export const DEFAULT_BLUR_TOLERANCE_PX = 1

/** Default rolling-skew warning threshold, pixels. */
export const DEFAULT_SKEW_WARN_PX = 1

export interface BlurBudget {
  /** Motion blur extent on the target, mm = v * t_exp. */
  blurMm: number
  /** Motion blur extent, pixels = blurMm / gsdMmPx. */
  blurPx: number
  /** True when t_exp <= blurTolerance / v (blur within tolerance). */
  frozen: boolean
  /** Longest exposure that still freezes motion, ms = tolerance * gsd / v. */
  maxExpMs: number
  message: string
}

/**
 * Motion-blur budget: how far the target moves during the exposure, and
 * whether that motion stays inside the blur tolerance.
 *
 * Freeze condition: `t_exp <= blurTolerancePx * gsdMmPx / v`.
 *
 * @param expMs exposure time, ms (must be >= 0).
 * @param velocityMmS relative target/camera velocity, mm/s. Zero or
 *   negative means no motion — blur is 0 and any exposure freezes it.
 * @param gsdMmPx ground sample distance (mm per pixel), must be > 0.
 * @param blurTolerancePx allowed blur, pixels (default 1).
 */
export function blurBudget(
  expMs: number,
  velocityMmS: number,
  gsdMmPx: number,
  blurTolerancePx: number = DEFAULT_BLUR_TOLERANCE_PX,
): BlurBudget {
  if (!(gsdMmPx > 0)) {
    throw new RangeError(`gsdMmPx must be positive, got ${gsdMmPx}.`)
  }
  if (!(expMs >= 0)) {
    throw new RangeError(`expMs must be non-negative, got ${expMs}.`)
  }
  if (!(blurTolerancePx > 0)) {
    throw new RangeError(`blurTolerancePx must be positive, got ${blurTolerancePx}.`)
  }

  if (!(velocityMmS > 0)) {
    return {
      blurMm: 0,
      blurPx: 0,
      frozen: true,
      maxExpMs: Number.POSITIVE_INFINITY,
      message: 'No relative motion — any exposure freezes the target.',
    }
  }

  const blurMm = velocityMmS * (expMs / 1000)
  const blurPx = blurMm / gsdMmPx
  const maxExpMs = ((blurTolerancePx * gsdMmPx) / velocityMmS) * 1000
  const frozen = expMs <= maxExpMs
  return {
    blurMm,
    blurPx,
    frozen,
    maxExpMs,
    message: frozen
      ? `Blur ${blurPx.toFixed(2)}px is within the ${blurTolerancePx}px tolerance (exposure cap ${maxExpMs.toFixed(2)}ms).`
      : `Blur ${blurPx.toFixed(2)}px exceeds the ${blurTolerancePx}px tolerance — shorten exposure to ≤ ${maxExpMs.toFixed(2)}ms or slow the target.`,
  }
}

export interface RollingSkew {
  /** Skew extent across one frame readout, mm = v * T_readout. */
  skewMm: number
  /** Skew extent, pixels. Null when no GSD was provided. */
  skewPx: number | null
  message: string
}

/**
 * Rolling-shutter skew: the target displacement between the first and
 * last row of a frame, `Δx = v * T_readout`.
 *
 * @param velocityMmS relative target/camera velocity, mm/s.
 * @param readoutMs sensor frame readout time, ms (must be >= 0). When the
 *   datasheet gives no readout time, callers may estimate `1000 / fps`
 *   but must flag the result as an estimate (see `message` handling at
 *   the call site — this function reports pure math).
 * @param gsdMmPx optional GSD to also express skew in pixels.
 */
export function rollingSkew(velocityMmS: number, readoutMs: number, gsdMmPx?: number): RollingSkew {
  if (!(readoutMs >= 0)) {
    throw new RangeError(`readoutMs must be non-negative, got ${readoutMs}.`)
  }
  const skewMm = velocityMmS * (readoutMs / 1000)
  const skewPx = gsdMmPx !== undefined ? skewMm / gsdMmPx : null
  return {
    skewMm,
    skewPx,
    message:
      `Rolling skew Δx = ${skewMm.toFixed(3)}mm` +
      (skewPx !== null ? ` (${skewPx.toFixed(2)}px)` : '') +
      ' over one frame readout.',
  }
}

export interface FpsCap {
  /** Shortest achievable frame period, ms = exposure + readout + overhead. */
  frameTimeMs: number
  /** Fastest sustainable frame rate, fps = 1000 / frameTime. */
  maxFps: number
  /** Which phase dominates the frame period. */
  limitingFactor: 'exposure' | 'readout' | 'overhead'
  message: string
}

/**
 * Frame-rate ceiling from exposure + readout (+ optional overhead):
 * `maxFps = 1000 / (t_exp + T_readout + overhead)`.
 *
 * @param expMs exposure time, ms (must be >= 0).
 * @param readoutMs frame readout time, ms (must be >= 0).
 * @param overheadMs fixed per-frame overhead (trigger latency, blanking…),
 *   ms (default 0, must be >= 0).
 */
export function fpsCap(expMs: number, readoutMs: number, overheadMs: number = 0): FpsCap {
  for (const [label, value] of [['expMs', expMs], ['readoutMs', readoutMs], ['overheadMs', overheadMs]] as const) {
    if (!(value >= 0)) {
      throw new RangeError(`${label} must be non-negative, got ${value}.`)
    }
  }
  const frameTimeMs = expMs + readoutMs + overheadMs
  if (!(frameTimeMs > 0)) {
    return {
      frameTimeMs: 0,
      maxFps: Number.POSITIVE_INFINITY,
      limitingFactor: 'overhead',
      message: 'Zero frame time — frame rate is unbounded (no exposure, readout, or overhead).',
    }
  }
  const limitingFactor = expMs >= readoutMs && expMs >= overheadMs ? 'exposure' : readoutMs >= overheadMs ? 'readout' : 'overhead'
  const maxFps = 1000 / frameTimeMs
  return {
    frameTimeMs,
    maxFps,
    limitingFactor,
    message: `Frame period ${frameTimeMs.toFixed(2)}ms caps the rate at ${maxFps.toFixed(1)}fps (limited by ${limitingFactor}).`,
  }
}

export type MotionStatus = 'pass' | 'warn' | 'fail'

export interface MotionCheck {
  status: MotionStatus
  /** Motion blur, pixels (global + rolling shutters). */
  blurPx: number
  /** Rolling skew, pixels. Null for global shutters (no skew term). */
  skewPx: number | null
  message: string
}

/**
 * Global-vs-rolling motion check combining blur + skew:
 * - Global shutter: motion-blur check only (no skew term exists).
 * - Rolling shutter: blur check plus skew check (`Δx = v * T_readout`
 *   against `skewTolerancePx`).
 *
 * Status ladder: `fail` when blur exceeds its tolerance; `warn` when blur
 * passes but rolling skew exceeds its tolerance; `pass` otherwise. The
 * message strings are reusable as viz badges.
 */
export function motionCheck(args: {
  shutter: ShutterType
  expMs: number
  velocityMmS: number
  gsdMmPx: number
  readoutMs?: number
  blurTolerancePx?: number
  skewTolerancePx?: number
}): MotionCheck {
  const blurTolerancePx = args.blurTolerancePx ?? DEFAULT_BLUR_TOLERANCE_PX
  const skewTolerancePx = args.skewTolerancePx ?? DEFAULT_SKEW_WARN_PX
  const budget = blurBudget(args.expMs, args.velocityMmS, args.gsdMmPx, blurTolerancePx)

  if (!budget.frozen) {
    return {
      status: 'fail',
      blurPx: budget.blurPx,
      skewPx: null,
      message: `Motion blur ${budget.blurPx.toFixed(2)}px exceeds the ${blurTolerancePx}px tolerance — ${args.shutter} shutter cannot freeze this motion at ${args.expMs}ms exposure.`,
    }
  }

  if (args.shutter === 'rolling') {
    const readoutMs = args.readoutMs ?? 0
    const skew = rollingSkew(args.velocityMmS, readoutMs, args.gsdMmPx)
    const skewPx = skew.skewPx ?? 0
    if (skewPx > skewTolerancePx) {
      return {
        status: 'warn',
        blurPx: budget.blurPx,
        skewPx,
        message: `Blur passes (${budget.blurPx.toFixed(2)}px) but rolling skew ${skewPx.toFixed(2)}px exceeds the ${skewTolerancePx}px threshold — expect slanted verticals; prefer global shutter or a faster readout.`,
      }
    }
    return {
      status: 'pass',
      blurPx: budget.blurPx,
      skewPx,
      message: `Blur ${budget.blurPx.toFixed(2)}px and rolling skew ${skewPx.toFixed(2)}px both within tolerance.`,
    }
  }

  return {
    status: 'pass',
    blurPx: budget.blurPx,
    skewPx: null,
    message: `Global shutter: blur ${budget.blurPx.toFixed(2)}px within the ${blurTolerancePx}px tolerance, no skew term.`,
  }
}
