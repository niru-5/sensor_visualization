# Architecture & Tech Stack

Companion to [`requirements.md`](./requirements.md). This lays out the
proposed stack and system shape for v1.

## 1. High-level shape

Two pieces, not more:

1. **Frontend SPA** — everything the user touches: data entry/editing,
   the seed dataset, sensor size comparison, the 3D FOV visualization,
   compatibility checks, the comparison dashboard, `localStorage`
   persistence, JSON export/import.
2. **One thin backend endpoint** — datasheet extraction only. Fetches a
   user-supplied URL server-side, pulls out text, asks an LLM to return
   structured fields matching the sensor/lens data model, and hands that
   back to the frontend. Stateless — no database, nothing stored
   server-side.

```
┌────────────────────────────────┐        ┌─────────────────────────────┐
│         Browser (SPA)           │  POST  │   Serverless function       │
│                                  │ ─────► │   /api/extract-datasheet    │
│  React + TS + Vite               │        │                              │
│  - Sensor/lens forms              │        │  1. fetch(url) server-side  │
│  - Seed dataset (bundled JSON)    │        │  2. parse PDF/HTML → text   │
│  - optics.ts: pure calculation    │        │  3. LLM structured extract  │
│    functions (FOV, magnification, │ ◄───── │     (JSON schema matching   │
│    compatibility, resolution)     │  JSON  │     the data model)         │
│  - 2D SVG sensor-size compare     │        │  4. return fields + a       │
│  - 3D FOV cone (react-three-fiber)│        │     found/not-found flag    │
│  - localStorage persistence       │        │     per field               │
│  - JSON export/import             │        └─────────────────────────────┘
└────────────────────────────────┘
```

Why only these two pieces: everything that's pure computation (FOV,
compatibility, resolution math) and everything that's pure UI state (the
user's saved sensors/lenses/comparisons) has no reason to touch a server
— it runs fine in the browser and keeps the app free to host as a static
site. The one thing that *must* leave the browser is fetching an
arbitrary third-party URL and calling an LLM with an API key, so that's
the only thing the backend does.

## 2. Frontend

- **Framework**: React + TypeScript + Vite. Good ecosystem for both 2D
  (SVG/D3) and 3D (three.js) visualization, and TypeScript gives the
  calculation module real type safety around a data model with a lot of
  interrelated physical quantities (get a unit or formula wrong and the
  compiler/tests catch it, not a user squinting at a wrong FOV number).
- **Styling**: Tailwind CSS — fast to build a clean, information-dense
  comparison UI without hand-rolling a design system.
- **State management**: plain React state + context is probably enough
  for v1 — the working data set is small (a handful of sensors, lenses,
  and one active comparison). Reach for Zustand only if prop-drilling
  actually becomes painful.
- **2D visualization** (sensor size comparison): plain SVG with
  hand-computed to-scale rectangles. No charting library needed — this
  is simple enough to do directly and gives full control over labeling
  (dimensions, diagonal, aspect ratio).
- **3D visualization** (FOV camera-cone): `three.js` via
  `@react-three/fiber` + `@react-three/drei` (camera controls, grid
  helpers, text labels). Renders camera position, view frustum, sensor
  plane, and the FOV footprint at the working distance, with orbit
  controls so the geometry is actually inspectable — this is the one
  place v1 needs a real 3D engine rather than an SVG approximation.
- **Persistence**: `localStorage`, wrapped in a small typed module
  (never raw `localStorage.getItem` scattered through components) so the
  schema can be versioned later without a rewrite. JSON export/import
  reuses the same serialization.
- **Calculation module**: a standalone, framework-free TypeScript module
  (`src/lib/optics.ts`) with pure functions for magnification, FOV,
  resolving power, mm/pixel, and compatibility checks. No React, no I/O
  — easy to unit test against hand-calculated reference values, and
  reusable from the backend later if extraction ever needs to sanity
  check a number it pulled out of a datasheet.

