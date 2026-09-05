# Superego critique causal replay

Status: prospective design, awaiting review and explicit GO; **not authorized to
launch**. GO approves this study only. The user separately authorizes launch.
Workplan item: `superego-critique-causal-replay`.

## Question and evidence

Does supplying a draft's actual critique increase fulfillment of that critique,
relative to a generic revision instruction? Does matching the critique to its
own draft matter, and what happens to public-output quality?

The historical sources are PRs #1017 and #1018, especially
`workplan/items/superego-critique-causal-link-followup.md`,
`notes/2026-09-04-superego-critique-causal-followup.md` and its JSON companion.
Their results, traces and database rows remain immutable. The historical
lexical association does not provide a causal effect size or a semantic power
estimate. No historical outcome is used to select this prospective sample.

The executable settings below are read directly by the runner. This is the one
study design; amendments edit it in place. Git records changes; no source or
design digest is an authorization condition.

```yaml study
id: superego-critique-causal-replay
master_seed: 20260905
sample_size: 194
source_ledger: notes/2026-09-04-communication-topology-link-analysis.json
historical_followup: notes/2026-09-04-superego-critique-causal-followup.json
arms: [draft_only, generic_revision, actual_critique, matched_wrong_critique]
endpoint: https://openrouter.ai/api/v1/chat/completions
models:
  generator:
    model: nvidia/nemotron-3-nano-30b-a3b
    provider: DeepInfra
    provider_slug: deepinfra
    prompt_price_per_million: 0.05
    completion_price_per_million: 0.20
  semantic_a:
    model: openai/gpt-5.4
    provider: OpenAI
    provider_slug: openai
    prompt_price_per_million: 2.50
    completion_price_per_million: 15
  semantic_b:
    model: anthropic/claude-sonnet-4.6
    provider: Anthropic
    provider_slug: anthropic
    prompt_price_per_million: 3
    completion_price_per_million: 15
  quality_a:
    model: openai/gpt-5.4
    provider: OpenAI
    provider_slug: openai
    prompt_price_per_million: 2.50
    completion_price_per_million: 15
  quality_b:
    model: anthropic/claude-sonnet-4.6
    provider: Anthropic
    provider_slug: anthropic
    prompt_price_per_million: 3
    completion_price_per_million: 15
request:
  temperature: 0
  top_p: 1
  max_tokens: 2048
  max_message_bytes: 16384
  framing_token_allowance: 1024
  max_public_output_bytes: 8192
  timeout_ms: 180000
  reasoning_enabled: false
  fee_multiplier: 1.10
attempts:
  generation_planned: 582
  semantic_planned: 1552
  quality_planned: 1552
  generation_reserve: 30
  semantic_reserve: 80
  quality_reserve: 80
  total_planned: 3686
  recovery_reserve: 190
  hard_ceiling: 3876
max_dollars: 300
primary:
  contrast: [actual_critique, generic_revision]
  minimum_difference: 0.10
  confidence_level: 0.95
  confidence_z: 1.959963984540054
```

## Frozen units, exclusions and matching

Read exactly the 319 dialogue files named in the merged #1017 ledger and verify
its existing sealed-data hashes. The source contains 1,202 eligible historical
links. Apply these ordered exclusions using only pre-outcome structure:

| Rule | Excluded links |
| --- | ---: |
| Deliberation ordinal is not 1 | 956 |
| Dialogue appears anywhere in the 48-item semantic packet identity ledger | 45 |
| Critique feedback is the recorded parser-failure placeholder | 7 |
| Missing nonempty pre-draft `context_input.rawContext`, non-initial draft, or unusable public envelope | 0 |
| No valid donor in the registered matching stratum | 0 |
| Retained | 194 |

The 48-item packet spans 47 dialogues; 45 of those have an ordinal-1 link in
this ledger. Regenerate with the existing #1018 analyzer to a new local output
path and verify its historical packet and identity-ledger hashes. It remains
unlabelled, unjudged calibration material. Its labeling is outside this study's
call budget. No calibration labels or held-out validity claim are fabricated.

