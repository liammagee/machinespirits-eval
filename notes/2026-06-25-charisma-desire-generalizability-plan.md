# Charisma Desire Generalizability Plan

Status: frozen preliminary plan for extending the cell 169 local pass into a
generalizability study. No new paid evaluation is authorized by this note.

## Current Claim Boundary

Cell 169 (`cell_169_id_director_charisma_accountable_bid_clean_floor_verified`)
is currently a clean local design pass, not a generalizable effect. The licensed
claim is:

> accountable-bid charisma is the first clean local pass under simulated
> authority refusal.

The unlicensed claims remain:

- charismatic tutoring works generally;
- real learners recognize the tutor's authority;
- charismatic authority improves human learning;
- cell 169 is better than the prior id-director family across curricula,
  judges, or model pairings.

This branch should remain separate from the Paper 2.0 main-mechanism claims
unless a later multi-scenario, multi-judge, model-robust, and human-facing gate
promotes it.

## Existing Evidence

Reconstructed from `data/evaluations.db` on 2026-06-25. Query source:

```sql
SELECT
  r.run_id,
  r.scenario_id,
  r.profile_name,
  printf('%.2f', r.tutor_first_turn_score) AS v22_first_turn,
  CASE
    WHEN r.tutor_charisma_overall_score IS NULL
      OR r.tutor_charisma_overall_score = 0
    THEN 'not retained'
    ELSE printf('%.2f', r.tutor_charisma_overall_score)
  END AS charisma,
  r.passes_required,
  r.passes_forbidden,
  r.required_missing,
  r.forbidden_found,
  r.judge_model,
  r.tutor_charisma_judge_model,
  json_extract(run.metadata, '$.egoModelOverride') AS ego_model,
  json_extract(run.metadata, '$.superegoModelOverride') AS id_model,
  json_extract(run.metadata, '$.judgeCli') AS judge_cli,
  json_extract(run.metadata, '$.gitCommit') AS git_commit
FROM evaluation_results r
JOIN evaluation_runs run ON run.id = r.run_id
WHERE r.run_id IN (
  'eval-2026-06-25-b9608606',
  'eval-2026-06-25-428ccd8f',
  'eval-2026-06-25-19ee106a',
  'eval-2026-06-25-63e98149',
  'eval-2026-06-25-0acee3fb'
);
```

| Run | Scenario | Profile | v2.2 first-turn | Charisma | Required | Forbidden | Required missing | Forbidden found | v2.2 judge | Charisma judge | Ego | Id |
|---|---|---|---:|---:|---:|---:|---|---|---|---|---|---|
| `eval-2026-06-25-b9608606` | `charisma_desire_authority_withheld` | `cell_163_id_director_charisma_agency_return_warm_floor_verified` | 95.42 | 90.00 | 1 | 1 | `["one of: test, try, refuse, push back, where it fails"]` | `[]` | `codex-cli/auto` | `claude-code.sonnet-4-6` | `codex.gpt-5.5` | `claude-code.sonnet-4-6` |
| `eval-2026-06-25-428ccd8f` | `charisma_desire_status_challenge` | `cell_163_id_director_charisma_agency_return_warm_floor_verified` | 78.13 | 75.00 | 1 | 1 | `["one of: one, criterion, check, if it helps"]` | `[]` | `codex-cli/auto` | `claude-code.sonnet-4-6` | `codex.gpt-5.5` | `claude-code.sonnet-4-6` |
| `eval-2026-06-25-19ee106a` | `charisma_desire_status_challenge` | `cell_168_id_director_charisma_accountable_bid_floor_verified` | 88.75 | not retained | 1 | 0 | `[]` | `["profound"]` | `codex-cli/auto` |  | `codex.gpt-5.5` | `claude-code.sonnet-4-6` |
| `eval-2026-06-25-63e98149` | `charisma_desire_authority_withheld` | `cell_169_id_director_charisma_accountable_bid_clean_floor_verified` | 88.75 | 78.75 | 1 | 1 | `[]` | `[]` | `codex-cli/auto` | `claude-code.sonnet-4-6` | `codex.gpt-5.5` | `claude-code.sonnet-4-6` |
| `eval-2026-06-25-0acee3fb` | `charisma_desire_status_challenge` | `cell_169_id_director_charisma_accountable_bid_clean_floor_verified` | 87.50 | 78.75 | 1 | 1 | `[]` | `[]` | `codex-cli/auto` | `claude-code.sonnet-4-6` | `codex.gpt-5.5` | `claude-code.sonnet-4-6` |

Interpretation:

- Cell 163 can produce the strongest authority performance, but status-challenge
  is weaker and audit metadata still records unmet optional handback phrase
  groups.
- Cell 168 repairs the status-challenge v2.2 score but fails the forbidden-word
  guard by repeating `profound`.
- Cell 169 is the first clean local pass across both decision scenarios.

## Frozen Scenario Taxonomy

Primary decision scenarios:

- `charisma_desire_authority_withheld`
- `charisma_desire_status_challenge`

Robustness scenarios to add or freeze before paid runs:

- `charisma_desire_partial_uptake`: keep out of the primary decision rule because
  it confounds recognition theory, Hayles/AI-cognition content, and learner
  uptake of a tutor phrase.
- `charisma_desire_conceptual_control`: same curriculum, no explicit authority challenge,
  to test whether `accountable_bid_clean` overcorrects into unnecessary
  self-limitation.
- `charisma_desire_vulnerability_shift`: reuse or adapt prior persona-shift logic
  where the learner disclosure resists easy sympathy.
- `charisma_desire_ai_syllabus_transfer`: use the recently generated AI
  Foundations campus FAQ formulation-card material as a transfer check through
  `content/courses/479/lecture-8.md`, with
  `config/drama-derivation/world-016-ai-syllabus-af1.yaml` as source context.
  This is a generated-AI-material transfer check, not yet a separate non-479
  curriculum transfer.
- `charisma_desire_plain_language_stress`: learner requests direct, low-register
  instruction to test whether charisma survives simplification.

The first pilot matrix uses six scenario types total:
`charisma_desire_authority_withheld`, `charisma_desire_status_challenge`,
`charisma_desire_conceptual_control`,
`charisma_desire_vulnerability_shift`,
`charisma_desire_ai_syllabus_transfer`, and
`charisma_desire_plain_language_stress`. `charisma_desire_partial_uptake`
remains robustness-only and is excluded from the primary decision rule.

## Frozen Comparator Set

Use exactly four profile families for the pilot matrix:

1. `cell_169_id_director_charisma_accountable_bid_clean_floor_verified`
   - Target design.
2. `cell_163_id_director_charisma_agency_return_warm_floor_verified`
   - Strong prior agency-return comparator.
3. `cell_104_recog_id_director_charisma_register`
   - Prior id-director recognition/register generalist comparator.
4. `cell_107_id_director_witness_exemplars`
   - Prior witness-exemplar generalist comparator.

The default `budget` tutor should be run only as a floor check if cost permits
or if the pilot results are ambiguous. Do not replace one of the four core
profiles with `budget` unless the matrix is explicitly resized.

## Judge and Model Matrix

Primary high-powered stack, matching the local pass where feasible:

- Ego: `codex.gpt-5.5`
- Id / superego slot: `claude-code.sonnet-4-6`
- v2.2 judge: Codex CLI (`codex-cli/auto`)
- Charisma judge: Claude Code Sonnet 4.6

Robustness requirements before a generalizability claim:

- Add at least one second v2.2 judge.
- Add at least one second charisma judge.
- Rerun a reduced matrix with at least one non-Codex ego or non-Claude id pairing.
- Record all judge labels and model overrides from `evaluation_runs.metadata`.

## Evaluation Stages

Stage 0 - no paid calls:

- Clean accidental or stale runs.
- Confirm all profile names resolve with `node scripts/eval-cli.js validate-config`.
- Confirm the scenario override parses with:

```bash
EVAL_SCENARIOS_FILE=config/charisma-recognition-desire-scenarios.yaml \
  node scripts/eval-cli.js validate-config
```

- Validate the frozen pilot grid and content/profile references with:

```bash
node scripts/report-charisma-desire-stage0-matrix.js
```

- Rebuild the workplan board after saving this plan.

Stage 1 - pilot matrix:

- Six scenario types x four profiles x three runs = 72 rows.
- Use the primary high-powered stack if budget allows.
- Do not tune prompts or validation phrases during the pilot.
- Generate with rubric scoring skipped, then score explicitly:
  - v2.2 tutor/learner/dialogue scoring:
    `node scripts/eval-cli.js evaluate <runId> --judge-cli codex`
  - Weber charisma scoring:
    `node scripts/evaluate-charisma.js <runId> --judge claude-code.sonnet`
- For the Claude Code id-director stack, set
  `ID_DIRECTOR_CLAUDE_CLI_TIMEOUT_MS=600000` before generation. The first
  attempted full pilot (`eval-2026-06-25-ff4c694b`) produced no usable rows
  because the first id-authoring call hit the previous 180s hard cap.

Operational smoke after timeout patch:

- `eval-2026-06-25-5ee5dd6d`: cell 169 on
  `charisma_desire_authority_withheld`, one repeat, Codex GPT-5.5 ego, Claude
  Code Sonnet 4.6 id, Codex CLI v2.2 judge, Claude Code Sonnet charisma judge.
  Result: v2.2 first-turn 98.75, last-turn 100.00, tutor overall 96.25,
  charisma 78.75, required/forbidden validation clean.

Stage 1 completed pilot:

- `eval-2026-06-25-dbae041a`: six scenario types x four profiles x three
  repeats, Codex GPT-5.5 ego, Claude Code Sonnet 4.6 id, Codex CLI v2.2 judge,
  and Claude Code Sonnet charisma judge. The run retained four early
  connection-refused infra-failure rows from the first parallel attempt, but
  the completed matrix has 72 successful generated rows. All 72 successful rows
  have v2.2 and charisma scores.
- Reproducible summary:
  `exports/charisma-desire-stage1-pilot-summary.md`, generated by
  `node scripts/report-charisma-desire-stage1-pilot.js`.
- Primary decision result: cell 169 passed required and forbidden validation
  on both `authority_withheld` and `status_challenge` (6/6 required, 6/6
  forbidden across the primary rows). Across primary scenarios, cell 169 scored
  v2.2 first-turn 87.3, v2.2 last-turn 94.2, v2.2 overall 91.3, and charisma
  81.0. It was not the top v2.2 profile overall, but it was the strongest
  primary charisma profile and remained competitive on v2.2.
- Robustness result: the design is not yet general. Cell 169 was strong on
  `vulnerability_shift` (v2.2 first-turn 97.1, v2.2 overall 95.8, charisma
  73.7), but weak on `ai_syllabus_transfer` (v2.2 first-turn 70.0, v2.2 overall
  74.8, charisma 69.2) and `plain_language_stress` (v2.2 first-turn 76.7,
  v2.2 overall 81.0, charisma 68.8).
- Interpretation: the current evidence supports the bounded claim that
  accountable-bid charisma generalizes across the two tested simulated
  authority-refusal scenarios under this model stack. It does not yet support a
  general charismatic-tutoring claim. The next design target is a
  transfer/plain-language floor: preserve the accountable-bid authority stance
  while staying inside the learner-requested domain and register, especially
  when the learner explicitly says not to drag the answer back to master and
  servant.

Stage 2 design smoke:

- Added
  `cell_170_id_director_charisma_accountable_bid_transfer_plain_floor_verified`
  as a one-factor extension of cell 169. The new
  `accountable_bid_transfer_plain` floor keeps the clean accountable-bid guard
  while making learner-named transfer material and plain register binding before
  recognition-theory vocabulary.
- Also patched `services/evaluationRunner.js` so `EVAL_LOGS_DIR` redirects
  tutor-core dialogue logs as well as eval/progress logs. This makes temp-backed
  no-paid dry-runs genuinely hermetic for standard dialogue-engine cells.
- `eval-2026-06-25-dea673e5`: two weak scenarios x two profiles x one repeat:
  cell 169 versus cell 170 on `ai_syllabus_transfer` and
  `plain_language_stress`. Model stack: Codex GPT-5.5 ego, Claude Code Sonnet
  4.6 id, Codex CLI v2.2 judge, Claude Code Sonnet charisma judge.
- Reproducible summary:
  `exports/charisma-desire-stage2-smoke-summary.md`, generated by
  `node scripts/report-charisma-desire-stage2-smoke.js`.
- Result: cell 170 improves transfer validity and v2.2 quality but does not
  restore a general passing design. AI-syllabus transfer: cell 170 v2.2 first
  100.0, v2.2 overall 98.1, charisma 68.8 versus cell 169 v2.2 first 75.0,
  v2.2 overall 85.0, charisma 73.8. Plain-language stress: cell 170 v2.2 first
  75.0, v2.2 overall 86.3, charisma 46.3 versus cell 169 v2.2 first 75.0,
  v2.2 overall 83.8, charisma 56.2. All four rows passed required and forbidden
  validation.
