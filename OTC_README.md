# OTC Scraper (Pocket Option) — Operations Guide

Fully independent from the TradingView scraper (`server.js`, **untouched**). Lives in
`po-scraper.js`, started alongside `server.js` by `start.js`.

## Architecture — DIRECT WebSocket (no browser)

Like the TradingView side, the OTC scraper connects **straight to Pocket Option's
websocket** — no Chromium — so it runs in ~20 MB (fits Render's 512 MB) and is stable.
PO's feed is protected, so it authenticates with a **session token** captured once.

```
Pocket Option WS ──auth(token)──► po-scraper.js ──► Supabase
   • candles      table   "<SYMBOL>_<iv>"  (last 150, FIFO)
   • configs/otc_prices    { SYM: {p, o, t, st} }   (per-second)
   • configs/otc_status    { connected, loggedIn, phase, phaseSince, health… }
   • configs/otc_token     { auth, wsUrl, capturedAt }  (auto-recaptured token)
   • otc_pairs    table    discovered library (admin enables per pair)
```

## One-time setup

1. **Capture the token (local PC):**
   ```
   npm install puppeteer
   node get-po-ssid.js
   ```
   Log in to Pocket Option, open a chart, wait ~20s, press ENTER. It prints
   `PO_WS_URL` and `PO_AUTH` and saves `po-capture.json`.
2. **Set on Render** (service `euro-trade-proxy-1` → Environment): `PO_WS_URL`,
   `PO_AUTH`, plus `PO_EMAIL` / `PO_PASSWORD` (for auto-recapture), and the shared
   `SUPABASE_URL` / `SUPABASE_SERVICE_KEY`. Deploy.

## Staying alive forever (keep-alive + self-healing)

- **Strong heartbeat** (random 20–40 s, human-like): Engine.IO ping + captured
  `PO_HEARTBEAT` frames + re-subscribe to every enabled symbol + periodic re-auth.
  Optional 2nd HTTP channel (`PO_KEEPALIVE_URL` + `PO_COOKIE`).
- **Watchdog:** no fresh data 30 s → fast retries; 3 in a row ⇒ token declared dead.
- **Self-repair:** auto re-captures the token with a brief, resource-blocked,
  login-only browser "strike" (needs `PO_EMAIL`/`PO_PASSWORD`), saves it to
  `configs/otc_token`, reconnects. Circuit-breaker: 3 fails → pause 5 min.
- **Last resort:** only if auto-repair keeps failing → loud log alert
  `🟥 LAST RESORT — AUTO-REPAIR FAILED` → run `get-po-ssid.js` once and update
  `PO_AUTH`. TradingView is never affected.
- **Token persistence:** the freshest token is reused across restarts.

## User-facing chart during a repair

Candles stay visible with a calm banner overlay (no full takeover):
`🔄 جاري إعادة الاتصال بمصدر البيانات…`, escalating after 60 s to
`⏳ النظام بيستعيد الاتصال، استنى لحظات`. New-signal requests are blocked while
unhealthy. (Full 17-state message map lives in `web/chart.js` → `_onOtcData`.)

## ⚠️ Tuning after first deploy

The WS frame parser + auth/heartbeat defaults are best-effort. Watch the logs for
`[OTC] unparsed event sample:` / `binary frame` and the `po-capture.json` samples,
then set `PO_HEARTBEAT` / `PO_SUBSCRIBE` and adjust `PoProtocol.parse` to match the
real frames. All PO-specific logic is isolated in `PoProtocol`.
