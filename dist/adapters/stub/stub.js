#!/usr/bin/env node
// The test stub of the adapter contract (docs/adapter-contract.md): a fake
// agent that emits a canned event stream, does the file work of each role,
// and returns a canned structured result. It lets a trial run drive the full
// cycle — plan → implement → gate → review → close → merge → push — without a
// provider. Behavior is steered by environment variables:
//   STUB_STATUS   done | need_owner | halt | replan   (work roles; default done)
//   STUB_VERDICT  ACCEPT | REJECT                     (reviewer; default ACCEPT)
//   STUB_SESSION  the returned session id             (default stub-1)
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const arg = (name) => {
    const index = process.argv.indexOf(name);
    return index === -1 ? undefined : process.argv[index + 1];
};
const role = arg('--role') ?? 'implementer';
const sprint = Number(arg('--sprint') ?? '0');
const cwd = arg('--cwd') ?? process.cwd();
const session = process.env['STUB_SESSION'] ?? 'stub-1';
const emit = (event) => process.stdout.write(`${JSON.stringify(event)}\n`);
const say = (text) => emit({ type: 'progress', text });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const commit = (cwd, message) => {
    git(cwd, 'add', '-A');
    git(cwd, 'commit', '-m', message);
};
const sprintFile = () => {
    const dir = join(cwd, 'docs', 'tasks');
    const prefix = `${String(sprint).padStart(2, '0')}-`;
    const found = readdirSync(dir).filter((name) => name.startsWith(prefix) && name.endsWith('.md'));
    if (found.length === 0)
        return join(dir, `${prefix}stub.md`);
    return join(dir, found[0]);
};
/** The instance dialect from `.solosprint.json`, with the canon defaults. */
const dialect = (() => {
    const file = join(cwd, '.solosprint.json');
    try {
        const config = JSON.parse(readFileSync(file, 'utf8'));
        return {
            goal: config.headings?.['goal'] ?? 'Goal:',
            tasks: config.headings?.['tasks'] ?? '## Tasks',
            ownerChecks: config.headings?.['ownerChecks'] ?? '## Owner checks',
            retro: config.headings?.['retro'] ?? '## Retro',
            closed: config.headings?.['closed'] ?? 'Closed ',
        };
    }
    catch {
        return {
            goal: 'Goal:',
            tasks: '## Tasks',
            ownerChecks: '## Owner checks',
            retro: '## Retro',
            closed: 'Closed ',
        };
    }
})();
/** The planner writes the sprint file and the index line, docs only. */
const plannerWork = () => {
    const dir = join(cwd, 'docs', 'tasks');
    mkdirSync(dir, { recursive: true });
    const file = sprintFile();
    if (!existsSync(file)) {
        writeFileSync(file, `### Sprint ${sprint}: stub composition\n\n${dialect.goal} the stub proves the cycle works.\n\n${dialect.tasks}\n\n- [ ] Task one\n- [ ] Task two\n\n${dialect.ownerChecks}\n\n- [ ] A hands-on check\n`);
    }
    const index = join(dir, 'INDEX.md');
    const current = existsSync(index) ? readFileSync(index, 'utf8') : '# Sprints\n\n## Sprints\n';
    const line = `- [Sprint ${sprint}](${file.split('/').at(-1)})`;
    if (!current.includes(line))
        writeFileSync(index, `${current.trimEnd()}\n${line}\n`);
    commit(cwd, `Sprint ${sprint}: composition assembled by the planner (stub)`);
};
/** The implementer and the fixer commit one code file. */
const implementerWork = () => {
    mkdirSync(join(cwd, 'src'), { recursive: true });
    writeFileSync(join(cwd, 'src', `sprint-${sprint}.ts`), `// Sprint ${sprint}: a stub change (${role})\nexport const marker = ${sprint};\n`);
    commit(cwd, `Sprint ${sprint}: ${role} change (stub)`);
};
/** The closer writes the retro and marks the index line, docs only. */
const closerWork = () => {
    const file = sprintFile();
    const text = readFileSync(file, 'utf8');
    writeFileSync(file, `${text.trimEnd()}\n\n${dialect.retro}\n\n${dialect.closed}${new Date().toLocaleDateString('en-GB')}. Stub run: all phases passed.\n`);
    commit(cwd, `Sprint ${sprint} closed (stub)`);
};
const readStdin = () => new Promise((resolve) => {
    let text = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
        text += chunk;
    });
    process.stdin.on('end', () => resolve(text));
});
const usage = () => ({
    inputTokens: 1500,
    cachedTokens: 600,
    outputTokens: 300,
    costUsd: 0.02,
    turns: 3,
    durationMs: 350,
});
const main = async () => {
    await readStdin();
    say(`reading the prompt (sprint ${sprint})`);
    await sleep(80);
    say('working on the task');
    await sleep(80);
    if (role === 'reviewer') {
        const verdict = process.env['STUB_VERDICT'] ?? 'ACCEPT';
        if (verdict === 'REJECT') {
            say('the sprint does not pass the review');
            emit({
                type: 'result',
                ok: true,
                session,
                usage: usage(),
                output: {
                    verdict: 'REJECT',
                    summary: 'The goal does not hold on this code.',
                    blockers: [
                        {
                            where: 'src/example.ts:1',
                            problem: 'The marked task has no proof in the diff.',
                            scenario: 'Read the diff, find the implementation of the marked task.',
                            expected: 'The task is implemented and covered by a test.',
                        },
                    ],
                    remarks: ['src/example.ts:2 — a minor naming nit'],
                    ownerChecks: ['Check the screen on a phone'],
                },
            });
        }
        else {
            say('every task holds, accepting');
            emit({
                type: 'result',
                ok: true,
                session,
                usage: usage(),
                output: {
                    verdict: 'ACCEPT',
                    summary: 'All tasks hold, the goal holds.',
                    blockers: [],
                    remarks: ['A remark that does not block'],
                    ownerChecks: ['Check the screen on a phone'],
                },
            });
        }
        return;
    }
    const status = process.env['STUB_STATUS'] ?? 'done';
    if ((process.env['STUB_STOP_AFTER'] !== undefined &&
        sprint > Number(process.env['STUB_STOP_AFTER'])) ||
        status === 'halt') {
        emit({
            type: 'result',
            ok: true,
            session,
            output: {
                status: 'halt',
                summary: 'Stopped by the stub — the trial ends here.',
                question: null,
                show: 'none',
            },
        });
        return;
    }
    if (status === 'need_owner') {
        emit({
            type: 'result',
            ok: true,
            session,
            usage: usage(),
            output: {
                status: 'need_owner',
                summary: 'A concept-level decision surfaced.',
                question: 'Should the sprint proceed? Recommendation: yes.',
                show: 'none',
            },
        });
        return;
    }
    if (status === 'replan') {
        emit({
            type: 'result',
            ok: true,
            session,
            output: {
                status: 'replan',
                summary: 'The analysis overturned the composition.',
                question: null,
                show: 'none',
            },
        });
        return;
    }
    if (role === 'planner')
        plannerWork();
    else if (role === 'closer')
        closerWork();
    else
        implementerWork();
    say('the working copy is clean');
    emit({
        type: 'result',
        ok: true,
        session,
        usage: usage(),
        output: {
            status: 'done',
            summary: `Sprint ${sprint}: the ${role} work is done.`,
            question: null,
            show: 'none',
        },
    });
};
main().catch((error) => {
    emit({ type: 'result', ok: false, session, error: String(error) });
    process.exitCode = 1;
});
