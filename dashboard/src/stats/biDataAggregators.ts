import { COLORS, SENIORITY_COLORS } from '../utils/format';
import {
  ORDINAL_TIER_SHORT_LABELS,
  classifyOrdinalTier,
  toggleArrayItem,
  toggleArrayPair,
  type BiFilterState,
  type ClassifiedTierId,
  type OrdinalTierId,
} from './biCrossFilter';
import { ITEM_METADATA, LIKERT_ITEM_IDS } from './parser';
import { median, quantileSorted } from './statistics';
import type {
  CodedResponse,
  LikertItemId,
  OpenCodingSummary,
  QP4ScatterPoint,
  SeniorityLevel,
  ValidRespondent,
} from './types';

export const ORDINAL_TIER_COLORS: Record<ClassifiedTierId, string> = {
  low: COLORS.danger,
  moderate: COLORS.warning,
  high: COLORS.success,
  unclassified: '#94A3B8',
};

const TOOL_NODE_PALETTE = [
  '#2E5A88',
  '#475569',
  '#0F766E',
  '#4F46E5',
  '#0369A1',
];

export const FREQUENCY_SHORT_LABELS: Record<string, string> = {
  'Todos os dias úteis': 'Todos dias úteis',
  '4 a 5 dias por semana': '4–5 dias/sem',
  '1 a 3 dias por semana': '1–3 dias/sem',
  'Menos de 1 dia por semana': '< 1 dia/sem',
};

// ---------- 1. Raincloud KDE ----------

export interface KdeCurvePoint {
  score: number;
  density: number;
}

/**
 * Calcula KDE gaussiana com regra de Silverman limitada a [1,0; 5,0] e guarda para variância zero.
 */
export function computeClampedKde(
  values: number[],
  gridSteps = 40
): { bandwidth: number; points: KdeCurvePoint[]; maxDensity: number } {
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length < 3 || gridSteps < 2) {
    return { bandwidth: 0, points: [], maxDensity: 0 };
  }

  const n = clean.length;
  const meanVal = clean.reduce((acc, v) => acc + v, 0) / n;
  let sq = 0;
  for (const v of clean) sq += (v - meanVal) * (v - meanVal);
  const sd = Math.sqrt(sq / (n - 1));
  if (!Number.isFinite(sd) || sd <= 1e-9) {
    return { bandwidth: 0, points: [], maxDensity: 0 };
  }

  const sorted = [...clean].sort((a, b) => a - b);
  const q1 = quantileSorted(sorted, 0.25) ?? sorted[0];
  const q3 = quantileSorted(sorted, 0.75) ?? sorted[sorted.length - 1];
  const iqr = q3 - q1;

  const sigmaEff = iqr > 1e-9 ? Math.min(sd, iqr / 1.34) : sd;
  const bandwidth = Math.max(0.18, 0.9 * sigmaEff * Math.pow(n, -0.2));
  const invSqrt2Pi = 1 / Math.sqrt(2 * Math.PI);

  const points: KdeCurvePoint[] = [];
  let maxDensity = 0;
  for (let i = 0; i < gridSteps; i++) {
    const score = 1.0 + (4.0 * i) / (gridSteps - 1);
    let sumK = 0;
    for (const v of clean) {
      const u = (score - v) / bandwidth;
      sumK += invSqrt2Pi * Math.exp(-0.5 * u * u);
    }
    const density = sumK / (n * bandwidth);
    if (density > maxDensity) maxDensity = density;
    points.push({ score, density });
  }

  return { bandwidth, points, maxDensity };
}

// ---------- 2. QP4 Tie Aggregation ----------

export interface Qp4TieCell {
  key: string;
  mRev: number;
  cQual: number;
  count: number;
  mRevTier: OrdinalTierId;
  cQualTier: OrdinalTierId;
  dominantSeniority: SeniorityLevel;
  seniorityCounts: Record<SeniorityLevel, number>;
  respondentIds: string[];
  respondents: QP4ScatterPoint[];
}

