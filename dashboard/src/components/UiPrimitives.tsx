import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';

export type BadgeVariant =
  | 'confirmatory'
  | 'exploratory'
  | 'descriptive'
  | 'success'
  | 'warning'
  | 'danger'
  | 'neutral';

const BADGE_CLASSES: Record<BadgeVariant, string> = {
  confirmatory:
    'bg-[#E8EFF8] text-[#1F4E8C] border-[#B6CBE6]',
  exploratory:
    'bg-[#EDF1EC] text-[#43535B] border-[#C5D1C7]',
  descriptive:
    'bg-[#F1F5F9] text-[#334155] border-[#CBD5E1]',
  success:
    'bg-[#E8F4EE] text-[#2F7A5C] border-[#B5DAC8]',
  warning:
    'bg-[#FBF2E4] text-[#8E5512] border-[#E8CAA0]',
  danger:
    'bg-[#FBEAEA] text-[#9A2E2E] border-[#E7BBBB]',
  neutral:
    'bg-[#F8FAF8] text-[#43535B] border-[#D5DDD6]',
};

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

export function Badge({ variant = 'neutral', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-tight ${BADGE_CLASSES[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  badge?: { label: string; variant: BadgeVariant };
  rightSlot?: ReactNode;
}

export function SectionHeader({ title, subtitle, badge, rightSlot }: SectionHeaderProps) {
  return (
    <div className="flex flex-col gap-2 border-b border-[#D5DDD6] pb-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold tracking-tight text-[#142027]">{title}</h2>
          {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
        </div>
        {subtitle && <p className="text-sm text-[#43535B] leading-relaxed">{subtitle}</p>}
      </div>
      {rightSlot && <div className="flex flex-wrap items-center gap-2 shrink-0">{rightSlot}</div>}
    </div>
  );
}

type AccentTone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

const TONE_ACCENT: Record<AccentTone, string> = {
  primary: 'border-t-[#1F4E8C]',
  success: 'border-t-[#2F7A5C]',
  warning: 'border-t-[#B8721F]',
  danger: 'border-t-[#B83B3B]',
  neutral: 'border-t-[#5C6D75]',
};

interface KpiCardProps {
  label: string;
  value: string;
  detail?: string;
  subdetail?: string;
  tone?: AccentTone;
  badge?: { label: string; variant: BadgeVariant };
}

export function KpiCard({
  label,
  value,
  detail,
  subdetail,
  tone = 'primary',
  badge,
}: KpiCardProps) {
  return (
    <div
      className={`card-editorial border-t-[3px] ${TONE_ACCENT[tone]} flex flex-col justify-between p-4 transition-shadow hover:shadow-sm`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#5C6D75]">
          {label}
        </span>
        {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
      </div>
      <div className="mt-2 font-mono-tabular text-2xl font-semibold tracking-tight text-[#142027]">
        {value}
      </div>
      {(detail || subdetail) && (
        <div className="mt-1.5 space-y-0.5 text-xs text-[#43535B]">
          {detail && <div className="font-medium">{detail}</div>}
          {subdetail && <div className="text-[#5C6D75] font-mono-tabular">{subdetail}</div>}
        </div>
      )}
    </div>
  );
}

interface CalloutProps {
  tone: 'info' | 'success' | 'warning' | 'danger';
  title: string;
  children: ReactNode;
  className?: string;
}

const CALLOUT_STYLES: Record<CalloutProps['tone'], { box: string; iconColor: string; Icon: typeof Info }> = {
  info: {
    box: 'bg-[#E8EFF8]/70 border-[#B6CBE6] text-[#142027]',
    iconColor: 'text-[#1F4E8C]',
    Icon: Info,
  },
  success: {
    box: 'bg-[#E8F4EE]/80 border-[#B5DAC8] text-[#142027]',
    iconColor: 'text-[#2F7A5C]',
    Icon: CheckCircle2,
  },
  warning: {
    box: 'bg-[#FBF2E4] border-[#E8CAA0] text-[#142027]',
    iconColor: 'text-[#B8721F]',
    Icon: AlertTriangle,
  },
  danger: {
    box: 'bg-[#FBEAEA] border-[#E7BBBB] text-[#142027]',
    iconColor: 'text-[#B83B3B]',
    Icon: XCircle,
  },
};

export function Callout({ tone, title, children, className = '' }: CalloutProps) {
  const { box, iconColor, Icon } = CALLOUT_STYLES[tone];
  return (
    <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${box} ${className}`}>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconColor}`} aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="font-semibold text-[#142027]">{title}</div>
        <div className="text-xs leading-relaxed text-[#43535B]">{children}</div>
      </div>
    </div>
  );
}
