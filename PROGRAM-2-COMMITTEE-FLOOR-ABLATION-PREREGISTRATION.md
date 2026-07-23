# Program-2 committee floor ablation — pre-registration

Status: **DESIGN FROZEN** on 2026-07-23 on branch
`codex/program2-committee-floor-ablation`, before any dialogue from this
experiment was generated. The launch commit SHA is recorded only after the
zero-model implementation gate passes and the worktree is clean. Any change
after the first sealed trace requires a dated amendment; the original plan and
trace remain in the analysis.

**AMENDMENT 1 FROZEN 2026-07-23** after the failed first launch and before any
replacement dialogue. Section 8 defines the repair and clean-cohort restart;
the estimand, 30-dialogue matrix, models, seed, endpoints, and reading grammar
remain unchanged.

Parent design:
`PROGRAM-2-PHASE5B-FALLBACK-BATTERY-PREREGISTRATION.md`. Exploratory tier.
The frozen v1 point-of-action detector and warrant audit remain the scoring
instrument. Historical Phase 5/5b rates are context only and are not pooled
into any inferential contrast.

## 1. Question

Phase 5b changed two things relative to a silent frontier control: a trained
mini proposed the bounded question, and the fallback-v2 harness rejected,
resampled, or trimmed bad proposals before delivery. How much of the live
warrant-compliance gain comes from the trained weights rather than that
harness?

The causal contrast is therefore contemporaneous: trained and untuned
same-lineage mini models occupy the same committee seat behind the same
detector, frontier composer, battery, and fallback policy.

## 2. Design (30 dialogues)

One Marrick world × two learner profiles (`proof_skipper`,
`affective_resistant`) × three conditions:

| Condition | Mini seat | Repeats/profile | Dialogues |
|---|---|---:|---:|
| `trained_committee` | `program2-sft-instruct-v2` | 6 | 12 |
| `untuned_committee` | `program2-floor-instruct-q8` | 6 | 12 |
| `silent_control` | committee inactive | 3 | 6 |

All 30 jobs are interleaved by seeded Fisher-Yates shuffle, seed **20260723**.
Each trained/untuned job is blocked by learner profile and repeat
(`pairKey = <profile>:r<repeat>`), and shares the run seed, evaluation repeat,
policy-draw job identity, world, prompts, and fixed runtime seams. Distinct
trace directories preserve condition provenance. The models remain stochastic,
so this is a matched block rather than an assertion of identical generated
histories.

No historical controls are pooled. The six silent controls are deliberately
contemporaneous with both committee conditions.

## 3. Fixed runtime seams

- world `world_005_marrick`; register policy, DAG mode, horizon, release speed,
  dropout, history, token, and safety-turn settings inherited verbatim from the
  frozen Phase 5 operational spec;
- speaking tutor `claude-code.sonnet-5`;
- classifier, learner-record, and automated learner
  `codex.gpt-5.6-terra`;
- point-of-action detector `step4-frozen-2026-07-14.v1`;
- committee fallback policy `v2` and the Phase 5b composed/fallback battery;
- frozen v1 warrant audit, including the six-word cue requirement;
- the only trained-versus-untuned experimental seam is
  `--committee-mini-model`; job ids and trace destinations differ only for
  provenance.

The runner must first emit a 30-job zero-model plan and pass its fixtures. A
paid launch requires a clean checkout plus the exact 40-character expected
SHA, sealed-trace resume, at most one same-seed retry per failed job, and the
existing three-consecutive-transport-failure abort. No unplanned replacement
dialogues are permitted. A confirmatory reading requires all 30 jobs sealed;
partial results are marked incomplete.

## 4. Frozen analysis

Unit of resampling is the dialogue. All intervals use 5,000 bootstrap draws,
seed **20260723**, stratified by learner profile.

### Primary endpoint

**W1: trained-weights contrast.** Pooled frozen-v1 `warrant_skip` compliance,
`trained_committee − untuned_committee`, using a paired profile-stratified
dialogue-cluster bootstrap over the 12 matched blocks.

- **Training contribution detected:** the 95% CI lower bound is greater than
  zero.
- **Practical equivalence:** the whole 95% CI lies inside **[-0.10, +0.10]**.
- A CI containing zero but not contained by the equivalence band is
  **indeterminate**, not evidence that the fine-tune is decorative.

### Secondary contrasts and guardrails

- **W2:** `untuned_committee − silent_control`, independent
  profile-stratified dialogue-cluster bootstrap. CI lower bound greater than
  zero means the harness produces a live advantage without trained weights.
