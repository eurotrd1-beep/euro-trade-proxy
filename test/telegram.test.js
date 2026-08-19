/**
 * Telegram: three messages, each once, and never in the way.
 *
 * The API and the database are injected, so what is tested is the policy —
 * when a message is sent, when it is not, and what happens when either
 * dependency fails. `claim` is simulated by a Set, which is exactly what the
 * primary key on `telegram_alerts` is.
 */
const assert = require('node:assert');
const test = require('node:test');

process.env.TELEGRAM_BOT_TOKEN = 'test-token';
process.env.TELEGRAM_CHAT_ID = '-100123';
const { createTelegram } = require('../telegram.js');

/**
 * A fake Supabase enough for this module: `configs` for the switch,
 * `telegram_alerts` for the claim, `signals` for the daily tally.
 */
function fakeDb({
  enabled = true, claimed = new Set(), signals = [], failClaim = false, minDepthBps = 0,
  daily = true, publish = 'both', outcomes = 'all', summaryOffsetMinutes = 0,
} = {}) {
  /** Every window the daily summary asked `signals` for, in order. */
  const ranges = [];
  return {
    claimed,
    ranges,
    from(table) {
      if (table === 'configs') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  data: { enabled, minDepthBps, daily, publish, outcomes, summaryOffsetMinutes },
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'telegram_alerts') {
        return {
          select: () => ({
            eq: (_c, key) => ({
              maybeSingle: async () => ({
                data: claimed.has(key) ? { event_key: key } : null,
                error: null,
              }),
            }),
          }),
          insert: async (row) => {
            if (failClaim) return { error: { code: 'XXXXX', message: 'db down' } };
            if (claimed.has(row.event_key)) return { error: { code: '23505' } };
            claimed.add(row.event_key);
            return { error: null };
          },
          delete: () => ({
            eq: async (_col, key) => {
              claimed.delete(key);
              return { error: null };
            },
          }),
        };
      }
      // signals
      return {
        select: () => ({
          eq: () => ({
            gte: (_c, from) => ({
              lte: (_c2, to) => ({
                limit: async () => {
                  ranges.push({ from, to });
                  return { data: signals, error: null };
                },
              }),
            }),
          }),
        }),
      };
    },
  };
}

/**
 * The module reaches Telegram through `https.request` and nothing else, so
 * that is what the tests replace — one seam, and every layer above it real.
 */
const https = require('node:https');
function stubHttps(reply = { ok: true }) {
  const calls = [];
  const original = https.request;
  https.request = (url, opts, cb) => {
    const chunks = [];
    return {
      on() {
        return this;
      },
      end(body) {
        calls.push({ url: String(url), body: JSON.parse(body) });
        const res = {
          statusCode: 200,
          on(evt, fn) {
            if (evt === 'data') fn(JSON.stringify(reply));
            if (evt === 'end') fn();
            return res;
          },
        };
        cb(res);
      },
      destroy() {},
      write() {},
      ...{ chunks },
    };
  };
  return {
    calls,
    restore() {
      https.request = original;
    },
  };
}

const TRADE = {
  symbol: 'EURUSD_otc',
  name: 'EUR/USD OTC',
  direction: 'PUT',
  stage: 'primary',
  entryTime: Date.parse('2026-08-19T16:24:00Z'),
  durationMinutes: 1,
  level: 1.17391,
  depthBps: 4.2,
};

test.describe('SIGNAL_OPENED', () => {
  test.it('sends once when a trade opens', async () => {
    const net = stubHttps();
    try {
      const tg = createTelegram({ db: fakeDb(), log() {}, err() {} });
      assert.equal(await tg.signalOpened(TRADE), true);
      assert.equal(net.calls.length, 1);
      const text = net.calls[0].body.text;
      assert.ok(text.includes('EUR/USD OTC'), text);
      assert.ok(text.includes('بيع PUT'), text);
      assert.ok(text.includes('16:24'), text);
      assert.ok(text.includes('1 دقيقة'), text);
    } finally {
      net.restore();
    }
  });

  test.it('never sends the same trade twice', async () => {
    const net = stubHttps();
    try {
      const db = fakeDb();
      const tg = createTelegram({ db, log() {}, err() {} });
      await tg.signalOpened(TRADE);
      await tg.signalOpened(TRADE);
      await tg.signalOpened(TRADE);
      assert.equal(net.calls.length, 1);
    } finally {
      net.restore();
    }
  });

  test.it('keeps concurrent trades apart', async () => {
    const net = stubHttps();
    try {
      const tg = createTelegram({ db: fakeDb(), log() {}, err() {} });
      await tg.signalOpened(TRADE);
      await tg.signalOpened({ ...TRADE, symbol: 'GBPJPY_otc', name: 'GBP/JPY OTC' });
      await tg.signalOpened({ ...TRADE, symbol: 'USDJPY', name: 'USD/JPY' });
      assert.equal(net.calls.length, 3);
    } finally {
      net.restore();
    }
  });

  test.it('treats a martingale as its own trade', async () => {
    const net = stubHttps();
    try {
      const tg = createTelegram({ db: fakeDb(), log() {}, err() {} });
      await tg.signalOpened(TRADE);
      await tg.signalOpened({ ...TRADE, stage: 'martingale' });
      assert.equal(net.calls.length, 2);
    } finally {
      net.restore();
    }
  });
});

