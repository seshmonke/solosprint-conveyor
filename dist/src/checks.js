import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { instance, LIVE_PORTS, REPO, STATE_DIR, STORYBOOK_PORT } from "./config.js";
import { isPassed, lanAddress } from "./decide.js";
import { git } from "./git.js";
import { busyPorts, isAlive, run, startBackground, stopBackground, waitForOutput, } from "./shell.js";
import { addBacklogTask, markChecksDone, pendingChecks, readSprint, sprintNumbers, } from "./sprint.js";
// The owner-check queue — docs/conveyor.md: live verification and showings of
// merged sprints accumulate in the sprint files and are walked in batches.
const servingFile = join(STATE_DIR, 'checks.pid');
/** Unmarked checks of closed sprints in main: an open sprint has nothing to look at yet. */
export function checkQueue() {
    return sprintNumbers(REPO)
        .map((number) => readSprint(REPO, number))
        .filter((sprint) => sprint.closed)
        .map((sprint) => ({ number: sprint.number, file: sprint.file, items: pendingChecks(sprint) }))
        .filter((pending) => pending.items.length > 0);
}
export function formatQueue(queue) {
    if (queue.length === 0)
        return 'The check queue is empty.';
    return queue
        .map(({ number, items }) => `Sprint ${number}:\n${items.map((item) => `  - ${item}`).join('\n')}`)
        .join('\n');
}
/**
 * A check result: the items are marked with a commit in main; not "ok" — the
 * remarks go to the backlog as a P0 task, taken by the planner first.
 */
export function recordCheck(number, answer) {
    const sprint = readSprint(REPO, number);
    if (pendingChecks(sprint).length === 0)
        throw new Error(`Sprint ${number} has no unmarked checks.`);
    const date = new Date().toLocaleDateString('en-GB');
    const passed = isPassed(answer);
    const sprintPath = join(REPO, sprint.file);
    writeFileSync(sprintPath, markChecksDone(readFileSync(sprintPath, 'utf8'), passed
        ? `Checked by the owner on ${date}: passed.`
        : `Checked by the owner on ${date}: remarks — a task "From owner check of sprint ${number}" in [backlog](${instance.backlog}).`));
    const files = [sprint.file];
    if (!passed) {
        const backlogPath = join(REPO, instance.backlog);
        writeFileSync(backlogPath, addBacklogTask(readFileSync(backlogPath, 'utf8'), `- \`P0\` **From owner check of sprint ${number}** — ${answer} The owner, ${date}.`));
        files.push(instance.backlog);
    }
    const message = passed
        ? `Sprint ${number}: owner check passed`
        : `Sprint ${number}: owner check remarks — into the backlog`;
    // `commit -- paths` takes only these files: whatever the owner keeps in the index stays untouched.
    git(REPO, 'commit', '-m', message, '--', ...files);
    return message;
}
/** The check queue is being served — the conveyor gate waits, the ports are shared. */
export function checksServing() {
    if (!existsSync(servingFile))
        return false;
    return isAlive(Number(readFileSync(servingFile, 'utf8')));
}
/** The instance's check serving: sync steps, then background servers, until Ctrl+C. */
export async function serveChecks() {
    const busy = busyPorts([...LIVE_PORTS, STORYBOOK_PORT]);
    if (busy.length)
        throw new Error(`Ports ${busy.join(', ')} are busy — stop the dev server, preview, or Storybook.`);
    mkdirSync(join(STATE_DIR, 'logs'), { recursive: true });
    writeFileSync(servingFile, String(process.pid));
    const logs = (name) => join(STATE_DIR, 'logs', `checks-${name}.log`);
    const servers = [];
    try {
        for (const step of instance.checksServe.steps) {
            console.log(`  ${step.label}…`);
            const result = await run(step.cmd[0] ?? '', step.cmd.slice(1), REPO, logs(step.label));
            if (result.code !== 0)
                throw new Error(`Step ${step.label} failed, journal ${logs(step.label)}`);
        }
        for (const server of instance.checksServe.servers) {
            servers.push(startBackground(server.cmd[0] ?? '', server.cmd.slice(1), REPO, logs(server.label)));
        }
        const ready = await Promise.all(servers.map((child, index) => {
            const server = instance.checksServe.servers[index];
            return server === undefined
                ? Promise.resolve(true)
                : waitForOutput(child, new RegExp(server.ready), 180_000);
        }));
        if (!ready.every(Boolean)) {
            const names = instance.checksServe.servers.map((server) => logs(server.label)).join(', ');
            throw new Error(`A server did not come up, journals ${names}`);
        }
        if (instance.checksServe.intro)
            console.log(`\n${instance.checksServe.intro}\n`);
        console.log(`Home network address for a phone: ${lanAddress()}. Result — solosprint-conveyor check N ok | "remarks". End the serving — Ctrl+C.`);
        await new Promise((resolve) => {
            process.once('SIGINT', resolve);
            process.once('SIGTERM', resolve);
        });
    }
    finally {
        for (const server of servers)
            stopBackground(server);
        rmSync(servingFile, { force: true });
    }
}
