# Design note: outcome-pilot re-take after verdict 074a

**Date:** 13 August 2026. **Status:** DRAFT for human review — nothing here is
registered, authorized, or spent. **Basis:** verdict 074a; zero-call replays
over the quarantined v3 corpus (diagnostic only, never pooled).

## 1. What the replays showed

**Deference-rule replay (free, stored events only).** The corrected rule reads
a turn as deferential when its stored semantic events contain any
permission-seeking act — a record-entry permission request, a "which exhibit
should I pick" request, or a "tell me the result to write" request — at any
validation status, including uncertain. Per gated dialogue, deference flags and
where the challenge trigger (three deferential turns in a row) would arm:

| Dialogue | Learner behaviour (hand-coded) | Old flags | Corrected flags | Challenge arms |
|---|---|---|---|---|
| 02 (101, s515) | broke t2, stayed assertive | none | `DD......` | never |
| 04 (102, s515) | never broke | t1 only | `D..DDD.D` | t6 |
| 09 (101, s516) | never broke | none | `DDDDDDDD` | t3–t8 |
| 11 (102, s516) | broke t3, stayed assertive | none | `D.D....D` | never |
| 13 (101, s517) | never broke | none | `D.DDDDDD` | t5–t8 |
| 18 (102, s517) | never broke | none | `D.DDDDDD` | t5–t8 |

The corrected sensor separates the four never-breakers (challenge arms in all
four) from the two self-breakers (never arms) with no overlap. That is the
discrimination the pilot needed and the old rule missed entirely (1 flagged
turn in 48).

Two load-bearing details:

- **Uncertain events must count.** 13 of 23 record-entry permission requests
  carry uncertain validation status; a rule that drops uncertain events blanks
  most of the table.
- **Permission-tagged analysis counts as deference.** A stricter variant
  (permission event with no analytic contribution in the same turn) never arms
  anywhere — these learners almost always attach analysis to their
  permission-asking. The study's difficulty axis is the permission habit, not
  absent analysis, so the broad rule is the faithful one.

**Policy-arming replay — CORRECTED after smoke A.** The first version of this
note claimed the armed turns above would select the challenge-resistance
family. That was wrong. The policy is only consulted when the gate already
warrants a revision (`revisionWarranted` in
`services/adaptiveWarrantGateCore.js`), and sustained deference is not among
the arming conditions — revision needs two trouble turns, a blocking
obligation, a contract transition, a register escalation, or inquiry
completion. In the four never-breaker dialogues the stored trouble count
never exceeds 1 and the warrant basis is `none` on every non-terminal turn,
so even with the corrected sensor no challenge would have been delivered.
Smoke A (seed 518, gated, sensor fix live, 26 calls) confirmed this:
deference now registers (3 of 8 turns), but the record kept growing, the
basis stayed `none`, and zero challenges were delivered. The sensor fix is
necessary but not enough. Whether sustained deference should itself warrant
a revision is a design change for the registration, not a bug fix (§2.5).

## 2. Changes for the re-registration

1. **Deference derivation (the sensor fix).** Deference present = any stored
   permission-seeking semantic event (record-entry request, selection request,
   directed-result request), any validation status. Applied identically in all
   three conditions at decision time and in the shadow pass.
2. **Extraction-refusal recovery (the 144th-case fix).** On an
   invalid-semantic-events refusal, one logged re-ask, capped at one per turn;
   if it fails again the turn is unanalyzed. Declared in the registration.
3. **Freeze consistency.** Pick one: exact case count with the recovery path
   above, or a declared coverage floor (e.g. ≥97%) with an adjusting count.
   Recommend the exact count + recovery, since readers score cases one at a
   time and an exact count keeps the blind-spot audit frame fixed.
4. **Decision-time signals in all conditions.** Bare and standing-permission
   turns must carry the same learner-signal block the gated turns carry, so
   the scorer never depends on a shadow stamp that can drift.
5. **Sustained deference as a warrant basis (decision needed).** Today the
   challenge family can only be delivered when deference happens to coincide
   with another revision warrant (stalled record, blocking obligation,
   escalation). These learners defer while the record grows, so the challenge
   never fires — that is why all 144 pilot turns and smoke A read zero. The
   candidate change: sustained deference (three deferential turns in a row)
   becomes its own revision warrant with its own basis string, consulted at
   the same precedence the policy comment already describes. This changes
   what the gate does, not just what it sees, so it must be registered as a
   design change with its own prediction — including the risk it makes the
   gated tutor interrupt learners who are deferring politely while making
   steady progress, which the pilot's four never-breakers all were. The
   other option is to accept that this learner population cannot produce
   challenge turns and drop criterion (c) for a re-scoped measure. Human
   call, before any re-registration is drafted.

## 3. The guarded bad learner (new condition, optional)

Purpose: the pilot's difficulty axis is low-agency passivity. The opposite
pole — over-claiming, dismissive, defensive — is untested, and an unguarded
prompt drifts back to politeness. Proposal: build the defensive learner the
same way the tutor is built — structure over disposition.

- **Typed move menu** for the learner seat: dismiss-evidence, deflect-topic,
  over-claim (assert beyond warrant), dig-in (repeat prior claim), grudging
  concession. Each turn the learner driver picks from the menu under a simple
  schedule (e.g. no concession before an evidence-grounded challenge has
  landed twice).
- **Concession guard**: a deterministic check on the learner draft; a draft
  that concedes or asks permission while the schedule forbids it is rejected
  and redrafted, mirroring the tutor's quality guard.
- **Detection labels to match**: the sensor work above fixes blindness to
  permission-asking; the defensive pole needs its own events (over-claim,
  dismissal) declared in the contract before the run, or the same
  sensor-blindness failure recurs on the other side.
- **Fidelity audit, report-only**: per-turn hand-codable stance (defer /
  permission-tagged / assert / defy) logged for the pilot table, as in this
  pilot.

Scope discipline: this is a new condition and new measures, so it belongs in
the re-registration as its own small block (one world, one seed, gated only,
~8 turns ≈ 30 calls for the smoke), not as a patch to the passive-learner
design.

## 4. Proposed spend ladder (each rung needs its own authorization)

| Rung | What | Calls |
|---|---:|---:|
| Smoke A | one gated dialogue, sensor fix live | 26 (SPENT) |
| Smoke B | one guarded-bad-learner dialogue | ~30 (running) |
| Re-registered pilot re-take (18 dialogues + readers) | | ~1,116 |
| Main block (72 dialogues, unchanged design) | | ~4,500 |

Smokes A and B were authorized 2026-08-13 ("do the two smokes"). Counter
after smoke A: 4,093 / 11,337. All rungs together land near 9,750, inside
the ceiling with ~1,600 spare.

Note for the sibling relay track: the learner-analysis coverage repair
(commit 48bf2e97, direction 075) fixes the 144th-case assembly failure and
composes cleanly with the sensor patch (adaptiveWarrant* 199/199 at HEAD).
But a v4 take under the current design still fails GO criterion (c) for the
reason in §1 above, and any GO note must re-pin the counter after the
smokes' spend. Reviewed and sent to the sibling session 2026-08-13.

## 5. What this note does not do

No live run is authorized. Nothing here amends the quarantined v3 corpus, the
frozen instrument, or the registration; those change only through a fresh
registration document and reviewer note. No branch push.
