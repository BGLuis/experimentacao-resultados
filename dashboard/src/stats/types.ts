export type ItemId =
  | 'ITEM_01'
  | 'ITEM_02'
  | 'ITEM_03'
  | 'ITEM_04'
  | 'ITEM_05'
  | 'ITEM_06'
  | 'ITEM_07'
  | 'ITEM_08'
  | 'ITEM_09'
  | 'ITEM_10'
  | 'ITEM_11'
  | 'ITEM_12'
  | 'ITEM_13'
  | 'ITEM_14'
  | 'ITEM_15'
  | 'ITEM_16'
  | 'ITEM_17'
  | 'ITEM_18'
  | 'ITEM_19'
  | 'ITEM_20'
  | 'ITEM_21'
  | 'ITEM_22';

export type VelocityItemId = 'ITEM_08' | 'ITEM_09' | 'ITEM_10' | 'ITEM_11';
export type QualityItemId =
  | 'ITEM_12'
  | 'ITEM_13'
  | 'ITEM_14'
  | 'ITEM_15'
  | 'ITEM_16'
  | 'ITEM_17';
export type LikertItemId = VelocityItemId | QualityItemId;
export type ReviewItemId = 'ITEM_19' | 'ITEM_20';
export type ConstructId = 'C_VEL' | 'C_QUAL' | 'M_REV';

export type SeniorityLevel = 'Júnior' | 'Pleno' | 'Sênior';

export type UsageFrequency =
  | 'Menos de 1 dia por semana'
  | '1 a 3 dias por semana'
  | '4 a 5 dias por semana'
  | 'Todos os dias úteis';

export interface ItemMetadata {
  id: ItemId;
  shortLabel: string;
  questionText: string;
  construct: ConstructId | 'ELIGIBILITY' | 'PROFILE' | 'ATTENTION' | 'OPEN';
  inverted?: boolean;
  scaleType: 'nominal' | 'ordinal_frequency' | 'likert' | 'review_frequency' | 'open';
}

export interface RawCsvRow {
  rowNumber: number;
  idLabel: string;
  timestampRaw: string;
  timestamp: Date | null;
  timestampIso: string | null;
  durationSeconds: number | null;
  consent: string;
  eligibility: {
    item01: string;
    item02: string;
    item03: string;
    item04: string;
  };
  experienceRaw: string;
  seniority: SeniorityLevel | null;
  toolRaw: string;
  toolNormalized: string;
  toolIsOther: boolean;
  frequencyRaw: string;
  frequencyCode: 1 | 2 | 3 | 4 | null;
  likertRaw: Record<LikertItemId | 'ITEM_18', string>;
  likertNumeric: Record<LikertItemId | 'ITEM_18', number | null>;
  reviewRaw: Record<ReviewItemId, string>;
  reviewNumeric: Record<ReviewItemId, number | null>;
  openRisk: string;
  openBenefit: string;
  rawColumns: Record<string, string>;
}

export type DiscardStage =
  | 'eligibility'
  | 'attention'
  | 'duration'
  | 'straightlining'
  | 'duplicate';

export type RowAuditStatus = 'valid' | 'discarded';

export type CollectionPhase = 'planned' | 'extended' | 'post_extension';

export interface ConstructScores {
  C_VEL: number | null;
  C_QUAL: number | null;
  C_QUAL_raw16: number | null;
  C_QUAL_no16: number | null;
  C_QUAL_no17: number | null;
  M_REV: number | null;
  item16Raw: number | null;
  item16Inverted: number | null;
}

export interface ValidRespondent extends RawCsvRow {
  scores: ConstructScores;
  likertEffective: Record<LikertItemId, number | null>;
  answeredCounts: {
    C_VEL: number;
    C_QUAL: number;
    M_REV: number;
  };
  collectionPhase: CollectionPhase;
  isPostPlannedWindow: boolean;
  isPostExtension: boolean;
}

