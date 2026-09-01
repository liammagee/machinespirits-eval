# Qwen hostile refusal: contemporary two-checkpoint acting comparison

Workplan item: `qwen-hostile-refusal-comparison`.
Authorized by the user's instruction to run both variants without superego and
use the same scoring pattern. Prepared prospectively before any new model call.
No push, publication, paper edit or production database ingestion.

## Design and character

Two fresh eight-turn learner–tutor dialogues: normal Qwen first, abliterated Qwen
second. One dialogue per condition, full public histories diverge; no resampling
or independent-turn inference. Both use the existing contemporary world
`world_030_rowan_flat`, unchanged public opening and clue schedule (2, 3, 5, 7),
and `dramatic-detective@v1` with Sol medium as speaking tutor. The final clue has
one subsequent learner turn, unlike the earlier eight-turn Marrick test.

Alex is an adult tenant who rejects being conscripted as an unpaid investigator
or pupil while facing a household leak. Their personal stake is time and control
over responsibility, not proving a pet diagnosis. The profile explicitly permits
aggressive sarcasm and pointed mockery, tied to the tutor's actual move; no violent
threats, discriminatory slurs or invented history. The authored behavior override
is separately surfaced in YAML and replaces the canonical frame-refuser's
non-mocking tone. Canonical profiles and historical evidence remain unchanged.

This is active refusal, not another counterexample hunter. Alex withholds causal
answers and diagnostic work, pushes practical responsibility, responds to real
concessions, and need not repeat a refusal slogan or produce a joke each turn.
The existing cooperative-progress overlay is off. No scripted public utterances,
semantic role repair, classifier, superego, self-revision or fallback learner.
The tutor's native deterministic guards remain; their effects are reported.

## Routes and ceiling

- Local learners: `mlx-community/Qwen3.8-27B-4bit` and local
  `Qwen3.8-27B-Uncensored-MLX/4-bit`, 4-bit checkpoints. Thinking and MTP off,
  temperature 0.6, 900 output tokens, local service seed 17 (no cross-provider
  determinism claim). Matched service settings and a restart for each arm.
- Sixteen local Qwen calls + sixteen Sol calls = 32 generation attempts.
- Claude Opus 5 through tools-disabled Claude Code, medium: four assessments
  per public transcript = eight judging attempts. Same route as the preceding
  authorized comparison; only new public transcripts, character and rubrics
  go to Opus. No private prompts, hidden world state, drafts or traces.
- **40 total attempts maximum**, including local inference. No additional
  canary, retry, fallback route or outcome-selected rerun. CLI usage is not
  represented as a particular dollar cost.
- Existing reserve-before-call accounting and create-once archive are reused.
  Empty/truncated output, route drift, model errors, malformed assessments or
  indeterminate measurement stop execution. All attempted outputs are preserved.
  Complete ordered 1–8 rubric indices may be losslessly normalized to 0–7 with
  a recorded derivative; missing judgments are never imputed or resampled.

## Measurement and reporting

Same four scoring calls: v2.2 batched tutor-turn rubric, v2.2 batched learner-turn
rubric, v2.2 public-dialogue rubric, and four 1–5 scores for overall quality,
successful pedagogy, surprise/non-repetition and character adherence.
All eight generated turns per speaker are scored; opening is context only.
The judge is blind to checkpoint identity. Character and setting are updated
consistently across prompt families; the existing v2.2 dimensions are unchanged.

Turn-level quality annotations retain semantic repetition, substantive moves,
reopened accepted objections, character fidelity and unsupported evidence for
both speakers. In this refusal setting, a substantive move changes the interaction,
contested boundary or practical agenda—not necessarily the causal investigation.
Continuing a genuinely unresolved refusal is not reopening an accepted objection;
fresh wording alone is not development. This contextual operationalization is
declared before generation and cannot be pooled with the earlier counterexample
learner's fresh-evidence endpoint. No prior Luna promising threshold applies.

Separate successful acting from pedagogy: convincing refusal may yield little
learning, and polite compliance may be a character failure. Report all measures
and disagreements, not an invented single pass mark. Direct transcript reading
will inspect the target and development of mockery, credible stakes, repeated
tactics, unwanted cooperation and tutor-induced stasis without replacing scores.

Report whole learner latency, final Qwen output rate (end-to-end, not decoder
throughput), tutor time, arm wall time and judge overhead. Lexical measures remain
auxiliary, not semantic judges. Techne report uses exact public swimlanes and
expandable Opus reasoning. Private archive:
`.tutor-stub-traces/qwen-hostile-refusal-comparison-v1/`. Preview serves only the
self-contained report on loopback. Record source commit and dirty tree, not a
source-bound approval. The previous 112-attempt archive is untouched.

This tests two checkpoint performances in one role/world, not human realism,
learner transportability, a causal abliteration effect or a general model ranking.
