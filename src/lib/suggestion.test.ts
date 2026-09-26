import { describe, expect, it } from 'vitest'
import { parseAdviceQuery, suggest, type SuggestionContext } from './suggestion'
import type { Lens, Sensor } from './types'

/** GigE + global industrial camera (family inferred from the Basler name). */
const baslerCam: Sensor = {
  id: 'fix-basler-ace',
  name: 'Basler ace acA2440-20gm (IMX264)',
  widthMm: 8.4996,
  heightMm: 7.0932,
  resolutionH: 2464,
  resolutionV: 2056,
  pixelPitchUm: 3.45,
  mount: 'C',
  cameraInterface: 'GigE',
  shutter: 'global',
  source: 'manual',
  sourceUrl: 'https://www.baslerweb.com/en/products/cameras/area-scan-cameras/ace/',
}

/** USB3 + global industrial camera (IDS family). */
const idsCam: Sensor = {
  id: 'fix-ids-ueye',
  name: 'IDS uEye UI-3080CP (IMX265)',
  widthMm: 7.9808,
  heightMm: 5.3232,
  resolutionH: 2048,
  resolutionV: 1536,
  pixelPitchUm: 3.45,
  mount: 'C',
  cameraInterface: 'USB3',
  shutter: 'global',
  source: 'manual',
  sourceUrl: 'https://en.ids-imaging.com/store/ui-3080cp-c-hq.html',
}

/** Rolling-shutter USB bench camera with no family mapping. */
const benchCam: Sensor = {
  id: 'fix-bench-cam',
  name: 'Fixture BenchCam (2048x1536, rolling USB3)',
  widthMm: 8.8,
  heightMm: 6.6,
  resolutionH: 2048,
  resolutionV: 1536,
  mount: 'C',
  cameraInterface: 'USB3',
  shutter: 'rolling',
  source: 'manual',
}

/** DIY MIPI global-shutter module (Arducam family). */
const arducamCam: Sensor = {
  id: 'fix-arducam-gs',
  name: 'Arducam OV9281 global-shutter mono',
  widthMm: 5.184,
  heightMm: 3.888,
  resolutionH: 1280,
  resolutionV: 800,
  mount: 'S-mount',
  cameraInterface: 'MIPI',
  shutter: 'global',
  source: 'manual',
  sourceUrl: 'https://docs.arducam.com/',
}

/** DIY MIPI rolling-shutter module (Raspberry Pi family). */
const rpiCam: Sensor = {
  id: 'fix-rpi-hq',
  name: 'Raspberry Pi HQ Camera (IMX477)',
  widthMm: 6.287,
  heightMm: 4.712,
  resolutionH: 4056,
  resolutionV: 3040,
  mount: 'CS',
  cameraInterface: 'MIPI',
  shutter: 'rolling',
  source: 'manual',
  sourceUrl: 'https://www.raspberrypi.com/products/raspberry-pi-high-quality-camera/',
}

/** Seed-style entry with no interface/shutter metadata (unknown fields). */
const unknownCam: Sensor = {
  id: 'fix-unknown-cam',
  name: 'Fixture UnknownCam (2/3" mystery body)',
  widthMm: 8.8,
  heightMm: 6.6,
  resolutionH: 2048,
  resolutionV: 1536,
  mount: 'C',
  source: 'manual',
}

const industrialLens: Lens = {
  id: 'fix-lens-c12',
  name: 'Fixture C 12mm (16mm circle)',
  focalLengthMm: 12,
  mount: 'C',
  imageCircleMm: 16.0,
  source: 'manual',
  sourceUrl: 'https://example.com/lens-c12-datasheet',
}

const ratedLens: Lens = {
  id: 'fix-lens-c25-rated',
  name: 'Fixture C 25mm (rated 100 lp/mm)',
  focalLengthMm: 25,
  mount: 'C',
  imageCircleMm: 12.8,
  resolvingPowerLpMm: 100,
  source: 'manual',
  sourceUrl: 'https://example.com/lens-c25-datasheet',
}

/** Tiny M12 lens whose 6mm circle vignettes on 2/3" sensors. */
const tinyLens: Lens = {
  id: 'fix-lens-m12tiny',
  name: 'Fixture M12 6mm (6mm circle)',
  focalLengthMm: 6,
  mount: 'M12',
  imageCircleMm: 6.0,
  source: 'manual',
  sourceUrl: 'https://example.com/lens-m12-datasheet',
}