- Interpretation: cell 170 is a clean transfer/plain-language validity
  improvement, not a general passing design. The next design target is
  charisma-preserving transfer/plainness: concise, concrete authority with
  stakes, compression, and rhythm inside the learner-named material, without
  falling back to recognition-theory prose or status display.

Stage 3 design smoke:

- Added
  `cell_171_id_director_charisma_accountable_bid_transfer_plain_presence_floor_verified`
  as a one-factor extension of cell 170. The new
  `accountable_bid_transfer_plain_presence` floor keeps the transfer/plain guard
  and adds low-register presence through concrete stakes, compression, and a
  learner-owned test.
- `eval-2026-06-25-629e5746`: two weak scenarios x two profiles x one repeat:
  cell 170 versus cell 171 on `ai_syllabus_transfer` and
  `plain_language_stress`. Model stack: Codex GPT-5.5 ego, Claude Code Sonnet
  4.6 id, Codex CLI v2.2 judge, Claude Code Sonnet charisma judge.
- Reproducible summary:
  `exports/charisma-desire-stage3-smoke-summary.md`, generated by
  `node scripts/report-charisma-desire-stage3-smoke.js`.
- Result: cell 171 is not a general passing design. It restores charisma, but
  over-intensifies plain-language recognition. AI-syllabus transfer: cell 171
  v2.2 first 91.3, v2.2 overall 95.6, charisma 75.0 versus cell 170 v2.2 first
  87.5, v2.2 overall 93.8, charisma 58.8. Plain-language stress: cell 171
  v2.2 first 71.3, v2.2 overall 81.9, holistic 27.5, charisma 75.0 versus cell
  170 v2.2 first 92.5, v2.2 overall 93.8, holistic 52.5, charisma 36.3. All
  four rows passed required and forbidden validation.
- Interpretation: the useful AI-transfer move should be preserved, but the
  global presence rule is too blunt. The next design target is split-domain
  presence: keep the consequential decision-rights opening for AI transfer,
  while using a theory-name-free plain-language micro-mode built around a
  memorable say-back line and a failure test.

## 2026-06-26 Pivot: From Static Cell Search to Engagement-Mode Routing

The post-169 sequence should no longer be treated as a search for a single
static "general passing" charisma profile. Cells 170--179 are better evidence
for a productive tension: v2.2 instructional quality and Weberian charisma can
both be locally optimized, but the correct move depends on the learner's
engagement state. Static prompt floors repaired one weak scenario while
creating a new failure in the other.

This table was reconstructed from `data/evaluations.db` on 2026-06-26. Historical
rows generated under the mistaken cell 174+ numbering are rendered below with
their corrected canonical labels. The compromised cell 177 fallback row from
`eval-2026-06-26-da19680e` is excluded; the clean plain-language rerun is
`eval-2026-06-26-8579fd96`.

| Cell | Scenario | v2.2 overall | Charisma | Required | Forbidden | Diagnostic reading |
|---|---|---:|---:|---|---|---|
| 170 | AI syllabus transfer | 93.8 | 58.8 | yes | yes | Transfer/plain guard lifts instructional quality but cools charisma. |
| 170 | Plain-language stress | 93.8 | 36.3 | yes | yes | Plainness becomes competent but affectively flat. |
| 171 | AI syllabus transfer | 95.6 | 75.0 | yes | yes | Low-register presence restores charisma on transfer. |
| 171 | Plain-language stress | 81.9 | 75.0 | yes | yes | Same presence over-intensifies the simplification task. |
| 172 | Plain-language stress | not scored | not scored | no | yes | Split mode missed the literal say/check validation hook. |
| 173 | AI syllabus transfer | 95.0 | 65.0 | yes | yes | Literal check hook is safe but cooler than presence. |
| 173 | Plain-language stress | 79.4 | 70.0 | yes | yes | Charisma survives, but v2.2 slips just below the practical floor. |
| 174 | AI syllabus transfer | 89.4 | 65.0 | yes | yes | Concept anchors improve validity without solving charisma. |
| 174 | Plain-language stress | 88.1 | 58.7 | yes | yes | Content accuracy improves; charisma cools. |
| 175 | AI syllabus transfer | 93.1 | 77.5 | yes | yes | Anchor-live is the strongest transfer balance. |
| 175 | Plain-language stress | 81.3 | 63.7 | yes | yes | Plain follow-up slips back toward named theory and loses quality. |
| 176 | AI syllabus transfer | 98.1 | 77.5 | yes | yes | Persistent guard preserves transfer quality and charisma. |
| 176 | Plain-language stress | 95.0 | 52.5 | yes | yes | Persistent guard raises v2.2 but makes plain charisma functional rather than felt. |
| 177 | AI syllabus transfer | 83.1 | 67.5 | yes | yes | Lived-example mode weakens transfer precision. |
| 177 | Plain-language stress | 78.1 | 62.5 | yes | yes | Lived example improves texture but repeats rather than simplifying. |
| 178 | AI syllabus transfer | 93.1 | 68.8 | yes | yes | Compression keeps transfer adequate but not charismatic. |
| 178 | Plain-language stress | 90.6 | 30.0 | yes | yes | Pure compression reads as administrative protocol. |
| 179 | Plain-language stress | 77.5 | 56.2 | yes | yes | Adding a charged stakes line restores some affect but loses v2.2 precision. |

Interpretation:

- The robust lesson is not "cell 179 needs one more floor." It is that a
  one-size static persona is the wrong unit. Transfer demand, authority refusal,
  plain-language request, and simplification follow-up require different
  engagement registers.
- v2.2 rewards perception, elicitation, content accuracy, and adaptive fit.
  Charisma rewards a marked voice, felt stakes, rhetorical movement, and a bid
  the learner can accept or refuse. The same sentence often cannot maximize
  both under every learner signal.
- The design target should move from cell-level prompt ablations to a policy
  that selects an engagement register per turn and records why.

### Engagement-Register Policy Sketch

The next implementation target is an engagement router upstream of id prompt
construction. It should classify learner signals and choose a bounded register:

| Learner signal | Router register | Tutor behavior |
|---|---|---|
| Confusion or conceptual muddiness | `clarity` | Define one distinction, name the current misconception, ask one check. |
| Needs step-by-step support | `scaffolding` | Break the task into a small sequence with an explicit learner-owned next step. |
| Authority refusal or status challenge | `accountable_bid_authority` | Make a defeasible framing bid, expose the failure condition, return authority to the learner. |
| Plain-language request | `plain_compression` | Use low-register say-back/check language without theory names or ornate posture. |
| Plain follow-up has become flat | `lived_stakes_reentry` | Add one ordinary lived stake, then return to a compact check. |
| Transfer demand or "use this material" | `transfer_grounding` | Answer first inside the learner-named artifact, case, or curriculum object. |
| Boredom, disengagement, or performative compliance | `charismatic_challenge` | Use a sharper challenge, contrast, or consequence while keeping a concrete refusal path. |
| Vulnerability/persona shift | `witnessing_restraint` | Acknowledge the risk without flattery, then give one concrete test or next move. |

Minimal state fields:

- `learner_signal`: enum plus one quoted evidence span from the learner turn.
- `selected_register`: one of the router registers above. `selected_mode`
  remains as a backward-compatible trace alias.
- `register_reason`: one sentence tying the signal to the register.
- `risk_flags`: e.g. `theory_drift`, `flat_protocol`, `status_display`,
  `transfer_avoidance`, `over_challenge`.
- `register_history`: last two selected registers so the router can avoid
  repeating a failed stance. `mode_history` remains as a backward-compatible
  trace alias.

### Next Minimal Implementation/Eval Plan

1. Stop adding static charisma-floor cells. Cells 170--179 are now the diagnostic
   corpus for the pivot, not a ladder to continue.
2. Add a no-paid router stub that classifies existing scenario prompts and
   learner follow-ups into engagement registers, with quoted evidence and a
   deterministic fallback.
3. Replay or dry-run the router over the existing cells 170--179 transcripts to
   check whether it would have selected the register that the later manual
   ablation discovered.
4. Only after the router passes that audit, add one adaptive profile that uses
   the router-selected register inside id prompt construction.
5. Evaluate the adaptive profile against the two known stressors first:
   `charisma_desire_ai_syllabus_transfer` and
   `charisma_desire_plain_language_stress`, plus the two primary authority
   scenarios. Success means the same profile can choose different modes, not
   that one fixed mode wins all rows.

Bounded claim after the pivot:

> The cells 170--179 sequence shows that desire-for-recognition charisma is best
> treated as an engagement-state adaptation problem. Static charisma floors
> expose a repeatable v2.2/charisma tension; the next test is whether an
> explicit register router can choose the right rhetorical-pedagogical stance
> from learner signals.

Not licensed:

- a general charismatic-tutoring effect;
- a human-learning claim;
- a claim that cell 179, or any other static post-169 cell, is the new design
  target;
- a claim that engagement routing works before the router is implemented and
  evaluated.

### 2026-06-27 Router Implementation Gate

Implemented the minimal no-paid engagement-router target as
`cell_180_id_director_charisma_engagement_router_verified`.

Implementation:

- Added `services/engagementModeRouter.js`, a deterministic router that emits
  `learner_signal`, `selected_register`, `register_reason`, `evidence_span`,
  `risk_flags`, and `register_history`, with `selected_mode`, `mode_reason`, and
  `mode_history` retained as backward-compatible trace aliases.
- Fixed the initial register set to: `clarity`, `scaffolding`,
  `accountable_bid_authority`, `plain_compression`,
  `lived_stakes_reentry`, `transfer_grounding`, `charismatic_challenge`, and
  `witnessing_restraint`.
- Threaded `<engagement_state>` into id prompt construction for both id-director
  call paths and recorded the selected mode in dialogue trace, metadata, and
  `id_construction_trace`.
- Added the router profile to `config/tutor-agents.yaml` and
  `services/evaluationRunner.js`; the profile keeps cell 169's
  `accountable_bid_clean` charisma floor as fallback and turns on
  `engagement_mode_router: true`.
- Added `scripts/report-charisma-desire-router-stage0.js` and
  `exports/charisma-desire-router-stage0-sanity.md` as the no-paid sanity
  surface for profile registration and scenario-to-register routing.

Register-switch diagnostic:

- Added `charisma_desire_instruction_to_engagement_switch` as a router-only
  scenario. The initial learner turn asks for step-by-step instruction and
  should route to `scaffolding`; the follow-up says the steps feel like a
  worksheet and asks why the learner should care, so the router should switch to
  `charismatic_challenge`.
- This is a no-paid witness of the instructional-to-engagement transition. It is
  not part of the frozen static-cell pilot grid.

Status boundary:

- This closes the implementation gate for the router. The first paid smoke
  below opens, but does not close, the evaluation gate.
- No paper-side generalizability result should be claimed until `cell_180`
  survives a larger frozen pilot matrix and at least one judge or model
  robustness check.

Paid router smoke:

- Run `eval-2026-06-27-bf8bc904` tested
  `cell_180_id_director_charisma_engagement_router_verified` across five
  scenarios: authority-withheld, status-challenge, AI-syllabus transfer,
  plain-language stress, and the instruction-to-engagement switch diagnostic.
- Stack: Codex GPT-5.5 ego, Claude Code Sonnet 4.6 id, Codex CLI v2.2 judge,
  and Claude Code Sonnet charisma judge. Generation completed 5/5 with
  required/forbidden validation clean on every row.
- Persisted scoring summary:

| Scenario | v2.2 first | v2.2 last | v2.2 avg | Charisma | Required | Forbidden |
|---|---:|---:|---:|---:|:---:|:---:|
| authority-withheld | 85.0 | 92.5 | 90.8 | 71.2 | yes | yes |
| status-challenge | 68.8 | 100.0 | 84.4 | 81.3 | yes | yes |
| AI-syllabus transfer | 92.5 | 96.2 | 94.4 | 68.8 | yes | yes |
| plain-language stress | 81.3 | 92.5 | 86.9 | 71.3 | yes | yes |
| instruction-to-engagement switch | 80.0 | 95.0 | 87.5 | 81.3 | yes | yes |

- The switch row's `id_construction_trace` records turn 1 as `scaffolding`
  with evidence `step by step`, then turn 2 as `charismatic_challenge` with
  evidence `Why should I care`. This witnesses the intended move from
  instructional to engagement register.
- Interpretation: this is a clean paid smoke for the router surface, not a
  general passing design. The primary positive signal is validation cleanliness
  plus improved second-turn adaptation in every smoke scenario. The main caveat
  is that charisma remains scenario-sensitive, with AI-syllabus transfer scoring
  lowest on the charisma rubric despite strong v2.2 pedagogy.

