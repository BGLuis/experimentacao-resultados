import { normalizeText } from './parser';
import type {
  CodebookCategory,
  CodedResponse,
  OpenCodingQuestionSummary,
  OpenCodingSummary,
  ThemeCount,
  ValidRespondent,
} from './types';

export const RISK_CODEBOOK: CodebookCategory[] = [
  {
    id: 'bugs_alucinacoes',
    type: 'risk',
    label: 'Bugs, Alucinações e Casos de Borda',
    description:
      'Introdução silenciosa de falhas técnicas, alucinações por contexto amplo, ausência de testes ou omissão de edge cases e regras de negócio.',
    keywords: [
      'bug',
      'falha tecnica',
      'falhas tecnicas',
      'alucinac',
      'edge case',
      'casos de borda',
      'nuance',
      'contexto',
      'debito tecnico',
      'debitos tecnicos',
      'performance',
      'nao testado',
      'sem testes',
      'fora do padrao',
      'verboso',
    ],
    examples: [
      'inclusao de bugs e alucinacoes por falta de contexto',
      'Faltas de cobertura de edge-cases e nuances conhecidas',
    ],
  },
  {
    id: 'seguranca',
    type: 'risk',
    label: 'Vulnerabilidades de Segurança',
    description:
      'Riscos de exposição a falhas de segurança e vulnerabilidades em produção no código sugerido.',
    keywords: ['seguranca', 'vulnerabilidade'],
    examples: [
      'ricos de seguranca com vulnerabilidades',
      'vulnerabilidades de seguranca e dependencia exagerada',
    ],
  },
  {
    id: 'pressao_burnout',
    type: 'risk',
    label: 'Pressão por Prazos, Gestão e Burnout',
    description:
      'Expectativas irreais de prazo por gestão/produto levando à sobrecarga, pressão ou risco de burnout.',
    keywords: [
      'pressao',
      'prazo',
      'burnout',
      'depressao',
      'ansiedade',
      'desemprego',
      'gestao',
      'produto',
      '1 hora',
    ],
    examples: [
      'prazos irreais cobrados pela gestao, burnout e vulnerabilidades em producao',
      'pressao do time de produto achando que tudo agora leva 1 hora',
    ],
  },
  {
    id: 'revisao_sobrecarga',
    type: 'risk',
    label: 'Sobrecarga em Code Review e PRs Grandes',
    description:
      'Pull requests maiores, desgaste na revisão de código e dificuldade de validação sem supervisão prévia.',
    keywords: [
      'code review',
      'revisa',
      'pr gigante',
      'prs gigantes',
      'desgaste',
      'dificeis de validar',
      'supervisao',
    ],
    examples: [
      'Code reviews mais pesados e dificeis de validar quando o dev nao revisa antes',
      'Codigo indo pra producao sem testes adequados e PRs gigantes',
    ],
  },
  {
    id: 'dependencia_conhecimento',
    type: 'risk',
    label: 'Dependência Cognitiva e Perda de Domínio',
    description:
      'Aceitação acrítica do código gerado, perda de compreensão do domínio e dependência excessiva da ferramenta.',
    keywords: [
      'perda de conhecimento',
      'dependencia',
      'entender',
      'copiar codigo',
      'falsa sensacao de confianca',
      'autocomplete',
    ],
    examples: [
      'Perda de conhecimento do dominio pelos devs que so aceitam o autocomplete',
      'copiar codigo sem entender direito como funciona por baixo dos panos',
    ],
  },
];

export const BENEFIT_CODEBOOK: CodebookCategory[] = [
  {
    id: 'velocidade_produtividade',
    type: 'benefit',
    label: 'Velocidade e Produtividade Geral',
    description:
      'Aceleração na entrega de funcionalidades, redução de tempo de desenvolvimento e maior vazão.',
    keywords: [
      'produtividade',
      'velocidade',
      'rapidez',
      'rapido',
      'rapida',
      'agil',
      'aceleracao',
      'implementacao',
      'feature',
      'dias ao inves de semanas',
      'meses',
      'ganho de tempo',
    ],
    examples: [
      'implementacao de features complexas em dias ao inves de semanas',
      'Maior produtividade e implementaçao de soluções que antes demandariam meses',
    ],
  },
  {
    id: 'prototipacao_discovery',
    type: 'benefit',
    label: 'Prototipação Rápida, POCs e Discovery',
    description:
      'Validação ágil de provas de conceito, discoveries de produto e criação rápida de estruturas iniciais.',
    keywords: [
      'prototip',
      'discover',
      'poc',
      'estruturas iniciais',
      'validacao',
    ],
    examples: [
      'prototipação e discoveries muito mais rápidos',
      'discovery e validacao de POCs muito mais ageis',
    ],
  },
  {
    id: 'boilerplate_repetitivo',
    type: 'benefit',
    label: 'Redução de Boilerplate e Tarefas Mecânicas',
    description:
      'Automação de código repetitivo, configurações, consultas SQL e documentação técnica.',
    keywords: [
      'boilerplate',
      'repetitiv',
      'mecanica',
      'config',
      'sql',
      'documentacao',
      'checks sintomaticos',
    ],
    examples: [
      'Aumento da produtividade em tarefas repetitivas (atualização de configs...)',
      'Menos tempo gasto em tarefas mecanicas e atualizacao de configs',
    ],
  },
  {
    id: 'debug_investigacao',
    type: 'benefit',
    label: 'Depuração, Investigação e Aprendizado',
    description:
      'Apoio para investigar erros, destravar bugs, compreender código legado/de terceiros e acelerar aprendizado.',
    keywords: [
      'debug',
      'debbug',
      'investigacao',
      'destravar bugs',
      'entender codigo',
      'aprender',
      'erros',
    ],
    examples: [
      'velocidade e debbug',
      'aprender mais rapido e destravar bugs que antes levavam horas',
    ],
  },
  {
    id: 'testes_refatoracao',
    type: 'benefit',
    label: 'Escrita de Testes e Refatoração',
    description:
      'Apoio na criação de testes unitários/automatizados, mocks e refatoração de código legado.',
    keywords: ['teste', 'mock', 'refatorac'],
    examples: [
      'Agilidade na refatoracao de codigo legado e criacao de mocks',
      'Produtividade muito maior na escrita de testes e refatoracoes',
    ],
  },
];

