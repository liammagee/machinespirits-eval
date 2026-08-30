---
name: ms-analyze-data
description: Route a general evaluation-analysis question to the correct maintained script. Use when the user asks which analysis to run; use ms-analyze-run for one run, ms-query-db for an ad hoc database fact, and ms-deep-dive for transcript-level interpretation.
---

# Analyze Data Router

Use the generated `scripts/ANALYSIS-SCRIPTS.md` registry as the live catalog.
Do not maintain a second script list in this skill.

## Route

1. Restate the requested construct, evidence unit, run/cell scope, and desired
   output.
2. Search the registry by purpose and study family. Open the selected script
   and focused tests to verify flags, defaults, data sources, and outputs.
3. Resolve run IDs and cell names exactly. Separate judge and rubric-version
   lanes unless the selected registered analysis explicitly defines pooling.
4. Classify the script before running it:

   - read-only stdout;
   - derived artifact write;
   - database mutation;
   - model/provider calls.

An analysis request authorizes read-only execution only. Ask before writing a
derived artifact or the DB. A model-backed coder, rejudge, or qualitative
assessment requires explicit route, item count, retries, and an enforced
call/spend ceiling.

`scripts/analyze-within-test-change.js` persists by default. For ordinary
analysis, use:

```bash
node scripts/analyze-within-test-change.js <exact-run-id> --no-persist
```

Do not describe a report-writing or DB-writing script as pure computation.

## Report

Give the selected script, why it matches the construct, exact invocation,
read/write/model-call classification, judge/rubric lane, output location if
any, and limitations. If no maintained script fits, answer with a read-only SQL
or artifact inspection plan rather than inventing a new analysis pipeline.
