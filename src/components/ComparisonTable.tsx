import { checkImageCircle, checkMountCompatibility, computeFov, derivePixelPitchUm, mmPerPixel } from '../lib/optics'
import type { Lens, Sensor } from '../lib/types'

interface ComparisonTableProps {
  sensor: Sensor
  lenses: Lens[]
  workingDistanceMm: number
}

const STATUS_STYLES: Record<string, string> = {
  ok: 'bg-green-100 text-green-800',
  tight: 'bg-amber-100 text-amber-800',
  vignetting: 'bg-red-100 text-red-800',
  compatible: 'bg-green-100 text-green-800',
  spacer: 'bg-amber-100 text-amber-800',
  incompatible: 'bg-red-100 text-red-800',
}

/**
 * One sensor compared against multiple candidate lenses at once — the more
 * common real workflow ("I've picked a sensor, which lens fits?") per
 * requirements.md §3.6.
 */
export function ComparisonTable({ sensor, lenses, workingDistanceMm }: ComparisonTableProps) {
  const pixelPitch = derivePixelPitchUm(sensor)

  if (lenses.length === 0) {
    return <p className="text-sm text-neutral-500">Select one or more lenses to compare against {sensor.name}.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-300 text-left">
            <th className="p-2">Lens</th>
            <th className="p-2">Focal length</th>
            <th className="p-2">FOV (H x V)</th>
            <th className="p-2">mm/pixel (H)</th>
            <th className="p-2">Image circle</th>
            <th className="p-2">Mount</th>
          </tr>
        </thead>
        <tbody>
          {lenses.map((lens) => {
            const fov = computeFov(sensor, lens.focalLengthMm, workingDistanceMm)
            const circleCheck = checkImageCircle(lens, sensor)
            const mountCheck = checkMountCompatibility(lens.mount, sensor.mount)
            const mountStatus = !mountCheck.compatible ? 'incompatible' : mountCheck.requiresSpacer ? 'spacer' : 'compatible'

            return (
              <tr key={lens.id} className="border-b border-neutral-200 align-top">
                <td className="p-2 font-medium">{lens.name}</td>
                <td className="p-2">{lens.focalLengthMm}mm</td>
                <td className="p-2">
                  {fov.horizontal.fovMm && fov.vertical.fovMm ? (
                    <>
                      {fov.horizontal.fovMm.toFixed(0)} x {fov.vertical.fovMm.toFixed(0)}mm
                      {fov.horizontal.risk !== 'normal' && (
                        <span className="ml-1 rounded bg-amber-100 px-1 text-xs text-amber-800">
                          {fov.horizontal.risk}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="rounded bg-red-100 px-1 text-xs text-red-800">invalid at this WD</span>
                  )}
                </td>
                <td className="p-2">
                  {fov.horizontal.fovMm ? mmPerPixel(fov.horizontal.fovMm, sensor.resolutionH).toFixed(4) : '—'}
                </td>
                <td className="p-2">
                  <span className={`rounded px-1.5 py-0.5 text-xs ${STATUS_STYLES[circleCheck.status]}`}>
                    {lens.imageCircleMm}mm ({circleCheck.status})
                  </span>
                </td>
                <td className="p-2">
                  <span className={`rounded px-1.5 py-0.5 text-xs ${STATUS_STYLES[mountStatus]}`}>
                    {lens.mount} vs {sensor.mount}
                    {mountCheck.requiresSpacer ? ' (+5mm spacer)' : ''}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-neutral-500">
        {sensor.name}: {sensor.resolutionH} x {sensor.resolutionV}px, {pixelPitch.toFixed(2)}um pixel pitch, working
        distance {workingDistanceMm}mm.
      </p>
    </div>
  )
}
