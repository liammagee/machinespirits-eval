# A19 Branch Merge And Paper 2.0 Handoff

Date: 2026-06-09.

Purpose: durable handoff note for merging the current A19 automated branch and
then updating `docs/research/paper-full-2.0.md`. This note is not itself a
canonical paper update. It records the result boundary and the evidence paths
that should be used when the paper is edited after merge.

## Result To Carry Forward

The current branch closes the automated A19 controlled-positive search below the
claim threshold. It does not establish a systemic S0/S1 difference.

The important result is a disciplined negative with one implementation correction:

- Human coding stayed deferred.
- S0 was not weakened for any claim-bearing path.
- The automated branch found several local or proxy positives, but none survived
  the required recursive-full or role-separated stability checks.
- The role-separated harness corrected a real confound in the prior replay path:
  the earlier counterfactual transcript-reviser generated tutor and learner text
  together. The new harness gives S1 policy memory only to the tutor, gives the
  learner only public transcript plus tutor move, and then adjudicates the
  assembled public arms.
- Under that cleaner role-separated test, the strongest remaining candidates
  still did not produce a stable systemic S0/S1 difference.

Paper 2.0 should therefore describe this branch as a follow-on stress test and
negative boundary result, not as an A19 success.

## Evidence Summary

Automated A19R proxy screen:

- `exports/a19r/reports/automated-adjudication-2026-06-09.json`
- Result: `systemic_s1_mini_drama_greater_than_s0_shadow`.
- Count: 5/5 packets supported S1, 0 S0-preferred, 0 unclear.
- Mean deterministic score delta: 0.42.
- Boundary: proxy evidence only; it motivated candidate selection but did not
  license A19 transfer claims.

Recursive-full candidate search:

- `strategy_reversal_error_spotting` blocked at real attempt-1:
  `recursive_dyadic_update = 0.62 < 0.7`.
- `over_compliance_ethopoeia_copy_dependency` blocked at real attempt-1:
  `device_specificity = 0.45`, recursive tutor-learning scores 0.5-0.6.
- `over_compliance_copy_import_audit` survived attempt-1 and admitted one bounded
  `preserve_struggle` axiom, but failed stability:
  - sibling `a`: 0/2 policy-headroom seeds;
  - sibling `b`: 1/2 mixed/unstable.
- Four productive-impasse recursive variants and three public-commitment
  recursive variants blocked before axiom induction or S0/S1 escalation.
- `claim_evidence_role_mismatch_staged` survived attempt-1 and admitted one
  bounded `name_warrant` axiom, but stability failed:
  - sibling `a`: 0/2 policy-headroom seeds;
  - sibling `b`: 1/2 mixed/unstable.
- `public_commitment_evidence_role_boundary` survived attempt-1 and admitted one
  bounded `commitment_ledger_repair` axiom, but recursive-full S0 already reached
  the target on the first stability seed.
- Compact S1 axiom-memory rendering did not rescue the staged evidence-role
  cards: both role candidates stayed 0/1 headroom in the diagnostic check.

Role-separated correction:

- Harness: `scripts/run-a19-role-separated-eval.js`.
- Test: `tests/a19RoleSeparatedEval.test.js`.
- v23 evidence-role role-separated result:
  `exports/a19/role-separated-v23-claim-evidence-role-mismatch-staged-k1/a19-role-separated-summary.json`.
  - `claim_evidence_role_mismatch_staged_a`: 0/1 headroom, `neither_correct`;
    S0 `neither/name_warrant`, S1 `neither/transfer_control`.
  - `claim_evidence_role_mismatch_staged_b`: 0/1 headroom, `ceiling`;
    S0 `target/name_warrant`, S1 `target/name_warrant`.
- v24 commitment-boundary role-separated result:
  `exports/a19/role-separated-v24-public-commitment-evidence-role-boundary-k1/a19-role-separated-summary.json`.
  - `public_commitment_evidence_role_boundary_b`: 1/2 headroom,
    `mixed_unstable`.
  - Seed 1: `policy_headroom`; S0 `neither/claim_address_repair`, S1
    `target/commitment_ledger_repair`.
  - Seed 2: `policy_failure`; S0 `target/commitment_ledger_repair`, S1
    `neither/commitment_ledger_repair`.

The role-separated result is especially important for the paper update because it
turns the strongest remaining local positive into an unstable single-seed result.

## Claim Boundary For Paper 2.0

Do not claim:

- human learning;
- deployed adaptive tutoring;
- model-weight learning;
- main-harness rate effect;
- pooled A19 rate;
- paid or human blind-panel result;
- atlas or sidecar empirical result;
- systemic A19 transfer success.

Safe paper-level statement:

> A post-closeout automated A19 search explored candidate teaching-drama axiom
> transfer under recursive-full S0 controls and then re-tested the strongest
> candidates with a role-separated tutor/learner harness. The search produced
> proxy and local positives but no stable systemic S0/S1 difference. The
> role-separated correction removed a coordinated-transcript construction
> confound and made the result more conservative: one candidate produced a
> single positive seed, but it failed immediate k=2 stability.

That statement should be attached to a limitation/boundary discussion unless the
paper already has an A19 subsection that can absorb it as a negative follow-up.

## Files To Mention In Merge Or Paper-Update Commit

- Protocol/changelog:
  `config/teaching-drama-axioms/CHANGELOG.md`,
  `config/teaching-drama-axioms/a19-protocol.yaml`,
  `config/teaching-drama-axioms/pilot-families.yaml`.
- Loop and closeout:
  `config/teaching-drama-axioms/a19-generalization-loops.yaml`,
  `notes/adaptive_2_0/a19-controlled-positive-search-2026-06-09.md`,
  `notes/adaptive_2_0/a19-generalization-systemization-plan.md`,
  `notes/adaptive_2_0/a19-drama-axiom-transfer-todo.md`.
- Role-separated implementation:
  `scripts/run-a19-role-separated-eval.js`,
  `tests/a19RoleSeparatedEval.test.js`,
  `package.json`.
- Supporting A19R and candidate-attempt artifacts:
  `scripts/a19r-mini-drama.js`,
  `scripts/adjudicate-a19r-mini-drama.js`,
  `services/miniDramaMachines.js`,
  `tests/miniDramaMachines.test.js`,
  `config/rhetoric/`,
  `notes/adaptive_2_0/a19-attempt1-real-gate-report-*.md`.

## Verification Already Run

- `npm run test:a19:role-separated`
- `npm run a19:validate -- --json`
- `npm run a19:generalize -- --json`
- `npm run test:a19`
- `npm run test:a19r`
- `node --test tests/replayDiscursiveTranscript.test.js`
- `npm run format:check`
- `git diff --check`

The validator result after the v0.11 update was:

- families: 25;
- cards: 77;
- policy-headroom fixture count: 40;
- ceiling fixture count: 27;
- errors: 0;
- warnings: 0.

## Paper Update Guidance

After this branch is merged, update `docs/research/paper-full-2.0.md` with the
negative boundary result before projecting anything to atlas or sidecar prose.
The update should:

1. Identify the role-separated confound and correction.
2. Report that automated recursive-full and role-separated screens found no
   stable systemic S0/S1 difference.
3. Preserve the A19R result as proxy/candidate-selection evidence only.
4. State that human coding remained deferred.
5. Avoid any new claim about human learning, deployed tutoring, model-weight
   learning, or main-harness effects.
