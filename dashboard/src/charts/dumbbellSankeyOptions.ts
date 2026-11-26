import type { EChartsOption } from 'echarts';
import {
  COLORS,
  SENIORITY_COLORS,
  escapeHtml,
  fmtNum,
  fmtPct,
} from '../utils/format';
import type {
  BiFacetBarItem,
  BiFilterState,
  OrdinalTierId,
} from '../stats/biCrossFilter';
import type {
  ClickTargetPayload,
  ConstructDumbbellRow,
  ItemDumbbellRow,
  SankeyGraphData,
  SankeyLinkDatum,
  SankeyNodeDatum,
} from '../stats/biDataAggregators';
import type { SeniorityLevel } from '../stats/types';
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

// ---------- 1. Shared Dumbbell Helpers & Option Builders ----------

function drawDiamondPoints(cx: number, cy: number, r: number): number[][] {
  return [
    [cx, cy - r],
    [cx + r, cy],
    [cx, cy + r],
    [cx - r, cy],
  ];
}

const CONSTRUCT_RENDER_STYLES = {
  compact: {
    lineWidth: 5,
    lineDefaultOpacity: 0.65,
    negativeGapColor: '#6EE7B7',
    narrowThreshold: 42,
    deltaPrefix: 'Δ = ',
    deltaOffsetX: 10,
    deltaOffsetY: 9,
    deltaFont: "600 10px 'IBM Plex Mono', monospace",
    circleR: 6.5,
    diamondR: 7.5,
  },
  full: {
    lineWidth: 4,
    lineDefaultOpacity: 0.7,
    negativeGapColor: '#94A3B8',
    narrowThreshold: 36,
    deltaPrefix: 'Δ ',
    deltaOffsetX: 9,
    deltaOffsetY: 7,
    deltaFont: "600 9.5px 'IBM Plex Mono', monospace",
    circleR: 5.5,
    diamondR: 6.5,
  },
} as const;

function formatConstructDumbbellTooltip(
  row: ConstructDumbbellRow,
  compact: boolean
): string {
  const sign = row.gap !== null && row.gap >= 0 ? '+' : '';
  const gapStr = row.gap !== null ? `${sign}${fmtNum(row.gap, 2)}` : '—';
  const velPctStr = fmtPct(row.velGreaterPct, 0);

  return tooltipCard(
    `<strong>${escapeHtml(row.label)} (n = ${row.n})</strong><br/>` +
      `Mediana C_VEL: ${monoSpan(fmtNum(row.cVelMedian, 2), { bold: true, color: COLORS.primary })}<br/>` +
      `Mediana C_QUAL: ${monoSpan(fmtNum(row.cQualMedian, 2), { bold: true, color: COLORS.success })}<br/>` +
      (compact
        ? `Gap Δ (VEL − QUAL): ${monoSpan(gapStr, { bold: true })}<br/>VEL &gt; QUAL: ${monoSpan(`${row.velGreaterCount}/${row.n} (${velPctStr})`)}`
        : `Gap Δ: ${monoSpan(gapStr, { bold: true })} · VEL &gt; QUAL: ${velPctStr}`)
  );
}

