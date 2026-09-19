import {
  checkImageCircle,
  checkMountCompatibility,
  computeFov,
  derivePixelPitchUm,
  focalLengthForFov,
  mmPerPixel,
  nyquistResolutionLpMm,
  sensorDiagonalMm,
} from './optics'
import type { CameraInterface, Lens, Sensor, ShutterType } from './types'

/**
 * FAE (field-application-engineer) workflow helpers.
 *
 * This module implements the "application wizard" flow from the camera-fae
 * playbook — task inputs → required focal range → ranked sensor+lens
 * pairings → shareable summary — but performs **no optical math of its own**.
 * Every number comes from `optics.ts` (`focalLengthForFov`, `computeFov`,
 * `checkImageCircle`, `checkMountCompatibility`, `mmPerPixel`,
 * `nyquistResolutionLpMm`, `derivePixelPitchUm`). The only logic here is
 * requirements derivation (FAE Step 2: feature size × 3–5 px/pixel rule),
 * scoring/ranking judgment calls (documented below), and text summaries.
 */

export interface WizardInputs {
  /** Desired field of view, mm. Ignored when featureSizeMm is set. */
  targetFovHmm: number
  targetFovVmm: number
  workingDistanceMm: number
  /** Symmetric WD tolerance, percent (e.g. 10 → ±10%). Defaults to 10. */
  workingDistanceTolerancePct?: number
  /** Smallest feature of interest, mm. When set, the required FOV is derived
   * from it (feature × pixels-per-feature rule) instead of targetFovH/V. */
  featureSizeMm?: number
  /** Pixels demanded across the smallest feature. Defaults to 4 (FAE rule of
   * thumb: 3–5 px per feature for reliable detection/measurement). */
  pixelsPerFeature?: number
  requiredInterface?: CameraInterface | 'any'
  requiredShutter?: ShutterType | 'any'
}

export interface EffectiveTarget {
  fovHmm: number
  fovVmm: number
  /** Required ground resolution, mm/px — present only in feature-size mode. */
  requiredMmPerPixel: number | null
  derivedFromFeature: boolean
  pixelsPerFeature: number
}

/** Resolve what FOV the application actually needs for this sensor. */
export function effectiveTargetFov(sensor: Pick<Sensor, 'resolutionH' | 'resolutionV'>, inputs: WizardInputs): EffectiveTarget {
  const ppf = inputs.pixelsPerFeature && inputs.pixelsPerFeature > 0 ? inputs.pixelsPerFeature : 4
  if (inputs.featureSizeMm && inputs.featureSizeMm > 0) {
    // The sensor must sample the feature with `ppf` pixels, so each pixel may
    // cover at most feature/ppf mm — and the full frame then spans that times
    // the pixel count along each axis.
    const required = inputs.featureSizeMm / ppf
    return {
      fovHmm: required * sensor.resolutionH,
      fovVmm: required * sensor.resolutionV,
      requiredMmPerPixel: required,
      derivedFromFeature: true,
      pixelsPerFeature: ppf,
    }
  }
  return {
    fovHmm: inputs.targetFovHmm,
    fovVmm: inputs.targetFovVmm,
    requiredMmPerPixel: null,
    derivedFromFeature: false,
    pixelsPerFeature: ppf,
  }
}

export interface FocalRange {
  /** Focal length hitting the H target exactly at nominal WD. */
  nominalHmm: number
  /** Focal length hitting the V target exactly at nominal WD. */
  nominalVmm: number
  /** Widest-to-longest focal length spanning both axes over WD ± tolerance. */
  minMm: number
  maxMm: number
  workingDistanceLoMm: number
  workingDistanceHiMm: number
}

/**
 * Focal-length range that covers the wizard's target FOV over the working
 * distance tolerance band, for one sensor. Returns null for nonsense inputs.
 */
