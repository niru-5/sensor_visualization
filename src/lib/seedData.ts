import type { Lens, Sensor } from './types'

/**
 * Small, hand-picked starter set of real machine-vision sensors and lenses
 * so the app isn't empty on first use (requirements.md §3.1 / §7). Every
 * entry below is sourced from a public datasheet or vendor spec page —
 * nothing here is guessed. Active area (widthMm/heightMm) is computed from
 * resolution x pixel pitch where the datasheet gives pixel pitch rather
 * than mm directly; that computation is cross-checked against the
 * datasheet's quoted diagonal in optics.test.ts.
 *
 * Sources:
 * - Sony IMX264: https://www.sony-semicon.com/files/62/flyer_industry/IMX264_265_Flyer.pdf
 * - Sony IMX178: https://www.sony-semicon.com/files/62/flyer_security/IMX178LQJ_Flyer.pdf
 * - Sony IMX267: https://framos.com/products/sensors/area-sensors/imx267llr-c-19179/
 * - Sony IMX392: https://www.sony-semicon.com/files/62/flyer_industry/IMX392LQR_Flyer.pdf
 * - Computar V1226-MPZ: https://graftek.com/product/computar-v1226-mpz-12mm-1-in-format-o-16-mm-image-circle-c-mount-visible-to-nir-lens-f-2-6-m-o-d-100-mm-with-manual-focus-and-manual-iris/
 * - Commonlands CIL532 (12mm, 2/3"): https://commonlands.com/products/12mm-cmount-lens-cil532
 * - Commonlands CIL525 (25mm, 2/3", rated for IMX264): https://commonlands.com/products/25mm-c-mount-lens-5mp-cil525
 * - Commonlands CIL060 (6mm, M12/S-mount): https://commonlands.com/products/portrait-6mm-m12-lens
 *
 * Mount type on each seed sensor reflects a *typical* camera body built
 * around that sensor (e.g. most 2/3" IMX264 industrial cameras ship
 * C-mount) — the sensor chip itself doesn't have a mount, the camera body
 * does, but the data model tracks it on the sensor entry since that's the
 * unit being compared against a lens (see requirements.md §4).
 */
export const SEED_SENSORS: Sensor[] = [
  {
    id: 'seed-sensor-imx264',
    name: 'Sony IMX264 (2464 x 2056, 2/3")',
    opticalFormat: '2/3"',
    widthMm: 8.4996,
    heightMm: 7.0932,
    resolutionH: 2464,
    resolutionV: 2056,
    pixelPitchUm: 3.45,
    mount: 'C',
    source: 'seed',
    sourceUrl: 'https://www.sony-semicon.com/files/62/flyer_industry/IMX264_265_Flyer.pdf',
  },
  {
    id: 'seed-sensor-imx178',
    name: 'Sony IMX178 (3096 x 2080, 1/1.8")',
    opticalFormat: '1/1.8"',
    widthMm: 7.4304,
    heightMm: 4.992,
    resolutionH: 3096,
    resolutionV: 2080,
    pixelPitchUm: 2.4,
    mount: 'CS',
    source: 'seed',
    sourceUrl: 'https://www.sony-semicon.com/files/62/flyer_security/IMX178LQJ_Flyer.pdf',
  },
  {
    id: 'seed-sensor-imx267',
    name: 'Sony IMX267 (4112 x 2176, 1")',
    opticalFormat: '1"',
    widthMm: 14.1864,
    heightMm: 7.5072,
    resolutionH: 4112,
    resolutionV: 2176,
    pixelPitchUm: 3.45,
    mount: 'C',
    source: 'seed',
    sourceUrl: 'https://framos.com/products/sensors/area-sensors/imx267llr-c-19179/',
  },
  {
    id: 'seed-sensor-imx392',
    name: 'Sony IMX392 (1920 x 1200, 1/2.3")',
    opticalFormat: '1/2.3"',
    widthMm: 6.624,
    heightMm: 4.14,
    resolutionH: 1920,
    resolutionV: 1200,
    pixelPitchUm: 3.45,
    mount: 'C',
    source: 'seed',
    sourceUrl: 'https://www.sony-semicon.com/files/62/flyer_industry/IMX392LQR_Flyer.pdf',
  },
]

export const SEED_LENSES: Lens[] = [
  {
    id: 'seed-lens-computar-v1226mpz',
    name: 'Computar V1226-MPZ (12mm, 1")',
    focalLengthMm: 12,
    mount: 'C',
    imageCircleMm: 16.0,
    maxAperture: 2.6,
    source: 'seed',
    sourceUrl:
      'https://graftek.com/product/computar-v1226-mpz-12mm-1-in-format-o-16-mm-image-circle-c-mount-visible-to-nir-lens-f-2-6-m-o-d-100-mm-with-manual-focus-and-manual-iris/',
  },
  {
    id: 'seed-lens-commonlands-cil532',
    name: 'Commonlands CIL532 (12mm, 2/3")',
    focalLengthMm: 12,
    mount: 'C',
    imageCircleMm: 11.1,
    maxAperture: 2.0,
    source: 'seed',
    sourceUrl: 'https://commonlands.com/products/12mm-cmount-lens-cil532',
  },
  {
    id: 'seed-lens-commonlands-cil525',
    name: 'Commonlands CIL525 (25mm, 2/3", rated for IMX264)',
    focalLengthMm: 25,
    mount: 'C',
    imageCircleMm: 12.8,
    maxAperture: 1.4,
    source: 'seed',
    sourceUrl: 'https://commonlands.com/products/25mm-c-mount-lens-5mp-cil525',
  },
  {
    id: 'seed-lens-commonlands-cil060',
    name: 'Commonlands CIL060 (6mm, M12/S-mount)',
    focalLengthMm: 6,
    mount: 'M12',
    imageCircleMm: 9.0,
    maxAperture: 2.8,
    source: 'seed',
    sourceUrl: 'https://commonlands.com/products/portrait-6mm-m12-lens',
  },
]
