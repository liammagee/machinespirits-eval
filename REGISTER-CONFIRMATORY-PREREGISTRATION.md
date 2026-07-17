# Register Confirmatory — Pre-Registration (final-stretch Step 2)

Status: **FROZEN 2026-07-13 at launch go (block A).** Nothing below this line may change; results are appended under "Results" only. Workplan card: `workplan/items/tutor-stub-multiworld-policy-replication.md`. Plan: `PRECONSCIOUS-FINAL-STRETCH-PLAN.md` Step 2. The freeze commit is the launch SHA; block A runs only from it, and the run header's stamped provenance must match.

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
- **Version note (user directive, 2026-07-13):** gpt-5.6-terra is an incremental update over gpt-5.5, not a preview build. The general rule applied here (and in taking Sonnet 5 over 4.6 for block B): run capability studies on the latest available versions, so claims exercise current near-frontier capability rather than describing it in the rear-view mirror. Stamped run headers and the archive manifests carry reproducibility across any later CLI rotation.

## Endpoints and decision rules (binding at freeze)

- **Primary:** coverage at learner turn 16, estimated as policy × profile interaction contrasts per family (not a global policy ranking).
- **Secondary:** coverage/mastery/risk trajectory AUC over turns 1–16; until-grounded endpoint outcomes; post-probe recovery (window 4 after the turn-6 probe).
- **Pre-committed interpretation:** `bland` leading `diligent` is part of the predicted signature, not a failure. The claim under test is the crossing — stress profiles led by a variation arm while the compliant profile is led by bland.
- **Confirmed** (per family): a policy × profile interaction on the primary endpoint with bootstrap support (dialogue-level resampling within cells, 5,000 draws, seed 20260713), in the pre-declared crossing direction. Two-family confirmation licenses the claim: *profile-contingent mid-dialogue gains from register selection, at claimable n, on two model families, on a mechanical endpoint outside the slope-proxy regime*. One-family confirmation licenses only the stack-bounded form.
- **Null** (per family): no interaction at n=5. Nulls on both families close the register-policy line; the residue is the instrument plus the model-dependence finding, and the assembled-tutor capstone (Step 6) drops the register floor from its composition.
- **No tuning, no retries, no added arms or cells after freeze.** A technically failed dialogue (harness error, not learner behavior) is re-run with the same seed and logged; behavioral outcomes are never re-rolled.

## Execution shape

- Family block A: 60 dialogues, attended, checkpointed (exit-and-rerun across quota windows; the QA matrix resumes by cell). Block B identically in a later window. If quota forces triage, block A completes first in full — a half-run block is instrument-invalid.
- **Block A launch command (pinned at freeze; run seed 20260713):**

```bash
node scripts/run-tutor-stub-qa-matrix.js \
  --policies bland,field,negative \
  --profiles diligent,affective_resistant,false_memory,proof_skipper \
  --runs 5 --turns until-grounded --safety-turns 40 \
  --interleave-policies --pressure-turns 6 \
  --model codex.gpt-5.6-terra \
  --analysis-model codex.gpt-5.6-terra \
  --auto-learner-model codex.gpt-5.6-terra \
  --world world_005_marrick --run-seed 20260713 \
  --trace-dir .tutor-stub-auto-eval/register-confirmatory-terra-n5-live-2026-07-13 \
  --keep-going
```

  All other knobs at matrix defaults, matching the exploratory instrument (parallelism 6, cli-effort low, max-tokens 4096, history-turns 4, primary horizon 16, minimum effect 0.05).
- Launch from a clean committed SHA. Artifacts land in a fresh `.tutor-stub-auto-eval/register-confirmatory-<family>-n5-live-<date>/`; at completion each block is tar.gz-archived to `~/.machinespirits-data/runs/tutor-stub/` with a tracked manifest in `config/adaptive-tutor-evidence/` and distilled summaries in `exports/` (the Step 0.3 pattern).
- Estimated cost: ~1 attended quota day per family block.

## Results

To be appended below the freeze line after each family block, per the card's conventions. Paper landing: §6.17 material either way.