export function focalRangeForSensor(sensor: Pick<Sensor, 'widthMm' | 'heightMm' | 'resolutionH' | 'resolutionV'>, inputs: WizardInputs): FocalRange | null {
  const target = effectiveTargetFov(sensor, inputs)
  const wd = inputs.workingDistanceMm
  if (!(wd > 0) || !(target.fovHmm > 0) || !(target.fovVmm > 0)) return null
  const tolPct = inputs.workingDistanceTolerancePct ?? 10
  const tol = Math.min(Math.max(tolPct, 0), 90) / 100
  const wdLo = wd * (1 - tol)
  const wdHi = wd * (1 + tol)

  const candidates = [
    focalLengthForFov(target.fovHmm, sensor.widthMm, wdLo),
    focalLengthForFov(target.fovHmm, sensor.widthMm, wdHi),
    focalLengthForFov(target.fovVmm, sensor.heightMm, wdLo),
    focalLengthForFov(target.fovVmm, sensor.heightMm, wdHi),
  ]
  return {
    nominalHmm: focalLengthForFov(target.fovHmm, sensor.widthMm, wd),
    nominalVmm: focalLengthForFov(target.fovVmm, sensor.heightMm, wd),
    minMm: Math.min(...candidates),
    maxMm: Math.max(...candidates),
    workingDistanceLoMm: wdLo,
    workingDistanceHiMm: wdHi,
  }
}

export type PairingVerdict = 'fit' | 'marginal' | 'no-fit'

export interface RankedPairing {
  sensorId: string
  lensId: string
  sensorName: string
  lensName: string
  focalLengthMm: number
  fovHmm: number | null
  fovVmm: number | null
  mmPerPixelH: number | null
  coverage: 'ok' | 'tight' | 'vignetting'
  mountCompatible: boolean
  requiresSpacer: boolean
  /** Which side caps system resolution, when the lens rating is known. */
  limitingFactor: 'lens' | 'sensor' | 'unknown'
  verdict: PairingVerdict
  score: number
  reasons: string[]
}

export interface ExcludedPairing {
  sensorId: string
  lensId: string
  sensorName: string
  lensName: string
  reason: string
}

export interface RankingResult {
  ranked: RankedPairing[]
  excluded: ExcludedPairing[]
  target: EffectiveTarget | null
}

/**
 * Rank every sensor×lens pairing against the wizard inputs.
 *
 * Scoring (a judgment call, not a standard — higher is better, 0–100):
 *   start at 100
 *   FOV within 10% of target: +0 · within 25%: −15 · worse: −40
 *   invalid FOV (WD ≤ f): verdict no-fit, score 0
 *   vignetting: −40 · tight coverage: −10
 *   incompatible mount: −30 · C-lens-on-CS-body spacer: −5
 *   ground resolution coarser than the feature rule needs: −25
 *   lens resolving power below the sensor Nyquist limit: −10 (lens-limited)
 *   interface/shutter required but unspecified on the sensor: −5 flag each
 * Verdicts: ≥80 fit · 50–79 marginal · <50 no-fit.
 * Interface/shutter *mismatches* are hard filters (listed in `excluded`),
 * unknowns only flag — per the "flag, don't guess" rule, a sensor whose
 * datasheet field was never entered shouldn't vanish silently.
 */
