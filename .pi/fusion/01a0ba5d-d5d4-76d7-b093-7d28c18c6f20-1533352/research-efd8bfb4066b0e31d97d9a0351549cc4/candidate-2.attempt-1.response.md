# Sniper-Scoped Camera Selection Website — Evidence-Backed FAE Brief (docs/ handoff)

**Current baseline (repo-verified):** React + three.js comparator, 1–4 panels, sensor+lens+WD inputs, 3D FOV cone, `localStorage`, 8 seeds (4× Sony IMX sensors, 1× Computar + 3× Commonlands lenses), one Claude datasheet endpoint (`api/extract-datasheet.ts` + `api/_lib/`). It answers "are these compatible?" not "what should I buy?". Pure optics in `src/lib/optics.ts`; data model in `src/lib/types.ts`; requirements in `docs/requirements.md`, architecture in `docs/architecture.md`, judgment calls in `docs/LEARNINGS.md`.

**Source status:** 4 of 6 declared URLs fetched OK and are cited below. 2 failed and are **not cited, not paraphrased as evidence**:
- `commonlands.com/blogs/technical/sensor-size-lens-compatibility` → HTTP 404 on fetch.
- `commonlands.com/blogs/technical/drone-mapping-photogrammetry-lenses` → HTTP 404 on fetch.
- All 6 Reddit threads bot-walled (HTTP 200 body = bot challenge) per task background → no verbatim quotes, no claims sourced to Reddit. Open-web vendor/technical guides below are proxy evidence only.

## 1. Pains + current workarounds (fetched evidence only)

**P1 — Lens choice is a multi-variable fit problem, users do it by hand across PDFs.**
Basler frames selection as an ordered workflow: mount → image circle vs. sensor → focal length from FOV+WD → resolution match → aperture/WD/spectral/special. It explicitly says focal length "is determined by the sensor width, the object width, and the working distance" and vendors offer calculator tools, or a formula. That is exactly the manual math the current comparator already mechanizes.
Evidence: https://www.baslerweb.com/en/learning/lens-selection/

**P2 — Mount mismatch = no focus or no attach.**
Roboflow: wrong mount "won't physically attach… or may not position the lens at the correct distance from the sensor, resulting in unfocused images"; even adapters risk "light leaks or misalignment." Workaround offered: check camera datasheet first, use adapters only when necessary, standardize on one mount.
Evidence: https://blog.roboflow.com/how-to-choose-a-lens-for-machine-vision/
Basler adds flange-focal-distance table (F: 46.5 mm; C: 17.5/17.526 mm; CS: 12.5 mm; S undefined) and bayonet vs. screw-thread mechanics.
Evidence: https://www.baslerweb.com/en/learning/lens-selection/

**P3 — Image circle < sensor = vignetting; oversize = wasted cost.**
Basler: image circle is "Maximum image circle" in lens datasheets; 1/3" lens on 1/2" sensor causes vignetting; 2/3" lens on 1/3" sensor avoids vignetting but "a smaller lens is usually more cost-efficient." Roboflow: "Always choose a lens designed for the same or larger sensor size"; larger-rated lens uses the "sweet spot"; concrete rule — 1/2" sensor needs ≥1/2" lens; 1/3" lens on it vignettes.
Evidence: https://www.baslerweb.com/en/learning/lens-selection/ ; https://blog.roboflow.com/how-to-choose-a-lens-for-machine-vision/

**P4 — Resolution must be matched both ways (MP + lp/mm + pixel size).**
Basler: lens resolution in lp/mm; MTF curve shows center-to-edge sharpness; pixel-size matching ("with a 5 MP sensor, you need a lens that can actually resolve those 5 MP"); some lenses state supported MP directly but that "does not replace checking lp/mm or MTF."
Evidence: https://www.baslerweb.com/en/learning/lens-selection/

**P5 — WD/FOV/focal-length triangle under space constraints.**
Roboflow: WD = front-of-lens to object; FOV = observable area; shorter f = wider FOV / longer f = narrower + more magnification; constraints checklist: space, object size, detail, surveillance-wide vs. inspection-long. Worked examples: 1524 mm WD + 1219 mm belt → ~8 mm lens (Basler ace2 1/2.3" C-mount); 9000 mm WD truck OCR → ~50 mm lens (Lucid TRI120S 12 MP 1.1" C-mount), both via Edmund Optics Imaging Lens Wizard.
Evidence: https://blog.roboflow.com/how-to-choose-a-lens-for-machine-vision/

