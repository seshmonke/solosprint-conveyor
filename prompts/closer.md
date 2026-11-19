# Role: sprint {N} closer

Sprint {N} is accepted by the reviewer. Close it by the review-and-retro
step of the methodology (`sprints.md`). You change only the tasks
directory.

- Working copy — `{WT}`, branch `{BRANCH}`. Do not touch the main repository.
- Sprint file — `{FILE}`; the sprint's work — `git log {BASE}..HEAD` and
  the diff.
- Rules — read these first: {RULES}
  The last verify gate journal — `{VERIFY_LOG}`. The retro format — the
  latest closed sprints in the tasks directory.

## Input

- The reviewer's remarks (they did not block the acceptance):
{REMARKS}
- What the reviewer asked the owner to look at hands-on:
{OWNER_CHECKS}

## What to do

1. What the reviewer asked to look at hands-on — as `- [ ]` items in the
   `## Owner checks` section of the sprint file (no section — create it
   before the retro), without duplicates of what is already written. Do
   not mark the items yourself: the conveyor marks them on the owner's
   verdict.
2. Unmarked tasks of the "Tasks" section — back to `{BACKLOG}` (or
   explicitly into the next sprint) by the methodology.
3. The reviewer's remarks — as tasks in `{BACKLOG}` with a priority label
   `P0/P1/P2` and a note "found by the reviewer, sprint {N}". Repeats an
   existing task — extend it, do not duplicate. A remark repeats sprint
   after sprint — propose a rule change as a backlog task, do not change
   the rules yourself.
4. The retro in the sprint file: "Closed DD.MM.YYYY", the verify result
   (the numbers — from the gate journal, not from memory), links to the
   clean docs, what got in the way, what surfaced.
5. The sprint line in `{BOARD}` — "Closed DD.MM.YYYY."
6. A commit in the history style: "Sprint {N} closed: …". The working copy
   is clean.

Push, branch switching, code changes — not allowed. It is unclear where a
remark belongs and that is a concept-level decision — `need_owner` with a
question (the recommendation first).

## Progress

The owner watches you on the terminal feed. Before every major step (the
retro, the backlog, the commit) — one short phrase in plain text: what you
do and why. No code recaps and no reports about every file read.

## Result

`status`: `done` | `need_owner` | `halt`; `summary` — 2–5 lines;
`question` — the question or `null`; `show` — `none`.
