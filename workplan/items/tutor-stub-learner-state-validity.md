---
id: tutor-stub-learner-state-validity
title: Validate adaptive-tutor learner-state predictions
status: active
type: research
priority: P1
owner: codex
source: review
created: 2026-07-11
updated: 2026-07-13
verification: "Benchmark v2 uses the canonical policy-invariant no-memory/no-register DAG/field/last-four sensor; crosses Marrick, Hethel, and Ravensmark with two independent latent kernels and two language-model families; evaluates a no-state -> lean-DAG -> DAG-trajectory -> field-trajectory ladder against no-state, training-fold class-prior, uniform, matched stale, descriptive-only scramble, and oracle controls on two harness-owned targets; and seals an untouched world/generator/realizer-transfer verdict at the fixed 8-per-cell confirmation size."
claim_status: planned
depends_on:
  - adaptive-eval-immutable-provenance
links:
  notes:
    - PLAN_4_0/2026-07-11-adaptive-tutor-implementation-plan.md
    - PLAN_4_0/2026-07-12-adaptive-state-observability-reliability-protocol-v2.2.md
    - PLAN_4_0/2026-07-12-adaptive-state-exact-channel-protocol-v2.3.md
    - PLAN_4_0/2026-07-13-preconscious-arc-stocktake-and-final-stretch.md
    - PRECONSCIOUS-FINAL-STRETCH-PLAN.md
  runs:
    - adaptive-state-v2-s0-clean-5a3e5aae-v21
    - adaptive-state-v2-s1-technical-5a3e5aae-v21
    - adaptive-state-v2-s1-technical-b69775b6-v21
    - adaptive-state-v2-s1-repair-bb65da27-v21
    - adaptive-state-v2-observability-preflight-5fda0824-v21
    - adaptive-state-v2-observability-preflight-8d6d2b22-v21
    - adaptive-state-v2-observability-preflight-c0ccd5c9-v21
    - adaptive-state-v2-s0-structural-support-2dd039c5-v21
    - adaptive-state-v2-observability-preflight-985bd542-v21
    - adaptive-state-v2-observability-reliability-4133d7ff-v22
    - adaptive-state-v2-s0-exact-channel-346e472a-v23
    - adaptive-state-v2-s1-canonical-pilot-bd8f47ec-v23
tags:
  - adaptive-tutor
  - learner-state
  - calibration
  - held-out-evaluation
milestone: adaptive-tutor-evidence-v1
branch: codex/adaptive-tutor-implementation
---

Implement Phase 2 of the linked plan. Validate the sensor before optimizing a
policy against it; fields that do not add held-out predictive value are demoted
to visualization rather than retained by architectural preference.

2026-07-11 Codex: Added the policy-invariant public-state adapter, frozen lean
difficulty-aware comparator, aligned placebos/ablations, grouped held-out
metrics, sealed benchmark exporter/analyzer, and deterministic fixtures. The
card remains active until multi-world latent-generator data clear or fail the
sensor gate; current engineering fixtures are not empirical evidence.

2026-07-11 Codex: Added sealed A21 and exact DAG-dropout formal instruments,
cross-dialogue placebos, paired whole-dialogue bootstrap intervals, and an
explicit independent latent-generator gate. The bounded formal fixture returns
`not_passed / do_not_optimize_policy`; authentic learner data remain unavailable.
This is a valid stop signal for policy optimization, not a human-learning claim.

2026-07-11 Codex audit: Strengthened the common lean comparator so every
representation receives the same byte-identical public evidence text, stable
evidence ID, type, source, task difficulty, and missingness block. Re-running
the sealed 12-row formal instrument still returns
`not_passed / do_not_optimize_policy`. The report now calls its statistical
floor `claim_grade_settings`; that phrase describes bootstrap/calibration
settings only, never the evidence or sensor status.

2026-07-11 Codex correction: The 12-row v1 result did not test the canonical
policy-invariant sensor. It lacked a true no-state baseline and last-four trajectory, confounded
generator with model/source labels, repeated the same rows across holdout
summaries, and included degenerate/world-local targets. Its correct verdict is
"v1 proxies not promotable," not "the canonical sensor is invalid."

