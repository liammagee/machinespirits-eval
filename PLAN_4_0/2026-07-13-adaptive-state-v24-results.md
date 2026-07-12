# Adaptive-state v2.4 results — decomposition audit + active-sensing VOI study

Date: 2026-07-13. Contract: `PLAN_4_0/2026-07-13-adaptive-state-decomposition-and-voi-protocol-v2.4.md` (frozen before analysis; committed at `797c25cf`). Zero model calls end to end. Nothing here rescues or reinterprets any stopped run: `do_not_run_canonical_s2`, `winner: null`, and `do_not_optimize_policy` all remain operative.

Reports (SHA-256 recorded per contract):

- Part 1a `exports/adaptive-state-v24/decomposition-audit-report.json` — `3d9fbf4b3aa511f86a2250aa9f262abbccb4256016b231722d94407e468bf09b`; `.md` — `ce7e5dc91dc75b4483657156541bc9f8c654794e6b80b501249aa9eea75659ab`
- Part 1b `exports/adaptive-state-v24/voi-study-report.json` — `1b84df6cf698e5e56a792346ad613225597def8b32c7f26793d34579ee3e562d`; `.md` — `0ddab8c669cecdedde7892716486772143ff05fff8714298f42d23a6bd7d3600`
- Sealed VOI arm `adaptive-state-v24-voi-schedule` (24 dialogues, 144 transitions, zero calls, deterministic replay verified; dataset SHA-256 `1258c761c4ee6c18b5e8ec1eec7af40d4f6faa8bcce89a6168236abe4b77ff8b`), packaged at `config/adaptive-tutor-evidence/adaptive-state-v24-voi-schedule-6135bf3f6c6b.manifest.json`.
- Inputs were read exclusively from checksum-verified restores of the packaged S0 and canonical-pilot archives (S0 archive `6a0c0214…78ad`, pilot archive `d47cedc5…6024`).

## Part 1a — classification: `data_starved`

- **The pilot's negative deltas are an estimation artifact at this data size.** Refits reproduce the sealed stop numbers bit-exactly at the pilot's fixed penalty (lean DAG −0.5212/−0.5013 log-loss nats vs no-state), and the frozen regularization sweep eliminates them: `field_trajectory` at 16× penalty reaches the negligible band on both co-primary targets (−0.0125 / +0.0146 pooled). Clause 1 of the frozen rule fires; precedence honored; no ambiguity defaults needed.
- **The pilot's reference was itself weak.** The A1 schedule floor — predicting targets from (world, turn index, action family) alone — *beats* the pilot's no-state baseline by +0.2638 [0.0101, 0.5665] and +0.2012 [0.0189, 0.4387] nats (probability of improvement 0.979/0.991), and the pilot's no-state carries 0.18/0.09 nats more loss than the class prior under leave-one-world-out. The rungs failed against an overfit schedule proxy.
- **The stop's decision still stands.** No rung at any penalty ever beats the *matched-regularization* no-state (largest matched-λ margin −0.0144 nats); regularized no-state itself gains +0.28/+0.20. `data_starved` licenses no sensor claim — it reclassifies the failure's cause, not its verdict.
- Ravensmark drives the baseline pathology (out-of-range item difficulty 1.0 vs training 0.33–0.40; most skewed labels; absolute no-state log-loss ~2.0 vs ~1.0–1.2 elsewhere) — the same world that stopped every observability preflight.

## Part 1b — verdict: `close_sensor_program_on_substrate` (conservative default), with a corrected gloss: **transparency, not concealment**

The frozen three-way rule matched no clause on the measured configuration, and the exactly-one-token mandate resolved to the conservative token, flagged `none_matched_conservative_default` in the report. The measured facts:

- **The exact channel is fully transparent to a dynamics-aware reader.** The exact Bayes filter over kernel latent state (fixed-point-verified against the kernels' own oracle distributions at all 216 grid points and at every live transition) drives posterior entropy from 4.78–5.40 bits to **0.0000 bits at horizon on every trajectory, on both schedules**. B3 channel capacity passes the frozen margins decisively on *both* arms (filter beats no-state by 0.66–0.84 nats log-loss; CIs well above the cut lines).
- **Active sensing therefore buys nothing here — not because probing fails, but because there is nothing left to reveal.** Every action family is highly informative (B1 median gains 0.83–0.99 bits per action; floor passed everywhere); the greedy info-max schedule ran strictly (0 fallbacks) and changed capacity immaterially (arm contrasts −0.04/+0.07 nats, descriptive).
- **Scheduling does not rescue the lean estimator.** B4: lean DAG on the VOI arm remains below its no-state (−0.30/−0.62 nats), with the same Ravensmark pathology as 1a. The gap between the filter (perfect) and the feature heads (below baseline) is estimator-side and data-size-side, exactly as 1a classified.

## What this means (bounded)

1. **Operationally, the verdict token binds:** no further sensor spend on this substrate. S2 stays prohibited; the representation ladder stays closed on this critical path; Phase 6B's sensor precondition stays unmet.
2. **The reason is new and matters for design.** The v2.3 stop read as "public state fails to carry the latent signal." The decomposition shows the signal was there in full — a reader that knows the kernel dynamics recovers the entire latent state from the existing public events under the existing fixed schedule. The synthetic kernels, as authored, do not instantiate a concealed interior at all: they are noisy-looking but fully observable processes. The benchmark therefore cannot adjudicate the concealment question the program actually cares about (the manifest-vs-latent gap); it adjudicates estimator efficiency at small n, and at n=144 generic feature heads lose to their own baselines.
3. **Consequences for the final stretch:** (a) the active-sensing lever, as posed on these kernels, is answered — probing is unnecessary where nothing is hidden; any revival requires kernels whose latent state is *identifiability-limited by construction* (multiple latent trajectories consistent with every public history), which is a new instrument design, not a rerun; (b) `tutor-stub-transition-reward-model` stays blocked — 1a's `data_starved` reopens design discussion only, and the transparency finding raises its bar (a learned model must beat a dynamics-aware filter that is already perfect here); (c) the Step 2 register confirmatory and Step 4 side-coaching gate are untouched — neither consumes a sensor.
4. **For the paper (§6.17 material):** the sensor arc closes with a two-part negative that is more instructive than either planned outcome — the pilot null was an instrument artifact (data starvation against a schedule-overfit reference), and the substrate's concealment premise was false (transparent kernels). Both claims are zero-call, sealed, and replayable.

## Verification

- Part 1a: 19/19 new+adjacent tests pass; refit reuse check bit-exact against the sealed pilot (max |Δp| = 0 across 864 predictions); whole-repo eslint clean.
- Part 1b: 162/162 tests pass (including the mandated fixed-point grid and fail-closed impossible-observation handling); sealed VOI arm replays deterministically; dataset SHA reproduced across three independent invocations.
- Both parts: `model_calls: 0`; no `data/evaluations.db` access; frozen v2.3 files, kernels, and worlds untouched; the only service edit is two `export` keywords on existing pilot helpers (behavior pinned bit-exact by the reuse check).
