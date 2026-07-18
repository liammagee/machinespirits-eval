# Program-2: the context-versus-weights fine-tune

Status: PLAN (sanctioned for drafting 2026-07-18; no training run authorized by
this document). Successor named as a claim-free hypothesis in paper §7.12.
Board card: `workplan/items/program-2-context-vs-weights-finetune.md`.

## 1. Question and hypothesis

The adaptation programme closed with one signature repeated at every grain
(paper §7.12): corrective content demonstrably present in the context never
became behaviour; behaviour moved only under mechanical enforcement, at
transfer cost. Every experiment held the weights fixed and moved words.

**Hypothesis (H-W).** The unrealized capability is parametric: a model
*trained* on the apparatus's own labeled moments will produce, unaided, the
checkable behaviour that no quantity of in-context instruction produced.

**Null (H-0).** The gap survives parameter updates at LoRA scale: a tuned
model does no better on held-out moments than the untuned base under the best
prompting, or passes only by template collapse that fails the blinded-quality
check.

Either outcome is new. Nothing in the existing evidence (§6.15–§6.19, §7.11)
predicts which; that is what makes this the one designed successor the
existing corpus cannot answer.

## 2. Scope and non-goals

- One narrow capability per task, not a tutor. The tuned model is a
  *form-carrier* candidate; semantics stay with the large speaking models.
- Simulated apparatus only; no human-learning claim; development tier under
  §5.12.6.
- No new scenario authoring, no rubric changes, no DB writes. Offline phases
  make zero paid model calls.
- Not a safety experiment. The wall was measured as not refusal-shaped (zero
  safety failures, §6.18); H-W is about trainability of checkable form, and
  the plan inherits that framing — "uncensored" is not the claim and local
  serving is an implementation detail.

## 3. Tasks

**Task A (primary) — the warrant move.** At a `warrant_skip` moment, produce
a tutor reply that passes the frozen four-component deterministic check
(exactly one question; a warrant cue; no new premise; response guards clean —
detector `step4-frozen-2026-07-14.v1`). Chosen because Step 4 measured its
full resistance profile: placebo T2 compliance 0.117/0.202, side-coach
+0.10/−0.02, enforcement realizes the action but leaves the surface cue
unmet on most non-compliant turns (§6.18 addendum). It is a single
generation-shaped skill with an existing zero-call grader.

**Task B (secondary) — the first-draft typed contract.** Produce, unaided, a
draft passing the V-series typed-performance audit (uptake, performance
entry+response, handoff). This is the V53 wall: compiled form passed its home
world and failed all three transfer worlds (§6.18). Task B runs only if Task
A completes with a readable result (either direction); its transfer-world
contexts give the world-generalization axis Task A lacks.

## 4. Data (verified 2026-07-18; all sealed, all machine-local)

Sources, all under `~/.machinespirits-data/`:

| Archive | Contents |
|---|---|
| `step4-claim-runs-2026-07/` | 80 dialogues, 2,076 audited tutor turns, 645 trigger-labeled moments (595 T2 / 50 T1), 1,096 audit-passing original drafts, 284 model-repair pairs, 696 deterministic-fallback pairs |
| `runs/tutor-stub/register-confirmatory-{terra,sonnet5}-*.tar.gz` | 120 dialogues (~3,800 turns) with the same guard/audit machinery |
| `runs/tutor-stub/headroom-*.tar.gz` | 120 rows, same machinery |
| V-series artifacts (`.tutor-stub-auto-eval/first-draft-*`, machine-local) | typed-contract requests + deterministic audit verdicts, home + 3 transfer worlds |

Key property discovered at verification: the sealed `turn_complete` records
store the **actual system prompt the speaking tutor received**
(`prompts.tutor.systemPrompt`) alongside learner text, classifier state
(`discourse_move`, `evidence_use`, `epistemic_stance`, `affect`), proof-DAG
state (`leavesReleased/leavesTotal`), register, and the trigger assignment.
Training examples therefore reconstruct the *identical interface* the large
models faced — swap the model, hold everything else fixed. No hand-built
state serializer is needed for v1.

**Example shapes.**

