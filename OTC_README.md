# OTC Scraper (Pocket Option) — Operations Guide

Fully independent from the TradingView scraper (`server.js`, **untouched**). Lives in
`po-scraper.js` and runs alongside `server.js` from a single entry point (`start.js`).

## How it runs on Render

- **Entry point:** `start.js` → requires `server.js` (TradingView) **and** `po-scraper.js` (OTC).
- **Environment:** Docker (the included `Dockerfile`). Render auto-detects it.
- **Browser:** `puppeteer-core` + `@sparticuz/chromium` (low-RAM Chromium) — fits Render Free (512 MB).

### Required env vars (Render → Environment)
```
PO_EMAIL, PO_PASSWORD, PO_CHART_URL
SUPABASE_URL, SUPABASE_SERVICE_KEY
```
Optional: `PO_LOGIN_URL`, `OTC_AUTOSTART=0` (disable OTC), `OTC_MEM_LIMIT_MB` (default 512),
`PUPPETEER_EXECUTABLE_PATH` (use a system Chromium instead of @sparticuz).

## Data flow

```
Pocket Option (live page, persistent session)
   │  CDP websocket-frame tap  (primary, all pairs, low RAM)
   │  + 4-layer self-healing DOM resolver (fallback when WS format changes)
   ▼
po-scraper.js  ──upsert──►  Supabase
   • candles      table   key = "<SYMBOL>_<iv>"  (last 150, FIFO)
   • configs/otc_prices    { SYM: {p, o(marketOpen), t, st} }  (per-second)
   • configs/otc_status    { connected, loggedIn, phase, reconnects, lastError, updatedAt }
   • otc_pairs    table    discovered library (admin enables per pair)
   ▼
Admin panel: enable a pair → it's auto-added to `pairs` (category 'otc')
User app: OTC category → chart reads candles + otc_prices straight from Supabase
```

The OTC internal symbol contains **no `:`**, so `server.js`'s pairs-listener (which only
subscribes `chart_symbol`s containing `:`) ignores OTC pairs entirely — the two systems
never interfere.

## Resilience features

- **Persistent session:** one browser, one tab, kept alive; never reopened per read.
- **Stealth:** `puppeteer-extra-plugin-stealth` hides automation fingerprints.
- **Smart login backoff:** 5s → 15s → 60s between failed attempts (no hammering/blocking).
- **Circuit breaker (per pair):** 5 straight failures → pause that pair 5 min → half-open trial.
- **Self-healing price resolver:** data-attr → CSS class → XPath-near-name → DOM regex,
  first hit wins; remembers the winning layer per pair; restarts from L1 after 3 misses.
- **Structured failure log:** aggregated once per 10 min (pair, time, last good layer, DOM sample).
- **Memory guard:** RSS ≥ 85% of limit → graceful **browser-only** restart (process stays up).
- **Resource blocking:** images/media/fonts/CSS/ads aborted — only HTML+JS+data sockets load.

## Admin alerts in logs (need a human)

- `🟥 ADMIN ACTION REQUIRED — OTC LOGIN FAILED` → wrong password / locked account / 2FA.
- `🟧 Pocket Option appears to have BLOCKED the server IP` → stealth detected; consider IP rotation.

TradingView forex pairs keep running normally regardless of any OTC failure.

## ⚠️ Selector tuning (first deploy)

The websocket-frame parser and DOM selectors are written defensively but **could not be
verified against a live Pocket Option session**. After the first deploy, watch the logs:

- `[OTC] unparsed frame sample: …` → the WS price format differs; adjust
  `PocketOptionAdapter.parseFrame` (`_collectPrices` / `_collectAssets`).
- `OTC price-resolution failures …` → tune `PocketOptionAdapter.priceSelectors()`.

Everything is isolated in `PocketOptionAdapter`, so tuning never touches the engine.

## Adding another OTC platform later

Implement a new adapter with the same surface as `PocketOptionAdapter`
(`id`, `loginUrl`, `chartUrl`, `isLoggedIn`, `login`, `parseFrame`, `discoverAssetsFromDom`,
`normalize`, `displayName`, `expectedDecimals`, `priceSelectors`) and instantiate it in
`start()`. The engine, candle store, resolver, circuit breaker and storage are all
platform-agnostic.
