import type { EChartsOption } from 'echarts';
import {
  COLORS,
  SENIORITY_COLORS,
  escapeHtml,
  fmtNum,
  fmtPct,
} from '../utils/format';
import {
  ORDINAL_TIER_LABELS,
  ORDINAL_TIER_SHORT_LABELS,
  classifyOrdinalTier,
  type BiFilterState,
  type ClassifiedTierId,
  type OrdinalTierId,
} from './biCrossFilter';
import { ITEM_METADATA, LIKERT_ITEM_IDS } from './parser';
import { median, quantileSorted } from './statistics';
import type {
  GroupSummary,
  LikertItemId,
  QP4ScatterPoint,
  SeniorityLevel,
  ValidRespondent,
} from './types';

export const RAINCLOUD_GROUP_COLORS: Record<string, string> = {
  Júnior: '#B8721F',
  Pleno: '#5B9BD5',
  Sênior: '#1F4E8C',
  'Júnior + Pleno': '#8E5512',
  'Jr+Pl': '#8E5512',
  'Pleno + Sênior': '#2F7A5C',
  Sr: '#1F4E8C',
};

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

export function deterministicJitter(seed: number, amplitude: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  const frac = x - Math.floor(x);
  return (frac * 2 - 1) * amplitude;
}

// ---------- 1. Raincloud KDE & Option Builder ----------

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

function isRaincloudGroupSelected(
  groupName: string,
  selectedSeniorities?: SeniorityLevel[]
): boolean {
  if (!selectedSeniorities || selectedSeniorities.length === 0) return true;
  if (groupName === 'Júnior' || groupName === 'Pleno' || groupName === 'Sênior') {
    return selectedSeniorities.includes(groupName);
  }
  if (groupName === 'Júnior + Pleno' || groupName === 'Jr+Pl') {
    return (
      selectedSeniorities.includes('Júnior') || selectedSeniorities.includes('Pleno')
    );
  }
  if (groupName === 'Pleno + Sênior') {
    return (
      selectedSeniorities.includes('Pleno') || selectedSeniorities.includes('Sênior')
    );
  }
  if (groupName === 'Sr') {
    return selectedSeniorities.includes('Sênior');
  }
  return true;
}

export function buildRaincloudOption(params: {
  title?: string;
  groups: GroupSummary[];
  selectedSeniorities?: SeniorityLevel[];
  compact?: boolean;
}): EChartsOption {
  const { title, groups, selectedSeniorities, compact = false } = params;
  const categories = groups.map((g) => `${g.group} (n=${g.n})`);
  const hasSelection = Boolean(selectedSeniorities && selectedSeniorities.length > 0);

  const kdeData: Array<{
    value: [number];
    groupName: string;
    group: GroupSummary;
    kde: { bandwidth: number; points: KdeCurvePoint[]; maxDensity: number };
    color: string;
    dimmed: boolean;
  }> = [];

  const scatterData: Array<{
    value: [number, number];
    groupName: string;
    group: GroupSummary;
    itemStyle: {
      color: string;
      opacity: number;
      borderColor: string;
      borderWidth: number;
    };
  }> = [];

  const summaryData: Array<{
    value: [number, number, number, number, number];
    groupName: string;
    group: GroupSummary;
    color: string;
    dimmed: boolean;
  }> = [];

  groups.forEach((g, gIdx) => {
    const color = RAINCLOUD_GROUP_COLORS[g.group] ?? COLORS.primary;
    const isSelected = isRaincloudGroupSelected(g.group, selectedSeniorities);
    const dimmed = hasSelection && !isSelected;

    if (g.n === 0) return;

    const kde = computeClampedKde(g.values);
    if (kde.points.length > 0 && kde.maxDensity > 0) {
      kdeData.push({
        value: [gIdx],
        groupName: g.group,
        group: g,
        kde,
        color,
        dimmed,
      });
    }

    g.values.forEach((v, i) => {
      const jitter = deterministicJitter(gIdx * 100 + i + 1, 0.095);
      scatterData.push({
        value: [gIdx + 0.16 + jitter, v],
        groupName: g.group,
        group: g,
        itemStyle: {
          color,
          opacity: dimmed ? 0.25 : 0.82,
          borderColor: '#FFFFFF',
          borderWidth: 1,
        },
      });
    });

    if (g.median !== null) {
      summaryData.push({
        value: [
          gIdx,
          g.median,
          g.q1 ?? g.median,
          g.q3 ?? g.median,
          g.mad ?? 0,
        ],
        groupName: g.group,
        group: g,
        color,
        dimmed,
      });
    }
  });

  const topMargin = title ? (compact ? 28 : 36) : compact ? 10 : 14;

  return {
    ...(title
      ? {
          title: {
            text: title,
            left: 8,
            top: 0,
            textStyle: {
              fontFamily: 'IBM Plex Sans',
              fontSize: 13,
              fontWeight: 600,
              color: COLORS.textPrimary,
            },
          },
        }
      : {}),
    tooltip: {
      trigger: 'item',
      confine: true,
      formatter: (rawParams: unknown) => {
        const p = rawParams as {
          seriesName?: string;
          value?: number[];
          data?: { group?: GroupSummary };
        };
        const g = p.data?.group;
        if (!g) return '';
        if (p.seriesName === 'Respondentes' && Array.isArray(p.value)) {
          return `<div style="font-family:'IBM Plex Sans',sans-serif;font-size:12px;">
            <strong>${escapeHtml(g.group)}</strong> (n = ${g.n})<br/>
            Escore individual: <strong style="font-family:'IBM Plex Mono',monospace;">${fmtNum(p.value[1], 2)}</strong>
          </div>`;
        }
        return `<div style="font-family:'IBM Plex Sans',sans-serif;font-size:12px;">
          <strong>${escapeHtml(g.group)} (n = ${g.n})</strong><br/>
          Mediana: <strong style="font-family:'IBM Plex Mono',monospace;">${fmtNum(g.median, 2)}</strong> ·
          MAD: <span style="font-family:'IBM Plex Mono',monospace;">±${fmtNum(g.mad, 2)}</span><br/>
          IQR [Q1; Q3]: <span style="font-family:'IBM Plex Mono',monospace;">[${fmtNum(g.q1, 2)}; ${fmtNum(g.q3, 2)}]</span><br/>
          Amplitude: <span style="font-family:'IBM Plex Mono',monospace;">${fmtNum(g.min, 2)} – ${fmtNum(g.max, 2)}</span>
        </div>`;
      },
    },
    grid: {
      left: compact ? 30 : 38,
      right: compact ? 12 : 18,
      top: topMargin,
      bottom: compact ? 24 : 26,
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: categories,
      axisLabel: {
        fontFamily: 'IBM Plex Sans',
        fontSize: compact ? 10 : 11,
        fontWeight: 600,
        color: COLORS.textPrimary,
        interval: 0,
      },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: COLORS.border } },
    },
    yAxis: {
      type: 'value',
      min: 1,
      max: 5.15,
      interval: 1,
      axisLabel: {
        fontFamily: 'IBM Plex Mono',
        fontSize: compact ? 10 : 11,
        color: COLORS.textMuted,
      },
      splitLine: { lineStyle: { color: '#EDF1EC' } },
    },
    series: [
      {
        name: 'Densidade KDE',
        type: 'custom',
        z: 2,
        renderItem: (params, api) => {
          const item = kdeData[params.dataIndex];
          if (!item || item.kde.points.length === 0 || item.kde.maxDensity <= 0) {
            return null;
          }
          const gIdx = Number(api.value(0));
          const centerPt = api.coord([gIdx, 1.0]);
          const bandSize = api.size ? api.size([1, 0]) : [80, 0];
          const rawBandWidth = Array.isArray(bandSize) ? bandSize[0] : bandSize;
          const bandWidth =
            typeof rawBandWidth === 'number' && rawBandWidth > 0 ? rawBandWidth : 80;

          const innerEdgeX = centerPt[0] - Math.min(5, bandWidth * 0.04);
          const maxHalfPx = Math.min(44, bandWidth * 0.36);

          const curvePts: number[][] = item.kde.points.map((pt) => {
            const yPx = api.coord([gIdx, pt.score])[1];
            const xPx = innerEdgeX - (pt.density / item.kde.maxDensity) * maxHalfPx;
            return [xPx, yPx];
          });

          const polyPts: number[][] = [
            [innerEdgeX, curvePts[0][1]],
            ...curvePts,
            [innerEdgeX, curvePts[curvePts.length - 1][1]],
          ];

          return {
            type: 'group',
            children: [
              {
                type: 'polygon',
                shape: { points: polyPts },
                style: {
                  fill: item.color,
                  opacity: item.dimmed ? 0.08 : 0.24,
                },
              },
              {
                type: 'polyline',
                shape: { points: curvePts },
                style: {
                  stroke: item.color,
                  fill: 'none',
                  lineWidth: 1.75,
                  opacity: item.dimmed ? 0.3 : 0.9,
                },
              },
            ],
          };
        },
        data: kdeData,
      },
      {
        name: 'Respondentes',
        type: 'scatter',
        z: 3,
        symbolSize: compact ? 6 : 7,
        data: scatterData,
      },
      {
        name: 'Mediana / IQR / MAD',
        type: 'custom',
        z: 4,
        renderItem: (params, api) => {
          const item = summaryData[params.dataIndex];
          if (!item) return null;
          const gIdx = Number(api.value(0));
          const med = Number(api.value(1));
          const q1 = Number(api.value(2));
          const q3 = Number(api.value(3));
          const madVal = Number(api.value(4));

          const lowW = Math.max(1.0, med - madVal);
          const highW = Math.min(5.0, med + madVal);

          const ptMed = api.coord([gIdx, med]);
          const ptQ1 = api.coord([gIdx, q1]);
          const ptQ3 = api.coord([gIdx, q3]);
          const ptLow = api.coord([gIdx, lowW]);
          const ptHigh = api.coord([gIdx, highW]);

          const cx = ptMed[0];
          const iqrTop = Math.min(ptQ1[1], ptQ3[1]);
          const iqrHeight = Math.max(2, Math.abs(ptQ1[1] - ptQ3[1]));
          const opacity = item.dimmed ? 0.32 : 1;

          return {
            type: 'group',
            children: [
              {
                type: 'line',
                shape: { x1: cx, y1: ptLow[1], x2: cx, y2: ptHigh[1] },
                style: { stroke: COLORS.textPrimary, lineWidth: 2, opacity },
              },
              {
                type: 'line',
                shape: { x1: cx - 4, y1: ptLow[1], x2: cx + 4, y2: ptLow[1] },
                style: { stroke: COLORS.textPrimary, lineWidth: 1.5, opacity },
              },
              {
                type: 'line',
                shape: { x1: cx - 4, y1: ptHigh[1], x2: cx + 4, y2: ptHigh[1] },
                style: { stroke: COLORS.textPrimary, lineWidth: 1.5, opacity },
              },
              {
                type: 'rect',
                shape: { x: cx - 4.5, y: iqrTop, width: 9, height: iqrHeight, r: 2 },
                style: {
                  fill: item.color,
                  opacity: item.dimmed ? 0.25 : 0.85,
                },
              },
              {
                type: 'circle',
                shape: { cx, cy: ptMed[1], r: compact ? 5 : 5.5 },
                style: {
                  fill: item.color,
                  stroke: '#FFFFFF',
                  lineWidth: 2,
                  opacity,
                },
              },
            ],
          };
        },
        data: summaryData,
      },
    ],
  };
}

