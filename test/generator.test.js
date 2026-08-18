/**
 * The 24/7 generator, proven to run — and to agree with the app.
 *
 * The claim worth testing is not "it produces rows". It is that this process
 * and a user's browser, given the same candles, reach the SAME conclusion:
 * same direction, same prices, same trades. They share `fib236` through the
 * bundle, and this is what holds them to it.
 */
const assert = require('node:assert');
const test = require('node:test');

process.env.SIGNAL_GENERATOR = '0';
const engine = require('../engine.bundle.js');
const gen = require('../signal-generator.js');

const MIN = 60;
const T0 = Math.floor(Date.parse('2026-01-05T09:00:00Z') / 1000);
const c = (i, o, h, l, cl) => ({ o, h, l, c: cl, t: T0 + i * MIN });

/** One complete cycle: touch, a losing primary, a winning double. */
const SERIES = [
  c(0, 1.093, 1.0934, 1.0926, 1.093), c(1, 1.092, 1.0924, 1.0916, 1.092),
  c(2, 1.0906, 1.091, 1.09, 1.0904), c(3, 1.0915, 1.0919, 1.0911, 1.0915),
  c(4, 1.093, 1.0934, 1.0926, 1.093), c(5, 1.0945, 1.0949, 1.0941, 1.0945),
  c(6, 1.096, 1.0964, 1.0956, 1.096), c(7, 1.097, 1.0974, 1.0966, 1.097),
  c(8, 1.098, 1.0984, 1.0978, 1.0982), c(9, 1.099, 1.1, 1.0986, 1.0992),
  c(10, 1.0988, 1.099, 1.0984, 1.0986), c(11, 1.0985, 1.0987, 1.0982, 1.0984),
  c(12, 1.0983, 1.0985, 1.098, 1.0982), c(13, 1.0981, 1.0983, 1.0979, 1.098),
  c(14, 1.098, 1.0982, 1.0978, 1.0979), c(15, 1.0979, 1.0981, 1.0977, 1.0978),
  c(16, 1.0978, 1.098, 1.0972, 1.0974),
  c(17, 1.097, 1.0972, 1.0958, 1.096),
  c(18, 1.096, 1.0982, 1.0959, 1.098),
  c(19, 1.098, 1.0982, 1.0978, 1.098),
];

/** Runs the generator's own tick over the series, minute by minute. */
function runGenerator() {
  gen.__test.reset();
  global.otcClient = { enabled: new Set(['EURUSD_otc']), store: { candles: {} } };
  const rows = [];
  const realNow = Date.now;
  try {
    for (let i = 12; i < SERIES.length; i++) {
      global.otcClient.store.candles['EURUSD_otc_1m'] = SERIES.slice(0, i + 1);
      Date.now = () => (SERIES[i].t + MIN) * 1000;
      gen.__test.tick();
      rows.push(...gen.__test.takeBuffer());
    }
  } finally {
    Date.now = realNow;
  }
  return rows;
}

/** Drives the program directly, the way the app's watch does. */
function runApp() {
  const program = engine.programForPlan('free');
  const state = program.init();
  const out = [];
  for (let i = 12; i < SERIES.length; i++) {
    const candles = SERIES.slice(0, i + 1).map((x) => ({
      open: x.o, high: x.h, low: x.l, close: x.c, volume: 1000, time: x.t * 1000,
    }));
    const e = program.onCandleClose(
      { candles, timeframeMs: 60_000, now: (SERIES[i].t + MIN) * 1000 },
      state,
    );
    if (e.settled) out.push(e.settled);
  }
  return out;
}

test('does not call the removed pyramid entry point', () => {
  const src = require('node:fs').readFileSync(require.resolve('../signal-generator.js'), 'utf8');
  // The CALL, not the word: the header explains what it used to do, and a
  // string search would fail on its own history lesson.
  assert.ok(!src.includes('engine.evaluateStrategyPro('), 'no call to the removed entry point');
  assert.ok(src.includes('PROGRAM.onCandleClose('), 'drives the program instead');
  assert.strictEqual(engine.evaluateStrategyPro, undefined);
});

test('runs the program the plans actually use', () => {
  assert.strictEqual(gen.PROGRAM.id, 'fib_236_touch');
  assert.strictEqual(gen.TIMEFRAME, '1m');
  assert.strictEqual(gen.EXPIRY_SECONDS, 60);
});

test('produces the cycle, with a row per settled trade', () => {
  const rows = runGenerator();
  const free = rows.filter((r) => r.slot.endsWith('_free'));

  assert.strictEqual(free.length, 2, 'a primary and its double');
  assert.strictEqual(free[0].slot, 'instant_free');
  assert.strictEqual(free[1].slot, 'monitoring_free', 'the martingale is recorded separately');
  assert.strictEqual(free[0].direction, 'CALL');
  assert.strictEqual(free[1].direction, 'CALL', 'the double follows the same direction');
});

