/**
 * Camera x software compatibility matrix.
 *
 * VERIFIED = confirmed by vendor docs / SDK release notes (sourceUrl required).
 * NEEDS-VERIFY = plausible but unconfirmed (e.g. third-party support claims,
 * per-model CSI drivers) — the app must surface these as "check datasheet".
 * NOT-SUPPORTED = vendor states incompatibility or protocol mismatch.
 */
import type { CameraFamilyId } from './cameras.ts';

export type SoftwareId =
  | 'pylon'
  | 'spinnaker'
  | 'ids-peak'
  | 'arena'
  | 'jai-sdk'
  | 'mvs'
  | 'v4l2'
  | 'libcamera'
  | 'halcon'
  | 'labview-imaqdx'
  | 'sharpcap'
  | 'micromanager'
  | 'ros';

export type CompatStatus = 'VERIFIED' | 'NEEDS-VERIFY' | 'NOT-SUPPORTED';

export interface CompatEntry {
  family: CameraFamilyId;
  software: SoftwareId;
  status: CompatStatus;
  sourceUrl?: string;
  note: string;
}

export const SOFTWARE_NAMES: Record<SoftwareId, string> = {
  pylon: 'Basler pylon',
  spinnaker: 'Teledyne Spinnaker',
  'ids-peak': 'IDS peak',
  arena: 'Lucid Arena',
  'jai-sdk': 'JAI SDK / eBUS',
  mvs: 'Hikrobot MVS',
  v4l2: 'V4L2 (UVC)',
  libcamera: 'libcamera',
  halcon: 'MVTec HALCON (GenTL)',
  'labview-imaqdx': 'LabVIEW IMAQdx',
  sharpcap: 'SharpCap',
  micromanager: 'Micro-Manager',
  ros: 'ROS / ROS 2 drivers',
};

function v(
  family: CameraFamilyId,
  software: SoftwareId,
  sourceUrl: string,
  note: string,
): CompatEntry {
  return { family, software, status: 'VERIFIED', sourceUrl, note };
}

function nv(family: CameraFamilyId, software: SoftwareId, note: string): CompatEntry {
  return { family, software, status: 'NEEDS-VERIFY', note };
}

function ns(family: CameraFamilyId, software: SoftwareId, note: string): CompatEntry {
  return { family, software, status: 'NOT-SUPPORTED', note };
}

