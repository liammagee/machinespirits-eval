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
`machinespirits.tutor-stub.learner-profile-contract.v4` contracts. A contract
specifies:

- the intended failure operator;
- how it contrasts with nearby profiles;
- when the stable failure must appear and how often it should recur;
- public learner-turn rules;
- a visible voice signature and varied representative moves;
- expected compacted-trace signatures;
- expected DAG/proof-path behavior;
- repair behavior after correction;
- a discrimination gate against the diligent control.

The auto-eval runner renders these contracts into the learner prompt and stores
a contract summary in the report config. This keeps the profile prompt, report,
and discrimination audit tied to the same schema.

Contract v1 through v4 are successive schemas for the same named profile
registry, not parallel sets of selectable learners. V4 adds visible voice
signatures without changing the profile IDs or their measurement targets. Only
v4 is active in the current code. Historical run artifacts retain their
original schema version so earlier evidence remains reproducible.

The profile library is now split by purpose rather than treated as one default
factorial set:

- `core`: routine policy robustness across the ordinary learner profiles
  (`diligent`, `answer_seeking`, `skeptical`, `overconfident`, `low_agency`,
  `memory_limited`);
- `sentinel`: cheap discrimination screen (`diligent`, `proof_skipper`,
  `false_memory`, `affective_resistant`);
- `stress`: targeted failure-mode probes (`premature_closure`,
  `proof_skipper`, `false_memory`, `contradiction_keeper`,
  `affective_resistant`, `low_trust_skeptic`, `counterexample_hunter`,
  `goalpost_shifter`, `bored`, `frame_defiant`, `fast_learner`, and
  `slow_learner`);
- `audit`: expensive all-profile sweep. The older `all` spelling is still
  accepted as an alias, but it should not be used for routine policy
  comparisons.

This cleanup keeps the ordinary QA matrix from inflating into every learner
contract every time. Use `core` to ask whether a policy is robust under ordinary
profile variation, `sentinel` to ask whether the profile schema is separating
behavior at all, `stress` to probe specific failure modes, and `audit` only as a
periodic full-library check.

The human mixed-learner interface applies the same separation without exposing
evaluation-suite machinery: `/profile list` shows the six ordinary/core choices,
`/profile list stress` shows the twelve specialist failure modes, and `/profile
list all` shows the complete v4 registry of eighteen profiles.

Policy suites follow the same convention:

- `controls`: `negative`, `bland`, and `random` for calibration;
- `core`: routine baseline plus the main discrete adaptive policies
  (`bland`, `dynamic`, `state`, `field`, `trajectory`,
  `dynamical_system`, `empirical_dynamical_system`);
- `pressure`: `field,negative`, the cheap pressure-sensitive screen for
  affective-resistance checks;
- `sentinel`: `bland,field,trajectory,dynamical_system,negative`, the compact
  five-policy ladder for an `n=3` profile-discrimination comparison;
- `adaptive`: adaptive policies only, without same-run controls;
- `frontier`: `bland` plus the field/trajectory/dynamical and continuous
  policies for comparing increasingly rich state maps;
- `audit`: every policy. The older `focused` spelling aliases `core`; `full`
  and `all` alias `audit`.

Recommended combinations:

- `--profile-suite sentinel --suite pressure` before larger profile work;
- `--profile-suite sentinel --suite sentinel --runs 3` for the representative
  60-dialogue comparison after the cheap screen passes;
- `--profile-suite core --suite core` for routine policy robustness;
- `--profile-suite stress --suite frontier` for targeted expensive probes;
- `--profile-suite audit --suite audit` only for periodic full sweeps.

Compacted traces use `machinespirits.tutor-stub.compacted-trace.v2`. They remove
raw transcript bulk and retain behavior-bearing features: classifier labels,
conceptual/readiness scores, proof-DAG counters, bottlenecks, field state, and
policy/register metadata. The profile discrimination analyzer compares profile
vectors with cosine similarity.

Initial gate:

- average pairwise cosine below `0.85`;
- max similarity to `diligent` below `0.90`.

## Phase 2 resistant-profile extension (design only)

