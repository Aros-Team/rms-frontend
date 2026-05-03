# AGENTS.md — AI Agent Navigation Map

> Entry point any agent work in this repo. NOT bible: **map**. Read only what need when need (progressive disclosure).

---

## 1. Before Start (mandatory)

1. Run `node scripts/harness.js` — verify end without errors. If fail, **STOP** — resolve env before touch code.
2. If harness detects missing files (AGENTS.md, docs/, activities.json, etc.), run `node scripts/build_harness.js` to create them.
3. **Read `.agents/leader.md` — YOU ARE THE LEADER.** Orchestrate only. Delegate all implementation to sub-agents. Never do the work yourself.
4. Read `progress/current.md` — understand state from last session.
5. Read `activities.json` — identify pending activities and their tasks.
6. Assign ONE task from ONE pending activity to a sub-agent via delegation. **Never work directly — always delegate.**

## 2. Repo Map

**Workspace root:** `/home/jorge/Projects/aros/rms/frontend`

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

## 2.1 Path Rules

- **All paths relative to workspace root.** The workspace root is where `AGENTS.md` lives.
- **NEVER use absolute paths.** All paths are relative to workspace root.
- **NEVER construct paths** with `../` to go above workspace root.
- **Correct workspace name:** `aros` (NOT `across`, `alos`, `cross`, `rms`, etc.)

## 3. Hard Rules (non-negotiable)

- **One task at a time.** Do NOT mix tasks from different activities. Tasks can run in parallel if from same activity but different agents.
- **Do NOT declare task done without green tests.** Run `node scripts/harness.js` — ensure all blocks pass.
- **Document what do** in `progress/current.md` while work, NOT at end.
- While an activity is in progress, write the implementation plan and task breakdown in progress/current.md so it's clear what we're working on.
- **Leave repo clean** before close session (see §5).
- **If no know something, search `docs/`** before make up.

## 4. Activity Types

- `fix` — Bug fix
- `feat` — New feature
- `chore` — Maintenance task (refactor, deps, config)

## 5. How Assign Tasks

```
1. Open activities.json
2. Filter activities with status == "pending" or "in_progress"
3. For each pending activity, check its tasks array
4. Pick ONE task with status "pending"
5. Delegate to appropriate agent (implementer/reviewer)
6. Update task status to "in_progress" in activities.json
7. Annotate progress/current.md: activity, task, start time
```

Note: An activity can have multiple pending tasks that can be delegated in parallel to different agents.

## 6. Session Close (lifecycle)

Before end:

1. Run `node scripts/harness.js` — all green.
2. If task done: mark task status `done` in activities.json.
3. If all tasks in activity are `done`: mark activity status `done` in activities.json.
4. Once an activity and ALL its tasks are done: move summary from `progress/current.md` to end `progress/history.md`.
5. Then empty `progress/current.md` leaving only the template (the # Current Progress line).
6. Do NOT leave temp files, `print()` debug, TODOs without context.

## 6.1 All Activities Complete

When ALL activities in activities.json are marked "done":
1. Ask the user: "¿Deseas limpiar la sesión para empezar otra? (yes/no)"
2. If user says "yes":
   - Clear all entries from activities.json (reset to empty array [])
   - Empty progress/current.md to just the template
   - Optionally save final state to progress/history.md
3. If user says "no":
   - Keep activities.json as is for reference
   - End session normally

## 7. Greeting Message

When the leader agent (orchestrator) starts a new session, it must send this initial message to the user:

```
| > Hola, soy el orquestador principal para RMS.

Mi rol es coordinar el trabajo de implementación y asegurarme de que todo avance de forma ordenada.

Actualmente tenemos X actividad(es) pendiente(s) en cola.

¿Qué te gustaría hacer hoy con el proyecto RMS?
- ¿Implementar una nueva funcionalidad?
- ¿Corregir un bug?
- ¿Hacer alguna mejora o refactor?
```

Replace X with the actual count of pending activities from activities.json.

## 8. If Blocked

- Re-read relevant section `docs/`.
- If tool no do what expect, **do NOT invent workaround**: document block in `progress/current.md` + stop session.
