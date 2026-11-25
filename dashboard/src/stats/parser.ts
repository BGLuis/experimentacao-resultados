import Papa from 'papaparse';
import type {
  ItemId,
  ItemMetadata,
  LikertItemId,
  RawCsvRow,
  ReviewItemId,
  SeniorityLevel,
} from './types';

export const LIKERT_ITEM_IDS: LikertItemId[] = [
  'ITEM_08',
  'ITEM_09',
  'ITEM_10',
  'ITEM_11',
  'ITEM_12',
  'ITEM_13',
  'ITEM_14',
  'ITEM_15',
  'ITEM_16',
  'ITEM_17',
];

export const VELOCITY_ITEM_IDS: LikertItemId[] = [
  'ITEM_08',
  'ITEM_09',
  'ITEM_10',
  'ITEM_11',
];

export const QUALITY_ITEM_IDS: LikertItemId[] = [
  'ITEM_12',
  'ITEM_13',
  'ITEM_14',
  'ITEM_15',
  'ITEM_16',
  'ITEM_17',
];

export const REVIEW_ITEM_IDS: ReviewItemId[] = ['ITEM_19', 'ITEM_20'];

export const SENIORITY_ORDER: SeniorityLevel[] = ['Júnior', 'Pleno', 'Sênior'];

export const FREQUENCY_ORDER: string[] = [
  'Menos de 1 dia por semana',
  '1 a 3 dias por semana',
  '4 a 5 dias por semana',
  'Todos os dias úteis',
];