The `bored` and `frame_defiant` contracts extend the v4 registry without
changing the established `low_agency` or `overconfident` contracts. Their
serialized contracts and rendered behavior prompts are pinned by SHA-256
regression tests, and the historical outcome-study driver remains closed to
exactly those two established profile IDs.

The new profiles add deterministic behavior-only markers during compact-trace
construction:

- `boredWithholding` requires public flatness, clock-watching, or explicit
  boredom without permission-seeking or an expanded contribution. One short
  literal answer to an adjacent concrete hook remains compatible with the
  marker;
- `frameJurisdictionDispute` requires a public dispute about who may set the
  premise, question, exercise, rule, or test. Evidence skepticism, source
  distrust, counterexamples, goalpost movement, pressure complaints, and
  mockery do not satisfy it.

These markers support zero-call observability gates. A separate design-shadow
warrant can project a matched public observation into a typed pedagogical move:
one adjacent concrete discriminating question for boredom, or a bounded test
of the distinction between frame consent and local merits for frame defiance.
Profile identity alone licenses nothing. The shadow cannot select a runtime
move, switch a consumer, choose a register, authorize a paid call, or establish
that either new profile is empirically discriminating. Those claims require a
later registered study.

The zero-call protocol for that next gate is now frozen at
`docs/tutor-stub-resistant-profile-discrimination-registration.md`, with its
machine authority in
`config/tutor-stub-resistant-profile-discrimination-registration.v1.json`.
It specifies 18 equal-horizon dialogues: six profiles (`diligent`,
`low_agency`, `bored`, `skeptical`, `low_trust_skeptic`, and
`frame_defiant`) under one `field` treatment, the safe register palette, and
three repeats. The analyzer must enforce both the pooled cosine gate and the
new profiles' declared nearest-neighbour gates. This registration and its dry
plan were engineering evidence only at registration time; the later bounded
execution and its post-hoc instrument audit are recorded below.

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

The contract-v2 implementation then added explicit observability clauses,
controlled `omits_warrant` and `distorts_public_evidence` labels, deadline and
recurrence checks, and bounded learner-draft repair when a required profile
marker was absent. Reprocessing the earlier matching 60-row run with the v2
analyzer establishes the pre-change baseline:

- artifact root:
  `.tutor-stub-auto-eval/profile-policy-discriminating-n3-live-2026-07-09T12-03-17`;
- profiles: the four sentinel profiles; policies:
  `bland,field,trajectory,dynamical_system,negative`; `n=3`;
- pooled average cosine `0.924`, max similarity to diligent `0.964`;
- matched-policy macro average cosine `0.894`;
- all three stress-profile contract gates failed.

An `n=3` negative-pressure calibration using complete traces from the bounded
contract-v2 pilots then passed:

- combined analysis root:
  `.tutor-stub-auto-eval/profile-contract-v2-negative-confirmatory-mixed-n3-2026-07-10`;
- traces: `12` dialogues and `96` learner turns, three per profile;
- pooled average cosine `0.679`, max similarity to diligent `0.806`;
- `proof_skipper`: marker recurrence `0.667`, deadline `3/3`;
- `false_memory`: marker recurrence `0.542`, deadline `3/3`;
- `affective_resistant`: eligible-pressure recurrence `0.571`, deadline `3/3`;
- result: pooled and contract-conditioned gates both passed.

This last artifact combines complete profile traces from adjacent calibration
roots because the final all-in-one retry hit the external Codex usage limit.
It is therefore a go/no-go calibration, not the final comparative result. The
next test is the same five-policy matrix at `n=3` under one code snapshot and
one artifact root. Its dry run is recorded at
`.tutor-stub-auto-eval/profile-policy-sentinel-v2-n3-dry-2026-07-10`: 60 dry
rows and all 20 profile-policy cells reached the consolidated QA report.

### Contract v3 frozen-control confirmation

The follow-up contract-v3 run freezes the discriminating learner subset and
tests it across four policy treatments under one model and code snapshot:

- artifact root:
  `.tutor-stub-auto-eval/profile-v3-frozen-control-n3-live-2026-07-10T12-09Z`;
