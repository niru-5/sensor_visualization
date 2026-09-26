import { getCameraFamily, type CameraFamilyId } from './database/cameras'
import { coverageCheck, environmentRating, interfaceCheck, type EnvRequirement } from './database/rules'
import { lookupCompat, type SoftwareId } from './database/software'
import { rankPairings, type PairingVerdict, type WizardInputs } from './fae'
import { sensorDiagonalMm } from './optics'
import type { CameraInterface, Lens, Sensor, ShutterType } from './types'

/**
 * SuggestionEngine v1 — rule-based advice layer for the 3-pane redesign
 * (`docs/UI-DESIGN-3PANE.md` §3.3).
 *
 * Pipeline: free-text question → {@link parseAdviceQuery} (keyword/regex
 * extraction, no LLM) → {@link buildWizardInputs} → existing
 * `rankPairings()` from `fae.ts` (no new optical math) → environment and
 * software-compat modifiers → ranked {@link Suggestion} cards with
 * VERIFIED / NEEDS-VERIFY evidence tags and first-class failedChecks.
 *
 * "Flag, don't guess" (same rule as `rankPairings`): unknown datasheet
 * fields never silently drop a pairing — they surface as NEEDS-VERIFY
 * evidence. Hard mismatches (wrong interface/shutter, NOT-SUPPORTED
 * software) are kept as trailing `no-fit` suggestions with a failing
 * check, so the UI can explain *why* instead of showing an empty list.
 */

export type Environment = 'diy' | 'manufacturing'

export interface SuggestionContext {
  sensors: Sensor[]
  lenses: Lens[]
  /** Explicit sensor-id → camera-family mapping for software/env checks.
   * Falls back to name-keyword inference ({@link familyForSensor}). */
  sensorFamily?: Record<string, CameraFamilyId>
  defaultWorkingDistanceMm?: number
  defaultFovHmm?: number
  defaultFovVmm?: number
  environment?: Environment
  /** Cable run to check against interface passive limits, meters. */
  cableLengthM?: number
}

export interface ParsedQuery {
  workingDistanceMm?: number
  targetFovHmm?: number
  targetFovVmm?: number
  featureSizeMm?: number
  requiredInterface?: CameraInterface
  requiredShutter?: ShutterType
  software?: SoftwareId
  /** Jetson CSI implies per-model drivers — flagged NEEDS-VERIFY downstream. */
  jetsonCsi?: boolean
  environment?: Environment
  envRequirement?: EnvRequirement
  useCase?: string
  /** Echo chips for the UI ("we read: WD 500 mm · GigE · global"). */
  chips: string[]
}

export interface EvidenceTag {
  claim: string
  status: 'VERIFIED' | 'NEEDS-VERIFY'
  /** Source citation — always present for VERIFIED rows. */
  url?: string
  note?: string
}

export interface FailedCheck {
  check: 'coverage' | 'mount' | 'interface' | 'shutter' | 'software' | 'environment' | 'cable'
  pass: boolean
  message: string
}

export interface Suggestion {
  rank: number
  cameraId: string
  lensId: string
  cameraName: string
  lensName: string
  score: number
  verdict: PairingVerdict
  fovHmm: number | null
  fovVmm: number | null
  mmPerPixelH: number | null
  coverage: 'ok' | 'tight' | 'vignetting'
  mountCompatible: boolean
  reasons: string[]
  evidence: EvidenceTag[]
  failedChecks: FailedCheck[]
}

const NUMBER_MM = '(\\d+(?:\\.\\d+)?)\\s*mm'

/**
 * Keyword/rule-based extraction of task constraints from a natural-language
 * question. Everything extracted is echoed in `chips`; anything unparsed
 * stays in the raw text and never becomes a constraint.
 */
