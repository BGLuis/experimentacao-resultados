import {
  LIKERT_ITEM_IDS,
  QUALITY_ITEM_IDS,
  REVIEW_ITEM_IDS,
  VELOCITY_ITEM_IDS,
  normalizeText,
} from './parser';
import type {
  CleaningSummary,
  CollectionPhase,
  ConstructScores,
  DiscardStage,
  FunnelDiscardedItem,
  FunnelStep,
  LikertItemId,
  RawCsvRow,
  RawRowAudit,
  ValidRespondent,
} from './types';

const PLANNED_END_MS = new Date(2026, 10, 22, 23, 59, 59).getTime();
const EXTENSION_END_MS = new Date(2026, 10, 24, 12, 0, 0).getTime();
const MIN_DURATION_SECONDS = 120;
const CONSTRUCT_COMPLETENESS_THRESHOLD = 0.75;

function isYes(value: string): boolean {
  return normalizeText(value) === 'sim';
}

function isNo(value: string): boolean {
  const norm = normalizeText(value);
  return norm === 'nao';
}

function checkEligibility(row: RawCsvRow): string | null {
  const failures: string[] = [];
  if (!isYes(row.eligibility.item01)) {
    failures.push(`ITEM_01="${row.eligibility.item01 || 'vazio'}" (≠ Sim)`);
  }
  if (!isYes(row.eligibility.item02)) {
    failures.push(`ITEM_02="${row.eligibility.item02 || 'vazio'}" (≠ Sim)`);
  }
  if (!isYes(row.eligibility.item03)) {
    failures.push(`ITEM_03="${row.eligibility.item03 || 'vazio'}" (≠ Sim)`);
  }
  if (!isNo(row.eligibility.item04)) {
    failures.push(`ITEM_04="${row.eligibility.item04 || 'vazio'}" (≠ Não — aluno da turma)`);
  }
  if (failures.length === 0) return null;
  return `Inelegível na triagem (${failures.join('; ')})`;
}

function checkAttention(row: RawCsvRow): string | null {
  const val = row.likertNumeric.ITEM_18;
  if (val === 2) return null;
  const raw = row.likertRaw.ITEM_18 || 'em branco';
  return `Falhou no controle de atenção ITEM_18: marcou "${raw}" (esperado: "Discordo Parcialmente")`;
}

function isStraightlining(row: RawCsvRow): boolean {
  const values = LIKERT_ITEM_IDS.map((id) => row.likertNumeric[id]).filter(
    (v): v is number => v !== null
  );
  if (values.length < 2) return false;
  const first = values[0];
  return values.every((v) => v === first);
}

function buildResponseVectorSignature(row: RawCsvRow): string {
  const parts: string[] = [
    normalizeText(row.eligibility.item01),
    normalizeText(row.eligibility.item02),
    normalizeText(row.eligibility.item03),
    normalizeText(row.eligibility.item04),
    normalizeText(row.experienceRaw),
    normalizeText(row.toolRaw),
    normalizeText(row.frequencyRaw),
    ...LIKERT_ITEM_IDS.map((id) => normalizeText(row.likertRaw[id])),
    normalizeText(row.likertRaw.ITEM_18),
    ...REVIEW_ITEM_IDS.map((id) => normalizeText(row.reviewRaw[id])),
    normalizeText(row.openRisk),
    normalizeText(row.openBenefit),
  ];
  return parts.join('|');
}

function meanWithThreshold(
  values: Array<number | null>,
  threshold = CONSTRUCT_COMPLETENESS_THRESHOLD
): { mean: number | null; answered: number } {
  const valid = values.filter((v): v is number => v !== null);
  const answered = valid.length;
  if (values.length === 0 || answered / values.length < threshold) {
    return { mean: null, answered };
  }
  const sum = valid.reduce((acc, v) => acc + v, 0);
  return { mean: sum / answered, answered };
}

