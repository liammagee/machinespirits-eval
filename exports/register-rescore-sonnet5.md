# Negative-register slices re-scored with a discriminating judge

Generated: 2026-07-05T12:59:08.870Z

- Old judge (archived in `exports/register-scores-gptmini-archive.json`): `openrouter.gpt-mini`
- New judge (this rescore, all 58 slices): `claude-code.sonnet-5`
- Runs: `eval-2026-07-02-e7b15809`, `eval-2026-07-02-7e461a5c`, `eval-2026-07-02-5c4d52e6`
- Rubric: `config/rubrics/registers/irony-sarcasm.yaml` v1.2 (cells 196-198); `config/evaluation-rubric-charisma.yaml` (cell 193)
- Row-level stance-fidelity gate source: `scripts/report-charisma-desire-breakthrough-matrix.js` run scoped to these runs (canonical exports untouched).

> Methods caveat: The exemplar discrimination test that licensed this rescore (exports/register-exemplar-discrimination-summary.md) was generated with openrouter.sonnet-5. This rescore uses claude-code.sonnet-5 (the Claude Code CLI subscription bridge) as the primary judge -- same Sonnet model class, different routing path (subscription quota vs metered API). No openrouter fallback was needed unless recorded per-slice in judge_model.

## Row-level stance gate (reporter disposition, negative arms)

| Assigned arm | Rows | Faithful | Labels |
|---|---|---|---|
| face_threat_challenge | 10 | 7 | {"weak_or_warm_in_costume":3,"faithful":7} |
| ironic_challenge | 10 | 7 | {"faithful":7,"weak_or_warm_in_costume":3} |
| sarcastic_challenge | 10 | 7 | {"weak_or_warm_in_costume":3,"faithful":7} |

## Per-arm aggregate: ALL slices

| Arm (cells) | n | Overall old→new (Δ) | recognition_cost old→new (Δ) | post_turn_face_repair old→new (Δ) | target_discipline old→new (Δ) |
|---|---|---|---|---|---|
| charismatic_challenge (193) | 9 | 46.3→68.1 (+21.8) | -→- (-) | -→- (-) | -→- (-) |
| face_threat_challenge (198) | 16 | 53.7→76.0 (+22.3) | 3.1→4.1 (+1.0) | 2.3→3.8 (+1.5) | 3.1→4.3 (+1.2) |
| ironic_challenge (196) | 17 | 58.5→83.8 (+25.2) | 3.4→4.5 (+1.1) | 2.6→3.9 (+1.3) | 3.5→5.0 (+1.5) |
| sarcastic_challenge (197) | 16 | 53.8→79.6 (+25.8) | 3.3→4.3 (+1.0) | 2.4→3.9 (+1.5) | 3.3→4.7 (+1.4) |

## Per-arm aggregate: slices of stance-FAITHFUL rows only (row-level reporter gate)

| Arm (cells) | n | Overall old→new (Δ) | recognition_cost old→new (Δ) | post_turn_face_repair old→new (Δ) | target_discipline old→new (Δ) |
|---|---|---|---|---|---|
| face_threat_challenge (198) | 10 | 52.6→75.8 (+23.1) | 3.0→4.0 (+1.0) | 2.2→3.9 (+1.7) | 2.9→4.0 (+1.1) |
| ironic_challenge (196) | 12 | 54.5→84.6 (+30.1) | 3.3→4.5 (+1.3) | 2.3→3.9 (+1.6) | 3.3→5.0 (+1.7) |
| sarcastic_challenge (197) | 11 | 52.2→79.0 (+26.8) | 3.2→4.3 (+1.1) | 2.3→3.9 (+1.6) | 3.2→4.5 (+1.4) |

## Per-arm aggregate: stance-faithful at slice level (secondary view)

The same fidelity function applied to each register-adopting turn itself rather than the row's designated resistance turn.

