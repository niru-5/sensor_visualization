import {
  checkImageCircle,
  checkMountCompatibility,
  computeFov,
  mmPerPixel,
} from './optics'
import type { Lens, Sensor } from './types'

/**
 * Two-camera comparison flow helpers (pure, UI-free).
 *
 * App.tsx renders one panel per CameraSlot. Each panel resolves its
 * sensor/lens (falling back to the first library entry so dropdowns are
 * never empty), derives an *effective* working distance clamped into the
 * slider range for its lens, and shares one world scale across panels so
 * the 3D stages stay a true 1:1 comparison. This module holds that logic
 * so it can be unit-tested without React/three.js.
 */

export const MAX_CAMERAS = 4
export const DEFAULT_WORKING_DISTANCE_MM = 300
export const CAMERAS_STORAGE_KEY = 'camera-selection-tool/cameras-v1'

export interface CameraSlot {
  id: string
  sensorId: string | null
  lensId: string | null
  workingDistanceMm: number
}

export interface ResolvedSlot {
  cam: CameraSlot
  sensor: Sensor | null
  lens: Lens | null
  /** Working distance clamped into this lens's slider range (what the stage shows). */
  effectiveWd: number
}

export interface SliderBounds {
  min: number
  max: number
}

export interface TableRow {
  lensId: string
  lensName: string
  fovHmm: number | null
  fovVmm: number | null
  mmPerPixelH: number | null
  coverage: 'ok' | 'tight' | 'vignetting'
  mountCompatible: boolean
  requiresSpacer: boolean
  risk: string
  valid: boolean
}

let slotCounter = 0

/** Create one comparison slot. IDs are unique within this module session. */
export function createSlot(
  sensorId: string | null,
  lensId: string | null,
  workingDistanceMm: number = DEFAULT_WORKING_DISTANCE_MM,
): CameraSlot {
  slotCounter += 1
  const wd = Number.isFinite(workingDistanceMm) && workingDistanceMm > 0
    ? workingDistanceMm
    : DEFAULT_WORKING_DISTANCE_MM
  return { id: `cam-${Date.now().toString(36)}-${slotCounter}`, sensorId, lensId, workingDistanceMm: wd }
}

/** Slider range for a lens. Mirrors the bounds used by the App panel slider. */
export function getSliderBounds(focalLengthMm: number | null | undefined): SliderBounds {
  if (focalLengthMm === null || focalLengthMm === undefined || !Number.isFinite(focalLengthMm) || focalLengthMm <= 0) {
    return { min: 1, max: 2000 }
  }
  const min = Math.ceil(focalLengthMm) + 1
  const max = Math.max(min + 100, 2000)
  return { min, max }
}

/** Clamp a working distance into a lens's slider range. */
export function clampWorkingDistance(workingDistanceMm: number, focalLengthMm: number | null | undefined): number {
  const { min, max } = getSliderBounds(focalLengthMm)
  if (!Number.isFinite(workingDistanceMm)) return Math.min(Math.max(DEFAULT_WORKING_DISTANCE_MM, min), max)
  return Math.min(Math.max(workingDistanceMm, min), max)
}

/** The WD the stage actually renders for this camera (stored WD clamped to its lens). */
export function effectiveWorkingDistance(cam: CameraSlot, lens: Lens | null): number {
  return clampWorkingDistance(cam.workingDistanceMm, lens?.focalLengthMm ?? null)
}

/** Append a camera seeded from the last slot ("tweak one thing" comparison). No-op at MAX_CAMERAS. */
export function addCameraSlot(slots: CameraSlot[]): CameraSlot[] {
  if (slots.length >= MAX_CAMERAS) return slots
  const last = slots[slots.length - 1]
  const slot = createSlot(last?.sensorId ?? null, last?.lensId ?? null, last?.workingDistanceMm ?? DEFAULT_WORKING_DISTANCE_MM)
  return [...slots, slot]
}

/** Remove one camera. Refuses to drop below a single panel. Unknown ids return the input unchanged. */
export function removeCameraSlot(slots: CameraSlot[], id: string): CameraSlot[] {
  if (slots.length <= 1) return slots
  const next = slots.filter((c) => c.id !== id)
  return next.length === slots.length ? slots : next
}

