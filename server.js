'use strict';

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const { WebSocket, WebSocketServer } = require('ws');

// ── Supabase (pairs listener) ─────────────────────────────────────────────────
let db = null;
try {
  const { createClient } = require('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (url && key) {
    db = createClient(url, key);
    console.log('[Supabase] initialized');
  } else {
    console.warn('[Supabase] SUPABASE_URL / SUPABASE_SERVICE_KEY not set — pairs listener disabled');
  }
} catch (e) {
  console.error('[Supabase] init failed:', e.message);
}


// ── Browser WebSocket clients ─────────────────────────────────────────────────
const wss       = new WebSocketServer({ noServer: true });
const clientMap = new Map(); // ws → Set<tvSym>
const ipConns   = new Map(); // ip → Set<ws>  (cap connections/tabs per user)
const MAX_CONNS_PER_IP = 4;

function clientIp(req) {
  const xff = (req && req.headers && (req.headers['x-forwarded-for'] || '')).split(',')[0].trim();
  return xff || (req && req.socket && req.socket.remoteAddress) || 'unknown';
}

wss.on('connection', (ws, req) => {
  const ip = clientIp(req);
  let set = ipConns.get(ip);
  if (!set) { set = new Set(); ipConns.set(ip, set); }
  // Per-IP cap: a new tab closes the OLDEST connection so the newest always works.
  while (set.size >= MAX_CONNS_PER_IP) {
    const oldest = set.values().next().value;
    set.delete(oldest);
    try { oldest.close(4001, 'too many connections'); } catch (_) {}
  }
  set.add(ws);

  clientMap.set(ws, new Set());
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      const subs = clientMap.get(ws);
      if (!subs) return;
      if (msg.sub)   subs.add(msg.sub);
      if (msg.unsub) subs.delete(msg.unsub);
    } catch (_) {}
  });
  const cleanup = () => {
    clientMap.delete(ws);
    const s = ipConns.get(ip);
    if (s) { s.delete(ws); if (!s.size) ipConns.delete(ip); }
  };
  ws.on('close', cleanup);
  ws.on('error', cleanup);
});

function broadcastPrice(tvSym, price) {
  // The chart subscribes with the BARE symbol (e.g. "EURUSD") while we broadcast
  // the full prefixed symbol (e.g. "OANDA:EURUSD"). Match on the bare form so the
  // live price actually reaches the client (otherwise the chart freezes).
  const bare = bareSymbol(tvSym);
  for (const [ws, subs] of clientMap) {
    if (ws.readyState !== WebSocket.OPEN) continue;
    let match = subs.has(tvSym);
    if (!match) {
      for (const s of subs) { if (bareSymbol(s) === bare) { match = true; break; } }
    }
    if (match) {
      try { ws.send(JSON.stringify({ sym: tvSym, price })); } catch (_) {}
    }
  }
}

// ── Candle persistence ────────────────────────────────────────────────────────

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

function keyToFile(key) {
  return path.join(DATA_DIR, key.replace(/[:/]/g, '_') + '.json');
}

const PORT   = process.env.PORT || 3000;
const TV_URL = 'wss://data.tradingview.com/socket.io/websocket?from=chart%2F&date=2024_01_01-00_01&type=chart';

// ── Interval helpers ──────────────────────────────────────────────────────────

function ivToTV(iv) {
  switch (iv) {
    case '5m':  return '5';
    case '15m': return '15';
    case '1h':  return '60';
    case '1D':  return 'D';
    default:    return '1';   // 1m
  }
}

function ivToSeconds(iv) {
  switch (iv) {
    case '5m':  return 300;
    case '15m': return 900;
    case '1h':  return 3600;
    case '1D':  return 86400;
    default:    return 60;
  }
}

// Strip prefix if present, return bare symbol
function bareSymbol(sym) {
  return sym.replace(/^[A-Z]+:/, '').replace(/_/g, '').toUpperCase();
}

