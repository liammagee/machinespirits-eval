# 122 — Finding: the main block's registered primary endpoint is unmeasured

Date: 2026-08-16
Workplan item: guarded-learner-outcome-study
Follows: relay 117 (registration), relay 120 (reader GO), relay 121
(warranted-shift re-analysis), defect-ledger rows 25–26.
Status: **OPEN finding. Zero calls. This note authorizes no spend,
registers no analysis, and edits no frozen file.** It records a
protocol fault found while preparing the paper section.

## 1. What was found

Relay 117 registers P3 as the guarded main block's primary endpoint:

> **P3 (primary, directional)** — The evidence-move rate in the two
> learner turns after a **delivered** challenge is higher than the rate
> after a **shadow-selected, not delivered** moment in the control
> versions.

and its OD2 states in writing what the endpoint needs:

> Both reader channels this time — the primary endpoint reads the
> presence readers, so they cannot be dropped the way the passive block
> dropped them.

Relay 120 §3 then retired that channel:

> Re-registration 096 amendment 2 retires the presence readers for the
> main block. They exist only to measure M7 and M8, and the pilot
> demoted both to report-only.

The sentence "they exist only to measure M7 and M8" is true for the
**passive** arc, where 096 was written. It is false for the guarded
arc: P3 reads them. The run finished with its primary endpoint
unmeasurable. Both frozen scorers confirm this by refusing the run:
`score-guarded-pilot-primary-endpoint.js --shape main-block` fails on
the missing `presence-reader-a.assembled.json`, and
`score-guarded-pilot-gate.js` fails with `shape.presence_readers is
not iterable`, so the P1 (arming) and P2 (delivery) slots are also
unscored as frozen, though the gate traces they read exist on disk.

## 2. How it happened

Three steps, each locally reasonable:

1. Amendment 2 was written for the passive block, where the presence
   channel had died at pilot for lack of variance and carried nothing
   else.
2. Note 120 carried the amendment onto the guarded block to save about
   1,150 calls, quoting its rationale without re-reading relay 117 §4,
   which names the presence readers as the primary endpoint's data
   source.
3. No check connects a registration's endpoint list to the channels
   the run fields. Defect rows 25–26 already state the class: **a
   registration binds the run only where the code reads it.** This is
   the class's fourth instance, and the first where the casualty is a
   primary endpoint.

A second, independent block existed before the retirement: defect row
26 records that the presence packets were over their own 60,000-byte
cap at 72 dialogues (82,038 bytes measured), because the catalogue and
schema scale with corpus size. So the frozen instrument could not have
fielded presence at main-block scale in any case. The registration
promised an endpoint the frozen tooling could not deliver at the
registered size, and nothing checked that at seal time.

## 3. What stands, what does not

Stands, because none of it reads the presence channel: M1 (283/463 =
61.1%; gated 68.4%, bare 61.8%, standing 53.2%), dialogue measures
2–6, the M7/M8 zero-call descriptions (labeled not reader-validated),
and the relay 121 warranted-shift re-analysis.

Does not stand: P3 (primary) — no data. P1 and P2 — unscored as
frozen; the gate traces exist, so a deterministic re-derivation is
possible, but the frozen scorer cannot run and must not be edited
without a ruling.

Retraction, for the record: a chat statement in this arc called M1
"the one primary endpoint." Relay 117 contradicts it. M1 was always a
secondary directional measure; P3 was primary and "nothing in this
design gates on P3" made it measured-never-gated — but measured.

## 4. Paths, none chosen here

- **A. Disclose only.** The paper section reports the block with the
  primary endpoint disclosed as unmeasured, with this note as the
  record. Free.
- **B. Re-based contrast, registered first.** The decision readers
  label every one of the 575 cases with a `speech_act`
  (learner_proposed_test 104, tutor_directed_public_result_request
  225, criterion_question 33, other 210, plus 3 rare), so an
  evidence-move contrast over the same delivered-vs-shadow windows is
  computable at zero calls. It needs its own sealed re-analysis note
  and ruling, carries the post-hoc label forever, and its act taxonomy
  is coarser than the presence instrument's.
- **C. Field the presence readers late.** Blocked twice: it is paid
  spend (~1,150+ calls) needing its own GO note and approval, and row
  26's size finding means the frozen instrument cannot run at 72
  dialogues — this path is instrument surgery plus a new freeze, not a
  resume.

## 5. Ledger

Defect-ledger row 27 records the fault. The private repo's
RUN-LEDGER.md gains a paragraph so no later reader cites the block as
fully measured.

NEVER push this branch.
