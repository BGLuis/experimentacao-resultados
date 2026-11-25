import { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import { ArrowLeftRight, TrendingDown } from 'lucide-react';
import type { ConstructDescriptiveStats, LikertItemStats, SurveyAnalysisResult } from '../stats/types';
import { EChart } from '../components/EChart';
import { Badge, Callout, SectionHeader } from '../components/UiPrimitives';
import {
  COLORS,
  LIKERT_COLORS,
  SENIORITY_COLORS,
  fmtCI,
  fmtModes,
  fmtNum,
  fmtPct,
  fmtPValue,
} from '../utils/format';

interface LikertPageProps {
  result: SurveyAnalysisResult;
  invertItem16: boolean;
  onToggleInvertItem16: () => void;
}

function buildDivergingOption(
  items: LikertItemStats[],
  scaleLabels: [string, string, string, string, string]
): EChartsOption {
  const ordered = [...items].reverse();
  const labels = ordered.map((item) =>
    item.inverted && item.id === 'ITEM_16'
      ? `${item.id} (${item.effectiveInverted ? 'inv.' : 'bruto'}): ${item.shortLabel}`
      : `${item.id}: ${item.shortLabel}`
  );

  const pct = (item: LikertItemStats, score: 1 | 2 | 3 | 4 | 5) =>
    item.nValid > 0 ? (item.distribution[score] / item.nValid) * 100 : 0;

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: unknown) => {
        const arr = Array.isArray(params) ? params : [params];
        const first = arr[0] as { dataIndex: number };
        const item = ordered[first.dataIndex];
        if (!item) return '';
        const d = item.distribution;
        return `<div style="font-family:'IBM Plex Sans',sans-serif;font-size:12px;max-width:310px;white-space:normal;">
          <strong>${item.id} — ${item.shortLabel}</strong><br/>
          <span style="color:#5C6D75;font-size:11px;">${item.questionText}</span><br/>
          <hr style="margin:4px 0;border-color:#EDF1EC;"/>
          5 (${scaleLabels[4]}): <strong style="font-family:'IBM Plex Mono',monospace;">${d[5]}</strong> (${fmtPct(pct(item, 5))})<br/>
          4 (${scaleLabels[3]}): <strong style="font-family:'IBM Plex Mono',monospace;">${d[4]}</strong> (${fmtPct(pct(item, 4))})<br/>
          3 (${scaleLabels[2]}): <strong style="font-family:'IBM Plex Mono',monospace;">${d[3]}</strong> (${fmtPct(pct(item, 3))})<br/>
          2 (${scaleLabels[1]}): <strong style="font-family:'IBM Plex Mono',monospace;">${d[2]}</strong> (${fmtPct(pct(item, 2))})<br/>
          1 (${scaleLabels[0]}): <strong style="font-family:'IBM Plex Mono',monospace;">${d[1]}</strong> (${fmtPct(pct(item, 1))})<br/>
          <span style="color:#5C6D75;">n válidos = ${item.nValid} · N/A = ${d.NA} · Concord. (≥4) = <strong>${fmtPct(item.agreementPct)}</strong></span>
        </div>`;
      },
    },
    legend: {
      top: 0,
      data: [scaleLabels[0], scaleLabels[1], scaleLabels[2], scaleLabels[3], scaleLabels[4]],
      textStyle: { fontFamily: 'IBM Plex Sans', fontSize: 11, color: COLORS.textSecondary },
    },
    grid: { left: 10, right: 24, top: 38, bottom: 24, containLabel: true },
    xAxis: {
      type: 'value',
      min: -100,
      max: 100,
      axisLabel: {
        fontFamily: 'IBM Plex Mono',
        fontSize: 11,
        color: COLORS.textMuted,
        formatter: (v: number) => `${Math.abs(v)}%`,
      },
      splitLine: { lineStyle: { color: '#EDF1EC' } },
    },
    yAxis: {
      type: 'category',
      data: labels,
      axisLabel: {
        fontFamily: 'IBM Plex Sans',
        fontSize: 11,
        color: COLORS.textPrimary,
        width: 220,
        overflow: 'truncate',
      },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: COLORS.border } },
    },
    series: [
      {
        name: scaleLabels[2],
        type: 'bar',
        stack: 'div',
        barMaxWidth: 22,
        itemStyle: { color: LIKERT_COLORS[3] },
        data: ordered.map((it) => -(pct(it, 3) / 2)),
      },
      {
        name: scaleLabels[1],
        type: 'bar',
        stack: 'div',
        barMaxWidth: 22,
        itemStyle: { color: LIKERT_COLORS[2] },
        data: ordered.map((it) => -pct(it, 2)),
      },
      {
        name: scaleLabels[0],
        type: 'bar',
        stack: 'div',
        barMaxWidth: 22,
        itemStyle: { color: LIKERT_COLORS[1], borderRadius: [3, 0, 0, 3] },
        data: ordered.map((it) => -pct(it, 1)),
      },
      {
        name: scaleLabels[2],
        type: 'bar',
        stack: 'div',
        barMaxWidth: 22,
        itemStyle: { color: LIKERT_COLORS[3] },
        data: ordered.map((it) => pct(it, 3) / 2),
      },
      {
        name: scaleLabels[3],
        type: 'bar',
        stack: 'div',
        barMaxWidth: 22,
        itemStyle: { color: LIKERT_COLORS[4] },
        data: ordered.map((it) => pct(it, 4)),
      },
      {
        name: scaleLabels[4],
        type: 'bar',
        stack: 'div',
        barMaxWidth: 22,
        itemStyle: { color: LIKERT_COLORS[5], borderRadius: [0, 3, 3, 0] },
        data: ordered.map((it) => pct(it, 5)),
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: COLORS.textPrimary, width: 1.5, type: 'solid' },
          label: { show: false },
          data: [{ xAxis: 0 }],
        },
      },
    ],
  };
}

