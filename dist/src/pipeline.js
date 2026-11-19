import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { beginActivity, endActivity, waitActivity } from "./activity.js";
import { AgentError, LimitReached, prompt, runAgent, verdictSchema, workSchema, } from "./agent.js";
import { checksServing } from "./checks.js";
import { CONVEYOR_DIR, E2E_PORTS, GATE, INSTALL, MAX_FIX_ROUNDS, REPO, STATE_DIR, STORYBOOK_PORT, WORKTREE, instance, } from "./config.js";
import { bulletList, formatBlockers, isAcceptAsIs, lanAddress, tail } from "./decide.js";
import { changedFiles, commitsAhead, dirty, fastForwardMain, git, hasWorkflows, head, lastCommitOf, prepareWorktree, pushMain, rebaseOntoMain, } from "./git.js";
import { ask, clearStop, notify, StopRequested, stopRequested } from "./owner.js";
import { busyPorts, run, startBackground, stopBackground, trySh, waitForOutput } from "./shell.js";
import { nextSprintNumber, readSprint } from "./sprint.js";
import { loadState, saveState } from "./state.js";
export function startSprint(number) {
    const sprint = readSprint(REPO, number);
    if (sprint.closed)
        throw new Error(`Sprint ${number} is already closed.`);
    if (git(REPO, 'status', '--porcelain', '--', sprint.file)) {
        throw new Error(`File ${sprint.file} is not committed — the composition is not fixed.`);
    }
    const composition = lastCommitOf(REPO, sprint.file);
    const branch = `sprint/${number}`;
    prepareWorktree(branch);
    return {
        number,
        file: sprint.file,
        branch,
        base: head(WORKTREE),
        composition,
        planned: false,
        replan: null,
        replans: 0,
        phase: 'implement',
        round: 0,
        session: null,
        fix: null,
        remarks: [],
        ownerChecks: [],
    };
}
/** No agreed sprints in the queue — the planner composes the next one within the direction. */
export function planSprint() {
    const number = nextSprintNumber(REPO);
    const branch = `sprint/${number}`;
    prepareWorktree(branch);
    return {
        number,
        file: '',
        branch,
        base: head(WORKTREE),
        composition: '',
        planned: true,
        replan: null,
        replans: 0,
        phase: 'plan',
        round: 0,
        session: null,
        fix: null,
        remarks: [],
        ownerChecks: [],
    };
}
export async function runPipeline() {
    for (;;) {
        const state = loadState();
        if (stopRequested()) {
            clearStop();
            console.log('The conveyor stopped on solosprint-conveyor stop. Continue: solosprint-conveyor run');
            return;
        }
        let sprint = state.sprint;
        if (sprint === null) {
            const number = state.queue[0];
            if (number === undefined) {
                sprint = planSprint();
                console.log(`\n### Sprint ${sprint.number}: planning within the direction`);
            }
            else {
                console.log(`\n### Sprint ${number}: start`);
                sprint = startSprint(number);
            }
            saveState({ ...state, sprint });
        }
        console.log(`\n## Sprint ${sprint.number}: ${sprint.phase}${sprint.round ? `, fix round ${sprint.round}` : ''}`);
        let outcome;
        try {
            outcome = await step(sprint);
        }
        catch (error) {
            if (error instanceof StopRequested)
                continue;
            if (error instanceof LimitReached) {
                // The session resumes after the reset — the phase stays the same.
                if (error.session)
                    saveState({ ...loadState(), sprint: { ...sprint, session: error.session } });
                try {
                    await waitForLimitReset(sprint.number, error.resetsAt);
                }
                catch (stop) {
                    // A stop during the wait — the loop top handles it.
                    if (!(stop instanceof StopRequested))
                        throw stop;
                }
                continue;
            }
            if (error instanceof AgentError) {
                if (error.session)
                    saveState({ ...loadState(), sprint: { ...sprint, session: error.session } });
                outcome = { halt: error.message };
            }
            else {
                throw error;
            }
        }
        if ('halt' in outcome) {
            notify(`Sprint ${sprint.number}: the conveyor stopped`, outcome.halt.slice(0, 200));
            console.log(`\nThe conveyor stopped: ${outcome.halt}\nAfter sorting it out — solosprint-conveyor run`);
            return;
        }
        if ('closed' in outcome) {
            const [, ...rest] = state.queue;
            saveState({ queue: rest, sprint: null });
            notify(`Sprint ${sprint.number} closed and pushed`, rest.length ? `Next — sprint ${rest[0]}` : 'Next — planning within the direction');
            continue;
        }
        saveState({ ...loadState(), sprint: outcome.next });
    }
}
function step(sprint) {
    switch (sprint.phase) {
        case 'plan':
            return plan(sprint);
        case 'implement':
            return implement(sprint);
        case 'gate':
            return gate(sprint);
        case 'review':
            return review(sprint);
        case 'fix':
            return fix(sprint);
        case 'close':
            return close(sprint);
        case 'merge':
            return merge(sprint);
        case 'push':
            return push(sprint);
    }
}
const vars = (sprint, extra = {}) => ({
    N: String(sprint.number),
    FILE: sprint.file,
    WT: WORKTREE,
    BRANCH: sprint.branch,
    BASE: sprint.base,
    COMPOSITION: sprint.composition,
    ORIGIN: sprint.planned
        ? `the composition was assembled by the planner within the direction (${instance.direction})`
        : 'the composition was agreed with the owner',
    METHODOLOGY: CONVEYOR_DIR,
    RULES: bulletList(instance.rules),
    BOARD: instance.index,
    BACKLOG: instance.backlog,
    DIRECTION: instance.direction,
    SETUP: instance.setup,
    ...extra,
});
/** Move to the next phase: the previous phase's session is never resumed. */
const to = (sprint, phase, patch = {}) => ({
    next: { ...sprint, phase, session: null, ...patch },
});
const RESUME_AFTER_CRASH = 'The previous conveyor run broke in the middle of your work. Check the state of the working copy and the sprint file and continue from where you stopped.';
/**
 * A session that changes the working copy: the implementer, the fixer, the
 * closer. An owner question → the answer goes to the same session; "done"
 * with a dirty copy → one return.
 */
