'use strict';

/**
 * The pipeline shim: where the four calls go, and what they hand back.
 *
 * ── WHAT IS ACTUALLY AT RISK HERE ──────────────────────────────────────────
 *
 * Not "does it reach the hub". The risk is that it reaches the hub and returns
 * a slightly different SHAPE, because the four call sites in
 * `signal-generator.js` each read the result differently and none of them
 * would throw on the wrong shape:
 *
 *   record  reads `data[0]` — the RPC returned a one-row table
 *   resolve reads only `error`
 *   refresh reads only `error`
 *   prune   reads `data` as a number and logs it
 *
 * A record call that returned the object instead of an array gives
 * `data[0] === undefined`, and the generator returns early — silently
 * recording nothing while reporting no error at all. That is the failure this
 * file exists for.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const MODULE = require.resolve('../pipeline-client.js');

/** Loads the shim with a given environment, isolated from the last load. */
function load(env) {
  const saved = { url: process.env.DATA_HUB_URL, secret: process.env.DATA_HUB_SERVICE_SECRET };
  if (env.url === undefined) delete process.env.DATA_HUB_URL;
  else process.env.DATA_HUB_URL = env.url;
  if (env.secret === undefined) delete process.env.DATA_HUB_SERVICE_SECRET;
  else process.env.DATA_HUB_SERVICE_SECRET = env.secret;

  delete require.cache[MODULE];
  const mod = require('../pipeline-client.js');

  if (saved.url === undefined) delete process.env.DATA_HUB_URL;
  else process.env.DATA_HUB_URL = saved.url;
  if (saved.secret === undefined) delete process.env.DATA_HUB_SERVICE_SECRET;
  else process.env.DATA_HUB_SERVICE_SECRET = saved.secret;

  return mod;
}

/** A Supabase client that records what it was asked for. */
const fakeDb = (calls) => ({
  rpc: async (name, args) => { calls.push([name, args]); return { data: [{ inserted: 1 }], error: null }; },
});

/** A fetch that answers with one body, and records the requests. */
function fakeFetch(calls, body, status = 200) {
  return async (url, init) => {
    calls.push({ url: String(url), init });
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => JSON.stringify(body),
    };
  };
}

test('with no hub configured it uses Supabase, unchanged', async () => {
  const { createPipeline } = load({});
  const calls = [];
  const p = createPipeline(fakeDb(calls));

  assert.equal(p.target, 'supabase');
  await p.recordSignals([{ symbol: 'EURUSD_otc' }]);
  await p.resolveSignals([{ id: 1 }]);
  await p.refreshDaily('2026-09-01', '2026-09-17');
  await p.pruneSignals(30);

  assert.deepEqual(calls.map((c) => c[0]), [
    'record_signals', 'resolve_signals', 'refresh_signal_daily', 'prune_signals',
  ]);
  // The argument NAMES matter: the RPC is positional by keyword.
  assert.deepEqual(calls[2][1], { p_from: '2026-09-01', p_to: '2026-09-17' });
  assert.deepEqual(calls[3][1], { p_keep_days: 30 });
});

test('half a configuration is not a configuration', async () => {
  // A URL with no secret would reach the hub and be refused on every call,
  // which reads as the pipeline being broken rather than unconfigured.
  assert.equal(load({ url: 'https://hub.example' }).useHub(), false);
  assert.equal(load({ secret: 'x' }).useHub(), false);
  assert.equal(load({ url: 'https://hub.example', secret: 'x' }).useHub(), true);
});

test('record returns an ARRAY, because the caller reads data[0]', async () => {
  const { createPipeline } = load({ url: 'https://hub.example', secret: 's' });
  const calls = [];
  global.fetch = fakeFetch(calls, { inserted: 2, skipped: 0, capped: false, remaining: 5, ids: [] });

  const p = createPipeline(null);
  const { data, error } = await p.recordSignals([{ symbol: 'EURUSD_otc', bar_time: '2026-09-17T00:00:00Z' }]);

  assert.equal(error, null);
  assert.ok(Array.isArray(data), 'must be an array or the generator silently records nothing');
  assert.equal(data[0].inserted, 2);
});

