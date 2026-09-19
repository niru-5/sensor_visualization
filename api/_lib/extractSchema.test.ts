import { describe, expect, it } from 'vitest'
import { LENS_TOOL, SENSOR_TOOL, toExtractedFields } from './callExtractionModel.js'
import { LENS_FIELD_KEYS, SENSOR_FIELD_KEYS } from '../../src/lib/extraction.js'

function propNames(tool: { input_schema: { properties: Record<string, unknown>; required: string[] } }): string[] {
  return Object.keys(tool.input_schema.properties)
}

describe('sensor extract schema (extended, nullable, dont-guess)', () => {
  it('keeps every original sensor field', () => {
    for (const key of ['name', 'opticalFormat', 'widthMm', 'heightMm', 'resolutionH', 'resolutionV', 'pixelPitchUm', 'mount']) {
      expect(propNames(SENSOR_TOOL)).toContain(key)
    }
  })

  it('adds nullable cameraInterface/shutter/fps/trigger fields', () => {
    const props = SENSOR_TOOL.input_schema.properties as Record<string, { type: string[] }>
    for (const key of ['cameraInterface', 'shutter', 'fps', 'trigger']) {
      expect(propNames(SENSOR_TOOL)).toContain(key)
      expect(props[key].type).toContain('null')
    }
    expect((props['fps'] as { type: string[] }).type).toContain('number')
    for (const key of ['cameraInterface', 'shutter', 'trigger']) {
      expect((props[key] as { type: string[] }).type).toContain('string')
    }
  })

  it('requires the new fields so the model returns explicit nulls instead of omitting them', () => {
    for (const key of ['cameraInterface', 'shutter', 'fps', 'trigger']) {
      expect(SENSOR_TOOL.input_schema.required).toContain(key)
    }
  })

  it('keeps the dont-guess instruction in the tool description', () => {
    expect(SENSOR_TOOL.description).toMatch(/null for anything not stated/i)
  })
})

describe('lens extract schema (extended, nullable, dont-guess)', () => {
  it('keeps resolvingPowerLpMm and every other original lens field', () => {
    for (const key of ['name', 'focalLengthMm', 'mount', 'imageCircleMm', 'maxAperture', 'resolvingPowerLpMm']) {
      expect(propNames(LENS_TOOL)).toContain(key)
    }
  })

  it('adds nullable MOD/distortion/weight/driverNote fields', () => {
    const props = LENS_TOOL.input_schema.properties as Record<string, { type: string[] }>
    for (const key of ['modMm', 'distortionPct', 'weightG', 'driverNote']) {
      expect(propNames(LENS_TOOL)).toContain(key)
      expect(props[key].type).toContain('null')
    }
    for (const key of ['modMm', 'distortionPct', 'weightG']) {
      expect((props[key] as { type: string[] }).type).toContain('number')
    }
    expect((props['driverNote'] as { type: string[] }).type).toContain('string')
  })

  it('requires the new fields so the model returns explicit nulls instead of omitting them', () => {
    for (const key of ['modMm', 'distortionPct', 'weightG', 'driverNote']) {
      expect(LENS_TOOL.input_schema.required).toContain(key)
    }
  })

  it('keeps the dont-guess instruction in the tool description', () => {
    expect(LENS_TOOL.description).toMatch(/null for anything not stated/i)
  })
})

describe('shared extraction key lists', () => {
  it('exposes the new sensor keys to the frontend review form', () => {
    for (const key of ['cameraInterface', 'shutter', 'fps', 'trigger']) {
      expect(SENSOR_FIELD_KEYS).toContain(key)
    }
  })

  it('exposes the new lens keys to the frontend review form', () => {
    for (const key of ['modMm', 'distortionPct', 'weightG', 'driverNote']) {
      expect(LENS_FIELD_KEYS).toContain(key)
    }
    expect(LENS_FIELD_KEYS).toContain('resolvingPowerLpMm')
  })
})

describe('toExtractedFields found-flag semantics (never guess)', () => {
  it('marks null/undefined as not found and real values as found', () => {
    const wrapped = toExtractedFields({ fps: null, shutter: undefined, name: 'IMX264', modMm: 100 })
    expect(wrapped['fps']).toEqual({ value: null, found: false })
    expect(wrapped['shutter']).toEqual({ value: null, found: false })
    expect(wrapped['name']).toEqual({ value: 'IMX264', found: true })
    expect(wrapped['modMm']).toEqual({ value: 100, found: true })
  })

  it('preserves falsy-but-real values (0 / empty-string handling stays explicit)', () => {
    const wrapped = toExtractedFields({ distortionPct: 0 })
    expect(wrapped['distortionPct']).toEqual({ value: 0, found: true })
  })
})
