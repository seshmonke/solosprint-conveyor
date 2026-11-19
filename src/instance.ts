import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { z } from 'zod';

// Instance configuration: `.solosprint.json` in the project root. The canon
// ships defaults; an instance overrides only what differs in its project.

const serverSchema = z.object({
  /** Shown in the feed. */
  label: z.string(),
  /** Command for the background server. */
  cmd: z.array(z.string()),
  /** Regex matched against the server output: ready when seen. */
  ready: z.string(),
});

const stepSchema = z.object({
  label: z.string(),
  /** Synchronous command run before the servers (build, migrate, db up). */
  cmd: z.array(z.string()),
});

export const instanceSchema = z.object({
  /** Directory with `NN-*.md` sprint files, relative to the repo root. */
  tasksDir: z.string().default('docs/tasks'),
  /** Rules files every role reads first. */
  rules: z.array(z.string()).default(['docs/tasks/INDEX.md']),
  /** Direction file for autonomous planning; written by the owner. */
  direction: z.string().default('docs/tasks/direction.md'),
  /** Backlog file. */
  backlog: z.string().default('docs/tasks/backlog.md'),
  /** Sprint index file (the sprint list). */
  index: z.string().default('docs/tasks/INDEX.md'),
  /** Shell line run before gate commands (for example `nvm use`). */
  setup: z.string().default(''),
  /** Sprint-file dialect: the headings the conveyor reads and writes. */
  headings: z
    .object({
      goal: z.string().default('Goal:'),
      tasks: z.string().default('## Tasks'),
      ownerChecks: z.string().default('## Owner checks'),
      retro: z.string().default('## Retro'),
      /** How the retro starts the closing line: "Closed 31.10.2026". */
      closed: z.string().default('Closed '),
    })
    .default({
      goal: 'Goal:',
      tasks: '## Tasks',
      ownerChecks: '## Owner checks',
      retro: '## Retro',
      closed: 'Closed ',
    }),
  /** Owner answer keywords: a passed check and "accept as is". */
  answers: z
    .object({
      passed: z.array(z.string()).default(['ok', 'okay', 'passed', 'yes']),
      accept: z.array(z.string()).default(['accept', 'accept as is']),
    })
    .default({
      passed: ['ok', 'okay', 'passed', 'yes'],
      accept: ['accept', 'accept as is'],
    }),
  /** Ports shared between the conveyor gate and owner serving. */
  ports: z
    .object({
      e2e: z.array(z.number()).default([]),
      live: z.array(z.number()).default([]),
      storybook: z.number().default(6006),
    })
    .default({ e2e: [], live: [], storybook: 6006 }),
  /** Owner-check serving: sync steps, then background servers, then intro. */
  checksServe: z
    .object({
      steps: z.array(stepSchema).default([]),
      servers: z.array(serverSchema).default([]),
      /** Printed after the servers are ready (addresses, instructions). */
      intro: z.string().default(''),
    })
    .default({ steps: [], servers: [], intro: '' }),
});

export type InstanceConfig = z.infer<typeof instanceSchema>;

export function loadInstance(repo: string): InstanceConfig {
  const file = join(repo, '.solosprint.json');
  const raw = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  return instanceSchema.parse(raw);
}