export function computeConstructScores(
  row: RawCsvRow,
  invertItem16 = true
): {
  scores: ConstructScores;
  likertEffective: Record<LikertItemId, number | null>;
  answeredCounts: { C_VEL: number; C_QUAL: number; M_REV: number };
} {
  const item16Raw = row.likertNumeric.ITEM_16;
  const item16Inverted = item16Raw !== null ? 6 - item16Raw : null;

  const likertEffective: Record<LikertItemId, number | null> = {
    ITEM_08: row.likertNumeric.ITEM_08,
    ITEM_09: row.likertNumeric.ITEM_09,
    ITEM_10: row.likertNumeric.ITEM_10,
    ITEM_11: row.likertNumeric.ITEM_11,
    ITEM_12: row.likertNumeric.ITEM_12,
    ITEM_13: row.likertNumeric.ITEM_13,
    ITEM_14: row.likertNumeric.ITEM_14,
    ITEM_15: row.likertNumeric.ITEM_15,
    ITEM_16: invertItem16 ? item16Inverted : item16Raw,
    ITEM_17: row.likertNumeric.ITEM_17,
  };

  const velRes = meanWithThreshold(
    VELOCITY_ITEM_IDS.map((id) => row.likertNumeric[id])
  );

  const qualInvertedValues = QUALITY_ITEM_IDS.map((id) =>
    id === 'ITEM_16' ? item16Inverted : row.likertNumeric[id]
  );
  const qualRes = meanWithThreshold(qualInvertedValues);

  const qualRawValues = QUALITY_ITEM_IDS.map((id) => row.likertNumeric[id]);
  const qualRawRes = meanWithThreshold(qualRawValues);

  const qualNo16Res = meanWithThreshold(
    QUALITY_ITEM_IDS.filter((id) => id !== 'ITEM_16').map(
      (id) => row.likertNumeric[id]
    )
  );

  const qualNo17Res = meanWithThreshold(
    QUALITY_ITEM_IDS.filter((id) => id !== 'ITEM_17').map((id) =>
      id === 'ITEM_16' ? item16Inverted : row.likertNumeric[id]
    )
  );

  const revRes = meanWithThreshold(
    REVIEW_ITEM_IDS.map((id) => row.reviewNumeric[id])
  );

  return {
    scores: {
      C_VEL: velRes.mean,
      C_QUAL: qualRes.mean,
      C_QUAL_raw16: qualRawRes.mean,
      C_QUAL_no16: qualNo16Res.mean,
      C_QUAL_no17: qualNo17Res.mean,
      M_REV: revRes.mean,
      item16Raw,
      item16Inverted,
    },
    likertEffective,
    answeredCounts: {
      C_VEL: velRes.answered,
      C_QUAL: qualRes.answered,
      M_REV: revRes.answered,
    },
  };
}

function classifyCollectionPhase(timestamp: Date | null): {
  collectionPhase: CollectionPhase;
  isPostPlannedWindow: boolean;
  isPostExtension: boolean;
} {
  if (!timestamp) {
    return {
      collectionPhase: 'planned',
      isPostPlannedWindow: false,
      isPostExtension: false,
    };
  }
  const ms = timestamp.getTime();
  if (ms > EXTENSION_END_MS) {
    return {
      collectionPhase: 'post_extension',
      isPostPlannedWindow: true,
      isPostExtension: true,
    };
  }
  if (ms > PLANNED_END_MS) {
    return {
      collectionPhase: 'extended',
      isPostPlannedWindow: true,
      isPostExtension: false,
    };
  }
  return {
    collectionPhase: 'planned',
    isPostPlannedWindow: false,
    isPostExtension: false,
  };
}

