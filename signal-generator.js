'use strict';

/**
 * Server-side signal generator — the only honest way to answer "how did that
 * strategy version actually do".
 *
 * ── WHY IT LIVES HERE ──────────────────────────────────────────────────────
 *
 * Signals used to exist only inside each user's browser: generated on their
 * device, settled against their ticker, kept in React state, gone on refresh.
 * Statistics built from that measure the signals somebody HAPPENED to have the
 * app open for — a biased sample, not a measurement. So the engine runs here
 * instead, on every enabled pair, independent of whether anyone is watching.
 *
 * ── IT RUNS THE PROGRAM, NOT A RULE FILE ───────────────────────────────────
 *
 * It used to load a rule strategy per slot out of `strategy_versions` and score
 * it with `evaluateStrategyPro`. Neither exists any more: the pyramid was
 * removed, and strategies stopped being data — they are programs compiled into
 * the engine bundle this file requires. So it drives `fib_236_touch` exactly as
 * the app does, one closed candle at a time, and the plan → program map is the
 * single place that decides which plan runs which.
 *
 * That change carries three consequences worth stating plainly:
 *
 *   • ONE MINUTE, not fifteen. The program is defined on 1m candles and its
 *     trades are one candle long. Running it on 15m would not be a slower
 *     version of the same strategy; it would be a different one.
 *   • A ROW IS WRITTEN WHEN THE TRADE SETTLES, not when it opens. The program
 *     settles from the trade's own candle — its open in, its close out — and
 *     both numbers only exist once that candle has closed. Writing earlier
 *     meant recording an entry price the strategy never used. The cost is a
 *     process restart mid-trade losing that one trade, which `bar_time`
 *     de-duplication used to cover and no longer can.
 *   • `slot` now means plan × stage: `instant_*` is the primary trade and
 *     `monitoring_*` is the martingale that followed a loss. That is the split
 *     that matters for a strategy with a double in it.
 *
 * ── THE CONSTRAINTS THAT SHAPED IT ─────────────────────────────────────────
 *
 * READS NOTHING FROM SUPABASE IN STEADY STATE. Candles come from the scraper's
 * in-memory store (`global.otcClient.store.candles`) and prices from
 * `global.otcPrices`, both of which this process already maintains. A 30s poll
 * of candle rows once burned 5.6GB of egress in two days; that mistake is not
 * repeated. The only reads are: a 4-row hash check every 5 minutes (~400 bytes,
 * and the full strategy JSON only when a hash actually changes), and ONE query
 * at boot to sweep up rows a crash left behind.
 *
 * WRITES IN BATCHES. One RPC a minute, never a row at a time.
 *
 * NEVER GUESSES A PRICE. If the ticker is stale, missing, or the market is
 * closed when a trade expires, the outcome is `unresolved` — a fourth state,
 * separate from `tie`, excluded from every rate. Recording "no price" as a tie
 * would quietly inflate ties and nobody would ever find out why.
 *
 * STOPS ITSELF. A daily write budget lives in the database, not here, so a bug
 * in this file cannot spend past it.
 */

const engine = require('./engine.bundle.js');

// ── Configuration ───────────────────────────────────────────────────────────

/**
 * The plans, and which slot each of their trades is recorded under.
 *
 * Both plans resolve to the same program today, and both are still evaluated
 * separately rather than evaluated once and copied: the day they differ,
 * nothing here changes.
 */
const PLANS = [
  { plan: 'free', primarySlot: 'instant_free', martingaleSlot: 'monitoring_free' },
  { plan: 'paid', primarySlot: 'instant_paid', martingaleSlot: 'monitoring_paid' },
];

/** The program every plan runs — read from the engine, never assumed. */
const PROGRAM = engine.programForPlan('free');

/**
 * The timeframe is the PROGRAM's, not a choice made here.
 *
 * It used to be 15m, chosen so that clock-reading indicators saw a whole day.
 * Those indicators are gone, and this one is defined on one-minute candles.
 */
