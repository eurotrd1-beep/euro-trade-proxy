'use strict';

/**
 * The translation between what the call sites say and what D1 stores.
 *
 * Every case here fails SILENTLY if it is wrong. None of them throw, none of
 * them log, and each one produces a plausible-looking result:
 *
 *   a renamed column          → undefined, which reads as "no value"
 *   an ISO string vs integer  → a range that matches all rows or none
 *   true vs 1                 → "there are no enabled pairs"
 *   an array stored as text   → `.length` is a character count
 *
 * So the tests do not check that the client works. They check the four ways it
 * could appear to work while being wrong.
 */

const { test } = require('node:test');
const assert = require('node:assert');

const { _internals } = require('../hub-client.js');
const { aliasOut, aliasIn, outRow, inRow, chunk, MAX_IN, MAX_ROWS } = _internals;

// ── Renamed columns ─────────────────────────────────────────────────────────

test('a renamed column is translated on the way out', () => {
  assert.strictEqual(aliasOut('candles', 'updated_at'), 'updated_ms');
  assert.strictEqual(aliasOut('telegram_alerts', 'sent_at'), 'sent_ms');
  assert.strictEqual(aliasOut('repair_log', 'at'), 'at_ms');
});

test('and back on the way in', () => {
  assert.strictEqual(aliasIn('candles', 'updated_ms'), 'updated_at');
  assert.strictEqual(aliasIn('repair_log', 'at_ms'), 'at');
});

test('a column with no alias is left exactly as it is', () => {
  assert.strictEqual(aliasOut('candles', 'key'), 'key');
  assert.strictEqual(aliasOut('configs', 'data'), 'data');
  assert.strictEqual(aliasIn('configs', 'data'), 'data');
  // A table nobody declared must not be mangled on the way through.
  assert.strictEqual(aliasOut('unknown_table', 'whatever'), 'whatever');
});

test('the round trip is the identity, which is the only thing keeping them in step', () => {
  for (const table of Object.keys(_internals.ALIASES)) {
    for (const column of Object.keys(_internals.ALIASES[table])) {
      assert.strictEqual(aliasIn(table, aliasOut(table, column)), column, `${table}.${column}`);
    }
  }
});

// ── Times ───────────────────────────────────────────────────────────────────

test('an ISO string becomes an integer for a _ms column', () => {
  const at = '2026-09-17T06:00:00.000Z';
  const row = outRow('candles', { key: 'EURUSD_otc_1m', updated_at: at });
  assert.strictEqual(row.updated_ms, Date.parse(at));
  assert.strictEqual(typeof row.updated_ms, 'number');
});

test('an integer is left alone rather than parsed twice', () => {
  const row = outRow('candles', { updated_at: 1758088800000 });
  assert.strictEqual(row.updated_ms, 1758088800000);
});

test('an unparseable time is passed through, not turned into NaN or zero', () => {
  // 0 is 1970 — a timestamp that reads as decades old rather than as missing.
  const row = outRow('candles', { updated_at: 'not a date' });
  assert.strictEqual(row.updated_ms, 'not a date');
});

test('an integer comes back as the ISO string the call sites have always read', () => {
  const ms = Date.UTC(2026, 8, 17, 6, 0, 0);
  const row = inRow('candles', { key: 'k', updated_ms: ms });
  assert.strictEqual(row.updated_at, new Date(ms).toISOString());
  assert.ok(!('updated_ms' in row), 'the D1 spelling must not survive');
});

// ── Booleans ────────────────────────────────────────────────────────────────

test('true becomes 1 and false becomes 0', () => {
  // `enabled = true` against a column holding 1 matches nothing, successfully.
  assert.strictEqual(outRow('otc_pairs', { enabled: true }).enabled, 1);
  assert.strictEqual(outRow('otc_pairs', { enabled: false }).enabled, 0);
  assert.strictEqual(outRow('otc_pairs', { is_otc: true }).is_otc, 1);
  assert.strictEqual(outRow('captcha_stats', { success: false }).success, 0);
});

// ── JSON ────────────────────────────────────────────────────────────────────

test('a candle array is serialised on the way out', () => {
  const candles = [{ t: 1, o: 1, h: 2, l: 0, c: 1 }];
  const row = outRow('candles', { key: 'k', data: candles });
  assert.strictEqual(typeof row.data, 'string');
  assert.deepStrictEqual(JSON.parse(row.data), candles);
});

test('and parsed back, so `.length` is a candle count and not a character count', () => {
  const candles = [{ c: 1 }, { c: 2 }];
  const row = inRow('candles', { key: 'k', data: JSON.stringify(candles) });
  assert.ok(Array.isArray(row.data));
  assert.strictEqual(row.data.length, 2);
});

test('a string the caller already serialised is not encoded twice', () => {
  const row = outRow('configs', { id: 'x', data: '{"a":1}' });
  assert.strictEqual(row.data, '{"a":1}');
});

test('text that will not parse is left as text rather than nulled', () => {
  // Nulling would empty the row on its next save.
  const row = inRow('configs', { id: 'x', data: 'not json' });
  assert.strictEqual(row.data, 'not json');
});

