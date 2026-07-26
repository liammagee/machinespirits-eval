# The v2 relabel and the distillation path

2026-07-26. Companion to `notes/program-2/2026-07-18-cloud-finetune-runbook.md`,
which is unchanged — the box setup, the frozen configs and the bring-home
discipline all still apply. This note is only the delta: what moves in the
pipeline because the `evidence_use` labels moved, and which of the two seats the
relabelled corpus can actually train.

## 1. Two seats, and they want different things from this corpus

The tutor has two decisions and they are trained by different data.

| | classifier seat | writer seat |
|---|---|---|
| decides | *when* to intervene | *what to say* at a fired trigger |
| runs on | frontier call per learner turn (`codex/gpt-5.6-terra`) | tuned local 9B, ollama `:11434` |
| emits | the `evidence_use` envelope | the tutor reply |
| graded by | nothing — its output is consumed, not scored | the frozen four-component check + guards + leak audit |
| Phase 5b/5c's +0.236 / +0.202 | not this seat | **this seat** |

The relabelled corpus is *training data* for the classifier seat and only a
*denominator change* for the writer seat. Those are not the same job, and the
existing plan (`PROGRAM-2-FINETUNE-PLAN.md`, Tasks A and B) is entirely
writer-seat. Distilling a local classifier is a new task, not a continuation.

## 2. The sweep must cover two archives, and the training one is the sibling

Checked against `datasets/v1/extraction-report.json` rather than assumed: the
**entire** v1 training corpus came from `~/.machinespirits-data/step4-claim-runs-2026-07/`
— 80 dialogues, 2,076 turns, 645 trigger moments, all 141 Task A rows, all 1,096
general positives. `~/.machinespirits-data/program-2/` holds the *live-phase*
archive (5, 5b, 5c, 5d), which is eval and monitoring data.

| archive | classifier calls | relabellable | role |
|---|---|---|---|
| `step4-claim-runs-2026-07/` | 2,585 | 2,555 | **the training corpus** |
| `program-2/` (phases 5–5d) | 2,363 | 2,345 | live-phase eval and monitoring |
| total | 4,948 | 4,900 | |

Relabelling only `program-2/` would have handed the monitoring data a v2
denominator while leaving the training corpus at v1 — exactly the cross-version
mixing this whole exercise exists to prevent. The tool needs no change to reach
it; `--plan` against the step4 root reports 2,555/2,555 records carrying exactly
one v1 clause, same single model family, so it is a scope argument:

```bash
node scripts/relabel-program2-evidence-use.js \
  --archive ~/.machinespirits-data/step4-claim-runs-2026-07 \
  --out exports/evidence-use-v2-relabel/step4.jsonl \
  --checkpoint-every 200 --concurrency 2
```

Run step4 **first**. It is the corpus that feeds training; the live-phase archive
only moves a denominator.

## 3. What the relabel changes in the existing datasets

`scripts/program2-extract-dataset.mjs` gates each output on a different field,
so the relabel does not touch them uniformly.

| dataset | keyed on | relabel effect |
|---|---|---|
| `general-sft.jsonl` (865 rows) | `tutorGuardAccounting.outcome` | **none** — deterministic audit, no classifier in the path |
| `kto.jsonl` (1,676 rows) | same accept/fail accounting | **none** |
| `taskA-sft.jsonl` | `poa.assigned_trigger` + compliance | **membership changes** |
| `eval-moments.jsonl` | `poa.assigned_trigger` | **membership changes** |

So the frozen SFT and KTO corpora survive the flip intact. What moves is the
Task A population — which turns count as trigger moments at all.

## 4. Re-deriving trigger membership costs nothing

