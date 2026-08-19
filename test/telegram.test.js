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
  daily = true,
} = {}) {
  return {
    claimed,
    from(table) {
      if (table === 'configs') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { data: { enabled, minDepthBps, daily } },
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
            gte: () => ({
              lte: () => ({ limit: async () => ({ data: signals, error: null }) }),
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
      assert.equal(db.claimed.size, 0, 'a failed send must not look like a sent one');
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
