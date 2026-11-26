import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BENEFIT_CODEBOOK,
  DEFAULT_BI_FILTER_STATE,
  RISK_CODEBOOK,
  aggregateQp4Ties,
  analyzeBiDashboardSlice,
  analyzeSurveyCsv,
  analyzeSurveyRows,
  applyBiClickTarget,
  buildSankeyData,
  classifyOrdinalTier,
  computeClampedKde,
  computeDumbbellSummaries,
  filterDrawerQuotes,
  hasActiveBiFilter,
  parseViewModeFromSearch,
  toggleArrayItem,
  toggleArrayPair,
} from './index';
import type { RawCsvRow, SurveyAnalysisResult } from './types';

const REAL_CSV_PATH = resolve(process.cwd(), '../questions.csv');
const realCsvText = readFileSync(REAL_CSV_PATH, 'utf-8');

function makeSyntheticRow(
  rowNumber: number,
  overrides: Partial<{
    experienceRaw: string;
    toolRaw: string;
    frequencyRaw: string;
    likert: Partial<
      Record<
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
        | 'ITEM_18',
        number | null
      >
    >;
    review: Partial<Record<'ITEM_19' | 'ITEM_20', number | null>>;
    openRisk: string;
    openBenefit: string;
  }> = {}
): RawCsvRow {
  const defaultLikert = {
    ITEM_08: 5,
    ITEM_09: 4,
    ITEM_10: 5,
    ITEM_11: 4,
    ITEM_12: 4,
    ITEM_13: 3,
    ITEM_14: 4,
    ITEM_15: 4,
    ITEM_16: 2,
    ITEM_17: 4,
    ITEM_18: 2,
    ...overrides.likert,
  };
  const defaultReview = {
    ITEM_19: 3,
    ITEM_20: 4,
    ...overrides.review,
  };
  const toLikertStr = (v: number | null) => {
    if (v === null) return 'Não se aplica';
    const map: Record<number, string> = {
      1: 'Discordo Totalmente',
      2: 'Discordo Parcialmente',
      3: 'Neutro',
      4: 'Concordo Parcialmente',
      5: 'Concordo Totalmente',
    };
    return map[v] ?? '';
  };
  const toFreqStr = (v: number | null) => {
    if (v === null) return 'Não se aplica';
    const map: Record<number, string> = {
      1: 'Nunca',
      2: 'Raramente',
      3: 'Às vezes',
      4: 'Frequentemente',
      5: 'Sempre',
    };
    return map[v] ?? '';
  };

  const experienceRaw = overrides.experienceRaw ?? 'Mais de 6 anos';
  const seniority =
    experienceRaw === 'Menos de 1 ano' || experienceRaw === '1 a 3 anos'
      ? 'Júnior'
      : experienceRaw === 'Mais de 3 a 6 anos'
        ? 'Pleno'
        : 'Sênior';

  const frequencyRaw = overrides.frequencyRaw ?? 'Todos os dias úteis';
  const frequencyCode =
    frequencyRaw === 'Menos de 1 dia por semana'
      ? 1
      : frequencyRaw === '1 a 3 dias por semana'
        ? 2
        : frequencyRaw === '4 a 5 dias por semana'
          ? 3
          : 4;

  const toolRaw = overrides.toolRaw ?? 'Kiro';

  return {
    rowNumber,
    idLabel: `R${String(rowNumber).padStart(2, '0')}`,
    timestampRaw: '20/11/2026 10:00:00',
    timestamp: new Date(2026, 10, 20, 10, 0, 0),
    timestampIso: '2026-11-20T10:00:00',
    durationSeconds: null,
    consent: 'Declaro ter 18 anos ou mais e concordo em participar.',
    eligibility: {
      item01: 'Sim',
      item02: 'Sim',
      item03: 'Sim',
      item04: 'Não',
    },
    experienceRaw,
    seniority,
    toolRaw,
    toolNormalized: toolRaw.toLowerCase().includes('kiro') ? 'Kiro' : toolRaw,
    toolIsOther: !['Copilot', 'ChatGPT', 'Claude', 'Cursor', 'Gemini'].includes(toolRaw),
    frequencyRaw,
    frequencyCode,
    likertRaw: {
      ITEM_08: toLikertStr(defaultLikert.ITEM_08),
      ITEM_09: toLikertStr(defaultLikert.ITEM_09),
      ITEM_10: toLikertStr(defaultLikert.ITEM_10),
      ITEM_11: toLikertStr(defaultLikert.ITEM_11),
      ITEM_12: toLikertStr(defaultLikert.ITEM_12),
      ITEM_13: toLikertStr(defaultLikert.ITEM_13),
      ITEM_14: toLikertStr(defaultLikert.ITEM_14),
      ITEM_15: toLikertStr(defaultLikert.ITEM_15),
      ITEM_16: toLikertStr(defaultLikert.ITEM_16),
      ITEM_17: toLikertStr(defaultLikert.ITEM_17),
      ITEM_18: toLikertStr(defaultLikert.ITEM_18),
    },
    likertNumeric: defaultLikert,
    reviewRaw: {
      ITEM_19: toFreqStr(defaultReview.ITEM_19),
      ITEM_20: toFreqStr(defaultReview.ITEM_20),
    },
    reviewNumeric: defaultReview,
    openRisk: overrides.openRisk ?? 'bugs por falta de contexto',
    openBenefit: overrides.openBenefit ?? 'maior produtividade e velocidade',
    rawColumns: {},
  };
}

