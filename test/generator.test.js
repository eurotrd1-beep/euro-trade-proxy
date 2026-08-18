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
