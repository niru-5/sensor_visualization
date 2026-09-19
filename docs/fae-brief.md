# FAE Brief — Camera & Lens Selection Tool

> Companion to `docs/requirements.md`, `docs/architecture.md`, `docs/LEARNINGS.md`.
> Audience: Field Application Engineer (FAE) / integrator scoping an industrial vision system.
> Goal: what hurts in the field, where this tool fits, what it must do vs. cut.

## 0. Research limitation note

- **Reddit bot-walled:** attempted r/machinevision / related threads for voice-of-customer pains were blocked by login/bot-wall — no Reddit quotes included. Pains below are synthesized from vendor docs, selector tools, and integrator guides instead.
- **2× Commonlands 404:** two Commonlands reference URLs (lens product pages probed during extraction smoke-tests, see `docs/LEARNINGS.md`) now return 404, so they are **not** cited as evidence. All evidence URLs below were live at time of writing.
- No `src/` changes were made for this brief — docs only.

## 1. Pains (P1–P7)

Ranked by how often they kill or delay a vision project at the FAE stage.

| ID | Pain | What the FAE hears | Tool implication |
|----|------|--------------------|------------------|
| **P1** | Datasheet math by hand | "I have 3 sensors and 4 lenses — which combo gives me 200 mm FOV at 500 mm WD?" | Thin-lens FOV solver + visual compare is the core job (req §3.3, §3.6). |
| **P2** | Lens/sensor mismatch discovered late | Vignetting (image circle < sensor diagonal), C vs CS flange 5 mm spacer missed, M12 vs C mount | Pass/fail/warning compatibility check per pairing (req §3.4). |
| **P3** | Resolution insufficient for smallest feature | 1–2 px per defect → missed defects; no mm/pixel or Nyquist check | mm/pixel + Nyquist vs lens lp/mm comparison (req §3.5). Rule of thumb: 3–5 px per smallest feature. |
| **P4** | Wrong shutter / interface for motion & bandwidth | Rolling shutter smear on conveyor; USB3 cable too short; GigE bandwidth underestimated | Scorecard fields (shutter, fps, interface/bandwidth) even if v1 only computes resolution/FOV. |
| **P5** | Lighting as afterthought | Great sensor + poor lens/lighting = failed project | Tool should prompt for lighting/WD context; not model lighting in v1 (explicit non-goal). |
| **P6** | No seed / empty-state problem | "Your selector has no parts — I leave" | Hand-curated seed dataset of Sony IMX / ON Semi sensors + common lenses (req §3.1). |
| **P7** | Extraction distrust | "AI filled fields I can't verify" | Flag-don't-guess import: blank + flagged, editable pre-filled form, confirm-before-save (req §3.1). |

## 2. Fit chain — where this tool sits

```
Imaging task → Requirements → Shortlist → Validate
     (1)            (2)           (3)         (4)
```

1. **Define task:** smallest feature, speed, lighting, WD/FOV envelope.
2. **Derive requirements:** FOV from sensor + f + WD; mm/pixel; shutter; fps ≥ line-speed/FOV; bandwidth = res × depth × fps.
3. **Shortlist & compare (THIS TOOL):** multi-lens vs one sensor table, to-scale sensor overlay, 3D FOV cone, compatibility flags, exportable JSON set.
4. **Validate in the real world:** eval units from 2–3 vendors, test under real light/temp/vibration, confirm GenICam/SDK + lifecycle.

The tool owns step 3 only. It does **not** replace lighting design, eval-unit testing, or lifecycle/TCO analysis — it shortens step 3 from "spreadsheet + datasheet PDFs" to "see the difference."

Vendor selectors (e.g. Basler Lens Selector) only cover their own catalog; this tool is vendor-neutral and comparison-first.

## 3. Companies / ecosystem to watch

| Company | Why relevant | Role in workflow |
|---------|--------------|------------------|
| **Basler** | Reference lens-selector UX; large industrial + embedded portfolio | UX benchmark; seed-data source pattern |
| **FLIR / Teledyne** | Machine-vision cameras, thermal, short-wave | Comparison candidates |
| **LUCID Vision Labs** | Triton — low-light pick in Roboflow guide | Low-light alternative |
| **Sony / onsemi** | IMX / PYTHON sensor families behind most industrial cameras | Seed sensors (sensor > camera) |
| **Roboflow** | Integrator-friendly camera/lens guides | Requirements language source |
| **NVIDIA (Jetson)** | Embedded deployment target (Orin Nano etc.) | Downstream fit: MIPI/GMSL/GigE choice |

> Note: sensor determines most image quality — two cameras with the same sensor differ mainly on firmware/interface/support. Match lens MTF to sensor; design lighting first.

## 4. Industry table — what changes per vertical