**2026-07-13 execution record — both blocks launched.** Block A (terra) launched from freeze commit `ad24d72c`, trace dir `.tutor-stub-auto-eval/register-confirmatory-terra-n5-live-2026-07-13`; provenance verified in-run (observed model `gpt-5.6-terra`, clean tree at the freeze SHA). Block B (Sonnet 5) launched same day on user go, same design and seed, command mirroring the pinned block-A command with `claude-code.sonnet-5` at all four seams, trace dir `.tutor-stub-auto-eval/register-confirmatory-sonnet5-n5-live-2026-07-13`. The two blocks run concurrently by design revision at go time: they draw on independent subscription pools (codex vs Claude), so the sequential-when-quota-shared rule does not bind across them. Design, cells, seeds, endpoints, and decision rules unchanged.

**2026-07-13 execution notes.** (1) Block B hit the Claude session limit at 01:22Z: its first two profile jobs (diligent, affective_resistant) completed on real turns and sealed; every `false_memory` and `proof_skipper` dialogue died at turn 0 against the limit and sealed as empty shells. Per the frozen technical-failure clause, the two dead jobs were quarantined (`*-dead-session-limit-0122Z/`) and re-run with identical commands and seed after the window reset — no behavioral row was re-rolled. (2) Block B's matrix process exited 1 on its final root-level verification because the dead jobs contributed no draw decisions; the per-job seals all verify. Block A completed exit 0 with its root run fully verified (1,233 events, 269 artifacts). A defect ticket for the matrix's root-verification behavior on failed jobs was spun off. (3) Block A ran to completion from the clean freeze SHA throughout; block B's re-run jobs execute while unrelated provenance-tooling edits land in the working tree — their dialogues' stamped `git.dirty` flags flip accordingly; the register-policy pipeline and harness code paths they exercise are unchanged.

### Family block A (gpt-5.6-terra) — RESULT, 2026-07-13

60/60 dialogues, all four profile jobs sealed, root run verified, observed model `gpt-5.6-terra` at every seam, freeze SHA `ad24d72c`, clean tree. Analysis validated against the sealed aggregates (12/12 cell means match) before bootstrap (dialogue-level within-cell resampling, 5,000 draws, seed 20260713).

Coverage at t16 (cell means, n=5):

| Profile | bland | field | negative |
| --- | --- | --- | --- |
| diligent | 0.500 | 0.467 | **0.667** |
| affective_resistant | 0.533 | **0.567** | 0.366 (0/5 grounded) |
| false_memory | 0.400 | 0.433 | **0.467** |
| proof_skipper | 0.433 | 0.366 | **0.533** |

Contrasts vs bland with 95% CIs: negative on diligent **+0.167 [+0.067, +0.267]**; negative on affective_resistant **−0.166 [−0.267, −0.033]**; all four field contrasts straddle zero. Interaction contrasts (stress minus diligent): negative × affective_resistant **−0.333 [−0.468, −0.167]**; all field interactions straddle zero. Crossing probability (per-profile leaders differ) **1.000**. P(bland leads diligent) **0.000**; P(negative leads diligent) 1.000; P(field leads affective_resistant) 0.593.

**Verdict under the frozen rule, applied strictly: the policy × profile interaction is CONFIRMED with bootstrap support, but NOT in the exact pre-declared direction.** The interaction is carried by `negative`, whose effect flips sign by profile (helps the compliant learner mid-dialogue, collapses on the affect-resistant one — 0/5 grounded, every dialogue riding the cap), reproducing the register-choice-has-profile-contingent-consequences result at claimable cell size. The pre-declared component "bland leads diligent" failed outright (P = 0.000) — under the probe-in-every-arm design, plain fixed tutoring never led the compliant profile; the exploratory diligent cells had no probe, so probe-context is the flagged (not concluded) candidate explanation. The `field` arm — the exploratory transfer candidate — confirms nothing at n=5 on this family: every contrast straddles zero; its one consistent edge is secondary (speed to ground: 26.2 vs 32.8 turns on false_memory, 29.4 vs 32.0 on affective_resistant, with perfect grounding on both). Secondary discounts: negative's diligent and proof_skipper leads carry hard-safety failures at t16 (2/5 and 2/5 fail) and elevated leaks (15 and 2); the affective collapse is total on the grounding channel. Family B's verdict pends its re-run jobs; the two-family claim assessment follows the frozen rules once both are in.

