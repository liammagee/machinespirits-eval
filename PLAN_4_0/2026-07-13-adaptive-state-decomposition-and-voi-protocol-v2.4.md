# Adaptive-state decomposition audit + active-sensing VOI protocol v2.4

**Date frozen:** 2026-07-13, before any v2.4 analysis was run or inspected.

**Status:** prospective contract for final-stretch Step 1 (PRECONSCIOUS-FINAL-STRETCH-PLAN.md). Zero model calls end to end. Diagnostic and directional only: nothing in this protocol can rescue, reinterpret, exclude, or promote any row of any stopped run; `winner: null` and `do_not_optimize_policy` remain operative throughout; S2 remains prohibited.

**Parent outcomes:** v2.3 S0 exact-channel sealed PASS; v2.3 S1 canonical sensor pilot sealed STOP (`do_not_run_canonical_s2` — lean DAG worse than no-state on both co-primary targets, log-loss deltas −0.5212/−0.5013; richer rungs worse still; oracle passing). The v2.3 stop's own exit instruction names the decomposition audit; the VOI study is the one mechanism class no prior instrument has tested (the benchmark holds tutor actions fixed by design).

**Claim status:** engineering, instrument design, and directional screening only. No sensor-validity, efficacy, or human-learning claim can issue from this protocol.

## Data and provenance (pinned)

- **Fixed-schedule arm = the sealed v2.3 S0 exact-channel dataset**, read only via a checksum-verified restore of the packaged archive:
  - manifest `config/adaptive-tutor-evidence/adaptive-state-v2-s0-exact-channel-346e472a-v23-06f76257057c.manifest.json`
  - restore with `scripts/restore-adaptive-run.js`; verify with `scripts/verify-experiment-run.js` before any read. Analyses must not read the loose worktree copy.
- **Pilot comparator numbers** come from the packaged canonical-pilot archive (manifest `…-s1-canonical-pilot-bd8f47ec-v23-4df8541873c3.manifest.json`), likewise restored and verified. Its rows are compared against, never re-scored for promotion.
- **Generative model** = the committed kernels and world adapter (`services/adaptiveTutor/learnerKernels/`): `enumerateTransitions` returns explicit branch distributions captured before sampling, which makes an exact Bayes filter over latent kernel state computable with zero model calls.
- Worlds: marrick, hethel, ravensmark. Kernels: `durable_state`, `dag_dropout`. Renderers: the two deterministic exact-surface templates. Dialogue shape: 1 bootstrap + 7 learner turns, 6 scored transitions. Action families available to the scheduler: the kernel-supported set (the fixed schedule uses `diagnose_with_discriminating_question`, `minimal_hint`, `request_evidence` across its six slots).
- Randomness: any bootstrap uses `latent_pair_id` clusters, 5,000 resamples, seed `20260713`, no refitting inside resamples. Any new dataset generation uses fresh run labels prefixed `adaptive-state-v24-` and never reuses a prior label.

## Part 1a — the P0 decomposition audit (diagnostic)

Four frozen analyses on the restored S0 dataset and the pilot's frozen folds (leave-one-world-out; both co-primary targets `next_dag_event_family`, `next_proof_trajectory`; multiclass log-loss primary, Brier secondary):

- **A1 schedule floor.** Predict both targets from schedule-position features alone (world, turn index, action family) with the pilot's fixed head. Report against the pilot's `no_state`, class-prior, uniform, and oracle rows. Establishes how much of "no-state" predictability is the fixed schedule itself.
- **A2 dimensionality/regularization.** Refit `lean_dag`, `dag_trajectory`, `field_trajectory` heads under an L2 grid of {0.25×, 1×, 4×, 16×, 64×} the pilot's fixed penalty, same folds, same features. Diagnostic refits are permitted here precisely because this instrument has no promotion authority.
- **A3 world encoding.** Per-world deltas vs no-state for every rung and λ; feature-distribution summaries by world. Names why Hethel alone improved in the pilot.
- **A4 per-kernel failure modes.** The same decomposition split by generator (`durable_state` vs `dag_dropout`).

