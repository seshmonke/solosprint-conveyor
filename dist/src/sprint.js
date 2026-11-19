import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { instance } from "./config.js";
const escape = (text) => text.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function sprintFileName(dir, number) {
    const prefix = `${String(number).padStart(2, '0')}-`;
    const found = readdirSync(dir).filter((name) => name.startsWith(prefix) && name.endsWith('.md'));
    if (found.length !== 1) {
        throw new Error(`Sprint ${number}: expected one file ${prefix}*.md in ${dir}, found ${found.length}`);
    }
    return found[0];
}
/** Sprint numbers from `NN-*.md` files, ascending. */
export function sprintNumbers(repo) {
    return readdirSync(join(repo, instance.tasksDir))
        .map((name) => /^(\d+)-.*\.md$/.exec(name)?.[1])
        .filter((digits) => digits !== undefined)
        .map(Number)
        .sort((a, b) => a - b);
}
export function nextSprintNumber(repo) {
    return (sprintNumbers(repo).at(-1) ?? 0) + 1;
}
export function readSprint(repo, number) {
    const name = sprintFileName(join(repo, instance.tasksDir), number);
    const file = `${instance.tasksDir}/${name}`;
    return { number, file, ...parseSprint(readFileSync(join(repo, file), 'utf8')) };
}
export function parseSprint(text) {
    const goalPattern = new RegExp(`^${escape(instance.headings.goal)}\\s*(.*)$`, 'm');
    const goal = goalPattern.exec(text)?.[1]?.trim() ?? '';
    return {
        goal,
        tasks: parseChecklist(text, instance.headings.tasks),
        checks: parseChecklist(text, instance.headings.ownerChecks),
        closed: new RegExp(`^${escape(instance.headings.retro)}`, 'm').test(text),
    };
}
function parseChecklist(text, heading) {
    const items = [];
    let inside = false;
    for (const line of text.split('\n')) {
        if (line.startsWith('## ')) {
            inside = line.trim() === heading;
            continue;
        }
        if (!inside)
            continue;
        const item = /^- \[( |x)\] (.*)$/.exec(line);
        if (item) {
            items.push({ done: item[1] === 'x', text: item[2] ?? '' });
            continue;
        }
        const last = items.at(-1);
        if (last && /^\s+\S/.test(line)) {
            last.text += ` ${line.trim()}`;
        }
    }
    return items;
}
export function pendingChecks(sprint) {
    return sprint.checks.filter((check) => !check.done).map((check) => check.text);
}
/** The owner passed the check: the items get marked, the verdict is a line after the section. */
export function markChecksDone(text, note) {
    const heading = instance.headings.ownerChecks;
    const lines = text.split('\n');
    const start = lines.findIndex((line) => line.trim() === heading);
    if (start === -1)
        throw new Error(`The sprint file has no "${heading}" section`);
    let end = lines.findIndex((line, index) => index > start && line.startsWith('## '));
    if (end === -1)
        end = lines.length;
    const section = lines
        .slice(start, end)
        .map((line) => line.replace(/^- \[ \] /, '- [x] '))
        .join('\n')
        .trimEnd();
    const before = lines.slice(0, start).join('\n');
    const after = lines.slice(end).join('\n');
    return `${before}\n${section}\n\n${note}\n${after ? `\n${after}` : ''}`;
}
/** A task to the top of the backlog's task section. */
export function addBacklogTask(backlog, task) {
    const marker = `${instance.headings.tasks}\n\n`;
    const at = backlog.indexOf(marker);
    if (at === -1)
        throw new Error(`The backlog has no "${instance.headings.tasks}" section`);
    const insert = at + marker.length;
    return `${backlog.slice(0, insert)}${task}\n${backlog.slice(insert)}`;
}