`assignedTrigger()` in `services/tutorStubPointOfActionCoaching.js` is a pure
function, and `poa.inputs` in every sealed `turn_complete` record stores exactly
its arguments — including the v1 `evidence_use` that produced the assignment.
So membership under v2 is a zero-call recomputation: read `poa.inputs`, swap
`evidence_use` for the relabelled value, call
`buildTutorStubPointOfActionTurn({arm, ...inputs, evidenceUse: v2Label})`, and
compare `assigned_trigger`. No model, no API, no re-run.

Four classes come out, and they are not symmetric:

1. **fired v1, fires v2** — retained. Valid Task A positive as before.
2. **fired v1, silent v2** — drops out of the denominator. Harmless: the turn
   simply stops counting.
3. **silent v1, fires v2** — *new* moments, and the hazard. The archive stores
   the request for these turns (the system prompt and context are recorded
   regardless of trigger), but the recorded reply was produced **without** the
   side-coach block, because the trigger never fired at run time. So these
   cannot become Task A SFT positives, and their historical compliance is not a
   like-for-like baseline. They are a counterfactual population.
4. **silent both** — unchanged.

Class 3 is why the relabel cannot simply be dropped into the existing extractor
and re-run. Either exclude class 3 (denominator shrinks on both sides, clean but
throws away the turns the repair was meant to catch) or admit it as eval-only
with the missing-side-coach asymmetry stated. Excluding is the defensible
default; admitting needs its own justification in a prereg.

## 5. The label noise is the binding problem

The 16-record pilot re-issues the whole classification, so the four sibling
categorical fields whose clauses are byte-unchanged give a same-model re-draw
noise floor for free:

| field | v1↔v2 disagreement |
|---|---|
| `evidence_use` (edited) | 37.5% |
| `request_type` | 25.0% |
| `epistemic_stance` | 12.5% |
| `agency` | 6.3% |
| `discourse_move` | 6.3% |
| pooled control | 12.5% |

Against `evidence_use`'s separately measured 84.9% same-rubric
self-reproducibility, the aggregate migration is roughly 3× the floor — the edit
does real work — but individual per-turn flips are not attributable. A single
draw per record is therefore an adequate basis for an aggregate rate and a noisy
basis for a per-turn training target.

Two things were checked and did not pan out:

- **Collapsing the target to the binary the gate consumes does not absorb the
  noise.** Since `warrant_skip` fires on `omits_warrant` OR
  `overleaps_evidence`, confusion inside that pair would be free. On the pilot,
  5 of 6 label changes *crossed* the boundary and 0 stayed inside the pair:
  31.3% binary vs 37.5% eight-way. The collapse buys ~6 points, not most of it.
- **`distorts_public_evidence` is a textual control only.** Its clause is
  byte-identical across versions, and both of its pilot cases still moved into
  the gate-firing pair. Byte-identity means the wording did not change; it does
  not mean the label's rate cannot.

## 6. The pilot cannot estimate the archive's gate rate

The slice was stratified to two records per stored label, so it is uniform by
construction and the archive is not:

| label | pilot | archive |
|---|---|---|
| `omits_warrant` | 12.5% | 26.2% |
| `overleaps_evidence` | 12.5% | 22.2% |
| `cites_public_evidence` | 12.5% | 19.4% |
| `links_evidence_to_rule` | 12.5% | 19.3% |
| `none` | 12.5% | 5.6% |
| `revises_from_evidence` | 12.5% | 3.0% |
| `distorts_public_evidence` | 12.5% | 2.6% |
| `repeats_setup` | 12.5% | 1.7% |
| **gate-firing share** | **25.0%** | **48.4%** |

The pilot under-samples the firing pair by about half, which mechanically
inflates migration *into* it. The pilot's gate rate went 25.0% → 43.8%, i.e.
*up*, while the denominator analysis predicts the v2 rubric quiets turns and the
rate goes *down* by about 1.1 points. Those are not in conflict — the pilot is
deliberately non-representative and cannot settle the direction. **Do not treat
the pilot as confirming or refuting the ~1.1 point prediction.** The full sweep
can; nothing before it can.

## 7. Sequence

