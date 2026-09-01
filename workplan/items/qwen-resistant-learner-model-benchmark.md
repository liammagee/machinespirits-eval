---
id: qwen-resistant-learner-model-benchmark
title: "Compare normal and abliterated Qwen as active-resistant learners"
status: done
type: experiment
priority: P2
owner: codex
source: manual
created: 2026-08-30
updated: 2026-09-01
verification: "Two eight-turn direct-learner dialogues completed with matched settings and Sol; deterministic speed/repetition plus provisional whole-transcript analyst use of v2.2 dimensions and requested quality axes in exact public Techne swimlanes. Counts, quotes and calculations verified. External Opus judging and browser visual preview remain unavailable."
claim_status: exploratory
links:
  items:
    - local-qwen-resistant-learner-mvp
  notes:
    - notes/poetics/2026-08-30-qwen-resistant-learner-benchmark.html
tags: [local-model, qwen, resistant-learner, benchmark, tutor-stub]
---

# Normal versus abliterated Qwen

User-authorized local engineering benchmark, not a registered publication study.
Both arms use the active counterexample-hunter profile, Tamsin character,
Marrick world, Sol medium tutor, eight turns, learner temperature 0.6,
thinking off, and MTP off. Each dialogue has a hard 16-call budget.
Eight independent Claude Opus 5 judge calls were planned within the 40-attempt ceiling,
but were blocked before launch pending explicit approval to send the two private
transcripts to that external provider. Actual usage is 32/40, with no judge calls.
No superego, classifier, learner repair, resampling, database ingest, push,
or publication is in scope. Public histories may diverge after the opening;
differences describe these two dialogues rather than a causal ablation effect.

## Log

- 2026-08-30 — Continued in the existing isolated local-Qwen worktree so the
  unpushed provider/learner seam stays intact. Added matched decoding and an
  explicit learner-temperature setting to avoid confounding resistance with
  the old fixed 0.1 sampling setting. Server profiles use the same empty
  prepended system prompt; the role brief is supplied by the experiment.
- 2026-08-30 — Both arms completed all eight exchanges and 16 model calls each,
  with no model-call failures, repairs, superego calls or resampling. Both local
  servers stopped cleanly. Raw traces, snapshots, matched service settings,
  metrics and unexecuted judge prompts are retained in the private local evidence
  root `.tutor-stub-traces/qwen-normal-abliterated-benchmark-2026-08-30/`.
- 2026-08-30 — HTML source and portable standalone report created. Report gives
  deterministic timing/repetition, exact public swimlanes and explicitly
  non-independent analyst ratings; these are not standard per-turn pipeline
  scores or database evidence. Source audit verified 34/34 public messages and
  reported calculations. The app blocked direct file browser preview, so no
  desktop/mobile visual check is claimed. Focused runtime/config tests: 26 pass.
- 2026-08-30 — Left in review. The pair does not demonstrate an abliteration
  quality advantage: both sustain resistance, but both repeat, and the
  abliterated arm adds dubious hypothetical physical traces that Sol treats as
  findings. No causal model/profile claim, paper amendment, commit or push.

- 2026-09-01 — Board reconciliation closes this as the descriptive local
  engineering benchmark it actually completed. The declared dialogue, timing,
  repetition, report, and source-audit checks passed. External Opus scoring was
  never authorized for this payload and is not retroactively added; the later
  separately designed hostile-refusal and factorial cards supply independent
  judgments without changing this evidence. No model calls were made during
  reconciliation.
