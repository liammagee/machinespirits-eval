# Tutor Stub Learner Profile Robustness

This note records the learner-profile thread for tutor-stub evaluation. The goal
is to make policy comparisons robust to realistic learner variation, not merely
to a single compliant automated learner. If learner profiles do not create
observable behavioral differences, then extra profile runs mainly inflate cost
without improving the evidence base.

## Problem

Early profile labels did not reliably move the public learner behavior. Outcome
metrics often stayed flat: the same world, same policy, and same turn cap could
produce identical coverage and missing-premise scores across nominally different
profiles. The compacted behavior traces showed why: many profiles collapsed
toward diligent after the first correction.

This matters because policy robustness claims require two separate checks:

- The tutor policy should still close the proof path across learners.
- The learner profiles should actually exercise different failure modes.

Without the second check, a matrix of learners is only a larger sample of the
same interaction pattern.

## Current Method

Built-in automated learner profiles are now structured as
`machinespirits.tutor-stub.learner-profile-contract.v1` contracts. A contract
specifies:

- the intended failure operator;
- how it contrasts with nearby profiles;
- when the stable failure must appear and how often it should recur;
- public learner-turn rules;
- expected compacted-trace signatures;
- expected DAG/proof-path behavior;
- repair behavior after correction;
- a discrimination gate against the diligent control.

The auto-eval runner renders these contracts into the learner prompt and stores
a contract summary in the report config. This keeps the profile prompt, report,
and discrimination audit tied to the same schema.

Compacted traces use `machinespirits.tutor-stub.compacted-trace.v1`. They remove
raw transcript bulk and retain behavior-bearing features: classifier labels,
conceptual/readiness scores, proof-DAG counters, bottlenecks, field state, and
policy/register metadata. The profile discrimination analyzer compares profile
vectors with cosine similarity.

Initial gate:

- average pairwise cosine below `0.85`;
- max similarity to `diligent` below `0.90`.

## Evidence So Far

Historical checks showed weak separation:

- legacy current matched set: average pairwise cosine about `0.992`;
- older core-profile set: average pairwise cosine about `0.986`;
- first compacted sentinel after profile sharpening: average pairwise cosine
  about `0.896`.

The first live contract-wired sentinel improved the average but did not fully
pass:

- artifact root:
  `.tutor-stub-auto-eval/profile-contract-wired-sentinel-live-2026-07-09T08-04-03`;
- profiles: `diligent`, `proof_skipper`, `false_memory`,
  `affective_resistant`;
- policy: `field`;
- world: `world_005_marrick`;
- rows: `4/4 ok`;
- turn cap: all rows used `8` turns;
- outcome metrics: all rows ended at coverage `0.167`, missing `5`, bottleneck
  `release_or_pacing_gap`;
- compacted discrimination: average pairwise cosine `0.822`, max similarity to
  diligent `0.964`;
- result: average gate passed, diligent-neighbor gate failed.

Interpretation:

- `proof_skipper` separated well from diligent (`0.678` cosine in the live
  sentinel), so an explicit recurring warrant-omission contract works.
- `false_memory` was still too close to diligent. The earlier contract allowed
  one late distorted detail and easy repair, so the model normalized into
  careful evidence use.
- `affective_resistant` was still too close to diligent under `field`. The
  profile needs pressure-sensitive runs and public pushback, not only hidden
  discomfort.

The targeted fix therefore makes `false_memory` produce recurring public
distortions and makes `affective_resistant` visibly push back under direct or
negative tutor pressure.

A follow-up pressure sentinel on `field,negative` after the first contract
tightening still failed the global gate:

- artifact root:
  `.tutor-stub-auto-eval/profile-contract-pressure-sentinel-live-2026-07-09T08-24-04`;
- rows: `8/8 ok`;
- compacted discrimination: average pairwise cosine `0.877`, max similarity to
  diligent `0.956`;
