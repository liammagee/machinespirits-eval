# Arc summary: the normative/descriptive line — warrant mechanism, two learners done, two designed

Written 2026-08-17. Status: summary note, no new claims. Every number
here traces to a relay note, a ruling, or a score file named below.
Workplan item: guarded-learner-outcome-study.

## 1. The frame

The line studies one idea: a tutoring dialogue has a **normative
trajectory** (what the lesson expects and licenses) and a
**descriptive trajectory** (what the interaction actually produced).
Adaptation is the management of the divergence between them. The
**warrant gate** is the mechanism: it watches the descriptive side,
and when the divergence crosses a declared basis it *licenses* a
stance change — a challenge, an accountable answer — that the tutor
would not otherwise take. Design doc:
`normative-adaptive-dialogue-architecture.md`.

Two rules shaped everything after:
- **Defensibility**: a gate only reads slots a reader can defend from
  the transcript alone; engineering slots stay report-only.
- **No paid call without a sealed registration, a GO note, and
  explicit human approval.** No approval carries forward.

## 2. The warrant mechanism

The gate runs on typed events from frozen semantic readers, mapped
unconditionally to signals (event → signal, never conditioned on
same-turn stance). The learner-side persona contracts (schema v4,
`scripts/tutor-stub-learner-profile-contracts.js`) hold each resistant
profile in shape: voice signature, stance ranges, separation gates
against the nearest neighbor. Contract v3.3 added the second warrant
basis (deference as its own basis) after the human ruling of
2026-08-15. The instrument set is hash-frozen; the parked checkout
(`../ms-guarded-readers-pinned`) is the only place readers launch.

## 3. Passive learner — COMPLETE (paper §6.25)

Profile `low_agency`: asks permission for everything. Pilot (18
dialogues, presence readers demoted to report-only at the pilot gate),
main block (72 dialogues, 576 cases), steering decomposition (48
dialogues). Headline: the gated tutor broke sustained deference in
**19/24** dialogues against **10/24** bare; decision correctness
**87.5% vs 64.8%**. Archived (three tarballs in the private repo);
folded into the paper on the fold branch.

## 4. Overconfident learner — conduct closed, P3 closed late

Profile `overconfident`: over-claims, concedes only against
counter-evidence. Pilot plus main block
(`guarded-learner-main-block-2026-08-15`, 72 dialogues, 575 cases
under rulings 001/002).

- **Conduct cell (relay 121)**: the free event split was flat on the
  two voice-carried behaviors — the persona contract pins them. A
  sealed re-analysis on state the contract does not pin found the
  effect: warranted-shift rate **gated 40.8% vs standing 31.2% vs
  bare 17.8%**.
- **P3, the registered primary** (relay 117: evidence-move rate after
  delivered challenges vs shadow moments): first found unmeasured
  (relay 122, defect row 27); a decision-tag re-base (relay 123) came
  out flat and saturated, so it could not answer; a late presence
  read (relays 124–126, 520 + 6 calls, sealed "1 yes, 2 windows
  only") answered it: **delivered 7/66 (0.106) vs shadow 13/152
  (0.086), direction holds — P3 closed in the positive** under the
  mandatory label *late-scored registered endpoint, disclosed
  instrument amendment*, with rulings 003/004 and the two assembly
  amendments disclosed beside every use (result section of relay
  note 124). The effect is small.

## 5. Lessons the next registrations inherit

1. **Pick conduct channels that fit the resistance shape, before the
   pilot.** The passive presence channel died at pilot (one value on
   >90% of cases); the overconfident block had no reader-checked
   conduct channel at all and paid for it with three relay notes.
2. **Declare a variance gate per channel**; a channel the profile
   rarely uses is a dead channel.
3. **Answer in writing before sealing: if the mechanism works on this
   learner, which registered number moves?** Not at floor, not at
   ceiling, not pinned by the persona's own voice rules.
4. **Measure conduct on state the persona contract does not pin**
   (the relay 121 lesson).
5. **A fail-closed probe must throw when a promised check cannot
   load** (the ruling-003 miscount came from a silent fallback).

## 6. Two more difficult learners — designed, not registered

Design notes: `new-learner-profiles-bored-defiant.md` (process, both
profiles) and `2026-08-13_guarded-bad-learner-draft.md` (the guarded
defensive-pole pattern the overconfident learner proved out).

- **Bored**: withholds effort ("sure, whatever") — high compliance,
  low investment, no permission-seeking. Nearest neighbor: passive;
  the separation gate matters most. Risks: too few commitments per
  dialogue (the decision channel starves — needs a floor on scoreable
  cases), and deference measures dead by construction. Channels that
  fit: reply effort over turns, thread pickup, unprompted
  contributions.
- **Defiant on principle**: disputes the tutor's standing to set the
  frame, not the evidence — jurisdiction, not proof. Nearest
  neighbors: the two skeptics. Risks: warrant cases may be rare;
  challenge may escalate rather than repair (worth measuring, not
  avoiding). Channels that fit: first on-merits engagement with a
  test, concession events, premise-dispute rate.

Process per profile (free through step 5): contract → discrimination
check → name registration → public-turn rules → mock smoke → sealed
registration (channels + variance gates + the §5.3 question answered
in writing) → GO note + approval → 18-dialogue pilot → main block.
Cost shape at main-block scale: about 1,850 generation and 1,150
reader calls per profile; pilot about a quarter of that.

## 7. Standing constraints

Never push this branch. nemotron/kimi never defaults. The 18 pilot
dialogues never pool into main-block tables. Frozen files are
imported, never edited; stored artifacts are read, never edited.
