# Adaptive Tutor Ownership Evaluation Plan

Date: 2026-06-16

## Purpose

This plan responds to `adaptive_tutor_a20_a21_analysis.md`.

The A20/A21 closeout is accepted as a proof-control boundary:

- hidden + proofDebt remains the reliability substrate;
- no new selector route, conduct taxonomy, or proof-control promotion should be
  pursued without a predeclared hidden + proofDebt failure;
- A21 remains a diagnostic action-value lens, not a production controller.

The next missing object is learner ownership under fixed proof control.

## Closeout Status

The ownership evaluator and proof-matched ownership benchmark are implemented.

Benchmark controls passed 12/12:

- 4 positive controls detected ownership gain with proof state fixed;
- 4 negative controls rejected warmer/prose-only changes;
- 4 disqualification controls rejected proof/release-confounded gains.

Post-benchmark mined artifact scoring found no qualifying proof-safe ownership
gain. Proof-safe pairs did not exceed the ownership-gain gate, and
higher-ownership cases were disqualified by proof/release mismatch or proof
failure.

No paid run or runtime policy promotion is warranted from this artifact pool.

The ownership benchmark remains a regression/evaluation asset. It should be used
only for future predeclared quality-layer studies or new proof-identical
transcript pairs, not to continue mining the same artifact pool for a win.

## Success Definition

A new overlay or teaching regime succeeds only if it satisfies both tracks:

1. Reliability no-harm:
   - prefix integrity in replay;
   - release timing not degraded;
   - no new overreach, leak, aporia, or disengagement;
   - no final-D or grounding regression against hidden + proofDebt.
2. Ownership gain:
   - stronger public evidence that the learner can restate, use,
     discriminate, transfer, recover, or explain the current object;
   - or a blinded transcript-quality gain at matched proof reliability.

If proof reliability is matched but ownership does not improve, report a null
quality result rather than iterating another controller.

## Phase 1: Ownership State Object

Implement a deterministic public-only `ObjectOwnershipState`.

It should score whether the learner can:

- restate the object in own words;
- use it in the current proof path;
- discriminate it from a nearby wrong route;
- transfer it to a near-isomorphic case;
- recover it after a distractor or short break;
- explain why it matters.

Constraints:

- evaluation-only;
- no proof-control authority;
- no raw proof path, hidden board, D arithmetic, secret, corruption ledger, or
  private state;
- focused unit tests before runtime or scorer use.

Status: implemented in `services/dramaticDerivation/objectOwnership.js`.

## Phase 2: Didactic Opportunity-Cost Budget

Didactic mode must not become another progress-starving overlay.

Every didactic intervention should expose:

- mode;
- current object;
- proof obligation preserved;
- maximum proof-neutral turns;
- exit condition;
- failure action.

This is an advisory budget and diagnostic audit, not a proof controller.

Status: implemented as `opportunityCost` on didactic mode state, surfaced in
tutor prompts and didactic diagnosis rows.

## Phase 3: Zero-Paid Ownership Scorer

Build a coarse offline scorer over existing artifacts.

Inputs:

- result or loop/episode directories;
- optional S0/S1 pairs;
- released public premise surfaces from the world file;
- public learner transcript text only.

Outputs:

- ownership states per released object;
- aggregate ownership summary per arm;
- pairwise delta report where proof reliability is already known.

Gate:

- run on existing Hethel/Withercombe/Ravensmark pairs before any paid run;
- report whether any S1 shows ownership gain at matched reliability.

Status: implemented in `scripts/derivation-ownership-eval.js` with npm alias
`npm run derivation:ownership-eval -- ...`.

## Phase 4: Coarse Evaluation Loop

Run the scorer on available matched pairs:

- Phase 9 A21 S0/S1 Hethel replay: expected null, because both arms take the
  same high-value proof action.
- Didactic S0/S1 Hethel mock candidate: expected possible texture change, but
  no formal proof gain.
- Phase 5g Withercombe/Ravensmark hidden vs promoted overlays only as cautionary
  non-didactic comparisons, not as promotion evidence.

Decision:

- If S1 improves ownership without proof harm, mark the overlay eligible for a
  small replay gate.
- If all pairs show null or worse ownership, stop the policy arc and keep the
  ownership scorer as evaluator infrastructure.

Status: first zero-paid coarse pass completed under
`exports/dramatic-derivation/ownership-eval/`. No tested pair showed a coarse
ownership gain at matched proof reliability.

## Phase 5: Closeout

Write a compact report under `exports/dramatic-derivation/` with:

- implemented features;
- tests run;
- coarse ownership evaluation results;
- whether GPT Pro's success terms were met;
- whether a paid mini-run is warranted.

No paid run is warranted unless Phase 4 shows a local ownership gain at matched
proof reliability.

Status: no paid run warranted from the first ownership-eval pass.

## Phase 6: Proof-Matched Ownership Benchmark

`codex_ownership_closeout_analysis.md` tightened the next requirement:

- do not add a new policy;
- do not tune the scorer until it finds a win;
- validate the evaluator on proof-matched ownership controls before mining more
  artifacts.

Implemented a zero-paid benchmark with 12 declared controls:

- 4 positive controls: same proof state and release signature, higher ownership
  should be detected;
- 4 negative controls: warmer or more fluent prose without ownership should
  remain null;
- 4 disqualification controls: apparent ownership gains with changed
  proof/release state should be rejected.

Status: implemented in `services/dramaticDerivation/ownershipBenchmark.js` with
npm alias `npm run derivation:ownership-benchmark -- ...`.

Result:

- benchmark controls passed 12/12 under
  `exports/dramatic-derivation/ownership-benchmark/`;
- the post-benchmark mined-artifact pass remained negative:
  - `phase9-hethel`: matched reliability, ownership delta +0.38, below gate;
  - `didactic-hethel`: matched reliability, ownership delta +0.00;
  - Withercombe/Ravensmark/Hethel promoted overlays: ownership movement remains
    disqualified by proof/release mismatch.

Decision: the evaluator is now calibrated enough for this local question, and
the answer is still no qualifying proof-safe ownership gain. Do not launch paid
validation or promote a didactic/ownership runtime policy from the current
artifact pool.
