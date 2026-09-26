/**
 * Track VIZ — shutter-blur / rolling-skew readout stripe for the shared view.
 *
 * Shows, per camera slot, how far the target smears during exposure
 * (motion blur `blur = v · t_exp`) and — for rolling-shutter sensors —
 * how far it skews during frame readout (`skew = v · T_readout`).
 *
 * The numbers come from `src/lib/shutter.ts` (`shutterOverlayInfo`); when
 * Track OPTICS lands a fuller shutter module, rewire that lib module and
 * this component keeps working — there is no hard dep beyond the
 * `ShutterOverlayInfo` shape.
 *
 * Graceful fallback: velocity/exposure inputs are optional (the center
 * stage has no velocity control yet — Track UI owns that). With no motion
 * input the stripe is hidden and only a shutter-type chip renders.
 * Never blocks rendering.
 */
import { Html } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { shutterOverlayInfo } from '../lib/shutter'
import type { ShutterMotionInput, ShutterOverlayStatus } from '../lib/shutter'
import type { Sensor } from '../lib/types'

const STATUS_BG: Record<ShutterOverlayStatus, string> = {
  pass: '#22c55e',
  warn: '#fbbf24',
  fail: '#f87171',
  unknown: '#94a3b8',
}

interface ShutterOverlayProps {
  sensor: Pick<Sensor, 'shutter'>
  /** Footprint size (mm) — the stripe spans the footprint width. */
  fovHmm: number
  fovVmm: number
  /** Footprint plane depth (optical axis +Z, apex at origin). */
  workingDistanceMm: number
  /** GSD in mm/px for pass/warn/fail bucketing (from the pixel-grid spec). */
  pixelSizeMm?: number | null
  /** Per-camera palette color (slotColor), never a risk color. */
  color: string
  /** Slot index — staggers the chip so overlapping footprints stay readable. */
  index?: number
  motion?: ShutterMotionInput
}

/**
 * Blur/skew readout stripe: a thin translucent band along the footprint's
 * bottom edge whose width encodes the blur extent, plus an Html chip with
 * the blur/skew numbers. Renders inside the slot's frustum group so Track A
 * visibility toggles hide it with its parent. Renders null when the
 * footprint is invalid; renders the advisory chip when motion input is
 * missing.
 */
export function ShutterOverlay({
  sensor,
  fovHmm,
  fovVmm,
  workingDistanceMm,
  pixelSizeMm,
  color,
  index = 0,
  motion = {},
}: ShutterOverlayProps) {
  const info = useMemo(
    () => shutterOverlayInfo(sensor.shutter, pixelSizeMm, motion),
    [sensor.shutter, pixelSizeMm, motion],
  )

  const stripeGeometry = useMemo(() => {
    if (info.blurMm == null || !Number.isFinite(fovHmm) || !Number.isFinite(fovVmm) || fovHmm <= 0 || fovVmm <= 0) {
      return null
    }
    // Stripe width = blur extent clamped to the footprint width so a huge
    // blur doesn't paint past the frustum; height is a thin band.
    const w = Math.min(info.blurMm + (info.skewMm ?? 0), fovHmm)
    const h = Math.max(fovVmm * 0.04, 1)
    const geom = new THREE.PlaneGeometry(Math.max(w, 0.5), h)
    // Anchor the stripe's left edge at the footprint's left edge (motion +X).
    geom.translate(-fovHmm / 2 + Math.max(w, 0.5) / 2, -fovVmm / 2 + h / 2, 0.5)
    return geom
  }, [info.blurMm, info.skewMm, fovHmm, fovVmm])

  useEffect(() => () => stripeGeometry?.dispose(), [stripeGeometry])

  if (!Number.isFinite(fovHmm) || !Number.isFinite(fovVmm) || fovHmm <= 0 || fovVmm <= 0) return null

  const staggerMm = index * 26
  const chipY = -fovVmm / 2 - Math.max(30, fovVmm * 0.08) - staggerMm

  return (
    <group position={[0, 0, workingDistanceMm]}>
      {stripeGeometry && (
        <mesh geometry={stripeGeometry}>
          <meshBasicMaterial color={color} transparent opacity={0.45} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}
      <Html position={[0, chipY, 0]} center distanceFactor={Math.max(workingDistanceMm, 200)}>
        <div
          className="rounded px-2 py-1 text-[11px] whitespace-nowrap text-slate-900 shadow-lg"
          style={{ backgroundColor: STATUS_BG[info.status] }}
          title={info.message}
        >
          S{index + 1} ⏱ {info.label}
        </div>
      </Html>
    </group>
  )
}

export default ShutterOverlay
