'use strict';

/**
 * Single entry point for Render.
 *
 *   • server.js     — the HTTP/WS API host: OTC price WebSocket (/ws), candle +
 *                     status endpoints (/api/otc/*), and self-heal/ops endpoints.
 *   • po-scraper.js — the OTC (Pocket Option) scraper that feeds it.
 *
 * If the OTC scraper ever throws on boot, the HTTP/WS host keeps running:
 * each module owns its own error handling and lifecycle.
 */

// ── Last-resort process guards ────────────────────────────────────────────────
// A stray throw in a timer/WS callback (e.g. bad client input) must NEVER take
// the whole service down. Log and keep running; each subsystem self-heals.
process.on('uncaughtException',  (e) => { try { console.error('[uncaughtException]', e && e.stack || e); } catch (_) {} });
process.on('unhandledRejection', (e) => { try { console.error('[unhandledRejection]', e && e.stack || e); } catch (_) {} });

// ── Load .env (LOCAL dev only; on Render the vars come from the dashboard) ─────
// Tiny parser, no dependency. Never overrides a var already set in the real env.
try {
  const fs = require('fs'), path = require('path');
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
} catch (_) {}

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