test('only the declared json columns are touched', () => {
  const row = inRow('push_subscriptions', {
    endpoint: 'https://example.com/x',
    subscription: '{"keys":{"p256dh":"a"}}',
    plan: '{"not":"json-typed"}',
  });
  assert.deepStrictEqual(row.subscription, { keys: { p256dh: 'a' } });
  assert.strictEqual(row.plan, '{"not":"json-typed"}', 'plan is a plain column');
});

test('null and undefined are passed through untouched in both directions', () => {
  const row = outRow('push_subscriptions', { symbols: null, user_id: undefined });
  assert.strictEqual(row.symbols, null);
  assert.strictEqual(row.user_id, undefined);
});

// ── Chunking ────────────────────────────────────────────────────────────────

test('a long IN list is split, never trimmed', () => {
  // Trimming would read some of the keys asked for and look like all of them.
  const keys = Array.from({ length: 205 }, (_, i) => `k${i}`);
  const pieces = chunk(keys, MAX_IN);
  assert.strictEqual(pieces.length, 3);
  assert.deepStrictEqual(pieces.flat(), keys, 'every key survives the split');
  for (const p of pieces) assert.ok(p.length <= MAX_IN);
});

test('a list at or under the cap is one piece', () => {
  assert.strictEqual(chunk(Array.from({ length: MAX_IN }, (_, i) => i), MAX_IN).length, 1);
  assert.strictEqual(chunk([1, 2, 3], MAX_IN).length, 1);
});

test('an empty list produces no requests at all', () => {
  assert.deepStrictEqual(chunk([], MAX_IN), []);
});

test('a catalogue upsert is split into whole rows', () => {
  const rows = Array.from({ length: 600 }, (_, i) => ({ symbol: `S${i}` }));
  const pieces = chunk(rows, MAX_ROWS);
  assert.strictEqual(pieces.flat().length, 600);
  for (const p of pieces) assert.ok(p.length <= MAX_ROWS);
});

// ── The switch ──────────────────────────────────────────────────────────────

test('nothing is routed when the variable is unset', () => {
  delete process.env.DATA_HUB_TABLES;
  assert.strictEqual(_internals.selected().size, 0);
});

test('a named list routes exactly those tables', () => {
  process.env.DATA_HUB_TABLES = 'telegram_alerts, captcha_stats';
  const s = _internals.selected();
  assert.ok(s.has('telegram_alerts'));
  assert.ok(s.has('captcha_stats'));
  assert.ok(!s.has('candles'), 'the expensive one stays put until it is named');
  delete process.env.DATA_HUB_TABLES;
});

test('"all" routes every table the client can translate', () => {
  process.env.DATA_HUB_TABLES = 'all';
  const s = _internals.selected();
  for (const t of ['candles', 'configs', 'otc_pairs', 'push_subscriptions', 'telegram_alerts']) {
    assert.ok(s.has(t), t);
  }
  delete process.env.DATA_HUB_TABLES;
});

test('the unconfigured client is the Supabase client itself, not a copy of it', () => {
  // Identity, not equivalence. A wrapper that is "the same" in the untested
  // path is a second implementation waiting to differ.
  delete process.env.DATA_HUB_TABLES;
  const { withHub } = require('../hub-client.js');
  const db = { from: () => 'supabase-chain' };
  assert.strictEqual(withHub(db), db);
});

test('a null client stays null', () => {
  const { withHub } = require('../hub-client.js');
  assert.strictEqual(withHub(null), null);
});

// ── Loading ─────────────────────────────────────────────────────────────────

/**
 * The scraper must LOAD with a database configured.
 *
 * `withHub` is required immediately above the block that calls it. That is not
 * a style choice: `const` is hoisted into a temporal dead zone, so a require
 * placed after its use throws "Cannot access before initialization" — and that
 * is exactly how the signal generator sat dead for two hours while the proxy
 * kept running and the log carried one line about a failed load.
 *
 * The test that was supposed to cover that bug passed, because without
 * credentials `db` was null and the broken block was never reached. So this one
 * sets credentials first, the same way `pipeline-client.test.js` learned to.
 */
