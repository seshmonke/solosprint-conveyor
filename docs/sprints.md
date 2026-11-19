# Sprints

The project runs as numbered batches of tasks. A sprint is **not a calendar
period** — it is a numbered batch with an explicit goal. There are no dates:
tying sprints to weeks turns the board into a report about a fictional pace.
For a solo project there are no extra roles or ceremonies — just explicit
boundaries of "what we do now".

## The board

- **Backlog** — `backlog.md`, the full pool of tasks, unbound to time.
  Priorities are labels `P0`/`P1`/`P2`, re-checked on every sync: a closed
  external blocker may have promoted what sat behind it.
- **Sprint file** — one file per sprint, `NN-short-name.md`, plus a line in
  the sprint index. The sprint file is history after closing: it is never
  deleted or moved.
- **In work** — the task being done right now, inside the current (highest
  numbered) sprint file. At most one or two tasks at once.
- **Done** — closed tasks stay marked in the sprint file; final decisions
  move into the clean docs with a short reference left behind.

Everything that surfaces — in dialogue, in code, anywhere — goes to the
backlog immediately. Nothing is kept "in mind".

## The cycle

**Agreed composition** → sprint file + index line → **owner start
command** (fixing the composition is not permission to work) → **analysis
before start**, before any code → work and sync on localhost → all tasks
done and the verify gate green → **close commit** → **push** → watch the
run → discuss the next sprint composition immediately.

### Planning

Open a sprint by creating `NN-short-name.md` with a one-phrase goal — what
must be true by the end of the sprint — and the tasks moved from the
backlog: as many as can realistically be done in one sitting, not more.

The composition of the next sprint is **discussed and agreed with the
owner first**, then fixed as a file plus an index line. When the conveyor
runs in autonomous mode, a planner agent composes the sprint within the
owner-written [direction](conveyor.md#autonomous-mode) instead.

### Start command and analysis

The owner's start command is full permission to work. The first step after
it, before any code, is the **analysis of the composition**: for every task
check that it is sound and will not hurt the project later; where there is
a choice of implementation approach, look at how others solve the problem;
for affected libraries, read current documentation instead of relying on
memory. A purely documentary or legal task gets one line in the notes,
without a ritual "research not required".

- The analysis is clean or only changes the implementation approach inside
  the agreed scope — continue with the best option found.
- The analysis overturns at least one task (remove, split, substantially
  extend, or a concept-level decision surfaces — money, external services,
  sensitive data) — **full stop of the whole sprint**, even if the other
  tasks are clean: fix the composition with the owner first, then a new
  start command.

The results go into the dialogue plus a short "Analysis before start" note
in the sprint file. A task added to the sprint mid-flight goes through the
same check in a light form before code.

### Sync

A short pass over the board before each new batch of work:

- done → mark in the sprint file;
- next in work → update the same file;
- backlog priorities → re-check against current blockers so `P0/P1/P2`
  labels do not rot;
- anything new that surfaced → file a task in the backlog immediately, and
  if it is urgent and fits the sprint goal — into the current sprint file.

The point of the sync is to keep new tasks from getting lost.

### Review and retro

At the end of the sprint:

- done → a short reference to the clean-docs section in the sprint file;
- not done → back to the backlog (or explicitly into the next sprint if it
  is still the priority);
- when useful — a short note in the sprint file: what got in the way, what
  to change next time.

## Template first, application second

A new component starts as an isolated render (Storybook or equivalent) and
is shown to the owner live. The showing does not hold the work: the
component ships into the application, the showing joins the owner-check
queue, and remarks come back as `P0` tasks. Iterating variants is not the
default — only on the owner's explicit request when the choice is real.
