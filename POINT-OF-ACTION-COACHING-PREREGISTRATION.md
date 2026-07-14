# Point-of-Action Coaching Gate — Frozen Pre-Registration

Status: **FROZEN 2026-07-14; implementation and paid execution not yet authorized.**

This is final-stretch Step 4 and the successor to Green Room Gate 1. Freezing
this document authorizes no model call. Launch requires a separate, explicit
user go after the implementation and dry-run checks below pass.

## 1. Question and claim boundary

The Green Room showed that craft-grade, judge-tier-authored advice in a static
prompt book did not reliably change tutor conduct (3/17 notes improved, 18%
against a 60% bar). The successor question is narrower:

> When a harness recognizes a concrete failure at performance time, does an
> action-shaped instruction delivered at that exact turn improve the tutor's
> observable compliance, or must the action be compiled into the runtime?

This is not a retry of the prompt book. Both intervention grain and delivery
channel change. The claim is about simulated tutor-stub conduct in one world,
not learning, model weights, minds, or human outcomes.

## 2. Zero-call trigger audit

The frozen instrument is derived by `scripts/analyze-step4-trigger-density.js`
from 68 SHA-256-verified existing traces: the 60 selected Step 2 traces for
`proof_skipper` and `affective_resistant` across Terra and Sonnet, plus the
eight scored Green Room performances. The window is learner turns 3--24 in
`world_005_marrick`. No model was called.

| Assigned trigger | Opportunities | Runs firing | Baseline compliance | Decision |
|---|---:|---:|---:|---|
| `warrant_skip` | 484 | 66/68 | 152/484 (31%) | retain |
| `stagnant_repeat` | 204 | 55/68 | 57/204 (28%) | retain |
| `affective_risk` candidate | 53 | -- | -- | reject |
| re-gloss candidate | 57 | -- | -- | reject |

The deterministic sample review found 12/12 valid opportunities for each
retained trigger. `affective_risk` is rejected because its derived signal
produced neutral-regression false positives. Re-gloss is mechanically sound
but too sparse and family/profile-concentrated for a balanced two-family
denominator. Canonical audit: `exports/tutor-stub-step4-trigger-audit/`.

## 3. Frozen trigger and compliance definitions

Only learner turns 3--24 are eligible. Near-closure turns and
`close_inquiry` actions are suppressed. At most one trigger is assigned to a
turn; `stagnant_repeat` has priority over `warrant_skip` on a co-fire because
the rarer change-instrument action subsumes a warrant prompt while the warrant
denominator remains dense.

### T1 — `stagnant_repeat`

Trigger when all are true:

1. deterministic replay through `buildDynamicalSystemState()` gives
   `state_vector.stagnation >= 0.60`;
2. the proposed action family is identical to the four immediately preceding
   completed tutor action families;
3. there is no unresolved glossary request;
4. the turn is not near closure and is not `close_inquiry`.

Target action `break_stagnation`:

- if a public premise is due, release that premise through the existing DAG
  release guards; otherwise
- reanchor a different already-public exhibit or material domain using
  `reanchor_public_evidence` or `ground_in_material`.

Compliance is one when `leavesReleased` increases on the turn, or the realized
action family is `reanchor_public_evidence`/`ground_in_material` and differs
from the repeated family. Otherwise it is zero.

### T2 — `warrant_skip`

Trigger when classifier `evidence_use` is exactly `omits_warrant` or
`overleaps_evidence`, after the T1 priority rule, outside near closure.

Target action `expose_warrant`:

- ask exactly one focused public question connecting the learner's claim to an
  evidence item, test, record, fact, or rule;
- release no new premise on that turn;
- do not state the answer or a hidden proof edge.

Compliance is one only when all three deterministic checks pass: exactly one
question mark; at least one frozen warrant cue from the audit regex; and no
increase in `leavesReleased`. Existing leak and response guards must also pass.

## 4. Arms

The four claim-bearing arms use the same detector, trigger priority, profiles,
world, seeds, turn window, and outcome code.

1. `standing_book`: both action notes are present as static system-prompt text
   from turn 1; no trigger-time interruption. This reproduces the failed
   persisted-advice channel in the new population.
2. `triggered_placebo`: the real detector fires, and the runtime inserts a
   trigger-specific, token-count-matched interruption that says only to inspect
   the current exchange carefully. It contains no target action, warrant cue,
   release instruction, action-family name, or answer. This controls for
   timing, interruption, and extra tokens.
3. `side_coach`: at the same live trigger, insert the corresponding
   action-shaped target above. The tutor may comply; the runtime does not force
   the response.
4. `compiled_constraint`: the same detector fires and the harness enforces the
   corresponding action through the typed-action/release layer before
   generation. This is the upper bound for externalized recognition.

No uncoached arm is claim-bearing. One excluded canary per speaking-tutor
family may compare `standing_book` with no book solely to verify wiring; canary
rows cannot enter any estimate or design decision.

