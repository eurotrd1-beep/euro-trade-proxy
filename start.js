'use strict';

/**
 * Single entry point for Render.
 *
 * Runs BOTH scrapers in one process WITHOUT modifying either file:
 *   • server.js     — the existing TradingView scraper + HTTP/WS API (untouched)
 *   • po-scraper.js — the new, fully independent OTC (Pocket Option) scraper
 *
 * If the OTC scraper ever throws on boot, the TradingView side keeps running:
 * each module owns its own error handling and lifecycle.
 */

// ── WebSocket polyfill (MUST run before any require) ──────────────────────────
// supabase-js Realtime needs a global WebSocket. Node < 22 has none, so realtime
// channels throw ("Node.js 20 detected without native WebSocket support"). Expose
// the `ws` package (already a dependency) as the global WebSocket so BOTH scrapers'
// realtime subscriptions work on Node 20. No-op on Node 22+ (native WebSocket).
if (typeof globalThis.WebSocket === 'undefined') {
  try { globalThis.WebSocket = require('ws'); } catch (_) {}
}

// TradingView scraper (starts its HTTP/WS server on require).
require('./server.js');

// OTC scraper (auto-starts on require unless OTC_AUTOSTART=0).
try {
  require('./po-scraper.js');
} catch (e) {
  console.error('[start] OTC scraper failed to load — TradingView side unaffected:', e.message);
}