## 3. Backend (datasheet extraction only)

- **Runtime**: a single serverless function (Vercel Functions,
  Cloudflare Workers, or Netlify Functions — whichever matches the
  chosen frontend host, so the whole app deploys as one project).
  Node/TypeScript, sharing types with the frontend's data model.
- **Why a backend at all**: the browser can't fetch arbitrary
  third-party PDFs reliably (most vendor sites block cross-origin
  fetches), and the extraction step needs an LLM API key that must never
  ship to the client.
- **Flow**:
  1. Receive `{ url }`, fetch it server-side.
  2. If PDF: extract text with `pdfjs-dist` (or `pdf-parse`). If HTML:
     pull main content with `cheerio`.
  3. Send the extracted text to an LLM with a prompt/tool schema
     constrained to the sensor/lens data model fields, so the response
     is directly parseable JSON, not a free-text summary to re-parse.
  4. Return the structured fields plus a per-field `found: boolean`
     (and ideally a short source snippet) so the frontend can show
     exactly what it couldn't determine — this is what backs the "flag,
     don't guess" requirement in `requirements.md` §3.1.
- **Statelessness**: no database. Extraction is on-demand; the result
  only persists once the user reviews and confirms it, and that
  persistence happens client-side. This keeps the backend trivial to
  operate and means it never holds user data.
- **Guardrails**: basic rate limiting (per-IP/session) since each call
  costs an LLM request, and rejecting obviously-wrong content types
  before spending a model call on them.

## 4. Hosting

Static frontend + serverless function(s) on one platform — Vercel is the
easiest default (zero-config static hosting plus functions in the same
repo/deploy). No servers to manage, no infra beyond an environment
variable for the LLM API key.

## 5. Testing

- `vitest` for `optics.ts` — reference-value tests (hand-calculated FOV
  and magnification for a few known sensor + lens + working-distance
  combinations) directly cover the "use proper formulas" success
  criterion, rather than relying on the UI looking plausible.
- A handful of real datasheet URLs (PDF and HTML) kept as fixtures to
  sanity-check the extraction endpoint as it's built, instead of only
  testing it by hand each time.

## 5a. Local dev harness (implementation addendum)