describe('BI Cross-Filter & Tier Classification', () => {
  const baseResult = analyzeSurveyCsv(realCsvText);

  it('classifica faixas ordinais semi-abertas e escores ausentes corretamente', () => {
    expect(classifyOrdinalTier(1.0)).toBe('low');
    expect(classifyOrdinalTier(2.49)).toBe('low');
    expect(classifyOrdinalTier(2.5)).toBe('moderate');
    expect(classifyOrdinalTier(3.74)).toBe('moderate');
    expect(classifyOrdinalTier(3.75)).toBe('high');
    expect(classifyOrdinalTier(5.0)).toBe('high');
    expect(classifyOrdinalTier(null)).toBe('unclassified');
    expect(classifyOrdinalTier(undefined)).toBe('unclassified');
    expect(classifyOrdinalTier(Number.NaN)).toBe('unclassified');
    expect(classifyOrdinalTier(0.9)).toBe('unclassified');
    expect(classifyOrdinalTier(5.1)).toBe('unclassified');
  });

  it('executa helpers de alternância simples e em par sem duplicatas', () => {
    expect(toggleArrayItem(['Júnior'], 'Pleno')).toEqual(['Júnior', 'Pleno']);
    expect(toggleArrayItem(['Júnior', 'Pleno'], 'Júnior')).toEqual(['Pleno']);

    expect(toggleArrayPair([], 'low', 'high')).toEqual(['low', 'high']);
    expect(toggleArrayPair(['low'], 'low', 'high')).toEqual(['low', 'high']);
    expect(toggleArrayPair(['low', 'high'], 'low', 'high')).toEqual([]);
    expect(toggleArrayPair(['moderate'], 'low', 'low')).toEqual(['moderate', 'low']);

    expect(hasActiveBiFilter(DEFAULT_BI_FILTER_STATE)).toBe(false);
    expect(
      hasActiveBiFilter({ ...DEFAULT_BI_FILTER_STATE, mRevTiers: ['high'] })
    ).toBe(true);
  });

  it('preserva totais e estatísticas baseline na fatia sem filtros', () => {
    const slice = analyzeBiDashboardSlice(baseResult, DEFAULT_BI_FILTER_STATE);
    expect(slice.hasActiveFilter).toBe(false);
    expect(slice.validCount).toBe(26);
    expect(slice.baselineValidCount).toBe(26);
    expect(slice.lowSampleWarning).toBe(false);
    expect(slice.activeGroupCountQP3).toBe(2);
    expect(slice.qp4.main.rho).toBeCloseTo(baseResult.baseline.qp4.main.rho ?? 0, 6);
    expect(slice.pairedVelVsQual.velGreaterCount).toBe(26);
  });

  it('aplica OR intra-dimensão, AND inter-dimensão e contagem leave-one-out nas facetas', () => {
    const jrPlSlice = analyzeBiDashboardSlice(baseResult, {
      ...DEFAULT_BI_FILTER_STATE,
      seniorities: ['Júnior', 'Pleno'],
    });
    expect(jrPlSlice.validCount).toBe(12);
    expect(jrPlSlice.activeGroupCountQP3).toBe(1);

    const srFacet = jrPlSlice.facetProfiles.seniorities.find((s) => s.id === 'Sênior');
    expect(srFacet?.count).toBe(14);
    expect(srFacet?.selected).toBe(false);
    expect(srFacet?.dimmed).toBe(true);

    const srHighRev = analyzeBiDashboardSlice(baseResult, {
      ...DEFAULT_BI_FILTER_STATE,
      seniorities: ['Sênior'],
      mRevTiers: ['high'],
    });
    expect(srHighRev.validCount).toBeGreaterThan(0);
    expect(srHighRev.validCount).toBeLessThan(14);
    expect(
      srHighRev.validRespondents.every(
        (r) => r.seniority === 'Sênior' && classifyOrdinalTier(r.scores.M_REV) === 'high'
      )
    ).toBe(true);

    const totalInSenFacet = srHighRev.facetProfiles.seniorities.reduce(
      (sum, f) => sum + f.count,
      0
    );
    const highRevCount = baseResult.cleaning.validRespondents.filter(
      (r) => classifyOrdinalTier(r.scores.M_REV) === 'high'
    ).length;
    expect(totalInSenFacet).toBe(highRevCount);
  });

  it('filtra por temas abertos com IDs exatos em português sem incluir ruído ou branco', () => {
    const allRiskIds = RISK_CODEBOOK.map((c) => c.id);
    const allBenefitIds = BENEFIT_CODEBOOK.map((c) => c.id);
    expect(allRiskIds).toEqual([
      'bugs_alucinacoes',
      'seguranca',
      'pressao_burnout',
      'revisao_sobrecarga',
      'dependencia_conhecimento',
    ]);
    expect(allBenefitIds).toEqual([
      'velocidade_produtividade',
      'prototipacao_discovery',
      'boilerplate_repetitivo',
      'debug_investigacao',
      'testes_refatoracao',
    ]);

    const riskSlice = analyzeBiDashboardSlice(baseResult, {
      ...DEFAULT_BI_FILTER_STATE,
      riskThemes: allRiskIds,
    });
    expect(riskSlice.validCount).toBe(23);
    expect(riskSlice.openCoding.risks.noiseOrBlankCount).toBe(0);

    const secSlice = analyzeBiDashboardSlice(baseResult, {
      ...DEFAULT_BI_FILTER_STATE,
      riskThemes: ['seguranca'],
      benefitThemes: ['velocidade_produtividade'],
    });
    expect(secSlice.validCount).toBeGreaterThan(0);
    expect(secSlice.validCount).toBeLessThan(23);
  });

  it('respeita normalizeTools=false no filtro de ferramentas e lida com fatia vazia (n=0) e grupo único', () => {
    const unnormResult = analyzeSurveyCsv(realCsvText, { normalizeTools: false });
    const kiroAwsSlice = analyzeBiDashboardSlice(unnormResult, {
      ...DEFAULT_BI_FILTER_STATE,
      tools: ['kiro aws'],
    });
    expect(kiroAwsSlice.normalizeTools).toBe(false);
    expect(kiroAwsSlice.validCount).toBe(2);
    expect(kiroAwsSlice.lowSampleWarning).toBe(true);

    const srOnly = analyzeBiDashboardSlice(baseResult, {
      ...DEFAULT_BI_FILTER_STATE,
      seniorities: ['Sênior'],
    });
    expect(srOnly.activeGroupCountQP3).toBe(1);
    expect(srOnly.qp3.cVelMannWhitneyMerged?.pValue).toBeNull();
    expect(srOnly.qp3.cQualMannWhitneyMerged?.pValue).toBeNull();

    const emptySlice = analyzeBiDashboardSlice(baseResult, {
      ...DEFAULT_BI_FILTER_STATE,
      seniorities: ['Júnior'],
      frequencies: ['Menos de 1 dia por semana'],
    });
    expect(emptySlice.validCount).toBe(0);
    expect(emptySlice.lowSampleWarning).toBe(true);
    expect(emptySlice.activeGroupCountQP3).toBe(0);
    expect(emptySlice.qp4.main.rho).toBeNull();
  });

  it('filtra por cQualTiers isolado e combinado com mRevTiers e exclui escores unclassified (TE-3)', () => {
    const highQualSlice = analyzeBiDashboardSlice(baseResult, {
      ...DEFAULT_BI_FILTER_STATE,
      cQualTiers: ['high'],
    });
    expect(highQualSlice.validCount).toBeGreaterThan(0);
    expect(
      highQualSlice.validRespondents.every(
        (r) => classifyOrdinalTier(r.scores.C_QUAL) === 'high'
      )
    ).toBe(true);

    const combinedSlice = analyzeBiDashboardSlice(baseResult, {
      ...DEFAULT_BI_FILTER_STATE,
      cQualTiers: ['high'],
      mRevTiers: ['moderate'],
    });
    expect(
      combinedSlice.validRespondents.every(
        (r) =>
          classifyOrdinalTier(r.scores.C_QUAL) === 'high' &&
          classifyOrdinalTier(r.scores.M_REV) === 'moderate'
      )
    ).toBe(true);
    expect(combinedSlice.validCount).toBeLessThanOrEqual(highQualSlice.validCount);

    const firstValid = baseResult.cleaning.validRespondents[0];
    const unclassifiedClone = {
      ...firstValid,
      rowNumber: 999,
      idLabel: 'R999',
      scores: { ...firstValid.scores, M_REV: null, C_QUAL: null },
    };
    const augmentedResult: SurveyAnalysisResult = {
      ...baseResult,
      cleaning: {
        ...baseResult.cleaning,
        validRespondents: [...baseResult.cleaning.validRespondents, unclassifiedClone],
      },
    };

    const allMRevSlice = analyzeBiDashboardSlice(augmentedResult, {
      ...DEFAULT_BI_FILTER_STATE,
      mRevTiers: ['low', 'moderate', 'high'],
    });
    expect(allMRevSlice.validRespondents.some((r) => r.rowNumber === 999)).toBe(false);

    const allCQualSlice = analyzeBiDashboardSlice(augmentedResult, {
      ...DEFAULT_BI_FILTER_STATE,
      cQualTiers: ['low', 'moderate', 'high'],
    });
    expect(allCQualSlice.validRespondents.some((r) => r.rowNumber === 999)).toBe(false);
  });

  it('aplica redutor puro applyBiClickTarget e filtra relatos em filterDrawerQuotes (TE-4)', () => {
    const rSen = applyBiClickTarget(DEFAULT_BI_FILTER_STATE, {
      kind: 'seniority',
      value: 'Sênior',
    });
    expect(rSen.nextFilter.seniorities).toEqual(['Sênior']);
    expect(rSen.openedTheme).toBeUndefined();

    const rPairAddBoth = applyBiClickTarget(DEFAULT_BI_FILTER_STATE, {
      kind: 'seniorityPair',
      seniorities: ['Júnior', 'Pleno'],
    });
    expect(rPairAddBoth.nextFilter.seniorities).toEqual(['Júnior', 'Pleno']);

    const rPairFromOne = applyBiClickTarget(
      { ...DEFAULT_BI_FILTER_STATE, seniorities: ['Júnior'] },
      { kind: 'seniorityPair', seniorities: ['Júnior', 'Pleno'] }
    );
    expect(rPairFromOne.nextFilter.seniorities).toEqual(['Júnior', 'Pleno']);

    const rPairRemoveBoth = applyBiClickTarget(
      { ...DEFAULT_BI_FILTER_STATE, seniorities: ['Júnior', 'Pleno', 'Sênior'] },
      { kind: 'seniorityPair', seniorities: ['Júnior', 'Pleno'] }
    );
    expect(rPairRemoveBoth.nextFilter.seniorities).toEqual(['Sênior']);

    expect(
      applyBiClickTarget(DEFAULT_BI_FILTER_STATE, { kind: 'tool', value: 'Kiro' }).nextFilter.tools
    ).toEqual(['Kiro']);
    expect(
      applyBiClickTarget(DEFAULT_BI_FILTER_STATE, {
        kind: 'frequency',
        value: 'Todos os dias úteis',
      }).nextFilter.frequencies
    ).toEqual(['Todos os dias úteis']);
    expect(
      applyBiClickTarget(DEFAULT_BI_FILTER_STATE, { kind: 'mRevTier', value: 'moderate' })
        .nextFilter.mRevTiers
    ).toEqual(['moderate']);
    expect(
      applyBiClickTarget(DEFAULT_BI_FILTER_STATE, { kind: 'cQualTier', value: 'high' })
        .nextFilter.cQualTiers
    ).toEqual(['high']);

    const rBubbleAdd = applyBiClickTarget(DEFAULT_BI_FILTER_STATE, {
      kind: 'bubble',
      mRevTier: 'moderate',
      cQualTier: 'high',
    });
    expect(rBubbleAdd.nextFilter.mRevTiers).toEqual(['moderate']);
    expect(rBubbleAdd.nextFilter.cQualTiers).toEqual(['high']);

    const rBubbleRemove = applyBiClickTarget(rBubbleAdd.nextFilter, {
      kind: 'bubble',
      mRevTier: 'moderate',
      cQualTier: 'high',
    });
    expect(rBubbleRemove.nextFilter.mRevTiers).toEqual([]);
    expect(rBubbleRemove.nextFilter.cQualTiers).toEqual([]);

    const rRisk = applyBiClickTarget(DEFAULT_BI_FILTER_STATE, {
      kind: 'riskTheme',
      themeId: 'seguranca',
      label: 'Segurança',
    });
    expect(rRisk.nextFilter.riskThemes).toEqual(['seguranca']);
    expect(rRisk.openedTheme).toEqual({ type: 'risk', themeId: 'seguranca' });

    const rBenefit = applyBiClickTarget(DEFAULT_BI_FILTER_STATE, {
      kind: 'benefitTheme',
      themeId: 'velocidade_produtividade',
      label: 'Velocidade',
    });
    expect(rBenefit.nextFilter.benefitThemes).toEqual(['velocidade_produtividade']);
    expect(rBenefit.openedTheme).toEqual({
      type: 'benefit',
      themeId: 'velocidade_produtividade',
    });

    expect(applyBiClickTarget(rSen.nextFilter, { kind: 'noop' }).nextFilter).toBe(
      rSen.nextFilter
    );
    expect(applyBiClickTarget(rSen.nextFilter, null).nextFilter).toBe(rSen.nextFilter);

    const openCoding = baseResult.baseline.openCoding;
    const allQuotes = filterDrawerQuotes(openCoding, [], []);
    expect(allQuotes.length).toBe(
      openCoding.risks.substantiveCount + openCoding.benefits.substantiveCount
    );
    expect(allQuotes.every((q) => !q.response.isBlankOrNoise)).toBe(true);

    const riskOnlyQuotes = filterDrawerQuotes(openCoding, ['seguranca'], []);
    expect(riskOnlyQuotes.length).toBeGreaterThan(0);
    expect(riskOnlyQuotes.every((q) => q.type === 'risk')).toBe(true);
    expect(
      riskOnlyQuotes.every((q) => q.response.themes.includes('seguranca'))
    ).toBe(true);

    const bothQuotes = filterDrawerQuotes(
      openCoding,
      ['seguranca'],
      ['velocidade_produtividade']
    );
    expect(bothQuotes.some((q) => q.type === 'risk')).toBe(true);
    expect(bothQuotes.some((q) => q.type === 'benefit')).toBe(true);
    expect(
      bothQuotes.every((q) =>
        q.type === 'risk'
          ? q.response.themes.includes('seguranca')
          : q.response.themes.includes('velocidade_produtividade')
      )
    ).toBe(true);
  });

  it('interpreta parâmetro ?mode= da URL via parseViewModeFromSearch (TE-6)', () => {
    expect(parseViewModeFromSearch('')).toBe('dashboard');
    expect(parseViewModeFromSearch('?mode=dashboard')).toBe('dashboard');
    expect(parseViewModeFromSearch('?mode=report')).toBe('report');
    expect(parseViewModeFromSearch('?mode=invalid')).toBe('dashboard');
    expect(parseViewModeFromSearch('?foo=1&mode=report')).toBe('report');
  });
});

