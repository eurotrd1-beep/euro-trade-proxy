// GENERATED — do not edit. Built from euro_trade_ts/packages/engine by
// scripts/build-engine-bundle.mjs. Edit the source there and rebuild.
// engine-source-sha256: 8134edf38a28c892f2b31b31dcd5c2c3fc2325c68d0e67d763454fd53cc3bec1

"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// packages/engine/src/index.ts
var src_exports = {};
__export(src_exports, {
  CONFIDENCE_SATURATION_SCORE: () => CONFIDENCE_SATURATION_SCORE,
  DEFAULT_PROGRAM_ID: () => DEFAULT_PROGRAM_ID,
  DEFAULT_STRATEGY_CONFIG: () => DEFAULT_STRATEGY_CONFIG,
  FIB_LEVELS: () => FIB_LEVELS,
  NO_EVENT: () => NO_EVENT,
  SUPPORTED_TIMEFRAMES: () => SUPPORTED_TIMEFRAMES,
  TIMEFRAME_MINUTES: () => TIMEFRAME_MINUTES,
  VOLUME_DEAD: () => VOLUME_DEAD,
  VOLUME_DEGRADES_TO_PRICE: () => VOLUME_DEGRADES_TO_PRICE,
  VOLUME_DEPENDENT: () => VOLUME_DEPENDENT,
  adxFull: () => adxFull,
  aliasConflictMessages: () => aliasConflictMessages,
  aliasConflicts: () => aliasConflicts,
  aliasGroupOf: () => aliasGroupOf,
  aliasGroups: () => aliasGroups,
  alignExpiry: () => alignExpiry,
  atr: () => atr,
  avgBodySize: () => avgBodySize,
  bollingerBands: () => bollingerBands,
  cacheKey: () => cacheKey,
  candlePatterns: () => candlePatterns,
  canonicalName: () => canonicalName,
  cci: () => cci,
  checkCondition: () => checkCondition,
  clamp: () => clamp,
  cmf: () => cmf,
  computeIndicator: () => computeIndicator,
  confidenceFor: () => confidenceFor,
  detectSwing: () => detectSwing,
  effectiveMaxScore: () => effectiveMaxScore,
  ema: () => ema,
  evaluateRules: () => evaluateRules,
  fib236Touch: () => fib236Touch,
  fullMacd: () => fullMacd,
  guaranteedWinExit: () => guaranteedWinExit,
  indicatorFor: () => indicatorFor,
  isRegistered: () => isRegistered,
  liquidityZones: () => liquidityZones,
  makeRule: () => makeRule,
  marketStructure: () => marketStructure,
  mfi: () => mfi,
  obv: () => obv,
  outcomeFor: () => outcomeFor,
  programFor: () => programFor,
  programForPlan: () => programForPlan,
  programOnTimeframe: () => programOnTimeframe,
  registeredNames: () => registeredNames,
  registeredNamesInOrder: () => registeredNamesInOrder,
  registeredPrograms: () => registeredPrograms,
  resolveExitPrice: () => resolveExitPrice,
  roc: () => roc,
  rsi: () => rsi,
  rsiDivergence: () => rsiDivergence,
  ruleFromJson: () => ruleFromJson,
  scoreStandard: () => scoreStandard,
  scoreV2: () => scoreV2,
  setupCompletion: () => setupCompletion,
  setupProgress: () => setupProgress,
  sma: () => sma,
  stochastic: () => stochastic,
  strategyConfigFromJson: () => strategyConfigFromJson,
  supportResistance: () => supportResistance,
  swingPoints: () => swingPoints,
  systemClock: () => systemClock,
  tieEpsilon: () => tieEpsilon,
  volumeDelta: () => volumeDelta,
  volumeNote: () => volumeNote,
  volumeProfileStats: () => volumeProfileStats,
  vwap: () => vwap,
  williamsR: () => williamsR
});
module.exports = __toCommonJS(src_exports);

// packages/engine/src/types.ts
function makeRule(partial) {
  return {
    enabled: true,
    role: "",
    type: "",
    period: 14,
    fast: 9,
    slow: 21,
    smooth: 3,
    stddev: 2,
    tolerance: null,
    value: null,
    valueMin: null,
    valueMax: null,
    pattern: null,
    ...partial
  };
}
function ruleFromJson(j) {
  const num = (v) => typeof v === "number" ? v : v == null ? null : Number(v);
  return {
    indicator: j["indicator"],
    condition: j["condition"],
    signal: j["signal"],
    score: Number(j["score"]),
    enabled: j["enabled"] ?? true,
    role: j["role"] ?? "",
    type: j["type"] ?? j["category"] ?? "",
    period: num(j["period"]) ?? 14,
    fast: num(j["fast"]) ?? 9,
    slow: num(j["slow"]) ?? 21,
    smooth: num(j["smooth"]) ?? 3,
    stddev: num(j["stddev"]) ?? 2,
    tolerance: num(j["tolerance"]),
    value: num(j["value"]) ?? num(j["level"]),
    valueMin: num(j["value_min"]),
    valueMax: num(j["value_max"]),
    pattern: j["pattern"] ?? j["session"] ?? (j["wave"] != null ? String(j["wave"]) : null)
  };
}

// packages/engine/src/meta.ts
var VOLUME_DEPENDENT = /* @__PURE__ */ new Set();
var VOLUME_DEAD = /* @__PURE__ */ new Set();
var VOLUME_DEGRADES_TO_PRICE = /* @__PURE__ */ new Set();
function volumeNote(indicator) {
  if (!VOLUME_DEPENDENT.has(indicator)) return null;
  if (VOLUME_DEAD.has(indicator)) {
    return "\u26A0\uFE0F \u064A\u0642\u0631\u0627 \u0627\u0644\u062D\u062C\u0645\u060C \u0648\u0627\u0644\u062D\u062C\u0645 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D \u0645\u0646 Pocket Option \u2014 \u0627\u0644\u0642\u064A\u0645\u0629 \u062B\u0627\u0628\u062A\u0629 \u0648\u0644\u0627 \u062A\u062A\u063A\u064A\u0631 \u0623\u0628\u062F\u0627\u064B. \u0644\u0627 \u062A\u0633\u062A\u062E\u062F\u0645\u0647.";
  }
  if (VOLUME_DEGRADES_TO_PRICE.has(indicator)) {
    return "\u26A0\uFE0F \u064A\u0642\u0631\u0627 \u0627\u0644\u062D\u062C\u0645\u060C \u0648\u0627\u0644\u062D\u062C\u0645 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D \u2014 \u0644\u0643\u0646 \u0627\u0644\u062D\u062C\u0645 \u0627\u0644\u062B\u0627\u0628\u062A \u064A\u064F\u062E\u062A\u0635\u0631 \u0645\u0646 \u0627\u0644\u0645\u0639\u0627\u062F\u0644\u0629 \u0641\u064A\u062A\u062D\u0648\u0644 \u0644\u0645\u0624\u0634\u0631 \u0633\u0639\u0631 \u0635\u0627\u0644\u062D \u0628\u0627\u0633\u0645 \u0645\u0636\u0644\u0650\u0651\u0644 (vwap \u0645\u062B\u0644\u0627\u064B \u064A\u0633\u0627\u0648\u064A \u0645\u062A\u0648\u0633\u0637 \u0627\u0644\u0633\u0639\u0631 \u0627\u0644\u0646\u0645\u0648\u0630\u062C\u064A \u0628\u0627\u0644\u0636\u0628\u0637). \u064A\u0639\u0645\u0644\u060C \u0644\u0643\u0646\u0647 \u0644\u064A\u0633 \u0645\u0627 \u064A\u0648\u062D\u064A \u0628\u0647 \u0627\u0633\u0645\u0647.";
  }
  return "\u26A0\uFE0F \u064A\u0642\u0631\u0627 \u0627\u0644\u062D\u062C\u0645\u060C \u0648\u0627\u0644\u062D\u062C\u0645 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D \u0645\u0646 Pocket Option \u2014 \u0627\u0644\u0631\u0642\u0645 \u064A\u062A\u062D\u0631\u0643 \u0644\u0643\u0646\u0647 \u0645\u0628\u0646\u064A \u0639\u0644\u0649 \u062B\u0627\u0628\u062A \u0645\u062E\u062A\u0631\u0639. \u0644\u0627 \u062A\u0633\u062A\u062E\u062F\u0645\u0647.";
}

