import { useEffect, useMemo, useRef, useState } from 'react'
import { AdvicePanel } from './components/AdvicePanel'
import { ErrorBoundary } from './components/ErrorBoundary'
import { FovReadout } from './components/FovReadout'
import { OptionsPanel, type Shortlist } from './components/OptionsPanel'
import { SharedFovView } from './components/SharedFovView'
import { useAppData } from './store/useAppData'
import type { Environment } from './lib/suggestion'
import {
  MAX_CAMERAS,
  addCameraSlot,
  computeTwoCameraView,
  createSlot,
  effectiveWorkingDistance,
  getSliderBounds,
  loadCameraSlots,
  removeCameraSlot,
  saveCameraSlots,
  updateCameraSlot,
} from './lib/twoCamera'
import type { CameraSlot } from './lib/twoCamera'

/**
 * 3-pane layout (docs/UI-DESIGN-3PANE.md): left OptionsPanel (pickers +
 * filters), center SharedFovView (always-shared comparison stage), right
 * AdvicePanel (prompt → suggest() answer cards that drive the center).
 * No tabs, no shared/separate toggle — the stage is always the shared POV.
 */
export default function App() {
  const { sensors, lenses, addSensor, removeSensor, addLens, removeLens, exportJson, importJson } = useAppData()

  const [environment, setEnvironment] = useState<Environment>('diy')
  const [shortlist, setShortlist] = useState<Shortlist>({ sensorIds: [], lensIds: [] })

  // The camera comparison slots. Restored from localStorage when present so
  // a comparison survives reload; otherwise start with a single camera.
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

  // Shortlisted entries form the suggestion pool; with nothing checked the
  // whole library is the pool.
  const poolSensors = useMemo(
    () => (shortlist.sensorIds.length > 0 ? sensors.filter((s) => shortlist.sensorIds.includes(s.id)) : sensors),
    [sensors, shortlist.sensorIds],
  )
  const poolLenses = useMemo(
    () => (shortlist.lensIds.length > 0 ? lenses.filter((l) => shortlist.lensIds.includes(l.id)) : lenses),
    [lenses, shortlist.lensIds],
  )

  // Right → center drive: top-N suggestion pairs become the stage slots,
  // clamped to MAX_CAMERAS, and join the shortlist so the pool stays in sync.
  function applySuggestions(pairs: Array<{ sensorId: string; lensId: string }>) {
    const top = pairs.slice(0, MAX_CAMERAS)
    if (top.length === 0) return
    setCameras(top.map((p) => createSlot(p.sensorId, p.lensId)))
    setShortlist({
      sensorIds: [...new Set(top.map((p) => p.sensorId))],
      lensIds: [...new Set(top.map((p) => p.lensId))],
    })
  }

  // Resolve each slot + shared 1:1 scale via the tested lib helpers (single
  // source of truth with src/lib/twoCamera.test.ts).
  const view = useMemo(() => computeTwoCameraView(sensors, lenses, cameras), [sensors, lenses, cameras])
  const resolved = view.resolved
  // Shared world scale across every frustum → identical camera position and true 1:1 framing.
  const sharedScaleMm = view.sharedScale

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

  const maxedOut = cameras.length >= MAX_CAMERAS

  return (
    <div className="min-h-screen bg-neutral-100">
      <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white">CL</span>
            <div>
              <h1 className="text-lg font-bold leading-tight text-neutral-900">Camera &amp; Lens Selection Tool</h1>
              <p className="text-xs text-neutral-500">Pick options left, compare them center stage, get advice right.</p>
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

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 p-4 sm:p-6 lg:grid-cols-[320px_1fr_340px] lg:items-start">
        {importError && <p className="text-sm text-red-700 lg:col-span-3">{importError}</p>}

        {/* Left — options */}
        <div className="order-3 min-w-0 lg:order-1 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
          <OptionsPanel
            sensors={sensors}
            lenses={lenses}
            shortlist={shortlist}
            onShortlistChange={setShortlist}
            environment={environment}
            onEnvironmentChange={setEnvironment}
            addSensor={addSensor}
            removeSensor={removeSensor}
            addLens={addLens}
            removeLens={removeLens}
          />
        </div>

        {/* Center — always-shared comparison stage */}
        <main className="order-2 flex min-w-0 flex-col gap-4 lg:order-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-neutral-800">Comparison</h2>
              <p className="text-sm text-neutral-500">
                All cameras share one 3D stage at the same viewpoint — a genuine 1:1 comparison.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={addCamera}
                disabled={maxedOut}
                className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                + Add camera{maxedOut ? ` (max ${MAX_CAMERAS})` : ''}
              </button>
            </div>
          </div>

          <ErrorBoundary key="shared-fov-view" label="SharedFovView">
            <SharedFovView slots={resolved} sharedScaleMm={sharedScaleMm} heightClass="h-[480px]" />
          </ErrorBoundary>

          {/* Interface / shutter badges + readout strip under the stage */}
          <div className="flex flex-col gap-4">
            {resolved.map(({ cam, sensor, lens, effectiveWd }, index) => {
              const { min: sliderMin, max: sliderMax } = getSliderBounds(lens?.focalLengthMm ?? null)
              return (
                <section key={cam.id} className="flex flex-col gap-3 rounded-xl bg-slate-950 p-4 shadow-lg ring-1 ring-slate-900/10 sm:p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-100">
                      Camera {index + 1}
                      {sensor && lens ? `: ${sensor.name} + ${lens.name}` : ''}
                    </p>
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300 ring-1 ring-white/10">
                      {sensor?.cameraInterface ? `${sensor.cameraInterface} ✓` : 'interface unknown — verify'}
                    </span>
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300 ring-1 ring-white/10">
                      {sensor?.shutter
                        ? sensor.shutter === 'global'
                          ? 'global ✓ for motion'
                          : 'rolling — motion blur risk, consider global'
                        : 'shutter unknown — verify'}
                    </span>
                    {cameras.length > 1 && (
                      <button onClick={() => removeCamera(cam.id)} className="ml-auto text-xs text-slate-400 hover:text-red-300">
                        Remove
                      </button>
                    )}
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
                    <FovReadout sensor={sensor} lens={lens} workingDistanceMm={effectiveWorkingDistance(cam, lens)} />
                  ) : (
                    <p className="text-sm text-slate-400">Add a sensor and a lens on the left to view this camera.</p>
                  )}
                </section>
              )
            })}
          </div>
        </main>

        {/* Right — advice */}
        <div className="order-1 min-w-0 lg:order-3 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
          <AdvicePanel
            sensors={poolSensors}
            lenses={poolLenses}
            environment={environment}
            onApplySuggestions={applySuggestions}
          />
        </div>
      </div>
    </div>
  )
}