test('records the prices the strategy actually used', () => {
  const row = runGenerator().find((r) => r.slot === 'instant_free');
  assert.strictEqual(row.entry_price, 1.097, 'the open of the trade candle');
  assert.strictEqual(row.timeframe, '1m');
  assert.strictEqual(row.expiry_seconds, 60);
  assert.strictEqual(row.strategy_version_id, null, 'the strategy is code, not a row');
});

test('reaches the same conclusion the app does, trade for trade', () => {
  const rows = runGenerator().filter((r) => r.slot.endsWith('_free'));
  const app = runApp();

  assert.strictEqual(rows.length, app.length);
  rows.forEach((row, i) => {
    assert.strictEqual(row.direction, app[i].direction);
    assert.strictEqual(row.entry_price, app[i].entryPrice);
  });
});

test('evaluates every plan, not just one', () => {
  const rows = runGenerator();
  assert.ok(rows.some((r) => r.slot.endsWith('_free')));
  assert.ok(rows.some((r) => r.slot.endsWith('_paid')));
});

/**
 * Settlement.
 *
 * These exist because of a bug that ran in production: rows were written and
 * then matched back to outcomes held in memory, keyed on `expires_at` — which
 * `record_signals` builds from `created_at`, the moment of the INSERT, while
 * the key was built from the trade's candle. The row is written a minute or
 * more after that candle, so the two were never equal and not one row was ever
 * matched. Every signal stayed `pending` for ever, and nothing said so.
 *
 * The lesson is not "that key was wrong" but that the settlement path was the
 * one path with no test on it. So it has one now, and it settles from the
 * trade's own candle — the only clock that means anything here.
 */
test.describe('settlement', () => {
  const MIN = 60_000;
  const t0 = Date.parse('2026-08-18T10:00:00Z');
  // Four one-minute candles. Each closes somewhere different so the assertions
  // below can only pass if the RIGHT candle was picked.
  const store = [
    { t: (t0 + 0 * MIN) / 1000, o: 1.1000, h: 1.1010, l: 1.0990, c: 1.1008 },
    { t: (t0 + 1 * MIN) / 1000, o: 1.1008, h: 1.1012, l: 1.1001, c: 1.1002 },
    { t: (t0 + 2 * MIN) / 1000, o: 1.1002, h: 1.1005, l: 1.0995, c: 1.0997 },
    { t: (t0 + 3 * MIN) / 1000, o: 1.0997, h: 1.1000, l: 1.0990, c: 1.0999 },
  ];
  const lookup = (symbol) => (symbol === 'EURUSD_otc' ? store : null);
  const now = t0 + 10 * MIN;
  const row = (over) => ({
    id: 1, symbol: 'EURUSD_otc', direction: 'CALL', entry_price: 1.1002,
    bar_time: new Date(t0 + 2 * MIN).toISOString(), expiry_seconds: 60, ...over,
  });

  test.it('settles from the trade’s own candle, not from when the row was written', () => {
    // The regression. Entry is the open of the 10:02 candle and that candle
    // closes below it, so the CALL loses. Read the 10:03 candle instead — the
    // one a write-time clock would drift onto — and it closes above its open,
    // which would report a win. Only `bar_time` gives the true answer.
    const [out] = gen.__test.settlementFor([row()], lookup, now);
    assert.equal(out.price, 1.0997, 'took the close of a candle that was not the trade’s');
    assert.equal(out.outcome, 'loss');
  });

  test.it('records a close inside the engine’s band as a tie', () => {
    // Half the tie band above entry: not equal to entry, and inside it. The
    // engine is the only thing that decides this — the settlement path must
    // not carry a second opinion about what counts as a draw.
    const entry = 1.1002;
    const close = store[2].c;
    const tied = row({ entry_price: close + (Math.abs(close) * 5e-6) / 2 });
    const [out] = gen.__test.settlementFor([tied], lookup, now);
    assert.equal(out.outcome, 'tie');
    assert.notEqual(tied.entry_price, close, 'a tie that is just equality proves nothing');
    assert.ok(entry > 0);
  });

  test.it('marks a trade whose candle is gone as unresolved, never as a tie', () => {
    const [out] = gen.__test.settlementFor([row({ symbol: 'GONE_otc' })], lookup, now);
    assert.equal(out.price, null);
    assert.equal(out.outcome, null);
  });

  test.it('leaves a trade that is still running alone', () => {
    const running = row({ bar_time: new Date(now - 30_000).toISOString() });
    assert.deepEqual(gen.__test.settlementFor([running], lookup, now), []);
  });

  test.it('settles a PUT by the same candle and the same rule', () => {
    const [out] = gen.__test.settlementFor([row({ direction: 'PUT' })], lookup, now);
    assert.equal(out.outcome, 'win', 'price fell and the PUT should have won');
  });
});
