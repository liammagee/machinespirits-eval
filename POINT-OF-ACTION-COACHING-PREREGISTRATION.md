# Point-of-Action Coaching Gate — Frozen Pre-Registration

Status: **FROZEN 2026-07-14; implementation and zero-model gate complete;
paid execution not authorized.**

This is final-stretch Step 4 and the successor to Green Room Gate 1. Freezing
this document authorizes no model call. Launch requires a separate, explicit
user go after the implementation and dry-run checks below pass.

## 1. Question and claim boundary

The Green Room showed that craft-grade, judge-tier-authored advice in a static
prompt book did not reliably change tutor conduct (3/17 notes improved, 18%
against a 60% bar). The successor question is narrower:

> When a harness recognizes a concrete failure at performance time, does an
> action-shaped instruction delivered at that exact turn improve the tutor's
> observable compliance, or must the action be compiled into the runtime?

This is not a retry of the prompt book. Both intervention grain and delivery
channel change. The claim is about simulated tutor-stub conduct in one world,
not learning, model weights, minds, or human outcomes.

## 2. Zero-call trigger audit

The frozen instrument is derived by `scripts/analyze-step4-trigger-density.js`
from 68 SHA-256-verified existing traces: the 60 selected Step 2 traces for
`proof_skipper` and `affective_resistant` across Terra and Sonnet, plus the
eight scored Green Room performances. The window is learner turns 3--24 in
`world_005_marrick`. No model was called.

| Assigned trigger | Opportunities | Runs firing | Baseline compliance | Decision |
|---|---:|---:|---:|---|
| `warrant_skip` | 484 | 66/68 | 152/484 (31%) | retain |
| `stagnant_repeat` | 204 | 55/68 | 57/204 (28%) | retain |
| `affective_risk` candidate | 53 | -- | -- | reject |
| re-gloss candidate | 57 | -- | -- | reject |

The deterministic sample review found 12/12 valid opportunities for each
retained trigger. `affective_risk` is rejected because its derived signal
produced neutral-regression false positives. Re-gloss is mechanically sound
but too sparse and family/profile-concentrated for a balanced two-family
denominator. Canonical audit: `exports/tutor-stub-step4-trigger-audit/`.

## 3. Frozen trigger and compliance definitions

Only learner turns 3--24 are eligible. Near-closure turns and
`close_inquiry` actions are suppressed. At most one trigger is assigned to a
turn; `stagnant_repeat` has priority over `warrant_skip` on a co-fire because
the rarer change-instrument action subsumes a warrant prompt while the warrant
denominator remains dense.

### T1 — `stagnant_repeat`

Trigger when all are true:

1. deterministic replay through `buildDynamicalSystemState()` gives
   `state_vector.stagnation >= 0.60`;
2. the proposed action family is identical to the four immediately preceding
   completed tutor action families;
3. there is no unresolved glossary request;
4. the turn is not near closure and is not `close_inquiry`.

Target action `break_stagnation`:

- if a public premise is due, release that premise through the existing DAG
  release guards; otherwise
- reanchor a different already-public exhibit or material domain using
  `reanchor_public_evidence` or `ground_in_material`.

Compliance is one when `leavesReleased` increases on the turn, or the realized
action family is `reanchor_public_evidence`/`ground_in_material` and differs
from the repeated family. Otherwise it is zero.

### T2 — `warrant_skip`

Trigger when classifier `evidence_use` is exactly `omits_warrant` or
`overleaps_evidence`, after the T1 priority rule, outside near closure.

Target action `expose_warrant`:

- ask exactly one focused public question connecting the learner's claim to an
  evidence item, test, record, fact, or rule;
- release no new premise on that turn;
- do not state the answer or a hidden proof edge.

Compliance is one only when all three deterministic checks pass: exactly one
question mark; at least one frozen warrant cue from the audit regex; and no
increase in `leavesReleased`. Existing leak and response guards must also pass.

## 4. Arms

The four claim-bearing arms use the same detector, trigger priority, profiles,
world, seeds, turn window, and outcome code.

1. `standing_book`: both action notes are present as static system-prompt text
   from turn 1; no trigger-time interruption. This reproduces the failed
   persisted-advice channel in the new population.
