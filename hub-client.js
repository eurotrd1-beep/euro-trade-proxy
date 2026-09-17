'use strict';

/**
 * The tables, through the data hub instead of Supabase.
 *
 * ── WHY IT IMITATES THE SUPABASE CLIENT ────────────────────────────────────
 *
 * Because the alternative is editing thirty-three call sites across four files
 * during a database migration, and thirty-three edits is thirty-three chances
 * to change a filter by accident. A `.eq()` that quietly became a `.neq()` in
 * the middle of a data move is a bug nobody would think to look for, because
 * the move is what everyone would be watching.
 *
 * So the call sites keep the shape they have. `db.from('candles').upsert(row)`
 * reads the same whether it reaches Postgres or D1, and which one it reaches is
 * a variable rather than a diff.
 *
 * ── THE ROLLBACK ───────────────────────────────────────────────────────────
 *
 * `DATA_HUB_TABLES` names the tables that go to the hub:
 *
 *     DATA_HUB_TABLES=telegram_alerts,captcha_stats   just those two
 *     DATA_HUB_TABLES=all                             every table below
 *     (unset)                                         Supabase, as before
 *
 * Per table on purpose. The candle path writes tens of thousands of rows a day
 * and everything else writes a handful, so they carry completely different
 * risk and should not be forced to move on the same afternoon. And when
 * something does go wrong, the lever is one variable and a restart — no deploy,
 * no code change, and it can be pulled for one table without dragging back the
 * five that were fine.
 *
 * ── WHAT IT TRANSLATES, AND WHY EACH ONE MATTERS ───────────────────────────
 *
 * SQLite is not Postgres, and each difference fails silently rather than
 * loudly, which is why they are handled here and not left to call sites:
 *
 *   renamed columns   `updated_at` is `updated_ms`. Asking for a column that
 *                     does not exist is a 400 on a filter and an `undefined`
 *                     on a read — and `undefined` is not an error.
 *   times             ISO strings become integers. Comparing an integer column
 *                     to '2026-…' in SQLite compares across storage classes:
 *                     every integer sorts below every string, so a range is
 *                     either empty or everything, and never says so.
 *   booleans          `enabled = true` against a column holding 1 matches
 *                     nothing, and "no enabled pairs" reads as a fact.
 *   json              `jsonb` is TEXT here. A candle array read back as a
 *                     string is not an array, and `.length` on it is a
 *                     character count that happens to be a number.
 */

const HUB = (process.env.DATA_HUB_URL || '').replace(/\/+$/, '');
const SECRET = process.env.DATA_HUB_SERVICE_SECRET || '';

/**
 * Columns SQLite spells differently, per table.
 *
 * Only renames. A column whose TYPE changed keeps its name, so the caller still
 * finds it — a renamed one is the case where nothing lines up and nothing
 * complains.
 */
const ALIASES = {
  candles:            { updated_at: 'updated_ms' },
  price_snapshot:     { updated_at: 'updated_ms' },
  otc_pairs:          { created_at: 'created_ms', updated_at: 'updated_ms' },
  push_subscriptions: { created_at: 'created_ms', updated_at: 'updated_ms' },
  telegram_alerts:    { sent_at: 'sent_ms' },
  captcha_stats:      { ts: 'ts_ms' },
  repair_log:         { at: 'at_ms', created_at: 'created_ms' },
  signals:            { created_at: 'created_ms', bar_time: 'bar_ms', outcome_at: 'outcome_ms' },
};

/** Columns declared `CHECK (json_valid(...))` in the D1 schema. */
const JSON_COLUMNS = {
  candles:            ['data'],
  price_snapshot:     ['data'],
  configs:            ['data'],
  clicks:             ['data'],
  push_subscriptions: ['subscription', 'symbols'],
};

/**
 * How many values one IN list may carry.
 *
 * The hub refuses a longer list rather than truncating it, so a caller passing
 * more has to be split rather than trimmed — trimming would read some of the
 * keys asked for and look like all of them. `_chunk` below does the splitting,
 * so call sites keep passing whatever list they have.
 */
const MAX_IN = 80;

/** How many rows one write request may carry. Matches the hub's own cap. */
const MAX_ROWS = 250;

const aliasOut = (table, column) => (ALIASES[table] && ALIASES[table][column]) || column;

/** The Postgres name for a column D1 spells differently. */
function aliasIn(table, column) {
  const map = ALIASES[table];
  if (!map) return column;
  for (const key of Object.keys(map)) if (map[key] === column) return key;
  return column;
}

/** A value on its way INTO D1, in the storage class the column uses. */
function outValue(table, column, value) {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value === null || value === undefined) return value;

  const stored = aliasOut(table, column);
  if (stored.endsWith('_ms') && typeof value !== 'number') {
    const ms = Date.parse(String(value));
    if (Number.isFinite(ms)) return ms;
  }

  const json = JSON_COLUMNS[table];
  if (json && json.indexOf(column) !== -1 && typeof value !== 'string') {
    return JSON.stringify(value);
  }
  return value;
}

