import { Grid, Html, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { SLOT_FILL_OPACITY, SLOT_RAY_OPACITY, slotColor } from '../lib/cameraPalette'
import { computeFov, sensorDiagonalMm } from '../lib/optics'
import { computeFitDistance, computeStageFit, fitCameraPosition } from '../lib/stageFit'
import type { ResolvedSlot } from '../lib/twoCamera'
import type { Lens, Sensor } from '../lib/types'
import { CameraRig } from './FovCone3D'

interface SharedFrustumProps {
  sensor: Sensor
  lens: Lens
  workingDistanceMm: number
  /** Per-camera palette color (slotColor), never a risk color. */
  color: string
  /** Slot index — staggers Html badges so overlapping footprints stay readable. */
  index: number
}

/**
 * One camera's frustum inside the shared stage: apex at the shared origin,
 * optical axis +Z, footprint plane at z = workingDistanceMm. Same geometry
 * pattern as `Frustum` in FovCone3D, but tinted by camera slot (palette)
 * instead of FOV risk level. Risk still surfaces via Html badges.
 */
function SharedFrustum({ sensor, lens, workingDistanceMm, color, index }: SharedFrustumProps) {
  const fov = computeFov(sensor, lens.focalLengthMm, workingDistanceMm)
  const risk = fov.horizontal.risk

  // Memoised + disposed line geometries (same leak-avoidance pattern as FovCone3D).
  const { footprintEdges, raySets } = useMemo(() => {
    if (!fov.horizontal.fovMm || !fov.vertical.fovMm) {
      return { footprintEdges: null as THREE.BufferGeometry | null, raySets: [] as THREE.BufferGeometry[] }
    }
    const fw = fov.horizontal.fovMm / 2
    const fh = fov.vertical.fovMm / 2
    const wd = workingDistanceMm
    const corners = [
      new THREE.Vector3(fw, fh, wd),
      new THREE.Vector3(-fw, fh, wd),
      new THREE.Vector3(-fw, -fh, wd),
      new THREE.Vector3(fw, -fh, wd),
    ]
    return {
      footprintEdges: new THREE.BufferGeometry().setFromPoints([...corners, corners[0]]),
      raySets: corners.map((c) => new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), c])),
    }
  }, [fov.horizontal.fovMm, fov.vertical.fovMm, workingDistanceMm])

  useEffect(
    () => () => {
      footprintEdges?.dispose()
      for (const geom of raySets) geom.dispose()
    },
    [footprintEdges, raySets],
  )

  // Stagger badges per slot so co-located footprints don't stack labels exactly.
  const staggerMm = index * 26

  if (!fov.horizontal.fovMm || !fov.vertical.fovMm) {
    return (
      <group>
        <Html position={[0, sensor.heightMm / 2 + 20 + staggerMm, workingDistanceMm]} center distanceFactor={200}>
          <div className="rounded bg-red-500/90 px-2 py-1 text-xs whitespace-nowrap text-white shadow-lg ring-1 ring-white/20">
            Camera {index + 1}: {fov.horizontal.message ?? 'Invalid geometry for this working distance.'}
          </div>
        </Html>
      </group>
    )
  }

  const wd = workingDistanceMm
  const fh = (fov.vertical.fovMm ?? 0) / 2

  return (
    <group>
      {raySets.map((geom, i) => (
        <lineSegments key={i}>
          <primitive object={geom} attach="geometry" />
          <lineBasicMaterial color={color} transparent opacity={SLOT_RAY_OPACITY} />
        </lineSegments>
      ))}

      {footprintEdges && (
        <lineSegments>
          <primitive object={footprintEdges} attach="geometry" />
          <lineBasicMaterial color={color} />
        </lineSegments>
      )}

      <mesh position={[0, 0, wd]}>
        <planeGeometry args={[fov.horizontal.fovMm, fov.vertical.fovMm]} />
        <meshBasicMaterial color={color} transparent opacity={SLOT_FILL_OPACITY} side={THREE.DoubleSide} />
      </mesh>

      <Html position={[0, fh + Math.max(15, fh * 0.08) + staggerMm, wd]} center distanceFactor={Math.max(wd, 200)}>
        <div className="rounded bg-slate-900/90 px-2 py-1 text-xs whitespace-nowrap text-slate-100 shadow-lg ring-1 ring-white/10">
          <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
          C{index + 1} FOV {fov.horizontal.fovMm.toFixed(0)} x {fov.vertical.fovMm.toFixed(0)}mm @ {wd}mm
        </div>
      </Html>
      {risk !== 'normal' && (
        <Html position={[0, -fh - Math.max(15, fh * 0.08) - staggerMm, wd]} center distanceFactor={Math.max(wd, 200)}>
          <div className="rounded px-2 py-1 text-xs font-medium whitespace-nowrap text-slate-900 shadow-lg" style={{ backgroundColor: color }}>
            C{index + 1}: {fov.horizontal.message}
          </div>
        </Html>
      )}
    </group>
  )
}

