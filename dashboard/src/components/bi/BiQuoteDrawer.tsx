import { useEffect, useMemo, useRef } from 'react';
import { MessageSquareQuote, RotateCcw, X } from 'lucide-react';
import { Badge } from '../UiPrimitives';
import type { BiFilterState, DrawerQuoteEntry, SeniorityLevel } from '../../stats';

export interface BiQuoteDrawerProps {
  open: boolean;
  quotes: DrawerQuoteEntry[];
  biFilter: BiFilterState;
  validCount: number;
  riskMetaMap: ReadonlyMap<string, { label: string; description: string }>;
  benefitMetaMap: ReadonlyMap<string, { label: string; description: string }>;
  onClose: () => void;
  onClearThemesAndClose: () => void;
}

const SENIORITY_BADGE_CLASSES: Record<SeniorityLevel, string> = {
  Júnior: 'bg-[#FBF2E4] text-[#7A470E] border border-[#E8CAA0]',
  Pleno: 'bg-[#E8EFF8] text-[#183E70] border border-[#B6CBE6]',
  Sênior: 'bg-[#1F4E8C] text-white border border-[#1F4E8C]',
};

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function BiQuoteDrawer({
  open,
  quotes,
  biFilter,
  validCount,
  riskMetaMap,
  benefitMetaMap,
  onClose,
  onClearThemesAndClose,
}: BiQuoteDrawerProps) {
  const drawerRef = useRef<HTMLElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      closeBtnRef.current?.focus();
    } else if (!open && wasOpenRef.current) {
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    }
    wasOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key !== 'Tab') return;
      const container = drawerRef.current;
      if (!container) return;

      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => el.getClientRects().length > 0);

      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (active === first || !active || !container.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !active || !container.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const hasThemeFilters =
    biFilter.riskThemes.length > 0 || biFilter.benefitThemes.length > 0;

  const activeThemeSummary = useMemo(() => {
    if (!hasThemeFilters) {
      return `Todos os relatos substantivos na fatia ativa (n = ${validCount})`;
    }
    const parts = [
      ...biFilter.riskThemes.map(
        (id) => `Risco: ${riskMetaMap.get(id)?.label ?? id}`
      ),
      ...biFilter.benefitThemes.map(
        (id) => `Benefício: ${benefitMetaMap.get(id)?.label ?? id}`
      ),
    ];
    return parts.join(' · ');
  }, [
    hasThemeFilters,
    validCount,
    biFilter.riskThemes,
    biFilter.benefitThemes,
    riskMetaMap,
    benefitMetaMap,
  ]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Relatos literais da amostra filtrada"
    >
      <div
        className="fixed inset-0 bg-[#142027]/35 backdrop-blur-[1px]"
        onClick={onClose}
      />

      <aside
        ref={drawerRef}
        className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-[#D5DDD6] bg-white shadow-2xl"
      >
        <div className="border-b border-[#D5DDD6] bg-[#FAFBF9] px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <MessageSquareQuote
                  className="h-4 w-4 text-[#1F4E8C]"
                  aria-hidden="true"
                />
                <h3 className="text-sm font-bold text-[#142027]">
                  Relatos Literais
                </h3>
                <Badge
                  variant="neutral"
                  className="px-1.5 py-0 font-mono-tabular text-[10px]"
                >
                  {quotes.length}
                </Badge>
              </div>
              <p className="truncate text-xs text-[#43535B]" title={activeThemeSummary}>
                {activeThemeSummary}
              </p>
            </div>

            <button
              ref={closeBtnRef}
              type="button"
              onClick={onClose}
              aria-label="Fechar painel de relatos"
              className="rounded-lg p-1.5 text-[#5C6D75] hover:bg-[#EDF1EC] hover:text-[#142027]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {hasThemeFilters && (
            <div className="mt-2.5 flex items-center justify-between gap-2 rounded-lg border border-[#D5DDD6] bg-white px-2.5 py-1.5">
              <span className="text-[11px] text-[#5C6D75]">
                Filtro de tema ativo nos painéis
              </span>
              <button
                type="button"
                onClick={onClearThemesAndClose}
                className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold text-[#9A2E2E] hover:bg-[#FBEAEA]"
              >
                <RotateCcw className="h-3 w-3" aria-hidden="true" />
                Limpar filtro de tema e fechar
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 space-y-2.5 overflow-y-auto p-4">
          {quotes.map(({ type, response }, idx) => (
            <div
              key={`${type}-${response.rowNumber}-${idx}`}
              className="space-y-1.5 rounded-lg border border-[#D5DDD6] bg-[#FAFBF9] p-3 text-xs"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant={type === 'risk' ? 'danger' : 'success'}>
                  {type === 'risk' ? 'Risco (ITEM_21)' : 'Benefício (ITEM_22)'}
                </Badge>
                <span className="font-mono-tabular font-semibold text-[#142027]">
                  {response.idLabel}
                </span>
                <span
                  className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${SENIORITY_BADGE_CLASSES[response.seniority]}`}
                >
                  {response.seniority}
                </span>
                <span className="text-[11px] text-[#5C6D75]">{response.tool}</span>
              </div>

              <p className="leading-relaxed text-[#142027]">
                &ldquo;{response.rawText}&rdquo;
              </p>

              {response.themeLabels.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {response.themeLabels.map((lbl) => (
                    <Badge
                      key={lbl}
                      variant="neutral"
                      className="px-2 py-0 text-[10px]"
                    >
                      {lbl}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ))}

          {quotes.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#D5DDD6] bg-[#FAFBF9] px-4 py-10 text-center">
              <MessageSquareQuote
                className="h-6 w-6 text-[#5C6D75]"
                aria-hidden="true"
              />
              <p className="text-xs font-medium text-[#43535B]">
                Nenhum relato substantivo corresponde à combinação atual de filtros.
              </p>
              {hasThemeFilters && (
                <button
                  type="button"
                  onClick={onClearThemesAndClose}
                  className="mt-1 rounded-lg bg-[#1F4E8C] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#183E70]"
                >
                  Limpar filtro de tema e fechar
                </button>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
