# SoloSprint Conveyor

Конвейер спринтов для OpenCode — **без кода**. Один скилл
(`.opencode/skill/conveyor/`): оркестратор — основная сессия, фазы цикла
(планирование → реализация → приёмка → закрытие) исполняют субагенты-роли,
гейты (команда проверки проекта, вердикты) фиксируются в файле спринта,
автономный запуск — `opencode run` в tmux.

Раньше здесь жил CLI-пайплайн (v0.1.0–v0.1.2): машина фаз, адаптеры,
state-файлы, учёт расходов. 19.11.2026 он заменён этим скиллом — тот же
цикл держится на инструкциях, а не на коде. Денежный учёт по ролям и
гейты, гарантированные кодом, не ведутся; гейт — команда проверки проекта
и вердикты, фиксируемые в файле спринта.

## Установка

Скопировать папку скилла в проект:

```sh
cp -r .opencode/skill/conveyor <проект>/.opencode/skill/
```

Скилл подхватывается OpenCode по описанию: «через конвейер» или «запусти
конвейер» в любом чате проекта. Правила проекта скилл читает сам.

Скилл несёт не только механизм цикла, но и методологию:

- **спринты** — доска, полный цикл, состав и согласование, анализ перед
  стартом, сверка, обзор и ретро, живая проверка владельца, пуш — шаг
  закрытия, направление, диалект файла спринта;
- **документация** — чистовик, «один факт — один файл», правило сжатия,
  незакрытые темы в бэклоге, воркфлоу решений, milestones;
- **состав скиллов fullstack/devsecops** — требования и зависимости:
  какая роль в какой зоне какой скилл подключает (senior-architect,
  frontend-design, web-design-guidelines, docker-development, codeql,
  semgrep, sarif-parsing, security-*, gh-fix-ci, gh-address-comments).

## Что нужно от проекта

- правила ассистента в корне (AGENTS.md / CLAUDE.md);
- доска задач: бэклог и направление (например, `docs/tasks/`);
- команда проверки (`pnpm verify` и т.п.) и правила git/пуша;
- для fullstack/devsecops-зон — скиллы из состава в разделе «Состав
  скиллов» (проектные или глобальные).

Нет правил — конвейер спрашивает владельца, а не выдумывает.

## Откуда ставить скиллы из состава

`npx skills add <репо> --skill <имя>` (или копированием папки скилла в
`.agents/skills/`):

- [openai/skills](https://github.com/openai/skills) — define-goal,
  gh-address-comments, gh-fix-ci, security-best-practices,
  security-ownership-map, security-threat-model (`skills/.curated/`);
- [trailofbits/skills](https://github.com/trailofbits/skills) — codeql,
  semgrep, sarif-parsing (`plugins/static-analysis/skills/`);
- [alirezarezvani/claude-skills](https://github.com/alirezarezvani/claude-skills)
  — senior-architect (`engineering-team/`), docker-development
  (`engineering/docker-development/`);
- [anthropics/skills](https://github.com/anthropics/skills) —
  frontend-design;
- [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) —
  web-design-guidelines;
- [glebis/claude-skills](https://github.com/glebis/claude-skills) —
  balanced;
- [mattpocock/skills](https://github.com/mattpocock/skills) — grilling
  (`skills/productivity/grilling/`);
- [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills)
  — copywriting (`skills/copywriting/`);
- [boraoztunc/skills](https://github.com/boraoztunc/skills) —
  ogilvy-copywriting (`ogilvy/`);
- [seshmonke/harry-skill](https://github.com/seshmonke/harry-skill) —
  harry.

## Лицензия

[MIT](LICENSE)
