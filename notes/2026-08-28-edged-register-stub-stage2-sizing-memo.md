# Edged-register stub replication — Stage 1 results and Stage 2 sizing memo

Date: 2026-08-28
Workplan item: edged-register-stub-dag-replication
Status: DRAFT — Stage 2 runs only on a fresh signed GO. This memo is design
input, not authorization.

## 1. What Stage 1 was

A warm-only calibration block under the signed GO of 2026-08-27 (eval commit
194653a8). The scripted-core tutor (code decides the moves, a model words
them in the pinned warm manner) ran against four learner characters, 12
dialogues each, 48 in all. World 005 (Marrick), strict proof-DAG, run seed
20260711, codex.gpt-5.6-luna in all three model seats, 120 model calls per
dialogue, 40-turn safety cap. No manner contrast yet — Stage 1 only measures
what warm alone does, so Stage 2 can be sized on facts.

Artifact roots (archived in the private repo, commit 90d43ae6):

- bored: `.tutor-stub-auto-eval/qa-matrix-2026-08-28T04-48-44-495Z`
- affective_resistant: `.tutor-stub-auto-eval/qa-matrix-2026-08-28T12-54-58-459Z`
- proof_skipper: `.tutor-stub-auto-eval/qa-matrix-2026-08-28T13-35-21-007Z`
- diligent: `.tutor-stub-auto-eval/qa-matrix-2026-08-28T14-11-19-326Z`

## 2. Results in plain language

A dialogue "closes" when the learner assembles the full six-fact chain and
the tutor confirms it. "Coverage" is the fraction of the chain assembled
when the dialogue stopped, whatever stopped it.

| Cell | Closed | What happened in the failures |
|---|---|---|
| bored | 0/12 | The learner never moved. Coverage 0 in every row; the call pool died at turns 18–38 with nothing assembled. |
| affective_resistant | 1/12 | The one closure grounded at turn 28. The 11 failures died on the call pool at turns 37–39 with coverage 0.333–1.0 (three rows at 1.0). |
| proof_skipper | 9/12 | Mean grounding turn 27. Two pool deaths (coverage 0.833, 0.667) and one guard stop at turn 10. |
| diligent | 0/12 | Five rows finished the whole chain (coverage 1.0) and the pool died at turns 36–38 before the tutor spoke the close. Five more pool deaths at coverage 0.5–0.833. Two guard stops (turns 11 and 17). |

Three stop causes, with counts over all 48 rows:

1. **Clean grounded close** — 10 rows.
2. **Call-pool death** — 35 rows. The 120-call pool, shared by the tutor
   seat, the learner seat, and the learner-analysis seat, burns at about 3.2
   calls per turn, so it dies near turn 37 — under the 40-turn cap. The pool,
   not the learner, is the modal stop.
3. **Leak-guard stop** — 3 rows (6%). The guard that keeps the tutor from
   voicing facts the code did not release rejected three candidate wordings
   in a row and stopped the dialogue, fail-closed.

The turn cap was never reached.

**Manner fidelity (blind read of all 1,562 tutor turns, Sonnet 5).** Zero
pin violations, zero harm flags, zero confirmed person-attacks. The
report-only leak channel — warm-pinned turns a blind reader hears as edged:

| Cell | Warm turns read as edged |
|---|---|
| bored | 25/381 (6.6%) |
| diligent | 51/401 (12.7%) |
| proof_skipper | 49/328 (14.9%) |
| affective_resistant | 80/452 (17.7%) |

The ordering is the resistance ordering: the more the learner pushes back,
the more edge leaks into a warm-pinned voice. This is a finding to keep,
and it sets the warm-side baseline the sharp arm must separate from.

**Trajectory instrument (clean rows only, by design).** proof_skipper
coverage at fixed learner turns 8/12/16: 0.037 / 0.333 / 0.426. The one
resistant closure: 0 / 0.5 / 0.5.

## 3. What Stage 1 teaches

1. **The call pool was too small, and it censors the closure endpoint.**
   120 calls was the runner's default, not a sized choice. At ~3.2 calls
   per turn it dies near turn 37. Diligent's 0/12 is a pool artifact:
   the proof completes; only the voiced close is missing. Bored's 0/12 is
   real: coverage 0 everywhere.
2. **Closure and coverage must be read separately.** Same closure number
   (0/12), opposite facts. Any Stage-2 endpoint on closure is valid only
   if the pool no longer binds.
3. **The guard-stop rate (3/48) is a real loss channel** and belongs in the
   Stage-2 row budget.
4. **The matrix runner stops after any cell with a failed row** (a failed
   row makes the cell exit nonzero, which the runner treats as fatal).
   Stage 2 launches per-cell, chained, as Stage 1 ended up doing — or the
   runner gets a flag first.

## 4. Proposed Stage 2 design (draft)

**Question.** Does the edged (sarcastic) manner change learner progress
through the proof-DAG, against warm, with the teaching held fixed by the
scripted core?

**Cells.** Two manners × three characters = 6 cells, 12 dialogues each,
72 dialogues.

- Kept: affective_resistant, proof_skipper, diligent.
- Dropped: bored, per the registered rule (0/12 closure AND zero coverage
  spread — both grounds; the learner genuinely does not move under warm).
- Diligent: the drop rule's letter (0/12 closure) says drop; the cause is
  the call pool, not the character. RECOMMENDATION: keep it, with the
  operator's ruling recorded here before launch. OPERATOR RULING: ________
- Stage-1 rows take no part in Stage-2 analysis (registered; unchanged).

**Call pool: 180 per dialogue.** Derivation: observed burn is ~3.2 calls
per turn on characters that move (120/37); 180 covers the full 40-turn cap
at up to 4.5 calls per turn, so the turn cap, not the pool, becomes the
binding stop, and closure becomes a readable endpoint. Bored-style burn
(120 calls in 21 turns at worst) is not covered — that character is out.

**Endpoints.**

- Primary: coverage at fixed learner turns 8/12/16 and the area under the
  coverage curve to turn 16 — read on every row, immune to the stop cause.
- Secondary: closure rate and grounding turn — valid under the 180 pool.
- Manner check: the blind fidelity read on every tutor turn; the registered
  0.8 presence floor binds the sharp arm; the warm arm's leak stays
  report-only with Stage 1 as its baseline (6.6–17.7%).
- Harm scan on every turn; confirmed flags go to the operator, as before.

**Spend ceiling (hard).** Generation: 72 × 180 = 12,960 model calls.
Fidelity reads: one per tutor turn, expected ~2,500, ceiling 3,200.
Attended run; no resampling after a failure; indeterminate-means-stop;
a failed row stands and is reported.

**Launch shape.** Per-cell chained detached launches (nohup, logs under
`.tutor-stub-auto-eval/`), 6 cells; free trajectory pass, paid fidelity
pass, archive — the same after-run order as Stage 1.

## 5. Provenance (recorded, not enforced)

Stage 1 ran from worktree branch codex/resistance-axis-heldout-registration
at eval commit 194653a8 (clean tree at launch). Reports, ledgers, packed
traces, and this memo's numbers all live under the four archived roots.
