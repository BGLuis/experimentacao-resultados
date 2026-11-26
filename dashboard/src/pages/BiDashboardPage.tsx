import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ECElementEvent, EChartsOption } from 'echarts';
import {
  ArrowUpRight,
  Filter,
  MessageSquareQuote,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import { EChart } from '../components/EChart';
import type { TabId } from '../components/TabNav';
import { Badge } from '../components/UiPrimitives';
import {
  BENEFIT_CODEBOOK,
  ORDINAL_TIER_SHORT_LABELS,
  RISK_CODEBOOK,
  buildConstructDumbbellOption,
  buildPairedThemeButterflyOption,
  buildQp4JointMatrixOption,
  buildRaincloudOption,
  buildSankeyData,
  buildSankeyOption,
  computeDumbbellSummaries,
  toggleArrayItem,
  toggleArrayPair,
} from '../stats';
import type {
  BiDashboardSlice,
  BiFacetBarItem,
  BiFilterState,
  ButterflyThemeInput,
  CodedResponse,
  OrdinalTierId,
  SankeyNodeDatum,
  SeniorityLevel,
  SurveyAnalysisResult,
} from '../stats';
import {
  COLORS,
  SENIORITY_COLORS,
  escapeHtml,
  fmtNum,
  fmtPValue,
  fmtPct,
} from '../utils/format';

export interface BiDashboardPageProps {
  result: SurveyAnalysisResult;
  slice: BiDashboardSlice;
  biFilter: BiFilterState;
  onChangeBiFilter: (next: BiFilterState) => void;
  onResetBiFilter: () => void;
  onSwitchToReport: (tab?: TabId) => void;
}

type ProfileDimensionView = 'all' | 'seniorities' | 'tools' | 'frequencies';

interface DrawerThemeFocus {
  type: 'risk' | 'benefit';
  themeId: string;
  label: string;
}

interface FilterChipItem {
  key: string;
  label: string;
  onRemove: () => void;
}

const FREQUENCY_SHORT_LABELS: Record<string, string> = {
  'Todos os dias úteis': 'Todos dias úteis',
  '4 a 5 dias por semana': '4–5 dias/sem',
  '1 a 3 dias por semana': '1–3 dias/sem',
  'Menos de 1 dia por semana': '< 1 dia/sem',
};

function buildSingleFacetBarOption(
  dimensionLabel: string,
  items: BiFacetBarItem[],
  resolveColor: (id: string) => string,
  dimensionKind: 'seniority' | 'tool' | 'frequency'
): EChartsOption {
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
        return `<div style="font-family:'IBM Plex Sans',sans-serif;font-size:12px;">
          <strong>${escapeHtml(dimensionLabel)}: ${escapeHtml(item.label)}</strong><br/>
          Respondentes (leave-one-out): <strong style="font-family:'IBM Plex Mono',monospace;">${item.count}</strong>
          (<span style="font-family:'IBM Plex Mono',monospace;">${fmtPct(item.pct, 1)}</span>)
        </div>`;
      },
    },
    grid: { left: 6, right: 48, top: 8, bottom: 16, containLabel: true },
    xAxis: {
      type: 'value',
      min: 0,
      max: Math.ceil(maxCount * 1.15),
      minInterval: 1,
      axisLabel: {
        fontFamily: 'IBM Plex Mono',
        fontSize: 10,
        color: COLORS.textMuted,
      },
      splitLine: { lineStyle: { color: '#EDF1EC' } },
    },
    yAxis: {
      type: 'category',
      data: ordered.map((d) => d.label),
      axisLabel: {
        fontFamily: 'IBM Plex Sans',
        fontSize: 10.5,
        color: COLORS.textPrimary,
        width: 118,
        overflow: 'truncate',
      },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: COLORS.border } },
    },
    series: [
      {
        type: 'bar',
        barMaxWidth: 20,
        data: ordered.map((d) => ({
          value: d.count,
          item: d,
          clickTarget: { kind: dimensionKind, value: d.id },
          itemStyle: {
            color: resolveColor(d.id),
            opacity: d.dimmed ? 0.35 : 0.92,
            borderColor: d.selected ? '#142027' : 'transparent',
            borderWidth: d.selected ? 1.5 : 0,
            borderRadius: [0, 4, 4, 0],
          },
        })),
        label: {
          show: true,
          position: 'right',
          fontFamily: 'IBM Plex Mono',
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

function FacetBarList({
  title,
  items,
  maxCount,
  resolveColor,
  shortLabels,
  onToggle,
}: {
  title: string;
  items: BiFacetBarItem[];
  maxCount: number;
  resolveColor: (id: string) => string;
  shortLabels?: Record<string, string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[#5C6D75]">
        {title}
      </div>
      <div className="space-y-1">
        {items.map((item) => {
          const widthPct = maxCount > 0 ? Math.max(item.count > 0 ? 6 : 0, (item.count / maxCount) * 100) : 0;
          const displayLabel = shortLabels?.[item.label] ?? item.label;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onToggle(item.id)}
              aria-pressed={item.selected}
              title={`${item.label}: ${item.count} (${fmtPct(item.pct, 1)})`}
              style={{ opacity: item.dimmed ? 0.35 : 1 }}
              className={`group w-full rounded-md border px-2 py-1 text-left transition-all ${
                item.selected
                  ? 'border-[#142027] bg-[#E8EFF8]/70 shadow-[0_0_0_1px_#142027]'
                  : 'border-transparent bg-[#FAFBF9] hover:border-[#B6CBE6] hover:bg-[#F3F7FB]'
              }`}
            >
              <div className="flex items-center justify-between gap-1.5 text-[11px]">
                <span className="truncate font-medium text-[#142027]">
                  {displayLabel}
                </span>
                <span className="shrink-0 font-mono-tabular text-[10px] font-semibold text-[#43535B]">
                  {item.count}{' '}
                  <span className="text-[#5C6D75]">({fmtPct(item.pct, 0)})</span>
                </span>
              </div>
              <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-[#E5ECE6]">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor: resolveColor(item.id),
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>
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
  const [profileView, setProfileView] = useState<ProfileDimensionView>('all');
  const [qp3Construct, setQp3Construct] = useState<'C_VEL' | 'C_QUAL'>('C_VEL');
  const [qp3Grouping, setQp3Grouping] = useState<'merged' | 'three'>(() =>
    result.baseline.qp3.mergeApplied ? 'merged' : 'three'
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeDrawerTheme, setActiveDrawerTheme] = useState<DrawerThemeFocus | null>(null);

  useEffect(() => {
    setQp3Grouping(result.baseline.qp3.mergeApplied ? 'merged' : 'three');
  }, [result.baseline.qp3.mergeApplied]);

  useEffect(() => {
    if (!drawerOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [drawerOpen]);

  const riskMetaMap = useMemo(() => {
    const map = new Map<string, { label: string; description: string }>();
    for (const c of RISK_CODEBOOK) {
      map.set(c.id, { label: c.label, description: c.description });
    }
    return map;
  }, []);

  const benefitMetaMap = useMemo(() => {
    const map = new Map<string, { label: string; description: string }>();
    for (const c of BENEFIT_CODEBOOK) {
      map.set(c.id, { label: c.label, description: c.description });
    }
    return map;
  }, []);

  // Quotes for Slide-Over Quote Drawer (filtered by active theme filters if present)
  const drawerQuotes = useMemo(() => {
    const hasRisk = biFilter.riskThemes.length > 0;
    const hasBenefit = biFilter.benefitThemes.length > 0;
    const includeRisk = hasRisk || !hasBenefit;
    const includeBenefit = hasBenefit || !hasRisk;

    const items: Array<{ type: 'risk' | 'benefit'; item: CodedResponse }> = [];
    if (includeRisk) {
      for (const r of slice.openCoding.risks.responses) {
        if (r.isBlankOrNoise) continue;
        if (hasRisk && !r.themes.some((t) => biFilter.riskThemes.includes(t))) continue;
        items.push({ type: 'risk', item: r });
      }
    }
    if (includeBenefit) {
      for (const b of slice.openCoding.benefits.responses) {
        if (b.isBlankOrNoise) continue;
        if (hasBenefit && !b.themes.some((t) => biFilter.benefitThemes.includes(t))) continue;
        items.push({ type: 'benefit', item: b });
      }
    }
    return items;
  }, [slice.openCoding, biFilter.riskThemes, biFilter.benefitThemes]);

  const substantiveQuotesCount = drawerQuotes.length;

  // Active cross-filter chips across all 7 dimensions
  const activeChips = useMemo<FilterChipItem[]>(() => {
    const chips: FilterChipItem[] = [];

    for (const sen of biFilter.seniorities) {
      chips.push({
        key: `sen:${sen}`,
        label: `Senioridade: ${sen}`,
        onRemove: () =>
          onChangeBiFilter({
            ...biFilter,
            seniorities: biFilter.seniorities.filter((s) => s !== sen),
          }),
      });
    }

    for (const tool of biFilter.tools) {
      chips.push({
        key: `tool:${tool}`,
        label: `Ferramenta: ${tool}`,
        onRemove: () =>
          onChangeBiFilter({
            ...biFilter,
            tools: biFilter.tools.filter((t) => t !== tool),
          }),
      });
    }

    for (const freq of biFilter.frequencies) {
      chips.push({
        key: `freq:${freq}`,
        label: `Frequência: ${FREQUENCY_SHORT_LABELS[freq] ?? freq}`,
        onRemove: () =>
          onChangeBiFilter({
            ...biFilter,
            frequencies: biFilter.frequencies.filter((f) => f !== freq),
          }),
      });
    }

    for (const tier of biFilter.mRevTiers) {
      chips.push({
        key: `mrev:${tier}`,
        label: `Rigor M_REV: ${ORDINAL_TIER_SHORT_LABELS[tier]}`,
        onRemove: () =>
          onChangeBiFilter({
            ...biFilter,
            mRevTiers: biFilter.mRevTiers.filter((t) => t !== tier),
          }),
      });
    }

    for (const tier of biFilter.cQualTiers) {
      chips.push({
        key: `cqual:${tier}`,
        label: `Qualidade C_QUAL: ${ORDINAL_TIER_SHORT_LABELS[tier]}`,
        onRemove: () =>
          onChangeBiFilter({
            ...biFilter,
            cQualTiers: biFilter.cQualTiers.filter((t) => t !== tier),
          }),
      });
    }

    for (const themeId of biFilter.riskThemes) {
      chips.push({
        key: `risk:${themeId}`,
        label: `Risco: ${riskMetaMap.get(themeId)?.label ?? themeId}`,
        onRemove: () =>
          onChangeBiFilter({
            ...biFilter,
            riskThemes: biFilter.riskThemes.filter((id) => id !== themeId),
          }),
      });
    }

    for (const themeId of biFilter.benefitThemes) {
      chips.push({
        key: `benefit:${themeId}`,
        label: `Benefício: ${benefitMetaMap.get(themeId)?.label ?? themeId}`,
        onRemove: () =>
          onChangeBiFilter({
            ...biFilter,
            benefitThemes: biFilter.benefitThemes.filter((id) => id !== themeId),
          }),
      });
    }

    return chips;
  }, [biFilter, onChangeBiFilter, riskMetaMap, benefitMetaMap]);

  // Panel 1 single-dimension ECharts option (when user clicks M_SEN / M_TOOL / M_USO pill)
  const profileSingleOption = useMemo<EChartsOption | null>(() => {
    if (profileView === 'seniorities') {
      return buildSingleFacetBarOption(
        'Senioridade (M_SEN)',
        slice.facetProfiles.seniorities,
        (id) => SENIORITY_COLORS[id as SeniorityLevel] ?? COLORS.primary,
        'seniority'
      );
    }
    if (profileView === 'tools') {
      return buildSingleFacetBarOption(
        'Ferramenta (M_TOOL)',
        slice.facetProfiles.tools,
        () => COLORS.primary,
        'tool'
      );
    }
    if (profileView === 'frequencies') {
      return buildSingleFacetBarOption(
        'Frequência (M_USO)',
        slice.facetProfiles.frequencies,
        () => COLORS.success,
        'frequency'
      );
    }
    return null;
  }, [profileView, slice.facetProfiles]);

  const handleProfileChartClick = useCallback(
    (params: ECElementEvent) => {
      const target = (
        params.data as
          | { clickTarget?: { kind: 'seniority' | 'tool' | 'frequency'; value: string } }
          | undefined
      )?.clickTarget;
      if (!target) return;
      if (target.kind === 'seniority') {
        onChangeBiFilter({
          ...biFilter,
          seniorities: toggleArrayItem(biFilter.seniorities, target.value as SeniorityLevel),
        });
      } else if (target.kind === 'tool') {
        onChangeBiFilter({
          ...biFilter,
          tools: toggleArrayItem(biFilter.tools, target.value),
        });
      } else if (target.kind === 'frequency') {
        onChangeBiFilter({
          ...biFilter,
          frequencies: toggleArrayItem(biFilter.frequencies, target.value),
        });
      }
    },
    [biFilter, onChangeBiFilter]
  );

  // Panel 2: Construct Dumbbell
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

  const handleDumbbellClick = useCallback(
    (params: ECElementEvent) => {
      const target = (
        params.data as
          | { clickTarget?: { kind: 'seniority' | 'noop'; seniority?: SeniorityLevel } }
          | undefined
      )?.clickTarget;
      if (target?.kind === 'seniority' && target.seniority) {
        onChangeBiFilter({
          ...biFilter,
          seniorities: toggleArrayItem(biFilter.seniorities, target.seniority),
        });
      }
    },
    [biFilter, onChangeBiFilter]
  );

  // Panel 3: Raincloud QP3
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
      if (mw) {
        return { mode: 'mw' as const, result: mw, groups: mw.groups };
      }
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
    const baseKw =
      qp3Construct === 'C_VEL'
        ? result.baseline.qp3.cVelKruskalWallis
        : result.baseline.qp3.cQualKruskalWallis;
    return baseKw.pValue;
  }, [effectiveQp3Grouping, qp3Construct, result.baseline.qp3]);

  const qp3ActiveGroupsCount = qp3ActiveTest.groups.filter((g) => g.n > 0).length;
  const qp3CanCompare = slice.activeGroupCountQP3 >= 2 && qp3ActiveGroupsCount >= 2;

  const raincloudOption = useMemo(
    () =>
      buildRaincloudOption({
        groups: qp3ActiveTest.groups,
        selectedSeniorities: biFilter.seniorities,
        compact: true,
      }),
    [qp3ActiveTest.groups, biFilter.seniorities]
  );

  const handleRaincloudClick = useCallback(
    (params: ECElementEvent) => {
      const groupName = (params.data as { groupName?: string } | undefined)?.groupName;
      if (!groupName) return;

      if (groupName === 'Júnior' || groupName === 'Pleno' || groupName === 'Sênior') {
        onChangeBiFilter({
          ...biFilter,
          seniorities: toggleArrayItem(biFilter.seniorities, groupName),
        });
      } else if (groupName === 'Júnior + Pleno' || groupName === 'Jr+Pl') {
        onChangeBiFilter({
          ...biFilter,
          seniorities: toggleArrayPair(biFilter.seniorities, 'Júnior', 'Pleno'),
        });
      } else if (groupName === 'Pleno + Sênior') {
        onChangeBiFilter({
          ...biFilter,
          seniorities: toggleArrayPair(biFilter.seniorities, 'Pleno', 'Sênior'),
        });
      } else if (groupName === 'Sr') {
        onChangeBiFilter({
          ...biFilter,
          seniorities: toggleArrayItem(biFilter.seniorities, 'Sênior'),
        });
      }
    },
    [biFilter, onChangeBiFilter]
  );

  // Panel 4: QP4 Joint Matrix
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

  const handleQp4Click = useCallback(
    (params: ECElementEvent) => {
      const target = (
        params.data as {
          clickTarget?:
            | { kind: 'mRevTier'; tierId: OrdinalTierId }
            | { kind: 'cQualTier'; tierId: OrdinalTierId }
            | { kind: 'bubble'; mRevTier: OrdinalTierId; cQualTier: OrdinalTierId };
        }
      )?.clickTarget;
      if (!target) return;

      if (target.kind === 'mRevTier') {
        onChangeBiFilter({
          ...biFilter,
          mRevTiers: toggleArrayItem(biFilter.mRevTiers, target.tierId),
        });
      } else if (target.kind === 'cQualTier') {
        onChangeBiFilter({
          ...biFilter,
          cQualTiers: toggleArrayItem(biFilter.cQualTiers, target.tierId),
        });
      } else if (target.kind === 'bubble') {
        const hasM = biFilter.mRevTiers.includes(target.mRevTier);
        const hasC = biFilter.cQualTiers.includes(target.cQualTier);
        if (hasM && hasC) {
          onChangeBiFilter({
            ...biFilter,
            mRevTiers: biFilter.mRevTiers.filter((t) => t !== target.mRevTier),
            cQualTiers: biFilter.cQualTiers.filter((t) => t !== target.cQualTier),
          });
        } else {
          onChangeBiFilter({
            ...biFilter,
            mRevTiers: hasM ? biFilter.mRevTiers : [...biFilter.mRevTiers, target.mRevTier],
            cQualTiers: hasC ? biFilter.cQualTiers : [...biFilter.cQualTiers, target.cQualTier],
          });
        }
      }
    },
    [biFilter, onChangeBiFilter]
  );

  // Panel 5: 4-Stage Sankey
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

  const handleSankeyClick = useCallback(
    (params: ECElementEvent) => {
      const target = (params.data as { clickTarget?: SankeyNodeDatum['clickTarget'] } | undefined)
        ?.clickTarget;
      if (!target || target.kind === 'noop') return;

      if (target.kind === 'seniority') {
        onChangeBiFilter({
          ...biFilter,
          seniorities: toggleArrayItem(biFilter.seniorities, target.value as SeniorityLevel),
        });
      } else if (target.kind === 'tool') {
        onChangeBiFilter({
          ...biFilter,
          tools: toggleArrayItem(biFilter.tools, target.value),
        });
      } else if (target.kind === 'mRevTier') {
        onChangeBiFilter({
          ...biFilter,
          mRevTiers: toggleArrayItem(biFilter.mRevTiers, target.value as OrdinalTierId),
        });
      } else if (target.kind === 'cQualTier') {
        onChangeBiFilter({
          ...biFilter,
          cQualTiers: toggleArrayItem(biFilter.cQualTiers, target.value as OrdinalTierId),
        });
      }
    },
    [biFilter, onChangeBiFilter]
  );

  // Panel 6: Paired Butterfly Themes
  const butterflyInputs = useMemo(() => {
    const riskThemes: ButterflyThemeInput[] = slice.facetProfiles.riskThemes.map((item) => ({
      ...item,
      description: riskMetaMap.get(item.id)?.description,
    }));
    const benefitThemes: ButterflyThemeInput[] = slice.facetProfiles.benefitThemes.map((item) => ({
      ...item,
      description: benefitMetaMap.get(item.id)?.description,
    }));
    return { riskThemes, benefitThemes };
  }, [slice.facetProfiles.riskThemes, slice.facetProfiles.benefitThemes, riskMetaMap, benefitMetaMap]);

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

  const handleButterflyClick = useCallback(
    (params: ECElementEvent) => {
      const target = (
        params.data as {
          clickTarget?: { kind: 'riskTheme' | 'benefitTheme'; themeId: string; label: string };
        }
      )?.clickTarget;
      if (!target) return;

      if (target.kind === 'riskTheme') {
        const isAdding = !biFilter.riskThemes.includes(target.themeId);
        onChangeBiFilter({
          ...biFilter,
          riskThemes: toggleArrayItem(biFilter.riskThemes, target.themeId),
        });
        setActiveDrawerTheme(
          isAdding
            ? { type: 'risk', themeId: target.themeId, label: target.label }
            : null
        );
        setDrawerOpen(true);
      } else if (target.kind === 'benefitTheme') {
        const isAdding = !biFilter.benefitThemes.includes(target.themeId);
        onChangeBiFilter({
          ...biFilter,
          benefitThemes: toggleArrayItem(biFilter.benefitThemes, target.themeId),
        });
        setActiveDrawerTheme(
          isAdding
            ? { type: 'benefit', themeId: target.themeId, label: target.label }
            : null
        );
        setDrawerOpen(true);
      }
    },
    [biFilter, onChangeBiFilter]
  );

  const handleClearThemesAndClose = useCallback(() => {
    onChangeBiFilter({
      ...biFilter,
      riskThemes: [],
      benefitThemes: [],
    });
    setActiveDrawerTheme(null);
    setDrawerOpen(false);
  }, [biFilter, onChangeBiFilter]);

  const velGreaterPct =
    slice.pairedVelVsQual.n > 0
      ? (slice.pairedVelVsQual.velGreaterCount / slice.pairedVelVsQual.n) * 100
      : null;

  const senMaxCount = Math.max(1, ...slice.facetProfiles.seniorities.map((i) => i.count));
  const freqMaxCount = Math.max(1, ...slice.facetProfiles.frequencies.map((i) => i.count));
  const toolMaxCount = Math.max(1, ...slice.facetProfiles.tools.map((i) => i.count));

  return (
    <div className="space-y-3.5">
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
            onClick={() => {
              setActiveDrawerTheme(null);
              setDrawerOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#D5DDD6] bg-[#EDF1EC] px-2.5 py-1 text-xs font-semibold text-[#142027] transition-colors hover:border-[#1F4E8C] hover:bg-[#E8EFF8] hover:text-[#1F4E8C]"
          >
            <MessageSquareQuote className="h-3.5 w-3.5 text-[#1F4E8C]" aria-hidden="true" />
            <span>Relatos Literais ({substantiveQuotesCount})</span>
          </button>
        </div>
      </section>

      {/* Empty Intersection State (n = 0) */}
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
        /* 2×3 Executive Bento Grid */
        <section
          aria-label="Grade analítica BI 2x3"
          className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3"
        >
          {/* Panel 1 — Perfil & Adoção */}
          <article className="card-editorial flex flex-col p-3.5">
            <div className="mb-2 flex items-center justify-between gap-2 border-b border-[#EDF1EC] pb-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <h2 className="truncate text-sm font-semibold text-[#142027]">
                  Perfil &amp; Adoção
                </h2>
                <Badge variant="descriptive" className="px-1.5 py-0 text-[10px]">
                  M_SEN · M_TOOL · M_USO
                </Badge>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <div className="inline-flex rounded-md border border-[#D5DDD6] bg-[#EDF1EC] p-0.5 text-[10px] font-semibold">
                  {(
                    [
                      { id: 'all', label: '3D' },
                      { id: 'seniorities', label: 'SEN', activeCount: biFilter.seniorities.length },
                      { id: 'tools', label: 'TOOL', activeCount: biFilter.tools.length },
                      { id: 'frequencies', label: 'USO', activeCount: biFilter.frequencies.length },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setProfileView(tab.id)}
                      className={`rounded px-1.5 py-0.5 transition-colors ${
                        profileView === tab.id
                          ? 'bg-white text-[#1F4E8C] shadow-xs'
                          : 'text-[#5C6D75] hover:text-[#142027]'
                      }`}
                    >
                      {tab.label}
                      {'activeCount' in tab && tab.activeCount > 0 ? `(${tab.activeCount})` : ''}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => onSwitchToReport('overview')}
                  title="Ver amostra detalhada no Relatório"
                  aria-label="Ver amostra detalhada no Relatório"
                  className="rounded p-1 text-[#5C6D75] hover:bg-[#EDF1EC] hover:text-[#1F4E8C]"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {profileView === 'all' ? (
              <div className="h-[255px] space-y-2.5 overflow-y-auto pr-0.5">
                <div className="grid grid-cols-2 gap-2.5">
                  <FacetBarList
                    title="Senioridade (M_SEN)"
                    items={slice.facetProfiles.seniorities}
                    maxCount={senMaxCount}
                    resolveColor={(id) => SENIORITY_COLORS[id as SeniorityLevel] ?? COLORS.primary}
                    onToggle={(id) =>
                      onChangeBiFilter({
                        ...biFilter,
                        seniorities: toggleArrayItem(biFilter.seniorities, id as SeniorityLevel),
                      })
                    }
                  />
                  <FacetBarList
                    title="Frequência (M_USO)"
                    items={slice.facetProfiles.frequencies}
                    maxCount={freqMaxCount}
                    resolveColor={() => COLORS.success}
                    shortLabels={FREQUENCY_SHORT_LABELS}
                    onToggle={(id) =>
                      onChangeBiFilter({
                        ...biFilter,
                        frequencies: toggleArrayItem(biFilter.frequencies, id),
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[#5C6D75]">
                    Ferramenta Principal (M_TOOL)
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {slice.facetProfiles.tools.map((item) => {
                      const widthPct =
                        toolMaxCount > 0
                          ? Math.max(item.count > 0 ? 6 : 0, (item.count / toolMaxCount) * 100)
                          : 0;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() =>
                            onChangeBiFilter({
                              ...biFilter,
                              tools: toggleArrayItem(biFilter.tools, item.id),
                            })
                          }
                          aria-pressed={item.selected}
                          title={`${item.label}: ${item.count} (${fmtPct(item.pct, 1)})`}
                          style={{ opacity: item.dimmed ? 0.35 : 1 }}
                          className={`rounded-md border px-2 py-1 text-left transition-all ${
                            item.selected
                              ? 'border-[#142027] bg-[#E8EFF8]/70 shadow-[0_0_0_1px_#142027]'
                              : 'border-transparent bg-[#FAFBF9] hover:border-[#B6CBE6] hover:bg-[#F3F7FB]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 text-[11px]">
                            <span className="truncate font-medium text-[#142027]">
                              {item.label}
                            </span>
                            <span className="shrink-0 font-mono-tabular text-[10px] font-semibold text-[#43535B]">
                              {item.count} ({fmtPct(item.pct, 0)})
                            </span>
                          </div>
                          <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-[#E5ECE6]">
                            <div
                              className="h-full rounded-full bg-[#1F4E8C] transition-all"
                              style={{ width: `${widthPct}%` }}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              profileSingleOption && (
                <EChart
                  option={profileSingleOption}
                  height={255}
                  ariaLabel="Gráfico interativo de perfil e adoção"
                  onChartClick={handleProfileChartClick}
                />
              )
            )}
          </article>

          {/* Panel 2 — QP1 vs QP2: Assimetria Velocidade × Qualidade */}
          <article className="card-editorial flex flex-col p-3.5">
            <div className="mb-2 flex items-center justify-between gap-2 border-b border-[#EDF1EC] pb-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <h2 className="truncate text-sm font-semibold text-[#142027]">
                  QP1 vs QP2 · Velocidade × Qualidade
                </h2>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Badge variant="exploratory" className="px-1.5 py-0 font-mono-tabular text-[10px]">
                  {slice.pairedVelVsQual.velGreaterCount}/{slice.pairedVelVsQual.n} VEL&gt;QUAL
                </Badge>
                <button
                  type="button"
                  onClick={() => onSwitchToReport('likert')}
                  title="Ver detalhamento Likert QP1 & QP2 no Relatório"
                  aria-label="Ver detalhamento Likert QP1 & QP2 no Relatório"
                  className="rounded p-1 text-[#5C6D75] hover:bg-[#EDF1EC] hover:text-[#1F4E8C]"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <EChart
              option={dumbbellOption}
              height={232}
              ariaLabel="Dumbbell comparando medianas de C_QUAL e C_VEL por senioridade"
              onChartClick={handleDumbbellClick}
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
            <div className="mb-1.5 flex items-center justify-between gap-1.5 border-b border-[#EDF1EC] pb-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <h2 className="truncate text-sm font-semibold text-[#142027]">
                  QP3 · Raincloud por Senioridade
                </h2>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <div className="inline-flex rounded-md border border-[#D5DDD6] bg-[#EDF1EC] p-0.5 text-[10px] font-semibold">
                  {(['C_VEL', 'C_QUAL'] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setQp3Construct(c)}
                      className={`rounded px-1.5 py-0.5 transition-colors ${
                        qp3Construct === c
                          ? 'bg-white text-[#1F4E8C] shadow-xs'
                          : 'text-[#5C6D75] hover:text-[#142027]'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <div className="inline-flex rounded-md border border-[#D5DDD6] bg-[#EDF1EC] p-0.5 text-[10px] font-semibold">
                  <button
                    type="button"
                    disabled={!qp3MergedAvailable}
                    onClick={() => setQp3Grouping('merged')}
                    className={`rounded px-1.5 py-0.5 transition-colors ${
                      effectiveQp3Grouping === 'merged'
                        ? 'bg-white text-[#1F4E8C] shadow-xs'
                        : 'text-[#5C6D75] hover:text-[#142027]'
                    } ${!qp3MergedAvailable ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    Jr+Pl vs Sr
                  </button>
                  <button
                    type="button"
                    onClick={() => setQp3Grouping('three')}
                    className={`rounded px-1.5 py-0.5 transition-colors ${
                      effectiveQp3Grouping === 'three'
                        ? 'bg-white text-[#1F4E8C] shadow-xs'
                        : 'text-[#5C6D75] hover:text-[#142027]'
                    }`}
                  >
                    3 Níveis
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => onSwitchToReport('confirmatory')}
                  title="Ver testes confirmatórios QP3 no Relatório"
                  aria-label="Ver testes confirmatórios QP3 no Relatório"
                  className="rounded p-1 text-[#5C6D75] hover:bg-[#EDF1EC] hover:text-[#1F4E8C]"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="mb-1 flex flex-wrap items-center justify-between gap-1 text-[10px]">
              {!qp3CanCompare ? (
                <Badge variant="warning" className="px-1.5 py-0 text-[10px]">
                  Comparação N/A (1 grupo ativo)
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
              onChartClick={handleRaincloudClick}
            />
          </article>

          {/* Panel 4 — QP4: Matriz Conjunta M_REV × C_QUAL + Marginais */}
          <article className="card-editorial flex flex-col p-3.5">
            <div className="mb-1.5 flex items-center justify-between gap-1.5 border-b border-[#EDF1EC] pb-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <h2 className="truncate text-sm font-semibold text-[#142027]">
                  QP4 · Matriz M_REV × C_QUAL
                </h2>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => onSwitchToReport('confirmatory')}
                  title="Ver testes confirmatórios QP4 no Relatório"
                  aria-label="Ver testes confirmatórios QP4 no Relatório"
                  className="rounded p-1 text-[#5C6D75] hover:bg-[#EDF1EC] hover:text-[#1F4E8C]"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

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
              height={216}
              ariaLabel="Matriz conjunta QP4 de M_REV versus C_QUAL com marginais"
              onChartClick={handleQp4Click}
            />

            <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#5C6D75]">
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
          </article>

          {/* Panel 5 — Fluxo Multidimensional (Sankey 4 Estágios) */}
          <article className="card-editorial flex flex-col p-3.5">
            <div className="mb-2 flex items-center justify-between gap-2 border-b border-[#EDF1EC] pb-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <h2 className="truncate text-sm font-semibold text-[#142027]">
                  Fluxo Multidimensional (Sankey)
                </h2>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Badge variant="exploratory" className="px-1.5 py-0 text-[10px]">
                  4 Estágios
                </Badge>
                <button
                  type="button"
                  onClick={() => onSwitchToReport('open_exploratory')}
                  title="Ver análises exploratórias no Relatório"
                  aria-label="Ver análises exploratórias no Relatório"
                  className="rounded p-1 text-[#5C6D75] hover:bg-[#EDF1EC] hover:text-[#1F4E8C]"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <EChart
              option={sankeyOption}
              height={235}
              ariaLabel="Diagrama Sankey de 4 estágios: Senioridade, Ferramenta, Rigor e Qualidade"
              onChartClick={handleSankeyClick}
            />

            <div className="mt-1 flex items-center justify-between text-[10px] text-[#5C6D75]">
              <span>Senioridade → Ferramenta → M_REV → C_QUAL</span>
              <span className="font-mono-tabular">Clique no nó p/ filtrar</span>
            </div>
          </article>

          {/* Panel 6 — Riscos vs Benefícios (Temas Abertos) */}
          <article className="card-editorial flex flex-col p-3.5">
            <div className="mb-2 flex items-center justify-between gap-2 border-b border-[#EDF1EC] pb-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <h2 className="truncate text-sm font-semibold text-[#142027]">
                  Riscos vs Benefícios (Abertas)
                </h2>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Badge variant="exploratory" className="px-1.5 py-0 font-mono-tabular text-[10px]">
                  {slice.openCoding.risks.substantiveCount}R · {slice.openCoding.benefits.substantiveCount}B
                </Badge>
                <button
                  type="button"
                  onClick={() => onSwitchToReport('open_exploratory')}
                  title="Ver codificação aberta completa no Relatório"
                  aria-label="Ver codificação aberta completa no Relatório"
                  className="rounded p-1 text-[#5C6D75] hover:bg-[#EDF1EC] hover:text-[#1F4E8C]"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <EChart
              option={butterflyOption}
              height={235}
              ariaLabel="Gráfico borboleta pareado de temas de risco e benefício"
              onChartClick={handleButterflyClick}
            />

            <div className="mt-1 flex items-center justify-between text-[10px] text-[#5C6D75]">
              <span>ITEM_21 (Esq.) vs ITEM_22 (Dir.)</span>
              <span className="font-mono-tabular">Clique no tema → relatos</span>
            </div>
          </article>
        </section>
      )}

      {/* Slide-Over Quote Drawer */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="Relatos literais da amostra filtrada"
        >
          <div
            className="fixed inset-0 bg-[#142027]/35 backdrop-blur-[1px]"
            onClick={() => setDrawerOpen(false)}
          />

          <aside className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-[#D5DDD6] bg-white shadow-2xl">
            <div className="border-b border-[#D5DDD6] bg-[#FAFBF9] px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <MessageSquareQuote className="h-4 w-4 text-[#1F4E8C]" aria-hidden="true" />
                    <h3 className="text-sm font-bold text-[#142027]">
                      Relatos Literais
                    </h3>
                    <Badge variant="neutral" className="px-1.5 py-0 font-mono-tabular text-[10px]">
                      {drawerQuotes.length}
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-[#43535B]">
                    {activeDrawerTheme
                      ? `${activeDrawerTheme.type === 'risk' ? 'Risco' : 'Benefício'}: ${activeDrawerTheme.label}`
                      : biFilter.riskThemes.length > 0 || biFilter.benefitThemes.length > 0
                        ? 'Filtrado pelos temas ativos no dashboard'
                        : `Todos os relatos substantivos na fatia ativa (n = ${slice.validCount})`}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Fechar painel de relatos"
                  className="rounded-lg p-1.5 text-[#5C6D75] hover:bg-[#EDF1EC] hover:text-[#142027]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {(biFilter.riskThemes.length > 0 || biFilter.benefitThemes.length > 0) && (
                <div className="mt-2.5 flex items-center justify-between gap-2 rounded-lg border border-[#D5DDD6] bg-white px-2.5 py-1.5">
                  <span className="text-[11px] text-[#5C6D75]">
                    Filtro de tema ativo nos painéis
                  </span>
                  <button
                    type="button"
                    onClick={handleClearThemesAndClose}
                    className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold text-[#9A2E2E] hover:bg-[#FBEAEA]"
                  >
                    <RotateCcw className="h-3 w-3" aria-hidden="true" />
                    Limpar filtro de tema e fechar
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 space-y-2.5 overflow-y-auto p-4">
              {drawerQuotes.map(({ type, item }, idx) => (
                <div
                  key={`${type}-${item.rowNumber}-${idx}`}
                  className="space-y-1.5 rounded-lg border border-[#D5DDD6] bg-[#FAFBF9] p-3 text-xs"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={type === 'risk' ? 'danger' : 'success'}>
                      {type === 'risk' ? 'Risco (ITEM_21)' : 'Benefício (ITEM_22)'}
                    </Badge>
                    <span className="font-mono-tabular font-semibold text-[#142027]">
                      {item.idLabel}
                    </span>
                    <span
                      className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
                      style={{ backgroundColor: SENIORITY_COLORS[item.seniority] }}
                    >
                      {item.seniority}
                    </span>
                    <span className="text-[11px] text-[#5C6D75]">{item.tool}</span>
                  </div>

                  <p className="leading-relaxed text-[#142027]">
                    &ldquo;{item.rawText}&rdquo;
                  </p>

                  {item.themeLabels.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {item.themeLabels.map((lbl) => (
                        <Badge key={lbl} variant="neutral" className="px-2 py-0 text-[10px]">
                          {lbl}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {drawerQuotes.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#D5DDD6] bg-[#FAFBF9] px-4 py-10 text-center">
                  <MessageSquareQuote className="h-6 w-6 text-[#5C6D75]" aria-hidden="true" />
                  <p className="text-xs font-medium text-[#43535B]">
                    Nenhum relato substantivo corresponde à combinação atual de filtros.
                  </p>
                  {(biFilter.riskThemes.length > 0 || biFilter.benefitThemes.length > 0) && (
                    <button
                      type="button"
                      onClick={handleClearThemesAndClose}
                      className="mt-1 rounded-lg bg-[#1F4E8C] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#183E70]"
                    >
                      Limpar filtro de tema e fechar
                    </button>
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