export interface Qp4TieAggregation {
  cells: Qp4TieCell[];
  mRevTierCounts: Record<OrdinalTierId, number>;
  cQualTierCounts: Record<OrdinalTierId, number>;
  olsLine: [[number, number], [number, number]] | null;
}

/**
 * Agrega pontos exatos de QP4 em bolhas de empate e calcula contagens marginais e reta OLS.
 */
export function aggregateQp4Ties(scatterPoints: QP4ScatterPoint[]): Qp4TieAggregation {
  const mRevTierCounts: Record<OrdinalTierId, number> = {
    low: 0,
    moderate: 0,
    high: 0,
  };
  const cQualTierCounts: Record<OrdinalTierId, number> = {
    low: 0,
    moderate: 0,
    high: 0,
  };

  const validPoints: Array<{
    pt: QP4ScatterPoint;
    mRevTier: OrdinalTierId;
    cQualTier: OrdinalTierId;
  }> = [];

  for (const pt of scatterPoints) {
    if (!Number.isFinite(pt.mRev) || !Number.isFinite(pt.cQual)) continue;
    const mRevTier = classifyOrdinalTier(pt.mRev);
    const cQualTier = classifyOrdinalTier(pt.cQual);
    if (mRevTier === 'unclassified' || cQualTier === 'unclassified') continue;

    mRevTierCounts[mRevTier] += 1;
    cQualTierCounts[cQualTier] += 1;
    validPoints.push({ pt, mRevTier, cQualTier });
  }

  const cellMap = new Map<
    string,
    {
      mRevTier: OrdinalTierId;
      cQualTier: OrdinalTierId;
      points: QP4ScatterPoint[];
    }
  >();

  for (const { pt, mRevTier, cQualTier } of validPoints) {
    const key = `${pt.mRev.toFixed(4)}_${pt.cQual.toFixed(4)}`;
    const bucket = cellMap.get(key);
    if (bucket) {
      bucket.points.push(pt);
    } else {
      cellMap.set(key, { mRevTier, cQualTier, points: [pt] });
    }
  }

  const cells: Qp4TieCell[] = Array.from(cellMap.entries()).map(([key, bucket]) => {
    const list = bucket.points;
    const first = list[0];
    const seniorityCounts: Record<SeniorityLevel, number> = {
      Júnior: 0,
      Pleno: 0,
      Sênior: 0,
    };
    for (const r of list) {
      seniorityCounts[r.seniority] += 1;
    }

    // Tie-break: Sênior > Pleno > Júnior
    let dominantSeniority: SeniorityLevel = 'Júnior';
    if (
      seniorityCounts.Sênior >= seniorityCounts.Pleno &&
      seniorityCounts.Sênior >= seniorityCounts.Júnior &&
      seniorityCounts.Sênior > 0
    ) {
      dominantSeniority = 'Sênior';
    } else if (
      seniorityCounts.Pleno >= seniorityCounts.Júnior &&
      seniorityCounts.Pleno > 0
    ) {
      dominantSeniority = 'Pleno';
    }

    return {
      key,
      mRev: first.mRev,
      cQual: first.cQual,
      count: list.length,
      mRevTier: bucket.mRevTier,
      cQualTier: bucket.cQualTier,
      dominantSeniority,
      seniorityCounts,
      respondentIds: list.map((r) => r.idLabel),
      respondents: list,
    };
  });

  cells.sort((a, b) => b.count - a.count || a.mRev - b.mRev || a.cQual - b.cQual);

  let olsLine: [[number, number], [number, number]] | null = null;
  const n = validPoints.length;
  if (n >= 2) {
    const meanX = validPoints.reduce((s, v) => s + v.pt.mRev, 0) / n;
    const meanY = validPoints.reduce((s, v) => s + v.pt.cQual, 0) / n;
    const num = validPoints.reduce(
      (s, v) => s + (v.pt.mRev - meanX) * (v.pt.cQual - meanY),
      0
    );
    const den = validPoints.reduce((s, v) => s + (v.pt.mRev - meanX) ** 2, 0);
    if (den > 1e-12) {
      const slope = num / den;
      const intercept = meanY - slope * meanX;
      const xs = validPoints.map((v) => v.pt.mRev);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      olsLine = [
        [minX, intercept + slope * minX],
        [maxX, intercept + slope * maxX],
      ];
    }
  }

  return { cells, mRevTierCounts, cQualTierCounts, olsLine };
}

