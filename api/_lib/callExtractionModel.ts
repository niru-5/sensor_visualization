import Anthropic from '@anthropic-ai/sdk'
import type { ExtractKind, LensExtractedFields, SensorExtractedFields } from '../../src/lib/extraction.js'
import type { ExtractedField, MountType } from '../../src/lib/types.js'
import { DatasheetError } from './errors.js'

const MOUNT_ENUM = ['C', 'CS', 'S-mount', 'M12', 'F', 'other']

const SENSOR_KEYS = [
  'name', 'opticalFormat', 'widthMm', 'heightMm', 'resolutionH', 'resolutionV',
  'pixelPitchUm', 'mount', 'cameraInterface', 'shutter', 'fps', 'trigger',
] as const
const LENS_KEYS = [
  'name', 'focalLengthMm', 'mount', 'imageCircleMm', 'maxAperture', 'resolvingPowerLpMm',
  'modMm', 'distortionPct', 'weightG', 'driverNote',
] as const
const SENSOR_NUMBER_FIELDS: ReadonlySet<string> = new Set([
  'widthMm', 'heightMm', 'resolutionH', 'resolutionV', 'pixelPitchUm', 'fps',
])
const LENS_NUMBER_FIELDS: ReadonlySet<string> = new Set([
  'focalLengthMm', 'imageCircleMm', 'maxAperture', 'resolvingPowerLpMm', 'modMm', 'distortionPct', 'weightG',
])

/** Model "don't know" phrasings that must become null, never a stored value. */
const NULL_TOKENS: ReadonlySet<string> = new Set([
  'n/a', 'na', 'n.a.', 'unknown', 'none', 'not specified', 'not stated',
  'not applicable', 'unspecified', 'tbd', '-', '--', 'null', 'nil',
])

function isNullToken(value: string): boolean {
  return NULL_TOKENS.has(value.trim().toLowerCase())
}

function sanitizeString(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed === '' || isNullToken(trimmed)) return null
  return trimmed
}

function sanitizeNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '' || isNullToken(trimmed)) return null
    const num = Number(trimmed.replace(/,/g, ''))
    return Number.isFinite(num) ? num : null
  }
  return null
}

function sanitizeMount(value: unknown): MountType | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed === '' || isNullToken(trimmed)) return null
  const squash = (s: string) => s.toLowerCase().replace(/[\s_\-]+/g, '')
  const match = MOUNT_ENUM.find((m) => squash(m) === squash(trimmed))
  return (match as MountType | undefined) ?? null
}

/**
 * Validates + sanitizes raw model tool input before it becomes ExtractedFields:
 * - drops unknown keys (the model sometimes invents extras like "notes"),
 * - coerces "N/A" / "unknown" / "" / "-" to null,
 * - enum-checks mount ("XYZ-mount" becomes null, never stored),
 * - coerces numeric strings ("2448" -> 2448), drops garbage in number
 *   fields ("2/3\"" -> null),
 * - fills every known key (absent -> null) so the frontend always gets a
 *   complete shape for partial responses.
 */
export function sanitizeModelOutput(
  raw: Record<string, unknown>,
  kind: ExtractKind,
): Record<string, unknown> {
  const keys: readonly string[] = kind === 'sensor' ? SENSOR_KEYS : LENS_KEYS
  const numberFields = kind === 'sensor' ? SENSOR_NUMBER_FIELDS : LENS_NUMBER_FIELDS
  const clean: Record<string, unknown> = {}
  for (const key of keys) {
    const value = raw[key]
    if (key === 'mount') {
      clean[key] = sanitizeMount(value)
    } else if (numberFields.has(key)) {
      clean[key] = sanitizeNumber(value)
    } else {
      clean[key] = sanitizeString(value)
    }
  }
  return clean
}

export const SENSOR_TOOL = {
  name: 'record_sensor_specs',
  description: 'Record the sensor specifications found in the datasheet text. Use null for anything not stated.',
  input_schema: {
    type: 'object' as const,
    properties: {
      name: { type: ['string', 'null'], description: 'Sensor model name/number, e.g. "Sony IMX264"' },
      opticalFormat: { type: ['string', 'null'], description: 'Legacy optical format, e.g. "2/3\\"" or "1/1.8\\""' },
      widthMm: { type: ['number', 'null'], description: 'Active area width in millimeters' },
      heightMm: { type: ['number', 'null'], description: 'Active area height in millimeters' },
      resolutionH: { type: ['number', 'null'], description: 'Horizontal resolution in pixels' },
      resolutionV: { type: ['number', 'null'], description: 'Vertical resolution in pixels' },
      pixelPitchUm: { type: ['number', 'null'], description: 'Pixel pitch/size in micrometers' },
      mount: { type: ['string', 'null'], enum: [...MOUNT_ENUM, null], description: 'Lens mount type of a camera typically built around this sensor, if stated' },
      cameraInterface: { type: ['string', 'null'], description: 'Camera data interface family, e.g. "USB3 Vision", "GigE Vision" — null if not stated' },
      shutter: { type: ['string', 'null'], description: 'Shutter type as stated, e.g. "global" or "rolling" — null if not stated' },
      fps: { type: ['number', 'null'], description: 'Maximum frame rate in frames per second, if stated' },
      trigger: { type: ['string', 'null'], description: 'Trigger support as stated, e.g. "hardware + software trigger" — null if not stated' },
    },
    required: ['name', 'opticalFormat', 'widthMm', 'heightMm', 'resolutionH', 'resolutionV', 'pixelPitchUm', 'mount', 'cameraInterface', 'shutter', 'fps', 'trigger'],
  },
}

