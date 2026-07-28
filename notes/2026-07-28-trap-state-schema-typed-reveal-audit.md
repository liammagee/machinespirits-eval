# Trap-scenario state schema: audit for typed reveal events

Workplan item: `audit-trap-state-schema-for-typed-reveal-events`
Date: 2026-07-28
Status: read-only audit, no new runs

## What was asked

`learnerProfileSchema` in `services/adaptiveTutor/stateSchema.js` carries standing
estimates about the learner. It has no slot for "this fact was revealed at turn T" —
an event with a time, not a running guess. `strategy_shift_correctness` and the
graded adaptive rubric both turn on questions such a slot would settle.

"Narrative World Model" (arXiv:2607.05577) builds a typed temporal-state graph and
asks four things of it: who holds a fact, when they came to hold it, what order the
facts arrived in, and whether an earlier plant was later discharged. Those are the
same questions, so its schema works as an audit instrument against ours.

## Scope and method

Cells 110, 111, 113 (8 scenarios each, `config/adaptive-trap-scenarios.yaml`) and
124 (6 scenarios, `config/cross-suite-trap-scenarios.yaml`). 14 distinct trap turns,
30 cell × scenario scored trap turns.

Each trap turn was hand-coded against the four query types. The coding is checked
into `scripts/lib/trapRevealQueryCoding.js` so it can be joined to trace data rather
than read off prose. It was then set beside the state fields recorded at the scored
turn — `scoredTutorTurnAfterTrigger(triggerTurn)` = trigger+1 — reached through the
same `loadTrace()` path `scripts/analyze-strategy-shift.js` uses.
`scripts/audit-trap-reveal-events.js` does the mechanical half.

**Counting rule.** A typed reveal event is a schema-declared record with both a turn
stamp and a payload naming what became known, written from observing the dialogue
rather than copied from the scenario's hidden block. Under that rule:

| channel | counts? | why |
|---|---|---|
| `evidenceLog` entry | yes | turn + verbatim quote + type + `validated` |
| `hypotheses` entry | yes | `created_at_turn` + `claim` |
| `tomProbes.infoaccess_list` / `answerability_list` | partial | dates access by turn index, names no content |
| `trapEvents` entry | no | `learnerTurn` copies `hiddenLearnerState.triggerSignal` verbatim at the scripted turn. It records the scenario firing, not the tutor noticing |
| `learnerProfile.updatedAtTurn` | no | one profile-wide scalar, no per-fact stamp, and `makeLearnerProfileUpdate` writes it every turn whether or not anything was disclosed |

## Hand coding

`W` who-knows-what · `L` when-learned · `O` event-ordering · `S` setup-payoff.

| scenario | trig | revealed by | W | L | O | S | what the trap turns on |
|---|---|---|---|---|---|---|---|
| `false_confusion_v1` | 1 | learner | ● | ● | | ● | Held the master–slave reading before turn 0; turn 0 was performed, not acquired |
| `polite_false_mastery_v1` | 1 | learner | ● | ● | | | A non-reveal — "yes that makes sense" transfers nothing |
| `resistance_to_insight_v1` | 1 | learner | ● | | ● | | Objection presupposes and targets the tutor's turn-0 definition |
| `answer_seeking_..._v1` | 2 | learner | | | ● | ● | A repetition across turns 0 and 2, not either turn alone |
| `metaphor_boundary_case_v1` | 2 | **tutor** | | ● | ● | ● | The mirror figure was disclosed *by the tutor* at turn 1 |
| `affective_shutdown_v1` | 2 | learner | ● | | ● | | Load accumulates over turns 0–1 and tips at 2 |
| `repair_after_misrecognition_v1` | 2 | both | ● | ● | ● | | Tutor holds a fact it never received — a mis-dated belief |
| `sophistication_upgrade_v1` | 2 | learner | ● | ● | | | Brandom reading held before turn 0, understated there |
| `cross_epistemic_resistance` | 1 | learner | ● | | ● | | Position carried in from outside the dialogue |
| `cross_affective_shutdown` | 2 | learner | ● | | ● | | Trajectory, same shape as `affective_shutdown_v1` |
| `cross_productive_deadlock` | 2 | both | | | ● | ● | Both parties' prior commitments ordered against each other |
| `cross_misconception_surfaces` | 1 | learner | ● | ● | | | Newly formed or carried in decides probe vs correct |
| `cross_activity_avoidance` | 2 | learner | | | ● | ● | A pattern over turns |
| `cross_struggling_overload` | 1 | learner | ● | | ● | | Accumulated load, not the trigger utterance |

Counts across the 30 scored trap turns: who-knows-what 22, when-learned 16,
event-ordering 20, setup-payoff 11.

## Gap list

