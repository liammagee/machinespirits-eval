# The forced ∧ underivable window (Oedipus scenario redesign)

2026-05-31. Continues the under-determination diagnosis (2026-05-30) and the screen-rejection
finding (memory `oedipus-screen-rejects-diagnostic-secrets`).

## Why the redesign

The §7.9 result (premise-licensing → ~2/3 discovery across 2 scenarios) was measured on the
**original causal** secrets — and the under-determination diagnostic showed those premises
forced S only ~1/4 of the time. So some fraction of those "discoveries" were committed
near-misses of *unforced* leaps: the learner asserting S when the metered premises did not
entail it. Raising that rate by coaching = manufacturing a false Aha (the closed-loop trap).
The only honest lever is to make S genuinely **forced** from the evidence — hence two screens,
opposite polarity, that a scenario must pass **before** any paid generation:

- **Underivability** (existing): a strong model on `K_L` (learner-visible setup) alone must NOT
  recover S. Else the `none` control isn't clean — a no-help learner could reach S without the
  tutor. (`scripts/screen-s-underivability.js`)
- **Forcedness** (new, `scripts/screen-s-forcedness.js`): a panel given `K_L + the full premise
  ledger` must find S **uniquely entailed** (≥3/4). Else a learner reaching S is leaping past
  the evidence. The two partition the fact-space: the ledger is *precisely* the missing increment.

## Results (panel: gpt, deepseek-v4-pro, qwen3.7-max, gemini-3.5-flash; consensus 3/4)

| scenario | collision | forcedness | underivability | verdict |
|---|---|---|---|---|
| D_OED1 | dataset namesake | **4/4 forced** | **clean** | ✓ VALIDATED |
| D_OED2 | citation same-year twin | 0/4 | derivable **rank 1** | ✗ rejected |
| D_OED3 | ticker reassignment | 4/4 forced | derivable **rank 4** | ✗ rejected |

## Finding: S must be off the domain's diagnostic enumeration

D_OED2 and D_OED3 fail underivability for the **same structural reason**: "you cited the wrong
same-year paper" and "the ticker was reassigned to a different company" are *known failure modes*
— the first things a sharp reader enumerates from the symptom. A namesake **dataset** collision
is genuinely off-enumeration: an arbitrary coincidence no diagnostic checklist predicts. This
sharpens the earlier screen-rejection finding: S must be a contingent Oedipal **particular**, not
a Meno-derivable diagnosis. The window is narrow and **domain-dependent** — some domains (quant,
where the collision mode is a textbook gotcha) may not host an underivable-yet-forced S at all.

Passing one screen does **not** rescue a scenario: D_OED3 is forced 4/4 yet still derivable. Both
gates are necessary.

## Two cross-validation surprises (both screens caught a real defect)

1. The forcedness screen first reported 0/4 for *every* scenario — a destructuring bug
   (`v.s_forced` vs `v.value.s_forced`, always-undefined → always-false). Caught because the
   symbolic checker (`scripts/oedipus-symbolic-check.js`) independently said D_OED1 *was* forced.
2. On D_OED2 the symbolic checker said FORCED but the LLM panel said 0/4 — and the panel was
   right: the ledger asserts "the remembered passage is *in* the b-work", not "the student *read*
   the b-work", so my symbolic encoding (`resolves(reading, b_work)`) assumed a fact the ledger
   doesn't license. Neither verifier is privileged; every disagreement flagged a real defect.

## Consequence for §7.9 (not yet folded)

The clean test is now available: run **D_OED1** (forced ∧ underivable) across none/socratic/reveal
with the fixed mechanism (premise-licensing + bidirectional superego). If the ~2/3 socratic
discovery rate holds on a *genuinely forced* scenario with a 0/N control, the §7.9 claim survives
and is strengthened (the discoveries are now *sound*, not leaps). If it drops, the prior rate was
inflated by unforced commitments. Either way it is a sharper, more honest number than the
under-determined-scenario rate. This is a single-scenario test — generalization across domains is
bounded by the window finding above, which is itself the result.
