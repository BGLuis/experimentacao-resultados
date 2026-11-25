import { useMemo, useState } from 'react';
import type { EChartsOption } from 'echarts';
import { ChevronDown, ChevronRight, Clock, AlertCircle } from 'lucide-react';
import type { ProfileBreakdownItem, SurveyAnalysisResult } from '../stats/types';
import { EChart } from '../components/EChart';
import { Badge, Callout, KpiCard, SectionHeader } from '../components/UiPrimitives';
import { COLORS, fmtCI, fmtInt, fmtNum, fmtPct, fmtPValue } from '../utils/format';

interface OverviewPageProps {
  result: SurveyAnalysisResult;
  hasActiveFilter: boolean;
}

function buildProfileOption(
  title: string,
  items: ProfileBreakdownItem[],
  barColor: string
): EChartsOption {
  const ordered = [...items].reverse();
  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: unknown) => {
        const arr = Array.isArray(params) ? params : [params];
        const p = arr[0] as { name: string; value: number; dataIndex: number };
        const item = ordered[p.dataIndex];
        return `<div style="font-family:'IBM Plex Sans',sans-serif;font-size:12px;">
          <strong>${title}: ${p.name}</strong><br/>
          Respondentes: <span style="font-family:'IBM Plex Mono',monospace;font-weight:600;">${item?.count ?? 0}</span>
          (<span style="font-family:'IBM Plex Mono',monospace;">${fmtPct(item?.pct ?? 0, 1)}</span>)
        </div>`;
      },
    },
    grid: { left: 8, right: 54, top: 10, bottom: 8, containLabel: true },
    xAxis: {
      type: 'value',
      axisLabel: {
        fontFamily: 'IBM Plex Mono',
        fontSize: 11,
        color: COLORS.textMuted,
      },
      splitLine: { lineStyle: { color: '#EDF1EC' } },
      minInterval: 1,
    },
    yAxis: {
      type: 'category',
      data: ordered.map((d) => d.label),
      axisLabel: {
        fontFamily: 'IBM Plex Sans',
        fontSize: 11,
        color: COLORS.textPrimary,
        width: 135,
        overflow: 'truncate',
      },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: COLORS.border } },
    },
    series: [
      {
        type: 'bar',
        data: ordered.map((d) => d.count),
        barMaxWidth: 22,
        itemStyle: {
          color: barColor,
          borderRadius: [0, 4, 4, 0],
        },
        label: {
          show: true,
          position: 'right',
          fontFamily: 'IBM Plex Mono',
          fontSize: 11,
          color: COLORS.textSecondary,
          formatter: (params: { dataIndex: number }) => {
            const item = ordered[params.dataIndex];
            return item ? `${item.count} (${fmtPct(item.pct, 0)})` : '';
          },
        },
      },
    ],
  };
}

