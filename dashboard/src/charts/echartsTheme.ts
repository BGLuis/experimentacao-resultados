import { COLORS } from '../utils/format';

export const FONT_SANS = 'IBM Plex Sans';
export const FONT_MONO = 'IBM Plex Mono';

export const SPLIT_LINE_STYLE = { lineStyle: { color: '#EDF1EC' } } as const;
export const AXIS_LINE_STYLE = { lineStyle: { color: COLORS.border } } as const;

export function makeMonoAxisLabel(fontSize = 10, color: string = COLORS.textMuted) {
  return { fontFamily: FONT_MONO, fontSize, color };
}

export function makeSansAxisLabel(
  fontSize = 11,
  options?: {
    fontWeight?: number;
    color?: string;
    width?: number;
    overflow?: 'truncate';
    interval?: number;
  }
) {
  return {
    fontFamily: FONT_SANS,
    fontSize,
    color: options?.color ?? COLORS.textPrimary,
    ...(options?.fontWeight !== undefined ? { fontWeight: options.fontWeight } : {}),
    ...(options?.width !== undefined ? { width: options.width } : {}),
    ...(options?.overflow !== undefined ? { overflow: options.overflow } : {}),
    ...(options?.interval !== undefined ? { interval: options.interval } : {}),
  };
}

export function tooltipCard(innerHtml: string, maxWidth?: number): string {
  const widthCss = maxWidth ? `max-width:${maxWidth}px;white-space:normal;` : '';
  return `<div style="font-family:'IBM Plex Sans',sans-serif;font-size:12px;${widthCss}">${innerHtml}</div>`;
}

export function monoSpan(
  text: string,
  options?: { bold?: boolean; color?: string; sizePx?: number }
): string {
  const tag = options?.bold ? 'strong' : 'span';
  const colorCss = options?.color ? `color:${options.color};` : '';
  const sizeCss = options?.sizePx ? `font-size:${options.sizePx}px;` : '';
  return `<${tag} style="font-family:'IBM Plex Mono',monospace;${colorCss}${sizeCss}">${text}</${tag}>`;
}