**P6 — Aperture/depth-of-field vs. light vs. diffraction.**
Both Basler and Roboflow: small f-number = more light, shallow DOF; large f-number = deeper DOF but less light + diffraction blur. Each lens has an optimum compromise. Roboflow adds manual-iris vs. fixed-aperture, low-light (larger max aperture) vs. high-precision (smaller aperture for full-focus) guidance.
Evidence: https://www.baslerweb.com/en/learning/lens-selection/ ; https://blog.roboflow.com/how-to-choose-a-lens-for-machine-vision/

**P7 — Interface chosen too late becomes the bottleneck.**
Basler-embedded lists five decision factors (bandwidth, latency, cable length, scalability, system cost) and six late-decision failure modes: bandwidth computed too tightly (ignoring color depth/trigger/headroom); EMC underestimated (MIPI ribbon <30 cm not for harsh/long runs); cable length defined late; scalability ignored (single-camera grows to multi); integration effort underestimated (USB3 Vision/GigE Vision tooling vs. proprietary); architecture-first instead of requirements-first.
Evidence: https://www.baslerweb.com/en-sg/learning/interface-embedded/
Dev.to comparison adds dropped frames, latency/sync/integration complexity from wrong interface; GigE needs jumbo-frame/NIC tuning; USB3 degrades with multiple cameras per controller; MIPI needs PCB/driver/ISP-tuning expertise and is SoC-locked.
Evidence: https://dev.to/siliconsignals_ind/industrial-machine-vision-camera-interfaces-gige-vs-usb3-vs-mipi-a-deep-technical-comparison-382k

## 2. Fit chain to implement (sensor → body → lens → mount → interface)

Keep the repo's honest split (LEARNINGS.md): **mount lives on the camera body, not the bare sensor chip**; seed sensors carry a "typical body mount" as a convenience. Sniper scope should surface this, not hide it.

| Step | Check (reuse `optics.ts`) | Fetched rule |
|---|---|---|
| 1. Sensor geometry | `sensorDiagonalMm`, `derivePixelPitchUm`, `nyquistResolutionLpMm` | Sensor inch-notation "doesn't correspond directly to physical dimensions" — require mm + resolution; derive pitch. Roboflow evidence above. |
| 2. Body mount | `checkMountCompatibility` (C==C, CS==CS, C-lens→CS-body +5 mm spacer OK, CS-lens→C-body never, else mismatch) | Flange distances C 17.526/17.5 mm vs. CS 12.526/12.5 mm (5 mm delta); F bayonet 46.5 mm; S/M12 small/compact. Basler + Roboflow mount sections above. |
| 3. Image circle | `checkImageCircle` (ok/tight/vignetting) | Lens "Maximum image circle" ≥ sensor diagonal; same-or-larger format rule. Basler + Roboflow above. 10%-diagonal "tight" band stays a documented judgment call (LEARNINGS.md), **not** vendor-sourced. The dedicated Commonlands image-circle-margin page could not be fetched (404) — do not cite a margin standard. |
| 4. FOV/WD/f | `computeFovAxis`/`computeFov`, `workingDistanceForFov`, `focalLengthForFov`, `mmPerPixel` | Focal length from sensor-width + object-width + WD; common fixed values 4/6/8/12/16/25/35/50/75/100 mm; if between, "generally choose the shorter" for larger FOV; zooms flexible but lower quality. Basler focal-length section. Thin-lens macro flags (m≥0.5 macro, ≥2 extreme, WD≤f invalid) stay repo judgment calls; vendor proxy: standard lenses optimized ~50 cm WD, best at 1:1–1:10 magnification, MOD-limited; extension rings degrade quality; macro lenses for ~1:10–1:1; microscope objectives from ~5×. Basler WD/magnification section. |
| 5. Resolution | sensor Nyquist vs. lens `resolvingPowerLpMm` + `mmPerPixel` vs. feature size | Match MP + lp/mm + MTF; MP rating alone insufficient. Basler resolution section. |
| 6. Aperture/light (advisory only) | display `maxAperture` only; no DOF solver | Optimum-compromise guidance; no formula to reuse. Basler + Roboflow aperture sections. |
| 7. Interface (advisory only) | no `optics.ts` func; filter by scenario | Board-level (MIPI CSI-2, LVDS/parallel: max integration, min cost) vs. system-level (GigE/USB/GMSL/CoaXPress: flexibility, distance, scalability); decide on bandwidth/latency/cable/scalability/cost. Basler-embedded key-facts + criteria + table (MIPI 1–4.5 Gb/s/lane <30 cm; GMSL2 6 Gb/s ≤20 m; USB3 5 Gb/s ≤5 m; 1GigE/5GigE ≤100 m; CXP 12.5 Gb/s/ch ≤40 m) and Dev.to table (GigE ~1 Gb/s/100 m/PoE-option/PTP+triggers; USB3 ~5 Gb/s theo, ~400 MB/s pract, 3–5 m, single-cable power+data; MIPI multi-lane Gb/s, <10 ms typical, <30–40 cm, RAW). |

