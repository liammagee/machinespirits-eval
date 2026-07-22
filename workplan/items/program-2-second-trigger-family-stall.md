---
id: program-2-second-trigger-family-stall
title: "Program-2: second trigger family — stall-breaking specialist (stagnant_repeat)"
status: triaged
type: experiment
priority: P2
owner: unassigned
source: manual
created: 2026-07-22
updated: 2026-07-22
verification: "A stall-move specialist, SFT-trained on audit-labeled stagnant_repeat exhaust from the sealed archives under a fresh frozen prereg (own run licenses — the Program-2 ledger is spent), clears its frozen offline bars (floor+0.15 pattern on held-out stall moments under a deterministic stall-audit designed and frozen BEFORE training) and then a live committee-stall pilot passes E1s (CI > 0 vs silent controls) at the frozen guardrails, with the stall-density precondition met by a stall-enriched design."
claim_status: exploratory
links:
  paper: §6.21, §6.22, §7.12
  notes:
    - PROGRAM-2-FINETUNE-PLAN.md
    - PROGRAM-2-PHASE2-PREREGISTRATION.md
    - notes/program-2/2026-07-18-cloud-finetune-runbook.md
  items:
    - program-2-context-vs-weights-finetune
    - program-2-phase5d-second-transfer-world
tags:
  - tutor-stub
  - fine-tune
  - move-library
  - stagnant-repeat
  - lambda
milestone: adaptive-tutor-evidence-v1
---

The move-library's second book. 5c generalized the warrant specialist
across WORLDS (same move, new content — form not costume). This card
generalizes across MOVES: does the Program-2 recipe (sealed exhaust →
audit-labeled SFT → protected-span committee → fail-closed battery)
replicate for stall-breaking at `stagnant_repeat` moments, or was
`warrant_skip` special — the one move whose compliance rule happens to
compile to a crisp deterministic conjunction? A library with one entry
is a proof of concept; the second entry tests the manufacturing process.
YES this involves a new Lambda training run (Phase 4 below) — the local
MLX path crashed the workstation in Phase 1 and cloud H100 is the
established environment (~$8 for both Phase-3/4 SFT arms; expect
< US$15 here including idle).

Two facts frozen into this card's design, measured 2026-07-22:

1. **Density is the binding risk.** Live stall assignments run
   1.6–2.2/dialogue (Phase 5: 44/24, 5b: 28/18, 5c: 40/18) vs warrant's
   ~15–18 — a ~10:1 ratio, consistent with Step 4's stall channel dying
   under its density floor (7/8 blocks < 12; no stall verdict exists
   anywhere in the program, positive or negative). Feasibility gates
   come FIRST; the live pilot needs a stall-enriched design.
2. **SFT-only training.** The KTO close-out (2026-07-21, parent card)
   found both KTO runs byte-identical to SFT at the serving pin (58/58
   generations, CI [0.000, 0.000]) — the conditional-KTO rung is
   demonstrated inert at this scale and is NOT carried into this
   program. Also: the parent prereg's licensed-run ledger is fully
   spent (2 SFT + 2 KTO) — this card requires its OWN prereg with its
   own licenses; nothing here inherits authorization.

## Runbook (phase-gated; each paid/spend phase needs its own user go)

**Phase 0 — corpus + density inventory (zero-call, free).**
- Count `stagnant_repeat` moments and candidate source turns across ALL
  sealed archives: `~/.machinespirits-data/step4-claim-runs-2026-07/`
  (80 dialogues; T1 channel logged untreated) and
  `~/.machinespirits-data/program-2/phase5{-live-pilot,b-live,c-live}/traces/`
  (60 more dialogues; stagnant logged-only in every arm by frozen
  design — this is FREE training exhaust that accumulates with every
  future 5x run). Greps over `point_of_action_assignment` /
  `point_of_action_compliance` events by trigger; extend
  `scripts/program2-extract-live-moments.mjs` with a `--trigger` filter
  (built for warrant moments in the 5b remedy prep, commit 8a89a3d1).
