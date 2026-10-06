# UI rework: tabbed workspace, sensor comparison removed

## What changed

- **Removed the sensor size comparison section entirely** — the
  `SensorCompare2D` usage (`import` + `<Section title="Sensor size
  comparison">`) was deleted from `src/App.tsx`, along with the now-dead
  `camerasSensors` variable and `Sensor` type import. `FovCone3D.tsx` and
  `api/` were not touched.
  - NOTE: `src/components/SensorCompare2D.tsx` itself is still on disk.
    It is confirmed unused (no imports remain), but the sandbox shell
    guard blocks `rm`, so please delete it manually:
    `rm src/components/SensorCompare2D.tsx`.
- **Introduced a tab bar in `src/App.tsx`** (`role="tablist"`, three tabs,
  `activeTab` state, default `wizard`):
  1. **Application wizard** — `WizardPanel` only (inputs form +
     required-focal-range output).
  2. **Camera comparison** — camera panels (`FovCone3D` + `FovReadout`) +
     `ComparisonTable` + `CompatibilityExplainer`.
  3. **Ranked pairings** — new `RankedPairingsPanel` (ranking table +
     `ShareCard`), reading the same shared wizard inputs.
- **Lifted wizard state to `App`** via the new
  `src/components/useWizardDraft.ts` hook (string drafts + derived
  `WizardInputs` + `featureMode`/`valid`, defaults unchanged). Both the
  wizard tab and the pairings tab consume it, so edits in tab 1 are
  reflected in tab 3.
- **Split `src/components/WizardPanel.tsx`** — now controlled
  (`{ sensors, wizard }` props), renders inputs + focal-range output only.
  Ranking table + `ShareCard` moved verbatim into the new
  `src/components/RankedPairingsPanel.tsx` (`{ sensors, lenses, inputs,
  valid }` props), still driven by the existing `rankPairings()` /
  `shareCardText()` in `src/lib/fae.ts` (no optics logic duplicated).
- **Generous spacing** for wizard and comparison tabs: main column
  `gap-6` → `gap-8`, per-tab wrappers `flex flex-col gap-8 p-1 sm:p-2`,
  comparison grid `gap-4` → `gap-6`, camera cards `p-4` → `p-5 sm:p-6`.
  Sidebar (Sensors/Lenses library) unchanged and visible on all tabs.

## Files changed

- `src/App.tsx` — tab bar + tab content; removed `SensorCompare2D`.
- `src/components/WizardPanel.tsx` — controlled, focal-range only.
- `src/components/RankedPairingsPanel.tsx` — NEW, ranking + share card.
- `src/components/useWizardDraft.ts` — NEW, shared wizard state hook.
- `src/components/SensorCompare2D.tsx` — pending manual delete (see above).

## Verification

- `npm run typecheck` — no errors in `src/`; the only failures are
  pre-existing errors in `api/_lib/fetchContent.ts` (untouched, out of
  scope).
- `npm run lint` — no findings in `src/` (only warnings under
  `.pi/extensions/`).
- `npm test` — 5 files, 69 tests, all pass.
- Manual: `npm run dev:web`, then check each tab —
  1. wizard tab edits (FOV/WD/feature/interface/shutter) update the focal
     ranges and the Ranked pairings tab identically;
  2. comparison tab add/remove camera, sensor/lens dropdowns, WD slider,
     and lens table still work;
  3. no "Sensor size comparison" section anywhere; sidebar intact on all
     tabs.
