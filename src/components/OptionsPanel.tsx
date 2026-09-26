import { useMemo, useState } from 'react'
import { computeFovForLens } from '../lib/lensMath'
import { checkImageCircle, sensorDiagonalMm } from '../lib/optics'
import type { Environment } from '../lib/suggestion'
import type { CameraInterface, Lens, MountType, Sensor, ShutterType } from '../lib/types'
import { DatasheetImportForm } from './DatasheetImportForm'
import { DatasheetLinkButton } from './DatasheetLinkButton'
import { LensForm } from './LensForm'
import { SensorForm } from './SensorForm'

/** Camera+lens shortlist: checked rows become the suggestion pool / center slots. */
export interface Shortlist {
  sensorIds: string[]
  lensIds: string[]
}

export type LensTypeToggle = 'entocentric' | 'telecentric'

interface OptionsPanelProps {
  sensors: Sensor[]
  lenses: Lens[]
  shortlist: Shortlist
  onShortlistChange: (s: Shortlist) => void
  environment: Environment
  onEnvironmentChange: (env: Environment) => void
  addSensor: (s: Omit<Sensor, 'id'>) => void
  removeSensor: (id: string) => void
  addLens: (l: Omit<Lens, 'id'>) => void
  removeLens: (id: string) => void
}

const INTERFACE_OPTIONS: CameraInterface[] = ['GigE', 'USB3', 'CameraLink', 'CoaXPress', 'MIPI', 'other']

/** Minimum-format buckets (diagonal mm from the optical-format table). */
const FORMAT_OPTIONS: Array<{ label: string; minDiagonalMm: number | null }> = [
  { label: 'any format', minDiagonalMm: null },
  { label: '≥ 1/3" (6.0mm)', minDiagonalMm: 6.0 },
  { label: '≥ 1/1.8" (8.9mm)', minDiagonalMm: 8.93 },
  { label: '≥ 2/3" (11.0mm)', minDiagonalMm: 11.0 },
  { label: '≥ 1" (15.9mm)', minDiagonalMm: 15.86 },
]

/** Minimum image-circle buckets for the lens coverage filter. */
const COVERAGE_OPTIONS: Array<{ label: string; minCircleMm: number | null }> = [
  { label: 'any coverage', minCircleMm: null },
  { label: 'covers ≥ 2/3" (11mm Ø)', minCircleMm: 11.0 },
  { label: 'covers ≥ 1" (16mm Ø)', minCircleMm: 16.0 },
]

const MOUNT_OPTIONS: Array<'any' | MountType> = ['any', 'C', 'CS', 'S-mount', 'M12', 'F', 'other']

function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
}

function FilterLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">{children}</p>
}

/**
 * Left pane — database picker with filters (design doc §3.1).
 * Camera filters: search, interface, shutter, sensor format, IP-rating
 * (soft flag — the data model has no IP field yet, so unrated entries are
 * flagged, never hidden). Lens filters: mount, coverage, entocentric/
 * telecentric toggle. Environment radio feeds the suggestion engine.
 */