function renderConstructDumbbellShapes(params: {
  coord: (value: [number, number]) => number[];
  row: ConstructDumbbellRow;
  yIdx: number;
  dimmed: boolean;
  variant: 'compact' | 'full';
}): Record<string, unknown>[] {
  const { coord, row, yIdx, dimmed, variant } = params;
  const style = CONSTRUCT_RENDER_STYLES[variant];
  const opacity = dimmed ? 0.3 : 1;
  const cy = coord([1.0, yIdx])[1];
  const children: Record<string, unknown>[] = [];

  if (row.cQualMedian !== null && row.cVelMedian !== null) {
    const ptQ = coord([row.cQualMedian, yIdx]);
    const ptV = coord([row.cVelMedian, yIdx]);
    const x1 = Math.min(ptQ[0], ptV[0]);
    const x2 = Math.max(ptQ[0], ptV[0]);
    const gapVal = row.gap ?? 0;
    const sign = gapVal >= 0 ? '+' : '';
    const tooNarrow = Math.abs(ptV[0] - ptQ[0]) < style.narrowThreshold;

    children.push(
      {
        type: 'line',
        shape: { x1, y1: cy, x2, y2: cy },
        style: {
          stroke: gapVal >= 0 ? '#94A3B8' : style.negativeGapColor,
          lineWidth: style.lineWidth,
          lineCap: 'round',
          opacity: dimmed ? 0.25 : style.lineDefaultOpacity,
        },
      },
      {
        type: 'text',
        style: {
          text: `${style.deltaPrefix}${sign}${fmtNum(gapVal, 2)}`,
          x: tooNarrow ? x2 + style.deltaOffsetX : (ptQ[0] + ptV[0]) / 2,
          y: tooNarrow ? cy : cy - style.deltaOffsetY,
          textAlign: tooNarrow ? 'left' : 'center',
          textVerticalAlign: tooNarrow ? 'middle' : 'bottom',
          fill: COLORS.textPrimary,
          font: style.deltaFont,
          opacity,
        },
      }
    );
  }

  if (row.cQualMedian !== null) {
    const ptQ = coord([row.cQualMedian, yIdx]);
    children.push({
      type: 'circle',
      shape: { cx: ptQ[0], cy, r: style.circleR },
      style: { fill: COLORS.success, stroke: '#FFFFFF', lineWidth: 1.5, opacity },
    });
  }

  if (row.cVelMedian !== null) {
    const ptV = coord([row.cVelMedian, yIdx]);
    children.push({
      type: 'polygon',
      shape: { points: drawDiamondPoints(ptV[0], cy, style.diamondR) },
      style: { fill: COLORS.primary, stroke: '#FFFFFF', lineWidth: 1.5, opacity },
    });
  }

  return children;
}

/**
 * Constrói opção ECharts para o painel compacto Dumbbell de construtos (C_QUAL vs C_VEL).
 */
export function buildConstructDumbbellOption(params: {
  constructRows: ConstructDumbbellRow[];
  selectedSeniorities?: SeniorityLevel[];
}): EChartsOption {
  const { constructRows, selectedSeniorities = [] } = params;
  const ordered = [...constructRows].reverse();
  const hasSelection = selectedSeniorities.length > 0;

  const seriesData = ordered.map((row, idx) => {
    const selected = row.seniority !== null && selectedSeniorities.includes(row.seniority);
    const dimmed = hasSelection && row.seniority !== null && !selected;
    const clickTarget: ClickTargetPayload = row.seniority
      ? { kind: 'seniority', value: row.seniority }
      : { kind: 'noop' };

    return {
      value: [idx, row.cQualMedian ?? -1, row.cVelMedian ?? -1, row.gap ?? 0],
      seniority: row.seniority,
      row,
      dimmed,
      selected,
      clickTarget,
      itemStyle: { opacity: dimmed ? 0.3 : 1 },
    };
  });

  return {
    legend: { show: false },
    tooltip: {
      trigger: 'item',
      confine: true,
      formatter: (rawParams: unknown) => {
        const p = rawParams as { data?: { row?: ConstructDumbbellRow } };
        return p.data?.row ? formatConstructDumbbellTooltip(p.data.row, true) : '';
      },
    },
    grid: { left: 8, right: 10, top: 18, bottom: 24, containLabel: true },
    xAxis: { type: 'value', min: 1.0, max: 5.05, interval: 1, axisLabel: makeMonoAxisLabel(10), splitLine: SPLIT_LINE_STYLE },
    yAxis: [
      {
        type: 'category',
        position: 'left',
        data: ordered.map((r) => r.label),
        axisLabel: makeSansAxisLabel(11, { fontWeight: 600 }),
        axisTick: { show: false },
        axisLine: AXIS_LINE_STYLE,
      },
      {
        type: 'category',
        position: 'right',
        data: ordered.map((r) => (r.n > 0 ? `n=${r.n} · ${fmtPct(r.velGreaterPct, 0)}` : 'n=0')),
        axisLabel: makeMonoAxisLabel(10, COLORS.textSecondary),
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
          const yIdx = Number(api.value(0));
          const leftPt = api.coord([1.0, yIdx]);
          const rightPt = api.coord([5.05, yIdx]);

          const hitArea: Record<string, unknown> = {
            type: 'rect',
            shape: { x: leftPt[0], y: leftPt[1] - 16, width: Math.max(10, rightPt[0] - leftPt[0]), height: 32 },
            style: { fill: 'rgba(0,0,0,0.001)' },
          };
          const shapes = renderConstructDumbbellShapes({
            coord: (v) => api.coord(v),
            row: item.row,
            yIdx,
            dimmed: item.dimmed,
            variant: 'compact',
          });

          return { type: 'group', children: [hitArea, ...shapes] as never[] };
        },
        data: seriesData,
      },
    ],
  };
}

