'use strict';

const http  = require('http');
const https = require('https');
const { WebSocket, WebSocketServer } = require('ws');
const zlib = require('zlib');

// ── Supabase (candles + pairs + OTC status) ───────────────────────────────────
let db = null;
try {
  const { createClient } = require('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (url && key) {
    db = createClient(url, key);
    console.log('[Supabase] initialized');
  } else {
    console.warn('[Supabase] SUPABASE_URL / SUPABASE_SERVICE_KEY not set — DB features disabled');
  }
} catch (e) {
  console.error('[Supabase] init failed:', e.message);
}


// ── Browser WebSocket clients (OTC live price feed) ───────────────────────────
const wss       = new WebSocketServer({ noServer: true });
const clientMap = new Map(); // ws → Set<sym>
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

// Strip prefix if present, return bare symbol
function bareSymbol(sym) {
  return sym.replace(/^[A-Z]+:/, '').replace(/_/g, '').toUpperCase();
}

// Push OTC prices to browser WS clients. The chart subscribes with the BARE
// symbol while the scraper may broadcast a suffixed one — match on the bare
// form so the live price actually reaches the client (otherwise it freezes).
global.broadcastOtcPrice = function(otcSym, price) {
  const bare = bareSymbol(otcSym);
  for (const [ws, subs] of clientMap) {
    if (ws.readyState !== WebSocket.OPEN) continue;
    let match = subs.has(otcSym);
    if (!match) {
      for (const s of subs) { if (bareSymbol(s) === bare) { match = true; break; } }
    }
    if (match) {
      try { ws.send(JSON.stringify({ sym: otcSym, price })); } catch (_) {}
    }
  }
};

const PORT        = process.env.PORT || 3000;
const MAX_CANDLES = 100;   // candles kept per series (served)


// ── HTTP Server ───────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const json = (obj, code = 200) => {
    const bodyStr = JSON.stringify(obj);
    const acceptEncoding = req.headers['accept-encoding'] || '';
    if (acceptEncoding.includes('gzip')) {
      zlib.gzip(bodyStr, (err, compressed) => {
        if (!err) {
          res.writeHead(code, {
            'Content-Type': 'application/json',
            'Content-Encoding': 'gzip',
            'Content-Length': compressed.length
          });
          res.end(compressed);
        } else {
          res.writeHead(code, {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(bodyStr)
          });
          res.end(bodyStr);
        }
      });
    } else {
      res.writeHead(code, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr)
      });
      res.end(bodyStr);
    }
  };

  // ── GET /api/otc/candles?symbol=AEDCNY_otc&interval=1m ───────────────────
  if (url.pathname === '/api/otc/candles') {
    const rawSymbol = url.searchParams.get('symbol') || '';
    const interval  = url.searchParams.get('interval') || '1m';
    if (!rawSymbol) { json({ error: 'symbol required' }, 400); return; }

    const key = `${rawSymbol}_${interval}`;
    let candles = [];

    if (global.otcClient && global.otcClient.store && global.otcClient.store.candles[key]) {
      candles = global.otcClient.store.candles[key];
    } else if (db) {
      try {
        const { data, error } = await db.from('candles').select('data').eq('key', key).single();
        if (!error && data && Array.isArray(data.data)) {
          candles = data.data;
          if (global.otcClient && global.otcClient.store) {
            global.otcClient.store.candles[key] = candles;
          }
        }
      } catch (_) {}
    }

    json({
      status: candles.length ? 'ok' : 'loading',
      candles: candles.slice(-MAX_CANDLES),
    });
    return;
  }

  // ── GET /api/otc/status ───────────────────────────────────────────────────
  if (url.pathname === '/api/otc/status') {
    let prices = global.otcPrices;
    let status = global.otcStatus;

    if (!prices && db) {
      try {
        const { data } = await db.from('configs').select('data').eq('id', 'otc_prices').single();
        prices = data && data.data;
      } catch (_) {}
    }
    if (!status && db) {
      try {
        const { data } = await db.from('configs').select('data').eq('id', 'otc_status').single();
        status = data && data.data;
      } catch (_) {}
    }

    json([
      { id: 'otc_status', data: status || {} },
      { id: 'otc_prices', data: prices || {} }
    ]);
    return;
  }

  // ── GET /health ───────────────────────────────────────────────────────────
  if (url.pathname === '/health') {
    const otcSyms = (global.otcPrices && Object.keys(global.otcPrices).length) || 0;
    json({ status: 'ok', connected: true, otcSymbols: otcSyms });
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
          source:   'po',
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
  console.log('OTC price feed + candle/pairs API online.');

  // Keep-alive: ping self every 10 min so Render free tier never sleeps
  // (idle spin-down is ~15 min). Uses https.get (always available) instead of
  // fetch (undefined on older Node). RENDER_EXTERNAL_URL is provided by Render.
  const SELF_URL = (process.env.RENDER_EXTERNAL_URL || 'https://euro-trade-proxy-1.onrender.com').replace(/\/$/, '');
  setInterval(() => {
    try {
      https.get(SELF_URL + '/health', r => r.resume()).on('error', () => {});
    } catch (_) {}
  }, 10 * 60 * 1000);

});
