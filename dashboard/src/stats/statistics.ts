import { computeConstructScores } from './cleaning';
import {
  FREQUENCY_ORDER,
  ITEM_METADATA,
  LIKERT_ITEM_IDS,
  QUALITY_ITEM_IDS,
  REVIEW_ITEM_IDS,
  SENIORITY_ORDER,
  VELOCITY_ITEM_IDS,
} from './parser';
import type {
  CohenMagnitude,
  CollectionPhase,
  ConfidenceInterval,
  ConstructDescriptiveStats,
  ConstructId,
  ContingencyAnalysis,
  CronbachAnalysis,
  DistributionCounts,
  DunnPairResult,
  EarlyVsLateSplit,
  ExploratoryReport,
  FilterState,
  GroupSummary,
  ItemDropDiagnostic,
  KruskalWallisResult,
  LikertItemId,
  LikertItemStats,
  MannWhitneyResult,
  PairedComparisonResult,
  ProfileBreakdownItem,
  QP3ItemComparison,
  QP3Result,
  QP4ItemCorrelation,
  QP4Result,
  QP4ScatterPoint,
  QP4SensitivityRow,
  QualityItemId,
  ReliabilityReport,
  ReviewItemId,
  SeniorityLevel,
  SpearmanReliability,
  SpearmanResult,
  TimelinePoint,
  ValidRespondent,
} from './types';

const BOOTSTRAP_B = 5000;
const BOOTSTRAP_SEED = 42;
const FISHER_MONTE_CARLO_B = 10000;
const Z_95 = 1.96;

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Special Mathematical Functions (SciPy-aligned) ----------

function logGamma(z: number): number {
  const g = 7;
  const p = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  if (z < 0.5) {
    return (
      Math.log(Math.PI) -
      Math.log(Math.sin(Math.PI * z)) -
      logGamma(1 - z)
    );
  }
  const zz = z - 1;
  let x = p[0];
  for (let i = 1; i < g + 2; i++) {
    x += p[i] / (zz + i);
  }
  const t = zz + g + 0.5;
  return (
    0.5 * Math.log(2 * Math.PI) +
    (zz + 0.5) * Math.log(t) -
    t +
    Math.log(x)
  );
}

function betacf(a: number, b: number, x: number): number {
  const maxIter = 200;
  const eps = 3e-14;
  const fpmin = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < fpmin) d = fpmin;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= maxIter; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < fpmin) d = fpmin;
    c = 1 + aa / c;
    if (Math.abs(c) < fpmin) c = fpmin;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < fpmin) d = fpmin;
    c = 1 + aa / c;
    if (Math.abs(c) < fpmin) c = fpmin;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < eps) break;
  }
  return h;
}

export function betainc(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(
    logGamma(a + b) -
      logGamma(a) -
      logGamma(b) +
      a * Math.log(x) +
      b * Math.log(1 - x)
  );
  if (x < (a + 1) / (a + b + 2)) {
    return (bt * betacf(a, b, x)) / a;
  }
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

export function twoTailedTPValue(t: number, df: number): number {
  if (!Number.isFinite(t) || df <= 0) return 0;
  if (t === 0) return 1;
  const x = df / (df + t * t);
  return Math.min(1, Math.max(0, betainc(x, df / 2, 0.5)));
}

function gammaincUpper(a: number, x: number): number {
  if (x <= 0) return 1;
  const eps = 3e-14;
  const fpmin = 1e-300;
  const gln = logGamma(a);

  if (x < a + 1) {
    let ap = a;
    let sum = 1 / a;
    let del = sum;
    for (let n = 1; n <= 200; n++) {
      ap += 1;
      del *= x / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * eps) {
        const lower = sum * Math.exp(-x + a * Math.log(x) - gln);
        return Math.min(1, Math.max(0, 1 - lower));
      }
    }
    const lower = sum * Math.exp(-x + a * Math.log(x) - gln);
    return Math.min(1, Math.max(0, 1 - lower));
  }

  let b = x + 1 - a;
  let c = 1 / fpmin;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i <= 200; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < fpmin) d = fpmin;
    c = b + an / c;
    if (Math.abs(c) < fpmin) c = fpmin;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < eps) break;
  }
  return Math.min(
    1,
    Math.max(0, Math.exp(-x + a * Math.log(x) - gln) * h)
  );
}

export function chi2PValue(x: number, df: number): number {
  if (df <= 0 || x <= 0) return x <= 0 ? 1 : 0;
  return gammaincUpper(df / 2, x / 2);
}

export function normalCDF(z: number): number {
  if (z === 0) return 0.5;
  const absZ = Math.abs(z);
  const q = 0.5 * gammaincUpper(0.5, (absZ * absZ) / 2);
  return z >= 0 ? 1 - q : q;
}

// ---------- Basic Helpers ----------

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function sampleVariance(values: number[]): number {
  if (values.length < 2) return 0;
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  let sq = 0;
  for (const v of values) sq += (v - m) * (v - m);
  return sq / (values.length - 1);
}

export function sampleSD(values: number[]): number | null {
  if (values.length < 2) return null;
  return Math.sqrt(sampleVariance(values));
}

export function quantileSorted(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];
  const idx = p * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const w = idx - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return quantileSorted(sorted, 0.5);
}

export function modes(values: number[]): number[] {
  if (values.length === 0) return [];
  const freq = new Map<number, number>();
  let maxFreq = 0;
  for (const v of values) {
    const key = Number(v.toFixed(4));
    const next = (freq.get(key) ?? 0) + 1;
    freq.set(key, next);
    if (next > maxFreq) maxFreq = next;
  }
  const result: number[] = [];
  for (const [val, count] of freq.entries()) {
    if (count === maxFreq) result.push(val);
  }
  return result.sort((a, b) => a - b);
}

export function mad(values: number[]): number | null {
  if (values.length === 0) return null;
  const med = median(values);
  if (med === null) return null;
  const devs = values.map((v) => Math.abs(v - med));
  return median(devs);
}

export function wilsonCI(
  successes: number,
  total: number,
  z = Z_95
): ConfidenceInterval {
  if (total <= 0) return { lower: 0, upper: 0, level: 0.95 };
  const p = successes / total;
  const z2 = z * z;
  const denom = 1 + z2 / total;
  const center = (p + z2 / (2 * total)) / denom;
  const half =
    (z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total)) / denom;
  return {
    lower: Math.max(0, (center - half) * 100),
    upper: Math.min(100, (center + half) * 100),
    level: 0.95,
  };
}

export function marginOfErrorPct(n: number): number {
  if (n <= 0) return 0;
  return Z_95 * Math.sqrt(0.25 / n) * 100;
}

function summarizeGroup(group: string, values: number[]): GroupSummary {
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = quantileSorted(sorted, 0.25);
  const q3 = quantileSorted(sorted, 0.75);
  return {
    group,
    n: values.length,
    median: quantileSorted(sorted, 0.5),
    q1,
    q3,
    iqr: q1 !== null && q3 !== null ? q3 - q1 : null,
    mad: mad(values),
    min: sorted.length > 0 ? sorted[0] : null,
    max: sorted.length > 0 ? sorted[sorted.length - 1] : null,
    values,
  };
}

function bootstrapCI<T>(
  items: T[],
  statFn: (sample: T[]) => number | null,
  B = BOOTSTRAP_B,
  seed = BOOTSTRAP_SEED
): ConfidenceInterval | null {
  if (items.length < 3) return null;
  const rng = mulberry32(seed);
  const stats: number[] = [];
  const n = items.length;

  for (let b = 0; b < B; b++) {
    const sample: T[] = new Array(n);
    for (let i = 0; i < n; i++) {
      sample[i] = items[Math.floor(rng() * n)];
    }
    const val = statFn(sample);
    if (val !== null && Number.isFinite(val)) {
      stats.push(val);
    }
  }

  if (stats.length < 100) return null;
  stats.sort((a, b) => a - b);
  const lower = quantileSorted(stats, 0.025);
  const upper = quantileSorted(stats, 0.975);
  if (lower === null || upper === null) return null;
  return { lower, upper, level: 0.95 };
}

