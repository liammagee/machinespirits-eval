# Registers as First-Class Objects: Taxonomy, Negative Registers, and Register-Specific Rubrics

Status: design note / feasibility review, 2026-07-02. No paid evaluation is
authorized by this note. Companion to
`notes/2026-06-25-charisma-desire-generalizability-plan.md` (the cells 163–194
arc) and `notes/2026-06-24-weber-id-charisma-recognition-thread.md`.

## 1. What we have in place

Four distinct layers currently carry register-like concepts, built at
different times and only partly connected:

### 1.1 Learner-side register classification (input signal)

`services/idDirectorEngine.js:486-494` defines `VALID_REGISTER_TAGS` — seven
discourse registers of the *learner's* utterance
(`vulnerable_disclosure`, `sceptical_pushback`, `operational_request`,
`meta_observation`, `analytic_engagement`, `curious_invitation`,
`disengaged`), classified by `prompts/learner-register-classifier.md` in
cells 103/104/108 and injected into the id prompt as `<learner_register>`.

### 1.2 Tutor-side engagement registers (output stance)

`services/engagementModeRouter.js` — the primary register-shift engine,
built during the cells 180–194 arc. Eight tutor registers
(`clarity`, `scaffolding`, `accountable_bid_authority`, `plain_compression`,
`lived_stakes_reentry`, `transfer_grounding`, `charismatic_challenge`,
`witnessing_restraint`) in a frozen enum, selected per turn by deterministic
regex trigger rules over the learner message, with a structured envelope:
`learner_signal`, `selected_register`, `register_reason`, `evidence_span`,
`risk_flags`, `register_history`, and (for resistance) `resistance_signal` /
`resistance_strategy` / `resistance_move`. Below the register level sits a
resistance-signal subtaxonomy (boredom, frustration, irrelevance,
question_flood, rote_parroting, dismissal), each with a tuned response
strategy (`responseStrategyForSignal`, router lines 116–161).

### 1.3 Persona authoring (stance execution)

`services/idDirectorEngine.js` — the id re-authors the ego's entire system
prompt every turn (`generated_prompt` / `persona_delta` /
`stage_directions` / `reasoning` envelope, persisted to
`id_construction_trace`). Register variants are cell factor flags in
`config/tutor-agents.yaml` that switch XML branches in
`prompts/tutor-id-director.md` (`<engagement_router_directive>`,
`<learner_register_directive>`, `<anti_routinization>`, and the ~10
accumulated `engagement_router_*` repair flags from cells 181–194).

### 1.4 The controlled adaptation mechanism (pedagogical moves, not tone)

`services/adaptiveTutor/` — a *separate* taxonomy: 14 policy actions
(`policyActions.js:23-38`, e.g. `scope_test`, `pose_counterexample`,
`name_the_disagreement`), trap scenarios with a `trigger_turn` /
`trigger_signal`, and binary `strategy_shift_correctness` scored at
trigger+1 (`scripts/analyze-strategy-shift.js`). The enum is a single frozen
source-of-truth array from which the z.enum output constraint, the prompt
menu, and the mock backend all derive — adding an action is four small
edits. Note: policy actions label *pedagogical moves*; registers label
*stance/voice*. They are orthogonal axes and should stay so.

### 1.5 Rubrics and their dispatch (the pinch point)

Three independent rubric families: v2.2 tutor (recognition-informed),
charisma (Weber, `config/evaluation-rubric-charisma.yaml`), poetics
(Aristotle, separate pipeline). Dispatch is **fully hard-wired per rubric**:

- No cell→rubric dispatch table exists. Charisma is applied by operator
  convention (`scripts/evaluate-charisma.js <runId>` run against id-director
  runs); nothing in code restricts it to cells 101+.
- Five copy-pasted YAML loaders (main, tutor-holistic, charisma, poetics ×2,
  learner), each with its own mtime cache and path override.
