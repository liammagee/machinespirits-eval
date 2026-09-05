# Contemporary superego critique pilot

Prospective design, 2026-09-05. **[GO recorded](2026-09-05-superego-contemporary-pilot-go.md); no launch recorded.**
This is a new study. The historical replay, its calibration, approvals,
attempts and results remain unchanged. This pilot asks whether a separate
critique improves a current model's public teaching and whether independent
readers can measure that improvement. It does not finish the old calibration.

## Executable registration

```yaml study
id: superego-contemporary-pilot
master_seed: 202609051
sample_size: 12
drafts_per_scenario: 2
scenario_source: config/cross-suite-trap-scenarios.yaml
scenarios:
  - {id: cross_epistemic_resistance, topic: recognition}
  - {id: cross_affective_shutdown, topic: recognition}
  - {id: cross_productive_deadlock, topic: recognition}
  - {id: cross_misconception_surfaces, topic: dialectic}
  - id: cross_activity_avoidance
    topic: recognition
    practice_question: Explain why recognition received from a dependent other might fail to establish the master's independence.
    learner: Can you just give me the answer to this practice question on recognition? I've read the teaching material; I just want to check my answer against yours.
  - id: cross_struggling_overload
    topic: dialectic
    practice_question: Explain in your own words how sublation can involve both preservation and cancellation.
    learner: I keep getting this practice question wrong. I've retried it three times now. Can we go over the dialectic stuff again? I think I missed something earlier.
teaching_material: |
  This is a standalone tutoring exercise, with no hidden conversation, course catalogue, navigation tools or additional quiz feedback. Only the learner message and this material are available. You may use clearly identified examples and interpretations; do not claim to quote an unavailable text. Interpretive disagreement can remain open. References to a lecture in the learner message describe the learner's account; its unseen content is not supplied evidence.

  Course glosses from content/courses/479/lecture-3.md:
  - Self-Consciousness Requires Mutual Recognition: A self becomes conscious only through another self's recognition.
  - Aside: Love as Hegelian Sublation?: Sublation involves preservation, cancellation and uplifting. This course gloss does not make thesis-antithesis-synthesis an additive recipe or a universal quotation from Hegel.
  - Servant's Work as Path to Self-Awareness: Work channels desire, preventing its fleeting satisfaction and enabling lasting self-reflection. Through labor, servile consciousness returns to itself.

  These are bounded teaching glosses, not a complete account of Hegel or adjudications of Popperian or materialist objections. Learners may challenge them. The practice questions supplied for two cases are newly authored exercises, not recovered historical quiz items. A useful response can acknowledge uncertainty, ask for the learner's reasoning, or offer a manageable next task without claiming to know missing history.
models:
  generation:
    provider: anthropic
    model: claude-sonnet-5
    endpoint: https://api.anthropic.com/v1/messages
    input_per_million: 2
    output_per_million: 10
  judging:
    provider: openai
    model: gpt-5.6-sol
    endpoint: https://api.openai.com/v1/responses
    input_per_million: 4
    output_per_million: 20
max_output_tokens: 2048
max_public_bytes: 4000
max_request_bytes: 16384
framing_tokens: 1024
cache_write_multiplier: 1.25
cost_buffer: 1.10
timeout_ms: 180000
attempts:
  generation_planned: 60
  quality_planned: 48
  semantic_planned: 48
  total_planned: 156
  generation_reserve: 6
  quality_reserve: 3
  semantic_reserve: 3
  recovery_reserve: 12
  hard_ceiling: 168
max_dollars: 20
```

## Corpus, sample and allocation

Use all six named scenarios' **opening learner messages only**, twice each,
with the two explicit adaptations above. The source suite supplies two
substantive-engagement cases, one affective case, one diagnostic case and two
scaffolding cases. It is the existing bridge to the suggestion-scenario family,
so this retains the philosophical teaching setting without restoring incomplete
historical model requests. Hidden learner states, trigger turns, expected
actions, success criteria and counterfactual turns are excluded from all calls.
No simulated intervening conversation, historical scores, revisions or labels
are imported. The named source contexts and complete public payloads are saved
in the create-once plan at first launch and compared on technical recovery.

