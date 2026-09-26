---
name: firecrawl
description: Managed scrape/search/crawl/extract via the Firecrawl API for JS-walled, Cloudflare/WAF-blocked, or Reddit/LinkedIn-walled pages. Use when web_fetch/fetch_content or Scrapling return walls, CAPTCHAs, empty JS shells, or Reddit JSON blocks — or when structured extraction across many pages is needed. Requires FIRECRAWL_API_KEY in .env.local (never commit).
---

# Firecrawl (managed scraping fallback)

You are an autonomous web agent with access to the Firecrawl managed-scraping API.
Never synthesize from memory what you can verify with a live fetch. Every factual claim needs a live URL.

Firecrawl runs a real browser + proxy + anti-bot stack server-side and returns markdown/HTML/structured JSON.
It costs API credits per call — it is NOT the first resort. Follow the tool ladder below.

## Tool ladder (cheapest first)

1. **Direct APIs** — vendor JSON endpoints, Reddit `.json`, GitHub API. Free, structured, no credits. Try first when the site exposes one.
2. **Scrapling / local fetch** — `web_fetch` (readable markdown) or `fetch_content` (raw/answer modes, PDFs, transcripts), plus the repo's Scrapling scripts for static HTML. Free, fast. Use for docs, blogs, product pages that render server-side.
3. **Firecrawl Search** — `app.search()` for discovery when `web_search` returns thin snippets or the target domain is deindexed. Paid per result — keep `limit` small (5).
4. **Firecrawl Scrape** — `app.scrape(url, { formats: ['markdown'] })` for single pages that are JS-rendered, Cloudflare/Turnstile-gated, or WAF-blocked locally. Paid per page.
5. **Firecrawl Crawl / Map / Batch** — `app.crawl()` / `app.map()` / `app.batchScrape()` for multi-page vendor doc sets (e.g. all Basler/FLIR product pages). Paid per page — always `map()` first, cap `limit`, then scrape the shortlist.
6. **Firecrawl Extract** — `app.extract()` with a JSON schema + `prompt` for structured fields (sensor, resolution, FPS, price) across pages. Paid per page + LLM tokens — use only when the brief needs a typed table.
7. **Interact (last resort)** — `browser_*` tools drive local Chrome. Only when Firecrawl also fails (login walls, SSO, visual checks). Read `browser-policy` skill first. Never loop retries against Turnstile/CAPTCHA/SSO — stop and report.

Rule: full page dumps into context are a failure. Extract key claims, data points, dates, attributed quotes + author/publication/date/URL per source.

## Setup (JS + Python)

SDK installed via `npm i -s @mendable/firecrawl-js` (v4.x). Python fallback is `pip install firecrawl-py`.

Key lives in `.env.local` as `FIRECRAWL_API_KEY` (gitignored — verify with `git check-ignore .env.local`; never commit, never paste into reports).

```js
// JS (v4) — reads key from env
import Firecrawl from '@mendable/firecrawl-js';
const app = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY });

// Scrape one page → markdown
const page = await app.scrape('https://example.com/product', { formats: ['markdown'] });
console.log(page.markdown?.length, page.metadata?.title);

// Search (discovery)
const res = await app.search('Arducam autofocus camera global shutter', { limit: 5 });

// Crawl a doc set (cap pages, map first for large sites)
const job = await app.crawl('https://docs.example.com/', { limit: 20, scrapeOptions: { formats: ['markdown'] } });

// Structured extract with schema
const out = await app.extract({
  urls: ['https://example.com/cam-a', 'https://example.com/cam-b'],
  prompt: 'Extract sensor model, resolution MP, max FPS, interface, price USD.',
  schema: { type: 'object', properties: {
    sensor: { type: 'string' }, resolutionMp: { type: 'number' },
    maxFps: { type: 'number' }, priceUsd: { type: 'number' } } },
});
```

```python
# Python fallback
import os
from firecrawl import FirecrawlApp
app = FirecrawlApp(api_key=os.environ["FIRECRAWL_API_KEY"])
page = app.scrape_url("https://example.com/product", params={"formats": ["markdown"]})
```

