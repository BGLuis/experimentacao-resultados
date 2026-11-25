import { useMemo, useState } from 'react';
import type { EChartsOption } from 'echarts';
import { ChevronDown, ChevronRight, Lock, Layers } from 'lucide-react';
import type {
  GroupSummary,
  KruskalWallisResult,
  MannWhitneyResult,
  SeniorityLevel,
  SurveyAnalysisResult,
} from '../stats/types';
import { EChart } from '../components/EChart';
import { Badge, Callout, SectionHeader } from '../components/UiPrimitives';
import {
  COLORS,
  SENIORITY_COLORS,
  fmtCI,
  fmtNum,
  fmtPValue,
} from '../utils/format';

interface ConfirmatoryPageProps {
  result: SurveyAnalysisResult;
  hasActiveFilter: boolean;
}

function deterministicJitter(seed: number, amplitude: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  const frac = x - Math.floor(x);
  return (frac * 2 - 1) * amplitude;
}

function buildBoxplotWithJitterOption(
  title: string,
  groups: GroupSummary[],
  colorMap: Record<string, string>
): EChartsOption {
  const categories = groups.map((g) => `${g.group} (n=${g.n})`);

  const boxData = groups.map((g) => [
    g.min ?? 0,
    g.q1 ?? 0,
    g.median ?? 0,
    g.q3 ?? 0,
    g.max ?? 0,
  ]);

  const scatterData: Array<{ value: [number, number]; itemStyle: { color: string } }> = [];
  groups.forEach((g, gIdx) => {
    const col = colorMap[g.group] ?? COLORS.primary;
    g.values.forEach((v, i) => {
      const jitter = deterministicJitter(gIdx * 100 + i + 1, 0.16);
      scatterData.push({
        value: [gIdx + jitter, v],
        itemStyle: { color: col },
      });
    });
  });

  return {
    title: {
      text: title,
      left: 8,
      top: 0,
      textStyle: { fontFamily: 'IBM Plex Sans', fontSize: 13, fontWeight: 600, color: COLORS.textPrimary },
    },
    tooltip: {
      trigger: 'item',
      formatter: (params: unknown) => {
        const p = params as { seriesType: string; dataIndex: number; value: number[] };
        if (p.seriesType === 'boxplot') {
          const g = groups[p.dataIndex];
          if (!g) return '';
          return `<div style="font-family:'IBM Plex Sans',sans-serif;font-size:12px;">
            <strong>${g.group} (n = ${g.n})</strong><br/>
            Máx: <span class="font-mono">${fmtNum(g.max, 2)}</span> · Q3: ${fmtNum(g.q3, 2)}<br/>
            Mediana: <strong>${fmtNum(g.median, 2)}</strong> · MAD: ${fmtNum(g.mad, 2)}<br/>
            Q1: ${fmtNum(g.q1, 2)} · Mín: ${fmtNum(g.min, 2)}
          </div>`;
        }
        return `<div style="font-family:'IBM Plex Sans',sans-serif;font-size:12px;">
          Escore individual: <strong style="font-family:'IBM Plex Mono',monospace;">${fmtNum(p.value[1], 2)}</strong>
        </div>`;
      },
    },
    grid: { left: 40, right: 20, top: 38, bottom: 26, containLabel: true },
    xAxis: {
      type: 'category',
      data: categories,
      axisLabel: { fontFamily: 'IBM Plex Sans', fontSize: 11, fontWeight: 600, color: COLORS.textPrimary },
      axisLine: { lineStyle: { color: COLORS.border } },
    },
    yAxis: {
      type: 'value',
      min: 1,
      max: 5.15,
      interval: 1,
      axisLabel: { fontFamily: 'IBM Plex Mono', fontSize: 11, color: COLORS.textMuted },
      splitLine: { lineStyle: { color: '#EDF1EC' } },
    },
    series: [
      {
        name: 'Boxplot',
        type: 'boxplot',
        boxWidth: [24, 48],
        data: boxData,
        itemStyle: {
          color: 'rgba(31, 78, 140, 0.12)',
          borderColor: COLORS.primary,
          borderWidth: 1.8,
        },
      },
      {
        name: 'Respondentes',
        type: 'scatter',
        symbolSize: 7,
        data: scatterData.map((d) => ({
          value: d.value,
          itemStyle: { color: d.itemStyle.color, opacity: 0.8, borderColor: '#FFF', borderWidth: 1 },
        })),
      },
    ],
  };
}