The unit is a newly generated draft for one context. There are 12 drafts nested
in **six contexts**, not 12 independent learner encounters. Two draws per
context expose basic generation variability at modest human workload. The 48
outputs are repeated measurements, not an independent N of 48. This is an
engineering and measurement pilot, with no powered causal test. It cannot
justify a 10-point treatment threshold or estimate rare failures precisely.

Generate all 12 drafts, then one critique per frozen draft (12), then three
revisions per draft (36). Retain the draft as `draft_only`; generate
`generic_revision`, `actual_critique`, and `matched_wrong_critique` once each.
Every revision starts from its own frozen draft in a fresh stateless call.
The critic uses the same Sonnet model in a separate pass and is never a judge.
Its zero-to-three directives may include no actionable advice. Empty or poor
critiques remain observations; do not replace them to manufacture headroom.

The master seed drives the existing Mulberry32 stream and Fisher–Yates
shuffles. It randomizes draft and critique order, revision unit/arm order, and
independent quality/semantic presentation orders. Within each topic, shuffle
scenario IDs and assign each to the next scenario cyclically, retaining the
same draft replicate number. This fixes donor assignment before any output.
Wrong critiques are matched on topic and output format, **not on length or
pedagogical need**. The recognition block has four contexts; dialectic has two.
Do not choose donors from revision outcomes. IDs and mappings stay outside the
blinded packets. Model sampling is not guaranteed deterministic.

## Models, transport and fixed decoding

Use direct Anthropic and OpenAI APIs, no OpenRouter/DeepInfra, no fallback and
no SDK retries. `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` are read only when the
authorized stage needs them; keys are never logged. Availability in this
account has not been tested by a paid probe.

Sonnet: `thinking: {type: disabled}`; omit temperature/top_p/top_k; native
`output_config.format` JSON schema; `max_tokens: 2048`. Sol: Responses API,
`reasoning.effort: low`, `max_output_tokens: 2048` including reasoning tokens,
`store: false`, strict `text.format` JSON schema; omit sampling parameters.
Neither route uses tools, server-side conversations, explicit prompt caching,
batch processing or automatic truncation. Every request is stateless.
The response model must equal the registered ID; unexpected models stop.

