'use strict';

// supabase-js Realtime needs a global WebSocket; Node < 22 has none. Provide
// `ws` as the global before any supabase client is created. No-op on Node 22+.
if (typeof globalThis.WebSocket === 'undefined') {
  try { globalThis.WebSocket = require('ws'); } catch (_) {}
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 *  OTC SCRAPER  —  Pocket Option (DIRECT WebSocket, no browser)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  Same idea as the TradingView scraper: connect straight to the platform's
 *  websocket and read prices — NO Chromium, so it runs comfortably on Render's
 *  512 MB plan (~20 MB instead of ~450 MB) and is far more stable (no browser
 *  crashes, no DOM selectors).
 *
 *  Pocket Option's feed is protected, so unlike TradingView it needs a one-time
 *  session token captured from a real login. Capture it locally with
 *  `get-po-ssid.js`, then set on Render:
 *     PO_WS_URL  — the websocket URL PO uses
 *     PO_AUTH    — the auth handshake frame (e.g. ["auth",{...}])  (session token)
 *  Shared with the TradingView side: SUPABASE_URL, SUPABASE_SERVICE_KEY.
 *
 *  Everything platform-specific lives in `PoProtocol` (frame parsing / symbols)
 *  so another OTC platform later is just a new protocol object.
 * ════════════════════════════════════════════════════════════════════════════
 */

const WebSocketLib = require('ws');
let createClient;
try { ({ createClient } = require('@supabase/supabase-js')); } catch (_) {}

// ── Config (env only) ────────────────────────────────────────────────────────
const PO_AUTH      = (process.env.PO_AUTH || process.env.PO_SSID || '').trim();
const PO_WS_URL    = process.env.PO_WS_URL ||
  'wss://api-eu.po.market/socket.io/?EIO=4&transport=websocket';
const PO_IS_DEMO   = (process.env.PO_IS_DEMO || '1') === '1';
// Credentials enable AUTOMATIC token re-capture (a brief, temporary browser) if
// the token ever dies despite the heartbeat. Optional — without them the system
// falls back to a manual re-capture alert.
const PO_EMAIL     = process.env.PO_EMAIL || '';
const PO_PASSWORD  = process.env.PO_PASSWORD || '';
const PO_LOGIN_URL = process.env.PO_LOGIN_URL || 'https://pocketoption.com/en/login/';
// 2captcha API key — enables solving PO's login reCAPTCHA so the SERVER can log
// in and mint a server-IP token (24/7 on Render, no PC needed). Optional.
const CAPTCHA_API_KEY = process.env.CAPTCHA_API_KEY || process.env.TWOCAPTCHA_API_KEY || '';

// Active session token + ws url (start from env; replaced by auto-recapture and
// persisted to Supabase so a restart reuses the freshest token).
let activeAuth  = PO_AUTH;
let activeWsUrl = PO_WS_URL;
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

// ── Keep-alive tuning (override with the REAL frames captured by get-po-ssid.js) ──
// PO_HEARTBEAT : JSON array of extra Engine.IO frames to send each beat, e.g.
//                ["42[\"ps\"]"] — replays exactly what the real client sends.
// PO_SUBSCRIBE : template to (re)subscribe to a symbol, {symbol} is substituted,
//                e.g. 42["changeSymbol",{"asset":"{symbol}","period":60}]
// PO_KEEPALIVE_URL + PO_COOKIE : optional 2nd channel — periodic HTTPS GET with
//                the session cookie, so the session stays "active" via HTTP too.
let PO_HEARTBEAT = [];
try { if (process.env.PO_HEARTBEAT) PO_HEARTBEAT = JSON.parse(process.env.PO_HEARTBEAT); } catch (_) {}
const PO_SUBSCRIBE     = process.env.PO_SUBSCRIBE || '';
const PO_KEEPALIVE_URL = process.env.PO_KEEPALIVE_URL || '';
const PO_COOKIE        = process.env.PO_COOKIE || '';
const https = require('https');

// Heartbeat cadence: RANDOM 20–40 s (not a fixed tick) to look human.
// Must stay WELL under PO's Engine.IO ping interval (~25s) or PO drops the socket
// at ~28s. 12–18s (jittered) keeps the session alive while still looking human.
function nextBeatMs() { return 12000 + Math.floor(Math.random() * 6000); }

// Bump on each deploy so we can confirm from the DB which build Render is running.
const BUILD = '2captcha-2';

// ── Minimal HTTP helpers (for raw server-side login → server-IP token) ────────
function httpReq(method, url, { headers = {}, body = null } = {}) {
  return new Promise((resolve) => {
    let u; try { u = new URL(url); } catch (e) { return resolve({ error: e.message }); }
    const req = https.request(
      { method, hostname: u.hostname, path: u.pathname + u.search, headers },
      (res) => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve({
          status: res.statusCode, headers: res.headers,
          setCookie: res.headers['set-cookie'] || [],
          body: Buffer.concat(chunks).toString('utf8'),
          location: res.headers.location,
        }));
      });
    req.on('error', e => resolve({ error: e.message }));
    req.setTimeout(30000, () => { req.destroy(); resolve({ error: 'timeout' }); });
    if (body) req.write(body);
    req.end();
  });
}
function cookieHeader(jar) { return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; '); }
function mergeCookies(jar, setCookie) {
  for (const sc of (setCookie || [])) { const m = /^([^=]+)=([^;]*)/.exec(sc); if (m) jar[m[1].trim()] = m[2]; }
  return jar;
}
function multipartBody(boundary, fields) {
  let s = '';
  for (const [k, v] of Object.entries(fields)) {
    s += `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v == null ? '' : v}\r\n`;
  }
  return s + `--${boundary}--\r\n`;
}

// ── 2captcha reCAPTCHA solver ────────────────────────────────────────────────
// Solves PO's login reCAPTCHA so the SERVER can log in and mint a server-IP
// token (24/7 on Render, no PC needed). Supports v3 (score-based, needs an
// action) and v2. Submit → poll res.php every 5s → return the solved token.
// Throws on any failure so the caller can retry / back off.
async function solveRecaptcha({ sitekey, pageurl, action, version }) {
  if (!CAPTCHA_API_KEY) throw new Error('no CAPTCHA_API_KEY');
  const q = new URLSearchParams({
    key: CAPTCHA_API_KEY, method: 'userrecaptcha',
    googlekey: sitekey, pageurl, json: '1',
  });
  if (version === 'v3') { q.set('version', 'v3'); q.set('action', action || 'login'); q.set('min_score', '0.3'); }
  const sub = await httpReq('GET', 'https://2captcha.com/in.php?' + q.toString());
  if (sub.error) throw new Error('in.php ' + sub.error);
  let id;
  try { const j = JSON.parse(sub.body); if (Number(j.status) !== 1) throw new Error('in.php ' + j.request); id = j.request; }
  catch (e) { throw new Error('in.php ' + (e.message || (sub.body || '').slice(0, 80))); }
  // Poll up to ~150s (v3 typically 10-30s; v2 can be longer).
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const res = await httpReq('GET',
      `https://2captcha.com/res.php?key=${CAPTCHA_API_KEY}&action=get&id=${id}&json=1`);
    if (res.error) continue;
    let j; try { j = JSON.parse(res.body); } catch (_) { continue; }
    if (Number(j.status) === 1) return j.request;                         // solved token
    if (j.request && j.request !== 'CAPCHA_NOT_READY') throw new Error('res.php ' + j.request);
  }
  throw new Error('res.php timeout (>150s)');
}