test.describe('TRADE_RESULT', () => {
  const settled = { ...TRADE, result: 'WIN', entryPrice: 1.17391, exitPrice: 1.1723 };

  test.it('sends the verdict the settlement produced', async () => {
    const net = stubHttps();
    try {
      const tg = createTelegram({ db: fakeDb(), log() {}, err() {} });
      await tg.signalOpened(TRADE);
      await tg.tradeResult(settled);
      const text = net.calls[1].body.text;
      assert.ok(text.includes('ربح'), text);
      assert.ok(text.includes('1.17391'), text);
      assert.ok(text.includes('1.17230'), text);
    } finally {
      net.restore();
    }
  });

  test.it('never sends the same result twice', async () => {
    const net = stubHttps();
    try {
      const db = fakeDb();
      const tg = createTelegram({ db, log() {}, err() {} });
      await tg.signalOpened(TRADE);
      await tg.tradeResult(settled);
      await tg.tradeResult(settled);
      assert.equal(net.calls.length, 2, 'one opening and one result, and no repeat');
    } finally {
      net.restore();
    }
  });

  test.it('attaches each result to its own trade when several settle together', async () => {
    const net = stubHttps();
    try {
      const tg = createTelegram({ db: fakeDb(), log() {}, err() {} });
      for (const sym of ['A', 'B', 'C']) {
        await tg.signalOpened({ ...TRADE, symbol: sym, name: sym });
      }
      await tg.tradeResult({ ...settled, symbol: 'A', name: 'A', result: 'WIN' });
      await tg.tradeResult({ ...settled, symbol: 'B', name: 'B', result: 'LOSS' });
      await tg.tradeResult({ ...settled, symbol: 'C', name: 'C', result: 'TIE' });
      const texts = net.calls.slice(3).map((c) => c.body.text);
      assert.ok(texts[0].includes('ربح') && texts[0].includes('A'));
      assert.ok(texts[1].includes('خسارة') && texts[1].includes('B'));
      assert.ok(texts[2].includes('تعادل') && texts[2].includes('C'));
    } finally {
      net.restore();
    }
  });

  test.it('sends a result for the opening AND the settlement of one trade', async () => {
    const net = stubHttps();
    try {
      const db = fakeDb();
      const tg = createTelegram({ db, log() {}, err() {} });
      await tg.signalOpened(TRADE);
      await tg.tradeResult(settled);
      assert.equal(net.calls.length, 2, 'the two are different events, not one');
    } finally {
      net.restore();
    }
  });
});