| Arm (cells) | n | Overall old→new (Δ) | recognition_cost old→new (Δ) | post_turn_face_repair old→new (Δ) | target_discipline old→new (Δ) |
|---|---|---|---|---|---|
| face_threat_challenge (198) | 8 | 55.1→82.8 (+27.7) | 3.1→4.3 (+1.1) | 2.3→4.3 (+2.0) | 3.1→4.4 (+1.3) |
| ironic_challenge (196) | 11 | 55.0→85.5 (+30.5) | 3.3→4.5 (+1.3) | 2.4→4.0 (+1.6) | 3.4→5.0 (+1.6) |
| sarcastic_challenge (197) | 11 | 52.2→79.0 (+26.8) | 3.2→4.3 (+1.1) | 2.3→3.9 (+1.6) | 3.2→4.5 (+1.4) |

## Per-slice detail

| Row | Cell | Scenario | Register | Slice | RT? | Row gate | Slice fidelity | Overall old→new | recog_cost old→new | face_repair old→new | target_disc old→new |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 69 | 193 | boredom | charismatic_challenge | turn_1 | y | n/a | n/a | 46.3→65.0 | -→- | -→- | -→- |
| 69 | 193 | boredom | charismatic_challenge | turn_2 |  | n/a | n/a | 46.3→71.2 | -→- | -→- | -→- |
| 73 | 193 | frustration | charismatic_challenge | turn_1 | y | n/a | n/a | 46.3→62.5 | -→- | -→- | -→- |
| 77 | 193 | irrelevance | charismatic_challenge | turn_1 | y | n/a | n/a | 46.3→77.5 | -→- | -→- | -→- |
| 77 | 193 | irrelevance | charismatic_challenge | turn_2 |  | n/a | n/a | 46.3→66.3 | -→- | -→- | -→- |
| 81 | 193 | question_flood | charismatic_challenge | turn_1 | y | n/a | n/a | 46.3→68.8 | -→- | -→- | -→- |
| 81 | 193 | question_flood | charismatic_challenge | turn_2 |  | n/a | n/a | 46.3→67.5 | -→- | -→- | -→- |
| 85 | 193 | rote_parroting | charismatic_challenge | turn_1 | y | n/a | n/a | 46.3→67.5 | -→- | -→- | -→- |
| 85 | 193 | rote_parroting | charismatic_challenge | turn_2 |  | n/a | n/a | 46.3→66.3 | -→- | -→- | -→- |
| 70 | 196 | boredom | ironic_challenge | turn_1 | y | faithful | faithful | 48.0→94.5 | 3.0→5.0 | 2.0→5.0 | 3.0→5.0 |
| 70 | 196 | boredom | ironic_challenge | turn_2 |  | faithful | weak_or_warm_in_costume | 48.0→74.5 | 3.0→4.0 | 2.0→3.0 | 3.0→5.0 |
| 74 | 196 | frustration | ironic_challenge | turn_1 | y | weak_or_warm_in_costume | weak_or_warm_in_costume | 57.5→87.5 | 3.0→5.0 | 3.0→4.0 | 4.0→5.0 |
| 74 | 196 | frustration | ironic_challenge | turn_2 |  | weak_or_warm_in_costume | weak_or_warm_in_costume | 68.5→77.0 | 4.0→4.0 | 3.0→3.0 | 3.0→5.0 |
| 78 | 196 | irrelevance | ironic_challenge | turn_1 | y | weak_or_warm_in_costume | weak_or_warm_in_costume | 48.0→86.5 | 3.0→4.0 | 2.0→4.0 | 3.0→5.0 |
| 78 | 196 | irrelevance | ironic_challenge | turn_2 |  | weak_or_warm_in_costume | weak_or_warm_in_costume | 70.0→63.5 | 4.0→4.0 | 3.0→3.0 | 4.0→5.0 |
| 82 | 196 | question_flood | ironic_challenge | turn_1 | y | faithful | faithful | 94.5→100.0 | 5.0→5.0 | 5.0→5.0 | 5.0→5.0 |
| 82 | 196 | question_flood | ironic_challenge | turn_2 |  | faithful | faithful | 48.0→74.5 | 3.0→4.0 | 2.0→3.0 | 3.0→5.0 |
| 86 | 196 | rote_parroting | ironic_challenge | turn_1 | y | weak_or_warm_in_costume | weak_or_warm_in_costume | 97.5→94.5 | 5.0→5.0 | 5.0→5.0 | 5.0→5.0 |
| 89 | 196 | boredom | ironic_challenge | turn_1 | y | faithful | faithful | 48.0→97.0 | 3.0→5.0 | 2.0→5.0 | 3.0→5.0 |
| 89 | 196 | boredom | ironic_challenge | turn_2 |  | faithful | faithful | 48.0→83.0 | 3.0→5.0 | 2.0→3.0 | 3.0→5.0 |
| 92 | 196 | irrelevance | ironic_challenge | turn_1 | y | faithful | faithful | 48.0→97.0 | 3.0→5.0 | 2.0→5.0 | 3.0→5.0 |
| 95 | 196 | rote_parroting | ironic_challenge | turn_1 | y | faithful | faithful | 48.0→78.5 | 3.0→4.0 | 2.0→4.0 | 3.0→5.0 |
| 95 | 196 | rote_parroting | ironic_challenge | turn_2 |  | faithful | faithful | 79.0→74.5 | 4.0→4.0 | 3.0→3.0 | 5.0→5.0 |
| 98 | 196 | frustration | ironic_challenge | turn_1 | y | faithful | faithful | 48.0→78.0 | 3.0→4.0 | 2.0→3.0 | 3.0→5.0 |
| 98 | 196 | frustration | ironic_challenge | turn_2 |  | faithful | faithful | 48.0→71.5 | 3.0→4.0 | 2.0→3.0 | 3.0→5.0 |
| 101 | 196 | question_flood | ironic_challenge | turn_1 | y | faithful | faithful | 48.0→92.0 | 3.0→5.0 | 2.0→5.0 | 3.0→5.0 |
| 71 | 197 | boredom | sarcastic_challenge | turn_1 | y | weak_or_warm_in_costume | weak_or_warm_in_costume | 48.0→97.0 | 3.0→5.0 | 2.0→5.0 | 3.0→5.0 |
| 71 | 197 | boredom | sarcastic_challenge | turn_2 |  | weak_or_warm_in_costume | weak_or_warm_in_costume | 48.0→59.0 | 3.0→3.0 | 2.0→2.0 | 3.0→5.0 |
| 75 | 197 | frustration | sarcastic_challenge | turn_1 | y | weak_or_warm_in_costume | weak_or_warm_in_costume | 94.5→81.5 | 5.0→4.0 | 5.0→4.0 | 5.0→5.0 |
| 75 | 197 | frustration | sarcastic_challenge | turn_2 |  | weak_or_warm_in_costume | weak_or_warm_in_costume | 48.0→77.0 | 3.0→4.0 | 2.0→3.0 | 3.0→5.0 |
| 79 | 197 | irrelevance | sarcastic_challenge | turn_1 | y | weak_or_warm_in_costume | weak_or_warm_in_costume | 48.0→89.5 | 3.0→5.0 | 2.0→5.0 | 3.0→5.0 |
| 83 | 197 | question_flood | sarcastic_challenge | turn_1 | y | faithful | faithful | 48.0→97.0 | 3.0→5.0 | 2.0→5.0 | 3.0→5.0 |
| 83 | 197 | question_flood | sarcastic_challenge | turn_2 |  | faithful | faithful | 48.0→71.5 | 3.0→4.0 | 2.0→3.0 | 3.0→5.0 |
| 87 | 197 | rote_parroting | sarcastic_challenge | turn_1 | y | faithful | faithful | 67.0→78.5 | 4.0→4.0 | 4.0→4.0 | 3.0→4.0 |
| 90 | 197 | boredom | sarcastic_challenge | turn_1 | y | faithful | faithful | 48.0→72.0 | 3.0→4.0 | 2.0→4.0 | 3.0→4.0 |
| 93 | 197 | irrelevance | sarcastic_challenge | turn_1 | y | faithful | faithful | 48.0→94.5 | 3.0→5.0 | 2.0→5.0 | 3.0→5.0 |
| 93 | 197 | irrelevance | sarcastic_challenge | turn_2 |  | faithful | faithful | 48.0→71.5 | 3.0→4.0 | 2.0→3.0 | 3.0→5.0 |
| 96 | 197 | rote_parroting | sarcastic_challenge | turn_1 | y | faithful | faithful | 48.0→78.0 | 3.0→4.0 | 2.0→4.0 | 3.0→4.0 |
| 96 | 197 | rote_parroting | sarcastic_challenge | turn_2 |  | faithful | faithful | 48.0→74.5 | 3.0→4.0 | 2.0→3.0 | 3.0→5.0 |
| 99 | 197 | frustration | sarcastic_challenge | turn_1 | y | faithful | faithful | 48.0→78.5 | 3.0→4.0 | 2.0→4.0 | 3.0→5.0 |
| 99 | 197 | frustration | sarcastic_challenge | turn_2 |  | faithful | faithful | 75.5→65.0 | 4.0→4.0 | 3.0→3.0 | 5.0→4.0 |
| 102 | 197 | question_flood | sarcastic_challenge | turn_1 | y | faithful | faithful | 48.0→88.5 | 3.0→5.0 | 2.0→5.0 | 3.0→4.0 |
| 72 | 198 | boredom | face_threat_challenge | turn_1 | y | weak_or_warm_in_costume | weak_or_warm_in_costume | 48.0→81.5 | 3.0→4.0 | 2.0→4.0 | 3.0→5.0 |
| 72 | 198 | boredom | face_threat_challenge | turn_2 |  | weak_or_warm_in_costume | weak_or_warm_in_costume | 48.0→64.5 | 3.0→4.0 | 2.0→2.0 | 3.0→4.0 |
| 76 | 198 | frustration | face_threat_challenge | turn_1 | y | faithful | faithful | 48.0→88.5 | 3.0→5.0 | 2.0→5.0 | 3.0→4.0 |
| 80 | 198 | irrelevance | face_threat_challenge | turn_1 | y | weak_or_warm_in_costume | weak_or_warm_in_costume | 48.0→94.5 | 3.0→5.0 | 2.0→5.0 | 3.0→5.0 |
| 80 | 198 | irrelevance | face_threat_challenge | turn_2 |  | weak_or_warm_in_costume | weak_or_warm_in_costume | 48.0→68.0 | 3.0→4.0 | 2.0→3.0 | 3.0→4.0 |
| 84 | 198 | question_flood | face_threat_challenge | turn_1 | y | weak_or_warm_in_costume | weak_or_warm_in_costume | 48.0→81.0 | 3.0→5.0 | 2.0→5.0 | 3.0→5.0 |
| 84 | 198 | question_flood | face_threat_challenge | turn_2 |  | weak_or_warm_in_costume | weak_or_warm_in_costume | 92.0→69.0 | 5.0→4.0 | 5.0→3.0 | 5.0→5.0 |
| 88 | 198 | rote_parroting | face_threat_challenge | turn_1 | y | faithful | faithful | 48.0→87.5 | 3.0→4.0 | 2.0→4.0 | 3.0→5.0 |
| 88 | 198 | rote_parroting | face_threat_challenge | turn_2 |  | faithful | weak_or_warm_in_costume | 48.0→62.5 | 3.0→4.0 | 2.0→3.0 | 3.0→4.0 |
| 91 | 198 | boredom | face_threat_challenge | turn_1 | y | faithful | faithful | 49.5→85.0 | 2.0→4.0 | 2.0→5.0 | 1.0→4.0 |
| 94 | 198 | irrelevance | face_threat_challenge | turn_1 | y | faithful | faithful | 76.5→85.0 | 4.0→4.0 | 3.0→4.0 | 5.0→5.0 |
| 97 | 198 | rote_parroting | face_threat_challenge | turn_1 | y | faithful | faithful | 48.0→81.5 | 3.0→4.0 | 2.0→4.0 | 3.0→4.0 |
| 97 | 198 | rote_parroting | face_threat_challenge | turn_2 |  | faithful | faithful | 75.0→65.0 | 4.0→4.0 | 3.0→3.0 | 4.0→4.0 |
| 100 | 198 | frustration | face_threat_challenge | turn_1 | y | faithful | faithful | 48.0→92.0 | 3.0→5.0 | 2.0→5.0 | 3.0→5.0 |
| 100 | 198 | frustration | face_threat_challenge | turn_2 |  | faithful | invalid_person_attack | 37.5→32.5 | 2.0→2.0 | 2.0→2.0 | 1.0→1.0 |
| 103 | 198 | question_flood | face_threat_challenge | turn_1 | y | faithful | faithful | 48.0→78.0 | 3.0→4.0 | 2.0→4.0 | 3.0→4.0 |
## Bounded interpretation

