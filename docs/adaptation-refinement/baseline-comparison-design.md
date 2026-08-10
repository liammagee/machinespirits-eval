# Baseline Comparison Design (§15.7 / Phase 5)

**Status:** valid n=5 pilot and two-stage decision audit complete; the typed-contract
gate failed and n=10 remains stopped. A post-freeze context audit invalidated the
two `close_inquiry` successor labels as terminal-closure gold, while preserving
the public-obligation diagnosis. The successor ledger/completion architecture is
implemented; a fresh two-world all-turn mechanism-validation study is
predeclared but not yet evidence.
**Question:** does the explicit warrant gate produce behaviour materially different from the uninstrumented stub, and is the difference an improvement at the decision level and downstream?

## Conditions

| Condition | Gate mode | What it isolates |
|---|---|---|
| baseline | off | the frontier model's implicit adaptation, unchanged pipeline |
| instrumented | observe | decision-quality measurement with zero behaviour change — how often would the gate have fired, and would gold agree |
| intervening | active | the full loop: apply required family/stance overrides, preserve warranted same-family commitments under final authority, and carry orthogonal public-obligation directives |

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

## Successor design: expected-uptake contracts and fresh gate

The successor study replaces generic commitment persistence with typed
action-family contracts. Every catalogue family declares an expected learner
response, deadline, success transition, defeat transition, and expiry
transition. The first executable boundary covers the two fresh-holdout misses:
successful agency restoration terminates `challenge_resistance`, while a
repeated request for the same missing evidence or comparison defeats
`stage_next_step`. The registry is shared by live selection and offline replay.

Before new dialogue generation, the 18-case decision gate is frozen in
`remaining-next-steps.md`: agreement >=0.80; at least 12 consensus decisions
with 2 positives and 6 negatives; precision and recall >=0.70; accuracy >=0.75;
at least 2 consensus-positive successor decisions with exact transition
accuracy >=0.70; diligent false-positive rate <=0.25; and live/offline parity
1.00. A failed component stops the downstream sequence.

## Successor gate execution result

The contract-validation matrix completed all nine planned dialogues and 72
turns with complete learner-analysis coverage and zero fallback. The frozen
18-case corpus (`8ad4e43d8619894cba5793d0e09406dd60ab332d43c38310badbae8454938117`)
had zero overlap with both prior annotation corpora. Two new blind readers
completed all cases before scoring.

The gate failed: raw agreement 0.778; 14 scored consensuses (7 positive, 7
negative); TP=2, TN=5, FP=2, FN=5; precision 0.500; recall 0.286; accuracy
0.500. Four positive cases had exact successor consensus, with transition
accuracy 0/4. Diligent false positives were 1/4 = 0.250. Live/offline agreement
was 41/42 = 0.976; the sole mismatch was a turn-1 offline tracker
initialization defect, fixed after freeze without changing this score.

The stop rule therefore applies. No frozen-prefix or replicated-draw outcome
comparison was launched. The next design iteration must first add a persistent
public-obligation ledger, distinguish a learner proposing a test from asking
the tutor to supply its result, and add an inquiry-completion predicate that
can license `close_inquiry`. Those additions require another zero-overlap blind
decision gate; the present diagnostic corpus is burned and is not suitable for
post-hoc validation.

## Post-freeze correction to the terminal-closure interpretation

The reported gate result above remains the exact historical scorer output, but
the later semantic audit found that the two hard-consensus `close_inquiry`
successors were not valid terminal-closure gold. The blinded v2 corpus exposed
the transcript, learner-record counts, and strategy in force, but not the
authored release schedule or decision-time due/future-evidence counts. Both
readers therefore inferred an exhausted evidence sequence that the runtime did
not have:

- case 007 was decision turn 8, when `p_crucible` was due; only three of nine
  authored releases had committed before the decision and five later releases
  were still licensed;
- case 011 was decision turn 7; `dueNow` was empty, but `p_crucible` was the
  next release at turn 8 and six of nine authored releases remained;
- in both cases the learner DAG reported `finalSecretEntailed=false`,
  `assertedSecret=false`, best-path coverage 0.167, and a
  `release_or_pacing_gap` bottleneck.