| Industry | Priority specs | Typical trap | Tool focus |
|----------|---------------|--------------|------------|
| **Manufacturing / inspection** | 3–5 px per defect; global shutter; HW trigger; GigE/Camera Link | Rolling shutter on moving web; insufficient mm/pixel | mm/pixel, fps vs line speed, trigger note |
| **Medical / microscopy** | QE, read noise, dark current, 12–16 bit, cooling | Uncooled long exposures; poor uniformity | Nyquist/lp/mm, bit-depth field |
| **Mining / heavy industry** | IP67, −30…+70 °C, vibration, NIR, ATEX | Consumer lifecycle; dust ingress | Environmental rating fields (display, not computed) |
| **Logistics / warehouse** | Global shutter, low latency, multi-cam sync, WDR | Motion blur; dock-door glare | Latency/sync checklist columns |
| **Traffic / ANPR** | NIR, fast shutter, 120+ dB WDR, IP66/IK10 | Headlight glare; night lux | WDR / min-illumination fields |
| **Embedded / edge AI** | MIPI/CSI-2 vs USB3/GigE, Jetson support, size/power | USB prototype → production interface mismatch | Interface + cable-length guidance |

## 5. MUST / SHOULD / CUT (v1)

### MUST
- **M1** — Thin-lens FOV solver (any-1-of-4: sensor, f, WD, FOV) with unit tests vs hand calcs.
- **M2** — To-scale sensor overlay (mm + optical-format lookup).
- **M3** — Image-circle vs diagonal + mount check (incl. C/CS 5 mm spacer) with pass/tight/fail.
- **M4** — mm/pixel + Nyquist vs lens lp/mm limiting-factor display.
- **M5** — 1-sensor × N-lens comparison table (FOV, flags, resolution in one view).
- **M6** — Flag-don't-guess datasheet import (per-field found flag, confirm-before-save) + manual fallback + localStorage + JSON export/import.
- **M7** — Uncertainty cue near WD ≈ f (faded/dashed cone + plain-language warning), never hard-block.

### SHOULD
- **S1** — Seed dataset citations (source + sourceUrl per entry).
- **S2** — Shutter / fps / interface / bandwidth helper columns (even if advisory, covers P4).
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

## 6. Assumptions + evidence

| # | Assumption | Evidence |
|---|------------|----------|
| A1 | FAEs start from FOV + WD → focal length; a lens-selector UX is the expected pattern | Basler Lens Selector / Lens Advisor — filter by focal length, working distance, object size: https://www.baslerweb.com/en/tools/lens-selector/ |
| A2 | Camera choice is driven by feature-size → resolution, shutter, interface, and lens match — not megapixels alone | Roboflow — Best Cameras for Computer Vision (Basler ace2 / LUCID Triton picks + spec checklist): https://blog.roboflow.com/best-cameras-for-computer-vision/ ; Lens guide: https://blog.roboflow.com/how-to-choose-a-lens-for-machine-vision/ |
| A3 | Embedded path (Jetson / NXP / GMSL) constrains interface + form factor early | Basler Embedded Vision portfolio (Jetson Orin, NXP i.MX 8, GMSL): https://www.baslerweb.com/en/portfolios/embedded-vision/nvidia/ ; https://www.baslerweb.com/en-us/portfolios/embedded-vision/ |
| A4 | Prototype→production interface mismatch (USB ok for proto, MIPI/GigE for production) is a top integration failure | dev.to — Multi-Camera AI Vision Pipeline on Jetson Orin Nano (where USB/MIPI/Ethernet breaks): https://dev.to/lily_li_fc6c372b8805f9017/building-a-multi-camera-ai-vision-pipeline-on-jetson-orin-nano-and-where-it-actually-breaks-3143 ; Camera-module design: https://dev.to/siliconsignals_ind/how-to-choose-camera-module-design-for-embedded-5c2l |
| A5 | Thin-lens (not far-field) FOV math matters at close machine-vision WDs | Basler docs — Angle of View Calculation in the Lens Selector: https://docs.baslerweb.com/knowledge/angle-of-view-calculation-in-the-basler-lens-selector ; implemented as `m = f/(WD−f)`, `FOV = sensor×(WD−f)/f` in `src/lib/optics.ts` |
| A6 | 3–5 px per defect minimum; global shutter if motion > 1 px per exposure | Standard FAE rule, cf. Roboflow manufacturing guide: https://roboflow.com/reports/machine-vision-cameras |

## 7. Open questions for FAE review

1. Which 6–10 seed sensors/lenses cover 80% of intro FAE calls?
2. Exact "tight / macro / extreme-macro" thresholds (current: 10% image-circle margin; mag 0.5 / 2.0) — calibrate against a real case?
3. Minimum shutter/interface fields needed to prevent P4 without bloating v1?
