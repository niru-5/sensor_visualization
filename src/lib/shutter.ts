/**
 * Minimal shutter math for Track VIZ (blur/skew readout).
 *
 * Canonical home for shutter physics is Track OPTICS (`src/lib/shutter.ts`
 * per docs/FLOW-REDESIGN-TODO.md) — but OPTICS has not landed yet and the
 * center stage needs blur/skew numbers now. This module provides the pure,
 * UI-free core (`motionBlurMm`, `readoutSkewMm`, `shutterOverlayInfo`) with
 * no hardware database behind it: readout times fall back to an fps-based
 * estimate explicitly flagged as such, and verdicts degrade to advisory
 * (`unknown`) whenever inputs are missing. When OPTICS lands, it may
 * extend or supersede this module — the `ShutterOverlayInfo` shape is the
 * contract the viz component depends on.
 */
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

/** Blur verdict thresholds in pixels (Track OPTICS rationale lives here until that track lands). */
export const BLUR_WARN_PX = 1
export const BLUR_FAIL_PX = 3

/** Motion-blur extent: `blur = v · t_exp` (v in mm/s, t in s → mm). */
export function motionBlurMm(velocityMms: number, exposureS: number): number {
  return velocityMms * exposureS
}

/** Rolling-shutter skew: `Δx = v · T_readout` (v in mm/s, T in s → mm). */
export function readoutSkewMm(velocityMms: number, readoutS: number): number {
  return velocityMms * readoutS
}

/** Estimate frame readout time from fps (`T ≈ 1/fps`) — flagged as estimate by callers. */
export function estimateReadoutMs(fps: number): number | null {
  if (!Number.isFinite(fps) || fps <= 0) return null
  return 1000 / fps
}

/** Bucket a blur extent (mm) against pixel size: <1px pass, 1–3px warn, >3px fail. */
export function blurVerdict(blurMm: number, pixelSizeMm: number | null | undefined): ShutterOverlayStatus {
  if (pixelSizeMm == null || !Number.isFinite(pixelSizeMm) || pixelSizeMm <= 0) return 'unknown'
  const px = blurMm / pixelSizeMm
  if (px > BLUR_FAIL_PX) return 'fail'
  if (px >= BLUR_WARN_PX) return 'warn'
  return 'pass'
}

/**
 * Pure, UI-free shutter readout for one slot. Advisory-only (`unknown`,
 * never fail) when motion input or GSD is missing — missing data must not
 * render as a failure.
 */
export function shutterOverlayInfo(
  shutter: ShutterType | undefined,
  pixelSizeMm: number | null | undefined,
  motion: ShutterMotionInput = {},
): ShutterOverlayInfo {
  const v = motion.targetVelocityMms
  const tExpS = motion.exposureMs != null ? motion.exposureMs / 1000 : null
  const hasMotion =
    v != null && tExpS != null && Number.isFinite(v) && Number.isFinite(tExpS) && v > 0 && tExpS > 0

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
  const exposureS = tExpS as number
  const blurMm = motionBlurMm(velocity, exposureS)
  let skewMm: number | null = null
  let readoutEstimated = false
  if (shutter === 'rolling') {
    if (motion.readoutMs != null && Number.isFinite(motion.readoutMs) && motion.readoutMs > 0) {
      skewMm = readoutSkewMm(velocity, motion.readoutMs / 1000)
    } else if (motion.fpsHint != null && Number.isFinite(motion.fpsHint) && motion.fpsHint > 0) {
      const est = estimateReadoutMs(motion.fpsHint)
      if (est != null) {
        skewMm = readoutSkewMm(velocity, est / 1000)
        readoutEstimated = true
      }
    }
  }

  const status = blurVerdict(blurMm, pixelSizeMm)
  const px =
    pixelSizeMm != null && Number.isFinite(pixelSizeMm) && pixelSizeMm > 0 ? blurMm / pixelSizeMm : null

  const parts = [`blur ${blurMm.toFixed(2)}mm`]
  if (skewMm != null) parts.push(`skew ${skewMm.toFixed(2)}mm${readoutEstimated ? ' (est.)' : ''}`)
  if (px != null) parts.push(`${px.toFixed(1)}px`)
  const label = parts.join(' · ')
  const message =
    shutter === 'rolling'
      ? `Rolling shutter: blur v·t_exp = ${blurMm.toFixed(2)}mm` +
        (skewMm != null
          ? `, skew v·T_readout = ${skewMm.toFixed(2)}mm${readoutEstimated ? ' (T_readout estimated from fps — verify datasheet)' : ''}`
          : ' (readout time unknown — skew not quantified)') +
        `. Blur ${px != null ? `${px.toFixed(1)}px` : 'in px unknown (no GSD)'}.`
      : `Global shutter (no skew): blur v·t_exp = ${blurMm.toFixed(2)}mm` +
        `${px != null ? ` (${px.toFixed(1)}px)` : ' (px unknown — no GSD)'}.`

  return { status, blurMm, skewMm, readoutEstimated, label, message }
}