// packages/engine/src/registry.ts
function systemClock(now = /* @__PURE__ */ new Date()) {
  const jsDay = now.getDay();
  return { utcHour: now.getUTCHours(), weekday: jsDay === 0 ? 7 : jsDay };
}
var registry = /* @__PURE__ */ new Map();
function register(names, fn) {
  for (const name of Array.isArray(names) ? names : [names]) {
    if (registry.has(name)) {
      throw new Error(`Indicator "${name}" is already registered`);
    }
    registry.set(name, fn);
  }
}
function isRegistered(name) {
  return registry.has(name);
}
function registeredNames() {
  return [...registry.keys()].sort();
}
function registeredNamesInOrder() {
  return [...registry.keys()];
}
function indicatorFor(name) {
  return registry.get(name);
}
function cacheKey(r) {
  return `${r.indicator}_${r.period}_${r.fast}_${r.slow}_${r.smooth}_${r.stddev}_${r.tolerance}_${r.value}`;
}
function computeIndicator(candles, rule, currentPrice, clock = systemClock(), cache = /* @__PURE__ */ new Map()) {
  const fn = registry.get(rule.indicator);
  if (!fn) return void 0;
  const key = cacheKey(rule);
  if (cache.has(key)) return cache.get(key);
  const result = fn({ candles, rule, currentPrice, clock, cache });
  cache.set(key, result);
  return result;
}

// packages/engine/src/aliases.ts
var MISLEADING = {
  advanced_candle: "candle_pattern_any \u2014 returns ANY candlestick pattern the detector found. The specific name you asked for is not what it tests",
  bat: "harmonic_pattern_any \u2014 one detector behind two different harmonic patterns. Asking for a specific one does not select it",
  crab: "harmonic_pattern_any \u2014 one detector behind two different harmonic patterns. Asking for a specific one does not select it",
  "5_0": "harmonic_pattern_any \u2014 one detector behind two different harmonic patterns. Asking for a specific one does not select it"
};
var cached = null;
function readsItsOwnName(fn) {
  return typeof fn === "function" && /\.indicator\b/.test(fn.toString());
}
function aliasGroups() {
  if (cached !== null) return cached;
  const byFn = /* @__PURE__ */ new Map();
  for (const name of registeredNamesInOrder()) {
    const fn = indicatorFor(name);
    if (fn === void 0) continue;
    byFn.set(fn, [...byFn.get(fn) ?? [], name]);
  }
  const groups = [];
  for (const [fn, list] of byFn) {
    if (list.length < 2 || readsItsOwnName(fn)) continue;
    const canonical = list[0];
    groups.push({
      canonical,
      aliases: list.slice(1),
      misleading: MISLEADING[canonical] ?? null
    });
  }
  cached = groups;
  return groups;
}
var index = null;
function groupIndex() {
  if (index !== null) return index;
  const m = /* @__PURE__ */ new Map();
  for (const g of aliasGroups()) for (const n of [g.canonical, ...g.aliases]) m.set(n, g);
  index = m;
  return m;
}
function aliasGroupOf(name) {
  return groupIndex().get(name) ?? null;
}
function canonicalName(name) {
  return groupIndex().get(name)?.canonical ?? name;
}
function aliasConflicts(rules) {
  const seen = /* @__PURE__ */ new Map();
  for (const rule of rules) {
    if (!rule.enabled) continue;
    const group = aliasGroupOf(rule.indicator);
    if (group === null) continue;
    const entry = seen.get(group.canonical) ?? { names: /* @__PURE__ */ new Set(), roles: /* @__PURE__ */ new Set(), score: 0 };
    entry.names.add(rule.indicator);
    entry.roles.add(rule.role.length > 0 ? rule.role : "base");
    entry.score += Math.abs(rule.score);
    seen.set(group.canonical, entry);
  }
  const conflicts = [];
  for (const [canonical, entry] of seen) {
    if (entry.names.size < 2) continue;
    conflicts.push({
      canonical,
      names: [...entry.names],
      roles: [...entry.roles],
      score: entry.score,
      misleading: aliasGroupOf(canonical)?.misleading ?? null
    });
  }
  return conflicts;
}
function aliasConflictMessages(rules) {
  return aliasConflicts(rules).map((c) => {
    const list = c.names.join("\u060C ");
    const head = `\u0627\u0644\u0642\u0648\u0627\u0639\u062F ${list} \u0643\u0644\u0647\u0627 \u0646\u0641\u0633 \u0627\u0644\u062D\u0633\u0628\u0629 \u0628\u0627\u0644\u0638\u0628\u0637 (${c.canonical}) \u2014 ${c.names.length} \u0642\u0648\u0627\u0639\u062F \u0628\u0646\u062A\u064A\u062C\u0629 ${c.score} \u0628\u062A\u062A\u062D\u0633\u0628 \u0639\u0644\u0649 \u0642\u0631\u0627\u0621\u0629 \u0648\u0627\u062D\u062F\u0629`;
    return c.misleading === null ? `${head}.` : `${head}. ${c.misleading}`;
  });
}

// packages/engine/src/indicators/levels.ts
var FIB_LEVELS = [
  { ratio: 0, label: "at_0" },
  { ratio: 0.236, label: "at_236" },
  { ratio: 0.382, label: "at_382" },
  { ratio: 0.5, label: "at_500" },
  { ratio: 0.618, label: "at_618" },
  { ratio: 0.786, label: "at_786" },
  { ratio: 0.886, label: "at_886" },
  { ratio: 1, label: "at_100" },
  { ratio: 1.272, label: "at_1272" },
  { ratio: 1.414, label: "at_1414" },
  { ratio: 1.618, label: "at_1618" },
  { ratio: 2, label: "at_200" },
  { ratio: 2.618, label: "at_2618" },
  { ratio: 3.618, label: "at_3618" },
  { ratio: 4.236, label: "at_4236" }
];
var FIB_TOLERANCE = 5;
var SR_TOLERANCE = 0.15;
var SWING_LOOKBACK = 100;
function fractals(window, kind) {
  const priceAtBar = (i) => kind === "high" ? window[i].high : window[i].low;
  const out = [];
  for (let i = 2; i < window.length - 2; i++) {
    const price = priceAtBar(i);
    const isPivot = kind === "high" ? price > priceAtBar(i - 1) && price > priceAtBar(i - 2) && price > priceAtBar(i + 1) && price > priceAtBar(i + 2) : price < priceAtBar(i - 1) && price < priceAtBar(i - 2) && price < priceAtBar(i + 1) && price < priceAtBar(i + 2);
    if (isPivot) out.push({ price, at: i });
  }
  return out;
}
function lastIntermediate(pivots, kind) {
  for (let i = pivots.length - 2; i >= 1; i--) {
    const price = pivots[i].price;
    const beatsBoth = kind === "high" ? price > pivots[i - 1].price && price > pivots[i + 1].price : price < pivots[i - 1].price && price < pivots[i + 1].price;
    if (beatsBoth) return pivots[i];
  }
  return null;
}
function detectSwing(candles, period = 50) {
  const window = candles.slice(-Math.max(period, SWING_LOOKBACK));
  if (window.length < 12) return null;
  const high = lastIntermediate(fractals(window, "high"), "high");
  const low = lastIntermediate(fractals(window, "low"), "low");
  if (high === null || low === null) return null;
  const range = high.price - low.price;
  if (range < 1e-7) return null;
  return { high: high.price, low: low.price, up: low.at < high.at, range };
}
function retracementPct(swing, price) {
  const fromEnd = swing.up ? swing.high - price : price - swing.low;
  return fromEnd / swing.range * 100;
}
function priceAt(swing, ratio) {
  return swing.up ? swing.high - swing.range * ratio : swing.low + swing.range * ratio;
}
register("fib_retracement", ({ candles, currentPrice, rule }) => {
  const swing = detectSwing(candles, rule.period);
  if (swing === null) return -1;
  const pct = retracementPct(swing, currentPrice);
  return pct < 0 || pct > 100 ? -1 : pct;
});
register("fib_extension", ({ candles, currentPrice, rule }) => {
  const swing = detectSwing(candles, rule.period);
  if (swing === null) return -1;
  const pct = retracementPct(swing, currentPrice);
  if (pct >= 0 && pct <= 100) return -1;
  return pct < 0 ? Math.abs(pct) + 100 : pct;
});
register("fib_level", ({ candles, currentPrice, rule }) => {
  const swing = detectSwing(candles, rule.period);
  if (swing === null) return "none";
  const band = swing.range * ((rule.tolerance ?? FIB_TOLERANCE) / 100);
  let best = null;
  for (const level of FIB_LEVELS) {
    const distance = Math.abs(currentPrice - priceAt(swing, level.ratio));
    if (distance <= band && (best === null || distance < best.distance)) {
      best = { label: level.label, distance };
    }
  }
  return best?.label ?? "none";
});
register("fib_zone", ({ candles, currentPrice, rule }) => {
  const swing = detectSwing(candles, rule.period);
  if (swing === null) return "none";
  if (currentPrice > swing.high) return swing.up ? "extension" : "above_high";
  if (currentPrice < swing.low) return swing.up ? "below_low" : "extension";
  const pct = retracementPct(swing, currentPrice);
  if (pct < 38.2) return "shallow";
  if (pct <= 61.8) return "golden";
  return "deep";
});
register("fib_bounce", ({ candles, currentPrice, rule }) => {
  const swing = detectSwing(candles, rule.period);
  if (swing === null || candles.length < 2) return "none";
  const level = priceAt(swing, rule.value ?? 0.618);
  const band = swing.range * ((rule.tolerance ?? FIB_TOLERANCE) / 100);
  const last = candles[candles.length - 1];
  const touchedFromAbove = last.low <= level + band && last.close > level;
  const touchedFromBelow = last.high >= level - band && last.close < level;
  if (touchedFromAbove && last.close > last.open && currentPrice > level) return "bullish";
  if (touchedFromBelow && last.close < last.open && currentPrice < level) return "bearish";
  return "none";
});
register("fib_distance", ({ candles, currentPrice, rule }) => {
  const swing = detectSwing(candles, rule.period);
  if (swing === null) return 0;
  let nearest = Infinity;
  for (const level of FIB_LEVELS) {
    const delta = currentPrice - priceAt(swing, level.ratio);
    if (Math.abs(delta) < Math.abs(nearest)) nearest = delta;
  }
  return Number.isFinite(nearest) ? nearest / swing.range * 100 : 0;
});
function bounds(candles, period) {
  const swing = detectSwing(candles, period);
  return swing === null ? null : { support: swing.low, resistance: swing.high };
}
register("sr_position", ({ candles, currentPrice, rule }) => {
  const level = bounds(candles, rule.period);
  if (level === null) return "none";
  const band = currentPrice * ((rule.tolerance ?? SR_TOLERANCE) / 100);
  if (Math.abs(currentPrice - level.support) <= band) return "at_support";
  if (Math.abs(currentPrice - level.resistance) <= band) return "at_resistance";
  if (currentPrice < level.support) return "below_support";
  if (currentPrice > level.resistance) return "above_resistance";
  return "between";
});
register("sr_bounce", ({ candles, currentPrice, rule }) => {
  const level = bounds(candles, rule.period);
  if (level === null || candles.length < 2) return "none";
  const band = currentPrice * ((rule.tolerance ?? SR_TOLERANCE) / 100);
  const last = candles[candles.length - 1];
  const heldSupport = last.low <= level.support + band && last.close > level.support && last.close > last.open;
  const rejectedResistance = last.high >= level.resistance - band && last.close < level.resistance && last.close < last.open;
  if (heldSupport) return "bullish";
  if (rejectedResistance) return "bearish";
  return "none";
});

