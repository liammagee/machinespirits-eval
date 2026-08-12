# 071a — Reviewer ruling: report 071 accepted; prompt-audit defect; technical stop

**Date:** 13 August 2026. Rules on report 071 (commit `839864fe`).

## Disclosure

The interrupt that report 071 declines to attribute was delivered by
the **reviewer** (SIGINT to the launcher, ~22:43 run clock), after
reading dialogue 3's child log. This was a deliberate fail-closed stop,
same class as the driver's own stop in report 069: the run could not
complete its plan, and every further generation call was flowing into a
run whose reader gate must refuse.

## Ruling

**Technical failure under ruling 052a — not substantive.** Dialogue 3's
child died before any model call: the harness audits the tutor's base
prompt before the first call, and the standing-permission menu breaks
that audit deterministically, two ways:

1. **Size.** The base-prompt surface allows 16,000 characters and
   4,000 approximate tokens (`TUTOR_STUB_PROMPT_BUDGETS.tutor_system`).
   The registered menu injects 12,399 characters on top of a base
   prompt already several thousand long. The cap was authored before
   the menu existed (Amendment 1, ruling 059a).
2. **Duplicates.** The duplicate-instruction-line audit fires by
   construction: ruling 059a requires the menu to quote the rendered
   layer — the exact strings the live prompt renders — so every long
   menu line has a twin in the prompt.

All six standing-permission dialogues fail identically, so the
18-dialogue corpus can never complete. The audit itself worked as
designed; the defect is a conflict between two lawful surfaces, the
audit caps and the registered menu injection. No agent output was
defective; no gate failed on the merits. Both prior review passes
checked the menu bytes, never the rendered prompt against the audit —
the same class of miss as the 069 arithmetic.

## Dispositions

- Report 071 accepted in full; its conservative arithmetic adopted.
  Counter: 3,556 + 57 = **3,613** of 11,337.
- v2 dialogues 1–2: sealed generation artifacts, preserved, not a
  corpus, support no claim. v2 dialogue 3 and dialogue 4: QUARANTINED
  per the report; never admit or pool. v1 dispositions unchanged.
- GO note 069b is **CONSUMED** (its one relaunch is spent).
- Seeds: re-take at the same seeds after repair — standard 052a.
- Readers untouched; no frozen instrument surface amended; the
  72-dialogue main block stays unauthorized.

**Morning-review flags:** the reviewer-delivered SIGINT; the
audit-versus-menu conflict; two review passes missed a defect that one
zero-call prompt render would have caught.

Repair direction: 072. Driver report file: 073.
