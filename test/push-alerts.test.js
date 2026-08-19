/**
 * The notification ladder: three rungs, each at most once per opportunity.
 *
 * Driven through injected `claim` and `deliver`, so what is tested is the rule
 * rather than a database and a push service. `claim` is the durable half — the
 * primary key on `push_alerts` — and it is simulated here by a Set, which is
 * exactly what that key is.
 */
const assert = require('node:assert');
const test = require('node:test');
const { createAlerts, NEAR, VERY_CLOSE, FIRED } = require('../push-alerts.js');

/** A fresh alerter plus the log of what it sent. `claimed` survives a restart. */
function harness(claimed = new Set()) {
  const sent = [];
  const alerts = createAlerts({
    async claim(symbol, setupKey, stage) {
      const k = `${symbol}|${setupKey}|${stage}`;
      if (claimed.has(k)) return false;
      claimed.add(k);
      return true;
    },
    async deliver(symbol, stage, title, body) {
      sent.push({ symbol, stage, title, body });
    },
  });
  return { alerts, sent, claimed };
}

const at = (alerts, percent, opts = {}) =>
  alerts.at({ symbol: 'EURUSD', name: 'EUR/USD', setupKey: 'a:b', percent, ...opts });

test.describe('one setup, one ladder', () => {
  // A
  test.it('sends 96 once when the pair first gets close', async () => {
    const { alerts, sent } = harness();
    await at(alerts, 96.4);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].stage, NEAR);
    assert.ok(sent[0].body.includes('EUR/USD'), sent[0].body);
    assert.ok(sent[0].body.includes('96.4%'), sent[0].body);
  });

  // B
  test.it('says nothing more as the reading drifts up inside the same rung', async () => {
    const { alerts, sent } = harness();
    for (const p of [96.0, 96.5, 97.0, 97.4, 97.9]) await at(alerts, p);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].stage, NEAR);
  });

  // C
  test.it('sends 98 once when it gets very close', async () => {
    const { alerts, sent } = harness();
    await at(alerts, 96.2);
    await at(alerts, 98.1);
    assert.deepEqual(
      sent.map((s) => s.stage),
      [NEAR, VERY_CLOSE],
    );
    assert.ok(sent[1].body.includes('98.1%'), sent[1].body);
  });

  // D
  test.it('says nothing more between 98 and the close', async () => {
    const { alerts, sent } = harness();
    for (const p of [98.0, 98.4, 99.1, 99.9, 99.99]) await at(alerts, p);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].stage, VERY_CLOSE);
  });

  // E
  test.it('sends 100 when the program actually returns a signal', async () => {
    const { alerts, sent } = harness();
    await at(alerts, 100, { fired: true });
    assert.equal(sent.length, 1);
    assert.equal(sent[0].stage, FIRED);
    assert.ok(sent[0].body.includes('EUR/USD'), sent[0].body);
  });

  // F
  test.it('is exactly three messages for a full climb', async () => {
    const { alerts, sent } = harness();
    for (const p of [95.4, 96.1, 96.8, 97.9, 98.2, 99.4, 99.99]) await at(alerts, p);
    await at(alerts, 100, { fired: true });
    assert.deepEqual(
      sent.map((s) => s.stage),
      [NEAR, VERY_CLOSE, FIRED],
    );
  });
});

test.describe('the jump nobody sees coming', () => {
  // G
  test.it('sends only the signal when a candle goes from below 96 straight to fired', async () => {
    const { alerts, sent } = harness();
    for (const p of [88, 92.5, 95.9]) await at(alerts, p);
    await at(alerts, 100, { fired: true });
    assert.deepEqual(
      sent.map((s) => s.stage),
      [FIRED],
    );
  });

  // H
  test.it('never back-fills the rungs it skipped', async () => {
    const { alerts, sent } = harness();
    await at(alerts, 100, { fired: true });
    for (const p of [96.5, 98.7, 99.2]) await at(alerts, p);
    assert.deepEqual(
      sent.map((s) => s.stage),
      [FIRED],
    );
  });

  test.it('does not step back down when the reading falls', async () => {
    const { alerts, sent } = harness();
    await at(alerts, 98.3);
    await at(alerts, 96.4);
    await at(alerts, 97.1);
    assert.deepEqual(
      sent.map((s) => s.stage),
      [VERY_CLOSE],
    );
  });
});

