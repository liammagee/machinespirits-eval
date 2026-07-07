# The unreliable learner: harness-implemented decay + the fast-iteration kit

**Date:** 2026-06-10 · **Status:** built + mock-tested; NO paid arms sanctioned — §3 is the
pre-registration draft for whenever they are
**Mandate (operator):** "let's proceed. can you itemize for me first how to operationalize the
speed-ups, and do the two builds you suggest. give me the PR url so I can review. then proceed
with any instrumentation of this new concept. Document it all in a note, including your earlier
suggestions, which we may need to review later." Earlier in the same exchange: the unreliable-
learner idea itself, the correction that unreliability must be implemented in the harness rather
than asked of the model, and "can we first find a method for very fast iterations - like 'change
this one condition and re-run' - so we are not waiting hours for negatives?"

Predecessors: `2026-06-09-derivation-phase1-first-loop.md` (stage + checker),
`2026-06-10-superego-internal-figure-mechanism.md` (charter v2),
`2026-06-10-stall-watcher-quasi-logical-tom.md` (charter v3; §6.13 of the paper).
Code: `services/dramaticDerivation/{corruption,replay,engine}.js`,
`scripts/run-derivation-{episode,matrix,loop}.js`,
tests `tests/dramaticDerivation{Corruption,Replay}.test.js`.

---

## 1. The concept

The derivation learner has so far been reliable: whatever is staged and adopted stays on its
board until the drama ends. Under that assumption the only failure modes are staging failures
(evidence released off-cue) and inference failures (the learner never connects what it holds).
Real learners have a third: they lose hold of things they once had. The unreliable-learner
condition gives the harness a way to take premises *back off* the learner's grounded board on a
seeded stochastic schedule, so that the drama can move backward — D(t) can rise — and holding
the proof together becomes part of the tutor's work.

**The design rule (operator correction, in force):** unreliability is harness-implemented,
seeded, and parametric — never prompt-roleplayed. Asking an LLM to *play* forgetful measures its
theatre of forgetfulness, the same costume problem the Phase-2 transfer failure exposed from the
critic's side. Here the harness owns the ground truth of what is forgotten and simply shows the
learner a degraded board; the model then behaves under that board. Forgetting is a fact about
the run, not a performance by the model.

## 2. Why this is principled, not just another knob

1. **Population-valid failure modes.** Slipping, partial recall, and needing re-staging are what
   actual learners do; a tutoring instrument that has never been pointed at them has only been
   validated on an idealization.
2. **Structural manifest≠latent with harness-owned ground truth.** The Adaptation-Plan-2.0 motif
   was that the unread signal is the gap between what the learner shows and what it holds. Decay
   makes that gap structural: the learner *cannot* self-report what it forgot, because it does
   not know — the omission is visible only against the harness ledger. No second model's hidden
   deliberation is needed as ground truth; the harness is the ground truth.
3. **It un-fixes the destination.** Until now the formal channel guaranteed the same endpoint
   under any dressing (the invariance that made the figure experiments clean). Under decay,
   whether the drama completes at all becomes a dependent variable: completion now hangs on
   repair work actually happening. The bar becomes the measurement.
4. **It defines the missing baselines.** Floor = a no-tutor arm under decay (releases posted on
   schedule, nobody repairs). Ceiling = the no-decay ideal run. Tutoring effect = recovery: how
   much of the floor-to-ceiling gap the tutor's repair work closes. This answers the standing
   question of what learner baselines the instrument should be tested against.

## 3. The implemented decay model (pre-registration draft)

Everything in this section is built and pinned by tests; freeze these parameters plus seeds in
the arm spec before any paid arm runs.

- **Condition surface.** `--decay '<json>'` on `derivation:loop` (and inherited/overridable on
  episodes, composable in matrix arms). Keys `{seed, rate, graceTurns, maxConcurrent,
  startTurn}`, defaults `{1, 0.15, 2, 2, 1}` (`corruption.js`). Run-level condition; worlds stay
  frozen; unknown keys and out-of-range values are CLI errors before any turn runs.
- **Mark, never delete.** A decayed entry stays on the engine's board with `decayed: true`; the
  single choke point `validGroundedFacts()` filters it out of D(t), forcing, the inference
  frontier, and the learner view alike. Nothing else in the engine changed meaning.
- **Eligibility.** A premise can slip only if it is currently valid, not already slipped,
  *released* (background facts are immune — released premises are the experimental material),
  past its grace window (`graceTurns` since grounding or re-grounding), and the turn has reached
  `startTurn`.
- **The draw.** End of each turn, after the learner has acted (skipped once the drama has
  ended): one mulberry32 draw per eligible entry, in board insertion order. The draw count never
  depends on earlier hits, so the corruption schedule is a pure function of (seed, role
  outputs); `maxConcurrent` then caps how many hits land. Identical seed + identical role
  outputs → identical corruption ledger (tested).
- **Repair channels.** (1) Tutor: any move whose `targetPremise` names a slipped premise
  restores it before the learner speaks that turn — including *incidental* consolidation moves
  that happen to target it, which is a designed property: re-staging the exhibit is the repair,
  whatever the tutor's intent label says. (2) Learner: re-adopting a slipped fact restores it.
  Both are ledgered with their channel.