// packages/engine/src/conditions.ts
function checkCondition(rule, raw) {
  if (typeof raw === "string") {
    const target = rule.pattern ?? (rule.value != null ? String(rule.value) : "");
    switch (rule.condition) {
      case "eq":
        return raw === target;
      case "neq":
        return raw !== target;
      case "bullish":
        return raw.includes("bullish") || raw.includes("hammer") || raw.includes("morning") || raw.includes("soldiers") || raw.includes("pin_bar_bull");
      case "bearish":
        return raw.includes("bearish") || raw.includes("shooting") || raw.includes("evening") || raw.includes("crows") || raw.includes("pin_bar_bear");
      default:
        return raw === rule.condition;
    }
  }
  const v = raw;
  const value = rule.value ?? 0;
  switch (rule.condition) {
    case "gt":
      return v > value;
    case "lt":
      return v < value;
    case "gte":
      return v >= value;
    case "lte":
      return v <= value;
    case "eq":
      return v === value;
    case "neq":
      return v !== value;
    case "between":
      return v >= (rule.valueMin ?? 0) && v <= (rule.valueMax ?? 0);
    case "bullish":
      return v > 0;
    case "bearish":
      return v < 0;
    case "is_true":
      return v !== 0;
    case "is_false":
      return v === 0;
    case "gt_average":
      return v > 1;
    case "lt_average":
      return v < 1;
    default:
      return false;
  }
}

// packages/engine/src/strategy.ts
function effectiveMaxScore(strategy) {
  if (strategy.maxScore > 0) return strategy.maxScore;
  const sum = strategy.rules.filter((r) => r.enabled).reduce((s, r) => s + Math.abs(r.score), 0);
  return sum > 0 ? sum : 1;
}
function evaluateRules(strategy, ctx) {
  const cache = ctx.cache ?? /* @__PURE__ */ new Map();
  const { candles, currentPrice } = ctx;
  const clock = ctx.clock ?? systemClock();
  let callScore = 0, putScore = 0;
  for (const rule of strategy.rules) {
    if (!rule.enabled) continue;
    try {
      const raw = computeIndicator(candles, rule, currentPrice, clock, cache) ?? 0;
      if (!checkCondition(rule, raw)) continue;
      if (rule.signal === "CALL") callScore += rule.score;
      else if (rule.signal === "PUT") putScore += rule.score;
      else if (rule.signal === "dominant" || rule.signal === "confirm") {
        if (callScore >= putScore) callScore += rule.score;
        else putScore += rule.score;
      }
    } catch {
      continue;
    }
  }
  return callScore - putScore;
}

// packages/engine/src/config.ts
var DEFAULT_STRATEGY_CONFIG = {
  name: "Default",
  emaPeriods: [9, 21, 50],
  rsiPeriod: 14,
  macdFast: 12,
  macdSlow: 26,
  macdSignalPeriod: 9,
  bbPeriod: 20,
  bbStddev: 2,
  stochPeriod: 14,
  stochSmooth: 3,
  adxPeriod: 14,
  cciPeriod: 20,
  mfiPeriod: 14,
  cmfPeriod: 20,
  williamsPeriod: 14,
  rocPeriod: 10,
  atrPeriod: 14,
  rsiOversoldExtreme: 25,
  rsiOversold: 35,
  rsiOverbought: 65,
  rsiOverboughtExtreme: 75,
  stochOversold: 15,
  stochOverbought: 85,
  adxStrong: 25,
  adxModerate: 15,
  cciExtreme: 150,
  cciStrong: 100,
  mfiOversold: 20,
  mfiOverbought: 80,
  cmfStrong: 0.1,
  cmfMild: 0.03,
  volDeltaStrong: 25,
  volDeltaMild: 10,
  volSpikeMultiplier: 1.8,
  srProximity: 8e-4,
  vwapProximity: 1e-3,
  liquidityMinScore: 60,
  williamsOversold: -80,
  williamsOverbought: -20,
  rocThreshold: 0.1,
  lowVolThreshold: 0.6,
  lowVolDamp: 0.7,
  rangingAdx: 15,
  rangingDamp: 0.8,
  confidenceBase: 92.5,
  confidenceMax: 98.9,
  tier1Weight: 3,
  tier2Weight: 2.5,
  tier3Weight: 2,
  tier4Weight: 2,
  tier5Weight: 1.5
};
function strategyConfigFromJson(j) {
  const d = (k, def) => j[k] == null ? def : Number(j[k]);
  const i = (k, def) => j[k] == null ? def : Math.trunc(Number(j[k]));
  const rawEma = j["ema_periods"];
  const emaPeriods = Array.isArray(rawEma) ? rawEma.map((e) => Math.trunc(Number(e))) : [9, 21, 50];
  return {
    name: j["name"] ?? "Custom",
    emaPeriods,
    rsiPeriod: i("rsi_period", 14),
    macdFast: i("macd_fast", 12),
    macdSlow: i("macd_slow", 26),
    macdSignalPeriod: i("macd_signal", 9),
    bbPeriod: i("bb_period", 20),
    bbStddev: d("bb_stddev", 2),
    stochPeriod: i("stoch_period", 14),
    stochSmooth: i("stoch_smooth", 3),
    adxPeriod: i("adx_period", 14),
    cciPeriod: i("cci_period", 20),
    mfiPeriod: i("mfi_period", 14),
    cmfPeriod: i("cmf_period", 20),
    williamsPeriod: i("williams_period", 14),
    rocPeriod: i("roc_period", 10),
    atrPeriod: i("atr_period", 14),
    rsiOversoldExtreme: d("rsi_oversold_extreme", 25),
    rsiOversold: d("rsi_oversold", 35),
    rsiOverbought: d("rsi_overbought", 65),
    rsiOverboughtExtreme: d("rsi_overbought_extreme", 75),
    stochOversold: d("stoch_oversold", 15),
    stochOverbought: d("stoch_overbought", 85),
    adxStrong: d("adx_strong", 25),
    adxModerate: d("adx_moderate", 15),
    cciExtreme: d("cci_extreme", 150),
    cciStrong: d("cci_strong", 100),
    mfiOversold: d("mfi_oversold", 20),
    mfiOverbought: d("mfi_overbought", 80),
    cmfStrong: d("cmf_strong", 0.1),
    cmfMild: d("cmf_mild", 0.03),
    volDeltaStrong: d("vol_delta_strong", 25),
    volDeltaMild: d("vol_delta_mild", 10),
    volSpikeMultiplier: d("vol_spike_multiplier", 1.8),
    srProximity: d("sr_proximity", 8e-4),
    vwapProximity: d("vwap_proximity", 1e-3),
    liquidityMinScore: d("liquidity_min_score", 60),
    williamsOversold: d("williams_oversold", -80),
    williamsOverbought: d("williams_overbought", -20),
    rocThreshold: d("roc_threshold", 0.1),
    lowVolThreshold: d("low_vol_threshold", 0.6),
    lowVolDamp: d("low_vol_damp", 0.7),
    rangingAdx: d("ranging_adx", 15),
    rangingDamp: d("ranging_damp", 0.8),
    confidenceBase: d("confidence_base", 92.5),
    confidenceMax: d("confidence_max", 98.9),
    tier1Weight: d("tier1_weight", 3),
    tier2Weight: d("tier2_weight", 2.5),
    tier3Weight: d("tier3_weight", 2),
    tier4Weight: d("tier4_weight", 2),
    tier5Weight: d("tier5_weight", 1.5)
  };
}

