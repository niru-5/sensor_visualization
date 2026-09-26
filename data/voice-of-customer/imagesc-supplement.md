# Image.sc Forum VoC supplement — 10 threads (Scrapling Fetcher.get, Discourse JSON API)

Forum: **Image.sc Forum** (`https://forum.image.sc`, Discourse —
"Image.sc Forum"). Note: despite the brief's "astrophotography" label,
this is the **scientific bioimaging** community (ImageJ/Fiji, OMERO,
Micro-Manager, CellProfiler); there is no astrophotography section.
Basler-relevant discussion lives almost entirely in **Usage & Issues**
(`/c/usage-issues/7`, ~18k topics — Micro-Manager hardware-setup
questions) with overflow in **Development** (`/c/development/5`, device
adapters) and **Image Analysis** (`/c/image-analysis/6`, sensor/FOV and
lens/optics matching questions).

Source (fetched live 2026-09-26, all HTTP 200 via plain `Fetcher.get` —
no Cloudflare/WAF wall encountered, so `StealthyFetcher` and Firecrawl
were not needed):

- `https://forum.image.sc/` (homepage, 200 — confirms Discourse software)
- `https://forum.image.sc/categories.json` (category map + topic counts)
- `https://forum.image.sc/search.json?q=<basler|camera|lens terms>`
  (site search; queries: `basler`, `basler camera`,
  `camera recommendation microscopy`, `which camera micro-manager`,
  `c-mount lens`, `tube lens camera`, `FLIR Blackfly lens`,
  `camera pixel size FOV`)
- `https://forum.image.sc/t/<id>.json` per thread (title + `created_at`
  + first-post body verified live)

Fetcher: `Fetcher.get(...)` against the Discourse JSON API — no custom
User-Agent. Dates are each topic's `created_at` (topic creation). URLs
are canonical `https://forum.image.sc/t/<slug>/<id>`. Note: the dominant
Basler pain is not optics but **Micro-Manager ↔ Pylon driver pairing**
("BaslerPylon unavailable" across Pylon 6/7/8 and MM 2.0) plus
long-uptime disconnects and multi-camera limits; the lens-selection
signal sits in the C-mount/optics and camera-recommendation threads at
the end.

## Basler ↔ Micro-Manager setup / compatibility (5)

### imagesc87608

- **Title:** Basler Pylon Unavailable
- **URL:** https://forum.image.sc/t/basler-pylon-unavailable/87608
- **Date:** 2023-10-18
- **Pain:** New µManager 2.0 user with a Basler AcA2440-35mm + Prior stage
  sees "BaslerPylon unavailable" in the Hardware Configuration Wizard
  even after reinstalling/downgrading Pylon to 7.1 — the documented
  Basler↔Micro-Manager path silently fails, blocking first light.

### imagesc51786

- **Title:** Basler acA-2040-90um micro-manager compatibiliity
- **URL:** https://forum.image.sc/t/basler-aca-2040-90um-micro-manager-compatibiliity/51786
- **Date:** 2021-04-21
- **Pain:** New acA-2040-90um works in Pylon 6 and the Basler.pylon DLL is
  present in Micro-Manager, yet no Basler configuration appears in the
  wizard — buyer followed Basler's own µManager guide and still has no
  working combination to check before purchase.

### imagesc60274

- **Title:** Can't get micro-manager recognize Basler ace acA1920-40um camera
- **URL:** https://forum.image.sc/t/cant-get-micro-manager-recognize-basler-ace-aca1920-40um-camera/60274
- **Date:** 2021-11-22
- **Pain:** New monochrome USB ace (acA1920-40um) invisible to MM 2.0 on
  both Win-32/Pylon 6.1 and Win-64/Pylon 6.3 — "Baslerpylon is disabled
  on the device menu", so OS-bitness × Pylon-version matrix decides
  usability and none of it is on the datasheet.

### imagesc68660

- **Title:** Issue with Hardware Configuration of Basler Camera in Micro-Manager
- **URL:** https://forum.image.sc/t/issue-with-hardware-configuration-of-basler-camera-in-micro-manager/68660
- **Date:** 2022-06-23
- **Pain:** acA3088-57uc streams fine in Pylon 6.3.0 but shows as
  "BaslerPylon (unavailable)" in Micro-Manager 2.0 — fourth independent
  report of the same failure mode, i.e. a systematic selection risk for
  any buyer planning a µManager-based rig.