// ---------- 3. Dumbbell Summaries ----------

export interface ConstructDumbbellRow {
  label: string;
  seniority: SeniorityLevel | null;
  n: number;
  cVelMedian: number | null;
  cQualMedian: number | null;
  gap: number | null;
  velGreaterCount: number;
  velGreaterPct: number;
}

export interface ItemDumbbellRow {
  itemId: LikertItemId;
  shortLabel: string;
  construct: 'C_VEL' | 'C_QUAL';
  nValid: number;
  overallMedian: number | null;
  jrPlMedian: number | null;
  srMedian: number | null;
  agreementPct: number;
}

export interface DumbbellSummaryData {
  constructRows: ConstructDumbbellRow[];
  itemRows: ItemDumbbellRow[];
}

/**
 * Calcula resumos por construto (C_VEL vs C_QUAL) e por item Likert para os gráficos Dumbbell.
 */
export function computeDumbbellSummaries(
  respondents: ValidRespondent[],
  invertItem16 = true
): DumbbellSummaryData {
  const specs: Array<{ label: string; seniority: SeniorityLevel | null }> = [
    { label: 'Amostra Geral', seniority: null },
    { label: 'Sênior', seniority: 'Sênior' },
    { label: 'Pleno', seniority: 'Pleno' },
    { label: 'Júnior', seniority: 'Júnior' },
  ];

  const constructRows: ConstructDumbbellRow[] = specs.map(({ label, seniority }) => {
    const subset =
      seniority === null
        ? respondents
        : respondents.filter((r) => r.seniority === seniority);

    const velVals = subset
      .map((r) => r.scores.C_VEL)
      .filter((v): v is number => v !== null);
    const qualVals = subset
      .map((r) => (invertItem16 ? r.scores.C_QUAL : r.scores.C_QUAL_raw16))
      .filter((v): v is number => v !== null);

    const paired = subset
      .map((r) => {
        const vel = r.scores.C_VEL;
        const qual = invertItem16 ? r.scores.C_QUAL : r.scores.C_QUAL_raw16;
        return vel !== null && qual !== null ? { vel, qual } : null;
      })
      .filter((p): p is { vel: number; qual: number } => p !== null);

    const cVelMedian = median(velVals);
    const cQualMedian = median(qualVals);
    const velGreaterCount = paired.filter((p) => p.vel > p.qual).length;
    const velGreaterPct =
      paired.length > 0 ? (velGreaterCount / paired.length) * 100 : 0;

    return {
      label,
      seniority,
      n: subset.length,
      cVelMedian,
      cQualMedian,
      gap:
        cVelMedian !== null && cQualMedian !== null
          ? cVelMedian - cQualMedian
          : null,
      velGreaterCount,
      velGreaterPct,
    };
  });

  const getItemValue = (r: ValidRespondent, id: LikertItemId): number | null => {
    const raw = r.likertNumeric[id];
    if (raw === null) return null;
    return id === 'ITEM_16' && invertItem16 ? 6 - raw : raw;
  };

  const itemRows: ItemDumbbellRow[] = LIKERT_ITEM_IDS.map((itemId) => {
    const meta = ITEM_METADATA[itemId];
    const allVals: number[] = [];
    const jrPlVals: number[] = [];
    const srVals: number[] = [];

    for (const r of respondents) {
      const val = getItemValue(r, itemId);
      if (val === null) continue;
      allVals.push(val);
      if (r.seniority === 'Júnior' || r.seniority === 'Pleno') {
        jrPlVals.push(val);
      } else if (r.seniority === 'Sênior') {
        srVals.push(val);
      }
    }

    const agreementCount = allVals.filter((v) => v >= 4).length;

    return {
      itemId,
      shortLabel: meta.shortLabel,
      construct: meta.construct as 'C_VEL' | 'C_QUAL',
      nValid: allVals.length,
      overallMedian: median(allVals),
      jrPlMedian: median(jrPlVals),
      srMedian: median(srVals),
      agreementPct: allVals.length > 0 ? (agreementCount / allVals.length) * 100 : 0,
    };
  });

  return { constructRows, itemRows };
}

