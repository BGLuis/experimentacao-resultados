import type { EChartsOption } from 'echarts';
import { COLORS, SENIORITY_COLORS, escapeHtml, fmtNum } from '../utils/format';
import {
  ORDINAL_TIER_LABELS,
  ORDINAL_TIER_SHORT_LABELS,
  type OrdinalTierId,
} from '../stats/biCrossFilter';
import {
  ORDINAL_TIER_COLORS,
  aggregateQp4Ties,
  computeClampedKde,
  type ClickTargetPayload,
  type KdeCurvePoint,
  type Qp4TieCell,
} from '../stats/biDataAggregators';
import type { GroupSummary, QP4ScatterPoint, SeniorityLevel } from '../stats/types';
import {
  AXIS_LINE_STYLE,
  FONT_MONO,
  FONT_SANS,
  SPLIT_LINE_STYLE,
  makeMonoAxisLabel,
  makeSansAxisLabel,
  monoSpan,
  tooltipCard,
} from './echartsTheme';

export const RAINCLOUD_GROUP_COLORS: Record<string, string> = {
  Júnior: '#B8721F',
  Pleno: '#5B9BD5',
  Sênior: '#1F4E8C',
  'Júnior + Pleno': '#8E5512',
  'Jr+Pl': '#8E5512',
  'Pleno + Sênior': '#2F7A5C',
  Sr: '#1F4E8C',
};

export function deterministicJitter(seed: number, amplitude: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  const frac = x - Math.floor(x);
  return (frac * 2 - 1) * amplitude;
}

function resolveRaincloudClickTarget(groupName: string): ClickTargetPayload {
  if (groupName === 'Júnior' || groupName === 'Pleno' || groupName === 'Sênior') {
    return { kind: 'seniority', value: groupName };
  }
  if (groupName === 'Sr') {
    return { kind: 'seniority', value: 'Sênior' };
  }
  if (groupName === 'Júnior + Pleno' || groupName === 'Jr+Pl') {
    return { kind: 'seniorityPair', seniorities: ['Júnior', 'Pleno'] };
  }
  if (groupName === 'Pleno + Sênior') {
    return { kind: 'seniorityPair', seniorities: ['Pleno', 'Sênior'] };
  }
  return { kind: 'noop', value: groupName };
}

function isRaincloudGroupSelected(
  target: ClickTargetPayload,
  selectedSeniorities?: SeniorityLevel[]
): boolean {
  if (!selectedSeniorities || selectedSeniorities.length === 0) return true;
  if (target.kind === 'seniority') return selectedSeniorities.includes(target.value);
  if (target.kind === 'seniorityPair') {
    return target.seniorities.some((s) => selectedSeniorities.includes(s));
  }
  return true;
}

