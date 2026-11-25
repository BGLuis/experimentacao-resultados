import { cleanSurveyRows } from './cleaning';
import { runOpenCoding } from './openCoding';
import {
  FREQUENCY_ORDER,
  SENIORITY_ORDER,
  parseSurveyCsv,
} from './parser';
import {
  analyzeExploratory,
  analyzeQP3,
  analyzeQP4,
  analyzeReliability,
  applyFilterToRespondents,
  buildDescriptives,
  marginOfErrorPct,
} from './statistics';
import type {
  FilterState,
  RawCsvRow,
  SurveyAnalysisResult,
} from './types';

export * from './types';
export {
  FREQUENCY_ORDER,
  ITEM_METADATA,
  LIKERT_ITEM_IDS,
  QUALITY_ITEM_IDS,
  REVIEW_ITEM_IDS,
  SENIORITY_ORDER,
  VELOCITY_ITEM_IDS,
  parseSurveyCsv,
} from './parser';
export { cleanSurveyRows } from './cleaning';
export { BENEFIT_CODEBOOK, RISK_CODEBOOK, runOpenCoding } from './openCoding';
export {
  analyzeExploratory,
  analyzeQP3,
  analyzeQP4,
  analyzeReliability,
  chi2PValue,
  computeCronbachAlpha,
  computeSpearman,
  kruskalWallis,
  mad,
  mannWhitneyU,
  marginOfErrorPct,
  median,
  modes,
  mulberry32,
  partialSpearman,
  wilcoxonSignedRank,
  wilsonCI,
} from './statistics';

export const DEFAULT_FILTER_STATE: FilterState = {
  seniorities: [],
  tools: [],
  frequencies: [],
  normalizeTools: true,
  invertItem16: true,
};

export function analyzeSurveyRows(
  rawRows: RawCsvRow[],
  filterOverrides?: Partial<FilterState>
): SurveyAnalysisResult {
  const filter: FilterState = {
    ...DEFAULT_FILTER_STATE,
    ...filterOverrides,
  };

  const cleaning = cleanSurveyRows(rawRows);
  const validAll = cleaning.validRespondents;

  // Confirmatory baseline always anchored on full valid sample (avoiding p-hacking)
  const baselineReliability = analyzeReliability(validAll, true);
  const baselineQP3 = analyzeQP3(validAll, true);
  const baselineQP4 = analyzeQP4(validAll, true, filter.normalizeTools);
  const baselineExploratory = analyzeExploratory(
    validAll,
    true,
    filter.normalizeTools
  );
  const baselineOpenCoding = runOpenCoding(validAll, filter.normalizeTools);

  // Filtered view for descriptive / exploratory / UI panels
  const filteredValid = applyFilterToRespondents(validAll, filter);
  const filteredIds = new Set(filteredValid.map((r) => r.rowNumber));

  const timelineAudits = cleaning.audits
    .filter((a) => a.status === 'discarded' || filteredIds.has(a.rowNumber))
    .map((a) => ({
      timestamp: a.raw.timestamp,
      status: a.status,
      collectionPhase: a.validRespondent?.collectionPhase,
    }));

  const descriptives = buildDescriptives(filteredValid, timelineAudits, filter);
  const filteredReliability = analyzeReliability(
    filteredValid,
    filter.invertItem16
  );
  const filteredExploratory = analyzeExploratory(
    filteredValid,
    filter.invertItem16,
    filter.normalizeTools
  );
  const filteredOpenCoding = runOpenCoding(
    filteredValid,
    filter.normalizeTools
  );

  const toolsNormalized = Array.from(
    new Set(validAll.map((r) => r.toolNormalized).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
  const toolsRaw = Array.from(
    new Set(validAll.map((r) => r.toolRaw).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const frequencies = FREQUENCY_ORDER.filter((f) =>
    validAll.some((r) => r.frequencyRaw === f)
  );
  const seniorities = SENIORITY_ORDER.filter((s) =>
    validAll.some((r) => r.seniority === s)
  );

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      targetN: 60,
      minAcceptableN: 50,
      plannedStart: '2026-11-12T00:00:00',
      plannedEnd: '2026-11-22T23:59:59',
      extensionDeadline: '2026-11-24T12:00:00',
      deliveryDeadline: '2026-11-26T12:00:00',
    },
    cleaning,
    filter,
    availableFilterOptions: {
      seniorities,
      toolsNormalized,
      toolsRaw,
      frequencies,
    },
    baseline: {
      validCount: validAll.length,
      marginOfErrorPct: marginOfErrorPct(validAll.length),
      reliability: baselineReliability,
      qp3: baselineQP3,
      qp4: baselineQP4,
      exploratory: baselineExploratory,
      openCoding: baselineOpenCoding,
    },
    filtered: {
      validCount: filteredValid.length,
      lowSampleWarning: filteredValid.length > 0 && filteredValid.length < 5,
      marginOfErrorPct: marginOfErrorPct(filteredValid.length),
      ...descriptives,
      reliability: filteredReliability,
      exploratory: filteredExploratory,
      openCoding: filteredOpenCoding,
      validRespondents: filteredValid,
    },
  };
}

export function analyzeSurveyCsv(
  csvText: string,
  filterOverrides?: Partial<FilterState>
): SurveyAnalysisResult {
  const rawRows = parseSurveyCsv(csvText);
  return analyzeSurveyRows(rawRows, filterOverrides);
}