function pearsonCorrelation(x: number[], y: number[]): number | null {
  if (x.length !== y.length || x.length < 2) return null;
  const n = x.length;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const vx = x[i] - mx;
    const vy = y[i] - my;
    num += vx * vy;
    dx += vx * vx;
    dy += vy * vy;
  }
  const denom = Math.sqrt(dx * dy);
  if (denom === 0) return null;
  return num / denom;
}

export function averageRanks(values: number[]): {
  ranks: number[];
  tieCounts: number[];
} {
  const n = values.length;
  const indexed = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const ranks = new Array<number>(n);
  const tieCounts: number[] = [];

  let i = 0;
  while (i < n) {
    let j = i + 1;
    while (j < n && indexed[j].v === indexed[i].v) j++;
    const count = j - i;
    if (count > 1) tieCounts.push(count);
    const avgRank = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) {
      ranks[indexed[k].i] = avgRank;
    }
    i = j;
  }

  return { ranks, tieCounts };
}

// ---------- Descriptives (QP1 & QP2) ----------

function buildItemStats(
  id: LikertItemId | ReviewItemId,
  values: Array<number | null>,
  effectiveInverted: boolean
): LikertItemStats {
  const meta = ITEM_METADATA[id];
  const distribution: DistributionCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, NA: 0 };
  const valid: number[] = [];

  for (const v of values) {
    if (v === null) {
      distribution.NA += 1;
    } else {
      valid.push(v);
      const bucket = Math.min(5, Math.max(1, Math.round(v))) as 1 | 2 | 3 | 4 | 5;
      distribution[bucket] += 1;
    }
  }

  const nValid = valid.length;
  const agreementCount = valid.filter((v) => v >= 4).length;
  const neutralCount = valid.filter((v) => v === 3).length;
  const disagreementCount = valid.filter((v) => v <= 2).length;

  return {
    id,
    shortLabel: meta.shortLabel,
    questionText: meta.questionText,
    construct: meta.construct as ConstructId,
    inverted: Boolean(meta.inverted),
    effectiveInverted,
    nValid,
    nNA: distribution.NA,
    median: median(valid),
    modes: modes(valid),
    mad: mad(valid),
    mean: mean(valid),
    sd: sampleSD(valid),
    agreementCount,
    agreementPct: nValid > 0 ? (agreementCount / nValid) * 100 : 0,
    agreementWilsonCI: wilsonCI(agreementCount, nValid),
    neutralCount,
    neutralPct: nValid > 0 ? (neutralCount / nValid) * 100 : 0,
    disagreementCount,
    disagreementPct: nValid > 0 ? (disagreementCount / nValid) * 100 : 0,
    distribution,
  };
}

function buildConstructStats(
  id: ConstructId,
  label: string,
  scores: Array<number | null>
): ConstructDescriptiveStats {
  const distribution: DistributionCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, NA: 0 };
  const valid: number[] = [];

  for (const s of scores) {
    if (s === null) {
      distribution.NA += 1;
    } else {
      valid.push(s);
      const bucket = Math.min(5, Math.max(1, Math.round(s))) as 1 | 2 | 3 | 4 | 5;
      distribution[bucket] += 1;
    }
  }

  const nValid = valid.length;
  const agreementCount = valid.filter((v) => v >= 4).length;

  return {
    id,
    label,
    nValid,
    nMissing: distribution.NA,
    median: median(valid),
    modes: modes(valid),
    mad: mad(valid),
    mean: mean(valid),
    sd: sampleSD(valid),
    agreementCount,
    agreementPct: nValid > 0 ? (agreementCount / nValid) * 100 : 0,
    agreementWilsonCI: wilsonCI(agreementCount, nValid),
    distribution,
  };
}

// ---------- Reliability (Sec. 5.2) ----------

export function computeCronbachAlpha(matrix: number[][]): number | null {
  const n = matrix.length;
  if (n < 2) return null;
  const k = matrix[0]?.length ?? 0;
  if (k < 2) return null;

  let sumItemVar = 0;
  for (let j = 0; j < k; j++) {
    const col = matrix.map((row) => row[j]);
    sumItemVar += sampleVariance(col);
  }

  const totals = matrix.map((row) => row.reduce((a, b) => a + b, 0));
  const totalVar = sampleVariance(totals);
  if (totalVar === 0) return null;

  return (k / (k - 1)) * (1 - sumItemVar / totalVar);
}

function analyzeCronbach(
  construct: 'C_VEL' | 'C_QUAL',
  label: string,
  itemIds: LikertItemId[],
  respondents: ValidRespondent[],
  invertItem16: boolean
): CronbachAnalysis {
  const threshold = 0.7;
  const completeRows = respondents
    .map((r) =>
      itemIds.map((id) => {
        if (id === 'ITEM_16') {
          const raw = r.likertNumeric.ITEM_16;
          return raw === null ? null : invertItem16 ? 6 - raw : raw;
        }
        return r.likertNumeric[id];
      })
    )
    .filter((row): row is number[] => row.every((v) => v !== null));

  const alpha = computeCronbachAlpha(completeRows);
  const ci95 = bootstrapCI(completeRows, computeCronbachAlpha);

  const itemDiagnostics: ItemDropDiagnostic[] = itemIds.map((itemId, idx) => {
    const restIndices = itemIds
      .map((_, j) => j)
      .filter((j) => j !== idx);
    const itemCol = completeRows.map((row) => row[idx]);
    const restSumCol = completeRows.map((row) =>
      restIndices.reduce((acc, j) => acc + row[j], 0)
    );
    const rItemTotalCorrected = pearsonCorrelation(itemCol, restSumCol);
    const subMatrix = completeRows.map((row) =>
      restIndices.map((j) => row[j])
    );
    const alphaIfDropped = computeCronbachAlpha(subMatrix);
    const deltaAlpha =
      alpha !== null && alphaIfDropped !== null
        ? alphaIfDropped - alpha
        : null;
    const candidateForRemoval =
      alpha !== null &&
      alpha < threshold &&
      rItemTotalCorrected !== null &&
      rItemTotalCorrected < 0.3 &&
      deltaAlpha !== null &&
      deltaAlpha >= 0.05;

    return {
      itemId,
      shortLabel: ITEM_METADATA[itemId].shortLabel,
      questionText: ITEM_METADATA[itemId].questionText,
      nUsed: completeRows.length,
      rItemTotalCorrected,
      alphaIfDropped,
      deltaAlpha,
      candidateForRemoval,
    };
  });

  const passedThreshold = alpha !== null && alpha >= threshold;
  let fallbackAction: CronbachAnalysis['fallbackAction'] = 'none';
  let recommendedDropItem: LikertItemId | null = null;
  let alphaAfterDrop: number | null = null;
  let note = 'Confiabilidade interna adequada (α ≥ 0,70).';

  if (!passedThreshold) {
    const candidates = itemDiagnostics
      .filter((d) => d.candidateForRemoval && d.alphaIfDropped !== null)
      .sort((a, b) => (b.alphaIfDropped ?? 0) - (a.alphaIfDropped ?? 0));

    if (candidates.length > 0 && (candidates[0].alphaIfDropped ?? 0) >= threshold) {
      fallbackAction = 'drop_single_item';
      recommendedDropItem = candidates[0].itemId;
      alphaAfterDrop = candidates[0].alphaIfDropped;
      note = `α < 0,70: remoção de ${recommendedDropItem} (r_it < 0,30 e Δα ≥ +0,05) eleva α para ${alphaAfterDrop?.toFixed(3)}.`;
    } else {
      fallbackAction = 'item_by_item_bonferroni';
      if (candidates.length > 0) {
        recommendedDropItem = candidates[0].itemId;
        alphaAfterDrop = candidates[0].alphaIfDropped;
      }
      note =
        'Fallback Seção 5.2 ativo: α < 0,70 sem item único que eleve α ≥ 0,70; QP3/QP4 requerem leitura item a item com Bonferroni.';
    }
  }

  return {
    construct,
    label,
    nComplete: completeRows.length,
    nItems: itemIds.length,
    alpha,
    ci95,
    passedThreshold,
    threshold,
    itemDiagnostics,
    fallbackAction,
    recommendedDropItem,
    alphaAfterDrop,
    note,
  };
}