export interface RawRowAudit {
  rowNumber: number;
  idLabel: string;
  timestampRaw: string;
  timestampIso: string | null;
  status: RowAuditStatus;
  discardStage: DiscardStage | null;
  discardReason: string | null;
  seniority: SeniorityLevel | null;
  toolRaw: string;
  toolNormalized: string;
  frequencyRaw: string;
  scores: ConstructScores | null;
  raw: RawCsvRow;
  validRespondent: ValidRespondent | null;
}

export interface FunnelDiscardedItem {
  rowNumber: number;
  idLabel: string;
  timestampRaw: string;
  reason: string;
}

export interface FunnelStep {
  stage: 'raw' | DiscardStage | 'valid';
  label: string;
  description: string;
  inputCount: number;
  discardedCount: number;
  remainingCount: number;
  discardedRows: FunnelDiscardedItem[];
  available: boolean;
  note?: string;
}

export interface CleaningSummary {
  totalRaw: number;
  totalEligible: number;
  totalAfterAttention: number;
  totalAfterDuration: number;
  totalAfterStraightlining: number;
  totalAfterDuplicates: number;
  totalValid: number;
  durationCheckAvailable: boolean;
  funnel: FunnelStep[];
  audits: RawRowAudit[];
  validRespondents: ValidRespondent[];
}

export interface FilterState {
  seniorities: SeniorityLevel[];
  tools: string[];
  frequencies: string[];
  normalizeTools: boolean;
  invertItem16: boolean;
}

export interface ConfidenceInterval {
  lower: number;
  upper: number;
  level: number;
}

export interface DistributionCounts {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
  NA: number;
}

export interface LikertItemStats {
  id: LikertItemId | ReviewItemId;
  shortLabel: string;
  questionText: string;
  construct: ConstructId;
  inverted: boolean;
  effectiveInverted: boolean;
  nValid: number;
  nNA: number;
  median: number | null;
  modes: number[];
  mad: number | null;
  mean: number | null;
  sd: number | null;
  agreementCount: number;
  agreementPct: number;
  agreementWilsonCI: ConfidenceInterval;
  neutralCount: number;
  neutralPct: number;
  disagreementCount: number;
  disagreementPct: number;
  distribution: DistributionCounts;
}

export interface ConstructDescriptiveStats {
  id: ConstructId;
  label: string;
  nValid: number;
  nMissing: number;
  median: number | null;
  modes: number[];
  mad: number | null;
  mean: number | null;
  sd: number | null;
  agreementCount: number;
  agreementPct: number;
  agreementWilsonCI: ConfidenceInterval;
  distribution: DistributionCounts;
}

export interface ProfileBreakdownItem {
  label: string;
  count: number;
  pct: number;
}

export interface TimelinePoint {
  date: string;
  label: string;
  rawCount: number;
  validCount: number;
  discardedCount: number;
  cumulativeValid: number;
  phase: CollectionPhase;
}

export interface ItemDropDiagnostic {
  itemId: LikertItemId;
  shortLabel: string;
  questionText: string;
  nUsed: number;
  rItemTotalCorrected: number | null;
  alphaIfDropped: number | null;
  deltaAlpha: number | null;
  candidateForRemoval: boolean;
}

export interface CronbachAnalysis {
  construct: 'C_VEL' | 'C_QUAL';
  label: string;
  nComplete: number;
  nItems: number;
  alpha: number | null;
  ci95: ConfidenceInterval | null;
  passedThreshold: boolean;
  threshold: number;
  itemDiagnostics: ItemDropDiagnostic[];
  fallbackAction: 'none' | 'drop_single_item' | 'item_by_item_bonferroni';
  recommendedDropItem: LikertItemId | null;
  alphaAfterDrop: number | null;
  note: string;
}

export interface SpearmanReliability {
  construct: 'M_REV';
  label: string;
  items: ['ITEM_19', 'ITEM_20'];
  n: number;
  rho: number | null;
  pValue: number | null;
  ci95: ConfidenceInterval | null;
  passedThreshold: boolean;
  threshold: number;
  fallbackAction: 'none' | 'item_by_item_bonferroni';
  note: string;
}

