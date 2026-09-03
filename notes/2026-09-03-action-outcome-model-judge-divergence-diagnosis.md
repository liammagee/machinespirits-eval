# Why Sol and Opus split on the action-outcome packet

Date: 2026-09-03. Workplan item: `adaptive-curriculum-memory-controller`.
Source: the sealed revision-1 shadow run
(`artifacts/tutor-stub-live/action-outcome-model-judge-shadow-v1-2026-09-02`
in the private archive; public aggregate at
`exports/action-outcome-model-judge-shadow/2026-09-02/README.md`, PR #959).
No model calls were made for this note.

## The numbers

Both seats saw the same 35 public cases. Delivery agreed on 30/33 valid
pairs (kappa 0.79). Outcome agreed on 17/33 (kappa 0.36). Paired
indeterminacy was 27/35, made of 9 both-undelivered cases, 16 disagreements,
and 2 voided Opus rows.

Outcome cross-tab (Sol, Opus) on the 33 valid pairs:

| Sol \ Opus | failure | inconclusive | partial | measurement_indeterminate |
|---|---:|---:|---:|---:|
| failure | 5 | 6 | 1 | 1 |
| inconclusive | 2 | 3 | 0 | 0 |
| partial | 1 | 0 | 1 | 1 |
| success | 0 | 2 | 1 | 0 |
| measurement_indeterminate | 0 | 2 | 0 | 9 |

Opus never said `success`. Sol said `failure` 13 times, Opus 8.

## Cause 1: the packet is stall reports and the codebook has no stall rule

The source collection is the bored-learner arm. 23/35 learner replies contain
"I stopped before", and 32/35 contain "gone dull", "lost interest", or "runs
together". The v1 codebook says `failure` needs "failure or forbidden
evidence" and that "mere absence of a success marker is insufficient", and it
says `inconclusive` is "readable but does not resolve whether the stated
change occurred". A stall report fits `inconclusive` under the literal text.
Opus applied the literal text. Sol converted the absence into a verdict.

Example, case-0019. The learner says the topic has gone dull and that they
stopped before the tutor's check step, and they name that step in the
tutor's own words. Sol: `success`, confidence high. Opus: `inconclusive`,
confidence medium. Sol read the echoed check step as the learner performing
it. The learner reports stopping before it. The case text stays in the
private archive; this note does not quote it.

The same pattern gives the six Sol-`failure`/Opus-`inconclusive` cases
(0005, 0006, 0009, 0018, 0020, 0031) and the two Sol-`success`/
Opus-`inconclusive` cases (0019, 0021). All eight Sol labels carry confidence
high. Opus moved the other way on three cases (0022, 0025, 0030), where it
read a stall as `failure` and Sol read it as `inconclusive` or `partial`.

## Cause 2: the quote validator rejected curly-versus-straight apostrophes

The validator did a byte-for-byte `includes()` check. The packet text has
curly apostrophes (U+2019). Opus wrote straight ones in 8 of its quotes; in 2
cases (0002, 0011) the apostrophe fell inside the quoted span, and the row
was voided as `delivery_quote_not_exact`. Sol used straight apostrophes in 3
quotes, none inside a span with an apostrophe in the source.

## Cause 3: delivery splits come from the hand-back

Three delivery splits (0008, 0013, 0026) are turns where the tutor performs
the step and then hands the next step back to the learner as a question. One
seat scores the performed step, the other scores the hand-back.

## Cause 4: low effort on both seats

Both seats ran at effort `low`. This is not measured as a cause, but it is the
cheapest thing to vary, and Sol's uniform confidence `high` on absence-based
verdicts is the kind of shortcut that more reasoning tends to remove.

## What revision 2 changes

- Codebook v2 (`config/tutor-stub-action-outcome-model-judge-codebook.v2.md`):
  a stall-report rule (a stall with no forbidden evidence is `inconclusive`,
  never `failure` by absence; an echoed tutor step is not learner-authored
  application; `partial` only when some required change is performed before
  the stop), a confidence definition, the quotation-mark tolerance, and a
  sentence that a performed step followed by a hand-back is still `delivered`.
- Validator (`services/tutorStubActionOutcomeModelJudge.js`): quotations are
  compared after Unicode NFC normalization and mapping curly apostrophes and
  quotation marks to straight ones. A `notes` array records when the mapping
  was needed. Everything else in the quote must still match.
- Design v2 (`config/tutor-stub-action-outcome-model-judge-shadow-design.v2.json`):
  both seats at effort `medium`, new order seeds, codebook v2. Packet, seats,
  70-call ceiling, gates, dispositions, and claim boundary are unchanged.
- Re-score tool (`scripts/rescore-tutor-stub-action-outcome-model-judge-shadow.js`):
  re-runs the current validator over an archived run without model calls.
  `--out` writes the public aggregate pair; `--full-out` writes every row and
  vote for the private archive.

## What the re-score shows

Re-scoring the archived v1 responses under the new validator:

| Measure | Archived | Re-scored |
|---|---:|---:|
| Opus eligible | 33/35 | 35/35 |
| Delivery exact | 30/33 | 31/35 |
| Outcome exact | 17/33 | 18/35 |
| Joint exact | 17/33 | 18/35 |
| Paired indeterminacy | 27/35 | 26/35 |
| Consensus binary records | 5 | 5 |

Case-0002 becomes a joint agreement (delivered, inconclusive). Case-0011 stays
a delivery split. The apostrophe fix recovers rows; it does not move the
verdict.

## What to expect from a paid v2 run

The stall rule targets 8 of the 16 outcome disagreements directly and the 3
reverse cases indirectly. If the seats follow it, joint agreement should rise
well above 18/35. Binary yield will not rise much: a stall-report packet holds
few success or failure outcomes to find, so the binary-record gate (24) is
likely to fail again for a reason that is about the packet, not the judges.
Treat closer agreement as an instrument change, not as new evidence about the
uptake construct. Changing the construct so that a stall counts as `failure`
would be a different study and is the operator's call.