**The rescore confirms the null on faithful rows; it does not reveal hidden costs.** Under `claude-code.sonnet-5`, every arm's overall execution score and every social-triad dimension (`recognition_cost`, `post_turn_face_repair`, `target_discipline`) moves UP relative to gpt-mini, on all slices and on the faithful-row subset alike (recognition_cost 3.0-3.3 → 4.0-4.5; face repair 2.2-2.3 → 3.9; target discipline 2.9-3.3 → 4.0-5.0; higher = less harm on these dimensions). The only dimension that moves slightly down is `uptake_freedom` (≈4.2 → ≈4.0). The generated negative-register turns, including the stance-faithful ones, read to a discriminating judge as disciplined, repair-oriented challenge — generation-side warmth, not judge blindness, remains the explanation for the missing cost pattern.

**Why "the new judge is just warmer" does not explain this away.** In the licensing exemplar test, a sonnet-class judge scored known-corrosive slices 29-52 overall while giving controls 58-76. On these generated slices the same judge class scores faithful negative-register slices 62-100, far above its own corrosive band — with one exception that proves the instrument works in-run: row 100 (`face_threat_challenge`, frustration, turn_2), the single slice the deterministic guardrail flags as a person-directed violation, scores 32.5, inside the corrosive exemplar band, and is the lowest slice in the dataset. The judge separates when there is something to separate.