export function parseAdviceQuery(text: string): ParsedQuery {
  const q = text.toLowerCase()
  const chips: string[] = []
  const parsed: ParsedQuery = { chips }

  // Feature size ("2 mm screws/defects/features/...").
  const feature = q.match(new RegExp(`${NUMBER_MM}\\s*(?:screw|defect|feature|crack|label|part|component|pin|ball|wire|pad|trace)s?`))
  if (feature) {
    parsed.featureSizeMm = parseFloat(feature[1])
    chips.push(`feature ${feature[1]} mm`)
  }

  // FOV-ish extent ("300 mm tray/belt/field/FOV/...").
  const fov = q.match(new RegExp(`${NUMBER_MM}\\s*(?:tray|belt|fov|field(?:\\s*of\\s*view)?|frame|conveyor|stage|area|width)`))
  if (fov) {
    parsed.targetFovHmm = parseFloat(fov[1])
    parsed.targetFovVmm = parseFloat(fov[1])
    chips.push(`FOV ~${fov[1]} mm`)
  }

  // Working distance — explicit markers first, else the last bare mm number.
  const wdExplicit = q.match(
    new RegExp(`(?:working distance|stand-?off|from|at|wd|distance of)[^\\d]{0,20}${NUMBER_MM}`),
  )
  if (wdExplicit) {
    parsed.workingDistanceMm = parseFloat(wdExplicit[1])
    chips.push(`WD ${wdExplicit[1]} mm`)
  } else {
    const allMm = [...q.matchAll(new RegExp(NUMBER_MM, 'g'))].map((m) => m[1])
    // Numbers already claimed by feature/FOV stay claimed; an unclaimed
    // trailing number is most likely the stand-off distance.
    const claimed = new Set([feature?.[1], fov?.[1]].filter(Boolean))
    const unclaimed = allMm.filter((n) => !claimed.has(n))
    if (unclaimed.length > 0) {
      parsed.workingDistanceMm = parseFloat(unclaimed[unclaimed.length - 1])
      chips.push(`WD ${unclaimed[unclaimed.length - 1]} mm (?)`)
    }
  }

  // Interface tokens.
  const iface: Array<[RegExp, CameraInterface, string]> = [
    [/gige|gigabit|1000base/, 'GigE', 'GigE'],
    [/coaxpress|cxp/, 'CoaXPress', 'CoaXPress'],
    [/camera[\s-]?link/, 'CameraLink', 'CameraLink'],
    [/usb3|usb\s*3|usb\b/, 'USB3', 'USB3'],
    [/mipi|csi|jetson|raspberry|\brpi\b/, 'MIPI', 'MIPI'],
  ]
  for (const [re, value, label] of iface) {
    if (re.test(q)) {
      parsed.requiredInterface = value
      chips.push(label)
      break
    }
  }

  // Shutter / motion tokens: anything moving fast needs global.
  if (/conveyor|moving|motion|fast|line[\s-]?speed|blur|vibrat|production line|line moves|on the fly/.test(q)) {
    parsed.requiredShutter = 'global'
    chips.push('global shutter (motion)')
  } else if (/static|still|stationary|benchtop|tripod/.test(q)) {
    chips.push('any shutter (static)')
  }

  // Software tokens.
  const software: Array<[RegExp, SoftwareId, string]> = [
    [/micro[\s-]?manager/, 'micromanager', 'Micro-Manager'],
    [/sharpcap/, 'sharpcap', 'SharpCap'],
    [/halcon/, 'halcon', 'HALCON'],
    [/labview|imaqdx/, 'labview-imaqdx', 'LabVIEW'],
    [/(^|[^a-z])ros([^a-z]|$)/, 'ros', 'ROS'],
    [/spinnaker/, 'spinnaker', 'Spinnaker'],
    [/pylon/, 'pylon', 'pylon'],
  ]
  for (const [re, value, label] of software) {
    if (re.test(q)) {
      parsed.software = value
      chips.push(label)
      break
    }
  }
  if (/jetson|orinnano|orin nano/.test(q)) {
    parsed.jetsonCsi = true
    // Jetson CSI = MIPI unless the question says otherwise.
    if (!parsed.requiredInterface) {
      parsed.requiredInterface = 'MIPI'
      chips.push('MIPI (Jetson CSI)')
    }
    chips.push('Jetson per-model driver — verify')
  }

  // Environment tokens: manufacturing defaults to IP65 unless IP67/69K named.
  if (/ip69k/.test(q)) {
    parsed.environment = 'manufacturing'
    parsed.envRequirement = 'IP69K'
    chips.push('manufacturing (IP69K)')
  } else if (/ip67/.test(q)) {
    parsed.environment = 'manufacturing'
    parsed.envRequirement = 'IP67'
    chips.push('manufacturing (IP67)')
  } else if (/washdown|factory|manufacturing|production|plant|food|pharma|ip65|sealed|rugged|line\b/.test(q)) {
    parsed.environment = 'manufacturing'
    parsed.envRequirement = 'IP65'
    chips.push('manufacturing')
  } else if (/diy|bench|lab|prototype|hobby|maker|classroom|student/.test(q)) {
    parsed.environment = 'diy'
    parsed.envRequirement = 'DIY'
    chips.push('DIY / bench')
  }

  // Use-case token (display only — the shutter rule above does the work).
  const useCase = q.match(/conveyor|microscop\w*|tray inspection|barcode|dimensioning|pcb|screw inspection|cell imaging/)
  if (useCase) parsed.useCase = useCase[0]

  return parsed
}

