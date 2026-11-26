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
  buildConstructDumbbellOption,
  buildFullDumbbellProfileOption,
  buildPairedThemeButterflyOption,
  buildQp4JointMatrixOption,
  buildRaincloudOption,
  buildSankeyData,
  buildSankeyOption,
  classifyOrdinalTier,
  computeClampedKde,
  computeDumbbellSummaries,
  hasActiveBiFilter,
  toggleArrayItem,
  toggleArrayPair,
} from './index';
import type { RawCsvRow } from './types';

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
    toolIsOther: !['Copilot', 'ChatGPT', 'Claude', 'Cursor', 'Gemini'].includes(
      toolRaw
    ),
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
    // Intra-dimension OR: Júnior (6) + Pleno (6) = 12
    const jrPlSlice = analyzeBiDashboardSlice(baseResult, {
      ...DEFAULT_BI_FILTER_STATE,
      seniorities: ['Júnior', 'Pleno'],
    });
    expect(jrPlSlice.validCount).toBe(12);
    expect(jrPlSlice.activeGroupCountQP3).toBe(1);

    // Leave-one-out on seniorities retains Sênior count (14) even when dimmed
    const srFacet = jrPlSlice.facetProfiles.seniorities.find((s) => s.id === 'Sênior');
    expect(srFacet?.count).toBe(14);
    expect(srFacet?.selected).toBe(false);
    expect(srFacet?.dimmed).toBe(true);

    // Inter-dimension AND: Sênior (14) AND mRevTiers=['high']
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
    // Leave-one-out seniorities facet reflects respondents matching mRevTiers=['high']
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
    // In questions.csv: 26 valid, 3 are noise/blank ("nenhum por enquanto", and two empty) -> 23 substantive
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

    // Single non-empty group in QP3 (Sênior only)
    const srOnly = analyzeBiDashboardSlice(baseResult, {
      ...DEFAULT_BI_FILTER_STATE,
      seniorities: ['Sênior'],
    });
    expect(srOnly.activeGroupCountQP3).toBe(1);
    expect(srOnly.qp3.cVelMannWhitneyMerged?.pValue).toBeNull();
    expect(srOnly.qp3.cQualMannWhitneyMerged?.pValue).toBeNull();

    // Empty slice (n = 0): Júnior + kiro aws + 4 a 5 dias por semana does not exist
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
});

