export type MountType = 'C' | 'CS' | 'S-mount' | 'M12' | 'F' | 'other'

/** Camera-to-host interface family. Optional on a sensor entry — when absent,
 * filters treat the sensor as "unknown, verify against the datasheet". */
export type CameraInterface = 'GigE' | 'USB3' | 'CameraLink' | 'CoaXPress' | 'MIPI' | 'other'

/** Shutter type. Optional for the same reason as above. */
export type ShutterType = 'global' | 'rolling'

export type EntrySource = 'seed' | 'manual' | 'datasheet-import'

export interface Sensor {
  id: string
  name: string
  /** Legacy optical format notation, e.g. "1/1.8\"". Optional — only used
   * to derive width/height when explicit mm dimensions aren't known. */
  opticalFormat?: string
  /** Active area, millimeters. */
  widthMm: number
  heightMm: number
  resolutionH: number
  resolutionV: number
  /** Pixel pitch in micrometers. If omitted, derived from active area / resolution. */
  pixelPitchUm?: number
  mount: MountType
  /** Camera interface family, when known (e.g. from the camera body datasheet). */
  cameraInterface?: CameraInterface
  /** Shutter type, when known. */
  shutter?: ShutterType
  source: EntrySource
  sourceUrl?: string
}

export interface Lens {
  id: string
  name: string
  /** Fixed focal length, or the wide end of a zoom (mm). */
  focalLengthMm: number
  /** Present only for zoom lenses. */
  focalLengthMaxMm?: number
  mount: MountType
  imageCircleMm: number
  maxAperture?: number
  /** Rated resolving power, line pairs/mm, if the datasheet gives one. */
  resolvingPowerLpMm?: number
  source: EntrySource
  sourceUrl?: string
}

export interface ExtractedField<T> {
  value: T | null
  found: boolean
  /** Short snippet of source text the value was pulled from, if available. */
  snippet?: string
}
