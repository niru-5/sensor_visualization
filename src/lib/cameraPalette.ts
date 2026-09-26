/**
 * Per-camera palette for the shared-view comparison stage.
 *
 * Each camera slot gets a stable identity color (by slot index, cycling for
 * N > MAX_CAMERAS) so overlapping frustums stay attributable at a glance.
 * Risk colors (`normal`/`macro`/`extreme-macro`/`invalid` in FovCone3D) are
 * reserved for badges/labels only — never frustum tint.
 */

export const SLOT_COLORS = ['#03a9f4', '#f8982e', '#22c55e'] as const

/** Fill opacity for the footprint plane of a shared-view frustum. */
export const SLOT_FILL_OPACITY = 0.16

/** Opacity for the apex→corner rays of a shared-view frustum. */
export const SLOT_RAY_OPACITY = 0.55

/**
 * Fill opacity for the transparent FOV *volume* (pyramid mesh in
 * `FovShading.tsx`).
 *
 * Opacity unification note (Track VIZ, FLOW-REDESIGN-TODO): the three
 * values above are NOT duplicates to merge — they tint different render
 * elements. `FOV_VOLUME_OPACITY` (0.3) is for the 3D pyramid volume
 * (DoubleSide, depthWrite false); `SLOT_FILL_OPACITY` (0.16) is for the
 * flat footprint plane; `SLOT_RAY_OPACITY` (0.55) is for 1px edge lines.
 * A volume needs a higher alpha than a flat plane to read the same at a
 * glance, and lines need more still. All three now live here so there is
 * a single source of truth.
 */
export const FOV_VOLUME_OPACITY = 0.3

/** Identity color for camera slot `index` (0-based). Cycles past the palette length. */
export function slotColor(index: number): string {
  if (!Number.isFinite(index)) return SLOT_COLORS[0] as string
  const i = Math.abs(Math.floor(index)) % SLOT_COLORS.length
  return SLOT_COLORS[i] as string
}

/** Opaque edge color (frustum rays + footprint outline) for slot `index`. */
export function slotEdgeColor(index: number): string {
  return slotColor(index)
}

/**
 * Fill color (footprint plane) for slot `index`. Apply with
 * `transparent opacity={SLOT_FILL_OPACITY}` on the material — the helper
 * returns the base color so opacity stays a render concern, not data.
 */
export function slotFillColor(index: number): string {
  return slotColor(index)
}