async function work(role, sprint, firstPrompt) {
    let resume = sprint.session;
    let input = resume ? RESUME_AFTER_CRASH : firstPrompt;
    let cleanupAsked = false;
    for (;;) {
        const { output, session } = await runAgent({
            role,
            sprint: sprint.number,
            cwd: WORKTREE,
            prompt: input,
            resume,
            schema: workSchema,
        });
        resume = session;
        saveState({ ...loadState(), sprint: { ...sprint, session } });
        if (output.status === 'halt')
            return { halt: `${role}: ${output.summary}` };
        if (output.status === 'need_owner') {
            const answer = await askWithStorybook(sprint.number, output);
            input = `Owner answer: ${answer}`;
            continue;
        }
        const changes = dirty(WORKTREE);
        if (changes) {
            if (cleanupAsked)
                return { halt: `${role} finished with uncommitted changes:\n${changes}` };
            cleanupAsked = true;
            input = `Uncommitted changes remain in the working copy:\n${changes}\nCommit them by the project rules or remove them if accidental, and finish the work.`;
            continue;
        }
        return output;
    }
}
async function askWithStorybook(sprint, output) {
    const question = output.question ?? output.summary;
    if (output.show !== 'storybook')
        return ask(sprint, 'a question mid-sprint', question);
    if (busyPorts([STORYBOOK_PORT]).length) {
        return ask(sprint, 'a question mid-sprint', `${question}\n\nStorybook: port ${STORYBOOK_PORT} is busy — open your own Storybook from ${WORKTREE}.`);
    }
    const storybook = startBackground('pnpm', ['storybook', '--ci'], WORKTREE, join(STATE_DIR, 'logs', `${sprint}-storybook.log`));
    try {
        const ready = await waitForOutput(storybook, /Storybook .* started|Local:/i, 180_000);
        const where = ready
            ? `Storybook from the working copy: http://localhost:${STORYBOOK_PORT} (a phone — http://${lanAddress()}:${STORYBOOK_PORT}).`
            : `Storybook did not come up in 3 minutes — journal ${join(STATE_DIR, 'logs', `${sprint}-storybook.log`)}.`;
        return await ask(sprint, 'a Storybook showing', `${question}\n\n${where}`);
    }
    finally {
        stopBackground(storybook);
    }
}
/** The planner assembles the composition on the sprint branch; it changes docs only. */
async function plan(sprint) {
    const result = await work('planner', sprint, prompt('planner', vars(sprint, {
        REPLAN: sprint.replan ?? 'none — the first assembly of the composition',
    })));
    if ('halt' in result)
        return result;
    const touched = changedFiles(WORKTREE, `${sprint.base}..HEAD`).filter((file) => !file.startsWith(instance.tasksDir));
    if (touched.length)
        return { halt: `the planner changed more than ${instance.tasksDir}: ${touched.join(', ')}` };
    let planned;
    try {
        planned = readSprint(WORKTREE, sprint.number);
    }
    catch (error) {
        return { halt: `the planner did not write the sprint file: ${error.message}` };
    }
    if (planned.tasks.length === 0 || planned.closed)
        return { halt: `${planned.file} has no tasks or the sprint is already closed` };
    console.log(`  Goal: ${planned.goal}\n${bulletList(planned.tasks.map((task) => task.text))}`);
    notify(`Sprint ${sprint.number} planned`, planned.goal.slice(0, 200));
    return to(sprint, 'implement', {
        file: planned.file,
        composition: head(WORKTREE),
        replan: null,
    });
}
async function implement(sprint) {
    const result = await work('implementer', sprint, prompt('implementer', vars(sprint)));
    if ('halt' in result)
        return result;
    if (result.status === 'replan') {
        if (!sprint.planned)
            return { halt: `the implementer asks to reassemble an agreed composition: ${result.summary}` };
        if (sprint.replans === 0) {
            console.log(`  The analysis overturned the composition — back to the planner.`);
            return to(sprint, 'plan', { replan: result.summary, replans: 1 });
        }
        const answer = await ask(sprint.number, 'the analysis overturned the composition again', `The planner has already reassembled the composition, and the analysis before start overturned it again:\n\n${result.summary}\n\nAnswer with an instruction for the planner.`);
        return to(sprint, 'plan', {
            replan: `${result.summary}\n\nOwner instruction: ${answer}`,
            replans: sprint.replans + 1,
        });
    }
    if (commitsAhead(WORKTREE, sprint.base) === 0)
        return { halt: 'the implementer finished without commits' };
    return to(sprint, 'gate');
}
/** The gate — verify, run by the conveyor itself: an agent's word "green" is not trusted. */
async function gate(sprint) {
    await waitForPorts(sprint.number, E2E_PORTS, 'e2e');
    const logFile = join(STATE_DIR, 'logs', `${sprint.number}-verify.log`);
    beginActivity(`${sprint.number} verify`, { events: false });
    const install = await run(INSTALL[0] ?? 'pnpm', INSTALL.slice(1), WORKTREE, logFile);
    const verify = install.code === 0 ? await run(GATE[0] ?? 'pnpm', GATE.slice(1), WORKTREE, logFile) : install;
    endActivity();
    console.log(`  verify: ${verify.code === 0 ? 'green' : 'red'}; journal ${logFile}`);
    if (verify.code === 0)
        return to(sprint, 'review');
    const details = `verify red. Output tail (full — ${logFile}):\n\n${tail(verify.output, 150)}`;
    if (sprint.round < MAX_FIX_ROUNDS) {
        return to(sprint, 'fix', { round: sprint.round + 1, fix: { reason: 'gate', details } });
    }
    const answer = await ask(sprint.number, 'the gate is red after the fixes', `verify is red after ${MAX_FIX_ROUNDS} fix rounds.\n\n${tail(verify.output, 40)}\n\nAnswer with an instruction for the fixer — the rounds start over.`);
    return to(sprint, 'fix', {
        round: 0,
        fix: { reason: 'owner', details: `Owner instruction: ${answer}\n\n${details}` },
    });
}
async function review(sprint) {
    const before = head(WORKTREE);
    const { output: verdict } = await runAgent({
        role: 'reviewer',
        sprint: sprint.number,
        cwd: WORKTREE,
        prompt: prompt('reviewer', vars(sprint, { VERIFY_LOG: join(STATE_DIR, 'logs', `${sprint.number}-verify.log`) })),
        schema: verdictSchema,
    });
    if (head(WORKTREE) !== before || dirty(WORKTREE)) {
        return {
            halt: `the reviewer changed the working copy (${WORKTREE}) — that must not happen, sort it out manually`,
        };
    }
    console.log(`  Verdict: ${verdict.verdict}. ${verdict.summary}`);
    const accepted = { remarks: verdict.remarks, ownerChecks: verdict.ownerChecks };
    if (verdict.verdict === 'ACCEPT')
        return to(sprint, 'close', accepted);
    const blockers = formatBlockers(verdict);
    if (sprint.round < MAX_FIX_ROUNDS) {
        return to(sprint, 'fix', {
            round: sprint.round + 1,
            fix: { reason: 'review', details: blockers },
        });
    }
    const answer = await ask(sprint.number, 'the reviewer rejects after the fixes', `After ${MAX_FIX_ROUNDS} fix rounds the reviewer gives REJECT.\n\n${blockers}\n\n"accept" — accept as is, the blockers go to the backlog; otherwise — an instruction for the fixer, the rounds start over.`);
    if (isAcceptAsIs(answer)) {
        const remarks = [
            ...verdict.remarks,
            ...verdict.blockers.map((blocker) => `${blocker.where} — ${blocker.problem} (blocker, accepted as is by the owner)`),
        ];
        return to(sprint, 'close', { ...accepted, remarks });
    }
    return to(sprint, 'fix', {
        round: 0,
        fix: {
            reason: 'owner',
            details: `Owner instruction: ${answer}\n\nReviewer blockers:\n${blockers}`,
        },
    });
}
async function fix(sprint) {
    if (sprint.fix === null)
        return to(sprint, 'gate');
    const result = await work('fixer', sprint, prompt('fixer', vars(sprint, { REASON: reasonText[sprint.fix.reason], DETAILS: sprint.fix.details })));
    if ('halt' in result)
        return result;
    return to(sprint, 'gate', { fix: null });
}
const reasonText = {
    gate: 'the verify gate is red',
    review: 'the reviewer returned the sprint with blockers',
    owner: "the owner's instruction after the exhausted fix rounds",
};
async function close(sprint) {
    const before = head(WORKTREE);
    const result = await work('closer', sprint, prompt('closer', vars(sprint, {
        VERIFY_LOG: join(STATE_DIR, 'logs', `${sprint.number}-verify.log`),
        REMARKS: bulletList(sprint.remarks),
        OWNER_CHECKS: bulletList(sprint.ownerChecks),
    })));
    if ('halt' in result)
        return result;
    const touched = changedFiles(WORKTREE, `${before}..HEAD`).filter((file) => !file.startsWith(instance.tasksDir));
    if (touched.length)
        return { halt: `the closer changed more than ${instance.tasksDir}: ${touched.join(', ')}` };
    if (!readSprint(WORKTREE, sprint.number).closed)
        return { halt: 'the closer did not write the retro' };
    return to(sprint, 'merge');
}
async function merge(sprint) {
    const rebase = rebaseOntoMain(sprint.base);
    if ('conflict' in rebase) {
        await ask(sprint.number, 'a conflict with main', `main moved ahead and the branch ${sprint.branch} does not rebase onto it without a conflict:\n\n${tail(rebase.conflict, 30)}\n\nResolve it manually in ${WORKTREE} (git rebase main) and answer "done".`);
        return to(sprint, 'merge');
    }
    const code = rebase.files.filter((file) => !file.startsWith(instance.tasksDir));
    if (code.length) {
        // Code arrived in main — the gate runs again, on the rebased branch.
        await waitForPorts(sprint.number, E2E_PORTS, 'e2e');
        const logFile = join(STATE_DIR, 'logs', `${sprint.number}-verify-rebase.log`);
        beginActivity(`${sprint.number} verify after rebasing onto main`, { events: false });
        const install = await run(INSTALL[0] ?? 'pnpm', INSTALL.slice(1), WORKTREE, logFile);
        const verify = install.code === 0 ? await run(GATE[0] ?? 'pnpm', GATE.slice(1), WORKTREE, logFile) : install;
        endActivity();
        if (verify.code !== 0)
            return {
                halt: `after rebasing onto main (new code there: ${code.join(', ')}) verify is red, journal ${logFile}`,
            };
    }
    const problem = fastForwardMain(sprint.branch);
    if (problem) {
        await ask(sprint.number, 'main does not accept the sprint', `${problem}\n\nFree main and answer "done".`);
        return to(sprint, 'merge');
    }
    git(WORKTREE, 'switch', '--detach', 'main');
    git(REPO, 'branch', '-d', sprint.branch);
    console.log(`  Sprint ${sprint.number} merged into main.`);
    return to(sprint, 'push');
}
/** Push main; with CI — wait for the run: red means a stop, the next sprint does not start. */
async function push(sprint) {
    const problem = pushMain();
    if (problem)
        return { halt: `pushing main failed:\n${tail(problem, 20)}` };
    console.log('  main pushed.');
    if (!hasWorkflows())
        return { closed: true };
    // The run does not appear instantly after the push — look it up by commit for up to 5 minutes.
    const sha = git(REPO, 'rev-parse', 'main');
    let runId = '';
    for (let attempt = 0; attempt < 20 && !runId; attempt++) {
        await sleep(15_000);
        const list = trySh('gh', ['run', 'list', '--commit', sha, '--json', 'databaseId', '--jq', '.[0].databaseId'], REPO);
        if (list.code !== 0)
            return { halt: `gh run list failed (is gh authorized?):\n${list.output}` };
        runId = list.output;
    }
    if (!runId)
        return { halt: `CI did not start on ${sha.slice(0, 7)} within 5 minutes` };
    const logFile = join(STATE_DIR, 'logs', `${sprint.number}-ci.log`);
    beginActivity(`${sprint.number} CI ${runId}`, { events: false });
    const watch = await run('gh', ['run', 'watch', runId, '--exit-status'], REPO, logFile);
    endActivity();
    if (watch.code !== 0)
        return {
            halt: `CI red (run ${runId}) — nothing shipped. gh run view ${runId} --log-failed; journal ${logFile}`,
        };
    console.log(`  CI green (run ${runId}).`);
    return { closed: true };
}
async function waitForPorts(sprint, ports, purpose) {
    if (ports.length === 0)
        return;
    // The owner is walking the check queue — wait silently, no question needed here.
    while (checksServing())
        await sleep(10_000);
    for (;;) {
        const busy = busyPorts(ports);
        if (busy.length === 0)
            return;
        await ask(sprint, 'ports are busy', `${purpose} needs ports ${busy.join(', ')}, they are busy (a preview for a phone, a dev server?). Stop them and answer "done".`);
    }
}
/** A margin after the limit reset: the provider counter does not tick second-precise. */
const LIMIT_MARGIN_MS = 2 * 60_000;
/** The reset time is unknown — try again in half an hour. */
const LIMIT_RETRY_MS = 30 * 60_000;
/** Waits for the provider limit reset; `solosprint-conveyor stop` interrupts the wait. */
async function waitForLimitReset(sprint, resetsAt) {
    const until = (resetsAt ?? Date.now() + LIMIT_RETRY_MS - LIMIT_MARGIN_MS) + LIMIT_MARGIN_MS;
    const at = new Date(until).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
    console.log(`\n  The provider limit is exhausted — I continue on my own at ${at}.`);
    notify(`Sprint ${sprint}: provider limit`, `The conveyor continues on its own at ${at}`);
    waitActivity(`waiting for the limit reset until ${at}`);
    try {
        // A machine sleep stops timers — check the clock instead of sleeping in one chunk.
        while (Date.now() < until) {
            if (stopRequested())
                throw new StopRequested();
            await sleep(30_000);
        }
    }
    finally {
        endActivity();
    }
}
