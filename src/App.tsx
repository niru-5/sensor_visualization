import { useEffect, useMemo, useRef, useState } from 'react'
import { ComparisonTable } from './components/ComparisonTable'
import { CompatibilityExplainer } from './components/CompatibilityExplainer'
import { DatasheetImportForm } from './components/DatasheetImportForm'
import { FovCone3D } from './components/FovCone3D'
import { FovReadout } from './components/FovReadout'
import { LensForm } from './components/LensForm'
import { SensorCompare2D } from './components/SensorCompare2D'
import { SensorForm } from './components/SensorForm'
import { WizardPanel } from './components/WizardPanel'
import { useAppData } from './store/useAppData'
import {
  addCameraSlot,
  computeTwoCameraView,
  createSlot,
  effectiveWorkingDistance,
  getSliderBounds,
  loadCameraSlots,
  panelLayout,
  removeCameraSlot,
  saveCameraSlots,
  updateCameraSlot,
} from './lib/twoCamera'
import type { CameraSlot } from './lib/twoCamera'
import type { Lens, Sensor } from './lib/types'

type AddMode = 'none' | 'manual' | 'import'

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
      <div>
        <h2 className="text-base font-semibold text-neutral-800">{title}</h2>
        {subtitle && <p className="text-sm text-neutral-500">{subtitle}</p>}
      </div>
      {children}
    </section>
  )
}