2. `triggered_placebo`: the real detector fires, and the runtime inserts a
   trigger-specific, token-count-matched interruption that says only to inspect
   the current exchange carefully. It contains no target action, warrant cue,
   release instruction, action-family name, or answer. This controls for
   timing, interruption, and extra tokens.
3. `side_coach`: at the same live trigger, insert the corresponding
   action-shaped target above. The tutor may comply; the runtime does not force
   the response.
4. `compiled_constraint`: the same detector fires and the harness enforces the
   corresponding action through the typed-action/release layer before
   generation. This is the upper bound for externalized recognition.

No uncoached arm is claim-bearing. One excluded canary per speaking-tutor
family may compare `standing_book` with no book solely to verify wiring; canary
rows cannot enter any estimate or design decision.

## 5. Factorial population and models

- World: `world_005_marrick` only.
- Learner profiles: `proof_skipper`, `affective_resistant`.
- Runs: $n=5$ per arm × profile × speaking-tutor family.
- Total claim-bearing dialogues: $4 × 2 × 5 × 2 = 80$.
- Speaking-tutor families:
  - `codex.gpt-5.6-sol`
  - `claude-code.sonnet-5`
- Fixed supporting seams in both family blocks:
  - automated learner: `codex.gpt-5.6-terra`
  - classifier: `codex.gpt-5.6-terra`
  - learner-record/DAG extractor: `codex.gpt-5.6-terra`
- Run seed: 20260714, with deterministic arm/profile interleaving.
- Tutor max: safety cap 40; primary outcome fixed at learner turn 16; trigger
  compliance observed through turn 24 or earlier grounded stop.
- All arms run from one committed, clean SHA with exact model observations in
  `run_start` provenance.

Only the speaking tutor varies. This repairs Step 2's whole-stack confound and
makes the cross-family result a tutor-family comparison on fixed supporting
seams. It still does not isolate vendor infrastructure or stochastic sampling.

## 6. Opportunity-density gate

For every arm × speaking-tutor family, pooling the two profiles (10
dialogues), the run must contain at least:

- 25 assigned `warrant_skip` opportunities; and
- 12 assigned `stagnant_repeat` opportunities.

Both profiles must contribute at least one opportunity to their intended
channel (`proof_skipper` to T2, `affective_resistant` to T1). A minimum miss is
an instrument failure for that arm/family/trigger, not a coaching null. No
threshold is changed after viewing a row. A failed density block may be rerun
only for a documented technical failure under the same frozen seed contract;
it may not be enlarged to rescue a scientific contrast.

## 7. Endpoints and estimands

### Primary mechanism endpoint

For each speaking-tutor family and arm, compute compliance separately for T1
and T2, then macro-average the two trigger-specific rates so the dense warrant
channel cannot dominate the result.

Primary contrasts, each against `triggered_placebo`:

- `side_coach - triggered_placebo`
- `compiled_constraint - triggered_placebo`

Use 5,000 dialogue-cluster bootstrap draws, stratified by profile and trigger,
seed 20260714. A treatment arm passes within a tutor family only if:

1. macro-average compliance difference is at least +0.15;
2. the two-sided 95% bootstrap interval has lower bound above zero;
3. both trigger-specific point differences are positive; and
4. the density gate passes for the treatment and placebo arms.

The `side_coach - standing_book` delivery contrast and
`compiled_constraint - side_coach` enforcement contrast are secondary and do
not substitute for the primary placebo contrasts.

### Fixed-horizon and safety guardrails

For any treatment arm to license a mechanism claim within a family:

- mean proof-DAG coverage at learner turn 16 must be no more than 0.05 below
  `triggered_placebo`;
- hard-safety pass rate at turn 16 must be no more than 0.10 below
  `triggered_placebo`;
- secret-leak count must be zero in every treatment dialogue; and
- no new deterministic response-guard failure category may appear.

Coverage, mastery/risk AUC through turn 16, grounded closure, turns to
grounding, trigger counts, and post-trigger four-turn recovery are reported as
secondary descriptions. They cannot rescue a failed compliance or safety gate.

## 8. Decision grammar

