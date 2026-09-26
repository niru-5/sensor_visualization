# UNSCRAPABLE — blocked sites, reasons, and tooling to crack them

Sites encountered (or anticipated from prior crawl attempts) that block
plain `curl`/fetch scraping, with the concrete upgrade path for each.
Rule: blocked ≠ skipped silently — record here, then crack with the listed tooling.

## 1. forums.raspberrypi.com — Cloudflare 403

- **Status 2026-09-26: CRACKED** — Scrapling `StealthyFetcher` (`headless=True`, `solve_cloudflare=True`) solved the Turnstile 307→200 live 2026-09-26; 10 threads via `viewforum.php?f=43` pagination (16 pages) + `viewtopic.php?t=<id>` (see [rpi-supplement.md](rpi-supplement.md)). Caveat: `search.php` is login-walled, so keyword pagination was used instead of forum search. (commit 'docs(data): mark gaps cracked + index supplements')
- **Reason:** Cloudflare bot-management returns 403 to datacenter IPs and
  non-browser TLS fingerprints.
- **To crack:** Playwright (headed or headless-with-stealth) + residential
  proxy; or the official forum/API surface if available. Persist sessions —
  Cloudflare clearance cookies (`cf_clearance`) are reusable for a window.

## 2a. Reddit search JSON — 403

- **Status 2026-09-26: PARTIAL** — Firecrawl `scrape` refused reddit (`www` + `old`): "we do not support this site"; single-thread `.json` returned HTTP 403 for all 12 probed threads. Firecrawl `search` worked and surfaced 10 threads the earlier Arctic Shift title-search missed (see [reddit-supplement.md](reddit-supplement.md)); metadata completed via Arctic Shift single-token `query` + `subreddit` lookup. Direct scrape remains refused. (commit 'docs(data): mark gaps cracked + index supplements')
- **Reason:** `reddit.com/search.json` blocks unauthenticated/datacenter
  traffic (403/429); old-Reddit JSON endpoints are progressively restricted.
- **To crack:** Reddit OAuth API (PRAW / raw `oauth.reddit.com`) with a script
  app; fall back to Arctic Shift / pushshift mirrors or Playwright for
  one-off threads. (This crawl used the mirror path — see 2b.)

## 2b. PullPush / Arctic Shift — 429 / timeouts

- **Status 2026-09-26: PARTIAL (mirror path works with limits)** — Arctic Shift single-token `query` + `subreddit` lookup completed metadata for the 10 Firecrawl-search-surfaced threads 2026-09-26 (see [reddit-supplement.md](reddit-supplement.md)). Multi-word queries still 422; 429/timeouts under load need 8–15 s backoff. (commit 'docs(data): mark gaps cracked + index supplements')
- **Reason:** PullPush.io rate-limits aggressively (429); Arctic Shift
  (`arctic-shift.photon-reddit.com`) times out under load and returns HTTP 422
  for some multi-word queries (observed live during this crawl — retries with
  single-token queries + 8–15 s backoff succeeded).
- **To crack:** Reddit API OAuth as primary; Arctic Shift/pushshift as bulk
  mirror with backoff + single-token queries; Playwright for stragglers.

## 3. Basler community — NXDOMAIN

- **Status 2026-09-26: PARTIAL** — Wayback CDX queried live: `community.baslerweb.com`, `forum.baslerweb.com`, `community.basler.com`, `forum.basler.com` return zero records and no `forum`/`community` urlkey exists under `baslerweb.com` — retired community unrecoverable via hostname search (NXDOMAIN stands). Nearest archived lens-selection items recorded instead (2 items, §A in [vendor-supplement.md](vendor-supplement.md)). (commit 'docs(data): mark gaps cracked + index supplements')
- **Reason:** Community host no longer resolves (moved/retired without redirect).
- **To crack:** Wayback Machine (CDX API) for archived threads; vendor
  support tickets / knowledge base as the live source.

## 4a. Vendor sites via curl — 403

- **Status 2026-09-26: PARTIAL** — Firecrawl `scrape` cracked Basler Learning lens-selection page + Edmund focal-length/FOV app note live 2026-09-26 (see [vendor-supplement.md](vendor-supplement.md) §C). Still blocked: Cloudy Nights USB3 32-ft thread (Firecrawl search found it, direct fetch 403/WAF — excluded from numbered items). (commit 'docs(data): mark gaps cracked + index supplements')
- **Reason:** WAF/bot rules (Akamai/Imperva/Cloudflare) fingerprint curl and
  datacenter ranges; JS challenges block non-browser clients.
- **To crack:** Playwright with stealth + residential proxy; or managed
  scraping APIs — ScraperAPI / Oxylabs / FlareSolverr to clear JS challenges.

## 4b. automate.org — Cloudflare

- **Status 2026-09-26: CRACKED** — Firecrawl `app.scrape('https://www.automate.org/vision')` returned ≈8.6 k chars markdown live 2026-09-26 (see [vendor-supplement.md](vendor-supplement.md) §B). (commit 'docs(data): mark gaps cracked + index supplements')
- **Reason:** Cloudflare-fronted; same bot-manager as (1).
- **To crack:** Same as (1): Playwright + residential proxy; cache aggressively
  since association pages change slowly.

## 5. Search-engine CAPTCHAs (Google/Bing/DuckDuckGo HTML)

- **Status 2026-09-26: CRACKED (via Firecrawl search, not raw SERP HTML)** — Firecrawl `app.search` returned the 4 GigE/USB3 cable-length items + 10 reddit threads live 2026-09-26 with URL re-verification (see [vendor-supplement.md](vendor-supplement.md) §D, [reddit-supplement.md](reddit-supplement.md)). Raw SERP HTML scraping still out of scope per hygiene below. (commit 'docs(data): mark gaps cracked + index supplements')
- **Reason:** CAPTCHA / consent walls for automated SERP fetching.
- **To crack:** Paid SERP APIs instead of HTML scraping — SerpAPI, Brave
  Search API, or Bing Web Search API. Never burn residential IP reputation on
  raw SERP scraping.

## Crawl hygiene (applies to all of the above)

- Identify with a contactable User-Agent; respect robots.txt + rate limits.
- Back off exponentially on 429/5xx/timeouts; single-token queries where the
  API is query-shape-sensitive (observed with Arctic Shift).
- Record `crawled_at`, source endpoint, and query per thread so VoC evidence
  stays auditable (see per-source files).
