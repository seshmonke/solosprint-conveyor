# Instance configuration

An **instance** is a project that runs the conveyor. The instance tells the
conveyor where its things live through `.solosprint.json` in the project
root. Without the file, the defaults below apply.

```jsonc
{
  // Where the NN-*.md sprint files live, relative to the repo root.
  "tasksDir": "docs/tasks",

  // Rules files every role reads first.
  "rules": ["docs/tasks/INDEX.md"],

  // The direction file for autonomous planning; written by the owner.
  "direction": "docs/tasks/direction.md",

  // The backlog and the sprint index.
  "backlog": "docs/tasks/backlog.md",
  "index": "docs/tasks/INDEX.md",

  // A shell line run before gate commands (for example "nvm use").
  "setup": "",

  // The sprint-file dialect: the headings the conveyor reads and writes.
  // An instance with documents in another language overrides them.
  "headings": {
    "goal": "Goal:",
    "tasks": "## Tasks",
    "ownerChecks": "## Owner checks",
    "retro": "## Retro",
    "closed": "Closed "
  },

  // Owner answer keywords: a passed check and "accept as is".
  "answers": {
    "passed": ["ok", "passed", "yes"],
    "accept": ["accept", "accept as is"]
  },

  // Ports shared between the conveyor gate and owner serving.
  "ports": {
    "e2e": [],
    "live": [],
    "storybook": 6006
  },

  // Owner-check serving: synchronous steps, then background servers
  // (ready is a regex matched against their output), then the intro text.
  "checksServe": {
    "steps": [{ "label": "build", "cmd": ["pnpm", "build"] }],
    "servers": [
      {
        "label": "preview",
        "cmd": ["pnpm", "preview", "--host", "--port", "4173"],
        "ready": "Local:\\s+http"
      }
    ],
    "intro": "The production build: http://localhost:4173"
  }
}
```

## Environment seams

The conveyor process itself is configured through environment variables —
instances use them where a config file is too rigid (one-off runs, CI):

| Variable | Default | Meaning |
| --- | --- | --- |
| `SOLOSPRINT_REPO` | the working directory | The instance repository root |
| `SOLOSPRINT_WORKTREE` | `~/solosprint-worktree` | The conveyor's working copy |
| `SOLOSPRINT_STATE` | `<repo>/.solosprint` | State, questions, journals |
| `SOLOSPRINT_AGENT_BIN` | `solosprint-adapter-opencode` | The adapter (or stub) binary |
| `SOLOSPRINT_MAX_BUDGET_USD` | unset | Per-session budget cap |
| `SOLOSPRINT_GATE` | `pnpm verify` | The verify gate |
| `SOLOSPRINT_INSTALL` | `pnpm install --frozen-lockfile --prefer-offline` | Install before the gate |
| `SOLOSPRINT_NOTIFY` | unset | The owner notifier command (gets the title and body in `SOLOSPRINT_NOTIFY_TITLE` / `SOLOSPRINT_NOTIFY_BODY`) |

The role prompts and the methodology documents the roles read live in the
conveyor's own checkout, not in the instance.
