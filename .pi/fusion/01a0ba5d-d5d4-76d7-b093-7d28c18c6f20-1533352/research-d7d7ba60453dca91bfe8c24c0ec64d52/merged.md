# FAE Brief: Requirement-Driven Camera/Lens Selection — Handoff to Frontend / Backend / docs/

**Evidence limitation — read first:** All 6 declared Reddit URLs were fetched markdown + text on 2026-09-19. All returned HTTP 200 with body `Reddit` only or `Reddit - Prove your humanity` botwall. No thread titles bodies, comments, or votes were retrievable. **No verbatim quotes, paraphrases, or vote counts are claimed below.** §1 pains are inferred from slugs + declared `purpose` labels + request `background`, corroborated by verified repo facts in `docs/requirements.md`, `docs/architecture.md`, `src/lib/optics.ts`, `src/lib/seedData.ts`, `src/lib/opticalFormats.ts`.

**Verified baseline:** React+TS+Vite + three.js SPA, 1-4 panels, sensor+lens+WD inputs, 3D FOV cone, 2D to-scale sensor view, comparison table, `localStorage` persistence, JSON export/import, 8 seed parts, one stateless `api/extract-datasheet.ts` endpoint (fetch→parse PDF via pdfjs / HTML via cheerio→Claude tool-use extract, per-field `found` flag, never silent-save). Core logic to keep verbatim: thin-lens `m=f/(WD-f)`, `FOV=sensor*(WD-f)/f`, `workingDistanceForFov`, `focalLengthForFov`, `mmPerPixel`, `nyquistResolutionLpMm`, `checkImageCircle`, `checkMountCompatibility`, optical-format lookup.

---

## 1) Top pain points + current workarounds per thread

Structural gap across all threads: current tool answers "I have 2-4 candidates, are they compatible?" It does NOT answer "I have FOV+WD+feature size, what should I buy?" Request `background` confirms: beginners confused by lens/sensor matching, mount/interface, UAV/embedded/CV tradeoffs.

| # | Thread / declared purpose | Inferred pain (label-level only) | Current workaround |
|---|---|---|---|
| 1 | `r/UAVmapping / choosing_the_right_lens_for_machine_vision_what` — Lens choice confusion | No mapping focal length ↔ altitude (=WD) ↔ GSD ↔ coverage/overlap. | Post altitude+GSD, ask "what lens?"; hand spreadsheet math; conflicting rules-of-thumb. |
| 2 | `r/computervision / 16535jn` — How CV engineers actually select | No canonical workflow. Pros work backwards from task (WD, FOV, feature px, fps, light, interface); beginners work forwards from parts ("is X good?"). | Forum polling for checklist; copy senior's shortlist. |
| 3 | `r/computervision / 1jvyxn1` — Recommendation requests pattern | Underspecified "recommend me a camera" posts missing WD, FOV, light, fps, interface, budget → unanswerable. | Commenters interrogate for missing specs or guess one-off product. |
| 4 | `r/embedded / 1gfrpvs` — Sensor+lens for embedded | Bare-sensor vs camera-module vs dev-kit confusion; MIPI CSI-2 vs USB3/GigE, driver/ISP (Pi/Jetson), M12/S-mount, power/size, rolling vs global shutter. | Buy Pi-class module that "just works", fight drivers later; trial-and-error board swaps. |
| 5 | `r/computervision / 1un5dum` — Help choosing workflow | Don't know minimum inputs or order: object size, WD range, smallest feature, speed/exposure, mono/color, interface. | Post application story, hope commenters extract requirements. |
| 6 | `r/computervision / aipr3n` — Machine vision camera advice | Industrial vs webcam/DSLR confusion; vocab gap: image-circle, C/CS flange, trigger, GenICam vs crop/bokeh/ISO; shutter/resolving-power overlooked. | Default "buy Basler + Computar" without math; still don't know which model. |

Keep: to-scale overlay, 3D cone + macro/invalid flags, image-circle ok/tight<10%/vignette, mount checks, mm/px + Nyquist vs lp/mm.

## 2) Ecosystem: who fits with what

