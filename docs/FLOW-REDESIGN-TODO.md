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

> QA 2026-09-26: landed as `src/lib/database/` (cameras|lenses|software|rules.ts + *.test.ts,
> commit `f199c74`) instead of the `compatibilityDb.ts` / `seedCompatibility.ts` names below —
> same contract (VERIFIED with cited URL / NEEDS-VERIFY amber default), different path.

- [x] `src/lib/database/` (landed path; TODO name was `compatibilityDb.ts`): typed tables —
  - [x] `cameraSoftwareCompat` → `database/software.ts` `COMPAT_MATRIX`: family × software rows with status
    `VERIFIED | NEEDS-VERIFY | NOT-SUPPORTED` + source citation per VERIFIED row (`verified()` requires
    `sourceUrl`; `unverified()` defaults to NEEDS-VERIFY). Convention: `NEEDS-VERIFY` renders with amber badge +
    "unverified — check vendor docs" note, never silently passes.
  - [x] `mountSensorCoverage` → `database/rules.ts` `coverageCheck` (image-circle Ø vs sensor diagonal) +
    `database/cameras.ts` family mounts + `checkImageCircle` 10%-margin tight band in `src/lib/optics.ts`
    (surfaced in OptionsPanel coverage readout).
  - [x] `interfaceCheck` → `database/rules.ts` `interfaceCheck` (per-interface cable-length limits) +
    `INTERFACE_LIMITS_M`; unknown cable length degrades to warn via `slotCompat.ts`, never silent pass/fail.
  - [x] `ipRatingGuide` → `database/rules.ts` `FAMILY_ENV_RATING` + `environmentRating()` with DIY vs
    manufacturing split (IP40 lab/DIY ok, sealed variants for washdown/food-pharma) — advisory text +
    filter thresholds in OptionsPanel Environment section.
- [x] Seed rows: `database/cameras.ts` + `database/lenses.ts` (+ `software.ts` matrix) with cited rows;
  every `VERIFIED` row carries a source, everything else defaults to `NEEDS-VERIFY`.
- [x] Pure query fns (`verifiedFor`/`lookupCompat`/`allMatches`, `coverageCheck`, `interfaceCheck`,
  `environmentRating`) — framework-free, vitest-covered (see Track QA).
- [x] Commit: `f199c74 feat(data): machine-vision compatibility database` (TODO name was `feat(db): …`)

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

> QA 2026-09-26: math landed (`lensMath.ts` + `shutterMath.ts`, commit `0c1e254`); the shared-type
> `Lens.lensType` field + seed-lens migration is still OPEN (OptionsPanel keeps a local toggle with a
> NEEDS-VERIFY fallback — no per-lens datasheet magnification exists in seed data).