## 3. Company categories (chips vs. bodies vs. lenses) — verified vs. needs-curation

**Verified from fetched pages only (safe to seed/cite):**
- **Bodies + lenses + system vendor: Basler** — fetched pages list Cameras (ace 2/ace/MED ace/boost/dart/beat, racer, ToF/stereo), Lenses (C/S/F-mount, telecentric, spacers/filters), Lighting, Acquisition cards, pylon software, plus Lens Selector / Camera Selector / Sensor Comparer tools.
Evidence: https://www.baslerweb.com/en/learning/lens-selection/ ; https://www.baslerweb.com/en-sg/learning/interface-embedded/
- **Lens + selector-tool vendor: Edmund Optics** — Roboflow's recommended Imaging Lens Wizard + 8 mm UC and 50 mm DG fixed-focal lenses in worked scenarios.
Evidence: https://blog.roboflow.com/how-to-choose-a-lens-for-machine-vision/
- **Body vendor (example): Lucid (TRI120S 12 MP 1.1" C-mount)** — appears only as the truck-OCR camera example.
Evidence: https://blog.roboflow.com/how-to-choose-a-lens-for-machine-vision/
- **Body vendor (example): Basler ace2 a2A1920-160ucBAS (1/2.3" C-mount)** — can-counting example.
Evidence: same Roboflow page.
- **Design/engineering service: Silicon Signals** — author/byline context for GigE/USB3/MIPI comparison; not a chip/body/lens catalog.
Evidence: https://dev.to/siliconsignals_ind/industrial-machine-vision-camera-interfaces-gige-vs-usb3-vs-mipi-a-deep-technical-comparison-382k

**Needs-curation (in repo seeds but NOT verified by these 4 fetches — do not present as fetched evidence):** Sony Semiconductor (IMX264/178/267/392 flyers), Framos (IMX267 listing), Computar (V1226-MPZ), Commonlands (CIL532/CIL525/CIL060), Graftek reseller page. Keep them as `source: seed + sourceUrl` per `seedData.ts` header convention, but label "repo-seeded, not re-verified by this brief's fetches." Any chip-vs-body-vs-lens taxonomy beyond the five bullets above requires new targeted fetches (datasheets/spec pages) — sniper CUT for now.

## 4. Industry priority properties (what to ask first per segment)

- **General CV / inline inspection (P0):** sensor mm + H×V + mount; lens f + mount + image circle + resolvingPower; WD + target H-FOV; derived FOV, m, mm/pixel, Nyquist-vs-lens flags. Proxy: conveyor-can counting (1524 mm/1219 mm/8 mm) and truck OCR (9 m/50 mm/12 MP) scenarios; inline-inspection = GigE/USB3 standardized.
Evidence: Roboflow scenarios + Basler-embedded application scenarios.
- **Embedded / MIPI compact (P1):** add interface + cable-length + SoC/OS + power/robustness gates. Compact embedded = MIPI CSI-2 direct-to-SoC, minimal footprint; <30 cm ribbon; Linux ARM; very low cost; poor scalability/robustness.
Evidence: https://www.baslerweb.com/en-sg/learning/interface-embedded/ ; Dev.to MIPI section.
- **Inspection-precision (P1):** add lens MP-rating + lp/mm + MTF-requested flag; telecentric/macro/zoom triage; aperture range. Telecentric = consistent magnification, no perspective error, precise measurement; macro = close-up small detail; fixed-focal > zoom quality in fixed setups.
Evidence: Roboflow special-lens section; Basler resolution/MTF + WD/magnification sections.
- **UAV/GSD mapping (CUT — no evidence):** the declared GSD/altitude/pixel-pitch/focal-length math source returned 404 and was not fetched. Do **not** add altitude, GSD-target, overlap, or drone-body fields on this brief's authority. If UAV is required, schedule a fresh fetch (vendor/drone-mapping guide) and derive GSD = (pitch × altitude)/f as a new tested func — currently no `optics.ts` GSD function exists, so any GSD number today would be fabrication.

## 5. Sniper MUST / SHOULD / CUT (each reuses thin-lens `optics.ts` where applicable)

**MUST (fit-chain correctness, tiny surface):**
1. MUST keep `computeFov*` + `workingDistanceForFov` + `focalLengthForFov` as the single solver (any-one-of-FOV/WD/f), with existing risk bands + plain-language messages. Evidence: Basler focal-from-FOV+WD workflow.
2. MUST keep `checkImageCircle` pass/tight/fail vs. diagonal; label "tight = 10%-diagonal repo judgment, not a standard." Evidence: Basler/Roboflow vignetting rule; margin threshold itself unevidenced (404 page unavailable).
3. MUST keep `checkMountCompatibility` incl. C→CS spacer / CS→C never / F/M12 families. Evidence: flange-distance tables + Roboflow adapter warning.
4. MUST keep `derivePixelPitchUm` + `nyquistResolutionLpMm` + `mmPerPixel` + lens `resolvingPowerLpMm` limiting-factor display; flag "MP rating alone insufficient." Evidence: Basler resolution section.
5. MUST keep per-field `found` flags / blank-don't-guess import UX (requirements §3.1, `ExtractedField<T>`). Evidence: Roboflow "check camera datasheet first" + Basler "Maximum image circle in datasheet" — fields must come from datasheets, not inference.
6. MUST add body-vs-chip labeling (sensor entry shows "mount = typical body mount") per LEARNINGS.md seed-mount note. Evidence: Basler mount tables are camera-body mounts; Roboflow mount advice is "check camera specs."

**SHOULD (small, high-leverage):**
7. SHOULD add WD/MOD + magnification-range advisory (standard ~50 cm, 1:1–1:10; macro/microscope triage) using existing `magnification` output. Evidence: Basler WD/magnification section.
8. SHOULD add interface pre-filter (MIPI/GMSL/USB/GigE/CXP) on cable-length + multi-camera + determinism + OS/arch, advisory-only, no fake bandwidth math. Evidence: Basler-embedded table + Dev.to comparison table.
9. SHOULD add fixed-focal snap (4/6/8/12/16/25/35/50/75/100 mm, snap down if between) + fixed-vs-zoom note. Evidence: Basler typical-focal-lengths section.
10. SHOULD surface aperture/DOD/diffraction + spectral-range (400–700 nm vs. 400–1000 nm IR) + telecentric/macro nudges as text flags, not solvers. Evidence: Basler aperture + spectral + lens-type sections; Roboflow aperture + special-lens sections.

**CUT (explicitly deferred):**
- UAV/GSD/altitude solver, overlap planning, drone airframes — no fetched math source (404). No `optics.ts` GSD func exists.
- Image-circle tolerance/margin standard — dedicated source 404; keep repo 10% judgment, do not standardize.
- Bulk catalog crawl, live vendor APIs, OCR/logged-wall PDFs, price/availability, distortion/MTF-curve modeling, distortion/DoF solvers, cloud collaboration — already out-of-scope in requirements §6; fetched pages give no additional mandate.
- Company taxonomy expansion (chip makers, body OEMs, lens houses beyond §3) — needs fresh datasheet fetches; current seeds stay labeled as repo-seeded.

## 6. Assumptions register (each paired with fetched evidence; no fabrication)

| # | Assumption for sniper build | Paired fetched evidence |
|---|---|---|
| A1 | Ask mount first; treat as body property. | Basler mount-first workflow + flange table; Roboflow "check camera specs" — links above. |
| A2 | Require image circle ≥ diagonal; oversize OK but cost-inefficient. | Basler vignetting/cost + Roboflow same-or-larger/sweet-spot rules — links above. |
| A3 | Solve FOV↔WD↔f with thin-lens funcs; snap to stocked fixed focals. | Basler focal-from-FOV+WD + stocked-focal list + snap-shorter guidance. |
| A4 | Gate resolution on pitch + lp/mm, not MP alone. | Basler lp/mm + MTF + 5 MP example. |
| A5 | Keep aperture/spectral/telecentric as advisory flags. | Basler + Roboflow aperture sections; Basler spectral 400–700 vs. 400–1000 nm; Roboflow telecentric/macro/zoom list. |
| A6 | Gate embedded choices on cable/determinism/scalability/OS, not bandwidth alone. | Basler-embedded criteria + mistake list + scenario map; Dev.to GigE/USB3/MIPI trade table. |
| A7 | Compact→MIPI, mobile/AGV→GMSL, inline→GigE/USB3, high-speed→CXP as default triage, overridable. | Basler-embedded application scenarios + bandwidth/latency/cable table. |
| A8 | Tight-margin, macro thresholds, seed body-mount assignments are repo judgments, not standards. | No vendor threshold fetched (Commonlands margin page 404); documented in `optics.ts` comments + LEARNINGS.md. |
| A9 | No UAV/GSD requirements emitted. | GSD source 404 — absence of evidence, not evidence of absence; needs re-fetch before scoping. |

**Docs handoff note:** file under `docs/` alongside requirements/architecture/LEARNINGS; wire MUST 1–6 to existing `optics.ts` unit tests (22 vitest cases) rather than new optics; any new interface/spectral/MP-rating fields extend `types.ts` + `ExtractedField` + seed provenance (`sourceUrl`) without changing solver semantics.
