/**
 * The only three things a phone is told, and the guarantee that it hears each
 * of them once.
 *
 * ── THE THREE ──────────────────────────────────────────────────────────────
 *
 *    96   the pair is getting close
 *    98   it is very close — the ‹A11› depth is already there and only the
 *         candle's close is outstanding
 *   100   the signal exists; the trade opens on the next candle
 *
 * Only the last one means a trade. The first two are warnings, and they exist
 * for one reason: a candle can go from nothing to a signal in its final
 * seconds, and a user whose first notification is "a trade just opened" has no
 * idea it was coming.
 *
 * ── A LADDER, NOT A SET OF TRIGGERS ────────────────────────────────────────
 *
 * Each setup climbs. A stage is sent only if it is HIGHER than the highest
 * already sent for that setup, which settles three things at once:
 *
 *   · 96 → 97 → 97.9 sends nothing after the first, however many ticks pass
 *   · a pair that jumps straight past 96 and 98 to a signal sends ONE message,
 *     the one that actually happened — no back-filling the two it skipped
 *   · a reading that falls from 98 back to 96 sends nothing; the ladder does
 *     not go down, and telling somebody "getting close" after "very close" is
 *     a message about the past
 *
 * ── ONCE, THROUGH RESTARTS ─────────────────────────────────────────────────
 *
 * The memory below is enough for polling, duplicate candles and recomputation.
 * It is NOT enough for a restart: this process rebuilds every setup from the
 * candles within a couple of closes, so a redeploy in the middle of an
 * opportunity would announce it a second time.
 *
 * So the claim is durable. `push_alerts` has a primary key on
 * (symbol, setup_key, stage) and the insert either takes the row or loses to
 * the one already there — which is the whole of the deduplication. A database
 * that is unavailable falls back to memory rather than blocking the
 * notification: a duplicate is worse than silence only if it is routine, and
 * this makes it rare rather than impossible.
 *
 * ── WHAT IDENTIFIES A SETUP ────────────────────────────────────────────────
 *
 * The program's own `armed.key`, which is `originTime:endTime` — the two
 * candle times the swing runs between. Derived from the market rather than
 * from this process, so it is the same string before and after a restart, and
 * a genuinely new swing is a genuinely different key. That is what lets a new
 * opportunity on the same pair start a fresh ladder ‹K›.
 */

const NEAR = 96;
const VERY_CLOSE = 98;
const FIRED = 100;

/** The message a stage puts on a lock screen. Short, and never overstated. */
function messageFor(stage, name, percent) {
  if (stage === FIRED) return `🚨 اتفتحت إشارة الآن — ${name}`;
  const pct = percent.toFixed(1);
  return stage === VERY_CLOSE
    ? `قريب جدًا من إصدار إشارة — ${name} — ${pct}%`
    : `إشارة محتملة قريبًا — ${name} — ${pct}%`;
}

/** The title beside it. Only one of the three claims a trade. */
function titleFor(stage, name) {
  return stage === FIRED ? `إشارة بدأت — ${name}` : `فرصة بتقرب — ${name}`;
}

/**
 * Builds the alerter.
 *
 * `claim` and `deliver` are injected so the tests can drive the ladder without
 * a database or a push service, and so a failure in either is this module's
 * problem rather than the caller's.
 *
 * @param claim   (symbol, setupKey, stage) → Promise<boolean>. True if THIS
 *                process won the right to send. False if somebody already did.
 * @param deliver (symbol, stage, title, body) → Promise<void>.
 */
function createAlerts({ claim, deliver, onError }) {
  /** symbol → { key, highest } — the ladder each pair is part-way up. */
  const climbed = new Map();

  /**
   * One pair, one moment.
   *
   * `fired` is not derived from the percentage. 100 belongs to the program
   * returning a signal — a closed candle that satisfied every rule — and a
   * card sitting at 100 because a cycle is open is not that event. Passing it
   * in keeps the two apart.
   */
  async function at({ symbol, name, setupKey, percent, fired = false }) {
    if (!setupKey) {
      // No setup: nothing to be part-way up. The next one starts clean.
      climbed.delete(symbol);
      return null;
    }

    const stage = fired
      ? FIRED
      : percent >= VERY_CLOSE
        ? VERY_CLOSE
        : percent >= NEAR
          ? NEAR
          : 0;
    if (stage === 0) return null;

    let held = climbed.get(symbol);
    if (!held || held.key !== setupKey) {
      held = { key: setupKey, highest: 0 };
      climbed.set(symbol, held);
    }
    if (stage <= held.highest) return null;

    // Raised before the claim resolves, so a slow database cannot let two
    // ticks through the gate at once.
    held.highest = stage;

    let won = true;
    try {
      won = await claim(symbol, setupKey, stage);
    } catch (e) {
      // A durable claim that cannot be made is not a reason to go quiet; the
      // memory above still stops the ordinary repeats.
      if (onError) onError(e);
    }
    if (!won) return null;

    try {
      await deliver(symbol, stage, titleFor(stage, name), messageFor(stage, name, percent));
    } catch (e) {
      if (onError) onError(e);
    }
    return stage;
  }

  /** A setup that ended without firing. The next one starts a fresh ladder. */
  function forget(symbol) {
    climbed.delete(symbol);
  }

  return { at, forget, NEAR, VERY_CLOSE, FIRED, _climbed: climbed };
}

module.exports = { createAlerts, messageFor, titleFor, NEAR, VERY_CLOSE, FIRED };
