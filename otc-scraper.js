'use strict';

/**
 * PocketOption OTC Scraper
 * Logs into PocketOption with Puppeteer, spies on all WebSocket frames,
 * and extracts live tick prices for OTC currency pairs.
 *
 * Required env vars:
 *   PO_EMAIL    – PocketOption account email
 *   PO_PASSWORD – PocketOption account password
 */

/* Mapping: PocketOption asset names  →  our internal OTC symbol */
const SYM_MAP = {
  // Common variations PocketOption might use
  'EURUSD_OTC':  'EURUSD_OTC',
  'EURUSD-OTC':  'EURUSD_OTC',
  'EURUSDOTC':   'EURUSD_OTC',
  '#EURUSD_OTC': 'EURUSD_OTC',
  'EUR/USD OTC': 'EURUSD_OTC',
  'EURUSD':      null, // non-OTC, skip

  'GBPUSD_OTC':  'GBPUSD_OTC',
  'GBPUSD-OTC':  'GBPUSD_OTC',
  'GBPUSDOTC':   'GBPUSD_OTC',
  '#GBPUSD_OTC': 'GBPUSD_OTC',
  'GBP/USD OTC': 'GBPUSD_OTC',

  'XAUUSD_OTC':  'XAUUSD_OTC',
  'XAUUSD-OTC':  'XAUUSD_OTC',
  'XAUUSDOTC':   'XAUUSD_OTC',
  '#XAUUSD_OTC': 'XAUUSD_OTC',
  'XAU/USD OTC': 'XAUUSD_OTC',
};

