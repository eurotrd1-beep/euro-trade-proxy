// GENERATED — do not edit. Built from euro_trade_ts/packages/engine by
// scripts/build-engine-bundle.mjs. Edit the source there and rebuild.
// engine-source-sha256: 96507b39ce17bdb533977ddd04e48e8c9862e5a8dd5192baf252e262dca1353b

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
  DEFAULT_PYRAMID: () => DEFAULT_PYRAMID,
  DEFAULT_STRATEGY_CONFIG: () => DEFAULT_STRATEGY_CONFIG,
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
  buildCalibration: () => buildCalibration,
  cacheKey: () => cacheKey,
  calibrationFor: () => calibrationFor,
  calibrationFromJson: () => calibrationFromJson,
  candlePatterns: () => candlePatterns,
  canonicalName: () => canonicalName,
  categoryForIndicator: () => categoryForIndicator,
  cci: () => cci,
  checkCondition: () => checkCondition,
  clamp: () => clamp,
  cmf: () => cmf,
  computeIndicator: () => computeIndicator,
  confidenceFor: () => confidenceFor,
  contiguousRuns: () => contiguousRuns,
  correlationOf: () => correlationOf,
  coversSignature: () => coversSignature,
  effectiveMaxScore: () => effectiveMaxScore,
  ema: () => ema,
  evaluateRules: () => evaluateRules,
  evaluateStrategyPro: () => evaluateStrategyPro,
  fullMacd: () => fullMacd,
  guaranteedWinExit: () => guaranteedWinExit,
  hasCalibration: () => hasCalibration,
  indicatorFor: () => indicatorFor,
  isRegistered: () => isRegistered,
  liquidityZones: () => liquidityZones,
  makeRule: () => makeRule,
  marketStructure: () => marketStructure,
  mfi: () => mfi,
  obv: () => obv,
  outcomeFor: () => outcomeFor,
  pairKey: () => pairKey,
  primaryRulesOf: () => primaryRulesOf,
  pyramidFromJson: () => pyramidFromJson,
  registeredNames: () => registeredNames,
  registeredNamesInOrder: () => registeredNamesInOrder,
  resolveExitPrice: () => resolveExitPrice,
  roc: () => roc,
  rsi: () => rsi,
  rsiDivergence: () => rsiDivergence,
  ruleFromJson: () => ruleFromJson,
  ruleSignature: () => ruleSignature,
  scoreStandard: () => scoreStandard,
  scoreV2: () => scoreV2,
  setCalibration: () => setCalibration,
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
var VOLUME_DEPENDENT = /* @__PURE__ */ new Set([
  "cmf",
  "cumulative_volume_delta",
  "cvd",
  "ease_of_movement",
  "elder_force_index",
  "emv",
  "klinger",
  "klinger_oscillator",
  "liquidity_score",
  "mfi",
  "nvi",
  "obv",
  "price_vs_vwap",
  "pvi",
  "pvt",
  "vol_delta",
  "vol_ratio",
  "volume",
  "volume_oscillator",
  "volume_profile",
  "vwap",
  "wyckoff_phase"
]);
var VOLUME_DEAD = /* @__PURE__ */ new Set([
  "nvi",
  "pvi",
  "vol_ratio",
  "volume",
  "volume_oscillator"
]);
var VOLUME_DEGRADES_TO_PRICE = /* @__PURE__ */ new Set([
  "cmf",
  "mfi",
  "price_vs_vwap",
  "vwap"
]);
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