const TIMEFRAME = PROGRAM.timeframe;
const STEP_SECONDS = 60;

/**
 * Candles before the program is even asked.
 *
 * The program enforces its own minimum — it refuses until twelve candles sit
 * behind the one it is judging — so this only avoids pointless calls. Set
 * higher and a pair with a short history is skipped for no reason, which is
 * how the first version of this managed to arm and touch on the same candle
 * and produce nothing at all.
 */
const WARMUP = 12;

/** How long a trade runs — the program's, again. */
const EXPIRY_SECONDS = PROGRAM.durationMinutes * 60;


const TICK_MS = 10_000;          // how often we look for a newly closed candle
const FLUSH_MS = 60_000;         // how often the buffer is written
const ROLLUP_MS = 600_000;       // refresh the daily aggregate
const PRUNE_MS = 6 * 3600_000;   // drop raw rows past the retention window
const KEEP_DAYS = 30;

/** A ticker older than this is not a price. */
const PRICE_MAX_AGE_MS = 30_000;

const ENABLED = process.env.SIGNAL_GENERATOR !== '0';

const log = (...a) => console.log('[signals]', ...a);
const err = (...a) => console.error('[signals]', ...a);

// ── Supabase (service role — this process is the only writer) ───────────────

let db = null;
try {
  const { createClient } = require('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (url && key) db = createClient(url, key, { auth: { persistSession: false } });
} catch (e) {
  err('supabase client unavailable:', e.message);
}

const push = require('./push.js');

/**
 * Which pairs have already been announced, so nobody is told twice.
 *
 * Keyed by symbol, holding the identity of the setup that was announced. The
 * program rebuilds an armed setup from the candles on every tick, so without
 * this the same opportunity would be pushed once a minute for as long as it
 * stood — which is the fastest way to make somebody turn notifications off.
 */
const announced = new Map();

/**
 * How far along a pair must be before it is worth a notification.
 *
 * The progress scale puts an adopted setup at 50: the leg is confirmed and the
 * level is drawn, but price may be most of a leg away and may never come back.
 * Announcing there means announcing a possibility, and enough of those arrive
 * that the ones worth reading stop being read.
 *
 * 85 is inside the armed band and near the top of it, so it means "price is
 * closing on the level", not "a level exists". The trade opening has its own
 * message, one candle ahead of the entry.
 */
const NEAR_THRESHOLD = 85;

/**
 * A pair's display name, for a notification the user reads at a glance.
 *
 * `EURUSD_otc` means nothing on a lock screen. The suffix is kept because OTC
 * and the real market are different instruments and the user is choosing which
 * chart to open.
 */
function displayName(symbol) {
  const otc = /_otc$/i.test(symbol);
  const base = symbol.replace(/_otc$/i, '');
  const pair = base.length === 6 ? `${base.slice(0, 3)}/${base.slice(3)}` : base;
  return otc ? `${pair} OTC` : pair;
}

/**
 * Tells everyone a setup is forming, or that a trade just opened.
 *
 * Both plans run the same program, so the loop below reaches this twice for
 * one event — hence the guard on plan. Sending it once and delivering to
 * everybody is right while the two plans share a strategy; the day they stop
 * sharing one, this is where the split goes.
 */
function announce(symbol, kind, channel, body) {
  if (!push.isReady() || !db) return;
  const title =
    kind === 'signal'
      ? `إشارة بدأت — ${displayName(symbol)}`
      : kind === 'leader'
        ? `أقرب فرصة دلوقتي — ${displayName(symbol)}`
        : `فرصة بتتكوّن — ${displayName(symbol)}`;
  void push
    .broadcast(db, { kind, channel, symbol, title, body, at: Date.now() })
    .then((r) => {
      if (r.sent > 0 || r.removed > 0) {
        log(`إشعار ${kind}/${channel} ${symbol} · وصل ${r.sent} · اتشال ${r.removed}`);
      }
    })
    .catch((e) => err('إشعار فشل:', e.message));
}

/**
 * ── The general channel is gone ────────────────────────────────────────────
 *
 * It announced whichever unchosen pair was closest to firing, and it existed
 * because a subscriber who had named no pairs was being told about all 89.
 * Users now choose their pairs before anything runs, so there is no such thing
 * as an unchosen pair being watched, and nothing left for that channel to
 * carry. `generalTrade` stays: the quiet period during a trade is still real.
 *
 * Recoverable from git — `fad7fa1` — if the coverage is ever wanted back. It is
 * deleted rather than switched off, because code that never runs is never
 * tested and a flag that is always false is a lie the code tells about itself.
 */

/**
 * The pair whose trade is running, if any.
 *
 * While this is set the general channel says nothing at all. It clears when
 * that pair's cycle ends, which is the program's own answer rather than a timer
 * that could drift out of step with a martingale.
 */
let generalTrade = null;

// ── Alerts ──────────────────────────────────────────────────────────────────

/**
 * Loud, and only for things that need a human.
 *
 * Written to stderr rather than pushed anywhere. The write cap being hit means
 * signals are being dropped right now, so it is logged once per day at ERROR
 * level and the flag stays raised until the day rolls over — a line that
 * repeats every minute is a line nobody reads.
 *
 * `signal_write_budget.capped` in the database records the same fact durably,
 * so a log that scrolled away does not lose it.
 */
function alert(text) {
  err('══ تنبيه ══', text);
}

// ── State ───────────────────────────────────────────────────────────────────

/**
 * `${plan}|${symbol}` → the program's state for that pair.
 *
 * In memory only. An armed setup rebuilds itself from the candles within a
 * couple of closes, and an open cycle that a restart interrupts loses one
 * trade — which is the price of recording exact prices rather than guessed
 * ones. See the note at the top.
 */
const programStates = new Map();

/** Rows waiting to be written. */
let buffer = [];


let cappedToday = false;
let stats = { evaluated: 0, signals: 0, written: 0, duplicates: 0, resolved: 0, unresolved: 0 };

function stateFor(plan, symbol) {
  const key = `${plan}|${symbol}`;
  let held = programStates.get(key);
  if (held === undefined) {
    held = PROGRAM.init();
    programStates.set(key, held);
  }
  return held;
}

// ── Candles, from memory only ───────────────────────────────────────────────

function storeFor(symbol) {
  const store = global.otcClient && global.otcClient.store;
  if (!store) return null;
  return store.candles[`${symbol}_${TIMEFRAME}`] || null;
}

function enabledSymbols() {
  const client = global.otcClient;
  if (!client || !client.enabled) return [];
  return [...client.enabled];
}

/** The scraper's compact candle → the shape the engine expects. */
function toEngine(c) {
  return {
    open: c.o, high: c.h, low: c.l, close: c.c,
    // The feed carries no volume. The app substitutes this same constant, so
    // the engine here sees exactly what it sees on a user's device.
    volume: 1000,
    time: c.t * 1000,
  };
}

// ── Evaluation ──────────────────────────────────────────────────────────────

/**
 * One pass over every enabled pair, for every plan.
 *
 * The program is handed the store's candles as they are, plus the wall clock.
 * It works out which candle has closed and refuses to read the one still
 * forming — the same call the app makes, so this process cannot reach a
 * different conclusion from a user's device on the same data.
 */
/** The newest candle that has actually closed — the one the program just read. */
function lastClosed(candles) {
  const now = Date.now();
  for (let i = candles.length - 1; i >= 0; i--) {
    if (candles[i].time + STEP_SECONDS * 1000 <= now) return candles[i];
  }
  return null;
}

function tick() {
  const symbols = enabledSymbols();
  if (symbols.length === 0) return;

  for (const symbol of symbols) {
    const raw = storeFor(symbol);
    if (!raw || raw.length < WARMUP + 2) continue;

    const candles = raw.map(toEngine);

    for (const { plan, primarySlot, martingaleSlot } of PLANS) {
      const state = stateFor(plan, symbol);
      stats.evaluated++;

      let event;
      try {
        event = PROGRAM.onCandleClose(
          { candles, timeframeMs: STEP_SECONDS * 1000, now: Date.now() },
          state,
        );
      } catch (e) {
        err(`${symbol} ${plan}:`, e.message);
        continue;
      }

      // Notifications, once per symbol rather than once per plan. Sent before
      // the row is built because a trade opening is the thing the user asked
      // to be woken for, and it must not wait on a database write.
      if (plan === PLANS[0].plan) {
        // ── The custom channel ────────────────────────────────────────────
        //
        // A pair somebody named. No ranking, no margin, no quiet period: they
        // asked to be told about this pair. `broadcast` delivers only to the
        // subscribers who listed this symbol.
        //
        // WHEN, though, changed. It used to fire the moment a setup was
        // adopted, which on the progress scale is the halfway mark: the leg is
        // confirmed and the level is drawn, but price may be most of a leg away
        // and may never come back. That is an alert about a possibility, and
        // enough of them arrive that the useful ones stop being read.
        //
        // Now it waits for the pair to be genuinely close, and the trade
        // opening is announced separately below — which lands exactly one
        // candle before the entry, since the touch happens on one candle and
        // the trade opens on the next.
        const armed = state.armed;
        const key = armed ? armed.key : null;

        if (key !== null) {
          const raw = storeFor(symbol);
          const last = raw && raw.length > 0 ? raw[raw.length - 1] : null;
          const pct = last ? engine.setupProgress(state, null, last.c).percent : 0;

          // Keyed by the setup, so one opportunity is announced once however
          // long it hovers at the threshold — and a NEW setup on the same pair
          // later is a new opportunity and is announced again.
          if (pct >= NEAR_THRESHOLD && announced.get(symbol) !== key) {
            announced.set(symbol, key);
            announce(
              symbol,
              'armed',
              'custom',
              `${armed.direction === 'CALL' ? '🟢 صعود' : '🔴 هبوط'} · قرّب ${pct.toFixed(0)}% · مستنيين ${armed.level.toFixed(5)}`,
            );
          }
        } else {
          announced.delete(symbol);
        }

        if (event.signal !== null) {
          // Sent on the candle the touch happened, for a trade that opens on
          // the next one — so it arrives a full candle before the entry, which
          // is the only warning that is any use to somebody who has to place
          // the trade themselves.
          const body =
            `الصفقة على الشمعة الجاية · ${event.signal.direction === 'CALL' ? '🟢 شراء' : '🔴 بيع'} · ${PROGRAM.durationMinutes} دقيقة` +
            (event.signal.stage === 'martingale' ? ' · مضاعفة تعويض' : '');

          announce(symbol, 'signal', 'custom', body);

          // The general channel hears about a trade opening — that is the
          // payoff of the leader it was following, and the last thing it will
          // hear until the trade is over.
          if (generalTrade === null) {
            generalTrade = symbol;
            announce(symbol, 'signal', 'general', body);
          }
        }

        // Silence ends when the program says the cycle is finished, not on a
        // timer: a martingale extends the cycle, and a clock would reopen the
        // channel in the middle of the recovery trade.
        if (event.cycleEnd !== null && generalTrade === symbol) generalTrade = null;
      }

      // A trade is recorded when it SETTLES, with the two prices the program
      // actually used — its candle's open and close. Before that moment the
      // entry price does not exist yet, and writing the previous close in its
      // place would record a trade at a price the strategy never took.
      if (event.settled !== null) {
        stats.signals++;
        // The trade ran on the candle that just closed — found by time, not by
        // matching prices back, which would pick the wrong bar the moment two
        // candles happened to share an open and a close.
        const bar = lastClosed(candles);
        if (bar === null) continue;
        buffer.push(
          buildRow(
            symbol,
            event.settled.stage === 'martingale' ? martingaleSlot : primarySlot,
            event.settled,
            candles,
            state,
            bar,
          ),
        );
      }
    }
  }
}

/**
 * One settled trade, as a row.
 *
 * `rules_matched` keeps its shape — the admin screen renders it as a list —
 * but there are no rules to list any more. What goes in instead is what makes
 * this trade diagnosable six weeks later: the level it was waiting for, the
 * leg that produced it, and which half of the cycle this was.
 */
function buildRow(symbol, slot, settled, candles, state, bar) {

  const armed = state.armed;
  const detail = [
    { i: PROGRAM.id, r: 'program', v: null, ok: true },
    { i: 'stage', r: settled.stage, v: null, ok: true },
    { i: 'entry_open', r: 'price', v: Number(settled.entryPrice.toFixed(6)), ok: true },
    { i: 'exit_close', r: 'price', v: Number(settled.exitPrice.toFixed(6)), ok: true },
  ];
  if (armed) {
    detail.push({ i: 'fib_level', r: 'level', v: Number(armed.level.toFixed(6)), ok: true });
  }

  const snapshot = [];
  for (const c of candles.slice(-5)) {
    snapshot.push(c.open, c.high, c.low, c.close, Math.floor(c.time / 1000));
  }

  return {
    symbol,
    timeframe: TIMEFRAME,
    direction: settled.direction,
    bar_time: new Date(bar.time).toISOString(),
    // No version row to point at: the strategy is the code, and the build it
    // came from is stamped on the bundle rather than stored per signal.
    strategy_version_id: null,
    slot,
    confidence: PROGRAM.confidence,
    // A touch happened or it did not. There is no score behind it, and
    // inventing one would put a fabricated number in the statistics.
    score: 0,
    rules_matched: detail,
    candle_snapshot: snapshot,
    entry_price: settled.entryPrice,
    expiry_seconds: EXPIRY_SECONDS,
    forced: false,
  };
}

// ── Writing ─────────────────────────────────────────────────────────────────

async function flush() {
  if (!db || buffer.length === 0) return;
  const batch = buffer;
  buffer = [];

  try {
    const { data, error } = await db.rpc('record_signals', { p_rows: batch });
    if (error) throw new Error(error.message);
    const r = Array.isArray(data) ? data[0] : data;
    if (!r) return;

    stats.written += r.inserted;
    stats.duplicates += r.skipped;

    if (r.capped) {
      if (!cappedToday) {
        cappedToday = true;
        alert(
          `سقف كتابة الإشارات اليومي اتخطى. الدفعة (${batch.length} إشارة) اترفضت بالكامل ` +
            `والتسجيل واقف لحد بكرة. غيّر signal_write_budget.max_rows لو ده متوقع.`,
        );
      }
      return;
    }

    // Resolution happens in `settlePending`, not here.
    //
    // This used to match the inserted ids back to the outcomes it was holding
    // in memory, keyed by `symbol|expires_at`. It never matched a single row.
    // `record_signals` builds `expires_at` from `created_at` — the moment of
    // the INSERT — while the key was built from the trade's candle, and the
    // row is written a minute or more after that candle. Two clocks, never
    // equal, and the failure was silent: every row stayed `pending` for ever
    // and the statistics quietly stopped having outcomes.
    //
    // So the fragile half is gone. `settlePending` reads the pending rows back
    // with their direction and bar time and settles them from the trade's own
    // candle — which is the path that already had to exist for rows a restart
    // stranded. One way of settling, and it is the one that reads the data it
    // needs rather than trying to remember it.
  } catch (e) {
    err('flush:', e.message);
    // Put them back — a failed write must not silently lose signals. Capped at
    // a few thousand so a long outage cannot grow the heap without bound.
    buffer = batch.concat(buffer).slice(-5000);
  }
}

// ── Settling ────────────────────────────────────────────────────────────────

/**
 * Records the outcome for rows just inserted.
 *
 * The exit price is the close of the trade's own candle — the number the
 * program settled on — not a ticker reading taken whenever this code happened
 * to run. That is what keeps one truth: the outcome in the database and the
 * outcome that decided whether a martingale followed are the same event.
 *
 * One known seam, stated rather than hidden: `resolve_signals` calls a tie on
 * exact equality, while the engine allows a hair of tolerance
 * (`tieEpsilon`, 0.0005% of the entry). A close that lands inside that band is
 * a tie to the strategy and a win or a loss to the statistics. Closing it needs
 * the outcome to be passed in rather than recomputed, which is a migration.
 */
async function resolveNow(rows) {
  if (!db || rows.length === 0) return;
  try {
    const { error } = await db.rpc('resolve_signals', { p_rows: rows });
    if (error) throw new Error(error.message);
    stats.resolved += rows.length;
  } catch (e) {
    err('resolve:', e.message);
  }
}

/**
 * The arithmetic behind `settlePending`, with the database and the store
 * passed in so it can be exercised on fixtures.
 *
 * Two clocks matter here and only one of them is right. A row carries the time
 * of the candle the trade was placed on, and it is written to the database a
 * minute or more after that candle — so `created_at` is a different instant and
 * always will be. The exit price must come from the trade's OWN candle, found
 * by `bar_time`. An earlier version keyed on a value the database derived from
 * `created_at`, matched nothing, and left every row pending in silence; the
 * tests below exist so that class of mistake fails loudly instead.
 */
function settlementFor(pending, lookup, now) {
  const rows = [];
  for (const row of pending) {
    const barTime = new Date(row.bar_time).getTime();
    const expiresAt = barTime + (row.expiry_seconds || EXPIRY_SECONDS) * 1000;
    if (expiresAt > now) continue; // still running

    const raw = lookup(row.symbol);
    const bar = raw && raw.find((c) => c.t * 1000 === barTime);
    if (!bar) {
      // "No price" is a fourth state. Recording it as a tie would inflate ties
      // and nobody would ever find out why.
      rows.push({ id: row.id, price: null, outcome: null });
      continue;
    }
    rows.push({
      id: row.id,
      price: bar.c,
      outcome: engine.outcomeFor(row.direction, row.entry_price, bar.c).toLowerCase(),
    });
  }
  return rows;
}

/**
 * Settles every row still waiting — the only path that settles anything.
 *
 * Reads the pending rows back with their direction and bar time, finds each
 * trade's own candle in the store, and settles it through `outcomeFor`: the
 * same call, and therefore the same verdict, that decided whether a martingale
 * followed.
 *
 * Reading the rows back rather than remembering them is what makes this
 * correct across a restart, and it is also what makes it correct at all — the
 * version that remembered them matched on a key the database builds from a
 * different clock, and matched nothing.
 *
 * A trade whose candle is no longer in the store is marked `unresolved`. "No
 * price" is a fourth state and must never be recorded as a tie.
 */
async function settlePending() {
  if (!db) return;
  try {
    // Read directly rather than through `pending_signals`: the direction is
    // needed to settle, and the outcome has to come from `outcomeFor` like
    // everywhere else. A row read without its direction could only be settled
    // by a second implementation of the rule.
    const { data, error } = await db
      .from('signals')
      .select('id, symbol, direction, entry_price, bar_time, expiry_seconds')
      .eq('outcome', 'pending')
      .limit(500);
    if (error) throw new Error(error.message);

    const rows = settlementFor(data ?? [], storeFor, Date.now());
    stats.unresolved += rows.filter((r) => r.price === null).length;

    if (rows.length > 0) {
      await resolveNow(rows);
      stats.resolved += rows.length;
    }
  } catch (e) {
    err('sweepStranded:', e.message);
  }
}

// ── Aggregation and retention ───────────────────────────────────────────────

async function rollup() {
  if (!db) return;
  const today = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 2 * 86400_000).toISOString().slice(0, 10);
  try {
    const { error } = await db.rpc('refresh_signal_daily', { p_from: from, p_to: today });
    if (error) throw new Error(error.message);
  } catch (e) {
    err('rollup:', e.message);
  }
}

