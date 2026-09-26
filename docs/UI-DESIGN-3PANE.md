# 3-Pane User Flow Redesign — `docs/UI-DESIGN-3PANE.md`

> **Status:** design doc only — no code. New file.
> **Goal:** replace the current tabbed workspace (`wizard` / `comparison` / `pairings`
> tabs in `src/App.tsx`) with a single 3-pane screen where the left pane picks
> *options*, the center pane *compares them visually*, and the right pane
> *advises in natural language*.
> **Grounding:** file pointers below were verified by reading `src/App.tsx`,
> `src/lib/fae.ts`, `src/lib/types.ts`, `src/lib/cameraPalette.ts`, and
> `src/components/SharedFovView.tsx` on 2026-09-26. No code was changed.

---

## 1. Problem with the current flow

Today (`src/App.tsx`):

- A left sidebar holds the **sensor/lens library** (add manually or via
  `DatasheetImportForm`), and a main column holds a **tablist** with three
  mutually exclusive views: `Application wizard` (`WizardPanel` +
  `useWizardDraft`), `Camera comparison` (per-slot sensor/lens `<select>`s +
  `FovCone3D` per panel or one `SharedFovView`), and `Ranked pairings`
  (`RankedPairingsPanel` reading `wizard.inputs` → `rankPairings()`).
- The user must **hop between tabs**: describe the task → switch tab to build
  the comparison → switch tab again to see the ranking → switch back to tweak.
  The ranking never drives the 3D view directly; the user hand-copies the top
  pairing into camera slots.
- The comparison slots have **no database filters** (raw `<select>` over every
  sensor/lens), no environment/standards context, and no advice layer — the
  user must already know what to compare.

The redesign collapses all three tabs into **one visible-at-once screen**:

| Pane | Role | Question it answers |
|------|------|---------------------|
| **Left — Options** | Pickers + filters | "What can I choose from?" |
| **Center — Comparison** | Shared 3D visualization | "How do the candidates differ, same POV?" |
| **Right — Advice** | Prompt box + rule-based answer | "What should I pick, and why?" |

---

