# Git and push

## Push is the closing step of a sprint

The verify gate is green, every task is marked → **close commit** → **push
main**, without a separate command. The trade-off of this rule: the moment
the pipeline starts is chosen by the board, not the owner; with a deploy
this becomes autodeploy. The accepted order:

1. All tasks marked, verify green → close commit → push. Then watch the
   run: a red CI means nothing shipped, and the next sprint does not start
   until the run is green.
2. Development and verification happen on localhost. A push mid-sprint is
   only on the owner's explicit command; a push to "see how it looks" is
   never done.
3. Live verification and showing new components do not hold the closing:
   they stay in the sprint file as the owner-check section, unchecked, and
   the owner walks them in batches across several sprints. Passed → the
   item is marked with a separate commit. Bugs found → `P0` tasks into the
   backlog, into the nearest sprint.

While there is no production yet, live verification runs on the production
build over the local network — no push is needed for it, and a passed
check is marked with a regular commit. The alternative would leave the
sprint waiting on infrastructure that does not exist yet.

## Working commits

Commits during work are local, as usual, on the working branch. The
conveyor works in its own working copy on a `sprint/NN` branch; the branch
reaches `main` fast-forward only after the sprint closes.

## Verify before push

`pnpm verify` must be green before the code goes to push. Locally green
does not mean it works in production — where that has lied before, it is
recorded in the gotchas file.

After the push, look at the run. A private repository reads its run status
through an authorized GitHub CLI (`gh run list`, `gh run view
--log-failed`); an unauthorized CLI is not a reason to skip the step, it
is a reason to authorize.

## What automation cannot check

Native dialogs, touch gestures, real client behavior, physical devices —
these are verified by the owner hands-on, after the code has shipped.
Until the moment the owner runs them, such items stay unchecked in the
sprint file's owner-check section.