/**
 * Constrói opção ECharts para o gráfico Raincloud (KDE limitada + jitter determinístico + Mediana/IQR/MAD).
 */
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
    clickTarget: ClickTargetPayload;
    itemStyle: { opacity: number };
  }> = [];

  const scatterData: Array<{
    value: [number, number];
    groupName: string;
    group: GroupSummary;
    clickTarget: ClickTargetPayload;
    itemStyle: { color: string; opacity: number; borderColor: string; borderWidth: number };
  }> = [];

  const summaryData: Array<{
    value: [number, number, number, number, number];
    groupName: string;
    group: GroupSummary;
    color: string;
    dimmed: boolean;
    clickTarget: ClickTargetPayload;
    itemStyle: { opacity: number };
  }> = [];

  groups.forEach((g, gIdx) => {
    if (g.n === 0) return;

    const color = RAINCLOUD_GROUP_COLORS[g.group] ?? COLORS.primary;
    const clickTarget = resolveRaincloudClickTarget(g.group);
    const dimmed = hasSelection && !isRaincloudGroupSelected(clickTarget, selectedSeniorities);

    const kde = computeClampedKde(g.values);
    if (kde.points.length > 0 && kde.maxDensity > 0) {
      kdeData.push({
        value: [gIdx],
        groupName: g.group,
        group: g,
        kde,
        color,
        dimmed,
        clickTarget,
        itemStyle: { opacity: dimmed ? 0.24 : 0.9 },
      });
    }

    g.values.forEach((v, i) => {
      const jitter = deterministicJitter(gIdx * 100 + i + 1, 0.095);
      scatterData.push({
        value: [gIdx + 0.16 + jitter, v],
        groupName: g.group,
        group: g,
        clickTarget,
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
        value: [gIdx, g.median, g.q1 ?? g.median, g.q3 ?? g.median, g.mad ?? 0],
        groupName: g.group,
        group: g,
        color,
        dimmed,
        clickTarget,
        itemStyle: { opacity: dimmed ? 0.32 : 1 },
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
            textStyle: { fontFamily: FONT_SANS, fontSize: 13, fontWeight: 600, color: COLORS.textPrimary },
          },
        }
      : {}),
    tooltip: {
      trigger: 'item',
      confine: true,
      formatter: (rawParams: unknown) => {
        const p = rawParams as { seriesName?: string; value?: number[]; data?: { group?: GroupSummary } };
        const g = p.data?.group;
        if (!g) return '';
        if (p.seriesName === 'Respondentes' && Array.isArray(p.value)) {
          return tooltipCard(
            `<strong>${escapeHtml(g.group)}</strong> (n = ${g.n})<br/>Escore individual: ${monoSpan(fmtNum(p.value[1], 2), { bold: true })}`
          );
        }
        return tooltipCard(
          `<strong>${escapeHtml(g.group)} (n = ${g.n})</strong><br/>Mediana: ${monoSpan(fmtNum(g.median, 2), { bold: true })} · MAD: ${monoSpan(`±${fmtNum(g.mad, 2)}`)}<br/>IQR [Q1; Q3]: ${monoSpan(`[${fmtNum(g.q1, 2)}; ${fmtNum(g.q3, 2)}]`)}<br/>Amplitude: ${monoSpan(`${fmtNum(g.min, 2)} – ${fmtNum(g.max, 2)}`)}`
        );
      },
    },
    grid: { left: compact ? 30 : 38, right: compact ? 12 : 18, top: topMargin, bottom: compact ? 24 : 26, containLabel: true },
    xAxis: {
      type: 'category',
      data: categories,
      axisLabel: makeSansAxisLabel(compact ? 10 : 11, { fontWeight: 600, interval: 0 }),
      axisTick: { show: false },
      axisLine: AXIS_LINE_STYLE,
    },
    yAxis: {
      type: 'value',
      min: 1,
      max: 5.15,
      interval: 1,
      axisLabel: makeMonoAxisLabel(compact ? 10 : 11),
      splitLine: SPLIT_LINE_STYLE,
    },
    series: [
      {
        name: 'Densidade KDE',
        type: 'custom',
        z: 2,
        renderItem: (cbParams, api) => {
          const item = kdeData[cbParams.dataIndex];
          if (!item || item.kde.points.length === 0 || item.kde.maxDensity <= 0) return null;
          const gIdx = Number(api.value(0));
          const centerPt = api.coord([gIdx, 1.0]);
          const bandSize = api.size ? api.size([1, 0]) : [80, 0];
          const rawBandWidth = Array.isArray(bandSize) ? bandSize[0] : bandSize;
          const bandWidth = typeof rawBandWidth === 'number' && rawBandWidth > 0 ? rawBandWidth : 80;

          const innerEdgeX = centerPt[0] - Math.min(5, bandWidth * 0.04);
          const maxHalfPx = Math.min(44, bandWidth * 0.36);
          const curvePts: number[][] = item.kde.points.map((pt) => [
            innerEdgeX - (pt.density / item.kde.maxDensity) * maxHalfPx,
            api.coord([gIdx, pt.score])[1],
          ]);
          const polyPts: number[][] = [
            [innerEdgeX, curvePts[0][1]],
            ...curvePts,
            [innerEdgeX, curvePts[curvePts.length - 1][1]],
          ];

          return {
            type: 'group',
            children: [
              { type: 'polygon', shape: { points: polyPts }, style: { fill: item.color, opacity: item.dimmed ? 0.08 : 0.24 } },
              { type: 'polyline', shape: { points: curvePts }, style: { stroke: item.color, fill: 'none', lineWidth: 1.75, opacity: item.dimmed ? 0.3 : 0.9 } },
            ],
          };
        },
        data: kdeData,
      },
      { name: 'Respondentes', type: 'scatter', z: 3, symbolSize: compact ? 6 : 7, data: scatterData },
      {
        name: 'Mediana / IQR / MAD',
        type: 'custom',
        z: 4,
        renderItem: (cbParams, api) => {
          const item = summaryData[cbParams.dataIndex];
          if (!item) return null;
          const gIdx = Number(api.value(0));
          const med = Number(api.value(1));
          const q1 = Number(api.value(2));
          const q3 = Number(api.value(3));
          const madVal = Number(api.value(4));
          const ptMed = api.coord([gIdx, med]);
          const ptQ1 = api.coord([gIdx, q1]);
          const ptQ3 = api.coord([gIdx, q3]);
          const ptLow = api.coord([gIdx, Math.max(1.0, med - madVal)]);
          const ptHigh = api.coord([gIdx, Math.min(5.0, med + madVal)]);
          const cx = ptMed[0];
          const iqrTop = Math.min(ptQ1[1], ptQ3[1]);
          const iqrHeight = Math.max(2, Math.abs(ptQ1[1] - ptQ3[1]));
          const opacity = item.dimmed ? 0.32 : 1;

          return {
            type: 'group',
            children: [
              { type: 'line', shape: { x1: cx, y1: ptLow[1], x2: cx, y2: ptHigh[1] }, style: { stroke: COLORS.textPrimary, lineWidth: 2, opacity } },
              { type: 'line', shape: { x1: cx - 4, y1: ptLow[1], x2: cx + 4, y2: ptLow[1] }, style: { stroke: COLORS.textPrimary, lineWidth: 1.5, opacity } },
              { type: 'line', shape: { x1: cx - 4, y1: ptHigh[1], x2: cx + 4, y2: ptHigh[1] }, style: { stroke: COLORS.textPrimary, lineWidth: 1.5, opacity } },
              { type: 'rect', shape: { x: cx - 4.5, y: iqrTop, width: 9, height: iqrHeight, r: 2 }, style: { fill: item.color, opacity: item.dimmed ? 0.25 : 0.85 } },
              { type: 'circle', shape: { cx, cy: ptMed[1], r: compact ? 5 : 5.5 }, style: { fill: item.color, stroke: '#FFFFFF', lineWidth: 2, opacity } },
            ],
          };
        },
        data: summaryData,
      },
    ],
  };
}

// ---------- 2. QP4 Joint Matrix + 3-Grid Marginals ----------

const TIER_INTERVALS: Array<{
  tierId: OrdinalTierId;
  drawMin: number;
  drawMax: number;
  bandMin: number;
  bandMax: number;
  tint: string;
}> = [
  { tierId: 'low', drawMin: 1.03, drawMax: 2.47, bandMin: 1.0, bandMax: 2.5, tint: 'rgba(184, 59, 59, 0.045)' },
  { tierId: 'moderate', drawMin: 2.53, drawMax: 3.72, bandMin: 2.5, bandMax: 3.75, tint: 'rgba(184, 114, 31, 0.03)' },
  { tierId: 'high', drawMin: 3.78, drawMax: 5.0, bandMin: 3.75, bandMax: 5.0, tint: 'rgba(47, 122, 92, 0.045)' },
];

function makeQp4MainAxis(
  name: string,
  nameGap: number,
  compact: boolean,
  rotateName = false
) {
  return {
    gridIndex: 0,
    type: 'value' as const,
    name,
    nameLocation: 'middle' as const,
    nameGap,
    ...(rotateName ? { nameRotate: 90 } : {}),
    nameTextStyle: {
      fontFamily: FONT_SANS,
      fontSize: compact ? 10 : 11,
      fontWeight: 600,
      color: COLORS.textSecondary,
    },
    min: 1.0,
    max: 5.2,
    interval: 1,
    axisLabel: { ...makeMonoAxisLabel(10), formatter: (val: number) => (val <= 5 ? String(val) : '') },
    axisLine: AXIS_LINE_STYLE,
    splitLine: SPLIT_LINE_STYLE,
  };
}

/**
 * Constrói opção ECharts da matriz conjunta QP4 (M_REV × C_QUAL) com bolhas de empate e barras marginais.
 */
export function buildQp4JointMatrixOption(params: {
  scatterPoints: QP4ScatterPoint[];
  activeMRevTiers?: OrdinalTierId[];
  activeCQualTiers?: OrdinalTierId[];
  compact?: boolean;
}): EChartsOption {
  const { scatterPoints, activeMRevTiers = [], activeCQualTiers = [], compact = false } = params;
  const { cells, mRevTierCounts, cQualTierCounts, olsLine } = aggregateQp4Ties(scatterPoints);

  const maxMRevTier = Math.max(1, mRevTierCounts.low, mRevTierCounts.moderate, mRevTierCounts.high);
  const maxCQualTier = Math.max(1, cQualTierCounts.low, cQualTierCounts.moderate, cQualTierCounts.high);
  const hasMRevFilter = activeMRevTiers.length > 0;
  const hasCQualFilter = activeCQualTiers.length > 0;

  const bubbleData = cells.map((cell) => {
    const active =
      (!hasMRevFilter || activeMRevTiers.includes(cell.mRevTier)) &&
      (!hasCQualFilter || activeCQualTiers.includes(cell.cQualTier));
    const useLightText = active && cell.dominantSeniority === 'Sênior';

    return {
      value: [cell.mRev, cell.cQual],
      cell,
      clickTarget: { kind: 'bubble' as const, mRevTier: cell.mRevTier, cQualTier: cell.cQualTier, cell },
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
        fontFamily: FONT_MONO,
        fontSize: 10,
        fontWeight: 700,
        color: useLightText ? '#FFFFFF' : '#142027',
        textBorderColor: useLightText ? '#142027' : '#FFFFFF',
        textBorderWidth: useLightText ? 1 : 2.5,
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
    clickTarget: { kind: 'mRevTier' as const, value: t.tierId },
  }));

  const cQualMarginalData = TIER_INTERVALS.map((t, idx) => ({
    value: [cQualTierCounts[t.tierId], idx],
    tierId: t.tierId,
    count: cQualTierCounts[t.tierId],
    interval: t,
    selected: activeCQualTiers.includes(t.tierId),
    dimmed: hasCQualFilter && !activeCQualTiers.includes(t.tierId),
    clickTarget: { kind: 'cQualTier' as const, value: t.tierId },
  }));

  return {
    legend: { show: false },
    tooltip: {
      trigger: 'item',
      confine: true,
      formatter: (rawParams: unknown) => {
        const p = rawParams as { data?: { clickTarget?: ClickTargetPayload; count?: number } };
        const target = p.data?.clickTarget;
        if (!target) return '';
        if (target.kind === 'bubble' && target.cell) {
          const c = target.cell;
          const senParts = (['Sênior', 'Pleno', 'Júnior'] as const)
            .filter((s) => c.seniorityCounts[s] > 0)
            .map((s) => `${s}: ${c.seniorityCounts[s]}`);
          return tooltipCard(
            `<strong>Ponto exato (n = ${c.count})</strong><br/>M_REV: ${monoSpan(fmtNum(c.mRev, 2), { bold: true })} (${ORDINAL_TIER_SHORT_LABELS[c.mRevTier]})<br/>C_QUAL: ${monoSpan(fmtNum(c.cQual, 2), { bold: true })} (${ORDINAL_TIER_SHORT_LABELS[c.cQualTier]})<br/>Senioridade: ${escapeHtml(senParts.join(' · '))}<br/>IDs: ${monoSpan(escapeHtml(c.respondentIds.join(', ')), { sizePx: 11 })}`,
            270
          );
        }
        if (target.kind === 'mRevTier' || target.kind === 'cQualTier') {
          const axisLabel = target.kind === 'mRevTier' ? 'M_REV (Rigor)' : 'C_QUAL (Qualidade)';
          return tooltipCard(
            `<strong>${axisLabel} · ${ORDINAL_TIER_LABELS[target.value]}</strong><br/>Respondentes na faixa: ${monoSpan(String(p.data?.count ?? 0), { bold: true })}`
          );
        }
        return '';
      },
    },
    grid: [
      { left: 48, right: 68, top: 52, bottom: 38, containLabel: false },
      { left: 48, right: 68, top: 8, height: 34, containLabel: false },
      { top: 52, bottom: 38, right: 10, width: 48, containLabel: false },
    ],
    xAxis: [
      makeQp4MainAxis('M_REV (Rigor de Revisão e Testes)', 23, compact),
      { gridIndex: 1, type: 'value', min: 1.0, max: 5.2, show: false },
      { gridIndex: 2, type: 'value', min: 0, max: maxCQualTier, show: false },
    ],
    yAxis: [
      makeQp4MainAxis('C_QUAL', 30, compact, true),
      { gridIndex: 1, type: 'value', min: 0, max: maxMRevTier, show: false },
      { gridIndex: 2, type: 'value', min: 1.0, max: 5.2, show: false },
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
          data: TIER_INTERVALS.map((t) => [
            { xAxis: t.bandMin, yAxis: t.bandMin, itemStyle: { color: t.tint } },
            { xAxis: t.bandMax, yAxis: t.bandMax },
          ]),
        },
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: '#CBD5E1', type: 'dashed', width: 1 },
          label: { show: false },
          data: [{ xAxis: 2.5 }, { xAxis: 3.75 }, { yAxis: 2.5 }, { yAxis: 3.75 }],
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
              lineStyle: { color: COLORS.textPrimary, width: 1.75, type: 'dashed' as const, opacity: 0.75 },
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

          return {
            type: 'group',
            children: [
              { type: 'rect', shape: { x, y: ptMaxTop[1], width, height: Math.max(4, ptBL[1] - ptMaxTop[1]) }, style: { fill: 'rgba(0,0,0,0.001)' } },
              {
                type: 'rect',
                shape: { x, y: barY, width, height: barHeight, r: [3, 3, 0, 0] },
                style: { fill: ORDINAL_TIER_COLORS[item.tierId], opacity: item.dimmed ? 0.25 : 0.82, stroke: item.selected ? '#142027' : 'none', lineWidth: item.selected ? 1.5 : 0 },
              },
              {
                type: 'text',
                style: {
                  text: String(item.count),
                  x: x + width / 2,
                  y: Math.max(ptMaxTop[1] + 9, barY - 3),
                  textAlign: 'center',
                  textVerticalAlign: 'bottom',
                  fill: item.dimmed ? COLORS.textMuted : COLORS.textPrimary,
                  stroke: '#FFFFFF',
                  lineWidth: 2,
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
          const insideBar = barWidth > ptMaxRight[0] - ptBL[0] - 14;
          const useDarkInside = insideBar && (item.dimmed || item.tierId === 'moderate');

          return {
            type: 'group',
            children: [
              { type: 'rect', shape: { x: ptBL[0], y, width: Math.max(4, ptMaxRight[0] - ptBL[0]), height }, style: { fill: 'rgba(0,0,0,0.001)' } },
              {
                type: 'rect',
                shape: { x: ptBL[0], y, width: barWidth, height, r: [0, 3, 3, 0] },
                style: { fill: ORDINAL_TIER_COLORS[item.tierId], opacity: item.dimmed ? 0.25 : 0.82, stroke: item.selected ? '#142027' : 'none', lineWidth: item.selected ? 1.5 : 0 },
              },
              {
                type: 'text',
                style: {
                  text: String(item.count),
                  x: Math.min(ptMaxRight[0] - 2, ptBL[0] + barWidth + 4),
                  y: y + height / 2,
                  textAlign: insideBar ? 'right' : 'left',
                  textVerticalAlign: 'middle',
                  fill: insideBar ? (useDarkInside ? COLORS.textPrimary : '#FFFFFF') : item.dimmed ? COLORS.textMuted : COLORS.textPrimary,
                  stroke: insideBar && !useDarkInside ? 'none' : '#FFFFFF',
                  lineWidth: insideBar && !useDarkInside ? 0 : 2,
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