export const ITEM_METADATA: Record<ItemId, ItemMetadata> = {
  ITEM_01: {
    id: 'ITEM_01',
    shortLabel: 'Atuação remunerada',
    questionText:
      'Você atua profissionalmente (remunerado) em desenvolvimento de software?',
    construct: 'ELIGIBILITY',
    scaleType: 'nominal',
  },
  ITEM_02: {
    id: 'ITEM_02',
    shortLabel: 'Uso de IA (6 meses)',
    questionText: 'Usou ferramentas de IA para código nos últimos 6 meses?',
    construct: 'ELIGIBILITY',
    scaleType: 'nominal',
  },
  ITEM_03: {
    id: 'ITEM_03',
    shortLabel: 'Atuação no Brasil',
    questionText: 'Você atua profissionalmente no Brasil?',
    construct: 'ELIGIBILITY',
    scaleType: 'nominal',
  },
  ITEM_04: {
    id: 'ITEM_04',
    shortLabel: 'Aluno da disciplina',
    questionText:
      'Você está matriculado(a) na disciplina de Medição e Experimentação em Eng. de Software (turma deste estudo)?',
    construct: 'ELIGIBILITY',
    scaleType: 'nominal',
  },
  ITEM_05: {
    id: 'ITEM_05',
    shortLabel: 'Tempo de atuação (M_SEN)',
    questionText: 'Tempo de atuação em desenvolvimento de software:',
    construct: 'PROFILE',
    scaleType: 'nominal',
  },
  ITEM_06: {
    id: 'ITEM_06',
    shortLabel: 'Ferramenta principal (M_TOOL)',
    questionText: 'Qual ferramenta de IA você mais usa?',
    construct: 'PROFILE',
    scaleType: 'nominal',
  },
  ITEM_07: {
    id: 'ITEM_07',
    shortLabel: 'Frequência de uso (M_USO)',
    questionText: 'Com que frequência você usa IA no trabalho?',
    construct: 'PROFILE',
    scaleType: 'ordinal_frequency',
  },
  ITEM_08: {
    id: 'ITEM_08',
    shortLabel: 'C_VEL1 · Menos tempo p/ features',
    questionText:
      'O uso de IA reduz o tempo que gasto implementando novas funcionalidades.',
    construct: 'C_VEL',
    scaleType: 'likert',
  },
  ITEM_09: {
    id: 'ITEM_09',
    shortLabel: 'C_VEL2 · Depuração mais rápida',
    questionText: 'Consigo depurar bugs mais rapidamente com IA.',
    construct: 'C_VEL',
    scaleType: 'likert',
  },
  ITEM_10: {
    id: 'ITEM_10',
    shortLabel: 'C_VEL3 · Refatoração mais rápida',
    questionText: 'Consigo refatorar trechos de código mais rapidamente com IA.',
    construct: 'C_VEL',
    scaleType: 'likert',
  },
  ITEM_11: {
    id: 'ITEM_11',
    shortLabel: 'C_VEL4 · Maior volume de entregas',
    questionText:
      'O volume das minhas entregas aumentou depois que adotei IA.',
    construct: 'C_VEL',
    scaleType: 'likert',
  },
  ITEM_12: {
    id: 'ITEM_12',
    shortLabel: 'C_QUAL1 · Legibilidade e arquitetura',
    questionText:
      'O código gerado por IA atende aos padrões de legibilidade e arquitetura do meu time.',
    construct: 'C_QUAL',
    scaleType: 'likert',
  },
  ITEM_13: {
    id: 'ITEM_13',
    shortLabel: 'C_QUAL2 · Manutenibilidade',
    questionText:
      'O código escrito com apoio de IA é fácil de manter e evoluir.',
    construct: 'C_QUAL',
    scaleType: 'likert',
  },
  ITEM_14: {
    id: 'ITEM_14',
    shortLabel: 'C_QUAL3 · Menos defeitos',
    questionText:
      'O código escrito com apoio de IA tem menos defeitos do que o que eu escreveria sem IA.',
    construct: 'C_QUAL',
    scaleType: 'likert',
  },
  ITEM_15: {
    id: 'ITEM_15',
    shortLabel: 'C_QUAL4 · Testes unitários',
    questionText:
      'O assistente me ajuda a escrever testes unitários mais abrangentes.',
    construct: 'C_QUAL',
    scaleType: 'likert',
  },
  ITEM_16: {
    id: 'ITEM_16',
    shortLabel: 'C_QUAL5 · Falhas exigem correção (inv.)',
    questionText:
      'O código gerado por IA costuma conter falhas que exigem correção significativa da minha parte.',
    construct: 'C_QUAL',
    inverted: true,
    scaleType: 'likert',
  },
  ITEM_17: {
    id: 'ITEM_17',
    shortLabel: 'C_QUAL6 · Qualidade geral melhorou',
    questionText:
      'No geral, a qualidade do código que entrego melhorou com a IA.',
    construct: 'C_QUAL',
    scaleType: 'likert',
  },
  ITEM_18: {
    id: 'ITEM_18',
    shortLabel: 'Verificação de atenção',
    questionText:
      'Atenção: para confirmar que está lendo, assinale exatamente "Discordo Parcialmente".',
    construct: 'ATTENTION',
    scaleType: 'likert',
  },
  ITEM_19: {
    id: 'ITEM_19',
    shortLabel: 'M_REV1 · Revisão linha a linha',
    questionText:
      'Com que frequência você lê e revisa o código gerado por IA linha a linha antes de aprová-lo?',
    construct: 'M_REV',
    scaleType: 'review_frequency',
  },
  ITEM_20: {
    id: 'ITEM_20',
    shortLabel: 'M_REV2 · Execução de testes',
    questionText:
      'Com que frequência você executa testes sobre o código gerado por IA antes de aprová-lo?',
    construct: 'M_REV',
    scaleType: 'review_frequency',
  },
  ITEM_21: {
    id: 'ITEM_21',
    shortLabel: 'Principal risco (aberta)',
    questionText: 'Qual o principal risco que a IA trouxe ao seu trabalho/time?',
    construct: 'OPEN',
    scaleType: 'open',
  },
  ITEM_22: {
    id: 'ITEM_22',
    shortLabel: 'Principal benefício técnico (aberta)',
    questionText:
      'Qual o principal benefício técnico que a IA trouxe ao seu trabalho/time?',
    construct: 'OPEN',
    scaleType: 'open',
  },
};

