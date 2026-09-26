/**
 * Lens database: mounts M12 (= S-mount) / C / CS / F with image-circle
 * coverage, max sensor format, DIY-vs-industrial flag, and
 * entocentric vs telecentric type (magnification for telecentrics).
 */

export type LensMount = 'M12' | 'C' | 'CS' | 'F';
export type LensType = 'entocentric' | 'telecentric';

export interface LensEntry {
  id: string;
  name: string;
  mount: LensMount;
  lensType: LensType;
  /** Illuminated image circle diameter, mm (datasheet). */
  imageCircleMm: number;
  /** Largest sensor format the circle officially covers, e.g. '2/3"'. */
  maxSensorFormat: string;
  /** True for hobby/embedded lenses with no industrial rating. */
  diyOnly: boolean;
  /** Fixed focal length (entocentric) or telecentric design focal length. */
  focalLengthMm?: number;
  /** Telecentric magnification (e.g. 0.5 = 0.5x). Required for telecentrics. */
  magnification?: number;
  sourceUrl?: string;
  notes: string;
}

export const LENSES: LensEntry[] = [
  {
    id: 'm12-2.8mm-1-3',
    name: 'Generic M12 2.8mm F2.0 (1/3")',
    mount: 'M12',
    lensType: 'entocentric',
    imageCircleMm: 6.0,
    maxSensorFormat: '1/3"',
    diyOnly: true,
    focalLengthMm: 2.8,
    sourceUrl: 'https://docs.arducam.com/Cameras/Lenses/',
    notes: 'Hobby M12/S-mountprime for Arducam/RPi-class 1/3"-1/4" sensors.',
  },
  {
    id: 'm12-8mm-1-2',
    name: 'Arducam M12 8mm F2.0 (1/2")',
    mount: 'M12',
    lensType: 'entocentric',
    imageCircleMm: 8.0,
    maxSensorFormat: '1/2"',
    diyOnly: true,
    focalLengthMm: 8,
    sourceUrl: 'https://docs.arducam.com/Cameras/Lenses/',
    notes: 'Longer M12 prime; still DIY-only, no shock/vibe rating.',
  },
  {
    id: 'c-8mm-2-3',
    name: 'Kowa LM8HC 8mm F1.4 (2/3")',
    mount: 'C',
    lensType: 'entocentric',
    imageCircleMm: 11.0,
    maxSensorFormat: '2/3"',
    diyOnly: false,
    focalLengthMm: 8,
    sourceUrl: 'https://www.kowa-lenses.com/en/machine-vision-lenses',
    notes: 'Industrial C-mount workhorse for 2/3" global-shutter sensors.',
  },
  {
    id: 'c-12mm-1in',
    name: 'Fujinon HF12XA-5M 12mm (1")',
    mount: 'C',
    lensType: 'entocentric',
    imageCircleMm: 16.0,
    maxSensorFormat: '1"',
    diyOnly: false,
    focalLengthMm: 12,
    sourceUrl: 'https://www.fujifilm.com/products/optical_devices/machine-vision/',
    notes: '5MP-rated C-mount covering 1"-type sensors (IMX267/IMX253).',
  },
  {
    id: 'cs-4mm-1-2',
    name: 'RPi 6mm CS wide (1/2"-class)',
    mount: 'CS',
    lensType: 'entocentric',
    imageCircleMm: 8.0,
    maxSensorFormat: '1/2"',
    diyOnly: true,
    focalLengthMm: 6,
    sourceUrl: 'https://www.raspberrypi.com/products/raspberry-pi-high-quality-camera/',
    notes: 'Stock HQ-camera CS lens; DIY-only.',
  },
  {
    id: 'f-50mm-aps',
    name: 'Nikon 50mm F1.8 F-mount (full-frame circle)',
    mount: 'F',
    lensType: 'entocentric',
    imageCircleMm: 43.2,
    maxSensorFormat: '4/3"',
    diyOnly: false,
    focalLengthMm: 50,
    sourceUrl: 'https://www.nikon.com/nikkor/',
    notes: 'Photo F-mount adapted to large-format JAI Apex / Atlas 1"+ sensors.',
  },
  {
    id: 'tc-05x-c',
    name: 'Telecentric 0.5x C-mount (2/3" max)',
    mount: 'C',
    lensType: 'telecentric',
    imageCircleMm: 11.0,
    maxSensorFormat: '2/3"',
    diyOnly: false,
    magnification: 0.5,
    focalLengthMm: 65,
    sourceUrl: 'https://www.edmundoptics.com/c/machine-vision-lenses/1002/',
    notes: 'Measurement-grade telecentric; mag 0.5x, fixed working distance class.',
  },
  {
    id: 'tc-1x-f',
    name: 'Telecentric 1.0x F-mount (1" max)',
    mount: 'F',
    lensType: 'telecentric',
    imageCircleMm: 16.0,
    maxSensorFormat: '1"',
    diyOnly: false,
    magnification: 1.0,
    focalLengthMm: 110,
    sourceUrl: 'https://www.edmundoptics.com/c/machine-vision-lenses/1002/',
    notes: 'Gauging telecentric for 1"-type global-shutter sensors.',
  },
];

const byId = new Map(LENSES.map((l) => [l.id, l]));

export function getLens(id: string): LensEntry | undefined {
  return byId.get(id);
}

export function lensesForMount(mount: LensMount): LensEntry[] {
  return LENSES.filter((l) => l.mount === mount);
}