test.describe('the daily summary', () => {
  const rows = [
    { symbol: 'A', bar_time: '2026-08-19T10:00:00Z', outcome: 'win' },
    { symbol: 'A', bar_time: '2026-08-19T10:00:00Z', outcome: 'win' }, // second plan, same trade
    { symbol: 'B', bar_time: '2026-08-19T10:01:00Z', outcome: 'loss' },
    { symbol: 'C', bar_time: '2026-08-19T10:02:00Z', outcome: 'tie' },
    { symbol: 'D', bar_time: '2026-08-19T10:03:00Z', outcome: 'win' },
  ];

  test.it('counts each trade once and reports the rate', async () => {
    const net = stubHttps();
    try {
      const tg = createTelegram({ db: fakeDb({ signals: rows }), log() {}, err() {} });
      await tg.dailySummary('2026-08-19');
      const text = net.calls[0].body.text;
      assert.ok(text.includes('الصفقات اللي اتفتحت: 4'), text);
      assert.ok(text.includes('ربح: 2'), text);
      assert.ok(text.includes('خسارة: 1'), text);
      assert.ok(text.includes('تعادل: 1'), text);
      // 2 of 3 decided — a draw is not a win and not in the denominator.
      assert.ok(text.includes('66.7'), text);
    } finally {
      net.restore();
    }
  });

  test.it('sends only once for a day, however often the check runs', async () => {
    const net = stubHttps();
    try {
      const db = fakeDb({ signals: rows });
      const tg = createTelegram({ db, log() {}, err() {} });
      for (let i = 0; i < 20; i++) await tg.dailySummary('2026-08-19');
      assert.equal(net.calls.length, 1);
    } finally {
      net.restore();
    }
  });

  test.it('is a different message for a different day', async () => {
    const net = stubHttps();
    try {
      const db = fakeDb({ signals: rows });
      const tg = createTelegram({ db, log() {}, err() {} });
      await tg.dailySummary('2026-08-19');
      await tg.dailySummary('2026-08-20');
      assert.equal(net.calls.length, 2);
    } finally {
      net.restore();
    }
  });

  test.it('summarises the day that just ended', () => {
    const tg = createTelegram({
      db: fakeDb(),
      log() {},
      err() {},
      now: () => Date.parse('2026-08-20T00:03:00Z'),
    });
    assert.equal(tg.previousDay(), '2026-08-19');
  });
});

/**
 * The outcome filter — the one setting that reads how a trade ended.
 *
 * These pin the two ways it can be wrong in opposite directions: publishing
 * what was meant to be held back (the bug this fixes — losses going out under
 * «الفوز بس»), and holding back everything, which from outside looks exactly
 * like Telegram being down.
 */
test.describe('which OUTCOMES go out', () => {
  const settled = (result) => ({ ...TRADE, result, entryPrice: 1.1, exitPrice: 1.2 });

  async function publishedUnder(outcomes, result) {
    const net = stubHttps();
    try {
      const db = fakeDb({ outcomes });
      const tg = createTelegram({ db, log() {}, err() {} });
      db.claimed.add(`elig:${TRADE.symbol}:${TRADE.entryTime}:${TRADE.stage}`);
      await tg.tradeResult(settled(result));
      return net.calls.length === 1;
    } finally {
      net.restore();
    }
  }

  test.it('publishes every outcome when it is set to all', async () => {
    assert.equal(await publishedUnder('all', 'WIN'), true);
    assert.equal(await publishedUnder('all', 'LOSS'), true);
    assert.equal(await publishedUnder('all', 'TIE'), true);
  });

  test.it('holds the loss back under wins-only — the bug this fixes', async () => {
    assert.equal(await publishedUnder('wins', 'WIN'), true);
    assert.equal(await publishedUnder('wins', 'LOSS'), false);
    assert.equal(await publishedUnder('wins', 'TIE'), false);
  });

  test.it('holds the win back under losses-only', async () => {
    assert.equal(await publishedUnder('losses', 'LOSS'), true);
    assert.equal(await publishedUnder('losses', 'WIN'), false);
    assert.equal(await publishedUnder('losses', 'TIE'), false);
  });

  test.it('treats an unknown value as all, rather than as silence', async () => {
    assert.equal(await publishedUnder('WINS', 'LOSS'), true);
  });

  test.it('does not mark a filtered result as sent', async () => {
    const net = stubHttps();
    try {
      const db = fakeDb({ outcomes: 'wins' });
      const tg = createTelegram({ db, log() {}, err() {} });
      const elig = `elig:${TRADE.symbol}:${TRADE.entryTime}:${TRADE.stage}`;
      db.claimed.add(elig);
      await tg.tradeResult(settled('LOSS'));
      assert.deepEqual(
        [...db.claimed],
        [elig],
        'no result key may be claimed for a message that was never sent',
      );
    } finally {
      net.restore();
    }
  });

  test.it('leaves the opening alone — there is no outcome to filter on yet', async () => {
    const net = stubHttps();
    try {
      const tg = createTelegram({ db: fakeDb({ outcomes: 'wins' }), log() {}, err() {} });
      await tg.signalOpened(TRADE);
      assert.equal(net.calls.length, 1);
    } finally {
      net.restore();
    }
  });
});

/**
 * The summary's day.
 *
 * It used to be the UTC day, always, which for an operator at UTC+3 meant the
 * message about their day arrived at 03:00 the next morning — after the next
 * day's trades had already started. The offset moves that boundary and, with
 * it, the 24 hours the numbers cover. Nothing else moves: the rollups and the
 * admin's ranges stay on UTC days, which is why the message names the zone
 * whenever it is not UTC.
 */
