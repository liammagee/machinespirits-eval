# A19 Exhaustion Report

Date: 2026-06-08.
Branch: `codex/a19-drama-axiom-framework`.
Implementation commit: `d7dfca5e` (`Resolve A19 learner-standing loop`).

## Executive Conclusion

A19 has been pushed through the three unresolved next-step tracks:

1. a repair family whose public obligations are harder to collapse into
   transfer-control;
2. adjudication infrastructure for ambiguous repair-type boundaries;
3. weaker or model-stratified S0 conditions as diagnostic screens only.

The resulting v0.8 learner-standing loop is resolved below the A19 claim
threshold. It produced one real attempt-1 survivor and one local held-out
policy-headroom card, but the headroom card carries target-granularity risk and
the other held-out siblings resolve as recursive-full S0 ceilings. This does not
license Paper 2.0, atlas, sidecar, paid-panel, or stability escalation.

After that, the only legitimate research moves are independent coding of the
preserved packets, or a newly preregistered repair family with stricter
anti-collapse criteria.

## Claim Boundary Maintained

A19 remains downstream of Paper 2.0 and A18. No new canonical empirical claim
was introduced. The work remains bounded to simulated teacher-as-learner
screens and does not claim:

- human learning;
- deployed adaptive tutoring;
- model-weight learning;
- a main-harness rate effect;
- a pooled A19 rate;
- a paid blind-panel result;
- a sidecar or atlas empirical result not already landed in canonical paper
  prose.

## Step 1: Protocol v0.8 Was Preregistered

The next repair family was selected as
`moral_disclosure_standing_repair`, with repair type
`learner_standing_repair`.

The protocol change made learner-standing repair admissible only as public
boundary-control and accountability repair. It explicitly does not treat the
screen as a moral, therapeutic, or human-learning judgment.

Required public obligations:

- name the misrecognition or moral flattening;
- restore the learner as author of the disclosure boundary;
- separate the accountability question from reassurance or advice;
- offer a non-content continuation or stop option.

Excluded moves:

- advice or sympathy as the committed repair;
- a fresh reflection prompt as a transfer check;
- moral flattery without boundary control;
- asking for more private disclosure as the repair.

Changed artifacts:

- `config/teaching-drama-axioms/a19-protocol.yaml`
- `config/teaching-drama-axioms/pilot-families.yaml`
- `config/teaching-drama-axioms/CHANGELOG.md`
- `tests/teachingDramaAxiomProtocol.test.js`

## Step 2: Real Attempt-1 Gate Was Run

The v0.8 training seed was materialized and replayed through the A18 recursive
tutor-learning gate.

Attempt-1 artifacts:

- `exports/a19/real-attempt1-v08/moral-disclosure-standing-repair/`
- `notes/adaptive_2_0/2026-06-07-a19-attempt1-real-gate-report-learner-standing.md`

Gate outcome:

- status: `pass`;
- empirical status: `real_attempt1_present`;
- real survivors: 1;
- blocked families: 0.

Gate scores:

| field | score | threshold |
| --- | ---: | ---: |
| old_warrant_misclassification | 0.9 | 0.7 |
| resistance_diagnosis | 0.85 | 0.7 |
| strategy_revision_accountability | 0.85 | 0.7 |
| recursive_dyadic_update | 0.8 | 0.7 |
| non_leakage | 1.0 | 0.9 |

This licensed only the next S0/S1 contrast gate. It did not create a transfer
claim.

## Step 3: One Bounded Axiom Was Admitted

The survivor was used to induce exactly one bounded teaching-drama axiom:

- `exports/a19/axioms/moral-disclosure-standing-repair/axiom.json`

The axiom memory contract remains strict:

- memory unit: `single_teaching_drama_axiom`;
- S1 insertion limit: 1;
- full `revision.json` bundle allowed: false;
- target/decoy aliases visible to S1: false.

The axiom was also appended to the admitted-axiom JSONL memory:

- `exports/a19/axioms/admitted-axioms.jsonl`

## Step 4: Held-Out S0-First Screens Were Run

All held-out S0 screens used `recursive_full_no_policy_memory`. S1 was run only
when S0 left observable headroom or when a single-arm result required paired
resolution.

| sibling | S0 result | S1 / paired result | final status |
| --- | --- | --- | --- |
| `moral_disclosure_standing_repair_a` | `neither`; extracted as `claim_address_repair`; target-granularity risk false | S1 `target`; extracted as `learner_standing_repair`; target-granularity risk true | local `policy_headroom`, not clean |
| `moral_disclosure_standing_repair_b` | `target`; extracted as `claim_address_repair`; target-granularity risk true | not run | S0 ceiling / granularity risk |
| `moral_disclosure_standing_repair_c` | paired adjudication maps S0 to `target` / `learner_standing_repair`; target-granularity risk false | S1 also `target` / `learner_standing_repair`; target-granularity risk false | clean S0 ceiling |

Key adjudication artifacts:

- `exports/a19/real-s0s1-v08/moral-disclosure-standing-repair/moral-disclosure-standing-repair-a/s0-headroom.free-text.json`
- `exports/a19/real-s0s1-v08/moral-disclosure-standing-repair/moral-disclosure-standing-repair-a/blind-adjudication.free-text.json`
- `exports/a19/real-s0s1-v08/moral-disclosure-standing-repair/moral-disclosure-standing-repair-b/s0-headroom.free-text.json`
- `exports/a19/real-s0s1-v08/moral-disclosure-standing-repair/moral-disclosure-standing-repair-c/s0-headroom.free-text.json`
- `exports/a19/real-s0s1-v08/moral-disclosure-standing-repair/moral-disclosure-standing-repair-c/blind-adjudication.free-text.json`

Durable summary:

- `notes/adaptive_2_0/a19-v08-learner-standing-screen-2026-06-08.md`

## Step 5: Adjudication Infrastructure Was Extended

A new merge command was added:

- `scripts/merge-a19-adjudication-codes.js`
- package script: `a19:adjudication-merge`

The merge command:

- accepts one blinded packet and zero or more coder JSON files;
- verifies packet hashes and run IDs;
- rejects coder files from a different packet;
- preserves raw coder judgments;
- applies the private answer key only after raw-code preservation;
- reports `no_coder_files`, `single_coder_diagnostic_only`,
  `agreement_ready`, or `fail`;
- does not create a panel claim with zero or one coder.

Tests were added for same-packet agreement and packet-hash mismatch rejection.

## Step 6: Ambiguous v0.8 Packet Was Preserved

The only local headroom card, sibling A, was converted into a blinded
adjudication packet:

- `exports/a19/adjudication-packets/moral-disclosure-standing-repair-a.packet.json`

The corresponding no-coder merge report is:

- `exports/a19/adjudication-reports/moral-disclosure-standing-repair-a.coders.json`

Current merge status:

- `no_coder_files`;
- coder count: 0.

Visible alias audit:

- one public-transcript hit for `accountability question` in the S1 arm.

This packet is useful for later independent coding, but it does not itself
create agreement evidence.

## Step 7: Loop Registry And TODO Were Resolved

The loop registry now records all three tracks as resolved for this unit of
work:

- non-collapsing repair-family track:
  `v0_8_resolved_below_claim_threshold`;
- adjudication infrastructure track:
  `merge_report_ready_no_coder_claim`;
- alternate S0/tutor-learner condition track:
  `diagnostic_plan_exhausted_no_claim`.

Updated artifacts:

- `config/teaching-drama-axioms/a19-generalization-loops.yaml`
- `notes/adaptive_2_0/2026-06-08-a19-generalization-systemization-plan.md`
- `notes/adaptive_2_0/2026-06-07-a19-drama-axiom-transfer-todo.md`
- `exports/a19/reports/generalization-loop.md`

The weak/debug/model-stratified S0 path is resolved as diagnostic-only. Weak S0
may screen future candidates, but it is not a claim path. Model-stratified
recursive-full runs would need a fresh preregistered tier plan and separate
reporting by generator tier before any spending.

## Step 8: Validation And Checks Passed

The final acceptance checks passed:

- `npm run a19:validate -- --json`
- `npm run a19:generalize -- --json`
- `npm run test:a19`
- `npm run a19:report`
- `npm run format:check`
- `npm run lint`
- `npm run atlas:validate`
- `git diff --check`

Targeted A19 test count:

- 42 tests passed;
- 0 failed.

Atlas validation remained clean:

- 0 errors;
- 0 warnings.

## Why This Still Does Not Advance Beyond A18

A19 is now a stronger framework and evaluation apparatus, but it has not yet
produced a clean, stable transfer result beyond A18's canonical evidence unit.
The repeated blockers are substantive:

- recursive-full S0 is strong enough to self-solve many held-out repairs;
- the one v0.8 local headroom card carries target-granularity risk;
- non-transfer repair types remain hard to keep distinct from nearby public
  repairs such as `claim_address_repair`;
- no v0.8 result reaches two clean recursive-full policy-headroom cards;
- no independent/human coding exists yet for the ambiguous packets.

The result is therefore not failure of documentation or tooling. It is a
negative or below-threshold research outcome under the current standard.

## Legitimate Next Moves

After that, the only legitimate research moves are independent coding of the
preserved packets, or a newly preregistered repair family with stricter
anti-collapse criteria.

Concretely:

1. Independent coding path: collect two or more coder JSON files for the same
   preserved packet hash, merge them with `npm run a19:adjudication-merge`, and
   report agreement only on the same artifacts.
2. New-family path: preregister a genuinely new repair family with stricter
   public obligations and anti-collapse criteria before any generation.

No current A19 artifact licenses a sidecar claim, atlas projection, Paper 2.0
claim, paid-panel escalation, retrieval, DPO, process reward modeling, or weight
update.