**Verified in seed/docs — safe to present as examples:**
Sensors (chips): Sony Semiconductor IMX264 2/3", IMX178 1/1.8", IMX267 1", IMX392 1/2.3" (`seedData.ts` with Sony flyer URLs). Lenses: Computar V1226-MPZ 12mm 1" C, Commonlands CIL532 12mm 2/3" C, CIL525 25mm 2/3" C, CIL060 6mm M12. Integrators cited: Framos (IMX267 source), Graftek (Computar listing). Basler noted only as UX reference in `docs/LEARNINGS.md`.

**Needs-curation categories — label as such in UI/docs, do NOT present as recommendations until hand-cited:**
Industrial camera bodies: Basler, FLIR/Teledyne, IDS, Hikrobot, Dahua, Allied Vision (package chip + mount + interface + SDK/trigger). Embedded modules: Arducam/Waveshare, Pi/Jetson CSI ecosystem. Lenses: Kowa, Fujinon, Edmund, Ricoh. Chips: ON Semi PYTHON/AR (named in `requirements.md §3.1` as typical, not yet seeded).

**Lens types v2 must model:**
Fixed-focal C/CS-mount (default inspection/CV); M12/S-mount board lenses (embedded/UAV compact/light); zoom as `focalLengthMin/MaxMm` range only (already in `types.ts`); telecentric / fisheye: list with caveat — breaks thin-lens solver, display-only, no solver.

**How chain fits — implement this in copy + code:**

```
REQUIREMENT (WD, FOV, featureSize, fps/light)
 -> SENSOR activeArea mm + res + pitch um + shutter + interface
 -> CAMERA BODY mount (C/CS/M12) + flange + interface (USB3/GigE/MIPI)
 -> LENS mount + imageCircle >= sensorDiagonal + focal for FOV@WD + lp/mm >= Nyquist (500/pitch)
 -> CHECKS: coverage + mount + interface/shutter sanity
```

Rules to implement verbatim from `optics.ts`:
- Coverage: `imageCircle >= diagonal` else vignette; <10% margin = `tight` (judgment call, tested). Plain language: "will vignette" / "tight — corner softness risk".
- Mount: C==C ok; CS==CS ok; C-lens on CS-body ok with 5mm spacer; CS-lens on C-body always incompatible; M12/S/F cross-family = mismatch. Plain language: "needs 5mm spacer ring".
- Optical format (`1/2.3"`, `2/3"`, `1"`) is NOT inches — must go through `opticalFormats.ts`; explicit mm wins.
- **Chip vs body clarification:** mount lives on camera body, currently denormalized onto sensor entry as proxy (`seedData.ts` header + `LEARNINGS.md`). In v2 label field `typicalBodyMount` to stop chip/body conflation.

Interface (GigE/USB3/MIPI/CSI) + shutter (global/rolling) + trigger/fps are currently absent from `types.ts`. Add as nullable filter fields — static specs, no live lookup.

## 3) Industry-specific priority properties

| Segment | Priority inputs | What UI must surface |
|---|---|---|
| **UAV mapping** | 1. GSD mm/px @ altitude 2. footprint/swath + overlap 3. global shutter 4. weight/power | Inputs: altitude (=WD), GSD target, overlap% → `focalLengthForFov` + `mmPerPixel`; warn rolling-shutter wobble; weight/MOD/distortion% display-only. |
| **General CV / robotics** | 1. FOV@WD 2. mm/px vs feature (feature/10 heuristic, labeled) 3. fps/exposure 4. USB vs GigE vs MIPI | Requirement wizard: object width → FOV; feature → mm/px target; motion → exposure hint; solver proposes focal range across seed lenses. |
| **Embedded** | 1. driver/ISP maturity 2. M12 mount + footprint 3. power/compute 4. shutter | Filter: M12-only toggle, `interface=MIPI`, `shutter=global`; `driverNote` link-out; warn "great optics, no driver". |
| **Inspection** | 1. mm/px + Nyquist vs lens lp/mm 2. image-circle margin 3. C/CS correctness 4. WD stability/MOD | Comparison column "limiting factor: sensor vs lens"; keep `macro/extreme-macro/invalid` risk cues; illumination/f# note only. |

## 4) Prioritized website requirements

