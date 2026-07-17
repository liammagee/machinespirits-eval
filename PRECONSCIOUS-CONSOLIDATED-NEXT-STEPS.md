# Preconscious Arc — Consolidated Closeout and Next-Steps Plan

Status: **operative recommendation, 2026-07-14**. This document consolidates
Claude's stock-take, final-stretch plan, register-confirmatory preregistration,
result notes, workplan cards, and the repository state after the latest commits.
It is the execution guide from the current checkpoint onward. It does not alter
the frozen preregistration or retroactively change a result.

No further paid/model-backed experiment is authorized by this document alone.
The zero-call evidence repair, reproducibility, implementation, and workplan
closeout tranche is complete. The next possible experiment is the frozen paid
Step 4 contrast, which still requires a separate explicit go.

Execution update (2026-07-14): the zero-call evidence/Git closeout is complete,
the strict Step 2 result has landed in canonical Paper 2.0 §6.17 and atlas
module `register-selection-boundary`, and the Step 4 trigger audit plus frozen
successor pre-registration are complete. The Step 4 arms/detectors and the
balanced 80-dialogue launcher are implemented, and the zero-model gate passes.
Step 4 has **not** launched; paid execution still requires a separate explicit
go. The supposedly stalled unreliable-learner preregistration was already
complete (12/12), reproducibly scored, and folded into Paper §6.13.7; its
preregistration and workplan status are now reconciled with that evidence.

## 1. Sources and precedence

Use these as linked evidence and historical rationale; do not duplicate or
silently amend them:

- `PRECONSCIOUS-FINAL-STRETCH-PLAN.md` — original Steps 0–6 and stop rules.
- `PLAN_4_0/2026-07-13-preconscious-arc-stocktake-and-final-stretch.md` —
  argument behind the final stretch.
- `PLAN_4_0/2026-07-13-adaptive-state-v24-results.md` and
  `exports/adaptive-state-v24/` — completed Step 1 result.
- `REGISTER-CONFIRMATORY-PREREGISTRATION.md` — frozen Step 2 design and appended
  results; it remains the historical preregistration record.
- `PLAN_4_0/2026-07-13-register-confirmatory-family-a-reading.md` — Terra-only
  interim interpretation, now bounded by the completed two-family audit below.
- `config/adaptive-tutor-evidence/tutor-stub-register-confirmatory-*.manifest.json`
  and `exports/register-confirmatory-evidence/` — packaged Step 2 evidence.
- `workplan/items/tutor-stub-multiworld-policy-replication.md`,
  `workplan/items/tutor-stub-side-coaching-gate.md`,
  `workplan/items/field-planner-phase6-gate.md`,
  `workplan/items/unreliable-learner-prereg-completion.md`, and
  `workplan/items/tutor-stub-transition-reward-model.md` — live work units.
- `GREEN-ROOM-PLAN.md` and `notes/2026-07-12-greenroom-gate1-diagnosis.md` —
  failed standing-book channel and the point-of-action coaching rationale.

Precedence for future decisions:

1. Frozen preregistration and sealed artifacts.
2. Reproducible derived analyses from explicitly selected final rows.
3. This operational synthesis.
4. Interim notes and chat summaries.

## 2. Current repository checkpoint

### Completed

- Step 0, immutable provenance: commit `069e1404`.
- Step 1, adaptive-state v2.4: commit `2efd9415`.
  - The v2.3 estimator failure is classified `data_starved`.
  - An exact dynamics-aware filter recovers the latent kernel state under both
    fixed and information-optimal schedules.
  - Active sensing adds no channel capacity on the authored substrate.
  - Frozen verdict: `close_sensor_program_on_substrate`, correctly glossed as
    **transparency, not concealment**.
