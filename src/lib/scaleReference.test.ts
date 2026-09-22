import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GRID_SIZE_M,
  GRID_DIVISIONS,
  HUMAN_REFERENCE_HEIGHT_M,
  humanReferenceHeightMm,
  humanReferenceLabel,
  metricGridSpec,
  resolveDatasheetHref,
} from './scaleReference';

describe('metricGridSpec', () => {
  it('defaults to 1m squares: 1000mm sections, 100mm cells', () => {
    const spec = metricGridSpec();
    expect(spec.sectionSizeMm).toBe(1000);
    expect(spec.cellSizeMm).toBe(100);
  });

  it('scales proportionally with gridSizeM', () => {
    const spec = metricGridSpec(0.5);
    expect(spec.sectionSizeMm).toBe(500);
    expect(spec.cellSizeMm).toBe(500 / GRID_DIVISIONS);
  });

  it('falls back to the default for non-positive or non-finite input', () => {
    expect(metricGridSpec(0)).toEqual(metricGridSpec(DEFAULT_GRID_SIZE_M));
    expect(metricGridSpec(-2)).toEqual(metricGridSpec(DEFAULT_GRID_SIZE_M));
    expect(metricGridSpec(Number.NaN)).toEqual(metricGridSpec(DEFAULT_GRID_SIZE_M));
  });
});

describe('humanReferenceHeightMm / humanReferenceLabel', () => {
  it('defaults to a ~1.8m figure (1800mm)', () => {
    expect(HUMAN_REFERENCE_HEIGHT_M).toBe(1.8);
    expect(humanReferenceHeightMm()).toBe(1800);
    expect(humanReferenceLabel()).toBe('1.8 m');
  });

  it('converts a custom height to mm with a matching label', () => {
    expect(humanReferenceHeightMm(2)).toBe(2000);
    expect(humanReferenceLabel(2)).toBe('2 m');
  });

  it('falls back to 1.8m for invalid heights', () => {
    expect(humanReferenceHeightMm(0)).toBe(1800);
    expect(humanReferenceHeightMm(Number.NaN)).toBe(1800);
  });
});

describe('resolveDatasheetHref', () => {
  it('returns null for null, undefined, or blank urls (missing-data case)', () => {
    expect(resolveDatasheetHref(null)).toBeNull();
    expect(resolveDatasheetHref(undefined)).toBeNull();
    expect(resolveDatasheetHref('')).toBeNull();
    expect(resolveDatasheetHref('   ')).toBeNull();
  });

  it('passes through a real url, trimmed', () => {
    expect(resolveDatasheetHref('  https://example.com/ds.pdf  ')).toBe('https://example.com/ds.pdf');
  });
});
