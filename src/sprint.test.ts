import { describe, expect, it } from 'vitest';

import {
  addBacklogTask,
  markChecksDone,
  parseSprint,
  pendingChecks,
  type Sprint,
} from './sprint.ts';

const composed = `### Sprint 14: element types

Goal: an element has a type with fields.

## Tasks

- [x] The type schema: MVP fields;
      exceptions — an explicit list.
- [ ] The type editor in a sheet.

## Owner checks

- [ ] Storybook showing: the type editor.
- [ ] Live check on a phone on the production build:
      the editor sheet does not drift.

## Analysis before start

- [ ] not a task, an item of another section
`;

describe('parseSprint', () => {
  it('reads the goal and tasks with line continuations', () => {
    const sprint = parseSprint(composed);
    expect(sprint.goal).toBe('an element has a type with fields.');
    expect(sprint.tasks).toEqual([
      { done: true, text: 'The type schema: MVP fields; exceptions — an explicit list.' },
      { done: false, text: 'The type editor in a sheet.' },
    ]);
    expect(sprint.closed).toBe(false);
  });

  it('owner checks are separate from tasks', () => {
    expect(parseSprint(composed).checks.map((check) => check.text)).toEqual([
      'Storybook showing: the type editor.',
      'Live check on a phone on the production build: the editor sheet does not drift.',
    ]);
  });

  it('a sprint with the retro is closed', () => {
    expect(parseSprint(`${composed}\n## Retro\n\nClosed.`).closed).toBe(true);
  });
});

describe('owner checks', () => {
  const sprint = (text: string): Sprint => ({ number: 14, file: 'x.md', ...parseSprint(text) });

  it('unmarked items wait for the owner', () => {
    expect(pendingChecks(sprint(composed))).toHaveLength(2);
    expect(pendingChecks(sprint('## Tasks\n\n- [ ] Audit\n'))).toEqual([]);
  });

  it('the verdict marks the items and appends a line, the rest is untouched', () => {
    const marked = markChecksDone(composed, 'Checked by the owner on 26.10.2026: passed.');
    expect(pendingChecks(sprint(marked))).toEqual([]);
    expect(marked).toContain(
      'the editor sheet does not drift.\n\nChecked by the owner on 26.10.2026: passed.\n\n## Analysis',
    );
    expect(marked).toContain('- [ ] The type editor in a sheet.');
    expect(marked).toContain('- [ ] not a task');
  });

  it('the section at the end of the file', () => {
    const text = '## Tasks\n\n- [x] A\n\n## Owner checks\n\n- [ ] B\n';
    expect(markChecksDone(text, 'Result.')).toBe(
      '## Tasks\n\n- [x] A\n\n## Owner checks\n\n- [x] B\n\nResult.\n',
    );
  });

  it('remarks — a task to the top of the backlog', () => {
    const backlog = '# Queue\n\n## Tasks\n\n- `P1` old\n';
    expect(addBacklogTask(backlog, '- `P0` new')).toBe(
      '# Queue\n\n## Tasks\n\n- `P0` new\n- `P1` old\n',
    );
  });
});
