/**
 * Track VIZ — per-slot compatibility summary for the shared-stage badges.
 *
 * Pure, UI-free composition of Track DB rules (`interfaceCheck`) and optics
 * checks (`checkMountCompatibility`, `checkImageCircle`) into one compact
 * verdict per camera slot. `SharedFovView.tsx` renders these as small Html
 * badges on the stage; risk colors are reserved for the badges, never the
 * frustum tint (per VIZ palette rule).
 *
 * Missing data degrades to warn/unknown — never a silent pass, never a
 * fail from absence alone.
 */
import { INTERFACE_LIMITS_M, interfaceCheck } from './database/rules'
import { checkImageCircle, checkMountCompatibility } from './optics'
import type { Lens, Sensor } from './types'

export type CompatTone = 'pass' | 'warn' | 'fail'

export interface CompatSummary {
  tone: CompatTone
  /** Compact glyphs, e.g. "IF ✓ · MNT ~ · IMG ✓". */
  glyphs: string
  /** Joined check messages for the badge tooltip. */
  title: string
}

/**
 * Interface / mount / image-circle summary for one sensor+lens pairing.
 * `cableLengthM` gates a real interface pass/fail; without it the
 * interface leg is informational (warn, never fail).
 */
export function slotCompatSummary(
  sensor: Pick<Sensor, 'mount' | 'cameraInterface' | 'widthMm' | 'heightMm'>,
  lens: Pick<Lens, 'mount' | 'imageCircleMm'>,
  cableLengthM?: number,
): CompatSummary {
  const mount = checkMountCompatibility(lens.mount, sensor.mount)
  const coverage = checkImageCircle(lens, sensor)

  let ifGlyph = '?'
  let ifTone: CompatTone = 'warn'
  let ifMsg: string
  const iface = sensor.cameraInterface
  if (iface === undefined || iface === 'other') {
    ifMsg = 'Interface unknown — verify against the camera datasheet before committing to cabling.'
  } else if (cableLengthM == null || !Number.isFinite(cableLengthM)) {
    const limit = INTERFACE_LIMITS_M[iface]
    ifMsg =
      limit != null
        ? `${iface} interface (passive limit ~${limit}m) — set a cable length for a pass/fail check.`
        : `${iface} interface — no passive-limit data, verify against the datasheet.`
  } else {
    const res = interfaceCheck(iface, cableLengthM)
    ifMsg = res.message
    ifGlyph = res.pass ? '✓' : '✗'
    ifTone = res.pass ? 'pass' : 'fail'
  }

  const mountGlyph = mount.compatible ? (mount.requiresSpacer ? '~' : '✓') : '✗'
  const mountTone: CompatTone = mount.compatible ? (mount.requiresSpacer ? 'warn' : 'pass') : 'fail'
  const imgGlyph = coverage.status === 'ok' ? '✓' : coverage.status === 'tight' ? '~' : '✗'
  const imgTone: CompatTone = coverage.status === 'ok' ? 'pass' : coverage.status === 'tight' ? 'warn' : 'fail'

  const tone: CompatTone =
    ifTone === 'fail' || mountTone === 'fail' || imgTone === 'fail'
      ? 'fail'
      : ifTone === 'warn' || mountTone === 'warn' || imgTone === 'warn'
        ? 'warn'
        : 'pass'

  return {
    tone,
    glyphs: `IF ${ifGlyph} · MNT ${mountGlyph} · IMG ${imgGlyph}`,
    title: [ifMsg, mount.message, coverage.message].join('\n'),
  }
}
