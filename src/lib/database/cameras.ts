/**
 * Machine-vision camera family database.
 *
 * 8 families covering the mainstream industrial + DIY range. Each family
 * lists representative sensor formats, host interfaces, shutter options and
 * the vendor SDK used to talk to it. Values are typical catalogue ranges
 * (not exhaustive per-model listings) — enough for compatibility checks.
 */
import type { CameraInterface, MountType, ShutterType } from '../types.ts';

export type CameraFamilyId =
  | 'basler-ace'
  | 'flir-blackfly'
  | 'ids-ueye'
  | 'lucid-triton-atlas'
  | 'jai-go'
  | 'dahua-hikrobot'
  | 'arducam'
  | 'rpi-hq-gs';

export interface CameraModelEntry {
  id: string;
  name: string;
  /** Nominal optical format, e.g. '2/3"' — display / coverage-check input. */
  sensorFormat: string;
  /** Actual sensor diagonal in mm (datasheet active-area diagonal). */
  sensorDiagonalMm: number;
  interfaces: CameraInterface[];
  shutter: ShutterType;
  mounts: MountType[];
  /** Max resolution class, MP (approx, for filtering). */
  megapixels: number;
}

export interface SdkInfo {
  name: string;
  url: string;
}

export interface CameraFamily {
  id: CameraFamilyId;
  vendor: string;
  displayName: string;
  models: CameraModelEntry[];
  sdk: SdkInfo;
  genTlCompliant: boolean;
  uvcClassCompliant: boolean;
  /** Sealed / IP-rated variants exist for washdown duty? */
  sealedVariant?: string;
  notes: string;
}

