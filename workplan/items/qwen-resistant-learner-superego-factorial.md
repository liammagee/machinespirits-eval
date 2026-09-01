---
id: qwen-resistant-learner-superego-factorial
title: "Test Luna superego with normal and abliterated Qwen learners"
status: done
type: experiment
priority: P2
owner: codex
source: manual
created: 2026-08-30
updated: 2026-09-01
verification: "All four eight-turn dialogues complete; 112/112 attempts used (96 generation, 16 Opus). User-approved index-only repair reused the original A learner reply; 14 remaining assessments attempted once. Fifteen assessments fully accepted; final D quality reply lacks eight reopened-objection labels. All requested quality scores and v2.2 rubrics are available; D reopening and combined novelty counts remain missing, never imputed. Updated private Techne comparison includes exact swimlanes, ordinal scores, timings, original reasoning and analyst caveats. Sixteen focused tests, lint and diff checks passed. No push/publication."
claim_status: exploratory
links:
  items:
    - qwen-resistant-learner-model-benchmark
    - local-qwen-resistant-learner-mvp
  notes:
    - notes/qwen-superego-factorial-v1-design.md
tags: [local-model, qwen, learner-superego, resistant-learner, tutor-stub]
---

# Qwen × Luna resistant learner factorial

Prepare and, only after explicit GO, run one fresh eight-turn dialogue for each
normal/abliterated Qwen × direct/Luna-superego condition. Sol medium remains the
tutor. Shared prompts address semantic repetition, reopened objections, fixed
speech templates, and hypothetical-versus-observed evidence. The same Qwen
authors the final learner turn after at most one private Luna critique.

## Acceptance

- [x] Prospective design fixes four conditions, order, routes, prompts,
  measurement, stopping rules, claim boundary and exact 112-attempt ceiling.
- [x] Default launcher is zero-call; live mode is explicit; output is
  create-once with reserve-before-call ledgers and exact realized route/count checks.
- [x] Independent Opus scoring is blinded to condition and covers v2.2 tutor,
  learner and dialogue instruments plus requested quality/novelty/character axes.
- [x] Semantic repetition, reopened objections, grounded novelty and unsupported
  evidence are turn-level, reasoning-bearing assessments; lexical metrics stay auxiliary.
- [x] Report uses Techne and shared public-dialogue swimlanes; synthetic preview
  is visibly marked and a report-only loopback server exposes no workspace files.
- [x] Host-context Claude Code sign-in verified without inference; browser preview
  checked at 1440px and 390px, with theme, anchors and expanded assessments.
- [x] User issues the explicit GO naming transfers and 112-attempt ceiling.
- [x] Run completes or stops at first substantive/configuration/budget failure;
  preserve all partial attempts and report without resampling.

## Execution outcome · initial stop, preserved history

- Private archive: `.tutor-stub-traces/qwen-superego-factorial-v1/` in this
  isolated worktree. `report.html` is the locally previewed, self-contained
  partial report; `report-data.json` and `public-dialogues.json` contain its data.
- Generation: A normal/direct 16 calls; B abliterated/Luna 32; C normal/Luna 32;
  D abliterated/direct 16. All 32 exchanges completed; realized routes and counts
  matched. No model errors, retries, prompt recovery or configuration drift.
  Native tutor guard findings remain visible outcomes (3, 4, 5 and 4 turns).
- Judging: the first assessment was accepted. The second returned all eight
  learner rows numbered 1–8, while the scorer requires 0–7. The inherited prompt
  labelled target turns 1–8 but showed a zero-based JSON example. The rejected
  response and failed reservation are intact; no normalization, resampling,
  further judging or substituted analyst scores. Total attempts: 98/112.
- All primary quality comparisons and the superego triage result are unavailable.
  Direct transcript reading finds concrete repetition with and without Luna;
  Sol also repeats prompts. These observations are not the missing Opus result.
- Median whole-learner latency in seconds: normal/direct 32.832,
  normal/Luna 70.3015, abliterated/direct 25.146, abliterated/Luna 73.1635.
  This is one divergent dialogue per condition, not a replicated speed estimate.
- Report rendering was repaired after the stop to display incomplete scoring
  honestly, with a regression check. The model prompts and run evidence were not
  changed. Further judging needs an explicit decision about this stopped run;
  this card does not authorize it.

