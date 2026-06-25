# Memory Architecture

**Status (2026-06-25, branch `claude/memory`): Shape B — two pads behind a documented seam, with the rich store deliberately retained.**

This note is the durable map of how learner and tutor *memory* is captured in this
repo, why there is more than one store, and the near-term posture we have chosen.
It originates no empirical claims; the one effect it references is inherited from
`docs/research/paper-full-2.0.md` (§6.6.9).

## 1. What exists today (verified)

There are two **live** implementations of Freud's three-layer "Mystic Writing Pad"
(conscious / preconscious / unconscious), on two different run paths, plus one
**retained-but-unwired** rich store.

| Store | Lives in | Owner / run path | Status |
|---|---|---|---|
| `writingPadService` (+ `memoryDynamicsService`, migration `008_writing_pad_schema.sql`) | `tutor-core/services/` | tutor-core dialogue engine; activated by passing `learnerId` from `evaluationRunner` | **live** — in-dialogue pad on the standard eval path |
| `tutorWritingPad.js` + `learnerWritingPad.js` | `services/memory/` | `learnerTutorInteractionEngine` (per-turn writes), `idDirectorEngine`, `scripts/generate-pedagogical-dramas.js` | **live** — the bilateral-engine pads |
| `learnerMemoryService.js` | `services/memory/` | **no live consumer** (only its own tests) | **retained reserve** — see §4 |

Capture **does** fire on the bilateral path: `learnerTutorInteractionEngine`
snapshots both pads before/after an interaction, injects their narrative summaries
into prompts, and writes per turn (`updateLearnerWritingPad` / `updateTutorWritingPad`,
called at `services/learnerTutorInteractionEngine.js:1142/1149/1574/1687`). The
standard factorial path captures into tutor-core's *separate* pad instead.

Storage: the eval-layer pads use their own SQLite files (`tutor-writing-pad.db`,
`learner-writing-pad.db`, relocatable via `EVAL_WRITING_PAD_DIR`, disabled with
`EVAL_WRITING_PAD_DISABLED=1`); tutor-core's pad lives in the main DB (`writing_pads`
table); `learnerMemoryService` was revived (2026-06-25) to its own `learner-memory.db` under the same `EVAL_WRITING_PAD_DIR` mechanism (see §4).

## 2. The seam (why we can't just merge them)

`tutor-core/` is an **in-housed module** (vendored from the former
`@machinespirits/tutor-core` package on 2026-05-30, see `TUTOR-CORE-INHOUSING.md`),
imported via relative paths. The project keeps it **re-extractable**: `tutor-core/**`
must never import back into the eval layer. So the tutor-core pad and the eval-layer
pads **cannot** be unified into one module without spending that invariant. The
boundary is an internal convention, not a hard repo split — revisitable, but not for
free.

## 3. Decision: Shape B now, Shape A as the likely eventual target

Three shapes were considered:

- **A — Rich-canonical.** Promote `learnerMemoryService`'s model (concept-mastery
  ladder, episodic memory with embeddings, spaced repetition, threads, milestones) to
  *the* learner store; reduce `learnerWritingPad` to a thin three-layer view over it.
- **B — Two pads + a shared contract, rich store retained. ← chosen.** Leave the two
  live systems in place, document and **test** the seam so they can't silently drift,
  and keep `learnerMemoryService` as a deliberately-retained rich-representation
  reserve. Zero deletion, zero risk, full optionality.
- **C — Full unify in the eval layer.** One module owns all memory; tutor-core
  delegates out. Spends the re-extractability invariant. Not now.

**B is the near-term posture.** **A** is the likely eventual target *if* the
cross-session direction (does richer learner state pay across sessions? cf. the A7
longitudinal result) proves out. Nothing here forecloses A.

## 4. `learnerMemoryService` is retained on purpose

It has no live consumer today, but it is **not dead code to be pruned** — it is the
richest representation in the codebase and the most likely canonical core for a future
memory architecture (Shape A). Deletion is **deferred** until the eventual shape is
settled. The file carries a header note pointing here so no future worker mistakes it
for an accidental orphan.

