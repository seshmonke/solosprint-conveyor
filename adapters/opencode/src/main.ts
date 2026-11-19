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

import { OpenCode } from '@opencode/sdk';

const arg = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
};

const role = arg('--role') ?? 'implementer';
const sprint = Number(arg('--sprint') ?? '0');
const cwd = arg('--cwd') ?? process.cwd();
const resume = arg('--session');
const budgetUsd = arg('--budget-usd');

const emit = (event: unknown) => process.stdout.write(`${JSON.stringify(event)}\n`);
const say = (text: string) => emit({ type: 'progress', text });

const readStdin = () =>
  new Promise<string>((resolve) => {
    let text = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk: string) => {
      text += chunk;
    });
    process.stdin.on('end', () => resolve(text));
  });

type Event = {
  type?: string;
  sessionID?: string;
  [key: string]: unknown;
};

/** Extracts the structured result: the final assistant message as JSON. */
const parseOutput = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    const block = /\{[\s\S]*\}/.exec(text)?.[0];
    if (!block) return null;
    try {
      return JSON.parse(block) as unknown;
    } catch {
      return null;
    }
  }
};

const main = async (): Promise<void> => {
  const promptText = await readStdin();
  if (!promptText.trim()) {
    emit({ type: 'result', ok: false, session: resume, error: 'empty prompt on stdin' });
    return;
  }
  const agent = role === 'reviewer' ? 'plan' : 'build';
  say(`starting a ${role} session on ${agent} in ${cwd}`);

  await using host = await OpenCode.create();

  let sessionID: string;
  if (resume) {
    sessionID = resume;
    say(`resuming session ${sessionID}`);
  } else {
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
  let usage: Record<string, unknown> = {};
  let failed = false;
  const idleGate: { resolve: (() => void) | undefined } = { resolve: undefined };
  const idle = new Promise<void>((resolve) => {
    idleGate.resolve = resolve;
  });

  const eventsAbort = new AbortController();
  const eventsDone = (async () => {
    try {
      const stream = host.events.subscribe(undefined, { signal: eventsAbort.signal });
      for await (const raw of stream) {
        const event = raw as Event;
        if (event.sessionID !== undefined && event.sessionID !== sessionID) continue;
        switch (event.type) {
          case 'session.text.delta':
            if (typeof event.text === 'string') lastMessage += event.text;
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
              usage = event.usage as Record<string, unknown>;
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
    } catch {
      // The stream was aborted at the end of the run.
    }
  })();

  const TOTAL_TIMEOUT_MS = Number(process.env['SOLOSPRINT_SESSION_TIMEOUT_MS'] ?? 900_000);
  const timedOut = new Promise<'timeout'>((resolve) => {
    setTimeout(() => resolve('timeout'), TOTAL_TIMEOUT_MS).unref();
  });
  const promptDone = host.sessions
    .prompt({ sessionID, text: promptText })
    .then(() => 'prompted' as const)
    .catch((error: unknown) => {
      failed = true;
      say(`session error: ${error instanceof Error ? error.message : String(error)}`);
      return 'failed' as const;
    });

  const outcome = await Promise.race([promptDone, timedOut]);
  if (outcome !== 'timeout') {
    // After the prompt there may be no idle event at all (for example a
    // provider-less host that answers with an error part) — a quiet grace
    // period closes the session instead of hanging forever.
    await Promise.race([
      idle,
      new Promise<void>((resolve) => setTimeout(resolve, 60_000).unref()),
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

  const costUsd = typeof usage['costUsd'] === 'number' ? (usage['costUsd'] as number) : undefined;
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
  await Promise.race([host.close(), new Promise((resolve) => setTimeout(resolve, 3000))]).catch(
    () => undefined,
  );
  process.exit(0);
};

const numberField = (usage: Record<string, unknown>, names: string[]): number | undefined => {
  for (const name of names) {
    const value = usage[name];
    if (typeof value === 'number') return value;
  }
  return undefined;
};

const describeTool = (event: Event): string => {
  const input = (event.tool ?? event.call ?? {}) as Record<string, unknown>;
  const name = String(input['name'] ?? input['tool'] ?? 'tool');
  const target =
    input['input'] && typeof input['input'] === 'object'
      ? (input['input'] as Record<string, unknown>)['command'] ??
        (input['input'] as Record<string, unknown>)['file_path'] ??
        (input['input'] as Record<string, unknown>)['pattern']
      : undefined;
  const flat = String(target ?? '').replaceAll(/\s+/g, ' ').trim();
  return `${name}${flat ? ` ${flat.slice(0, 100)}` : ''}`;
};

main().catch((error: unknown) => {
  emit({ type: 'result', ok: false, session: resume, error: String(error) });
  process.exitCode = 1;
});
