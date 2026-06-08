# A19 Drama-Axiom Transfer Todo

## Phase 0: Zero-API Scaffold

- [x] Create branch `codex/a19-drama-axiom-framework`.
- [x] Add repo-native Markdown specification artifacts in `notes/adaptive_2_0/`.
- [x] Add `config/teaching-drama-axioms/a19-protocol.yaml`.
- [x] Add `config/teaching-drama-axioms/pilot-families.yaml`.
- [x] Add deterministic protocol validator.
- [x] Add deterministic framework reporter.
- [x] Add `node --test` coverage for validation, alias withholding, leakage checks, anti-conditions, headroom classification, and denominator separation.
- [x] Add package scripts: `a19:validate`, `a19:materialize`, `a19:attempt1`, `a19:blind-adjudicate`, `a19:report`, `test:a19`.

## Phase 1: Protocol Hardening

- [x] Add more fixture families that cover all verdict classes with no model calls.
- [x] Add cue-map fields for model tier and domain scope.
- [x] Add fixture examples where anti-conditions block an otherwise tempting axiom.
- [x] Add a report mode that emits JSON into `exports/a19/reports/` once the first non-fixture run exists.
- [x] Register protocol-reject reasons and require explicit reject reasons.
- [x] Add a stable protocol changelog that starts a new version whenever any substantive gate changes.

## Phase 2: Attempt-1 Failure Elicitation

- [x] Reuse A18 recursive tutor-learning machinery where possible rather than building a parallel runner.
- [x] Add an A19 family materializer that can turn a teaching-drama family into an attempt-1 elicitation prompt.
- [x] Require an explicit old-rule decoy and confident misclassification, not an indeterminate tie.
- [x] Store deterministic public transcript stubs, axiom templates, validation reports, and next-step commands separately.
- [x] Add an A19 attempt-1 gate report that separates fixture survivors from empirical survivors.
- [x] Run one real attempt-1 screen for `counter_warrant_scope` and record the survivor gate report.
- [x] Store real public transcript, held-out deliberation, failure diagnosis, and prompt hashes separately after generation begins.
- [x] Stop before S0/S1 if attempt 1 does not produce a grounded failure record.

## Phase 3: Axiom Induction

- [x] Add a bounded axiom-induction prompt that outputs trigger, avoided move, replacement move, applicability, anti-conditions, and evidence spans.
- [x] Reject axioms that are generic advice, lack anti-conditions, cite hidden state rather than public evidence, or try to use a full `revision.json` bundle as S1 memory.
- [x] Persist admitted axioms with schema version and source transcript hashes; append to JSONL when requested.
- [x] Add a deterministic axiom gate before any retrieval or S1 prompt injection.
- [x] Change the evidence unit once admitted-axiom near-neighbors were exhausted: run a real attempt-1 survivor for `frustration_rupture_repair` and admit exactly one bounded `repair_misalignment` axiom.
- [ ] Add a model-backed axiom inducer only after the deterministic gate remains stable across at least two real attempt-1 survivors.

## Phase 4: S0/S1 Held-Out Contrast

