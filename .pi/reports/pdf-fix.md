# PDF datasheet import fix

## Root cause

Pasting a direct PDF URL failed end-to-end (empty/garbage draft, or a raw
`HTTP 500` in the UI) for four compounding reasons, all in the fetch/parse
layer — the model call and the review form were fine:

1. **PDF detection relied on headers/URL only** (`api/_lib/fetchContent.ts`).
   Many hosts serve PDFs as `application/octet-stream` or behind signed /
   `download?token=…` URLs with no `.pdf` path. Those responses fell through
   to cheerio HTML parsing, producing garbage or empty text, which then
   surfaced as the generic "scanned/image-only" message or a nonsense draft.
2. **Bare fetch headers.** The request sent only a custom `User-Agent`.
   Vendor sites and CDN bot protection (Cloudflare/Akamai) commonly 403 or
   serve challenge pages to non-browser clients. There was also no timeout,
   so a hung host hung the serverless call.
3. **pdfjs errors were unhandled.** `extractPdfText()` had no try/catch, so
   encrypted/corrupt PDFs or viewer-page HTML saved as ".pdf" threw raw
   stack traces → generic 500 with no actionable message, and the document
   was never released.
4. **Missing `ANTHROPIC_API_KEY` was a 500 with an internal reference.**
   `callExtractionModel.ts` threw `'…see docs/LEARNINGS.md for setup'`,
   which leaks repo internals to end users and misclassifies a config
   problem as a server crash. The UI also called `res.json()` directly, so
   a down API/proxy produced `Unexpected token…` instead of a helpful line.

## Files changed

- **`api/_lib/fetchContent.ts`**
  - Browser-like request headers (`User-Agent`, `Accept: application/pdf,…`,
    `Accept-Language`) + `redirect: 'follow'` + 30 s `AbortSignal.timeout`.
  - Friendly errors for timeout/network failure, 404, and 401/403
    (explains vendor bot-blocking, suggests manual download).
  - PDF routing is now header → **magic-byte sniff (`%PDF-`)** → `.pdf`
    path, so octet-stream and signed-URL PDFs reach the PDF parser.
  - `.pdf` path with an HTML content-type is treated as an interstitial
    (login/bot wall), not fed to the PDF parser.
  - Opaque binary blobs are rejected with an "unsupported content-type"
    message (readability heuristic: ≥ 4 alphanumerics).
  - `extractPdfText()` wraps load/parse/page-read in typed errors
    (password-protected, invalid PDF / viewer page, scanned pages) and
    releases the document best-effort in `finally`.
- **`api/_lib/callExtractionModel.ts`**
  - Missing key now throws `MISSING_ANTHROPIC_API_KEY: <user-facing
    sentence>`; new `MISSING_API_KEY_MESSAGE` (no internal file refs) and
    `isMissingApiKeyError()` helper for the HTTP layer.
- **`api/extract-datasheet.ts`** and **`scripts/dev-api.ts`** (same mapping,
  Vercel + local dev parity)
  - Missing key → **503** with the user-facing message.
  - Bad URL / bad JSON body → 400; fetch/parse/size problems → 502;
    anything else → 500. Malformed JSON bodies now 400 instead of 500.
- **`src/components/DatasheetImportForm.tsx`**
  - Parses the response as text first, so a down API / non-JSON proxy page
    yields "unreadable response (HTTP n). Is the API server running?"
    instead of `Unexpected token…`.
  - 503 responses append "You can still enter the specs manually below.";
    network failure names the dev API server. Error text uses `role="alert"`.
- **`api/_lib/fetchContent.test.ts`** (new) — mocked-fetch tests for
  octet-stream-PDF routing, browser headers + timeout signal, 403
  explanation, HTML extraction, binary-blob rejection, and the missing-key
  helper. No network access needed.

Not changed: App layout, 3D code, extraction schemas, form data model.
Known limitation (left as-is, flagged for follow-up): the model extracts
`fps`/`trigger` (sensor) and `modMm`/`distortionPct`/`weightG`/`driverNote`
(lens), but `Sensor`/`Lens` types and forms have no fields for them, so
those values are dropped on save. Core dimensional/optical fields round-trip
correctly.

## How to verify

1. `npm run typecheck` — clean (`tsc -b`, no errors).
2. `npm run test` — 6 files / 77 tests pass, including the 8 new
   `fetchContent` cases: `npx vitest run api/_lib/fetchContent.test.ts`.
3. Manual end-to-end (needs `ANTHROPIC_API_KEY` in `.env`):
   - `npm run dev` (starts web on :5173 + API on :8787),
   - open the app → Add sensor/lens → paste a direct PDF URL
     (e.g. a Sony Pregius sensor datasheet) → Extract → confirm the
     editable `SensorForm`/`LensForm` draft is pre-filled with a source line.
   - Negative checks: paste a garbage URL (friendly "not a valid URL"),
     stop the API server and extract (readable "Is the API server running?"
     message), and unset `ANTHROPIC_API_KEY` (503 + manual-entry hint).
