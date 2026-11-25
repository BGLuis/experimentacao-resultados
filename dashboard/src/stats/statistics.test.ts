import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  analyzeSurveyCsv,
  analyzeSurveyRows,
  parseSurveyCsv,
} from './index';
import type { RawCsvRow } from './types';

const REAL_CSV_PATH = resolve(process.cwd(), '../questions.csv');
const realCsvText = readFileSync(REAL_CSV_PATH, 'utf-8');

function makeSyntheticRow(
  rowNumber: number,
  overrides: Partial<{
    timestampRaw: string;
    item01: string;
    item02: string;
    item03: string;
    item04: string;
    experienceRaw: string;
    toolRaw: string;
    frequencyRaw: string;
    likert: Partial<Record<
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
    >>;
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
    timestampRaw: overrides.timestampRaw ?? '20/11/2026 10:00:00',
    timestamp: new Date(2026, 10, 20, 10, 0, 0),
    timestampIso: '2026-11-20T10:00:00',
    durationSeconds: null,
    consent: 'Declaro ter 18 anos ou mais e concordo em participar.',
    eligibility: {
      item01: overrides.item01 ?? 'Sim',
      item02: overrides.item02 ?? 'Sim',
      item03: overrides.item03 ?? 'Sim',
      item04: overrides.item04 ?? 'Não',
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

describe('Motor estatístico — baseline real (questions.csv)', () => {
  const result = analyzeSurveyCsv(realCsvText);

  it('executa o funil de limpeza na ordem exata e atinge os totais do protocolo', () => {
    expect(result.cleaning.totalRaw).toBe(33);
    expect(result.cleaning.totalEligible).toBe(29);
    expect(result.cleaning.totalAfterAttention).toBe(26);
    expect(result.cleaning.totalAfterDuration).toBe(26);
    expect(result.cleaning.totalAfterStraightlining).toBe(26);
    expect(result.cleaning.totalAfterDuplicates).toBe(26);
    expect(result.cleaning.totalValid).toBe(26);
    expect(result.cleaning.durationCheckAvailable).toBe(false);
    expect(result.baseline.marginOfErrorPct).toBeCloseTo(19.22, 2);

    const postExtensionCount = result.cleaning.validRespondents.filter(
      (r) => r.isPostExtension
    ).length;
    expect(postExtensionCount).toBe(14);
  });

  it('normaliza kiro aws para Kiro por padrão e preserva toolRaw', () => {
    const kiroNorm = result.filtered.toolProfile.find(
      (t) => t.label === 'Kiro'
    );
    expect(kiroNorm?.count).toBe(9);

    const unnormalized = analyzeSurveyCsv(realCsvText, {
      normalizeTools: false,
    });
    const kiroAws = unnormalized.filtered.toolProfile.find(
      (t) => t.label === 'kiro aws'
    );
    expect(kiroAws?.count).toBe(2);
  });

  it('calcula confiabilidade (Cronbach alpha e Spearman M_REV) alinhada ao SciPy', () => {
    const { cVel, cQual, mRev, anyFallbackActive } = result.baseline.reliability;
    expect(cVel.alpha).toBeCloseTo(0.708, 3);
    expect(cVel.passedThreshold).toBe(true);
    expect(cQual.alpha).toBeCloseTo(0.786, 3);
    expect(cQual.passedThreshold).toBe(true);
    expect(mRev.rho).toBeCloseTo(0.612, 3);
    expect(mRev.pValue).toBeCloseTo(0.0009, 4);
    expect(mRev.passedThreshold).toBe(true);
    expect(anyFallbackActive).toBe(false);
  });

  it('calcula descritivas de QP1 e QP2 (medianas e % concordância)', () => {
    expect(result.filtered.cVelStats.median).toBeCloseTo(5.0, 2);
    expect(result.filtered.cVelStats.agreementPct).toBeCloseTo(96.15, 1);

    expect(result.filtered.cQualStats.median).toBeCloseTo(4.0, 2);
    expect(result.filtered.cQualStats.agreementPct).toBeCloseTo(53.85, 1);

    const item13 = result.filtered.likertItems.find((i) => i.id === 'ITEM_13');
    expect(item13?.median).toBeCloseTo(3.5, 2);
    expect(item13?.agreementPct).toBeCloseTo(50.0, 1);
  });

  it('executa QP3 com fusão Jr+Pl (12) vs Sr (14), Mann-Whitney e Kruskal-Wallis', () => {
    const qp3 = result.baseline.qp3;
    expect(qp3.groupCounts).toEqual({ Júnior: 6, Pleno: 6, Sênior: 14 });
    expect(qp3.mergeApplied).toBe(true);
    expect(qp3.primaryMethod).toBe('mann_whitney_merged');

    expect(qp3.cVelMannWhitneyMerged?.u).toBeCloseTo(65.5, 1);
    expect(qp3.cVelMannWhitneyMerged?.pValue).toBeCloseTo(0.2551, 3);

    expect(qp3.cQualMannWhitneyMerged?.u).toBeCloseTo(85.5, 1);
    expect(qp3.cQualMannWhitneyMerged?.pValue).toBeCloseTo(0.9586, 3);

    expect(qp3.cVelKruskalWallis.h).toBeCloseTo(1.954, 2);
    expect(qp3.cQualKruskalWallis.h).toBeCloseTo(0.503, 2);
  });

  it('executa QP4 (Spearman principal + sensibilidades + parcial)', () => {
    const qp4 = result.baseline.qp4;
    expect(qp4.main.rho).toBeCloseTo(-0.348, 3);
    expect(qp4.main.pValue).toBeCloseTo(0.0813, 3);

    const no16 = qp4.sensitivity.find((s) => s.key === 'no_item16');
    const no17 = qp4.sensitivity.find((s) => s.key === 'no_item17');
    const partial = qp4.sensitivity.find((s) => s.key === 'partial_sen_uso');
    expect(no16?.rho).toBeCloseTo(-0.308, 2);
    expect(no17?.rho).toBeCloseTo(-0.341, 2);
    expect(partial?.rho).toBeCloseTo(-0.295, 2);
  });

  it('executa exploratória pareada C_VEL vs C_QUAL (26/26, W=0)', () => {
    const paired = result.baseline.exploratory.pairedVelVsQual;
    expect(paired.n).toBe(26);
    expect(paired.velGreaterCount).toBe(26);
    expect(paired.qualGreaterCount).toBe(0);
    expect(paired.tieCount).toBe(0);
    expect(paired.wilcoxonW).toBe(0);
    expect(paired.pValue).toBeLessThan(0.001);
  });

  it('mantém baseline confirmatório imutável quando filtros são aplicados', () => {
    const filtered = analyzeSurveyCsv(realCsvText, {
      seniorities: ['Júnior'],
    });
    expect(filtered.filtered.validCount).toBe(6);
    expect(filtered.baseline.validCount).toBe(26);
    expect(filtered.baseline.qp4.main.rho).toBeCloseTo(
      result.baseline.qp4.main.rho ?? 0,
      6
    );
  });

  it('codifica respostas abertas em ITEM_21 e ITEM_22 sem inventar Kappa', () => {
    const open = result.baseline.openCoding;
    expect(open.risks.substantiveCount).toBe(23);
    expect(open.risks.noiseOrBlankCount).toBe(3);
    expect(open.benefits.substantiveCount).toBe(23);
    expect(open.cohenKappaNote).toContain('pendente');
  });
});

describe('Motor estatístico — testes sintéticos de borda e regras do protocolo', () => {
  it('descarta straightlining (DP=0 nos ITEM_08..17 brutos) e duplicatas exatas', () => {
    const normalRow = makeSyntheticRow(1);
    const straightRow = makeSyntheticRow(2, {
      likert: {
        ITEM_08: 4,
        ITEM_09: 4,
        ITEM_10: 4,
        ITEM_11: 4,
        ITEM_12: 4,
        ITEM_13: 4,
        ITEM_14: 4,
        ITEM_15: 4,
        ITEM_16: 4,
        ITEM_17: 4,
        ITEM_18: 2,
      },
    });
    const dupRow = makeSyntheticRow(3); // exact duplicate of row 1

    const res = analyzeSurveyRows([normalRow, straightRow, dupRow]);
    expect(res.cleaning.totalRaw).toBe(3);
    expect(res.cleaning.totalAfterStraightlining).toBe(2);
    expect(res.cleaning.totalValid).toBe(1);
    expect(res.cleaning.audits[1].discardStage).toBe('straightlining');
    expect(res.cleaning.audits[2].discardStage).toBe('duplicate');
  });

  it('aplica regra >= 75% para "Não se aplica" (pairwise sem imputação)', () => {
    // C_VEL has 4 items: 3/4 = 75% (valid), 2/4 = 50% (null)
    // C_QUAL has 6 items: 5/6 = 83.3% (valid), 4/6 = 66.7% (null)
    const row75 = makeSyntheticRow(1, {
      likert: {
        ITEM_08: 5,
        ITEM_09: 4,
        ITEM_10: 3,
        ITEM_11: null, // 3/4 = 75%
        ITEM_12: 4,
        ITEM_13: 4,
        ITEM_14: 4,
        ITEM_15: 4,
        ITEM_16: 2, // inverted = 4
        ITEM_17: null, // 5/6 = 83.3%
      },
    });
    const rowBelow75 = makeSyntheticRow(2, {
      likert: {
        ITEM_08: 5,
        ITEM_09: 4,
        ITEM_10: null,
        ITEM_11: null, // 2/4 = 50% -> null
        ITEM_12: 5,
        ITEM_13: 5,
        ITEM_14: 5,
        ITEM_15: 3,
        ITEM_16: null,
        ITEM_17: null, // 4/6 = 66.7% -> null
      },
    });

    const res = analyzeSurveyRows([row75, rowBelow75]);
    const valid = res.cleaning.validRespondents;
    expect(valid).toHaveLength(2);
    expect(valid[0].scores.C_VEL).toBeCloseTo(4.0, 4);
    expect(valid[0].scores.C_QUAL).toBeCloseTo(4.0, 4);
    expect(valid[1].scores.C_VEL).toBeNull();
    expect(valid[1].scores.C_QUAL).toBeNull();
  });

  it('executa contingência M_TOOL x M_SEN (Fisher Monte Carlo no dataset real e chi2 quando esperadas >= 5)', () => {
    const res = analyzeSurveyCsv(realCsvText);
    const cont = res.baseline.exploratory.toolBySeniority;
    expect(cont.methodUsed).toBe('fisher_monte_carlo');
    expect(cont.total).toBe(26);
    expect(cont.pValue).not.toBeNull();
    expect(cont.pValue!).toBeGreaterThanOrEqual(0);
    expect(cont.pValue!).toBeLessThanOrEqual(1);

    // Synthetic dataset with 2 tools x 3 seniorities and >= 5 expected per cell
    const bigRows: RawCsvRow[] = [];
    let rn = 1;
    for (const sen of ['1 a 3 anos', 'Mais de 3 a 6 anos', 'Mais de 6 anos']) {
      for (const tool of ['Kiro', 'Copilot']) {
        for (let k = 0; k < 6; k++) {
          bigRows.push(
            makeSyntheticRow(rn++, {
              experienceRaw: sen,
              toolRaw: tool,
              openRisk: `risco ${rn}`,
            })
          );
        }
      }
    }
    const bigRes = analyzeSurveyRows(bigRows);
    expect(bigRes.baseline.exploratory.toolBySeniority.methodUsed).toBe('chi2');
    expect(bigRes.baseline.exploratory.toolBySeniority.minExpected).toBeGreaterThanOrEqual(5);
  });

  it('aciona fallback da Seção 5.2 quando alpha < 0.70', () => {
    // Low/negative inter-item consistency across C_VEL items
    const rows: RawCsvRow[] = Array.from({ length: 12 }, (_, idx) =>
      makeSyntheticRow(idx + 1, {
        likert: {
          ITEM_08: idx % 2 === 0 ? 5 : 1,
          ITEM_09: idx % 2 === 0 ? 1 : 5,
          ITEM_10: idx % 3 === 0 ? 5 : 2,
          ITEM_11: idx % 3 === 0 ? 1 : 4,
        },
        review: {
          ITEM_19: idx % 2 === 0 ? 5 : 1,
          ITEM_20: idx % 2 === 0 ? 1 : 5,
        },
      })
    );

    const res = analyzeSurveyRows(rows);
    expect(res.baseline.reliability.cVel.passedThreshold).toBe(false);
    expect(res.baseline.reliability.cVel.fallbackAction).toBe(
      'item_by_item_bonferroni'
    );
    expect(res.baseline.reliability.mRev.passedThreshold).toBe(false);
    expect(res.baseline.reliability.anyFallbackActive).toBe(true);
  });

  it('executa Kruskal-Wallis + Dunn post-hoc quando todos os grupos têm n >= 8', () => {
    const rows: RawCsvRow[] = [];
    let rowNum = 1;
    // Júnior (8): lower C_VEL
    for (let i = 0; i < 8; i++) {
      rows.push(
        makeSyntheticRow(rowNum++, {
          experienceRaw: '1 a 3 anos',
          likert: {
            ITEM_08: 2,
            ITEM_09: 2 + (i % 2),
            ITEM_10: 2,
            ITEM_11: 2,
          },
          openRisk: `risco jr ${i}`,
        })
      );
    }
    // Pleno (8): medium C_VEL
    for (let i = 0; i < 8; i++) {
      rows.push(
        makeSyntheticRow(rowNum++, {
          experienceRaw: 'Mais de 3 a 6 anos',
          likert: {
            ITEM_08: 3,
            ITEM_09: 3 + (i % 2),
            ITEM_10: 4,
            ITEM_11: 3,
          },
          openRisk: `risco pl ${i}`,
        })
      );
    }
    // Sênior (8): high C_VEL
    for (let i = 0; i < 8; i++) {
      rows.push(
        makeSyntheticRow(rowNum++, {
          experienceRaw: 'Mais de 6 anos',
          likert: {
            ITEM_08: 5,
            ITEM_09: 5 - (i % 2),
            ITEM_10: 5,
            ITEM_11: 5,
          },
          openRisk: `risco sr ${i}`,
        })
      );
    }

    const res = analyzeSurveyRows(rows);
    const qp3 = res.baseline.qp3;
    expect(qp3.mergeApplied).toBe(false);
    expect(qp3.primaryMethod).toBe('kruskal_wallis');
    expect(qp3.cVelKruskalWallis.significant).toBe(true);
    expect(qp3.cVelKruskalWallis.pValue).toBeLessThan(0.025);
    expect(qp3.cVelKruskalWallis.dunnPostHoc).toHaveLength(3);
    const jrVsSr = qp3.cVelKruskalWallis.dunnPostHoc.find(
      (d) => d.pair === 'Júnior vs Sênior'
    );
    expect(jrVsSr?.significant).toBe(true);
  });

  it('mantém compatibilidade de mapeamento quando colunas Likert estão fora de ordem', () => {
    const parsed = parseSurveyCsv(realCsvText);
    expect(parsed).toHaveLength(33);
    // Row 2 in CSV (R02): ITEM_12 = Concordo Parcialmente (4), ITEM_09 = Concordo Totalmente (5)
    expect(parsed[1].likertNumeric.ITEM_12).toBe(4);
    expect(parsed[1].likertNumeric.ITEM_09).toBe(5);
  });
});
