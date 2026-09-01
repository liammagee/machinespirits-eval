---
id: qwen-hostile-refusal-comparison
title: "Compare normal and abliterated Qwen as an aggressive refusing tenant"
status: done
type: experiment
priority: P2
owner: codex
source: manual
created: 2026-08-30
updated: 2026-09-01
verification: "Both eight-turn dialogues and all eight assessments complete. Fresh four-call allowance used exactly four observed Opus responses, no helper usage observed; original dialogues and accepted normal scores unchanged. Full output schemas and rubric checks pass, 59 focused tests pass, private report preview has 34 public messages and 32 assessment expanders. Historical call total remains unverified; no push or publication."
claim_status: exploratory
links:
  notes:
    - notes/qwen-hostile-refusal-comparison-v1-design.md
  items:
    - qwen-resistant-learner-superego-factorial
    - local-qwen-resistant-learner-mvp
tags: [qwen, local-model, refusal, learner-profiles, tutor-stub]
---

# Aggressive refusal in a contemporary world

User requested both Qwen variants, no superego, same scoring pattern. The
prospective [design](../../notes/qwen-hostile-refusal-comparison-v1-design.md)
defines the angry tenant, two matched conditions, scoring and 40-attempt ceiling.
This is new private evidence; the previous factorial remains unchanged.

## Acceptance

- [x] Explicit learner behavior, character and tone are configurable without
  contradictory inherited instructions or private-world leakage.
- [x] Focused tests and both zero-call dry runs pass before generation.
- [x] Both dialogues and all assessments complete or stop honestly within cap.
- [x] Exact public swimlanes, quality/rubric reasoning, speed and qualitative
  interpretation are archived and previewed locally, with no push or publication.

## Preparation

Both real runner dry runs resolve Rowan Flat, Sol medium and the intended local
checkpoint, with a 16-call arm budget and passing base prompt audits. The 25
focused comparison tests, 22 prompt/world tests and 35-world quality check passed.
Injected two-arm execution reserves exactly 32 generation plus 8 judging slots;
mock results are visibly marked. No live inference during preparation.

The attempted live launch was rejected by the execution approval guard before
process creation: it requires an explicit new-payload transfer approval naming
Sol and Claude Opus 5. No live archive was created and no inference ran (0/40).
No workaround, substituted route or partial paid launch was attempted. The
prepared design and passing checks remain valid; this is an execution-permission
hold, not a change to the study or a source-signature requirement.

The user subsequently answered “Yes” to explicit permission for Alex's fictional
brief and dialogue context to Sol, and the two public transcripts, brief and
rubrics to Claude Opus 5, under the unchanged 40-attempt ceiling. Execution is
authorized; results remain private with no push or publication.

## Execution and findings

Both dialogues completed: normal 8/8 exchanges and abliterated 8/8, exactly
16 local learner plus 16 Sol calls, no generation failures, repair calls,
superego passes or reruns. Realized routes match the plan.

Scoring stopped twice. The third reply contained all six dialogue-rubric
judgments plus an extra explicitly non-rubric field. A zero-call projection
retained all required scores/reasons unchanged and archived the extra field.
The bounded continuation then made only one new call: the normal quality reply
had a malformed outer envelope and omitted reopening judgments on turns 2–8.
No judgments were imputed and no further model call was made. The original
replies, stop records and continuation are immutable private evidence.

Usage at the first continuation stop: **36/40 recorded study attempts**. Three complete normal assessments, one partial
normal quality assessment, four abliterated assessments unattempted. Available
normal quality ratings are 2/5 overall, 2/5 pedagogy, 2/5 non-repetition and
3/5 character; these are partial evidence, not a paired Opus comparison.

Direct reading: both models can launch sarcastic refusal, but neither sustains
varied resistance. Abliterated learner turns 5 and 7 exactly duplicate turns 4
and 2 respectively. Normal has no exact duplicates but semantic repetition in
the latter half. Tutor constraints and a narrow learner action space contribute
to the loop. This is an exploratory observation, not a general checkpoint ranking.

Private report: `.tutor-stub-traces/qwen-hostile-refusal-comparison-v1/reviewed-report-v2.html`.
The earlier report is retained; v2 corrects scoring-completeness wording and
dark-theme turn-number contrast. Local desktop preview, theme switch, expandable
reasoning, missing-data labels and all 34 public message cards checked.

## Current state

Paired scoring is complete and the private report is ready for review. No grading
or dialogue generation remains. The user separately approved the final four
assessments after the historical call-accounting problem was explained. The old
41-total-call ceiling is not claimed as met; the final four-call allowance is.
No follow-up experiment, push, publication or paper integration is authorized.

## Zero-call judge-output repair — 2026-08-31

The shared benchmark scorer now supplies an explicit output schema for each of
the four assessment families. Canonical rubric dimensions remain authoritative;
all eight extended learner and tutor annotations are required. Indeterminate
judgments remain allowed and stop scoring; missing judgments are never filled
with defaults. CLI and experiment entry points share the same scorer.

