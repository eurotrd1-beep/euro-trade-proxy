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
 * ── THE CONSTRAINTS THAT SHAPED IT ─────────────────────────────────────────
 *
 * READS NOTHING FROM SUPABASE IN STEADY STATE. Candles come from the scraper's
 * in-memory store (`global.otcClient.store.candles`) and prices from
 * `global.otcPrices`, both of which this process already maintains. A 30s poll
 * of candle rows once burned 5.6GB of egress in two days; that mistake is not
 * repeated. The only reads are: a 4-row hash check every 5 minutes (~400 bytes,
 * and the full strategy JSON only when a hash actually changes), and ONE query
 * at boot to recover signals left pending by a restart.
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
 * 15m, and not for cost.
 *
 * A 15m window spans all 24 hours, so clock-dependent indicators (kill_zone,
 * session, judas_swing…) are judged against a full day. 5m candles from this
 * feed span about 8 hours — an indicator scored on that is scored on one
 * session and the number means nothing. That mistake has already been made
 * once here, on a three-hour window.
 */
const TIMEFRAME = '15m';
const STEP_SECONDS = 900;

/** Candles the engine needs before its indicators are meaningful. */
const WARMUP = 55;

/** How long a trade runs. One candle, matching the backtester's default. */
const EXPIRY_SECONDS = STEP_SECONDS;

const SLOTS = ['instant_free', 'instant_paid', 'monitoring_free', 'monitoring_paid'];

const TICK_MS = 20_000;          // how often we look for a newly closed candle
const FLUSH_MS = 60_000;         // how often the buffer is written
const VERSION_POLL_MS = 300_000; // hash-only check for a new strategy version
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

/** slot → { id, versionNumber, hash, strategy } */
const active = new Map();
/** `${slot}|${symbol}` → bar_time seconds already evaluated, so a restart or a
 *  slow tick never scores the same candle twice. */
const lastBar = new Map();
/** Rows waiting to be written. */
let buffer = [];
/** id → { symbol, entryPrice, expiresAt } — what is waiting for a price. */
const pending = new Map();

let cappedToday = false;
let stats = { evaluated: 0, signals: 0, written: 0, duplicates: 0, resolved: 0, unresolved: 0 };

// ── Strategy versions ───────────────────────────────────────────────────────

/**
 * Cheap by design: reads four short columns, and only pulls the full strategy
 * JSON for a slot whose hash actually moved. A version changes maybe weekly, so
 * this is a few hundred bytes every five minutes.
 */
async function refreshVersions() {
  if (!db) return;
  try {
    const { data, error } = await db
      .from('strategy_versions')
      .select('id, slot, version_number, json_hash')
      .eq('is_active', true);
    if (error) throw new Error(error.message);

    for (const row of data ?? []) {
      const current = active.get(row.slot);
      if (current && current.hash === row.json_hash) continue;

      const { data: full, error: e2 } = await db
        .from('strategy_versions')
        .select('strategy_json')
        .eq('id', row.id)
        .single();
      if (e2) throw new Error(e2.message);

      const parsed = parseStrategy(full.strategy_json);
      if (!parsed) {
        err(`slot ${row.slot} نسخة ${row.version_number}: قواعد غير صالحة — اتجاهلت`);
        continue;
      }
      active.set(row.slot, {
        id: row.id,
        versionNumber: row.version_number,
        hash: row.json_hash,
        strategy: parsed,
      });
      // A slot that changed strategy must not inherit the old one's cooldown.
      for (const key of [...lastBar.keys()]) {
        if (key.startsWith(`${row.slot}|`)) lastBar.delete(key);
      }
      log(`slot ${row.slot} → نسخة ${row.version_number} (${parsed.rules.length} قاعدة)`);
    }

    // A slot whose version was deactivated stops producing. It does NOT fall
    // back to the previous one: a signal attributed to a version that is no
    // longer live is a lie in the statistics.
    const live = new Set((data ?? []).map((r) => r.slot));
    for (const slot of [...active.keys()]) {
      if (!live.has(slot)) {
        active.delete(slot);
        log(`slot ${slot} مالوش نسخة نشطة — التوليد وقف`);
      }
    }
  } catch (e) {
    err('refreshVersions:', e.message);
  }
}

