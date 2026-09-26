import { describe, expect, it } from 'vitest'
import { slotCompatSummary } from './slotCompat'

const sensor = {
  mount: 'C' as const,
  cameraInterface: 'USB3' as const,
  widthMm: 10,
  heightMm: 8,
}

const lens = {
  mount: 'C' as const,
  imageCircleMm: 30,
}

describe('slotCompatSummary', () => {
  it('passes a clean pairing with a short cable', () => {
    // Sensor diagonal for a stub: use a wide image circle so coverage is ok.
    const s = { ...sensor, mount: 'C' as const }
    const summary = slotCompatSummary(s, lens, 2)
    expect(summary.glyphs).toBe('IF ✓ · MNT ✓ · IMG ✓')
    expect(summary.tone).toBe('pass')
  })

  it('fails the interface leg on an over-length cable', () => {
    const summary = slotCompatSummary(sensor, lens, 50)
    expect(summary.glyphs).toMatch(/IF ✗/)
    expect(summary.tone).toBe('fail')
  })

  it('stays informational (warn, never fail) without a cable length', () => {
    const summary = slotCompatSummary(sensor, lens)
    expect(summary.glyphs).toMatch(/IF \?/)
    expect(summary.tone).toBe('warn')
    expect(summary.title).toMatch(/passive limit/)
  })

  it('flags an unknown interface for verification, never a silent pass', () => {
    const summary = slotCompatSummary({ mount: 'C', widthMm: 10, heightMm: 8 }, lens, 1)
    expect(summary.glyphs).toMatch(/IF \?/)
    expect(summary.tone).toBe('warn')
    expect(summary.title).toMatch(/verify/)
  })

  it('fails a mount mismatch', () => {
    const summary = slotCompatSummary(sensor, { ...lens, mount: 'F' }, 2)
    expect(summary.glyphs).toMatch(/MNT ✗/)
    expect(summary.tone).toBe('fail')
  })

  it('warns (not fails) on a spacer mount', () => {
    const summary = slotCompatSummary({ ...sensor, mount: 'CS' }, lens, 2)
    expect(summary.glyphs).toMatch(/MNT ~/)
    expect(summary.tone).toBe('warn')
  })

  it('fails a vignetting image circle', () => {
    const summary = slotCompatSummary(sensor, { ...lens, imageCircleMm: 1 }, 2)
    expect(summary.glyphs).toMatch(/IMG ✗/)
    expect(summary.tone).toBe('fail')
  })
})
