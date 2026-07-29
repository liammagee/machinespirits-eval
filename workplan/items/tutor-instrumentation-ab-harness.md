---
id: tutor-instrumentation-ab-harness
title: Instrumentation A/B — bare tutor vs instrumented tutor on one frozen dialogue
status: active
type: infra
priority: P2
owner: claude
source: manual
created: 2026-07-26
updated: 2026-07-29
verification: "`npm run tutor:stub:ab -- --print-plan` emits a finite zero-call plan;
  the baseline arm's projected request is exactly the learner utterance with zero
  advisory chars; the plan control's projected request is the learner utterance plus
  one fixed 995-char plan, identical on every turn; every arm is audited with the
  recorded run's guard set and pinning is an identity on the fixtures; a paid run
  writes report.json, report.md, and a swimlane diff whose failure-cluster deltas
  separate the arms; `node scripts/judge-tutor-stub-ab-pairs.js --mock` exercises
  the whole blind-judging path with no model calls, and `--limit 0` re-summarises a
  recorded corpus without judging anything; every rule the bench has ever raised
  carries an explicit open/told class with a stated reason, held against a
  checked-in table by `tests/tutorStubAbHarness.test.js`, and
  `node scripts/rescore-tutor-stub-ab-open-rules.js --pooled` re-splits the whole
  recorded corpus with the API keys blanked."
claim_status: scope-bound
links:
  notes:
    - docs/tutor-instrumentation-ab.md
tags:
  - tutor-stub
  - instrument
  - frozen-replay
branch: claude/tutor-instrumentation-ab
---

The tutor stub has accumulated a lot of private planner context — an evidence
window, a learner classifier, a redacted learner proof-DAG, a human discourse
scaffold, a per-turn performance contract. Nothing measured what any single
piece buys, because varying instrumentation previously meant rerunning the whole
dialogue and losing the comparison.

