# Adapter contract

The conveyor knows nothing about a specific agent CLI. A provider adapter
implements this contract; the conveyor runs every role session through it.
One adapter ships as the reference implementation (OpenCode); an adapter
for another provider is a new implementation of this interface, nothing
else changes in the pipeline.

## One role session

The conveyor asks the adapter to run one role session:

```ts
type Role = 'planner' | 'implementer' | 'fixer' | 'reviewer' | 'closer';

type SessionRequest = {
  /** Role and sprint: naming, logs, and the reviewer's restrictions. */
  role: Role;
  sprint: number;
  /** Working directory of the session. */
  cwd: string;
  /** The role prompt, assembled by the conveyor from prompts/*.md. */
  prompt: string;
  /** Zod schema of the structured result the conveyor expects. */
  schema: ZodType<unknown>;
  /** Resume an existing session (owner answered, or a previous run broke). */
  resume?: string | null;
};
```

The adapter:

- spawns a **headless session** in `cwd` with the prompt;
- streams **events** for the feed and the journal;
- enforces the **permission mode**: nothing that would require a human is
  allowed; the reviewer session additionally has **no editing tools**;
- applies a **budget cap** when configured;
- returns the **structured result** validated against the schema, the
  session id, and the usage summary.

## Events

The adapter emits line-delimited JSON events. The conveyor renders a
human-readable line per event into the feed and writes the raw stream to
the session journal. The contract defines three shapes:

```ts
type AdapterEvent =
  | { type: 'progress'; text: string }        // one feed line
  | { type: 'limits'; value: unknown }        // optional provider limit info
  | {
      type: 'result';
      ok: boolean;
      session: string | null;
      output?: unknown;                        // structured result
      usage?: {
        inputTokens?: number;
        cachedTokens?: number;
        outputTokens?: number;
        costUsd?: number;
        turns?: number;
        durationMs?: number;
      };
      error?: string;
    };
```

A result with `ok: false` may carry the reason (an error or an exhausted
budget). When the provider emits limit information (for example a
subscription reset time), the adapter translates it into a `limits`
event; a provider without such events simply emits none.

## Requirements an adapter must meet

| Concern | Requirement |
| --- | --- |
| Headless run | Run a session from a process, no interactive terminal |
| Streaming | Emit events as the session works, not only at the end |
| Resume | Continue a session by id within its phase |
| Permissions | Deny anything needing a human; deny edits for the reviewer |
| Structured result | Return validated structured output (schema enforcement by the provider, or model JSON validated by the adapter) |
| Budget | Optional per-session cap |
| Usage | Report tokens and, when the provider gives one, a cost estimate |

## Test stub

For testing the pipeline without a provider, the contract comes with a
stub: a fake binary that emits a canned event stream and a canned
structured result. The conveyor reads the adapter binary path from an
environment variable; the stub replaces it in tests and trial runs.
