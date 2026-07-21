---
id: charisma-desire-heldout-quality-gate
title: Charisma/desire held-out artifact quality gate
status: done
type: research
priority: P2
owner: codex
source: manual
created: 2026-07-02
updated: 2026-07-22
branch: codex/charisma-desire-heldout-quality-gate
verification: Full 50-row held-out gate completed across six guarded arms;
  runtime completion passed with zero failed rows and scripted controls stayed
  negative, but the gate decision is FAIL_HELDOUT_QUALITY because baseline
  route-hit, GLM-learner positive/target-match, and full-GLM target-match floors
  failed.
claim_status: killed
links:
  items:
    - charisma-desire-generalizability-matrix
  runs:
    - eval-2026-07-01-caab0c08
    - eval-2026-07-01-0fd5defa
    - eval-2026-07-01-6af87b98
    - eval-2026-07-01-22e62eb4
    - eval-2026-07-01-e42ecc3b
    - eval-2026-07-01-fcb7a871
  exports:
    - exports/charisma-desire-heldout-quality-gate-summary.md
    - exports/charisma-desire-heldout-quality-gate.json
    - exports/charisma-desire-breakthrough-heldout-matrix-summary.md
    - exports/charisma-desire-breakthrough-heldout-matrix.json
tags:
  - id-director
  - charisma
  - recognition
  - heldout
  - engagement-routing
milestone: paper-2-evidence-cleanup
---

Define and run the next gate after the completed role-isolation closeout: does
the local charisma/desire selector retain artifact-level quality on held-out
traces across model-role swaps, while scripted controls remain negative and GLM
runtime completion stays guarded?

Acceptance:

- Keep the held-out artifact pool separate from the lecture-3 controlled matrix.
- Freeze the role-isolation machinery; do not tune policy behavior during this gate.
- Treat scripted controls as tutor-register checks only, never learner-outcome evidence.
- Produce a pass/fail/pending gate report with explicit positive-local-outcome,
  route-hit, target-match, runtime-completion, and scripted-control criteria.
- Advance only a bounded claim if the gate passes: held-out artifact-level signal,
  no runtime promotion, deployment claim, or human-learning claim.

2026-07-02 Codex: Opened the held-out quality gate branch from the completed
role-isolation branch because the prior runtime/reporter fixes have not yet
landed on `main`.

2026-07-02 Codex: Added five held-out artifact probes spanning lectures 1, 4,
5, 6, and 8; added `--scenario-set heldout` support to the breakthrough matrix
reporter; added the held-out quality gate command sheet and PASS/FAIL/PENDING
criteria. Focused reporter checks, focused gate tests, lint, and workplan
validation pass locally. Gate state is intentionally `PENDING_NO_RUNS` until the
six guarded held-out arms are generated.

2026-07-02 Codex: Ran all six guarded held-out arms against the shared evidence
DB: Codex/Codex baseline `eval-2026-07-01-caab0c08`, Codex tutor + GLM learner
`eval-2026-07-01-0fd5defa`, GLM tutor/id + Codex learner
`eval-2026-07-01-6af87b98`, full GLM reference
`eval-2026-07-01-22e62eb4`, scripted Codex-tutor control
`eval-2026-07-01-e42ecc3b`, and scripted GLM-tutor control
`eval-2026-07-01-fcb7a871`. All 50 planned rows completed with zero failed
rows; scripted controls stayed at 0 positive local outcomes. The gate fails on
quality, not runtime: baseline route-hit is 70% below the 80% floor, the
GLM-learner arm has only 20% positive local outcomes and 40% target-match, and
the full-GLM reference has 70% target-match. Result: do not advance the
charisma/desire arc to paper/spec fold-in, runtime promotion, or human/hybrid
gate from this artifact pool.

2026-07-22 Claude: RESCUED TO MAIN during the branch review. This card, the
five held-out scenario definitions
(config/charisma-recognition-desire-scenarios.yaml), and the four gate reports
(exports/, force-added) had been stranded on the unmerged branch — the board
on main carried no record of this killed claim. The FAIL_HELDOUT_QUALITY
verdict was re-derived live before rescue: re-running the gate script against
the canonical DB with the six linked run ids reproduced 50/50 observed rows
and the same decision (the worktree's on-disk exports were stale
PENDING_NO_RUNS copies regenerated without --runs; replaced with the fresh
regeneration). The gate machinery itself
(report-charisma-desire-heldout-quality-gate.js + test, and the
breakthrough-matrix heldout-mode modifications) is deliberately NOT ported:
its --check asserts the July-2 engagementModeRouter contract
(charismatic_challenge targets), which main's router has since evolved past
(charismatic) — the machinery stays runnable on tag
archive/codex/charisma-desire-heldout-quality-gate (tip 729a57ce) with
EVAL_DB_PATH + --runs. The branch's uncommitted worktree diff
(claude-code.sonnet-5 provider alias + test) was discarded as redundant —
main already resolves that alias.
