# Build Log: Setup, Problems, and Decisions

Companion to [`requirements.md`](./requirements.md) and
[`architecture.md`](./architecture.md). This is the "what actually
happened while building v1" doc — setup steps, things that broke and how
they got fixed, judgment calls made along the way, and what's still
unverified.

## Setup steps (from a clean checkout)

1. **Node version**: the system's default `node` was v10.24.1 (way too old
   for Vite/current tooling). Installed Node 24 (current LTS as of this
   build) via `nvm`:
   ```
   nvm install --lts
   nvm alias default 24
   ```
   A `.nvmrc` (`24`) is committed, so `nvm use` picks the right version. If
   you don't use nvm, just make sure `node -v` is 20+.

2. **Install dependencies**:
   ```
   npm install
   ```
   This installs `three` / `@react-three/fiber` / `@react-three/drei` with
   `--legacy-peer-deps` baked into the lockfile — see "React 19 vs.
   react-three-fiber peer deps" below if you add packages later and hit a
   peer-dep error.

3. **Environment variable** (only needed for the datasheet-import feature):
   ```
   cp .env.local.example .env.local
   # then fill in ANTHROPIC_API_KEY=sk-ant-...
   ```
   Everything else (manual entry, sensor comparison, FOV visualization,
   comparison table) works with zero configuration.

4. **Run it**:
   ```
   npm run dev        # starts the Vite frontend (5173) + local API dev server (8787) together
   npm run test        # vitest — the optics.ts reference-value tests
   npm run typecheck   # tsc -b across all four tsconfig projects
   npm run lint         # oxlint
   npm run build        # production build (tsc -b && vite build)
   ```

## Problems hit and how they were resolved

- **System Node too old.** `node --version` was v10.24.1 on PATH by
  default; Vite requires 20+. Fixed by installing Node 24 via `nvm` (see
  Setup above). Each new shell needs `nvm use` (or relies on `nvm alias
  default`) — this tripped up early commands in this session before I
  started prefixing shell commands with `source ~/.nvm/nvm.sh && nvm use
  24`.

- **`npm create vite@latest .` silently failed in a non-empty directory.**
  The repo already had `docs/` and `.git/`, and the interactive
  "directory not empty, continue?" prompt can't be answered
  non-interactively — the command just exited with "Operation cancelled".
  Fixed by scaffolding into a temp directory and moving the files into the
  repo root.

- **Writes to `/tmp/...` landed inside the project directory instead.**
  While working around the above, `npm create vite@latest /tmp/vite-scaffold`
  actually created `tmp/vite-scaffold/` *inside* the repo, not at the
  filesystem's `/tmp`. This looks like sandboxing in this environment that
  redirects `/tmp` writes into the project directory rather than true
  `/tmp` — worth knowing about if a future step assumes it can write
  scratch files outside the repo.

- **React 19 vs. `@react-three/fiber` peer deps.** The Vite scaffold
  pinned React to `^19.2.8`, but `@react-three/fiber@9.7.0`'s peer range
  (`>=19 <19.3`) plus its *optional* peer deps on `expo`/`react-native`
  tooling caused `npm install` to fail with an unresolvable peer-dep
  conflict — none of it actually relevant to a web app. Resolved with
  `--legacy-peer-deps`. React and React DOM stayed pinned to the same
  `19.2.8`, so there's no real version mismatch, just an overly strict
  peer range from a package that also serves React Native.

- **TypeScript `nodenext` module resolution needs explicit `.js`
  extensions.** The `api/` and `scripts/` code runs under Node (not
  bundled by Vite), so it uses `"moduleResolution": "nodenext"` in a new
  `tsconfig.api.json` project reference. That mode requires relative
  imports to write the *compiled* extension (`.js`) even though the
  source files are `.ts` — e.g. `import { x } from './extract.js'`
  resolving to `extract.ts`. This is standard Node ESM behavior, not a bug,
  but easy to trip over if you're used to bundler-mode resolution (which
  `tsconfig.app.json` uses instead, and which doesn't require this).

- **`pdfjs-dist` type mismatch.** `isEvalSupported` isn't a valid
  `getDocument()` option in the installed pdfjs-dist v6 types — removed it
  rather than guessing at the right replacement. PDF text extraction
  works fine without it (verified against a real datasheet, see Testing
  below).

