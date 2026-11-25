import { useMemo, useState } from 'react';
import type { EChartsOption } from 'echarts';
import { BookOpen, MessageSquareQuote, Search } from 'lucide-react';
import type {
  CodedResponse,
  CodebookCategory,
  OpenQuestionType,
  SeniorityLevel,
  SurveyAnalysisResult,
  ThemeCount,
} from '../stats/types';
import { EChart } from '../components/EChart';
import { Badge, Callout, SectionHeader } from '../components/UiPrimitives';
import { COLORS, SENIORITY_COLORS, fmtNum, fmtPct, fmtPValue } from '../utils/format';

interface OpenExploratoryPageProps {
  result: SurveyAnalysisResult;
}

function buildThemesOption(themes: ThemeCount[], color: string): EChartsOption {
  const ordered = [...themes].reverse();
  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: unknown) => {
        const arr = Array.isArray(params) ? params : [params];
        const first = arr[0] as { dataIndex: number };
        const t = ordered[first.dataIndex];
        if (!t) return '';
        return `<div style="font-family:'IBM Plex Sans',sans-serif;font-size:12px;max-width:290px;white-space:normal;">
          <strong>${t.label}</strong><br/>
          <span style="color:#5C6D75;">${t.description}</span><br/>
          Menções: <strong style="font-family:'IBM Plex Mono',monospace;">${t.count}</strong>
          (${fmtPct(t.pctOfAnswered, 1)} das respondidas · ${fmtPct(t.pctOfTotalValid, 1)} dos válidos)
        </div>`;
      },
    },
    grid: { left: 8, right: 56, top: 10, bottom: 8, containLabel: true },
    xAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: { fontFamily: 'IBM Plex Mono', fontSize: 11, color: COLORS.textMuted },
      splitLine: { lineStyle: { color: '#EDF1EC' } },
    },
    yAxis: {
      type: 'category',
      data: ordered.map((t) => t.label),
      axisLabel: {
        fontFamily: 'IBM Plex Sans',
        fontSize: 11,
        color: COLORS.textPrimary,
        width: 175,
        overflow: 'truncate',
      },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: COLORS.border } },
    },
    series: [
      {
        type: 'bar',
        barMaxWidth: 20,
        data: ordered.map((t) => t.count),
        itemStyle: { color, borderRadius: [0, 4, 4, 0] },
        label: {
          show: true,
          position: 'right',
          fontFamily: 'IBM Plex Mono',
          fontSize: 11,
          color: COLORS.textSecondary,
          formatter: (params: { dataIndex: number }) => {
            const t = ordered[params.dataIndex];
            return t ? `${t.count} (${fmtPct(t.pctOfAnswered, 0)})` : '';
          },
        },
      },
    ],
  };
}