| Result | Licensed reading |
|---|---|
| Same treatment arm passes all gates on both tutor families | two-family point-of-action mechanism confirmation |
| Arm passes on one tutor family only | family-bounded mechanism; no general claim |
| `compiled_constraint` passes, `side_coach` fails with adequate density | recognizing the moment is insufficient unless action is enforced |
| `side_coach` and compilation both fail with adequate density | insight-action gap persists even under fresh point-of-action signal on this apparatus |
| Density or provenance gate fails | instrument failure; no mechanism verdict |
| Compliance passes but outcome/safety gate fails | behavioral uptake with unacceptable transfer cost; no promotion |

No outcome licenses prompt tuning, threshold tuning, a fifth arm, more seeds,
or a new register selector under this pre-registration. A future population or
world generalization requires a new document.

## 9. Implementation and launch gate

Before any model call:

1. implement the two detector events and the four arms without changing the
   frozen definitions;
2. persist trigger inputs, assignment priority, injected text/hash, realized
   action, compliance components, and detector version per turn;
3. add deterministic fixtures for positive, negative, co-fire, near-closure,
   glossary-suppression, release, and no-release cases;
4. prove `triggered_placebo` text is target-free and token-count-matched;
5. prove non-speaking seams are identical across tutor-family blocks;
6. run a zero-model dry run and archive its output outside the claim set;
7. commit the clean implementation and append the exact SHA/commands below;
8. obtain explicit user approval to launch.

Items 1–7 passed on the clean implementation commit
`092cf6723ec5ddcda735b59f1c53728f4f00248e`.

Validation commands:

```bash
npm run tutor:stub:step4 -- --dry-run
node --test tests/tutorStubPointOfActionCoaching.test.js tests/tutorStubPointOfActionGate.test.js
npm test
npm run lint -- --no-warn-ignored
```

The zero-model gate planned the frozen balanced 80-dialogue matrix, executed
all detector/compliance fixtures, and made zero model calls. Its plan SHA-256
is `93bd2933d6124a2ee285e9747824cee5e2eba21c0b59ccf6dc8ac8d602156df0`.

Paid launch remains locked. If and only if the user separately approves it,
run from the exact clean implementation commit above:

```bash
npm run tutor:stub:step4 -- --launch-approved --expected-sha 092cf6723ec5ddcda735b59f1c53728f4f00248e
```

## 10. Deviations and results

No deviations. No claim-bearing runs started. No model calls were made while
freezing or implementing this pre-registration. The archived dry-run manifest
records `paidLaunchStatus: locked_pending_explicit_user_approval`; therefore no
Step 4 outcome exists yet. *(Superseded 2026-07-18: the paid run was
subsequently approved, executed, and sealed — see §11.)*

## 11. Results (added 2026-07-18; run sealed, frozen rules applied)

### Execution ledger

- **Launch**: 2026-07-17, from worktree branch `step4-frozen-isolated` @
  `91b8a50e798ace53872a839e923076fcfbac3038` = the frozen implementation
  commit `092cf672` plus a hand-backported minimal port of the safe-mode-v1
  claude-CLI context-isolation fix (`services/cliProviderBridge.js`;
  `--safe-mode --no-session-persistence --tools ''`, fresh temp cwd,
  `CLAUDE_CLI_CONTEXT_ISOLATION=safe-mode-v1` stamp). Zero design change; the
  freeze-era test suite passed 15/15 on the backport and a mock-spawn probe
  verified flags, cwd, and stamp. Rationale: before the fix, every claude-CLI
  call ambiently loaded ~16k tokens of repo CLAUDE.md context — a
  contamination channel into the Sonnet speaking-tutor family. The codex path
  was always isolated.
- **Pre-isolation quarantine**: 7 dialogues generated before the fix were
  quarantined to
  `exports/tutor-stub-step4-claim-runs/quarantine-preisolation/` and never
  analyzed. Their cells were re-run from scratch under the isolated branch.
- **Census**: **80/80 claim dialogues sealed; zero exclusions.** Three
  scheduling passes (initial launch + two capped retries) re-ran only unsealed
  cells with the plan's own byte-identical frozen commands (census = presence
  of `run_end` in the job trace; resume was idempotent). Crash causes across
  retries, all technical: claude-CLI 180 s timeouts (raised to 360 s via
  `ID_DIRECTOR_CLAUDE_CLI_TIMEOUT_MS`, an env knob, no code change),
  path-dependent deterministic-audit trips ending a job process, one recurring
  learner-prompt budget overflow, and codex-side capacity/cache errors. Under
  §6 these are documented technical failures; re-running them under the same
  frozen seed contract is the licensed remedy that was applied.
