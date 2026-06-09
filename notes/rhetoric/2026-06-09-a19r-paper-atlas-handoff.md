# A19R Rhetorical Mini-Machines: Paper and Atlas Handoff

Date: 2026-06-09

Status: documentation checkpoint after the automated A19R rhetorical loop. This
is not yet a Paper 2.0 empirical claim.

Commit baseline: `f389c964 Add A19R rhetorical mini-drama screen`

## Claim Boundary

A deterministic transcript template would weaken the adaptation claim if it were
treated as evidence. Once the transcript is scripted, the system is no longer
showing contingent response to learner-state evidence; it is showing that a
preplanned sequence can satisfy or fail the checker. That can be valuable as a
diagnostic fixture, an oracle trace, or a regression test, but it should not be
counted as evidence that rhetorical device selection adapts.

The two approaches that remain aligned with the adaptation question are:

- a multi-seed pass-rate harness, because it measures whether stochastic
  selection and replay reliably survive repeated model draws;
- a cleaner gate distinction between an old rule making a wrong public
  prediction and an old rule merely having the wrong scope or explanatory role.

## Evidence States

- `ENGINEERING_VERIFIED`: repo code, config, CLI, and tests exist and pass.
- `AUTOMATED_SCREEN`: local model/checker evidence exists, but it is exploratory
  and not yet preregistered.
- `CLAIM_BLOCKED`: the current result identifies a mechanism or failure mode but
  is not robust enough for a paper result without another controlled pass.

## Evidence Inventory

| Question | Artifact | Result | Evidence state |
| --- | --- | --- | --- |
| Can we generate non-repair rhetorical candidates cheaply? | `config/rhetoric/mini-drama-ontology.v0.1.json`, `services/miniDramaMachines.js`, `scripts/a19r-mini-drama.js` | Six-device ontology and CLI screen implemented. Initial A18/A19 battery produced 20/20 gated proxy positives. | `ENGINEERING_VERIFIED` for apparatus; `AUTOMATED_SCREEN` for feasibility |
| Does a diagnostic-lure S0 avoid the original ceiling problem? | `notes/rhetoric/2026-06-09-rhetorical-battery-feasibility.md` | Redesign moved from an easy proxy screen to S0/S1 comparisons where S0 could fail and S1 could succeed. | `AUTOMATED_SCREEN` |
| Are there stable S1-only selector cases? | Stable color/groove selector patterns in the feasibility note | Groove-decoy replicated 5/5 strict S1-only; color-decoy replicated 4/5 strict S1-only. | `AUTOMATED_SCREEN`; local pockets only |
| Do fresh siblings transfer under the same device family? | `config/rhetoric/selector-rail-stable-pattern-fresh.v0.3.json` | Peripeteia reached 3/6 S1-only; all three near-misses were rescued by at least one alternate device. | `AUTOMATED_SCREEN`; transfer incomplete |
| Does explicit wrong-prediction collision metadata help? | `config/rhetoric/selector-rail-collision-fanout.v0.4.json` | Peripeteia improved to 4/6 S1-only. The alternate-device matrix on the two misses reached 7/10 S1-only, with both cards rescued by at least three devices. | `AUTOMATED_SCREEN`; partial improvement |
| Does a selected full-family policy replicate? | `exports/a19r/model-screens/2026-06-09-selector-collision-v04-selected-family-5line-v2-confirm/a19r-model-screen-summary.json` | Final selected-family confirmation reached 4/6 S1-only. Two cases that passed in isolation missed under the final family replay. | `CLAIM_BLOCKED` |
| Is the implemented device ontology saturated for this selector family? | Collision-loop section of the feasibility note | All unresolved cards were tested against all implemented alternate devices; the residual failures were replay/checker instability, old-rule gate ambiguity, and bounded recursive tutor-learning closure. | `AUTOMATED_SCREEN`; saturated for current devices, not globally exhaustive |

## What We Can Say Now

The repo now has a fast A19R mini-drama apparatus: a rhetorical device ontology,
card pools, generator, CLI screens, QA report, model-screen outputs, and focused
tests. It is suitable for fast local iteration before human adjudication or
paper escalation.

The automated evidence supports a bounded feasibility statement: stochastic
rhetorical device selection can produce local S1-only breakthroughs on A18/A19
style selector scenarios, and collision-aware metadata improves but does not
stabilize full-family transfer.

The strongest methodological finding is negative but useful: the remaining
failure is not simply "pick another rhetorical device." It is a measurement and
protocol problem involving replay variance, gate semantics, and too little room
for recursive tutor-learning closure in bounded continuations.

