# FAE Brief — Sniper-Scoped Camera Selection Website (docs/ handoff)

**Current app reality (repo-verified):** React + three.js comparator (1–4 panels), `src/lib/optics.ts` thin-lens funcs, `src/lib/seedData.ts` 4 sensors + 4 lenses, `src/store/persistence.ts` localStorage, single stateless datasheet endpoint `api/extract-datasheet.ts`. It answers "are these compatible?" not "what should I buy?" (`docs/requirements.md` §§1–4, `docs/architecture.md` §§1–3).

**Evidence base / limitation:** All 6 Reddit threads bot-walled (HTTP 200 bot-challenge body) — no verbatim quotes used. Of 6 declared open-web guides, 4 fetched successfully and are the only citations below. 2 failed:

- `commonlands.com/blogs/technical/sensor-size-lens-compatibility` → HTTP 404
- `commonlands.com/blogs/technical/drone-mapping-photogrammetry-lenses` → HTTP 404

So image-circle margin practice and UAV/GSD math have **no fetched evidence** in this round — marked NEEDS-CURATION, not asserted.

## 1. Pains + workarounds (proxy evidence)

1. **Mount-first confusion.** Both lens guides start with "check camera mount" because wrong flange distance = no focus. Workaround today: manual datasheet check + 5 mm spacer rule.
   - Evidence: Basler lens-selection checklist order is mount → image-circle → focal-length/FOV/WD → resolution-match → aperture/WD/spectral; mount table: F 46.5 mm / C 17.5 mm / CS 12.5 mm / S undefined; C=17.526 mm optimized distance must match — `https://www.baslerweb.com/en/learning/lens-selection/`
   - Evidence: Roboflow: C 17.526 mm/1"-32TPI (to ~1"), CS 12.526 mm 5 mm shorter (≤1/2"), F bayonet for large format, M12/S board-lens for compact; wrong mount = won't attach or mis-focus; adapters risk leaks/misalignment; standardize mount — `https://blog.roboflow.com/how-to-choose-a-lens-for-machine-vision/`
2. **Image-circle vs sensor-size mismatch → vignetting.** Users compare inch-labels (`1/2"` lens on `1/2"` sensor) but labels aren't mm. Workaround: compare lens "Maximum image circle" (mm) vs sensor diagonal (mm).
   - Evidence: Basler: image circle = evenly-illuminated area without vignetting; `1/3"` lens on `1/2"` sensor vignettes; larger lens on smaller sensor works but wastes money — `https://www.baslerweb.com/en/learning/lens-selection/`
   - Evidence: Roboflow: sensor inches ≠ physical dims; image circle must cover sensor; smaller circle = dark corners; choose same-or-larger format; larger-format lens sweet-spot helps; worked example `1/3"` lens on `1/2"` sensor vignettes — `https://blog.roboflow.com/how-to-choose-a-lens-for-machine-vision/`
3. **FOV/WD/focal-length iteration by hand.** Users know two of {FOV, WD, f} and hand-solve the third, then discover the focal length isn't a stock value. Workaround: vendor calculators + fixed-focal-length snapping.
   - Evidence: Basler: f from sensor-width/object-width/WD; stock values 4/6/8/12/16/25/35/50/75/100 mm; if between, pick shorter for larger FOV; zooms lower quality; typical focal table + Lens Selector tool — `https://www.baslerweb.com/en/learning/lens-selection/`
   - Evidence: Roboflow: WD = lens-front to object; FOV = observable extent; short f = wide FOV, long f = narrow/magnified; minimum inputs to select = sensor-size + mount + WD + horizontal FOV; Edmund Wizard + Basler Selector; Scenario 1: 1/2.3" C-mount, WD 1524 mm, FOV 1219 mm → ~8 mm; Scenario 2: 1.1" C-mount, WD 9000 mm → ~50 mm — `https://blog.roboflow.com/how-to-choose-a-lens-for-machine-vision/`
4. **Resolution mismatch (MP sensor, weak lens) + aperture/DoF/light tradeoff.** Workaround: check lp/mm + MP-rating + MTF, then balance f-number vs diffraction.
   - Evidence: Basler: lens lp/mm must match pixel size; 5 MP sensor needs 5 MP-capable lens; MP-rating doesn't replace lp/mm/MTF check; small f-number = more light/shallow DoF; stopped-down = deeper DoF but diffraction blur; each lens has optimum — `https://www.baslerweb.com/en/learning/lens-selection/`
   - Evidence: Roboflow: large aperture (small f/#) = more light/shallow DoF; small aperture = less light/deep DoF but needs light/exposure and risks diffraction — `https://blog.roboflow.com/how-to-choose-a-lens-for-machine-vision/`
5. **Close-WD / macro misuse of standard lenses.** Standard lenses optimized ~50 cm, 1:1–1:10; extension rings degrade quality; MOD limits range.
   - Evidence: Basler working-distance/magnification section — `https://www.baslerweb.com/en/learning/lens-selection/`
6. **Interface chosen late / by habit → bottleneck, EMC, cable, scaling rework.** Workaround: requirements-first matrix on bandwidth/latency/cable/scalability/cost.
   - Evidence: Basler embedded: board-level (MIPI/LVDS) = integration/cost vs system-level (GigE/USB/GMSL/CXP) = flexibility/distance/scalability; decision factors bandwidth/latency/cable/scalability/cost; table (MIPI 1–4.5 Gbps/lane <30 cm very-low latency; GMSL2 6 Gbps to 20 m; USB3 5 Gbps to 5 m; 1GigE/5GigE to 100 m; CXP 12.5 Gbps/ch to 40 m); 6 common mistakes (tight bandwidth, EMC, late cable, no scaling, integration effort, architecture-first) — `https://www.baslerweb.com/en-sg/learning/interface-embedded/`
   - Evidence: SiliconSignals/DEV: GigE ~1 Gbps/125 MB/s to 100 m, PoE opt, PTP sync, deterministic but CPU/network-tuning cost; USB3 ~5 Gbps theo/~400 MB/s pract, 3–5 m, plug-and-play, single-cable power, degrades multi-cam; MIPI multi-lane Gbps, <10 ms, <30–40 cm, RAW, low power, high PCB/driver/ISP complexity; choose GigE for distance/multi-cam/determinism, USB3 for compact bandwidth/ease, MIPI for embedded latency/integration — `https://dev.to/siliconsignals_ind/industrial-machine-vision-camera-interfaces-gige-vs-usb3-vs-mipi-a-deep-technical-comparison-382k`

## 2. Fit chain (implement as ordered gates)

`sensor active-area → camera-body (mount + interface) → lens (mount + image-circle + f + resolution + aperture/MOD) → geometry (WD/FOV) → interface/cable/compute`

Current gap (repo-verified): `Sensor.mount` stores a *typical body mount* as proxy ("sensor chip itself doesn't have a mount" — `seedData.ts` header). Sniper must split chip vs body; do not let chip inch-label imply mount or interface.

## 3. Company categories

- **Chips (sensors) — VERIFIED seeds:** Sony Semiconductor IMX264 (2/3"), IMX178 (1/1.8"), IMX267 (1"), IMX392 (1/2.3") with mm + pitch + flyer/FRAMOS URLs in `seedData.ts`.
- **Lenses — VERIFIED seeds:** Computar V1226-MPZ (12 mm/1"/16 mm-circle/C), Commonlands CIL532/CIL525/CIL060 in `seedData.ts`. **NEEDS-CURATION:** rated lp/mm + MOD + spectral missing (`types.ts` `resolvingPowerLpMm?` empty).
- **Bodies/interfaces — NEEDS-CURATION (no seeds yet):** Basler (dart/ace2, GigE/USB/MIPI/GMSL/CXP per embedded page); Edmund Optics (Wizard per Roboflow); Lucid TRI120S + Basler ace2 a2A1920 examples per Roboflow (do not ingest as catalog — scenarios only); Nikon as F-mount origin per both lens guides.

## 4. Industry priority properties

- **General CV / inspection (P0, evidenced):** mount, image-circle vs diagonal, f + WD + H-FOV, pitch/MP, aperture/DoF, MOD/macro flag.
- **Embedded/MIPI (P1, evidenced):** interface, cable-length, power (PoE/single-cable), OS/arch (ARM/x86), scalability/sync, CPU/ISP load (RAW vs processed).
- **UAV/GSD (DEFERRED — no evidence):** GSD page 404'd. `mmPerPixel()` exists but altitude/GSD workflow has no citation → CUT until curated source added. Do not ship GSD calculator on thin-lens alone.
- **Spectral/telecentric/macro (P2, partially evidenced):** Basler spectral (400–700 nm vs 400–1000 nm IR cost) + telecentric/macro/zoom taxonomy; Roboflow telecentric/macro/zoom/fixed — keep as tags/filters, not solvers.

## 5. Sniper MUST / SHOULD / CUT (reuse `optics.ts`, no new physics)

**MUST (keep + harden):**
- `computeFovAxis/computeFov + workingDistanceForFov + focalLengthForFov` 4-way solver (sensor-mm × f × WD ↔ H/V-FOV) with existing `normal/macro/extreme-macro/invalid` flags; surface Basler MOD/macro warning + stock-focal snap (4–100 mm).
- `sensorDiagonalMm + checkImageCircle` ok/tight/vignetting gate on mm-vs-mm only; never inch-label matching. Tight-margin 10% stays labeled judgment-call (LEARNINGS) — no open-web margin evidence fetched.
- `checkMountCompatibility` C/CS 5 mm spacer rule (17.526 vs 12.526 per both lens guides); all other cross-family = mismatch.
- `derivePixelPitchUm + nyquistResolutionLpMm + mmPerPixel` + optional lens lp/mm limiter flag (Basler/Roboflow resolution-match).
- Datasheet-import confirm-step + blank-and-flag (requirements §3.1) + seed citations.

**SHOULD (small, evidenced):**
- Interface pre-filter (GigE/USB/MIPI + cable/power/sync/scalability hints from Basler table + DEV comparison); body/interface split in data model.
- Aperture/DoF guidance text (no solver — Basler/Roboflow tradeoff only).
- Entocentric vs telecentric branch flag; spectral tag (VIS/IR).

**CUT (v1):**
- UAV/GSD/altitude mode; bulk catalog crawl; live vendor APIs; OCR/logged-wall PDFs; price/availability; DoF/bokeh solver; distortion/MTF-curve modeling; multi-user cloud — per requirements §6 + failed GSD fetch.

## 6. Assumptions (each + fetched evidence)

1. Assume mount-first ordering — Basler checklist + Roboflow mount-first — `https://www.baslerweb.com/en/learning/lens-selection/`, `https://blog.roboflow.com/how-to-choose-a-lens-for-machine-vision/`
2. Assume C 17.526 / CS 12.526 flange numbers — both pages agree — same two URLs.
3. Assume image-circle-mm vs diagonal-mm gate; inch-labels not mm — Basler vignetting example + Roboflow inches≠mm — same two URLs.
4. Assume f/WD/FOV triad + stock-focal snap + selector-tool pattern — Basler formula/stock list + Roboflow scenarios/Wizards — same two URLs.
5. Assume lens lp/mm must meet sensor Nyquist/MP + MTF varies center→edge — Basler lp/mm/MTF/5 MP passage — `https://www.baslerweb.com/en/learning/lens-selection/`
6. Assume aperture/DoF/diffraction compromise, no auto-exposure claim — Basler aperture + Roboflow aperture sections — same two lens URLs.
7. Assume standard-lens ~50 cm / 1:1–1:10 sweet spot; beyond → macro/microscope, avoid extension rings — Basler WD/magnification — `https://www.baslerweb.com/en/learning/lens-selection/`
8. Assume interface matrix bandwidth/latency/cable/scalability/cost + cable caps (<30 cm MIPI, 5 m USB, 100 m GigE) + mistake list — Basler embedded table/mistakes — `https://www.baslerweb.com/en-sg/learning/interface-embedded/` + DEV bandwidth/latency/use-case mapping — `https://dev.to/siliconsignals_ind/industrial-machine-vision-camera-interfaces-gige-vs-usb3-vs-mipi-a-deep-technical-comparison-382k`
