/**
 * Pure frustum-geometry helpers for Track B (FOV shading + footprint).
 *
 * UI-free (plain tuples, no three.js) so these run under node (vitest).
 * The scene components in `src/components/FovShading.tsx` are thin
 * renderers over these. Convention: frustum apex at the origin, optical
 * axis +Z, footprint plane at z = working distance (matches `FovCone3D`).
 */
import { computeFov } from './optics';
import type { Sensor } from './types';

/** Plain [x, y, z] point in stage units (mm). */
export type Vec3 = [number, number, number];

export interface FrustumCorners {
  /** Footprint corners at z = WD: (+,+), (-,+), (-,-), (+,-). */
  corners: [Vec3, Vec3, Vec3, Vec3];
  fovHmm: number;
  fovVmm: number;
  workingDistanceMm: number;
}

type SensorDims = Pick<Sensor, 'widthMm' | 'heightMm'>;

function validDims(sensor: SensorDims, focalLengthMm: number, workingDistanceMm: number): boolean {
  return (
    Number.isFinite(sensor.widthMm) &&
    Number.isFinite(sensor.heightMm) &&
    sensor.widthMm > 0 &&
    sensor.heightMm > 0 &&
    Number.isFinite(focalLengthMm) &&
    focalLengthMm > 0 &&
    Number.isFinite(workingDistanceMm) &&
    workingDistanceMm > 0
  );
}

/**
 * Footprint corners of the FOV frustum at the working-distance plane.
 * Returns `null` for invalid geometry (WD <= f, non-positive inputs) —
 * callers render an error badge instead of geometry.
 */
export function frustumCornersAtWd(
  sensor: SensorDims,
  focalLengthMm: number,
  workingDistanceMm: number,
): FrustumCorners | null {
  if (!validDims(sensor, focalLengthMm, workingDistanceMm)) return null;
  const fov = computeFov(sensor, focalLengthMm, workingDistanceMm);
  const fovH = fov.horizontal.fovMm;
  const fovV = fov.vertical.fovMm;
  if (fovH == null || fovV == null) return null;
  const hw = fovH / 2;
  const hh = fovV / 2;
  const wd = workingDistanceMm;
  return {
    corners: [
      [hw, hh, wd],
      [-hw, hh, wd],
      [-hw, -hh, wd],
      [hw, -hh, wd],
    ],
    fovHmm: fovH,
    fovVmm: fovV,
    workingDistanceMm: wd,
  };
}

/** Circumscribed-circle radius of an fovH x fovV footprint (half diagonal). */
export function footprintRingRadiusMm(fovHmm: number, fovVmm: number): number {
  if (!Number.isFinite(fovHmm) || !Number.isFinite(fovVmm) || fovHmm <= 0 || fovVmm <= 0) return 0;
  return Math.hypot(fovHmm, fovVmm) / 2;
}

/**
 * Closed-loop circle points (segments + 1 entries, last == first) in the
 * z = WD plane, centred on the optical axis. Returns `[]` for invalid input.
 */
export function rangeRingPoints(radiusMm: number, workingDistanceMm: number, segments = 64): Vec3[] {
  const segs = Math.floor(segments);
  if (!Number.isFinite(radiusMm) || radiusMm <= 0 || !Number.isFinite(workingDistanceMm) || segs < 3) {
    return [];
  }
  const pts: Vec3[] = [];
  for (let i = 0; i <= segs; i++) {
    const theta = (i / segs) * Math.PI * 2;
    pts.push([radiusMm * Math.cos(theta), radiusMm * Math.sin(theta), workingDistanceMm]);
  }
  return pts;
}

export interface GroundYInputs {
  /** Footprint half-height (mm): lowest point of the footprint bottom edge is -fh. */
  footprintHalfHeightMm: number;
  /** Lowest point of the camera rig body below the axis (mm, positive). */
  cameraBottomMm: number;
  /** Sensor diagonal (mm), for the margin term. */
  diagonalMm: number;
  /** Shared scene scale (mm), for the margin term. */
  sceneScaleMm: number;
}

/**
 * Floor height ported from the `groundY` logic in `FovCone3D.tsx`: park the
 * floor below the lowest point of the rig (footprint bottom edge vs.
 * camera-body bottom, whichever is lower) plus a margin that scales with
 * scene size. Falls back to a small negative offset for invalid input.
 */
export function computeGroundY({ footprintHalfHeightMm, cameraBottomMm, diagonalMm, sceneScaleMm }: GroundYInputs): number {
  const fh = Number.isFinite(footprintHalfHeightMm) && footprintHalfHeightMm > 0 ? footprintHalfHeightMm : 0;
  const cam = Number.isFinite(cameraBottomMm) && cameraBottomMm > 0 ? cameraBottomMm : 0;
  const diag = Number.isFinite(diagonalMm) && diagonalMm > 0 ? diagonalMm : 0;
  const scale = Number.isFinite(sceneScaleMm) && sceneScaleMm > 0 ? sceneScaleMm : 1;
  const lowestY = -Math.max(fh, cam);
  const floorMargin = Math.max(diag * 0.5, Math.abs(lowestY) * 0.08, scale * 0.01);
  return lowestY - floorMargin;
}
