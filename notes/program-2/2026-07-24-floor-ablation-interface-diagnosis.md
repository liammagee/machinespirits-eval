# Program 2 floor ablation: interface-mediated masking diagnosis and implementation handoff

Date: 2026-07-24
Status: read-only diagnosis and implementation handoff; **not** a preregistration, result amendment, or license for another model-backed run

## Executive conclusion

The current floor ablation is not evidence that fine-tuning made no difference.
It was designed to answer the narrower historical question, “Can the untuned
mini reproduce the Phase 5b committee result behind the exact committee-v2 /
fallback-v2 harness?” It is now being read as if it answered the broader
mechanism question, “Did fine-tuning create a useful corrective disposition?”
Those are different estimands.

The traces show a descriptive parametric signature upstream: the trained mini
uses the frozen warrant cue substantially more often than the untuned mini.
The committee-v2 interface then discards much of that advantage because it
protects question sentences only, while the trained cue often appears in a
preceding statement. At the same time, fallback-v2 repairs the untuned mini's
stronger question-discipline advantage and selects/resamples directly on cue
presence. The harness is therefore a treatment mediator and outcome-aware
filter, not a neutral transmission channel.

The current preregistered result remains governed by its frozen reading grammar.
Because completion/attrition makes the cohort under-informative, no confirmatory
claim about trained weights, practical equivalence, or harness sufficiency is
licensed. Everything below is a post-hoc diagnostic to explain that result and
design the correct successor.

## Why the known cue-loss defect recurred

This was intentional experimental scoping, not an unnoticed code regression:

1. The floor-ablation preregistration names Phase 5b as its parent and freezes
   committee-v2, fallback-v2, the v1 point-of-action audit, and a single
   trained-versus-untuned seam: `--committee-mini-model`.
2. The workplan likewise says to preserve committee-v2 and fallback-v2 so the
   ablation can price the historical Phase 5b system.
3. Phase 5d's repair (`spanCue.v1` plus `deliveryGuard.v1`, committee-v3) was
   implemented on the separate pinned claim-run lineage. The final machinery
   commit/tag is `27aae3b7` / `archive/program-2-phase5-pinned-runtime`; it is
   not an ancestor of the current floor-ablation branch.
4. The original workplan version explicitly made the archived lineage
   provenance-only and placed Phase 5d committee-v3 out of scope.

The methodological mistake was not preserving the old system. That is valid
for attributing the old Phase 5b production result. The mistake was treating
“same harness in both arms” as “neutral measurement of the mini.” The same
lossy, target-aware harness interacts differently with the two models and can
mask a real first-draft difference.

There is a second limitation: Amendments 1–4 changed other runtime behavior
enough that the preregistration already requires historical absolute
comparisons to be descriptive and stratified by harness revision. Preserving
the old extractor therefore bought less historical comparability than the
original design assumed, although the contemporaneous trained-versus-untuned
comparison remains same-harness.

## Interim trace evidence

These counts are exploratory, from the currently sealed Amendment 4 traces.
They are not substitutes for W1–W3 and must be regenerated from the final
checkpoint by a committed analyzer.

| Surface/component | Trained | Untuned | Diagnostic reading |
|---|---:|---:|---|
| Raw mini contains frozen cue | 45/55 = 0.818 | 36/71 = 0.507 | Strong descriptive first-draft weight signature |
| Raw mini has exactly one question | 38/55 = 0.691 | 64/71 = 0.901 | Training has a competing question-discipline cost |
| Raw mini has cue + exactly one question | 28/55 = 0.509 | 33/71 = 0.465 | Component gains and losses nearly cancel under the conjunction |
| Frozen v1 extracted span contains cue | 23/55 = 0.418 | 24/71 = 0.338 | The extraction boundary erases most of the cue advantage |
| Cue-bearing raw reply loses cue at span | 22/45 = 0.489 | 12/36 = 0.333 | Loss is differential, not neutral |
| Deterministic v2 counterfactual has cue + one question | 42/55 = 0.764 | 36/71 = 0.507 | Cue-preserving, non-generative extraction exposes the upstream difference |

One trained moment is an extreme degeneration (17,482 characters, 2,959 words,
44 question marks). Excluding that moment does not remove the broader
question-discipline gap. It should be reported separately as a serving/prompt
robustness case, not allowed to explain away the aggregate pattern.

