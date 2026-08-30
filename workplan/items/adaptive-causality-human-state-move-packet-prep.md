---
id: adaptive-causality-human-state-move-packet-prep
title: "Prepare the blinded adaptive state/move human-validation packet"
status: done
type: research
priority: P1
owner: codex
source: review
created: 2026-08-30
updated: 2026-08-30
branch: codex/adaptive-state-move-packet-prep
verification: "A zero-model-call builder draws a frozen stratified packet only from sealed, provenance-bearing crossed-effects and repertoire traces; emits arm- and outcome-blinded coder material, a construct codebook, two independent coder templates, a separately sealed machine key, hashes, and a fail-closed comparison report; focused tests prove private assignments and outcomes cannot leak and preserve uncertainty or disagreement as indeterminate."
claim_status: methods
links:
  notes:
    - notes/poetics/2026-08-29-adaptive-tutor-from-null-to-control.html
    - notes/2026-08-03-adaptive-causality-living-log.md
  items:
    - adaptive-causality-human-state-move-validation
    - adaptive-causality-crossed-effects
    - adaptive-causality-repertoire
    - impasse-corpus-phase1
tags:
  - adaptive-causality
  - human-validation
  - learner-state
  - treatment-fidelity
  - packet-preparation
milestone: adaptive-tutor-evidence-v1
---

The central adaptive-causality claim currently relies on automated state and
move-realization instruments. Before asking people to validate those constructs,
prepare the missing blinded evidence packet from already sealed traces. This is
deterministic artifact work: it authorizes no dialogue generation, judging, or
human ruling.

The packet must separate public coder material from the machine key, hide arm,
automated verdict, and downstream outcome, and freeze its sample and codebook
before either coder starts. The comparison path reports agreement, construct
confusion, realization fidelity, and every indeterminate case without tuning the
instrument after disagreements are visible.

The 29-episode impasse corpus is a linked real-interaction criterion slice, not a
substitute for the arm-blinded causal packet. Its eventual labels remain separate
and may be compared only under an explicitly declared mapping.

2026-08-30 Codex: Created after the human-work review found that the validation
card named a frozen packet but no packet, coder sheets, codebook, or comparison
tool exists in the repository. This card owns that missing zero-call preparation
tranche; the human validation card remains the subsequent external gate.

2026-08-30 Codex: Activated in a fresh worktree from merged PR #886 at
`d0cf64836`. The implementation is limited to deterministic packet preparation,
blinding, coder-artifact validation, comparison, and focused tests over existing
sealed evidence. No dialogue generation, model judging, or human ruling is
authorized or required.

2026-08-30 Codex: Completed the zero-call preparation tranche. The frozen
two-world packet contains 24 cases: one deterministic selection from every six
learner states × two worlds × matched/mismatched assignment stratum. Public
materials expose only neutral case IDs, learner turns, tutor replies, and a
plain-language construct codebook. The two coder templates use different case
orders; the separate machine key retains source arm, assignment, gold move,
automated ruling, and provenance. The later one-world flat/bored evidence is
explicitly excluded, and unassigned natural-router rows cannot enter an
assignment stratum. `node --test
tests/adaptiveCausalityStateMoveReview.test.js` passes 7/7; exact source rebuild,
clone-safe frozen-hash verification, `git diff --check`, and
`npm run wp:source-check` all pass. Model calls: 0. The dependent human card is
now blocked only on two independent coders.
