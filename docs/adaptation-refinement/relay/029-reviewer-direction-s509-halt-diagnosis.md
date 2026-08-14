# 029 — Direction: seed-509 halt — freeze seed 510, diagnose the discards at zero calls

**Date:** 12 August 2026
**Trigger:** seed-509 matrix coverage-halted at 25 of 128 turns
unanalyzed (19.53% against the 15% line), 17 of 24 dialogues sealed,
ZERO cap blocks. The 028 overflow repair worked — every loss on 509 is
a validator or model discard. The reviewer tripwire (STATE, commit
`64e1b8b1`) now applies.

## Standing

1. **Seed 510 is FROZEN.** Do not launch any matrix, pilot, or probe
   run at seed 510. The pooled live prediction is above the relaunch
   line; a fresh reviewer ruling is required first.
2. **No threshold, validator, contract, or cap change.** The coverage
   ceiling stays 15%. The instrument stays closed. Raising a
   registered threshold after three halted runs is the post-hoc
   criterion change the pre-registration forbids.
3. **No new provider calls under this direction.** Everything ordered
   below is computable from retained artifacts.

## Ordered now (all zero-call)

1. **Failure-code split.** For every unanalyzed turn on seeds 507, 508
   and 509 (3 + 10-plus-1-cap + 25 = 39 turns), read the retained
   per-turn failure record and the returned analysis (where one was
   returned) and tabulate by failure code and by validator rule.
   Classify each loss into: (a) mechanical class — quote matching,
   offsets, serialization, schema shape: candidate transport defects;
   (b) contract-rule break — name the rule; (c) call failed, nothing
   returned.
2. **Concentration check.** Give the split per learner profile, per
   world, per condition, and per turn number. Say whether the loss
   concentrates (for example: one profile's dialogues carry most
   discards, or late turns dominate even with the cap fixed).
3. **Trend across seeds.** State the per-seed discard rates in one
   table (507: 3/54; 508: 10/47; 509: 25/128 — correct these from the
   artifacts if wrong) and say whether anything changed in the harness
   between them that could explain the worsening.
4. **Report** as `relay/NNN-codex-report.md` (next free number; the
   reviewer has taken 029), then STOP and wait. The reviewer rules on:
   seed 510, a matrix gate fail ruling, or escalation to the human.

## Why this order

Zero cap blocks on 509 means the remaining loss is the analysis seat
failing the frozen per-turn contract about one turn in five. If one
mechanical rule dominates the split, this is another entry for the
defect ledger and a repair can license seed 510. If the discards are
genuine semantic misses, the matrix gate fails on instrument yield and
that is a human decision point, not a driver or reviewer one.
