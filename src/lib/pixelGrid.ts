import { mmPerPixel } from './optics'
import { SLOT_COLORS, slotColor } from './cameraPalette'

/**
 * Pure pixel-grid (GSD overlay) helpers for Track C.
 *
 * Given a footprint (FOV H×V in mm) and sensor resolution, computes a
 * capped grid subdivision so rendering stays bounded (a 12 MP sensor would
 * otherwise produce millions of lines). No THREE imports — UI-free.
 */

/**
 * Shared per-camera palette — canonical definition lives in
 * `cameraPalette.ts` (`SLOT_COLORS`); re-exported here so existing
 * imports keep working. Do NOT extend this copy; import the canonical one.
 */
export const CAMERA_PALETTE: readonly string[] = SLOT_COLORS

/** Camera slot color, cycling for N > 3 (delegates to canonical `slotColor`). */
export function cameraColorForIndex(index: number): string {
  return slotColor(index)
}

/** Default cap on rendered cells per axis. */
export const MAX_GRID_CELLS = 40

export interface PixelGridInput {
  fovHmm: number
  fovVmm: number
  resolutionH: number
  resolutionV: number
  workingDistanceMm: number
  /** Focal length, when known — WD <= f means no real image forms (invalid). */
  focalLengthMm?: number
  /** Max rendered cells per axis (default 40). */
  maxCells?: number
}

export interface PixelGridSpec {
  valid: boolean
  reason?: string
  /** Rendered columns/rows after stride-capping (<= maxCells). */
  gridCols: number
  gridRows: number
  /** Decimation stride applied per axis (>= 1). */
  strideH: number
  strideV: number
  /** Ground size of one rendered cell, mm. */
  cellSizeMmH: number
  cellSizeMmV: number
  /** Horizontal GSD (true mm/px before capping). */
  gsdH: number
  /** Vertical GSD (true mm/px before capping). */
  gsdV: number
  /** Badge label, e.g. '1 px = 2.10 mm'. */
  label: string
  /** Emphasis interval for scanline/GSD contours. */
  contourEvery: number
}

/** Format a GSD value for badge labels (2 decimals, handles sub-0.01). */
export function formatGsdLabel(gsdMmPerPx: number): string {
  if (!Number.isFinite(gsdMmPerPx) || gsdMmPerPx <= 0) return '1 px = —'
  if (gsdMmPerPx < 0.01) return `1 px = ${gsdMmPerPx.toFixed(4)} mm`
  return `1 px = ${gsdMmPerPx.toFixed(2)} mm`
}

/**
 * Emphasis interval for GSD contour lines: every-Nth rendered line drawn
 * brighter so density reads at a glance even when decimated.
 */
export function defaultContourEvery(cells: number): number {
  if (!Number.isFinite(cells) || cells <= 0) return 1
  if (cells >= 20) return 10
  if (cells >= 10) return 5
  return 1
}

function invalid(reason: string): PixelGridSpec {
  return {
    valid: false,
    reason,
    gridCols: 0,
    gridRows: 0,
    strideH: 1,
    strideV: 1,
    cellSizeMmH: 0,
    cellSizeMmV: 0,
    gsdH: 0,
    gsdV: 0,
    label: '1 px = —',
    contourEvery: 1,
  }
}

export function computePixelGrid(input: PixelGridInput): PixelGridSpec {
  const { fovHmm, fovVmm, resolutionH, resolutionV, workingDistanceMm, focalLengthMm } = input
  const maxCells = Math.max(1, Math.floor(input.maxCells ?? MAX_GRID_CELLS))

  if (!Number.isFinite(workingDistanceMm) || workingDistanceMm <= 0) {
    return invalid('Working distance must be positive.')
  }
  if (focalLengthMm !== undefined && workingDistanceMm <= focalLengthMm) {
    return invalid('Working distance must be greater than the focal length — no real image forms at or below the focal length.')
  }
  if (!Number.isFinite(fovHmm) || !Number.isFinite(fovVmm) || fovHmm <= 0 || fovVmm <= 0) {
    return invalid('FOV dimensions must be positive.')
  }
  if (!Number.isFinite(resolutionH) || !Number.isFinite(resolutionV) || resolutionH <= 0 || resolutionV <= 0) {
    return invalid('Resolution must be positive.')
  }

  const resH = Math.floor(resolutionH)
  const resV = Math.floor(resolutionV)
  if (resH < 1 || resV < 1) return invalid('Resolution must be positive.')

  const gsdH = mmPerPixel(fovHmm, resH)
  const gsdV = mmPerPixel(fovVmm, resV)

  const strideH = Math.max(1, Math.ceil(resH / maxCells))
  const strideV = Math.max(1, Math.ceil(resV / maxCells))
  const gridCols = Math.ceil(resH / strideH)
  const gridRows = Math.ceil(resV / strideV)
  const cellSizeMmH = gsdH * strideH
  const cellSizeMmV = gsdV * strideV

  const nonSquare = Math.abs(gsdH - gsdV) / Math.max(gsdH, 1e-12) > 0.01
  const label = nonSquare
    ? `1 px = ${gsdH.toFixed(2)}×${gsdV.toFixed(2)} mm`
    : formatGsdLabel(gsdH)

  return {
    valid: true,
    gridCols,
    gridRows,
    strideH,
    strideV,
    cellSizeMmH,
    cellSizeMmV,
    gsdH,
    gsdV,
    label,
    contourEvery: defaultContourEvery(Math.max(gridCols, gridRows)),
  }
}
