import { BENEFIT_CODEBOOK, RISK_CODEBOOK, runOpenCoding } from './openCoding';
import { FREQUENCY_ORDER, SENIORITY_ORDER } from './parser';
import {
  analyzeQP3,
  analyzeQP4,
  buildDescriptives,
  marginOfErrorPct,
  wilcoxonSignedRank,
} from './statistics';
import type {
  ConstructDescriptiveStats,
  LikertItemStats,
  OpenCodingSummary,
  PairedComparisonResult,
  ProfileBreakdownItem,
  QP3Result,
  QP4Result,
  SeniorityLevel,
  SurveyAnalysisResult,
  ValidRespondent,
} from './types';

export type OrdinalTierId = 'low' | 'moderate' | 'high';
export type ClassifiedTierId = OrdinalTierId | 'unclassified';

export interface BiFilterState {
  seniorities: SeniorityLevel[];
  tools: string[];
  frequencies: string[];
  mRevTiers: OrdinalTierId[];
  cQualTiers: OrdinalTierId[];
  riskThemes: string[];
  benefitThemes: string[];
}

export const DEFAULT_BI_FILTER_STATE: BiFilterState = {
  seniorities: [],
  tools: [],
  frequencies: [],
  mRevTiers: [],
  cQualTiers: [],
  riskThemes: [],
  benefitThemes: [],
};

export const ORDINAL_TIER_LABELS: Record<ClassifiedTierId, string> = {
  low: 'Baixo [1,0–2,5)',
  moderate: 'Moderado [2,5–3,75)',
  high: 'Alto [3,75–5,0]',
  unclassified: 'Sem escore',
};

export const ORDINAL_TIER_SHORT_LABELS: Record<ClassifiedTierId, string> = {
  low: 'Baixo (<2,5)',
  moderate: 'Moderado (2,5–3,75)',
  high: 'Alto (≥3,75)',
  unclassified: 'N/A',
};

const BI_BOOTSTRAP_ITERATIONS = 500;

/**
 * Classifica um escore de construto [1,0; 5,0] em faixas ordinais disjuntas semi-abertas.
 */
export function classifyOrdinalTier(score: number | null | undefined): ClassifiedTierId {
  if (score === null || score === undefined || !Number.isFinite(score)) {
    return 'unclassified';
  }
  if (score >= 1.0 && score < 2.5) return 'low';
  if (score >= 2.5 && score < 3.75) return 'moderate';
  if (score >= 3.75 && score <= 5.0001) return 'high';
  return 'unclassified';
}

export function toggleArrayItem<T>(arr: readonly T[], item: T): T[] {
  return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
}

export function toggleArrayPair<T>(arr: readonly T[], itemA: T, itemB: T): T[] {
  const hasA = arr.includes(itemA);
  const hasB = arr.includes(itemB);
  if (hasA && hasB) {
    return arr.filter((x) => x !== itemA && x !== itemB);
  }
  const next = [...arr];
  if (!hasA) next.push(itemA);
  if (!hasB && itemB !== itemA) next.push(itemB);
  return next;
}

export function hasActiveBiFilter(biFilter: BiFilterState): boolean {
  return (
    biFilter.seniorities.length > 0 ||
    biFilter.tools.length > 0 ||
    biFilter.frequencies.length > 0 ||
    biFilter.mRevTiers.length > 0 ||
    biFilter.cQualTiers.length > 0 ||
    biFilter.riskThemes.length > 0 ||
    biFilter.benefitThemes.length > 0
  );
}

export interface BiFacetBarItem {
  id: string;
  label: string;
  count: number;
  pct: number;
  selected: boolean;
  dimmed: boolean;
}

export interface BiDashboardSlice {
  biFilter: BiFilterState;
  hasActiveFilter: boolean;
  normalizeTools: boolean;
  validRespondents: ValidRespondent[];
  validCount: number;
  baselineValidCount: number;
  lowSampleWarning: boolean;
  marginOfErrorPct: number;
  cVelStats: ConstructDescriptiveStats;
  cQualStats: ConstructDescriptiveStats;
  mRevStats: ConstructDescriptiveStats;
  likertItems: LikertItemStats[];
  reviewItems: LikertItemStats[];
  seniorityProfile: ProfileBreakdownItem[];
  toolProfile: ProfileBreakdownItem[];
  frequencyProfile: ProfileBreakdownItem[];
  facetProfiles: {
    seniorities: BiFacetBarItem[];
    tools: BiFacetBarItem[];
    frequencies: BiFacetBarItem[];
    riskThemes: BiFacetBarItem[];
    benefitThemes: BiFacetBarItem[];
  };
  pairedVelVsQual: PairedComparisonResult;
  openCoding: OpenCodingSummary;
  qp3: QP3Result;
  qp4: QP4Result;
  activeGroupCountQP3: number;
}