The corpus and scores are not rewritten. Those two rows remain part of the
burned calibration history, but they cannot support an inquiry-completion
defect, `close_inquiry` successor accuracy, or a rule that treats the end of an
eight-turn sample as the end of the authored inquiry. Their positive
strategy-transition labels may have another defensible reading, but that
cannot be reconstructed after unblinding.

The public-obligation defect survives this correction. Cases 014 and 016 show
respectively a direct request for a touchstone result and a balance/ring request
that remained unanswered across an intervening tutor move. Detecting that
tutor-owned debt does not require pretending that future evidence is absent;
availability instead determines whether the tutor must answer now or give a
specific accountable deferral.

## Implemented successor mechanism

The next architecture is now present in the shared live/offline path:

1. A precision-first public speech-act classifier distinguishes
   `tutor_directed_public_result_request` from `learner_proposed_test`,
   `criterion_question`, `tutor_selection_request`, withdrawal, transfer, and
   other speech. Classifier labels may corroborate the public text but cannot
   create an obligation by themselves.
2. A persistent public-obligation ledger records tutor-owned, target-typed
   result debt. It survives action-family changes and moves through open,
   overdue/reactivated, deferred, satisfied, withdrawn, or transferred states.
   A deferral is valid only when it names the unavailable target and a concrete
   public next condition; unrelated questioning does not discharge the debt.
3. A deterministic inquiry-completion object projects the existing learner DAG,
   dialogue-closure state, and public-safe release counts. Ordinary completion
   requires strict grounded-and-asserted closure **and** a known, exhausted
   authored release scope. An explicitly authored
   bounded scope may instead license a proof-limit conclusion, but an empty
   `dueNow`, release exhaustion alone, a fixed run horizon, or local
   conversational completion never does. Any unresolved public obligation,
   unsupported assertions, active dropped facts, or unintegrated released
   evidence block closure.
4. Completion is emitted as `decision_kind=terminal_transition`, with
   `close_inquiry` as its licensed family. It is not redescribed as a failed
   repair strategy. An answerable public obligation blocks completion and
   routes to `answer_accountably`.
5. The gate now separates two questions that the earlier scorer conflated:
   `commitment_transition_warranted` compares the recommended family with the
   prior delivered family, while `current_candidate_override_required`
   compares it with the response configuration already proposed for the
   current turn. Active mode overrides only the latter. Thus a transition may
   be normatively warranted while no intervention is required because the
   base selector has already proposed the right move.
6. Completed turn records persist the typed ledger and completion projections.
   Each v4 decision also carries a canonical public decision-input snapshot and
   SHA-256 digest. Resume reconstructs the reducers from committed public turns,
   and the offline replayer uses the same ledger/completion functions,
   delivered configuration, and decision-time pre-delivery release boundary.
7. In active mode the obligation directive compiles into the first-draft and
   turn-progression contracts. The answer or accountable deferral owns UPTAKE
   and precedes an unrelated due SOURCE; another question cannot substitute for
   it. Both structured and live-text progression audits check target coverage
   and delivery status, with a public-safe deterministic deferral fallback.
8. Active mode also makes typed completion a hard constraint on the older
   DAG-only closure frame. If that frame says closure is mandatory/available
   while typed completion remains open, the frame is reset to open and a
   premature `close_inquiry` candidate is overridden to `stage_next_step`,
   `reanchor_public_evidence`, or `compress_sayback` according to the blocker.
   Observe mode records the disagreement and remains behaviorally inert.

These are implemented mechanisms with regression coverage, not a validated
policy or outcome claim. The live gate remains experimental and off by
default.

## Successor mechanism-validation protocol (predeclared 2026-08-10)

The next study is a mechanism-validation stage, not a repeat of the causal
baseline comparison. It therefore excludes the `off` condition and uses only
`observe` and `active`:

- worlds: `world_022_foxtrot_jukebox` and
  `world_028_larkspur_fridge`;
- learner profiles: `diligent`, `low_agency`, `answer_seeking`,
  `counterexample_hunter`, `goalpost_shifter`, and `fast_learner`;
- one fresh seed per world/profile/condition cell, with master seed 401;
- fixed eight-turn horizon, yielding 24 dialogues and 192 tutor decisions;
- all eight decision points from the 12 observe dialogues form the primary
  blind corpus: 96 cases, with no prediction balancing or post-hoc sampling;
