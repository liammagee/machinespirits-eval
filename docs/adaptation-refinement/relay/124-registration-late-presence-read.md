# 124 — Registered late read: the presence instrument on the stored main block (P3)

Date: 2026-08-17
Workplan item: guarded-learner-outcome-study
Follows: relay 116 (act list and exposure test), relay 117 (P3
registration), relay 120 (the note that dropped the channel), relay 122
(the finding), relay 123 (the flat, saturated re-base), defect-ledger
rows 26–27.
Status: **SEALED 2026-08-17. Zero calls. No spend is authorized by
this note.** The human ruled on §6, quoted verbatim:

> 1 yes, 2 windows only

So this late read is the registered answer to relay 117's P3, scoped
to the delivered and shadow reply windows only. A paid read still
needs its own GO note with counts copied from the free dry
preparation, and its own approval.

## 1. The question — relay 117's P3, unchanged

> The evidence-move rate in the two learner turns after a **delivered**
> challenge is higher than the rate after a **shadow-selected, not
> delivered** moment in the control versions.

Relay 123 answered a coarser version and saturated (both sides above
70%, base rate ten times the pilot presence instrument's). This note
registers the read relay 117 wanted: the presence readers themselves,
on the stored transcripts.

## 2. Why a late read is defensible, and what label it carries

The 72 dialogues were generated before relay 122 existed; nothing in
them can react to what we now know. The P3 direction was sealed before
the run (relay 117 §4). The readers read stored transcripts, so
running them late changes when the measurement happens, not what is
measured.

Two things still keep this from being the clean pre-registered P3, and
the label discloses both:

1. The frozen instrument could not have run at this scale (row 26:
   largest packet 82,038 bytes against the 60,000-byte cap, because
   the reader catalogue and response schema grow with the corpus), so
   §4 amends how the collection is cut into packets.
2. We have seen the flat re-base (relay 123) before sealing this.
   The measurement itself cannot be steered by that — the readers see
   transcripts, not our numbers — but the decision to spend on this
   read was taken knowing them.

Label wherever cited: **late-scored registered endpoint, disclosed
instrument amendment**. It closes P3 with that label or not at all; it
never stands in a table as the clean pre-registered result.

## 3. The measure — relay 116 and the frozen scorer, unchanged

- **Definitions.** The reader handbook and act list are relay 116's,
  byte-identical — the same exposure test (a named public record put
  in play AND the learner exposed to what it says), the same three
  registered acts (a proposed test, a public result request, a
  record-entry request), the same rejected wide acts kept report-only.
  The dry preparation records the handbook hash; it must equal the
  pilot's.
- **Moments and windows.** Delivered challenges, shadow selections and
  the two-turn reply window come from the frozen endpoint scorer's
  exported functions (`scripts/score-guarded-pilot-primary-endpoint.js`),
  imported and never edited — exactly as relay 123 did.
- **Consensus.** The frozen scorer's own rule: a window counts as an
  evidence move when **both** presence readers see a registered act
  somewhere in its two turns. A moment with no reply turn leaves the
  denominator on both sides (relay 117 §4).
- **Coverage.** Windows-only: the read covers the turns inside
  delivered and shadow reply windows, nothing else. That is the whole
  denominator of P3; reading the rest of the corpus would validate
  only the demoted report-only measures. (§6 asks the human to confirm
  this scope.)
- **The ruled-out turn.** Dialogue 34 turn 8 stays out (ruling 002).
  A window that contains it is scored on its remaining turn and
  disclosed — the relay 123 treatment, unchanged.
- **Scoring.** Through the frozen scorer where its shape check
  accepts the main-block run with the presence channel fielded; where
  the pilot-shaped check refuses, a thin adapter imports the frozen
  functions (`readPresenceActs`, the window scorer, the contrast) and
  changes nothing in them. The adapter commits before any call.

## 4. The one amendment — packet cutting, nothing else

Row 26's overflow is in packaging, not in the instrument: catalogue
and response schema grow with the number of cases in a collection.
The amendment: cut the windows-only case list into shards, run the
frozen preparer (`scripts/prepare-adaptive-warrant-semantic-annotations.js`)
unchanged on each shard, and let every shard pass the existing
frozen byte caps (60,000-byte packet, unchanged). No cap moves, no
definition moves, no preparer edit. The dry preparation is free and
deterministic; it fixes the shard count, the planned call count, and
the largest packet size, and the GO note copies those numbers rather
than composing them.

## 5. Rules

- Sealed before any call. The scoring adapter and the dry preparation
  commit first; the GO note quotes the dry preparation's own numbers;
  the paid read starts only on explicit human approval. The campaign
  counter stands at 14,557 of 19,337 — the dry preparation must show
  the planned calls fit with room to spare.
- Readers run on the frozen Luna route (codex.gpt-5.6-luna), the same
  seats as every read in this arc.
- One contrast, the relay 117 shape: evidence-move windows over all
  windows, delivered against shadow, moment grain with dialogue grain
  beside it. No threshold invented after the numbers exist.
- The 18 pilot dialogues never pool in.
- Stored artifacts are read, never edited. Frozen files are imported,
  never edited.
- Reported beside, description only: either-reader windows, the
  second-count band, the rejected-wide band, per-condition shadow
  split, and the agreement between this read and relay 123's
  decision-tag read on the same windows.
- A flat or reversed result is a finding and closes nothing by force:
  the paper then reports P3 answered late in the negative, with the
  label. If the direction holds, P3 closes in the positive, with the
  label.

## 6. What the human rules to seal

1. Seal this late read as the registered answer to relay 117's P3 —
   yes or no.
2. Scope: windows-only (recommended — it is P3's whole denominator
   and roughly a third of the corpus), or the full 575-case corpus
   (also re-validates the report-only M7/M8 at more cost).

NEVER push this branch.

---

## Result (appended 2026-08-17 — the registration above is sealed and unchanged)

The read ran (GO relay 125, 520 calls) and the retake ran (GO relay
126, 6 calls). Scored through the frozen endpoint scorer by
`scripts/score-late-presence-read.js` (commit 1d844959, zero calls).
Score file: `$RUN/late-presence/late-presence-score.json`.

**Registered contrast: delivered 7/66 (0.106) vs shadow 13/152
(0.086). The direction holds. Per §5, P3 closes in the positive,
with the label** — late-scored registered endpoint, disclosed
instrument amendment. The effect is small: +2.0 points on 66
delivered windows. It never stands in a table as the clean
pre-registered result.

Reported beside, description only:
- Either-reader: delivered 0.183, shadow 0.171.
- Second-count band: 3 delivered windows. Rejected-wide: 45 (0.634).
- Shadow by condition: bare 5/63 (0.079), standing 8/89 (0.090).
- Agreement with relay 123's decision-tag read on the same windows is
  low: delivered 0.364, shadow 0.362. The two instruments read
  different things; the tag grain saturates where this one does not.

Disclosures that travel with every use of this result:
1. **Ruling 003**: 3 of 1,247 reader events dropped
   (assembly-invalid; all `learner_evidence_demand`). Its evidence
   block miscounted the damage (3, true count 8); corrected in
   ruling 004.
2. **Ruling 004**: the other 5 fatal events sat in 5 readings,
   quarantined and retaken once each (6 paid calls). All 5 retaken
   readings assembled valid.
3. **Mechanism amendment (assembly)**: GO 126 §6 promised derived
   collection manifests omitting the quarantined batches. The frozen
   validator requires every assembly to cover its manifest corpus
   exactly, so that design cannot assemble. Instead the retaken case
   rows substitute into derived copies of the original batch
   responses (the ruling-003 pattern; originals untouched), and each
   consumed row passes the full frozen per-event validation inside
   its shard assembly.
4. **Forced extra reading**: the preparer-forced sixth call
   (reader-b, case-d9db44be3662bb53c7cfdad6) is itself
   assembly-invalid (span not literal). It was ruled unused before
   launch and stays unused; its invalidity means wholesale frozen
   assembly of that retake collection fails, so wholesale assembly
   stands as a recorded attempt (3 of 4 collections pass; the one
   failure is exactly this unused reading). Paid provenance for all
   6 calls is checked by a free replication of the assembler's
   run-record checks.

Fail-closed checks all passed: 3 drops applied, 5 substitutions
applied, merged assemblies exactly 260 window cases per reader.
Campaign counter: 15,083 of 19,337.