test.describe('the summary follows the day the reader lives in', () => {
  const at = (iso) => () => Date.parse(iso);

  test.it('is unchanged at offset zero', async () => {
    const net = stubHttps();
    try {
      const db = fakeDb();
      const tg = createTelegram({ db, log() {}, err() {} });
      await tg.dailySummary('2026-08-19');
      assert.deepEqual(db.ranges[0], {
        from: '2026-08-19T00:00:00.000Z',
        to: '2026-08-19T23:59:59.999Z',
      });
      assert.ok(!net.calls[0].body.text.includes('بتوقيت'), 'a UTC day names no zone');
    } finally {
      net.restore();
    }
  });

  test.it('counts the 24 hours that end at the reader midnight', async () => {
    const net = stubHttps();
    try {
      const db = fakeDb({ summaryOffsetMinutes: 180 });
      const tg = createTelegram({ db, log() {}, err() {} });
      await tg.dailySummary('2026-08-19');
      assert.deepEqual(db.ranges[0], {
        from: '2026-08-18T21:00:00.000Z',
        to: '2026-08-19T20:59:59.999Z',
      });
      assert.ok(net.calls[0].body.text.includes('UTC+3'), net.calls[0].body.text);
    } finally {
      net.restore();
    }
  });

  test.it('picks the day that just ended for the reader, not for Greenwich', async () => {
    const db = fakeDb({ summaryOffsetMinutes: 180 });
    // 21:05 UTC on the 19th is 00:05 on the 20th at +3: the reader's day has
    // just ended, and the day that ended was the 19th.
    const tg = createTelegram({ db, log() {}, err() {}, now: at('2026-08-19T21:05:00Z') });
    await tg.isEnabled();
    assert.equal(tg.previousDay(), '2026-08-19');
  });

  test.it('still names that same day three hours later, so it is sent once', async () => {
    const db = fakeDb({ summaryOffsetMinutes: 180 });
    const tg = createTelegram({ db, log() {}, err() {}, now: at('2026-08-20T00:05:00Z') });
    await tg.isEnabled();
    assert.equal(
      tg.previousDay(),
      '2026-08-19',
      'the UTC rollover must not start a second summary',
    );
  });

  test.it('ignores a nonsense offset instead of summarising a random window', async () => {
    const db = fakeDb({ summaryOffsetMinutes: 'صباحًا' });
    const tg = createTelegram({ db, log() {}, err() {}, now: at('2026-08-20T00:05:00Z') });
    await tg.isEnabled();
    assert.equal(tg.previousDay(), '2026-08-19');
  });
});

test.describe('the switch', () => {
  test.it('sends nothing at all when it is off', async () => {
    const net = stubHttps();
    try {
      const tg = createTelegram({ db: fakeDb({ enabled: false }), log() {}, err() {} });
      await tg.signalOpened(TRADE);
      await tg.tradeResult({ ...TRADE, result: 'WIN', entryPrice: 1, exitPrice: 1 });
      await tg.dailySummary('2026-08-19');
      assert.equal(net.calls.length, 0);
    } finally {
      net.restore();
    }
  });

  test.it('claims nothing while off, so turning it on later still works', async () => {
    const net = stubHttps();
    try {
      const db = fakeDb({ enabled: false });
      const tg = createTelegram({ db, log() {}, err() {} });
      await tg.signalOpened(TRADE);
      assert.equal(db.claimed.size, 0, 'an off switch must not burn the event key');
    } finally {
      net.restore();
    }
  });
});

