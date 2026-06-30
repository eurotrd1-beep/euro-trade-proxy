'use strict';

// supabase-js Realtime needs a global WebSocket; Node < 22 has none (throws
// "Node.js 20 detected without native WebSocket support"). Provide `ws` as the
// global before the supabase client is created. Guarded + no-op on Node 22+.
// (Also set in start.js for server.js's benefit; here too for standalone runs.)
if (typeof globalThis.WebSocket === 'undefined') {
  try { globalThis.WebSocket = require('ws'); } catch (_) {}
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 *  OTC SCRAPER  —  Pocket Option (persistent browser session)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  Fully independent from the TradingView scraper (server.js). This module:
 *    1. Opens ONE persistent Chrome (Puppeteer) on boot, logs in to Pocket
 *       Option with PO_EMAIL / PO_PASSWORD, opens PO_CHART_URL, and keeps the
 *       browser/page ALIVE the whole time (it is never closed per read).
 *    2. Reads the live price every second from that same open page (it taps the
 *       page's own websocket feed — no per-read tab, no cookie dependency).
 *    3. Builds candles for every timeframe (1m,5m,15m,1h,1D) from the real
 *       per-second price, opening a new candle only when the frame elapsed AND
 *       the price changed (frozen market => the current candle stays open).
 *    4. Persists the last 150 candles per (symbol+timeframe) to Supabase
 *       (`candles` table, FIFO) and the latest per-second price to
 *       configs/otc_prices — never to local disk.
 *    5. Health-checks the session every minute and auto-relogins on
 *       Target-closed/detached, logging every reconnect; after 3 consecutive
 *       login failures it logs a clear admin alert (without stopping the rest).
 *    6. Discovers tradable OTC pairs on demand (admin "جلب الأزواج" → configs/
 *       otc_scan) and upserts them into the `otc_pairs` library (enabled=off).
 *    7. Only scrapes/stores the pairs the admin ENABLED in the library.
 *
 *  Extensibility: all platform-specific behaviour lives behind a small
 *  `PlatformAdapter` interface, so adding another OTC platform later is just a
 *  new adapter — the engine (session manager, candle builder, storage) is
 *  platform-agnostic.
 *
 *  Credentials & connection come ONLY from env vars (set on Render):
 *    PO_EMAIL, PO_PASSWORD, PO_CHART_URL, SUPABASE_URL, SUPABASE_SERVICE_KEY
 * ════════════════════════════════════════════════════════════════════════════
 */

// ── Dependencies ─────────────────────────────────────────────────────────────
// To keep RAM low enough for Render Free (512 MB) we use puppeteer-core +
// @sparticuz/chromium (a minimal, resource-friendly Chromium build) instead of
// full puppeteer. puppeteer-extra's stealth plugin is layered on top of
// puppeteer-core so the headless session still evades PO's bot detection.
let puppeteer = null;
let chromium  = null;
try {
  chromium = require('@sparticuz/chromium');
  const core = require('puppeteer-core');
  try {
    const { addExtra } = require('puppeteer-extra');
    const Stealth = require('puppeteer-extra-plugin-stealth');
    puppeteer = addExtra(core);
    puppeteer.use(Stealth());
  } catch (_) {
    puppeteer = core; // stealth optional
  }
} catch (_) {
  // Local-dev fallback: full puppeteer if @sparticuz/chromium isn't installed.
  try {
    puppeteer = require('puppeteer-extra');
    puppeteer.use(require('puppeteer-extra-plugin-stealth')());
  } catch (_) {
    try { puppeteer = require('puppeteer'); } catch (_) {}
  }
}

// Resource types blocked at the network layer to slash RAM/CPU: we only let the
// HTML document, JavaScript and the data sockets (xhr/fetch/websocket) through —
// everything heavy (images, media, fonts, stylesheets) is aborted. The live
// price is read from the websocket feed, so none of the blocked assets matter.
const BLOCKED_RESOURCE_TYPES = new Set([
  'image', 'media', 'font', 'stylesheet', 'texttrack', 'imageset',
  'manifest', 'other', 'cspviolationreport', 'ping', 'prefetch',
]);
// Ad / tracker / analytics hosts — aborted regardless of resource type.
const BLOCKED_URL_RE = /(googlesyndication|doubleclick|google-analytics|googletagmanager|facebook\.net|fbcdn|hotjar|mixpanel|amplitude|sentry|intercom|zopim|tawk\.to|criteo|taboola|outbrain|yandex|metrika|appsflyer|onesignal)/i;

let createClient;
try { ({ createClient } = require('@supabase/supabase-js')); } catch (_) {}

// ── Config (env only) ────────────────────────────────────────────────────────
const PO_EMAIL     = process.env.PO_EMAIL     || '';
const PO_PASSWORD  = process.env.PO_PASSWORD  || '';
const PO_CHART_URL = process.env.PO_CHART_URL || 'https://pocketoption.com/en/cabinet/demo-quick-high-low/';
const PO_LOGIN_URL = process.env.PO_LOGIN_URL || 'https://pocketoption.com/en/login/';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

const IVS         = ['1m', '5m', '15m', '1h', '1D'];
const MAX_CANDLES = 150;
const HEALTH_MS   = 60_000;     // health check cadence
const PRICE_MS    = 1_000;      // per-second price → candle tick
const MAX_LOGIN_FAILS = 3;      // consecutive login failures before admin alert

const log  = (...a) => console.log('[OTC]', ...a);
const warn = (...a) => console.warn('[OTC]', ...a);
const err  = (...a) => console.error('[OTC]', ...a);

// ── Supabase ─────────────────────────────────────────────────────────────────
let db = null;
if (createClient && SUPABASE_URL && SUPABASE_KEY) {
  db = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  log('Supabase initialized');
} else {
  warn('Supabase not configured — OTC scraper will run without persistence');
}

// ── Interval helpers (mirror the TV scraper's semantics) ─────────────────────
function ivToSeconds(iv) {
  switch (iv) {
    case '5m':  return 300;
    case '15m': return 900;
    case '1h':  return 3600;
    case '1D':  return 86400;
    default:    return 60; // 1m
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  Platform adapter interface (extensibility seam)
// ════════════════════════════════════════════════════════════════════════════
//
//  A platform adapter knows how to:
//    • id            — short platform id (matches otc_pairs.platform)
//    • loginUrl / chartUrl
//    • isLoggedIn(page)         → boolean
//    • login(page)             → performs credential login
//    • parseFrame(payload)     → { prices?: {sym:price}, assets?: [{symbol,name}] }
//                                parses ONE raw websocket frame from the page
//    • normalize(rawSymbol)    → canonical internal symbol (NO ':' so the TV
//                                scraper never picks it up)
//    • displayName(symbol)     → human label, e.g. "EUR/USD OTC"
//
//  Everything else (session lifecycle, candle building, storage) is generic.

class PocketOptionAdapter {
  constructor() {
    this.id       = 'pocketoption';
    this.loginUrl = PO_LOGIN_URL;
    this.chartUrl = PO_CHART_URL;
  }

  async isLoggedIn(page) {
    try {
      const url = page.url() || '';
      if (/login|sign-in/i.test(url)) return false;
      // Logged-in cabinet pages expose a balance / cabinet container.
      return await page.evaluate(() => {
        const sel = [
          '.balance-info-block', '.js-balance-demo', '.balance__value',
          '[data-test="balance"]', '.deposit-button', '.cabinet',
        ];
        return sel.some(s => document.querySelector(s));
      });
    } catch (_) { return false; }
  }

  async login(page) {
    if (!PO_EMAIL || !PO_PASSWORD) {
      throw new Error('PO_EMAIL / PO_PASSWORD not set');
    }
    await page.goto(this.loginUrl, { waitUntil: 'networkidle2', timeout: 60_000 });

    // Detect an IP block / bot-challenge page (state 12) — distinct from a
    // credential failure, so the client + admin alert can say the right thing.
    const blocked = await page.evaluate(() => {
      const t = (document.body && document.body.innerText || '').toLowerCase();
      return /access denied|you have been blocked|verify you are human|unusual traffic|cloudflare|attention required|captcha/.test(t);
    }).catch(() => false);
    if (blocked) throw new Error('IP_BLOCKED: Pocket Option returned a block/verification page');

    // Email + password fields — PO uses standard name attributes; we try a few.
    const emailSel = 'input[name="email"], input[type="email"], #email';
    const passSel  = 'input[name="password"], input[type="password"], #password';
    await page.waitForSelector(emailSel, { timeout: 30_000 });
    await page.type(emailSel, PO_EMAIL, { delay: 25 });
    await page.type(passSel,  PO_PASSWORD, { delay: 25 });

    // Submit and wait for navigation into the cabinet.
    await Promise.all([
      page.evaluate(() => {
        const btn = document.querySelector(
          'button[type="submit"], .login-form button, form button'
        );
        if (btn) btn.click();
      }),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60_000 }).catch(() => {}),
    ]);

    // Give SPA a moment, then verify.
    await page.waitForTimeout ? await page.waitForTimeout(3000)
                              : await new Promise(r => setTimeout(r, 3000));
    if (!(await this.isLoggedIn(page))) {
      throw new Error('login verification failed (still not in cabinet)');
    }
  }

  // PO uses a socket.io style feed. Frames look roughly like:
  //   42["updateStream",[["EURUSD_otc", 1700000000, 1.08123]]]
  //   451-["loadHistoryPeriod",{...}]   (binary/length-prefixed handshakes)
  //   42["updateAssets",[[id,"EURUSD_otc",...],...]]   (asset catalogue)
  // We strip the socket.io prefix, JSON-parse, then walk the structure for
  // price tuples and asset catalogues. Unknown frames are ignored (and sampled
  // to the log by the caller) so the parser can be tuned against real frames.
  parseFrame(payload) {
    if (typeof payload !== 'string' || payload.length < 3) return null;
    // Strip leading socket.io packet/ack digits (e.g. "42", "451-").
    const brace = payload.search(/[[{]/);
    if (brace < 0) return null;
    let parsed;
    try { parsed = JSON.parse(payload.slice(brace)); } catch (_) { return null; }

    const out = { prices: {}, assets: [] };
    let event = null;
    let body  = parsed;
    if (Array.isArray(parsed) && typeof parsed[0] === 'string') {
      event = parsed[0];
      body  = parsed[1];
    }

    // ── Asset catalogue (for "جلب الأزواج") ─────────────────────────────────
    if (/asset/i.test(event || '') || this._looksLikeAssetList(body)) {
      this._collectAssets(body, out.assets);
    }

    // ── Live price tuples ───────────────────────────────────────────────────
    this._collectPrices(body, out.prices);

    if (Object.keys(out.prices).length === 0 && out.assets.length === 0) return null;
    return out;
  }

  _looksLikeAssetList(body) {
    return Array.isArray(body) && body.length > 5 && Array.isArray(body[0]) &&
           body[0].some(v => typeof v === 'string' && /otc/i.test(v));
  }

  // Recursively find [symbol, timestamp, price] tuples.
  _collectPrices(node, acc, depth = 0) {
    if (depth > 6 || node == null) return;
    if (Array.isArray(node)) {
      // tuple shape: [string, number(ts), number(price)]
      if (node.length >= 3 &&
          typeof node[0] === 'string' &&
          typeof node[1] === 'number' &&
          typeof node[2] === 'number' &&
          /[a-z]/i.test(node[0])) {
        const sym = this.normalize(node[0]);
        const price = node[2];
        if (sym && isFinite(price) && price > 0) acc[sym] = price;
        return;
      }
      for (const el of node) this._collectPrices(el, acc, depth + 1);
    } else if (typeof node === 'object') {
      const sym = node.asset || node.symbol || node.s || node.active;
      const price = node.price ?? node.quote ?? node.value ?? node.close ?? node.c;
      if (typeof sym === 'string' && typeof price === 'number' && price > 0) {
        const n = this.normalize(sym);
        if (n) acc[n] = price;
      }
      for (const k of Object.keys(node)) this._collectPrices(node[k], acc, depth + 1);
    }
  }

  _collectAssets(node, acc, depth = 0) {
    if (depth > 5 || node == null) return;
    if (Array.isArray(node)) {
      // an asset entry is usually an array containing the symbol + a label
      const symLike = node.find(v => typeof v === 'string' && /otc/i.test(v));
      if (symLike) {
        const symbol = this.normalize(symLike);
        const label  = node.find(v => typeof v === 'string' && /\//.test(v)) || null;
        if (symbol && !acc.some(a => a.symbol === symbol)) {
          acc.push({ symbol, name: label ? `${label} OTC` : this.displayName(symbol) });
        }
        return;
      }
      for (const el of node) this._collectAssets(el, acc, depth + 1);
    } else if (typeof node === 'object') {
      const sym = node.symbol || node.asset || node.active || node.id;
      if (typeof sym === 'string' && /otc/i.test(sym)) {
        const symbol = this.normalize(sym);
        const name   = node.name || node.label || this.displayName(symbol);
        if (symbol && !acc.some(a => a.symbol === symbol)) acc.push({ symbol, name });
      }
      for (const k of Object.keys(node)) this._collectAssets(node[k], acc, depth + 1);
    }
  }

  // DOM fallback for asset discovery if no asset frame is captured: read the
  // assets / favorites panel on the trading page.
  async discoverAssetsFromDom(page) {
    try {
      return await page.evaluate(() => {
        const out = [];
        const seen = new Set();
        const nodes = document.querySelectorAll(
          '.assets-table__item, .asset-item, [data-id], .alist__item, li[data-asset]'
        );
        nodes.forEach(n => {
          const txt = (n.textContent || '').trim();
          const dataAsset = n.getAttribute('data-asset') || n.getAttribute('data-id') || '';
          if (/otc/i.test(txt) || /otc/i.test(dataAsset)) {
            const key = (dataAsset || txt).slice(0, 40);
            if (!seen.has(key)) { seen.add(key); out.push({ raw: dataAsset, label: txt }); }
          }
        });
        return out;
      });
    } catch (_) { return []; }
  }

  // Canonical internal symbol: uppercase, keep _otc marker, strip ':' and spaces.
  // e.g. "EURUSD_otc" → "EURUSD_OTC". The result NEVER contains ':' so the
  // TradingView scraper's pairs-listener (which only subscribes chart_symbols
  // containing ':') will always ignore OTC symbols.
  normalize(raw) {
    if (!raw || typeof raw !== 'string') return null;
    let s = raw.trim().replace(/[:\s]/g, '').toUpperCase();
    if (!s) return null;
    return s;
  }

  // "EURUSD_OTC" → "EUR/USD OTC"
  displayName(symbol) {
    const base = symbol.replace(/_?OTC$/i, '');
    if (base.length === 6) {
      return `${base.slice(0, 3)}/${base.slice(3)} OTC`;
    }
    return `${base} OTC`;
  }

  // Expected price decimals — used by the DOM price resolver's regex layer to
  // recognise a valid price (JPY pairs quote 3 dp, most forex OTC 5 dp).
  expectedDecimals(symbol) {
    if (/JPY/i.test(symbol)) return 3;
    return 5;
  }

  // Candidate DOM selectors for the self-healing price resolver (layers 1 & 2).
  // Kept on the adapter so each platform supplies its own — extensibility.
  priceSelectors() {
    return {
      // Layer 1 — data-attribute selectors (most precise/fastest).
      dataAttr: [
        '[data-price]', '[data-current-price]', '[data-asset-price]',
        '[data-value].price', '[data-test="asset-price"]',
      ],
      // Layer 2 — known CSS class selectors.
      cssClass: [
        '.current-price', '.value__val', '.price-value', '.chart-price',
        '.asset-price', '.current-symbol__price', '.tv-symbol-price-quote__value',
      ],
    };
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  Self-healing DOM price resolver
// ════════════════════════════════════════════════════════════════════════════
//  A resilient fallback for reading a pair's price straight from the page DOM
//  when the websocket feed format changes (site restructure). Four layers, tried
//  in order, first success wins (the rest are skipped to save resources):
//    L1 data-attribute selectors   (most precise/fastest)
//    L2 known CSS class selectors
//    L3 XPath: nearest numeric text to the displayed pair name
//    L4 regex scan of the whole DOM text for a price-shaped number
//  Per-pair "selector health memory" remembers the last layer that worked and
//  starts there next time; after 3 straight misses on that layer it restarts
//  from L1. When all layers fail, a STRUCTURED record is buffered and a single
//  AGGREGATED alert is emitted at most once every 10 minutes (no log flooding).
class PriceResolver {
  constructor(adapter) {
    this.adapter = adapter;
    this.mem     = new Map();   // symbol → { layer:1..4, fails:n }
    this._fails  = [];          // buffered structured failures
    this._lastAggAlert = 0;
    this.ALERT_EVERY_MS = 10 * 60 * 1000;
  }

  _order(symbol) {
    const m = this.mem.get(symbol);
    const all = [1, 2, 3, 4];
    if (m && m.fails < 3) return [m.layer, ...all.filter(l => l !== m.layer)];
    return all; // no memory, or remembered layer failed 3× → restart from L1
  }

  async resolve(page, symbol) {
    const dec  = this.adapter.expectedDecimals(symbol);
    const name = this.adapter.displayName(symbol);
    const sels = this.adapter.priceSelectors();
    for (const layer of this._order(symbol)) {
      let price = null;
      try { price = await this._tryLayer(page, layer, name, dec, sels); } catch (_) {}
      if (price != null && isFinite(price) && price > 0) {
        this.mem.set(symbol, { layer, fails: 0 });   // remember the winner
        return { price, layer };
      }
      const m = this.mem.get(symbol);
      if (m && m.layer === layer) m.fails = (m.fails || 0) + 1; // bump remembered-layer misses
    }
    await this._logFailure(page, symbol);
    return null;
  }

  async _tryLayer(page, layer, name, dec, sels) {
    if (layer === 1) {
      return page.evaluate((selectors) => {
        for (const s of selectors) {
          const el = document.querySelector(s);
          if (el) {
            const raw = el.getAttribute('data-price') || el.getAttribute('data-value') || el.textContent || '';
            const v = parseFloat(String(raw).replace(/[^0-9.]/g, ''));
            if (isFinite(v) && v > 0) return v;
          }
        }
        return null;
      }, sels.dataAttr);
    }
    if (layer === 2) {
      return page.evaluate((selectors) => {
        for (const s of selectors) {
          const el = document.querySelector(s);
          if (el) {
            const v = parseFloat(String(el.textContent || '').replace(/[^0-9.]/g, ''));
            if (isFinite(v) && v > 0) return v;
          }
        }
        return null;
      }, sels.cssClass);
    }
    if (layer === 3) {
      // Nearest price-shaped number to the node showing the pair name.
      return page.evaluate((pairName, decimals) => {
        const re = new RegExp('\\d{1,7}\\.\\d{' + decimals + '}');
        const xp = document.evaluate(
          `//*[contains(normalize-space(.), ${JSON.stringify(pairName)})]`,
          document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        for (let i = 0; i < Math.min(xp.snapshotLength, 5); i++) {
          let node = xp.snapshotItem(i);
          for (let up = 0; up < 4 && node; up++) {
            const m = (node.textContent || '').match(re);
            if (m) { const v = parseFloat(m[0]); if (isFinite(v) && v > 0) return v; }
            node = node.parentElement;
          }
        }
        return null;
      }, name, dec);
    }
    // Layer 4 — full DOM text regex scan for a number with the expected decimals.
    return page.evaluate((decimals) => {
      const re = new RegExp('\\b\\d{1,7}\\.\\d{' + decimals + '}\\b');
      const m = (document.body && document.body.innerText || '').match(re);
      return m ? parseFloat(m[0]) : null;
    }, dec);
  }

  async _logFailure(page, symbol) {
    const m = this.mem.get(symbol);
    let dom = '';
    try {
      dom = await page.evaluate(() => (document.body && document.body.innerText || '').slice(0, 200));
    } catch (_) {}
    this._fails.push({
      symbol,
      at: new Date().toISOString(),
      lastGoodLayer: m ? m.layer : null,
      domSample: dom.replace(/\s+/g, ' ').trim(),
    });
    this._maybeAlert();
  }

  _maybeAlert() {
    const now = Date.now();
    if (now - this._lastAggAlert < this.ALERT_EVERY_MS) return;
    if (!this._fails.length) return;
    this._lastAggAlert = now;
    const grouped = {};
    for (const f of this._fails) (grouped[f.symbol] ||= []).push(f);
    err('──────── OTC price-resolution failures (last 10 min) ────────');
    for (const sym of Object.keys(grouped)) {
      const list = grouped[sym];
      const last = list[list.length - 1];
      err(`  ${sym}: ${list.length} miss(es) · lastGoodLayer=${last.lastGoodLayer} · ` +
          `at=${last.at} · dom="${last.domSample.slice(0, 200)}"`);
    }
    err('─────────────────────────────────────────────────────────────');
    this._fails = [];
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  Per-pair circuit breaker
// ════════════════════════════════════════════════════════════════════════════
//  After 5 consecutive failures for a pair the circuit OPENS: that pair is
//  skipped for 5 minutes so we never hammer the site. After the cooldown it goes
//  HALF-OPEN (one trial allowed); success closes it, another failure re-opens it.
class CircuitBreaker {
  constructor(threshold = 5, openMs = 5 * 60 * 1000) {
    this.threshold = threshold;
    this.openMs    = openMs;
    this.state     = new Map(); // key → { fails, openUntil }
  }
  _get(key) {
    let s = this.state.get(key);
    if (!s) { s = { fails: 0, openUntil: 0 }; this.state.set(key, s); }
    return s;
  }
  // true → allowed to attempt now (closed, or half-open trial). false → open.
  canAttempt(key) {
    const s = this._get(key);
    if (s.openUntil && Date.now() < s.openUntil) return false;
    return true;
  }
  success(key) { const s = this._get(key); s.fails = 0; s.openUntil = 0; }
  failure(key) {
    const s = this._get(key);
    s.fails++;
    if (s.fails >= this.threshold) {
      s.openUntil = Date.now() + this.openMs;
      s.fails = 0; // reset so half-open trial starts a fresh count
      warn(`circuit OPEN for ${key} — pausing ${Math.round(this.openMs / 60000)} min`);
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  Candle store  —  builds + persists candles (platform-agnostic)
// ════════════════════════════════════════════════════════════════════════════
class CandleStore {
  constructor() {
    this.candles    = {};   // `${symbol}_${iv}` → Candle[]
    this.lastChange = {};   // symbol → ms of last price change (market-open detect)
    this._saveTimers = {};
  }

  setEnabled(symbols) {
    // Ensure a candle array exists for every enabled (symbol,iv); drop disabled.
    this.enabled = new Set(symbols);
  }

  isEnabled(sym) { return this.enabled ? this.enabled.has(sym) : false; }

  async hydrate(symbols) {
    if (!db) return;
    const keys = [];
    for (const s of symbols) for (const iv of IVS) keys.push(`${s}_${iv}`);
    if (!keys.length) return;
    try {
      const { data, error } = await db.from('candles').select('key, data').in('key', keys);
      if (error) { err('hydrate error:', error.message); return; }
      let n = 0;
      for (const row of (data || [])) {
        if (row.key && Array.isArray(row.data) && row.data.length) {
          this.candles[row.key] = row.data; n++;
        }
      }
      if (n) log(`hydrated ${n} OTC candle series`);
    } catch (e) { err('hydrate failed:', e.message); }
  }

  // Build the live candle from the REAL price, identical rules to the TV scraper:
  //   • same frame → update high/low/close
  //   • frame rolled over AND price changed → open a new candle (FIFO 150)
  //   • frame rolled over but price frozen → hold the current candle (no flat)
  tick(symbol, price) {
    if (price == null || !isFinite(price) || price <= 0) return;
    if (this.lastChange[symbol] === undefined || this._lastPrice?.[symbol] !== price) {
      (this._lastPrice ||= {})[symbol] = price;
      this.lastChange[symbol] = Date.now();
    }
    for (const iv of IVS) this._tickIv(symbol, iv, price);
  }

  _tickIv(symbol, iv, price) {
    const key   = `${symbol}_${iv}`;
    let   arr   = this.candles[key] || (this.candles[key] = []);
    const ivSec = ivToSeconds(iv);
    const now   = Math.floor(Date.now() / 1000);
    const cTime = Math.floor(now / ivSec) * ivSec;
    const last  = arr.length ? arr[arr.length - 1] : null;

    if (!last) {
      arr.push({ t: cTime, o: price, h: price, l: price, c: price });
      this._schedSave(key);
      return;
    }
    if (cTime === last.t) {
      if (price > last.h) last.h = price;
      if (price < last.l) last.l = price;
      last.c = price;
      return;
    }
    // frame rolled over — open a new candle ONLY if price changed vs last close
    if (price !== last.c) {
      arr.push({ t: cTime, o: price, h: price, l: price, c: price });
      if (arr.length > MAX_CANDLES) arr.shift();   // FIFO: keep last 150
      this._schedSave(key);
    }
  }

  _schedSave(key) {
    if (!db) return;
    if (this._saveTimers[key]) clearTimeout(this._saveTimers[key]);
    this._saveTimers[key] = setTimeout(() => {
      delete this._saveTimers[key];
      this._save(key);
    }, 3000);
  }

  _save(key) {
    const candles = this.candles[key];
    if (!db || !candles || !candles.length) return;
    db.from('candles')
      .upsert({ key, data: candles, updated_at: new Date().toISOString() })
      .then(({ error }) => { if (error) err('save', key, error.message); })
      .catch(e => err('save', key, e.message));
  }

  isMarketOpen(symbol) {
    const lc = this.lastChange[symbol];
    return lc ? (Date.now() - lc) < 90_000 : false;
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  Persistent session engine
// ════════════════════════════════════════════════════════════════════════════
class OtcEngine {
  constructor(adapter) {
    this.adapter   = adapter;
    this.browser   = null;
    this.page      = null;
    this.cdp       = null;
    this.ready     = false;
    this.prices    = {};         // symbol → latest price
    this._priceAt  = {};         // symbol → ms when its WS price last arrived
    this.store     = new CandleStore();
    this.resolver  = new PriceResolver(adapter);   // self-healing DOM fallback
    this.breaker   = new CircuitBreaker();         // per-pair circuit breaker
    this._domBusy  = false;
    this._memGuardBusy = false;
    this.enabledSymbols = new Set();
    this.scanRequested  = false;
    this._scanAssets    = [];    // assets captured during a scan window
    this._scanning      = false;
    this.loginFails     = 0;
    this.reconnects     = 0;
    this._reconnecting  = false;   // a reconnect/login attempt is in flight
    this._reconnectTimer = null;   // pending backoff timer
    this._unknownFrameSamples = 0;
    this._lastPricesWrite = 0;
  }

  // Smart backoff between login attempts so we never hammer PO (which would get
  // the account/IP blocked): 1st failure → 5s, 2nd → 15s, 3rd+ → 60s. A reconnect
  // after a previously-healthy session (loginFails 0) retries almost immediately.
  _backoffMs() {
    switch (this.loginFails) {
      case 0:  return 1000;
      case 1:  return 5000;
      case 2:  return 15000;
      default: return 60000;
    }
  }

  // ── Browser lifecycle ──────────────────────────────────────────────────────
  async launch() {
    if (!puppeteer) throw new Error('no puppeteer runtime available');
    log('launching persistent browser (low-RAM mode)…');

    // Low-memory Chromium config (Render Free = 512 MB).
    let execPath = process.env.PUPPETEER_EXECUTABLE_PATH;
    let baseArgs = [];
    let headless = true;
    if (chromium) {
      // @sparticuz/chromium: disable graphics (WebGL/GPU) for less RAM.
      try { chromium.setGraphicsMode = false; } catch (_) {}
      baseArgs = chromium.args || [];
      if (!execPath) execPath = await chromium.executablePath();
      headless = chromium.headless ?? true;
    }

    const ramArgs = [
      '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
      '--disable-gpu', '--no-zygote', '--single-process',
      '--disable-blink-features=AutomationControlled',
      '--disable-extensions', '--disable-background-networking',
      '--disable-background-timer-throttling', '--disable-default-apps',
      '--disable-sync', '--disable-translate', '--mute-audio',
      '--no-first-run', '--no-default-browser-check',
      '--disable-software-rasterizer', '--disable-features=site-per-process',
      '--js-flags=--max-old-space-size=256',
      '--window-size=900,600',
    ];
    // De-dup (chromium.args may already contain some of these).
    const argSet = new Set([...baseArgs, ...ramArgs]);

    this.browser = await puppeteer.launch({
      headless,
      executablePath: execPath || undefined,
      args: [...argSet],
      defaultViewport: { width: 900, height: 600 },
    });

    // Hard guarantee of a SINGLE tab: close any extra page/popup the moment it
    // opens (PO occasionally spawns popups/ads). Our main page is kept.
    this.browser.on('targetcreated', async (target) => {
      try {
        if (target.type() !== 'page') return;
        const pg = await target.page();
        if (pg && pg !== this.page) {
          warn('closing unexpected extra tab/popup');
          await pg.close().catch(() => {});
        }
      } catch (_) {}
    });
    this.browser.on('disconnected', () => {
      warn('browser disconnected');
      this.ready = false;
    });
    await this._openAndLogin();
  }

  async _openAndLogin() {
    this.ready = false;

    // Reuse the browser's existing default tab — never open a second one.
    const pages = await this.browser.pages();
    this.page = (pages && pages[0]) ? pages[0] : await this.browser.newPage();

    await this.page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );

    // Strong resource blocking — abort heavy assets to keep RAM/CPU minimal.
    // Only HTML + JS + the data sockets are allowed; the price comes from the
    // websocket feed, so blocked images/css/fonts never matter.
    try {
      await this.page.setRequestInterception(true);
      this.page.removeAllListeners('request');
      this.page.on('request', (req) => {
        try {
          const type = req.resourceType();
          const url  = req.url();
          if (BLOCKED_RESOURCE_TYPES.has(type) || BLOCKED_URL_RE.test(url)) {
            req.abort();
          } else {
            req.continue();
          }
        } catch (_) { try { req.continue(); } catch (_) {} }
      });
    } catch (e) { warn('request interception setup failed:', e.message); }

    // Tap the page's own websocket frames via CDP — this is how we read the live
    // price every second from the SAME open session (no per-read tab, no cookies).
    try { if (this.cdp) await this.cdp.detach(); } catch (_) {}
    this.cdp = await this.page.target().createCDPSession();
    await this.cdp.send('Network.enable');
    this.cdp.removeAllListeners('Network.webSocketFrameReceived');
    this.cdp.on('Network.webSocketFrameReceived', ({ response }) => {
      this._onFrame(response && response.payloadData);
    });
    // PO sometimes wraps payloads in the *sent* direction too; harmless to ignore.

    // Go to the chart page; if it bounces to login, authenticate then return.
    await this.page.goto(this.adapter.chartUrl, { waitUntil: 'networkidle2', timeout: 60_000 })
      .catch(() => {});

    if (!(await this.adapter.isLoggedIn(this.page))) {
      log('not logged in — authenticating…');
      // Tell clients we're re-logging into the platform (state 4).
      await this._reportStatus({ connected: true, loggedIn: false, phase: 'relogin' });
      await this.adapter.login(this.page);
      this.loginFails = 0;
      log('login OK — opening chart page');
      await this.page.goto(this.adapter.chartUrl, { waitUntil: 'networkidle2', timeout: 60_000 })
        .catch(() => {});
    } else {
      log('already logged in');
    }

    this.ready = true;
    await this._reportStatus({ connected: true, loggedIn: true, phase: 'live', lastError: '' });
    log('session live on', this.page.url());
  }

  _onFrame(payload) {
    if (!payload) return;
    let res;
    try { res = this.adapter.parseFrame(payload); } catch (_) { res = null; }
    if (!res) {
      // Sample a few unparsed frames to the log to aid selector/format tuning.
      if (this._unknownFrameSamples < 8 && /otc/i.test(String(payload))) {
        this._unknownFrameSamples++;
        log('unparsed frame sample:', String(payload).slice(0, 200));
      }
      return;
    }
    if (res.prices) {
      const now = Date.now();
      for (const [sym, price] of Object.entries(res.prices)) {
        this.prices[sym] = price;
        this._priceAt[sym] = now;   // WS source freshness (for DOM-fallback gating)
      }
    }
    if (res.assets && res.assets.length && this._scanning) {
      for (const a of res.assets) {
        if (!this._scanAssets.some(x => x.symbol === a.symbol)) this._scanAssets.push(a);
      }
    }
  }

  // ── Health check + auto-reconnect ──────────────────────────────────────────
  async healthCheck() {
    // Don't probe while a reconnect (with its backoff) is already in progress.
    if (this._reconnecting || this._reconnectTimer) return;
    try {
      const dead = !this.browser || !this.browser.connected ||
                   !this.page || this.page.isClosed();
      let loggedIn = false;
      if (!dead) loggedIn = await this.adapter.isLoggedIn(this.page);

      if (dead || !loggedIn) {
        warn(`health check failed (dead=${dead}, loggedIn=${loggedIn}) — scheduling reconnect`);
        this._scheduleReconnect();
      } else {
        this.loginFails = 0;   // healthy → reset backoff
        await this._reportStatus({ connected: true, loggedIn: true, lastError: '' });
      }
    } catch (e) {
      warn(`health check threw (${e.message}) — scheduling reconnect`);
      this._scheduleReconnect();
    }
  }

  // Schedule a single reconnect after the smart backoff delay. Idempotent: if a
  // reconnect is already pending or running, this is a no-op (prevents bursts).
  _scheduleReconnect(reason) {
    if (this._reconnecting || this._reconnectTimer) return;
    this.ready = false;
    const delay = this._backoffMs();
    warn(`reconnect scheduled in ${Math.round(delay / 1000)}s ` +
         `(consecutive fails=${this.loginFails})${reason ? ' — ' + reason : ''}`);
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this._reconnect();
    }, delay);
  }

  async _reconnect() {
    if (this._reconnecting) return;
    this._reconnecting = true;
    this.ready = false;
    this.reconnects++;
    log(`reconnect attempt #${this.reconnects}…`);
    // Tell clients we're re-establishing the session (state 4).
    await this._reportStatus({ connected: false, loggedIn: false, phase: 'reconnecting' });
    try {
      // Recreate the browser if it died (Target closed / detached), else just
      // re-login on the SAME single tab (no new tab, no churn).
      if (!this.browser || !this.browser.connected) {
        try { if (this.browser) await this.browser.close(); } catch (_) {}
        await this.launch();
      } else {
        await this._openAndLogin();
      }
      this.loginFails = 0;            // success → reset backoff
      this._reconnecting = false;
      log('reconnect OK — session live again');
    } catch (e) {
      this.loginFails++;
      this._reconnecting = false;
      err(`reconnect/login failed (${this.loginFails} in a row): ${e.message}`);
      // State 8: a genuine LOGIN failure (≥3 in a row) needs manual intervention
      // (password changed / account locked / extra verification). Distinct phase
      // + a distinct, unmistakable admin alert. TradingView pairs are unaffected.
      const ipBlocked = /IP_BLOCKED/.test(e.message);
      const phase = ipBlocked ? 'ip_blocked'
                  : this.loginFails >= MAX_LOGIN_FAILS ? 'login_failed'
                  : 'reconnecting';
      await this._reportStatus({ connected: false, loggedIn: false, phase, lastError: e.message });
      if (ipBlocked) {
        err('🟧🟧🟧 OTC: Pocket Option appears to have BLOCKED the server IP (bot challenge) 🟧🟧🟧');
        err('Stealth may have been detected. The backoff keeps retrying; consider rotating IP if persistent.');
      }
      if (this.loginFails >= MAX_LOGIN_FAILS && !ipBlocked) {
        err('🟥🟥🟥 ADMIN ACTION REQUIRED — OTC LOGIN FAILED 🟥🟥🟥');
        err(`Pocket Option login failed ${this.loginFails} times in a row (NOT a session drop).`);
        err('Likely cause: password changed, account locked, or extra verification (captcha/2FA).');
        err(`Last error: ${e.message}`);
        err('Fix PO_EMAIL / PO_PASSWORD on Render, or clear the verification, then it self-heals.');
        err('(TradingView forex pairs keep running normally — only OTC is affected.)');
        err('🟥🟥🟥────────────────────────────────────────────────🟥🟥🟥');
      }
      // Re-arm with the next (longer) backoff step.
      this._scheduleReconnect('previous attempt failed');
    }
  }

  // ── Per-second price → candle tick (only for enabled pairs) ────────────────
  tickAll() {
    for (const sym of this.enabledSymbols) {
      const price = this.prices[sym];
      if (price != null) this.store.tick(sym, price);
    }
    this._flushPrices();
  }

  // Write the latest per-second price of every enabled pair to configs/otc_prices
  // (one row, batched) so the user chart can render OTC live. Throttled + only
  // when something changed, to keep write volume sane.
  _flushPrices() {
    if (!db) return;
    const now = Date.now();
    if (now - this._lastPricesWrite < PRICE_MS) return;
    const snapshot = {};
    let any = false;
    for (const sym of this.enabledSymbols) {
      const p = this.prices[sym];
      if (p == null) continue;   // no data yet → client shows warming/unavailable
      // Per-pair state hint so the client can pick the exact status message:
      //   circuit   → breaker open for this pair
      //   resolving → alive but the price source has gone stale (read failing)
      //   closed    → price present but market not moving (closed)
      //   live      → flowing normally
      let st;
      const stale = this._priceAt[sym] && (now - this._priceAt[sym] > 10_000);
      if (!this.breaker.canAttempt(sym)) st = 'circuit';
      else if (stale)                    st = 'resolving';
      else if (!this.store.isMarketOpen(sym)) st = 'closed';
      else st = 'live';
      snapshot[sym] = { p, o: this.store.isMarketOpen(sym), t: Math.floor(now / 1000), st };
      any = true;
    }
    if (!any) return;
    this._lastPricesWrite = now;
    db.from('configs').update({ data: snapshot }).eq('id', 'otc_prices')
      .then(({ error }) => { if (error) err('otc_prices write:', error.message); })
      .catch(e => err('otc_prices write:', e.message));
  }

  async _reportStatus(patch) {
    if (!db) return;
    // phase tells the client the precise macro-state so it can show the right
    // message: 'live' | 'relogin' | 'reconnecting' | 'boot'. updatedAt is a
    // heartbeat — a stale value means the whole process/Render is down.
    this._phase = patch.phase || this._phase || 'boot';
    try {
      await db.from('configs').update({
        data: {
          connected: !!patch.connected,
          loggedIn:  !!patch.loggedIn,
          phase:     this._phase,
          reconnects: this.reconnects,
          lastError: patch.lastError || '',
          updatedAt: new Date().toISOString(),
        },
      }).eq('id', 'otc_status');
    } catch (_) {}
  }

  // ── Self-healing DOM price fallback ─────────────────────────────────────────
  // For enabled pairs whose websocket price has gone stale (likely a site format
  // change), read the price straight from the DOM via the 4-layer resolver,
  // gated by the per-pair circuit breaker. One pair failing never blocks others.
  async domFallback() {
    if (!this.ready || this._domBusy || !this.page) return;
    this._domBusy = true;
    try {
      const now = Date.now();
      for (const sym of this.enabledSymbols) {
        const fresh = this._priceAt[sym] && (now - this._priceAt[sym] < 6000);
        if (fresh) continue;                          // WS still feeding → skip
        if (!this.breaker.canAttempt(sym)) continue;  // circuit open for this pair
        let r = null;
        try { r = await this.resolver.resolve(this.page, sym); } catch (_) {}
        if (r && r.price > 0) {
          this.prices[sym]   = r.price;
          this._priceAt[sym] = Date.now();
          this.breaker.success(sym);
        } else {
          this.breaker.failure(sym);
        }
      }
    } catch (e) {
      warn('domFallback error:', e.message);
    } finally {
      this._domBusy = false;
    }
  }

  // ── Pre-emptive memory guard ────────────────────────────────────────────────
  // If RSS crosses 85% of the limit, restart ONLY the browser instance (not the
  // whole process) so Chromium's memory is reclaimed before an OOM can happen.
  async memoryGuard() {
    if (this._memGuardBusy || this._reconnecting) return;
    const limitMb = parseInt(process.env.OTC_MEM_LIMIT_MB || '512', 10);
    const rssMb = process.memoryUsage().rss / (1024 * 1024);
    if (rssMb < limitMb * 0.85) return;
    this._memGuardBusy = true;
    warn(`memory guard: RSS ${Math.round(rssMb)}MB ≥ 85% of ${limitMb}MB — restarting browser`);
    try {
      await this.softRestartBrowser();
    } catch (e) {
      err('memory guard restart failed:', e.message);
      this._scheduleReconnect('memory-guard restart failed');
    } finally {
      this._memGuardBusy = false;
    }
  }

  async softRestartBrowser() {
    this.ready = false;
    try { if (this.cdp) await this.cdp.detach(); } catch (_) {}
    try { if (this.browser) await this.browser.close(); } catch (_) {}
    this.browser = null; this.page = null; this.cdp = null;
    if (global.gc) { try { global.gc(); } catch (_) {} }
    await this.launch();   // fresh, clean browser + page + re-login
    log('browser soft-restarted (memory guard)');
  }

  // ── Enabled-pairs sync (from otc_pairs library) ────────────────────────────
  applyEnabled(symbols) {
    this.enabledSymbols = new Set(symbols);
    this.store.setEnabled(symbols);
    log(`tracking ${this.enabledSymbols.size} enabled OTC pair(s):`,
        [...this.enabledSymbols].join(', ') || '(none)');
  }

  // ── Discovery ("جلب الأزواج") ───────────────────────────────────────────────
  async runScan() {
    if (this._scanning) return;
    this._scanning   = true;
    this._scanAssets = [];
    log('scan: discovering OTC pairs…');
    await this._reportScan({ status: 'scanning', message: 'جاري البحث عن الأزواج…' });

    try {
      if (!this.ready) throw new Error('session not ready');
      // Open the assets panel so PO emits its asset catalogue frame + renders DOM.
      try {
        await this.page.evaluate(() => {
          const opener = document.querySelector(
            '.current-symbol, .asset-select, .pair-number-wrap, [data-test="asset-select"]'
          );
          if (opener) opener.click();
        });
      } catch (_) {}

      // Collect for a few seconds from both the websocket frames and the DOM.
      const waitMs = 6000;
      const start  = Date.now();
      while (Date.now() - start < waitMs) {
        await new Promise(r => setTimeout(r, 500));
      }
      const domAssets = await this.adapter.discoverAssetsFromDom(this.page);
      for (const a of domAssets) {
        const symbol = this.adapter.normalize(a.raw || a.label);
        if (symbol && !this._scanAssets.some(x => x.symbol === symbol)) {
          this._scanAssets.push({ symbol, name: a.label && /\//.test(a.label)
            ? a.label : this.adapter.displayName(symbol) });
        }
      }

      const found = this._scanAssets;
      log(`scan: found ${found.length} OTC pair(s)`);
      await this._upsertLibrary(found);
      await this._reportScan({
        status: 'done', count: found.length,
        message: `تم العثور على ${found.length} زوج`,
      });
    } catch (e) {
      err('scan failed:', e.message);
      await this._reportScan({ status: 'error', message: e.message });
    } finally {
      this._scanning = false;
    }
  }

  async _upsertLibrary(assets) {
    if (!db || !assets.length) return;
    // Upsert on (platform,symbol). We intentionally DON'T send `enabled`,
    // `subcategory` or `order` so a re-scan never clobbers the admin's choices
    // (PostgREST only updates the columns we provide). New rows get the table
    // defaults (enabled=false, subcategory='forex', order=0).
    const rows = assets.map((a) => ({
      platform:   this.adapter.id,
      symbol:     a.symbol,
      name:       a.name || this.adapter.displayName(a.symbol),
      updated_at: new Date().toISOString(),
    }));
    const { error } = await db.from('otc_pairs')
      .upsert(rows, { onConflict: 'platform,symbol', ignoreDuplicates: false });
    if (error) err('library upsert:', error.message);
    else log(`library: upserted ${rows.length} pair(s)`);
  }

  async _reportScan(patch) {
    if (!db) return;
    try {
      const { data } = await db.from('configs').select('data').eq('id', 'otc_scan').single();
      const cur = (data && data.data) || {};
      await db.from('configs').update({
        data: { ...cur, ...patch, updatedAt: new Date().toISOString() },
      }).eq('id', 'otc_scan');
    } catch (_) {}
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  Control plane — Supabase realtime wiring
// ════════════════════════════════════════════════════════════════════════════
async function loadEnabledSymbols() {
  if (!db) return [];
  const { data, error } = await db.from('otc_pairs')
    .select('symbol, platform, enabled').eq('enabled', true);
  if (error) { err('load enabled:', error.message); return []; }
  return (data || []).map(r => r.symbol);
}

async function start() {
  if (!PO_EMAIL || !PO_PASSWORD) {
    warn('PO_EMAIL / PO_PASSWORD not set — OTC scraper disabled');
    return;
  }
  const adapter = new PocketOptionAdapter();
  const engine  = new OtcEngine(adapter);

  // Boot the persistent session once; on failure the smart-backoff scheduler
  // (5s → 15s → 60s) takes over so we never hammer PO into a block.
  try {
    await engine.launch();
  } catch (e) {
    engine.loginFails++;
    err(`boot failed: ${e.message}`);
    await engine._reportStatus({ connected: false, loggedIn: false, lastError: e.message });
    engine._scheduleReconnect('initial boot failed');
  }

  // Apply currently-enabled pairs + hydrate their candle history.
  const enabled = await loadEnabledSymbols();
  engine.applyEnabled(enabled);
  await engine.store.hydrate(enabled);

  // Per-second candle tick (24/7, independent of connected users).
  setInterval(() => engine.tickAll(), PRICE_MS);

  // Health check + auto-reconnect every minute.
  setInterval(() => engine.healthCheck(), HEALTH_MS);

  // Self-healing DOM price fallback for any pair whose WS feed went stale.
  setInterval(() => engine.domFallback(), 3000);

  // Pre-emptive memory guard (restart browser before OOM) every minute.
  setInterval(() => engine.memoryGuard(), HEALTH_MS);

  // Realtime: react to enable/disable + new pairs in the library.
  if (db) {
    db.channel('otc-pairs-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'otc_pairs' },
        async () => {
          const syms = await loadEnabledSymbols();
          engine.applyEnabled(syms);
          await engine.store.hydrate(syms);
        })
      .subscribe(s => { if (s === 'SUBSCRIBED') log('otc_pairs realtime active'); });

    // Realtime: admin "جلب الأزواج" → configs/otc_scan.requestedAt changes.
    let lastScanReq = null;
    db.channel('otc-scan-trigger')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'configs', filter: 'id=eq.otc_scan' },
        payload => {
          const req = payload.new && payload.new.data && payload.new.data.requestedAt;
          if (req && req !== lastScanReq) { lastScanReq = req; engine.runScan(); }
        })
      .subscribe(s => { if (s === 'SUBSCRIBED') log('otc_scan realtime active'); });

    // Catch a scan requested while we were booting.
    try {
      const { data } = await db.from('configs').select('data').eq('id', 'otc_scan').single();
      const req = data && data.data && data.data.requestedAt;
      const status = data && data.data && data.data.status;
      if (req && status === 'requested') { lastScanReq = req; engine.runScan(); }
    } catch (_) {}
  }

  log('OTC scraper started');
}

module.exports = { start, PocketOptionAdapter, CandleStore, OtcEngine };

// Auto-start when run/required directly (start.js requires this module).
if (require.main === module || process.env.OTC_AUTOSTART !== '0') {
  start().catch(e => err('fatal:', e.message));
}