export function rankPairings(sensors: Sensor[], lenses: Lens[], inputs: WizardInputs): RankingResult {
  const wd = inputs.workingDistanceMm
  if (!(wd > 0) || sensors.length === 0 || lenses.length === 0) {
    return { ranked: [], excluded: [], target: null }
  }

  const needInterface = inputs.requiredInterface && inputs.requiredInterface !== 'any' ? inputs.requiredInterface : null
  const needShutter = inputs.requiredShutter && inputs.requiredShutter !== 'any' ? inputs.requiredShutter : null

  const ranked: RankedPairing[] = []
  const excluded: ExcludedPairing[] = []

  for (const sensor of sensors) {
    if (needInterface && sensor.cameraInterface && sensor.cameraInterface !== needInterface) {
      for (const lens of lenses) {
        excluded.push({
          sensorId: sensor.id,
          lensId: lens.id,
          sensorName: sensor.name,
          lensName: lens.name,
          reason: `Sensor interface is ${sensor.cameraInterface}, application requires ${needInterface}.`,
        })
      }
      continue
    }
    if (needShutter && sensor.shutter && sensor.shutter !== needShutter) {
      for (const lens of lenses) {
        excluded.push({
          sensorId: sensor.id,
          lensId: lens.id,
          sensorName: sensor.name,
          lensName: lens.name,
          reason: `Sensor shutter is ${sensor.shutter}, application requires ${needShutter}.`,
        })
      }
      continue
    }

    const target = effectiveTargetFov(sensor, inputs)
    if (!(target.fovHmm > 0) || !(target.fovVmm > 0)) continue

    for (const lens of lenses) {
      const reasons: string[] = []
      let score = 100

      const fov = computeFov(sensor, lens.focalLengthMm, wd)
      const fovHmm = fov.horizontal.fovMm
      const fovVmm = fov.vertical.fovMm

      if (fovHmm === null || fovVmm === null) {
        ranked.push({
          sensorId: sensor.id,
          lensId: lens.id,
          sensorName: sensor.name,
          lensName: lens.name,
          focalLengthMm: lens.focalLengthMm,
          fovHmm,
          fovVmm,
          mmPerPixelH: null,
          coverage: checkImageCircle(lens, sensor).status,
          mountCompatible: checkMountCompatibility(lens.mount, sensor.mount).compatible,
          requiresSpacer: checkMountCompatibility(lens.mount, sensor.mount).requiresSpacer,
          limitingFactor: 'unknown',
          verdict: 'no-fit',
          score: 0,
          reasons: [fov.horizontal.message ?? 'Invalid geometry at this working distance.'],
        })
        continue
      }

      const errH = Math.abs(fovHmm - target.fovHmm) / target.fovHmm
      const errV = Math.abs(fovVmm - target.fovVmm) / target.fovVmm
      const err = Math.max(errH, errV)
      const errPct = Math.round(err * 100)
      if (err <= 0.1) {
        reasons.push(`FOV ${fovHmm.toFixed(0)}×${fovVmm.toFixed(0)}mm is within ${errPct}% of target.`)
      } else if (err <= 0.25) {
        score -= 15
        reasons.push(`FOV ${fovHmm.toFixed(0)}×${fovVmm.toFixed(0)}mm is ${errPct}% off target — workable if framing is flexible.`)
      } else {
        score -= 40
        reasons.push(`FOV ${fovHmm.toFixed(0)}×${fovVmm.toFixed(0)}mm is ${errPct}% off the ${target.fovHmm.toFixed(0)}×${target.fovVmm.toFixed(0)}mm target.`)
      }

      const circle = checkImageCircle(lens, sensor)
      if (circle.status === 'vignetting') {
        score -= 40
        reasons.push(`Vignetting: ${lens.imageCircleMm.toFixed(1)}mm image circle vs ${circle.sensorDiagonalMm.toFixed(1)}mm sensor diagonal.`)
      } else if (circle.status === 'tight') {
        score -= 10
        reasons.push(`Tight coverage: only ${circle.marginMm.toFixed(1)}mm margin — expect soft corners.`)
      } else {
        reasons.push(`Image circle covers the sensor (${circle.marginMm.toFixed(1)}mm margin).`)
      }

      const mount = checkMountCompatibility(lens.mount, sensor.mount)
      if (!mount.compatible) {
        score -= 30
        reasons.push(`Mount mismatch: ${mount.message}`)
      } else if (mount.requiresSpacer) {
        score -= 5
        reasons.push('Mount workable with a 5mm C→CS spacer ring.')
      }

      const groundRes = mmPerPixel(fovHmm, sensor.resolutionH)
      if (target.requiredMmPerPixel !== null) {
        if (groundRes <= target.requiredMmPerPixel) {
          reasons.push(
            `${groundRes.toFixed(4)}mm/px resolves a ${inputs.featureSizeMm}mm feature with ~${((inputs.featureSizeMm ?? 0) / groundRes).toFixed(1)}px (needs ${target.pixelsPerFeature}).`,
          )
        } else {
          score -= 25
          reasons.push(
            `${groundRes.toFixed(4)}mm/px is coarser than the ${target.requiredMmPerPixel.toFixed(4)}mm/px the ${inputs.featureSizeMm}mm feature needs — too few pixels on target.`,
          )
        }
      }

      let limitingFactor: RankedPairing['limitingFactor'] = 'unknown'
      if (lens.resolvingPowerLpMm && lens.resolvingPowerLpMm > 0) {
        const sensorNyquist = nyquistResolutionLpMm(derivePixelPitchUm(sensor))
        if (lens.resolvingPowerLpMm < sensorNyquist) {
          limitingFactor = 'lens'
          score -= 10
          reasons.push(
            `Lens-limited: lens rated ${lens.resolvingPowerLpMm} lp/mm vs sensor Nyquist ${sensorNyquist.toFixed(0)} lp/mm — extra pixels won't add detail.`,
          )
        } else {
          limitingFactor = 'sensor'
          reasons.push(`Sensor-limited: sensor Nyquist ${sensorNyquist.toFixed(0)} lp/mm is the bottleneck, lens keeps up.`)
        }
      }

      if (needInterface && !sensor.cameraInterface) {
        score -= 5
        reasons.push(`Interface not specified for this sensor — verify it offers ${needInterface} before committing.`)
      }
      if (needShutter && !sensor.shutter) {
        score -= 5
        reasons.push(`Shutter type not specified — verify ${needShutter} shutter for this motion case.`)
      }

      const clamped = Math.max(0, Math.min(100, Math.round(score)))
      ranked.push({
        sensorId: sensor.id,
        lensId: lens.id,
        sensorName: sensor.name,
        lensName: lens.name,
        focalLengthMm: lens.focalLengthMm,
        fovHmm,
        fovVmm,
        mmPerPixelH: groundRes,
        coverage: circle.status,
        mountCompatible: mount.compatible,
        requiresSpacer: mount.requiresSpacer,
        limitingFactor,
        verdict: clamped >= 80 ? 'fit' : clamped >= 50 ? 'marginal' : 'no-fit',
        score: clamped,
        reasons,
      })
    }
  }

  ranked.sort((a, b) => b.score - a.score || a.lensName.localeCompare(b.lensName))
  const firstSensor = sensors[0]
  return { ranked, excluded, target: firstSensor ? effectiveTargetFov(firstSensor, inputs) : null }
}