**Frozen classification rule** (margins in pooled log-loss nats; delta = rung − no_state, negative = worse, matching the pilot's sign convention; both targets must satisfy a clause for it to bind):

1. `data_starved` — if any rung at any grid λ reaches |delta| < 0.02 pooled on both targets (the pilot's negative is eliminated by regularization alone).
2. `world_confounded` — not (1), and some rung/λ reaches |delta| < 0.02 in at least 2 of 3 worlds on both targets while a single remaining world drives the pooled deficit with per-world delta ≤ −0.10.
3. `representation_carries_nothing` — otherwise, including every ambiguous margin. Ambiguity defaults conservatively against further sensor spend.

Exactly one primary label is emitted (secondary flags permitted). The label's only downstream authority: (1) is a precondition for the VOI study's `inconclusive_data_starved` verdict and reopens design discussion (not runs) on `tutor-stub-transition-reward-model`; (2) directs any future sensor work at world encoding; (3) closes the representation ladder on this critical path.

## Part 1b — the active-sensing value-of-information study (directional)

**Premise being tested.** The v2 benchmark freezes the action schedule so representations are comparable — which means no instrument in the program has ever tested whether the *choice of action* controls how much latent state the public channel carries. The kernels make this exactly computable: an action's informativeness is the expected reduction in posterior entropy over latent kernel state, under the exact filter defined by `enumerateTransitions`.

Frozen questions and machinery:

- **B1 per-action information gain.** For each world × kernel, run the exact filter along the sealed S0 trajectories; at every scored transition, compute expected one-step posterior-entropy reduction (bits) for each available action family. Report the full table.
- **B2 info-optimal schedule arm.** Generate one fresh zero-call dataset, label `adaptive-state-v24-voi-schedule`, identical matrix and dialogue shape to S0, deterministic renderers, with the action at each turn chosen greedily to maximize expected information gain from the current filter posterior (ties broken by the fixed schedule's action). 24 dialogues, sealed with the same run-artifact machinery.
- **B3 channel-capacity read (upper bound per schedule).** The exact-filter posterior (which knows kernel dynamics) is used as a predictor of both co-primary targets on each arm. This bounds what any public-only estimator could achieve given that schedule. Compare fixed-schedule vs info-optimal-schedule capacity.
- **B4 estimator read.** Refit the pilot's fixed-head `lean_dag` on the info-optimal arm under the same fold rules: does scheduling alone rescue the lean estimator that failed on the fixed schedule?
- **B5 info/pedagogy trade-off (descriptive).** Proof-progress trajectories (raw distance, harmful debt) under the two schedules, per world × kernel.

**Frozen verdict rule — exactly one of:**

- `graduate_active_sensing_to_paid` — B3 on the info-optimal arm beats the arm's no-state baseline by ≥ 0.05 log-loss nats and ≥ 0.02 Brier on both targets where the fixed arm's B3 equivalent did not, AND B1 shows ≥ 0.10 bits expected gain for at least one action in ≥ 2 worlds for each kernel. Authorizes only the *design* of a paid active-sensing slice under a new prospective contract, and supplies the design input for any future Phase 6B reconstructed-state adapter. It does not authorize a run, name a winner, or reopen S2.
- `close_sensor_program_on_substrate` — terminal posterior entropy over latent state on the info-optimal arm remains within 0.10 bits of the prior at horizon (the public channel carries essentially no latent information under any schedule), OR B3 fails the margins on both targets on both arms while the oracle passes. Closes the sensor program on this substrate with a boundary-grade negative: the concealment is a property of the channel under any policy, and the paper reports it as such.
- `inconclusive_data_starved` — only if Part 1a returned `data_starved` AND the cluster-bootstrap intervals for the B3 contrasts span both cut lines above. Permits one bounded zero-call kernel-data extension under this same contract (larger seed set, same matrix), nothing else.

**Sequencing:** Part 1a runs and its report is written before any Part 1b result is inspected.

## Prohibitions (unchanged from v2.3 plus)

No model calls. No rescue, re-labeling, exclusion, or reinterpretation of any stopped v2.1/v2.2/v2.3 row. No S2, no policy optimization, no Phase 6B work, no shadow pilot, no efficacy or human-learning claims. No prompt or world edits. A `graduate` verdict changes what may be *designed*, never what may be *run* — paid runs take their own go at their own freeze point.

## Outputs

- `exports/adaptive-state-v24/decomposition-audit-report.{json,md}` and `exports/adaptive-state-v24/voi-study-report.{json,md}`, with SHA-256 of each report recorded in the dated PLAN_4_0 results note.
- A results note `PLAN_4_0/2026-07-13-adaptive-state-v24-results.md` (or dated later if execution slips) recording the classification label, the verdict token, and the headline tables.
- Workplan card `tutor-stub-learner-state-validity` receives the dated entry.

## Implementation surface (to be built after this freeze)

- `scripts/analyze-adaptive-state-decomposition-v24.js` (Part 1a)
- `services/adaptiveTutor/latentKernelFilter.js` (exact Bayes filter over kernel latent state; pure, unit-tested)
- `scripts/run-adaptive-state-voi-v24.js` (Parts B1–B5, including the `adaptive-state-v24-voi-schedule` generation)
- Tests colocated per repo convention; the filter must reproduce the kernels' own oracle distributions as a fixed-point check (filter prior = true state ⇒ filter forecast = kernel oracle).