- **W3:** `trained_committee − silent_control`, computed the same way as W2.
  This is a contemporaneous replication of the committee benefit, not a second
  primary endpoint.
- **Density:** each committee condition has at least 15 warrant opportunities,
  and `proof_skipper` contributes at least one opportunity in each.
- **Coverage:** coverage@16 for each committee condition is no worse than
  silent control minus 0.05.
- **Safety:** hard-safety rate for each committee condition is no worse than
  silent control minus 0.10; leaks are reported by condition and turn.
- **Mechanism descriptives:** committee moments, fallback moments, the full
  fallback-resolution tally, and battery-rescue rate
  (`selected_sampled_*` or `trimmed` per fallback moment) for trained and
  untuned conditions. These diagnose whether the harness works harder for the
  untuned model but do not replace W1.

The existing seam review may be run separately, blinded by committee
condition. It is a delivery guardrail and does not alter W1-W3.

## 5. Reading grammar

| Frozen result | Licensed reading |
|---|---|
| W1 positive + W3 positive | Trained weights add live warrant compliance inside the fixed harness, and the trained committee beats the contemporaneous frontier control. |
| W1 positive, W3 not positive | Trained weights improve the committee relative to the untuned floor, but an absolute live gain over the current control is unresolved. |
| W1 equivalent + W2 positive | Within the ±0.10 tolerance, fallback-v2 harnessing is sufficient for the observed live advantage; a material training increment is not detected. |
| W2 positive, W1 neither positive nor equivalent | The harness contributes, but the incremental value of training is unresolved at this sample size. |
| W1 negative | The untuned floor outperforms the trained mini in this run; report as a reversal and do not repair or rerun to recover the expected ordering. |
| Any density or completion gate fails | Incomplete/under-informative; report realized counts and no confirmatory attribution. |

Coverage, safety, fallback burden, and seam results narrow the operational
claim. They cannot turn an indeterminate W1 into a claim about the weights.

## 6. Scope and cost bound

Single tutor family, world, detector, two learner profiles, and one same-lineage
untuned model. The 30-dialogue run is checkpointed and resumable. Expected
frontier cost is approximately 1.7 times Phase 5b; both mini models are local.
Out of scope: retraining, KTO, an instrument change, cross-world transfer,
Codex-family tutor arms, or tuning any threshold after trace inspection.

## 7. First launch outcome (2026-07-23 — frozen abort, no result)

The pushed launch SHA was
`8fd08b2a46eef1b238646ff164cae138820ab3d5`. The zero-model gate, Marrick
world-quality gate, prompt-audit tests, and both Ollama model preflights passed.
The paid run then stopped at the pre-registered three-consecutive-failure gate
after one dialogue sealed:

- `trained_committee / affective_resistant / r6` sealed on its first attempt
  at 22 completed turns;
- `silent_control / proof_skipper / r1` failed at turn 19 with
  `leak:private_die_conclusion`, then failed its one allowed retry at turn 31
  with `response_composition:generic_learner_uptake`,
  `live_turn_progression_v1:learner_uptake_not_realized`, and a report-only
  configuration-axis miss;
- `untuned_committee / affective_resistant / r5` failed its first attempt at
  turn 13 with `actorial_realization:missing_selected_performance_tactic` plus
  two report-only configuration-axis misses. This was the third consecutive
  failed attempt, so the launcher aborted before the job's second attempt.

The launch-state artifact labels the gate `three consecutive transport
failures`; the trace evidence shows that all three were deterministic final
audits, not provider transport failures. Artifacts remain under
`exports/program2-committee-floor-ablation/` in the launch worktree, including
`launch-state.json`, four JSONL attempts, and `analysis.json`.

The frozen analyzer reports 1/12 trained, 0/12 untuned, and 0/6 control
dialogues sealed; zero matched blocks; W1–W3 not estimable; and density 3/15 in
the trained condition and 0/15 in the untuned condition. Its sole licensed
reading is `incomplete_or_under_informative`. The sealed trained dialogue's
0/3 compliance and other component values are not interpretable as condition
estimates and must not be quoted as a weights result.

No resume is licensed by the frozen design. Continuation requires a dated
amendment and a new clean SHA after a narrow deterministic-fallback repair. A
shadow/advisory relaxation is not silently substituted: it would change which
delivered turns enter the endpoint and therefore needs its own explicit design
decision.