type FullDumbbellEntry =
  | { kind: 'construct'; label: string; row: ConstructDumbbellRow }
  | { kind: 'item'; label: string; row: ItemDumbbellRow };

/**
 * Constrói opção ECharts para o perfil completo Dumbbell (construtos + itens individuais Jr+Pl vs Sr).
 */
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
        if (entry.kind === 'construct') return formatConstructDumbbellTooltip(entry.row, false);
        const it = entry.row;
        return tooltipCard(
          `<strong>${it.itemId} — ${escapeHtml(it.shortLabel)}</strong><br/>Mediana Geral: ${monoSpan(fmtNum(it.overallMedian, 2), { bold: true })} (n = ${it.nValid} · ≥4: ${fmtPct(it.agreementPct, 1)})<br/>Mediana Jr+Pl: ${monoSpan(fmtNum(it.jrPlMedian, 2), { bold: true, color: COLORS.warning })} · Mediana Sênior: ${monoSpan(fmtNum(it.srMedian, 2), { bold: true, color: COLORS.primary })}`,
          290
        );
      },
    },
    grid: { left: 8, right: 24, top: 14, bottom: 26, containLabel: true },
    xAxis: { type: 'value', min: 1.0, max: 5.05, interval: 0.5, axisLabel: makeMonoAxisLabel(10), splitLine: SPLIT_LINE_STYLE },
    yAxis: {
      type: 'category',
      data: ordered.map((e) => e.label),
      axisLabel: makeSansAxisLabel(10.5, { width: 240, overflow: 'truncate' }),
      axisTick: { show: false },
      axisLine: AXIS_LINE_STYLE,
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
            const ptBase = api.coord([1.0, idx]);
            const ptRight = api.coord([5.05, idx]);
            const children: Record<string, unknown>[] = [];

            if (itemRows.length > 0 && cbParams.dataIndex === itemRows.length) {
              const bandSize = api.size ? api.size([0, 1]) : [0, 22];
              const rawBandH = Array.isArray(bandSize) ? bandSize[1] : bandSize;
              const bandH = typeof rawBandH === 'number' && rawBandH > 0 ? rawBandH : 22;
              const divY = ptBase[1] + bandH / 2;
              children.push({
                type: 'line',
                shape: { x1: ptBase[0], y1: divY, x2: ptRight[0], y2: divY },
                style: { stroke: COLORS.border, lineWidth: 1.2, lineDash: [4, 3] },
              });
            }

            children.push(
              ...renderConstructDumbbellShapes({
                coord: (v) => api.coord(v),
                row: entry.row,
                yIdx: idx,
                dimmed: false,
                variant: 'full',
              })
            );
            return { type: 'group', children: children as never[] };
          }

          const it = entry.row;
          const cy = api.coord([1.0, idx])[1];
          const children: Record<string, unknown>[] = [];

          if (it.jrPlMedian !== null && it.srMedian !== null) {
            const ptJ = api.coord([it.jrPlMedian, idx]);
            const ptS = api.coord([it.srMedian, idx]);
            children.push({
              type: 'line',
              shape: { x1: Math.min(ptJ[0], ptS[0]), y1: cy, x2: Math.max(ptJ[0], ptS[0]), y2: cy },
              style: { stroke: '#CBD5E1', lineWidth: 3, lineCap: 'round' },
            });
          }
          if (it.overallMedian !== null) {
            const ptO = api.coord([it.overallMedian, idx]);
            children.push({ type: 'line', shape: { x1: ptO[0], y1: cy - 6, x2: ptO[0], y2: cy + 6 }, style: { stroke: COLORS.textPrimary, lineWidth: 2 } });
          }
          if (it.jrPlMedian !== null) {
            children.push({ type: 'circle', shape: { cx: api.coord([it.jrPlMedian, idx])[0], cy, r: 4.8 }, style: { fill: COLORS.warning, stroke: '#FFFFFF', lineWidth: 1.2 } });
          }
          if (it.srMedian !== null) {
            children.push({ type: 'circle', shape: { cx: api.coord([it.srMedian, idx])[0], cy, r: 4.8 }, style: { fill: COLORS.primary, stroke: '#FFFFFF', lineWidth: 1.2 } });
          }

          return { type: 'group', children: children as never[] };
        },
        data: ordered.map((entry, idx) => ({
          value: [idx],
          entry,
          clickTarget:
            entry.kind === 'construct' && entry.row.seniority
              ? ({ kind: 'seniority', value: entry.row.seniority } satisfies ClickTargetPayload)
              : ({ kind: 'noop' } satisfies ClickTargetPayload),
        })),
      },
    ],
  };
}

