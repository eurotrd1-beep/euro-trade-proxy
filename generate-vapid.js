/**
 * Prints a fresh VAPID keypair. Run once, ever.
 *
 *   node generate-vapid.js
 *
 * Paste the two values into the environment (Render → Environment) as
 * VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY, and the public one into the app as
 * NEXT_PUBLIC_VAPID_KEY.
 *
 * Run it again and you get a DIFFERENT pair, which invalidates every
 * subscription already stored — every user silently stops receiving
 * notifications until they turn them on again. So: once.
 */

'use strict';

const keys = require('web-push').generateVAPIDKeys();

console.log('\nVAPID_PUBLIC_KEY   =', keys.publicKey);
console.log('VAPID_PRIVATE_KEY  =', keys.privateKey);
console.log('\nالعام كمان لازم يتحط في التطبيق باسم NEXT_PUBLIC_VAPID_KEY.');
console.log('الخاص ميتحطش في أي مكان غير Environment على السيرفر.\n');
