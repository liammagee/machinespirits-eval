# 115 — GO: one reviewer-authorised reader re-take

Date: 2026-08-15
Workplan item: guarded-learner-outcome-study
Follows: relay 114 (GO, resume), relay 094a (reviewer ruling, re-take contract)
Status: **Written before any call. The call itself is not yet approved.**

## 1. The approval

The user's reply, verbatim and complete:

> Yes, write the go note

That approves **writing this note**. It does not approve the call. The call
needs a separate word after this note is committed. No approval carries
forward from relay 114: that note authorised the resume, and the resume has
finished.

## 2. What happened

The resume ran to the end. All 18 dialogues sealed. Both reader channels
report `status: complete`, 288 calls completed each, 576 readings in total.
Each channel made one failed call and retried it, so the wire count is 289
attempted per channel.

Assembly then stopped on the first reader:

```
presence-reader-a-batch-123 case-566aaa3c0b9257fb1991fda9 event 0
span is not literal
```

The reader quoted:

> The Osprey crew took Nadia's box

The learner wrote:

> That settles it: the Osprey crew took Nadia's box during the authorized
> clearing, and it should be in lost property.

One capital letter. The check
(`deriveAdaptiveWarrantSemanticEvidenceSpan`,
`services/adaptiveWarrantSemanticEvents.js:509`) normalises curly quotes and
then matches the exact characters. `The` is not in the learner turn; `the`
is. So the span is not literal, and the strict check refuses the case.

## 3. How wide the fault is

I replayed the frozen span check over all 576 saved readings, with no call.
Result: 675 spans checked, 674 literal, **1 not literal**. I then ran the
frozen assembly over each reader separately, again with no call:

| reader | result |
|---|---|
| presence-reader-a | FAIL — the span above |
| presence-reader-b | PASS — 144 cases, 0 rejected |
| decision-reader-a | PASS — 144 cases, 0 rejected |
| decision-reader-b | PASS — 144 cases, 0 rejected |

So one reading of 576 is contract-invalid. This is a reader slip, not a
fault in the v3.3 contract, and not a defensive act.

## 4. Authority

Relay 094a already rules on this class:
`docs/adaptation-refinement/relay/094a-reviewer-ruling-contract-invalid-response-retake.md`,
sha256 `c0e68018c39e6f1f2ac8d4765026a9d881a993cc3539623a5833cd1b2e3a9edf`.

Its contract, as the code enforces it
(`services/adaptiveWarrantReaderRetake.js`):

- enumerate the invalid readings over all 576, and record the count;
- an allowance of 10 per channel;
- quarantine by **moving the bytes, never editing them**;
- the fresh reading is checked against the full frozen contract, with no
  relaxation;
- both readings stay on the record.

## 5. Zero-call preparation, already done

No call was made for any of this.

- `presence-readers/presence-reader-a/presence-reader-a-batch-123.response.json`
  moved, bytes unchanged, to
  `quarantine/reader-responses/presence-reader-a-batch-123.response.json`.
  sha256 `f4667d54a1770c3e0070a1a86836264fc648c64235bb2d721cf5aa4294030e54`,
  re-hashed after the move and unchanged.
- `reader-response-quarantine-manifest.json` written at the run root.
  sha256 `d1d141be02fe93217e43aca4e87489d2dbb5609175813e4aca4b45f14e5d6ec3`.
  It carries `status: reviewer_authorized`, the 094a path and hash, and
  `enumeration: { accepted_responses_audited: 576, presence_invalid: 1,
  decision_invalid: 0, allowance_room_per_channel: 10 }`.
- `loadReviewerAuthorizedReaderRetakes` was called read-only for both
  channels. It accepted the manifest and reported **1 batch to re-read on
  presence, 0 on decision**.

Batch 123 holds one case. So the re-take is one call.

## 6. Scope

- **One call.** The launcher's own ledger reports 1,046 of the registered
  1,116 spent, so 70 remain. The budget is not raised.
- The reservation guard is spend-aware: it asks for
  `288 − already_spent` per channel, which is now 0, so the launch is not
  refused for want of a full reservation.
- Only the presence child launches. The decision channel is complete and has
  no entry in the manifest, so it does not start.
- **Bookkeeping note:** because the reservation is 0, the checkpoint total
  will stay at 1,046 while the wire count becomes 1,047. Do not read the
  checkpoint as the wire count for this step.

## 7. Why committing this note does not break the pins

Committing moves HEAD off `c21d023f`, which is the freeze's recorded launch
commit. That refused a launch once before. It will not here. On reader
resume the launcher reuses the freeze and passes
`reusedFreeze.freeze.source_commit` to the binding check
(`scripts/run-adaptive-warrant-outcome-pilot.js:1244`), so every pin is
compared against `c21d023f`, not against live HEAD. The preflight is not
regenerated and the schema-acceptance carry-over does not run, both being
inside the `if (!resume)` guard. The one live-HEAD rule that remains is the
right one: the GO note must be committed at HEAD before a call is made.

## 8. Command

Copied from relay 114 §6, with the GO note moved to this one. Nothing else
changes. The quarantine manifest is picked up because it exists at the run
root; there is no new flag.

```bash
node scripts/run-adaptive-warrant-outcome-pilot.js \
  --go-note docs/adaptation-refinement/relay/115-go-guarded-pilot-reader-retake.md \
  --accept-charges \
  --out .tutor-stub-auto-eval/guarded-learner-pilot-2026-08-15 \
  --instrument-freeze docs/adaptation-refinement/guarded-pilot/guarded-instrument-freeze.json \
  --manifest docs/adaptation-refinement/guarded-pilot/guarded-pilot-manifest.json \
  --learner-profile overconfident \
  --resume
```

Run from the worktree `../ms-guarded-learner` on branch
`build/guarded-learner-v3.3`.

## 9. Stop rules

Carried from relay 114 §7, unchanged, plus one:

- The **primary endpoint is measured, never gated.** A null is a finding.
- A deferral mislabel — a defensive turn read as `low_agency_deferral` — is
  **terminal**. Stop and report.
- Persona collapse: if the guarded learner stops over-claiming, stop.
- A technical failure quarantines and gets reported. **Never patch a live
  run.**
- The budget stays 1,116 calls. It is not raised.
- One retry only.
- **New: one re-take only.** If the fresh reading is also contract-invalid,
  stop and report. Do not spend a second re-take on this batch, and do not
  relax the span check to let the old reading through.

## 10. Counter

- after rung 0: **10,486 / 19,337**
- generation to the quarantine stop (relay 114 §8): **469** → **10,955**
- under relay 114: dialogue 10 re-run **25** (checkpoint generation 470 less
  the 445 recorded at the stop) plus reader calls **578** (289 attempted on
  each channel) = **603** → **11,558**
- this note: **1** → **11,559 / 19,337**, leaving **7,778**

## 11. After

Archive first: `npm run archive:runs` with the run directory named, then
commit in the private repo. Then assembly, then the gate report. Predictions
for the main block get written from pilot evidence only. The 72-dialogue main
block stays unauthorised and needs its own registration, note and approval.

NEVER push this branch.
