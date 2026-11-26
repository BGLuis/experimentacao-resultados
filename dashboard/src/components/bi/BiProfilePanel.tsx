import { useMemo, useState } from 'react';
import type { ECElementEvent, EChartsOption } from 'echarts';
import { ArrowUpRight } from 'lucide-react';
import { EChart } from '../EChart';
import type { TabId } from '../TabNav';
import { Badge } from '../UiPrimitives';
import {
  FREQUENCY_SHORT_LABELS,
  buildProfileFacetBarsOption,
  toggleArrayItem,
  type BiDashboardSlice,
  type BiFacetBarItem,
  type BiFilterState,
  type SeniorityLevel,
} from '../../stats';
import { COLORS, SENIORITY_COLORS, fmtPct } from '../../utils/format';

export interface BiProfilePanelProps {
  slice: BiDashboardSlice;
  biFilter: BiFilterState;
  onChangeBiFilter: (next: BiFilterState) => void;
  onChartClick: (params: ECElementEvent) => void;
  onSwitchToReport: (tab?: TabId) => void;
}

type ProfileDimensionView = 'all' | 'seniorities' | 'tools' | 'frequencies';

function FacetBarList({
  title,
  items,
  maxCount,
  resolveColor,
  shortLabels,
  columns = 1,
  onToggle,
}: {
  title: string;
  items: BiFacetBarItem[];
  maxCount: number;
  resolveColor: (id: string) => string;
  shortLabels?: Record<string, string>;
  columns?: 1 | 2;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[#5C6D75]">
        {title}
      </div>
      <div className={columns === 2 ? 'grid grid-cols-2 gap-1.5' : 'space-y-1'}>
        {items.map((item) => {
          const widthPct =
            maxCount > 0
              ? Math.max(item.count > 0 ? 6 : 0, (item.count / maxCount) * 100)
              : 0;
          const displayLabel = shortLabels?.[item.label] ?? item.label;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onToggle(item.id)}
              aria-pressed={item.selected}
              title={`${item.label}: ${item.count} (${fmtPct(item.pct, 1)})`}
              className={`group w-full rounded-md border px-2 py-1 text-left transition-all ${
                item.selected
                  ? 'border-[#142027] bg-[#E8EFF8]/70 shadow-[0_0_0_1px_#142027]'
                  : item.dimmed
                    ? 'border-[#E5ECE6] bg-[#F4F6F3] hover:border-[#B6CBE6] hover:bg-[#F3F7FB]'
                    : 'border-transparent bg-[#FAFBF9] hover:border-[#B6CBE6] hover:bg-[#F3F7FB]'
              }`}
            >
              <div className="flex items-center justify-between gap-1.5 text-[11px]">
                <span className="truncate font-medium text-[#142027]">
                  {displayLabel}
                </span>
                <span className="shrink-0 font-mono-tabular text-[10px] font-semibold text-[#43535B]">
                  {item.count}{' '}
                  <span className="text-[#5C6D75]">({fmtPct(item.pct, 0)})</span>
                </span>
              </div>
              <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-[#E5ECE6]">
                <div
                  className={`h-full rounded-full transition-all ${
                    item.dimmed ? 'opacity-35' : ''
                  }`}
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor: resolveColor(item.id),
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function BiProfilePanel({
  slice,
  biFilter,
  onChangeBiFilter,
  onChartClick,
  onSwitchToReport,
}: BiProfilePanelProps) {
  const [profileView, setProfileView] = useState<ProfileDimensionView>('all');

  const profileSingleOption = useMemo<EChartsOption | null>(() => {
    if (profileView === 'seniorities') {
      return buildProfileFacetBarsOption({
        dimensionLabel: 'Senioridade (M_SEN)',
        items: slice.facetProfiles.seniorities,
        dimensionKind: 'seniority',
      });
    }
    if (profileView === 'tools') {
      return buildProfileFacetBarsOption({
        dimensionLabel: 'Ferramenta (M_TOOL)',
        items: slice.facetProfiles.tools,
        dimensionKind: 'tool',
      });
    }
    if (profileView === 'frequencies') {
      return buildProfileFacetBarsOption({
        dimensionLabel: 'Frequência (M_USO)',
        items: slice.facetProfiles.frequencies,
        dimensionKind: 'frequency',
      });
    }
    return null;
  }, [profileView, slice.facetProfiles]);

  const senMaxCount = Math.max(1, ...slice.facetProfiles.seniorities.map((i) => i.count));
  const freqMaxCount = Math.max(1, ...slice.facetProfiles.frequencies.map((i) => i.count));
  const toolMaxCount = Math.max(1, ...slice.facetProfiles.tools.map((i) => i.count));

  const viewTabs = [
    { id: 'all' as const, label: '3D', activeCount: 0 },
    { id: 'seniorities' as const, label: 'SEN', activeCount: biFilter.seniorities.length },
    { id: 'tools' as const, label: 'TOOL', activeCount: biFilter.tools.length },
    { id: 'frequencies' as const, label: 'USO', activeCount: biFilter.frequencies.length },
  ];

  return (
    <article className="card-editorial flex flex-col p-3.5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-[#EDF1EC] pb-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <h2 className="truncate text-sm font-semibold text-[#142027]">
            Perfil &amp; Adoção
          </h2>
          <Badge variant="descriptive" className="px-1.5 py-0 text-[10px]">
            M_SEN · M_TOOL · M_USO
          </Badge>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <div
            role="group"
            aria-label="Dimensão do perfil"
            className="inline-flex rounded-md border border-[#D5DDD6] bg-[#EDF1EC] p-0.5 text-[10px] font-semibold"
          >
            {viewTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                aria-pressed={profileView === tab.id}
                onClick={() => setProfileView(tab.id)}
                className={`rounded px-1.5 py-0.5 transition-colors ${
                  profileView === tab.id
                    ? 'bg-white text-[#1F4E8C] shadow-xs'
                    : 'text-[#43535B] hover:text-[#142027]'
                }`}
              >
                {tab.label}
                {tab.activeCount > 0 ? `(${tab.activeCount})` : ''}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onSwitchToReport('overview')}
            title="Ver amostra detalhada no Relatório"
            aria-label="Ver amostra detalhada no Relatório"
            className="rounded p-1 text-[#5C6D75] hover:bg-[#EDF1EC] hover:text-[#1F4E8C]"
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {profileView === 'all' ? (
        <div className="h-[255px] space-y-2.5 overflow-y-auto pr-0.5">
          <div className="grid grid-cols-2 gap-2.5">
            <FacetBarList
              title="Senioridade (M_SEN)"
              items={slice.facetProfiles.seniorities}
              maxCount={senMaxCount}
              resolveColor={(id) => SENIORITY_COLORS[id as SeniorityLevel] ?? COLORS.primary}
              onToggle={(id) =>
                onChangeBiFilter({
                  ...biFilter,
                  seniorities: toggleArrayItem(biFilter.seniorities, id as SeniorityLevel),
                })
              }
            />
            <FacetBarList
              title="Frequência (M_USO)"
              items={slice.facetProfiles.frequencies}
              maxCount={freqMaxCount}
              resolveColor={() => COLORS.success}
              shortLabels={FREQUENCY_SHORT_LABELS}
              onToggle={(id) =>
                onChangeBiFilter({
                  ...biFilter,
                  frequencies: toggleArrayItem(biFilter.frequencies, id),
                })
              }
            />
          </div>
          <FacetBarList
            title="Ferramenta Principal (M_TOOL)"
            items={slice.facetProfiles.tools}
            maxCount={toolMaxCount}
            resolveColor={() => COLORS.primary}
            columns={2}
            onToggle={(id) =>
              onChangeBiFilter({
                ...biFilter,
                tools: toggleArrayItem(biFilter.tools, id),
              })
            }
          />
        </div>
      ) : (
        profileSingleOption && (
          <EChart
            option={profileSingleOption}
            height={255}
            ariaLabel="Gráfico interativo de perfil e adoção"
            onChartClick={onChartClick}
          />
        )
      )}
    </article>
  );
}
