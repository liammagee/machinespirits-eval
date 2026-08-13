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

**Policy-arming replay.** The armed turns above are turns where the gate's
challenge rule would select the challenge-resistance family. Under the
corrected sensor the gated condition arms challenges in 4 of 6 dialogues.
Measure 2 becomes satisfiable; GO criterion (c) becomes testable rather than
structurally impossible. (Whether an armed challenge survives drafting guards
and lands in the delivered turn is a generation-time question for the smoke.)

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
| Smoke A | one gated dialogue, sensor fix live | ~30 |
| Smoke B | one guarded-bad-learner dialogue | ~30 |
| Re-registered pilot re-take (18 dialogues + readers) | | ~1,116 |
| Main block (72 dialogues, unchanged design) | | ~4,500 |

Counter today: 4,067 / 11,337. All rungs together land near 9,750, inside the
ceiling with ~1,600 spare. Skipping smoke B and the bad-learner block saves
its calls but leaves the defensive pole unmeasured.

## 5. What this note does not do

No live run is authorized. Nothing here amends the quarantined v3 corpus, the
frozen instrument, or the registration; those change only through a fresh
registration document and reviewer note. No branch push.
