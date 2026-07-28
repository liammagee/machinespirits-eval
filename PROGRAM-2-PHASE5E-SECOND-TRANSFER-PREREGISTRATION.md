# Program-2 Phase 5e — letter-hostile second-transfer pre-registration

Status: **R2 PRELAUNCH FREEZE CANDIDATE** on branch
`codex/program-2-phase5e-r2-replication` (2026-07-27). R1 sealed 18/18
dialogues and returned a negative primary result, but subsequent trace audit
located two apparatus faults: premature non-closure and warrant opportunities
whose required question was forbidden by the final public handoff contract.
Amendment 2 freezes an apparatus-corrected replication; it does not authorize
quota probes, the four-dialogue exact-pipeline pilot, the 18-dialogue cohort,
or seam review. Each remains behind a fresh, explicit operator gate. Parent:
`PROGRAM-2-PHASE5C-CROSS-WORLD-TRANSFER-PREREGISTRATION.md` (§9 results) and
`PROGRAM-2-PHASE5B-FALLBACK-BATTERY-PREREGISTRATION.md` (§8 results).
Exploratory tier. R2 explicitly pins the historical v1 evidence-use classifier
and the frozen v1 delivered-turn compliance rule; current defaults must not be
substituted silently.

## 1. Question

Phase 5c found that the Marrick-trained specialist transferred unchanged to
`world_027_gazette_recall`, but the gazette world was letter-friendly: the
frozen-six vocabulary occurred naturally and raised both arms' compliance
floor. Does the same Phase 5b/5c system transfer unchanged to a second world
selected mechanically for low native frozen-six density? A pass provides a
second, deliberately hostile validation point for the move-library concept.
A failure, interpreted with the component and costume-leak anatomy, separates
a missing cue-bearing form from question-discipline erosion.

## 2. Artifact under test (frozen; no substitutions)

Exactly the Phase 5b/5c system: mini `program2-sft-instruct-v2` (the Phase 4
verified-merge SFT instruct artifact, q8_0 same-lineage GGUF), local ollama
native `/api/chat`, fallback policy **v2**, and byte-unchanged span extraction
and battery semantics. The 2026-07-21 KTO close-out found the served KTO
variants byte-identical to SFT, so no distinct KTO artifact exists at the
serving pin. Committee-v3, committee-floor ablations, span-v2, retraining,
adapter changes, and any supporting-model change are out of scope. The run
must use a fresh current-`main` worktree pinned to the eventual freeze commit;
the archived Phase 5 runtime is provenance only.

## 3. World selection (frozen)

The candidate set is the six unused non-period siblings named in the workplan
card: worlds 022, 023, 024, 025, 026, and 028. The mechanical metric is a
case-insensitive, word-boundary count of `evidence|item|test|record|fact|rule`
with possessive/plural suffixes, per 1,000 words. It runs over parsed
human-facing world prose (settings, questions, glosses, premise surfaces, and
dramaturgy), excluding YAML comments and formal IDs, fact arrays, rule
antecedents/consequents, proof paths, backgrounds, incompatibilities, and
release schedules. The structural floor is at least five rules. Ties are
broken by more rules, then world ID.

Source: `scripts/measure-program2-phase5e-world-hostility.mjs`; schema
`machinespirits.program2.phase5e-world-selection.v1`; full machine-readable
evidence:
`config/adaptive-tutor-evidence/program-2-phase5e-world-selection.json`.

| Rank | World | Frozen-six matches | Words | Matches/1k | Premises | Rules | Floor |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | `world_024_emberwick_forum` | 0 | 851 | 0.00 | 5 | 4 | fail |
| 2 | `world_026_skyway_bakery` | 2 | 894 | 2.24 | 5 | 5 | pass |
| 3 | `world_025_tallow_street` | 4 | 994 | 4.02 | 6 | 6 | pass |
| 4 | `world_023_greyfen_lab` | 5 | 836 | 5.98 | 5 | 4 | fail |
| 5 | `world_022_foxtrot_jukebox` | 5 | 614 | 8.14 | 4 | 2 | fail |
| 6 | `world_028_larkspur_fridge` | 6 | 680 | 8.82 | 4 | 2 | fail |

