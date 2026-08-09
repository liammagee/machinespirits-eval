# Baseline Comparison Design (§15.7 / Phase 5)

**Status:** valid n=5 pilot and two-stage decision audit complete; decision gate failed, candidate repair failed fresh holdout validation, and n=10 is stopped.
**Question:** does the explicit warrant gate produce behaviour materially different from the uninstrumented stub, and is the difference an improvement at the decision level and downstream?

## Conditions

| Condition | Gate mode | What it isolates |
|---|---|---|
| baseline | off | the frontier model's implicit adaptation, unchanged pipeline |
| instrumented | observe | decision-quality measurement with zero behaviour change — how often would the gate have fired, and would gold agree |
| intervening | active | the full loop: warranted revisions override family + stance |

## Learners (automated profiles)

- `low_agency` — the target case; the gate should fire and hand agency back.
- `diligent` — false-positive control; the gate should rarely fire, and firings here count against it.
- `affective_resistant` — pressure case; checks the gate's complaint track against the face-threat machinery rather than duplicating it.

## Size and cost

10 sessions per condition-learner cell (90 sessions), fixed 8 learner turns, run seeds pinned per session index. At roughly the observed cost of the generation sessions used in this arc, that is well inside a subscription evening; halve to 5 per cell for a pilot gate.

## Measures — decision level and downstream kept separate

Decision level (scored on a sampled subset with fresh two-annotator gold, protocol as in `gold-annotations-first-corpus.md`):

1. Warrant precision/recall against consensus labels; uncertain rows reported, not scored.
2. Turns from first warranted point to first revision (the "held past warrant" lag the shadow found in the July sessions).