Artifact routing appears correct at trace level: all 55 trained moments name
`program2-sft-instruct-v2`; all 71 untuned moments name
`program2-floor-instruct-q8`. A digest/template/serving-pin audit is still
required before ruling out artifact provenance issues completely.

## Reconciliation with the earlier preconscious results

The project needs to preserve three distinct mechanisms:

1. **Advice:** a second model notices a problem and tells the frontier model
   what to do, while the frontier retains authorship. Superegos, prompt books,
   side coaching, and related preconscious interventions repeatedly showed an
   insight–action gap here.
2. **Parametric specialist generation:** a trained mini directly generates a
   better public-action primitive. The raw cue-rate difference is evidence of
   this narrower effect, consistent with the Phase 2 held-out cue movement.
3. **Protected/enforced delivery:** an interface preserves, selects, repairs,
   or substitutes the specialist's primitive. This can work operationally, but
   the resulting gain belongs jointly to the mini and harness.

There is therefore no necessary contradiction. Words delivered as ignorable
advice can fail while weights change the specialist's first-draft distribution.
The current interface can then erase that parametric change before delivery.

The strongest licensed claim at present is narrower than “weights work”:
fine-tuning moved the intended cue component but did not produce uniformly
better bounded conduct, and its marginal value inside a target-aware live
harness remains unresolved.

## Implementation requested from the main thread

### Phase A — preserve and close the current cohort

1. Do not alter prompts, policies, traces, state, current results, or runtime
   behavior while the existing cohort is active.
2. Complete only the existing preregistered launcher/checkpoint path.
3. Run the frozen analyzer unchanged and retain its official
   `incomplete_or_under_informative` reading if the completion gate fails.
4. Keep the mediation analysis below in a separate artifact explicitly labeled
   `post_hoc_exploratory`; it must not rewrite W1–W3 or their reading grammar.

### Phase B — implement a zero-call mediation analyzer

Suggested file:
`scripts/analyze-program2-floor-ablation-mediation.mjs`

Suggested outputs:

- `exports/program2-committee-floor-ablation-amendment-4/mediation-analysis.json`
- `exports/program2-committee-floor-ablation-amendment-4/mediation-analysis.md`

The analyzer should:

1. Select only authoritative sealed traces using the same final-trace rule as
   the frozen analyzer. List failed attempts, interrupted traces, and finalized
   attrition separately; never silently pool them.
2. Join each `program2_committee_moment` to the authoritative completed tutor
   turn and frozen point-of-action audit by run/turn identity.
3. Record the component vector at each observable surface:
   - raw `miniText`;
   - frozen v1 extracted `span`;
   - raw `composedText`, including battery-failed candidates;
   - selected fallback envelope (`deliveredFallbackText` or the original mini
     where unchanged);
   - committee-approved envelope;
   - finalized learner-facing tutor text after release/staging/response checks.
4. At every surface report:
   - frozen cue presence;
   - question-mark count and exactly-one-question;
   - cue + exactly-one-question conjunction;
   - source/fallback resolution;
   - text equality/containment relative to the prior surface;
   - where available, frozen no-new-premise, guard, and full compliance fields.
5. Produce a transition waterfall by arm:
   `raw mini -> v1 span -> composition -> fallback/approval -> final delivery`.
   Count cue loss, cue restoration, question repair/regression, overwrite, and
   final audit outcome at every transition.
6. Report by arm, learner profile, dialogue, and matched `pairKey`. Use dialogue
   as the cluster and the preregistered profile stratification for descriptive
   bootstrap intervals, but label all new endpoints post hoc.
7. Report the extreme trained degeneration separately and repeat descriptive
   component tables with that moment excluded as a sensitivity analysis. Do
   not use the sensitivity result to replace the full-sample result.
8. Reproduce the interim counts above or explain every discrepancy from the
   authoritative final-trace selection.

### Phase C — deterministic cue-preserving counterfactual

Within the same analyzer, add a zero-model, text-only counterfactual based on
the already documented offline span-v2 rule:

1. Select one question sentence, preferring a cue-bearing question.
2. If no question carries a cue but an existing statement does, carry that
   statement ahead of the selected question.
