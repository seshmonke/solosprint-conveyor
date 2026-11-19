# Reference OpenCode adapter

The shipped adapter runs conveyor role sessions on **OpenCode**. It
implements the [adapter contract](adapter-contract.md) and is the proof
that the contract is provider-agnostic.

## Architecture

The conveyor spawns the adapter as a subprocess (the binary path comes
from an environment variable — the same seam the test stub replaces). The
adapter is a thin CLI around the **OpenCode SDK** (`@opencode/sdk`),
which hosts an OpenCode server in-process: no HTTP listener, no network
hop, no interactive terminal.

Per role session the adapter:

1. creates a session in the working directory
   (`opencode.sessions.create({ location: { directory: cwd } })`), or
   reuses the session id when resuming within a phase;
2. sends the role prompt (`opencode.sessions.prompt({ sessionID, text })`);
3. subscribes to the event stream (`for await (const event of
   opencode.events.subscribe())`) and translates events into contract
   `progress` lines and the final `result`;
4. translates usage (tokens in, share cached, tokens out, cost estimate)
   from session events into the result's `usage`.

## Roles as OpenCode agents

Each role is an agent in the project's OpenCode configuration. The role
prompts ship as Markdown files and become the agents' system prompts:

| Agent | Role | Restrictions |
| --- | --- | --- |
| `conveyor/planner` | planner | none beyond the permission mode |
| `conveyor/implementer` | implementer | none beyond the permission mode |
| `conveyor/fixer` | fixer | none beyond the permission mode |
| `conveyor/reviewer` | reviewer | `edit` denied |
| `conveyor/closer` | closer | `edit` denied outside `docs/` (closer may only change docs) |

OpenCode agent permissions map directly onto the contract's requirements:
`{ "action": "edit", "resource": "*", "effect": "deny" }` replaces the
reviewer's removed editing tools, and the permission mode ("nothing that
would require a human") is a deny-last ruleset on the agents.

Model choice is per agent (`model: provider/model#variant`); a role
without a configured model inherits the default. The conveyor itself does
not know the model — that knowledge stays on the adapter side.

## Mapping from the Claude-Code generation

The original pipeline ran `claude -p` with specific flags. The table is
the complete mapping:

| Concern | Claude Code CLI | OpenCode adapter |
| --- | --- | --- |
| Headless session | `-p` | SDK session + prompt |
| Streaming journal | `--output-format stream-json` | SDK event stream → contract events |
| Permission mode | `--permission-mode auto --permission-prompts none` | agent permissions ruleset |
| Reviewer without edits | `--disallowedTools Edit,Write,NotebookEdit` | reviewer agent denies `edit` |
| Structured result | `--json-schema` | model emits JSON, adapter validates with Zod (the same `safeParse` the pipeline already runs); native structured output to be adopted if the SDK exposes it |
| Resume | `--resume <id>` | prompt again on the same `sessionID` |
| Budget | `--max-budget-usd` | adapter-enforced cap on usage |
| Cost log | `result` event fields | contract `usage` |

## Items to verify during implementation

The contract is final; the SDK's exact shapes are checked at
implementation time, not guessed now:

- the event types the SDK stream emits for steps, tool calls, and usage
  (tokens, cost estimate) — the adapter reads the current SDK docs;
- whether the SDK exposes native structured output; until then the
  adapter validates model JSON with Zod;
- the cleanest budget mechanism (agent `steps` cap, adapter-side usage
  check, or both);
- that `@opencode/sdk` runs under Node (the project runs Node ≥ 26).

Any divergence found goes into this document, not into the contract.
