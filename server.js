'use strict';

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const { WebSocket, WebSocketServer } = require('ws');

// ── Firebase Admin (Firestore persistence) ────────────────────────────────────
let db = null;
try {
  const admin = require('firebase-admin');
  const raw   = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
    db = admin.firestore();
    console.log('[Firestore] initialized');
  } else {
    console.warn('[Firestore] FIREBASE_SERVICE_ACCOUNT not set — using disk only');
  }
} catch (e) {
  console.error('[Firestore] init failed:', e.message, '— using disk only');
}

// Sanitize key for Firestore doc ID (no colons or slashes)
function fsDocId(key) { return key.replace(/[:/]/g, '_'); }

async function fsLoad(key) {
  if (!db) return null;
  try {
    const snap = await db.collection('tv_cache').doc(fsDocId(key)).get();
    if (snap.exists) {
      const data = snap.data();
      if (Array.isArray(data.candles) && data.candles.length) return data.candles;
    }
  } catch (e) { console.error('[Firestore] load error:', key, e.message); }
  return null;
}

async function fsSave(key, candles) {
  if (!db || !candles || !candles.length) return;
  try {
    await db.collection('tv_cache').doc(fsDocId(key)).set(
      { candles, updated: Date.now() },
      { merge: false }
    );
  } catch (e) { console.error('[Firestore] save error:', key, e.message); }
}

// ── Browser WebSocket clients ─────────────────────────────────────────────────
const wss       = new WebSocketServer({ noServer: true });
const clientMap = new Map(); // ws → Set<tvSym>

wss.on('connection', (ws) => {
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
  ws.on('close', () => clientMap.delete(ws));
  ws.on('error', () => clientMap.delete(ws));
});