export function computeSpearman(
  x: number[],
  y: number[]
): { rho: number | null; pValue: number | null } {
  if (x.length !== y.length || x.length < 3) {
    return { rho: null, pValue: null };
  }
  const { ranks: rx } = averageRanks(x);
  const { ranks: ry } = averageRanks(y);
  const rho = pearsonCorrelation(rx, ry);
  if (rho === null) return { rho: null, pValue: null };
  if (Math.abs(rho) >= 1) return { rho: rho > 0 ? 1 : -1, pValue: 0 };
  const n = x.length;
  const t = rho * Math.sqrt((n - 2) / (1 - rho * rho));
  const pValue = twoTailedTPValue(t, n - 2);
  return { rho, pValue };
}

export function analyzeReliability(
  respondents: ValidRespondent[],
  invertItem16 = true
): ReliabilityReport {
  const cVel = analyzeCronbach(
    'C_VEL',
    'Velocidade Percebida (C_VEL)',
    VELOCITY_ITEM_IDS,
    respondents,
    invertItem16
  );
  const cQual = analyzeCronbach(
    'C_QUAL',
    'Qualidade Percebida (C_QUAL)',
    QUALITY_ITEM_IDS,
    respondents,
    invertItem16
  );

  const revPairs = respondents
    .map((r) => ({
      x: r.reviewNumeric.ITEM_19,
      y: r.reviewNumeric.ITEM_20,
    }))
    .filter((p): p is { x: number; y: number } => p.x !== null && p.y !== null);

  const revX = revPairs.map((p) => p.x);
  const revY = revPairs.map((p) => p.y);
  const revRes = computeSpearman(revX, revY);
  const revCI = bootstrapCI(revPairs, (sample) =>
    computeSpearman(
      sample.map((s) => s.x),
      sample.map((s) => s.y)
    ).rho
  );

  const mRevThreshold = 0.5;
  const mRevPassed = revRes.rho !== null && revRes.rho >= mRevThreshold;
  const mRev: SpearmanReliability = {
    construct: 'M_REV',
    label: 'Rigor de Revisão (M_REV)',
    items: ['ITEM_19', 'ITEM_20'],
    n: revPairs.length,
    rho: revRes.rho,
    pValue: revRes.pValue,
    ci95: revCI,
    passedThreshold: mRevPassed,
    threshold: mRevThreshold,
    fallbackAction: mRevPassed ? 'none' : 'item_by_item_bonferroni',
    note: mRevPassed
      ? 'Consistência entre revisão linha a linha e execução de testes adequada (ρ ≥ 0,50).'
      : 'Fallback Seção 5.2 ativo: ρ < 0,50 em M_REV; analisar ITEM_19 e ITEM_20 separadamente com Bonferroni.',
  };

  const fallbackTriggers: string[] = [];
  if (cVel.fallbackAction === 'item_by_item_bonferroni') {
    fallbackTriggers.push('C_VEL (α < 0,70)');
  }
  if (cQual.fallbackAction === 'item_by_item_bonferroni') {
    fallbackTriggers.push('C_QUAL (α < 0,70)');
  }
  if (mRev.fallbackAction === 'item_by_item_bonferroni') {
    fallbackTriggers.push('M_REV (ρ < 0,50)');
  }

  return {
    cVel,
    cQual,
    mRev,
    anyFallbackActive: fallbackTriggers.length > 0,
    fallbackReason:
      fallbackTriggers.length > 0
        ? `Fallback Seção 5.2 acionado por: ${fallbackTriggers.join(', ')}.`
        : null,
  };
}

// ---------- Non-Parametric Tests (QP3) ----------