The raw letter-hostility winner, Emberwick, is rejected because its four-rule
world misses the predeclared structural floor. The selected world is therefore
**`world_026_skyway_bakery`**, the lowest-density candidate that meets the
floor. Its source SHA-256 at freeze is
`01b09759c6129c21181bc1cd1bc749d2739d662974f6422c56cf8a318075fe0d`.

## 4. R1 design (18 dialogues + 1 separately gated smoke)

Ten committee-v2 dialogues (2 profiles × 5 repeats) and eight fresh
`silent_control` dialogues (2 × 4), interleaved by seeded shuffle with plan and
stub seed **20260726**. Every other operational parameter remains as in Phase
5c: register policy `bland`, `strict_dag`, supporting seams on
`codex.gpt-5.6-terra`, profiles `proof_skipper` and `affective_resistant`,
`--auto-turns until-grounded` with safety 40, primary horizon 16, trigger
window [3, 24], detector `step4-frozen-2026-07-14.v1`, and tutor family
`claude-code.sonnet-5`. The sole causal change from 5c is
`--world world_026_skyway_bakery`. Runner `--plan 5e` writes to
`exports/program2-live-pilot-5e-r1/` after Amendment 1.

**No pooling.** All Phase 5, 5b, and 5c controls belong to other worlds. Every
Phase 5e contrast uses only the eight fresh Skyway controls.

**Paid smoke (not yet authorized).** One reduced-length committee-v2 dialogue
on Skyway (`--auto-turns 8`, separate
`exports/program2-live-pilot-5e-smoke/`, excluded from all endpoints) may run
only after an explicit post-freeze gate. Go requires at least one committee
moment with non-empty mini text, at least one extractable question span, and
zero serving errors. Otherwise abort and report; only serving repairs are
licensed.

## 5. Endpoints

All inferential intervals use a two-sample, dialogue-cluster bootstrap,
profile-stratified, 5,000 draws, seed **20260726**.

- **E1e (primary):** pooled `warrant_skip` compliance under the frozen v1
  delivered-turn audit, committee-v2 minus fresh control. **Pass = 95% CI
  lower bound > 0.**
- **Guardrails:** coverage@16 committee ≥ control − 0.05; hard safety
  committee ≥ control − 0.10; committee opportunity density ≥ 15 with
  `proof_skipper` contributing. A density failure produces no verdict.
- **Seam:** re-run the Phase 5c E3 harness verbatim over Phase 5e committee
  dialogues (harness-internal window seed 20260718, realized-n clause). Pass
  ≤ 0.65.
- **Costume leak (descriptive):** use the Phase 5c rule unchanged. Derive the
  Marrick and Skyway evidence lexicons mechanically; leak set = Marrick
  lexicon − Skyway lexicon − frozen six. Count case-insensitive word-boundary
  occurrences with possessive/plural suffixes in committee mini-authored
  delivered text and in control delivered turns at warrant moments. Report
  total, per-word rate, units with a hit, examples, and unmistakable-costume
  subset. References: Marrick home saturation 31.8/1k; Phase 5c transfer
  committee 0.0/1k.
- **Native frozen-six density (new, descriptive):** count frozen-six matches
  in control-arm delivered turns at warrant moments, using the exact §3 regex;
  report occurrences, per-cue counts, total words, occurrences/1k, and units
  with a cue. This exposes how much cue vocabulary the unassisted frontier
  supplies in the selected world's live dialogue, so 5c and 5e floors can be
  compared without changing the primary audit.

## 6. Reading grammar