interface FacetCategorySpec {
  id: string;
  label: string;
  tieBreakCount?: number;
}

/**
 * Calcula contagens leave-one-out para uma faceta preservando o contexto de categorias não selecionadas.
 */
function buildLeaveOneOutFacet(params: {
  allValid: ValidRespondent[];
  biFilter: BiFilterState;
  dimension: 'seniorities' | 'tools' | 'frequencies' | 'riskThemes' | 'benefitThemes';
  selectedIds: readonly string[];
  categories: readonly FacetCategorySpec[];
  matchesCategory: (r: ValidRespondent, categoryId: string) => boolean;
  matchesBiFilter: (
    r: ValidRespondent,
    f: BiFilterState,
    omitDimension?: keyof BiFilterState
  ) => boolean;
  sortMode?: 'none' | 'count' | 'count_and_label';
}): BiFacetBarItem[] {
  const {
    allValid,
    biFilter,
    dimension,
    selectedIds,
    categories,
    matchesCategory,
    matchesBiFilter,
    sortMode = 'none',
  } = params;

  const pool = allValid.filter((r) => matchesBiFilter(r, biFilter, dimension));
  const hasSelection = selectedIds.length > 0;

  const mapped = categories.map((cat) => {
    const count = pool.filter((r) => matchesCategory(r, cat.id)).length;
    const selected = selectedIds.includes(cat.id);
    return {
      id: cat.id,
      label: cat.label,
      count,
      pct: pool.length > 0 ? (count / pool.length) * 100 : 0,
      selected,
      dimmed: hasSelection && !selected,
      tieBreakCount: cat.tieBreakCount ?? 0,
    };
  });

  if (sortMode === 'count') {
    mapped.sort((a, b) => b.count - a.count);
  } else if (sortMode === 'count_and_label') {
    mapped.sort(
      (a, b) =>
        b.count - a.count ||
        b.tieBreakCount - a.tieBreakCount ||
        a.label.localeCompare(b.label)
    );
  }

  return mapped.map(({ tieBreakCount: _tie, ...item }) => item);
}

/**
 * Avalia uma fatia exploratória dinâmica do BI Dashboard mantendo o baseline confirmatório intacto.
 */