// ---------- 2. QP4 Exact Coordinate Tie-Bubble Matrix + 3-Grid Marginals ----------

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

function toSafeOrdinalTier(score: number): OrdinalTierId {
  const tier = classifyOrdinalTier(score);
  if (tier !== 'unclassified') return tier;
  if (score < 2.5) return 'low';
  if (score < 3.75) return 'moderate';
  return 'high';
}

export function aggregateQp4Ties(scatterPoints: QP4ScatterPoint[]): {
  cells: Qp4TieCell[];
  mRevTierCounts: Record<OrdinalTierId, number>;
  cQualTierCounts: Record<OrdinalTierId, number>;
  olsLine: [[number, number], [number, number]] | null;
} {
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

  const cellMap = new Map<string, QP4ScatterPoint[]>();
  for (const pt of scatterPoints) {
    const mRevTier = classifyOrdinalTier(pt.mRev);
    const cQualTier = classifyOrdinalTier(pt.cQual);
    if (mRevTier !== 'unclassified') mRevTierCounts[mRevTier] += 1;
    if (cQualTier !== 'unclassified') cQualTierCounts[cQualTier] += 1;

    const key = `${pt.mRev.toFixed(4)}_${pt.cQual.toFixed(4)}`;
    const bucket = cellMap.get(key);
    if (bucket) {
      bucket.push(pt);
    } else {
      cellMap.set(key, [pt]);
    }
  }

  const cells: Qp4TieCell[] = Array.from(cellMap.entries()).map(([key, list]) => {
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
      mRevTier: toSafeOrdinalTier(first.mRev),
      cQualTier: toSafeOrdinalTier(first.cQual),
      dominantSeniority,
      seniorityCounts,
      respondentIds: list.map((r) => r.idLabel),
      respondents: list,
    };
  });

  cells.sort((a, b) => b.count - a.count || a.mRev - b.mRev || a.cQual - b.cQual);

  let olsLine: [[number, number], [number, number]] | null = null;
  const n = scatterPoints.length;
  if (n >= 2) {
    const meanX = scatterPoints.reduce((s, p) => s + p.mRev, 0) / n;
    const meanY = scatterPoints.reduce((s, p) => s + p.cQual, 0) / n;
    const num = scatterPoints.reduce(
      (s, p) => s + (p.mRev - meanX) * (p.cQual - meanY),
      0
    );
    const den = scatterPoints.reduce((s, p) => s + (p.mRev - meanX) ** 2, 0);
    if (den > 1e-12) {
      const slope = num / den;
      const intercept = meanY - slope * meanX;
      const xs = scatterPoints.map((p) => p.mRev);
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

const TIER_INTERVALS: Array<{
  tierId: OrdinalTierId;
  min: number;
  max: number;
  drawMin: number;
  drawMax: number;
}> = [
  { tierId: 'low', min: 1.0, max: 2.5, drawMin: 1.03, drawMax: 2.47 },
  { tierId: 'moderate', min: 2.5, max: 3.75, drawMin: 2.53, drawMax: 3.72 },
  { tierId: 'high', min: 3.75, max: 5.0, drawMin: 3.78, drawMax: 5.0 },
];

export function buildQp4JointMatrixOption(params: {
  scatterPoints: QP4ScatterPoint[];
  activeMRevTiers?: OrdinalTierId[];
  activeCQualTiers?: OrdinalTierId[];
  compact?: boolean;
}): EChartsOption {
  const {
    scatterPoints,
    activeMRevTiers = [],
    activeCQualTiers = [],
    compact = false,
  } = params;
  const { cells, mRevTierCounts, cQualTierCounts, olsLine } =
    aggregateQp4Ties(scatterPoints);

  const maxMRevTier = Math.max(
    1,
    mRevTierCounts.low,
    mRevTierCounts.moderate,
    mRevTierCounts.high
  );
  const maxCQualTier = Math.max(
    1,
    cQualTierCounts.low,
    cQualTierCounts.moderate,
    cQualTierCounts.high
  );

  const hasMRevFilter = activeMRevTiers.length > 0;
  const hasCQualFilter = activeCQualTiers.length > 0;

  const bubbleData = cells.map((cell) => {
    const matchesMRev = !hasMRevFilter || activeMRevTiers.includes(cell.mRevTier);
    const matchesCQual = !hasCQualFilter || activeCQualTiers.includes(cell.cQualTier);
    const active = matchesMRev && matchesCQual;
    return {
      value: [cell.mRev, cell.cQual],
      cell,
      clickTarget: {
        kind: 'bubble' as const,
        mRevTier: cell.mRevTier,
        cQualTier: cell.cQualTier,
        cell,
      },
      itemStyle: {
        color: SENIORITY_COLORS[cell.dominantSeniority],
        opacity: active ? 0.88 : 0.22,
        borderColor: active && (hasMRevFilter || hasCQualFilter) ? '#142027' : '#FFFFFF',
        borderWidth: active && (hasMRevFilter || hasCQualFilter) ? 2 : 1.5,
      },
      label: {
        show: cell.count >= 2,
        position: 'inside' as const,
        formatter: String(cell.count),
        fontFamily: 'IBM Plex Mono',
        fontSize: 10,
        fontWeight: 700,
        color: '#FFFFFF',
      },
    };
  });

  const mRevMarginalData = TIER_INTERVALS.map((t, idx) => ({
    value: [idx, mRevTierCounts[t.tierId]],
    tierId: t.tierId,
    count: mRevTierCounts[t.tierId],
    interval: t,
    selected: activeMRevTiers.includes(t.tierId),
    dimmed: hasMRevFilter && !activeMRevTiers.includes(t.tierId),
    clickTarget: { kind: 'mRevTier' as const, tierId: t.tierId },
  }));

  const cQualMarginalData = TIER_INTERVALS.map((t, idx) => ({
    value: [cQualTierCounts[t.tierId], idx],
    tierId: t.tierId,
    count: cQualTierCounts[t.tierId],
    interval: t,
    selected: activeCQualTiers.includes(t.tierId),
    dimmed: hasCQualFilter && !activeCQualTiers.includes(t.tierId),
    clickTarget: { kind: 'cQualTier' as const, tierId: t.tierId },
  }));

  return {
    legend: { show: false },
    tooltip: {
      trigger: 'item',
      confine: true,
      formatter: (rawParams: unknown) => {
        const p = rawParams as {
          data?: {
            clickTarget?:
              | { kind: 'bubble'; cell: Qp4TieCell }
              | { kind: 'mRevTier'; tierId: OrdinalTierId }
              | { kind: 'cQualTier'; tierId: OrdinalTierId };
            count?: number;
          };
        };
        const target = p.data?.clickTarget;
        if (!target) return '';

        if (target.kind === 'bubble') {
          const c = target.cell;
          const senParts: string[] = [];
          if (c.seniorityCounts.Sênior > 0) senParts.push(`Sênior: ${c.seniorityCounts.Sênior}`);
          if (c.seniorityCounts.Pleno > 0) senParts.push(`Pleno: ${c.seniorityCounts.Pleno}`);
          if (c.seniorityCounts.Júnior > 0) senParts.push(`Júnior: ${c.seniorityCounts.Júnior}`);
          return `<div style="font-family:'IBM Plex Sans',sans-serif;font-size:12px;max-width:270px;white-space:normal;">
            <strong>Ponto exato (n = ${c.count})</strong><br/>
            M_REV: <strong style="font-family:'IBM Plex Mono',monospace;">${fmtNum(c.mRev, 2)}</strong> (${ORDINAL_TIER_SHORT_LABELS[c.mRevTier]})<br/>
            C_QUAL: <strong style="font-family:'IBM Plex Mono',monospace;">${fmtNum(c.cQual, 2)}</strong> (${ORDINAL_TIER_SHORT_LABELS[c.cQualTier]})<br/>
            Senioridade: ${escapeHtml(senParts.join(' · '))}<br/>
            IDs: <span style="font-family:'IBM Plex Mono',monospace;font-size:11px;">${escapeHtml(c.respondentIds.join(', '))}</span>
          </div>`;
        }

        const axisLabel = target.kind === 'mRevTier' ? 'M_REV (Rigor)' : 'C_QUAL (Qualidade)';
        return `<div style="font-family:'IBM Plex Sans',sans-serif;font-size:12px;">
          <strong>${axisLabel} · ${ORDINAL_TIER_LABELS[target.tierId]}</strong><br/>
          Respondentes na faixa: <strong style="font-family:'IBM Plex Mono',monospace;">${p.data?.count ?? 0}</strong>
        </div>`;
      },
    },
    grid: [
      { left: 48, right: 68, top: 52, bottom: 38, containLabel: false },
      { left: 48, right: 68, top: 8, height: 34, containLabel: false },
      { top: 52, bottom: 38, right: 10, width: 48, containLabel: false },
    ],
    xAxis: [
      {
        gridIndex: 0,
        type: 'value',
        name: 'M_REV (Rigor de Revisão e Testes)',
        nameLocation: 'middle',
        nameGap: 23,
        nameTextStyle: {
          fontFamily: 'IBM Plex Sans',
          fontSize: compact ? 10 : 11,
          fontWeight: 600,
          color: COLORS.textSecondary,
        },
        min: 1.0,
        max: 5.2,
        interval: 1,
        axisLabel: {
          fontFamily: 'IBM Plex Mono',
          fontSize: 10,
          color: COLORS.textMuted,
          formatter: (val: number) => (val <= 5 ? String(val) : ''),
        },
        axisLine: { lineStyle: { color: COLORS.border } },
        splitLine: { lineStyle: { color: '#EDF1EC' } },
      },
      {
        gridIndex: 1,
        type: 'value',
        min: 1.0,
        max: 5.2,
        show: false,
      },
      {
        gridIndex: 2,
        type: 'value',
        min: 0,
        max: maxCQualTier,
        show: false,
      },
    ],
    yAxis: [
      {
        gridIndex: 0,
        type: 'value',
        name: 'C_QUAL',
        nameLocation: 'middle',
        nameGap: 30,
        nameRotate: 90,
        nameTextStyle: {
          fontFamily: 'IBM Plex Sans',
          fontSize: compact ? 10 : 11,
          fontWeight: 600,
          color: COLORS.textSecondary,
        },
        min: 1.0,
        max: 5.2,
        interval: 1,
        axisLabel: {
          fontFamily: 'IBM Plex Mono',
          fontSize: 10,
          color: COLORS.textMuted,
          formatter: (val: number) => (val <= 5 ? String(val) : ''),
        },
        axisLine: { lineStyle: { color: COLORS.border } },
        splitLine: { lineStyle: { color: '#EDF1EC' } },
      },
      {
        gridIndex: 1,
        type: 'value',
        min: 0,
        max: maxMRevTier,
        show: false,
      },
      {
        gridIndex: 2,
        type: 'value',
        min: 1.0,
        max: 5.2,
        show: false,
      },
    ],
    series: [
      {
        name: 'Matriz QP4',
        type: 'scatter',
        xAxisIndex: 0,
        yAxisIndex: 0,
        z: 4,
        symbolSize: (_val, cbParams) => {
          const data = cbParams.data as { cell?: Qp4TieCell } | undefined;
          return 10 + Math.sqrt(data?.cell?.count ?? 1) * 8;
        },
        data: bubbleData,
        markArea: {
          silent: true,
          itemStyle: { opacity: 1 },
          data: [
            [
              {
                xAxis: 1.0,
                yAxis: 1.0,
                itemStyle: { color: 'rgba(184, 59, 59, 0.045)' },
              },
              { xAxis: 2.5, yAxis: 2.5 },
            ],
            [
              {
                xAxis: 2.5,
                yAxis: 2.5,
                itemStyle: { color: 'rgba(184, 114, 31, 0.03)' },
              },
              { xAxis: 3.75, yAxis: 3.75 },
            ],
            [
              {
                xAxis: 3.75,
                yAxis: 3.75,
                itemStyle: { color: 'rgba(47, 122, 92, 0.045)' },
              },
              { xAxis: 5.0, yAxis: 5.0 },
            ],
          ],
        },
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: '#CBD5E1', type: 'dashed', width: 1 },
          label: { show: false },
          data: [
            { xAxis: 2.5 },
            { xAxis: 3.75 },
            { yAxis: 2.5 },
            { yAxis: 3.75 },
          ],
        },
      },
      ...(olsLine
        ? [
            {
              name: 'Tendência OLS',
              type: 'line' as const,
              xAxisIndex: 0,
              yAxisIndex: 0,
              z: 3,
              symbol: 'none',
              silent: true,
              clip: true,
              lineStyle: {
                color: COLORS.textPrimary,
                width: 1.75,
                type: 'dashed' as const,
                opacity: 0.75,
              },
              data: olsLine,
            },
          ]
        : []),
      {
        name: 'Marginal M_REV',
        type: 'custom',
        xAxisIndex: 1,
        yAxisIndex: 1,
        z: 3,
        renderItem: (cbParams, api) => {
          const item = mRevMarginalData[cbParams.dataIndex];
          if (!item) return null;
          const ptBL = api.coord([item.interval.drawMin, 0]);
          const ptTR = api.coord([item.interval.drawMax, item.count]);
          const ptMaxTop = api.coord([item.interval.drawMax, maxMRevTier]);

          const x = ptBL[0];
          const width = Math.max(4, ptTR[0] - ptBL[0]);
          const barHeight = item.count > 0 ? Math.max(4, ptBL[1] - ptTR[1]) : 2;
          const barY = ptBL[1] - barHeight;
          const tierColor = ORDINAL_TIER_COLORS[item.tierId];

          return {
            type: 'group',
            children: [
              {
                type: 'rect',
                shape: {
                  x,
                  y: ptMaxTop[1],
                  width,
                  height: Math.max(4, ptBL[1] - ptMaxTop[1]),
                },
                style: { fill: 'rgba(0,0,0,0.001)' },
              },
              {
                type: 'rect',
                shape: { x, y: barY, width, height: barHeight, r: [3, 3, 0, 0] },
                style: {
                  fill: tierColor,
                  opacity: item.dimmed ? 0.25 : 0.82,
                  stroke: item.selected ? '#142027' : 'none',
                  lineWidth: item.selected ? 1.5 : 0,
                },
              },
              {
                type: 'text',
                style: {
                  text: String(item.count),
                  x: x + width / 2,
                  y: Math.max(ptMaxTop[1] + 9, barY - 3),
                  textAlign: 'center',
                  textVerticalAlign: 'bottom',
                  fill: item.dimmed ? '#94A3B8' : COLORS.textPrimary,
                  font: "600 10px 'IBM Plex Mono', monospace",
                },
              },
            ],
          };
        },
        data: mRevMarginalData,
      },
      {
        name: 'Marginal C_QUAL',
        type: 'custom',
        xAxisIndex: 2,
        yAxisIndex: 2,
        z: 3,
        renderItem: (cbParams, api) => {
          const item = cQualMarginalData[cbParams.dataIndex];
          if (!item) return null;
          const ptBL = api.coord([0, item.interval.drawMin]);
          const ptTR = api.coord([item.count, item.interval.drawMax]);
          const ptMaxRight = api.coord([maxCQualTier, item.interval.drawMax]);

          const y = ptTR[1];
          const height = Math.max(4, ptBL[1] - ptTR[1]);
          const barWidth = item.count > 0 ? Math.max(4, ptTR[0] - ptBL[0]) : 2;
          const tierColor = ORDINAL_TIER_COLORS[item.tierId];

          return {
            type: 'group',
            children: [
              {
                type: 'rect',
                shape: {
                  x: ptBL[0],
                  y,
                  width: Math.max(4, ptMaxRight[0] - ptBL[0]),
                  height,
                },
                style: { fill: 'rgba(0,0,0,0.001)' },
              },
              {
                type: 'rect',
                shape: {
                  x: ptBL[0],
                  y,
                  width: barWidth,
                  height,
                  r: [0, 3, 3, 0],
                },
                style: {
                  fill: tierColor,
                  opacity: item.dimmed ? 0.25 : 0.82,
                  stroke: item.selected ? '#142027' : 'none',
                  lineWidth: item.selected ? 1.5 : 0,
                },
              },
              {
                type: 'text',
                style: {
                  text: String(item.count),
                  x: Math.min(ptMaxRight[0] - 2, ptBL[0] + barWidth + 4),
                  y: y + height / 2,
                  textAlign: barWidth > ptMaxRight[0] - ptBL[0] - 14 ? 'right' : 'left',
                  textVerticalAlign: 'middle',
                  fill:
                    barWidth > ptMaxRight[0] - ptBL[0] - 14
                      ? '#FFFFFF'
                      : item.dimmed
                        ? '#94A3B8'
                        : COLORS.textPrimary,
                  font: "600 10px 'IBM Plex Mono', monospace",
                },
              },
            ],
          };
        },
        data: cQualMarginalData,
      },
    ],
  };
}

