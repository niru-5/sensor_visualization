import type { ExtractKind, ExtractResponse } from '../../src/lib/extraction.js'
import { extractFieldsFromText } from './callExtractionModel.js'
import { fetchDatasheetText } from './fetchContent.js'

/** Stateless: fetch the URL, pull out text, ask the model for structured fields. Nothing is persisted here. */
export async function extractFromUrl(url: string, kind: ExtractKind): Promise<ExtractResponse> {
  const { text } = await fetchDatasheetText(url)
  if (!text.trim()) {
    return { error: 'Could not extract any text from that URL (scanned/image-only PDFs are not supported).' }
  }
  return extractFieldsFromText(text, kind)
}