- SFT positives: (system prompt + dialogue context at turn t) → the delivered
  tutor reply, restricted to turns whose audit passed
  (`guarded_original_accepted`; Task A additionally restricts to trigger
  turns whose compliance verdict was `compliant: true`).
- Unpaired preference labels (for KTO): thumbs-up = audit-passing originals;
  thumbs-down = drafts that failed (`guarded_model_repair_accepted` and
  `guarded_deterministic_fallback` turns store the failing original).
- Paired DPO is deliberately NOT the default: the natural pairs' "chosen"
  side is harness-authored repair text, which the blinded review found
  *worse* than the rejected originals (mean −0.60, §6.18). Preferring repairs
  would train the exact style regression the paper documented. KTO on
  unpaired audit labels avoids constructing any pair through the repair
  channel.

**Splits and leakage controls (frozen at Phase 2).**

- Split by dialogue id, never by turn. Target ≥80/10/10 train/dev/held-out on
  Task A trigger moments; held-out dialogues contribute *all* their turns to
  eval only.
- Family-transfer axis: hold out one speaking-tutor family entirely
  (train on codex-family turns, test on sonnet-family moments, or the
  reverse) as a secondary generalization read. World transfer is Task B's
  axis (Task A data is all world-005-marrick).
- Leak control: the marrick answer term and unreleased premise surfaces must
  not appear in any training target ahead of their release turn — enforced by
  running the existing leak audit over every candidate training example and
  dropping violators (count reported, not silently).
- Contamination note for the record: open base models may know the detective
  worlds' *genre*, but the worlds are project-authored; the answer terms are
  rare particulars; and the graders are surface-deterministic, so
  memorization of the eval is not a live risk. Stated, not assumed: Phase 1
  measures the untuned base on held-out moments first.

## 5. Models and method

- **Base**: an open-weights instruct model in the 4–9B class, newest
  available at execution time. *(Resolved by web check 2026-07-18: the
  drafting-time default Qwen3-8B is superseded by **Qwen3.5-9B** — the small
  series shipped 2026-03-02, dense, Gated DeltaNet hybrid, with MLX-LM LoRA
  architecture coverage confirmed and ollama serving available — with
  **Qwen3.5-4B** as the small ablation. Gemma 4 E4B/12B noted as fallback;
  its effective-parameter and unified-multimodal architecture adds
  tuning-stack risk for no format-fidelity gain. The already-local Qwen3-8B
  provides a free one-generation-back floor point.)* Rationale: large enough
  to hold the dialogue context, small enough to train and serve trivially,
  and weak enough that a pass is informative (if a ≤9B can carry the form,
  the capacity was reachable).
- **Stage 1 — SFT (LoRA)**: rank 16–32, lr ~1e-4, 2–3 epochs over the
  positives (~1.1k Task-A-relevant + up to ~5k general audited-turn
  positives; exact counts frozen in the prereg). Loss on the reply tokens
  only.
- **Stage 2 — KTO (conditional)**: only if SFT alone misses the bar;
  unpaired audit labels as above. One licensed run.
- **No RL, no iterative reward loops** in this plan. The lesson of the
  campaign-loop governance (fold memo) applies: one SFT + one KTO attempt per
  task, then the result stands.

## 6. Compute

Two interchangeable paths; the user has approved cloud if required.

- **Local (default for iteration)**: `mlx_lm.lora` on Apple Silicon — QLoRA
  on an 8B base with 2–6k examples is hours; serving for eval via
  `mlx_lm.server` (OpenAI-compatible).
- **Cloud (for the frozen runs)**: one rented A100/H100 (RunPod, Lambda, or
  Modal) with axolotl or unsloth; SFT + KTO both complete in a small number
  of GPU-hours. Estimated total < US$50 including re-runs of the frozen
  config. Artifacts (adapter weights, config, dataset hashes) archived to
  `~/.machinespirits-data/program-2/` with a tracked manifest, mirroring the
  Step 0.3 convention.

Determinism discipline: fixed seeds recorded; the *frozen* training config is
committed before the frozen run; the exploratory-vs-frozen boundary mirrors
the dry-run/paid-run split used throughout the branch.

## 7. Evaluation

