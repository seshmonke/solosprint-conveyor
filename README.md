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

## License

MIT. Copyright (c) 2026 seshmonke. See [LICENSE](LICENSE).