- **Learner view.** Decayed facts vanish from `abox.grounded` AND from
  `releasedFacts`/`releasedThisTurn` — were they still listed as released, re-hearing would be
  free and decay a no-op. The transcript prose remains in the learner's context, so re-deriving
  a slipped fact from staged dialogue is a legitimate, measured recovery path, not a leak.
- **v1 visibility (built).** Director/tutor/superego views carry the ground truth:
  `corruption: {decayed: [{premiseId, fact, sinceTurn}], ledger}`, and the live tutor prompt
  gains a SLIPPED FROM THE BOARD block naming the slipped exhibits and the repair affordance.
  v1 therefore measures *repair given knowledge of the slip*.
- **Instrumentation.** `diagnosis.corruption` = `{config, decayEvents, repairs{total, byTutor,
  byReadoption}, meanRepairLatency, unrepairedAtEnd, degradedTurnIntegral (turns × premises
  spent degraded), dReversals (turns where D rose), timeline (decay→repair pairs)}`. The loop
  header, per-turn shell line (`☄ p1 fades` / `✚ p1 restored`), instrument panel, and matrix
  table (`decay d/r/u` column) all read from it.
- **Off-state invariance.** No `--decay` → no corruption key anywhere in result or diagnosis and
  the canonical happy path is byte-identical to the pre-condition engine (tested, plus the whole
  pre-existing suite passes unchanged).

Pinned mock results worth keeping in mind: under aggressive decay (rate 1, grace 0,
maxConcurrent 1) a learner that re-adopts what it lost reaches the same grounded anagnorisis on
the same turn as the happy path, with the D-curve never visibly reversing because repairs land
within-turn; the *same* schedule with no repair channel ends in disengagement with p1 dead from
turn 4. Repair is load-bearing, and the instrument sees exactly where.

## 4. Cautions (binding on the eventual experiment)

1. **Pre-register before arms.** The decay model above, parameter values, and seeds go in the
   arm spec first; no tuning after results start arriving.
2. **Decay-only first.** Do not stack decay with other condition changes in the first paid
   contrast; one new mechanism per experiment.
3. **Repairability guard.** Configurations must leave every slipped premise repairable (release
   schedule + both repair channels guarantee a path back). A run where decay can strand S
   underivable for the remainder measures luck, not tutoring.