export interface SharedFovViewProps {
  /** Resolved camera slots (from resolveSlots — capped at MAX_CAMERAS). */
  slots: ResolvedSlot[]
  /** Shared world scale (sharedScaleMm) so floor/fog margins match the separate stages. */
  sharedScaleMm: number
  heightClass?: string
}

/**
 * Track A shared-view comparison stage: ONE Canvas, ONE OrbitControls, every
 * camera's frustum co-located at the identical origin pose (apex at origin,
 * +Z optical axis). A single union fit over all visible footprints sets the
 * POV, so cameras are judged at an identical viewpoint instead of N
 * diverging per-panel auto-fits. Per-slot chips toggle frustum visibility.
 */
export function SharedFovView({ slots, sharedScaleMm, heightClass = 'h-[480px]' }: SharedFovViewProps) {
  const [hiddenIds, setHiddenIds] = useState<readonly string[]>([])

  function toggleSlot(id: string) {
    setHiddenIds((prev) => (prev.includes(id) ? prev.filter((h) => h !== id) : [...prev, id]))
  }

  // Union fit over visible, hardware-backed slots: max footprint extents +
  // max working distance, so the single POV frames every frustum at once.
  const fit = useMemo(() => {
    let fw = 0
    let fh = 0
    let wd = 1
    for (const r of slots) {
      if (hiddenIds.includes(r.cam.id) || !r.sensor || !r.lens) continue
      const fov = computeFov(r.sensor, r.lens.focalLengthMm, r.effectiveWd)
      if (fov.horizontal.fovMm) fw = Math.max(fw, fov.horizontal.fovMm / 2)
      if (fov.vertical.fovMm) fh = Math.max(fh, fov.vertical.fovMm / 2)
      wd = Math.max(wd, r.effectiveWd)
    }
    const dist = computeFitDistance(fw, fh, wd)
    return { fw, fh, wd, dist, stage: computeStageFit(dist), targetZ: wd / 2 }
  }, [slots, hiddenIds])

  const rigSensor = useMemo(() => {
    for (const r of slots) {
      if (!hiddenIds.includes(r.cam.id) && r.sensor && r.lens) return r.sensor
    }
    return slots.find((r) => r.sensor)?.sensor ?? null
  }, [slots, hiddenIds])

  const scale = Math.max(sharedScaleMm, fit.wd, 1)
  const diagonal = rigSensor ? sensorDiagonalMm(rigSensor) : 1

  // Floor below the lowest point of the union rig (same pattern as FovCone3D).
  const swHalf = rigSensor ? rigSensor.widthMm / 2 : 0
  const shHalf = rigSensor ? rigSensor.heightMm / 2 : 0
  const lensBottom = Math.max(4, Math.min(swHalf, shHalf) * 0.85) * 1.15
  const cameraBottom = Math.max(shHalf * 1.3, lensBottom)
  const lowestY = -Math.max(fit.fh, cameraBottom)
  const floorMargin = Math.max(diagonal * 0.5, Math.abs(lowestY) * 0.08, scale * 0.01)
  const groundY = lowestY - floorMargin

  const cameraProps = useMemo(
    () => ({
      position: fitCameraPosition(fit.dist, fit.targetZ),
      fov: 50,
      near: Math.max(fit.dist * 0.01, 0.1),
      far: fit.dist * 10,
    }),
    [fit.dist, fit.targetZ],
  )
  const fogArgs = useMemo(
    () => ['#0b1220', fit.stage.fogNearMm, fit.stage.fogFarMm] as [string, number, number],
    [fit.stage.fogNearMm, fit.stage.fogFarMm],
  )
  const gridArgs = useMemo(() => [fit.dist * 4, fit.dist * 4] as [number, number], [fit.dist])
  const lightPos = useMemo(
    () => [fit.dist * 0.4, fit.dist * 0.6, fit.dist * 0.2] as [number, number, number],
    [fit.dist],
  )
  const controlsTarget = useMemo(() => [0, 0, fit.targetZ] as [number, number, number], [fit.targetZ])

  const visibleCount = slots.filter((r) => !hiddenIds.includes(r.cam.id) && r.sensor && r.lens).length

  return (
    <div className="flex flex-col gap-2">
      <div role="group" aria-label="Toggle cameras in shared view" className="flex flex-wrap gap-2">
        {slots.map((r, i) => {
          const on = !hiddenIds.includes(r.cam.id)
          const color = slotColor(i)
          const configured = Boolean(r.sensor && r.lens)
          return (
            <button
              key={r.cam.id}
              onClick={() => toggleSlot(r.cam.id)}
              aria-pressed={on}
              title={configured ? `Show/hide Camera ${i + 1}` : `Camera ${i + 1} has no sensor/lens yet`}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 transition-opacity ${
                on
                  ? 'bg-slate-900 text-white ring-slate-900'
                  : 'bg-white text-neutral-400 line-through opacity-60 ring-neutral-300'
              }`}
            >
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
              Camera {i + 1}
            </button>
          )
        })}
      </div>

      <div className={`relative ${heightClass} w-full overflow-hidden rounded-xl bg-gradient-to-b from-slate-900 to-slate-950 shadow-inner`}>
        <Canvas frameloop="demand" dpr={[1, 1.5]} camera={cameraProps}>
          <color attach="background" args={['#0b1220']} />
          <fog attach="fog" args={fogArgs} />
          <ambientLight intensity={0.55} />
          <directionalLight position={lightPos} intensity={1.1} />
          <pointLight position={[0, 0, 10]} color="#22d3ee" intensity={8} distance={fit.dist * 2} />
          <Grid
            args={gridArgs}
            position={[0, groundY, 0]}
            cellSize={fit.stage.gridCellMm}
            sectionSize={fit.stage.gridSectionMm}
            cellColor="#1e293b"
            sectionColor="#334155"
            fadeDistance={fit.dist * 3}
            fadeStrength={1}
          />
          {rigSensor && <CameraRig sensor={rigSensor} />}
          {slots.map((r, i) => {
            const { sensor, lens } = r
            if (hiddenIds.includes(r.cam.id) || !sensor || !lens) return null
            return (
              <SharedFrustum
                key={r.cam.id}
                sensor={sensor}
                lens={lens}
                workingDistanceMm={r.effectiveWd}
                color={slotColor(i)}
                index={i}
              />
            )
          })}
          {/* enableDamping={false} so frameloop="demand" settles instead of requesting endless frames */}
          <OrbitControls target={controlsTarget} enableDamping={false} minDistance={diagonal} maxDistance={fit.stage.controlsMaxDistanceMm} />
        </Canvas>
        {visibleCount === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="rounded-lg bg-slate-900/90 px-4 py-2 text-sm text-slate-300 ring-1 ring-white/10">
              All cameras hidden — toggle one back on with the chips above.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
