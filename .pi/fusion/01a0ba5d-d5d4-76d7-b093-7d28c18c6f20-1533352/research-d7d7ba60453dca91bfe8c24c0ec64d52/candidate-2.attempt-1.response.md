# FAE Brief: Requirement-Driven Camera/Lens Selection — Handoff to Frontend / Backend / docs/

> Scope note (evidence limitation): all 6 declared Reddit URLs were fetched via `fusion_web_fetch` (markdown + text) on 2026-09-19. Every fetch returned HTTP 200 with body `Reddit` only — no thread title, post, or comment text was extractable (Reddit bot-block / JS shell). **No post content is quoted or paraphrased below.** Pain-point inferences are therefore drawn only from (a) thread slugs + declared `purpose` labels supplied in task context, (b) the request `background` statement, and (c) verified repo facts re-derived from `docs/`, `src/lib/`. Each §5 assumption is paired with the actual evidence used. Do not treat §1 thread summaries as verbatim thread reads.

Current tool verified baseline (from repo): React+TS+Vite SPA, 1–4 panels, `src/lib/optics.ts` thin-lens FOV (`m=f/(WD-f)`, `FOV=sensor/m`), `checkImageCircle`, `checkMountCompatibility` (C/CS 5mm spacer rule), `opticalFormats.ts` lookup, `seedData.ts` 4 sensors + 4 lenses, `localStorage` persistence, JSON export/import, one stateless `api/extract-datasheet.ts` endpoint (fetch→parse PDF via pdfjs / HTML via cheerio→Claude tool-use extract, per-field `found` flag). See `docs/requirements.md`, `docs/architecture.md`, `docs/LEARNINGS.md`.

---

## 1) Top user pain points + current workarounds (per thread — from slug + declared purpose only)

| # | Thread (slug / purpose) | Inferred pain point (label-level, not a quote) | Current workaround pattern implied by request + repo docs |
|---|---|---|---|
| 1 | `r/UAVmapping / choosing_the_right_lens_for_machine_vision_what` — "Lens choice confusion for machine vision" | Beginners don't know how to map application need (altitude/footprint/GSD) to focal length vs. sensor format. Lens-first vs. sensor-first ordering unclear. | Hand math from datasheets; asking forum for "what lens?" (`docs/requirements.md §1` confirms this is the core problem statement). |
| 2 | `r/computervision / 16535jn / if_applicable_computer_vision_engineers_are` — "How CV engineers actually select cameras" | Practitioners asked how working engineers select in practice — signals no canonical workflow; selection is tribal knowledge. | Ad-hoc vendor shortlists, prior-project reuse; forum polling instead of a calculator. |
| 3 | `r/computervision / 1jvyxn1 / camera_recommendations_please` — "Camera recommendation requests pattern" | Repeat "recommend me a camera" posts with under-specified requirements (missing WD, FOV, light, interface). | Free-text recommendation threads; answer quality depends on what specs OP happened to include. |
| 4 | `r/embedded / 1gfrpvs / image_sensor_lens_selection_for_embedded` — "Sensor plus lens selection for embedded" | Embedded adds sensor-module + ISP/driver + M12/S-mount + size/power constraints on top of optics; bare-sensor vs. camera-module confusion. | Vendor module pages (ArduCam/RPi ecosystem), trial-and-error board swaps. |
| 5 | `r/computervision / 1un5dum / help_choosing_a_camera` — "Help choosing a camera workflow" | Generic selection workflow question — what inputs to gather first, what order to decide in. | Checklist-style forum answers; no guided requirement→shortlist tool (gap vs. current app, which starts from already-chosen candidates per `docs/requirements.md §2`). |
| 6 | `r/computervision / aipr3n / machine_vision_camera_advice` — "Machine vision camera advice patterns" | Industrial machine-vision specifics: mount (C/CS), image-circle coverage, shutter type, interface (GigE/USB3). | Datasheet digging + compatibility gut-check; current tool's `checkImageCircle` + `checkMountCompatibility` directly targets this but only for 8 seed parts. |

