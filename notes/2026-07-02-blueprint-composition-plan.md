# Blueprint Composition: One Runnable Tutor from the Validated Mechanisms

Status: frozen implementation + pre-registration note, 2026-07-02. No paid
evaluation is authorized by this note. Worktree branch:
`worktree-blueprint-composition`. Workplan card:
`workplan/items/blueprint-composition.md`.

## 1. Motivation

Paper 2.0 consolidates the adaptation mechanisms *interpretively* (§9: two
supported general mechanisms + governance-class adaptation) and
*prescriptively* (the /blueprint surface's build steps + skip-list), but no
runnable cell composes the validated mechanisms. Each lives in its own cell
family on its own runtime:

| Mechanism | Verdict | Runtime today |
|---|---|---|
| Calibration (orientation prompts) | d ≈ 1.6–1.9, unanimous across judges/models | tutor-core dialogue engine |
| Superego error correction | supported; substitution-dependent (§6.4) | dialogue engine multi-agent cells |
| Writing Pad / ego pre-alignment | +1.31 per session (A7 Phase 2, §6.6.11) | writing-pad cells |
| Typed action contracts + closure | bounded positive (§6.12, Plan 2.x) | LangGraph adaptive runner |
| Pacing / proof-continuity guards | positive, geometry-bound (§6.13) | dramatic-derivation stage |
| Engagement-register routing | routing reliable; effect narrow (cells 180–198) | id-director path |

The composition question is not an engineering leftover; it is the last
untested empirical claim in the mechanism story. The paper's own findings
predict **sub-additivity**:

- Universal substitution (§6.4): calibration substitutes for the superego on
  strong models — composing them may be redundant.
- Prosthesis-straitjacket (§7.8.3): heavy scaffolding damages capable
  models — mechanisms may interfere.
- State-richness reversal (§6.8.6) and four ToM-redundancy nulls: channels
  that re-encode what the model already infers buy nothing.

So the experiment is: **does the full stack beat a small kernel, or does the
kernel match it?** Either answer is a paper finding (§6.14 or §7 extension —
single-paper discipline; no spin-off).

## 2. Design principles

1. **Composition as configuration.** Mechanisms become named modules in
   `config/tutor-blueprint.yaml`, each declaring the profile factor flags it
   resolves to, its evidence pointer (paper §), and its portability status.
   A blueprint profile is a curated module set; ablating a mechanism is one
   YAML line. This generalizes the register-registry pattern from
   `config/engagement-registers.yaml`.
2. **One chassis.** The standard runner's id-director path is the host: it
   already composes recognition orientation (cell 104), register routing +
   resistance gates + agency verifiers (cells 180–198), and per-turn persona
   authoring. Mechanisms from other runtimes port in as per-turn middleware
   (the `resistanceSignalGate.js` precedent) or are declared
   `not_portable_v1` with the reason recorded.
3. **Conditionality is part of the blueprint.** The substitution finding
   (§6.4) is encoded, not ignored: the superego module is declared
   conditional on model tier (weak models only). The straitjacket finding
   (§7.8.3) is encoded as a per-module `load_cost` note.
4. **No paid runs until stage-0 passes** and the decision matrix below is
   frozen.

## 3. Module inventory (v1)

| Module | Status v1 | Resolves to |
|---|---|---|
| `orientation_prompt` | portable | `prompt_type: recognition`, `recognition_mode: true` |
| `register_router` | portable | `id_director: true` + `engagement_mode_router: true` + the cell-193 composite repair flags |
| `writing_pad` | portable if the activation trace confirms it reaches the id-director path; else `conditional` with the wiring gap named | `writing_pad_enabled: true` (activation path to be confirmed in implementation) |
| `superego_error_correction` | conditional (weak-model tier only, per §6.4) | conventional superego block — likely mutually exclusive with `id_director` on the current runner; if so, declared `conflicts_with: register_router` and resolved per-arm |
| `action_contracts` | port-or-defer: extract the select→contract→closure check from `services/adaptiveTutor/` as middleware if the coupling audit says it is separable; else `not_portable_v1` | new middleware seam |
| `pacing_guard` | `not_portable_v1` — requires machine-checkable task state (proof DAG); no equivalent exists for the suggestion/resistance suites | — |

## 4. Cells

- `cell_199_blueprint_kernel_verified` — orientation + writing_pad +
  register_router (the three-layer kernel).
- `cell_200_blueprint_full_verified` — kernel + every module portable at
  implementation time (action_contracts if extracted; superego per its
  conditionality rule).
- Existing cells serve as the single-mechanism comparators (no new
  ablation cells unless a layer has no clean existing representative):
  orientation-only ≈ cell_5/85 family; router family ≈ cell 193;
  writing-pad ≈ cell 21 family; budget floor.

Register both in `EVAL_ONLY_PROFILES`; run the cell-config-auditor.

## 5. Pre-registered composition test (paid gate — NOT authorized yet)

- **Arms**: budget floor; strongest single-mechanism comparators (existing
  cells); `cell_199` kernel; `cell_200` full.
- **Scenario mix**, held-out across the three families the mechanisms were
  developed on: 2 suggestion-suite scenarios, 2 trap scenarios
  (`strict_shift` scored), and the 5 gated resistance scenarios.
- **Instruments**: v2.2 tutor scoring as primary; strategy-shift scorer on
  trap rows; breakthrough-matrix local reporter on resistance rows;
  register rubric as covariate only.
- **Frozen hypotheses**:
  - H1 (from §6.4/§7.8.3): kernel ≈ full stack on v2.2 (sub-additivity);
    the full stack does NOT beat the kernel by more than judge noise.
  - H2: kernel ≥ each single-mechanism comparator on its home suite is NOT
    required; the win condition is **no regression below any comparator on
    that comparator's home suite, plus positive coverage on all three
    suites** — composite acceptance, as with cell 193, one level up.
  - H3 (risk): the composed prompt load pushes the strong-model stack into
    straitjacket territory (full < kernel). If observed, that is the §7.8.3
    finding reproduced at composition scale and should be reported as such.
- **Decision rule is local per suite** (trap: strict shift at trigger+1;
  resistance: gated route→uptake; suggestion: v2.2 first/last turn). No
  whole-run averaging across suites into a single number.
- **Stop rules**: stop if generation validation fails on >20% of rows; stop
  if the kernel regresses below the budget floor anywhere (instrument or
  wiring bug, not evidence); do not iterate prompt content inside the same
  matrix.

## 6. What this note does NOT authorize

- Any paid run (the §5 matrix needs a separate go decision with model stack
  and repeat counts frozen at that point).
- Any claim that a composite tutor "works" — until the matrix runs, the
  blueprint cells are wiring, not evidence.
- Porting the pacing guard or any derivation-stage mechanism.
- Human-facing claims of any kind.

## 7. Implementation log

2026-07-02 — Implementation landed on `worktree-blueprint-composition`:

- Composability trace corrected two §3 assumptions. (a) `writing_pad_enabled`
  is dead config: no JS reads it; pads key on `learnerId`, which the runner
  always supplies. Two distinct pads exist — the tutor-core SQLite
  three-layer pad (dialogue-engine path; the A7 +1.31/session evidence) and
  the drama pads (`services/memory/*WritingPad.js`; what the id-director
  path reads via `buildNarrativeSummary` and the interaction loop writes).
  The `writing_pad` module is therefore declared `inherent` on this chassis,
  with the A7 cross-session claim explicitly NOT inherited. (b) The
  conventional superego is structurally excluded: the id-director re-uses
  the `superego:` YAML block as the id and short-circuits the deliberation
  loop, so `superego_error_correction` is `conflicts_with: chassis`.
- `config/tutor-blueprint.yaml` + `services/tutorBlueprint.js`: modules
  declared with evidence pointers and portability status; profile resolution
  enforced-as-check by `services/__tests__/tutorBlueprint.test.js` against
  the explicit cell factor blocks (6/6 tests).
- `services/blueprintActionContracts.js`: the Plan 2.x
  select→contract→verify→close cycle extracted from the LangGraph runner as
  pure per-turn middleware. Ownership gate not ported (proof-state-specific);
  realization checks recorded in the trace, never used to repair the tutor
  message. Ledger continuity rides the dialogue trace exactly as register
  history does. 5/5 middleware tests, including a cross-turn
  close-the-pending-intervention round-trip through both trace shapes.
- `idDirectorEngine.js`: `factors.action_contracts` threaded through both
  entry paths; `<adaptation_contract>` block injected into the id user
  message; contract/ledger persisted as an `action_contract` trace entry.
  Contract failures degrade to a warning, never kill the turn.
- Cells `cell_199_blueprint_kernel_verified` (orientation + drama pad +
  cell-193 register composite) and `cell_200_blueprint_full_verified`
  (kernel + action contracts) registered in `tutor-agents.yaml` and
  `EVAL_ONLY_PROFILES`; `validate-config` clean (0 warnings, 0 errors).
- Stage-0: focused id-director/router/blueprint tests green; full hermetic
  suite green except 12 pre-existing `provableDiscourse.test.js` failures
  reproduced bit-identically on the base commit (fresh-worktree epoch/
  snapshot state, not this change); whole-repo eslint clean; prettier clean
  on all files this branch touches (11 pre-existing warns inherited from
  main are out of scope).

Cell-config audit (same day): registration, naming, runner dispatch, and
scoring-channel routing all passed. One substantive finding — cells 199/200
pair a recognition tutor with the base (non-recognition) `ego_superego`
learner profile, and no id-director precedent existed for that pairing.
Resolution: this is deliberate, now documented and enforced. The dynamic
learner is the measurement instrument and is held constant across every
composition arm (the cell 193 comparator uses the same profile); switching
it to `ego_superego_recognition` would vary the instrument between arms and
confound the contrast. The registry chassis now declares
`base_profile_fields.learner_architecture: ego_superego`, the consistency
test enforces it on every blueprint cell, and both cell descriptions state
the choice.

## 8. Go decision (2026-07-02, user-authorized): frozen execution plan

The user authorized the §5 paid matrix. Frozen at go time:

- **Model stack — Codex-only**: `--ego-model codex.gpt-5.5
  --superego-model codex.gpt-5.5 --learner-model codex.gpt-5.5` for every
  arm (run-wide overrides make the generation stack model-clean across
  arms). This is the exact stack the cell-193 comparator evidence was
  generated on. The initially preferred `openrouter.sonnet-5` id slot was
  ruled out by a pre-run credit probe: the OpenRouter account has ~$6.2
  remaining ($1403.77 of $1410 used) — the BudgetTracker-blind-spot check
  doing its job.
- **Repeats**: 1 per arm × scenario for this gate (register-arc precedent:
  small gates first; stability repeats are a later decision).
- **Execution**: serial (`--parallelism 1`), generation-only
  (`--skip-rubric`), block-per-run so each block is independently
  resumable. Worktree DB/logs re-pointed at the canonical store
  (`~/.machinespirits-data`) before any row was generated; the stray
  worktree-local test DB (12 junk rows) was verified as today's test
  artifacts and replaced with the symlink.
- **Block R — resistance (primary)**: 5 gated resistance scenarios ×
  {budget, cell_193, cell_199, cell_200} = 20 rows. Fresh cell_193 arm in
  the same run doubles as a consistency check against its historical rows
  on the same stack.
- **Block S — suggestion**: {misconception_correction_flow,
  epistemic_resistance_impasse} × {budget, cell_5_recog_single_unified,
  cell_199, cell_200} = 8 rows.
- **Block T — trap (exploratory)**: {false_confusion_v1,
  resistance_to_insight_v1} × {cell_199, cell_200} via
  `scripts/run-id-director-trap-pilot.js` (4 rows), compared against the
  historical §6.8 cell_110/114 results rather than fresh adaptive-runner
  arms. Exploratory because policy-action labelling on id-director traces
  is adapter-mediated; a labelling mismatch invalidates the block, not the
  gate.
- **Scoring**: v2.2 via `evaluate <runId> --judge-cli codex` on blocks R
  and S; breakthrough-matrix reporter on block R; strategy-shift analyzer
  on block T. Register rubric only if OpenRouter budget allows
  (covariate, not decision).
- **Canary**: 1 row (cell_199 × boredom) before block R.

Decision rules and stop rules are §5's, unchanged.

## 9. Run log

**Canary** — `eval-2026-07-02-b0be0524`: cell_199 × boredom, 1/1 stored,
required + forbidden clean, all three id constructions `parse_status: ok`,
router routed scaffolding → charismatic_challenge with
`resistance_signal: boredom`. Kernel wiring confirmed live on the Codex
stack.

**Block R (resistance)** — `eval-2026-07-02-b4ccb58d`: 20/20 successful
generation rows across {cell_186 floor, cell_193 comparator, cell_199
kernel, cell_200 full} × 5 gated resistance scenarios, Codex-only stack,
serial. Two external interruptions of the background process (at 7/20 and
17/20 rows); both recovered with `resume` — the checkpoint/resume protocol
worked as designed, no duplicate or empty rows. Deviation from §8 as
frozen: the resistance-suite floor arm is cell_186 (the family's static
floor with the same dynamic learner, hence gate-eligible), not raw
`budget` — raw budget cannot witness the resistant-precondition gate on
this suite; budget remains the Block S floor. Validation: forbidden 20/20;
required 19/20, the single miss being cell_200 × irrelevance (agency-return
phrase group), consistent with the family's historical occasional misses.

**Block R scoring** (v2.2, Codex CLI judge, 20/20 rows; n=5/arm):

| Arm | v2.2 first | v2.2 last | v2.2 overall |
|---|---:|---:|---:|
| cell_186 floor | 76.5 | 98.3 | 90.4 |
| cell_193 comparator | 78.5 | 97.0 | 91.6 |
| cell_199 kernel | 78.3 | 100.0 | 92.3 |
| cell_200 full | 81.5 | 98.3 | 92.0 |

Flat band: **H1 (sub-additivity) consistent** — the full stack does not beat
the kernel; **H3 (straitjacket collapse) not triggered** — no arm regresses.
Note the suite is near-ceiling for every id-director arm under this stack.

**Block R local decision metric** (breakthrough-matrix reporter, arm labels
`blueprint_kernel`/`blueprint_full` added to the reporter; n=1 per
cell×scenario):

| Arm | Eligible | Candidates | Positive | Route hits | Mean local score |
|---|---|---|---|---|---:|
| cell_186 floor | 5/5 | 2/5 | 3/5 | 0/5 | 61.0 |
| cell_193 comparator | 5/5 | 3/5 | 5/5 | 5/5 | 90.0 |
| cell_199 kernel | 5/5 | 2/5 | 2/5 | 4/5 | 73.0 |
| cell_200 full | 4/5 | 1/5 | 1/5 | 5/5 | 84.0 |

**H2 fails on the comparator's home suite at this single-repeat gate**: both
composite arms convert resistance less often than the plain cell-193
backbone (kernel 2/5 positive vs 193's 5/5), despite routing correctly. The
kernel stays above the floor (73.0 > 61.0), so no stop rule fired. The one
factor separating the kernel from cell 193 is recognition orientation —
directionally consistent with the arc's repeated finding that
recognition-theory prose cools the local charismatic mechanism. Single
repeats: directional only, not a claim.

**Block S (suggestion)** — `eval-2026-07-02-fe9404d2` (blueprint arms,
Codex stack) + `eval-2026-07-02-a4260aa3` (comparator arms). Deviation: the
Codex CLI bridge does not reach tutor-core's dialogue engine, so `budget`
and `cell_5_recog_single_unified` could not run on the frozen Codex stack;
they ran on their canonical YAML stack (openrouter/nemotron) in the
supplementary S2 run. Scored with the same Codex judge:

| Arm | Stack | v2.2 first | v2.2 overall |
|---|---|---:|---:|
| budget | nemotron | 14.4 | 9.8 |
| cell_5 orientation-only | nemotron | 38.1 | 26.9 |
| cell_199 kernel | codex | 91.3 | 97.2 |
| cell_200 full | codex | 96.3 | 97.4 |

The cross-arm gap is **generation-model-dominated and is NOT composition
evidence** (the blueprint arms ran a far stronger model). The clean
within-stack contrast is kernel 97.2 ≈ full 97.4 — **H1-consistent again**.

**Block T (trap, exploratory)** — cell 199 rows generated 2/2
(`eval-2026-07-02-6547750c`, nemotron/kimi YAML stack; the pilot script does
not read .env, first attempts failed on missing keys and their empty run
records were deleted along with one interrupted empty cell-200 record).
`analyze-strategy-shift.js` returns 0/0 evaluable: the id-director pilot
trace carries `dialogue` + `idConstructions`, no `tutorInternal.policyAction`
slot — the binary strict-shift metric is **structurally non-evaluable on
this adapter**, so Block T is recorded exploratory-invalidated per §8's
proviso. Cell 200's contract `action_type` entries (in the id trace) could
support a future mapping into the shift scorer, off-gate. Cell 200's trap
rows were NOT generated: three attempts were externally stopped before any
row persisted, and with the block's metric already invalidated no further
spend was justified; all empty run records were deleted
(`eval-2026-07-02-c47ceb73` last). Cell 200 trap generation, if ever wanted,
belongs to the future mapping work, not this gate.

**Cost**: OpenRouter spend for the whole gate ≈ $0.30 (trap + S2 nemotron
rows); ~$5.94 credit remains. Everything else ran on CLI subscription quota.
Operational note: background tasks were externally stopped six times across
the gate; every interruption recovered cleanly via `eval-cli resume` with no
duplicate or empty rows persisted — the checkpoint/resume discipline held.

## 10. H2 repeats contrast (pre-registration, 2026-07-03, user-authorized)

Frozen before launch: cell_193 vs cell_199 only, 5 gated resistance
scenarios × 3 repeats each = 30 rows, same Codex-only stack and serial
generation-only execution as the gate, scored with the same codex CLI v2.2
judge and the breakthrough-matrix reporter. Primary outcome: per-arm
positive-local-outcome rate and candidate rate on the local transition
(combined with the gate's Block R rows for n=4 per cell×scenario). Decision
rule: the H2 regression is treated as real if cell_199's combined positive
rate stays at least 2 scenarios' worth below cell_193's (e.g. ≤12/20 vs
≥18/20-shaped gap); dissolved if the arms converge within 1 scenario's
worth. No prompt or config edits between gate and repeats. Stop rules as §5.

### §10 result (2026-07-03)

Run `eval-2026-07-02-ad0b5a8b`: 30/30 successful rows (three external
process stops, all recovered via resume; validation 29/30 required — both
misses cell_199 × boredom — and 29/30 forbidden). Combined with the gate's
Block R rows (n=4 per cell×scenario, 40 rows total in the contrast):

| Scenario | 193 candidates | 199 candidates | 193 positive | 199 positive | 193 mean | 199 mean |
|---|---|---|---|---|---:|---:|
| boredom | 4/4 | 3/4 | 4/4 | 3/4 | 91.3 | 88.8 |
| frustration | 0/4 | 0/4 | 4/4 | 1/4 | 80.0 | 72.5 |
| irrelevance | 4/4 | 4/4 | 4/4 | 4/4 | 91.3 | 82.5 |
| question_flood | 4/4 | 4/4 | 4/4 | 4/4 | 88.8 | 85.0 |
| rote_parroting | 0/4 | 1/4 | 4/4 | 3/4 | 86.3 | 76.3 |
| **Combined** | **12/20** | **12/20** | **20/20** | **15/20** | — | — |

Route hits 20/20 (193) vs 19/20 (199).

**Frozen-rule verdict: the middle zone.** The positive-rate gap is 5/20 —
below the ≥6-row "real" shape, above the ≤4-row "dissolved" shape. The
gate's dramatic 2/5-vs-5/5 regression **attenuated but did not vanish**:

- On **strict candidate breakthroughs the arms are equal** (12/20 each) —
  the kernel converts hard breakthroughs at cell 193's rate.
- The deficit is concentrated in **soft positives**: cell 193 turns every
  frustration and rote-parroting row into productive carry-through (8/8),
  the kernel manages 4/8. Frustration is the sharpest split (4/4 vs 1/4).
- **Sign-consistency**: cell 193's mean local score is higher on all five
  scenarios (5/5), and the kernel never wins a scenario on any column.

Bounded reading: recognition orientation on the id-director chassis does not
impair the kernel's ability to produce strict local breakthroughs, but it
reliably erodes the carry-through band — the marginal rows where cell 193's
base-prompt stance keeps a still-frustrated or still-parroting learner doing
content-bearing work. Under the pre-registration this is neither confirmed
nor dissolved; a further 2 repeats per cell×scenario (20 rows) would settle
the positive-rate gap, but the equal strict-candidate rates already narrow
what a "real" verdict could claim. v2.2 covariate scoring of the repeats is
recorded separately when complete; it is not part of this decision.

**Gate verdict (bounded)**: sub-additivity (H1) is supported everywhere it
could be measured — the full stack never beats the kernel beyond noise, on
either suite, and the action-contract module adds nothing detectable at
n=1. The straitjacket failure mode (H3) did not appear. The informative
surprise is H2: on the resistance suite's local uptake metric the composite
arms trail the plain cell-193 backbone, suggesting composing recognition
orientation onto the register-router backbone has a local cost invisible to
whole-dialogue v2.2 scoring. Licensed next step: a repeats-only contrast
(cell 193 vs cell 199, 3+ repeats × 5 scenarios) to power that single
comparison — not a broader matrix.
