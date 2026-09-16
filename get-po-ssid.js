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

// ── --demo : the open demo account, as a PROOF run ───────────────────────────
//
// The demo page needs no login and shows no captcha, and the question this mode
// exists to answer is whether that makes it usable as a feed. Three things have
// to be true, and none of them could be checked from outside:
//
//   1. a session is minted at all — a raw WebSocket to try-demo-eu.po.market is
//      answered with `41` (disconnect) both with an empty session and with no
//      auth frame at all, so something in their page mints one;
//   2. the catalogue carries the twenty pairs we actually trade;
//   3. the prices are the same market as the account we have been using.
//
// It changes nothing about the normal run. Without the flag this file behaves
// exactly as it did — it is still the way back if the demo path fails.
const DEMO = process.argv.includes('--demo');
const DEMO_URL = 'https://m.pocketoption.com/en/cabinet/try-demo/';

// The demo streams from a DIFFERENT host — `try-demo-eu.po.market`, not
// `api-eu.po.market`. Read off the demo page itself; the capture would find no
// auth frame at all without it.
const isPriceApi = (u) =>
  /api-[a-z0-9-]*\.po\.market/i.test(u || '') ||
  (DEMO && /try-demo-[a-z0-9-]*\.po\.market/i.test(u || ''));

/** The twenty pairs the app trades — `pair_kept()` in the shortlist migration. */
const SHORTLIST = [
  'EURUSD', 'USDJPY', 'GBPUSD', 'USDCAD', 'AUDUSD', 'USDCHF',
  'EURJPY', 'GBPJPY', 'EURCHF', 'AUDJPY',
  'EURUSD_otc', 'USDJPY_otc', 'GBPUSD_otc', 'USDCAD_otc', 'USDCHF_otc',
  'NZDUSD_otc', 'EURGBP_otc', 'GBPJPY_otc', 'XAUUSD_otc', 'XAGUSD_otc',
];