**Revived 2026-06-25:** its DB import (a `getDb` from the pre-in-housing
`services/dbService.js`) had broken when `dbService` moved into `tutor-core/`, leaving
the module unimportable. It is now self-contained — its own `learner-memory.db`
honouring `EVAL_WRITING_PAD_DIR`, seam-safe (no `tutor-core` import), with the `users(id)`
FK enforcement disabled (no users table in standalone mode) and a long-dormant
double-quoted `datetime("now")` SQL bug fixed. It runs and accumulates across sessions
under a hermetic smoke; still no production consumer until the cross-session harness
(step 1 of #3) wires it in.

## 5. Enforced invariants

`tests/memoryArchitectureSeam.test.js` guards the seam so the two systems stay on
their own sides:

1. No file under `tutor-core/` imports the eval-layer memory stores
   (`services/memory/**`) — protects re-extractability.
2. No eval-layer memory store (`services/memory/**`) imports `tutor-core/**` — keeps
   the eval pads standalone.

If a future change deliberately unifies the stores (Shape A or C), update this note
and that test together.

## 6. What would move us off Shape B

- A cross-session experiment showing richer learner state changes outcomes → pursue
  Shape A, with `learnerMemoryService` as the base. (The first powered *simulated* screen
  came back null — §7 — so this trigger now effectively requires a **human-learner**
  cross-session effect, not another simulated run.)
- A decision that tutor-core no longer needs to be re-extractable → Shape C becomes
  available.

Until then: two pads, one seam, one reserve.

## 7. Cross-session experiment (#3): apparatus validated; first powered screen = null

The test that would move us toward Shape A — *does feeding the tutor an accumulated
rich-store memory narrative improve tutoring across a multi-session arc?* — now has a
working, isolated, seam-safe apparatus **and** a first powered, confound-removed run
(2026-06-25). The apparatus is the durable deliverable; the first screen comes back null.

**What was built (the deliverable):**

- The rich store revived (§4) so it runs, keeps its data isolated, and stays seam-clean.
- A seam-safe injection hook — `runEvaluation`'s opt-in `externalEgoExtension` plus the
  `eval-cli run --external-ego-extension-file` flag — prepends an eval-layer-built memory
  narrative onto the tutor's prompt without `tutor-core` importing the eval layer.
- An orchestrator, `scripts/run-rich-memory-arc-experiment.js`: runs an N-session arc per
  learner across two arms (baseline = no injection; rich = accumulated
  `learnerMemoryService` narrative), driving the proven `eval-cli` (generate →
  `evaluate --tutor-only` → read score by `run_id`), with `--gen-model` / `--judge-cli`
  knobs, per-session `sessions.jsonl` resilience, and a generate+judge retry that verifies
  a score actually landed (a transient provider window silently dropped 7/18 sessions in a
  first attempt before this guard — it now self-heals).

**Option (b) executed (the load-bearing upgrade over the smoke):** a *faithful*,
score-blind write-back — after each session a cheap Claude-haiku call mines the transcript
(not the judge's score) into concept levels / episodes / open threads, removing the smoke's
score→memory feedback path — plus the granular `tutor_overall_score` metric (the first-turn
metric clustered at a few discrete values).

**First powered screen** (n=3 learners/arm, 3 sessions, anthropic.haiku generation + codex
CLI judge, 18/18 scored, 0 retries, 0 warns): pooled **baseline 77.1, rich 75.8**;
per-learner contrast **rich − baseline = −1.3** (SE ~2.3, t ≈ −0.57). **Null** — rich is if
anything trivially lower, well inside noise. The per-session slope (baseline −5.0, rich
+1.9) is **not** a memory effect: the three sessions are *different scenarios* in fixed
order, and the middle one (`mood_frustration_to_breakthrough`) scores lower in both arms, so
the slope conflates scenario difficulty with session order. The pooled mean — identical
scenario set in both arms — is the clean summary, and it shows no difference.

**Defensible claim:** there is a working, isolated, seam-safe instrument for testing
cross-session rich memory, and a first powered, confound-removed screen finds **no quality
advantage** from accumulated rich memory — consistent with the A5 prior (§6.6.9: the pad is
not load-bearing for quality). This is all simulated-tutor output, not human learning
(§8.1); it is too underpowered (n=3, single judge) for a paper claim and is **not** added to
the paper.

**Why not scale it.** A bigger simulated run (more learners, a second judge) would most
likely *confirm* this null — the per-learner SE is already tight (~1.5–1.8) around a ~0
difference. The one path that could still differ is **human learners**, which is
IRB-gated / out of immediate scope (§A1; cf. the blueprint skip-list). So: do not chase
this with more simulated spend. A future real memory-effect test should also fix the design
flaw surfaced here — repeat the *same* scenario across sessions (or counterbalance order) so
a slope can be attributed to memory rather than scenario difficulty.

**Bearing on the shape decision:** the null does not motivate a Shape A migration on
*quality* grounds (richer state didn't change simulated outcomes); it does not foreclose A
either (the human-learner case is untested). Shape B stands; see §6.

Code: `services/memory/learnerMemoryService.js`, the injection hook in
`services/evaluationRunner.js` + `scripts/eval-cli.js`, and
`scripts/run-rich-memory-arc-experiment.js`. Powered-screen artifacts:
`exports/rich-memory-arc-2026-06-25T20-35-11-387Z/` (`report.json`, `sessions.jsonl`).
