import { useMemo } from 'react'
import { effectiveTargetFov, focalRangeForSensor } from '../lib/fae'
import type { CameraInterface, Sensor, ShutterType } from '../lib/types'
import type { WizardDraft } from './useWizardDraft'

const INTERFACES: (CameraInterface | 'any')[] = ['any', 'GigE', 'USB3', 'CameraLink', 'CoaXPress', 'MIPI', 'other']
const SHUTTERS: (ShutterType | 'any')[] = ['any', 'global', 'rolling']

interface WizardPanelProps {
  sensors: Sensor[]
  wizard: WizardDraft
}

/**
 * FAE application wizard (camera-fae Steps 1–2): describe the imaging task
 * and get the required focal range per sensor. The ranked sensor×lens
 * shortlist lives in RankedPairingsPanel (the "Ranked pairings" tab) and
 * reads the same shared draft state — this component only holds the inputs
 * form and the focal-range output.
 */
export function WizardPanel({ sensors, wizard }: WizardPanelProps) {
  const {
    targetFovH,
    setTargetFovH,
    targetFovV,
    setTargetFovV,
    workingDistance,
    setWorkingDistance,
    tolerance,
    setTolerance,
    featureSize,
    setFeatureSize,
    pixelsPerFeature,
    setPixelsPerFeature,
    requiredInterface,
    setRequiredInterface,
    requiredShutter,
    setRequiredShutter,
    inputs,
    featureMode,
    valid,
  } = wizard

  const focalRanges = useMemo(
    () => (valid ? sensors.map((s) => ({ sensor: s, range: focalRangeForSensor(s, inputs) })) : []),
    [sensors, inputs, valid],
  )

  const displayTarget = sensors.length > 0 && valid ? effectiveTargetFov(sensors[0]!, inputs) : null

  const inputClass = 'rounded border border-neutral-300 p-1.5 text-sm'

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-5">
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
        <div>
          <h3 className="text-sm font-semibold text-neutral-800">Required focal range by sensor</h3>
          {focalRanges.length === 0 ? (
            <p className="text-sm text-neutral-500">Add a sensor to compute focal ranges.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2 text-sm">
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
      )}
    </div>
  )
}
