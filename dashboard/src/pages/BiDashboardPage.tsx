import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ECElementEvent } from 'echarts';
import { ArrowUpRight, Filter, RotateCcw } from 'lucide-react';
import { EChart } from '../components/EChart';
import type { TabId } from '../components/TabNav';
import { Badge } from '../components/UiPrimitives';
import { BiKpiAndSlicerBar } from '../components/bi/BiKpiAndSlicerBar';
import { BiProfilePanel } from '../components/bi/BiProfilePanel';
import { BiQuoteDrawer } from '../components/bi/BiQuoteDrawer';
import {
  BENEFIT_CODEBOOK,
  RISK_CODEBOOK,
  applyBiClickTarget,
  buildConstructDumbbellOption,
  buildPairedThemeButterflyOption,
  buildQp4JointMatrixOption,
  buildRaincloudOption,
  buildSankeyData,
  buildSankeyOption,
  computeDumbbellSummaries,
  extractClickTarget,
  filterDrawerQuotes,
  type BiDashboardSlice,
  type BiFilterState,
  type ButterflyThemeInput,
  type ClickTargetPayload,
  type OrdinalTierId,
  type SeniorityLevel,
  type SurveyAnalysisResult,
} from '../stats';
import { SENIORITY_COLORS, fmtNum, fmtPValue } from '../utils/format';

export interface BiDashboardPageProps {
  result: SurveyAnalysisResult;
  slice: BiDashboardSlice;
  biFilter: BiFilterState;
  onChangeBiFilter: (next: BiFilterState) => void;
  onResetBiFilter: () => void;
  onSwitchToReport: (tab?: TabId) => void;
}

const ORDINAL_TIERS: Array<{ id: OrdinalTierId; label: string }> = [
  { id: 'low', label: 'Baixo' },
  { id: 'moderate', label: 'Moderado' },
  { id: 'high', label: 'Alto' },
];