// packages/engine/src/indicators/math.ts
function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
function rsi(candles, period) {
  if (candles.length <= period) return 50;
  let totalGain = 0;
  let totalLoss = 0;
  for (let i = candles.length - period; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close;
    if (change > 0) totalGain += change;
    else totalLoss -= change;
  }
  if (totalLoss === 0) return 100;
  const rs = totalGain / period / (totalLoss / period);
  return 100 - 100 / (1 + rs);
}
function sma(candles, period, currentPrice) {
  if (candles.length < period) return currentPrice;
  let sum = 0;
  for (let i = candles.length - period; i < candles.length; i++) sum += candles[i].close;
  return sum / period;
}
function ema(candles, period, currentPrice) {
  if (candles.length < period) return currentPrice;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += candles[i].close;
  let value = sum / period;
  const k = 2 / (period + 1);
  for (let i = period; i < candles.length; i++) {
    value = candles[i].close * k + value * (1 - k);
  }
  return value;
}
function supportResistance(candles, currentPrice) {
  if (candles.length < 10) {
    return { support: currentPrice * 0.995, resistance: currentPrice * 1.005 };
  }
  const peaks = [];
  const valleys = [];
  for (let i = 1; i < candles.length - 1; i++) {
    const prev = candles[i - 1], curr = candles[i], next = candles[i + 1];
    if (curr.high > prev.high && curr.high > next.high) peaks.push(curr.high);
    if (curr.low < prev.low && curr.low < next.low) valleys.push(curr.low);
  }
  const support = valleys.length ? Math.min(...valleys) : Math.min(...candles.map((c) => c.low));
  const resistance = peaks.length ? Math.max(...peaks) : Math.max(...candles.map((c) => c.high));
  return { support, resistance };
}
function bollingerBands(candles, period, currentPrice, stdDevMult = 2) {
  const mid = sma(candles, period, currentPrice);
  if (candles.length < period) {
    return { upper: mid * 1.002, lower: mid * 0.998, middle: mid };
  }
  let varianceSum = 0;
  for (let i = candles.length - period; i < candles.length; i++) {
    varianceSum += (candles[i].close - mid) ** 2;
  }
  const stdDev = Math.sqrt(varianceSum / period);
  return {
    upper: mid + stdDevMult * stdDev,
    lower: mid - stdDevMult * stdDev,
    middle: mid
  };
}
function fullMacd(candles, currentPrice) {
  const ema12 = ema(candles, 12, currentPrice);
  const ema26 = ema(candles, 26, currentPrice);
  const macdLine = ema12 - ema26;
  if (candles.length < 26) return { macd: macdLine, signal: 0, histogram: macdLine };
  const macdValues = [];
  for (let i = Math.max(0, candles.length - 9); i < candles.length; i++) {
    let sum12 = 0, sum26 = 0, cnt12 = 0, cnt26 = 0;
    for (let j = Math.max(0, i - 11); j <= i; j++) {
      sum12 += candles[j].close;
      cnt12++;
    }
    for (let j = Math.max(0, i - 25); j <= i; j++) {
      sum26 += candles[j].close;
      cnt26++;
    }
    macdValues.push(sum12 / cnt12 - sum26 / cnt26);
  }
  const signal = macdValues.length ? macdValues.reduce((a, b) => a + b, 0) / macdValues.length : 0;
  return { macd: macdLine, signal, histogram: macdLine - signal };
}
function atr(candles, period, currentPrice) {
  if (candles.length < period + 1) return currentPrice * 1e-3;
  let totalTR = 0;
  for (let i = candles.length - period; i < candles.length; i++) {
    const curr = candles[i], prev = candles[i - 1];
    const tr1 = curr.high - curr.low;
    const tr2 = Math.abs(curr.high - prev.close);
    const tr3 = Math.abs(curr.low - prev.close);
    totalTR += Math.max(tr1, Math.max(tr2, tr3));
  }
  return totalTR / period;
}
function stochastic(candles, period, smoothK, currentPrice) {
  if (candles.length < period) return { k: 50, d: 50 };
  let highestHigh = -Infinity;
  let lowestLow = Infinity;
  for (let i = candles.length - period; i < candles.length; i++) {
    if (candles[i].high > highestHigh) highestHigh = candles[i].high;
    if (candles[i].low < lowestLow) lowestLow = candles[i].low;
  }
  const range = highestHigh - lowestLow;
  let rawK = range === 0 ? 50 : (currentPrice - lowestLow) / range * 100;
  rawK = clamp(rawK, 0, 100);
  const kValues = [];
  for (let s = 0; s < smoothK && s < candles.length - period; s++) {
    const offset = candles.length - period - s;
    if (offset < 0) break;
    let hh = -Infinity, ll = Infinity;
    for (let i = offset; i < offset + period && i < candles.length; i++) {
      if (candles[i].high > hh) hh = candles[i].high;
      if (candles[i].low < ll) ll = candles[i].low;
    }
    const r = hh - ll;
    const idx = Math.min(offset + period - 1, candles.length - 1);
    kValues.push(r === 0 ? 50 : (candles[idx].close - ll) / r * 100);
  }
  kValues.unshift(rawK);
  const smoothedK = kValues.reduce((a, b) => a + b, 0) / kValues.length;
  const smoothedD = kValues.length > 1 ? kValues.slice(1).reduce((a, b) => a + b, 0) / (kValues.length - 1) : smoothedK;
  return { k: clamp(smoothedK, 0, 100), d: clamp(smoothedD, 0, 100) };
}
function obv(candles) {
  if (candles.length < 2) return 0;
  let value = 0;
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].close > candles[i - 1].close) value += candles[i].volume;
    else if (candles[i].close < candles[i - 1].close) value -= candles[i].volume;
  }
  return value;
}
function vwap(candles, currentPrice) {
  if (candles.length === 0) return currentPrice;
  let cumVolumePrice = 0, cumVolume = 0;
  for (const c of candles) {
    cumVolumePrice += (c.high + c.low + c.close) / 3 * c.volume;
    cumVolume += c.volume;
  }
  return cumVolume === 0 ? currentPrice : cumVolumePrice / cumVolume;
}
function cmf(candles, period) {
  if (candles.length < period) return 0;
  let mfvSum = 0, volSum = 0;
  for (let i = candles.length - period; i < candles.length; i++) {
    const c = candles[i];
    const hl = c.high - c.low;
    const mult = hl === 0 ? 0 : (c.close - c.low - (c.high - c.close)) / hl;
    mfvSum += mult * c.volume;
    volSum += c.volume;
  }
  return volSum === 0 ? 0 : clamp(mfvSum / volSum, -1, 1);
}
function volumeDelta(candles) {
  if (candles.length < 5) return 0;
  let buyVolume = 0, sellVolume = 0;
  for (let i = candles.length - 5; i < candles.length; i++) {
    const c = candles[i];
    const bodyRatio = c.high === c.low ? 0.5 : (c.close - c.low) / (c.high - c.low);
    buyVolume += c.volume * bodyRatio;
    sellVolume += c.volume * (1 - bodyRatio);
  }
  const total = buyVolume + sellVolume;
  return total === 0 ? 0 : (buyVolume - sellVolume) / total * 100;
}
function williamsR(candles, period, currentPrice) {
  if (candles.length < period) return -50;
  let highestHigh = -Infinity, lowestLow = Infinity;
  for (let i = candles.length - period; i < candles.length; i++) {
    if (candles[i].high > highestHigh) highestHigh = candles[i].high;
    if (candles[i].low < lowestLow) lowestLow = candles[i].low;
  }
  const range = highestHigh - lowestLow;
  if (range === 0) return -50;
  return (highestHigh - currentPrice) / range * -100;
}
function cci(candles, period) {
  if (candles.length < period) return 0;
  const typicalPrices = [];
  for (let i = candles.length - period; i < candles.length; i++) {
    typicalPrices.push((candles[i].high + candles[i].low + candles[i].close) / 3);
  }
  const mean = typicalPrices.reduce((a, b) => a + b, 0) / typicalPrices.length;
  const meanDeviation = typicalPrices.map((tp) => Math.abs(tp - mean)).reduce((a, b) => a + b, 0) / typicalPrices.length;
  if (meanDeviation === 0) return 0;
  const last = candles[candles.length - 1];
  const currentTP = (last.high + last.low + last.close) / 3;
  return (currentTP - mean) / (0.015 * meanDeviation);
}
function mfi(candles, period) {
  if (candles.length < period + 1) return 50;
  let posFlow = 0, negFlow = 0;
  for (let i = candles.length - period; i < candles.length; i++) {
    const c = candles[i], p = candles[i - 1];
    const tp = (c.high + c.low + c.close) / 3;
    const prevTp = (p.high + p.low + p.close) / 3;
    const rawMF = tp * c.volume;
    if (tp > prevTp) posFlow += rawMF;
    else negFlow += rawMF;
  }
  if (negFlow === 0) return 100;
  return 100 - 100 / (1 + posFlow / negFlow);
}
function roc(candles, period, currentPrice) {
  if (candles.length < period + 1) return 0;
  const pastPrice = candles[candles.length - period - 1].close;
  if (pastPrice === 0) return 0;
  return (currentPrice - pastPrice) / pastPrice * 100;
}
function adxFull(candles, period) {
  const fallback = { adx: 25, plusDi: 50, minusDi: 50 };
  if (candles.length < period + 1) return fallback;
  let plusDmSum = 0, minusDmSum = 0, trSum = 0;
  for (let i = candles.length - period; i < candles.length; i++) {
    const curr = candles[i], prev = candles[i - 1];
    const upMove = curr.high - prev.high;
    const downMove = prev.low - curr.low;
    const plusDm = upMove > downMove && upMove > 0 ? upMove : 0;
    const minusDm = downMove > upMove && downMove > 0 ? downMove : 0;
    const tr = Math.max(
      curr.high - curr.low,
      Math.max(Math.abs(curr.high - prev.close), Math.abs(curr.low - prev.close))
    );
    plusDmSum += plusDm;
    minusDmSum += minusDm;
    trSum += tr;
  }
  if (trSum === 0) return fallback;
  const plusDi = plusDmSum / trSum * 100;
  const minusDi = minusDmSum / trSum * 100;
  const diSum = plusDi + minusDi;
  if (diSum === 0) return { adx: 25, plusDi, minusDi };
  const dx = Math.abs(plusDi - minusDi) / diSum * 100;
  return { adx: clamp(dx, 0, 100), plusDi, minusDi };
}