Downstream (architecture-independent channels only — the gate's own signals must not score its success):

3. Learner record growth per session: grounded facts entered by session end (the deference sessions sat at 4 the whole way).
4. Deference break: the turn index of the learner's first unhedged own-voice claim, if any.
5. Optional: existing tutor-turn scoring (v2.2) on transcripts, blind to condition.

## Reading rules

- The active condition can only claim an improvement on measures 3–5; measure 1–2 gains are expected by construction and count as manipulation checks.
- A null on 3–5 with clean 1–2 means the instrumentation is measurable but not yet consequential — report as such, do not re-frame.
- Diligent-learner firings are the false-positive denominator; report them with every headline number.

## Live smoke results (2026-08-10, pre-study)

Two active-mode sessions, permission-seeking learner, 6 turns each.

- Seed 3 exposed a wiring bug: the configuration builder recorded the proposed family but ran its own selector, so overrides changed stance only. Fixed (family override honored; instructional repair keeps priority).
- Seed 4, post-fix: the gate warranted at turns 3 and 6 (two trouble turns each time) and the delivered family flipped to challenge-the-resistance at both, stance precise; the tutor's realized turn told the learner to make the entry themselves. The trouble pool correctly reset after each revision, and the intervening turns fell back to the builder's own selection — the gate is per-turn, not sticky; a commitment that persists across turns is future work.
- Suggestive, n=1: two turns after the first challenge, the learner produced the session's first unhedged own-voice claim ("It rules out clipping; these shillings were newly struck.") — the deference break that never happened in either baseline session. The trial-book record still did not grow. Both observations are exactly measures 3–4 of this design; nothing stronger is claimed from a smoke.
- Classifier note: mid-sentence deferring clauses ("What public matter would you have me examine first?") still read neutral; the pattern is utterance-initial only. Left as-is pending the study — widening it mid-arc would re-burn the corpora.

## Live/offline evidence parity (closed 2026-08-10)

The live gate now freezes the final uptake, repetition, deterministic-fallback,
mechanical-repair, guard, and pacing outcome after tutor turn N commits, then
consumes it at decision N+1 alongside learner-record growth. This matches the
offline shadow's evidence window without leaking post-decision information
backward. The outcome is persisted on `turn_complete` and as
`tutor_warrant_gate_outcome`; live decisions expose `prior_turn_outcome` for
coverage and parity checks.

The valid-pilot smoke exposed one remaining offline indexing error: the shadow
read the preflight captured before learner N rather than the committed record
after learner N, putting record growth one decision late. The replayer now uses
committed `turn_complete` DAG counts for t -> t+1 (with an equivalent shifted
preflight fallback for historical traces). The observed active-session mismatch
moved from 6/7 to 7/7 live/shadow agreement; held-out gold remains 4/4 scored
and second-annotator validation remains 1/1 scored with six uncertain rows.

The study harness is `scripts/run-adaptive-warrant-baseline-study.js` (npm alias
`tutor:stub:warrant-baseline`). It freezes the dynamic register policy, Marrick
world, strict DAG, eight learner turns, no early grounded stop, no light
adaptation, no DAG-fact dropout, model routing, and paired session seeds. Only
`--warrant-gate off|observe|active` changes. Live execution requires
`--launch-approved`; the same matrix must be run with `--dry-run` first.

## Pilot execution validity note (2026-08-10)

The first 45-session live matrix completed, but it is not study evidence. All
360 combined learner-analysis prompts exceeded the old 30k audit ceiling, so
the tutor used fallback classifications throughout and the learner record was
constant at 4 grounded / 0 voiced-derived facts. Its zero record-growth result
is therefore a dead measurement channel, not a null policy effect.

The failed artifacts remain preserved under their original study root. The
auto-eval wrapper now forwards the existing `compact_v1` learner-analysis
profile, which removes duplicate question text and JSON whitespace without
changing the analysis task. The learner-analysis surface remains bounded but
uses the same 42k / 10.5k envelope as the tutor-turn surface. An independent
eight-turn smoke then executed 8/8 learner-analysis calls with no prompt-audit
fallback and grew the public learner record from 4 to 7 facts. The fresh pilot
uses a new root and fingerprints both the prompt profile and its source files.

## Pilot completion boundary (2026-08-10)

The replacement n=5 matrix completed all 45 planned sessions and all 360
combined learner-analysis calls without prompt-audit or classification
fallback. Every observe/active decision had its completed-turn evidence, and
live/shadow agreement was complete on those decisions. The condition-blinded
18-case decision sample is frozen for two independent annotators. The harness
also has a deterministic consensus scorer: hard yes/no agreement is scored,
disagreement or either `uncertain` label is reported but excluded, and the
result emits precision, recall, accuracy, and its source hashes.

At that checkpoint execution and manipulation validity were closed, not the
study: decision precision/recall still awaited annotation, and the downstream
pilot was too small to promote as a paper or human-learning claim. The observe
arm—whose gate cannot alter the response configuration—had also moved relative
to off, showing that paired session seeds do not eliminate frontier-model draw
variance. The next decision was therefore whether annotation and the negative
control justified repair before any n=10 scale-up; the sections below record
that decision.

## Annotation result and bounded repair attempt (2026-08-10)

Two context-isolated readers independently labelled the frozen 18-case sample.
Raw agreement was 0.833; 15 hard-consensus cases were scored and 3 were
uncertain. The gate recorded TP=0, TN=9, FP=4, FN=2: precision 0, recall 0,
accuracy 0.600. This fails the decision-level gate independently of downstream
outcomes.

The primary errors suggested a bounded repair: discharge old flat-record
trouble after positive record growth, require sustained rather than one-off
deference, and allow recurring interactional trouble to defeat the analytic
mask only after demonstrated progress. The candidate preserved the earlier
held-out hard decisions and retrospectively matched all 15 hard-consensus
primary cases. Because that corpus had already shaped the repair, the 15/15 is
calibration evidence only.

A disjoint 18-case holdout was then frozen from the remaining pilot decision
points. The corrected freeze has zero overlap with the primary sample. Two new
blind reads reached 0.889 raw agreement; 16 hard-consensus cases were scored
and 2 were uncertain. The candidate recorded TP=0, TN=13, FP=1, FN=2:
precision 0, recall 0, accuracy 0.813. On the same holdout the pre-repair rule
had precision 0.333, recall 0.500, and the same accuracy. The candidate did not
generalize and was reverted rather than promoted into the live gate.

The holdout distinguishes two semantic gaps that generic trouble accumulation
cannot solve. First, an action family needs a termination condition: when a
`challenge_resistance` turn succeeds and the learner makes the bounded claim,
continuing the challenge is itself the wrong strategy even without immediate
DAG growth. Second, the state needs a typed unresolved evidence request: a
learner can remain analytically competent while repeated requests for a
specific missing comparison go unanswered. Both are instances of the authored
expected-uptake extension already left open in the architecture design.

## Downstream negative-control result and scale decision

Paired observe-minus-off record growth was +0.6 for low-agency, +0.4 for
diligent, and +0.8 for affective-resistant learners. The corresponding
active-minus-off values were 0.0, -0.2, and +0.2. The inert arm therefore moved
as much as or more than the intervention on this channel. Paired seeds did not
freeze the stochastic frontier-model trajectory.

The n=10 matrix is not licensed and was not launched. The next experiment must
first validate action-family uptake/termination contracts on newly generated,
independently labelled decision points. Downstream causal comparison should
then use frozen-prefix counterfactual replay or enough replicated draws to
estimate model variance, rather than scaling the current paired-seed design.

These results are internal automated-learner calibration evidence. They do not
establish a learning effect, an optimal repair policy, or a human-learner
claim.