2026-07-11 Codex: Extracted a shared policy-invariant DAG/field/risk trajectory into a
shared pure service, persisted that projection in benchmark observations,
preserved missing observations instead of converting them to false zero movement,
and added parity tests. This freezes the benchmark sensor, not equivalence to the
memory/register-enriched live default; deployment requires a separate integration
parity bridge. Added the versioned v2 critical-path plan:
three geometries × two transition kernels × two model-family realizers, two
primary harness targets, nested representations with byte-equal recipient
common input, strict oracle/proof-transition provenance, separate transfer
lanes, 24-dialogue free contract stage, 24-dialogue paid technical pilot, and a
fixed confirmation size of eight per cell. The planner is an immutable
planning transaction; the generalized cross-world kernels, sequential realizer
executor, and v2 dataset have not yet run, so the card remains active and no new
sensor verdict exists.

2026-07-12 Codex: Implemented the generalized Marrick/Hethel/Ravensmark
durable-state and DAG-dropout kernels plus the sealed Stage-0 executor. The
canonical clean-tree run `adaptive-state-v2-s0-clean-18293291` at commit
`182932911cd3834666d9b6b5d37c8661d9d11790` passed: 24 dialogues, 144 scored
transitions, exact replay, all controls legal, zero model calls, and the oracle
beat no-state on both metrics for both targets. Dataset SHA-256 is
`08c09840af22e7c3e8c5209494e27f36ff5b1380c352e3d41837e2b5dbe6aa9a`; report
SHA-256 is `69311d0d01274c2c08eff32a605423b6ccca493e79e859fce0003b4ff6654068`.
This is a plumbing/instrument pass, not a sensor verdict. A pre-paid audit found
that the original S1 kernel-authored observation path made the language-model
realizer axis inert; S1 remains blocked until protocol 2.1 routes every
utterance through the shared live public text-to-classifier/DAG analyzer and
freezes the resulting doubled call budget.

2026-07-12 Codex protocol 2.1 amendment: The clean
`adaptive-state-v2-s0-clean-18293291` artifact is retained only as a historical
plumbing pass. It is not promotion-eligible because the source/config hashes and
gate contract changed. A fresh sealed S0 must pass before any paid S1. The
amended instrument requires the oracle and every candidate to beat three fixed
state-blind baselines (`no_state`, training-fold-only Laplace-smoothed
`class_prior`, and exact `uniform`). Matched stale controls remain inferential;
donor-linked scramble controls are wiring/descriptive checks only. Richer rungs
must improve both co-primary targets, uncertainty clusters on latent pairs, and
the fixed eight-per-cell S2 makes no power or population-world claim.

2026-07-12 Codex final execution record: Fresh sealed S0
`adaptive-state-v2-s0-clean-5a3e5aae-v21` at `5a3e5aae` passed with zero model
calls, 24 dialogues, and 144 transitions. Dataset/report SHA-256 values are
`5364a5210675b1f0770dc7db39f130fb783e052c37c45f9c603cc3372a953720`
and `10fd8330849e4998dbe267c432a8376a7158a337e6c27dc53beb8f9c943b817b`;
design/canonical-config/config-file SHA-256 values are
`02cd3acf58f4fac7e06c13fe5082bc4ad0442868d51a3a80783b8221c015a87f`,
`e085f5f88539c8e124f05c7ffc9d3290f74e04972ad0bcbfffcec47c3fff015e`,
and `bc49c1b02cfb8e8f75b452915200d674bea904b2991ca07d349aff7f5683d08f`.
The first S1 schema-canary run stopped fail-closed after 1/339 dispatches. The
full `b69775b6` S1 completed 339/339 and sealed
`stop / stop_and_repair_s1`: exact event-family recovery was `0.395833`
(durable `0.333333`, dropout `0.458333`, Claude `0.361111`, Codex `0.430556`).
This is a measurement stop, not a learner-state or efficacy verdict.

2026-07-12 Codex repair record: `6d40a1ba` added the benchmark-only explicit
transition/evidence-span and prior-public-state repair; `bb65da27` bound the
saved row/observation/analyzer artifacts, reconstructed prior states, and
sealed supersession lineage. The superseding run
`adaptive-state-v2-s1-repair-bb65da27-v21` stopped technically after 73 reached
and dispatched, 72 completed, one failed, and four completed dialogues because
the analyzer returned a non-exact learner-text evidence span. It produced no
scientific result; partial rows are not reusable. S2 was not run and remains
fail-closed.

