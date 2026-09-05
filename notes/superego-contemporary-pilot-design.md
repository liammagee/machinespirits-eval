# Contemporary superego critique pilot

Prospective amendment, 2026-09-05: **human quality comparison; review-ready
proposal, no amended GO or launch recorded.** The first cohort is permanently
closed with five accepted drafts and one truncated draft; see the
[generation record](2026-09-05-superego-contemporary-generation-truncation.md).
Its original design and GO remain available in Git at the recorded launch
commit. No old output is repaired, relabeled, replaced or pooled with this cohort.

This amendment keeps the question, six contexts, four arms, 12-draft allocation
and human quality rubric. It changes public replies to plain text, records an
unusable output as missing while continuing independent jobs, and brings the
human quality comparison forward. Automated semantic measurement and model
judging are deferred. These are prospective protocol changes, not a claim that
editing code can make the previous incomplete run scientifically complete.

The user requested unattended technical repairs and a path to meaningful
scientific decisions. This file makes the resulting study concrete for review.
There is no provider probe, new signature or paid launch during that repair work.

## Executable registration

```yaml study
id: superego-contemporary-human-comparison
master_seed: 202609052
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
max_output_tokens: 2048
max_public_bytes: 4000
max_request_bytes: 16384
framing_tokens: 1024
cache_write_multiplier: 1.25
cost_buffer: 1.10
timeout_ms: 180000
public_output_format: text
generation_failure_policy: retain_missing
automated_judging: false
attempts:
  generation_planned: 60
  quality_planned: 0
  semantic_planned: 0
  total_planned: 60
  generation_reserve: 6
  quality_reserve: 0
  semantic_reserve: 0
  recovery_reserve: 6
  hard_ceiling: 66
max_dollars: 4.6464
```

## The question and the decision

Does relevant critique improve the tutor's public teaching beyond an ordinary
second attempt? The first decision is whether human readers see a useful,
interpretable difference worth studying further. This is a small descriptive
pilot, not a powered efficacy test, a validation of psychological theory, or
an evaluation of learning and transfer.

The primary endpoint is blind public teaching quality on the existing 1–10
rubric, actual critique minus generic revision. A one-point difference is the
prespecified planning target for a larger study, not a significance cutoff.
Report each reader separately, all four arms, and all three contrasts against
generic revision. Accuracy has its own 1–5/N/A/indeterminate field. Directive
fulfillment, material action/strategy change, exact-word uptake and later learner
or transfer evidence are separate, uncollected channels in this cohort.

The scientific handoff presents availability by arm, per-reader paired
contrasts, exact-consensus contrasts, every rationale, disagreements, and
full-unit missingness bounds. Researchers then choose whether to pursue a
larger quality study, revise the construct because readers disagree, or stop
because the comparison gives insufficient reason to spend more. No automated
success gate, confirmatory promotion or outcome-driven enlargement is used.

## Fixed corpus, allocation and blinding

Use the six registered scenarios' opening learner messages only, with the two
explicit practice-question adaptations and complete teaching gloss above.
Exclude hidden learner states, trigger turns, expected actions, success criteria,
counterfactuals and unseen dialogue. Do not import historical drafts or labels.

Generate two fresh drafts per context: 12 draft units nested in six contexts.
Every unit has draft_only, generic_revision, actual_critique and
matched_wrong_critique. The 48 public slots are repeated measurements, not 48
independent encounters. One invalid draw cannot be exchanged for a better one.
All 12 planned units remain in accounting and full-unit bounds.

The new fixed master seed distinguishes this fresh cohort from the development
outputs already inspected. It drives Mulberry32/Fisher–Yates draft, critique,
revision and presentation orders. Within each topic, shuffle scenario IDs and
assign the next scenario cyclically as critique donor, keeping replicate number.
There are four recognition contexts and two dialectic contexts. Donors are fixed
before outputs, matched on topic and format, not length or pedagogical need.

Generate all 12 drafts, then 12 critiques, then 36 revisions. Each revision
starts from its own frozen draft in a stateless call. Generic revision receives
an ordinary improvement instruction. Actual critique receives its own critic's
feedback; matched wrong critique receives its assigned donor's feedback.
Empty or unhelpful critiques remain observations. Same-model criticism is an
intervention, never a judgment of its own quality.

Readers receive only neutral presentation IDs, public tutor paragraphs with P
IDs, the opening learner message and bounded teaching context. They receive no
arm mapping, source draft, critique, model label, or other reader's ratings.
Blinding and reader independence require procedural care; revisions can sometimes
be recognizable. The operator keeps the full plan and raw artifacts private.

## Generation and technical handling

Use direct Anthropic Messages, `claude-sonnet-5`, with thinking disabled,
2,048 maximum output tokens, no temperature/top_p/top_k, fallback, tools,
conversation history, caching request or SDK retries. The generator's sampling
is not guaranteed deterministic. Keep the existing draft and revision teaching
instructions but request ordinary public text without a JSON wrapper.

Critiques still use native JSON schema for zero to three directives and a
rationale, because downstream intervention construction requires those fields.
The original 4,000-byte output and 16,384-byte request limits remain. Plain
public text is retained exactly; it is not trimmed, completed, repaired or
chosen for quality. Structured critique validation remains separate from human
quality judgment. No regex or formatting check is a semantic outcome measure.

