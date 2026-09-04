# Superego critique influence: aggregate sensitivity and causal boundary

Analysis date: 2026-09-04

## Bottom line

The merged per-link audit could not identify a single exceptional link after multiple-testing correction, but its testable corpus contains a clear **exploratory aggregate lexical association**. Across 304 links in 11 matched strata, actual critique→revision pairs averaged 0.041 uptake versus 0.021 under broken pairings (1.94×; one-sided Monte Carlo p < 0.00005 from 20,000 deterministic draws).

This does not establish that critiques caused revisions or improved them. The draft is a common cause of both the critique and revision, and exact-word uptake can be superficial. The result says the corpus is not well described as “no link signal”; it says link-specific influence still needs semantic measurement and randomized intervention.

## Why the individual-link null was not an aggregate null

Each testable link had only 19–54 wrong-critique comparators. Its smallest attainable empirical p-value therefore ranged from 0.050 to 0.018. Across 304 corrected tests, the best observed FDR q was 0.304 even though 50 links had uncorrected p ≤ 0.05. That procedure was designed to name exceptional individual links, not test a corpus-level shift.

The aggregate test preserves each scenario, ego/superego route, and deliberation ordinal. Within every stratum it applies a non-zero cyclic shift to the critique assignments, preserving the critique multiset while breaking every observed pairing. The test and seed were added after the per-link result was known, so this is a sensitivity analysis rather than a confirmatory finding.

## Robustness

Removing the 32 testable parser-failure critiques (99 across the complete eligible corpus) leaves 272 testable links: observed 0.045 versus broken 0.023 (1.98×; p < 0.00005). Including the structured change text in the critique representation also retains an aggregate association (1.76×; p < 0.00005). These are post-hoc checks, not separate discoveries.

## What the original lexical instrument could not see

Across all 1202 eligible links:

- 1105 critiques carried structured change requests; 948 contained explicit revision lists.
- 637 revisions changed the public action target; 182 changed the action type.
- 891 changed the title and 1196 changed the first public message.
- The original score read only `critique.feedback` and `revision.firstSuggestion.message`; it omitted structured instructions, action fields, titles, and additional suggestions.

These counts show measurement coverage, not successful compliance. A target change may be useful, irrelevant, or harmful; only semantic coding and independent quality assessment can decide.

## Outcome-blind semantic review packet

A deterministic 48-item calibration packet was sampled systematically across 12 profiles before any semantic labels exist. It contains the complete draft, critique, structured changes, and public revision, but withholds run, profile, model, lexical outcome, and trace identity from the coding packet. A separate identity ledger preserves provenance. Ambiguity and coder disagreement must remain `measurement_indeterminate`; exact-word signals are auxiliary only.

- Packet: `exports/superego-critique-causal-followup/semantic-review-packet.json` (SHA-256 `9da00d931b6f65bbbce7b506ec721fa876275fa8fe0304cef55ff3d851790573`)
- Identity ledger: `exports/superego-critique-causal-followup/semantic-review-identity-ledger.json` (SHA-256 `7349cdeafc57d6260a5599e6261fcfb5b378ec75803dbb6df2a7dc40a5077498`)

The packet is calibration material, not a scored result. No semantic proportions are reported until an independent coder and a deliberate reliability check exist.

## Causal replay that would answer the harder question

Hold one frozen draft and its visible context constant, then compare four arms:

- `draft_only`: retain the frozen draft; no generation call.
- `generic_revision`: one revision pass with a content-neutral improve instruction.
- `actual_critique`: one revision pass with the draft's actual complete critique.
- `matched_wrong_critique`: one revision pass with a same-stratum critique from another draft.

This separates the extra-pass effect from the actual critique-content effect and from link-specific matching. Directive fulfillment, material action/strategy change, and blind public-output quality are separate endpoints; learner response or transfer remains a later evidence lane.

This repository change does not register or authorize that paid experiment. The corpus, sample size, routes, seed, primary threshold, indeterminate disposition, and attempt/spend ceilings remain deliberately unresolved.

## Provenance and execution boundary

- Source ledger: `notes/2026-09-04-communication-topology-link-analysis.json` (SHA-256 `9401fffc1bcbc86aa1cc8145b24237960fe80b85c81046697e209b322c5fb720`)
- Frozen trace files verified: 319/319; hash mismatches: 0.
- Model/provider calls: 0 completed, 0 failed, 0 reserved; hard ceiling 0.
- Historical traces and evaluation rows were read only; no score was backfilled or overwritten.
- The aggregate result is exploratory association, the semantic packet is unscored calibration material, and the causal protocol is a design seed rather than authorization.