function PanelHeader({
  title,
  reportTab,
  reportTitle,
  onSwitchToReport,
  children,
  className = 'mb-2',
}: {
  title: string;
  reportTab: TabId;
  reportTitle: string;
  onSwitchToReport: (tab?: TabId) => void;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`${className} flex flex-wrap items-center justify-between gap-1.5 border-b border-[#EDF1EC] pb-2`}
    >
      <h2 className="truncate text-sm font-semibold text-[#142027]">{title}</h2>
      <div className="flex shrink-0 flex-wrap items-center gap-1">
        {children}
        <button
          type="button"
          onClick={() => onSwitchToReport(reportTab)}
          title={reportTitle}
          aria-label={reportTitle}
          className="rounded p-1 text-[#5C6D75] hover:bg-[#EDF1EC] hover:text-[#1F4E8C]"
        >
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

interface FilterPillItem {
  id: string;
  label: string;
  selected: boolean;
  ariaLabel?: string;
  onClick: () => void;
}

function FilterPillRow({
  groupLabel,
  groupAriaLabel,
  labelClassName,
  selectedClassName,
  unselectedClassName,
  items,
}: {
  groupLabel: string;
  groupAriaLabel: string;
  labelClassName: string;
  selectedClassName: string;
  unselectedClassName: string;
  items: FilterPillItem[];
}) {
  return (
    <div role="group" aria-label={groupAriaLabel} className="flex flex-wrap items-center gap-1">
      <span className={`font-semibold ${labelClassName}`}>{groupLabel}:</span>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-pressed={item.selected}
          aria-label={item.ariaLabel}
          onClick={item.onClick}
          className={`rounded border px-1.5 py-0.5 text-[10px] transition-colors ${
            item.selected ? selectedClassName : unselectedClassName
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function BiDashboardPage({
  result,
  slice,
  biFilter,
  onChangeBiFilter,
  onResetBiFilter,
  onSwitchToReport,
}: BiDashboardPageProps) {
  const [qp3Construct, setQp3Construct] = useState<'C_VEL' | 'C_QUAL'>('C_VEL');
  const [qp3Grouping, setQp3Grouping] = useState<'merged' | 'three'>(() =>
    result.baseline.qp3.mergeApplied ? 'merged' : 'three'
  );
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setQp3Grouping(result.baseline.qp3.mergeApplied ? 'merged' : 'three');
  }, [result.baseline.qp3.mergeApplied]);

  const riskMetaMap = useMemo(() => {
    const map = new Map<string, { label: string; description: string }>();
    for (const c of RISK_CODEBOOK) map.set(c.id, { label: c.label, description: c.description });
    return map;
  }, []);

  const benefitMetaMap = useMemo(() => {
    const map = new Map<string, { label: string; description: string }>();
    for (const c of BENEFIT_CODEBOOK) map.set(c.id, { label: c.label, description: c.description });
    return map;
  }, []);

  const drawerQuotes = useMemo(
    () => filterDrawerQuotes(slice.openCoding, biFilter.riskThemes, biFilter.benefitThemes),
    [slice.openCoding, biFilter.riskThemes, biFilter.benefitThemes]
  );

  const applyTarget = useCallback(
    (target: ClickTargetPayload | null) => {
      const { nextFilter, openedTheme } = applyBiClickTarget(biFilter, target);
      if (nextFilter !== biFilter) onChangeBiFilter(nextFilter);
      if (openedTheme) setDrawerOpen(true);
    },
    [biFilter, onChangeBiFilter]
  );

  const handleBiChartClick = useCallback(
    (params: ECElementEvent) => applyTarget(extractClickTarget(params)),
    [applyTarget]
  );

  const handleClearThemesAndClose = useCallback(() => {
    onChangeBiFilter({ ...biFilter, riskThemes: [], benefitThemes: [] });
    setDrawerOpen(false);
  }, [biFilter, onChangeBiFilter]);

  const dumbbellSummaries = useMemo(
    () => computeDumbbellSummaries(slice.validRespondents, true),
    [slice.validRespondents]
  );

  const dumbbellOption = useMemo(
    () =>
      buildConstructDumbbellOption({
        constructRows: dumbbellSummaries.constructRows,
        selectedSeniorities: biFilter.seniorities,
      }),
    [dumbbellSummaries.constructRows, biFilter.seniorities]
  );

  const qp3MergedAvailable = Boolean(
    slice.qp3.cVelMannWhitneyMerged && slice.qp3.cQualMannWhitneyMerged
  );
  const effectiveQp3Grouping =
    qp3Grouping === 'merged' && qp3MergedAvailable ? 'merged' : 'three';

  const qp3ActiveTest = useMemo(() => {
    if (effectiveQp3Grouping === 'merged') {
      const mw =
        qp3Construct === 'C_VEL'
          ? slice.qp3.cVelMannWhitneyMerged
          : slice.qp3.cQualMannWhitneyMerged;
      if (mw) return { mode: 'mw' as const, result: mw, groups: mw.groups };
    }
    const kw =
      qp3Construct === 'C_VEL'
        ? slice.qp3.cVelKruskalWallis
        : slice.qp3.cQualKruskalWallis;
    return { mode: 'kw' as const, result: kw, groups: kw.groups };
  }, [effectiveQp3Grouping, qp3Construct, slice.qp3]);

  const qp3BaselinePValue = useMemo(() => {
    if (effectiveQp3Grouping === 'merged') {
      const baseMw =
        qp3Construct === 'C_VEL'
          ? result.baseline.qp3.cVelMannWhitneyMerged
          : result.baseline.qp3.cQualMannWhitneyMerged;
      if (baseMw) return baseMw.pValue;
    }
    return (
      qp3Construct === 'C_VEL'
        ? result.baseline.qp3.cVelKruskalWallis
        : result.baseline.qp3.cQualKruskalWallis
    ).pValue;
  }, [effectiveQp3Grouping, qp3Construct, result.baseline.qp3]);

  const qp3ActiveGroupsCount = qp3ActiveTest.groups.filter((g) => g.n > 0).length;
  const qp3CanCompare =
    qp3ActiveGroupsCount >= 2 && qp3ActiveTest.result.pValue !== null;

  const raincloudOption = useMemo(
    () =>
      buildRaincloudOption({
        groups: qp3ActiveTest.groups,
        selectedSeniorities: biFilter.seniorities,
        compact: true,
      }),
    [qp3ActiveTest.groups, biFilter.seniorities]
  );

  const qp4Option = useMemo(
    () =>
      buildQp4JointMatrixOption({
        scatterPoints: slice.qp4.scatterPoints,
        activeMRevTiers: biFilter.mRevTiers,
        activeCQualTiers: biFilter.cQualTiers,
        compact: true,
      }),
    [slice.qp4.scatterPoints, biFilter.mRevTiers, biFilter.cQualTiers]
  );

  const sankeyGraph = useMemo(
    () => buildSankeyData(slice.validRespondents, slice.normalizeTools),
    [slice.validRespondents, slice.normalizeTools]
  );

  const sankeyOption = useMemo(
    () =>
      buildSankeyOption({
        graph: sankeyGraph,
        activeBiFilter: biFilter,
        compact: true,
      }),
    [sankeyGraph, biFilter]
  );

  const butterflyInputs = useMemo(() => {
    const riskThemes: ButterflyThemeInput[] = slice.facetProfiles.riskThemes.map((item) => ({
      ...item,
      description: riskMetaMap.get(item.id)?.description,
    }));
    const benefitThemes: ButterflyThemeInput[] = slice.facetProfiles.benefitThemes.map(
      (item) => ({
        ...item,
        description: benefitMetaMap.get(item.id)?.description,
      })
    );
    return { riskThemes, benefitThemes };
  }, [
    slice.facetProfiles.riskThemes,
    slice.facetProfiles.benefitThemes,
    riskMetaMap,
    benefitMetaMap,
  ]);

  const butterflyOption = useMemo(
    () =>
      buildPairedThemeButterflyOption({
        riskThemes: butterflyInputs.riskThemes,
        benefitThemes: butterflyInputs.benefitThemes,
        selectedRiskThemes: biFilter.riskThemes,
        selectedBenefitThemes: biFilter.benefitThemes,
        compact: true,
      }),
    [butterflyInputs, biFilter.riskThemes, biFilter.benefitThemes]
  );

  return (
    <div className="space-y-3.5">
      <BiKpiAndSlicerBar
        result={result}
        slice={slice}
        biFilter={biFilter}
        substantiveQuotesCount={drawerQuotes.length}
        riskMetaMap={riskMetaMap}
        benefitMetaMap={benefitMetaMap}
        onChangeBiFilter={onChangeBiFilter}
        onResetBiFilter={onResetBiFilter}
        onOpenDrawer={() => setDrawerOpen(true)}
      />

      {slice.validCount === 0 ? (
        <section className="card-editorial flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
          <div className="rounded-full bg-[#FBF2E4] p-3 text-[#B8721F]">
            <Filter className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 className="text-base font-semibold text-[#142027]">
            Nenhum respondente corresponde à interseção atual de filtros (n = 0)
          </h2>
          <p className="max-w-md text-xs text-[#5C6D75]">
            A combinação selecionada nos gráficos não possui respondentes válidos. Restaure os filtros para retomar a exploração completa da amostra.
          </p>
          <button
            type="button"
            onClick={onResetBiFilter}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1F4E8C] px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#183E70]"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Limpar filtros (Restaurar n = {slice.baselineValidCount})
          </button>
        </section>
      ) : (
        <section
          aria-label="Grade analítica BI 2x3"
          className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3"
        >
          {/* Panel 1 — Perfil & Adoção */}
          <BiProfilePanel
            slice={slice}
            biFilter={biFilter}
            onChangeBiFilter={onChangeBiFilter}
            onChartClick={handleBiChartClick}
            onSwitchToReport={onSwitchToReport}
          />

          {/* Panel 2 — QP1 vs QP2: Assimetria Velocidade × Qualidade */}
          <article className="card-editorial flex flex-col p-3.5">
            <PanelHeader
              title="QP1 vs QP2 · Velocidade × Qualidade"
              reportTab="likert"
              reportTitle="Ver detalhamento Likert QP1 & QP2 no Relatório"
              onSwitchToReport={onSwitchToReport}
            >
              <Badge variant="exploratory" className="px-1.5 py-0 font-mono-tabular text-[10px]">
                {slice.pairedVelVsQual.velGreaterCount}/{slice.pairedVelVsQual.n} VEL&gt;QUAL
              </Badge>
            </PanelHeader>

            <EChart
              option={dumbbellOption}
              height={232}
              ariaLabel="Dumbbell comparando medianas de C_QUAL e C_VEL por senioridade"
              onChartClick={handleBiChartClick}
            />

            <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#5C6D75]">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#2F7A5C]" />
                  Mediana C_QUAL
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rotate-45 bg-[#1F4E8C]" />
                  Mediana C_VEL
                </span>
              </div>
              <span className="font-mono-tabular">Clique na senioridade p/ filtrar</span>
            </div>
          </article>

          {/* Panel 3 — QP3: Distribuição Raincloud por Senioridade */}
          <article className="card-editorial flex flex-col p-3.5">
            <PanelHeader
              title="QP3 · Raincloud por Senioridade"
              reportTab="confirmatory"
              reportTitle="Ver testes confirmatórios QP3 no Relatório"
              onSwitchToReport={onSwitchToReport}
              className="mb-1.5"
            >
              <div
                role="group"
                aria-label="Construto QP3"
                className="inline-flex rounded-md border border-[#D5DDD6] bg-[#EDF1EC] p-0.5 text-[10px] font-semibold"
              >
                {(['C_VEL', 'C_QUAL'] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={qp3Construct === c}
                    onClick={() => setQp3Construct(c)}
                    className={`rounded px-1.5 py-0.5 transition-colors ${
                      qp3Construct === c
                        ? 'bg-white text-[#1F4E8C] shadow-xs'
                        : 'text-[#43535B] hover:text-[#142027]'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <div
                role="group"
                aria-label="Agrupamento de senioridade QP3"
                className="inline-flex rounded-md border border-[#D5DDD6] bg-[#EDF1EC] p-0.5 text-[10px] font-semibold"
              >
                <button
                  type="button"
                  disabled={!qp3MergedAvailable}
                  aria-pressed={effectiveQp3Grouping === 'merged'}
                  onClick={() => setQp3Grouping('merged')}
                  className={`rounded px-1.5 py-0.5 transition-colors ${
                    effectiveQp3Grouping === 'merged'
                      ? 'bg-white text-[#1F4E8C] shadow-xs'
                      : 'text-[#43535B] hover:text-[#142027]'
                  } ${!qp3MergedAvailable ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                  Jr+Pl vs Sr
                </button>
                <button
                  type="button"
                  aria-pressed={effectiveQp3Grouping === 'three'}
                  onClick={() => setQp3Grouping('three')}
                  className={`rounded px-1.5 py-0.5 transition-colors ${
                    effectiveQp3Grouping === 'three'
                      ? 'bg-white text-[#1F4E8C] shadow-xs'
                      : 'text-[#43535B] hover:text-[#142027]'
                  }`}
                >
                  3 Níveis
                </button>
              </div>
            </PanelHeader>

            <div className="mb-1 flex flex-wrap items-center justify-between gap-1 text-[10px]">
              {!qp3CanCompare ? (
                <Badge variant="warning" className="px-1.5 py-0 text-[10px]">
                  Comparação N/A ({qp3ActiveGroupsCount} grupo
                  {qp3ActiveGroupsCount === 1 ? '' : 's'} ativo
                  {qp3ActiveGroupsCount === 1 ? '' : 's'})
                </Badge>
              ) : qp3ActiveTest.mode === 'mw' ? (
                <Badge variant="confirmatory" className="px-1.5 py-0 font-mono-tabular text-[10px]">
                  MW U={fmtNum(qp3ActiveTest.result.u, 1)}, p={fmtPValue(qp3ActiveTest.result.pValue)}
                </Badge>
              ) : (
                <Badge variant="confirmatory" className="px-1.5 py-0 font-mono-tabular text-[10px]">
                  KW H={fmtNum(qp3ActiveTest.result.h, 2)}, p={fmtPValue(qp3ActiveTest.result.pValue)}
                </Badge>
              )}
              <span className="font-mono-tabular text-[#5C6D75]">
                Base n={slice.baselineValidCount}: p={fmtPValue(qp3BaselinePValue)}
              </span>
            </div>

            <EChart
              option={raincloudOption}
              height={232}
              ariaLabel="Raincloud plot de QP3 por grupo de senioridade"
              onChartClick={handleBiChartClick}
            />
          </article>

          {/* Panel 4 — QP4: Matriz Conjunta M_REV × C_QUAL + Marginais */}
          <article className="card-editorial flex flex-col p-3.5">
            <PanelHeader
              title="QP4 · Matriz M_REV × C_QUAL"
              reportTab="confirmatory"
              reportTitle="Ver testes confirmatórios QP4 no Relatório"
              onSwitchToReport={onSwitchToReport}
              className="mb-1.5"
            />

            <div className="mb-1 flex flex-wrap items-center justify-between gap-1 text-[10px]">
              {slice.qp4.main.rho === null ? (
                <Badge variant="warning" className="px-1.5 py-0 text-[10px]">
                  ρ = N/A (n &lt; 3 ou var. zero)
                </Badge>
              ) : (
                <Badge variant="confirmatory" className="px-1.5 py-0 font-mono-tabular text-[10px]">
                  ρ = {fmtNum(slice.qp4.main.rho, 3)} (p = {fmtPValue(slice.qp4.main.pValue)})
                </Badge>
              )}
              <span className="font-mono-tabular text-[#5C6D75]">
                Base n={slice.baselineValidCount}: ρ={fmtNum(result.baseline.qp4.main.rho, 3)}
              </span>
            </div>

            <EChart
              option={qp4Option}
              height={208}
              ariaLabel="Matriz conjunta QP4 de M_REV versus C_QUAL com marginais"
              onChartClick={handleBiChartClick}
            />

            <div className="mt-1 space-y-1.5 text-[10px]">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[#5C6D75]">
                <div className="flex items-center gap-2">
                  {(['Júnior', 'Pleno', 'Sênior'] as SeniorityLevel[]).map((sen) => (
                    <span key={sen} className="inline-flex items-center gap-1">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: SENIORITY_COLORS[sen] }}
                      />
                      {sen}
                    </span>
                  ))}
                </div>
                <span className="inline-flex items-center gap-1 font-mono-tabular">
                  <span className="inline-block w-3 border-t-2 border-dashed border-[#142027]" />
                  OLS · bolha = empates
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-[#EDF1EC] pt-1.5">
                <FilterPillRow
                  groupLabel="M_REV"
                  groupAriaLabel="Filtrar faixas de M_REV"
                  labelClassName="text-[#5C6D75]"
                  selectedClassName="border-[#1F4E8C] bg-[#E8EFF8] font-semibold text-[#183E70]"
                  unselectedClassName="border-[#D5DDD6] bg-[#FAFBF9] text-[#43535B] hover:border-[#1F4E8C] hover:text-[#1F4E8C]"
                  items={ORDINAL_TIERS.map((tier) => ({
                    id: tier.id,
                    label: tier.label,
                    selected: biFilter.mRevTiers.includes(tier.id),
                    ariaLabel: `Filtrar rigor M_REV ${tier.label}`,
                    onClick: () => applyTarget({ kind: 'mRevTier', value: tier.id }),
                  }))}
                />
                <FilterPillRow
                  groupLabel="C_QUAL"
                  groupAriaLabel="Filtrar faixas de C_QUAL"
                  labelClassName="text-[#5C6D75]"
                  selectedClassName="border-[#2F7A5C] bg-[#E8F4EE] font-semibold text-[#184E38]"
                  unselectedClassName="border-[#D5DDD6] bg-[#FAFBF9] text-[#43535B] hover:border-[#2F7A5C] hover:text-[#184E38]"
                  items={ORDINAL_TIERS.map((tier) => ({
                    id: tier.id,
                    label: tier.label,
                    selected: biFilter.cQualTiers.includes(tier.id),
                    ariaLabel: `Filtrar qualidade C_QUAL ${tier.label}`,
                    onClick: () => applyTarget({ kind: 'cQualTier', value: tier.id }),
                  }))}
                />
              </div>
            </div>
          </article>

          {/* Panel 5 — Fluxo Multidimensional (Sankey 4 Estágios) */}
          <article className="card-editorial flex flex-col p-3.5">
            <PanelHeader
              title="Fluxo Multidimensional (Sankey)"
              reportTab="open_exploratory"
              reportTitle="Ver análises exploratórias no Relatório"
              onSwitchToReport={onSwitchToReport}
            >
              <Badge variant="exploratory" className="px-1.5 py-0 text-[10px]">
                4 Estágios
              </Badge>
            </PanelHeader>

            <EChart
              option={sankeyOption}
              height={235}
              ariaLabel="Diagrama Sankey de 4 estágios: Senioridade, Ferramenta, Rigor e Qualidade"
              onChartClick={handleBiChartClick}
            />

            <div className="mt-1 flex items-center justify-between text-[10px] text-[#5C6D75]">
              <span>Senioridade → Ferramenta → M_REV → C_QUAL</span>
              <span className="font-mono-tabular">Clique no nó p/ filtrar</span>
            </div>
          </article>

          {/* Panel 6 — Riscos vs Benefícios (Temas Abertos) */}
          <article className="card-editorial flex flex-col p-3.5">
            <PanelHeader
              title="Riscos vs Benefícios (Abertas)"
              reportTab="open_exploratory"
              reportTitle="Ver codificação aberta completa no Relatório"
              onSwitchToReport={onSwitchToReport}
            >
              <Badge variant="exploratory" className="px-1.5 py-0 font-mono-tabular text-[10px]">
                {slice.openCoding.risks.substantiveCount}R · {slice.openCoding.benefits.substantiveCount}B
              </Badge>
            </PanelHeader>

            <EChart
              option={butterflyOption}
              height={212}
              ariaLabel="Gráfico borboleta pareado de temas de risco e benefício"
              onChartClick={handleBiChartClick}
            />

            <div className="mt-1 space-y-1.5 border-t border-[#EDF1EC] pt-1.5 text-[10px]">
              <FilterPillRow
                groupLabel="Riscos"
                groupAriaLabel="Filtrar temas de risco"
                labelClassName="text-[#9A2E2E]"
                selectedClassName="border-[#9A2E2E] bg-[#FBEAEA] font-semibold text-[#7A1D1D]"
                unselectedClassName="border-[#E7BBBB]/80 bg-[#FAFBF9] text-[#43535B] hover:border-[#9A2E2E] hover:text-[#7A1D1D]"
                items={slice.facetProfiles.riskThemes.map((item) => ({
                  id: item.id,
                  label: `${item.label} (${item.count})`,
                  selected: item.selected,
                  onClick: () => applyTarget({ kind: 'riskTheme', themeId: item.id, label: item.label }),
                }))}
              />
              <FilterPillRow
                groupLabel="Benefícios"
                groupAriaLabel="Filtrar temas de benefício"
                labelClassName="text-[#184E38]"
                selectedClassName="border-[#2F7A5C] bg-[#E8F4EE] font-semibold text-[#184E38]"
                unselectedClassName="border-[#B5DAC8]/80 bg-[#FAFBF9] text-[#43535B] hover:border-[#2F7A5C] hover:text-[#184E38]"
                items={slice.facetProfiles.benefitThemes.map((item) => ({
                  id: item.id,
                  label: `${item.label} (${item.count})`,
                  selected: item.selected,
                  onClick: () => applyTarget({ kind: 'benefitTheme', themeId: item.id, label: item.label }),
                }))}
              />
            </div>
          </article>
        </section>
      )}

      <BiQuoteDrawer
        open={drawerOpen}
        quotes={drawerQuotes}
        biFilter={biFilter}
        validCount={slice.validCount}
        riskMetaMap={riskMetaMap}
        benefitMetaMap={benefitMetaMap}
        onClose={() => setDrawerOpen(false)}
        onClearThemesAndClose={handleClearThemesAndClose}
      />
    </div>
  );
}
