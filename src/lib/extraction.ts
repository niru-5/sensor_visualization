import type { ExtractedField, MountType } from './types.js'

export type ExtractKind = 'sensor' | 'lens'

export interface ExtractRequest {
  url: string
  kind: ExtractKind
}

export interface SensorExtractedFields {
  name: ExtractedField<string>
  opticalFormat: ExtractedField<string>
  widthMm: ExtractedField<number>
  heightMm: ExtractedField<number>
  resolutionH: ExtractedField<number>
  resolutionV: ExtractedField<number>
  pixelPitchUm: ExtractedField<number>
  mount: ExtractedField<MountType>
  cameraInterface: ExtractedField<string>
  shutter: ExtractedField<string>
  fps: ExtractedField<number>
  trigger: ExtractedField<string>
}

export interface LensExtractedFields {
  name: ExtractedField<string>
  focalLengthMm: ExtractedField<number>
  mount: ExtractedField<MountType>
  imageCircleMm: ExtractedField<number>
  maxAperture: ExtractedField<number>
  resolvingPowerLpMm: ExtractedField<number>
  modMm: ExtractedField<number>
  distortionPct: ExtractedField<number>
  weightG: ExtractedField<number>
  driverNote: ExtractedField<string>
}

export type ExtractResponse =
  | { kind: 'sensor'; fields: SensorExtractedFields }
  | { kind: 'lens'; fields: LensExtractedFields }
  | { error: string }

export const SENSOR_FIELD_KEYS: (keyof SensorExtractedFields)[] = [
  'name',
  'opticalFormat',
  'widthMm',
  'heightMm',
  'resolutionH',
  'resolutionV',
  'pixelPitchUm',
  'mount',
  'cameraInterface',
  'shutter',
  'fps',
  'trigger',
]

export const LENS_FIELD_KEYS: (keyof LensExtractedFields)[] = [
  'name',
  'focalLengthMm',
  'mount',
  'imageCircleMm',
  'maxAperture',
  'resolvingPowerLpMm',
  'modMm',
  'distortionPct',
  'weightG',
  'driverNote',
]
