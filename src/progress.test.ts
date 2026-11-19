import { describe, expect, it } from 'vitest';

import { agentEnv, describeEvent } from './progress.ts';

describe('describeEvent', () => {
  it('a progress event is one feed line', () => {
    expect(describeEvent({ type: 'progress', text: 'Analysis:  button rows\non flex — fixing' })).toEqual([
      '› Analysis: button rows on flex — fixing',
    ]);
  });

  it('a long line is truncated', () => {
    const [line] = describeEvent({ type: 'progress', text: 'a'.repeat(500) });
    expect(line).toHaveLength(2 + 300);
    expect(line?.endsWith('…')).toBe(true);
  });

  it('other contract events are not shown', () => {
    expect(describeEvent({ type: 'result', ok: true })).toEqual([]);
    expect(describeEvent({ type: 'limits' })).toEqual([]);
    expect(describeEvent('not json')).toEqual([]);
  });
});

describe('agentEnv', () => {
  it('strips the harness variables of a parent agent, keeps the rest', () => {
    const env = agentEnv({
      PATH: '/bin',
      SOLOSPRINT_GATE: 'pnpm verify',
      OPENCODE_SESSION_ID: 'ses_1',
      OPENCODE_SERVER: 'http://localhost',
    });
    expect(env).toEqual({ PATH: '/bin', SOLOSPRINT_GATE: 'pnpm verify' });
  });
});
