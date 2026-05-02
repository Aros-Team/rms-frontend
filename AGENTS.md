# AGENTS.md — AI Agent Navigation Map

> Entry point any agent work in this repo. NOT bible: **map**. Read only what need when need (progressive disclosure).

---

## 1. Before Start (mandatory)

1. Run `node scripts/harness.js` — verify end without errors. If fail, **STOP** — resolve env before touch code.
2. If harness detects missing files (AGENTS.md, docs/, activities.json, etc.), run `node scripts/build_harness.js` to create them.
3. Read `progress/current.md` — understand state from last session.
4. Read `activities.json` — choose **one** activity status `pending`. Do NOT work >1 at time.

## 2. Repo Map

| File / folder | Contains | When read |
|---|---|---|
| `activities.json` | Activity list (pending/in_progress/done) | Always, at start |
| `progress/current.md` | Current session state | Always, at start |
| `progress/history.md` | Append-only log prev sessions | Need historical context |
| `docs/architecture.md` | What "good work" means in this project | Before implement |
| `docs/conventions.md` | Style rules, names, structure | Before write code |
| `docs/verification.md` | How verify work works | Before declare task `done` |
| `docs/CHECKPOINTS.md` | Final state evaluation checklist | Before declare task `done` |
| `.agents/*.md` | Sub-agent definitions (leader, implementer, reviewer) | When orchestrating work |
| `scripts/harness.js` | Entry harness (verifies env + quality) | Before start |
| `scripts/build_harness.js` | Creates activities.json + progress/ folder | For setup |
| `src/` | Application code | For implement |
| `tests/` | Automated tests | For verify |

## 3. Hard Rules (non-negotiable)

- **One activity at time.** Do NOT mix changes from multiple activities same session.
- **Do NOT declare task `done` without green tests.** Run `node scripts/harness.js` — ensure all blocks pass.
- **Document what do** in `progress/current.md` while work, NOT at end.
- **Leave repo clean** before close session (see §5).
- **If no know something, search `docs/`** before make up.

## 4. Activity Types

- `fix` — Bug fix
- `feat` — New feature
- `chore` — Maintenance task (refactor, deps, config)

## 5. How Choose Activity

```
1. Open activities.json
2. Filter status == "pending"
3. Take lowest "id"
4. Change status to "in_progress" + save
5. Annotate progress/current.md: activity, start time, brief plan
```

## 6. Session Close (lifecycle)

Before end:

1. Run `node scripts/harness.js` — all green.
2. If task done: mark `status: "done"` in `activities.json`.
3. Move summary from `progress/current.md` to end `progress/history.md`.
4. Empty `progress/current.md` leaving only template.
5. Do NOT leave temp files, `print()` debug, TODOs without context.

## 7. If Blocked

- Re-read relevant section `docs/`.
- If tool no do what expect, **do NOT invent workaround**: document block in `progress/current.md` + stop session.