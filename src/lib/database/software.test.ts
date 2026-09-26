import { describe, expect, it } from 'vitest';
import { COMPAT_MATRIX, allMatches, lookupCompat, verifiedFor } from './software.ts';

describe('software compat matrix', () => {
  it('every VERIFIED row carries a source URL', () => {
    const verified = COMPAT_MATRIX.filter((e) => e.status === 'VERIFIED');
    expect(verified.length).toBeGreaterThan(10);
    for (const e of verified) expect(e.sourceUrl).toMatch(/^https?:\/\//);
  });

  it('Basler x pylon is VERIFIED', () => {
    expect(lookupCompat('basler-ace', 'pylon')?.status).toBe('VERIFIED');
  });

  it('Micro-Manager x Lucid is NEEDS-VERIFY', () => {
    expect(lookupCompat('lucid-triton-atlas', 'micromanager')?.status).toBe('NEEDS-VERIFY');
  });

  it('Micro-Manager x Dahua is NEEDS-VERIFY', () => {
    expect(lookupCompat('dahua-hikrobot', 'micromanager')?.status).toBe('NEEDS-VERIFY');
  });

  it('SharpCap x JAI is NEEDS-VERIFY', () => {
    expect(lookupCompat('jai-go', 'sharpcap')?.status).toBe('NEEDS-VERIFY');
  });

  it('HALCON is VERIFIED for all six GenTL families', () => {
    const got = new Set(verifiedFor('halcon').map((e) => e.family));
    for (const f of ['basler-ace', 'flir-blackfly', 'ids-ueye', 'lucid-triton-atlas', 'jai-go', 'dahua-hikrobot'] as const) {
      expect(got.has(f)).toBe(true);
    }
  });

  it('Jetson CSI caveat rows exist via allMatches', () => {
    expect(allMatches('arducam', 'libcamera').some((e) => e.status === 'NEEDS-VERIFY')).toBe(true);
  });
});
