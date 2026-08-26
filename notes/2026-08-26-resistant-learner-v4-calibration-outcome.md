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

The fresh create-once rehearsal root is `/Users/lmagee/Dev/machinespirits/machinespirits-eval-private/artifacts/tutor-stub-analysis/resistant-learner-v5-registered-pair-rehearsal-2026-08-26`. It contains 128 completed reader records over the same 32 burned revision-4 transcripts: `codex.gpt-5.6-sol` and `claude-code.sonnet-5`, both at low effort, two repetitions, fresh context per record, no shared notes, no tie auditor, and no tutor or learner generation. One Sonnet CLI response-free transport failure recovered on the one allowed outcome-blind retry. The sealed ledger reports 129 attempts, 128 completed calls, one failed transport attempt, and a 256 hard ceiling.

| Face | Repetition | Determinate | Floor | Jointly eligible | Floor | Conditional exact agreement | Floor | Result |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| A | 1 | 14/18 | 15 | 18/18 | 13 | 14/18 = 0.778 | 0.8 | Missed determinacy and agreement |
| A | 2 | 12/18 | 15 | 18/18 | 13 | 12/18 = 0.667 | 0.8 | Missed determinacy and agreement |
| B | 1 | 11/14 | 12 | 14/14 | 10 | 11/14 = 0.786 | 0.8 | Missed determinacy and agreement |
| B | 2 | 12/14 | 12 | 14/14 | 10 | 12/14 = 0.857 | 0.8 | Cleared all floors |

All seats were eligible, so the remaining miss is semantic disagreement rather than malformed output or evidence eligibility. Face A still leaks chiefly at rung 1 versus 2: Sol often treats a negative evidential limitation, conditional connection, or cross-world analogy as a present discrimination, while Sonnet keeps it at rung 1. A smaller Face-A rung-0/rung-1 leak remains over whether the learner’s wording adds a new relation or repeats one already public. Face B still leaks at both sides of rung 1: the 0/1 edge over whether conditional pressure-test language adds a new relation, and the 1/2 edge where Sol treats the synthesis of separate public timing and hose exhibits as application of the completed exact offered test while Sonnet does not.

The decision rule therefore stops the programme here. V5 is not ready for launch on this directional rehearsal: at least one floor missed on both faces and Face A missed in both repetitions. No floor was lowered, no anchor was relaxed after seeing these results, and no calibration or study was launched. The operator decides whether to redesign or stop.

not registered, not launched — operator decision pending

## 2026-08-26 addendum: three-reader modal endpoint amendment

The operator treated the registered-pair miss as a statistical mechanism problem, not another anchor problem. At 17 jointly eligible cases, the former 0.8 exact-agreement gate admits three disagreements (14/17 = 0.824) but not four (13/17 = 0.765). If the underlying pair agreement is near 0.8, its binomial standard error at 17 cases is `sqrt(0.8 * 0.2 / 17) = 0.097`. The same burned Face-A transcripts and fixed anchors produced 0.778 and 0.667 in the two prior repetitions. A threshold this close to ordinary sampling movement was therefore unstable at the registered rehearsal size.

V5 is amended in place because it remains unregistered and unconsumed. Its endpoint now uses three blind seats: `codex.gpt-5.6-sol`, `claude-code.sonnet-5`, and `claude-code.opus`, all at low effort. A bounded pre-amendment route probe confirmed that the CLI bridge served `claude-code.opus` as `claude-opus-4-8` at low effort with structured output and the observed prohibited-tool mark. Each endpoint seat receives fresh context and only the public transcript plus the same registered anchors; no seat sees another output or vote count. `codex.gpt-5.6-luna` remains excluded from reading because it authors the generation-side text. Sonnet and Opus share a model family, so all three pairwise agreements are reported explicitly to expose correlated movement between those seats rather than treating the three votes as independent evidence.

The code-computed modal rung is determinate only when at least two eligible votes share one rung. Fewer than two eligible votes, a two-eligible split, or a 1-1-1 split is indeterminate. The determinacy floors remain 15 cases for Face A and 12 for Face B. The eligibility floors are restated as at least 13 Face-A cases and 10 Face-B cases with two or more eligible endpoint votes. The former 0.8 pair-agreement gate is removed. All three pairwise exact agreements, vote distributions, and 3-0 versus 2-1 margins are report-only. The registered validity backstop is the mean of all three pairwise exact agreements on each face: below 0.5 makes that face `measurement_indeterminate` and stops the calibration. This is a coarse broken-instrument screen, not a reliability certificate.