export interface PairingExplanation {
  coverageHeadline: string
  coverageBody: string
  mountHeadline: string
  mountBody: string
}

/**
 * Plain-language mount/coverage explainer for one pairing. Numbers come from
 * optics.ts; only the prose lives here.
 */
export function explainPairing(sensor: Pick<Sensor, 'name' | 'widthMm' | 'heightMm' | 'mount'>, lens: Pick<Lens, 'name' | 'mount' | 'imageCircleMm'>): PairingExplanation {
  const circle = checkImageCircle(lens, sensor)
  const mount = checkMountCompatibility(lens.mount, sensor.mount)
  const diagonal = sensorDiagonalMm(sensor)

  const coverageHeadline =
    circle.status === 'ok'
      ? 'Coverage is comfortable'
      : circle.status === 'tight'
        ? 'Coverage is tight — check the corners'
        : 'Coverage fails — expect dark corners'
  const coverageBody =
    `Every lens projects a circular image; the rectangular sensor must fit inside it. ` +
    `This lens covers ${lens.imageCircleMm.toFixed(1)}mm corner-to-corner, while this sensor's active area ` +
    `(${sensor.widthMm.toFixed(2)}×${sensor.heightMm.toFixed(2)}mm) measures ${diagonal.toFixed(1)}mm on the diagonal — ` +
    (circle.marginMm >= 0
      ? `leaving ${circle.marginMm.toFixed(1)}mm of margin. `
      : `falling short by ${Math.abs(circle.marginMm).toFixed(1)}mm. `) +
    (circle.status === 'ok'
      ? 'There is room for manufacturing tolerance and the corners should stay sharp.'
      : circle.status === 'tight'
        ? 'It fits on paper, but with under 10% margin there is little room for tolerance — budget a test shot of the corners before committing.'
        : 'The sensor corners fall outside the illuminated circle, so they will vignette (go dark/soft). Pick a lens rated for a larger format or a smaller sensor.')

  const mountHeadline = !mount.compatible
    ? 'Mounts do not mate'
    : mount.requiresSpacer
      ? 'Mounts mate with a 5mm spacer'
      : 'Mounts mate directly'
  const mountBody =
    `Lens mounts are about flange-back distance — how far the lens sits from the sensor. ` +
    `C-mount seats 17.526mm out, CS-mount 12.526mm: exactly 5mm apart. ` +
    (lens.mount === sensor.mount
      ? `Both sides are ${lens.mount}, so the lens seats at its designed distance with no adapter.`
      : lens.mount === 'C' && sensor.mount === 'CS'
        ? 'This C-mount lens on a CS-mount body sits 5mm too close, which a standard 5mm spacer/adapter ring corrects — a cheap, routine fix.'
        : lens.mount === 'CS' && sensor.mount === 'C'
          ? 'This CS-mount lens on a C-mount body would need to sit 5mm *closer* than the mount allows — a negative spacer, which does not exist. This pairing cannot reach focus.'
          : `${mount.message} Adapter glass exists for some cross-family pairs but changes the optics, so treat this as a mechanical verification task, not a drop-in fit.`)

  return { coverageHeadline, coverageBody, mountHeadline, mountBody }
}

