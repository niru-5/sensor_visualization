/**
 * Legacy "optical format" (Type) notation — e.g. 1/2.5", 2/3", 1" — is a
 * vidicon-tube-era convention where the quoted inch figure is roughly 1.5x
 * the sensor's actual diagonal, not a literal measurement. Machine-vision
 * datasheets almost universally quote this instead of mm dimensions, so we
 * need a lookup table to convert.
 *
 * Values sourced from the widely-cited reference table (validated against
 * real datasheets during seeding, e.g. Sony IMX264's 2/3" listing matches
 * an 11.0mm diagonal, IMX267's 1" listing matches ~16.1mm diagonal):
 * https://machinevisiondirect.com/pages/image-sensor-formats
 *
 * Caveat: "1-inch" is ambiguous. This table uses the 4:3 machine-vision
 * convention (13.2 x 8.8mm here follows the 3:2 photography convention
 * actually — some industrial 1"-type sensors are 4:3 and quote slightly
 * different mm dimensions for the same nominal format). When a datasheet
 * gives explicit mm dimensions, always prefer those over this table.
 */
export interface OpticalFormatEntry {
  format: string
  diagonalMm: number
  widthMm: number
  heightMm: number
}

export const OPTICAL_FORMAT_TABLE: OpticalFormatEntry[] = [
  { format: '1/10"', diagonalMm: 1.6, widthMm: 1.28, heightMm: 0.96 },
  { format: '1/8"', diagonalMm: 2.0, widthMm: 1.6, heightMm: 1.2 },
  { format: '1/6"', diagonalMm: 3.0, widthMm: 2.4, heightMm: 1.8 },
  { format: '1/4"', diagonalMm: 4.5, widthMm: 3.6, heightMm: 2.7 },
  { format: '1/3.6"', diagonalMm: 5.0, widthMm: 4.0, heightMm: 3.0 },
  { format: '1/3.2"', diagonalMm: 5.68, widthMm: 4.54, heightMm: 3.42 },
  { format: '1/3"', diagonalMm: 6.0, widthMm: 4.8, heightMm: 3.6 },
  { format: '1/2.9"', diagonalMm: 6.23, widthMm: 4.98, heightMm: 3.74 },
  { format: '1/2.7"', diagonalMm: 6.72, widthMm: 5.37, heightMm: 4.04 },
  { format: '1/2.5"', diagonalMm: 7.18, widthMm: 5.76, heightMm: 4.29 },
  { format: '1/2.3"', diagonalMm: 7.66, widthMm: 6.17, heightMm: 4.55 },
  { format: '1/2"', diagonalMm: 8.0, widthMm: 6.4, heightMm: 4.8 },
  { format: '1/1.8"', diagonalMm: 8.93, widthMm: 7.18, heightMm: 5.32 },
  { format: '1/1.7"', diagonalMm: 9.5, widthMm: 7.6, heightMm: 5.7 },
  { format: '2/3"', diagonalMm: 11.0, widthMm: 8.8, heightMm: 6.6 },
  { format: '1"', diagonalMm: 15.86, widthMm: 13.2, heightMm: 8.8 },
  { format: '4/3"', diagonalMm: 21.6, widthMm: 17.3, heightMm: 13.0 },
]

const byFormat = new Map(OPTICAL_FORMAT_TABLE.map((e) => [normalize(e.format), e]))

function normalize(format: string): string {
  return format.trim().toLowerCase().replace(/\s+/g, '').replace(/["”″]/g, '')
}

/** Returns width/height in mm for a known optical format string, or null if unrecognized. */
export function opticalFormatToMm(format: string): { widthMm: number; heightMm: number } | null {
  const entry = byFormat.get(normalize(format))
  return entry ? { widthMm: entry.widthMm, heightMm: entry.heightMm } : null
}