/**
 * Patch one camera. When the lens changes (or WD is set directly) the stored
 * WD is re-clamped into the resulting lens's valid range so state can never
 * desync from what the slider/stage shows (previously the slider displayed a
 * clamped value while state kept the out-of-range WD, rendering "invalid"
 * FOV under a valid-looking slider position).
 */
export function updateCameraSlot(
  slots: CameraSlot[],
  id: string,
  patch: Partial<CameraSlot>,
  lenses?: Lens[],
): CameraSlot[] {
  return slots.map((c) => {
    if (c.id !== id) return c
    const merged: CameraSlot = { ...c, ...patch, id: c.id }
    if (lenses && (patch.lensId !== undefined || patch.workingDistanceMm !== undefined)) {
      const lens = lenses.find((l) => l.id === merged.lensId) ?? null
      merged.workingDistanceMm = clampWorkingDistance(merged.workingDistanceMm, lens?.focalLengthMm ?? null)
    }
    return merged
  })
}

/** Resolve each slot to its sensor/lens with first-available fallback + clamped WD. */
export function resolveSlots(cameras: CameraSlot[], sensors: Sensor[], lenses: Lens[]): ResolvedSlot[] {
  return cameras.map((cam) => {
    const sensor = sensors.find((s) => s.id === cam.sensorId) ?? sensors[0] ?? null
    const lens = lenses.find((l) => l.id === cam.lensId) ?? lenses[0] ?? null
    return { cam, sensor, lens, effectiveWd: effectiveWorkingDistance(cam, lens) }
  })
}

/** Shared world scale: max effective WD across resolvable panels, else the default. */
export function sharedScaleMm(resolved: ResolvedSlot[]): number {
  const distances = resolved.filter((r) => r.sensor && r.lens).map((r) => r.effectiveWd)
  return distances.length > 0 ? Math.max(...distances) : DEFAULT_WORKING_DISTANCE_MM
}

/** De-duplicated sensors across panels (feeds the to-scale overlay). */
export function sensorsInPlay(resolved: ResolvedSlot[]): Sensor[] {
  const seen = new Map<string, Sensor>()
  for (const r of resolved) if (r.sensor) seen.set(r.sensor.id, r.sensor)
  return [...seen.values()]
}

/** De-duplicated lenses across panels (feeds the comparison table). */
export function lensesInPlay(resolved: ResolvedSlot[]): Lens[] {
  const seen = new Map<string, Lens>()
  for (const r of resolved) if (r.lens) seen.set(r.lens.id, r.lens)
  return [...seen.values()]
}

/** Panel grid/height classes for 1 vs tiled layouts. */
export function panelLayout(count: number): { gridColsClass: string; panelHeight: string } {
  if (count <= 1) return { gridColsClass: 'grid-cols-1', panelHeight: 'h-[480px]' }
  return { gridColsClass: 'grid-cols-1 md:grid-cols-2', panelHeight: 'h-[340px]' }
}

/** One comparison-table row: first camera's sensor vs one lens at camera-1's effective WD. */
export function buildTableRow(sensor: Sensor, lens: Lens, workingDistanceMm: number): TableRow {
  const fov = computeFov(sensor, lens.focalLengthMm, workingDistanceMm)
  const circle = checkImageCircle(lens, sensor)
  const mount = checkMountCompatibility(lens.mount, sensor.mount)
  const valid = fov.horizontal.fovMm !== null && fov.vertical.fovMm !== null
  return {
    lensId: lens.id,
    lensName: lens.name,
    fovHmm: fov.horizontal.fovMm,
    fovVmm: fov.vertical.fovMm,
    mmPerPixelH: fov.horizontal.fovMm !== null ? mmPerPixel(fov.horizontal.fovMm, sensor.resolutionH) : null,
    coverage: circle.status,
    mountCompatible: mount.compatible,
    requiresSpacer: mount.requiresSpacer,
    risk: fov.horizontal.risk,
    valid,
  }
}

