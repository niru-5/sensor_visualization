import { describe, expect, it } from 'vitest'
import { sanitizeModelOutput } from './callExtractionModel.js'

describe('sanitizeModelOutput (sensor)', () => {
  it('passes clean values through', () => {
    const clean = sanitizeModelOutput(
      {
        name: 'Sony IMX264',
        opticalFormat: '2/3"',
        widthMm: 8.4,
        heightMm: 7.1,
        resolutionH: 2448,
        resolutionV: 2048,
        pixelPitchUm: 3.45,
        mount: 'C',
        cameraInterface: 'GigE Vision',
        shutter: 'global',
        fps: 35.7,
        trigger: 'hardware + software',
      },
      'sensor',
    )
    expect(clean['name']).toBe('Sony IMX264')
    expect(clean['widthMm']).toBe(8.4)
    expect(clean['mount']).toBe('C')
    expect(clean['fps']).toBe(35.7)
  })

  it('coerces "N/A" / "unknown" / "" / "-" style tokens to null', () => {
    const clean = sanitizeModelOutput(
      {
        name: 'N/A',
        opticalFormat: 'unknown',
        widthMm: 'N/A',
        heightMm: '',
        resolutionH: '  ',
        resolutionV: 'none',
        pixelPitchUm: 'not stated',
        cameraInterface: 'Unknown',
        shutter: '-',
        fps: 'n/a',
        trigger: 'Not Specified',
      },
      'sensor',
    )
    for (const key of [
      'name', 'opticalFormat', 'widthMm', 'heightMm', 'resolutionH', 'resolutionV',
      'pixelPitchUm', 'cameraInterface', 'shutter', 'fps', 'trigger',
    ]) {
      expect(clean[key], key).toBeNull()
    }
  })

  it('coerces numeric strings and drops garbage in number fields', () => {
    const clean = sanitizeModelOutput(
      { resolutionH: '2448', fps: '35.7', widthMm: '2/3"', pixelPitchUm: 'approx 3.45', modMm: undefined },
      'sensor',
    )
    expect(clean['resolutionH']).toBe(2448)
    expect(clean['fps']).toBe(35.7)
    // Optical-format fractions and prose are not numbers — null, never stored.
    expect(clean['widthMm']).toBeNull()
    expect(clean['pixelPitchUm']).toBeNull()
  })

  it('enum-checks mount: canonical values pass, typos become null', () => {
    const kinds: Array<[unknown, unknown]> = [
      ['C', 'C'],
      ['c', 'C'],
      ['S-mount', 'S-mount'],
      ['s mount', 'S-mount'],
      ['M12', 'M12'],
      ['m-12', 'M12'],
      ['other', 'other'],
      ['XYZ-mount', null],
      ['EF', null],
      ['', null],
      ['N/A', null],
      [42, null],
    ]
    for (const [input, expected] of kinds) {
      expect(sanitizeModelOutput({ mount: input }, 'sensor')['mount'], String(input)).toBe(expected)
    }
  })

  it('drops unknown keys the model invents', () => {
    const clean = sanitizeModelOutput(
      { name: 'IMX264', bogusKey: 'hi', notes: 'some prose', mount: 'C' },
      'sensor',
    )
    expect(clean).not.toHaveProperty('bogusKey')
    expect(clean).not.toHaveProperty('notes')
    expect(Object.keys(clean).sort()).toEqual(
      ['cameraInterface', 'fps', 'heightMm', 'mount', 'name', 'opticalFormat', 'pixelPitchUm', 'resolutionH', 'resolutionV', 'shutter', 'trigger', 'widthMm'].sort(),
    )
  })

  it('fills absent keys with null so partial responses keep a complete shape', () => {
    const clean = sanitizeModelOutput({ name: 'IMX264' }, 'sensor')
    expect(clean['name']).toBe('IMX264')
    expect(clean['fps']).toBeNull()
    expect(clean['mount']).toBeNull()
    expect(clean['widthMm']).toBeNull()
  })

  it('trims string values', () => {
    const clean = sanitizeModelOutput({ name: '  IMX264  ', trigger: '\nhardware\n' }, 'sensor')
    expect(clean['name']).toBe('IMX264')
    expect(clean['trigger']).toBe('hardware')
  })
})

describe('sanitizeModelOutput (lens)', () => {
  it('sanitizes lens fields with the same rules', () => {
    const clean = sanitizeModelOutput(
      {
        name: 'LM25HC',
        focalLengthMm: '25',
        mount: 'C',
        imageCircleMm: 'N/A',
        maxAperture: '1.4',
        resolvingPowerLpMm: 'unknown',
        modMm: 100,
        distortionPct: 0,
        weightG: 'garbage!!',
        driverNote: '',
        extra: 'drop',
      },
      'lens',
    )
    expect(clean['focalLengthMm']).toBe(25)
    expect(clean['imageCircleMm']).toBeNull()
    expect(clean['maxAperture']).toBe(1.4)
    expect(clean['resolvingPowerLpMm']).toBeNull()
    expect(clean['modMm']).toBe(100)
    // 0 is a real value, not a missing one.
    expect(clean['distortionPct']).toBe(0)
    expect(clean['weightG']).toBeNull()
    expect(clean['driverNote']).toBeNull()
    expect(clean).not.toHaveProperty('extra')
  })
})