export function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const LIKERT_MAP: Record<string, number> = {
  'discordo totalmente': 1,
  'discordo parcialmente': 2,
  neutro: 3,
  'concordo parcialmente': 4,
  'concordo totalmente': 5,
};

const FREQUENCY_REVIEW_MAP: Record<string, number> = {
  nunca: 1,
  raramente: 2,
  'as vezes': 3,
  frequentemente: 4,
  sempre: 5,
};

const KNOWN_TOOLS = ['Copilot', 'ChatGPT', 'Claude', 'Cursor', 'Gemini'];

export function normalizeToolName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const norm = normalizeText(trimmed);
  if (norm.includes('kiro')) return 'Kiro';
  if (norm.includes('copilot')) return 'Copilot';
  if (norm.includes('chatgpt') || norm === 'gpt') return 'ChatGPT';
  if (norm.includes('claude')) return 'Claude';
  if (norm.includes('cursor')) return 'Cursor';
  if (norm.includes('gemini')) return 'Gemini';
  return trimmed;
}

export function mapSeniority(raw: string): SeniorityLevel | null {
  const norm = normalizeText(raw);
  if (!norm) return null;
  if (norm.includes('menos de 1') || norm.includes('1 a 3')) {
    return 'Júnior';
  }
  if (norm.includes('3 a 6')) {
    return 'Pleno';
  }
  if (norm.includes('mais de 6')) {
    return 'Sênior';
  }
  if (norm === 'junior' || norm === 'jr') return 'Júnior';
  if (norm === 'pleno' || norm === 'pl') return 'Pleno';
  if (norm === 'senior' || norm === 'sr') return 'Sênior';
  return null;
}

export function mapUsageFrequencyCode(raw: string): 1 | 2 | 3 | 4 | null {
  const norm = normalizeText(raw);
  if (!norm) return null;
  if (norm.includes('menos de 1')) return 1;
  if (norm.includes('1 a 3')) return 2;
  if (norm.includes('4 a 5')) return 3;
  if (norm.includes('todos os dias')) return 4;
  return null;
}

export function parseLikertValue(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const norm = normalizeText(trimmed);
  if (norm === 'nao se aplica' || norm === 'na') return null;
  if (norm in LIKERT_MAP) return LIKERT_MAP[norm];
  const numeric = Number(trimmed);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 5) {
    return numeric;
  }
  return null;
}

export function parseReviewFrequencyValue(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const norm = normalizeText(trimmed);
  if (norm === 'nao se aplica' || norm === 'na') return null;
  if (norm in FREQUENCY_REVIEW_MAP) return FREQUENCY_REVIEW_MAP[norm];
  const numeric = Number(trimmed);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 5) {
    return numeric;
  }
  return null;
}

export function parseBrazilianTimestamp(raw: string): {
  date: Date | null;
  iso: string | null;
} {
  const trimmed = raw.trim();
  if (!trimmed) return { date: null, iso: null };

  const brMatch = trimmed.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (brMatch) {
    const day = Number(brMatch[1]);
    const month = Number(brMatch[2]);
    const year = Number(brMatch[3]);
    const hour = Number(brMatch[4] ?? 0);
    const minute = Number(brMatch[5] ?? 0);
    const second = Number(brMatch[6] ?? 0);
    const date = new Date(year, month - 1, day, hour, minute, second);
    if (!Number.isNaN(date.getTime())) {
      const pad = (n: number) => String(n).padStart(2, '0');
      const iso = `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}`;
      return { date, iso };
    }
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return { date: parsed, iso: parsed.toISOString() };
  }

  return { date: null, iso: null };
}

function parseDurationSeconds(raw: string | undefined): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  if (Number.isFinite(num) && num >= 0) return num;
  const mmss = trimmed.match(/^(\d+):(\d{2})$/);
  if (mmss) {
    return Number(mmss[1]) * 60 + Number(mmss[2]);
  }
  return null;
}

