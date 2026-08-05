---
id: guard-delivery-prefer-model-over-canned
title: When every draft fails, ship the closest model draft instead of the template
status: triaged
type: infra
priority: P1
owner: claude
source: manual
created: 2026-08-06
updated: 2026-08-06
verification: >-
  DONE (2026-08-06, scripts/replay-guard-fallback-delivery.js): a replay over
  the fallible-phaseB traces that, for each of the 717 fallback
  turns, picks the least-vetoed model draft and reports what would have shipped
  and which findings would have ridden along. Then a paired live run on one
  cell under both delivery rules, comparing fallback rate, closure rate and
  turns to closure. The safety families must show zero deliveries carrying a
  leak, clue-bookkeeping or closure finding under either rule.
claim_status: planned
links:
  code:
    - services/tutorStubFirstDraftOuterLoop.js
    - services/tutorStubGuardDisposition.js
    - services/tutorStubTutorTurnPipeline.js
  items:
    - guard-regime-fallback-census-at-scale
    - guard-validity-study
    - tutor-stub-terminal-fallback-delivery-boundary
tags:
  - tutor-stub
  - guards
---

## The proposal

Today the ladder is: the model's draft, a plain rewrite, a repair, then a fixed
template. When nothing passes, the template ships — on 62% of turns in the
Phase-B run. The template is register-fixed procedural prose and performs no
character, so a high veto rate replaces the tutor under test with a script.

Change the last rung. When no candidate clears, ship the model draft that came
closest instead of the template, and record every finding it still carries.
Keep the template only for the cases where no model draft is deliverable at
all.

## What must not change

Three families stay absolute vetoes, with the template as the only fallback:

- evidence safety — a private fact, the concealed answer, a future clue, or an
  unsupported claim in public speech;
- clue bookkeeping — the due release must be present, once;
- closure integrity — the close is explicit, once, not early, and does not
  reopen proof work.

A draft carrying any of these is not a candidate for this rule at any distance.
A 5% chance of leaking the answer voids the outcome reading, which is the whole
measurement.

The rule therefore applies to the quality families: conversation integrity,
costume, source alignment, repetition, response composition.

## How "closest" gets decided

Needs settling before any code. Three options:

1. **Fewest findings.** Cheapest, and wrong in the obvious way — one severe
   finding beats three cosmetic ones.
2. **Weighted by disposition.** `services/tutorStubGuardDisposition.js` already
   sorts issues into hard, advisory and report-only. Score a draft by its
   remaining hard findings first, then advisories. Fits the existing catalog and
   needs no new judgment.
3. **Ranked by a judge.** Most faithful to "which of these is the better turn",
   and it puts a model back in the delivery path, which is exactly what the
   outcome channel was built to avoid. Rejected for the live path; keep it for
   the offline validity study.

Option 2 unless the replay says otherwise.

## Why this and not just relaxing the guards

They answer different questions. Relaxing a guard says the check was wrong.
This rule says the check may be right and the alternative is still worse — a
turn with a weak handoff teaches more than a turn of boilerplate. The two
compose: with the costume family scoring rather than vetoing, fewer turns reach
this rung at all, and the ones that do are the genuinely hard cases.

It also protects the measurement in a way relaxing does not. Every finding the
delivered turn carries stays recorded, so treatment fidelity is still readable
off the traces. Today a vetoed costume finding is recorded and the costume is
then absent from what shipped, which is the worse of both.

## Risks

- **Degenerate turns compound.** A draft that repeats itself ships, the next
  draft repeats it again, and the dialogue stalls with nothing to stop it. The
  repetition family is the guard against exactly this. Mitigation: keep
  `tutor_turn_without_advance` as a veto when it fires on a *run* of turns
  (the existing `TUTOR_STUB_ADVANCE_WINDOW`), not on one.
- **Trace incomparability.** Any run under the new rule cannot be pooled with
  runs under the old one. Needs a disposition catalog version bump and a note.
- **It could make outcomes worse.** Untested. The paired live run in the
  verification line is the check, and the result is allowed to be "no, the
  template was better" — that is a finding either way.

## Sequence

Replay first, live run second. The replay over the 717 Phase-B fallback turns
costs nothing and answers the main question — what would have shipped — before
any paid run.

## The replay says the new rung is nearly unnecessary

`scripts/replay-guard-fallback-delivery.js`, over the 717 Phase-B template
turns. It re-decides each model draft through the catalog itself rather than a
new score, so option 2 above is what was tested. First, the check that makes
the rest readable: the replay rebuilt the strict verdict for 942 drafts and
matched what the run recorded on all 942. It is seeing the findings the live
ladder saw.

| | turns | share |
|---|---|---|
| a draft clears the catalog's relaxed column | 653 | 91% |
| needs the closest-draft rule | 45 | 6% |
| stays the template | 19 | 3% |

Zero deliveries carry an evidence-safety, clue-bookkeeping or closure finding
under either rule. That check is by disposition category, not by guard name —
`dramatic_release` mixes duplicate delivery and source drift, which are
contracts, with costume checks, which are not, so a guard-level filter passes
clue bookkeeping through. An early cut of this replay did exactly that and let
four duplicate-delivery findings ride along.

Where the text comes from: 510 turns the model's first draft, 185 the plain
rewrite, 3 a repair. So on most of these turns the harness already had the
tutor's own words in hand at the first attempt.

The proposal on this card is therefore the small half. 91% of the template rate
needs no new delivery rung — only `TUTOR_STUB_GUARD_POLICY=shadow_advisory`,
the column the catalog already carries and already defaults off. The new rung
earns 45 turns, and 44 of those carry a source-alignment finding, meaning the
clue's exact wording or its handling action was not where the contract wanted
it. Over the whole run the template rate goes 62% → 2%.

## What relaxing would ship, stated plainly

The 653 turns carry 1,974 findings between them, three per turn. The largest:

| findings | check |
|---|---|
| 345 | the selected axis is not visible in the turn |
| 287 | the handoff drifts off the turn's focus |
| 263 | the selected part is not performed |
| 253 | the learner's contribution is not taken up |
| 207 | the turn does not advance |

The middle two are the ones to argue about. Shipping 253 turns that do not take
up what the learner just said, and 207 that repeat ground, is a real cost — it
is the failure mode the conversation-integrity family was calibrated against on
weaker stacks. Against it: those turns currently ship as a template that also
does not take up what the learner said, and does so in fixed prose. The
comparison is not draft against a good turn; it is draft against boilerplate.

That is precisely what `guard-validity-study` has to settle, and this replay
does not. The replay says what would ship. It cannot say whether it is better.

## Log

- 2026-08-06 — proposed after the Phase-B census. Not implemented.
- 2026-08-06 — replay run and landed as `scripts/replay-guard-fallback-delivery.js`.
  Result above: the relaxed policy column does 91% of the work, this card's new
  rung does 6%, safety holds at zero under both. Still not implemented, and the
  sequence should now put the default flip ahead of the new rung.
