# Selector trajectory v0-v4: what actually worked

Date: 2026-06-15

This note summarizes the dramatic-derivation selector arc from v0 through v4. It is meant as an external-analysis packet for GPT Pro / Deep Research: it separates the empirical result from our local interpretation, and it names the open conceptual problem without asking the next model to rescue a failed taxonomy.

## Executive read

The original research question was whether a tutor can adaptively select a hidden proof-continuity representation or a visible learner-facing representation from authored proof geometry. The current answer is no, or at least not with the selector line from v0 through v4.

The real gain is different: hidden pacing plus proofDebt is a strong reliability mechanism. It improves tutor response quality by preserving proof continuity under decay, preventing premature release or assertion, and keeping the tutor oriented to the formal dependency chain when the learner-visible dialogue is noisy.

That is a meaningful result, but it is not yet evidence of adaptive representation selection. It is evidence that the tutor benefits from an internal proof-obligation ledger.

## The two candidate mechanisms

### Candidate A: adaptive representation selection

The selector hypothesis said: some worlds need hidden proof-state control, while other worlds need visible learner-facing state, and authored geometry can choose between them.

If this were true, selective would beat or match always-H across held-out worlds and would avoid negative transfer. It would also identify a repeatable visible-positive class where hidden reliably hurts.

That did not happen.

### Candidate B: hidden proof-continuity discipline

The hidden+proofDebt hypothesis says: under decay and act-bounded memory, the tutor needs an internal view of the proof obligations that are still live, lost, corrupted, or unrepaired.

This does not require a meaningful H/V routing decision. The tutor can simply keep a private ledger of proof debt and use it to govern release, repair, consolidation, and final assertion.

This is the mechanism the evidence now supports.

## Evidence by selector generation

| generation | intent | strongest result | failure mode | current interpretation |
| --- | --- | --- | --- | --- |
| v0 | Original geometry selector: hidden for fork/depth, visible for linear/coupled cases. | Avoided visible failure on obvious H-positive branch worlds. | Withercombe was routed visible and underperformed hidden/no-guard under decay. | Falsified as adaptive selector. It mistook static linear geometry for visible-safety. |
| v1 | Conservative repair: hidden for independent joins; visible only for mirror-dead-predicate evidence; fail closed to hidden under decay. | Five-world probe including Hethel: v1 23/25, always-H 22/25; Hethel routed visible and grounded 5/5. | Advantage rested on one narrow Hethel signal; original four-world matrix still lost to always-H 18/20 vs 19/20. | Best selector signal so far, but not enough. It suggests visible can help somewhere, not that the route detector is reliable. |
| v2 | Consolidated-board correction: choose hidden when decay plus shared proof-critical source pressure makes continuity fragile. | Corrected v1's Hethel negative transfer in Codex-learner repeats by routing hidden. | Collapsed to hidden everywhere on current stress worlds. | Useful diagnostic, not adaptive selection. It says fail closed to proof continuity. |
| v3 | Further selector/episode exploration around visible-positive and replay-localized failures. | Helped debug false positives and failure turns. | Did not produce a stable visible-positive class. | Better instrumentation, not a better selector. |
| v4 | Hidden default plus visible shadow consolidation/assertion gates; proofDebt confidence matrix. | With proofDebt, strong on original worlds; stable under Sonnet and seed-2 perturbations on Withercombe/Ravensmark. | Held-out Lantern and Marrick were negative transfer vs hidden+proofDebt. Without proofDebt, v4 collapsed outside Ravensmark. | Not a better selector. Its useful part is hidden+proofDebt; extra visible gates appear brittle. |

## Key empirical anchors

Primary artifacts:

- `exports/dramatic-derivation/selector-reliability-report.md`
- `exports/dramatic-derivation/selector-v1-report.md`
- `exports/dramatic-derivation/selector-v2-adjudication-report.md`
- `exports/dramatic-derivation/selector-consolidation-unattended-report.md`
- `exports/dramatic-derivation/selector-v4-confidence-report.md`