// ---------- 3. Dumbbell Profile Builder ----------

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

export function computeDumbbellSummaries(
  respondents: ValidRespondent[],
  invertItem16 = true
): {
  constructRows: ConstructDumbbellRow[];
  itemRows: ItemDumbbellRow[];
} {
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

function drawDiamondPoints(cx: number, cy: number, r: number): number[][] {
  return [
    [cx, cy - r],
    [cx + r, cy],
    [cx, cy + r],
    [cx - r, cy],
  ];
}

export function buildConstructDumbbellOption(params: {
  constructRows: ConstructDumbbellRow[];
  selectedSeniorities?: SeniorityLevel[];
}): EChartsOption {
  const { constructRows, selectedSeniorities = [] } = params;
  const ordered = [...constructRows].reverse();
  const hasSelection = selectedSeniorities.length > 0;

  const seriesData = ordered.map((row, idx) => {
    const selected =
      row.seniority !== null && selectedSeniorities.includes(row.seniority);
    const dimmed = hasSelection && row.seniority !== null && !selected;
    return {
      value: [
        idx,
        row.cQualMedian ?? -1,
        row.cVelMedian ?? -1,
        row.gap ?? 0,
      ],
      seniority: row.seniority,
      row,
      dimmed,
      selected,
      clickTarget: row.seniority
        ? { kind: 'seniority' as const, seniority: row.seniority }
        : { kind: 'noop' as const },
    };
  });

  return {
    legend: { show: false },
    tooltip: {
      trigger: 'item',
      confine: true,
      formatter: (rawParams: unknown) => {
        const p = rawParams as { data?: { row?: ConstructDumbbellRow } };
        const row = p.data?.row;
        if (!row) return '';
        const sign = row.gap !== null && row.gap >= 0 ? '+' : '';
        return `<div style="font-family:'IBM Plex Sans',sans-serif;font-size:12px;">
          <strong>${escapeHtml(row.label)} (n = ${row.n})</strong><br/>
          Mediana C_VEL: <strong style="font-family:'IBM Plex Mono',monospace;color:${COLORS.primary};">${fmtNum(row.cVelMedian, 2)}</strong><br/>
          Mediana C_QUAL: <strong style="font-family:'IBM Plex Mono',monospace;color:${COLORS.success};">${fmtNum(row.cQualMedian, 2)}</strong><br/>
          Gap Δ (VEL − QUAL): <strong style="font-family:'IBM Plex Mono',monospace;">${row.gap !== null ? `${sign}${fmtNum(row.gap, 2)}` : '—'}</strong><br/>
          VEL &gt; QUAL: <span style="font-family:'IBM Plex Mono',monospace;">${row.velGreaterCount}/${row.n} (${fmtPct(row.velGreaterPct, 0)})</span>
        </div>`;
      },
    },
    grid: { left: 8, right: 10, top: 18, bottom: 24, containLabel: true },
    xAxis: {
      type: 'value',
      min: 1.0,
      max: 5.05,
      interval: 1,
      axisLabel: {
        fontFamily: 'IBM Plex Mono',
        fontSize: 10,
        color: COLORS.textMuted,
      },
      splitLine: { lineStyle: { color: '#EDF1EC' } },
    },
    yAxis: [
      {
        type: 'category',
        position: 'left',
        data: ordered.map((r) => r.label),
        axisLabel: {
          fontFamily: 'IBM Plex Sans',
          fontSize: 11,
          fontWeight: 600,
          color: COLORS.textPrimary,
        },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: COLORS.border } },
      },
      {
        type: 'category',
        position: 'right',
        data: ordered.map((r) =>
          r.n > 0 ? `n=${r.n} · ${fmtPct(r.velGreaterPct, 0)}` : 'n=0'
        ),
        axisLabel: {
          fontFamily: 'IBM Plex Mono',
          fontSize: 10,
          color: COLORS.textSecondary,
        },
        axisTick: { show: false },
        axisLine: { show: false },
      },
    ],
    series: [
      {
        name: 'Assimetria C_VEL vs C_QUAL',
        type: 'custom',
        renderItem: (cbParams, api) => {
          const item = seriesData[cbParams.dataIndex];
          if (!item) return null;
          const row = item.row;
          const yIdx = Number(api.value(0));
          const leftPt = api.coord([1.0, yIdx]);
          const rightPt = api.coord([5.05, yIdx]);
          const cy = leftPt[1];
          const opacity = item.dimmed ? 0.3 : 1;

          const children: Record<string, unknown>[] = [
            {
              type: 'rect',
              shape: {
                x: leftPt[0],
                y: cy - 16,
                width: Math.max(10, rightPt[0] - leftPt[0]),
                height: 32,
              },
              style: { fill: 'rgba(0,0,0,0.001)' },
            },
          ];

          if (row.cQualMedian !== null && row.cVelMedian !== null) {
            const ptQ = api.coord([row.cQualMedian, yIdx]);
            const ptV = api.coord([row.cVelMedian, yIdx]);
            const x1 = Math.min(ptQ[0], ptV[0]);
            const x2 = Math.max(ptQ[0], ptV[0]);
            const gapVal = row.gap ?? 0;
            const sign = gapVal >= 0 ? '+' : '';
            const deltaText = `Δ = ${sign}${fmtNum(gapVal, 2)}`;

            children.push({
              type: 'line',
              shape: { x1, y1: cy, x2, y2: cy },
              style: {
                stroke: gapVal >= 0 ? '#94A3B8' : '#6EE7B7',
                lineWidth: 5,
                lineCap: 'round',
                opacity: item.dimmed ? 0.25 : 0.65,
              },
            });

            const midX = (ptQ[0] + ptV[0]) / 2;
            const tooNarrow = Math.abs(ptV[0] - ptQ[0]) < 42;
            children.push({
              type: 'text',
              style: {
                text: deltaText,
                x: tooNarrow ? x2 + 10 : midX,
                y: tooNarrow ? cy : cy - 9,
                textAlign: tooNarrow ? 'left' : 'center',
                textVerticalAlign: tooNarrow ? 'middle' : 'bottom',
                fill: COLORS.textPrimary,
                font: "600 10px 'IBM Plex Mono', monospace",
                opacity,
              },
            });
          }

          if (row.cQualMedian !== null) {
            const ptQ = api.coord([row.cQualMedian, yIdx]);
            children.push({
              type: 'circle',
              shape: { cx: ptQ[0], cy, r: 6.5 },
              style: {
                fill: COLORS.success,
                stroke: '#FFFFFF',
                lineWidth: 1.5,
                opacity,
              },
            });
          }

          if (row.cVelMedian !== null) {
            const ptV = api.coord([row.cVelMedian, yIdx]);
            children.push({
              type: 'polygon',
              shape: { points: drawDiamondPoints(ptV[0], cy, 7.5) },
              style: {
                fill: COLORS.primary,
                stroke: '#FFFFFF',
                lineWidth: 1.5,
                opacity,
              },
            });
          }

          return {
            type: 'group',
            children: children as never[],
          };
        },
        data: seriesData,
      },
    ],
  };
}

