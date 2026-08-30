---
name: ms-deep-dive
description: Investigate existing evaluation runs across scores, trajectories, public transcripts, and qualitative evidence. Use for multi-layer interpretation; use ms-analyze-run for a compact run summary and ms-query-db for a narrow database fact. Read-only and zero-call unless the user separately authorizes a bounded model assessment.
---

# Deep Dive

Build a layered analysis from current repository authorities rather than a
hardcoded cell, epoch, model, or script catalog.

## Resolve the evidence lane

1. Resolve every shorthand to one exact run ID. Resolve cell numbers to exact
   canonical mapping keys from `config/tutor-agents.yaml`; never use
   `LIKE 'cell_1%'`. Historical cell 1 matching is
   `profile_name = 'cell_1' OR profile_name GLOB 'cell_1_*'`.
2. Inspect `services/evaluationStore/migrations.js` or `PRAGMA table_info` before
   composing SQL. Open the DB read-only.
3. Inventory judge models, tutor/learner/dialogue rubric versions, success,
   attempt indexes, config hashes, and transcript availability. Analyze each
   judge and rubric-version lane separately unless the user explicitly asks for
   a documented cross-lane comparison.
4. Do not infer treatment, recognition, or architecture from a profile-name
   substring. Read factors from stored columns and the live cell YAML.

## Select the smallest useful layer

- `quick`: counts, completeness, provenance, lane-specific means and spread.
- `standard`: quick plus trajectories, scenario variation, and representative
  public transcripts.
- `full`: standard plus an explicitly scoped qualitative question. This still
  defaults to direct reading of saved artifacts, not a provider call.

Use `scripts/ANALYSIS-SCRIPTS.md` to choose maintained analyzers and verify each
script's current parser/help before execution. Classify the action as read-only
stdout, a derived file write, a database write, or a model/provider call. An
analysis request authorizes only read-only work. Ask before repository or DB
writes. A model-backed assessment needs an explicit route, item count, retry
policy, and enforced call/spend ceiling.

For within-test change, use the analysis-only mode:

```bash
node scripts/analyze-within-test-change.js <exact-run-id> --no-persist
```

## Read transcripts faithfully

Prefer the canonical projections in `services/transcriptProjection.js` and
`services/dialogueTranscriptProjection.js` or an existing CLI surface that uses
them. Do not reconstruct dialogue with an ad hoc JSON shape; current logs may
contain tutor/final-output, learner/final-output, deliberation, and id-director
records.

State the transcript selection rule, run/cell/scenario/judge lane, and whether
the view is public or internal. Private deliberation is not public-dialogue
evidence.

## Interpret and report

- Report observed contrasts; do not infer causality from cell names.
- Do not call a sample powered, underpowered, floor-bound, or ceiling-bound
  without a design-backed threshold or sensitivity analysis.
- Treat missing logs, mixed rubrics, hash drift, and judge disagreement as
  limitations, not negative results.
- Separate tutor-turn quality, learner change, encounter quality,
  deliberation, charisma, and adaptation instruments.

Lead with the answer to the user's question, then give exact runs, lanes,
sample sizes, scripts/queries, transcript selection, observed patterns,
disagreements, provenance limitations, and what remains indeterminate.
