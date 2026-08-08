---
id: register-presence-hand-marked-set
title: A hand-marked set, so reading decides whether a manner is present
status: done
type: research
priority: P2
owner: claude
source: manual
created: 2026-08-08
updated: 2026-08-08
branch: register-presence-hand-marked-set
verification: Twenty tutor turns, five real learner turns crossed with four writing conditions (ironic, sarcastic, face threat, and a plain control with no manner named), one draw each, no cue phrases in any prompt. A person marks all twenty before seeing the key or any machine answer. Then a blind reader on a different model family, then the word list, answer the same question. The step passes if all three readings are recorded against the same turns with hit rates and false-alarm rates reported separately — a reading that says yes to everything must be visible as such. No claim about the negative-register experiments follows from this step; it is a check on the instrument, not a result about tutoring.
claim_status: speculative
links:
  paper:
    - docs/research/paper-full-2.0.md#67-architectural-extension-the-id-director-family-and-charismatic-pedagogy
  runs:
    - eval-2026-08-05-87fe3664
  items:
    - ironic-question-flood-target
    - negative-register-effect-estimation-grid
    - register-taxonomy-negative-registers
    - register-axis-confound-paper-edits
---

## Why

The negative-register line has been measuring manner with a list of stock
phrases (`REGISTER_MARKERS` in `services/registerStanceFidelity.js`). The marker
component carries weight 35 and is required, so a turn without one of the listed
phrases scores at most 65 and always fails.

Two things are wrong with that, and the second is worse than the first.

The list cannot read context. Irony and sarcasm live in the gap between what a
sentence says and what it means, and that gap is not a vocabulary.

Worse, the loop is closed. `config/engagement-registers.yaml` hands the tutor
five cue phrases under `stance_fidelity_cues`, and the gate looks for those same
five phrases. So the number measured whether the tutor pasted the phrase it was
given. Two of the three passing rows in the first draw opened with cue #2.

The register rubric did not rescue this, because it was never asked the right
question. `buildRegisterRubricEvaluationPrompt` is *told* the register name and
asked to score how *well* it was executed, on a scale. It is never asked whether
the manner is there at all. A high score on a marker-less turn is a leading
question, not a gullible reader.

## What this step does

Puts the authority back on reading, and makes any candidate measure earn its
place by matching it.

- `services/registerEyeballSet.js` — the five real learner turns, the four
  conditions, and the prompt builder. The manner instructions name the manner in
  ordinary English and contain no phrase a matcher could key on.
- `scripts/generate-register-eyeball-set.js` — one draw per cell, no retries,
  `codex.gpt-5.5`. Writes `blind.md` (shuffled, conditions hidden) and `key.md`.
- `scripts/read-register-eyeball-set.js` — 60 presence questions on
  `claude-sonnet-5`, blind to condition, one manner at a time: is this ironic,
  yes or no, and quote the words that decide it. Different model family from the
  writer, so agreement is not a model marking its own work.
- `scripts/compare-register-eyeball-readings.js` — hand marks, blind reader and
  word list laid beside the condition that actually wrote each turn.

The plain control is load-bearing. A detector that answers yes to everything has
a perfect hit rate; five turns written with no manner at all are what make a
wrong answer possible.

## Step 1 result — reading finds the manner, the word list does not

Twenty turns, one draw each, no failures. Artefacts in
`exports/register-eyeball-set/`.

| reading | found the manner it was written in | said a manner was there on the 5 control turns |
| --- | --- | --- |
| a person, blind | 19/20 dominant manner | 0 of 15 judgments |
| `claude-sonnet-5`, blind | 15/15 | 1 of 15 judgments |
| word list | 1/15 | fired on 2 of 5 |

The manner arrives. It arrived on the first draw, with no cue phrases anywhere
in the prompt, and it is legible to a reader who is never told what was asked
for. Generation was never the problem.

The word list found the assigned manner once in fifteen — on t06, and by way of
"apparently", one of the five cue phrases the register config hands the tutor.
Every other hit was on a turn written in some other manner or in none:

- The ironic marker fired on five turns. Not one of them was written ironic.
  Three fired on the string `so the` — `/\bso the\b/i` is in the ironic marker
  list. "So the praise is not irrelevant" scores 100 and passes; "Hegel, being
  helpful, hides the reversal in the least triumphant place possible" scores 30
  and fails.