- **Provenance checks (all pass, enforced fail-closed by the analyzer)**: all
  80 sealed traces stamp `git 91b8a50e @ step4-frozen-isolated`; every
  detector event stamps `detector_version: step4-frozen-2026-07-14.v1`; the
  arm stamped inside every trigger/compliance event equals the plan's arm for
  that job; per dialogue, assigned opportunities exactly equal recorded
  compliance verdicts; zero trigger-window violations (all assignments in
  learner turns 3–24).
- **Analysis**: `scripts/analyze-step4-compliance.mjs` (committed with this
  addendum) aggregates the runtime's sealed per-turn
  `point_of_action_assignment` / `point_of_action_compliance` events —
  nothing is re-derived at analysis time. Fixed-horizon outcomes reuse
  `services/tutorStubEvalIntegrity.js` (`summarizeTutorStubFixedHorizon`,
  horizon 16) and the bootstrap reuses the Step 2 apparatus RNG (`mulberry32`)
  with the frozen seed 20260714 and 5,000 dialogue-cluster draws stratified by
  profile; machine-readable output at
  `exports/tutor-stub-step4-claim-runs/compliance-analysis.json`.

### Density gate (§6): FAIL on the T1 channel — instrument failure

`warrant_skip` (T2) density passes everywhere (59–94 assigned opportunities
per arm × family against the floor of 25). `stagnant_repeat` (T1) density
fails in 7 of 8 arm × family blocks against the floor of 12; only
`standing_book` × sonnet reaches it (13):

| arm | sonnet T1 opp | sol T1 opp |
|---|---|---|
| standing_book | **13** | 10 |
| triggered_placebo | 8 | 4 |
| side_coach | 7 | 5 |
| compiled_constraint | 2 | 1 |

Both profiles contributed to their intended channels in every cell, so the
failure is purely the opportunity count. Because §7's condition 4 requires the
density gate to pass for the treatment **and** placebo arms, and both
families' placebo arms fail T1, **no primary contrast can license a mechanism
verdict in either family**. Per §6, a minimum miss "is an instrument failure
for that arm/family/trigger, not a coaching null," and the block may not be
enlarged to rescue the contrast — the dialogues completed normally, so no
technical-failure rerun is licensed. Under §8 the governing row is: *"Density
or provenance gate fails → instrument failure; no mechanism verdict."*

**Why the channel starved.** The T1 floor was set from the Step 2 replay
density audit; the fresh population stagnated far less. Two mechanisms are
visible in the sealed traces: (a) the trap profiles produced fewer
four-identical-action-family runs than the replay corpus predicted; (b) the
treatment arms suppress their own trigger — enforced or coached re-anchoring
prevents the stagnation precondition from rebuilding (compiled_constraint
recorded 2 and 1 T1 opportunities). The denominator is endogenous to the arm:
a design lesson any successor trigger-conditioned study must absorb (e.g.
yoked-trigger designs or opportunity-matched analysis).

### Primary endpoint numbers (reported under the instrument-failure verdict)

Compliance as comp/opp (rate); macro = unweighted mean of the two
trigger-specific rates.

**claude-code.sonnet-5**

| arm | T1 | T2 | macro |
|---|---|---|---|
| standing_book | 3/13 (.231) | 9/61 (.148) | .189 |
| triggered_placebo | 3/8 (.375) | 9/77 (.117) | .246 |
| side_coach | 4/7 (.571) | 14/66 (.212) | .392 |
| compiled_constraint | 2/2 (1.000) | 34/86 (.395) | .698 |

Contrasts vs placebo: side_coach **+0.146** (CI95 [−0.108, +0.422]);
compiled_constraint **+0.452** (CI95 [+0.089, +0.626]).

**codex.gpt-5.6-sol**

| arm | T1 | T2 | macro |
|---|---|---|---|
| standing_book | 6/10 (.600) | 11/68 (.162) | .381 |
| triggered_placebo | 2/4 (.500) | 17/84 (.202) | .351 |
| side_coach | 4/5 (.800) | 11/59 (.186) | .493 |
| compiled_constraint | 1/1 (1.000) | 51/94 (.543) | .771 |

