import { Grid, Html, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { memo, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { computeFov, sensorDiagonalMm } from '../lib/optics'
import { computeFitDistance, computeStageFit, fitCameraPosition } from '../lib/stageFit'
import type { FovRisk } from '../lib/optics'
import type { Lens, Sensor } from '../lib/types'

const RISK_COLOR: Record<FovRisk, string> = {
  normal: '#38bdf8',
  macro: '#fbbf24',
  'extreme-macro': '#fb923c',
  invalid: '#f87171',
}

const RISK_OPACITY: Record<FovRisk, number> = {
  normal: 0.16,
  macro: 0.13,
  'extreme-macro': 0.1,
  invalid: 0.05,
}

interface FovCone3DProps {
  sensor: Sensor
  lens: Lens
  workingDistanceMm: number
}

interface FovStageProps extends FovCone3DProps {
  /** Shared world scale (mm) used for camera position, grid, and clipping so
   * several stages render at an identical 1:1 framing. Defaults to the
   * camera's own working distance when rendered standalone. */
  sceneScaleMm?: number
  /** Fixed height for the canvas; smaller when tiled side by side. */
  heightClass?: string
}

/** Stylized camera body + lens barrel sitting at the frustum apex — reads as "a camera", not just a wireframe box. Exported for the shared-view stage (single rig at the shared apex). */
export function CameraRig({ sensor }: { sensor: Sensor }) {
  const sw = sensor.widthMm / 2
  const sh = sensor.heightMm / 2
  const lensRadius = Math.max(4, Math.min(sw, sh) * 0.85)

  return (
    <group>
      <mesh position={[0, 0, -20]}>
        <boxGeometry args={[sw * 2.6, sh * 2.6, 24]} />
        <meshStandardMaterial color="#334155" metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0, -4]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[lensRadius, lensRadius * 1.15, 8, 32]} />
        <meshStandardMaterial color="#0f172a" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Front glass element, a small accent-tinted disc where the frustum apex begins */}
      <mesh position={[0, 0, -0.05]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[lensRadius * 0.85, 32]} />
        <meshStandardMaterial color="#082f49" emissive="#22d3ee" emissiveIntensity={0.35} metalness={0.9} roughness={0.1} />
      </mesh>
    </group>
  )
}

function Frustum({ sensor, lens, workingDistanceMm }: FovCone3DProps) {
  const fov = computeFov(sensor, lens.focalLengthMm, workingDistanceMm)
  const risk = fov.horizontal.risk
  const color = RISK_COLOR[risk]

  const sh = sensor.heightMm / 2

  // Line geometries are memoised per FOV footprint and disposed on change /
  // unmount. Previously these were rebuilt on every render with no dispose,
  // leaking GPU buffers on each slider tick — on constrained machines the
  // tab would eventually crash, which surfaces as the page "reloading".
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

  if (!fov.horizontal.fovMm || !fov.vertical.fovMm) {
    return (
      <group>
        <CameraRig sensor={sensor} />
        <Html position={[0, sh + 20, -15]} center distanceFactor={200}>
          <div className="rounded bg-red-500/90 px-2 py-1 text-xs whitespace-nowrap text-white shadow-lg ring-1 ring-white/20">
            {fov.horizontal.message ?? 'Invalid geometry for this working distance.'}
          </div>
        </Html>
      </group>
    )
  }

  const wd = workingDistanceMm
  const fh = (fov.vertical.fovMm ?? 0) / 2

  return (
    <group>
      <CameraRig sensor={sensor} />

      {/* Frustum rays from the lens to each footprint corner */}
      {raySets.map((geom, i) => (
        <lineSegments key={i}>
          <primitive object={geom} attach="geometry" />
          <lineBasicMaterial color={color} transparent opacity={0.55} />
        </lineSegments>
      ))}

      {/* Footprint outline */}
      {footprintEdges && (
        <lineSegments>
          <primitive object={footprintEdges} attach="geometry" />
          <lineBasicMaterial color={color} />
        </lineSegments>
      )}

      {/* Footprint fill, opacity communicates the uncertainty/risk level */}
      <mesh position={[0, 0, wd]}>
        <planeGeometry args={[fov.horizontal.fovMm, fov.vertical.fovMm]} />
        <meshBasicMaterial color={color} transparent opacity={RISK_OPACITY[risk]} side={THREE.DoubleSide} />
      </mesh>

      <Html position={[0, fh + Math.max(15, fh * 0.08), wd]} center distanceFactor={Math.max(wd, 200)}>
        <div className="rounded bg-slate-900/90 px-2 py-1 text-xs whitespace-nowrap text-slate-100 shadow-lg ring-1 ring-white/10">
          FOV {fov.horizontal.fovMm.toFixed(0)} x {fov.vertical.fovMm.toFixed(0)}mm @ {wd}mm
        </div>
      </Html>
      {risk !== 'normal' && (
        <Html position={[0, -fh - Math.max(15, fh * 0.08), wd]} center distanceFactor={Math.max(wd, 200)}>
          <div
            className="rounded px-2 py-1 text-xs font-medium whitespace-nowrap text-slate-900 shadow-lg"
            style={{ backgroundColor: color }}
          >
            {fov.horizontal.message}
          </div>
        </Html>
      )}
    </group>
  )
}