export const CAMERA_FAMILIES: CameraFamily[] = [
  {
    id: 'basler-ace',
    vendor: 'Basler',
    displayName: 'Basler ace (GigE / USB3)',
    models: [
      {
        id: 'ace-imx273',
        name: 'ace acA1440-220um (IMX273)',
        sensorFormat: '1/2.9"',
        sensorDiagonalMm: 6.23,
        interfaces: ['USB3'],
        shutter: 'global',
        mounts: ['C'],
        megapixels: 1.6,
      },
      {
        id: 'ace-imx264',
        name: 'ace acA2440-20gm (IMX264)',
        sensorFormat: '2/3"',
        sensorDiagonalMm: 11.0,
        interfaces: ['GigE'],
        shutter: 'global',
        mounts: ['C'],
        megapixels: 5.0,
      },
      {
        id: 'ace-imx267',
        name: 'ace acA4096-30um (IMX267)',
        sensorFormat: '1"',
        sensorDiagonalMm: 15.86,
        interfaces: ['USB3'],
        shutter: 'global',
        mounts: ['C'],
        megapixels: 9.0,
      },
      {
        id: 'ace-imx183-rs',
        name: 'ace acA5472-17uc (IMX183, rolling)',
        sensorFormat: '1"',
        sensorDiagonalMm: 15.86,
        interfaces: ['USB3', 'GigE'],
        shutter: 'rolling',
        mounts: ['C'],
        megapixels: 20.0,
      },
    ],
    sdk: { name: 'Basler pylon', url: 'https://www.baslerweb.com/en/software/pylon/' },
    genTlCompliant: true,
    uvcClassCompliant: false,
    sealedVariant: 'ace IP67 splash-proof housing variants',
    notes: 'USB3 Vision and GigE Vision; NOT UVC — requires pylon or GenTL consumer.',
  },
  {
    id: 'flir-blackfly',
    vendor: 'Teledyne FLIR',
    displayName: 'FLIR / Teledyne Blackfly S',
    models: [
      {
        id: 'bfs-imx273',
        name: 'Blackfly S BFS-U3-16S2M (IMX273)',
        sensorFormat: '1/2.9"',
        sensorDiagonalMm: 6.23,
        interfaces: ['USB3'],
        shutter: 'global',
        mounts: ['C', 'CS'],
        megapixels: 1.6,
      },
      {
        id: 'bfs-imx264',
        name: 'Blackfly S BFS-PGE-50S5M (IMX264)',
        sensorFormat: '2/3"',
        sensorDiagonalMm: 11.0,
        interfaces: ['GigE'],
        shutter: 'global',
        mounts: ['C', 'CS'],
        megapixels: 5.0,
      },
      {
        id: 'bfs-imx253',
        name: 'Blackfly S BFS-U3-89S6C (IMX253, 1.1")',
        sensorFormat: '1"',
        sensorDiagonalMm: 17.6,
        interfaces: ['USB3'],
        shutter: 'global',
        mounts: ['C'],
        megapixels: 8.9,
      },
    ],
    sdk: { name: 'Teledyne Spinnaker SDK', url: 'https://www.flir.com/products/spinnaker-sdk/' },
    genTlCompliant: true,
    uvcClassCompliant: false,
    sealedVariant: 'Blackfly S board-level + sealed case options (no full IP67 catalogue)',
    notes: 'USB3 Vision / GigE Vision; Spinnaker (GenTL). No UVC mode.',
  },
  {
    id: 'ids-ueye',
    vendor: 'IDS Imaging',
    displayName: 'IDS uEye (UI-3000 / GVCP)',
    models: [
      {
        id: 'ueye-imx273',
        name: 'uEye UI-3270LE (IMX273)',
        sensorFormat: '1/2.9"',
        sensorDiagonalMm: 6.23,
        interfaces: ['USB3'],
        shutter: 'global',
        mounts: ['C', 'CS', 'S-mount'],
        megapixels: 1.6,
      },
      {
        id: 'ueye-imx265',
        name: 'uEye UI-3080CP (IMX265)',
        sensorFormat: '1/1.8"',
        sensorDiagonalMm: 8.93,
        interfaces: ['USB3'],
        shutter: 'global',
        mounts: ['C', 'CS'],
        megapixels: 3.2,
      },
      {
        id: 'ueye-gige-imx264',
        name: 'uEye GV-5000CP (IMX264)',
        sensorFormat: '2/3"',
        sensorDiagonalMm: 11.0,
        interfaces: ['GigE'],
        shutter: 'global',
        mounts: ['C'],
        megapixels: 5.0,
      },
    ],
    sdk: { name: 'IDS peak', url: 'https://en.ids-imaging.com/ids-peak.html' },
    genTlCompliant: true,
    uvcClassCompliant: true,
    sealedVariant: 'uEye FA (IP65/67) rugged series',
    notes: 'U3V/GigE Vision via IDS peak; many USB models also offer a UVC fallback mode.',
  },
  {
    id: 'lucid-triton-atlas',
    vendor: 'Lucid Vision Labs',
    displayName: 'Lucid Triton / Atlas',
    models: [
      {
        id: 'triton-imx273',
        name: 'Triton TRI032S (IMX273)',
        sensorFormat: '1/2.9"',
        sensorDiagonalMm: 6.23,
        interfaces: ['GigE'],
        shutter: 'global',
        mounts: ['C', 'CS'],
        megapixels: 1.6,
      },
      {
        id: 'atlas-imx267',
        name: 'Atlas ATL4096M (IMX267)',
        sensorFormat: '1"',
        sensorDiagonalMm: 15.86,
        interfaces: ['GigE'],
        shutter: 'global',
        mounts: ['C', 'F'],
        megapixels: 9.0,
      },
      {
        id: 'triton-5g-imx183',
        name: 'Triton 5GigE TRI2048 (IMX183, rolling)',
        sensorFormat: '1"',
        sensorDiagonalMm: 15.86,
        interfaces: ['GigE'],
        shutter: 'rolling',
        mounts: ['C'],
        megapixels: 20.0,
      },
    ],
    sdk: { name: 'Lucid Arena SDK', url: 'https://thinklucid.com/arena-software-development-kit/' },
    genTlCompliant: true,
    uvcClassCompliant: false,
    sealedVariant: 'Triton IP67 sealed housing (factory-sealed GigE)',
    notes: 'GigE Vision incl. 5GigE; Arena SDK (GenTL). Factory IP67 Triton option.',
  },
  {
    id: 'jai-go',
    vendor: 'JAI',
    displayName: 'JAI Go / Go-X',
    models: [
      {
        id: 'go-imx273',
        name: 'Go-X GOX-1602M (IMX273)',
        sensorFormat: '1/2.9"',
        sensorDiagonalMm: 6.23,
        interfaces: ['GigE', 'USB3'],
        shutter: 'global',
        mounts: ['C'],
        megapixels: 1.6,
      },
      {
        id: 'go-imx264',
        name: 'Go-X GOX-5103M (IMX264)',
        sensorFormat: '2/3"',
        sensorDiagonalMm: 11.0,
        interfaces: ['GigE', 'USB3'],
        shutter: 'global',
        mounts: ['C'],
        megapixels: 5.0,
      },
      {
        id: 'go-cxp',
        name: 'Apex APX-3600M (CoaXPress, 1")',
        sensorFormat: '1"',
        sensorDiagonalMm: 15.86,
        interfaces: ['CoaXPress'],
        shutter: 'global',
        mounts: ['C', 'F'],
        megapixels: 9.0,
      },
    ],
    sdk: { name: 'JAI SDK / eBUS (Pleora)', url: 'https://www.jai.com/support-software/software' },
    genTlCompliant: true,
    uvcClassCompliant: false,
    sealedVariant: 'Go-X IP67 variants on request',
    notes: 'GigE Vision / USB3 Vision / CoaXPress; GenTL via JAI SDK or eBUS.',
  },
  {
    id: 'dahua-hikrobot',
    vendor: 'Dahua / Hikrobot (Hikvision)',
    displayName: 'Dahua / Hikrobot industrial',
    models: [
      {
        id: 'dahua-imx273',
        name: 'Dahua A3A10MG8 (IMX273)',
        sensorFormat: '1/2.9"',
        sensorDiagonalMm: 6.23,
        interfaces: ['GigE'],
        shutter: 'global',
        mounts: ['C'],
        megapixels: 1.6,
      },
      {
        id: 'hikrobot-imx264',
        name: 'Hikrobot MV-CA050-10GM (IMX264)',
        sensorFormat: '2/3"',
        sensorDiagonalMm: 11.0,
        interfaces: ['GigE'],
        shutter: 'global',
        mounts: ['C'],
        megapixels: 5.0,
      },
      {
        id: 'hikrobot-usb-imx265',
        name: 'Hikrobot MV-CU030-10UC (IMX265, rolling option)',
        sensorFormat: '1/1.8"',
        sensorDiagonalMm: 8.93,
        interfaces: ['USB3'],
        shutter: 'rolling',
        mounts: ['C'],
        megapixels: 3.2,
      },
    ],
    sdk: { name: 'Hikrobot MVS SDK', url: 'https://www.hikrobotics.com/en/machinevision/service/download' },
    genTlCompliant: true,
    uvcClassCompliant: false,
    sealedVariant: 'Hikrobot waterproof (IP67) series',
    notes: 'GigE Vision / USB3 Vision; MVS client + GenTL .cti for HALCON etc.',
  },
  {
    id: 'arducam',
    vendor: 'Arducam',
    displayName: 'Arducam (DIY / embedded)',
    models: [
      {
        id: 'arducam-imx477m',
        name: 'Arducam 12MP IMX477 (HQ-class)',
        sensorFormat: '1/2.3"',
        sensorDiagonalMm: 7.66,
        interfaces: ['MIPI', 'USB3'],
        shutter: 'rolling',
        mounts: ['CS', 'S-mount'],
        megapixels: 12.3,
      },
      {
        id: 'arducam-ov9281',
        name: 'Arducam OV9281 global-shutter mono',
        sensorFormat: '1/4"',
        sensorDiagonalMm: 4.5,
        interfaces: ['MIPI', 'USB3'],
        shutter: 'global',
        mounts: ['S-mount', 'CS'],
        megapixels: 1.0,
      },
      {
        id: 'arducam-imx296gs',
        name: 'Arducam IMX296 global-shutter',
        sensorFormat: '1/2.9"',
        sensorDiagonalMm: 6.23,
        interfaces: ['MIPI', 'USB3'],
        shutter: 'global',
        mounts: ['CS', 'S-mount'],
        megapixels: 1.6,
      },
    ],
    sdk: { name: 'V4L2 / libcamera / UVC', url: 'https://docs.arducam.com/' },
    genTlCompliant: false,
    uvcClassCompliant: true,
    notes: 'DIY-grade: MIPI CSI (Jetson/RPi per-model drivers) or UVC USB. No GenTL, no IP rating.',
  },
  {
    id: 'rpi-hq-gs',
    vendor: 'Raspberry Pi',
    displayName: 'Raspberry Pi HQ / Global Shutter',
    models: [
      {
        id: 'rpi-hq-imx477',
        name: 'Raspberry Pi HQ Camera (IMX477)',
        sensorFormat: '1/2.3"',
        sensorDiagonalMm: 7.66,
        interfaces: ['MIPI'],
        shutter: 'rolling',
        mounts: ['C', 'CS'],
        megapixels: 12.3,
      },
      {
        id: 'rpi-gs-imx296',
        name: 'Raspberry Pi Global Shutter (IMX296)',
        sensorFormat: '1/2.9"',
        sensorDiagonalMm: 6.23,
        interfaces: ['MIPI'],
        shutter: 'global',
        mounts: ['C', 'CS'],
        megapixels: 1.6,
      },
    ],
    sdk: { name: 'libcamera / Picamera2', url: 'https://www.raspberrypi.com/documentation/computers/camera_software.html' },
    genTlCompliant: false,
    uvcClassCompliant: false,
    notes: 'DIY-grade: MIPI CSI-2 only, libcamera stack. Jetson CSI support is per-model (NEEDS-VERIFY).',
  },
];

const byId = new Map(CAMERA_FAMILIES.map((f) => [f.id, f]));

export function getCameraFamily(id: CameraFamilyId): CameraFamily | undefined {
  return byId.get(id);
}

export function allCameraModels(): Array<CameraModelEntry & { familyId: CameraFamilyId }> {
  return CAMERA_FAMILIES.flatMap((f) => f.models.map((m) => ({ ...m, familyId: f.id })));
}
