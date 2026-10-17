---
id: superego-taxonomy-temporal-pairing-audit
title: Repair the historical superego critique pairing and its temporal claims
status: triaged
type: research
priority: P1
owner: codex
source: review
created: "2026-10-17"
updated: "2026-10-17"
verification: "The archived counts reproduce as historical association; every proposed temporal pair has an auditable same-exchange source link or an explicit exclusion; focused regressions pass; the canonical paper and affected derivatives distinguish the corrected evidence from the preserved aggregate quality results."
claim_status: methods
links:
  paper:
    - "docs/research/paper-full-2.0.md §6.2.3"
    - "docs/research/paper-full-2.0.md §6.4.2.1"
  code:
    - scripts/analyze-superego-taxonomy.js
    - scripts/extract-superego-critiques.js
    - tests/superegoTaxonomyProvenance.test.js
  data:
    - data/paper2/superego-critiques-classified-paper-6.2-n500.jsonl
  items:
    - superego-critique-causal-link-followup
    - superego-critique-causal-replay
    - superego-critique-measurement-calibration
    - superego-taxonomy-human-validation
    - recode-superego-incorporation-as-a-framing-trajectory
    - test-canonical-posthoc-analysis-pipeline
tags:
  - paper-2
  - empirical-integrity
  - superego-taxonomy
  - temporal-pairing
  - zero-model-calls
---

## Assignment and scope

**Execution repository:** `liammagee/machinespirits-eval`.
**Execution agent:** GPT-6.1 Sol, reasoning effort **high**.
This card is prepared for later execution; creating it does not start the repair.

Audit and repair the linkage supporting the historical §6.2.3 critique table.
Use the existing 500 classified records and original logs for their 56 dialogue
identities. The hard ceiling is **0 live/model-evaluation calls and $0 experiment
spend**: no generation, classification, rejudging, calibration, replay, or paid
recovery. Reuse existing labels; do not alter the historical corpus, raw logs,
judge outputs, evaluation database, or original run records.

Read `AGENTS.md`, `CLAUDE.md`, `workplan/README.md`, and the relevant quality
and paper-lifecycle playbooks. Follow the maintained data-path resolvers. If a
database is needed, use `openEvaluationDbReadonly()` from
`services/evaluationDbReadonly.js`; missing data is recorded, never created.
Record the checkout commit and dirty state as provenance. No source hashes,
approval artifacts, extra authorization gates, or new model-run machinery are
needed.

## Why this is a distinct follow-up

The June G4 closure established numerical reproducibility. It did not establish
a same-exchange temporal link. At parent commit
`54d78f4a548fe3bc24cba0e26a7ceb0b514ffa55`, the audited corpus has 500 null
`turnIndex` values; 69 parse-failure exclusions leave 431 records. The analyzer
constructs 232 links using each dialogue's first R2 verdict. Only 39 of the 56
dialogues contribute links, and 193 links reuse an R2 reference. The existing
provenance test intentionally reproduces that convention.

Read the linked cards' current sources before starting. The lexical causal-link
follow-up is in review; causal replay, measurement calibration, and taxonomy
human coding are separately blocked. Framing recoding and the canonical posthoc
fixture card are done. This task neither reopens those cards nor depends on
their completion. It addresses the historical n500 temporal inference only.

## Work and deliverables

1. **Reproduce and inventory.** Run the existing pure-computation analyzer on
   the explicit tracked n500 input. Reproduce the historical contingency counts
   (baseline 35/4/16/2; recognition 13/63/33/66), exclusions, total dialogues,
   contributing dialogues, unique R2 references, and repeated-reference count.
   Keep historical association and proposed temporal analysis visibly separate.

2. **Recover source identities once.** Inspect `scripts/extract-superego-critiques.js`
   and read `scripts/classify-superego-critiques.js` for the extraction/classification
   lineage; do not execute the classifier. Resolve original logs through
   `resolveTutorDialoguesDir()` in `services/evaluationDataPaths.js`, then the
   documented existing archive (`$EVAL_ARCHIVE_DIR` or
   `../machinespirits-eval-private`) where available. Bound recovery to the
   corpus's 56 dialogue identities. Account for all 500 source rows in a ledger
   using the frozen JSONL row number, matched log and trace-event index,
   dialogue/turn/round identity, matching evidence, and exclusion reason.
   Recover turn identity only from explicit metadata or unambiguous original
   event boundaries. Match existing classifications to original events through
   recorded content and identity fields; duplicate matches remain ambiguous.
   Never use null equality, nearest text, guessed turn order, or the first R2
   in a dialogue as a substitute for a verified same-exchange link.

