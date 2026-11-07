# SkinFit (skinfit-clinic): rules for Claude Code

The founder (Keshav) cares about accuracy and patient trust far more than cost or speed. One
visible mistake in front of a patient costs more than any amount of extra checking. Be thorough.

## Before ANY git push (mandatory, every time)

1. Run `node preflight/run.mjs` and fix every `[FAIL]`. Read every `[WARN]`.
2. Run the `/preflight` deep review (see `.claude/skills/preflight/SKILL.md`). Study every
   `[MANUAL]` item and hunt for code that could undo what was asked (see its hazard list).
3. Tell the founder plainly: what passed, what failed, what is only a manual/unverified claim,
   and the DEPLOY PLAN (which containers to rebuild, which database commands to run).
4. Only push when the founder says to. Never use `--no-verify` unless the founder explicitly says so.

## Keep the registry alive

`preflight/requirements.json` is the list of everything the founder has asked for. Whenever the
founder states a new requirement, preference or correction, add or update an entry (with checks
that prove it) in the SAME change. A requirement that is not in the registry will not be protected.

## Hard lessons (each cost a real outage or a wrong number on screen)

- The `ml-worker` is plain Node and must never import web-only modules (`@/src/db`, anything with
  `import "server-only"`). Use `@/src/db/client`. The preflight traces the worker import graph.
- Deploys rebuild only the containers that changed. Pushing code that the worker loads without
  rebuilding `ml-worker` silently leaves old logic running. The preflight prints the deploy plan.
- The same logic often exists in two places (for example two textbook fallbacks, two score
  sources). After fixing something, search for the second copy before saying it is fixed.
- A copy of data (like the `skin_scans` table) drifts from the real record. Read scores from the
  real `scans` row. Cached payloads (home route, 2 minutes) can show old values briefly.
- Patient-facing text is written by the AI and verified (`src/lib/aiVerified.ts`): writer, AI
  checker, code checks, rewrite on any failure, show nothing if it never passes. No canned fallback.
- Heredocs inside bash commands break in this environment. Write scripts to a file, then run it.
- Database migrations and backfills are NOT automated on deploy. List the exact SQL in the plan.
- Never claim something is fixed or done without evidence. Say "not verified" when it is not.
