---
id: adaptive-warrant-baseline-study
title: "Adaptive warrant gate: paired baseline comparison"
status: done
type: experiment
priority: P1
owner: codex
source: manual
created: 2026-08-10
updated: 2026-08-10
verification: "Complete: 45/45 valid n=5 sessions and 360/360 learner-analysis calls; two independent primary annotations plus a zero-overlap fresh holdout are hash-frozen and scored; the candidate repair failed fresh validation and was reverted; inert-observe variance is reported; and the n=10 stop decision is recorded."
claim_status: scope-bound
links:
  notes:
    - docs/adaptation-refinement/remaining-next-steps.md
    - docs/adaptation-refinement/baseline-comparison-design.md
    - docs/adaptation-refinement/gold-annotations-first-corpus.md
    - docs/adaptation-refinement/semantic-audit-and-shadow-notes.md
  items:
    - adaptive-warrant-contract-redesign
tags:
  - tutor-stub
  - adaptation
  - warrant-gate
  - baseline
  - decision-quality
branch: adaptation-refinement
---

Run the Phase-5 comparison specified in the linked design. Hold the dynamic
register policy, world, model routing, learner profile, eight-turn horizon, and
paired session seed fixed; vary only the gate mode. Treat gate firings and lag
as manipulation checks. Any improvement claim must come from learner-record
growth, deference break, or separately blinded tutor-turn scoring.

2026-08-10 Codex: Activated from the design-session continuation. Before any
pilot call, close the live/offline post-turn evidence asymmetry, expose the gate
mode in sealed auto-eval provenance, run prompt/world quality gates, and dry-run
the exact 45-dialogue matrix. Raw traces and condition keys remain in the
ignored study directory; authored design and source code remain reviewable.

2026-08-10 Codex: Evidence parity is implemented at the next-decision boundary:
completed uptake, repetition, fallback/mechanical-repair, guard, and pacing
outcomes are frozen on turn N and consumed with record growth at decision N+1.
The auto-eval runner now records `warrantGateMode` in its configuration and
hashes the warrant policy/runtime sources. The paired-seed 3 x 3 harness,
architecture-independent record-growth/deference-break report, and condition-
blinded annotation export are implemented; focused tests pass. Quality gates
and the exact n=5 dry-run remain before model calls.

2026-08-10 Codex: The first live 45-session matrix completed mechanically but
is invalid for policy inference: all 360 combined learner-analysis calls were
rejected by the 30k prompt audit, so every tutor received fallback
classification and every learner record remained fixed at 4 grounded / 0
derived facts. The artifacts are retained as a diagnosed failed pilot, not
reused as study evidence. Auto-eval now forwards the existing `compact_v1`
analysis profile; the bounded learner-analysis ceiling is aligned with the
42k tutor-turn envelope and fingerprinted. A fresh eight-turn smoke executed
8/8 analysis calls with zero audit failures and grew the learner record from 4
to 7. A new 45-session paired matrix is running in a separate evidence root.

2026-08-10 Codex: The valid smoke also exposed an offline-only DAG timing
error: preflight counts placed learner-record growth one decision late. The
shadow now reads committed t -> t+1 record counts (shifted preflight fallback
for historical traces). A live active trace moved from 6/7 to 7/7 parity;
held-out gold regression remains 4/4 scored and the second-annotator corpus
remains 1/1 scored with six uncertain rows. A synthetic timing regression test
now fixes this boundary.

2026-08-10 Codex: The replacement pilot is mechanically and analytically
valid: 45/45 sessions reached eight turns, 360/360 combined learner-analysis
calls executed with zero prompt-audit/classification fallback, and all gated
decisions had completed-turn evidence with complete live/shadow agreement. The
downstream report and condition-blinded 18-case sample are frozen under
`.tutor-stub-auto-eval/adaptive-warrant-baseline-pilot-v2-live-2026-08-10/`.
Fresh independent annotations, decision precision/recall, and the repair-versus-
scale decision remain open, so this item stays active and no paper claim is
licensed.

2026-08-10 Codex: The harness now closes the post-annotation tooling seam as
well: two completed blinded corpora can be scored against the private key with
hard yes/no consensus, disagreements and uncertain labels excluded, and
precision/recall/accuracy plus input hashes persisted into the study report.
Only genuinely independent labeling and the resulting policy decision remain.

2026-08-10 Codex: Interpretation boundary tightened after the final arm-level
review. The inert observe arm also differs from off on downstream outcomes, so
paired session seeds do not freeze frontier-model draws. The pilot licenses
manipulation validity and attributable override events, not a causal downstream
improvement. Annotation should precede both policy repair and any larger design.

2026-08-10 Codex: The remaining sequence and stop rules are frozen in
`docs/adaptation-refinement/remaining-next-steps.md`, including corpus hash,
blind-reader isolation, consensus scoring, false-positive audit, repair-versus-
design criteria, and the gate that must pass before any n=10 execution.

2026-08-10 Codex: Closed at the registered stop rule. The primary two-reader
sample scored precision/recall 0/0 on 15 hard-consensus cases. A bounded repair
fit that burned corpus but again scored 0/0 on a corrected zero-overlap
18-case holdout (16 hard consensus) and was reverted. The inert observe arm's
record-growth differences (+0.6/+0.4/+0.8 by learner profile) were as large as
or larger than active (0.0/-0.2/+0.2), so n=10 was not launched. Follow-up
architecture work moves to `adaptive-warrant-contract-redesign`.
