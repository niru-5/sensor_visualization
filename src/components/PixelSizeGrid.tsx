import { Html } from '@react-three/drei'
import { memo, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { cameraColorForIndex, computePixelGrid } from '../lib/pixelGrid'

interface PixelSizeGridProps {
  fovHmm: number
  fovVmm: number
  resolutionH: number
  resolutionV: number
  /** Footprint plane depth (optical axis +Z, apex at origin). */
  workingDistanceMm: number
  focalLengthMm?: number
  /** Palette slot; falls back to the shared palette via local helper. */
  cameraIndex?: number
  /** Explicit color override (wins over cameraIndex). */
  color?: string
  /** Max rendered cells per axis (default 40). */
  maxCells?: number
  /** Contour emphasis interval override (defaults from grid density). */
  contourEvery?: number
  /** Show the mm/px badge in the corner cell (default true). */
  showLabels?: boolean
}

function buildGridGeometry(cols: number, rows: number, wMm: number, hMm: number): THREE.BufferGeometry {
  const hw = wMm / 2
  const hh = hMm / 2
  const points: THREE.Vector3[] = []
  for (let c = 0; c <= cols; c++) {
    const x = -hw + (wMm * c) / cols
    points.push(new THREE.Vector3(x, -hh, 0), new THREE.Vector3(x, hh, 0))
  }
  for (let r = 0; r <= rows; r++) {
    const y = -hh + (hMm * r) / rows
    points.push(new THREE.Vector3(-hw, y, 0), new THREE.Vector3(hw, y, 0))
  }
  return new THREE.BufferGeometry().setFromPoints(points)
}

function buildContourGeometry(
  cols: number,
  rows: number,
  wMm: number,
  hMm: number,
  every: number,
): THREE.BufferGeometry | null {
  if (every <= 1) return null
  const hw = wMm / 2
  const hh = hMm / 2
  const points: THREE.Vector3[] = []
  for (let c = 0; c <= cols; c += every) {
    const x = -hw + (wMm * c) / cols
    points.push(new THREE.Vector3(x, -hh, 0), new THREE.Vector3(x, hh, 0))
  }
  for (let r = 0; r <= rows; r += every) {
    const y = -hh + (hMm * r) / rows
    points.push(new THREE.Vector3(-hw, y, 0), new THREE.Vector3(hw, y, 0))
  }
  if (points.length === 0) return null
  return new THREE.BufferGeometry().setFromPoints(points)
}

/**
 * GSD pixel-grid overlay: a capped grid of squares on the footprint plane
 * at WD in the camera slot color, with a mm/px badge in the corner cell
 * and brighter every-Nth contour lines so density reads at a glance.
 *
 * Render inside the camera's frustum group so Track A visibility toggles
 * hide the grid with its parent. Does NOT touch App.tsx (Track A owns it).
 */
export const PixelSizeGrid = memo(function PixelSizeGrid({
  fovHmm,
  fovVmm,
  resolutionH,
  resolutionV,
  workingDistanceMm,
  focalLengthMm,
  cameraIndex = 0,
  color,
  maxCells = 40,
  contourEvery,
  showLabels = true,
}: PixelSizeGridProps) {
  const spec = useMemo(
    () =>
      computePixelGrid({
        fovHmm,
        fovVmm,
        resolutionH,
        resolutionV,
        workingDistanceMm,
        focalLengthMm,
        maxCells,
      }),
    [fovHmm, fovVmm, resolutionH, resolutionV, workingDistanceMm, focalLengthMm, maxCells],
  )

  const slotColor = color ?? cameraColorForIndex(cameraIndex)
  const every = contourEvery ?? spec.contourEvery

  const { gridGeometry, contourGeometry } = useMemo(() => {
    if (!spec.valid) return { gridGeometry: null, contourGeometry: null }
    return {
      gridGeometry: buildGridGeometry(spec.gridCols, spec.gridRows, fovHmm, fovVmm),
      contourGeometry: buildContourGeometry(spec.gridCols, spec.gridRows, fovHmm, fovVmm, every),
    }
  }, [spec, fovHmm, fovVmm, every])

  useEffect(
    () => () => {
      gridGeometry?.dispose()
      contourGeometry?.dispose()
    },
    [gridGeometry, contourGeometry],
  )

  if (!spec.valid || !gridGeometry) return null

  // Corner cell anchor (top-left) for the mm/px badge.
  const hw = fovHmm / 2
  const hh = fovVmm / 2
  const labelX = -hw + fovHmm / spec.gridCols / 2
  const labelY = hh - fovVmm / spec.gridRows / 2

  return (
    <group position={[0, 0, workingDistanceMm]}>
      {/* Base pixel grid */}
      <lineSegments>
        <primitive object={gridGeometry} attach="geometry" />
        <lineBasicMaterial color={slotColor} transparent opacity={0.35} />
      </lineSegments>
      {/* GSD contour emphasis: every-Nth line brighter */}
      {contourGeometry && (
        <lineSegments>
          <primitive object={contourGeometry} attach="geometry" />
          <lineBasicMaterial color={slotColor} transparent opacity={0.8} />
        </lineSegments>
      )}
      {showLabels && (
        <Html position={[labelX, labelY, 0]} center distanceFactor={Math.max(workingDistanceMm, 200)}>
          <div
            className="rounded px-1.5 py-0.5 text-[11px] whitespace-nowrap text-slate-900 shadow-lg"
            style={{ backgroundColor: slotColor }}
          >
            {spec.label}
          </div>
        </Html>
      )}
    </group>
  )
})

export default PixelSizeGrid
