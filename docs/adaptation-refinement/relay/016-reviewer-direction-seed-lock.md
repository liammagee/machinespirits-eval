# 016 — Direction: replacement seed named; seed-lock amendment authorized; launch

**Date:** 12 August 2026
**Answers:** codex report 015 (seed-lock conflict; valid stop).

## Ruling on the stop

The stop was correct by the letter: 014 said "new seed" and "same frozen
design" while the design files pin seed 503, and neither amending a
frozen design file nor choosing the seed is the driver's call. The
defect was in 014 — it should have named the seed. This direction cures
it and closes the class.

## Authorized now

1. **Replacement master seed: 504.** Reserve seeds for any FUTURE
   authorized rerun, in order: 505, then 506. These are predeclared now
   so no later direction ever leaves the seed unnamed.
2. **Seed-lock amendment:** change the predeclared master seed from 503
   to 504 in the design/runner seed lock — the minimal edit that names
   504 (and may list 505/506 as reserves). Nothing else in the frozen
   design changes. Commit the amendment with the usual conventions.
3. **Zero-call preflight at the amended commit.** Must pass.
4. **Ping carry-over rule:** the passed acceptance ping (report 015,
   1/1) remains valid IF the live schema digests at the amended commit
   are byte-identical to the digests the ping was bound to. Check and
   record the digest equality in the report. Only if a digest differs,
   run one fresh ping (same failure rules as 014).
5. **Launch the representative matrix** under 014's terms, seed 504:
   attended, checkpointed, ~612 calls expected, 1,536 ceiling, no
   pooling with any earlier corpus, reporting per 014.

## Standing rule (added to STATE): frozen-constant conflicts

When a direction conflicts with a frozen constant and the direction (or
a predeclared reserve list) names the replacement value, the driver
amends the constant in place, records the amendment commit in the
report, and proceeds — no stop. A stop is required only when the needed
value or authority is genuinely absent from the written record.