Each step is attended and stops cleanly. Costs are measured, not estimated —
7.0s/call at concurrency 2 on the pilot.

**Step 1 — sweep the training archive.** 2,555 records, ≈149 minutes. This is the
one that gates everything downstream.

```bash
node scripts/relabel-program2-evidence-use.js \
  --archive ~/.machinespirits-data/step4-claim-runs-2026-07 \
  --out exports/evidence-use-v2-relabel/step4.jsonl \
  --checkpoint-every 200 --concurrency 2
```

**Step 2 — sweep the live-phase archive.** 2,329 records remaining (16 done in
the pilot), ≈136 minutes.

```bash
node scripts/relabel-program2-evidence-use.js --checkpoint-every 200 --concurrency 2
```

Either command resumes from whatever is on disk when re-run, so both steps can be
split across as many sittings as convenient. Then, per archive:

```bash
node scripts/relabel-program2-evidence-use.js --report
```

```bash
node scripts/relabel-program2-evidence-use.js \
  --archive ~/.machinespirits-data/step4-claim-runs-2026-07 \
  --out exports/evidence-use-v2-relabel/step4.jsonl --report
```

Both issue no calls. Read the noise floor next to the migration, and read each
archive's real gate rate — the step4 number is the first one that can speak to the
~1.1 point prediction, because it is the population the prediction was computed
on.

**Step 3 — k-draw only where it matters.** The turns where v1 and v2 agree are
already stable; re-drawing them is waste. Re-draw the disagreeing subset at k=3
and take the majority. If the pilot's 37.5% held across both archives that would
be ~1,840 turns × 2 extra draws ≈ 3,680 calls ≈ 215 minutes — but the pilot
over-samples rare labels, so budget from the rate measured in Steps 1–2, not from
37.5%. Either way it is cheaper than a second judge family (2× everything plus
adjudication) and it answers a different question: within-model stability rather
than cross-family reliability. Stability is what a training target needs.

**Step 4 — re-derive membership.** Zero calls, per §4. Report the four classes and
decide class 3 explicitly.

**Step 5 — rebuild the corpus.** Re-run the extractor with the v2 membership, and
re-hash. `general-sft.jsonl` and `kto.jsonl` do not change, so their SHA-256s in
`datasets/trl-v1/manifest.json` must come out identical — a free check that the
relabel stayed in its lane. `taskA-sft.jsonl` will move, and it is small: 141 rows
split 105/21/15. A membership shift that would be a rounding error on the general
corpus is not one here, and the Phase 4 verdict grades 61 held-out eval moments.
Report the new split counts beside the old ones.

**Step 6 — decide which seat is being trained**, and freeze a prereg for it before
any GPU time. The two options are genuinely different programs:

- *Writer seat, re-frozen.* The existing plan with a corrected denominator. The
  Phase 5b/5c gaps are the thing being defended; the risk is that re-freezing a
  141-row corpus and a 61-moment held-out set re-opens a closed verdict for a ~1
  point instrument shift.
- *Classifier seat, new.* Input is the stored `request.systemPrompt` + substituted
  `request.prompt`; target is the v2 envelope; n ≈ 4,900 across both archives from
  a single judge family. This is the seat that decides whether the tutor speaks,
  so a local model here removes a frontier call per learner turn. It is also where
  §5's noise bites hardest: a ~15% noisy target makes Step 3's majority vote a
  precondition rather than a refinement.

Nothing licenses picking one from this note. Both need §5's numbers on the full
sweep first.

## 8. Not in scope

A two-family consensus target. Both archives are single-family
(`codex/gpt-5.6-terra`, one draw each), so consensus needs a second judge pass
over all 4,900 records plus adjudication on disagreements — 9,800 calls before any
training. That is a separate decision about what the labels are *for*: cross-family
agreement measures the instrument, within-model majority measures the label.
Step 3 buys the second one at a fraction of the price.