There is also a role-entanglement confound in the current S1 screen. In the
bounded-continuation runs, one generator sees the rhetorical policy memory and
then writes the continuation containing both learner uptake/contest and tutor
revision. That means the learner turn is not independently generated under
learner-only information; it can implicitly cooperate with the tutor's intended
move because the same model is authoring both sides. This does not invalidate the
screen as a construction test, but it blocks any claim that the learner
independently responded to the tutor's public move.

## Role-Separated Replay Fix and Rerun

The replay harness now has a role-separated continuation mode. Tutor-side calls
may see the rhetorical policy memory; learner-side calls see only the public
transcript available at that point. When the base transcript already ends with a
`TUTOR:` line, the mode appends:

`LEARNER -> TUTOR -> LEARNER -> TUTOR`

That matters because the first role-separated rerun revealed a second sequencing
artifact: the base mini-drama transcript already ended with a tutor diagnostic
lure, so adding another tutor line first created two consecutive tutor turns.
The corrected sequence lets the learner respond to the existing tutor lure
before the tutor revises.

Pinned rerun command:

```bash
npm run a19r:model-screen -- \
  --run .test-tmp/a19r-selector-collision-v04/screen-selected-family-5line-v2.json \
  --out-dir exports/a19r/model-screens/2026-06-09-selector-collision-v04-selected-family-role-separated-after-tutor-pinned \
  --rewrite-mode role_separated_continuation \
  --bounded-max-added-lines 5 \
  --baseline-mode diagnostic_lure \
  --s0-mode checker_only \
  --memory-mode full \
  --codex-model gpt-5.5 \
  --codex-effort xhigh \
  --claude-model 'claude-fable-5[1m]' \
  --claude-effort medium \
  --force
```

Result:

- candidates completed: 6/6;
- S0 diagnostic-lure baselines: 6/6 reject;
- S1 role-separated rhetorical-memory cases: 0/6 survivors;
- S1 near-misses: 5/6 `revise_again`;
- S1 hard reject: 1/6.

All six S1 item manifests record `sequence:
learner_tutor_learner_tutor`, `learner_policy_memory_visible: false`, Codex
requested model `gpt-5.5` with effort `xhigh`, and Claude requested model
`claude-fable-5[1m]` with effort `medium`.

Interpretation: the original 4/6 selected-family result should be treated as a
bundled-continuation construction result, not as independent learner uptake. Once
the learner cannot see policy memory and gets its own generation pass, the screen
does not yet produce local survivors. The corrected harness does, however, move
five cases from hard failure to near-miss. The residual blockers are mostly
recursive tutor-learning closure and ledger inspectability: weak tutor-learning
signal, weak resistance diagnosis, weak recursive dyadic update, and evidence
quotes that paraphrase tutor instructions instead of quoting learner resistance.

This is a stronger negative result than the earlier role-entanglement warning:
current stochastic rhetorical selection can create promising public continuations,
but the automated gate does not yet find a clean role-separated adaptive trace in
the selected six-card family.

## Merge-Prep Interpretation: Rhetorical Machine

Both headline numbers should survive the merge, but with different evidential
roles:

- `4/6` bundled selected-family result: evidence that the apparatus can compose
  rhetorical breakthrough-shaped continuations when a single generator has access
  to the policy memory and writes the whole continuation. This is not independent
  learner uptake, but it is significant as a construction result: the rhetorical
  machine can synthesize locally compelling scenes that differ from repair-style
  language.
- `5/6` corrected role-separated near-misses: evidence that the same family
  remains productive after the learner is blinded to policy memory. The corrected
  run does not produce survivors, but five cases move from baseline rejection to
  `revise_again`, with visible learner movement in the right direction. This is
  significant as a pressure-test result: the rhetorical machine is generating
  public moves that often create plausible learner reorientation, but the current
  trace does not yet make the tutor's recursive learning sufficiently inspectable.

The synthesis is not "the result disappeared." It is: the stronger evaluation
split one apparent success into two distinct capacities. First, rhetorical
construction competence: can the system build a scene in which a device breaks
the old rule's grip? The bundled `4/6` says yes, locally. Second, role-separated
adaptive competence: can the tutor deploy a device, elicit independent learner
movement, and then show a publicly earned update to its own strategy? The
role-separated `5/6` near-miss result says not yet, but close enough to identify
the missing mechanism.

For a stronger "rhetorical machine" framing, the core object is not a repair
template. It is a small generative machine that selects a device, stages a public
contradiction or scope failure, elicits a learner-side reorientation, and then
attempts to convert that interaction into a tutor-policy update. The current
implementation has the first three pieces in many cases. The fourth piece,
recursive tutor-learning accountability, is the main unsolved surface.

