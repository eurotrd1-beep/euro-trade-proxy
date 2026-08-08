'use strict';

/**
 * Single entry point for Render.
 *
 *   • server.js     — the HTTP/WS API host: OTC price WebSocket (/ws), candle +
 *                     status endpoints (/api/otc/*), and pairs CRUD (/api/pairs).
 *   • po-scraper.js — the OTC (Pocket Option) scraper that feeds it.
 *
 * If the OTC scraper ever throws on boot, the HTTP/WS host keeps running:
 * each module owns its own error handling and lifecycle.
 */

// ── WebSocket polyfill (MUST run before any require) ──────────────────────────
// supabase-js Realtime needs a global WebSocket. Node < 22 has none, so realtime
// channels throw ("Node.js 20 detected without native WebSocket support"). Expose
// the `ws` package (already a dependency) as the global WebSocket so the scraper's
// realtime subscriptions work on Node 20. No-op on Node 22+ (native WebSocket).
if (typeof globalThis.WebSocket === 'undefined') {
  try { globalThis.WebSocket = require('ws'); } catch (_) {}
}

// HTTP/WS API host (starts its server on require).
require('./server.js');

// OTC scraper (auto-starts on require unless OTC_AUTOSTART=0).
try {
  require('./po-scraper.js');
} catch (e) {
  console.error('[start] OTC scraper failed to load — API host unaffected:', e.message);
}