describe('BI Chart Math & Option Builders', () => {
  const baseResult = analyzeSurveyCsv(realCsvText);

  it('computa KDE limitada em [1,0; 5,0] com guarda de IQR=0 e variância zero', () => {
    const normalKde = computeClampedKde([2.0, 3.0, 3.5, 4.0, 4.5, 5.0]);
    expect(normalKde.bandwidth).toBeGreaterThanOrEqual(0.18);
    expect(normalKde.points).toHaveLength(40);
    expect(normalKde.points[0].score).toBe(1.0);
    expect(normalKde.points[39].score).toBe(5.0);
    expect(normalKde.points.every((p) => p.score >= 1.0 && p.score <= 5.0)).toBe(true);
    expect(normalKde.points.every((p) => Number.isFinite(p.density) && p.density >= 0)).toBe(true);

    // IQR = 0 but sd > 0 -> positive finite bandwidth
    const iqrZeroKde = computeClampedKde([4, 4, 4, 4, 5]);
    expect(iqrZeroKde.bandwidth).toBeGreaterThan(0);
    expect(Number.isFinite(iqrZeroKde.bandwidth)).toBe(true);
    expect(iqrZeroKde.points.length).toBe(40);
    expect(iqrZeroKde.points.every((p) => Number.isFinite(p.density))).toBe(true);

    // Zero variance (sd === 0) -> empty KDE, no NaNs
    const flatKde = computeClampedKde([5, 5, 5, 5]);
    expect(flatKde.bandwidth).toBe(0);
    expect(flatKde.points).toEqual([]);
    expect(flatKde.maxDensity).toBe(0);

    // Small group (n < 3) -> empty KDE, no NaNs
    const smallKde = computeClampedKde([4, 5]);
    expect(smallKde.bandwidth).toBe(0);
    expect(smallKde.points).toEqual([]);

    // Option builds cleanly even with mixed empty/flat/valid groups
    const opt = buildRaincloudOption({
      groups: baseResult.baseline.qp3.cVelMannWhitneyMerged?.groups ?? [],
      selectedSeniorities: ['Sênior'],
      compact: true,
    });
    expect(Array.isArray(opt.series)).toBe(true);
  });

  it('agrega células exatas de empate QP4 somando n=26 e constrói matriz 3-grid', () => {
    const agg = aggregateQp4Ties(baseResult.baseline.qp4.scatterPoints);
    const cellSum = agg.cells.reduce((acc, c) => acc + c.count, 0);
    expect(cellSum).toBe(26);

    const mRevSum =
      agg.mRevTierCounts.low + agg.mRevTierCounts.moderate + agg.mRevTierCounts.high;
    const cQualSum =
      agg.cQualTierCounts.low + agg.cQualTierCounts.moderate + agg.cQualTierCounts.high;
    expect(mRevSum).toBe(26);
    expect(cQualSum).toBe(26);
    expect(agg.olsLine).not.toBeNull();

    // Tie-break check: Sênior > Pleno > Júnior
    const tiedPoints = [
      {
        idLabel: 'R01',
        rowNumber: 1,
        seniority: 'Júnior' as const,
        mRev: 3,
        cQual: 4,
        tool: 'Kiro',
        frequency: 'Todos os dias úteis',
      },
      {
        idLabel: 'R02',
        rowNumber: 2,
        seniority: 'Sênior' as const,
        mRev: 3,
        cQual: 4,
        tool: 'Kiro',
        frequency: 'Todos os dias úteis',
      },
    ];
    const tieAgg = aggregateQp4Ties(tiedPoints);
    expect(tieAgg.cells[0].dominantSeniority).toBe('Sênior');
    expect(tieAgg.olsLine).toBeNull(); // var(M_REV) === 0

    const matrixOpt = buildQp4JointMatrixOption({
      scatterPoints: baseResult.baseline.qp4.scatterPoints,
      activeMRevTiers: ['high'],
    });
    expect(Array.isArray(matrixOpt.grid)).toBe(true);
    expect((matrixOpt.grid as Array<{ containLabel?: boolean }>).length).toBe(3);
    expect(
      (matrixOpt.grid as Array<{ containLabel?: boolean }>).every(
        (g) => g.containLabel === false
      )
    ).toBe(true);
    expect((matrixOpt.legend as { show?: boolean }).show).toBe(false);
  });

  it('calcula resumos Dumbbell de construtos e itens e gera opções ECharts', () => {
    const { constructRows, itemRows } = computeDumbbellSummaries(
      baseResult.cleaning.validRespondents,
      true
    );
    expect(constructRows).toHaveLength(4);
    expect(itemRows).toHaveLength(10);

    const overall = constructRows[0];
    expect(overall.label).toBe('Amostra Geral');
    expect(overall.n).toBe(26);
    expect(overall.cVelMedian).toBeCloseTo(5.0, 2);
    expect(overall.cQualMedian).toBeCloseTo(4.0, 2);
    expect(overall.gap).toBeCloseTo(1.0, 2);
    expect(overall.velGreaterPct).toBeCloseTo(100, 1);

    const compactOpt = buildConstructDumbbellOption({ constructRows });
    const fullOpt = buildFullDumbbellProfileOption({ constructRows, itemRows });
    expect(Array.isArray(compactOpt.series)).toBe(true);
    expect(Array.isArray(fullOpt.series)).toBe(true);
  });

  it('constrói grafo Sankey de 4 estágios acíclico com prefixos únicos e conservação de fluxo', () => {
    const graph = buildSankeyData(baseResult.cleaning.validRespondents, true);
    const nodeIds = graph.nodes.map((n) => n.name);
    expect(new Set(nodeIds).size).toBe(nodeIds.length);
    expect(
      nodeIds.every(
        (id) =>
          id.startsWith('sen:') ||
          id.startsWith('tool:') ||
          id.startsWith('rev:') ||
          id.startsWith('qual:')
      )
    ).toBe(true);

    const stageWeight = (fromPrefix: string, toPrefix: string) =>
      graph.links
        .filter((l) => l.source.startsWith(fromPrefix) && l.target.startsWith(toPrefix))
        .reduce((acc, l) => acc + l.value, 0);

    expect(stageWeight('sen:', 'tool:')).toBe(26);
    expect(stageWeight('tool:', 'rev:')).toBe(26);
    expect(stageWeight('rev:', 'qual:')).toBe(26);

    // Every link strictly moves forward one stage (acyclic guarantee)
    expect(
      graph.links.every(
        (l) =>
          (l.source.startsWith('sen:') && l.target.startsWith('tool:')) ||
          (l.source.startsWith('tool:') && l.target.startsWith('rev:')) ||
          (l.source.startsWith('rev:') && l.target.startsWith('qual:'))
      )
    ).toBe(true);

    // Collapse > 6 tools into tool:Outras (noop) and unclassified tiers (noop)
    const manyToolRows = Array.from({ length: 8 }, (_, idx) =>
      makeSyntheticRow(idx + 1, {
        toolRaw: `Tool_${idx + 1}`,
        likert:
          idx === 0
            ? {
                ITEM_12: null,
                ITEM_13: null,
                ITEM_14: null,
              }
            : {},
        openRisk: `risco unico ${idx}`,
      })
    );
    const syntheticAnalysis = analyzeSurveyRows(manyToolRows);
    const manyGraph = buildSankeyData(syntheticAnalysis.cleaning.validRespondents, true);
    const outrasNode = manyGraph.nodes.find((n) => n.name === 'tool:Outras');
    const unclassNode = manyGraph.nodes.find((n) => n.name === 'qual:unclassified');
    expect(outrasNode?.count).toBe(3);
    expect(outrasNode?.clickTarget.kind).toBe('noop');
    expect(unclassNode?.count).toBe(1);
    expect(unclassNode?.clickTarget.kind).toBe('noop');

    const sankeyOpt = buildSankeyOption({ graph });
    expect(Array.isArray(sankeyOpt.series)).toBe(true);

    // Real CSV with normalizeTools=false has 7 distinct tools -> collapses to top 5 + Outras
    const unnormGraph = buildSankeyData(baseResult.cleaning.validRespondents, false);
    const unnormOutras = unnormGraph.nodes.find((n) => n.name === 'tool:Outras');
    expect(unnormOutras?.count).toBeGreaterThan(0);
    expect(unnormOutras?.clickTarget.kind).toBe('noop');
  });

  it('constrói gráfico Butterfly pareado de temas com séries esquerda/direita', () => {
    const butterflyOpt = buildPairedThemeButterflyOption({
      riskThemes: baseResult.baseline.openCoding.risks.themes,
      benefitThemes: baseResult.baseline.openCoding.benefits.themes,
      selectedRiskThemes: ['seguranca'],
      compact: true,
    });
    const series = butterflyOpt.series as Array<{ name: string; data: Array<{ value: number }> }>;
    expect(series).toHaveLength(2);
    expect(series[0].data.every((d) => d.value <= 0)).toBe(true);
    expect(series[1].data.every((d) => d.value >= 0)).toBe(true);
  });
});