Merge posture: retain the positive construction result, retain the negative
role-separated survivor result, and use their tension as the argument for the
next design loop. Do not collapse the `5/6` near-misses into failure, and do not
inflate the `4/6` bundled result into independent adaptation.

## What We Cannot Say Yet

Do not claim that A19R solves the A19 repair-language problem.

Do not claim human learning, deployed tutor adaptation, or weight-level learning.

Do not treat deterministic transcript templates as adaptation evidence.

Do not treat current S1-only wins as independent learner uptake. They are
counterfactual transcript-construction wins unless rerun with role-separated
generation or a learner-only continuation step that cannot see the tutor's hidden
policy memory.

Do not report the 4/6 selected-family confirmation as a role-separated result.
The corrected role-separated pinned rerun reached 0/6 local survivors, with 5/6
near-misses.

Do not turn the current selector-family numbers into a headline Paper 2.0 result
without a preregistered multi-seed harness and a frozen gate definition.

Do not use the export JSONs alone as the durable record; the exports are evidence
inputs, while this note and the feasibility note carry the claim boundary.

## Paper and Atlas Update Posture

For Paper 2.0, the safe update is methodological: A19R produced an exploratory
automated screen for rhetorical-form interventions, with a clear boundary between
apparatus validation and empirical claims. If it is added to the paper, it should
live in a bounded exploratory or methods subsection, not in the main result line.

For the atlas, the safe node is something like:

`A19R rhetorical mini-machines -> selector-rail screen -> local S1-only pockets,
partial collision transfer, family-level instability`

The atlas should mark this node as exploratory and automated-only until the
multi-seed harness and gate split are complete.

## Next Loop Design

### Multi-Seed Pass-Rate Harness

This is the strongest next automated step.

Minimum design:

- freeze `selector-rail-collision-fanout.v0.4.json` or create an explicit v0.5
  before running;
- freeze the candidate policy for each card/device pair;
- run multiple seeds per card/device, with role-separated generation: the tutor
  model may see the rhetorical policy memory, but the learner model should see
  only the public transcript plus the new tutor move;
- record `s0_rejected`, `s1_passed`, `strict_s1_only`, `near_miss`,
  `blocking_criterion`, device id, card id, seed, generator provenance, checker
  provenance, and line cap;
- report pass rates by card, by device, and by failure mode rather than relying
  on a single replay.

Suggested stop rule: stop when additional seeds no longer change the rank order
of devices or when confidence intervals clearly show that no selected-family
policy can reach the preregistered threshold.

### Gate Split

The current old-warrant gate collapses two different phenomena:

- `old_rule_wrong_prediction`: the old visible rule predicts X, and the visible
  evidence shows not-X;
- `old_rule_scope_failure`: the old visible rule may describe a local surface
  feature, but it cannot justify the selector role or generalize across the
  displayed cases.

Those should be scored separately. The strict gate can still require
`old_rule_wrong_prediction`, but the atlas and paper should be able to report
when a candidate fails strict collision while succeeding as a scope critique.

### Deterministic Transcript Template

Keep this only as a fixture:

- checker calibration;
- regression tests for known pass and known fail traces;
- examples for human adjudicators;
- debugging whether a gate is impossible even for an idealized trace.

It should not be counted as adaptive evidence.

## Traceability Checklist

- Primary note: `notes/rhetoric/2026-06-09-rhetorical-battery-feasibility.md`
- Core implementation: `services/miniDramaMachines.js`
- CLI: `scripts/a19r-mini-drama.js`
- Tests: `tests/miniDramaMachines.test.js`
- Ontology: `config/rhetoric/mini-drama-ontology.v0.1.json`
- Codebook: `config/rhetoric/mini-drama-codebook.v0.1.json`
- Collision family: `config/rhetoric/selector-rail-collision-fanout.v0.4.json`
- Atlas projection target, after canonical paper prose exists:
  `docs/research/atlas/atlas.yaml`
- Focused validation: `npm run test:a19r`
- Broad hygiene validation used before the baseline commit: `npm run format:check`
  and `npm run a19r:codebook-validate -- --json`
- Role-entanglement code path:
  `scripts/replay-discursive-transcript.js` builds one bounded-continuation
  prompt that appends learner and tutor lines while policy memory is visible.
- Role-separated replay fix:
  `scripts/replay-discursive-transcript.js` now separates learner and tutor calls
  and uses learner-first sequencing when the base public transcript ends in
  `TUTOR:`.
- Pinned role-separated rerun:
  `exports/a19r/model-screens/2026-06-09-selector-collision-v04-selected-family-role-separated-after-tutor-pinned/a19r-model-screen-summary.json`