- active dialogues are excluded from gold annotation. They provide matched
  intervention execution and an independent exact structured live/replay
  parity denominator.

Each blind case includes the frozen public inquiry brief (opening text, public
situation and question, opening evidence, and public requirements), public
transcript prefix, current learner turn, learner-record counts, prior delivered
family, current pre-gate candidate, and redacted public evidence availability:
authored/released/due/future/remaining counts plus release-scope exhaustion,
never the secret or future evidence identities/content. Two isolated readers
label the speech act, open obligation source turns and lifecycle state, whole-
inquiry state, prior-commitment transition, current-candidate override, primary
warrant basis, and successor family. The freeze assigns deterministic opaque
hash identifiers after a global hash shuffle of paired corpus/key rows; neither
sequential IDs nor row grouping may reveal world, profile, condition, or turn.
V3 reader envelopes and case rows use exact allowlists and scalar/array types.
Unknown or extra fields—including private/source material supplied through an
undeclared field—and type/schema violations fail before unblinding. The short
free-text evidence note is structurally type-checked only; its content is not
semantically adjudicated for private/source contamination.

The freeze manifest must bind the exact protocol, source hashes, thresholds,
all 96 observe cases, and zero fingerprint overlap with every prior corpus. Any
post-freeze change to code, the annotation handbook, projection schema,
sampling rule, or gate burns the freeze and requires fresh dialogues and
annotations. Mechanism mode therefore requires explicit `--exclude-corpus`
arguments; the live launch must name all three earlier labeled JSON corpora
listed in `remaining-next-steps.md`.

The dry run also emits `launch-authorization-request.json`. Its approval digest
binds the complete study axes, model refs and named destinations, private prompt
payload scope, prior-corpus hashes, and recursive source-provenance hash while
deliberately ignoring only the dry/live flag and output-root identity. A live
mechanism launch requires both `--launch-approved` and a completed
`--launch-authorization <file>` whose digest, destinations, payload-scope hash,
source-provenance hash, child-policy hash, exact study-plan execution hash,
approver, and canonical UTC approval time validate against the newly recomputed
request. Authorization objects have an exact key set and strict types; the
validator recomputes the request contract digest rather than trusting the
stored value. A boolean flag alone cannot launch this study. Any source,
routing, payload, command, job order, matrix, or exclusion change invalidates
the authorization before model subprocesses start.

Authorization is valid only for a clean, committed worktree. The request and
completed authorization must bind the exact 40-character `HEAD` SHA together
with the recursive source-closure hash; live validation recomputes both and
must reject a dirty tree, a non-commit SHA, or either mismatch before creating
the live plan. Committing or amending after the dry run therefore requires a
new dry run and approval digest even when the scientific matrix is unchanged.

Each dialogue runs under `--lab automated_eval` with an enforced 64-model-call
budget; every retry consumes that same budget. The complete matrix therefore
has a hard maximum of 1,536 model calls. Exhaustion seals the child as
incomplete and cannot reserve call 65.

For this frozen protocol all three roles—speaking tutor, learner analysis, and
automated learner—request `codex.gpt-5.6-luna`, resolved through the **OpenAI
Codex CLI (ChatGPT-account route)**. No OpenRouter, Anthropic, or direct OpenAI
API route is authorized. The unpublished prompt payload may contain repository-
authored system/role instructions; role-specific output schemas; the fictional
worlds' public situation, question, rule glosses, staged evidence, public fact
arrays/premise IDs, and dialogue history; current public learner/candidate text;
bounded tutor-action and response-configuration instructions; the public-only
learner-DAG preflight, prior public learner record, and compact public dialogue
state; behavior-only simulated-learner briefs; and guard issue classes plus the
compact public recovery packet. It must not contain the concealed answer,
future evidence identities or content, private proof paths or planner-only
premise identifiers, the rejected tutor draft in a recovery prompt, annotation
keys or annotator responses, simulated-learner measurement targets,
repository/Git contents, credentials as prompt content, human-subject data,
complete traces, or evaluator/consensus scores. Those artifacts remain local.
A fake-provider capture test exercises tutor, analyzer, simulated-learner, and
recovery calls with concealed-answer, future-evidence, private-source,
credential, annotation-key, and measurement-target canaries. That test exposed
and removed one Marrick-specific concealed-answer example from the analysis
rubric.