- [ ] Lens-type FOV split (gate on `lens.lensType`):
  - [x] Thin-lens (entocentric/fixed-focus/varifocal): existing
    `FOV = dim * (WD − f) / f` (`computeFovAxis` in `src/lib/optics.ts`) untouched;
    `WD <= f` invalid + magnification risk buckets kept.
    (<0.5 normal / 0.5–2 macro / ≥2 extreme-macro — see
    `docs/LEARNINGS.md` judgment-calls section).
  - [x] Telecentric: `FOV = dim / m` via `lensMath.computeFovForLens` (m = magnification, WD-independent
    within telecentric range); WD only gates in/out-of-range (`limited` gate with message). Unit-tested in
    `lensMath.test.ts`; UI wiring pending on the `lensType` field above.
  - [ ] `lensType` field on `Lens` type (`entocentric | telecentric |
    varifocal …`) + migration for seed lenses (default entocentric,
    flagged `NEEDS-VERIFY` where datasheet doesn't state it). — OPEN, see note above.
- [x] Shutter math (`src/lib/shutterMath.ts`, VIZ-facing wrapper `src/lib/shutter.ts` which delegates to it):
  - [x] Exposure cap: `t_exp ≤ blur_tol / v` (`blurBudget`) — global + rolling baseline.
  - [x] Rolling-shutter skew overlay input: `Δx = v * T_readout` (`rollingSkew`; per-camera from sensor spec or
    estimated `1/fps` fallback flagged as estimate).
  - [x] Global vs rolling branch (`motionCheck`): global → motion-blur check only;
    rolling → blur + skew checks; output `pass | warn | fail` + message
    strings reused as viz badges (Track VIZ).
- [x] Commit: `0c1e254 feat(optics): telecentric + shutter math`

Files: `src/lib/optics.ts` (`computeFovAxis`, `computeFov`,
`mmPerPixel`, `derivePixelPitchUm`), `src/lib/shutter.ts` (new),
`src/lib/types.ts` (`Lens.lensType`, `Sensor.shutterType`),
`src/lib/seedData.ts`, `docs/LEARNINGS.md` (risk-threshold rationale).

---

## Track UI — 3-Pane Layout

Shell + wiring. Depends on DB/OPTICS **types** (not their full data).
Spec lives in `docs/UI-DESIGN-3PANE.md` (to be written — write it first
inside this track, then build to it).

- [x] Write `docs/UI-DESIGN-3PANE.md`: pane widths/behavior (collapsible
  left filters? responsive collapse order?), shared selection state
  shape, prompt→suggestion→comparison interaction contract.
- [x] `src/components/OptionsPanel.tsx` (new, left): camera list,
  lens list, filters (mount, interface, IP/DIY-vs-manufacturing, budget,
  shutter) — reads Track DB query fns; emits selection + filter state up.
  → Done 2026-09-26 (Track UI): camera search + interface/shutter/format/IP-flag
  filters with shortlist checkboxes, lens mount/coverage/entocentric-telecentric
  toggle (telecentric hooks lensMath.computeFovForLens, NEEDS-VERIFY fallback),
  DIY/manufacturing radio + standards hints, Library + disclosure.
- [x] `src/components/AdvicePanel.tsx` (new, right): prompt input
  (user asks question in own words) → rule-based suggestion
  (DB + OPTICS ranks products) → suggestion cards that drive the center
  comparison + table. v1 is deterministic rules, not an LLM call
  (see V2 PARKED §J).
  → Done 2026-09-26 (Track UI): prompt box → parseAdviceQuery chips echo →
  suggest() cards (verdict, reasons, VERIFIED/NEEDS-VERIFY, failedChecks) +
  [Use top-N in comparison] writing slots clamped to MAX_CAMERAS.
- [x] `src/lib/suggestion.ts` SuggestionEngine v1 — landed 2026-09-26
  (`feat(fae): suggestion engine v1`): `suggest(question, ctx)` +
  `parseAdviceQuery` + `buildWizardInputs` + `familyForSensor`, scoring via
  `rankPairings()` with environment (±5) and software-compat modifiers,
  per-suggestion `reasons[]`, VERIFIED (with URL) / NEEDS-VERIFY evidence,
  and pass/fail `failedChecks[]`; covered by `src/lib/suggestion.test.ts`
  (15 cases). No UI edits — AdvicePanel wires this up next.
- [x] `src/App.tsx`: 3-pane grid shell (left / center / right);
  shared selection state (lift from current hero configurator);
  → Done 2026-09-26 (Track UI): OptionsPanel / SharedFovView-always-shared /
  AdvicePanel grid; tabs + shared/separate toggle deleted; shortlist pool +
  environment state owned here; slot persistence kept.
  existing `WizardPanel`, `RankedPairingsPanel`,
  `ComparisonTable` re-homed (wizard prompt → right pane;
  table stays under center or docks right — decide in UI-DESIGN doc).
- [x] Preserve `localStorage` persistence (`src/store/persistence.ts`,
  `src/store/useAppData.ts`, `twoCamera.ts` slot key) across the move — verified unchanged keys, no schema
  break (QA e2e clears `camera-selection-tool/v1` + `camera-selection-tool/cameras-v1` and starts clean).
- [x] Commit: `2ca967a feat(ui): 3-pane options/visualize/advise flow`

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
- [x] Commit: `c150756 feat(viz): wire shading+GSD+shutter+badges into shared view` +
  `06243f6 feat(viz): delegate shutter readout to shutterMath` (landed as two commits instead of one)

Files: `src/components/SharedFovView.tsx`,
`src/components/PixelSizeGrid.tsx`, `src/lib/pixelGrid.ts`,
`src/components/FovShading.tsx`, `src/lib/cameraPalette.ts`,
`src/lib/frustumGeometry.ts`, `src/components/FovCone3D.tsx`
(badge pattern), `src/lib/stageFit.ts`.

---

## Track QA — Tests + Docs + Commits

Lock in the redesign. Lands last, after DB/OPTICS/UI/VIZ.

- [x] Vitest unit tests:
  - [x] Compat DB — landed as `src/lib/database/*.test.ts` (cameras/lenses/rules/software: VERIFIED/
    NEEDS-VERIFY defaults, coverage incl. 10% tight band via `checkImageCircle`, interface limits,
    DIY-vs-manufacturing environment ratings) instead of the TODO's `compatibilityDb.test.ts` name.
  - [x] Optics — telecentric `FOV=dim/m` vs thin-lens `FOV=dim*(WD−f)/f` + WD gating per lens type in
    `src/lib/lensMath.test.ts` (TODO named `optics.test.ts`; existing `optics.test.ts` untouched).
  - [x] Shutter — `t_exp ≤ blur/v` cap, `Δx=v*T_readout` skew, global-vs-rolling branches, estimate
    fallbacks flagged, in `src/lib/shutterMath.test.ts` + `src/lib/shutter.test.ts`.
- [x] e2e: new `e2e/flowRedesign.e2e.test.ts` (3 panes render, left filter narrows options, right prompt
  drives a suggestion into the center via Use-top-N) + `e2e/comparisonStability` test 3 rewritten for the
  always-shared stage (old version waited for 2 canvases — impossible by design — and timed out);
  `e2e/comparisonStability` + `e2e/sharedViewStability` green (9/9 total).
- [x] Docs: dated `docs/LEARNINGS.md` entry 2026-09-26 (flow-redesign decisions + honest not-verified notes);
  `docs/architecture.md` §6a repo-layout addendum (new DB/OPTICS/UI/VIZ modules).
- [x] Commits: one per track (`f199c74` data, `0c1e254` optics, `44e1aad` suggestion engine, `2ca967a` UI,
  `c150756` + `06243f6` viz — viz took two, not squashed).
- [x] Final full verification: `npm test` (23 files / 252 pass) + `npm run test:e2e` (3 files / 9 pass) +
  `npm run typecheck` + `lint` + `npm run build` green.

Files: `src/lib/*.test.ts`, `e2e/sharedViewStability.e2e.test.ts`,
`e2e/comparisonStability.e2e.test.ts`, `vitest.e2e.config.ts`,
`docs/LEARNINGS.md`, `docs/architecture.md`.

---

## Merge / Done checklist

- [x] Track DB merged (compat tables + VERIFIED/NEEDS-VERIFY + seed rows — as `src/lib/database/`)
- [x] Track OPTICS merged (lens-type FOV + shutter math, tests green; `Lens.lensType` migration parked openly)
- [x] Track UI merged (UI-DESIGN doc + 3 panes + state + persistence kept)
- [x] Track VIZ merged (grid/shading wired in, blur overlay, badges)
- [x] Track QA merged (unit + e2e green, LEARNINGS entry, per-track commits)

Merge order: DB → OPTICS → UI → VIZ → QA.

---

## V2 PARKED (out of scope — do not start)

> QA 2026-09-26 confirmations: all three verified NOT STARTED — no optimizer, light-source, or LLM-advice
> code exists in the tree (grep: no `optimizer`, no `LightSource`/`light-source` model, AdvicePanel calls
> deterministic `suggest()` only; `three.js` bundle still unsplit ~1.18 MB; `api/extract-datasheet.ts`
> still never deployed). They remain parked as written below.

- [ ] **I — Constraint optimization**: multi-constraint product optimizer
  (budget + performance + compatibility solved jointly, ranked
  recommendations with trade-off surface). Needs DB + OPTICS mature first.
  → PARKED confirmed 2026-09-26: no optimizer module exists; `suggest()` ranks single pairs only.
- [ ] **H — 3D light sources**: light-source models in the 3D stage
  (ring/bar/dome/backlight placement + illumination overlays). Needs VIZ
  overlay patterns settled first.
  → PARKED confirmed 2026-09-26: no light-source geometry/overlays in `SharedFovView` or anywhere else.
- [ ] **J — Misc**: LLM-backed advice panel (prompt → model suggestion
  instead of v1 deterministic rules); seed-dataset expansion; `three.js`
  bundle code-split (~1.14 MB warning, see `docs/LEARNINGS.md`
  follow-ups); deployment verification of `api/extract-datasheet.ts`.
  → PARKED confirmed 2026-09-26: AdvicePanel is rules-only; seed catalog still 4×4; bundle warning persists
  (~1.18 MB); extraction endpoint still undeployed.
