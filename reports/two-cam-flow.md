# Two-camera comparison flow — trace, fixes, tests, checks

Date: 2026-09-19 (UTC)
Repo: `/hdd/side_projects/camera_selection/camera_selection_tool`
Author: agent run (strict deliverables)

## 1) Flow traced (App.tsx + lib + store + components)

Steps verified by reading source (no placeholders — file/line behavior confirmed):

1. **Library (left sidebar, App.tsx → store/useAppData.ts → store/persistence.ts):**
   Sensors/lenses listed from `useAppData()` (seeded from `lib/seedData.ts` on first run,
   persisted under `camera-selection-tool/v1`). Add manually (`SensorForm`/`LensForm`) or
   from a datasheet link (`DatasheetImportForm`); every entry becomes an option in each
   camera panel's dropdowns.
2. **Slots (App.tsx state, now lib/twoCamera.ts):** `cameras: CameraSlot[]` starts as one
   slot (`sensorId/lensId = null`, `workingDistanceMm = 300`), restored from
   `camera-selection-tool/cameras-v1` when present. `+ Add camera` seeds the new slot from
   the last one (same sensor/lens/WD) up to 4; `Remove` keeps ≥ 1 panel.
3. **Resolve (lib/twoCamera.ts `resolveSlots`):** each slot resolves to
   `sensors.find(id) ?? sensors[0]` / `lenses.find(id) ?? lenses[0]` plus an
   `effectiveWd` clamped into that lens's slider range. Dangling ids after a
   library delete fall back gracefully; empty library yields `null` + empty-state panel.
4. **Panels (App.tsx grid → FovCone3D + FovReadout):** each resolved panel renders a WD
   slider (`getSliderBounds`: `ceil(f)+1 .. max(min+100, 2000)`), a 3D frustum stage
   (`FovCone3D`, footprint at `effectiveWd`, shared `sceneScaleMm`), and a numeric readout
   (`FovReadout`: FOV H×V via `computeFov`, magnification, mm/px, pixel pitch, risk badge).
   Overlay label format: `FOV {H} x {V}mm @ {WD}mm`, or the invalid-geometry message.
5. **Shared 1:1 scale (`sharedScaleMm`):** `max(effectiveWd)` across resolvable panels
   (default 300); passed as `sceneScaleMm` so all stages share camera position/framing.
6. **Sensor overlay (`SensorCompare2D`):** de-duplicated `sensorsInPlay` drawn to scale,
   largest-first so smaller rects stay visible.
7. **Table (`ComparisonTable`):** first camera's sensor × every in-play lens at camera-1's
   `effectiveWd` — FOV H×V, mm/px, image-circle flag (`checkImageCircle`), mount flag
   (`checkMountCompatibility`), invalid-WD badge. `CompatibilityExplainer` narrates the
   first row's coverage + mount.

## 2) Breakage found and fixed

1. **Camera slots lost on reload (real data loss in the 2-camera flow).**
   `persistence.ts` stored only sensors/lenses; `cameras` state reset to a single blank
   panel on every reload, discarding the user's A/B setup and WDs.
   Fix: new `src/lib/twoCamera.ts` persistence (`CAMERAS_STORAGE_KEY =
   'camera-selection-tool/cameras-v1'`, `loadCameraSlots`/`saveCameraSlots`/`parseCameraSlots`
   with validation + corrupt-payload fallback to `null`); `App.tsx` lazy-inits from
   `loadCameraSlots() ?? [createSlot(null, null)]` and saves on every change via effect.
   Namespaced key leaves the sensor/lens schema untouched.
2. **WD slider/state desync on lens swap (invalid FOV under a valid-looking slider).**
   The slider displayed `clamp(WD)` while state kept the raw WD, so switching to a longer
   lens (e.g. stored WD 30 with a 60 mm lens) showed slider ≈ 61 but rendered
   `invalid` FOV from state WD 30.
   Fix: `updateCameraSlot(slots, id, patch, lenses)` re-clamps stored WD into the
   resulting lens's range; panels render `effectiveWd` everywhere (slider value + label,
   `FovCone3D`, `FovReadout`, table WD, shared scale). Pure helpers extracted so the
   behavior is pinned by tests: `getSliderBounds`, `clampWorkingDistance`,
   `effectiveWorkingDistance`, `resolveSlots`, `sharedScaleMm`, `computeTwoCameraView`,
   `buildTableRow`, `overlayLabel`, `panelLayout`, slot CRUD.
   `App.tsx` now consumes exactly these helpers (single source of truth).

