---
id: misconception-world-outcome-gate
title: Misconception world — can any tutor close against a structured wrong theory?
status: active
type: experiment
priority: P2
owner: claude
source: manual
created: 2026-07-30
updated: 2026-07-30
verification: "`node scripts/run-contract-outcome-pilot.js --dry-run --worlds world_032_alder_row --n 5` plans five dialogues at the world's own cap 40 / floor 24; the world passes the authoring-quality, presentation, and release-pacing gates in the test suite."
claim_status: scope-bound
links:
  notes: []
tags:
  - tutor-stub
  - drama-derivation
  - outcome-channel
---

The month's synthesis left one untested reading: every corpus learner is a
compliant answer-seeker, so the default frontier tutor's teaching manner is
never stressed — the confusion trigger fires on zero recorded turns, the
stall classifier found nothing in 2,718 moments, and the learner-population
line closed for no yield. If the corpus contains no adaptation problem, null
results about adaptation machinery say nothing about adaptation.

`world_032_alder_row` (The Split Tanks of Alder Row) is built to contain one.
The learner holds a structured wrong *theory*, not a wrong candidate: the
society's record-keeper opposed buying the transfer pump, and the tanks began
splitting the week it arrived. One install changed two things at once — the
pump arrived AND the overflow valve was re-set, so the line now stands
brim-full overnight — which gives every truth-supporting fact a pump
re-reading. The real mechanism is full-tank freezing (valve + nightly refill
+ held frost + waterline split pattern, an AND-chain of depth 3). The breaker
ledger is the falsifier the theory cannot absorb: the pump logged zero
run-hours through the coldest week and three tanks split anyway. Closure by
the engine's strict reader (learner proof-DAG grounded and asserted) should
require the tutor to engage the theory — name the confound, land the
falsifier, rebuild the mechanism — not merely recite facts. Scored on the
outcome channel, judge-free.

Design guards: the falsifier is `evidence_role: corroboration` (off the
proof path by design); the last path premise lands at turn 24 = t_min, so
the anti-reveal gate holds; cap 40; contemporary domestic register with no
content-filter bait (the greyfen lesson).

Protocol, mirroring the contract-outcome pilot's gate: bare tutor first,
k = 5, world's own cap. If bare closes ≥ 4 of 5, the world failed its design
goal (not stressful enough) and gets revised before any arm comparison; if
bare lands 0–3, the world is in the band and instrumented arms compete on
it. Runs under `exports/tutor-stub-outcome/misconception-gate-*` via
`scripts/run-contract-outcome-pilot.js --worlds world_032_alder_row`.

Standing limits: simulated learner (the defense is authored in the world's
own voice and motivation, learner profile unchanged), one speaking family,
outcome channel only, no human-learning claim.

## Amendment, 2026-07-30 — the defense never ran

Recorded mid-run at 2 of 5 closed, on grounds readable in the trace and
independent of the tally. The bracketed limit above ("learner profile
unchanged") was wrong: it assumed the world's authored voice would govern the
learner. It does not. The learner receives two instruction sets, and the
world's loses:

- system, marked authoritative ("Apply this behavior brief to every public
  learner turn"): the stock `diligent` brief — *accept the correction and try
  the narrower warranted claim; revise explicitly when the evidence warrants*;
- user prompt, under `# Public scene`: one line of the world's `learner_voice`.

So the record-keeper conceded at turn 2 of d0 and the run measures a compliant
learner in a confounded world. The `motivation.learner` block (mirror pull
high, overreach high) reaches nothing at all here: it is read only behind
`--character-arc`, wired through `scripts/run-derivation-loop.js` and absent
from the tutor-stub path this pilot drives.

The original ≥4-of-5 rule cannot be applied: its antecedent (a learner who
defends the theory) was never satisfied, so a high tally says nothing about
whether the world is stressful. Revised protocol:

1. **misconception-gate-1 is re-read as the derivability control**, not the
   stress gate. A high close rate here is the wanted result — it shows the
   confound structure and the AND-chain are solvable, ruling out a broken
   world as the explanation for any later 0-of-5.
2. **The stress gate is re-run with `--learner-profile contradiction_keeper`**
   (`exports/tutor-stub-outcome/misconception-gate-2`), whose brief matches
   the authored voice: *restate the original claim after contrary evidence and
   reframe the mismatch as an exception*. No code change — the flag already
   threads through.
3. **Verdict rule, unchanged in form, now on gate-2**: bare closes ≥ 4 of 5 →
   the world is not stressful enough and gets revised; 0–3 → in the band, and
   instrumented versions compete on it.

One design tension to hold open rather than hide: `contradiction_keeper` also
carries *resists resolving the case* / *do not jump to the final secret*, so a
0-of-5 on gate-2 will be ambiguous between "the defense worked" and "this
learner never closes anything." Gate-1's control tally does not settle that —
it clears the world, not the profile. The profile's own closure rate on an
already-cleared unconfounded world (world_030) is the reading that would, and
is the next thing to run if gate-2 lands at 0.

## Verdicts, 2026-07-30

**Gate-1 (derivability control, stock learner): 5 of 5 closed**, turns
24/25/25/25/25 against a floor of 24 — every dialogue closed the first or
second turn closure was legally possible. Full path coverage, zero missing
premises, all grounded. The world's confound and depth-3 AND-chain are
solvable; a later 0-of-5 cannot be blamed on a broken world. Closure pinned
to the floor also says the compliant learner added no friction: the dialogue
is paced by the clue release schedule alone.

**Gate-2 (stress gate, resisting learner): 5 of 5 closed**, turns
26/26/22/25/25. The defense ran this time — the learner held the pump theory,
retreated to an unauthored fallback (the pump *weakened* the near tanks;
show me cracks at the mounts), kept a residue after closing ("still looks
like a troubling coincidence"). It bought about two turns. The reason it
bought no more is readable in the transcripts: the turn-24 premise both
completes the proof and answers the mount objection in so many words, so the
tutor dispensed the refutation on schedule instead of arguing for it.

**Rule applied: ≥4 of 5 → world-032 is not stressful enough for the version
comparison.** The registered response is `world_033_alder_row_redoubt`
(committed e0f35cab): a minimal pair differing only in that no released
surface ever answers the mount objection, so dismantling the fallback is the
tutor's work. Gate-3 runs the identical protocol on 033. A separate
derivability control on 033 is unnecessary — the logic, schedule, and DAG are
byte-identical to 032's; only one premise's surface prose changed.

Apparatus note from gate-2 d2 (closed at turn 22, below the floor): `t_min`
binds the *authored* schedule — the anti-reveal check walks the YAML — but
the live pacing engine may release ahead of it (a learner-analysis signal at
t21 raised speed to 1.49 and pulled the last clue two turns early). Floor
readings need the release trace, not the world file.
