'use strict';
/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  Pocket Option session + WebSocket capture  —  RUN THIS ON YOUR OWN PC
 *  (NOT on Render). Opens Chrome, you log in, and it captures what the
 *  browser-free scraper needs for the PRICE server (api-*.po.market):
 *     • PO_WS_URL  — the price websocket URL
 *     • PO_AUTH    — the FULL price-server auth frame  (your session token)
 *     • decoded sample frames — so the parser can be verified against PO
 *
 *  SETUP (one time):  npm install puppeteer   then   node get-po-ssid.js
 *  Log in, open a chart, wait ~20s, press ENTER. Copy PO_WS_URL + PO_AUTH to
 *  Render, and send po-capture.json back.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const fs = require('fs');
let puppeteer;
try { puppeteer = require('puppeteer'); }
catch (_) { console.error('Run:  npm install puppeteer'); process.exit(1); }

const LOGIN_URL = 'https://pocketoption.com/en/login/';
const isPriceApi = (u) => /api-[a-z0-9-]*\.po\.market/i.test(u || '');

(async () => {
  console.log('Opening Chrome… log in to Pocket Option, open a chart, then come back.');
  const browser = await puppeteer.launch({ headless: false, defaultViewport: null });
  const page = (await browser.pages())[0] || await browser.newPage();
  const cdp = await page.target().createCDPSession();
  await cdp.send('Network.enable');

  const wsUrls = {};            // requestId → url
  const authFrames = [];        // {url, frame}
  const recvSamples = [];       // decoded sample received frames
  const handshakes = [];        // {url, cookie, headers} of the WS upgrade requests

  cdp.on('Network.webSocketCreated', ({ requestId, url }) => {
    wsUrls[requestId] = url;
    if (/po\.market|pocketoption|socket\.io/i.test(url)) console.log('[WS opened]', url);
  });

  // The browser sends the session COOKIE on the WS upgrade handshake — PO likely
  // validates it to authorise streaming. Capture it so the server can replay it.
  cdp.on('Network.webSocketWillSendHandshakeRequest', ({ requestId, request }) => {
    const url = wsUrls[requestId] || '';
    const h = (request && request.headers) || {};
    const cookie = h.Cookie || h.cookie || '';
    if (isPriceApi(url) && cookie && !handshakes.some(x => x.url === url)) {
      handshakes.push({ url, cookie, headers: h });
      console.log('\n[handshake cookie on ' + url + ']\n' + cookie + '\n');
    }
  });

  cdp.on('Network.webSocketFrameSent', ({ requestId, response }) => {
    const d = (response && response.payloadData) || '';
    if (/"auth"/.test(d)) {
      const url = wsUrls[requestId] || '';
      if (!authFrames.some(a => a.url === url)) {
        authFrames.push({ url, frame: d });
        console.log('\n[auth frame on ' + url + ']\n' + d + '\n');
      }
    }
  });

  cdp.on('Network.webSocketFrameReceived', ({ requestId, response }) => {
    if (recvSamples.length >= 60) return;
    const url = wsUrls[requestId] || '';
    let d = (response && response.payloadData) || '';
    // opcode 2 = binary → CDP gives base64; decode to UTF-8 (PO's binary is JSON).
    if (response && response.opcode === 2) {
      try { d = Buffer.from(d, 'base64').toString('utf8'); } catch (_) {}
    }
    if (/otc|updatestream|updateassets|asset|history|\d+\.\d{2,}/i.test(String(d))) {
      recvSamples.push({ url, binary: response && response.opcode === 2, d: String(d).slice(0, 600) });
    }
  });

  await page.goto(LOGIN_URL).catch(() => {});
  console.log('\n>>> Log in, open a chart, wait ~20s, then press ENTER here <<<\n');
  await new Promise((resolve) => {
    const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
    rl.question('', () => { rl.close(); resolve(); });
  });

  // Prefer the auth sent to the PRICE api server (contains "session"); fall back.
  const priceAuth = authFrames.find(a => isPriceApi(a.url) && /"session"/.test(a.frame))
                 || authFrames.find(a => isPriceApi(a.url))
                 || authFrames[0];
  const wsUrl = (priceAuth && isPriceApi(priceAuth.url) ? priceAuth.url : null)
             || Object.values(wsUrls).find(isPriceApi)
             || '(not found — keep a chart open longer and retry)';
  const hs = handshakes.find(h => h.url === wsUrl) || handshakes[0];
  const cookie = hs ? hs.cookie : '';

  console.log('\n══════════════ COPY THESE TO RENDER → Environment ══════════════');
  console.log('PO_WS_URL =', wsUrl);
  console.log('PO_AUTH   =', priceAuth ? priceAuth.frame.replace(/^\d+/, '') : '(not found)');
  console.log('PO_COOKIE =', cookie || '(none captured — keep chart open longer & retry)');
  console.log('════════════════════════════════════════════════════════════════\n');

  fs.writeFileSync('po-capture.json', JSON.stringify(
    { capturedAt: new Date().toISOString(), wsUrl, cookie, authFrames, handshakes, recvSamples, allWsUrls: wsUrls }, null, 2));
  console.log('📄 Saved po-capture.json — send its contents back to verify.\n');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
