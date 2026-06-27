'use strict';

/**
 * Generic OTC Scraper
 * Opens any trading platform's chart URL, logs in if redirected, and spies
 * on all WebSocket messages to extract live OTC tick prices.
 *
 * Required env vars:
 *   PO_EMAIL    – shared account email
 *   PO_PASSWORD – shared account password
 */

const SYM_MAP = {
  // PocketOption / Quotex / ExpertOption OTC symbol variations
  'EURUSD_OTC':   'EURUSD_OTC',
  'EURUSD-OTC':   'EURUSD_OTC',
  'EURUSDOTC':    'EURUSD_OTC',
  '#EURUSD_OTC':  'EURUSD_OTC',
  'EUR/USD OTC':  'EURUSD_OTC',

  'GBPUSD_OTC':   'GBPUSD_OTC',
  'GBPUSD-OTC':   'GBPUSD_OTC',
  'GBPUSDOTC':    'GBPUSD_OTC',
  '#GBPUSD_OTC':  'GBPUSD_OTC',
  'GBP/USD OTC':  'GBPUSD_OTC',

  'XAUUSD_OTC':   'XAUUSD_OTC',
  'XAUUSD-OTC':   'XAUUSD_OTC',
  'XAUUSDOTC':    'XAUUSD_OTC',
  '#XAUUSD_OTC':  'XAUUSD_OTC',
  'XAU/USD OTC':  'XAUUSD_OTC',

  'USDJPY_OTC':   'USDJPY_OTC',
  'USDJPY-OTC':   'USDJPY_OTC',
  'USDJPYOTC':    'USDJPY_OTC',
  '#USDJPY_OTC':  'USDJPY_OTC',
  'USD/JPY OTC':  'USDJPY_OTC',

  'USDCHF_OTC':   'USDCHF_OTC',
  'USDCHF-OTC':   'USDCHF_OTC',
  'USDCHFOTC':    'USDCHF_OTC',
  '#USDCHF_OTC':  'USDCHF_OTC',
  'USD/CHF OTC':  'USDCHF_OTC',

  'AUDUSD_OTC':   'AUDUSD_OTC',
  'AUDUSD-OTC':   'AUDUSD_OTC',
  'AUDUSDOTC':    'AUDUSD_OTC',
  '#AUDUSD_OTC':  'AUDUSD_OTC',
  'AUD/USD OTC':  'AUDUSD_OTC',

  'EURGBP_OTC':   'EURGBP_OTC',
  'EURGBP-OTC':   'EURGBP_OTC',
  'EURGBPOTC':    'EURGBP_OTC',
  '#EURGBP_OTC':  'EURGBP_OTC',
  'EUR/GBP OTC':  'EURGBP_OTC',

  // Non-OTC → skip
  'EURUSD': null, 'GBPUSD': null, 'XAUUSD': null,
};

