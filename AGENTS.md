<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Token Discipline

- One focused task per session. If the user asks for multiple unrelated things, complete the first before starting the next.
- After 15 tool calls in a single task, pause and summarize what you've done before continuing.
- After 30 tool calls total in a session, explicitly flag: "Context is getting long — consider starting a fresh session for the next task."
- Never read a file you don't need for the current task. Don't speculatively explore.
- Reference files by path in your responses. Never paste large file contents into replies.
- If a task requires reading more than 5 files, ask the user to confirm scope before proceeding.
- Prefer targeted edits (Edit tool) over full rewrites (Write tool) when changing existing files.
- When you finish a task, stop. Don't add unrequested cleanup, refactors, or "while I'm here" changes.

## Multi-Agent Coordination Protocol

This vault is shared by three agents: **Claude** (strategy/design/docs), **Codex** (you — application source in `verdact-web/`: `app/`, `lib/`, components, migrations, config), and **Antigravity** (QA/E2E tests, agent tooling, CI/CD, security review). **Note:** Antigravity writes the `verdact-web/e2e/`, `verdact-web/tests/`, and `.agents/` subtrees, so expect another writer inside `verdact-web/` — claim in `../ACTIVE_WORK.md` before touching those dirs, and it will do the same. The vault lives in OneDrive, so concurrent writes to one file create conflict-copies. The rule for all three:

> **Append to your own dated log. Never rewrite a shared file. Claim work in `ACTIVE_WORK.md` before starting.**

Full design: `../MULTI_AGENT_PROTOCOL_DESIGN.md`. Canonical paths below are vault-root (one level up from `verdact-web/`).

**Boot (session start):**
1. Read `../PROJECT_STATE.md` — canonical current state (phase, live URLs, blockers, locked decisions). This is the boot read, NOT the old `SESSION_HANDOFF.md` (frozen).
2. Read `../ACTIVE_WORK.md` — do not start work another agent has claimed.
3. Skim the latest `../logs/*-codex-*.md` entries relevant to your work.
4. For build defaults, read `../06_Build/Verdact_Codex_Implementation_Readiness_2026-05-23.md` then `../06_Build/MVP_Technical_Spec_v2.md`.
5. Add your claim to `../ACTIVE_WORK.md` (agent `codex`, task, files/area, UTC timestamp).

**Query-aware resume / status requests:**
If Rishi starts with a topic-specific request such as "where are we standing on X?", "continue X", "find what we worked on for X", or "what is the latest progress on X?", do not answer from generic boot state alone.
1. Complete the normal boot reads: `../PROJECT_STATE.md`, `../ACTIVE_WORK.md`, and relevant logs.
2. Search `../logs/` for the latest 1–2 entries matching the requested topic and read those before answering.
3. Read the canonical topic files from the root file map when the topic is clear.
4. Use `../SESSION_HANDOFF.md` only when current files or logs point back to pre-2026-05-31 history, or when exact archived context is needed.
5. Answer in four buckets: latest progress, existing live/built state, parallel tracks, and open decisions / next step.
6. Never infer that a track is rejected, abandoned, superseded, or the only path forward unless Rishi or a canonical file explicitly says so. Preserve parallel tracks as parallel.

**Close (session end):**
1. **Append** a log to `../logs/YYYY-MM-DD-codex-<topic>.md` (append-only): what you did, files touched, open items. Never edit another agent's log.
2. **Release** your claim in `../ACTIVE_WORK.md`.
3. If you changed a canonical fact in your lane, make a **surgical single-line edit** to `../PROJECT_STATE.md` while you still hold the claim. Never wholesale-rewrite it. Do NOT write to `../SESSION_HANDOFF.md` (frozen).

**Your lane:** backend/build inside `verdact-web/`. Read across lanes freely; write only here plus your own log + surgical `PROJECT_STATE.md` edits in your lane.
