/**
 * Per-camera palette for the shared-view comparison stage.
 *
 * Cameras are tinted by slot index (blue / orange / green, cycling for N > 3).
 * Risk colors (`#38bdf8`/`#fbbf24`/`#fb923c`/`#f87171` in `FovCone3D.tsx`)
 * are reserved for badges/labels only — never frustum tint.
 */

export const CAMERA_PALETTE = ['#03a9f4', '#f8982e', '#22c55e'] as const;

/** Camera color for a slot index; wraps cyclically for N > 3. */
export function slotColor(index: number): string {
  if (!Number.isFinite(index)) return CAMERA_PALETTE[0];
  const i = Math.abs(Math.floor(index)) % CAMERA_PALETTE.length;
  return CAMERA_PALETTE[i];
}