function normalizeSym(raw) {
  if (!raw) return null;
  // Try exact match first
  if (SYM_MAP[raw] !== undefined) return SYM_MAP[raw];
  // Try uppercase normalized
  const up = raw.toUpperCase().replace(/[#\s/]/g, '');
  for (const [k, v] of Object.entries(SYM_MAP)) {
    if (k.toUpperCase().replace(/[#\s/]/g, '') === up) return v;
  }
  return null;
}

/* ── WebSocket spy script (runs inside the page context) ─────────────── */
const WS_SPY_SCRIPT = `
(function() {
  if (window.__otcSpyInstalled) return;
  window.__otcSpyInstalled = true;

  var _OrigWS = window.WebSocket;

  function SpiedWS(url, protocols) {
    var ws = protocols ? new _OrigWS(url, protocols) : new _OrigWS(url);

    ws.addEventListener('message', function(evt) {
      try {
        if (typeof evt.data === 'string') {
          window.__otcSpy(evt.data);
        } else if (evt.data instanceof ArrayBuffer) {
          window.__otcSpy(new TextDecoder().decode(evt.data));
        } else if (typeof Blob !== 'undefined' && evt.data instanceof Blob) {
          evt.data.text().then(function(t) { window.__otcSpy(t); }).catch(function(){});
        }
      } catch(_) {}
    });

    return ws;
  }

  SpiedWS.prototype  = _OrigWS.prototype;
  SpiedWS.CONNECTING = _OrigWS.CONNECTING;
  SpiedWS.OPEN       = _OrigWS.OPEN;
  SpiedWS.CLOSING    = _OrigWS.CLOSING;
  SpiedWS.CLOSED     = _OrigWS.CLOSED;

  window.WebSocket = SpiedWS;
})();
`;

/* ── OTCScraper class ─────────────────────────────────────────────────── */
class OTCScraper {
  /**
   * @param {object} opts
   * @param {function(sym:string, price:number, ts:number):void} opts.onTick
   */
  constructor({ onTick }) {
    this._onTick    = onTick;
    this._browser   = null;
    this._page      = null;
    this._ready     = false;
    this._destroyed = false;
    this._restartTimer = null;
  }

  /* ── Public ──────────────────────────────────────────────────────────── */

  async start() {
    if (this._destroyed) return;

    const email    = process.env.PO_EMAIL;
    const password = process.env.PO_PASSWORD;

    if (!email || !password) {
      console.warn('[OTC] PO_EMAIL / PO_PASSWORD not set — OTC scraper disabled.');
      return;
    }

    try {
      let puppeteer;
      try { puppeteer = require('puppeteer'); }
      catch (_) {
        console.error('[OTC] puppeteer not installed — run: npm install puppeteer');
        return;
      }

      console.log('[OTC] Launching headless browser...');

      this._browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-extensions',
          '--disable-background-networking',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-breakpad',
          '--disable-sync',
          '--metrics-recording-only',
        ],
      });

      this._page = await this._browser.newPage();
      await this._page.setViewport({ width: 1280, height: 720 });
      await this._page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
        'AppleWebKit/537.36 (KHTML, like Gecko) ' +
        'Chrome/124.0.0.0 Safari/537.36'
      );

      // Inject WS spy BEFORE any page script runs
      await this._page.evaluateOnNewDocument(WS_SPY_SCRIPT);

      // Expose Node.js callback to the page
      await this._page.exposeFunction('__otcSpy', (data) => this._parseMsg(data));

      // Handle page crashes / unexpected closes
      this._browser.on('disconnected', () => {
        if (!this._destroyed) {
          console.warn('[OTC] Browser disconnected — restarting in 30 s...');
          this._scheduleRestart(30000);
        }
      });

      await this._login(email, password);

    } catch (err) {
      console.error('[OTC] Start error:', err.message);
      if (!this._destroyed) this._scheduleRestart(30000);
    }
  }

  destroy() {
    this._destroyed = true;
    clearTimeout(this._restartTimer);
    clearInterval(this._heartbeatTimer);
    if (this._browser) this._browser.close().catch(() => {});
  }

  /* ── Private ─────────────────────────────────────────────────────────── */

  _scheduleRestart(ms) {
    clearTimeout(this._restartTimer);
    this._restartTimer = setTimeout(() => {
      if (this._browser) { try { this._browser.close(); } catch (_) {} }
      this._browser = null;
      this._page    = null;
      this._ready   = false;
      this.start();
    }, ms);
  }

  async _login(email, password) {
    const page = this._page;

    try {
      console.log('[OTC] Navigating to PocketOption login...');
      await page.goto('https://pocketoption.com/en/login/', {
        waitUntil: 'networkidle2',
        timeout: 60000,
      });

      // Wait for email field
      await page.waitForSelector('input[name="email"], input[type="email"]', { timeout: 20000 });
      await page.focus('input[name="email"], input[type="email"]');
      await page.keyboard.type(email, { delay: 60 });

      await page.focus('input[name="password"], input[type="password"]');
      await page.keyboard.type(password, { delay: 60 });

      // Click submit
      await page.click(
        'button[type="submit"], input[type="submit"], ' +
        '.btn-login, .auth-button, form button'
      );

      console.log('[OTC] Waiting for login redirect...');
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 40000 });

      const afterUrl = page.url();
      console.log('[OTC] Post-login URL:', afterUrl);

      if (afterUrl.includes('/login')) {
        console.error('[OTC] Still on login page — check credentials or captcha.');
        this._scheduleRestart(120000); // retry after 2 min
        return;
      }

      // Navigate to the trading interface
      await page.goto('https://pocketoption.com/en/cabinet/demo-quick-high-low/', {
        waitUntil: 'networkidle2',
        timeout: 60000,
      });

      console.log('[OTC] Trading page loaded — price stream active.');
      this._ready = true;

      // Keep browser session alive: ping page every 5 min
      this._heartbeatTimer = setInterval(async () => {
        if (this._destroyed || !this._page) return;
        try {
          const alive = await this._page.evaluate(() => !!document.body);
          if (!alive) throw new Error('page dead');
          console.log('[OTC] heartbeat ok');
        } catch (e) {
          console.warn('[OTC] heartbeat failed — restarting:', e.message);
          clearInterval(this._heartbeatTimer);
          this._scheduleRestart(5000);
        }
      }, 5 * 60 * 1000);

    } catch (err) {
      console.error('[OTC] Login/navigation error:', err.message);
      if (!this._destroyed) this._scheduleRestart(60000);
    }
  }

  _parseMsg(raw) {
    if (!raw || !this._ready) return;

    // Strip socket.io envelope: "42[...]"  "451-[...]"  etc.
    let payload = raw;
    const sioMatch = raw.match(/^4[0-9][-]?(\[.*)$/s);
    if (sioMatch) payload = sioMatch[1];

    let parsed;
    try { parsed = JSON.parse(payload); }
    catch (_) { return; }

    // ── Format 1: ["updateStream", {asset, price, time}] ──────────────
    if (Array.isArray(parsed)) {
      const [action, data] = parsed;
      if (typeof action === 'string' && data && typeof data === 'object') {
        const actions = ['updateStream', 'price', 'tick', 'quotation', 'stream', 'data'];
        if (actions.includes(action)) {
          this._tryEmit(data);
          return;
        }
      }
      // Some brokers stream arrays of ticks
      if (Array.isArray(parsed[0])) {
        for (const item of parsed) this._tryEmit(item);
        return;
      }
    }

    // ── Format 2: {action:"updateStream", message:{...}} ──────────────
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      if (parsed.message) {
        this._tryEmit(parsed.message);
        return;
      }
      // Direct object with asset + price
      this._tryEmit(parsed);
    }
  }

  _tryEmit(data) {
    if (!data || typeof data !== 'object') return;

    // Asset name — try multiple key names
    const asset =
      data.asset  || data.symbol  || data.pair  ||
      data.name   || data.code    || data.ticker ||
      data.s      || data.a;

    // Price — try multiple key names
    const rawPrice =
      data.price  || data.close  || data.value  ||
      data.rate   || data.last   || data.lp     ||
      data.c      || data.p      || data.v;

    if (!asset || rawPrice == null) return;

    const sym   = normalizeSym(String(asset));
    const price = parseFloat(rawPrice);

    if (!sym || isNaN(price) || price <= 0) return;

    const ts = typeof data.time === 'number'      ? data.time
             : typeof data.timestamp === 'number' ? data.timestamp
             : typeof data.t === 'number'         ? data.t
             : Math.floor(Date.now() / 1000);

    const tsSeconds = ts > 1e12 ? Math.floor(ts / 1000) : Math.floor(ts);

    this._onTick(sym, price, tsSeconds);
  }
}

module.exports = { OTCScraper };
