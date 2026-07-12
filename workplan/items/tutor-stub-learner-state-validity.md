---
id: tutor-stub-learner-state-validity
title: Validate adaptive-tutor learner-state predictions
status: active
type: research
priority: P1
owner: codex
source: review
created: 2026-07-11
updated: 2026-07-12
verification: "Benchmark v2 uses the canonical policy-invariant no-memory/no-register DAG/field/last-four sensor; crosses Marrick, Hethel, and Ravensmark with two independent latent kernels and two language-model families; evaluates a no-state -> lean-DAG -> DAG-trajectory -> field-trajectory ladder against no-state, training-fold class-prior, uniform, matched stale, descriptive-only scramble, and oracle controls on two harness-owned targets; and seals an untouched world/generator/realizer-transfer verdict at the fixed 8-per-cell confirmation size."
claim_status: planned
depends_on:
  - adaptive-eval-immutable-provenance
links:
  notes:
    - PLAN_4_0/2026-07-11-adaptive-tutor-implementation-plan.md
  runs:
    - adaptive-state-v2-s0-clean-5a3e5aae-v21
    - adaptive-state-v2-s1-technical-5a3e5aae-v21
    - adaptive-state-v2-s1-technical-b69775b6-v21
    - adaptive-state-v2-s1-repair-bb65da27-v21
    - adaptive-state-v2-observability-preflight-5fda0824-v21
    - adaptive-state-v2-observability-preflight-8d6d2b22-v21
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
