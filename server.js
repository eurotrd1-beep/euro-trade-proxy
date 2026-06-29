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
    try { fs.writeFileSync(keyToFile(key), JSON.stringify({ key, candles })); } catch (_) {}
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

// Save all candles to disk every 60 s
setInterval(() => tv._saveAll(), 60_000);

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