Use all 194 retained units, one per dialogue, with all four arms for each unit:
776 public outputs. Counts for profiles 22 through 33, respectively, are
27, 15, 29, 23, 20, 11, 14, 9, 17, 7, 12, 10. These are a census of the eligible
subset, not equal profile allocation. Historical model-pair counts are 108
Nemotron/Kimi units and 86 Haiku/Haiku units. The 13 matching strata are
scenario × recorded ego route × recorded superego route × ordinal 1, with sizes
46, 15, 15, 17, 15, 9, 14, 11, 15, 14, 7, 7, 9. Preserve profile identity for
stratified descriptive reports but withhold it from judges.

A frozen replay unit consists of the exact stored pre-draft raw context, all
public suggestions in the initial draft (type, priority, title, message,
actionType, actionTarget), and the complete structured critique envelope
(feedback, approved, confidence, interventionType, suggestedChanges). Private reasoning,
metrics, source labels, historical revisions and subsequent learner responses
never enter generation or judging. Only 23 of 194 initial drafts carry attached full request captures; 171 lack
them. All 23 were attached by `heuristic_model_order`, and their trace metrics
lack a generation ID for exact cross-checking, so they cannot establish exact
full-request provenance. Use the common raw-context field for all 194 rather than changing the
information supplied according to capture availability. The original full
system prompt and course catalog are therefore deliberately outside the replay
input, even where a capture is retained in the archive. Provider state is not
recoverable. This is a prospective replay from recorded learner context, not
byte-identical restoration of the old engine. No current scenario text substitutes for missing historical context.

Within each stratum, seeded Fisher–Yates ordering followed by the first valid
seeded nonzero cyclic shift assigns every actual critique once as a wrong
critique. Self donors, same-dialogue donors, identical public drafts and
identical complete critiques are forbidden. If a stratum cannot be deranged,
stop before calls; do not silently exclude, relax matching, or replace units.
The frozen plan must reproduce 194 units and the documented counts. A source
mismatch is a data-integrity failure, not permission to refresh the corpus.

## Arms, randomization and decoding

- `draft_only`: retain the complete frozen public draft; zero generation calls.
- `generic_revision`: one revision with “Improve this draft for the recorded
  context. Make any changes you consider useful.” No critique is supplied.
- `actual_critique`: one revision supplied its own complete critique.
- `matched_wrong_critique`: the identical revision prompt supplied the donor's
  complete critique. It receives no “wrong” or source label.

The generated arms share the same system instruction, frozen context, draft,
model, provider and decoding settings. Actual and wrong arms use identical
wrapping. Each request starts a fresh stateless session. There is no agent loop,
Writing Pad, tools, dialogue continuation, previous-arm output or hidden retry.
The historical draft is a fixed baseline, not a fresh model draw.

The master seed initializes a Mulberry32 stream. Sort identifiers by code-point
order before shuffling. Draw donor permutations first in sorted stratum order,
then shuffle unit order, then all four arm orders within units. Generation skips
the draft-only slot. Semantic and quality jobs each get independently drawn
seeded permutations and opaque sequential presentation IDs. No model-level seed
is sent: cross-provider seed support is not uniform, and temperature zero is
not a guarantee of deterministic inference. Randomization controls scheduling
and donor assignment, not training or provider kernels. Save the plan once and
reuse it exactly for missing-work recovery.

## Routes and cost basis

The generator is the explicit paid form of `openrouter.nemotron` in
`config/providers.yaml`; the same model family generated 108 eligible frozen
drafts. The remaining 86 are Haiku-origin drafts replayed with Nemotron, an
explicit transportability limitation. The semantic panel is GPT-5.4 and Sonnet
4.6, both explicit repository routes, neither the replay generator nor the
historical Nemotron/Kimi/Haiku model. The two quality seats use these same model
IDs in separate requests with separate prompts and no semantic ratings.
Independence means separate model families and requests, not validated human
judgment or statistically independent training data.

