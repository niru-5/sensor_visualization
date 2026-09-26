# Vendor / Basler / Automate VoC supplement — 9 items (2026-09-26 re-crack)

Follow-up to [UNSCRAPABLE.md](UNSCRAPABLE.md) §3 (Basler community),
§4a (vendor WAF), §4b (automate.org), §5 (SERP CAPTCHAs).
Tools: Wayback CDX API (free) + Firecrawl search/scrape
(`FIRECRAWL_API_KEY` in `.env.local`), direct-fetch URL verification.
Every URL below was returned live by one of those surfaces on 2026-09-26;
nothing invented. Format mirrors the other per-source files:
title + URL + date + 1–2 line pain/selection summary.

## A. Basler retired community → Wayback CDX (2)

Source: `https://web.archive.org/cdx/search/cdx`
(queried live 2026-09-26; `matchType=domain`, `filter=urlkey:…`).
No dedicated community/forum host (`community.`/`forum.`) exists in the
archive — the retired community left no separate hostname behind, so the
closest archived lens-selection items are recorded instead (see dead ends).

### basler-lens-selecting-easy-way

- **Title:** Selecting a Lens — The Easy Way to Make the Right Choice
- **URL:** https://www.baslerweb.com/en/company/news-press/news/selecting-a-lens-the-easy-way-to-make-the-right-choice/10247/
- **Date:** 8× HTTP-200 captures 2020-08-06 → 2022-08-18 (CDX); snapshot title re-verified 2026-09-26
- **Pain:** Basler's own lens-selection guide funnels readers into its Lens
  Selector tool — buyers who don't already know focal length / sensor /
  mount can't self-serve the choice from specs alone.

### basler-vision-campus-expert-tips-lens

- **Title:** Vision Campus Video: Expert Tips to Find the Right Lens for a Vision System
- **URL:** https://www.baslerweb.com/cn/company/news-press/news/vision-campus-video-expert-tips-to-find-the-right-lens-for-a-vision-system/382528/
- **Date:** HTTP-200 capture 2021-04-14 (CDX; Chinese-locale URL, no EN capture for this slug)
- **Pain:** A whole expert video is needed to explain lens choice — working
  distance, sensor coverage and mount must be reasoned about jointly, which
  is exactly the multi-input calculation a selection tool should do.

## B. automate.org via Firecrawl scrape (1)

Source: `app.scrape('https://www.automate.org/vision')`, 2026-09-26 (≈8.6 k chars markdown).

### automate-a3-vision-hub

- **Title:** A3 Vision & Imaging (Association for Advancing Automation hub)
- **URL:** https://www.automate.org/vision
- **Date:** live hub page, scraped 2026-09-26 (no article date; content: GigE Vision Standard v3.0, CVP certification)
- **Pain:** The association's hub answers "which standard / which training"
  (GigE Vision v3.0, Certified Vision Professional) — interface and
  competence questions buyers otherwise resolve by hearsay.

## C. Vendor knowledge-base lens-selection guidance (2)

Both scraped live via Firecrawl `app.scrape` (markdown) on 2026-09-26;
section headings verified in the returned bodies.

### basler-learning-lens-selection

- **Title:** How to Choose the Right Lens for Your Camera (Basler Learning)
- **URL:** https://www.baslerweb.com/en-us/learning/lens-selection/
- **Date:** live KB page, scraped 2026-09-26 (≈16.8 k chars; sections: mounts/flange distance, image-circle vs sensor, resolution/MTF, focal-length × sensor-size)
- **Pain:** The canonical vendor checklist — mount, image circle, MTF/resolution,
  focal length vs sensor size — is spread across prose sections; buyers must
  hand-combine four sub-decisions with no joint calculator.

### edmund-focal-length-fov