Paid comparator matrix:

- Runs `eval-2026-06-27-a9e8e0ed` and `eval-2026-06-27-1ecb6a90`
  completed the next evidence step: cell 180 vs cells 163 and 169 on the
  high-powered CLI stack, plus the native `budget` floor. Detailed table:
  `exports/charisma-desire-router-comparator-summary.md`.
- Aggregate persisted scores:

| Profile | n | v2.2 first | v2.2 last | v2.2 avg | Charisma | Validation |
|---|---:|---:|---:|---:|---:|:---:|
| cell 180 router | 5 | 91.3 | 97.0 | 94.1 | 66.3 | 5/5 |
| cell 169 accountable-bid clean | 5 | 86.8 | 95.3 | 90.7 | 75.5 | 5/5 |
| cell 163 warm agency-return floor | 5 | 83.8 | 88.8 | 86.5 | 71.0 | 5/5 |
| budget floor | 5 | 40.8 | 35.8 | 37.9 | 4.0 | 5/5 |

- Interpretation: cell 180 is the strongest v2.2 tutor across this small
  matrix, but it is not the strongest charisma design. Cell 169 remains stronger
  on charisma overall and on status-challenge/AI-transfer. Cell 163 wins the
  switch diagnostic on charisma. Therefore cell 180 is not a general passing
  design.
- Router trace nevertheless confirms the mechanism surface: authority-withheld
  routes to accountable-bid authority, status challenge routes from
  accountable-bid authority to plain compression, transfer routes to transfer
  grounding, plain-language routes from plain compression to lived-stakes
  re-entry, and the switch diagnostic routes from `scaffolding` to
  `charismatic_challenge`.
- Trace caveat: three id-construction turns used the minimal-persona fallback
  after malformed id JSON: cell 163 AI-transfer turn 2, cell 169
  status-challenge turn 1, and cell 180 AI-transfer turn 2. The next design
  target is therefore an id-output contract/repair pass plus register-specific
  charisma repair for transfer and switch, not another static charisma-floor
  cell.

### 2026-06-27 Cell 181 Contract/Repair Design Gate

Implemented the next bounded design as
`cell_181_id_director_charisma_engagement_router_contract_repair_verified`.

Purpose:

- Preserve cell 180's engagement-register router and cell 169's
  `accountable_bid_clean` fallback.
- Reduce id-director fallback confounds by adding a strict compact JSON output
  contract plus opt-in malformed-JSON salvage. Salvaged constructions are
  explicitly marked `parse_status: salvaged_from_malformed_json` rather than
  silently treated as normal parsed JSON.
- Repair the two observed router-charisma weak points without adding another
  static floor: transfer grounding should carry one concrete failure case,
  decision-rights hinge, and learner-owned test; charismatic challenge should
  retain scaffolding but add a compact line that makes the task matter and keeps
  a refusal path.

Implementation:

- Added `id_output_contract: strict_compact_json` and
  `engagement_router_charisma_repair: true` profile factors.
- Threaded `<id_output_contract>` and
  `<engagement_router_charisma_repair>` into both id-director prompt paths.
- Added opt-in parser salvage for malformed id JSON. This targets the exact
  fallback failure seen in the comparator matrix while leaving standard
  id-director behavior unchanged.
- Extended the router Stage 0 report so it checks that the cell 181 profile is
  registered, keeps the accountable-bid fallback, uses the router, turns on the
  strict output contract, and enables router-charisma repair.

No-paid verification completed:

```bash
node --test services/__tests__/idDirectorEngine.test.js tests/charismaDesireRouterStage0.test.js

EVAL_SCENARIOS_FILE=config/charisma-recognition-desire-scenarios.yaml \
  node scripts/eval-cli.js validate-config \
  --profile cell_181_id_director_charisma_engagement_router_contract_repair_verified

node scripts/report-charisma-desire-router-stage0.js --check

tmpdir=$(mktemp -d)
EVAL_DB_PATH="$tmpdir/evaluations.db" \
EVAL_LOGS_DIR="$tmpdir/logs" \
EVAL_SCENARIOS_FILE=config/charisma-recognition-desire-scenarios.yaml \
  node scripts/eval-cli.js run \
  --profiles cell_181_id_director_charisma_engagement_router_contract_repair_verified \
  --scenario charisma_desire_ai_syllabus_transfer,charisma_desire_instruction_to_engagement_switch \
  --runs 1 \
  --parallelism 1 \
  --dry-run \
  --skip-rubric \
  --description "cell 181 contract repair dry run"
rm -rf "$tmpdir"

node --test tests/regression-bug-007.test.js tests/superego-guard.test.js tests/configOverrideBoundary.test.js
```

Results:

- Focused id-director/router tests passed.
- Config validation loaded 186 cells, verified all 185 eval-only profiles, and
  reported zero warnings and zero errors for cell 181.
- Router Stage 0 check passed across 11 routing cases.
- Hermetic dry-run completed two targeted scenarios with no production DB or log
  writes.
- Registry/config regression suite passed 1,347 tests.

Next paid gate:

- Run a two-scenario repair smoke for cell 181 on
  `charisma_desire_ai_syllabus_transfer` and
  `charisma_desire_instruction_to_engagement_switch`.
- Compare against the existing cell 180 smoke/comparator rows, not a freshly
  expanded matrix.
- Acceptance for moving beyond the repair smoke: required/forbidden validation
  clean, no minimal-persona fallback in `id_construction_trace`, v2.2 remains
  near cell 180's level on both scenarios, and charisma improves on at least one
  of the two targeted weak points without introducing status-display language.

Paid repair smoke completed:

- Run `eval-2026-06-27-a9a4c920` tested
  `cell_181_id_director_charisma_engagement_router_contract_repair_verified`
  on AI-syllabus transfer and the instruction-to-engagement switch diagnostic.
  Stack: Codex GPT-5.5 ego, Claude Code Sonnet 4.6 id, Codex CLI v2.2 judge,
  and Claude Code Sonnet charisma judge.
- Reproducible summary:
  `exports/charisma-desire-cell181-repair-smoke-summary.md`, generated by
  `node scripts/report-charisma-desire-cell181-repair-smoke.js`.
- Persisted scoring summary:

| Scenario | v2.2 first | v2.2 last | v2.2 avg | Charisma | Required | Forbidden |
|---|---:|---:|---:|---:|:---:|:---:|
| AI-syllabus transfer | 96.2 | 93.8 | 95.0 | 71.2 | yes | yes |
| instruction-to-engagement switch | 85.0 | 93.8 | 89.4 | 78.8 | yes | yes |

- Trace result: all four id-construction turns have `parse_status: ok`; no
  minimal-persona fallback was used. Router registers matched the intended
  pattern: transfer stayed in `transfer_grounding`, while the switch diagnostic
  moved from `scaffolding` to `charismatic_challenge`.
- Comparison to existing cell 180 evidence: AI-transfer charisma improved over
  both existing cell 180 rows while staying within five v2.2 points of the
  strongest cell 180 row. The switch diagnostic improved charisma over the
  comparator-matrix cell 180 row but remained slightly below the earlier
  router-smoke cell 180 switch row.
- Interpretation: cell 181 clears the bounded contract/repair smoke, but it is
  not yet a general passing design. The next evidence step should be a small
  cell 180 vs cell 181 repeat matrix on the two targeted scenarios, not a broad
  generalizability claim.

Paid repeat matrix completed:

- Run `eval-2026-06-27-e3fb5eb2` tested cell 180 vs cell 181 on the two targeted
  scenarios with three repeats per profile-scenario: 2 scenarios x 2 profiles x
  3 repeats = 12 rows. Stack: Codex GPT-5.5 ego, Claude Code Sonnet 4.6 id,
  Codex CLI v2.2 judge, and Claude Code Sonnet charisma judge.
- Reproducible summary:
  `exports/charisma-desire-cell181-repeat-matrix-summary.md`, generated by
  `node scripts/report-charisma-desire-cell181-repeat-matrix.js`.
- All 12 rows generated, scored under v2.2, scored under charisma, and passed
  required/forbidden validation.

Aggregate persisted scores:

| Scenario | Profile | n | v2.2 first | v2.2 last | v2.2 avg | Charisma | Charisma range | Validation |
|---|---:|---:|---:|---:|---:|---:|---|:---:|
| AI-syllabus transfer | cell 180 | 3 | 89.2 | 96.7 | 92.9 | 57.9 | 52.5--68.8 | 3/3 |
| AI-syllabus transfer | cell 181 | 3 | 82.9 | 95.4 | 89.2 | 63.8 | 46.2--80.0 | 3/3 |
| instruction-to-engagement switch | cell 180 | 3 | 76.7 | 95.8 | 86.3 | 74.2 | 62.5--85.0 | 3/3 |
| instruction-to-engagement switch | cell 181 | 3 | 68.8 | 93.8 | 81.3 | 81.3 | 78.7--82.5 | 3/3 |

Trace result:

- No id minimal-persona fallback occurred. All id-construction turns were
  `parse_status: ok` except one cell 181 scaffolding turn parsed
  `ok_via_jsonrepair`.
- Router registers matched the intended shape: transfer rows stayed in
  `transfer_grounding`, and switch rows moved from `scaffolding` to
  `charismatic_challenge`.
- One cell 181 `charismatic_challenge` turn failed the agency-return verifier:
  it asked for phenomenological self-report rather than a specific content test.

Interpretation:

- Cell 181 raises charisma means over cell 180 in both targeted scenarios
  (+5.8 on AI-transfer, +7.1 on switch), but trails v2.2 means in both
  scenarios (-3.8 on AI-transfer, -5.0 on switch). It is therefore a
  charisma-biased repair, not a general passing design.
- The switch repair is the cleaner positive result: charisma rises to 81.3 with
  a narrow 78.7--82.5 range while second-turn v2.2 remains strong. AI-transfer
  is weaker: charisma improves modestly, variance widens, and first-turn v2.2
  quality falls.
- Next design target: preserve the cell 181 `charismatic_challenge` repair for
  the switch register, but repair the first-turn/transfer floor. A candidate
  cell 182 should keep the strict id-output contract, make `transfer_grounding`
  more concise and less theatrical, and add a hard agency-return content test
  for `charismatic_challenge`.

### 2026-06-27 Cell 182 Split-Repair Smoke

Implemented
`cell_182_id_director_charisma_engagement_router_split_repair_verified` as the
direct successor to cell 181.

Design intent:

- Preserve cell 181's strict compact JSON id-output contract and parser-salvage
  path.
- Preserve the useful `charismatic_challenge` switch repair, but require a hard
  content-anchored agency-return test so the cell 181 self-report failure cannot
  recur.
- Make `transfer_grounding` shorter, more instructional, and less theatrical:
  one concrete failure, one decision-rights hinge, one direct content test.

No-paid verification:

- Focused id-director/router tests passed:
  `node --test services/__tests__/idDirectorEngine.test.js tests/charismaDesireRouterStage0.test.js`.
- Config validation passed for cell 182 under
  `EVAL_SCENARIOS_FILE=config/charisma-recognition-desire-scenarios.yaml`.
- Router Stage 0 `--check` passed.
- Hermetic dry-run passed on AI-transfer and instruction-to-engagement switch
  with temp DB/log paths.

Paid smoke:

- Run `eval-2026-06-27-a07768fe` tested cell 182 on AI-transfer and the
  instruction-to-engagement switch diagnostic. Stack: Codex GPT-5.5 ego, Claude
  Code Sonnet 4.6 id, Codex CLI v2.2 judge, and Claude Code Sonnet charisma
  judge.
- Reproducible summary:
  `exports/charisma-desire-cell182-smoke-summary.md`, generated by
  `node scripts/report-charisma-desire-cell182-smoke.js`.

Persisted scores:

| Scenario | v2.2 first | v2.2 last | v2.2 avg | Charisma | Required | Forbidden |
|---|---:|---:|---:|---:|:---:|:---:|
| AI-syllabus transfer | 93.8 | 97.5 | 95.6 | 55.0 | yes | yes |
| instruction-to-engagement switch | 80.0 | 100.0 | 90.0 | 87.5 | yes | yes |

Trace result:

- All four id-construction turns have `parse_status: ok`.
- No minimal-persona fallback or salvage was needed.
- All four agency-return verifier checks passed.
- Router registers matched the intended pattern: transfer rows stayed in
  `transfer_grounding`, and the switch moved from `scaffolding` to
  `charismatic_challenge`.

Interpretation:

- Cell 182 is a partial repair. It restores strong v2.2 performance on both
  targeted rows and fixes the cell 181 agency-return miss.
- The tradeoff moved rather than disappeared. The switch row is strong
  (v2.2 90.0, charisma 87.5), but AI-transfer charisma falls to 55.0, below both
  cell 180 and cell 181 repeat-matrix means.
