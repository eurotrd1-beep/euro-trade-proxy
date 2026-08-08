'use strict';
/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  RUN THE OTC SCRAPER ON YOUR OWN PC  (the guaranteed-free path)
 *
 *  Pocket Option binds the session token to the IP + device it was created on and
 *  protects fresh logins with reCAPTCHA — so a server can't mint a working token.
 *  But on YOUR PC the token you captured is valid (same IP, trusted device), so
 *  the OTC prices stream fine. This runs the SAME lightweight WebSocket scraper
 *  (no browser, ~20 MB) locally and writes candles to Supabase, exactly like the
 *  server would. TradingView keeps running on Render, unaffected.
 *
 *  USAGE (in this folder, after running `node get-po-ssid.js` at least once):
 *     node run-otc.js
 *  Leave it running while you want OTC signals. Re-run get-po-ssid.js + restart
 *  this when the token eventually expires.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const fs = require('fs');

// 1) Load the freshest capture (PO_WS_URL + PO_AUTH) from get-po-ssid.js.
let cap;
try { cap = JSON.parse(fs.readFileSync('./po-capture.json', 'utf8')); }
catch (_) { console.error('Run  node get-po-ssid.js  first (po-capture.json not found).'); process.exit(1); }

const authFrame =
  (cap.authFrames || []).find(a => /"session"/.test(a.frame) && /api-[a-z0-9-]*\.po\.market/i.test(a.url)) ||
  (cap.authFrames || []).find(a => /"session"/.test(a.frame));
if (!authFrame) { console.error('No price-server auth in po-capture.json — re-run get-po-ssid.js (log in + open a chart).'); process.exit(1); }

process.env.PO_WS_URL = cap.wsUrl || 'wss://api-eu.po.market/socket.io/?EIO=4&transport=websocket';
process.env.PO_AUTH   = authFrame.frame.replace(/^\d+/, '');   // ["auth",{...}]

// 2) Supabase (anon key is fine — RLS is open for writes). Same project as the app.
process.env.SUPABASE_URL         = process.env.SUPABASE_URL || 'https://dlzqdmqkvlvwnjhqxqym.supabase.co';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsenFkbXFrdmx2d25qaHF4cXltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2ODk3OTQsImV4cCI6MjA5ODI2NTc5NH0.Gchfry1V4vDnwSKk-uF9r7C10PfhXUkt2E4EpWGbdAg';

// 3) No browser recapture on the PC — the local token already works here.
process.env.PO_EMAIL = '';
process.env.PO_PASSWORD = '';

console.log('Starting OTC scraper locally (WS:', process.env.PO_WS_URL.replace(/\?.*/, '') + ') …');
console.log('Keep this window open. Prices → Supabase → your app. Ctrl+C to stop.');
require('./po-scraper.js');