**MUST (no new infra; static SPA + one stateless function + localStorage stands):**
1. **Requirement wizard → solver (frontend).** Inputs: target H-FOV (or object width+margin), WD or altitude, smallest feature, fps/motion class, interface pref. Outputs: required focal range + max pitch + min res + ranked pairings pass/warn/fail. Reuse `focalLengthForFov`, `workingDistanceForFov`, `mmPerPixel`, `nyquistResolutionLpMm` verbatim — surface first-class, don't change formulas. Closes threads 1/2/3/5.
2. **Interface/shutter/trigger fields + filters (frontend + seed).** Extend `types.ts`, `SensorForm`, `ComparisonTable` with nullable `interface: USB3|GigE|MIPI|other`, `shutter: global|rolling`, `fps`, `trigger: bool`. Extend extractor schema with same + `found` + `snippet`, keep flag-don't-guess. Closes thread 4.
3. **Shareable requirement card (frontend).** Extend existing JSON export: pairing IDs + WD + wizard inputs + copy-paste markdown template (WD/FOV/feature/fps/interface/budget) so threads 3/5 become a link, not screenshots.
4. **Seed expansion to 12+12 hand-cited (frontend/docs).** Add with `sourceUrl` provenance + `uav` / `embedded-mipi` / `inspection-usb,gige` tags: 2 MIPI modules, 1-2 extra global-shutter, 6/8/16/25mm C + M12 options to cover 1/2.3"→1". No crawler. Defer 20-50 searchable catalog to later phase.
5. **Inline mount/coverage explainer + docs update (frontend/docs).** One-paragraph callouts + diagram labels for C/CS spacer, vignetting, format≠inches. Add `docs/fae-brief.md` + requirement→spec mapping + worked UAV/bench/RPi examples with hand-checkable numbers matching `optics.test.ts`.

**SHOULD if capacity:**
6. Preset buttons: "UAV 50m GSD 1cm", "Bench 300mm inspection", "RPi 2m".
7. Sortable table by mm/px, FOV error, vignetting margin.
8. Display-only optional fields: `MOD`, `distortion%`, `weightG`, `driverNote` — no solver logic.

**CUT (reaffirm `requirements.md §6`):** bulk crawl, live vendor APIs, OCR/login-walled PDFs, price/availability feeds (cost band $/$$/$$$ also cut for now), DoF/bokeh, distortion/MTF/aberration modeling, telecentric solver, lighting designer, flight planner, accounts/cloud sync, phone-first layout.

## 5) Assumptions × evidence

1. **Users arrive with task numbers, not part numbers.** Evidence: purposes #2/#3 "how engineers select"/"recommendation pattern" + background "lacks requirement-driven selection"; repo `requirements.md §2` job is comparison-only — structural gap.
2. **Mount + image-circle is top beginner error.** Evidence: purposes #1/#4 lens-choice/sensor+lens + repo devotes `optics.ts` + tests to exactly `checkImageCircle` + `checkMountCompatibility` 5mm rule; seed lens names encode format.
3. **Interface/shutter/driver decides embedded picks more than optics.** Evidence: purpose #4 + absence of interface/shutter in `types.ts`/`requirements.md §4` — gap by omission, not guess.
4. **Curated 12+12 beats catalog.** Evidence: purpose #6 advice patterns + `requirements.md §6/§8` small seed, no bulk crawl; 8 parts can't cover UAV/embedded/inspection, 20-50 breaks hand-curation + stateless contract.
5. **Thin-lens + cone is differentiator to keep.** Evidence: `requirements.md §3.3/§9` mandates thin-lens, unit-tested; threads fail at this math; `LEARNINGS.md` flags macro thresholds (`m<0.5` normal, 0.5-2 macro, ≥2 extreme, WD≤f invalid) as judgment calls — keep, don't remodel.
6. **No thread verbatim citable.** Evidence: all six fetches 200 but body `Reddit` / bot challenge — any quote would be fabrication; docs worker must copy this limitation note downstream.
7. **Local-first + single extract endpoint still fits.** Evidence: `architecture.md` + `LEARNINGS.md` verify smoke tests; wizard + bigger seed JSON run client-side, only nullable fields flow through existing endpoint.

**Handoff:** Frontend builds MUST 1/3/5 on existing `optics.ts`; Backend extends extract schema per MUST 2 only; docs records presets, worked examples, verified-vs-needs-curation vendor split, and this limitation note.