**1. All 30 scored trap turns have no typed reveal event under them.** Not a thin
result and not a close call — `evidenceLog` and `hypotheses` are structurally empty
for these four cells, and `tomProbes` is absent. `buildGraph` adds `evidenceExtractor`
and `hypothesisUpdater` only for the three `state_policy_*evidence_bound*`
architectures, and `tutorTomTracker` only for the `bilateral_tom*` ones. Cells 110
and 124 are `state_policy`, 113 is `state_policy_with_validator`, 111 is
`recognition_only`. None qualify. This holds whatever model runs them.

**2. `strategy_shift_correctness` reads no state at all.** `analyzeBranch` takes
`t.tutorInternal.policyAction` and nothing else, and gets `triggerTurn` from
`trace.scenario.hidden` — the answer key — not from the trace. So the metric is the
scenario's expected label matched against a label the tutor's own model emitted. The
learner-state channels sit beside it unread.

**3. The one typed event that exists is the answer key echoed back.** `trapEvents` is
populated in all four cells: exactly one entry, `type: 'configured_learner_trigger'`,
stamped at the trigger turn, carrying the scripted signal. Its type is a
`z.literal` — one value, no vocabulary. `learnerTurn` writes it by copying
`hiddenLearnerState.triggerSignal` when `turn === triggerTurn`. It is upstream of the
tutor, so it cannot ground a claim about what the tutor registered. Only
`strategyRefusalGate` (cell 201) reads it; no scorer does.

**4. Cell 111 records no learner state whatever.** 8 of the 30 scored turns. The
`recognition_only` graph is ego → emit → learner with no `learnerProfileUpdate` node,
so `learnerProfile.updatedAtTurn` never equals the turn and `extractTurnTrace` leaves
`perTurn.learnerProfile` null at every turn. Cell 111 is the A13 C1 baseline that
cells 110 and 113 are contrasted against. The contrast is between a condition with a
state record and a condition with none, but no metric reads the record, so the
comparison runs entirely on emitted labels.

**5. No tutor-side disclosure is recorded anywhere.** Every channel that names a
disclosure names the learner's. `metaphor_boundary_case_v1` is the clean case: the
mirror figure enters at the tutor's turn 1 and the trap is the learner over-extending
it at turn 2. `repair_after_misrecognition_v1` and `cross_productive_deadlock` also
need it. Three of 14 trap turns, 8 of 30 scored turns.

**6. Setup-payoff has no slot on these cells.** It is the query type 11 of 30 scored
turns need and the one with nothing behind it — `hypotheses` carries
`created_at_turn` + `expires_after_turns` + `next_validation_action`, which is the
nearest thing in the repo, and it does not run here.

**7. `when_learned` is answerable only by diffing snapshots, and only for three of
the four cells.** `updatedAtTurn` is profile-wide. `misconceptions` is
`z.array(z.string())` with no stamps and no provenance; `lastEvidence` is free text,
overwritten each turn. Dating a specific belief means diffing adjacent per-turn
snapshots and inferring, which needs `learnerProfileUpdate` to exist — so not cell 111.

**8. The graded rubric asks about recognition without being shown the state.**
`adaptive_trigger_recognition` is scored "did the tutor identify the trap signal at
or near the expected trigger turn". `buildPrompt` in `scripts/lib/adaptiveGraderPrompt.js`
passes the transcript, the policy trace and the hidden block. It does not pass
`learnerProfile`, `evidenceLog` or `trapEvents`. The judge infers recognition from
surface text while the per-turn state snapshots sit in the same trace object.

## The shape of it

This is a wiring gap more than a schema gap. The repo already holds two instruments
that answer these queries — `evidenceLog` (turn + verbatim quote + type + validation)
covers who-knows-what and when-learned with provenance; `tomProbes.infoaccess_list`
and `answerability_list` are turn-indexed who-knows-what probes. Neither runs on the
trap cells. Setup-payoff is the one query type with no existing home.

Per the card, this is a gap list to weigh against `strategy_shift_correctness`. It is
not a new metric and not a claim that the schema should change.

## Limitation

This checkout has no `data/` or `logs/` — both are gitignored and the private archive
is not attached — so the trace half ran on a hermetic mock corpus
(`ADAPTIVE_TUTOR_LLM=mock`, tmp `EVAL_DB_PATH`/`EVAL_LOGS_DIR`), 30 traces across the
four cells.

Findings 1–8 are all determined by graph topology, the state schema, and what the
scorers read — none depends on model output, so they carry to the real corpus
unchanged. What the mock corpus cannot show is content: how often `misconceptions`
is non-empty on real runs, or whether `lastEvidence` in practice names the disclosure
the trap turns on. Re-run `node scripts/audit-trap-reveal-events.js` against the real
DB and logs to fill that in; the verdict counts should be identical.
