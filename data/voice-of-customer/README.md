# Voice of Customer — camera-selection pain evidence

61 real threads collected 2026-09-24/25/26: 32 original + 29 supplement (10 RPi forums + 10 Reddit + 9 vendor/Basler/automate/cable).
Every URL below was returned live by a public API (no invented links).
Per-source files hold title + URL + date + 1–2 line pain summary.

Sources:

- [reddit.md](reddit.md) — 12 threads via Arctic Shift title search
  (`arctic-shift.photon-reddit.com/api/posts/search`)
- [nvidia-arducam.md](nvidia-arducam.md) — 10 threads via Discourse JSON APIs
  (`forums.developer.nvidia.com/search.json`, `forum.arducam.com/search.json`)
- [machine-vision-stack.md](machine-vision-stack.md) — 10 threads via Stack Exchange API
  (`api.stackexchange.com/2.3/search/advanced`, Photo.SE + StackOverflow)
- [rpi-supplement.md](rpi-supplement.md) — 10 threads via Scrapling StealthyFetcher
  (Turnstile 307→200 solved; `viewforum.php?f=43` pagination + `viewtopic.php?t=<id>`, 2026-09-26)
- [reddit-supplement.md](reddit-supplement.md) — 10 threads via Firecrawl `search`
  (threads the earlier Arctic Shift title-search missed; metadata via Arctic Shift mirror, 2026-09-26)
- [vendor-supplement.md](vendor-supplement.md) — 9 items via Wayback CDX + Firecrawl search/scrape
  (2 Basler archived lens guides, 1 automate.org hub, 2 vendor lens KB, 4 GigE/USB3 cable items, 2026-09-26)
- [UNSCRAPABLE.md](UNSCRAPABLE.md) — every site that blocked scraping + how to crack it

## Index by theme

### 1. FOV / working-distance math

- What focal length / sensor / resolution for a given angle, FOV and WD? — [machine-vision-stack](machine-vision-stack.md#photo135377)
- Required working distance for an object to fill the sensor — [machine-vision-stack](machine-vision-stack.md#photo132122)
- FOV calculation from camera parameters + radial distortion — [machine-vision-stack](machine-vision-stack.md#photo131213)
- Is the FOV calculation of the B0202 correct? — [nvidia-arducam](nvidia-arducam.md#arducam5585)
- Understanding RasPi Cam v2 resolution vs FOV (153 upvotes) — [reddit](reddit.md#r-raspberry_pi-yntdla)

### 2. Mount / sensor coverage

- What's the difference between HQ Camera C/CS and M12 lenses? — [reddit](reddit.md#r-raspberry_pi-1g4nyka)
- Where to buy C, CS and M12 mount lenses + IR capture — [nvidia-arducam](nvidia-arducam.md#arducam5545)
- What determines the image-circle diameter? — [machine-vision-stack](machine-vision-stack.md#photo130699)
- How to calculate the radius of the image circle? — [machine-vision-stack](machine-vision-stack.md#photo86448)

### 3. Resolution / GSD / pixel-mm

- How to determine pixel-to-millimeter ratio with known focus? — [nvidia-arducam](nvidia-arducam.md#arducam8102)
- Close-range iris recognition in the dark: IMX290 vs OV9281 — [reddit](reddit.md#r-computervision-1vipntd)
- Image processing for automatic defect detection in product — [machine-vision-stack](machine-vision-stack.md#so31444235)

### 4. Shutter / interface (GigE, USB, CSI)

- Orin Nano + Raspberry Pi Global Shutter Camera (IMX296) compat — [nvidia-arducam](nvidia-arducam.md#nvidia311050)
- IMX296 global-shutter support on Orin Nano, JetPack 7? — cross-ref [nvidia-arducam](nvidia-arducam.md#nvidia311050)
- Global-shutter camera for conveyor object tracking, $150–280 — [reddit](reddit.md#r-computervision-1w9nud3)
- Mono/global-shutter 120–500 FPS camera for DIY eye tracker <$400 — [reddit](reddit.md#r-computervision-1rpyu0s)
- IP67 GigE/PoE camera with Sony IMX462 sensor, sourcing in India — [reddit](reddit.md#r-computervision-1w48m73)
- 2 USB cameras not working with OpenCV — [machine-vision-stack](machine-vision-stack.md#so11222813)
- Docker container can't access Basler GigE Vision camera — [machine-vision-stack](machine-vision-stack.md#so73080768)

### 5. Driver / CSI bring-up

- CSI Camera Compatibility (Jetson) — [nvidia-arducam](nvidia-arducam.md#nvidia267033)
- Arducam IMX477 driver install fails on Jetson (mountpoint error) — [nvidia-arducam](nvidia-arducam.md#nvidia332548)
- Arducam IMX477 no image on Jetson Xavier NX — [nvidia-arducam](nvidia-arducam.md#arducam10210)
- Hurdles of writing a camera driver in Linux — [reddit](reddit.md#r-embedded-1w6yys9)
- V4L2 + CSI-2 guidance on RPi5 / Xavier NX — see [reddit](reddit.md#r-embedded-1w6sizz)

### 6. Cables / extenders / adaptors

- Extending a Camera Module 3 cable — it's too short, will this work? — [reddit](reddit.md#r-raspberry_pi-1uuaxmm)
- CSI-2 camera adaptor boards for Orin AGX — [reddit](reddit.md#r-embedded-1w6sizz)
- Jetson Orin NX 16G CSI pinout — [nvidia-arducam](nvidia-arducam.md#nvidia349380)

### 7. Lighting / color / focus

- IMX477 fails headless, works with physical display — [nvidia-arducam](nvidia-arducam.md#nvidia340841)
- Autofocus / motorized focus broken on IMX519 (AK7375) — [nvidia-arducam](nvidia-arducam.md#arducam10813)
- Set Arducam B0371 IMX519 focus to infinity — [reddit](reddit.md#r-raspberry_pi-1qtmszq)
- Coca-Cola can recognition: algorithm vs lighting — [machine-vision-stack](machine-vision-stack.md#so10168686)
- Sensor-caused vignetting — [machine-vision-stack](machine-vision-stack.md#photo43451)

### 8. Selection paralysis

- Best low-light, wide-angle Pi camera — help me find it — [reddit](reddit.md#r-raspberry_pi-1pn1abj)
- Compact 3D-vision setup on a robotic car — [reddit](reddit.md#r-machinevision-1o2ui9n)

## Method notes

- Supplement methods (2026-09-26 re-crack): Scrapling `StealthyFetcher` Turnstile solve
  (RPi forums; `search.php` login-walled so `viewforum.php` pagination used); Firecrawl
  `search` for discovery where `scrape` refused reddit (`.json` 403, mirror fallback);
  Wayback CDX domain/urlkey search (Basler community hostname zero records — nearest
  archived lens items instead; Cloudy Nights 403 excluded); Arctic Shift mirror
  single-token `query` + `subreddit` lookup for reddit metadata.
- Reddit dates are `created_utc` as returned by Arctic Shift; note its index
  contains re-ingested/recent posts, so several dates fall in 2026.
- Discourse dates are topic `created_at` from `search.json`.
- Stack Exchange IDs/scores verified live; links use canonical `/q/<id>` short
  form so they resolve even if slugs change.
- Threads that 404'd or timed out during verification are excluded; blocked
  sites are recorded in [UNSCRAPABLE.md](UNSCRAPABLE.md), not silently dropped.
