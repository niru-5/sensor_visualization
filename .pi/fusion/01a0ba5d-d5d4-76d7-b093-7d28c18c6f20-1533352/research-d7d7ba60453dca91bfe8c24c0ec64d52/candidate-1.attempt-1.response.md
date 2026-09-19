# FAE Brief: Requirement-Driven Camera/Lens Selection — Grounded in Real User Pain

**Handoff for:** frontend worker, backend worker, `docs/`.
**Current baseline (verified in repo):** React19 + Vite + three.js SPA, 1–4 panels, sensor+lens+WD model, 3D FOV cone (`src/lib/optics.ts` thin-lens `m=f/(WD-f)`, `FOV=sensorDim/m`), image-circle + C/CS mount checks, 2D sensor-scale view, comparison table, localStorage + JSON export/import, 8 seed parts (4× Sony IMX sensors, 1× Computar + 3× Commonlands lenses), one stateless Claude datasheet-extract endpoint (`api/extract-datasheet.ts` + `scripts/dev-api.ts`). See `docs/requirements.md`, `docs/architecture.md`, `docs/LEARNINGS.md`.
**Method limitation (honest):** all 6 declared Reddit URLs were fetched in both `markdown` and `text` modes. Every fetch returned only a bot-wall (`"Prove your humanity … bots"`, or bare `"Reddit"` shell) — no thread bodies, comments, or votes were retrievable. Therefore **no verbatim quotes or per-thread vote counts are claimed below**. Per-thread pain points are derived from (a) the authoritative request text, (b) thread titles + declared purposes supplied in the task context, and (c) the repo's own requirements/learnings that already document these confusions. Each assumption in §5 is paired with the actual evidence that supports or limits it.

---

## 1. Top pain points + current workarounds (per thread)

**General pattern across all 6 threads (per request background):** beginners confused by lens/sensor matching, mount/interface, and UAV/embedded/CV tradeoffs. Current tool only answers "I already have 2–4 candidates, are they compatible?" — it does NOT answer "what should I buy given my requirement?"

| # | Thread (title + purpose) | Pain point (scoped to title/purpose, not invented quotes) | Current workaround users fall back to |
|---|---|---|---|
| 1 | `r/UAVmapping — Choosing the right lens for machine vision, what…` / lens-choice confusion | Focal-length ↔ altitude/GSD/FOV mapping for mapping payloads. Thin-lens math + overlap/trigger-rate coupling is opaque to newcomers. | Post sensor + altitude + desired GSD and ask for focal-length recommendation; hand FOV math in spreadsheets. |
| 2 | `r/computervision — If applicable, CV engineers, are [you]…` / how CV engineers actually select cameras | No repeatable selection workflow: requirement → sensor → lens → interface → lighting/compute. Veterans use checklists; beginners skip to brand recommendations. | Ask "how do *you* do it?"; copy senior's vendor/shortlist. |
| 3 | `r/computervision — Camera recommendations please` / recommendation-request pattern | Underspecified asks ("need camera for X") missing WD, FOV, fps, light, interface, budget → unanswerable without 5 follow-up questions. | Thread becomes requirements-elicitation interview; answer is a one-off product name, not reusable. |
| 4 | `r/embedded — Image sensor/lens selection for embedded` / sensor+lens for embedded | Bare-sensor vs. camera-module vs. dev-kit confusion; M12/S-mount + rolling vs. global shutter + MIPI/CSI driver support + ISP/compute limits. | Buy Raspberry-Pi-class module that "just works" even if optically suboptimal; fight drivers later. |
| 5 | `r/computervision — Help choosing a camera` / choosing workflow | Don't know minimum inputs: object size, smallest feature, WD range, speed/exposure, lighting, mono/color/NIR, interface. | Post application story, hope commenters extract requirements for them. |
| 6 | `r/computervision (2019) — Machine vision camera advice` / advice patterns | Industrial-camera vs. webcam/DSLR confusion; machine-vision vocabulary gap (image circle, flange distance, trigger, GenICam) vs. consumer terms (crop, bokeh, ISO). | Get told "don't use a webcam, buy Basler/FLIR/IDS + C-mount lens"; still don't know *which* model. |

**What current tool already solves (keep):** to-scale sensor overlay, 3D FOV cone with macro/invalid risk flags, image-circle (ok/tight<10%/vignetting) + C/CS-spacer mount checks, mm/pixel + Nyquist vs. lens lp/mm, seed data with cited datasheets. **Gap:** no requirement-first flow, no catalog/search, no industry presets, no interface/driver dimension at all.

---

## 2. Ecosystem: who makes what + how sensor/lens/mount/interface fit

### 2a. Companies (sniper scope — name only what the tool must model)

