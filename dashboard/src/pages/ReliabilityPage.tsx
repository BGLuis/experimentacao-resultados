import { useMemo, useState } from 'react';
import type { EChartsOption } from 'echarts';
import { ArrowUpDown, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { CronbachAnalysis, SurveyAnalysisResult } from '../stats/types';
import { EChart } from '../components/EChart';
import { Badge, Callout, KpiCard, SectionHeader } from '../components/UiPrimitives';
import { COLORS, fmtCI, fmtNum, fmtPValue } from '../utils/format';

interface ReliabilityPageProps {
  result: SurveyAnalysisResult;
  hasActiveFilter: boolean;
}

type SortField = 'default' | 'rItemTotalCorrected' | 'alphaIfDropped' | 'deltaAlpha';

function DiagnosticTable({
  analysis,
}: {
  analysis: CronbachAnalysis;
}) {
  const [sortField, setSortField] = useState<SortField>('default');
  const [sortDesc, setSortDesc] = useState(true);

  const sortedRows = useMemo(() => {
    const rows = [...analysis.itemDiagnostics];
    if (sortField === 'default') return rows;
    return rows.sort((a, b) => {
      const av = a[sortField] ?? -999;
      const bv = b[sortField] ?? -999;
      return sortDesc ? bv - av : av - bv;
    });
  }, [analysis.itemDiagnostics, sortField, sortDesc]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDesc((prev) => !prev);
    } else {
      setSortField(field);
      setSortDesc(true);
    }
  };

  return (
    <div className="rounded-lg border border-[#D5DDD6] bg-white overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D5DDD6] bg-[#EDF1EC] px-4 py-2.5">
        <div>
          <h3 className="text-sm font-semibold text-[#142027]">
            {analysis.construct} — {analysis.label}
          </h3>
          <p className="text-[11px] text-[#5C6D75]">
            Diagnóstico &ldquo;se item removido&rdquo; (critério Seção 5.2: remover no máx. 1 item se{' '}
            <code className="font-mono-tabular">α &lt; 0,70</code>,{' '}
            <code className="font-mono-tabular">r_it &lt; 0,30</code> e{' '}
            <code className="font-mono-tabular">Δα ≥ +0,05</code>)
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono-tabular text-xs">
          <Badge variant={analysis.passedThreshold ? 'success' : 'danger'}>
            α = {fmtNum(analysis.alpha, 3)} (corte ≥ {fmtNum(analysis.threshold, 2)})
          </Badge>
          <span className="text-[#5C6D75]">n = {analysis.nComplete}</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-[#D5DDD6] bg-[#FAFBF9] text-[11px] font-semibold uppercase tracking-wider text-[#43535B]">
              <th className="px-3 py-2">
                <button
                  type="button"
                  onClick={() => setSortField('default')}
                  className="inline-flex items-center gap-1 hover:text-[#1F4E8C]"
                >
                  Item (ordem original)
                </button>
              </th>
              <th className="px-3 py-2 text-right">n</th>
              <th className="px-3 py-2 text-right">
                <button
                  type="button"
                  onClick={() => handleSort('rItemTotalCorrected')}
                  className="inline-flex items-center justify-end gap-1 hover:text-[#1F4E8C]"
                >
                  r_it corrigido
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-3 py-2 text-right">
                <button
                  type="button"
                  onClick={() => handleSort('alphaIfDropped')}
                  className="inline-flex items-center justify-end gap-1 hover:text-[#1F4E8C]"
                >
                  α sem item
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-3 py-2 text-right">
                <button
                  type="button"
                  onClick={() => handleSort('deltaAlpha')}
                  className="inline-flex items-center justify-end gap-1 hover:text-[#1F4E8C]"
                >
                  Δα
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-3 py-2">Diagnóstico</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EDF1EC]">
            {sortedRows.map((row) => {
              const lowCorr = row.rItemTotalCorrected !== null && row.rItemTotalCorrected < 0.3;
              const deltaPositive = row.deltaAlpha !== null && row.deltaAlpha > 0;
              return (
                <tr
                  key={row.itemId}
                  className={
                    row.candidateForRemoval
                      ? 'bg-[#FBF2E4]/70 hover:bg-[#FBF2E4]'
                      : 'hover:bg-[#F8FAF8]'
                  }
                >
                  <td className="px-3 py-2">
                    <div className="font-medium text-[#142027]">
                      <span className="font-mono-tabular font-semibold text-[#1F4E8C]">
                        {row.itemId}
                      </span>{' '}
                      — {row.shortLabel}
                    </div>
                    <div className="text-[11px] text-[#5C6D75] line-clamp-1">{row.questionText}</div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono-tabular">{row.nUsed}</td>
                  <td
                    className={`px-3 py-2 text-right font-mono-tabular font-medium ${
                      lowCorr ? 'text-[#B8721F]' : 'text-[#142027]'
                    }`}
                  >
                    {fmtNum(row.rItemTotalCorrected, 3)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono-tabular">
                    {fmtNum(row.alphaIfDropped, 3)}
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-mono-tabular font-semibold ${
                      row.deltaAlpha !== null && row.deltaAlpha >= 0.05
                        ? 'text-[#B8721F]'
                        : deltaPositive
                        ? 'text-[#43535B]'
                        : 'text-[#2F7A5C]'
                    }`}
                  >
                    {row.deltaAlpha !== null && row.deltaAlpha >= 0 ? '+' : ''}
                    {fmtNum(row.deltaAlpha, 3)}
                  </td>
                  <td className="px-3 py-2">
                    {row.candidateForRemoval ? (
                      <Badge variant="warning">Candidato à remoção</Badge>
                    ) : lowCorr ? (
                      <Badge variant="neutral">r_it &lt; 0,30 (Δα &lt; 0,05)</Badge>
                    ) : (
                      <Badge variant="success">Contribui ao construto</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ReliabilityPage({ result, hasActiveFilter }: ReliabilityPageProps) {
  const [inspectFiltered, setInspectFiltered] = useState(false);

  const activeRel =
    hasActiveFilter && inspectFiltered
      ? result.filtered.reliability
      : result.baseline.reliability;

  const pointRangeOption = useMemo<EChartsOption>(() => {
    const rows = [
      {
        label: 'M_REV · Spearman ρ (ITEM_19 vs 20)',
        val: activeRel.mRev.rho ?? 0,
        low: activeRel.mRev.ci95?.lower ?? activeRel.mRev.rho ?? 0,
        high: activeRel.mRev.ci95?.upper ?? activeRel.mRev.rho ?? 0,
        passed: activeRel.mRev.passedThreshold,
        threshold: activeRel.mRev.threshold,
        metric: 'ρ de Spearman',
        n: activeRel.mRev.n,
      },
      {
        label: 'C_QUAL · Alfa de Cronbach (6 itens)',
        val: activeRel.cQual.alpha ?? 0,
        low: activeRel.cQual.ci95?.lower ?? activeRel.cQual.alpha ?? 0,
        high: activeRel.cQual.ci95?.upper ?? activeRel.cQual.alpha ?? 0,
        passed: activeRel.cQual.passedThreshold,
        threshold: activeRel.cQual.threshold,
        metric: 'α de Cronbach',
        n: activeRel.cQual.nComplete,
      },
      {
        label: 'C_VEL · Alfa de Cronbach (4 itens)',
        val: activeRel.cVel.alpha ?? 0,
        low: activeRel.cVel.ci95?.lower ?? activeRel.cVel.alpha ?? 0,
        high: activeRel.cVel.ci95?.upper ?? activeRel.cVel.alpha ?? 0,
        passed: activeRel.cVel.passedThreshold,
        threshold: activeRel.cVel.threshold,
        metric: 'α de Cronbach',
        n: activeRel.cVel.nComplete,
      },
    ];

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const arr = Array.isArray(params) ? params : [params];
          const first = arr[0] as { dataIndex: number };
          const r = rows[first.dataIndex];
          if (!r) return '';
          return `<div style="font-family:'IBM Plex Sans',sans-serif;font-size:12px;">
            <strong>${r.label}</strong><br/>
            ${r.metric}: <strong style="font-family:'IBM Plex Mono',monospace;">${fmtNum(r.val, 3)}</strong><br/>
            IC 95% Bootstrap: <span style="font-family:'IBM Plex Mono',monospace;">[${fmtNum(r.low, 3)}; ${fmtNum(r.high, 3)}]</span><br/>
            Corte pré-registrado: <span style="font-family:'IBM Plex Mono',monospace;">≥ ${fmtNum(r.threshold, 2)}</span> · n = ${r.n}
          </div>`;
        },
      },
      grid: { left: 16, right: 32, top: 44, bottom: 34, containLabel: true },
      xAxis: {
        type: 'value',
        min: -0.1,
        max: 1.0,
        axisLabel: {
          fontFamily: 'IBM Plex Mono',
          fontSize: 11,
          color: COLORS.textMuted,
          formatter: (v: number) => fmtNum(v, 1),
        },
        splitLine: { lineStyle: { color: '#EDF1EC' } },
      },
      yAxis: {
        type: 'category',
        data: rows.map((r) => r.label),
        axisLabel: {
          fontFamily: 'IBM Plex Sans',
          fontSize: 12,
          fontWeight: 500,
          color: COLORS.textPrimary,
          width: 240,
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
            const val = api.value(1) as number;
            const low = api.value(2) as number;
            const high = api.value(3) as number;
            const passed = api.value(4) === 1;

            const ptC = api.coord([val, idx]);
            const ptL = api.coord([low, idx]);
            const ptH = api.coord([high, idx]);
            const color = passed ? COLORS.success : COLORS.danger;

            return {
              type: 'group',
              children: [
                {
                  type: 'line',
                  shape: { x1: ptL[0], y1: ptC[1], x2: ptH[0], y2: ptC[1] },
                  style: { stroke: color, lineWidth: 2.5 },
                },
                {
                  type: 'line',
                  shape: { x1: ptL[0], y1: ptC[1] - 6, x2: ptL[0], y2: ptC[1] + 6 },
                  style: { stroke: color, lineWidth: 2 },
                },
                {
                  type: 'line',
                  shape: { x1: ptH[0], y1: ptC[1] - 6, x2: ptH[0], y2: ptC[1] + 6 },
                  style: { stroke: color, lineWidth: 2 },
                },
                {
                  type: 'circle',
                  shape: { cx: ptC[0], cy: ptC[1], r: 7 },
                  style: { fill: color, stroke: '#FFFFFF', lineWidth: 2 },
                },
              ],
            };
          },
          data: rows.map((r, idx) => [idx, r.val, r.low, r.high, r.passed ? 1 : 0]),
          markLine: {
            silent: true,
            symbol: 'none',
            data: [
              {
                xAxis: 0.7,
                lineStyle: { color: COLORS.primary, type: 'dashed', width: 1.8 },
                label: {
                  formatter: 'Corte α ≥ 0,70',
                  fontFamily: 'IBM Plex Mono',
                  fontSize: 10,
                  fontWeight: 600,
                  color: COLORS.primary,
                  position: 'end',
                  distance: 6,
                },
              },
              {
                xAxis: 0.5,
                lineStyle: { color: COLORS.warning, type: 'dotted', width: 1.8 },
                label: {
                  formatter: 'Corte ρ ≥ 0,50',
                  fontFamily: 'IBM Plex Mono',
                  fontSize: 10,
                  fontWeight: 600,
                  color: COLORS.warning,
                  position: 'start',
                  distance: 6,
                },
              },
            ],
          },
        },
      ],
    };
  }, [activeRel]);

  return (
    <div className="space-y-6">
      {hasActiveFilter && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#B6CBE6] bg-[#E8EFF8]/70 px-4 py-2.5 text-xs">
          <span>
            <strong>Modo de confiabilidade:</strong>{' '}
            {inspectFiltered
              ? `Inspecionando subgrupo filtrado (n = ${result.filtered.validCount}).`
              : `Exibindo amostra válida integral (n = ${result.baseline.validCount}) conforme Seção 5.2.`}
          </span>
          <button
            type="button"
            onClick={() => setInspectFiltered((prev) => !prev)}
            className="rounded border border-[#1F4E8C] bg-white px-2.5 py-1 font-semibold text-[#1F4E8C] hover:bg-[#E8EFF8]"
          >
            {inspectFiltered
              ? `Voltar à amostra integral (n = ${result.baseline.validCount})`
              : `Testar no subgrupo filtrado (n = ${result.filtered.validCount})`}
          </button>
        </div>
      )}

      {/* Traffic-light Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard
          label="C_VEL — Velocidade (4 itens)"
          value={`α = ${fmtNum(activeRel.cVel.alpha, 3)}`}
          detail={`IC 95% Bootstrap: ${fmtCI(activeRel.cVel.ci95, 3)}`}
          subdetail={`n completo = ${activeRel.cVel.nComplete} · Corte ≥ 0,70`}
          tone={activeRel.cVel.passedThreshold ? 'success' : 'danger'}
          badge={
            activeRel.cVel.passedThreshold
              ? { label: 'Aprovado (≥ 0,70)', variant: 'success' }
              : { label: 'Abaixo do corte', variant: 'danger' }
          }
        />
        <KpiCard
          label="C_QUAL — Qualidade (6 itens)"
          value={`α = ${fmtNum(activeRel.cQual.alpha, 3)}`}
          detail={`IC 95% Bootstrap: ${fmtCI(activeRel.cQual.ci95, 3)}`}
          subdetail={`n completo = ${activeRel.cQual.nComplete} · Corte ≥ 0,70`}
          tone={activeRel.cQual.passedThreshold ? 'success' : 'danger'}
          badge={
            activeRel.cQual.passedThreshold
              ? { label: 'Aprovado (≥ 0,70)', variant: 'success' }
              : { label: 'Abaixo do corte', variant: 'danger' }
          }
        />
        <KpiCard
          label="M_REV — Rigor de Revisão (2 itens)"
          value={`ρ = ${fmtNum(activeRel.mRev.rho, 3)}`}
          detail={`p = ${fmtPValue(activeRel.mRev.pValue)} · IC 95%: ${fmtCI(activeRel.mRev.ci95, 3)}`}
          subdetail={`n = ${activeRel.mRev.n} · Corte ≥ 0,50`}
          tone={activeRel.mRev.passedThreshold ? 'success' : 'danger'}
          badge={
            activeRel.mRev.passedThreshold
              ? { label: 'Aprovado (≥ 0,50)', variant: 'success' }
              : { label: 'Abaixo do corte', variant: 'danger' }
          }
        />
      </div>

      {/* Dynamic Fallback Status Indicator */}
      {activeRel.anyFallbackActive ? (
        <Callout
          tone="warning"
          title="Status do Fallback (Seção 5.2): ATIVO"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#B8721F]" />
            <div>
              <p>{activeRel.fallbackReason ?? 'Um ou mais construtos ficaram abaixo do limiar de confiabilidade.'}</p>
              <p className="mt-1">
                Ação prevista: se α &lt; 0,70, remover no máximo 1 item apenas se{' '}
                <code className="font-mono-tabular">r_it &lt; 0,30</code> e{' '}
                <code className="font-mono-tabular">Δα ≥ +0,05</code>; caso contrário (ou se{' '}
                <code className="font-mono-tabular">ρ &lt; 0,50</code>), conduzir QP3/QP4 item a item com correção de Bonferroni.
              </p>
            </div>
          </div>
        </Callout>
      ) : (
        <Callout
          tone="success"
          title="Status do Fallback (Seção 5.2): INATIVO"
        >
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#2F7A5C]" />
            <span>
              Todos os construtos superaram os cortes pré-registrados (<code>C_VEL α ≥ 0,70</code>,{' '}
              <code>C_QUAL α ≥ 0,70</code>, <code>M_REV ρ ≥ 0,50</code>). As análises confirmatórias QP3 e QP4 seguem diretamente com os escores compostos dos construtos, sem necessidade de descarte de itens ou análise item a item obrigatória.
            </span>
          </div>
        </Callout>
      )}

      {/* Point-Range Chart */}
      <section className="card-editorial p-5 space-y-4">
        <SectionHeader
          title="Point-Range de Confiabilidade vs Limiares Pré-Registrados"
          subtitle="Estimativa pontual e intervalo de confiança 95% via bootstrap determinístico (B = 5.000)."
          badge={{ label: 'Seção 5.2 · Confiabilidade', variant: 'descriptive' }}
        />
        <EChart
          option={pointRangeOption}
          height={240}
          ariaLabel="Gráfico Point-Range de Alfa de Cronbach e Spearman rho com intervalos de confiança bootstrap"
        />
      </section>

      {/* Diagnostic Item-Drop Tables */}
      <section className="space-y-4">
        <SectionHeader
          title="Tabela Diagnóstica Interativa — “Se item removido”"
          subtitle="Clique nos cabeçalhos numéricos para ordenar por correlação item-total corrigida, α sem o item ou Δα."
          badge={{ label: 'Diagnóstico Psicométrico', variant: 'descriptive' }}
        />
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <DiagnosticTable analysis={activeRel.cVel} />
          <DiagnosticTable analysis={activeRel.cQual} />
        </div>
      </section>
    </div>
  );
}
