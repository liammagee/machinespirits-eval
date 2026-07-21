# Program-2 Phase 2 pre-registration: the context-versus-weights training runs

Status: **FROZEN 2026-07-18. Training is authorized only under the exact
terms below; no model call for training has been made at freeze time.**
Parent plan: `PROGRAM-2-FINETUNE-PLAN.md` (incl. HANDOFF H1–H5 revisions).
Floors and instrument: `notes/program-2/2026-07-18-phase1-floors.md`.
Execution environment: `notes/program-2/2026-07-18-cloud-finetune-runbook.md`.
Board card: `workplan/items/program-2-context-vs-weights-finetune.md`.

## 1. Question

H-W (plan §1): a model trained on the apparatus's own audit-labeled moments
will produce, unaided, the checkable warrant move that no in-context
instruction produced. Two arms isolate the alignment layer (H1): the
instruct variant and its base sibling, identical LoRA data.

## 2. Frozen materials

**Base models (HuggingFace revisions pinned):**

- Instruct arm: `Qwen/Qwen3.5-9B` @ `c202236235762e1c871ad0ccb60c8ee5ba337b9a`
- Base arm: `Qwen/Qwen3.5-9B-Base` @ `68c46c4b3498877f3ef123c856ecfde50c39f404`

**Training data (train split only; dialogue-level splits seed 20260718 per
the Phase 0 manifest; SHA-256):**

- `sft-instruct.jsonl` — 865 rows — `e89f3ac443ea612f64be0be8388174852006903df5a725f7e41c9a56bb1de6b6`
- `sft-base.jsonl` — 865 rows (prompt/completion form) — `5b1718ea3b7882b7fd03d22d9f6ea2bb79c5f842438061719dd23995af92cf9f`
- `kto.jsonl` — 1,676 rows (unpaired labels) — `d8e29db88947d1d948ff688073d417800eb57452e9405045a9a9edc2836ae927`

Both arms train with completion-only loss on identical target sets; only the
prompt encoding differs (chat template vs the frozen flattening template).

**The flattening template — FROZEN as `program2-base-flatten.v1`** (promoted
unchanged from `v1-draft`, which produced the base floor). Deterministic
construction, verbatim semantics:

```
<systemPrompt, trimmed>

--- Dialogue transcript ---

<Speaker>: <message content, trimmed>        # one block per history message,
                                             # Speaker = "Tutor" for assistant
                                             # rows, else "Learner"

Tutor:
```

Training completion = `" " + target.trim()`. Generation stop sequences:
`"\nLearner:"`, `"\n---"`. Implementations: `flattenForBase` in
`scripts/program2-floor-grader.mjs` (evaluation) and the exporter that
produced `sft-base.jsonl` (training) — byte-equivalent by construction; any
change to either after this freeze re-opens the floor.

**Training scripts (frozen configs baked in):**
`scripts/program2-train-sft.py`, `scripts/program2-train-kto.py`. Config:
LoRA r=32, alpha=64, target `all-linear`; lr 1e-4; 2 epochs; per-device
batch 1 × grad-accum 8; bf16; completion-only loss; `save_strategy=epoch`;
seed **20260718**. Stack: TRL (SFTTrainer/KTOTrainer) + PEFT on
transformers, single A100/H100 80GB (runbook §1). The environment record
(pip freeze, instance type, driver) is captured before the first frozen run
and stored with the run artifacts.

## 3. Licensed runs (≤4; no sweeps; no-tune-and-retry from this freeze)

1. SFT-instruct (one run)
2. SFT-base (one run)
3. KTO-instruct — **only if** SFT-instruct fails the primary gates §5;
   starts from the SFT-instruct adapter (one run)
4. KTO-base — same rule for the base arm (one run)

A run that crashes for a documented technical reason (OOM, instance loss)
may be restarted with byte-identical config; nothing else may be changed.

## 4. Evaluation protocol (all grading local, deterministic, zero-call)

- Moments: the same held-out 58 warrant_skip moments as the Phase 1 floors
  (dev 62 used only descriptively). Grader:
  `scripts/program2-floor-grader.mjs`, unchanged (fidelity 99.83%/100%,
  disclosed conservative guard component).