export default function App() {
  const { sensors, lenses, addSensor, removeSensor, addLens, removeLens, exportJson, importJson } = useAppData()

  const [sensorAddMode, setSensorAddMode] = useState<AddMode>('none')
  const [lensAddMode, setLensAddMode] = useState<AddMode>('none')

  // The camera comparison slots. Restored from localStorage when present so a
  // 2-panel comparison survives reload; otherwise start with a single camera.
  const [cameras, setCameras] = useState<CameraSlot[]>(() => loadCameraSlots() ?? [createSlot(null, null)])

  useEffect(() => {
    saveCameraSlots(cameras)
  }, [cameras])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState<string | null>(null)

  function updateCamera(id: string, patch: Partial<CameraSlot>) {
    // Lenses passed so a lens swap re-clamps WD into the new lens's valid
    // range (fixes slider-shows-valid / state-stays-invalid desync).
    setCameras((prev) => updateCameraSlot(prev, id, patch, lenses))
  }

  function addCamera() {
    // Seeded from the last slot so it's an easy "tweak one thing" comparison.
    setCameras((prev) => addCameraSlot(prev))
  }

  function removeCamera(id: string) {
    setCameras((prev) => removeCameraSlot(prev, id))
  }

  // Resolve each slot + shared 1:1 scale + de-duplicated in-play sets via the
  // tested lib helpers (single source of truth with src/lib/twoCamera.test.ts).
  const view = useMemo(() => computeTwoCameraView(sensors, lenses, cameras), [sensors, lenses, cameras])
  const resolved = view.resolved
  // Shared world scale across every panel → identical camera position and true 1:1 framing.
  const sharedScaleMm = view.sharedScale
  // Sensors currently in play, de-duplicated, feed the to-scale size comparison automatically.
  const camerasSensors = view.playSensors as Sensor[]
  const camerasLenses = view.playLenses as Lens[]

  const firstSensor = resolved[0]?.sensor ?? null

  function handleExportClick() {
    const blob = new Blob([exportJson()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'camera-selection-tool-export.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImportFile(file: File) {
    setImportError(null)
    try {
      importJson(await file.text())
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Could not import that file.')
    }
  }

  const { gridColsClass, panelHeight } = panelLayout(cameras.length)
  const maxedOut = cameras.length >= 4

  return (
    <div className="min-h-screen bg-neutral-100">
      <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white">CL</span>
            <div>
              <h1 className="text-lg font-bold leading-tight text-neutral-900">Camera &amp; Lens Selection Tool</h1>
              <p className="text-xs text-neutral-500">Compare machine-vision cameras side by side at a true 1:1 field-of-view scale.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleExportClick} className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50">
              Export JSON
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50"
            >
              Import JSON
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleImportFile(e.target.files[0])}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 p-4 sm:p-6 lg:grid-cols-[320px_1fr] lg:items-start">
        {importError && <p className="text-sm text-red-700 lg:col-span-2">{importError}</p>}

        {/* Left sidebar: the sensor/lens library. Anything added here (manually or from a datasheet)
            becomes selectable in every camera's dropdowns. */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-20">
          <Section title="Sensors" subtitle="Add sensors manually or from a datasheet link — then pick them per camera.">
            <ul className="divide-y divide-neutral-200">
              {sensors.map((sensor) => (
                <li key={sensor.id} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="text-sm font-medium text-neutral-800">{sensor.name}</span>
                  <span className="text-xs text-neutral-500">
                    {sensor.widthMm.toFixed(2)}x{sensor.heightMm.toFixed(2)}mm, {sensor.mount}-mount
                  </span>
                  <button onClick={() => removeSensor(sensor.id)} className="ml-auto text-xs text-red-600 hover:underline">
                    Remove
                  </button>
                </li>
              ))}
              {sensors.length === 0 && <li className="py-2 text-sm text-neutral-400">No sensors yet.</li>}
            </ul>

            {sensorAddMode === 'none' && (
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setSensorAddMode('import')} className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700">
                  From datasheet link
                </button>
                <button onClick={() => setSensorAddMode('manual')} className="rounded border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100">
                  Add manually
                </button>
              </div>
            )}
            {sensorAddMode === 'import' && (
              <DatasheetImportForm
                kind="sensor"
                onSaveSensor={(s) => {
                  addSensor(s)
                  setSensorAddMode('none')
                }}
                onCancel={() => setSensorAddMode('none')}
              />
            )}
            {sensorAddMode === 'manual' && (
              <SensorForm
                source="manual"
                onSave={(s) => {
                  addSensor(s)
                  setSensorAddMode('none')
                }}
                onCancel={() => setSensorAddMode('none')}
              />
            )}
          </Section>

          <Section title="Lenses" subtitle="Add lenses manually or from a datasheet link — then pick them per camera.">
            <ul className="divide-y divide-neutral-200">
              {lenses.map((lens) => (
                <li key={lens.id} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="text-sm font-medium text-neutral-800">{lens.name}</span>
                  <span className="text-xs text-neutral-500">
                    {lens.focalLengthMm}mm, {lens.mount}-mount, {lens.imageCircleMm}mm circle
                  </span>
                  <button onClick={() => removeLens(lens.id)} className="ml-auto text-xs text-red-600 hover:underline">
                    Remove
                  </button>
                </li>
              ))}
              {lenses.length === 0 && <li className="py-2 text-sm text-neutral-400">No lenses yet.</li>}
            </ul>

            {lensAddMode === 'none' && (
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setLensAddMode('import')} className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700">
                  From datasheet link
                </button>
                <button onClick={() => setLensAddMode('manual')} className="rounded border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100">
                  Add manually
                </button>
              </div>
            )}
            {lensAddMode === 'import' && (
              <DatasheetImportForm
                kind="lens"
                onSaveLens={(l) => {
                  addLens(l)
                  setLensAddMode('none')
                }}
                onCancel={() => setLensAddMode('none')}
              />
            )}
            {lensAddMode === 'manual' && (
              <LensForm
                source="manual"
                onSave={(l) => {
                  addLens(l)
                  setLensAddMode('none')
                }}
                onCancel={() => setLensAddMode('none')}
              />
            )}
          </Section>
        </aside>

        {/* Main column: the side-by-side camera comparison, plus the 2D size chart and lens table. */}
        <main className="flex min-w-0 flex-col gap-6">
          <Section
            title="Application wizard"
            subtitle="Describe the imaging task — target field of view (or smallest feature), working distance, interface and shutter needs — and get the required focal range plus a ranked shortlist."
          >
            <WizardPanel sensors={sensors} lenses={lenses} />
          </Section>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-neutral-800">Camera comparison</h2>
              <p className="text-sm text-neutral-500">
                Each panel is one camera at the same shared scale, so the 3D views are a genuine 1:1 comparison.
              </p>
            </div>
            <button
              onClick={addCamera}
              disabled={maxedOut}
              className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              + Add camera{maxedOut ? ' (max 4)' : ''}
            </button>
          </div>

          <div className={`grid gap-4 ${gridColsClass}`}>
            {resolved.map(({ cam, sensor, lens, effectiveWd }, index) => {
              const { min: sliderMin, max: sliderMax } = getSliderBounds(lens?.focalLengthMm ?? null)
              return (
                <section key={cam.id} className="flex flex-col gap-3 rounded-xl bg-slate-950 p-4 shadow-lg ring-1 ring-slate-900/10">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-100">Camera {index + 1}</p>
                    {cameras.length > 1 && (
                      <button onClick={() => removeCamera(cam.id)} className="text-xs text-slate-400 hover:text-red-300">
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1 text-xs text-slate-300">
                      <span>Sensor</span>
                      <select
                        className="rounded-md border border-slate-700 bg-slate-800 p-1.5 text-sm text-slate-100"
                        value={sensor?.id ?? ''}
                        onChange={(e) => updateCamera(cam.id, { sensorId: e.target.value })}
                      >
                        {sensors.length === 0 && <option value="">No sensors yet</option>}
                        {sensors.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-slate-300">
                      <span>Lens</span>
                      <select
                        className="rounded-md border border-slate-700 bg-slate-800 p-1.5 text-sm text-slate-100"
                        value={lens?.id ?? ''}
                        onChange={(e) => updateCamera(cam.id, { lensId: e.target.value })}
                      >
                        {lenses.length === 0 && <option value="">No lenses yet</option>}
                        {lenses.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="flex flex-col gap-1 text-xs text-slate-300">
                    <div className="flex items-center justify-between">
                      <span>Working distance</span>
                      <span className="font-mono text-slate-100 tabular-nums">{effectiveWd}mm</span>
                    </div>
                    <input
                      type="range"
                      min={sliderMin}
                      max={sliderMax}
                      value={effectiveWd}
                      onChange={(e) => updateCamera(cam.id, { workingDistanceMm: Number(e.target.value) })}
                      className="accent-sky-400"
                    />
                  </label>

                  {sensor && lens ? (
                    <>
                      <FovCone3D
                        sensor={sensor}
                        lens={lens}
                        workingDistanceMm={effectiveWd}
                        sceneScaleMm={sharedScaleMm}
                        heightClass={panelHeight}
                      />
                      <FovReadout sensor={sensor} lens={lens} workingDistanceMm={effectiveWorkingDistance(cam, lens)} />
                    </>
                  ) : (
                    <div className={`flex ${panelHeight} items-center justify-center rounded-xl bg-slate-900 text-sm text-slate-400`}>
                      Add a sensor and a lens on the left to view this camera.
                    </div>
                  )}
                </section>
              )
            })}
          </div>

          <Section title="Sensor size comparison" subtitle="Drawn to scale from the sensors used across the cameras above.">
            <SensorCompare2D sensors={camerasSensors} />
          </Section>

          <Section
            title="Comparison: first camera's sensor vs. the lenses in play"
            subtitle="Uses Camera 1's sensor and every lens currently selected across the cameras."
          >
            {!firstSensor ? (
              <p className="text-sm text-neutral-500">Add a sensor to enable this comparison.</p>
            ) : (
              <ComparisonTable sensor={firstSensor} lenses={camerasLenses} workingDistanceMm={resolved[0]?.effectiveWd ?? 300} />
            )}
            {firstSensor && camerasLenses[0] && (
              <div className="mt-2 flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-neutral-800">
                  Why this fits (or doesn't): {firstSensor.name} + {camerasLenses[0].name}
                </h3>
                <CompatibilityExplainer sensor={firstSensor} lens={camerasLenses[0]} />
              </div>
            )}
          </Section>
        </main>
      </div>
    </div>
  )
}