function ctx(overrides: Partial<SuggestionContext> = {}): SuggestionContext {
  return {
    sensors: [baslerCam, idsCam, benchCam, arducamCam, rpiCam, unknownCam],
    lenses: [industrialLens, ratedLens, tinyLens],
    defaultWorkingDistanceMm: 500,
    ...overrides,
  }
}

describe('parseAdviceQuery', () => {
  it('maps conveyor/motion language to a global-shutter requirement', () => {
    const p = parseAdviceQuery('inspect screws on a fast conveyor, line moves quickly')
    expect(p.requiredShutter).toBe('global')
  })

  it('extracts feature size, tray FOV and working distance from one sentence', () => {
    const p = parseAdviceQuery('inspect 2 mm screws on a 300 mm tray from 500 mm')
    expect(p.featureSizeMm).toBe(2)
    expect(p.targetFovHmm).toBe(300)
    expect(p.workingDistanceMm).toBe(500)
  })

  it('treats static scenes as shutter-any (no hard filter)', () => {
    const p = parseAdviceQuery('static benchtop photo of a label, USB connection')
    expect(p.requiredShutter).toBeUndefined()
    expect(p.requiredInterface).toBe('USB3')
  })

  it('maps washdown/factory language to manufacturing + IP65', () => {
    const p = parseAdviceQuery('food factory washdown line, GigE')
    expect(p.environment).toBe('manufacturing')
    expect(p.envRequirement).toBe('IP65')
  })
})

