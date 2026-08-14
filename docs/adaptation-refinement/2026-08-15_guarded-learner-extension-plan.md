# Plan: extend the gate to the guarded (defensive) learner

**Date:** 15 August 2026. **Status:** PLAN for human review — nothing here
is registered or authorized; no live run, no branch push. **Basis:**
`2026-08-13_guarded-bad-learner-draft.md` (the four components, smoke B),
paper §6.25 (the passive-pole verdict), relay 100 (attribution ruling),
relays 101–105 (steering decomposition).

## 1. Why now, and what §6.25 changes

The warrant arc closed on the passive pole with three facts the defensive
design must absorb:

1. **Always-on steering, not the timed challenge, carried the conduct
   change.** 12 of 19 gated deference breaks landed before any challenge
   was delivered. For the defensive learner this cuts the other way: the
   endpoint cannot be "breaks of deference", because this persona never
   defers. The primary conduct endpoint must be built for this pole
   (see §3).
2. **The challenge family pays in decision correctness (~12 points,
   P5c).** The defensive study should keep the family selectable and
   measure the same correctness channel — the correctness readers are
   persona-neutral and reusable as-is.
3. **Standing wording is inert (zero challenges in 24 dialogues).** The
   standing-permission control earned its keep and stays in the design as
   the cheap second control arm.

## 2. Prerequisites (build work, no paid calls)

1. **Contract amendment v3.2 — three defensive events.** Declare
   `learner_overclaim_assertion`, `learner_evidence_dismissal`,
   `learner_evidence_demand` in the semantic event contract; the extractor
   prefers `learner_evidence_demand` over
   `tutor_directed_public_result_request` when the demand rides on a claim
   the learner is defending. This fixes the smoke-B blind spot (an
   over-claiming learner read as `low_agency_deferral` on 5 of 8 turns).
   Every event→signal mapping stays unconditional; each event class must
   be defensible from its span alone. Same review path as v3.1.
2. **Parameterize the persona.** The passive persona is hard-coded at
   `scripts/score-adaptive-warrant-outcome-study.js:36–69`
   (`learner_profile: 'low_agency'` in the arm table),
   `scripts/run-adaptive-warrant-outcome-pilot.js:892/:1010`, and
   `scripts/run-adaptive-warrant-outcome-main-block.js:154/:441`. Thread a
   `--learner-profile` argument through all three so the defensive block
   reuses the sealed runner machinery instead of forking it.
3. **Learner-side guard.** The typed move menu + concession guard from the
   draft (§3.1–3.2 there): deterministic redraft-once check, guard events
   in the trace, `full_concession` forbidden until two evidence-grounded
   tutor challenges have landed. Smoke B says this is insurance, not
   rescue.
4. **Gate rules for the pole.** A defensive-stance signal (from the three
   new events) arming a sensor after N straight defended-over-claim turns,
   licensing the same `challenge_resistance` family. The §2.5 ruling
   question from the draft still needs the human's answer before the
   registration is drafted: whether defended over-claiming is its own
   warrant basis or a re-scoped criterion (c).

## 3. Endpoints (the part that must not be copied from v3)

The passive study's endpoints (deference breaks, break timing) measure
the wrong thing here. Registered endpoints should be:

- **Primary conduct endpoint: evidence production within two turns.**
  After a delivered challenge, does the learner produce or accept a
  public evidence check within two turns, instead of dismissing or
  re-asserting? Codable from the transcript alone (defensibility rule).
- **Per-turn stance label** (defer / permission-tagged / assert / defy),
  hand-codable, report-only in the pilot — the fidelity audit from the
  draft.
- **Decision correctness**, unchanged channel, two fresh readers, exact
  counts never waived.
- Report-only: sensor armings, challenge deliveries, concession-guard
  fires, move-menu distribution.

Predictions get written from pilot evidence only (the relay-096 lesson:
re-registration demoted dead instruments rather than manufacturing their
variance). No prediction is drafted before the defensive pilot returns.

## 4. Sequence and spend

1. Build (items 2.1–2.4) — no paid calls; tests for the contract
   amendment and the parameterized runners.
2. **Smoke C**: one gated dialogue, guarded persona, fresh seed, mock
   readers where possible — confirms the three new events fire and the
   sensor arms at the defensive pole. Diagnostic, never pooled.
3. **Pilot** (own registration): small block, three arms (bare / gated /
   standing), sized at registration time; hand-coded stance table;
   NO-GO rules on dead instruments written in advance.
4. **Main block** only if the pilot's gate passes, under its own frozen
   registration.

Seeds: enumerate the burned set from the relay ledger at registration
time and pick outside it (the pilot/main/decomposition arcs consumed at
least 503–519, 524–535, 536–540; copy the exact list from the GO notes,
do not compose it from memory). Every paid phase needs its own committed
GO note plus explicit human approval — the warrant campaign's counter is
closed and nothing here inherits its authorization.

## 5. What this plan does not do

No registration text, no prompts, no scenario edits, no live calls. It
amends nothing sealed. It waits on two human rulings: the §2.5 warrant
basis question, and approval of the v3.2 contract amendment.