- Harness/runtime hardening:
  - `e159a827`: incomplete QA-matrix roots seal truthfully and verify in
    integrity-only mode.
  - `ae757e79`: expanded pacing, profiles, interactive and curriculum tooling.
  - `491d5fbf`: full public role-history replay.
  - `2e00a596`: prompt/world/response-contract hardening.
  - `f931d808`: dramatic clue-release behavior.
- Step 2 execution: 60 Terra and 60 Sonnet dialogues were collected; result and
  workplan closeout were consolidated in `9997cc26`.
- Resume-integrity hardening: commit `8db79b96` resumes sealed failed rows while
  preserving the integrity requirements for retained rows. Its focused tests
  and the full repository suite pass.

### Current Git and validation handoff

- Branch `preconscious` is clean and two local commits ahead of
  `origin/preconscious`; they are not pushed by this closeout.
- `092cf672` contains the frozen Step 4 implementation, response-composition
  integration, hermetic test default, canonical-data wrapper, and idempotent DB
  closeout/preflight.
- The documentation closeout records the Step 4 launch lock and the completed
  unreliable-learner result.
- The full hermetic suite passes 5,539 tests with zero failures and one skip;
  lint passes, the focused combined suite passes 73/73, the workplan validates
  118/118, and `npm run merge:preflight` passes.
