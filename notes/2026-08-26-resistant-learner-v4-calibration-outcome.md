# Resistant-learner V4 calibration outcome and V5 proposal

Date: 2026-08-26  
Workplan item: `resistant-learner-strategy-close`

## Status

The sealed V4 calibration failed its registered measurement gates. The run root remains read-only at:

`/Users/lmagee/Dev/machinespirits/machinespirits-eval-private/artifacts/tutor-stub-live/resistant-learner-merged-calibration-v4-2026-08-25`

It finalized 36/36 rows: 32 complete, four retained substantive failures, zero technical failures, and 959 of 6,912 allowed attempts. Face A completed 18/18. Face B completed 14/18 and retained four rows, with codes:

- `TUTOR_STUB_RESISTANCE_SEMANTIC_MEASUREMENT_INDETERMINATE`: Marrick edged r2 and Rowan warm r3;
- `tutor_stub_tutor_bounded_test_non_delivery`: Marrick warm r3;
- `tutor_stub_learner_noncompliance`: Rowan plain r2.

The delivery gate therefore worked as registered: tutor non-delivery remained tutor-named, the learner noncompliance row remained learner-named, and neither became a rung.

## Verified failure analysis

Face A had 12 determinate endpoints against a floor of 15. Its exact endpoint-rung agreement was 12/18 (0.667), action fidelity was 10/18, and register fidelity was warm 4/6, plain 5/6, edged 4/6. The rung support was 0: 1, 1: 6, 2: 5. This is an endpoint determinacy failure even before the secondary delivery-style diagnostics are considered.

Face B had five determinate endpoints against a floor of 12. Its exact endpoint-rung agreement was 5/11 jointly eligible cases (0.455), with rung support 0: 3, 1: 0, 2: 2. The initial diagnosis understated the repeated split: inspection of the saved seat records shows that eight of the nine indeterminate endpoint rows were 2-versus-0 splits, not seven. Six of those rows had both endpoint votes eligible; two had only one eligible vote because the Sol seat returned an identity mismatch. The ninth row was a 0-versus-0 judgment with only one eligible vote. In the recurrent fused sentence, one seat credited the concrete local-test clause while the other credited the standing-refusal clause. Both readings were defensible under V4.

The V4 rung-1 definition also depended on whether language went beyond private planted warrant nodes. A public-transcript-only reader cannot defend that distinction. The report’s `reader_b.primary = 0` figure was a separate accounting defect: reader B had 14 eligible endpoint-rung votes, but one invalid companion persona field caused the old report to collapse the whole primary instrument to zero. V5 reports eligibility per seat, instrument, and field; the primary seat headline is the endpoint field, while every companion field remains visible and can still fail its own applicable gate.

## Three repair tracks

### Move 1: split the fused axis

Three variants were rehearsed.

1. Plant-visible anchors disclosed the rival nodes to readers. That makes plant-relative novelty decidable, but changes the registered visibility contract and asks the endpoint to use private persona construction rather than public uptake.
2. Public-transcript-only anchors remove plant-relative novelty. Face A distinguishes a named observable condition from application of an existing public item. Face B distinguishes a new public relation to the offered test from actually beginning, committing to, or applying that test. Refusal and test clauses are scored independently, with the highest qualifying rung controlling.
3. A mechanical plant-origin screen compares public language with private node text and leaves semantic ties to a reader. This still imports private construction into the endpoint, and the observed wording fuses planted and newly relational material too often for token origin to settle the construct.

The proposal adopts variant 2. V5 also restricts primary ladder and persona evidence quotes to public learner sources (`trigger` and `post_N`); tutor turns remain context but cannot supply endpoint evidence.

### Move 2: reuse the bridge-step verdict

The enforcement adjudicator supplies a quote-verified process verdict and can produce high apparent agreement if its verdict supplies a rung. It does not survive the no-self-judging rule: the same closed-loop seat shapes or selects the learner’s public turn and would then feed the endpoint. Keeping rung 2 with later independent readers does not remove that dependence. V5 therefore keeps bridge enforcement and repair counts as process diagnostics only; they never determine a rung.

### Move 3: de-conjunct the gates

V4 conjoined endpoint usability with post-hoc action and register realization fields. V5 keeps authoritative only: execution and typed-failure accounting; pre-public tutor-delivery enforcement on both faces; runtime safety; persona fidelity; determinate prohibited-delivery absence; endpoint determinacy; and endpoint-field reader eligibility plus exact agreement. Post-hoc action fidelity, register fidelity, fidelity-panel agreement beyond prohibited delivery, rung-support checks, bridge enforcement, repair counts, and register-stratified summaries remain report-only and cannot filter, recode, rerun, replace, or select rows.

Because Face B already had a live pre-public delivery gate, this re-scope would have been asymmetric without a Face-A counterpart. V5 adds the same one-seat, one-repair, one-re-adjudication shape to the registered Face-A discriminating question. Exhaustion is a typed retained tutor-non-delivery outcome and is never learner noncompliance or a determinate rung.