2026-07-12 Codex next gate: Before any new 339-call S1, run exactly 24
claim-ineligible isolated turns balanced as 3 worlds × 4 event families × 2
realizers, with retract/derive/adopt/none represented once in every
world/realizer combination and exact-span enforcement active. Keep this card
`active` with `claim_status: planned`; policy optimization, Phase 6B,
shadow-pilot, efficacy, and human-learning claims remain blocked. Phase 6A
v2.1 canary-lineage engineering is committed at `1e106783`; no new paid Phase
6 execution occurred.

2026-07-12 Codex observability-preflight result: Commit `5fda0824` added the
immutable fail-closed gate and made it a mandatory parent of any later full S1.
The sealed paid run `adaptive-state-v2-observability-preflight-5fda0824-v21`
completed all 24 isolated cases and 48/48 serial CLI dispatches with zero
technical failures, retries, rerolls, repairs, fallbacks, exclusions, partial
reuse, or learner-text event-ID leaks. Exact evidence-span validation passed
24/24, but intended-family recovery was only 19/24, so the frozen decision was
`stop_and_repair_observability_preflight` and S1 retry eligibility remained
false. Recovery was derive 6/6, retract 6/6, adopt 4/6, and none 3/6; Claude
passed 10/12 and Codex 9/12. All five mismatches were observed as `derive`:
both Marrick `none` turns, Codex Ravensmark `none`, and both Hethel `adopt`
turns. They are not interchangeable analyzer errors: the Marrick turns voiced
genuine new conclusions, the Ravensmark turn was only an insufficiency
statement, and the Hethel evidence surface itself bundled a causal conclusion
into the premise being adopted.

2026-07-12 Codex next gate after the stop: Do not lower the 24/24 threshold,
reuse this label, or expose harness targets to the analyzer. First freeze and
regression-test the public transition ontology without relabeling genuine
derivations: make `none` fixtures start with no unvoiced derivable fact (or put
those facts in the prior voiced state), classify pure insufficiency as `none`,
and give `adopt` a premise-only surface rather than one that already states a
rule consequence. Preserve the five failed outputs as regression cases, add
transition-clean replacements, then run a fresh-label 24-case preflight with
the same matrix and zero-repair rules.
The 339-call S1, S2, policy optimization, Phase 6B, shadow pilot, efficacy, and
human-learning claims remain blocked.

2026-07-12 Codex second preflight repair: Commit `8d6d2b22` froze the five
prior mismatches, settled `none` fixtures by pre-voicing supported derivations,
isolated Hethel's premise-only `adopt` surface through a provider-neutral
hash-guarded projection shared by preflight and S1, and made pure epistemic
insufficiency explicitly non-derivational. The shared projection is included in
both preflight and S1 static contracts. Zero-call verification passed 114/114
adaptive-state tests and the full 5,265-test repository suite with zero failures
(one expected skip); the sealed S0 and stopped-S1 ancestors revalidated before
launch.

2026-07-12 Codex second observability-preflight result: The sealed paid run
`adaptive-state-v2-observability-preflight-8d6d2b22-v21` completed 24/24 cases
and 48/48 unique serial CLI dispatches at clean pushed SHA `8d6d2b22`, with
every call successful on one attempt and zero retries, semantic rerolls,
repairs, fallbacks, exclusions, partial reuse, invalid stream lines, tool
events, or learner-text event-ID leaks. Exact spans passed 24/24. Exact-family
recovery improved from 19/24 to 22/24 (`0.916667`): `none`, `adopt`, and
`retract` passed 6/6; `derive` passed 4/6; each realizer passed 11/12; Hethel
passed 8/8 and Marrick/Ravensmark 7/8. The run validly sealed
`stop_and_repair_observability_preflight`; `s1_retry_eligible` remains false.
Report SHA-256 is
`b89390acca11a6d7a73977c1dc71406529d3ee7c7f6a83e5630a2bbebfd69b05`.

2026-07-12 Codex next gate after 22/24: Preserve both new failures as semantic
regressions. Marrick/Codex merely announced that an inference existed and
voiced no object-level fact, so `none` is correct for that text. Ravensmark/
Claude did voice the supported intermediate `materialSealAtIssue` proposition
before adding a later signer clause with a missing holder premise; the analyzer
must retain the supported `derive` and record the later step as proof debt.
Make `derive` realization forbid generic meta-inference wording, and make
analysis clause-wise without exposing harness targets or accepting unsupported
claims. Only after that zero-call repair passes may another complete fresh-label
24-cell preflight run. The full S1, S2, policy optimization, Phase 6B,
shadow-pilot, efficacy, and human-learning claims remain blocked.

