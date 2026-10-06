/**
 * Typed error taxonomy for the datasheet-extraction pipeline.
 *
 * Every failure that crosses the fetch/parse/model boundary is thrown as a
 * DatasheetError carrying a machine-readable `code` and the HTTP `status`
 * the API layer should respond with. This replaces the old regex-on-message
 * status mapping in the HTTP handlers, which was brittle (any reworded
 * message silently changed the status code).
 */
export type DatasheetErrorCode =
  | 'INVALID_URL'
  | 'UNSUPPORTED_PROTOCOL'
  | 'FETCH_FAILED'
  | 'FETCH_TIMEOUT'
  | 'UPSTREAM_NOT_FOUND'
  | 'UPSTREAM_FORBIDDEN'
  | 'UPSTREAM_ERROR'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_CONTENT'
  | 'PDF_READER_UNAVAILABLE'
  | 'PDF_ENCRYPTED'
  | 'PDF_CORRUPT'
  | 'PDF_READ_ERROR'
  | 'PDF_IMAGE_ONLY'
  | 'EMPTY_CONTENT'
  | 'MISSING_API_KEY'
  | 'MODEL_NO_TOOL_USE'

export class DatasheetError extends Error {
  readonly code: DatasheetErrorCode
  readonly status: number

  constructor(code: DatasheetErrorCode, status: number, message: string) {
    super(message)
    this.name = 'DatasheetError'
    this.code = code
    this.status = status
  }
}

export function isDatasheetError(err: unknown): err is DatasheetError {
  return err instanceof DatasheetError
}
