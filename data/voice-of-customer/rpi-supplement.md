# Raspberry Pi forums VoC supplement — 10 threads (Scrapling StealthyFetcher)

Source (fetched live 2026-09-26, all HTTP 200 after Cloudflare Turnstile
307→200 solved):

- `https://forums.raspberrypi.com/viewforum.php?f=43` (Camera board, 16
  listing pages) → candidate topics filtered by lens/mount/cable/FOV keywords
- `https://forums.raspberrypi.com/viewtopic.php?t=<id>` per thread (title +
  first-post date + first-post body verified live)

Fetcher: `StealthyFetcher.fetch(..., headless=True, disable_resources=True,
network_idle=True, timeout=30000, solve_cloudflare=True)` — no custom
User-Agent (auto-stealth). Dates are the first post's `p.author` date
(topic creation). URLs are canonical `viewtopic.php?t=<id>` (no `sid`).

## Camera + lens selection (4)

### rpi396825

- **Title:** Camera & Lens selection for 10m laser targeting (6cm target) with Pi 5
- **URL:** https://forums.raspberrypi.com/viewtopic.php?t=396825
- **Date:** 2026-03-12
- **Pain:** Builder needs CSI camera + lens to resolve a 6 cm target at
  10 m for a competition UGV — no calculator connects focal length, sensor,
  and working distance to "will I see it".

### rpi389713

- **Title:** Picking the right lens
- **URL:** https://forums.raspberrypi.com/viewtopic.php?t=389713
- **Date:** 2025-07-08
- **Pain:** HQ camera (IMX477) + 6 mm lens can't measure sub-mm gaps on an
  11 mm medical device — buyer underestimated optics and now hunts a lens
  upgrade for metrology accuracy.

### rpi381840

- **Title:** Flat-field focus lens recommendations?
- **URL:** https://forums.raspberrypi.com/viewtopic.php?t=381840
- **Date:** 2025-01-02
- **Pain:** Book scanner needs an A4 sheet sharp edge-to-edge from 300 mm —
  phone lenses blur edges (curved focus plane), and suitable flat-field
  C/CS lenses (Tamron M118 series) have no retail channel in India.

### rpi393090

- **Title:** Which camera confirms to the specified parameters
- **URL:** https://forums.raspberrypi.com/viewtopic.php?t=393090
- **Date:** 2025-10-23
- **Pain:** Super 8 digitizer needs >4K on a 5×4 mm frame at 15–25 mm focus
  distance — "which Pi camera + board meets these numbers" has no
  filterable answer, so selection becomes a forum post.

## Mounts / adapters (3)

### rpi400640

- **Title:** Rpi HQ camera module, cs-Mount lens holder
- **URL:** https://forums.raspberrypi.com/viewtopic.php?t=400640
- **Date:** 2026-09-09
- **Pain:** Second-hand HQ camera came with an M12 mount; no CS-mount holder
  fits its 25 mm hole spacing — mount-variant fragmentation turns a used
  bargain into a mechanical project.

### rpi395856

- **Title:** Did the HQ cam lens mount change? (no it didn't)
- **URL:** https://forums.raspberrypi.com/viewtopic.php?t=395856
- **Date:** 2026-01-31
- **Pain:** Newer HQ camera's two-piece lens mount looks like one solid part
  and won't separate by hand — silent hardware revision (real or perceived)
  leaves users reaching for pliers and glue.

### rpi391378

- **Title:** 16 mm telephoto lens C/CS Adapter
- **URL:** https://forums.raspberrypi.com/viewtopic.php?t=391378
- **Date:** 2025-08-28
- **Pain:** HQ camera + 16 mm telephoto only focuses inches away — wrong
  C/CS adapter ring thickness (10 mm vs 5 mm) silently breaks back-focus,
  and nothing in the bundle flags it.

## FOV / working distance (2)

### rpi395080

- **Title:** Considering full frame ultra wide angle lenses
- **URL:** https://forums.raspberrypi.com/viewtopic.php?t=395080
- **Date:** 2026-01-02
- **Pain:** Buyer wants a 35 mm-equivalent wide view via full-frame lenses +
  C-mount adapters but can't predict the 5.5× crop outcome — adapter stack
  math defeats "will this give me the FOV I want".

### rpi387864

- **Title:** 120 fps with full FoV
- **URL:** https://forums.raspberrypi.com/viewtopic.php?t=387864
- **Date:** 2025-05-14
- **Pain:** Legacy MMAL stack gave 120 fps at full FoV; after reflashing, the
  libcamera path crops in — high-fps sensor modes silently trade away
  field of view with no per-mode FOV table.

## Cables / extenders (1)

### rpi389366

- **Title:** longer than 500mm ribbon cable
- **URL:** https://forums.raspberrypi.com/viewtopic.php?t=389366
- **Date:** 2025-06-27
- **Pain:** 500 mm CSI flex is too short for a robot-head Camera Module 3
  (needs 800–1000 mm) — MIPI length limits force HDMI/extension-kit
  workarounds that no official cable lineup covers.
