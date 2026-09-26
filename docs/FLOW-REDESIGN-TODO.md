# Flow Redesign TODO — Options / Visualize / Advise (3-Pane)

> Goal: redesign the user flow into three panes — **left options panel**
> (cameras, lenses, filters), **center visualization** (shared-view
> comparison), **right prompt+advice panel** (user asks a question →
> tool suggests products + shows comparison).
>
> Current state: single-page configurator (`src/App.tsx`) — hero
> sensor/lens dropdowns + WD slider + one `SharedFovView`/`FovCone3D`
> stage + comparison table below; no options-filter panel, no
> advice/Q&A panel, no compatibility DB, no lens-type or shutter math.
>
> How to work: 5 parallel worker tracks (DB, OPTICS, UI, VIZ, QA).
> DB + OPTICS are pure-lib (no UI dependency) — land first.
> UI depends on DB/OPTICS types. VIZ depends on UI pane shells.
> QA lands last. Merge order: DB → OPTICS → UI → VIZ → QA.
> V2 PARKED (I, H, J) is explicitly out of scope — do not start.

## New flow (target UX)

```
┌──────────────┐  ┌────────────────────────┐  ┌──────────────────────┐
│ LEFT         │  │ CENTER                 │  │ RIGHT                │
│ options      │  │ visualization          │  │ prompt + advice      │
│              │  │                        │  │                      │
│ cameras      │  │ SharedFovView          │  │ user asks question   │
│ lenses       │  │ (shared-view frustums, │  │  → tool suggests     │
│ filters      │  │  GSD grid, shading,    │  │  products + shows    │
│ (mount,      │  │  shutter-blur overlay, │  │  comparison in       │
│  interface,  │  │  pass/fail badges)     │  │  center + table)     │
│  IP, budget) │  │                        │  │                      │
└──────────────┘  └────────────────────────┘  └──────────────────────┘
```

---

## Track DB — Compatibility Database

Source of truth for "does this combination work". Pure data + pure
functions; no UI.

- [ ] `src/lib/compatibilityDb.ts` (new): typed tables —
  - [ ] `cameraSoftwareCompat`: camera × software rows with status
    `VERIFIED | NEEDS-VERIFY` + source citation per row (URL/datasheet
    section). Convention: `NEEDS-VERIFY` renders with amber badge +
    "unverified — check vendor docs" note, never silently passes.
  - [ ] `mountSensorCoverage`: mount × max-sensor-coverage (image-circle
    Ø vs sensor diagonal) — reuse `checkImageCircle` semantics from
    `src/lib/optics.ts` (ok / tight <10% margin / fail).
  - [ ] `interfaceCheck`: interface pass/fail (bandwidth vs
    `resolution × fps × bitdepth`; cable-length / connector gating).
  - [ ] `ipRatingGuide`: IP standards table with DIY vs manufacturing
    split (e.g. IP40 lab/DIY ok, IP65/67 washdown/food-pharma
    manufacturing requirement) — advisory text + filter thresholds.
- [ ] Seed rows: extend `src/lib/seedData.ts` (or new
  `src/lib/seedCompatibility.ts`) with cited rows for existing seed
  cameras/lenses; every `VERIFIED` row needs a source, everything else
  defaults to `NEEDS-VERIFY`.
- [ ] Pure query fns (`compatibleSoftware(camera)`, `mountCovers(mount,
  sensor)`, `interfacePass(camera, fps, bits)`, `ipMeetsRequirement(rating,
  environment)`) — framework-free, vitest-covered (see Track QA).
- [ ] Commit: `feat(db): compatibility database with verify statuses`

Files: `src/lib/compatibilityDb.ts` (new), `src/lib/seedData.ts`,
`src/lib/seedCompatibility.ts` (new, optional),
`src/lib/optics.ts` (`checkImageCircle`, `checkMount`),
`src/lib/types.ts` (extend `Sensor`/`Lens`/compat types).

---

## Track OPTICS — Lens-Type + Shutter Math

> Status 2026-09-26: `src/lib/lensMath.ts` + `src/lib/shutterMath.ts`
> landed with vitest coverage (26 cases) — commit `feat(optics):
> telecentric + shutter math`. Still open: `lensType` field on the shared
> `Lens` type + seed-lens migration (default entocentric, NEEDS-VERIFY),
> and wiring outputs into viz badges (Track VIZ).

- [x] `src/lib/lensMath.ts` (new) + `src/lib/shutterMath.ts` (new):
  `computeFovForLens` (thin-lens vs `FOV=dim/m` telecentric + WD-range
  `limited` gate), `blurBudget` / `rollingSkew` / `fpsCap` / `motionCheck`
  (global-vs-rolling branches) — tested in `src/lib/lensMath.test.ts` +
  `src/lib/shutterMath.test.ts`

Correct physics per lens/shutter type. Pure functions in
`src/lib/optics.ts` (or new `src/lib/shutter.ts`); no UI.

