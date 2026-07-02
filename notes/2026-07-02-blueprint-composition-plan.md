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

(appended as work lands)