export const LENS_TOOL = {
  name: 'record_lens_specs',
  description: 'Record the lens specifications found in the datasheet text. Use null for anything not stated.',
  input_schema: {
    type: 'object' as const,
    properties: {
      name: { type: ['string', 'null'], description: 'Lens model name/number' },
      focalLengthMm: { type: ['number', 'null'], description: 'Focal length in millimeters (wide end, if zoom)' },
      mount: { type: ['string', 'null'], enum: [...MOUNT_ENUM, null] },
      imageCircleMm: { type: ['number', 'null'], description: 'Image circle diameter in millimeters, or the diameter implied by a stated maximum sensor format' },
      maxAperture: { type: ['number', 'null'], description: 'Maximum aperture as an f-number, e.g. 1.4 for f/1.4' },
      resolvingPowerLpMm: { type: ['number', 'null'], description: 'Rated resolving power in line pairs per millimeter, if stated' },
      modMm: { type: ['number', 'null'], description: 'Minimum object distance (MOD) in millimeters, if stated' },
      distortionPct: { type: ['number', 'null'], description: 'Maximum distortion in percent (signed if stated), if stated' },
      weightG: { type: ['number', 'null'], description: 'Lens weight in grams, if stated' },
      driverNote: { type: ['string', 'null'], description: 'Free-text note about lens driver/control requirements (e.g. focus or iris driver), if stated' },
    },
    required: ['name', 'focalLengthMm', 'mount', 'imageCircleMm', 'maxAperture', 'resolvingPowerLpMm', 'modMm', 'distortionPct', 'weightG', 'driverNote'],
  },
}

const MODEL = 'claude-sonnet-5'
const MAX_INPUT_CHARS = 20000

export const MISSING_API_KEY_MESSAGE =
  'Datasheet extraction is not configured on this server (missing API key). The site owner needs to set ANTHROPIC_API_KEY — meanwhile, please enter the specs manually.'

export function isMissingApiKeyError(err: unknown): boolean {
  if (err instanceof DatasheetError) return err.code === 'MISSING_API_KEY'
  return err instanceof Error && err.message.includes('MISSING_ANTHROPIC_API_KEY')
}

export function toExtractedFields(raw: Record<string, unknown>): Record<string, ExtractedField<unknown>> {
  const result: Record<string, ExtractedField<unknown>> = {}
  for (const key of Object.keys(raw)) {
    const value = raw[key]
    result[key] = { value: value ?? null, found: value !== null && value !== undefined }
  }
  return result
}

export async function extractFieldsFromText(
  text: string,
  kind: ExtractKind,
): Promise<{ kind: 'sensor'; fields: SensorExtractedFields } | { kind: 'lens'; fields: LensExtractedFields }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new DatasheetError('MISSING_API_KEY', 503, MISSING_API_KEY_MESSAGE)
  }

  const client = new Anthropic({ apiKey })
  const tool = kind === 'sensor' ? SENSOR_TOOL : LENS_TOOL
  const truncated = text.slice(0, MAX_INPUT_CHARS)

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    tools: [tool],
    tool_choice: { type: 'tool', name: tool.name },
    messages: [
      {
        role: 'user',
        content: `Here is text extracted from a machine-vision ${kind} datasheet. Extract the specs using the ${tool.name} tool. Only use values explicitly stated in the text — use null rather than guessing or inferring from typical values.\n\n---\n${truncated}\n---`,
      },
    ],
  })

  const toolUse = message.content.find((block) => block.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new DatasheetError(
      'MODEL_NO_TOOL_USE',
      500,
      'The extraction model did not return structured data.',
    )
  }

  const raw = toolUse.input as Record<string, unknown>
  const clean = sanitizeModelOutput(raw, kind)
  if (kind === 'sensor') {
    return { kind: 'sensor', fields: toExtractedFields(clean) as unknown as SensorExtractedFields }
  }
  return { kind: 'lens', fields: toExtractedFields(clean) as unknown as LensExtractedFields }
}
