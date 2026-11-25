import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';

interface EChartProps {
  option: EChartsOption;
  height?: number;
  ariaLabel: string;
  className?: string;
}

export function EChart({ option, height = 340, ariaLabel, className = '' }: EChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = echarts.init(el, undefined, { renderer: 'svg' });
    chartRef.current = chart;

    const observer = new ResizeObserver(() => {
      if (chartRef.current && !chartRef.current.isDisposed()) {
        chartRef.current.resize();
      }
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
      if (!chart.isDisposed()) {
        chart.dispose();
      }
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || chart.isDisposed()) return;
    chart.setOption(option, { notMerge: true, lazyUpdate: false });
  }, [option]);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={ariaLabel}
      className={`w-full overflow-hidden ${className}`}
      style={{ height: `${height}px` }}
    />
  );
}
