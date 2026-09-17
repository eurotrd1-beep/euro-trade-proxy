'use strict';

/**
 * The four pipeline calls, pointed at whichever database owns them.
 *
 * ── WHY A SHIM AND NOT AN EDIT AT EACH CALL SITE ───────────────────────────
 *
 * The four calls are `record_signals`, `resolve_signals`, `refresh_signal_daily`
 * and `prune_signals`. They decide what a trade's outcome is and what the
 * published numbers say, and they are called from four places in
 * `signal-generator.js` that each handle their result differently.
 *
 * Editing four call sites means four chances to change the handling by
 * accident while changing the destination. This presents the SAME shape the
 * Supabase RPC returned — `{ data, error }` — so the call sites keep the
 * result handling they already have, tested, and only the destination moves.
 *
 * ── THE SWITCH IS AN ENVIRONMENT VARIABLE ──────────────────────────────────
 *
 *   DATA_HUB_URL + DATA_HUB_SERVICE_SECRET set  → the hub (D1)
 *   either missing                               → Supabase, as before
 *
 * So rolling back is unsetting a variable and restarting, with no deploy and
 * no code change. That matters more here than anywhere else in the migration:
 * this is the path that records trades, and a bad afternoon on it is a gap in
 * the published record that cannot be filled in afterwards.
 */

const HUB = (process.env.DATA_HUB_URL || '').replace(/\/+$/, '');
const SECRET = process.env.DATA_HUB_SERVICE_SECRET || '';

/** True when the pipeline should go to D1. */
const useHub = () => HUB !== '' && SECRET !== '';

/**
 * One call, in the shape the RPC returned.
 *
 * Errors come back as `{ error }` rather than thrown, because that is what the
 * callers already branch on. A thrown error here would skip their logging and
 * their counters.
 */
async function call(path, body, method) {
  try {
    const res = await fetch(`${HUB}/v1/pipeline/${path}`, {
      method: method || 'POST',
      headers: { 'Content-Type': 'application/json', 'x-service-secret': SECRET },
      body: body === null ? undefined : JSON.stringify(body),
      // A pipeline call that hangs holds up the whole generator tick. Thirty
      // seconds is far longer than any of these take and far shorter than a
      // stuck socket.
      signal: AbortSignal.timeout(30_000),
    });
    const text = await res.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch (_) { /* below */ }
    if (!res.ok) {
      return { data: null, error: { message: `hub ${res.status}: ${(parsed && parsed.error) || text.slice(0, 120)}` } };
    }
    if (parsed === null) {
      return { data: null, error: { message: 'hub returned a non-JSON body' } };
    }
    return { data: parsed, error: null };
  } catch (e) {
    return { data: null, error: { message: e && e.message ? e.message : String(e) } };
  }
}

/**
 * Builds the four calls against `db` (Supabase) or the hub.
 *
 * `db` is still required for the Supabase path, and passing it in rather than
 * importing it keeps this file free of the client setup — it is the same
 * client the rest of the generator already holds.
 */
function createPipeline(db) {
  if (!useHub()) {
    return {
      target: 'supabase',
      pendingSignals: () => db
        .from('signals')
        .select('id, symbol, direction, entry_price, bar_time, expiry_seconds')
        .eq('outcome', 'pending')
        .limit(500),
      recordSignals: (rows) => db.rpc('record_signals', { p_rows: rows }),
      resolveSignals: (rows) => db.rpc('resolve_signals', { p_rows: rows }),
      refreshDaily: (from, to) => db.rpc('refresh_signal_daily', { p_from: from, p_to: to }),
      pruneSignals: (keepDays) => db.rpc('prune_signals', { p_keep_days: keepDays }),
    };
  }

  return {
    target: 'd1',

    /**
     * The signals still waiting to be settled.
     *
     * ── WHY THIS IS HERE AND NOT A DIRECT QUERY ───────────────────────────
     *
     * It was a direct Supabase query, and moving only the WRITES left the
     * settlement pass looking in the wrong database: signals were recorded to
     * D1 and searched for in Supabase, which had none. Every signal stayed
     * `pending` for ever. Nothing errored — the pass ran on schedule, found
     * nothing, and reported nothing, because finding nothing is its normal
     * state most of the time.
     *
     * `bar_ms` is mapped back to `bar_time` so the settlement code above is
     * handed the shape it already expects. That code decides outcomes and is
     * not something to adjust for a storage detail.
     */
    async pendingSignals() {
      const { data, error } = await call(
        'pending',
        null,
        'GET',
      );
      if (error) return { data: null, error };
      const rows = (data.rows || []).map((r) => ({
        id: r.id,
        symbol: r.symbol,
        direction: r.direction,
        entry_price: r.entry_price,
        bar_time: r.bar_ms,
        expiry_seconds: r.expiry_seconds,
      }));
      return { data: rows, error: null };
    },

    /**
     * The RPC returned a one-row TABLE, so the caller reads `data[0]`. The hub
     * returns the object directly, and it is wrapped in an array here so the
     * caller does not have to know which it is talking to.
     */
    async recordSignals(rows) {
      // `bar_time` is a timestamptz for Postgres and `bar_ms` an integer for
      // D1. Converting here rather than at the call site keeps the generator's
      // row-building — which is signal logic — untouched.
      const mapped = rows.map((r) => {
        const out = Object.assign({}, r);
        if (out.bar_time !== undefined) {
          out.bar_ms = typeof out.bar_time === 'number'
            ? out.bar_time
            : Date.parse(out.bar_time);
          delete out.bar_time;
        }
        return out;
      });
      const { data, error } = await call('record', { rows: mapped });
      return { data: data === null ? null : [data], error };
    },

    async resolveSignals(rows) {
      const { data, error } = await call('resolve', { rows });
      // The RPC returned the settled count as a scalar.
      return { data: data === null ? null : data.settled, error };
    },

    async refreshDaily(from, to) {
      const { data, error } = await call('refresh', { from, to });
      return { data: data === null ? null : data.changed, error };
    },

    async pruneSignals(keepDays) {
      const { data, error } = await call('prune', { keep_days: keepDays });
      return { data: data === null ? null : data.deleted, error };
    },
  };
}

module.exports = { createPipeline, useHub };