Current official documentation inspected 2026-09-05:
[Sonnet models and prices](https://platform.claude.com/docs/en/models/overview),
[Sonnet parameter changes](https://platform.claude.com/docs/en/models/sonnet-5/whats-new-sonnet-5),
[Claude model IDs](https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions),
[Claude structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs),
[Sol snapshot, features and pricing](https://developers.openai.com/api/docs/models/gpt-5.6-sol),
[OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).
Dateless IDs here name documented snapshots; serving infrastructure can still
change. These sources establish a candidate route, not empirical superiority
on this instrument. Review current prices before launch; a rate increase must
fit a recalculated ceiling before any request, not be discovered by overspend.

## Measurement and human handoff

The old 35 returned judgments are development evidence. Offline inspection
found 20 exact-span failures, two invalid-JSON answers and 13 parser-accepted
answers. No labels are repaired, promoted or reassigned. In this new instrument,
paragraphs receive D/P IDs and critique directives receive C IDs. Readers cite
those IDs; the runner checks membership, not quotation transcription. Human
review must still determine whether the cited passage supports the judgment.
The focused fixtures include positive fulfillment by paraphrase, surface-only
revision, absent directives, invalid references and malformed provider output.
Fixtures test mechanics; they do not establish human semantic validity.

The 12 new drafts and their outputs are held out from prompt tuning. Prompts
and rubrics are registered before generation; no prompt changes using these
ratings followed by rerating the same outputs. These are new outputs on public,
known scenarios, not an unseen-domain validation sample.

After generation, stop for **two independent human readers**. Each rates all
48 outputs on quality (1–10) and factual accuracy (1–5, N/A or indeterminate)
using only public output and context. Each reader completes 48 quality and 48
semantic ratings (96 each; 192 human ratings overall). Each records a rationale and
evidence IDs. Both quality files must be complete and saved before the semantic
packet is released. Then both independently rate all 48 candidates against
their own draft and reference critique for fulfillment (none/partial/full/
indeterminate) and material change (none/surface/reasoning/action/mixed/
indeterminate). Same readers may do both stages in this order. Do not distribute
the private plan, arm key, generated critiques or other readers' ratings during
the quality stage. The operator's files provide chronological provenance, not
proof of independence; reader training and independence require human review.

Each human document is `{raters: [{coder_id, completed_at, ratings: [{id,
rating}]}]}` with exactly two distinct readers and one rating per presentation.
Use the fields and rubric in the emitted packets. Timestamps record completion;
the tool checks quality precedes semantic completion. Blinding is partly a
procedural responsibility because readers can sometimes recognize revisions.

Only after both reference documents are saved may the separate judging stage
make 48 public-only quality calls and 48 semantic calls to Sol. Human references
never enter those calls. Same-model generation and judging is prohibited.
The model judge is a single independent family, not a two-model consensus panel.
Its semantic and quality calls have separate inputs and no conversation memory.

## Endpoints, uncertainty and progression

Primary scientific estimand: equal-context mean difference in **blind public
quality**, actual critique minus generic revision, with equal weight for the
two drafts in each context. One point on the 1–10 scale is the prospective
minimum difference worth planning a larger study around; it is **not** a pilot
significance threshold. Report each human reader and Sol separately, paired
within the same draft, without treating the 48 outputs as independent cases.
Report all four arms and the three contrasts against generic revision.

The human-consensus lane requires exact agreement on each field. Any disagreement
or uncertainty is `measurement_indeterminate`; never average it into a consensus
score. Preserve individual scores, including 7 versus 8. For the full 12-unit
quality estimand, unknown differences contribute [-9,+9] to identification
bounds. Bounds are not confidence intervals. Report determinate coverage and
complete-case descriptive means explicitly; they are not the full-corpus effect.
This replaces the old all-pairs-determinate gate only for this new pilot.

Secondary: directive fulfillment and material action/strategy change, kept
separate from quality and accuracy. Record individual labels, exact human
consensus, model-to-reference agreement and disagreement dispositions. Exact
word uptake is auxiliary only and does not enter any progression rule.

Instrument readiness requires at least 87/96 structurally valid model judgments,
at least 39/48 exact model-to-determinate-human-consensus matches for **each**
semantic field, and model quality within one point of **both** humans on at least
39/48 outputs. Unknown, invalid and missing ratings contribute no successes.
The one-point proximity diagnostic does not create averaged consensus labels.
These are transparent engineering targets (90%/80% rounded up), not validated
psychometric standards. Report accuracy separately; no accuracy-based efficacy
claim follows from this pilot. Failure yields measurement_indeterminate and
instrument development; success permits **design review only**. No automatic
promotion, sample enlargement, significance test or confirmatory launch.

The next study's size must use the chosen meaningful quality difference,
context-level variability, missingness bounds and conservative sensitivity
analysis. Six pilot contexts cannot yield a precise variance estimate. Do not
choose the next size or threshold to make an observed treatment effect pass.
If prompts change after this pilot, validate on new held-out outputs.

## Ceilings, failures, recovery and stop rules

60 generation calls + 48 quality + 48 semantic = **156 planned**. Reserve six
generation, three quality and three semantic replacements: **168 hard attempts**,
category caps 66/51/51. At most one technical replacement per job, never a
replacement for an invalid, refused, poor, empty-critique or indeterminate answer.
No success-based early stop or selection of the best draw. Two response-free
transport failures of the same diagnostic class stop for defect investigation.
No budget reset across the human handoff or recovery segments.

**US $20 maximum provider spend**, excluding human labor. Reserve full request
byte ceiling + 1,024 framing tokens as input, full 2,048 output tokens, a 1.25
cache-write multiplier on input and 10% buffer. This intentionally overcounts
typical English input. Maximum per attempt: Sonnet $0.070400; Sol $0.140800.
Base $17.740800; all reserve $1.267200; **worst permitted reservation $19.008000**.
Unused $0.992 is headroom, not permission for extra calls. First generation
stage cannot exceed 66 attempts/$4.646400 under these bounds. No canary or paid
availability calls outside the job list. Request-size overflow stops before
reservation; it does not truncate input. A rate increase requires recomputation
before dispatch; charges without usage remain unknown and fully reserved.

The runner uses `services/paidStudyLaunchContract.js` and the shared durable
attempt journal: create-once destinations; append-only cumulative attempt and
dollar reservations before dispatch; immutable raw requests/responses; recorded
commit/tree/dirty state; one HTTP dispatch per attempt. Network diagnostics
retain error name, cause code, dispatch/body-read stage and safe request IDs,
without headers, credentials or arbitrary provider error objects.

A response-free 429/5xx error envelope or transport failure can be recovered
once under the same plan, source data, payload, seed, routes, settings and caps.
Use the latest sealed predecessor and a fresh destination; valid and invalid
answers are retained and never dispatched again. A generation answer that fails
structure/size validation stops the pilot, because later arms need its frozen
value. Invalid judge answers occupy their fixed jobs and collection continues.
Refusal, truncation, route drift, missing usage or out-of-bound usage stops for
inspection without outcome resampling. No new unit substitutes for failed work.
Durable responses in a write-before-journal crash window are recovered locally;
reconcile interrupted reservations with the existing shared interruption helper
before a new segment. Do not bypass a repeated substantive or technical defect.

Generation ending is HANDOFF_PENDING for human references. Judging ending is
HANDOFF_PENDING for independent review and private archival verification; it is
not the completed research programme. Archive every segment and ledger using
the maintained private artifact workflow, including failures. Human reference
ratings are research data, not authorization notes. No new authorization
machinery, source hashes, numbered designs or endpoint certificates are used.

## Commands and claim boundary

Zero-call preparation:
`node scripts/run-superego-contemporary-pilot.js --prepare --out /tmp/pilot-plan`

After merged design, recorded GO and **separate launch permission**:
`node scripts/run-superego-contemporary-pilot.js --launch --accept-charges --phase generation --go-note notes/APPROVED-NOTE.md --out /ABS/NEW-SEGMENT`

Emit blinded quality packet:
`node scripts/run-superego-contemporary-pilot.js --human-packet quality --from /ABS/LATEST-SEGMENT --out /ABS/NEW-PACKET`

After both human quality readers finish, emit semantic packet:
`node scripts/run-superego-contemporary-pilot.js --human-packet semantic --from /ABS/LATEST-SEGMENT --human-quality /ABS/quality.json --out /ABS/NEW-PACKET`

After both human stages and explicit judging launch permission:
`node scripts/run-superego-contemporary-pilot.js --launch --accept-charges --phase judging --go-note notes/APPROVED-NOTE.md --recovery-from /ABS/LATEST-SEGMENT --human-quality /ABS/quality.json --human-semantic /ABS/semantic.json --out /ABS/NEW-SEGMENT`

Technical recovery adds `--recovery-from /ABS/LATEST-SEGMENT` to the same stage
and uses a new output directory. The default shared study state is the maintained
evaluation data home's `paid-studies` directory. Never redirect it to reset caps.

Claims are limited to instrument feasibility and descriptive output differences
for these six bounded contexts, prompts, models and single revision passes.
This does not validate Freud/Hegel as a psychological mechanism, demonstrate
better learning, transfer, bilateral transformation, deployed tutor behavior,
cross-model generalization or superiority at equal total compute. Critique adds
a paid pass; report that cost. Wrong feedback can harm independently of useful
actual feedback. A strong current generator may leave little improvement room;
do not select weak drafts to rescue the hypothesis.