- Corpus floor, frozen now: ≥ 100 audit-passing stall source turns
  required to license training (warrant taskA-sft had 141 rows; note
  the yield is unknowable until Phase 1's audit exists — inventory
  counts RAW moments here, yield lands in Phase 2).
- Deliverable: a dated note with the counts; go/no-go on the floor.

**Phase 1 — the stall audit (zero-call; the hard design step).**
- Define "handled the stall well" as a PURE FUNCTION over fields the
  sealed traces already carry, mirroring the warrant audit's shape.
  Sketch to refine: (a) action-family CHANGE — the turn's
  proposedActionFamily differs from the repeated family in
  previousActionFamilies (both already tracked by the detector /
  buildTutorStubPointOfActionTurn); (b) no undue premise release
  (released == 0, same component as warrant); (c) delivery guards pass;
  (d) DECIDE and freeze whether exactly-one-question is retained — it
  is what makes the protected-span mechanics reusable (span = question
  sentence); dropping it forces a new composition contract (see Phase
  6). Precedent: `strategy_shift_correctness` (§6.8 adaptive scorer) is
  the in-repo prior art for "did the tutor actually change strategy".
- Replay the audit over ALL sealed stall moments (zero-call): yields
  (i) the frontier's natural stall-handling pass rate = the future
  control reference, and (ii) the audit-passing source-turn count = the
  actual SFT corpus size vs the Phase-0 floor.
- Kill criterion, stated now: if no deterministic conjunction survives
  design review (every candidate needs a judge), CLOSE the card as a
  boundary result — "the library recipe requires deterministically
  auditable moves; stall-breaking is not one" — paper-worthy, cheap.

**Phase 2 — dataset + floors (local, free).**
- Extend `scripts/program2-extract-dataset.mjs`: emit
  `taskB-stall-sft` (audit-PASSING original stall turns; original-role
  model_call prompts only — repair-role prompts carry repair
  instructions; leak-clean filter), `eval-moments-stall` (held-out with
  sealed-trace pointers), splits by dialogue (frozen seed), manifest.
- Floors on held-out stall moments, greedy + sampled, at the SAME
  serving pin (chat shape, q8_0 same-lineage GGUF — the ~5pt
  build-lineage noise lesson): (a) untuned qwen3.5:9b-instruct; (b)
  **program2-sft-instruct-v2** — the warrant specialist's stall
  behavior is the cross-move interference measurement, interesting in
  BOTH directions (does warrant training help or hurt stall moments?);
  (c) frontier reference from the Phase-1 replay.

**Phase 3 — prereg freeze (user gate; no spend yet).**
`PROGRAM-2-STALL-PREREGISTRATION.md` pins: dataset SHAs + row counts;
the frozen training script (`scripts/program2-train-sft.py` adapted:
LoRA r=32 α=64 all-linear, lr 1e-4, 2 epochs, bf16, frozen seed);
serving pin; bars vs the Phase-2 floors (floor+0.15 paired-bootstrap
CI>0 + absolute minimum + leak non-inferiority — the Phase-2-prereg
pattern); blinded-quality gate (20 pairs, sonnet-class isolated
reviewer); licensed runs: ONE SFT (KTO excluded, inert per close-out);
decision grammar incl. cross-move interference rows and the composition
note — the detector assigns ONE trigger per turn (`assigned_trigger` is
exclusive by construction), so v1 needs NO arbitration logic, only the
activation-gate change.

