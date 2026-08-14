# 022 — Direction: seat back to Luna; normalized quote matching; 15% halt with registered coverage note; relaunch at seed 506

**Date:** 12 August 2026
**Answers:** report `5923b99e` (021 hard stop): Luna + handbook_v1 probe
5/48 = 10.42% (gate 10.0%, fail by one call); Sonnet upgrade probe
25/48 = 52.08%. Human decision received in chat (12 Aug): proceed per
the reviewer's four-step recommendation below.

## Reviewer findings on the probe artifacts

1. **Eight of Sonnet's 25 discards are a harness matching defect, not
   model misquotes.** Sonnet quoted span words exactly but wrote ASCII
   apostrophes/quotes where the learner text has typographic ones
   (`I'll` vs `I’ll`). Byte-equality rejected them. Under
   punctuation-normalized matching Sonnet is 17/48 = 35.4% — still a
   clear fail, and the residue is real: Sonnet attaches value/component
   sets to non-request acts far more than Luna (19 incidences vs 3).
   The seat upgrade FAILS on the merits.
2. **The same normalization rescues nothing on Luna.** Its single
   quote failure is a genuine misquote. Luna stands at 5/48 = 10.42%:
   three value/component slips, one missing target, one misquote.
   Measured on 48 turns the sampling noise is about ±4 points.

Luna + handbook_v1 is the best measured seat. Model shopping beyond
one pre-authorized upgrade is not authorized.

## Authorized now

1. **Seat reversion:** amend the frozen analysis-seat pin back to
   `codex.gpt-5.6-luna` with prompt profile `handbook_v1` (revert the
   model change of `39757d4e`; keep its preflight/test gains). Record
   the amendment commit and new child policy SHA.
2. **Punctuation-normalized quote matching (mechanical, both seats,
   prospective):** before locating the model's evidence quote in the
   turn text, canonicalize typographic apostrophes and quotation marks
   (U+2018/U+2019 → ', U+201C/U+201D → ") on BOTH strings; uniqueness
   and derived offsets are computed on the original turn text. Words
   must still match exactly — this relocates byte trivia to the
   machine, same family as offset derivation. Focused tests: curly-vs-
   straight rescue, still-missing quote, duplicate-after-normalization
   fails closed. Preflight asserts the normalization is present on
   both seats. No historical corpus is rescored.
3. **Coverage self-halt amended (run-management constant, rule 4b):**
   the 017b self-halt threshold moves from 10% to 15% unanalyzed with
   the same ≥10-turns floor. The first-call gate stays. Grounds,
   registered in the study record and prereg notes: the probe-measured
   expected unanalyzed rate on this seat is 10.4% (5/48, ±~4).
   Per-turn strictness is UNCHANGED — an unreadable analysis is a
   coverage loss, excluded from tutor projection and from all scoring,
   never contamination. The matrix report MUST state achieved coverage
   overall and per dialogue, and the gate ruling must quote it.
4. **Relaunch the representative matrix at reserve seed 506** under
   the standing authorization (014/016/017/017b terms; ~612 calls,
   attended, checkpointed). Reserve seeds 507-510 unchanged. Burned:
   503, 504, 505 corpora plus both probe artifact sets (diagnostic
   only, never evidence).

## After the matrix (unchanged)

Gate pass = stop before the outcome study (freeze prereg from
`2026-08-12_outcome-study-design-draft.md`, human go). Gate fail =
stop for review (004 scope-cut options). Ruling 010's fallback stands:
mechanism consensus < 0.75 with binary ≥ 0.80 cuts the typing layer
and the binary carries.