- profiles: `diligent`, `false_memory`, `proof_skipper`;
- policies: `dynamic,dynamical_system,field,negative`; `n=3`;
- observed trace provenance: `codex.gpt-5.6-terra` for tutor, classifier/DAG,
  and automated learner on all `36` dialogues and `288` learner turns;
- pooled average cosine `0.737`, max similarity to diligent `0.699`;
- matched-policy macro average cosine `0.711`, max matched-policy similarity
  to diligent `0.712`;
- `false_memory`: recurrence `0.573`, deadline `12/12`, max control cosine
  `0.712`;
- `proof_skipper`: recurrence `0.760`, deadline `12/12`, max control cosine
  `0.640`;
- result: pooled and both contract-conditioned gates pass.

The behaviors are not solely products of bounded adherence repair.
`false_memory` passed natively on `27/40` required turns and needed `13`
single-repair turns; `proof_skipper` passed natively on `38/43` required turns
and needed `5` repaired turns (`6` total attempts). Their dominant mechanisms
also differ: `false_memory` produced `55` public-evidence distortions, while
`proof_skipper` produced `62` evidence overleaps. The closest stress-profile
pair remains `false_memory` versus `proof_skipper` at cosine `0.861`, so the
profiles are discriminable rather than perfectly orthogonal.

The short cap also produced an outcome ordering consistent with the intended
failure operators: mean final coverage was `0.167` for diligent, `0.111` for
false memory, and `0.125` for proof skipping; mean missing premises were
`5.000`, `5.333`, and `5.250`. These are descriptive mechanism-check outcomes,
not closure-effect estimates.

The original QA plan recorded requested `codex.gpt-5.5` defaults, but the
authoritative `run_start` events show that this completed run used
`gpt-5.6-terra`; child model flags had not yet been forwarded when the run
started. Profile-discrimination reports now print observed tutor, analysis,
and learner models from trace metadata. A true GPT-5.5 rerun is optional
cross-model robustness work, not required to establish the current profile
divergence result.

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

Run the representative `n=3` matrix after the pressure screen passes:

```bash
npm run tutor:stub:qa -- \
  --suite sentinel \
  --profile-suite sentinel \
  --runs 3 \
  --turns 8 \
  --safety-turns 80 \
  --parallelism 4 \
  --trace-dir .tutor-stub-auto-eval/profile-policy-sentinel-v2-n3-live \
  --world world_005_marrick \
  --cli-effort low \
  --history-turns 4 \
  --max-tokens 4096 \
  --keep-going
```

Once discrimination holds, run the outcome-headroom contrast — the first
policy comparison where adaptive-vs-bland differences can register on the
outcome channels rather than on register diversity. The `headroom` suite
defaults to the sentinel profiles, until-grounded stopping, and a binding
`--safety-turns 40` cap, so grounding rate and turns can actually vary by
policy instead of saturating at the release-schedule floor:

```bash
npm run tutor:stub:qa -- \
  --suite headroom \
  --runs 3 \
  --parallelism 4 \
  --trace-dir .tutor-stub-auto-eval/headroom-contrast-n3-live \
  --world world_005_marrick \
  --cli-effort low \
  --history-turns 4 \
  --max-tokens 4096 \
  --keep-going
```

The consolidated `qa-matrix.md` now ranks policies by the outcome-only score
(reliability, closure, coverage, turn efficiency, leak discipline); register
diversity is reported as a separate process column and never enters the
ranking or the baseline deltas.

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

Once the sentinel passes, run the `core` or `frontier` QA matrix and treat
policy effects as more credible because they survived realistic learner
variation. Reserve `audit` for periodic full-library checks.

## Phase 2 resistant-profile result and instrument audit

The registered 18-dialogue Luna study did not pass its co-primary conditioned
gate. That failure remains the authoritative study result. A later zero-call,
turn-level engineering audit found two prospective measurement defects; it
does not retrospectively change the result or any frozen threshold.

- The `bored` contract permits one brief literal answer to an adjacent concrete
  hook, but the observer formerly rejected any flat reply that the generic
  classifier called content-bearing. Recompacting the exact 18 source traces
  with the corrected prospective observer recognizes all 24 bored turns,
  including minimal direct answers and terminal flat cues, while still
  rejecting expanded inference chains and permission seeking.