- `false_memory` improved materially (`diligent` cosine `0.891`) because the
  compacted trace showed repeated `overleaps_evidence`;
- `affective_resistant` remained too close to diligent (`0.956`) because the
  learner often combined a pressure phrase with a useful evidence claim, so the
  classifier read the turn as `grounded` and `attempting`.

The second targeted fix makes early affective-resistance turns pressure-only:
no new trial-book line, evidence claim, or warrant until the interactional
pressure has been repaired.

A targeted post-fix check of only `diligent` versus `affective_resistant` then
passed:

- artifact root:
  `.tutor-stub-auto-eval/profile-contract-affective-pressure-live-2026-07-09T08-41-34`;
- policies: `field,negative`;
- rows: `4/4 ok`;
- compacted discrimination: average pairwise cosine `0.838`, max similarity to
  diligent `0.838`;
- result: pass for the specific affective-control distinction.

The full v2 pressure sentinel after the pressure-only affective fix passed the
current gate:

- artifact root:
  `.tutor-stub-auto-eval/profile-contract-pressure-sentinel-v2-live-2026-07-09T08-51-20`;
- profiles: `diligent`, `proof_skipper`, `false_memory`,
  `affective_resistant`;
- policies: `field,negative`;
- rows: `8/8 ok` after retrying `false_memory`;
- compacted discrimination: average pairwise cosine `0.848`, max similarity to
  diligent `0.895`;
- result: pass for the current gate.

The closest non-control pair was `false_memory` versus `proof_skipper` at
`0.903`, so the next schema iteration should watch whether distorted evidence
and warrant-skipping remain separable under larger samples.

## Reproducible Commands

Dry-run a cheap sentinel screen:

```bash
npm run tutor:stub:qa -- \
  --policies field,negative \
  --profile-suite sentinel \
  --runs 1 \
  --turns 8 \
  --safety-turns 80 \
  --parallelism 4 \
  --trace-dir .tutor-stub-auto-eval/profile-contract-pressure-sentinel-dry \
  --world world_005_marrick \
  --cli-effort low \
  --history-turns 4 \
  --max-tokens 4096 \
  --dry-run \
  --no-analyze
```

Run the live pressure sentinel:

```bash
npm run tutor:stub:qa -- \
  --policies field,negative \
  --profile-suite sentinel \
  --runs 1 \
  --turns 8 \
  --safety-turns 80 \
  --parallelism 4 \
  --trace-dir .tutor-stub-auto-eval/profile-contract-pressure-sentinel-live \
  --world world_005_marrick \
  --cli-effort low \
  --history-turns 4 \
  --max-tokens 4096 \
  --keep-going \
  --no-analyze
```

Analyze compacted traces:

```bash
npm run analyze:tutor-stub-profile-discrimination -- \
  --trace-root .tutor-stub-auto-eval/profile-contract-pressure-sentinel-live \
  --write-compacted .tutor-stub-auto-eval/profile-contract-pressure-sentinel-live/compacted-traces \
  --json \
  --out .tutor-stub-auto-eval/profile-contract-pressure-sentinel-live/profile-discrimination.json

npm run analyze:tutor-stub-profile-discrimination -- \
  --compacted-root .tutor-stub-auto-eval/profile-contract-pressure-sentinel-live/compacted-traces \
  --out .tutor-stub-auto-eval/profile-contract-pressure-sentinel-live/profile-discrimination.md
```

## Reading The Result

A successful robustness screen is not "all profiles get worse." It is a profile
matrix where:

- the diligent control remains evidence-seeking and repairable;
- `proof_skipper` repeatedly omits warrants;
- `false_memory` introduces plausible distorted evidence before repair;
- `affective_resistant` visibly reacts to pressure and only re-engages after
  face repair;
- the compacted vectors separate enough to justify larger policy comparisons.

Once the sentinel passes, run the focused or full QA matrix and treat policy
effects as more credible because they survived realistic learner variation.
