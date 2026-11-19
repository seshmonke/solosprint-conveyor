import { spawn } from 'node:child_process';
import { appendFileSync, createWriteStream, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { beginActivity, endActivity, touchActivity } from "./activity.js";
import { ADAPTER_BIN, MAX_BUDGET_USD, STATE_DIR } from "./config.js";
import { agentEnv, describeEvent } from "./progress.js";
import { formatCostRow, formatTokens, readTokens, usageSchema, } from "./usage.js";
/** The result of a planner, implementer, fixer, or closer; `replan` — only the implementer of a planned sprint. */
export const workSchema = z.object({
    status: z.enum(['done', 'need_owner', 'halt', 'replan']),
    summary: z.string(),
    question: z.string().nullable(),
    show: z.enum(['none', 'storybook']),
});
export const verdictSchema = z.object({
    verdict: z.enum(['ACCEPT', 'REJECT']),
    summary: z.string(),
    blockers: z.array(z.object({
        where: z.string(),
        problem: z.string(),
        scenario: z.string(),
        expected: z.string(),
    })),
    remarks: z.array(z.string()),
    ownerChecks: z.array(z.string()),
});
const resultEvent = z.object({
    type: z.literal('result'),
    ok: z.boolean(),
    session: z.string().nullable(),
    output: z.unknown().optional(),
    usage: usageSchema.optional(),
    error: z.string().optional(),
});
const limitsEvent = z.object({
    type: z.literal('limits'),
    /** The provider limit resets at this time, ms Unix; unknown — null. */
    resetsAt: z.number().nullable().optional(),
});
export class AgentError extends Error {
    session;
    constructor(message, session) {
        super(message);
        this.session = session;
    }
}
/** The session hit the provider limit: the conveyor waits for the reset and resumes. */
export class LimitReached extends AgentError {
    resetsAt;
    constructor(message, session, resetsAt) {
        super(message, session);
        this.resetsAt = resetsAt;
    }
}
export function prompt(name, values) {
    const template = readFileSync(join(import.meta.dirname, '../prompts', `${name}.md`), 'utf8');
    return template.replaceAll(/\{([A-Z_]+)\}/g, (match, key) => values[key] ?? match);
}
const [bin, ...binArgs] = ADAPTER_BIN.split(' ').filter(Boolean);
export async function runAgent(options) {
    const { role, sprint, cwd, schema } = options;
    const logs = join(STATE_DIR, 'logs');
    mkdirSync(logs, { recursive: true });
    const stamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
    const logFile = join(logs, `${sprint}-${role}-${stamp}.jsonl`);
    const args = [
        ...binArgs,
        '--role',
        role,
        '--sprint',
        String(sprint),
        '--cwd',
        cwd,
    ];
    if (options.resume)
        args.push('--session', options.resume);
    if (MAX_BUDGET_USD)
        args.push('--budget-usd', MAX_BUDGET_USD);
    const say = (text) => {
        console.log(`  [${sprint} ${role}] ${text}`);
    };
    say(`start${options.resume ? `, resume session ${options.resume}` : ''}; journal ${logFile}`);
    beginActivity(`${sprint} ${role}`, { events: true });
    const limits = { resetsAt: null };
    const result = await new Promise((resolve) => {
        const child = spawn(bin, args, {
            cwd,
            env: agentEnv(process.env),
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        const log = createWriteStream(logFile);
        child.stdin.write(options.prompt);
        child.stdin.end();
        let buffer = '';
        let last = null;
        child.stdout.on('data', (chunk) => {
            touchActivity();
            log.write(chunk);
            buffer += chunk.toString();
            let newline = buffer.indexOf('\n');
            while (newline !== -1) {
                const line = buffer.slice(0, newline);
                buffer = buffer.slice(newline + 1);
                newline = buffer.indexOf('\n');
                const event = parseLine(line);
                if (event === null)
                    continue;
                for (const progress of describeEvent(event))
                    say(progress);
                const now = limitsEvent.safeParse(event);
                if (now.success && now.data.resetsAt !== undefined)
                    limits.resetsAt = now.data.resetsAt;
                const parsed = resultEvent.safeParse(event);
                if (parsed.success)
                    last = parsed.data;
            }
        });
        child.stderr.on('data', (chunk) => log.write(chunk));
        child.on('error', (error) => {
            endActivity();
            say(`did not start ${ADAPTER_BIN}: ${error.message}`);
            log.end();
            resolve(null);
        });
        child.on('close', () => {
            endActivity();
            log.end();
            resolve(last);
        });
    });
    const failed = result === null || !result.ok;
    if (failed && (limits.resetsAt !== null || isLimitMessage(result?.error ?? ''))) {
        throw new LimitReached(`the ${role} session hit the provider limit; journal ${logFile}`, result?.session ?? null, limits.resetsAt);
    }
    if (result === null)
        throw new AgentError(`the ${role} session ended without a result, journal ${logFile}`, null);
    const tokens = readTokens(result.usage);
    appendFileSync(join(STATE_DIR, 'costs.tsv'), `${formatCostRow({
        time: new Date().toISOString(),
        sprint,
        role,
        session: result.session ?? '',
        usd: result.usage?.costUsd ?? null,
        turns: result.usage?.turns ?? null,
        ms: result.usage?.durationMs ?? null,
        tokens,
    })}\n`);
    if (!result.ok) {
        throw new AgentError(`the ${role} session failed: ${result.error ?? 'no text'}; journal ${logFile}`, result.session);
    }
    const output = schema.safeParse(result.output);
    if (!output.success) {
        throw new AgentError(`the ${role} session returned no structured result; journal ${logFile}`, result.session);
    }
    const spent = [`done · $${(result.usage?.costUsd ?? 0).toFixed(2)}`];
    if (tokens)
        spent.push(formatTokens(tokens));
    say(spent.join(' · '));
    return { output: output.data, session: result.session ?? '' };
}
/** The session error text looks like an exhausted provider limit. */
const isLimitMessage = (text) => /usage limit|rate limit|limit reached/i.test(text);
function parseLine(line) {
    if (!line.trim())
        return null;
    try {
        return JSON.parse(line);
    }
    catch {
        return null;
    }
}
