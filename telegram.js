/**
 * Telegram — three messages, each sent once, from the server.
 *
 * ── WHY IT LIVES HERE ──────────────────────────────────────────────────────
 *
 * This process runs on Render and never stops. Closing a laptop, closing the
 * admin page, closing the browser changes nothing about what gets sent —
 * which was the first requirement and the reason none of this belongs in the
 * app. The scheduler for the daily summary is a plain interval in the same
 * process, for the same reason.
 *
 * ── THE THREE ──────────────────────────────────────────────────────────────
 *
 *   SIGNAL_OPENED  the program returned a signal and the trade opens on the
 *                  next candle. Not at 96, not at 98 — those stay on the card.
 *   TRADE_RESULT   that trade settled. WIN, LOSS or TIE, from the settlement
 *                  itself rather than from a comparison written here. Which of
 *                  those three go out is the ONE setting that looks at an
 *                  outcome; see `outcomes` below.
 *   DAILY_SUMMARY  once, after the day ends — the day being UTC plus the
 *                  configured offset, so it lands at the operator's midnight
 *                  rather than at Greenwich's.
 *
 * ── ONCE, THROUGH RESTARTS AND CONCURRENCY ─────────────────────────────────
 *
 * Every message carries an event key, and `telegram_alerts` has a primary key
 * on it. The insert either takes the row or loses to the one already there;
 * losing means somebody already sent it. There is no read-then-write, so two
 * ticks in the same instant cannot both get through, and a redeploy mid-trade
 * cannot repeat a message.
 *
 * The key is built from the candle the trade ran on, not from the clock, so it
 * is the same string before and after a restart. Two trades opening in the
 * same second on different pairs have different keys by construction — which
 * is what keeps their results from being confused with each other when they
 * settle together.
 *
 * ── FAILURE IS NOT ALLOWED TO MATTER ───────────────────────────────────────
 *
 * Every entry point returns a promise that resolves, never rejects, and the
 * caller does not await it. Telegram being down, the token being wrong, the
 * database being unreachable — none of it can delay or break a settlement. A
 * failed send releases its claim, so the next tick may retry it; a send that
 * succeeded keeps the claim and is never repeated.
 */

const https = require('node:https');

const API = 'https://api.telegram.org';
/** How long the ON/OFF flag is trusted before being read again. */
const CONFIG_TTL_MS = 30_000;
/** How often the day-rollover check runs. Cheap: one row lookup. */
const DAILY_CHECK_MS = 5 * 60_000;

