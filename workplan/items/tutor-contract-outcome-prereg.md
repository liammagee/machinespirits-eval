---
id: tutor-contract-outcome-prereg
title: "Pre-registration: does the per-turn contract change legitimate closure?"
status: triaged
type: experiment
priority: P1
owner: claude
source: manual
created: 2026-07-29
updated: 2026-07-30
verification: "Before any paid dialogue: the closure detector is hand-audited
  against the pilot transcripts and its misses are fixed or the endpoint is
  re-specified; the pilot gate (bare closure in the 20–80% band per world) is
  met or the world/turn-cap is re-picked and the change logged here before
  proceeding. The run itself is attended and checkpointed."
claim_status: methods
depends_on:
  - tutor-instrumentation-ab-harness
  - tutor-eval-instrument-dashboard
tags:
  - tutor-stub
  - prereg
  - outcome
---

Registered before the first paid call. Amendments after the pilot gate must be
logged in this file with dates; amendments after the main run starts are not
permitted — a changed design is a new card.

**Question.** With everything else equal, does a learner tutored under the
per-turn performance contract reach the case's conclusion legitimately more
often than one tutored by the bare frontier model?

**Why this is not a rerun of past comparisons.** Every prior bare-vs-mechanism
comparison was scored by a judge or by our own rules; the two now disagree
about this mechanism (bench 3× better, blind pairwise judge ~6:1 worse, both
readings in `tutor-instrumentation-ab-harness`). The endpoint here is owned by
neither: a machine-checked fact of the case.

**Design.** Free-running dialogues, three versions of the tutor: bare,
contract-only, and the fixed empty plan (the length-and-shape control). One
speaking model for all three: codex `gpt-5.6-terra`, medium effort. Same
learner configuration throughout; the learner never sees which version it has.
Worlds: Nocturne, Greyfen, Tallow, plus one held-out world the contract has
never been tuned against. Turn cap fixed per world at pilot. n = 12 dialogues
per version per world (144 total); if quota forces a cut, drop worlds, never
n per cell, and log the cut here.

**Pilot gate (before the main spend).** 5 bare dialogues per world. The
closure detector is hand-audited on every pilot transcript — the phase-5e
record shows its matchers have missed legitimate closures before. Bare
closure must land in the 20–80% band; a world outside the band gets its turn
cap re-picked once or is dropped. The Oedipus smoke showed learner models
converging regardless of tutoring; this gate exists so a saturated endpoint
cannot masquerade as a null.

**Primary endpoint.** Legitimate closure: within the cap, the learner states
the conclusion and the voiced public premises entail it, both checked
deterministically from the world's proof-DAG. Verdict: difference in closure
proportion, contract vs bare, pooled over worlds, two-sided exact test,
α = 0.05. The empty-plan version is a control, not a comparison of record.

**Secondary endpoints (reported, never promoted).** Turns to closure; share
of the winning proof path voiced by the learner rather than handed over;
spoiled-case rate (conclusion asserted unearned, by either party); blind
whole-dialogue preference — two transcripts, order hashed, judged by a model
family that wrote neither side (Sonnet; GPT fallback where Sonnet's content
filter refuses, refusals reported).

**Pre-committed readings.** Contract raises closure: turn-level preference is
demoted to a secondary signal and the contract keeps its place. No
difference: the contract is re-scoped as compliance machinery — the
guarantees stand, the pedagogy claim is withdrawn. Contract lowers closure:
it leaves the default stack and the provable-discourse sections are re-scoped
to verifiability only. All three branches are actions, not interpretations.

**Limits, stated now.** One stack, one simulated learner, criterial endpoints;
no claim about human learning; a null is stack-bounded until replicated on
another model. Nothing enters the paper before the run completes and survives
this card's own verdict rule.

**To build first.** The dialogue-level blind judge (sibling of
`scripts/judge-tutor-stub-ab-pairs.js`); the closure-audit pass over pilots.
Both are file-reading tools; neither needs the run to exist.

---

