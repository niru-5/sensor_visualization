import type { MountType } from '../lib/types'

export interface SensorDraft {
  name: string
  opticalFormat: string
  widthMm: string
  heightMm: string
  resolutionH: string
  resolutionV: string
  pixelPitchUm: string
  mount: MountType
  /** Camera interface family, or '' when not specified. */
  cameraInterface: string
  /** Shutter type, or '' when not specified. */
  shutter: string
}

export const BLANK_SENSOR_DRAFT: SensorDraft = {
  name: '',
  opticalFormat: '',
  widthMm: '',
  heightMm: '',
  resolutionH: '',
  resolutionV: '',
  pixelPitchUm: '',
  mount: 'C',
  cameraInterface: '',
  shutter: '',
}

export interface LensDraft {
  name: string
  focalLengthMm: string
  mount: MountType
  imageCircleMm: string
  maxAperture: string
  resolvingPowerLpMm: string
}

export const BLANK_LENS_DRAFT: LensDraft = {
  name: '',
  focalLengthMm: '',
  mount: 'C',
  imageCircleMm: '',
  maxAperture: '',
  resolvingPowerLpMm: '',
}