2026-07-12 Codex third preflight repair: Commit `c0ccd5c9` froze the two
second-preflight derive failures in a self-contained, hash-verified fixture,
required realizers to voice one concrete supported object-level conclusion,
and made analyzer recovery clause-wise so a supported intermediate derivation
survives beside a later unsupported clause. These shared realizer/analyzer
sources were already bound into both preflight and S1 static contracts. Focused
verification passed 55/55, adaptive-state verification passed 115/115, and the
full repository suite passed 5,228 tests with one expected skip. The sealed S0
and stopped-S1 ancestors revalidated before launch.

2026-07-12 Codex third observability-preflight result: The sealed paid run
`adaptive-state-v2-observability-preflight-c0ccd5c9-v21` completed 24/24 cases
and 48/48 unique serial CLI dispatches at clean pushed SHA `c0ccd5c9`, with
zero technical failures, retries, semantic rerolls, repairs, fallbacks,
exclusions, partial reuse, invalid stream lines, prohibited tool events, or
learner-text event-ID leaks. Exact-family recovery improved to 23/24
(`0.958333`): `none`, `adopt`, and `retract` passed 6/6; `derive` passed 5/6;
Codex passed 12/12 and Claude 11/12; Marrick and Hethel passed 8/8 and
Ravensmark 7/8. The sole mismatch was
`preflight__ravensmark__derive__claude_sonnet`, observed as `none`. The run
validly sealed `stop_and_repair_observability_preflight` with
`s1_retry_eligible: false`. Report SHA-256 is
`f00768748f653f1033b62525ae3f5d036784febc82655ade57bd735f6d701dbe`.

2026-07-12 Codex next gate after 23/24: Stop further ad hoc prompt tuning and
do not launch another paid preflight or full S1. Preserve the exact
Ravensmark/Claude output and analyzer record, then audit without model calls
whether the scope-level `materialSealAtIssue` target is semantically separable
in public language from its released `sealMarkOf` premise. Any target, fixture,
ontology, or public-language repair must apply to full S1, remain blind to the
harness target at runtime, and trigger a fresh S0 if it changes the sealed
world/kernel/target/config contract. The 24/24 gate, no-reuse rule, and all S1,
S2, policy-optimization, Phase 6B, shadow-pilot, efficacy, and human-learning
blocks remain unchanged.

2026-07-12 Codex separability audit and replacement S0: The exact third-run
failure was frozen and audited without model calls. Ravensmark rule `R1_scope`
was found unsuitable as a separately observable learner event because its unary
scope conclusion can be ordinary-language-equivalent to its released premise.
Commit `2dd039c5` retains it as validated structural proof support while moving
the shared preflight/S1 derive target to the distinct two-premise relation
`pressedSealFor(gatePass,elian)`. Because this changed the kernel/config
contract, fresh S0 `adaptive-state-v2-s0-structural-support-2dd039c5-v21`
passed and sealed with 24 dialogues, 144 transitions, and zero model calls.
Commit `985bd542` separately binds the original S0 to its stopped S1 and the
replacement S0 to current work, without reusing any paid row or call. Focused
verification passed 52/52, adaptive-state verification passed 130/130, and the
full suite passed 5,224 tests with one expected skip.

2026-07-12 Codex fourth observability-preflight result: The sealed paid run
`adaptive-state-v2-observability-preflight-985bd542-v21` completed 24/24 cases
and 48/48 unique serial CLI dispatches at clean pushed SHA `985bd542`, with no
technical failure. Exact-family recovery remained 23/24 (`0.958333`): `none`,
`adopt`, and `retract` passed 6/6; `derive` passed 5/6; Claude passed 12/12 and
Codex 11/12; Marrick and Hethel passed 8/8 and Ravensmark 7/8. Claude correctly
voiced and the analyzer recovered the new Ravensmark derive target. Codex
instead wrote “The dusk-seal on the pass was held by Elian,” merely restating
the released holder premise while its sidecar claimed `derive:inference_03`;
the analyzer correctly returned `none`. The run sealed
`stop_and_repair_observability_preflight`, `s1_retry_eligible: false`. Report
SHA-256 is
`5b887f222419ce7944d477b3cb875ad1bebaa7080136e99dc889ba6d0398203c`.