- Next design target: preserve the cell 182 agency discipline and switch
  strength, but restore a concise charismatic signal inside `transfer_grounding`
  without returning to theatrical prose. A candidate cell 183 should add a
  transfer-specific "named-stake line" rather than broad presence or dramatic
  scene-setting.

Cell 183 transfer-stake smoke:

- Added
  `cell_183_id_director_charisma_engagement_router_transfer_stake_repair_verified`
  as a one-factor extension of cell 182. The new
  `engagement_router_transfer_stake_repair` factor keeps one concrete failure,
  one decision-rights hinge, and one direct content test for
  `transfer_grounding`, then adds exactly one named-stake sentence.
- Run `eval-2026-06-27-49aeaa2c` tested cell 183 on AI-transfer and the
  instruction-to-engagement switch diagnostic. Stack: Codex GPT-5.5 ego,
  Claude Code Sonnet 4.6 id, Codex CLI v2.2 judge, and Claude Code Sonnet
  charisma judge.
- Reproducible summary:
  `exports/charisma-desire-cell183-smoke-summary.md`, generated by
  `node scripts/report-charisma-desire-cell183-smoke.js`.

Persisted scores:

| Scenario | v2.2 first | v2.2 last | v2.2 avg | Charisma | Required | Forbidden |
|---|---:|---:|---:|---:|:---:|:---:|
| AI-syllabus transfer | 83.7 | 96.3 | 90.0 | 51.2 | yes | yes |
| instruction-to-engagement switch | 80.0 | 100.0 | 90.0 | 75.0 | yes | yes |

Trace result:

- All four id-construction turns have `parse_status: ok`.
- No minimal-persona fallback or salvage was needed.
- Required and forbidden validation passed on both rows.
- The AI-transfer turns passed the agency-return verifier.
- The switch challenge turn failed the agency-return verifier because the draft
  affirmed the learner's partial uptake with premature certainty (`exactly`).

Interpretation:

- Cell 183 is not a repair. The named-stake line worsened the transfer row
  relative to cell 182 (v2.2 90.0 vs 95.6; charisma 51.2 vs 55.0) and weakened
  the switch row's charisma (75.0 vs 87.5) while introducing a trace-level
  agency-return failure.
- Do not continue by adding more stake language to `transfer_grounding`. The
  next target should recover charisma through register discipline,
  content-level compression, or a different transfer-specific authority cue
  while preserving cell 182's agency-return close and avoiding premature
  certainty in `charismatic_challenge`.

Design exclusion from cell 183:

- Do not repeat the named-stake repair as the next transfer design. It did not
  restore charisma, weakened the switch row, and introduced a
  premature-certainty agency-return failure.
- Future transfer repairs should preserve cell 182's concise agency discipline
  and treat cell 183's added stake sentence as a negative control, not as a
  promising ingredient.

Cell 184 transfer-compression plus certainty-guard smoke:

- Added
  `cell_184_id_director_charisma_engagement_router_transfer_compression_guard_verified`
  as a one-factor successor to cell 182 that explicitly rejects the failed
  cell 183 stake move. The new `engagement_router_transfer_compression_repair`
  factor asks `transfer_grounding` to use one decisive content handle, one
  criterion, and one direct artifact audit. The new
  `agency_return_premature_certainty_guard` factor removes premature-certainty
  wording such as `exactly` before agency-return verification.
- Also patched the engagement-router history extractor so the local
  `trace.turns` internal-deliberation shape can supply prior registers, matching
  the dialogue trace path used by evaluated runs.
- Run `eval-2026-06-27-eb5f4244` tested cell 184 on AI-transfer and the
  instruction-to-engagement switch diagnostic. Stack: Codex GPT-5.5 ego,
  Claude Code Sonnet 4.6 id, Codex CLI v2.2 judge, and Claude Code Sonnet
  charisma judge.
- Reproducible summary:
  `exports/charisma-desire-cell184-smoke-summary.md`, generated by
  `node scripts/report-charisma-desire-cell184-smoke.js`.

Persisted scores:

| Scenario | v2.2 first | v2.2 last | v2.2 avg | Charisma | Required | Forbidden |
|---|---:|---:|---:|---:|:---:|:---:|
| AI-syllabus transfer | 93.8 | 96.2 | 95.0 | 56.3 | yes | yes |
| instruction-to-engagement switch | 82.5 | 98.8 | 90.6 | 81.3 | yes | yes |

Trace result:

- All four id-construction turns have `parse_status: ok`.
- No minimal-persona fallback or salvage was needed.
- Required and forbidden validation passed on both rows.
- All four agency-return verifier checks passed.
- Router registers matched the intended pattern: transfer rows stayed in
  `transfer_grounding`, and the switch moved from `scaffolding` to
  `charismatic_challenge`.
- The certainty guard did not need to repair the live row because the generated
  challenge avoided the cell 183 premature-certainty wording.

Interpretation:

- Cell 184 is a clean infrastructure and agency smoke, but not a general
  passing transfer-charisma design.
- It preserves the useful parts of the alternate: high v2.2 quality, clean
  validation, no id fallback, and no agency-return failure. It also improves
  transfer charisma relative to cell 182 and cell 183, but only marginally:
  AI-transfer charisma 56.3 vs cell 182's 55.0 and cell 183's 51.2.
- It still fails the substantive transfer-charisma target because 56.3 remains
  below the cell 180 repeat mean (57.9) and the cell 181 repeat mean (63.8).
  The next target should keep the 184 certainty guard and validation discipline,
  but pure decisive-handle compression is not enough charisma signal.

Adaptation-slice audit:

- The whole-transcript comparisons above were not fully apples-to-apples for
  the register-change question. They mixed the pre-adaptation instructional
  setup turn, the post-adaptation challenge turn, scenario content difficulty,
  and dialogue-level style into one charisma score.
- Added `scripts/report-charisma-desire-adaptation-slices.js`, which extracts
  tutor-turn slices from the existing switch-scenario rows, attaches per-turn
  v2.2 scores from `tutor_scores`, attaches register/agency metadata from
  `id_construction_trace`, and scores each slice with the Weber charisma rubric
  using Claude Code Sonnet. Scores are cached in
  `exports/charisma-desire-adaptation-slices.json`; the reproducible report is
  `exports/charisma-desire-adaptation-slices-summary.md`.
- Scope: 15 existing `charisma_desire_instruction_to_engagement_switch` rows
  across the budget floor, non-router charismatic controls (cells 163 and 169),
  and router-family cells 180--184. This produced 30 tutor-turn slices: turn 0
  pre-instructional setup and turn 1 post-adaptation challenge.

Persisted slice result:

| Slice group | n | Post-switch charisma | Pre-to-post charisma delta | Post-switch v2.2 |
|---|---:|---:|---:|---:|
| budget floor | 1 | 21.3 | 21.3 | 55.0 |
| non-router charismatic controls | 2 | 81.9 | 14.4 | 95.6 |
| router register family | 12 | 78.1 | 7.1 | 96.4 |

Interpretation:

- The learner setup is sufficient to make the default/budget control fail: the
  budget post-switch slice scores charisma 21.3.
- It is not sufficient to make the stronger non-router charismatic controls
  fail. Cell 163 and cell 169, without the explicit engagement-register router,
  average 81.9 on the same post-switch slice, above the router-family mean of
  78.1. Their mean pre-to-post charisma delta (14.4) is also above the router
  family delta (7.1).
- Therefore the current corpus disconfirms the register-change-specific
  charisma claim. It does not show that register change is useless in general;
  it shows that this scenario and these controls do not isolate register change
  as the causal source of post-switch charisma.
- Stop static ablation and prompt tuning for this branch until a new
  preregistered design separates three things: default floor failure,
  non-router charismatic control failure, and register-router uplift on the
  same post-adaptation slice.

Register-effect decomposition:

- Added `scripts/report-charisma-desire-register-effects.js` as a no-new-cells,
  no-new-model-calls decomposition of the same 15 switch rows and 30 tutor-turn
  slices. It reads the database, reuses the cached slice-charisma scores from
  `exports/charisma-desire-adaptation-slices.json`, and writes
  `exports/charisma-desire-register-effects-summary.md` plus a JSON detail file.
- The process intervention worked: router-family rows selected `scaffolding` on
  12/12 pre-instruction turns and `charismatic_challenge` on 12/12
  post-adaptation turns.
- The outcome intervention did not isolate charisma: router-family post-slice
  charisma is 78.1 versus 81.9 for the two non-router charismatic controls, and
  router pre-to-post charisma delta is 7.1 versus 14.4 for controls.
- The outcome intervention also does not isolate general v2.2 quality:
  router-family post-turn v2.2 is 96.4 versus 95.6 for non-router controls.
  Both are far above the budget floor at 55.0.
- The plausible effect is narrower: agency-return/defeasible-authority
  discipline after the learner rejects worksheet-like instruction. Router-family
  post-turn agency-return pass rate is 83% versus 50% for the two non-router
  controls. This remains exploratory because cells 181 and 183 still include
  failures, and the non-router comparator has only two rows.
- The v2.2 dimensions reinforce the bounded reading. Router post-turn slices
  are tied with controls at ceiling on perception, elicitation, adaptive
  responsiveness, and recognition; they show small edges on epistemic integrity
  (+0.42 raw rubric points) and content accuracy (+0.33), but not a broad
  pedagogical-quality advantage.
- Revised design target: stop treating "more charisma" as the next dependent
  variable. If more evidence is needed, isolate post-adaptation
  agency-return/defeasible-authority outcomes directly, using transcript slices
  rather than whole-dialogue charisma scores.

Resistance-breakthrough reframing:

- The deeper target is not whether a tutor turn scores higher on charisma after
  a register switch. It is whether a charismatic register, triggered by
  resistant learner discourse, breaks through that resistance into renewed
  learner work.
- Added successor scenario
  `charisma_desire_resistance_breakthrough_probe`, leaving the historical
  `charisma_desire_instruction_to_engagement_switch` rows reproducible as the
  older trigger diagnostic. The new probe keeps the same first instructional
  request, then requires the dynamic learner's first reply after instruction to
  carry a resistant signal: boredom, frustration, irrelevance, excessive
  questioning, or formula/rote-parroting. The target tutor move is
  `charismatic_challenge`.
- Added `turn_2_breakthrough_probe` as a scripted shape check for what uptake
  would look like, but the scenario text explicitly marks it as non-evidence
  unless produced by a dynamic learner. This prevents circularly counting a
  YAML-authored breakthrough as an outcome.
- Patched the router so frustration/annoyance/fed-up language, irrelevance,
  question-flooding, and rote-parroting/formula language are included in the
  `charismatic_challenge` trigger set after instructional history, not only
  boredom/worksheet language.
- Added `scripts/report-charisma-desire-breakthrough-probe.js`. The report
  validates the scenario and, when rows exist, scores the local transition:
  generated resistant learner signal -> `charismatic_challenge` tutor turn ->
  generated learner uptake. Rows with scripted post-challenge learner turns are
  labelled `scripted_not_outcome_evaluable`; rows where the challenge fires too
  late or without a generated post-challenge learner turn are also excluded.
- Added `cell_185_id_director_charisma_resistance_breakthrough_dynamic_verified`
  as the dynamic-learner probe cell. It keeps cell 184's tutor-side router,
  split repair, transfer-compression repair, and premature-certainty guard, but
  switches the learner architecture to `ego_superego`.
- Added a shared CLI provider bridge so dynamic learner generation can use the
  local `codex` and `claude-code` CLI providers instead of falling back to
  OpenRouter. Learner config now treats both CLI providers as configured without
  API keys.
- Current dynamic smoke: `eval-2026-06-27-c299ef0c`, Codex-only CLI stack
  (`codex.gpt-5.5` for tutor ego/id and learner ego/superego), one run on
  `charisma_desire_resistance_breakthrough_probe`, generation-only
  (`--skip-rubric`). It completed 1/1 with required/forbidden validation clean.
  The report `exports/charisma-desire-breakthrough-probe-summary.md` finds one
  outcome-eligible dynamic transition: generated boredom ("still bored" /
  "vocabulary drill") -> `charismatic_challenge` with resistance signal
  `boredom` -> generated renewed learner work ("less bored now"; durable
  existence and fear test). Lexical score 95, verdict
  `candidate_breakthrough`.
- Non-evidence cleanup: an attempted mixed Codex/Claude CLI run hit the local
  Claude weekly quota before producing a usable row, and two Codex-only probes
  before binding `learner_persona: resistant_signal_probe` produced compliant
  learner uptake rather than resistance. Those runs were deleted to avoid
  contaminating the scenario id with superseded config hashes.
- Current status: single-row instrument proof. This supports the shape of the
  resistance-breakthrough measurement, not a general passing design.

Controlled resistance-breakthrough matrix:

