import type { ConfidenceInterval, SeniorityLevel } from '../stats/types';

export const COLORS = {
  canvas: '#F4F6F3',
  surface: '#FFFFFF',
  subtle: '#EDF1EC',
  border: '#D5DDD6',
  textPrimary: '#142027',
  textSecondary: '#43535B',
  textMuted: '#5C6D75',
  primary: '#1F4E8C',
  success: '#2F7A5C',
  warning: '#B8721F',
  danger: '#B83B3B',
  neutralSlate: '#64748B',
} as const;

export const LIKERT_COLORS = {
  1: '#B83B3B',
  2: '#E08B6B',
  3: '#CBD5E1',
  4: '#5B9BD5',
  5: '#1F4E8C',
  NA: '#94A3B8',
} as const;

export const SENIORITY_COLORS: Record<SeniorityLevel, string> = {
  Júnior: '#B8721F',
  Pleno: '#5B9BD5',
  Sênior: '#1F4E8C',
};

export function fmtNum(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtInt(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return Math.round(value).toLocaleString('pt-BR');
}

export function fmtPct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${fmtNum(value, digits)}%`;
}

export function fmtPValue(p: number | null | undefined): string {
  if (p === null || p === undefined || Number.isNaN(p)) return '—';
  if (p < 0.0001) return '< 0,0001';
  return p.toLocaleString('pt-BR', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

export function fmtCI(
  ci: ConfidenceInterval | null | undefined,
  digits = 2,
  suffix = ''
): string {
  if (!ci || Number.isNaN(ci.lower) || Number.isNaN(ci.upper)) return '—';
  return `[${fmtNum(ci.lower, digits)}${suffix}; ${fmtNum(ci.upper, digits)}${suffix}]`;
}

export function fmtModes(modes: number[]): string {
  if (!modes || modes.length === 0) return '—';
  return modes.map((m) => fmtNum(m, Number.isInteger(m) ? 0 : 2)).join(', ');
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