export function OpenExploratoryPage({ result }: OpenExploratoryPageProps) {
  const { openCoding, exploratory } = result.filtered;
  const [quoteType, setQuoteType] = useState<'all' | OpenQuestionType>('all');
  const [selectedTheme, setSelectedTheme] = useState<string>('all');
  const [selectedSeniority, setSelectedSeniority] = useState<'all' | SeniorityLevel>('all');
  const [searchText, setSearchText] = useState('');
  const [hideNoise, setHideNoise] = useState(true);
  const [showCodebook, setShowCodebook] = useState(false);
  const [splitMode, setSplitMode] = useState<'deadline' | 'median'>('deadline');

  const riskOption = useMemo(
    () => buildThemesOption(openCoding.risks.themes, COLORS.danger),
    [openCoding.risks.themes]
  );
  const benefitOption = useMemo(
    () => buildThemesOption(openCoding.benefits.themes, COLORS.success),
    [openCoding.benefits.themes]
  );

  const allThemes: Array<CodebookCategory & { typeLabel: string }> = useMemo(
    () => [
      ...openCoding.riskCodebook.map((c) => ({ ...c, typeLabel: 'Risco' })),
      ...openCoding.benefitCodebook.map((c) => ({ ...c, typeLabel: 'Benefício' })),
    ],
    [openCoding.riskCodebook, openCoding.benefitCodebook]
  );

  const combinedQuotes = useMemo(() => {
    const items: Array<{ type: OpenQuestionType; item: CodedResponse }> = [];
    if (quoteType === 'all' || quoteType === 'risk') {
      openCoding.risks.responses.forEach((item) => items.push({ type: 'risk', item }));
    }
    if (quoteType === 'all' || quoteType === 'benefit') {
      openCoding.benefits.responses.forEach((item) => items.push({ type: 'benefit', item }));
    }

    const q = searchText.trim().toLowerCase();
    return items.filter(({ item }) => {
      if (hideNoise && item.isBlankOrNoise) return false;
      if (selectedSeniority !== 'all' && item.seniority !== selectedSeniority) return false;
      if (selectedTheme !== 'all' && !item.themes.includes(selectedTheme)) return false;
      if (q) {
        const hay = `${item.idLabel} ${item.rawText} ${item.tool} ${item.themeLabels.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [openCoding, quoteType, selectedTheme, selectedSeniority, searchText, hideNoise]);

  const contingencyOption = useMemo<EChartsOption>(() => {
    const c = exploratory.toolBySeniority;
    let maxVal = 1;
    c.rows.forEach((_row, rIdx) => {
      c.cols.forEach((_col, cIdx) => {
        const count = c.counts[rIdx]?.[cIdx] ?? 0;
        if (count > maxVal) maxVal = count;
      });
    });

    const data: Array<{
      value: [number, number, number];
      expected: number;
      label: { color: string };
    }> = [];
    c.rows.forEach((_row, rIdx) => {
      c.cols.forEach((_col, cIdx) => {
        const count = c.counts[rIdx]?.[cIdx] ?? 0;
        const exp = c.expected[rIdx]?.[cIdx] ?? 0;
        data.push({
          value: [cIdx, rIdx, count],
          expected: exp,
          label: {
            color: count >= Math.max(3, maxVal * 0.65) ? '#FFFFFF' : COLORS.textPrimary,
          },
        });
      });
    });

    return {
      tooltip: {
        position: 'top',
        formatter: (params: unknown) => {
          const p = params as { value: [number, number, number]; data?: { expected?: number } };
          const colLabel = c.cols[p.value[0]];
          const rowLabel = c.rows[p.value[1]];
          return `<div style="font-family:'IBM Plex Sans',sans-serif;font-size:12px;">
            <strong>${rowLabel} × ${colLabel}</strong><br/>
            Observado: <strong style="font-family:'IBM Plex Mono',monospace;">${p.value[2]}</strong><br/>
            Esperado (sob independência): <span style="font-family:'IBM Plex Mono',monospace;">${fmtNum(p.data?.expected ?? 0, 2)}</span>
          </div>`;
        },
      },
      grid: { left: 10, right: 24, top: 18, bottom: 24, containLabel: true },
      xAxis: {
        type: 'category',
        data: c.cols,
        axisLabel: { fontFamily: 'IBM Plex Sans', fontSize: 11, fontWeight: 600, color: COLORS.textPrimary },
        splitArea: { show: true },
      },
      yAxis: {
        type: 'category',
        data: c.rows,
        axisLabel: { fontFamily: 'IBM Plex Sans', fontSize: 11, color: COLORS.textPrimary },
        splitArea: { show: true },
      },
      visualMap: {
        min: 0,
        max: maxVal,
        show: false,
        inRange: {
          color: ['#F4F6F3', '#C9DCF0', '#5B9BD5', '#1F4E8C'],
        },
      },
      series: [
        {
          name: 'M_TOOL × M_SEN',
          type: 'heatmap',
          data,
          label: {
            show: true,
            fontFamily: 'IBM Plex Mono',
            fontSize: 12,
            fontWeight: 600,
          },
        },
      ],
    };
  }, [exploratory.toolBySeniority]);

  const activeEarlyLate =
    splitMode === 'deadline' ? exploratory.earlyVsLateByDeadline : exploratory.earlyVsLateByMedian;

  return (
    <div className="space-y-6">
      {/* Open Coding Theme Charts */}
      <section className="card-editorial p-5 space-y-4">
        <SectionHeader
          title="Análise Temática das Questões Abertas (ITEM_21 e ITEM_22)"
          subtitle="Frequência de temas por livro de códigos transparente. Respostas podem receber múltiplos temas."
          badge={{ label: 'Seção 5.4 · Abertas', variant: 'descriptive' }}
          rightSlot={
            <button
              type="button"
              onClick={() => setShowCodebook((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#D5DDD6] bg-[#EDF1EC] px-3 py-1.5 text-xs font-semibold text-[#142027] hover:bg-[#E1E7E0]"
            >
              <BookOpen className="h-3.5 w-3.5 text-[#1F4E8C]" />
              {showCodebook ? 'Ocultar Livro de Códigos' : 'Ver Livro de Códigos & κ de Cohen'}
            </button>
          }
        />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="rounded-lg border border-[#D5DDD6] bg-[#FAFBF9] p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-[#142027]">
                Riscos Percebidos (ITEM_21)
              </h3>
              <span className="font-mono-tabular text-xs text-[#5C6D75]">
                Substantivas: {openCoding.risks.substantiveCount} · Ruído/branco: {openCoding.risks.noiseOrBlankCount}
              </span>
            </div>
            <EChart
              option={riskOption}
              height={260}
              ariaLabel="Gráfico de barras horizontais dos temas de risco relatados no ITEM_21"
            />
          </div>

          <div className="rounded-lg border border-[#D5DDD6] bg-[#FAFBF9] p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-[#142027]">
                Benefícios Técnicos Percebidos (ITEM_22)
              </h3>
              <span className="font-mono-tabular text-xs text-[#5C6D75]">
                Substantivas: {openCoding.benefits.substantiveCount} · Ruído/branco: {openCoding.benefits.noiseOrBlankCount}
              </span>
            </div>
            <EChart
              option={benefitOption}
              height={260}
              ariaLabel="Gráfico de barras horizontais dos temas de benefício relatados no ITEM_22"
            />
          </div>
        </div>

        {/* Codebook + Cohen's Kappa Panel */}
        {showCodebook && (
          <div className="rounded-lg border border-[#B6CBE6] bg-[#F8FAFC] p-4 space-y-4">
            <Callout tone="warning" title="Nota de Confiabilidade Interavaliadores (κ de Cohen — Seção 5.4)">
              {openCoding.cohenKappaNote}
            </Callout>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-[#B83B3B]">
                  Livro de Códigos — Riscos (ITEM_21)
                </h4>
                <div className="space-y-2">
                  {openCoding.riskCodebook.map((cat) => (
                    <div key={cat.id} className="rounded border border-[#D5DDD6] bg-white p-2.5 text-xs">
                      <div className="font-semibold text-[#142027]">{cat.label}</div>
                      <p className="mt-0.5 text-[11px] text-[#43535B]">{cat.description}</p>
                      <div className="mt-1 text-[10px] text-[#5C6D75]">
                        <strong>Palavras-chave:</strong>{' '}
                        <span className="font-mono-tabular">{cat.keywords.join(', ')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-[#2F7A5C]">
                  Livro de Códigos — Benefícios (ITEM_22)
                </h4>
                <div className="space-y-2">
                  {openCoding.benefitCodebook.map((cat) => (
                    <div key={cat.id} className="rounded border border-[#D5DDD6] bg-white p-2.5 text-xs">
                      <div className="font-semibold text-[#142027]">{cat.label}</div>
                      <p className="mt-0.5 text-[11px] text-[#43535B]">{cat.description}</p>
                      <div className="mt-1 text-[10px] text-[#5C6D75]">
                        <strong>Palavras-chave:</strong>{' '}
                        <span className="font-mono-tabular">{cat.keywords.join(', ')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Filterable Literal Quotes Explorer */}
      <section className="card-editorial p-5 space-y-4">
        <SectionHeader
          title="Explorador de Relatos Literais"
          subtitle="Inspeção filtrável por questão, tema codificado, senioridade e texto livre."
          badge={{ label: `${combinedQuotes.length} relatos exibidos`, variant: 'neutral' }}
        />

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-[#5C6D75]" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Buscar no texto literal, ID (R2), ferramenta..."
              aria-label="Buscar nos relatos literais"
              className="w-full rounded-lg border border-[#D5DDD6] bg-white py-1.5 pl-8 pr-3 text-xs text-[#142027] placeholder:text-[#5C6D75]"
            />
          </div>

          <select
            value={quoteType}
            onChange={(e) => setQuoteType(e.target.value as 'all' | OpenQuestionType)}
            aria-label="Filtrar tipo de questão aberta"
            className="rounded-lg border border-[#D5DDD6] bg-white px-2.5 py-1.5 text-xs text-[#142027]"
          >
            <option value="all">Riscos e Benefícios</option>
            <option value="risk">Apenas Riscos (ITEM_21)</option>
            <option value="benefit">Apenas Benefícios (ITEM_22)</option>
          </select>

          <select
            value={selectedTheme}
            onChange={(e) => setSelectedTheme(e.target.value)}
            aria-label="Filtrar tema codificado"
            className="rounded-lg border border-[#D5DDD6] bg-white px-2.5 py-1.5 text-xs text-[#142027] max-w-[220px]"
          >
            <option value="all">Todos os temas</option>
            {allThemes.map((t) => (
              <option key={t.id} value={t.id}>
                [{t.typeLabel}] {t.label}
              </option>
            ))}
          </select>

          <select
            value={selectedSeniority}
            onChange={(e) => setSelectedSeniority(e.target.value as 'all' | SeniorityLevel)}
            aria-label="Filtrar senioridade nos relatos"
            className="rounded-lg border border-[#D5DDD6] bg-white px-2.5 py-1.5 text-xs text-[#142027]"
          >
            <option value="all">Todas senioridades</option>
            <option value="Júnior">Júnior</option>
            <option value="Pleno">Pleno</option>
            <option value="Sênior">Sênior</option>
          </select>

          <label className="inline-flex items-center gap-1.5 text-xs text-[#43535B] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hideNoise}
              onChange={() => setHideNoise((prev) => !prev)}
              className="h-3.5 w-3.5 accent-[#1F4E8C]"
            />
            Ocultar em branco/ruído
          </label>
        </div>

        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 max-h-[420px] overflow-y-auto pr-1">
          {combinedQuotes.map(({ type, item }, idx) => (
            <div
              key={`${type}-${item.rowNumber}-${idx}`}
              className="rounded-lg border border-[#D5DDD6] bg-[#FAFBF9] p-3 text-xs space-y-1.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5">
                  <Badge variant={type === 'risk' ? 'danger' : 'success'}>
                    {type === 'risk' ? 'Risco (ITEM_21)' : 'Benefício (ITEM_22)'}
                  </Badge>
                  <span className="font-mono-tabular font-semibold text-[#142027]">
                    {item.idLabel}
                  </span>
                  <span
                    className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
                    style={{ backgroundColor: SENIORITY_COLORS[item.seniority] }}
                  >
                    {item.seniority}
                  </span>
                  <span className="text-[11px] text-[#5C6D75]">{item.tool}</span>
                </div>
              </div>

              <p className="flex items-start gap-1.5 text-[#142027] leading-relaxed">
                <MessageSquareQuote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#5C6D75]" />
                {item.isBlankOrNoise ? (
                  <span className="italic text-[#5C6D75]">
                    {item.rawText ? `"${item.rawText}" (${item.noiseReason})` : '(Sem resposta)'}
                  </span>
                ) : (
                  <span>&ldquo;{item.rawText}&rdquo;</span>
                )}
              </p>

              {!item.isBlankOrNoise && item.themeLabels.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {item.themeLabels.map((lbl) => (
                    <Badge key={lbl} variant="neutral">
                      {lbl}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
          {combinedQuotes.length === 0 && (
            <div className="col-span-full py-6 text-center text-xs text-[#5C6D75]">
              Nenhum relato encontrado com os filtros aplicados.
            </div>
          )}
        </div>
      </section>

      {/* Exploratory Contingency + Early vs Late */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <section className="card-editorial p-5 xl:col-span-6 space-y-4">
          <SectionHeader
            title="Associação Ferramenta × Senioridade (M_TOOL × M_SEN)"
            subtitle="Teste automático: χ² quando todas as células esperadas ≥ 5; caso contrário Teste Exato de Fisher (Monte Carlo)."
            badge={{ label: 'Exploratória · Contingência', variant: 'exploratory' }}
          />
          <EChart
            option={contingencyOption}
            height={280}
            ariaLabel="Heatmap de contingência entre ferramenta de IA e nível de senioridade"
          />
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 rounded-lg border border-[#D5DDD6] bg-[#FAFBF9] p-3 text-xs font-mono-tabular">
            <div>
              <div className="text-[10px] uppercase text-[#5C6D75]">Método</div>
              <div className="font-sans font-semibold text-[#142027]">
                {exploratory.toolBySeniority.methodUsed === 'chi2'
                  ? 'Qui-quadrado (χ²)'
                  : 'Fisher (Monte Carlo)'}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-[#5C6D75]">p-valor</div>
              <div className="font-semibold text-[#1F4E8C]">
                {fmtPValue(exploratory.toolBySeniority.pValue)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-[#5C6D75]">V de Cramér</div>
              <div className="font-semibold text-[#142027]">
                {fmtNum(exploratory.toolBySeniority.cramersV, 3)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-[#5C6D75]">Células esp. &lt; 5</div>
              <div className="font-semibold text-[#142027]">
                {exploratory.toolBySeniority.cellsBelow5} (mín: {fmtNum(exploratory.toolBySeniority.minExpected, 2)})
              </div>
            </div>
          </div>
          <p className="text-[11px] text-[#5C6D75]">{exploratory.toolBySeniority.note}</p>
        </section>

        <section className="card-editorial p-5 xl:col-span-6 space-y-4">
          <SectionHeader
            title="Comparativo Iniciais vs Tardias (Viés de Não Resposta · Sec. 7)"
            subtitle="Verifica se respondentes tardios diferem dos iniciais nos construtos principais."
            badge={{ label: 'Exploratória · Sec. 7', variant: 'exploratory' }}
            rightSlot={
              <div className="inline-flex rounded-lg border border-[#D5DDD6] bg-[#EDF1EC] p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setSplitMode('deadline')}
                  className={`rounded-md px-2.5 py-1 font-semibold transition-colors ${
                    splitMode === 'deadline'
                      ? 'bg-white text-[#1F4E8C] shadow-xs'
                      : 'text-[#5C6D75] hover:text-[#142027]'
                  }`}
                >
                  Corte 24/11 12h
                </button>
                <button
                  type="button"
                  onClick={() => setSplitMode('median')}
                  className={`rounded-md px-2.5 py-1 font-semibold transition-colors ${
                    splitMode === 'median'
                      ? 'bg-white text-[#1F4E8C] shadow-xs'
                      : 'text-[#5C6D75] hover:text-[#142027]'
                  }`}
                >
                  Mediana temporal
                </button>
              </div>
            }
          />

          <p className="text-xs text-[#43535B]">{activeEarlyLate.splitLabel}</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="card-subtle p-3 text-xs">
              <div className="font-semibold text-[#1F4E8C]">{activeEarlyLate.early.label}</div>
              <div className="mt-1 font-mono-tabular text-lg font-bold text-[#142027]">
                n = {activeEarlyLate.early.n}
              </div>
            </div>
            <div className="card-subtle p-3 text-xs">
              <div className="font-semibold text-[#B8721F]">{activeEarlyLate.late.label}</div>
              <div className="mt-1 font-mono-tabular text-lg font-bold text-[#142027]">
                n = {activeEarlyLate.late.n}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#D5DDD6] bg-[#EDF1EC] text-[11px] font-semibold uppercase tracking-wider text-[#43535B]">
                  <th className="px-3 py-2">Construto</th>
                  <th className="px-3 py-2 text-right">Mediana Iniciais</th>
                  <th className="px-3 py-2 text-right">Mediana Tardias</th>
                  <th className="px-3 py-2 text-right">MW U</th>
                  <th className="px-3 py-2 text-right">p-valor</th>
                  <th className="px-3 py-2 text-right">Efeito r</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDF1EC] font-mono-tabular">
                {[
                  {
                    name: 'C_VEL (Velocidade)',
                    mEarly: activeEarlyLate.early.cVelMedian,
                    mLate: activeEarlyLate.late.cVelMedian,
                    test: activeEarlyLate.cVelTest,
                  },
                  {
                    name: 'C_QUAL (Qualidade)',
                    mEarly: activeEarlyLate.early.cQualMedian,
                    mLate: activeEarlyLate.late.cQualMedian,
                    test: activeEarlyLate.cQualTest,
                  },
                  {
                    name: 'M_REV (Revisão)',
                    mEarly: activeEarlyLate.early.mRevMedian,
                    mLate: activeEarlyLate.late.mRevMedian,
                    test: activeEarlyLate.mRevTest,
                  },
                ].map((row) => (
                  <tr key={row.name} className="hover:bg-[#F8FAF8]">
                    <td className="px-3 py-2.5 font-sans font-semibold text-[#142027]">{row.name}</td>
                    <td className="px-3 py-2.5 text-right">{fmtNum(row.mEarly, 2)}</td>
                    <td className="px-3 py-2.5 text-right">{fmtNum(row.mLate, 2)}</td>
                    <td className="px-3 py-2.5 text-right">{fmtNum(row.test.u, 1)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-[#1F4E8C]">
                      {fmtPValue(row.test.pValue)}
                    </td>
                    <td className="px-3 py-2.5 text-right">{fmtNum(row.test.effectR, 3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Callout tone="info" title="Interpretação do teste de onda (Sec. 7)">
            Ausência de diferenças significativas (p ≥ 0,05) entre respostas iniciais e tardias reduz a evidência de viés severo de não resposta por atraso na devolução, embora não elimine o viés de autosseleção da amostra não probabilística.
          </Callout>
        </section>
      </div>
    </div>
  );
}