Important numbers:

- v0 four-world matrix: selector 18/20, always-H 19/20, always-V 10/20, no guard 10/20, oracle 19/20. Withercombe was negative transfer.
- v1 original four worlds: selector 18/20, always-H 19/20. v1 fixed Withercombe but still lost one Sealhouse hidden-route run.
- v1 with Hethel: selector 23/25, always-H 22/25, always-V 14/25, no guard 12/25, oracle 23/25. This is the only aggregate where a selector beats always-H.
- Consolidation pass over 57 comparison groups: 1 strict V-positive, 3 visible route failures, 11 false positives, 41 not-visible-route, 1 inconclusive.
- v4 confidence matrix over six worlds: hidden+proofDebt 91.7% world-mean success, v4+proofDebt 75%, visible+proofDebt 33.3%, v4 without proofDebt 16.7%.
- v4 negative transfer: Lantern and Marrick.

## What hidden+proofDebt buys

Hidden+proofDebt is best understood as a tutor-quality mechanism, not a representation-selection mechanism.

It buys:

1. **Proof continuity under decay.** The tutor can keep track of which proof-critical source premises are still needed even when the learner has dropped or corrupted them.
2. **Repair before advance.** The tutor has a principled reason to re-stage or confront a lost/bent premise instead of pressing forward on a locally fluent but formally broken dialogue.
3. **Assertion discipline.** The tutor is less likely to accept a final answer when the learner-visible board does not entail it.
4. **Release discipline.** The tutor can prevent locally licensed releases that are clock-fatal or proof-insolvent.
5. **Reduced susceptibility to visible fluency.** The learner can sound near the answer while still missing a hidden dependency. Hidden+proofDebt catches that.

This is a substantial gain in pedagogical reliability. It makes the tutor more patient, more exacting, and less likely to confuse dialogue momentum for learning.

## Why H/V may be the wrong hinge

The H/V distinction is real, but it may not be the primary adaptation hinge.

Visible state can detect local uptake, hesitation, echo, and apparent consolidation. Hidden state can track proof obligations, dependency structure, and formal closure. But the failures suggest the central adaptive decision is not "hidden or visible?" It may be something like:

- repair vs advance;
- release vs consolidate;
- confront vs restage;
- hold act boundary vs open new act;
- local uptake vs proof entitlement;
- explanation pressure vs evidence entitlement;
- learner epistemic confidence vs formal grounding;
- public dramaturgical progress vs private proof solvency.

H/V may be an implementation substrate for these decisions rather than the decision itself.

The visible route did not usually fail because visible information is useless. It failed because the visible signals were too weakly connected to the real control problem. Page-state, lexical uptake, and local branch closure often looked good while the proof chain remained fragile.

## What to make of Hethel

Hethel remains the one serious visible-positive signal.

In the v1 five-world probe, v1 routed Hethel visible by `mirror_dead_predicate_visible` and grounded 5/5, while hidden grounded 3/5 and visible grounded 4/5. In the consolidation pass, however, the positive signal narrowed to one strict V-positive replicate, with additional Hethel visible false positives and at least one visible route failure in later Codex-learner repeats.

This means Hethel should not be discarded. It should be reframed.

Hethel may indicate a class where the learner-facing representation helps resolve a local false structure or dead-predicate decoy. But it has not yet become a reliable selector class. If there is a future v5, Hethel is the seed case, not the proof.

## What to make of v2-v4

v2-v4 look increasingly like ablation creep if the question remains "can we build a better H/V selector?"

They were useful because they exposed the stronger mechanism:

- v2 showed that consolidated proof-board gaps explain many failures better than hidden/visible stories.
- v3 made episode replay and failure-localization more useful.
- v4 showed that proofDebt is the active ingredient and that extra visible consolidation/gating can hurt.

But as selector refinements, v2-v4 do not improve the policy surface. They either collapse to hidden or add brittle gates.

## Is v5 a genuine prospect?

v5 is genuine only if it stops being another H/V geometry tweak.