function buildStripMedianMadOption(
  title: string,
  groups: GroupSummary[],
  colorMap: Record<string, string>
): EChartsOption {
  const categories = groups.map((g) => `${g.group} (n=${g.n})`);
  const scatterData: Array<{ value: [number, number]; itemStyle: { color: string } }> = [];
  groups.forEach((g, gIdx) => {
    const col = colorMap[g.group] ?? COLORS.primary;
    g.values.forEach((v, i) => {
      const jitter = deterministicJitter(gIdx * 200 + i + 7, 0.15);
      scatterData.push({
        value: [gIdx + jitter, v],
        itemStyle: { color: col },
      });
    });
  });

  return {
    title: {
      text: title,
      left: 8,
      top: 0,
      textStyle: { fontFamily: 'IBM Plex Sans', fontSize: 13, fontWeight: 600, color: COLORS.textPrimary },
    },
    tooltip: {
      trigger: 'item',
      formatter: (params: unknown) => {
        const p = params as { seriesName: string; dataIndex: number; value: number[] };
        if (p.seriesName === 'Mediana ± MAD') {
          const g = groups[p.dataIndex];
          if (!g) return '';
          return `<div style="font-family:'IBM Plex Sans',sans-serif;font-size:12px;">
            <strong>${g.group} (n = ${g.n})</strong><br/>
            Mediana: <strong style="font-family:'IBM Plex Mono',monospace;">${fmtNum(g.median, 2)}</strong><br/>
            MAD: <span style="font-family:'IBM Plex Mono',monospace;">±${fmtNum(g.mad, 2)}</span>
          </div>`;
        }
        return `<div style="font-family:'IBM Plex Sans',sans-serif;font-size:12px;">
          Escore individual: <strong style="font-family:'IBM Plex Mono',monospace;">${fmtNum(p.value[1], 2)}</strong>
        </div>`;
      },
    },
    grid: { left: 40, right: 20, top: 38, bottom: 26, containLabel: true },
    xAxis: {
      type: 'category',
      data: categories,
      axisLabel: { fontFamily: 'IBM Plex Sans', fontSize: 11, fontWeight: 600, color: COLORS.textPrimary },
      axisLine: { lineStyle: { color: COLORS.border } },
    },
    yAxis: {
      type: 'value',
      min: 1,
      max: 5.15,
      interval: 1,
      axisLabel: { fontFamily: 'IBM Plex Mono', fontSize: 11, color: COLORS.textMuted },
      splitLine: { lineStyle: { color: '#EDF1EC' } },
    },
    series: [
      {
        name: 'Respondentes',
        type: 'scatter',
        symbolSize: 8,
        data: scatterData.map((d) => ({
          value: d.value,
          itemStyle: { color: d.itemStyle.color, opacity: 0.72, borderColor: '#FFF', borderWidth: 1 },
        })),
      },
      {
        name: 'Mediana ± MAD',
        type: 'custom',
        renderItem: (_params, api) => {
          const idx = api.value(0) as number;
          const med = api.value(1) as number;
          const mad = api.value(2) as number;
          const low = Math.max(1, med - mad);
          const high = Math.min(5, med + mad);
          const ptMed = api.coord([idx, med]);
          const ptLow = api.coord([idx, low]);
          const ptHigh = api.coord([idx, high]);

          return {
            type: 'group',
            children: [
              {
                type: 'line',
                shape: { x1: ptLow[0], y1: ptLow[1], x2: ptHigh[0], y2: ptHigh[1] },
                style: { stroke: COLORS.textPrimary, lineWidth: 2.5 },
              },
              {
                type: 'line',
                shape: { x1: ptMed[0] - 18, y1: ptMed[1], x2: ptMed[0] + 18, y2: ptMed[1] },
                style: { stroke: COLORS.textPrimary, lineWidth: 3 },
              },
              {
                type: 'circle',
                shape: { cx: ptMed[0], cy: ptMed[1], r: 5 },
                style: { fill: COLORS.textPrimary, stroke: '#FFFFFF', lineWidth: 1.5 },
              },
            ],
          };
        },
        data: groups.map((g, idx) => [idx, g.median ?? 0, g.mad ?? 0]),
      },
    ],
  };
}

