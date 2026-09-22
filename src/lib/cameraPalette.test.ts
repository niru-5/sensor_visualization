/**
 * Track D — camera-slot palette contract (docs/VIZ-UPGRADE-TODO.md).
 *
 * The shared-view stage tints each camera's frustum/rays/edges by slot
 * index via `src/lib/cameraPalette.ts` (canonical palette), while
 * `src/lib/pixelGrid.ts` carries a fallback copy marked "Track A owns the
 * canonical one" — these tests pin the spec contract AND the agreement
 * between the two copies so they cannot drift apart silently.
 *
 * Spec (TODO Palette section): Camera 1 blue `#03a9f4`, Camera 2 orange
 * `#f8982e`, Camera 3 green `#22c55e`, cyclic for N > 3. Risk colors
 * (`#38bdf8`/`#fbbf24`/`#fb923c`/`#f87171`) are badges/labels only.
 */
import { describe, expect, it } from 'vitest'
import {
  SLOT_COLORS,
  SLOT_FILL_OPACITY,
  SLOT_RAY_OPACITY,
  slotColor,
  slotEdgeColor,
  slotFillColor,
} from './cameraPalette'
import { CAMERA_PALETTE, cameraColorForIndex } from './pixelGrid'

/** Risk colors reserved for badges/labels — never frustum tint. */
const RISK_COLORS: readonly string[] = ['#38bdf8', '#fbbf24', '#fb923c', '#f87171']

/** Dark stage background the frustum colors must read against. */
const STAGE_BACKGROUND = '#0f172a'

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!m?.[1]) throw new Error(`not a 6-digit hex color: ${hex}`)
  const v = m[1] as string
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)]
}

function rgbDistance(a: string, b: string): number {
  const [r1, g1, b1] = hexToRgb(a)
  const [r2, g2, b2] = hexToRgb(b)
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2)
}

function relativeLuminance(hex: string): number {
  const lin = (c: number): number => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  const [r, g, b] = hexToRgb(hex)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('camera-slot palette contract (Track A spec)', () => {
  it('canonical palette is blue / orange / green, valid and pairwise-distinct', () => {
    expect([...SLOT_COLORS]).toEqual(['#03a9f4', '#f8982e', '#22c55e'])
    for (const c of SLOT_COLORS) expect(c).toMatch(/^#[0-9a-fA-F]{6}$/)
    for (let i = 0; i < SLOT_COLORS.length; i++) {
      for (let j = i + 1; j < SLOT_COLORS.length; j++) {
        expect(rgbDistance(SLOT_COLORS[i] as string, SLOT_COLORS[j] as string)).toBeGreaterThan(100)
      }
    }
  })

  it('slotColor cycles for N > 3 and never returns a risk color', () => {
    const risk = new Set(RISK_COLORS.map((c) => c.toLowerCase()))
    for (let i = 0; i < 10; i++) {
      const c = slotColor(i)
      expect(c.toLowerCase()).toBe((SLOT_COLORS[i % SLOT_COLORS.length] as string).toLowerCase())
      expect(risk.has(c.toLowerCase()), `slot ${i} uses reserved risk color ${c}`).toBe(false)
    }
  })

  it('edge + fill helpers agree with the slot color (opacity stays a render concern)', () => {
    for (let i = 0; i < 5; i++) {
      expect(slotEdgeColor(i)).toBe(slotColor(i))
      expect(slotFillColor(i)).toBe(slotColor(i))
    }
  })

  it('shading opacities are translucent (volume reads as glass, edges stay opaque)', () => {
    for (const o of [SLOT_FILL_OPACITY, SLOT_RAY_OPACITY]) {
      expect(o).toBeGreaterThan(0)
      expect(o).toBeLessThan(1)
    }
    // Fill is the ghost layer; rays carry more weight.
    expect(SLOT_FILL_OPACITY).toBeLessThan(SLOT_RAY_OPACITY)
  })

  it('every slot color reads against the dark stage background (contrast >= 3)', () => {
    for (const c of SLOT_COLORS) {
      expect(contrastRatio(c, STAGE_BACKGROUND)).toBeGreaterThanOrEqual(3)
    }
  })

  it('pixelGrid fallback palette agrees with the canonical one (no silent drift)', () => {
    expect([...CAMERA_PALETTE]).toEqual([...SLOT_COLORS])
    for (let i = 0; i < 7; i++) {
      expect(cameraColorForIndex(i).toLowerCase()).toBe(slotColor(i).toLowerCase())
    }
  })
})
