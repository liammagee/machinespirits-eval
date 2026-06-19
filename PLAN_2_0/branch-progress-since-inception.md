# Branch Progress Since Inception

Prepared: 2026-06-19

Branch: `claude/derivation-fast-iteration`

Base: `9eb0699d57307d8c51a066ce4637ea8037111cef`

Head summarized here: `121ad98e`

Status before this note: clean against `origin/claude/derivation-fast-iteration`

## Purpose

This note summarizes the progress on the branch from its divergence from
`origin/main` through the current Plan 2.0 general-adaptation repair. It is a
branch-level progress record, not a new empirical claim. The authoritative
evidence remains in the committed closeout notes, paper sections, test files,
database rows, and ignored export artifacts cited by those notes.

The branch has moved through several connected questions:

- Can the derivation tutor recover from learner decay and unreliable conduct?
- Can the system expose the right state without leaking the answer?
- Can pacing guards and selector logic generalize beyond one hand-tuned world?
- Can conduct policy reduce harmful or low-value tutor actions without
  suppressing legitimate learner ownership?
- Can Plan 2.0 turn adaptive state into concrete, better tutoring behavior?

## 1. Fast-Iteration Derivation Kit and Learner Decay

The branch began by building a faster derivation evaluation loop:

- Added episode replay and matrix harness support for quick iteration over
  derivation episodes.
- Implemented learner decay mechanics and survival-map tooling.
- Ran an initial real-LLM decay probe and fixed reporting around twin-fact
  aliases.
- Pre-registered and completed the unreliable-learner visibility contrast.
- Completed a 12-run `unreliable-v1` set across told vs conduct visibility
  arms, then mechanically adjudicated the set.

Key branch result:

- The 12/12 unreliable-learner adjudication supported H1 and reported an H2 gap
  of `+0.491` with CI `[0.313, 0.746]`.
- The result was folded into Paper 2.0 as the first load-bearing explicit
  channel claim for this branch.

Representative commits:

- `92d1f915` - fast-iteration kit plus learner decay
- `1b19ecc7` - unreliable-learner visibility contrast pre-registration
- `853bf663` - registered 12-run set complete
- `56a4a84b` - mechanical adjudication
- `acd242b9` - paper integration

## 2. Stage-v2, Lantern, and Repair-Clause Work

The next phase tried to turn failure analysis into stronger derivation policy.
This included:

- A stage-v2 design with acts, bounded learner behavior, curated theory, and a
  reconstructing tutor.
- Lantern revise probes, false-belief debt matching, P1 dials, and charter v2.
- Two-layer planning: throughline above act plots.
- A repair clause that treated a learner-named loss as the read-back event.
- Decay-channel hygiene via staged mutation pools and a bent-first repair
  charter.

Key branch result:

- Multiple early arms repeated the same failure pattern around aporia at turn 8
  or disengagement.
- The repair-clause arm produced grounded anagnorisis at turn 20.
- A later hygiene arm also produced grounded turn-20 completion with gap 0,
  while a battle-test arm failed before reaching the intended test.

Representative commits:

- `ea6a476e` - stage-v2 design
- `a75df23f` - stage-v2 implementation
- `2f43522c` - charter v2
- `63496979` - two-layer planning
- `63f6465c` - grounded anagnorisis at turn 20
- `9133f91d` - paper hygiene extension
- `ecdcc25c` - battle-test arm added to paper

## 3. Boundary Cartography and Replication Fans

The branch then moved from one successful recipe to boundary mapping:

- Added corridor cartography and conduct mining.
- Registered and ran an E2 replication fan on the frozen p4 recipe.
- Added pacing solvency and proof-debt guards.
- Added cost-accounting and non-leak audit readers.
- Extended the E2 fan to a pooled 10-run result.
- Ran a pacing-guard fan as a mechanism check.

Key branch result:

- The first E2 fan produced 3/5 grounded outcomes.
- The second E2 fan dropped the pooled result to 4/10, which exposed
  instability rather than a solved recipe.
- The proof-debt arm and pacing-guard fan supplied stronger evidence about the
  mechanism, with the pacing-guard fan landing 4/5 directionally and identifying
  the page-chart proxy as the keystone.

Representative commits:

- `cc995c61` - boundary plan plus Gate 0
- `012b409f` - E2 replication registration
- `225eb7b6` - E2 outcome recorded
- `49e2c55a` - proof-debt guard
- `31e107b8` - boundary cartography into paper
- `cda75f68` - pooled 4/10 result and mechanism loop
- `25522741` - pacing-guard fan paper update

## 4. Selector Generalization and Public Evidence Surfaces

After the pacing-guard result, the branch tested whether guard choice could be
selected across worlds without creating a brittle taxonomy:

- Added the adaptive-tutor generalization plan.
- Built a failure-mode taxonomy and guard-by-mode contingency analysis.
- Added visible pacing-guard variants and hidden-vs-visible comparisons.
- Instantiated the Marrick AND-join world and ran a three-arm fan.
- Added public register controls, dashboards, logic visualization, and
  reporting surfaces.

Key branch result:

- A page-only visible guard grounded 5/5 in the Step-1 V fan.
- The Marrick/Step-2 world bounded that page-only proxy: it helped in one
  geometry but did not become a universal solution.
- The selector discipline was kept shallow and pre-declared, with low regret as
  the target and post-hoc category creation treated as a failure mode.

Representative commits:

- `0b9f1480` - adaptive-tutor generalization plan
- `4b051692` - failure-mode taxonomy and guard contingency
- `ee036c86` - visible pacing guard
- `929f4a9a` - Step-1 V-fan closeout
- `ce7aea8a` - Marrick world
- `9c827092` - Step-2 generalization result
- `6b79738e` - plain-language framing

## 5. Guard Compiler, Selector Reliability, and Conduct Policy

The branch then deepened the runtime policy layer:

- Added a guard compiler replay slice, Hethel distractor world, and compiled
  guard runtime monitor.
- Added logic IR projection, diagnostics, visualization, and selector analysis
  tools.
- Consolidated selector versions through v4 with stall probes, same-turn
  assertion affordances, and recognition-pressure controls.
- Began A20 conduct policy logging, auditing, opt-in enforcement, and staged
  promotion.
- De-promoted selector v4 conduct enforcement when the evidence showed the
  tradeoff was not clean.
- Added progress-aware conduct policy, learner-entitlement conduct logic, A21
  action-value microbench scaffolding, and discursive calibration gates.

Key branch result:

- The branch produced a practical selector and conduct-policy evidence trail,
  but also documented that enforcement could suppress useful action if promoted
  too broadly.
- The A20/A21 arc ended with an explicit harm boundary and ownership framing in
  the paper/source notes rather than an overbroad success claim.

Representative commits:

- `e0891abf` - guard compiler replay slice
- `9ddb8c39` - compiled guard runtime monitor
- `6895f745` - selector stress setup
- `41ad665b` - consolidated selector v2
- `0c4d6bc2` - selector v4 consolidation guard
- `5ad1e8e9` - A20 conduct policy logging
- `ad753681` - opt-in conduct enforcement
- `5346d58e` - selector v4 promoted
- `626968b0` - selector v4 de-promoted
- `44a72a63` - A20/A21 ownership arc closed in paper

## 6. Cast Layer, Transcript Rubric, and Ownership Audits

The next layer added better transcript-level evaluation and role control:

- Added dramatic cast-layer state and wiring.
- Added cast-layer reader-quality scoring and pairwise transcript comparison.
- Added a derivation transcript rubric suite.
- Added Opus transcript judging catch-up support.
- Added learner ownership transfer audit tooling and reporting.

Key branch result:

- The branch gained a richer way to inspect whether improved control policies
  were also producing better transcript-level tutoring and learner-ownership
  behavior.

Representative commits:

- `36e12239` - cast layer state
- `121931ff` - cast layer wiring
- `e9abb782` - reader-quality scoring
- `a64dff57` - transcript rubric suite
- `0bb4eb30` - Opus transcript judging catch-up
- `664447b9` - ownership transfer audit
- `d9d51267` - ownership reporting

## 7. Plan 2.0 Adaptive Tutoring

The branch then focused on Plan 2.0: converting adaptive diagnosis into strict
state-action shifts and measurably better tutoring quality.

Implemented work:

- Added the Plan 2.0 closed-loop policy contract.
- Added boundary-case policy signals.
- Exposed policy action labels for analysis.
- Filtered empty Plan 2.0 trace records.
- Implemented the closed-loop adaptation policy.
- Tuned repeat-contextual realization for quality while preserving strict
  state-action shifts.
- Added adaptive trace support for rejudge scoring.
- Wrote the initial Plan 2.0 evidence closeout.
- Tested general adaptation transfer.
- Repaired the general-adaptation policy after a paired-suite failure.

Representative commits:

- `d44a6717` - closed-loop policy contract
- `d0e0b2ff` - boundary-case policy signals
- `f2127115` - policy action labels
- `982960e4` - trace filtering
- `72722d49` - Plan 2.0 closed-loop policy
- `b2ee301d` - quality loop tuning
- `0159e3fe` - adaptive traces in rejudge scoring
- `d49efc8f` - Plan 2.0 adaptation evidence closeout
- `f00ef2c6` - general adaptation transfer test
- `121ad98e` - general adaptation repair

## Current Plan 2.0 Evidence State

The current closeout is
`PLAN_2_0/plan2-general-adaptation-closeout.md`. It supersedes the earlier
paired-suite failure as the final branch state because the failure diagnosed
specific mechanism bugs, those bugs were repaired, and the failed held-out suite
plus a previously passed suite were re-evaluated.

Final cells and runs:

| Suite | Cell | Run ID | Role | Judge rows |
|---|---|---|---|---|
| Cross-suite | `cell_136_plan2_closed_loop_crosssuite` | `eval-2026-06-19-6c59b6e9` | baseline | Sonnet 6/6 |
| Cross-suite | `cell_150_plan2_quality_repeat_contextual_crosssuite` | `eval-2026-06-19-044225fd` | treatment | Sonnet 6/6 |
| Paired | `cell_151_plan2_pair_specificity_closed_loop` | `eval-2026-06-19-08df153e` | baseline | Sonnet 8/8 |
| Paired | `cell_152_plan2_pair_specificity_repeat_contextual` | `eval-2026-06-19-c2bf8146` | treatment | Sonnet 8/8 |

Strict-shift result:

| Suite | Baseline | Treatment |
|---|---:|---:|
| Cross-suite | 6/6 strict, 6/6 family | 6/6 strict, 6/6 family |
| Paired | 8/8 strict, 8/8 family | 8/8 strict, 8/8 family |

Sonnet quality result:

| Suite | Baseline quality | Treatment quality | Delta |
|---|---:|---:|---:|
| Cross-suite | 18.1 | 22.9 | +4.8 |
| Paired | 31.0 | 34.0 | +3.0 |

Pair-specificity result on the paired suite:

| Profile | Scenario exact | Family match | Pair specificity | False-positive divergence |
|---|---:|---:|---:|---:|
| `cell_151_plan2_pair_specificity_closed_loop` | 8/8 | 100.0% | 3/3 | 0.0% |
| `cell_152_plan2_pair_specificity_repeat_contextual` | 8/8 | 100.0% | 3/3 | 0.0% |

Outcome-closure result:

| Suite | Profile | Contract | Closed | Observable | Success | Failure | Inconclusive | No repeat after non-success |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| Cross-suite | `cell_136_plan2_closed_loop_crosssuite` | 100.0% | 100.0% | 100.0% | 1 | 0 | 14 | 78.6% |
| Cross-suite | `cell_150_plan2_quality_repeat_contextual_crosssuite` | 100.0% | 100.0% | 100.0% | 1 | 0 | 14 | 78.6% |
| Paired | `cell_151_plan2_pair_specificity_closed_loop` | 100.0% | 100.0% | 100.0% | 1 | 0 | 15 | 86.7% |
| Paired | `cell_152_plan2_pair_specificity_repeat_contextual` | 100.0% | 100.0% | 100.0% | 1 | 0 | 15 | 86.7% |

## Final Repair Mechanisms

The final Plan 2.0 repair changed the state-action pathway rather than blindly
tuning parameters:

- Actionable high-confidence states can proceed through the gate when the
  selected action is compatible with the dominant hypothesis.
- Affective, overload, substantive-objection, and task-misread language now
  count as learner-state evidence instead of empty release.
- After an inconclusive diagnostic under the same live condition, the policy
  switches to the dominant hypothesis's top non-diagnostic compatible action
  when one exists.
- Activity-avoidance phrasing such as "walk me through the answer" is treated
  as answer-seeking evidence.

## Current Bounded Claim

The branch currently supports this bounded claim:

> Plan 2.0's repaired closed-loop policy shows provisional simulated evidence
> of general adaptation on trap-derived suites: it preserves exact adaptive
> strategy shifting and improves Sonnet composite quality over the frozen
> closed-loop baseline on both the cross-suite and paired held-out suites.

Claim limits:

- Generation for the final Plan 2.0 runs reported `llmMode=mock`.
- Final quality tables are Sonnet-scored, not yet Opus-robust.
- The result is simulated adaptive-trap evidence, not evidence of human
  learning.
- The result does not claim deployment readiness.
- The result does not retroactively rescore historical rows.
- Outcome closure is structurally present, but most closures remain
  inconclusive rather than observed learner-state success.
- Prerequisite and misrecognition scenarios still show weak generic first
  diagnostics and generic minimal-hint realization.

## Generated Artifacts

The final closeout cites ignored exports rather than forcing them into Git:

- `exports/plan2-general-adaptation-final2-crosssuite-strategy-shift.json`
- `exports/plan2-general-adaptation-final2-crosssuite-sonnet-quality.json`
- `exports/plan2-general-adaptation-final2-crosssuite-sonnet-quality.md`
- `exports/plan2-general-adaptation-final2-crosssuite-outcome-closure.json`
- `exports/plan2-general-adaptation-final2-crosssuite-outcome-closure.md`
- `exports/plan2-general-adaptation-final2-pair-specificity.json`
- `exports/plan2-general-adaptation-final2-pair-specificity.md`
- `exports/plan2-general-adaptation-final2-paired-strategy-shift.json`
- `exports/plan2-general-adaptation-final2-paired-sonnet-quality.json`
- `exports/plan2-general-adaptation-final2-paired-sonnet-quality.md`
- `exports/plan2-general-adaptation-final2-paired-outcome-closure.json`
- `exports/plan2-general-adaptation-final2-paired-outcome-closure.md`

## Remaining Work

The branch is now a coherent evidence slice, but not a finished general
adaptation program. The clean next steps are:

1. Run Opus robustness checks on the final Plan 2.0 cross-suite and paired
   held-out rows without using Opus as a tuning target.
2. Add targeted ablations only after preserving the frozen-policy positive:
   state scramble, outcome closure off, and context realization off.
3. Improve realization quality for weak first diagnostics and minimal hints
   without changing the validated state-action policy.
4. Raise outcome closure from structurally observable but inconclusive toward
   observed success/failure transitions.
5. Keep any future paper claim bounded to simulated evidence unless a separate
   human-learner validation pipeline is run.