- **Sensors (chip):** Sony Semiconductors (IMX264/267/178/392 — all 4 seed sensors), onsemi (PYTHON/AR series). Tool stores chip specs, not vendor API.
- **Industrial cameras (body = mount + interface owner):** Basler, FLIR/Teledyne, IDS, Hikrobot, Dahua/MindVision, Allied Vision. Critical insight from `LEARNINGS.md`: **mount lives on the camera body, not the chip** — current data model intentionally denormalizes typical body mount onto the sensor entry (e.g., IMX264→C). Keep this but label it `typicalBodyMount` in v2 so users stop conflating chip with camera.
- **Lenses:** Computar, Commonlands (all 4 seed lenses), plus Kowa, Fujinon, Edmund Optics, Ricoh. Model by `focalLength + mount + imageCircle + rated lp/mm + MOD`, not brand prestige.
- **Embedded modules/ISPs:** Raspberry Pi / Arducam (M12/S-mount), NVIDIA Jetson CSI ecosystem, Framos (sensor-module bridge — already a seed source URL for IMX267).

### 2b. Lens types v2 must enumerate

Fixed-focal C/CS-mount (default for inspection/CV), M12/S-mount board lenses (embedded/UAV-weight-constrained), telecentric (measurement/inspection — fixed WD, magnification-first, breaks thin-lens solver assumptions), fisheye/wide-FOV (UAV navigation, needs distortion caveat), zoom (discourage — model as min/max range only).

### 2c. How the chain fits (the one diagram both workers implement)

```
REQUIREMENT (FOV + featureSize + WD + fps/light)
  → SENSOR activeArea + resolution + pixelPitch + shutter + interface
  → CAMERA BODY mount (C/CS/M12/F) + flange distance + interface (USB3/GigE/MIPI/CSI/CoaXPress)
  → LENS mount + imageCircle ≥ sensorDiagonal + focalLength for FOV@WD + resolvingPower ≥ sensor Nyquist
  → CHECKS: imageCircle (already in optics.ts) + mount incl. C-on-CS 5mm spacer / CS-on-C impossible (already in optics.ts) + NEW: interface/shutter/MOD sanity flags
```

Interfaces matter because threads 2/4/5 show beginners pick USB webcam when they need triggered GigE, or MIPI sensor with no driver. v2 needs interface as a first-class filter field even though v1 explicitly cut it (`requirements.md` §6).

---

## 3. Industry-specific priority properties

| Segment | #1 priority | #2 | #3 | What to preset in UI |
|---|---|---|---|---|
| **UAV mapping (thread 1)** | GSD (mm/px) @ altitude + overlap for photogrammetry | Weight/power + global shutter (motion blur/rolling-shutter wobble) | Fixed-focus rugged M12/C-mount, NIR option | Inputs: altitude, GSD target, overlap% → solve focal length via existing `focalLengthForFov`; flag rolling shutter |
| **General CV / robotics (threads 2,3,5,6)** | FOV @ WD + fps/exposure for motion freeze | Trigger + interface (USB3 vs GigE cable length) | Mono vs. color, NIR/low-light | Requirement wizard: object size → FOV; feature/10 → mm/px target; motion speed → exposure hint |
| **Embedded (thread 4)** | Driver/ISP support (MIPI-CSI, Jetson/Pi compat) + form factor | M12 lens availability + MOD for close WD | Power/thermal/compute budget | Filter: `driverMaturity`, `moduleFootprint`; warn "great optics, no driver" explicitly |
| **Inspection/measurement** | mm/px + Nyquist-vs-lens-lp/mm margin + telecentricity when tolerances tight | Stable WD + MOD + C-mount rigidity | Uniform lighting (note only — tool does not design lighting) | Comparison-table column "limiting factor: sensor vs. lens"; telecentric mode disables WD-slider solver |

---

## 4. Prioritized website requirements (Must / Should / Cut)

### MUST (frontend + backend handoff)
1. **Requirement-first wizard → shortlist.** Inputs: target FOV (or object size + margin), WD or WD range, smallest feature → required mm/px (feature/10 heuristic, labeled as such), fps/motion, indoor/outdoor, interface preference, budget cap optional. Output: ranked sensor+lens pairings with pass/warn/fail. *Closes threads 3/5 gap; current tool has no entry path for this.*
2. **Real searchable catalog (seed ×20–50, JSON-bundled, no crawl).** Sensors: IMX264/267/178/392 (keep) + IMX250/IMX547/IMX545 + 2× onsemi PYTHON; lenses: keep 4 + Kowa/Fujinon/Edmund C-mount 8/16/25/35mm + M12 4/6/8mm set. Each entry: cited `sourceUrl` (follow seedData.ts pattern). Backend: extend extractor schema with `interface, shutterType, fps, MOD, distortion%, weightG, driverNote` — all nullable + `found` flags (existing `flag-don't-guess` rule, `requirements.md` §3.1).
3. **Solver + inverse display everywhere.** Keep `workingDistanceForFov` / `focalLengthForFov`; surface "what focal length do I need?" and "what WD for this FOV?" as first-class wizard outputs, not hidden utils.
4. **Compatibility v2:** keep image-circle + mount; ADD: shutter warning (rolling + motion), interface mismatch flag, MOD flag (WD < lens MOD → fail), telecentric incompatibility note. All as `optics.ts` pure functions with vitest reference values (follow existing 22-test pattern).
5. **Shareable comparison URL + JSON export/import** (keep existing export; add URL encoding of pairing IDs + WD so threads-3/5 style "is this combo OK?" becomes a link, not screenshots).