## 5. Factorial population and models

- World: `world_005_marrick` only.
- Learner profiles: `proof_skipper`, `affective_resistant`.
- Runs: $n=5$ per arm × profile × speaking-tutor family.
- Total claim-bearing dialogues: $4 × 2 × 5 × 2 = 80$.
- Speaking-tutor families:
  - `codex.gpt-5.6-sol`
  - `claude-code.sonnet-5`
- Fixed supporting seams in both family blocks:
  - automated learner: `codex.gpt-5.6-terra`
  - classifier: `codex.gpt-5.6-terra`
  - learner-record/DAG extractor: `codex.gpt-5.6-terra`
- Run seed: 20260714, with deterministic arm/profile interleaving.
- Tutor max: safety cap 40; primary outcome fixed at learner turn 16; trigger
  compliance observed through turn 24 or earlier grounded stop.
- All arms run from one committed, clean SHA with exact model observations in
  `run_start` provenance.

Only the speaking tutor varies. This repairs Step 2's whole-stack confound and
makes the cross-family result a tutor-family comparison on fixed supporting
seams. It still does not isolate vendor infrastructure or stochastic sampling.

## 6. Opportunity-density gate

For every arm × speaking-tutor family, pooling the two profiles (10
dialogues), the run must contain at least:

- 25 assigned `warrant_skip` opportunities; and
- 12 assigned `stagnant_repeat` opportunities.

Both profiles must contribute at least one opportunity to their intended
channel (`proof_skipper` to T2, `affective_resistant` to T1). A minimum miss is
an instrument failure for that arm/family/trigger, not a coaching null. No
threshold is changed after viewing a row. A failed density block may be rerun
only for a documented technical failure under the same frozen seed contract;
it may not be enlarged to rescue a scientific contrast.

## 7. Endpoints and estimands

### Primary mechanism endpoint

For each speaking-tutor family and arm, compute compliance separately for T1
and T2, then macro-average the two trigger-specific rates so the dense warrant
channel cannot dominate the result.

Primary contrasts, each against `triggered_placebo`:

- `side_coach - triggered_placebo`
- `compiled_constraint - triggered_placebo`

Use 5,000 dialogue-cluster bootstrap draws, stratified by profile and trigger,
seed 20260714. A treatment arm passes within a tutor family only if:

1. macro-average compliance difference is at least +0.15;
2. the two-sided 95% bootstrap interval has lower bound above zero;
3. both trigger-specific point differences are positive; and
4. the density gate passes for the treatment and placebo arms.

The `side_coach - standing_book` delivery contrast and
`compiled_constraint - side_coach` enforcement contrast are secondary and do
not substitute for the primary placebo contrasts.

### Fixed-horizon and safety guardrails

For any treatment arm to license a mechanism claim within a family:

- mean proof-DAG coverage at learner turn 16 must be no more than 0.05 below
  `triggered_placebo`;
- hard-safety pass rate at turn 16 must be no more than 0.10 below
  `triggered_placebo`;
- secret-leak count must be zero in every treatment dialogue; and
- no new deterministic response-guard failure category may appear.

Coverage, mastery/risk AUC through turn 16, grounded closure, turns to
grounding, trigger counts, and post-trigger four-turn recovery are reported as
secondary descriptions. They cannot rescue a failed compliance or safety gate.

## 8. Decision grammar

| Result | Licensed reading |
|---|---|
| Same treatment arm passes all gates on both tutor families | two-family point-of-action mechanism confirmation |
| Arm passes on one tutor family only | family-bounded mechanism; no general claim |
| `compiled_constraint` passes, `side_coach` fails with adequate density | recognizing the moment is insufficient unless action is enforced |
| `side_coach` and compilation both fail with adequate density | insight-action gap persists even under fresh point-of-action signal on this apparatus |
| Density or provenance gate fails | instrument failure; no mechanism verdict |
| Compliance passes but outcome/safety gate fails | behavioral uptake with unacceptable transfer cost; no promotion |

No outcome licenses prompt tuning, threshold tuning, a fifth arm, more seeds,
or a new register selector under this pre-registration. A future population or
world generalization requires a new document.

## 9. Implementation and launch gate

Before any model call:

1. implement the two detector events and the four arms without changing the
   frozen definitions;
2. persist trigger inputs, assignment priority, injected text/hash, realized
   action, compliance components, and detector version per turn;
3. add deterministic fixtures for positive, negative, co-fire, near-closure,
   glossary-suppression, release, and no-release cases;
4. prove `triggered_placebo` text is target-free and token-count-matched;
5. prove non-speaking seams are identical across tutor-family blocks;
6. run a zero-model dry run and archive its output outside the claim set;
7. commit the clean implementation and append the exact SHA/commands below;
8. obtain explicit user approval to launch.

Launch commands and SHA: **intentionally blank until implementation passes.**

## 10. Deviations and results

No deviations. No claim-bearing runs started. No model calls were made while
freezing this pre-registration.