**Phase 4 — Lambda training run (paid; the answer to "another Lambda
run?" is yes, exactly one).**
1. Launch an H100 instance (~$2–2.5/hr; the whole Phase-3/4 program
   cost ~$8 — budget < US$15 with idle).
2. Environment per `notes/program-2/2026-07-18-cloud-finetune-runbook.md`
   INCLUDING the late lessons: install pillow + torchvision (required
   by Qwen3.5's multimodal processor — 39576006), fla kernels optional;
   the model loads under the VLM class (the silent no-op-merge lesson:
   wrong model class merges without error and changes nothing).
3. `scp` the taskB dataset; run the frozen training script; ~20–25 min.
4. Download the adapter to a NEW directory
   (`~/.machinespirits-data/program-2/adapters-stall/` — check HANDOFF
   for any surviving ownership claims on `adapters/` first; the KTO
   session is closed but confirm).
5. VERIFIED merge with `scripts/program2-merge-adapter.py` at a05fa3c9
   (asserts lora_B + probe deltas — the Phase-4 fix that "never left
   the box" until the KTO session committed it).
6. Same-lineage GGUF q8_0 build; `ollama create program2-sft-stall-v1`;
   never build floors and verdicts on different GGUF lineages.
7. KILL THE INSTANCE (billing); archive the adapter + training log +
   manifest with sha256s.

**Phase 5 — offline verdict (local, free).**
Grade `program2-sft-stall-v1` on held-out stall moments vs the frozen
bars; blinded-quality 20 pairs. PASS → Phase 6. FAIL → the decision
grammar separates data-starved (corpus near the floor) from
move-not-trainable; either closes the offline question and the card
reports — no tune-and-retry from the freeze.

**Phase 6 — live wiring + committee-stall pilot (CLI quota; own go).**
- Stub change in a fresh isolated experiment worktree from then-current
  `main`: locate the committee activation seam by symbol (not an archived line
  number or SHA). Add a `--committee-triggers` flag
  (default warrant_skip — 5b/5c behavior byte-preserved), the stall
  activation instruction from the coaching service's sha-pinned
  `TARGET_TEXT.stagnant_repeat`, and the span/battery semantics frozen
  in Phase 1(d). Extend the zero-model fixtures
  (`runPhase5ZeroModelFixtures`) for the stall arm.
- Live design under the density constraint: committee-stall vs
  silent_control on world_005_marrick (home world of the exhaust). At
  1.6–2.2 stall-opps/dialogue, 10 committee dialogues yield ~16–22
  pooled opportunities — MARGINAL against a ≥15 floor; the prereg
  must either raise committee n to 14–16, or enrich stalls
  (affective_resistant-weighted matrix; the hethel-resistant family is
  stall-shaped if a world change is acceptable — but that confounds
  move-transfer with world-transfer; prefer more dialogues on marrick),
  and freeze the choice with the density math shown.
- Then the full 5b/5c launch discipline verbatim: prereg committed
  before any paid call → zero-model gate → ollama preflight → mini
  warm-up → sonnet+terra one-call probes (`claude auth status` first)
  → one paid smoke with GO criteria → sha-pinned attended launch with
  monitors, same-seed retry-once, 3-consecutive abort, HANDOFF
  begin/seal notes, push notifications at failures + completion.

**Phase 7 — close-out (pattern from 5c).**
Analyzer (5c analyzer adapted: trigger = stagnant_repeat, no costume
metric unless cross-world) → seam review (trim/stall texture must
re-demonstrate parity, not assume it) → archive
`~/.machinespirits-data/program-2/stall-live/` → manifest WITH
per-artifact sha256 blocks → results addendum → HANDOFF → workplan log
(this card + parent) → render/validate → pull/commit/push → paper fold
as its own commit with the claim-auditor pass.

Cost, total: Lambda < US$15 (one SFT run) + one evening CLI quota for
the live pilot + everything else local/free. Kill criteria are cheap
and early (Phase 0 floor, Phase 1 auditability), and every future 5x
run grows the stall corpus for free — a Phase-0 miss today is not
permanent.

2026-07-22 Codex: Removed the retired Phase 5 branch assumption. This remains a
triaged, separately licensed research program; if activated, it starts from a
fresh isolated current-main worktree and freezes that experiment's SHA. Archive
tags remain evidence provenance, not a maintained runtime.
