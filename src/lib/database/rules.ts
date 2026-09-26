/**
 * Compatibility rules: optical coverage, interface/cabling limits,
 * USB SDK discipline, and environment (DIY vs manufacturing washdown).
 */
import type { CameraFamilyId } from './cameras.ts';
import type { CameraInterface } from '../types.ts';

// ---------- Optical coverage ----------

export interface CoverageResult {
  pass: boolean;
  marginMm: number;
  message: string;
}

/** Lens image circle must cover the sensor diagonal (margin >= 0 passes). */
export function coverageCheck(lensCircleMm: number, sensorDiagonalMm: number): CoverageResult {
  const marginMm = lensCircleMm - sensorDiagonalMm;
  const pass = marginMm >= 0;
  return {
    pass,
    marginMm,
    message: pass
      ? `PASS: ${lensCircleMm}mm image circle covers ${sensorDiagonalMm}mm sensor (margin ${marginMm.toFixed(2)}mm).`
      : `FAIL: ${lensCircleMm}mm image circle vignettes on ${sensorDiagonalMm}mm sensor (shortfall ${(-marginMm).toFixed(2)}mm).`,
  };
}

// ---------- Interface / cable limits ----------

export interface InterfaceResult {
  pass: boolean;
  maxLengthM: number;
  message: string;
}

/** Conservative passive-cable limits used for recommendations. */
export const INTERFACE_LIMITS_M: Record<string, number> = {
  USB3: 5,
  GigE: 100,
  MIPI: 0.3,
  CoaXPress: 100,
  CameraLink: 10,
};

export function interfaceCheck(iface: CameraInterface, cableLengthM: number): InterfaceResult {
  const maxLengthM = INTERFACE_LIMITS_M[iface] ?? Number.NaN;
  if (Number.isNaN(maxLengthM)) {
    return { pass: false, maxLengthM, message: `FAIL: unknown interface "${iface}" — verify datasheet.` };
  }
  const pass = cableLengthM <= maxLengthM;
  return {
    pass,
    maxLengthM,
    message: pass
      ? `PASS: ${cableLengthM}m ${iface} link within ${maxLengthM}m limit.`
      : `FAIL: ${cableLengthM}m exceeds ${iface} passive limit of ${maxLengthM}m — use active/optical extension or switch interface.`,
  };
}

// ---------- USB SDK discipline ----------

export interface SdkResult {
  ok: boolean;
  message: string;
}

/**
 * USB3 Vision cameras are NOT UVC webcams: they need the vendor SDK
 * (pylon/Spinnaker/Peak/Arena/...) or a GenTL consumer. Only devices the
 * family flags as UVC-capable may use generic V4L2/DirectShow paths.
 */
export function usbSdkRule(iface: CameraInterface, isUvcDevice: boolean, sdkName: string): SdkResult {
  if (iface === 'USB3' && !isUvcDevice) {
    return {
      ok: true,
      message: `SDK REQUIRED: USB3 Vision device — use ${sdkName} (or GenTL consumer). Generic UVC drivers will NOT enumerate it.`,
    };
  }
  if (isUvcDevice) {
    return { ok: true, message: 'UVC device — generic V4L2/DirectShow path OK; vendor SDK optional.' };
  }
  return { ok: true, message: `${iface} link — use ${sdkName} (GenTL where applicable).` };
}

// ---------- Environment rating ----------

export type EnvRequirement = 'DIY' | 'IP65' | 'IP67' | 'IP69K';
export type EnvVerdict = 'OK' | 'NEEDS-SEALED-VARIANT' | 'NOT-SUITABLE';

export interface EnvResult {
  verdict: EnvVerdict;
  message: string;
}

/** Rank so IP69K > IP67 > IP65 > DIY. */
const ENV_RANK: Record<EnvRequirement, number> = { DIY: 0, IP65: 1, IP67: 2, IP69K: 3 };

/** Best factory rating available per family (DIY families have none). */
export const FAMILY_ENV_RATING: Record<CameraFamilyId, EnvRequirement> = {
  'basler-ace': 'IP67',
  'flir-blackfly': 'DIY',
  'ids-ueye': 'IP67',
  'lucid-triton-atlas': 'IP67',
  'jai-go': 'IP67',
  'dahua-hikrobot': 'IP67',
  arducam: 'DIY',
  'rpi-hq-gs': 'DIY',
};

export const FAMILY_SEALED_VARIANT: Record<CameraFamilyId, string | null> = {
  'basler-ace': 'ace IP67 splash-proof housing variants',
  'flir-blackfly': null,
  'ids-ueye': 'uEye FA (IP65/67) rugged series',
  'lucid-triton-atlas': 'Triton IP67 factory-sealed housing',
  'jai-go': 'Go-X IP67 variants on request',
  'dahua-hikrobot': 'Hikrobot waterproof (IP67) series',
  arducam: null,
  'rpi-hq-gs': null,
};

/**
 * Decide whether a camera family can serve an environment requirement.
 * - DIY requirement: everything is OK.
 * - Rated requirement met by the family's sealed variant: OK.
 * - Rated requirement with a sealed variant available but base model
 *   unsealed: NEEDS-SEALED-VARIANT (caller must pick the sealed SKU).
 * - Rated requirement with no sealed variant: NOT-SUITABLE.
 */
export function environmentRating(
  family: CameraFamilyId,
  required: EnvRequirement,
  usingSealedVariant: boolean,
): EnvResult {
  if (required === 'DIY') {
    return { verdict: 'OK', message: 'DIY/bench use — any family acceptable.' };
  }
  const best = FAMILY_ENV_RATING[family];
  if (ENV_RANK[best] < ENV_RANK[required]) {
    return {
      verdict: 'NOT-SUITABLE',
      message: `${family}: best factory rating ${best} cannot meet ${required}; choose a sealed industrial family.`,
    };
  }
  if (usingSealedVariant) {
    return { verdict: 'OK', message: `${family}: sealed variant meets ${required}.` };
  }
  const variant = FAMILY_SEALED_VARIANT[family];
  return {
    verdict: 'NEEDS-SEALED-VARIANT',
    message: `${family}: base model unsealed — order sealed variant (${variant}) for ${required}.`,
  };
}
