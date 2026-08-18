/**
 * Prints a fresh VAPID keypair. Run once, ever.
 *
 *   node generate-vapid.js
 *
 * Paste the two values into the environment (Render → Environment) as
 * VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY. The app does not need either of
 * them: it asks the proxy for the public half at runtime, so rotating the pair
 * is an environment change on one service rather than a rebuild of the site.
 *
 * ── WHY THIS DOES NOT USE `web-push` ───────────────────────────────────────
 *
 * Because of when it is needed. The first time anybody runs this, the service
 * is still on a deploy that predates the whole feature: no `web-push`
 * installed, and — as it turned out — not even this file on disk yet. A key
 * generator that only works after the thing it is a prerequisite for has
 * already shipped is not much of a prerequisite.
 *
 * So it uses Node's own crypto, which has been able to do this since long
 * before any of it. A VAPID pair is nothing exotic: a P-256 keypair, with the
 * public half as the uncompressed point (0x04 ‖ x ‖ y) and the private half as
 * the bare scalar, both base64url. That is exactly what `web-push` produces,
 * and `setVapidDetails` accepts these without knowing the difference.
 *
 * ── ONCE ───────────────────────────────────────────────────────────────────
 *
 * Run it again and you get a DIFFERENT pair. Every subscription already stored
 * was made against the old public key, and a push signed with a new one comes
 * back 403 for ever — so every user silently stops receiving notifications
 * until they turn them on again, and nothing anywhere says why.
 */

'use strict';

const crypto = require('crypto');

const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
});

const pub = publicKey.export({ format: 'jwk' });
const priv = privateKey.export({ format: 'jwk' });

const bytes = (b64url) => Buffer.from(b64url, 'base64url');

// 0x04 marks an uncompressed point — the form the Web Push spec asks for.
const publicB64 = Buffer.concat([
  Buffer.from([4]),
  bytes(pub.x),
  bytes(pub.y),
]).toString('base64url');

console.log('\nVAPID_PUBLIC_KEY=' + publicB64);
console.log('VAPID_PRIVATE_KEY=' + priv.d);
console.log('\nحطّ الاتنين في Environment على Render.');
console.log('الخاص ميتحطش في أي مكان تاني — لا في كود ولا في ملف.');
console.log('وشغّل الأمر ده مرة واحدة بس: تاني مرة هتوقف إشعارات كل اللي مفعّلينها.\n');