const IVS         = ['1m', '5m', '15m', '1h', '1D'];
const MAX_CANDLES = 150;
const PRICE_MS    = 1000;
const MAX_LOGIN_FAILS = 3;

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

function ivToSeconds(iv) {
  switch (iv) {
    case '5m':  return 300;
    case '15m': return 900;
    case '1h':  return 3600;
    case '1D':  return 86400;
    default:    return 60;
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  Platform protocol (Pocket Option) — frame parsing + symbol helpers
// ════════════════════════════════════════════════════════════════════════════
const PoProtocol = {
  id: 'pocketoption',

  // id → symbol map, learned from updateAssets (live ticks may use numeric ids).
  idMap: {},

  // Internal symbol = PO's exact asset symbol with ':' stripped (NO upper-casing —
  // PO uses lowercase "_otc", e.g. "EURUSD_otc", "#AAPL_otc"). No ':' means the
  // TradingView pairs-listener always ignores it.
  normalize(raw) {
    if (raw == null) return null;
    const s = String(raw).trim().replace(/[:\s]/g, '');
    return s || null;
  },

  displayName(symbol) {
    const base = symbol.replace(/^#/, '').replace(/_?otc$/i, '');
    if (/^[A-Za-z]{6}$/.test(base)) return `${base.slice(0, 3)}/${base.slice(3)} OTC`.toUpperCase().replace('OTC', 'OTC');
    return `${base} OTC`;
  },

  expectedDecimals(symbol) { return /JPY/i.test(symbol) ? 3 : 5; },

  // Parse one decoded payload (from a text "42[...]" event OR a binary frame) →
  // { prices:{sym:price}, assets:[{symbol,name}] }.
  //  • updateAssets : [[id,"SYM","Name","type",...], …]        → asset catalogue + idMap
  //  • history      : {asset:"SYM", period, history:[[ts,price],…]} → last price
  //  • live stream  : [["SYM"|id, ts, price], …]                 → tick prices
  parse(node) {
    const out = { prices: {}, assets: [] };
    let body = node;
    if (Array.isArray(node) && typeof node[0] === 'string') body = node[1]; // ["event",payload]

    // history object: {asset, history:[[ts,price],...]}
    if (body && typeof body === 'object' && !Array.isArray(body) && Array.isArray(body.history)) {
      const sym = this.normalize(body.asset || body.symbol);
      const h = body.history;
      const last = h.length ? h[h.length - 1] : null;
      if (sym && last && typeof last[1] === 'number' && last[1] > 0) out.prices[sym] = last[1];
      return out;
    }

    // asset catalogue: array of [id, "SYM", "Name", "type", ...]
    if (this._looksLikeAssetList(body)) {
      for (const a of body) {
        if (!Array.isArray(a) || a.length < 3) continue;
        const id = a[0];
        const symRaw = typeof a[1] === 'string' ? a[1] : null;
        if (!symRaw) continue;
        const symbol = this.normalize(symRaw);
        if (typeof id === 'number' && symbol) this.idMap[id] = symbol;
        if (/otc/i.test(symRaw)) {
          const name = (typeof a[2] === 'string' && a[2]) ? a[2] : this.displayName(symbol);
          if (!out.assets.some(x => x.symbol === symbol)) out.assets.push({ symbol, name });
        }
      }
      return out;
    }

    this._collectPrices(body, out.prices);
    return out;
  },

  _looksLikeAssetList(body) {
    return Array.isArray(body) && body.length > 3 && Array.isArray(body[0]) &&
           body[0].length >= 4 && typeof body[0][1] === 'string';
  },

  // Find [symbol|id, timestamp, price] tuples and {asset, price} objects.
  _collectPrices(node, acc, depth = 0) {
    if (depth > 6 || node == null) return;
    if (Array.isArray(node)) {
      if (node.length >= 3 &&
          (typeof node[0] === 'string' || typeof node[0] === 'number') &&
          typeof node[1] === 'number' && typeof node[2] === 'number' && node[2] > 0) {
        let sym = typeof node[0] === 'string' ? this.normalize(node[0]) : this.idMap[node[0]];
        if (sym) { acc[sym] = node[2]; return; }
      }
      for (const el of node) this._collectPrices(el, acc, depth + 1);
    } else if (typeof node === 'object') {
      const symRaw = node.asset || node.symbol || node.s || node.active;
      const price = node.price ?? node.quote ?? node.value ?? node.close ?? node.c ?? node.rate;
      if (typeof symRaw === 'string' && typeof price === 'number' && price > 0) {
        const n = this.normalize(symRaw); if (n) acc[n] = price;
      }
      for (const k of Object.keys(node)) this._collectPrices(node[k], acc, depth + 1);
    }
  },
};

// ════════════════════════════════════════════════════════════════════════════
//  Candle store — builds + persists candles (platform-agnostic)
// ════════════════════════════════════════════════════════════════════════════
class CandleStore {
  constructor() {
    this.candles = {};       // `${symbol}_${iv}` → Candle[]
    this.lastChange = {};    // symbol → ms of last price change (market-open detect)
    this._lastPrice = {};
    this._saveTimers = {};
  }

  async hydrate(symbols) {
    if (!db || !symbols.length) return;
    const keys = [];
    for (const s of symbols) for (const iv of IVS) keys.push(`${s}_${iv}`);
    try {
      const { data, error } = await db.from('candles').select('key, data').in('key', keys);
      if (error) { err('hydrate error:', error.message); return; }
      let n = 0;
      for (const row of (data || [])) {
        if (row.key && Array.isArray(row.data) && row.data.length) { this.candles[row.key] = row.data; n++; }
      }
      if (n) log(`hydrated ${n} OTC candle series`);
    } catch (e) { err('hydrate failed:', e.message); }
  }

  tick(symbol, price) {
    if (price == null || !isFinite(price) || price <= 0) return;
    if (this._lastPrice[symbol] !== price) { this._lastPrice[symbol] = price; this.lastChange[symbol] = Date.now(); }
    for (const iv of IVS) this._tickIv(symbol, iv, price);
  }

  _tickIv(symbol, iv, price) {
    const key = `${symbol}_${iv}`;
    const arr = this.candles[key] || (this.candles[key] = []);
    const ivSec = ivToSeconds(iv);
    const now = Math.floor(Date.now() / 1000);
    const cTime = Math.floor(now / ivSec) * ivSec;
    const last = arr.length ? arr[arr.length - 1] : null;
    if (!last) { arr.push({ t: cTime, o: price, h: price, l: price, c: price }); this._schedSave(key); return; }
    if (cTime === last.t) {
      if (price > last.h) last.h = price;
      if (price < last.l) last.l = price;
      last.c = price;
      return;
    }
    if (price !== last.c) {           // new candle only when frame elapsed AND price changed
      arr.push({ t: cTime, o: price, h: price, l: price, c: price });
      if (arr.length > MAX_CANDLES) arr.shift();
      this._schedSave(key);
    }
  }

  _schedSave(key) {
    if (!db) return;
    if (this._saveTimers[key]) clearTimeout(this._saveTimers[key]);
    this._saveTimers[key] = setTimeout(() => { delete this._saveTimers[key]; this._save(key); }, 3000);
  }

  _save(key) {
    const candles = this.candles[key];
    if (!db || !candles || !candles.length) return;
    db.from('candles').upsert({ key, data: candles, updated_at: new Date().toISOString() })
      .then(({ error }) => { if (error) err('save', key, error.message); })
      .catch(e => err('save', key, e.message));
  }

  isMarketOpen(symbol) {
    const lc = this.lastChange[symbol];
    return lc ? (Date.now() - lc) < 90_000 : false;
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  Direct WebSocket client (Engine.IO / Socket.IO)
// ════════════════════════════════════════════════════════════════════════════
class PoWsClient {
  constructor(proto) {
    this.proto = proto;
    this.ws = null;
    this.prices = {};
    this._priceAt = {};
    this.store = new CandleStore();
    this.enabled = new Set();
    this.connected = false;
    this.authed = false;
    this.loginFails = 0;
    this.reconnects = 0;
    this._reconnecting = false;
    this._reconnectTimer = null;
    this._authedAt = 0;       // when the current session authed (for flap detection)
    this._connectedAt = 0;    // when the socket opened (for session-length check)
    this._flaps = 0;          // consecutive short-lived sessions (flapping)
    this._triedRecapture = false;  // already tried a server-IP recapture this run?
    this._framesRecv = 0;
    this._priceFrames = 0;    // price ticks (updateStream/history), not the catalogue
    this._scanning = false;
    this._scanAssets = [];
    this._assetMap = new Map();   // symbol → {symbol,name} catalogue (from updateAssets)
    this._lastPricesWrite = 0;
    this._unknownSamples = 0;
    this._phase = 'boot';
    this._hbTimer = null;     // websocket heartbeat (randomised)
    this._httpTimer = null;   // optional HTTP keep-alive (2nd channel)
    this._beatCount = 0;
    // ── Self-healing state ──
    this._lastDataAt = 0;     // ms of last live data frame (heartbeat success proof)
    this._wdTimer = null;     // watchdog interval
    this._staleChecks = 0;    // consecutive "no fresh data" checks (fast-fail counter)
    this._repairing = false;
    this._repairFails = 0;
    this._repairOpenUntil = 0;   // circuit-breaker: skip repairs until this time
    this._phaseSince = null;     // when the current phase started (for UX escalation)
    this._health = { lastHeartbeatOk: null, repairs: 0, lastRepairAt: null };
  }

  _backoffMs() {
    switch (this.loginFails) {
      case 0:  return 1000;
      case 1:  return 5000;
      case 2:  return 15000;
      default: return 60000;
    }
  }

  // Build the Engine.IO message to authenticate. PO_AUTH may be the full frame
  // ("42[...]"), the socket.io event ("[\"auth\",{...}]"), the bare object
  // ("{...}") or just a session string.
  buildAuthFrame() {
    const a = activeAuth;
    if (!a) return null;
    if (/^4\d/.test(a)) return a;
    if (a.startsWith('[')) return '42' + a;
    if (a.startsWith('{')) return '42["auth",' + a + ']';
    return '42["auth",' + JSON.stringify({ session: a, isDemo: PO_IS_DEMO ? 1 : 0 }) + ']';
  }

  start() {
    if (!activeAuth) {
      // No token yet. If we have credentials, try to auto-capture one; else ask
      // for a manual capture. Either way the TradingView side is unaffected.
      warn('no session token — ' + (PO_EMAIL && PO_PASSWORD
        ? 'attempting automatic capture…'
        : 'run get-po-ssid.js locally and set PO_AUTH (or set PO_EMAIL/PO_PASSWORD for auto-capture).'));
      this._reportStatus({ connected: false, loggedIn: false, phase: 'login_failed', lastError: 'no session token' });
      if (PO_EMAIL && PO_PASSWORD) this._repair();
      return;
    }
    this._connect();
  }

  // The exact User-Agent stored inside the session SSID (PO validates it against
  // the connection's UA). Extracted from the active token; safe default otherwise.
  _ua() {
    const m = /(Mozilla\/[^"\\]{20,}?Safari\/[0-9.]+)/.exec(activeAuth || '');
    return (m && m[1]) ||
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36';
  }

  _connect() {
    this._clearWs();
    this.authed = false;
    log('connecting to', activeWsUrl.replace(/\?.*$/, '?…'));
    let ws;
    try {
      ws = new WebSocketLib(activeWsUrl, {
        headers: {
          Origin: 'https://pocketoption.com',
          // MUST match the user_agent baked into the session SSID — PO drops the
          // feed if the connection UA differs from the session's stored UA.
          'User-Agent': this._ua(),
          // Session COOKIE on the WS handshake — the browser sends this and PO
          // very likely checks it to AUTHORISE streaming (auth message alone only
          // yields the public catalogue). Set PO_COOKIE from get-po-ssid.js.
          ...(PO_COOKIE ? { Cookie: PO_COOKIE } : {}),
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
        },
      });
    } catch (e) { warn('ws create failed:', e.message); this._scheduleReconnect(); return; }
    this.ws = ws;

    ws.on('open', () => {
      this.connected = true;
      this._connectedAt = Date.now();
      this._framesRecv = 0;
      this._priceFrames = 0;
      log('ws open — handshaking');
      this._reportStatus({ connected: true, loggedIn: false, phase: 'relogin' });
    });
    ws.on('message', (data, isBinary) => this._onMessage(data, isBinary));
    ws.on('close', (code) => this._onClose(code));
    ws.on('error', (e) => warn('ws error:', e.message));
  }

  _onMessage(data, isBinary) {
    // PO sends live prices as Socket.IO BINARY attachments (the "451-[...]" text
    // frame is the header; the real payload is the next binary frame). The binary
    // frame is UTF-8 JSON — parse it and ingest.
    if (isBinary) {
      let txt; try { txt = data.toString('utf8'); } catch (_) { return; }
      let parsed; try { parsed = JSON.parse(txt); } catch (_) {
        if (this._unknownSamples < 8) { this._unknownSamples++; log('binary (non-json) sample:', txt.slice(0, 160)); }
        return;
      }
      this._ingest(parsed, txt);
      return;
    }
    const msg = data.toString();

    // Engine.IO ping → pong.
    if (msg === '2') { try { this.ws.send('3'); } catch (_) {} if (this._diagPing) log('⇄ server ping → pong'); return; }
    if (msg === '3') return;

    // Engine.IO open handshake → connect to default namespace + note ping timing.
    if (msg[0] === '0') {
      try {
        const o = JSON.parse(msg.slice(1));
        this._pingInterval = o.pingInterval; this._pingTimeout = o.pingTimeout;
        this._diagPing = true;
        log(`engine.io open: pingInterval=${o.pingInterval} pingTimeout=${o.pingTimeout}`);
      } catch (_) {}
      try { this.ws.send('40'); } catch (_) {}
      return;
    }

    // Socket.IO connected → send auth, then subscribe to enabled symbols.
    if (msg.startsWith('40')) {
      // Mimic the real browser's post-auth burst EXACTLY (auth → loads → subscribe
      // → ps), sent immediately without waiting — PO drops "incomplete" sessions.
      const af = this.buildAuthFrame();
      if (af) this._send(af);
      this._send('42["indicator/load"]');
      this._send('42["favorite/load"]');
      this._send('42["price-alert/load"]');
      this._send('42["ps"]');
      log('auth + init sequence sent (subscribe follows the catalogue)');
      return;   // subscribe AFTER the catalogue arrives (proof PO is ready) — see _ingest
    }

    // Socket.IO event / ack ("42[...]", "451-[...]", "43[...]" …).
    if (/^4\d/.test(msg)) {
      const body = msg.replace(/^4\d+(-)?/, '');
      if (!body || (body[0] !== '[' && body[0] !== '{')) return;
      let parsed;
      try { parsed = JSON.parse(body); }
      catch (_) {
        if (this._unknownSamples < 10 && /otc/i.test(msg)) { this._unknownSamples++; log('unparsed event sample:', msg.slice(0, 220)); }
        return;
      }
      this._ingest(parsed, msg);
    }
  }

  _ingest(parsed, raw) {
    const res = this.proto.parse(parsed);
    const gotPrices = res && Object.keys(res.prices).length;
    const gotAssets = res && res.assets.length;

    if (gotPrices || gotAssets) {
      this._lastDataAt = Date.now();           // proof the session is alive
      this._health.lastHeartbeatOk = new Date().toISOString();
      this._staleChecks = 0;
      this._framesRecv++;
      if (gotPrices) this._priceFrames++;      // PRICE ticks specifically (not catalogue)
      if (!this.authed) {
        this.authed = true; this.loginFails = 0; this._repairFails = 0;
        this._authedAt = Date.now();
        this._reportStatus({ connected: true, loggedIn: true, phase: 'live' });
        log('first data received (catalogue) — subscribing…');
        setTimeout(() => this._subscribeAll(), 800);  // PO is ready now → subscribe
        this._startHeartbeat();       // keep the session "active"
        this._startWatchdog();        // detect a silent death even while "connected"
      }
    }
    if (gotPrices) {
      const now = Date.now();
      for (const [sym, price] of Object.entries(res.prices)) { this.prices[sym] = price; this._priceAt[sym] = now; }
    }
    if (gotAssets) {
      // Cache the OTC asset catalogue (PO sends updateAssets on connect) so
      // "جلب الأزواج" can list pairs any time, not only during a scan window.
      for (const a of res.assets) this._assetMap.set(a.symbol, a);
    }
    // Sample a few genuinely-unknown events (ignore the "_placeholder" binary
    // headers — those are normal; the real data is the following binary frame).
    if (!gotPrices && !gotAssets && this._unknownSamples < 6 &&
        !/_placeholder/.test(raw) && /otc|asset|price/i.test(raw)) {
      this._unknownSamples++; log('event yielded no price (sample):', raw.slice(0, 200));
    }
  }

  _onClose(code) {
    const wasAuthed = this.authed;
    const aliveMs = this._connectedAt ? (Date.now() - this._connectedAt) : 0;
    this.connected = false; this.authed = false;
    this._clearWs();

    let delay, phase;
    if (aliveMs >= 120000) {
      // Genuinely stable for ≥2 min then dropped → normal quick reconnect.
      this._flaps = 0; this.loginFails = 0; this._triedRecapture = false;
      delay = 1000; phase = 'reconnecting';
    } else {
      // ANY short-lived session (rejected, or authed-then-dropped) = flapping.
      // Progressive backoff so we NEVER hammer PO (was hitting 1000+ reconnects).
      if (!wasAuthed) this.loginFails++;
      this._flaps++;
      delay = Math.min(120000, 5000 * this._flaps);   // 5s,10s,…,cap 2min
      phase = (this._flaps >= 4 || this.loginFails >= MAX_LOGIN_FAILS) ? 'login_failed' : 'reconnecting';
    }

    const diag = `close=${code} alive=${Math.round(aliveMs / 1000)}s frames=${this._framesRecv} priceFrames=${this._priceFrames} flaps=${this._flaps} authed=${wasAuthed}`;
    warn(`ws closed (${diag})`);
    this._reportStatus({ connected: false, loggedIn: false, phase, diag });

    // The token auths but never streams (priceFrames stays 0) ⇒ it's IP-bound to
    // the capture machine. Try ONCE to capture a token from the SERVER's own IP
    // (browser strike) — instrumented via repairDiag so we see if it works or OOMs.
    if (this._flaps === 1 && this._priceFrames === 0 && PO_EMAIL && PO_PASSWORD && !this._triedRecapture) {
      this._triedRecapture = true;
      err('🟧 OTC: token auths but never streams (IP-bound). Minting a SERVER-IP token via HTTP login…');
      this._repair();                 // httpLogin first, browser fallback
      return;                         // repair owns reconnection; don't double-connect
    }
    this._scheduleReconnect(delay);
  }

  _scheduleReconnect(delayMs) {
    if (this._reconnectTimer || this._repairing) return;   // don't reconnect mid-repair (avoids session conflict)
    const delay = delayMs || this._backoffMs();
    this.reconnects++;
    warn(`reconnect #${this.reconnects} in ${Math.round(delay / 1000)}s`);
    this._reconnectTimer = setTimeout(() => { this._reconnectTimer = null; this._connect(); }, delay);
  }

  _clearWs() {
    this._stopHeartbeat();
    this._stopWatchdog();
    if (this.ws) { try { this.ws.removeAllListeners(); this.ws.terminate(); } catch (_) {} this.ws = null; }
  }

  // ── Watchdog: instant detection of a silent death ──────────────────────────
  // Even while the socket stays "connected", a dead token stops fresh data.
  // Every 5s: if no data for >30s, fast-retry (a beat). 3 stale checks in a row
  // (~15s) ⇒ token is dead ⇒ trigger self-repair.
  _startWatchdog() {
    this._stopWatchdog();
    this._wdTimer = setInterval(() => {
      if (!this.authed || this._repairing) return;
      const age = Date.now() - this._lastDataAt;
      if (age > 30_000) {
        this._staleChecks++;
        warn(`no fresh data for ${Math.round(age / 1000)}s — fast retry (${this._staleChecks}/3)`);
        this._beat();                       // fast re-subscribe / ping
        if (this._staleChecks >= 3) {
          this._staleChecks = 0;
          warn('token appears DEAD despite heartbeat — starting self-repair');
          this._repair();
        }
      } else {
        this._staleChecks = 0;
      }
    }, 5000);
  }

  _stopWatchdog() { if (this._wdTimer) { clearInterval(this._wdTimer); this._wdTimer = null; } }

  // ── Self-repair: automatic token re-capture (brief temporary browser) ──────
  async _repair() {
    if (this._repairing) return;
    if (this._repairOpenUntil && Date.now() < this._repairOpenUntil) return;   // circuit open
    this._repairing = true;
    this.authed = false;
    this._stopHeartbeat();
    this._reportStatus({ connected: false, loggedIn: false, phase: 'repairing' });
    log('self-repair: minting a server-IP token…');
    try {
      // Free path: raw HTTP login (no browser). Browser fallback is disabled for
      // now — a fresh headless login hits reCAPTCHA anyway, and it muddies the
      // repairDiag. Re-enable later if needed.
      const ok = await this.httpLogin();
      if (!ok) throw new Error('httpLogin produced no token');
      this._repairFails = 0; this._repairOpenUntil = 0;
      this._health.repairs++; this._health.lastRepairAt = new Date().toISOString();
      log('self-repair OK ✅ — reconnecting with fresh token');
      this._repairing = false;
      this._connect();
    } catch (e) {
      this._repairing = false;
      // Captcha exhausted (3 tries) → skip the quick-retry window, back off 5 min now.
      const hardBackoff = this._captchaExhausted; this._captchaExhausted = false;
      this._repairFails++;
      err(`self-repair failed (${this._repairFails}${hardBackoff ? ', captcha-exhausted' : ''}): ${e.message}`);
      if (hardBackoff || this._repairFails >= 3) {
        // Circuit-breaker: stop hammering for 5 min, and raise the last-resort alert.
        this._repairOpenUntil = Date.now() + 5 * 60 * 1000;
        this._repairFails = 0;
        this._reportStatus({ connected: false, loggedIn: false, phase: 'login_failed', lastError: 'auto-repair failed; check CAPTCHA_API_KEY / 2captcha balance' });
        err('🟥🟥🟥 LAST RESORT — AUTO-REPAIR FAILED 🟥🟥🟥');
        err('Could not mint a server-IP token after 3 tries (paused 5 min).');
        err('Check: CAPTCHA_API_KEY is set + 2captcha has balance + PO_EMAIL/PO_PASSWORD correct.');
        err('Fallback: run get-po-ssid.js locally ONCE and update PO_AUTH on Render. (TradingView unaffected.)');
        err('🟥🟥🟥────────────────────────────────────────────🟥🟥🟥');
        setTimeout(() => this._repair(), 5 * 60 * 1000 + 1000);
      } else {
        setTimeout(() => this._repair(), 15_000);   // quick retry within the 3-try window
      }
    }
  }

  // ── Raw HTTP login from the SERVER (no browser) → server-IP ci_session token ──
  // Replicates the browser's login POST. PO's login is reCAPTCHA-gated, so this
  // needs CAPTCHA_API_KEY (2captcha): GET login page → extract sitekey → solve
  // captcha → POST with the solved token → capture ci_session (bound to the
  // SERVER's IP → streams 24/7 on Render, no PC needed). Every step → repairDiag.
  async httpLogin() {
    if (!PO_EMAIL || !PO_PASSWORD) { await this._reportRepair('http:no-credentials'); return false; }
    const ua = this._ua();
    const uid = ((/"uid":"?(\d+)/.exec(activeAuth) || /"uid":"?(\d+)/.exec(PO_AUTH) || [])[1]) || '';
    const baseHeaders = {
      'User-Agent': ua, 'Accept-Language': 'en-US,en;q=0.9',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    };
    try {
      await this._reportRepair('http:GET-login-page');
      // Seed the captcha-skip flag PO uses for trusted devices (value is just "1")
      // so a fresh server login isn't forced through reCAPTCHA. Override via PO_LOGIN_COOKIE.
      const jar = {};
      const seed = process.env.PO_LOGIN_COOKIE || 'no-login-captcha=1; lang=en';
      for (const p of seed.split(';')) { const m = /^\s*([^=]+)=([^;]*)/.exec(p); if (m) jar[m[1].trim()] = m[2].trim(); }
      const g = await httpReq('GET', PO_LOGIN_URL, { headers: { ...baseHeaders, Cookie: cookieHeader(jar) } });
      if (g.error) { await this._reportRepair('http:GET-error:' + g.error); return false; }
      mergeCookies(jar, g.setCookie);
      const html = g.body || '';
      // Cloudflare challenge?
      if (g.status === 403 || g.status === 503 || /cf-browser-verification|challenge-platform|Just a moment/i.test(html)) {
        await this._reportRepair('http:cloudflare-challenge (status ' + g.status + ')'); return false;
      }
      const token = (/name=["']token["'][^>]*value=["']([^"']+)/i.exec(html) ||
                     /["']token["']\s*:\s*["']([^"']+)/i.exec(html) || [])[1] || '';
      const regPage = (/name=["']register_page["'][^>]*value=["']([^"']+)/i.exec(html) ||
                       /register_page["']?\s*[:=]\s*["']?([0-9]+)/i.exec(html) || [])[1] || '';
      await this._reportRepair(`http:got-page status=${g.status} token=${token ? 'Y' : 'N'} reg=${regPage ? 'Y' : 'N'} cookies=${Object.keys(jar).length}`);

      // ── Solve reCAPTCHA via 2captcha so PO accepts a server-side login. ──
      // v3 sitekey lives in  recaptcha/api.js?render=SITEKEY  (invisible, score-based);
      // v2 sitekey in  data-sitekey / grecaptcha.render|execute('SITEKEY').
      let captcha = '';
      if (CAPTCHA_API_KEY) {
        const v3key = (/recaptcha\/api\.js\?[^"'<>]*\brender=([\w-]+)/i.exec(html) || [])[1];
        const v2key = (/data-sitekey=["']([\w-]+)/i.exec(html) ||
                       /grecaptcha\.(?:execute|render)\(\s*["']([\w-]+)["']/i.exec(html) || [])[1];
        const sitekey = v3key || v2key;
        const version = v3key ? 'v3' : 'v2';
        const action  = (/grecaptcha\.execute\(\s*["'][\w-]+["']\s*,\s*\{[^}]*\baction\s*:\s*["']([^"']+)/i.exec(html) || [])[1] || 'login';
        if (!sitekey) {
          await this._reportRepair('http:no-sitekey-on-page (login will likely be rejected)');
        } else {
          await this._reportRepair(`http:solving-recaptcha ${version} key=${sitekey.slice(0, 12)}… act=${action}`);
          for (let attempt = 1; attempt <= 3 && !captcha; attempt++) {
            try {
              captcha = await solveRecaptcha({ sitekey, pageurl: PO_LOGIN_URL, action, version });
            } catch (e) {
              await this._reportRepair(`http:captcha-try${attempt}/3-fail:${(e.message || '').slice(0, 50)}`);
            }
          }
          if (!captcha) {
            // Captcha unsolvable after 3 tries → tell _repair to back off 5 min.
            this._captchaExhausted = true;
            await this._reportRepair('http:captcha-failed-3x → backing off 5 min');
            return false;
          }
          await this._reportRepair('http:captcha-solved ✅');
        }
      } else {
        await this._reportRepair('http:no-CAPTCHA_API_KEY set (raw login — likely rejected)');
      }

      const boundary = '----poB' + Math.random().toString(36).slice(2);
      const body = multipartBody(boundary, {
        submitLogin: '1', email: PO_EMAIL, password: PO_PASSWORD,
        // PO reads the reCAPTCHA token from the `token` field (empty g-recaptcha-response
        // in the real browser POST); send the solution in both to be safe.
        'g-recaptcha-response': captcha, register_page: regPage, token: captcha || token,
      });
      const p = await httpReq('POST', PO_LOGIN_URL, {
        headers: {
          ...baseHeaders,
          'Content-Type': 'multipart/form-data; boundary=' + boundary,
          'Content-Length': Buffer.byteLength(body),
          Origin: 'https://pocketoption.com', Referer: PO_LOGIN_URL,
          Cookie: cookieHeader(jar),
        }, body,
      });
      if (p.error) { await this._reportRepair('http:POST-error:' + p.error); return false; }
      mergeCookies(jar, p.setCookie);
      const ci = jar['ci_session'];
      if (ci && ci.length > 40) {
        const session = decodeURIComponent(ci);
        activeAuth = JSON.stringify(['auth', {
          session, isDemo: 0, uid: Number(uid) || 0, platform: 2, isFastHistory: true, isOptimized: true,
        }]);
        await saveToken(activeAuth, activeWsUrl);
        await this._reportRepair('http:LOGIN-OK ✅ server-IP token minted');
        return true;
      }
      await this._reportRepair(`http:no-ci_session (POST status ${p.status}) — login rejected`);
      return false;
    } catch (e) {
      await this._reportRepair('http:error:' + (e.message || '').slice(0, 80));
      return false;
    }
  }

  // Live recapture-stage reporter → otc_status.repairDiag (so progress/failure of
  // the browser strike is visible in the DB without needing Render logs).
  async _reportRepair(stage) {
    this._repairDiag = stage;
    log('recapture stage:', stage);
    if (!db) return;
    try {
      const now = new Date().toISOString();
      const { data } = await db.from('configs').select('data').eq('id', 'otc_status').single();
      const cur = (data && data.data) || {};
      // Keep a bounded trail of the LAST stages so the whole login attempt
      // (solving-recaptcha → captcha-solved → LOGIN-OK / rejected) is visible
      // in a single snapshot — repairDiag alone only shows the latest step.
      const trail = Array.isArray(cur.repairTrail) ? cur.repairTrail.slice(-11) : [];
      trail.push(now.slice(11, 19) + ' ' + stage);
      await db.from('configs').update({
        data: { ...cur, repairDiag: stage, repairStageAt: now, repairTrail: trail },
      }).eq('id', 'otc_status');
    } catch (_) {}
  }

  // Temporary, login-only browser "strike": open → log in → grab the new auth
  // frame via CDP → close immediately. Kept short + resource-blocked to minimise
  // RAM (it is NOT a persistent browser).
  async recaptureToken() {
    if (!PO_EMAIL || !PO_PASSWORD) { warn('auto-recapture needs PO_EMAIL/PO_PASSWORD'); return false; }
    let puppeteer, chromium, browser = null;
    try {
      chromium = require('@sparticuz/chromium');
      puppeteer = require('puppeteer-core');
      try { chromium.setGraphicsMode = false; } catch (_) {}
    } catch (e) { await this._reportRepair('deps-missing:' + e.message); return false; }
    try {
      await this._reportRepair('launching-chromium');
      const execPath = process.env.PUPPETEER_EXECUTABLE_PATH || await chromium.executablePath();
      browser = await puppeteer.launch({
        headless: chromium.headless ?? true,
        executablePath: execPath || undefined,
        args: [...(chromium.args || []), '--no-sandbox', '--disable-setuid-sandbox',
               '--disable-dev-shm-usage', '--disable-gpu', '--disable-extensions',
               '--disable-background-networking', '--mute-audio'],
        defaultViewport: { width: 800, height: 600 },
      });
      const page = (await browser.pages())[0] || await browser.newPage();
      try {
        await page.setRequestInterception(true);
        page.on('request', r => {
          const t = r.resourceType();
          if (t === 'image' || t === 'media' || t === 'font' || t === 'stylesheet') r.abort();
          else r.continue();
        });
      } catch (_) {}
      const cdp = await page.target().createCDPSession();
      await cdp.send('Network.enable');
      let authFrame = null, wsUrl = null;
      const urlById = {};
      const isApi = u => /api-[a-z0-9-]*\.po\.market/i.test(u || '');
      cdp.on('Network.webSocketCreated', ({ requestId, url }) => {
        urlById[requestId] = url;
        if (isApi(url) && !wsUrl) wsUrl = url;
      });
      cdp.on('Network.webSocketFrameSent', ({ requestId, response }) => {
        const d = (response && response.payloadData) || '';
        const u = urlById[requestId] || '';
        // Grab the PRICE-server auth (has "session"), NOT the chat "sessionToken".
        if (/"auth"/.test(d) && /"session"/.test(d) && isApi(u)) { authFrame = d; wsUrl = u; }
      });

      await this._reportRepair('browser-launched');
      await page.goto(PO_LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 3500));
      await this._reportRepair('login-page-loaded');
      await page.type('input[type="email"], input[name="email"], #email', PO_EMAIL, { delay: 25 }).catch(() => {});
      await page.type('input[type="password"], input[name="password"], #password', PO_PASSWORD, { delay: 25 }).catch(() => {});
      await page.evaluate(() => { const b = document.querySelector('button[type="submit"], .login-form button, form button'); if (b) b.click(); }).catch(() => {});
      await this._reportRepair('login-submitted');

      const start = Date.now();
      while (Date.now() - start < 45_000 && !authFrame) await new Promise(r => setTimeout(r, 500));

      try { await browser.close(); } catch (_) {} browser = null;

      if (authFrame) {
        activeAuth = authFrame.replace(/^4\d+(-)?/, '');   // store ["auth",{...}]
        if (wsUrl) activeWsUrl = wsUrl;
        await saveToken(activeAuth, activeWsUrl);
        await this._reportRepair('auth-captured-ok');
        log('recaptured a fresh token ✅');
        return true;
      }
      await this._reportRepair('no-auth-after-45s (login failed / captcha?)');
      return false;
    } catch (e) {
      await this._reportRepair('error:' + (e.message || '').slice(0, 80));
      warn('recapture error:', e.message);
      return false;
    } finally {
      if (browser) { try { await browser.close(); } catch (_) {} }
    }
  }

  // ── Strong multi-action heartbeat ──────────────────────────────────────────
  // Goal: keep the session "active" in PO's eyes so the token never idles out.
  //   • randomised 20–40s cadence (looks human, not a fixed robotic tick)
  //   • each beat fires SEVERAL small actions: Engine.IO ping, any captured
  //     heartbeat frames (PO_HEARTBEAT), and a re-subscribe to every enabled
  //     symbol (PO_SUBSCRIBE) — i.e. it actively "uses" the session
  //   • every 10th beat re-sends the auth frame as a proactive session touch
  _startHeartbeat() {
    this._stopHeartbeat();
    const schedule = () => { this._hbTimer = setTimeout(() => { this._beat(); schedule(); }, nextBeatMs()); };
    schedule();
  }

  _stopHeartbeat() { if (this._hbTimer) { clearTimeout(this._hbTimer); this._hbTimer = null; } }

  _send(frame) { try { if (this.ws && this.ws.readyState === WebSocketLib.OPEN) this.ws.send(frame); } catch (_) {} }

  _beat() {
    if (!this.ws || this.ws.readyState !== WebSocketLib.OPEN) return;
    this._beatCount++;
    // PO's app-level keep-alive is just "ps" — NO client Engine.IO ping (the real
    // browser never sends '2'; it only PONGs the server). Sending '2' seems to make
    // PO drop us ~at the first beat, so we don't.
    this._send('42["ps"]');
    for (const f of PO_HEARTBEAT) this._send(typeof f === 'string' ? f : JSON.stringify(f));
    if (this._diagPing) log('beat #' + this._beatCount + ': ps');
  }

  // Subscribe to every enabled symbol the way the real client does:
  //   42["changeSymbol",{"asset":SYM,"period":60}]  (loads history)
  //   42["subfor",SYM]                              (live stream)
  _subscribeAll() {
    if (!this.ws || this.ws.readyState !== WebSocketLib.OPEN) return;
    const syms = [...this.enabled];
    if (!syms.length) { log('no enabled OTC symbols to subscribe yet'); return; }
    for (const sym of syms) {
      this._send('42["changeSymbol",{"asset":"' + sym + '","period":60}]');
      this._send('42["subfor","' + sym + '"]');
    }
    log('subscribed to', syms.length, 'OTC symbol(s):', syms.join(', '));
  }

  // Optional 2nd keep-alive channel: periodic HTTPS GET with the session cookie,
  // so the session also stays warm over HTTP (dual keep-alive). Off unless
  // PO_KEEPALIVE_URL is set.
  startHttpKeepAlive() {
    if (!PO_KEEPALIVE_URL || this._httpTimer) return;
    const hit = () => {
      try {
        const u = new URL(PO_KEEPALIVE_URL);
        const req = https.request({
          hostname: u.hostname, path: u.pathname + u.search, method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            ...(PO_COOKIE ? { Cookie: PO_COOKIE } : {}),
          },
        }, r => r.resume());
        req.on('error', () => {});
        req.end();
      } catch (_) {}
      this._httpTimer = setTimeout(hit, nextBeatMs() * 3);  // ~1–2 min
    };
    hit();
    log('HTTP keep-alive channel active');
  }

  // ── Per-second candle tick for enabled pairs + live price flush ────────────
  tickAll() {
    for (const sym of this.enabled) {
      const p = this.prices[sym];
      if (p != null) this.store.tick(sym, p);
    }
    this._flushPrices();
  }

  _flushPrices() {
    if (!db) return;
    const now = Date.now();
    if (now - this._lastPricesWrite < PRICE_MS) return;
    const snapshot = {}; let any = false;
    for (const sym of this.enabled) {
      const p = this.prices[sym];
      if (p == null) continue;
      const stale = this._priceAt[sym] && (now - this._priceAt[sym] > 10_000);
      let st;
      if (!this.connected) st = 'resolving';
      else if (stale) st = 'resolving';
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

  applyEnabled(symbols) {
    this.enabled = new Set(symbols);
    log(`tracking ${this.enabled.size} enabled OTC pair(s):`, [...this.enabled].join(', ') || '(none)');
    if (this.authed) this._subscribeAll();   // subscribe newly-enabled symbols live
  }

  async _reportStatus(patch) {
    const newPhase = patch.phase || this._phase;
    if (newPhase !== this._phase) this._phaseSince = new Date().toISOString();   // phase transition time (for client UX escalation)
    this._phase = newPhase;
    if (patch.diag) this._diag = patch.diag;
    if (!db) return;
    try {
      // Merge with the current row so we DON'T wipe fields other writers own
      // (cfg from boot, repairTrail/repairStageAt from _reportRepair).
      const { data } = await db.from('configs').select('data').eq('id', 'otc_status').single();
      const cur = (data && data.data) || {};
      await db.from('configs').update({
        data: {
          ...cur,
          connected: !!patch.connected, loggedIn: !!patch.loggedIn, phase: this._phase,
          phaseSince: this._phaseSince, diag: this._diag || '', repairDiag: this._repairDiag || '',
          reconnects: this.reconnects, lastError: patch.lastError || '',
          // Session health log (helps understand real token lifetime over time).
          lastHeartbeatOk: this._health.lastHeartbeatOk,
          repairs: this._health.repairs,
          lastRepairAt: this._health.lastRepairAt,
          updatedAt: new Date().toISOString(),
        },
      }).eq('id', 'otc_status');
    } catch (_) {}
  }

  // ── Discovery ("جلب الأزواج") — from the cached updateAssets catalogue ──────
  async runScan() {
    if (this._scanning) return;
    this._scanning = true;
    log('scan: listing OTC pairs from the asset catalogue…');
    await this._reportScan({ status: 'scanning', message: 'جاري البحث عن الأزواج…' });
    try {
      // The catalogue arrives on connect; if a scan is requested before it lands,
      // wait briefly for it.
      const start = Date.now();
      while (this._assetMap.size === 0 && Date.now() - start < 8000) {
        await new Promise(r => setTimeout(r, 500));
      }
      const found = [...this._assetMap.values()];
      // Also include any OTC symbols we've already seen live prices for.
      for (const sym of Object.keys(this.prices)) {
        if (/otc/i.test(sym) && !found.some(x => x.symbol === sym)) {
          found.push({ symbol: sym, name: this.proto.displayName(sym) });
        }
      }
      log(`scan: found ${found.length} OTC pair(s)`);
      await this._upsertLibrary(found);
      await this._reportScan({ status: 'done', count: found.length, message: `تم العثور على ${found.length} زوج` });
    } catch (e) {
      err('scan failed:', e.message);
      await this._reportScan({ status: 'error', message: e.message });
    } finally { this._scanning = false; }
  }

  async _upsertLibrary(assets) {
    if (!db || !assets.length) return;
    const rows = assets.map(a => ({
      platform: this.proto.id, symbol: a.symbol,
      name: a.name || this.proto.displayName(a.symbol), updated_at: new Date().toISOString(),
    }));
    const { error } = await db.from('otc_pairs').upsert(rows, { onConflict: 'platform,symbol', ignoreDuplicates: false });
    if (error) err('library upsert:', error.message);
    else log(`library: upserted ${rows.length} pair(s)`);
  }

  async _reportScan(patch) {
    if (!db) return;
    try {
      const { data } = await db.from('configs').select('data').eq('id', 'otc_scan').single();
      const cur = (data && data.data) || {};
      await db.from('configs').update({ data: { ...cur, ...patch, updatedAt: new Date().toISOString() } }).eq('id', 'otc_scan');
    } catch (_) {}
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  Control plane
// ════════════════════════════════════════════════════════════════════════════
async function loadEnabledSymbols() {
  if (!db) return [];
  const { data, error } = await db.from('otc_pairs').select('symbol').eq('enabled', true);
  if (error) { err('load enabled:', error.message); return []; }
  return (data || []).map(r => r.symbol);
}

// Persist / restore the auto-recaptured token so a restart reuses the freshest
// one instead of falling back to the (possibly stale) env value.
async function loadToken() {
  if (!db) return;
  try {
    const { data } = await db.from('configs').select('data').eq('id', 'otc_token').maybeSingle();
    const t = data && data.data;
    if (t && t.auth) {
      activeAuth = t.auth;
      if (t.wsUrl) activeWsUrl = t.wsUrl;
      log('restored saved session token (captured ' + (t.capturedAt || '?') + ')');
    }
  } catch (_) {}
}
async function saveToken(auth, wsUrl) {
  if (!db) return;
  try {
    await db.from('configs').upsert({
      id: 'otc_token',
      data: { auth, wsUrl: wsUrl || activeWsUrl, capturedAt: new Date().toISOString() },
    });
  } catch (e) { err('saveToken:', e.message); }
}

async function start() {
  await loadToken();             // prefer the freshest persisted token over env

  // Report build + config to the DB so we can confirm (without Render logs) which
  // code is live and whether the credentials/token are actually set on this service.
  if (db) {
    try {
      const { data } = await db.from('configs').select('data').eq('id', 'otc_status').single();
      const cur = (data && data.data) || {};
      await db.from('configs').update({ data: { ...cur,
        cfg: `build=${BUILD} email=${!!PO_EMAIL} pass=${!!PO_PASSWORD} captcha=${!!CAPTCHA_API_KEY} authLen=${(activeAuth || '').length} ws=${(activeWsUrl || '').replace(/\?.*/, '')}`,
      } }).eq('id', 'otc_status');
    } catch (_) {}
  }

  const client = new PoWsClient(PoProtocol);

  // Know which symbols to subscribe BEFORE connecting.
  const enabled = await loadEnabledSymbols();
  client.applyEnabled(enabled);
  await client.store.hydrate(enabled);

  client.start();
  client.startHttpKeepAlive();   // optional 2nd keep-alive channel (if configured)

  setInterval(() => client.tickAll(), PRICE_MS);

  if (db) {
    db.channel('otc-pairs-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'otc_pairs' }, async () => {
        const syms = await loadEnabledSymbols();
        client.applyEnabled(syms);
        await client.store.hydrate(syms);
      })
      .subscribe(s => { if (s === 'SUBSCRIBED') log('otc_pairs realtime active'); });

    let lastScanReq = null;
    db.channel('otc-scan-trigger')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'configs', filter: 'id=eq.otc_scan' }, payload => {
        const req = payload.new && payload.new.data && payload.new.data.requestedAt;
        if (req && req !== lastScanReq) { lastScanReq = req; client.runScan(); }
      })
      .subscribe(s => { if (s === 'SUBSCRIBED') log('otc_scan realtime active'); });

    try {
      const { data } = await db.from('configs').select('data').eq('id', 'otc_scan').single();
      const req = data && data.data && data.data.requestedAt;
      if (req && data.data.status === 'requested') { lastScanReq = req; client.runScan(); }
    } catch (_) {}
  }

  log('OTC scraper (direct WebSocket) started');
}

module.exports = { start, PoWsClient, PoProtocol, CandleStore };

if (require.main === module || process.env.OTC_AUTOSTART !== '0') {
  start().catch(e => err('fatal:', e.message));
}