// Find the full prefixed symbol we have data for, fallback to OANDA:bare
function normalizeSymbol(sym) {
  if (sym.includes(':')) return sym.toUpperCase();
  const bare = bareSymbol(sym);
  // Check AUTO_SYMBOLS first
  for (const auto of AUTO_SYMBOLS) {
    if (bareSymbol(auto) === bare) return auto;
  }
  // Check candle store for any exchange that has this symbol
  for (const key of Object.keys(tv.candles)) {
    const keySym = key.replace(/_[^_]+$/, ''); // strip "_1m" etc
    if (bareSymbol(keySym) === bare) return keySym;
  }
  return 'OANDA:' + bare;
}

function mkId(prefix) {
  return prefix + Math.random().toString(36).slice(2, 14);
}

// ── Symbols to track 24/7 (subscribed on startup) ────────────────────────────

const AUTO_SYMBOLS = [
  // Forex majors + minors
  'OANDA:EURUSD','OANDA:GBPUSD','OANDA:USDJPY','OANDA:AUDUSD',
  'OANDA:USDCAD','OANDA:USDCHF','OANDA:EURGBP','OANDA:EURJPY',
  'OANDA:GBPJPY','OANDA:NZDUSD','OANDA:AUDCAD','OANDA:AUDCHF',
  'OANDA:AUDJPY','OANDA:AUDNZD','OANDA:CADJPY','OANDA:CADCHF',
  'OANDA:CHFJPY','OANDA:EURCAD','OANDA:EURCHF','OANDA:EURAUD',
  'OANDA:EURNZD','OANDA:EURTRY','OANDA:GBPAUD','OANDA:GBPCAD',
  'OANDA:GBPCHF','OANDA:NZDJPY','OANDA:USDMXN','OANDA:USDINR',
  'OANDA:USDSGD','OANDA:USDCNH','OANDA:USDRUB','OANDA:EURHUF',
  'OANDA:EURRUB','OANDA:CHFNOK','OANDA:USDPHP','OANDA:USDBRL',
  'OANDA:USDZAR',
  // Metals & Commodities
  'OANDA:XAUUSD','OANDA:XAGUSD','OANDA:XPDUSD','OANDA:XPTUSD',
  'OANDA:BRENTUSD','OANDA:WTICOUSD','OANDA:NATGASUSD',
  // Crypto
  'COINBASE:BTCUSD','BINANCE:ETHUSDT','BINANCE:ADAUSDT',
  'BINANCE:SOLUSDT','BINANCE:BNBUSDT','BINANCE:DOGEUSDT',
  'BINANCE:LINKUSDT','BINANCE:DOTUSDT','BINANCE:AVAXUSDT',
  'BINANCE:TRXUSDT','BINANCE:LTCUSDT','BINANCE:TONUSDT',
  'BINANCE:DASHUSDT','BINANCE:BCHUSDT',
];
const AUTO_IVS = ['1m', '5m', '15m', '1h', '1D'];

// ── TradingView WebSocket Client ──────────────────────────────────────────────

class TVClient {
  constructor() {
    this.ws          = null;
    this.ready       = false;

    // Data caches
    this.prices      = {};  // tvSym → number
    this.candles     = {};  // `${tvSym}_${iv}` → Candle[]
    this.lastChange  = {};  // tvSym → ms timestamp of last price CHANGE (market-open detection)

    // Session registries
    this.cSess       = {};  // csId → {tvSym, iv}
    this.qSess       = {};  // qsId → tvSym
    this.symQS       = {};  // tvSym → qsId  (one quote session per symbol)
    this.keyCS       = {};  // `${tvSym}_${iv}` → csId

    this._saveTimers = {};  // key → setTimeout handle

    this._loadAll();
    this._connect();
  }

  // ── Persistence ──────────────────────────────────────────────────────────────

  async _loadAll() {
    // Hydrate candle history from Supabase so the chart has data instantly,
    // even right after a cold start / redeploy (Render disk is ephemeral).
    if (!db) return;
    try {
      const { data, error } = await db.from('candles').select('key, data');
      if (error) { console.error('[Supabase] hydrate error:', error.message); return; }
      let n = 0;
      for (const row of (data || [])) {
        if (row.key && Array.isArray(row.data) && row.data.length) {
          this.candles[row.key] = row.data;
          n++;
        }
      }
      console.log(`[Supabase] hydrated ${n} candle series`);
    } catch (e) {
      console.error('[Supabase] hydrate failed:', e.message);
    }
  }