/** A whole row on its way into D1. */
function outRow(table, row) {
  const out = {};
  for (const key of Object.keys(row)) {
    out[aliasOut(table, key)] = outValue(table, key, row[key]);
  }
  return out;
}

/** A row coming back, restored to the shape the call sites expect. */
function inRow(table, row) {
  const out = {};
  for (const key of Object.keys(row)) {
    const name = aliasIn(table, key);
    let value = row[key];

    // `*_ms` back to the ISO string Postgres held, so a caller comparing or
    // printing a timestamp sees what it has always seen.
    if (name !== key && key.endsWith('_ms') && typeof value === 'number') {
      value = new Date(value).toISOString();
    }

    const json = JSON_COLUMNS[table];
    if (json && json.indexOf(name) !== -1 && typeof value === 'string') {
      try {
        value = JSON.parse(value);
      } catch (_) {
        // Left as the string. The CHECK constraint makes this all but
        // impossible, and nulling it would destroy the row on the next save.
      }
    }
    out[name] = value;
  }
  return out;
}

/** Splits a list into pieces no larger than `size`. */
function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

const fail = (e) => ({ data: null, error: { message: e instanceof Error ? e.message : String(e) } });

async function request(path, init) {
  const res = await fetch(`${HUB}${path}`, {
    ...init,
    headers: { 'x-service-secret': SECRET, ...(init && init.headers) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = (body && body.error) || `${res.status}`;
    throw new Error(`hub ${res.status}: ${detail}`);
  }
  return body;
}

// ── The chain ───────────────────────────────────────────────────────────────

/**
 * A read, built up the way the Supabase builder is.
 *
 * `then` is what makes it awaitable without `.run()`, so the call sites that
 * write `await db.from(t).select(c).eq(a, b)` keep working unchanged.
 */
class Read {
  constructor(table, columns) {
    this.table = table;
    this.columns = columns;
    this.filters = [];
    this.rowLimit = null;
    // `_single`, not `single`: the field would otherwise shadow the method of
    // the same name on the prototype, and `.single()` becomes "false is not a
    // function" at the first config read. Caught by running the client against
    // the real database rather than a mock, which would have agreed with it.
    this._single = false;
  }

  eq(column, value) { this.filters.push({ column, value }); return this; }
  in(column, values) { this.filters.push({ column, values: values.slice() }); return this; }
  limit(n) { this.rowLimit = n; return this; }

  /**
   * One row or null.
   *
   * `.single()` in Supabase errors when there is no row and `.maybeSingle()`
   * does not. Every call site here reads `data` and ignores that distinction —
   * `const { data } = await …single()` followed by `data && data.data` — so
   * both behave as maybeSingle. Erroring instead would turn "no config row yet"
   * into a thrown exception on a path that currently handles it as a default.
   */
  single() { this._single = true; this.rowLimit = 1; return this; }
  maybeSingle() { return this.single(); }

  async run() {
    try {
      // An IN list longer than the hub's cap is split into several requests
      // and the rows concatenated. Truncating would answer with some of the
      // keys and no indication that the rest were dropped.
      const wide = this.filters.find((f) => f.values && f.values.length > MAX_IN);
      if (wide) {
        const rest = this.filters.filter((f) => f !== wide);
        const rows = [];
        for (const piece of chunk(wide.values, MAX_IN)) {
          const part = new Read(this.table, this.columns);
          part.filters = rest.concat([{ column: wide.column, values: piece }]);
          part.rowLimit = this.rowLimit;
          part._single = false;
          const { data, error } = await part.run();
          if (error) return { data: null, error };
          rows.push(...data);
        }
        return { data: rows, error: null };
      }

      const params = new URLSearchParams();
      if (this.columns && this.columns !== '*') {
        params.set('cols', this.columns.split(',')
          .map((c) => aliasOut(this.table, c.trim())).join(','));
      }
      for (const f of this.filters) {
        const column = aliasOut(this.table, f.column);
        if (f.values) {
          params.append('in', `${column}:${f.values.map((v) => outValue(this.table, f.column, v)).join(',')}`);
        } else {
          params.append('eq', `${column}:${outValue(this.table, f.column, f.value)}`);
        }
      }
      if (this.rowLimit !== null) params.set('limit', String(this.rowLimit));

      const body = await request(`/v1/${this.table}?${params}`, { method: 'GET' });
      const rows = (body.rows || []).map((r) => inRow(this.table, r));
      return { data: this._single ? (rows[0] || null) : rows, error: null };
    } catch (e) {
      return fail(e);
    }
  }

  then(resolve, reject) { return this.run().then(resolve, reject); }
}

/** An UPDATE or DELETE, waiting for the rows it applies to. */
class Write {
  constructor(table, op, values) {
    this.table = table;
    this.op = op;
    this.values = values;
    this.filters = [];
  }

  eq(column, value) { this.filters.push({ column, value }); return this; }
  in(column, values) { this.filters.push({ column, values: values.slice() }); return this; }

  async run() {
    try {
      if (this.filters.length === 0) {
        // The hub refuses this too. Refusing here as well means the call site
        // gets an error it can read without a round trip, and it names the
        // table — an UPDATE or DELETE with no WHERE is the whole table, it is
        // a legal statement, and it reports success.
        throw new Error(`${this.op} on '${this.table}' with no filter`);
      }

      const wide = this.filters.find((f) => f.values && f.values.length > MAX_IN);
      if (wide) {
        const rest = this.filters.filter((f) => f !== wide);
        for (const piece of chunk(wide.values, MAX_IN)) {
          const part = new Write(this.table, this.op, this.values);
          part.filters = rest.concat([{ column: wide.column, values: piece }]);
          const { error } = await part.run();
          if (error) return { data: null, error };
        }
        return { data: null, error: null };
      }

      const where = this.filters.map((f) => (f.values
        ? {
            column: aliasOut(this.table, f.column),
            values: f.values.map((v) => outValue(this.table, f.column, v)),
          }
        : {
            column: aliasOut(this.table, f.column),
            value: outValue(this.table, f.column, f.value),
          }));

      await request(`/v1/${this.table}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          op: this.op,
          values: outRow(this.table, this.values || {}),
          where,
        }),
      });
      return { data: null, error: null };
    } catch (e) {
      return fail(e);
    }
  }

  then(resolve, reject) { return this.run().then(resolve, reject); }
}

class Table {
  constructor(table) { this.table = table; }

  select(columns) { return new Read(this.table, columns || '*'); }
  update(values) { return new Write(this.table, 'update', values); }
  delete() { return new Write(this.table, 'delete', {}); }

  async insert(rows) { return this._rows('insert', rows); }

  /**
   * Upsert, one row or many.
   *
   * The `onConflict` option Supabase takes is ignored, and deliberately: the
   * conflict target is declared per table in the hub's own policy, so it cannot
   * be chosen by a caller. The asset scan passing `platform,symbol` is
   * describing the same key the hub already knows about.
   *
   * What it relies on is unchanged either way — an upsert updates ONLY the
   * columns in the payload, so `enabled` and `order`, which the admin owns and
   * the scan never sends, survive every scan.
   */
  async upsert(rows) { return this._rows('upsert', rows); }

  async _rows(op, rows) {
    try {
      const list = (Array.isArray(rows) ? rows : [rows]).map((r) => outRow(this.table, r));
      // Split rather than refuse: the catalogue upsert arrives in chunks of
      // 200 today and the platform decides how many assets there are.
      for (const piece of chunk(list, MAX_ROWS)) {
        await request(`/v1/${this.table}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ op, values: piece, where: [] }),
        });
      }
      return { data: null, error: null };
    } catch (e) {
      return fail(e);
    }
  }
}

