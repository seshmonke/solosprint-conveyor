# Port plan

The canonical pipeline is a port of the private, battle-tested pipeline
(proven by a pilot: the reviewer on a shipped sprint state found two real
gaps the implementer and the live check had missed, with no false
blockers). This document records what moves, what changes, and how the
result is verified.

## What moves unchanged (provider-agnostic)

- The phase state machine and the sprint orchestration (`pipeline`)
- State, owner questions, and logs outside git (`state`)
- The working copy and branch mechanics (`git`)
- The owner-check queue and preview serving (`checks`)
- The owner question file and answer command (`owner`)
- The terminal feed and the live status line (`progress`, `activity`)
- Sprint file plumbing (`sprint`, `decide`, `shell`)
- The CLI entry (`main`) with the commands from [conveyor.md](conveyor.md)
- The role prompts (`prompts/*.md`), with wording generalized: no
  project-specific names, and the concept of a "direction" file replaces
  the instance's direction contents
- The Vitest suite, ported alongside

## What is replaced

- The session runner (`agent`) — by the adapter contract: the conveyor
  spawns the adapter binary from an environment variable and consumes
  contract events
- The usage reader (`usage`) — by the generalized `usage` shape of the
  contract; provider subscription-limit parsing becomes the optional
  `limits` event

## What is generalized or dropped

- Owner notification (Windows toast) → a **notifier interface**; the
  default implementation is a shell command, instances plug in their own
- WSL/snap storage notes → instance-level concerns, out of the canon
- Hardcoded ports and paths → configuration and environment
- Hardcoded model name → per-role agent configuration on the adapter side
- Instance history (dates, cost observations) → out; the canon answers
  "how it is", milestones answer "how it changed" in each instance

## Naming and packaging

- Package and CLI name: `solosprint-conveyor`
- Adapter binary: `solosprint-adapter-opencode`
- Environment seams: `SOLOSPRINT_AGENT_BIN` (adapter or stub binary),
  `SOLOSPRINT_WORKTREE`, `SOLOSPRINT_GATE`, `SOLOSPRINT_MAX_BUDGET_USD`

## Verification

1. The ported Vitest suite is green against the **test stub** — a fake
   binary emitting canned events, replacing the old stub mechanism.
2. A **trial run** on a clone repository with the stub drives all phases
   through the state machine without a real agent.
3. A **pilot run** with the real OpenCode adapter on a copy of a real
   sprint state: one plan-implement-gate-review cycle, with the reviewer
   verdict checked by the owner.

## Versioning and consumption

- Tags `v0.1.0` onward; the canon is consumed by git dependency pinned to
  a tag
- Breaking changes to the adapter contract are a major version
