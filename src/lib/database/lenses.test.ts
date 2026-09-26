import { describe, expect, it } from 'vitest';
import { LENSES, getLens, lensesForMount } from './lenses.ts';

describe('lens database', () => {
  it('covers mounts M12, C, CS, and F', () => {
    const mounts = new Set(LENSES.map((l) => l.mount));
    for (const m of ['M12', 'C', 'CS', 'F'] as const) expect(mounts.has(m)).toBe(true);
  });

  it('every lens has image circle, max sensor format, and DIY flag', () => {
    for (const l of LENSES) {
      expect(l.imageCircleMm).toBeGreaterThan(0);
      expect(l.maxSensorFormat.length).toBeGreaterThan(0);
      expect(typeof l.diyOnly).toBe('boolean');
      expect(['entocentric', 'telecentric']).toContain(l.lensType);
    }
  });

  it('telecentrics carry magnification', () => {
    const teles = LENSES.filter((l) => l.lensType === 'telecentric');
    expect(teles.length).toBeGreaterThan(0);
    for (const t of teles) expect(t.magnification).toBeGreaterThan(0);
  });

  it('M12 lenses are flagged DIY-only', () => {
    for (const l of lensesForMount('M12')) expect(l.diyOnly).toBe(true);
  });

  it('getLens resolves the 1" C-mount lens', () => {
    expect(getLens('c-12mm-1in')?.imageCircleMm).toBe(16.0);
  });
});
