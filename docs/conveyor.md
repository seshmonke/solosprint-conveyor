# Conveyor

The conveyor executes the sprint cycle with agent roles. One agent plans
the sprint, another implements, a third accepts; the owner is needed only
where the methodology cannot do without a human. The cycle, the agent
rules, and the permissions are the same as in the chat workflow — the
conveyor **executes** them, it does not replace them.

## Autonomous mode

In autonomous mode the next sprint is planned by an agent within the
owner-written **direction** file; a closed sprint pushes itself; live
verification and Storybook showings do not hold the queue — they
accumulate and the owner walks them in batches.

The main trade-off, accepted: the owner does not see the composition
before the work starts, and later sprints build on code that no hands
have verified yet; with a deploy, autopush becomes autodeploy, and
production is then protected by the gate and the reviewer, not by the
owner.

The direction file is written and changed by the owner; the planner only
reads it. A reached goal leaves the file; an empty direction stops the
queue and asks the owner.

## Commands

```
conveyor start [12 13 …]   start: agreed compositions first, then by direction
conveyor run               continue after a stop, a failure, or machine sleep
conveyor answer "…"        answer the conveyor's question
conveyor status            phase, question, check queue, latest costs
conveyor checks            the owner-check queue; serves the build and Storybook
conveyor check 12 ok|"…"   the check result: ok, or remarks (become P0 tasks)
conveyor stop              stop at the nearest point
```

The conveyor runs only on the owner's explicit command; a start command
without it means the sprint runs in chat. It runs inside a terminal
multiplexer (tmux), so the process outlives the terminal and the chat.

## The cycle

`plan? → implement → gate → review → (fix → gate → review)* → close → merge → push`

- **plan** — when the queue of agreed sprints is empty, the planner
  (`prompts/planner.md`) composes the next one from the backlog and the
  direction in a fresh session: `P0` first (including owner-check
  remarks), then tasks advancing the nearest direction goal; the volume is
  "one sitting". It writes the sprint file and the index line on a
  `sprint/NN` branch and notifies the owner of the goal and composition
  without waiting. A task that needs a concept-level decision (money,
  external services, sensitive data, a new product topic outside the
  direction) is not taken — it becomes a question.
- **implement** — the implementer (`prompts/implementer.md`): analysis
  before start, tasks, commits. The analysis overturns the planned
  composition — the composition goes back to the planner for one
  reassembly (a second time is a question to the owner); a concept-level
  decision is a question at once. A new component does not wait for the
  showing: the story is written, the component ships into the app, the
  showing joins the check queue.
- **gate** — the verify gate is run by the conveyor itself, not by an
  agent. Red → fix.
- **review** — the reviewer in a fresh session, without editing tools;
  afterwards the conveyor checks that HEAD and the working copy have not
  changed. The verdict follows a schema: ACCEPT/REJECT, blockers with a
  scenario, remarks, what the owner should check hands-on.
- **fix** — the fixer in a fresh session with the gate output or the
  blockers. At most two fix rounds, then a question to the owner: an
  instruction to the fixer or "accept as is".
- **close** — the closer writes the retro, files the reviewer's remarks
  into the backlog. Live checks and showings stay unchecked in the sprint
  file and join the queue. It may only change `docs/`; otherwise the
  conveyor stops.
- **merge** — the `sprint/NN` branch is rebased onto `main` if main has
  moved ahead (new code means the gate runs again) and merged fast-forward
  into the main copy.
- **push** — `git push origin main` from the main copy: everything
  accumulated in main ships. With CI workflows present, the conveyor
  watches the run; a red run or a rejected push is a question to the
  owner, the queue stands. Then the next sprint.

## Sessions

- **Each role is a fresh session.** State between roles is files only:
  the sprint file, git, the gate output. A session is resumed only within
  its own phase: after the owner's answer and after a failure. The fixer
  is a new session, not a continuation of the implementer: by the time the
  gate and the review have run, resuming would repay the whole history.
- **The reviewer works without editing tools** and the conveyor verifies
  that the repository did not change during the review.
- Every role returns a **structured result** validated against a schema:
  status, summary, question, and the verdict shape for the reviewer.
- Model selection is per-role configuration; sessions run headless, with
  the permission mode that denies anything needing a human.
- A **budget cap** per session is configurable; exceeding it stops the
  session and surfaces as an error.

## Owner questions

A question to the owner is a file plus an owner notification (a pluggable
notifier; a shell command by default). The answer comes as a conveyor
command. While the question waits, a preview can be served for the owner
to look at.

The conveyor stops and waits for the owner only in these cases: a
concept-level decision; no direction or the direction is exhausted; the
analysis overturned the composition twice; more than two fix rounds; the
implementation approach diverges from an accepted standard or the standard
is not recorded; a red CI or a rejected push; required ports are busy.

## State and observability

- State, owner questions, and logs live outside git: a state file (phase,
  round, session — survives a stop), per-session logs, a costs table.
- The terminal feed prints a timestamped line per phase, per agent line
  (truncated), per gate run, and per verdict. A live status line shows the
  spinner, the role or gate, the phase time, and the last event — the
  difference between an agent thinking and an agent stuck.
- Usage per session (tokens in, share cached, tokens out, cost estimate)
  is logged from session events. Provider subscription-limit events are
  optional: when the provider emits them, the conveyor reads the reset
  time and waits it out instead of stopping.

## Providers

The conveyor is provider-agnostic: sessions run through the
[adapter contract](adapter-contract.md). The shipped reference adapter is
for OpenCode; a provider-specific adapter only needs to implement the
contract. Provider-specific behavior (notifications, limit events) is
pluggable and optional.
