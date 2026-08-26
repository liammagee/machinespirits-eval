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
  SHA-256: `c5508aeca02d77e04df74984132b28774b7a3f421af204438f76d380d0fee74d`
- Semantic registration: `config/tutor-stub-resistant-learner-merged-semantic-registration.v5.json`  
  SHA-256: `5b149e18d328f06696a61536e7aff270cba2240a75f6d52a38049cb98cb9383e`

The existing V4 call plan already reserved three tutor-delivery calls per dialogue. Applying that reserve symmetrically does not increase the ceiling: 62 planned calls per dialogue, 2,232 planned calls for 36 dialogues, 192 maximum reservations per dialogue including headroom, and a 6,912 calibration maximum. No V4 row, replay judgment, tie audit, or private plant is eligible for V5 scoring or pooling.

not registered, not launched — operator decision pending
