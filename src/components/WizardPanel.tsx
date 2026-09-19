import { useMemo, useState } from 'react'
import { effectiveTargetFov, focalRangeForSensor, rankPairings, shareCardText, type WizardInputs } from '../lib/fae'
import type { CameraInterface, Lens, Sensor, ShutterType } from '../lib/types'
import { ShareCard } from './ShareCard'

const INTERFACES: (CameraInterface | 'any')[] = ['any', 'GigE', 'USB3', 'CameraLink', 'CoaXPress', 'MIPI', 'other']
const SHUTTERS: (ShutterType | 'any')[] = ['any', 'global', 'rolling']

const VERDICT_STYLES: Record<string, string> = {
  fit: 'bg-green-100 text-green-800',
  marginal: 'bg-amber-100 text-amber-800',
  'no-fit': 'bg-red-100 text-red-800',
}

function num(raw: string, fallback: number): number {
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

interface WizardPanelProps {
  sensors: Sensor[]
  lenses: Lens[]
}

/**
 * FAE application wizard (camera-fae Steps 1–3): describe the imaging task,
 * get the required focal range per sensor plus a ranked sensor×lens
 * shortlist with a shareable top-pick card. All optics flow through
 * fae.ts → optics.ts; this component only holds input state and renders.
 */
export function WizardPanel({ sensors, lenses }: WizardPanelProps) {
  const [targetFovH, setTargetFovH] = useState('300')
  const [targetFovV, setTargetFovV] = useState('250')
  const [workingDistance, setWorkingDistance] = useState('500')
  const [tolerance, setTolerance] = useState('10')
  const [featureSize, setFeatureSize] = useState('')
  const [pixelsPerFeature, setPixelsPerFeature] = useState('4')
  const [requiredInterface, setRequiredInterface] = useState<CameraInterface | 'any'>('any')
  const [requiredShutter, setRequiredShutter] = useState<ShutterType | 'any'>('any')

  const inputs: WizardInputs = useMemo(
    () => ({
      targetFovHmm: num(targetFovH, 0),
      targetFovVmm: num(targetFovV, 0),
      workingDistanceMm: num(workingDistance, 0),
      workingDistanceTolerancePct: num(tolerance, 10),
      featureSizeMm: featureSize.trim() ? num(featureSize, 0) : undefined,
      pixelsPerFeature: num(pixelsPerFeature, 4),
      requiredInterface,
      requiredShutter,
    }),
    [targetFovH, targetFovV, workingDistance, tolerance, featureSize, pixelsPerFeature, requiredInterface, requiredShutter],
  )

  const featureMode = (inputs.featureSizeMm ?? 0) > 0
  const valid = inputs.workingDistanceMm > 0 && (featureMode || (inputs.targetFovHmm > 0 && inputs.targetFovVmm > 0))

  const focalRanges = useMemo(
    () => (valid ? sensors.map((s) => ({ sensor: s, range: focalRangeForSensor(s, inputs) })) : []),
    [sensors, inputs, valid],
  )

  const ranking = useMemo(() => {
    if (!valid || sensors.length === 0 || lenses.length === 0) return null
    return rankPairings(sensors, lenses, inputs)
  }, [sensors, lenses, inputs, valid])

  const displayTarget =
    sensors.length > 0 && valid ? effectiveTargetFov(sensors[0]!, inputs) : null

  const inputClass = 'rounded border border-neutral-300 p-1.5 text-sm'

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-700">Target FOV H (mm)</span>
          <input className={inputClass} value={targetFovH} onChange={(e) => setTargetFovH(e.target.value)} disabled={featureMode} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-700">Target FOV V (mm)</span>
          <input className={inputClass} value={targetFovV} onChange={(e) => setTargetFovV(e.target.value)} disabled={featureMode} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-700">Working distance (mm)</span>
          <input className={inputClass} value={workingDistance} onChange={(e) => setWorkingDistance(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-700">WD tolerance (±%)</span>
          <input className={inputClass} value={tolerance} onChange={(e) => setTolerance(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-700">Smallest feature (mm) — optional</span>
          <input
            className={inputClass}
            value={featureSize}
            onChange={(e) => setFeatureSize(e.target.value)}
            placeholder="e.g. 0.5"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-700">Pixels per feature</span>
          <input className={inputClass} value={pixelsPerFeature} onChange={(e) => setPixelsPerFeature(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-700">Interface</span>
          <select className={inputClass} value={requiredInterface} onChange={(e) => setRequiredInterface(e.target.value as CameraInterface | 'any')}>
            {INTERFACES.map((i) => (
              <option key={i} value={i}>
                {i === 'any' ? 'Any' : i}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-700">Shutter</span>
          <select className={inputClass} value={requiredShutter} onChange={(e) => setRequiredShutter(e.target.value as ShutterType | 'any')}>
            {SHUTTERS.map((s) => (
              <option key={s} value={s}>
                {s === 'any' ? 'Any' : s}
              </option>
            ))}
          </select>
        </label>
      </div>
      {featureMode && (
        <p className="text-xs text-neutral-500">
          Feature-size mode: the required FOV is derived from {inputs.featureSizeMm}mm × {inputs.pixelsPerFeature}px/feature
          per sensor (explicit FOV targets ignored).
        </p>
      )}

      {!valid ? (
        <p className="text-sm text-amber-700">Enter a working distance and either a target FOV or a feature size.</p>
      ) : (
        <>
          <div>
            <h3 className="text-sm font-semibold text-neutral-800">Required focal range by sensor</h3>
            {focalRanges.length === 0 ? (
              <p className="text-sm text-neutral-500">Add a sensor to compute focal ranges.</p>
            ) : (
              <ul className="mt-1 flex flex-col gap-1 text-sm">
                {focalRanges.map(({ sensor, range }) => (
                  <li key={sensor.id} className="text-neutral-700">
                    <span className="font-medium">{sensor.name}</span>:{' '}
                    {range ? (
                      <>
                        <span className="font-mono tabular-nums">
                          {range.minMm.toFixed(1)}–{range.maxMm.toFixed(1)}mm
                        </span>{' '}
                        <span className="text-xs text-neutral-500">
                          (nominal H {range.nominalHmm.toFixed(1)} / V {range.nominalVmm.toFixed(1)}mm @ {inputs.workingDistanceMm}mm WD
                          {displayTarget?.derivedFromFeature && displayTarget.requiredMmPerPixel !== null
                            ? `, needs ≤${displayTarget.requiredMmPerPixel.toFixed(4)}mm/px`
                            : ''}
                          )
                        </span>
                      </>
                    ) : (
                      '—'
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {!ranking || ranking.ranked.length === 0 ? (
            <p className="text-sm text-neutral-500">Add sensors and lenses to rank pairings.</p>
          ) : (
            <div className="flex flex-col gap-3">
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
          )}
        </>
      )}
    </div>
  )
}