The saved failure contained 1,702 trailing U+3000 ideographic spaces. This
establishes repetitive whitespace, but not its underlying provider cause or that
structured decoding caused it. Removing the unnecessary public JSON wrapper
reduces format dependencies; it is not an empirically validated cure. Anthropic
[documents truncation as an exception to structured-output guarantees](https://platform.claude.com/docs/en/build-with-claude/structured-outputs).
The regression reproduces the observed failure shape without provider calls.

A returned refusal, truncation, invalid public output or invalid critique is a
terminal unavailable result. Preserve its raw response and usage; do not retry
it. Skip only jobs that depend on unavailable inputs, recording their dependency
IDs without spending a call. For example, a missing draft prevents its critique
and three revisions; its missing critique also prevents the assigned recipient's
wrong-critique revision. Other fixed jobs continue. No substitute donor or unit
is selected. This policy applies only to this fresh prospective cohort.

The public packet retains all 48 IDs. Unavailable slots are marked unavailable
and receive `rating: null`, not a low score and not an invented human judgment.
The two readers must rate every available slot. Missingness by arm is reported;
complete-case results can be biased and are never presented as the full-corpus
effect. If all outputs are unavailable, the appropriate decision is that the
comparison could not be made, not a claim of no effect.

A response-free transport failure or narrow 429/5xx error envelope permits one
replacement for that fixed job, using a fresh segment and the same payload,
route, seed, settings and shared cumulative ceilings. Keep all attempts; never
redispatch a retained answer. Two transport failures of the same diagnostic
class stop for defect investigation. Partial response delivery is preserved and
stops for inspection; it is not silently treated as response-free retry work.
Authentication, request-format, route/model drift, unknown/out-of-bounds usage,
request overflow, filesystem/integrity and exhausted-budget failures stop calls.
Code-defect fixes do not revoke study approval. Changes to scientific inputs or
dispositions must be prospective. Unsealed interruptions use the existing shared
reconciliation helper before missing-work recovery.

## Human review and analysis

Two independent human readers each score the 48 available-or-missing slots.
This means at most 96 human output ratings total, each with separate quality and
accuracy fields, supporting P IDs and a short rationale. No automated judge or
semantic reference labels are prerequisites for this comparison.

`human-quality-review/review.html` is a self-contained local form. It includes
the registered rubric, saves progress per reader ID, and downloads one reader's
rating file. The operator gives each reader only that review folder. Complete
files identify the exact blinded public packet, reader ID and completion time;
ratings from another packet are rejected even if neutral IDs repeat. This is a
sealed-data identity check, unrelated to approval or source files. No rating is generated by Codex
or another model. Two independent human readers are not replaced by two model
passes. The offline report accepts both files and validates completeness before
producing the comparison. It never makes a provider call.

Preserve individual scores and exact-consensus results. Any quality disagreement
or uncertainty is measurement_indeterminate in the consensus lane; do not average
it away. For each paired contrast, an unavailable or indeterminate difference
contributes [-9,+9] to full-unit identification bounds. All 12 unit weights are
fixed; two units per context yield equal context weight. Bounds are not
confidence intervals. Clearly label the descriptive mean among observed pairs
and report its denominator. All-arm estimates and each context's individual
paired differences remain inspectable in the report.

## Calls, dollars and preservation

60 planned provider calls: 12 drafts, 12 critiques, 36 revisions. Six technical
replacements give a **66-attempt hard ceiling**. **Zero judging calls** are in
this registration. Unavailable dependencies can reduce calls but never cause
additional sampling. There are no probes or canaries outside the fixed jobs.

The **additional provider ceiling is $4.646400**, using the same conservative
$0.070400 reservation per attempt: 16,384 input bytes plus 1,024 framing tokens,
$2/input-million with a 1.25 cache-write multiplier, 2,048 output tokens at
$10/output-million, and a 10% buffer. Base reservation $4.224000; recovery
reserve $0.422400. Prices and the model ID were checked in the preceding launch;
recheck [current Anthropic pricing](https://platform.claude.com/docs/en/models/overview)
before paid dispatch. A price change requires recalculation before a call.
Human labor is excluded from provider spend.

The closed cohort used six attempts and retains $0.422400 in reservations.
Both cohorts together can therefore use at most **72 attempts and $5.068800
reserved**, below the previously approved 168 attempts/$20. The fresh cohort
has a distinct study ID and ledger; this is not a reset or recovery of the
closed cohort. No other paid cohort is covered by this amendment.

Use the existing paidStudyLaunchContract and durable attempt journal, with
create-once destinations, fail-before-call attempt/category/dollar ceilings,
append-only attempt accounting and raw requests/responses. Record commit,
tree and dirty flag as provenance. No source hashes, approval packages,
numbered designs, endpoint certificates or bespoke authorization machinery.
Archive all segments and cumulative accounting using the maintained private
archive workflow, verify copies, then publish an operational report.

Generation ends HANDOFF_PENDING for human quality ratings. The human report is
a scientific decision point; it is not proof of better learning. Preserve the
historical replay, calibration, all six contemporary attempts and their GO notes
exactly as they are. No learner/transfer, bilateral-transformation, deployed-tutor,
psychological-theory, cross-model or equal-total-compute claim is licensed.

## Operator commands

Prepare without calls:
`node scripts/run-superego-contemporary-pilot.js --prepare --out /ABS/NEW-PLAN`

After the amended design is merged, its GO recorded, and launch authorized:
`node scripts/run-superego-contemporary-pilot.js --launch --accept-charges --phase generation --go-note notes/APPROVED-NOTE.md --out /ABS/NEW-SEGMENT`

After two independent readers download their completed files:
`node scripts/run-superego-contemporary-pilot.js --human-report --from /ABS/GENERATION-SEGMENT --human-quality /ABS/reader-a.json --human-quality-other /ABS/reader-b.json --out /ABS/NEW-REPORT`

The latter command is zero-call and does not require semantic ratings or a
model judging launch. The runner rejects judging for this registration.