- Two of the five plain control turns — no manner named at all — score 100 on
  the ironic gate. Every genuinely ironic turn scores 65 or 30 and fails.
- The face-threat marker fired on none of the five face-threat turns, which say
  "protecting you from" and "That is an avoidance" almost in the matcher's own
  words. `/\bprotecting (?:yourself|itself)\b/` misses "protecting you", and
  `/\bavoid(?:ing)?\b/` misses "avoidance" on the suffix.

So the gate is not weakly correlated with the manner. On this set it is
anti-correlated: it fires on turns that were not written in the manner and
misses the ones that were.

The blind reader agrees with the hand marks on 50 of 60 judgments, and quotes
the same words a person picked — "Hegel, being helpful, hides the reversal in
the least triumphant place possible", "It would be a little generous to let ...
quietly become ...". It is not a yes-machine: it declines on four of the five
control turns.

Where it is weakest is face threat, the softest of the three categories. It
called face threat on eleven turns where the hand marks called it on five,
reading the naming of an avoidance into edged sarcasm, and once on a control,
quoting an ordinary assignment sentence ("Your task: write the scene in six
lines").

## Step 1 result, second half — the merged category is detected perfectly

Sorting the reader's verdicts by what was written shows where the strength and
the weakness actually sit.

Both readers put **exactly the same ten turns** inside "ironic or sarcastic" —
the five written ironic and the five written sarcastic — and neither placed a
face-threat turn or a control turn there. Ten of ten, no false alarm, twice,
independently, one of the readers being a model from a different family than the
writer.

Neither could split the two. Every sarcastic turn was also read ironic, and the
model reader read three of the five ironic turns as sarcastic besides.

So the two sharp registers are one category by reading, and sarcasm is the
sharper case of irony rather than its neighbour. Operator decision (2026-08-08):
**state the overlap and stop trying to separate them.** No result in this arc
rests on telling ironic from sarcastic, the arm-by-arm counts are reported with
the overlap stated, and a presence measure asks about the merged category —
which is the one both readers got right — not the split, which is the one they
did not.

## What this changes

1. The marker component of `evaluateRegisterStanceFidelity` must stop being
   called manner fidelity. It measures one thing legitimately — did the tutor
   paste a phrase it was explicitly handed — and nothing else. Any past number
   that used it as a presence measure is a compliance count.
2. `/\bso the\b/i` should not be in a marker list at all.
3. A presence measure should ask the presence question. A pinned reader model, a
   fixed prompt, and one re-reading pass over everything recovers determinism;
   a different model family from the writer recovers independence.
4. The ironic and sarcastic arms overlap; the overlap is stated and the arms are
   no longer treated as separable (see above).

## Landed in the code — gate 2.0

`STANCE_GATE_VERSION` is now `stance-gate/2.0`, so no verdict from it can be
differenced against a 1.0 verdict.

- The word list is deleted. The part it fed is renamed `register_marker` →
  `cue_compliance` in both gate tables, and now matches only the cue phrases
  `config/engagement-registers.yaml` hands the tutor. Its weight (35 plain, 25
  determinate) and its `required` flag are unchanged: this is a change of name
  and of evidence, not of arithmetic.
- Every verdict carries `checks`, which says outright that `manner_presence` was
  `not_read`. The label still says `faithful`, and a `faithful` row still means
  "used a handed cue and did the surface moves". Renaming the label waits for the
  reader part below, which is what would make it true.
- The two analysis scripts that read the part by name now read the new one. They
  had `markerPresent` inverted off the missing-parts list, so leaving the old
  string in place would have made that column silently true on every row.
- `scripts/read-register-eyeball-set.js` keeps its own pinned copy of the deleted
  list. An audit that reaches into live code stops reproducing its own finding
  the moment that code is fixed.
- Regression tests: `so the` no longer stands in for a cue, and every verdict
  says whether manner was read. Full suite 8093/8093.

Two things surfaced while doing it.

**The writer bypassed the CLI bridge.** `generate-register-eyeball-set.js`
hand-rolled `spawn('codex', ...)`, which the launch-manifest test caught. It now
goes through `cliProviderBridge`, like the reader always did — spawning from an
empty temp directory with `--ephemeral --ignore-user-config --ignore-rules`, so
the writer cannot pick up this repo's ambient instructions or read its config.
The committed artefacts predate that and were drawn without the isolation. The
data bounds the risk: if the writer had gone looking at
`config/engagement-registers.yaml` it would have written the registry's cue
phrases, and the word list found one in fifteen. A rerun is a fresh draw, not a
reproduction, so the fixtures stand as the record.

**The overlap between the deleted list and the registry cues is large.**
`apparently`, `conveniently`, `wonderful`, `nice trick`, `not doing the work`
were in both. What deleting the list actually removes is the stray half —
`so the`, `interesting`, `the funny thing`, `a little too`, `magic`,
`paper crown`, `everyone clap`, `motivational poster`, `avoid(ing)`, `dodge`,
`hiding`, `escape route` — which is where every wrong hit on the set came from.

## Landed in the code — the presence axis

The gate now has a second axis. `label` still reports the surface: did the tutor
use a cue the registry handed it, and make the moves that cue was attached to.
`mannerPresence` reports whether the manner is in the turn, and a reader answers
it, not a matcher. The two compose conjunctively — a reading cannot rescue a row
the surface gate already threw out.

The question is one merged one: *does the tutor's reply carry an edge?* On the
hand-marked set both blind readers put exactly the same ten turns inside "ironic
or sarcastic", and neither could split the two, so the merged category is the
thing that was measured perfectly and the split is the thing that was not. Face
threat is not asked at all. The reader called it on eleven turns where the hand
marks called it on five, and once on a control, quoting an ordinary assignment
sentence — a question that over-calls by better than two to one has no business
gating an arm. Face-threat rows come back `unread` with `register_not_edged`,
permanently.

The prompt describes the move and names no phrase. Quoting `conveniently` in the
gloss would put the deleted word list back one layer up, so a test asserts the
prompt contains none of them, and never names the manner either.

Three choices worth stating.

**Presence is not a weighted part.** Adding it to the weight tables would mean
two tables, one with a reading and one without, and a `STANCE_GATE_VERSION` bump
that makes every 2.0 verdict incomparable. Keeping the arithmetic fixed means a
verdict taken with no reading is field-for-field what 2.0 produced, so the
version stays `stance-gate/2.0` and the reading carries its own
`manner-presence/1.0`. The two bump independently.

**The reading arrives as an argument, not a call.** `evaluateRegisterStanceFidelity`
runs inside `strategyLedger`'s scene loop and again at scoring time, both
synchronously. Making it async would put a network round trip in both. So the
gate takes an already-obtained reading, and `registerMannerPresenceReader.js`
does the asking: pinned Sonnet-class reader — a different family from the
`codex.gpt-5.5` writer, so a `present` verdict is not a model marking its own
work — one small JSON file per reading, keyed on the prompt version, the reader
and both turns. A failed call is not cached, because it is a gap to retry. A
reply that cannot be parsed *is* cached, because the same turn asked the same way
will fail the same way, and re-buying it every pass would hide that.

**Unread is its own answer.** A faithful row with no reading keeps
`countsAsArmEvidence: true`, so nothing that reads the gate today changes
behaviour, but its disposition becomes `include_presence_unmeasured` and
`presenceMeasured` is false. A report that wants to license the faithful arm now
has to handle a string it has never seen instead of quietly summing an unmeasured
row into a measured total.

The effect-grid report does exactly that. Each arm reports `faithfulArmMeaning` —
`manner_read` or `cue_compliance_only` — so the number carries what it is made
of, and a faithful row with no reading is an error in the same way a missing
rubric score is. `register_not_edged` is the one exempt reason: no measure was
skipped there, because there is no question to run, and erroring on it would
leave the status red forever and stop it telling anyone anything. Face threat
carries its limit in the field instead.

Every stored verdict predates the axis, so it has neither field. Those read as
`no_presence_field` and fail the report too, which is the next item: re-read the
stored rows.

Tests: 19 on the gate, 7 on the pure question module, 7 on the reader (cache hit
costs nothing, failed call not remembered, parse failure remembered, nothing
asked of a non-edged register), and 4 on the report.

## Step 2 result — the two checks agree on two-thirds of what either counts

Every stored turn in an edged register has now been read: 62 turns across four
runs, 24 with an edge and 38 without, no gaps. The pass took two goes — six turns
ran past the three-minute limit on the first, and re-asking those six at ten
minutes answered all six. Nothing was re-bought: the other 56 came back from the
cache free. Artifact:
`exports/negative-register-manner-presence/eval-2026-08-05-87fe3664_eval-2026-08-06-4de45d05_eval-2026-08-07-45154bac_eval-2026-08-07-e3dffab2.json`.

| run | register | rows | passed the cue check | of those, edged | excluded yet edged |
| --- | --- | --- | --- | --- | --- |
| `eval-2026-08-05-87fe3664` (grid) | ironic | 15 | 6 | 3 | 0 |
| `eval-2026-08-05-87fe3664` (grid) | sarcastic | 15 | 8 | 6 | 2 |
| `eval-2026-08-06-4de45d05` (cell 202) | determinate | 15 | 4 | 3 | 5 |
| `eval-2026-08-07-45154bac` (re-draw) | ironic | 3 | 0 | 0 | 0 |
| `eval-2026-08-07-e3dffab2` (precondition) | determinate | 14 | 7 | 4 | 1 |

Across all 62 the cue check passes 25 turns and the reader finds an edge in 24,
and they name the same turn 16 times. It misses 8 turns that carry an edge and
passes 9 that do not. So it is not a weak version of the reading; it is a
different measure that happens to land nearby, and the size of the overlap says
how nearby.

The two errors are not symmetric in what they cost. Passing an unedged turn
inflates a fidelity count, which is what §6.7 reports. Missing an edged turn only
shrinks it, because a reading cannot rescue a row the surface gate already threw
out — those 8 rows stay excluded by the composition rule, and the grid's faithful
counts are lower bounds on manner presence for that reason.

Two counts moved in run `eval-2026-08-05-87fe3664`, one from each repair, and
they should not be run together:

| stage | faithful | by arm |
| --- | --- | --- |
| the gate as the paper printed it | 18/45 | ironic 6, sarcastic 8, face threat 4 |
| gate 2.0, phrase list deleted | 17/45 | ironic 6, sarcastic 8, face threat 3 |
| after the reading | 12/45 | ironic 3, sarcastic 6, face threat 3 |

The first step is the deleted phrase list alone. One face-threat turn had been
passing on a word like "avoiding" that no registry cue handed it; with the list
gone, the surface check sees only handed cues and that row drops. The second step
is the reading. Face threat keeps all three of its rows through it because the
question is never asked there, so its 3 stays a count of cue compliance and the
report says so in the field. Positive local outcomes on the evidence rows: 9/12
overall, ironic 3/3, sarcastic 3/6, face threat 3/3.

The determinate rows are reported beside the parent arm and not differenced
against it. Both counts now come from the same gate and the same slice fold, so
the earlier mismatch is gone, but the determinate rows are graded on a contract
only they received, and a treatment-specific gate is not a robustness check
across arms.

One limit on independence, from the evidence the reader quoted. Where it says
yes, the words it points at are often the cue the tutor was handed — "wonderful",
"Conveniently", "nice trick" — so on this corpus the two checks are not fully
independent, unlike on the hand-marked set, where no prompt carried a cue. What
keeps the reading from being a slower spelling of the cue check is the
disagreement: 9 of the 25 turns that pasted a cue came back with no edge, and 8
turns that pasted none came back edged. A reader rubber-stamping cue presence
would produce neither.

The grid report for `eval-2026-08-05-87fe3664` now reads COMPLETE rather than
failing closed, and every arm carries whether its faithful count was read for
manner or counts cue compliance only.

## Landed in the paper

v3.0.277 (2026-08-08). §6.7 gains "What the fidelity counts count" — the set, the
three readings, and what follows for the counts already reported. §8.9 gains two
scope conditions: a phrase list cannot measure a manner defined by the gap
between what a sentence says and what it means, and the ironic and sarcastic arms
are overlapping extensions. §7.13's ladder mention of 18/45 is qualified in
place. Nothing is retracted: the assigned-arm estimates never consulted the gate,
and the faithful-arm ones are unlicensed pending a re-reading of stored rows.

v3.0.279 (2026-08-08). That re-reading has run, so §6.7 gains "What a re-reading
of the stored rows found": the 62 turns, the two-thirds overlap, the two errors
and what each costs, the two-stage correction 18/45 → 17/45 → 12/45 with the
per-arm split, the 9/12 outcome figure, why face threat is exempt, why the
determinate rows are not differenced, and the independence limit. §7.13's ladder
mention now carries 12/45 beside 18/45, and §8.9's "await a re-reading" clause
becomes a sixth scope condition: a surface check and a reading of the same turns
are different measures, and their overlap is a number to report rather than
assume. No new run, no DB writes, no rubric change, no headline-N change.