type FullDumbbellEntry =
  | { kind: 'construct'; label: string; row: ConstructDumbbellRow }
  | { kind: 'item'; label: string; row: ItemDumbbellRow };

export function buildFullDumbbellProfileOption(params: {
  constructRows: ConstructDumbbellRow[];
  itemRows: ItemDumbbellRow[];
}): EChartsOption {
  const { constructRows, itemRows } = params;

  const entriesTopDown: FullDumbbellEntry[] = [
    ...constructRows.map((row) => ({
      kind: 'construct' as const,
      label: `${row.label} (n=${row.n} · C_QUAL vs C_VEL)`,
      row,
    })),
    ...itemRows.map((row) => {
      const shortName = row.shortLabel.replace(/^C_(VEL|QUAL)\d*\s*·\s*/, '');
      return {
        kind: 'item' as const,
        label: `${row.itemId} ${shortName} (${fmtPct(row.agreementPct, 0)} ≥4)`,
        row,
      };
    }),
  ];

  const ordered = [...entriesTopDown].reverse();

  return {
    legend: { show: false },
    tooltip: {
      trigger: 'item',
      confine: true,
      formatter: (rawParams: unknown) => {
        const p = rawParams as { data?: { entry?: FullDumbbellEntry } };
        const entry = p.data?.entry;
        if (!entry) return '';

        if (entry.kind === 'construct') {
          const r = entry.row;
          const sign = r.gap !== null && r.gap >= 0 ? '+' : '';
          return `<div style="font-family:'IBM Plex Sans',sans-serif;font-size:12px;">
            <strong>${escapeHtml(r.label)} (n = ${r.n})</strong><br/>
            Mediana C_VEL: <strong style="font-family:'IBM Plex Mono',monospace;color:${COLORS.primary};">${fmtNum(r.cVelMedian, 2)}</strong><br/>
            Mediana C_QUAL: <strong style="font-family:'IBM Plex Mono',monospace;color:${COLORS.success};">${fmtNum(r.cQualMedian, 2)}</strong><br/>
            Gap Δ: <strong style="font-family:'IBM Plex Mono',monospace;">${r.gap !== null ? `${sign}${fmtNum(r.gap, 2)}` : '—'}</strong> ·
            VEL &gt; QUAL: ${fmtPct(r.velGreaterPct, 0)}
          </div>`;
        }

        const it = entry.row;
        return `<div style="font-family:'IBM Plex Sans',sans-serif;font-size:12px;max-width:290px;white-space:normal;">
          <strong>${it.itemId} — ${escapeHtml(it.shortLabel)}</strong><br/>
          Mediana Geral: <strong style="font-family:'IBM Plex Mono',monospace;">${fmtNum(it.overallMedian, 2)}</strong>
          (n = ${it.nValid} · ≥4: ${fmtPct(it.agreementPct, 1)})<br/>
          Mediana Jr+Pl: <strong style="font-family:'IBM Plex Mono',monospace;color:${COLORS.warning};">${fmtNum(it.jrPlMedian, 2)}</strong> ·
          Mediana Sênior: <strong style="font-family:'IBM Plex Mono',monospace;color:${COLORS.primary};">${fmtNum(it.srMedian, 2)}</strong>
        </div>`;
      },
    },
    grid: { left: 8, right: 24, top: 14, bottom: 26, containLabel: true },
    xAxis: {
      type: 'value',
      min: 1.0,
      max: 5.05,
      interval: 0.5,
      axisLabel: {
        fontFamily: 'IBM Plex Mono',
        fontSize: 10,
        color: COLORS.textMuted,
      },
      splitLine: { lineStyle: { color: '#EDF1EC' } },
    },
    yAxis: {
      type: 'category',
      data: ordered.map((e) => e.label),
      axisLabel: {
        fontFamily: 'IBM Plex Sans',
        fontSize: 10.5,
        color: COLORS.textPrimary,
        width: 240,
        overflow: 'truncate',
      },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: COLORS.border } },
    },
    series: [
      {
        name: 'Perfil Dumbbell',
        type: 'custom',
        renderItem: (cbParams, api) => {
          const idx = Number(api.value(0));
          const entry = ordered[cbParams.dataIndex];
          if (!entry) return null;

          if (entry.kind === 'construct') {
            const r = entry.row;
            const ptBase = api.coord([1.0, idx]);
            const ptRight = api.coord([5.05, idx]);
            const cy = ptBase[1];
            const children: Record<string, unknown>[] = [];

            if (itemRows.length > 0 && cbParams.dataIndex === itemRows.length) {
              const bandSize = api.size ? api.size([0, 1]) : [0, 22];
              const rawBandH = Array.isArray(bandSize) ? bandSize[1] : bandSize;
              const bandH = typeof rawBandH === 'number' && rawBandH > 0 ? rawBandH : 22;
              const divY = cy + bandH / 2;
              children.push({
                type: 'line',
                shape: { x1: ptBase[0], y1: divY, x2: ptRight[0], y2: divY },
                style: { stroke: COLORS.border, lineWidth: 1.2, lineDash: [4, 3] },
              });
            }

            if (r.cQualMedian !== null && r.cVelMedian !== null) {
              const ptQ = api.coord([r.cQualMedian, idx]);
              const ptV = api.coord([r.cVelMedian, idx]);
              const x1 = Math.min(ptQ[0], ptV[0]);
              const x2 = Math.max(ptQ[0], ptV[0]);
              const gapVal = r.gap ?? 0;
              const sign = gapVal >= 0 ? '+' : '';
              children.push({
                type: 'line',
                shape: { x1, y1: cy, x2, y2: cy },
                style: { stroke: '#94A3B8', lineWidth: 4, lineCap: 'round', opacity: 0.7 },
              });
              children.push({
                type: 'text',
                style: {
                  text: `Δ ${sign}${fmtNum(gapVal, 2)}`,
                  x: Math.abs(ptV[0] - ptQ[0]) < 36 ? x2 + 9 : (ptQ[0] + ptV[0]) / 2,
                  y: Math.abs(ptV[0] - ptQ[0]) < 36 ? cy : cy - 7,
                  textAlign: Math.abs(ptV[0] - ptQ[0]) < 36 ? 'left' : 'center',
                  textVerticalAlign:
                    Math.abs(ptV[0] - ptQ[0]) < 36 ? 'middle' : 'bottom',
                  fill: COLORS.textPrimary,
                  font: "600 9.5px 'IBM Plex Mono', monospace",
                },
              });
            }
            if (r.cQualMedian !== null) {
              const ptQ = api.coord([r.cQualMedian, idx]);
              children.push({
                type: 'circle',
                shape: { cx: ptQ[0], cy, r: 5.5 },
                style: { fill: COLORS.success, stroke: '#FFFFFF', lineWidth: 1.5 },
              });
            }
            if (r.cVelMedian !== null) {
              const ptV = api.coord([r.cVelMedian, idx]);
              children.push({
                type: 'polygon',
                shape: { points: drawDiamondPoints(ptV[0], cy, 6.5) },
                style: { fill: COLORS.primary, stroke: '#FFFFFF', lineWidth: 1.5 },
              });
            }
            return { type: 'group', children: children as never[] };
          }

          const it = entry.row;
          const ptBase = api.coord([1.0, idx]);
          const cy = ptBase[1];
          const children: Record<string, unknown>[] = [];

          if (it.jrPlMedian !== null && it.srMedian !== null) {
            const ptJ = api.coord([it.jrPlMedian, idx]);
            const ptS = api.coord([it.srMedian, idx]);
            children.push({
              type: 'line',
              shape: {
                x1: Math.min(ptJ[0], ptS[0]),
                y1: cy,
                x2: Math.max(ptJ[0], ptS[0]),
                y2: cy,
              },
              style: { stroke: '#CBD5E1', lineWidth: 3, lineCap: 'round' },
            });
          }
          if (it.overallMedian !== null) {
            const ptO = api.coord([it.overallMedian, idx]);
            children.push({
              type: 'line',
              shape: { x1: ptO[0], y1: cy - 6, x2: ptO[0], y2: cy + 6 },
              style: { stroke: COLORS.textPrimary, lineWidth: 2 },
            });
          }
          if (it.jrPlMedian !== null) {
            const ptJ = api.coord([it.jrPlMedian, idx]);
            children.push({
              type: 'circle',
              shape: { cx: ptJ[0], cy, r: 4.8 },
              style: { fill: COLORS.warning, stroke: '#FFFFFF', lineWidth: 1.2 },
            });
          }
          if (it.srMedian !== null) {
            const ptS = api.coord([it.srMedian, idx]);
            children.push({
              type: 'circle',
              shape: { cx: ptS[0], cy, r: 4.8 },
              style: { fill: COLORS.primary, stroke: '#FFFFFF', lineWidth: 1.2 },
            });
          }

          return { type: 'group', children: children as never[] };
        },
        data: ordered.map((entry, idx) => ({
          value: [idx],
          entry,
        })),
      },
    ],
  };
}