// ---------- 2. 4-Stage Sankey Option Builder ----------

/**
 * Constrói opção ECharts para o diagrama Sankey de 4 estágios com realce por filtro ativo.
 */
export function buildSankeyOption(params: {
  graph: SankeyGraphData;
  activeBiFilter?: Partial<Pick<BiFilterState, 'seniorities' | 'tools' | 'mRevTiers' | 'cQualTiers'>>;
  compact?: boolean;
}): EChartsOption {
  const { graph, activeBiFilter, compact = false } = params;
  const nodeMap = new Map(graph.nodes.map((n) => [n.name, n]));

  const isStageFiltered = {
    seniority: Boolean(activeBiFilter?.seniorities?.length),
    tool: Boolean(activeBiFilter?.tools?.length),
    mRevTier: Boolean(activeBiFilter?.mRevTiers?.length),
    cQualTier: Boolean(activeBiFilter?.cQualTiers?.length),
  };

  const nodes = graph.nodes.map((node) => {
    const t = node.clickTarget;
    const selected =
      (t.kind === 'seniority' && Boolean(activeBiFilter?.seniorities?.includes(t.value))) ||
      (t.kind === 'tool' && Boolean(activeBiFilter?.tools?.includes(t.value))) ||
      (t.kind === 'mRevTier' && Boolean(activeBiFilter?.mRevTiers?.includes(t.value as OrdinalTierId))) ||
      (t.kind === 'cQualTier' && Boolean(activeBiFilter?.cQualTiers?.includes(t.value as OrdinalTierId)));

    const dimmed = isStageFiltered[node.stage] && !selected && t.kind !== 'noop';

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
        const p = rawParams as { dataType?: string; data?: Partial<SankeyNodeDatum & SankeyLinkDatum> };
        if (p.dataType === 'edge' && p.data?.source && p.data?.target) {
          const srcLabel = nodeMap.get(p.data.source)?.displayLabel ?? p.data.source;
          const tgtLabel = nodeMap.get(p.data.target)?.displayLabel ?? p.data.target;
          return tooltipCard(
            `<strong>${escapeHtml(srcLabel)} → ${escapeHtml(tgtLabel)}</strong><br/>Fluxo: ${monoSpan(String(p.data.value ?? 0), { bold: true })} respondente(s)`
          );
        }
        const node = p.data as SankeyNodeDatum | undefined;
        if (!node?.name) return '';
        const resolved = nodeMap.get(node.name);
        const label = node.displayLabel || resolved?.displayLabel || node.name;
        const count = node.count ?? resolved?.count ?? 0;
        const pct = graph.totalRespondents > 0 ? (count / graph.totalRespondents) * 100 : 0;
        return tooltipCard(
          `<strong>${escapeHtml(label)}</strong><br/>Respondentes: ${monoSpan(String(count), { bold: true })} (${monoSpan(fmtPct(pct, 1))})`
        );
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
        emphasis: { focus: 'adjacency' },
        lineStyle: { color: 'gradient', curveness: 0.5, opacity: 0.32 },
        label: {
          ...makeSansAxisLabel(compact ? 10 : 11, { fontWeight: 600 }),
          formatter: (cbParams: unknown) => {
            const p = cbParams as { name?: string; data?: SankeyNodeDatum };
            const resolved = p.name ? nodeMap.get(p.name) : undefined;
            const count = p.data?.count ?? resolved?.count;
            const clean = p.data?.displayLabel ?? resolved?.displayLabel ?? (p.name ?? '');
            return count !== undefined ? `${clean} (${count})` : clean;
          },
        },
      },
    ],
  };
}

// ---------- 3. Paired Butterfly Theme Chart Builder ----------

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

/**
 * Constrói opção ECharts para o gráfico Butterfly pareado de Riscos vs Benefícios.
 */
