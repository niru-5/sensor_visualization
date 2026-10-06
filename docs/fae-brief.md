# FAE Brief — Camera & Lens Selection Tool

> Companion to `docs/requirements.md`, `docs/architecture.md`, `docs/LEARNINGS.md`.
> Audience: Field Application Engineer (FAE) / integrator scoping an industrial vision system.
> Goal: what hurts in the field, where this tool fits, what it must do vs. cut.

## 0. Research method note (2026-09-22 re-research)

- This brief was **re-researched with live web searches** (new project skill `.pi/skills/web-research/SKILL.md`,
  Firecrawl `web-agent` deep-research pattern mapped to pi tools: `web_search` → `web_fetch`/`fetch_content` → `browser_*` last resort).
- **Angles searched:** lens-selector calculators (any-2-of-3 FOV pattern); Basler angle-of-view docs; C/CS mount + vignetting;
  global vs rolling shutter; Basler camera-selection guide; Roboflow camera + lens guides.
- **Pages actually opened and cited:** Roboflow camera guide, Roboflow lens guide, Basler lens selector page (static text only —
  JS SPA), Basler angle-of-view knowledge article, JAI shutter blog, Basler camera-selection guide. Every evidence URL below
  returned HTTP 200 with relevant content at time of writing.
- **Dead ends, stated plainly:**
  - Exa search backend hit 429 rate limits mid-pass — several angles (C-mount specifics, pixels-per-defect rule, Sony IMX seed list,
    GigE/USB3/MIPI cable-length queries) returned errors instead of results. Those claims below are marked carried-over/medium-confidence, not fresh evidence.
  - Google Custom Search credentials are not configured in this repo, so `google_search` was unavailable as a fallback.
  - Reddit (`r/machinevision`) was **not** probed this pass (known login/bot-wall; prior draft already excluded it). No forum quotes are included anywhere — none fabricated.
  - The prior draft's "2× Commonlands 404" note could **not** be re-verified (no live Commonlands URLs were probed this pass) and is **dropped** rather than re-asserted. `docs/LEARNINGS.md` records the original extraction smoke test (Sony IMX264 PDF + a Commonlands lens page reaching the model-call step); that history is unchanged.
  - Interface cable-length figures **CONFIRMED 2026-09-22**: USB3 passive ≤5 m standard (≤8 m premium twinax) per Basler USB 3.0 guide (https://www.baslerweb.com/en-us/learning/data-transmission-usb-3-0/) + Basler data-cables docs (https://docs.baslerweb.com/data-cables); GigE ≤100 m Cat5e+ per IEEE 802.3ab (https://en.wikipedia.org/wiki/Gigabit_Ethernet + https://en.wikipedia.org/wiki/Category_5_cable). Suggested UI copy: 'USB3 passive ≤5m (≤8m premium twinax); GigE ≤100m Cat5e+'. Bandwidth numbers remain carried-over.
- No `src/` changes were made for this brief — docs only.

## 1. Pains (P1–P7)

Ranked by how often they kill or delay a vision project at the FAE stage.

| ID | Pain | What the FAE hears | Tool implication | Evidence / confidence |
|----|------|--------------------|------------------|-----------------------|
| **P1** | Datasheet math by hand | "I have 3 sensors and 4 lenses — which combo gives me 200 mm FOV at 500 mm WD?" | Thin-lens FOV solver + visual compare is the core job (req §3.3, §3.6). | **High.** Five independent selector tools (Teledyne, Cognex Lens Advisor, Edmund wizard, Schneider-Kreuznach, Kowa) all implement the same any-2-of-3 pattern (WD / FOV / focal length → compute the rest); Roboflow's lens guide walks the same WD+FOV→focal-length flow twice with worked numbers. |
| **P2** | Lens/sensor mismatch discovered late | Vignetting (image circle < sensor diagonal), C vs CS flange 5 mm spacer missed, M12 vs C mount | Pass/fail/warning compatibility check per pairing (req §3.4). | **High.** Roboflow lens guide: C-mount flange 17.526 mm vs CS-mount 12.526 mm (5 mm shorter); image-circle < sensor ⇒ corner vignetting; "choose a lens designed for the same or larger sensor size"; mount-check-first workflow. |
| **P3** | Resolution insufficient for smallest feature | 1–2 px per defect → missed defects; no mm/pixel or Nyquist check | mm/pixel + Nyquist vs lens lp/mm comparison (req §3.5). | **Medium.** Basler gives the shape formally (Resolution = Object Size / Detail Size, e.g. 2000 mm / 1 mm ⇒ 2000 px/axis ≈ 4 MP); Roboflow: "determine the minimum resolution based on the smallest object feature." The exact "3–5 px per defect" number is standard FAE rule-of-thumb — corroborated in shape, single-sourced as a number. JAI adds the lens side: smaller pixel pitch demands more expensive optics to hold MTF/contrast. |
| **P4** | Wrong shutter / interface for motion & bandwidth | Rolling shutter smear on conveyor; USB3 cable too short; GigE bandwidth underestimated | Scorecard fields (shutter, fps, interface/bandwidth) even if v1 only computes resolution/FOV. | **High (shutter) / CONFIRMED 2026-09-22 (cable lengths).** JAI: rolling = staggered line-by-line exposure ⇒ skew + spatial aliasing on moving targets; global recommended for continuous motion, rolling acceptable for stop-and-go; shape/size-critical apps (metrology, barcode) must not use rolling. Basler: frame-rate range 10–340 fps area-scan; GigE Vision / USB3 Vision / CoaXPress as the modern standards + GenICam. Cable lengths CONFIRMED: USB3 passive ≤5 m (≤8 m premium twinax) per https://www.baslerweb.com/en-us/learning/data-transmission-usb-3-0/ + https://docs.baslerweb.com/data-cables; GigE ≤100 m Cat5e+ per https://en.wikipedia.org/wiki/Gigabit_Ethernet + https://en.wikipedia.org/wiki/Category_5_cable. Suggested UI copy: 'USB3 passive ≤5m (≤8m premium twinax); GigE ≤100m Cat5e+'. |
| **P5** | Lighting as afterthought | Great sensor + poor lens/lighting = failed project | Tool should prompt for lighting/WD context; not model lighting in v1 (explicit non-goal). | **Medium.** Roboflow lens guide: aperture ↔ depth-of-field ↔ lighting trade-off (smaller apertures need brighter illumination/longer exposure); Basler: large pixels (3.5 µm+) + good SNR matter because light is the signal. No source claims lighting is *the* top failure cause — kept as practitioner consensus, non-goal unchanged. |
| **P6** | No seed / empty-state problem | "Your selector has no parts — I leave" | Hand-curated seed dataset of Sony IMX / ON Semi sensors + common lenses (req §3.1). | **Medium (process) / low (exact list).** Roboflow's top-3 picks (Basler ace2 Basic 2 MP/160 fps general, ace2 Pro 5 MP/60 fps detail, LUCID Triton low-light) give a credible starter shape, and the Exa outage blocked the dedicated Sony IMX/onsemi seed-list angle — the exact 6–10 seed parts remain open question #1. |
| **P7** | Extraction distrust | "AI filled fields I can't verify" | Flag-don't-guess import: blank + flagged, editable pre-filled form, confirm-before-save (req §3.1). | **Process requirement** (derives from requirements §3.1 + LEARNINGS E2E: OV5640 run correctly abstained on mount/interface/trigger). No web source needed; unchanged. |

## 2. Fit chain — where this tool sits

```
Imaging task → Requirements → Shortlist → Validate
     (1)            (2)           (3)         (4)
```

1. **Define task:** smallest feature, speed, lighting, WD/FOV envelope. (Basler: "What do I need to see? What characteristics must the camera deliver?" + area/line/3D + mono/color decisions.)
2. **Derive requirements:** FOV from sensor + f + WD; mm/pixel; shutter; fps ≥ line-speed/FOV; bandwidth = res × depth × fps. (Basler resolution formula; JAI shutter rule; Roboflow spec checklist: resolution, fps, sensor size, lens compatibility, dynamic range, shutter.)
3. **Shortlist & compare (THIS TOOL):** multi-lens vs one sensor table, to-scale sensor overlay, 3D FOV cone, compatibility flags, exportable JSON set.
4. **Validate in the real world:** eval units from 2–3 vendors, test under real light/temp/vibration, confirm GenICam/SDK + lifecycle. (Basler: same sensor ≠ same camera — compare EMVA 1288 data, firmware/frame-buffer data stability, GenICam compliance, and always test a sample unit application-side.)

The tool owns step 3 only. It does **not** replace lighting design, eval-unit testing, or lifecycle/TCO analysis — it shortens step 3 from "spreadsheet + datasheet PDFs" to "see the difference."

Vendor selectors only cover their own catalog (Basler's is Basler-camera-specific; Edmund's wizard is the closest vendor-neutral UX and Roboflow's guide explicitly recommends it) — this tool is vendor-neutral and comparison-first.

## 3. Companies / ecosystem to watch

| Company | Why relevant | Role in workflow | Source |
|---------|--------------|------------------|--------|
| **Basler** | Reference lens-selector UX; camera-selection guide; ace 2 / dart / boost portfolio | UX benchmark; requirements language; seed-data pattern | Lens selector page; camera-selection guide; angle-of-view docs |
| **Edmund Optics** | Vendor-neutral Imaging Lens Wizard (camera model → auto sensor data → WD+FOV → lenses) | Closest UX reference for vendor-neutral flow; worked scenarios (8 mm @ 1/2.3" for 1219 mm FOV @ 1524 mm WD) | Roboflow lens guide §§ Choosing-with-a-tool, Scenarios 1–2 |
| **Teledyne / Cognex / Schneider-Kreuznach / Kowa** | Independent FOV calculators confirming the any-2-of-3 pattern | Corroboration that P1's solver is the expected primitive | web_search round 1 (all live at query time) |
| **FLIR / Teledyne** | Machine-vision cameras, thermal, short-wave | Comparison candidates | Note: https://www.flir.com/products/machine-vision/ 404s — FLIR machine vision now under Teledyne; use https://www.teledynevisionsolutions.com/ + https://www.teledynedalsa.com/en/products/imaging/cameras/ |
| **LUCID Vision Labs** | Triton — Roboflow's low-light pick (12.3 MP, 9 fps, GigE, IP-rated) | Low-light alternative; seed-data candidate | Roboflow camera guide + LUCID/Roboflow page |
| **Sony / onsemi** | IMX / PYTHON sensor families behind most industrial cameras | Seed sensors (sensor > camera) | Basler docs example uses IMX540 (a2A-5328); dedicated seed-list angle blocked by 429 — see open Q1 |
| **JAI** | Go-X shutter blog: clearest practitioner statement of global-vs-rolling + pixel-pitch/MTF cost trade | Shutter-rule evidence (P4) | JAI shutter blog |
| **Roboflow** | Integrator-friendly camera + lens guides with worked selections | Requirements language source; scenario evidence | Camera guide; lens guide; Cameras PDF report |
| **NVIDIA (Jetson)** | Embedded deployment target (Orin Nano etc.) | Downstream fit: MIPI/GMSL/GigE choice | Confirmed 2026-09-22: https://www.nvidia.com/en-us/autonomous-machines/embedded-systems/jetson-orin/ |

> Note: sensor determines most image quality — two cameras with the same sensor differ mainly on firmware/interface/support. (Basler: EMVA 1288 comparison + firmware/frame-buffer stability + GenICam compliance as the differentiators.) Match lens MTF to sensor (JAI: small pixels need costlier optics to hold contrast); design lighting first (Roboflow aperture/DOF/lighting trade-off).

## 4. Industry table — what changes per vertical

Synthesis from the Basler selection guide (area/line/3D, mono/color, shutter, resolution formula, interface, EMVA 1288),
the JAI shutter blog, and the Roboflow guides. **Medium confidence** as a table — each cell's primitive is sourced, but the
per-vertical packaging is FAE synthesis, not a single source.

| Industry | Priority specs | Typical trap | Tool focus |
|----------|---------------|--------------|------------|
| **Manufacturing / inspection** | Detail-driven resolution (Object/Detail formula); global shutter for continuous motion; HW trigger; GigE/Camera Link | Rolling shutter skew on moving web (JAI: unacceptable for metrology/barcode); insufficient mm/pixel | mm/pixel, fps vs line speed, trigger note |
| **Medical / microscopy** | QE, read noise, dark current, 12–16 bit, cooling | Uncooled long exposures; poor uniformity | Nyquist/lp/mm, bit-depth field |
| **Mining / heavy industry** | IP67, −30…+70 °C, vibration, NIR, ATEX | Consumer lifecycle; dust ingress | Environmental rating fields (display, not computed) |
| **Logistics / warehouse** | Global shutter, low latency, multi-cam sync, WDR | Motion blur; dock-door glare | Latency/sync checklist columns |
| **Traffic / ANPR** | NIR, fast shutter, 120+ dB WDR, IP66/IK10 | Headlight glare; night lux | WDR / min-illumination fields |
| **Embedded / edge AI** | MIPI/CSI-2 vs USB3/GigE, Jetson support, size/power | USB prototype → production interface mismatch | Interface + cable-length guidance (CONFIRMED 2026-09-22 — suggested UI copy: 'USB3 passive ≤5m (≤8m premium twinax); GigE ≤100m Cat5e+'; USB3 per https://www.baslerweb.com/en-us/learning/data-transmission-usb-3-0/ + https://docs.baslerweb.com/data-cables, GigE per https://en.wikipedia.org/wiki/Gigabit_Ethernet + https://en.wikipedia.org/wiki/Category_5_cable) |

## 5. MUST / SHOULD / CUT (v1)

Unchanged (derives from requirements, not from the web) — annotated with fresh evidence where it strengthens the case.

### MUST
- **M1** — Thin-lens FOV solver (any-1-of-4: sensor, f, WD, FOV) with unit tests vs hand calcs. *Strengthened: five independent vendor calculators + Basler Method-2 docs converge on the same primitive.*
- **M2** — To-scale sensor overlay (mm + optical-format lookup).
- **M3** — Image-circle vs diagonal + mount check (incl. C/CS 5 mm spacer) with pass/tight/fail. *Strengthened: exact flange figures (17.526 / 12.526 mm) + vignetting rule now sourced.*
- **M4** — mm/pixel + Nyquist vs lens lp/mm limiting-factor display. *Strengthened in shape (Basler formula + JAI pixel-pitch/MTF note); exact 3–5 px threshold stays a judgment call (LEARNINGS-style default, open Q2).*
- **M5** — 1-sensor × N-lens comparison table (FOV, flags, resolution in one view).
- **M6** — Flag-don't-guess datasheet import (per-field found flag, confirm-before-save) + manual fallback + localStorage + JSON export/import. *Validated live (OV5640 E2E abstentions, LEARNINGS).*
- **M7** — Uncertainty cue near WD ≈ f (faded/dashed cone + plain-language warning), never hard-block.

### SHOULD
- **S1** — Seed dataset citations (source + sourceUrl per entry).
- **S2** — Shutter / fps / interface / bandwidth helper columns (even if advisory, covers P4). *Shutter rule now JAI-sourced; bandwidth/cable figures still need verification.*
- **S3** — Extraction cache-by-URL + rate-limit messaging.
- **S4** — Code-split three.js bundle (currently ~1.14 MB warning).
- **S5** — Tablet-responsive layout; phone explicitly deprioritized.

### CUT (v1 non-goals, per requirements §6)
- **C1** — Catalog crawling / live vendor API lookups.
- **C2** — OCR of scanned PDFs / login-walled datasheets.
- **C3** — Price/availability/purchase links.
- **C4** — DOF/bokeh, distortion/MTF curves beyond single lp/mm number.
- **C5** — Cloud accounts / multi-user sharing.
- **C6** — Lighting designer / exposure simulator.

## 6. Assumptions + evidence (all URLs live at time of writing, 2026-09-22)

| # | Assumption | Evidence |
|---|------------|----------|
| A1 | FAEs start from FOV + WD → focal length; a lens-selector UX is the expected pattern | Basler Lens Selector (filter by camera/sensor; note MOD not considered): https://www.baslerweb.com/en/tools/lens-selector/ · Cognex Lens Advisor ("enter WD, focal length, or FOV — tool calculates the rest"): https://www.cognex.com/en/tools-and-resources/lens-advisor · Edmund Imaging Lens Wizard + Schneider-Kreuznach + Kowa + Teledyne calculators (any-2-of-3 pattern, via search round 1) |
| A2 | Camera choice is driven by feature-size → resolution, shutter, interface, and lens match — not megapixels alone | Roboflow camera guide (ace2 Basic 2 MP/160 fps general pick; ace2 Pro 5 MP detail pick; Triton low-light pick + resolution/fps/sensor/lens-compat/DR/shutter checklist): https://blog.roboflow.com/best-cameras-for-computer-vision/ · Lens guide (mount, image circle, WD/FOV, aperture/DOF + two worked scenarios): https://blog.roboflow.com/how-to-choose-a-lens-for-machine-vision/ · Basler selection guide (area/line/3D, mono/color, shutter, resolution formula, EMVA 1288, GenICam): https://www.baslerweb.com/en-us/learning/camera-selection/ |
| A3 | Embedded path (Jetson / NXP / GMSL) constrains interface + form factor early | Basler embedded vision cameras portfolio (note: old www.baslerweb.com embedded URL is bot-walled — use docs URL): https://docs.baslerweb.com/embedded-vision-cameras · NVIDIA Jetson Orin for MIPI CSI-2 constraint: https://www.nvidia.com/en-us/autonomous-machines/embedded-systems/jetson-orin/ · GMSL-via-deserializer remains medium-confidence (plausible, not freshly verified). |
| A4 | Prototype→production interface mismatch (USB ok for proto, MIPI/GigE for production) is a top integration failure | **Downgraded to practitioner consensus.** Roboflow ("GigE: high data rates + long cable lengths for industrial; USB: plug-and-play for desktop/simple setups") supports the USB-proto vs GigE-industrial shape: https://blog.roboflow.com/best-cameras-for-computer-vision/ · Basler camera-selection page (https://www.baslerweb.com/en-us/learning/camera-selection/) is bot-walled, so the 'top' superlative stays out — do not quote it as fact. |
| A5 | Thin-lens (not far-field) FOV math matters at close machine-vision WDs | Basler docs — Angle of View Calculation in the Lens Selector (Method 2: focal length + sensor size; IMX540 + 25 mm worked example; WD 710 mm ⇒ 400 × 345 mm view; notes Method 1 vs 2 differ slightly): https://docs.baslerweb.com/knowledge/angle-of-view-calculation-in-the-basler-lens-selector · Implemented as `m = f/(WD−f)`, `FOV = sensor×(WD−f)/f` in `src/lib/optics.ts` |
| A6 | Resolution from feature size; global shutter if continuous motion | Basler (Resolution = Object Size / Detail Size; shutter technique must suit the application; 10–340 fps area-scan): https://www.baslerweb.com/en-us/learning/camera-selection/ · JAI (global = simultaneous exposure; rolling = staggered ⇒ skew/spatial aliasing; continuous-motion ⇒ global, stop-and-go ⇒ rolling OK; small-pixel ⇒ pricier optics for same MTF): https://news.jai.com/blog/global-shutter-vs-rolling-shutter · Roboflow camera guide (global captures whole frame at once; rolling scans top-to-bottom ⇒ distortion on fast scenes): https://blog.roboflow.com/best-cameras-for-computer-vision/ |
| A7 | Mount + image-circle compatibility is a checkable, high-value rule | Roboflow lens guide (C 17.526 mm / CS 12.526 mm; vignetting when image circle < sensor; "same or larger sensor size" rule; larger-format lens uses the sweet spot): https://blog.roboflow.com/how-to-choose-a-lens-for-machine-vision/ |

## 7. Open questions for FAE review

1. Which 6–10 seed sensors/lenses cover 80% of intro FAE calls? (Starter shape from this pass: Basler ace2 Basic class 2 MP/global-shutter workhorse, ace2 Pro class 5 MP detail, Triton-class low-light — exact sensor/lens SKUs still to pin; dedicated seed-list search was 429-blocked.)
2. Exact "tight / macro / extreme-macro" thresholds (current: 10% image-circle margin; mag 0.5 / 2.0) — calibrate against a real case? (Unchanged; see LEARNINGS judgment calls.)
3. Minimum shutter/interface fields needed to prevent P4 without bloating v1? (JAI gives the shutter rule; interface side still needs cable-length/bandwidth verification.)
4. Re-verify A3/A4 embedded + interface-failure URLs (or replace with fetchable equivalents) before citing them anywhere customer-facing.