describe('suggest', () => {
  it('conveyor question requires global: rolling bench cam only surfaces as no-fit', () => {
    const out = suggest('inspect 2 mm screws on a 300 mm tray from 500 mm, GigE, conveyor moving fast', ctx())
    expect(out.length).toBeGreaterThan(0)
    const top = out[0]
    expect(top.verdict).not.toBe('no-fit')
    const benchCards = out.filter((s) => s.cameraId === 'fix-bench-cam')
    expect(benchCards.length).toBeGreaterThan(0)
    for (const card of benchCards) {
      expect(card.verdict).toBe('no-fit')
      expect(card.failedChecks.some((c) => !c.pass)).toBe(true)
    }
  })

  it('micro-manager keeps VERIFIED Basler/IDS families on top, flags DIY', () => {
    const out = suggest('cell imaging under micro-manager, static bench, WD 300 mm', ctx())
    const kept = out.filter((s) => s.verdict !== 'no-fit')
    const keptIds = new Set(kept.map((s) => s.cameraId))
    expect(keptIds.has('fix-basler-ace')).toBe(true)
    expect(keptIds.has('fix-ids-ueye')).toBe(true)
    const baslerCard = out.find((s) => s.cameraId === 'fix-basler-ace')
    expect(baslerCard?.failedChecks.find((c) => c.check === 'software')?.pass).toBe(true)
    expect(baslerCard?.evidence.some((e) => e.status === 'VERIFIED' && e.url?.startsWith('https://'))).toBe(true)
    // Arducam is only NEEDS-VERIFY for Micro-Manager — kept but flagged.
    const arduCards = out.filter((s) => s.cameraId === 'fix-arducam-gs')
    expect(arduCards.length).toBeGreaterThan(0)
    expect(arduCards.some((s) => s.evidence.some((e) => e.status === 'NEEDS-VERIFY'))).toBe(true)
    // RPi is NOT-SUPPORTED — sunk to no-fit with a failing software check.
    const rpiCards = out.filter((s) => s.cameraId === 'fix-rpi-hq')
    expect(rpiCards.every((s) => s.verdict === 'no-fit')).toBe(true)
    expect(rpiCards.some((s) => s.failedChecks.some((c) => c.check === 'software' && !c.pass))).toBe(true)
  })

  it('manufacturing washdown fails DIY families on the environment check; DIY passes', () => {
    const mfg = suggest('washdown food line, MIPI camera on a 200 mm belt from 400 mm', ctx())
    const arduMfg = mfg.filter((s) => s.cameraId === 'fix-arducam-gs')
    expect(arduMfg.length).toBeGreaterThan(0)
    expect(arduMfg.some((s) => s.failedChecks.some((c) => c.check === 'environment' && !c.pass))).toBe(true)
    const diy = suggest('diy bench prototype, MIPI camera on a 200 mm belt from 400 mm', ctx())
    const arduDiy = diy.filter((s) => s.cameraId === 'fix-arducam-gs')
    expect(arduDiy.some((s) => s.failedChecks.find((c) => c.check === 'environment')?.pass)).toBe(true)
  })

  it('coverage failure is surfaced, not dropped (tiny lens on 2/3" sensor)', () => {
    const out = suggest('static bench shot, 300 mm tray from 500 mm', ctx({ sensors: [baslerCam], lenses: [tinyLens] }))
    expect(out.length).toBe(1)
    const card = out[0]
    expect(card.failedChecks.find((c) => c.check === 'coverage')?.pass).toBe(false)
    expect(card.reasons.join(' ').toLowerCase()).toMatch(/vignett/)
  })

  it('unknown interface/shutter fields flag NEEDS-VERIFY instead of vanishing', () => {
    const out = suggest('GigE conveyor inspection, 300 mm tray from 500 mm', ctx({ sensors: [unknownCam], lenses: [industrialLens] }))
    expect(out.length).toBe(1)
    expect(out[0].evidence.some((e) => e.status === 'NEEDS-VERIFY' && /interface/i.test(e.claim))).toBe(true)
  })

  it('VERIFIED evidence always carries a source URL', () => {
    const out = suggest('static bench shot, 300 mm tray from 500 mm', ctx({ sensors: [baslerCam], lenses: [industrialLens] }))
    const verified = out[0].evidence.filter((e) => e.status === 'VERIFIED')
    expect(verified.length).toBeGreaterThan(0)
    for (const tag of verified) expect(tag.url).toMatch(/^https?:\/\//)
  })

  it('GigE requirement excludes USB3 bodies as surfaced no-fit cards', () => {
    const out = suggest('GigE plant network, static shot of a 300 mm tray from 500 mm', ctx())
    const idsCards = out.filter((s) => s.cameraId === 'fix-ids-ueye')
    expect(idsCards.length).toBeGreaterThan(0)
    expect(idsCards.every((s) => s.verdict === 'no-fit')).toBe(true)
    expect(idsCards.some((s) => s.failedChecks.some((c) => c.check === 'interface' && !c.pass))).toBe(true)
  })

  it('sharpcap keeps UVC-path Arducam VERIFIED but sinks unsupported RPi', () => {
    const out = suggest('sharpcap capture, static bench, 200 mm belt from 400 mm', ctx())
    const ardu = out.filter((s) => s.cameraId === 'fix-arducam-gs')
    expect(ardu.some((s) => s.failedChecks.find((c) => c.check === 'software')?.pass)).toBe(true)
    const rpi = out.filter((s) => s.cameraId === 'fix-rpi-hq')
    expect(rpi.length).toBeGreaterThan(0)
    expect(rpi.every((s) => s.verdict === 'no-fit')).toBe(true)
  })

  it('jetson implies MIPI and flags per-model CSI drivers NEEDS-VERIFY', () => {
    const p = parseAdviceQuery('jetson orin nano inspection, 200 mm belt from 400 mm')
    expect(p.requiredInterface).toBe('MIPI')
    const out = suggest('jetson orin nano inspection, 200 mm belt from 400 mm', ctx())
    expect(out.filter((s) => s.cameraId === 'fix-basler-ace').every((s) => s.verdict === 'no-fit')).toBe(true)
    const kept = out.filter((s) => s.verdict !== 'no-fit')
    expect(kept.length).toBeGreaterThan(0)
    expect(kept.every((s) => s.evidence.some((e) => e.status === 'NEEDS-VERIFY' && /jetson/i.test(e.claim)))).toBe(true)
  })

  it('manufacturing adds explicit score reasons; ranking is sequential', () => {
    const out = suggest('manufacturing line, GigE global camera, 300 mm tray from 500 mm', ctx())
    const top = out.find((s) => s.cameraId === 'fix-basler-ace')
    expect(top?.reasons.join(' ')).toMatch(/manufacturing/)
    out.forEach((s, i) => expect(s.rank).toBe(i + 1))
    const scores = out.filter((s) => s.verdict !== 'no-fit').map((s) => s.score)
    expect([...scores].sort((a, b) => b - a)).toEqual(scores)
  })

  it('empty question falls back to defaults and still ranks everything', () => {
    const out = suggest('', ctx())
    expect(out.length).toBe(6 * 3)
    expect(out[0].rank).toBe(1)
  })
})
