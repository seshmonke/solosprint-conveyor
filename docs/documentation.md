# Documentation

The project documentation is the **clean copy**: only accepted decisions,
final wording, no "possibly" and no alternatives. Something is still under
discussion — its place is a backlog task, not the main text.

## What lives where

- **Concept** — the product: what it does and for whom, business rules,
  scope, product behavior.
- **Stack** — how it is built: stack and versions, data model, auth,
  infrastructure, deployment, provider choices, gotchas.
- **Design** — how it looks and behaves: tokens, typography, patterns of
  screens and components, UX rules.
- **Tasks** — the scrum board: the index (workflow rules and the sprint
  list), one file per sprint, the backlog, milestones (closed
  concept-level decisions).

Every section has exactly one index listing its files.

## One fact, one file

One fact lives in exactly one file; everywhere else there is a link, never
a copy.

The split rule is mechanical: one `##`-section is one file; a new section
means a new file plus a line in the section index. A four-line file is
normal — the rule that would force a judgment call about whether a topic
is "big enough" is not.

One decision often has two sides: the product formulation lives in the
concept section, the implementation in the stack section, with links
between them. Content is not duplicated.

## The compression rule

A reversed or revised decision does not stay in the clean copy as a
historical footnote — it leaves as a line in milestones ("what was,
replaced by what, in which sprint") and is cleaned out of the clean copy.
The clean copy answers "how it is", not "how it changed". Without this
rule the docs grow linearly and stop being readable in full.

## Open topics

An open topic lives as a backlog task, including a page-long coherent
reasoning when needed. A separate draft file is allowed only for a single
almost-ripe topic: it carries the migration rule in its header ("on
closure, folds into the clean copy") and is folded into the clean copy
when the topic closes.