  _schedSave(key) {
    // Debounce: save 3 seconds after last new candle to avoid hammering storage
    if (this._saveTimers[key]) clearTimeout(this._saveTimers[key]);
    this._saveTimers[key] = setTimeout(() => {
      delete this._saveTimers[key];
      this._saveCandles(key);
    }, 3000);
  }

  _saveCandles(key) {
    const candles = this.candles[key];
    if (!db || !candles || !candles.length) return;
    // Store the already-trimmed (<=150) array as one JSON row per key.
    // Pruning to 150 is therefore automatic. Called only when a candle CLOSES
    // (debounced), never per-tick — keeps write volume low.
    db.from('candles')
      .upsert({ key, data: candles, updated_at: new Date().toISOString() })
      .then(({ error }) => { if (error) console.error('[Supabase] save', key, error.message); })
      .catch(e => console.error('[Supabase] save', key, e.message));
  }

  _saveAll() {
    Object.keys(this.candles).forEach(key => this._saveCandles(key));
  }

  _autoSubscribe() {
    // Subscribe all symbols × all intervals on startup so cache is hot
    // Stagger 300ms per symbol to avoid flooding TradingView
    AUTO_SYMBOLS.forEach((tvSym, i) => {
      setTimeout(() => {
        if (this._destroyed) return;
        AUTO_IVS.forEach(iv => this.subscribe(tvSym, iv));
      }, i * 300);
    });
  }

  // ── Connection ──────────────────────────────────────────────────────────────