### imagesc79843

- **Title:** Multiple Basler Camera
- **URL:** https://forum.image.sc/t/multiple-basler-camera/79843
- **Date:** 2023-04-13
- **Pain:** First Micro-Manager instance drives its Basler fine under
  Pylon 7.1 but a second instance throws in the Basler driver — unclear
  whether multi-camera-per-PC is even supported, which kills
  stereo/dual-view purchase plans.

## Basler reliability / software-matrix (2)

### imagesc113646

- **Title:** Basler Camera Random Disconnects After Long Uptime (GStreamer) – Anyone Found a Solution?
- **URL:** https://forum.image.sc/t/basler-camera-random-disconnects-after-long-uptime-gstreamer-anyone-found-a-solution/113646
- **Date:** 2025-06-16
- **Pain:** Two Baslers per Jetson Xavier drop randomly after 7+ hours on
  dedicated Ethernet/GStreamer pipelines while other brands stay up —
  long-duration multi-camera buyers can't tell firmware/SDK fault from
  setup fault before committing.

### imagesc111299

- **Title:** "The camera is not initialized" Basler Microscopy Software error message with 2 Basler approved cameras
- **URL:** https://forum.image.sc/t/the-camera-is-not-initialized-basler-microscopy-software-error-message-with-2-basler-approved-cameras/111299
- **Date:** 2025-04-12
- **Pain:** Two new USB3 Baslers (acA1300-200uc, puA1280-54um) stream in
  Pylon 8 Viewer yet Basler's own microscopy software rejects both as
  "not initialized" — even "Basler approved" bodies are a compatibility
  lottery across Basler's own software stack. (Same buyer/setup also
  reported on the SharpCap forum.)

## Basler focus / optics behavior (1)

### imagesc93389

- **Title:** Basler camera going out of focus due to bright particles
- **URL:** https://forum.image.sc/t/basler-camera-going-out-of-focus-due-to-bright-particles/93389
- **Date:** 2024-03-11
- **Pain:** Ace A2440-35um mosaic over fluorescent particles on filter
  paper drifts out of focus whenever the FOV moves from dark to
  particle-dense areas — autofocus/lens behavior on low-contrast scenes
  decides whether the camera works for the application, and only a forum
  reveals it.

## Camera + lens selection (2)

### imagesc109934

- **Title:** Recommendations for Microscope Cameras for Brightfield Microscopy
- **URL:** https://forum.image.sc/t/recommendations-for-microscope-cameras-for-brightfield-microscopy/109934
- **Date:** 2025-03-12
- **Pain:** Brightfield buyer shortlists Moticam S6/S20 but finds zero
  example images or usability reports — no sample-image library exists
  to compare shortlisted models, so selection becomes a forum post.

### imagesc114067

- **Title:** Out-of-focus issue with a moving camera
- **URL:** https://forum.image.sc/t/out-of-focus-issue-with-a-moving-camera/114067
- **Date:** 2025-06-26
- **Pain:** FLIR Blackfly S BFS-U3-200S6M-C + 25 mm HP-series C-mount lens
  on a vertical actuator must hold 1–2 mm insects sharp with a single
  focus preset, but trunk curvature shifts working distance mid-run —
  fixed-focal C-mount depth-of-field vs working-distance trade-off was
  never calculated before the rig was built.

## Method

- Tool ladder: `Fetcher.get` (Scrapling, no stealth) succeeded first try
  on homepage + categories.json + 8 search queries + 12 topic JSONs (all
  HTTP 200, 2026-09-26T21:0xZ). Verdicts: `Fetcher.get` = ok (22/22);
  `StealthyFetcher` = not needed; Firecrawl = not needed (key present
  but unspent — no wall to justify credits). `crawled_at`:
  2026-09-26T21:05:00Z.
- robots.txt checked (`/robots.txt` allows topic/search paths for
  generic agents; forum-search and topic JSON endpoints used, 2 s
  backoff between requests, no bulk crawl).
- Excluded: T44241 (MM-compatible cooled camera — FLIR-centric, no
  Basler/lens-selection content), T94136 (pixel-size/FOV math Q&A, no
  camera purchase decision), lens-`selection` hits that turned out to be
  ImageJ ROI-selection terminology (T83651, T895, T32504 — false
  positives of the word "selection").
- Nothing invented: every title/URL/date/body above was returned live
  from the Discourse API; canonical URLs use the topic slug + id.