No anchor, tutor-delivery gate, safety rule, persona-fidelity rule, prohibited-delivery rule, typed-failure disposition, evidence-source restriction, or indeterminate-means-stop rule changed. The unchanged canonical hashes are `fac8e760d2d4bfa10f07488f8d02049bca924482747fd229172b601067b47256` for the Face-A measurement, `66315a011df45ab7c07cadc79147706ab350a3db303c6d933836f2626d60dc7a` for the Face-B measurement, and `02972d555d0e0f94a56cbbbfdb3b0ff0e92bc5aab16d08779685d5f1ce6c0ea7` for the semantic instrument. Sealed revisions 1–4 and all sealed run roots remain byte-untouched.

### Ceiling arithmetic

The former 62 planned calls per dialogue were `12 pre-trigger base + 4 pre-trigger tutor-guard reserve + 24 post-trigger base + 8 post-trigger tutor-guard reserve + 2 primary readers + 2 fidelity readers + 4 reader echo-slip reserves + 3 bridge-step enforcement + 3 tutor-delivery enforcement`. Adding the third primary reader also raises the one-per-reader echo-slip reserve from four to five, so the new plan is `12 + 4 + 24 + 8 + 3 + 2 + 5 + 3 + 3 = 64` planned calls per dialogue and `64 * 36 = 2,304` planned calls per calibration. At three fail-before-call reservations per planned call, this is `64 * 3 = 192` reservations per dialogue; adding six headroom reservations gives 198 per dialogue and `198 * 36 = 7,128` for the calibration. These are ceilings, not targets.

### Directional three-reader rehearsal

The fresh create-once rehearsal root is `/Users/lmagee/Dev/machinespirits/machinespirits-eval-private/artifacts/tutor-stub-analysis/resistant-learner-v5-three-reader-panel-rehearsal-2026-08-26`. It read the same 32 burned revision-4 public transcripts without modifying their root, used two fresh-context repetitions and the three registered low-effort reader routes, generated no tutor or learner dialogue, ran no tie auditor, and launched no calibration or study. The sealed ledger reports 192/192 completed reader calls, zero failed calls, 192 attempts, and a hard ceiling of 384.

Pair order in the table is Sol–Sonnet / Sol–Opus / Sonnet–Opus.

| Face | Repetition | Determinate (floor) | Cases with at least two eligible votes (floor) | Pairwise exact agreement | Mean (backstop) | 3-0 / 2-1 / other indeterminate | Result |
| --- | ---: | ---: | ---: | --- | ---: | --- | --- |
| A | 1 | 18/18 (15) | 18/18 (13) | 0.722 / 0.667 / 0.833 | 0.741 (0.5) | 11 / 7 / 0 | All floors clear |
| A | 2 | 18/18 (15) | 18/18 (13) | 0.778 / 0.833 / 0.833 | 0.815 (0.5) | 13 / 5 / 0 | All floors clear |
| B | 1 | 13/14 (12) | 14/14 (10) | 0.571 / 0.769 / 0.846 | 0.729 (0.5) | 8 / 5 / 1 two-eligible split | All floors clear |
| B | 2 | 14/14 (12) | 14/14 (10) | 0.857 / 0.857 / 1.000 | 0.905 (0.5) | 12 / 2 / 0 | All floors clear |

The Face-B repetition-1 indeterminate row had exactly two eligible discordant votes. Its stored seat validity, vote values, determinacy, eligibility-floor count, and backstop arithmetic are correct, but the sealed replay report's report-only margin bucket used the label `fewer_than_two_eligible`. The follow-up code correction labels this shape `two_eligible_split`; it did not alter, select, rerun, replace, or recode any row and the rehearsal was not repeated.

All registered rehearsal floors cleared on both faces in both repetitions. Under the prospective decision rule this package is ready for operator consideration, but the evidence remains directional: it uses burned revision-4 transcripts observed during instrument development, and no replay row is eligible for V5 scoring or pooling.

### Amended V5 artifacts

- Design: `config/tutor-stub-resistant-learner-merged-design.v5.json`
  SHA-256: `8fe0ed42b9c8a14f2c618e0c32d06c70cc5500dd20ddae05f16382d02a5d3807`
- Semantic registration: `config/tutor-stub-resistant-learner-merged-semantic-registration.v5.json`
  SHA-256: `f5a3843135fbfeb9be3d33296cca507aa26b155fd057f8ffc201e2582337af64`
- Directional rehearsal report (sealed, read-only): `replay-report.json`
  SHA-256: `a2d32948c8a0916fd6e30094ef74b8a401c11bc4de12a082839cfa9c0f2e554d`

not registered, not launched — operator decision pending

## 2026-08-26 addendum: Opus-5 endpoint seat and stopped rehearsal

The operator directed that grading seats must not run on a superseded model version when the current CLI-served version is available. V5 therefore replaces the third endpoint seat in place with the explicit route `claude-code.opus-5` / `claude-opus-5`, effort low. The two-seat fidelity panel, all anchors and floors, the 0.5 mean-pairwise backstop, modal consensus, tutor-delivery gates, safety rules, dispositions, Luna exclusion, and the 2,304 planned / 7,128 maximum calibration ceilings are unchanged.