Claude's structured-output mode can re-prompt on validation failure. The new
opt-in single-attempt path sets one agent turn, zero API retries and zero schema
retries, and checks the returned turn count. These controls follow the
[CLI reference](https://code.claude.com/docs/en/cli-reference) and
[environment-variable reference](https://code.claude.com/docs/en/env-vars).
Both supported result envelopes are read without treating prose as an assessment.
Schemas and raw transport envelopes are saved privately before parsing, and a
failure records its missing field and stops without another call.

Verification: six focused test files cover the bridge, prompt transport, retry
policy, benchmark, refusal and factorial paths. The synthetic end-to-end test
checks reservation-before-call, exact call count and raw-envelope preservation.
Read-only checks on the original failures confirm all seven absent reopening
judgments are rejected, the extra dialogue dimension is rejected, and accepted
tutor/learner outputs remain valid under the new schemas. All schema variants
compile; original response hashes are unchanged. This repair adds **zero model
calls** and does not complete or retrospectively change the experiment.

## Explicit five-assessment continuation — 2026-08-31

The user explicitly approved five additional Opus assessments and a cumulative
41-attempt ceiling. A fresh `scoring-completion-v2` archive records that approval,
the unchanged sources and a 9-judge-attempt allocation (32 generation + 9 = 41).
The original design and old ledgers remain historical records, not rewritten.

Only the first new assessment ran. Opus returned all required judgments inside
`StructuredOutput.input.values`, a JSON string; Claude Code rejected that wrapper
and the scorer stopped. A zero-call extraction decoded the single tool payload
from one observed Opus message, validated it against the full schema and rubric
checks, and saved an explicit derivative. No scores, reasons or annotations were
changed. Normal quality remains 2/5 overall, 2/5 pedagogy, 2/5 non-repetition and
3/5 character, now with complete annotations: 3/7 developing moves, 4/8 semantic
repetitions, zero reopened accepted objections, one unsupported learner assertion
and zero unsupported tutor assertions. This is one judge's assessment, not a
definitive evidence audit or a paired checkpoint comparison.

The raw CLI result also reports `claude-haiku-4-5-20251001` usage. This is consistent
with Claude Code's documented background title request. The ledger has **37
intended study invocations**, but the known model-call lower bound is **38** once
that helper is included. Earlier helper calls cannot be audited from the original
plain-text responses; do not describe 38 as an exact cumulative total. Four more
assessments would require at least 42 known model calls, beyond 41, even if the
helper is suppressed. No further live request was made.

Zero-call follow-up suppresses title generation and non-streaming fallback in
single-attempt mode. The bridge now counts unique assistant response IDs rather
than treating Claude's tool-result handoff as another inference, checks for
unexpected model usage, and records lossless single-wrapper recovery explicitly.
Regression tests cover the observed split-response shape and reject a helper
model or a second response. These follow-up changes are tested offline only.

Updated report: `.tutor-stub-traces/qwen-hostile-refusal-comparison-v1/scoring-completion-v2/output-recovery-v2/report.html`.
The first recovery report is retained; v2 removes stale partial-score commentary
and shows the complete new normal assessment alongside the unresolved budget
boundary. Both conversations, prior valid scores, failed replies and all stop
records remain unchanged. No push, publication, new learner experiment or DB write.

## Final four assessments completed — 2026-08-31

User: “Yes finish the remaining four Opus assessments.” Exactly four additional
Opus responses were observed, with no helper-model usage observed. The first
returned a complete JSON text object instead of using the formatting tool; the
last wrapped complete JSON in a single `in` tool argument. Both were decoded
without changing judgments or making replacement calls. The other two outputs
also passed the full schema and rubric completeness checks. All original raw
outputs, failed local-validation records, dialogues and normal assessments remain
unchanged. The bridge now handles these lossless envelopes with one-response and
helper-use checks; 59 focused bridge/benchmark/refusal tests pass.

Final private report and machine-readable completion record:
`.tutor-stub-traces/qwen-hostile-refusal-comparison-v1/final-four-v1/completion/report-v2/`.
The preceding report remains archived. Desktop preview verifies 34 public message
cards, 32 assessment expanders, all eight accepted assessments and no horizontal
overflow. Original judge reasoning is retained, with visible cautions about
misordered-turn criticisms, exaggerated exact-repetition prose and authored
evidence being misclassified as invented. No post-hoc score correction or rerun.

Both quality assessments give 2/5 overall. Normal versus abliterated ratings are
2/1 pedagogy, 2/1 non-repetition and 3/2 character. Both have 3/7 developing moves;
abliterated has two exact repeated learner messages and reopens one conceded
ladder objection. The unchanged broad learner rubric reverses the direction
(34.1/41.1), so this is not an across-instrument winner or a general model ranking.
The ledger records 41 intended study invocations and at least 42 model calls when
the known earlier helper is included; the exact historical total is unverified.
All requested execution is finished. The private result was held in review for
board reconciliation, not as a new budget hold. Nothing pushed or published.

## Board reconciliation — 2026-09-01

Closed as a bounded exploratory result. Both dialogues, all eight assessments,
the private report, and the focused validation named above are complete. The
unverified historical helper-call total and the disagreement between instruments
remain explicit limitations; neither is unfinished execution or a license for a
general checkpoint ranking. No model calls were made during reconciliation.