/**
 * 3D camera-cone "stage": a stylized camera+lens sits at the frustum apex,
 * with the resulting FOV footprint rectangle drawn at the working
 * distance. Color/opacity encode the uncertainty risk level from
 * computeFov rather than hard-blocking sensitive or invalid inputs
 * (requirements.md §3.3). Styled dark to read as an instrument viewport,
 * similar in spirit to commercial lens-selector configurators.
 *
 * Memoised: App re-renders on every state change anywhere (a slider tick on
 * another camera, opening a sidebar form...), and R3F repaints the canvas on
 * each commit even when nothing in the scene changed — so without this every
 * panel redrew on every unrelated update. Props are all primitives or
 * library objects with stable identity, so the shallow compare is exact.
 */
export const FovCone3D = memo(function FovCone3D({ sensor, lens, workingDistanceMm, sceneScaleMm, heightClass = 'h-[480px]' }: FovStageProps) {
  const wd = Math.max(workingDistanceMm, 1)
  const scale = Math.max(sceneScaleMm ?? wd, 1)
  const diagonal = sensorDiagonalMm(sensor)

  // Per-panel auto-fit: derive this panel's footprint and place the camera
  // one fit distance out along the 3/4-view direction, so wide lenses (whose
  // footprint dwarfs the working distance) frame instead of washing the
  // viewport blank. Invalid geometry degrades to a WD-based fallback
  // inside computeFitDistance, keeping the rig + error badge framed.
  const fovForFit = computeFov(sensor, lens.focalLengthMm, wd)
  const fitFw = (fovForFit.horizontal.fovMm ?? 0) / 2
  const fitFh = (fovForFit.vertical.fovMm ?? 0) / 2
  const fitDist = computeFitDistance(fitFw, fitFh, wd)
  const stageFit = computeStageFit(fitDist)
  // Bounding-sphere centre of this panel's frustum (apex at origin,
  // footprint at z = wd): the look-at target the fit distance is measured from.
  const targetZ = wd / 2

  // Floor placement: the optical axis runs along +Z (camera at the origin,
  // footprint plane at z = wd spanning y = +/-fh), while drei <Grid> is an
  // XZ-horizontal floor (normal +Y). The old fixed offset (y = -diagonal*4)
  // sat inside the frustum whenever the footprint half-height fh exceeded it
  // (fh grows ~linearly with working distance), slicing through both the
  // frustum volume and the vertical footprint rectangle. Park the floor below
  // the lowest point of the whole rig (footprint bottom edge vs. camera-body
  // bottom, whichever is lower) plus a margin that scales with scene size so
  // it stays clear at both macro and long working distances without
  // detaching visually when zoomed out via a shared sceneScaleMm.
  const fhForFloor = fitFh
  const swHalf = sensor.widthMm / 2
  const shHalf = sensor.heightMm / 2
  const lensBottom = Math.max(4, Math.min(swHalf, shHalf) * 0.85) * 1.15
  const cameraBottom = Math.max(shHalf * 1.3, lensBottom)
  const lowestY = -Math.max(fhForFloor, cameraBottom)
  const floorMargin = Math.max(diagonal * 0.5, Math.abs(lowestY) * 0.08, scale * 0.01)
  const groundY = lowestY - floorMargin

  // Memoise R3F object/array props on `fitDist`/`targetZ` so a re-render
  // triggered by an unrelated panel (same fit) keeps stable prop identities
  // and doesn't force this Canvas to re-apply camera/fog/grid state.
  const cameraProps = useMemo(
    () => ({
      position: fitCameraPosition(fitDist, targetZ),
      fov: 50,
      near: Math.max(fitDist * 0.01, 0.1),
      far: fitDist * 10,
    }),
    [fitDist, targetZ],
  )
  const fogArgs = useMemo(
    () => ['#0b1220', stageFit.fogNearMm, stageFit.fogFarMm] as [string, number, number],
    [stageFit.fogNearMm, stageFit.fogFarMm],
  )
  const gridArgs = useMemo(() => [fitDist * 4, fitDist * 4] as [number, number], [fitDist])
  const gridCellSize = stageFit.gridCellMm
  const gridSectionSize = stageFit.gridSectionMm
  const controlsTarget = useMemo(() => [0, 0, targetZ] as [number, number, number], [targetZ])
  const controlsMaxDistance = stageFit.controlsMaxDistanceMm

  return (
    <div className={`${heightClass} w-full overflow-hidden rounded-xl bg-gradient-to-b from-slate-900 to-slate-950 shadow-inner`}>
      <Canvas frameloop="demand" dpr={[1, 1.5]} camera={cameraProps}>
        <color attach="background" args={['#0b1220']} />
        <fog attach="fog" args={fogArgs} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[fitDist * 0.4, fitDist * 0.6, fitDist * 0.2]} intensity={1.1} />
        <pointLight position={[0, 0, 10]} color="#22d3ee" intensity={8} distance={fitDist * 2} />
        <Grid
          args={gridArgs}
          position={[0, groundY, 0]}
          cellSize={gridCellSize}
          sectionSize={gridSectionSize}
          cellColor="#1e293b"
          sectionColor="#334155"
          fadeDistance={fitDist * 3}
          fadeStrength={1}
        />
        <Frustum sensor={sensor} lens={lens} workingDistanceMm={wd} />
        {/* enableDamping={false} so frameloop="demand" settles instead of requesting endless frames */}
        <OrbitControls target={controlsTarget} enableDamping={false} minDistance={diagonal} maxDistance={controlsMaxDistance} />
      </Canvas>
    </div>
  )
})
