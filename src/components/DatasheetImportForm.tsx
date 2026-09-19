import { useState } from 'react'
import type { ExtractKind, ExtractResponse } from '../lib/extraction'
import type { Lens, Sensor } from '../lib/types'
import { BLANK_LENS_DRAFT, BLANK_SENSOR_DRAFT, type LensDraft, type SensorDraft } from './formDrafts'
import { LensForm } from './LensForm'
import { SensorForm } from './SensorForm'

type SuccessResponse = Extract<ExtractResponse, { kind: 'sensor' | 'lens' }>

function fieldsToDraft<D extends object>(
  fields: Record<keyof D, { value: unknown; found: boolean }>,
  blank: D,
): { draft: D; missing: Set<keyof D> } {
  const missing = new Set<keyof D>()
  const draft: Record<string, unknown> = { ...(blank as Record<string, unknown>) }
  for (const key of Object.keys(fields) as (keyof D)[]) {
    const field = fields[key]
    if (!field.found || field.value === null || field.value === undefined) {
      missing.add(key)
    } else {
      draft[key as string] = String(field.value)
    }
  }
  return { draft: draft as D, missing }
}

interface DatasheetImportFormProps {
  kind: ExtractKind
  onSaveSensor?: (sensor: Omit<Sensor, 'id'>) => void
  onSaveLens?: (lens: Omit<Lens, 'id'>) => void
  onCancel: () => void
}

/**
 * Paste a datasheet link -> fetch+extract server-side -> review the
 * pre-filled, editable form -> confirm to save. Nothing is saved without
 * the confirm step (requirements.md §3.1).
 */
export function DatasheetImportForm({ kind, onSaveSensor, onSaveLens, onCancel }: DatasheetImportFormProps) {
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [result, setResult] = useState<SuccessResponse | null>(null)

  async function handleExtract() {
    if (!url.trim()) return
    setStatus('loading')
    setErrorMessage(null)
    setResult(null)
    try {
      const res = await fetch('/api/extract-datasheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), kind }),
      })
      // Read as text first: the dev proxy / serverless host can return a
      // non-JSON error page (or nothing) when the endpoint is down, and
      // res.json() would throw a confusing "Unexpected token" message.
      const raw = await res.text()
      let json: ExtractResponse | { error: string }
      try {
        json = raw ? (JSON.parse(raw) as ExtractResponse) : { error: 'The extraction service returned an empty response.' }
      } catch {
        json = { error: `The extraction service returned an unreadable response (HTTP ${res.status}). Is the API server running?` }
      }
      if (!res.ok || 'error' in json) {
        const serverMessage = 'error' in json ? json.error : `Extraction failed (HTTP ${res.status}).`
        setErrorMessage(
          res.status === 503
            ? `${serverMessage} You can still enter the specs manually below.`
            : serverMessage,
        )
        setStatus('error')
        return
      }
      setResult(json)
      setStatus('idle')
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? `Could not reach the extraction service (${err.message}). Is the dev API server running?`
          : 'Could not reach the extraction service.',
      )
      setStatus('error')
    }
  }

  if (result && result.kind === 'sensor' && onSaveSensor) {
    const { draft, missing } = fieldsToDraft<SensorDraft>(result.fields, BLANK_SENSOR_DRAFT)
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-neutral-600">
          Extracted from <span className="break-all font-mono text-xs">{url}</span>. Review and fix anything flagged
          below, then save.
        </p>
        <SensorForm initial={draft} missingFields={missing} source="datasheet-import" sourceUrl={url} onSave={onSaveSensor} onCancel={onCancel} />
      </div>
    )
  }

  if (result && result.kind === 'lens' && onSaveLens) {
    const { draft, missing } = fieldsToDraft<LensDraft>(result.fields, BLANK_LENS_DRAFT)
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-neutral-600">
          Extracted from <span className="break-all font-mono text-xs">{url}</span>. Review and fix anything flagged
          below, then save.
        </p>
        <LensForm initial={draft} missingFields={missing} source="datasheet-import" sourceUrl={url} onSave={onSaveLens} onCancel={onCancel} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded border border-neutral-200 p-4">
      <label className="flex flex-col gap-1 text-sm">
        <span>Datasheet link (PDF or vendor spec page)</span>
        <input
          className="rounded border border-neutral-300 p-1.5"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
        />
      </label>
      {status === 'error' && (
        <p role="alert" className="text-sm text-red-700">
          {errorMessage}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleExtract}
          disabled={status === 'loading' || !url.trim()}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {status === 'loading' ? 'Extracting…' : 'Extract'}
        </button>
        <button type="button" onClick={onCancel} className="rounded border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100">
          Cancel
        </button>
      </div>
    </div>
  )
}