// ---------- 4. 4-Stage Sankey Data ----------

export type ClickTargetPayload =
  | { kind: 'seniority'; value: SeniorityLevel }
  | { kind: 'seniorityPair'; seniorities: [SeniorityLevel, SeniorityLevel] }
  | { kind: 'tool'; value: string }
  | { kind: 'frequency'; value: string }
  | { kind: 'mRevTier'; value: OrdinalTierId }
  | { kind: 'cQualTier'; value: OrdinalTierId }
  | {
      kind: 'bubble';
      mRevTier: OrdinalTierId;
      cQualTier: OrdinalTierId;
      cell?: Qp4TieCell;
    }
  | { kind: 'riskTheme'; themeId: string; label?: string }
  | { kind: 'benefitTheme'; themeId: string; label?: string }
  | { kind: 'noop'; value?: string };

export interface SankeyNodeDatum {
  name: string;
  displayLabel: string;
  stage: 'seniority' | 'tool' | 'mRevTier' | 'cQualTier';
  count: number;
  itemStyle: {
    color: string;
    borderColor?: string;
    borderWidth?: number;
    opacity?: number;
  };
  clickTarget: ClickTargetPayload;
}

export interface SankeyLinkDatum {
  source: string;
  target: string;
  value: number;
}

export interface SankeyGraphData {
  nodes: SankeyNodeDatum[];
  links: SankeyLinkDatum[];
  totalRespondents: number;
}

/**
 * Constrói o grafo acíclico de 4 estágios (Senioridade -> Ferramenta -> Rigor M_REV -> Qualidade C_QUAL).
 */