Cross-cutting pain (supported by all six purposes + request background): **(a)** sensor/lens/mount matching confusion, **(b)** mount/interface vocabulary gap (C/CS/S-mount/M12), **(c)** UAV/embedded/CV tradeoffs not separated, **(d)** tool starts too late (compare known candidates) instead of requirement-driven ("I have FOV+WD+feature size → what focal length / pixel pitch do I need?").

## 2) Ecosystem: who fits with what

**Camera/sensor companies (verified in repo seed + docs):** Sony Semiconductor (IMX264/IMX178/IMX267/IMX392 — all seed sensors, `src/lib/seedData.ts` with Sony flyer URLs); ON Semi (cited as exemplar seed candidate in `docs/requirements.md §3.1`, not yet seeded). **Lens companies (verified):** Computar (V1226-MPZ 12mm 1", seed), Commonlands (CIL532 12mm, CIL525 25mm, CIL060 6mm M12 — seed). Integrators/distributors referenced: Framos (IMX267 source link), Graftek (Computar listing). Basler noted as UX reference (lens selector) in `docs/LEARNINGS.md §v1.1`.

**Lens types relevant to these segments:** fixed-focal C-mount industrial (Computar/Commonlands CIL5xx pattern); compact M12/S-mount board lenses for embedded/drones (CIL060 pattern, 6mm-class); high-res 5MP+ rated lenses matched to small pixels (CIL525 "rated for IMX264" pattern); zoom (data model already allows `focalLengthMaxMm`, `src/lib/types.ts`) but unseeded.

**How sensor / lens / mount / interface fit together (workers: enforce this):**
- Sensor defines active area (mm), resolution, pixel pitch (µm). Optical format (`1/2.3"`, `2/3"`, `1"`) is *not* a physical inch — must go through `opticalFormats.ts` lookup; explicit mm wins when present.
- Lens defines focal length, image circle (mm), mount, optional f/# + lp/mm. **Coverage rule:** `imageCircle >= sensorDiagonal` else vignetting; `<10% margin` = "tight" (judgment call documented in `optics.ts:checkImageCircle` + `LEARNINGS.md`).
- **Mount rule (implement exactly as `checkMountCompatibility`):** C==C ok; CS==CS ok; C-lens on CS-body ok with 5mm spacer; CS-lens on C-body always incompatible; M12/S-mount/F/other cross-family = mismatch. Note: mount lives on camera body, currently modeled on sensor entry as proxy (documented hack, `seedData.ts` header + `LEARNINGS.md`).
- Interface (GigE Vision / USB3 Vision / MIPI-CSI / CameraLink — selection-critical but **absent from current data model**; sensors carry no interface field) connects camera to host and constrains embedded/UAV choice (cable length, power, driver/ISP). Backend/frontend must add it as first model extension (see §4).

## 3) Industry-specific priority properties

| Segment | Priority order for requirements UI | Notes for workers |
|---|---|---|
| **UAV mapping** (thread 1) | 1. GSD (mm/px) from altitude (=WD) 2. footprint/FOV + overlap 3. global shutter 4. weight/power 5. interface/storage | Solve WD↔FOV↔f both directions (`workingDistanceForFov`, `focalLengthForFov` already exist — surface them as first-class "requirement solver," not hidden utils). Rolling-shutter flag missing — add. |
| **General CV / lab** (threads 2,3,5,6) | 1. FOV@WD 2. mm/px vs. smallest feature 3. mount + image-circle compat 4. lens lp/mm vs. sensor Nyquist (`500/pitch`) 5. lighting/f/# | This is the current tool's sweet spot; keep 3D cone + comparison table, add guided requirement wizard. |
| **Embedded** (thread 4) | 1. module/ISP/driver support 2. M12/S-mount + size 3. power/compute 4. pixel pitch vs. lens resolving power 5. interface (MIPI/USB) | Needs new fields: module name, ISP compat, dimensions, power; M12 lens subset filter. |
| **Inspection (machine vision)** | 1. mm/px + Nyquist vs. lens lp/mm 2. telecentricity/macro flag (m≥0.5/2 regimes already in `computeFovAxis`) 3. C/CS correctness 4. illumination/f/# | Keep `macro/extreme-macro/invalid` risk cues; add illumination/f# guidance, not full DoF/aberration modeling (stays out of scope per `requirements.md §6`). |

## 4) Prioritized website requirements (sniper-scoped)

**MUST (frontend + backend + docs):**
1. Requirement-first wizard: inputs = target FOV (or footprint+GSD), WD (or altitude), smallest feature → outputs = required focal length, max pixel pitch, min resolution (`focalLengthForFov`, `mmPerPixel`, `nyquistResolutionLpMm` already in `optics.ts`; frontend only needs to expose as solver UI). Closes threads 1/3/5 gap.
2. Compatibility gate on every pairing: image-circle check + mount check with plain-language fix ("needs 5mm spacer", "will vignette") — keep existing `optics.ts` logic verbatim; frontend must show pass/warn/fail per pairing (`requirements.md §3.4`).
3. Expand seed catalog to ~12 sensors / ~12 lenses covering 1/2.3"→1", C/CS/M12, 6–25mm, at least 2 global-shutter entries; each with `sourceUrl` provenance. Backend: keep single-URL extract with per-field `found` flag, never silent-save (existing contract).
4. Add `interface` + `shutter` + `shutterNotes` to Sensor/Camera model, filterable; document that mount-on-sensor is a body proxy (`docs/` update).
5. `docs/` update: requirement→spec mapping table + worked UAV/embedded/inspection examples with hand-checkable numbers matching `optics.test.ts` conventions.

**SHOULD:**
6. Multi-lens-vs-one-sensor comparison as default view (already partial — promote in layout).
7. Preset requirement templates per segment (§3 table) + shareable JSON export (extend existing export).
8. Extraction confidence UX (blank+flag stays; add snippet display — backend already returns `snippet`).

**CUT (explicitly not now):** bulk catalog crawling, live vendor APIs, OCR/login-wall PDFs, price/availability, DoF/bokeh, MTF/aberration modeling, accounts/cloud sync, mobile-first — all already out of scope (`requirements.md §6`); reaffirm so workers don't expand.

## 5) Assumptions × evidence (every assumption paired)

1. **Assumption:** Beginners conflate optical format with physical size and need lookup + to-scale visual. **Evidence:** repo ships `opticalFormats.ts` + 2D to-scale compare to solve exactly this (`requirements.md §3.2`); thread purposes 1/4/6 are sensor+lens matching questions (slug/purpose metadata only — content unfetched).
2. **Assumption:** Real workflow is "one sensor, N lenses," not pairwise. **Evidence:** `requirements.md §§3.6/7` explicitly decided this; seed includes 3 C-mount lenses vs. IMX264-class sensors (`seedData.ts`).
3. **Assumption:** C/CS 5mm spacer is the dominant mount gotcha. **Evidence:** implemented + tested in `optics.ts:checkMountCompatibility` and `optics.test.ts`; industrial lens seed is all C/M12 (`seedData.ts`).
4. **Assumption:** Thin-lens formula suffices for v1; macro regimes need warning not blocking. **Evidence:** `optics.ts:computeFovAxis` + risk thresholds documented as judgment calls in `LEARNINGS.md`; `requirements.md §3.3` mandates thin-lens over far-field.
5. **Assumption:** Interface/shutter/weight are the missing fields blocking UAV/embedded use. **Evidence:** absence in `types.ts` (Sensor has no interface/shutter/power fields) vs. thread purposes for UAV/embedded/CV tradeoffs; `requirements.md §6` lists price/DoF as out-of-scope but never mentions interface — gap identified by omission.
6. **Assumption:** No thread content was recoverable. **Evidence:** all six `fusion_web_fetch` calls returned `status 200, body "Reddit"` (markdown and text) — treat any detailed thread claim as unverified; brief uses only slugs/purposes + repo files.

**Handoff:** Frontend builds wizard (MUST 1,2,6,7) on existing `optics.ts` without changing formulas; Backend adds `interface/shutter` to extract schema + keeps stateless single-URL contract; docs/ records §3 presets, worked examples, and this evidence-limitation note.
