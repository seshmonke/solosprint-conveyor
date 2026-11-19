import { networkInterfaces } from 'node:os';

import { instance } from './config.ts';
import type { Verdict } from './agent.ts';

// Pure conveyor rules: how to read the owner's answer and what to hand the fixer.

const leadingWord = (words: string) => new RegExp(`^\\s*(${words})(?![\\p{L}\\d])`, 'iu');

/** "ok" after a live check: the check passed. Any other answer describes a bug. */
export const isPassed = (answer: string) => leadingWord(instance.answers.passed.join('|')).test(answer);

/** "accept" on exhausted rounds: the blockers go to the backlog as remarks. */
export const isAcceptAsIs = (answer: string) =>
  leadingWord(instance.answers.accept.join('|')).test(answer);

export function tail(text: string, lines: number): string {
  return text.trimEnd().split('\n').slice(-lines).join('\n');
}

export function formatBlockers(verdict: Pick<Verdict, 'blockers'>): string {
  return verdict.blockers
    .map(
      (blocker, index) =>
        `${index + 1}. ${blocker.where} — ${blocker.problem}\n   Scenario: ${blocker.scenario}\n   Expected: ${blocker.expected}`,
    )
    .join('\n');
}

export function bulletList(items: string[]): string {
  return items.length ? items.map((item) => `- ${item}`).join('\n') : '- none';
}

/** A home-network address for a phone checking the served build. */
export function lanAddress(): string {
  const addresses = Object.values(networkInterfaces())
    .flat()
    .filter((address) => address !== undefined && address.family === 'IPv4' && !address.internal)
    .map((address) => address?.address ?? '');
  return (
    addresses.find((address) => address.startsWith('192.168.')) ??
    addresses.find((address) => address.startsWith('10.')) ??
    addresses[0] ??
    '127.0.0.1'
  );
}