Source provenance is not a hand-maintained shortlist. The harness hashes the
explicit design/configuration resources plus the recursive static local-import
closure of the study runner, offline replayer, auto-eval runner, and actual
`tutor-stub.js` child entrypoint. Each child auto-eval seal likewise hashes the
complete local import closure of `tutor-stub.js`. A newly activated delivery,
rollback, or persistence module therefore changes the frozen fingerprint even
if no one remembers to add it to a policy-source list.

The child environment deletes inherited tutor seams, Node preload/search-path
hooks, dotenv overrides, and OpenAI/Codex API-route variables, then pins the
committed assignment-free `config/adaptive-warrant-study.env`. A no-model CLI
preflight records the invoked Codex entrypoint and its delegated native binary,
their hashes before and after local version/login probes, the installed version,
and ChatGPT-account authentication. Any wrapper/native mutation or API/custom-
base route fails before prompts are submitted.

Every accepted row is recollected from its verified child plan, event chain,
seal, exact Git SHA/dirty-state declaration, and child-policy closure. Resume is
immutable: it revalidates the stored plan and authorization request, recollects
sealed children, and reuses only exact complete/dry rows. The freeze binds this
execution-evidence manifest, not merely copied summary JSON.

Reducer parity is necessary but not sufficient for execution validity. Every
mechanism-study decision also receives a delivery-application audit. A selector
audit persists the raw pre/post source snapshots, recomputes their hashes and
field delta, and requires the post-source to equal the same pure gate-patch
function used live. Observe and active-hold are therefore exactly inert, and an
active patch cannot carry an undeclared extra field. In active mode, persisted
pre-final and frozen pre-optional selection snapshots let the scorer recompute
every displaced field and prove the enforcement schema, decision binding,
compatibility provenance, and restored configuration digest.

The first-draft contract must bind its action family, engagement stance,
actorial part, and tactic to the deterministic speaking configuration,
including any declared tactic fallback.
Final guard accounting must name the exact configuration and public text
actually delivered. Delivery may preserve the speaking configuration or use
the shared simplified-recovery constructor through a declared recovery-ladder
source; speaking transitions and recovery are counted separately. Exact nested
equality replaces the former realization-axis allowlist, while family,
obligation directive, and final-authority provenance remain invariant. A public
obligation must retain its complete unmutated target and acceptable outcomes
through compilation, then resolve in the final live audit by answering every
required component or by a target-specific accountable deferral. Any miss makes status
`invalid_delivery_application`, even when live and replay reducers agree.

### Gate and stop rule

The pre-existing aggregate gate remains in force: raw agreement at least 0.80;
at least 12 scored consensuses with at least 2 positives and 6 negatives;
precision and recall at least 0.70; accuracy at least 0.75; at least 2 successor
consensuses with exact transition accuracy at least 0.70; diligent false-
positive rate at most 0.25; and live/replay agreement 1.00.

The all-turn mechanism gate additionally requires:

- complete hard consensus across all typed fields on at least 75% of cases;
- at least 12 consensus-positive, 24 consensus-negative, and 10 exact
  successor-transition cases;
- at least 8 tutor-directed result requests and 8 learner-proposed tests, with
  request/proposal macro-F1 at least 0.80;
- prior-commitment-transition accuracy, current-candidate-override accuracy,
  and primary-warrant-basis accuracy each at least 0.75;
- obligation-lifecycle accuracy at least 0.80, with at least 8 persistence and
  6 resolution cases;
- proposed-test false-obligation rate at most 0.10;
- at least 8 complete and 12 incomplete inquiry cases, with completion
  precision at least 0.90 and recall at least 0.75;
- zero closure-safety violations, including no close while licensed evidence
  remains or an unresolved public obligation exists;
- zero structured live/replay mismatches, with non-zero observe and active
  denominators.

Missing support is a failed/inconclusive gate, never a pass by vacuity. Failure
stops the sequence before any outcome comparison. Passage would license only a
separately frozen, variance-controlled outcome design; it would not itself
establish better dialogue quality, learning, or a human-learner effect.

