import { computeFov, derivePixelPitchUm, mmPerPixel } from '../lib/optics'
import type { FovRisk } from '../lib/optics'
import type { Lens, Sensor } from '../lib/types'

const RISK_BADGE: Record<FovRisk, string> = {
  normal: 'bg-sky-500/15 text-sky-300 ring-sky-400/30',
  macro: 'bg-amber-500/15 text-amber-300 ring-amber-400/30',
  'extreme-macro': 'bg-orange-500/15 text-orange-300 ring-orange-400/30',
  invalid: 'bg-red-500/15 text-red-300 ring-red-400/30',
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-slate-800/60 px-3 py-2 ring-1 ring-white/5">
      <p className="text-[11px] tracking-wide text-slate-400 uppercase">{label}</p>
      <p className="text-lg font-semibold text-slate-50 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  )
}

interface FovReadoutProps {
  sensor: Sensor
  lens: Lens
  workingDistanceMm: number
}

/** Compact numeric readout ("results panel") next to the 3D stage — the numbers behind the picture. */
export function FovReadout({ sensor, lens, workingDistanceMm }: FovReadoutProps) {
  const fov = computeFov(sensor, lens.focalLengthMm, workingDistanceMm)
  const pixelPitch = derivePixelPitchUm(sensor)

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          label="Field of view"
          value={fov.horizontal.fovMm && fov.vertical.fovMm ? `${fov.horizontal.fovMm.toFixed(0)} x ${fov.vertical.fovMm.toFixed(0)}mm` : '—'}
        />
        <StatCard label="Magnification" value={fov.horizontal.magnification ? `${fov.horizontal.magnification.toFixed(3)}x` : '—'} />
        <StatCard
          label="Resolution (H)"
          value={fov.horizontal.fovMm ? `${mmPerPixel(fov.horizontal.fovMm, sensor.resolutionH).toFixed(4)}mm/px` : '—'}
        />
        <StatCard label="Pixel pitch" value={`${pixelPitch.toFixed(2)}um`} sub={`${sensor.resolutionH} x ${sensor.resolutionV}px`} />
      </div>
      {fov.horizontal.risk !== 'normal' && (
        <p className={`rounded-md px-2.5 py-1.5 text-xs ring-1 ${RISK_BADGE[fov.horizontal.risk]}`}>{fov.horizontal.message}</p>
      )}
    </div>
  )
}