function parseStrategy(json) {
  if (!json || !Array.isArray(json.rules)) return null;
  const rules = json.rules
    .filter((r) => r && typeof r.indicator === 'string')
    .map((r) => engine.ruleFromJson(r));
  if (rules.length === 0) return null;
  return {
    name: typeof json.name === 'string' ? json.name : 'Untitled',
    minScore: Number(json.min_score) || 0,
    maxScore: Number(json.max_score) || 0,
    confidenceBase: Number(json.confidence_base) || 92.5,
    confidenceMax: Number(json.confidence_max) || 98.9,
    pyramid: json.pyramid ? engine.pyramidFromJson(json.pyramid) : null,
    rules,
  };
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

function tick() {
  if (active.size === 0) return;

  const nowSec = Math.floor(Date.now() / 1000);
  // The last CLOSED bar. The newest element of the store is still forming, and
  // scoring a half-built candle produces a signal that disagrees with itself
  // fifteen minutes later.
  const closedAt = Math.floor(nowSec / STEP_SECONDS) * STEP_SECONDS - STEP_SECONDS;

  for (const symbol of enabledSymbols()) {
    const raw = storeFor(symbol);
    if (!raw || raw.length < WARMUP + 2) continue;

    const idx = raw.findIndex((c) => c.t === closedAt);
    if (idx < WARMUP) continue;

    // Only the bars up to and including the closed one. Nothing after it exists
    // as far as this evaluation is concerned.
    const window = raw.slice(0, idx + 1).map(toEngine);
    const current = window[window.length - 1];
    const clock = clockFor(current.time);

    for (const [slot, version] of active) {
      const key = `${slot}|${symbol}`;
      if (lastBar.get(key) === closedAt) continue;
      lastBar.set(key, closedAt);
      stats.evaluated++;

      let pro;
      try {
        // One cache per (symbol, bar) shared across slots: two strategies
        // asking for rsi(14) on the same window get one computation.
        pro = engine.evaluateStrategyPro(version.strategy, {
          candles: window,
          currentPrice: current.close,
          clock,
          cache: new Map(),
        });
      } catch (e) {
        err(`${symbol} ${slot}:`, e.message);
        continue;
      }
      if (pro.result !== 'SIGNAL' || !pro.direction) continue;

      stats.signals++;
      buffer.push(buildRow(symbol, slot, version, pro, window, closedAt));
    }
  }
}

/** Dart's clock convention: UTC hour, but LOCAL weekday (Mon=1 … Sun=7). */
function clockFor(ms) {
  const d = new Date(ms);
  const jsDay = d.getDay();
  return { utcHour: d.getUTCHours(), weekday: jsDay === 0 ? 7 : jsDay };
}

function buildRow(symbol, slot, version, pro, window, barTime) {
  const current = window[window.length - 1];

  // Which rules were true, and what they read. This is what makes a losing
  // signal diagnosable six weeks later instead of just a red row.
  const matched = [];
  for (const rule of version.strategy.rules) {
    if (!rule.enabled) continue;
    try {
      const value = engine.computeIndicator(window, rule, current.close, clockFor(current.time), new Map());
      matched.push({
        i: rule.indicator,
        r: rule.role || 'base',
        v: typeof value === 'number' ? Number(value.toFixed(6)) : value,
        ok: engine.checkCondition(rule, value === undefined ? 0 : value),
      });
    } catch {
      matched.push({ i: rule.indicator, r: rule.role || 'base', v: null, ok: false });
    }
  }

  // Five candles as flat numbers, not objects: [o,h,l,c,t] × 5.
  const snapshot = [];
  for (const c of window.slice(-5)) {
    snapshot.push(c.open, c.high, c.low, c.close, Math.floor(c.time / 1000));
  }

  const winning = pro.direction === 'CALL' ? pro.finalScore.CALL : pro.finalScore.PUT;

  return {
    symbol,
    timeframe: TIMEFRAME,
    direction: pro.direction,
    bar_time: new Date(barTime * 1000).toISOString(),
    strategy_version_id: version.id,
    slot,
    // Same formula the app shows the user, from the same function.
    confidence: Number(
      engine
        .confidenceFor(
          Math.abs(winning),
          version.strategy.confidenceBase,
          version.strategy.confidenceMax,
        )
        .toFixed(2),
    ),
    score: Number(winning.toFixed(3)),
    rules_matched: matched,
    candle_snapshot: snapshot,
    entry_price: current.close,
    expiry_seconds: EXPIRY_SECONDS,
    // The generator never forces an outcome. `forced` exists for the admin's
    // guaranteed_win path, which lives on the client and is not recorded here.
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

    for (const row of r.ids ?? []) {
      pending.set(row.id, {
        symbol: row.symbol,
        entryPrice: row.entry_price,
        expiresAt: new Date(row.expires_at).getTime(),
      });
    }
  } catch (e) {
    err('flush:', e.message);
    // Put them back — a failed write must not silently lose signals. Capped at
    // a few thousand so a long outage cannot grow the heap without bound.
    buffer = batch.concat(buffer).slice(-5000);
  }
}

// ── Settling ────────────────────────────────────────────────────────────────

/**
 * The price at expiry, or null. Null is a real answer here.
 *
 * `global.otcPrices` is the scraper's own snapshot, refreshed about every
 * 700ms. A reading that is stale, or for a market the feed says is closed, is
 * not a price — and inventing one would put a fabricated number into the
 * statistics, which is the one thing this whole exercise exists to avoid.
 */
function priceFor(symbol) {
  const snap = global.otcPrices && global.otcPrices[symbol];
  if (!snap || typeof snap.p !== 'number' || snap.p <= 0) return null;
  if (snap.st !== 'live') return null;
  if (typeof snap.t === 'number' && Date.now() - snap.t * 1000 > PRICE_MAX_AGE_MS) return null;
  return snap.p;
}

async function settle() {
  if (!db || pending.size === 0) return;

  const now = Date.now();
  const rows = [];
  for (const [id, p] of pending) {
    if (p.expiresAt > now) continue;
    const price = priceFor(p.symbol);
    rows.push({ id, price });
    pending.delete(id);
    if (price === null) stats.unresolved++;
    else stats.resolved++;
  }
  if (rows.length === 0) return;

  try {
    const { error } = await db.rpc('resolve_signals', { p_rows: rows });
    if (error) throw new Error(error.message);
  } catch (e) {
    err('settle:', e.message);
    // Back into the map so the next pass retries. The price is read again then,
    // which is correct: a later reading is no less valid than this one.
    for (const r of rows) {
      if (!pending.has(r.id)) {
        pending.set(r.id, { symbol: '', entryPrice: 0, expiresAt: 0 });
      }
    }
  }
}

/** One read, at boot, so a restart does not strand rows as pending forever. */
async function recoverPending() {
  if (!db) return;
  try {
    const { data, error } = await db.rpc('pending_signals');
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      pending.set(row.id, {
        symbol: row.symbol,
        entryPrice: row.entry_price,
        expiresAt: new Date(row.expires_at).getTime(),
      });
    }
    if (pending.size > 0) log(`استرجعت ${pending.size} إشارة معلّقة بعد إعادة التشغيل`);
  } catch (e) {
    err('recoverPending:', e.message);
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
      `معلّق ${pending.size}`,
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

  log(`بيشتغل على ${TIMEFRAME} · إحماء ${WARMUP} شمعة · انتهاء ${EXPIRY_SECONDS}s`);
  await refreshVersions();
  await recoverPending();

  setInterval(() => { rolloverCheck(); tick(); }, TICK_MS);
  setInterval(() => { void flush(); void settle(); }, FLUSH_MS);
  setInterval(() => { void refreshVersions(); }, VERSION_POLL_MS);
  setInterval(() => { void rollup(); }, ROLLUP_MS);
  setInterval(() => { void prune(); }, PRUNE_MS);
  setInterval(report, 3600_000);

  // The rollup runs once shortly after boot so the admin page is never looking
  // at an aggregate that stops a day before today.
  setTimeout(() => { void rollup(); }, 30_000);
}

module.exports = { start, TIMEFRAME, EXPIRY_SECONDS };

// Auto-start, like the other subsystems. A throw in here must never take the
// scraper or the API host down with it.
setTimeout(() => {
  start().catch((e) => err('start:', e.message));
}, 15_000);