- Each rubric owns a bespoke DB column family and writer:
  `tutor_charisma_*` (`services/evaluationStore.js:325-336`) written only by
  `updateResultTutorCharismaScores` (`:2870-2904`). Adding a rubric today
  means new migrations + a new writer + a new scorer script.

### 1.6 What the 180–194 arc already established (evidence to build on)

- Whole-transcript register scoring is the wrong unit. The adaptation-slices
  audit showed whole-dialogue charisma confounds scenario content, setup
  turns, and style; the promoted decision rule is **local**: gated resistant
  precondition → route hit → immediate post-turn learner uptake.
- The measurement kit exists and transfers: `resistanceSignalGate.js`
  (precondition enforcement with retry), the breakthrough-matrix reporter
  (eligible/route-hit/candidate/positive columns), frozen promotion rules,
  and no-paid stage-0 checks.
- Register *routing* is reliable (route hits near 100% in controlled
  slices); register *effect isolation* is the hard part — the router did not
  beat strong static charismatic controls on slice charisma, and the causal
  claim had to be narrowed to agency-return discipline.

## 2. Making "register" precise

Two terminological repairs, then a definition.

**Repair 1 — split input from output.** "Register" currently names both the
learner's discourse register (1.1) and the tutor's selected stance (1.2).
Proposed usage: **learner signal** (what the router detects, with an
evidence span) vs **tutor register** (the stance the tutor adopts). The
router envelope already has both fields; the prose and config should follow.

**Repair 2 — registers are normative stances, not styles.** A register is
not surface tone (that is the v2.2 `tone` dimension). Each existing register
carries a *normative contract*: `witnessing_restraint` = receive disclosure
without absolution or status capture; `accountable_bid_authority` = one
defeasible bid with an exposed failure condition. This is what makes
register-specific rubrics coherent: each register can be executed well or
badly *by its own contract*, independently of global pedagogy scores.

**Definition.** A tutor register is a triple:

1. **Trigger condition** — the learner-signal class that licenses it,
   detectable with a quotable evidence span (router rules; resistance gate
   for measurement).
2. **Stance contract** — what the tutor's voice and moves become, stated as
   obligations and prohibitions (the id-director XML directive; the
   required/forbidden phrase gates are its cheap validation layer).
3. **Register-conditional success criterion** — what counts as this register
   done well, scored on the *local slice* (the turn adopting the register
   plus the immediate learner post-turn), not the whole transcript.

Today (1) and (2) exist per register; (3) exists only globally (charisma
rubric over whole transcripts) or as hand-rolled reporter heuristics
(usable-commitment, owned-generation). The extension work is mostly about
giving every register its own (3) — and that is also exactly what a negative
register needs, because a negative register is *defined* by divergence
between its local execution quality and its recognitive cost.

## 3. Negative registers: why sarcasm is a good probe

A negative register (sarcasm, condescension, impatience, guilt-tripping) is
a stance whose contract can be executed *well* while damaging recognition.
Three research uses:

1. **Discriminant validity.** If our local-uptake measures and judges cannot
   distinguish well-executed sarcasm from `charismatic_challenge`, the
   instrument is gullible — the same test D6 ran on the poetics critics.
2. **Effect isolation.** The 180–194 arc could not isolate register as the
   causal variable because all arms were positive-valence. A same-trigger,
   swapped-register contrast (charismatic vs sarcastic challenge under an
   identical gated resistant precondition) is the cleanest register-effect
   design we have proposed yet.
