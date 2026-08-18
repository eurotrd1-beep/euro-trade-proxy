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

/**
 * Consecutive failures before a subscription is given up on.
 *
 * At one tick a minute this is roughly ten minutes of continuous failure —
 * long enough that no plausible outage costs anybody their notifications, short
 * enough that rows which can never succeed stop being retried the same day.
 */
const FAILURE_LIMIT = 10;

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
    .select('endpoint, subscription, symbols, failures')
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
   * Whether this subscriber should be sent this particular message.
   *
   * There are two channels and a subscription is in one of them PER PAIR, not
   * as a whole. Somebody who picked EURUSD and GBPUSD is in the custom channel
   * for those two and in the general channel for the other 87.
   *
   *   • custom  — the pairs they named. Every setup on them is announced
   *               immediately and individually. Untouched by any of the leader
   *               logic; this is what they asked for and what they get.
   *   • general — everything else. One message at a time about whichever pair
   *               is closest to firing, and nothing at all while a trade runs.
   *               `symbols: null` — no selection made — is entirely here, which
   *               is the point: a notification from each of 89 pairs is the
   *               thing the leader was introduced to stop.
   *
   * An empty list is a real state and means the custom channel is empty, not
   * that everything is custom. That subscriber still gets the general channel.
   */
  const chose = (row, symbol) =>
    Array.isArray(row.symbols) && row.symbols.includes(symbol);

  const wants = (row) =>
    payload.channel === 'custom'
      ? chose(row, payload.symbol)
      : !chose(row, payload.symbol);

  // Sent in parallel: a few thousand subscriptions one after another would not
  // finish inside the minute before the next candle closes.
  const recovered = [];
  const struggling = [];

  await Promise.all(
    (data || []).filter(wants).map(async (row) => {
      // The subscription is stored exactly as the browser handed it over,
      // which is exactly what `sendNotification` wants. Taking it apart into
      // columns would only mean putting it back together on every send.
      const sub = row.subscription;
      if (!sub || !sub.endpoint || !sub.keys) { dead.push(row.endpoint); return; }

      try {
        await webpush.sendNotification(sub, body, { TTL: 120 }); // A trade is over by then.
        sent++;
        if ((row.failures || 0) > 0) recovered.push(row.endpoint);
      } catch (e) {
        const code = e && e.statusCode;
        // 404 and 410 are final: the browser is gone, the data was cleared, or
        // the subscription was replaced. Anything else might be the push
        // service having a bad minute, so it counts rather than deletes.
        if (code === 404 || code === 410) dead.push(row.endpoint);
        else {
          failed++;
          struggling.push({ endpoint: row.endpoint, failures: (row.failures || 0) + 1 });
        }
      }
    }),
  );

  // Sustained failure is its own kind of dead. A subscription made under a
  // previous VAPID key answers 403 for ever — never 410 — so without this the
  // system would retry a handful of unreachable rows every minute indefinitely.
  // The threshold is minutes of continuous failure, not one bad reply, so an
  // upstream wobble costs nobody their subscription.
  const exhausted = struggling.filter((r) => r.failures >= FAILURE_LIMIT).map((r) => r.endpoint);
  const retrying = struggling.filter((r) => r.failures < FAILURE_LIMIT);

  const gone = dead.concat(exhausted);
  if (gone.length > 0) {
    await db.from('push_subscriptions').delete().in('endpoint', gone);
  }
  // Counted per row so the tally means something, and reset the moment one
  // works again — otherwise a subscription that fails on and off for an hour
  // eventually crosses the line despite being perfectly alive.
  await Promise.all([
    ...retrying.map((r) =>
      db.from('push_subscriptions').update({ failures: r.failures }).eq('endpoint', r.endpoint),
    ),
    recovered.length > 0
      ? db.from('push_subscriptions').update({ failures: 0 }).in('endpoint', recovered)
      : null,
  ].filter(Boolean));

  return { sent, removed: gone.length, failed };
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
      subscription: sub,
      user_id: accountId || null,
      plan: plan || null,
      // Only a real array is stored. Anything else — absent, a string, junk —
      // becomes NULL, which is "every pair", because the safe failure for a
      // filter is to deliver rather than to go silently quiet.
      symbols: Array.isArray(symbols) ? symbols : null,
      updated_at: new Date().toISOString(),
      // Re-subscribing is the user telling us this one works. Whatever the old
      // row had counted against it does not apply to a fresh registration.
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