/** Merge parsed constraints over context defaults into wizard inputs. */
export function buildWizardInputs(parsed: ParsedQuery, ctx: SuggestionContext): WizardInputs {
  return {
    targetFovHmm: parsed.targetFovHmm ?? ctx.defaultFovHmm ?? 300,
    targetFovVmm: parsed.targetFovVmm ?? ctx.defaultFovVmm ?? 225,
    workingDistanceMm: parsed.workingDistanceMm ?? ctx.defaultWorkingDistanceMm ?? 500,
    featureSizeMm: parsed.featureSizeMm,
    requiredInterface: parsed.requiredInterface ?? 'any',
    requiredShutter: parsed.requiredShutter ?? 'any',
  }
}

const FAMILY_KEYWORDS: Array<[RegExp, CameraFamilyId]> = [
  [/basler/, 'basler-ace'],
  [/blackfly|flir|teledyne/, 'flir-blackfly'],
  [/\bids\b|ueye/, 'ids-ueye'],
  [/lucid|triton|atlas/, 'lucid-triton-atlas'],
  [/\bjai\b|go-x|apex/, 'jai-go'],
  [/dahua|hikrobot|hikvision|\bhik\b/, 'dahua-hikrobot'],
  [/arducam/, 'arducam'],
  [/raspberry|\brpi\b|hq camera|global shutter camera/, 'rpi-hq-gs'],
]

/** Resolve a sensor to its database camera family (explicit map, else name). */
export function familyForSensor(sensor: Pick<Sensor, 'id' | 'name'>, ctx?: Pick<SuggestionContext, 'sensorFamily'>): CameraFamilyId | undefined {
  const explicit = ctx?.sensorFamily?.[sensor.id]
  if (explicit) return explicit
  const hay = `${sensor.id} ${sensor.name}`.toLowerCase()
  return FAMILY_KEYWORDS.find(([re]) => re.test(hay))?.[1]
}

/** Geometry + datasheet sourcing is citable when both sides have a source. */
function geometryEvidence(sensor: Sensor, lens: Lens): EvidenceTag {
  const url = sensor.sourceUrl ?? lens.sourceUrl
  if (sensor.sourceUrl && lens.sourceUrl) {
    return {
      claim: 'FOV, coverage and mount computed from datasheet geometry (optics.ts via fae.ts).',
      status: 'VERIFIED',
      url: sensor.sourceUrl,
    }
  }
  return {
    claim: 'FOV/coverage computed from manually entered or single-source geometry — verify dimensions against the datasheet before committing.',
    status: 'NEEDS-VERIFY',
    url,
  }
}