export function buildPairedThemeButterflyOption(params: {
  riskThemes: ButterflyThemeInput[];
  benefitThemes: ButterflyThemeInput[];
  selectedRiskThemes?: string[];
  selectedBenefitThemes?: string[];
  compact?: boolean;
}): EChartsOption {
  const { riskThemes, benefitThemes, selectedRiskThemes = [], selectedBenefitThemes = [], compact = false } = params;

  const rowCount = Math.max(riskThemes.length, benefitThemes.length, 5);
  const ordered = Array.from({ length: rowCount }, (_, rankIdx) => ({
    rank: rankIdx + 1,
    risk: riskThemes[rankIdx] ?? null,
    benefit: benefitThemes[rankIdx] ?? null,
  })).reverse();

  let maxCount = 1;
  for (const pair of ordered) {
    if (pair.risk && pair.risk.count > maxCount) maxCount = pair.risk.count;
    if (pair.benefit && pair.benefit.count > maxCount) maxCount = pair.benefit.count;
  }
  const axisBound = Math.max(2, Math.ceil(maxCount * 1.25));

  const mapButterflyData = (side: 'risk' | 'benefit') => {
    const selectedIds = side === 'risk' ? selectedRiskThemes : selectedBenefitThemes;
    const hasFilter = selectedIds.length > 0;
    const color = side === 'risk' ? COLORS.danger : COLORS.success;
    const borderRadius = side === 'risk' ? [4, 0, 0, 4] : [0, 4, 4, 0];

    return ordered.map((pair) => {
      const theme = side === 'risk' ? pair.risk : pair.benefit;
      if (!theme) return null;
      const isSelected = theme.selected ?? selectedIds.includes(theme.id);
      const dimmed = theme.dimmed ?? (hasFilter && !isSelected);
      return {
        value: side === 'risk' ? -theme.count : theme.count,
        theme,
        rank: pair.rank,
        clickTarget: {
          kind: side === 'risk' ? ('riskTheme' as const) : ('benefitTheme' as const),
          themeId: theme.id,
          label: theme.label,
        },
        itemStyle: {
          color,
          opacity: dimmed ? 0.35 : 0.92,
          borderColor: isSelected ? '#142027' : 'transparent',
          borderWidth: isSelected ? 1.5 : 0,
          borderRadius,
        },
      };
    });
  };

  const countFormatter = (cbParams: unknown) => {
    const p = cbParams as { data?: { theme?: ButterflyThemeInput } };
    return p.data?.theme ? String(p.data.theme.count) : '';
  };

  return {
    tooltip: {
      trigger: 'item',
      confine: true,
      formatter: (rawParams: unknown) => {
        const p = rawParams as { seriesIndex?: number; data?: { theme?: ButterflyThemeInput; rank?: number } };
        const t = p.data?.theme;
        if (!t) return '';
        const kindLabel = p.seriesIndex === 0 ? 'Risco (ITEM_21)' : 'Benefício (ITEM_22)';
        const pctVal = t.pctOfAnswered ?? t.pct ?? t.pctOfTotalValid;
        return tooltipCard(
          `<strong>${kindLabel} · ${p.data?.rank ?? ''}º lugar</strong><br/><strong>${escapeHtml(t.label)}</strong><br/>` +
            (t.description ? `<span style="color:#5C6D75;font-size:11px;">${escapeHtml(t.description)}</span><br/>` : '') +
            `Menções: ${monoSpan(String(t.count), { bold: true })}` +
            (pctVal !== undefined ? ` (${monoSpan(fmtPct(pctVal, 1))})` : ''),
          290
        );
      },
    },
    legend: {
      top: 0,
      left: 'center',
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { fontFamily: FONT_SANS, fontSize: compact ? 10 : 11, color: COLORS.textSecondary },
    },
    grid: { left: 6, right: 6, top: compact ? 26 : 32, bottom: 20, containLabel: true },
    xAxis: {
      type: 'value',
      min: -axisBound,
      max: axisBound,
      minInterval: 1,
      axisLabel: { ...makeMonoAxisLabel(10), formatter: (v: number) => String(Math.abs(Math.round(v))) },
      splitLine: SPLIT_LINE_STYLE,
    },
    yAxis: (['left', 'right'] as const).map((position) => ({
      type: 'category' as const,
      position,
      data: ordered.map((pair) => (position === 'left' ? pair.risk?.label : pair.benefit?.label) ?? `${pair.rank}º`),
      axisLabel: makeSansAxisLabel(compact ? 10 : 11, { width: compact ? 115 : 175, overflow: 'truncate' }),
      axisTick: { show: false },
      axisLine: AXIS_LINE_STYLE,
    })),
    series: [
      {
        name: 'Riscos (ITEM_21)',
        type: 'bar',
        stack: 'butterfly',
        yAxisIndex: 0,
        barMaxWidth: compact ? 16 : 20,
        data: mapButterflyData('risk'),
        label: { show: true, position: 'left', fontFamily: FONT_MONO, fontSize: 10, color: COLORS.danger, formatter: countFormatter },
      },
      {
        name: 'Benefícios (ITEM_22)',
        type: 'bar',
        stack: 'butterfly',
        yAxisIndex: 0,
        barMaxWidth: compact ? 16 : 20,
        data: mapButterflyData('benefit'),
        label: { show: true, position: 'right', fontFamily: FONT_MONO, fontSize: 10, color: COLORS.success, formatter: countFormatter },
        markLine: { silent: true, symbol: 'none', lineStyle: { color: COLORS.textPrimary, width: 1.4 }, label: { show: false }, data: [{ xAxis: 0 }] },
      },
    ],
  };
}

