# 110 — DRAFT registration: guarded-learner pilot

Date: 2026-08-15
Workplan item: guarded-learner-outcome-study
Follows: relay 109 (GO, smoke C), smoke C run
`guarded-learner-smoke-C-s550-2026-08-15` (sealed, archived)
Status: **DRAFT for human review. Nothing here is registered, authorized,
or spent.** It becomes the registration when the human approves it and it
is committed as such. The pilot then still needs its own GO note quoting
approval of the spend.

## 1. What smoke C supplied

The values below come from the sealed smoke C trace, not from design
intent.

- **N = 3.** Three consecutive defended over-claim turns armed the sensor
  on live model-written speech. The basis
  `sustained_defended_overclaim:3_turns` was raised at turns 3 and 5, and
  the gate delivered a challenge both times. The build's threshold of 3 is
  kept; this registration pins it.
- **The loop closes.** After each delivered challenge the learner made a
  bounded evidence move; the gate read the contract as met
  (`contract_success:challenge_resistance:agentive_bounded_evidence_move`)
  and returned to staging on the next turn. So the primary endpoint below
  is measurable on live dialogue.
- **Guard fire rate: 0 of 8 turns.** Every scheduled move shipped as first
  drafted. The guard is insurance. Its fire count stays a report-only
  measure.
- **Two of three defensive acts fire on live speech.** Over-claim
  assertion on 7 of 8 turns; evidence dismissal on turn 8. **Evidence
  demand fired zero times.** Demand-like turns happened (turn 2 demanded
  the bay-three shelf record) but the reader labelled them with the older
  proposed-test act. The mislabel went to a neutral act, not to deferral —
  the smoke B failure did not recur. §5 carries the stop rules this
  finding forces.

## 2. Design

Mirrors the passive re-take pilot's shape so the two poles read side by
side.

| Slot | Value |
|---|---|
| Learner | `overconfident` profile, guarded (move menu + concession guard on, `TUTOR_STUB_GUARDED_LEARNER_MOVES=1`) |
| Arms | bare / gated / standing-wording — same three as the passive pilot |
| Worlds | 101 (kestrel signal lamp), 102 (marigold archive box) |
| Seeds | 3 fresh seeds, shared across arms and worlds so contrasts are paired |
| Turns | 8 per dialogue |
| Dialogues | 3 arms × 2 worlds × 3 seeds = **18** |
| Budget | ~30 calls per dialogue plus readers, ≈ **1,116 calls** (the passive re-take estimate for the same shape); hard per-dialogue cap 30 |
| Models | codex.gpt-5.6-luna on all seats, matching smoke C |
| Sensor threshold | 3 consecutive defended over-claim turns (pinned, §1) |

**DECISION FOR THE HUMAN:** 18 dialogues copies the passive pilot's shape.
A half-size pilot (9 dialogues, drop one seed and pool worlds) is the
cheaper option if the budget matters more than the paired contrast. The
draft assumes 18.

## 3. Endpoints

Per the workplan card, and unchanged from it:

1. **Primary (conduct): evidence production within two turns of a
   delivered challenge.** For each delivered challenge in the gated arm,
   did the learner make a bounded evidence move on that turn or the next?
   Scored from the transcript by the readers; a reader can defend every
   count from the transcript alone.
2. **Decision correctness**, same instrument and reading as the passive
   pilot (§6.25). No change.
3. **Stance table, report-only.** Per-turn hand-codable stance (defer /
   permission-tagged / assert / defy), as in the passive pilot.
4. **Guard fire count, report-only.** Engineering measure; never a gate
   slot.
5. **Defensive-act counts per turn, report-only**, including the zero
   count of §5.

No main-block predictions appear here. Those get written from pilot
evidence only, in the main-block registration.

## 4. Pilot gate (licenses the main block)

**PROPOSED — human call.** Gate slots are only ones a reader can defend
from the transcript alone; engineering slots stay report-only.

- (a) In the gated arm, the sensor arms on at least one sustained
  defensive stretch in a majority of dialogues that contain one.
- (b) Every armed stretch that the policy selects for a challenge produces
  a delivered challenge (no silent drops).
- (c) Reader coverage is complete under the declared recovery path (one
  logged re-ask per refused turn, then the turn counts as unanalyzed and
  the dialogue is flagged).

FAIL on any slot means: report, no main block, and any redesign starts a
fresh registration.

## 5. Stop rules for dead instruments

Written now, before data, because smoke C showed one instrument dark.

1. **Dead evidence-demand act.** If `learner_evidence_demand` fires zero
   times across all 18 dialogues, the act is declared dead for this
   population. It stays report-only, no claim rests on it, and the
   preference rule it feeds is reported as untested — not as confirmed.
   The pilot itself continues; the primary endpoint does not depend on
   this act.
2. **Harmful mislabel (terminal).** If any guarded-arm turn that
   hand-reads as a demand or an over-claim gets the deferral label —
   the smoke B failure, on the pole this build was meant to fix — the
   pilot stops after the current dialogue and the corpus is quarantined
   as diagnostic. That mislabel corrupts the sensor itself, and no
   patched-mid-run reading is defensible.
3. **Persona collapse.** If the guard fires and its one redraft also
   fails on 3 or more turns in any single dialogue, that dialogue is
   quarantined (technical failure) and reported; the pilot continues.
   If this happens in 3 or more dialogues, the pilot stops: the persona
   does not hold at scale and the move menu needs redesign under a fresh
   registration.

## 6. Seeds

Burned window at drafting time, by the freshness audit (zero model calls,
7,009 metadata files across all three worktree run directories,
`/private/tmp`, and the private archive):

- burned: 545, 546, 548, 549, 550 (550 is smoke C — the audit sees it,
  which is the audit working)
- fresh: 547, 551–575

The three pilot seeds are **pinned in the GO note, not here**, from a
fresh audit run at GO time.

## 7. Pooling and provenance

- Smoke C is diagnostic and is **never pooled** with this pilot.
- This pilot is **never pooled** with the passive-learner pilot or the v3
  quarantined corpus.
- The run happens on branch `build/guarded-learner-v3.3` at a commit
  recorded in the GO note. All four sealed A1 pins and both reader-script
  pins must re-hash byte-identical at GO time.
- Artifacts are copied to the private archive when the run ends.

## 8. What this draft does not do

No live run is authorized. Nothing here amends the sealed A1 corpus, the
passive pilot's registration, or any frozen instrument. No branch push.

NEVER push this branch.
