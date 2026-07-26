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

## 2. What the relabel changes in the existing datasets

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

## 3. Re-deriving trigger membership costs nothing

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

## 4. The label noise is the binding problem

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

## 5. The pilot cannot estimate the archive's gate rate

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

## 6. Sequence

Each step is attended and stops cleanly. Costs are measured, not estimated —
7.0s/call at concurrency 2 on the pilot.

**Step 1 — full single-draw sweep.** 2,329 records remaining, ≈137 minutes.

```bash
node scripts/relabel-program2-evidence-use.js --checkpoint-every 200 --concurrency 2
```

Re-run the same command to continue; it resumes from whatever is on disk. Then:

```bash
node scripts/relabel-program2-evidence-use.js --report
```

This issues no calls. Read the noise floor next to the migration, and read the
archive's real gate rate — this is the first number that can speak to the ~1.1
point prediction.

**Step 2 — k-draw only where it matters.** The turns where v1 and v2 agree are
already stable; re-drawing them is waste. Re-draw the disagreeing subset at
k=3 and take the majority. If the pilot's 37.5% holds, that is ~875 turns × 2
extra draws ≈ 1,750 calls ≈ 100 minutes. This is cheaper than a second judge
family (2× the whole archive plus adjudication) and it answers a different
question: within-model stability, not cross-family reliability. Stability is what
a training target needs.

**Step 3 — re-derive membership.** Zero calls, per §3. Report the four classes
and decide class 3 explicitly.

**Step 4 — rebuild the Task A corpus.** Re-run the extractor with the v2
membership, and re-hash. `general-sft.jsonl` and `kto.jsonl` do not change, so
their SHA-256s in `datasets/trl-v1/manifest.json` must come out identical — that
is a free check that the relabel stayed in its lane.

**Step 5 — decide which seat is being trained**, and freeze a prereg for it
before any GPU time. The two options are genuinely different programs:

- *Writer seat, re-frozen.* The existing plan with a corrected denominator. The
  Phase 5b/5c gaps are the thing being defended; the risk is that re-freezing
  the population re-opens a closed verdict for a ~1 point instrument shift.
- *Classifier seat, new.* Input is the stored `request.systemPrompt` +
  substituted `request.prompt`; target is the v2 envelope; n ≈ 2,345 from a
  single judge family. This is the seat that decides whether the tutor speaks,
  so a local model here removes a frontier call per learner turn. It is also
  where §4's noise bites hardest: ~2.3k examples with a ~15% noisy target is
  thin, and Step 2's majority vote is a precondition rather than a refinement.

Nothing licenses picking one from this note. Both need §4's numbers on the full
sweep first.

## 7. Not in scope

A two-family consensus target. The archive is single-family
(`codex/gpt-5.6-terra`, one draw each), so consensus needs a second judge pass
over all 2,345 records plus adjudication on disagreements — 4,726 calls before
any training. That is a separate decision about what the labels are *for*:
cross-family agreement measures the instrument, within-model majority measures
the label. Step 2 buys the second one at a third of the price.