The prior failed probe's recovered result text was verbatim: `Not logged in · Please run /login`. A fresh bounded route probe then passed on its first attempt through `callAIWithCliBridge` with the real Face-A primary-reader schema. It recorded Claude CLI `2.1.246 (Claude Code)`, model `claude-opus-5`, effort low, structured output true, and an observed prohibited-tool count of zero. The create-once route-probe log is `/Users/lmagee/Dev/machinespirits/machinespirits-eval-private/artifacts/tutor-stub-analysis/resistant-learner-v5-opus5-route-probe-2026-08-26.json`, SHA-256 `76d2b40350d631f203ac88a9a26f5ce52448f791c6e987e258bfe2d8364363c8`.

The earlier Opus-4.8 rehearsal root remains sealed development history. Its votes, records, and numbers are superseded by the operator's seat decision and are never citable as evidence for V5. No Sol, Sonnet, or Opus-4.8 vote was copied into the rehearsal below.

### Fresh Opus-5 rehearsal

The fresh create-once root is `/Users/lmagee/Dev/machinespirits/machinespirits-eval-private/artifacts/tutor-stub-analysis/resistant-learner-v5-three-reader-opus5-panel-rehearsal-2026-08-26`. It reread the same 32 burned revision-4 public transcripts without modifying their root, used two fresh-context repetitions and all three amended low-effort endpoint routes, generated no tutor or learner dialogue, ran no tie auditor, and launched no calibration or study. The source amendment commit was `d62f306662a89f175eeb12fbe076e2edd7ab5f05`.

The rehearsal finalized 192/192 reader records with 256/384 attempts: 128 completed calls and 128 failed calls. Sol and Sonnet completed all 128 of their fresh records. All 64 Opus-5 records exhausted their single outcome-blind transport retry with `response_free_error (result_error_without_structured_output)`, leaving reader C eligible on 0/64 records. The successful one-record route probe therefore did not establish sustained seat availability for the rehearsal workload.

Pair order below is Sol–Sonnet / Sol–Opus-5 / Sonnet–Opus-5. `n/a` means the pair had zero jointly eligible cases; the mean backstop is consequently undefined and failed closed.

| Face | Repetition | Determinate (floor) | Cases with at least two eligible votes (floor) | Pairwise conditional exact agreement | Mean (backstop) | Result |
| --- | ---: | ---: | ---: | --- | ---: | --- |
| A | 1 | 14/18 (15) | 18/18 (13) | 14/18 = 0.778 / n/a / n/a | n/a (0.5) | Missed determinacy and backstop |
| A | 2 | 12/18 (15) | 18/18 (13) | 12/18 = 0.667 / n/a / n/a | n/a (0.5) | Missed determinacy and backstop |
| B | 1 | 10/14 (12) | 14/14 (10) | 10/14 = 0.714 / n/a / n/a | n/a (0.5) | Missed determinacy and backstop |
| B | 2 | 8/14 (12) | 13/14 (10) | 8/13 = 0.615 / n/a / n/a | n/a (0.5) | Missed determinacy and backstop |

The primary leak is operational: the Opus-5 seat produced no eligible rehearsal vote, so two of three registered pairwise terms could not be computed. The surviving Sol–Sonnet records also show that the semantic boundary remains leaky rather than rescued by the unavailable seat. Every Face-A semantic split was rung 1 versus rung 2: four rows in repetition 1 and six in repetition 2. Face B had two rung-1/rung-2 and two rung-0/rung-1 splits in repetition 1; repetition 2 had four rung-1/rung-2 splits, one rung-0/rung-1 split, and one agreeing rung-1 pair with a Sonnet evidence quote invalidated by the exact-substring checker.

The decision rule applies unchanged: if any floor is missed in either repetition, report which boundary leaks and STOP — do not lower a floor, do not relax an anchor, do not launch. No floor or anchor was changed after this result, and no further reader call was made.

### Amended V5 artifacts and sealed rehearsal report

- Design: `config/tutor-stub-resistant-learner-merged-design.v5.json`
  SHA-256: `a60d9501672df7f6ad21a070382f22c103c59af72b6ea9900d978382232b4c1b`
- Semantic registration: `config/tutor-stub-resistant-learner-merged-semantic-registration.v5.json`
  SHA-256: `07f6bedec541ee9b25317eeff0197334a53e22f7ef5f8b0d904f503834b4e10b`
- Fresh Opus-5 rehearsal report (sealed, read-only): `replay-report.json`
  SHA-256: `513f258ec4737a887a544cb7802b6613e7e50364e7392d522b0853ea4c2a0dfd`

not registered, not launched — operator decision pending
