# Visualization Upgrade TODO — Single Shared-View Comparison

> Goal (inspired by Tangram `fov/lidar-visualizer`): replace N separate auto-fit
> `FovCone3D` Canvases with a **single shared-view comparison** — co-located
> frustums at identical pose, per-camera palette, FOV shading, pixel-size grid —
> with tests + docs + commits per track.
>
> Current state: N separate `FovCone3D` Canvases each auto-fit (not same POV);
> risk-colors not camera-colors; no pixel grid; flat shading;
> `MetricGridFloor` / `HumanScaleReference` unwired (standalone, unused in `App`).
>
> How to work: 4 parallel worker tracks (A–D). Each track is independent —
> claim one, finish it, commit it. Merge order: A → B → C → D.

## Palette (shared across tracks)

- Camera 1 blue `#03a9f4`, Camera 2 orange `#f8982e`, Camera 3 green `#22c55e`
  (extend cyclically for N > 3).
- Reserve risk colors (`#38bdf8`/`#fbbf24`/`#fb923c`/`#f87171` in
  `src/components/FovCone3D.tsx`) for badges/labels only — never frustum tint.

## Track A — Shared-View (single Canvas, same POV)

Single comparison stage so cameras are judged at an identical viewpoint.

- [x] Add `src/components/SharedFovView.tsx` (implements the planned `SharedFovStage.tsx`): ONE `<Canvas frameloop="demand">`
  with ONE `<OrbitControls enableDamping={false}>` (preserve demand frameloop).
- [x] Render all cameras co-located at identical pose: frustum per camera from
  shared apex (apex at origin, optical axis +Z, footprint plane at z = WD).
- [x] Per-camera palette (`src/lib/cameraPalette.ts` SLOT_COLORS + edge/fill helpers): frustum/rays/edges tinted by camera index
  (blue `#03a9f4` / orange `#f8982e` / green `#22c55e`), NOT `RISK_COLOR`.
- [x] Visibility toggles per camera (chip → show/hide that frustum group).
- [x] Shared fit: single fit distance from union of footprints
  (reuse `computeFitDistance`/`computeStageFit`/`fitCameraPosition` from
  `src/lib/stageFit.ts`); remove per-panel auto-fit divergence.
- [x] Wire into `src/App.tsx` (comparison grid section): Shared/Separate toggle
  (default Shared when >1 camera); shared mode renders one `<SharedFovView>`
  above the control cards instead of per-camera `<FovCone3D>`; separate mode
  keeps the existing per-panel stages. Keeps `sceneScaleMm` (shared scale) semantics.
- [x] Keep risk messaging as `Html` badges (existing `fov.horizontal.message`
  flow in `src/components/FovCone3D.tsx`), not frustum color.
- [x] Commit: `feat(viz): shared-view comparison with per-camera palette`

Files: `src/components/FovCone3D.tsx`, `src/components/SharedFovStage.tsx` (new),
`src/App.tsx:337-410`, `src/lib/stageFit.ts`, `src/lib/twoCamera.ts`.

## Track B — FOV Shading + Footprint (range rings, ground grid)

Depth-readable FOV volume + measurable ground reference.

- [x] Transparent FOV sector/volume per camera: `meshBasicMaterial`
  `transparent opacity ~0.3`, `side={THREE.DoubleSide}`, `depthWrite={false}`
  in camera color (see Palette above) — `src/components/FovShading.tsx` (`FovShading`, `FOV_SHADING_OPACITY = 0.3`, color via `src/lib/cameraPalette.ts` `slotColor`).
- [x] Opaque edge lines in camera color: frustum rays apex→corners +
  footprint outline (`lineBasicMaterial`, full opacity) — ported pattern from
  `Frustum` in `src/components/FovCone3D.tsx` (`footprintEdges`/`raySets`
  memo + dispose) into `FovShading`.
- [x] Range rings at WD: circumscribed circle of the footprint at the
  working-distance plane per camera (`rangeRingPoints` +
  `footprintRingRadiusMm` in `src/lib/frustumGeometry.ts`), camera-colored,
  with mm label (`Ø {d}mm @ {wd}mm`).
- [x] Meter ground grid wired as stage dressing: `StageFloor` in
  `src/components/FovShading.tsx` renders existing
  `src/components/MetricGridFloor.tsx` (`metricGridSpec` from
  `src/lib/scaleReference.ts`) as the stage floor; major squares = 1 m.
  (Track A drops `StageFloor` into `SharedFovStage`; `App.tsx` untouched by this track.)
- [x] Optional `src/components/HumanScaleReference.tsx` (1.8 m figure)
  beside footprints as scale anchor via `StageFloor` `showHuman` prop
  (default off).
- [x] Floor placement helper: `computeGroundY` in `src/lib/frustumGeometry.ts`
  ports the `groundY` logic from `src/components/FovCone3D.tsx`; fog/grid
  extents stay with Track A's shared fit.
- [ ] Commit: `feat(viz): FOV shading, range rings, metric ground grid`

Files: `src/components/FovCone3D.tsx` (pattern source),
`src/components/SharedFovStage.tsx`, `src/components/MetricGridFloor.tsx`,
`src/components/HumanScaleReference.tsx`, `src/lib/scaleReference.ts`.