A valid v5 would start with a positive requirement:

> Identify or construct a held-out world where hidden+proofDebt reliably loses, visible or visible-consolidation reliably wins, and the reason is specified before outcomes are known.

If we cannot state that reason before running, v5 is probably taxonomy creep.

### Minimum bar for v5

1. Predeclare one candidate non-H hinge, not a list of situation types.
2. Build or identify one clean held-out world that should exercise it.
3. Compare hidden+proofDebt, visible, visible+proofDebt if available, and v5.
4. Require v5 to beat hidden+proofDebt without increasing negative transfer on H-positive worlds.
5. Use episode replay only to localize candidate mechanisms, not to relabel failed worlds after the fact.

### Signs v5 is ablation creep

- It adds more selector categories after seeing failures.
- It explains Lantern/Marrick after the fact rather than predicting them.
- It treats "visible sometimes works" as evidence for visible selection.
- It optimizes against baseline or always-V instead of hidden+proofDebt.
- It cannot name a world where hidden+proofDebt should hurt.

### Signs v5 is real

- It changes the adaptation hinge away from H/V selection.
- It predicts a new failure of hidden+proofDebt before running.
- It defines a measurable control decision, such as repair/advance, release/consolidate, or epistemic entitlement/assertion.
- It is evaluated against hidden+proofDebt as the main baseline.
- It uses the consolidated proof graph as the board, not separate hidden/visible stories.

## Candidate alternative research directions

These are not proposed implementations. They are prompts for external analysis.

### 1. Epistemic entitlement selector

Instead of selecting hidden vs visible, select whether the learner is entitled to a claim. The tutor's adaptive choice becomes:

- ask for read-back;
- restage evidence;
- consolidate a subproof;
- invite final assertion;
- block final assertion.

This treats proofDebt as central and visible signals as evidence about entitlement, not as a route.

### 2. Repair/advance controller

The tutor's real decision may be whether to repair an existing obligation or advance the release schedule. Hidden proofDebt supplies the obligation graph; visible conduct supplies symptoms. The adaptive unit is not a representation but a move policy.

### 3. Act-boundary controller

Some failures happen at D=3 or near act boundaries, where the learner enters a new act with a thinned board. The adaptive decision may be when to close/open acts and what must be re-certified before an act boundary.

### 4. Evidence provenance controller

Failures may differ depending on whether proof-critical evidence arrives through tutor, director, or learner inference. The control problem may be provenance-aware consolidation: evidence released by the director may need different repair/consolidation than evidence actively elicited by the tutor.

### 5. Consolidated proof-board policy

The most promising substrate is the single consolidated board/proof graph. It avoids separate hidden/visible stories and asks what proof-critical obligations are live, decayed, corrupted, shared across branches, or unsupported by the learner-visible board.

## Questions for external analysis

1. Is the hidden+proofDebt result best described as adaptation, metacognitive regulation, constraint satisfaction, or proof-state control?
2. What existing tutoring or cognitive-science frameworks map onto "proof debt" as an instructional mechanism?
3. Are there known cases where learner-visible state should override private expert proof-state?
4. What formal property would make hidden proof-state actively harmful?
5. Can "visible-positive" be defined without referring to current implementation artifacts such as lexical uptake or false-blocks?
6. Should future work abandon H/V selection and instead model tutoring as a controller over proof obligation, learner entitlement, and evidence release?
7. What would count as a real adaptive gain beyond a stronger non-adaptive hidden tutor?

## Current recommendation

Use hidden+proofDebt as the reliability baseline and probably as the production path for the dramatic-derivation harness.

Do not promote v4. Do not implement v5 as another incremental selector unless a clean visible-positive world and predeclared mechanism are available.

The research claim should be revised from:

> Adaptive H/V representation selection works.

to:

> Under decay and bounded learner memory, a hidden proof-debt controller substantially improves tutor reliability by preserving proof continuity. The H/V distinction remains mechanistically real, but adaptive selection over H/V is not yet established and may be the wrong abstraction.

