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
and tell the conveyor where it is:

```bash
npm install -g solosprint-adapter-opencode
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

## License

MIT. Copyright (c) 2026 seshmonke. See [LICENSE](LICENSE).
