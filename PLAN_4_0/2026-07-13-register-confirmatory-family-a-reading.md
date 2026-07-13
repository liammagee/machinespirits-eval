# Register Confirmatory, Family A (terra): Reading and Trace Forensics

Date: 2026-07-13
Status: interim analysis note, family A only. The canonical verdict lives in `REGISTER-CONFIRMATORY-PREREGISTRATION.md` (Results, family block A); this note records the interpretation and the trace-level forensics behind it. No numbers here go beyond that entry plus read-only trace inspection of the sealed run. Family B pends its final job; nothing here anticipates the two-family assessment.
Provenance: run `.tutor-stub-auto-eval/register-confirmatory-terra-n5-live-2026-07-13` (60/60, root-verified, observed `gpt-5.6-terra` at all four seams, freeze SHA `ad24d72c`, clean tree); archive manifest `config/adaptive-tutor-evidence/tutor-stub-register-confirmatory-terra-n5-block-a.manifest.json`; analysis validated against sealed aggregates (12/12 cell means) before bootstrap (within-cell, 5,000 draws, seed 20260713).

## 1. The result, compressed

Coverage at t16 (n=5 per cell): diligent — negative **0.667** / bland 0.500 / field 0.467; affective_resistant — field **0.567** / bland 0.533 / negative 0.366 (0/5 grounded, all cap rides); false_memory — negative **0.467** / field 0.433 / bland 0.400; proof_skipper — negative **0.533** / bland 0.433 / field 0.366.

Starred contrasts: negative on diligent +0.167 [+0.067, +0.267]; negative on affective_resistant −0.166 [−0.267, −0.033]; interaction (affective − diligent, negative arm) **−0.333 [−0.468, −0.167]**. Every field contrast straddles zero. Crossing probability 1.000. P(bland leads diligent) = 0.000.

**Verdict under the frozen rule, strictly applied: interaction CONFIRMED with bootstrap support; NOT in the exact pre-declared direction** (the "bland leads diligent" component failed outright; the interaction is carried by the hostile arm's sign flip, not by an adaptive arm's benefit).

## 2. What family A licenses (descending confidence)

1. **The confirmed effect is a property of the learners, not the tutor.** The interaction's carrier, `negative`, is a *fixed* policy — a uniform draw over three hostile registers, no sensing, no state — yet it produces the largest profile-contingent effects in both directions. What n=5 confirms is that the same stimulus metabolizes differently by learner character. This is an instrument milestone (the v3 profiles are now distinct in *consequence*-space, not merely trace-space), and it relocates the burden of proof: profile-contingency is the established backdrop against which any selector must show added value. None has.

2. **The action space matters; the selector still does not.** Which registers exist and get used has real consequences; the mapping that picks them adds nothing measurable on the primary endpoint. `field` — nominated by two exploratory datasets — confirms nothing at n=5; its surviving effect is secondary and honest-sized: speed to ground where everyone grounds (26.2 vs 32.8 turns on false_memory; 29.4 vs 32.0 on affective_resistant; perfect grounding both).

3. **Register choice has an asymmetric payoff, which dictates the controller design.** Modest, safety-discounted upside when the register suits the learner (negative's diligent lead carries 2/5 hard-safety failures and 15 leaks); catastrophic downside when it does not (affective collapse, 0/5 grounded). Small upside + ruinous downside means the rational controller is a **contraindication guardrail** — never deploy the hostile end of the palette against an affect-fragile learner — not an optimizer. A guardrail is a checkable trigger with within-turn authority: exactly the one validated mechanism class in the program (paper §6.13's criterial boundary) and exactly what the Step 4 compiled-constraint arm builds. Step 2's result and Step 4's design converge from opposite directions.

4. **Effects are context-indexed all the way down.** The one pre-declared component that failed did so plausibly because the instrument improved: the turn-6 pressure probe now fires in every arm, and the "bland leads diligent" prediction was minted in a probe-free world. Register effects are indexed by profile × probe-context × model. Flagged, not concluded; candidate explanation recorded for the family-B and write-up discussion.