3. Never generate, resample, add, or paraphrase a cue.
4. Report `no_span` when the mini supplied no valid question.

This is an interface-fidelity diagnostic, not a counterfactual final-compliance
estimate: without a fresh composer/delivery call it can establish what signal
the interface would preserve, not what the final tutor would have said.

Add unit fixtures covering:

- cue in question;
- cue only in statement;
- no cue anywhere;
- multiple questions with one cue-bearing candidate;
- no question;
- malformed quotation/whitespace;
- the 44-question degeneration without unbounded runtime or output.

### Phase D — verify model provenance

After the live process has ended, record without changing either artifact:

- Ollama model name and digest;
- underlying GGUF/artifact digest if exposed;
- modelfile/template/system-message configuration;
- `num_ctx`, `think`, temperature, and token settings for greedy first drafts;
- sampled fallback settings;
- correspondence to the Phase 2 floor and verified-merge SFT manifests.

Fail the provenance audit on alias collision, identical unexpected digests,
template drift, or serving-pin mismatch. Treat trace model names as necessary
but not sufficient evidence.

## Successor experiment — design only, no launch license

Do not simply rerun trained versus untuned with committee-v3. Phase 5d's
`spanCue.v1` resamples specifically for the measured cue and can again equalize
the arms. The clean successor should separate skill from transmission and
enforcement.

Recommended minimal factorial:

| Factor | Levels |
|---|---|
| Mini weights | trained / same-lineage untuned |
| Interface | frozen question-only v1 / cue-preserving, non-generative v2 |

For the causal weights contrast, the delivery harness may enforce nuisance
constraints such as non-empty output, span containment, exactly one question,
public-evidence safety, and no new premise. It must **not** reject, resample,
trim, or select based on the cue whose incidence is the outcome.

Pre-register separate endpoints:

1. **First-pass skill:** raw semantic warrant move and frozen cue rate.
2. **Transmission fidelity:** how much first-pass skill survives the interface.
3. **Correction burden:** fallback/resample count, latency, and failure rate.
4. **Final system compliance:** operational result after all permitted checks.
5. **Semantic validity:** blinded assessment of whether the question actually
   asks the learner to connect public evidence to an inference/warrant,
   independent of the six-word lexicon.

Use the same frozen moments offline first. A live run requires a fresh
pre-registration, explicit provider approval, new seeds, and a clean pinned
runtime only after the zero-call mediation report is reviewed.

## Acceptance criteria for the implementation handoff

- The current frozen analyzer and original traces remain byte-unchanged.
- No provider or local-model calls are made for Phases B–D except the read-only
  local Ollama metadata query after the running process ends.
- Authoritative sealed-trace selection is tested against retry, attrition, and
  interrupted-trace cases introduced by Amendments 5–6.
- Machine-readable and Markdown reports agree exactly.
- All numeric claims in any paper/workplan update trace to the final generated
  mediation report; the canonical paper is updated before any spin-off.
- The write-up explicitly distinguishes historical Phase 5b attribution,
  parametric first-draft change, interface transmission, and final operational
  value.

## Source pointers

- `PROGRAM-2-COMMITTEE-FLOOR-ABLATION-PREREGISTRATION.md` §§1–5
- `workplan/items/program-2-committee-floor-ablation.md`
- `notes/program-2/2026-07-22-cue-attrition-observation.md`
- `PROGRAM-2-PHASE5D-DELIVERY-INTEGRITY-PREREGISTRATION.md` §§1–3, §9
- `services/program2CommitteeEngine.js`
- `scripts/program2-coupling-probe.mjs` (`--span-mode v2`)
- `scripts/analyze-program2-committee-floor-ablation.mjs`
- `docs/research/paper-full-2.0.md` §§6.20–6.22

## Copyable instruction for the main thread

> Read `notes/program-2/2026-07-24-floor-ablation-interface-diagnosis.md` and
> implement Phases B–D after confirming the Amendment 4 cohort is no longer
> running. Preserve the frozen analyzer and original traces. Start with the
> zero-call mediation analyzer, deterministic cue-preserving counterfactual,
> fixtures, and model-provenance audit; do not launch a successor experiment or
> modify Paper 2.0 until the generated report has been reviewed.
