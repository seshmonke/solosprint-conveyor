import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

import { z } from 'zod';

import { endActivity, waitActivity } from './activity.ts';
import { ANSWER_POLL_MS, STATE_DIR } from './config.ts';

// An owner question: a file plus a notification (a bell by default, or the
// instance's notifier command); the answer comes as a conveyor command.

const questionSchema = z.object({
  id: z.string(),
  sprint: z.number(),
  title: z.string(),
  text: z.string(),
  askedAt: z.string(),
});
export type Question = z.infer<typeof questionSchema>;

const answerSchema = z.object({ id: z.string(), text: z.string(), answeredAt: z.string() });

const questionFile = join(STATE_DIR, 'question.json');
const answerFile = join(STATE_DIR, 'answer.json');
const stopFile = join(STATE_DIR, 'stop');

export class StopRequested extends Error {}

export function pendingQuestion(): Question | null {
  if (!existsSync(questionFile)) return null;
  return questionSchema.parse(JSON.parse(readFileSync(questionFile, 'utf8')));
}

/** Asks a question and waits for the answer; an already asked question is not duplicated. */
export async function ask(sprint: number, title: string, text: string): Promise<string> {
  let question = pendingQuestion();
  if (question === null) {
    question = { id: randomUUID(), sprint, title, text, askedAt: new Date().toISOString() };
    mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(questionFile, `${JSON.stringify(question, null, 2)}\n`);
  }
  printQuestion(question);
  notify(`Sprint ${sprint}: ${question.title}`, 'The conveyor waits for an answer — solosprint-conveyor status');

  waitActivity('waiting for the owner — solosprint-conveyor answer "…"');
  try {
    for (;;) {
      if (existsSync(stopFile)) throw new StopRequested();
      if (existsSync(answerFile)) {
        const answer = answerSchema.parse(JSON.parse(readFileSync(answerFile, 'utf8')));
        if (answer.id === question.id) {
          rmSync(answerFile);
          rmSync(questionFile);
          endActivity();
          console.log(`\n  Owner answer: ${answer.text}\n`);
          return answer.text;
        }
      }
      await sleep(ANSWER_POLL_MS);
    }
  } finally {
    endActivity();
  }
}

export function answer(text: string): void {
  const question = pendingQuestion();
  if (question === null) throw new Error('The conveyor is not asking anything right now.');
  writeFileSync(
    answerFile,
    `${JSON.stringify({ id: question.id, text, answeredAt: new Date().toISOString() })}\n`,
  );
}

export function printQuestion(question: Question): void {
  console.log(`\n=== Sprint ${question.sprint}: ${question.title} ===\n\n${question.text}\n`);
  console.log('Answer: solosprint-conveyor answer "…"   Stop: solosprint-conveyor stop\n');
}

export function requestStop(): void {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(stopFile, `${new Date().toISOString()}\n`);
}

export function clearStop(): void {
  rmSync(stopFile, { force: true });
}

export function stopRequested(): boolean {
  return existsSync(stopFile);
}

/**
 * The owner notification: a terminal bell always, and the instance's command
 * when `SOLOSPRINT_NOTIFY` is set. The command receives the title and body in
 * the environment (`SOLOSPRINT_NOTIFY_TITLE`, `SOLOSPRINT_NOTIFY_BODY`) and is
 * run through the shell — instances plug in their OS toaster there.
 */
export function notify(title: string, body: string): void {
  process.stdout.write('\u0007');
  const command = process.env['SOLOSPRINT_NOTIFY'];
  if (!command) return;
  execFile(
    command,
    {
      shell: true,
      env: {
        ...process.env,
        SOLOSPRINT_NOTIFY_TITLE: title,
        SOLOSPRINT_NOTIFY_BODY: body,
      },
    },
    (error) => {
      if (error) console.log(`  (owner notification failed: ${String(error).slice(0, 200)})`);
    },
  );
}