export function OverviewPage({ result, hasActiveFilter }: OverviewPageProps) {
  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>({});
  const { cleaning, filtered, baseline, meta } = result;

  const postExtensionCount = useMemo(
    () => filtered.validRespondents.filter((r) => r.isPostExtension).length,
    [filtered.validRespondents]
  );

  const postPlannedCount = useMemo(
    () => filtered.validRespondents.filter((r) => r.isPostPlannedWindow).length,
    [filtered.validRespondents]
  );

  const reliabilityPassed =
    baseline.reliability.cVel.passedThreshold &&
    baseline.reliability.cQual.passedThreshold &&
    baseline.reliability.mRev.passedThreshold;

  const funnelOption = useMemo<EChartsOption>(() => {
    const steps = cleaning.funnel;
    const labels = steps.map((s) => s.label);
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const arr = Array.isArray(params) ? params : [params];
          const first = arr[0] as { dataIndex: number };
          const step = steps[first.dataIndex];
          if (!step) return '';
          return `<div style="font-family:'IBM Plex Sans',sans-serif;font-size:12px;max-width:290px;white-space:normal;">
            <strong>${step.label}</strong><br/>
            Entrada: <span style="font-family:'IBM Plex Mono',monospace;">${step.inputCount}</span><br/>
            Descartadas: <span style="font-family:'IBM Plex Mono',monospace;color:#B83B3B;">${step.discardedCount}</span><br/>
            Restantes: <span style="font-family:'IBM Plex Mono',monospace;color:#2F7A5C;font-weight:600;">${step.remainingCount}</span>
            ${step.note ? `<br/><span style="color:#5C6D75;">${step.note}</span>` : ''}
          </div>`;
        },
      },
      legend: {
        top: 0,
        right: 8,
        textStyle: { fontFamily: 'IBM Plex Sans', fontSize: 11, color: COLORS.textSecondary },
      },
      grid: { left: 10, right: 48, top: 32, bottom: 16, containLabel: true },
      xAxis: {
        type: 'value',
        max: cleaning.totalRaw,
        axisLabel: { fontFamily: 'IBM Plex Mono', fontSize: 11, color: COLORS.textMuted },
        splitLine: { lineStyle: { color: '#EDF1EC' } },
      },
      yAxis: {
        type: 'category',
        inverse: true,
        data: labels,
        axisLabel: {
          fontFamily: 'IBM Plex Sans',
          fontSize: 11,
          color: COLORS.textPrimary,
          width: 170,
          overflow: 'truncate',
        },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: COLORS.border } },
      },
      series: [
        {
          name: 'Retidas / Restantes',
          type: 'bar',
          stack: 'funnel',
          barMaxWidth: 22,
          data: steps.map((s) => s.remainingCount),
          itemStyle: {
            color: (params: { dataIndex: number }) =>
              steps[params.dataIndex]?.stage === 'valid' ? COLORS.success : COLORS.primary,
            borderRadius: [0, 2, 2, 0],
          },
          label: {
            show: true,
            position: 'insideRight',
            fontFamily: 'IBM Plex Mono',
            fontSize: 11,
            color: '#FFFFFF',
            formatter: (params: { value: unknown }) =>
              Number(params.value) > 0 ? String(params.value) : '',
          },
        },
        {
          name: 'Descartadas na etapa',
          type: 'bar',
          stack: 'funnel',
          barMaxWidth: 22,
          data: steps.map((s) => s.discardedCount),
          itemStyle: {
            color: COLORS.danger,
            borderRadius: [0, 4, 4, 0],
          },
          label: {
            show: true,
            position: 'right',
            fontFamily: 'IBM Plex Mono',
            fontSize: 11,
            color: COLORS.danger,
            formatter: (params: { value: unknown }) =>
              Number(params.value) > 0 ? `-${params.value}` : '',
          },
        },
      ],
    };
  }, [cleaning]);

  const timelineOption = useMemo<EChartsOption>(() => {
    const pts = filtered.timeline;
    const xLabels = pts.map((p) => p.label);

    // Find markers closest to 22/11 (planned end) and 24/11 (extension deadline)
    const idx22 = pts.findIndex((p) => p.date.includes('11-22') || p.label.startsWith('22/11'));
    const idx24 = pts.findIndex((p) => p.date.includes('11-24') || p.label.startsWith('24/11'));

    const markLines: Array<{ xAxis: number | string; name: string; lineStyle: object; label: object }> = [];
    if (idx22 >= 0) {
      markLines.push({
        xAxis: xLabels[idx22],
        name: '22/11 Encerramento previsto',
        lineStyle: { color: COLORS.warning, type: 'dashed', width: 2 },
        label: {
          show: true,
          formatter: '22/11\nPrevisto',
          fontFamily: 'IBM Plex Sans',
          fontSize: 10,
          color: COLORS.warning,
          position: 'insideEndTop',
        },
      });
    }
    if (idx24 >= 0) {
      markLines.push({
        xAxis: xLabels[idx24],
        name: '24/11 12h Limite prorrogação',
        lineStyle: { color: COLORS.danger, type: 'dashed', width: 2 },
        label: {
          show: true,
          formatter: '24/11 12h\nProrrogação',
          fontFamily: 'IBM Plex Sans',
          fontSize: 10,
          color: COLORS.danger,
          position: 'insideStartTop',
        },
      });
    }

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const arr = Array.isArray(params) ? params : [params];
          const first = arr[0] as { dataIndex: number };
          const pt = pts[first.dataIndex];
          if (!pt) return '';
          const phaseText =
            pt.phase === 'planned'
              ? 'Janela prevista (até 22/11)'
              : pt.phase === 'extended'
              ? 'Prorrogação (23/11–24/11 12h)'
              : 'Pós-prorrogação (> 24/11 12h)';
          return `<div style="font-family:'IBM Plex Sans',sans-serif;font-size:12px;">
            <strong>${pt.label}</strong> · <span style="color:#5C6D75;">${phaseText}</span><br/>
            Válidas no dia: <span style="font-family:'IBM Plex Mono',monospace;font-weight:600;color:#1F4E8C;">${pt.validCount}</span><br/>
            Descartadas no dia: <span style="font-family:'IBM Plex Mono',monospace;color:#B83B3B;">${pt.discardedCount}</span><br/>
            Acumulado válidas: <span style="font-family:'IBM Plex Mono',monospace;font-weight:600;color:#2F7A5C;">${pt.cumulativeValid}</span>
          </div>`;
        },
      },
      legend: {
        bottom: 0,
        left: 'center',
        textStyle: { fontFamily: 'IBM Plex Sans', fontSize: 11, color: COLORS.textSecondary },
      },
      grid: { left: 16, right: 20, top: 44, bottom: 48, containLabel: true },
      xAxis: {
        type: 'category',
        data: xLabels,
        axisLabel: { fontFamily: 'IBM Plex Mono', fontSize: 11, color: COLORS.textPrimary },
        axisLine: { lineStyle: { color: COLORS.border } },
      },
      yAxis: [
        {
          type: 'value',
          name: 'Respostas / dia',
          nameTextStyle: { fontFamily: 'IBM Plex Sans', fontSize: 11, color: COLORS.textMuted },
          axisLabel: { fontFamily: 'IBM Plex Mono', fontSize: 11, color: COLORS.textMuted },
          splitLine: { lineStyle: { color: '#EDF1EC' } },
          minInterval: 1,
        },
        {
          type: 'value',
          name: 'Acumulado válidas',
          nameTextStyle: { fontFamily: 'IBM Plex Sans', fontSize: 11, color: COLORS.textMuted },
          axisLabel: { fontFamily: 'IBM Plex Mono', fontSize: 11, color: COLORS.textMuted },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: 'Válidas (no prazo/prorrog.)',
          type: 'bar',
          stack: 'daily',
          barMaxWidth: 28,
          data: pts.map((p) => (p.phase === 'post_extension' ? 0 : p.validCount)),
          itemStyle: { color: COLORS.primary },
          markLine: markLines.length > 0 ? { symbol: ['none', 'none'], data: markLines } : undefined,
        },
        {
          name: 'Válidas (pós-24/11 12h)',
          type: 'bar',
          stack: 'daily',
          barMaxWidth: 28,
          data: pts.map((p) => (p.phase === 'post_extension' ? p.validCount : 0)),
          itemStyle: { color: COLORS.warning },
        },
        {
          name: 'Descartadas',
          type: 'bar',
          stack: 'daily',
          barMaxWidth: 28,
          data: pts.map((p) => p.discardedCount),
          itemStyle: { color: COLORS.danger, borderRadius: [3, 3, 0, 0] },
        },
        {
          name: 'Acumulado válidas',
          type: 'line',
          yAxisIndex: 1,
          smooth: false,
          symbol: 'circle',
          symbolSize: 7,
          data: pts.map((p) => p.cumulativeValid),
          lineStyle: { color: COLORS.success, width: 2.5 },
          itemStyle: { color: COLORS.success },
        },
      ],
    };
  }, [filtered.timeline]);

  const senOption = useMemo(
    () => buildProfileOption('Senioridade (M_SEN)', filtered.seniorityProfile, COLORS.primary),
    [filtered.seniorityProfile]
  );
  const toolOption = useMemo(
    () => buildProfileOption('Ferramenta (M_TOOL)', filtered.toolProfile, COLORS.success),
    [filtered.toolProfile]
  );
  const freqOption = useMemo(
    () => buildProfileOption('Frequência (M_USO)', filtered.frequencyProfile, '#4B6B8A'),
    [filtered.frequencyProfile]
  );

  const toggleStage = (stage: string) => {
    setExpandedStages((prev) => ({ ...prev, [stage]: !prev[stage] }));
  };

  return (
    <div className="space-y-6">
      {/* 6 KPI Cards */}
      <section aria-label="Indicadores principais da amostra">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <KpiCard
            label="N Bruto"
            value={fmtInt(cleaning.totalRaw)}
            detail="Submissões no Forms"
            subdetail={`Elegíveis: ${cleaning.totalEligible} | Descart.: ${cleaning.totalRaw - cleaning.totalValid}`}
            tone="neutral"
          />
          <KpiCard
            label={hasActiveFilter ? 'n Válido (Filtrado)' : 'n Válido'}
            value={fmtInt(filtered.validCount)}
            detail={
              hasActiveFilter
                ? `Amostra integral: ${cleaning.totalValid} válidas`
                : `Meta: ${meta.targetN} (mín. ${meta.minAcceptableN})`
            }
            subdetail={
              cleaning.totalValid < meta.minAcceptableN
                ? `Abaixo do mínimo (${cleaning.totalValid}/${meta.minAcceptableN})`
                : 'Meta atingida'
            }
            tone={filtered.validCount < 5 ? 'warning' : cleaning.totalValid < meta.minAcceptableN ? 'warning' : 'success'}
            badge={
              cleaning.totalValid < meta.minAcceptableN
                ? { label: 'Sub-meta', variant: 'warning' }
                : { label: 'Adequado', variant: 'success' }
            }
          />
          <KpiCard
            label="Margem de Erro"
            value={`±${fmtNum(filtered.marginOfErrorPct, 2)} p.p.`}
            detail="IC 95% (z = 1,96; p = 0,5)"
            subdetail="Amostra não probabilística"
            tone="warning"
          />
          <KpiCard
            label="C_VEL Mediana"
            value={fmtNum(filtered.cVelStats.median, 2)}
            detail={`Concordância (≥4): ${fmtPct(filtered.cVelStats.agreementPct, 1)}`}
            subdetail={`Wilson 95%: ${fmtCI(filtered.cVelStats.agreementWilsonCI, 1, '%')}`}
            tone="primary"
          />
          <KpiCard
            label="C_QUAL Mediana"
            value={fmtNum(filtered.cQualStats.median, 2)}
            detail={`Concordância (≥4): ${fmtPct(filtered.cQualStats.agreementPct, 1)}`}
            subdetail={`Wilson 95%: ${fmtCI(filtered.cQualStats.agreementWilsonCI, 1, '%')}`}
            tone="primary"
          />
          <KpiCard
            label="Confiabilidade"
            value={reliabilityPassed ? 'Aprovada' : 'Fallback'}
            detail={`α_VEL=${fmtNum(baseline.reliability.cVel.alpha, 3)} · α_QUAL=${fmtNum(baseline.reliability.cQual.alpha, 3)}`}
            subdetail={`ρ_REV=${fmtNum(baseline.reliability.mRev.rho, 3)} (p=${fmtPValue(baseline.reliability.mRev.pValue)})`}
            tone={reliabilityPassed ? 'success' : 'warning'}
            badge={
              reliabilityPassed
                ? { label: '≥ Cortes', variant: 'success' }
                : { label: 'Fallback ativo', variant: 'warning' }
            }
          />
        </div>
      </section>

      {/* Funnel + Timeline */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <section className="card-editorial p-5 xl:col-span-6 space-y-4">
          <SectionHeader
            title="Funil de Limpeza (Etapas 0–4)"
            subtitle="Fluxo sequencial pré-registrado (Seção 5.1) + Etapa 0 de elegibilidade no CSV."
            badge={{ label: 'Descritiva · Auditoria', variant: 'descriptive' }}
          />
          <EChart
            option={funnelOption}
            height={280}
            ariaLabel="Funil horizontal de limpeza das respostas do survey"
          />
          <div className="space-y-2">
            {cleaning.funnel.map((step) => {
              const hasDiscards = step.discardedRows.length > 0;
              const isOpen = !!expandedStages[step.stage];
              return (
                <div
                  key={step.stage}
                  className="rounded-lg border border-[#D5DDD6] bg-[#F8FAF8] px-3 py-2 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {hasDiscards ? (
                        <button
                          type="button"
                          onClick={() => toggleStage(step.stage)}
                          aria-expanded={isOpen}
                          className="inline-flex items-center gap-1 font-semibold text-[#142027] hover:text-[#1F4E8C]"
                        >
                          {isOpen ? (
                            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                          )}
                          <span>{step.label}</span>
                        </button>
                      ) : (
                        <span className="font-semibold text-[#142027]">{step.label}</span>
                      )}
                      {!step.available && <Badge variant="neutral">N/A no Forms</Badge>}
                    </div>
                    <div className="flex items-center gap-2 font-mono-tabular">
                      <span className="text-[#5C6D75]">
                        {step.inputCount} → <strong className="text-[#142027]">{step.remainingCount}</strong>
                      </span>
                      {step.discardedCount > 0 ? (
                        <Badge variant="danger">-{step.discardedCount}</Badge>
                      ) : (
                        <Badge variant="success">0 descartes</Badge>
                      )}
                    </div>
                  </div>
                  <p className="mt-1 text-[11px] text-[#5C6D75]">{step.description}</p>
                  {step.note && (
                    <p className="mt-1 text-[11px] italic text-[#43535B]">{step.note}</p>
                  )}
                  {hasDiscards && isOpen && (
                    <ul className="mt-2 space-y-1 border-t border-[#D5DDD6] pt-2">
                      {step.discardedRows.map((row) => (
                        <li
                          key={row.rowNumber}
                          className="flex flex-wrap items-baseline justify-between gap-2 rounded bg-white px-2.5 py-1 text-[11px] border border-[#E7BBBB]"
                        >
                          <span className="font-mono-tabular font-semibold text-[#9A2E2E]">
                            {row.idLabel} (linha {row.rowNumber}) · {row.timestampRaw}
                          </span>
                          <span className="text-[#43535B]">{row.reason}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="card-editorial p-5 xl:col-span-6 space-y-4">
          <SectionHeader
            title="Timeline da Coleta por Dia"
            subtitle="Comparação com as janelas do protocolo: encerramento previsto (22/11) e limite da prorrogação (24/11 12h)."
            badge={{ label: 'Descritiva · Temporal', variant: 'descriptive' }}
          />
          <EChart
            option={timelineOption}
            height={300}
            ariaLabel="Gráfico de barras e linha acumulada da coleta diária"
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="card-subtle p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#142027]">
                <Clock className="h-3.5 w-3.5 text-[#1F4E8C]" aria-hidden="true" />
                Coleta após 22/11 (previsto)
              </div>
              <div className="mt-1 font-mono-tabular text-lg font-bold text-[#142027]">
                {postPlannedCount} / {filtered.validCount} válidas
              </div>
              <p className="text-[11px] text-[#5C6D75]">
                Início real dos envios em 17/11 23:23 devido ao atraso na liberação.
              </p>
            </div>
            <div className="card-subtle p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#8E5512]">
                <AlertCircle className="h-3.5 w-3.5 text-[#B8721F]" aria-hidden="true" />
                Coleta após 24/11 12h (prorrogação)
              </div>
              <div className="mt-1 font-mono-tabular text-lg font-bold text-[#B8721F]">
                {postExtensionCount} / {filtered.validCount} válidas
              </div>
              <p className="text-[11px] text-[#5C6D75]">
                Retidas mediante registro formal em DESVIOS.md (veja comparativo Iniciais vs Tardias na Aba 5).
              </p>
            </div>
          </div>

          <Callout tone="info" title="Limitação da plataforma (Etapa 2)">
            O Google Forms nativo registra apenas o carimbo de envio sem log de início; conforme previsto na Seção 5.1, o descarte por baixa atenção apoia-se em <code>ITEM_18 ≠ 2</code>, straightlining (DP = 0) e duplicatas exatas.
          </Callout>
        </section>
      </div>

      {/* 3 Profile Charts */}
      <section className="card-editorial p-5 space-y-4">
        <SectionHeader
          title="Perfil da Amostra Válida"
          subtitle="Distribuição por senioridade (M_SEN), ferramenta principal (M_TOOL) e frequência de uso (M_USO)."
          badge={{ label: 'Descritiva · Perfil', variant: 'descriptive' }}
        />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="rounded-lg border border-[#D5DDD6] bg-[#FAFBF9] p-3">
            <h3 className="mb-1 text-sm font-semibold text-[#142027]">
              Senioridade (M_SEN · Tempo de atuação)
            </h3>
            <p className="mb-2 text-[11px] text-[#5C6D75]">
              Júnior (&lt;1 e 1–3 anos), Pleno (&gt;3–6 anos), Sênior (&gt;6 anos)
            </p>
            <EChart
              option={senOption}
              height={210}
              ariaLabel="Distribuição de respondentes por senioridade"
            />
          </div>

          <div className="rounded-lg border border-[#D5DDD6] bg-[#FAFBF9] p-3">
            <h3 className="mb-1 text-sm font-semibold text-[#142027]">
              Ferramenta Principal (M_TOOL)
            </h3>
            <p className="mb-2 text-[11px] text-[#5C6D75]">
              {result.filter.normalizeTools
                ? 'Normalização ativa: "kiro aws" agrupado em "Kiro"'
                : 'Rótulos brutos sem normalização'}
            </p>
            <EChart
              option={toolOption}
              height={210}
              ariaLabel="Distribuição de respondentes por ferramenta de IA"
            />
          </div>

          <div className="rounded-lg border border-[#D5DDD6] bg-[#FAFBF9] p-3">
            <h3 className="mb-1 text-sm font-semibold text-[#142027]">
              Frequência de Uso (M_USO · Covariável)
            </h3>
            <p className="mb-2 text-[11px] text-[#5C6D75]">
              Intensidade de uso no trabalho (ITEM_07)
            </p>
            <EChart
              option={freqOption}
              height={210}
              ariaLabel="Distribuição de respondentes por frequência de uso de IA"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
