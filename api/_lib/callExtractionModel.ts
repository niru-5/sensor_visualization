import Anthropic from '@anthropic-ai/sdk'
import type { ExtractKind, LensExtractedFields, SensorExtractedFields } from '../../src/lib/extraction.js'
import type { ExtractedField } from '../../src/lib/types.js'

const MOUNT_ENUM = ['C', 'CS', 'S-mount', 'M12', 'F', 'other']

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
    throw new Error('ANTHROPIC_API_KEY is not configured on the server — see docs/LEARNINGS.md for setup.')
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
    throw new Error('The extraction model did not return structured data.')
  }

  const raw = toolUse.input as Record<string, unknown>
  if (kind === 'sensor') {
    return { kind: 'sensor', fields: toExtractedFields(raw) as unknown as SensorExtractedFields }
  }
  return { kind: 'lens', fields: toExtractedFields(raw) as unknown as LensExtractedFields }
}