  _connect() {
    if (this.ws) { try { this.ws.terminate(); } catch (_) {} }
    this.ready = false;

    this.ws = new WebSocket(TV_URL, {
      headers: {
        Origin:     'https://www.tradingview.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    });

    this.ws.on('open', () => {
      console.log('[TV] Connected');
      this.ready = true;
      this._send({ m: 'set_auth_token', p: ['unauthorized_user_token'] });
      // Re-subscribe existing sessions after reconnect
      Object.entries(this.keyCS).forEach(([key, cs]) => {
        const { tvSym, iv } = this.cSess[cs];
        this._doSubscribeChart(tvSym, iv, cs);
      });
      Object.entries(this.symQS).forEach(([tvSym, qs]) => {
        this._doSubscribeQuote(tvSym, qs);
      });
      // NOTE: We intentionally do NOT auto-subscribe the big hardcoded
      // AUTO_SYMBOLS list — subscribing 200+ series on one socket makes
      // TradingView drop the connection (flapping → stale data). We only
      // track the pairs the admin actually added (see startPairsListener),
      // which keeps the series count low and the TV connection stable/live.
    });

    this.ws.on('message', data => this._onMsg(data.toString()));

    this.ws.on('close', () => {
      console.log('[TV] Disconnected — reconnecting in 5 s');
      this.ready = false;
      setTimeout(() => this._connect(), 5000);
    });

    this.ws.on('error', err => console.error('[TV] Error:', err.message));
  }

  // ── Protocol helpers ────────────────────────────────────────────────────────

  _wrap(obj) {
    const s = JSON.stringify(obj);
    return `~m~${s.length}~m~${s}`;
  }

  _send(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(this._wrap(obj));
    }
  }

  _onMsg(raw) {
    // Heartbeat: ~h~12345
    const hb = raw.match(/^~h~(\d+)/);
    if (hb) { this.ws.send(`~h~${hb[1]}`); return; }

    // Multi-message frame: ~m~LEN~m~{...}~m~LEN~m~{...}
    const parts = raw.split(/~m~\d+~m~/);
    for (const p of parts) {
      if (!p.startsWith('{')) continue;
      try {
        const obj = JSON.parse(p);
        if (obj.m && obj.m !== 'qsd' && obj.m !== 'du') {
          console.log('[TV] msg:', obj.m, JSON.stringify(obj.p).slice(0, 120));
        }
        this._handle(obj);
      } catch (_) {}
    }
  }

  _handle(msg) {
    switch (msg.m) {

      // ── Real-time quote update ──────────────────────────────────────────────
      case 'qsd': {
        const [, data] = msg.p;
        const tvSym = data.n;
        const lp    = data.v && data.v.lp;
        if (tvSym && lp != null) {
          // Track the last time the price actually CHANGED — used to detect a
          // closed/frozen market (TradingView stops sending fresh prices).
          if (this.prices[tvSym] !== lp) this.lastChange[tvSym] = Date.now();
          this.prices[tvSym] = lp;
          broadcastPrice(tvSym, lp);
          // Update only THIS symbol's candle series — one direct lookup per known
          // interval instead of scanning the WHOLE candle store on every quote of
          // every tracked symbol. Frees the event loop so prices broadcast with
          // minimal delay (the previous full scan lagged ticks on a free CPU).
          for (let i = 0; i < AUTO_IVS.length; i++) {
            const iv = AUTO_IVS[i];
            if (this.candles[tvSym + '_' + iv]) this._tickCandle(tvSym, iv, lp);
          }
        }
        break;
      }

      // ── Historical bars (full load) ─────────────────────────────────────────
      case 'timescale_update': {
        const [cs, data] = msg.p;
        this._applyBars(cs, data, true);
        break;
      }

      // ── Incremental bar update ──────────────────────────────────────────────
      case 'du': {
        const [cs, data] = msg.p;
        this._applyBars(cs, data, false);
        break;
      }
    }
  }

  _applyBars(cs, data, full) {
    const info = this.cSess[cs];
    if (!info) return;
    const { tvSym, iv } = info;
    const key = `${tvSym}_${iv}`;
    const sds = data && data['sds_1'];
    if (!sds || !sds.s) return;

    const MAX = 150;

    if (full) {
      const all     = sds.s.map(b => ({ t: b.v[0], o: b.v[1], h: b.v[2], l: b.v[3], c: b.v[4] }));
      const trimmed = all.length > MAX ? all.slice(all.length - MAX) : all;
      const existing = this.candles[key] || [];
      // TradingView serves little/no intraday history for unauthorized sessions
      // (e.g. 1 bar for 1m). Don't let a tiny full-load wipe the candles we've
      // built live from real per-second prices. Only adopt TV's history when it
      // has at least as many candles as we already hold (true for 1h/1D).
      if (trimmed.length >= existing.length) {
        this.candles[key] = trimmed;
        console.log(`[TV] ${key}: loaded ${trimmed.length} candles`);
        this._saveCandles(key);
      }
    } else {
      if (!this.candles[key]) return;
      let newCandle = false;
      const arr = this.candles[key];
      for (const b of sds.s) {
        const bar = { t: b.v[0], o: b.v[1], h: b.v[2], l: b.v[3], c: b.v[4] };
        const last = arr.length ? arr[arr.length - 1] : null;
        if (last && last.t === bar.t) {
          // Update existing last candle in-place (same period)
          arr[arr.length - 1] = bar;
        } else if (!last || bar.t > last.t) {
          // New candle — push and trim sliding window
          arr.push(bar);
          if (arr.length > MAX) arr.shift();
          newCandle = true;
        }
      }
      if (newCandle) this._schedSave(key);
    }
  }

  // Build the live candle from the REAL price (per-second scraping):
  //   open  = first price in the frame
  //   high  = highest price reached in the frame
  //   low   = lowest price reached in the frame
  //   close = latest price
  //
  // A NEW candle opens only when BOTH conditions hold together:
  //   1) the frame's clock time has elapsed (1m=60s, 5m=300s, … 1D=86400s), AND
  //   2) the price actually CHANGED vs the last candle's close.
  // If the frame elapsed but the price is frozen (no movement / market still),
  // we do NOT open a flat candle — we wait until the price moves, then open the
  // new candle stamped at the correct (current) frame time.
  _tickCandle(tvSym, iv, price) {
    if (price == null || !isFinite(price) || price <= 0) return;
    const key   = `${tvSym}_${iv}`;
    let   arr   = this.candles[key];
    if (!arr) arr = this.candles[key] = [];
    const ivSec = ivToSeconds(iv);
    const now   = Math.floor(Date.now() / 1000);
    const cTime = Math.floor(now / ivSec) * ivSec;   // start of current frame
    const last  = arr.length ? arr[arr.length - 1] : null;

    if (!last) {
      // Very first candle for this series.
      arr.push({ t: cTime, o: price, h: price, l: price, c: price });
      this._schedSave(key);
      return;
    }

    if (cTime === last.t) {
      // Same frame → update high / low / close from the real price.
      if (price > last.h) last.h = price;
      if (price < last.l) last.l = price;
      last.c = price;
      return;
    }

    // cTime > last.t : the frame has rolled over.
    // Open a new candle ONLY if the price has changed vs the last close.
    // (Frozen price across the boundary ⇒ hold, no flat candle.)
    if (price !== last.c) {
      arr.push({ t: cTime, o: price, h: price, l: price, c: price });
      if (arr.length > 150) arr.shift();   // keep last 150, drop oldest
      this._schedSave(key);                // persist the just-closed candle
    }
  }

  // ── Subscription ────────────────────────────────────────────────────────────

  _doSubscribeQuote(tvSym, qs) {
    this._send({ m: 'quote_create_session', p: [qs] });
    this._send({ m: 'quote_set_fields',     p: [qs, 'lp', 'bid', 'ask'] });
    this._send({ m: 'quote_add_symbols',    p: [qs, tvSym] });
  }

  _doSubscribeChart(tvSym, iv, cs) {
    const tvIv = ivToTV(iv);
    this._send({ m: 'chart_create_session', p: [cs, ''] });
    this._send({ m: 'resolve_symbol',       p: [cs, 'sds_sym_1', `={"symbol":"${tvSym}","adjustment":"splits"}`] });
    this._send({ m: 'create_series',        p: [cs, 'sds_1', 's1', 'sds_sym_1', tvIv, 150] });
  }

  subscribe(tvSym, iv) {
    // Quote session (real-time price) — one per symbol
    if (!this.symQS[tvSym]) {
      const qs = mkId('qs_');
      this.symQS[tvSym] = qs;
      this.qSess[qs]    = tvSym;
      if (this.ready) this._doSubscribeQuote(tvSym, qs);
    }

    // Chart session (candles) — one per symbol+interval
    const key = `${tvSym}_${iv}`;
    if (!this.keyCS[key]) {
      const cs = mkId('cs_');
      this.keyCS[key]  = cs;
      this.cSess[cs]   = { tvSym, iv };
      this.candles[key] = [];
      if (this.ready) this._doSubscribeChart(tvSym, iv, cs);
    }
  }

  // ── Public accessors ────────────────────────────────────────────────────────

  getCandles(tvSym, iv) { return this.candles[`${tvSym}_${iv}`] || []; }

  getPrice(tvSym) {
    if (this.prices[tvSym]) return this.prices[tvSym];
    // Fallback: return last candle close across any cached interval
    for (const key of Object.keys(this.candles)) {
      if (key.startsWith(tvSym + '_')) {
        const arr = this.candles[key];
        if (arr && arr.length) return arr[arr.length - 1].c;
      }
    }
    return 0;
  }

  isConnected() { return this.ready; }

  // Market is "open" if the price changed within the last 90 s. A frozen price
  // (weekend, TradingView block, off-hours) => closed.
  isMarketOpen(tvSym) {
    const lc = this.lastChange[tvSym];
    if (!lc) return false;
    return (Date.now() - lc) < 90_000;
  }
}

const tv = new TVClient();

// ── Per-second scraping ───────────────────────────────────────────────────────
// Every second, stamp the latest REAL price onto the current candle of every
// subscribed (symbol, timeframe). Guarantees the forming candle keeps updating
// and a new candle opens exactly at each frame boundary (1m/5m/15m/1h/1D),
// even between TradingView ticks. Candles are built from real prices only.
setInterval(() => {
  for (const key of Object.keys(tv.candles)) {
    const us = key.lastIndexOf('_');
    if (us < 0) continue;
    const tvSym = key.slice(0, us);
    const iv    = key.slice(us + 1);
    const price = tv.prices[tvSym];
    if (price != null) tv._tickCandle(tvSym, iv, price);
  }
}, 1000);

// Candles are persisted to Supabase on each candle close (debounced, via
// _schedSave) — no periodic flush needed, which keeps write volume minimal.

// ── Subscribe to pairs managed by admin (Supabase real-time) ─────────────────
async function startPairsListener() {
  if (!db) return;
  // Initial load
  try {
    const { data, error } = await db.from('pairs').select('chart_symbol');
    if (!error && data) {
      data.forEach(row => {
        const chartSymbol = (row.chart_symbol || '').trim();
        if (chartSymbol && chartSymbol.includes(':')) {
          AUTO_IVS.forEach(iv => tv.subscribe(chartSymbol, iv));
          console.log('[Pairs] subscribed (init):', chartSymbol);
        }
      });
    }
  } catch (e) { console.error('[Pairs] init error:', e.message); }

  // Real-time inserts
  db.channel('pairs-inserts')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pairs' }, payload => {
      const chartSymbol = (payload.new.chart_symbol || '').trim();
      if (chartSymbol && chartSymbol.includes(':')) {
        AUTO_IVS.forEach(iv => tv.subscribe(chartSymbol, iv));
        console.log('[Pairs] subscribed (new):', chartSymbol);
      }
    })
    .subscribe(status => {
      if (status === 'SUBSCRIBED') console.log('[Pairs] realtime channel active');
    });
}
startPairsListener();