test('po-scraper loads when a database IS configured', () => {
  const saved = {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_KEY,
    autostart: process.env.OTC_AUTOSTART,
    tables: process.env.DATA_HUB_TABLES,
  };
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_KEY = 'test-key-not-real';
  // Stops the scraper opening sockets and timers during the test.
  process.env.OTC_AUTOSTART = '0';
  // And with routing ON, so the wrapper itself is exercised rather than
  // short-circuited by the unset variable.
  process.env.DATA_HUB_TABLES = 'telegram_alerts';

  delete require.cache[require.resolve('../po-scraper.js')];
  try {
    assert.doesNotThrow(
      () => require('../po-scraper.js'),
      /before initialization/,
      'the scraper must load with a database configured',
    );
  } finally {
    delete require.cache[require.resolve('../po-scraper.js')];
    for (const [k, v] of [['SUPABASE_URL', saved.url], ['SUPABASE_SERVICE_KEY', saved.key],
                          ['OTC_AUTOSTART', saved.autostart], ['DATA_HUB_TABLES', saved.tables]]) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});

test('the wrapper routes only the tables it was given', () => {
  const { withHub } = require('../hub-client.js');
  const saved = {
    url: process.env.DATA_HUB_URL,
    secret: process.env.DATA_HUB_SERVICE_SECRET,
    tables: process.env.DATA_HUB_TABLES,
  };
  process.env.DATA_HUB_URL = 'https://hub.example.com';
  process.env.DATA_HUB_SERVICE_SECRET = 'secret';
  process.env.DATA_HUB_TABLES = 'telegram_alerts';

  // Re-required so the module-level HUB/SECRET constants pick the values up.
  delete require.cache[require.resolve('../hub-client.js')];
  const fresh = require('../hub-client.js');

  const supabase = { from: (t) => ({ marker: 'supabase', table: t }) };
  const routed = fresh.withHub(supabase);

  assert.strictEqual(routed.from('candles').marker, 'supabase', 'candles stays put');
  assert.notStrictEqual(routed.from('telegram_alerts').marker, 'supabase', 'the named one moves');

  delete require.cache[require.resolve('../hub-client.js')];
  for (const [k, v] of [['DATA_HUB_URL', saved.url], ['DATA_HUB_SERVICE_SECRET', saved.secret],
                        ['DATA_HUB_TABLES', saved.tables]]) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  void withHub;
});

test('a hub url with no secret routes nothing, rather than failing every call', () => {
  const saved = { url: process.env.DATA_HUB_URL, tables: process.env.DATA_HUB_TABLES };
  process.env.DATA_HUB_URL = 'https://hub.example.com';
  delete process.env.DATA_HUB_SERVICE_SECRET;
  process.env.DATA_HUB_TABLES = 'all';

  delete require.cache[require.resolve('../hub-client.js')];
  const fresh = require('../hub-client.js');
  const supabase = { from: () => ({ marker: 'supabase' }) };
  assert.strictEqual(fresh.withHub(supabase), supabase,
    'half-configured must mean "stay where you are", not "be refused on every call"');

  delete require.cache[require.resolve('../hub-client.js')];
  if (saved.url === undefined) delete process.env.DATA_HUB_URL; else process.env.DATA_HUB_URL = saved.url;
  if (saved.tables === undefined) delete process.env.DATA_HUB_TABLES; else process.env.DATA_HUB_TABLES = saved.tables;
});

/**
 * Everything that is NOT `from` has to survive the wrapper.
 *
 * ── THE BUG THIS EXISTS FOR ────────────────────────────────────────────────
 *
 * The wrapper was `{ ...db, from }`, which looks equivalent and is not. Object
 * spread copies own enumerable properties, and a Supabase client keeps its
 * methods on the prototype — so the wrapper kept the six config strings and
 * dropped `channel`, `rpc`, `auth` and `storage`. The scraper died with
 * "db.channel is not a function" the first time it subscribed to realtime.
 *
 * The test above it passed the whole time, because it only ever asked about
 * `from` — the one method the spread happened to keep. A wrapper has to be
 * tested for what it leaves alone, not only for what it changes.
 */
test('the wrapper keeps every method the Supabase client has', () => {
  const saved = {
    url: process.env.DATA_HUB_URL,
    secret: process.env.DATA_HUB_SERVICE_SECRET,
    tables: process.env.DATA_HUB_TABLES,
  };
  process.env.DATA_HUB_URL = 'https://hub.example.com';
  process.env.DATA_HUB_SERVICE_SECRET = 'secret';
  process.env.DATA_HUB_TABLES = 'candles';

  delete require.cache[require.resolve('../hub-client.js')];
  const fresh = require('../hub-client.js');

  const { createClient } = require('@supabase/supabase-js');
  const real = createClient('https://example.supabase.co', 'test-key-not-real');
  const wrapped = fresh.withHub(real);

  // `channel` is the one that actually broke; the others are on the same
  // prototype and would have gone with it.
  for (const method of ['channel', 'rpc', 'removeChannel', 'getChannels']) {
    assert.strictEqual(typeof wrapped[method], 'function', `${method} must survive`);
  }
  for (const namespace of ['auth', 'storage', 'functions', 'realtime']) {
    assert.ok(wrapped[namespace], `${namespace} must survive`);
  }

  // And it must be callable, not merely present — a method pulled off the
  // prototype with the wrong `this` throws on a private field.
  const channel = wrapped.channel('probe');
  assert.strictEqual(typeof channel.on, 'function');

  // The one thing it does change, still changed.
  assert.strictEqual(wrapped.from('candles').constructor.name, 'Table');
  assert.notStrictEqual(wrapped.from('signals').constructor.name, 'Table');

  delete require.cache[require.resolve('../hub-client.js')];
  for (const [k, v] of [['DATA_HUB_URL', saved.url], ['DATA_HUB_SERVICE_SECRET', saved.secret],
                        ['DATA_HUB_TABLES', saved.tables]]) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
});
