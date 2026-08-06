---
id: negative-register-effect-estimation-grid
title: Estimate negative-register effects with stance-fidelity gating
status: done
type: experiment
priority: P2
owner: codex
source: manual
created: 2026-07-03
updated: 2026-08-06
verification: Full five-target grid, or an explicit drop decision, reports assigned-arm effects, faithful-arm effects, exclusions, invalid person-attack violations, and paper/workplan scope.
claim_status: exploratory
links:
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/252
  notes:
    - notes/2026-07-03-negative-register-effect-estimation-future-work.md
    - notes/2026-07-26-negative-register-effect-estimation-preregistration.md
    - notes/2026-07-02-register-taxonomy-and-negative-registers-plan.md
  paper:
    - docs/research/paper-full-2.0.md#67-architectural-extension-the-id-director-family-and-charismatic-pedagogy
    - docs/research/paper-full-2.0.md#89-scope-of-the-id-director-extension
  exports:
    - exports/charisma-desire-breakthrough-matrix-summary.md
    - exports/charisma-desire-breakthrough-matrix.json
    - exports/negative-register-corrosive-exemplar-results.md
    - exports/negative-register-effect-grid/eval-2026-08-05-87fe3664.md
    - exports/negative-register-effect-grid/eval-2026-08-05-87fe3664.json
  runs:
    - eval-2026-07-02-e7b15809
    - eval-2026-07-02-7e461a5c
    - eval-2026-07-02-5c4d52e6
    - eval-2026-08-05-87fe3664
  items:
    - register-taxonomy-negative-registers
depends_on:
  - register-taxonomy-negative-registers
tags:
  - registers
  - negative-registers
  - effect-estimation
  - stance-fidelity
---

Future work after the negative-register measurement repair.

The next spend should not be another treatment-fidelity check. The repaired cue
contract already passed small simulated coverage checks across all five
controlled resistance targets. A full grid is warranted only if the question is
whether irony, sarcasm, or simulated face-threat change local learner outcomes
after treatment fidelity is enforced.

Acceptance:

- Run cells 196, 197, and 198 across all five controlled resistance targets, or
  explicitly decide not to spend on this grid.
- Report assigned-arm and faithful-arm estimands separately.
- Keep treatment-noncompliance exclusions separate from invalid person-attack
  violations.
- Include tutor-only v2.2 scores, register-rubric scores, and breakthrough
  matrix outputs.
- Keep any paper claim simulated-only and non-human-facing unless a separate
  human-coded or human-learner check is added.

2026-07-03 Codex: Created after closing the register-taxonomy implementation
branch. The current evidence supports measurement readiness, not a claim that
negative registers are pedagogically safe or effective.

2026-07-26 Codex: Activated after explicit operator confirmation in a fresh
current-main worktree. First gate is a zero-call reconciliation of the three
linked runs and existing reporter coverage; no new model-consuming grid is
licensed by activation alone.

2026-07-26 Codex: Reconciliation found that the linked historical rows are no
longer present in the live evaluation database, so a prospective run is
required for effect estimation. Added a frozen 45-row plan, clean-SHA paid
launch gate, pinned Sonnet-class scoring seams, and a fail-closed report that
separates assigned and faithful estimands, noncompliance exclusions, and
invalid person-attack violations. The remaining gate is the explicitly
approved model-consuming generation and judging run.

2026-08-05 Codex: Reconciled after confirming PR #252 merged and no active
branch or worktree remains. The apparatus is prepared, but the empirical grid
cannot proceed without the explicitly named paid-run authorization, so the
card is blocked rather than active.

2026-08-06 Claude: Grid ran and closed. Run `eval-2026-08-05-87fe3664`: 45/45
rows (codex.gpt-5.5 both seats), 45/45 tutor-only v2.2 scores, 81/81 register
slices, effect grid COMPLETE; report in
`exports/negative-register-effect-grid/eval-2026-08-05-87fe3664.{md,json}`.
Assigned-arm results (all 15 rows each): ironic 10/15 positive local outcomes
(v2.2 53.2, register 81.2); sarcastic 7/15 (57.4, 66.2); face-threat 12/15
(55.9, 57.1). Faithful-arm results (stance-gated): ironic 6 faithful, 5/6
positive (v2.2 60.4, register 86.3); sarcastic 8 faithful, 5/8 (55.8, 67.9);
face-threat 4 faithful, 3/4 (60.3, 34.8). Noncompliance exclusions
(weak-or-warm-in-costume): 26 total — ironic 9, sarcastic 7, face-threat 10.
Invalid person-attack violations, kept separate: 1 (face-threat, irrelevance).
Headline: canary fidelity did not scale (15/15 on the canaries vs 18/45 here),
and the estimands disagree — face-threat's assigned lead rests mostly on
unfaithful rows. Exploratory at 3 repeats/cell; simulated-only. Paper first:
§6.7 paragraph + §8.9 scope sentence + revision entry v3.0.266 (renumbered
from v3.0.265 during rebase; a concurrent §6.23 commit took that number, so
two commit messages in this arc still say v3.0.265).
Deviations, all disclosed in the paper entry: (1) plan re-frozen from
`4590ff55…1774` to `a7265c00…e083` under operator option-A approval in chat
(2026-08-06) after claude CLI 2.1.216 stopped resolving the pinned judge
spelling `sonnet-5`; judge model unchanged (Sonnet 5), commit `75e057ef`.
(2) Five generation attempts failed upstream (4 truncated codex replies, 1
empty ego reply; frustration ×3, question-flood ×1, rote-parroting ×1) and
were refilled via flagged-row cleanup + checkpoint resume at the plan's
pacing, per operator authorization in chat. (3) Register-judge timeout raised
180s→600s mid-pass after 31/54 slice timeouts, commit `55e1cf63`; the 23
slices scored before the raise were kept, 58 re-run pending slices completed
0-fail. Verification satisfied; card closed.

2026-08-05 Claude: Operator authorization received in chat ("Authorize the
negative-register run" — Liam Magee, 2026-08-05). The named gate is lifted
and the card returns to active. Scope of the authorization: exactly the
frozen 45-row plan the registered dry-run produces — plan SHA-256
4590ff55a1a940f5c794f4dec7faef3f947e3bc5d9d2cca14bd7e88ca54b1774, verified
reproducible on main after PR #508. A changed plan needs fresh
authorization. The launch did not start from the authorizing session: that
container has neither the codex CLI nor its credentials, and generation
needs codex for both seats. Next step, unchanged from the preregistration:
from a clean checkout of main, run
`npm run negative-register:grid -- --launch-approved --expected-sha <HEAD>`,
then the fail-closed report step (`--report-run <runId>`). Scoring seams
stay pinned: tutor-only rubric v2.2 via the Claude CLI on sonnet-5, register
rubric via claude-code sonnet-5.
