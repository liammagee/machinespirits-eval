# A19 Teaching-Drama Axiom Protocol Changelog

## a19-drama-axiom-transfer-v0.11

- Identified the counterfactual transcript-reviser confound in the previous A19
  S0/S1 replay path: one generator emitted the tutor move, learner uptake, and
  optional tutor stock-take in a single revised transcript. That made earlier
  S0/S1 screens useful as script-construction evidence, not clean independent
  learner-uptake evidence.
- Added `scripts/run-a19-role-separated-eval.js` and package script
  `a19:role-separated`. The new harness keeps roles separate: the tutor emits
  one next TUTOR move, S1 policy memory is visible only to the tutor and optional
  tutor stock-take, the learner sees only public transcript plus tutor move, and
  blind adjudication runs on the assembled immutable public arms.
- Added `tests/a19RoleSeparatedEval.test.js` and package script
  `test:a19:role-separated` to verify policy-memory isolation from learner
  prompts and mock end-to-end role-separated adjudication.
- Ran role-separated evaluation on `claim_evidence_role_mismatch_staged` with
  Codex tutor, Claude learner, Codex stock-take, and free-text blind
  adjudication. Result: no role-separated headroom. Sibling `a` was
  `neither_correct`; sibling `b` was `ceiling`.
- Ran role-separated evaluation on `public_commitment_evidence_role_boundary`.
  Sibling `a` was negative (`S0=target`, `S1=neither`). Sibling `b` produced one
  role-separated policy-headroom seed, then failed the added second seed as
  `policy_failure`; k=2 result was 1/2 mixed/unstable.
- Result: still no systemic S0/S1 difference under recursive-full S0, no
  paid-panel or human-coding result, and no Paper 2.0, atlas, sidecar,
  human-learning, deployed-tutor, main-harness, or model-weight-learning claim.

## a19-drama-axiom-transfer-v0.10

- Human coding remains deferred and S0 remains `recursive_full_no_policy_memory`
  for any claim-bearing path. This version explores only automated branches.
- Added two public-warrant / evidence-role families under recursive-full S0:
  `claim_evidence_role_mismatch` and
  `claim_evidence_role_mismatch_staged`. The first blocked at real attempt-1;
  the bounded-continuation replay also blocked. The staged variant survived
  attempt-1 and admitted one bounded `name_warrant` axiom, but stability did
  not reproduce systemic S0/S1 headroom: `a` was 0/2 and `b` was 1/2
  mixed/unstable.
- Added `public_commitment_evidence_role_boundary` under the existing
  `commitment_ledger_repair` type after the staged family showed repair-type
  drift toward commitment accounting. It survived attempt-1 and admitted one
  bounded axiom, but the first stability seed showed recursive-full S0 already
  reaching the target; the branch stopped before further spending.
- Hardened the free-text mapper so explicitly retracted/withdrawn/demoted old
  rules do not count as live decoy alias hits. This is an adjudication
  implementation fix, not a threshold change.
- Hardened S1 policy-memory rendering by converting admitted A19 axiom JSON into
  a compact typed policy card while preserving plain-text memories as-is. A k=1
  compact-memory check on `claim_evidence_role_mismatch_staged` still produced
  0/1 headroom on both siblings because S1 remained `neither` /
  `transfer_control`.
- Result: still no systemic S0/S1 difference under the current A19 protocol, no
  paid-panel or human-coding result, and no Paper 2.0, atlas, sidecar,
  human-learning, deployed-tutor, main-harness, or model-weight-learning claim.

## a19-drama-axiom-transfer-v0.9

- Added `strategy_reversal_repair` after the A19R automated branch found two
  independent `peripeteia_error_spotting` positives on A18-native visual
  strategy cards.
- Required public obligations: reverse from solving to error spotting, name the
  wrong strategy family or wrong turn, and require local error identification
  before solution continuation.
- Added the recursive-full `strategy_reversal_error_spotting` family with three
  held-out siblings. This is preregistration/fixture evidence only; A18-native
  packet wins are design input, not A19 transfer evidence.
- Real attempt-1 outcome: `strategy_reversal_error_spotting` blocked before
  S0/S1 (`recursive_dyadic_update = 0.62 < 0.7`). No strategy-reversal axiom was
  admitted.
- Added the existing-schema fallback
  `over_compliance_ethopoeia_copy_dependency` under the already registered
  `preserve_struggle` repair type after strategy reversal blocked. This
  preregisters the option-2 ethopoeia/copy-dependency variant without a protocol
  repair-type extension.
- Real attempt-1 outcome: `over_compliance_ethopoeia_copy_dependency` also
  blocked before S0/S1 (`device_specificity = 0.45`, recursive tutor-learning
  scores 0.5-0.6, checker `revise_again`). No preserve-struggle axiom was
  admitted.
- Added the recursive-full `over_compliance_copy_import_audit` preserve-struggle
  variant. It survived real automated attempt-1 and admitted one bounded axiom,
  but stability failed to reproduce a stable systemic S0/S1 difference:
  `over_compliance_copy_import_audit_a` was 0/2 policy-headroom seeds and
  `over_compliance_copy_import_audit_b` was 1/2 mixed/unstable.
- Added four recursive-full productive-impasse variants:
  `productive_impasse_diagnostic_options_recursive`,
  `productive_impasse_recut_counts_recursive`,
  `productive_impasse_enacted_shortcut_recursive`, and
  `productive_impasse_next_policy_commitment_recursive`. All blocked before
  axiom induction and S0/S1 escalation on non-leakage, old-warrant
  misclassification, or recursive dyadic-update gates.
