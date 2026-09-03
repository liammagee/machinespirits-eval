# Action-outcome keyed collection, revision 3 (design only)

Date: 2026-09-03. Workplan item: `adaptive-curriculum-memory-controller`.
Design file: `config/tutor-stub-action-outcome-keyed-collection-design.v3.json`.
This note explains the design in plain words. It grants no model calls.

## Why the line is blocked

The memory controller needs a table of action-outcome records: for each
action family, in each condition, on each world, how often the next learner
turn came out well. Two collections and two model-judge shadow runs have not
produced that table.

The v2 collection sampled one learner profile, `bored`, and let only
stall-condition closures into the review packet. All 35 reviewed next turns
carry a disengagement marker. The two judge seats agreed on the outcome in
24/35 cases and on delivery in 27/35, and they found zero binary outcomes.
The zero is a property of the packet. A packet made of stall reports holds
nothing binary to find, whoever reads it.

The card is marked `blocked` on: valid action-outcome evidence with adequate
binary support, from human-calibrated judgments or from prospectively
collected, objectively checkable learner outcomes. Revision 3 is the second
route.

## What revision 3 changes

1. **A keyed hand-back question.** Every delivered comparative action ends
   with one question that names two released record tokens. One is the token
   the proof frontier needs next (the key). The other is a released token the
   frontier does not need (the foil). The runtime computes both from the world
   file and the released-record state before the tutor model is called, and
   writes them to the trace. The next learner turn is read by exact token
   match: `correct_pick`, `wrong_pick`, `no_pick`, or `other`. The tutor text
   does not define the key, and no unreleased or guarded token may appear in
   the question.

   Illustration on world 026 (Skyway Bakery), if the frontier stands at the
   first rule: the key is the bolted-shutter record and the foil is the
   hiring record for Tibbin. The tutor asks which one the next step needs.
   The real pair is computed at run time; this is only the shape.

2. **Three learner profiles.** `bored` stays as one stratum of 20 dialogues,
   so the v3 yield can be set beside the v2 packet. `diligent` and
   `slow_learner` add 20 dialogues each. All three are maintained profiles
   in `scripts/tutor-stub-learner-profile-contracts.js`.

3. **The stall condition is a stratum, not a filter.** Every exact-set
   closure enters the packet. The condition label (`matched` or
   `unmatched`) is recorded with each case. Gates require at least ten
   delivered cases in each stratum.

4. **Per-family delivery checklists** replace the single hand-back sentence
   of codebook v2. That sentence moved delivery agreement from kappa 0.79
   in v1 to kappa 0.20 in v2. Each of the three comparative families has
   three short lines a coder can check from the transcript alone.

5. **Two outcome rules registered before collection.** An explicit stop
   statement after a delivered action is an outcome (failure when there is
   no pick). A missing or truncated turn is not; it is inconclusive. A bare
   pick answers the keyed question and is the machine outcome, but it is
   not learner-authored application, rationale, or choice; on the human
   semantic label it is at most `partial`.

6. **Two channels, one admission rule.** The machine channel gives the
   pick, the record citation, the stratum, and the delivery token check.
   The human channel gives the delivery checklist, the semantic label, and
   the explicit-stop reading. A binary record needs a machine pick (or a
   machine no-pick with an agreed explicit stop) on a turn both coders agree
   was delivered. No model judge sits in the authoritative path.

## What stays the same

The exact three-family eligible set (`explain_model`, `minimal_support`,
`request_self_explanation`) as the comparability unit. Uniform family draw
at admitted turns. Support level 1, bland register, no light adaptation,
memory controller off. Four collection worlds; worlds 030 and 031 held out.
Sixty dialogues of eight turns. All seats on `codex.gpt-5.6-luna` at low
effort. Two human seats. The 4860-reservation ceiling, fail before call.
No resampling, no top-up, indeterminate means stop. Fresh master seed
2026090301.

## Call authority

This design grants no calls. Launch needs this file merged to `main` and
one GO note under `docs/paid-study-authorization-policy.md`. The GO covers
the study as registered: question, population, worlds, strata, assignment,
measurement rules, ceiling. It stays valid while those stay the same. The
ledger records the launch commit and whether the tree was dirty; nothing
refuses to run on them, and a code-defect fix after GO does not void the GO.

## What must be built first

Six pieces of code and one document, each with a zero-call regression
test on the sealed v1 and v2 traces:

- key builder (world file plus released state to key and foil, leak-guarded);
- tutor hand-back contract with a deterministic delivery token check;
- pick reader;
- record-citation observable from the learner DAG state;
- per-family checklists rendered into the packet;
- a loader and launcher that accept revision 3 (the v2 loader pins
  revision 2 and the v2 study id);
- codebook v3, written from the design's outcome rules and checklists,
  adding no outcome rule of its own.

## What it cannot show

A correct pick shows that the learner named the token the frontier needs.
It does not show learning, durable change, transfer, family superiority
beyond the realized exact set, memory-controller benefit, or anything about
human learners or the held-out worlds. Pass licenses only a new design for
a separately authorized controller study.

## Open risks

- The exact three-family set may be rare outside stalled turns. If the
  unmatched-stratum floors fail, the design closes on that fact and reports
  the realized eligible-set distribution. The set is not widened after
  outcomes are visible.
- The key builder must find a released foil at every admitted turn. Early
  turns may have too few released tokens; such turns are audit-only.

## Provenance of this note

Written from the private v2 run data
(`artifacts/tutor-stub-live/action-outcome-model-judge-shadow-v2-2026-09-03/`)
and the sealed v2 collection design. No case text is quoted here. Private
backup of all local v1, v2, and ledger artifacts: archive repo branch
`backup/local-main-2026-09-03`.