4. **v1/v2 split.** v1 (built) tells the tutor what slipped; the open question it answers is
   whether the tutor *uses* the repair affordance and how completion responds. v2 (design-only:
   gate the corruption block off the omniscient views) makes the tutor infer the slip from
   learner behavior — detection + repair. Run v1 before v2; v2 is meaningless until v1 shows
   repair-given-knowledge works. A charter-v4 superego jurisdiction (watcher fires on unrepaired
   slips, mirroring the stall watcher's arithmetic) is likewise design-only until v1 results
   exist.
5. **Termination discipline.** If the calibrated floor barely fails under decay — if tutored and
   untutored runs both complete, or both fail, at the pre-registered parameters — that is the
   result. Do not ratchet decay until something breaks; the temptation to tune the condition
   until it produces an effect is exactly the closed-loop tell the eval rails exist to catch.

## 5. The speed-up ladder, operationalized

The standing complaint: a full real-cast drama is ~25 minutes, so one changed condition costs
half an hour and a negative costs an afternoon. The ladder, from cheapest to most structural:

- **(a) Mock tier for all mechanics.** The deterministic cast runs a full drama in under a
  second; every corruption mechanic, repair choreography, and instrument field above was
  developed and is regression-tested without a single paid call. Anything checkable about
  *plumbing* is checked here first.
- **(b) Episode replay (Build A).** Snapshot a recorded run at turn t, change one condition,
  run 2–3 live turns, score locally. The 25-minute question "would turn 9 have gone differently
  if X?" becomes a 1–2 minute episode: the prefix replays from the recording (no calls), only
  the window is live. Prefix integrity is *verified* against the recording rather than trusted,
  and divergence is classified (expected when the decay change reaches into the prefix; invalid
  otherwise).
- **(c) Yoked replay of the non-focal side.** The same mechanism, pointed at cost: when the
  question concerns only the tutor, the director/learner lines can replay from the recording
  while only the tutor is live (and vice versa). The engine treats replayed and live roles
  identically, so this is a degenerate use of `makeReplayRoles` — supported, not yet wrapped in
  its own flag.
- **(d) Cheap parallel screening, serialized contrasts.** Calibration sweeps (which rate/grace
  values are even interesting) run on metered models in parallel via the matrix runner. This
  REVERSES for Max-plan contrast arms: arms sharing a plan-quota window that feed a between-arm
  comparison run serialized and attended (the runner defaults real specs to concurrency 1 and
  warns if forced higher).
- **(e) Critic off during iteration.** `--critic off` while iterating (the matrix injects it by
  default); backfill notices for keepers with `derivation:critic --label <run>`. Early-exit
  sentinels — the engine already stops on terminal events; episode windows add `maxTurns` so an
  exploratory window never runs to the cap.
- **(f) Seeded determinism → matched pairs (the biggest one).** Because the corruption schedule
  is a pure function of (seed, role outputs), ON/OFF arms share the same decay schedule wherever
  their role outputs agree, and episode pairs split from the same prefix differ in *exactly* the
  injected condition. Matched pairs answer with n=1 what unpaired arms need replicates for —
  fewer paid runs for the same inferential weight.

## 6. Build A: episode replay

`services/dramaticDerivation/replay.js` + `scripts/run-derivation-episode.js`
(`npm run derivation:episode`).

```
node scripts/run-derivation-episode.js \
  --from <label|dir|result.json>   # source recording (loop or episode dirs resolve by label)
  --turn N                         # first LIVE turn; turns < N replay from the recording
  [--window K]                     # live turns to play (default 3) — engine maxTurns
  [--decay '<json>'|off]           # condition change; default: inherited from source
  [--superego on|off] [--stall-watch on|off] [--script ...] [--recognition N] ...
  [--real]                         # mode NEVER inherits: mock unless explicitly --real
```

Conditions inherit from the source run's `diagnosis.json`; only named flags override; the world
is never overridable (hard error — a different world is a different drama, not an episode).
Artifacts are loop-shaped (`diagnosis.json` + `result.json` + `transcript.md`) plus
`episode.json` recording source, window, overrides, prefix-integrity verdict, and
window-exhausted flag — episodes chain as `--from` sources for further episodes. The smoke pair
that proves the point: the recorded decay run disengages at t7; the same prefix with `--decay
off` completes at t8. One condition, one minute, a causal read.

## 7. Build B: matrix runner

`scripts/run-derivation-matrix.js` (`npm run derivation:matrix`), spec in YAML/JSON:

```yaml
base:
  world: config/drama-derivation/world-000-smoke.yaml
  script: config/drama-derivation/tutor-scripts/nocturne-v001.md
  # mode: real          # uncomment for paid arms — serializes by default
  flags: { superego: true }
arms:
  - label: control
  - label: decayed
    flags: { decay: '{"seed":7,"rate":0.15}' }
```

Each arm is a fresh child process of `run-derivation-loop.js` (the contract is the CLI surface
in, `diagnosis.json` out — no shared state to leak between arms). Mock specs run up to 4 arms
concurrently; any real arm defaults the pool to 1 with a warning if forced higher (plan-quota
discipline, memory `feedback_parallel_adaptive_pilots`). `critic: off` is injected unless an arm
asks otherwise. Output: per-arm artifact dirs, `logs/<arm>.log`, `matrix-summary.json`, and a
comparison table over the structured diagnosis fields (verdict, forced@, grounded@, releases,
slope, figure concentration, superego fires, `decay d/r/u`, calls, cost).

## 8. Earlier suggestions parked for later review

Recorded here verbatim-in-substance because the mandate asks for them; none are sanctioned work.

**Measurement-first baseline paths** (from the "how else might we register learner baselines"
exchange — alternatives or complements to the decay condition):

1. **No-tutor / bulletin-board arm.** Releases posted on schedule with no pedagogy; the learner
   reads and reasons alone. The floor the decay design now depends on (§2.4) — likely the first
   of these to actually run.
2. **Silent-derive arm.** Hand the learner all premises at once, no drama: measures raw
   inferential capability on the world's proof, separating "can't infer" from "wasn't staged."
3. **Capability-frontier battery.** A small offline battery over the rule set (which 1-step,
   2-step, 3-step inferences does the pinned learner make unaided?) to place any world's proof
   depth relative to the learner's frontier before using it in arms.
4. **Learner panel norming.** The same drama across several learner models/voices to norm how
   much of the outcome is the pinned learner rather than the staging.
5. **Degraded/adversarial-tutor ladder.** Tutors that are progressively worse (off-script,
   wrong targets, actively misleading within the anti-reveal rules) to check the instrument's
   floor sensitivity from the tutor side.
6. **Post-drama counterfactual/transfer probes.** After the curtain: near-transfer questions on
   the same rule pattern with fresh constants — does the recognition survive leaving the stage?

**Un-freezing options** (ways to give the formal channel more degrees of freedom, considered
when the worry was that the frozen channel leaves the tutor nothing consequential to do):

1. **Tutor release-selection authority** — the tutor chooses *which* premise to release within
   slope constraints, not just when to consolidate.
2. **Harder inference** — deeper proof DAGs, more distractor premises, so the learner's path is
   genuinely uncertain.
3. **Degraded channel** — releases can arrive garbled/partial; fidelity becomes tutorable.
4. **Probes off the released path** — learner questions that force the tutor off its script
   without releasing new premises.
5. **Weaker learner by prompt** — ruled out of scope then for exactly the reason that now
   defines this design: asking the model to be worse measures roleplay. The harness-implemented
   decay condition is what that option becomes once the weakness is owned by the harness.

The decay condition supersedes none of these; it is the one that got built first because it
simultaneously un-fixes the destination (§2.3) and stays inside the frozen-world discipline.
