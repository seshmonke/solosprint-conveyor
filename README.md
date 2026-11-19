# SoloSprint Conveyor

An open methodology and reference implementation for running a solo software
project as numbered sprints executed by a pipeline of AI agent roles.

## What it is

SoloSprint Conveyor is two things in one repo:

1. **A sprint methodology** — how to run a project in numbered batches of
   tasks (sprints), keep a backlog and a sprint board, write clean project
   documentation, make and record decisions, and handle git, pushes, and
   owner verification.
2. **A conveyor** — a pipeline that executes the sprint cycle with agent
   roles: a planner composes the sprint, an implementer writes code, a
   reviewer accepts or rejects it, a fixer addresses blockers, a closer
   finishes the sprint. The owner is involved only where the methodology
   requires a human.

The conveyor is **provider-agnostic**: every role is a headless agent
session behind an [adapter contract](docs/adapter-contract.md). One
reference adapter for [OpenCode](docs/reference-opencode.md) ships with
this repo; adapters for other agent CLIs can be written against the same
contract.

## Who it is for

A solo developer who wants a repeatable, documented way to run a project
with coding agents — without ceremonies, calendars, or extra roles.

## Documents

### Methodology

- [Sprints](docs/sprints.md) — the sprint board and the sprint cycle
- [Documentation](docs/documentation.md) — the clean-docs practice
- [Decisions](docs/decisions.md) — the decision workflow
- [Git and push](docs/git.md) — git discipline and the verify gate
- [Owner checks](docs/owner-checks.md) — the live verification queue

### Conveyor

- [Conveyor](docs/conveyor.md) — roles, cycle, stop conditions, operations
- [Adapter contract](docs/adapter-contract.md) — the provider-agnostic
  session interface
- [Reference OpenCode adapter](docs/reference-opencode.md) — the shipped
  adapter and its design
- [Port plan](docs/port-plan.md) — what moves from the private pipeline,
  what changes, and how it is verified

### Instance

- [Instance configuration](docs/instance-config.md) — the `.solosprint.json`
  schema that binds the conveyor to your project

## How to use

The conveyor runs inside an **instance** — your project repository. Three
pieces tie it together:

### 1. Consume the canon

Pin the repository by tag as a git dependency:

```jsonc
// package.json (pnpm workspace or any project)
{
  "devDependencies": {
    "solosprint-conveyor": "github:seshmonke/solosprint-conveyor#v0.1.0"
  }
}
```

The CLI is `solosprint-conveyor`.

### 2. Configure the instance

A `.solosprint.json` in the project root says where things live: the tasks
directory, the rules files, the direction and backlog, the sprint-file
dialect, the ports, and the owner-check serving steps. The full schema —
[docs/instance-config.md](docs/instance-config.md). Without the file,
sensible defaults apply.

### 3. Point at an adapter

The conveyor speaks to an agent through the
[adapter contract](docs/adapter-contract.md). Install the reference adapter
from this checkout and tell the conveyor where it is:

```bash
npm install -g ./adapters/opencode
SOLOSPRINT_AGENT_BIN=solosprint-adapter-opencode solosprint-conveyor start 42
```

Trial runs and tests need no provider at all — the stub in `adapters/stub`
emits canned events:

```bash
SOLOSPRINT_AGENT_BIN="node adapters/stub/stub.ts" solosprint-conveyor start 42
```

### Commands

| Command | What it does |
| --- | --- |
| `solosprint-conveyor start [42 43 …]` | Start: agreed compositions first, then planning within the direction |
| `solosprint-conveyor run` | Continue after a stop, a failure, or a machine sleep |
| `solosprint-conveyor answer "…"` | Answer the conveyor's question |
| `solosprint-conveyor status` | Phase, question, check queue, latest costs |
| `solosprint-conveyor checks` | The owner-check queue; serves the build until Ctrl+C |
| `solosprint-conveyor check 42 ok \| "remarks"` | The check result; remarks become P0 tasks |
| `solosprint-conveyor stop` | Stop at the nearest point |

Run it inside a terminal multiplexer so it outlives the terminal and the
chat:

```bash
tmux new-session -d -s conveyor -c ~/project 'solosprint-conveyor start 42; exec bash'
tmux attach -t conveyor   # watch; detach with Ctrl+B, D
```

## Quick start for a new project

Paste this prompt into your coding agent to wire the conveyor into a
project:

> Integrate SoloSprint Conveyor (`github:seshmonke/solosprint-conveyor#v0.1.0`)
> into this project. Read its `README.md` and `docs/conveyor.md` first, then
> `docs/instance-config.md` for the config schema.
>
> 1. Add the conveyor as a git dependency pinned to the tag.
> 2. Create `.solosprint.json` in the project root, adapted to this project:
>    where the sprint files will live, the rules files every role reads
>    first, the direction/backlog/index files (create them under the tasks
>    directory if they do not exist), the sprint-file dialect, the ports the
>    e2e gate uses, and the owner-check serving steps when the project has
>    something to serve.
> 3. Touch only the conveyor wiring: `package.json`, `.solosprint.json`, the
>    new tasks files, and `.solosprint/` in `.gitignore`. Do not change the
>    project's code or product documentation.
> 4. Run a trial with the stub on a **copy** of the repository: point
>    `SOLOSPRINT_AGENT_BIN` at the conveyor's `adapters/stub/stub.ts`, set
>    `SOLOSPRINT_GATE` to a harmless command, and run
>    `solosprint-conveyor start`. The whole cycle must finish with
>    "Sprint 1 closed and pushed" against a scratch remote.
> 5. Report: what you configured, the trial result, and what remains for the
>    owner — a real adapter with a provider, the notifier command, and the
>    tmux line.

## License

MIT. Copyright (c) 2026 seshmonke. See [LICENSE](LICENSE).
