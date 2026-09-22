import { resolveDatasheetHref } from '../lib/scaleReference';

interface DatasheetLinkButtonProps {
  /** Button text, e.g. "Open sensor datasheet". */
  label: string;
  /**
   * Datasheet URL. `null`/`undefined`/blank means the entry has no known
   * source (e.g. added manually) — the button renders nothing.
   */
  url: string | null | undefined;
  className?: string;
}

/**
 * Per-camera "open datasheet" link button.
 * Missing-data handling: renders nothing when `url` is null/undefined/blank.
 */
export function DatasheetLinkButton({ label, url, className }: DatasheetLinkButtonProps) {
  const href = resolveDatasheetHref(url);
  if (href === null) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className={className ?? 'rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50'}
    >
      {label}
    </a>
  );
}
