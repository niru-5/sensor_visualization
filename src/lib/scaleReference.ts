/**
 * Pure helpers for the reusable scale-reference scene pieces.
 *
 * Kept UI-free so they run under node (vitest) without three/R3F.
 * The scene components in `src/components/` are thin renderers over these.
 */

export const MM_PER_M = 1000;

/** Default grid square size (metres) for {@link MetricGridFloor}. */
export const DEFAULT_GRID_SIZE_M = 1;

/** Reference human height (metres) for {@link HumanScaleReference}. */
export const HUMAN_REFERENCE_HEIGHT_M = 1.8;

/** Minor divisions per major grid square. */
export const GRID_DIVISIONS = 10;

export interface MetricGridSpec {
  /** Major square size, mm. */
  sectionSizeMm: number;
  /** Minor cell size, mm. */
  cellSizeMm: number;
  /** Total grid extent (square), mm. */
  extentMm: number;
}

function sanitiseGridSizeM(gridSizeM: number): number {
  if (!Number.isFinite(gridSizeM) || gridSizeM <= 0) return DEFAULT_GRID_SIZE_M;
  return gridSizeM;
}

/**
 * Derive drei `<Grid>` sizes (mm) from a major square size in metres.
 * A 1m square renders 10 x 10 minor cells of 100mm each, spanning 10m.
 */
export function metricGridSpec(gridSizeM: number = DEFAULT_GRID_SIZE_M): MetricGridSpec {
  const sizeM = sanitiseGridSizeM(gridSizeM);
  const sectionSizeMm = sizeM * MM_PER_M;
  const cellSizeMm = sectionSizeMm / GRID_DIVISIONS;
  const extentMm: number = sectionSizeMm * GRID_DIVISIONS;
  return { sectionSizeMm, cellSizeMm, extentMm };
}

/** Height of the human reference figure, mm. */
export function humanReferenceHeightMm(heightM: number = HUMAN_REFERENCE_HEIGHT_M): number {
  if (!Number.isFinite(heightM) || heightM <= 0) return HUMAN_REFERENCE_HEIGHT_M * MM_PER_M;
  return heightM * MM_PER_M;
}

/** Human-readable dimension label, e.g. `1.8 m`. */
export function humanReferenceLabel(heightM: number = HUMAN_REFERENCE_HEIGHT_M): string {
  const h = Number.isFinite(heightM) && heightM > 0 ? heightM : HUMAN_REFERENCE_HEIGHT_M;
  return `${h} m`;
}

/**
 * Normalise a datasheet URL for rendering.
 * Returns `null` for null/undefined/blank input so the link button
 * renders nothing — the standard missing-data case when a library entry
 * was added manually without a source URL.
 */
export function resolveDatasheetHref(url: string | null | undefined): string | null {
  if (url == null) return null;
  const trimmed = url.trim();
  return trimmed.length > 0 ? trimmed : null;
}
