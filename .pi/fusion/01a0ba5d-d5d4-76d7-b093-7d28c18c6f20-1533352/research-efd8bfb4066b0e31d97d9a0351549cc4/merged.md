# FAE Brief — Sniper-Scoped Camera Selection Website (docs/ handoff)

**Repo-verified baseline:** React + three.js comparator (1-4 panels), sensor+lens+WD inputs, 3D FOV cone, `src/lib/optics.ts` thin-lens funcs, `src/lib/seedData.ts` 4 sensors + 4 lenses, `src/store/persistence.ts` localStorage, single stateless datasheet endpoint `api/extract-datasheet.ts`. It answers "are these compatible?" not "what should I buy?" per `docs/requirements.md` and `docs/LEARNINGS.md`.

**Evidence rule: cite only fetched pages.** 4 of 6 declared open-web URLs fetched OK and are the only citations below. Excluded as evidence:

- 6 Reddit threads: bot-walled (HTTP 200 body = bot challenge) — no verbatim quotes, no Reddit-sourced claims.
- `commonlands.com/blogs/technical/sensor-size-lens-compatibility` → HTTP 404
- `commonlands.com/blogs/technical/drone-mapping-photogrammetry-lenses` → HTTP 404

Open-web vendor/technical guides are proxy evidence only for the same pains.

## 1. Pains + workarounds + sniper delta

| # | Pain | Workaround today (per fetched guides) | What sniper changes |
|---|------|--------------------------------------|---------------------|
| P1 | Mount-first confusion: wrong mount = won't attach / won't focus | Check camera datasheet for mount first; standardize on one mount; use adapters only when necessary | Enforce mount as Body property, gate first |
| P2 | Image-circle < sensor diagonal → vignetting; inch-labels (`1/2"`) mistaken for mm | Compare lens "Maximum image circle" (mm) vs sensor diagonal (mm); choose same-or-larger format | mm-vs-mm gate, never inch-label matching |
| P3 | FOV/WD/f triangle solved by hand, then f isn't stock | Hand-compute f from sensor width + object width + WD, or use vendor selector tools; stock fixed focals 4/6/8/12/16/25/35/50/75/100mm; if between, choose shorter for larger FOV | Inverse-solve + rank + snap-down rule |
| P4 | High-MP sensor + weak lens = wasted resolution | Check lens lp/mm + MP-rating + MTF center-to-edge vs sensor pixel size / Nyquist; MP-rating alone does not replace lp/mm/MTF | Limiting-side flag: sensor-limited vs lens-limited |
| P5 | Aperture/DoF/light guessed wrong → blur or diffraction | Stop down for DoF but not too far; open up for low light; each lens has optimum compromise | Advisory text only, no DoF solver |
| P6 | Close-WD / macro misuse of standard lenses | Standard lenses optimized ~50cm, best 1:1–1:10; avoid extension rings; use macro 1:10–1:1, microscope from ~5x | Surface MOD + magnification risk flag |
| P7 | Interface chosen late/by habit → bottleneck, rework | Requirements-first matrix on bandwidth/latency/cable/scalability/cost | Advisory pre-filter before architecture freezes |

Evidence:

- P1-P4 mount → image-circle → FOV/WD/f → resolution order, flange table F 46.5mm / C 17.5mm / CS 12.5mm / S undefined, image-circle vignetting example (`1/3"` lens on `1/2"` sensor vignettes; larger on smaller works but "smaller lens is usually more cost-efficient"), f formula + stock list + snap-shorter, lp/mm + 5MP + MTF center-to-edge: `https://www.baslerweb.com/en/learning/lens-selection/`
- P1-P3 mount mechanics C 17.526mm 1"-32TPI / CS 12.526mm 5mm shorter / F bayonet / M12/S compact, adapters risk leaks/misalignment, inches≠mm, same-or-larger + sweet-spot rule, minimum inputs = sensor size + mount + WD + horizontal FOV, Scenario 1: 1/2.3" C-mount WD 1524mm FOV 1219mm → ~8mm, Scenario 2: 1.1" C-mount WD 9000mm → ~50mm: `https://blog.roboflow.com/how-to-choose-a-lens-for-machine-vision/`
- P5 aperture/DoF/diffraction tradeoff both pages above.
- P6 WD/magnification sweet spot, MOD, extension-ring degradation: `https://www.baslerweb.com/en/learning/lens-selection/`
- P7 six late-decision failures: bandwidth computed too tightly, EMC underestimated, cable defined late, scalability ignored, integration effort underestimated, architecture-first: `https://www.baslerweb.com/en-sg/learning/interface-embedded/`