// ── Choosing, per table ─────────────────────────────────────────────────────

/** The tables this client knows how to translate. */
const KNOWN = Object.keys(ALIASES).concat(['configs', 'clicks', 'pairs', 'users', 'brokers']);

function selected() {
  const raw = (process.env.DATA_HUB_TABLES || '').trim();
  if (!raw) return new Set();
  if (raw === 'all' || raw === '1') return new Set(KNOWN);
  return new Set(raw.split(',').map((t) => t.trim()).filter(Boolean));
}

/**
 * Wraps the Supabase client so each table goes wherever it is configured to.
 *
 * Returns the original client untouched when nothing is selected, so the
 * unconfigured path is not merely equivalent to the old one — it IS the old
 * one, with no wrapper in between to be wrong.
 */
function withHub(db) {
  if (!db) return db;
  if (!HUB || !SECRET) return db;

  const tables = selected();
  if (tables.size === 0) return db;

  const routed = [...tables].sort().join(', ');
  console.log(`[hub] tables on D1: ${routed}`);

  // ── A Proxy, not a spread ────────────────────────────────────────────────
  //
  // `{ ...db, from }` looked equivalent and was not. Object spread copies OWN
  // ENUMERABLE properties, and a Supabase client keeps its methods on the
  // prototype — `channel`, `rpc`, `auth`, `storage`. Spreading kept the six
  // config strings and dropped every method except the one being replaced, so
  // the scraper died with "db.channel is not a function" the moment it tried
  // to subscribe to realtime config changes.
  //
  // It failed at the FIRST call rather than silently, which is the one good
  // thing about it. A quieter version of this bug would have been much worse.
  //
  // The Proxy forwards everything untouched. Two details matter:
  //
  //   `Reflect.get(target, prop, target)` passes the TARGET as the receiver,
  //   not the proxy — a getter that reads a private `#field` throws if `this`
  //   is anything but the real instance.
  //
  //   methods are bound to `target` for the same reason: calling
  //   `proxy.channel()` would otherwise run with `this` set to the proxy.
  return new Proxy(db, {
    get(target, prop, _receiver) {
      if (prop === 'from') {
        return (table) => (tables.has(table) ? new Table(table) : target.from(table));
      }
      const value = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

module.exports = {
  withHub,
  // Exported for the tests, which check the translation rather than the wire.
  _internals: { ALIASES, JSON_COLUMNS, MAX_IN, MAX_ROWS, aliasOut, aliasIn, outRow, inRow, chunk, selected },
};
