# Qwen resistant-learner 2×2 — readying an exploratory engineering test

Status: Executed after explicit GO on 2026-08-30. After the initial index-only stop,
the user approved correction and the remaining assessments: 112/112 attempts used,
15 fully accepted assessments and one partial quality reply missing the reopening
annotation family. All four public transcripts, requested quality scores and v2.2
rubrics are available. The prospective rules below are unchanged. Outcome:
`workplan/items/qwen-resistant-learner-superego-factorial.md`.
Workplan item: `qwen-resistant-learner-superego-factorial`.

## Question and fixed design

Does one private Luna critique followed by Qwen's own revision help Qwen sustain
an active, believable resistant learner, without repeating itself or inventing
evidence? Test normal and abliterated Qwen separately. Agreement with the tutor
or solving the mystery is not the primary success criterion.

Four fresh, free-running dialogues; eight learner–tutor exchanges each. All use
the existing counterexample-hunter Tamsin brief, Marrick world, dramatic-detective
tutor, Sol medium, Qwen temperature 0.6, 900-token ceiling, thinking off, and MTP
off. The two model files remain normal `mlx-community/Qwen3.8-27B-4bit` and local
`Qwen3.8-27B-Uncensored-MLX/4-bit`; this is a checkpoint comparison, not proof
that abliteration alone caused any difference. No old transcript is reused.

| Fixed order | Qwen | Learner mechanism | Local Qwen | Sol | Luna | Opus | Total |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| A | Normal | Direct | 8 | 8 | 0 | 4 | 20 |
| B | Abliterated | Draft → Luna critique → same Qwen revision | 16 | 8 | 8 | 4 | 36 |
| C | Normal | Draft → Luna critique → same Qwen revision | 16 | 8 | 8 | 4 | 36 |
| D | Abliterated | Direct | 8 | 8 | 0 | 4 | 20 |
| Total | | | 48 | 32 | 16 | 16 | **112** |

This order is fixed, not selected from outcomes. Service profiles are restarted
for every arm with the same resource settings. Seed 17 is recorded in the local
service configuration; no deterministic cross-provider sampling guarantee is
claimed. Full public histories diverge after the opening. Neither the four
dialogues nor their turns are independent replicated treatment estimates.

The treatment bundles Luna advice **and** an extra Qwen pass. It cannot identify
Luna's contribution separately from extra inference time. A later Qwen-only
self-revision control would be needed for that question; it is not a fifth arm
silently added to this run.

## Anti-repetition intervention held common across all four arms

`active_resistance_v2` replaces the earlier plain system style in **every** arm:

- Keep track privately of observations, untested hypotheses, and settled objections.
- Retire answered objections unless genuinely new evidence reopens them.
- Choose an inference-changing move, not a synonym or a new prop in an old template.
- Distinguish suggesting a test from observing its result. Do not invent findings.
- Allow a precise concession or an honest unresolved limit; do not force a novel
  objection every turn. Preserve Tamsin's stake and skeptical voice.
- Avoid a repeated “I accept X, but Y” or trial-book-entry performance.

No scripted turn schedule, random surprise quota, repetition penalty, memory
retrieval, hidden proof hints, automatic redraft, or outcome-selected continuation.
Direct arms receive one Qwen call. Superego arms receive exactly one Luna low-effort
critique (`evidence_novelty_v2`) and one Qwen revision. Luna sees the public history,
private character brief, and current draft—not hidden proof state or scoring
targets—and must diagnose rather than write the learner's speech. Qwen retains
final authority. Public feedback from the judge never enters generation.

The tutor and ordinary deterministic guards are unchanged in all arms. Tutor
repetition and unsupported claims remain visible outcomes, not quietly repaired
confounds. The final tutor move has no ninth learner uptake turn.

## Measurement, decided before GO

Claude Opus 5 via the isolated, tools-disabled Claude Code bridge at medium
effort makes four calls per completed transcript: batched v2.2 tutor-turn rubric,
batched v2.2 learner-turn rubric, v2.2 public-dialogue rubric, and the requested
quality/character assessment. All 32 generated tutor and 32 learner turns receive
the corresponding rubric; the fixed opening is context, not a scored response.
Model identities, mechanism labels, private drafts and critiques are withheld
from judge prompts. Judge sees exact public text and the same character brief.

The fourth assessment scores overall quality, successful pedagogy, meaningful
surprise/nonrepetition, and character adherence (1–5), with reasoning. It also
labels every learner turn for substantive new contribution, semantic repetition
of an earlier turn, reopening an answered objection, and unsupported evidence
assertion; evidence assertions are assessed for **both speakers**. A conditional
test is not a fabricated observation. Unsupported means unsupported by the public
record: this is not an independent hidden-world truth assessment.

Primary descriptive endpoint: count of learner turns 2–8 with a substantive
contribution, no semantic repeat, no reopened settled objection, and no unsupported
evidence assertion. Count 0–7. Report semantic repeats, reopened objections,
invented observations and character/pedagogy scores separately rather than hide
trade-offs in a single aggregate.

