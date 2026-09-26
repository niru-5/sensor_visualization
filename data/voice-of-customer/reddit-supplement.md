# Reddit VoC Supplement — 10 threads via Firecrawl search (Arctic Shift title-search missed these)

Discovery: Firecrawl `search` endpoint (JS SDK @mendable/firecrawl-js v4.41.0),
crawled 2026-09-26 (`crawled_at` UTC). Queries: `reddit raspberry pi camera
lens selection M12 CS mount`, `reddit machine vision camera selection global
shutter`, `reddit USB camera vs MIPI CSI embedded vision`, `reddit Arducam
autofocus focus problems`, `reddit raspberry pi HQ camera DSLR lens`
(each `limit: 10`; reddit.com thread URLs + titles + snippets returned live).

Firecrawl `scrape` could NOT reach reddit threads directly: both
`www.reddit.com/...` and `old.reddit.com/...` scrape calls were refused with
"We apologize for the inconvenience but we do not support this site"
(recorded 2026-09-26; subreddit search pages share the same host policy, so
they were not attempted separately). Per the tool ladder (direct APIs first),
Reddit single-thread `.json` was tried next and returned HTTP 403 for all 12
probed threads (consistent with UNSCRAPABLE.md §2a). Thread metadata below
(`created_utc` dates, verbatim permalinks, OP selftext) was therefore
completed via the Arctic Shift mirror's single-token `query` + `subreddit`
lookup path (cf. UNSCRAPABLE.md §2b) — discovery credit stays with Firecrawl
search, which surfaced threads the earlier Arctic Shift *title* search missed.

No overlap with `reddit.md` (checked all 12 IDs: none of the below appear there).

## r/raspberry_pi (5)

### r-raspberry_pi-12x86n0

- **Title:** Raspberry Pi Camera HQ and DSLR Lenses
- **URL:** https://www.reddit.com/r/raspberry_pi/comments/12x86n0/raspberry_pi_camera_hq_and_dslr_lenses/
- **Date:** 2023-04-24
- **Pain:** Wants to adapt a Canon/Nikon DSLR prime (e.g. Canon 24mm pancake +
  EF→CS adapter) to the HQ camera for better edge distortion than C/CS-mount
  lenses, but can't convert focal length to the Pi's small sensor or judge
  whether a several-hundred-$$ lens is worth it — crop-factor math blocks the upgrade.

### r-raspberry_pi-12dt3jc

- **Title:** Can I replace the Raspberry Pi HQ Camera M12 lens holder?
- **URL:** https://www.reddit.com/r/raspberry_pi/comments/12dt3jc/can_i_replace_the_raspberry_pi_hq_camera_m12_lens/
- **Date:** 2023-04-06
- **Pain:** Stock M12 holder is "unnecessarily huge" but board pitch (~25 mm)
  doesn't match common 20/22 mm off-the-shelf holders — mechanical
  compatibility info is missing, user begs for a part number or printable STL.

### r-raspberry_pi-1br9mfu

- **Title:** Can I put a M12 lens on an autofocus camera?
- **URL:** https://www.reddit.com/r/raspberry_pi/comments/1br9mfu/can_i_put_a_m12_lens_on_an_autofocus_camera/
- **Date:** 2024-03-30
- **Pain:** Wants to combine the M12 lens ecosystem with an autofocus camera
  body; OP body was `[removed]` at crawl time, so only the title-level
  compatibility question is evidenced — mount/body interchangeability is unclear.

### r-raspberry_pi-1er788d

- **Title:** M12 Lens Recommendations for Raspberry Pi HQ Camera for Cloud Classification Project
- **URL:** https://www.reddit.com/r/raspberry_pi/comments/1er788d/m12_lens_recommendations_for_raspberry_pi_hq/
- **Date:** 2024-08-13
- **Pain:** Needs an application-specific M12 recommendation (sky/cloud
  classification on HQ camera); OP body was `[removed]` at crawl time, so only
  the title-level ask is evidenced — buyers crowdsource because no parametric
  lens picker covers use-case → focal length → model.

### r-raspberry_pi-1m0kw6a

- **Title:** Arducam 64MP camera lens replacement?
- **URL:** https://www.reddit.com/r/raspberry_pi/comments/1m0kw6a/arducam_64mp_camera_lens_replacement/
- **Date:** 2025-07-15
- **Pain:** Wants to strip the stock AF lens assembly and fit an M12 mount for
  a manual-focus fisheye; forum posts "all seem to dead-end when results are
  brought up" — mod path is rumored but never documented to success.

## r/computervision (5)

### r-computervision-1svi4dk

- **Title:** need a large sensor camera with interchangeable lenses- price is not an issue, global shutter- help
- **URL:** https://www.reddit.com/r/computervision/comments/1svi4dk/need_a_large_sensor_camera_with_interchangeable/
- **Date:** 2026-04-25
- **Pain:** Dash/windshield mount needs large sensor (for night sensitivity,
  not resolution) + ~65–70 mm interchangeable lens + easy 2 fps Python grab
  with day-to-night autoexposure, light weight; even with unlimited budget the
  intersection is unsearchable.

### r-computervision-1t73a6v

- **Title:** What to look for when choosing camera for my use case?
- **URL:** https://www.reddit.com/r/computervision/comments/1t73a6v/what_to_look_for_when_choosing_camera_for_my_use/
- **Date:** 2026-05-08
- **Pain:** Self-described noob scaling from phone-cam bottlecap presence
  checks (10–12k bottles/hour) to in-line defect inspection (misaligned,
  chipped, damaged caps); asks whether a specific MindVision Alibaba listing
  is viable — spec-sheet → line-rate suitability is unjudgeable alone.

### r-computervision-1ukff19

- **Title:** Camera hardware suggestion : Raspberry Pi vs ELP USB Camera
- **URL:** https://www.reddit.com/r/computervision/comments/1ukff19/camera_hardware_suggestion_raspberry_pi_vs_elp/
- **Date:** 2026-07-01
- **Pain:** Metal-defect vision needs manual/software control of focus,
  aperture, zoom, exposure + polarizer support; torn between HQ camera + 16 mm
  lens (unbuyable in India) and ELP USB camera (unknown exposure control, USB
  3.0 transfer ceiling) — interface-vs-control trade-off plus regional stockout.

### r-computervision-1vcoeut

- **Title:** Advise Need: Specific Computer Vision Lenses?
- **URL:** https://www.reddit.com/r/computervision/comments/1vcoeut/advise_need_specific_computer_vision_lenses/
- **Date:** 2026-08-01
- **Pain:** High-res photo-sphere rig (Basler ace 2, 1.1" sensor): researched
  lenses at length, each fails one criterion (resolution or FOV); asks whether
  the requirement is near physical limits and which parameter to relax (e.g.
  change mount → different cameras) — multi-constraint lens selection has no tooling.

### r-computervision-1vq21dk

- **Title:** I can't find cameras in stock
- **URL:** https://www.reddit.com/r/computervision/comments/1vq21dk/i_cant_find_cameras_in_stock/
- **Date:** 2026-08-16
- **Pain:** Simple single-camera CV/slo-mo on Raspi 5: wanted the Raspi global
  shutter camera, then hunted an IMX273 unit that wasn't backordered for
  "weeks" — supply chain can't keep up with CV demand; selection must include
  live availability, not just specs.