// ── HTTP Server ───────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const json = (obj, code = 200) => {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(obj));
  };

  // ── GET /api/tv/candles?symbol=EURUSD&interval=1m ────────────────────────
  if (url.pathname === '/api/tv/candles') {
    const raw   = url.searchParams.get('symbol')   || 'EURUSD';
    const iv    = url.searchParams.get('interval') || '1m';
    const tvSym = normalizeSymbol(raw);

    // Always ensure subscribed (no-op if already subscribed)
    tv.subscribe(tvSym, iv);
    const candles = tv.getCandles(tvSym, iv);

    // Return whatever we have — even stale cache is better than nothing
    // chart.js will update via WebSocket tick once live data arrives
    json({
      status:     candles.length ? 'ok' : 'loading',
      connected:  tv.isConnected(),
      marketOpen: tv.isMarketOpen(tvSym),
      candles,
    });
    return;
  }

  // ── GET /api/tv/tick?symbol=OANDA:EUR_USD ─────────────────────────────────
  if (url.pathname === '/api/tv/tick') {
    const raw   = url.searchParams.get('symbol') || 'OANDA:EURUSD';
    const tvSym = normalizeSymbol(raw);
    json({ price: tv.getPrice(tvSym), connected: tv.isConnected(), marketOpen: tv.isMarketOpen(tvSym) });
    return;
  }

  // ── GET /health ───────────────────────────────────────────────────────────
  if (url.pathname === '/health') {
    json({ status: 'ok', connected: tv.isConnected() });
    return;
  }

  // ── POST /api/pairs — add a pair ────────────────────────────────────────────
  if (url.pathname === '/api/pairs' && req.method === 'POST') {
    if (!db) { json({ error: 'Supabase not available' }, 503); return; }
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', async () => {
      try {
        const { symbol, chartSymbol, category, type, order } = JSON.parse(body || '{}');
        if (!symbol || !chartSymbol) { json({ error: 'symbol and chartSymbol required' }, 400); return; }
        const { data, error } = await db.from('pairs').insert({
          symbol, chart_symbol: chartSymbol,
          category: category || 'forex',
          type:     type     || category || 'forex',
          order:    order    || Date.now(),
        }).select('id').single();
        if (error) throw error;
        json({ id: data.id });
      } catch (e) { json({ error: e.message }, 500); }
    });
    return;
  }

  // ── POST /api/tv-scan — proxy TradingView scanner (bypasses browser CORS) ───
  if (url.pathname === '/api/tv-scan' && req.method === 'POST') {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      try {
        const { market, offset } = JSON.parse(body || '{}');
        if (!market) { json({ error: 'market required' }, 400); return; }
        const scanBody = JSON.stringify({
          columns: ['name', 'description', 'exchange', 'type', 'subtype'],
          sort: { sortBy: 'name', sortOrder: 'asc' },
          range: [offset || 0, (offset || 0) + 2000],
        });
        const options = {
          hostname: 'scanner.tradingview.com',
          path:     `/${market}/scan`,
          method:   'POST',
          headers: {
            'Content-Type':    'application/json',
            'Content-Length':  Buffer.byteLength(scanBody),
            'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Origin':          'https://www.tradingview.com',
            'Referer':         'https://www.tradingview.com/',
            'Accept':          'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control':   'no-cache',
            'Pragma':          'no-cache',
          },
        };
        const tvReq = https.request(options, (tvRes) => {
          let chunks = [];
          tvRes.on('data', c => chunks.push(c));
          tvRes.on('end', () => {
            const raw = Buffer.concat(chunks);
            res.writeHead(tvRes.statusCode, { 'Content-Type': 'application/json' });
            res.end(raw);
          });
        });
        tvReq.setTimeout(25000, () => {
          tvReq.destroy();
          json({ error: 'TradingView timeout' }, 504);
        });
        tvReq.on('error', e => { try { json({ error: e.message }, 500); } catch(_) {} });
        tvReq.write(scanBody);
        tvReq.end();
      } catch (e) { json({ error: e.message }, 500); }
    });
    return;
  }

  // ── PUT /api/pairs/:docId — update a pair ───────────────────────────────────
  if (url.pathname.startsWith('/api/pairs/') && req.method === 'PUT') {
    if (!db) { json({ error: 'Supabase not available' }, 503); return; }
    const docId = url.pathname.replace('/api/pairs/', '').trim();
    if (!docId) { json({ error: 'docId required' }, 400); return; }
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', async () => {
      try {
        const { symbol, chartSymbol, category, type } = JSON.parse(body || '{}');
        const updates = {};
        if (symbol) updates.symbol = symbol;
        if (chartSymbol) updates.chart_symbol = chartSymbol;
        if (category) updates.category = category;
        if (type) updates.type = type;
        const { error } = await db.from('pairs').update(updates).eq('id', docId);
        if (error) throw error;
        json({ ok: true });
      } catch (e) { json({ error: e.message }, 500); }
    });
    return;
  }

  // ── DELETE /api/pairs/:docId — remove a pair ─────────────────────────────
  if (url.pathname.startsWith('/api/pairs/') && req.method === 'DELETE') {
    if (!db) { json({ error: 'Supabase not available' }, 503); return; }
    const docId = url.pathname.replace('/api/pairs/', '').trim();
    if (!docId) { json({ error: 'docId required' }, 400); return; }
    try {
      const { error } = await db.from('pairs').delete().eq('id', docId);
      if (error) throw error;
      json({ ok: true });
    } catch (e) { json({ error: e.message }, 500); }
    return;
  }

  res.writeHead(404); res.end('Not found');

});

server.on('upgrade', (req, socket, head) => {
  if (new URL(req.url, 'http://x').pathname === '/ws') {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  } else {
    socket.destroy();
  }
});

server.listen(PORT, () => {
  console.log(`Proxy ready on http://localhost:${PORT}`);
  console.log('TV WebSocket connecting…');

  // Keep-alive: ping self every 10 min so Render free tier never sleeps
  // (idle spin-down is ~15 min). Uses https.get (always available) instead of
  // fetch (undefined on older Node). RENDER_EXTERNAL_URL is provided by Render.
  const SELF_URL = (process.env.RENDER_EXTERNAL_URL || 'https://euro-trade-proxy.onrender.com').replace(/\/$/, '');
  setInterval(() => {
    try {
      https.get(SELF_URL + '/health', r => r.resume()).on('error', () => {});
    } catch (_) {}
  }, 10 * 60 * 1000);

});