**Pilot log, 2026-07-30. Gate: FAILED — main run does not start.** 20 bare
dialogues (`exports/tutor-stub-outcome/pilot-1/`, 5 per world, cap 12, no
errors; every turn's trace stamp confirms zero advisory blocks).

Detector hand-audit: FAILED. The engine missed 3 of 8 true closures (Greyfen
#1 and #4, Rowan Flat #4) — in each the learner states the conclusion plainly
and twice ("G17 contamination from the breached Larkin incubator ruined the
Corvat line…") and the assertion matcher scores it absent; the tutor then
loops boilerplate to the cap. The missed phrasings are passive or
causal-clause forms; the three recognized closures use subject-position
verdict forms. Same matcher family the leak-audit card fixed for false
positives, now failing in the other direction. All 8 detector CLOSED
verdicts spot-check as genuine; the miss direction is false negatives only.

Bands, hand-corrected: no world in band. Greyfen 5/5 and Rowan Flat 5/5 —
saturated; Nocturne 0/5 and Tallow 0/5 — below. The floor worlds are not
dead dialogues: both transcripts show the tutor mid-release of a decisive
clue at the exact turn the cap falls, so a longer cap plausibly moves them;
the pre-registered remedy (one re-pick per world) has not yet been spent.

Next steps in order, none yet taken: fix the assertion matcher and prove the
three misses caught by unit test; recompute closure offline from the recorded
learner lines (the matcher is pure — no new spend) and re-derive this table;
then decide the one cap re-pick for Nocturne and Tallow and whether the
saturated worlds are dropped or kept for the turns-to-closure secondary only.

---

**Matcher fix, 2026-07-30 (commit `25577590`).** The four worlds gained
`secret.recognition_patterns`, and the backstop now reads only the asserted
part of a learner turn (`tutorStubAssertedClaimText`). Four shapes carry every
token of a verdict while stating none of it, and all four come off before the
pattern is matched: a question, the rejected half of a contrast, a sentence
that withholds or hedges, and the span an evidential verb governs ("supports
G17 as what ruined the line"). Two of the four reuse guards the leak audit
already wrote and tested. Nine unit tests, every sentence a verbatim pilot
turn: three positive misses, and three negatives built from what the *first*
widened matcher wrongly closed on. That mistake is logged rather than quietly
fixed — a matcher widened to catch false negatives fails in the other
direction, and the third of them decided whether Greyfen counted as 3/5 or
5/5.

**Gate table, corrected offline** (`scripts/recompute-outcome-closure.js`, no
new spend). Nocturne 0/5 · Greyfen 5/5 · Tallow 0/5 · Rowan Flat 5/5. Three
corrections, all flat verdicts stated on turn 9 or 10 and then repeated
near-verbatim to the cap while the tutor never closed — the silent-failure
signature documented in `answerSurface.js`. Gate still FAILS.

**The two zeros were the harness, not the tutor** (commits `7b9b0df8`,
`d8095939`). Both floor worlds ran to a hardcoded 12 turns. Nocturne's author
guarantees the secret is *not* derivable before turn 28 and writes the world
to 40; Tallow's floor is turn 11, cap 18. So no tutor could have closed
Nocturne, and Tallow was cut a turn after its earliest legal answer — those
0/5s measured the runner. Per-dialogue rows confirm it: every one of the ten
stopped at exactly 12 turns with `finalSecretEntailed: false`. The runner now
takes each world's own `turn_cap`, scales the model-call budget and the
hung-child timeout with it, and refuses a `--turn-cap` that lands below a
world's `t_min` rather than producing another unmeasurable zero.

This is not the pre-registered cap re-pick, and the re-pick stays unspent: the
gate asked for a turn cap fixed per world at pilot, and the runner was not
honouring the worlds' own caps at all. Greyfen (authored 14) and Rowan (12)
ran above their floors and stay as recorded.

**Re-pilot, 2026-07-30** (`exports/tutor-stub-outcome/pilot-2/`). 5 bare
dialogues each on Nocturne (cap 40) and Tallow (18), same speaker, learner and
zero advisory blocks. Both floors were the cap and nothing else. Nocturne closed
4 of the 4 dialogues that finished, at turns 34, 35, 33 and 35 — every one past
turn 28, which is the first turn its author lets the answer be derivable, and
all four legitimate (`grounded_asserted_secret`, record entails the secret).
Tallow closed 5 of 5, at turns 13 to 15. The offline recompute finds nothing to
correct in either world: the engine caught every closure the matcher would.

**One dialogue crashed, and it was nearly counted as a failure to close.**
Nocturne #3 exited non-zero at turn 15 with `guard_exhausted`. The tutor quoted
the learner's own hedged line back ("Liane's presence in the copy-room makes her
a possible maker…"), and the leak guard read the quoted name as the tutor
stating the answer sixteen turns before the world permits it. The deterministic
fallback tripped the same guard, so the run threw. The runner had recorded it
`status: ok` because its trace parsed, which put a crash in the gate's
denominator and by itself moved Nocturne from saturated to inside the band. The
rule for what counts now lives in `services/tutorStubOutcomeRows.js`, read by
both the runner and the offline recompute so the two cannot drift, and a test
pins the legacy shape (`ok` plus a non-zero exit still reads as aborted).
Aborted dialogues are named in the report rather than dropped. The leak guard
itself is untouched — it killed 1 of 10 paid dialogues and wants its own fix.

**Gate call: FAILED for saturation, in every world. This card closes here.**

| World | Cap | Complete | Closed | Rate |
|---|---|---|---|---|
| Nocturne | 40 | 4 (+1 aborted) | 4 | 100% |
| Greyfen | 12 | 5 | 5 | 100% |
| Tallow | 18 | 5 | 5 | 100% |
| Rowan Flat | 12 | 5 | 5 | 100% |

Nineteen of nineteen finished dialogues closed. Given a world's own length, the
bare frontier tutor gets this learner to the conclusion every time, so the
primary endpoint has no room above it — a contract version can only show harm.
The pre-registered remedy does not reach this: dropping all four worlds leaves
no experiment, and re-picking a cap for saturation means moving it inside the
closure window already observed (Nocturne 33–35, Tallow 13–15, Greyfen 9–12,
Rowan 8–12). That would turn "does the learner reach the conclusion" into "does
the learner reach it before turn N", tuned on the same data it would then be
measured against. It is a different endpoint wearing the same name, so the one
cap re-pick stays unspent.

This is not the card's "no difference" branch — that branch is about a null
contrast, and no contrast was run. The endpoint died before the comparison. The
144-dialogue main run does not start.

What survives is measured and not saturated: turns to closure spreads 8 to 35
across worlds and 2 to 3 within one, and the share of the proof path the learner
voices is untouched by any of this. Both are pre-registered secondaries. Making
either the endpoint of record is a design change, so it is a new card, not an
amendment here.

Nocturne rests on 4 dialogues rather than 5; 4 of 4 alone would not rule out a
true rate under 80%. A fifth costs about 25 minutes and cannot change the call —
4/4 and 5/5 are both above the band, and three other worlds agree at 5/5.

Per the standing instruction on this arc, none of this goes into the paper.