- Added a static dynamic-learner comparator,
  `cell_186_id_director_charisma_static_floor_breakthrough_dynamic_verified`,
  to compare the router cell against the same dynamic learner setup without
  engagement routing.
- Added five controlled scenario variants:
  `charisma_desire_resistance_breakthrough_boredom`,
  `charisma_desire_resistance_breakthrough_frustration`,
  `charisma_desire_resistance_breakthrough_irrelevance`,
  `charisma_desire_resistance_breakthrough_question_flood`, and
  `charisma_desire_resistance_breakthrough_rote_parroting`. Each variant binds
  a target-specific dynamic learner persona and target signal while inheriting
  the same instructional setup.
- Added scenario inheritance support in `services/evalConfigLoader.js` so the
  controlled variants can `extends` the base probe without losing runner-visible
  fields such as `type`, `turns`, validation gates, and diagnostic metadata.
- Added `scripts/report-charisma-desire-breakthrough-matrix.js`, which scores
  the local transition as: first generated learner turn matching the target
  resistance signal -> tutor register on that turn -> immediate generated
  learner uptake. This corrects the earlier risk of counting a later
  charismatic route after the learner had already improved.
- Paid Codex-only dynamic matrix `eval-2026-06-27-900c1435` completed 10/10
  generation rows, generation-only (`--skip-rubric`). The report outputs are
  `exports/charisma-desire-breakthrough-matrix-summary.md` and
  `exports/charisma-desire-breakthrough-matrix.json`.
- Corrected report result: router cell 185 has 4/5 eligible target-resistance
  transitions, 4/5 charismatic route hits, and 2/5 candidate breakthroughs.
  Static cell 186 has 5/5 eligible transitions, 0/5 route hits, and 2/5
  candidate breakthroughs.
- The only router candidate with a charismatic route at the resistant turn is
  the irrelevance case. The boredom case breaks through in the router arm, but
  the router selected `witnessing_restraint`, not `charismatic_challenge`;
  boredom also breaks through in the static comparator. Frustration and
  rote-parroting become high-quality partial uptake because the learner still
  marks the same resistance afterward. Question-flood remains a weak/failed
  target: the router row did not produce the target resistance in the learner
  turn, and the static row stayed question-heavy after the tutor turn.
- Interpretation: this is not yet a general passing design. The matrix supports
  a narrower hypothesis that charismatic challenge can sometimes recover
  irrelevance-style resistance, but it does not yet show broad breakthrough
  across resistant learner signals, nor a router advantage over a strong static
  dynamic comparator.

Mechanism pass for generalized resistance handling:

- Added `cell_187_id_director_charisma_resistance_tuned_breakthrough_dynamic_verified`
  as the next design target. This preserves cell 185's dynamic learner, router,
  id-output contract, split/transfer-compression repair, warmth-preserving
  agency-return verifier, and premature-certainty guard, but adds
  `engagement_router_resistance_tuning: true`.
- The router now separates the three mechanisms requested by the active goal:
  it identifies a `resistance_signal`, adopts the `charismatic_challenge`
  register when instructional scaffolding is exhausted, and emits a
  `resistance_strategy` plus `resistance_move` that tunes the challenge.
- Current strategies:
  - `boredom` -> `concrete_scene_test`: replace list/steps with one concrete
    scene or object the learner can use to test the hinge.
  - `frustration` -> `stuck_step_resolution`: name the stuck step, give one
    textual/conceptual anchor, and ask for a forced-choice reconstruction.
  - `irrelevance` -> `owned_case_transfer`: move the claim into a learner-owned
    case and let the learner judge whether it proves or breaks the claim.
  - `question_flood` -> `question_collapse`: collapse many questions into one
    decisive hinge and require provisional commitment before more questions.
  - `rote_parroting` -> `anti_formula_generation`: forbid the next use of
    formula terms and require a fresh sentence or example.
- Fixed a classification failure from the matrix: the old router treated
  "Honestly, this still feels kind of dead..." as vulnerability because
  "honestly" was a standalone vulnerability trigger. It no longer is; dead,
  list-like, and moving-arrows evidence now count as boredom after scaffolding.
- Tightened the question-flood learner prompt so the first resistant learner
  turn must ask at least three explicit question-mark questions; the prior
  dynamic draw often produced one careful skeptical question instead of the
  target resistance.
- Updated the matrix reporter so pre-run validation checks all three fields:
  expected register, expected resistance signal, and expected resistance
  strategy. It also recognizes future `cell_187` rows as `router_tuned` while
  preserving existing cell 185/186 evidence.
- No paid eval was launched for cell 187 in this pass. No-paid verification
  passed: syntax checks; router, id-director, and matrix tests; config
  validation for cells 185/186/187; config boundary/regression/superego guard
  tests; and matrix report `--check`.
- Cleanup: attempted `--dry-run` proved non-hermetic for this standard runner
  path and wrote a no-key test artifact (`eval-2026-06-27-71f7f535`). It was
  deleted from `evaluation_runs`, `evaluation_results`, and the progress log.

Resistance-tuned paid matrix:

- `eval-2026-06-27-4bb10da5`: five target resistance signals
  (boredom, frustration, irrelevance, question-flood, rote-parroting) x cells
  185/186/187, one Codex-only dynamic repeat each, generation-only. The run
  completed 15/15 successful rows with no empty outputs.
- Reproducible summary:
  `exports/charisma-desire-breakthrough-matrix-summary.md`, generated by
  `node scripts/report-charisma-desire-breakthrough-matrix.js --run-id eval-2026-06-27-4bb10da5`.
- Result: cell 185 router had 5/5 eligible target-resistance transitions,
  5/5 route hits, and 2/5 candidate breakthroughs. Static cell 186 had 5/5
  eligible transitions, 0/5 route hits, and 4/5 candidate breakthroughs. Tuned
  router cell 187 had 3/5 eligible transitions, 5/5 route hits, and 1/5
  candidate breakthrough.
- Cell 187's detection and register adoption are better than the prior router
  failure mode, but resistance tuning does not yet overcome resistance
  generally. It misses required validation on the boredom row, loses the
  target-resistance gate on irrelevance, and leaves frustration and
  rote-parroting as partial uptake because the learner still marks the same
  resistance afterward.
- The strongest routed cell 187 result is question-flood via
  `question_collapse`. The broader success pattern across static and routed
  rows is not "more challenge"; it is a concrete owned case plus an explicit
  failure test that lets the learner decide whether the framing holds.

Next design target:

- Add `cell_188_id_director_charisma_resistance_owned_test_breakthrough_dynamic_verified`
  as a one-factor successor to cell 187. Keep resistance identification and
  strategy metadata, but express the charismatic switch as a concrete
  learner-owned test: short acknowledgement, case/object/passage, criterion or
  failure condition, and a decision right. This tests whether the effective
  mechanism is routed charismatic authority that earns attention by handing the
  test to the learner, not routed forcefulness.
- Decision should remain local: generated target resistance -> routed
  register/strategy -> immediate generated learner uptake. Do not use
  whole-dialogue averages as the decision rule.

Cell 188 implementation gate:

- Added `engagement_router_resistance_owned_test: true` as an opt-in
  id-director flag. Like cell 187, it keeps `resistance_strategy` visible to
  the id, but the prompt requires an owned-test shape rather than escalation:
  acknowledgement, case/object/passage, criterion or failure condition, and
  learner decision right.
- Registered
  `cell_188_id_director_charisma_resistance_owned_test_breakthrough_dynamic_verified`
  in `config/tutor-agents.yaml` and `services/evaluationRunner.js`; updated the
  matrix reporter to classify it as `router_owned_test`.
- Paid smoke `eval-2026-06-28-e0530961`: five target resistance signals x cell
  188, one Codex-only dynamic repeat each, generation-only. The run completed
  5/5 successful rows. Combined with `eval-2026-06-27-4bb10da5`, the local
  reporter gives cell 188 4/5 eligible target-resistance transitions, 5/5 route
  hits, and 3/5 candidate breakthroughs.
- Cell 188 repairs the visible failure on boredom, preserves the irrelevance
  success, and newly turns rote-parroting into passage-based learner judgment.
  Frustration remains partial because the learner still says "still
  frustrated"; question-flood is not outcome-eligible in this draw because the
  flood appears as the final learner turn rather than the resistant turn being
  answered.
- The generated cell 188 rows all fail the older DB required-phrase gate, which
  looked for narrow tokens such as `try`/`test`/`version` or
  `frustrated`/`dead`/`formula`. This is a stale validation gate for the
  owned-test design, not a forbidden-word failure. The scenario required-any
  lists were widened after the smoke to accept owned-test vocabulary such as
  passage, criterion, failure, choose, decide, quote, counterexample, and apply
  for future rows. Do not treat the existing DB validation columns as repaired.

Cell 189 failed precision-repair branch:

- Added
  `cell_189_id_director_charisma_resistance_precision_breakthrough_dynamic_verified`
  as a narrow successor to cell 188 for the two remaining failures:
  frustration and question-flood. The new
  `engagement_router_resistance_precision_repair` flag told the id-director to
  use a forced contrast for frustration and a bracket/collapse move for
  question-flood.
- Paid smoke `eval-2026-06-28-31600860`: frustration and question-flood x cell
  189, one Codex-only dynamic repeat each, generation-only. The run completed
  2/2 successful rows with no empty outputs and DB required/forbidden
  validation clean.
- Reproducible summary:
  `exports/charisma-desire-breakthrough-matrix-summary.md`, generated by
  `node scripts/report-charisma-desire-breakthrough-matrix.js --run-id eval-2026-06-27-4bb10da5,eval-2026-06-28-e0530961,eval-2026-06-28-31600860`.
- Result: cell 189 produced 0/2 candidate breakthroughs. The frustration row
  became content-bearing work but still carried "still frustrated" language.
  The question-flood row was not outcome-eligible because the dynamic learner
  produced a single careful objection rather than the target question flood.
- Interpretation: do not continue the prompt-level precision-repair line. The
  next evidence target is measurement control: enforce the resistant
  precondition for dynamic learner turns and distinguish affective persistence
  from productive work under frustration.

Dynamic resistance-signal gate:

- Added `services/resistanceSignalGate.js` and threaded it through the standard
  multi-turn runner at the dynamic learner override point. For scenarios marked
  `resistance_breakthrough_diagnostic: true` with a `resistance_signal_target`,
  the first generated `resistant_followup` is now classified against the target
  signal. If it misses, the runner retries the learner with a learner-only
  correction prompt up to `resistance_signal_gate_max_attempts` while keeping
  the accepted turn dynamic rather than copying the YAML example.
- The gate currently covers boredom, frustration, irrelevance, question-flood,
  and rote-parroting. Question-flood is deliberately stricter than the router
  trigger: it requires at least three question marks so a single thoughtful
  objection is not counted as excessive questioning.
- Gate attempts are attached to the dialogue log as
  `learnerResistanceSignalGate`, and rejected attempt token usage is counted in
  the run metrics. This makes future analysis able to separate "tutor failed to
  break resistance" from "the target resistant condition was never witnessed."
- Updated the matrix reporter to show gate attempts when present and to label
  frustration rows as `productive_frustration_work` when the learner still says
  they are frustrated but proceeds with content-bearing work. This is not a
  breakthrough label; it is a separate carry-through outcome for the frustration
  subtype.

Gated 5-signal matrix:

- Runs `eval-2026-06-28-179effc6` and `eval-2026-06-28-0df6b0db` form the first
  full gated single-repeat matrix: five resistance signals x cell 188 versus
  static floor cell 186, Codex-only dynamic learner stack, generation-only. All
  ten rows completed successfully, all ten target gates matched on the first
  attempt, and no empty outputs were recorded.
- DB validation: cell 188 passed required and forbidden validation in all 5/5
  rows. The static floor passed forbidden validation in 5/5 rows but required
  validation in 3/5 rows.
- Local transition summary from
  `exports/charisma-desire-breakthrough-matrix-summary.md`: static floor had
  5/5 eligible rows, 1/5 candidate breakthroughs, 1/5 positive local outcomes,
  0/5 route hits, and mean local score 72.0. Cell 188 had 5/5 eligible rows,
  3/5 candidate breakthroughs, 4/5 positive local outcomes, 5/5 route hits, and
  mean local score 87.0.
- Mechanism reading:
  - Identifying resistance is now clean in this controlled slice: gate matched
    10/10 target signals, and the router identified all 5/5 target signals for
    cell 188.
  - Register adoption is clean for cell 188: all 5/5 resistant follow-ups route
    to `charismatic_challenge`.
  - Tuning is mostly but not fully general: owned-test tuning breaks through
    boredom, irrelevance, and question-flood; it converts frustration into
    productive content-bearing work; it leaves rote-parroting as partial uptake
    because the learner still frames the response as formula repetition.
