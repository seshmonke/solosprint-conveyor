import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { z } from 'zod';

import { STATE_DIR } from './config.ts';

// The state survives a process stop and a machine sleep: every pipeline step
// writes it before and after work; `run` continues from the same place.

export const phases = [
  'plan',
  'implement',
  'gate',
  'review',
  'fix',
  'close',
  'merge',
  'push',
] as const;
export type Phase = (typeof phases)[number];

const stateSchema = z.object({
  queue: z.array(z.number().int().positive()),
  sprint: z
    .object({
      number: z.number().int().positive(),
      /** Empty until the planner has written the sprint file. */
      file: z.string(),
      branch: z.string(),
      /** main at the start — the base of the sprint diff. */
      base: z.string(),
      /** The commit carrying the composition: agreed by the owner or composed by the planner. */
      composition: z.string(),
      /** The planner composed the sprint within the direction, not the owner. */
      planned: z.boolean(),
      /** Why the analysis before start overturned the composition — back to the planner. */
      replan: z.string().nullable(),
      /** How many times the composition has been reassembled. */
      replans: z.number().int().nonnegative(),
      phase: z.enum(phases),
      /** Fix rounds used across the gate and the review. */
      round: z.number().int().nonnegative(),
      /** The implementer's session — resumed after the owner's answer. */
      session: z.string().nullable(),
      /** What to fix: the gate output, the reviewer's blockers, the owner's instruction. */
      fix: z
        .object({ reason: z.enum(['gate', 'review', 'owner']), details: z.string() })
        .nullable(),
      remarks: z.array(z.string()),
      ownerChecks: z.array(z.string()),
    })
    .nullable(),
});
export type State = z.infer<typeof stateSchema>;
export type SprintState = NonNullable<State['sprint']>;

const stateFile = join(STATE_DIR, 'state.json');

export function loadState(): State {
  if (!existsSync(stateFile)) return { queue: [], sprint: null };
  return stateSchema.parse(JSON.parse(readFileSync(stateFile, 'utf8')));
}

export function saveState(state: State): void {
  mkdirSync(STATE_DIR, { recursive: true });
  const tmp = `${stateFile}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`);
  renameSync(tmp, stateFile);
}