## First authorized mechanism execution — failed and burned (10 August 2026)

The 24-dialogue matrix was executed from clean detached commit
`21f3497666b393840e8aca3e4128d8ac1861cfc0`. It did not satisfy this protocol:
20 dialogues were valid and four were sealed `evidence_invalid`. The valid
evidence established exact structured live/replay parity for 160/160 decisions,
but delivery application reported 152 mismatched decisions and 173 issues.
Accordingly, no annotation result from this execution can pass the mechanism
gate and no outcome comparison is licensed.

The post-run audit found instrumentation defects rather than evidence for or
against downstream effectiveness: a selector digest was computed before its
persisted compatibility metadata was complete; family realization was
incorrectly attributed to the gate during observe and active-hold decisions;
two bounded realization phrases were missing from deterministic recognition;
three declarative/criterion learner moves created false public-result debt;
and recursively nested final-authority proofs grew one trace beyond the
auto-eval reader's whole-file string limit. These defects now have direct
regressions and bounded implementation corrections. Automated-only training
reuse remains intentionally `not_applicable`, because the setting governs
human/hybrid authorship and does not apply to a no-human-input study.

This is a corrective checkpoint, not a reinterpretation of the failed run. Any
successor execution must start from a new clean commit, dry rehearsal, and
explicit authorization for the new digest. It must rerun all 24 cells, freeze a
new 96-case packet, and obtain two fresh independent annotations before the
same scorer and gates are applied.

## Second authorized mechanism execution — failed and burned (10 August 2026)

The successor matrix ran from clean detached commit
`cf1336f03a46b92080921c4722e964090193646e` under exact authorization digest
`4b1fb03b54ad51206f495909f7b636650dacaa909be4612f54a141f53bb307d4`.
It collected all 24 planned rows but remained `incomplete`: 19 children were
valid eight-turn runs and five active-gate children were sealed incomplete and
recollected as `evidence_invalid`. Every observe child was valid. The 152 valid
decisions had 152/152 combined learner-analysis calls and 152/152 structured
live/replay agreement with zero mismatches. Delivery application recorded five
mismatches and ten issues. This is a substantial execution improvement over
the first run, but it still fails the all-children and zero-delivery-mismatch
requirements. Its 96-case packet must not be annotated for passage.

The five failures share one public-obligation realization mechanism. A learner
turn containing a bounded claim plus a directed result question could assign
the whole turn as the target, making incidental words mandatory and sometimes
truncating the actual subject. The criterion wording `what evidence can put a
hand ...` also created a false result obligation. When generated candidates
failed, terminal recovery could preserve their non-answering uptake and append
the deterministic deferral only after a due authored source, although the
frozen contract requires resolution in uptake before that source.

The bounded correction scopes target identity to the directed request clause,
filters request-language from subject identity, treats `put/place` evidence
questions as criteria, and gives active public debt ownership of deterministic
uptake. A compact typed label avoids verbatim-question echo, while the handoff
detects prior uptake resolution and does not repeat the deferral. The launch
preflight now executes the terminal guard-accounting and turn-progression
regressions as part of the digest-bound validation suite. Focused tests pass
160/160. The complete hermetic suite also passes 8,427/8,427 root tests and
137/137 tutor-core tests; all 35 derivation worlds and 490 workplan items pass
their repository gates.

This correction burns the second authorization and packet. A third execution
requires a new clean commit, dry request, and exact approval. Only a fresh run
with 24 valid children, zero delivery-application mismatch, and complete
structured parity may freeze the 96 observe decisions for two independent
annotations and the scorer above.

## Third authorized mechanism execution — failed and burned (10 August 2026)

The third matrix ran from clean detached commit
`b3cb1d19a619557752c063feb3669aa1563f59d9` under exact authorization digest
`eee15ccd11eee4913a24d038c96da86e9e68b79fb458b2aa7b4eb1130239b7a5`.
It collected all 24 planned rows but remained `incomplete`: 22 children were
valid and two active-gate children were sealed `evidence_invalid`. The 176
valid tutor decisions had 176/176 learner-analysis calls and 176/176 exact
structured live/replay agreement. Delivery application was much narrower than
in either prior run, but still recorded 11 mismatched decisions and 19 issues.
The run and its annotation packet are burned; they cannot be annotated for
passage.

