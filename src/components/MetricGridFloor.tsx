import { Grid } from '@react-three/drei';
import { useMemo } from 'react';
import { metricGridSpec } from '../lib/scaleReference';

interface MetricGridFloorProps {
  /**
   * Major grid square size in metres. One square = 1m by default, subdivided
   * into 10 x 10 minor cells (100mm each at the default).
   */
  gridSizeM?: number;
  /** World position of the grid centre (mm units, matching stage scenes). */
  position?: [number, number, number];
  /** Extent multiplier applied to the derived 10m span. */
  extentScale?: number;
}

const FALLBACK_SPEC = { sectionSizeMm: 1000, cellSizeMm: 100, extentMm: 10000 };

/**
 * Metric grid floor for a future shared-viewpoint compare stage: a drei
 * infinite-style `<Grid>` whose major squares are exactly `gridSizeM` metres
 * (default 1m), so camera footprints read against a real-world scale.
 * Deliberately standalone — it does not touch the existing FovCone3D floor.
 */
export function MetricGridFloor({ gridSizeM = 1, position = [0, 0, 0], extentScale = 1 }: MetricGridFloorProps) {
  const spec = metricGridSpec(gridSizeM);
  const safe = Number.isFinite(spec.extentMm) ? spec : FALLBACK_SPEC;
  const extent = Math.max(safe.extentMm * (Number.isFinite(extentScale) && extentScale > 0 ? extentScale : 1), 1);
  const args = useMemo(() => [extent, extent] as [number, number], [extent]);

  return (
    <Grid
      args={args}
      position={position}
      cellSize={safe.cellSizeMm}
      sectionSize={safe.sectionSizeMm}
      cellColor="#1e293b"
      sectionColor="#38bdf8"
      fadeDistance={extent * 0.6}
      fadeStrength={1}
      infiniteGrid={false}
    />
  );
}