function Qp3TestSummaryCard({
  title,
  mw,
  kw,
}: {
  title: string;
  mw: MannWhitneyResult | null;
  kw: KruskalWallisResult;
}) {
  return (
    <div className="rounded-lg border border-[#D5DDD6] bg-[#FAFBF9] p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#142027]">{title}</h3>
        <Badge variant={(mw?.significant ?? kw.significant) ? 'danger' : 'neutral'}>
          {(mw?.significant ?? kw.significant)
            ? 'Rejeita H₀ (p < 0,025)'
            : 'Não rejeita H₀ (p ≥ 0,025)'}
        </Badge>
      </div>

      {mw && (
        <div className="rounded border border-[#D5DDD6] bg-white p-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold text-[#1F4E8C]">
            <span>
              Mann-Whitney ({mw.groupA} vs {mw.groupB}) — Principal (Seção 5.3)
            </span>
            <span className="font-mono-tabular text-[11px] text-[#5C6D75]">
              n = {mw.nA} vs {mw.nB}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 font-mono-tabular text-xs pt-1">
            <div>
              <div className="text-[10px] uppercase text-[#5C6D75]">U</div>
              <div className="font-semibold text-[#142027]">{fmtNum(mw.u, 1)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-[#5C6D75]">
                p ({mw.pMethod === 'exact' ? 'exato' : 'aprox.'})
              </div>
              <div className="font-semibold text-[#142027]">{fmtPValue(mw.pValue)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-[#5C6D75]">Efeito r</div>
              <div className="font-semibold text-[#142027]">{fmtNum(mw.effectR, 3)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-[#5C6D75]">r_rb</div>
              <div className="font-semibold text-[#142027]">{fmtNum(mw.rankBiserialR, 3)}</div>
            </div>
          </div>
        </div>
      )}

      <div className="rounded border border-[#D5DDD6] bg-white p-3 space-y-1.5">
        <div className="flex items-center justify-between text-xs font-semibold text-[#43535B]">
          <span>Kruskal-Wallis (3 níveis: Jr / Pl / Sr)</span>
          <span className="font-mono-tabular text-[11px] text-[#5C6D75]">n = {kw.n}</span>
        </div>
        <div className="grid grid-cols-3 gap-2 font-mono-tabular text-xs pt-1">
          <div>
            <div className="text-[10px] uppercase text-[#5C6D75]">H</div>
            <div className="font-semibold text-[#142027]">{fmtNum(kw.h, 3)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-[#5C6D75]">p_KW</div>
            <div className="font-semibold text-[#142027]">{fmtPValue(kw.pValue)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-[#5C6D75]">ε² (IC 95%)</div>
            <div className="font-semibold text-[#142027]">
              {fmtNum(kw.epsilonSquared, 3)}
            </div>
            <div className="text-[10px] text-[#5C6D75]">{fmtCI(kw.epsilonSquaredCI, 3)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ConfirmatoryPage({ result, hasActiveFilter }: ConfirmatoryPageProps) {
  const { qp3, qp4, validCount } = result.baseline;
  const [showThreeLevels, setShowThreeLevels] = useState(!qp3.mergeApplied);
  const [showItemTable, setShowItemTable] = useState(false);

  const showingMerged = qp3.mergeApplied && !showThreeLevels;

  const groupColors: Record<string, string> = {
    'Jr+Pl': '#B8721F',
    Júnior: SENIORITY_COLORS.Júnior,
    Pleno: SENIORITY_COLORS.Pleno,
    Sênior: SENIORITY_COLORS.Sênior,
    Sr: SENIORITY_COLORS.Sênior,
  };

  const qp3VelOption = useMemo<EChartsOption>(() => {
    if (showingMerged && qp3.cVelMannWhitneyMerged) {
      return buildBoxplotWithJitterOption(
        'C_VEL — Velocidade (Jr+Pl vs Sênior)',
        qp3.cVelMannWhitneyMerged.groups,
        groupColors
      );
    }
    if (qp3.minGroupSize < 8) {
      return buildStripMedianMadOption(
        'C_VEL — 3 Níveis (Strip Plot + Mediana/MAD, n_g < 8)',
        qp3.cVelKruskalWallis.groups,
        groupColors
      );
    }
    return buildBoxplotWithJitterOption(
      'C_VEL — 3 Níveis (Boxplot + Jitter)',
      qp3.cVelKruskalWallis.groups,
      groupColors
    );
  }, [showingMerged, qp3]);

  const qp3QualOption = useMemo<EChartsOption>(() => {
    if (showingMerged && qp3.cQualMannWhitneyMerged) {
      return buildBoxplotWithJitterOption(
        'C_QUAL — Qualidade (Jr+Pl vs Sênior)',
        qp3.cQualMannWhitneyMerged.groups,
        groupColors
      );
    }
    if (qp3.minGroupSize < 8) {
      return buildStripMedianMadOption(
        'C_QUAL — 3 Níveis (Strip Plot + Mediana/MAD, n_g < 8)',
        qp3.cQualKruskalWallis.groups,
        groupColors
      );
    }
    return buildBoxplotWithJitterOption(
      'C_QUAL — 3 Níveis (Boxplot + Jitter)',
      qp3.cQualKruskalWallis.groups,
      groupColors
    );
  }, [showingMerged, qp3]);

  const scatterOption = useMemo<EChartsOption>(() => {
    const pts = qp4.scatterPoints;
    // Simple OLS trend line on unjittered (mRev, cQual)
    const n = pts.length;
    let trendData: Array<[number, number]> = [];
    if (n >= 2) {
      const meanX = pts.reduce((s, p) => s + p.mRev, 0) / n;
      const meanY = pts.reduce((s, p) => s + p.cQual, 0) / n;
      const num = pts.reduce((s, p) => s + (p.mRev - meanX) * (p.cQual - meanY), 0);
      const den = pts.reduce((s, p) => s + (p.mRev - meanX) ** 2, 0);
      const slope = den > 0 ? num / den : 0;
      const intercept = meanY - slope * meanX;
      const xs = pts.map((p) => p.mRev);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      trendData = [
        [minX, intercept + slope * minX],
        [maxX, intercept + slope * maxX],
      ];
    }

    const seniorities: SeniorityLevel[] = ['Júnior', 'Pleno', 'Sênior'];
    const scatterSeries = seniorities.map((sen) => {
      const subset = pts.filter((p) => p.seniority === sen);
      return {
        name: sen,
        type: 'scatter' as const,
        symbolSize: 10,
        itemStyle: {
          color: SENIORITY_COLORS[sen],
          opacity: 0.85,
          borderColor: '#FFFFFF',
          borderWidth: 1.5,
        },
        data: subset.map((p) => ({
          value: [
            p.mRev + deterministicJitter(p.rowNumber * 3 + 1, 0.08),
            p.cQual + deterministicJitter(p.rowNumber * 7 + 2, 0.05),
          ],
          rawPoint: p,
        })),
      };
    });

    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: unknown) => {
          const p = params as {
            seriesName: string;
            data?: { rawPoint?: (typeof pts)[number] };
          };
          const raw = p.data?.rawPoint;
          if (!raw) return '';
          return `<div style="font-family:'IBM Plex Sans',sans-serif;font-size:12px;">
            <strong>${raw.idLabel} · ${raw.seniority}</strong><br/>
            Ferramenta: ${raw.tool} · ${raw.frequency}<br/>
            M_REV (exato): <strong style="font-family:'IBM Plex Mono',monospace;">${fmtNum(raw.mRev, 2)}</strong><br/>
            C_QUAL (exato): <strong style="font-family:'IBM Plex Mono',monospace;">${fmtNum(raw.cQual, 2)}</strong>
          </div>`;
        },
      },
      legend: {
        top: 0,
        left: 'center',
        textStyle: { fontFamily: 'IBM Plex Sans', fontSize: 11, color: COLORS.textSecondary },
      },
      grid: { left: 26, right: 18, top: 44, bottom: 44, containLabel: true },
      xAxis: {
        type: 'value',
        name: 'M_REV (Rigor de Revisão e Testes)',
        nameLocation: 'middle',
        nameGap: 26,
        nameTextStyle: { fontFamily: 'IBM Plex Sans', fontSize: 11, fontWeight: 600, color: COLORS.textSecondary },
        min: 1.5,
        max: 5.2,
        axisLabel: { fontFamily: 'IBM Plex Mono', fontSize: 11, color: COLORS.textMuted },
        splitLine: { lineStyle: { color: '#EDF1EC' } },
      },
      yAxis: {
        type: 'value',
        name: 'C_QUAL (Qualidade Percebida)',
        nameLocation: 'middle',
        nameGap: 36,
        nameRotate: 90,
        nameTextStyle: { fontFamily: 'IBM Plex Sans', fontSize: 11, fontWeight: 600, color: COLORS.textSecondary },
        min: 1.5,
        max: 5.2,
        axisLabel: { fontFamily: 'IBM Plex Mono', fontSize: 11, color: COLORS.textMuted },
        splitLine: { lineStyle: { color: '#EDF1EC' } },
      },
      series: [
        ...scatterSeries,
        {
          name: 'Tendência linear',
          type: 'line',
          symbol: 'none',
          silent: true,
          lineStyle: { color: COLORS.textPrimary, width: 2, type: 'dashed' },
          data: trendData,
        },
      ],
    };
  }, [qp4]);

  const sensitivityForestOption = useMemo<EChartsOption>(() => {
    const rows = [...qp4.sensitivity].reverse();
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const arr = Array.isArray(params) ? params : [params];
          const first = arr[0] as { dataIndex: number };
          const row = rows[first.dataIndex];
          if (!row) return '';
          return `<div style="font-family:'IBM Plex Sans',sans-serif;font-size:12px;max-width:290px;white-space:normal;">
            <strong>${row.label}</strong><br/>
            <span style="color:#5C6D75;">${row.description}</span><br/>
            ρ = <strong style="font-family:'IBM Plex Mono',monospace;">${fmtNum(row.rho, 3)}</strong> ·
            p = <span style="font-family:'IBM Plex Mono',monospace;">${fmtPValue(row.pValue)}</span><br/>
            IC 95%: <span style="font-family:'IBM Plex Mono',monospace;">${fmtCI(row.ci95, 3)}</span> · ${row.magnitudeLabelPt}
          </div>`;
        },
      },
      grid: { left: 10, right: 28, top: 20, bottom: 26, containLabel: true },
      xAxis: {
        type: 'value',
        min: -1,
        max: 1,
        axisLabel: { fontFamily: 'IBM Plex Mono', fontSize: 11, color: COLORS.textMuted },
        splitLine: { lineStyle: { color: '#EDF1EC' } },
      },
      yAxis: {
        type: 'category',
        data: rows.map((r) => (r.isExploratory ? `${r.label} (Expl.)` : `${r.label} (Princ.)`)),
        axisLabel: {
          fontFamily: 'IBM Plex Sans',
          fontSize: 11,
          color: COLORS.textPrimary,
          width: 215,
          overflow: 'truncate',
        },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: COLORS.border } },
      },
      series: [
        {
          type: 'custom',
          renderItem: (_params, api) => {
            const idx = api.value(0) as number;
            const rho = api.value(1) as number;
            const low = api.value(2) as number;
            const high = api.value(3) as number;
            const isMain = api.value(4) === 1;

            const ptC = api.coord([rho, idx]);
            const ptL = api.coord([low, idx]);
            const ptH = api.coord([high, idx]);
            const color = isMain ? COLORS.primary : '#4B6B8A';

            return {
              type: 'group',
              children: [
                {
                  type: 'line',
                  shape: { x1: ptL[0], y1: ptC[1], x2: ptH[0], y2: ptC[1] },
                  style: { stroke: color, lineWidth: isMain ? 2.5 : 1.8 },
                },
                {
                  type: 'line',
                  shape: { x1: ptL[0], y1: ptC[1] - 5, x2: ptL[0], y2: ptC[1] + 5 },
                  style: { stroke: color, lineWidth: 1.5 },
                },
                {
                  type: 'line',
                  shape: { x1: ptH[0], y1: ptC[1] - 5, x2: ptH[0], y2: ptC[1] + 5 },
                  style: { stroke: color, lineWidth: 1.5 },
                },
                {
                  type: 'circle',
                  shape: { cx: ptC[0], cy: ptC[1], r: isMain ? 6.5 : 5 },
                  style: { fill: color, stroke: '#FFFFFF', lineWidth: 1.5 },
                },
              ],
            };
          },
          data: rows.map((r, idx) => [
            idx,
            r.rho ?? 0,
            r.ci95?.lower ?? r.rho ?? 0,
            r.ci95?.upper ?? r.rho ?? 0,
            r.key === 'main' ? 1 : 0,
          ]),
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: COLORS.textPrimary, type: 'dashed', width: 1.4 },
            label: {
              formatter: 'ρ = 0',
              fontFamily: 'IBM Plex Mono',
              fontSize: 10,
              color: COLORS.textPrimary,
            },
            data: [{ xAxis: 0 }],
          },
        },
      ],
    };
  }, [qp4.sensitivity]);

  const itemHeatmapOption = useMemo<EChartsOption>(() => {
    const revItems = ['ITEM_19', 'ITEM_20'] as const;
    const qualItems = ['ITEM_12', 'ITEM_13', 'ITEM_14', 'ITEM_15', 'ITEM_16', 'ITEM_17'] as const;

    const data = qp4.itemMatrix.map((cell) => {
      const xIdx = qualItems.indexOf(cell.qualityItem);
      const yIdx = revItems.indexOf(cell.reviewItem);
      return {
        value: [xIdx, yIdx, Number((cell.rho ?? 0).toFixed(3))],
        cell,
      };
    });

    return {
      tooltip: {
        position: 'top',
        formatter: (params: unknown) => {
          const p = params as { data?: { cell?: (typeof qp4.itemMatrix)[number] } };
          const c = p.data?.cell;
          if (!c) return '';
          return `<div style="font-family:'IBM Plex Sans',sans-serif;font-size:12px;">
            <strong>${c.reviewItem} × ${c.qualityItem}</strong><br/>
            Spearman ρ: <strong style="font-family:'IBM Plex Mono',monospace;">${fmtNum(c.rho, 3)}</strong><br/>
            p bruto: <span style="font-family:'IBM Plex Mono',monospace;">${fmtPValue(c.pValue)}</span><br/>
            p Bonferroni (12 pares): <span style="font-family:'IBM Plex Mono',monospace;">${fmtPValue(c.pBonferroni)}</span><br/>
            n = ${c.n}
          </div>`;
        },
      },
      grid: { left: 8, right: 14, top: 14, bottom: 52, containLabel: true },
      xAxis: {
        type: 'category',
        data: qualItems.map((q) => q.replace('ITEM_', 'I')),
        axisLabel: {
          interval: 0,
          fontFamily: 'IBM Plex Mono',
          fontSize: 10,
          fontWeight: 600,
          color: COLORS.textPrimary,
        },
        splitArea: { show: true },
      },
      yAxis: {
        type: 'category',
        data: ['I19 (Revisão)', 'I20 (Testes)'],
        axisLabel: {
          interval: 0,
          fontFamily: 'IBM Plex Sans',
          fontSize: 11,
          color: COLORS.textPrimary,
        },
        splitArea: { show: true },
      },
      visualMap: {
        min: -0.7,
        max: 0.7,
        calculable: false,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        inRange: {
          color: ['#B83B3B', '#E08B6B', '#F4F6F3', '#5B9BD5', '#1F4E8C'],
        },
        textStyle: { fontFamily: 'IBM Plex Mono', fontSize: 10, color: COLORS.textSecondary },
      },
      series: [
        {
          name: 'Correlação Item × Item',
          type: 'heatmap',
          data,
          label: {
            show: true,
            fontFamily: 'IBM Plex Mono',
            fontSize: 10,
            color: COLORS.textPrimary,
            formatter: (params: unknown) => {
              const p = params as { data?: { cell?: (typeof qp4.itemMatrix)[number] } };
              const c = p.data?.cell;
              if (!c || c.rho === null) return '—';
              return `${fmtNum(c.rho, 2)}${c.significantBonferroni ? '*' : ''}`;
            },
          },
          emphasis: {
            itemStyle: { shadowBlur: 6, shadowColor: 'rgba(20, 32, 39, 0.25)' },
          },
        },
      ],
    };
  }, [qp4.itemMatrix]);

  return (
    <div className="space-y-6">
      {hasActiveFilter && (
        <Callout tone="info" title={`Amostra Confirmatória Ancorada (n = ${validCount})`}>
          <div className="flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-[#1F4E8C]" />
            <span>
              Os filtros globais estão ativos nas abas descritivas/exploratórias, mas{' '}
              <strong>QP3 e QP4 permanecem travadas na amostra válida integral</strong> (sem subanálises confirmatórias post-hoc) conforme o protocolo pré-registrado.
            </span>
          </div>
        </Callout>
      )}

      {/* QP3 Section */}
      <section className="card-editorial p-5 space-y-5">
        <SectionHeader
          title="QP3 — Diferenças por Senioridade em Velocidade (C_VEL) e Qualidade (C_QUAL)"
          subtitle="Família de 2 testes com correção de Bonferroni (α = 0,025 por construto). Regra Seção 5.3 para grupos pequenos."
          badge={{ label: 'Confirmatória · α = 0,025 (Bonferroni)', variant: 'confirmatory' }}
          rightSlot={
            qp3.mergeApplied ? (
              <button
                type="button"
                onClick={() => setShowThreeLevels((prev) => !prev)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#1F4E8C] bg-white px-3 py-1.5 text-xs font-semibold text-[#1F4E8C] hover:bg-[#E8EFF8]"
              >
                <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                {showThreeLevels
                  ? 'Voltar à visão principal fundida (Jr+Pl vs Sr)'
                  : 'Inspecionar 3 níveis separados (Jr / Pl / Sr)'}
              </button>
            ) : undefined
          }
        />

        {qp3.mergeApplied && (
          <Callout
            tone="warning"
            title="Regra de Fusão de Grupos Ativada (Seção 5.3)"
          >
            {qp3.mergeRuleDescription} — Tamanhos observados: Júnior ={' '}
            <strong className="font-mono-tabular">{qp3.groupCounts.Júnior}</strong>, Pleno ={' '}
            <strong className="font-mono-tabular">{qp3.groupCounts.Pleno}</strong>, Sênior ={' '}
            <strong className="font-mono-tabular">{qp3.groupCounts.Sênior}</strong> (mínimo exigido por nível:{' '}
            <strong className="font-mono-tabular">{qp3.minRequiredPerGroup}</strong>). Visão principal utiliza{' '}
            <strong>Mann-Whitney U (Jr+Pl vs Sênior)</strong>; Kruskal-Wallis nos 3 níveis é mantido para transparência.
          </Callout>
        )}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <div className="rounded-lg border border-[#D5DDD6] bg-white p-3">
            <EChart
              option={qp3VelOption}
              height={310}
              ariaLabel="Comparação de C_VEL por nível de senioridade"
            />
          </div>
          <div className="rounded-lg border border-[#D5DDD6] bg-white p-3">
            <EChart
              option={qp3QualOption}
              height={310}
              ariaLabel="Comparação de C_QUAL por nível de senioridade"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Qp3TestSummaryCard
            title="C_VEL (Velocidade Percebida)"
            mw={qp3.cVelMannWhitneyMerged}
            kw={qp3.cVelKruskalWallis}
          />
          <Qp3TestSummaryCard
            title="C_QUAL (Qualidade Percebida)"
            mw={qp3.cQualMannWhitneyMerged}
            kw={qp3.cQualKruskalWallis}
          />
        </div>

        {/* Expandable Item-by-Item QP3 Table */}
        <div className="rounded-lg border border-[#D5DDD6] bg-[#FAFBF9]">
          <button
            type="button"
            onClick={() => setShowItemTable((prev) => !prev)}
            aria-expanded={showItemTable}
            className="flex w-full items-center justify-between px-4 py-2.5 text-left text-xs font-semibold text-[#142027] hover:bg-[#EDF1EC]"
          >
            <span>Tabela expansível item a item (ITEM_08–17 · consulta / fallback Bonferroni)</span>
            {showItemTable ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>

          {showItemTable && (
            <div className="overflow-x-auto border-t border-[#D5DDD6] bg-white">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[#D5DDD6] bg-[#EDF1EC] text-[11px] font-semibold uppercase tracking-wider text-[#43535B]">
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2">Construto</th>
                    <th className="px-3 py-2 text-right">MW U (Jr+Pl vs Sr)</th>
                    <th className="px-3 py-2 text-right">p (MW)</th>
                    <th className="px-3 py-2 text-right">Efeito r</th>
                    <th className="px-3 py-2 text-right">KW H (3 níveis)</th>
                    <th className="px-3 py-2 text-right">p (KW)</th>
                    <th className="px-3 py-2 text-right">ε²</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EDF1EC]">
                  {qp3.itemLevelFallback.map((row) => (
                    <tr key={row.itemId} className="hover:bg-[#F8FAF8]">
                      <td className="px-3 py-2 font-medium text-[#142027]">
                        <span className="font-mono-tabular font-semibold text-[#1F4E8C]">{row.itemId}</span>{' '}
                        — {row.shortLabel}
                      </td>
                      <td className="px-3 py-2 font-mono-tabular text-[#5C6D75]">{row.construct}</td>
                      <td className="px-3 py-2 text-right font-mono-tabular">
                        {fmtNum(row.mannWhitneyMerged?.u, 1)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono-tabular">
                        {fmtPValue(row.mannWhitneyMerged?.pValue)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono-tabular">
                        {fmtNum(row.mannWhitneyMerged?.effectR, 3)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono-tabular">
                        {fmtNum(row.kruskalWallis?.h, 3)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono-tabular">
                        {fmtPValue(row.kruskalWallis?.pValue)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono-tabular">
                        {fmtNum(row.kruskalWallis?.epsilonSquared, 3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* QP4 Section */}
      <section className="card-editorial p-5 space-y-5">
        <SectionHeader
          title="QP4 — Correlação entre Rigor de Revisão/Testes (M_REV) e Qualidade Percebida (C_QUAL)"
          subtitle="Correlação de Spearman bicaudal (H0: ρ = 0), com análise de sensibilidade e matriz item a item."
          badge={{ label: 'Confirmatória · α = 0,05', variant: 'confirmatory' }}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card-subtle p-3.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#5C6D75]">
              Spearman ρ (n = {qp4.main.n})
            </div>
            <div className="mt-1 font-mono-tabular text-2xl font-bold text-[#142027]">
              {fmtNum(qp4.main.rho, 3)}
            </div>
            <div className="text-xs text-[#43535B]">
              IC 95% Bootstrap: <span className="font-mono-tabular">{fmtCI(qp4.main.ci95, 3)}</span>
            </div>
          </div>

          <div className="card-subtle p-3.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#5C6D75]">
              Significância (α = 0,05)
            </div>
            <div className="mt-1 font-mono-tabular text-2xl font-bold text-[#142027]">
              p = {fmtPValue(qp4.main.pValue)}
            </div>
            <div className="mt-1">
              <Badge variant={qp4.main.significant ? 'danger' : 'neutral'}>
                {qp4.main.significant ? 'Rejeita H₀ (p < 0,05)' : 'Não rejeita H₀ (p ≥ 0,05)'}
              </Badge>
            </div>
          </div>

          <div className="card-subtle p-3.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#5C6D75]">
              Magnitude (Cohen)
            </div>
            <div className="mt-1 text-xl font-bold text-[#1F4E8C]">{qp4.main.magnitudeLabelPt}</div>
            <div className="text-[11px] text-[#5C6D75]">
              Limiares: 0,10 fraco · 0,30 moderado · 0,50 forte
            </div>
          </div>

          <div className="rounded-lg border border-[#E8CAA0] bg-[#FBF2E4] p-3.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#8E5512]">
              Regra de Interpretação
            </div>
            <div className="mt-1 text-sm font-bold text-[#142027]">
              Correlação não implica causalidade
            </div>
            <p className="mt-0.5 text-[11px] text-[#43535B]">
              {qp4.note}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="rounded-lg border border-[#D5DDD6] bg-white p-3 xl:col-span-7">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2 px-1">
              <h3 className="text-sm font-semibold text-[#142027]">
                Scatterplot M_REV × C_QUAL (por Senioridade)
              </h3>
              <span className="text-[11px] text-[#5C6D75]">
                Leve jitter determinístico para evitar sobreposição; tooltip mostra valores exatos
              </span>
            </div>
            <EChart
              option={scatterOption}
              height={340}
              ariaLabel="Gráfico de dispersão entre rigor de revisão M_REV e qualidade percebida C_QUAL colorido por senioridade"
            />
          </div>

          <div className="rounded-lg border border-[#D5DDD6] bg-white p-3 xl:col-span-5">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2 px-1">
              <h3 className="text-sm font-semibold text-[#142027]">
                Forest Plot de Sensibilidade (QP4)
              </h3>
              <Badge variant="exploratory">Sensibilidade · Exploratória</Badge>
            </div>
            <EChart
              option={sensitivityForestOption}
              height={340}
              ariaLabel="Forest plot comparando a correlação principal QP4 com as análises de sensibilidade"
            />
          </div>
        </div>

        {/* Item-to-item heatmap */}
        <div className="rounded-lg border border-[#D5DDD6] bg-white p-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-[#142027]">
                Heatmap Item a Item (M_REV × Itens de C_QUAL)
              </h3>
              <p className="text-[11px] text-[#5C6D75]">
                Correlações de Spearman entre cada item de revisão (ITEM_19–20) e cada dimensão de qualidade (ITEM_12–17). Asterisco (*) indica p &lt; 0,05 após Bonferroni (12 pares).
              </p>
            </div>
            <Badge variant="exploratory">Exploratória · Item × Item</Badge>
          </div>
          <EChart
            option={itemHeatmapOption}
            height={230}
            ariaLabel="Heatmap de correlação de Spearman item a item entre M_REV e C_QUAL"
          />
        </div>
      </section>
    </div>
  );
}