**The gpt-mini numbers were not measurements.** gpt-mini assigned the byte-identical overall (48.0) with the byte-identical social triad (3, 2, 3) to 35 of 49 register-rubric slices, independent of content — the same signature the hand-authored exemplar test exposed (identical scores on all 10 known-label slices). The previously recorded arm means and social-triad values from these runs should be treated as instrument noise, not as evidence about the arms.

**The face_threat comparison.** The earlier "measurable recognition/face-repair cost at the face-threat extreme" reading (from the lost run `eval-2026-07-02-e511f92c`: recognition_cost 3.1, face_repair 2.3 under gpt-mini) does not replicate on the surviving runs under the discriminating judge: face_threat's triad lands at recognition_cost 4.1 / face repair 3.8 / target discipline 4.3, in the same band as the ironic and sarcastic arms. gpt-mini gave its ~2.3 face-repair value to ALL THREE negative arms here, so the apparent face_threat-specific depression was part of the same compressed-band artifact. What survives is a weaker, relative claim: face_threat remains the lowest-scoring negative arm on execution overall (76.0 vs 79.6 sarcastic / 83.8 ironic, all slices), and the dataset's only guardrail-flagged corrosive slice is a face_threat slice. `face_threat_challenge` stays simulated-only.

**Scope.** n = 30 assigned negative-register rows / 49 register slices across three runs on one Codex generation stack, single judge per pass (judge swap, not a paired panel), simulated learner only. This licenses instrument-level conclusions (which judge to use; what the old numbers were worth) and the per-protocol null on faithful rows as scored; it does not license "sarcasm is pedagogically safe," any human-facing claim, or any scaled effect estimate.
