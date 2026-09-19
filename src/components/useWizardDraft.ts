import { useMemo, useState } from 'react'
import type { WizardInputs } from '../lib/fae'
import type { CameraInterface, ShutterType } from '../lib/types'

function num(raw: string, fallback: number): number {
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

/**
 * Shared wizard draft state, owned by App so both the "Application wizard"
 * tab (inputs + focal-range output) and the "Ranked pairings" tab (ranking
 * table + share card) read the same task description.
 */
export interface WizardDraft {
  targetFovH: string
  setTargetFovH: (v: string) => void
  targetFovV: string
  setTargetFovV: (v: string) => void
  workingDistance: string
  setWorkingDistance: (v: string) => void
  tolerance: string
  setTolerance: (v: string) => void
  featureSize: string
  setFeatureSize: (v: string) => void
  pixelsPerFeature: string
  setPixelsPerFeature: (v: string) => void
  requiredInterface: CameraInterface | 'any'
  setRequiredInterface: (v: CameraInterface | 'any') => void
  requiredShutter: ShutterType | 'any'
  setRequiredShutter: (v: ShutterType | 'any') => void
  /** Numeric inputs derived from the drafts, for fae.ts helpers. */
  inputs: WizardInputs
  /** True when feature-size mode overrides the explicit FOV targets. */
  featureMode: boolean
  /** True when the inputs are sufficient to compute optics. */
  valid: boolean
}

export function useWizardDraft(): WizardDraft {
  const [targetFovH, setTargetFovH] = useState('300')
  const [targetFovV, setTargetFovV] = useState('250')
  const [workingDistance, setWorkingDistance] = useState('500')
  const [tolerance, setTolerance] = useState('10')
  const [featureSize, setFeatureSize] = useState('')
  const [pixelsPerFeature, setPixelsPerFeature] = useState('4')
  const [requiredInterface, setRequiredInterface] = useState<CameraInterface | 'any'>('any')
  const [requiredShutter, setRequiredShutter] = useState<ShutterType | 'any'>('any')

  const inputs: WizardInputs = useMemo(
    () => ({
      targetFovHmm: num(targetFovH, 0),
      targetFovVmm: num(targetFovV, 0),
      workingDistanceMm: num(workingDistance, 0),
      workingDistanceTolerancePct: num(tolerance, 10),
      featureSizeMm: featureSize.trim() ? num(featureSize, 0) : undefined,
      pixelsPerFeature: num(pixelsPerFeature, 4),
      requiredInterface,
      requiredShutter,
    }),
    [targetFovH, targetFovV, workingDistance, tolerance, featureSize, pixelsPerFeature, requiredInterface, requiredShutter],
  )

  const featureMode = (inputs.featureSizeMm ?? 0) > 0
  const valid = inputs.workingDistanceMm > 0 && (featureMode || (inputs.targetFovHmm > 0 && inputs.targetFovVmm > 0))

  return {
    targetFovH,
    setTargetFovH,
    targetFovV,
    setTargetFovV,
    workingDistance,
    setWorkingDistance,
    tolerance,
    setTolerance,
    featureSize,
    setFeatureSize,
    pixelsPerFeature,
    setPixelsPerFeature,
    requiredInterface,
    setRequiredInterface,
    requiredShutter,
    setRequiredShutter,
    inputs,
    featureMode,
    valid,
  }
}