- The behavior vector now includes the existing `boredWithholding` and
  `frameJurisdictionDispute` public markers instead of using them only for the
  recurrence gate.
- A declared nearest-neighbour result is now evaluable only when both the
  expected anchor and any different observed-nearest anchor meet the target
  profile's unchanged signature floor. On the frozen corpus `low_agency`,
  `skeptical`, and `low_trust_skeptic` miss the `0.40` floor, so both new-profile
  nearest-neighbour results correctly fail closed as unevaluable.

The prospective replay preserves the 18/18 assembly and pooled pass, repairs
the boredom observability mismatch, and leaves the overall result failed at
the anchor-validity boundary. A fresh study may be registered only after this
instrument change is merged and pinned; the old authorization, traces, and
canonical report cannot be retried, resumed, or rewritten.

The subsequent fresh 18-dialogue measurement recheck was technically complete
(`144` turns, `462` model attempts, no retry or resume) and again produced a
valid negative result. Bored passed its own signature, recurrence, and cosine
bounds, but its expected `low_agency` anchor failed the unchanged signature
floor (`0.167` versus `0.40`) and diligent was nearest. Frame defiance passed
its own signature, recurrence, and cosine bounds, but diligent rather than
skeptical was nearest. The frozen report remains authoritative at SHA-256
`39b8c107eedd5c48cfd2a6aca79ec9a9503ffc07391555d53f254a73bbe2e6d3`.

An exact-turn, zero-call examination found that the registered geometry was
mixing distinct resistance questions. In particular, `low_agency` turns often
publicly asked the tutor to choose the next object or authorize the next move
while the generic participation classifier labelled the same turn `steering`.
Frame-defiant turns visibly disputed jurisdiction, bored turns visibly
withheld effort but sometimes supplied competent evidence, and the evidence
skeptic and low-trust skeptic remained nearly collinear under the generic
vector. This supports a prospective measurement correction, not a
reinterpretation of either negative result.

The analyzer therefore now emits five additive, orthogonal public axes:

- `effort_investment`: public effort withholding;
- `learner_authorship`: public deference of the next choice to the tutor;
- `evidential_orientation`: challenge to an evidence-to-claim warrant;
- `epistemic_trust`: public distrust of the tutor's or authority's epistemic
  contribution; and
- `frame_legitimacy`: dispute over who may set the question, test, or frame.

These axes are `calibration_only`: they do not change the registered `v4`
cosine or conditioned gate, produce no replacement pass/fail verdict, and
report old compacted traces without the new marker fields as incomplete rather
than zero. They remain upstream of the typed pedagogical-move boundary. A
future held-out discrimination study would need a new frozen axis hypothesis
and thresholds; profile identity still cannot select either a move or a tonal
register.

Recompaction of the exact frozen `144` turns with this prospective observer is
complete and leaves the registered gate failed. The calibration rates are:

| Profile | Effort withholding | Tutor-choice deference | Warrant challenge | Authority distrust | Frame dispute |
| --- | ---: | ---: | ---: | ---: | ---: |
| diligent | 0/24 | 1/24 | 3/24 | 0/24 | 0/24 |
| bored | 16/24 | 0/24 | 0/24 | 0/24 | 0/24 |
| low_agency | 0/24 | 23/24 | 1/24 | 0/24 | 0/24 |
| skeptical | 0/24 | 0/24 | 23/24 | 0/24 | 0/24 |
| low_trust_skeptic | 0/24 | 0/24 | 23/24 | 5/24 | 0/24 |
| frame_defiant | 0/24 | 0/24 | 2/24 | 0/24 | 22/24 |

This is useful calibration evidence, not a new endpoint. It confirms strong
public separation for boredom, tutor-choice deference, and frame legitimacy.
It also shows the intended nested structure of skepticism: both skeptical
profiles challenge warrants, while low trust adds an authority-distrust signal
on only `5/24` turns. Whether that additional signal is sufficiently recurrent
for a new held-out contract is an interpretation and design decision that must
precede any fresh authorization.
