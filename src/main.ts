#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { installFeed } from './activity.ts';
import { checkQueue, formatQueue, recordCheck, serveChecks } from './checks.ts';
import { REPO, STATE_DIR, WORKTREE } from './config.ts';
import { lastCommitOf } from './git.ts';
import { answer, clearStop, pendingQuestion, printQuestion, requestStop } from './owner.ts';
import { runPipeline } from './pipeline.ts';
import { isAlive } from './shell.ts';
import { readSprint } from './sprint.ts';
import { loadState, saveState } from './state.ts';
import { formatSession, parseCostRow, sprintTotal } from './usage.ts';

// solosprint-conveyor start [N…] | run | answer "…" | status | checks | check N <result> | stop
// — docs/conveyor.md.

const usage = `solosprint-conveyor start [N…]   start: agreed compositions first, then by direction
solosprint-conveyor run          continue after a stop or a failure
solosprint-conveyor answer "…"   answer the conveyor's question
solosprint-conveyor status       where the conveyor is, what it asks, the check queue
solosprint-conveyor checks       the check queue; serves the build until Ctrl+C
solosprint-conveyor check N ok   the check result for sprint N: "ok" or the remark text
solosprint-conveyor stop         stop at the nearest point (the current agent session finishes)`;

const lockFile = join(STATE_DIR, 'lock');

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  switch (command) {
    case 'start':
      return start(args.map(Number));
    case 'run':
      return withLock(runPipeline);
    case 'answer':
      answer(args.join(' ').trim());
      console.log('The answer is delivered to the conveyor.');
      return;
    case 'status':
      status();
      return;
    case 'checks':
      console.log(formatQueue(checkQueue()));
      if (checkQueue().length) await serveChecks();
      return;
    case 'check': {
      const [number, ...text] = args;
      const verdict = text.join(' ').trim();
      if (!Number.isInteger(Number(number)) || !verdict)
        throw new Error('solosprint-conveyor check 12 ok | "remarks"');
      console.log(recordCheck(Number(number), verdict));
      return;
    }
    case 'stop':
      requestStop();
      console.log('The conveyor will stop at the nearest point.');
      return;
    default:
      console.log(usage);
      process.exitCode = command ? 1 : 0;
  }
}

async function start(numbers: number[]): Promise<void> {
  if (numbers.some((number) => !Number.isInteger(number) || number <= 0)) {
    throw new Error(`Sprint numbers: solosprint-conveyor start [12 13 …]`);
  }
  const state = loadState();
  if (state.sprint !== null) {
    throw new Error(
      `Sprint ${state.sprint.number} (${state.sprint.phase}) is running — solosprint-conveyor run or status.`,
    );
  }
  for (const number of numbers) {
    const sprint = readSprint(REPO, number);
    if (sprint.closed) throw new Error(`Sprint ${number} is already closed.`);
    lastCommitOf(REPO, sprint.file);
  }
  saveState({ queue: numbers, sprint: null });
  clearStop();
  await withLock(runPipeline);
}

async function withLock(task: () => Promise<void>): Promise<void> {
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 26) throw new Error(`Node 26 is required, now ${process.versions.node}`);
  mkdirSync(STATE_DIR, { recursive: true });
  if (existsSync(lockFile)) {
    const pid = Number(readFileSync(lockFile, 'utf8'));
    if (isAlive(pid)) throw new Error(`The conveyor is already running (pid ${pid}).`);
  }
  writeFileSync(lockFile, String(process.pid));
  installFeed();
  try {
    await task();
  } finally {
    rmSync(lockFile, { force: true });
  }
}

function status(): void {
  const state = loadState();
  const running = existsSync(lockFile) && isAlive(Number(readFileSync(lockFile, 'utf8')));
  console.log(`Process: ${running ? 'running' : 'not started'}. Working copy: ${WORKTREE}`);
  console.log(
    `Queue: ${state.queue.length ? state.queue.join(', ') : 'empty — next by direction'}`,
  );
  if (state.sprint) {
    const { number, phase, round, planned } = state.sprint;
    console.log(
      `Sprint ${number}: phase ${phase}, fix round ${round}, composition — ${planned ? 'planner' : 'owner'}`,
    );
  }
  console.log(formatQueue(checkQueue()));
  const question = pendingQuestion();
  if (question) printQuestion(question);
  const costs = join(STATE_DIR, 'costs.tsv');
  if (existsSync(costs)) {
    const rows = readFileSync(costs, 'utf8').trimEnd().split('\n').map(parseCostRow);
    const number = state.sprint?.number ?? rows.at(-1)?.sprint;
    const sprintRows = rows.filter((row) => row.sprint === number);
    if (sprintRows.length) console.log(`Sprint ${number} cost: ${sprintTotal(sprintRows)}`);
    console.log(`Latest sessions (full — ${costs}):`);
    console.log(rows.slice(-5).map(formatSession).join('\n'));
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