export interface ReliabilityReport {
  cVel: CronbachAnalysis;
  cQual: CronbachAnalysis;
  mRev: SpearmanReliability;
  anyFallbackActive: boolean;
  fallbackReason: string | null;
}

export interface GroupSummary {
  group: string;
  n: number;
  median: number | null;
  q1: number | null;
  q3: number | null;
  iqr: number | null;
  mad: number | null;
  min: number | null;
  max: number | null;
  values: number[];
}

export interface DunnPairResult {
  pair: string;
  groupA: string;
  groupB: string;
  z: number;
  pRaw: number;
  pBonferroni: number;
  significant: boolean;
}

export interface KruskalWallisResult {
  target: string;
  label: string;
  n: number;
  k: number;
  h: number | null;
  pValue: number | null;
  alphaAdjusted: number;
  significant: boolean;
  epsilonSquared: number | null;
  epsilonSquaredCI: ConfidenceInterval | null;
  groups: GroupSummary[];
  dunnPostHoc: DunnPairResult[];
}

export interface MannWhitneyResult {
  target: string;
  label: string;
  groupA: string;
  groupB: string;
  nA: number;
  nB: number;
  u: number | null;
  z: number | null;
  pValue: number | null;
  pExact: number | null;
  pMethod: 'exact' | 'normal_approx';
  alphaAdjusted: number;
  significant: boolean;
  effectR: number | null;
  rankBiserialR: number | null;
  groups: GroupSummary[];
}

export interface QP3ItemComparison {
  itemId: LikertItemId;
  construct: 'C_VEL' | 'C_QUAL';
  shortLabel: string;
  pBonferroniThreshold: number;
  mannWhitneyMerged: MannWhitneyResult | null;
  kruskalWallis: KruskalWallisResult | null;
}

export interface QP3Result {
  alphaFamily: number;
  groupCounts: Record<SeniorityLevel, number>;
  minGroupSize: number;
  minRequiredPerGroup: number;
  mergeApplied: boolean;
  mergeRuleDescription: string;
  primaryMethod: 'mann_whitney_merged' | 'kruskal_wallis';
  cVelPrimary: MannWhitneyResult | KruskalWallisResult;
  cQualPrimary: MannWhitneyResult | KruskalWallisResult;
  cVelMannWhitneyMerged: MannWhitneyResult | null;
  cQualMannWhitneyMerged: MannWhitneyResult | null;
  cVelKruskalWallis: KruskalWallisResult;
  cQualKruskalWallis: KruskalWallisResult;
  itemLevelFallback: QP3ItemComparison[];
}

export type CohenMagnitude = 'negligible' | 'weak' | 'moderate' | 'strong';

export interface SpearmanResult {
  label: string;
  n: number;
  rho: number | null;
  pValue: number | null;
  ci95: ConfidenceInterval | null;
  alpha: number;
  significant: boolean;
  magnitude: CohenMagnitude;
  magnitudeLabelPt: string;
}

export interface QP4SensitivityRow {
  key: 'main' | 'no_item16' | 'no_item17' | 'partial_sen_uso';
  label: string;
  description: string;
  isExploratory: boolean;
  n: number;
  rho: number | null;
  pValue: number | null;
  ci95: ConfidenceInterval | null;
  magnitudeLabelPt: string;
}

export interface QP4ItemCorrelation {
  reviewItem: ReviewItemId;
  qualityItem: QualityItemId;
  n: number;
  rho: number | null;
  pValue: number | null;
  pBonferroni: number | null;
  significantBonferroni: boolean;
}

export interface QP4ScatterPoint {
  idLabel: string;
  rowNumber: number;
  seniority: SeniorityLevel;
  mRev: number;
  cQual: number;
  tool: string;
  frequency: string;
}

export interface QP4Result {
  main: SpearmanResult;
  sensitivity: QP4SensitivityRow[];
  itemMatrix: QP4ItemCorrelation[];
  scatterPoints: QP4ScatterPoint[];
  note: string;
}

