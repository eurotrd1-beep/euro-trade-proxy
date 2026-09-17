'use strict';

/**
 * Feeds the Cloudflare price hub — one socket, batched, and silent when nobody
 * is listening.
 *
 * ── WHY THE BATCHING IS HERE AND NOT IN THE HUB ────────────────────────────
 *
 * Measured against the live source: 79.9 frames a second for eighteen pairs,
 * which is 6.9 million messages a day. Cloudflare bills a Durable Object's
 * INCOMING WebSocket messages at 20:1, so feeding it raw would be 345,000
 * requests against a free-plan limit of 100,000 — over by three and a half
 * times before a single user connects.
 *
 * A Durable Object cannot reduce its own incoming count. Only something in
 * front of it can, and this is that something: 500 ms of collapsing turns 80
 * messages a second into two, or 8,640 requests a day — 8.6% of the limit.
 *
 * ── AND WHY IT GOES QUIET ──────────────────────────────────────────────────
 *
 * Duration is charged on a fixed 128 MB whatever the object uses, so an object
 * kept awake around the clock costs 85% of the daily allowance and there is no
 * way to shrink it. The only lever is not keeping it awake: with no incoming
 * events for ten seconds it hibernates, and its clients stay connected through
 * it. So when the hub reports nobody listening this stops sending entirely.
 *
 * That makes the bill a function of real use — twelve active hours is 42%, a
 * quiet night is close to nothing — instead of a function of the clock.
 *
 * ── THE SNAPSHOT, WHICH IS EASY TO GET WRONG ───────────────────────────────
 *
 * Hibernation means the object leaves memory: the prices it was holding are
 * gone when it wakes. The hub hands a joining client whatever it has, and after
 * a quiet spell that is nothing at all — a blank chart until the market happens
 * to move. So the moment the count rises off zero, everything known is sent at
 * once rather than only what has changed since.
 *
 * Disabled unless both PRICE_HUB_URL and PRICE_HUB_SECRET are set. Absent
 * configuration must change nothing: Render's own fan-out stays exactly as it
 * is, and is the way back.
 */

const WebSocketLib = require('ws');

const BATCH_MS = Number(process.env.PRICE_HUB_BATCH_MS || 500);
const RETRY_MIN = 2000;
const RETRY_MAX = 60000;

/**
 * @param {object} opts
 * @param {string} opts.url      wss://…/ingest
 * @param {string} opts.secret   presented as x-ingest-secret
 * @param {(...a: unknown[]) => void} [opts.log]
 * @param {(...a: unknown[]) => void} [opts.err]
 */
function createHubFeed(opts) {
  const log = opts.log || (() => {});
  const err = opts.err || (() => {});
  const batchMs = Number.isFinite(opts.batchMs) ? opts.batchMs : BATCH_MS;

  /** Newest price per symbol since the last send — this is the collapsing. */
  let pending = new Map();
  /** Everything ever seen, for the snapshot a waking hub needs. */
  const known = new Map();
  /** What the hub last told us. Zero means send nothing at all. */
  let clients = 0;
  let ws = null;
  let timer = null;
  let retry = RETRY_MIN;
  let stopped = false;
  let sent = 0;
  let suppressed = 0;

  function flush() {
    // The whole point. No listeners, nothing sent, and after ten seconds of
    // that the object hibernates and stops costing duration.
    if (clients <= 0) { suppressed += pending.size; pending.clear(); return; }
    if (pending.size === 0) return;
    if (!ws || ws.readyState !== WebSocketLib.OPEN) return;
    const body = JSON.stringify({ p: Object.fromEntries(pending) });
    pending.clear();
    try { ws.send(body); sent++; } catch (e) { err('hub send:', e.message); }
  }

  function sendSnapshot() {
    if (!ws || ws.readyState !== WebSocketLib.OPEN || known.size === 0) return;
    try {
      ws.send(JSON.stringify({ p: Object.fromEntries(known) }));
      sent++;
      log(`hub: sent a ${known.size}-symbol snapshot (someone is listening again)`);
    } catch (e) { err('hub snapshot:', e.message); }
  }

  function connect() {
    if (stopped) return;
    ws = new WebSocketLib(opts.url, { headers: { 'x-ingest-secret': opts.secret } });

    ws.on('open', () => {
      retry = RETRY_MIN;
      log('hub: connected');
      // `clients` is unknown until the hub says so. Starting at zero means the
      // first batch waits for that message — which is correct: assuming an
      // audience would wake an object nobody is watching.
      clients = 0;
    });

    ws.on('message', (raw) => {
      let m;
      try { m = JSON.parse(raw.toString()); } catch { return; }
      if (m && m.t === 'clients' && typeof m.n === 'number') {
        const before = clients;
        clients = m.n;
        if (before === 0 && clients > 0) sendSnapshot();
        if (clients === 0) log('hub: nobody listening — going quiet');
      }
    });

    ws.on('close', () => {
      ws = null;
      if (stopped) return;
      setTimeout(connect, retry);
      retry = Math.min(retry * 2, RETRY_MAX);
    });
    ws.on('error', (e) => err('hub socket:', e.message));
  }

  connect();
  timer = setInterval(flush, batchMs);

  return {
    /** Every tick, from the same place Render's own fan-out is fed. */
    offer(symbol, price) {
      if (typeof price !== 'number' || !Number.isFinite(price)) return;
      known.set(symbol, price);
      // Repeats cost nothing: the map keeps one entry per symbol, so eighty
      // ticks a second collapse into one value before anything is sent.
      pending.set(symbol, price);
    },
    /** For /health — whether this is doing anything, and whether it is quiet. */
    stats() {
      return {
        connected: !!ws && ws.readyState === WebSocketLib.OPEN,
        clients,
        batches: sent,
        suppressed,
        symbols: known.size,
      };
    },
    stop() {
      stopped = true;
      if (timer) clearInterval(timer);
      timer = null;
      if (ws) { try { ws.close(); } catch (_) {} ws = null; }
    },
  };
}

module.exports = { createHubFeed };