### Family block B (claude-code Sonnet 5) — RESULT, 2026-07-14

60 dialogues at n=5 per cell. Execution was interrupted five times by Claude session-window limits (see execution notes); the affective_resistant column was assembled from three sealed legs (original r1–r2, first resume r3 + bland/field-r4, a final top-up for negative-r4 + the r5 cells). **Deviation, documented:** the four top-up dialogues (negative-r4, bland-r5, field-r5, negative-r5) each ran turns 1–16 normally and produced a clean turn-16 assessment, then died at turns 16–18 when the window exhausted — a clock-driven, post-endpoint truncation independent of dialogue content. Because the primary endpoint is coverage at learner turn 16, these carry valid, unbiased primary measurements and are included. Their secondary until-grounded outcomes are unavailable and excluded. **The family-B verdict is invariant to this choice:** with the four excluded (affective at n≈4) no Sonnet contrast or interaction reaches bootstrap significance either. Analysis validated against sealed aggregates where a single-leg column exists; bootstrap identical to family A (within-cell, 5,000 draws, seed 20260713).

Coverage at t16 (cell means, n=5):

| Profile | bland | field | negative |
| --- | --- | --- | --- |
| diligent | 0.367 | **0.467** | 0.167 |
| affective_resistant | **0.233** | 0.233 | 0.100 |
| false_memory | 0.133 | 0.200 | **0.233** |
| proof_skipper | 0.200 | 0.200 | 0.167 |