**Scenario fixtures as regression tests (SHOULD):** keep the two Roboflow worked examples above as unit fixtures for `focalLengthForFov`.

## 2. Fit chain — implement as ordered gates (reuse `optics.ts`)

Mount lives on camera body, not bare sensor chip. Seed `Sensor.mount` is a "typical body mount" convenience per `seedData.ts` header + LEARNINGS.md — sniper must split Chip vs Body.

| Step | Check | Fetched rule |
|---|---|---|
| 1. Sensor geometry | `sensorDiagonalMm`, `derivePixelPitchUm`, `nyquistResolutionLpMm` | Inch-notation doesn't correspond to physical dims — require mm + resolution |
| 2. Body mount | `checkMountCompatibility` — C==C, CS==CS, C-lens→CS-body +5mm spacer OK, CS-lens→C-body never, else mismatch | C 17.526/17.5mm vs CS 12.526/12.5mm (5mm delta); F 46.5mm bayonet; S/M12 compact |
| 3. Image circle | `checkImageCircle` ok/tight/vignetting on mm-vs-mm only | Maximum image circle ≥ diagonal; oversize OK optically but cost-inefficient. 10%-diagonal "tight" band is repo judgment, NOT vendor standard — no margin source fetched |
| 4. FOV/WD/f | `computeFovAxis`/`computeFov`, `workingDistanceForFov`, `focalLengthForFov`, `mmPerPixel` + stock snap 4–100mm snap-down | f from sensor-width + object-width + WD; thin-lens `normal/macro/extreme-macro/invalid` flags stay repo judgments |
| 5. Resolution | Sensor Nyquist vs lens `resolvingPowerLpMm` + `mmPerPixel` vs feature | Match MP + lp/mm + MTF; MP-rating alone insufficient |
| 6. Aperture/light advisory | Display `maxAperture` only | Optimum-compromise text; no solver |
| 7. Interface advisory | Filter by scenario, no `optics.ts` func | Board-level (MIPI/LVDS) vs system-level (GigE/USB/GMSL/CXP); decide on bandwidth/latency/cable/scalability/cost |

## 3. Company categories — fetched-verified vs repo-seeded

**Fetched-verified (safe to cite from this round):**

- Basler — cameras (ace 2/dart/boost/racer), lenses (C/S/F, telecentric), Lens Selector / Sensor Comparer tools. Evidence: both Basler URLs above.
- Edmund Optics — Imaging Lens Wizard + 8mm UC and 50mm DG example lenses. Evidence: Roboflow URL above.
- Lucid TRI120S 12MP 1.1" C-mount + Basler ace2 a2A1920 1/2.3" C-mount — scenario examples only, not catalog ingest. Evidence: Roboflow URL above.
- Silicon Signals (dev.to byline) — design-service author of GigE/USB3/MIPI comparison, not a catalog. Evidence: dev.to URL below.
- Nikon — F-mount origin reference only.

**Repo-seeded, NOT re-verified by these 4 fetches — keep usable with `sourceUrl` provenance, label "repo-seeded":**

Sony IMX264 (2/3") / IMX178 (1/1.8") / IMX267 (1") / IMX392 (1/2.3") + Framos listing, Computar V1226-MPZ 12mm 1"/16mm-circle/C, Commonlands CIL532 12mm 2/3" / CIL525 25mm 2/3" / CIL060 6mm M12. NEEDS-CURATION: rated lp/mm + MOD + spectral missing (`types.ts` `resolvingPowerLpMm?` empty). Bodies/interfaces have no seeds yet — NEEDS-CURATION. Any taxonomy beyond this requires fresh datasheet fetches.

## 4. Industry priority properties