- [ ] Lens-type FOV split (gate on `lens.lensType`):
  - [ ] Thin-lens (entocentric/fixed-focus/varifocal): keep existing
    `FOV = dim * (WD − f) / f` (`computeFovAxis` in `src/lib/optics.ts`);
    keep `WD <= f` invalid + magnification risk buckets
    (<0.5 normal / 0.5–2 macro / ≥2 extreme-macro — see
    `docs/LEARNINGS.md` judgment-calls section).
  - [ ] Telecentric: `FOV = dim / m` (m = magnification, WD-independent
    within telecentric range); WD only gates in/out-of-range
    (below min / above max → warn, not rescale).
  - [ ] `lensType` field on `Lens` type (`entocentric | telecentric |
    varifocal …`) + migration for seed lenses (default entocentric,
    flagged `NEEDS-VERIFY` where datasheet doesn't state it).
- [ ] Shutter math (new `src/lib/shutter.ts` or `optics.ts` section):
  - [ ] Exposure cap: `t_exp ≤ blur_tol / v` (blur tolerance ÷ target
    velocity) — global + rolling baseline.
  - [ ] Rolling-shutter skew overlay input: `Δx = v * T_readout`
    (T_readout = frame readout time; per-camera from sensor spec or
    estimated `1/fps` fallback flagged as estimate).
  - [ ] Global vs rolling branch: global → motion-blur check only;
    rolling → blur + skew checks; output `pass | warn | fail` + message
    strings reusable as viz badges (Track VIZ).
- [ ] Commit: `feat(optics): lens-type FOV + shutter math`

Files: `src/lib/optics.ts` (`computeFovAxis`, `computeFov`,
`mmPerPixel`, `derivePixelPitchUm`), `src/lib/shutter.ts` (new),
`src/lib/types.ts` (`Lens.lensType`, `Sensor.shutterType`),
`src/lib/seedData.ts`, `docs/LEARNINGS.md` (risk-threshold rationale).

---

## Track UI — 3-Pane Layout

Shell + wiring. Depends on DB/OPTICS **types** (not their full data).
Spec lives in `docs/UI-DESIGN-3PANE.md` (to be written — write it first
inside this track, then build to it).

- [ ] Write `docs/UI-DESIGN-3PANE.md`: pane widths/behavior (collapsible
  left filters? responsive collapse order?), shared selection state
  shape, prompt→suggestion→comparison interaction contract.
- [ ] `src/components/OptionsPanel.tsx` (new, left): camera list,
  lens list, filters (mount, interface, IP/DIY-vs-manufacturing, budget,
  shutter) — reads Track DB query fns; emits selection + filter state up.
- [ ] `src/components/AdvicePanel.tsx` (new, right): prompt input
  (user asks question in own words) → rule-based suggestion
  (DB + OPTICS ranks products) → suggestion cards that drive the center
  comparison + table. v1 is deterministic rules, not an LLM call
  (see V2 PARKED §J).
- [ ] `src/App.tsx`: 3-pane grid shell (left / center / right);
  shared selection state (lift from current hero configurator);
  existing `WizardPanel`, `RankedPairingsPanel`,
  `ComparisonTable` re-homed (wizard prompt → right pane;
  table stays under center or docks right — decide in UI-DESIGN doc).
- [ ] Preserve `localStorage` persistence (`src/store/persistence.ts`,
  `src/store/useAppData.ts`) across the move — no schema break, or
  versioned migration if the shape changes.
- [ ] Commit: `feat(ui): 3-pane options/visualize/advise layout`

Files: `docs/UI-DESIGN-3PANE.md` (new), `src/App.tsx`,
`src/components/OptionsPanel.tsx` (new),
`src/components/AdvicePanel.tsx` (new),
`src/components/WizardPanel.tsx`, `src/components/RankedPairingsPanel.tsx`,
`src/components/ComparisonTable.tsx`, `src/store/useAppData.ts`,
`src/store/persistence.ts`.

---

## Track VIZ — Center-Stage Overlays

Make the center pane show *why* a combo passes/fails. Depends on UI
pane shells + DB/OPTICS outputs. Builds on `docs/VIZ-UPGRADE-TODO.md`
(Tracks A–D done: shared view, shading, pixel grid).

- [x] Wire existing overlays into `SharedFovView` (center stage):
  GSD `PixelSizeGrid` + `FovShading` per visible frustum, toggled with
  the frustum (Track A visibility pattern); dedupe the two opacity
  sources (`FovShading` 0.3 vs `cameraPalette` 0.16/0.55) and the
  `pixelGrid.ts` `CAMERA_PALETTE` duplicate (import canonical
  `cameraPalette.ts`) — both flagged not-verified in
  `docs/LEARNINGS.md` 2026-09-22 entry.
  → Done 2026-09-26 (Track VIZ): per-slot FOV volume + GSD grid +
  overlay toggle chips in `SharedFovView`; `FOV_VOLUME_OPACITY` canonical
  in `cameraPalette.ts` (volume 0.3 vs plane 0.16 vs rays 0.55 are
  different elements — unification note in-file); `pixelGrid.ts`
  `CAMERA_PALETTE`/`cameraColorForIndex` delegate to the canonical
  palette (aliases kept, existing tests green).
- [x] Shutter-blur overlay: skew vector / blur-extent ghost on the
  footprint from Track OPTICS (`Δx = v·T_readout`, `t_exp` cap) —
  per-camera color, toggleable; needs target-velocity input (from
  right-pane prompt or a center-stage control — coordinate with UI track).
  → Done 2026-09-26 (Track VIZ): new `ShutterOverlay.tsx` + minimal
  `src/lib/shutter.ts` (OPTICS not landed yet — pure blur/skew helpers
  with fps-estimate flagging, advisory-only without motion input);
  `SharedFovView` takes optional shared `motion` prop (UI track owns the
  velocity control).
- [x] Interface pass/fail badges: `Html` badges on/near each frustum
  (existing `fov.horizontal.message` badge pattern in
  `src/components/FovCone3D.tsx`) driven by Track DB `interfaceCheck`
  + mount/image-circle + IP-gate results; risk colors reserved for
  badges only, never frustum tint (per VIZ palette rule).
  → Done 2026-09-26 (Track VIZ): `slotCompatSummary` in
  `src/lib/slotCompat.ts` (interface/mount/image-circle → one compact
  `IF/MNT/IMG` Html badge per slot, right-edge staggered; unknown cable
  length or interface degrades to warn, never silent pass/fail).
- [ ] Commit: `feat(viz): blur overlay + compat badges in shared view`

Files: `src/components/SharedFovView.tsx`,
`src/components/PixelSizeGrid.tsx`, `src/lib/pixelGrid.ts`,
`src/components/FovShading.tsx`, `src/lib/cameraPalette.ts`,
`src/lib/frustumGeometry.ts`, `src/components/FovCone3D.tsx`
(badge pattern), `src/lib/stageFit.ts`.

---

## Track QA — Tests + Docs + Commits

Lock in the redesign. Lands last, after DB/OPTICS/UI/VIZ.

- [ ] Vitest unit tests:
  - [ ] `src/lib/compatibilityDb.test.ts` (new) — VERIFIED/NEEDS-VERIFY
    defaults, mount coverage incl. 10% tight margin, interface
    pass/fail boundaries, IP DIY-vs-manufacturing thresholds.
  - [ ] `src/lib/optics.test.ts` extensions — telecentric `FOV=dim/m`
    vs thin-lens `FOV=dim*(WD−f)/f`, WD gating per lens type.
  - [ ] `src/lib/shutter.test.ts` (new) — `t_exp ≤ blur/v` cap,
    `Δx=v*T_readout` skew, global-vs-rolling branches, estimate
    fallbacks flagged.
- [ ] e2e: extend `e2e/sharedViewStability.e2e.test.ts` (or new
  `e2e/flowRedesign.e2e.test.ts`) — 3-pane renders, left filter narrows
  options, right prompt drives a suggestion into the center comparison;
  keep `e2e/comparisonStability.e2e.test.ts` green (see
  `docs/LEARNINGS.md` 2026-09-20 flicker-guard pattern;
  `vitest.e2e.config.ts`).
- [ ] Docs: dated `docs/LEARNINGS.md` entry (flow-redesign decisions,
  what changed and why, honest not-verified notes); update
  `docs/architecture.md` repo layout (new DB/OPTICS/UI/VIZ modules).
- [ ] Commits: one per track (`feat(db): …`, `feat(optics): …`,
  `feat(ui): …`, `feat(viz): …`, then `test(flow): …` / `docs(flow): …`)
  — do not squash.
- [ ] Final full verification: `npm run test` + `npm run test:e2e` +
  `npm run typecheck` + `lint` + `npm run build` green.

Files: `src/lib/*.test.ts`, `e2e/sharedViewStability.e2e.test.ts`,
`e2e/comparisonStability.e2e.test.ts`, `vitest.e2e.config.ts`,
`docs/LEARNINGS.md`, `docs/architecture.md`.

---

## Merge / Done checklist

- [ ] Track DB merged (compat tables + VERIFIED/NEEDS-VERIFY + seed rows)
- [ ] Track OPTICS merged (lens-type FOV + shutter math, tests green)
- [ ] Track UI merged (UI-DESIGN doc + 3 panes + state + persistence kept)
- [ ] Track VIZ merged (grid/shading wired in, blur overlay, badges)
- [ ] Track QA merged (unit + e2e green, LEARNINGS entry, per-track commits)

Merge order: DB → OPTICS → UI → VIZ → QA.

---

## V2 PARKED (out of scope — do not start)

- [ ] **I — Constraint optimization**: multi-constraint product optimizer
  (budget + performance + compatibility solved jointly, ranked
  recommendations with trade-off surface). Needs DB + OPTICS mature first.
- [ ] **H — 3D light sources**: light-source models in the 3D stage
  (ring/bar/dome/backlight placement + illumination overlays). Needs VIZ
  overlay patterns settled first.
- [ ] **J — Misc**: LLM-backed advice panel (prompt → model suggestion
  instead of v1 deterministic rules); seed-dataset expansion; `three.js`
  bundle code-split (~1.14 MB warning, see `docs/LEARNINGS.md`
  follow-ups); deployment verification of `api/extract-datasheet.ts`.