- **Non-fatal pdfjs font warning.** Extracting text from the real Sony
  IMX264 PDF datasheet logs `Warning: loadFont - translateFont failed:
  "UnknownErrorException: Ensure that the cMapUrl API parameter is
  provided."` for some embedded fonts. This is pdfjs being noisy about
  glyph-mapping resources it doesn't have — it doesn't affect plain text
  extraction (confirmed: the request still made it past the "no text
  extracted" check and reached the model-call step). Left as-is rather
  than wiring up `cMapUrl`/`standardFontDataUrl`, since nothing currently
  depends on font rendering.

## Judgment calls worth knowing about

These weren't specified anywhere and needed a reasonable default rather
than blocking on a question — documented here (and in code comments near
each) so they're easy to revisit:

- **FOV "risk" thresholds** (`src/lib/optics.ts`, `computeFovAxis`): the
  thin-lens FOV formula itself doesn't blow up as working distance
  approaches focal length — magnification does. Risk levels are bucketed
  by magnification: `< 0.5` normal, `0.5–2` "macro", `>= 2`
  "extreme-macro", and `WD <= f` is flagged invalid (no real image forms
  there at all). These thresholds are a reasonable engineering judgment
  call, not a standard — worth revisiting once there's a real use case to
  calibrate against (open question #3 in requirements.md).

- **Image-circle "tight" threshold** (`checkImageCircle`): margin under
  10% of the sensor diagonal is flagged "tight" rather than "ok", to catch
  cases that pass on paper but leave little room for manufacturing
  tolerance or corner softness. Also a judgment call, same reasoning.

- **Seed sensor mount assignment**: the sensor data model carries a
  `mount` field (for the compatibility check), but the mount is really a
  property of a *camera body*, not the bare sensor chip. Seed sensors were
  assigned the mount typically used by cameras built around them (e.g.
  IMX264 → C-mount), sourced from how vendors actually sell cameras with
  that sensor, not from the sensor datasheet itself (which doesn't
  specify a mount).

- **Extraction schema returns raw nullable fields, not literal
  `ExtractedField<T>` objects from the model.** `callExtractionModel.ts`
  asks the model for a flat object with `null` for anything not found,
  then wraps it into `{value, found}` in code — simpler and more reliable
  than asking the model to produce the nested wrapper shape itself.

## What's tested vs. what isn't

**Tested and passing:**
- `npm run test` — 22 vitest cases in `optics.test.ts`, including
  hand-calculated reference values for FOV/magnification (per
  requirements.md's success criteria), image-circle and mount-compatibility
  checks using the real seed lens/sensor numbers, and the optical-format
  lookup table.
- `npm run typecheck` — clean across all four `tsconfig` projects.
- `npm run lint` — clean (oxlint); this caught a real rules-of-hooks bug
  in `FovCone3D.tsx` (a conditional `useMemo` before an early return) that
  got fixed during the build.
- `npm run build` — production build succeeds (~1.14MB minified JS,
  mostly `three.js` — Vite flags this as large; not addressed for v1, see
  Follow-ups).
- The extraction endpoint's non-LLM path: smoke-tested with `curl` against
  **real URLs** — the Sony IMX264 PDF datasheet and a Commonlands lens
  product page — through the actual local dev server. Both correctly
  fetched, extracted text, and reached the model-call step before failing
  on the missing API key, confirming the fetch → parse → hand-off-to-model
  pipeline works end to end for both PDF and HTML sources. Input
  validation (missing fields, malformed URL) and the in-memory rate
  limiter (429 after 10 requests/minute from one source) were also
  smoke-tested this way.

**Not tested — flagging honestly rather than claiming otherwise:**
- **The actual LLM extraction call.** No `ANTHROPIC_API_KEY` was available
  in this environment, so `callExtractionModel.ts` has never actually run
  against the model. The code path, tool schema, and response parsing are
  implemented per the architecture doc but unverified live. Once you add a
  key to `.env.local`, the very first "Add from datasheet link" click in
  the app is the real test.
- **The UI in an actual browser.** No browser automation tool was
  connected in this session, so nothing here has been visually verified —
  no confirmation that the 3D FOV cone renders/orbits correctly, that
  forms look right, or that there are no runtime console errors. What
  *was* verified: the dev server serves the page (HTTP 200, correct
  script tags), the production build compiles cleanly, and Vite's HMR
  picked up every edit without erroring during development. Please open
  `http://localhost:5173` yourself and click through it — this is the
  single biggest gap between "built" and "confirmed working."
- **Deployment.** `api/extract-datasheet.ts` is written to the Vercel
  Node-function shape described in architecture.md but has never been
  deployed to Vercel (or any host) in this session.

## v1.1: configurator-style redesign

After the first working version, the request was to make the UI "cooler"
— specifically citing Basler's web-based lens selector
(baslerweb.com/en/tools/lens-selector) as a reference for feel, but kept
in 3D rather than copying its 2D side-view diagram. Changes:

- **Layout**: a "hero" configurator now sits above the existing
  sensor/lens management sections — a dark sidebar (sensor/lens dropdowns,
  a working-distance slider+number, and a live numeric readout) next to a
  large 3D stage, instead of the FOV view being one plain section among
  several equally-weighted ones. The multi-select comparisons (sensor size
  chart, N-lenses-vs-1-sensor table) still exist below, just visually
  secondary now.
- **3D stage** (`FovCone3D.tsx`): dark navy background with fog, a
  stylized camera body + lens barrel (box + cylinder meshes, not just a
  wireframe rectangle) sitting at the frustum apex, proper lighting
  (ambient + directional + a small accent point light on the lens glass),
  and risk colors brightened for contrast against the dark background.
  `OrbitControls` got damping and min/max zoom clamps so it feels smoother
  and doesn't let you zoom inside the geometry or out to nothing.
- **New `FovReadout.tsx`**: a compact stat-card readout (FOV, magnification,
  per-pixel resolution, pixel pitch, risk message) next to the 3D view —
  the "numbers panel" part of a lens-selector-style UI, separate from the
  in-scene HTML labels which stayed for reading values while orbiting.

I could not load the actual Basler tool's rendered UI (it's a JS SPA and
the fetch tool available here only returns static page text), so this is
built from general familiarity with this genre of tool rather than a
pixel-level copy — worth a look together against the real thing if the
resemblance matters.

Verified the same way as before (tests/typecheck/lint/build all pass,
dev server hot-reloaded every change without erroring) — **still not
visually verified in an actual browser**, same gap as noted below.

## Follow-ups worth doing next

- Open `npm run dev` in an actual browser and validate the 3D view,
  forms, and comparison table visually.
- Add a real `ANTHROPIC_API_KEY` and test one live datasheet import
  end-to-end.
- Code-split the `three.js`/`@react-three` bundle (dynamic `import()` for
  `FovCone3D`) — it's currently pulled into the main bundle and is most of
  the 1.14MB Vite warns about.
- Everything already listed under "Open questions" in requirements.md
  (extraction confidence UX, seed dataset expansion, exact uncertainty
  visual language, caching) is still open.
