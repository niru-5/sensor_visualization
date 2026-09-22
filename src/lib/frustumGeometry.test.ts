import { describe, expect, it } from 'vitest';
import { slotColor } from './cameraPalette';
import { computeGroundY, footprintRingRadiusMm, frustumCornersAtWd, rangeRingPoints } from './frustumGeometry';

const SENSOR = { widthMm: 7.2, heightMm: 5.4 };

describe('slotColor', () => {
  it('assigns blue / orange / green to slots 0-2 and cycles for N > 3', () => {
    expect(slotColor(0)).toBe('#03a9f4');
    expect(slotColor(1)).toBe('#f8982e');
    expect(slotColor(2)).toBe('#22c55e');
    expect(slotColor(3)).toBe('#03a9f4');
    expect(slotColor(4)).toBe('#f8982e');
  });

  it('falls back to slot 0 for non-finite input', () => {
    expect(slotColor(NaN)).toBe('#03a9f4');
  });
});

describe('frustumCornersAtWd', () => {
  it('returns footprint corners at z = WD symmetric about the axis', () => {
    // m = f / (WD - f) = 8 / 392; FOV = sensorDim / m
    const res = frustumCornersAtWd(SENSOR, 8, 400);
    expect(res).not.toBeNull();
    const fovH = (7.2 * 392) / 8; // 352.8
    const fovV = (5.4 * 392) / 8; // 264.6
    expect(res!.fovHmm).toBeCloseTo(fovH, 6);
    expect(res!.fovVmm).toBeCloseTo(fovV, 6);
    expect(res!.corners[0]).toEqual([fovH / 2, fovV / 2, 400]);
    expect(res!.corners[2]).toEqual([-fovH / 2, -fovV / 2, 400]);
  });

  it('returns null for invalid geometry (WD <= f, zero/negative inputs)', () => {
    expect(frustumCornersAtWd(SENSOR, 8, 8)).toBeNull();
    expect(frustumCornersAtWd(SENSOR, 8, 4)).toBeNull();
    expect(frustumCornersAtWd({ widthMm: 0, heightMm: 5.4 }, 8, 400)).toBeNull();
    expect(frustumCornersAtWd(SENSOR, -8, 400)).toBeNull();
    expect(frustumCornersAtWd(SENSOR, 8, NaN)).toBeNull();
  });
});

describe('footprintRingRadiusMm', () => {
  it('is half the footprint diagonal', () => {
    expect(footprintRingRadiusMm(300, 400)).toBeCloseTo(250, 9);
  });

  it('returns 0 for invalid inputs', () => {
    expect(footprintRingRadiusMm(0, 400)).toBe(0);
    expect(footprintRingRadiusMm(NaN, 400)).toBe(0);
    expect(footprintRingRadiusMm(-3, 400)).toBe(0);
  });
});

describe('rangeRingPoints', () => {
  it('returns a closed loop of segments + 1 points at z = WD on the circle', () => {
    const pts = rangeRingPoints(100, 400, 8);
    expect(pts).toHaveLength(9);
    for (let k = 0; k < 3; k++) expect(pts[0][k]).toBeCloseTo(pts[8][k], 9);
    for (const [x, y, z] of pts) {
      expect(Math.hypot(x, y)).toBeCloseTo(100, 9);
      expect(z).toBe(400);
    }
  });

  it('returns [] for invalid inputs', () => {
    expect(rangeRingPoints(0, 400)).toEqual([]);
    expect(rangeRingPoints(-5, 400)).toEqual([]);
    expect(rangeRingPoints(100, NaN)).toEqual([]);
    expect(rangeRingPoints(100, 400, 2)).toEqual([]);
  });
});

describe('computeGroundY', () => {
  it('sits below the lowest of footprint bottom / camera body plus margin', () => {
    const y = computeGroundY({ footprintHalfHeightMm: 200, cameraBottomMm: 20, diagonalMm: 10, sceneScaleMm: 400 });
    // lowestY = -200, margin = max(5, 16, 4) = 16
    expect(y).toBeCloseTo(-216, 9);
  });

  it('uses the camera body when it hangs lower than the footprint', () => {
    const y = computeGroundY({ footprintHalfHeightMm: 5, cameraBottomMm: 40, diagonalMm: 10, sceneScaleMm: 400 });
    expect(y).toBeLessThan(-40);
  });

  it('degrades gracefully for invalid input', () => {
    const y = computeGroundY({ footprintHalfHeightMm: NaN, cameraBottomMm: NaN, diagonalMm: NaN, sceneScaleMm: NaN });
    expect(Number.isFinite(y)).toBe(true);
    expect(y).toBeLessThanOrEqual(0);
  });
});