| Result | Licensed reading |
| --- | --- |
| E1e pass + guardrails + seam parity | Second zero-retraining transfer validation on letter-hostile ground; the move-library concept strengthens from a single transfer toward practice, still exploratory and family-specific. |
| E1e fail + costume leak ≫ control base rate | Costume-dragging: the move remains entangled with training-world surface; pooled multi-world exhaust is indicated. |
| E1e fail + costume leak ≈ control base rate + low cue component | Vocabulary miss: the cue-bearing form does not survive hostile diction at this scale; failed-world exhaust enters the retrain-on-failure branch. |
| E1e fail + question/guard component erosion | Form erosion beyond vocabulary: inspect fallback and seam anatomy before any retraining decision. |
| Seam detection > 0.65 | Committee texture is visible in the new costume; report verbatim windows. |
| Density < 15 | No verdict; descriptive report only. Native frozen-six density is descriptive in every row and licenses no pass by itself. |

## 7. Attrition and abort

Verbatim from Phase 5c: a dialogue aborted by transport failure is retried once
with identical seeds. A second failure is attrition (excluded and reported).
Three consecutive transport failures abort the launch; the runner checkpoints
after each dialogue and resumes by skipping sealed traces.

## 8. Cost bound, gates, and scope

Estimated upper bound: ≤700 sonnet CLI calls (tutor turns, compositions, and
smoke), ≤1,000 terra CLI calls (supporting seams), 40 sonnet seam-reviewer
calls, and local mini calls. No Lambda and no training. Before any paid call:
freeze and push the exact branch commit, confirm ollama serves the pinned
artifact, make one free native mini warm-up in Skyway register, then obtain a
new explicit operator authorization for quota probes and the paid smoke. The
live launch requires a separate `--launch-approved --expected-sha <freeze
commit>` gate. Out of scope: artifact changes, span-v2, committee-v3,
committee-floor ablations, pooling, additional worlds, retraining, and reruns
beyond §7's one retry.

## 9. Results

R1 completed 18/18 sealed dialogues at launch SHA
`470889d5ed786d7f5b24ceb4bfb9121e544ab564`; three jobs needed their one
same-seed retry and none became attrition. The frozen analyzer returned
committee **5/62 = 0.0806** versus fresh control **3/31 = 0.0968**, difference
**−0.0161**, profile-stratified dialogue-bootstrap 95% CI
**[−0.0879, 0.0607]**. E1e therefore failed. Density passed. The frozen
component rates were committee/control: exactly one question
0.677/0.774, frozen-six warrant cue 0.403/0.387, no new premise 0.532/0.452,
and guards passed 1.000/1.000. Mean coverage@16 was 0.95/1.00 and hard-safety
rate 0.70/0.75, so both preregistered comparative guardrails passed. No
Marrick-costume term appeared in committee mini-authored delivery. Native
frozen-six density in controls was 14 occurrences in 2,156 words (6.49/1k).
Seam review was not run.

This is a valid negative observation for the exact R1 delivery stack, but not
a clean answer to the intended transfer question. A post-hoc re-score after
the merged natural-language conclusion matcher found that 16/18 transcripts
could have closed at median turn 10, saving 459 of the scheduled 720 turns;
R1 instead ran all 18 to the safety horizon. Independently, the frozen Phase
5e analyzer's post-hoc handoff anatomy finds that all **20/20** committee
`warrant_skip` moments lacking exactly one delivered question carried
`question_forbidden_by_handoff_contract`. Thus the intervention was sometimes
asked to produce a form the ordinary final guard was obligated to reject.
These diagnoses are descriptive apparatus audits, not alternate treatment
effects. R1 is never pooled with R2.

## 10. Amendment 1 — pre-result Skyway launch-log presentation repair (2026-07-26)

This amendment was written after the first live launch aborted and before any
Phase 5e dialogue sealed or any endpoint was inspected. It changes the
presentation of one already-authored clue; it does not change the experiment's
facts, contrast, sample, scoring, or reading grammar.

### 10.1 Diagnostic event and exclusion

