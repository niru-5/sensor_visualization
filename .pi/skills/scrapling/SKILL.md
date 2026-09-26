---
name: scrapling
description: Stealth web scraping with Scrapling (Cloudflare/WAF bypass, adaptive parsing). Use when a page returns 403/Cloudflare challenge to plain fetch, for vendor sites with WAF/bot protection, forum scraping (forums.raspberrypi.com, forum.arducam.com), or JS-rendered product/spec pages that web_fetch cannot open.
---

# Scrapling Scraping Skill

Scrapling (installed: v0.4.15, python3.12, `pip install "scrapling[fetchers]"`) is the
repo's preferred scraper for bot-protected pages. It combines an auto-stealth
fetch layer (real browser fingerprints, Cloudflare Turnstile/interstitial
solving) with an adaptive HTML parser (auto-recovers from broken markup,
CSS/XPath/text/regex selectors on one `Selector` object).

## Tool ladder (cheapest first)

1. **API / structured source** — if the site offers a JSON API, RSS feed, or
   sitemap, use it. Cheapest, most stable, no WAF risk.
2. **`web_fetch` / `fetch_content`** — plain HTTP markdown scrape. Use for docs,
   blogs, unprotected product pages. If it returns 403 / Cloudflare challenge /
   empty JS shell, escalate — do not retry-loop.
3. **Scrapling `Fetcher.get`** — lightweight HTTP + adaptive parser, no browser.
   Use for static pages that just need tolerant parsing.
   ```python
   from scrapling import Fetcher
   page = Fetcher.get('https://example.com/product')
   print(page.status, page.url)
   titles = page.css('h1 ::text')
   ```
4. **Scrapling `StealthyFetcher.fetch`** — auto-stealth headless Chromium for
   Cloudflare/WAF/JS pages. This is the skill's core tool.
   ```python
   from scrapling import StealthyFetcher
   page = StealthyFetcher.fetch(
       'https://forums.raspberrypi.com/',
       headless=True,
       disable_resources=True,   # drop fonts/images/media for speed
       network_idle=True,        # wait until no network for 500 ms
       timeout=30000,
       solve_cloudflare=True,    # solve Turnstile / interstitial challenges
   )
   print(page.status, page.url)
   print(page.css('title ::text'))
   ```
5. **`browser_*` (Playwright/Chrome, last resort)** — only when Scrapling fails
   AND the task needs interaction (login, clicks, visual check, CAPTCHA/Turnstile
   that must be seen by a human). Read the `browser-policy` skill first. Never
   loop retries against Turnstile/CAPTCHA/SSO — stop and record the verdict.

Rule: full page dumps into context are a failure. Extract selectors/text/attrs,
dates, URLs — then close the page.

## When to prefer Scrapling vs Playwright vs API

| Situation | Choice |
|---|---|
| JSON API / RSS / sitemap exists | API (never scrape HTML) |
| Plain docs/blog, no protection | `web_fetch` |
| Static HTML, broken markup, need CSS/XPath parsing | `Fetcher.get` (adaptive parser) |
| Cloudflare 403 / "Just a moment" / Turnstile (e.g. forums.raspberrypi.com), vendor WAF (Arducam, Basler, FLIR), JS-rendered spec tables | `StealthyFetcher.fetch` with `solve_cloudflare=True` |
| Login wall, multi-step clicks, visual regression, file download via UI | `browser_*` Playwright |
| CAPTCHA/Turnstile loop, SSO, paywall | Stop, record `verdict: blocked`, never brute-force |

## Usage pattern (python3 scripts)

Always run as a standalone `python3` script (not inline `-c` for real jobs) so
retries/timeouts are reproducible. Keep each fetch self-contained:

```python
#!/usr/bin/env python3
"""Fetch one protected page with Scrapling, print verdict + extracted data."""
from datetime import datetime, timezone
from scrapling import StealthyFetcher

URL = 'https://forum.arducam.com/'

page = StealthyFetcher.fetch(
    URL,
    headless=True,
    disable_resources=True,
    network_idle=True,
    timeout=30000,
    solve_cloudflare=True,
)
crawled_at = datetime.now(timezone.utc).isoformat()

print('status:', page.status)
print('url:', page.url)
print('crawled_at:', crawled_at)
# Adaptive parser: CSS with ::text / ::attr(name), xpath, .find/.find_all
print('title:', page.css('title ::text'))
for a in (page.css('a ::attr(href)') or [])[:10]:
    print('link:', a)
```

Parsing cheatsheet (adaptive `Selector`):

- `page.css('h1.product-title ::text')` — text of first match
- `page.css('a.spec-link ::attr(href)')` — attribute extraction
- `page.xpath('//table//tr/td[1]/text()')` — XPath fallback
- `page.find('div', {'class': 'price'})` / `page.find_all(...)` — BS-style
- Broken markup, missing closes, mixed encodings: handled automatically
  (the "adaptive" part) — no `lxml.etree` repair code needed.

## Rules / hygiene (mandatory)

- **User-Agent**: never hard-code a fake UA. Omit `useragent=` so Scrapling
  generates a real UA matching the launched browser. Pass a custom UA only to
  reproduce a reported bug, and note it in the verdict.
- **robots.txt**: check `https://<host>/robots.txt` before bulk crawling; honor
  `Disallow` for the target path. Single-page verification fetches for this
  skill's test matrix are fine; multi-page crawls need explicit approval.
- **Backoff**: 2–5 s sleep between requests to the same host; on HTTP 429/503,
  exponential backoff (5 s → 30 s → 120 s, max 3 retries), then stop and record
  `verdict: rate-limited`. Never parallel-blast a forum.
- **`crawled_at`**: every scrape output records UTC ISO-8601 `crawled_at`,
  final `url` (after redirects/JS), and numeric `status`. Stale data without a
  timestamp is a failure.
- **Attribution**: keep source URL with every extracted fact (feeds the
  `web-research` output contract: claim + URL + access date).
- **No credential / paywall bypass**: public pages only. If a login appears,
  stop and report — do not script credentials.

## Output contract

End every Scrapling task with:

1. What was fetched (URL list + which fetcher: `Fetcher.get` vs
   `StealthyFetcher.fetch`, key options used).
2. Verdicts table (URL, status, final URL, `crawled_at`, verdict:
   `ok` / `blocked` / `rate-limited` / `empty-js-shell`, one-line evidence).
3. Extracted data (selectors used + values, with source URL per fact).
4. Dead ends (Cloudflare challenge text, WAF headers, 403 bodies) — stated
   plainly, never fabricate page content that was not returned.