export function buildSankeyData(
  respondents: ValidRespondent[],
  normalizeTools = true
): SankeyGraphData {
  if (respondents.length === 0) {
    return { nodes: [], links: [], totalRespondents: 0 };
  }

  const getRawTool = (r: ValidRespondent): string =>
    (normalizeTools ? r.toolNormalized : r.toolRaw) || 'Não informado';

  const toolCounts = new Map<string, number>();
  for (const r of respondents) {
    const t = getRawTool(r);
    toolCounts.set(t, (toolCounts.get(t) ?? 0) + 1);
  }
  const sortedTools = Array.from(toolCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name);

  const keepTopFive = sortedTools.length > 6;
  const topTools = new Set(keepTopFive ? sortedTools.slice(0, 5) : sortedTools);

  const linkMap = new Map<string, number>();
  const nodeMeta = new Map<
    string,
    {
      displayLabel: string;
      stage: SankeyNodeDatum['stage'];
      count: number;
      color: string;
      clickTarget: ClickTargetPayload;
    }
  >();

  const toolColorIndex = new Map<string, string>();
  Array.from(topTools).forEach((t, idx) => {
    toolColorIndex.set(t, TOOL_NODE_PALETTE[idx % TOOL_NODE_PALETTE.length]);
  });

  const touchNode = (
    id: string,
    displayLabel: string,
    stage: SankeyNodeDatum['stage'],
    color: string,
    clickTarget: ClickTargetPayload
  ) => {
    const prev = nodeMeta.get(id);
    if (prev) {
      prev.count += 1;
    } else {
      nodeMeta.set(id, { displayLabel, stage, count: 1, color, clickTarget });
    }
  };

  const addLink = (source: string, target: string) => {
    const key = `${source}\u0000${target}`;
    linkMap.set(key, (linkMap.get(key) ?? 0) + 1);
  };

  for (const r of respondents) {
    const senLabel = r.seniority ?? 'Não informado';
    const senId = `sen:${senLabel}`;
    touchNode(
      senId,
      senLabel,
      'seniority',
      r.seniority ? SENIORITY_COLORS[r.seniority] : '#94A3B8',
      r.seniority
        ? { kind: 'seniority', value: r.seniority }
        : { kind: 'noop', value: senLabel }
    );

    const rawTool = getRawTool(r);
    const toolLabel = keepTopFive && !topTools.has(rawTool) ? 'Outras' : rawTool;
    const toolId = `tool:${toolLabel}`;
    touchNode(
      toolId,
      toolLabel,
      'tool',
      toolLabel === 'Outras' ? '#94A3B8' : toolColorIndex.get(toolLabel) ?? '#475569',
      toolLabel === 'Outras'
        ? { kind: 'noop', value: 'Outras' }
        : { kind: 'tool', value: toolLabel }
    );

    const revTier = classifyOrdinalTier(r.scores.M_REV);
    const revId = `rev:${revTier}`;
    touchNode(
      revId,
      `Rigor ${ORDINAL_TIER_SHORT_LABELS[revTier]}`,
      'mRevTier',
      ORDINAL_TIER_COLORS[revTier],
      revTier === 'unclassified'
        ? { kind: 'noop', value: 'unclassified' }
        : { kind: 'mRevTier', value: revTier }
    );

    const qualTier = classifyOrdinalTier(r.scores.C_QUAL);
    const qualId = `qual:${qualTier}`;
    touchNode(
      qualId,
      `Qual. ${ORDINAL_TIER_SHORT_LABELS[qualTier]}`,
      'cQualTier',
      ORDINAL_TIER_COLORS[qualTier],
      qualTier === 'unclassified'
        ? { kind: 'noop', value: 'unclassified' }
        : { kind: 'cQualTier', value: qualTier }
    );

    addLink(senId, toolId);
    addLink(toolId, revId);
    addLink(revId, qualId);
  }

  const links: SankeyLinkDatum[] = [];
  const referenced = new Set<string>();
  for (const [key, value] of linkMap.entries()) {
    if (value <= 0) continue;
    const [source, target] = key.split('\u0000');
    links.push({ source, target, value });
    referenced.add(source);
    referenced.add(target);
  }

  const nodes: SankeyNodeDatum[] = [];
  for (const [name, meta] of nodeMeta.entries()) {
    if (!referenced.has(name)) continue;
    nodes.push({
      name,
      displayLabel: meta.displayLabel,
      stage: meta.stage,
      count: meta.count,
      itemStyle: { color: meta.color },
      clickTarget: meta.clickTarget,
    });
  }

  return { nodes, links, totalRespondents: respondents.length };
}

// ---------- 5. Pure BI Interaction, Drawer Quote & URL Helpers ----------

export interface BiClickTargetResult {
  nextFilter: BiFilterState;
  openedTheme?: { type: 'risk' | 'benefit'; themeId: string };
}

/**
 * Extrai com segurança o payload de clique (`data.clickTarget`) de um evento ECharts.
 */
export function extractClickTarget(params: unknown): ClickTargetPayload | null {
  if (!params || typeof params !== 'object') return null;
  const data = (params as { data?: unknown }).data;
  if (!data || typeof data !== 'object') return null;
  const candidate = (data as { clickTarget?: unknown }).clickTarget;
  if (!candidate || typeof candidate !== 'object') return null;
  const kind = (candidate as { kind?: unknown }).kind;
  if (typeof kind !== 'string') return null;
  return candidate as ClickTargetPayload;
}

/**
 * Redutor puro para aplicar qualquer clique dos painéis BI sobre `BiFilterState`.
 */
