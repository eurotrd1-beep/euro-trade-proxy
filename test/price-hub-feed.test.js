/**
 * The feeder: batched, and silent when nobody is listening.
 *
 * Both halves are load-bearing and both fail quietly.
 *
 * Batching is what keeps the hub inside the free request limit — the source
 * sends 79.9 frames a second, 6.9 million a day, and Cloudflare bills a Durable
 * Object's incoming messages at 20:1. Unbatched that is 345,000 requests
 * against a limit of 100,000. A batcher that stopped collapsing would not throw;
 * the service would simply stop at some point on the following day.
 *
 * Silence is what keeps it inside the free DURATION limit. An object kept awake
 * around the clock costs 85% of the daily allowance and there is no way to
 * shrink that — the only lever is not keeping it awake. A feeder that kept
 * sending into an empty room would not throw either. It would just quietly cost
 * the entire budget.
 *
 * A real WebSocket is faked so both can be driven without an edge.
 */
const assert = require('node:assert');
const test = require('node:test');
const Module = require('node:module');

// ── a fake `ws` that records what would have gone out ─────────────────────
const sockets = [];
class FakeWS {
  static OPEN = 1;
  constructor(url, opts) {
    this.url = url; this.opts = opts; this.readyState = 1;
    this.sent = []; this.handlers = {};
    sockets.push(this);
  }
  on(ev, fn) { (this.handlers[ev] ||= []).push(fn); return this; }
  emit(ev, ...a) { for (const fn of this.handlers[ev] || []) fn(...a); }
  send(s) { this.sent.push(JSON.parse(s)); }
  close() { this.readyState = 3; this.emit('close'); }
}
const realLoad = Module._load;
Module._load = function (req, ...rest) {
  if (req === 'ws') return FakeWS;
  return realLoad.call(this, req, ...rest);
};
const { createHubFeed } = require('../price-hub-feed.js');
Module._load = realLoad;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** A feeder with a fast batch window, already "connected". */
function harness(batchMs = 30) {
  sockets.length = 0;
  const feed = createHubFeed({ url: 'wss://hub.test/ingest', secret: 's', batchMs });
  const ws = sockets[0];
  ws.emit('open');
  return { feed, ws, listeners: (n) => ws.emit('message', Buffer.from(JSON.stringify({ t: 'clients', n }))) };
}

test('presents the secret as a header, never in the url', async () => {
  const { feed, ws } = harness();
  assert.equal(ws.opts.headers['x-ingest-secret'], 's');
  assert.ok(!ws.url.includes('s='), 'a secret in a URL ends up in logs');
  feed.stop();
});

test('sends NOTHING while nobody is listening', async () => {
  // The whole duration argument. No events for ten seconds and the object
  // hibernates; a feeder that pushed anyway would keep it awake for ever.
  const { feed, ws } = harness();
  feed.offer('EURUSD', 1.15);
  feed.offer('USDJPY', 155);
  await wait(80);
  assert.deepEqual(ws.sent, []);
  feed.stop();
});

test('starts silent even before the hub has said anything', async () => {
  // Assuming an audience would wake an object nobody is watching.
  const { feed, ws } = harness();
  feed.offer('A', 1);
  await wait(80);
  assert.equal(ws.sent.length, 0);
  feed.stop();
});

test('sends once a listener appears', async () => {
  const { feed, ws, listeners } = harness();
  listeners(1);
  feed.offer('A', 1);
  await wait(80);
  assert.ok(ws.sent.length >= 1);
  feed.stop();
});

test('collapses repeats into one value per symbol', async () => {
  // Eighty ticks a second must leave as one. This is the ratio that decides
  // whether the design fits in the free plan at all.
  const { feed, ws, listeners } = harness(50);
  listeners(1);
  ws.sent.length = 0;
  for (let i = 0; i < 200; i++) feed.offer('A', 1 + i / 10000);
  await wait(120);
  const batches = ws.sent.filter((m) => m.p && m.p.A !== undefined);
  assert.ok(batches.length <= 3, `200 ticks became ${batches.length} batches`);
  assert.equal(batches[0].p.A, 1 + 199 / 10000, 'the newest value, not the first');
  feed.stop();
});

test('carries every symbol in one batch', async () => {
  const { feed, ws, listeners } = harness(40);
  listeners(1);
  ws.sent.length = 0;
  feed.offer('A', 1); feed.offer('B', 2); feed.offer('C', 3);
  await wait(100);
  const batch = ws.sent.find((m) => m.p && m.p.A !== undefined);
  assert.deepEqual(batch.p, { A: 1, B: 2, C: 3 });
  feed.stop();
});

test('sends a FULL snapshot the moment the room fills again', async () => {
  // Hibernation empties the object's memory. A client joining after a quiet
  // spell would otherwise get whatever changed since — which after a quiet
  // spell is nothing, and the chart stays blank until the market moves.
  const { feed, ws, listeners } = harness(30);
  listeners(1);
  feed.offer('A', 1); feed.offer('B', 2);
  await wait(70);

  listeners(0);
  feed.offer('A', 1.5);          // moved while nobody was watching
  await wait(70);
  ws.sent.length = 0;

  listeners(1);
  await wait(10);
  assert.deepEqual(ws.sent[0].p, { A: 1.5, B: 2 }, 'everything known, not just the delta');
  feed.stop();
});

test('drops what piled up while the room was empty', async () => {
  // Those prices are stale by the time anyone returns, and the snapshot above
  // replaces them anyway.
  const { feed, ws, listeners } = harness(30);
  listeners(0);
  for (let i = 0; i < 50; i++) feed.offer('A', i);
  await wait(70);
  assert.equal(ws.sent.length, 0);
  assert.ok(feed.stats().suppressed > 0);
  feed.stop();
});

test('ignores a non-finite price', async () => {
  const { feed, ws, listeners } = harness(30);
  listeners(1);
  ws.sent.length = 0;
  feed.offer('A', NaN); feed.offer('B', null); feed.offer('C', 1.5);
  await wait(70);
  const batch = ws.sent.find((m) => m.p);
  assert.deepEqual(batch.p, { C: 1.5 });
  feed.stop();
});

test('says nothing when nothing was offered', async () => {
  const { feed, ws, listeners } = harness(30);
  listeners(1);
  ws.sent.length = 0;
  await wait(100);
  assert.equal(ws.sent.length, 0, 'an empty batch is a request nobody needed');
  feed.stop();
});

test('reconnects after a drop, and starts silent again', async () => {
  const { feed, ws, listeners } = harness(30);
  listeners(1);
  ws.close();
  await wait(2100);
  const fresh = sockets[sockets.length - 1];
  assert.notEqual(fresh, ws, 'a new socket was opened');
  fresh.emit('open');
  feed.offer('A', 1);
  await wait(70);
  assert.equal(fresh.sent.length, 0, 'the listener count is unknown again after a reconnect');
  feed.stop();
});

test('stop() ends the batching', async () => {
  const { feed, ws, listeners } = harness(20);
  listeners(1);
  feed.stop();
  ws.sent.length = 0;
  feed.offer('A', 1);
  await wait(80);
  assert.equal(ws.sent.length, 0);
});

test('stats report what /health needs to show', async () => {
  const { feed, listeners } = harness(20);
  listeners(3);
  feed.offer('A', 1);
  await wait(60);
  const s = feed.stats();
  assert.equal(s.clients, 3);
  assert.equal(s.symbols, 1);
  assert.ok(s.batches >= 1);
  feed.stop();
});