function broadcastPrice(tvSym, price) {
  for (const [ws, subs] of clientMap) {
    if (subs.has(tvSym) && ws.readyState === WebSocket.OPEN) {
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
  const bare = bareSymbol(sym);
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
const AUTO_IVS = ['1m', '5m', '15m', '1h'];

// ── TradingView WebSocket Client ──────────────────────────────────────────────

class TVClient {
  constructor() {
    this.ws          = null;
    this.ready       = false;

    // Data caches
    this.prices      = {};  // tvSym → number
    this.candles     = {};  // `${tvSym}_${iv}` → Candle[]

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

  _loadAll() {
    // Load from disk first (fast, synchronous) as immediate baseline
    try {
      const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
      for (const file of files) {
        try {
          const raw  = fs.readFileSync(path.join(DATA_DIR, file), 'utf8');
          const data = JSON.parse(raw);
          if (data.key && Array.isArray(data.candles) && data.candles.length) {
            this.candles[data.key] = data.candles;
            console.log(`[disk] loaded ${data.candles.length} candles for ${data.key}`);
          }
        } catch (_) {}
      }
    } catch (_) {}

    // Then hydrate from Firestore for all AUTO_SYMBOLS (overrides disk with fresher data)
    if (db) {
      const self = this;
      const keys = [];
      AUTO_SYMBOLS.forEach(sym => AUTO_IVS.forEach(iv => keys.push(`${sym}_${iv}`)));
      let loaded = 0;
      keys.forEach(key => {
        fsLoad(key).then(candles => {
          if (candles) {
            const disk = self.candles[key];
            // Use Firestore data if it has more candles or fresher last candle
            if (!disk || candles.length >= disk.length) {
              self.candles[key] = candles;
              console.log(`[Firestore] hydrated ${candles.length} candles for ${key}`);
            }
          }
          loaded++;
          if (loaded === keys.length) console.log('[Firestore] hydration complete');
        });
      });
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
    if (!candles || !candles.length) return;
    // Disk (sync, fast fallback)
    try { fs.writeFileSync(keyToFile(key), JSON.stringify({ key, candles })); } catch (_) {}
    // Firestore (async, persistent across restarts)
    fsSave(key, candles);
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
      // Auto-subscribe all tracked symbols on startup / reconnect
      this._autoSubscribe();
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
          this.prices[tvSym] = lp;
          broadcastPrice(tvSym, lp);
          // Update last candle across all intervals
          Object.keys(this.candles).forEach(key => {
            if (key.startsWith(tvSym + '_')) {
              const iv = key.slice(tvSym.length + 1);
              this._tickCandle(tvSym, iv, lp);
            }
          });
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
      const all = sds.s.map(b => ({ t: b.v[0], o: b.v[1], h: b.v[2], l: b.v[3], c: b.v[4] }));
      // Keep only the last MAX candles
      this.candles[key] = all.length > MAX ? all.slice(all.length - MAX) : all;
      console.log(`[TV] ${key}: loaded ${this.candles[key].length} candles`);
      this._saveCandles(key);
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

  _tickCandle(tvSym, iv, price) {
    const key = `${tvSym}_${iv}`;
    const arr = this.candles[key];
    if (!arr || !arr.length) return;
    const ivSec = ivToSeconds(iv);
    const now   = Math.floor(Date.now() / 1000);
    const cTime = Math.floor(now / ivSec) * ivSec;
    const last  = arr[arr.length - 1];
    if (cTime === last.t) {
      // Same candle — update OHLC
      if (price > last.h) last.h = price;
      if (price < last.l) last.l = price;
      last.c = price;
    } else if (cTime > last.t) {
      const gapCandles = (cTime - last.t) / ivSec;
      if (gapCandles <= 3) {
        // Continuous market (small gap) — open new candle
        arr.push({ t: cTime, o: price, h: price, l: price, c: price });
        if (arr.length > 150) arr.shift();
      } else {
        // Large gap = market was closed — just refresh the last close price,
        // do NOT create a fake "now" candle that would fool the client into
        // thinking the data is live.
        last.c = price;
      }
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
}

const tv = new TVClient();

// Save all candles to disk every 60 s, regardless of user activity
setInterval(() => tv._saveAll(), 60_000);

// ── Pair Library Scraper ──────────────────────────────────────────────────────

function tvHttpPost(url, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      port:     443,
      path:     u.pathname + u.search,
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'User-Agent':     'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept':         'application/json, text/plain, */*',
        'Accept-Language':'en-US,en;q=0.9',
        'Origin':         'https://www.tradingview.com',
        'Referer':        'https://www.tradingview.com/markets/currencies/rates-all/',
      },
    }, (resp) => {
      let data = '';
      resp.on('data', c => data += c);
      resp.on('end', () => {
        if (resp.statusCode !== 200) {
          return reject(new Error(`HTTP ${resp.statusCode}: ${data.slice(0, 200)}`));
        }
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error(`JSON parse failed: ${data.slice(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(payload);
    req.end();
  });
}

async function tvScreenerScan(screener, filter, range) {
  const body = {
    columns: ['name', 'description', 'exchange', 'subtype'],
    sort:    { sortBy: 'name', sortOrder: 'asc' },
    range:   range || [0, 500],
  };
  if (filter && filter.length) body.filter = filter;
  return tvHttpPost(`https://scanner.tradingview.com/${screener}/scan`, body);
}

function detectPairCategory(name, exchange) {
  const s = name.toUpperCase();
  if (/^X(AU|AG|PT|PD)|GOLD|SILVER|PLAT|PALL/.test(s)) return 'metals';
  if (/OIL|BRENT|WTI|NGAS|NATGAS|WHEAT|CORN|SUGAR|COFFE|COCOA|COTTON|SOYB|NICKEL|COPPER|ZINC|ALUM/.test(s)) return 'commodities';
  const cryptoEx = ['BINANCE','COINBASE','BYBIT','KRAKEN','KUCOIN','BITFINEX','GEMINI','HUOBI','OKX'];
  if (cryptoEx.includes(exchange.toUpperCase())) return 'crypto';
  return 'forex';
}

function formatPairSymbol(name, exchange) {
  const cryptoEx = ['BINANCE','COINBASE','BYBIT','KRAKEN','KUCOIN','BITFINEX','GEMINI','HUOBI','OKX'];
  if (cryptoEx.includes(exchange.toUpperCase())) {
    const m = name.match(/^(.+?)(USDT|USDC|USD|BTC|ETH|BNB|BUSD|EUR|TUSD)$/);
    if (m) return `${m[1]}/${m[2]}`;
    return name;
  }
  if (name.length === 6) return `${name.slice(0, 3)}/${name.slice(3)}`;
  return name;
}

let _scrapeRunning    = false;
let _scrapeLastResult = null;
const _scrapeJobLog   = [];   // keeps last run's per-job results for debug

async function scrapeAllPairs() {
  if (!db) throw new Error('Firestore not initialized');
  if (_scrapeRunning) return;
  _scrapeRunning = true;
  _scrapeJobLog.length = 0;

  const collected = [];
  const seen      = new Set();

  const ingest = (items, fallbackCat) => {
    if (!Array.isArray(items)) return 0;
    let n = 0;
    for (const item of items) {
      const [name, desc, exchange, subtype] = item.d || [];
      if (!name || !exchange) continue;
      const cs = `${exchange.toUpperCase()}:${name.toUpperCase()}`;
      if (seen.has(cs)) continue;
      seen.add(cs);
      const cat = detectPairCategory(name, exchange) || fallbackCat;
      collected.push({
        chartSymbol: cs,
        symbol:      formatPairSymbol(name.toUpperCase(), exchange.toUpperCase()),
        name:        desc || name,
        exchange:    exchange.toUpperCase(),
        category:    cat,
        subcategory: subtype || '',
        source:      'tradingview',
      });
      n++;
    }
    return n;
  };

  const jobs = [
    { screener: 'forex',  filter: [{ left: 'exchange', operation: 'equal', right: 'OANDA'   }], range: [0, 1000], fallback: 'forex'  },
    { screener: 'forex',  filter: [{ left: 'exchange', operation: 'equal', right: 'FXCM'    }], range: [0, 300],  fallback: 'forex'  },
    { screener: 'forex',  filter: [],                                                            range: [0, 500],  fallback: 'forex'  },
    { screener: 'crypto', filter: [
        { left: 'exchange',      operation: 'equal', right: 'BINANCE' },
        { left: 'currency_code', operation: 'equal', right: 'USDT'    },
      ], range: [0, 500], fallback: 'crypto' },
    { screener: 'crypto', filter: [{ left: 'exchange', operation: 'equal', right: 'COINBASE' }], range: [0, 200], fallback: 'crypto' },
    { screener: 'crypto', filter: [
        { left: 'exchange',      operation: 'equal', right: 'BYBIT' },
        { left: 'currency_code', operation: 'equal', right: 'USDT'  },
      ], range: [0, 300], fallback: 'crypto' },
  ];

  try {
    for (const job of jobs) {
      const tag = job.filter[0] ? job.filter[0].right : 'all';
      try {
        const res = await tvScreenerScan(job.screener, job.filter, job.range);
        const n   = ingest(res.data, job.fallback);
        const entry = { job: `${job.screener}/${tag}`, added: n, total: collected.length, ok: true };
        _scrapeJobLog.push(entry);
        console.log(`[scrape] ${entry.job}: +${n} (running total ${collected.length})`);
      } catch (e) {
        const entry = { job: `${job.screener}/${tag}`, ok: false, error: e.message };
        _scrapeJobLog.push(entry);
        console.error('[scrape] job error:', e.message);
      }
    }

    if (collected.length === 0) {
      throw new Error('all screener jobs returned 0 pairs — TradingView API may be blocking server requests');
    }

    // Batch write to Firestore (max 499 per batch)
    for (let i = 0; i < collected.length; i += 499) {
      const batch = db.batch();
      for (const pair of collected.slice(i, i + 499)) {
        const docId = pair.chartSymbol.replace(/[:/]/g, '_');
        batch.set(db.collection('all_pairs').doc(docId),
          { ...pair, scrapedAt: Date.now() },
          { merge: true }
        );
      }
      await batch.commit();
      console.log(`[scrape] Firestore batch ${Math.floor(i / 499) + 1} committed`);
    }

    _scrapeLastResult = { count: collected.length, at: Date.now(), error: null, jobs: _scrapeJobLog };
    console.log(`[scrape] done — ${collected.length} pairs saved to Firestore`);
  } catch (e) {
    _scrapeLastResult = { count: 0, at: Date.now(), error: e.message, jobs: _scrapeJobLog };
    console.error('[scrape] fatal:', e.message);
  } finally {
    _scrapeRunning = false;
  }
  return collected.length;
}


// ── HTTP Server ───────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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
      status:    candles.length ? 'ok' : 'loading',
      connected: tv.isConnected(),
      candles,
    });
    return;
  }

  // ── GET /api/tv/tick?symbol=OANDA:EUR_USD ─────────────────────────────────
  if (url.pathname === '/api/tv/tick') {
    const raw   = url.searchParams.get('symbol') || 'OANDA:EURUSD';
    const tvSym = normalizeSymbol(raw);
    json({ price: tv.getPrice(tvSym), connected: tv.isConnected() });
    return;
  }

  // ── GET /health ───────────────────────────────────────────────────────────
  if (url.pathname === '/health') {
    json({ status: 'ok', connected: tv.isConnected() });
    return;
  }

  // ── POST /api/scrape-pairs — trigger full pair library scrape ────────────
  if (url.pathname === '/api/scrape-pairs' && req.method === 'POST') {
    if (_scrapeRunning) { json({ status: 'running' }); return; }
    if (!db)            { json({ error: 'Firestore not available — FIREBASE_SERVICE_ACCOUNT env var missing?' }, 503); return; }
    json({ status: 'started' });
    scrapeAllPairs();
    return;
  }

  // ── GET /api/scrape-pairs/status — polling endpoint ──────────────────────
  if (url.pathname === '/api/scrape-pairs/status') {
    json({ running: _scrapeRunning, last: _scrapeLastResult, jobs: _scrapeJobLog });
    return;
  }

  // ── GET /api/scrape-test — debug: test one TradingView screener call ─────
  if (url.pathname === '/api/scrape-test') {
    try {
      const res = await tvScreenerScan(
        'forex',
        [{ left: 'exchange', operation: 'equal', right: 'OANDA' }],
        [0, 5]
      );
      json({
        ok:       true,
        count:    res.data?.length ?? 0,
        sample:   res.data?.[0] ?? null,
        firestore: db ? 'connected' : 'not connected',
      });
    } catch (e) {
      json({ ok: false, error: e.message, firestore: db ? 'connected' : 'not connected' });
    }
    return;
  }

  // ── GET /api/db-test — debug: test Firestore write ───────────────────────
  if (url.pathname === '/api/db-test') {
    if (!db) { json({ ok: false, error: 'Firestore not initialized' }); return; }
    try {
      await db.collection('_test').doc('ping').set({ t: Date.now() });
      json({ ok: true, msg: 'Firestore write succeeded' });
    } catch (e) {
      json({ ok: false, error: e.message });
    }
    return;
  }

  res.writeHead(404); res.end('Not found');

});

server.on('upgrade', (req, socket, head) => {
  if (new URL(req.url, 'http://x').pathname === '/ws') {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws));
  } else {
    socket.destroy();
  }
});

server.listen(PORT, () => {
  console.log(`Proxy ready on http://localhost:${PORT}`);
  console.log('TV WebSocket connecting…');

  // Keep-alive: ping self every 5 min so Render free tier never sleeps
  setInterval(() => {
    fetch('https://euro-trade-proxy.onrender.com/health')
      .catch(() => {});
  }, 5 * 60 * 1000);

});