// packages/engine/src/indicators/patterns.ts
function swingPoints(candles, lookback = 50, str = 2) {
  const h = [];
  const l = [];
  const start = Math.max(str, candles.length - lookback);
  for (let i = start; i < candles.length - str; i++) {
    const ch = candles[i].high;
    const cl = candles[i].low;
    let isHigh = true;
    let isLow = true;
    for (let k = 1; k <= str; k++) {
      if (ch <= candles[i - k].high || ch <= candles[i + k].high) isHigh = false;
      if (cl >= candles[i - k].low || cl >= candles[i + k].low) isLow = false;
    }
    if (isHigh) h.push(ch);
    if (isLow) l.push(cl);
  }
  return { h, l };
}
function avgBodySize(candles) {
  if (candles.length === 0) return 1e-4;
  return candles.reduce((a, c) => a + Math.abs(c.close - c.open), 0) / candles.length;
}
function candlePatterns(candles) {
  if (candles.length < 3) return "none";
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const prev2 = candles[candles.length - 3];
  const lastBody = Math.abs(last.close - last.open);
  const lastRange = last.high - last.low;
  const prevBody = Math.abs(prev.close - prev.open);
  if (lastRange === 0) return "none";
  if (lastBody / lastRange < 0.1) return "doji";
  if (prev.close < prev.open && last.close > last.open && last.open <= prev.close && last.close >= prev.open) return "bullish_engulfing";
  if (prev.close > prev.open && last.close < last.open && last.open >= prev.close && last.close <= prev.open) return "bearish_engulfing";
  const lowerWick = Math.min(last.open, last.close) - last.low;
  const upperWick = last.high - Math.max(last.open, last.close);
  if (lowerWick / lastRange > 0.6 && upperWick / lastRange < 0.15 && lastBody / lastRange > 0.1) return "hammer";
  if (upperWick / lastRange > 0.6 && lowerWick / lastRange < 0.15 && lastBody / lastRange > 0.1) return "shooting_star";
  if (prev2.close < prev2.open && prevBody < lastBody * 0.4 && last.close > last.open && last.close > (prev2.open + prev2.close) / 2) return "morning_star";
  if (prev2.close > prev2.open && prevBody < lastBody * 0.4 && last.close < last.open && last.close < (prev2.open + prev2.close) / 2) return "evening_star";
  if (prev2.close > prev2.open && prev.close > prev.open && last.close > last.open && prev.close > prev2.close && last.close > prev.close) return "three_white_soldiers";
  if (prev2.close < prev2.open && prev.close < prev.open && last.close < last.open && prev.close < prev2.close && last.close < prev.close) return "three_black_crows";
  if (lowerWick / lastRange > 0.65) return "pin_bar_bullish";
  if (upperWick / lastRange > 0.65) return "pin_bar_bearish";
  return "none";
}

