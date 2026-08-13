# 077 — Reviewer note: repair verified PASS; GO for v4 WITHHELD

**Date:** 13 August 2026. Authority: ruling 074a, direction 075,
driver report 076 (`28459b65`, repair at `48bf2e97`), the reviewer's
zero-call verification, and the second-session final-gate review.

## Numbering correction

The relay ledger holds two files numbered 074a: this reviewer's
`074a-reviewer-ruling-case-count-stop.md` and the second session's
`074a-reviewer-verdict-outcome-pilot-v3.md`. Both rule the v3 stop
technical; neither conflicts. Both stand as evidence. This note takes
077 (076 is the driver's report) and numbering continues from here.

## Repair verdict — PASS, both sessions

The direction-075 repair is verified by two independent zero-call
reviews. Reviewer: focused tests 16/16, widened suite 199/199,
evidence suite clean, ESLint clean, fixture bytes and source-trace
SHA re-computed. Second session additionally ran the new coverage
summarizer over the real sealed v3 traces (dialogue 11 reads 0.875
with turn 5 named; clean dialogues read 1.0) and byte-compared the
fixture against source records 168 and 174. No frozen surface
changed. The repair composes cleanly with the second session's
deference-sensor commit `46bfbdd9` at HEAD.

## GO 076a is WITHHELD — two blocking facts

1. **The gated condition cannot deliver challenges under the current
   design.** The challenge policy only runs when the warrant gate
   arms, and the gate's arming conditions
   (`services/adaptiveWarrantGateCore.js`, revision-warrant block) are:
   an immediate repair request or stall, a blocking public
   obligation, inquiry completion, an unsafe early close, a contract
   revision, register escalation, or two or more accumulated trouble
   turns. Sustained polite deference arms none of them. Verified
   zero-call in the stored decisions of all four never-challenging
   gated v3 dialogues (trouble never exceeds 1; warrant basis 'none'
   on every non-terminal turn), and confirmed live by the second
   session's user-authorized sensor-fix smoke (seed 518: the
   deference sensor now fires 3 of 8 turns, yet the gate never arms
   and zero challenges are delivered). A v4 take would therefore read
   zero on the pilot's challenge-delivery criterion with
   near-certainty. Making sustained deference its own warrant basis
   is a **substantive design change** — a fresh registration, which
   only the human can authorize (052a).
2. **The pinned counter is stale.** The human authorized two
   diagnostic smokes in the second session. Smoke A spent 26 calls;
   smoke B is live (3 reserved at this reading, cap ~30). Counter is
   at least 4,096 of 11,337 and settles only when smoke B seals. Any
   fresh GO note must re-pin `counter_before` from the settled value.

## State

- v3 dialogues 1–18: quarantined (ruling 074a), unchanged.
- Coverage repair `48bf2e97`: verified, standing, safe at HEAD.
- No run is authorized. The next step is the human's ruling on the
  re-registration scope; the second session's design note
  (`docs/adaptation-refinement/2026-08-13_pilot-retake-design-note.md`)
  carries the options and is being corrected by its author.