- Added three recursive-full public-commitment variants:
  `public_commitment_self_ledger_no_transfer`,
  `public_commitment_consent_misclassification_ledger`, and
  `public_commitment_speech_act_triage_recursive`. All blocked before axiom
  induction and S0/S1 escalation. The consent/triage variants showed the
  structural limit of this branch: explicit enough commitment boundaries invite
  plain withdrawal or S0 self-repair; weaker boundaries collapse into
  constraint/relevance repair rather than clean commitment-ledger learning.
- Durable closeout:
  `notes/adaptive_2_0/a19-controlled-positive-search-2026-06-09.md`.
- Human coding remains deferred. These automated loops do not license
  recursive-full S0/S1 escalation beyond the completed v10 stability screen, nor
  stability, paid-panel, Paper 2.0, atlas, sidecar, or human-learning claims.

## a19-drama-axiom-transfer-v0.8

- Added `learner_standing_repair` after feasibility review: it is admissible
  only as public boundary-control and accountability repair, not as a moral or
  therapeutic quality judgment.
- Required public obligations: name the misrecognition or moral flattening,
  restore the learner as author of the disclosure boundary, separate the
  accountability question from reassurance or advice, and offer a non-content
  continuation or stop option.
- Added the recursive-full `moral_disclosure_standing_repair` family. It is
  scoped to writing-feedback disclosures and remains below Paper 2.0, atlas,
  sidecar, or panel-claim bars until real attempt-1 and held-out S0/S1 evidence
  exists.
- Local replay outcome: the real attempt-1 survived and admitted one bounded
  axiom. Held-out screens produced one local policy-headroom card with
  target-granularity risk, one S0 ceiling with target-granularity risk, and one
  clean S0 ceiling. This version does not license paid-panel, Paper 2.0, atlas,
  or sidecar escalation.

## a19-drama-axiom-transfer-v0.7

- Recorded the real v0.6 `addressed_claim_withdrawal` attempt-1 gate as
  blocked before S0/S1 escalation: the replay returned `revise_again` with
  `recursive_dyadic_update = 0.65 < 0.7`.
- Added `commitment_ledger_repair` as the next non-collapsing repair type. Its
  obligations require the tutor to cite two conflicting public tutor
  commitments, retract or rank one, and state the new commitment boundary.
- Added the recursive-full `public_commitment_contradiction` family as the next
  repair-family loop candidate. This remains fixture/pre-registration evidence
  until a real attempt-1 survivor and held-out S0/S1 screens exist.

## a19-drama-axiom-transfer-v0.6

- Added `claim_address_repair` as the first v0.6 non-collapsing repair
  candidate. The distinctive public act is tutor-side withdrawal and
  re-addressing of the learner's actual claim, not learner application of a
  corrected rule or check.
- Required public obligations: identify the claim or warrant the tutor
  misaddressed, withdraw the prior tutor framing, and restate the learner's
  claim as the next addressed object.
- Added the recursive-full `addressed_claim_withdrawal` family as the selected
  Track 1 candidate from the A19 generalization loop registry. This preregisters
  the candidate only; it does not license a new empirical claim.

## a19-drama-axiom-transfer-v0.5

- Added `instructional_contract_repair` as a non-transfer repair type for cases
  where the tutor must repair the working agreement before resuming content
  correction.
- Required public obligations: acknowledge tutor contribution to contract drift,
  pause the object-level content gate, and offer the learner a choice of repair
  path.
- Added the recursive-full `instructional_contract_drift` family to test
  whether this public repair can avoid collapsing into `transfer_control` or
  generic rupture repair under blind extraction.
- Local replay outcome: one held-out sibling (`instructional_contract_drift_b`)
  survived a two-seed stability screen, while later siblings were mixed/unstable
  through S0 self-solve or S1 collapse back to `transfer_control`. This version
  does not license paid-panel, Paper 2.0, atlas, or sidecar escalation.

## a19-drama-axiom-transfer-v0.4

- Added `preserve_struggle` to the repair-type obligation taxonomy after the
  recursive-full over-compliance screen collapsed both S0 and S1 into
  `transfer_control`.
- Required preserve-struggle target policies to declare public obligations:
  withhold copyable completion, remove or limit one scaffold, and require a
  bounded learner-owned decision.
- Kept the v0.3 over-compliance result as a negative target-granularity result;
  this version does not reclassify it as A19 transfer.

## a19-drama-axiom-transfer-v0.3

- Added a repair-type obligation taxonomy for the ambiguous
  `offer_diagnostic_options` / `transfer_control` pair.
- Required affected target policies to declare public obligations so diagnostic
  lane choice is prospectively distinguishable from action-gating transfer
  checks before further real screens.
- Kept the prior productive-impasse result as a target-granularity failure; this
  version does not reclassify it as A19 transfer.

## a19-drama-axiom-transfer-v0.2

- Pre-registered a sharper `repair_misalignment` subtype taxonomy:
  `target_uncertainty_repair`, `feedback_dependency_repair`, and
  `relational_rupture_repair`.
- Added required family-level S0 baseline stratification. Stronger local,
  stability, paid-panel, and sidecar claims still require
  `recursive_full_no_policy_memory`; weaker baselines are protocol-screen-only.
- Added a genuinely new fixture repair family, `productive_impasse_answer_leakage`,
  to test answer leakage versus diagnostic-option preservation without starting
  another sidecar claim.

## a19-drama-axiom-transfer-v0.1

- Initial zero-API scaffold with fixture families, verdict vocabulary, denominator discipline, and atlas claim boundary.
- Added attempt-1 gate reporting, axiom induction/gating, and free-text blind repair extraction while preserving fixture-only deterministic paths.
- Added cue-map scope requirements for model tier and domain scope so held-out screens can track where self-solve/headroom judgments apply.
- Added JSON report command for `exports/a19/reports/framework.json`.

Any substantive gate change after this entry should create a new protocol version before additional real S0/S1 generation.
