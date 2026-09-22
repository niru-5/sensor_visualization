import { Html } from '@react-three/drei';
import { humanReferenceHeightMm, humanReferenceLabel } from '../lib/scaleReference';

interface HumanScaleReferenceProps {
  /** Figure height in metres (default 1.8). */
  heightM?: number;
  /** World position of the figure's feet (mm units, matching stage scenes). */
  position?: [number, number, number];
  /** Figure colour. */
  color?: string;
  /** Show the floating "1.8 m" dimension label. */
  showLabel?: boolean;
}

/**
 * Human-scale reference prop (~1.8m) for a future shared-viewpoint compare
 * stage: a stylised capsule figure (body + sphere head) plus a dimension
 * marker line and an "Hx m" label, so FOV footprints read against a person.
 * All geometry is in millimetres to match the existing stage scenes.
 */
export function HumanScaleReference({
  heightM = 1.8,
  position = [0, 0, 0],
  color = '#94a3b8',
  showLabel = true,
}: HumanScaleReferenceProps) {
  const heightMm = humanReferenceHeightMm(heightM);
  const label = humanReferenceLabel(heightM);

  // Head is a sphere on top; body capsule fills the rest. Head diameter is
  // ~1/7.5 of stature (classic artistic proportion).
  const headRadius = heightMm / 15;
  const bodyHeight = Math.max(heightMm - headRadius * 2, 1);
  const bodyCenterY = bodyHeight / 2;
  const headCenterY = bodyHeight + headRadius;

  return (
    <group position={position}>
      {/* Body */}
      <mesh position={[0, bodyCenterY, 0]}>
        <capsuleGeometry args={[heightMm * 0.09, bodyHeight, 8, 16]} />
        <meshStandardMaterial color={color} metalness={0.1} roughness={0.7} />
      </mesh>
      {/* Head */}
      <mesh position={[0, headCenterY, 0]}>
        <sphereGeometry args={[headRadius, 24, 16]} />
        <meshStandardMaterial color={color} metalness={0.1} roughness={0.7} />
      </mesh>
      {/* Dimension marker: vertical line beside the figure with end ticks */}
      <mesh position={[heightMm * 0.22, heightMm / 2, 0]}>
        <boxGeometry args={[heightMm * 0.004, heightMm, heightMm * 0.004]} />
        <meshBasicMaterial color="#38bdf8" />
      </mesh>
      {showLabel && (
        <Html position={[heightMm * 0.22, heightMm + heightMm * 0.04, 0]} center distanceFactor={heightMm * 2}>
          <div className="rounded bg-slate-900/90 px-2 py-1 text-xs whitespace-nowrap text-slate-100 shadow-lg ring-1 ring-white/10">
            {label} reference
          </div>
        </Html>
      )}
    </group>
  );
}
