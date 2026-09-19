/**
 * 3D stage auto-fit helpers (pure, UI-free).
 *
 * The comparison stages previously parked the camera at a shared-scale
 * position (`scale * (0.55, 0.38, 0.85)` with a 50° FOV). For wide lenses
 * the FOV footprint dwarfs the working distance (e.g. a 6mm lens at 300mm
 * WD throws a ~1800mm-wide footprint), so the camera sat *inside* the
 * frustum volume and the translucent footprint plane covered the whole
 * viewport — a "blank" comparison view. These helpers compute a per-panel
 * fit distance from the panel's own footprint so every lens frames
 * correctly, from macro up to wide-angle.
 */

/** 3/4-view basis direction reused from the stage camera (not normalized). */
export const STAGE_VIEW_DIRECTION: readonly [number, number, number] = [0.55, 0.38, 0.85]

/** Vertical FOV (degrees) of the stage camera — must match the Canvas camera. */
export const STAGE_FOV_DEG = 50

/** Breathing room around the fitted bounding sphere. */
export const FIT_MARGIN = 1.15

const HALF_FOV_TAN = Math.tan(((STAGE_FOV_DEG / 2) * Math.PI) / 180)

/**
 * Bounding-sphere radius (mm) of the frustum volume: footprint half-extents
 * plus half the working distance, centred on the optical axis at z = wd/2.
 * Covers both the apex (camera rig) and every footprint corner.
 */
export function fitBoundingRadius(footprintHalfWidthMm: number, footprintHalfHeightMm: number, workingDistanceMm: number): number {
  const fw = Number.isFinite(footprintHalfWidthMm) ? footprintHalfWidthMm : 0
  const fh = Number.isFinite(footprintHalfHeightMm) ? footprintHalfHeightMm : 0
  const wd = Number.isFinite(workingDistanceMm) && workingDistanceMm > 0 ? workingDistanceMm : 1
  return Math.hypot(fw, fh, wd / 2)
}

/**
 * Camera-to-target distance (mm) that fits the bounding sphere inside the
 * 50° vertical FOV: dist = r / tan(25°) * 1.15. Degenerate/zero footprints
 * (e.g. invalid geometry) fall back to a working-distance-based distance so
 * the camera rig + error badge still frame instead of collapsing to origin.
 */
export function computeFitDistance(
  footprintHalfWidthMm: number,
  footprintHalfHeightMm: number,
  workingDistanceMm: number,
): number {
  const wd = Number.isFinite(workingDistanceMm) && workingDistanceMm > 0 ? workingDistanceMm : 1
  const r = fitBoundingRadius(footprintHalfWidthMm, footprintHalfHeightMm, wd)
  const dist = (r / HALF_FOV_TAN) * FIT_MARGIN
  if (!Number.isFinite(dist) || dist <= 0) return wd * 1.25
  return dist
}

/**
 * Camera position for a fit distance: the existing 3/4-view direction
 * (normalized) anchored at the bounding-sphere centre (0, 0, targetZMm) so
 * the whole frustum — apex through footprint — stays centred in frame.
 */
export function fitCameraPosition(fitDistanceMm: number, targetZMm: number): [number, number, number] {
  const len = Math.hypot(...STAGE_VIEW_DIRECTION)
  const [dx, dy, dz] = STAGE_VIEW_DIRECTION.map((v) => v / len)
  return [dx * fitDistanceMm, dy * fitDistanceMm, targetZMm + dz * fitDistanceMm]
}

export interface StageFit {
  /** Fog starts behind the fitted content so the footprint/rays never wash out. */
  fogNearMm: number
  /** Fog fully covers the grid edge fade. */
  fogFarMm: number
  gridCellMm: number
  gridSectionMm: number
  controlsMaxDistanceMm: number
}

/** Fog / grid / control ranges derived from the fit distance. */
export function computeStageFit(fitDistanceMm: number): StageFit {
  const s = Number.isFinite(fitDistanceMm) && fitDistanceMm > 0 ? fitDistanceMm : 1
  return {
    fogNearMm: s * 1.2,
    fogFarMm: s * 4,
    gridCellMm: s / 30,
    gridSectionMm: s / 6,
    controlsMaxDistanceMm: s * 4,
  }
}