- The three tracked Sonnet summary blobs are 150–187 MB each, are ordinary Git
  text blobs rather than LFS pointers, and exceed
  [GitHub's enforced 100 MB single-object limit](https://docs.github.com/en/repositories/creating-and-managing-repositories/repository-limits).
  The local Step 2 commits therefore cannot be pushed in their current history
  shape.
- The tracked Sonnet `qa-matrix.json` / `.md` are stale partial-run reports:
  they still show failed `false_memory` and `proof_skipper` jobs rather than the
  completed/repaired 60-row dataset.
- The tracked Sonnet distillation omits a canonical
  `affective_resistant-auto-eval.json`; those rows are distributed across three
  sealed/resumed legs and a post-turn-16 top-up.
- No tracked Step 2 profile-discrimination report or reproducible interaction
  bootstrap artifact exists. The result prose currently carries numbers that
  cannot be regenerated from the tracked compact files alone.
- The canonical paper has not yet landed the proposed §6.17 result.
- Two workplan facts are stale:
  - `tutor-stub-learner-state-validity` remains `active` after the sensor
    program was closed.
  - `tutor-stub-multiworld-policy-replication` is `done` but still has
    `claim_status: planned`.

## 3. Critical review of Terra versus Sonnet

### 3.1 Primary endpoint as observed

Coverage at learner turn 16, n=5 per cell:

| Stack / profile | bland | field | negative |
| --- | ---: | ---: | ---: |
| Terra — diligent | 0.500 | 0.467 | 0.667 |
| Terra — affective resistant | 0.533 | 0.567 | 0.366 |
| Terra — false memory | 0.400 | 0.433 | 0.467 |
| Terra — proof skipper | 0.433 | 0.366 | 0.533 |
| Sonnet — diligent | 0.367 | 0.467 | 0.167 |
| Sonnet — affective resistant | 0.233 | 0.233 | 0.100 |
| Sonnet — false memory | 0.133 | 0.200 | 0.233 |
| Sonnet — proof skipper | 0.200 | 0.200 | 0.167 |

The raw means support three descriptive observations:

1. `field` has no supported primary-endpoint advantage on either stack.
2. Terra's only bootstrap-supported interaction is carried by the fixed hostile
   floor, not an adaptive selector: `negative` improves diligent coverage and
   harms affective-resistant coverage.
3. Sonnet is lower across the whole grid and yields no supported contrast or
   interaction. Its leader pattern contains ties; “field leads two profiles”
   should not be reported as a unique two-profile win.

### 3.2 Strict preregistered verdict after the missing in-run gate

The preregistration required each family to pass its own profile-discrimination
gate: average pairwise cosine < 0.85 and max similarity to `diligent` < 0.90.
It also said a failing block is instrument-invalid for interaction claims.

A read-only analysis over the explicit final 60 trace paths per family gives:

| Family | Average pairwise cosine | Max to diligent | Frozen cosine gate | Interaction result |
| --- | ---: | ---: | --- | --- |
| Terra | 0.812 | 0.912 | **fail** | off-direction hostile-arm interaction |
| Sonnet | 0.645 | 0.694 | pass | no supported interaction |

The current richer contract-conditioned analyzer is stricter still: Terra also
misses `false_memory` observability, while Sonnet misses `proof_skipper`
observability. Those checks were not stated as the two binding thresholds in
the frozen Step 2 prose, so they are sensitivity findings rather than a
retroactive decision rule.

The correct Step 2 conclusion is therefore:

- **Terra does not confirm the preregistered family claim.** The effect is in
  the wrong direction and the block fails its binding manipulation gate. The
  hostile-arm sign flip is a descriptive, stack-bounded safety hypothesis.
- **Sonnet does not confirm the preregistered family claim.** Its binding
  cosine gate passes, but every primary contrast and interaction interval
  crosses zero.
- **The two-family general claim is rejected.** “Rank crossings replicate in
  structure” is descriptive pattern language, not confirmation. Rank crossings
  in a noisy 12-cell table are insufficient without the preregistered supported
  geometry.
- **No one-family positive is licensed.** Terra is neither an in-direction
  confirmation nor instrument-valid under the frozen gate.
- **The `field` selector is closed on this evidence.** Do not rehabilitate it
  from speed-to-ground secondary outcomes or from the fact that it is rarely
  worst.

### 3.3 What remains usable

- The action/register palette can still be used as an implementation
  vocabulary.
- A hostile-register contraindication is a reasonable hypothesis because the
  Terra affective cell collapsed and hostile upside carried safety/leak costs.
  It is not yet a cross-family rule and must not be described as validated.
- The profile instrument works better on Sonnet by the frozen cosine criterion
  than on Terra, despite Sonnet's lower endpoint range. This reinforces that
  endpoint level and profile separability are different properties.
- Step 2 is still valuable as a clean negative for general register selection
  and as a provenance/harness stress test.

### 3.4 Bounds that must travel with any write-up

- “Terra versus Sonnet” changed tutor, automated learner, classifier, and
  learner-record extractor together. It is a whole-stack comparison, not an
  isolated tutor-model effect.
- Coverage is mechanically aggregated but comes from an LLM learner-record/DAG
  extraction seam. The large cross-stack level difference may reflect tutor
  behavior, learner behavior, extractor calibration, or their interaction.
- Single world (`world_005_marrick`), simulated contract learners, n=5, and one
  operational fixed-horizon outcome; no human-learning claim.
- Four Sonnet affective rows ended after the primary turn-16 assessment but
  before full secondary closure. They are usable for the primary endpoint with
  the documented sensitivity exclusion, not for until-grounded outcomes.
- Recent runtime commits materially changed history replay, prompts, guards,
  pacing, and clue presentation after the Step 2 freeze. Future arms need a new
  common freeze and cannot use Step 2 cells as concurrent controls.

## 4. Decisions now

1. **Stop the register-selector line.** No Step 2b GPT-5.5 block, no `dynamic`
   rehabilitation, no additional policy variants, and no Sonnet n-increase to
   rescue the observed table.
2. **Do not launch the transition/reward-model card.** Step 2 is one-world,
   lacks a validated adaptive action effect, and is not a claim-grade
   multi-world transition dataset.
3. **Close the learner-state sensor card.** The v2.4 result is complete; policy
   optimization, Phase 6B reconstructed-state work, and shadow-pilot promotion
   remain blocked.
4. **Defer Phase 6A.** It is a separate privileged-state actuator question,
   but it has lower information value than repairing Step 2 and testing the
   point-of-action channel. Do not spend its canary/k5 quota yet.
5. **Do not create the Step 6 capstone card yet.** There is currently no
   validated sensor or register selector to compose. A capstone becomes
   meaningful only if Step 4 and/or the stalled explicit slip channel survive.
6. **Make Step 4 the next scientific gate, but revise its controls before
   freezing.** The strongest remaining hypothesis is externalized recognition
   at the point of action, not an inferred learner interior.

## 5. Execution plan

### Phase A — Zero-call evidence and Git closeout (P0)

#### A1. Resume-integrity patch — completed in `8db79b96`

- Preserve the four-file dirty set exactly.
- Run:

  ```bash
  node --test services/__tests__/experimentRunArtifacts.test.js \
    tests/tutorStubAutoEvalEvidence.test.js
  npm test
  git diff --check
  ```

- Commit that patch separately from evidence/result corrections.
- The narrow invariant is: jobs selected for replacement may be exempted from
  the source draw minimum; retained jobs, recorded draws, seals, model
  observations, and all other integrity checks remain fail-closed.

Acceptance met: focused and full tests pass, and the commit contains only the
four intended files. Unrelated later worktree changes remain outside that
commit and must stay outside the Step 2 evidence repair.

#### A2. Make Step 2 reproducible from compact tracked artifacts

Add one deterministic analysis path that:

1. Declares the exact final row/trace selection for all 60 rows per family.
2. Resolves quarantined Sonnet paths through recorded basename/hash lineage,
   never through “latest file wins.”
3. Emits a compact per-row primary-endpoint dataset with policy, profile, run
   index, t16 coverage, safety, closure availability, source leg, trace hash,
   observed models, Git provenance, and inclusion/exclusion reason.
4. Recomputes the 5,000-draw interaction bootstrap at seed 20260713.
5. Emits the frozen cosine manipulation gate and the richer current-contract
   sensitivity gate.
6. Recomputes the “exclude four post-t16-death rows” Sonnet sensitivity.
7. Regenerates the final QA matrix from the selected rows or clearly retires
   the stale partial matrix from claim-bearing evidence.

Required tracked outputs, kept small:

- `primary-endpoint-rows.json`
- `interaction-bootstrap.json` and `.md`
- `profile-discrimination.json` and `.md`
- a corrected final `qa-matrix.json` and `.md`, or an explicit tombstone that
  points to the replacement analysis
- an updated manifest that hashes every derived output and records every
  source leg/archive

Acceptance:

- All 24 cell means reproduce the tables above.
- Terra gate records 0.812 / 0.912 and fails; Sonnet records 0.645 / 0.694 and
  passes the frozen cosine thresholds.
- The strict verdict is “no family confirmation; no two-family claim.”
- The analysis runs from the archived evidence without model calls.
- No stale partial report remains labeled as the final matrix.

#### A3. Repair the two local-only commits before any push

Preferred repository-convention path: keep full raw summaries in the existing
private archives, track manifests plus compact derived evidence, and remove the
150–187 MB ordinary Git blobs from the unpublished commit history. Do not add
them to LFS merely to avoid doing the distillation.

Because deleting the files in a new commit would leave the oversized blobs in
the earlier local commit, this requires rewriting the two unpushed local Step 2
commits. Before rewriting:

- create a named safety branch/tag at `16245d8d`;
- ensure the resume-integrity patch is committed or otherwise safely isolated;
- get explicit user approval for the history rewrite;
- rebuild the two logical commits as (a) result + compact evidence and (b)
  workplan closeout.

Acceptance: no object introduced after `origin/preconscious` exceeds the host's
single-object limit; the manifests still locate and hash the private archives;
the corrected result commits are pushable.

#### A4. Correct live workplan state

- `tutor-stub-multiworld-policy-replication`:
  - keep `status: done`;
  - set `claim_status: scope-bound` (general/adaptive claim rejected; descriptive
    stack-A safety signal only);
  - append the manipulation-gate correction and link the reproducible outputs.
- `tutor-stub-learner-state-validity`:
  - set `status: done`;
  - set `claim_status: scope-bound`;
  - record the `data_starved` estimator result and sensor-program closure.
- `tutor-stub-transition-reward-model`: keep blocked; update the blocker to say
  Step 2 did not produce a validated policy effect or multi-world dataset.
- `field-planner-phase6-gate`: keep triaged but explicitly deferred behind
  Step 4.
- `tutor-stub-side-coaching-gate`: keep triaged until its revised preregistration
  is ready; then make it active with an owner/branch.
- Do not create a capstone item yet.

Run `node scripts/workplan.js render && node scripts/workplan.js validate` (or
`npm run wp:check`) after hand edits.

#### A5. Land the result in the canonical paper only after A2–A4

Add the result to `docs/research/paper-full-2.0.md` before any spin-off, slide,
or blog version. The paper wording must say:

- the predeclared two-family register-selection claim failed;
- Terra had an off-direction hostile-arm interaction but failed its in-run
  profile-discrimination gate;
- Sonnet passed the frozen cosine gate and returned a primary-endpoint null;
- `field` had no supported coverage effect on either stack;
- the comparison is four-seam/whole-stack and the endpoint includes an LLM
  extraction seam.

Update paper version/revision history and the research-atlas claim status in the
same paper lifecycle. Do not publish “replicates in structure” as a confirmed
mechanism.

### Phase B — Redesign and freeze Step 4 (P1, design work first)

#### B1. Zero-call trigger-density audit

Use existing Green Room and tutor-stub traces to select at most three trigger
families that are:

- mechanically computable from already available public/harness state;
- frequent enough to provide a dense compliance denominator;
- action-specific (the prescribed response can be scored mechanically);
- safe to expose without hidden facts or answer leakage.

Candidate families may include stagnation/re-gloss, affect-fragility, and
warrant-skipping, but the Step 2 Terra contraindications are hypotheses, not
validated rules. Record trigger frequency, co-occurrence, action opportunity,
false-positive review, and expected samples before choosing profiles or n.

#### B2. Fix the control structure

The current four-arm card lacks a trigger-yoked placebo, so a side-coaching
effect could be recency/repetition rather than action-shaped guidance. Prefer
these claim-bearing arms:

1. `standing_book` — the failed static-text channel.
2. `triggered_placebo` — same trigger timing and prompt interruption, generic
   non-actionable reminder.
3. `side_coach` — trigger-timed, action-shaped instruction; tutor may comply.
4. `compiled_constraint` — same trigger and action, enforced by the harness.

An uncoached arm may be an excluded technical calibration, not a fifth
claim-bearing arm, unless the power/budget justification says otherwise.

This design separates:

- standing text versus point-of-action delivery;
- trigger timing alone versus action-shaped content;
- tutor compliance versus deterministic enforcement.

#### B3. Isolate the seam being tested

Step 2 varied all four LLM seams and therefore cannot identify a tutor-family
effect. Step 4 is about tutor compliance with coaching, so hold automated
learner, classifier, and learner-record extractor fixed across tutor blocks and
vary only the speaking tutor between the selected Codex and Sonnet models.
Record all observed roles in-run.

If a later question concerns deployable whole-stack behavior, run that as a
separate successor only after the isolated tutor-channel gate passes.

#### B4. Freeze exact gates before paid calls

The preregistration must specify:

- primary: per-opportunity behavioral compliance, with trigger and action
  scoring owned by the harness;
- key contrast: `side_coach - triggered_placebo`;
- mechanism upper bound: `compiled_constraint - triggered_placebo`;
- delivery contrast: `side_coach - standing_book`;
- exact dense-denominator minimum and handling of non-firing triggers;
- fixed-horizon coverage/risk/safety non-inferiority margin and confidence
  rule; “does not harm” is not precise enough;
- no increase in secret leakage or hard-safety failures;
- model-family interaction and a rule for single-family versus two-family
  wording;
- one excluded technical canary per tutor family, then one frozen claim run;
- same committed SHA, prompts, worlds, profiles, seeds, and analyzer/learner
  seams across all claim-bearing arms.

No `cell_206` is needed unless this leaves the tutor-stub substrate and enters
the registered evaluation-cell pipeline. If a cell is required, inspect
`config/tutor-agents.yaml` and `EVAL_ONLY_PROFILES`; never assume the reserved
number is free.

#### B5. Step 4 decisions

- If `side_coach` beats the trigger-yoked placebo on compliance on both tutor
  families and meets outcome/safety non-inferiority, the point-of-action
  channel survives. Carry it to capstone consideration.
- If only `compiled_constraint` passes, the result supports harness-owned
  control, not tutor internalization. A capstone may use the constraint but
  must not call it learned/adaptive tutor recognition.
- If both fail while triggers fire and scoring is complete, close the
  insight-action successor. Do not tune and retry.
- If trigger density or manipulation fails, report instrument invalidity; do
  not read outcomes as a mechanism null.

### Phase C — Close the stalled explicit-channel preregistration (P2)

Complete `UNRELIABLE-LEARNER-PREREG.md` exactly under its recorded amendments,
with no redesign. This is research-integrity closeout: a registered experiment
with passed gates cannot remain without a verdict.

Run it after Step 4 is frozen (or after Step 4 completes if quota is tight).
Its result decides whether the explicit harness-owned slip channel is eligible
for any later composition.

### Phase D — Terminal decision

After Steps 4 and 5:

- **If neither survives:** drop Phase 6A and the capstone; close the arc with
  the instrument, sensor transparency/data-starvation result, register-selector
  null, and insight-action boundary.
- **If side coaching or compiled constraints survive, but the explicit slip
  channel does not:** consider one narrow composition gate using only the
  surviving point-of-action mechanism plus already settled criterial guards.
- **If both survive:** create a new capstone workplan card and frozen
  preregistration. Exclude the learner-state sensor, active-sensing schedule,
  `field`/`dynamic` register selector, and any component that did not pass its
  own gate. A register palette may remain only behind validated
  contraindication/constraint rules.
- **Phase 6A:** run only if its privileged-state actuator question is still
  independently valuable after Step 4; it is not a prerequisite merely because
  it appeared earlier in the final-stretch diagram.

The arc terminates after this decision. No new representation rung, register
selector, post-hoc Sonnet power-up, or learned policy is licensed as a “quick
check.”

## 6. Recommended order

1. Commit and fully validate the four-file resume-integrity patch.
2. Build the compact Step 2 row-selection, bootstrap, and in-run profile-gate
   outputs.
3. Correct the Step 2 verdict, manifests, stale QA matrix, and workplan states.
4. With approval, rewrite the two unpublished oversized commits and push the
   corrected compact evidence history.
5. Land the bounded result in the canonical paper and atlas.
6. **Done:** perform the zero-call Step 4 trigger-density/control audit, freeze
   the revised preregistration, implement the arms/detectors, and pass the
   balanced 80-dialogue zero-model gate.
7. **Awaiting explicit go:** run and adjudicate the 80-dialogue Step 4 contrast.
8. **Done by evidence reconciliation:** the unreliable-learner registration is
   complete at 12/12; the independent mechanical re-score reproduces told
   49/57 versus conduct 7/19 with zero integrity failures.
9. After Step 4, make the terminal close-or-capstone decision. Create a narrow
   capstone card only if point-of-action treatment survives; otherwise close
   the arc. Phase 6A remains optional only if its privileged-actuator question
   is independently worth its budget after Step 4.

This order spends no further model quota until the current evidence is
reproducible, pushable, and interpreted under its own frozen rules.
