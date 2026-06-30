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

// TradingView scraper (starts its HTTP/WS server on require).
require('./server.js');

// OTC scraper (auto-starts on require unless OTC_AUTOSTART=0).
try {
  require('./po-scraper.js');
} catch (e) {
  console.error('[start] OTC scraper failed to load — TradingView side unaffected:', e.message);
}