// packages/engine/src/indicators/structure.ts
function liquidityZones(candles, currentPrice) {
  if (candles.length < 10) {
    return { score: 50, zone: "Neutral", nearestLevel: currentPrice };
  }
  const avgVolume = candles.reduce((a, c) => a + c.volume, 0) / candles.length;
  const levels = [];
  for (const c of candles) {
    if (c.volume > avgVolume * 1.5) levels.push((c.high + c.low) / 2);
  }
  const sr = supportResistance(candles, currentPrice);
  levels.push(sr.support, sr.resistance, vwap(candles, currentPrice));
  let minDist = Infinity;
  let nearestLevel = currentPrice;
  for (const level of levels) {
    const dist = Math.abs(currentPrice - level);
    if (dist < minDist) {
      minDist = dist;
      nearestLevel = level;
    }
  }
  const atrVal = atr(candles, 14, currentPrice);
  const score = atrVal === 0 ? 50 : (1 - clamp(minDist / (atrVal * 3), 0, 1)) * 100;
  let zone;
  if (score > 75) zone = currentPrice <= nearestLevel ? "Demand Zone (Buy)" : "Supply Zone (Sell)";
  else if (score > 40) zone = "Transition Zone";
  else zone = "Low Liquidity";
  return { score, zone, nearestLevel };
}
function volumeProfileStats(candles) {
  if (candles.length < 10) {
    return { spike: false, ratio: 1, trend: "flat", avgVolume: 1e3 };
  }
  let totalVol = 0;
  let count = 0;
  for (let i = Math.max(0, candles.length - 11); i < candles.length - 1; i++) {
    totalVol += candles[i].volume;
    count++;
  }
  const avgVolume = count > 0 ? totalVol / count : 1e3;
  const currentVol = candles[candles.length - 1].volume;
  const ratio = avgVolume > 0 ? currentVol / avgVolume : 1;
  let obvRecent = 0;
  for (let i = Math.max(1, candles.length - 5); i < candles.length; i++) {
    if (candles[i].close > candles[i - 1].close) obvRecent += candles[i].volume;
    else obvRecent -= candles[i].volume;
  }
  return {
    spike: ratio > 1.8,
    ratio,
    trend: obvRecent > 0 ? "bullish" : obvRecent < 0 ? "bearish" : "flat",
    avgVolume
  };
}
function marketStructure(candles, currentPrice) {
  if (candles.length < 20) return "none";
  const sh = [];
  const sl = [];
  for (let i = 2; i < candles.length - 2; i++) {
    const h = candles[i].high;
    if (h > candles[i - 1].high && h > candles[i - 2].high && h > candles[i + 1].high && h > candles[i + 2].high) sh.push(h);
    const l = candles[i].low;
    if (l < candles[i - 1].low && l < candles[i - 2].low && l < candles[i + 1].low && l < candles[i + 2].low) sl.push(l);
  }
  if (sh.length < 2 || sl.length < 2) return "none";
  const sh1 = sh[sh.length - 1], sh2 = sh[sh.length - 2];
  const sl1 = sl[sl.length - 1], sl2 = sl[sl.length - 2];
  const nowBullish = sh1 > sh2 && sl1 > sl2;
  const nowBearish = sh1 < sh2 && sl1 < sl2;
  if (sh.length >= 3 && sl.length >= 3) {
    const sh3 = sh[sh.length - 3], sl3 = sl[sl.length - 3];
    const wasBullish = sh2 > sh3 && sl2 > sl3;
    const wasBearish = sh2 < sh3 && sl2 < sl3;
    if (wasBearish && nowBullish) return "change_of_character_bullish";
    if (wasBullish && nowBearish) return "change_of_character_bearish";
    if (nowBullish && currentPrice > sh2) return "break_of_structure_bullish";
    if (nowBearish && currentPrice < sl2) return "break_of_structure_bearish";
  }
  if (nowBullish) return "higher_high_higher_low";
  if (nowBearish) return "lower_low_lower_high";
  return "none";
}
function rsiDivergence(candles) {
  if (candles.length < 20) return "none";
  const lookback = Math.min(15, candles.length - 5);
  const prices = [];
  const rsiValues = [];
  for (let i = candles.length - lookback; i < candles.length; i++) {
    prices.push(candles[i].close);
  }
  for (let i = candles.length - lookback; i < candles.length; i++) {
    if (i < 15) {
      rsiValues.push(50);
      continue;
    }
    let totalGain = 0, totalLoss = 0;
    for (let j = i - 13; j <= i; j++) {
      const change = candles[j].close - candles[j - 1].close;
      if (change > 0) totalGain += change;
      else totalLoss -= change;
    }
    const rs = totalLoss === 0 ? 100 : totalGain / 14 / (totalLoss / 14);
    rsiValues.push(100 - 100 / (1 + rs));
  }
  if (prices.length < 5 || rsiValues.length < 5) return "none";
  const mid = Math.trunc(prices.length / 2);
  const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const priceFirst = avg(prices.slice(0, mid));
  const priceLast = avg(prices.slice(mid));
  const rsiFirst = avg(rsiValues.slice(0, mid));
  const rsiLast = avg(rsiValues.slice(mid));
  if (priceLast < priceFirst && rsiLast > rsiFirst + 3) return "bullish";
  if (priceLast > priceFirst && rsiLast < rsiFirst - 3) return "bearish";
  return "none";
}

// packages/engine/src/scoring.ts
var BULLISH_PATTERNS = /* @__PURE__ */ new Set([
  "bullish_engulfing",
  "hammer",
  "morning_star",
  "three_white_soldiers",
  "pin_bar_bullish"
]);
var BEARISH_PATTERNS = /* @__PURE__ */ new Set([
  "bearish_engulfing",
  "shooting_star",
  "evening_star",
  "three_black_crows",
  "pin_bar_bearish"
]);
function scoreV2(candles, currentPrice, cfg = DEFAULT_STRATEGY_CONFIG) {
  let callScore = 0;
  let putScore = 0;
  const emaP = cfg.emaPeriods;
  const ema1 = ema(candles, emaP[0], currentPrice);
  const ema2 = ema(candles, emaP.length > 1 ? emaP[1] : 21, currentPrice);
  const ema3 = ema(
    candles,
    Math.min(emaP.length > 2 ? emaP[2] : 50, candles.length),
    currentPrice
  );
  const rsiVal = rsi(candles, cfg.rsiPeriod);
  const macd = fullMacd(candles, currentPrice);
  const bb = bollingerBands(candles, cfg.bbPeriod, currentPrice, cfg.bbStddev);
  const sr = supportResistance(candles, currentPrice);
  const stoch = stochastic(candles, cfg.stochPeriod, cfg.stochSmooth, currentPrice);
  const adx = adxFull(candles, cfg.adxPeriod);
  const vwapVal = vwap(candles, currentPrice);
  const cmfVal = cmf(candles, cfg.cmfPeriod);
  const volDelta = volumeDelta(candles);
  const liq = liquidityZones(candles, currentPrice);
  const williamsRVal = williamsR(candles, cfg.williamsPeriod, currentPrice);
  const cciVal = cci(candles, cfg.cciPeriod);
  const mfiVal = mfi(candles, cfg.mfiPeriod);
  const rocVal = roc(candles, cfg.rocPeriod, currentPrice);
  const volProfile = volumeProfileStats(candles);
  const divergence = rsiDivergence(candles);
  const pattern = candlePatterns(candles);
  const { tier1Weight: w1, tier2Weight: w2, tier3Weight: w3, tier4Weight: w4, tier5Weight: w5 } = cfg;
  if (ema1 > ema2 && ema2 > ema3) callScore += w1;
  else if (ema1 < ema2 && ema2 < ema3) putScore += w1;
  else if (ema1 > ema2) callScore += w1 / 2;
  else putScore += w1 / 2;
  if (macd.histogram > 0 && macd.macd > macd.signal) callScore += w1;
  else if (macd.histogram < 0 && macd.macd < macd.signal) putScore += w1;
  else if (macd.histogram > 0) callScore += w1 / 2;
  else putScore += w1 / 2;
  if (adx.adx > cfg.adxStrong) {
    if (adx.plusDi > adx.minusDi) callScore += w1;
    else putScore += w1;
  } else if (adx.adx > cfg.adxModerate) {
    if (adx.plusDi > adx.minusDi) callScore += w1 / 3;
    else putScore += w1 / 3;
  }
  if (rsiVal < cfg.rsiOversoldExtreme) callScore += w2;
  else if (rsiVal > cfg.rsiOverboughtExtreme) putScore += w2;
  else if (rsiVal < cfg.rsiOversold) callScore += w2 * 0.6;
  else if (rsiVal > cfg.rsiOverbought) putScore += w2 * 0.6;
  else if (rsiVal > 55) callScore += w2 * 0.2;
  else if (rsiVal < 45) putScore += w2 * 0.2;
  if (divergence === "bullish") callScore += w2;
  else if (divergence === "bearish") putScore += w2;
  if (stoch.k < cfg.stochOversold) callScore += w2;
  else if (stoch.k > cfg.stochOverbought) putScore += w2;
  else if (stoch.k > stoch.d && stoch.k < 50) callScore += w2 * 0.6;
  else if (stoch.k < stoch.d && stoch.k > 50) putScore += w2 * 0.6;
  else if (stoch.k > 50) callScore += w2 * 0.2;
  else putScore += w2 * 0.2;
  if (cciVal > cfg.cciExtreme) putScore += w2;
  else if (cciVal < -cfg.cciExtreme) callScore += w2;
  else if (cciVal > cfg.cciStrong) callScore += w2 * 0.4;
  else if (cciVal < -cfg.cciStrong) putScore += w2 * 0.4;
  else if (cciVal > 0) callScore += w2 * 0.2;
  else putScore += w2 * 0.2;
  if (mfiVal < cfg.mfiOversold) callScore += w3;
  else if (mfiVal > cfg.mfiOverbought) putScore += w3;
  else if (mfiVal > 60) callScore += w3 / 2;
  else if (mfiVal < 40) putScore += w3 / 2;
  if (cmfVal > cfg.cmfStrong) callScore += w3;
  else if (cmfVal < -cfg.cmfStrong) putScore += w3;
  else if (cmfVal > cfg.cmfMild) callScore += w3 * 0.6;
  else if (cmfVal < -cfg.cmfMild) putScore += w3 * 0.6;
  else if (cmfVal > 0) callScore += w3 * 0.25;
  else putScore += w3 * 0.25;
  if (volDelta > cfg.volDeltaStrong) callScore += w3;
  else if (volDelta < -cfg.volDeltaStrong) putScore += w3;
  else if (volDelta > cfg.volDeltaMild) callScore += w3 / 2;
  else if (volDelta < -cfg.volDeltaMild) putScore += w3 / 2;
  if (volProfile.trend === "bullish") callScore += w3;
  else if (volProfile.trend === "bearish") putScore += w3;
  if (volProfile.spike) {
    if (callScore > putScore) callScore += w3;
    else putScore += w3;
  }
  if (currentPrice <= bb.lower) callScore += w4;
  else if (currentPrice >= bb.upper) putScore += w4;
  else {
    const bbRange = bb.upper - bb.lower;
    if (bbRange > 0) {
      const bbPos = (currentPrice - bb.lower) / bbRange;
      if (bbPos > 0.75) putScore += w4 / 2;
      if (bbPos < 0.25) callScore += w4 / 2;
    }
  }
  const srThreshold = currentPrice * cfg.srProximity;
  if (Math.abs(currentPrice - sr.support) <= srThreshold) callScore += w4;
  if (Math.abs(currentPrice - sr.resistance) <= srThreshold) putScore += w4;
  const vwapDist = Math.abs((currentPrice - vwapVal) / vwapVal);
  if (currentPrice > vwapVal) callScore += vwapDist > cfg.vwapProximity ? w4 : w4 / 2;
  else putScore += vwapDist > cfg.vwapProximity ? w4 : w4 / 2;
  if (liq.score > cfg.liquidityMinScore) {
    if (liq.zone.includes("Demand") || liq.zone.includes("Buy")) callScore += w4;
    else if (liq.zone.includes("Supply") || liq.zone.includes("Sell")) putScore += w4;
  }
  if (BULLISH_PATTERNS.has(pattern)) callScore += w5;
  else if (BEARISH_PATTERNS.has(pattern)) putScore += w5;
  if (williamsRVal > cfg.williamsOverbought) putScore += w5;
  else if (williamsRVal < cfg.williamsOversold) callScore += w5;
  else if (williamsRVal > (cfg.williamsOversold + cfg.williamsOverbought) / 2) callScore += w5 / 3;
  else putScore += w5 / 3;
  if (rocVal > cfg.rocThreshold) callScore += w5;
  else if (rocVal < -cfg.rocThreshold) putScore += w5;
  else if (rocVal > 0) callScore += w5 / 3;
  else putScore += w5 / 3;
  if (volProfile.ratio < cfg.lowVolThreshold) {
    callScore *= cfg.lowVolDamp;
    putScore *= cfg.lowVolDamp;
  }
  if (adx.adx < cfg.rangingAdx) {
    callScore *= cfg.rangingDamp;
    putScore *= cfg.rangingDamp;
  }
  return callScore - putScore;
}
function scoreStandard(ctx, dynamicStrategy, cfg = DEFAULT_STRATEGY_CONFIG) {
  if (dynamicStrategy != null) return evaluateRules(dynamicStrategy, ctx);
  return scoreV2(ctx.candles, ctx.currentPrice, cfg);
}