/** Overlay label rendered on each 3D stage (mirrors FovCone3D's Html badge). */
export function overlayLabel(sensor: Sensor, lens: Lens, workingDistanceMm: number): string {
  const fov = computeFov(sensor, lens.focalLengthMm, workingDistanceMm)
  if (fov.horizontal.fovMm === null || fov.vertical.fovMm === null) {
    return fov.horizontal.message ?? 'Invalid geometry for this working distance.'
  }
  return `FOV ${fov.horizontal.fovMm.toFixed(0)} x ${fov.vertical.fovMm.toFixed(0)}mm @ ${workingDistanceMm}mm`
}

export interface TwoCameraView {
  resolved: ResolvedSlot[]
  sharedScale: number
  playSensors: Sensor[]
  playLenses: Sensor[] | Lens[]
  tableRows: TableRow[]
  overlays: string[]
  tableWd: number
}

/**
 * Full derived view for the comparison flow: per-panel resolution, shared
 * scale, overlay labels, and the comparison table. A WD change on any panel
 * flows into its FOV readout (via resolved[].effectiveWd), its overlay
 * label, the shared scale, and — for camera 1 — the table rows, which is
 * what the integration test pins down.
 */
export function computeTwoCameraView(sensors: Sensor[], lenses: Lens[], cameras: CameraSlot[]): TwoCameraView {
  const resolved = resolveSlots(cameras, sensors, lenses)
  const sharedScale = sharedScaleMm(resolved)
  const playSensors = sensorsInPlay(resolved)
  const playLenses = lensesInPlay(resolved)
  const first = resolved[0]
  const tableWd = first ? first.effectiveWd : DEFAULT_WORKING_DISTANCE_MM
  const tableRows = first?.sensor ? playLenses.map((l) => buildTableRow(first.sensor as Sensor, l, tableWd)) : []
  const overlays = resolved.map((r) =>
    r.sensor && r.lens ? overlayLabel(r.sensor, r.lens, r.effectiveWd) : 'Add a sensor and a lens to view this camera.',
  )
  return { resolved, sharedScale, playSensors, playLenses, tableRows, overlays, tableWd }
}

// --- Camera-slot persistence (separate key so the sensor/lens schema is untouched) ---

function storageAvailable(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false
    const k = '__storage_test__'
    window.localStorage.setItem(k, '1')
    window.localStorage.removeItem(k)
    return true
  } catch {
    return false
  }
}

function sanitizeSlot(raw: unknown): CameraSlot | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (typeof r['id'] !== 'string' || r['id'].length === 0) return null
  const sensorId = r['sensorId']
  const lensId = r['lensId']
  const wd = r['workingDistanceMm']
  return {
    id: r['id'] as string,
    sensorId: typeof sensorId === 'string' ? sensorId : null,
    lensId: typeof lensId === 'string' ? lensId : null,
    workingDistanceMm: typeof wd === 'number' && Number.isFinite(wd) && wd > 0 ? wd : DEFAULT_WORKING_DISTANCE_MM,
  }
}

/** Validate + sanitize a raw persisted value. Returns null when nothing usable was stored. */
export function parseCameraSlots(raw: unknown): CameraSlot[] | null {
  if (!Array.isArray(raw)) return null
  const slots = raw.map(sanitizeSlot).filter((s): s is CameraSlot => s !== null)
  if (slots.length === 0 || slots.length > MAX_CAMERAS) return null
  return slots
}

/** Load persisted camera slots, or null when absent/corrupt (caller falls back to a single slot). */
export function loadCameraSlots(): CameraSlot[] | null {
  if (!storageAvailable()) return null
  try {
    const raw = window.localStorage.getItem(CAMERAS_STORAGE_KEY)
    if (!raw) return null
    return parseCameraSlots(JSON.parse(raw))
  } catch {
    return null
  }
}

/** Persist camera slots; silently no-ops outside a browser. */
export function saveCameraSlots(slots: CameraSlot[]): void {
  if (!storageAvailable()) return
  try {
    window.localStorage.setItem(CAMERAS_STORAGE_KEY, JSON.stringify(slots))
  } catch {
    // Quota/private-mode failures must never break the comparison UI.
  }
}