- [x] Run S0 with no policy memory and S1 with exactly one admitted induced axiom; no full replay `revision.json` bundle counts as A19 axiom transfer.
- [ ] Keep scenario text, model settings, dialogue length, and prompt payload structure paired.
- [x] Hide target/decoy aliases and arm provenance from the fixture arbiter scaffold.
- [x] Map fixture adjudication to target/decoy mechanically after judgment.
- [x] Classify each fixture card with `policy_headroom`, `ceiling`, `policy_failure`, `cue_leak`, `self_solve`, `arbiter_disagreement`, `neither_correct`, or `protocol_reject`.
- [x] Run one real paired S0/S1 held-out screen after attempt-1 survival (`counter_warrant_scope_a`).
- [x] Re-run `counter_warrant_scope_a` through free-text blind adjudication and an S1 replay that receives exactly one admitted axiom; result: `ceiling`.
- [x] Choose the next real held-out card by S0-first observable headroom screening; run S1 only if S0 does not already hit the target repair. First screen: `surface_agreement_uptake_a`, result: `neither_correct`.
- [x] Add and screen two concrete-domain candidate families. `fraction_common_unit_counterexample_a` stopped after S0 self-solved the target; `temperature_unit_conversion_aggregation_a` calibrated to `ceiling` after S0 and S1 both reached the target.
- [x] Record the negative concrete-domain screens in durable notes without updating Paper 2.0 or the atlas.
- [x] Add harder held-out siblings with sibling-specific learner resistance. `fraction_common_unit_counterexample_c` and `temperature_unit_conversion_aggregation_c` still self-solved at S0; `surface_agreement_uptake_c` produced one local `policy_headroom` card.
- [x] Add two more surface-agreement siblings. `surface_agreement_uptake_d` self-solved at S0; `surface_agreement_uptake_e` produced the second clean local `policy_headroom` card.
- [x] Update Paper 2.0 and atlas only after the local threshold reached two clean A19 `policy_headroom` cards, and keep the update scope-bound.
- [x] Repeat the same discipline with stability reruns before any stronger sidecar claim. The first two-seed stability smoke failed to reproduce either n=1 candidate: `surface_agreement_uptake_c` was `0/2` because S1 stayed `neither`; `surface_agreement_uptake_e` was `0/2` because S0 self-solved.
- [x] Screen `surface_agreement_uptake_f` as a new logarithm candidate. After transfer-control adjudication calibration, S0 already used a fresh numeric recombination check, so the card was `ceiling`; stopped before stability and multi-critic escalation.
- [x] Screen `surface_agreement_uptake_g` as a proof-by-examples candidate. S0 stress-tested the example-check rule with `n^2 + n + 41` at `n = 41` and then required an arbitrary-`n` gate, so the card was `ceiling`; stopped before S1, stability, and multi-critic escalation.
- [x] Screen `surface_agreement_uptake_h` as a non-algebraic statistics candidate. S0 required the learner to apply a selection-plan check to the survey sentence, so the card was `ceiling`; stopped before S1, stability, and multi-critic escalation.
- [x] Screen `counter_warrant_scope_c` as a different admitted-axiom repair family. S0 constructed and applied a refusal-availability test for consent under pressure, so the card was `ceiling`; stopped before S1, stability, and multi-critic escalation.
- [x] Change the evidence unit before spending further: induce a new axiom from a new attempt-1 survivor. `frustration_rupture_repair` admitted an axiom, but its held-out S0/S1 contrast was `neither_correct` under the registered `repair_misalignment` target.
- [x] Stop opportunistic A19 looping until the protocol changes. v0.2 is now the preregistered protocol change: sharper `repair_misalignment` taxonomy, explicit S0 baseline strata, and one genuinely new repair family before any further claim escalation.
- [x] Register `repair_misalignment` subtypes (`target_uncertainty_repair`, `feedback_dependency_repair`, `relational_rupture_repair`) and require repair-misalignment families plus siblings to name the subtype.
- [x] Register S0 baseline strata and require every family to declare its S0 design. `recursive_full_no_policy_memory` remains required for stability, paid-panel, and sidecar empirical claims; weak S0 is protocol-screen-only.
- [x] Add `productive_impasse_answer_leakage` as a new diagnostic-options repair family under `weak_single_pass_no_policy_memory`.
- [x] Run a real attempt-1 screen for `productive_impasse_answer_leakage`; after two local retries, admit one bounded `offer_diagnostic_options` axiom.
- [x] Run the weak-S0 held-out screen for `productive_impasse_answer_leakage_a`; S0 left nominal target headroom but extracted as `transfer_control`, not the registered diagnostic-options target.
- [x] Run the paired weak S0/S1 contrast for `productive_impasse_answer_leakage_a`; result: `neither_correct` because both arms extracted as `transfer_control`.
- [ ] If a future `productive_impasse_answer_leakage` screen produces actual `policy_headroom` under `offer_diagnostic_options`, rerun it against `recursive_full_no_policy_memory` before stability, paid adjudication, Paper 2.0, atlas, or sidecar use.
- [x] Freeze v0.3 repair-type obligations for `offer_diagnostic_options` versus `transfer_control`; keep diagnostic-options distinct for now, but require explicit public obligations and report target-granularity risk when diagnostic menu language collapses into transfer-control extraction.
- [x] Run the fresh v0.3 diagnostic-options sibling `productive_impasse_answer_leakage_b`; S0 was already `target` while extracted as `transfer_control`, with `target_granularity_risk=true`, so the branch stopped before S1.
- [x] Add one genuinely new recursive-full family, `over_compliance_scaffold_dependency`, and admit one bounded `preserve_struggle` axiom from a real attempt-1 survivor.
- [x] Screen both over-compliance held-out siblings under recursive-full S0/S1; both resolved as `neither_correct` because S0 and S1 extracted as `transfer_control`, not `preserve_struggle`.
- [x] Freeze v0.4 repair-type obligations for `preserve_struggle`; future preserve-struggle screens must distinguish scaffold removal and learner-owned decision from ordinary transfer-control application gates.

## Phase 5: Evaluation And Human Validation

- [x] Add a fixture-only blind adjudication scaffold modeled on `scripts/blind-option-adjudication.js`.
- [x] Add a real free-text teaching-drama blind adjudicator; the deterministic alias reader remains only for fixture plumbing.
- [ ] Add paid blind adjudication modeled on `scripts/blind-option-adjudication.js` after the zero-API protocol freezes and a candidate survives stability.
- [x] Add stability reruns for candidate structural headroom cases.
- [x] Add a reusable A19 stability harness: `scripts/run-a19-stability-screen.js`.
- [x] Calibrate free-text transfer-control adjudication so fresh/concrete public application gates are distinguished from mere warrant naming, including transcript-backed checks for tutor prompt plus learner application.
- [ ] Add human expert double-coding for a small set of adjudications and drama labels.
- [ ] Report inter-rater agreement on the same artifacts, not similar artifacts.
- [x] Keep paid panels gated on local survival and protocol pass; the failed stability smoke stops escalation for the current two candidates.

## Phase 6: Sidecar Paper And Atlas Integration

- [x] Keep A19 empirical claims out of sidecar prose until they appear in `paper-full-2.0.md`.
- [x] Use the planned atlas module as scaffold only while `sections: []`.
- [x] Validate the current planned/scope-bound atlas state without projecting the negative A19 screens into canonical paper sections.
- [x] After canonical prose lands, set the atlas module's `sections` to the relevant section numbers and run `npm run atlas:validate`.
- [ ] Keep the sidecar's claims-not-licensed section visible in every draft.
- [x] Track literature leanings and distinctions in `a19-literature-positioning-matrix.md`.

## Stop Rules

- Stop before paid generation if protocol validation fails.
- Stop before panel if fewer than two held-out siblings survive local gates.
- Stop and redesign if failures are dominated by cue leakage or S0 self-solve.
- Do not update Paper 2.0 or atlas empirical sections unless at least two clean `policy_headroom` cards survive local gates.
- Stop and record a negative if S1 cannot apply the registered policy under alias withholding.
- Do not escalate to retrieval, DPO, process rewards, or weight updates until the axiom corpus has a stable trusted channel.