// ---------- 4. 4-Stage Sankey Builder ----------

export interface SankeyNodeDatum {
  name: string;
  displayLabel: string;
  stage: 'seniority' | 'tool' | 'mRevTier' | 'cQualTier';
  count: number;
  itemStyle: { color: string; borderColor?: string; borderWidth?: number; opacity?: number };
  clickTarget: {
    kind: 'seniority' | 'tool' | 'mRevTier' | 'cQualTier' | 'noop';
    value: string;
  };
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
      clickTarget: SankeyNodeDatum['clickTarget'];
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
    clickTarget: SankeyNodeDatum['clickTarget']
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

function stripStagePrefix(nodeId: string): string {
  if (nodeId.startsWith('sen:')) return nodeId.slice(4);
  if (nodeId.startsWith('tool:')) return nodeId.slice(5);
  if (nodeId.startsWith('rev:')) {
    const tier = nodeId.slice(4) as ClassifiedTierId;
    return `Rigor ${ORDINAL_TIER_SHORT_LABELS[tier] ?? tier}`;
  }
  if (nodeId.startsWith('qual:')) {
    const tier = nodeId.slice(5) as ClassifiedTierId;
    return `Qual. ${ORDINAL_TIER_SHORT_LABELS[tier] ?? tier}`;
  }
  return nodeId;
}

export function buildSankeyOption(params: {
  graph: SankeyGraphData;
  activeBiFilter?: Partial<
    Pick<BiFilterState, 'seniorities' | 'tools' | 'mRevTiers' | 'cQualTiers'>
  >;
  compact?: boolean;
}): EChartsOption {
  const { graph, activeBiFilter, compact = false } = params;

  const isStageFiltered = {
    seniority: Boolean(activeBiFilter?.seniorities?.length),
    tool: Boolean(activeBiFilter?.tools?.length),
    mRevTier: Boolean(activeBiFilter?.mRevTiers?.length),
    cQualTier: Boolean(activeBiFilter?.cQualTiers?.length),
  };

  const nodes = graph.nodes.map((node) => {
    let selected = false;
    if (node.clickTarget.kind === 'seniority' && activeBiFilter?.seniorities) {
      selected = activeBiFilter.seniorities.includes(
        node.clickTarget.value as SeniorityLevel
      );
    } else if (node.clickTarget.kind === 'tool' && activeBiFilter?.tools) {
      selected = activeBiFilter.tools.includes(node.clickTarget.value);
    } else if (node.clickTarget.kind === 'mRevTier' && activeBiFilter?.mRevTiers) {
      selected = activeBiFilter.mRevTiers.includes(
        node.clickTarget.value as OrdinalTierId
      );
    } else if (node.clickTarget.kind === 'cQualTier' && activeBiFilter?.cQualTiers) {
      selected = activeBiFilter.cQualTiers.includes(
        node.clickTarget.value as OrdinalTierId
      );
    }

    const stageHasFilter = isStageFiltered[node.stage];
    const dimmed = stageHasFilter && !selected && node.clickTarget.kind !== 'noop';

    return {
      ...node,
      itemStyle: {
        ...node.itemStyle,
        opacity: dimmed ? 0.32 : 0.95,
        borderColor: selected ? '#142027' : '#FFFFFF',
        borderWidth: selected ? 2 : 1,
      },
    };
  });

  return {
    tooltip: {
      trigger: 'item',
      triggerOn: 'mousemove',
      confine: true,
      formatter: (rawParams: unknown) => {
        const p = rawParams as {
          dataType?: string;
          data?: Partial<SankeyNodeDatum & SankeyLinkDatum>;
        };
        if (p.dataType === 'edge' && p.data?.source && p.data?.target) {
          const srcLabel = stripStagePrefix(p.data.source);
          const tgtLabel = stripStagePrefix(p.data.target);
          return `<div style="font-family:'IBM Plex Sans',sans-serif;font-size:12px;">
            <strong>${escapeHtml(srcLabel)} → ${escapeHtml(tgtLabel)}</strong><br/>
            Fluxo: <strong style="font-family:'IBM Plex Mono',monospace;">${p.data.value ?? 0}</strong> respondente(s)
          </div>`;
        }
        const node = p.data as SankeyNodeDatum | undefined;
        if (!node?.name) return '';
        const pct =
          graph.totalRespondents > 0
            ? (node.count / graph.totalRespondents) * 100
            : 0;
        return `<div style="font-family:'IBM Plex Sans',sans-serif;font-size:12px;">
          <strong>${escapeHtml(node.displayLabel || stripStagePrefix(node.name))}</strong><br/>
          Respondentes: <strong style="font-family:'IBM Plex Mono',monospace;">${node.count}</strong>
          (<span style="font-family:'IBM Plex Mono',monospace;">${fmtPct(pct, 1)}</span>)
        </div>`;
      },
    },
    series: [
      {
        type: 'sankey',
        nodeAlign: 'justify',
        orient: 'horizontal',
        draggable: false,
        left: compact ? 8 : 16,
        right: compact ? 92 : 120,
        top: compact ? 10 : 14,
        bottom: compact ? 10 : 14,
        nodeWidth: compact ? 12 : 16,
        nodeGap: compact ? 8 : 12,
        data: nodes,
        links: graph.links,
        emphasis: {
          focus: 'adjacency',
        },
        lineStyle: {
          color: 'gradient',
          curveness: 0.5,
          opacity: 0.32,
        },
        label: {
          fontFamily: 'IBM Plex Sans',
          fontSize: compact ? 10 : 11,
          fontWeight: 600,
          color: COLORS.textPrimary,
          formatter: (cbParams: unknown) => {
            const p = cbParams as { name?: string; data?: SankeyNodeDatum };
            const count = p.data?.count;
            const clean = p.data?.displayLabel ?? stripStagePrefix(p.name ?? '');
            return count !== undefined ? `${clean} (${count})` : clean;
          },
        },
      },
    ],
  };
}

// ---------- 5. Paired Butterfly Theme Chart Builder ----------

export interface ButterflyThemeInput {
  id: string;
  label: string;
  description?: string;
  count: number;
  pctOfAnswered?: number;
  pctOfTotalValid?: number;
  pct?: number;
  selected?: boolean;
  dimmed?: boolean;
}

export function buildPairedThemeButterflyOption(params: {
  riskThemes: ButterflyThemeInput[];
  benefitThemes: ButterflyThemeInput[];
  selectedRiskThemes?: string[];
  selectedBenefitThemes?: string[];
  compact?: boolean;
}): EChartsOption {
  const {
    riskThemes,
    benefitThemes,
    selectedRiskThemes = [],
    selectedBenefitThemes = [],
    compact = false,
  } = params;

  const rowCount = Math.max(riskThemes.length, benefitThemes.length, 5);
  const topDownPairs = Array.from({ length: rowCount }, (_, rankIdx) => ({
    rank: rankIdx + 1,
    risk: riskThemes[rankIdx] ?? null,
    benefit: benefitThemes[rankIdx] ?? null,
  }));

  const ordered = [...topDownPairs].reverse();

  let maxCount = 1;
  for (const pair of ordered) {
    if (pair.risk && pair.risk.count > maxCount) maxCount = pair.risk.count;
    if (pair.benefit && pair.benefit.count > maxCount) maxCount = pair.benefit.count;
  }
  const axisBound = Math.max(2, Math.ceil(maxCount * 1.25));

  const hasRiskFilter = selectedRiskThemes.length > 0;
  const hasBenefitFilter = selectedBenefitThemes.length > 0;

  const riskSeriesData = ordered.map((pair) => {
    const r = pair.risk;
    if (!r) return null;
    const isSelected = r.selected ?? selectedRiskThemes.includes(r.id);
    const dimmed = r.dimmed ?? (hasRiskFilter && !isSelected);
    return {
      value: -r.count,
      theme: r,
      rank: pair.rank,
      clickTarget: {
        kind: 'riskTheme' as const,
        themeId: r.id,
        label: r.label,
      },
      itemStyle: {
        color: COLORS.danger,
        opacity: dimmed ? 0.35 : 0.92,
        borderColor: isSelected ? '#142027' : 'transparent',
        borderWidth: isSelected ? 1.5 : 0,
        borderRadius: [4, 0, 0, 4],
      },
    };
  });

  const benefitSeriesData = ordered.map((pair) => {
    const b = pair.benefit;
    if (!b) return null;
    const isSelected = b.selected ?? selectedBenefitThemes.includes(b.id);
    const dimmed = b.dimmed ?? (hasBenefitFilter && !isSelected);
    return {
      value: b.count,
      theme: b,
      rank: pair.rank,
      clickTarget: {
        kind: 'benefitTheme' as const,
        themeId: b.id,
        label: b.label,
      },
      itemStyle: {
        color: COLORS.success,
        opacity: dimmed ? 0.35 : 0.92,
        borderColor: isSelected ? '#142027' : 'transparent',
        borderWidth: isSelected ? 1.5 : 0,
        borderRadius: [0, 4, 4, 0],
      },
    };
  });

  return {
    tooltip: {
      trigger: 'item',
      confine: true,
      formatter: (rawParams: unknown) => {
        const p = rawParams as {
          seriesIndex?: number;
          data?: { theme?: ButterflyThemeInput; rank?: number };
        };
        const t = p.data?.theme;
        if (!t) return '';
        const kindLabel =
          p.seriesIndex === 0 ? 'Risco (ITEM_21)' : 'Benefício (ITEM_22)';
        const pctVal = t.pctOfAnswered ?? t.pct ?? t.pctOfTotalValid;
        return `<div style="font-family:'IBM Plex Sans',sans-serif;font-size:12px;max-width:290px;white-space:normal;">
          <strong>${kindLabel} · ${p.data?.rank ?? ''}º lugar</strong><br/>
          <strong>${escapeHtml(t.label)}</strong><br/>
          ${t.description ? `<span style="color:#5C6D75;font-size:11px;">${escapeHtml(t.description)}</span><br/>` : ''}
          Menções: <strong style="font-family:'IBM Plex Mono',monospace;">${t.count}</strong>
          ${pctVal !== undefined ? `(<span style="font-family:'IBM Plex Mono',monospace;">${fmtPct(pctVal, 1)}</span>)` : ''}
        </div>`;
      },
    },
    legend: {
      top: 0,
      left: 'center',
      itemWidth: 10,
      itemHeight: 10,
      textStyle: {
        fontFamily: 'IBM Plex Sans',
        fontSize: compact ? 10 : 11,
        color: COLORS.textSecondary,
      },
    },
    grid: {
      left: 6,
      right: 6,
      top: compact ? 26 : 32,
      bottom: 20,
      containLabel: true,
    },
    xAxis: {
      type: 'value',
      min: -axisBound,
      max: axisBound,
      minInterval: 1,
      axisLabel: {
        fontFamily: 'IBM Plex Mono',
        fontSize: 10,
        color: COLORS.textMuted,
        formatter: (v: number) => String(Math.abs(Math.round(v))),
      },
      splitLine: { lineStyle: { color: '#EDF1EC' } },
    },
    yAxis: [
      {
        type: 'category',
        position: 'left',
        data: ordered.map((pair) => pair.risk?.label ?? `${pair.rank}º`),
        axisLabel: {
          fontFamily: 'IBM Plex Sans',
          fontSize: compact ? 10 : 11,
          color: COLORS.textPrimary,
          width: compact ? 115 : 175,
          overflow: 'truncate',
        },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: COLORS.border } },
      },
      {
        type: 'category',
        position: 'right',
        data: ordered.map((pair) => pair.benefit?.label ?? `${pair.rank}º`),
        axisLabel: {
          fontFamily: 'IBM Plex Sans',
          fontSize: compact ? 10 : 11,
          color: COLORS.textPrimary,
          width: compact ? 115 : 175,
          overflow: 'truncate',
        },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: COLORS.border } },
      },
    ],
    series: [
      {
        name: 'Riscos (ITEM_21)',
        type: 'bar',
        stack: 'butterfly',
        yAxisIndex: 0,
        barMaxWidth: compact ? 16 : 20,
        data: riskSeriesData,
        label: {
          show: true,
          position: 'left',
          fontFamily: 'IBM Plex Mono',
          fontSize: 10,
          color: COLORS.danger,
          formatter: (cbParams: unknown) => {
            const p = cbParams as { data?: { theme?: ButterflyThemeInput } };
            const t = p.data?.theme;
            return t ? String(t.count) : '';
          },
        },
      },
      {
        name: 'Benefícios (ITEM_22)',
        type: 'bar',
        stack: 'butterfly',
        yAxisIndex: 0,
        barMaxWidth: compact ? 16 : 20,
        data: benefitSeriesData,
        label: {
          show: true,
          position: 'right',
          fontFamily: 'IBM Plex Mono',
          fontSize: 10,
          color: COLORS.success,
          formatter: (cbParams: unknown) => {
            const p = cbParams as { data?: { theme?: ButterflyThemeInput } };
            const t = p.data?.theme;
            return t ? String(t.count) : '';
          },
        },
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: COLORS.textPrimary, width: 1.4 },
          label: { show: false },
          data: [{ xAxis: 0 }],
        },
      },
    ],
  };
}