The authorized eight-turn committee smoke passed: two committee moments each
had non-empty mini text and an extractable question span, both frozen
batteries passed, and there were zero serving or model errors. The subsequent
18-dialogue launch then stopped at the configured three-consecutive-failure
gate: the first silent-control job failed twice and was marked attrition, and
the first committee job failed once. All three attempts reached the turn-9
`p_warm` release and failed the same deterministic terminal-response check
with `opaque_clue_release` and `missing_exhibit_action`. The fallback said it
would “write the live line down” and then stated the launch-log surface, but it
did not visibly open/read the exhibit under the strict dramatic-release audit.

The runner reported these child exits as transport failures, although the
trace evidence identifies a deterministic presentation-guard rejection. No
dialogue sealed: realized n = 0/18. Therefore this launch supplies no Phase 5e
outcome, no endpoint estimate, and no seam result. Its three unsealed traces
and `exports/program2-live-pilot-5e/launch-state.json` remain diagnostic only
and are excluded from every future analysis.

### 10.2 Minimal repair

Only the authored presentation metadata for the existing `p_warm` release at
turn 9 changes. The release remains tutor-owned at turn 9 and retains the same
premise surface and formal fact. It now uses `mode: enacted_role`, with the
loftmistress opening and reading the ovenloft launch log and an entrance cue
that places the log between tutor and learner, taps the dawn initials, and
reads the line aloud. The cue introduces no new evidence.

An exact zero-model regression loads the production Skyway world, selects
`p_warm`, exercises the same plain `record_keeper` deterministic fallback, and
requires an in-scene enactment with a passing dramatic-release audit. The
mechanical world-selection evidence was regenerated without overwriting the
original freeze evidence. Selection is unchanged at 2/894 frozen-six matches
(2.24/1k), five rules, and source SHA-256
`73f7d89b147b50c31afce736b1369fd0a15b961f2945147cce5952d46684baf9`.

### 10.3 Frozen invariants and restart gate

Everything else remains frozen: `program2-sft-instruct-v2`, local native chat,
fallback v2, span extraction, both batteries, committee/control counts,
profiles, repeats, interleaving, seed 20260726, detector, trigger window,
frontier model families, horizons, endpoints, guardrails, bootstrap, costume
leak rule, world facts, premise surfaces, public rules, proof DAG, release
timing, and release ownership. This is a presentation-only repair, not an
artifact or measurement change.

Any restart must use a fresh root,
`exports/program2-live-pilot-5e-r1/`, so no failed diagnostic attempt can be
mistaken for a planned unit. It must be pinned to the new post-amendment commit
and pass the ordinary zero-model quality and 18-job dry-run gates. Paid quota
probes and the live restart require fresh explicit operator authorization; the
authorization for the aborted launch does not carry forward.

## 11. Amendment 2 — apparatus-corrected R2 replication (2026-07-27)

This amendment is prospective with respect to R2: no R2 model call or outcome
exists. Its purpose is to preserve the original transfer question while
removing the two delivery faults exposed by R1.

### 11.1 Fixed scientific question and stack

R2 keeps Skyway, the same 10 committee + 8 fresh-control matrix, profiles,
repeats, seed 20260726, `bland` policy, strict DAG, horizons, trigger window,
detector, fallback v2, mini artifact, span extraction, batteries, models,
bootstrap, primary compliance audit, guardrails, costume metric, and no-pooling
rule. The tutor remains `claude-code.sonnet-5`; learner, learner-record, and
classifier remain `codex.gpt-5.6-terra`; the local mini remains
`program2-sft-instruct-v2`. Every R2 command explicitly carries
`--learner-analysis-evidence-use-rubric v1`, because the repository default is
now v2 and silently accepting it would answer a different question.