describe('BI Data Aggregators & Mathematical Guards', () => {
  const baseResult = analyzeSurveyCsv(realCsvText);

  it('computa KDE limitada em [1,0; 5,0] com guarda de IQR=0 e variância zero', () => {
    const normalKde = computeClampedKde([2.0, 3.0, 3.5, 4.0, 4.5, 5.0]);
    expect(normalKde.bandwidth).toBeGreaterThanOrEqual(0.18);
    expect(normalKde.points).toHaveLength(40);
    expect(normalKde.points[0].score).toBe(1.0);
    expect(normalKde.points[39].score).toBe(5.0);
    expect(normalKde.points.every((p) => p.score >= 1.0 && p.score <= 5.0)).toBe(true);
    expect(normalKde.points.every((p) => Number.isFinite(p.density) && p.density >= 0)).toBe(true);

    const iqrZeroKde = computeClampedKde([4, 4, 4, 4, 5]);
    expect(iqrZeroKde.bandwidth).toBeGreaterThan(0);
    expect(Number.isFinite(iqrZeroKde.bandwidth)).toBe(true);
    expect(iqrZeroKde.points).toHaveLength(40);

    const flatKde = computeClampedKde([5, 5, 5, 5]);
    expect(flatKde.bandwidth).toBe(0);
    expect(flatKde.points).toEqual([]);
    expect(flatKde.maxDensity).toBe(0);

    const smallKde = computeClampedKde([4, 5]);
    expect(smallKde.bandwidth).toBe(0);
    expect(smallKde.points).toEqual([]);
  });

  it('agrega células exatas de empate QP4 com tie-break e descarte de pontos inválidos (TE-5)', () => {
    const agg = aggregateQp4Ties(baseResult.baseline.qp4.scatterPoints);
    const cellSum = agg.cells.reduce((acc, c) => acc + c.count, 0);
    expect(cellSum).toBe(26);
    expect(
      agg.mRevTierCounts.low + agg.mRevTierCounts.moderate + agg.mRevTierCounts.high
    ).toBe(26);
    expect(
      agg.cQualTierCounts.low + agg.cQualTierCounts.moderate + agg.cQualTierCounts.high
    ).toBe(26);
    expect(agg.olsLine).not.toBeNull();

    const plenoJrTieAgg = aggregateQp4Ties([
      { idLabel: 'R03', rowNumber: 3, seniority: 'Júnior', mRev: 3.0, cQual: 3.5, tool: 'Kiro', frequency: 'Todos os dias úteis' },
      { idLabel: 'R04', rowNumber: 4, seniority: 'Pleno', mRev: 3.0, cQual: 3.5, tool: 'Kiro', frequency: 'Todos os dias úteis' },
      { idLabel: 'R_BAD', rowNumber: 5, seniority: 'Sênior', mRev: Number.NaN, cQual: 4.0, tool: 'Kiro', frequency: 'Todos os dias úteis' },
      { idLabel: 'R_OOB', rowNumber: 6, seniority: 'Sênior', mRev: 0.5, cQual: 4.0, tool: 'Kiro', frequency: 'Todos os dias úteis' },
    ]);
    expect(plenoJrTieAgg.cells).toHaveLength(1);
    expect(plenoJrTieAgg.cells[0].dominantSeniority).toBe('Pleno');
    expect(plenoJrTieAgg.cells[0].count).toBe(2);
    expect(plenoJrTieAgg.olsLine).toBeNull();
  });

  it('calcula resumos Dumbbell de construtos/itens e grafo Sankey acíclico de 4 estágios', () => {
    const { constructRows, itemRows } = computeDumbbellSummaries(
      baseResult.cleaning.validRespondents,
      true
    );
    expect(constructRows).toHaveLength(4);
    expect(itemRows).toHaveLength(10);
    expect(constructRows[0].cVelMedian).toBeCloseTo(5.0, 2);
    expect(constructRows[0].cQualMedian).toBeCloseTo(4.0, 2);
    expect(constructRows[0].gap).toBeCloseTo(1.0, 2);

    const graph = buildSankeyData(baseResult.cleaning.validRespondents, true);
    const nodeIds = graph.nodes.map((n) => n.name);
    expect(new Set(nodeIds).size).toBe(nodeIds.length);
    const stageWeight = (fromPrefix: string, toPrefix: string) =>
      graph.links
        .filter((l) => l.source.startsWith(fromPrefix) && l.target.startsWith(toPrefix))
        .reduce((acc, l) => acc + l.value, 0);
    expect(stageWeight('sen:', 'tool:')).toBe(26);
    expect(stageWeight('tool:', 'rev:')).toBe(26);
    expect(stageWeight('rev:', 'qual:')).toBe(26);

    const manyToolRows = Array.from({ length: 8 }, (_, idx) =>
      makeSyntheticRow(idx + 1, {
        toolRaw: `Tool_${idx + 1}`,
        likert: idx === 0 ? { ITEM_12: null, ITEM_13: null, ITEM_14: null } : {},
        openRisk: `risco unico ${idx}`,
      })
    );
    const syntheticAnalysis = analyzeSurveyRows(manyToolRows);
    const manyGraph = buildSankeyData(syntheticAnalysis.cleaning.validRespondents, true);
    expect(manyGraph.nodes.find((n) => n.name === 'tool:Outras')?.count).toBe(3);
    expect(manyGraph.nodes.find((n) => n.name === 'tool:Outras')?.clickTarget.kind).toBe('noop');
    expect(manyGraph.nodes.find((n) => n.name === 'qual:unclassified')?.clickTarget.kind).toBe('noop');
  });
});