export function applyBiClickTarget(
  biFilter: BiFilterState,
  target: ClickTargetPayload | null
): BiClickTargetResult {
  if (!target || target.kind === 'noop') {
    return { nextFilter: biFilter };
  }

  switch (target.kind) {
    case 'seniority':
      return {
        nextFilter: {
          ...biFilter,
          seniorities: toggleArrayItem(biFilter.seniorities, target.value),
        },
      };
    case 'seniorityPair':
      return {
        nextFilter: {
          ...biFilter,
          seniorities: toggleArrayPair(
            biFilter.seniorities,
            target.seniorities[0],
            target.seniorities[1]
          ),
        },
      };
    case 'tool':
      return {
        nextFilter: {
          ...biFilter,
          tools: toggleArrayItem(biFilter.tools, target.value),
        },
      };
    case 'frequency':
      return {
        nextFilter: {
          ...biFilter,
          frequencies: toggleArrayItem(biFilter.frequencies, target.value),
        },
      };
    case 'mRevTier':
      return {
        nextFilter: {
          ...biFilter,
          mRevTiers: toggleArrayItem(biFilter.mRevTiers, target.value),
        },
      };
    case 'cQualTier':
      return {
        nextFilter: {
          ...biFilter,
          cQualTiers: toggleArrayItem(biFilter.cQualTiers, target.value),
        },
      };
    case 'bubble': {
      const hasM = biFilter.mRevTiers.includes(target.mRevTier);
      const hasC = biFilter.cQualTiers.includes(target.cQualTier);
      if (hasM && hasC) {
        return {
          nextFilter: {
            ...biFilter,
            mRevTiers: biFilter.mRevTiers.filter((t) => t !== target.mRevTier),
            cQualTiers: biFilter.cQualTiers.filter((t) => t !== target.cQualTier),
          },
        };
      }
      return {
        nextFilter: {
          ...biFilter,
          mRevTiers: hasM
            ? biFilter.mRevTiers
            : [...biFilter.mRevTiers, target.mRevTier],
          cQualTiers: hasC
            ? biFilter.cQualTiers
            : [...biFilter.cQualTiers, target.cQualTier],
        },
      };
    }
    case 'riskTheme':
      return {
        nextFilter: {
          ...biFilter,
          riskThemes: toggleArrayItem(biFilter.riskThemes, target.themeId),
        },
        openedTheme: { type: 'risk', themeId: target.themeId },
      };
    case 'benefitTheme':
      return {
        nextFilter: {
          ...biFilter,
          benefitThemes: toggleArrayItem(biFilter.benefitThemes, target.themeId),
        },
        openedTheme: { type: 'benefit', themeId: target.themeId },
      };
  }
}

export interface DrawerQuoteEntry {
  type: 'risk' | 'benefit';
  response: CodedResponse;
}

/**
 * Filtra relatos substantivos (sem ruído ou branco) de risco e benefício para o Quote Drawer.
 */
export function filterDrawerQuotes(
  openCoding: OpenCodingSummary,
  riskThemes: readonly string[],
  benefitThemes: readonly string[]
): DrawerQuoteEntry[] {
  const hasRisk = riskThemes.length > 0;
  const hasBenefit = benefitThemes.length > 0;
  const includeRisk = hasRisk || !hasBenefit;
  const includeBenefit = hasBenefit || !hasRisk;

  const entries: DrawerQuoteEntry[] = [];
  if (includeRisk) {
    for (const r of openCoding.risks.responses) {
      if (r.isBlankOrNoise) continue;
      if (hasRisk && !r.themes.some((t) => riskThemes.includes(t))) continue;
      entries.push({ type: 'risk', response: r });
    }
  }
  if (includeBenefit) {
    for (const b of openCoding.benefits.responses) {
      if (b.isBlankOrNoise) continue;
      if (hasBenefit && !b.themes.some((t) => benefitThemes.includes(t))) continue;
      entries.push({ type: 'benefit', response: b });
    }
  }
  return entries;
}

/**
 * Analisa o parâmetro `?mode=` da URL retornando `'report'` apenas quando explícito.
 */
export function parseViewModeFromSearch(search: string): 'dashboard' | 'report' {
  const params = new URLSearchParams(search);
  return params.get('mode') === 'report' ? 'report' : 'dashboard';
}
