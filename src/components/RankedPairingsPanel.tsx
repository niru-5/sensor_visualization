import { useMemo } from 'react'
import { rankPairings, shareCardText, type WizardInputs } from '../lib/fae'
import type { Lens, Sensor } from '../lib/types'
import { ShareCard } from './ShareCard'

const VERDICT_STYLES: Record<string, string> = {
  fit: 'bg-green-100 text-green-800',
  marginal: 'bg-amber-100 text-amber-800',
  'no-fit': 'bg-red-100 text-red-800',
}

interface RankedPairingsPanelProps {
  sensors: Sensor[]
  lenses: Lens[]
  inputs: WizardInputs
  valid: boolean
}

/**
 * Ranked sensor×lens shortlist (camera-fae Step 3) with the shareable
 * top-pick card. Moved out of WizardPanel so it can live in its own tab;
 * all optics flow through the existing rankPairings() in fae.ts.
 */
export function RankedPairingsPanel({ sensors, lenses, inputs, valid }: RankedPairingsPanelProps) {
  const ranking = useMemo(() => {
    if (!valid || sensors.length === 0 || lenses.length === 0) return null
    return rankPairings(sensors, lenses, inputs)
  }, [sensors, lenses, inputs, valid])

  if (!valid) {
    return <p className="text-sm text-amber-700">Enter a working distance and either a target FOV or a feature size in the Application wizard tab.</p>
  }

  if (!ranking || ranking.ranked.length === 0) {
    return <p className="text-sm text-neutral-500">Add sensors and lenses to rank pairings.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-neutral-800">Ranked pairings</h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-300 text-left">
              <th className="p-2">Pairing</th>
              <th className="p-2">FOV (H×V)</th>
              <th className="p-2">Verdict</th>
              <th className="p-2">Why</th>
            </tr>
          </thead>
          <tbody>
            {ranking.ranked.map((p) => (
              <tr key={`${p.sensorId}+${p.lensId}`} className="border-b border-neutral-200 align-top">
                <td className="p-2">
                  <span className="font-medium">{p.sensorName}</span>
                  <br />
                  <span className="text-neutral-600">+ {p.lensName}</span>
                </td>
                <td className="p-2 tabular-nums">
                  {p.fovHmm !== null && p.fovVmm !== null ? `${p.fovHmm.toFixed(0)}×${p.fovVmm.toFixed(0)}mm` : 'invalid'}
                </td>
                <td className="p-2">
                  <span className={`rounded px-1.5 py-0.5 text-xs ${VERDICT_STYLES[p.verdict]}`}>
                    {p.verdict} ({p.score})
                  </span>
                </td>
                <td className="p-2">
                  <ul className="list-disc pl-4 text-xs text-neutral-600">
                    {p.reasons.slice(0, 3).map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {ranking.excluded.length > 0 && (
        <p className="text-xs text-neutral-500">
          Excluded by interface/shutter filters ({ranking.excluded.length}): {ranking.excluded[0]!.sensorName} —{' '}
          {ranking.excluded[0]!.reason}
          {ranking.excluded.length > 1 ? ` (+${ranking.excluded.length - 1} more)` : ''}
        </p>
      )}
      {ranking.ranked[0] && (
        <ShareCard
          heading={`${ranking.ranked[0].sensorName} + ${ranking.ranked[0].lensName}`}
          sub={`Score ${ranking.ranked[0].score} (${ranking.ranked[0].verdict}) at ${inputs.workingDistanceMm}mm WD`}
          text={shareCardText(inputs, ranking)}
        />
      )}
    </div>
  )
}