Load the key locally with `dotenv` (`require('dotenv').config({ path: '.env.local' })` / `load_dotenv('.env.local')`) — never `export` it into shell history or CI logs.

## Endpoints at a glance

| Endpoint | Method | Returns | Use when |
|---|---|---|---|
| Scrape | `scrape(url, { formats })` | markdown + html + metadata for one URL | single JS-walled / WAF-blocked page |
| Search | `search(query, { limit })` | URLs + snippets + markdown excerpts | discovery when `web_search` is thin |
| Map | `map(url)` | URL list for a site (no page bodies) | planning a crawl; cheap recon |
| Crawl | `crawl(url, { limit, scrapeOptions })` | markdown for N pages under a prefix | vendor doc sweep (cap `limit` ≤ 20 default) |
| Batch scrape | `batchScrape(urls, {...})` | markdown for an explicit URL list | shortlisted product pages |
| Extract | `extract({ urls, prompt, schema })` | schema-validated JSON per URL | typed spec tables for code briefs |

Prefer `formats: ['markdown']` (cheapest readable form). Add `'html'` only when markdown drops spec tables; add `'screenshot'` only for visual QA.

## When to prefer Firecrawl vs Scrapling vs APIs

- **Prefer direct APIs** when the data is already structured: vendor parametric-search JSON, GitHub REST, arXiv API, Reddit `.json` (append `.json` + UA header). No credits, exact numbers.
- **Prefer Scrapling / local fetch** for static server-rendered pages (most vendor docs, blogs, standards PDFs): free and faster. If `web_fetch` returns full readable markdown, stop — do not call Firecrawl.
- **Prefer Firecrawl** when you hit any of these (record the wall evidence, 1 line):
  - JS-rendered shells (local fetch returns nav chrome but no body content).
  - Cloudflare / Turnstile / Akamai / PerimeterX / vendor WAF blocks (403, captcha, "verify you are human").
  - Reddit/LinkedIn login walls or `fetch_content` JSON-glob blocks.
  - Multi-page sweeps where per-page bot-fighting would dominate local time.
- **Prefer local `browser_*`** only when Firecrawl also fails (SSO/login, interactive selectors, visual layout). Never burn both stacks blindly — try Firecrawl scrape once, then decide.

## Rate limits + backoff

- Firecrawl enforces per-plan concurrency and credits-per-minute limits; a crawl of 20 pages can take minutes. Poll `getCrawlStatus` / `getBatchScrapeStatus` — never tight-loop.
- On HTTP 429 / 5xx / timeout: exponential backoff with jitter (2s → 4s → 8s, max 3 retries), then downgrade: crawl → batch of top URLs → single scrapes → local fetch → record dead end.
- Keep concurrency low: one scrape at a time in scripts; for batches pass the URL list in a single `batchScrape` call instead of parallel `scrape` calls.
- Cap spend: default `limit: 5` for search, `limit: 20` for crawl, explicit URL lists for batch. Never crawl an entire domain.
- Timeouts: pass a generous client timeout for crawls (e.g. 120s+) and treat `JobTimeoutError` as "poll status again", not failure.

## Recording + output contract

Every Firecrawl call in a research task must record: `endpoint` (scrape/search/crawl/map/extract), target URL(s), `crawled_at` (UTC ISO date), markdown length or schema fields returned, and credit-relevant counts (pages scraped).

End every task with (mirrors `web-research` contract):

1. What was searched (angles + query list + which layer served each: API / Scrapling / Firecrawl endpoint).
2. Sources table (URL, type, date, `crawled_at`, endpoint, what it supported).
3. Findings by subtopic with inline citations `[label](url)`.
4. Confidence flags: **high** (3+ agree) / **medium** (2 agree) / **low** (single source or conflicting).
5. Dead ends — walls encountered, fallbacks tried, 404s, contradictions. State plainly; never cite a URL you did not successfully open; never invent forum quotes.

If the brief feeds code (thresholds, formulas, seed parts), cite the source for each number and mark defaults-vs-measured explicitly.