2026-07-12 Codex next gate after the fourth stop: The construct ambiguity is
resolved, but the v2.1 exact single-draw gate exposed a realizer-fidelity miss.
Do not prompt-tune, rerun, or launch full S1. Preserve the failed learner text,
sidecar, analyzer output, and seal, and conduct a zero-call prospective
protocol-governance review: either retain exact 24/24 single-draw realization
or preregister a new repeated-draw reliability design that keeps every failed
draw and forbids semantic rerolls. Do not choose a gate to rescue this stopped
result. S1, S2, policy optimization, Phase 6B, shadow pilot, efficacy, and
human-learning claims remain blocked.

2026-07-12 Codex v2.2 prospective reliability protocol: Option 2 is frozen
before any v2.2 model call. The new gate repeats each of the unchanged 24
world × event-family × realizer cells exactly three times, for 72 fresh cases
and 144 serial CLI dispatches. It reuses no prior row and retains every draw.
Pass requires at least 70/72 overall, 23/24 in every draw block and world,
2/3 in every base cell, 17/18 in every event family, and 35/36 for each
realizer, plus complete exact-span/leakage/one-dispatch integrity and zero
retry, reroll, repair, fallback, exclusion, or partial reuse. A technical
failure stops the immutable label; semantic mismatches remain in the fixed
denominator. The existing v2.1 23/24 result remains stopped and cannot be
reinterpreted. The implementation binds the new run to the replacement S0,
the sealed fourth v2.1 stop, current S1-relevant hashes, CLI fingerprints,
clean Git, and an immutable seal. A passing paid gate may authorize only a
separately invoked full S1; it cannot launch S1 itself and is not a sensor or
efficacy result.

2026-07-12 Codex v2.2 repeated-draw outcome: The frozen implementation was
committed and pushed at clean SHA `4133d7ff` after 125/125 adaptive-state tests,
5,289 passing full-suite tests with one expected skip, tracked-source lint, and
a no-write real-lineage dry run. Sealed paid run
`adaptive-state-v2-observability-reliability-4133d7ff-v22` completed 72/72 cases
and 144/144 serial CLI dispatches with zero technical failures and no retry,
reroll, repair, fallback, exclusion, or row reuse. Aggregate recovery met 70/72
(`0.972222`), and each draw block met 23/24, 23/24, and 24/24. The gate stopped
because both misses repeated in `ravensmark × derive × codex_terra`: that base
cell passed only 1/3, derive 16/18, Codex 34/36, and Ravensmark 22/24. Draws 1
and 2 repeated the holder premise and were correctly analyzed as `none`. Draw
3 was nominally analyzed as `derive`, but its possession paraphrase still did
not state the intended `pressedSealFor` action, exposing a family-level false
positive. The sealed decision is `stop_observability_channel_no_s1`,
`s1_retry_eligible: false`; report SHA-256 is
`987497dab7df085829c530432fe1ca3b38e8cfbf8d80ee91192272ba52a29f8f`.

2026-07-12 Codex next gate after v2.2: Do not rerun this protocol or tune prompts
against the failed cell. Preserve all 72 draws. Redesign the claim-bearing
instrument without calls so exact harness transitions are rendered
deterministically or checked programmatically before a family match can count;
keep LLM naturalness as a separate descriptive lane. Any successor must be a
new prospectively frozen version. Full S1, S2, policy optimization, Phase 6B,
shadow pilot, efficacy, and human-learning claims remain blocked.

2026-07-12 Codex v2.3 zero-call instrument redesign: Implemented a separate
claim-bearing exact public-event channel. Current adopt/derive/premise-retract
events now expose their exact public fact atom; both deterministic surface
templates must include that atom and pass a programmatic semantic-fidelity
assertion before entering the Stage-0 dataset. The exact Ravensmark fact
`pressedSealFor(gatePass, elian)` is covered by a regression that rejects all
three stopped v2.2 paraphrase patterns. Free-form Codex/Claude realization and
public-turn analysis are now a descriptive transfer lane only and cannot
rewrite, rescue, exclude, or promote claim-bearing rows. The successor
protocol also makes Phase 6B depend explicitly on a sealed canonical S2 pass
and a non-null winner. No model calls were made; a clean-SHA v2.3 S0 seal is the
next permitted execution. S1/S2 validity, policy optimization, Phase 6B,
shadow-pilot, efficacy, and human-learning claims remain blocked.