For each model, mark the superego bundle **promising for a replicated follow-up**
only if it adds at least two primary-endpoint turns versus direct, character
adherence is at least 3/5 and no lower than direct, successful pedagogy is no lower,
and unsupported learner assertions do not increase. Otherwise mark **not yet
demonstrated**. This is a practical triage rule, not statistical significance or
a validated instrument. Any measurement-indeterminate result stops scoring and
leaves the comparison indeterminate; no analyst substitute or judge resampling.

Speed: report model-loading/wall time separately; final Qwen latency and output
tokens; whole learner-mechanism latency including draft, Luna, revision; tutor and
judge overhead. Token rate is end-to-end output rate, not decoder throughput.
Lexical bigram overlap/distinctness is auxiliary: fresh wording cannot establish
fresh reasoning. Log all guard findings, prompt compaction, empty/truncated output,
provider errors and configuration drift; never delete failed attempts.

## Boundaries, output and stopping

112 is a hard **attempt** ceiling, including 48 local calls and 64 external CLI
calls. CLI subscription usage is not asserted to be a particular dollar cost.
No spare attempts, retries, fallback models, resampling or valid-output reruns.
Generation is sequential and attended; each arm has its own exact 16/32-call
meter, allocated before starting. Judging has its own 16-call reserve-before-call
ledger. A failed/incomplete arm, unexpected route/call count, malformed judge
output, indeterminate judgment, or budget exhaustion stops the run and preserves
the partial record. An incomplete result is not permission to run another arm.

Private create-once output: `.tutor-stub-traces/qwen-superego-factorial-v1/` in
the existing isolated worktree. Save realized specs, service config, stdout,
snapshots, copied complete traces, call ledgers, judge prompts/raw replies/scores,
exact public-dialogue interchange, and HTML. Record git commit and dirty status;
do not bind permission to source hashes or require a fresh signature for bug fixes.
No production DB ingest, publication claim, paper edit, commit, push or deployment.

The report uses Techne and the shared dramatic-dialogue renderer: two within-model
direct/superego swimlane pairs, all rubric reasoning, quantitative comparisons,
turn-level qualitative labels, and conspicuous limitations. It must distinguish
mock preview data from live evidence and incomplete from scored results.

## Avoid the previous Opus and browser blockers

**Opus:** the prior call was blocked before execution because private-transcript
transfer to Opus was not explicit. The future GO below explicitly names the new
transcripts, destination, evaluation and ceiling. Check the installed CLI and
stored authentication status without generation; a zero-call check cannot prove
live model entitlement, quota or service availability. No paid canary is added.
The first real judge request is one of the 16 budgeted calls. A route/access or
schema failure is preserved and stops, with no substitution or retry. The bridge
uses isolated temporary working directories, safe mode, no tools and no session
persistence; judge prompts contain no private learner deliberation or repo files.

**Browser:** do not revisit the blocked `file://` route or use another browser to
evade policy. Test a synthetic report on a dedicated 127.0.0.1 HTTP preview that
serves only its self-contained HTML with shared assets inlined; no directory listing, workspace,
traces, keys or `.git`. Use the supported app browser, desktop and narrow viewport,
theme toggle, anchors and expandable score details. If localhost is also blocked,
stop browser work and report visual QA as unavailable; a GO cannot override that
policy. Generation/scoring artifacts remain useful independently of browser QA.

Zero-call preflight on 2026-08-30: both model CLIs are installed. Claude Code's
host-context authentication check reports signed in to the existing Max account;
the restricted sandbox falsely reports no session because it cannot read the
host credential store. Live commands therefore need the ordinary host execution
permission, not another login or another model/provider. The supported app
browser successfully rendered the synthetic report through report-only loopback
HTTP at desktop and narrow widths, with theme switching, anchors and expanded
assessments. This confirms the preview path, not the quality of an unrun experiment.

## Launch handoff

Preparation: `node scripts/run-local-qwen-superego-experiment.js` (zero-call default).
After the user's GO only: same command with `--live`. No new sign-off ceremony.

Suggested approval:

> GO for qwen-superego-factorial-v1: run the four fresh eight-turn dialogues with
> normal and abliterated local Qwen, each with and without Luna superego, using Sol
> as tutor. I authorize the public dialogue context and character brief to Sol,
> those plus Qwen drafts to Luna for private critique, and the four new public
> transcripts plus character brief and rubrics to Claude Opus 5 via Claude Code
> for 16 evaluations. Save all results in the private experiment archive, preview
> the report locally, and do not exceed 112 total attempts. Do not push or publish.

## Deferred mechanisms worth considering

Only after inspecting this run: a Qwen self-revision control (extra-pass confound),
a compact persistent settled-objection ledger (memory vs prompt instruction),
explicit observed/hypothetical evidence state shared with the tutor, and a second
character/world with replicated, counterbalanced order. Increasing temperature or
penalizing repeated words is not the first fix: it can reward different wording
or invented evidence instead of better reasoning. No such extra run is authorized
by the GO above.
