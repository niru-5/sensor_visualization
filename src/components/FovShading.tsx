/**
 * Track B — per-camera FOV shading + footprint dressing for the shared-view
 * comparison stage (Track A owns `SharedFovStage.tsx` / `App.tsx` wiring, so
 * this file only exports composable groups Track A can drop in).
 *
 * `FovShading`: transparent FOV volume (opacity ~0.3, DoubleSide,
 * depthWrite false) in the camera slot color, plus opaque edge lines
 * (apex→corner rays + footprint outline, pattern ported from `Frustum` in
 * `FovCone3D.tsx` with memo + dispose) and a camera-colored range ring at
 * the WD plane with an mm label.
 *
 * `StageFloor`: meter ground grid (`MetricGridFloor`, major squares = 1 m)
 * with an optional `HumanScaleReference` (1.8 m figure) scale anchor,
 * off by default so it never clutters the comparison.
 */
import { Html } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { slotColor } from '../lib/cameraPalette';
import { computeFov } from '../lib/optics';
import { footprintRingRadiusMm, frustumCornersAtWd, rangeRingPoints } from '../lib/frustumGeometry';
import type { Vec3 } from '../lib/frustumGeometry';
import type { Lens, Sensor } from '../lib/types';
import { HumanScaleReference } from './HumanScaleReference';
import { MetricGridFloor } from './MetricGridFloor';

/** Fill opacity for the FOV volume (Track B spec: ~0.3). */
export const FOV_SHADING_OPACITY = 0.3;

interface FovShadingProps {
  sensor: Sensor;
  lens: Lens;
  workingDistanceMm: number;
  /** Palette slot index (camera order); wrapped cyclically. Defaults to 0. */
  colorIndex?: number;
  /** Explicit color override (takes precedence over `colorIndex`). */
  color?: string;
  /** Draw the range ring at the WD plane. Defaults to true. */
  showRangeRing?: boolean;
  /** Ring tessellation. Defaults to 64. */
  ringSegments?: number;
}

function toVector3(p: Vec3): THREE.Vector3 {
  return new THREE.Vector3(p[0], p[1], p[2]);
}