**Offline, deterministic, zero paid calls.** For each held-out trigger
moment: reconstruct the exact generation request from the sealed record,
generate with the model under test (greedy and one sampled config, both
reported), grade with the frozen four-component check + guards + leak audit.
The graders are the *same code* that produced the labels
(`step4-frozen-2026-07-14.v1` and the V-series auditors) — no new judge, no
LLM in the grading loop.

**Comparisons, all pre-registered in Phase 2:**

1. Tuned model vs untuned base (same prompts) on held-out Task A moments —
   the primary contrast.
2. Tuned model vs the frozen in-context ceiling: the archived side-coach and
   compiled-constraint compliance rates (§6.18 addendum) as context, not as a
   like-for-like arm (different speaking models) — reported beside, never
   pooled.
3. Blinded quality check: the §6.18 lesson is that passing form can read
   worse. A small blinded preference review (existing reviewer harness,
   single-LLM-reviewer disclosure carried) between tuned-passing replies and
   matched audit-passing originals, to catch template collapse. A tuned model
   that passes the audit but loses the blind review ≥2:1 does not clear H-W.
4. Task B (if run): audit pass-rate on the three V53 transfer-world context
   sets, against compiled-form's recorded 0/3.

**Thresholds** are deliberately not numbers in this plan: Phase 1 measures
the untuned floor first, then the prereg freezes the bars (pass margin over
floor, minimum absolute rate, blind-review non-inferiority) *before* any
training. No-tune-and-retry applies from that freeze.

## 8. Phases and gates

| Phase | Cost | Content | Gate to proceed |
|---|---|---|---|
| 0. Extraction | zero-call | Dataset builder script over the archives; counts, split manifest, leak-filter report, dataset SHA-256s | counts within 20% of §4's estimates; leak filter loss <10% |
| 1. Floor | local compute only | Untuned base (+ best-effort prompting) on dev + held-out moments; measure the floor both greedy and sampled | floor measured; report written |
| 2. Prereg freeze | zero-call | Frozen doc: exact dataset hashes, splits, training config, thresholds, decision grammar; committed before training | user go for the frozen run |
| 3. Train | local or <US$50 cloud | One SFT run (frozen config); KTO only if SFT misses and only once | — |
| 4. Offline verdict | local | Frozen eval + blinded quality check; results addendum to the prereg; paper addendum to §7.12's successor note | — |
| 5. Live integration (optional, separately gated) | paid (learner seam) | Serve the tuned model OpenAI-compatibly (`base_url` is already supported through the provider config, `scripts/tutor-stub.js:3021`) as a speaking-tutor family; small-n live dialogues on a held-out world with the Step 4 detector machinery | only after a Phase 4 pass; own prereg; explicit user approval |

Phases 0–1 are free and require no further sanction. Phase 3 starts only
after the Phase 2 freeze and an explicit go.

## 9. Decision grammar

| Result | Licensed reading |
|---|---|
| Tuned clears frozen bars on held-out moments + blind review non-inferior | H-W supported at LoRA scale: the gap was context-versus-weights; form-carrier architecture (small tuned form + large semantics) is licensed for a live-phase test |
| Tuned clears audit bars but fails blind review | form learned as template collapse; echoes the §6.18 repair regression from the weight side; no promotion |
| Tuned beats floor but misses bars | partial parametric traction; report as bounded; no second tuning round under this plan |
| Tuned ≈ floor | H-0: the gap survives LoRA-scale updates; the wall is deeper than context or adapters; strengthens §7.12's boundary |
| Instrument failure (extraction/leak-filter collapse, floor unmeasurable) | fix instrument, re-freeze; no verdict |

Task B outcomes read against compiled-form's 0/3 transfer record
independently, same grammar.

## 10. Paper landing

Results land as an addendum beside §7.12's successor paragraph (or a new
§6.20 if the result warrants a full section), with the usual version bump,
revision-history entry, and claim audit. Single-paper discipline: no spin-off
documents.

## 11. Effort estimate

Phase 0 ≈ one focused day (the events are already structured); Phase 1 ≈
half a day; Phase 2 ≈ half a day; Phase 3 ≈ hours; Phase 4 ≈ half a day.
Total cloud spend bounded at US$50 unless re-sanctioned.