/** Plain-text summary of a ranking result, suitable for clipboard sharing. */
export function shareCardText(inputs: WizardInputs, result: RankingResult, topN = 3): string {
  const lines: string[] = []
  lines.push('Camera + lens shortlist (camera-selection-tool)')
  const targetBits = result.target?.derivedFromFeature
    ? `feature ${inputs.featureSizeMm}mm @ ${result.target.pixelsPerFeature}px/feature`
    : `FOV ${inputs.targetFovHmm}×${inputs.targetFovVmm}mm`
  lines.push(`Task: ${targetBits}, WD ${inputs.workingDistanceMm}mm`)
  if (inputs.requiredInterface && inputs.requiredInterface !== 'any') lines.push(`Interface: ${inputs.requiredInterface}`)
  if (inputs.requiredShutter && inputs.requiredShutter !== 'any') lines.push(`Shutter: ${inputs.requiredShutter}`)
  lines.push('')
  if (result.ranked.length === 0) {
    lines.push('No pairings to rank — add sensors and lenses first.')
  } else {
    result.ranked.slice(0, topN).forEach((p, i) => {
      const fov = p.fovHmm !== null && p.fovVmm !== null ? `${p.fovHmm.toFixed(0)}×${p.fovVmm.toFixed(0)}mm` : 'invalid at this WD'
      const res = p.mmPerPixelH !== null ? `, ${p.mmPerPixelH.toFixed(4)}mm/px` : ''
      lines.push(`${i + 1}. [${p.verdict.toUpperCase()} ${p.score}] ${p.sensorName} + ${p.lensName} — FOV ${fov}${res}, coverage ${p.coverage}, mount ${p.mountCompatible ? 'ok' : 'MISMATCH'}`)
      for (const r of p.reasons.slice(0, 2)) lines.push(`   - ${r}`)
    })
    if (result.excluded.length > 0) lines.push(`Excluded by filters: ${result.excluded.length} pairing(s).`)
  }
  return lines.join('\n')
}
