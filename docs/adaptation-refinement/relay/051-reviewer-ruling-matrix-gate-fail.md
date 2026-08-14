# 051 — Reviewer ruling: report 050 accepted; matrix gate **FAIL**; arc stops for human review

**Date:** 12 August 2026, ~23:40
**Authority:** direction 049 ("the reviewer rules on the matrix gate
from report 050"); ruling 004's stop rule; STATE discipline point 2
(the disagreement discriminator). No new lease — the arc stops here
for the human.

## Ruling on report 050

**ACCEPTED.** All checks pass:

- A1 conforming: gate repair at `4c33e6df`, reader digest re-pinned
  `7b084d93…` → `6cb95fd8032f4c43c9fdc1e45808680365d5a0d3eb2dda5ef085e4d97e10145f`
  at the recorded projection; all seven letters PASS; six guards
  committed; 71/71 focused tests; 42/42 preflight. The second session
  independently confirmed the commit 6/6.
- Quarantine verified as a move: all four r47 response hashes match
  report 048; nothing from r47 was pooled; the 5 attempts stay
  counted.
- 186 planned calls recorded in the manifest before any call.
- Budget arithmetic correct: 3,151 + 186 = **3,337/8,000**; 4,663
  remain; seed 515 unspent.
- Drop log identity-exact against reports 046/048; the 93/2/3 freeze
  disclosure carried forward; both coverage rates quoted (checkpoint
  139/144 = 96.53%; final 187/192 = 97.40%).
- The stop on the two assembly failures was correct under 049's
  stop-and-report rule.

## Classification of the two assembly failures: reader error, not a defect

Both failing responses encode a `learner_wording_request` with
`target.state: none` (as the frozen contract orders) while selecting
a catalogue action object that carries a registered target
(`moth_service_panel_access`; `jukebox`). Reviewer verification,
zero-call:

- Each case catalogue holds EIGHT `explain_wording` action objects.
  Exactly one (`natural-act-992d9cd559f56f8b`) has a null registered
  target. That entry is the lawful encoding: the wording-request
  contract is target `none` + action `catalog` (mode requested,
  operation explain_wording), and the validator accepts a catalogue
  action with a null target binding against a no-target event.
- The handbook's worked example for the wording request demonstrates
  that entry: worked examples are built at preparation by a function
  that fails closed when no compatible entry exists, and preparation
  passed 42/42.
- Both readers instead chose the entry bound to the TOPIC the learner
  was asking about. That violates two written rules (the contract's
  no-target order and the target/action-object match rule).

Under the registered discriminator (STATE discipline point 2):
violates a written rule = **reader error = data**. Ruling 004's stop
rule then applies directly: "A support failure driven by reader
misses is a finding about the reader model and is handled in scoring
and thresholds, not by reopening the contract." So: no defect-ledger
entry, no instrument surgery, no amendment. The second session's
instrument-contradiction hypothesis was checked and does not hold —
its proposed alternative encoding (action state `none`) is itself
forbidden by the frozen contract, and the lawful entry exists in
every catalogue.

## Matrix gate ruling: FAIL

The reviewer scored the 186 completed responses zero-call (pure file
comparison, no model calls). The second session computed the same
figures fully independently; every number below matches across the
two computations.

| Registered check | Result | Floor/bar |
|---|---:|---:|
| Hard-consensus non-ambiguous cases | **24/93** | at least 72 |
| Raw reader agreement | **0.258** | at least 0.80 |
| Consensus result requests | **3** | at least 4 |
| Consensus proposed tests | **1** | at least 4 |

Robustness: under deliberately generous weakenings of the identity
comparison the count is still below the floor — speech act + target
only: 41/93; speech acts only (every target, action, and value slot
ignored): 58/93. Ambiguity flags agree on 93/93 and event counts on
79/93, so the disagreement sits in the semantic slots themselves
(the second session's diff profile: targets differ on 54 cases,
actions on 29, speech acts on 28, event counts on 14).

Every completion path fails: treating the two reader-error responses
as data lowers consensus further; treating them as blocking means no
93-case set assembles. With gold support at 3 + 1 the
request/proposal cells are `inconclusive_support`, which the
registered gate text says "is not passage." **The matrix gate FAILS.**

## What the FAIL means

This is the registered natural-performance verdict: on the frozen
93-case corpus at the one-case partition, two independent
codex/gpt-5.6-luna readers do not naturally converge on the frozen
semantic encoding. Per ruling 004 this is a finding about the reader
model, not a contract defect. The instrument itself ran clean
end-to-end after the transport (defect #15) and provenance
(defect #16) repairs: 186/186 calls, zero runner failures, zero
prohibited-tool events, all responses admissible under the
provenance gate.

## Arc state and the human's decision

Per the standing watch rule, a FAIL stops the arc for human review.
Options at the human level:

1. **Accept the FAIL and cut the semantic-reader natural-performance
   layer** from the outcome study; the outcome study proceeds on the
   layers that passed their gates (fresh registration for the changed
   scope).
2. **Change the reader stack** (a stronger reader model) under a
   fresh registration and re-run the 186 calls. Reviewer lean:
   unpromising as a sole fix — the gap is 24 vs 72, the diffs sit in
   target/action slot choices, and even the speech-act-only reading
   (58) misses the floor, so the encoding task looks underdetermined
   for one-shot natural performance regardless of reader strength.
3. **Revise the encoding contract or thresholds prospectively** under
   a fresh registration (real instrument redesign, not a repair).
4. **End the arc here** and write the FAIL up as the result.

No further model calls are authorized until the human rules. Budget
**3,337/8,000**. Lease L retired with report 050 (commit `2174c0c6`);
no driver is running. Never push.
