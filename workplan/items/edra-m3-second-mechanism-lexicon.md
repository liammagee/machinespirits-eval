---
id: edra-m3-second-mechanism-lexicon
title: "Finish EDRA M3: second mechanism lexicon, anchor demotion, paper amendment"
status: triaged
type: research
priority: P2
owner: codex
source: manual
created: 2026-08-27
updated: 2026-08-27
verification: The mechanism-shift patterns detect representation swaps beyond
  the scenario-bound regex, with fixture tests for hits and misses; D42 is
  demoted to a calibration/boundary case with its YAML role corrected and a
  clean third anchor screened from the D54-D57 static-label bank; the
  origin-ambiguity rule in the paper carries the per-critic rationale the
  surgery spec prescribes, with a version bump and revision-history entry;
  no historical scores are recomputed under changed rules.
claim_status: planned
links:
  notes:
    - notes/poetics/2026-05-28-edra-m3-surgery-spec.md
    - scripts/analyze-poetics-tutor-adaptation.js
tags:
  - poetics
  - scorer
  - codex-sol
  - effort-ultra
---

The EDRA M3 surgery spec came out of a 13-agent adversarially verified design
pass on the organic-recognition saturation bug. Most of its fixes landed
(de-aliasing, origin demotion, quality-gate parity, retry core, the gate
aggregator). Three pieces are still open, confirmed against live source:

1. FIX 2, the second mechanism lexicon: the mechanism-shift patterns
   (`MECHANISM_SHIFT_PATTERNS`, analyze-poetics-tutor-adaptation.js:477) are
   still the old scenario-bound regex; representation swaps return no hits,
   and the in-file comment near line 841 says exactly that.
2. The anchor-set change: demote D42 to a calibration case, correct its YAML
   evaluation role, screen D54-D57 for a clean third anchor.
3. The paper amendment: the origin-ambiguity rule was never amended with the
   per-critic rationale; it appears only in the spec and a sidecar HTML doc,
   not in paper-full-2.0.md. Run the paper-claim audit after the edit.

The lexicon is the semantically hard part — it must catch real representation
swaps without minting hits from surface wording. That risk class (surface
pattern matched against text it was never tested on) has bitten five times
before; test every pattern on real transcript text first.

Suggested worker: Codex Sol at Ultra reasoning effort.