Public catalog verification on 2026-09-05 UTC (metadata only, no inference):
[Nemotron](https://openrouter.ai/nvidia/nemotron-3-nano-30b-a3b),
[GPT-5.4](https://openrouter.ai/openai/gpt-5.4), and
[Sonnet 4.6](https://openrouter.ai/anthropic/claude-sonnet-4.6) list the rates in
the executable block. Pin `provider.only` to the stated provider slug, set
`allow_fallbacks: false`, `require_parameters: true`, and `max_price` to those
rates with per-request price zero. These controls are documented in
[provider routing](https://openrouter.ai/docs/guides/routing/provider-selection).
An unavailable route or unsupported parameter stops the run; there is no
alias refresh, free route, model fallback, reasoning-mode substitution or probe.

All requests are text-only JSON, without tools, media, search, cache-write
instructions or automatic repairs. Serialized messages are at most 16,384 UTF-8
bytes. Budget 17,408 input tokens (bytes plus 1,024 framing allowance) and
2,048 total output tokens, including reasoning if a provider bills any despite
the disabled setting. Response usage must fit these bounds. Oversized inputs
fail before reservation; oversized, truncated, refused or malformed outputs
are retained and stop the run without regeneration. The byte-to-token bound
and framing allowance are conservative assumptions for these text tokenizers;
record observed usage and stop immediately if contradicted.

Reserve the full worst-case request cost **before** dispatch; never refund it
based on a favorable output or missing cost. Record reported usage and actual
cost separately; missing cost is unknown, never zero. With every judging
attempt conservatively costed at the dearer Sonnet rate, 3,264 judging attempts
cost at most $270.729216 and 612 generation attempts at most $0.783360, before
the 10% fee allowance: total $298.6638336 ($298.665792 after rounding each reservation upward to
the nearest microdollar). The hard registered ceiling is **$300**
in study API spend including this allowance. No credit purchase is authorized;
external taxes or unrelated account usage are outside the runner's accounting.
The normal planned call count is 3,686; the reserve is inside both ceilings.
Ceilings are checked by category, total attempts and cumulative dollar
reservation, including every predecessor segment and ambiguous transport.

## Semantic measurement

Each of the 776 public outputs gets exactly two independent semantic calls.
Each sees the same recorded context, frozen draft, **actual** reference critique,
and candidate public output; neither sees the delivered treatment, donor,
profile, arm ID, generator, historical revision or the other judge. Actual
critique fulfillment is the common outcome in every arm, including the wrong
arm; scoring each arm against its own delivered critique would change the
endpoint across treatments. Text may reveal its origin despite label blinding.

Each judge identifies the actionable requests in the whole reference critique,
quotes critique and candidate spans, and returns two separate labels:

1. `directive_fulfillment`: `none`, `partial`, `full`, or
   `measurement_indeterminate`. Full means every material actionable request
   is visibly satisfied without contradicting another. Partial means some but
   not all; none means none. An already-satisfying draft may score full.
   No actionable request, incompatible requests, insufficient context or
   ambiguity is indeterminate. Paraphrase can fulfill a directive; word reuse
   alone cannot.
2. `material_change`: `none`, `surface_only`, `reasoning_only`, `action_only`,
   `mixed`, or `measurement_indeterminate`, comparing the public candidate
   with the draft. “Reasoning” here means publicly expressed reasoning or
   instructional strategy, never private deliberation. Action means a changed
   proposed learner task, next move, target or operation; a field edit by itself
   is insufficient. Warmth, wording and formatting alone are surface changes.

Validate nonempty evidence spans as exact substrings of their supplied fields.
This is an evidence-location check, not a regex semantic classifier. For `none`
fulfillment, candidate spans may be empty because an absence has no quotation;
critique spans and explanatory rationale remain required. Both seats must
agree exactly on each label. Any difference or either seat's uncertainty makes
that field `measurement_indeterminate`; never majority-vote, average, retry,
request a tie-breaker, or convert it to failure/success. Material changes are
reported categorically and as a separate consensus binary (`reasoning_only`,
`action_only`, `mixed` versus `none`, `surface_only`).

## Primary endpoint, estimands and sensitivity

Primary: within-unit difference in consensus **full actual-directive
fulfillment**, actual_critique minus generic_revision. Full = 1;
none/partial = 0; indeterminate stays categorical. The primary estimand is the
equal-unit mean difference over all 194 registered units, for this frozen
corpus under the stated one-pass replay and measurement policy. The primary
threshold is a point estimate at least **+0.10** and a two-sided 95% paired
normal interval whose lower bound is greater than zero: mean(d) ±
1.959963984540054 × sampleSD(d)/sqrt(194). Clip reported intervals to [-1,1].
Only one contrast and one semantic field is confirmatory. No subgroup or
secondary significance is promoted to confirmation.

All 194 primary pairs must be technically complete and semantically determinate
for the primary threshold decision. Any unresolved primary pair yields
`measurement_indeterminate` (semantic) or `incomplete_technical` (technical),
with **no confirmatory conclusion**. Do not drop incomplete blocks. Retain the
full denominator and report worst-case identification bounds by assigning
unknown binary outcomes 0/1 in the unfavorable/favorable directions. Do not
call these confidence intervals. A determinate result below threshold is
`threshold_not_met`, not evidence of equivalence or no effect.

The planned sensitivity is about 20.1 percentage points at 80% power for a
two-sided alpha .05 paired normal test under worst-case SD(d)=1:
(1.96 + 0.842)/sqrt(194). If discordance is .5 and effect small, SD≈sqrt(.5)
gives about 14.2 points. These are design approximations, not estimates from
the historical lexical result; +10 points is the minimum meaningful threshold,
not a claim of 80% power at that threshold. At 90% power, worst-case sensitivity
is about 23.3 points. Correlated scenario effects, donor interference and
indeterminate measurement can make sensitivity worse. No sample enlargement,
interim efficacy looks, early success stop or conditional power adaptation.

Report the same four predefined contrasts separately for each evidence lane:
generic minus draft (extra-pass), actual minus generic (critique content),
actual minus wrong (link specificity), actual minus draft (total replay effect).
The latter includes replay wrapper/model differences relative to the historic
draft, so it is not the total causal effect of the original deployed loop.
Profile and historical-route summaries are descriptive, with their denominators;
no population weighting or factorial cell-effect claims.

## Blind public-output quality and other secondary endpoints

Two quality calls per output see **only recorded context and public output**,
with independent opaque IDs and no draft, critique, treatment, semantic labels,
source route or historical scores. Use the prospective two-component construct
in `config/rubrics/v3.0/evaluation-rubric.yaml`: pedagogical quality 1–10 and
content accuracy 1–5, with accuracy N/A only for no assessable factual/domain
claim. Copy the substantive anchors into the study's dedicated request builder;
do not use the general evaluator, its mutable default judge/fallback, or write
v3.0 values to historical evaluation rows.

Retain both scores and quoted public evidence. Exact score disagreement or
N/A disagreement is `measurement_indeterminate` for that dimension. Consensus
scores remain separate dimensions; no composite. Report per-arm distributions,
agreement, indeterminate counts, all four paired contrasts and descriptive
paired intervals only where complete; clearly label any partial summary and
never claim quality improvement from directive fulfillment or changed actions.
Content accuracy cannot validate unavailable course resources.

Auxiliary exact-word uptake and literal action-field differences may be
computed from saved outputs only, without provider calls. They cannot resolve
semantic disagreement or determine eligibility, stopping, retries or success.
No later learner turn is generated or scored; learner reaction, learning,
retention, independent unassisted transfer and bilateral transformation are
explicit non-claims and require a separately registered study.

## Execution, failures, recovery and stopping

Phases: PREFLIGHT → GENERATING → semantic AUDITING → quality AUDITING →
EXTRACTING → PACKAGING → WORKFLOW_COMPLETE, or an explicit terminal disposition.
All planned generations precede all judging; no outcomes influence later
requests. Each measurement phase collects its fixed batch, then seals and
computes consensus. Indeterminate means stop inference in that field, not
solicit additional labels. The independent quality lane can still complete
its registered batch when the semantic lane is indeterminate. No shared
history passes between these calls. Report both scientific disposition and
technical workflow completion; completing calls alone is not study success.

The proposed launcher is `scripts/run-superego-critique-causal-replay.js`.
Zero-call `--prepare` writes a create-once plan and exclusion audit. Paid mode
requires explicit `--launch --accept-charges`, a real committed GO note, and
shared admission through `services/paidStudyLaunchContract.js`. Admission opens
a fixed study-wide lease, create-once segment destination and append-only
ledger before the transport is initialized. The helper's `spendCap` is the
attempt ceiling; the runner separately enforces dollars. No user GO note is
created during design. A GO note alone is not a launch instruction.

Use `services/durablePaidModelAttemptBudget.js` to reserve each physical attempt,
mark dispatch, durably persist raw response and terminalize exactly once.
Ledger failure stops before any further call. A completed response is accepted
once even if execution stopped before derived-output writing. Preserve the
first response, including refusal, truncation, invalid JSON and adverse scores.
No format-repair calls, alternate output selection, provider SDK retries,
automatic fallback, judge reconciliation or outcome-driven resampling.

On a timeout, connection failure, recoverable filesystem interruption, or HTTP
429/5xx **without usable content**,
stop and seal `technical_failure`; permit missing-work-only recovery in a fresh
segment under the same routes, data, plan, caps and seed. Each job gets at most
one technical replacement across the whole chain. An ambiguous dispatched
attempt stays charged. Repeating a technical failure for the same job, HTTP
4xx other than 429, a model refusal, bad/truncated structured response,
route drift, evidence-span error or substantive uncertainty stops with no
automatic replacement. A code defect may be repaired without voiding GO, but
existing valid or substantive failed responses cannot be resampled.

For operator SIGINT/SIGTERM, finish/persist the current request, then seal a
recoverable pause at the next job boundary. An abrupt process death is sealed
with the existing `scripts/seal-interrupted-paid-study-launch.js` before
recovery; reconcile stale reservations and persist terminal dispositions.
A durable response without a terminal event is reconciled and reused.
Recovery walks the full predecessor chain, validates sealed response hashes,
reconstructs usage from the study ledger, and skips every completed job.
Only missing/response-free technically failed work is eligible. Any changed
plan or conflicting duplicate response stops; this is sealed-data integrity,
not source-code or GO digest binding. The study-state directory is fixed under
`MS_DATA_HOME/paid-studies`; a new output path cannot reset the budget.

Hard category ceilings are generation 612, semantic 1,632, quality 1,632;
combined 3,876. The reserves are 30, 80, 80 respectively, not interchangeable.
No extra attempt is licensed by unused dollars. Exhaustion gives
`incomplete_technical`; retain every unit and missing count without replacement.
Any uncertainty in cumulative accounting stops. Archive the sealed raw plan,
requests, responses, ledgers and derived report to the existing private artifact
repository with `node scripts/archive-run-artifacts.js <segment-directory>`
and `node scripts/archive-run-artifacts.js --check <segment-directory>` for
every segment; verify archived bytes and commit/push the exact new archive
files before declaring archival packaging complete. The runner leaves
`HANDOFF_PENDING` for this zero-call operator step. No paper claim is licensed by a local run alone.

## Remaining scientific risks and non-claims

- The semantic instrument is prospective and unvalidated against humans. The
  48-item packet is unscored, and model-model agreement does not establish truth.
  The strict complete-pair rule may make the entire primary result indeterminate.
- Frozen initial drafts were selected historically because a critique and
  revision existed. Results do not generalize to accepted drafts, later rounds,
  all profiles, other corpora or the distribution of future live learners.
- Matching preserves scenario/routes/ordinal but not critique stance, length or
  relevance; those are part of the wrong-critique intervention. The wrong arm
  can receive harmful or redundant advice. It isolates this donor policy only.
- The common replay prompt and Nemotron backend differ from some original
  generation environments. There is one generation per arm and no direct
  estimate of within-prompt sampling variance. Provider drift is recorded.
- Blinding removes labels, not recognizable prose. Shared training, grader
  style preferences and scenario dependence remain possible.
- Causal claims are restricted to the specified replay intervention and the
  relevant endpoint. Fulfillment, changed public strategy, quality and later
  learner outcomes are distinct. Neither exact words nor pleasant revision
  establishes learning, transfer, autonomous recognition or superego superiority.

## Zero-call runner audit before GO

The standalone runner uses shared admission and durable per-dispatch journals;
it does not use eval-cli generation or its provider retries. Offline tests
cover deterministic donors, outcome-blind eligibility, separate judge inputs,
exact model/provider and decoding controls, total/category/dollar exhaustion,
refusal/truncation/schema failures, response-free failures, missing-only
recovery, the response-write/persistence crash windows, operator pause,
repeat-failure stopping, disagreement and quality N/A. The existing launcher
inventory test is advanced by one reference implementation, not relaxed.

The frozen plan reproduces byte-for-byte with 194 units and 3,686 jobs; all 319
trace hashes and the original 48-item packet/identity hashes verify. The packet
is still unscored. Local focused tests: 44/44. Structural ratchets: 52/52.
Full lint, manifest/inventory and workplan checks pass. No provider call, live
parameter-acceptance probe, semantic label, quality score, signed GO note,
historical mutation or paid launch was made during design. Hosted CI and human
review are recorded in the PR; neither silently authorizes launch.
