import { useMemo } from 'react'
import { sensorDiagonalMm } from '../lib/optics'
import type { Sensor } from '../lib/types'

const COLORS = ['#2563eb', '#dc2626', '#16a34a', '#9333ea', '#d97706', '#0891b2']

const PADDING = 32
const MAX_PLOT_SIZE = 420

interface SensorCompare2DProps {
  sensors: Sensor[]
}

/**
 * Draws each sensor's active area to scale, all centered on the same
 * origin, so relative size differences are visually obvious at a glance
 * (requirements.md §3.2).
 */
export function SensorCompare2D({ sensors }: SensorCompare2DProps) {
  const maxDim = useMemo(() => Math.max(1, ...sensors.map((s) => Math.max(s.widthMm, s.heightMm))), [sensors])
  const scale = MAX_PLOT_SIZE / maxDim
  const size = MAX_PLOT_SIZE + PADDING * 2
  const center = size / 2

  if (sensors.length === 0) {
    return <p className="text-sm text-neutral-500">Select one or more sensors to compare their sizes.</p>
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={size} height={size} role="img" aria-label="Sensor size comparison, drawn to scale">
        <rect x={0} y={0} width={size} height={size} fill="none" />
        {/* Sort largest-first so smaller rectangles render on top and stay visible. */}
        {[...sensors]
          .sort((a, b) => b.widthMm * b.heightMm - a.widthMm * a.heightMm)
          .map((sensor) => {
            const w = sensor.widthMm * scale
            const h = sensor.heightMm * scale
            const color = COLORS[sensors.indexOf(sensor) % COLORS.length]
            return (
              <g key={sensor.id}>
                <rect
                  x={center - w / 2}
                  y={center - h / 2}
                  width={w}
                  height={h}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                />
              </g>
            )
          })}
      </svg>
      <ul className="grid w-full grid-cols-1 gap-1 text-sm sm:grid-cols-2">
        {sensors.map((sensor) => (
          <li key={sensor.id} className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: COLORS[sensors.indexOf(sensor) % COLORS.length] }}
            />
            <span className="truncate">
              {sensor.name} — {sensor.widthMm.toFixed(2)} x {sensor.heightMm.toFixed(2)}mm (diag{' '}
              {sensorDiagonalMm(sensor).toFixed(2)}mm)
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