Contrasts vs placebo: side_coach **+0.142** (CI95 [−0.228, +0.432]);
compiled_constraint **+0.420** (CI95 [−0.033, +0.658]).

Guardrails (would-have-applied, reported for completeness): the
compiled_constraint arm fails the coverage guardrail in both families
(coverage@16 0.517 and 0.500 vs placebo 0.650 and 0.634 — beyond the −0.05
margin) and fails the sol safety guardrail (hard-safety 0.30 vs 0.60); the
zero-leak bar fails in every arm including controls (arm totals 1–12 leaks;
placebo itself carries 5–10). No treatment arm introduced a new
deterministic response-guard failure category (that guardrail passes
everywhere).

### Descriptive observations (non-claim; development tier)

1. **Enforcement moves realized action, not phrasing.** All 180 compiled T2
   turns realized `answer_accountably` (vs `stage_next_step` dominance in
   every other arm), and `no_new_premise` violations drop to zero (49–64 in
   un-enforced arms) — yet `warrant_cue` remains the binding constraint (94 of
   95 non-compliant compiled T2 turns miss it). The typed-action layer
   controls *which* action executes; the compliance definition also demands a
   surface warrant cue the enforcement layer does not write.
2. **The insight–action gap persists directionally at the point of action.**
   side_coach — recognition delivered at the exact trigger moment, action
   named, not enforced — lands under the +0.15 bar in both families with CIs
   straddling zero, and its T2 diff is negative on sol. Fresh point-of-action
   signal without enforcement did not clear even the modest frozen bar.
3. **Enforcement's transfer cost is visible.** Both compiled arms pay ~0.13
   proof-DAG coverage at turn 16 relative to placebo — consistent with forced
   warrant-accounting displacing release progress.
4. **T1 compliance is all-or-nothing.** On every non-compliant stagnation
   turn, all three components fail together (no release increase, no family
   change, no re-anchor); when the tutor breaks stagnation it satisfies all
   three at once.
5. **Sonnet side_coach safety anomaly.** Hard-safety 0.90 vs placebo 0.30 and
   1 leak vs 10 — the side-coached sonnet arm was descriptively the safest
   cell in the study.

### Verdict

**Instrument failure on the stagnant_repeat channel; no mechanism verdict for
either treatment arm in either family (§8, density row).** The secondary
descriptions stand as exploratory observations only. Under §8's closing
clause, no prompt tuning, threshold tuning, fifth arm, additional seeds, or
new selector is licensed; a successor study requires a new document. The Step
4 gate is discharged: this pre-registration is closed.

### Cross-implementation check (added 2026-07-18, post-verdict)

A second, independently written analyzer
(`scripts/analyze-step4-point-of-action-results.js`, found uncommitted in the
scorer staging worktree; 537 lines, Codex-authored) was run against the same
80 sealed traces after the verdict above was recorded. Two scaffolding
adjustments were required in a scratch copy, both documented deviations rather
than analysis changes: its frozen provenance SHA predates the isolation
backport (092cf672 vs the actual launch SHA 91b8a50e), and its
one-trace-file-per-directory assumption predates the capped-retry partials
(replaced with the sealed-file rule). With those two adjustments it
reproduces **every point estimate, opportunity count, density verdict,
coverage/safety/leak figure, and the §8 verdict
(`instrument_failure_no_mechanism_verdict`) exactly.** One divergence: the
95% CI lower bounds on the compiled_constraint contrasts (theirs [+0.183,
+0.664] sol and [+0.250, +0.629] sonnet vs [−0.033, +0.658] and [+0.089,
+0.626] here). Cause localized: in bootstrap resamples where the sparse T1
channel draws zero opportunities, their implementation drops the draw while
the analyzer of record keeps it as a T2-only macro (the conservative
convention). The frozen text did not specify degenerate-draw handling because
the density floor was supposed to make it unreachable; the sensitivity is
confined to the compiled arms' lower bounds and touches no verdict, density
gate, or point estimate. Reading: whether the sol compiled CI excludes zero
is convention-dependent; every licensed conclusion is convention-robust. The
independent run's outputs are archived beside the traces
(`~/.machinespirits-data/step4-claim-runs-2026-07/results.{json,md}`).