type ColumnKey =
  | 'timestamp'
  | 'duration'
  | 'consent'
  | ItemId;

const ITEM_MATCHERS: Array<{ key: ColumnKey; tokens: string[] }> = [
  { key: 'timestamp', tokens: ['carimbo de data hora', 'timestamp'] },
  { key: 'duration', tokens: ['duracao', 'duration', 'tempo total', 'tempo de resposta'] },
  { key: 'consent', tokens: ['termo de consentimento', 'consentimento'] },
  { key: 'ITEM_01', tokens: ['atua profissionalmente remunerado em desenvolvimento'] },
  { key: 'ITEM_02', tokens: ['usou ferramentas de ia para codigo nos ultimos 6 meses'] },
  { key: 'ITEM_03', tokens: ['atua profissionalmente no brasil'] },
  { key: 'ITEM_04', tokens: ['matriculado a na disciplina de medicao'] },
  { key: 'ITEM_05', tokens: ['tempo de atuacao em desenvolvimento'] },
  { key: 'ITEM_06', tokens: ['qual ferramenta de ia voce mais usa'] },
  { key: 'ITEM_07', tokens: ['com que frequencia voce usa ia no trabalho'] },
  { key: 'ITEM_08', tokens: ['reduz o tempo que gasto implementando'] },
  { key: 'ITEM_09', tokens: ['consigo depurar bugs mais rapidamente'] },
  { key: 'ITEM_10', tokens: ['consigo refatorar trechos de codigo mais rapidamente'] },
  { key: 'ITEM_11', tokens: ['volume das minhas entregas aumentou'] },
  { key: 'ITEM_12', tokens: ['padroes de legibilidade e arquitetura'] },
  { key: 'ITEM_13', tokens: ['facil de manter e evoluir'] },
  { key: 'ITEM_14', tokens: ['menos defeitos do que o que eu escreveria'] },
  { key: 'ITEM_15', tokens: ['escrever testes unitarios mais abrangentes'] },
  { key: 'ITEM_16', tokens: ['costuma conter falhas que exigem correcao'] },
  { key: 'ITEM_17', tokens: ['qualidade do codigo que entrego melhorou'] },
  { key: 'ITEM_18', tokens: ['atencao para confirmar que esta lendo'] },
  { key: 'ITEM_19', tokens: ['le e revisa o codigo gerado por ia linha a linha'] },
  { key: 'ITEM_20', tokens: ['executa testes sobre o codigo gerado por ia'] },
  { key: 'ITEM_21', tokens: ['principal risco que a ia trouxe'] },
  { key: 'ITEM_22', tokens: ['principal beneficio tecnico que a ia trouxe'] },
];

function resolveHeaderMapping(headers: string[]): Partial<Record<ColumnKey, string>> {
  const mapping: Partial<Record<ColumnKey, string>> = {};
  for (const header of headers) {
    const trimmed = header.trim();
    const norm = normalizeText(trimmed);
    const upper = trimmed.toUpperCase();

    if (/^ITEM_\d{2}$/.test(upper)) {
      mapping[upper as ItemId] = header;
      continue;
    }

    for (const matcher of ITEM_MATCHERS) {
      if (mapping[matcher.key]) continue;
      if (matcher.tokens.some((token) => norm.includes(token))) {
        mapping[matcher.key] = header;
        break;
      }
    }
  }
  return mapping;
}

