/**
 * Web Push — who gets sent what, and what happens to the ones that fail.
 *
 * The network half is not tested here; `web-push` signs and posts, and that is
 * its job. What is tested is every decision this module makes on top of it,
 * because each one is silent when it goes wrong: a subscriber who receives
 * pairs they deselected has no way to complain except by turning the whole
 * thing off, and a dead endpoint that is never cleaned up costs a failing
 * request every minute for ever with nobody watching.
 */

'use strict';

const assert = require('node:assert');
const test = require('node:test');

const webpush = require('web-push');

// Real keys, generated for this run. `push.js` reads the environment at import
// time, so they have to be in place before the require below.
const keys = webpush.generateVAPIDKeys();
process.env.VAPID_PUBLIC_KEY = keys.publicKey;
process.env.VAPID_PRIVATE_KEY = keys.privateKey;
process.env.VAPID_SUBJECT = 'mailto:test@example.com';

const push = require('../push.js');

/** A database that serves fixed rows and records what was deleted. */
function fakeDb(rows) {
  const deleted = [];
  const upserts = [];
  return {
    deleted,
    upserts,
    from() {
      return {
        select: () => ({ limit: async () => ({ data: rows, error: null }) }),
        delete: () => ({
          in: async (_col, list) => { deleted.push(...list); return { error: null }; },
          eq: async (_col, value) => { deleted.push(value); return { error: null }; },
        }),
        upsert: async (row) => { upserts.push(row); return { error: null }; },
      };
    },
  };
}

const sub = (endpoint, symbols) => ({ endpoint, p256dh: 'p', auth: 'a', symbols });

/** Replaces the network call for one test, and always puts it back. */
async function withSend(impl, fn) {
  const real = webpush.sendNotification;
  webpush.sendNotification = impl;
  try {
    return await fn();
  } finally {
    webpush.sendNotification = real;
  }
}

test('is ready once both halves of the key are present', () => {
  assert.equal(push.isReady(), true);
  assert.equal(push.publicKey(), keys.publicKey);
});

test('sends to a subscriber who asked for every pair', async () => {
  // `null` symbols is the default and means everything — including pairs added
  // to the catalogue after they subscribed.
  const db = fakeDb([sub('https://push.test/all', null)]);
  const seen = [];
  const r = await withSend(
    async (s) => { seen.push(s.endpoint); },
    () => push.broadcast(db, { kind: 'signal', symbol: 'ANYTHING_otc' }),
  );
  assert.deepEqual(seen, ['https://push.test/all']);
  assert.equal(r.sent, 1);
});

test('sends only the pairs a subscriber chose', async () => {
  const db = fakeDb([
    sub('https://push.test/eur', ['EURUSD_otc']),
    sub('https://push.test/gbp', ['GBPUSD_otc']),
  ]);
  const seen = [];
  await withSend(
    async (s) => { seen.push(s.endpoint); },
    () => push.broadcast(db, { kind: 'armed', symbol: 'EURUSD_otc' }),
  );
  assert.deepEqual(seen, ['https://push.test/eur']);
});

test('an empty selection means nothing, not everything', async () => {
  // The distinction the whole filter turns on. A user who deselected every
  // pair must go quiet; folding `[]` into "no filter" would send them the lot.
  const db = fakeDb([sub('https://push.test/none', [])]);
  const seen = [];
  const r = await withSend(
    async (s) => { seen.push(s.endpoint); },
    () => push.broadcast(db, { kind: 'signal', symbol: 'EURUSD_otc' }),
  );
  assert.deepEqual(seen, []);
  assert.equal(r.sent, 0);
});

test('deletes a subscription the push service says is gone', async () => {
  const db = fakeDb([sub('https://push.test/dead', null)]);
  const r = await withSend(
    async () => { const e = new Error('gone'); e.statusCode = 410; throw e; },
    () => push.broadcast(db, { kind: 'signal', symbol: 'EURUSD_otc' }),
  );
  assert.equal(r.removed, 1);
  assert.deepEqual(db.deleted, ['https://push.test/dead']);
});

test('keeps a subscription that failed for a passing reason', async () => {
  // A 500 from the push service is their problem, not a dead browser. Deleting
  // on it would unsubscribe every user during one upstream outage.
  const db = fakeDb([sub('https://push.test/flaky', null)]);
  const r = await withSend(
    async () => { const e = new Error('boom'); e.statusCode = 500; throw e; },
    () => push.broadcast(db, { kind: 'signal', symbol: 'EURUSD_otc' }),
  );
  assert.equal(r.failed, 1);
  assert.equal(r.removed, 0);
  assert.deepEqual(db.deleted, []);
});

test('one dead subscription does not stop the others', async () => {
  const db = fakeDb([
    sub('https://push.test/dead', null),
    sub('https://push.test/live', null),
  ]);
  const r = await withSend(
    async (s) => {
      if (s.endpoint.endsWith('dead')) { const e = new Error('gone'); e.statusCode = 404; throw e; }
    },
    () => push.broadcast(db, { kind: 'signal', symbol: 'EURUSD_otc' }),
  );
  assert.equal(r.sent, 1);
  assert.equal(r.removed, 1);
});

test('stores a subscription with the pairs it chose', async () => {
  const db = fakeDb([]);
  await push.save(
    db,
    { endpoint: 'https://push.test/x', keys: { p256dh: 'p', auth: 'a' } },
    'acct-1',
    'paid',
    ['EURUSD_otc'],
  );
  assert.equal(db.upserts.length, 1);
  assert.deepEqual(db.upserts[0].symbols, ['EURUSD_otc']);
  assert.equal(db.upserts[0].account_id, 'acct-1');
});

test('stores anything that is not a list as "every pair"', async () => {
  // The safe failure for a filter is to deliver. A malformed value must never
  // become an empty list, which would silently mute the user.
  const db = fakeDb([]);
  await push.save(db, { endpoint: 'e', keys: { p256dh: 'p', auth: 'a' } }, null, 'free', 'junk');
  assert.equal(db.upserts[0].symbols, null);
});

test('refuses a subscription with no encryption keys', async () => {
  // Without these the send throws on every candle, for ever, for one row.
  const db = fakeDb([]);
  await assert.rejects(
    () => push.save(db, { endpoint: 'https://push.test/x' }, null, 'free', null),
    /incomplete/,
  );
  assert.equal(db.upserts.length, 0);
});

test('unsubscribing removes the row', async () => {
  const db = fakeDb([]);
  await push.remove(db, 'https://push.test/x');
  assert.deepEqual(db.deleted, ['https://push.test/x']);
});