- **General CV / inline inspection (P0):** mount, image-circle vs diagonal, f + WD + H-FOV, pitch/MP, aperture/DoF advisory, MOD/macro flag.
- **Embedded/MIPI compact (P1):** interface + cable-length + power + OS/arch + scalability/sync. Cable caps: MIPI <30cm (<30-40cm, <10ms, RAW, SoC-locked), USB3 5Gbps theo / ~400MB/s pract, 3-5m, plug-and-play, degrades multi-cam, GigE ~1Gbps/125MB/s to 100m PoE-option PTP-sync, GMSL2 6Gbps to 20m, CXP 12.5Gbps/ch to 40m. Evidence: `https://www.baslerweb.com/en-sg/learning/interface-embedded/` + `https://dev.to/siliconsignals_ind/industrial-machine-vision-camera-interfaces-gige-vs-usb3-vs-mipi-a-deep-technical-comparison-382k`
- **Inspection-precision (P1):** add MP-rating + lp/mm + MTF-requested flag, telecentric/macro/zoom triage, spectral tag (400-700nm vs 400-1000nm IR), entocentric vs telecentric branch.
- **UAV/GSD mapping (CUT — no evidence):** GSD source 404'd. No `optics.ts` GSD func exists. Do NOT ship altitude/GSD/overlap solver; allow only generic `mmPerPixel` display without altitude claims until fresh source fetched.

## 5. Sniper MUST / SHOULD / CUT

**MUST (fit correctness):**

- M1 Keep `computeFov*` + `workingDistanceForFov` + `focalLengthForFov` as single solver with risk bands + plain messages.
- M2 Keep `checkImageCircle` pass/tight/fail vs diagonal; label tight as repo judgment.
- M3 Keep `checkMountCompatibility` incl. C→CS spacer / CS→C never.
- M4 Keep `derivePixelPitchUm` + `nyquistResolutionLpMm` + `mmPerPixel` + lens lp/mm limiter display; flag MP-alone-insufficient.
- M5 Keep per-field `found`/blank-don't-guess import UX (`ExtractedField<T>`); fields must come from datasheets, not inference.
- M6 Add body-vs-chip labeling ("mount = typical body mount") per LEARNINGS.md.

**SHOULD (small, high-leverage):**

- Interface advisory pre-filter (MIPI/GMSL/USB/GigE/CXP) on cable-length + multi-cam + determinism + OS/arch with headroom warning — NOT a precise bandwidth solver.
- Fixed-focal snap-down + fixed-vs-zoom note; WD/MOD + magnification advisory; aperture/DoF/diffraction + spectral + telecentric/macro text flags.
- Cost-efficiency nudge: oversize image-circle optically safe (sweet spot) but flagged wasteful.

**CUT (v1 explicitly out):**

UAV/GSD/altitude solver; image-circle margin standard; bulk catalog crawl, live vendor APIs, price/availability, OCR/logged-wall PDFs; DoF/bokeh solver; distortion/MTF-curve modeling; spectral/IR co-optimization beyond flag; telecentric measurement mode beyond type flag; multi-user/cloud — per requirements §6 + failed GSD fetch.

## 6. Assumptions register

- A1 Mount-first, as body property — Basler mount-first workflow + Roboflow "check camera specs."
- A2 Image-circle ≥ diagonal; oversize OK but cost-inefficient — Basler vignetting/cost + Roboflow same-or-larger/sweet-spot.
- A3 Solve FOV↔WD↔f with thin-lens funcs; snap to stocked focals snap-down — Basler focal-from-FOV+WD + stock list.
- A4 Gate resolution on pitch + lp/mm, not MP alone — Basler lp/mm + MTF + 5MP example.
- A5 Aperture/spectral/telecentric as advisory flags only — Basler + Roboflow aperture/spectral/special-lens sections.
- A6 Gate embedded on cable/determinism/scalability/OS, not bandwidth alone; cable caps + mistake list as above — Basler-embedded table + dev.to trade table.
- A7 Default triage compact→MIPI, mobile/AGV→GMSL, inline→GigE/USB3, high-speed→CXP, overridable — Basler-embedded scenarios + table.
- A8 Tight-margin, macro thresholds, seed body-mount assignments are repo judgments, not standards — `optics.ts` comments + LEARNINGS.md; margin page 404 unavailable.
- A9 No UAV/GSD requirements emitted — GSD source 404; absence of evidence, needs re-fetch.

**Handoff action:** file under `docs/`; wire MUST 1-6 to existing `optics.ts` vitest cases; extend `types.ts` + seeds with MOD + lp/mm + interface + Body table with `sourceUrl` provenance without changing solver semantics.