This item builds the A/B: replay one recorded dialogue past N arms that differ
only in which advisory blocks reach the speaking tutor, grade every arm with the
same deterministic frozen-turn audit (PR #261's `auditTutorStubFrozenCandidate`),
and render the arms as a swimlane diff with the shared learner on the spine.

Design decisions worth keeping:

- **Advisory-block projection.** Instrumentation already ships as delimited
  `[Header] … [End header]` blocks in the final user message. An arm is a subset
  of those blocks; stripping all of them leaves exactly the learner's utterance.
  This needs no change to `scripts/tutor-stub.js`.
- **Guard pinning.** Every arm is audited with the guard set the *recording* had
  enabled. Without it a bare arm is graded with all guards off and passes
  trivially. Pinning is an exact identity on the fixture guards, so it cannot
  itself move a verdict.
- **One slot, two headers.** The contract renders under either
  `[Tutor-only host plan]` or `[Tutor-only first-draft performance contract]`;
  they are one feature, else an arm could claim it dropped the contract while
  the contract was still present.

Why the reports lead with cluster counts rather than pass rate: every recorded
fixture turn fails `liveTurnProgressionAudit:learner_uptake_not_realized`, so
pass rate reads 0/N for every arm. That is the known *live-parity
reclassification* the frozen-replay corpus already tracks, not a defect this
work introduced — `auditTutorStubFrozenCandidate` skips the live
turn-progression and source-alignment audits only when handed a valid
`jointPerformanceComposition`, which a text-only replay never has. Nocturne
t007/t009/t010 carry `recordedAuditOk: true` yet recompute to `ok: false` on
exactly those two cluster families, and `tests/tutorStubFrozenReplay.test.js`
asserts that reclassifications never land outside them.

Not established, and deliberately not claimed anywhere: whether
`tutor:stub:pr-benchmark` now gates harder than it used to. It grades freshly
generated text, not recorded text, and has not been run against this.

First result, 2026-07-29, on the bench's own rules. Broken rules per turn,
pooled over every run so far: bare tutor 5.04, contract 1.67, and 4.4–5.3 for
each of the other single pieces — length padding, continuity, evidence window,
learner classifier, redacted proof-DAG readout, discourse scaffold. Only the
per-turn performance contract leaves the bare tutor's band. The apparent cost of
the contract, that it was the only arm that ever leaked, does not survive
inspection: all nine recorded leaks are checker false positives, tracked in
`workplan/items/tutor-stub-leak-audit-false-positives.md`.

Second result, 2026-07-29: an outside reader reverses that ordering. Most of
the bench's rules ask whether the tutor did what its host plan told it to do, so
the arm carrying the plan wins them close to by construction. To score the same
recorded replies through a channel that shares nothing with the plan,
`scripts/judge-tutor-stub-ab-pairs.js` shows a judge the frozen public
transcript, the learner's turn, and two candidate next turns labelled A and B,
and asks which is the better next thing to say. The judge never sees the plan,
the private notes, or the rules; the A/B layout is fixed by a hash of the pair
id; the judge runs on a model that wrote neither reply. Over 88 pairs on
Nocturne and Greyfen, 68 decided: **the contract is preferred on 10, 15%**
(se 4%). Not length — the contract wins 0% in the band where it is 292–506 chars
longer and 12% where the two replies are within 121 chars. Not layout — 11% when
the bare reply is shown first, 18% when second. 20 pairs were turned away by the
judge's own content filter, all in Greyfen.

Third result, 2026-07-29: a plan with none of our content buys nothing. The
contract does two things at once — it hands the tutor a shape for the turn and
it fills that shape with the turn's own case facts and proof state. The plan
control (`generic_plan_only`) keeps the first and drops the second: a fixed
995-character four-slot writing plan, the same text on every turn of both
scenes, so it cannot carry anything about the turn it is attached to. On eleven
turns in one batch (`exports/tutor-stub-ab/plan-control-1/`) the bench scores
bare 54 broken rules, generic plan 61, contract 18. Blind, the generic plan ties
the bare tutor 4–4 and beats the contract 8–0. Two of those eight pairs had the
contract reply *shorter* than the generic one. Both comparisons rest on 8
decided pairs with 3 turned away, so they are small; the direction agrees with
the 88-pair set.

Why the two rulers disagree, countable rather than asserted, and now built into
the bench. The bench computes a performance contract for every turn and grades
all three arms against it, but shows it to one. So the headline count is not a
ruler the arms start level on. `services/tutorStubAbRuleKeying.js` classifies
every rule the bench can raise by one question — *could a tutor handed nothing
but the public transcript and the learner's turn have satisfied this?* A
prohibition passes (`open`): any arm satisfies it by not doing the thing. A
demand to say a particular scheduled thing, where the particular comes from the
plan's named slots or a world-file release schedule only the plan relays, fails
(`told`). Every arm now reports both totals, and
`scripts/rescore-tutor-stub-ab-open-rules.js` recomputes them over every run
already on disk with no model calls.

On `plan-control-1` the contract's 36-cluster win splits 30 told, 6 open. Pooled
over all 35 recorded runs, broken rules per turn:

| arm | open | vs bare | told | vs bare | all |
|---|---|---|---|---|---|
| baseline | 1.48 | — | 3.82 | — | 5.30 |
| contract_only | 1.01 | −0.47 | 1.22 | −2.61 | 2.23 |
| evidence_only | 1.33 | −0.15 | 3.02 | −0.80 | 4.36 |
| classifier_only | 1.31 | −0.17 | 3.58 | −0.24 | 4.89 |
| scaffold_only | 1.40 | −0.08 | 3.38 | −0.44 | 4.78 |
| due_line_only | 1.43 | −0.05 | 3.37 | −0.45 | 4.80 |
| continuity_only | 1.42 | −0.06 | 3.76 | −0.07 | 5.18 |
| dag_only | 1.44 | −0.04 | 3.76 | −0.07 | 5.20 |
| length_matched | 1.55 | +0.07 | 3.62 | −0.20 | 5.17 |
| generic_plan_only | 1.55 | +0.06 | 4.00 | +0.18 | 5.55 |

(`instrumented`, `no_dag` and `no_scaffold` sit at 3–6 turns each and are too
small to read.) So about 85% of the contract's headline win — −2.61 of −3.07 per
turn — sits on rules the bare tutor was never in a position to win. No rule the
corpus has raised falls outside the classification. On the level
half it still wins, −0.47 per turn, roughly a third off the bare tutor's rate:
smaller than the headline, and real. Every other single piece is within ±0.17 of
zero there. The plan control's +0.06 open, +0.18 told is the bias backwards: its
own text says end with one question, so on turns where the hidden contract
forbids a question it breaks that rule more often than the bare tutor, which
stays quiet by luck.

Fourth result, 2026-07-29. The strongest objection to the second result is that
the judge cannot tell a clue the world file schedules for that turn from plot
the tutor invented, and marked the contract down for the former — in its own
words, for writing the case for the learner. `--show-due` puts the scheduled
clue in front of the judge as a fact of the scene, alike for both candidates and
with a rule against preferring a reply merely for naming it. The clue list is
read through the whitelist the PR benchmark uses, so the closure frame's answer
term and the private premise ids stay out of it, and it comes from the world
file, so it is the same for every version at a turn and cannot smuggle in one
version's plan. Over 106 pairs — the whole frozen pool, which adds Tallow to the
two scenes the blind set covered — 92 decided: the contract is preferred on 23,
25%. On the same 88 as the blind set, 68 of which both readings decided, it wins
19 against the blind reading's 10 — 28% against 15%. On Tallow, which neither
reading had covered before, 11%.

So the objection is partly right and does not overturn the finding. Telling the
judge which clue was due roughly doubles the contract's share of decided pairs
and still leaves it losing about seven of ten. Verdicts made with the clue list
and verdicts made without are two readings, not one, and are kept in separate
files for that reason.

Fifth result, 2026-07-29 — the due-line control, and the closing one. The
plan control is the contract's wrapping without the turn's content; this is
the mirror: the one piece of content the speaker cannot infer — the finding
the world file opens at this turn — as two unbracketed lines, with the release
decision left to the speaker, and nothing at all on a quiet turn. Arm
`due_line_only`, preset `due_line_control`, run on Tallow and Nocturne only
because every content-filter refusal in both judged passes was Greyfen.

On the rule channel the due line moves nothing: −2, −4, −1 against the bare
tutor across three runs, inside the ±3 noise band, while the contract moves
−33, −31, −36. On the schedule-shown judge the ordering reverses. Against the
bare tutor the due line is preferred on 9 of 11 decided clue turns; on quiet
turns, where its prompt is byte-identical to the bare tutor's, it splits 6 of
15 — the noise floor reading as noise, which is the arm's own validity check.
Against the contract it is preferred on 23 of 30 decided pairs — level on clue
turns at 6 of 12, and 17 of 18 on quiet turns, where the contract pads and the
due line adds nothing. A coin gives 17 of 18 about one time in ten thousand.

Read together: the contract's whole advantage on the plan-blind channel is
carried by the one sentence naming the newly opened finding. The other ~1,700
characters of staging buy rule-compliance on the channel that asks for that
staging by name, and on the independent channel they cost 17 of 18 quiet
turns. The rule channel and the judge channel now agree about what is real —
the hidden fact — and disagree only about the wrapping, which only the
plan-aware channel rewards.

Sixth result, 2026-07-29 — the character-shift control, pricing the testable
half of light stochastic adaptation. The live feature
(`services/tutorStubLightAdaptation.js`, shipped 2026-07-23, never before
measured) shifts the tutor's style and host character after two straight
confused or frustrated learner turns. Its trigger never fires on the frozen
corpus — all 14 recorded learners press for answers; none reads as confused —
so the arm (`character_shift_only`, preset `character_shift_control`) prices
the shift alone: one line on the turns a stable hash selects, casting a
hash-drawn part from the seven the frozen system prompt itself names, nothing
on the rest. Rule channel: +2, −3, +4 against the bare tutor across three runs
— inside the band, as designed, since the line claims no rules. Schedule-shown
judge, 30 pairs: on the seven shifted turns the shifted tutor is preferred 5
of 20 — the bare tutor wins three of four (a coin gives that about once in
fifty) — while the three quiet turns, byte-identical prompts, split 4 of 8.
The judge's reasons say the cost plainly: the shifted tutor plays its part
instead of answering, drifting into role-anchored questions where the bare
tutor stays on the learner's own leaf, paper and ink. Second instrument to
find the same thing — the character-development arc's per-turn mechanism also
hurt. What remains untested is the trigger claim itself (a shift exactly at a
real difficulty moment), which needs a confused-learner recording; both
existing results price the prior against it.

Standing limitation: turns after the first are counterfactual for every arm
except the one that produced the recording, since the frozen learner utterances
answered the recorded tutor. Each row is a same-context comparison of N tutors
on one fixed prompt, not two free-running conversations. This is a visual and
regression instrument; it says nothing about human learning. The blind judge is
a second instrument, not a ground truth: it is one model's reading of which turn
serves the learner better, on two scenes blind and three with the clue list,
with one speaking model behind both candidates. It is worth what it is worth
because it shares nothing with the plan — not because it is right.

The open half is a fairer ruler, not an outside one. It is still the bench's own
rules, still written alongside the instrumentation, and the classification is a
judgement call recorded in one file so it can be argued with — each rule carries
the reason it was graded the way it was. A rule nobody has classified is counted
apart and printed rather than folded into either total, so the two halves need
not add to the headline count.
