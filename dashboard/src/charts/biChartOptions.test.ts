import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BI_FILTER_STATE,
  analyzeBiDashboardSlice,
  analyzeSurveyCsv,
  buildConstructDumbbellOption,
  buildFullDumbbellProfileOption,
  buildPairedThemeButterflyOption,
  buildProfileFacetBarsOption,
  buildQp4JointMatrixOption,
  buildRaincloudOption,
  buildSankeyData,
  buildSankeyOption,
  computeDumbbellSummaries,
  extractClickTarget,
} from '../stats';
import type { GroupSummary } from '../stats/types';

const REAL_CSV_PATH = resolve(process.cwd(), '../questions.csv');
const realCsvText = readFileSync(REAL_CSV_PATH, 'utf-8');

describe('BI ECharts Option Builders', () => {
  const baseResult = analyzeSurveyCsv(realCsvText);

  it('constrói Raincloud com omissão de KDE para n=0/sd=0, clickTarget e dimming (TE-1)', () => {
    const syntheticGroups: GroupSummary[] = [
      {
        group: 'Júnior',
        n: 0,
        median: null,
        q1: null,
        q3: null,
        iqr: null,
        mad: null,
        min: null,
        max: null,
        values: [],
      },
      {
        group: 'Pleno',
        n: 4,
        median: 4,
        q1: 4,
        q3: 4,
        iqr: 0,
        mad: 0,
        min: 4,
        max: 4,
        values: [4, 4, 4, 4],
      },
      {
        group: 'Sênior',
        n: 8,
        median: 4,
        q1: 3.375,
        q3: 4.625,
        iqr: 1.25,
        mad: 0.5,
        min: 2,
        max: 5,
        values: [2, 3, 3.5, 4, 4, 4.5, 5, 5],
      },
    ];

    const opt = buildRaincloudOption({
      groups: syntheticGroups,
      selectedSeniorities: ['Sênior'],
      compact: true,
    });
    const series = opt.series as Array<{
      name: string;
      data: Array<{
        groupName: string;
        dimmed?: boolean;
        itemStyle?: { opacity?: number };
      }>;
    }>;

    expect(series).toHaveLength(3);
    // KDE omits n=0 (Júnior) and sd=0 (Pleno) -> only Sênior remains
    expect(series[0].data).toHaveLength(1);
    expect(series[0].data[0].groupName).toBe('Sênior');
    expect(extractClickTarget({ data: series[0].data[0] })).toEqual({
      kind: 'seniority',
      value: 'Sênior',
    });

    // Scatter keeps 4 + 8 = 12 points; unselected group is dimmed (< 0.5)
    expect(series[1].data).toHaveLength(12);
    const plenoScatter = series[1].data.find((d) => d.groupName === 'Pleno');
    expect(plenoScatter?.itemStyle?.opacity).toBeLessThan(0.5);
    expect(extractClickTarget({ data: plenoScatter })).toEqual({
      kind: 'seniority',
      value: 'Pleno',
    });

    // Summary contains sd=0 (Pleno) and normal (Sênior), omits n=0 (Júnior)
    expect(series[2].data).toHaveLength(2);
    const plenoSummary = series[2].data.find((d) => d.groupName === 'Pleno');
    expect(plenoSummary?.dimmed).toBe(true);
    expect(plenoSummary?.itemStyle?.opacity).toBeLessThan(0.5);
    expect(extractClickTarget({ data: plenoSummary })).toEqual({
      kind: 'seniority',
      value: 'Pleno',
    });

    // Merged group emits seniorityPair clickTarget
    const mergedOpt = buildRaincloudOption({
      groups: baseResult.baseline.qp3.cVelMannWhitneyMerged?.groups ?? [],
      selectedSeniorities: ['Sênior'],
    });
    const mergedSeries = mergedOpt.series as Array<{ data: Array<{ groupName: string }> }>;
    const jrPlItem = mergedSeries[2].data.find((d) => d.groupName === 'Júnior + Pleno');
    expect(extractClickTarget({ data: jrPlItem })).toEqual({
      kind: 'seniorityPair',
      seniorities: ['Júnior', 'Pleno'],
    });
  });

  it('constrói matriz QP4 com dimming por activeCQualTiers, contraste em bolha Pleno e vazio (TE-5)', () => {
    const matrixOpt = buildQp4JointMatrixOption({
      scatterPoints: [
        ...baseResult.baseline.qp4.scatterPoints,
        {
          idLabel: 'R_PL1',
          rowNumber: 101,
          seniority: 'Pleno',
          mRev: 3.0,
          cQual: 4.2,
          tool: 'Kiro',
          frequency: 'Todos os dias úteis',
        },
        {
          idLabel: 'R_PL2',
          rowNumber: 102,
          seniority: 'Pleno',
          mRev: 3.0,
          cQual: 4.2,
          tool: 'Kiro',
          frequency: 'Todos os dias úteis',
        },
      ],
      activeCQualTiers: ['high'],
    });

    expect(Array.isArray(matrixOpt.grid)).toBe(true);
    expect((matrixOpt.grid as Array<{ containLabel?: boolean }>).length).toBe(3);
    expect(
      (matrixOpt.grid as Array<{ containLabel?: boolean }>).every(
        (g) => g.containLabel === false
      )
    ).toBe(true);
    expect((matrixOpt.legend as { show?: boolean }).show).toBe(false);

    const matrixSeries = matrixOpt.series as Array<{
      name: string;
      data: Array<{
        cell?: { cQualTier: string; dominantSeniority: string; count: number };
        tierId?: string;
        dimmed?: boolean;
        itemStyle?: { opacity?: number };
        label?: { color?: string; textBorderColor?: string };
      }>;
    }>;

    const bubbleSeries = matrixSeries.find((s) => s.name === 'Matriz QP4');
    const dimmedBubble = bubbleSeries?.data.find((d) => d.cell?.cQualTier !== 'high');
    expect(dimmedBubble?.itemStyle?.opacity).toBeLessThan(0.5);

    const plenoBubble = bubbleSeries?.data.find(
      (d) => d.cell?.dominantSeniority === 'Pleno' && (d.cell?.count ?? 0) >= 2
    );
    expect(plenoBubble?.label?.color).toBe('#142027');
    expect(plenoBubble?.label?.textBorderColor).toBe('#FFFFFF');

    const cQualMarginal = matrixSeries.find((s) => s.name === 'Marginal C_QUAL');
    const lowMarginal = cQualMarginal?.data.find((d) => d.tierId === 'low');
    expect(lowMarginal?.dimmed).toBe(true);

    const emptyMatrixOpt = buildQp4JointMatrixOption({ scatterPoints: [] });
    expect(Array.isArray(emptyMatrixOpt.series)).toBe(true);
  });

  it('constrói opções Dumbbell compacta/completa tratando linhas nulas e cliques (TE-2)', () => {
    const { constructRows, itemRows } = computeDumbbellSummaries(
      baseResult.cleaning.validRespondents,
      true
    );

    const rowsWithNull = constructRows.map((row) =>
      row.seniority === 'Júnior'
        ? {
            ...row,
            n: 0,
            cVelMedian: null,
            cQualMedian: null,
            gap: null,
            velGreaterCount: 0,
            velGreaterPct: 0,
          }
        : row
    );

    const compactOpt = buildConstructDumbbellOption({
      constructRows: rowsWithNull,
      selectedSeniorities: ['Sênior'],
    });
    const compactSeries = compactOpt.series as Array<{
      renderItem: (
        params: { dataIndex: number },
        api: { value: (idx: number) => number; coord: (val: [number, number]) => number[] }
      ) => { children: Array<{ type: string }> } | null;
      data: Array<{ seniority: string | null; dimmed: boolean; itemStyle: { opacity: number } }>;
    }>;

    expect(compactSeries).toHaveLength(1);
    const plenoRow = compactSeries[0].data.find((d) => d.seniority === 'Pleno');
    const seniorRow = compactSeries[0].data.find((d) => d.seniority === 'Sênior');
    expect(plenoRow?.dimmed).toBe(true);
    expect(plenoRow?.itemStyle.opacity).toBeLessThan(0.5);
    expect(seniorRow?.dimmed).toBe(false);
    expect(extractClickTarget({ data: seniorRow })).toEqual({
      kind: 'seniority',
      value: 'Sênior',
    });

    const juniorIdx = compactSeries[0].data.findIndex((d) => d.seniority === 'Júnior');
    const renderedJunior = compactSeries[0].renderItem(
      { dataIndex: juniorIdx },
      { value: () => juniorIdx, coord: ([x, y]) => [x * 40, y * 20] }
    );
    expect(renderedJunior?.children).toHaveLength(1);

    const fullOpt = buildFullDumbbellProfileOption({ constructRows, itemRows });
    const fullSeries = fullOpt.series as Array<{
      renderItem: (
        params: { dataIndex: number },
        api: {
          value: (idx: number) => number;
          coord: (val: [number, number]) => number[];
          size: (val: [number, number]) => number[];
        }
      ) => { children: Array<{ type: string }> } | null;
      data: Array<{ entry: { kind: string } }>;
    }>;

    expect(fullSeries[0].data).toHaveLength(constructRows.length + itemRows.length);
    const constructRender = fullSeries[0].renderItem(
      { dataIndex: itemRows.length },
      { value: () => itemRows.length, coord: ([x, y]) => [x * 40, y * 20], size: () => [0, 22] }
    );
    const itemRender = fullSeries[0].renderItem(
      { dataIndex: 0 },
      { value: () => 0, coord: ([x, y]) => [x * 40, y * 20], size: () => [0, 22] }
    );
    expect(constructRender?.children.length ?? 0).toBeGreaterThan(2);
    expect(itemRender?.children.length ?? 0).toBeGreaterThan(2);
    expect(
      extractClickTarget({ data: fullSeries[0].data[fullSeries[0].data.length - 2] })
    ).toEqual({ kind: 'seniority', value: 'Sênior' });
  });

  it('constrói opção Sankey resolvendo displayLabel do nodeMap e preservando clickTarget (TE-2)', () => {
    const graph = buildSankeyData(baseResult.cleaning.validRespondents, true);
    const sankeyOpt = buildSankeyOption({
      graph,
      activeBiFilter: { seniorities: ['Sênior'] },
    });
    const sankeySeries = sankeyOpt.series as Array<{
      data: Array<{ name: string; clickTarget: unknown; itemStyle: { opacity?: number } }>;
      label: { formatter: (cb: unknown) => string };
    }>;

    expect(sankeySeries).toHaveLength(1);
    const seniorNode = sankeySeries[0].data.find((n) => n.name === 'sen:Sênior');
    expect(seniorNode?.clickTarget).toEqual({ kind: 'seniority', value: 'Sênior' });
    expect(sankeySeries[0].label.formatter({ name: 'sen:Sênior' })).toBe('Sênior (14)');
    expect(sankeySeries[0].label.formatter({ name: 'qual:high' })).toContain('Alto (≥3,75)');
  });

  it('constrói Butterfly com comprimentos desiguais/vazios e barras de perfil (TE-2)', () => {
    const slice = analyzeBiDashboardSlice(baseResult, {
      ...DEFAULT_BI_FILTER_STATE,
      riskThemes: ['seguranca'],
      seniorities: ['Sênior'],
    });

    const unequalButterfly = buildPairedThemeButterflyOption({
      riskThemes: slice.facetProfiles.riskThemes.slice(0, 3),
      benefitThemes: slice.facetProfiles.benefitThemes.slice(0, 1),
      selectedRiskThemes: ['seguranca'],
      compact: true,
    });
    const unequalSeries = unequalButterfly.series as Array<{
      name: string;
      data: Array<{ value: number; theme?: { id: string; label: string }; itemStyle: { opacity: number } } | null>;
    }>;

    expect(unequalSeries).toHaveLength(2);
    expect(unequalSeries[0].data).toHaveLength(5);
    expect(unequalSeries[1].data).toHaveLength(5);
    expect(unequalSeries[0].data.filter((d) => d === null)).toHaveLength(2);
    expect(unequalSeries[1].data.filter((d) => d === null)).toHaveLength(4);

    const riskItem = unequalSeries[0].data.find((d) => d?.theme?.id === 'seguranca');
    const dimmedRisk = unequalSeries[0].data.find((d) => d && d.theme?.id !== 'seguranca');
    expect(riskItem?.value).toBeLessThanOrEqual(0);
    expect(riskItem?.itemStyle.opacity).toBeGreaterThan(0.5);
    expect(dimmedRisk?.itemStyle.opacity).toBeLessThan(0.5);
    expect(extractClickTarget({ data: riskItem })).toEqual({
      kind: 'riskTheme',
      themeId: 'seguranca',
      label: riskItem?.theme?.label,
    });

    const emptyButterfly = buildPairedThemeButterflyOption({
      riskThemes: [],
      benefitThemes: [],
    });
    const emptySeries = emptyButterfly.series as Array<{ data: Array<null> }>;
    expect(emptySeries[0].data.every((d) => d === null)).toBe(true);
    expect(emptySeries[1].data.every((d) => d === null)).toBe(true);

    const profileBarsOpt = buildProfileFacetBarsOption({
      dimensionLabel: 'Senioridade (M_SEN)',
      items: slice.facetProfiles.seniorities,
      dimensionKind: 'seniority',
    });
    const profileSeries = profileBarsOpt.series as Array<{
      data: Array<{ item: { id: string }; itemStyle: { opacity: number } }>;
    }>;
    const srBar = profileSeries[0].data.find((d) => d.item.id === 'Sênior');
    const jrBar = profileSeries[0].data.find((d) => d.item.id === 'Júnior');
    expect(srBar?.itemStyle.opacity).toBeGreaterThan(0.5);
    expect(jrBar?.itemStyle.opacity).toBeLessThan(0.5);
    expect(extractClickTarget({ data: srBar })).toEqual({
      kind: 'seniority',
      value: 'Sênior',
    });
  });
});