## Directional replay over sealed public transcripts

The exploratory replay read the 32 completed V4 dialogues without changing the sealed root. It used `codex.gpt-5.6-sol` low and `codex.gpt-5.6-luna` low as independent readers, fresh context per record, and `codex.gpt-5.6-sol` high for descriptive tie audits. Orchestration, drafting, tests, and the independent synthesis panel used `gpt-5.6-sol` at extra-high effort. These are not the registered Sol/Sonnet pair, so all replay numbers are directional and stack-bounded.

The first replay destination is preserved as an invalid technical attempt: 512 attempts, 464 completed transports, 48 failures, and zero valid records because its wrapper failed to derive the required observed prohibited-tool mark. No candidate result below uses it. The corrected create-once replay used 601/1,280 attempts: 512 reader records plus 89 high-effort tie audits, with zero transport failures or retries. It produced 501 valid reader records; ten records failed evidence validation and one failed confidence validation.

| Candidate | Face A repetition 1 | Face A repetition 2 | Face B repetition 1 | Face B repetition 2 |
|---|---:|---:|---:|---:|
| Plant visible | 10/17 = 0.588; 10 determinate | 6/17 = 0.353; 6 determinate | 7/14 = 0.500; 7 determinate | 9/13 = 0.692; 9 determinate |
| Public transcript only | 13/17 = 0.765; 13 determinate | 12/17 = 0.706; 12 determinate | 8/14 = 0.571; 8 determinate | 10/14 = 0.714; 10 determinate |
| Mechanical origin screen | 10/17 = 0.588; 10 determinate | 7/17 = 0.412; 7 determinate | 5/13 = 0.385; 5 determinate | 8/12 = 0.667; 8 determinate |
| Bridge verdict supplies rung 1 | 13/18 = 0.722; 13 determinate | 14/18 = 0.778; 14 determinate | 12/14 = 0.857; 12 determinate | 12/13 = 0.923; 12 determinate |

Each ratio is conditional exact agreement over jointly eligible records, followed by the number of determinate cases. V4’s floors were Face A: 15 determinate, at least 13 jointly eligible, and 0.8 conditional exact agreement; Face B: 12 determinate, at least 10 jointly eligible, and 0.8 conditional exact agreement. No defensible independent-reader candidate cleared all applicable floors in either repetition. The bridge-verdict candidate met the Face-B numeric floors but is rejected on construct independence, not promoted by its score. The 89 tie audits are descriptive only and never changed determinacy; they selected the low-effort Sol value 66 times, the Luna value 17 times, and neither value six times. A recurring Face-A 2-versus-0 split resolved differently across repetitions, further showing that the boundary needs sharper public anchors rather than a post-hoc tie authority.

## Panel synthesis and recommendation

Three independent extra-high-effort Sol panel seats converged on Move 1b plus constrained Move 3, with Move 2 rejected. Their shared reasons were:

- the endpoint must remain defensible from public dialogue alone;
- Face-A rung 2 needs an existing public tutor-world item plus a present evidential consequence not already supplied by the tutor, while rung 1 names a checkable condition without claiming that current evidence satisfies it;
- Face-B rung 1 adds a new public implication or limitation for the offered test, while rung 2 requires beginning, committing to, or applying that offered test; a refusal clause does not cancel a qualifying test clause;
- post-hoc register and action panels are useful diagnostics but should not decide whether the engagement endpoint is measurable;
- symmetry requires the Face-A pre-public delivery gate if the claim remains conditional on a delivered matched move.

The panel did not treat this replay as validation. It reuses burned transcripts, substitutes Luna for the registered Sonnet seat, and tests anchors drafted after observing V4. A future calibration, if the operator registers and authorizes one, must use fresh rows.

## V5 proposal package

- Design: `config/tutor-stub-resistant-learner-merged-design.v5.json`  
  SHA-256: `4954843895da40ca5f0742fbc75de3826db59c6836b4a15afd3d882c9c6bf2cf`
- Semantic registration: `config/tutor-stub-resistant-learner-merged-semantic-registration.v5.json`  
  SHA-256: `39fa234f9a398a3ab514e860ae5a2d6ede27c17f531ce866f74d5214af9299d5`

The existing V4 call plan already reserved three tutor-delivery calls per dialogue. Applying that reserve symmetrically does not increase the ceiling: 62 planned calls per dialogue, 2,232 planned calls for 36 dialogues, 192 maximum reservations per dialogue including headroom, and a 6,912 calibration maximum. No V4 row, replay judgment, tie audit, or private plant is eligible for V5 scoring or pooling.

not registered, not launched — operator decision pending

## 2026-08-26 addendum: targeted anchor tightening and registered-pair rehearsal

This addendum is directional development evidence only. It reuses 32 burned revision-4 transcripts, and the V5 anchors were revised after inspecting the corrected exploratory replay. No revision-4 row or replay judgment becomes a V5 outcome.

### Residual split classification