export function cleanSurveyRows(rawRows: RawCsvRow[]): CleaningSummary {
  const durationCheckAvailable = rawRows.some(
    (r) => r.durationSeconds !== null
  );

  const stageMap = new Map<
    number,
    { stage: DiscardStage; reason: string }
  >();
  const stageDiscards: Record<DiscardStage, FunnelDiscardedItem[]> = {
    eligibility: [],
    attention: [],
    duration: [],
    straightlining: [],
    duplicate: [],
  };

  // Stage 0: Eligibility (ITEM_01..03 == Sim && ITEM_04 == Não)
  const eligibleRows: RawCsvRow[] = [];
  for (const row of rawRows) {
    const reason = checkEligibility(row);
    if (reason) {
      stageMap.set(row.rowNumber, { stage: 'eligibility', reason });
      stageDiscards.eligibility.push({
        rowNumber: row.rowNumber,
        idLabel: row.idLabel,
        timestampRaw: row.timestampRaw,
        reason,
      });
    } else {
      eligibleRows.push(row);
    }
  }

  // Stage 1: Attention check (ITEM_18 == 2)
  const afterAttention: RawCsvRow[] = [];
  for (const row of eligibleRows) {
    const reason = checkAttention(row);
    if (reason) {
      stageMap.set(row.rowNumber, { stage: 'attention', reason });
      stageDiscards.attention.push({
        rowNumber: row.rowNumber,
        idLabel: row.idLabel,
        timestampRaw: row.timestampRaw,
        reason,
      });
    } else {
      afterAttention.push(row);
    }
  }

  // Stage 2: Duration < 120s (when duration column exists)
  const afterDuration: RawCsvRow[] = [];
  for (const row of afterAttention) {
    if (
      durationCheckAvailable &&
      row.durationSeconds !== null &&
      row.durationSeconds < MIN_DURATION_SECONDS
    ) {
      const reason = `Tempo total ${row.durationSeconds}s < ${MIN_DURATION_SECONDS}s (limiar mínimo)`;
      stageMap.set(row.rowNumber, { stage: 'duration', reason });
      stageDiscards.duration.push({
        rowNumber: row.rowNumber,
        idLabel: row.idLabel,
        timestampRaw: row.timestampRaw,
        reason,
      });
    } else {
      afterDuration.push(row);
    }
  }

  // Stage 3: Straightlining (SD == 0 across raw ITEM_08..17)
  const afterStraightlining: RawCsvRow[] = [];
  for (const row of afterDuration) {
    if (isStraightlining(row)) {
      const reason =
        'Resposta uniforme (straightlining: DP = 0 nos itens Likert ITEM_08–17 brutos)';
      stageMap.set(row.rowNumber, { stage: 'straightlining', reason });
      stageDiscards.straightlining.push({
        rowNumber: row.rowNumber,
        idLabel: row.idLabel,
        timestampRaw: row.timestampRaw,
        reason,
      });
    } else {
      afterStraightlining.push(row);
    }
  }

  // Stage 4: Exact duplicates (identical ITEM_01..22 vector)
  const seenSignatures = new Map<string, string>();
  const afterDuplicates: RawCsvRow[] = [];
  for (const row of afterStraightlining) {
    const sig = buildResponseVectorSignature(row);
    const firstId = seenSignatures.get(sig);
    if (firstId) {
      const reason = `Duplicata exata: vetor ITEM_01–22 idêntico ao de ${firstId}`;
      stageMap.set(row.rowNumber, { stage: 'duplicate', reason });
      stageDiscards.duplicate.push({
        rowNumber: row.rowNumber,
        idLabel: row.idLabel,
        timestampRaw: row.timestampRaw,
        reason,
      });
    } else {
      seenSignatures.set(sig, row.idLabel);
      afterDuplicates.push(row);
    }
  }

  const validByRow = new Map<number, ValidRespondent>();
  const validRespondents: ValidRespondent[] = [];

  for (const row of afterDuplicates) {
    const { scores, likertEffective, answeredCounts } = computeConstructScores(
      row,
      true
    );
    const phaseInfo = classifyCollectionPhase(row.timestamp);
    const valid: ValidRespondent = {
      ...row,
      scores,
      likertEffective,
      answeredCounts,
      ...phaseInfo,
    };
    validByRow.set(row.rowNumber, valid);
    validRespondents.push(valid);
  }

  const audits: RawRowAudit[] = rawRows.map((row) => {
    const discard = stageMap.get(row.rowNumber);
    const valid = validByRow.get(row.rowNumber) ?? null;
    return {
      rowNumber: row.rowNumber,
      idLabel: row.idLabel,
      timestampRaw: row.timestampRaw,
      timestampIso: row.timestampIso,
      status: discard ? 'discarded' : 'valid',
      discardStage: discard?.stage ?? null,
      discardReason: discard?.reason ?? null,
      seniority: row.seniority,
      toolRaw: row.toolRaw,
      toolNormalized: row.toolNormalized,
      frequencyRaw: row.frequencyRaw,
      scores: valid ? valid.scores : null,
      raw: row,
      validRespondent: valid,
    };
  });

  const totalRaw = rawRows.length;
  const totalEligible = eligibleRows.length;
  const totalAfterAttention = afterAttention.length;
  const totalAfterDuration = afterDuration.length;
  const totalAfterStraightlining = afterStraightlining.length;
  const totalAfterDuplicates = afterDuplicates.length;
  const totalValid = validRespondents.length;

  const funnel: FunnelStep[] = [
    {
      stage: 'raw',
      label: 'Respostas Brutas (CSV)',
      description: 'Total de registros exportados do Google Forms',
      inputCount: totalRaw,
      discardedCount: 0,
      remainingCount: totalRaw,
      discardedRows: [],
      available: true,
    },
    {
      stage: 'eligibility',
      label: 'Etapa 0 · Elegibilidade (ITEM_01–04)',
      description: 'Atuação remunerada no Brasil, uso de IA nos últimos 6 meses e fora da turma',
      inputCount: totalRaw,
      discardedCount: stageDiscards.eligibility.length,
      remainingCount: totalEligible,
      discardedRows: stageDiscards.eligibility,
      available: true,
      note: 'Skip logic do Google Forms redirecionou para página de agradecimento com envio (SUBMIT), gravando respostas inelegíveis.',
    },
    {
      stage: 'attention',
      label: 'Etapa 1 · Controle de Atenção (ITEM_18 = 2)',
      description: 'Exige exatamente "Discordo Parcialmente" no item de verificação',
      inputCount: totalEligible,
      discardedCount: stageDiscards.attention.length,
      remainingCount: totalAfterAttention,
      discardedRows: stageDiscards.attention,
      available: true,
    },
    {
      stage: 'duration',
      label: 'Etapa 2 · Tempo Mínimo (< 120s)',
      description: 'Descarta preenchimentos ultrarrápidos (< 5s/item)',
      inputCount: totalAfterAttention,
      discardedCount: stageDiscards.duration.length,
      remainingCount: totalAfterDuration,
      discardedRows: stageDiscards.duration,
      available: durationCheckAvailable,
      note: durationCheckAvailable
        ? undefined
        : 'N/A — Google Forms nativo registra apenas o carimbo de envio sem log de início (limitação prevista na Seção 5.1).',
    },
    {
      stage: 'straightlining',
      label: 'Etapa 3 · Straightlining (DP = 0)',
      description: 'Desvio-padrão zero nos 10 itens Likert brutos (ITEM_08–17)',
      inputCount: totalAfterDuration,
      discardedCount: stageDiscards.straightlining.length,
      remainingCount: totalAfterStraightlining,
      discardedRows: stageDiscards.straightlining,
      available: true,
    },
    {
      stage: 'duplicate',
      label: 'Etapa 4 · Duplicatas Exatas',
      description: 'Vetores completos idênticos em ITEM_01–22',
      inputCount: totalAfterStraightlining,
      discardedCount: stageDiscards.duplicate.length,
      remainingCount: totalAfterDuplicates,
      discardedRows: stageDiscards.duplicate,
      available: true,
    },
    {
      stage: 'valid',
      label: 'Amostra Válida Final (n)',
      description: 'Aprovada para análise estatística (Etapas 5–6: N/A pairwise e inversão ITEM_16)',
      inputCount: totalAfterDuplicates,
      discardedCount: 0,
      remainingCount: totalValid,
      discardedRows: [],
      available: true,
    },
  ];

  return {
    totalRaw,
    totalEligible,
    totalAfterAttention,
    totalAfterDuration,
    totalAfterStraightlining,
    totalAfterDuplicates,
    totalValid,
    durationCheckAvailable,
    funnel,
    audits,
    validRespondents,
  };
}
