import { Grid, Html, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { computeFov, sensorDiagonalMm } from '../lib/optics'
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

/** Stylized camera body + lens barrel sitting at the frustum apex — reads as "a camera", not just a wireframe box. */
function CameraRig({ sensor }: { sensor: Sensor }) {
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

  const fw = fov.horizontal.fovMm / 2
  const fh = fov.vertical.fovMm / 2
  const wd = workingDistanceMm

  const corners = [
    new THREE.Vector3(fw, fh, wd),
    new THREE.Vector3(-fw, fh, wd),
    new THREE.Vector3(-fw, -fh, wd),
    new THREE.Vector3(fw, -fh, wd),
  ]

  const footprintEdges = new THREE.BufferGeometry().setFromPoints([...corners, corners[0]])
  const raySets = corners.map((c) => new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), c]))

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
      <lineSegments>
        <primitive object={footprintEdges} attach="geometry" />
        <lineBasicMaterial color={color} />
      </lineSegments>

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
 */
export function FovCone3D({ sensor, lens, workingDistanceMm, sceneScaleMm, heightClass = 'h-[480px]' }: FovStageProps) {
  const wd = Math.max(workingDistanceMm, 1)
  const scale = Math.max(sceneScaleMm ?? wd, 1)
  const diagonal = sensorDiagonalMm(sensor)

  return (
    <div className={`${heightClass} w-full overflow-hidden rounded-xl bg-gradient-to-b from-slate-900 to-slate-950 shadow-inner`}>
      <Canvas camera={{ position: [scale * 0.55, scale * 0.38, scale * 0.85], fov: 50, near: 0.1, far: scale * 10 }}>
        <color attach="background" args={['#0b1220']} />
        <fog attach="fog" args={['#0b1220', scale * 0.8, scale * 6]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[scale * 0.4, scale * 0.6, scale * 0.2]} intensity={1.1} />
        <pointLight position={[0, 0, 10]} color="#22d3ee" intensity={8} distance={60} />
        <Grid
          args={[scale * 4, scale * 4]}
          position={[0, -diagonal * 4, 0]}
          cellColor="#1e293b"
          sectionColor="#334155"
          fadeDistance={scale * 3}
          fadeStrength={1}
        />
        <Frustum sensor={sensor} lens={lens} workingDistanceMm={wd} />
        <OrbitControls target={[0, 0, scale / 2]} enableDamping dampingFactor={0.08} minDistance={diagonal} maxDistance={scale * 8} />
      </Canvas>
    </div>
  )
}