2026-07-12 Codex v2.3 S0 outcome: The implementation was committed and pushed
at clean SHA `346e472a`, then zero-call run
`adaptive-state-v2-s0-exact-channel-346e472a-v23` passed and sealed 24/24
dialogues, 144/144 scored transitions, and 168/168 semantically faithful
realized turns. Deterministic replay, leakage, crossed cells, donors, stale
controls, paired targets, nondegeneracy, convergence, and both oracle
sensitivity checks passed; the run used zero model calls. Dataset SHA-256 is
`e781beb4f51f876020d4e41dbd00606d8fffbfeb13db9daeb99224d71da78e61` and
report SHA-256 is
`e939ff171a0d2b2e85217a13cc6c7671de912b2d49134f126b37d80e1236023f`.
The inherited v2.1 report string `advance_to_s1_technical_pilot` is narrowed by
the frozen v2.3 contract to the zero-call canonical sensor pilot only; it does
not authorize the old paid S1. No sensor winner exists yet, so policy
optimization, Phase 6B, shadow-pilot, efficacy, and human-learning claims
remain blocked.

2026-07-12 Codex v2.3 canonical-pilot freeze: Before analyzing the sealed S0
rows, froze and implemented a zero-call directional screen using the inherited
fixed head, paired latent-cluster bootstrap, all three held-out lanes, three
state-blind baselines, matched stale controls, calibration floors, and the
lean-DAG -> DAG-trajectory -> field-trajectory hierarchy. Synthetic tests prove
both pass and fail-closed paths. Even a pass can only nominate the richest
passing S2 confirmation candidate and authorize S2 implementation; it cannot
name a validated winner, launch S2, or open policy optimization. The canonical
pilot data remain uninspected until this implementation is committed and pushed
from a clean tree.

2026-07-12 Codex v2.3 canonical-pilot outcome: The pre-analysis implementation
was committed and pushed at `e68b5ee0`. A first launch stopped before artifacts
or dataset access on an invalid optional run-plan field; `bd8f47ec` repaired the
field and strengthened dry-run to validate the full evidence plan. Clean sealed
run `adaptive-state-v2-s1-canonical-pilot-bd8f47ec-v23` then completed with zero
model calls, 24 dialogues, 144 transitions, 12 independent latent clusters,
84/84 converged heads, and a passing oracle instrument. The learner-state screen
stopped: lean DAG was worse than no-state on both targets (log-loss `-0.5212`,
`-0.5013`; Brier `-0.0485`, `-0.0674`), improved both targets in only one world
and neither held-out generator, and the richer rungs were worse still and did
not clear matched-stale/incremental evidence. Exact-renderer transfer was
positive but cannot rescue world/generator failure. The sealed decision is
`do_not_run_canonical_s2`, with no confirmation candidate, no validated winner,
and policy optimization blocked. Report content SHA-256 is
`a9f01ae60173e4e9eaa20141e8e83c8b8400c137acbe9f9ffe7c3f8a60d4673a`.

2026-07-13 Claude: Final-stretch sanction (PRECONSCIOUS-FINAL-STRETCH-PLAN.md
Step 1). This card absorbs the two zero-call successors, both behind a fresh
prospective v2.4 contract frozen before any analysis: (1a) the P0
error/decomposition audit the v2.3 stop itself named — target predictability
from the fixed action schedule alone, feature dimensionality/regularization at
144 transitions, world-specific encoding (why only Hethel improved), per-kernel
failure modes — emitting a classification of the sensor null as
representation_carries_nothing / data_starved / world_confounded; (1b) the
active-sensing value-of-information study — the benchmark holds tutor actions
fixed by design, so choosing moves for what they reveal is untested; the
kernels' captured oracle distributions make per-action posterior-entropy
reduction over latent state exactly computable with zero calls — emitting
close_sensor_program_on_substrate / graduate_active_sensing_to_paid /
inconclusive_data_starved. Neither study may rescue, reinterpret, or
re-analyze any stopped row for promotion. Evidence durability: the sealed S0
exact-channel and S1 canonical-pilot runs are now packaged
(config/adaptive-tutor-evidence/adaptive-state-v2-s0-exact-channel-346e472a-v23-06f76257057c.manifest.json,
…-s1-canonical-pilot-bd8f47ec-v23-4df8541873c3.manifest.json) with archives in
artifacts/adaptive-tutor-runs/ and copies in
~/.machinespirits-data/runs/adaptive-tutor/.