Contrasts vs bland with 95% CIs: **every contrast straddles zero** (the strongest are negative-on-diligent −0.201 [−0.467, +0.067] and field-on-diligent +0.099 [−0.167, +0.367]). **No interaction contrast reaches significance** (the largest is negative × false_memory +0.301 [−0.066, +0.633]). Per-profile leaders still cross (field leads diligent and proof_skipper, bland leads affective_resistant, negative leads false_memory), so the rank-crossing *structure* is present, but at n=5 the floor-compressed Sonnet coverage (all cells 0.10–0.47 vs terra's 0.37–0.67) leaves wider CIs and no single arm's effect survives.

**Verdict under the frozen rule: on family B the policy × profile interaction is NOT confirmed with bootstrap support** — the structural rank-crossing appears, but no contrast or interaction clears the CI, so at n=5 Sonnet registers a null on the primary confirmatory endpoint. Notable directional facts (all CI-crossing, reported descriptively): `negative` is *last* on diligent (−0.201), the exact reversal of family A where it led diligent (+0.167*); `field` is the only arm never worst on any profile and leads two; Sonnet's whole coverage sits at the floor with poorer hard-safety across all arms.

### Two-family claim assessment (frozen rules)

The frozen decision rule: two-family confirmation (an interaction with bootstrap support, in the pre-declared crossing direction, on both families) licenses the general claim; one-family confirmation licenses only the stack-bounded form.

- Family A: a bootstrap-supported interaction is present (negative × affective_resistant −0.333*), but **not in the pre-declared direction** (it is carried by the hostile arm's sign-flip; the pre-declared "bland leads diligent" failed at P=0.000).
- Family B: **no bootstrap-supported interaction** (all CIs cross zero); the rank-crossing structure is present but underpowered at n=5 against the Sonnet floor.

**Therefore the two-family general claim is NOT licensed.** What the confirmatory establishes, stated at the strength the data support:

1. **The phenomenon is real and replicates in structure, not geometry.** Profile-contingent register effects — the rank-crossing signature — appear on both model families. This is the confirmed, twice-seen result.
2. **No specific policy or direction generalizes across families.** The carrier and sign are model-indexed: `negative` leads the compliant learner on terra and comes last on Sonnet; the only bootstrap-significant effects (family A's negative sign-flip) are stack-A-specific and do not replicate on Sonnet at n=5.
3. **The adaptive *selector* (`field`) confirms nothing on either family.** Its value, where any, is secondary (robustness/speed), never a coverage win. This is continuous with §6.3's adaptation null and §7.11's substitution law.
4. **Register choice has genuine, asymmetric consequences** (family A's hostile-arm collapse on the affect-fragile learner; Sonnet's uniformly poorer safety) — which argues for a per-model *contraindication guardrail* over a selector, the design Step 4 tests.

Bounds: single world (world-005-marrick), simulated learners under contract personas (no human-learning claim, costume caveat), fixed-horizon mechanical endpoint (escapes the §7.9 slope-proxy regime but is one operationalisation), n=5. Paper landing: §6.17.

**2026-07-14 execution notes (block B window deaths).** Block B's Sonnet runs were interrupted five times by session-window limits: (1) the original run died at 01:22Z leaving diligent + a partial affective and dead false_memory/proof_skipper; (2) false_memory recovered in a later window; (3–4) two full-column affective re-runs died mid-job (quarantined as `affective_resistant-dead-*`); (5) the 9-cell resume completed 5 cells then exhausted; a final 4-cell top-up landed the last cells as post-t16-death rows (above). Every dead dialogue was quarantined and re-run per the frozen technical-failure rule; no behavioral outcome was re-rolled. proof_skipper was also re-run whole after its window death. Two harness issues surfaced and were handled: the QA-matrix root-verification exit-1 on failed jobs (spun off as a fix task), and a `--resume-from` defect that rejected partial sources by demanding draw decisions from the rows it was about to re-run (fixed here with a draw-contract exemption threaded `buildResumePlan → verifyExperimentRun → replayRunRandomization` and regression-tested at both unit and end-to-end levels). The final 4-cell top-up was assembled via an unsealed merged resume manifest so exactly the 4 needed cells re-ran rather than a full 9.

### 2026-07-14 reproducibility correction — binding interpretation

The narrative above was written before the preregistered in-run profile gate
had been computed on the exact final 60 traces per family. The deterministic
archive analysis now lives at `scripts/analyze-register-confirmatory-step2.js`,
with the row declaration in
`config/adaptive-tutor-evidence/tutor-stub-register-confirmatory-final-selection.json`
and compact outputs under `exports/register-confirmatory-evidence/final/`.

The missing binding check changes the claim interpretation:

- Terra has average pairwise cosine `0.812` and max similarity to diligent
  `0.912`. It fails the frozen `<0.85` / `<0.90` gate and is instrument-invalid
  for an interaction claim. Its hostile-arm sign flip remains a descriptive,
  off-direction safety hypothesis only.
- Sonnet has `0.645` / `0.694` and passes the frozen cosine gate, but no primary
  contrast or interaction interval excludes zero. Its family result is null.
- Neither family confirms the predeclared direction because bland does not lead
  diligent. There is no one-family confirmation and no two-family claim. The
  earlier statements that the phenomenon was “confirmed,” “twice-seen,” or
  “replicates in structure” are superseded as claim conclusions. Rank crossings
  remain descriptive table geometry only.
- The richer current-contract checks are non-binding sensitivities: Terra fails
  false-memory observability and Sonnet fails proof-skipper observability.
- The four Sonnet affective top-up rows retain complete turn-16 endpoints.
  Excluding them leaves 56 rows and still yields no supported interaction. They
  remain excluded from until-grounded secondary outcomes.

The tracked bootstrap fixes the previously unspecified PRNG and traversal order
as Mulberry32 with within-cell resampling, 5,000 draws, seed `20260713`. It
reproduces every cell mean and support decision. A few percentile endpoints
differ by one discrete resampling step from the earlier untracked calculation;
the tracked JSON is authoritative because the freeze specified the seed and
resampling unit but not the PRNG implementation.

**Corrected strict verdict:** no family confirmation; no two-family claim; the
`field` selector is closed on this evidence. All single-world, simulated-
learner, whole-stack, and LLM-extractor bounds above remain in force.