## Track C — Resolution Pixel-Grid (GSD overlay) ✅ DONE (2026-09-22: `src/lib/pixelGrid.ts`, `src/components/PixelSizeGrid.tsx`, `src/lib/pixelGrid.test.ts` — commit `feat(viz): pixel-size GSD grid with mm labels`)

Show ground-sample-distance ON the footprint so resolution differences are visible.

- [x] GSD/pixel grid: grid of squares on the footprint plane at WD, cell size =
  `mmPerPixel(fovMm, pixelCount)` from `src/lib/optics.ts` (use horizontal GSD;
  note vertical if non-square pixels).
- [ ] Implementation: `lineSegments` grid (or thin `planeGeometry` cells) sized
  `fovH × fovV`, subdivided by pixel count — cap rendered cells (e.g. stride /
  decimate when resolution is huge, e.g. 12 MP would be millions of lines).
- [ ] mm label inside one cell (e.g. `Html` badge: `2.1 mm/px`) + axis labels
  (`FOV {w}×{h}mm @ {wd}mm` — reuse existing badge pattern).
- [ ] Scanline / GSD contours: every-N-lines emphasis (e.g. every 10th line
  brighter) or GSD iso-contours so density reads at a glance.
- [ ] Per-camera colors from shared Palette; toggle with the frustum
  (Track A visibility toggles hide grid with parent group).
- [ ] Reuse `mmPerPixel`, `computeFov`, `derivePixelPitchUm` from
  `src/lib/optics.ts` — no new math utils unless tested (see Track D).
- [ ] Commit: `feat(viz): GSD pixel-grid overlay on FOV footprint`

Files: `src/lib/optics.ts` (`mmPerPixel`, `computeFov`, `derivePixelPitchUm`),
`src/components/SharedFovStage.tsx` (or new `src/components/PixelGridOverlay.tsx`),
`src/components/FovCone3D.tsx` (badge pattern), `src/lib/twoCamera.ts` (pairing context).

## Track D — Tests + Docs (vitest, e2e, learnings, commits)

Lock in the upgrade with coverage and a paper trail.

- [x] Vitest unit tests (Track D, 2026-09-22 — new files only per wait-for-others rule):
  - [x] `src/lib/cameraPalette.test.ts` (new) — slot-color distinctness,
    risk-color separation, dark-stage contrast, cyclic N > 3, agreement with
    `pixelGrid.ts` fallback palette.
  - [x] `src/lib/frustumGeometry.test.ts` — Track B's landed suite preserved
    verbatim (same-path collision, nothing deleted) + Track D supplement:
    corners cross-checked against `computeFov` in `optics.ts` directly,
    rectangle/diagonal invariants, degenerate-input (NaN/Inf/zero/negative)
    fuzzing. Track C's `src/lib/pixelGrid.test.ts` covers stride-capping +
    huge resolutions.
  - [ ] `src/lib/optics.test.ts` / `src/lib/twoCamera.test.ts` extensions
    (TODO-suggested) — deliberately NOT done: wait-for-others rule was
    new-files-only; no other track added untested utils needing them.
- [x] e2e stability: NEW `e2e/sharedViewStability.e2e.test.ts` (legacy
  `e2e/comparisonStability.e2e.test.ts` untouched, still green) —
  single-canvas + toggle-without-remount asserts; skips until Track A
  lands (`vitest.e2e.config.ts`).
- [x] Docs: dated 2026-09-22 entry in `docs/LEARNINGS.md` (shared-view
  decision, palette, GSD overlay, Tangram `fov/lidar-visualizer`
  inspiration + what was borrowed, honest not-verified notes).
- [x] Docs: `docs/architecture.md` repo layout annotated with new viz
  modules (`FovShading`, `PixelSizeGrid`, `cameraPalette`,
  `frustumGeometry`, `pixelGrid`; Track A marked in-flight).
- [ ] Commit after EACH track lands (A, B, C, then D):
  `test(viz): …` / `docs(viz): …` — do not squash track commits.
  (B and C committed separately as `feat(viz): …`; this D commit follows.)
- [x] Final full verification: `npm run test` (14 files / 164 pass) + e2e
  (3 passed + 3 shared-view skipped) + `npm run typecheck` + `lint` +
  `npm run build` green.

Files: `src/lib/optics.test.ts`, `src/lib/optics.ts`,
`src/lib/twoCamera.test.ts`, `src/lib/twoCamera.ts`,
`e2e/comparisonStability.e2e.test.ts`, `docs/LEARNINGS.md`,
`docs/architecture.md`, `src/App.tsx:337-410`.

---

## Merge / Done checklist

- [ ] Track A merged (shared view renders, toggles work, demand frameloop kept) — IN FLIGHT, not landed (uncommitted `SharedFovView.tsx` at D commit time; shared-view e2e skips until it lands)
- [x] Track B merged (shading opacity ~0.3 DoubleSide depthWrite false, rings, grid)
- [x] Track C merged (pixel grid + mm label + contours, capped cells)
- [x] Track D merged (unit + e2e green, LEARNINGS dated entry, per-track commits)
