# Paper lifecycle

`docs/research/paper-full-2.0.md` is the single source of truth for every
empirical claim. Spin-offs (slides, short paper, blog) inherit from it and add no
original claims — keep everything inside the one paper.

## From idea to published claim

1. **Claim / idea.** Capture as a workplan item (`type: research` or `paper`).
   State the contrast and, before any paid run, the kill gate / threshold —
   frozen offline so the decision rule can't move after seeing a number
   (see `quality.md`).
2. **Script.** Lands in `scripts/`. Prefer pure-computation analyses; mark
   anything that makes paid API calls.
3. **Report.** Output to `exports/`. This is the artifact the paper prose cites.
4. **Fold into the paper.** Add the interpretation to the right § of
   `paper-full-2.0.md`. Bump the version in the frontmatter and add an
   Appendix E revision-history line. Record run IDs in Appendix D.
5. **Register the claim.** Add/refresh it in provable-discourse so it is
   machine-checked against data: `npm run paper:provable-discourse:all`. Don't
   let claims go stale.
6. **Atlas.** If the work opens or closes a research arm, update its module
   claim-status in `docs/research/atlas/atlas.yaml` and run
   `npm run atlas:validate`. See `research-atlas.md`.
7. **Build / publish.** `cd docs/research && ./build.sh paper2` for the PDF;
   publish via the sanctioned staging path (human-gated).

## Hard rules
- **No retroactive rescoring** of historical data under a newer rubric version —
  it contaminates within-run comparisons. Versioned rubrics live in
  `config/rubrics/v{X.Y}/`.
- **Every number traces to a §.** The paper-table generator validates prose
  N-counts against the DB; the `paper-claim-auditor` agent checks edits.
- **Label the evidence.** Simulated-learner / LLM-judge / formal-verdict results
  say so, and claims are scoped to what the instrument measured (see
  `quality.md`).