## 2. ASCII wireframe

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Header (keep): logo · title · Export/Import JSON                             │
├──────────────┬───────────────────────────────────────────┬───────────────────┤
│ LEFT         │ CENTER                                    │ RIGHT             │
│ OptionsPanel │ SharedFovView (expanded, always-shared)   │ AdvicePanel       │
│ w ~300-340px │ flexible                                  │ w ~320-360px      │
│              │                                           │                   │
│ ┌─ Cameras ─┐│ ┌─ stage ───────────────────────────────┐ │ ┌─ Ask ─────────┐ │
│ │search box ││ │ [chip Cam1] [chip Cam2] [chip Cam3]    │ │ │ prompt box    │ │
│ │[x] GigE   ││ │ same POV · per-camera colors          │ │ │ [Ask]         │ │
│ │[x] USB3   ││ │ ┌─────────────────────────────────┐   │ │ └───────────────┘ │
│ │shutter:   ││ │ │                                 │   │ │ ┌─ Answer ──────┐ │
│ │ (•)any    ││ │ │   frustum Cam1 (blue #03a9f4)   │   │ │ │ #1 Fit 92 ... │ │
│ │ ( )global ││ │ │   frustum Cam2 (orange #f8982e) │   │ │ │ WHY: FOV ±4%· │ │
│ │format: 1" ││ │ │   GSD grid overlay              │   │ │ │ coverage ok · │ │
│ │IP: IP65+  ││ │ │   shaded FOV footprints         │   │ │ │ mount ok      │ │
│ │list:      ││ │ │                                 │   │ │ │ [VERIFIED] /  │ │
│ │ ▸ Cam A ✓ ││ │ └─────────────────────────────────┘   │ │ │ [NEEDS-VERIFY]│ │
│ │ ▸ Cam B ✓ ││ │ legend: color→camera · GSD px size   │ │ │ #2 Marginal.. │ │
│ │ ▸ Cam C   ││ └─────────────────────────────────────┘ │ │ #3 ...        │ │
│ └───────────┘│ ┌─ badges ────────────────────────────┐ │ │               │ │
│ ┌─ Lenses ──┐│ │ Cam1 [GigE ✓][global ✓] Cam2 [USB ✗]│ │ │ [Use top 2 in │ │
│ │mount: C   ││ │ shutter-blur note: rolling + motion │ │ │  comparison]  │ │
│ │covers: 1" ││ │ → "consider global"                 │ │ └───────────────┘ │
│ │(•)entocentr│└─────────────────────────────────────┘ │                   │
│ │( )telecentr│ ┌─ readout strip ─────────────────────┐ │                   │
│ │list:      ││ │ FOV mm · mm/px · coverage · mount   │ │                   │
│ │ ▸ 12mm ✓  ││ └─────────────────────────────────────┘ │                   │
│ │ ▸ 25mm    ││                                           │                   │
│ └───────────┘│                                           │                   │
│ ┌─ Environ. ┐│                                           │                   │
│ │(•)DIY     ││                                           │                   │
│ │( )Mfg     ││                                           │                   │
│ │ hint: IP/ ││                                           │                   │
│ │ EMC/safety││                                           │                   │
│ └───────────┘│                                           │                   │
└──────────────┴───────────────────────────────────────────┴───────────────────┘
  ◀─── collapsible on small screens ─── center stays ─── collapsible ──▶
```

Responsive behavior: below `lg` breakpoint the three panes stack
(Advice → Comparison → Options) or become collapsible drawers; the center
stage keeps a minimum height (`h-[480px]`, as today) and never unmounts on
tab switches because **there are no more tabs**.

---

## 3. Pane specifications

### 3.1 Left pane — `OptionsPanel` (NEW)

Replaces the current sidebar (`Sensors` / `Lenses` library sections in
`src/App.tsx`) **and** the per-camera `<select>` dropdowns in the comparison
tab. Instead of free-form library + raw dropdowns, it is a **database picker
with filters**:

**Camera list (from database, i.e. `useAppData().sensors` + seed data in
`src/lib/seedData.ts`):**

- Search box (name substring) + multi-select checklists:
  - **Interface** filter — `GigE | USB3 | CameraLink | CoaXPress | MIPI | other`
    (field: `Sensor.cameraInterface?` in `src/lib/types.ts`). Sensors with the
    field absent are shown under an "unknown — verify" group, never silently
    dropped (the "flag, don't guess" rule already used in `rankPairings`).
  - **Shutter** filter — `global | rolling | any` (field: `Sensor.shutter?`).
  - **Sensor format** filter — optical format / diagonal buckets derived via
    `sensorDiagonalMm()` + `src/lib/opticalFormats.ts` (e.g. 1/3", 1/1.8", 2/3", 1", ≥1").
  - **IP rating** filter — new optional field (see §7 v1-data note); until
    populated, all entries read "IP: unknown — verify against datasheet" and
    the filter is a soft flag, not a hard exclude.
- Each row: name, key specs (`widthMm×heightMm`, interface, shutter), a
  **shortlist checkbox** (checked = becomes a suggestion candidate / center
  slot), and a datasheet link affordance (reuse `DatasheetLinkButton`).
- "Add manually / from datasheet link" actions are kept (reuse `SensorForm`,
  `DatasheetImportForm`) but moved into a collapsed "Library +" disclosure so
  picking (the 95% action) dominates adding (the 5% action).

**Lens list (with mount/coverage filter + lens-type toggle):**

- **Mount** filter — `C | CS | S-mount/M12 | F | other` (field: `Lens.mount`).
- **Coverage** filter — minimum image-circle selector ("must cover ≥ 2/3\" /
  1\" / …") evaluated with the existing `checkImageCircle()` from
  `src/lib/optics.ts` against the currently shortlisted sensors (worst-case
  diagonal), or against a format bucket when no sensor is picked yet.
- **Lens-type toggle: entocentric vs telecentric** — new `lensType?` field
  (`'entocentric' | 'telecentric'`; defaults to entocentric for all existing
  entries). Entocentric = today's pinhole/thin-lens path (`computeFov`,
  `focalLengthForFov`). Telecentric = magnification-constant path: FOV is
  (nearly) WD-independent, so the WD slider locks and the readout shows
  magnification + telecentricity spec instead of focal-range math. v1 ships the
  toggle in UI + data model; if the telecentric math path is not yet
  implemented, selecting telecentric shows a NEEDS-VERIFY notice and falls back
  to the entocentric approximation labeled as such.
- Zoom support: surface `focalLengthMaxMm` (already in `Lens`) as a range row.

**Environment selector — DIY vs manufacturing:**

- Radio: **DIY / lab-prototype** vs **Manufacturing / production line**.
- Not a filter — a **standards-hint box** whose content changes:
  - DIY: "No enclosure rating strictly required; prefer USB3/MIPI, C/CS mount,
    off-the-shelf illumination; verify ESD handling only."
  - Manufacturing: "Checklist — enclosure IP rating (IP65/67 washdown?),
    24 V I/O + opto-isolation, GigE/CoaXPress lockable connectors, EMC/CE,
    shutter choice for line speed (global for moving parts), lens lock screws +
    focus lock, vibration rating; budget IQ/OQ documentation."
- The selection is stored in state (`environment: 'diy' | 'manufacturing'`)
  and passed to the `SuggestionEngine` (§3.3) as a scoring modifier (e.g.
  manufacturing up-weights GigE + global shutter + IP-rated bodies, surfaced as
  reasons, never as silent excludes) and to the AdvicePanel as a standards
  checklist appended to the answer.

### 3.2 Center pane — comparison visualization (REUSE + extend)

**Reuse as-is:**

- `src/components/SharedFovView.tsx` — single shared 3D stage, apex at shared
  origin, optical axis +Z, per-slot frustum tinted by **identity palette**
  (`slotColor()` in `src/lib/cameraPalette.ts`: blue `#03a9f4` / orange
  `#f8982e` / green `#22c55e`), Html badges for risk, `computeStageFit` /
  `fitCameraPosition` for framing. This is the heart of the center pane and
  stays mounted permanently (no tab unmounts anymore).
- `src/lib/cameraPalette.ts` (`SLOT_FILL_OPACITY`, `SLOT_RAY_OPACITY`,
  `slotEdgeColor/slotFillColor`) — per-camera colors, never risk colors.
- `FovReadout` readout strip under the stage (FOV mm, mm/px, coverage, mount).

**New/changed in the center:**

- **Suggested + shortlisted products only.** The stage renders the
  `suggestions` array from state (§5): advice-engine top-N overlaid with any
  user-pinned shortlist entries. Camera toggle chips above the stage
  (already exist) gain two affordances: pin/unpin and "from advice ★" marker.
- **Same POV, always.** Remove the `shared | separate` view-mode toggle in
  `src/App.tsx` — the 3-pane layout commits to shared-stage (Track A). The
  per-camera `FovCone3D` separate panels are deleted from this screen (keep the
  component for embed/debug use).
- **GSD grid** — overlay a ground-sample-distance grid on each footprint plane
  (reuse `PixelSizeGrid` / `MetricGridFloor` patterns; cell = `mmPerPixel`
  from `src/lib/optics.ts` × a readable multiple, e.g. 10/50/100 px steps with
  a label "1 cell = N mm ≈ M px"). Per-camera color, low opacity so overlaps
  stay readable.
- **FOV shading** — keep `FovShading` footprint fills; add a subtle overlap
  treatment (darker where ≥2 footprints intersect) so "which camera sees more"
  is glanceable.
- **Shutter-blur overlay note** — not a 3D effect; a badge row under the stage:
  per camera, `rolling + line-speed set → "motion blur risk — prefer global"`
  else `global ✓ for motion`. Data comes from `Sensor.shutter?` + wizard/task
  motion inputs; unknown shutter → NEEDS-VERIFY chip.
- **Interface pass/fail badges** — per-camera chips `[GigE ✓]` / `[USB ✗ needs
  GigE]` computed from `requiredInterface` vs `Sensor.cameraInterface?`
  (same predicate as the `excluded` logic in `rankPairings`, but rendered as a
  badge, not a silent drop).

### 3.3 Right pane — `AdvicePanel` + prompt box (NEW) + `SuggestionEngine` (fae.ts extension)

**Prompt box (top of right pane):**

- Free-text natural-language input, e.g. *"inspect 2 mm screws on a 300 mm tray
  from 500 mm, GigE, line moves fast"*.
- v1 parsing is **keyword/rule-based** (regex + dictionaries, no LLM call):
  extract FOV/feature-size numbers + units, WD, interface tokens
  (`gige/usb3/cameralink/coaxpress/mipi`), shutter/motion tokens
  (`moving/fast/line-speed → global`; `static → any`), format tokens
  (`1"`, `2/3"`), environment tokens (`washdown/factory → manufacturing`).
  Everything extracted is echoed as editable chips above the answer ("we read:
  WD 500 mm · GigE · global — ✎ fix"), and anything unparsed stays in the raw
  text, never hallucinated into constraints.
- "Ask" fills `WizardInputs` (`targetFovHmm/Vmm`, `workingDistanceMm`,
  `featureSizeMm`, `pixelsPerFeature`, `requiredInterface`, `requiredShutter`
  — all in `src/lib/fae.ts` today) plus the new `environment` field, then
  calls the engine.

**Advice answer (below the prompt box) — rule-based suggestion engine v1:**

- New functions in an `fae.ts` extension (same module or `src/lib/suggestions.ts`
  importing it): `parseAdviceQuery(text) → Partial<WizardInputs & {environment}>`,
  `suggestPairings(inputs, environment, sensors, lenses) → Suggestion[]`.
  `suggestPairings` **delegates scoring to the existing `rankPairings()`** —
  no new optical math — then layers:
  1. **Compat DB** — the existing `checkImageCircle` + `checkMountCompatibility`
     verdicts (already inside `RankedPairing`), plus the new lens-type and
     IP-rating flags.
  2. **Coverage check** (`coverage: ok|tight|vignetting`) and **interface check**
     (required vs actual) promoted to first-class badge fields on `Suggestion`.
  3. **Environment modifier** — small score deltas (±5) with explicit reasons
     (e.g. "+manufacturing: GigE locking connector", "+diy: USB3 simplicity").
- Each answer card shows: rank + verdict chip, sensor + lens names, one-line
  numbers (FOV, mm/px, score), 1–3 WHY bullets (citing the `reasons` strings
  `rankPairings` already returns), and an **evidence tag per claim**:
  - `[VERIFIED]` — computed from in-database values via `optics.ts`
    (FOV, coverage, mount, limiting factor).
  - `[NEEDS-VERIFY]` — depends on a missing/uncertain field (interface/shutter/
    IP unspecified, telecentric approximation, resolving-power unknown) with
    the sentence "verify X against the datasheet before committing" (mirroring
    today's `-5 flag` behavior, now visible per-claim).
- A **[Use top-N in comparison]** button writes the top-N (default 2, max
  `MAX_CAMERAS` from `src/lib/twoCamera.ts`) into the center stage slots —
  this is the **right → center drive** (§5).
- The current `RankedPairingsPanel` + `shareCardText()` + `CompatibilityExplainer`
  content is absorbed into these cards (same data, conversational frame);
  keep `shareCardText` for the copy-to-clipboard action inside AdvicePanel.

---

## 4. Component map

| Component / module | New / reuse / modify | Notes |
|--------------------|----------------------|-------|
| `src/App.tsx` | **modify** | Delete `TABS`/`activeTab`/`AddMode` tab scaffolding; compose `<OptionsPanel/> <CenterStage/> <AdvicePanel/>` grid; hold `suggestions` + `environment` state (§5). Keep header Export/Import, `useAppData`, `wizard` draft as the task-model source. |
| `OptionsPanel` | **NEW** (`src/components/OptionsPanel.tsx`) | Camera picker + filters (interface/shutter/format/IP), lens picker (mount/coverage/type-toggle), environment radio + standards hints. Reads `sensors`/`lenses` props; emits shortlist + filter state. Reuses `SensorForm`, `LensForm`, `DatasheetImportForm`, `DatasheetLinkButton`. |
| `SharedFovView` | **reuse** (`src/components/SharedFovView.tsx`) | Permanent center stage. Props unchanged (`slots`, `sharedScaleMm`). Add GSD-grid + overlap-shading props (minor extension). |
| `cameraPalette` | **reuse** (`src/lib/cameraPalette.ts`) | `slotColor/slotFillColor`, opacities. Possibly extend `SLOT_COLORS` past 3 for larger shortlists. |
| `FovShading`, `PixelSizeGrid`, `MetricGridFloor` | **reuse** | GSD grid + footprint shading building blocks. |
| `FovReadout`, `ComparisonTable`, `CompatibilityExplainer` | **reuse (relocated)** | Readout strip stays under stage; table/explainer move into AdvicePanel cards or a center-bottom disclosure. |
| `AdvicePanel` | **NEW** (`src/components/AdvicePanel.tsx`) | Prompt box + parsed-chips + ranked answer cards with VERIFIED/NEEDS-VERIFY tags + "Use top-N in comparison" + clipboard share (reuse `shareCardText`). |
| `SuggestionEngine` | **NEW, as `fae.ts` extension** (`src/lib/suggestions.ts` or appended `fae.ts`) | `parseAdviceQuery`, `suggestPairings` (wraps `rankPairings` + compat DB + coverage/interface checks + environment modifiers), `Suggestion` type. All numbers from `optics.ts` via `fae.ts`; no new math. |
| `WizardPanel` / `useWizardDraft` | **modify → absorb** | Task model (`WizardInputs`) survives as the engine's input struct; the wizard *UI tab* is deleted, replaced by the AdvicePanel prompt box + parsed chips. Keep the struct + validation. |
| `RankedPairingsPanel` | **modify → absorb** | Ranking table UI deleted as a tab; its data path (`rankPairings`) becomes the engine core feeding AdvicePanel. |
| `FovCone3D` separate panels, `viewMode` toggle | **delete from screen** | Commit to shared stage; keep component file for non-3-pane use. |
| `twoCamera.ts` (`CameraSlot`, `computeTwoCameraView`, `MAX_CAMERAS`, persistence) | **reuse** | Slot model + shared-scale math unchanged; slots are now written by suggestions (§5). |

---

## 5. State flow

```text
App.tsx (state owner)
 │
 │  sensors, lenses ......... useAppData() (unchanged; seedData.ts = database)
 │  task .................... WizardInputs (+ environment: 'diy'|'manufacturing')
 │  shortlist ............... { sensorIds, lensIds }  (from OptionsPanel)
 │  suggestions ............. Suggestion[] (from SuggestionEngine via AdvicePanel)
 │  cameras (slots) ......... CameraSlot[] (twoCamera.ts, persisted localStorage)
 │
 ├─ OptionsPanel ── emits ─▶ onShortlistChange(ids) ──▶ filters suggestion pool
 │                  emits ─▶ onEnvironmentChange(env) ─▶ engine modifier + hints
 │
 ├─ AdvicePanel ── prompt ─▶ parseAdviceQuery ─▶ task ─▶ suggestPairings ─▶ cards
 │       │                                                        │
 │       └─ [Use top-N] ─▶ onApplySuggestions(pairings) ──────────┘
 │                                                              ▼
 └─ CenterStage ◀── slots = buildSlots(topN suggestions ⊕ pinned shortlist)
                   via createSlot/updateCameraSlot; computeTwoCameraView()
                   → resolved → <SharedFovView slots resolved /> + badges/readout
```

Rules:

1. `App.tsx` owns `suggestions`; the center never computes rankings itself.
2. Applying suggestions **replaces unpinned slots** (pinned/shortlisted cameras
   survive) and clamps to `MAX_CAMERAS`.
3. Every suggestion applied to the center carries its `Suggestion` record, so
   badges (interface pass/fail, shutter-blur note, VERIFIED/NEEDS-VERIFY) render
   without recomputation.
4. `saveCameraSlots` persistence stays — a reload restores the last center
   comparison, same as today.

---

## 6. What is deliberately NOT in v1

- No LLM / network advice call — the engine is deterministic and citable.
- No new optical models — telecentric, IP rating, and 3D-lighting realism are
  data-model/UI hooks only (§7).
- No multi-task sessions — one task at a time; history is copy-to-clipboard.
- No change to the JSON export schema beyond additive optional fields
  (`lensType?`, `ipRating?`, `environment?`).

---

## 7. v2 hooks (kept open, not built)

- **Constraint optimization** — replace top-N-by-score with a solver
  (budget cap, WD band, "must cover" formats) over the same `rankPairings`
  score surface; `Suggestion.score` + `ExcludedPairing` already provide the
  objective + hard-constraint split.
- **3D lights / realism** — feed the GSD grid + footprint data into an
  illumination preview (ring-light/spot angle, exposure vs motion blur estimate
  from shutter + line speed); the shutter-blur badge row is the seam.
- **Telecentric math path** — magnification-based FOV (`FOV = sensor / mag`)
  + distortion/telecentricity specs in `Lens`; toggle already reserves the UI.
- **IP-rating DB + standards pack** — `Sensor.ipRating?` (+ lens sealing flag)
  backfills the manufacturing checklist into hard filters with datasheet cites.
- **Advice memory** — persist prompt → applied-suggestion pairs next to camera
  slots for audit trails.

---

## 8. Acceptance sketch (design-level)

1. User picks interface/shutter/format filters left → camera list narrows;
   unknown-field entries flagged, not hidden.
2. User toggles lens type + mount/coverage left → lens list narrows.
3. User asks a natural-language question right → parsed chips echo constraints;
   answer cards rank with WHY reasons + VERIFIED/NEEDS-VERIFY tags.
4. "Use top-2 in comparison" → center stage shows both frustums same-POV,
   per-camera colors, GSD grid, FOV shading, interface badges, shutter-blur note.
5. Switching DIY ↔ manufacturing changes hints left and re-weights reasons right.
6. Reload restores the center comparison (existing slot persistence).