export function parseSurveyCsv(csvText: string): RawCsvRow[] {
  const cleanedText = csvText.replace(/^\uFEFF/, '');
  const parsed = Papa.parse<Record<string, string>>(cleanedText, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => header.trim(),
  });

  const headers = parsed.meta.fields ?? [];
  const colMap = resolveHeaderMapping(headers);

  const getCell = (row: Record<string, string>, key: ColumnKey): string => {
    const colName = colMap[key];
    if (!colName) return '';
    return (row[colName] ?? '').trim();
  };

  return parsed.data.map((row, idx) => {
    const rowNumber = idx + 1;
    const idLabel = `R${String(rowNumber).padStart(2, '0')}`;
    const timestampRaw = getCell(row, 'timestamp');
    const { date: timestamp, iso: timestampIso } =
      parseBrazilianTimestamp(timestampRaw);

    const toolRaw = getCell(row, 'ITEM_06');
    const toolNormalized = normalizeToolName(toolRaw);
    const toolIsOther = Boolean(toolRaw) && !KNOWN_TOOLS.includes(toolRaw);

    const frequencyRaw = getCell(row, 'ITEM_07');
    const experienceRaw = getCell(row, 'ITEM_05');

    const likertRaw = {
      ITEM_08: getCell(row, 'ITEM_08'),
      ITEM_09: getCell(row, 'ITEM_09'),
      ITEM_10: getCell(row, 'ITEM_10'),
      ITEM_11: getCell(row, 'ITEM_11'),
      ITEM_12: getCell(row, 'ITEM_12'),
      ITEM_13: getCell(row, 'ITEM_13'),
      ITEM_14: getCell(row, 'ITEM_14'),
      ITEM_15: getCell(row, 'ITEM_15'),
      ITEM_16: getCell(row, 'ITEM_16'),
      ITEM_17: getCell(row, 'ITEM_17'),
      ITEM_18: getCell(row, 'ITEM_18'),
    };

    const likertNumeric = {
      ITEM_08: parseLikertValue(likertRaw.ITEM_08),
      ITEM_09: parseLikertValue(likertRaw.ITEM_09),
      ITEM_10: parseLikertValue(likertRaw.ITEM_10),
      ITEM_11: parseLikertValue(likertRaw.ITEM_11),
      ITEM_12: parseLikertValue(likertRaw.ITEM_12),
      ITEM_13: parseLikertValue(likertRaw.ITEM_13),
      ITEM_14: parseLikertValue(likertRaw.ITEM_14),
      ITEM_15: parseLikertValue(likertRaw.ITEM_15),
      ITEM_16: parseLikertValue(likertRaw.ITEM_16),
      ITEM_17: parseLikertValue(likertRaw.ITEM_17),
      ITEM_18: parseLikertValue(likertRaw.ITEM_18),
    };

    const reviewRaw = {
      ITEM_19: getCell(row, 'ITEM_19'),
      ITEM_20: getCell(row, 'ITEM_20'),
    };

    const reviewNumeric = {
      ITEM_19: parseReviewFrequencyValue(reviewRaw.ITEM_19),
      ITEM_20: parseReviewFrequencyValue(reviewRaw.ITEM_20),
    };

    const rawColumns: Record<string, string> = {};
    for (const key of Object.keys(row)) {
      rawColumns[key.trim()] = (row[key] ?? '').trim();
    }

    return {
      rowNumber,
      idLabel,
      timestampRaw,
      timestamp,
      timestampIso,
      durationSeconds: parseDurationSeconds(getCell(row, 'duration')),
      consent: getCell(row, 'consent'),
      eligibility: {
        item01: getCell(row, 'ITEM_01'),
        item02: getCell(row, 'ITEM_02'),
        item03: getCell(row, 'ITEM_03'),
        item04: getCell(row, 'ITEM_04'),
      },
      experienceRaw,
      seniority: mapSeniority(experienceRaw),
      toolRaw,
      toolNormalized,
      toolIsOther,
      frequencyRaw,
      frequencyCode: mapUsageFrequencyCode(frequencyRaw),
      likertRaw,
      likertNumeric,
      reviewRaw,
      reviewNumeric,
      openRisk: getCell(row, 'ITEM_21'),
      openBenefit: getCell(row, 'ITEM_22'),
      rawColumns,
    };
  });
}