async function prune() {
  if (!db) return;
  try {
    const { data, error } = await db.rpc('prune_signals', { p_keep_days: KEEP_DAYS });
    if (error) throw new Error(error.message);
    if (data > 0) log(`اتمسح ${data} صف خام أقدم من ${KEEP_DAYS} يوم (التجميع محفوظ)`);
  } catch (e) {
    err('prune:', e.message);
  }
}

// ── Lifecycle ───────────────────────────────────────────────────────────────

function report() {
  log(
    `تقييم ${stats.evaluated} · إشارات ${stats.signals} · مكتوب ${stats.written} · ` +
      `مكرر ${stats.duplicates} · نتايج ${stats.resolved} · بدون سعر ${stats.unresolved} · ` +
      `أزواج متراقبة ${programStates.size}`,
  );
  stats = { evaluated: 0, signals: 0, written: 0, duplicates: 0, resolved: 0, unresolved: 0 };
}

/** Reset the "already alerted" latch when the budget's day rolls over. */
let budgetDay = new Date().toISOString().slice(0, 10);
function rolloverCheck() {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== budgetDay) {
    budgetDay = today;
    cappedToday = false;
  }
}

async function start() {
  if (!ENABLED) {
    log('متوقّف (SIGNAL_GENERATOR=0)');
    return;
  }
  if (!db) {
    err('مفيش SUPABASE_SERVICE_KEY — المولّد مش هيشتغل');
    return;
  }

  // Which engine build is actually running. This file is a compiled copy, so
  // when the numbers look wrong the first question is always whether it is the
  // current one — and the answer belongs in the log, not in a guess.
  log(
    `بيشتغل على ${TIMEFRAME} · إحماء ${WARMUP} شمعة · انتهاء ${EXPIRY_SECONDS}s · ` +
      `بصمة المحرك ${(engine.BUNDLE_SOURCE_HASH || 'غير معروفة').slice(0, 16)}…`,
  );
  await settlePending();

  setInterval(() => { rolloverCheck(); tick(); }, TICK_MS);
  // Write, then settle what is now waiting. In that order: a trade written
  // this minute is settled the next, once its candle is in the store.
  setInterval(() => { void flush().then(() => settlePending()); }, FLUSH_MS);
  setInterval(() => { void rollup(); }, ROLLUP_MS);
  setInterval(() => { void prune(); }, PRUNE_MS);
  setInterval(report, 3600_000);

  // The rollup runs once shortly after boot so the admin page is never looking
  // at an aggregate that stops a day before today.
  setTimeout(() => { void rollup(); }, 30_000);
}

module.exports = {
  start, TIMEFRAME, EXPIRY_SECONDS, PROGRAM,
  // Exposed for the harness in test/: the only way to prove this process
  // reaches the same conclusion as the app is to run its own tick and compare,
  // and a test that reimplements the loop proves nothing about the loop.
  __test: {
    tick,
    buildRow,
    takeBuffer: () => { const b = buffer; buffer = []; return b; },
    // Module state outlives a single run, so a harness that replays twice sees
    // the second pass do nothing at all. Resetting is the harness's job.
    reset: () => { programStates.clear(); buffer = []; },
    settlementFor,
  },
};

// Auto-start, like the other subsystems. A throw in here must never take the
// scraper or the API host down with it.
setTimeout(() => {
  start().catch((e) => err('start:', e.message));
}, 15_000);
