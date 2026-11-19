import { describe, expect, it } from 'vitest';

import { formatBlockers, isAcceptAsIs, isPassed, tail } from './decide.ts';

describe('the owner answer', () => {
  it('"ok" and its synonyms — the live check passed', () => {
    for (const answer of ['ok', 'Ok, everything is in place', 'OK', 'okay', 'passed', 'yes']) {
      expect(isPassed(answer), answer).toBe(true);
    }
  });

  it('a bug description is not "ok", even when it starts alike', () => {
    for (const answer of ['okayish — the sheet drifts sideways', 'data was not saved', 'not ok: the button is tiny']) {
      expect(isPassed(answer), answer).toBe(false);
    }
  });

  it('"accept" — accept with the blockers as is', () => {
    expect(isAcceptAsIs('accept')).toBe(true);
    expect(isAcceptAsIs('Accept, the rest to the backlog')).toBe(true);
    expect(isAcceptAsIs('acceptance of the date is broken')).toBe(false);
  });
});

describe('the format for the fixer', () => {
  it('blockers are numbered with a scenario and an expectation', () => {
    const text = formatBlockers({
      blockers: [
        {
          where: 'a.ts:1',
          problem: 'no rollback',
          scenario: 'a network error',
          expected: 'the list is back',
        },
      ],
    });
    expect(text).toBe('1. a.ts:1 — no rollback\n   Scenario: a network error\n   Expected: the list is back');
  });

  it('the output tail — the last lines', () => {
    expect(tail('1\n2\n3\n\n', 2)).toBe('2\n3');
  });
});