// packages/engine/src/signal.ts
var CONFIDENCE_SATURATION_SCORE = 45;
function confidenceFor(absScore, base, max) {
  const c = base + absScore / CONFIDENCE_SATURATION_SCORE * (max - base);
  return c < base ? base : c > max ? max : c;
}
function alignExpiry(nowMs, selectedMinutes) {
  const nowSec = Math.trunc(nowMs / 1e3);
  const cs = 60;
  const cStartSec = Math.trunc(nowSec / cs) * cs;
  const expirySec = cStartSec + selectedMinutes * cs;
  const raw = expirySec - nowSec;
  const lo = 1;
  const hi = selectedMinutes * cs + cs;
  const durationSeconds = raw < lo ? lo : raw > hi ? hi : raw;
  return {
    entryTime: cStartSec * 1e3,
    expiryTime: expirySec * 1e3,
    durationSeconds
  };
}
function tieEpsilon(entryPrice) {
  return Math.abs(entryPrice) * 5e-6 + 1e-12;
}
function outcomeFor(direction, entryPrice, exitPrice) {
  const diff = exitPrice - entryPrice;
  if (Math.abs(diff) <= tieEpsilon(entryPrice)) return "TIE";
  if (direction === "CALL") return diff > 0 ? "WIN" : "LOSS";
  return diff < 0 ? "WIN" : "LOSS";
}
function resolveExitPrice(entryPrice, livePrice) {
  const live = livePrice ?? 0;
  const sane = live > 0 && Math.abs(live - entryPrice) / entryPrice < 0.01;
  return sane ? live : entryPrice;
}
function guaranteedWinExit(direction, entryPrice, livePrice, rng = Math.random) {
  const live = livePrice ?? 0;
  const sane = live > 0 && Math.abs(live - entryPrice) / entryPrice < 0.01;
  const winning = sane && (direction === "CALL" ? live > entryPrice : live < entryPrice);
  if (winning) return live;
  const margin = entryPrice * 8e-5 * (0.6 + rng() * 0.8);
  return direction === "CALL" ? entryPrice + margin : entryPrice - margin;
}

// packages/engine/src/programs/types.ts
var NO_EVENT = { settled: null, signal: null, cycleEnd: null };