export function OptionsPanel({
  sensors,
  lenses,
  shortlist,
  onShortlistChange,
  environment,
  onEnvironmentChange,
  addSensor,
  removeSensor,
  addLens,
  removeLens,
}: OptionsPanelProps) {
  const [cameraSearch, setCameraSearch] = useState('')
  const [ifaceFilter, setIfaceFilter] = useState<CameraInterface[]>([])
  const [shutterFilter, setShutterFilter] = useState<'any' | ShutterType>('any')
  const [formatIdx, setFormatIdx] = useState(0)
  const [flagUnratedIp, setFlagUnratedIp] = useState(true)

  const [lensSearch, setLensSearch] = useState('')
  const [mountFilter, setMountFilter] = useState<'any' | MountType>('any')
  const [coverageIdx, setCoverageIdx] = useState(0)
  const [lensType, setLensType] = useState<LensTypeToggle>('entocentric')

  const [libraryOpen, setLibraryOpen] = useState(false)
  const [sensorAddMode, setSensorAddMode] = useState<'none' | 'manual' | 'import'>('none')
  const [lensAddMode, setLensAddMode] = useState<'none' | 'manual' | 'import'>('none')

  const minDiagonal = FORMAT_OPTIONS[formatIdx]?.minDiagonalMm ?? null
  const minCircle = COVERAGE_OPTIONS[coverageIdx]?.minCircleMm ?? null

  const filteredSensors = useMemo(() => {
    const q = cameraSearch.trim().toLowerCase()
    return sensors.filter((s) => {
      if (q && !s.name.toLowerCase().includes(q)) return false
      if (ifaceFilter.length > 0) {
        // Unknown-interface entries are flagged, not dropped.
        if (s.cameraInterface && !ifaceFilter.includes(s.cameraInterface)) return false
      }
      if (shutterFilter !== 'any' && s.shutter && s.shutter !== shutterFilter) return false
      if (minDiagonal !== null && sensorDiagonalMm(s) < minDiagonal) return false
      return true
    })
  }, [sensors, cameraSearch, ifaceFilter, shutterFilter, minDiagonal])

  /** Worst-case (largest) shortlisted sensor diagonal — the coverage reference. */
  const worstShortlisted = useMemo(() => {
    let worst: Sensor | null = null
    for (const s of sensors) {
      if (!shortlist.sensorIds.includes(s.id)) continue
      if (!worst || sensorDiagonalMm(s) > sensorDiagonalMm(worst)) worst = s
    }
    return worst
  }, [sensors, shortlist.sensorIds])

  const filteredLenses = useMemo(() => {
    const q = lensSearch.trim().toLowerCase()
    return lenses.filter((l) => {
      if (q && !l.name.toLowerCase().includes(q)) return false
      if (mountFilter !== 'any' && l.mount !== mountFilter) return false
      if (minCircle !== null && l.imageCircleMm < minCircle) return false
      return true
    })
  }, [lenses, lensSearch, mountFilter, minCircle])

  // Telecentric hook into lensMath: without a per-lens magnification spec
  // the telecentric path (FOV = dim / m) is uncomputable, so v1 shows a
  // NEEDS-VERIFY notice and falls back to the entocentric approximation.
  const telecentricGate = useMemo(() => {
    if (lensType !== 'telecentric') return null
    const dim = worstShortlisted ? sensorDiagonalMm(worstShortlisted) : 11.0
    return computeFovForLens(dim, { lensType: 'telecentric' }, 500)
  }, [lensType, worstShortlisted])

  return (
    <div className="flex flex-col gap-4">
      {/* Cameras */}
      <section className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-neutral-800">Cameras</h2>
          <p className="text-xs text-neutral-500">Check rows to shortlist them for advice + comparison.</p>
        </div>
        <input
          type="search"
          value={cameraSearch}
          onChange={(e) => setCameraSearch(e.target.value)}
          placeholder="Search cameras…"
          aria-label="Search cameras"
          className="rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
        />
        <div className="flex flex-col gap-2">
          <FilterLabel>Interface</FilterLabel>
          <div className="flex flex-wrap gap-1.5">
            {INTERFACE_OPTIONS.map((iface) => {
              const on = ifaceFilter.includes(iface)
              return (
                <button
                  key={iface}
                  onClick={() => setIfaceFilter((prev) => (on ? prev.filter((x) => x !== iface) : [...prev, iface]))}
                  aria-pressed={on}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
                    on ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-neutral-600 ring-neutral-300 hover:bg-neutral-50'
                  }`}
                >
                  {iface}
                </button>
              )
            })}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <FilterLabel>Shutter</FilterLabel>
          <div className="flex gap-1.5" role="radiogroup" aria-label="Shutter filter">
            {(['any', 'global', 'rolling'] as const).map((s) => (
              <button
                key={s}
                role="radio"
                aria-checked={shutterFilter === s}
                onClick={() => setShutterFilter(s)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
                  shutterFilter === s ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-neutral-600 ring-neutral-300 hover:bg-neutral-50'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <FilterLabel>Sensor format (minimum)</FilterLabel>
          <select
            value={formatIdx}
            onChange={(e) => setFormatIdx(Number(e.target.value))}
            className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            {FORMAT_OPTIONS.map((f, i) => (
              <option key={f.label} value={i}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-xs text-neutral-600">
          <input type="checkbox" checked={flagUnratedIp} onChange={(e) => setFlagUnratedIp(e.target.checked)} />
          Flag unrated enclosures (IP unknown — verify; never hidden)
        </label>
        <ul className="divide-y divide-neutral-200">
          {filteredSensors.map((s) => {
            const checked = shortlist.sensorIds.includes(s.id)
            return (
              <li key={s.id} className="flex flex-col gap-1 py-2">
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onShortlistChange({ ...shortlist, sensorIds: toggleId(shortlist.sensorIds, s.id) })}
                    className="mt-1"
                  />
                  <span>
                    <span className="text-sm font-medium text-neutral-800">{s.name}</span>
                    <span className="block text-xs text-neutral-500">
                      {s.widthMm.toFixed(2)}×{s.heightMm.toFixed(2)}mm · {s.cameraInterface ?? 'interface unknown — verify'} ·{' '}
                      {s.shutter ? `${s.shutter} shutter` : 'shutter unknown — verify'}
                      {flagUnratedIp && <span className="text-amber-600"> · IP: unknown — verify</span>}
                    </span>
                  </span>
                  {checked && <span className="ml-auto text-xs font-bold text-sky-600">✓</span>}
                </label>
                <span className="flex gap-2 pl-6">
                  <DatasheetLinkButton label="Datasheet" url={s.sourceUrl} className="text-xs text-blue-600 hover:underline" />
                  <button onClick={() => removeSensor(s.id)} className="text-xs text-red-600 hover:underline">
                    Remove
                  </button>
                </span>
              </li>
            )
          })}
          {filteredSensors.length === 0 && <li className="py-2 text-sm text-neutral-400">No cameras match these filters.</li>}
        </ul>
      </section>

      {/* Lenses */}
      <section className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-neutral-800">Lenses</h2>
          <p className="text-xs text-neutral-500">Check rows to shortlist them for advice + comparison.</p>
        </div>
        <input
          type="search"
          value={lensSearch}
          onChange={(e) => setLensSearch(e.target.value)}
          placeholder="Search lenses…"
          aria-label="Search lenses"
          className="rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
        />
        <div className="flex flex-col gap-1.5">
          <FilterLabel>Mount</FilterLabel>
          <select
            value={mountFilter}
            onChange={(e) => setMountFilter(e.target.value as 'any' | MountType)}
            className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            {MOUNT_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m === 'any' ? 'any mount' : m}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <FilterLabel>Coverage (minimum image circle)</FilterLabel>
          <select
            value={coverageIdx}
            onChange={(e) => setCoverageIdx(Number(e.target.value))}
            className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            {COVERAGE_OPTIONS.map((c, i) => (
              <option key={c.label} value={i}>
                {c.label}
              </option>
            ))}
          </select>
          {worstShortlisted && (
            <p className="text-xs text-neutral-500">
              Coverage judged against largest shortlisted sensor: {worstShortlisted.name} (Ø{' '}
              {sensorDiagonalMm(worstShortlisted).toFixed(1)}mm).
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <FilterLabel>Lens type</FilterLabel>
          <div className="flex gap-1.5" role="radiogroup" aria-label="Lens type">
            {(['entocentric', 'telecentric'] as const).map((t) => (
              <button
                key={t}
                role="radio"
                aria-checked={lensType === t}
                onClick={() => setLensType(t)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
                  lensType === t ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-neutral-600 ring-neutral-300 hover:bg-neutral-50'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          {telecentricGate && (
            <p className="rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800 ring-1 ring-amber-200">
              NEEDS-VERIFY — telecentric path (lensMath FOV = dim / m): {telecentricGate.message} Showing the entocentric
              approximation instead.
            </p>
          )}
        </div>
        <ul className="divide-y divide-neutral-200">
          {filteredLenses.map((l) => {
            const checked = shortlist.lensIds.includes(l.id)
            const coverage = worstShortlisted ? checkImageCircle(l, worstShortlisted).status : null
            return (
              <li key={l.id} className="flex flex-col gap-1 py-2">
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onShortlistChange({ ...shortlist, lensIds: toggleId(shortlist.lensIds, l.id) })}
                    className="mt-1"
                  />
                  <span>
                    <span className="text-sm font-medium text-neutral-800">
                      {l.name}
                      {l.focalLengthMaxMm ? ` (${l.focalLengthMm}–${l.focalLengthMaxMm}mm zoom)` : ''}
                    </span>
                    <span className="block text-xs text-neutral-500">
                      {l.focalLengthMaxMm ? `${l.focalLengthMm}–${l.focalLengthMaxMm}` : l.focalLengthMm}mm · {l.mount}-mount ·{' '}
                      {l.imageCircleMm}mm circle
                      {coverage && (
                        <span className={coverage === 'ok' ? 'text-green-700' : coverage === 'tight' ? 'text-amber-600' : 'text-red-600'}>
                          {' '}
                          · coverage: {coverage}
                        </span>
                      )}
                    </span>
                  </span>
                  {checked && <span className="ml-auto text-xs font-bold text-sky-600">✓</span>}
                </label>
                <span className="flex gap-2 pl-6">
                  <DatasheetLinkButton label="Datasheet" url={l.sourceUrl} className="text-xs text-blue-600 hover:underline" />
                  <button onClick={() => removeLens(l.id)} className="text-xs text-red-600 hover:underline">
                    Remove
                  </button>
                </span>
              </li>
            )
          })}
          {filteredLenses.length === 0 && <li className="py-2 text-sm text-neutral-400">No lenses match these filters.</li>}
        </ul>
      </section>

      {/* Environment */}
      <section className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-neutral-800">Environment</h2>
        <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Environment">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="radio" checked={environment === 'diy'} onChange={() => onEnvironmentChange('diy')} />
            DIY / lab prototype
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="radio" checked={environment === 'manufacturing'} onChange={() => onEnvironmentChange('manufacturing')} />
            Manufacturing / production line
          </label>
        </div>
        {environment === 'diy' ? (
          <p className="rounded-md bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-600 ring-1 ring-neutral-200">
            No enclosure rating strictly required; prefer USB3/MIPI, C/CS mount, off-the-shelf illumination; verify ESD handling
            only.
          </p>
        ) : (
          <p className="rounded-md bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-600 ring-1 ring-neutral-200">
            Checklist — enclosure IP rating (IP65/67 washdown?), 24&nbsp;V I/O + opto-isolation, GigE/CoaXPress lockable
            connectors, EMC/CE, global shutter for moving parts, lens lock screws + focus lock, vibration rating; budget IQ/OQ
            documentation.
          </p>
        )}
      </section>

      {/* Library + (the 5% action, collapsed) */}
      <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <button onClick={() => setLibraryOpen((v) => !v)} aria-expanded={libraryOpen} className="text-sm font-medium text-neutral-700 hover:underline">
          {libraryOpen ? '▾ Library +' : '▸ Library + (add manually / from datasheet)'}
        </button>
        {libraryOpen && (
          <div className="mt-3 flex flex-col gap-3">
            {sensorAddMode === 'none' ? (
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setSensorAddMode('import')} className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700">
                  Sensor from datasheet link
                </button>
                <button onClick={() => setSensorAddMode('manual')} className="rounded border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100">
                  Sensor manually
                </button>
              </div>
            ) : sensorAddMode === 'import' ? (
              <DatasheetImportForm
                kind="sensor"
                onSaveSensor={(s) => {
                  addSensor(s)
                  setSensorAddMode('none')
                }}
                onCancel={() => setSensorAddMode('none')}
              />
            ) : (
              <SensorForm
                source="manual"
                onSave={(s) => {
                  addSensor(s)
                  setSensorAddMode('none')
                }}
                onCancel={() => setSensorAddMode('none')}
              />
            )}
            {lensAddMode === 'none' ? (
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setLensAddMode('import')} className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700">
                  Lens from datasheet link
                </button>
                <button onClick={() => setLensAddMode('manual')} className="rounded border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100">
                  Lens manually
                </button>
              </div>
            ) : lensAddMode === 'import' ? (
              <DatasheetImportForm
                kind="lens"
                onSaveLens={(l) => {
                  addLens(l)
                  setLensAddMode('none')
                }}
                onCancel={() => setLensAddMode('none')}
              />
            ) : (
              <LensForm
                source="manual"
                onSave={(l) => {
                  addLens(l)
                  setLensAddMode('none')
                }}
                onCancel={() => setLensAddMode('none')}
              />
            )}
          </div>
        )}
      </section>
    </div>
  )
}