export const COMPAT_MATRIX: CompatEntry[] = [
  // ---- Vendor SDKs (each VERIFIED against its own family) ----
  v('basler-ace', 'pylon', 'https://www.baslerweb.com/en/software/pylon/', 'Native SDK for all Basler ace models.'),
  v('flir-blackfly', 'spinnaker', 'https://www.flir.com/products/spinnaker-sdk/', 'Native SDK for Blackfly S USB3/GigE.'),
  v('ids-ueye', 'ids-peak', 'https://en.ids-imaging.com/ids-peak.html', 'Native SDK for uEye; includes UVC fallback support.'),
  v('lucid-triton-atlas', 'arena', 'https://thinklucid.com/arena-software-development-kit/', 'Native SDK for Triton/Atlas.'),
  v('jai-go', 'jai-sdk', 'https://www.jai.com/support-software/software', 'JAI SDK (eBUS-based) for Go/Go-X/Apex.'),
  v('dahua-hikrobot', 'mvs', 'https://www.hikrobotics.com/en/machinevision/service/download', 'MVS client + SDK for Hikrobot/Dahua.'),
  v('arducam', 'v4l2', 'https://docs.arducam.com/', 'Arducam USB models appear as UVC/V4L2 devices.'),
  v('rpi-hq-gs', 'libcamera', 'https://www.raspberrypi.com/documentation/computers/camera_software.html', 'HQ/GS cameras via libcamera stack.'),

  // ---- HALCON via GenTL (VERIFIED for GenTL-compliant families) ----
  v('basler-ace', 'halcon', 'https://www.baslerweb.com/en/software/pylon/', 'pylon GenTL producer (.cti) loads in HALCON.'),
  v('flir-blackfly', 'halcon', 'https://www.flir.com/products/spinnaker-sdk/', 'Spinnaker GenTL .cti loads in HALCON.'),
  v('ids-ueye', 'halcon', 'https://en.ids-imaging.com/ids-peak.html', 'IDS peak GenTL .cti loads in HALCON.'),
  v('lucid-triton-atlas', 'halcon', 'https://thinklucid.com/arena-software-development-kit/', 'Arena GenTL .cti loads in HALCON.'),
  v('jai-go', 'halcon', 'https://www.jai.com/support-software/software', 'JAI/eBUS GenTL .cti loads in HALCON.'),
  v('dahua-hikrobot', 'halcon', 'https://www.hikrobotics.com/en/machinevision/service/download', 'MVS GenTL .cti loads in HALCON.'),
  ns('arducam', 'halcon', 'No GenTL producer for Arducam UVC/MIPI path.'),
  ns('rpi-hq-gs', 'halcon', 'No GenTL producer for libcamera path.'),

  // ---- LabVIEW IMAQdx (GigE Vision / USB3 Vision certified drivers) ----
  v('basler-ace', 'labview-imaqdx', 'https://www.ni.com/en/support/documentation/compatibility/09/ni-vision---camera-compatibility.html', 'IMAQdx supports Basler GigE/USB3 Vision.'),
  v('flir-blackfly', 'labview-imaqdx', 'https://www.ni.com/en/support/documentation/compatibility/09/ni-vision---camera-compatibility.html', 'IMAQdx supports FLIR GigE/USB3 Vision.'),
  v('ids-ueye', 'labview-imaqdx', 'https://en.ids-imaging.com/ids-peak.html', 'IMAQdx via standard3 Vision; UVC fallback also usable.'),
  v('lucid-triton-atlas', 'labview-imaqdx', 'https://thinklucid.com/arena-software-development-kit/', 'GigE Vision standard — IMAQdx compatible.'),
  v('jai-go', 'labview-imaqdx', 'https://www.jai.com/support-software/software', 'GigE/USB3 Vision standard — IMAQdx compatible.'),
  v('dahua-hikrobot', 'labview-imaqdx', 'https://www.hikrobotics.com/en/machinevision/service/download', 'GigE/USB3 Vision standard — IMAQdx compatible.'),
  ns('arducam', 'labview-imaqdx', 'UVC-only path; IMAQdx USB3 Vision driver does not apply.'),
  ns('rpi-hq-gs', 'labview-imaqdx', 'MIPI/libcamera path not visible to IMAQdx.'),

  // ---- SharpCap (VERIFIED for Basler/FLIR/IDS/UVC per SharpCap camera list) ----
  v('basler-ace', 'sharpcap', 'https://www.sharpcap.co.uk/sharpcap/cameras', 'SharpCap lists Basler (via SDK/GenTL) support.'),
  v('flir-blackfly', 'sharpcap', 'https://www.sharpcap.co.uk/sharpcap/cameras', 'SharpCap lists FLIR/Point Grey support.'),
  v('ids-ueye', 'sharpcap', 'https://www.sharpcap.co.uk/sharpcap/cameras', 'SharpCap lists IDS support.'),
  v('arducam', 'sharpcap', 'https://www.sharpcap.co.uk/sharpcap/cameras', 'Arducam USB models work via generic UVC/DirectShow path.'),
  nv('lucid-triton-atlas', 'sharpcap', 'No vendor-confirmed SharpCap driver for Lucid — verify before recommending.'),
  nv('jai-go', 'sharpcap', 'No vendor-confirmed SharpCap driver for JAI — verify before recommending.'),
  nv('dahua-hikrobot', 'sharpcap', 'Possible via DirectShow/UVC only on select models — verify.'),
  ns('rpi-hq-gs', 'sharpcap', 'SharpCap is Windows-only; RPi MIPI path unsupported.'),

  // ---- Micro-Manager (VERIFIED Basler/IDS/FLIR device adapters) ----
  v('basler-ace', 'micromanager', 'https://micro-manager.org/Device_Support', 'Micro-Manager Basler device adapter (pylon).'),
  v('ids-ueye', 'micromanager', 'https://micro-manager.org/Device_Support', 'Micro-Manager IDS uEye device adapter.'),
  v('flir-blackfly', 'micromanager', 'https://micro-manager.org/Device_Support', 'Micro-Manager FLIR/Spinnaker (FlyCapture/Spinnaker) adapter.'),
  nv('lucid-triton-atlas', 'micromanager', 'No stock Micro-Manager adapter for Lucid — verify / GenTL bridge unconfirmed.'),
  nv('dahua-hikrobot', 'micromanager', 'No stock Micro-Manager adapter for Dahua/Hikrobot — verify.'),
  nv('jai-go', 'micromanager', 'No stock Micro-Manager adapter for JAI — verify.'),
  nv('arducam', 'micromanager', 'UVC generic adapter may work per-model — verify.'),
  ns('rpi-hq-gs', 'micromanager', 'No libcamera adapter in stock Micro-Manager.'),

  // ---- ROS drivers ----
  v('basler-ace', 'ros', 'https://github.com/basler/pylon-ros-camera', 'Official pylon-ros-camera driver.'),
  v('flir-blackfly', 'ros', 'https://github.com/ros-drivers/flir_camera_driver', 'Community flir_camera_driver (Spinnaker).'),
  v('lucid-triton-atlas', 'ros', 'https://github.com/lucid-vision-labs/ros2-arena-sdk', 'Official ros2-arena-sdk driver.'),
  v('arducam', 'ros', 'https://github.com/ArduCAM/MIPI_Camera', 'Arducam ROS wrappers for select MIPI/USB models.'),
  v('rpi-hq-gs', 'ros', 'https://github.com/christianrauch/camera_ros', 'camera_ros libcamera-based node for RPi cameras.'),
  nv('ids-ueye', 'ros', 'Third-party ids_peak ROS wrappers exist — verify against peak version.'),
  nv('jai-go', 'ros', 'No official ROS driver — GenTL bridge unconfirmed, verify.'),
  nv('dahua-hikrobot', 'ros', 'Third-party MVS ROS wrappers exist — verify.'),

  // ---- Jetson CSI: per-model NEEDS-VERIFY (MIPI drivers vary by sensor/ISP) ----
  nv('arducam', 'libcamera', 'Jetson CSI support is per-model (Arducam Jetson bundles) — verify exact SKU + L4T version.'),
  nv('rpi-hq-gs', 'libcamera', 'RPi HQ on Jetson CSI needs third-party driver per model — verify.'),
];

const key = (family: CameraFamilyId, software: SoftwareId): string => `${family}::${software}`;

const byKey = new Map(COMPAT_MATRIX.map((e) => [key(e.family, e.software), e]));

/** First match wins (matrix lists at most one row per pair, except the
 *  deliberate Jetson-CSI NEEDS-VERIFY caveat rows — use allMatches for those). */
export function lookupCompat(family: CameraFamilyId, software: SoftwareId): CompatEntry | undefined {
  return byKey.get(key(family, software));
}

export function allMatches(family: CameraFamilyId, software: SoftwareId): CompatEntry[] {
  return COMPAT_MATRIX.filter((e) => e.family === family && e.software === software);
}

export function verifiedFor(software: SoftwareId): CompatEntry[] {
  return COMPAT_MATRIX.filter((e) => e.software === software && e.status === 'VERIFIED');
}
