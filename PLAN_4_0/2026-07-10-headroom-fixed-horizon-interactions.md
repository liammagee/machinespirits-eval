# Fixed-Horizon Reanalysis of the Headroom Contrast: the Interaction Was Already There

Date: 2026-07-10
Status: post-hoc reanalysis of an existing run (no new spend). Exploratory: n=3 per cell, single model stack (gpt-5.6-terra — see the model-provenance caveat below), v2-era learner contracts. Directly answers the question posed by `2026-07-10-adaptive-policy-discrimination-and-learner-diversity.md`.

## What was done

`scripts/analyze-tutor-stub-trajectories.js` (new) computes fixed-horizon
progress (learner turns 8/12/16) and trajectory AUC (coverage, mastery,
safety = 1−risk over turns 1–16) from the per-turn substrate every auto-eval
run already persists (`trainingExamples` field states + `animatedViz` DAG
frames). Applied to the 60 dialogues of
`.tutor-stub-auto-eval/headroom-contrast-n3-live/` — the same data behind the
endpoint verdict "adaptive selection buys nothing measurable over plain-fixed."
Reports: `trajectory-analysis.{md,json}` in the run dir.

## Result: the endpoint null was an until-grounded artifact

At fixed horizons, policy rankings **cross by learner profile** — the exact
signature the discrimination note pre-declared as what would count as adaptive
success:

Coverage at learner turn 16 (n=3 per cell, sd in parentheses):

| Profile | bland | dynamic | field | dynamical_system | negative |
| --- | --- | --- | --- | --- | --- |
| affective_resistant | 0.222 (.255) | **0.556** (.096) | 0.444 (.193) | 0.444 (.096) | 0.278 (.096) |
| false_memory | 0.278 (.255) | 0.389 (.096) | **0.556** (.193) | 0.389 (.096) | 0.444 (.096) |
| diligent | **0.667** (0) | 0.556 (.096) | 0.500 (0) | 0.500 (0) | 0.611 (.096) |
| proof_skipper | 0.445 (.255) | 0.389 (.096) | 0.444 (.096) | 0.278 (.255) | 0.444 (.096) |

- On the two profiles with sharp failure operators (affective_resistant,
  false_memory), adaptive arms are 1.5–2 released-premises ahead of bland
  mid-dialogue (deltas +0.222 to +0.334 coverage ≈ 1.3–2 premises), with the
  same story in mastery (e.g. affective: dynamic 0.724 vs bland 0.618) and
  risk (0.200 vs 0.313), and in coverage AUC (dynamic 0.222 vs bland 0.111 —
  double).
- On diligent, the ranking inverts: bland leads at turn 16 (0.667) and every
  adaptive arm trails (−0.111 to −0.167). Adaptation has a cost when there is
  nothing to adapt to.
- By until-grounded closure everything converges (except negative on
  affective_resistant, which never grounds) — which is why the endpoint
  analysis read as a null. Slower policies catch up when given unlimited
  turns; the fixed horizon removes exactly that.

Rank crossings are present at every horizon; at turn 16 the per-profile
leaders are affective_resistant→dynamic, false_memory→field, diligent→bland,
proof_skipper→bland.

## Revised claim ladder

1. Established at endpoint (previous note): register choice has outcome
   consequences (negative collapses on affective_resistant).
2. NEW, exploratory: adaptive register selection produces profile-contingent
   mid-dialogue progress gains — faster evidence coverage on stress profiles,
   a cost on the compliant profile — that endpoint measurement cannot see.
3. NOT established: any of this at claimable n, with v3 contracts, with
   interleaved cells, or on a second model family.

## Caveats

- **Model provenance**: the headroom run (like all 2026-07-10 tutor-stub
  evidence before 12:56Z) executed on `gpt-5.6-terra` despite requesting
  `codex.gpt-5.5` — a child model-flag-forwarding bug, fixed in 7d50c8f0.
  Treat the stack as gpt-5.6-terra throughout.
- Coverage moves in 1/6 quanta on world-005 (6 premises), so cell means are
  coarse; several bland cells have sd 0.255 (one dialogue stalled while two
  progressed).
