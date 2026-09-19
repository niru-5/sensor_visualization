import { useState } from 'react'
import type { EntrySource, Lens, MountType } from '../lib/types'
import { BLANK_LENS_DRAFT, type LensDraft } from './formDrafts'

const MOUNTS: MountType[] = ['C', 'CS', 'S-mount', 'M12', 'F', 'other']

interface LensFormProps {
  initial?: LensDraft
  missingFields?: Set<keyof LensDraft>
  source: EntrySource
  sourceUrl?: string
  onSave: (lens: Omit<Lens, 'id'>) => void
  onCancel: () => void
}

function labelClass(missing: boolean) {
  return missing ? 'text-amber-700' : 'text-neutral-700'
}

export function LensForm({ initial, missingFields, source, sourceUrl, onSave, onCancel }: LensFormProps) {
  const [draft, setDraft] = useState<LensDraft>(initial ?? BLANK_LENS_DRAFT)
  const [error, setError] = useState<string | null>(null)

  const isMissing = (field: keyof LensDraft) => missingFields?.has(field) ?? false

  function set<K extends keyof LensDraft>(key: K, value: LensDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit() {
    const focalLengthMm = Number(draft.focalLengthMm)
    const imageCircleMm = Number(draft.imageCircleMm)
    const maxAperture = draft.maxAperture ? Number(draft.maxAperture) : undefined
    const resolvingPowerLpMm = draft.resolvingPowerLpMm ? Number(draft.resolvingPowerLpMm) : undefined

    if (!draft.name.trim()) return setError('Name is required.')
    if (!(focalLengthMm > 0)) return setError('Focal length (mm) must be a positive number.')
    if (!(imageCircleMm > 0)) return setError('Image circle diameter (mm) must be a positive number.')

    onSave({
      name: draft.name.trim(),
      focalLengthMm,
      mount: draft.mount,
      imageCircleMm,
      maxAperture,
      resolvingPowerLpMm,
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

        <label className="flex flex-col gap-1 text-sm">
          <span className={labelClass(isMissing('focalLengthMm'))}>
            Focal length (mm) {isMissing('focalLengthMm') && '(not found)'}
          </span>
          <input
            className="rounded border border-neutral-300 p-1.5"
            value={draft.focalLengthMm}
            onChange={(e) => set('focalLengthMm', e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className={labelClass(isMissing('imageCircleMm'))}>
            Image circle diameter (mm) {isMissing('imageCircleMm') && '(not found)'}
          </span>
          <input
            className="rounded border border-neutral-300 p-1.5"
            value={draft.imageCircleMm}
            onChange={(e) => set('imageCircleMm', e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className={labelClass(isMissing('maxAperture'))}>Max aperture (f/#) — optional</span>
          <input
            className="rounded border border-neutral-300 p-1.5"
            value={draft.maxAperture}
            onChange={(e) => set('maxAperture', e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className={labelClass(isMissing('resolvingPowerLpMm'))}>Resolving power (lp/mm) — optional</span>
          <input
            className="rounded border border-neutral-300 p-1.5"
            value={draft.resolvingPowerLpMm}
            onChange={(e) => set('resolvingPowerLpMm', e.target.value)}
          />
        </label>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="flex gap-2">
        <button type="button" onClick={handleSubmit} className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700">
          Save lens
        </button>
        <button type="button" onClick={onCancel} className="rounded border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100">
          Cancel
        </button>
      </div>
    </div>
  )
}