3. **Repair the maintained analysis.** Amend the existing analyzer and extractor
   only where required. A temporal pair must uniquely link R1 and the subsequent
   R2 review within the same tutor exchange, with the intervening ego revision
   and chronology evidenced by the log. Do not reuse one R2 event across
   different R1 events. Missing, conflicting, duplicate, parser-failed, or
   unresolvable cases get explicit dispositions. Preserve the historical table
   as a clearly labelled association/reproduction output; the normal output
   must not call unverified first-R2 links temporal transitions. Keep source
   records immutable and store recovered metadata separately.

4. **Report the evidence and its limits.** Produce
   `exports/superego-taxonomy-temporal-pairing/report.json`,
   `report.md`, and `pair-ledger.jsonl`. Report coverage and exclusions by
   condition and model, with records, exchanges, and dialogues as distinct
   denominators. If an identifiable subset exists, describe only that subset;
   do not generalize its rates to the full corpus. Any uncertainty calculation
   must respect dialogue clustering. Preserve the existing category labels and
   approval field separately: a subsequent approval is a verdict transition,
   not proof that the criticized problem was fixed or that the critique caused
   improvement. Commit a compact, reproducible evidence summary in
   `notes/2026-10-17-superego-taxonomy-temporal-pairing-audit.md`, including
   source locations and commands. Keep raw/private trace material in its
   existing storage boundary.

5. **Correct the paper first.** Amend
   `docs/research/paper-full-2.0.md` §6.2.3 and the dependent interpretation in
   §6.4.2.1, with the normal version bump and revision-history entry. Search
   affected derivatives, including `docs/research/paper-short-2.0.md`,
   `docs/research/methods-paper.md`, and relevant atlas/claim registrations;
   propagate only this correction where the claim appears. Preserve the
   historical G4 record and append the new finding. Keep aggregate tutor-quality
   contrasts, prompt-orientation evidence, and the measured additivity pattern
   intact; qualify any proposed mechanism that relied on these links. Do not
   recast the join defect as evidence that the quality effects disappear.
   Preserve the separately reproduced §6.2.5 numbers unless this audit
   independently demonstrates a relevant linkage defect.

## Recovery fallback and stopping condition

If original logs are missing or same-exchange identities cannot be recovered
unambiguously, complete the correction without further data collection:
report the inaccessible/unidentifiable roster and retain the old table only
as the stated first-R2 association. Remove the claims that the table shows
problem repair, learning from critique within an exchange, category-specific
correction difficulty, or an established causal mechanism. Partial recovery
gets the same boundary for unresolved cases. The task can finish through this
documented withdrawal; it does not wait for a new run or human coding.

## Meaningful regression checks

Update `tests/superegoTaxonomyProvenance.test.js` so historical reproduction is
explicitly distinguished from temporal validity, and add focused coverage in
`tests/superegoTaxonomyTemporalPairing.test.js`:

- Two tutor exchanges in one dialogue have different R2 verdicts; each R1 maps
  only to its own exchange, even when the classified input order is shuffled.
- Null/missing turn identity without recoverable trace evidence produces no
  temporal pair; duplicate candidates and absent rounds are reported.
- Repeated round numbers, legacy trace labels, intervening turn boundaries, and
  reversed chronology cannot silently create cross-turn or reversed links.
- A known one-to-one fixture yields exact expected pairs and unique
  contributing-dialogue counts, with no R2 reuse.
- The frozen n500 input still reproduces the legacy counts under their explicit
  association label, including 39 contributing versus 56 corpus dialogues.
- CLI execution leaves input corpus/log bytes unchanged; missing log roots
  produce a complete unavailable-data report rather than fabricated pairs.

Run the narrow Node tests above, applicable changed-file lint/format checks,
`git diff --check`, and `npm run wp:source-check`. Use the existing affected
claim checks; update the analysis registry/test manifest only if the changed
interface or new test requires it. Do not add an npm alias, broaden the study,
or run unrelated suites. Broaden verification only for a concrete failing
boundary.

Completion is one reviewable repair and paper-correction change set, with exact
commands, measured denominators, residual limitations, and **0 completed,
0 failed, 0 reserved research-model calls; ceiling 0** in the card log. Name
`Workplan item: superego-taxonomy-temporal-pairing-audit` in its PR. Stop when
this card's evidence, correction, and focused checks are complete.

## Log

- 2026-10-17 — Prepared from the paper-readiness audit for GPT-6.1 Sol/high.
  Task setup only; no repair or model evaluation has been executed.
