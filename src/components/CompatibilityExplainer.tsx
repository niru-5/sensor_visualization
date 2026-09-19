import { explainPairing } from '../lib/fae'
import type { Lens, Sensor } from '../lib/types'

interface CompatibilityExplainerProps {
  sensor: Sensor
  lens: Lens
}

/**
 * Plain-language mount/coverage explainer for one pairing — the "why does
 * this pass/fail" behind the compatibility badges. Numbers come from
 * optics.ts via explainPairing(); only prose lives in the FAE layer.
 */
export function CompatibilityExplainer({ sensor, lens }: CompatibilityExplainerProps) {
  const explanation = explainPairing(sensor, lens)

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div className="rounded-lg bg-neutral-50 p-3 ring-1 ring-neutral-200">
        <p className="text-sm font-semibold text-neutral-800">🔭 Coverage: {explanation.coverageHeadline}</p>
        <p className="mt-1 text-xs leading-relaxed text-neutral-600">{explanation.coverageBody}</p>
      </div>
      <div className="rounded-lg bg-neutral-50 p-3 ring-1 ring-neutral-200">
        <p className="text-sm font-semibold text-neutral-800">🔩 Mount: {explanation.mountHeadline}</p>
        <p className="mt-1 text-xs leading-relaxed text-neutral-600">{explanation.mountBody}</p>
      </div>
    </div>
  )
}
