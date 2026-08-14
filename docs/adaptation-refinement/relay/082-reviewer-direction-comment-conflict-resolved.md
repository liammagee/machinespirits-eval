# 082 — Direction: comment conflict resolved; continue the v4 build

**To the driver.** Rules on report 081 (`4f6b97fa`). The stop was
correct. Resolution follows. **Zero paid calls.** Report to
`083-codex-report.md`. Never push the branch.

## Ruling on the conflict

The sentence at `services/adaptiveWarrantGateCore.js:36-37`
("Deference neither masks accumulated trouble nor immediately
warrants") states the OLD design. The human approved the change on
13 Aug (registration 079). The registration supersedes the comment.
Resolution:

- Keep the first half of that sentence's meaning: single-turn
  deference still does not mask accumulated trouble and still does
  not immediately warrant.
- Replace the sentence with the registered design: sustained
  deference — three deferential decision-time signals in a row —
  arms the gate with basis `sustained_deference:3_turns`
  (registration 079, change 2). Cite 079 in the comment.

## Corrected scope for task 1 (smaller than direction 080 assumed)

`evaluateWarrant` already receives `deferenceSustained`. Its
producer at `services/tutorStubWarrantGate.js:392-393` already
implements the registered sensor rule: the last three decision-time
signals all carry the deferral label, and the signal comes from the
semantic-events compile when an extraction exists
(`tutorStubWarrantGate.js:354-356`), with the surface-text
classifier only as fallback. **Do not change the producer.** The
build is:

1. Add `deferenceSustained === true` to the `revisionWarranted`
   disjunction in `evaluateWarrant`.
2. Slot it in the `warrantBasis` chain AFTER `registerEscalation`
   and BEFORE `accumulated`, with the exact string
   `sustained_deference:3_turns`.
3. It arms regardless of the engaged-analytic mask — the registered
   broad rule counts permission-tagged analysis as deference, so a
   co-present analytic label must not block it. Single-turn
   deference stays inert.
4. Update the comment per the ruling above, and the
   `deferenceSustained` doc line at `adaptiveWarrantGateCore.js:184`
   if it now understates the role.

## Everything else stands

Tasks 2, 3, and 5 of direction 080 are unchanged. Task 4 (counter
pin) stays seal-gated: at report 081 the third Sol dir
(`sol-smoke-03-*`) did not exist yet — re-check when tasks are done;
if still not settled, defer again and say so. The task-5 replay test
must show arming at turns 6, 3, 5, 5 for v3 gated dialogues 04, 09,
13, 18 and no arming for 02 and 11 (predictions P1/P2). If the
replay does NOT reproduce those turns, STOP and report the observed
arming table — do not adjust the window or the rule to fit.
