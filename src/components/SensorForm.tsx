import { useState } from 'react'
import { opticalFormatToMm } from '../lib/opticalFormats'
import type { CameraInterface, EntrySource, MountType, Sensor, ShutterType } from '../lib/types'
import { BLANK_SENSOR_DRAFT, type SensorDraft } from './formDrafts'

const MOUNTS: MountType[] = ['C', 'CS', 'S-mount', 'M12', 'F', 'other']
const INTERFACES: CameraInterface[] = ['GigE', 'USB3', 'CameraLink', 'CoaXPress', 'MIPI', 'other']
const SHUTTERS: ShutterType[] = ['global', 'rolling']

interface SensorFormProps {
  initial?: SensorDraft
  /** Field names present in this set were flagged as "not found" by datasheet extraction. */
  missingFields?: Set<keyof SensorDraft>
  source: EntrySource
  sourceUrl?: string
  onSave: (sensor: Omit<Sensor, 'id'>) => void
  onCancel: () => void
}

function labelClass(missing: boolean) {
  return missing ? 'text-amber-700' : 'text-neutral-700'
}

export function SensorForm({ initial, missingFields, source, sourceUrl, onSave, onCancel }: SensorFormProps) {
  const [draft, setDraft] = useState<SensorDraft>(initial ?? BLANK_SENSOR_DRAFT)
  const [error, setError] = useState<string | null>(null)

  const isMissing = (field: keyof SensorDraft) => missingFields?.has(field) ?? false

  function set<K extends keyof SensorDraft>(key: K, value: SensorDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  function applyOpticalFormat() {
    const mm = opticalFormatToMm(draft.opticalFormat)
    if (mm) {
      setDraft((prev) => ({ ...prev, widthMm: String(mm.widthMm), heightMm: String(mm.heightMm) }))
      setError(null)
    } else if (draft.opticalFormat.trim()) {
      setError(`"${draft.opticalFormat}" isn't a recognized optical format — enter width/height in mm directly.`)
    }
  }

  function handleSubmit() {
    const widthMm = Number(draft.widthMm)
    const heightMm = Number(draft.heightMm)
    const resolutionH = Number(draft.resolutionH)
    const resolutionV = Number(draft.resolutionV)
    const pixelPitchUm = draft.pixelPitchUm ? Number(draft.pixelPitchUm) : undefined

    if (!draft.name.trim()) return setError('Name is required.')
    if (!(widthMm > 0) || !(heightMm > 0)) return setError('Active area width/height (mm) must be positive numbers.')
    if (!(resolutionH > 0) || !(resolutionV > 0)) return setError('Resolution must be positive numbers.')

    onSave({
      name: draft.name.trim(),
      opticalFormat: draft.opticalFormat.trim() || undefined,
      widthMm,
      heightMm,
      resolutionH,
      resolutionV,
      pixelPitchUm,
      mount: draft.mount,
      cameraInterface: draft.cameraInterface ? (draft.cameraInterface as CameraInterface) : undefined,
      shutter: draft.shutter ? (draft.shutter as ShutterType) : undefined,
      source,
      sourceUrl,
    })
  }

  return (
    <div className="flex flex-col gap-3 rounded border border-neutral-200 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className={labelClass(isMissing('name'))}>Name {isMissing('name') && '(not found — please fill in)'}</span>
          <input className="rounded border border-neutral-300 p-1.5" value={draft.name} onChange={(e) => set('name', e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className={labelClass(isMissing('mount'))}>Mount</span>
          <select
            className="rounded border border-neutral-300 p-1.5"
            value={draft.mount}
            onChange={(e) => set('mount', e.target.value as MountType)}
          >
            {MOUNTS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className={labelClass(isMissing('opticalFormat'))}>
            Optical format (e.g. 2/3", 1/1.8") — optional, fills width/height below
          </span>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded border border-neutral-300 p-1.5"
              value={draft.opticalFormat}
              onChange={(e) => set('opticalFormat', e.target.value)}
              placeholder='e.g. 2/3"'
            />
            <button type="button" onClick={applyOpticalFormat} className="rounded border border-neutral-300 px-3 text-sm hover:bg-neutral-100">
              Apply
            </button>
          </div>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className={labelClass(isMissing('widthMm'))}>Active width (mm) {isMissing('widthMm') && '(not found)'}</span>
          <input className="rounded border border-neutral-300 p-1.5" value={draft.widthMm} onChange={(e) => set('widthMm', e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className={labelClass(isMissing('heightMm'))}>Active height (mm) {isMissing('heightMm') && '(not found)'}</span>
          <input className="rounded border border-neutral-300 p-1.5" value={draft.heightMm} onChange={(e) => set('heightMm', e.target.value)} />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className={labelClass(isMissing('resolutionH'))}>Resolution H (px) {isMissing('resolutionH') && '(not found)'}</span>
          <input
            className="rounded border border-neutral-300 p-1.5"
            value={draft.resolutionH}
            onChange={(e) => set('resolutionH', e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className={labelClass(isMissing('resolutionV'))}>Resolution V (px) {isMissing('resolutionV') && '(not found)'}</span>
          <input
            className="rounded border border-neutral-300 p-1.5"
            value={draft.resolutionV}
            onChange={(e) => set('resolutionV', e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className={labelClass(isMissing('pixelPitchUm'))}>Pixel pitch (um) — optional, derived if blank</span>
          <input
            className="rounded border border-neutral-300 p-1.5"
            value={draft.pixelPitchUm}
            onChange={(e) => set('pixelPitchUm', e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className={labelClass(false)}>Camera interface — optional, used by wizard filters</span>
          <select
            className="rounded border border-neutral-300 p-1.5"
            value={draft.cameraInterface}
            onChange={(e) => set('cameraInterface', e.target.value)}
          >
            <option value="">Not specified</option>
            {INTERFACES.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className={labelClass(false)}>Shutter — optional, used by wizard filters</span>
          <select
            className="rounded border border-neutral-300 p-1.5"
            value={draft.shutter}
            onChange={(e) => set('shutter', e.target.value)}
          >
            <option value="">Not specified</option>
            {SHUTTERS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="flex gap-2">
        <button type="button" onClick={handleSubmit} className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700">
          Save sensor
        </button>
        <button type="button" onClick={onCancel} className="rounded border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100">
          Cancel
        </button>
      </div>
    </div>
  )
}
