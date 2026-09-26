import { describe, expect, it } from 'vitest';
import { coverageCheck, environmentRating, interfaceCheck, usbSdkRule } from './rules.ts';

describe('coverageCheck', () => {
  it('passes when circle equals diagonal (zero margin)', () => {
    const r = coverageCheck(11.0, 11.0);
    expect(r.pass).toBe(true);
    expect(r.marginMm).toBeCloseTo(0);
  });

  it('passes with margin for 16mm circle on 2/3" sensor', () => {
    const r = coverageCheck(16.0, 11.0);
    expect(r.pass).toBe(true);
    expect(r.marginMm).toBeCloseTo(5.0);
  });

  it('fails for 6mm M12 circle on 2/3" sensor', () => {
    const r = coverageCheck(6.0, 11.0);
    expect(r.pass).toBe(false);
    expect(r.marginMm).toBeLessThan(0);
  });
});

describe('interfaceCheck boundaries', () => {
  it('USB3 passes at exactly 5m, fails at 5.1m', () => {
    expect(interfaceCheck('USB3', 5).pass).toBe(true);
    expect(interfaceCheck('USB3', 5.1).pass).toBe(false);
  });

  it('GigE passes at exactly 100m, fails beyond', () => {
    expect(interfaceCheck('GigE', 100).pass).toBe(true);
    expect(interfaceCheck('GigE', 101).pass).toBe(false);
  });

  it('MIPI passes at 0.3m, fails at 0.5m', () => {
    expect(interfaceCheck('MIPI', 0.3).pass).toBe(true);
    expect(interfaceCheck('MIPI', 0.5).pass).toBe(false);
  });
});

describe('usbSdkRule', () => {
  it('USB3 Vision (non-UVC) demands vendor SDK, not UVC', () => {
    const r = usbSdkRule('USB3', false, 'Basler pylon');
    expect(r.message).toMatch(/pylon/);
    expect(r.message).toMatch(/NOT/);
  });

  it('UVC devices allow the generic path', () => {
    expect(usbSdkRule('USB3', true, 'IDS peak').message).toMatch(/UVC/);
  });
});

describe('environmentRating', () => {
  it('DIY requirement is OK for DIY families', () => {
    expect(environmentRating('arducam', 'DIY', false).verdict).toBe('OK');
  });

  it('base unsealed model with IP67 requirement needs the sealed variant', () => {
    expect(environmentRating('basler-ace', 'IP67', false).verdict).toBe('NEEDS-SEALED-VARIANT');
  });

  it('sealed variant satisfies IP67', () => {
    expect(environmentRating('lucid-triton-atlas', 'IP67', true).verdict).toBe('OK');
  });

  it('DIY-only family is NOT-SUITABLE for IP65 washdown', () => {
    expect(environmentRating('rpi-hq-gs', 'IP65', false).verdict).toBe('NOT-SUITABLE');
  });
});