## 8. Amendment 1 — strict fallback repair and clean-cohort restart (2026-07-23)

The user authorized the best next move after reviewing the abort, and the
earlier approval to send the 30-dialogue experiment's prompts and transcripts
to the configured Sonnet and Terra providers remains in force. This amendment
was written before any replacement dialogue was generated.

The trace anatomy identified three implementation defects rather than a result
about trained versus untuned weights:

1. terminal recovery could reuse a prior acknowledgement without rechecking
   that it carried the learner's typed focus;
2. a declarative handoff could restate an unsupported learner conclusion as a
   settled point; and
3. the launcher treated every nonzero child exit as provider transport, even
   when the trace named a deterministic final-audit rejection.

The strict repair is fixed as follows:

- every preserved or repaired fallback acknowledgement is revalidated against
  the same turn-progression contract before use;
- an unsupported learner conclusion is named explicitly as a claim that
  remains open until public evidence supports it, rather than being repeated
  as settled;
- bounded focus acknowledgements are shortened so a long authored clue can
  still realize the selected plain/unadorned performance without changing or
  truncating the clue; and
- launch-state rows record `deterministic_final_audit`, `provider_transport`,
  or child-process failure from the latest trace event. Only an actual provider
  transport failure increments the three-consecutive-transport-failure gate.
  Deterministic audit exits still consume the job's one allowed retry and can
  still produce attrition; no guard is downgraded.

To avoid mixing runtime versions or granting selective extra attempts, the
first launch is a diagnostic cohort and is wholly excluded from W1-W3,
including its one sealed trained dialogue. Amendment 1 restarts all 30 planned
cells from the beginning under one new clean SHA in
`exports/program2-committee-floor-ablation-amendment-1/`. It retains the same
seeded job order, same-seed one-retry limit, models, prompts, profiles, local
mini artifacts, fixed detector, warrant audit, fallback-v2 policy, and frozen
analysis. A licensed reading still requires 30/30 sealed replacement jobs.
The original traces and analysis remain untouched under
`exports/program2-committee-floor-ablation/` and are reported only as the
reason for this amendment.

### Pre-dialogue startup correction

The first Amendment 1 invocation at SHA `4104dda7` found no installed
`node_modules` path in the isolated worktree. `tutor-stub.js` therefore failed
while importing `dotenv`, before trace creation or any provider call. The
launcher classified these correctly as `child_process` rather than transport,
but cycled through the plan because non-transport failures did not yet stop the
outer loop. The resulting launch-state file records 0/30 sealed, no trace
directory, and no experimental dialogue; it is retained as
`launch-state-preflight-failure.json` and is not an attempt under the
one-retry-per-dialogue rule.

Before the clean cohort starts, the launcher now runs `tutor-stub.js --help` as
a zero-model child-runtime preflight and aborts immediately on any non-retryable
child-process or signal failure. The worktree is supplied the existing local
dependency installation without changing tracked code or the experiment.

## 9. Amendment 2 — bounded terminal focus composition (2026-07-23)

Amendment 1 then began at SHA `a85d63c1`. Its first trained-committee dialogue
reached turn 16 before terminal recovery failed
`actorial_realization:missing_selected_performance_tactic`; two non-actorial
axis findings were report-only. The retry was interrupted after its opening so
the same known implementation defect would not consume more provider calls.
No Amendment 1 job sealed.

The trace showed a general composition defect, not a clue-length defect: a
valid but verbose repaired acknowledgement carried the learner's long request,
and the deterministic handoff quoted the same long request again. At 87 words,
the combined terminal fallback missed the selected `unadorned_report` budget
despite retaining a visible record-keeper action. This was reproduced
model-free from the exact learner surface.

The second strict repair is fixed before any Amendment 2 dialogue:

- terminal recovery revalidates both the preserved repair opening and the
  ordinary deterministic opening, then chooses the shortest focus-bearing
  result; and
- when the default handoff would lose the typed focus, it uses the shortest
  bounded focus fragment that still passes the unchanged handoff-coverage
  audit instead of repeating the complete learner surface.

The reproduced response is 73 words and passes the same strict actorial and
turn-progression audits. No threshold, disposition, evidence surface, or
endpoint changes. The whole Amendment 1 runtime-validation directory is
excluded from W1-W3. Amendment 2 again starts all 30 cells under one new clean
SHA in `exports/program2-committee-floor-ablation-amendment-2/`, with the
original seed, order, models, retry rule, and frozen analysis unchanged.
