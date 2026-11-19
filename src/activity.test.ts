import { describe, expect, it } from 'vitest';

import { duration, formatActivity, stamp } from './activity.ts';

describe('duration', () => {
  it('seconds, minutes, hours', () => {
    expect(duration(18_400)).toBe('18s');
    expect(duration(760_000)).toBe('12m 40s');
    expect(duration(3_900_000)).toBe('1h 5m');
    expect(duration(-5)).toBe('0s');
  });
});

describe('formatActivity', () => {
  const now = 1_000_000;

  it('agent: the phase time and the silence since the last event', () => {
    const line = formatActivity(
      {
        label: '12 implementer',
        startedAt: now - 760_000,
        lastEventAt: now - 18_000,
        waiting: false,
      },
      now,
      2,
    );
    expect(line).toBe('⠹ 12 implementer · 12m 40s · last event 18s ago');
  });

  it('the gate without events — only the time', () => {
    const line = formatActivity(
      { label: '12 verify', startedAt: now - 180_000, lastEventAt: null, waiting: false },
      now,
      0,
    );
    expect(line).toBe('⠋ 12 verify · 3m 0s');
  });

  it('waiting for the owner — no spinner', () => {
    const line = formatActivity(
      { label: 'waiting for the owner', startedAt: now, lastEventAt: null, waiting: true },
      now,
      5,
    );
    expect(line).toBe('… waiting for the owner');
  });
});

describe('stamp', () => {
  const at = new Date(2026, 9, 26, 17, 24, 5);

  it('the time at the start of the line, after the leading newlines', () => {
    expect(stamp('  [12 implementer] › fixing', at)).toBe('17:24:05   [12 implementer] › fixing');
    expect(stamp('\n## Sprint 12: gate', at)).toBe('\n17:24:05 ## Sprint 12: gate');
  });

  it('an empty line stays empty', () => {
    expect(stamp('', at)).toBe('');
    expect(stamp('\n', at)).toBe('\n');
  });
});
