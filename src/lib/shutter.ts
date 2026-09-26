/**
 * Track VIZ adapter over Track OPTICS shutter physics.
 *
 * The physics lives in `src/lib/shutterMath.ts` (`blurBudget`,
 * `rollingSkew` — landed by Track OPTICS while this track was in flight).
 * This module adapts it to the viz contract: it adds the fps-based
 * readout estimate (explicitly flagged — `shutterMath` deliberately leaves
 * estimation to callers) and the advisory-only degradation when motion
 * input or GSD is missing (`unknown`, never a fail from absence).
 * No physics is duplicated here — only presentation shaping.
 */
import { blurBudget, rollingSkew } from './shutterMath'
import { DEFAULT_SKEW_WARN_PX } from './shutterMath'
import type { ShutterType } from './types'

export type ShutterOverlayStatus = 'pass' | 'warn' | 'fail' | 'unknown'

export interface ShutterMotionInput {
  /** Target velocity in mm/s. */
  targetVelocityMms?: number
  /** Exposure time in ms. */
  exposureMs?: number
  /** Frame readout time in ms (rolling shutter). When absent, skew is estimated from fpsHint. */
  readoutMs?: number
  /** Sensor frame rate in fps — used to estimate T_readout ≈ 1000/fps when readoutMs is absent. */
  fpsHint?: number
}

export interface ShutterOverlayInfo {
  status: ShutterOverlayStatus
  /** Motion blur extent in mm (v · t_exp), null when motion input is missing. */
  blurMm: number | null
  /** Rolling-shutter skew in mm (v · T_readout), null for global/unknown or missing input. */
  skewMm: number | null
  /** True when T_readout was estimated (no measured value available). */
  readoutEstimated: boolean
  /** Short chip label, e.g. "blur 2.50mm · skew 1.00mm". */
  label: string
  /** Longer explanation for the badge tooltip. */
  message: string
}

/** Estimate frame readout time from fps (`T ≈ 1/fps`) — callers must flag it. */
export function estimateReadoutMs(fps: number): number | null {
  if (!Number.isFinite(fps) || fps <= 0) return null
  return 1000 / fps
}

/**
 * Pure, UI-free shutter readout for one slot. Advisory-only (`unknown`,
 * never fail) when motion input or GSD is missing — missing data must not
 * render as a failure. Status ladder follows `shutterMath`: blur past the
 * 1px tolerance fails; blur inside tolerance but rolling skew past its
 * threshold warns.
 */
export function shutterOverlayInfo(
  shutter: ShutterType | undefined,
  pixelSizeMm: number | null | undefined,
  motion: ShutterMotionInput = {},
): ShutterOverlayInfo {
  const v = motion.targetVelocityMms
  const expMs = motion.exposureMs
  const hasMotion =
    v != null && expMs != null && Number.isFinite(v) && Number.isFinite(expMs) && v > 0 && expMs > 0

  if (!hasMotion) {
    if (shutter === 'global') {
      return {
        status: 'unknown',
        blurMm: null,
        skewMm: null,
        readoutEstimated: false,
        label: 'global shutter · blur check needs v + t_exp',
        message:
          'Global shutter: skew N/A, motion blur needs target velocity + exposure (center-stage control, Track UI).',
      }
    }
    if (shutter === 'rolling') {
      return {
        status: 'unknown',
        blurMm: null,
        skewMm: null,
        readoutEstimated: false,
        label: 'rolling shutter · blur+skew check needs v + t_exp',
        message:
          'Rolling shutter: blur + skew (Δx = v·T_readout) need target velocity + exposure (center-stage control, Track UI).',
      }
    }
    return {
      status: 'unknown',
      blurMm: null,
      skewMm: null,
      readoutEstimated: false,
      label: 'shutter unknown — verify datasheet',
      message: 'Shutter type not recorded for this sensor — check the datasheet before relying on motion performance.',
    }
  }

  const velocity = v as number
  const exposureMs = expMs as number
  const gsdOk = pixelSizeMm != null && Number.isFinite(pixelSizeMm) && (pixelSizeMm as number) > 0

  const blurMm = velocity * (exposureMs / 1000)
  if (!gsdOk) {
    return {
      status: 'unknown',
      blurMm,
      skewMm: null,
      readoutEstimated: false,
      label: `blur ${blurMm.toFixed(2)}mm · px unknown (no GSD)`,
      message: `Blur v·t_exp = ${blurMm.toFixed(2)}mm, but without GSD it cannot be bucketed — advisory only.`,
    }
  }
  const gsd = pixelSizeMm as number

  const budget = blurBudget(exposureMs, velocity, gsd)
  if (!budget.frozen) {
    return {
      status: 'fail',
      blurMm: budget.blurMm,
      skewMm: null,
      readoutEstimated: false,
      label: `blur ${budget.blurMm.toFixed(2)}mm · ${budget.blurPx.toFixed(1)}px — over tolerance`,
      message: budget.message,
    }
  }

  if (shutter === 'rolling') {
    let readoutMs: number | null = null
    let readoutEstimated = false
    if (motion.readoutMs != null && Number.isFinite(motion.readoutMs) && motion.readoutMs > 0) {
      readoutMs = motion.readoutMs
    } else if (motion.fpsHint != null && Number.isFinite(motion.fpsHint) && motion.fpsHint > 0) {
      readoutMs = estimateReadoutMs(motion.fpsHint)
      readoutEstimated = readoutMs != null
    }
    if (readoutMs == null) {
      return {
        status: 'unknown',
        blurMm: budget.blurMm,
        skewMm: null,
        readoutEstimated: false,
        label: `blur ${budget.blurMm.toFixed(2)}mm · ${budget.blurPx.toFixed(1)}px · skew unknown (no readout)`,
        message: `${budget.message} Rolling skew not quantified — no readout time or fps hint.`,
      }
    }
    const skew = rollingSkew(velocity, readoutMs, gsd)
    const skewPx = skew.skewPx ?? 0
    const warn = skewPx > DEFAULT_SKEW_WARN_PX
    const estNote = readoutEstimated ? ' (T_readout estimated from fps — verify datasheet)' : ''
    return {
      status: warn ? 'warn' : 'pass',
      blurMm: budget.blurMm,
      skewMm: skew.skewMm,
      readoutEstimated,
      label:
        `blur ${budget.blurMm.toFixed(2)}mm · skew ${skew.skewMm.toFixed(2)}mm` +
        `${readoutEstimated ? ' (est.)' : ''} · ${skewPx.toFixed(1)}px skew`,
      message: `${budget.message} ${skew.message}${estNote}`,
    }
  }

  return {
    status: 'pass',
    blurMm: budget.blurMm,
    skewMm: null,
    readoutEstimated: false,
    label: `blur ${budget.blurMm.toFixed(2)}mm · ${budget.blurPx.toFixed(1)}px`,
    message: `Global shutter (no skew): ${budget.message}`,
  }
}
