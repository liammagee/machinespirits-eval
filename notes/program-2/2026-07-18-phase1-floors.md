# Program-2 Phase 1 — offline grader + untuned floors (2026-07-18)

Plan: `PROGRAM-2-FINETUNE-PLAN.md` §8 phase 1 (as revised by HANDOFF H1:
per-variant floors under per-variant request shapes). Phase gate — "floors
measured; report written" — PASSES with this note. Zero paid model calls;
grading is deterministic throughout; generation is local.

## 1. The instrument

`scripts/program2-floor-grader.mjs` grades a candidate reply at a sealed
trigger moment by composing frozen machinery only: a Step 4-compatible
frozen-turn bundle (field mapping mirrored from
`services/tutorStubFrozenReplay.js`, with public-premise state reconstructed
from `release_pacing_committed` events plus the current turn's due releases),
`auditTutorStubFrozenCandidate` for the full response-guard stack, and
`auditTutorStubPointOfActionCompliance` (detector
`step4-frozen-2026-07-14.v1`). `guardsPassed` mirrors the runtime's exact
six-audit conjunction (`scripts/tutor-stub.js` ~13697), not the stricter
delivery decision.

**Instrument fidelity, measured by replaying all 645 sealed historical
moments through the grader against the recorded verdicts:**

- `warrant_skip`: verdict agreement **99.83%** (594/595; 1 flip)
- `stagnant_repeat`: verdict agreement **100%** (50/50)
- Residual divergence is confined to the `guards_passed` component
  (component-level agreement 77% on T2) and is *conservative* — the offline
  stack is stricter than the recorded runtime value in ~94% of divergent
  cases. Both tuned and untuned models face the identical grader, so the
  comparison is internally consistent; the slight strictness is disclosed
  for any reading against the archived frontier numbers.

## 2. The floors (120 warrant_skip moments: dev 62 + heldout 58; greedy and
sampled per moment; zero endpoint errors in all four runs)

Held-out greedy compliance (the primary floor cell), with dev in brackets:

| Model | Variant / shape | Held-out (dev) | guardOk | Dominant failing component |
|---|---|---|---|---|
| **qwen3.5:9b** | instruct, native chat | **0.362** (0.419) | 0.76 | exactly_one_question |
| qwen3.5:4b | instruct, native chat | 0.241 (0.403) | 0.72 | warrant_cue |
| qwen3:8b (prev. gen) | instruct, native chat | 0.121 (0.177) | 0.62 | warrant_cue (41/58) |
| qwen3.5-9b-base | base, flattened transcript | 0.103 (0.194) | 0.52 | warrant_cue (43/58) |

Decoding: greedy ≥ sampled in every model's primary cell. Family balance
(held-out greedy): the 9B instruct floor is even across speaking-tutor
provenance (sonnet-moments 0.38 / sol-moments 0.35); the smaller and older
models lean sonnet (4B: 0.31/0.15; old 8B: 0.16/0.08).

## 3. Readings (labeled; no claims)

1. **Generational jump.** One model generation at like-for-like scale tripled
   the floor (qwen3:8b 0.121 → qwen3.5:9b 0.362), and the older model fails
   exactly where the frontier models failed in Step 4 — the warrant cue. The
   latest-versions rule, measured: the drafting-time default base would have
   produced a dramatically flattering tuning contrast.
2. **Scale anatomy flip.** The 4B misses the cue (like the frontier); the
   current 9B has the cue but breaks question discipline (multiple
   questions). Scale buys the cue vocabulary before question restraint.
3. **Base ≪ instruct at floor (iron-cage pre-data).** The base sibling under
   its own shape floors at 0.103 vs its instruct sibling's 0.362 — at floor
   level the incumbent alignment layer *carries* the warrant move rather
   than suppressing it. H1's contest is therefore: can SFT on unoccupied
   ground (base) exceed what the incumbent provides for free, and can
   adapter training lift the instruct variant past its own incumbent
   ceiling? The predicted base-arm pathology (thin ego — executes poorly
   around the move) is already visible pre-training: base guardOk ≈ 0.5 vs
   instruct ≈ 0.66–0.76.
4. **The floors are high enough to discipline the thresholds.** The tuned
   instruct arm must clear a floor of 0.362, not the 0.1–0.2 the Step 4
   frontier numbers might have suggested.

## 4. Base-variant serving route (execution note)

MLX serving of the base model proved unusable for the floor (~8.8 min per
generation on ~10k-token prompts, single-threaded server wedged by aborted
requests). Route taken: `Qwen/Qwen3.5-9B-Base` bf16 → GGUF `q8_0`
(`llama.cpp convert_hf_to_gguf.py`) → ollama (`qwen3.5-9b-base-q8`),
~11 s/generation via `/api/generate` `raw:true`. Disclosure: the base floor
is served at q8_0 while the instruct floors are ollama-default Q4_K_M — a
precision asymmetry that, if anything, flatters the base floor; the Phase 2
prereg pins final serving engine and precision per arm. The base request
shape is the draft flattening template `program2-base-flatten.v1-draft`
(system prompt + `Learner:`/`Tutor:` transcript + trailing `Tutor:` cue,
stops at the next learner turn), stamped into the floor report; it freezes
at Phase 2 as part of the instrument. The MLX LoRA entrypoint is verified
(mlx-lm 0.31.3, mlx 0.32.0), but the local 10-example training smoke was
dropped after a workstation crash (training stacked on resident ollama
models exceeded RAM): the training stack-proof is deferred to the Phase 3
environment itself — the user-approved cloud GPU — which is the environment
any frozen run must demonstrate anyway.

## 5. Artifacts (machine-local, hashes tracked)

`~/.machinespirits-data/program-2/floor/`:

- `qwen3.5-9b-instruct-ollama.json` — sha256 `5d47b1ddee0eecd0…`
- `qwen3.5-4b-instruct-ollama.json` — sha256 `ffc08648dcb3e6a2…`
- `qwen3-8b-instruct-ollama.json` — sha256 `597470b5485f95be…`
- `qwen3.5-9b-base-q8-ollama.json` — sha256 `d1c09e7b4533a70c…`

Full hashes in `config/adaptive-tutor-evidence/program-2-floors-v1.manifest.json`.
Grader validation report alongside the datasets. Converted models:
`~/.machinespirits-data/program-2/models/` (MLX 4-bit base, GGUF q8_0).

## 6. Next (gated)

Phase 2 prereg freeze — must carry, per the plan and HANDOFF: per-variant
request shapes (freeze the flattening template), per-variant training order
and licensing, thresholds set against §2's floors (pass margin, minimum
absolute rate, blind-review non-inferiority, seam-detection rate), the
cross-variant iron-cage grammar, and the serving engine/precision pin.
Training only after the freeze and an explicit user go.
