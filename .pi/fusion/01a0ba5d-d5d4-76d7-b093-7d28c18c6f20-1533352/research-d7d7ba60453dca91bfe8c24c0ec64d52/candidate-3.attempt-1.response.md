# FAE Brief: Machine-Vision Camera/Lens Selection Tool v2
**Handoff to: frontend / backend / `docs/` — sniper-scoped**

## 0. Evidence limitation (read first)

All 6 declared Reddit URLs were fetched (markdown + text). All returned only botwall / `Reddit` shell, no thread bodies:

- `r/UAVmapping/...1s5jcne` (Lens choice confusion) → `Reddit`
- `r/computervision/...16535jn` (How CV engineers select) → `Reddit`
- `r/computervision/...1jvyxn1` (Recommendation pattern) → `Reddit - Prove your humanity` botwall
- `r/embedded/...1gfrpvs` (Sensor+lens for embedded) → `Reddit`
- `r/computervision/...1un5dum` (Help choosing workflow) → `Reddit`
- `r/computervision/...aipr3n` (MV camera advice) → `Reddit`

**Therefore: no verbatim quotes or vote counts below.** Section 1 derives pain points from (a) thread titles + declared purposes (only surviving evidence), (b) `request.background` (beginners confused by lens/sensor matching, mount/interface, UAV/embedded/CV tradeoffs), (c) repo facts in `docs/requirements.md`, `docs/architecture.md`, `src/lib/seedData.ts`. Every inference is labeled. Do not treat Section 1 as thread quotations.

Repo facts re-derived via file tools:

- Current app: React 19 + three.js (`@react-three/fiber/drei`) SPA, 1–4 panels, sensor+lens+WD inputs, 3D FOV cone, `localStorage`, JSON export/import, 8 seed parts, one stateless Claude datasheet-extract endpoint (`api/extract-datasheet.ts` + `api/_lib/` + `scripts/dev-api.ts` local stand-in). Source: `package.json`, `docs/architecture.md`, `README.md`.
- Seed sensors: Sony IMX264 (2/3"), IMX178 (1/1.8"), IMX267 (1"), IMX392 (1/2.3"). Seed lenses: Computar V1226-MPZ (12mm, 1", C), Commonlands CIL532 (12mm, 2/3", C), CIL525 (25mm, 2/3", C), CIL060 (6mm, M12). Source: `src/lib/seedData.ts`.
- Already solved: thin-lens FOV `m=f/(WD-f)`, `FOV=sensor*(WD-f)/f`, image-circle vs. diagonal vignetting check, C/CS 5mm spacer check, mm/pixel + Nyquist vs. lens lp/mm, optical-format lookup. Explicitly out-of-scope in v1: catalog crawl, live vendor APIs, OCR/logged-walled PDFs, price/availability, distortion/MTF, DoF, cloud accounts. Source: `docs/requirements.md` §3–6.

## 1. Top pain points + current workarounds (per thread, inferred)

| # | Thread (purpose) | Inferred pain | Current workaround (inferred + repo-corroborated) |
|---|---|---|---|
| 1 | UAVmapping `1s5jcne` — Lens choice confusion for machine vision | Beginners don't know mapping: focal length ↔ altitude/WD ↔ GSD ↔ coverage. Ask for "what lens?" with no numbers. | Post ad-hoc specs, get conflicting rules-of-thumb. **Tool gap:** no requirement-driven solver ("I need X mm GSD at Y m altitude" → focal length + sensor). Current tool requires user to already know focal length (`docs/requirements.md` §3.3). |
| 2 | computervision `16535jn` — How CV engineers actually select | Pros select backwards from task (working distance, FOV, min feature px, fps, lighting, interface), beginners select forwards from parts ("is this camera good?"). | Pros answer with checklist interrogation (WD? FOV? light? budget? interface?). Beginners have no checklist. **Tool gap:** no guided requirement intake. |
| 3 | computervision `1jvyxn1` — Recommendation requests pattern | Low-context "recommend a camera" posts missing: target size, distance, speed, lighting, compute, budget. Unanswerable. | Commenters demand missing specs or guess. **Tool gap:** no structured request template / shareable requirement card + export (`persistence.ts` exports parts, not requirements). |
| 4 | embedded `1gfrpvs` — Sensor+lens for embedded | Extra constraints: MIPI CSI-2 vs USB3/GigE, driver/ISP support (RPi/Jetson), S/M12 mount + small formats, power/size/thermal, rolling vs global shutter. Pick sensor with no driver or lens with wrong mount. | Trial-and-error on vendor pages + Arducam/RPi forums. **Tool gap:** current model has mount but no interface/driver/shutter fields (`src/lib/types.ts` via `requirements.md` §4). |
| 5 | computervision `1un5dum` — Help choosing workflow | Hand-math from PDFs: optical format (`1/2.5"` ≠ mm), pixel pitch, image circle coverage, C vs CS flange. Easy to buy vignetting/mismatched pair. | Spreadsheet + datasheet digging; exactly what `requirements.md` §1 targets. Current tool already covers this core — keep and harden. |
| 6 | computervision `aipr3n` — MV camera advice patterns | Brand/interface maze: industrial cameras (Basler/FLIR/etc.) vs bare sensors vs USB webcams; global-shutter, trigger, lens resolving power overlooked. | "Buy Basler + Computar" defaults without math. **Tool gap:** seed set is 4+4 only; no curated starter kits per use-case, no shutter/trigger/interface flags. |

Cross-cutting: **lens/sensor matching, mount/interface, domain translation** — exactly `request.background`. Beginners speak photography terms; tool correctly uses MV vocabulary (C/CS/S-M12, WD, image circle, lp/mm) per `requirements.md` §2 — keep, but add plain-language tooltips.

## 2. Ecosystem: how sensor / lens / mount / interface fit

**Keep this mental model in UI copy + `docs/`:**

```
Scene (WD, FOV, light, motion) → LENS (focal, image circle, mount, aperture, lp/mm)
  → SENSOR/camera (size mm, res, pitch, shutter, interface, mount body) → COMPUTE (driver/ISP/SDK)
Compatibility = image_circle ≥ sensor_diagonal (+margin) AND mount_match (incl. C/CS 5mm spacer) AND interface_supported
Performance = FOV math + mm/pixel ≤ feature/(3–5px) + lens lp/mm ≥ sensor Nyquist + fps/exposure freezes motion
```

- **Sensor/chip vendors (evidence: `seedData.ts` + `requirements.md` §3.1):** Sony IMX (IMX264/267/392/178 in seed), ON Semi (named in requirements as typical). Chips have **no mount** — mount lives on camera body; repo already notes this modeling compromise (`seedData.ts` header). Keep field on sensor entry but label "typical body mount."
- **Industrial camera vendors (category, not repo-verified — needs curation):** Basler, FLIR/Teledyne, IDS, Hikrobot, Dahua, Allied Vision. They package chips + mount (C/CS) + interface (GigE/USB3) + SDK/trigger. Bare-module vendors (Arducam, Waveshare) package chips + MIPI CSI-2 + M12 for RPi/Jetson — critical for embedded thread #4.
- **Lens types to support:**
  - Fixed-focal C/CS-mount (Computar, Commonlands, Kowa, Fujinon — first two in seed) — default for MV/inspection.
  - M12/S-mount micro lenses (CIL060 in seed) — embedded/UAV light/compact.
  - Zoom (min/max focal — already in data model `requirements.md` §4, implement solver range).
  - Telecentric (inspection, constant mag — **cut for v2**, note as future).
  - UAV/photogrammetry lenses: low-distortion, global shutter pairing, gimbal mass limit — surface weight + distortion spec as optional fields, don't model.
- **Mount fit:** C (17.526mm flange) vs CS (12.526mm; C-lens on CS-body needs 5mm ring; CS-lens on C-body won't focus) — already implemented; keep. M12/S-mount for small formats — already in model; add filter. F/V-mount — cut.
- **Interface fit (missing — add as data fields, not live lookup):** USB3 Vision / GigE Vision / CameraLink (PC inspection), MIPI CSI-2 (embedded), GMSL/FPD-Link (UAV/automotive). Add `interface: USB3|GigE|MIPI|other`, `shutter: global|rolling`, `fps`, `trigger: bool`, `sdkSupport: string[]` to Sensor/Camera model. This unblocks threads #2/#4 with zero backend work.

## 3. Industry-specific priority properties

| Segment | #1 priority | What tool must surface |
|---|---|---|
| **UAV mapping** (thread 1) | GSD + coverage + weight | Inputs: altitude (=WD), required GSD, overlap. Outputs: mm/pixel, swath width, focal needed. Warn on rolling shutter + vibration. Weight field (cut solver, show spec). |
| **General CV / robotics** (threads 2,3,6) | "Will it see it at this distance, at speed, on my port?" | Requirement wizard: WD, target FOV or object size, min px per feature, fps, indoor/outdoor light, USB vs GigE vs MIPI, budget band. Solver proposes focal range across seed lenses. |
| **Embedded** (thread 4) | Driver + size + power | MIPI/ISP compat flag, M12 mount filter, resolution/fps vs compute, global-shutter filter for motion. Link-out to vendor driver page (no scraping). |
| **Inspection** (implied by MV vocab) | Repeatable mm/pixel + vignetting-free + trigger | mm/pixel vs feature rule (≥3–5 px), image-circle margin flag, Nyquist vs lens lp/mm limiter display (already specced §3.5), trigger/global-shutter flag, WD-sensitivity warning (already specced §3.3). |

## 4. Prioritized website requirements (sniper-scoped)

**MUST (frontend + docs, ~1 sprint each; no new infra):**
1. **Requirement wizard → solver.** Inputs: WD, target H-FOV (or object width), min feature size, lighting/motion class. Outputs: required focal range + ranked seed pairings (pass/warn/fail) reusing `optics.ts`. Closes threads #1–3. Frontend only.
2. **Interface/shutter/trigger fields + filters.** Extend `types.ts`, `SensorForm`, `ComparisonTable`, seed entries. Closes thread #4. Frontend + seed curation.
3. **Shareable requirement card.** `Export requirements + pairings JSON` + copy-paste markdown template ("WD/FOV/feature/fps/interface/budget") so "recommend me a camera" posts become answerable. Extends existing export. Frontend.
4. **Seed expansion to 12+12 with use-case tags** (`uav`, `embedded-mipi`, `inspection-usb/gige`): add 2 MIPI modules (e.g. IMX477-class + Arducam-class), 2 global-shutter (e.g. IMX392 already + 1 more), common 6/8/16/25mm C + M12 options. Hand-curated, cited URLs like current seed. No crawler. Frontend/docs.
5. **Plain-language mount/coverage explainer inline** (C/CS spacer, image-circle vignetting, optical-format ≠ inches). Already computed; add one-paragraph callouts + diagram labels. Frontend/docs.

**SHOULD (if capacity):**
6. Requirement-preset buttons: "UAV 50m GSD 1cm", "Bench inspection 300mm", "RPi door cam 2m".
7. Sortable comparison table by mm/pixel, FOV match error, vignetting margin.
8. Datasheet-extract: add new fields (interface/shutter/fps) to Claude schema in `api/_lib/callExtractionModel.ts`; keep flag-don't-guess.
9. Distortion/weight optional lens fields (display-only, UAV relevance).

**CUT (explicitly, keep `requirements.md` §6 + add):**
- Catalog crawl, live vendor APIs, price/availability, OCR/login-walled PDFs, accounts/cloud, DoF/bokeh, distortion/MTF modeling, telecentric solver, auto driver-compat DB. Rationale: stateless single-function backend + localStorage architecture (`architecture.md`) cannot support them without new infra; threads ask for judgment, not live pricing.

## 5. Assumptions × evidence

1. **Assumption:** Users arrive with task numbers missing, not part numbers. **Evidence:** purposes of threads #2/#3 ("how engineers select", "recommendation requests pattern") + `request.background` ("lacks requirement-driven selection"); repo assumes user already has 2–4 candidates (`requirements.md` §2) — mismatch to fix via wizard.
2. **Assumption:** Lens/sensor mount + image-circle confusion is the top beginner error. **Evidence:** purpose #1 ("lens choice confusion") + #4 ("sensor plus lens") + repo devotes §3.4 to exactly these checks + seed lens names encode format (`2/3"`, `1"`, `M12`) in `seedData.ts`.
3. **Assumption:** Interface (MIPI vs USB3/GigE) decides embedded picks more than optics. **Evidence:** purpose #4 + current model has no interface field (`requirements.md` §4) — gap, not guess.
4. **Assumption:** Industrial-camera brands matter for advice but a curated seed beats a catalog. **Evidence:** purpose #6 ("machine vision camera advice patterns") + `requirements.md` §6/§8 (small hand-picked seed, no bulk crawl) — expand to 12+12, don't build search.
5. **Assumption:** Thin-lens math + 3D cone is the differentiator to keep. **Evidence:** `requirements.md` §3.3/§9 (thin-lens formula, unit-tested) + `request.background` (3D FOV already exists) — threads show users fail at exactly this math; keep and front with solver.
6. **Assumption:** Fetched-page vacuum = Reddit botwall, not wrong URLs. **Evidence:** all 6 fetches HTTP 200 but body `Reddit` / `Prove your humanity` challenge (fetcher transcripts above). Re-fetch via text extraction on same canonical URL also returned `Reddit`. Mitigation: re-run synthesis with authenticated Reddit API or manual thread capture before quoting users in `docs/`.

**Direct handoff:** frontend implements M1/M3/M5 + M2 form fields; backend extends extract schema (M8) only; docs adds `docs/fae-brief.md` (this file) + `docs/seed-curation.md` (M4 source list) + requirement-card template (M3). No arch change: static SPA + one stateless function + localStorage stands.
