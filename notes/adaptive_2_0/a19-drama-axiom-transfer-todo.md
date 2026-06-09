# A19 Drama-Axiom Transfer Todo

Current pause note:
`notes/adaptive_2_0/a19-substantive-closeout-2026-06-08.md`.

Automated branch note:
`notes/adaptive_2_0/a19-automated-branch-todo-2026-06-09.md`.

Substantive status: A19 is paused below claim threshold. Human coding is now
explicitly deferred because coder-selection, assignment-key hygiene, and the
current adjudication interface add fragility before the automated evidence unit
is stable. Resume through the purely automated branch: deterministic screens,
blinded packet generation, automated/model adjudication, and only then the
normal recursive-full S0/S1 stability gates for any promoted candidate.

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
- [x] Freeze v0.5 repair-type obligations for `instructional_contract_repair`; require tutor accountability for contract drift, a pause in object-level content gating, and learner choice of repair path before any content work resumes.
- [x] Add the recursive-full `instructional_contract_drift` family and admit one bounded `renegotiate_working_agreement_before_content` axiom from a real attempt-1 survivor.
- [x] Screen four instructional-contract held-out siblings. `instructional_contract_drift_a` self-solved at S0; `instructional_contract_drift_b` produced a clean local `policy_headroom` card; `instructional_contract_drift_c` and `instructional_contract_drift_d` produced local `policy_headroom` cards but failed stability as mixed/unstable.
- [x] Run stability on all instructional-contract candidates that reached local `policy_headroom`. Only `instructional_contract_drift_b` was stable at 2/2; `c` and `d` were 1/2 mixed. This leaves v0.5 below the two-card stability threshold for paid-panel, Paper 2.0, atlas, or sidecar escalation.

## Phase 5: Evaluation And Human Validation

- [x] Add a fixture-only blind adjudication scaffold modeled on `scripts/blind-option-adjudication.js`.
- [x] Add a real free-text teaching-drama blind adjudicator; the deterministic alias reader remains only for fixture plumbing.
- [x] Add offline adjudication packet infrastructure for later multi-critic or human double-coding: blinded coder packet, private answer key, response schema, and visible-alias audit.
- [ ] Add paid blind adjudication modeled on `scripts/blind-option-adjudication.js` after the zero-API protocol freezes and a candidate survives stability.
- [x] Add stability reruns for candidate structural headroom cases.
- [x] Add a reusable A19 stability harness: `scripts/run-a19-stability-screen.js`.
- [x] Calibrate free-text transfer-control adjudication so fresh/concrete public application gates are distinguished from mere warrant naming, including transcript-backed checks for tutor prompt plus learner application.
- [x] Add free-text audit support for `instructional_contract_repair`, including explicit target-obligation checks and target-granularity risk when working-agreement language collapses into content-rule application.
- [ ] DEFERRED: Add human expert double-coding for a small set of adjudications and drama labels only after the automated branch has a stable candidate and the adjudication interface is simpler to navigate.
- [ ] DEFERRED: Report inter-rater agreement on the same artifacts, not similar artifacts; do not use this as the next A19 blocker.
- [x] Keep paid panels gated on local survival and protocol pass; the failed stability smoke stops escalation for the current two candidates.

## Phase 6: Sidecar Paper And Atlas Integration

- [x] Keep A19 empirical claims out of sidecar prose until they appear in `paper-full-2.0.md`.
- [x] Use the planned atlas module as scaffold only while `sections: []`.
- [x] Validate the current planned/scope-bound atlas state without projecting the negative A19 screens into canonical paper sections.
- [x] After canonical prose lands, set the atlas module's `sections` to the relevant section numbers and run `npm run atlas:validate`.
- [ ] Keep the sidecar's claims-not-licensed section visible in every draft.
- [x] Track literature leanings and distinctions in `a19-literature-positioning-matrix.md`.

## Phase 7: Generalization And Systemization Loop