const NOISE_PATTERNS = new Set([
  '',
  'na',
  'n a',
  'nao se aplica',
  'nenhum',
  'nenhuma',
  'nada',
  'teste',
  'test',
  'asdasd',
  'asdf',
  '-',
]);

function detectNoiseOrBlank(rawText: string): {
  isNoise: boolean;
  reason: string | null;
} {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { isNoise: true, reason: 'Em branco (campo opcional)' };
  }
  const norm = normalizeText(trimmed);
  if (NOISE_PATTERNS.has(norm) || norm.length <= 2) {
    return {
      isNoise: true,
      reason: `Texto não substantivo ("${trimmed}")`,
    };
  }
  return { isNoise: false, reason: null };
}

function classifyWithCodebook(
  rawText: string,
  codebook: CodebookCategory[]
): { themes: string[]; themeLabels: string[] } {
  const norm = normalizeText(rawText);
  const themes: string[] = [];
  const themeLabels: string[] = [];

  for (const category of codebook) {
    const matched = category.keywords.some((kw) => norm.includes(kw));
    if (matched) {
      themes.push(category.id);
      themeLabels.push(category.label);
    }
  }

  return { themes, themeLabels };
}

function summarizeQuestion(
  respondents: ValidRespondent[],
  type: 'risk' | 'benefit',
  codebook: CodebookCategory[],
  normalizeTools: boolean
): OpenCodingQuestionSummary {
  const counts = new Map<string, number>();
  for (const cat of codebook) counts.set(cat.id, 0);

  let answeredCount = 0;
  let substantiveCount = 0;
  let noiseOrBlankCount = 0;

  const responses: CodedResponse[] = respondents.map((r) => {
    const rawText = type === 'risk' ? r.openRisk : r.openBenefit;
    if (rawText.trim().length > 0) answeredCount += 1;

    const { isNoise, reason } = detectNoiseOrBlank(rawText);
    const tool = normalizeTools ? r.toolNormalized : r.toolRaw;

    if (isNoise) {
      noiseOrBlankCount += 1;
      return {
        rowNumber: r.rowNumber,
        idLabel: r.idLabel,
        seniority: r.seniority ?? 'Júnior',
        tool: tool || 'Não informado',
        rawText,
        isBlankOrNoise: true,
        noiseReason: reason,
        themes: [],
        themeLabels: [],
      };
    }

    substantiveCount += 1;
    const { themes, themeLabels } = classifyWithCodebook(rawText, codebook);
    for (const themeId of themes) {
      counts.set(themeId, (counts.get(themeId) ?? 0) + 1);
    }

    return {
      rowNumber: r.rowNumber,
      idLabel: r.idLabel,
      seniority: r.seniority ?? 'Júnior',
      tool: tool || 'Não informado',
      rawText,
      isBlankOrNoise: false,
      noiseReason: null,
      themes,
      themeLabels,
    };
  });

  const totalValid = respondents.length;
  const themes: ThemeCount[] = codebook
    .map((cat) => {
      const count = counts.get(cat.id) ?? 0;
      return {
        id: cat.id,
        label: cat.label,
        description: cat.description,
        count,
        pctOfAnswered:
          substantiveCount > 0 ? (count / substantiveCount) * 100 : 0,
        pctOfTotalValid: totalValid > 0 ? (count / totalValid) * 100 : 0,
      };
    })
    .sort((a, b) => b.count - a.count);

  return {
    totalValid,
    answeredCount,
    substantiveCount,
    noiseOrBlankCount,
    themes,
    responses,
  };
}

export function runOpenCoding(
  respondents: ValidRespondent[],
  normalizeTools = true
): OpenCodingSummary {
  return {
    riskCodebook: RISK_CODEBOOK,
    benefitCodebook: BENEFIT_CODEBOOK,
    risks: summarizeQuestion(respondents, 'risk', RISK_CODEBOOK, normalizeTools),
    benefits: summarizeQuestion(
      respondents,
      'benefit',
      BENEFIT_CODEBOOK,
      normalizeTools
    ),
    cohenKappaNote:
      'Seção 5.4: categorização automática assistida por livro de códigos explícito (múltiplos temas por resposta). A validação formal de concordância interavaliadores (κ de Cohen ≥ 0,60 em ≥ 20% das respostas por dois pesquisadores independentes) permanece pendente de registro manual após consenso.',
  };
}
