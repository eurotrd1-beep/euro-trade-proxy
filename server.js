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
  global.otcLastTick = Date.now();   // freshness heartbeat (used by the watchdog)
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

// ── Small HTTPS JSON helper for the diagnostics endpoints (no fetch dependency).
function httpsRequest(urlStr, { method = 'GET', headers = {}, body = null, timeoutMs = 30000 } = {}) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(urlStr); } catch (e) { return reject(e); }
    const req = https.request(
      { hostname: u.hostname, path: u.pathname + u.search, method, headers },
      (r) => {
        const chunks = [];
        r.on('data', c => chunks.push(c));
        r.on('end', () => resolve({ status: r.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
      });
    req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

// Build the Arabic diagnosis prompt from the check report. Only STATUSES are sent
// (the Flutter side scrubs secrets); we never add keys/tokens/user data here.
function buildDiagnosePrompt(report) {
  return [
    'ده تقرير حالة نظام Euro Trade (تشخيص ذاتي من لوحة الأدمن).',
    'البنية: Flutter Web + Supabase (Postgres + Realtime) + بروكسي على Render + Cloudflare Worker (كاش) + سكرابر أسعار Pocket Option.',
    '',
    'التقرير (JSON) — كل عنصر فيه اسم الفحص وحالته (ok/warn/fail) وتفاصيل:',
    '```json',
    JSON.stringify(report, null, 2).slice(0, 20000),
    '```',
    '',
    'المطلوب منك:',
    '- تحليل بالعربي المصري.',
    '- إيه المشكلة الأساسية، وإيه اللي عرض وإيه اللي سبب جذري.',
    '- خطوات مرتبة بالأولوية. لكل خطوة: لو الحل زرار في الصفحة اذكر اسمه بالظبط (زي "رجّع للبروكسي المباشر"، "افحص تاني"، "نبّه السكرابر")، ولو محتاج تدخل خارجي اذكر الموقع والخطوات. وقول "ليه دي الأول".',
    '- إنت بتقترح بس — متقولش إنك نفّذت أي إصلاح.',
    '',
    'الشكل بالظبط:',
    '🔍 التشخيص: [سطر أو اتنين]',
    '⚠️ السبب الجذري: [أصل المشكلة]',
    '📋 الخطوات:',
    '١. [الخطوة] → [زرار كذا] أو [روح لـ كذا] — (ليه دي الأول: ...)',
  ].join('\n');
}

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

  // ── GET /api/captcha-balance — 2captcha remaining balance (view only) ────────
  if (url.pathname === '/api/captcha-balance') {
    const key = process.env.CAPTCHA_API_KEY || process.env.TWOCAPTCHA_API_KEY || '';
    if (!key) { json({ available: false, reason: 'CAPTCHA_API_KEY غير مضبوط' }); return; }
    try {
      const r = await httpsRequest(
        `https://2captcha.com/res.php?key=${encodeURIComponent(key)}&action=getbalance&json=1`,
        { timeoutMs: 15000 });
      let bal = null;
      try { const p = JSON.parse(r.body); if (String(p.status) === '1') bal = parseFloat(p.request); } catch (_) {}
      if (bal == null) { const f = parseFloat(r.body); if (isFinite(f)) bal = f; }
      if (bal == null) { json({ available: false, reason: 'رد غير متوقع من 2captcha', raw: r.body.slice(0, 80) }); return; }
      json({ available: true, balance: bal, currency: 'USD' });
    } catch (e) { json({ available: false, reason: e.message }); }
    return;
  }

  // ── GET /api/supabase-usage — project status + usage via Management API ───────
  if (url.pathname === '/api/supabase-usage') {
    const token = process.env.SUPABASE_MGMT_TOKEN || '';
    const ref = (process.env.SUPABASE_URL || '').replace(/^https?:\/\//, '').split('.')[0];
    if (!token) { json({ available: false, reason: 'SUPABASE_MGMT_TOKEN غير مضبوط' }); return; }
    if (!ref)   { json({ available: false, reason: 'تعذّر استخراج ref المشروع' }); return; }
    try {
      const auth = { Authorization: 'Bearer ' + token };
      const proj = await httpsRequest(`https://api.supabase.com/v1/projects/${ref}`, { headers: auth, timeoutMs: 15000 });
      if (proj.status === 401) { json({ available: false, reason: 'التوكن غير صالح (401)' }); return; }
      let projectStatus = null;
      try { projectStatus = JSON.parse(proj.body).status; } catch (_) {}
      let usage = null, usageError = null;
      try {
        const u = await httpsRequest(`https://api.supabase.com/v1/projects/${ref}/usage`, { headers: auth, timeoutMs: 15000 });
        if (u.status === 200) usage = JSON.parse(u.body);
        else if (u.status === 404) usageError = 'الاستهلاك التفصيلي متاح على الداشبورد فقط (مش عبر الـ API)';
        else usageError = 'HTTP ' + u.status;
      } catch (e) { usageError = e.message; }
      json({ available: true, projectStatus, usage, usageError });
    } catch (e) { json({ available: false, reason: e.message }); }
    return;
  }

  // ── POST /api/diagnose — Gemini smart diagnosis (suggests only) ──────────────
  if (url.pathname === '/api/diagnose' && req.method === 'POST') {
    const key = process.env.GEMINI_API_KEY || '';
    if (!key) { json({ available: false, reason: 'GEMINI_API_KEY غير مضبوط' }); return; }
    const nowMs = Date.now();
    if (nowMs - (global._lastDiagnose || 0) < 8000) {
      json({ available: false, reason: 'استنى شوية (rate limit)' }, 429); return;
    }
    global._lastDiagnose = nowMs;
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 200000) req.destroy(); });
    req.on('end', async () => {
      let report; try { report = JSON.parse(raw || '{}'); } catch (_) { report = {}; }
      const prompt = buildDiagnosePrompt(report);
      // Free-tier model availability varies by key/region (some return limit:0),
      // so try current models in order and use the first that actually returns
      // text. limit:0 quota errors come back instantly, so misses cost nothing.
      const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest', 'gemini-1.5-flash'];
      let lastReason = 'Gemini لم يرجّع نصاً', lastStatus = 0, lastGStatus = null;
      for (const model of MODELS) {
        try {
          const gr = await httpsRequest(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
            { method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: { contents: [{ parts: [{ text: prompt }] }] },
              timeoutMs: 30000 });
          let parsed = null;
          try { parsed = JSON.parse(gr.body); } catch (_) {}
          let text = '';
          try { text = parsed.candidates[0].content.parts[0].text; } catch (_) {}
          if (text) { json({ available: true, text, model }); return; }
          const gerr = parsed && parsed.error;
          lastStatus  = gr.status;
          lastGStatus = (gerr && gerr.status) || null;
          lastReason  = (gerr && gerr.message) ? ('Gemini: ' + gerr.message) : lastReason;
          // 400/401/403 = key/request problem, not model availability — stop early.
          if (gr.status && gr.status !== 429 && gr.status !== 404) break;
        } catch (e) { lastReason = e.message; }
      }
      json({ available: false, reason: lastReason, status: lastStatus, googleStatus: lastGStatus });
    });
    return;
  }

  // ── GET /api/ops-status — which self-heal ops are configured (booleans only) ──
  if (url.pathname === '/api/ops-status') {
    json({
      render:   !!process.env.RENDER_API_KEY,
      telegram: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
    });
    return;
  }

  // ── POST /api/render-restart — redeploy THIS service via the Render API ───────
  // RENDER_API_KEY is env-only (never exposed). Discovers the service by name
  // (RENDER_SERVICE_NAME, default euro-trade-proxy-1) then triggers a deploy —
  // exactly what "Manual Deploy" does. Restart only: no config/trading/secrets.
  if (url.pathname === '/api/render-restart' && req.method === 'POST') {
    const key = process.env.RENDER_API_KEY || '';
    if (!key) { json({ available: false, reason: 'RENDER_API_KEY غير مضبوط' }); return; }
    const name = process.env.RENDER_SERVICE_NAME || 'euro-trade-proxy-1';
    const auth = { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', Accept: 'application/json' };
    try {
      let id = global._renderServiceId || process.env.RENDER_SERVICE_ID || '';
      if (!id) {
        const list = await httpsRequest('https://api.render.com/v1/services?limit=100', { headers: auth, timeoutMs: 15000 });
        if (list.status !== 200) { json({ available: false, reason: 'Render list HTTP ' + list.status }); return; }
        let arr = []; try { arr = JSON.parse(list.body); } catch (_) {}
        for (const it of arr) { const s = it.service || it; if (s && s.name === name) { id = s.id; break; } }
        if (!id) { json({ available: false, reason: 'مالقيتش خدمة اسمها ' + name }); return; }
        global._renderServiceId = id;
      }
      const dep = await httpsRequest(`https://api.render.com/v1/services/${id}/deploys`,
        { method: 'POST', headers: auth, body: { clearCache: 'do_not_clear' }, timeoutMs: 20000 });
      if (dep.status === 201 || dep.status === 200) {
        let depId = null; try { depId = JSON.parse(dep.body).id; } catch (_) {}
        json({ ok: true, available: true, deployId: depId, service: name });
      } else {
        json({ available: false, reason: 'Render deploy HTTP ' + dep.status, raw: dep.body.slice(0, 120) });
      }
    } catch (e) { json({ available: false, reason: e.message }); }
    return;
  }

  // ── POST /api/alert — push a Telegram message (self-heal notifications) ───────
  // Body {text} to send, or {test:true} for a setup test. Token + chat id are
  // env-only. Only the admin-composed text is sent — never keys or user data.
  if (url.pathname === '/api/alert' && req.method === 'POST') {
    const token = process.env.TELEGRAM_BOT_TOKEN || '';
    const chat  = process.env.TELEGRAM_CHAT_ID || '';
    if (!token || !chat) { json({ available: false, reason: 'TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID غير مضبوطين' }); return; }
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 20000) req.destroy(); });
    req.on('end', async () => {
      let b = {}; try { b = JSON.parse(raw || '{}'); } catch (_) {}
      const text = b.test ? '✅ اختبار تنبيه Euro Trade — التنبيهات شغّالة.' : String(b.text || '').slice(0, 3500);
      if (!text) { json({ available: false, reason: 'مفيش نص' }); return; }
      try {
        const r = await httpsRequest(`https://api.telegram.org/bot${token}/sendMessage`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: { chat_id: chat, text, disable_web_page_preview: true }, timeoutMs: 15000 });
        if (r.status === 200) { json({ ok: true, available: true }); return; }
        let d = ''; try { d = JSON.parse(r.body).description; } catch (_) {}
        json({ available: false, reason: d || ('Telegram HTTP ' + r.status) });
      } catch (e) { json({ available: false, reason: e.message }); }
    });
    return;
  }

  // ── GET /api/telegram-chat-id — setup helper: last chat(s) that messaged the
  // bot, so the admin can grab TELEGRAM_CHAT_ID without guesswork. ─────────────
  if (url.pathname === '/api/telegram-chat-id') {
    const token = process.env.TELEGRAM_BOT_TOKEN || '';
    if (!token) { json({ available: false, reason: 'TELEGRAM_BOT_TOKEN غير مضبوط' }); return; }
    try {
      const r = await httpsRequest(`https://api.telegram.org/bot${token}/getUpdates`, { timeoutMs: 15000 });
      const ids = [];
      try {
        const u = JSON.parse(r.body);
        for (const up of (u.result || [])) {
          const m = up.message || up.edited_message || up.channel_post;
          if (m && m.chat && m.chat.id != null) ids.push({ id: m.chat.id, name: m.chat.title || m.chat.first_name || m.chat.username || '' });
        }
      } catch (_) {}
      const uniq = []; const seen = new Set();
      for (const x of ids.reverse()) { if (!seen.has(x.id)) { seen.add(x.id); uniq.push(x); } }
      json({ available: true, chats: uniq.slice(0, 5), hint: uniq.length ? '' : 'ابعت رسالة للبوت الأول من تيليجرام وبعدين جرّب تاني' });
    } catch (e) { json({ available: false, reason: e.message }); }
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

  // ── Self-heal watchdog ──────────────────────────────────────────────────────
  // Every 2 min: if the OTC feed is frozen (no tick > 3 min) or serves 0 symbols,
  // try ONE safe rescan (writes otc_scan — the scraper re-lists pairs; it NEVER
  // re-logs-in, so captcha/login are untouched) and, if it stays down, send a
  // debounced Telegram alert. Detect + safe-nudge + notify only — no trading
  // logic changes, no secrets in code. Disable with WATCHDOG_ENABLED=0.
  if (process.env.WATCHDOG_ENABLED !== '0') {
    const wd = { nudgedAt: 0, alertedAt: 0 };
    setInterval(async () => {
      try {
        const token = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_CHAT_ID;
        const syms = (global.otcPrices && Object.keys(global.otcPrices).length) || 0;
        const age  = global.otcLastTick ? (Date.now() - global.otcLastTick) / 1000 : Infinity;
        const down = syms === 0 || age > 180;
        if (!down) return;
        const now = Date.now();
        // 1) one safe rescan, at most once / 5 min
        if (db && now - wd.nudgedAt > 5 * 60 * 1000) {
          wd.nudgedAt = now;
          try {
            const { data } = await db.from('configs').select('data').eq('id', 'otc_scan').single();
            const cur = (data && data.data) || {};
            await db.from('configs').update({ data: { ...cur, requestedAt: new Date().toISOString(), status: 'requested' } }).eq('id', 'otc_scan');
          } catch (_) {}
        }
        // 2) record the incident (debounced 30 min) into repair_log so the repair
        //    page shows it in its notifications panel. Telegram only if configured.
        if (now - wd.alertedAt > 30 * 60 * 1000) {
          wd.alertedAt = now;
          const detail = syms === 0 ? 'مفيش رموز (0)' : ('متجمّدة من ' + Math.round(age) + 'ث');
          if (db) {
            try {
              await db.from('repair_log').insert({
                action: 'watchdog',
                result: 'الأسعار ' + detail + ' — جرّبت أعيد الفحص تلقائياً',
                at: new Date().toISOString(),
              });
            } catch (_) {}
          }
          if (token && chat) {
            const msg = `🔴 Euro Trade — الأسعار ${detail}.`;
            try {
              await httpsRequest(`https://api.telegram.org/bot${token}/sendMessage`,
                { method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: { chat_id: chat, text: msg, disable_web_page_preview: true }, timeoutMs: 15000 });
            } catch (_) {}
          }
        }
      } catch (_) {}
    }, 2 * 60 * 1000);
  }

});