function exactMannWhitneyTwoTailedP(
  uMin: number,
  n1: number,
  n2: number
): number {
  const maxU = Math.floor(uMin);
  // Dynamic programming: dp[u] = number of subsets of size n1 from n1+n2 with U = u
  const totalCols = n1 * n2;
  let dp = new Array<number>(totalCols + 1).fill(0);
  dp[0] = 1;
  for (let i = 1; i <= n1 + n2; i++) {
    const next = new Array<number>(totalCols + 1).fill(0);
    // Simplified via standard partition DP: compute count(a, b, u) with memoization
    dp = next;
  }
  void dp;

  const memo = new Map<string, number>();
  const countWays = (a: number, b: number, u: number): number => {
    if (u < 0) return 0;
    if (a === 0 || b === 0) return u === 0 ? 1 : 0;
    if (u > a * b) return 0;
    const key = `${a},${b},${u}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    const val = countWays(a - 1, b, u - b) + countWays(a, b - 1, u);
    memo.set(key, val);
    return val;
  };

  let totalComb = 1;
  for (let i = 1; i <= n1; i++) {
    totalComb = (totalComb * (n2 + i)) / i;
  }

  let tail = 0;
  for (let u = 0; u <= maxU; u++) {
    tail += countWays(n1, n2, u);
  }
  return Math.min(1, (2 * tail) / totalComb);
}

export function mannWhitneyU(
  target: string,
  label: string,
  groupAName: string,
  groupA: number[],
  groupBName: string,
  groupB: number[],
  alphaAdjusted = 0.05
): MannWhitneyResult {
  const n1 = groupA.length;
  const n2 = groupB.length;
  const groups = [
    summarizeGroup(groupAName, groupA),
    summarizeGroup(groupBName, groupB),
  ];

  if (n1 === 0 || n2 === 0) {
    return {
      target,
      label,
      groupA: groupAName,
      groupB: groupBName,
      nA: n1,
      nB: n2,
      u: null,
      z: null,
      pValue: null,
      pExact: null,
      pMethod: 'normal_approx',
      alphaAdjusted,
      significant: false,
      effectR: null,
      rankBiserialR: null,
      groups,
    };
  }

  const combined = [...groupA, ...groupB];
  const { ranks, tieCounts } = averageRanks(combined);
  let r1 = 0;
  for (let i = 0; i < n1; i++) r1 += ranks[i];

  const u1 = r1 - (n1 * (n1 + 1)) / 2;
  const u2 = n1 * n2 - u1;
  const uMin = Math.min(u1, u2);
  const N = n1 + n2;

  const meanU = (n1 * n2) / 2;
  const tieSum = tieCounts.reduce((acc, t) => acc + (t * t * t - t), 0);
  const varU =
    ((n1 * n2) / 12) * (N + 1 - (N > 1 ? tieSum / (N * (N - 1)) : 0));
  const sdU = Math.sqrt(Math.max(0, varU));

  let zAbs = 0;
  let zSigned = 0;
  let pNormal = 1;
  if (sdU > 0) {
    const diff = u1 - meanU;
    zSigned = diff / sdU;
    const correctedDiff = Math.max(0, Math.abs(diff) - 0.5);
    zAbs = correctedDiff / sdU;
    pNormal = 2 * (1 - normalCDF(zAbs));
  }

  const canExact = tieCounts.length === 0 && N <= 20;
  const pExact = canExact ? exactMannWhitneyTwoTailedP(uMin, n1, n2) : null;
  const pMethod: 'exact' | 'normal_approx' = canExact ? 'exact' : 'normal_approx';
  const pValue = canExact && pExact !== null ? pExact : pNormal;

  const effectR = sdU > 0 ? Math.abs(zSigned) / Math.sqrt(N) : 0;
  const rankBiserialR = (2 * u1) / (n1 * n2) - 1;

  return {
    target,
    label,
    groupA: groupAName,
    groupB: groupBName,
    nA: n1,
    nB: n2,
    u: u1,
    z: zSigned,
    pValue,
    pExact,
    pMethod,
    alphaAdjusted,
    significant: pValue < alphaAdjusted,
    effectR,
    rankBiserialR,
    groups,
  };
}

function computeKruskalH(groups: number[][]): {
  h: number | null;
  epsilonSquared: number | null;
  tieSum: number;
  N: number;
  meanRanks: number[];
} {
  const nonEmpty = groups.filter((g) => g.length > 0);
  const k = nonEmpty.length;
  const N = nonEmpty.reduce((acc, g) => acc + g.length, 0);
  if (k < 2 || N <= k) {
    return { h: null, epsilonSquared: null, tieSum: 0, N, meanRanks: [] };
  }

  const flat = nonEmpty.flat();
  const { ranks, tieCounts } = averageRanks(flat);

  let offset = 0;
  let sumRankSqOverN = 0;
  const meanRanks: number[] = [];

  for (const g of nonEmpty) {
    let rankSum = 0;
    for (let i = 0; i < g.length; i++) {
      rankSum += ranks[offset + i];
    }
    offset += g.length;
    sumRankSqOverN += (rankSum * rankSum) / g.length;
    meanRanks.push(rankSum / g.length);
  }

  const hRaw = (12 / (N * (N + 1))) * sumRankSqOverN - 3 * (N + 1);
  const tieSum = tieCounts.reduce((acc, t) => acc + (t * t * t - t), 0);
  const denom = N * N * N - N;
  const tieCorrection = denom > 0 ? 1 - tieSum / denom : 1;
  const h = tieCorrection > 0 ? hRaw / tieCorrection : null;
  const epsilonSquared = h !== null && N > k ? (h - k + 1) / (N - k) : null;

  return { h, epsilonSquared, tieSum, N, meanRanks };
}

export function kruskalWallis(
  target: string,
  label: string,
  groupedValues: Array<{ group: string; values: number[] }>,
  alphaAdjusted = 0.025
): KruskalWallisResult {
  const groups = groupedValues.map((g) => summarizeGroup(g.group, g.values));
  const nonEmpty = groupedValues.filter((g) => g.values.length > 0);
  const k = nonEmpty.length;
  const { h, epsilonSquared, tieSum, N, meanRanks } = computeKruskalH(
    nonEmpty.map((g) => g.values)
  );

  const pValue = h !== null && k >= 2 ? chi2PValue(h, k - 1) : null;

  // Bootstrap CI for epsilonSquared using stratified/overall resampling of labeled observations
  const labeledObs: Array<{ gIdx: number; val: number }> = [];
  nonEmpty.forEach((g, gIdx) => {
    for (const val of g.values) labeledObs.push({ gIdx, val });
  });

  const epsilonSquaredCI = bootstrapCI(labeledObs, (sample) => {
    const buckets: number[][] = nonEmpty.map(() => []);
    for (const obs of sample) buckets[obs.gIdx].push(obs.val);
    if (buckets.some((b) => b.length === 0)) return null;
    return computeKruskalH(buckets).epsilonSquared;
  });

  // Dunn's post-hoc with Bonferroni (k*(k-1)/2 pairs)
  const numPairs = (k * (k - 1)) / 2;
  const dunnPostHoc: DunnPairResult[] = [];
  const baseTerm =
    N > 1 ? (N * (N + 1)) / 12 - tieSum / (12 * (N - 1)) : 0;

  for (let i = 0; i < nonEmpty.length; i++) {
    for (let j = i + 1; j < nonEmpty.length; j++) {
      const nA = nonEmpty[i].values.length;
      const nB = nonEmpty[j].values.length;
      const se = Math.sqrt(Math.max(0, baseTerm * (1 / nA + 1 / nB)));
      const z = se > 0 ? (meanRanks[i] - meanRanks[j]) / se : 0;
      const pRaw = 2 * (1 - normalCDF(Math.abs(z)));
      const pBonferroni = Math.min(1, pRaw * Math.max(1, numPairs));
      dunnPostHoc.push({
        pair: `${nonEmpty[i].group} vs ${nonEmpty[j].group}`,
        groupA: nonEmpty[i].group,
        groupB: nonEmpty[j].group,
        z,
        pRaw,
        pBonferroni,
        significant: pBonferroni < alphaAdjusted,
      });
    }
  }

  return {
    target,
    label,
    n: N,
    k,
    h,
    pValue,
    alphaAdjusted,
    significant: pValue !== null && pValue < alphaAdjusted,
    epsilonSquared,
    epsilonSquaredCI,
    groups,
    dunnPostHoc,
  };
}

export function analyzeQP3(
  respondents: ValidRespondent[],
  invertItem16 = true
): QP3Result {
  const alphaFamily = 0.025;
  const minRequiredPerGroup = 8;

  const groupCounts: Record<SeniorityLevel, number> = {
    Júnior: 0,
    Pleno: 0,
    Sênior: 0,
  };
  for (const r of respondents) {
    if (r.seniority) groupCounts[r.seniority] += 1;
  }

  const minGroupSize = Math.min(
    groupCounts.Júnior,
    groupCounts.Pleno,
    groupCounts.Sênior
  );
  const mergeApplied = minGroupSize < minRequiredPerGroup;

  // Determine adjacent pair to merge if < 8 (Jr+Pl vs Sr, or Pl+Sr vs Jr if Sr < 8 and Jr >= 8)
  const mergeJrPl =
    groupCounts.Júnior < minRequiredPerGroup ||
    groupCounts.Pleno < minRequiredPerGroup ||
    groupCounts.Júnior + groupCounts.Pleno <= groupCounts.Pleno + groupCounts.Sênior;

  const extractConstruct = (
    target: 'C_VEL' | 'C_QUAL',
    filterFn: (r: ValidRespondent) => boolean
  ): number[] =>
    respondents
      .filter(filterFn)
      .map((r) => {
        if (target === 'C_VEL') return r.scores.C_VEL;
        return invertItem16 ? r.scores.C_QUAL : r.scores.C_QUAL_raw16;
      })
      .filter((v): v is number => v !== null);

  const cVelKW = kruskalWallis(
    'C_VEL',
    'Velocidade Percebida (C_VEL)',
    SENIORITY_ORDER.map((sen) => ({
      group: sen,
      values: extractConstruct('C_VEL', (r) => r.seniority === sen),
    })),
    alphaFamily
  );

  const cQualKW = kruskalWallis(
    'C_QUAL',
    'Qualidade Percebida (C_QUAL)',
    SENIORITY_ORDER.map((sen) => ({
      group: sen,
      values: extractConstruct('C_QUAL', (r) => r.seniority === sen),
    })),
    alphaFamily
  );

  let cVelMW: MannWhitneyResult | null = null;
  let cQualMW: MannWhitneyResult | null = null;
  let mergeRuleDescription =
    'Todos os 3 níveis têm n ≥ 8; Kruskal-Wallis aplicado diretamente (α = 0,025).';

  if (mergeApplied) {
    if (mergeJrPl) {
      const labelA = 'Júnior + Pleno';
      const labelB = 'Sênior';
      const isA = (r: ValidRespondent) =>
        r.seniority === 'Júnior' || r.seniority === 'Pleno';
      const isB = (r: ValidRespondent) => r.seniority === 'Sênior';
      cVelMW = mannWhitneyU(
        'C_VEL',
        'Velocidade Percebida (C_VEL)',
        labelA,
        extractConstruct('C_VEL', isA),
        labelB,
        extractConstruct('C_VEL', isB),
        alphaFamily
      );
      cQualMW = mannWhitneyU(
        'C_QUAL',
        'Qualidade Percebida (C_QUAL)',
        labelA,
        extractConstruct('C_QUAL', isA),
        labelB,
        extractConstruct('C_QUAL', isB),
        alphaFamily
      );
      mergeRuleDescription = `Regra Seção 5.3 acionada: Jr=${groupCounts.Júnior}, Pl=${groupCounts.Pleno}, Sr=${groupCounts.Sênior} (mín. < 8). Grupos adjacentes menores fundidos em Júnior+Pleno (${groupCounts.Júnior + groupCounts.Pleno}) vs Sênior (${groupCounts.Sênior}) com Mann-Whitney U (α = 0,025).`;
    } else {
      const labelA = 'Júnior';
      const labelB = 'Pleno + Sênior';
      const isA = (r: ValidRespondent) => r.seniority === 'Júnior';
      const isB = (r: ValidRespondent) =>
        r.seniority === 'Pleno' || r.seniority === 'Sênior';
      cVelMW = mannWhitneyU(
        'C_VEL',
        'Velocidade Percebida (C_VEL)',
        labelA,
        extractConstruct('C_VEL', isA),
        labelB,
        extractConstruct('C_VEL', isB),
        alphaFamily
      );
      cQualMW = mannWhitneyU(
        'C_QUAL',
        'Qualidade Percebida (C_QUAL)',
        labelA,
        extractConstruct('C_QUAL', isA),
        labelB,
        extractConstruct('C_QUAL', isB),
        alphaFamily
      );
      mergeRuleDescription = `Regra Seção 5.3 acionada: Jr=${groupCounts.Júnior}, Pl=${groupCounts.Pleno}, Sr=${groupCounts.Sênior} (mín. < 8). Grupos adjacentes fundidos em Júnior (${groupCounts.Júnior}) vs Pleno+Sênior (${groupCounts.Pleno + groupCounts.Sênior}) com Mann-Whitney U (α = 0,025).`;
    }
  }

  // Item-level comparisons with Bonferroni correction (10 items -> alpha = 0.05 / 10 or 0.025 / items per construct)
  const itemLevelFallback: QP3ItemComparison[] = LIKERT_ITEM_IDS.map((itemId) => {
    const construct: 'C_VEL' | 'C_QUAL' = VELOCITY_ITEM_IDS.includes(itemId)
      ? 'C_VEL'
      : 'C_QUAL';
    const itemsInConstruct = construct === 'C_VEL' ? 4 : 6;
    const pBonf = alphaFamily / itemsInConstruct;

    const getVal = (r: ValidRespondent): number | null => {
      const raw = r.likertNumeric[itemId];
      if (raw === null) return null;
      if (itemId === 'ITEM_16') return invertItem16 ? 6 - raw : raw;
      return raw;
    };

    const kw = kruskalWallis(
      itemId,
      ITEM_METADATA[itemId].shortLabel,
      SENIORITY_ORDER.map((sen) => ({
        group: sen,
        values: respondents
          .filter((r) => r.seniority === sen)
          .map(getVal)
          .filter((v): v is number => v !== null),
      })),
      pBonf
    );

    let mw: MannWhitneyResult | null = null;
    if (mergeApplied) {
      const labelA = mergeJrPl ? 'Júnior + Pleno' : 'Júnior';
      const labelB = mergeJrPl ? 'Sênior' : 'Pleno + Sênior';
      const isA = mergeJrPl
        ? (r: ValidRespondent) =>
            r.seniority === 'Júnior' || r.seniority === 'Pleno'
        : (r: ValidRespondent) => r.seniority === 'Júnior';
      const isB = mergeJrPl
        ? (r: ValidRespondent) => r.seniority === 'Sênior'
        : (r: ValidRespondent) =>
            r.seniority === 'Pleno' || r.seniority === 'Sênior';

      mw = mannWhitneyU(
        itemId,
        ITEM_METADATA[itemId].shortLabel,
        labelA,
        respondents
          .filter(isA)
          .map(getVal)
          .filter((v): v is number => v !== null),
        labelB,
        respondents
          .filter(isB)
          .map(getVal)
          .filter((v): v is number => v !== null),
        pBonf
      );
    }

    return {
      itemId,
      construct,
      shortLabel: ITEM_METADATA[itemId].shortLabel,
      pBonferroniThreshold: pBonf,
      mannWhitneyMerged: mw,
      kruskalWallis: kw,
    };
  });

  return {
    alphaFamily,
    groupCounts,
    minGroupSize,
    minRequiredPerGroup,
    mergeApplied,
    mergeRuleDescription,
    primaryMethod: mergeApplied ? 'mann_whitney_merged' : 'kruskal_wallis',
    cVelPrimary: mergeApplied && cVelMW ? cVelMW : cVelKW,
    cQualPrimary: mergeApplied && cQualMW ? cQualMW : cQualKW,
    cVelMannWhitneyMerged: cVelMW,
    cQualMannWhitneyMerged: cQualMW,
    cVelKruskalWallis: cVelKW,
    cQualKruskalWallis: cQualKW,
    itemLevelFallback,
  };
}

// ---------- QP4: Spearman & Partial Spearman ----------

export function classifyCohenRho(rho: number | null): {
  magnitude: CohenMagnitude;
  labelPt: string;
} {
  if (rho === null) return { magnitude: 'negligible', labelPt: 'Indisponível' };
  const abs = Math.abs(rho);
  if (abs < 0.1) return { magnitude: 'negligible', labelPt: 'Desprezível (< 0,10)' };
  if (abs < 0.3) return { magnitude: 'weak', labelPt: 'Fraca (0,10–0,29)' };
  if (abs < 0.5) return { magnitude: 'moderate', labelPt: 'Moderada (0,30–0,49)' };
  return { magnitude: 'strong', labelPt: 'Forte (≥ 0,50)' };
}

function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const m = A.length;
  const mat = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < m; col++) {
    let pivotRow = col;
    for (let r = col + 1; r < m; r++) {
      if (Math.abs(mat[r][col]) > Math.abs(mat[pivotRow][col])) {
        pivotRow = r;
      }
    }
    if (Math.abs(mat[pivotRow][col]) < 1e-12) return null;
    [mat[col], mat[pivotRow]] = [mat[pivotRow], mat[col]];

    const div = mat[col][col];
    for (let j = col; j <= m; j++) mat[col][j] /= div;
    for (let r = 0; r < m; r++) {
      if (r === col) continue;
      const factor = mat[r][col];
      for (let j = col; j <= m; j++) {
        mat[r][j] -= factor * mat[col][j];
      }
    }
  }
  return mat.map((row) => row[m]);
}

function olsResiduals(target: number[], covariates: number[][]): number[] | null {
  const n = target.length;
  const p = covariates[0]?.length ?? 0;
  if (n <= p) return null;

  // X^T X and X^T y
  const xtx = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  const xty = new Array<number>(p).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < p; j++) {
      xty[j] += covariates[i][j] * target[i];
      for (let k = 0; k < p; k++) {
        xtx[j][k] += covariates[i][j] * covariates[i][k];
      }
    }
  }
  const beta = solveLinearSystem(xtx, xty);
  if (!beta) return null;
  return target.map((y, i) => {
    let pred = 0;
    for (let j = 0; j < p; j++) pred += covariates[i][j] * beta[j];
    return y - pred;
  });
}

export function partialSpearman(
  x: number[],
  y: number[],
  z1: number[],
  z2: number[]
): { rho: number | null; pValue: number | null } {
  const n = x.length;
  if (n < 6) return { rho: null, pValue: null };

  const rx = averageRanks(x).ranks;
  const ry = averageRanks(y).ranks;
  const rz1 = averageRanks(z1).ranks;
  const rz2 = averageRanks(z2).ranks;

  const cov = rx.map((_, i) => [1, rz1[i], rz2[i]]);
  const resX = olsResiduals(rx, cov);
  const resY = olsResiduals(ry, cov);
  if (!resX || !resY) return { rho: null, pValue: null };

  const rho = pearsonCorrelation(resX, resY);
  if (rho === null) return { rho: null, pValue: null };
  if (Math.abs(rho) >= 1) return { rho: rho > 0 ? 1 : -1, pValue: 0 };

  const df = n - 4;
  const t = rho * Math.sqrt(df / (1 - rho * rho));
  const pValue = twoTailedTPValue(t, df);
  return { rho, pValue };
}

function seniorityCode(s: SeniorityLevel | null): number | null {
  if (s === 'Júnior') return 1;
  if (s === 'Pleno') return 2;
  if (s === 'Sênior') return 3;
  return null;
}

export function analyzeQP4(
  respondents: ValidRespondent[],
  invertItem16 = true,
  normalizeTools = true
): QP4Result {
  const alpha = 0.05;
  const getQual = (r: ValidRespondent): number | null =>
    invertItem16 ? r.scores.C_QUAL : r.scores.C_QUAL_raw16;

  const mainPairs = respondents
    .map((r) => ({ x: r.scores.M_REV, y: getQual(r), r }))
    .filter(
      (p): p is { x: number; y: number; r: ValidRespondent } =>
        p.x !== null && p.y !== null
    );

  const mainRes = computeSpearman(
    mainPairs.map((p) => p.x),
    mainPairs.map((p) => p.y)
  );
  const mainCI = bootstrapCI(mainPairs, (sample) =>
    computeSpearman(
      sample.map((s) => s.x),
      sample.map((s) => s.y)
    ).rho
  );
  const mainMag = classifyCohenRho(mainRes.rho);

  const main: SpearmanResult = {
    label: 'Spearman M_REV × C_QUAL (Principal)',
    n: mainPairs.length,
    rho: mainRes.rho,
    pValue: mainRes.pValue,
    ci95: mainCI,
    alpha,
    significant: mainRes.pValue !== null && mainRes.pValue < alpha,
    magnitude: mainMag.magnitude,
    magnitudeLabelPt: mainMag.labelPt,
  };

  // Sensitivity 1: C_QUAL without ITEM_16
  const no16Pairs = respondents
    .map((r) => ({ x: r.scores.M_REV, y: r.scores.C_QUAL_no16 }))
    .filter((p): p is { x: number; y: number } => p.x !== null && p.y !== null);
  const no16Res = computeSpearman(
    no16Pairs.map((p) => p.x),
    no16Pairs.map((p) => p.y)
  );
  const no16CI = bootstrapCI(no16Pairs, (sample) =>
    computeSpearman(
      sample.map((s) => s.x),
      sample.map((s) => s.y)
    ).rho
  );

  // Sensitivity 2: C_QUAL without ITEM_17
  const no17Pairs = respondents
    .map((r) => ({ x: r.scores.M_REV, y: r.scores.C_QUAL_no17 }))
    .filter((p): p is { x: number; y: number } => p.x !== null && p.y !== null);
  const no17Res = computeSpearman(
    no17Pairs.map((p) => p.x),
    no17Pairs.map((p) => p.y)
  );
  const no17CI = bootstrapCI(no17Pairs, (sample) =>
    computeSpearman(
      sample.map((s) => s.x),
      sample.map((s) => s.y)
    ).rho
  );

  // Sensitivity 3: Partial Spearman controlling M_SEN & M_USO
  const partialRows = respondents
    .map((r) => ({
      x: r.scores.M_REV,
      y: getQual(r),
      sen: seniorityCode(r.seniority),
      uso: r.frequencyCode,
    }))
    .filter(
      (p): p is { x: number; y: number; sen: number; uso: 1 | 2 | 3 | 4 } =>
        p.x !== null && p.y !== null && p.sen !== null && p.uso !== null
    );
  const partialRes = partialSpearman(
    partialRows.map((p) => p.x),
    partialRows.map((p) => p.y),
    partialRows.map((p) => p.sen),
    partialRows.map((p) => p.uso)
  );
  const partialCI = bootstrapCI(partialRows, (sample) =>
    partialSpearman(
      sample.map((s) => s.x),
      sample.map((s) => s.y),
      sample.map((s) => s.sen),
      sample.map((s) => s.uso)
    ).rho
  );

  const sensitivity: QP4SensitivityRow[] = [
    {
      key: 'main',
      label: 'Modelo Principal (Confirmatória)',
      description: 'Spearman M_REV × C_QUAL completo',
      isExploratory: false,
      n: main.n,
      rho: main.rho,
      pValue: main.pValue,
      ci95: main.ci95,
      magnitudeLabelPt: main.magnitudeLabelPt,
    },
    {
      key: 'no_item16',
      label: 'Sem ITEM_16 (reverso)',
      description: 'Sensibilidade removendo o item invertido C_QUAL5',
      isExploratory: true,
      n: no16Pairs.length,
      rho: no16Res.rho,
      pValue: no16Res.pValue,
      ci95: no16CI,
      magnitudeLabelPt: classifyCohenRho(no16Res.rho).labelPt,
    },
    {
      key: 'no_item17',
      label: 'Sem ITEM_17 (global)',
      description: 'Sensibilidade removendo o item global C_QUAL6',
      isExploratory: true,
      n: no17Pairs.length,
      rho: no17Res.rho,
      pValue: no17Res.pValue,
      ci95: no17CI,
      magnitudeLabelPt: classifyCohenRho(no17Res.rho).labelPt,
    },
    {
      key: 'partial_sen_uso',
      label: 'Parcial (controlando M_SEN e M_USO)',
      description: 'Correlação parcial de Spearman via OLS sobre ranks',
      isExploratory: true,
      n: partialRows.length,
      rho: partialRes.rho,
      pValue: partialRes.pValue,
      ci95: partialCI,
      magnitudeLabelPt: classifyCohenRho(partialRes.rho).labelPt,
    },
  ];

  // Item-by-item matrix (ITEM_19..20 x ITEM_12..17 = 12 tests, Bonferroni)
  const itemMatrix: QP4ItemCorrelation[] = [];
  const totalPairs = REVIEW_ITEM_IDS.length * QUALITY_ITEM_IDS.length;
  for (const revId of REVIEW_ITEM_IDS) {
    for (const qualId of QUALITY_ITEM_IDS as QualityItemId[]) {
      const pairs = respondents
        .map((r) => {
          const rx = r.reviewNumeric[revId];
          const qRaw = r.likertNumeric[qualId];
          const qy =
            qRaw === null
              ? null
              : qualId === 'ITEM_16' && invertItem16
                ? 6 - qRaw
                : qRaw;
          return { rx, qy };
        })
        .filter(
          (p): p is { rx: number; qy: number } =>
            p.rx !== null && p.qy !== null
        );
      const res = computeSpearman(
        pairs.map((p) => p.rx),
        pairs.map((p) => p.qy)
      );
      const pBonf =
        res.pValue !== null ? Math.min(1, res.pValue * totalPairs) : null;
      itemMatrix.push({
        reviewItem: revId,
        qualityItem: qualId,
        n: pairs.length,
        rho: res.rho,
        pValue: res.pValue,
        pBonferroni: pBonf,
        significantBonferroni: pBonf !== null && pBonf < alpha,
      });
    }
  }

  const scatterPoints: QP4ScatterPoint[] = mainPairs.map(({ x, y, r }) => ({
    idLabel: r.idLabel,
    rowNumber: r.rowNumber,
    seniority: r.seniority ?? 'Júnior',
    mRev: x,
    cQual: y,
    tool: (normalizeTools ? r.toolNormalized : r.toolRaw) || 'Não informado',
    frequency: r.frequencyRaw || 'Não informado',
  }));

  return {
    main,
    sensitivity,
    itemMatrix,
    scatterPoints,
    note: 'Correlação não implica causalidade. Todas as análises de sensibilidade e a matriz item a item são exploratórias.',
  };
}

// ---------- Exploratory Analyses ----------

export function wilcoxonSignedRank(
  respondents: ValidRespondent[],
  invertItem16 = true
): PairedComparisonResult {
  const pairs = respondents
    .map((r) => {
      const cVel = r.scores.C_VEL;
      const cQual = invertItem16 ? r.scores.C_QUAL : r.scores.C_QUAL_raw16;
      if (cVel === null || cQual === null) return null;
      return {
        idLabel: r.idLabel,
        rowNumber: r.rowNumber,
        seniority: r.seniority ?? 'Júnior',
        cVel,
        cQual,
        diff: cVel - cQual,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  const cVelMedian = median(pairs.map((p) => p.cVel));
  const cQualMedian = median(pairs.map((p) => p.cQual));
  const velGreaterCount = pairs.filter((p) => p.diff > 0).length;
  const qualGreaterCount = pairs.filter((p) => p.diff < 0).length;
  const tieCount = pairs.filter((p) => p.diff === 0).length;

  const nonZero = pairs.filter((p) => p.diff !== 0);
  const nr = nonZero.length;
  if (nr === 0) {
    return {
      n: pairs.length,
      cVelMedian,
      cQualMedian,
      velGreaterCount,
      qualGreaterCount,
      tieCount,
      wilcoxonW: null,
      z: null,
      pValue: null,
      effectR: null,
      pairs,
    };
  }

  const absDiffs = nonZero.map((p) => Math.abs(p.diff));
  const { ranks, tieCounts } = averageRanks(absDiffs);
  let wPlus = 0;
  let wMinus = 0;
  for (let i = 0; i < nr; i++) {
    if (nonZero[i].diff > 0) wPlus += ranks[i];
    else wMinus += ranks[i];
  }
  const w = Math.min(wPlus, wMinus);

  const meanW = (nr * (nr + 1)) / 4;
  const tieCorrection = tieCounts.reduce(
    (acc, t) => acc + (t * t * t - t),
    0
  );
  const varW =
    (nr * (nr + 1) * (2 * nr + 1)) / 24 - tieCorrection / 48;
  const sdW = Math.sqrt(Math.max(0, varW));

  let z: number | null = null;
  let pValue: number | null = null;
  let effectR: number | null = null;
  if (sdW > 0) {
    const zRaw = (w - meanW) / sdW;
    const zAbs = Math.max(0, Math.abs(w - meanW) - 0.5) / sdW;
    z = zRaw;
    pValue = 2 * (1 - normalCDF(zAbs));
    effectR = Math.abs(zRaw) / Math.sqrt(nr);
  }

  return {
    n: pairs.length,
    cVelMedian,
    cQualMedian,
    velGreaterCount,
    qualGreaterCount,
    tieCount,
    wilcoxonW: w,
    z,
    pValue,
    effectR,
    pairs,
  };
}

function logFactorial(n: number, cache: number[]): number {
  while (cache.length <= n) {
    const prev = cache[cache.length - 1];
    cache.push(prev + Math.log(cache.length));
  }
  return cache[n];
}

export function analyzeContingencyToolBySeniority(
  respondents: ValidRespondent[],
  normalizeTools = true
): ContingencyAnalysis {
  const cols = SENIORITY_ORDER;
  const toolCounts = new Map<string, number>();
  const validPairs: Array<{ tool: string; sen: SeniorityLevel }> = [];

  for (const r of respondents) {
    if (!r.seniority) continue;
    const tool =
      (normalizeTools ? r.toolNormalized : r.toolRaw) || 'Não informado';
    toolCounts.set(tool, (toolCounts.get(tool) ?? 0) + 1);
    validPairs.push({ tool, sen: r.seniority });
  }

  const rows = Array.from(toolCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tool]) => tool);

  const R = rows.length;
  const C = cols.length;
  const counts = Array.from({ length: R }, () => new Array<number>(C).fill(0));
  for (const pair of validPairs) {
    const rIdx = rows.indexOf(pair.tool);
    const cIdx = cols.indexOf(pair.sen);
    if (rIdx >= 0 && cIdx >= 0) counts[rIdx][cIdx] += 1;
  }

  const rowTotals = counts.map((row) => row.reduce((a, b) => a + b, 0));
  const colTotals = cols.map((_, c) =>
    counts.reduce((acc, row) => acc + row[c], 0)
  );
  const total = rowTotals.reduce((a, b) => a + b, 0);

  const expected = counts.map((_, r) =>
    cols.map((__, c) => (total > 0 ? (rowTotals[r] * colTotals[c]) / total : 0))
  );

  let minExpected = Infinity;
  let cellsBelow5 = 0;
  let chi2Statistic = 0;
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      const e = expected[r][c];
      if (e < minExpected) minExpected = e;
      if (e < 5) cellsBelow5 += 1;
      if (e > 0) {
        const diff = counts[r][c] - e;
        chi2Statistic += (diff * diff) / e;
      }
    }
  }
  if (!Number.isFinite(minExpected)) minExpected = 0;

  const df = R > 1 && C > 1 ? (R - 1) * (C - 1) : null;
  const minDim = Math.min(R - 1, C - 1);
  const cramersV =
    total > 0 && minDim > 0 ? Math.sqrt(chi2Statistic / (total * minDim)) : null;

  const useChi2 = R >= 2 && C >= 2 && minExpected >= 5;
  let pValue: number | null = null;
  let methodUsed: ContingencyAnalysis['methodUsed'] = 'chi2';

  if (useChi2 && df !== null) {
    methodUsed = 'chi2';
    pValue = chi2PValue(chi2Statistic, df);
  } else if (R >= 2 && C >= 2 && total > 0) {
    methodUsed = 'fisher_monte_carlo';
    // Exact Fisher-Freeman-Halton Monte Carlo permutation preserving row and column marginals
    const factCache = [0];
    const sumLogRowCol =
      rowTotals.reduce((a, r) => a + logFactorial(r, factCache), 0) +
      colTotals.reduce((a, c) => a + logFactorial(c, factCache), 0) -
      logFactorial(total, factCache);

    const logProb = (mat: number[][]): number => {
      let denom = 0;
      for (let r = 0; r < R; r++) {
        for (let c = 0; c < C; c++) {
          denom += logFactorial(mat[r][c], factCache);
        }
      }
      return sumLogRowCol - denom;
    };

    const observedLogP = logProb(counts);
    const pool: number[] = [];
    for (let c = 0; c < C; c++) {
      for (let k = 0; k < colTotals[c]; k++) pool.push(c);
    }

    const rng = mulberry32(BOOTSTRAP_SEED);
    let extremeCount = 0;
    const simCounts = Array.from({ length: R }, () => new Array<number>(C).fill(0));

    for (let b = 0; b < FISHER_MONTE_CARLO_B; b++) {
      // Fisher-Yates shuffle
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const tmp = pool[i];
        pool[i] = pool[j];
        pool[j] = tmp;
      }

      for (let r = 0; r < R; r++) simCounts[r].fill(0);
      let idx = 0;
      for (let r = 0; r < R; r++) {
        for (let k = 0; k < rowTotals[r]; k++) {
          simCounts[r][pool[idx++]] += 1;
        }
      }

      if (logProb(simCounts) <= observedLogP + 1e-12) {
        extremeCount += 1;
      }
    }

    pValue = extremeCount / FISHER_MONTE_CARLO_B;
  }

  return {
    rows,
    cols,
    counts,
    expected,
    rowTotals,
    colTotals,
    total,
    minExpected,
    cellsBelow5,
    methodUsed,
    chi2Statistic: R >= 2 && C >= 2 ? chi2Statistic : null,
    df,
    pValue,
    cramersV,
    fisherMonteCarloB: FISHER_MONTE_CARLO_B,
    note:
      methodUsed === 'chi2'
        ? 'Todas as frequências esperadas ≥ 5: qui-quadrado de Pearson aplicado.'
        : `${cellsBelow5} célula(s) com contagem esperada < 5 (mín. = ${minExpected.toFixed(2)}): Teste Exato de Fisher via Monte Carlo determinístico (B = ${FISHER_MONTE_CARLO_B}).`,
  };
}

function buildEarlyVsLateSplit(
  splitMode: EarlyVsLateSplit['splitMode'],
  splitLabel: string,
  earlyGroupLabel: string,
  lateGroupLabel: string,
  earlyRows: ValidRespondent[],
  lateRows: ValidRespondent[],
  invertItem16: boolean
): EarlyVsLateSplit {
  const getScores = (rows: ValidRespondent[]) => ({
    vel: rows
      .map((r) => r.scores.C_VEL)
      .filter((v): v is number => v !== null),
    qual: rows
      .map((r) => (invertItem16 ? r.scores.C_QUAL : r.scores.C_QUAL_raw16))
      .filter((v): v is number => v !== null),
    rev: rows
      .map((r) => r.scores.M_REV)
      .filter((v): v is number => v !== null),
  });

  const e = getScores(earlyRows);
  const l = getScores(lateRows);

  return {
    splitMode,
    splitLabel,
    early: {
      label: earlyGroupLabel,
      n: earlyRows.length,
      cVelMedian: median(e.vel),
      cQualMedian: median(e.qual),
      mRevMedian: median(e.rev),
    },
    late: {
      label: lateGroupLabel,
      n: lateRows.length,
      cVelMedian: median(l.vel),
      cQualMedian: median(l.qual),
      mRevMedian: median(l.rev),
    },
    cVelTest: mannWhitneyU(
      'C_VEL',
      'Velocidade (C_VEL)',
      earlyGroupLabel,
      e.vel,
      lateGroupLabel,
      l.vel,
      0.05
    ),
    cQualTest: mannWhitneyU(
      'C_QUAL',
      'Qualidade (C_QUAL)',
      earlyGroupLabel,
      e.qual,
      lateGroupLabel,
      l.qual,
      0.05
    ),
    mRevTest: mannWhitneyU(
      'M_REV',
      'Revisão (M_REV)',
      earlyGroupLabel,
      e.rev,
      lateGroupLabel,
      l.rev,
      0.05
    ),
  };
}

export function analyzeExploratory(
  respondents: ValidRespondent[],
  invertItem16 = true,
  normalizeTools = true
): ExploratoryReport {
  const pairedVelVsQual = wilcoxonSignedRank(respondents, invertItem16);
  const toolBySeniority = analyzeContingencyToolBySeniority(
    respondents,
    normalizeTools
  );

  // Split 1: Cutoff 24/11 12:00 (extension deadline)
  const earlyDeadline = respondents.filter((r) => !r.isPostExtension);
  const lateDeadline = respondents.filter((r) => r.isPostExtension);
  const earlyVsLateByDeadline = buildEarlyVsLateSplit(
    'deadline_24_11_12h',
    'Corte do prazo prorrogado (24/11/2026 12:00)',
    'Até 24/11 12h (no prazo)',
    'Após 24/11 12h (pós-prazo)',
    earlyDeadline,
    lateDeadline,
    invertItem16
  );

  // Split 2: Median timestamp
  const sortedByTime = [...respondents].sort(
    (a, b) => (a.timestamp?.getTime() ?? 0) - (b.timestamp?.getTime() ?? 0)
  );
  const half = Math.ceil(sortedByTime.length / 2);
  const earlyMedian = sortedByTime.slice(0, half);
  const lateMedian = sortedByTime.slice(half);
  const earlyVsLateByMedian = buildEarlyVsLateSplit(
    'median_timestamp',
    'Divisão pela mediana temporal (primeira vs segunda metade)',
    '1ª metade (Iniciais)',
    '2ª metade (Tardias)',
    earlyMedian,
    lateMedian,
    invertItem16
  );

  return {
    pairedVelVsQual,
    toolBySeniority,
    earlyVsLateByDeadline,
    earlyVsLateByMedian,
  };
}

// ---------- Profile & Timeline ----------

export function buildDescriptives(
  respondents: ValidRespondent[],
  allAudits: Array<{
    timestamp: Date | null;
    status: 'valid' | 'discarded';
    collectionPhase?: CollectionPhase;
  }>,
  filter: FilterState
): {
  cVelStats: ConstructDescriptiveStats;
  cQualStats: ConstructDescriptiveStats;
  mRevStats: ConstructDescriptiveStats;
  likertItems: LikertItemStats[];
  reviewItems: LikertItemStats[];
  seniorityProfile: ProfileBreakdownItem[];
  toolProfile: ProfileBreakdownItem[];
  frequencyProfile: ProfileBreakdownItem[];
  timeline: TimelinePoint[];
} {
  const cVelStats = buildConstructStats(
    'C_VEL',
    'Velocidade Percebida (C_VEL)',
    respondents.map((r) => r.scores.C_VEL)
  );
  const cQualStats = buildConstructStats(
    'C_QUAL',
    filter.invertItem16
      ? 'Qualidade Percebida (C_QUAL)'
      : 'Qualidade Percebida (C_QUAL · ITEM_16 bruto)',
    respondents.map((r) =>
      filter.invertItem16 ? r.scores.C_QUAL : r.scores.C_QUAL_raw16
    )
  );
  const mRevStats = buildConstructStats(
    'M_REV',
    'Rigor de Revisão (M_REV)',
    respondents.map((r) => r.scores.M_REV)
  );

  const likertItems: LikertItemStats[] = LIKERT_ITEM_IDS.map((id) => {
    const effectiveInverted = id === 'ITEM_16' && filter.invertItem16;
    const vals = respondents.map((r) => {
      const raw = r.likertNumeric[id];
      if (raw === null) return null;
      return effectiveInverted ? 6 - raw : raw;
    });
    return buildItemStats(id, vals, effectiveInverted);
  });

  const reviewItems: LikertItemStats[] = REVIEW_ITEM_IDS.map((id) =>
    buildItemStats(
      id,
      respondents.map((r) => r.reviewNumeric[id]),
      false
    )
  );

  const n = respondents.length;
  const seniorityProfile: ProfileBreakdownItem[] = SENIORITY_ORDER.map((sen) => {
    const count = respondents.filter((r) => r.seniority === sen).length;
    return { label: sen, count, pct: n > 0 ? (count / n) * 100 : 0 };
  });

  const toolMap = new Map<string, number>();
  for (const r of respondents) {
    const t =
      (filter.normalizeTools ? r.toolNormalized : r.toolRaw) || 'Não informado';
    toolMap.set(t, (toolMap.get(t) ?? 0) + 1);
  }
  const toolProfile: ProfileBreakdownItem[] = Array.from(toolMap.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label, count]) => ({
      label,
      count,
      pct: n > 0 ? (count / n) * 100 : 0,
    }));

  const frequencyProfile: ProfileBreakdownItem[] = FREQUENCY_ORDER.map(
    (freq) => {
      const count = respondents.filter((r) => r.frequencyRaw === freq).length;
      return { label: freq, count, pct: n > 0 ? (count / n) * 100 : 0 };
    }
  );

  // Timeline by date (YYYY-MM-DD)
  const dayMap = new Map<
    string,
    { rawCount: number; validCount: number; discardedCount: number }
  >();
  for (const item of allAudits) {
    if (!item.timestamp) continue;
    const pad = (x: number) => String(x).padStart(2, '0');
    const dateKey = `${item.timestamp.getFullYear()}-${pad(item.timestamp.getMonth() + 1)}-${pad(item.timestamp.getDate())}`;
    const entry = dayMap.get(dateKey) ?? {
      rawCount: 0,
      validCount: 0,
      discardedCount: 0,
    };
    entry.rawCount += 1;
    if (item.status === 'valid') entry.validCount += 1;
    else entry.discardedCount += 1;
    dayMap.set(dateKey, entry);
  }

  let cumulativeValid = 0;
  const timeline: TimelinePoint[] = Array.from(dayMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, counts]) => {
      cumulativeValid += counts.validCount;
      const [, m, d] = date.split('-');
      const phase: CollectionPhase =
        date > '2026-11-24'
          ? 'post_extension'
          : date > '2026-11-22'
            ? 'extended'
            : 'planned';
      return {
        date,
        label: `${d}/${m}`,
        rawCount: counts.rawCount,
        validCount: counts.validCount,
        discardedCount: counts.discardedCount,
        cumulativeValid,
        phase,
      };
    });

  return {
    cVelStats,
    cQualStats,
    mRevStats,
    likertItems,
    reviewItems,
    seniorityProfile,
    toolProfile,
    frequencyProfile,
    timeline,
  };
}

export function applyFilterToRespondents(
  respondents: ValidRespondent[],
  filter: FilterState
): ValidRespondent[] {
  return respondents
    .filter((r) => {
      if (
        filter.seniorities.length > 0 &&
        (!r.seniority || !filter.seniorities.includes(r.seniority))
      ) {
        return false;
      }
      if (filter.tools.length > 0) {
        const tool = filter.normalizeTools ? r.toolNormalized : r.toolRaw;
        if (!filter.tools.includes(tool)) return false;
      }
      if (
        filter.frequencies.length > 0 &&
        !filter.frequencies.includes(r.frequencyRaw)
      ) {
        return false;
      }
      return true;
    })
    .map((r) => {
      if (filter.invertItem16) return r;
      const recomputed = computeConstructScores(r, false);
      return {
        ...r,
        likertEffective: recomputed.likertEffective,
      };
    });
}
