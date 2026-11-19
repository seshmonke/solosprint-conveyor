#!/usr/bin/env node
// The reference SoloSprint Conveyor adapter — docs/reference-opencode.md.
// One process runs one role session: it reads the role prompt from stdin,
// streams contract events to stdout, and ends with a result event carrying
// the model's JSON (the conveyor validates it against the role schema).
//
// Roles map to OpenCode built-in agents: the reviewer runs on `plan` (reads
// and plans without editing normal project files), the working roles run on
// `build`. The instance's project permissions apply to the worktree sessions,
// and anything the permission system would ask a human for is rejected.
var __addDisposableResource = (this && this.__addDisposableResource) || function (env, value, async) {
    if (value !== null && value !== void 0) {
        if (typeof value !== "object" && typeof value !== "function") throw new TypeError("Object expected.");
        var dispose, inner;
        if (async) {
            if (!Symbol.asyncDispose) throw new TypeError("Symbol.asyncDispose is not defined.");
            dispose = value[Symbol.asyncDispose];
        }
        if (dispose === void 0) {
            if (!Symbol.dispose) throw new TypeError("Symbol.dispose is not defined.");
            dispose = value[Symbol.dispose];
            if (async) inner = dispose;
        }
        if (typeof dispose !== "function") throw new TypeError("Object not disposable.");
        if (inner) dispose = function() { try { inner.call(this); } catch (e) { return Promise.reject(e); } };
        env.stack.push({ value: value, dispose: dispose, async: async });
    }
    else if (async) {
        env.stack.push({ async: true });
    }
    return value;
};
var __disposeResources = (this && this.__disposeResources) || (function (SuppressedError) {
    return function (env) {
        function fail(e) {
            env.error = env.hasError ? new SuppressedError(e, env.error, "An error was suppressed during disposal.") : e;
            env.hasError = true;
        }
        var r, s = 0;
        function next() {
            while (r = env.stack.pop()) {
                try {
                    if (!r.async && s === 1) return s = 0, env.stack.push(r), Promise.resolve().then(next);
                    if (r.dispose) {
                        var result = r.dispose.call(r.value);
                        if (r.async) return s |= 2, Promise.resolve(result).then(next, function(e) { fail(e); return next(); });
                    }
                    else s |= 1;
                }
                catch (e) {
                    fail(e);
                }
            }
            if (s === 1) return env.hasError ? Promise.reject(env.error) : Promise.resolve();
            if (env.hasError) throw env.error;
        }
        return next();
    };
})(typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
});
import { OpenCode } from '@opencode/sdk';
const arg = (name) => {
    const index = process.argv.indexOf(name);
    return index === -1 ? undefined : process.argv[index + 1];
};
const role = arg('--role') ?? 'implementer';
const sprint = Number(arg('--sprint') ?? '0');
const cwd = arg('--cwd') ?? process.cwd();
const resume = arg('--session');
const budgetUsd = arg('--budget-usd');
const emit = (event) => process.stdout.write(`${JSON.stringify(event)}\n`);
const say = (text) => emit({ type: 'progress', text });
const readStdin = () => new Promise((resolve) => {
    let text = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
        text += chunk;
    });
    process.stdin.on('end', () => resolve(text));
});
/** Extracts the structured result: the final assistant message as JSON. */
const parseOutput = (text) => {
    try {
        return JSON.parse(text);
    }
    catch {
        const block = /\{[\s\S]*\}/.exec(text)?.[0];
        if (!block)
            return null;
        try {
            return JSON.parse(block);
        }
        catch {
            return null;
        }
    }
};
const main = async () => {
    const env_1 = { stack: [], error: void 0, hasError: false };
    try {
        const promptText = await readStdin();
        if (!promptText.trim()) {
            emit({ type: 'result', ok: false, session: resume, error: 'empty prompt on stdin' });
            return;
        }
        const agent = role === 'reviewer' ? 'plan' : 'build';
        say(`starting a ${role} session on ${agent} in ${cwd}`);
        const host = __addDisposableResource(env_1, await OpenCode.create(), true);
        let sessionID;
        if (resume) {
            sessionID = resume;
            say(`resuming session ${sessionID}`);
        }
        else {
            const session = await host.sessions.create({
                location: { directory: cwd },
                agent,
                title: `conveyor-${sprint}-${role}`,
            });
            sessionID = session.id;
            say(`session ${sessionID}`);
        }
        const started = Date.now();
        let lastMessage = '';
        let usage = {};
        let failed = false;
        const idleGate = { resolve: undefined };
        const idle = new Promise((resolve) => {
            idleGate.resolve = resolve;
        });
        const eventsAbort = new AbortController();
        const eventsDone = (async () => {
            try {
                const stream = host.events.subscribe(undefined, { signal: eventsAbort.signal });
                for await (const raw of stream) {
                    const event = raw;
                    if (event.sessionID !== undefined && event.sessionID !== sessionID)
                        continue;
                    switch (event.type) {
                        case 'session.text.delta':
                            if (typeof event.text === 'string')
                                lastMessage += event.text;
                            break;
                        case 'session.step.ended':
                            lastMessage = '';
                            break;
                        case 'session.tool.called':
                            say(describeTool(event));
                            break;
                        case 'permission.asked':
                            await host.permission.reply({
                                sessionID,
                                requestID: String(event.requestID),
                                decision: 'reject',
                                message: 'the conveyor runs unattended: nothing requiring a human',
                            });
                            say(`denied a permission request: ${String(event.action ?? event.type ?? '?')}`);
                            break;
                        case 'session.usage.updated':
                            if (event.usage && typeof event.usage === 'object')
                                usage = event.usage;
                            break;
                        case 'session.execution.failed':
                            failed = true;
                            idleGate.resolve?.();
                            break;
                        case 'session.idle':
                            idleGate.resolve?.();
                            break;
                    }
                }
            }
            catch {
                // The stream was aborted at the end of the run.
            }
        })();
        const TOTAL_TIMEOUT_MS = Number(process.env['SOLOSPRINT_SESSION_TIMEOUT_MS'] ?? 900_000);
        const timedOut = new Promise((resolve) => {
            setTimeout(() => resolve('timeout'), TOTAL_TIMEOUT_MS).unref();
        });
        const promptDone = host.sessions
            .prompt({ sessionID, text: promptText })
            .then(() => 'prompted')
            .catch((error) => {
            failed = true;
            say(`session error: ${error instanceof Error ? error.message : String(error)}`);
            return 'failed';
        });
        const outcome = await Promise.race([promptDone, timedOut]);
        if (outcome !== 'timeout') {
            // After the prompt there may be no idle event at all (for example a
            // provider-less host that answers with an error part) — a quiet grace
            // period closes the session instead of hanging forever.
            await Promise.race([
                idle,
                new Promise((resolve) => setTimeout(resolve, 60_000).unref()),
            ]);
        }
        eventsAbort.abort();
        await Promise.race([eventsDone, new Promise((resolve) => setTimeout(resolve, 1000).unref())]);
        if (outcome === 'timeout') {
            emit({
                type: 'result',
                ok: false,
                session: sessionID,
                error: `the session did not finish within ${TOTAL_TIMEOUT_MS} ms`,
            });
            process.exit(0);
        }
        const costUsd = typeof usage['costUsd'] === 'number' ? usage['costUsd'] : undefined;
        if (budgetUsd && costUsd !== undefined && costUsd > Number(budgetUsd)) {
            emit({ type: 'limits', resetsAt: null });
            emit({
                type: 'result',
                ok: false,
                session: sessionID,
                error: `budget exceeded: $${costUsd.toFixed(2)} over the cap of $${budgetUsd}`,
            });
            return;
        }
        const output = parseOutput(lastMessage.trim());
        emit({
            type: 'result',
            ok: !failed && output !== null,
            session: sessionID,
            output: output ?? undefined,
            usage: {
                inputTokens: numberField(usage, ['inputTokens', 'input_tokens']),
                cachedTokens: numberField(usage, ['cachedTokens', 'cacheReadTokens', 'cache_read_input_tokens']),
                outputTokens: numberField(usage, ['outputTokens', 'output_tokens']),
                costUsd,
                durationMs: Date.now() - started,
            },
            error: failed ? 'the session failed' : output === null ? 'the session returned no JSON result' : undefined,
        });
        say(`done in ${Date.now() - started} ms`);
        // Let the aborted stream unwind, then close the host with a bounded wait;
        // an abrupt exit on a live stream aborts the native layer.
        await new Promise((resolve) => setTimeout(resolve, 300));
        await Promise.race([host.close(), new Promise((resolve) => setTimeout(resolve, 3000))]).catch(() => undefined);
        process.exit(0);
    }
    catch (e_1) {
        env_1.error = e_1;
        env_1.hasError = true;
    }
    finally {
        const result_1 = __disposeResources(env_1);
        if (result_1)
            await result_1;
    }
};
const numberField = (usage, names) => {
    for (const name of names) {
        const value = usage[name];
        if (typeof value === 'number')
            return value;
    }
    return undefined;
};
const describeTool = (event) => {
    const input = (event.tool ?? event.call ?? {});
    const name = String(input['name'] ?? input['tool'] ?? 'tool');
    const target = input['input'] && typeof input['input'] === 'object'
        ? input['input']['command'] ??
            input['input']['file_path'] ??
            input['input']['pattern']
        : undefined;
    const flat = String(target ?? '').replaceAll(/\s+/g, ' ').trim();
    return `${name}${flat ? ` ${flat.slice(0, 100)}` : ''}`;
};
main().catch((error) => {
    emit({ type: 'result', ok: false, session: resume, error: String(error) });
    process.exitCode = 1;
});
