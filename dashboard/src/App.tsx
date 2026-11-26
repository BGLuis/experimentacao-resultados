import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_BI_FILTER_STATE,
  DEFAULT_FILTER_STATE,
  analyzeBiDashboardSlice,
  analyzeSurveyCsv,
  parseViewModeFromSearch,
} from './stats';
import type { BiFilterState, FilterState } from './stats';
import { HeaderBar, type AppViewMode } from './components/HeaderBar';
import { FilterBar } from './components/FilterBar';
import { TabNav, type TabId } from './components/TabNav';
import { Callout } from './components/UiPrimitives';
import { BiDashboardPage } from './pages/BiDashboardPage';
import { OverviewPage } from './pages/OverviewPage';
import { LikertPage } from './pages/LikertPage';
import { ReliabilityPage } from './pages/ReliabilityPage';
import { ConfirmatoryPage } from './pages/ConfirmatoryPage';
import { OpenExploratoryPage } from './pages/OpenExploratoryPage';
import { MethodologyPage } from './pages/MethodologyPage';

const REPO_CSV_PATH = '/questions.csv';

function readViewModeFromUrl(): AppViewMode {
  if (typeof window === 'undefined') return 'dashboard';
  return parseViewModeFromSearch(window.location.search);
}

export function App() {
  const [csvText, setCsvText] = useState<string | null>(null);
  const [sourceLabel, setSourceLabel] = useState<string>('questions.csv');
  const [isCustomCsv, setIsCustomCsv] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<AppViewMode>(() => readViewModeFromUrl());
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER_STATE);
  const [biFilter, setBiFilter] = useState<BiFilterState>(DEFAULT_BI_FILTER_STATE);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('mode');
    if (raw !== null && raw !== 'dashboard' && raw !== 'report') {
      params.set('mode', 'dashboard');
      const nextUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
      window.history.replaceState(null, '', nextUrl);
    }

    const handlePopState = () => {
      setViewMode(readViewModeFromUrl());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleChangeViewMode = useCallback((nextMode: AppViewMode) => {
    setViewMode(nextMode);
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') !== nextMode) {
      params.set('mode', nextMode);
      const nextUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
      window.history.pushState(null, '', nextUrl);
    }
  }, []);

  const loadRepoCsv = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch(`${REPO_CSV_PATH}?t=${Date.now()}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ao carregar ${REPO_CSV_PATH}`);
      }
      const text = await response.text();
      setCsvText(text);
      setSourceLabel('questions.csv');
      setIsCustomCsv(false);
    } catch (err) {
      setLoadError(
        err instanceof Error
          ? err.message
          : 'Erro desconhecido ao carregar /questions.csv do repositório.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRepoCsv();
  }, [loadRepoCsv]);

  const analysis = useMemo(() => {
    if (!csvText) return null;
    try {
      return { data: analyzeSurveyCsv(csvText, filter), error: null as string | null };
    } catch (err) {
      return {
        data: null,
        error:
          err instanceof Error
            ? `Erro ao analisar CSV: ${err.message}`
            : 'Erro desconhecido ao processar o arquivo CSV.',
      };
    }
  }, [csvText, filter]);

  const result = analysis?.data ?? null;

  const biSlice = useMemo(
    () => (result ? analyzeBiDashboardSlice(result, biFilter) : null),
    [result, biFilter]
  );

  const handleUploadCsv = useCallback((text: string, fileName: string) => {
    setCsvText(text);
    setSourceLabel(fileName);
    setIsCustomCsv(true);
    setLoadError(null);
    setFilter(DEFAULT_FILTER_STATE);
    setBiFilter(DEFAULT_BI_FILTER_STATE);
  }, []);

  const handleRestoreRepoCsv = useCallback(() => {
    setFilter(DEFAULT_FILTER_STATE);
    setBiFilter(DEFAULT_BI_FILTER_STATE);
    void loadRepoCsv();
  }, [loadRepoCsv]);

  const handleToggleNormalizeTools = useCallback(() => {
    setFilter((prev) => ({
      ...prev,
      normalizeTools: !prev.normalizeTools,
      tools: [],
    }));
    setBiFilter((prev) => ({
      ...prev,
      tools: [],
    }));
  }, []);

  const handleToggleInvertItem16 = useCallback(() => {
    setFilter((prev) => ({
      ...prev,
      invertItem16: !prev.invertItem16,
    }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilter((prev) => ({
      ...prev,
      seniorities: [],
      tools: [],
      frequencies: [],
    }));
  }, []);

  const hasActiveFilter =
    filter.seniorities.length > 0 ||
    filter.tools.length > 0 ||
    filter.frequencies.length > 0;

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F6F3] text-[#142027]">
      <HeaderBar
        sourceLabel={sourceLabel}
        isCustomCsv={isCustomCsv}
        totalRaw={result?.cleaning.totalRaw ?? 0}
        totalValid={result?.cleaning.totalValid ?? 0}
        normalizeTools={filter.normalizeTools}
        viewMode={viewMode}
        onChangeViewMode={handleChangeViewMode}
        onToggleNormalizeTools={handleToggleNormalizeTools}
        onUploadCsv={handleUploadCsv}
        onRestoreRepoCsv={handleRestoreRepoCsv}
      />

      {viewMode === 'report' && result && (
        <FilterBar
          filter={filter}
          availableSeniorities={result.availableFilterOptions.seniorities}
          availableTools={
            filter.normalizeTools
              ? result.availableFilterOptions.toolsNormalized
              : result.availableFilterOptions.toolsRaw
          }
          availableFrequencies={result.availableFilterOptions.frequencies}
          baselineValidCount={result.baseline.validCount}
          filteredValidCount={result.filtered.validCount}
          lowSampleWarning={result.filtered.lowSampleWarning}
          onChangeFilter={setFilter}
          onClearFilters={handleClearFilters}
        />
      )}

      {viewMode === 'report' && (
        <TabNav activeTab={activeTab} onSelectTab={setActiveTab} />
      )}

      <main
        className={`mx-auto w-full max-w-[1440px] flex-1 px-4 sm:px-6 ${
          viewMode === 'dashboard' ? 'py-4' : 'py-6'
        }`}
      >
        {loading && (
          <div className="card-editorial p-8 text-center text-sm text-[#43535B]">
            Carregando e processando dados do survey (<code className="font-mono-tabular">/questions.csv</code>)...
          </div>
        )}

        {!loading && (loadError || analysis?.error) && (
          <Callout tone="danger" title="Falha ao carregar ou processar o CSV">
            <p>{loadError ?? analysis?.error}</p>
            <button
              type="button"
              onClick={handleRestoreRepoCsv}
              className="mt-2 rounded bg-[#1F4E8C] px-3 py-1 text-xs font-semibold text-white hover:bg-[#183E70]"
            >
              Tentar restaurar /questions.csv do repositório
            </button>
          </Callout>
        )}

        {!loading && result && viewMode === 'dashboard' && biSlice && (
          <BiDashboardPage
            result={result}
            slice={biSlice}
            biFilter={biFilter}
            onChangeBiFilter={setBiFilter}
            onResetBiFilter={() => setBiFilter(DEFAULT_BI_FILTER_STATE)}
            onSwitchToReport={(tab) => {
              if (tab) setActiveTab(tab);
              handleChangeViewMode('report');
            }}
          />
        )}

        {!loading && result && viewMode === 'report' && (
          <div
            role="tabpanel"
            id={`panel-${activeTab}`}
            aria-labelledby={`tab-${activeTab}`}
          >
            {activeTab === 'overview' && (
              <OverviewPage result={result} hasActiveFilter={hasActiveFilter} />
            )}
            {activeTab === 'likert' && (
              <LikertPage
                result={result}
                invertItem16={filter.invertItem16}
                onToggleInvertItem16={handleToggleInvertItem16}
              />
            )}
            {activeTab === 'reliability' && (
              <ReliabilityPage result={result} hasActiveFilter={hasActiveFilter} />
            )}
            {activeTab === 'confirmatory' && (
              <ConfirmatoryPage result={result} hasActiveFilter={hasActiveFilter} />
            )}
            {activeTab === 'open_exploratory' && (
              <OpenExploratoryPage result={result} />
            )}
            {activeTab === 'methodology' && (
              <MethodologyPage result={result} />
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-[#D5DDD6] bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-2 px-4 py-3 text-[11px] text-[#5C6D75] sm:px-6">
          <span>
            Protocolo de Survey Pré-Registrado: Qualidade e Velocidade com Assistentes de IA · PUC Minas (2026/2)
          </span>
          <span className="font-mono-tabular">
            Análise não paramétrica · Bootstrap determinístico (B = 5.000) · Processamento 100% client-side
          </span>
        </div>
      </footer>
    </div>
  );
}

export default App;
