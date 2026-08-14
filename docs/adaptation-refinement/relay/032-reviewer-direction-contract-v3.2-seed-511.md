# 032 — Direction: human grants further authority. Defect #6 (sentinel encodability), contract v3.2, fresh seeds 511–514.

**Date:** 12 August 2026
**Authority:** human ruling in chat, 12 Aug ~17:45 — "I grant further
authority… Make the fix to the amendment, then go again." The human
also directed continuity: do not stop on the next near miss without a
written ruling; keep the watch loop alive.

## The finding (reviewer-verified, zero calls)

Seed 510's halt was caused by a defect the v3.1 amendment itself
introduced — DEFECT-LEDGER entry #6, the same class as entry #2 (the
correct model reply can never pass):

- The prose the model reads says: a request act with no named
  catalogue item uses the literal `unspecified` sentinel for both IDs.
- The validator adds two unwritten conditions: the act must be in the
  request list AND both its slots must be catalogue-typed
  (`services/adaptiveWarrantSemanticEvents.js`, the
  `permitsUnspecified` clause).
- Two acts therefore have NO valid encoding when the learner names no
  catalogue item: the wording request (in the request list, target
  typed `none`, action ID required — sentinel forbidden, empty
  invalid) and the proposed test (both slots catalogue-typed, but not
  in the request list).

Reviewer tally of the seed-510 traces: 27 unanalyzed turns; 21 carry
the sentinel issue; the acts under them are 13 wording requests, 7
proposed tests, 2 analytic contributions, 1 criterion question. The
answer-seeking learner alone lost 13 turns to its signature move
("What exactly should I write next…?"). This is a harness defect, not
model failure; the ledger policy carries such fixes into the next
seed with a guard test.

## Contract v3.2 (pre-declared values)

1. **Validator — slot-local sentinel rule.** The sentinel
   `unspecified` is VALID in any ID slot whose contract expects a
   catalogue ID (`target_id` where the target contract is `catalog`;
   `action_object_id` where the action contract is `catalog`), on ANY
   act, when the words name no catalogue item. Each slot is judged on
   its own contract; the both-slots pairing rule is REMOVED. The
   request-list membership condition on the sentinel is REMOVED.
2. **Normalization, never fatal.** A sentinel appearing in a slot
   whose contract is `none` (or on an act that forbids that slot) is
   stripped and the event is read on the `state: none` branch. It is
   recorded as a normalization note, not a validity issue.
3. **Unchanged:** empty-string IDs stay invalid everywhere; a
   sentinel target still cannot carry public identifier IDs;
   literal-span, public-identifier, atomicity, and every other strict
   rule stay in force. Downstream, a sentinel slot reads as a generic
   act that names no catalogue item.
4. **Prose.** Replace the sentinel sentence in the handbook and
   annotation descriptions with: "When a slot expects a catalogue ID
   and the words name no catalogue item, write the literal
   `unspecified` in that slot. Where no target applies, use the
   `state: none` branch." Nothing else in the prompt changes.

## Guard tests (ledger entry #6)

1. **Encodability closure:** for EVERY speech act in the taxonomy,
   construct a no-catalogue-item turn and assert at least one valid
   encoding exists under the validator.
2. **Prose/validator agreement:** the generated handbook's sentinel
   sentence must state exactly the rule the validator enforces
   (string-level assertion on the generated text).
3. **Normalization:** sentinel in a none-typed slot is stripped and
   the event survives; sentinel in a catalogue-typed slot with no
   named item is valid; empty string still fails.

## Seeds and licensing

- Seeds 503–510 and every corpus and probe from them stay burned and
  unscored. **Seed 511 is the fresh primary; 512–514 are reserves**
  under note 023's ≤15%-predicted-discard relaunch rule.
- Licensing order (steps 1–3 zero-call): (1) v3.2 focused tests plus
  the three guard tests above; (2) zero-call replay of the seed-510
  returned analyses under v3.2 — must predict ≤15% (the reviewer's
  tally predicts about 6/168 = 3.6%); (3) instrument-ready preflight
  and probe/live byte parity; (4) launch the seed-511 matrix.
- The coverage ceiling (15%, 10-turn floor) and checkpoint semantics
  are UNCHANGED. Budget: 1,673/4,000 spent; a matrix costs ~600.

## Disclosure

v3.2 is the second openly disclosed post-hoc amendment (after v3.1).
Any report or paper section using seed-511+ data must carry the full
amendment history: v3.0 → v3.1 (two rules, direction 030) → v3.2
(defect #6 repair, this direction).

## If seed 511 coverage-halts

Report and STOP for the reviewer's ruling. The reviewer may spend
seeds 512–514 only if a zero-call replay under an already-committed
harness repair (defect-ledger class) predicts ≤15%; any halt whose
losses are NOT dominated by a nameable harness defect is a human hard
stop. Quote the checkpoint rate AND the final descriptive rate in
every halt report.