- Interpretation: cell 188 is the first credible general mechanism candidate
  for this controlled simulated family, but not yet a fully passing design
  across all resistance subtypes. The unresolved subtype is rote-parroting.

Cell 190 own-language repair:

- Added
  `cell_190_id_director_charisma_resistance_generation_breakthrough_dynamic_verified`
  as a one-factor successor to cell 188. It keeps resistance identification,
  `charismatic_challenge` adoption, owned-test repair, and premature-certainty
  guard, but adds
  `engagement_router_resistance_generation_repair: true`.
- The new repair only targets `rote_parroting` / `anti_formula_generation`: the
  tutor must require an original learner sentence, owned example, or
  counterexample anchored in concrete evidence rather than another step-label
  chain.
- Paid smoke `eval-2026-06-28-80265ec3`: rote-parroting x cell 190, cell 188,
  and static floor, one Codex-only dynamic repeat each, generation-only. The run
  completed 3/3, all rows passed DB required/forbidden validation, and all three
  target gates matched. Cell 190 required two learner-gate attempts to witness
  the intended precondition; the accepted resistant turn then routed to
  `charismatic_challenge` with `anti_formula_generation`.
- Local transition result: static floor and cell 188 both remained partial
  uptake because the post-tutor learner still foregrounded formula/parroting.
  Cell 190 produced a candidate router breakthrough: the post-tutor learner
  generated an own-language case ("student ties the changed sentence to
  yesterday's lab mistake") without keeping the formula marker.
- Regression check `eval-2026-06-28-d4abadae`: cell 190 on the other four
  resistance signals, one Codex-only dynamic repeat each, generation-only. The
  run completed 4/4, all rows passed DB required/forbidden validation, and all
  four target gates matched. Question-flood needed two learner-gate attempts;
  the other three matched on the first attempt.
- Current cell 190 local summary across `eval-2026-06-28-80265ec3` and
  `eval-2026-06-28-d4abadae`: 5/5 eligible rows, 5/5 gate matches, 5/5 route
  hits, 4/5 candidate router breakthroughs, 5/5 positive local outcomes, mean
  local score 88.0. The one non-candidate positive is frustration, which remains
  `productive_frustration_work` because the learner still names frustration but
  uses the tutor's contrast to do content-bearing work.
- Reporter refinement: the local scorer now counts own-language evidence
  anchors such as sentence, case, phrase, line, object, table, revision, mistake,
  correction, student, and worker. This avoids punishing successful
  anti-formula generation for not repeating the Hegelian lexicon.
- Interpretation: the current best mechanism package is:
  `resistance_signal_target` gate for measurement -> deterministic resistance
  identification -> `charismatic_challenge` adoption after exhausted
  scaffolding -> owned-test tuning for most resistance types -> own-language
  evidence repair for rote-parroting. This is still single-repeat simulated
  evidence and needs stability repeats before a general claim. It is now strong
  enough to stop adding new prompt cells by default; the next target is
  repeatability under the same gated design.

### Stability repeat: owned-test backbone plus rote repair

Run `eval-2026-06-28-906f3947` added the planned stability floor: five
controlled resistance signals x three profiles x two Codex-only dynamic learner
repeats, generation-only. Profiles were static floor cell 186, owned-test router
cell 188, and generation-repair router cell 190. The run completed 30/30 rows in
110.8 minutes with no empty outputs; all three profiles passed DB
required/forbidden validation in 10/10 stored rows.

The stability-only report is saved as:
`exports/charisma-desire-breakthrough-stability-summary.md` and
`exports/charisma-desire-breakthrough-stability-summary.json`. The default
matrix export now remains the combined current evidence view across
`eval-2026-06-28-179effc6`, `eval-2026-06-28-0df6b0db`,
`eval-2026-06-28-80265ec3`, `eval-2026-06-28-d4abadae`, and
`eval-2026-06-28-906f3947`; after the boundary and question-lock confirmation
passes below, it also includes `eval-2026-06-28-ee0d51a1` and
`eval-2026-06-28-dea2ad1a`; after the question-lock repeat, it also includes
`eval-2026-06-28-5fa837b5`.

Stability-only local report:

| Arm | Rows | Eligible | Candidates | Positive | Route hits | Target matches | Mean score |
| --- | ---: | --- | --- | --- | --- | --- | ---: |
| static floor | 10 | 10/10 | 5/10 | 7/10 | 0/10 | 10/10 | 70.5 |
| cell 188 owned-test router | 10 | 10/10 | 6/10 | 8/10 | 10/10 | 10/10 | 82.5 |
| cell 190 generation-repair router | 10 | 9/10 | 5/10 | 7/10 | 10/10 | 9/10 | 83.0 |

Combined current evidence after the stability, boundary, question-lock
confirmation, and question-lock repeat passes:

| Arm | Rows | Eligible | Candidates | Positive | Route hits | Target matches | Mean score |
| --- | ---: | --- | --- | --- | --- | --- | ---: |
| static floor | 16 | 16/16 | 6/16 | 8/16 | 0/16 | 16/16 | 70.3 |
| cell 188 owned-test router | 16 | 16/16 | 9/16 | 12/16 | 16/16 | 16/16 | 84.1 |
| cell 190 generation-repair router | 20 | 19/20 | 13/20 | 16/20 | 20/20 | 19/20 | 85.3 |
| cell 191 question-lock router | 3 | 3/3 | 2/3 | 2/3 | 3/3 | 3/3 | 93.3 |

Current question-flood commitment slice after the reporter refinement:

| Arm | Rows | Candidates | Answer-first | Usable commitment | Reopened | Residual flood |
| --- | ---: | --- | --- | --- | --- | --- |
| static floor | 3 | 2/3 | 1/3 | 1/3 | 1/3 | 1/3 |
| cell 188 owned-test router | 3 | 3/3 | 3/3 | 2/3 | 0/3 | 0/3 |
| cell 190 generation-repair router | 7 | 6/7 | 7/7 | 6/7 | 1/7 | 1/7 |
| cell 191 question-lock router | 3 | 2/3 | 2/3 | 2/3 | 1/3 | 1/3 |

Mechanism interpretation:

- Identification: the target gate works as a measurement precondition, but one
  cell 190 irrelevance row was classified as question-flood after three gate
  attempts even though the learner's surface form was a relevance challenge
  ("Why does this matter for charisma?"). The next design target should repair
  irrelevance-vs-question-flood disambiguation before more broad paid repeats.
- Register adoption: once the target signal is recognized, the router arms
  reliably adopt `charismatic_challenge` in the controlled slice: 16/16 route
  hits for cell 188, 20/20 route hits for cell 190, and 3/3 route hits for
  cell 191 in the combined current evidence.
- Register tuning: cell 188's owned-test strategy is the broadest general
  mechanism. It handles boredom, irrelevance, and question-flood well, and
  turns frustration into productive carry-through rather than full affective
  resolution.
- Rote/parroting remains a special subtype. Static floor and cell 188 remain
  partial on rote in the combined current evidence (0 strict candidate
  breakthroughs), while cell 190's own-language generation repair produces 2/3
  strict rote candidates. Cell 190 should therefore be treated as a targeted
  patch layered on the owned-test backbone, not a global replacement for cell
  188.

Revised next design target:

1. Repair resistance identification for near-neighbor interrogative forms:
   distinguish a single "why does this matter?" irrelevance challenge from a
   true multi-question flood.
2. Preserve the owned-test backbone as the default charismatic register tuning.
3. Apply the own-language evidence repair only when the detected signal is
   rote/parroting or when the learner explicitly says they are repeating terms.
4. Run another paid pass only after the disambiguation rule has a no-paid test
   and the reporter can expose the classifier decision boundary.

No-paid boundary repair and confirmation:

- Implemented the identification repair in `services/resistanceSignalGate.js`
  and `services/engagementModeRouter.js`: "why does this matter" and "what is
  this supposed to explain" now count as irrelevance markers, and the router's
  fallback question-flood threshold now requires at least three question marks
  instead of two.
- Added focused tests proving that the observed failure shape ("Why does this
  matter for charisma? ... Can you show me the concrete situation first?") is
  classified and routed as irrelevance, not question-flood, while three-question
  floods still route as question-flood.
- Paid confirmation `eval-2026-06-28-ee0d51a1`: two rows, cell 190 only,
  irrelevance and question-flood, one Codex-only dynamic repeat each,
  generation-only. The run completed 2/2 with DB required/forbidden validation
  clean. Local report:
  `exports/charisma-desire-breakthrough-boundary-confirmation-summary.md`.
- Confirmation result: the irrelevance row matched the target, routed
  `irrelevance`/`owned_case_transfer`, and produced a candidate breakthrough.
  The question-flood row matched and routed as `question_flood`/
  `question_collapse`, but was scored `no_breakthrough` because the learner
  selected a break point while still emitting several follow-up questions.
- Interpretation: the identification boundary is repaired for future runs, but
  historical rows retain their original gate/router metadata. The next design
  target is not broader classifier work; it is question-flood tuning robustness:
  the tutor should make the learner answer one hinge before asking another
  question.

Question-flood answer-lock design:

- Added `cell_191_id_director_charisma_resistance_question_lock_breakthrough_dynamic_verified`
  as a narrow successor to cell 190. It keeps the owned-test backbone and
  rote/parroting own-language repair, then adds
  `engagement_router_resistance_question_lock` for question-flood turns only.
- The new prompt rule requires the tutor to name one hinge, park other
  questions, and make the learner answer in a fixed form before asking anything
  else: "My hinge is ___ because ___" or "the passage decides at ___ because
  ___."
- No-paid checks added: the XML flag is passed to the id prompt and retained in
  metadata; report/config tests recognize cell 191.
- Paid confirmation `eval-2026-06-28-dea2ad1a`: one question-flood repeat for
  cell 191 versus cell 190, Codex-only dynamic learner, generation-only. The
  run completed 2/2 with DB required/forbidden validation clean. Dedicated
  report:
  `exports/charisma-desire-breakthrough-question-lock-summary.md`.
- Result: both cell 191 and cell 190 scored as candidate router breakthroughs
  in this single draw. Cell 191 produced the cleaner locked form ("My hinge is
  unequal answer...") with no renewed question flood. Cell 190 also began with
  a hinge answer and only then asked one follow-up, so this is not a decisive
  superiority result.
- Interpretation: question-lock is a plausible expression-level refinement, but
  not yet a promoted mechanism.
- Reporter refinement completed: the local matrix report now includes
  `Answer-first`, `Usable commit`, `Reopened`, `Residual flood`, per-row
  `Post ?`, and per-row `Commitment` columns. On `eval-2026-06-28-dea2ad1a`,
  both cell 190 and cell 191 are usable-commitment, non-residual-flood
  candidates, but cell 190 leaves one follow-up question while cell 191 leaves
  zero. Future question-flood repeats should use these columns as the tuning
  decision rather than relying only on broad candidate status.
- Paid repeat `eval-2026-06-28-5fa837b5`: two additional question-flood
  repeats each for cell 191 and cell 190, Codex-only dynamic learner,
  generation-only. The run completed 4/4 with DB required/forbidden validation
  clean. Dedicated repeat report:
  `exports/charisma-desire-breakthrough-question-lock-repeat-summary.md`.
- Repeat result: cell 190 was stronger on the precise answer-lock metric. In
  the repeat slice, cell 190 produced 2/2 candidate router breakthroughs, 2/2
  answer-first learner uptakes, 2/2 usable commitments, and 0/2 residual
  floods. Cell 191 produced 1/2 candidate router breakthroughs, 1/2
  answer-first learner uptakes, 1/2 usable commitments, and 1/2 residual
  floods. In the combined question-flood evidence, cell 190 now has 6/7
  candidates, 7/7 answer-first uptakes, 6/7 usable commitments, and 1/7
  residual floods; cell 191 has 2/3 candidates, 2/3 answer-first uptakes, 2/3
  usable commitments, and 1/3 residual floods.
- Interpretation: cell 191 is a useful negative branch, not a promoted design.
  The explicit question-lock phrasing can over-constrain the turn and still
  leaves a residual question flood in one repeat. The current best target for
  question-flood remains cell 190's generation-repair router, while the broad
  backbone remains cell 188's owned-test strategy.

Question-flood commitment-probe design:

- Added `cell_192_id_director_charisma_resistance_commitment_probe_breakthrough_dynamic_verified`
  as a narrow successor to cell 190, not cell 191. It keeps the owned-test
  backbone and rote/parroting generation repair, then adds
  `engagement_router_resistance_commitment_probe` for question-flood turns.
- The new prompt rule avoids a fixed answer-lock phrase. It asks for a
  defeasible hold/break judgment with three parts: the provisional judgment,
  the warrant that makes it worth trying, and the named passage/counterexample
  that would reopen the parked questions.
- No-paid checks added: the XML flag is passed to both id-director entry paths
  and retained in result metadata; the matrix reporter recognizes
  `router_commitment_probe`; config validation resolves cell 192; focused
  id-director and matrix tests pass. The matrix report now includes a dedicated
  **Question-Flood Gate** section. Status remains
  `PENDING_NO_COMMITMENT_PROBE_ROWS` until cell 192 has rows.
- Frozen promotion rule for the next paid gate: promote cell 192 for
  question-flood only if it has at least two rows, clean route/gate
  preconditions, candidate rate at least the current comparators,
  usable-commitment rate at least the current comparators, and zero reopened or
  residual-flood outcomes. The current comparator table is cell 188 at 3/3
  candidates and 3/3 usable commitments, and cell 190 at 6/7 candidates and
  6/7 usable commitments with 1/7 reopened/residual.
- A CLI `--dry-run` profile-resolution smoke reached the cell 192 scenario but
  still touched the dynamic learner provider path and failed because this
  worktree lacks the local OpenRouter key; the resulting dry-run artifact
  `eval-2026-06-28-ff5879c4` and progress log were deleted. Treat this as no
  evidence for cell 192.
- Next paid gate: compare cell 192 with cell 190 and cell 188 on
  `charisma_desire_resistance_breakthrough_question_flood`, using candidate,
  answer-first, usable-commitment, reopened, and residual-flood columns as the
  primary local decision metrics.
- Paid gate `eval-2026-06-28-c9fd95c2`: cell 192 versus cell 190 and cell 188,
  two Codex-only dynamic learner repeats each, generation-only. The run
  completed 6/6 in 24.9 minutes, with DB required/forbidden validation clean
  for all three profiles. Dedicated report:
  `exports/charisma-desire-breakthrough-commitment-probe-gate-summary.md`.
- Measurement repair during analysis: the reporter initially undercounted
  hold/break commitments because it missed bolded/provisional `hold` forms, and
  it overcounted residual question-flood when a post-turn contained two
  non-question "why" clauses. The reporter now recognizes hold/break
  commitments and requires at least three question marks for question-flood
  persistence. This repair was applied before interpreting the gate.
- Gate result: `PROMOTE_COMMITMENT_PROBE_FOR_QUESTION_FLOOD`. In the paid gate
  slice, cell 192 produced 2/2 candidates, 2/2 answer-first commitments, 2/2
  usable commitments, 0/2 reopened commitments, and 0/2 residual floods, with
  mean local score 92.5. Cell 188 and cell 190 also cleared the clean local
  question-flood uptake metrics in this small slice, but cell 192 cleared the
  frozen promotion rule and had the highest mean local score.
- Combined current question-flood evidence after adding the gate run: cell 188
  has 5/5 candidates, 5/5 usable commitments, 0/5 reopened/residual; cell 190
  has 8/9 candidates, 8/9 usable commitments, 1/9 reopened/residual; cell 191
  has 2/3 candidates, 2/3 usable commitments, 1/3 reopened/residual; cell 192
  has 2/2 candidates, 2/2 usable commitments, 0/2 reopened/residual.
- Interpretation: the best current subtype mechanism for question-flood is the
  commitment probe layered on the owned-test/generation backbone. This does not
  replace cell 188 as the broad five-signal backbone or cell 190 as the
  rote/parroting repair. The next design target should be a composite policy:
  owned-test by default, generation repair for rote/parroting, and commitment
  probe for question-flood.

Five-signal composite stability pass:

- Ran `eval-2026-06-28-74da095f`: cell 192 only, five controlled resistance
  signals, two Codex-only dynamic learner repeats each, generation-only. The
  run completed 10/10 in 38.6 minutes with DB required/forbidden validation
  clean for every row. Dedicated report:
  `exports/charisma-desire-breakthrough-composite-stability-summary.md`.
- Reporter result: 10/10 eligible rows, 10/10 route hits, 10/10 gate matches,
  5/10 strict candidate breakthroughs, 9/10 positive local outcomes after
  separating rote owned-generation carry-through, and mean local score 85.0.
  The **Question-Flood Gate** remained
  `PROMOTE_COMMITMENT_PROBE_FOR_QUESTION_FLOOD`.
- Subtype result: question-flood was clean at 2/2 candidates, 2/2 answer-first
  commitments, 2/2 usable commitments, and 0/2 reopened/residual-flood
  outcomes. Irrelevance was also clean at 2/2 candidates. Boredom was mixed
  (1/2 candidate, 1/2 positive), frustration produced productive carry-through
  rather than strict breakthrough (0/2 candidates, 2/2 positive), and rote
  parroting produced owned examples while retaining residual caution (0/2
  candidates, 2/2 positive owned-generation carry-through).
- Interpretation: cell 192 is promoted as the current question-flood subtype
  mechanism and is compatible with irrelevance transfer and rote
  owned-generation repair, but it is not a general five-signal passing design.
  The next target is boredom: the router can get a concrete test, but it still
  sometimes leaves the learner saying the material feels dead. The design
  problem is to convert boredom into a live stake without drifting into
  decorative charisma.

Boredom live-stake design:

- Added `cell_193_id_director_charisma_resistance_boredom_stake_breakthrough_dynamic_verified`
  as a one-factor successor to cell 192. It keeps the owned-test backbone,
  rote/parroting generation repair, and question-flood commitment probe, then
  adds `engagement_router_resistance_boredom_stake` for boredom turns only.
- The new prompt rule is not "make the scene more vivid." It requires the tutor
  to name the live stake inside one object, passage, or case: what becomes
  visible if the hinge holds and what becomes empty compliance if it breaks.
  The final learner action should be a decision from the object itself, not a
  reaction to the tutor's style.
- No-paid checks passed: cell 193 resolves in `validate-config`; the new XML
  flag reaches both id-director entry paths; result metadata retains the flag;
  the matrix reporter recognizes `router_boredom_stake`; syntax checks and
  focused id-director/router/gate tests pass.
- Paid boredom gate `eval-2026-06-28-b7a9ce7d`: cell 193 versus cell 192 and
  cell 188, three Codex-only dynamic learner repeats each, generation-only. The
  run completed 9/9 in 30.4 minutes. Dedicated report:
  `exports/charisma-desire-breakthrough-boredom-stake-gate-summary.md`.
- Gate result: cell 193 produced 3/3 eligible rows, 3/3 strict candidate
  breakthroughs, 3/3 route hits, 3/3 target-gate matches, and mean local score
  95.0. Cell 188 also produced 3/3 candidates in this gate, mean 90.0; cell 192
  produced 3/3 candidates, mean 90.0, but only 2/3 required validation passes
  because one row missed the explicit agency-return phrase group
  (`try/test/version/sentence/provisional/passage/criterion/failure/choose/decide/revise/quote/counterexample/apply`).
- Combined current boredom evidence after adding the gate run: cell 188 has
  6/6 strict candidates and mean 92.5; cell 190 has 2/3 strict candidates and
  mean 96.7; cell 192 has 4/5 strict candidates and mean 84.0; cell 193 has
  3/3 strict candidates and mean 95.0.
- Interpretation: cell 193 clears the local boredom gate and is a clean
  composite-compatible boredom repair, but it does not displace cell 188 as the
  best-supported boredom backbone because cell 188 remains 6/6 across the
  combined evidence. The live-stake rule should be retained only as a
  non-regressive composite repair unless a later broader regression pass shows
  it preserves question-flood, rote/parroting, irrelevance, and frustration.
- Paid non-boredom regression `eval-2026-06-28-ffd7f724`: cell 193 on
  `frustration`, `irrelevance`, `question_flood`, and `rote_parroting`, two
  Codex-only dynamic learner repeats each, generation-only. The run completed
  8/8 in 29.2 minutes. DB validation is clean across all rows: 8/8 success,
  8/8 required validation, 8/8 forbidden validation. Dedicated report:
  `exports/charisma-desire-breakthrough-cell193-nonboredom-regression-summary.md`.
- Regression result: 4/8 strict candidates and 8/8 positive local outcomes.
  Irrelevance remains a strict breakthrough signal (2/2). Question-flood is
  clean under the commitment criterion (2/2 strict candidates, 2/2 answer-first
  usable commitments, 0 reopened commitments, 0 residual floods). Rote/parroting
  stays in the intended owned-generation-with-residual bucket (0/2 strict,
  2/2 positive, 2/2 owned). Frustration stays productive rather than fully
  resolved (0/2 strict, 2/2 positive carry-through).
- Interpretation after regression: cell 193 is now the best composite candidate,
  not because it beats every subtype specialist, but because it preserves the
  subtype mechanisms across all tested resistant signals with clean validation:
  boredom as live stake, irrelevance as owned transfer, question-flood as usable
  commitment, rote/parroting as owned generation, and frustration as productive
  carry-through. This is still not a final general passing design. The next
  evidence step is a full five-signal stability pass for cell 193, ideally with
  enough repeats to check whether the positive carry-through pattern holds
  without letting the weak frustration/rote strict-candidate rate masquerade as
  solved breakthrough.
- Paid five-signal stability pass `eval-2026-06-28-a6eb2819`: cell 193 on all
  five controlled resistant-signal scenarios, three Codex-only dynamic learner
  repeats each, generation-only. The run completed 15/15 in 57.7 minutes with
  clean DB validation across every scenario: 15/15 success, 15/15 required
  validation, 15/15 forbidden validation. Dedicated report:
  `exports/charisma-desire-breakthrough-cell193-five-signal-stability-summary.md`.
- Stability result after the reporter fix for concrete commitment wording:
  9/15 strict candidate breakthroughs and 14/15 positive local outcomes. By
  target: boredom 2/3 strict and 2/3 positive, with one real `partial_uptake`
  residual where the learner says the plank helps but the material still starts
  dead; frustration 0/3 strict but 3/3 productive carry-through; irrelevance
  3/3 strict; question-flood 3/3 strict with 3/3 answer-first usable
  commitments and no reopened or residual-flood outcomes; rote/parroting 1/3
  strict and 3/3 positive, including 2/3 owned-generation-with-residual.
- Combined cell 193 evidence across the curated matrix is now 26/26 eligible
  routed target-matched rows, 16/26 strict candidate breakthroughs, and 25/26
  positive local outcomes. Signal-level combined rates: boredom 5/6 strict and
  5/6 positive; frustration 0/5 strict but 5/5 productive carry-through;
  irrelevance 5/5 strict; question-flood 5/5 strict with 5/5 usable
  commitments, 0 reopened commitments, and 0 residual floods; rote/parroting
  1/5 strict but 5/5 positive via owned generation.
- Interpretation after stability: this is a general passing local design for
  the simulated resistance-breakthrough mechanism if the acceptance criterion is
  "route the resistant signal, adopt the charismatic challenge register, and
  produce immediate learner movement appropriate to the resistance type." It is
  not evidence that every signal becomes a strict affective breakthrough:
  frustration remains productive-but-frustrated, rote/parroting often remains
  owned-generation-with-residual, and one boredom row remains partial. The
  bounded claim is therefore that accountable-bid/live-stake charisma can
  reliably convert tested resistant signals into usable next work under this
  Codex-only dynamic learner stack, not that it eliminates resistance or
  generalizes to human learners.

GLM 5.2 OpenRouter robustness and independent judging:

- Step 2 model-stack robustness run `eval-2026-06-28-7fbbb160`: cell 193 on all
  five controlled resistant-signal scenarios, two GLM 5.2 OpenRouter dynamic
  learner repeats each, with GLM 5.2 also used for the tutor ego and id/superego
  slots. The run was generation-only (`--skip-rubric`) and completed 10/10 in
  46.8 minutes at $1.52. DB validation passed required phrases in 10/10 rows
  and forbidden phrases in 9/10 rows; the lone forbidden miss was `admire` in
  an irrelevance row. Dedicated report:
  `exports/charisma-desire-breakthrough-cell193-glm52-openrouter-robustness-summary.md`.
- Local outcome result for GLM generation: 2/10 strict candidate breakthroughs,
  4/10 positive local outcomes, 9/10 route hits, 7/10 target matches, 7/10 gate
  matches, and mean local score 68.0. By signal, frustration produced 2/2
  productive local outcomes, irrelevance produced 1/2 strict candidates,
  question-flood produced 1/2 strict candidates with one reopened flood,
  boredom produced 0/2 candidates, and rote/parroting produced 0/2 reporter-
  eligible candidates because the GLM learner/trace path clipped or failed the
  post-learner detector despite contentful post turns.
- Observed provider/runtime fragility: GLM 5.2 repeatedly produced
  length-finished empty-content learner calls in the dynamic learner path. This
  matters because the failing rows are not just weaker prose; they show
  model-specific resistance/gate classification mismatch and commitment-collapse
  instability. Treat the result as a failed model-stack robustness check, not as
  a clean replication.
- Step 3 independent GLM 5.2 judging on the Codex-generated stability run
  `eval-2026-06-28-a6eb2819`: GLM v2.2 rejudge completed 15/15 rows with mean
  first-turn 75.5, last-turn 95.1, development 19.6, and tutor-overall 88.7.
  Scenario means for first/last/development were: boredom 65.0/90.8/25.8,
  frustration 77.1/97.9/20.8, irrelevance 80.8/98.3/17.5, question-flood
  80.0/93.3/13.3, and rote/parroting 74.6/95.0/20.4.
- GLM charisma judging on the same Codex-generated rows completed 15/15 with
  mean charisma 67.8. Scenario charisma means were: boredom 63.8, frustration
  70.0, irrelevance 73.8, question-flood 65.4, and rote/parroting 65.8.
- Interpretation after GLM: independent GLM judging does not overturn the
  Codex-stack cell 193 result, but GLM generation does not preserve the
  mechanism. The claim should remain bounded to the tested Codex-only dynamic
  learner stack unless a later design explicitly repairs cross-model learner
  clipping, resistance classification, and question-flood commitment stability.

Cell 194 GLM-compatible repair attempt:

- Added `cell_194_id_director_charisma_resistance_glm_compact_breakthrough_dynamic_verified`
  as a one-factor successor to cell 193. It preserves the cell 193 mechanism
  stack and adds `engagement_router_resistance_glm_compact`, a compact
  single-hinge challenge rule for GLM: keep the response under 120 words, use
  one acknowledgement, one hinge/test, and one compact answer starter, and avoid
  extra examples, broad questions, praise, or status words.
- The design target was specifically GLM generation robustness, not a new
  general mechanism: reduce visible-turn branching so GLM has less opportunity
  to clip learner replies, miss target gates, or reopen question floods.
- No-paid checks passed before evaluation: cell 194 config validation, syntax
  checks, reporter sanity, and focused id-director/router/gate tests.
- Paid GLM smoke `eval-2026-06-28-daf80863` attempted all five controlled
  resistance signals with GLM 5.2 for tutor ego, id/superego, and dynamic
  learner. The run persisted three rows, then was manually interrupted during
  question-flood after the GLM tutor ego repeatedly returned empty visible
  content with `finish=length` while spending output budget on hidden reasoning.
  The run was marked completed with partial rows to avoid leaving a stale
  `running` record.
- Rote-only GLM follow-up `eval-2026-06-28-f18df068` completed 1/1 in 5.0
  minutes at $0.1807. It produced an owned learner sentence, but DB required
  validation failed because the tutor did not hit the agency-return phrase
  group.
- Dedicated combined report:
  `exports/charisma-desire-breakthrough-cell194-glm52-compact-repair-smoke-summary.md`.
  Across the four completed cell 194 rows, the local reporter finds 3/4 strict
  candidate breakthroughs, 3/4 positive local outcomes, 3/4 route hits, 3/4
  target/gate matches, and mean local score 78.8. Frustration, irrelevance, and
  rote/parroting became local candidates; boredom missed the target gate; no
  completed question-flood evidence exists.
- DB validation is mixed: boredom and irrelevance passed required/forbidden;
  frustration and rote/parroting passed forbidden but missed the required
  agency-return phrase group. Therefore this is not a clean validation pass.
- Interpretation: cell 194 partially repairs GLM action shape on completed
  rows, but it does not solve GLM robustness. The key remaining failure is
  runtime/model behavior: GLM can spend the visible output budget on hidden
  reasoning and return empty content, especially around question-flood. The
  next GLM design target should be provider/runtime control over hidden
  reasoning or a simpler non-id compact profile, not another richer prompt
  instruction layered onto the same id-director path.

Cell 193 GLM provider/runtime control pass:

- A first provider-control sizing probe, `eval-2026-06-28-1cec4696`, used
  cell 193 unchanged with GLM 5.2 across tutor ego, id/superego, and dynamic
  learner, but added `OPENROUTER_REASONING_MAX_TOKENS=0`,
  `OPENROUTER_REASONING_EXCLUDE=true`, and
  `OPENROUTER_MAX_COMPLETION_TOKENS=1200`. OpenRouter accepted the reasoning
  controls after the runtime stopped sending `reasoning.effort` together with
  `reasoning.max_tokens`, but the 1200-token completion ceiling was too low
  for the full id-director path: boredom id construction hit `finish=length`
  and fell back to the minimal persona. The empty 0-row probe was deleted and
  its progress log removed.
- The replacement full-budget run, `eval-2026-06-28-f857f51f`, kept cell 193
  unchanged and used only the provider/runtime reasoning controls
  `OPENROUTER_REASONING_MAX_TOKENS=0` and
  `OPENROUTER_REASONING_EXCLUDE=true`; it did not simplify the prompt or lower
  the profile budgets (`ego.max_tokens=4000`, id/superego `max_tokens=16000`).
  It completed all five controlled resistance signals in 26m59s, with 99 API
  calls, 620,290 input tokens, 66,812 output tokens, and reported cost $0.7791.
- DB validation passed cleanly: 5/5 rows successful, 5/5 required validation,
  and 5/5 forbidden validation.
- Dedicated report:
  `exports/charisma-desire-breakthrough-cell193-glm52-runtime-control-summary.md`.
  The local breakthrough reporter is negative despite clean validation: 0/5
  strict candidate breakthroughs, 0/5 positive local outcomes, 5/5 route hits,
  4/5 target matches, 3/3 gated rows matched, one usable question-flood
  commitment, and mean local score 61.0.
- Interpretation: provider/runtime control changes the GLM result from
  "generation robustness failure" to "valid but locally ineffective generation."
  It fixes completion enough to compare rows, but it does not make GLM execute
  the cell 193 resistance-breakthrough mechanism. Boredom failed before the
  tutor move because the dynamic learner ceased to present boredom; frustration
  produced only partial uptake; irrelevance and rote/parroting lacked
  report-detectable post-turn evidence; question-flood produced a usable
  commitment but still did not meet the breakthrough rule. Treat this as a
  negative model-stack robustness result for full cell 193, not as a reason to
  simplify the prompt retroactively.

Final role-isolation and question-flood closeout:

- The completed six-arm role-isolation matrix is now 50/50 successful
  generation-only rows across the planned contrasts:
  `eval-2026-07-01-5dad2e60` (Codex/Sonnet tutor-id + Codex learner),
  `eval-2026-07-01-dff9f159` (Codex/Sonnet tutor-id + GLM learner),
  `eval-2026-07-01-a09281f7` (GLM tutor-id + Codex learner),
  `eval-2026-07-01-9f4eecf2` (full GLM reference),
  `eval-2026-07-01-02e8712f` (scripted Codex/Sonnet tutor control), and
  `eval-2026-07-01-9066df81` (scripted GLM tutor control).
- The local report analyzes 50 role-isolation rows with 20 strict candidate
  breakthroughs and 23 positive local outcomes. Arm-level diagnosis:
  the Codex/Sonnet reference reproduces only modestly (6/10 positive,
  5/10 strict), GLM tutor/id works with a fixed Codex dynamic learner
  (8/10 positive, 6/10 strict, 10/10 post turns), the tutor-fixed GLM learner
  arm loses completion/target stability (6/10 post turns, 8/10 target matches),
  the full GLM arm remains unstable (5/10 post turns, 4/10 positive), and both
  scripted controls route the public register with fixed resistant turns
  (5/5 route hits each). Scripted controls remain register-shape checks only,
  not learner-outcome evidence.
- Final role-isolation diagnosis:
  `DYNAMIC_LEARNER_COMPLETION_AND_TARGET_DRIFT_BOUNDARY`. The main GLM failure
  is not that the GLM tutor/id stack cannot publicly produce the target
  charismatic-challenge register. The remaining failure is that rows involving
  GLM as the dynamic learner lose post-turn completion or drift away from the
  target resistance signal.
- The separate question-flood commitment-probe gate is closed by
  `eval-2026-07-02-67be317c`. Two profile-default OpenRouter learner attempts
  were deleted before persistence because they produced zero usable rows:
  `eval-2026-07-02-4d05e961` exposed small-budget hidden-reasoning/empty-content
  behavior, and `eval-2026-07-02-5d44265b` terminated or leaked deliberation
  text. They are runtime invalid attempts, not gate evidence.
- The valid gate used Codex GPT-5.5 for tutor ego and dynamic learner,
  OpenRouter Sonnet 5 for id/superego, serial execution, and generation-only
  local analysis. It completed 6/6 rows across cell 188, cell 190, and cell 192
  in 30.6 minutes at $2.7277. Cell 192 produced 2/2 strict candidates, 2/2 route
  hits, 2/2 gate matches, 2/2 answer-first usable commitments, and 0/2 reopened
  or residual floods. Cell 188 produced 1/2 usable commitments; cell 190
  produced 0/2.
- The reporter was repaired and regression-tested so ordinary commitment
  language such as "I'll make the commitment provisionally," "I'll tentatively
  hold it," and "I'd hold/break" counts as usable question-flood commitment
  evidence. The resulting gate status is
  `PROMOTE_COMMITMENT_PROBE_FOR_QUESTION_FLOOD`.
- Conclusion: promote cell 192 only for the question-flood subtype. Keep the
  broader charisma/desire claim scope-bound: local Codex/Claude or
  Codex/Sonnet-stack engagement routing works in several controlled simulated
  resistance slices, role isolation points to GLM dynamic-learner completion and
  target drift as the boundary, and no full GLM robustness, human-learning,
  deployed runtime, scripted-control learner-outcome, or general charismatic
  tutoring claim follows.

Revised decision rule:

- Primary outcome: generated learner uptake after resistance, measured on the
  immediate post-challenge learner turn.
- Required precondition: the tutor's response to the resistant turn is actually
  routed as `charismatic_challenge`.
- Required target gate: the pre-challenge learner turn must match the scenario's
  `resistance_signal_target`; otherwise the row is precondition-failed rather
  than evidence against the tutor mechanism.
- Covariates only: slice charisma, v2.2 tutor quality, dialogue quality, and
  holistic adaptive trajectory. These should not be the decision rule.
- Invalid evidence: whole-dialogue averages, full-transcript charisma, or
  scripted learner uptake.

In-flight audit:

- As of 2026-06-27, every named charisma/desire run referenced by this note and
  the workplan item is marked `completed` in `evaluation_runs`.
- The only 2026-06-25/26/27 rows still marked `running` are four unrelated
  `storeRejudgment propagation test` records with `total_tests = 0`, seven
  scored rows each, empty metadata, and no matching progress logs. They are not
  active charisma/desire evaluations and were not used as evidence here.
- No new static-cell paid pass was launched after the 2026-06-26 pivot. The
  authorized paid pass was the cell 180 router smoke above, not another one-off
  charisma-floor cell.

Stage 4 - promotion matrix:

- Increase to at least ten repeats per profile-scenario if Stage 1 shows cell
  169 remains clean and meaningfully competitive.
- Increase to 24 repeats only if variance remains material or if the result is
  intended for a publication claim.

Stage 5 - robustness:

- Second v2.2 judge.
- Second charisma judge.
- Reduced alternate model-pair matrix.
- Human-coded or human-learner subset.

## Promotion Rules

Cell 169 can be promoted from "local pass" to "generalizes across tested
simulated authority-refusal scenarios" only if all are true:

- Required and forbidden validation pass on both primary scenarios across the
  pilot matrix.
- No repeated forbidden status-display term appears in any primary scenario row.
- v2.2 and charisma means remain competitive with cells 163, 104, and 107.
- The result survives at least one judge robustness check or one model-pair
  robustness check.
- Human-facing evidence, if collected, does not classify the tutor's authority
  as manipulative, merely polished, or coercive.

If any primary criterion fails, stop and record the failure mode. Do not iterate
inside the same matrix without freezing a new versioned plan.

## Stop Rules

- Stop immediately if `cell_169` fails forbidden-word validation in either
  primary scenario.
- Stop after Stage 1 if `cell_169` only wins by style scores while losing the
  authority-defeasibility interpretation.
- Stop if `partial_uptake` becomes the only positive signal; that scenario is
  robustness evidence, not the decision-maker.
- Stop if the alternate model-pair matrix reverses the result; treat
  `accountable_bid_clean` as stack-specific.
- Stop before any human-learning claim unless real learner or human-coded data
  exists.

## Preliminary Cleanup Completed

The accidental interrupted run `eval-2026-06-25-87a4bef6` was removed from the
database on 2026-06-25 with:

```bash
node scripts/eval-cli.js delete-runs --run-id eval-2026-06-25-87a4bef6 --force
```

The command deleted one run and 96 partial evaluation rows. The generated
progress log `logs/eval-progress/eval-2026-06-25-87a4bef6.jsonl` was also
removed.
