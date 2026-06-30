'use strict';
/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  Pocket Option session + WebSocket capture  —  RUN THIS ON YOUR OWN PC
 *  (NOT on Render). It opens Chrome, you log in to Pocket Option, and it
 *  captures everything the browser-free scraper needs:
 *     • PO_WS_URL  — the real websocket URL PO uses
 *     • PO_AUTH    — the auth handshake frame (your session token)
 *     • sample price/asset frames — so the scraper can be tuned to PO's format
 *
 *  SETUP (one time), in a terminal in this folder:
 *     npm install puppeteer
 *     node get-po-ssid.js
 *
 *  Then: log in to Pocket Option in the window that opens, open any chart,
 *  wait ~20 seconds, come back here and press ENTER.
 *  It prints PO_WS_URL and PO_AUTH (set those on Render) and saves a file
 *  `po-capture.json` — send that file's contents back so the scraper can be
 *  finished to match PO exactly.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const fs = require('fs');
let puppeteer;
try { puppeteer = require('puppeteer'); }
catch (_) {
  console.error('Puppeteer not installed. Run:  npm install puppeteer');
  process.exit(1);
}

const LOGIN_URL = 'https://pocketoption.com/en/login/';

(async () => {
  console.log('Opening Chrome… log in to Pocket Option, open a chart, then come back.');
  const browser = await puppeteer.launch({ headless: false, defaultViewport: null });
  const page = (await browser.pages())[0] || await browser.newPage();

  const cdp = await page.target().createCDPSession();
  await cdp.send('Network.enable');

  const wsUrls   = {};       // requestId → url
  let   authSent = null;     // captured ["auth",{...}] frame
  const recvSamples = [];    // sample received frames
  const sentSamples = [];    // sample sent frames

  cdp.on('Network.webSocketCreated', ({ requestId, url }) => {
    wsUrls[requestId] = url;
    if (/po\.market|pocketoption|socket\.io/i.test(url)) console.log('[WS opened]', url);
  });

  cdp.on('Network.webSocketFrameSent', ({ requestId, response }) => {
    const d = (response && response.payloadData) || '';
    if (/"auth"/.test(d) && !authSent) {
      authSent = d;
      console.log('\n✅ [AUTH frame captured]\n' + d + '\n');
    }
    if (sentSamples.length < 15) sentSamples.push({ url: wsUrls[requestId], d: String(d).slice(0, 400) });
  });

  cdp.on('Network.webSocketFrameReceived', ({ requestId, response }) => {
    const d = (response && response.payloadData) || '';
    // Keep frames that look like prices / assets / streams.
    if (recvSamples.length < 60 &&
        /otc|updatestream|asset|stream|\d+\.\d{2,}/i.test(String(d))) {
      recvSamples.push({ url: wsUrls[requestId], d: String(d).slice(0, 400) });
    }
  });

  await page.goto(LOGIN_URL).catch(() => {});

  console.log('\n>>> Log in, open a chart, wait ~20s, then press ENTER here <<<\n');
  await new Promise((resolve) => {
    const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
    rl.question('', () => { rl.close(); resolve(); });
  });

  const wsUrl = Object.values(wsUrls).find(u => /po\.market|socket\.io/i.test(u))
             || Object.values(wsUrls)[0] || '(not found)';

  console.log('\n══════════════ COPY THESE TO RENDER → Environment ══════════════');
  console.log('PO_WS_URL =', wsUrl);
  console.log('PO_AUTH   =', authSent ? authSent.replace(/^\d+/, '') : '(not found — keep the chart open longer and retry)');
  console.log('════════════════════════════════════════════════════════════════\n');

  const out = { capturedAt: new Date().toISOString(), wsUrl, authSent, recvSamples, sentSamples, allWsUrls: wsUrls };
  fs.writeFileSync('po-capture.json', JSON.stringify(out, null, 2));
  console.log('📄 Saved po-capture.json — send its contents back to finish the scraper.\n');

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