- **Title:** Understanding Focal Length and Field of View (Edmund Optics app note)
- **URL:** https://www.edmundoptics.com/knowledge-center/application-notes/imaging/understanding-focal-length-and-field-of-view/
- **Date:** live app note, scraped 2026-09-26 (≈27.6 k chars; sections: using WD + FOV to determine focal length, fixed-magnification FOV math)
- **Pain:** The worked WD↔FOV↔focal-length formulas buyers need are buried in
  an app note — the exact math a FOV/working-distance calculator should expose.

## D. GigE / USB3 cable-length pain via Firecrawl search (4)

Source: `app.search` (limit 5 each), 2026-09-26. URLs re-verified live the
same day (HTTP status noted); snippets are Firecrawl's, dates unknown unless noted.

### teledyne-usb3-working-distance

- **Title:** Extending the Working Distance of USB 3.1 Cameras (Teledyne application note)
- **URL:** https://www.teledynevisionsolutions.com/support/support-center/application-note/iis/extending-the-working-distance-of-usb-3.1-cameras
- **Date:** date unknown; found via Firecrawl search 2026-09-26, URL verified HTTP 200 same day
- **Pain:** Vendor's own tests: USB3 cables longer than 5 m are "less
  reliable" (common lengths 0.3–1.8 m) — placement distance silently
  constrains the interface choice, with no guidance at selection time.

### zwo-max-usb3-cable

- **Title:** Max USB3 cable length? (ZWO user forum thread)
- **URL:** https://bbs.zwoastro.com/d/6660-max-usb3-cable-length
- **Date:** date unknown; found via Firecrawl search 2026-09-26, URL verified HTTP 200 same day
- **Pain:** 3 m is the recommended USB3 maximum; a 1.5 m extension on top of
  3 m fails depending on cable quality and ports — length limits are
  trial-and-error, not specified.

### ni-gige-corrupted-images

- **Title:** GigE Vision images sometimes corrupted (NI Community thread)
- **URL:** https://forums.ni.com/t5/Machine-Vision/GigE-Vsion-images-sometimes-corrupted/td-p/2037614
- **Date:** date unknown; found via Firecrawl search 2026-09-26, URL verified HTTP 200 same day
- **Pain:** Dropped GigE data under CPU load points at NIC/drivers, not the
  camera — buyers debug the wrong layer because interface throughput
  requirements are never stated up front.

### teledyne-robust-gige

- **Title:** Designing a Robust GigE Vision Camera System (Teledyne learning center)
- **URL:** https://www.teledynevisionsolutions.com/learn/learning-center/machine-vision/designing-a-robust-gige-vision-camera-system/
- **Date:** date unknown; found via Firecrawl search 2026-09-26, URL verified HTTP 200 same day
- **Pain:** GigE's headline advantage (up to 100 m cable) only holds with
  congestion-aware design — packet loss in multi-camera systems is a
  "typical issue" buyers meet after purchase.

## Method notes / dead ends

- Basler community host: `community.baslerweb.com`, `forum.baslerweb.com`,
  `community.basler.com`, `forum.basler.com` return zero CDX records; no
  `forum`/`community` URL-key exists under `baslerweb.com` either — the
  retired community is unrecoverable via Wayback hostname search (NXDOMAIN
  per UNSCRAPABLE.md §3 stands). Recorded the two nearest archived
  lens-selection items instead.
- `https://www.baslerweb.com/en/learn/basler-learning/` is HTTP 404 (Firecrawl
  scrape 2026-09-26, "Page not found"); the live learning hub is now
  `https://www.baslerweb.com/en-us/learning/` (found via Firecrawl search).
- Cloudy Nights USB3 32-ft active-extension thread
  (`https://www.cloudynights.com/forums/topic/738213-32-foot-usb-30-active-extension-cable-causing-image-glitches/`)
  returned by Firecrawl search but 403s to direct fetch (WAF) — excluded
  from the numbered items above since the page body was never opened.
- Wayback `web.archive.org/web/…` snapshot playback intermittently serves
  "Temporarily Offline"; CDX records + one successful 224 KB snapshot fetch
  (title verified) are the evidence cited in §A.