- [x] Split the post-v0.5 path into three explicit tracks: non-collapsing repair-family design, adjudication infrastructure, and alternate S0/tutor-learner condition design.
- [x] Revisit `teaching_drama_learning_plan.html` and preserve its core guidance: public drama state, learner resistance as evidence, critic specialization, model-stratified policies, and human validation as later calibration rather than current evidence.
- [x] Add `config/teaching-drama-axioms/a19-generalization-loops.yaml` as the offline loop registry with track-level success conditions, failure conditions, stop rules, and next actions.
- [x] Add `scripts/run-a19-generalization-loop.js` to report the next lawful action for each track without generation, judging, retrieval, training, Paper 2.0 edits, or atlas projection.
- [x] Add `notes/adaptive_2_0/a19-generalization-systemization-plan.md` with separate plans for candidate non-transfer repairs, adjudication packet infrastructure, and weaker/model-stratified S0 conditions.
- [x] Pre-register v0.6 after selecting exactly one non-collapsing repair candidate from the loop registry: `addressed_claim_withdrawal` / `claim_address_repair`.
- [x] Materialize and attempt-1 screen the v0.6 `addressed_claim_withdrawal` family; result: real attempt-1 `revise_again` with `recursive_dyadic_update = 0.65 < 0.7`, so S0/S1 escalation stopped.
- [x] Pre-register v0.7 `public_commitment_contradiction` / `commitment_ledger_repair`, induce one admitted axiom from a real attempt-1 survivor, and run recursive-full held-out S0/S1 screens.
- [x] Record the v0.7 result in `a19-v07-public-commitment-screen-2026-06-08.md`: one local policy-headroom card with target-granularity risk plus two recursive-full S0 ceilings; no A19 transfer claim.
- [x] Build an adjudication packet for the ambiguous v0.7 A card; visible alias hits: 0.
- [x] Add a coder-merge/report command for future independent coder JSON files against the same packet hash. Current no-coder reports remain infrastructure-only and do not count as agreement evidence.
- [x] Decide whether `learner_standing_repair` can be operationalized as public obligations without a human panel. It can be preregistered only as public boundary-control/accountability repair, not as moral or therapeutic judgment.
- [x] Pre-register v0.8 `moral_disclosure_standing_repair`, run real attempt-1, admit one bounded axiom, and screen held-out siblings under recursive-full S0-first discipline.
- [x] Record the v0.8 result in `a19-v08-learner-standing-screen-2026-06-08.md`: one local policy-headroom card with target-granularity risk, one noisy S0 ceiling, and one clean S0 ceiling; no A19 transfer claim.
- [x] Build an adjudication packet and no-coder merge report for the ambiguous v0.8 A card; visible public-transcript alias hits: 1.
- [x] Resolve weak/debug/model-stratified S0 as protocol-screen diagnostics only. Promote future weak/debug results to recursive-full only when they are non-artifact, non-ceiling candidates and all prompt/scenario payloads can be paired.
- [x] Re-route the next operational unit away from human coding and onto the automated branch. Added `a19-automated-branch-todo-2026-06-09.md`, copied the deterministic mini-drama/rhetorical screening modules from the main repo, and added `a19r:*` package scripts plus `test:a19r`.
- [x] Achieve a bounded automated S1 > S0 proxy result on the packetized A19R branch. `npm run a19r:adjudicate -- --packet-dir exports/a19r/adjudication-packets/automated-branch-2026-06-09 --out-dir exports/a19r/automated-adjudication/automated-branch-2026-06-09 --summary-out exports/a19r/reports/automated-adjudication-2026-06-09.json --json` reported `systemic_s1_mini_drama_greater_than_s0_shadow`: 5/5 packets supported S1 for the registered move, 0 S0-preferred, 0 unclear, mean deterministic score delta 0.42. This remains automated A19R proxy evidence only; the next gate is preregistered recursive-full S0/S1 confirmation on selected candidates.
- [x] Implement option 1 from the Step 4/5 map. Added A19 v0.9 `strategy_reversal_repair`, preregistered the recursive-full `strategy_reversal_error_spotting` family from the repeated A18-native `peripeteia_error_spotting` signal, updated fixture denominators, and materialized the zero-API scaffold at `exports/a19/materialized-attempts-v09`.
- [x] Run option 1 real attempt-1. `strategy_reversal_error_spotting` blocked before S0/S1 with `recursive_dyadic_update = 0.62 < 0.7`; no axiom admitted; report: `a19-attempt1-real-gate-report-strategy-reversal.md`.
- [x] Because option 1 blocked, implement and run option 2 (`over_compliance_ethopoeia_copy_dependency` / `preserve_struggle` via ethopoeia). It also blocked before S0/S1: `device_specificity = 0.45`, recursive tutor-learning scores 0.5-0.6, checker `revise_again`; no axiom admitted; report: `a19-attempt1-real-gate-report-over-compliance-ethopoeia.md`.
- [x] Exhaust the purely automated controlled-positive search without human coding. `over_compliance_copy_import_audit` survived attempt-1 and admitted one bounded axiom, but failed stability (`a`: 0/2 policy headroom; `b`: 1/2 mixed/unstable). Four productive-impasse recursive variants and three public-commitment recursive variants then blocked before axiom induction or S0/S1 escalation. Closeout: `a19-controlled-positive-search-2026-06-09.md`.
- [x] Stop before recursive-full S0/S1 for all blocked v11-v17 variants, and stop before claim escalation for v10 because stability did not reproduce two clean policy-headroom cards. Any further path needs a new protocol-level evidence-unit decision rather than another near-neighbor card.
- [x] Continue the automated branch without weakening S0 or resuming human adjudication. Added public-warrant evidence-role variants (`claim_evidence_role_mismatch`, bounded continuation, and `claim_evidence_role_mismatch_staged`) plus the taxonomy-aligned `public_commitment_evidence_role_boundary`; staged evidence-role and commitment-boundary both survived attempt-1 and admitted bounded axioms, but v20 stability remained 0/2 and 1/2 mixed/unstable, while v21 stopped when recursive-full S0 hit the target on the first stability seed.
- [x] Harden implementation without changing thresholds: free-text adjudication now ignores explicitly retracted/withdrawn/demoted decoy phrases, and S1 policy memory now renders admitted A19 axiom JSON as compact typed policy cards. The v22 compact-memory diagnostic still produced 0/1 headroom on both staged siblings because S1 stayed `neither` / `transfer_control`.
- [x] Record the expanded v18-v22 exhaustion in `a19-controlled-positive-search-2026-06-09.md` and keep the non-claim boundary intact: no systemic S0/S1 difference, no paid-panel or human-coding result, no Paper 2.0, atlas, sidecar, human-learning, deployed-tutor, main-harness, or model-weight-learning claim.
- [x] Fix the coordinated-transcript confound by adding the role-separated A19 harness. `scripts/run-a19-role-separated-eval.js` gives S1 policy memory only to the tutor, gives the learner only public transcript plus tutor move, optionally lets the tutor do one stock-take after learner response, and then blind-adjudicates the assembled arms.
- [x] Run role-separated checks on both admitted v0.10 survivors. `claim_evidence_role_mismatch_staged` produced no headroom (`a`: neither/neither, `b`: ceiling). `public_commitment_evidence_role_boundary_b` produced one role-separated headroom seed but failed the added second seed as mixed/unstable (1/2). No systemic S0/S1 difference or claim-bearing result.

## Stop Rules

- Stop before paid generation if protocol validation fails.
- Stop before panel if fewer than two held-out siblings survive local gates.
- Stop and redesign if failures are dominated by cue leakage or S0 self-solve.
- Do not update Paper 2.0 or atlas empirical sections unless at least two clean `policy_headroom` cards survive local gates.
- Stop and record a negative if S1 cannot apply the registered policy under alias withholding.
- Do not escalate to retrieval, DPO, process rewards, or weight updates until the axiom corpus has a stable trusted channel.