export interface PairedComparisonResult {
  n: number;
  cVelMedian: number | null;
  cQualMedian: number | null;
  velGreaterCount: number;
  qualGreaterCount: number;
  tieCount: number;
  wilcoxonW: number | null;
  z: number | null;
  pValue: number | null;
  effectR: number | null;
  pairs: Array<{
    idLabel: string;
    rowNumber: number;
    seniority: SeniorityLevel;
    cVel: number;
    cQual: number;
    diff: number;
  }>;
}

export interface ContingencyAnalysis {
  rows: string[];
  cols: SeniorityLevel[];
  counts: number[][];
  expected: number[][];
  rowTotals: number[];
  colTotals: number[];
  total: number;
  minExpected: number;
  cellsBelow5: number;
  methodUsed: 'chi2' | 'fisher_monte_carlo';
  chi2Statistic: number | null;
  df: number | null;
  pValue: number | null;
  cramersV: number | null;
  fisherMonteCarloB: number;
  note: string;
}

export interface EarlyVsLateGroup {
  label: string;
  n: number;
  cVelMedian: number | null;
  cQualMedian: number | null;
  mRevMedian: number | null;
}

export interface EarlyVsLateSplit {
  splitMode: 'median_timestamp' | 'deadline_24_11_12h';
  splitLabel: string;
  early: EarlyVsLateGroup;
  late: EarlyVsLateGroup;
  cVelTest: MannWhitneyResult;
  cQualTest: MannWhitneyResult;
  mRevTest: MannWhitneyResult;
}

export interface ExploratoryReport {
  pairedVelVsQual: PairedComparisonResult;
  toolBySeniority: ContingencyAnalysis;
  earlyVsLateByDeadline: EarlyVsLateSplit;
  earlyVsLateByMedian: EarlyVsLateSplit;
}

export type OpenQuestionType = 'risk' | 'benefit';

export interface CodebookCategory {
  id: string;
  type: OpenQuestionType;
  label: string;
  description: string;
  keywords: string[];
  examples: string[];
}

export interface CodedResponse {
  rowNumber: number;
  idLabel: string;
  seniority: SeniorityLevel;
  tool: string;
  rawText: string;
  isBlankOrNoise: boolean;
  noiseReason: string | null;
  themes: string[];
  themeLabels: string[];
}

export interface ThemeCount {
  id: string;
  label: string;
  description: string;
  count: number;
  pctOfAnswered: number;
  pctOfTotalValid: number;
}

export interface OpenCodingQuestionSummary {
  totalValid: number;
  answeredCount: number;
  substantiveCount: number;
  noiseOrBlankCount: number;
  themes: ThemeCount[];
  responses: CodedResponse[];
}

export interface OpenCodingSummary {
  riskCodebook: CodebookCategory[];
  benefitCodebook: CodebookCategory[];
  risks: OpenCodingQuestionSummary;
  benefits: OpenCodingQuestionSummary;
  cohenKappaNote: string;
}

export interface SurveyAnalysisMeta {
  generatedAt: string;
  targetN: number;
  minAcceptableN: number;
  plannedStart: string;
  plannedEnd: string;
  extensionDeadline: string;
  deliveryDeadline: string;
}

export interface SurveyAnalysisResult {
  meta: SurveyAnalysisMeta;
  cleaning: CleaningSummary;
  filter: FilterState;
  availableFilterOptions: {
    seniorities: SeniorityLevel[];
    toolsNormalized: string[];
    toolsRaw: string[];
    frequencies: string[];
  };
  baseline: {
    validCount: number;
    marginOfErrorPct: number;
    reliability: ReliabilityReport;
    qp3: QP3Result;
    qp4: QP4Result;
    exploratory: ExploratoryReport;
    openCoding: OpenCodingSummary;
  };
  filtered: {
    validCount: number;
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
    timeline: TimelinePoint[];
    reliability: ReliabilityReport;
    exploratory: ExploratoryReport;
    openCoding: OpenCodingSummary;
    validRespondents: ValidRespondent[];
  };
}