- **Serving pin (per arm, matching that arm's floor exactly):** merge
  adapter into its base weights → GGUF via `llama.cpp convert_hf_to_gguf.py`
  → ollama; instruct arm at **Q4_K_M** with the native chat shape
  (`/api/chat`, `think:false`, num_ctx 16384); base arm at **q8_0** with the
  frozen flattened shape (`/api/generate`, `raw:true`, same stops). Greedy
  decoding is primary; sampled (T=0.35) reported descriptively.
- Frozen floor references (held-out greedy): instruct **0.362**; base
  **0.103**.

## 5. Primary gates (per arm; all four required)

- **P1 margin**: held-out greedy compliance ≥ floor + 0.15
  (instruct ≥ **0.512**; base ≥ **0.253**).
- **P2 uncertainty**: per-moment paired bootstrap against that arm's floor
  run (same 58 moments, resample moments with replacement, 5,000 draws,
  seed 20260718): 95% CI lower bound of the compliance difference > 0.
- **P3 minimum absolute rate**: ≥ 0.30 (guards the base arm's low floor
  against a trivially small pass).
- **P4 safety non-inferiority**: leak-audit failure rate on held-out
  generations ≤ that arm's floor rate + 0.10.

If a variant's SFT run fails P1–P4, its single KTO run is licensed and
evaluated under the same gates; the variant's final licensed arm is
whichever ran last.

## 6. Blinded quality gate (per arm passing §5)

20 order-randomized pairs: the tuned arm's audit-passing held-out reply vs
the historical audit-passing original at the same moment (where the
historical delivery was an accepted original; else the nearest accepted
original in the same dialogue). Single-LLM reviewer, sonnet-class via the
isolated CLI bridge (single-reviewer instrument, disclosed as such;
randomization seed 20260718). **Fail = tuned dispreferred in ≥ 2/3 of
non-tie pairs** (the plan's template-collapse guard: passing form that reads
worse does not clear H-W).

## 7. Seam-review bar (frozen now; applied at the H5 offline bake-off, not
at Phase 4)

40 three-turn windows (20 containing one mini-generated turn, 20
all-frontier), judge answers whether any turn was spoken by a different
tutor (chance 0.5) plus a 1–5 continuity rating (descriptive). **Parity =
detection accuracy ≤ 0.65.** Runs only in the coupling-mode bake-off stage
conditional on a §5+§6 pass; frozen here so the bake-off inherits its bar.

## 8. Decision grammar

Within each variant ("trains" = final licensed arm passes §5 and §6):

| Result | Licensed reading |
|---|---|
| Passes §5+§6 | H-W supported at LoRA scale for this variant |
| Passes §5, fails §6 | Template collapse: form learned, voice lost — the §6.18 repair regression from the weight side; no promotion |
| Beats floor but fails P1/P2 | Partial parametric traction; bounded report; no second tuning round |
| ≈ floor | H-0 for this variant |
| Instrument failure (serving/merge fault, grader fault) | fix instrument, re-run same frozen config; no verdict from the faulty run |

Cross-variant (plan §9's iron-cage table, bound to the definitions above):
base-not-instruct → alignment-layer localization; both → incumbents were
never binding; neither → the gap exceeds adapter-scale change; escalation
requires a new document.

Additional bound observation (pre-registered as descriptive, not a gate):
whether the base arm reaches **0.362** — the level the incumbent alignment
layer provides for free — sharpens the iron-cage reading either way.

## 9. Out of scope under this document

Task B (first-draft contract), the coupling-mode bake-off execution (H5
stage 2 — separate short addendum when licensed), live Phase 5, dataset v2,
any additional seeds, arms, or hyperparameter variation. Results land in the
plan's revision log, the board card, and a §7.12-adjacent paper addendum
with the usual claim audit.

## 10. Deviations and results

None at freeze. No training call has been made. *(Results addendum lands
here after the licensed runs.)*

### Amendment 1 (2026-07-19): offline coupling probe licensed without a solo pass

H5's sequencing made the coupling-mode comparison conditional on a §5+§6
pass; neither SFT arm passed. This amendment licenses ONE offline
protected-span probe anyway, on stated evidence the freeze did not
anticipate: the failure anatomies are complementary and now measured — the
tuned instruct arm nearly solved the warrant cue (held-out failures 19→6;
dev 22→3) with conduct broadly intact (+0.103 net, "partial traction" under
§8), while the frontier family's Step 4 profile is the mirror (conduct
intact, cue-poor), and the tuned base arm shows the cue trains but conduct
collapses without an incumbent alignment layer. Probe design, frozen before
execution:

- Moments: the same 58 held-out warrant_skip moments, greedy only.
- Span source: the tuned instruct arm's already-generated held-out replies
  (`tuned-sft-instruct-v2-q8-ollama.json`); the protected span = the reply's
  question sentence(s), extracted deterministically (sentences terminating
  in `?`). Replies with no question → no span → fallback (below).
- Composer: one sonnet-class frontier call per moment via the isolated CLI
  bridge (safe-mode-v1), given the identical tutoring context plus the
  instruction to compose the turn around the span verbatim, add no other
  question, and introduce no new case facts. The instruction is best-effort;
  the checks are load-bearing (H4).
- Fail-closed: composed turns failing span-verbatim containment fall back to
  the mini's own unpolished reply, which is graded instead (the polish
  cannot lower the floor).
- Grading: the same frozen grader on the delivered (composed-or-fallback)
  texts; primary readout = held-out greedy compliance beside three context
  lines (tuned solo 0.414, same-lineage floor 0.310, frozen bar 0.460) —
  exploratory tier, NO H-W claim, no gate; the probe informs only the
  Phase 5 coupling decision and the KTO-spend decision.