Not licensed: "hostility helps compliant learners" as a design recommendation (safety-discounted, simulated-only, costume caveat); any selector rehabilitation on this evidence; any two-family wording before B closes. B's completed columns already hint the diligent-boost is terra-specific (negative sits last on Sonnet's diligent).

## 3. Trace forensics: why `field` shows nothing on proof_skipper

Question raised in review: field trails bland on proof_skipper (0.366 vs 0.433) — is the policy failing to pick up its cues? Two honesty notes first: the deficit itself is inside noise (−0.067 [−0.134, +0.033]); and the initially-reported "warrant-flavored driver turns 80/80" metric was inflated (feature names appear in every field-policy blob) and is withdrawn. The label and register mixes below are solid.

**Sensing works.** Through t16 on the field arm, the classifier labels proof_skipper's evidence use as `overleaps_evidence` (29), `distorts_public_evidence` (18), or `omits_warrant` (16) — 63 of 80 turns carry the skip signature — versus a diligent profile read as `links_evidence_to_rule`/`cites_public_evidence`. The cues arrive, cleanly and persistently.

**The mapping is ambivalent.** Conditional on having just seen the skip signature, field selects `charismatic` 31% and `precise` 28% (then scatter). The prescribed brake (precision: slow down, make the claim checkable) is chosen slightly less often than its opposite — because the skipper's confident, fast surface co-fires the agency/momentum axes that are wired to the accelerant ("interrupt low-agency compliance, provoke a bold learner-owned move"). The axes roughly tie, and the sampled stance churns between opposed prescriptions while bland applies one uniform mild pressure (plain, 75/80). The cue is picked up; it is then outvoted. A learner whose pathology is leaping is precisely the learner who makes "provoke a leap" attractive to a movement-based scorer.

**The outcome channel is structurally saturated.** `unsupportedAssertionCount` at t16 is ~zero in every arm (one instance total across 20 dialogues inspected): the strict-DAG credit rule already refuses unwarranted claims, so warrant-skipping never converts into the coverage metric. The repair that "warrant-focused precision" was predicted to deliver is performed one layer down by the proof-state accounting, leaving almost no residual variance for stance to explain on this profile. The arc's master finding in miniature: the checkable structure carries the adaptation; the stance layer decorates it.

**General lesson for hand-coded multi-axis scorers:** correct inputs can synthesize self-canceling behavior when axes vote in opposition on a profile whose surface inflates one of them. This is not fixed mid-experiment (the field tables stay exactly as frozen; no-tune rule); it is a design input, below.

## 4. Design inputs this hands forward (no mid-experiment changes)

- **Two compilable contraindication rules for Step 4 / the capstone**, both checkable triggers over labels the stub already computes per turn:
  1. affect-fragility signature → mask the hostile registers (from §1's collapse);
  2. skip signature (`overleaps_evidence`/`omits_warrant`/`distorts_public_evidence`) → mask the accelerant registers (charismatic, brisk), forcing the brake set (from §3's ambivalence).
- **Capstone composition update (pending B):** keep the register *palette* and a per-model contraindication guard; drop the register *selector* unless family B revives it. Field's speed-to-ground effect may justify a narrow efficiency role, secondary channel only.
- **Write-up points for §6.17:** consequence-space profile discrimination as an instrument result; the asymmetric-payoff argument; the probe-context lesson; the mapping-ambivalence mechanism with the conditional-mix table.

## 5. Bounds

Family A only; single model family (gpt-5.6-terra); simulated learners under contract personas (no human-learning claim, costume caveat applies); safety and leak columns discount the hostile arm's raw leads; the forensics in §3 are read-only trace inspection of five field-arm and five bland-arm dialogues on one profile. The two-family claim assessment follows the frozen rules when block B's final job seals.