// packages/engine/src/programs/fib236.ts
var FIB = 0.236;
var FIRED_MEMORY = 32;
function blankDiagnostics() {
  return {
    pairsExamined: 0,
    rejectedShape: 0,
    rejectedSwingTouched: 0,
    rejectedBroken: 0,
    rejectedAlreadyFired: 0,
    armed: false,
    retiredBroken: false,
    retiredAged: false
  };
}
function touches(candle, level) {
  return candle.low <= level && level <= candle.high;
}
function lastClosedIndex(candles, timeframeMs, now) {
  for (let i = candles.length - 1; i >= 0; i--) {
    if (candles[i].time + timeframeMs <= now) return i;
  }
  return -1;
}
function contiguousTail(candles, timeframeMs, end) {
  let start = 0;
  for (let i = end; i > 0; i--) {
    if (candles[i].time - candles[i - 1].time !== timeframeMs) {
      start = i;
      break;
    }
  }
  return start;
}
function confirmedPivots(candles, from, upTo) {
  const out = [];
  for (let i = Math.max(from + 2, 2); i <= upTo; i++) {
    const c = candles[i];
    const isHigh = c.high > candles[i - 1].high && c.high > candles[i - 2].high && c.high > candles[i + 1].high && c.high > candles[i + 2].high;
    const isLow = c.low < candles[i - 1].low && c.low < candles[i - 2].low && c.low < candles[i + 1].low && c.low < candles[i + 2].low;
    if (isHigh) out.push({ kind: "high", index: i, price: c.high });
    if (isLow) out.push({ kind: "low", index: i, price: c.low });
  }
  return out;
}
function brokenAfter(candles, end, direction, upTo) {
  for (let j = end.index + 1; j <= upTo; j++) {
    if (direction === "CALL" && candles[j].high > end.price) return true;
    if (direction === "PUT" && candles[j].low < end.price) return true;
  }
  return false;
}
function findSetup(candles, from, n, firedKeys, diag = blankDiagnostics()) {
  const pivots = confirmedPivots(candles, from, n - 2);
  for (let i = pivots.length - 1; i >= 1; i--) {
    const end = pivots[i];
    const origin = pivots[i - 1];
    diag.pairsExamined++;
    if (origin.kind === end.kind) {
      diag.rejectedShape++;
      continue;
    }
    const range = Math.abs(end.price - origin.price);
    if (range <= 0) {
      diag.rejectedShape++;
      continue;
    }
    const direction = origin.kind === "low" ? "CALL" : "PUT";
    const level = end.price + FIB * (origin.price - end.price);
    if (touches(candles[origin.index], level) || touches(candles[end.index], level)) {
      diag.rejectedSwingTouched++;
      continue;
    }
    if (brokenAfter(candles, end, direction, n)) {
      diag.rejectedBroken++;
      continue;
    }
    const key = `${candles[origin.index].time}:${candles[end.index].time}`;
    if (firedKeys.includes(key)) {
      diag.rejectedAlreadyFired++;
      continue;
    }
    return {
      direction,
      originIndex: origin.index,
      endIndex: end.index,
      endPrice: end.price,
      level,
      key
    };
  }
  return null;
}
function stillValid(armed, candles, from, n) {
  if (armed.endTime < candles[from].time) return "aged";
  for (let j = n; j >= from; j--) {
    const candle = candles[j];
    if (candle.time <= armed.endTime) break;
    if (armed.direction === "CALL" && candle.high > armed.endPrice) return "broken";
    if (armed.direction === "PUT" && candle.low < armed.endPrice) return "broken";
  }
  return "valid";
}
function remember(state, key) {
  state.firedKeys.push(key);
  if (state.firedKeys.length > FIRED_MEMORY) state.firedKeys.shift();
}
var fib236Touch = {
  id: "fib_236_touch",
  name: "\u0627\u0631\u062A\u062F\u0627\u062F \u0641\u064A\u0628\u0648\u0646\u0627\u062A\u0634\u064A 0.236",
  timeframe: "1m",
  durationMinutes: 1,
  confidence: 92.5,
  init() {
    return { cycle: null, armed: null, firedKeys: [], lastCandleTime: 0 };
  },
  onCandleClose(ctx, state) {
    const { candles, timeframeMs, now } = ctx;
    const diagnostics = blankDiagnostics();
    const n = lastClosedIndex(candles, timeframeMs, now);
    if (n < 0) return NO_EVENT;
    const candle = candles[n];
    if (candle.time <= state.lastCandleTime) return NO_EVENT;
    state.lastCandleTime = candle.time;
    const nextCandleTime = candle.time + timeframeMs;
    if (state.cycle !== null) {
      const cycle = state.cycle;
      if (candle.time < cycle.entryTime) return NO_EVENT;
      if (candle.time > cycle.entryTime) {
        state.cycle = null;
        return { settled: null, signal: null, cycleEnd: "ABORTED" };
      }
      const entryPrice = candle.open;
      const exitPrice = candle.close;
      const result = outcomeFor(cycle.direction, entryPrice, exitPrice);
      const settled = {
        result,
        stage: cycle.stage,
        direction: cycle.direction,
        entryPrice,
        exitPrice
      };
      if (result !== "LOSS") {
        state.cycle = null;
        const cycleEnd = cycle.stage === "primary" ? result : result === "WIN" ? "RECOVERED" : "RECOVERED_TIE";
        return { settled, signal: null, cycleEnd };
      }
      if (cycle.stage === "primary") {
        state.cycle = {
          direction: cycle.direction,
          stage: "martingale",
          entryTime: nextCandleTime
        };
        return {
          settled,
          signal: { direction: cycle.direction, stage: "martingale", entryTime: nextCandleTime },
          cycleEnd: null
        };
      }
      state.cycle = null;
      return { settled, signal: null, cycleEnd: "FINAL_LOSS" };
    }
    const from = contiguousTail(candles, timeframeMs, n);
    if (n - from < 11) return { ...NO_EVENT, diagnostics };
    if (state.armed !== null) {
      const verdict = stillValid(state.armed, candles, from, n);
      if (verdict !== "valid") {
        diagnostics.retiredBroken = verdict === "broken";
        diagnostics.retiredAged = verdict === "aged";
        state.armed = null;
      }
    }
    if (state.armed === null) {
      const setup = findSetup(candles, from, n, state.firedKeys, diagnostics);
      if (setup === null) return { ...NO_EVENT, diagnostics };
      diagnostics.armed = true;
      state.armed = {
        direction: setup.direction,
        level: setup.level,
        endPrice: setup.endPrice,
        endTime: candles[setup.endIndex].time,
        key: setup.key
      };
      return { ...NO_EVENT, diagnostics };
    }
    const armed = state.armed;
    if (candle.time <= armed.endTime) return { ...NO_EVENT, diagnostics };
    if (!touches(candle, armed.level)) return { ...NO_EVENT, diagnostics };
    remember(state, armed.key);
    state.armed = null;
    state.cycle = {
      direction: armed.direction,
      stage: "primary",
      entryTime: nextCandleTime
    };
    return {
      settled: null,
      signal: { direction: armed.direction, stage: "primary", entryTime: nextCandleTime },
      cycleEnd: null,
      diagnostics
    };
  }
};
function setupCompletion(armed, price) {
  const reached = armed.direction === "CALL" ? price <= armed.level : price >= armed.level;
  if (reached) return 1;
  const leg = Math.abs(armed.level - armed.endPrice) / FIB;
  if (!(leg > 0)) return 0;
  return Math.max(0, Math.min(1, 1 - Math.abs(price - armed.level) / leg));
}
var BAND = {
  pivots: 15,
  rejected: 30,
  armed: 50,
  /** The top of the armed band. The last 5 belong to the touch itself. */
  armedTop: 95
};
function setupProgress(state, diagnostics, price) {
  if (state.cycle !== null) return { stage: "fired", percent: 100 };
  if (state.armed !== null) {
    const closeness = setupCompletion(state.armed, price);
    return {
      stage: "armed",
      percent: BAND.armed + closeness * (BAND.armedTop - BAND.armed)
    };
  }
  if (diagnostics === null) return { stage: "idle", percent: 0 };
  const refused = diagnostics.rejectedSwingTouched + diagnostics.rejectedBroken + diagnostics.rejectedAlreadyFired;
  if (refused > 0) {
    const share = Math.min(1, refused / 3);
    return { stage: "rejected", percent: BAND.rejected + share * (BAND.armed - BAND.rejected) };
  }
  if (diagnostics.pairsExamined > 0) {
    const share = Math.min(1, diagnostics.pairsExamined / 4);
    return { stage: "pivots", percent: BAND.pivots + share * (BAND.rejected - BAND.pivots) };
  }
  return { stage: "idle", percent: 0 };
}

// packages/engine/src/programs/index.ts
var PROGRAMS = [fib236Touch];
var DEFAULT_PROGRAM_ID = fib236Touch.id;
var BY_PLAN = {
  free: fib236Touch,
  paid: fib236Touch
};
var TIMEFRAME_MINUTES = {
  "1m": 1,
  "5m": 5
};
var SUPPORTED_TIMEFRAMES = ["1m", "5m"];
function programOnTimeframe(program, timeframe) {
  const minutes = TIMEFRAME_MINUTES[timeframe];
  if (minutes === void 0 || timeframe === program.timeframe) return program;
  return { ...program, timeframe, durationMinutes: minutes };
}
function programForPlan(plan, timeframe) {
  const program = BY_PLAN[plan];
  return timeframe === void 0 ? program : programOnTimeframe(program, timeframe);
}
function registeredPrograms() {
  return PROGRAMS;
}
function programFor(id) {
  if (!id) return null;
  return PROGRAMS.find((p) => p.id === id) ?? null;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CONFIDENCE_SATURATION_SCORE,
  DEFAULT_PROGRAM_ID,
  DEFAULT_STRATEGY_CONFIG,
  FIB_LEVELS,
  NO_EVENT,
  SUPPORTED_TIMEFRAMES,
  TIMEFRAME_MINUTES,
  VOLUME_DEAD,
  VOLUME_DEGRADES_TO_PRICE,
  VOLUME_DEPENDENT,
  adxFull,
  aliasConflictMessages,
  aliasConflicts,
  aliasGroupOf,
  aliasGroups,
  alignExpiry,
  atr,
  avgBodySize,
  bollingerBands,
  cacheKey,
  candlePatterns,
  canonicalName,
  cci,
  checkCondition,
  clamp,
  cmf,
  computeIndicator,
  confidenceFor,
  detectSwing,
  effectiveMaxScore,
  ema,
  evaluateRules,
  fib236Touch,
  fullMacd,
  guaranteedWinExit,
  indicatorFor,
  isRegistered,
  liquidityZones,
  makeRule,
  marketStructure,
  mfi,
  obv,
  outcomeFor,
  programFor,
  programForPlan,
  programOnTimeframe,
  registeredNames,
  registeredNamesInOrder,
  registeredPrograms,
  resolveExitPrice,
  roc,
  rsi,
  rsiDivergence,
  ruleFromJson,
  scoreStandard,
  scoreV2,
  setupCompletion,
  setupProgress,
  sma,
  stochastic,
  strategyConfigFromJson,
  supportResistance,
  swingPoints,
  systemClock,
  tieEpsilon,
  volumeDelta,
  volumeNote,
  volumeProfileStats,
  vwap,
  williamsR
});

module.exports.BUNDLE_SOURCE_HASH = "8134edf38a28c892f2b31b31dcd5c2c3fc2325c68d0e67d763454fd53cc3bec1";

