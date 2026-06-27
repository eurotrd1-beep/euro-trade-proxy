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
    this._status     = 'idle';
  }

  async start() {
    if (this._destroyed) return;
    const email    = process.env.PO_EMAIL;
    const password = process.env.PO_PASSWORD;
    if (!email || !password) {
      this._lastError = 'PO_EMAIL / PO_PASSWORD not set in environment';
      console.warn(`[OTC:${this._brokerName}] ${this._lastError}`);
      return;
    }
    try {
      let puppeteer;
      try {
        puppeteer = require('puppeteer-extra');
        const stealth = require('puppeteer-extra-plugin-stealth');
        puppeteer.use(stealth());
      } catch (_) {
        try { puppeteer = require('puppeteer'); }
        catch (e) {
          this._lastError = 'puppeteer not installed: ' + e.message;
          console.error('[OTC] puppeteer not installed');
          return;
        }
      }
      this._status = 'launching browser';
      console.log(`[OTC:${this._brokerName}] Launching browser for ${this._chartUrl}`);

      // Find whatever Chrome version was installed by puppeteer browsers install
      let executablePath;
      try {
        const { execSync } = require('child_process');
        const result = execSync(
          'find /opt/render/.cache/puppeteer/chrome -name "chrome" -type f 2>/dev/null | head -1'
        ).toString().trim();
        if (result) { executablePath = result; console.log('[OTC] Chrome found at:', result); }
      } catch (_) {}
      // Also try system Chrome paths
      if (!executablePath) {
        const sysPaths = [
          '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium',
          '/usr/local/bin/chromium',
        ];
        const fs2 = require('fs');
        executablePath = sysPaths.find(p => { try { return fs2.existsSync(p); } catch(_){return false;} });
      }
      if (executablePath) console.log('[OTC] Using Chrome:', executablePath);
      else console.warn('[OTC] No Chrome found — trying puppeteer default');

      this._browser = await puppeteer.launch({
        headless: true,
        executablePath: executablePath || undefined,
        args: [
          '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote',
          '--disable-gpu', '--disable-extensions', '--disable-background-networking',
          '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows',
          '--disable-breakpad', '--disable-sync', '--metrics-recording-only',
          // Memory savings for 512MB Render free tier
          '--disable-software-rasterizer', '--disable-default-apps',
          '--disable-translate', '--disable-plugins', '--disable-hang-monitor',
          '--renderer-process-limit=1', '--js-flags=--max-old-space-size=128',
        ],
      });
      this._page = await this._browser.newPage();
      // Block heavy resources to reduce memory on Render 512MB
      await this._page.setRequestInterception(true);
      this._page.on('request', req => {
        const blocked = ['image', 'media', 'font', 'stylesheet', 'other'];
        if (blocked.includes(req.resourceType())) req.abort();
        else req.continue();
      });
      await this._page.setViewport({ width: 1280, height: 720 });
      await this._page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      );
      await this._page.evaluateOnNewDocument(WS_SPY_SCRIPT);
      await this._page.exposeFunction('__otcSpy', (data) => this._parseMsg(data));
      this._browser.on('disconnected', () => {
        if (!this._destroyed) {
          this._lastError = 'Browser disconnected (OOM crash?)';
          console.warn(`[OTC:${this._brokerName}] ${this._lastError} — restarting in 30s`);
          this._scheduleRestart(30000);
        }
      });
      // Load session cookies: env var (persistent) → file (runtime-only)
      let sessionCookies = null;
      try {
        if (process.env.PO_COOKIES) {
          sessionCookies = JSON.parse(Buffer.from(process.env.PO_COOKIES, 'base64').toString());
          console.log(`[OTC:${this._brokerName}] Loaded ${sessionCookies.length} cookies from PO_COOKIES env`);
        } else {
          const fs2 = require('fs');
          const cookiePath = require('path').join(__dirname, 'po_session.json');
          if (fs2.existsSync(cookiePath)) {
            sessionCookies = JSON.parse(fs2.readFileSync(cookiePath, 'utf8'));
            console.log(`[OTC:${this._brokerName}] Loaded ${sessionCookies.length} cookies from po_session.json`);
          }
        }
      } catch (_) {}
      await this._navigateToTrading(email, password, sessionCookies);
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

  async _navigateToTrading(email, password, cookies) {
    const page = this._page;
    try {
      // Inject session cookies if available (bypasses login form + datacenter IP block)
      if (cookies && cookies.length) {
        await page.setCookie(...cookies);
        console.log(`[OTC:${this._brokerName}] Injected ${cookies.length} session cookies`);
      }
      this._status = 'navigating to chart';
      console.log(`[OTC:${this._brokerName}] Navigating to ${this._chartUrl}`);
      // Use 'load' — trading pages have persistent WS connections so 'networkidle2' never fires
      // 'detached' error = redirect happened mid-navigation — safe to ignore, page still loaded
      try {
        await page.goto(this._chartUrl, { waitUntil: 'load', timeout: 60000 });
      } catch (gotoErr) {
        if (!gotoErr.message.toLowerCase().includes('detach')) throw gotoErr;
        console.log(`[OTC:${this._brokerName}] Redirect detected (frame detached) — continuing`);
      }

      // After a frame-detach redirect, page.url() may throw briefly — retry after short wait
      let currentUrl = '';
      try { currentUrl = page.url(); } catch (_) {
        await new Promise(r => setTimeout(r, 2000));
        try { currentUrl = page.url(); } catch (_2) { currentUrl = ''; }
      }
      this._status = 'landed: ' + currentUrl;
      console.log(`[OTC:${this._brokerName}] Landed at: ${currentUrl}`);

      // If redirected to a login/auth page, auto-login
      const isLoginPage = /\/(login|sign[-_]?in|auth|signin)\b/i.test(currentUrl);
      if (isLoginPage) {
        this._status = 'filling login form';
        console.log(`[OTC:${this._brokerName}] Login page detected — filling credentials`);

        // Wait for form inputs to appear
        await page.waitForSelector('input[type="password"]', { timeout: 20000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 1000));

        // Use CDP-level keyboard simulation (isTrusted=true) via elementHandle.type()
        // This is required because PO checks event.isTrusted on React form events
        const emailEl = await page.$('input[type="email"]')
                     || await page.$('input[name="email"]')
                     || await page.$('input[name="login"]')
                     || await page.$('input[type="text"]');
        if (emailEl) {
          await emailEl.click({ clickCount: 3 }).catch(() => {});
          await emailEl.type(email, { delay: 80 });
        }

        const pwdEl = await page.$('input[type="password"]');
        if (pwdEl) {
          await pwdEl.click().catch(() => {});
          await pwdEl.type(password, { delay: 80 });
        }

        await new Promise(r => setTimeout(r, 500));

        // Click submit button, fallback to Enter key
        const submitBtn = await page.$('button[type="submit"]')
                       || await page.$('input[type="submit"]')
                       || await page.$('.btn-login');
        if (submitBtn) {
          await submitBtn.click().catch(() => {});
        } else if (pwdEl) {
          await pwdEl.press('Enter').catch(() => {});
        }

        this._status = 'waiting for post-login navigation';
        await page.waitForNavigation({ waitUntil: 'load', timeout: 40000 }).catch(() => {});
        currentUrl = page.url();
        this._status = 'post-login: ' + currentUrl;
        console.log(`[OTC:${this._brokerName}] Post-login URL: ${currentUrl}`);

        const stillOnLogin = /\/(login|sign[-_]?in|auth|signin)\b/i.test(currentUrl);
        if (stillOnLogin) {
          this._lastError = `Login failed — still on: ${currentUrl}`;
          console.error(`[OTC:${this._brokerName}] ${this._lastError} — retrying in 60s`);
          this._scheduleRestart(60000);
          return;
        }

        // Navigate to the actual chart URL after login
        if (currentUrl !== this._chartUrl) {
          try {
            await page.goto(this._chartUrl, { waitUntil: 'load', timeout: 60000 });
          } catch (gotoErr) {
            if (!gotoErr.message.toLowerCase().includes('detach')) throw gotoErr;
            console.log(`[OTC:${this._brokerName}] Redirect on chart nav (frame detached) — continuing`);
          }
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