### SHOULD
6. UAV preset (altitude/GSD/overlap) and embedded preset (CSI/driver filter + M12-only toggle).
7. Distortion/MTF-lite: single `distortion%` + `rated lp/mm` columns; corner-softness note when margin <10% (existing `tight` threshold).
8. Extraction confidence UX (open question #1 in requirements.md): per-field blank+flag stays; add snippet provenance already planned in architecture.md.
9. Cost/availability *band* (e.g., $, $$, $$$) manually curated — full price feeds stay cut.

### CUT (explicitly, to stay sniper-scoped)
- Bulk catalog crawling, live vendor APIs, OCR/logged-wall PDFs (already out of scope, `requirements.md` §6 — reaffirmed).
- Depth-of-field/bokeh/aberration modeling, lighting designer, multi-user cloud accounts, purchase links (already cut; keep cut).
- Phone-first layout; desktop/tablet only (reaffirmed).
- Auto-CAD/photogrammetry flight planner — link out, don't build.

---

## 5. Assumptions × Evidence (every assumption paired)

1. **Assumption: beginners' core block is translating application need → FOV/mm-px → focal length, not comparing two known parts.** *Evidence:* request background states tool "lacks requirement-driven selection" and threads are "confused by lens/sensor matching"; repo `requirements.md` §2 job-to-be-done is comparison-only with no requirement input — the gap is structural, not cosmetic.
2. **Assumption: mount + image-circle checks are the highest-value compatibility logic.** *Evidence:* repo implements exactly these two in `optics.ts` (`checkImageCircle`, `checkMountCompatibility` incl. 5mm C/CS spacer rule) with dedicated tests; request background lists "mount/interface" as a named confusion — keep and extend, don't replace.
3. **Assumption: Sony IMX + Computar/Commonlands seed set is representative for v1 but too small for selection.** *Evidence:* `seedData.ts` header cites 8 public datasheets with URLs and `LEARNINGS.md` smoke-tested Sony IMX264 PDF + Commonlands HTML fetch→parse successfully; 8 parts cannot cover UAV/embedded/inspection ranges — hence Must #2.
4. **Assumption: thin-lens FOV + macro-risk buckets are sufficient for v2 (no full aberration model).** *Evidence:* `optics.ts` documents thresholds as judgment calls (`m<0.5` normal, `0.5–2` macro, `≥2` extreme, `WD≤f` invalid) and `LEARNINGS.md` flags them for revisit; `requirements.md` §6 explicitly cuts aberration/MTF modeling.
5. **Assumption: interface + shutter + driver support drive real purchase failure in embedded/CV.** *Evidence:* declared purposes for threads 2/4/5/6 name "how CV engineers select," "sensor plus lens for embedded," "choosing workflow," "machine vision advice" — all interface/driver-adjacent; repo `requirements.md` §6 admits live vendor/interface lookups were cut, so this dimension is currently unmodeled and must be added as static fields, not live APIs.
6. **Assumption: no thread-level verbatim evidence can be cited.** *Evidence:* all six `fusion_web_fetch` calls (markdown + text) returned only `Reddit — Prove your humanity` bot challenge / bare `Reddit` shell (HTTP 200, no content). Any brief claiming direct quotes would be fabrication; §1 above therefore scopes claims to titles/purposes + repo-verified facts. **Docs worker:** copy this limitation note into `docs/` so downstream citations don't overclaim.
7. **Assumption: local-first + single extract endpoint remains the right architecture.** *Evidence:* `architecture.md` + `LEARNINGS.md` verify localStorage, JSON export, and stateless extract (fetch→parse→LLM) with rate-limit smoke tests; nothing in the thread purposes contradicts it — requirement wizard and bigger seed JSON both run client-side, only new nullable fields flow through the existing endpoint.

**Docs worker note:** file this brief + fetch-failure log under `docs/`; frontend starts with Must #1/#3/#5, backend with Must #2/#4 schema extension. Success = user entering only application requirements reaches a ranked, flagged shortlist in <5 min, with every spec traceable to a cited datasheet URL.