- Headroom ran v2-era learner contracts (bd4532fe predates the v3 schema in
  50e37f88). The v3 frozen-control discrimination pass (pooled cosine 0.737,
  max-to-diligent 0.699, n=3) is for false_memory + proof_skipper on
  gpt-5.6-terra; affective_resistant is unchanged v2→v3 but has no v3-labeled
  gate pass; nothing is gate-validated on gpt-5.5.

## What the confirmatory run needs (per the discrimination note, updated)

The note's design stands, now with a pre-registerable primary endpoint:
**coverage at learner turn 16, policy × profile, v3 contracts, n≥5 per cell**.
Machinery status: fixed-horizon/AUC/interaction analysis — built (this note);
suites and n — expressible today; still missing: deterministic policy
interleaving (small: reorder buildJobs behind a flag), predeclared pressure
trigger + recovery scoring (medium: turn-indexed register override in
tutor-stub.js — coordinate with in-flight edits), and the model question
(replicate on gpt-5.6-terra where discrimination is validated, or gate the v3
profiles on gpt-5.5 first).

## Related notes

- `PLAN_4_0/2026-07-10-adaptive-policy-discrimination-and-learner-diversity.md`
- `PLAN_4_0/2026-07-10-phase6-gate-explainer-and-headroom-result.md`

## Cross-model replication (Sonnet 5, run 2026-07-10/11)

Confirmatory matrix `.tutor-stub-auto-eval/headroom-sonnet5-pressure-n3-live/`
(SHA d265edad, claude-code.sonnet-5 at all four seams — provenance verified
from run_start metadata; 60/60 rows after a session-limit resume; policies
interleaved; predeclared face_threat probe at learner turn 6 in every arm,
probeFiredRate 1.0 in all 20 cells).

Instrument verdicts first:

- **v3 profiles discriminate on Sonnet 5 — best separation measured on any
  stack** (pooled cosine 0.565, max-to-control 0.619, matched-policy 0.551,
  computed on the 60 complete traces only). affective_resistant and
  false_memory PASS their full contract gates; proof_skipper separates on
  cosine (0.579) and signature (0.563) but misses its observability
  recurrence floor — Sonnet's learner role-play omits warrants less
  persistently than terra's. Contract recurrence floors are model-sensitive.
- Sonnet 5's simulated learners are much harder: 27/60 grounded within the
  40-turn cap (terra: 52/60); affective_resistant grounds 0/15 in every arm.
  (Across-run comparison on that profile is confounded by the probe's
  introduction; the within-run policy contrast is clean.)

Policy verdicts (n=3 per cell, exploratory):

- **The interaction structure REPLICATES**: rank crossings by profile at every
  horizon on both models, and bland leads the compliant diligent profile on
  both (Sonnet t16: bland 0.556 vs adaptive 0.167-0.333) — adaptation costs
  when there is nothing to adapt to, now a two-model result.
- **On stress profiles, some variation arm beats bland at t16 on both models
  — but WHICH arm is model-dependent.** Terra: dynamic (affective +0.334),
  field (false_memory +0.278). Sonnet: field (affective +0.166, proof_skipper
  +0.334), negative (false_memory +0.167).
- **The in-context arm does not transfer.** dynamic — terra's best stress arm
  — is the worst policy on Sonnet 5 by a wide margin (endpoint closure 0.083
  vs bland 0.667; t16 stress coverages 0.167/0.056/0.000). The hand-coded
  field policy is the only arm never behind bland on terra AND leading two
  stress profiles on Sonnet.
- Endpoint outcome ranking on Sonnet 5 favors bland outright (mean outcome
  0.830 vs field 0.767, dynamical_system 0.772, negative 0.783, dynamic
  0.582) — the endpoint-vs-horizon divergence persists on the second model.
- Pressure-probe recovery (affective, window 4): dynamical_system is the only
  arm with positive post-probe mastery (+0.118) and risk improvement
  (-0.152); dynamic shows the worst post-probe risk spike (+0.283). Tiny
  effects at n=3; treat as the first calibration of the recovery instrument,
  not a finding.

Revised defensible sentence: *profile-contingent mid-dialogue adaptation
effects replicate in structure across two model families, but no single
policy carries them — the LLM-judgment register arm does not transfer at
all, and endpoint outcomes still favor a plain fixed register.* The prior
"in-context > hand-coded machinery" heuristic does not hold on Sonnet 5 for
register selection: the hand-coded field policy beats the model's own
in-context register judgment there.
