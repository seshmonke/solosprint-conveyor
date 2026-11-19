import { describe, expect, it } from 'vitest';

import {
  formatCostRow,
  formatCount,
  formatSession,
  formatTokens,
  parseCostRow,
  sprintTotal,
  type CostRow,
} from './usage.ts';

describe('formatting', () => {
  it('token counts', () => {
    expect(formatCount(850)).toBe('850');
    expect(formatCount(2480)).toBe('2.5k');
    expect(formatCount(12_378)).toBe('12k');
    expect(formatCount(1_200_635)).toBe('1.2m');
    expect(formatCount(2_000_000)).toBe('2m');
  });

  it('session tokens: input with cache and output', () => {
    const tokens = { input: 960, cached: 11_040, output: 3_000 };
    expect(formatTokens(tokens)).toBe('12k in (92% cache) / 3k out');
  });
});

describe('costs.tsv', () => {
  const row: CostRow = {
    time: '2026-10-26T15:04:59.000Z',
    sprint: 12,
    role: 'reviewer',
    session: 's1',
    usd: 1.08,
    turns: 21,
    ms: 163_379,
    tokens: { input: 40, cached: 1000, output: 30 },
  };

  it('a row round-trips', () => {
    expect(parseCostRow(formatCostRow(row))).toEqual(row);
  });

  it('an old row without tokens reads', () => {
    const old = parseCostRow('2026-10-26T14:34:08.393Z\t12\timplementer\ts0\t2.44\t63\t1313276');
    expect(old).toMatchObject({ usd: 2.44, tokens: null });
  });

  it('a session on one line', () => {
    expect(formatSession(row)).toBe(
      `${new Date(row.time).toLocaleTimeString('en-GB')} 12 reviewer · $1.08 · turns 21 · 2m 43s · 1k in (96% cache) / 30 out`,
    );
  });

  it('the sprint total: the sum across the sessions', () => {
    const old = parseCostRow('t\t12\timplementer\ts0\t2.44\t63\t1');
    expect(sprintTotal([old, row])).toBe(
      '$3.52 · 1k in (96% cache) / 30 out — sessions 2, some without tokens',
    );
  });
});