export function FovShading({
  sensor,
  lens,
  workingDistanceMm,
  colorIndex = 0,
  color,
  showRangeRing = true,
  ringSegments = 64,
}: FovShadingProps) {
  const resolved = color ?? slotColor(colorIndex);
  const wd = Math.max(workingDistanceMm, 1);
  const fov = computeFov(sensor, lens.focalLengthMm, wd);
  const corners = frustumCornersAtWd(sensor, lens.focalLengthMm, wd);

  const geometry = useMemo(() => {
    if (!corners) {
      return { footprintEdges: null as THREE.BufferGeometry | null, raySets: [] as THREE.BufferGeometry[], ring: null as THREE.BufferGeometry | null, volume: null as THREE.BufferGeometry | null };
    }
    const pts = corners.corners.map(toVector3);
    const apex = new THREE.Vector3(0, 0, 0);
    const footprintEdges = new THREE.BufferGeometry().setFromPoints([...pts, pts[0]]);
    const raySets = pts.map((c) => new THREE.BufferGeometry().setFromPoints([apex, c]));

    let ring: THREE.BufferGeometry | null = null;
    if (showRangeRing) {
      const radius = footprintRingRadiusMm(corners.fovHmm, corners.fovVmm);
      const ringPts = rangeRingPoints(radius, wd, ringSegments);
      if (ringPts.length > 0) ring = new THREE.BufferGeometry().setFromPoints(ringPts.map(toVector3));
    }

    // Pyramid volume: apex + 4 side faces + footprint base quad.
    const positions = new Float32Array([
      // sides (apex, c[i], c[i+1])
      0, 0, 0, pts[0].x, pts[0].y, pts[0].z, pts[1].x, pts[1].y, pts[1].z,
      0, 0, 0, pts[1].x, pts[1].y, pts[1].z, pts[2].x, pts[2].y, pts[2].z,
      0, 0, 0, pts[2].x, pts[2].y, pts[2].z, pts[3].x, pts[3].y, pts[3].z,
      0, 0, 0, pts[3].x, pts[3].y, pts[3].z, pts[0].x, pts[0].y, pts[0].z,
      // base quad
      pts[0].x, pts[0].y, pts[0].z, pts[1].x, pts[1].y, pts[1].z, pts[2].x, pts[2].y, pts[2].z,
      pts[0].x, pts[0].y, pts[0].z, pts[2].x, pts[2].y, pts[2].z, pts[3].x, pts[3].y, pts[3].z,
    ]);
    const volume = new THREE.BufferGeometry();
    volume.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    return { footprintEdges, raySets, ring, volume };
  }, [corners, wd, showRangeRing, ringSegments]);

  useEffect(
    () => () => {
      geometry.footprintEdges?.dispose();
      geometry.ring?.dispose();
      geometry.volume?.dispose();
      for (const g of geometry.raySets) g.dispose();
    },
    [geometry],
  );

  if (!corners || !fov.horizontal.fovMm || !fov.vertical.fovMm) {
    return (
      <group>
        <Html position={[0, sensor.heightMm / 2 + 20, -15]} center distanceFactor={200}>
          <div className="rounded bg-red-500/90 px-2 py-1 text-xs whitespace-nowrap text-white shadow-lg ring-1 ring-white/20">
            {fov.horizontal.message ?? 'Invalid geometry for this working distance.'}
          </div>
        </Html>
      </group>
    );
  }

  const fovH = corners.fovHmm;
  const fovV = corners.fovVmm;
  const fh = fovV / 2;
  const ringRadius = footprintRingRadiusMm(fovH, fovV);

  return (
    <group>
      {/* Transparent FOV volume in the camera slot color */}
      {geometry.volume && (
        <mesh geometry={geometry.volume}>
          <meshBasicMaterial color={resolved} transparent opacity={FOV_SHADING_OPACITY} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}

      {/* Opaque edge lines: frustum rays apex -> corners */}
      {geometry.raySets.map((geom, i) => (
        <lineSegments key={`ray-${i}`}>
          <primitive object={geom} attach="geometry" />
          <lineBasicMaterial color={resolved} />
        </lineSegments>
      ))}

      {/* Opaque footprint outline */}
      {geometry.footprintEdges && (
        <lineSegments>
          <primitive object={geometry.footprintEdges} attach="geometry" />
          <lineBasicMaterial color={resolved} />
        </lineSegments>
      )}

      {/* Range ring at the WD plane (circumscribed circle of the footprint) */}
      {showRangeRing && geometry.ring && (
        <lineLoop>
          <primitive object={geometry.ring} attach="geometry" />
          <lineBasicMaterial color={resolved} />
        </lineLoop>
      )}

      {/* Footprint badge (existing badge pattern from FovCone3D) */}
      <Html position={[0, fh + Math.max(15, fh * 0.08), wd]} center distanceFactor={Math.max(wd, 200)}>
        <div className="rounded bg-slate-900/90 px-2 py-1 text-xs whitespace-nowrap text-slate-100 shadow-lg ring-1 ring-white/10">
          FOV {fovH.toFixed(0)} x {fovV.toFixed(0)}mm @ {wd}mm
        </div>
      </Html>
      {showRangeRing && (
        <Html position={[ringRadius, -fh - Math.max(15, fh * 0.08), wd]} center distanceFactor={Math.max(wd, 200)}>
          <div
            className="rounded px-2 py-1 text-xs font-medium whitespace-nowrap text-slate-900 shadow-lg"
            style={{ backgroundColor: resolved }}
          >
            Ø {(ringRadius * 2).toFixed(0)}mm @ {wd}mm
          </div>
        </Html>
      )}
    </group>
  );
}

interface StageFloorProps {
  /** Floor height (mm) — e.g. from `computeGroundY` in `lib/frustumGeometry`. */
  groundY: number;
  /** Stage-axis centre of the grid (mm along Z). Defaults to 0. */
  centerZ?: number;
  /** Major square size in metres. Defaults to 1 (major squares = 1 m). */
  gridSizeM?: number;
  /** Extent multiplier for the grid span. */
  extentScale?: number;
  /** Show the 1.8 m human scale anchor. Off by default. */
  showHuman?: boolean;
  /** Feet position of the human figure (mm). Defaults to beside the origin at floor level. */
  humanPosition?: [number, number, number];
}

/**
 * Shared-view stage dressing: meter ground grid + optional human reference.
 * Track A renders this once inside `SharedFovStage` (NOT per camera).
 */
export function StageFloor({ groundY, centerZ = 0, gridSizeM = 1, extentScale = 1, showHuman = false, humanPosition }: StageFloorProps) {
  return (
    <group>
      <MetricGridFloor position={[0, groundY, centerZ]} gridSizeM={gridSizeM} extentScale={extentScale} />
      {showHuman && <HumanScaleReference position={humanPosition ?? [0, groundY, centerZ]} />}
    </group>
  );
}