function normalizeSym(raw) {
  if (!raw) return null;
  if (SYM_MAP[raw] !== undefined) return SYM_MAP[raw];
  const up = raw.toUpperCase().replace(/[#\s/]/g, '');
  for (const [k, v] of Object.entries(SYM_MAP)) {
    if (k.toUpperCase().replace(/[#\s/]/g, '') === up) return v;
  }
  // Auto-detect: anything ending with OTC and >= 6 chars before OTC
  if (/_OTC$/i.test(raw)) {
    return raw.toUpperCase().replace(/[-\s/]/g, '_');
  }
  return null;
}

/* ── WebSocket spy (injected before any page code runs) ───────────────────── */
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

/* ── OTCScraper ───────────────────────────────────────────────────────────── */
class OTCScraper {
  /**
   * @param {object} opts
   * @param {string}   opts.chartUrl   Trading page URL (admin-supplied per broker)
   * @param {string}   opts.brokerName Human-readable broker name
   * @param {function} opts.onTick     Called with (brokerName, sym, price, tsSeconds)
   */
  constructor({ chartUrl, brokerName, onTick }) {
    this._chartUrl   = chartUrl;
    this._brokerName = brokerName;
    this._onTick     = onTick;
    this._browser    = null;
    this._page       = null;
    this._ready      = false;
    this._destroyed  = false;
    this._restartTimer   = null;
    this._heartbeatTimer = null;
    this._tickCount  = 0;
    this._lastTickAt = null;
  }

  async start() {
    if (this._destroyed) return;
    const email    = process.env.PO_EMAIL;
    const password = process.env.PO_PASSWORD;
    if (!email || !password) {
      console.warn(`[OTC:${this._brokerName}] PO_EMAIL / PO_PASSWORD not set — scraper disabled.`);
      return;
    }
    try {
      let puppeteer;
      try { puppeteer = require('puppeteer'); }
      catch (e) {
        this._lastError = 'puppeteer not installed: ' + e.message;
        console.error('[OTC] puppeteer not installed — run: npm install puppeteer');
        return;
      }
      console.log(`[OTC:${this._brokerName}] Launching browser for ${this._chartUrl}`);
      this._browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote',
          '--disable-gpu', '--disable-extensions', '--disable-background-networking',
          '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows',
          '--disable-breakpad', '--disable-sync', '--metrics-recording-only',
        ],
      });
      this._page = await this._browser.newPage();
      await this._page.setViewport({ width: 1280, height: 720 });
      await this._page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      );
      await this._page.evaluateOnNewDocument(WS_SPY_SCRIPT);
      await this._page.exposeFunction('__otcSpy', (data) => this._parseMsg(data));
      this._browser.on('disconnected', () => {
        if (!this._destroyed) {
          console.warn(`[OTC:${this._brokerName}] Browser disconnected — restarting in 30s`);
          this._scheduleRestart(30000);
        }
      });
      await this._navigateToTrading(email, password);
    } catch (err) {
      this._lastError = err.message;
      console.error(`[OTC:${this._brokerName}] Start error:`, err.message);
      if (!this._destroyed) this._scheduleRestart(30000);
    }
  }

  destroy() {
    this._destroyed = true;
    clearTimeout(this._restartTimer);
    clearInterval(this._heartbeatTimer);
    if (this._browser) this._browser.close().catch(() => {});
  }

  /* ── Private ─────────────────────────────────────────────────────────────── */

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

  async _navigateToTrading(email, password) {
    const page = this._page;
    try {
      console.log(`[OTC:${this._brokerName}] Navigating to ${this._chartUrl}`);
      // Use 'load' — trading pages have persistent WS connections so 'networkidle2' never fires
      await page.goto(this._chartUrl, { waitUntil: 'load', timeout: 60000 });

      let currentUrl = page.url();
      console.log(`[OTC:${this._brokerName}] Landed at: ${currentUrl}`);

      // If redirected to a login/auth page, auto-login
      const isLoginPage = /\/(login|sign[-_]?in|auth|signin)\b/i.test(currentUrl);
      if (isLoginPage) {
        console.log(`[OTC:${this._brokerName}] Login page detected — filling credentials`);

        // Wait for any email/username field
        await page.waitForSelector(
          'input[type="email"], input[name="email"], input[name="username"], input[type="text"]',
          { timeout: 20000 }
        ).catch(() => {});

        // Fill email
        const emailSel = 'input[type="email"], input[name="email"], input[name="username"]';
        try {
          await page.focus(emailSel);
          await page.keyboard.type(email, { delay: 60 });
        } catch (_) {
          try {
            await page.focus('input[type="text"]');
            await page.keyboard.type(email, { delay: 60 });
          } catch (_2) {}
        }

        // Fill password
        try {
          await page.focus('input[type="password"]');
          await page.keyboard.type(password, { delay: 60 });
        } catch (_) {}

        // Submit
        try {
          await page.click('button[type="submit"], input[type="submit"], form button, .btn-login, .auth-button');
        } catch (_) {}

        await page.waitForNavigation({ waitUntil: 'load', timeout: 40000 }).catch(() => {});
        currentUrl = page.url();
        console.log(`[OTC:${this._brokerName}] Post-login URL: ${currentUrl}`);

        const stillOnLogin = /\/(login|sign[-_]?in|auth|signin)\b/i.test(currentUrl);
        if (stillOnLogin) {
          console.error(`[OTC:${this._brokerName}] Login failed — retrying in 2 min`);
          this._scheduleRestart(120000);
          return;
        }

        // Navigate to the actual chart URL after login
        if (currentUrl !== this._chartUrl) {
          await page.goto(this._chartUrl, { waitUntil: 'load', timeout: 60000 });
        }
      }

      console.log(`[OTC:${this._brokerName}] Trading page ready — WS spy active`);
      this._ready = true;

      // Heartbeat: ping page every 5 min
      this._heartbeatTimer = setInterval(async () => {
        if (this._destroyed || !this._page) return;
        try {
          const alive = await this._page.evaluate(() => !!document.body);
          if (!alive) throw new Error('page dead');
          console.log(`[OTC:${this._brokerName}] heartbeat ok`);
        } catch (e) {
          console.warn(`[OTC:${this._brokerName}] heartbeat failed — restarting:`, e.message);
          clearInterval(this._heartbeatTimer);
          this._scheduleRestart(5000);
        }
      }, 5 * 60 * 1000);

    } catch (err) {
      this._lastError = 'nav: ' + err.message;
      console.error(`[OTC:${this._brokerName}] Navigation error:`, err.message);
      if (!this._destroyed) this._scheduleRestart(60000);
    }
  }

  _parseMsg(raw) {
    if (!raw || !this._ready) return;
    // Log first 30 raw messages to diagnose WS format
    if ((this._tickCount || 0) < 2 && (this._rawLogCount = (this._rawLogCount || 0) + 1) <= 30) {
      console.log(`[OTC:${this._brokerName}] raw[${this._rawLogCount}]:`, raw.slice(0, 300));
    }
    let payload = raw;
    const sioMatch = raw.match(/^4[0-9][-]?(\[.*)$/s);
    if (sioMatch) payload = sioMatch[1];
    let parsed;
    try { parsed = JSON.parse(payload); } catch (_) { return; }

    if (Array.isArray(parsed)) {
      const [action, data] = parsed;
      if (typeof action === 'string' && data && typeof data === 'object') {
        const actions = ['updateStream', 'price', 'tick', 'quotation', 'stream', 'data', 'asset', 'candle'];
        if (actions.includes(action)) { this._tryEmit(data); return; }
      }
      if (Array.isArray(parsed[0])) { for (const item of parsed) this._tryEmit(item); return; }
    }

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      if (parsed.message) { this._tryEmit(parsed.message); return; }
      this._tryEmit(parsed);
    }
  }

  _tryEmit(data) {
    if (!data || typeof data !== 'object') return;
    const asset =
      data.asset  || data.symbol || data.pair  || data.name   ||
      data.code   || data.ticker || data.s      || data.a      ||
      data.active || data.id;
    const rawPrice =
      data.price  || data.close  || data.value  || data.rate   ||
      data.last   || data.lp     || data.c       || data.p      ||
      data.v      || data.current_price;
    if (!asset || rawPrice == null) return;
    const sym   = normalizeSym(String(asset));
    const price = parseFloat(rawPrice);
    if (!sym || isNaN(price) || price <= 0) return;
    const ts = typeof data.time === 'number'      ? data.time
             : typeof data.timestamp === 'number' ? data.timestamp
             : typeof data.t === 'number'         ? data.t
             : Math.floor(Date.now() / 1000);
    const tsSeconds = ts > 1e12 ? Math.floor(ts / 1000) : Math.floor(ts);
    this._tickCount++;
    this._lastTickAt = new Date().toISOString();
    this._onTick(this._brokerName, sym, price, tsSeconds);
  }
}

module.exports = { OTCScraper };
