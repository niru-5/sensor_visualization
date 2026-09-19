# Verify — localhost demo

Date: 2026-09-19 (UTC)
Repo: `/hdd/side_projects/camera_selection/camera_selection_tool`

## 1) docs/fae-brief.md — EXISTS, complete

Path: `docs/fae-brief.md`

- [x] MUST (M1–M7): thin-lens FOV solver, to-scale overlay, image-circle/mount check, mm/px + Nyquist, 1×N compare table, flag-don't-guess import + localStorage + JSON, WD≈f uncertainty cue
- [x] SHOULD (S1–S5): seed citations, shutter/fps/interface columns, cache + rate-limit msg, three.js code-split note, tablet-responsive
- [x] CUT (C1–C6): no catalog crawl, no OCR/login-walled PDFs, no price/availability, no DOF/MTF curves, no cloud/multi-user, no lighting simulator
- [x] Assumptions A1–A6 with evidence URLs (all live at time of writing; 2× Commonlands 404s + Reddit bot-wall explicitly excluded — see §0):
  - A1 Basler Lens Selector: https://www.baslerweb.com/en/tools/lens-selector/
  - A2 Roboflow camera + lens guides: https://blog.roboflow.com/best-cameras-for-computer-vision/ , https://blog.roboflow.com/how-to-choose-a-lens-for-machine-vision/
  - A3 Basler Embedded/Jetson: https://www.baslerweb.com/en/portfolios/embedded-vision/nvidia/ , https://www.baslerweb.com/en-us/portfolios/embedded-vision/
  - A4 Jetson multi-camera breakage: https://dev.to/lily_li_fc6c372b8805f9017/building-a-multi-camera-ai-vision-pipeline-on-jetson-orin-nano-and-where-it-actually-breaks-3143 ; https://dev.to/siliconsignals_ind/how-to-choose-camera-module-design-for-embedded-5c2l
  - A5 Basler AoV calc (`m = f/(WD−f)` in `src/lib/optics.ts`): https://docs.baslerweb.com/knowledge/angle-of-view-calculation-in-the-basler-lens-selector
  - A6 3–5 px rule: https://roboflow.com/reports/machine-vision-cameras

No `src/` changes made for the brief (docs-only).

## 2) Checks — all PASS

| Command | Result |
|---|---|
| `npm test` (vitest run) | **PASS** — 3 test files, 46 tests passed |
| `npm run typecheck` (`tsc -b`) | **PASS** — exit 0, no errors |
| `npm run build` (`tsc -b && vite build`) | **PASS** — 585 modules, `dist/` emitted in ~561 ms; only warning is >500 kB chunk (1.17 MB, gzip 319 kB — tracked as SHOULD S4 code-split) |

No code changes were needed; nothing fixed (no breakage introduced).

## 3) Localhost demo — RUNNING

Started via `npm run dev` (concurrently: `dev:web` + `dev:api`) as background task `b0a6703b6` — was not running before (both ports returned `000`).

| Service | URL to visit | Status |
|---|---|---|
| Web (Vite) | http://localhost:5173/ | **200** — `curl -s -o /dev/null -w '%{http_code}' http://localhost:5173` → `200` |
| API (dev-api) | http://localhost:8787/api/extract-datasheet (POST `{url, kind}`; proxied as `/api/*` from web per `vite.config.ts`) | **live** — invalid-URL POST returns `{"error":"Not a valid URL."}` (handler reached); log: `[dev-api] extraction endpoint listening on http://localhost:8787/api/extract-datasheet` |
| Note | `ANTHROPIC_API_KEY is not set — extraction will fail at the model-call step. See docs/LEARNINGS.md.` — expected without key | advisory only |

### URLs to visit
- App: http://localhost:5173/
- API health probe (expect 404 JSON `{"error":"Not found."}` on GET): http://localhost:8787/api/extract-datasheet
- Vite proxy makes the app call `/api/extract-datasheet` → forwarded to `:8787` — no CORS setup needed.

### Reproduce
```sh
npm run dev
curl -s -o /dev/null -w '%{http_code}' http://localhost:5173  # → 200
```
