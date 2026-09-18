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

// ── The client ──────────────────────────────────────────────────────────────

test('it is the client, with no second destination to choose', () => {
  const saved = { url: process.env.DATA_HUB_URL, secret: process.env.DATA_HUB_SERVICE_SECRET };
  process.env.DATA_HUB_URL = 'https://hub.example.com';
  process.env.DATA_HUB_SERVICE_SECRET = 'secret';
  delete require.cache[require.resolve('../hub-client.js')];
  const fresh = require('../hub-client.js');

  const db = fresh.createDb();
  assert.ok(db, 'a configured client');
  assert.strictEqual(db.from('candles').constructor.name, 'Table');
  assert.strictEqual(db.from('configs').constructor.name, 'Table');

  delete require.cache[require.resolve('../hub-client.js')];
  for (const [k, v] of [['DATA_HUB_URL', saved.url], ['DATA_HUB_SERVICE_SECRET', saved.secret]]) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
});

test('a table with no route throws instead of going somewhere by default', () => {
  // The version of this that fell back to Postgres is exactly how `push_alerts`
  // wrote the wrong database for a day without anyone noticing.
  const saved = { url: process.env.DATA_HUB_URL, secret: process.env.DATA_HUB_SERVICE_SECRET };
  process.env.DATA_HUB_URL = 'https://hub.example.com';
  process.env.DATA_HUB_SERVICE_SECRET = 'secret';
  delete require.cache[require.resolve('../hub-client.js')];
  const db = require('../hub-client.js').createDb();

  assert.throws(() => db.from('some_table_nobody_declared'), /no route for table/);

  delete require.cache[require.resolve('../hub-client.js')];
  for (const [k, v] of [['DATA_HUB_URL', saved.url], ['DATA_HUB_SERVICE_SECRET', saved.secret]]) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
});

test('without a hub it is null, which every call site already checks for', () => {
  // `if (!db) return` appears throughout and used to mean "no Supabase". It
  // means "no hub" now and guards the same behaviour: the scraper runs, prices
  // flow, nothing is persisted.
  const saved = { url: process.env.DATA_HUB_URL, secret: process.env.DATA_HUB_SERVICE_SECRET };
  delete process.env.DATA_HUB_URL;
  delete process.env.DATA_HUB_SERVICE_SECRET;
  delete require.cache[require.resolve('../hub-client.js')];
  assert.strictEqual(require('../hub-client.js').createDb(), null);

  delete require.cache[require.resolve('../hub-client.js')];
  for (const [k, v] of [['DATA_HUB_URL', saved.url], ['DATA_HUB_SERVICE_SECRET', saved.secret]]) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
});

test('no file in the proxy builds a Supabase client any more', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const dir = path.join(__dirname, '..');
  const offenders = [];
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
    const code = fs.readFileSync(path.join(dir, file), 'utf8')
      .split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');
    if (/createClient\s*\(|@supabase\/supabase-js/.test(code)) offenders.push(file);
  }
  // `get-po-ssid.js` and `run-otc.js` are run by hand on a laptop, not by the
  // service, and are allowed to mention whatever they like.
  assert.deepStrictEqual(offenders.filter((f) => !['get-po-ssid.js', 'run-otc.js'].includes(f)), []);
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





/**
 * Every table this repository reads or writes must be routable.
 *
 * `push_alerts` was not, and the reason it was missed is worth keeping: the
 * list used to be derived from the alias table, so a table only got routed if
 * it happened to have a RENAMED column. `push_alerts` is spelled identically in
 * both databases, so it needed no translation — and needing no translation is
 * the weakest possible reason to keep writing the wrong database.
 */
test('every table the proxy touches is in KNOWN', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const dir = path.join(__dirname, '..');

  process.env.DATA_HUB_TABLES = 'all';
  delete require.cache[require.resolve('../hub-client.js')];
  const known = require('../hub-client.js')._internals.selected();
  delete process.env.DATA_HUB_TABLES;

  const used = new Set();
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
    if (file === 'hub-client.js') continue;
    const src = fs.readFileSync(path.join(dir, file), 'utf8');
    for (const m of src.matchAll(/\.from\('([a-z_]+)'\)/g)) used.add(m[1]);
  }

  const missing = [...used].filter((t) => !known.has(t)).sort();
  assert.deepStrictEqual(missing, [],
    `these tables would still write Postgres: ${missing.join(', ')}`);
});

/**
 * The demo capture must not be gated behind credentials.
 *
 * `recaptureToken` tries the demo first and the demo needs no email, no
 * password, no captcha and no emailed PIN — the file's own comment says so, and
 * says the PIN is exactly why the credential path can no longer finish on this
 * account. Both callers of `_repair()` used to require PO_EMAIL and
 * PO_PASSWORD, so the one path that works without them could never run: a box
 * with no token and no login printed "run get-po-ssid.js locally" while the
 * thing that would have fixed it was one call away.
 *
 * Asserted against the source because the alternative is booting a scraper and
 * a headless Chromium inside a unit test.
 */
test('recapture is reachable without PO credentials', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'po-scraper.js'), 'utf8');

  const callers = [...src.matchAll(/^.*this\._repair\(\).*$/gm)].map((m) => m[0]);
  assert.ok(callers.length >= 2, 'expected the repair to be called from more than one place');

  const gated = callers.filter((line) => /PO_EMAIL|PO_PASSWORD/.test(line));
  assert.deepStrictEqual(gated, [],
    'these call sites still require credentials, so the demo capture cannot run:\n' + gated.join('\n'));

  // And the demo really is attempted before the credential path inside it.
  const demoAt = src.indexOf('_captureDemo()');
  const credAt = src.indexOf("warn('auto-recapture needs PO_EMAIL/PO_PASSWORD')");
  assert.ok(demoAt > 0 && credAt > 0 && demoAt < credAt,
    'the demo capture must be tried before the credential fallback');
});