export function LikertPage({
  result,
  invertItem16,
  onToggleInvertItem16,
}: LikertPageProps) {
  const { filtered } = result;
  const likertItems = filtered.likertItems;
  const reviewItems = filtered.reviewItems;
  const paired = filtered.exploratory.pairedVelVsQual;

  const velItems = useMemo(
    () => likertItems.filter((i) => i.construct === 'C_VEL'),
    [likertItems]
  );
  const qualItems = useMemo(
    () => likertItems.filter((i) => i.construct === 'C_QUAL'),
    [likertItems]
  );

  const agreementRows = useMemo(() => {
    const rows: Array<{
      label: string;
      group: string;
      pct: number;
      lower: number;
      upper: number;
      nValid: number;
      isConstruct: boolean;
    }> = [];

    rows.push({
      label: 'C_VEL (Construto Velocidade)',
      group: 'C_VEL',
      pct: filtered.cVelStats.agreementPct,
      lower: filtered.cVelStats.agreementWilsonCI.lower,
      upper: filtered.cVelStats.agreementWilsonCI.upper,
      nValid: filtered.cVelStats.nValid,
      isConstruct: true,
    });
    velItems.forEach((it) =>
      rows.push({
        label: `${it.id}: ${it.shortLabel}`,
        group: 'C_VEL',
        pct: it.agreementPct,
        lower: it.agreementWilsonCI.lower,
        upper: it.agreementWilsonCI.upper,
        nValid: it.nValid,
        isConstruct: false,
      })
    );
    rows.push({
      label: 'C_QUAL (Construto Qualidade)',
      group: 'C_QUAL',
      pct: filtered.cQualStats.agreementPct,
      lower: filtered.cQualStats.agreementWilsonCI.lower,
      upper: filtered.cQualStats.agreementWilsonCI.upper,
      nValid: filtered.cQualStats.nValid,
      isConstruct: true,
    });
    qualItems.forEach((it) =>
      rows.push({
        label:
          it.id === 'ITEM_16'
            ? `${it.id} (${invertItem16 ? 'inv.' : 'bruto'}): ${it.shortLabel}`
            : `${it.id}: ${it.shortLabel}`,
        group: 'C_QUAL',
        pct: it.agreementPct,
        lower: it.agreementWilsonCI.lower,
        upper: it.agreementWilsonCI.upper,
        nValid: it.nValid,
        isConstruct: false,
      })
    );
    return rows;
  }, [filtered.cVelStats, filtered.cQualStats, velItems, qualItems, invertItem16]);

  const divergingLikertOption = useMemo(
    () =>
      buildDivergingOption([...velItems, ...qualItems], [
        '1 Disc. Tot.',
        '2 Disc. Parc.',
        '3 Neutro',
        '4 Conc. Parc.',
        '5 Conc. Tot.',
      ]),
    [velItems, qualItems]
  );

  const divergingReviewOption = useMemo(
    () =>
      buildDivergingOption(reviewItems, [
        '1 Nunca',
        '2 Raramente',
        '3 Às vezes',
        '4 Frequent.',
        '5 Sempre',
      ]),
    [reviewItems]
  );

  const forestOption = useMemo<EChartsOption>(() => {
    const ordered = [...agreementRows].reverse();
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const arr = Array.isArray(params) ? params : [params];
          const first = arr[0] as { dataIndex: number };
          const row = ordered[first.dataIndex];
          if (!row) return '';
          return `<div style="font-family:'IBM Plex Sans',sans-serif;font-size:12px;">
            <strong>${row.label}</strong><br/>
            % Concordância (≥ 4): <strong style="font-family:'IBM Plex Mono',monospace;">${fmtPct(row.pct, 1)}</strong><br/>
            IC Wilson 95%: <span style="font-family:'IBM Plex Mono',monospace;">[${fmtNum(row.lower, 1)}%; ${fmtNum(row.upper, 1)}%]</span><br/>
            n válidos: <span style="font-family:'IBM Plex Mono',monospace;">${row.nValid}</span>
          </div>`;
        },
      },
      grid: { left: 10, right: 32, top: 18, bottom: 26, containLabel: true },
      xAxis: {
        type: 'value',
        min: 0,
        max: 100,
        axisLabel: {
          fontFamily: 'IBM Plex Mono',
          fontSize: 11,
          color: COLORS.textMuted,
          formatter: '{value}%',
        },
        splitLine: { lineStyle: { color: '#EDF1EC' } },
      },
      yAxis: {
        type: 'category',
        data: ordered.map((r) => r.label),
        axisLabel: {
          fontFamily: 'IBM Plex Sans',
          fontSize: 11,
          color: COLORS.textPrimary,
          width: 220,
          overflow: 'truncate',
        },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: COLORS.border } },
      },
      series: [
        {
          type: 'custom',
          renderItem: (_params, api) => {
            const yIdx = api.value(0) as number;
            const pctVal = api.value(1) as number;
            const lowVal = api.value(2) as number;
            const highVal = api.value(3) as number;
            const isConstruct = api.value(4) === 1;
            const isVel = api.value(5) === 1;

            const ptCenter = api.coord([pctVal, yIdx]);
            const ptLow = api.coord([lowVal, yIdx]);
            const ptHigh = api.coord([highVal, yIdx]);
            const ptZero = api.coord([0, yIdx]);

            const color = isVel ? COLORS.primary : COLORS.success;

            return {
              type: 'group',
              children: [
                {
                  type: 'line',
                  shape: { x1: ptZero[0], y1: ptCenter[1], x2: ptCenter[0], y2: ptCenter[1] },
                  style: { stroke: '#D5DDD6', lineWidth: isConstruct ? 2.5 : 1.5 },
                },
                {
                  type: 'line',
                  shape: { x1: ptLow[0], y1: ptCenter[1], x2: ptHigh[0], y2: ptCenter[1] },
                  style: { stroke: color, lineWidth: isConstruct ? 2.5 : 1.75 },
                },
                {
                  type: 'line',
                  shape: { x1: ptLow[0], y1: ptCenter[1] - 4, x2: ptLow[0], y2: ptCenter[1] + 4 },
                  style: { stroke: color, lineWidth: 1.5 },
                },
                {
                  type: 'line',
                  shape: { x1: ptHigh[0], y1: ptCenter[1] - 4, x2: ptHigh[0], y2: ptCenter[1] + 4 },
                  style: { stroke: color, lineWidth: 1.5 },
                },
                {
                  type: 'circle',
                  shape: { cx: ptCenter[0], cy: ptCenter[1], r: isConstruct ? 6 : 4.5 },
                  style: {
                    fill: color,
                    stroke: '#FFFFFF',
                    lineWidth: 1.5,
                  },
                },
              ],
            };
          },
          data: ordered.map((r, idx) => [
            idx,
            r.pct,
            r.lower,
            r.upper,
            r.isConstruct ? 1 : 0,
            r.group === 'C_VEL' ? 1 : 0,
          ]),
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: COLORS.textMuted, type: 'dashed', width: 1.2 },
            label: {
              formatter: '50%',
              fontFamily: 'IBM Plex Mono',
              fontSize: 10,
              color: COLORS.textMuted,
            },
            data: [{ xAxis: 50 }],
          },
        },
      ],
    };
  }, [agreementRows]);

  const slopeOption = useMemo<EChartsOption>(() => {
    const pairs = paired.pairs;
    const respondentSeries = pairs.map((p) => {
      const color = SENIORITY_COLORS[p.seniority] ?? COLORS.primary;
      return {
        name: `${p.idLabel} (${p.seniority})`,
        type: 'line' as const,
        data: [p.cVel, p.cQual],
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { color, width: 1.6, opacity: 0.45 },
        itemStyle: { color, opacity: 0.75 },
        emphasis: {
          focus: 'series' as const,
          lineStyle: { width: 3, opacity: 1 },
          itemStyle: { opacity: 1 },
        },
      };
    });

    if (paired.cVelMedian !== null && paired.cQualMedian !== null) {
      respondentSeries.push({
        name: 'Mediana da amostra',
        type: 'line' as const,
        data: [paired.cVelMedian, paired.cQualMedian],
        symbol: 'diamond',
        symbolSize: 11,
        lineStyle: { color: COLORS.textPrimary, width: 3.5, opacity: 1 },
        itemStyle: { color: COLORS.textPrimary, opacity: 1 },
        emphasis: {
          focus: 'series' as const,
          lineStyle: { width: 4, opacity: 1 },
          itemStyle: { opacity: 1 },
        },
      });
    }

    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: unknown) => {
          const p = params as { seriesName: string; seriesIndex: number; value: number };
          const pair = pairs[p.seriesIndex];
          if (!pair) {
            return `<div style="font-family:'IBM Plex Sans',sans-serif;font-size:12px;">
              <strong>Mediana da amostra</strong><br/>
              C_VEL: <span style="font-family:'IBM Plex Mono',monospace;">${fmtNum(paired.cVelMedian, 2)}</span> →
              C_QUAL: <span style="font-family:'IBM Plex Mono',monospace;">${fmtNum(paired.cQualMedian, 2)}</span>
            </div>`;
          }
          return `<div style="font-family:'IBM Plex Sans',sans-serif;font-size:12px;">
            <strong>${pair.idLabel} · ${pair.seniority}</strong><br/>
            C_VEL: <span style="font-family:'IBM Plex Mono',monospace;">${fmtNum(pair.cVel, 2)}</span> →
            C_QUAL: <span style="font-family:'IBM Plex Mono',monospace;">${fmtNum(pair.cQual, 2)}</span><br/>
            Diferença (QUAL − VEL): <strong style="font-family:'IBM Plex Mono',monospace;color:#B83B3B;">${fmtNum(pair.diff, 2)}</strong>
          </div>`;
        },
      },
      grid: { left: 68, right: 82, top: 28, bottom: 32, containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: ['C_VEL\n(Velocidade)', 'C_QUAL\n(Qualidade)'],
        axisLabel: {
          fontFamily: 'IBM Plex Sans',
          fontSize: 12,
          fontWeight: 600,
          lineHeight: 16,
          color: COLORS.textPrimary,
        },
        axisLine: { lineStyle: { color: COLORS.border } },
      },
      yAxis: {
        type: 'value',
        min: 1,
        max: 5,
        interval: 0.5,
        axisLabel: { fontFamily: 'IBM Plex Mono', fontSize: 11, color: COLORS.textMuted },
        splitLine: { lineStyle: { color: '#EDF1EC' } },
      },
      series: respondentSeries,
    };
  }, [paired]);

  const constructRows: ConstructDescriptiveStats[] = [
    filtered.cVelStats,
    filtered.cQualStats,
    filtered.mRevStats,
  ];

  return (
    <div className="space-y-6">
      {/* Diverging Stacked Bars */}
      <section className="card-editorial p-5 space-y-4">
        <SectionHeader
          title="QP1 & QP2 — Distribuição Divergente por Item (Escala Likert 1–5)"
          subtitle="Barras empilhadas centradas em Neutro (3). À esquerda: discordância (1–2); à direita: concordância (4–5)."
          badge={{ label: 'Descritiva · QP1 & QP2', variant: 'descriptive' }}
          rightSlot={
            <label className="inline-flex items-center gap-2 rounded-lg border border-[#D5DDD6] bg-[#EDF1EC] px-3 py-1.5 text-xs font-medium text-[#142027] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={invertItem16}
                onChange={onToggleInvertItem16}
                className="h-3.5 w-3.5 accent-[#1F4E8C]"
              />
              <ArrowLeftRight className="h-3.5 w-3.5 text-[#1F4E8C]" aria-hidden="true" />
              <span>
                Inverter <code>ITEM_16</code> (<code>6 − x</code>, padrão C_QUAL)
              </span>
            </label>
          }
        />

        {!invertItem16 && (
          <Callout tone="warning" title="Modo de inspeção bruta do ITEM_16 ativo">
            O <code>ITEM_16</code> (&ldquo;O código gerado por IA costuma conter falhas que exigem correção significativa&rdquo;) está sendo exibido na direção original sem inversão (<code>6 − x</code>). Concordar com este item indica percepção negativa de qualidade.
          </Callout>
        )}

        <EChart
          option={divergingLikertOption}
          height={410}
          ariaLabel="Gráfico de barras divergentes empilhadas para os itens Likert de velocidade e qualidade"
        />

        <div className="border-t border-[#EDF1EC] pt-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[#142027]">
              Rigor de Revisão & Testes (M_REV — Escala de Frequência 1–5)
            </h3>
            <span className="text-xs text-[#5C6D75]">
              Centrado em &ldquo;Às vezes (3)&rdquo;; direita = Frequentemente / Sempre
            </span>
          </div>
          <EChart
            option={divergingReviewOption}
            height={165}
            ariaLabel="Gráfico de barras divergentes para revisão linha a linha e execução de testes"
          />
        </div>
      </section>

      {/* Forest Plot + Slopegraph */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <section className="card-editorial p-5 xl:col-span-7 space-y-4">
          <SectionHeader
            title="% Concordância (≥ 4) e Intervalo de Wilson 95%"
            subtitle="Proporção de respondentes que assinalaram 4 ou 5 por construto e por item."
            badge={{ label: 'Wilson 95% · QP1 & QP2', variant: 'descriptive' }}
          />
          <EChart
            option={forestOption}
            height={420}
            ariaLabel="Gráfico Forest/Lollipop de porcentagem de concordância com intervalos de Wilson 95%"
          />
        </section>

        <section className="card-editorial p-5 xl:col-span-5 space-y-4">
          <SectionHeader
            title="Assimetria C_VEL → C_QUAL por Respondente"
            subtitle="Comparação pareada intra-sujeito entre percepção de velocidade e percepção de qualidade."
            badge={{ label: 'Exploratória · Pareada', variant: 'exploratory' }}
          />

          <div className="grid grid-cols-3 gap-2">
            <div className="card-subtle p-2.5">
              <div className="text-[11px] font-semibold text-[#5C6D75]">Em queda (VEL &gt; QUAL)</div>
              <div className="mt-0.5 font-mono-tabular text-lg font-bold text-[#142027]">
                {paired.velGreaterCount} / {paired.n}
              </div>
            </div>
            <div className="card-subtle p-2.5">
              <div className="text-[11px] font-semibold text-[#5C6D75]">Wilcoxon W</div>
              <div className="mt-0.5 font-mono-tabular text-lg font-bold text-[#142027]">
                {fmtNum(paired.wilcoxonW, 1)}
              </div>
            </div>
            <div className="card-subtle p-2.5">
              <div className="text-[11px] font-semibold text-[#5C6D75]">p-valor / efeito r</div>
              <div className="mt-0.5 font-mono-tabular text-sm font-bold text-[#1F4E8C]">
                {fmtPValue(paired.pValue)}
              </div>
              <div className="font-mono-tabular text-[11px] text-[#5C6D75]">
                r = {fmtNum(paired.effectR, 3)}
              </div>
            </div>
          </div>

          <EChart
            option={slopeOption}
            height={285}
            ariaLabel="Slopegraph exploratório ligando C_VEL a C_QUAL para cada respondente"
          />

          <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#43535B]">
            <span className="inline-flex items-center gap-1">
              <TrendingDown className="h-3.5 w-3.5 text-[#1F4E8C]" aria-hidden="true" />
              Cores por senioridade:
            </span>
            {(['Júnior', 'Pleno', 'Sênior'] as const).map((sen) => (
              <span key={sen} className="inline-flex items-center gap-1 font-medium">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: SENIORITY_COLORS[sen] }}
                />
                {sen}
              </span>
            ))}
            <span className="inline-flex items-center gap-1 font-semibold text-[#142027]">
              <span className="inline-block h-0.5 w-4 bg-[#142027]" /> Mediana
            </span>
          </div>
        </section>
      </div>

      {/* Descriptive Table */}
      <section className="card-editorial p-5 space-y-4">
        <SectionHeader
          title="Tabela Descritiva Completa — Construtos e Itens (QP1, QP2 e M_REV)"
          subtitle="Estatísticas não paramétricas (Mediana, Moda, MAD) e concordância (≥ 4) com IC Wilson 95%."
          badge={{ label: 'Seção 5.3 · Descritiva', variant: 'descriptive' }}
        />

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#D5DDD6] bg-[#EDF1EC] text-[11px] font-semibold uppercase tracking-wider text-[#43535B]">
                <th className="px-3 py-2.5">Construto / Item</th>
                <th className="px-3 py-2.5">Bloco</th>
                <th className="px-3 py-2.5 text-right">n</th>
                <th className="px-3 py-2.5 text-right">Mediana</th>
                <th className="px-3 py-2.5 text-right">Moda(s)</th>
                <th className="px-3 py-2.5 text-right">MAD</th>
                <th className="px-3 py-2.5 text-right">% ≥ 4</th>
                <th className="px-3 py-2.5 text-right">IC Wilson 95%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDF1EC]">
              {constructRows.map((c) => (
                <tr key={c.id} className="bg-[#F8FAF8] font-semibold text-[#142027]">
                  <td className="px-3 py-2.5">
                    <span className="font-mono-tabular text-[#1F4E8C]">{c.id}</span> — {c.label}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant="neutral">Construto</Badge>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono-tabular">{c.nValid}</td>
                  <td className="px-3 py-2.5 text-right font-mono-tabular">{fmtNum(c.median, 2)}</td>
                  <td className="px-3 py-2.5 text-right font-mono-tabular">{fmtModes(c.modes)}</td>
                  <td className="px-3 py-2.5 text-right font-mono-tabular">{fmtNum(c.mad, 2)}</td>
                  <td className="px-3 py-2.5 text-right font-mono-tabular">{fmtPct(c.agreementPct, 1)}</td>
                  <td className="px-3 py-2.5 text-right font-mono-tabular">
                    {fmtCI(c.agreementWilsonCI, 1, '%')}
                  </td>
                </tr>
              ))}
              {[...likertItems, ...reviewItems].map((it) => (
                <tr key={it.id} className="hover:bg-[#F8FAF8]">
                  <td className="px-3 py-2">
                    <div className="font-medium text-[#142027]">
                      <span className="font-mono-tabular font-semibold text-[#43535B]">{it.id}</span>{' '}
                      — {it.shortLabel}
                      {it.inverted && (
                        <Badge variant={it.effectiveInverted ? 'warning' : 'danger'} className="ml-2">
                          {it.effectiveInverted ? 'Invertido (6 − x)' : 'Bruto'}
                        </Badge>
                      )}
                    </div>
                    <div className="text-[11px] text-[#5C6D75]">{it.questionText}</div>
                  </td>
                  <td className="px-3 py-2 font-mono-tabular text-[#43535B]">{it.construct}</td>
                  <td className="px-3 py-2 text-right font-mono-tabular">{it.nValid}</td>
                  <td className="px-3 py-2 text-right font-mono-tabular">{fmtNum(it.median, 2)}</td>
                  <td className="px-3 py-2 text-right font-mono-tabular">{fmtModes(it.modes)}</td>
                  <td className="px-3 py-2 text-right font-mono-tabular">{fmtNum(it.mad, 2)}</td>
                  <td className="px-3 py-2 text-right font-mono-tabular">{fmtPct(it.agreementPct, 1)}</td>
                  <td className="px-3 py-2 text-right font-mono-tabular">
                    {fmtCI(it.agreementWilsonCI, 1, '%')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
