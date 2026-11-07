---
name: preflight
description: Deep pre-push review for skinfit-clinic. Verifies every requirement the founder has given is implemented, hunts for code that could undo them, and produces the deploy plan. Run before every git push.
---

# /preflight: deep review before pushing

Goal: make sure nothing the founder asked for is missing, broken, undone by other code, or only
"claimed". The founder wants zero patient-visible complaints and will spend any amount of effort.

## Step 1. Automated layer

Run `node preflight/run.mjs`. Every `[FAIL]` must be fixed. Read every `[WARN]`. Note the DEPLOY PLAN.

## Step 2. Study the registry

Read `preflight/requirements.json` fully. For EVERY requirement, including those whose automated
checks pass:

1. Re-read the `title` and `source` (what the founder actually asked for).
2. Open the code that implements it and read it. A passing grep proves the text exists, not that it
   works. Confirm the behaviour end to end: who calls it, what data reaches it, what the patient sees.
3. Write one line of evidence per requirement: `ID  status  file:line  what proves it`.

For every `manual` check, do exactly what it says. If it cannot be verified from code (it needs a
deployed server, a phone, real data), mark it `UNVERIFIED` and say what the founder must do.

## Step 3. Hunt for things that could hamper the result

Do not stop at the registry. Look for anything in the code that could make the intended behaviour
fail. Use parallel subagents (one per area) and have each report concrete findings with file:line.
Areas and the questions to ask:

- **Scores**: is there any other path that computes or displays a score (home payload, history,
  concern pages, chat context, PDF, ops inspector, phone app API, cron jobs, weekly/monthly
  insights) without the early-scan cap, the 85/90 ceiling, the 3-point change rule, or the real
  `scans` row? Any cache that could keep serving the old number?
- **AI text**: every place that shows a sentence written for a patient. Is it generated, checked by
  the second AI, and code-checked? Is there a second copy of an old fallback, a canned string, a
  raw library excerpt, a template? What shows if the AI is down? Do prompts contradict each other
  (thresholds, tone, "end with a question" vs small talk)?
- **Annotations**: does every path that draws or stores annotations respect the 10-circle cap, the
  0.15 floors, the cross-photo gate and the staff hide switch? Does the patient report, PDF, and
  history all honour `annotationSuppressed`?
- **Onboarding and rings**: every route and redirect in the onboarding flow; does the phone app
  (`mobile/`) behave the same? Any place that still forces the questionnaire?
- **Infrastructure**: does anything the ml-worker loads import web-only code? Is there any new
  environment variable the server needs (list it)? Any schema change needing a hand-run migration?
  Any change that needs a backfill SQL for existing rows (list the exact command)?
- **Wording**: patient-visible strings with "declined", "trending down", "baseline", "parameter",
  emojis, or anything that reads wrongly for an acne-style (lower is worse) score.
- **Security and privacy**: secrets in source, patient photos or names leaking into logs, new
  routes without auth.

## Step 4. Report to the founder (plain language)

1. A table: requirement, status (verified / unverified / broken), evidence.
2. New risks found, ranked, with the fix you applied or recommend.
3. What you could not verify and exactly how the founder can check it.
4. The deploy plan: containers to rebuild, in order, plus any SQL.
5. A clear verdict: SAFE TO PUSH, or NOT YET and why.

Never say "done" or "fixed" without evidence. If something is a guess, say so.

## Step 5. Keep the system alive

- Any new requirement, preference or correction from the founder in this conversation that is not
  in `preflight/requirements.json` must be added now, with checks that prove it.
- If you found a new class of mistake, add a hazard scan to `preflight/run.mjs` so it is caught
  automatically next time, and add a line to the "Hard lessons" list in `CLAUDE.md`.