test.describe('failure never reaches the engine', () => {
  test.it('resolves false when Telegram refuses, and never throws', async () => {
    const net = stubHttps({ ok: false, description: 'chat not found' });
    try {
      const tg = createTelegram({ db: fakeDb(), log() {}, err() {} });
      assert.equal(await tg.signalOpened(TRADE), false);
    } finally {
      net.restore();
    }
  });

  test.it('gives the claim back when the send fails, so it can be retried', async () => {
    let net = stubHttps({ ok: false, description: 'timeout' });
    const db = fakeDb();
    const tg = createTelegram({ db, log() {}, err() {} });
    try {
      await tg.signalOpened(TRADE);
      const key = `signal:${TRADE.symbol}:${TRADE.entryTime}:${TRADE.stage}`;
      assert.equal(db.claimed.has(key), false, 'a failed send must not look like a sent one');
      // Eligibility is NOT released: it records that the trade cleared the bar
      // when it opened, which a Telegram outage does not change.
      assert.equal(db.claimed.has(`elig:${TRADE.symbol}:${TRADE.entryTime}:${TRADE.stage}`), true);
    } finally {
      net.restore();
    }
    // The next tick succeeds, and the message goes out exactly once.
    net = stubHttps({ ok: true });
    try {
      assert.equal(await tg.signalOpened(TRADE), true);
      assert.equal(net.calls.length, 1);
    } finally {
      net.restore();
    }
  });

  test.it('resolves false when the database is unreachable, and never throws', async () => {
    const net = stubHttps();
    try {
      const tg = createTelegram({ db: fakeDb({ failClaim: true }), log() {}, err() {} });
      assert.equal(await tg.signalOpened(TRADE), false);
    } finally {
      net.restore();
    }
  });

  test.it('is inert with no token configured', async () => {
    const savedToken = process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_BOT_TOKEN;
    const net = stubHttps();
    try {
      const tg = createTelegram({ db: fakeDb(), log() {}, err() {} });
      assert.equal(tg.configured, false);
      assert.equal(await tg.signalOpened(TRADE), false);
      assert.equal(net.calls.length, 0);
      assert.equal(tg.startScheduler(), null);
    } finally {
      net.restore();
      process.env.TELEGRAM_BOT_TOKEN = savedToken;
    }
  });
});


test.describe('the publishing bar', () => {
  /**
   * Chosen before the outcome exists, which is what separates it from editing
   * a record. A published signal is still a real prediction; there are simply
   * fewer of them, and they are the ones the strategy measured as stronger.
   */
  test.it('publishes a signal at or above the bar', async () => {
    const net = stubHttps();
    try {
      const tg = createTelegram({ db: fakeDb({ minDepthBps: 4 }), log() {}, err() {} });
      assert.equal(await tg.signalOpened({ ...TRADE, depthBps: 4 }), true);
      assert.equal(net.calls.length, 1);
    } finally {
      net.restore();
    }
  });

  test.it('says nothing about a signal below it', async () => {
    const net = stubHttps();
    try {
      const db = fakeDb({ minDepthBps: 5 });
      const tg = createTelegram({ db, log() {}, err() {} });
      assert.equal(await tg.signalOpened({ ...TRADE, depthBps: 4.9 }), false);
      assert.equal(net.calls.length, 0);
      assert.equal(db.claimed.size, 0, 'an unpublished signal must not burn its key');
    } finally {
      net.restore();
    }
  });

  test.it('withholds the RESULT of a trade it never announced', async () => {
    const net = stubHttps();
    try {
      const db = fakeDb({ minDepthBps: 5 });
      const tg = createTelegram({ db, log() {}, err() {} });
      await tg.signalOpened({ ...TRADE, depthBps: 2 }); // below the bar
      await tg.tradeResult({ ...TRADE, result: 'LOSS', entryPrice: 1.1, exitPrice: 1.2 });
      assert.equal(net.calls.length, 0, 'a channel must not show results it never called');
    } finally {
      net.restore();
    }
  });

  test.it('publishes the result of a trade it DID announce, whatever it is', async () => {
    const net = stubHttps();
    try {
      const db = fakeDb({ minDepthBps: 3 });
      const tg = createTelegram({ db, log() {}, err() {} });
      await tg.signalOpened({ ...TRADE, depthBps: 6 });
      await tg.tradeResult({ ...TRADE, result: 'LOSS', entryPrice: 1.1, exitPrice: 1.2 });
      assert.equal(net.calls.length, 2);
      // The loss goes out as a loss. The bar decides what is entered, never
      // what a trade turned out to be.
      assert.ok(net.calls[1].body.text.includes('خسارة'), net.calls[1].body.text);
    } finally {
      net.restore();
    }
  });

  test.it('publishes everything when the bar is zero', async () => {
    const net = stubHttps();
    try {
      const tg = createTelegram({ db: fakeDb({ minDepthBps: 0 }), log() {}, err() {} });
      assert.equal(await tg.signalOpened({ ...TRADE, depthBps: 3.0001 }), true);
    } finally {
      net.restore();
    }
  });

  test.it('lets a martingale follow the trade it recovers', async () => {
    const net = stubHttps();
    try {
      const db = fakeDb({ minDepthBps: 5 });
      const tg = createTelegram({ db, log() {}, err() {} });
      await tg.signalOpened({ ...TRADE, depthBps: 9 });
      // No level of its own, so no depth — and it belongs with the trade above.
      await tg.signalOpened({ ...TRADE, stage: 'martingale', depthBps: undefined });
      assert.equal(net.calls.length, 2);
    } finally {
      net.restore();
    }
  });
});


