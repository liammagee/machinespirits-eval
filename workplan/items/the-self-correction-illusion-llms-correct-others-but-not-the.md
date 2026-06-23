---
id: the-self-correction-illusion-llms-correct-others-but-not-the
title: "The Self-Correction Illusion: LLMs Correct Others but Not Themselves"
status: done
type: research
priority: P2
owner: codex
source: daily-routine
created: 2026-06-22
updated: 2026-06-23
verification: Paper 2.0 §6.1.3 already cites @chen2026selfcorrectionillusion and records the bounded cross-judge result; reproduction path is scripts/analyze-correction-source.sh.
claim_status: scope-bound
links:
  notes: notes/daily-notes/2026-06-12-research-roundup.html
  paper: docs/research/paper-full-2.0.md
  atlas: docs/research/references.bib
  scripts: scripts/analyze-correction-source.sh
branch: codex/self-correction-illusion
tags:
  - superego
  - self-correction
  - paper-positioning
---

arXiv:2606.05976 [UNBLOCK] — surfaced by the daily routine (2026-06-12-research-roundup.html).

This provides direct empirical grounding for the ego-superego loop's core design choice: the superego sees ego output as external content, which is exactly the framing shown here to unlock correction. Conversely, it warns that any merge of ego and superego into a single context (e.g. a naive "self-reflect" prompt) will suppress correction to near-zero. The 13-cell coverage also offers a replication scaffold for cells 3–4, 7–8, 22–33 — measure correction rate vs. role-label to validate the architecture rather than just assuming it works. Additionally, the CLAUDE.md symmetry requirement (tutor/learner trace agent labels must not default to a generic user ) gains new empirical motivation: wrong role labels would suppress correction on the tutor side.

Triage: promote to a research item (link the paper §) or drop with a reason.

2026-06-23 Codex: Confirmed this card has already been folded into the canonical paper as v3.0.165: §6.1.3 adds the cross-judge robustness paragraph, `docs/research/references.bib` defines `@chen2026selfcorrectionillusion`, and `scripts/analyze-correction-source.sh` is the reproduction path. The result is scope-bound, not a new headline claim: the direction of the substitution pattern is judge-robust, while magnitude is judge-sensitive. A stable-main rerun of `scripts/analyze-correction-source.sh` against the local populated DB reproduced the qualitative pattern on the broader collapsed v2.2 corpus: base multi 50.90 vs single 36.24 (+14.66), recognition multi 60.73 vs single 57.87 (+2.86). If a checkout has only an empty DB placeholder, set `EVAL_DB_PATH` to the populated evaluation DB.
