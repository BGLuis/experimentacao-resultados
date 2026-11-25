import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  BookOpenCheck,
  FileText,
  FlaskConical,
  LayoutDashboard,
  ShieldCheck,
} from 'lucide-react';

export type TabId =
  | 'overview'
  | 'likert'
  | 'reliability'
  | 'confirmatory'
  | 'open_exploratory'
  | 'methodology';

export interface TabDefinition {
  id: TabId;
  step: number;
  shortLabel: string;
  fullLabel: string;
  Icon: LucideIcon;
}

export const TABS: TabDefinition[] = [
  {
    id: 'overview',
    step: 1,
    shortLabel: 'Visão Geral & Amostra',
    fullLabel: '1. Visão Geral & Amostra',
    Icon: LayoutDashboard,
  },
  {
    id: 'likert',
    step: 2,
    shortLabel: 'QP1 & QP2 (Likert)',
    fullLabel: '2. QP1 & QP2 (Likert)',
    Icon: BarChart3,
  },
  {
    id: 'reliability',
    step: 3,
    shortLabel: 'Confiabilidade',
    fullLabel: '3. Confiabilidade',
    Icon: ShieldCheck,
  },
  {
    id: 'confirmatory',
    step: 4,
    shortLabel: 'QP3 & QP4 (Confirmatórias)',
    fullLabel: '4. QP3 & QP4 (Confirmatórias)',
    Icon: FlaskConical,
  },
  {
    id: 'open_exploratory',
    step: 5,
    shortLabel: 'Abertas & Exploratórias',
    fullLabel: '5. Abertas & Exploratórias',
    Icon: BookOpenCheck,
  },
  {
    id: 'methodology',
    step: 6,
    shortLabel: 'Metodologia, Desvios & Dados',
    fullLabel: '6. Metodologia, Desvios & Dados',
    Icon: FileText,
  },
];

interface TabNavProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
}

export function TabNav({ activeTab, onSelectTab }: TabNavProps) {
  return (
    <nav
      aria-label="Seções analíticas do dashboard"
      className="border-b border-[#D5DDD6] bg-[#FFFFFF] sticky top-0 z-20 shadow-[0_1px_2px_rgba(20,32,39,0.03)]"
    >
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6">
        <div
          role="tablist"
          aria-label="Abas do estudo"
          className="flex gap-1 overflow-x-auto py-1.5 no-scrollbar"
        >
          {TABS.map(({ id, step, shortLabel, Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                role="tab"
                type="button"
                aria-selected={active}
                id={`tab-${id}`}
                aria-controls={`panel-${id}`}
                onClick={() => onSelectTab(id)}
                className={`group inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors sm:text-sm ${
                  active
                    ? 'bg-[#1F4E8C] text-white shadow-xs'
                    : 'text-[#43535B] hover:bg-[#EDF1EC] hover:text-[#142027]'
                }`}
              >
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full font-mono-tabular text-[11px] font-bold ${
                    active
                      ? 'bg-white/20 text-white'
                      : 'bg-[#EDF1EC] text-[#43535B] group-hover:bg-[#D5DDD6]'
                  }`}
                >
                  {step}
                </span>
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="whitespace-nowrap">{shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
