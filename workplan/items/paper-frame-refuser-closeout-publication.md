---
id: paper-frame-refuser-closeout-publication
title: Publish the frame-refuser closeouts across paper and companion documents
status: done
type: paper
priority: P1
owner: codex
source: review
created: 2026-08-30
updated: 2026-08-31
verification: >-
  Paper v3.0.298 records the fresh v5 result, both successor calibration failures and the cross-session budget
  incident from sealed reports; atlas, arc and build guides inherit those limits.
  Claim audit, focused validators, PDF/HTML checks and live publication checks pass.
claim_status: methods
branch: codex/paper-frame-refuser-closeout-publication
links:
  items:
    - frame-refuser-depth-study
    - frame-refuser-refusal-narrowing
    - frame-refuser-satisfiable-condition
    - paid-study-cross-session-budget-lease
    - paper-depth-close-companion-refresh
  paper:
    - docs/research/paper-full-2.0.md
  atlas:
    - provable-discourse
    - resistant-learner-delivered-move
  notes:
    - notes/poetics/ideal-tutor-blueprint.html
    - notes/poetics/2026-05-26-paper-to-dramatic-recognition-arc.html
---

## Scope

Fold the three omissions found by the August paper-coverage audit and the newly
merged v5 depth calibration into §6.28 and §7.15, then refresh and publish their
companion documents. No new study,
historical rescoring, treatment claim, abstract change or headline-N change.

## Log

- 2026-08-30: Started from `6851e3f47`, including the companion refresh in PR
  #885. Verified aggregate counts against the three sealed private reports.
  The content checkout has unrelated course edits; publication must use an
  isolated content worktree so none of those edits is staged or deployed.
- 2026-08-30: Fast-forwarded this isolated branch to `bda2e8d2c` after PR #887
  merged. Independently checked the v5 report and traces: one unanimous rung-2
  treatment case changes the descriptive boundary, but failed reader agreement
  still blocks a powered contrast. Kept the historical v1–v4 0/38 denominator
  separate and left the active study card's next decision to its operator.
- 2026-08-30: Updated Paper 2.0 to v3.0.298 (§6.28, §7.15, Appendix F),
  the atlas, arc, blueprint and historical HOW-TO reading note. Recorded four
  sealed report hashes and 20 targeted aggregate claim checks. The independent
  paper-claim audit passes; no DB scores, rubric versions or old empirical
  baselines changed. Three refactor-stale code-path checks now point to their
  current store modules with unchanged assertions.
- 2026-08-30: Validation: canonical evidence manifest 9 pass / 0 warn / 0 fail;
  provable discourse 166 pass / 27 existing warnings / 0 fail; focused claim
  tests 69/69 in an isolated test environment; blueprint refs 16/16; atlas
  19 modules / 0 errors / 0 warnings; workplan 571/571; formatting, diff and
  ref-status checks pass. The separately required **legacy Paper 1** bug audit
  remains 14 pass / 12 warnings / 3 existing refactor-stale code-guard failures
  (`conversation-history-source`, `conversation-history-behavior`,
  `multiturn-selection-source`); it is not represented as a green check.
- 2026-08-30: Built the paper PDF, atlas spine and all 19 module PDFs, plus the
  standalone arc with its existing 11 images. Visual QA corrected narrow-screen
  grid overflow, hidden-gloss overflow and an overlong PDF source label. No
  study calls or new image generation. The source version inventory now names
  v3.0.298; no managed tag was created.
- 2026-08-30: All three publication dry-runs target only the isolated content
  worktree. Live staging/deployment awaits the post-dry-run confirmation required
  by the publishing skill; the shared content checkout's course edits remain
  untouched. Live verification remains open until publication is authorized.
- 2026-08-31: DONE on operator review instruction. The v3.0.298 bundle is
  live, verified by page content rather than HTTP status:
  `https://machinespirits.org/content/articles/ai-tutor/tutor-blueprint.html`
  and
  `https://machinespirits.org/content/articles/ai-tutor/dramatic-recognition-arc.html`
  both serve pages stamped v3.0.298 (checked 2026-08-31). The paper has
  since moved to v3.0.299 (depth-line construct close, PR #892); carrying
  that into these companions is successor work tracked on
  `paper-depth-close-companion-refresh`, not an open item on this card.