One invalid child exposed a precision error: the copy-editing request `give me
the next line for WF-11` was treated as a request for a newly produced public
test result. Its identifier also exposed malformed target tokenization: `WF-11`
could yield `wf-` and an empty split term. The other child exposed a recovery-
ownership error: the accountable deferral for `Show me the first log entry`
was placed after a writable entry and an unrelated authored source, so the
final progression audit correctly rejected it.

Most surviving delivery mismatches exposed the same cross-turn lifecycle
error. A valid accountable deferral was assigned an automatic next-turn
deadline and reactivated on the following unrelated tutor turn. That forced
stale public-result debt into later learner moves that neither renewed the
request nor received target-matching released evidence.

The bounded correction treats copyable wording requests as non-result speech
acts, tokenizes alphanumeric identifiers without empty/trailing-hyphen terms,
and keeps a valid deferral nonblocking until a matching public release or an
explicit learner reminder. At terminal recovery, active public debt bypasses
the writable-entry substitution and a final composition boundary restores its
answer/deferral as the first host sentence before any authored source. The live
progression auditor now checks that literal first public boundary instead of
trusting a semantic uptake segmentation, and typed record deferrals retain
`log` when the requested target is a log entry.

The exact digest-bound no-model preflight passes 163/163 mechanism tests, all
35 derivation worlds, and 22/22 prompt/world checks. The complete hermetic
repository suite passes 8,430/8,430 root tests plus 137/137 tutor-core tests;
the workplan source and schema checks pass 490/490 items. These checks establish
implementation consistency only.

These are mechanism repairs, not favorable study evidence. A fourth execution
still requires a new clean commit, dry request, and exact approval. Only 24/24
valid children, zero delivery-application mismatch, and exact structured
parity may release a fresh 96-case observe packet to the two independent
annotators and frozen scorer.

## Fourth authorized mechanism execution — delivery-invalid and burned (10 August 2026)

The fourth matrix ran from clean detached commit
`f0d67e02bea393cf1b28e74bef4036ffdc88c5f3` under exact authorization digest
`3eaac28e565b5bdcd5db48d1d2a078fffc7395051e52091322e69b3aa8d2dea3`.
All 24 dialogues supplied valid sealed evidence, all 192 learner-analysis calls
completed, and all 192 structured live/replay comparisons agreed. This closes
the prior child-evidence and reducer-parity failure classes. The execution
still failed the preregistered delivery requirement: six decisions produced
eight issues, so status was `invalid_delivery_application`. The packet is
burned and no annotation or outcome comparison is licensed from it.

Five decisions exposed measurement boundaries rather than missing delivery:
two licensed closure variants were outside the finite closure grammar, two
exact public-only deferrals were outside accountable-answer recognition and
slightly exceeded the plain host sentence budget, and one valid next-step
development was length-penalized by its fixed authored-source quotation. The
sixth exposed a mechanism defect: inquiry completion treated a retained
nonblocking `deferred` obligation as open debt and vetoed a strict grounded
closure after the release scope was exhausted.

The prospective correction counts only actionable obligation states (`open`,
`overdue`, `reactivated`) as completion blockers. It measures action-family
realization on the action-owned segment, excluding a separately authored
source before computing segment metrics; admits the exact accountable deferral
and saved incident-record closure forms; and shortens the redundant deferral
handoff without weakening its named availability condition. Exact saved-
surface and lifecycle regressions pass. The launch preflight now passes
164/164 mechanism tests, 35/35 worlds, and 22/22 prompt/world checks; the full
hermetic suite passes 8,435/8,435 root and 137/137 tutor-core tests.

The same stop rule remains unchanged. A fifth execution needs a new clean
commit, dry request, and exact approval. Its blind corpus becomes eligible for
two independent annotations only after 24 valid children, 192 learner-analysis
calls, exact non-zero observe/active structured parity, and zero delivery-
application mismatch. Those annotations must then pass the frozen support,
decision, lifecycle, completion, closure-safety, and successor gates before
any outcome study begins.
