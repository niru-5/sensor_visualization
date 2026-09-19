# FAE Brief — Sniper-Scoped Camera Selection Website (docs/ handoff)

> Scope: current app is React+three.js comparator (1–4 panels, sensor+lens+WD, 3D FOV, localStorage, 8 seeds, one Claude datasheet endpoint). It answers "are these compatible?" — sniper must answer "what should I buy?"
> Evidence rule for this brief: **cite only pages actually fetched.** All 6 Reddit threads bot-walled (HTTP 200 body = Reddit bot challenge) → **no verbatim Reddit quotes used.** 2 of 6 declared open-web URLs 404'd on fetch → excluded as evidence (listed in §7). All claims below cite the 4 successfully fetched pages: Basler Lens Selection [B-LENS], Roboflow Lens Guide [R-LENS], Basler Embedded Interface [B-IF], Silicon Signals Interface Comparison [S-IF].

## 1. Pains + current workarounds (evidence-backed)

| # | Pain | Workaround users do today (per vendor guides) | Evidence |
|---|------|-----------------------------------------------|----------|
| P1 | Lens-first search without knowing mount → physically won't attach / won't focus | Check camera datasheet for mount first; standardize on one mount across systems | [R-LENS]: "Check Camera Specifications… Standardization: if possible, standardize on a mount type"; [B-LENS]: "search for a lens begins with a look at your camera. What type of lens mount does it have?" |
| P2 | Image-circle < sensor diagonal → dark corners / vignetting | Manually compare "Maximum image circle" in lens datasheet vs sensor size; rule: lens rated for same-or-larger sensor format | [B-LENS]: "A 1/3" C-mount lens… with larger sensor (e.g. 1/2")… would cause vignetting"; [R-LENS]: "If the image circle is smaller than the sensor, you'll experience vignetting… Always choose a lens designed for same or larger sensor size" |
| P3 | Wrong FOV at available working distance (space-constrained) | Hand-compute focal length from sensor width + object width + WD, or use vendor selector tools; if computed f falls between standard values pick shorter f | [B-LENS]: "focal length is determined by sensor width, object width, working distance… Common values 4,6,8,12,16,25,35,50,75,100mm. If value falls in between, choose shorter focal length"; [R-LENS]: "lens focal length bridges WD and FOV… use Edmund Optics Imaging Lens Wizard / Basler Lens Selector" |
| P4 | Sensor resolves more than lens delivers (wasted MP) | Compare lens lp/mm or MP-rating + MTF vs sensor pixel size; require lens to resolve sensor's pixels | [B-LENS]: "resolution in lp/mm… sensor can only exploit full potential if lens resolution high enough… must match pixel size… check lp/mm or MTF"; [R-LENS] scenario reasoning: "high-quality optics essential for high-resolution imaging and accurate OCR" |
| P5 | Aperture/DoF vs light tradeoff guessed wrong → blur or diffraction | Stop-down for DoF but not too far (diffraction); open-up for low light; manual-iris vs fixed-aperture choice | [B-LENS]: "small F-number… being too stopped down leads to diffraction blur… find compromise"; [R-LENS]: "smaller apertures increase DoF [but] can introduce diffraction… Balancing aperture size is key" |
| P6 | Interface chosen late / by habit → bottleneck, unstable, unscalable | Structured decision on bandwidth/latency/cable/scalability/cost before architecture freezes | [B-IF]: "choice often made too late or as isolated decision… interface should be result of requirements analysis — not starting point"; [S-IF]: "selection should be driven by system-level constraints rather than camera specs alone… wrong interface → dropped frames, high latency, sync issues" |
| P7 | WD/magnification outside sweet spot → soft image, MOD violation | Stay in vendor sweet spot (~50cm WD, mag 1:1–1:10); avoid extension rings; switch to macro >1:10, microscope ≥5:1 | [B-LENS]: "Most lenses optimized for ~50cm… best quality at 1:1–1:10… extension rings… image quality suffers… avoid wherever possible… macro 1:10–1:1, microscope objectives from ~5x" |

What sniper changes: replaces P2–P4 + P6 hand-math/tool-hopping with **inputs (FOV + WD + sensor constraints + interface constraints) → ranked buy-list** with fit-chain flags. Current comparator cannot do this (no inverse-solve ranking, no catalog, no interface filter).

## 2. Fit chain (order matters — sniper must enforce in this order)

Per [B-LENS] "Steps for Lens Selection" sequence and [R-LENS] "minimum information" rule:

1. **Mount (mechanical):** `checkMountCompatibility()` — C 17.526mm vs CS 12.526mm (5mm shorter), F bayonet, M12/S compact. [B-LENS] table: F 46.5mm / C 17.5mm / CS 12.5mm / S undefined; [R-LENS]: C 17.526mm 1"-32TPI, CS 12.526mm (5mm shorter), F bayonet, M12 board lens. Mismatch = hard fail (except C-lens on CS-body +5mm spacer).
2. **Image circle ≥ sensor diagonal:** `checkImageCircle()` + `sensorDiagonalMm()`. "Maximum image circle" datasheet field [B-LENS]. Larger-than-sensor is OK (uses sweet spot [R-LENS]) but flag cost-inefficiency [B-LENS: "large portion unused… smaller lens more cost-efficient"].
3. **FOV@WD → focal length:** `computeFov()` / `focalLengthForFov()` / `workingDistanceForFov()`. Minimum inputs per [R-LENS]: sensor size + mount + WD + horizontal FOV. Standard fixed-focal stock: 4/6/8/12/16/25/35/50/75/100mm [B-LENS].
4. **Resolution match:** `derivePixelPitchUm()` + `nyquistResolutionLpMm()` (=500/pitch µm, =1/(2·pitch) per requirements §3.5) vs lens lp/mm or MP-rating + MTF center-to-edge [B-LENS]. Sniper flags lens-limited vs sensor-limited.
5. **Ground resolution @ WD:** `mmPerPixel()` = FOV_H / pixels_H. Required for inspection/OCR sizing (cf. [R-LENS] truck-OCR @9m/50mm and can-counting @1524mm/8mm worked examples).
6. **Interface / body:** bandwidth/latency/cable/scalability/cost filter [B-IF table + S-IF table]. Board-level (MIPI <30cm, very low latency, very low cost, bad scalability) vs system-level (USB3 5m/5Gbps plug-and-play; GigE/5GigE 100m scalable; CXP 12.5Gbps/ch high-speed; GMSL 6Gbps/20m mobile) — values from [B-IF] comparison table; corroborated by [S-IF] (GigE ~1Gbps/100m/PoE/PTP; USB3 ~5Gbps/~400MBps/3–5m; MIPI multi-Gbps/lane <30–40cm/<10ms/RAW).

## 3. Company categories (verified vs needs-curation)

> "Verified" = already in `src/lib/seedData.ts` with sourceUrl. "Needs-curation" = named in fetched guides but not yet in seed catalog. No Reddit-sourced vendors listed (bot-walled, unverifiable).

| Category | Verified (in seedData, reuse) | Needs-curation before sniper ranking (mentioned in fetched guides only) |
|----------|-------------------------------|--------------------------------------------------------------------------|
| Sensor/chip makers | Sony Semiconductor (IMX264/178/267/392 flyers + Framos IMX267 page as sensor-info reseller) | — (guides discuss sensor formats 1/3"–4/3"/1.1", not chip vendors) |
| Camera bodies / systems | — (seed `mount` is *typical body mount*, not chip property — see LEARNINGS.md; must split Body table in sniper) | Basler (ace 2/dart/boost/racer author of [B-LENS][B-IF]; dart=board, ace 2=versatile); Lucid TRI120S 12MP 1.1" C-mount (cited as example camera in [R-LENS]) |
| Lenses / optics | Computar V1226-MPZ 12mm 1"/16mm-circle; Commonlands CIL532 12mm 2/3", CIL525 25mm 2/3", CIL060 6mm M12 | Edmund Optics (UC 8mm + DG 50mm example lenses + Imaging Lens Wizard in [R-LENS]); Basler lenses/selectors (Lens Selector tool in [B-LENS][R-LENS]); Nikon (F-mount origin [R-LENS]) |
| Tools/references (not products) | — | Edmund Optics Wizard, Basler Lens Selector / Sensor Comparer / Frame Rate Calculator (cited [B-LENS][R-LENS]) — use as UX reference, not catalog source |

Sniper implication: current 8-seed catalog is insufficient for "what should I buy." MUST curate at minimum: Body table (mount + interface + sensor ref), Lens table (f + mount + image circle + lp/mm or MP-rating + MOD + aperture range).

## 4. Industry priority properties (what sniper must capture per segment)

| Segment | Priority props (from evidence) | Sniper filter/sort |
|---------|-------------------------------|--------------------|
| UAV / GSD mapping | WD=altitude, pixel pitch, f → GSD (`mmPerPixel` generalized); vibration/EMC robustness, cable length | MUST: GSD calc + altitude→FOV footprint; SHOULD: flag rolling-shutter/robustness note. *Limitation: the two Commonlands UAV/GSD guides 404'd → no GSD formula evidence from them; reuse thin-lens `mmPerPixel` only.* |
| General CV (conveyor, yard/OCR) | WD + horizontal FOV + sensor + mount → f (the [R-LENS] §"minimum information" quad); light + aperture for OCR detail | MUST: WD+FOV→f solver + ranked lenses; scenario fixtures: 1524mm/1219mm/1/2.3"→~8mm; 9000mm/1.1"→~50mm [R-LENS] |
| Embedded / MIPI | Bandwidth (res×fps×bit-depth + headroom), latency determinism, <30cm cable, ARM/Linux, SoC lanes, RAW vs ISP-processed | MUST: interface filter (MIPI/GMSL vs USB3 vs GigE) with cable/bandwidth guardrails [B-IF][S-IF]; CUT live ISP tuning |
| Inspection / metrology | lp/mm + MTF + pixel-size match; telecentric vs entocentric; DoF vs diffraction; MOD/macro regime | MUST: resolution-limit flag + `computeFovAxis` macro risk; SHOULD: telecentric flag + aperture sweet-spot hint; CUT MTF-curve modeling beyond single lp/mm number |

## 5. Sniper requirements (MUST / SHOULD / CUT — each reuses thin-lens `optics.ts`)

**MUST (buy-list blockers)**
- M1 Fit-chain gate: mount → image-circle → FOV@WD → resolution → interface. Reuse `checkMountCompatibility`, `checkImageCircle` (+`sensorDiagonalMm`), `computeFov`/`focalLengthForFov`/`workingDistanceForFov`, `derivePixelPitchUm`/`nyquistResolutionLpMm`, `mmPerPixel`. Fail = excluded with plain-language reason (vignetting, won't focus, FOV miss).
- M2 Inverse solve + rank: inputs WD + target H-FOV (+sensor or sensor shortlist) → output ranked lenses by FOV error, margin, resolution headroom. Reuse `focalLengthForFov`; snap to stock 4–100mm ladder [B-LENS] with "choose shorter f" rule surfaced.
- M3 Resolution-limit flag: sensor Nyquist vs lens lp/mm-or-MP-rating; state limiting side. Reuse `nyquistResolutionLpMm`. If lens lp/mm unknown → blank+flag, never guess (existing requirements §3.1 rule).
- M4 Macro/MOD honesty: surface `computeFovAxis` risk (`normal/macro/extreme-macro/invalid`) + lens MOD field; recommend macro lens >1:10, microscope ≥5x per [B-LENS] instead of extension-ring hack.
- M5 Interface pre-filter: MIPI (<30cm/RAW/SoC-lanes) vs USB3 (3–5m/plug-and-play) vs GigE (100m/multi-cam/PTP) vs GMSL/CXP options with bandwidth = res·fps·depth + reserve. Values from [B-IF][S-IF] tables.
- M6 Provenance: every spec shows sourceUrl + per-field found/not-found (existing extractor contract); seeds keep Sony/Framos/Computar/Commonlands URLs.

**SHOULD (differentiators, cheap)**
- S1 Cost-efficiency nudge: oversize image-circle OK optically but flagged ("sweet spot" benefit [R-LENS] vs cost penalty [B-LENS]).
- S2 C→CS spacer auto-suggest (+5mm ring) vs CS-on-C hard fail (reuse `checkMountCompatibility` message).
- S3 Aperture/DoF hint: f-number range + "avoid extremes (diffraction vs thin DoF)" [B-LENS][R-LENS]; no DoF calculator.
- S4 Scenario fixtures as regression tests: the two [R-LENS] worked examples (§4 table).
- S5 Split Body vs Chip tables (mount + interface live on Body; LEARNINGS.md debt).

**CUT (explicitly out — prevents scope creep)**
- C1 Bulk catalog crawling, live vendor APIs, price/availability (existing requirements §6 carries over).
- C2 MTF-curve / distortion / aberration modeling beyond single lp/mm (existing §6; [B-LENS] MTF is center-to-edge curve — sniper stores at most one number + link).
- C3 Depth-of-field calculator, bokeh, spectral/IR co-optimization beyond a flag (existing §6; [B-LENS] spectral section = flag only).
- C4 OCR/image pipelines, multi-user/cloud, mobile-first (existing §5–6).
- C5 Telecentric measurement mode beyond a type flag ([B-LENS]/[R-LENS] describe telecentric as special-type; thin-lens funcs don't cover it).

## 6. Assumptions (each paired with fetched evidence — no fabrication)

- A1 Thin-lens `FOV=sensor·(WD−f)/f` suffices for sniper ranking; flag macro regimes rather than modeling thick-lens/MOD physics. Evidence: [B-LENS] standard-lens sweet spot 1:1–1:10 + macro/microscope escalation rule; repo `optics.ts` risk comments state approximation degrades with m.
- A2 10%-of-diagonal "tight" margin is judgment, not standard. Evidence: repo `checkImageCircle` comment; vendor guides only state binary cover/vignette rule ([B-LENS][R-LENS]), so margin threshold is ours to keep.
- A3 Fixed-focal stock ladder + "round down f" is the ranking snap rule. Evidence: [B-LENS] "Common values 4…100mm… choose shorter focal length" verbatim.
- A4 Minimum viable inputs = sensor size + mount + WD + H-FOV. Evidence: [R-LENS] "once you know sensor size, mount, WD, horizontal FOV you are equipped with minimum information to select a lens."
- A5 Interface numbers used for filters: MIPI <30cm/1–4.5Gbps-per-lane/very-low latency; GMSL2 6Gbps/20m; USB3 5Gbps/5m; GigE 1Gbps/100m; CXP 12.5Gbps/ch [B-IF table]; GigE ~1Gbps/125MBs, USB3 ~5Gbps/~400MBps practical, MIPI <10ms/<40cm/RAW [S-IF]. Treat as filter thresholds with headroom, not guarantees — [B-IF] warns "bandwidth calculated too tightly" is the top mistake.
- A6 Oversize image circle = optically safe, economically wasteful. Evidence: [R-LENS] "sweet spot" benefit + [B-LENS] "smaller lens more cost-efficient" — sniper warns, doesn't fail.
- A7 Adapter policy: C-on-CS +spacer OK; CS-on-C fail; other cross-family = fail/verify-mechanically. Evidence: flange distances C 17.526 vs CS 12.526 [R-LENS][B-LENS] + repo `checkMountCompatibility` semantics; [R-LENS] "adapters may introduce light leaks/misalignment… only when necessary."

## 7. Evidence ledger + limitations

- Fetched OK (cite): `baslerweb.com/en/learning/lens-selection/` [B-LENS]; `blog.roboflow.com/how-to-choose-a-lens-for-machine-vision/` [R-LENS]; `baslerweb.com/en-sg/learning/interface-embedded/` [B-IF]; `dev.to/siliconsignals_ind/…gige-vs-usb3-vs-mipi…` [S-IF].
- Failed (do NOT cite): both `commonlands.com/blogs/technical/sensor-size-lens-compatibility` and `…/drone-mapping-photogrammetry-lenses` returned HTTP 404 on fetch → UAV/GSD math in §4 falls back to repo `mmPerPixel`; needs fresh UAV source before GSD promises harden.
- Not citable: Reddit threads (bot challenge body) — pains above use vendor-guide proxies only.
- Repo facts re-derived: `src/lib/optics.ts` (7 exported funcs reused in §5), `src/lib/types.ts` (MountType/Sensor/Lens), `src/lib/seedData.ts` (4 Sony sensors + 4 Computar/Commonlands lenses), `docs/requirements.md` §3–6, `docs/LEARNINGS.md` (mount-on-sensor debt, tight/macro judgment calls, unverified LLM+browser gaps).

**Handoff action:** approve M1–M6 + Body/Chip split (S5) as sniper v1; curate Body + Lens tables with MOD + lp/mm + interface columns; add the two [R-LENS] scenarios as unit/regression fixtures; re-source UAV/GSD evidence to replace the 404'd guides.
