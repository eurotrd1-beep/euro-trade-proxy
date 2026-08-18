/**
 * Web Push — the notifications that arrive with the browser closed.
 *
 * ── WHY THIS LIVES IN THE PROXY ────────────────────────────────────────────
 *
 * Because the browser is not running. Everything the app does today needs a
 * tab open: the watch loop, the Notification API, the whole engine. A user who
 * closes the tab gets nothing, and "tell me when a setup forms" is precisely a
 * request to be told while not looking.
 *
 * This process already evaluates the same strategy on every pair every minute,
 * 24/7, with the same engine bundle the app runs. It is the only thing in the
 * system that knows a setup armed at 3am. So it sends.
 *
 * ── THE KEYS ───────────────────────────────────────────────────────────────
 *
 * VAPID is a keypair that identifies the sender to the push service. The
 * PUBLIC half goes to the browser — it is meant to be public and is baked into
 * the app. The PRIVATE half signs every send and must never leave the server,
 * so it comes from `VAPID_PRIVATE_KEY` in the environment and appears in no
 * file, no bundle and no log.
 *
 * With no keys set, this module does nothing and says so once. It never
 * generates a pair at runtime: a keypair that changes on restart invalidates
 * every subscription already stored, and every user would silently stop
 * receiving notifications with nothing to point at. Generating them is a
 * deliberate one-time act — `node generate-vapid.js` prints a pair to paste
 * into the environment.
 */

'use strict';

let webpush = null;
try {
  webpush = require('web-push');
} catch (e) {
  console.error('[push] web-push غير متاح:', e.message);
}

const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@eurotrade.app';

let ready = false;
if (webpush && PUBLIC_KEY && PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
    ready = true;
  } catch (e) {
    console.error('[push] مفاتيح VAPID مرفوضة:', e.message);
  }
}

if (!ready) {
  console.log(
    '[push] متوقّف — محتاج VAPID_PUBLIC_KEY و VAPID_PRIVATE_KEY في البيئة.\n' +
      '[push] شغّل `node generate-vapid.js` مرة واحدة وحطّ الناتج في Render.',
  );
}

/** Whether sending is possible at all. Read by the endpoints before accepting. */
function isReady() {
  return ready;
}

/** The half the browser needs. Public by design — it is in the app bundle too. */
function publicKey() {
  return PUBLIC_KEY;
}

/**
 * Sends one payload to every stored subscription.
 *
 * Dead subscriptions are deleted rather than retried. A 404 or 410 from a push
 * service is final — the browser is gone, the user cleared their data, or the
 * subscription was replaced — and keeping it would mean paying for a failing
 * request every minute for ever.
 *
 * Returns what happened, because a notification nobody received should not
 * look the same in the logs as one that went out.
 */
async function broadcast(db, payload) {
  if (!ready || !db) return { sent: 0, removed: 0, failed: 0 };

  const { data, error } = await db
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, symbols')
    .limit(5000);
  if (error) {
    console.error('[push] تعذّرت قراءة الاشتراكات:', error.message);
    return { sent: 0, removed: 0, failed: 0 };
  }

  const body = JSON.stringify(payload);
  const dead = [];
  let sent = 0;
  let failed = 0;

  /**
   * Whether this subscriber asked about this pair.
   *
   * `null` means every pair — the default, and not the same as an empty list,
   * which means the user deselected everything and should get nothing. Both
   * are reachable from the picker, so the two are kept apart: folding an empty
   * list into "everything" would send notifications to somebody who had just
   * turned them all off.
   */
  const wants = (row) =>
    row.symbols === null || row.symbols === undefined
      ? true
      : Array.isArray(row.symbols) && row.symbols.includes(payload.symbol);

  // Sent in parallel: a few thousand subscriptions one after another would not
  // finish inside the minute before the next candle closes.
  await Promise.all(
    (data || []).filter(wants).map(async (row) => {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          body,
          { TTL: 120 }, // Two minutes. A trade this is about is over by then.
        );
        sent++;
      } catch (e) {
        if (e && (e.statusCode === 404 || e.statusCode === 410)) dead.push(row.endpoint);
        else failed++;
      }
    }),
  );

  if (dead.length > 0) {
    await db.from('push_subscriptions').delete().in('endpoint', dead);
  }
  return { sent, removed: dead.length, failed };
}

/** Stores or refreshes one subscription. Called by the API on the app's behalf. */
async function save(db, sub, accountId, plan, symbols) {
  if (!db) throw new Error('no database');
  if (!sub || !sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
    throw new Error('subscription incomplete');
  }
  const { error } = await db.from('push_subscriptions').upsert(
    {
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      account_id: accountId || null,
      plan: plan || null,
      // Only a real array is stored. Anything else — absent, a string, junk —
      // becomes NULL, which is "every pair", because the safe failure for a
      // filter is to deliver rather than to go silently quiet.
      symbols: Array.isArray(symbols) ? symbols : null,
      last_seen_at: new Date().toISOString(),
      failures: 0,
    },
    { onConflict: 'endpoint' },
  );
  if (error) throw new Error(error.message);
}

/** Forgets one. The user turned notifications off, and that must actually stop them. */
async function remove(db, endpoint) {
  if (!db || !endpoint) return;
  await db.from('push_subscriptions').delete().eq('endpoint', endpoint);
}

module.exports = { isReady, publicKey, broadcast, save, remove };
