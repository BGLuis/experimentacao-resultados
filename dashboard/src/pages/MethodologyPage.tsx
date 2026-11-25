import { Fragment, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import type { RawRowAudit, SurveyAnalysisResult } from '../stats/types';
import { Badge, SectionHeader } from '../components/UiPrimitives';
import { fmtNum } from '../utils/format';

interface MethodologyPageProps {
  result: SurveyAnalysisResult;
}

const TRACEABILITY_ROWS = [
  {
    section: 'Seção 1 · GQM & QPs',
    spec: 'QP1 (Velocidade), QP2 (Qualidade), QP3 (Senioridade, confirmatória), QP4 (Rigor × Qualidade, confirmatória) + nota exploratória',
    impl: 'Aba 2 (QP1/QP2), Aba 4 (QP3/QP4 com selo Confirmatória) e selos Exploratória nas demais análises',
  },
  {
    section: 'Seção 2 · Amostragem & Parada',
    spec: 'n = 60 (mín. 50), ME = 1,96·√(0,25/n), Wilson 95%, janela 12/11–22/11 (+ prorrogação 24/11 12h)',
    impl: 'Aba 1 (KPIs, Timeline com linhas 22/11 e 24/11 12h, contagem pós-prazo) e Aba 2 (IC Wilson 95%)',
  },
  {
    section: 'Seção 3 · Construtos & Escalas',
    spec: 'C_VEL (ITEM_08–11), C_QUAL (ITEM_12–17 com ITEM_16 = 6−x), M_REV (ITEM_19–20), M_SEN (Jr/Pl/Sr)',
    impl: 'stats/parser.ts & cleaning.ts; toggle de inspeção ITEM_16 bruto vs invertido na Aba 2',
  },
  {
    section: 'Seção 5.1 · Limpeza (6 passos)',
    spec: 'Atenção (ITEM_18≠2), tempo <120s (ou N/A), straightlining (DP=0), duplicatas, N/A (≥75% itens), inversão ITEM_16',
    impl: 'Etapa 0 (Elegibilidade) + Etapas 1–6 em cleaning.ts; Funil interativo na Aba 1 e auditoria na Aba 6',
  },
  {
    section: 'Seção 5.2 · Confiabilidade',
    spec: 'Cronbach α ≥ 0,70 (IC bootstrap) para C_VEL/C_QUAL; Spearman ρ ≥ 0,50 para M_REV; regra de fallback',
    impl: 'Aba 3 (Semáforo, Point-Range, tabela "Se item removido", status dinâmico do Fallback)',
  },
  {
    section: 'Seção 5.3 · Testes Inferenciais',
    spec: 'QP3: KW (α=0,025) ou fusão (<8/grupo) + Mann-Whitney + r; QP4: Spearman (α=0,05) + Cohen + sensibilidade',
    impl: 'Aba 4 ancorada na amostra válida integral (proteção anti-p-hacking contra filtros globais)',
  },
  {
    section: 'Seção 5.4 · Abertas & κ',
    spec: 'Análise temática indutiva (ITEM_21–22), livro de códigos, ≥20% dupla codificação com κ ≥ 0,60, anonimização',
    impl: 'Aba 5 (Gráficos de temas, livro de códigos, explorador literal e nota explícita de pendência do κ)',
  },
  {
    section: 'Seções 7–8 · Validade & Desvios',
    spec: 'Matriz de 8 ameaças, comparativo iniciais vs tardias e registro transparente de desvios em DESVIOS.md',
    impl: 'Aba 5 (Iniciais vs Tardias) e Aba 6 (Desvios observados, Matriz atualizada e Explorador de 33 linhas)',
  },
];

const DEVIATIONS = [
  {
    id: 'D-01',
    title: 'Tamanho amostral abaixo do mínimo planejado (26 válidas vs 50/60)',
    section: 'Seção 2',
    planned: 'Meta 60 válidas (mínimo 50; ≥ 80 brutas), ME = ±12,65 a ±13,86 p.p.',
    observed: '33 respostas brutas → 26 válidas. Margem de erro indicativa ampliada para ±19,22 p.p.',
    impact: 'Redução do poder estatístico em QP3/QP4 (risco elevado de erro Tipo II); interpreta-se os resultados com foco em tamanhos de efeito e ICs.',
    severity: 'warning' as const,
  },
  {
    id: 'D-02',
    title: 'Janela de coleta atrasada e 14 respostas válidas pós-prorrogação (24/11 12h)',
    section: 'Seções 2 e 8',
    planned: 'Coleta de 12/11 a 22/11 às 23h59, prorrogável até 24/11 às 12h.',
    observed: 'Primeira resposta em 17/11 23:23; 14 das 26 válidas chegaram entre 24/11 12:19 e 25/11 14:06.',
    impact: 'Coleta estendida para preservar poder mínimo, documentada em DESVIOS.md e auditada via teste Iniciais vs Tardias (Aba 5).',
    severity: 'warning' as const,
  },
  {
    id: 'D-03',
    title: 'Skip logic do Google Forms gravou 4 respostas inelegíveis no CSV',
    section: 'Seção 2 / Script .gs',
    planned: 'Quem não atendesse aos critérios encerrava o formulário sem gravar resposta.',
    observed: 'paginaAgradecimento.setGoToPage(SUBMIT) direcionou inelegíveis para tela de envio, registrando R10, R16, R23 e R30 com ITEM_05–22 vazios.',
    impact: 'Adicionada Etapa 0 (Elegibilidade) antes da Etapa 1 no funil de limpeza; nenhum dado inválido contaminou a análise.',
    severity: 'neutral' as const,
  },
  {
    id: 'D-04',
    title: 'Ausência de log de tempo de preenchimento (< 120 s)',
    section: 'Seção 5.1',
    planned: 'Descarte se tempo total < 120 s quando mensurável.',
    observed: 'Google Forms nativo exporta apenas o carimbo de envio, sem horário de início.',
    impact: 'Limitação já prevista no protocolo; controle de atenção apoiado em ITEM_18 ≠ 2 (3 descartes) e straightlining (DP = 0).',
    severity: 'neutral' as const,
  },
  {
    id: 'D-05',
    title: 'Embaralhamento global via setShuffleQuestions(true)',
    section: 'Seção 3 / Script .gs',
    planned: 'Ordem aleatória garantindo ITEM_16 não adjacente a outro item de qualidade.',
    observed: 'EMBARALHAR_LIKERT = true embaralha dentro da página sem restrição de adjacência para ITEM_16 ou posição do ITEM_18.',
    impact: 'Atenua parcialmente viés de ordem, mas não garante o espaçamento mínimo ideal; monitorado via sensibilidade sem ITEM_16 na QP4.',
    severity: 'neutral' as const,
  },
  {
    id: 'D-06',
    title: 'Normalização de ferramenta ("kiro aws" → "Kiro") e menção indireta a empresa',
    section: 'Seções 3 e 6',
    planned: 'Categoria única "Outra, descreva sem citar empresas".',
    observed: '2 respondentes válidos digitaram "kiro aws" em Outra (elevando Kiro para 9/26 = 34,6%) e citando "aws".',
    impact: 'Toggle no cabeçalho permite alternar entre rótulo normalizado e bruto; menção indireta registrada para revisão antes de publicação.',
    severity: 'neutral' as const,
  },
  {
    id: 'D-07',
    title: 'Fusão obrigatória de grupos na QP3 (Jr = 6 < 8, Pl = 6 < 8)',
    section: 'Seção 5.3',
    planned: 'Kruskal-Wallis nos 3 níveis se todos n_g ≥ 8; senão fusão dos adjacentes menores.',
    observed: 'Júnior = 6, Pleno = 6, Sênior = 14 → aplicada fusão Jr+Pl (12) vs Sênior (14) com Mann-Whitney U.',
    impact: 'Regra pré-registrada executada fielmente; ambos os testes (Mann-Whitney fundido e KW 3 níveis) ficam visíveis na Aba 4.',
    severity: 'info' as const,
  },
  {
    id: 'D-08',
    title: 'Codificação temática das abertas sem validação formal de κ de Cohen',
    section: 'Seção 5.4',
    planned: 'Dois pesquisadores independentes codificando ≥ 20% com meta κ ≥ 0,60.',
    observed: 'Classificação por livro de códigos explícito por regras no dashboard; dupla avaliação independente pendente.',
    impact: 'Sinalizado explicitamente na Aba 5 e em DESVIOS.md para não superestimar objetividade da codificação qualitativa.',
    severity: 'warning' as const,
  },
  {
    id: 'D-09',
    title: 'Status do registro de anterioridade no repositório Git',
    section: 'Seção 8',
    planned: 'Commit assinado e tag no GitHub publicados em 12/11/2026 antes da primeira resposta.',
    observed: 'O histórico Git local contém apenas o commit inicial (27/10/2026), sem tag nem commit assinado do PDF antes do início da coleta (17/11/2026).',
    impact: 'Não altera os cálculos estatísticos, mas enfraquece a prova criptográfica de anterioridade via Git; mitigado pela preservação do PDF original e registro em DESVIOS.md.',
    severity: 'warning' as const,
  },
];

const THREATS_MATRIX = [
  {
    threat: 'Não resposta / taxa incalculável',
    planned: 'Questionário curto (~4 min); comparação iniciais vs tardias.',
    status: 'Monitorada · 14/26 válidas após 24/11 12h; teste de onda disponível na Aba 5 (sem diferença significativa).',
  },
  {
    threat: 'Autosseleção (entusiastas de IA)',
    planned: 'Chamada neutra; covariável M_USO (ITEM_07).',
    status: 'Acentuada · 22/26 (84,6%) usam IA todos os dias úteis; amostra altamente engajada com IA.',
  },
  {
    threat: 'Desejabilidade social',
    planned: 'Anonimato total e opção neutra.',
    status: 'Mitigada parcialmente · 0 straightlining; adesão variável em revisão linha a linha.',
  },
  {
    threat: 'Validade de construto (poucos itens)',
    planned: 'Construtos multi-item, α e ρ, piloto com 4 engenheiros.',
    status: 'Confirmada confiabilidade · α(C_VEL)=0,708, α(C_QUAL)=0,786, ρ(M_REV)=0,612 (todos acima dos cortes).',
  },
  {
    threat: 'Autorrelato & método comum (QP4)',
    planned: 'ITEM_16 invertido, ordem aleatória, análises de sensibilidade.',
    status: 'Mitigada · Sensibilidade sem ITEM_16, sem ITEM_17 e parcial (M_SEN/M_USO) mantêm direção negativa consistente.',
  },
  {
    threat: 'Viés de recordação ("antes da IA")',
    planned: 'Limitação reconhecida sem mitigação pelo desenho.',
    status: 'Inalterada · Presente em ITEM_11 e ITEM_14; restrito a percepção.',
  },
  {
    threat: 'Validade externa (amostra não probabilística)',
    planned: 'Sem generalização estatística; descrição de perfil.',
    status: 'Crítica · n = 26 por conveniência/bola de neve no Brasil; resultados aplicam-se apenas à amostra.',
  },
  {
    threat: 'Conclusão: baixo poder e múltiplos testes',
    planned: 'Apenas 3 testes confirmatórios (α=0,025/0,05), fusão de grupos e ICs.',
    status: 'Impactada · n = 26 (< 50); fusão Jr+Pl vs Sr aplicada; efeitos e ICs bootstrap reportados na Aba 4.',
  },
];

export function MethodologyPage({ result }: MethodologyPageProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | 'valid' | 'discarded'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const filteredAudits = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return result.cleaning.audits.filter((a) => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (q) {
        const hay = `${a.idLabel} ${a.timestampRaw} ${a.toolRaw} ${a.toolNormalized} ${a.seniority ?? ''} ${a.discardReason ?? ''} ${a.raw.openRisk} ${a.raw.openBenefit}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [result.cleaning.audits, statusFilter, searchQuery]);

  const toggleExpand = (rowNum: number) => {
    setExpandedRow((prev) => (prev === rowNum ? null : rowNum));
  };

  const renderRowDetail = (audit: RawRowAudit) => {
    const r = audit.raw;
    return (
      <div className="grid grid-cols-1 gap-4 bg-[#FAFBF9] p-4 text-xs lg:grid-cols-3">
        <div className="space-y-1.5">
          <div className="font-semibold text-[#142027]">Elegibilidade & Perfil</div>
          <div>Consentimento: <span className="text-[#43535B]">{r.consent || '—'}</span></div>
          <div>
            ITEM_01–04:{' '}
            <span className="font-mono-tabular text-[#142027]">
              {r.eligibility.item01 || '—'} / {r.eligibility.item02 || '—'} / {r.eligibility.item03 || '—'} / {r.eligibility.item04 || '—'}
            </span>
          </div>
          <div>Experiência (ITEM_05): <strong>{r.experienceRaw || '—'}</strong> ({audit.seniority ?? '—'})</div>
          <div>Ferramenta (ITEM_06): <strong>{r.toolRaw || '—'}</strong> → {r.toolNormalized || '—'}</div>
          <div>Frequência (ITEM_07): <strong>{r.frequencyRaw || '—'}</strong></div>
        </div>

        <div className="space-y-1.5">
          <div className="font-semibold text-[#142027]">Escores Likert & Revisão</div>
          <div className="font-mono-tabular">
            C_VEL: <strong>{fmtNum(audit.scores?.C_VEL, 2)}</strong> · C_QUAL:{' '}
            <strong>{fmtNum(audit.scores?.C_QUAL, 2)}</strong> · M_REV:{' '}
            <strong>{fmtNum(audit.scores?.M_REV, 2)}</strong>
          </div>
          <div className="font-mono-tabular text-[11px] text-[#43535B]">
            ITEM_08–11: {r.likertNumeric.ITEM_08 ?? 'NA'}, {r.likertNumeric.ITEM_09 ?? 'NA'},{' '}
            {r.likertNumeric.ITEM_10 ?? 'NA'}, {r.likertNumeric.ITEM_11 ?? 'NA'}
          </div>
          <div className="font-mono-tabular text-[11px] text-[#43535B]">
            ITEM_12–17: {r.likertNumeric.ITEM_12 ?? 'NA'}, {r.likertNumeric.ITEM_13 ?? 'NA'},{' '}
            {r.likertNumeric.ITEM_14 ?? 'NA'}, {r.likertNumeric.ITEM_15 ?? 'NA'},{' '}
            {r.likertNumeric.ITEM_16 ?? 'NA'} (inv:{audit.scores?.item16Inverted ?? 'NA'}),{' '}
            {r.likertNumeric.ITEM_17 ?? 'NA'}
          </div>
          <div className="font-mono-tabular text-[11px] text-[#43535B]">
            ITEM_18 (Atenção = 2): <strong>{r.likertNumeric.ITEM_18 ?? 'NA'}</strong> ({r.likertRaw.ITEM_18 || '—'})
          </div>
          <div className="font-mono-tabular text-[11px] text-[#43535B]">
            ITEM_19–20 (M_REV): {r.reviewNumeric.ITEM_19 ?? 'NA'} ({r.reviewRaw.ITEM_19 || '—'}),{' '}
            {r.reviewNumeric.ITEM_20 ?? 'NA'} ({r.reviewRaw.ITEM_20 || '—'})
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="font-semibold text-[#142027]">Respostas Abertas (ITEM_21–22)</div>
          <div>
            <span className="font-semibold text-[#B83B3B]">Risco:</span>{' '}
            <span className="text-[#43535B]">{r.openRisk || '(Em branco)'}</span>
          </div>
          <div>
            <span className="font-semibold text-[#2F7A5C]">Benefício:</span>{' '}
            <span className="text-[#43535B]">{r.openBenefit || '(Em branco)'}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Traceability */}
      <section className="card-editorial p-5 space-y-4">
        <SectionHeader
          title="Rastreabilidade Protocolo Pré-Registrado ↔ Dashboard"
          subtitle="Mapeamento direto entre as seções do documento de pré-registro e a implementação estatística/visual."
          badge={{ label: 'Auditabilidade', variant: 'confirmatory' }}
        />
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#D5DDD6] bg-[#EDF1EC] text-[11px] font-semibold uppercase tracking-wider text-[#43535B]">
                <th className="px-3 py-2.5">Seção do Protocolo</th>
                <th className="px-3 py-2.5">Especificação Pré-Registrada</th>
                <th className="px-3 py-2.5">Implementação no Dashboard</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDF1EC]">
              {TRACEABILITY_ROWS.map((row) => (
                <tr key={row.section} className="hover:bg-[#F8FAF8]">
                  <td className="px-3 py-2.5 font-semibold text-[#1F4E8C] whitespace-nowrap">{row.section}</td>
                  <td className="px-3 py-2.5 text-[#142027]">{row.spec}</td>
                  <td className="px-3 py-2.5 text-[#43535B]">{row.impl}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Observed Deviations */}
      <section className="card-editorial p-5 space-y-4">
        <SectionHeader
          title="Desvios Observados em Relação ao Protocolo (Seção 8 / DESVIOS.md)"
          subtitle="Registro transparente de todas as alterações ou limitações ocorridas durante a execução."
          badge={{ label: `${DEVIATIONS.length} desvios documentados`, variant: 'warning' }}
        />
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {DEVIATIONS.map((d) => (
            <div key={d.id} className="rounded-lg border border-[#D5DDD6] bg-[#FAFBF9] p-3.5 text-xs space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono-tabular rounded bg-[#142027] px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {d.id}
                  </span>
                  <span className="font-semibold text-[#142027]">{d.title}</span>
                </div>
                <Badge variant={d.severity === 'warning' ? 'warning' : d.severity === 'info' ? 'confirmatory' : 'neutral'}>
                  {d.section}
                </Badge>
              </div>
              <div className="text-[11px] text-[#5C6D75]">
                <strong>Planejado:</strong> {d.planned}
              </div>
              <div className="text-[11px] text-[#142027]">
                <strong>Executado:</strong> {d.observed}
              </div>
              <div className="text-[11px] text-[#43535B] border-t border-[#EDF1EC] pt-1">
                <strong>Impacto:</strong> {d.impact}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Threats to Validity Matrix */}
      <section className="card-editorial p-5 space-y-4">
        <SectionHeader
          title="Matriz de Ameaças à Validade Atualizada (Seção 7)"
          subtitle="Avaliação pós-coleta das 8 ameaças pré-registradas com base nos dados reais observados."
          badge={{ label: 'Validade · Seção 7', variant: 'descriptive' }}
        />
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#D5DDD6] bg-[#EDF1EC] text-[11px] font-semibold uppercase tracking-wider text-[#43535B]">
                <th className="px-3 py-2.5">Ameaça</th>
                <th className="px-3 py-2.5">Mitigação Prevista</th>
                <th className="px-3 py-2.5">Status Observado Pós-Coleta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDF1EC]">
              {THREATS_MATRIX.map((row) => (
                <tr key={row.threat} className="hover:bg-[#F8FAF8]">
                  <td className="px-3 py-2.5 font-semibold text-[#142027]">{row.threat}</td>
                  <td className="px-3 py-2.5 text-[#43535B]">{row.planned}</td>
                  <td className="px-3 py-2.5 text-[#142027]">{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Searchable Raw & Clean Data Explorer */}
      <section className="card-editorial p-5 space-y-4">
        <SectionHeader
          title="Explorador Auditável das Respostas Brutas & Limpas"
          subtitle="Todas as linhas do CSV com status de retenção/descarte, motivo exato e escores computados."
          badge={{
            label: `${filteredAudits.length} / ${result.cleaning.totalRaw} linhas`,
            variant: 'neutral',
          }}
        />

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-[#5C6D75]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrar por ID (R10), timestamp, ferramenta, motivo..."
              aria-label="Filtrar tabela de respostas brutas e limpas"
              className="w-full rounded-lg border border-[#D5DDD6] bg-white py-1.5 pl-8 pr-3 text-xs text-[#142027] placeholder:text-[#5C6D75]"
            />
          </div>

          <div className="inline-flex rounded-lg border border-[#D5DDD6] bg-[#EDF1EC] p-0.5 text-xs">
            {(
              [
                { id: 'all', label: `Todas (${result.cleaning.totalRaw})` },
                { id: 'valid', label: `Válidas (${result.cleaning.totalValid})` },
                {
                  id: 'discarded',
                  label: `Descartadas (${result.cleaning.totalRaw - result.cleaning.totalValid})`,
                },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setStatusFilter(opt.id)}
                className={`rounded-md px-2.5 py-1 font-semibold transition-colors ${
                  statusFilter === opt.id
                    ? 'bg-white text-[#1F4E8C] shadow-xs'
                    : 'text-[#5C6D75] hover:text-[#142027]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto max-h-[520px] overflow-y-auto rounded-lg border border-[#D5DDD6]">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 bg-[#EDF1EC]">
              <tr className="border-b border-[#D5DDD6] text-[11px] font-semibold uppercase tracking-wider text-[#43535B]">
                <th className="px-3 py-2.5 w-8"></th>
                <th className="px-3 py-2.5">ID</th>
                <th className="px-3 py-2.5">Data/Hora</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Senioridade</th>
                <th className="px-3 py-2.5">Ferramenta</th>
                <th className="px-3 py-2.5 text-right">C_VEL</th>
                <th className="px-3 py-2.5 text-right">C_QUAL</th>
                <th className="px-3 py-2.5 text-right">M_REV</th>
                <th className="px-3 py-2.5">Critério / Motivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDF1EC] bg-white">
              {filteredAudits.map((audit) => {
                const isOpen = expandedRow === audit.rowNumber;
                return (
                  <Fragment key={audit.rowNumber}>
                    <tr
                      onClick={() => toggleExpand(audit.rowNumber)}
                      className={`cursor-pointer transition-colors ${
                        audit.status === 'discarded'
                          ? 'bg-[#FBEAEA]/40 hover:bg-[#FBEAEA]/70'
                          : 'hover:bg-[#F8FAF8]'
                      }`}
                    >
                      <td className="px-3 py-2 text-[#5C6D75]">
                        {isOpen ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono-tabular font-semibold text-[#142027]">
                        {audit.idLabel}
                      </td>
                      <td className="px-3 py-2 font-mono-tabular text-[11px] text-[#43535B] whitespace-nowrap">
                        {audit.timestampRaw || '—'}
                      </td>
                      <td className="px-3 py-2">
                        {audit.status === 'valid' ? (
                          <Badge variant="success">Válida</Badge>
                        ) : (
                          <Badge variant="danger">Descartada ({audit.discardStage})</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2">{audit.seniority ?? '—'}</td>
                      <td className="px-3 py-2">
                        {result.filter.normalizeTools
                          ? audit.toolNormalized || '—'
                          : audit.toolRaw || '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono-tabular">
                        {fmtNum(audit.scores?.C_VEL, 2)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono-tabular">
                        {fmtNum(audit.scores?.C_QUAL, 2)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono-tabular">
                        {fmtNum(audit.scores?.M_REV, 2)}
                      </td>
                      <td className="px-3 py-2 text-[11px] text-[#43535B]">
                        {audit.status === 'valid'
                          ? 'Aprovada em todas as etapas'
                          : audit.discardReason}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={10} className="border-t border-[#D5DDD6] p-0">
                          {renderRowDetail(audit)}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {filteredAudits.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-center text-xs text-[#5C6D75]">
                    Nenhuma linha encontrada com os filtros informados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
