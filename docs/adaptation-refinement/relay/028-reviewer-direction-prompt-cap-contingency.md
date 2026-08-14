# 028 — Contingent direction: turn-8 prompt-cap overflow (applies only if s507 halts or fails on coverage)

**Date:** 12 August 2026
**Standing:** direction 027 (launch under 022's terms) remains the
current work order. This direction pre-declares values so the driver
never stalls if the seed-507 run dies of the defect described here.
If seed 507 passes its gate, this file requires NO action.

## The defect, from the live trace

Dialogue `world_028_larkspur_fridge-counterexample_hunter-intervening-r1-s507`
lost turn 8 with zero model involvement: the prompt audit blocked the
learner-analysis call at 42,227 characters against the 42,000 cap
(token estimate 10,557 against 10,500). The analysis prompt grows with
the dialogue, so the last turn is always the largest; a second job
trace already shows the same block. This loss is systematic (always
late turns), which biases coverage toward losing dialogue closure —
worse than random loss. Blocked calls cost nothing.

## If the s507 run coverage-halts, or its gate fails with
## prompt-audit overflow as a contributing cause

1. **Amend the audit cap (run-management constant, rule 4b).**
   Replacement values, pre-declared: `maxChars` 42,000 → **56,000**;
   `maxApproxTokens` 10,500 → **14,000**. The audit stays on — it
   still catches runaway prompts. Do NOT trim prompt content to fit;
   the cap is a transport guard, not part of the instrument.
2. **Probe/live prompt parity (zero calls).** Add a preflight
   assertion that the diagnostic-probe path and the live-matrix path
   build the learner-analysis prompt through the same constructor —
   compare the built prompt for one synthetic turn byte-for-byte.
   The seed-506 defect (metadata line breaks) shipped because the
   probe never exercised the exact live prompt; this closes that gap.
3. **Focused tests:** turn-8-sized prompt passes under the new cap; a
   genuinely runaway prompt (>56,000) still fails closed; the parity
   assertion fails when the two paths diverge.
4. **Relaunch at reserve seed 508** under 022's standing terms.
   Seed 507's corpus joins the burned list. Reserves 509-510 stay.
5. **No mid-run patching.** Never change the cap while a matrix run
   is live; dialogues inside one run must be uniform.

## Reporting

Whatever happens, the s507 (or later) matrix report must split
unanalyzed turns by cause class — prompt-audit overflow vs model
residual (bad quote, forbidden sets, missing target) — the runner
already records the failure code per turn. The gate ruling quotes
both classes.