- Cost bound: ≤65 frontier calls, one attempt, no prompt iteration.

The KTO runs remain licensed and unspent (both SFT arms failed §5); Lambda
access is unavailable for ~24h at amendment time, which sequences this probe
first. No other term of the freeze changes.

### Results addendum (2026-07-19; runs sealed, frozen rules applied)

Both licensed SFT runs executed on one Lambda H100 (~US$8 total; run records
and logs archived with the adapters). Evaluation survived four instrument
faults, each caught by a standing check before any wrong number was
accepted: a partial file copy; the converter dropping the speed-only MTP
layer while metadata still promised it (loader refusal); silent no-op merges
from a model-class mismatch (PEFT attached fresh empty adapters — exposed by
95% byte-identical base outputs and repaired with a merge that asserts
nonzero weight deltas before saving); and ~5 points of GGUF build-lineage
noise, removed by re-measuring the instruct floor through the same
conversion pipeline as its tuned model (0.362 library-build → 0.310
same-lineage; the §5 bar recomputes to 0.460 from the same-lineage floor
per the §8 instrument-failure row).

**Verdicts (held-out greedy, n=58, same-lineage pairs):**

- **SFT-instruct: 0.414 vs floor 0.310** (+0.103; paired bootstrap CI95
  [−0.017, +0.224]; bar 0.460). P1 FAIL, P2 FAIL, P3 PASS, P4 PASS —
  **partial parametric traction** (§8 row 3). The trained skill's core
  nearly resolved: warrant-cue failures 19→6 held-out (22→3 dev) with
  conduct broadly intact (guardOk 0.72→0.67). The residual miss is question
  discipline and premise handling.
- **SFT-base: 0.103 vs floor 0.103** (flat). P1–P3 FAIL; **P4 FAIL** (leak
  rate 0.138 vs floor 0.017+0.10). The cue trained equally strongly (43→9)
  but conduct collapsed (guardOk 0.52→0.19) — the §8-predicted thin-ego
  pathology, measured.
- **Cross-variant (iron-cage) reading — inverted**: the discipline trains
  into both variants' weights; what the incumbent alignment layer provides
  is not resistance but the stable conduct that lets the new move integrate.
  The cage is scaffold. (Neither arm passes, so no H-W claim; both KTO runs
  remain licensed and unspent.)
- **Amendment 1 coupling probe**: composed-alone 0.293 (the frontier
  composer re-adds extra questions even under explicit instruction — the
  checks, not the instruction, carry the design, as H4 predicted);
  **fail-closed system 0.448** (+0.034 over the tuned mini solo; 2 rescued
  moments; never below the mini by construction). Context: the frontier
  tutors' own live compliance at these exact moments was **0.276** — the
  fail-closed committee nearly doubles it (deployment-relevant, offline
  caveat: single-turn regeneration; live coverage cost and seam unmeasured,
  which is precisely Phase 5's question).
- **Structural ceiling note (interpretive, not a gate change)**: 14/58
  held-out moments carry a due premise release and are non-compliant by
  construction under the frozen `released == 0` component; the achievable
  ceiling is ≈0.759. Against achievable moments: tuned solo ≈55%, committee
  ≈59%.

One further tuned-base behaviour, surfaced by the claim audit and disclosed
as part of the result: empty generations on exactly the 14 held-out moments
drawn from compiled-constraint dialogues (untuned floor: 0/58) — a
training-induced degenerate mode on one prompt family, consistent with the
thin-ego collapse; empty replies grade non-compliant in the stated
denominators.

Results manifest (artifact SHAs + headline numbers):
`config/adaptive-tutor-evidence/program-2-phase4-results.manifest.json`.
Paper landing: §6.20.

### Amendment 2 (2026-07-21) — KTO forced corrections at first execution

The licensed KTO runs (both variants) hit two execution impossibilities on
their first real launch; each correction is the minimal change that
preserves every preservable frozen value, applied before any KTO result
exists:

1. **Batch geometry.** TRL's `KTOTrainer` refuses `per_device_train_batch_size=1`
   (the KL term degenerates to the implied reward). Corrected 1×8 → 4×2,
   preserving the frozen effective batch of 8; lr 5e-6, 1 epoch, seed
   20260718, and the data file (sha d8e29db8…) unchanged.
2. **Model class.** The frozen script loaded `AutoModelForCausalLM`, but the
   SFT adapters it must start from carry the VLM-class module tree
   (`base_model.model.model.language_model.*`, 496/716 keys) — loading
   through the causal-LM tree silently attaches fresh zero adapters (the
   §10 no-op-merge failure, recurring at the load boundary). Corrected to
   `AutoModelForImageTextToText` with a hard assertion that a trained
   `lora_B` in the `language_model` tree is nonzero after loading; the run
   aborts rather than trains-from-nothing on any future key mismatch.

Both corrections are stamped in the script header comments
(`scripts/program2-train-kto.py`) and were verified live: the assertion
passed and training stepped normally.