No other behavior changed; wizard/FAE math (`optics.ts`, `fae.ts`) untouched.

## 3) Tests created

- `src/lib/twoCamera.test.ts` — **17 unit tests**:
  - 2 divergent configs: (A) IMX264 + 25 mm @300 mm (FOV-H ≈ 93.5 mm, coverage ok,
    mount ok) vs (B) IMX178 + 6 mm @500 mm (overlay `612 x 411mm @ 500mm`, coverage
    tight, M12-vs-CS mismatch, shared scale 500); (C) IMX267 1" + 6 mm M12
    (vignetting + mount mismatch) vs (D) IMX264 + 12 mm C (tight but valid).
  - Slot CRUD (4): defaults/unique ids, seed-from-last + cap at 4, remove ≥1 + unknown id,
    patch keeps id.
  - WD clamping (4): slider bounds mirror, clamp + NaN repair, lens-swap re-clamp
    (30 → 61 for 60 mm lens), WD ≤ f → invalid with message.
  - Resolve/scale/dedupe/layout/persistence-parse (7): first-available fallback,
    empty-library nulls + empty overlay + empty table + scale 300, max-WD scale,
    dedupe, layout classes, `parseCameraSlots` good/corrupt/oversize, key namespacing.
- `src/twoCamera.integration.test.ts` — **6 integration tests** (node env, in-memory
  `window.localStorage` stub, same helpers + key `App.tsx` uses):
  1. add-2-panels seeds from panel 1; both overlays render; table covers both lenses.
  2. WD change 300 → 600 mm updates FOV readout (204.0 → 416.5 mm H on IMX264 + 12 mm),
     risk/valid flags, table WD, overlay label, and shared scale together.
  3. Macro WD (24 mm, 12 mm lens) flags `macro` on table + renders FOV overlay.
  4. Second panel with own sensor (IMX178) + WD 800 keeps independent overlays, shared
     scale 800.
  5. Reload persistence: save → raw payload under cameras key parses to 2 slots →
     `loadCameraSlots` restores WD 450 + lens pick → derived view matches.
  6. Corrupt storage (`not-json{{{`, `[]`) → `loadCameraSlots()` returns `null`.

## 4) Check results (captured output, all green)

- `npm test` — **PASS**: `Test Files 5 passed (5)`, `Tests 69 passed (69)`, duration ~0.27 s.
  Breakdown: `src/lib/optics.test.ts` 22, `src/lib/fae.test.ts` 12,
  `src/lib/twoCamera.test.ts` 17, `src/twoCamera.integration.test.ts` 6,
  `api/_lib/extractSchema.test.ts` 12. Zero failures.
- `npm run typecheck` (`tsc -b`) — **PASS**: exit 0, no errors.
- `npm run build` (`tsc -b && vite build`) — **PASS**: `586 modules transformed`,
  `dist/` emitted in ~541 ms (`dist/index.html` 0.47 kB, css 26.18 kB,
  js 1,168.26 kB / gzip 319.45 kB). Only advisory warning is the pre-existing
  >500 kB chunk notice (tracked code-split item, unchanged).

## 5) How to reproduce

```sh
npm test            # 5 files / 69 tests pass
npm run typecheck   # exit 0
npm run build       # dist/ emitted
```

Open the app, click `+ Add camera`, set panel 1 to IMX264 + 25 mm @300 mm and panel 2
to IMX178 + 6 mm @500 mm, drag either WD slider, reload the page: both panels, their
WDs, the FOV readouts/flags, the comparison table, the sensor overlay, and the shared
1:1 framing all persist and update together.