test.describe('once, whatever the plumbing does', () => {
  // I
  test.it('survives the same reading arriving many times', async () => {
    const { alerts, sent } = harness();
    for (let i = 0; i < 50; i++) await at(alerts, 96.7);
    assert.equal(sent.length, 1);
  });

  // J
  test.it('survives a restart mid-opportunity', async () => {
    const claimed = new Set();
    const first = harness(claimed);
    await at(first.alerts, 96.5);
    await at(first.alerts, 98.5);
    assert.equal(first.sent.length, 2);

    // The process dies. Memory is gone; the durable claims are not, and the
    // program rebuilds the same setup from the same candles.
    const second = harness(claimed);
    await at(second.alerts, 96.6);
    await at(second.alerts, 98.6);
    await at(second.alerts, 99.4);
    assert.equal(second.sent.length, 0, 'a redeploy must not announce it again');
  });

  test.it('still sends when the durable claim itself is unavailable', async () => {
    const sent = [];
    const alerts = createAlerts({
      async claim() {
        throw new Error('database down');
      },
      async deliver(symbol, stage, title, body) {
        sent.push({ stage, body });
      },
      onError() {},
    });
    await alerts.at({ symbol: 'EURUSD', name: 'EUR/USD', setupKey: 'a:b', percent: 96.5 });
    await alerts.at({ symbol: 'EURUSD', name: 'EUR/USD', setupKey: 'a:b', percent: 97.5 });
    // Sent once: memory is still holding the ladder, which is why there are two
    // guards rather than one.
    assert.equal(sent.length, 1);
  });

  // K
  test.it('starts a fresh ladder for a genuinely new setup', async () => {
    const { alerts, sent } = harness();
    await at(alerts, 96.5);
    await at(alerts, 98.5);
    // A new swing: different origin and end times, so a different key.
    await alerts.at({ symbol: 'EURUSD', name: 'EUR/USD', setupKey: 'c:d', percent: 96.1 });
    await alerts.at({ symbol: 'EURUSD', name: 'EUR/USD', setupKey: 'c:d', percent: 98.9 });
    assert.deepEqual(
      sent.map((s) => s.stage),
      [NEAR, VERY_CLOSE, NEAR, VERY_CLOSE],
    );
  });

  test.it('forgets a setup that died without firing', async () => {
    const { alerts, sent } = harness();
    await at(alerts, 96.5);
    await alerts.at({ symbol: 'EURUSD', name: 'EUR/USD', setupKey: null, percent: 0 });
    assert.equal(alerts._climbed.has('EURUSD'), false);
    assert.equal(sent.length, 1);
  });
});

test.describe('what never produces a message', () => {
  // M
  test.it('says nothing below 96', async () => {
    const { alerts, sent } = harness();
    for (const p of [0, 42, 89.9, 90, 94.9, 95.99]) await at(alerts, p);
    assert.equal(sent.length, 0);
  });

  // L — a pair with no setup is a pair this system never hears about. The
  // generator only reaches `at` for symbols in `symbolsToAnalyse`, and a symbol
  // with no armed setup arrives here with a null key.
  test.it('says nothing for a pair with no setup', async () => {
    const { alerts, sent } = harness();
    await alerts.at({ symbol: 'ZZZ', name: 'ZZZ', setupKey: null, percent: 99 });
    assert.equal(sent.length, 0);
  });

  test.it('never claims a trade in the two warning messages', async () => {
    const { alerts, sent } = harness();
    await at(alerts, 96.5);
    await at(alerts, 98.5);
    for (const s of sent) {
      assert.equal(s.body.includes('اتفتحت'), false, s.body);
      assert.ok(s.title.includes('فرصة'), s.title);
    }
  });

  test.it('marks only the signal as a signal', async () => {
    const { alerts, sent } = harness();
    await at(alerts, 100, { fired: true });
    assert.ok(sent[0].title.includes('إشارة بدأت'), sent[0].title);
  });
});
