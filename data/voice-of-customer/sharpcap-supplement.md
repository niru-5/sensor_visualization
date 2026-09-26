# SharpCap forums VoC supplement — 9 threads (Scrapling Fetcher.get)

Forum: **SharpCap Forums** (`https://forums.sharpcap.co.uk`, phpBB —
"SharpCap Forums - Forums"). `f=26` is the **Basler Cameras** subforum
under the **Camera Specific** category (`f=20`, siblings: Altair, ASCOM,
Celestron/Imaging Source, Point Grey, QHY, Webcams and Frame Grabbers,
ZWO, Other Cameras).

Source (fetched live 2026-09-26, all HTTP 200 via plain `Fetcher.get` —
no Cloudflare/WAF wall encountered, so `StealthyFetcher` and Firecrawl
were not needed):

- `https://forums.sharpcap.co.uk/viewforum.php?f=26` (single listing
  page — only 12 topics incl. sticky; `?start=25` / `?start=50` return
  the identical list, so no further pagination exists)
- `https://forums.sharpcap.co.uk/viewtopic.php?t=<id>` per thread (title +
  first-post date + first-post body verified live)

Fetcher: `Fetcher.get(...)` — no custom User-Agent. Dates are the first
post's `p.author time[datetime]` (topic creation). URLs are canonical
`viewtopic.php?t=<id>` (session `sid` stripped). Note: this subforum has
no lens-choice threads — pains are Basler model evaluation, driver
(Pylon/DirectShow) compatibility, ROI frame rate, trigger/timestamping,
and sensor-coverage questions, all of which drive camera selection.

## Basler evaluation / compatibility (5)

### sharpcap7757

- **Title:** Cannot link SC to Basler USB3 cam I'm evaluating
- **URL:** https://forums.sharpcap.co.uk/viewtopic.php?t=7757
- **Date:** 2024-05-28
- **Pain:** Evaluator pits a Basler a2A4508-20umBAS (GMAX2518, square
  global-shutter 4K×4K) against an IMX183 for full-disc solar — SharpCap
  sees it only as a limited DirectShow device until Pylon is coaxed to
  work, so "will this sensor work in my software" blocks the purchase.

### sharpcap8617

- **Title:** Lack of control in Basler puA1280-54um and unable to use Basler acA1300-200uc
- **URL:** https://forums.sharpcap.co.uk/viewtopic.php?t=8617
- **Date:** 2025-04-12
- **Pain:** Buyer of two new USB3 Baslers (acA1300-200uc, puA1280-54um)
  finds both fine in Pylon Viewer but unusable elsewhere — Basler's own
  microscopy software "was not designed to work with any Basler camera",
  so post-purchase software compatibility is a lottery.

### sharpcap9278

- **Title:** Unable to connect Basler a2A 1920 - 160uc PRO
- **URL:** https://forums.sharpcap.co.uk/viewtopic.php?t=9278
- **Date:** 2026-01-14
- **Pain:** New a2A1920-160uc PRO works in Pylon but in neither SharpCap
  nor FireCapture — buyer unfamiliar with driver/interface layers asks
  whether anyone has ever gotten this model working, i.e. no public
  compatibility matrix exists to check before buying.

### sharpcap6068

- **Title:** Basler a2A4096-30 um does not work
- **URL:** https://forums.sharpcap.co.uk/viewtopic.php?t=6068
- **Date:** 2022-11-23
- **Pain:** a2A4096-30um fails under Win11/SharpCap 4 ("not enough memory"
  in Pylon 7, DirectShow-only with all disadvantages in Pylon 6) — model
  + OS + Pylon-version interaction decides usability, none of it on a
  datasheet.

### sharpcap151

- **Title:** Basler acA1300-30m only in DirectShow
- **URL:** https://forums.sharpcap.co.uk/viewtopic.php?t=151
- **Date:** 2017-05-14
- **Pain:** Owner of several Baslers finds the acA1300-30m (GigE mono)
  reachable only via a performance-warning DirectShow fallback because
  the expected "Basler Cameras" section never appears — native GenICam
  support per model is discoverable only by trial.

## Frame rate / ROI / sensor behavior (2)

### sharpcap6139

- **Title:** Basler camera max fps with ROI
- **URL:** https://forums.sharpcap.co.uk/viewtopic.php?t=6139
- **Date:** 2022-12-17
- **Pain:** Tester of a Basler IMX183 mono (USB) can't exceed 20 fps even
  with ROI, in either SharpCap or Pylon Viewer — can't tell hardware
  limit from hidden setting, so achievable fps (the key selection spec)
  is unverifiable before purchase.

### sharpcap7821

- **Title:** Plan to add a temperature sensor?
- **URL:** https://forums.sharpcap.co.uk/viewtopic.php?t=7821
- **Date:** 2024-06-19
- **Pain:** acA1920-155um buyer hits three selection-relevant gaps at
  once: tiny Baslers run hot with no temp readout (vs ZWO/Player One),
  dual Gain vs Digital Gain panels with no "low-noise" guidance, and a
  1936×1216 capture area that records as 1920×1200 — sensor
  usable-area vs datasheet-area confusion.

## Trigger / timestamping and legacy bodies (2)

### sharpcap6234

- **Title:** Basler Camera and Trig in
- **URL:** https://forums.sharpcap.co.uk/viewtopic.php?t=6234
- **Date:** 2023-01-23
- **Pain:** Team planning a Basler purchase for asteroid-occultation
  timing needs hardware trigger-in + TimeBox timestamps carried through
  to the video file — whether SharpCap preserves external timestamps
  decides which body they buy.

### sharpcap1263

- **Title:** Basler daA1280-54um only in DirectShow in older systems
- **URL:** https://forums.sharpcap.co.uk/viewtopic.php?t=1263
- **Date:** 2018-11-05
- **Pain:** Basler dart daA1280-54um (USB3) fully controlled on a Win10
  laptop falls back to limited DirectShow on a Win7 machine with a
  nominal USB3 port — host age/OS silently downgrades the same camera,
  a trap for buyers reusing old PCs.

## Method

- Tool ladder: `Fetcher.get` (Scrapling, no stealth) succeeded first try
  on listing + 9 topics + index + f=20 (all HTTP 200, 2026-09-26T19:00Z).
  Verdicts: `Fetcher.get` = ok (13/13); `StealthyFetcher` = not needed;
  Firecrawl = not needed (key present but unspent — no wall to justify
  credits). `crawled_at`: 2026-09-26T19:00:00Z.
- Excluded: sticky "Information for New Members" (t=641, not a pain
  thread), "ZWO asi183MC CPU Power Spikes" (t=5907, ZWO not Basler),
  "Sv305 problem" (t=4247, Svbony camera, off-section).
- Nothing invented: every title/URL/date/body above was returned live;
  canonical URLs drop the session `sid`.