3. **The productive-irony boundary.** Sarcasm has a respectable pedagogical
   near-neighbor: Socratic irony (Aristotle's *eirōn* — feigned ignorance or
   understatement that provokes the learner into doing the work). A graded
   family — `ironic_challenge` (understatement, feigned puzzlement, learner
   does the unmasking) vs `sarcastic_challenge` (contempt-tinged mockery of
   the learner's contribution) — turns "negative register" from a single
   condition into a dose-response design, and connects directly to the
   poetics arc's dramatic-mode vocabulary.

Design constraint: the router must **never organically select** a negative
register. Trigger detection stays shared (the same resistance signals that
license `charismatic_challenge`), but negative-register adoption is an
experimenter-assigned arm (a cell factor), not a router branch. This keeps
the contrast clean and keeps corrosive stances out of every non-experiment
cell by construction.

## 4. Register-specific evaluation rubrics

**Feasibility: high — the charisma rubric is already the template.** Same
1–5 anchored scale, same 0–100 formula, theory-anchored level descriptors.
What is missing is generic plumbing, not rubric-design capability.

Sketch for `config/rubrics/registers/irony-sarcasm.yaml` (v0 dimensions):

| Dimension | What it measures |
|---|---|
| Incongruity precision | Is the ironic gap deliberate and legible, or just rudeness/noise? |
| Target discipline | Edge aimed at the idea/work, never the learner's person or capacity |
| Unmasking invitation | Does the turn leave the learner the move of seeing through it? (the *eirōn* contract) |
| Reparative closure | Does the turn land on a workable next move, not a put-down? |
| Face-threat calibration | Proportionate to the learner's displayed robustness (register_history/signals) |
| Recognition cost | Cross-check: does the turn misrecognize the learner as object rather than subject? |

Two structural decisions:

1. **Score the slice, not the transcript.** Register rubrics should run on
   register-conditional slices (the adopting turn + immediate post-turn),
   generalizing `scripts/report-charisma-desire-adaptation-slices.js`. The
   arc already showed whole-transcript scoring buries the register signal.
2. **Always pair with the recognition guardrail.** v2.2
   `recognition_quality` (and required/forbidden gates) run alongside every
   register rubric. For negative registers the *hypothesis* is divergence:
   high register-execution score with measurable recognition cost. If the
   two never diverge, that is itself a finding (judges can't see the harm,
   or the harm isn't textual).

"Dynamic" rubrics in the strong sense (generated per run) are not needed and
would break comparability; what we want is **dispatch-dynamic**: the scorer
selects the rubric from the register recorded in `id_construction_trace`,
so one run containing several registers gets each slice scored under the
right instrument.

## 5. Trigger points via the existing controlled adaptation mechanism

Two available seams; recommend the first.

**Seam A (recommended): the standard-runner router path.** This is where all
register evidence lives. The pattern from cells 185–194 transfers verbatim:
scenario declares a `resistance_signal_target`; `resistanceSignalGate.js`
enforces the precondition on the dynamic learner (retry until witnessed);
the router detects the signal and records the route; the cell factor decides
which register the id adopts; the local reporter scores the transition.
Adding a negative-register arm = new cell factor + id-director XML directive
+ reporter arm label. No new trigger machinery needed.

**Seam B (defer): the adaptive LangGraph runner.** `POLICY_ACTIONS` is
cleanly extensible (append to the frozen array + description + optional YAML
detail + optional family), so a `shift_register` policy action is a
four-edit change, and `stateSchema.js` could carry a `selected_register`
channel. But policy actions are pedagogical-move labels, not stances; mixing
the axes would muddy `strategy_shift_correctness` comparability across cells
110–125. If we later want register shifts inside the adaptive cells, add
`selected_register` as a *parallel channel* in `tutorInternal` rather than a
policy action, and score it with the register reporter, not the shift
scorer.

## 6. Extensibility gaps and the proposed shape

Three gaps, in increasing order of cost:

**Gap 1 — the register set lives in three places.** The enum in
`engagementModeRouter.js`, the directive branches in
`prompts/tutor-id-director.md`, and the factor flags in
`config/tutor-agents.yaml` must currently be edited in sync (the 181–194
repair flags show the accretion pattern). Proposal: a register registry,
`config/engagement-registers.yaml`, one record per register:

```yaml
registers:
  charismatic_challenge:
    valence: positive
    trigger:
      signals: [boredom, frustration, irrelevance, question_flood, rote_parroting, dismissal]
      requires_prior: [scaffolding, clarity]   # instructional register exhausted
    stance_contract: |
      <one-paragraph obligations/prohibitions, injected into the id prompt>
    risk_flags: [over_challenge, status_display]
    rubric: null            # falls back to charisma
    router_selectable: true # negative registers set false
  sarcastic_challenge:
    valence: negative
    trigger: { same signals }
    router_selectable: false   # arm-assigned only, never organic
    rubric: config/rubrics/registers/irony-sarcasm.yaml
```

The router derives its enum and trigger table from this file (keeping the
current hard-coded rules as regression tests); `idDirectorEngine.js` injects
`stance_contract` generically instead of one bespoke XML flag per repair.

**Gap 2 — per-rubric DB plumbing.** Do not clone the `tutor_charisma_*`
pattern per register (four columns + a writer + a script each time). One
migration adds a generic channel:

- `tutor_register_scores` TEXT — JSON keyed by register name:
  `{ "sarcastic_challenge": { scores, overall, rubric_version, judge_model, slice_ref } }`
- one generic scorer, `scripts/evaluate-register-rubric.js <runId>
  [--register <name>]`, which reads `id_construction_trace` for
  register-conditional slices, loads the rubric from the registry, and
  writes into the JSON channel via one generic store function.

Charisma stays where it is (historical comparability); new registers use the
generic channel from day one.

**Gap 3 — one generic rubric loader.** Five copy-pasted loaders is the
existing debt; the register registry work can carry a small shared
`loadRubricYaml(path)` (mtime cache + parse + minimal shape validation) that
new code uses, without migrating the existing five.

## 7. Concrete implementation steps

No-paid until step 7. Each step is independently landable.

1. **Terminology + registry (no behavior change).** Write
   `config/engagement-registers.yaml` capturing the existing 8 registers as
   (trigger, stance_contract, risk_flags, rubric) records. Refactor
   `engagementModeRouter.js` to derive `ENGAGEMENT_REGISTERS` and trigger
   patterns from it; keep every current routing decision bit-identical
   (existing router tests as the harness, plus a golden test over the
   stage-0 routing cases).
2. **Generic register-score channel.** One `migrateAddColumn` for
   `tutor_register_scores`; one store writer; `scripts/
   evaluate-register-rubric.js` with slice extraction generalized from
   `report-charisma-desire-adaptation-slices.js`.
3. **Author the irony–sarcasm rubric** (`config/rubrics/registers/
   irony-sarcasm.yaml`, v1.0, dimensions per §4), same scale/formula as
   charisma for cross-correlation.
4. **Add the negative-register pair to the registry**: `ironic_challenge`
   and `sarcastic_challenge`, `router_selectable: false`, stance contracts
   written to the *eirōn* / corrosive specifications, forbidden-phrase gates
   for person-directed contempt in both.
5. **Two cells** cloning the cell 193 composite backbone with the register
   swap as the only factor (e.g. `cell_19x_id_director_ironic_challenge_
   breakthrough_dynamic_verified` and the sarcastic twin); register in
   `EVAL_ONLY_PROFILES`; run the cell-config-auditor. Grep
   `tutor-agents.yaml` for free cell IDs first.
6. **Reporter arm labels + stage-0 report** (extend the breakthrough-matrix
   reporter with the two arms and a register-conditional rubric column;
   no-paid `--check` gate).
7. **Paid smoke, smallest useful contrast**: the five gated resistance
   signals × {charismatic_challenge (cell 193), ironic_challenge,
   sarcastic_challenge}, one Codex-only dynamic repeat each (15 rows).
   Decision rule stays local: gate match → route/arm adoption → immediate
   post-turn uptake, plus the register rubric and v2.2 recognition guardrail
   on the slice. Pre-register the expectations: sarcastic arm should score
   high on incongruity/edge but show recognition cost and depressed uptake;
   if it does not, treat that as the gullibility finding, not a success.

Bounded claims this design can license: register-conditional rubrics are
scorable; judges can/cannot distinguish corrosive from productive irony;
negative-register uptake differs/does not differ from charismatic challenge
under identical gated preconditions — all on the simulated Codex-stack
learner only. Not licensed: any human-learner effect, any claim that
sarcasm "works," any router-autonomy claim (negative registers stay
arm-assigned).

If this becomes an active workstream, create a `workplan/items/` card before
the first implementation commit (board discipline), and treat step 7's
expectations as the frozen pre-registration.

## 8. Addendum (2026-07-02, post-implementation): smoke results and revised reading

Steps 1–6 landed on main the same day (commit `dc8deb3e`, Codex, branch
`codex/register-taxonomy-negative-registers`; card
`workplan/items/register-taxonomy-negative-registers.md`). Deviations from
§7: the cells are 196 (`ironic_challenge`), 197 (`sarcastic_challenge`), and
— added after the first smoke — 198 (`face_threat_challenge`); the registry
is `config/engagement-registers.yaml`; the generic channel is
`tutor_register_scores` with `scripts/evaluate-register-rubric.js`; the
rubric is `config/rubrics/registers/irony-sarcasm.yaml`.

### First smoke: the pre-registered expectation failed

Three-arm 15-row smoke `eval-2026-07-02-cfed3b13` (cells 193/196/197 × five
gated resistance signals, `codex.gpt-5.5` overrides; register scoring via
`openrouter.gpt-mini`): route/gate hits 15/15, positive local outcomes
15/15, and register-rubric means **charismatic 46.3 < ironic 57.3 <
sarcastic 71.8** — the sarcastic arm scored *highest* on its own execution
rubric while v2.2 `recognition_quality` stayed flat across arms (all-turn
means 4.67 / 4.60 / 4.53; last-turn 5.00 / 4.80 / 4.80). No recognition
cost, no depressed uptake. Per §7's pre-registration this is recorded as
the **instrument finding, not a sarcasm success**, and scaling was
correctly withheld.

### Redesign and second smoke: cost appears only at the face-threat extreme

The family was split three ways — Socratic irony, dry sarcastic edge, and a
simulated-only `face_threat_challenge` stress arm (cell 198) — and rubric
v1.1 added `uptake_freedom` and `post_turn_face_repair` so a correct
learner answer cannot hide coerced compliance. Four-arm 20-row smoke
`eval-2026-07-02-e511f92c`: v2.2 guardrail remained flat (means 90.8 /
90.5 / 91.4 / 88.5; the sarcastic arm was numerically *highest*), but the
face-threat arm alone showed measurable cost: last-turn
`recognition_quality` 4.4 vs 4.8–5.0, `recognition_cost` 3.1,
`post_turn_face_repair` 2.3. Register-rubric overall means compressed into
a narrow 46–54 band under v1.1.

### Revised interpretation: two rival explanations, not one

The failed expectation has two candidate causes and the smokes cannot yet
separate them:

1. **Judge gullibility** — the judges cannot see textual harm in
   well-formed sarcasm (the D6-shaped reading). Weakened by the face-threat
   result: the same instruments *do* register cost when the stance is
   extreme enough, so the pipeline is not blind in principle.
2. **Generation-side regression to warmth** — a strong tutor stack asked to
   be sarcastic produces warm irony in costume; the corrosive register was
   never actually generated, so there was no harm to detect. This parallels
   the poetics author-confound ("fooled by costume") and is currently the
   more plausible reading, given the sarcastic arm's near-ceiling v2.2
   scores.

Discriminating test (no generation confound): score **hand-authored
corrosive-sarcasm slices** — fixed adversarial exemplars spliced into real
transcripts — under rubric v1.1 and v2.2. If judges still miss the cost on
exemplars we *know* are corrosive, it is gullibility; if they catch it, the
problem is generation fidelity and the negative-register arm needs a
stance-fidelity check (does the produced turn actually instantiate the
contract?) before any uptake claim.

### Standing next steps (supersede §7's step 7 follow-on)

1. The exemplar-based discrimination test above, no-paid except judge
   calls.
2. Fix the register-rubric score-band compression (46–54 under v1.1) —
   anchors are not spreading; likely needs harder level-1/level-5 anchor
   exemplars per dimension.
3. Add a stance-fidelity gate for negative registers (analogous to the
   resistance-signal gate: verify the *tutor* turn instantiates the
   register contract before the row counts as arm evidence).
4. `face_threat_challenge` stays simulated-only; do not scale any paid
   negative-register run until 1–3 land. The question-flood
   commitment-probe gate for this family also remains pending.

Bounded claims now licensed: the register registry/rubric/scoring plumbing
works end-to-end (route hits 35/35 across both smokes); simulated
negative-register arms did not depress uptake or recognition under this
Codex stack; measurable recognition/face-repair cost appears only at the
face-threat extreme. Not licensed: "sarcasm is pedagogically safe" (the
corrosive register may simply not have been generated), any judge-blindness
claim (untested against known-corrosive exemplars), and anything
human-facing.

## 9. Addendum (2026-07-02, exemplar discrimination test)

Follow-up branch `codex/negative-register-exemplar-test` implemented the
no-generation-confound discrimination test described above. The fixture
`config/register-exemplars/corrosive-sarcasm.yaml` contains three
hand-authored known-corrosive local slices and two non-corrosive controls.
`scripts/run-negative-register-exemplar-test.js` scores each slice under
the register rubric and the v2.2 tutor guardrail, then writes
`exports/negative-register-corrosive-exemplar-results.{json,md}`.

Result with `openrouter.gpt-mini`: after adding deterministic register-score
guardrail caps for forbidden person attacks, status-shame threats, and
apologetic/coerced uptake, the register rubric caught 3/3 known-corrosive
exemplars, v2.2 `recognition_quality` caught 3/3, and the two controls had
0/2 false positives. Means: known-corrosive register `recognition_cost` 2.0
/ face repair 2.0 / v2.2 `recognition_quality` 2.33; controls register
`recognition_cost` 4.0 / v2.2 `recognition_quality` 3.5.

Interpretation: this does **not** support global judge blindness. Both the
broad v2.2 recognition guardrail and the repaired register rubric can see
corrosive sarcasm when it is actually present. The generated sarcastic arm
from the smoke is therefore better read as warm irony in costume or weak
stance fidelity rather than evidence that corrosive sarcasm is safe. The next
paid negative-register run needs the stance-fidelity gate so rows only count
as negative-register evidence when the tutor turn actually instantiates the
assigned register.

## 10. Addendum (2026-07-02, prospective stance-fidelity gate)

The follow-up branch now freezes the stance-fidelity gate used by the
breakthrough-matrix reporter. For negative-register rows only:

- `faithful` => counts as assigned-register effect evidence.
- `weak_or_warm_in_costume` / `not_instantiated` => treatment-noncompliance
  exclusions; the row may show local uptake, but it does not count as a
  negative-register arm effect.
- `invalid_person_attack` => invalid corrosive violation; it is not a
  successful register execution and must be counted separately from faithful
  evidence.

`scripts/report-charisma-desire-breakthrough-matrix.js` now emits a
`Negative-Register Stance Gate` section and JSON `stanceGate` summary with
assigned rows, faithful evidence rows, faithful positive outcomes,
noncompliance exclusions, and invalid violations. The row table also carries
the assigned register arm and gate disposition, so future reports can separate
"cell assigned to sarcasm" from "tutor actually instantiated sarcasm."

Attempting to apply the new gate to the prior paid smokes from this checkout
found that no local `evaluation_results` rows remain for
`eval-2026-07-02-cfed3b13` or `eval-2026-07-02-e511f92c` in any sibling
worktree DB checked on 2026-07-02, and the shared DB has no cells 196--198
rows by profile name. The implementation is therefore ready for prospective
use, but a faithful-arm reinterpretation of those exact historical smoke rows
requires restoring their DB/log artifacts or rerunning the smoke. No new paid
generation was performed for this addendum.

## 11. Addendum (2026-07-02, prospective smoke with stance gate)

Fresh four-arm smoke `eval-2026-07-02-e7b15809` applied the stance-fidelity
gate prospectively across cells 193/196/197/198 on the five controlled
resistance-breakthrough scenarios, using `codex.gpt-5.5` tutor and learner
overrides. Generation completed 20/20 rows in 74.4 minutes. Tutor-only v2.2
scoring completed 20/20 with mean tutor score 91.1. Generic register-rubric
scoring completed 35/35 eligible slices with `openrouter.gpt-mini`.

The regenerated breakthrough matrix
(`exports/charisma-desire-breakthrough-matrix-summary.md`,
`exports/charisma-desire-breakthrough-matrix.json`) found 14/20 candidate
breakthroughs and 18/20 positive local outcomes. The new
`Negative-Register Stance Gate` is the important result: only **5/15**
assigned negative-register rows counted as faithful arm evidence; **10/15**
were excluded as `weak_or_warm_in_costume`; **0/15** were invalid
person-attack violations. All five faithful rows had positive local outcomes,
but that is a tiny per-protocol subset rather than an arm-level safety claim.
By arm:

- `ironic_challenge`: 2/5 faithful evidence, 3 exclusions, 0 invalid.
- `sarcastic_challenge`: 2/5 faithful evidence, 3 exclusions, 0 invalid.
- `face_threat_challenge`: 1/5 faithful evidence, 4 exclusions, 0 invalid.

Practical interpretation: the gate did exactly what it was added to do. It
contracts the evidence base from "cell assigned to negative register" to
"tutor actually instantiated the assigned stance." On this Codex stack, most
assigned negative-register rows still regress to warm or weak challenge, so
the earlier smokes should be read primarily as generation-side
noncompliance. The evidence does not support scaling a full negative-register
effect run yet. The next useful engineering step is either to strengthen
stance realization in the negative-register cell directives, or to treat
future analyses as explicitly two estimands: assigned-arm/intention-to-treat
versus faithful-arm/per-protocol. The paper should report this only as a
methodological measurement-development result, not as evidence that sarcasm
is pedagogically safe.

## 12. Addendum (2026-07-03, stance-realization repair)

The prospective smoke showed that the main failure was treatment fidelity:
most assigned negative-register rows were useful tutor responses but not
faithful executions of the assigned stance. The repair therefore targets the
id-director contract rather than the outcome reporter.

`config/engagement-registers.yaml` now gives each negative arm explicit
`stance_fidelity_cues` and marks a visible cue as a required move. Examples:
`ironic_challenge` must surface a Socratic-irony cue such as "the small irony
is" or "conveniently"; `sarcastic_challenge` must surface a dry-sarcastic cue
such as "wonderful", "nice trick", or "the answer vending machine";
`face_threat_challenge` must surface a local face-threat cue such as "right
now this move is protecting you" or "this is an escape route." These cues are
not free license for person attack: they remain bound by the forbidden phrase
and recognition guardrail rules.

`services/idDirectorEngine.js` now passes `stance_fidelity_cues` through the
`<register_stance_contract>` JSON, and `prompts/tutor-id-director.md`
explicitly tells the director that a visible cue is a treatment-fidelity
requirement for experiment-assigned negative arms. Focused tests confirm that
negative registers declare cue lists and that the cues reach the id-director
message. This is a no-paid repair; the next empirical check should be a small
fresh smoke or canary, not a full scale-up, to see whether faithful rows rise
without increasing invalid person-attack violations.
