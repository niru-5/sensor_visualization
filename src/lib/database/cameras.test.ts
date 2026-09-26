import { describe, expect, it } from 'vitest';
import { CAMERA_FAMILIES, allCameraModels, getCameraFamily } from './cameras.ts';

describe('camera families', () => {
  it('defines exactly 8 families', () => {
    expect(CAMERA_FAMILIES).toHaveLength(8);
  });

  it('every family has sensor formats, interfaces, shutter, and SDK', () => {
    for (const f of CAMERA_FAMILIES) {
      expect(f.models.length).toBeGreaterThan(0);
      expect(f.sdk.name.length).toBeGreaterThan(0);
      expect(f.sdk.url).toMatch(/^https?:\/\//);
      for (const m of f.models) {
        expect(m.sensorFormat.length).toBeGreaterThan(0);
        expect(m.sensorDiagonalMm).toBeGreaterThan(0);
        expect(m.interfaces.length).toBeGreaterThan(0);
        expect(['global', 'rolling']).toContain(m.shutter);
      }
    }
  });

  it('covers both global and rolling shutters across the database', () => {
    const shutters = new Set(allCameraModels().map((m) => m.shutter));
    expect(shutters.has('global')).toBe(true);
    expect(shutters.has('rolling')).toBe(true);
  });

  it('getCameraFamily resolves basler-ace with pylon SDK', () => {
    expect(getCameraFamily('basler-ace')?.sdk.name).toMatch(/pylon/i);
  });

  it('rpi family is MIPI-only with libcamera SDK', () => {
    const rpi = getCameraFamily('rpi-hq-gs');
    expect(rpi?.sdk.name).toMatch(/libcamera/i);
    for (const m of rpi?.models ?? []) expect(m.interfaces).toContain('MIPI');
  });
});