R2 uses the current merged conclusion/closure machinery. It also adds one
arm-symmetric eligibility intersection: after the ordinary final handoff
contract is compiled, a detector-nominated `warrant_skip` is removed from the
experimental opportunity set when that contract forbids a question. The
committee is not allowed to override a declarative answer, and the silent
control loses the same inadmissible candidate. The frozen detector itself is
unchanged. This changes the analyzable opportunity population, so R2 is an
apparatus-corrected replication rather than a byte-identical rerun; R1 and
earlier Phase 5 rates are contextual references only.

The cohort plan schema is
`machinespirits.tutor-stub.program2-phase5e-r2-plan.v1`, job IDs begin
`p5e-r2-`, and its fresh root is `exports/program2-live-pilot-5e-r2/`.

### 11.2 Exact-pipeline pilot and launch certificate

Before the cohort, run exactly four paid pilot dialogues: one per
profile × arm cell, using the same repeat-1 runtime commands and pins as the
cohort apart from job ID and trace path. Plan key `5e-pilot`; root
`exports/program2-live-pilot-5e-r2-pilot/`. Pilot rows are excluded from all R2
endpoints. A pilot launch requires its own fresh `phase: pilot` certificate
bound to `config/adaptive-tutor-evidence/program-2-phase5e-r2-pilot-gates.json`.
Those pilot gates require all four rows to seal with complete coverage/safety
outcomes but deliberately impose no opportunity minimum: measuring projected
opportunity density is the pilot's purpose, and that decision is made by the
later cohort certificate.

After the four traces seal, the zero-model pilot-bundle builder must pass its
11 checks: both plan schemas; binding to the exact cohort-plan hash and source
SHA; complete
profile × arm coverage; command equivalence; one sealed trace per job; run
identity and clean JSONL termination; world/seed pins; full model-stack pins;
v1 rubric, intervention arm, and fallback pins; and complete normalized
fixed-horizon rows. The bundle binds every source trace by SHA-256.

The frozen cohort gate file is
`config/adaptive-tutor-evidence/program-2-phase5e-r2-gates.json`. It requires
all pilot rows individually to reach coverage@16 ≥ 0.8 with complete passing
safety evidence and no leak, at least one row per profile × arm, and projected
handoff-eligible opportunity density with a 1.25 reserve: ≥15 per arm overall
and ≥5 per profile × arm. Cohort stop-losses require at least 7 sealed
dialogues per arm, 7 complete repeat blocks, at least 3 complete blocks per
profile, and committee/control attrition imbalance ≤1. Each newly sealed
cohort row is normalized immediately; coverage@16 below 0.8, incomplete or
failed hard-safety evidence, or a leak stops the cohort rather than allowing a
known-invalid row to consume the rest of the budget. `requireCueBlind` is
false because fallback-v2 explicitly inspects the frozen cue battery; setting
it true would contradict the frozen treatment.

The free sequence is:

```bash
node scripts/run-program2-live-pilot.js --prepare-certificate --plan 5e-pilot \
  --output-dir exports/program2-live-pilot-5e-r2-pilot
node scripts/run-program2-live-pilot.js --prepare-certificate --plan 5e \
  --output-dir exports/program2-live-pilot-5e-r2
```

After an explicitly authorized and certified pilot seals:

```bash
npm run program2:phase5e:pilot-bundle
```

The emitted cohort-certificate command then consumes the audited bundle and
frozen gate file. Certificate preparation and bundle construction make zero
model calls and confer no launch authorization.

### 11.3 R2 decision rule and authority boundary

E1e and every comparative guardrail retain §5's thresholds, computed only on
the handoff-eligible R2 opportunities and fresh R2 controls. A pilot that
misses any certificate check stops the programme before the cohort; it is a
feasibility failure, not an E1e result. A cohort that cannot retain the frozen
completion gates stops under the certificate's non-effect futility rule. The
runner never stops early merely because the treatment difference is null.

This branch licenses only source changes, zero-model planning, bundle
machinery, and tests. Paid pilot, cohort, seam-review, archival, manifest,
paper integration, and any further artifact or endpoint change require their
own explicit authorization.
