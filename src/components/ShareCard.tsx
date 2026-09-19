import { useState } from 'react'

interface ShareCardProps {
  heading: string
  sub: string
  text: string
}

/**
 * Shareable shortlist card: the top pairing plus its key numbers, with a
 * copy-to-clipboard button. Sharing stays client-side (paste it into a
 * ticket/email) — there is deliberately no cloud storage in v1, per the
 * out-of-scope list in requirements.md.
 */
export function ShareCard({ heading, sub, text }: ShareCardProps) {
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)

  async function handleCopy() {
    setCopyFailed(false)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      // Clipboard API unavailable (permissions, insecure context) — the
      // <details> block below keeps the text manually copyable.
      setCopyFailed(true)
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3">
      <div>
        <p className="text-xs font-semibold tracking-wide text-emerald-700 uppercase">Top pick — shareable</p>
        <p className="text-sm font-semibold text-neutral-900">{heading}</p>
        <p className="text-xs text-neutral-600">{sub}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="rounded bg-emerald-700 px-3 py-1.5 text-sm text-white hover:bg-emerald-800"
        >
          {copied ? 'Copied!' : 'Copy summary'}
        </button>
        {copyFailed && <span className="text-xs text-amber-700">Clipboard blocked — expand and copy manually below.</span>}
      </div>
      <details className="text-xs text-neutral-600">
        <summary className="cursor-pointer hover:underline">Preview text</summary>
        <pre className="mt-1 rounded bg-white p-2 whitespace-pre-wrap ring-1 ring-neutral-200">{text}</pre>
      </details>
    </div>
  )
}