// ---------- 4. Profile Facet Single-Dimension Bar Option ----------

export interface BuildProfileFacetBarsParams {
  dimensionLabel: string;
  items: BiFacetBarItem[];
  dimensionKind: 'seniority' | 'tool' | 'frequency';
  resolveColor?: (id: string) => string;
}

/**
 * Constrói opção ECharts de barras horizontais para a visualização detalhada do Painel 1 (SEN/TOOL/USO).
 */
export function buildProfileFacetBarsOption(params: BuildProfileFacetBarsParams): EChartsOption {
  const { dimensionLabel, items, dimensionKind, resolveColor } = params;
  const colorFn =
    resolveColor ??
    ((id: string) =>
      dimensionKind === 'seniority'
        ? SENIORITY_COLORS[id as SeniorityLevel] ?? COLORS.primary
        : dimensionKind === 'frequency'
          ? COLORS.success
          : COLORS.primary);

  const ordered = [...items].reverse();
  const maxCount = Math.max(1, ...ordered.map((d) => d.count));

  return {
    tooltip: {
      trigger: 'item',
      confine: true,
      formatter: (rawParams: unknown) => {
        const p = rawParams as { data?: { item?: BiFacetBarItem } };
        const item = p.data?.item;
        if (!item) return '';
        return tooltipCard(
          `<strong>${escapeHtml(dimensionLabel)}: ${escapeHtml(item.label)}</strong><br/>Respondentes (leave-one-out): ${monoSpan(String(item.count), { bold: true })} (${monoSpan(fmtPct(item.pct, 1))})`
        );
      },
    },
    grid: { left: 6, right: 48, top: 8, bottom: 16, containLabel: true },
    xAxis: { type: 'value', min: 0, max: Math.ceil(maxCount * 1.15), minInterval: 1, axisLabel: makeMonoAxisLabel(10), splitLine: SPLIT_LINE_STYLE },
    yAxis: {
      type: 'category',
      data: ordered.map((d) => d.label),
      axisLabel: makeSansAxisLabel(10.5, { width: 118, overflow: 'truncate' }),
      axisTick: { show: false },
      axisLine: AXIS_LINE_STYLE,
    },
    series: [
      {
        type: 'bar',
        barMaxWidth: 20,
        data: ordered.map((d) => {
          const clickTarget: ClickTargetPayload =
            dimensionKind === 'seniority'
              ? { kind: 'seniority', value: d.id as SeniorityLevel }
              : dimensionKind === 'tool'
                ? { kind: 'tool', value: d.id }
                : { kind: 'frequency', value: d.id };
          return {
            value: d.count,
            item: d,
            clickTarget,
            itemStyle: {
              color: colorFn(d.id),
              opacity: d.dimmed ? 0.35 : 0.92,
              borderColor: d.selected ? '#142027' : 'transparent',
              borderWidth: d.selected ? 1.5 : 0,
              borderRadius: [0, 4, 4, 0],
            },
          };
        }),
        label: {
          show: true,
          position: 'right',
          fontFamily: FONT_MONO,
          fontSize: 10,
          color: COLORS.textSecondary,
          formatter: (cbParams: unknown) => {
            const p = cbParams as { data?: { item?: BiFacetBarItem } };
            const item = p.data?.item;
            return item ? `${item.count} (${fmtPct(item.pct, 0)})` : '';
          },
        },
      },
    ],
  };
}
