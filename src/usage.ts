import { z } from 'zod';

import { duration } from './activity.ts';

// Session usage from the adapter's result event; the provider may leave any
// field absent. Costs live in `costs.tsv` and `status` shows the sprint total.

export const usageSchema = z.object({
  inputTokens: z.number().optional(),
  cachedTokens: z.number().optional(),
  outputTokens: z.number().optional(),
  costUsd: z.number().optional(),
  turns: z.number().optional(),
  durationMs: z.number().optional(),
});

export type Usage = z.infer<typeof usageSchema>;

export type Tokens = { input: number; cached: number; output: number };

export function readTokens(usage: Usage | undefined): Tokens | null {
  if (!usage || usage.inputTokens === undefined || usage.outputTokens === undefined) return null;
  return {
    input: usage.inputTokens,
    cached: usage.cachedTokens ?? 0,
    output: usage.outputTokens,
  };
}

const decimal = (value: number) => value.toFixed(1).replace('.0', '');

export function formatCount(count: number): string {
  if (count >= 1_000_000) return `${decimal(count / 1_000_000)}m`;
  if (count >= 10_000) return `${Math.round(count / 1000)}k`;
  if (count >= 1000) return `${decimal(count / 1000)}k`;
  return String(count);
}

export function formatTokens(tokens: Tokens): string {
  const input = tokens.input + tokens.cached;
  const cached = input ? Math.round((tokens.cached / input) * 100) : 0;
  return `${formatCount(input)} in (${cached}% cache) / ${formatCount(tokens.output)} out`;
}

/**
 * A costs.tsv row. Columns: time, sprint, role, session, $, turns, ms, input,
 * cache read, output; an empty cell — no data.
 */
export type CostRow = {
  time: string;
  sprint: number;
  role: string;
  session: string;
  usd: number | null;
  turns: number | null;
  ms: number | null;
  tokens: Tokens | null;
};

const cell = (value: number | string | null | undefined) =>
  value === null || value === undefined ? '' : String(value);

export function formatCostRow(row: CostRow): string {
  return [
    row.time,
    row.sprint,
    row.role,
    row.session,
    row.usd,
    row.turns,
    row.ms,
    row.tokens?.input,
    row.tokens?.cached,
    row.tokens?.output,
  ]
    .map(cell)
    .join('\t');
}

export function parseCostRow(line: string): CostRow {
  const cells = line.split('\t');
  const num = (index: number) => {
    const value = cells[index];
    return value === undefined || value === '' ? null : Number(value);
  };
  const [input, cached, output] = [num(7), num(8), num(9)];
  return {
    time: cells[0] ?? '',
    sprint: num(1) ?? 0,
    role: cells[2] ?? '',
    session: cells[3] ?? '',
    usd: num(4),
    turns: num(5),
    ms: num(6),
    tokens:
      input === null || output === null
        ? null
        : { input, cached: cached ?? 0, output },
  };
}

/** The sprint total across its sessions: money and tokens. */
export function sprintTotal(rows: CostRow[]): string {
  const parts = [`$${rows.reduce((sum, row) => sum + (row.usd ?? 0), 0).toFixed(2)}`];
  const withTokens = rows.flatMap((row) => (row.tokens ? [row.tokens] : []));
  if (withTokens.length) {
    const total = withTokens.reduce(
      (sum, tokens) => ({
        input: sum.input + tokens.input,
        cached: sum.cached + tokens.cached,
        output: sum.output + tokens.output,
      }),
      { input: 0, cached: 0, output: 0 },
    );
    parts.push(formatTokens(total));
  }
  return `${parts.join(' · ')} — sessions ${rows.length}${withTokens.length < rows.length ? ', some without tokens' : ''}`;
}

/** A session on one line for `status`. */
export function formatSession(row: CostRow): string {
  const time = row.time ? new Date(row.time).toLocaleTimeString('en-GB') : '?';
  const parts = [`${time} ${row.sprint} ${row.role}`, `$${(row.usd ?? 0).toFixed(2)}`];
  if (row.turns !== null) parts.push(`turns ${row.turns}`);
  if (row.ms !== null) parts.push(duration(row.ms));
  if (row.tokens) parts.push(formatTokens(row.tokens));
  return parts.join(' · ');
}
