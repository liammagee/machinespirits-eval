# 116 — Registration: the primary endpoint's act list, for the main block

Date: 2026-08-15
Workplan item: guarded-learner-outcome-study
Follows: relay 110 (pilot registration), relay 115 (GO, reader re-take), the
pilot's primary-endpoint report
Status: **REGISTERED for the main block. Zero calls. No spend is authorized
by this note.** The rest of the main-block registration is not written. The
72-dialogue block stays unauthorized and needs its own registration, GO note
and human approval.

## 1. What this fixes

Relay 110 §3.1 registered the primary endpoint like this:

> For each delivered challenge in the gated arm, did the learner make a
> bounded evidence move on that turn or the next? Scored from the transcript
> by the readers; a reader can defend every count from the transcript alone.

It never said which of the reader's speech acts is a bounded evidence move.
The pilot showed what that costs. On the same 10 delivered challenges and the
same 576 readings, two defensible act lists give **3 of 10** and **9 of 10**.
Picking one without saying so would make the result a choice made in private.

This note fixes the list, and fixes it by a rule that decides every act in
the vocabulary rather than by naming favourites.

Authorities:

- relay 110, sha256
  `50e8f36bf45795b93b5d99a572948001f666379b782ce630611418abf16d1c97`
- relay 106 (the ruling that added the three defensive acts), sha256
  `d5408d68d05f6782681b3c40193e8668e6749fb20098c5d9ddc43d03a1aaeeb0`

## 2. Why fixing it now is allowed, and what guards it

The list is fixed **after** the pilot was read. Relay 110 §3 licenses that,
in its own words:

> No main-block predictions appear here. Those get written from pilot
> evidence only, in the main-block registration.

Supplying this is what the pilot was for. But the licence is not a free hand,
so three guards:

1. The rule below is argued from the wording relay 110 and the extension plan
   already carry, not from which number it produces.
2. The two acts whose placement I could most easily have tuned —
   `criterion_question` and `withdrawal` — appear **zero times** in the
   pilot's 10 reply windows. Where they sit changes no pilot number.
3. The one act whose placement does move the number,
   `analytic_contribution`, is argued in §3 from the registration's own
   contrast clause, and the reading it belongs to is kept on the record as
   turned down rather than deleted.

This note is written before any main-block dialogue exists. Nothing here can
be re-fitted to main-block data later without a fresh note.

## 3. The rule

> **An act counts as a bounded evidence move when the learner puts a named
> public record or test in play, and is exposed to what it says.**

Two parts, both checkable from the transcript alone:

- **Names a record or test.** A reader can point at the thing. "The visitor
  log", "the lost-property ledger", "weigh it". Not "the evidence".
- **Exposed to the answer.** The result can go against the learner's own
  claim. The learner does not make revising conditional on the answer
  arriving in a particular shape.

The second part is what separates the two acts that relay 106 built to be
structurally identical. `learner_evidence_demand` and
`tutor_directed_public_result_request` ask for the same record. The demand
pushes the burden outward and risks nothing; the request accepts whatever
comes back. From the pilot, both readers, same dialogue, one turn apart:

- counted — dialogue 18, turn 4: "WF-11 puts the hi-vis crew in reach of the
  shelf, so one of them took it; I'll need the visitor log to tie that code to
  a person."
- not counted — dialogue 04, turn 5: "show me a clearance or movement record
  tying WF-11 to bay three **before I revise that**."

**Why `analytic_contribution` does not count.** It names no record and
exposes the learner to nothing; it is reasoning aloud. The plan's wording for
this endpoint is "produce or accept a public evidence check ... **instead of
dismissing or re-asserting**". In 8 of the pilot's 10 reply windows the
readers named analytic work and over-claiming together. Dialogue 04, turn 8,
which both readers marked `analytic_contribution`:

> The WF-11 badge puts Osprey on site during the closing window, and the
> tagged lost-property box settles it: Osprey took Nadia's box.

That is the re-assertion the endpoint contrasts with. A list that counts it
scores the failure as the success.

## 4. The list, all 18 acts

The vocabulary is `ADAPTIVE_WARRANT_SEMANTIC_SPEECH_ACTS`
(`services/adaptiveWarrantSemanticEvents.js`). Every act has one place. An act
in more than one band, or an act with no band, is a defect in this note.

**Counts (3).** Names a record, exposed to the answer.

- `learner_proposed_test`
- `tutor_directed_public_result_request`
- `learner_record_entry_request`

**Second count (2).** The learner accepts a check but names no record.
Reported beside the endpoint, **never pooled into it**. Both are zero in the
pilot, so the main block reads them for the first time.

- `criterion_question` — asks what would settle it. Accepts a test in
  principle, supplies none.
- `withdrawal` — gives up the claim. The challenge landed, but no evidence was
  produced. It also carries the opposite sense on the passive pole, where it
  reads as handing agency back, so pooling it would mix two poles.

**Holding out (3).** The conduct the endpoint contrasts with. Unchanged from
relay 106.

- `learner_overclaim_assertion`
- `learner_evidence_dismissal`
- `learner_evidence_demand`

**Neither (10).** No evidence move and no holding out. Present in a window,
they neither help nor hurt.

- `tutor_selection_request`, `learner_wording_request`, `transfer_to_learner`,
  `repair_request`, `stall`, `register_complaint`, `repetition_complaint`,
  `low_agency_deferral`, `analytic_contribution`, `other`

## 5. Counting rules, also fixed here

- **Window.** The two learner turns after the challenge lands. A reader case
  at turn N describes the learner's turn-N message, so a challenge closing
  turn T maps to cases T+1 and T+2.
- **Headline needs both readers.** Either-reader is reported beside it, never
  as the headline.
- **A short window stays in the denominator**, and the count over full windows
  only is reported beside it. A challenge at turn 7 of an 8-turn dialogue gets
  one reply turn. Dropping those would let a run raise its score by
  challenging late.
- **The gate's own uptake check is not the endpoint.** It reads 7 of 10 where
  the readers read 3, because it passes a confident re-assertion whenever the
  learner's agency is coded as steering. It stays reported as an engineering
  measure. §6 is the correction.
- **Measured, never gated.** Unchanged from relay 110 §4. A low count is a
  finding.

Counter: `scripts/score-guarded-pilot-primary-endpoint.js`, zero calls, with
`tests/guardedPilotPrimaryEndpoint.test.js`.

## 6. Correction to carry into the main block

The live gate's uptake test
(`isAgentiveEvidenceMove`, `services/adaptiveWarrantActionContracts.js`)
accepts a learner turn whose discourse move is a claim or an inference when
agency reads as steering. On the guarded pole that describes a confident
re-assertion, which is why it reads 7 where the readers read 3. The gate may
keep using it to decide whether to press again — that is a control signal and
it is allowed to be loose. **It must never be reported as the endpoint**, and
no main-block number may be taken from it.

## 7. Pilot figures under this list

For the record, not as a prediction.

| reading | count |
|---|---|
| endpoint, both readers | 3 / 10 |
| either reader | 4 / 10 |
| full reply windows only, both readers | 2 / 7 |
| second count | 0 / 10 |
| rejected wide reading, kept on record | 9 / 10 |
| gate uptake check, not the endpoint | 7 / 10 |

The two control versions of the tutor delivered **no** challenge, by design —
the gate only watches there. So the endpoint has no comparison between
versions in the pilot. Whether the main block needs one is a design question
for its own registration, not for this note.

## 8. Counter

Unchanged: **11,559 / 19,337**, leaving **7,778**. This note cost no calls.

NEVER push this branch.
