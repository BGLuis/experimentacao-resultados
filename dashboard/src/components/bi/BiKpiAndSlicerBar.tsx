import { useMemo } from 'react';
import { Filter, MessageSquareQuote, RotateCcw, Sparkles, X } from 'lucide-react';
import { Badge } from '../UiPrimitives';
import {
  FREQUENCY_SHORT_LABELS,
  ORDINAL_TIER_SHORT_LABELS,
  type BiDashboardSlice,
  type BiFilterState,
  type SurveyAnalysisResult,
} from '../../stats';
import { fmtNum, fmtPValue, fmtPct } from '../../utils/format';

export interface BiKpiAndSlicerBarProps {
  result: SurveyAnalysisResult;
  slice: BiDashboardSlice;
  biFilter: BiFilterState;
  substantiveQuotesCount: number;
  riskMetaMap: ReadonlyMap<string, { label: string; description: string }>;
  benefitMetaMap: ReadonlyMap<string, { label: string; description: string }>;
  onChangeBiFilter: (next: BiFilterState) => void;
  onResetBiFilter: () => void;
  onOpenDrawer: () => void;
}

interface FilterChipItem {
  key: string;
  category: string;
  value: string;
  label: string;
  onRemove: () => void;
}

export function BiKpiAndSlicerBar({
  result,
  slice,
  biFilter,
  substantiveQuotesCount,
  riskMetaMap,
  benefitMetaMap,
  onChangeBiFilter,
  onResetBiFilter,
  onOpenDrawer,
}: BiKpiAndSlicerBarProps) {
  const activeChips = useMemo<FilterChipItem[]>(() => {
    const chips: FilterChipItem[] = [];

    const pushChips = <K extends keyof BiFilterState>(
      dim: K,
      category: string,
      formatValue: (val: BiFilterState[K][number]) => string
    ) => {
      for (const item of biFilter[dim]) {
        const display = formatValue(item);
        chips.push({
          key: `${String(dim)}:${String(item)}`,
          category,
          value: display,
          label: `${category}: ${display}`,
          onRemove: () =>
            onChangeBiFilter({
              ...biFilter,
              [dim]: (biFilter[dim] as unknown[]).filter((x) => x !== item),
            }),
        });
      }
    };

    pushChips('seniorities', 'Senioridade', (s) => s);
    pushChips('tools', 'Ferramenta', (t) => t);
    pushChips('frequencies', 'Frequência', (f) => FREQUENCY_SHORT_LABELS[f] ?? f);
    pushChips('mRevTiers', 'Rigor M_REV', (t) => ORDINAL_TIER_SHORT_LABELS[t]);
    pushChips('cQualTiers', 'Qualidade C_QUAL', (t) => ORDINAL_TIER_SHORT_LABELS[t]);
    pushChips('riskThemes', 'Risco', (id) => riskMetaMap.get(id)?.label ?? id);
    pushChips('benefitThemes', 'Benefício', (id) => benefitMetaMap.get(id)?.label ?? id);

    return chips;
  }, [biFilter, onChangeBiFilter, riskMetaMap, benefitMetaMap]);

  const velGreaterPct =
    slice.pairedVelVsQual.n > 0
      ? (slice.pairedVelVsQual.velGreaterCount / slice.pairedVelVsQual.n) * 100
      : null;

  return (
    <>
      {/* Top Compact 6-KPI Strip */}
      <section aria-label="Indicadores executivos da fatia ativa">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
          {/* 1. Amostra Ativa */}
          <div
            className={`card-editorial border-t-[3px] px-3 py-2.5 ${
              slice.lowSampleWarning
                ? 'border-t-[#B8721F]'
                : slice.hasActiveFilter
                  ? 'border-t-[#1F4E8C]'
                  : 'border-t-[#2F7A5C]'
            }`}
          >
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#5C6D75]">
                Amostra Ativa (n)
              </span>
              {slice.lowSampleWarning ? (
                <Badge variant="warning" className="px-1.5 py-0 text-[10px]">
                  n &lt; 5 (Instável)
                </Badge>
              ) : slice.hasActiveFilter ? (
                <Badge variant="confirmatory" className="px-1.5 py-0 text-[10px]">
                  Fatia Filtrada
                </Badge>
              ) : (
                <Badge variant="success" className="px-1.5 py-0 text-[10px]">
                  Amostra Integral
                </Badge>
              )}
            </div>
            <div className="mt-1 font-mono-tabular text-lg font-bold tracking-tight text-[#142027]">
              {slice.validCount} / {slice.baselineValidCount}{' '}
              <span className="font-sans text-xs font-medium text-[#5C6D75]">válidas</span>
            </div>
            <div className="mt-0.5 text-[11px] text-[#5C6D75]">
              {slice.hasActiveFilter
                ? 'Fatia exploratória interativa'
                : 'Base completa validada'}
            </div>
          </div>

          {/* 2. Margem de Erro */}
          <div className="card-editorial border-t-[3px] border-t-[#B8721F] px-3 py-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#5C6D75]">
              Margem de Erro (IC 95%)
            </div>
            <div className="mt-1 font-mono-tabular text-lg font-bold tracking-tight text-[#142027]">
              ±{fmtNum(slice.marginOfErrorPct, 2)} p.p.
            </div>
            <div className="mt-0.5 font-mono-tabular text-[11px] text-[#5C6D75]">
              p = 0,5 · z = 1,96
            </div>
          </div>

          {/* 3. Velocidade (C_VEL) */}
          <div className="card-editorial border-t-[3px] border-t-[#1F4E8C] px-3 py-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#5C6D75]">
              Velocidade (C_VEL)
            </div>
            <div className="mt-1 font-mono-tabular text-lg font-bold tracking-tight text-[#1F4E8C]">
              Mediana {fmtNum(slice.cVelStats.median, 2)}
            </div>
            <div className="mt-0.5 font-mono-tabular text-[11px] text-[#43535B]">
              {fmtPct(slice.cVelStats.agreementPct, 1)} concord. (≥ 4)
            </div>
          </div>

          {/* 4. Qualidade (C_QUAL) */}
          <div className="card-editorial border-t-[3px] border-t-[#2F7A5C] px-3 py-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#5C6D75]">
              Qualidade (C_QUAL)
            </div>
            <div className="mt-1 font-mono-tabular text-lg font-bold tracking-tight text-[#2F7A5C]">
              Mediana {fmtNum(slice.cQualStats.median, 2)}
            </div>
            <div className="mt-0.5 font-mono-tabular text-[11px] text-[#43535B]">
              {fmtPct(slice.cQualStats.agreementPct, 1)} concord. (≥ 4)
            </div>
          </div>

          {/* 5. Assimetria VEL > QUAL */}
          <div className="card-editorial border-t-[3px] border-t-[#1F4E8C] px-3 py-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#5C6D75]">
              Assimetria (VEL &gt; QUAL)
            </div>
            <div className="mt-1 font-mono-tabular text-lg font-bold tracking-tight text-[#142027]">
              {slice.pairedVelVsQual.velGreaterCount}/{slice.pairedVelVsQual.n}{' '}
              <span className="text-xs font-semibold text-[#1F4E8C]">
                ({velGreaterPct !== null ? fmtPct(velGreaterPct, 0) : '—'})
              </span>
            </div>
            <div className="mt-0.5 font-mono-tabular text-[11px] text-[#43535B]">
              Wilcoxon p = {fmtPValue(slice.pairedVelVsQual.pValue)}
            </div>
          </div>

          {/* 6. Rigor × Qualidade (QP4) */}
          <div className="card-editorial border-t-[3px] border-t-[#5C6D75] px-3 py-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#5C6D75]">
              Rigor × Qualidade (QP4)
            </div>
            <div className="mt-1 font-mono-tabular text-lg font-bold tracking-tight text-[#142027]">
              ρ = {slice.qp4.main.rho !== null ? fmtNum(slice.qp4.main.rho, 3) : 'N/A'}
            </div>
            <div className="mt-0.5 truncate font-mono-tabular text-[11px] text-[#43535B]">
              p = {fmtPValue(slice.qp4.main.pValue)} · Base n={slice.baselineValidCount}: ρ=
              {fmtNum(result.baseline.qp4.main.rho, 3)}
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Cross-Filter Chip Strip */}
      <section
        aria-label="Filtros ativos do BI"
        className="card-editorial flex flex-wrap items-center justify-between gap-2 px-3.5 py-2"
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[#5C6D75]">
            <Filter className="h-3.5 w-3.5 text-[#1F4E8C]" aria-hidden="true" />
            Slicers:
          </span>

          {!slice.hasActiveFilter ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-[#43535B]">
              <Sparkles className="h-3.5 w-3.5 text-[#1F4E8C]" aria-hidden="true" />
              Clique em qualquer barra, grupo, bolha, nó do Sankey ou tema para filtrar todos os painéis
            </span>
          ) : (
            <>
              {activeChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={chip.onRemove}
                  aria-label={`Remover filtro ${chip.category}: ${chip.value}`}
                  className="inline-flex items-center gap-1 rounded-full border border-[#B6CBE6] bg-[#E8EFF8] px-2.5 py-0.5 text-xs font-semibold text-[#1F4E8C] transition-colors hover:bg-[#DCE7F5]"
                >
                  <span>{chip.label}</span>
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              ))}
              <button
                type="button"
                onClick={onResetBiFilter}
                className="inline-flex items-center gap-1 rounded-full border border-[#E7BBBB] bg-[#FBEAEA] px-2.5 py-0.5 text-xs font-semibold text-[#9A2E2E] transition-colors hover:bg-[#F7DADA]"
              >
                <RotateCcw className="h-3 w-3" aria-hidden="true" />
                Limpar todos os filtros
              </button>
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onOpenDrawer}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#D5DDD6] bg-[#EDF1EC] px-2.5 py-1 text-xs font-semibold text-[#142027] transition-colors hover:border-[#1F4E8C] hover:bg-[#E8EFF8] hover:text-[#1F4E8C]"
          >
            <MessageSquareQuote className="h-3.5 w-3.5 text-[#1F4E8C]" aria-hidden="true" />
            <span>Relatos Literais ({substantiveQuotesCount})</span>
          </button>
        </div>
      </section>
    </>
  );
}
