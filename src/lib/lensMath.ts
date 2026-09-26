import { computeFovAxis, type FovRisk } from './optics'

/**
 * Lens-type-aware field of view along one sensor axis.
 *
 * Two physics branches, gated on `lens.lensType`:
 *
 * - Entocentric (plus `fixed-focus` / `varifocal`, which are entocentric
 *   designs mechanically): thin-lens `FOV = dim * (WD - f) / f`, delegated
 *   to `computeFovAxis` in `./optics` so the `WD <= f` invalid guard and
 *   the magnification risk buckets (<0.5 normal / 0.5–2 macro / >=2
 *   extreme-macro) stay in exactly one place.
 * - Telecentric: `FOV = dim / m`, independent of working distance while
 *   the target stays inside the lens's telecentric range. WD only gates
 *   the `limited` flag — it never rescales the FOV.
 *
 * `LensSpec` is intentionally a minimal structural subset (not the full
 * `Lens` from `./types`, which has no `lensType` field yet) so this
 * module lands without touching shared types or seed data.
 */
export type LensType = 'entocentric' | 'fixed-focus' | 'varifocal' | 'telecentric'

export interface LensSpec {
  lensType: LensType
  /** Focal length in mm. Required for the thin-lens (entocentric-family) branch. */
  focalLengthMm?: number
  /** Object-side magnification (e.g. 0.5 = 0.5x). Required for the telecentric branch. */
  magnification?: number
}

export interface LensFovResult {
  /** Field of view along the axis, mm. Null when the geometry is invalid. */
  fovMm: number | null
  /** Image/object magnification. Null when invalid. */
  magnification: number | null
  /** Echo of the branch taken. */
  lensType: LensType
  /**
   * True only for telecentric lenses used outside their telecentric
   * range — chief rays are no longer parallel there, so magnification
   * drifts and the `FOV = dim / m` value is approximate. Always false
   * for the entocentric branch (its FOV scales with WD by design).
   */
  limited: boolean
  risk: FovRisk
  /** Human-readable explanation, present for macro/extreme-macro/invalid/limited outcomes. */
  message?: string
}

/**
 * Field of view for one sensor-axis dimension, dispatched on lens type.
 *
 * @param sensorDimMm sensor extent along the axis, mm (width or height).
 * @param lens lens description; entocentric-family needs `focalLengthMm`,
 *   telecentric needs `magnification`.
 * @param wdMm working distance, mm.
 * @param telecentricRangeMm optional `[minMm, maxMm]` telecentric range for
 *   the WD gate; when omitted a telecentric lens is assumed in-range.
 */
export function computeFovForLens(
  sensorDimMm: number,
  lens: LensSpec,
  wdMm: number,
  telecentricRangeMm?: readonly [number, number],
): LensFovResult {
  if (lens.lensType === 'telecentric') {
    const m = lens.magnification
    if (m === undefined || !(m > 0)) {
      return {
        fovMm: null,
        magnification: null,
        lensType: lens.lensType,
        limited: false,
        risk: 'invalid',
        message: 'Telecentric FOV needs a positive magnification (m) — none was provided.',
      }
    }
    const fovMm = sensorDimMm / m
    if (telecentricRangeMm !== undefined) {
      const [minMm, maxMm] = telecentricRangeMm
      if (wdMm < minMm || wdMm > maxMm) {
        return {
          fovMm,
          magnification: m,
          lensType: lens.lensType,
          limited: true,
          risk: 'normal',
          message:
            `Working distance ${wdMm}mm is outside the telecentric range ` +
            `(${minMm}–${maxMm}mm) — magnification drifts there, treat FOV ${fovMm.toFixed(2)}mm as approximate.`,
        }
      }
    }
    return { fovMm, magnification: m, lensType: lens.lensType, limited: false, risk: 'normal' }
  }

  // Entocentric family: thin-lens path with the WD >> f guard inherited
  // from computeFovAxis (WD <= f -> invalid; macro risk buckets).
  const f = lens.focalLengthMm
  if (f === undefined || !(f > 0)) {
    return {
      fovMm: null,
      magnification: null,
      lensType: lens.lensType,
      limited: false,
      risk: 'invalid',
      message: 'Entocentric FOV needs a positive focal length — none was provided.',
    }
  }
  const axis = computeFovAxis(sensorDimMm, f, wdMm)
  return {
    fovMm: axis.fovMm,
    magnification: axis.magnification,
    lensType: lens.lensType,
    limited: false,
    risk: axis.risk,
    ...(axis.message !== undefined ? { message: axis.message } : {}),
  }
}