test('record converts bar_time to bar_ms and leaves the rest alone', async () => {
  const { createPipeline } = load({ url: 'https://hub.example', secret: 's' });
  const calls = [];
  global.fetch = fakeFetch(calls, { inserted: 1, ids: [] });

  await createPipeline(null).recordSignals([{
    symbol: 'EURUSD_otc', timeframe: '1m', direction: 'CALL',
    bar_time: '2026-09-17T00:16:00.000Z', entry_price: 1.2, expiry_seconds: 60,
  }]);

  const sent = JSON.parse(calls[0].init.body).rows[0];
  assert.equal(sent.bar_ms, Date.parse('2026-09-17T00:16:00.000Z'));
  assert.equal(sent.bar_time, undefined, 'the Postgres column name must not be sent');
  // Everything else is the generator's row, untouched — that is signal data.
  assert.equal(sent.symbol, 'EURUSD_otc');
  assert.equal(sent.entry_price, 1.2);
  assert.equal(sent.expiry_seconds, 60);
});

test('record accepts a bar_time that is already milliseconds', async () => {
  const { createPipeline } = load({ url: 'https://hub.example', secret: 's' });
  const calls = [];
  global.fetch = fakeFetch(calls, { inserted: 1, ids: [] });
  await createPipeline(null).recordSignals([{ symbol: 'X', bar_time: 1789600000000 }]);
  assert.equal(JSON.parse(calls[0].init.body).rows[0].bar_ms, 1789600000000);
});

test('resolve, refresh and prune unwrap to the scalars the callers expect', async () => {
  const { createPipeline } = load({ url: 'https://hub.example', secret: 's' });
  const p = createPipeline(null);

  global.fetch = fakeFetch([], { settled: 7 });
  assert.equal((await p.resolveSignals([{ id: 1 }])).data, 7);

  global.fetch = fakeFetch([], { changed: 3 });
  assert.equal((await p.refreshDaily('2026-09-01', '2026-09-17')).data, 3);

  global.fetch = fakeFetch([], { deleted: 91, cut: '2026-08-18' });
  // The generator logs this number, so it has to be the count and not the body.
  assert.equal((await p.pruneSignals(30)).data, 91);
});

test('an HTTP error comes back as { error }, never thrown', async () => {
  // The callers branch on `error` and do their own logging and counters. A
  // thrown error skips all of it.
  const { createPipeline } = load({ url: 'https://hub.example', secret: 's' });
  global.fetch = fakeFetch([], { error: 'service only' }, 403);

  const { data, error } = await createPipeline(null).resolveSignals([{ id: 1 }]);
  assert.equal(data, null);
  assert.match(error.message, /403/);
  assert.match(error.message, /service only/);
});

test('a network failure comes back the same way', async () => {
  const { createPipeline } = load({ url: 'https://hub.example', secret: 's' });
  global.fetch = async () => { throw new Error('getaddrinfo ENOTFOUND'); };

  const { data, error } = await createPipeline(null).refreshDaily('2026-09-01', '2026-09-17');
  assert.equal(data, null);
  assert.match(error.message, /ENOTFOUND/);
});

test('a non-JSON body is an error, not a silent null', async () => {
  const { createPipeline } = load({ url: 'https://hub.example', secret: 's' });
  global.fetch = async () => ({ ok: true, status: 200, text: async () => '<html>502</html>' });

  const { error } = await createPipeline(null).pruneSignals(30);
  assert.match(error.message, /non-JSON/);
});

test('the secret is sent, and only to the hub', async () => {
  const { createPipeline } = load({ url: 'https://hub.example', secret: 'sekrit' });
  const calls = [];
  global.fetch = fakeFetch(calls, { settled: 0 });

  await createPipeline(null).resolveSignals([]);
  assert.equal(calls[0].init.headers['x-service-secret'], 'sekrit');
  assert.ok(calls[0].url.startsWith('https://hub.example/v1/pipeline/'));
});
