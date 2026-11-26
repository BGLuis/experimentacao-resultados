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

  const riskThemesByRow = new Map<number, string[]>();
  for (const resp of result.baseline.openCoding.risks.responses) {
    riskThemesByRow.set(resp.rowNumber, resp.themes);
  }
  const benefitThemesByRow = new Map<number, string[]>();
  for (const resp of result.baseline.openCoding.benefits.responses) {
    benefitThemesByRow.set(resp.rowNumber, resp.themes);
  }

  const hasMissingRows = allValid.some(
    (r) => !riskThemesByRow.has(r.rowNumber) || !benefitThemesByRow.has(r.rowNumber)
  );
  if (hasMissingRows) {
    const fallbackOpen = runOpenCoding(allValid, normalizeTools);
    for (const resp of fallbackOpen.risks.responses) {
      riskThemesByRow.set(resp.rowNumber, resp.themes);
    }
    for (const resp of fallbackOpen.benefits.responses) {
      benefitThemesByRow.set(resp.rowNumber, resp.themes);
    }
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

  // Leave-one-out facet counts so unselected categories retain non-zero context
  const senPool = allValid.filter((r) => matchesBiFilter(r, biFilter, 'seniorities'));
  const senioritiesFacet: BiFacetBarItem[] = SENIORITY_ORDER.map((sen) => {
    const count = senPool.filter((r) => r.seniority === sen).length;
    const selected = biFilter.seniorities.includes(sen);
    return {
      id: sen,
      label: sen,
      count,
      pct: senPool.length > 0 ? (count / senPool.length) * 100 : 0,
      selected,
      dimmed: biFilter.seniorities.length > 0 && !selected,
    };
  });

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

  const toolPool = allValid.filter((r) => matchesBiFilter(r, biFilter, 'tools'));
  const toolsFacet: BiFacetBarItem[] = Array.from(baselineToolCounts.entries())
    .map(([tool, baseCount]) => {
      const count = toolPool.filter((r) => getToolLabel(r) === tool).length;
      const selected = biFilter.tools.includes(tool);
      return {
        id: tool,
        label: tool,
        count,
        baseCount,
        pct: toolPool.length > 0 ? (count / toolPool.length) * 100 : 0,
        selected,
        dimmed: biFilter.tools.length > 0 && !selected,
      };
    })
    .sort(
      (a, b) =>
        b.count - a.count || b.baseCount - a.baseCount || a.label.localeCompare(b.label)
    )
    .map(({ baseCount: _base, ...item }) => item);

  const freqPool = allValid.filter((r) => matchesBiFilter(r, biFilter, 'frequencies'));
  const frequenciesFacet: BiFacetBarItem[] = FREQUENCY_ORDER.map((freq) => {
    const count = freqPool.filter((r) => r.frequencyRaw === freq).length;
    const selected = biFilter.frequencies.includes(freq);
    return {
      id: freq,
      label: freq,
      count,
      pct: freqPool.length > 0 ? (count / freqPool.length) * 100 : 0,
      selected,
      dimmed: biFilter.frequencies.length > 0 && !selected,
    };
  });

  const riskPool = allValid.filter((r) => matchesBiFilter(r, biFilter, 'riskThemes'));
  const riskCodebook =
    result.baseline.openCoding.riskCodebook.length > 0
      ? result.baseline.openCoding.riskCodebook
      : RISK_CODEBOOK;
  const riskThemesFacet: BiFacetBarItem[] = riskCodebook
    .map((cat) => {
      const count = riskPool.filter((r) =>
        (riskThemesByRow.get(r.rowNumber) ?? []).includes(cat.id)
      ).length;
      const selected = biFilter.riskThemes.includes(cat.id);
      return {
        id: cat.id,
        label: cat.label,
        count,
        pct: riskPool.length > 0 ? (count / riskPool.length) * 100 : 0,
        selected,
        dimmed: biFilter.riskThemes.length > 0 && !selected,
      };
    })
    .sort((a, b) => b.count - a.count);

  const benefitPool = allValid.filter((r) => matchesBiFilter(r, biFilter, 'benefitThemes'));
  const benefitCodebook =
    result.baseline.openCoding.benefitCodebook.length > 0
      ? result.baseline.openCoding.benefitCodebook
      : BENEFIT_CODEBOOK;
  const benefitThemesFacet: BiFacetBarItem[] = benefitCodebook
    .map((cat) => {
      const count = benefitPool.filter((r) =>
        (benefitThemesByRow.get(r.rowNumber) ?? []).includes(cat.id)
      ).length;
      const selected = biFilter.benefitThemes.includes(cat.id);
      return {
        id: cat.id,
        label: cat.label,
        count,
        pct: benefitPool.length > 0 ? (count / benefitPool.length) * 100 : 0,
        selected,
        dimmed: biFilter.benefitThemes.length > 0 && !selected,
      };
    })
    .sort((a, b) => b.count - a.count);

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
