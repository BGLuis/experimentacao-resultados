import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Filter, Info, RotateCw } from 'lucide-react';
import type { FilterState, SeniorityLevel } from '../stats/types';
import { Callout } from './UiPrimitives';

interface MultiSelectDropdownProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}

function MultiSelectDropdown({ label, options, selected, onChange }: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const toggleValue = (val: string) => {
    if (selected.includes(val)) {
      onChange(selected.filter((item) => item !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  const summary =
    selected.length === 0
      ? 'Todos'
      : selected.length === 1
      ? selected[0]
      : `${selected.length} selecionados`;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition-colors ${
          selected.length > 0
            ? 'border-[#1F4E8C] bg-[#E8EFF8] font-semibold text-[#1F4E8C]'
            : 'border-[#D5DDD6] bg-white font-medium text-[#142027] hover:bg-[#EDF1EC]'
        }`}
      >
        <span className="text-[#5C6D75] font-medium">{label}:</span>
        <span className="max-w-[160px] truncate">{summary}</span>
        <ChevronDown className="h-3.5 w-3.5 opacity-75" aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1.5 w-64 rounded-lg border border-[#D5DDD6] bg-white p-2 shadow-lg">
          <div className="mb-1.5 flex items-center justify-between border-b border-[#EDF1EC] px-1.5 pb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5C6D75]">
              {label}
            </span>
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-[11px] font-semibold text-[#1F4E8C] hover:underline"
              >
                Todos
              </button>
            )}
          </div>
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {options.map((opt) => {
              const checked = selected.includes(opt);
              return (
                <label
                  key={opt}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs text-[#142027] hover:bg-[#EDF1EC]"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleValue(opt)}
                    className="h-3.5 w-3.5 rounded border-[#5C6D75] accent-[#1F4E8C]"
                  />
                  <span className="truncate">{opt}</span>
                </label>
              );
            })}
            {options.length === 0 && (
              <div className="px-2 py-1.5 text-xs text-[#5C6D75]">Nenhuma opção disponível</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface FilterBarProps {
  filter: FilterState;
  availableSeniorities: SeniorityLevel[];
  availableTools: string[];
  availableFrequencies: string[];
  baselineValidCount: number;
  filteredValidCount: number;
  lowSampleWarning: boolean;
  onChangeFilter: (next: FilterState) => void;
  onClearFilters: () => void;
}

export function FilterBar({
  filter,
  availableSeniorities,
  availableTools,
  availableFrequencies,
  baselineValidCount,
  filteredValidCount,
  lowSampleWarning,
  onChangeFilter,
  onClearFilters,
}: FilterBarProps) {
  const hasActiveFilter =
    filter.seniorities.length > 0 ||
    filter.tools.length > 0 ||
    filter.frequencies.length > 0;

  return (
    <div className="border-b border-[#D5DDD6] bg-[#EDF1EC]/75">
      <div className="mx-auto max-w-[1440px] px-4 py-2.5 sm:px-6 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#43535B]">
              <Filter className="h-3.5 w-3.5 text-[#1F4E8C]" aria-hidden="true" />
              Filtros globais
            </span>

            <MultiSelectDropdown
              label="Senioridade (M_SEN)"
              options={availableSeniorities}
              selected={filter.seniorities}
              onChange={(next) =>
                onChangeFilter({
                  ...filter,
                  seniorities: next as SeniorityLevel[],
                })
              }
            />

            <MultiSelectDropdown
              label="Ferramenta (M_TOOL)"
              options={availableTools}
              selected={filter.tools}
              onChange={(next) =>
                onChangeFilter({
                  ...filter,
                  tools: next,
                })
              }
            />

            <MultiSelectDropdown
              label="Frequência (M_USO)"
              options={availableFrequencies}
              selected={filter.frequencies}
              onChange={(next) =>
                onChangeFilter({
                  ...filter,
                  frequencies: next,
                })
              }
            />

            {hasActiveFilter && (
              <button
                type="button"
                onClick={onClearFilters}
                className="inline-flex items-center gap-1 rounded-lg border border-[#D5DDD6] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#B83B3B] hover:bg-[#FBEAEA]"
              >
                <RotateCw className="h-3 w-3" aria-hidden="true" />
                Limpar filtros
              </button>
            )}
          </div>

          <div className="font-mono-tabular text-xs text-[#43535B]">
            Subamostra visível:{' '}
            <strong className="text-[#142027]">{filteredValidCount}</strong> /{' '}
            <span>{baselineValidCount}</span> válidas
          </div>
        </div>

        {hasActiveFilter && (
          <div className="flex items-start gap-2 rounded-lg border border-[#B6CBE6] bg-[#E8EFF8]/70 px-3 py-2 text-xs text-[#142027]">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1F4E8C]" aria-hidden="true" />
            <span>
              <strong>Filtro ativo (proteção anti-p-hacking):</strong> os filtros afetam apenas{' '}
              <em>visões descritivas e exploratórias</em> (<strong className="font-mono-tabular">n = {filteredValidCount}</strong>). Os{' '}
              <strong>testes confirmatórios pré-registrados (QP3 e QP4)</strong> permanecem ancorados na amostra válida integral (
              <strong className="font-mono-tabular">n = {baselineValidCount}</strong>).
            </span>
          </div>
        )}

        {hasActiveFilter && lowSampleWarning && (
          <Callout
            tone="warning"
            title={`Alerta de subgrupo pequeno (n = ${filteredValidCount} < 5)`}
          >
            O subgrupo selecionado possui menos de 5 respondentes válidos. Medianas, intervalos de Wilson e indicadores exploratórios apresentam alta instabilidade amostral.
          </Callout>
        )}
      </div>
    </div>
  );
}
