# Edged-register stub replication — Stage 1 results and Stage 2 sizing memo

Date: 2026-08-28
Workplan item: edged-register-stub-dag-replication
Status: GO — given by Liam Magee in session, 2026-08-28, with the ruling
"keep diligent". The GO covers this memo's question, design, endpoints, and
spend ceilings, and stays valid across code-defect fixes.

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
  operator's ruling recorded here before launch. OPERATOR RULING: keep
  diligent (given in session, 2026-08-28).
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

## 6. Amendment 1 — prompt-size guard raise and relaunch (2026-08-28)

The first Stage-2 launch (root `qa-matrix-2026-08-28T20-52-23-839Z`,
affective_resistant, warm arm) exposed a second instrument ceiling. The
tutor turn prompt grows with the standing state and crossed the frozen
42,000-character audit guard at turn ~38 — one turn behind where the old
120-call pool used to bind. Four of six sealed rows died on it (turns
37–39, coverages 0.5–1.0, two full chains unclosed); one row was a
leak-guard stop (turn 11); one row reached the 40-turn cap clean — the
first cap-bound row in the study, proof the 180-call pool works. The
guard had no recovery path for the tutor seat and no setting, so closure
was censored again.

The run was paused at 6 of 72 dialogues to stop spend under the open
question. Sunk spend: the 6 sealed rows plus 6 killed in-flight partials,
about 1,900 generation calls at most. The sealed rows stand as records
and take no part in any analysis.

Operator ruling (given in session, 2026-08-28): "Sure, raise it —
perhaps higher still, to 64,000 characters. This is not a great reason to
fail. Raise and relaunch."

Change: `tutor_turn` guard in `services/tutorStubPromptAudit.js` raised
from 42,000 chars / 10,500 approx tokens to 64,000 / 16,000, with a
recorded comment. The 40-turn safety cap bounds all prompt growth, so the
margin is bounded. Tests, lint, and format pass. The relaunch runs the
full 72-dialogue block fresh from the commit that carries this amendment.
The aborted root is archived with the study artifacts, marked void.

Spend accounting: the fresh block spends the full registered ceiling
(12,960 generation calls) again; the sunk ~1,900 sits on top. The
operator's ruling above covers this.

## 7. Amendment 2 — summary-writer defect and free rebuild (2026-08-28)

The relaunched affective_resistant cell finished all 24 dialogues, then
the end-of-run report writer died with "Invalid string length". Cause:
the writer built the whole summary as one pretty-printed JSON string,
and a 24-row cell of 40-turn dialogues pushed that single string past
Node's maximum (~536M characters; the streamed file came out at 292MB,
so the pretty form would have been ~540MB). Every dialogue trace, log,
and evidence event was already safe on disk — only the summary, HTML
report, ledger entry, and seal were missing.

Fix (free post-processing, no model calls, no design change):

1. `scripts/run-tutor-stub-auto-eval.js` now streams the summary file —
   small fields keep the pretty layout, the two large arrays are written
   one compact element per line. No single string scales with the run.
2. A new `--rebuild-from <run dir>` mode reconstructs a crashed run's
   summary, report, ledger entry, and seal from its on-disk evidence
   (run plan, job-completed events, per-job traces). Each per-job result
   is a pure function of those artifacts.

The resistant cell was rebuilt with the new mode: 24/24 rows, sealed
with integrity verified and zero unmet contract items, status
"incomplete" because one sarcastic row is a leak-guard stop (a failed
row stands and is reported, per the registered rules). The proof_skipper
cell was already running on the old code when the fix landed; if its
summary write dies the same way, the same rebuild recovers it. The
diligent cell starts a fresh process and runs the fixed writer.

Resistant-cell scoreboard (rebuilt summary; fidelity read still to run):
warm 12 rows, 1 grounded closure (turn 27), 11 turn-cap stops, mean
final coverage 0.792, mean coverage at learner turn 16 = 0.278;
sarcastic 12 rows, 0 closures, 11 turn-cap stops, 1 leak-guard stop,
mean final coverage 0.864, mean coverage at learner turn 16 = 0.417.

## 8. Stage-2 block complete — first results (2026-08-29)

All 72 dialogues ran. Three cell roots, each sealed with integrity verified
and zero unmet contract items:

- affective_resistant: `qa-matrix-2026-08-28T21-41-13-718Z` (sealed
  incomplete: 1 leak-guard row)
- proof_skipper: `qa-matrix-2026-08-28T23-01-11-203Z` (sealed complete:
  no failed rows)
- diligent: `qa-matrix-2026-08-29T00-13-58-641Z` (sealed incomplete:
  4 leak-guard rows)

The fixed streaming writer ran the diligent cell's report without incident
(279MB summary). The proof_skipper cell wrote on the old code and fit
under the limit (426MB) because its dialogues closed early.

**Stop causes over 72 rows.** 20 grounded closures, 46 turn-cap stops,
5 leak-guard stops (7%), 1 turn-cap stop shy of coverage in the resistant
warm arm counted among the 46. The call pool never bound and the prompt
guard never fired — the 180-call pool and the 64,000-character ceiling did
their jobs. The turn cap is now the modal stop.

**Primary endpoint (trajectory pass, 67 clean rows, guard rows excluded
by design).** Coverage at learner turn 16, sarcastic vs warm:

| Character | sarcastic | warm |
|---|---|---|
| affective_resistant | 0.455 | 0.278 |
| diligent | 0.467 | 0.450 |
| proof_skipper | 0.444 | 0.486 |

Area under the coverage curve to turn 16 shows the same shape: resistant
0.164 vs 0.112; diligent 0.214 vs 0.218; proof_skipper 0.204 vs 0.200.

Reading: the manner contrast lives in one cell. On the resistant learner
the edged manner moves coverage well ahead of warm at every horizon. On
the diligent and proof-skipping learners the two manners are within noise
of each other. This matches the Stage-1 leak finding from the other side:
resistance pulls edge out of a warm-pinned tutor, and supplied edge helps
only the resistant learner.

**Secondary (closure).** proof_skipper: 10/12 both manners; warm grounds
faster (mean turn 25.7 vs 28.1). affective_resistant: warm 1/12,
sarcastic 0/12. diligent: 0/24 — every clean diligent row but two ended
at the 40-turn cap, 15 of them with the full chain assembled and the
close unspoken. Stage 1's diligent censoring was blamed on the call pool;
the pool is gone and the pattern stands, so the cause is the character's
closing behaviour, not the budget. Closure stays a valid endpoint only
where grounding happens well inside the cap.

**Guard stops.** 5/72 (resistant sarcastic 1; diligent warm 2, sarcastic
2) vs Stage 1's 3/48. Diligent is the guard-heavy character in both
stages. Failed rows stand and are reported; none were resampled.

Report: `.tutor-stub-auto-eval/stage2-trajectory-report.md`. Still open:
the paid fidelity read (sharp-arm 0.8 presence floor binds; warm leak
report-only against the Stage-1 baseline), then archive of all roots
including the void root `qa-matrix-2026-08-28T20-52-23-839Z`. Both wait
on the operator's word.
