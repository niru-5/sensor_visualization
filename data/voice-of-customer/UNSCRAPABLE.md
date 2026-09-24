# UNSCRAPABLE — blocked sites, reasons, and tooling to crack them

Sites encountered (or anticipated from prior crawl attempts) that block
plain `curl`/fetch scraping, with the concrete upgrade path for each.
Rule: blocked ≠ skipped silently — record here, then crack with the listed tooling.

## 1. forums.raspberrypi.com — Cloudflare 403

- **Reason:** Cloudflare bot-management returns 403 to datacenter IPs and
  non-browser TLS fingerprints.
- **To crack:** Playwright (headed or headless-with-stealth) + residential
  proxy; or the official forum/API surface if available. Persist sessions —
  Cloudflare clearance cookies (`cf_clearance`) are reusable for a window.

## 2a. Reddit search JSON — 403

- **Reason:** `reddit.com/search.json` blocks unauthenticated/datacenter
  traffic (403/429); old-Reddit JSON endpoints are progressively restricted.
- **To crack:** Reddit OAuth API (PRAW / raw `oauth.reddit.com`) with a script
  app; fall back to Arctic Shift / pushshift mirrors or Playwright for
  one-off threads. (This crawl used the mirror path — see 2b.)

## 2b. PullPush / Arctic Shift — 429 / timeouts

- **Reason:** PullPush.io rate-limits aggressively (429); Arctic Shift
  (`arctic-shift.photon-reddit.com`) times out under load and returns HTTP 422
  for some multi-word queries (observed live during this crawl — retries with
  single-token queries + 8–15 s backoff succeeded).
- **To crack:** Reddit API OAuth as primary; Arctic Shift/pushshift as bulk
  mirror with backoff + single-token queries; Playwright for stragglers.

## 3. Basler community — NXDOMAIN

- **Reason:** Community host no longer resolves (moved/retired without redirect).
- **To crack:** Wayback Machine (CDX API) for archived threads; vendor
  support tickets / knowledge base as the live source.

## 4a. Vendor sites via curl — 403

- **Reason:** WAF/bot rules (Akamai/Imperva/Cloudflare) fingerprint curl and
  datacenter ranges; JS challenges block non-browser clients.
- **To crack:** Playwright with stealth + residential proxy; or managed
  scraping APIs — ScraperAPI / Oxylabs / FlareSolverr to clear JS challenges.

## 4b. automate.org — Cloudflare

- **Reason:** Cloudflare-fronted; same bot-manager as (1).
- **To crack:** Same as (1): Playwright + residential proxy; cache aggressively
  since association pages change slowly.

## 5. Search-engine CAPTCHAs (Google/Bing/DuckDuckGo HTML)

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
