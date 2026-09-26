import { useMemo, useState } from 'react'
import { MAX_CAMERAS } from '../lib/twoCamera'
import type { CameraFamilyId } from '../lib/database/cameras'
import type { Lens, Sensor } from '../lib/types'
import { parseAdviceQuery, suggest, type Environment, type Suggestion } from '../lib/suggestion'

interface AdvicePanelProps {
  sensors: Sensor[]
  lenses: Lens[]
  environment: Environment
  /** Explicit sensor-id → family map; seed sensors lack vendor, so name inference applies otherwise. */
  sensorFamily?: Record<string, CameraFamilyId>
  onApplySuggestions: (pairs: Array<{ sensorId: string; lensId: string }>) => void
}

const VERDICT_STYLE: Record<Suggestion['verdict'], string> = {
  fit: 'bg-green-100 text-green-800 ring-green-300',
  marginal: 'bg-amber-100 text-amber-800 ring-amber-300',
  'no-fit': 'bg-red-100 text-red-800 ring-red-300',
}

function EvidenceBadge({ status, claim, url, note }: Suggestion['evidence'][number]) {
  const verified = status === 'VERIFIED'
  return (
    <span
      title={[claim, note].filter(Boolean).join(' — ')}
      className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ring-1 ${
        verified ? 'bg-green-50 text-green-700 ring-green-300' : 'bg-amber-50 text-amber-700 ring-amber-300'
      }`}
    >
      [{status}]
      {verified && url ? (
        <a href={url} target="_blank" rel="noreferrer noopener" className="ml-1 underline" onClick={(e) => e.stopPropagation()}>
          source
        </a>
      ) : null}
    </span>
  )
}

/**
 * Right pane — prompt box + rule-based answer cards (design doc §3.3).
 * Free text → parseAdviceQuery chips echo → suggest() ranked cards with
 * verdict, reasons, VERIFIED/NEEDS-VERIFY evidence and failedChecks.
 * [Use top-N in comparison] writes pairs into the center slots.
 */
export function AdvicePanel({ sensors, lenses, environment, sensorFamily, onApplySuggestions }: AdvicePanelProps) {
  const [draft, setDraft] = useState('')
  const [question, setQuestion] = useState<string | null>(null)
  const [topN, setTopN] = useState(2)

  const parsed = useMemo(() => (question === null ? null : parseAdviceQuery(question)), [question])

  const suggestions = useMemo(() => {
    if (question === null) return []
    return suggest(question, {
      sensors,
      lenses,
      environment,
      // Seed sensors carry no vendor tag, so family resolution falls back
      // to familyForSensor name-keyword inference inside suggest().
      sensorFamily,
      defaultWorkingDistanceMm: 500,
      defaultFovHmm: 300,
      defaultFovVmm: 225,
    })
  }, [question, sensors, lenses, environment, sensorFamily])

  const clampedN = Math.max(1, Math.min(MAX_CAMERAS, Math.floor(topN) || 2))

  function handleAsk() {
    if (draft.trim().length === 0) return
    setQuestion(draft.trim())
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-neutral-800">Ask</h2>
        <label className="flex flex-col gap-2">
          <span className="text-xs text-neutral-500">
            Describe the task in your own words — e.g. “inspect 2 mm screws on a 300 mm tray from 500 mm, GigE, line moves
            fast”.
          </span>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder="What should I pick, and why?"
            className="rounded border border-neutral-300 px-2.5 py-1.5 text-sm"
          />
        </label>
        <button
          onClick={handleAsk}
          disabled={draft.trim().length === 0}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Ask
        </button>
        {parsed && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
              We read: {parsed.chips.length > 0 ? '' : '(nothing parseable — showing unranked defaults)'}
            </p>
            {parsed.chips.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {parsed.chips.map((chip) => (
                  <span key={chip} className="rounded-full bg-sky-50 px-2.5 py-1 text-xs text-sky-800 ring-1 ring-sky-200">
                    {chip}
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs text-neutral-400">✎ Wrong? Edit the prompt above and Ask again.</p>
          </div>
        )}
      </section>

      {question !== null && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-neutral-800">Answer ({suggestions.length})</h2>
            <label className="flex items-center gap-1.5 text-xs text-neutral-600">
              Top
              <input
                type="number"
                min={1}
                max={MAX_CAMERAS}
                value={clampedN}
                onChange={(e) => setTopN(Number(e.target.value))}
                className="w-12 rounded border border-neutral-300 px-1.5 py-1 text-sm"
              />
              <button
                onClick={() =>
                  onApplySuggestions(
                    suggestions.slice(0, clampedN).map((s) => ({ sensorId: s.cameraId, lensId: s.lensId })),
                  )
                }
                disabled={suggestions.length === 0}
                className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Use top-{clampedN} in comparison
              </button>
            </label>
          </div>
          {suggestions.length === 0 && (
            <p className="rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-500 shadow-sm">
              No sensor×lens pairs to rank — add entries in the left panel's Library + section.
            </p>
          )}
          {suggestions.map((s) => {
            const failing = s.failedChecks.filter((c) => !c.pass)
            return (
              <article key={`${s.cameraId}×${s.lensId}`} className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-neutral-400">#{s.rank}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${VERDICT_STYLE[s.verdict]}`}>
                    {s.verdict}
                  </span>
                  <span className="ml-auto text-sm font-semibold text-neutral-800 tabular-nums">{s.score}</span>
                </div>
                <p className="text-sm font-medium text-neutral-800">
                  {s.cameraName} + {s.lensName}
                </p>
                <p className="text-xs text-neutral-500 tabular-nums">
                  {s.fovHmm !== null && s.fovVmm !== null ? (
                    <>
                      FOV {s.fovHmm.toFixed(0)}×{s.fovVmm.toFixed(0)}mm
                    </>
                  ) : (
                    <>FOV — </>
                  )}
                  {s.mmPerPixelH !== null ? <> · {s.mmPerPixelH.toFixed(4)}mm/px</> : null} · coverage {s.coverage} · mount{' '}
                  {s.mountCompatible ? 'ok' : 'mismatch'}
                </p>
                {s.reasons.length > 0 && (
                  <ul className="list-disc pl-5 text-xs text-neutral-600">
                    {s.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                )}
                {s.evidence.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {s.evidence.map((e) => (
                      <EvidenceBadge key={e.claim} {...e} />
                    ))}
                  </div>
                )}
                {failing.length > 0 && (
                  <ul className="flex flex-col gap-1">
                    {failing.map((f) => (
                      <li key={`${f.check}-${f.message}`} className="rounded bg-red-50 px-2 py-1 text-xs text-red-700 ring-1 ring-red-200">
                        {f.message}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            )
          })}
        </section>
      )}
    </div>
  )
}