There's no `vercel dev` available in the environment this was built in, so
the extraction endpoint needed a local stand-in to actually be testable
during development: `scripts/dev-api.ts` is a plain `node:http` server that
wraps the same `api/_lib/extract.ts` orchestrator the real Vercel handler
(`api/extract-datasheet.ts`) uses, and Vite's dev server proxies `/api/*`
to it (`vite.config.ts`'s `server.proxy`). `npm run dev` starts both
together via `concurrently`. This is purely a dev-time convenience — the
production path is still the single Vercel function described above; the
core logic lives in `api/_lib/` and both the Vercel handler and the dev
server are thin wrappers around it, so there's no duplicated logic to
drift out of sync.

## 6. Suggested repo layout

This is what actually got built (see docs/LEARNINGS.md for how it got
here):

```
camera_selection_tool/
├── docs/
│   ├── requirements.md
│   ├── architecture.md
│   └── LEARNINGS.md
├── src/
│   ├── lib/
│   │   ├── types.ts             # Sensor/Lens/ExtractedField data model
│   │   ├── optics.ts            # pure calculation functions
│   │   ├── optics.test.ts       # reference-value unit tests
│   │   ├── opticalFormats.ts    # optical-format -> mm lookup table
│   │   ├── extraction.ts        # shared extraction request/response types
│   │   └── seedData.ts          # bundled starter sensors/lenses (cited sources)
│   │   ├── cameraPalette.ts     # Track A/B: per-slot identity colors (blue/orange/green, cyclic)
│   │   ├── frustumGeometry.ts   # Track B: pure footprint math (corners, range rings, ground Y)
│   │   └── pixelGrid.ts         # Track C: GSD grid spec (stride-capped, contours, mm/px label)
│   ├── components/
│   │   ├── SensorCompare2D.tsx
│   │   ├── FovCone3D.tsx        # legacy per-camera stage (Track A replaces its use in App comparison grid)
│   │   ├── FovShading.tsx       # Track B: shaded FOV volume + rings + metric floor + human scale
│   │   ├── PixelSizeGrid.tsx    # Track C: GSD overlay + mm/px badge on the footprint
│   │   │   # Track A (in flight at Track D commit): single shared-view stage,
│   │   │   # one Canvas, visibility toggles, union fit from stageFit.ts
│   │   ├── ComparisonTable.tsx
│   │   ├── SensorForm.tsx / LensForm.tsx
│   │   ├── DatasheetImportForm.tsx
│   │   └── formDrafts.ts        # shared draft types/blank values for the two forms
│   ├── store/
│   │   ├── persistence.ts       # typed localStorage read/write + export/import
│   │   └── useAppData.ts        # React hook wrapping persistence
│   └── App.tsx
├── api/
│   ├── extract-datasheet.ts     # Vercel serverless function (thin wrapper)
│   └── _lib/
│       ├── extract.ts           # orchestrator: fetch -> parse -> call model
│       ├── fetchContent.ts      # PDF (pdfjs-dist) / HTML (cheerio) text extraction
│       ├── callExtractionModel.ts # Claude tool-use call, structured output
│       └── rateLimit.ts         # in-memory per-IP rate limit
├── scripts/
│   └── dev-api.ts               # local stand-in for the Vercel function (see §5a)
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json / tsconfig.api.json
├── package.json
└── vite.config.ts
```

## 6a. Flow-redesign modules (2026-09-26, 3-pane layout)

On top of §6, the options / visualize / advise redesign added:

```
src/
├── lib/
│   ├── database/            # compat DB: cameras|lenses|software|rules.ts + *.test.ts
│   │                          # (VERIFIED with cited URL / NEEDS-VERIFY; NOT compatibilityDb.ts)
│   ├── lensMath.ts            # thin-lens vs telecentric FOV=dim/m + WD-range gating
│   ├── shutterMath.ts         # blurBudget / rollingSkew / fpsCap / motionCheck
│   ├── shutter.ts             # thin VIZ-facing wrapper delegating to shutterMath
│   ├── slotCompat.ts          # interface/mount/image-circle → one IF/MNT/IMG badge summary
│   └── suggestion.ts          # SuggestionEngine v1: suggest() + parseAdviceQuery()
├── components/
│   ├── OptionsPanel.tsx       # left pane: pickers + filters + shortlist
│   ├── AdvicePanel.tsx        # right pane: prompt → suggestion cards → Use-top-N
│   ├── SharedFovView.tsx      # center stage: ONE always-shared Canvas (no tabs/toggle)
│   └── ShutterOverlay.tsx     # blur/skew stripe per slot (advisory without motion input)
├── App.tsx                    # 3-pane grid shell; owns shortlist + environment + slots
└── docs/UI-DESIGN-3PANE.md    # pane widths/behavior + interaction contract
e2e/
├── comparisonStability.e2e.test.ts  # rewritten for always-shared (1 canvas, not N)
├── sharedViewStability.e2e.test.ts
└── flowRedesign.e2e.test.ts            # 3 panes render, filter narrows, Use-top-N writes slots
```

Unmounted but kept in-tree (lint-clean, explicit no-refactor rule):
`WizardPanel.tsx`, `RankedPairingsPanel.tsx`, `FovCone3D.tsx`.

## 7. Open architecture questions
- Which LLM to call from the extraction function, and how extraction
  cost/rate limits are managed for a side project — a single personal
  API key is probably fine for v1 since it's single-user, no auth layer
  needed.
- Whether Cloudflare Workers' PDF/text-extraction library support is
  good enough, or a Node-based Vercel/Netlify function is a smoother fit
  for `pdfjs-dist`/`cheerio` — worth a short spike before committing.
