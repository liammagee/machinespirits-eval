# Register Confirmatory — Pre-Registration (final-stretch Step 2)

Status: **DRAFT, 2026-07-13 — not frozen.** Freezing happens at launch go: this file's Status line flips to FROZEN with the launch date and commit SHA, after which nothing below may change. Workplan card: `workplan/items/tutor-stub-multiworld-policy-replication.md`. Plan: `PRECONSCIOUS-FINAL-STRETCH-PLAN.md` Step 2. No dialogue for this experiment may run before the freeze commit exists.

## Question

Do register policies produce profile-contingent mid-dialogue progress effects — policy × profile rank crossings at fixed horizons — at claimable n, on both model families, on mechanical fixed-horizon endpoints? This confirms (or closes) the arc's one replicated exploratory positive (`PLAN_4_0/2026-07-10-headroom-fixed-horizon-interactions.md`: crossings at n=3 on gpt-5.6-terra, structure replicated on Sonnet 5, no single policy carrying the effect).

## Design (binding at freeze)

- **Arms (3):** `bland` (fixed control), `field` (hand-coded control law; the only arm never behind bland on terra and leading two stress profiles on Sonnet), `negative` (hostile floor; its profile-dependent collapse is part of the predicted signature).
  `dynamic` is excluded from claim-bearing arms — its non-transfer is already a two-model result (terra's best stress arm, Sonnet's worst: endpoint closure 0.083 vs bland 0.667). No diagnostic cell is purchased; the exclusion stands as a documented negative.
- **Profiles (4):** `diligent` (compliant control), `affective_resistant`, `false_memory`, `proof_skipper` — v3 learner-profile contracts, unmodified.
- **n:** 5 per policy × profile cell. 60 dialogues per family block; 120 total.
- **World:** world-005-marrick with headroom-suite settings (until-grounded with binding `--safety-turns 40`).
- **Controls:** deterministic policy interleaving (`--interleave-policies`); pre-declared face_threat pressure probe at learner turn 6 in every arm (`--pressure-turns 6`); outcome-only scoring (register diversity reported as a separate process column only); seeded policy draws (Step 0.1) and stamped run headers (Step 0.2) in force.
- **In-run manipulation check:** the v3 profile-discrimination gate (pairwise cosine < 0.85, max-to-diligent < 0.90) is computed on THIS run's own cells per family block. A family block whose gate fails is reported as instrument-invalid for interaction claims (its rows are kept, labeled), not silently pooled.

## Model assignment (the four seams)

| Seam | Flag | Family block A (runs first) | Family block B (second window) |
| --- | --- | --- | --- |
| Tutor | `--model` | `codex.gpt-5.6-terra` | `claude-code` Sonnet 5 |
| Automated learner | `--auto-learner-model` | `codex.gpt-5.6-terra` | `claude-code` Sonnet 5 |
| Turn classifier | `--analysis-model` → classifier | `codex.gpt-5.6-terra` | `claude-code` Sonnet 5 |
| Learner-record (DAG extractor; source of the coverage endpoint) | `--analysis-model` → learner-record | `codex.gpt-5.6-terra` | `claude-code` Sonnet 5 |

Rationale, binding at freeze (amended 2026-07-13 after review — block A moved from `codex.gpt-5.5` to `codex.gpt-5.6-terra`):

- **Codex first** (user direction 2026-07-13), and specifically **terra, because a confirmation holds the instrument fixed.** The exploratory crossings being confirmed were measured on gpt-5.6-terra, and the arc's own headline finding is that policy effects are model-dependent — so confirming on a different codex model would make a null uninterpretable (effect not real vs effect terra-specific). A terra null at n=5 is a clean kill; a terra pass plus a Sonnet pass exactly reproduces the two exploratory stacks at claimable n, which is what confirmation means. The v3 profiles are also gate-validated on terra (pooled cosine 0.737) and Sonnet (0.565) but never on gpt-5.5, so terra minimizes the risk of buying a block that the in-run gate then declares instrument-invalid. Terra's bug-tainted provenance history is not a design argument: the flag-forwarding bug is fixed, `gpt-5.6-terra` is listed live in `config/providers.yaml` (CLI-probed 2026-07-12, codex 0.144.1), and model identity is verified from `run_start` provenance and `model_observed` events, never from the requesting flag.
- **Rejected alternative, recorded:** `codex.gpt-5.5` (the standing default stack) was the draft's original block A. Rejected for confirmation because no profile gate has ever passed there and a null would be stack-ambiguous. It remains the natural *generalization* block: an optional Step 2b (own go, after a confirmed effect), not part of this design.
- **Per-block monoculture is deliberate:** all four seams run the same family within a block, matching the exploratory runs this design confirms (changing seam assignments would change the instrument mid-confirmation). The known caveat — the record extractor scoring its own family's dialogues — is carried unchanged and is exactly what the second family block checks.
- **There is no judge seam:** outcomes are computed by the harness from grounding, closure, coverage, and leak discipline; no rubric LLM is involved.
- **Rotation note:** terra is a preview-generation model and may leave the CLI sooner than 5.5; stamped run headers, the sealed artifacts, and the archive manifests carry reproducibility if it does.

## Endpoints and decision rules (binding at freeze)

- **Primary:** coverage at learner turn 16, estimated as policy × profile interaction contrasts per family (not a global policy ranking).
- **Secondary:** coverage/mastery/risk trajectory AUC over turns 1–16; until-grounded endpoint outcomes; post-probe recovery (window 4 after the turn-6 probe).
- **Pre-committed interpretation:** `bland` leading `diligent` is part of the predicted signature, not a failure. The claim under test is the crossing — stress profiles led by a variation arm while the compliant profile is led by bland.
- **Confirmed** (per family): a policy × profile interaction on the primary endpoint with bootstrap support (dialogue-level resampling within cells, 5,000 draws, seed 20260713), in the pre-declared crossing direction. Two-family confirmation licenses the claim: *profile-contingent mid-dialogue gains from register selection, at claimable n, on two model families, on a mechanical endpoint outside the slope-proxy regime*. One-family confirmation licenses only the stack-bounded form.
- **Null** (per family): no interaction at n=5. Nulls on both families close the register-policy line; the residue is the instrument plus the model-dependence finding, and the assembled-tutor capstone (Step 6) drops the register floor from its composition.
- **No tuning, no retries, no added arms or cells after freeze.** A technically failed dialogue (harness error, not learner behavior) is re-run with the same seed and logged; behavioral outcomes are never re-rolled.

## Execution shape

- Family block A: 60 dialogues, attended, sequential, checkpointed (exit-and-rerun across quota windows; the QA matrix resumes by cell). Block B identically in a later window. If quota forces triage, block A completes first in full — a half-run block is instrument-invalid.
- Launch from a clean committed SHA. Artifacts land in a fresh `.tutor-stub-auto-eval/register-confirmatory-<family>-n5-live-<date>/`; at completion each block is tar.gz-archived to `~/.machinespirits-data/runs/tutor-stub/` with a tracked manifest in `config/adaptive-tutor-evidence/` and distilled summaries in `exports/` (the Step 0.3 pattern).
- Estimated cost: ~1 attended quota day per family block.

## Results

To be appended below the freeze line after each family block, per the card's conventions. Paper landing: §6.17 material either way.