export function analyzeBiDashboardSlice(
  result: SurveyAnalysisResult,
  biFilter: BiFilterState
): BiDashboardSlice {
  const allValid = result.cleaning.validRespondents;
  const normalizeTools = result.filter.normalizeTools;
  const baselineValidCount = result.baseline.validCount;

  const baselineCoding = result.filter.normalizeTools
    ? result.baseline.openCoding
    : runOpenCoding(allValid, false);

  const riskThemesByRow = new Map<number, string[]>();
  for (const resp of baselineCoding.risks.responses) {
    riskThemesByRow.set(resp.rowNumber, resp.themes);
  }
  const benefitThemesByRow = new Map<number, string[]>();
  for (const resp of baselineCoding.benefits.responses) {
    benefitThemesByRow.set(resp.rowNumber, resp.themes);
  }

  const getToolLabel = (r: ValidRespondent): string =>
    (normalizeTools ? r.toolNormalized : r.toolRaw) || 'Não informado';

  const matchesBiFilter = (
    r: ValidRespondent,
    f: BiFilterState,
    omitDimension?: keyof BiFilterState
  ): boolean => {
    if (
      omitDimension !== 'seniorities' &&
      f.seniorities.length > 0 &&
      (!r.seniority || !f.seniorities.includes(r.seniority))
    ) {
      return false;
    }

    if (
      omitDimension !== 'tools' &&
      f.tools.length > 0 &&
      !f.tools.includes(getToolLabel(r))
    ) {
      return false;
    }

    if (
      omitDimension !== 'frequencies' &&
      f.frequencies.length > 0 &&
      !f.frequencies.includes(r.frequencyRaw)
    ) {
      return false;
    }

    if (omitDimension !== 'mRevTiers' && f.mRevTiers.length > 0) {
      const mRevTier = classifyOrdinalTier(r.scores.M_REV);
      if (mRevTier === 'unclassified' || !f.mRevTiers.includes(mRevTier)) {
        return false;
      }
    }

    if (omitDimension !== 'cQualTiers' && f.cQualTiers.length > 0) {
      const cQualTier = classifyOrdinalTier(r.scores.C_QUAL);
      if (cQualTier === 'unclassified' || !f.cQualTiers.includes(cQualTier)) {
        return false;
      }
    }

    if (omitDimension !== 'riskThemes' && f.riskThemes.length > 0) {
      const themes = riskThemesByRow.get(r.rowNumber) ?? [];
      if (!themes.some((t) => f.riskThemes.includes(t))) {
        return false;
      }
    }

    if (omitDimension !== 'benefitThemes' && f.benefitThemes.length > 0) {
      const themes = benefitThemesByRow.get(r.rowNumber) ?? [];
      if (!themes.some((t) => f.benefitThemes.includes(t))) {
        return false;
      }
    }

    return true;
  };

  const validRespondents = allValid.filter((r) => matchesBiFilter(r, biFilter));
  const validCount = validRespondents.length;

  const baselineToolCounts = new Map<string, number>();
  for (const r of allValid) {
    const t = getToolLabel(r);
    baselineToolCounts.set(t, (baselineToolCounts.get(t) ?? 0) + 1);
  }
  for (const selectedTool of biFilter.tools) {
    if (!baselineToolCounts.has(selectedTool)) {
      baselineToolCounts.set(selectedTool, 0);
    }
  }

  const riskCodebook =
    baselineCoding.riskCodebook.length > 0
      ? baselineCoding.riskCodebook
      : RISK_CODEBOOK;
  const benefitCodebook =
    baselineCoding.benefitCodebook.length > 0
      ? baselineCoding.benefitCodebook
      : BENEFIT_CODEBOOK;

  const senioritiesFacet = buildLeaveOneOutFacet({
    allValid,
    biFilter,
    dimension: 'seniorities',
    selectedIds: biFilter.seniorities,
    categories: SENIORITY_ORDER.map((sen) => ({ id: sen, label: sen })),
    matchesCategory: (r, id) => r.seniority === id,
    matchesBiFilter,
  });

  const toolsFacet = buildLeaveOneOutFacet({
    allValid,
    biFilter,
    dimension: 'tools',
    selectedIds: biFilter.tools,
    categories: Array.from(baselineToolCounts.entries()).map(([tool, baseCount]) => ({
      id: tool,
      label: tool,
      tieBreakCount: baseCount,
    })),
    matchesCategory: (r, id) => getToolLabel(r) === id,
    matchesBiFilter,
    sortMode: 'count_and_label',
  });

  const frequenciesFacet = buildLeaveOneOutFacet({
    allValid,
    biFilter,
    dimension: 'frequencies',
    selectedIds: biFilter.frequencies,
    categories: FREQUENCY_ORDER.map((freq) => ({ id: freq, label: freq })),
    matchesCategory: (r, id) => r.frequencyRaw === id,
    matchesBiFilter,
  });

  const riskThemesFacet = buildLeaveOneOutFacet({
    allValid,
    biFilter,
    dimension: 'riskThemes',
    selectedIds: biFilter.riskThemes,
    categories: riskCodebook.map((cat) => ({ id: cat.id, label: cat.label })),
    matchesCategory: (r, id) => (riskThemesByRow.get(r.rowNumber) ?? []).includes(id),
    matchesBiFilter,
    sortMode: 'count',
  });

  const benefitThemesFacet = buildLeaveOneOutFacet({
    allValid,
    biFilter,
    dimension: 'benefitThemes',
    selectedIds: biFilter.benefitThemes,
    categories: benefitCodebook.map((cat) => ({ id: cat.id, label: cat.label })),
    matchesCategory: (r, id) => (benefitThemesByRow.get(r.rowNumber) ?? []).includes(id),
    matchesBiFilter,
    sortMode: 'count',
  });

  const descriptives = buildDescriptives(validRespondents, [], {
    seniorities: [],
    tools: [],
    frequencies: [],
    normalizeTools,
    invertItem16: true,
  });

  const pairedVelVsQual = wilcoxonSignedRank(validRespondents, true);
  const openCoding = runOpenCoding(validRespondents, normalizeTools);
  const qp3 = analyzeQP3(validRespondents, true, BI_BOOTSTRAP_ITERATIONS);
  const qp4 = analyzeQP4(
    validRespondents,
    true,
    normalizeTools,
    BI_BOOTSTRAP_ITERATIONS
  );

  const activeGroupCountQP3 = qp3.cVelPrimary.groups.filter((g) => g.n > 0).length;

  return {
    biFilter,
    hasActiveFilter: hasActiveBiFilter(biFilter),
    normalizeTools,
    validRespondents,
    validCount,
    baselineValidCount,
    lowSampleWarning: validCount < 5,
    marginOfErrorPct: marginOfErrorPct(validCount),
    cVelStats: descriptives.cVelStats,
    cQualStats: descriptives.cQualStats,
    mRevStats: descriptives.mRevStats,
    likertItems: descriptives.likertItems,
    reviewItems: descriptives.reviewItems,
    seniorityProfile: descriptives.seniorityProfile,
    toolProfile: descriptives.toolProfile,
    frequencyProfile: descriptives.frequencyProfile,
    facetProfiles: {
      seniorities: senioritiesFacet,
      tools: toolsFacet,
      frequencies: frequenciesFacet,
      riskThemes: riskThemesFacet,
      benefitThemes: benefitThemesFacet,
    },
    pairedVelVsQual,
    openCoding,
    qp3,
    qp4,
    activeGroupCountQP3,
  };
}