test.describe('the daily summary switch', () => {
  const rows = [{ symbol: 'A', bar_time: '2026-08-19T10:00:00Z', outcome: 'win' }];

  test.it('sends nothing when the summary is switched off', async () => {
    const net = stubHttps();
    try {
      const tg = createTelegram({ db: fakeDb({ signals: rows, daily: false }), log() {}, err() {} });
      assert.equal(await tg.dailySummary('2026-08-19'), false);
      assert.equal(net.calls.length, 0);
    } finally {
      net.restore();
    }
  });

  test.it('leaves signals and results alone when only the summary is off', async () => {
    const net = stubHttps();
    try {
      const db = fakeDb({ daily: false });
      const tg = createTelegram({ db, log() {}, err() {} });
      await tg.signalOpened(TRADE);
      await tg.tradeResult({ ...TRADE, result: 'WIN', entryPrice: 1.1, exitPrice: 1.2 });
      assert.equal(net.calls.length, 2);
    } finally {
      net.restore();
    }
  });

  test.it('treats a missing field as on', async () => {
    const net = stubHttps();
    try {
      const tg = createTelegram({
        db: fakeDb({ signals: rows, daily: undefined }),
        log() {},
        err() {},
      });
      assert.equal(await tg.dailySummary('2026-08-19'), true);
    } finally {
      net.restore();
    }
  });
});


test.describe('which KINDS go out', () => {
  const settled = { ...TRADE, result: 'LOSS', entryPrice: 1.17391, exitPrice: 1.175 };

  test.it('sends both by default', async () => {
    const net = stubHttps();
    try {
      const tg = createTelegram({ db: fakeDb(), log() {}, err() {} });
      await tg.signalOpened(TRADE);
      await tg.tradeResult(settled);
      assert.equal(net.calls.length, 2);
    } finally {
      net.restore();
    }
  });

  test.it('sends openings only', async () => {
    const net = stubHttps();
    try {
      const tg = createTelegram({ db: fakeDb({ publish: 'signals' }), log() {}, err() {} });
      await tg.signalOpened(TRADE);
      await tg.tradeResult(settled);
      assert.equal(net.calls.length, 1);
      assert.ok(net.calls[0].body.text.includes('اتفتحت'), net.calls[0].body.text);
    } finally {
      net.restore();
    }
  });

  test.it('sends results only', async () => {
    const net = stubHttps();
    try {
      const tg = createTelegram({ db: fakeDb({ publish: 'results' }), log() {}, err() {} });
      await tg.signalOpened(TRADE);
      await tg.tradeResult(settled);
      assert.equal(net.calls.length, 1);
      assert.ok(net.calls[0].body.text.includes('خسارة'), net.calls[0].body.text);
    } finally {
      net.restore();
    }
  });

  test.it('reports the LOSS as a loss in every mode', async () => {
    // The mode chooses kinds, never outcomes. A published result is whatever
    // the settlement said it was.
    for (const publish of ['both', 'results']) {
      const net = stubHttps();
      try {
        const tg = createTelegram({ db: fakeDb({ publish }), log() {}, err() {} });
        await tg.signalOpened(TRADE);
        await tg.tradeResult(settled);
        const text = net.calls.at(-1).body.text;
        assert.ok(text.includes('خسارة'), `${publish}: ${text}`);
      } finally {
        net.restore();
      }
    }
  });

  test.it('in results-only, still respects the bar set at the opening', async () => {
    const net = stubHttps();
    try {
      const db = fakeDb({ publish: 'results', minDepthBps: 5 });
      const tg = createTelegram({ db, log() {}, err() {} });
      // Below the bar: never eligible, so its result stays unpublished too.
      await tg.signalOpened({ ...TRADE, depthBps: 2 });
      await tg.tradeResult(settled);
      assert.equal(net.calls.length, 0);

      // Above it: eligible at the opening, so the result goes out.
      const other = { ...TRADE, symbol: 'GBPJPY', entryTime: TRADE.entryTime + 60_000 };
      await tg.signalOpened({ ...other, depthBps: 9 });
      await tg.tradeResult({ ...other, result: 'WIN', entryPrice: 1, exitPrice: 1.1 });
      assert.equal(net.calls.length, 1);
    } finally {
      net.restore();
    }
  });
});