/**
 * Rank camera+lens suggestions for a natural-language question.
 * Scoring delegates to `rankPairings()`; this layer adds software-compat
 * gating (database/software.ts), environment checks (database/rules.ts
 * environmentRating), small environment score deltas (±5, always with an
 * explicit reason), and VERIFIED / NEEDS-VERIFY evidence per suggestion.
 */
export function suggest(question: string, ctx: SuggestionContext): Suggestion[] {
  const parsed = parseAdviceQuery(question)
  const inputs = buildWizardInputs(parsed, ctx)
  const environment: Environment = parsed.environment ?? ctx.environment ?? 'diy'
  const envRequirement: EnvRequirement = parsed.envRequirement ?? (environment === 'manufacturing' ? 'IP65' : 'DIY')

  const { ranked, excluded } = rankPairings(ctx.sensors, ctx.lenses, inputs)
  const sensorById = new Map(ctx.sensors.map((s) => [s.id, s]))
  const lensById = new Map(ctx.lenses.map((l) => [l.id, l]))

  const needInterface = inputs.requiredInterface && inputs.requiredInterface !== 'any' ? inputs.requiredInterface : null
  const needShutter = inputs.requiredShutter && inputs.requiredShutter !== 'any' ? inputs.requiredShutter : null

  const buildChecks = (
    sensor: Sensor,
    lens: Lens,
    family: CameraFamilyId | undefined,
  ): { evidence: EvidenceTag[]; failedChecks: FailedCheck[]; envDelta: number; envReasons: string[] } => {
    const evidence: EvidenceTag[] = [geometryEvidence(sensor, lens)]
    const failedChecks: FailedCheck[] = []
    const envReasons: string[] = []
    let envDelta = 0

    // Coverage (rules.ts semantics: margin >= 0 passes; tight still passes).
    const diagonal = sensorDiagonalMm(sensor)
    const coverage = coverageCheck(lens.imageCircleMm, diagonal)
    failedChecks.push({ check: 'coverage', pass: coverage.pass, message: coverage.message })

    // Interface: required vs actual; unknown stays pass with a flag.
    if (!needInterface) {
      failedChecks.push({ check: 'interface', pass: true, message: 'No interface requirement for this task.' })
    } else if (!sensor.cameraInterface) {
      failedChecks.push({
        check: 'interface',
        pass: true,
        message: `Interface not specified — verify it offers ${needInterface} before committing.`,
      })
      evidence.push({
        claim: `Interface unverified: confirm this camera offers ${needInterface} in its datasheet.`,
        status: 'NEEDS-VERIFY',
        url: sensor.sourceUrl,
      })
    } else {
      const pass = sensor.cameraInterface === needInterface
      failedChecks.push({
        check: 'interface',
        pass,
        message: pass
          ? `PASS: camera offers required ${needInterface}.`
          : `FAIL: camera is ${sensor.cameraInterface}, task requires ${needInterface}.`,
      })
    }

    // Shutter: same flag-don't-guess treatment.
    if (needShutter && !sensor.shutter) {
      evidence.push({
        claim: `Shutter type unverified: confirm ${needShutter} shutter for this motion case.`,
        status: 'NEEDS-VERIFY',
        url: sensor.sourceUrl,
      })
    }

    // Cable length against passive limits (only when the run is known).
    if (ctx.cableLengthM !== undefined && sensor.cameraInterface) {
      const cable = interfaceCheck(sensor.cameraInterface, ctx.cableLengthM)
      failedChecks.push({
        check: 'cable',
        pass: cable.pass,
        message: cable.message,
        // interfaceCheck message already reads PASS:/FAIL:.
      } as FailedCheck)
    }

    // Software compat gating per family.
    if (parsed.software && family) {
      const entry = lookupCompat(family, parsed.software)
      if (!entry || entry.status === 'NOT-SUPPORTED') {
        failedChecks.push({
          check: 'software',
          pass: false,
          message: `FAIL: ${getCameraFamily(family)?.displayName ?? family} has no ${parsed.software} support — pick a supported family.`,
        })
      } else {
        failedChecks.push({
          check: 'software',
          pass: true,
          message: entry.status === 'VERIFIED'
            ? `PASS: ${parsed.software} support confirmed (${entry.note})`
            : `PASS (unverified): ${entry.note} — confirm before committing.`,
        })
        evidence.push({
          claim: entry.status === 'VERIFIED'
            ? `${parsed.software} support confirmed by vendor docs.`
            : `${parsed.software} support is plausible but unconfirmed — verify against vendor docs.`,
          status: entry.status,
          url: entry.sourceUrl,
        })
      }
    } else if (parsed.software && !family) {
      evidence.push({
        claim: 'No camera-family mapping for this sensor — verify software support against the datasheet before committing.',
        status: 'NEEDS-VERIFY',
        url: sensor.sourceUrl,
      })
    }
    if (parsed.jetsonCsi) {
      evidence.push({
        claim: 'Jetson CSI support is per-model (sensor driver + L4T version) — verify the exact SKU bundle.',
        status: 'NEEDS-VERIFY',
        url: family ? getCameraFamily(family)?.sdk.url : sensor.sourceUrl,
      })
    }

    // Environment modifier: small deltas, always with an explicit reason.
    if (family) {
      const env = environmentRating(family, envRequirement, false)
      failedChecks.push({
        check: 'environment',
        pass: env.verdict !== 'NOT-SUITABLE',
        message: env.verdict === 'OK'
          ? `PASS: ${env.message}`
          : `FAIL: ${env.message}`,
      })
      if (environment === 'manufacturing') {
        if (sensor.cameraInterface === 'GigE' || sensor.cameraInterface === 'CoaXPress' || sensor.cameraInterface === 'CameraLink') {
          envDelta += 5
          envReasons.push('+manufacturing: locking industrial connector, plant-network friendly.')
        }
        if (sensor.cameraInterface === 'USB3' || sensor.cameraInterface === 'MIPI') {
          envDelta -= 5
          envReasons.push('−manufacturing: non-locking connector — verify retention/strain relief for the line.')
        }
        if (env.verdict === 'NEEDS-SEALED-VARIANT') {
          envDelta -= 5
          envReasons.push(`−manufacturing: base model unsealed — order the sealed variant for ${envRequirement}.`)
        }
        if (env.verdict === 'NOT-SUITABLE') {
          envDelta -= 15
          envReasons.push(`−manufacturing: DIY-grade family cannot meet ${envRequirement}; choose a sealed industrial family.`)
        }
      } else {
        failedChecks.find((c) => c.check === 'environment')!.message = `PASS: ${env.message}`
        failedChecks.find((c) => c.check === 'environment')!.pass = true
        if (sensor.cameraInterface === 'USB3' || sensor.cameraInterface === 'MIPI') {
          envDelta += 5
          envReasons.push('+diy: USB3/MIPI simplicity — no frame grabber, bench-friendly.')
        } else {
          envReasons.push('DIY/bench use — no enclosure rating strictly required.')
        }
      }
    } else {
      evidence.push({
        claim: 'No camera-family mapping for this sensor — enclosure/IP suitability must be checked by hand.',
        status: 'NEEDS-VERIFY',
        url: sensor.sourceUrl,
      })
      if (environment === 'diy') envReasons.push('DIY/bench use — no enclosure rating strictly required.')
    }

    // Resolving-power unknown: extra pixels may not add detail.
    if (!lens.resolvingPowerLpMm) {
      evidence.push({
        claim: 'Lens resolving power not in the database — system resolution limit (lens vs sensor) is unverified.',
        status: 'NEEDS-VERIFY',
        url: lens.sourceUrl,
      })
    }

    return { evidence, failedChecks, envDelta, envReasons }
  }

  const kept: Suggestion[] = []
  const rejected: Suggestion[] = []

  for (const p of ranked) {
    const sensor = sensorById.get(p.sensorId)
    const lens = lensById.get(p.lensId)
    if (!sensor || !lens) continue
    const family = familyForSensor(sensor, ctx)
    const { evidence, failedChecks, envDelta, envReasons } = buildChecks(sensor, lens, family)

    // Rank/score bookkeeping before env deltas (reasons stay chronological).
    const reasons = [...p.reasons, ...envReasons]
    let delta = envDelta
    // Unverified software support ranks below confirmed support.
    if (parsed.software && family) {
      const entry = lookupCompat(family, parsed.software)
      if (entry && entry.status === 'NEEDS-VERIFY') {
        delta -= 5
        reasons.push(`Software support for ${parsed.software} is unverified for this family — confirm before committing.`)
      }
    }
    const score = Math.max(0, Math.min(100, Math.round(p.score + delta)))
    const verdict: PairingVerdict = score >= 80 ? 'fit' : score >= 50 ? 'marginal' : 'no-fit'

    // Lens-limited verdicts already carry their reason from rankPairings;
    // add a VERIFIED citation when both datasheets are present.
    if (p.limitingFactor !== 'unknown' && sensor.sourceUrl && lens.sourceUrl) {
      evidence.push({
        claim: `Limiting-factor analysis (${p.limitingFactor}-limited) from rated resolving power vs sensor Nyquist.`,
        status: 'VERIFIED',
        url: lens.sourceUrl,
      })
    }

    const suggestion: Suggestion = {
      rank: 0,
      cameraId: p.sensorId,
      lensId: p.lensId,
      cameraName: p.sensorName,
      lensName: p.lensName,
      score,
      verdict,
      fovHmm: p.fovHmm,
      fovVmm: p.fovVmm,
      mmPerPixelH: p.mmPerPixelH,
      coverage: p.coverage,
      mountCompatible: p.mountCompatible,
      reasons,
      evidence,
      failedChecks,
    }

    // NOT-SUPPORTED software: keep the card (surfaced, not silent) but sink it.
    const softwareCheck = failedChecks.find((c) => c.check === 'software')
    if (softwareCheck && !softwareCheck.pass) {
      suggestion.score = 0
      suggestion.verdict = 'no-fit'
      rejected.push(suggestion)
    } else {
      kept.push(suggestion)
    }
  }

  // rankPairings exclusions (interface/shutter hard mismatches) surface as
  // trailing no-fit cards so the UI can say *why* nothing fit.
  for (const e of excluded) {
    const sensor = sensorById.get(e.sensorId)
    const lens = lensById.get(e.lensId)
    const check: FailedCheck['check'] = /interface/i.test(e.reason) ? 'interface' : 'shutter'
    rejected.push({
      rank: 0,
      cameraId: e.sensorId,
      lensId: e.lensId,
      cameraName: e.sensorName,
      lensName: e.lensName,
      score: 0,
      verdict: 'no-fit',
      fovHmm: null,
      fovVmm: null,
      mmPerPixelH: null,
      coverage: sensor && lens ? coverageCheck(lens.imageCircleMm, sensorDiagonalMm(sensor)).pass ? 'ok' : 'vignetting' : 'vignetting',
      mountCompatible: sensor && lens
        ? sensor.mount === lens.mount || (lens.mount === 'C' && sensor.mount === 'CS')
        : false,
      reasons: [e.reason],
      evidence: [{
        claim: `Excluded by requirement filter: ${e.reason}`,
        status: sensor?.sourceUrl ? 'VERIFIED' : 'NEEDS-VERIFY',
        url: sensor?.sourceUrl,
      }],
      failedChecks: [{ check, pass: false, message: `FAIL: ${e.reason}` }],
    })
  }

  kept.sort((a, b) => b.score - a.score || a.cameraName.localeCompare(b.cameraName));
  [...kept, ...rejected].forEach((s, i) => {
    s.rank = i + 1
  })
  return [...kept, ...rejected]
}