/** Where the stored candles are read from, to compare the demo's prices. */
const REFERENCE = 'https://euro-trade-cache.eurotrade.workers.dev';

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

  // Capture the LOGIN POST so the server can replicate it over raw HTTP (no
  // browser) → a session token minted from the SERVER's IP.
  const loginPosts = [];
  cdp.on('Network.requestWillBeSent', ({ request }) => {
    if (!request || request.method !== 'POST') return;
    const pd = request.postData || '';
    if (/(login|auth|sign|session)/i.test(request.url) || /pass|email/i.test(pd)) {
      loginPosts.push({ url: request.url, headers: request.headers || {}, postData: pd.slice(0, 800) });
      console.log('[login POST]', request.url);
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

  // ── What the demo run exists to answer ───────────────────────────────────
  //
  // `assets` is every symbol the catalogue advertises; `livePrices` is the last
  // price seen for each. Both come off the same received frames the sampler
  // below reads, because the stream carries them and there is no second source.
  const assets = new Set();
  const livePrices = {};

  function harvest(text) {
    if (!DEMO) return;
    // updateAssets: a long array of [id, "SYMBOL", name, type, …] tuples.
    if (/updateAssets/i.test(text)) {
      for (const m of text.matchAll(/\[\s*\d+\s*,\s*"([A-Za-z0-9_#-]{3,20})"/g)) assets.add(m[1]);
    }
    // Price ticks: ["SYMBOL", <epoch>, <price>]
    for (const m of text.matchAll(
      /\[\s*"([A-Za-z0-9_#-]{3,20})"\s*,\s*\d{9,}(?:\.\d+)?\s*,\s*(\d+(?:\.\d+)?)\s*\]/g,
    )) {
      assets.add(m[1]);
      livePrices[m[1]] = Number(m[2]);
    }
  }

  cdp.on('Network.webSocketFrameReceived', ({ requestId, response }) => {
    {
      // Harvested BEFORE the sampler's cap. That cap is there to keep the saved
      // file small, and the catalogue arrives in frames far past the sixtieth —
      // reading it after the cap would find nothing at all.
      let t = (response && response.payloadData) || '';
      if (response && response.opcode === 2) {
        try { t = Buffer.from(t, 'base64').toString('utf8'); } catch (_) {}
      }
      harvest(String(t));
    }
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

  await page.goto(DEMO ? DEMO_URL : LOGIN_URL).catch(() => {});
  console.log(DEMO
    ? '\n>>> The demo opens on its own — no login, no captcha. Let it run ~40s so\n' +
      '    the catalogue and prices arrive, then press ENTER here <<<\n'
    : '\n>>> Log in, open a chart, wait ~20s, then press ENTER here <<<\n');
  await new Promise((resolve) => {
    const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
    rl.question('', () => { rl.close(); resolve(); });
  });

  // Dump the session cookies (ci_session = the SSID; logging in from the server
  // will mint the same cookie with the server's IP baked in).
  let cookies = [];
  try {
    cookies = await page.cookies('https://pocketoption.com/', 'https://po.market/', page.url());
  } catch (_) {}
  const ci = cookies.find(c => /ci_session|session/i.test(c.name));
  if (ci) console.log('\n[ci_session cookie]', ci.name, '=', String(ci.value).slice(0, 60) + '…\n');

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

  // ── The proof report ──────────────────────────────────────────────────────
  //
  // Three questions, and the run is worth nothing unless it answers all three.
  // They are printed rather than left in the JSON because the point of this
  // mode is to decide whether to go on, and that decision should not need a
  // second tool to read.
  let reference = {};
  if (DEMO) {
    console.log('┌─ 1. IS A SESSION MINTED AT ALL ────────────────────────────────');
    if (priceAuth) {
      const hasSession = /"session"\s*:\s*"[^"]{8,}"/.test(priceAuth.frame);
      console.log('│  auth frame captured on ' + priceAuth.url);
      console.log('│  carries a session token: ' + (hasSession ? 'YES' : 'NO — empty or absent'));
      console.log('│  ' + (hasSession
        ? 'So the demo does mint one, and it can be replayed by the scraper.'
        : 'So the page authorises some other way and PO_AUTH cannot carry it.'));
    } else {
      console.log('│  NO auth frame seen. Either the chart never opened, or the demo');
      console.log('│  authorises without one — in which case this path cannot be');
      console.log('│  replayed from the server and the answer is no.');
    }

    console.log('│\n├─ 2. DOES IT CARRY THE TWENTY PAIRS ────────────────────────────');
    const present = SHORTLIST.filter(s => assets.has(s));
    const missing = SHORTLIST.filter(s => !assets.has(s));
    console.log('│  catalogue symbols seen: ' + assets.size);
    console.log('│  of our twenty: ' + present.length + ' present, ' + missing.length + ' missing');
    if (missing.length) console.log('│  MISSING: ' + missing.join(', '));

    console.log('│\n├─ 3. IS IT THE SAME MARKET ─────────────────────────────────────');
    // Against the stored candles, through the public proxy — no keys needed.
    // Eleven days old, so the prices have moved and equality would prove
    // nothing. What this CAN settle is whether it is the same instrument at
    // all: a different feed, or a different scale, shows up as a wild gap.
    try {
      const r = await fetch(REFERENCE + '/api/otc/candles-bulk?symbols=' +
        encodeURIComponent(SHORTLIST.join(',')) + '&interval=1m');
      const body = await r.json();
      for (const [sym, arr] of Object.entries(body.candles || {})) {
        if (Array.isArray(arr) && arr.length) reference[sym] = arr[arr.length - 1].c;
      }
    } catch (e) {
      console.log('│  (reference unavailable: ' + e.message + ')');
    }
    console.log('│  symbol           demo now        stored (11d old)   gap');
    for (const sym of SHORTLIST) {
      const live = livePrices[sym];
      const ref = reference[sym];
      if (live === undefined && ref === undefined) continue;
      const gap = (live !== undefined && ref) ? ((live - ref) / ref) * 100 : null;
      console.log('│  ' + sym.padEnd(16) +
        String(live ?? '—').padEnd(15) +
        String(ref ?? '—').padEnd(18) +
        (gap === null ? '—' : (gap >= 0 ? '+' : '') + gap.toFixed(2) + '%'));
    }
    console.log('│  A gap of a few percent is eleven days of market. A gap of');
    console.log('│  hundreds, or a price on a different scale, is a different feed.');
    console.log('└────────────────────────────────────────────────────────────────\n');
  }

  const outFile = DEMO ? 'po-capture-demo.json' : 'po-capture.json';
  fs.writeFileSync(outFile, JSON.stringify(
    { capturedAt: new Date().toISOString(), mode: DEMO ? 'demo' : 'login',
      wsUrl, cookie, authFrames, handshakes,
      loginPosts, cookies, recvSamples, allWsUrls: wsUrls,
      // Demo only: what the three questions were answered with.
      assets: DEMO ? [...assets].sort() : undefined,
      livePrices: DEMO ? livePrices : undefined,
      reference: DEMO ? reference : undefined,
      shortlist: DEMO ? SHORTLIST : undefined }, null, 2));
  // A separate file on purpose: a demo run must never overwrite the capture the
  // working account depends on. That file is the way back.
  console.log('📄 Saved ' + outFile + (DEMO
    ? ' — send it back with the report above.\n'
    : ' — send its contents back (login flow + cookies) so the server can replicate the login.\n'));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