/** POST to the Bot API. Resolves `{ ok, description }`; never throws. */
function callApi(token, method, payload) {
  return new Promise((resolve) => {
    const body = JSON.stringify(payload);
    const req = https.request(
      `${API}/bot${token}/${method}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        timeout: 15_000,
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => {
          raw += c;
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(raw);
            resolve({ ok: parsed.ok === true, description: parsed.description || '' });
          } catch {
            resolve({ ok: false, description: `HTTP ${res.statusCode}` });
          }
        });
      },
    );
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, description: 'timeout' });
    });
    req.on('error', (e) => resolve({ ok: false, description: e.message }));
    req.end(body);
  });
}

const pad = (n) => String(n).padStart(2, '0');
const hhmm = (ms) => `${pad(new Date(ms).getUTCHours())}:${pad(new Date(ms).getUTCMinutes())}`;
const side = (d) => (d === 'CALL' ? '🟢 شراء CALL' : '🔴 بيع PUT');
const verdict = (r) => (r === 'WIN' ? '✅ ربح' : r === 'LOSS' ? '❌ خسارة' : '➖ تعادل');

function createTelegram({ db, log, err, now = () => Date.now() }) {
  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const chat = (process.env.TELEGRAM_CHAT_ID || '').trim();
  const configured = Boolean(token && chat);

  let enabled = false;
  let minDepthBps = 0;
  let dailyOn = true;
  /** 'both' | 'signals' | 'results' — which KINDS go out, never which outcomes. */
  let publishMode = 'both';
  /**
   * 'all' | 'wins' | 'losses' — the one setting here that reads an outcome.
   *
   * Every other filter is decided before the outcome exists, on purpose: a
   * signal that goes out is a prediction that then stands or falls in public.
   * This one is applied at the result, and the admin says out loud what that
   * costs — with `wins` the channel's record of results is no longer a record,
   * because the losses happened and simply were not written.
   */
  let outcomes = 'all';
  /**
   * Minutes to add to UTC to reach the day the summary is about.
   *
   * Everything else in this system buckets by the UTC day — the rollups, the
   * pruning, the admin's date ranges — and none of that moves. This shifts the
   * SUMMARY alone, because "end of the day" is a claim about the reader's day,
   * and a summary that arrives at 03:00 local has already been overtaken by
   * the next day's trades.
   */
  let summaryOffsetMin = 0;
  let checkedAt = 0;

  /**
   * The ON/OFF switch, from `configs` — server-side so it survives a restart
   * and reads the same from any device.
   *
   * Cached for half a minute: this is consulted on every candle for every pair,
   * and the answer changes when somebody presses a button. A failed read keeps
   * the last known value rather than defaulting either way — flipping to ON on
   * a network blip would send messages nobody asked for, and flipping to OFF
   * would silently stop the ones they did.
   */
  async function isEnabled() {
    if (!configured || !db) return false;
    if (now() - checkedAt < CONFIG_TTL_MS) return enabled;
    checkedAt = now();
    try {
      const { data, error } = await db
        .from('configs')
        .select('data')
        .eq('id', 'telegram')
        .maybeSingle();
      if (error) throw new Error(error.message);
      enabled = data?.data?.enabled === true;
      const raw = Number(data?.data?.minDepthBps);
      minDepthBps = Number.isFinite(raw) && raw > 0 ? raw : 0;
      // Absent means on: the summary predates this switch, and a missing field
      // should not silently stop something that was already running.
      dailyOn = data?.data?.daily !== false;
      const mode = data?.data?.publish;
      publishMode = mode === 'signals' || mode === 'results' ? mode : 'both';
      // Absent means every result, which is what this did before the setting
      // existed. Only the two words are honoured — a typo publishes normally
      // rather than silencing the channel.
      const oc = data?.data?.outcomes;
      outcomes = oc === 'wins' || oc === 'losses' ? oc : 'all';
      // Clamped to real offsets. A stray number here would not fail loudly —
      // it would quietly summarise a window nobody asked for.
      const off = Number(data?.data?.summaryOffsetMinutes);
      summaryOffsetMin = Number.isFinite(off) ? Math.max(-840, Math.min(840, Math.trunc(off))) : 0;
    } catch (e) {
      err('telegram config:', e.message);
    }
    return enabled;
  }

  /**
   * Claims an event key. True if THIS process won the right to send it.
   *
   * Without a database there is nothing durable to claim against, and the
   * honest choice is to send: a missing dedup store should not mean silence.
   */
  async function claim(eventKey, kind) {
    if (!db) return true;
    const { error } = await db.from('telegram_alerts').insert({ event_key: eventKey, kind });
    if (error && error.code === '23505') return false; // already sent
    if (error) throw new Error(error.message);
    return true;
  }

  /** Releases a claim so a failed send can be retried on a later tick. */
  async function release(eventKey) {
    if (!db) return;
    try {
      await db.from('telegram_alerts').delete().eq('event_key', eventKey);
    } catch (e) {
      err('telegram release:', e.message);
    }
  }

  /**
   * Claim, send, and give the claim back if the send failed.
   *
   * The order matters. Claiming first is what makes concurrent ticks safe;
   * releasing on failure is what makes a Telegram outage recoverable instead
   * of permanently swallowing a message.
   */
  async function send(eventKey, kind, text) {
    try {
      if (!(await isEnabled())) return false;
      if (!(await claim(eventKey, kind))) return false;

      const r = await callApi(token, 'sendMessage', {
        chat_id: chat,
        text,
        disable_web_page_preview: true,
      });
      if (!r.ok) {
        await release(eventKey);
        err(`telegram ${kind}:`, r.description);
        return false;
      }
      log(`تيليجرام ${kind} · ${eventKey}`);
      return true;
    } catch (e) {
      err('telegram:', e.message);
      return false;
    }
  }

  // ── The three ────────────────────────────────────────────────────────────

  /**
   * A trade just opened. One message per trade, however many open at once.
   *
   * `entryTime` is the candle the trade runs on, which is what makes the key
   * unique per trade and stable across a restart.
   */
  async function signalOpened({
    symbol, name, direction, stage, entryTime, level, durationMinutes, depthBps,
  }) {
    // ── The publishing bar ───────────────────────────────────────────────
    //
    // Chosen BEFORE the outcome exists. That is the whole point of doing it
    // here rather than at the result: every signal that goes out is a real
    // prediction that then stands or falls in public, so a channel filtered
    // this way has a higher win rate because it took better trades — not
    // because the record was edited afterwards.
    //
    // The depth is the strategy's own ‹A11› figure, carried on the signal, so
    // this ranks by the same number the engine measured.
    //
    // A martingale carries no depth of its own; it follows the trade before it,
    // and if that one was published this one belongs with it.
    // `isEnabled` is what loads the config, so it has to run before the bar is
    // read — otherwise the very first signal after a restart is judged against
    // a threshold of zero and goes out regardless of the setting.
    if (!(await isEnabled())) return false;
    if (minDepthBps > 0 && stage === 'primary') {
      if (!Number.isFinite(depthBps) || depthBps < minDepthBps) return false;
    }

    // ── Eligibility is recorded whatever the mode is ─────────────────────
    //
    // It says "this trade cleared the bar", and it is written the moment the
    // trade opens — before any outcome exists. The result later checks for it,
    // so a channel set to results-only still reports the results of the trades
    // it WOULD have announced rather than an arbitrary subset.
    //
    // Separate from the `signal:` key because the two answer different
    // questions: one is "was it worth publishing", the other is "was it".
    try {
      await claim(`elig:${symbol}:${entryTime}:${stage}`, 'eligible');
    } catch (e) {
      err('telegram eligibility:', e.message);
    }

    // The mode picks which KINDS of message go out. It never looks at an
    // outcome, and it cannot: at this point there is not one.
    if (publishMode === 'results') return false;

    const key = `signal:${symbol}:${entryTime}:${stage}`;
    const lines = [
      `🚨 اتفتحت إشارة — ${name}`,
      `${side(direction)}`,
      `الدخول: شمعة ${hhmm(entryTime)} UTC`,
      `المدة: ${durationMinutes} دقيقة`,
    ];
    if (typeof level === 'number' && Number.isFinite(level)) {
      lines.push(`المستوى: ${level.toFixed(level >= 50 ? 3 : 5)}`);
    }
    if (stage === 'martingale') lines.push('مضاعفة تعويض');
    return send(key, 'signal', lines.join('\n'));
  }

  /**
   * That trade settled. Tied to the same trade by the same key parts, so the
   * result of one pair can never be attached to another's.
   */
  /** Did this trade clear the bar when it opened? One indexed lookup. */
  async function wasEligible(symbol, entryTime, stage) {
    if (!db) return true;
    try {
      const { data, error } = await db
        .from('telegram_alerts')
        .select('event_key')
        .eq('event_key', `elig:${symbol}:${entryTime}:${stage}`)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data != null;
    } catch (e) {
      err('telegram lookup:', e.message);
      // Unknown: say nothing rather than post a result for a trade the channel
      // never called. A missing result is a gap; an orphan result is a claim
      // about a trade nobody was told to take.
      return false;
    }
  }

  async function tradeResult({
    symbol, name, direction, stage, entryTime, result, entryPrice, exitPrice,
  }) {
    if (!(await isEnabled())) return false;
    if (publishMode === 'signals') return false;

    // ── The outcome filter ───────────────────────────────────────────────
    //
    // Read before the eligibility lookup only because it is free and that is
    // a round trip to the database; the order carries no meaning beyond that.
    //
    // A TIE passes neither `wins` nor `losses`. It is not a win, and folding
    // it into one would make "الفوز بس" mean something other than its name —
    // the reader would count a returned stake as a call that came off.
    //
    // Nothing is claimed on this path, so a filtered result does not burn its
    // event key. It cannot come back either — a trade settles once — but a key
    // marked "sent" for a message that was never sent is a lie in the table.
    if (outcomes !== 'all') {
      if (outcomes === 'wins' && result !== 'WIN') return false;
      if (outcomes === 'losses' && result !== 'LOSS') return false;
    }

    // Only for a trade that cleared the bar when it opened. Otherwise a
    // filtered channel would report trades it never called.
    if (!(await wasEligible(symbol, entryTime, stage))) return false;

    const key = `result:${symbol}:${entryTime}:${stage}`;
    const dp = entryPrice >= 50 ? 3 : 5;
    const lines = [
      `${verdict(result)} — ${name}`,
      `${side(direction)}${stage === 'martingale' ? ' · مضاعفة' : ''}`,
      `دخول: ${entryPrice.toFixed(dp)} · إغلاق: ${exitPrice.toFixed(dp)}`,
      `الشمعة: ${hhmm(entryTime)} UTC`,
    ];
    return send(key, 'result', lines.join('\n'));
  }

  /**
   * The day's tally, once, after it ends.
   *
   * Counted from the rows the trades actually wrote — a signal that never
   * opened has no row and is not in the numbers. Deduplicated by (symbol,
   * candle) because the generator writes one row per plan and both plans run
   * the same program, so a trade appears more than once.
   */
  async function dailySummary(day) {
    const key = `daily:${day}`;
    try {
      if (!(await isEnabled())) return false;
      if (!dailyOn) return false;
      if (!db) return false;

      // The 24 hours that make up `day` in the configured zone, expressed in
      // UTC because that is what `bar_time` is stored in. At offset zero this
      // is exactly the old `T00:00:00Z` … `T23:59:59.999Z` pair; at +3 it is
      // the window that ends at the operator's midnight instead of Greenwich's.
      const startUtc = Date.parse(`${day}T00:00:00Z`) - summaryOffsetMin * 60_000;
      const from = new Date(startUtc).toISOString();
      const to = new Date(startUtc + 24 * 3600_000 - 1).toISOString();
      const { data, error } = await db
        .from('signals')
        .select('symbol, bar_time, outcome')
        .eq('timeframe', '1m')
        .gte('bar_time', from)
        .lte('bar_time', to)
        .limit(20_000);
      if (error) throw new Error(error.message);

      const seen = new Set();
      let win = 0;
      let loss = 0;
      let draw = 0;
      let open = 0;
      for (const row of data ?? []) {
        const id = `${row.symbol}@${row.bar_time}`;
        if (seen.has(id)) continue;
        seen.add(id);
        open++;
        if (row.outcome === 'win') win++;
        else if (row.outcome === 'loss') loss++;
        else if (row.outcome === 'tie') draw++;
      }

      const decided = win + loss;
      const rate = decided > 0 ? ((100 * win) / decided).toFixed(1) : '—';
      // Named when it is not UTC. The rest of the system counts UTC days — the
      // admin's ranges, the rollups — so a summary over a different window has
      // to say so, or the first person to compare the two numbers concludes
      // one of them is broken.
      const text = [
        `📊 ملخص ${day}${summaryOffsetMin === 0 ? '' : ` (بتوقيت ${zoneLabel()})`}`,
        `الصفقات اللي اتفتحت: ${open}`,
        `✅ ربح: ${win}`,
        `❌ خسارة: ${loss}`,
        `➖ تعادل: ${draw}`,
        `نسبة الفوز: ${rate}${decided > 0 ? '%' : ''}${decided > 0 ? ` (من ${decided} محسومة)` : ''}`,
      ].join('\n');

      if (!(await claim(key, 'daily'))) return false;
      const r = await callApi(token, 'sendMessage', {
        chat_id: chat,
        text,
        disable_web_page_preview: true,
      });
      if (!r.ok) {
        await release(key);
        err('telegram daily:', r.description);
        return false;
      }
      log(`تيليجرام ملخص ${day}`);
      return true;
    } catch (e) {
      err('telegram daily:', e.message);
      return false;
    }
  }

  /** `UTC+3`, `UTC-4:30`, for a summary that is not about a UTC day. */
  function zoneLabel() {
    const sign = summaryOffsetMin < 0 ? '-' : '+';
    const abs = Math.abs(summaryOffsetMin);
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    return `UTC${sign}${h}${m === 0 ? '' : `:${pad(m)}`}`;
  }

  /**
   * The day that just ended, as `YYYY-MM-DD` in the configured zone.
   *
   * Shifting the clock before taking the date is the whole trick: at 21:05 UTC
   * with a +3 offset it is already tomorrow for the reader, so the day that
   * just ended is today's date — and three hours later, at 00:05 UTC, it is
   * still that same date, so the check that runs then finds the key claimed
   * and does nothing. One summary per day, at the reader's midnight.
   */
  function previousDay() {
    return new Date(now() + summaryOffsetMin * 60_000 - 24 * 3600_000)
      .toISOString()
      .slice(0, 10);
  }

  /**
   * Watches for the day to roll over.
   *
   * A plain interval rather than a cron: this process is always running, and
   * the claim makes a repeated check free. It runs every five minutes, so the
   * summary lands within five minutes of midnight in the configured zone — and
   * if the service was asleep or redeploying then, the next check after it
   * comes back still sends it, because the key is the DATE and not the moment.
   */
  function startScheduler() {
    if (!configured) return null;
    // The config is read FIRST, because the offset decides which day this even
    // is. Without it the first check after a restart asks about the UTC day
    // and claims that key — and the day the reader is waiting for never comes.
    // `isEnabled` caches for half a minute, so at a five-minute cadence this
    // is one extra row read per check.
    const tick = async () => {
      await isEnabled();
      await dailySummary(previousDay());
    };
    void tick();
    return setInterval(() => { void tick(); }, DAILY_CHECK_MS);
  }

  return {
    configured,
    isEnabled,
    signalOpened,
    tradeResult,
    dailySummary,
    startScheduler,
    previousDay,
    /** Exposed for the harness only. */
    __test: { claim, release, send, callApi },
  };
}

module.exports = { createTelegram };