// packages/engine/src/indicators/core.ts
register("rsi", ({ candles, rule }) => rsi(candles, rule.period));
register("cci", ({ candles, rule }) => cci(candles, rule.period));
register("roc", ({ candles, rule, currentPrice }) => roc(candles, rule.period, currentPrice));
register(
  "williams_r",
  ({ candles, rule, currentPrice }) => williamsR(candles, rule.period, currentPrice)
);
register("macd_line", ({ candles, currentPrice }) => fullMacd(candles, currentPrice).macd);
register("macd_signal", ({ candles, currentPrice }) => fullMacd(candles, currentPrice).signal);
register(
  "macd_histogram",
  ({ candles, currentPrice }) => fullMacd(candles, currentPrice).histogram
);
register(
  "ema",
  ({ candles, rule, currentPrice }) => ema(candles, Math.min(rule.period, candles.length), currentPrice)
);
register(
  "ema_cross",
  ({ candles, rule, currentPrice }) => ema(candles, Math.min(rule.fast, candles.length), currentPrice) - ema(candles, Math.min(rule.slow, candles.length), currentPrice)
);
register("adx", ({ candles, rule }) => adxFull(candles, rule.period).adx);
register("plus_di", ({ candles, rule }) => adxFull(candles, rule.period).plusDi);
register("minus_di", ({ candles, rule }) => adxFull(candles, rule.period).minusDi);
register(
  "stoch_k",
  ({ candles, rule, currentPrice }) => stochastic(candles, rule.period, rule.smooth, currentPrice).k
);
register(
  "stoch_d",
  ({ candles, rule, currentPrice }) => stochastic(candles, rule.period, rule.smooth, currentPrice).d
);
register("stoch_cross", ({ candles, rule, currentPrice }) => {
  const s = stochastic(candles, rule.period, rule.smooth, currentPrice);
  return s.k - s.d;
});
register("atr", ({ candles, rule, currentPrice }) => atr(candles, rule.period, currentPrice));
register(
  "bb_upper",
  ({ candles, rule, currentPrice }) => bollingerBands(candles, rule.period, currentPrice, rule.stddev).upper
);
register(
  "bb_lower",
  ({ candles, rule, currentPrice }) => bollingerBands(candles, rule.period, currentPrice, rule.stddev).lower
);
register("bb_width", ({ candles, rule, currentPrice }) => {
  const bb = bollingerBands(candles, rule.period, currentPrice, rule.stddev);
  return bb.upper - bb.lower;
});
register("bb_position", ({ candles, rule, currentPrice }) => {
  const bb = bollingerBands(candles, rule.period, currentPrice, rule.stddev);
  const range = bb.upper - bb.lower;
  return range > 0 ? (currentPrice - bb.lower) / range * 100 : 50;
});
register(
  "sr_support",
  ({ candles, currentPrice }) => supportResistance(candles, currentPrice).support
);
register(
  "sr_resistance",
  ({ candles, currentPrice }) => supportResistance(candles, currentPrice).resistance
);
register("price", ({ currentPrice }) => currentPrice);

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
function orderBlock(candles, currentPrice) {
  if (candles.length < 10) return "none";
  const totalBody = candles.reduce((a, c) => a + Math.abs(c.close - c.open), 0);
  const impulseThreshold = totalBody / candles.length * 1.5;
  for (let i = candles.length - 2; i >= 5; i--) {
    const c = candles[i];
    if (Math.abs(c.close - c.open) < impulseThreshold) continue;
    const bullishImpulse = c.close > c.open;
    for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
      const ob = candles[j];
      if (bullishImpulse ? ob.close < ob.open : ob.close > ob.open) {
        if (currentPrice >= ob.low && currentPrice <= ob.high) {
          return bullishImpulse ? "bullish" : "bearish";
        }
        break;
      }
    }
  }
  return "none";
}
function fairValueGap(candles, currentPrice) {
  if (candles.length < 5) return "none";
  for (let i = candles.length - 1; i >= 2; i--) {
    const c1 = candles[i - 2], c3 = candles[i];
    if (c3.low > c1.high && currentPrice >= c1.high && currentPrice <= c3.low) return "bullish";
    if (c3.high < c1.low && currentPrice >= c3.high && currentPrice <= c1.low) return "bearish";
  }
  return "none";
}
function liquiditySweep(candles, currentPrice) {
  if (candles.length < 15) return "none";
  const refEnd = candles.length - 3;
  const refStart = Math.max(0, candles.length - 18);
  let refHigh = 0, refLow = Infinity;
  for (let i = refStart; i < refEnd; i++) {
    refHigh = Math.max(refHigh, candles[i].high);
    refLow = Math.min(refLow, candles[i].low);
  }
  const last3 = candles.slice(candles.length - 3);
  if (last3.some((c) => c.low < refLow) && currentPrice > refLow) return "sell_side";
  if (last3.some((c) => c.high > refHigh) && currentPrice < refHigh) return "buy_side";
  return "none";
}
function wyckoffSpring(candles, currentPrice) {
  if (candles.length < 20) return "none";
  let support = Infinity;
  const refEnd = candles.length - 3;
  for (let i = Math.max(0, candles.length - 18); i < refEnd; i++) {
    support = Math.min(support, candles[i].low);
  }
  const last3 = candles.slice(candles.length - 3);
  if (last3.some((c) => c.low < support) && currentPrice > support) {
    const deepest = Math.min(...last3.map((c) => c.low));
    if (support - deepest < support * 3e-3) return "bullish";
  }
  return "none";
}
function wyckoffUpthrust(candles, currentPrice) {
  if (candles.length < 20) return "none";
  let resist = 0;
  const refEnd = candles.length - 3;
  for (let i = Math.max(0, candles.length - 18); i < refEnd; i++) {
    resist = Math.max(resist, candles[i].high);
  }
  const last3 = candles.slice(candles.length - 3);
  if (last3.some((c) => c.high > resist) && currentPrice < resist) {
    const highest = Math.max(...last3.map((c) => c.high));
    if (highest - resist < resist * 3e-3) return "bearish";
  }
  return "none";
}
function sessionOpen(candles, currentPrice) {
  if (candles.length < 3) return "none";
  const open = candles[0].open;
  if (currentPrice > open * 1.0002) return "above";
  if (currentPrice < open * 0.9998) return "below";
  return "at";
}
function openingRange(candles, currentPrice) {
  if (candles.length < 10) return "none";
  const n = Math.min(10, candles.length);
  const head = candles.slice(0, n);
  const orH = Math.max(...head.map((c) => c.high));
  const orL = Math.min(...head.map((c) => c.low));
  if (currentPrice > orH) return "breakout_up";
  if (currentPrice < orL) return "breakout_down";
  return "inside";
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
function killZone(clock) {
  const h = clock.utcHour;
  if (h >= 2 && h < 5) return "asian_killzone";
  if (h >= 8 && h < 11) return "london_killzone";
  if (h >= 13 && h < 16) return "newyork_killzone";
  return "none";
}
function dayOfWeek(clock) {
  switch (clock.weekday) {
    case 1:
      return "monday";
    case 2:
      return "tuesday";
    case 3:
      return "wednesday";
    case 4:
      return "thursday";
    case 5:
      return "friday";
    default:
      return "weekend";
  }
}
function sessionOverlap(clock) {
  const h = clock.utcHour;
  if (h >= 8 && h < 9) return "asian_london";
  if (h >= 13 && h < 17) return "london_newyork";
  return "none";
}
function timeSession(session, clock) {
  const h = clock.utcHour;
  switch (session) {
    case "london_newyork_overlap":
      return h >= 13 && h < 17 ? "active" : "inactive";
    case "london":
      return h >= 8 && h < 16 ? "active" : "inactive";
    case "new_york":
      return h >= 13 && h < 22 ? "active" : "inactive";
    case "tokyo":
      return h >= 0 && h < 9 ? "active" : "inactive";
    default:
      return "inactive";
  }
}
function judasSwing(candles, currentPrice, clock) {
  if (candles.length < 8) return "none";
  const hour = clock.utcHour;
  const inKZ = hour >= 8 && hour <= 9 || hour >= 13 && hour <= 14 || hour >= 2 && hour <= 3;
  if (!inKZ) return "none";
  const atrVal = atr(candles, 5, currentPrice);
  const rec = candles.slice(Math.max(0, candles.length - 6));
  const mxH = Math.max(...rec.map((c) => c.high));
  const mnL = Math.min(...rec.map((c) => c.low));
  const midC = rec[Math.trunc(rec.length / 2)].close;
  if (mnL < rec[0].close - atrVal * 1.5 && currentPrice > midC) return "bullish";
  if (mxH > rec[0].close + atrVal * 1.5 && currentPrice < midC) return "bearish";
  return "none";
}
register("market_structure", ({ candles, currentPrice }) => marketStructure(candles, currentPrice));
register("break_of_structure", ({ candles, currentPrice }) => {
  const ms = marketStructure(candles, currentPrice);
  return ms === "break_of_structure_bullish" ? "bullish" : ms === "break_of_structure_bearish" ? "bearish" : "none";
});
register("change_of_character", ({ candles, currentPrice }) => {
  const ms = marketStructure(candles, currentPrice);
  return ms === "change_of_character_bullish" ? "bullish" : ms === "change_of_character_bearish" ? "bearish" : "none";
});
register("order_block", ({ candles, currentPrice }) => orderBlock(candles, currentPrice));
register("fair_value_gap", ({ candles, currentPrice }) => fairValueGap(candles, currentPrice));
register("liquidity_sweep", ({ candles, currentPrice }) => liquiditySweep(candles, currentPrice));
register("wyckoff_spring", ({ candles, currentPrice }) => wyckoffSpring(candles, currentPrice));
register("wyckoff_upthrust", ({ candles, currentPrice }) => wyckoffUpthrust(candles, currentPrice));
register("session_open", ({ candles, currentPrice }) => sessionOpen(candles, currentPrice));
register("opening_range", ({ candles, currentPrice }) => openingRange(candles, currentPrice));
register("divergence", ({ candles }) => {
  const d = rsiDivergence(candles);
  return d === "bullish" ? 1 : d === "bearish" ? -1 : 0;
});
register("kill_zone", ({ clock }) => killZone(clock));
register("day_of_week", ({ clock }) => dayOfWeek(clock));
register("session_overlap", ({ clock }) => sessionOverlap(clock));
register("session", ({ rule, clock }) => timeSession(rule.pattern ?? "london", clock));
register(
  "time_analysis",
  ({ rule, clock }) => timeSession(rule.pattern ?? "london_newyork_overlap", clock)
);
register(
  "judas_swing",
  ({ candles, currentPrice, clock }) => judasSwing(candles, currentPrice, clock)
);

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
var last2 = (xs) => [xs[xs.length - 1], xs[xs.length - 2]];
function doubleTop(candles, currentPrice) {
  if (candles.length < 20) return "none";
  const { h } = swingPoints(candles, 40, 2);
  if (h.length < 2) return "none";
  const tol = 15e-4;
  const [a, b] = last2(h);
  return Math.abs(a - b) < tol && currentPrice < a - tol ? "bearish" : "none";
}
function doubleBottom(candles, currentPrice) {
  if (candles.length < 20) return "none";
  const { l } = swingPoints(candles, 40, 2);
  if (l.length < 2) return "none";
  const tol = 15e-4;
  const [a, b] = last2(l);
  return Math.abs(a - b) < tol && currentPrice > a + tol ? "bullish" : "none";
}
function headAndShoulders(candles, currentPrice) {
  if (candles.length < 30) return "none";
  const { h } = swingPoints(candles, 60, 2);
  if (h.length < 3) return "none";
  const left = h[h.length - 3], head = h[h.length - 2], right = h[h.length - 1];
  const shoulderAvg = (left + right) / 2;
  if (head > left * 1.002 && head > right * 1.002 && Math.abs(left - right) < shoulderAvg * 3e-3 && currentPrice < shoulderAvg) return "bearish";
  return "none";
}
function inverseHeadAndShoulders(candles, currentPrice) {
  if (candles.length < 30) return "none";
  const { l } = swingPoints(candles, 60, 2);
  if (l.length < 3) return "none";
  const left = l[l.length - 3], head = l[l.length - 2], right = l[l.length - 1];
  const shoulderAvg = (left + right) / 2;
  if (head < left * 0.998 && head < right * 0.998 && Math.abs(left - right) < shoulderAvg * 3e-3 && currentPrice > shoulderAvg) return "bullish";
  return "none";
}
function ascendingTriangle(candles, currentPrice) {
  if (candles.length < 20) return "none";
  const { h, l } = swingPoints(candles, 30, 2);
  if (h.length < 2 || l.length < 2) return "none";
  const [h1, h2] = last2(h);
  const [l1, l2] = last2(l);
  return Math.abs(h1 - h2) < 15e-4 && l1 > l2 && currentPrice > h1 ? "bullish" : "none";
}
function descendingTriangle(candles, currentPrice) {
  if (candles.length < 20) return "none";
  const { h, l } = swingPoints(candles, 30, 2);
  if (h.length < 2 || l.length < 2) return "none";
  const [h1, h2] = last2(h);
  const [l1, l2] = last2(l);
  return Math.abs(l1 - l2) < 15e-4 && h1 < h2 && currentPrice < l1 ? "bearish" : "none";
}
function symmetricalTriangle(candles, currentPrice) {
  if (candles.length < 20) return "none";
  const { h, l } = swingPoints(candles, 30, 2);
  if (h.length < 2 || l.length < 2) return "none";
  const [h1, h2] = last2(h);
  const [l1, l2] = last2(l);
  if (!(h1 < h2) || !(l1 > l2)) return "none";
  if (currentPrice > h1) return "bullish";
  if (currentPrice < l1) return "bearish";
  return "none";
}
function wedge(candles, currentPrice, rising) {
  if (candles.length < 20) return "none";
  const { h, l } = swingPoints(candles, 30, 2);
  if (h.length < 2 || l.length < 2) return "none";
  const [h1, h2] = last2(h);
  const [l1, l2] = last2(l);
  if (rising) {
    if (h1 > h2 && l1 > l2 && currentPrice < l1) return "bearish";
  } else {
    if (h1 < h2 && l1 < l2 && currentPrice > h1) return "bullish";
  }
  return "none";
}
function channel(candles, up) {
  if (candles.length < 20) return "none";
  const { h, l } = swingPoints(candles, 30, 2);
  if (h.length < 2 || l.length < 2) return "none";
  const [h1, h2] = last2(h);
  const [l1, l2] = last2(l);
  if (up) {
    if (h1 > h2 && l1 > l2) return "bullish";
  } else {
    if (h1 < h2 && l1 < l2) return "bearish";
  }
  return "none";
}
function rectangle(candles, currentPrice) {
  if (candles.length < 20) return "none";
  const { h, l } = swingPoints(candles, 30, 2);
  if (h.length < 2 || l.length < 2) return "none";
  const tol = 2e-3;
  const [h1, h2] = last2(h);
  const [l1, l2] = last2(l);
  if (!(Math.abs(h1 - h2) < tol) || !(Math.abs(l1 - l2) < tol)) return "none";
  if (currentPrice > h1) return "bullish";
  if (currentPrice < l1) return "bearish";
  return "none";
}
register("candle_pattern", ({ candles }) => candlePatterns(candles));
register("double_top", ({ candles, currentPrice }) => doubleTop(candles, currentPrice));
register("double_bottom", ({ candles, currentPrice }) => doubleBottom(candles, currentPrice));
register(
  "head_and_shoulders",
  ({ candles, currentPrice }) => headAndShoulders(candles, currentPrice)
);
register(
  "inverse_head_and_shoulders",
  ({ candles, currentPrice }) => inverseHeadAndShoulders(candles, currentPrice)
);
register("ascending_triangle", ({ candles, currentPrice }) => ascendingTriangle(candles, currentPrice));
register(
  "descending_triangle",
  ({ candles, currentPrice }) => descendingTriangle(candles, currentPrice)
);
register(
  "symmetrical_triangle",
  ({ candles, currentPrice }) => symmetricalTriangle(candles, currentPrice)
);
register("rising_wedge", ({ candles, currentPrice }) => wedge(candles, currentPrice, true));
register("falling_wedge", ({ candles, currentPrice }) => wedge(candles, currentPrice, false));
register("channel_up", ({ candles }) => channel(candles, true));
register("channel_down", ({ candles }) => channel(candles, false));
register(
  ["rectangle", "horizontal_channel"],
  ({ candles, currentPrice }) => rectangle(candles, currentPrice)
);
register("pennant", ({ candles, currentPrice }) => symmetricalTriangle(candles, currentPrice));

// packages/engine/src/indicators/advanced.ts
var idiv = (a, b) => Math.trunc(a / b);
function wma(candles, period, currentPrice) {
  const n = Math.min(period, candles.length);
  let sum = 0, wt = 0;
  for (let i = 0; i < n; i++) {
    const w = n - i;
    sum += candles[candles.length - 1 - i].close * w;
    wt += w;
  }
  return wt > 0 ? sum / wt : currentPrice;
}
function hma(candles, period, currentPrice) {
  return 2 * wma(candles, Math.max(1, idiv(period, 2)), currentPrice) - wma(candles, period, currentPrice);
}
function dema(candles, p, currentPrice) {
  return 2 * ema(candles, p, currentPrice) - ema(candles, Math.max(1, idiv(p, 2)), currentPrice);
}
function tema(candles, p, currentPrice) {
  return 3 * ema(candles, p, currentPrice) - 3 * ema(candles, Math.max(1, idiv(p, 2)), currentPrice) + ema(candles, Math.max(1, idiv(p, 3)), currentPrice);
}
function alma(candles, period, currentPrice) {
  if (candles.length < period) return currentPrice;
  const sigma = 6, offset = 0.85;
  const mu = offset * (period - 1);
  const s = period / sigma;
  let sum = 0, wt = 0;
  for (let i = 0; i < period; i++) {
    const w = Math.exp(-((i - mu) ** 2) / (2 * s * s));
    sum += candles[candles.length - period + i].close * w;
    wt += w;
  }
  return wt > 0 ? sum / wt : currentPrice;
}
function kama(candles, period, currentPrice) {
  if (candles.length < period + 1) return currentPrice;
  const fastSc = 2 / 3, slowSc = 2 / 31;
  const closes = candles.map((c) => c.close);
  const n = Math.min(period, closes.length - 1);
  let value = closes[closes.length - 1 - n];
  for (let i = closes.length - n; i < closes.length; i++) {
    let noise = 0;
    for (let j = i - Math.min(n, i); j < i; j++) noise += Math.abs(closes[j + 1] - closes[j]);
    const er = noise > 0 ? Math.abs(closes[i] - closes[i - Math.min(n, i)]) / noise : 0;
    const sc = (er * (fastSc - slowSc) + slowSc) ** 2;
    value += sc * (closes[i] - value);
  }
  return value;
}
function t3(candles, period, currentPrice) {
  const vf = 0.7;
  const c1 = -(vf * vf * vf);
  const c2 = 3 * vf * vf + 3 * vf * vf * vf;
  const c3 = -6 * vf * vf - 3 * vf - 3 * vf * vf * vf;
  const c4 = 1 + 3 * vf + vf * vf * vf + 3 * vf * vf;
  const e1 = ema(candles, period, currentPrice);
  const e2 = ema(candles, Math.max(1, idiv(period, 2)), currentPrice);
  const e3 = ema(candles, Math.max(1, idiv(period, 3)), currentPrice);
  const e4 = ema(candles, Math.max(1, idiv(period, 4)), currentPrice);
  return c4 * e1 + c3 * e2 + c2 * e3 + c1 * e4;
}
function linearRegression(candles, period, currentPrice) {
  const n = Math.min(period, candles.length);
  if (n < 2) return currentPrice;
  const cl = candles.slice(candles.length - n).map((c) => c.close);
  let sx = 0, sy = 0, sxy = 0, sx2 = 0;
  for (let i = 0; i < n; i++) {
    sx += i;
    sy += cl[i];
    sxy += i * cl[i];
    sx2 += i * i;
  }
  const d = n * sx2 - sx * sx;
  if (d === 0) return currentPrice;
  const slope = (n * sxy - sx * sy) / d;
  return (sy - slope * sx) / n + slope * (n - 1);
}
function ao(candles) {
  if (candles.length < 34) return 0;
  let s5 = 0, s34 = 0;
  for (let i = candles.length - 5; i < candles.length; i++) s5 += (candles[i].high + candles[i].low) / 2;
  for (let i = candles.length - 34; i < candles.length; i++) s34 += (candles[i].high + candles[i].low) / 2;
  return s5 / 5 - s34 / 34;
}
function ac(candles) {
  if (candles.length < 39) return 0;
  const aoNow = ao(candles);
  let aoSum = 0;
  for (let i = 0; i < 5; i++) {
    const sub = candles.slice(0, candles.length - i);
    let s5 = 0, s34 = 0;
    for (let j = sub.length - 5; j < sub.length; j++) s5 += (sub[j].high + sub[j].low) / 2;
    for (let j = sub.length - 34; j < sub.length; j++) s34 += (sub[j].high + sub[j].low) / 2;
    aoSum += s5 / 5 - s34 / 34;
  }
  return aoNow - aoSum / 5;
}
function cmo(candles, period) {
  const n = Math.min(period, candles.length - 1);
  let su = 0, sd = 0;
  for (let i = candles.length - n; i < candles.length; i++) {
    const d = candles[i].close - candles[i - 1].close;
    if (d > 0) su += d;
    else sd += Math.abs(d);
  }
  return su + sd > 0 ? 100 * (su - sd) / (su + sd) : 0;
}
function rvi(candles, period) {
  if (candles.length < period + 3) return 0;
  let ns = 0, ds = 0;
  for (let i = candles.length - period; i < candles.length - 3; i++) {
    const [a, b, c, d] = [candles[i], candles[i + 1], candles[i + 2], candles[i + 3]];
    ns += a.close - a.open + 2 * (b.close - b.open) + 2 * (c.close - c.open) + (d.close - d.open);
    ds += a.high - a.low + 2 * (b.high - b.low) + 2 * (c.high - c.low) + (d.high - d.low);
  }
  return ds > 1e-4 ? ns / ds : 0;
}
function connorsRsi(candles, currentPrice) {
  const rsi3 = rsi(candles, 3);
  const rocVal = roc(candles, 1, currentPrice);
  const pr = candles.length > 100 ? clamp(
    (currentPrice - candles[candles.length - 100].close) / candles[candles.length - 100].close * 100,
    0,
    100
  ) : 50;
  return (rsi3 + (rocVal > 0 ? 100 : 0) + pr) / 3;
}
function stc(candles, currentPrice) {
  const macd = fullMacd(candles, currentPrice).macd;
  const rsiVal = rsi(candles, 14);
  if (macd > 0 && rsiVal > 50) return 75;
  if (macd < 0 && rsiVal < 50) return 25;
  return 50;
}
function bop(candles) {
  const c = candles[candles.length - 1];
  const r = c.high - c.low;
  return r > 0 ? (c.close - c.open) / r : 0;
}
function elderBullPower(candles, p, currentPrice) {
  return candles[candles.length - 1].high - ema(candles, Math.min(p, candles.length), currentPrice);
}
function elderBearPower(candles, p, currentPrice) {
  return candles[candles.length - 1].low - ema(candles, Math.min(p, candles.length), currentPrice);
}
function aroon(candles, period) {
  const n = Math.min(period, candles.length);
  const sub = candles.slice(candles.length - n);
  let hi = 0, li = 0;
  for (let i = 0; i < sub.length; i++) {
    if (sub[i].high >= sub[hi].high) hi = i;
    if (sub[i].low <= sub[li].low) li = i;
  }
  return { up: hi / (n - 1) * 100, down: li / (n - 1) * 100 };
}
function vortex(candles, period) {
  const n = Math.min(period, candles.length - 1);
  if (n < 1) return { plus: 1, minus: 1 };
  let vp = 0, vm = 0, tr = 0;
  for (let i = candles.length - n; i < candles.length; i++) {
    const c = candles[i], p = candles[i - 1];
    vp += Math.abs(c.high - p.low);
    vm += Math.abs(c.low - p.high);
    tr += Math.max(c.high, p.close) - Math.min(c.low, p.close);
  }
  return tr > 0 ? { plus: vp / tr, minus: vm / tr } : { plus: 1, minus: 1 };
}
function historicalVolatility(candles, period) {
  if (candles.length < period + 1) return 0;
  const rets = [];
  for (let i = candles.length - period; i < candles.length; i++) {
    rets.push(Math.log(candles[i].close / candles[i - 1].close));
  }
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const v = rets.reduce((a, r) => a + (r - mean) ** 2, 0);
  return Math.sqrt(v / rets.length) * Math.sqrt(252) * 100;
}
function ulcerIndex(candles, period) {
  const n = Math.min(period, candles.length);
  let maxC = candles[candles.length - 1].close;
  let sq = 0;
  for (const c of candles.slice(candles.length - n)) {
    maxC = Math.max(maxC, c.close);
    sq += ((c.close - maxC) / maxC * 100) ** 2;
  }
  return Math.sqrt(sq / n);
}
function chaikinVolatility(candles, period) {
  if (candles.length < period * 2) return 0;
  let ema1 = 0, ema2 = 0;
  const alpha = 2 / (period + 1);
  const n = Math.min(period * 2, candles.length);
  for (let i = candles.length - n; i < candles.length - period; i++) {
    ema2 = alpha * (candles[i].high - candles[i].low) + (1 - alpha) * ema2;
  }
  for (let i = candles.length - period; i < candles.length; i++) {
    ema1 = alpha * (candles[i].high - candles[i].low) + (1 - alpha) * ema1;
  }
  return ema2 > 0 ? (ema1 - ema2) / ema2 * 100 : 0;
}
function alligator(candles, currentPrice) {
  if (candles.length < 13) return "sleeping";
  const jaw = ema(candles, Math.min(13, candles.length), currentPrice);
  const teeth = ema(candles, Math.min(8, candles.length), currentPrice);
  const lips = ema(candles, Math.min(5, candles.length), currentPrice);
  if (lips > teeth && teeth > jaw) return "bullish";
  if (lips < teeth && teeth < jaw) return "bearish";
  return "sleeping";
}
function chandeKrollStop(candles, currentPrice, atrPeriod = 10, mult = 1.5, stopPeriod = 9) {
  if (candles.length < atrPeriod + stopPeriod) return "none";
  const atrVal = atr(candles, atrPeriod, currentPrice);
  const sub = candles.slice(candles.length - stopPeriod);
  const hiH = Math.max(...sub.map((c) => c.high));
  const loL = Math.min(...sub.map((c) => c.low));
  const stopLong = hiH - mult * atrVal;
  const stopShort = loL + mult * atrVal;
  if (currentPrice > stopShort) return "bullish";
  if (currentPrice < stopLong) return "bearish";
  return "none";
}
function advancedCandlePattern(candles) {
  if (candles.length < 5) return "none";
  const c0 = candles[candles.length - 1];
  const c1 = candles[candles.length - 2];
  const c2 = candles.length > 2 ? candles[candles.length - 3] : c1;
  const range0 = c0.high - c0.low;
  const body0 = Math.abs(c0.close - c0.open);
  const upWick0 = c0.high - Math.max(c0.open, c0.close);
  const dnWick0 = Math.min(c0.open, c0.close) - c0.low;
  if (body0 < range0 * 0.1) {
    if (dnWick0 > range0 * 0.6 && upWick0 < range0 * 0.1) return "dragonfly_doji";
    if (upWick0 > range0 * 0.6 && dnWick0 < range0 * 0.1) return "gravestone_doji";
    if (upWick0 > range0 * 0.3 && dnWick0 > range0 * 0.3) return "long_legged_doji";
    return "doji";
  }
  if (body0 > range0 * 0.95) return c0.close > c0.open ? "bullish_marubozu" : "bearish_marubozu";
  if (body0 < range0 * 0.3 && upWick0 > body0 && dnWick0 > body0) return "spinning_top";
  if (dnWick0 > body0 * 2 && upWick0 < body0 * 0.5 && range0 > 1e-4) {
    return c0.close > c0.open ? "hammer" : "hanging_man";
  }
  if (upWick0 > body0 * 2 && dnWick0 < body0 * 0.5 && range0 > 1e-4) {
    return c0.close > c0.open ? "inverted_hammer" : "shooting_star";
  }
  const body1 = Math.abs(c1.close - c1.open);
  if (c1.close < c1.open && c0.close > c0.open && c0.open <= c1.close && c0.close >= c1.open) {
    return "bullish_engulfing";
  }
  if (c1.close > c1.open && c0.close < c0.open && c0.open >= c1.close && c0.close <= c1.open) {
    return "bearish_engulfing";
  }
  if (c1.close < c1.open && c0.close > c0.open && c0.open > c1.close && c0.close < c1.open) {
    return "bullish_harami";
  }
  if (c1.close > c1.open && c0.close < c0.open && c0.open < c1.close && c0.close > c1.open) {
    return "bearish_harami";
  }
  if (c1.close < c1.open && body0 < body1 * 0.25 && c0.open > c1.close && c0.close < c1.open) {
    return "bullish_harami_cross";
  }
  if (c1.close > c1.open && body0 < body1 * 0.25 && c0.open < c1.close && c0.close > c1.open) {
    return "bearish_harami_cross";
  }
  if (c1.close < c1.open && c0.close > c0.open && c0.open < c1.close && c0.close > (c1.open + c1.close) / 2) return "piercing_line";
  if (c1.close > c1.open && c0.close < c0.open && c0.open > c1.close && c0.close < (c1.open + c1.close) / 2) return "dark_cloud_cover";
  if (Math.abs(c1.high - c0.high) < 5e-4 && c1.close > c1.open && c0.close < c0.open) {
    return "tweezer_top";
  }
  if (Math.abs(c1.low - c0.low) < 5e-4 && c1.close < c1.open && c0.close > c0.open) {
    return "tweezer_bottom";
  }
  if (candles.length >= 3) {
    const body2 = Math.abs(c2.close - c2.open);
    if (c2.close < c2.open && body1 < body2 * 0.3 && c0.close > c0.open && c0.close > (c2.open + c2.close) / 2) return "morning_star";
    if (c2.close > c2.open && body1 < body2 * 0.3 && c0.close < c0.open && c0.close < (c2.open + c2.close) / 2) return "evening_star";
    if (c2.close > c2.open && c1.close > c1.open && c0.close > c0.open && c1.close > c2.close && c0.close > c1.close) return "three_white_soldiers";
    if (c2.close < c2.open && c1.close < c1.open && c0.close < c0.open && c1.close < c2.close && c0.close < c1.close) return "three_black_crows";
    if (c2.close < c2.open && c1.close > c1.open && c1.open > c2.close && c1.close < c2.open && c0.close > c1.close) return "three_inside_up";
    if (c2.close > c2.open && c1.close < c1.open && c1.open < c2.close && c1.close > c2.open && c0.close < c1.close) return "three_inside_down";
    if (c1.close < c1.open && c0.close > c0.open && c0.open >= c1.open && Math.abs(c0.open - c1.open) < 2e-4) return "bullish_kicker";
    if (c1.close > c1.open && c0.close < c0.open && c0.open <= c1.open && Math.abs(c0.open - c1.open) < 2e-4) return "bearish_kicker";
    if (c2.close < c2.open && body1 < range0 * 0.1 && c0.close > c0.open && c1.low > c2.low && c1.low > c0.low) return "abandoned_baby_bullish";
    if (c2.close > c2.open && body1 < range0 * 0.1 && c0.close < c0.open && c1.high < c2.high && c1.high < c0.high) return "abandoned_baby_bearish";
  }
  return "none";
}
register(
  [
    "advanced_candle",
    "doji",
    "dragonfly_doji",
    "gravestone_doji",
    "spinning_top",
    "marubozu",
    "tweezer",
    "harami",
    "kicker",
    "abandoned_baby",
    "belt_hold",
    "three_inside",
    "three_outside"
  ],
  ({ candles }) => advancedCandlePattern(candles)
);
register(["hma", "hull_ma"], ({ candles, rule, currentPrice }) => hma(candles, rule.period, currentPrice));
register("dema", ({ candles, rule, currentPrice }) => dema(candles, rule.period, currentPrice));
register("tema", ({ candles, rule, currentPrice }) => tema(candles, rule.period, currentPrice));
register("alma", ({ candles, rule, currentPrice }) => alma(candles, rule.period, currentPrice));
register("kama", ({ candles, rule, currentPrice }) => kama(candles, rule.period, currentPrice));
register("t3", ({ candles, rule, currentPrice }) => t3(candles, rule.period, currentPrice));
register(
  ["lsma", "linear_regression"],
  ({ candles, rule, currentPrice }) => linearRegression(candles, rule.period, currentPrice)
);
register(["ao", "awesome_oscillator"], ({ candles }) => ao(candles));
register(["ac", "accelerator_oscillator"], ({ candles }) => ac(candles));
register("cmo", ({ candles, rule }) => cmo(candles, rule.period));
register("rvi", ({ candles, rule }) => rvi(candles, rule.period));
register("connors_rsi", ({ candles, currentPrice }) => connorsRsi(candles, currentPrice));
register("stc", ({ candles, currentPrice }) => stc(candles, currentPrice));
register("bop", ({ candles }) => bop(candles));
register(
  ["elder_bull_power", "bull_power"],
  ({ candles, rule, currentPrice }) => elderBullPower(candles, rule.period, currentPrice)
);
register(
  ["elder_bear_power", "bear_power"],
  ({ candles, rule, currentPrice }) => elderBearPower(candles, rule.period, currentPrice)
);
register("aroon_up", ({ candles, rule }) => aroon(candles, rule.period).up);
register("aroon_down", ({ candles, rule }) => aroon(candles, rule.period).down);
register(["aroon", "aroon_oscillator"], ({ candles, rule }) => {
  const a = aroon(candles, rule.period);
  return a.up - a.down;
});
register("vortex_plus", ({ candles, rule }) => vortex(candles, rule.period).plus);
register("vortex_minus", ({ candles, rule }) => vortex(candles, rule.period).minus);
register("vortex", ({ candles, rule }) => {
  const v = vortex(candles, rule.period);
  return v.plus - v.minus;
});
register(
  ["historical_volatility", "hv"],
  ({ candles, rule }) => historicalVolatility(candles, rule.period)
);
register("ulcer_index", ({ candles, rule }) => ulcerIndex(candles, rule.period));
register("chaikin_volatility", ({ candles, rule }) => chaikinVolatility(candles, rule.period));
register("alligator", ({ candles, currentPrice }) => alligator(candles, currentPrice));
register(
  ["chande_kroll_stop", "ckstop"],
  ({ candles, currentPrice }) => chandeKrollStop(candles, currentPrice)
);

// packages/engine/src/indicators/ict.ts
var inRange = (v, lo, hi) => v >= lo && v <= hi;
function premiumDiscountPos(candles, currentPrice) {
  if (candles.length < 5) return 50;
  let rH = 0, rL = Infinity;
  const lb = Math.min(50, candles.length);
  for (let i = candles.length - lb; i < candles.length; i++) {
    rH = Math.max(rH, candles[i].high);
    rL = Math.min(rL, candles[i].low);
  }
  const range = rH - rL;
  return range > 0 ? (currentPrice - rL) / range * 100 : 50;
}
function expansion(candles, currentPrice) {
  if (candles.length < 10) return "none";
  if (atr(candles, 5, currentPrice) < atr(candles, 14, currentPrice) * 1.3) return "none";
  const start = candles[candles.length - 5].close;
  if (currentPrice > start) return "bullish";
  if (currentPrice < start) return "bearish";
  return "none";
}
function internalBos(candles, currentPrice) {
  if (candles.length < 8) return "none";
  const { h, l } = swingPoints(candles, 12, 1);
  if (h.length && currentPrice > h[h.length - 1]) return "bullish";
  if (l.length && currentPrice < l[l.length - 1]) return "bearish";
  return "none";
}
function externalBos(candles, currentPrice) {
  if (candles.length < 20) return "none";
  const { h, l } = swingPoints(candles, candles.length, 3);
  if (h.length >= 2 && currentPrice > h[h.length - 2]) return "bullish";
  if (l.length >= 2 && currentPrice < l[l.length - 2]) return "bearish";
  return "none";
}
function breakerBlock(candles, currentPrice) {
  if (candles.length < 15) return "none";
  for (let i = candles.length - 8; i >= 3; i--) {
    const obH = candles[i].high, obL = candles[i].low;
    let brokeAbove = false, brokeBelow = false;
    for (let j = i + 1; j < Math.min(i + 7, candles.length); j++) {
      if (candles[j].close > obH) brokeAbove = true;
      if (candles[j].close < obL) brokeBelow = true;
    }
    if (brokeAbove && currentPrice >= obL && currentPrice <= obH) return "bullish";
    if (brokeBelow && currentPrice >= obL && currentPrice <= obH) return "bearish";
  }
  return "none";
}
function rejectionBlock(candles, currentPrice) {
  if (candles.length < 3) return "none";
  for (let i = candles.length - 1; i >= Math.max(0, candles.length - 5); i--) {
    const c = candles[i];
    const range = c.high - c.low;
    if (range < 1e-4) continue;
    const body = Math.abs(c.close - c.open);
    const upW = c.high - Math.max(c.open, c.close);
    const dnW = Math.min(c.open, c.close) - c.low;
    if (dnW > range * 0.6 && dnW > body * 2 && Math.abs(currentPrice - c.low) < range * 0.4) {
      return "bullish";
    }
    if (upW > range * 0.6 && upW > body * 2 && Math.abs(currentPrice - c.high) < range * 0.4) {
      return "bearish";
    }
  }
  return "none";
}
function mitigationBlock(candles, currentPrice) {
  if (candles.length < 15) return "none";
  const avg = avgBodySize(candles);
  for (let i = candles.length - 10; i >= 5; i--) {
    const c = candles[i];
    if (Math.abs(c.close - c.open) < avg * 2) continue;
    const zH = Math.max(c.open, c.close), zL = Math.min(c.open, c.close);
    let moved = false;
    for (let j = i + 1; j < Math.min(i + 5, candles.length - 1); j++) {
      if (Math.abs(candles[j].close - c.close) > avg * 3) {
        moved = true;
        break;
      }
    }
    if (moved && currentPrice >= zL && currentPrice <= zH) {
      return c.close > c.open ? "bullish" : "bearish";
    }
  }
  return "none";
}
function inverseFvg(candles, currentPrice) {
  if (candles.length < 10) return "none";
  for (let i = Math.min(candles.length - 4, candles.length - 1); i >= 4; i--) {
    const c1 = candles[i - 2], c3 = candles[i];
    if (c3.low > c1.high) {
      let filled = false;
      for (let j = i + 1; j < candles.length - 1; j++) {
        if (candles[j].low <= c1.high) {
          filled = true;
          break;
        }
      }
      if (filled && currentPrice >= c1.high && currentPrice <= c3.low) return "bearish";
    }
    if (c3.high < c1.low) {
      let filled = false;
      for (let j = i + 1; j < candles.length - 1; j++) {
        if (candles[j].high >= c1.low) {
          filled = true;
          break;
        }
      }
      if (filled && currentPrice >= c3.high && currentPrice <= c1.low) return "bullish";
    }
  }
  return "none";
}
function balancedPriceRange(candles, currentPrice) {
  if (candles.length < 10) return "none";
  const bL = [], bH = [], sL = [], sH = [];
  for (let i = 2; i < candles.length; i++) {
    const c1 = candles[i - 2], c3 = candles[i];
    if (c3.low > c1.high) {
      bL.push(c1.high);
      bH.push(c3.low);
    }
    if (c3.high < c1.low) {
      sL.push(c3.high);
      sH.push(c1.low);
    }
  }
  for (let b = 0; b < bL.length; b++) {
    for (let s = 0; s < sL.length; s++) {
      const oL = Math.max(bL[b], sL[s]), oH = Math.min(bH[b], sH[s]);
      if (oH > oL && currentPrice >= oL && currentPrice <= oH) return "active";
    }
  }
  return "none";
}
function equalHighs(candles, currentPrice) {
  if (candles.length < 20) return "none";
  const { h } = swingPoints(candles, 40, 2);
  if (h.length < 2) return "none";
  const tol = 1e-3;
  for (let i = h.length - 1; i >= 1; i--) {
    if (Math.abs(h[i] - h[i - 1]) < tol && currentPrice >= h[i] - tol) return "active";
  }
  return "none";
}
function equalLows(candles, currentPrice) {
  if (candles.length < 20) return "none";
  const { l } = swingPoints(candles, 40, 2);
  if (l.length < 2) return "none";
  const tol = 1e-3;
  for (let i = l.length - 1; i >= 1; i--) {
    if (Math.abs(l[i] - l[i - 1]) < tol && currentPrice <= l[i] + tol) return "active";
  }
  return "none";
}
function ote(candles, currentPrice) {
  if (candles.length < 20) return "none";
  let sH = 0, sL = Infinity, hIdx = 0, lIdx = 0;
  const lb = Math.min(30, candles.length - 3);
  for (let i = candles.length - lb; i < candles.length - 3; i++) {
    if (candles[i].high > sH) {
      sH = candles[i].high;
      hIdx = i;
    }
    if (candles[i].low < sL) {
      sL = candles[i].low;
      lIdx = i;
    }
  }
  const range = sH - sL;
  if (range < 1e-4) return "none";
  if (lIdx < hIdx) {
    if (currentPrice >= sH - range * 0.79 && currentPrice <= sH - range * 0.62) return "bullish";
  } else {
    if (currentPrice >= sL + range * 0.62 && currentPrice <= sL + range * 0.79) return "bearish";
  }
  return "none";
}
function marketMakerBuyModel(candles, currentPrice) {
  if (candles.length < 20) return "none";
  const ms = marketStructure(candles, currentPrice);
  const sweep = liquiditySweep(candles, currentPrice);
  const bearCtx = ms.includes("lower") || ms === "change_of_character_bullish" || sweep === "sell_side";
  return bearCtx && expansion(candles, currentPrice) === "bullish" ? "bullish" : "none";
}
function marketMakerSellModel(candles, currentPrice) {
  if (candles.length < 20) return "none";
  const ms = marketStructure(candles, currentPrice);
  const sweep = liquiditySweep(candles, currentPrice);
  const bullCtx = ms.includes("higher") || ms === "change_of_character_bearish" || sweep === "buy_side";
  return bullCtx && expansion(candles, currentPrice) === "bearish" ? "bearish" : "none";
}
function harmonic(candles, currentPrice, type) {
  if (candles.length < 40) return "none";
  const { h, l } = swingPoints(candles, 60, 2);
  if (h.length < 3 || l.length < 3) return "none";
  const xL = l.length >= 3 ? l[l.length - 3] : l[0];
  const aH = h.length >= 2 ? h[h.length - 2] : h[h.length - 1];
  const bL = l.length >= 2 ? l[l.length - 2] : l[l.length - 1];
  const cH = h[h.length - 1];
  const xa = aH - xL;
  const ab = aH - bL;
  const bc = cH - bL;
  if (xa < 1e-4) return "none";
  const abXa = ab / xa;
  const bcAb = bc / clamp(ab, 1e-4, Infinity);
  let matches = false;
  switch (type) {
    case "gartley":
      matches = inRange(abXa, 0.58, 0.65) && inRange(bcAb, 0.36, 0.9);
      break;
    case "bat":
      matches = inRange(abXa, 0.38, 0.52) && inRange(bcAb, 0.36, 0.9);
      break;
    case "butterfly":
      matches = inRange(abXa, 0.74, 0.82) && inRange(bcAb, 0.36, 0.9);
      break;
    case "crab":
      matches = inRange(abXa, 0.36, 0.62) && inRange(bcAb, 0.36, 0.9);
      break;
    case "shark":
      matches = inRange(abXa, 0.44, 0.55) && bcAb > 1.13;
      break;
    case "cypher":
      matches = inRange(abXa, 0.38, 0.62) && inRange(bcAb, 1.13, 1.41);
      break;
    case "ab_cd":
      matches = inRange(bcAb, 0.62, 0.79);
      break;
    default:
      matches = false;
  }
  if (!matches) return "none";
  return currentPrice < (xL + aH) / 2 ? "bullish" : "bearish";
}
register("internal_bos", ({ candles, currentPrice }) => internalBos(candles, currentPrice));
register("external_bos", ({ candles, currentPrice }) => externalBos(candles, currentPrice));
register("breaker_block", ({ candles, currentPrice }) => breakerBlock(candles, currentPrice));
register("rejection_block", ({ candles, currentPrice }) => rejectionBlock(candles, currentPrice));
register("mitigation_block", ({ candles, currentPrice }) => mitigationBlock(candles, currentPrice));
register("inverse_fvg", ({ candles, currentPrice }) => inverseFvg(candles, currentPrice));
register("bpr", ({ candles, currentPrice }) => balancedPriceRange(candles, currentPrice));
register(["eqh", "equal_highs"], ({ candles, currentPrice }) => equalHighs(candles, currentPrice));
register(["eql", "equal_lows"], ({ candles, currentPrice }) => equalLows(candles, currentPrice));
register("ote", ({ candles, currentPrice }) => ote(candles, currentPrice));
register("expansion", ({ candles, currentPrice }) => expansion(candles, currentPrice));
register(
  "market_maker_buy_model",
  ({ candles, currentPrice }) => marketMakerBuyModel(candles, currentPrice)
);
register(
  "market_maker_sell_model",
  ({ candles, currentPrice }) => marketMakerSellModel(candles, currentPrice)
);
register(
  "premium_zone",
  ({ candles, currentPrice }) => premiumDiscountPos(candles, currentPrice) > 62 ? "premium" : "none"
);
register(
  "discount_zone",
  ({ candles, currentPrice }) => premiumDiscountPos(candles, currentPrice) < 38 ? "discount" : "none"
);
register("dealing_range", ({ candles, currentPrice }) => {
  const p = premiumDiscountPos(candles, currentPrice);
  if (p > 62) return "premium";
  if (p < 38) return "discount";
  return "equilibrium";
});
register("imbalance", ({ candles, currentPrice }) => fairValueGap(candles, currentPrice));
register(["5_0", "ab_cd"], ({ candles, currentPrice }) => harmonic(candles, currentPrice, "ab_cd"));
register(["bat", "alternate_bat"], ({ candles, currentPrice }) => harmonic(candles, currentPrice, "bat"));
register(["crab", "deep_crab"], ({ candles, currentPrice }) => harmonic(candles, currentPrice, "crab"));
register("butterfly", ({ candles, currentPrice }) => harmonic(candles, currentPrice, "butterfly"));
register("cypher", ({ candles, currentPrice }) => harmonic(candles, currentPrice, "cypher"));
register("gartley", ({ candles, currentPrice }) => harmonic(candles, currentPrice, "gartley"));
register("shark", ({ candles, currentPrice }) => harmonic(candles, currentPrice, "shark"));

// packages/engine/src/indicators/schools.ts
var idiv2 = (a, b) => Math.trunc(a / b);
function pivotPoint(candles, currentPrice) {
  if (candles.length < 5) return "none";
  const c = candles[candles.length - 2];
  const p = (c.high + c.low + c.close) / 3;
  const r1 = 2 * p - c.low;
  const s1 = 2 * p - c.high;
  if (currentPrice > r1) return "above_r1";
  if (currentPrice < s1) return "below_s1";
  if (currentPrice > p) return "above_pivot";
  if (currentPrice < p) return "below_pivot";
  return "at_pivot";
}
function cpr(candles, currentPrice) {
  if (candles.length < 3) return "none";
  const c = candles[candles.length - 2];
  const p = (c.high + c.low + c.close) / 3;
  const tc = (c.high + c.low) / 2;
  const bc = 2 * p - tc;
  if (currentPrice > Math.max(tc, bc)) return "above_cpr";
  if (currentPrice < Math.min(tc, bc)) return "below_cpr";
  return "inside_cpr";
}
function supplyDemandZone(candles, currentPrice) {
  if (candles.length < 10) return "none";
  const avg = avgBodySize(candles);
  for (let i = candles.length - 8; i >= 2; i--) {
    const c = candles[i];
    if (Math.abs(c.close - c.open) < avg * 2) continue;
    const zH = Math.max(c.open, c.close), zL = Math.min(c.open, c.close);
    if (currentPrice >= zL && currentPrice <= zH) {
      return c.close > c.open ? "demand" : "supply";
    }
  }
  return "none";
}
function breakoutSignal(candles, currentPrice) {
  if (candles.length < 20) return "none";
  const { h, l } = swingPoints(candles, 20, 2);
  if (!h.length || !l.length) return "none";
  const res = h[h.length - 1], sup = l[l.length - 1];
  const atrVal = atr(candles, 14, currentPrice);
  if (currentPrice > res + atrVal * 0.3) return "bullish";
  if (currentPrice < sup - atrVal * 0.3) return "bearish";
  return "none";
}
function momentumSignal(candles, currentPrice) {
  if (candles.length < 10) return "none";
  const r = roc(candles, 5, currentPrice);
  if (r > 0.3) return "bullish";
  if (r < -0.3) return "bearish";
  return "none";
}
function meanReversionSignal(candles, currentPrice) {
  if (candles.length < 20) return "none";
  const rsiVal = rsi(candles, 14);
  const pos = premiumDiscountPos(candles, currentPrice);
  if (rsiVal < 25 && pos < 10) return "bullish";
  if (rsiVal > 75 && pos > 90) return "bearish";
  return "none";
}
function nrPattern(candles, currentPrice, n) {
  if (candles.length < n + 1) return "none";
  const recent = candles.slice(candles.length - n);
  const ranges = recent.map((c) => c.high - c.low);
  const lastRange = ranges[ranges.length - 1];
  if (!ranges.every((r) => r >= lastRange)) return "none";
  const last = recent[recent.length - 1];
  if (currentPrice > last.high) return "bullish";
  if (currentPrice < last.low) return "bearish";
  return "active";
}
function orbSignal(candles, currentPrice) {
  const r = openingRange(candles, currentPrice);
  if (r === "breakout_up") return "bullish";
  if (r === "breakout_down") return "bearish";
  return "none";
}
function heikinAshi(candles) {
  if (candles.length < 3) return "none";
  const c = candles[candles.length - 1];
  const p = candles[candles.length - 2];
  const haClose = (c.open + c.high + c.low + c.close) / 4;
  const haOpen = (p.open + p.close) / 2;
  if (haClose > haOpen && c.low === Math.min(c.open, c.close)) return "strong_bullish";
  if (haClose < haOpen && c.high === Math.max(c.open, c.close)) return "strong_bearish";
  if (haClose > haOpen) return "bullish";
  if (haClose < haOpen) return "bearish";
  return "none";
}
function anchoredVwap(candles, currentPrice) {
  if (candles.length < 5) return "none";
  const v = vwap(candles, currentPrice);
  if (currentPrice > v * 1.001) return "above";
  if (currentPrice < v * 0.999) return "below";
  return "at";
}
function vwapBands(candles, currentPrice) {
  if (candles.length < 5) return "none";
  const v = vwap(candles, currentPrice);
  const a = atr(candles, 14, currentPrice);
  if (currentPrice > v + a) return "above_upper";
  if (currentPrice < v - a) return "below_lower";
  if (currentPrice > v) return "above";
  if (currentPrice < v) return "below";
  return "at";
}
function gannAngle(candles, currentPrice) {
  if (candles.length < 10) return "none";
  const n = Math.min(10, candles.length - 1);
  const startPrice = candles[candles.length - 1 - n].close;
  const pipPerBar = (currentPrice - startPrice) / n;
  if (Math.abs(pipPerBar) < 5e-5) return "equilibrium";
  return pipPerBar > 0 ? "bullish" : "bearish";
}
function wolfeWave(candles, currentPrice) {
  if (candles.length < 30) return "none";
  const { h, l } = swingPoints(candles, 40, 2);
  if (h.length < 3 || l.length < 3) return "none";
  const pt1 = l[l.length - 3], pt3 = l[l.length - 2], pt5 = l[l.length - 1];
  const trend13 = pt3 - pt1;
  if (Math.abs(pt5 - (pt3 + trend13)) < Math.abs(trend13 * 0.15) && currentPrice > pt5) {
    return "bullish";
  }
  const ph1 = h[h.length - 3], ph3 = h[h.length - 2], ph5 = h[h.length - 1];
  const trendH = ph3 - ph1;
  if (Math.abs(ph5 - (ph3 + trendH)) < Math.abs(trendH * 0.15) && currentPrice < ph5) {
    return "bearish";
  }
  return "none";
}
function demarkSequential(candles) {
  if (candles.length < 13) return "none";
  let upCount = 0, dnCount = 0;
  for (let i = 4; i < candles.length; i++) {
    upCount = candles[i].close > candles[i - 4].close ? upCount + 1 : 0;
    dnCount = candles[i].close < candles[i - 4].close ? dnCount + 1 : 0;
  }
  if (upCount >= 9) return "sell_setup";
  if (dnCount >= 9) return "buy_setup";
  return "none";
}
function darvasBox(candles, currentPrice) {
  if (candles.length < 15) return "none";
  const recent = candles.slice(Math.max(0, candles.length - 10));
  const box = recent.slice(0, recent.length - 3);
  const boxH = Math.max(...box.map((c) => c.high));
  const boxL = Math.min(...box.map((c) => c.low));
  if (currentPrice > boxH) return "bullish";
  if (currentPrice < boxL) return "bearish";
  return "inside";
}
function cupAndHandle(candles, currentPrice) {
  if (candles.length < 30) return "none";
  const mid = idiv2(candles.length, 2);
  const leftH = Math.max(...candles.slice(0, idiv2(mid, 3)).map((c) => c.high));
  const bottomL = Math.min(...candles.slice(idiv2(mid, 3), idiv2(mid * 2, 3)).map((c) => c.low));
  const rightH = Math.max(...candles.slice(idiv2(mid * 2, 3), mid).map((c) => c.high));
  const handleL = Math.min(...candles.slice(mid).map((c) => c.low));
  const isU = Math.abs(leftH - rightH) < leftH * 0.01 && bottomL < leftH * 0.97;
  const isHandle = handleL > bottomL && handleL < leftH;
  return isU && isHandle && currentPrice > rightH ? "bullish" : "none";
}
register(
  ["cpr", "pivot_point"],
  ({ candles, currentPrice, rule }) => rule.indicator === "cpr" ? cpr(candles, currentPrice) : pivotPoint(candles, currentPrice)
);
register("supply_demand", ({ candles, currentPrice }) => supplyDemandZone(candles, currentPrice));
register("breakout", ({ candles, currentPrice }) => breakoutSignal(candles, currentPrice));
register(
  ["momentum", "momentum_trading"],
  ({ candles, currentPrice }) => momentumSignal(candles, currentPrice)
);
register("mean_reversion", ({ candles, currentPrice }) => meanReversionSignal(candles, currentPrice));
register("nr4", ({ candles, currentPrice }) => nrPattern(candles, currentPrice, 4));
register("nr7", ({ candles, currentPrice }) => nrPattern(candles, currentPrice, 7));
register(
  ["orb", "opening_range_breakout"],
  ({ candles, currentPrice }) => orbSignal(candles, currentPrice)
);
register("heikin_ashi", ({ candles }) => heikinAshi(candles));
register("anchored_vwap", ({ candles, currentPrice }) => anchoredVwap(candles, currentPrice));
register("vwap_bands", ({ candles, currentPrice }) => vwapBands(candles, currentPrice));
register("gann_angle", ({ candles, currentPrice }) => gannAngle(candles, currentPrice));
register("wolfe_waves", ({ candles, currentPrice }) => wolfeWave(candles, currentPrice));
register(["demark", "td_sequential"], ({ candles }) => demarkSequential(candles));
register("darvas_box", ({ candles, currentPrice }) => darvasBox(candles, currentPrice));
register("cup_and_handle", ({ candles, currentPrice }) => cupAndHandle(candles, currentPrice));

// packages/engine/src/indicators/oscillators2.ts
var idiv3 = (a, b) => Math.trunc(a / b);
function superTrend(candles, currentPrice, period = 10, mult = 3) {
  if (candles.length < period + 1) return "none";
  const atrVal = atr(candles, period, currentPrice);
  let upB = 0, dnB = 0, bull = true;
  for (let i = Math.max(1, candles.length - period * 2); i < candles.length; i++) {
    const hl2 = (candles[i].high + candles[i].low) / 2;
    const up = hl2 + mult * atrVal, dn = hl2 - mult * atrVal;
    upB = up < upB || candles[i - 1].close > upB ? up : upB;
    dnB = dn > dnB || candles[i - 1].close < dnB ? dn : dnB;
    bull = candles[i].close > upB ? true : candles[i].close < dnB ? false : bull;
  }
  return bull ? "bullish" : "bearish";
}
function ichimoku(candles, currentPrice) {
  if (candles.length < 52) return "none";
  const midOf = (n) => {
    const sub = candles.slice(Math.max(0, candles.length - n));
    return (Math.max(...sub.map((c) => c.high)) + Math.min(...sub.map((c) => c.low))) / 2;
  };
  const tenkan = midOf(9);
  const kijun = midOf(26);
  const senkouB = midOf(52);
  const senkouA = (tenkan + kijun) / 2;
  const cloudH = Math.max(senkouA, senkouB), cloudL = Math.min(senkouA, senkouB);
  if (currentPrice > cloudH && tenkan > kijun) return "strong_bullish";
  if (currentPrice < cloudL && tenkan < kijun) return "strong_bearish";
  if (currentPrice > cloudH) return "bullish";
  if (currentPrice < cloudL) return "bearish";
  return "in_cloud";
}
function ultimateOscillator(candles) {
  if (candles.length < 29) return 50;
  let bp7 = 0, tr7 = 0, bp14 = 0, tr14 = 0, bp28 = 0, tr28 = 0;
  const n = Math.min(28, candles.length - 1);
  for (let i = candles.length - n; i < candles.length; i++) {
    const c = candles[i], p = candles[i - 1];
    const bp = c.close - Math.min(c.low, p.close);
    const tr = Math.max(c.high, p.close) - Math.min(c.low, p.close);
    const pos = candles.length - i;
    if (pos <= 7) {
      bp7 += bp;
      tr7 += tr;
    }
    if (pos <= 14) {
      bp14 += bp;
      tr14 += tr;
    }
    bp28 += bp;
    tr28 += tr;
  }
  return 100 * (4 * (tr7 > 0 ? bp7 / tr7 : 0.5) + 2 * (tr14 > 0 ? bp14 / tr14 : 0.5) + (tr28 > 0 ? bp28 / tr28 : 0.5)) / 7;
}
function tsi(candles) {
  if (candles.length < 26) return 0;
  const n = Math.min(25, candles.length - 1);
  let ema1 = 0, aem1 = 0;
  const alpha = 2 / 14;
  for (let i = candles.length - n; i < candles.length; i++) {
    const mom = candles[i].close - candles[i - 1].close;
    ema1 = alpha * mom + (1 - alpha) * ema1;
    aem1 = alpha * Math.abs(mom) + (1 - alpha) * aem1;
  }
  return aem1 > 0 ? 100 * ema1 / aem1 : 0;
}
function fisherTransform(candles, period, currentPrice) {
  const n = Math.min(period, candles.length);
  const sub = candles.slice(candles.length - n);
  const hi = Math.max(...sub.map((c) => c.high));
  const lo = Math.min(...sub.map((c) => c.low));
  const range = hi - lo;
  if (range < 1e-4) return 0;
  const v = clamp(2 * ((currentPrice - lo) / range) - 1, -0.999, 0.999);
  return 0.5 * Math.log((1 + v) / (1 - v));
}
function ppo(candles, currentPrice) {
  const e26 = ema(candles, Math.min(26, candles.length), currentPrice);
  return e26 > 0 ? (ema(candles, Math.min(12, candles.length), currentPrice) - e26) / e26 * 100 : 0;
}
function trix(candles, p, currentPrice) {
  const e = ema(candles, p, currentPrice);
  const e2 = ema(candles, Math.max(1, idiv3(p, 2)), currentPrice);
  return e2 > 0 ? (e - e2) / e2 * 100 : 0;
}
function kst(candles, currentPrice) {
  return roc(candles, 10, currentPrice) + roc(candles, 15, currentPrice) * 2 + roc(candles, 20, currentPrice) * 3 + roc(candles, 30, currentPrice) * 4;
}
function dpo(candles, period) {
  if (candles.length < period + 1) return 0;
  const shift = idiv3(period, 2) + 1;
  const refIdx = candles.length - 1 - shift;
  if (refIdx < 0) return 0;
  const n = Math.min(period, refIdx + 1);
  let sum = 0;
  for (let i = refIdx - n + 1; i <= refIdx; i++) sum += candles[i].close;
  return candles[refIdx].close - sum / n;
}
function keltnerChannel(candles, currentPrice) {
  const mid = ema(candles, Math.min(20, candles.length), currentPrice);
  const a = atr(candles, 10, currentPrice);
  if (currentPrice > mid + 2 * a) return "above_upper";
  if (currentPrice < mid - 2 * a) return "below_lower";
  if (currentPrice > mid) return "upper_half";
  return "lower_half";
}
function donchianChannel(candles, period, currentPrice) {
  const n = Math.min(period, candles.length);
  const sub = candles.slice(candles.length - n);
  const hi = Math.max(...sub.map((c) => c.high));
  const lo = Math.min(...sub.map((c) => c.low));
  if (currentPrice >= hi) return "at_upper";
  if (currentPrice <= lo) return "at_lower";
  return "inside";
}
function massIndex(candles, period) {
  if (candles.length < period + 9) return 25;
  const seed = candles[candles.length - period - 9];
  let e1 = seed.high - seed.low;
  let e2 = e1;
  let mi = 0;
  const alpha = 2 / 10;
  for (let i = candles.length - period; i < candles.length; i++) {
    e1 = alpha * (candles[i].high - candles[i].low) + (1 - alpha) * e1;
    e2 = alpha * e1 + (1 - alpha) * e2;
    if (e2 > 0) mi += e1 / e2;
  }
  return mi;
}
register(
  "supertrend",
  ({ candles, currentPrice, rule }) => superTrend(candles, currentPrice, rule.period, rule.value ?? 3)
);
register("ichimoku", ({ candles, currentPrice }) => ichimoku(candles, currentPrice));
register("ultimate_oscillator", ({ candles }) => ultimateOscillator(candles));
register("tsi", ({ candles }) => tsi(candles));
register(
  "fisher_transform",
  ({ candles, rule, currentPrice }) => fisherTransform(candles, rule.period, currentPrice)
);
register("ppo", ({ candles, currentPrice }) => ppo(candles, currentPrice));
register("trix", ({ candles, rule, currentPrice }) => trix(candles, rule.period, currentPrice));
register("kst", ({ candles, currentPrice }) => kst(candles, currentPrice));
register("dpo", ({ candles, rule }) => dpo(candles, rule.period));
register("keltner_channel", ({ candles, currentPrice }) => keltnerChannel(candles, currentPrice));
register(
  "donchian_channel",
  ({ candles, rule, currentPrice }) => donchianChannel(candles, rule.period, currentPrice)
);
register("mass_index", ({ candles, rule }) => massIndex(candles, rule.period));

// packages/engine/src/indicators/extended.ts
function fractals(candles) {
  if (candles.length < 5) return "none";
  const i = candles.length - 3;
  const c = candles[i];
  if (c.high > candles[i - 1].high && c.high > candles[i - 2].high && c.high > candles[i + 1].high && c.high > candles[i + 2].high) return "bearish_fractal";
  if (c.low < candles[i - 1].low && c.low < candles[i - 2].low && c.low < candles[i + 1].low && c.low < candles[i + 2].low) return "bullish_fractal";
  return "none";
}
function insideBar(candles) {
  if (candles.length < 2) return "none";
  const c = candles[candles.length - 1], p = candles[candles.length - 2];
  if (c.high < p.high && c.low > p.low) return c.close > c.open ? "bullish" : "bearish";
  return "none";
}
function outsideBar(candles) {
  if (candles.length < 2) return "none";
  const c = candles[candles.length - 1], p = candles[candles.length - 2];
  if (c.high > p.high && c.low < p.low) return c.close > c.open ? "bullish" : "bearish";
  return "none";
}
function fakeyPattern(candles) {
  if (candles.length < 4) return "none";
  const c0 = candles[candles.length - 1];
  const c1 = candles[candles.length - 2];
  const c2 = candles[candles.length - 3];
  if (!(c1.high < c2.high && c1.low > c2.low)) return "none";
  if (c0.high > c2.high && c0.close < c2.high) return "bearish";
  if (c0.low < c2.low && c0.close > c2.low) return "bullish";
  return "none";
}
function powerOfThree(candles, currentPrice) {
  if (candles.length < 15) return "none";
  const sweep = liquiditySweep(candles, currentPrice);
  const exp = expansion(candles, currentPrice);
  if (sweep === "sell_side" && exp === "bullish") return "distribution_bullish";
  if (sweep === "buy_side" && exp === "bearish") return "distribution_bearish";
  if (atr(candles, 5, currentPrice) < atr(candles, 14, currentPrice) * 0.7) return "accumulation";
  return "none";
}
function turtleSoup(candles, currentPrice) {
  if (candles.length < 22) return "none";
  const ref = candles.slice(candles.length - 22, candles.length - 2);
  const rH = Math.max(...ref.map((c) => c.high));
  const rL = Math.min(...ref.map((c) => c.low));
  const l2 = candles.slice(candles.length - 2);
  if (l2.some((c) => c.high > rH) && currentPrice < rH) return "bearish";
  if (l2.some((c) => c.low < rL) && currentPrice > rL) return "bullish";
  return "none";
}
function cisd(candles) {
  if (candles.length < 5) return "none";
  const c = candles[candles.length - 1];
  if (Math.abs(c.close - c.open) < avgBodySize(candles) * 2.5) return "none";
  const { h, l } = swingPoints(candles, 10, 1);
  if (c.close > c.open && h.length && c.close > h[h.length - 1]) return "bullish";
  if (c.close < c.open && l.length && c.close < l[l.length - 1]) return "bearish";
  return "none";
}
function consequentEncroachment(candles, currentPrice) {
  if (candles.length < 5) return "none";
  for (let i = candles.length - 1; i >= 2; i--) {
    const c1 = candles[i - 2], c3 = candles[i];
    if (c3.low > c1.high) {
      const ce = (c3.low + c1.high) / 2;
      if (Math.abs(currentPrice - ce) < (c3.low - c1.high) * 0.1) return "bullish_ce";
    }
    if (c3.high < c1.low) {
      const ce = (c1.low + c3.high) / 2;
      if (Math.abs(currentPrice - ce) < (c1.low - c3.high) * 0.1) return "bearish_ce";
    }
  }
  return "none";
}
function inducement(candles, currentPrice) {
  if (candles.length < 15) return "none";
  const { h, l } = swingPoints(candles, 15, 1);
  const atr5 = atr(candles, 5, currentPrice);
  if (h.length >= 2 && l.length) {
    if (h[h.length - 1] < h[h.length - 2] && Math.abs(currentPrice - h[h.length - 1]) < atr5) {
      return "inducement_high";
    }
  }
  if (l.length >= 2 && h.length) {
    if (l[l.length - 1] > l[l.length - 2] && Math.abs(currentPrice - l[l.length - 1]) < atr5) {
      return "inducement_low";
    }
  }
  return "none";
}
function marketProfile(candles, currentPrice) {
  const lb = Math.min(50, candles.length);
  const sub = candles.slice(candles.length - lb);
  const hi = Math.max(...sub.map((c) => c.high));
  const lo = Math.min(...sub.map((c) => c.low));
  const range = hi - lo;
  if (range < 1e-4) return { poc: currentPrice, vah: currentPrice, val: currentPrice };
  const buckets = new Array(10).fill(0);
  for (const c of sub) {
    const idx = clamp(Math.round((c.close - lo) / range * 9), 0, 9);
    buckets[idx] = buckets[idx] + c.volume;
  }
  let pocB = 0;
  for (let i = 1; i < 10; i++) if (buckets[i] > buckets[pocB]) pocB = i;
  const poc = lo + pocB / 9 * range;
  const tot = buckets.reduce((a, b) => a + b, 0);
  let acc = buckets[pocB];
  let lB = pocB, hB = pocB;
  while (acc < tot * 0.7 && (lB > 0 || hB < 9)) {
    const aH = hB < 9 ? buckets[hB + 1] : 0;
    const aL = lB > 0 ? buckets[lB - 1] : 0;
    if (aH >= aL && hB < 9) {
      hB++;
      acc += buckets[hB];
    } else if (lB > 0) {
      lB--;
      acc += buckets[lB];
    } else hB++;
  }
  return { poc, vah: lo + hB / 9 * range, val: lo + lB / 9 * range };
}
function marketProfileZone(candles, currentPrice) {
  const mp = marketProfile(candles, currentPrice);
  if (currentPrice > mp.vah) return "above_vah";
  if (currentPrice < mp.val) return "below_val";
  if (Math.abs(currentPrice - mp.poc) < atr(candles, 5, currentPrice)) return "at_poc";
  return currentPrice > mp.poc ? "above_poc" : "below_poc";
}
function camarillaPivot(candles, currentPrice) {
  if (candles.length < 2) return "none";
  const c = candles[candles.length - 2];
  const r = c.high - c.low;
  const h4 = c.close + r * 1.1 / 2, h3 = c.close + r * 1.1 / 4;
  const l3 = c.close - r * 1.1 / 4, l4 = c.close - r * 1.1 / 2;
  if (currentPrice > h4) return "above_h4";
  if (currentPrice < l4) return "below_l4";
  if (currentPrice > h3) return "above_h3";
  if (currentPrice < l3) return "below_l3";
  return "inside";
}
function woodiePivot(candles, currentPrice) {
  if (candles.length < 2) return "none";
  const c = candles[candles.length - 2];
  const p = (c.high + c.low + 2 * c.close) / 4;
  const r1 = 2 * p - c.low, s1 = 2 * p - c.high;
  if (currentPrice > r1) return "above_r1";
  if (currentPrice < s1) return "below_s1";
  return currentPrice > p ? "above_p" : "below_p";
}
function fibPivot(candles, currentPrice) {
  if (candles.length < 2) return "none";
  const c = candles[candles.length - 2];
  const p = (c.high + c.low + c.close) / 3;
  const r = c.high - c.low;
  const r2 = p + 0.618 * r, r1 = p + 0.382 * r;
  const s1 = p - 0.382 * r, s2 = p - 0.618 * r;
  if (currentPrice > r2) return "above_r2";
  if (currentPrice < s2) return "below_s2";
  if (currentPrice > r1) return "above_r1";
  if (currentPrice < s1) return "below_s1";
  return currentPrice > p ? "above_p" : "below_p";
}
function broadeningWedge(candles, currentPrice) {
  if (candles.length < 20) return "none";
  const { h, l } = swingPoints(candles, 30, 2);
  if (h.length < 2 || l.length < 2) return "none";
  if (h[h.length - 1] > h[h.length - 2] && l[l.length - 1] < l[l.length - 2]) {
    if (currentPrice > h[h.length - 1]) return "bearish";
    if (currentPrice < l[l.length - 1]) return "bullish";
    return "active";
  }
  return "none";
}
function diamondPattern(candles, currentPrice) {
  if (candles.length < 30) return "none";
  const { h, l } = swingPoints(candles, 30, 2);
  if (h.length < 4 || l.length < 4) return "none";
  if (h[h.length - 3] > h[h.length - 4] && l[l.length - 3] < l[l.length - 4] && h[h.length - 1] < h[h.length - 2] && l[l.length - 1] > l[l.length - 2]) {
    if (currentPrice > h[h.length - 1]) return "bullish";
    if (currentPrice < l[l.length - 1]) return "bearish";
  }
  return "none";
}
function openingGap(candles, currentPrice) {
  if (candles.length < 2) return "none";
  const a = atr(candles, 14, currentPrice);
  const gap = candles[candles.length - 1].open - candles[candles.length - 2].close;
  if (gap > a * 0.5) return "gap_up";
  if (gap < -a * 0.5) return "gap_down";
  return "none";
}
function fibTimeZone(candles) {
  const fibs = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
  return fibs.includes(candles.length % 90) ? "fib_zone" : "none";
}
function gannFan(candles, currentPrice) {
  if (candles.length < 10) return "none";
  const n = Math.min(10, candles.length - 1);
  const pips = (currentPrice - candles[candles.length - 1 - n].low) / n;
  const a = atr(candles, 14, currentPrice);
  if (Math.abs(pips) >= a * 0.8 && Math.abs(pips) <= a * 1.2) return "on_1x1";
  if (pips > a * 1.2) return "above_1x1";
  if (pips > 0) return "below_1x1";
  return "none";
}
register("fractals", ({ candles }) => fractals(candles));
register("inside_bar", ({ candles }) => insideBar(candles));
register("outside_bar", ({ candles }) => outsideBar(candles));
register(["fakey", "inside_bar_fakey"], ({ candles }) => fakeyPattern(candles));
register(
  ["po3", "power_of_three", "amd_cycle"],
  ({ candles, currentPrice }) => powerOfThree(candles, currentPrice)
);
register("turtle_soup", ({ candles, currentPrice }) => turtleSoup(candles, currentPrice));
register("cisd", ({ candles }) => cisd(candles));
register(
  ["ce", "consequent_encroachment"],
  ({ candles, currentPrice }) => consequentEncroachment(candles, currentPrice)
);
register("inducement", ({ candles, currentPrice }) => inducement(candles, currentPrice));
register("poc", ({ candles, currentPrice }) => marketProfile(candles, currentPrice).poc);
register("vah", ({ candles, currentPrice }) => marketProfile(candles, currentPrice).vah);
register("val", ({ candles, currentPrice }) => marketProfile(candles, currentPrice).val);
register(
  ["market_profile", "tpo"],
  ({ candles, currentPrice }) => marketProfileZone(candles, currentPrice)
);
register(
  ["camarilla", "camarilla_pivot"],
  ({ candles, currentPrice }) => camarillaPivot(candles, currentPrice)
);
register(
  ["woodie", "woodie_pivot"],
  ({ candles, currentPrice }) => woodiePivot(candles, currentPrice)
);
register(
  ["fib_pivot", "fibonacci_pivot"],
  ({ candles, currentPrice }) => fibPivot(candles, currentPrice)
);
register(
  ["broadening_wedge", "megaphone"],
  ({ candles, currentPrice }) => broadeningWedge(candles, currentPrice)
);
register(
  ["diamond", "diamond_top"],
  ({ candles, currentPrice }) => diamondPattern(candles, currentPrice)
);
register("opening_gap", ({ candles, currentPrice }) => openingGap(candles, currentPrice));
register(["fib_time", "fibonacci_time_zone"], ({ candles }) => fibTimeZone(candles));
register("gann_fan", ({ candles, currentPrice }) => gannFan(candles, currentPrice));

// packages/engine/src/indicators/quant.ts
var idiv4 = (a, b) => Math.trunc(a / b);
function accumulation(candles, currentPrice) {
  if (candles.length < 20) return "none";
  if (atr(candles, 5, currentPrice) >= atr(candles, 20, currentPrice) * 0.7) return "none";
  const rL = Math.min(...candles.slice(Math.max(0, candles.length - 5)).map((c) => c.low));
  const pL = Math.min(
    ...candles.slice(Math.max(0, candles.length - 20), candles.length - 5).map((c) => c.low)
  );
  return rL > pL ? "bullish" : "none";
}
function distribution(candles, currentPrice) {
  if (candles.length < 20) return "none";
  if (atr(candles, 5, currentPrice) >= atr(candles, 20, currentPrice) * 0.7) return "none";
  const rH = Math.max(...candles.slice(Math.max(0, candles.length - 5)).map((c) => c.high));
  const pH = Math.max(
    ...candles.slice(Math.max(0, candles.length - 20), candles.length - 5).map((c) => c.high)
  );
  return rH < pH ? "bearish" : "none";
}
function manipulation(candles) {
  if (candles.length < 8) return "none";
  const avg = avgBodySize(candles);
  const tail = candles.slice(Math.max(0, candles.length - 5));
  for (let i = tail.length - 1; i >= 0; i--) {
    const c = tail[i];
    if (Math.abs(c.close - c.open) > avg * 3) return c.close < c.open ? "bullish" : "bearish";
  }
  return "none";
}
function dowTrend(candles) {
  if (candles.length < 20) return "none";
  const { h, l } = swingPoints(candles, 40, 2);
  if (h.length < 2 || l.length < 2) return "none";
  const up = h[h.length - 1] > h[h.length - 2] && l[l.length - 1] > l[l.length - 2];
  const down = h[h.length - 1] < h[h.length - 2] && l[l.length - 1] < l[l.length - 2];
  if (up) return "uptrend";
  if (down) return "downtrend";
  return "sideways";
}
function elliottWave(candles, targetWave) {
  if (candles.length < 30) return "none";
  const highPrices = [], highIdxs = [];
  const lowPrices = [], lowIdxs = [];
  for (let i = 2; i < candles.length - 2; i++) {
    const h = candles[i].high, l = candles[i].low;
    if (h > candles[i - 1].high && h > candles[i - 2].high && h > candles[i + 1].high && h > candles[i + 2].high) {
      highPrices.push(h);
      highIdxs.push(i);
    }
    if (l < candles[i - 1].low && l < candles[i - 2].low && l < candles[i + 1].low && l < candles[i + 2].low) {
      lowPrices.push(l);
      lowIdxs.push(i);
    }
  }
  if (highPrices.length < 2 || lowPrices.length < 2) return "none";
  const lhPrice = highPrices[highPrices.length - 1];
  const phPrice = highPrices[highPrices.length - 2];
  const llPrice = lowPrices[lowPrices.length - 1];
  const plPrice = lowPrices[lowPrices.length - 2];
  const lhIdx = highIdxs[highIdxs.length - 1];
  const llIdx = lowIdxs[lowIdxs.length - 1];
  let detectedWave, direction;
  if (lhIdx > llIdx) {
    const impulse = lhPrice - plPrice;
    const prevDown = phPrice - llPrice;
    if (impulse > prevDown * 1.3 && lhPrice > phPrice && llPrice > plPrice) {
      detectedWave = "3";
      direction = "bullish";
    } else if (lhPrice > phPrice) {
      detectedWave = impulse < prevDown ? "5" : "1";
      direction = "bullish";
    } else {
      detectedWave = "B";
      direction = "bearish";
    }
  } else {
    const downSize = lhPrice - llPrice;
    const prevUp = lhPrice - plPrice;
    const retrace = prevUp > 0 ? downSize / prevUp : 0.5;
    if (llPrice < plPrice && lhPrice < phPrice) {
      detectedWave = downSize > prevUp * 1.3 ? "3" : "C";
      direction = "bearish";
    } else if (retrace >= 0.382 && retrace <= 0.786) {
      detectedWave = "2";
      direction = "bearish";
    } else {
      detectedWave = "C";
      direction = "bearish";
    }
  }
  if (targetWave != null && targetWave.length > 0 && detectedWave !== targetWave) return "none";
  return direction;
}
function fibonacci(candles, currentPrice, level) {
  if (candles.length < 20) return "none";
  const recent = candles.slice(Math.max(0, candles.length - 30));
  const swingHigh = Math.max(...recent.map((c) => c.high));
  const swingLow = Math.min(...recent.map((c) => c.low));
  const range = swingHigh - swingLow;
  if (range < 1e-4) return "none";
  const fibUp = swingLow + range * level;
  const fibDown = swingHigh - range * level;
  const tol = range * 0.05;
  const last = candles[candles.length - 1];
  const prev = candles.length > 1 ? candles[candles.length - 2] : last;
  if (Math.abs(currentPrice - fibUp) < tol && last.close > last.open && last.close > prev.close) {
    return "bullish_rejection";
  }
  if (Math.abs(currentPrice - fibDown) < tol && last.close < last.open && last.close < prev.close) {
    return "bearish_rejection";
  }
  return "none";
}
function tdCombo(candles) {
  if (candles.length < 14) return "none";
  let up = 0, dn = 0;
  for (let i = 2; i < candles.length; i++) {
    const c = candles[i];
    up = c.close > candles[i - 2].close && c.close > candles[i - 1].close ? up + 1 : 0;
    dn = c.close < candles[i - 2].close && c.close < candles[i - 1].close ? dn + 1 : 0;
  }
  if (up >= 13) return "sell_signal";
  if (dn >= 13) return "buy_signal";
  return "none";
}
function demarkPivot(candles, currentPrice) {
  if (candles.length < 2) return "none";
  const c = candles[candles.length - 2];
  let x;
  if (c.close < c.open) x = c.high + 2 * c.low + c.close;
  else if (c.close > c.open) x = 2 * c.high + c.low + c.close;
  else x = c.high + c.low + 2 * c.close;
  const p = x / 4, r1 = x / 2 - c.low, s1 = x / 2 - c.high;
  if (currentPrice > r1) return "above_r1";
  if (currentPrice < s1) return "below_s1";
  return currentPrice > p ? "above_p" : "below_p";
}
function zScore(candles, period, currentPrice) {
  const n = Math.min(period, candles.length);
  const cl = candles.slice(candles.length - n).map((c) => c.close);
  const mean = cl.reduce((a, b) => a + b, 0) / cl.length;
  const v = cl.reduce((a, c) => a + (c - mean) ** 2, 0);
  const sd = Math.sqrt(v / cl.length);
  return sd > 0 ? (currentPrice - mean) / sd : 0;
}
function starcBands(candles, currentPrice) {
  const mid = sma(candles, Math.min(5, candles.length), currentPrice);
  const a = atr(candles, Math.min(15, candles.length), currentPrice);
  if (currentPrice > mid + 1.5 * a) return "above_upper";
  if (currentPrice < mid - 1.5 * a) return "below_lower";
  return currentPrice > mid ? "upper_half" : "lower_half";
}
function nr4(candles) {
  if (candles.length < 4) return "none";
  const r = (i) => candles[candles.length - 1 - i].high - candles[candles.length - 1 - i].low;
  return r(0) <= r(1) && r(0) <= r(2) && r(0) <= r(3) ? "nr4" : "none";
}
function idnr4(candles) {
  if (insideBar(candles) === "none") return "none";
  return nr4(candles) === "nr4" ? "idnr4" : "none";
}
function initialBalance(candles, currentPrice) {
  if (candles.length < 3) return "none";
  const ibH = Math.max(candles[0].high, candles[1].high);
  const ibL = Math.min(candles[0].low, candles[1].low);
  if (currentPrice > ibH) return "above_ibh";
  if (currentPrice < ibL) return "below_ibl";
  return "inside_ib";
}
function institutionalCandle(candles) {
  const c = candles[candles.length - 1];
  if (Math.abs(c.close - c.open) < avgBodySize(candles) * 2.5) return "none";
  return c.close > c.open ? "bullish_institutional" : "bearish_institutional";
}
function pipePattern(candles, currentPrice, top) {
  if (candles.length < 2) return "none";
  const c = candles[candles.length - 1], p = candles[candles.length - 2];
  const thresh = atr(candles, 14, currentPrice) * 0.15;
  if (top && Math.abs(c.high - p.high) < thresh) return "pipe_top";
  if (!top && Math.abs(c.low - p.low) < thresh) return "pipe_bottom";
  return "none";
}
function bumpAndRun(candles, currentPrice) {
  if (candles.length < 25) return "none";
  const lead = candles.slice(candles.length - 25, candles.length - 10);
  const bump = candles.slice(candles.length - 10, candles.length - 2);
  const avgRange = (xs) => xs.reduce((a, c) => a + (c.high - c.low), 0) / xs.length;
  if (avgRange(bump) < avgRange(lead) * 2) return "none";
  const leadAvg = lead.reduce((a, c) => a + c.close, 0) / lead.length;
  const bumpFirst = bump[0].close, bumpLast = bump[bump.length - 1].close;
  if (currentPrice < leadAvg && bumpLast < bumpFirst) return "bearish_run";
  if (currentPrice > leadAvg && bumpLast > bumpFirst) return "bullish_run";
  return "none";
}
function hurstExponent(candles) {
  if (candles.length < 20) return 0.5;
  const n = Math.min(40, candles.length);
  const prices = candles.slice(candles.length - n).map((c) => c.close);
  const rets = [];
  for (let i = 1; i < prices.length; i++) rets.push(prices[i] - prices[i - 1]);
  if (!rets.length) return 0.5;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  let cum = 0;
  const cumDev = [];
  for (const r of rets) {
    cum += r - mean;
    cumDev.push(cum);
  }
  const R = Math.max(...cumDev) - Math.min(...cumDev);
  const variance = rets.reduce((a, r) => a + (r - mean) ** 2, 0);
  const S = Math.sqrt(variance / rets.length);
  if (S < 1e-10 || R <= 0) return 0.5;
  return clamp(Math.log(R / S) / Math.log(rets.length), 0, 1);
}
function entropyAnalysis(candles) {
  if (candles.length < 10) return "none";
  const n = Math.min(30, candles.length - 1);
  let up = 0, dn = 0, flat = 0;
  for (let i = candles.length - n; i < candles.length - 1; i++) {
    const d = candles[i + 1].close - candles[i].close;
    if (d > 5e-5) up++;
    else if (d < -5e-5) dn++;
    else flat++;
  }
  const total = up + dn + flat;
  if (total === 0) return "none";
  let entropy = 0;
  for (const cnt of [up, dn, flat]) {
    if (cnt > 0) {
      const p = cnt / total;
      entropy -= p * Math.log(p);
    }
  }
  const norm = entropy / Math.log(3);
  if (norm > 0.95) return "high_entropy";
  if (norm < 0.6) return "low_entropy";
  return "medium_entropy";
}
function marketRegime(candles, currentPrice) {
  if (candles.length < 20) return "none";
  const adx = adxFull(candles, 14).adx;
  const rAtr = atr(candles, 5, currentPrice);
  const lAtr = atr(candles, 20, currentPrice);
  if (adx > 30 && rAtr > lAtr * 1.2) return "trending_volatile";
  if (adx > 25) return "trending";
  if (rAtr < lAtr * 0.7) return "quiet_ranging";
  return "ranging";
}
function volatilityRegime(candles, currentPrice) {
  if (candles.length < 20) return "none";
  const rAtr = atr(candles, 5, currentPrice);
  const lAtr = atr(candles, 20, currentPrice);
  if (rAtr > lAtr * 1.5) return "high";
  if (rAtr < lAtr * 0.6) return "low";
  return "normal";
}
function anomaly(candles, currentPrice) {
  if (candles.length < 20) return "none";
  const n = Math.min(20, candles.length);
  const closes = candles.slice(candles.length - n).map((c) => c.close);
  const mean = closes.reduce((a, b) => a + b, 0) / closes.length;
  const variance = closes.reduce((a, c) => a + (c - mean) ** 2, 0);
  const sd = Math.sqrt(variance / closes.length);
  if (sd < 1e-10) return "none";
  const z = (currentPrice - mean) / sd;
  if (z > 2.5) return "anomaly_up";
  if (z < -2.5) return "anomaly_down";
  return "normal";
}
function liquidityVoid(candles, currentPrice) {
  if (candles.length < 5) return "none";
  const a = atr(candles, 14, currentPrice);
  for (let i = candles.length - 2; i >= 1; i--) {
    const gapUp = candles[i].low - candles[i - 1].high;
    const gapDown = candles[i - 1].low - candles[i].high;
    if (gapUp > a * 3 && currentPrice >= candles[i - 1].high && currentPrice <= candles[i].low) {
      return "bullish";
    }
    if (gapDown > a * 3 && currentPrice >= candles[i].high && currentPrice <= candles[i - 1].low) {
      return "bearish";
    }
  }
  return "none";
}
function spectralCycle(candles) {
  if (candles.length < 20) return "none";
  const n = Math.min(30, candles.length);
  const series = candles.slice(candles.length - n).map((c) => c.close);
  const mean = series.reduce((a, b) => a + b, 0) / series.length;
  let maxCorr = 0, domPeriod = 0;
  for (let lag = 2; lag <= Math.min(15, idiv4(n, 2)); lag++) {
    let corr = 0, denom = 0;
    for (let i = lag; i < series.length; i++) {
      corr += (series[i] - mean) * (series[i - lag] - mean);
      denom += (series[i] - mean) ** 2;
    }
    if (denom > 0 && Math.abs(corr / denom) > maxCorr) {
      maxCorr = Math.abs(corr / denom);
      domPeriod = lag;
    }
  }
  if (domPeriod <= 0) return "none";
  if (domPeriod <= 5) return "short_cycle";
  if (domPeriod <= 10) return "medium_cycle";
  return "long_cycle";
}
function waveletTrend(candles, currentPrice) {
  if (candles.length < 34) return "none";
  const f = ema(candles, Math.min(5, candles.length), currentPrice);
  const mid = ema(candles, Math.min(13, candles.length), currentPrice);
  const s = ema(candles, Math.min(34, candles.length), currentPrice);
  const bull = (f > mid ? 1 : 0) + (mid > s ? 1 : 0) + (f > s ? 1 : 0);
  if (bull === 3) return "bullish";
  if (bull === 0) return "bearish";
  return "mixed";
}
function monteCarlo(candles, currentPrice, rng = Math.random) {
  if (candles.length < 20) return "none";
  const vol = atr(candles, 14, currentPrice) / currentPrice;
  const lb = Math.min(14, candles.length - 1);
  const base = candles[candles.length - 1 - lb].close;
  const drift = (candles[candles.length - 1].close - base) / base / lb;
  let upCount = 0;
  for (let s = 0; s < 200; s++) {
    const u1 = clamp(rng(), 1e-10, 1);
    const u2 = rng();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const fp = currentPrice * Math.exp((drift - 0.5 * vol * vol) * 5 + vol * Math.sqrt(5) * z);
    if (fp > currentPrice) upCount++;
  }
  if (upCount > 130) return "bullish";
  if (upCount < 70) return "bearish";
  return "neutral";
}
register("accumulation", ({ candles, currentPrice }) => accumulation(candles, currentPrice));
register("distribution", ({ candles, currentPrice }) => distribution(candles, currentPrice));
register("manipulation", ({ candles }) => manipulation(candles));
register(["dow_theory", "trend_following"], ({ candles }) => dowTrend(candles));
register("elliott_wave", ({ candles, rule }) => elliottWave(candles, rule.pattern));
register(
  "fibonacci",
  ({ candles, currentPrice, rule }) => fibonacci(candles, currentPrice, rule.value ?? 0.618)
);
register("td_combo", ({ candles }) => tdCombo(candles));
register(
  ["demark_p", "demark_pivot"],
  ({ candles, currentPrice }) => demarkPivot(candles, currentPrice)
);
register("z_score", ({ candles, rule, currentPrice }) => zScore(candles, rule.period, currentPrice));
register(["starc", "starc_bands"], ({ candles, currentPrice }) => starcBands(candles, currentPrice));
register("idnr4", ({ candles }) => idnr4(candles));
register(
  ["ib", "initial_balance"],
  ({ candles, currentPrice }) => initialBalance(candles, currentPrice)
);
register("institutional_candle", ({ candles }) => institutionalCandle(candles));
register("pipe_top", ({ candles, currentPrice }) => pipePattern(candles, currentPrice, true));
register("pipe_bottom", ({ candles, currentPrice }) => pipePattern(candles, currentPrice, false));
register("bump_and_run", ({ candles, currentPrice }) => bumpAndRun(candles, currentPrice));
register("hurst_exponent", ({ candles }) => hurstExponent(candles));
register("fractal_dimension", ({ candles }) => 2 - hurstExponent(candles));
register("entropy_analysis", ({ candles }) => entropyAnalysis(candles));
register(
  ["market_regime_classification", "regime_detection"],
  ({ candles, currentPrice }) => marketRegime(candles, currentPrice)
);
register("volatility_regime_analysis", ({ candles, currentPrice }) => volatilityRegime(candles, currentPrice));
register("anomaly_detection", ({ candles, currentPrice }) => anomaly(candles, currentPrice));
register("liquidity_voids", ({ candles, currentPrice }) => liquidityVoid(candles, currentPrice));
register("spectral_analysis", ({ candles }) => spectralCycle(candles));
register("wavelet_decomposition", ({ candles, currentPrice }) => waveletTrend(candles, currentPrice));
register(
  "monte_carlo_risk_simulation",
  ({ candles, currentPrice }) => monteCarlo(candles, currentPrice)
);
register("wyckoff", ({ candles, currentPrice }) => wyckoffSpring(candles, currentPrice));

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
function detectSwing(candles, period = 50) {
  const window = candles.slice(-Math.max(period, 12));
  if (window.length < 12) return null;
  let high = null;
  let low = null;
  for (let i = 2; i < window.length - 2; i++) {
    const h = window[i].high;
    if (h > window[i - 1].high && h > window[i - 2].high && h > window[i + 1].high && h > window[i + 2].high && (high === null || h >= high.price)) {
      high = { price: h, at: i };
    }
    const l = window[i].low;
    if (l < window[i - 1].low && l < window[i - 2].low && l < window[i + 1].low && l < window[i + 2].low && (low === null || l <= low.price)) {
      low = { price: l, at: i };
    }
  }
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

// packages/engine/src/pyramid/conditions.ts
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
var TREND = /* @__PURE__ */ new Set([
  "ichimoku",
  "supertrend",
  "alligator",
  "parabolic_sar",
  "sar",
  "sma",
  "ema",
  "wma",
  "hma",
  "hull_ma",
  "dema",
  "tema",
  "alma",
  "lsma",
  "kama",
  "t3",
  "linear_regression",
  "dow_theory",
  "trend_following",
  "kalman",
  "mtf",
  "multi_timeframe_alignment"
]);
var PRICE_LEVELS = /* @__PURE__ */ new Set([
  "pivot_point",
  "pivot",
  "cpr",
  "pdh",
  "pdl",
  "pdh_pdl",
  "sr_support",
  "sr_resistance",
  "orb",
  "opening_range_breakout",
  "opening_range",
  "vwap",
  "anchored_vwap",
  "vwap_bands",
  "price_vs_vwap",
  "keltner_channels",
  "donchian_channels",
  "support_resistance",
  "sr_position",
  "sr_bounce"
]);
var FIBONACCI = /* @__PURE__ */ new Set([
  "fib_retracement",
  "fib_extension",
  "fib_level",
  "fib_zone",
  "fib_bounce",
  "fib_distance"
]);
var ADVANCED_STATS = /* @__PURE__ */ new Set([
  "z_score",
  "zscore",
  "hurst_exponent",
  "entropy_analysis",
  "regime_detection",
  "market_regime_classification",
  "volatility_regime_analysis",
  "anomaly_detection",
  "spectral_analysis",
  "monte_carlo_risk_simulation",
  "wavelet_decomposition",
  "kelly_criterion",
  "choppiness",
  "choppiness_index"
]);
var RARE_PATTERNS = /* @__PURE__ */ new Set([
  "three_bar_reversal",
  "island_reversal",
  "exhaustion_gap",
  "breakout",
  "candle_pattern",
  "candles",
  "wyckoff",
  "wyckoff_phase",
  "wyckoff_spring",
  "wyckoff_upthrust",
  "elliott_wave",
  "order_block",
  "fair_value_gap",
  "breaker_block",
  "rejection_block",
  "mitigation_block",
  "inverse_fvg",
  "imbalance",
  "bpr",
  "liquidity_sweep",
  "equal_highs",
  "equal_lows",
  "eqh",
  "eql",
  "gartley",
  "bat",
  "alternate_bat",
  "butterfly",
  "crab",
  "deep_crab",
  "shark",
  "cypher",
  "ab_cd",
  "three_drives",
  "5_0"
]);
var OSCILLATORS = /* @__PURE__ */ new Set([
  "rsi",
  "macd_histogram",
  "macd_line",
  "macd_signal",
  "cci",
  "mfi",
  "cmf",
  "williams_r",
  "roc"
]);
function categoryForIndicator(rule) {
  if (rule.type.length > 0) return rule.type;
  const ind = rule.indicator.toLowerCase();
  if (TREND.has(ind) || ind.includes("vortex") || ind.includes("aroon")) return "Trend";
  if (PRICE_LEVELS.has(ind) || ind.includes("bollinger") || ind.startsWith("bb_")) {
    return "Price Levels";
  }
  if (FIBONACCI.has(ind)) return "Fibonacci";
  if (ADVANCED_STATS.has(ind)) return "Advanced Statistics";
  if (RARE_PATTERNS.has(ind) || ind.startsWith("harmonic")) return "Rare Patterns";
  if (OSCILLATORS.has(ind) || ind.startsWith("stoch")) return "Oscillators";
  return "Other";
}

// packages/engine/src/pyramid/constants.ts
var CORRELATION_HIGH_THRESHOLD = 0.7;
var MIN_CALIBRATION_SAMPLES = 200;
var CONSENSUS_LADDER = [1, 1.15, 1.3, 1.5];
var INDEP_REFERENCE = 4;
var CONFIRMATION_FLOOR = 0;
var CONFIRMATION_CEILING = 1;
var PRIMARY_STRENGTH_MIN = 0.3;
var PRIMARY_STRENGTH_MAX = 0.8;
var MIN_SIGNAL_SEPARATION = 0.3333;
var RELIEF_WEIGHTS = {
  strength: 0.5,
  independence: 0.3,
  separation: 0.2
};
var QUALITY_WEIGHTS = {
  primaryStrength: 0.25,
  consensus: 0.2,
  confirmation: 0.25,
  separation: 0.2,
  conflict: 0.1
};

// packages/engine/src/pyramid/correlation.ts
function ruleSignature(r) {
  const target = r.pattern ?? (r.value != null ? String(r.value) : "");
  return [
    r.indicator,
    r.period,
    r.fast,
    r.slow,
    r.smooth,
    r.stddev,
    r.tolerance,
    r.condition,
    target,
    r.valueMin,
    r.valueMax
  ].join(":");
}
function pairKey(a, b) {
  return a < b ? `${a}||${b}` : `${b}||${a}`;
}
var active = null;
function setCalibration(c) {
  active = c === null || c.snapshots.length === 0 ? null : c;
}
function hasCalibration() {
  return active !== null;
}
function calibrationFor(atMs) {
  if (active === null) return null;
  const s = active.snapshots;
  let lo = 0, hi = s.length - 1, best = -1;
  while (lo <= hi) {
    const mid = lo + hi >> 1;
    if (s[mid].validTo <= atMs) {
      best = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  if (best < 0) return null;
  const snap = s[best];
  return snap.samples >= MIN_CALIBRATION_SAMPLES ? snap : null;
}
var coverage = /* @__PURE__ */ new WeakMap();
function coversSignature(snap, sig) {
  let set = coverage.get(snap);
  if (set === void 0) {
    set = new Set(snap.signatures);
    coverage.set(snap, set);
  }
  return set.has(sig);
}
function correlationOf(snap, a, b) {
  const v = snap.pairs[pairKey(a, b)];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function calibrationFromJson(j, authoritative = false) {
  if (typeof j !== "object" || j === null) return null;
  const raw = j.snapshots;
  if (!Array.isArray(raw)) return null;
  const snapshots = [];
  for (const e of raw) {
    if (typeof e !== "object" || e === null) continue;
    const o = e;
    const validTo = Number(o["validTo"]);
    const samples = Number(o["samples"]);
    const pairs = o["pairs"];
    const signatures = o["signatures"];
    if (!Number.isFinite(validTo) || !Number.isFinite(samples)) continue;
    if (typeof pairs !== "object" || pairs === null) continue;
    if (!Array.isArray(signatures)) continue;
    snapshots.push({
      validTo,
      samples,
      authoritative,
      signatures: signatures.filter((s) => typeof s === "string"),
      pairs
    });
  }
  if (snapshots.length === 0) return null;
  snapshots.sort((x, y) => x.validTo - y.validTo);
  return { snapshots };
}

// packages/engine/src/pyramid/types.ts
var DEFAULT_PYRAMID = {
  minPrimaryScore: 3,
  confirmationRatio: 0.5,
  requireAllFilters: true,
  waitMessage: "\u0627\u0644\u0647\u0631\u0645 \u0644\u0645 \u064A\u0643\u062A\u0645\u0644 \u2014 \u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0634\u0645\u0639\u0629 \u0627\u0644\u0642\u0627\u062F\u0645\u0629"
};
function pyramidFromJson(j) {
  const num = (v, d) => v == null ? d : Number(v);
  return {
    minPrimaryScore: num(j["min_primary_score"], 3),
    confirmationRatio: num(j["confirmation_ratio"], 0.5),
    requireAllFilters: j["require_all_filters"] ?? true,
    waitMessage: j["wait_message"] ?? DEFAULT_PYRAMID.waitMessage
  };
}

// packages/engine/src/pyramid/v2.ts
var clamp01 = (v) => v < 0 ? 0 : v > 1 ? 1 : v;
var clampSigned = (v) => v < -1 ? -1 : v > 1 ? 1 : v;
function consensusMultiplier(clusters) {
  if (clusters <= 1) return CONSENSUS_LADDER[0];
  if (clusters === 2) return CONSENSUS_LADDER[1];
  if (clusters === 3) return CONSENSUS_LADDER[2];
  return CONSENSUS_LADDER[CONSENSUS_LADDER.length - 1];
}
function effectiveClusters(signatures, labels, categories, atMs) {
  const n = signatures.length;
  if (n === 0) return { clusters: 0, calibrated: true, uncovered: null };
  const snap = calibrationFor(atMs);
  if (snap === null) return { clusters: 1, calibrated: false, uncovered: null };
  for (let i = 0; i < n; i++) {
    if (!coversSignature(snap, signatures[i])) {
      return snap.authoritative ? { clusters: 1, calibrated: true, uncovered: labels[i] } : { clusters: 1, calibrated: false, uncovered: null };
    }
  }
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x) => parent[x] === x ? x : parent[x] = find(parent[x]);
  for (let a = 0; a < n; a++) {
    for (let b = a + 1; b < n; b++) {
      let merge = categories[a] === categories[b];
      if (!merge) {
        const r = correlationOf(snap, signatures[a], signatures[b]);
        merge = r !== null && Math.abs(r) > CORRELATION_HIGH_THRESHOLD;
      }
      if (merge) {
        const ra = find(a), rb = find(b);
        if (ra !== rb) parent[ra] = rb;
      }
    }
  }
  const roots = /* @__PURE__ */ new Set();
  for (let i = 0; i < n; i++) roots.add(find(i));
  return { clusters: roots.size, calibrated: true, uncovered: null };
}
function confirmationThreshold(ratio, primaryStrength, clusters, separation) {
  const base = CONFIRMATION_FLOOR + ratio * (CONFIRMATION_CEILING - CONFIRMATION_FLOOR);
  const strengthTerm = clamp01(
    (primaryStrength - PRIMARY_STRENGTH_MIN) / (PRIMARY_STRENGTH_MAX - PRIMARY_STRENGTH_MIN)
  );
  const independenceTerm = clamp01((clusters - 1) / (INDEP_REFERENCE - 1));
  const relief = RELIEF_WEIGHTS.strength * strengthTerm + RELIEF_WEIGHTS.independence * independenceTerm + RELIEF_WEIGHTS.separation * clamp01(separation);
  return base - (base - CONFIRMATION_FLOOR) * relief;
}
function evaluateStrategyPro(strategy, ctx) {
  const { candles, currentPrice } = ctx;
  const clock = ctx.clock ?? systemClock();
  const cache = ctx.cache ?? /* @__PURE__ */ new Map();
  const atMs = candles.length > 0 ? candles[candles.length - 1].time : 0;
  const compute = (r) => {
    const v = computeIndicator(candles, r, currentPrice, clock, cache);
    return v === void 0 ? 0 : v;
  };
  const rules = strategy.rules.filter((r) => r.enabled);
  const primary = rules.filter((r) => r.role === "primary");
  const confirm = rules.filter((r) => r.role === "confirm");
  const filters = rules.filter((r) => r.role === "filter");
  const base = rules.filter(
    (r) => r.role !== "primary" && r.role !== "confirm" && r.role !== "filter"
  );
  let rawCall = 0, rawPut = 0;
  const catsCall = /* @__PURE__ */ new Set(), catsPut = /* @__PURE__ */ new Set();
  const sigCall = [], labCall = [], keyCall = [];
  const sigPut = [], labPut = [], keyPut = [];
  for (const r of primary) {
    try {
      if (!checkCondition(r, compute(r))) continue;
      const cat = r.type.length > 0 ? r.type : categoryForIndicator(r);
      const side = r.signal === "CALL" ? "CALL" : r.signal === "PUT" ? "PUT" : rawCall >= rawPut ? "CALL" : "PUT";
      if (side === "CALL") {
        rawCall += r.score;
        if (cat) {
          catsCall.add(cat);
          sigCall.push(ruleSignature(r));
          labCall.push(r.indicator);
          keyCall.push(cat);
        }
      } else {
        rawPut += r.score;
        if (cat) {
          catsPut.add(cat);
          sigPut.push(ruleSignature(r));
          labPut.push(r.indicator);
          keyPut.push(cat);
        }
      }
    } catch {
      continue;
    }
  }
  const cCall = effectiveClusters(sigCall, labCall, keyCall, atMs);
  const cPut = effectiveClusters(sigPut, labPut, keyPut, atMs);
  const multipliedCall = rawCall * consensusMultiplier(cCall.clusters);
  const multipliedPut = rawPut * consensusMultiplier(cPut.clusters);
  const isCall = multipliedCall >= multipliedPut;
  const direction = isCall ? "CALL" : "PUT";
  const winning = isCall ? multipliedCall : multipliedPut;
  const losing = isCall ? multipliedPut : multipliedCall;
  const clusters = isCall ? cCall.clusters : cPut.clusters;
  const calibrated = isCall ? cCall.calibrated : cPut.calibrated;
  const uncovered = isCall ? cCall.uncovered : cPut.uncovered;
  const rawWinning = isCall ? rawCall : rawPut;
  let capacity = 0;
  for (const r of primary) {
    if (r.signal === direction || r.signal === "dominant" || r.signal === "confirm") {
      capacity += Math.abs(r.score);
    }
  }
  const primaryStrength = capacity > 0 ? clamp01(rawWinning / capacity) : 0;
  const separation = winning + losing > 0 ? (winning - losing) / (winning + losing) : 0;
  const requireAll = strategy.pyramid?.requireAllFilters !== false;
  let filterPassed = true;
  let filterFailReason = null;
  if (filters.length > 0) {
    let passes = 0;
    let firstFailure = null;
    for (const r of filters) {
      let ok;
      try {
        ok = checkCondition(r, compute(r));
        if (!ok && firstFailure === null) firstFailure = `\u0641\u0634\u0644 \u0641\u0644\u062A\u0631 "${r.indicator}"`;
      } catch {
        ok = false;
        if (firstFailure === null) firstFailure = `\u062E\u0637\u0623 \u0623\u062B\u0646\u0627\u0621 \u062D\u0633\u0627\u0628 \u0641\u0644\u062A\u0631 "${r.indicator}"`;
      }
      if (ok) passes++;
      else if (requireAll) break;
    }
    filterPassed = requireAll ? passes === filters.length : passes > 0;
    if (!filterPassed) {
      filterFailReason = requireAll ? firstFailure : `\u0644\u0645 \u064A\u0646\u062C\u062D \u0623\u064A \u0641\u0644\u062A\u0631 \u0645\u0646 ${filters.length}`;
    }
  }
  const confirmScores = confirm.map((r) => r.score).sort((a, b) => a - b);
  const median = confirmScores.length === 0 ? 0 : confirmScores.length % 2 === 1 ? confirmScores[(confirmScores.length - 1) / 2] : (confirmScores[confirmScores.length / 2 - 1] + confirmScores[confirmScores.length / 2]) / 2;
  let rawConfirmation = 0;
  let capMax = 0, capMin = 0;
  let agreed = 0, opposingTrue = 0, confirmScoreAdded = 0;
  for (const r of confirm) {
    const ruleDir = r.signal === "dominant" || r.signal === "confirm" ? direction : r.signal;
    if (ruleDir === direction) capMax += Math.abs(r.score);
    else capMin += Math.abs(r.score);
    try {
      if (!checkCondition(r, compute(r))) continue;
      const strong = r.score >= median;
      if (ruleDir === direction) {
        agreed++;
        confirmScoreAdded += r.score;
        rawConfirmation += (strong ? 1 : 0.5) * r.score;
      } else {
        opposingTrue++;
        rawConfirmation += (strong ? -1 : -0.5) * r.score;
      }
    } catch {
      continue;
    }
  }
  const normalized = clampSigned(
    rawConfirmation >= 0 ? capMax > 0 ? rawConfirmation / capMax : 0 : capMin > 0 ? rawConfirmation / capMin : 0
  );
  const conflictPenalty = capMin > 0 ? clamp01(opposingTrue * (capMin / confirm.length) / capMin) : 0;
  const ratio = strategy.pyramid?.confirmationRatio ?? DEFAULT_PYRAMID.confirmationRatio;
  const threshold = confirmationThreshold(ratio, primaryStrength, clusters, separation);
  const confirmationPass = confirm.length === 0 || normalized >= threshold;
  let finalCall = multipliedCall, finalPut = multipliedPut;
  if (direction === "CALL") finalCall += confirmScoreAdded;
  else finalPut += confirmScoreAdded;
  for (const r of base) {
    try {
      if (!checkCondition(r, compute(r))) continue;
      if (r.signal === "CALL") finalCall += r.score;
      else if (r.signal === "PUT") finalPut += r.score;
      else if (finalCall >= finalPut) finalCall += r.score;
      else finalPut += r.score;
    } catch {
      continue;
    }
  }
  const minPrimary = strategy.pyramid?.minPrimaryScore ?? DEFAULT_PYRAMID.minPrimaryScore;
  let reasonBlocked = null;
  if (uncovered !== null) {
    reasonBlocked = `\u0627\u0644\u0645\u0624\u0634\u0631 "${uncovered}" \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0645\u0635\u0641\u0648\u0641\u0629 \u0627\u0644\u0627\u0631\u062A\u0628\u0627\u0637 \u0628\u062A\u0639\u0631\u064A\u0641\u0647 \u0627\u0644\u0645\u0643\u062A\u0648\u0628 \u2014 \u0627\u0644\u0627\u0633\u062A\u0631\u0627\u062A\u064A\u062C\u064A\u0629 \u0646\u064F\u0634\u0631\u062A \u0628\u062F\u0648\u0646 \u0645\u0639\u0627\u064A\u0631\u0629`;
  } else if (winning < minPrimary) {
    reasonBlocked = `\u0627\u0644\u0645\u0631\u062D\u0644\u0629 \u0627\u0644\u0623\u0648\u0644\u0649 (\u0627\u0644\u0623\u0633\u0627\u0633): \u0627\u0644\u0646\u062A\u064A\u062C\u0629 ${winning.toFixed(1)} < \u0627\u0644\u062D\u062F \u0627\u0644\u0623\u062F\u0646\u0649 ${minPrimary.toFixed(1)}`;
  } else if (primaryStrength < PRIMARY_STRENGTH_MIN) {
    reasonBlocked = `\u0642\u0648\u0629 \u0627\u0644\u0623\u0633\u0627\u0633 ${(primaryStrength * 100).toFixed(0)}% < \u0627\u0644\u062D\u062F \u0627\u0644\u0623\u062F\u0646\u0649 ${(PRIMARY_STRENGTH_MIN * 100).toFixed(0)}%`;
  } else if (!filterPassed) {
    reasonBlocked = `\u0627\u0644\u0645\u0631\u062D\u0644\u0629 \u0627\u0644\u062B\u0627\u0644\u062B\u0629 (\u0627\u0644\u0641\u0644\u0627\u062A\u0631): ${filterFailReason}`;
  } else if (!confirmationPass) {
    reasonBlocked = `\u0627\u0644\u0645\u0631\u062D\u0644\u0629 \u0627\u0644\u062B\u0627\u0646\u064A\u0629 (\u0627\u0644\u062A\u0623\u0643\u064A\u062F): ${normalized.toFixed(2)} < \u0627\u0644\u062D\u062F \u0627\u0644\u0645\u0637\u0644\u0648\u0628 ${threshold.toFixed(2)}`;
  } else if (separation < MIN_SIGNAL_SEPARATION) {
    reasonBlocked = `\u0627\u0644\u0641\u0635\u0644 \u0628\u064A\u0646 \u0627\u0644\u0627\u062A\u062C\u0627\u0647\u064A\u0646 ${(separation * 100).toFixed(0)}% < \u0627\u0644\u062D\u062F \u0627\u0644\u0623\u062F\u0646\u0649 ${(MIN_SIGNAL_SEPARATION * 100).toFixed(0)}%`;
  }
  const confirmAlignment = confirm.length === 0 ? "neutral" : opposingTrue > 0 ? "conflict" : agreed > 0 ? "aligned" : "neutral";
  const qualityScore = clamp01(
    QUALITY_WEIGHTS.primaryStrength * primaryStrength + QUALITY_WEIGHTS.consensus * clamp01((clusters - 1) / (INDEP_REFERENCE - 1)) + QUALITY_WEIGHTS.confirmation * clamp01((normalized + 1) / 2) + QUALITY_WEIGHTS.separation * clamp01(separation) + QUALITY_WEIGHTS.conflict * (1 - conflictPenalty)
  ) * 100;
  const rawCats = isCall ? catsCall.size : catsPut.size;
  return {
    result: reasonBlocked === null ? "SIGNAL" : "NO_SIGNAL",
    direction: reasonBlocked === null ? direction : null,
    rawScore: { CALL: rawCall, PUT: rawPut },
    finalScore: { CALL: finalCall, PUT: finalPut },
    categoryCount: { CALL: catsCall.size, PUT: catsPut.size },
    filterPassed,
    confirmAlignment,
    reasonBlocked,
    qualityScore,
    primaryScore: winning,
    callPrimaryScore: multipliedCall,
    putPrimaryScore: multipliedPut,
    primaryGap: Math.abs(multipliedCall - multipliedPut),
    primaryStrength,
    rawConfirmationScore: rawConfirmation,
    normalizedConfirmationScore: normalized,
    effectiveConfirmationMin: -capMin,
    effectiveConfirmationMax: capMax,
    effectiveConfirmationThreshold: threshold,
    confirmationCapacity: confirm.length,
    finalConfirmationPass: confirmationPass,
    consensusScore: consensusMultiplier(clusters),
    categories: { CALL: [...catsCall], PUT: [...catsPut] },
    effectiveIndependentCategories: { CALL: cCall.clusters, PUT: cPut.clusters },
    correlationAdjustment: rawCats - clusters,
    calibrated,
    signalSeparation: separation,
    conflictPenalty,
    reason: reasonBlocked ?? `${direction} \u2014 \u062C\u0648\u062F\u0629 ${qualityScore.toFixed(0)}/100`
  };
}

// packages/engine/src/strategy.ts
function effectiveMaxScore(strategy) {
  if (strategy.maxScore > 0) return strategy.maxScore;
  const sum = strategy.rules.filter((r) => r.enabled).reduce((s, r) => s + Math.abs(r.score), 0);
  return sum > 0 ? sum : 1;
}
function evaluateRules(strategy, ctx) {
  const cache = ctx.cache ?? /* @__PURE__ */ new Map();
  if (strategy.pyramid != null) {
    const pro = evaluateStrategyPro(strategy, { ...ctx, cache });
    if (pro.result !== "SIGNAL") return 0;
    return pro.finalScore.CALL - pro.finalScore.PUT;
  }
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

// packages/engine/src/pyramid/calibrate.ts
var GAP_TOLERANCE = 1.5;
function contiguousRuns(candles, stepSeconds, minLength) {
  const runs = [];
  let run = [];
  for (let i = 0; i < candles.length; i++) {
    if (i > 0 && (candles[i].time - candles[i - 1].time) / 1e3 > stepSeconds * GAP_TOLERANCE) {
      if (run.length >= minLength) runs.push(run);
      run = [];
    }
    run.push(candles[i]);
  }
  if (run.length >= minLength) runs.push(run);
  return runs;
}
function primaryRulesOf(strategies) {
  const seen = /* @__PURE__ */ new Map();
  for (const s of strategies) {
    for (const r of s.rules) {
      if (!r.enabled || r.role !== "primary") continue;
      const sig = ruleSignature(r);
      if (!seen.has(sig)) seen.set(sig, r);
    }
  }
  return [...seen.values()];
}
function buildCalibration(rules, series, options = {}) {
  const warmup = options.warmup ?? 55;
  const refreshBars = options.refreshBars ?? 8;
  const minSamples = options.minSamples ?? 200;
  const fireMin = options.fireMin ?? 0.05;
  const fireMax = options.fireMax ?? 0.95;
  const stepSeconds = options.stepSeconds ?? 3600;
  const segments = [];
  for (const candles of Object.values(series)) {
    segments.push(...contiguousRuns(candles, stepSeconds, warmup + 7));
  }
  const K = rules.length;
  const observations = [];
  const fired = new Array(K).fill(0);
  for (const seg of segments) {
    for (let i = warmup; i < seg.length; i++) {
      const window = seg.slice(0, i + 1);
      const current = window[window.length - 1];
      const clock = systemClock(new Date(current.time));
      const cache = /* @__PURE__ */ new Map();
      const v = new Uint8Array(K);
      for (let k = 0; k < K; k++) {
        const rule = rules[k];
        let hit = false;
        try {
          hit = checkCondition(rule, computeIndicator(window, rule, current.close, clock, cache) ?? 0);
        } catch {
          hit = false;
        }
        if (hit) {
          fired[k]++;
          v[k] = 1;
        }
      }
      observations.push({ time: current.time, v });
    }
  }
  const bars = observations.length;
  observations.sort((a, b) => a.time - b.time);
  const definitions = rules.map((r, k) => {
    const rate = bars > 0 ? fired[k] / bars : 0;
    return {
      signature: ruleSignature(r),
      indicator: r.indicator,
      condition: r.condition,
      target: r.pattern ?? (r.value != null ? String(r.value) : ""),
      firingRate: Number(rate.toFixed(4)),
      live: rate >= fireMin && rate <= fireMax
    };
  });
  const live = definitions.map((d, k) => d.live ? k : -1).filter((k) => k >= 0);
  const P = live.length;
  const sx = new Float64Array(P), sxx = new Float64Array(P), sxy = new Float64Array(P * P);
  let n = 0;
  const uniqueTimes = [...new Set(observations.map((o) => o.time))].sort((a, b) => a - b);
  const snapshots = [];
  let oi = 0;
  for (const boundary of uniqueTimes.filter((_, i) => i % refreshBars === 0)) {
    while (oi < observations.length && observations[oi].time < boundary) {
      const v = observations[oi].v;
      n++;
      for (let a = 0; a < P; a++) {
        const va = v[live[a]];
        sx[a] += va;
        sxx[a] += va * va;
        for (let b = a; b < P; b++) sxy[a * P + b] += va * v[live[b]];
      }
      oi++;
    }
    const pairs = {};
    const signatures = [];
    if (n >= minSamples) {
      for (let a = 0; a < P; a++) signatures.push(definitions[live[a]].signature);
      for (let a = 0; a < P; a++) {
        for (let b = a + 1; b < P; b++) {
          const cov = sxy[a * P + b] / n - sx[a] / n * (sx[b] / n);
          const va = sxx[a] / n - (sx[a] / n) ** 2;
          const vb = sxx[b] / n - (sx[b] / n) ** 2;
          if (va <= 0 || vb <= 0) continue;
          const r = Math.abs(cov / Math.sqrt(va * vb));
          if (!Number.isFinite(r)) continue;
          pairs[pairKey(definitions[live[a]].signature, definitions[live[b]].signature)] = Number(r.toFixed(4));
        }
      }
    }
    snapshots.push({ validTo: boundary, samples: n, authoritative: false, signatures, pairs });
  }
  return { definitions, snapshots, bars, symbols: Object.keys(series).length, segments: segments.length };
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CONFIDENCE_SATURATION_SCORE,
  DEFAULT_PYRAMID,
  DEFAULT_STRATEGY_CONFIG,
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
  buildCalibration,
  cacheKey,
  calibrationFor,
  calibrationFromJson,
  candlePatterns,
  canonicalName,
  categoryForIndicator,
  cci,
  checkCondition,
  clamp,
  cmf,
  computeIndicator,
  confidenceFor,
  contiguousRuns,
  correlationOf,
  coversSignature,
  effectiveMaxScore,
  ema,
  evaluateRules,
  evaluateStrategyPro,
  fullMacd,
  guaranteedWinExit,
  hasCalibration,
  indicatorFor,
  isRegistered,
  liquidityZones,
  makeRule,
  marketStructure,
  mfi,
  obv,
  outcomeFor,
  pairKey,
  primaryRulesOf,
  pyramidFromJson,
  registeredNames,
  registeredNamesInOrder,
  resolveExitPrice,
  roc,
  rsi,
  rsiDivergence,
  ruleFromJson,
  ruleSignature,
  scoreStandard,
  scoreV2,
  setCalibration,
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

module.exports.BUNDLE_SOURCE_HASH = "96507b39ce17bdb533977ddd04e48e8c9862e5a8dd5192baf252e262dca1353b";

