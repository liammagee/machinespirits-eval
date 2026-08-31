---
id: warrant-quote-rule-letter-case
title: Accept case-only quotes prospectively while preserving historical replay
status: review
type: infra
priority: P2
owner: codex
source: manual
created: 2026-08-16
updated: 2026-08-31
branch: codex/warrant-quote-rule-letter-case
verification: Prospective matching accepts all 12 retained case-mismatched
  quotations; 11 attempts validate and the non-public-identifier attempt
  remains rejected. Historical matching, rulings and stored evidence stay
  unchanged. Focused tests cover uniqueness, misquotes, UTF-16 offsets,
  live extraction and reader assembly. No model calls.
claim_status: methods
depends_on:
  - guarded-learner-outcome-study
links:
  notes:
    - docs/adaptation-refinement/guarded-main-block/reviewer-ruling-001-letter-case-quote.json
    - docs/adaptation-refinement/relay/DEFECT-LEDGER.md
    - tests/fixtures/adaptive-warrant-quote-case-refusals.provenance.md
tags:
  - warrant-gate
  - adaptive
  - instrument
---

The 2026-08-16 human ruling permits case-only quotation differences in later
evaluations. The guarded study is now complete, so its former source-pin
blocker no longer applies. Historical rulings, seals, evidence and scores
remain unchanged; source repinning and resealing are not part of this work.

New live reads and newly prepared reader collections use punctuation plus
Unicode simple case folding. The matcher counts all occurrences, including
overlaps, and returns the learner's original text and UTF-16 offsets.
Whitespace, other punctuation, identifiers and semantic judgments retain
their existing rules. Unmarked historical collections and raw analysis
envelopes keep punctuation-only matching.

The historical ruling service stays: the outcome runner uses it to reproduce
the original refusal and admit the dialogue with its unread turn excluded.
Its lowercase helper is not reused for prospective matching because Unicode
lowercasing can expand characters and corrupt source offsets.

The original monotonicity wording was too broad: a quote occurring twice
with different capitalization is unique under the old rule but ambiguous
under the new one. Historical replay preserves the old result; prospective
matching rejects that ambiguity. Available historical valid spans are also
replayed as a regression check, without rewriting their artifacts.

2026-08-31: implemented and verified on the branch above. The 12
retained case-mismatched quotations are now source-linked test fixtures;
11 attempts validate, while dialogue 28's additional non-public identifier
still fails. See
`tests/fixtures/adaptive-warrant-quote-case-refusals.provenance.md` for the
extraction boundary and correction to the older count wording. Zero model
calls; no historical rescoring.

Verification: seven focused hermetic suites, 293 passing tests, zero failures,
19 declared skips. Six skips cover historical reseal assertions that require
current source bytes to equal consumed digests; the frozen artifacts were
not repinned. Lint, formatting, workplan source and test-manifest checks pass.
Read-only replay of seven available outcome run directories matches the old
validator on all 1,716 parsed calls, and the prospective rule preserves all
1,532 previously valid call results and all 5,370 checked spans. All 206
available trace-seal hashes match (two early traces have no seal entry).
The original ruling still admits dialogue 34 while excluding turn 8.
