# Duplicate-clue pre-delivery guard and working screen

Date: 2026-07-16

## Change boundary

- Speaking prompt: when a learner asks what to write while evidence is due, the
  `Write:` entry now records only the already-public status or limit. The due
  clue must then appear exactly once in the enacted development.
- Recovery: unchanged. Strict repair, model rewrite, deterministic fallback,
  and final safety gates retain their previous behavior.
- Audit recognition: clue multiplicity is now a hard dramatic-release check on
  every original, repair, rewrite, and fallback candidate before public state
  or release pacing is committed. The post-run character audit calls the same
  shared detector. Two transcript-valid surface families are also recognized
  structurally: learner-facing ask-plus-meaning clarification options, and
  ready/easy judgments placed under breaking or challenging counterpressure
  regardless of word order.

The structural recognizers use positive paraphrase families and negative
controls. They do not whitelist either observed Greyfen sentence verbatim.

## Model-free regression

The V20 Tallow fixture was extracted before changing the speaking contract.
Its uncontaminated turn-1 original is now correctly rejected as
`dramatic_release:duplicate_clue_delivery`; this is an expected correction of
a historical false acceptance, not a generation improvement. All other saved
accepted candidates remain accepted, with zero unexpected recognition
regressions and zero safety failures. The fixture records six real candidates
across turns 1, 5, and 8; V20 produced no deterministic fallback candidate.

## Frozen original-only working evidence

Artifacts:

`/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-duplicate-working/iteration-1`

| Screen | Fresh original acceptance | Current deterministic audit | Safety | Mean original latency |
|---|---:|---:|---:|---:|
| Tallow turn 1, four draws | 4/4 | 4/4 | 0 | 10,953 ms |
| Greyfen turns 2 and 7 | 0/2 at generation-time audit | 2/2 after structural re-audit | 0 | 11,178 ms |
| Skyway turns 4 and 6 | 2/2 | 2/2 | 0 | 9,032 ms |

The Tallow result is the direct generation test of the new coordination: all
four drafts used a complementary `Write:` boundary and delivered the newly due
charger clue once. The cross-world drafts were also transcript-specific and
safe. Greyfen's two generated texts were initially rejected only because the
old deterministic recognizers missed a real clarification option and reversed
counterpressure word order. Re-auditing the same saved candidates made no
model calls and accepted all four cross-world candidates.

Across the eight saved draws there were no learner, classification, DAG,
repair, rewrite, fallback, or continuation calls. Mean original latency was
10,529 ms. Frozen replay preserves the exact public prefix, due evidence,
selected response configuration, model, and effort while intentionally
recompiling the first-draft contract under test; it is not described as an
exact byte-for-byte replay of the historical request.

## Gate decision

The targeted development evidence passes: Tallow 4/4, cross-world 4/4 under
the current deterministic audits, and zero safety or duplicate-clue failures.
This licenses predeclaring a fresh held-out matrix. It does not itself establish
end-to-end or held-out generalization.
