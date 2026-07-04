---
id: strategy-ledger-model-confound-smoke
title: Model-confound smoke — is codex ceiling-ing the outer-loop effects? (GLM-5.2)
status: done
type: experiment
priority: P2
owner: unassigned
source: manual
created: 2026-07-04
updated: 2026-07-04
branch: worktree-strategy-ledger-followups
verification: "4 canary-gated GLM-5.2 runs complete (or an instrument-limited stop is recorded); the pre-stated read-rules below produce a go/no-go on whether a powered cross-model contrast deserves a new pre-registration."
claim_status: exploratory
links:
  notes: PLAN-MODE-STOCKTAKE-PREREGISTRATION.md
  items:
    - plan-mode-stocktake
tags:
  - adaptive-tutor
  - derivation
  - outer-loop
  - model-confound
  - smoke
---

Operator concern (2026-07-04): every strategy-ledger and plan-mode result was
measured with a codex (gpt-5.5-class) inner loop — a model possibly strong
enough that its implicit per-turn re-planning ceilings out any explicit outer
loop. The scaffolds-substitute-for-capacity hypothesis predicts the effects
could invert on a weaker model. This smoke asks the SMALLEST version: does
the model materially change the picture?

**Design (exploratory smoke — no promotion claims, no prereg needed, read
rules stated here BEFORE the data):** `openrouter`/`glm5_2` (z-ai/glm-5.2),
`world-010-hethel-resistant`, the plan-mode arm pair on seeds 31 and 37 —
the SAME seeds as the codex plan-mode matrix, giving within-seed cross-model
comparators (codex: baseline r1 grounded T*=20, r2 aporia 27; plan-mode r1
disengagement 27, r2 aporia 27). Four runs total (baseline-r1 canary →
plan-mode-r1 → baseline-r2 → plan-mode-r2), sequential, canary-gated.

**Pre-stated read rules:**

1. **Instrument gate (canary):** baseline-r1 must produce a complete,
   parseable drama (result.json present; ≥5 releases on the record;
   non-empty tutor/learner dialogue). Failure → recorded as
   instrument-limited on this model; stop; the confound question stays open
   but untestable on this stack without adapter work.
2. **Cost gate:** canary cost > $0.40 → stop (projected 4-run total > $1.60).
3. **Confound signal (go for a powered cross-model contrast):** BOTH (a)
   GLM baseline differs markedly from codex baseline on the same seeds
   (different failure texture = the model matters to the floor), AND (b) the
   plan-mode minus baseline direction on T*/grounded is at least as
   favorable as codex's. One of the two alone = ambiguous → default no-go.
4. n=2/arm is directional color ONLY. Whatever happens, the outer-loop
   line's closure stands; a go here means proposing a NEW pre-registration
   (cross-model, grounded-primary, powered), an operator decision.

2026-07-04 Claude: SMOKE STOPPED AT THE INSTRUMENT GATE (read-rule 1). The
canary (glm-baseline-r1, seed 31) died at turn 2: the learner role returned
no parseable JSON object twice (bridge retry included) against the standard
learner contract prompt. No result.json produced; cost negligible (~2 turns
of calls). RECORDED: instrument-limited on GLM-5.2 — the derivation
harness's strict JSON role contracts assume a format-reliable model, so the
codex-ceiling confound question stays OPEN but is untestable on this model
without adapter work (tolerant extraction / format-repair retries).
Paths forward (operator choice, none taken): (a) one canary retry to rule
out single-shot flakiness (~$0.05); (b) adapter work, then retry GLM; (c)
run the same 4-run smoke on a weaker-but-format-proven model — gemini-flash
already ran the full Phase-3 matrix at 100% commitment coverage, making it
the zero-adapter candidate for the same question; haiku/gpt-mini untested.
Note the instrument result itself bears on the confound hypothesis: part of
what 'a strong model' buys this stack is bare protocol compliance.

2026-07-04 Claude: RE-RUN ON GEMINI-FLASH per operator direction (same
design, seeds, gates). Instrument gate PASS (8/8 releases all runs; stock-take
fully live). RESULT — GO SIGNAL under the pre-stated rules: (b) plan-mode
2/2 grounded (T*=21,21) vs baseline 1/2 on flash, where codex same-seeds gave
plan-mode 0/2 vs baseline 1/2 — direction far more favorable on the weaker
model; (a) per-seed outcome INVERSIONS on both seeds (codex grounded where
flash disengaged and vice versa) = the model matters to individual
trajectories, though aggregate floors match (1/2 each). Mechanism color:
flash demanded 5-6 corrections/run (all answered) vs codex's sparse rate —
the weaker inner loop uses the second voice more. n=2/arm = directional
only (rule 4): licenses PROPOSING a powered cross-model contrast
(model × arm, interaction-primary: does plan-mode help the weak inner loop
more?), a new pre-registration awaiting operator sanction. Cost ~$0.30.
