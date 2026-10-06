import type { ExtractKind, ExtractResponse } from '../../src/lib/extraction.js'
import { extractFieldsFromText } from './callExtractionModel.js'
import { DatasheetError } from './errors.js'
import { fetchDatasheetText } from './fetchContent.js'

/** Stateless: fetch the URL, pull out text, ask the model for structured fields. Nothing is persisted here. */
export async function extractFromUrl(url: string, kind: ExtractKind): Promise<ExtractResponse> {
  const { text } = await fetchDatasheetText(url)
  if (!text.trim()) {
    // Empty HTML/unknown pages (and PDF interstitials routed to HTML) still
    // surface as a plain 422 response — only scanned PDFs throw the richer
    // PDF_IMAGE_ONLY error from the fetch layer.
    throw new DatasheetError(
      'EMPTY_CONTENT',
      422,
      'Could not extract any text from that URL (scanned/image-only PDFs are not supported).',
    )
  }
  return extractFieldsFromText(text, kind)
}
