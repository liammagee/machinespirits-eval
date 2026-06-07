# A19 Drama-Axiom Transfer Todo

## Phase 0: Zero-API Scaffold

- [x] Create branch `codex/a19-drama-axiom-framework`.
- [x] Add repo-native Markdown specification artifacts in `notes/adaptive_2_0/`.
- [x] Add `config/teaching-drama-axioms/a19-protocol.yaml`.
- [x] Add `config/teaching-drama-axioms/pilot-families.yaml`.
- [x] Add deterministic protocol validator.
- [x] Add deterministic framework reporter.
- [x] Add `node --test` coverage for validation, alias withholding, leakage checks, anti-conditions, headroom classification, and denominator separation.
- [x] Add package scripts: `a19:validate`, `a19:report`, `test:a19`.

## Phase 1: Protocol Hardening

- [ ] Add more fixture families that cover all verdict classes with no model calls.
- [ ] Add cue-map fields for model tier and domain scope.
- [ ] Add fixture examples where anti-conditions block an otherwise tempting axiom.
- [ ] Add a report mode that emits JSON into `exports/a19/reports/` once the first non-fixture run exists.
- [ ] Add a stable protocol changelog that starts a new version whenever any gate changes.

## Phase 2: Attempt-1 Failure Elicitation

- [ ] Reuse A18 recursive tutor-learning machinery where possible rather than building a parallel runner.
- [ ] Add an A19 family materializer that can turn a teaching-drama family into an attempt-1 elicitation prompt.
- [ ] Require an explicit old-rule decoy and confident misclassification, not an indeterminate tie.
- [ ] Store public transcript, held-out deliberation, failure diagnosis, and prompt hashes separately.
- [ ] Stop before S0/S1 if attempt 1 does not produce a grounded failure record.

## Phase 3: Axiom Induction

- [ ] Add a bounded axiom-induction prompt that outputs trigger, avoided move, replacement move, applicability, anti-conditions, and evidence spans.
- [ ] Reject axioms that are generic advice, lack anti-conditions, or cite hidden state rather than public evidence.
- [ ] Persist admitted axioms as JSONL with schema version and source transcript hashes.
- [ ] Add a deterministic axiom gate before any retrieval or S1 prompt injection.

## Phase 4: S0/S1 Held-Out Contrast

- [ ] Run S0 with no policy memory and S1 with exactly one induced axiom.
- [ ] Keep scenario text, model settings, dialogue length, and prompt payload structure paired.
- [ ] Hide target/decoy aliases and arm provenance from the arbiter.
- [ ] Map free-text adjudication to target/decoy mechanically after judgment.
- [ ] Classify each card with `policy_headroom`, `ceiling`, `policy_failure`, `cue_leak`, `self_solve`, `arbiter_disagreement`, `neither_correct`, or `protocol_reject`.

## Phase 5: Evaluation And Human Validation

- [ ] Add blind adjudication modeled on `scripts/blind-option-adjudication.js`.
- [ ] Add stability reruns for candidate structural headroom cases.
- [ ] Add human expert double-coding for a small set of adjudications and drama labels.
- [ ] Report inter-rater agreement on the same artifacts, not similar artifacts.
- [ ] Keep paid panels gated on local survival and protocol pass.

## Phase 6: Sidecar Paper And Atlas Integration

- [ ] Keep A19 empirical claims out of sidecar prose until they appear in `paper-full-2.0.md`.
- [ ] Use the planned atlas module as scaffold only while `sections: []`.
- [ ] After canonical prose lands, set the atlas module's `sections` to the relevant section numbers and run `npm run atlas:validate`.
- [ ] Keep the sidecar's claims-not-licensed section visible in every draft.
- [ ] Track literature leanings and distinctions in `a19-literature-positioning-matrix.md`.

## Stop Rules

- Stop before paid generation if protocol validation fails.
- Stop before panel if fewer than two held-out siblings survive local gates.
- Stop and redesign if failures are dominated by cue leakage or S0 self-solve.
- Stop and record a negative if S1 cannot apply the registered policy under alias withholding.
- Do not escalate to retrieval, DPO, process rewards, or weight updates until the axiom corpus has a stable trusted channel.
