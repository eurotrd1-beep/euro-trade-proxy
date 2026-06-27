'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');
const { WebSocket, WebSocketServer } = require('ws');

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
    try {
      const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
      for (const file of files) {
        try {
          const raw  = fs.readFileSync(path.join(DATA_DIR, file), 'utf8');
          const data = JSON.parse(raw);
          if (data.key && Array.isArray(data.candles) && data.candles.length) {
            this.candles[data.key] = data.candles;
            console.log(`[store] loaded ${data.candles.length} candles for ${data.key}`);
          }
        } catch (_) {}
      }
    } catch (_) {}
  }

  _saveCandles(key) {
    try {
      const candles = this.candles[key];
      if (!candles || !candles.length) return;
      fs.writeFileSync(keyToFile(key), JSON.stringify({ key, candles }));
    } catch (_) {}
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

    const MAX = 200;

    if (full) {
      const all = sds.s.map(b => ({ t: b.v[0], o: b.v[1], h: b.v[2], l: b.v[3], c: b.v[4] }));
      // Keep only the last MAX candles
      this.candles[key] = all.length > MAX ? all.slice(all.length - MAX) : all;
      console.log(`[TV] ${key}: loaded ${this.candles[key].length} candles`);
      this._saveCandles(key);
    } else {
      if (!this.candles[key]) return;
      let newCandle = false;
      for (const b of sds.s) {
        const bar = { t: b.v[0], o: b.v[1], h: b.v[2], l: b.v[3], c: b.v[4] };
        const idx = b.i;
        if (idx >= this.candles[key].length) { this.candles[key].push(bar); newCandle = true; }
        else this.candles[key][idx] = bar;
      }
      // Sliding window: trim oldest when over limit
      if (this.candles[key].length > MAX) this.candles[key].splice(0, this.candles[key].length - MAX);
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
      if (price > last.h) last.h = price;
      if (price < last.l) last.l = price;
      last.c = price;
    } else if (cTime > last.t) {
      arr.push({ t: cTime, o: price, h: price, l: price, c: price });
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
    this._send({ m: 'create_series',        p: [cs, 'sds_1', 's1', 'sds_sym_1', tvIv, 200] });
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

// ── OTC Candle Store (keyed by broker + symbol + interval) ───────────────────

const otcCandles = {};  // `${brokerKey}_${sym}_${iv}` → Candle[]
const otcCurrent = {};  // `${brokerKey}_${sym}_${iv}` → building candle

function _bKey(brokerName) {
  return brokerName.toLowerCase().replace(/[^a-z0-9]/g, '_');
}

function _otcLoadAll() {
  try {
    fs.readdirSync(DATA_DIR)
      .filter(f => f.startsWith('otc_') && f.endsWith('.json'))
      .forEach(file => {
        try {
          const d = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
          if (d.key && Array.isArray(d.candles) && d.candles.length) {
            otcCandles[d.key] = d.candles;
            console.log(`[OTC] loaded ${d.candles.length} candles for ${d.key}`);
          }
        } catch (_) {}
      });
  } catch (_) {}
}
_otcLoadAll();

function _otcSave(key) {
  try {
    const c = otcCandles[key];
    if (c && c.length) {
      fs.writeFileSync(
        path.join(DATA_DIR, 'otc_' + key.replace(/[:/]/g, '_') + '.json'),
        JSON.stringify({ key, candles: c })
      );
    }
  } catch (_) {}
}

/** Called by OTCScraper on every tick. Builds 1m/5m/15m/1h candles. */
function otcTick(brokerName, sym, price, tsSeconds) {
  const bk = _bKey(brokerName);
  ['1m', '5m', '15m', '1h'].forEach(iv => {
    const sec = ivToSeconds(iv);
    const key = `${bk}_${sym}_${iv}`;
    const cT  = Math.floor(tsSeconds / sec) * sec;
    const cur = otcCurrent[key];
    if (!cur || cur.t !== cT) {
      if (cur) {
        if (!otcCandles[key]) otcCandles[key] = [];
        otcCandles[key].push({ t: cur.t, o: cur.o, h: cur.h, l: cur.l, c: cur.c });
        if (otcCandles[key].length > 200) otcCandles[key].shift();
        _otcSave(key);
      }
      otcCurrent[key] = { t: cT, o: price, h: price, l: price, c: price };
    } else {
      if (price > cur.h) cur.h = price;
      if (price < cur.l) cur.l = price;
      cur.c = price;
    }
  });
  broadcastPrice(sym, price);
}

function otcGetCandles(brokerName, sym, iv) {
  const key = `${_bKey(brokerName)}_${sym}_${iv}`;
  const hist = otcCandles[key] || [];
  const cur  = otcCurrent[key];
  return cur ? [...hist, { ...cur }] : [...hist];
}

/** Returns OTC symbols that have candle data for the given broker. */
function otcGetPairs(brokerName) {
  const prefix = _bKey(brokerName) + '_';
  const syms = new Set();
  for (const key of Object.keys(otcCandles)) {
    if (!key.startsWith(prefix)) continue;
    const rest = key.slice(prefix.length);
    const sym  = rest.replace(/_(1m|5m|15m|1h|1D)$/, '');
    if (/_OTC$/i.test(sym)) syms.add(sym.toUpperCase());
  }
  // Also include symbols from current (in-progress) candles
  for (const key of Object.keys(otcCurrent)) {
    if (!key.startsWith(prefix)) continue;
    const rest = key.slice(prefix.length);
    const sym  = rest.replace(/_(1m|5m|15m|1h|1D)$/, '');
    if (/_OTC$/i.test(sym)) syms.add(sym.toUpperCase());
  }
  return [...syms].sort();
}

// ── Multi-broker scraper management ──────────────────────────────────────────

const brokerScrapers = {};  // brokerName → OTCScraper instance
const brokerConfigs  = {};  // brokerName → { name, chartUrl }
const BROKERS_FILE   = path.join(DATA_DIR, 'brokers.json');

function _saveBrokerConfigs() {
  try {
    fs.writeFileSync(BROKERS_FILE, JSON.stringify(Object.values(brokerConfigs), null, 2));
  } catch (_) {}
}

function _startBrokerScraper(name, chartUrl) {
  if (!chartUrl) return;
  if (brokerScrapers[name]) {
    console.log(`[OTC] Scraper for "${name}" already running`);
    return;
  }
  try {
    const { OTCScraper } = require('./otc-scraper');
    const scraper = new OTCScraper({ chartUrl, brokerName: name, onTick: otcTick });
    brokerScrapers[name] = scraper;
    brokerConfigs[name]  = { name, chartUrl };
    scraper.start();
    console.log(`[OTC] Started scraper for broker: ${name}`);
  } catch (err) {
    console.warn(`[OTC] Failed to start scraper for "${name}":`, err.message);
  }
}

// ── Chrome install + scraper startup (runs after server is listening) ────────

let _chromeReady = false;

async function _ensureChrome() {
  return new Promise(resolve => {
    const { exec } = require('child_process');
    console.log('[OTC] Installing Chrome via puppeteer...');
    exec('npx puppeteer browsers install chrome', { timeout: 180000 }, (err, stdout, stderr) => {
      if (err) console.warn('[OTC] Chrome install warning:', err.message);
      else console.log('[OTC] Chrome installed successfully');
      if (stdout) console.log('[OTC] Chrome install stdout:', stdout.slice(-300));
      _chromeReady = true;
      resolve();
    });
  });
}

function _startAllScrapers() {
  // Load persisted broker configs and start scrapers
  try {
    if (fs.existsSync(BROKERS_FILE)) {
      const saved = JSON.parse(fs.readFileSync(BROKERS_FILE, 'utf8'));
      if (Array.isArray(saved)) {
        saved.forEach(b => { if (b.name && b.chartUrl) _startBrokerScraper(b.name, b.chartUrl); });
      }
    }
  } catch (err) {
    console.warn('[OTC] Error loading brokers.json:', err.message);
  }

  // Auto-register brokers from environment variables (survives Render restarts)
  if (process.env.PO_CHART_URL && !brokerConfigs['Pocket Option']) {
    console.log('[OTC] Auto-registering Pocket Option from PO_CHART_URL env var');
    brokerConfigs['Pocket Option'] = { name: 'Pocket Option', chartUrl: process.env.PO_CHART_URL };
    _startBrokerScraper('Pocket Option', process.env.PO_CHART_URL);
  }
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

  // ── GET /api/otc/candles?broker=X&symbol=EURUSD_OTC&interval=1m ──────────
  if (url.pathname === '/api/otc/candles' || url.pathname === '/api/po/candles') {
    const broker  = url.searchParams.get('broker')   || 'Pocket Option';
    const sym     = url.searchParams.get('symbol')   || 'EURUSD_OTC';
    const iv      = url.searchParams.get('interval') || '1m';
    const candles = otcGetCandles(broker, sym, iv);
    json({ status: candles.length ? 'ok' : 'loading', broker, candles });
    return;
  }

  // ── GET /api/otc/pairs?broker=X ────────────────────────────────────────
  if (url.pathname === '/api/otc/pairs') {
    const broker = url.searchParams.get('broker') || 'Pocket Option';
    const pairs  = otcGetPairs(broker);
    json({ broker, pairs });
    return;
  }

  // ── POST /api/admin/sync-broker  body: { name, chartUrl } ──────────────
  if (url.pathname === '/api/admin/sync-broker' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { name, chartUrl } = JSON.parse(body);
        if (!name || !chartUrl) { res.writeHead(400); res.end('Missing name or chartUrl'); return; }
        brokerConfigs[name] = { name, chartUrl };
        _saveBrokerConfigs();
        if (!brokerScrapers[name]) {
          _startBrokerScraper(name, chartUrl);
        }
        json({ ok: true, message: `Broker "${name}" synced` });
      } catch (e) {
        res.writeHead(400); res.end('Invalid JSON');
      }
    });
    return;
  }

  // ── GET /health ───────────────────────────────────────────────────────────
  if (url.pathname === '/health') {
    const scraperStatus = {};
    for (const [name, s] of Object.entries(brokerScrapers)) {
      scraperStatus[name] = {
        ready:      s._ready      || false,
        destroyed:  s._destroyed  || false,
        status:     s._status     || 'unknown',
        lastError:  s._lastError  || null,
        tickCount:  s._tickCount  || 0,
        lastTickAt: s._lastTickAt || null,
        pairsCount: otcGetPairs(name).length,
      };
    }
    json({
      status:       'ok',
      connected:    tv.isConnected(),
      chromeReady:  _chromeReady,
      brokers:      Object.keys(brokerScrapers),
      poUrlSet:     !!process.env.PO_CHART_URL,
      scraperStatus,
    });
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

  // Install Chrome then start scrapers (server is already listening so health checks pass)
  _ensureChrome().then(_startAllScrapers);
});