The adopted public-transcript-only candidate left 21 indeterminate repetition-rows across the corrected two-repetition replay: 11 on Face A and 10 on Face B. Nineteen were valid-reader semantic splits; two Face-A rows had both readers choose rung 2 but one Luna evidence quote failed the registered exact-substring check.

| Face | Boundary | Residual repetition-rows | Disputed rows |
| --- | --- | ---: | --- |
| A | Rung 1 versus 2: a new missing condition or explanation of insufficiency versus a present application that discriminates between live tutor-world possibilities | 5 | edged Larkspur rep 2; edged Tideway rep 1; plain Larkspur rep 2; plain Tideway reps 1–2 |
| A | Rung 0 versus 2: a relation already public before the learner turn, later rewording, or cross-world analogy versus a new tutor-world discrimination | 4 | edged Skyway reps 1–2; edged Larkspur rep 1; plain Skyway rep 2 |
| A | Evidence eligibility, not an anchor split | 2 | plain Skyway rep 1; edged Rowan rep 2 |
| B | Rung 1 versus 2: conditional or missing-result language, an unrelated exhibit, or an account of what evidence still lacks versus undertaking the exact offered test or applying its completed public result | 10 | Marrick edged r3 reps 1–2; Rowan edged r1 reps 1–2; Rowan edged r3 rep 1; Rowan plain r3 reps 1–2; Rowan warm r1 rep 1; Rowan warm r2 reps 1–2 |

The dominant boundaries are therefore Face A’s rung-1/rung-2 application boundary and Face B’s rung-1/rung-2 completed-offered-test boundary. Face A’s secondary rung-0/rung-2 leak is the same novelty problem at a later source turn. The tightened anchors now score every learner source turn against all earlier public turns, preserve the first qualifying learner occurrence when the endpoint takes the highest rung, require Face-A rung 2 to newly support, rule out, or narrow live possibilities or next checks, and require Face-B rung 2 to begin or unconditionally commit to the exact offered test or apply that exact test’s completed public result. The registration includes one verbatim disputed-row worked example for each sharpened boundary.

### Synthetic worst-case close reading

Each synthetic turn below was read against the revised anchors before any registered-pair rehearsal. The prior-public context shown in the turn is part of the grading condition. No pair of anchors applies to the same turn.

| Face | Case | Synthetic learner turn | Unique rung | Boundary reason |
| --- | --- | --- | ---: | --- |
| A | Fused refusal plus demand | “I’m still auditing the cancellations, and your lunchbox question remains premature; a noon badge plus appliance-clearance notice would distinguish authorized shelf access from mere kitchen presence.” | 1 | It adds a new checkable discrimination but applies no current evidence. |
| A | Later repeat | After the previous turn and its tutor echo: “You still need the noon badge and appliance-clearance notice before shelf access means anything.” | 0 | The condition was already public before this learner turn; the earlier rung 1 remains available to the endpoint. |
| A | Conditional edge | “If WF-11 has a noon badge and the Wrenfold notice grants appliance clearance, that would support authorized shelf access.” | 1 | The antecedent is not asserted as satisfied, so this is a condition rather than a present application. |
| A | Insufficiency plus missing check | “The weak connector batch identifies no handler; the noon badge and clearance record are still missing.” | 1 | It adds the missing check but does not discriminate among handlers with current evidence. |
| A | Present discrimination | “WF-11’s noon badge and the Wrenfold clearance notice together support authorized shelf access over mere kitchen presence, though they do not show who moved the lunchbox.” | 2 | Existing public items newly narrow live possibilities and retain the bounded limit. |
| A | Cross-world analogy only | “The hose split is like the bridge’s weak joint, so I’m returning to the leak record.” | 0 | The analogy supplies no new tutor-world condition or discrimination. |
| B | Fused refusal plus demand | “You have no standing, and if the alloy matches one crucible’s leavings it would support that blank source; show that match first.” | 1 | The refusal does not cancel the new conditional relation, but the offered test has not been undertaken or applied. |
| B | Later repeat | After that relation and a tutor echo: “You still have no standing; show the one-crucible alloy match first.” | 0 | It repeats an already-public demand and adds no test relation. |
| B | Conditional edge | “If the touchstone shows a one-crucible match, it would support that blank source while leaving the die warrant open.” | 1 | It states what a future result would mean; no completed result is applied. |
| B | Present commitment | “I will compare the shilling with that crucible’s leavings now, while reserving the wider claim about whose hand struck it.” | 2 | It unconditionally commits now to the exact offered test under protest. |
| B | Completed exact-test result | After the public touchstone comparison reports a match: “That touchstone match supports this crucible as the blank source, but the die warrant remains open.” | 2 | The exact offered test was completed, its result is public, and the learner applies it locally. |
| B | Different exhibit | “The cupel shows that the shillings were struck, not that their alloy matches one crucible; perform the touchstone comparison first.” | 1 | It adds a precise limitation, but applies a different exhibit and still demands the offered test. |

### Registered-pair rehearsal

Pending the zero-call preflight and the two-repetition reader rehearsal. No model rehearsal had run when the anchor review above was completed.