## Authorized continuation · comparison under review

- The user approved the proposed index-only correction and remaining 14 Opus
  assessments. Only A learner indices changed from 1–8 to 0–7; every score and
  reason was preserved. Tutor and learner prompts now explicitly specify the
  same zero-based output convention. No dialogue or valid assessment was rerun.
- All 112 attempts are used: 96 successful generation calls and 16 judge replies.
  Fifteen assessments are fully accepted, including the corrected saved reply.
  The final D quality reply omitted `accepted_objection_reopened` for all eight
  learner turns. The original two failed validation events and raw replies remain
  intact. No model is active, and no further inference is authorized under this cap.
- All tutor, learner and dialogue v2.2 assessments are complete, as are all four
  requested quality scores for every arm. The partial D reply's returned fields
  were validated for reporting without changing the live acceptance rule. Only
  D's reopening count and combined fresh-grounded endpoint are unavailable;
  missing labels are not treated as false or replaced by analyst scores.
- Overall quality / successful pedagogy: both direct dialogues 3/5, both
  Luna-assisted dialogues 2/5. Surprise 2/5 and character adherence 3/5 throughout.
  Semantic repeats: A 2/8, B 3/8, C 1/8, D 1/8 (D from the partial assessment).
  Fresh-grounded turns: A 5/7, B 4/7, C 6/7, D unavailable. Normal Qwen gains only
  one such turn and loses pedagogy, so the predeclared promising rule is not met;
  the abliterated endpoint contrast remains unavailable.
- Learner rubric /100: A 63.3, B 62.7, C 70.3, D 61.1. Dialogue rubric /100:
  A 71.3, B 42.5, C 45.0, D 62.5. Normal+Luna improves local learner-rubric quality
  while the conversation score falls: careful objections need not make a
  developing encounter. These are descriptive measurements, not causal estimates.
- Evidence supports comparing these four performances. Both variants can produce
  concrete resistant counterexamples, but the character's personal stake is weak,
  repetitions remain, and Sol repeatedly asks already-answered questions. Luna
  adds about 2.1× normal / 2.9× abliterated whole-learner latency in this sample
  without improving requested overall quality or pedagogy ratings.
- Judge limitations remain visible: B's claim that only one clue enters overlooks
  distinct public disclosures; missing uptake after final tutor turn 8 is a
  designed horizon limit, not observed learner refusal. No judge values were edited.
- Updated create-once private report:
  `.tutor-stub-traces/qwen-superego-factorial-v1/scoring-recovery-v1/report.html`.
  Adjacent `report-data.json`, `public-dialogues.json`, `observations.json`,
  corrected-index derivative, recovery provenance, all new prompts/replies and
  append-only ledger preserve the continuation. The original partial report is
  unchanged. The card was left under review pending board reconciliation; no
  commit, push, publication or new study followed from the result.

## Boundary

This is an exploratory engineering comparison with one divergent dialogue per
condition. It does not estimate a causal model or superego effect, rank the
checkpoints generally, validate human learning, or amend Paper 2.0. The treatment
bundles Luna advice with an extra Qwen revision pass.

## Preparation record

- 2026-08-30 — Explicit user GO recorded in
  `notes/qwen-superego-factorial-v1-go-2026-08-30.md`. Launching the prepared
  bounded run; no push or publication authority.

- 2026-08-30 — Four real runner dry-runs completed with no model calls. Injected
  end-to-end test exercises 96 generation slots + 16 scoring slots, exact route
  checks, create-once output, early failure stop and report generation.
- 2026-08-30 — Disabled the inherited CLI retry policy for this experiment only.
  Added early stopping for empty/token-ceiling local learner output and empty
  Luna critique. No new source-digest or signature gate.
- 2026-08-30 — Browser preflight found and fixed an inline-script closing-tag
  packaging defect. The corrected self-contained report uses no remote assets.
  Synthetic preview is not study evidence; live output directory remains unused.

## Board reconciliation — 2026-09-01

Closed as a bounded exploratory result. All 112 authorized attempts are used,
the four dialogues and requested aggregate quality scores are present, and 15
of 16 assessments are fully accepted. The absent D reopening labels and combined
novelty endpoint remain measurement-indeterminate rather than pending work; no
further inference is authorized under this cap. No model calls were made during
reconciliation.
