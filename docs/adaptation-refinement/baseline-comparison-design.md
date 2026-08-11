# Baseline Comparison Design (§15.7 / Phase 5)

**Status:** valid n=5 pilot and two-stage decision audit complete; n=10 remains
stopped. Seven two-world mechanism packets are burned. The seventh closed
runtime validity but failed the V4 semantic gate. The successor ledger,
completion, divergence, and deterministic collection architecture is
implemented. A 24-case authored diagnostic challenge is next; after any repair,
only a fresh representative 96-case natural frame can run the unchanged gate.
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
Primary basis keeps an incomplete-inquiry safety veto distinct from a completed-
inquiry terminal transition: `candidate_safety` labels a `close_inquiry`
candidate that must be replaced while the inquiry remains open, whereas
`inquiry_completion` is legal only when strict completion is already satisfied.
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

## Fifth authorized mechanism execution — two audit misses and burned (10 August 2026)

The fifth matrix ran from clean detached commit
`a1316a07e91dfa3bc3a1fc8438aaf213953188b2` under exact authorization digest
`fe8ff714aba05d30cc67759abbba78366c7dc76c497981f23ed4d6f1b7cca792`.
All 24 dialogues supplied valid sealed evidence, all 192 learner-analysis calls
completed, and all 192 structured live/replay decisions agreed. The complete
matrix used 611 recorded model calls, below the 1,536-call authorization cap.
Delivery application improved to two mismatches and two issues but therefore
still failed closed as `invalid_delivery_application`. Its V3 annotation
packet is burned.

Both failures were measurement-boundary false negatives. One deterministic
`answer_accountably` recovery delivered its exact public-obligation target and
valid named deferral, but an immutable authored source sentence was included
in the host's plain-stance sentence-length calculation. The other delivered
the selected `close_inquiry` family as “gather these public supports into the
final record and close it at the crew level”; the closure recognizer accepted
an explicit record noun after `close` but not a bounded same-sentence pronoun
with that record as its antecedent. The prospective audit excludes every exact
authored source span from host-owned realization metrics and admits only that
bounded antecedent-plus-pronoun closure form. Exact positive and open-record
negative controls cover both changes.

## Multidimensional divergence instrument (prospective sixth packet)

The fifth run also made a deeper pre-freeze gap explicit. The live gate emitted
only conceptual flatness while the legacy offline report added a narrow
interactional row. The public-obligation, completion, action-contract, and
pacing objects were typed, but the architecture's normative/descriptive
comparison itself was not independently measurable across all six declared
dimensions.

The shared live/offline projection now emits exactly one ordered decision-time
row for `conceptual`, `interactional`, `engagement`, `pacing`, `epistemic`, and
`strategy_exhaustion`. Every row states the normative and descriptive state,
`none|low|moderate|high` magnitude, numeric persistence, an
`aligned|productive|stalled|unsafe` interpretation, repair-warrant status, and
bounded public evidence. Aligned rows are explicit, productive divergence is
kept separate from failure, and the projection does not choose a successor
family. Current pacing is frozen in decision-input V2; gate V5 and shadow V0.3
share the same projection and structured parity covers the complete rows.

The fresh blind corpus is therefore V4. It gives readers the transcript,
learner-record trajectory, normative expected-uptake contract, raw prior audit
outcomes, public pacing signal, public-safe availability, and epistemic checks,
but keeps the six predicted rows in the private key. Readers must audit those
counters against the public transcript and label interpretation, magnitude,
and persistence independently for every dimension. The scorer reports, per
dimension, consensus rate, non-aligned support, interpretation macro-F1,
magnitude accuracy, persistence accuracy, and joint accuracy. Passage requires
at least 0.75 hard-consensus rate, two non-aligned cases, 0.70 interpretation
macro-F1, 0.70 magnitude and persistence accuracy, and 0.65 joint accuracy in
each dimension. Missing support fails inconclusively rather than silently
collapsing a dimension to “no divergence.” All prior mechanism and delivery
gates remain in force.

These corrections and the V4 instrument are prospective. They do not rescue
the fifth execution. A sixth packet must come from a new clean commit and pass
24/24 sealed children, 192/192 analysis coverage, exact structured parity, and
zero delivery mismatch before its 96 observe decisions can be independently
annotated.

The final pre-freeze audit also removed one annotation-only inconsistency.
Accountable `deferred` debt remains present in the public ledger, but it is not
a closure blocker until its named condition occurs or it is reminded or
released; only actionable `open`, `overdue`, or `reactivated` debt blocks
closure. The handbook, completion description, scorer, and regression fixture
now agree on that boundary. Current no-model verification passes 167/167 exact
mechanism tests, 35/35 derivation worlds, 22/22 prompt/world checks, 8,444/8,444
root tests, 137/137 tutor-core tests, and 490/490 workplan validations.

## Sixth authorized mechanism execution — act-classification and realization-audit confounds (11 August 2026)

The sixth matrix ran from clean detached commit
`853ad817b224723d69c48c24f58281b79a79f8cb` under exact authorization digest
`bcfdb4383bda20c30a820bbd2ac7c904bb44307cc7e269f1ee71183c71799507`.
The harness recorded 584 model calls. Twenty-two of 24 children supplied valid
sealed evidence, giving 176 valid learner-analysis calls and 176/176 exact
structured live/replay comparisons. Because two children were
`evidence_invalid` and five of 176 valid delivery checks failed, the study
remained `incomplete`; its corpus is burned and cannot be promoted to V4 gold.

Both invalid children exposed the same public-speech-act confound. Learner
questions of the form “Could you record that ...?” and “Do you want me to
record that ...?” ask for an already public finding to be entered in the
shared record. The generic modal request grammar instead classified them as
requests for the tutor to produce a missing result, created a false public obligation,
and forced a malformed deterministic deferral. The prospective classifier now
emits the non-obligation act `learner_record_entry_request` for the three finite
modal inversions `could you`, `do you want me to`, and `should I` when followed
by `record that`. A negative control preserves “Could you record what ...
reveals?” as a genuine tutor-directed result request, and the progression
contract uses the same writable-entry grammar.

The five delivery mismatches were also instrument false negatives rather than
displaced actions. On every affected decision the expected, selected,
speaking, and delivered family was identical. Four selected
`close_inquiry` turns said that “the record closes” here, at, on, or with the
supported finding; the finite recognizer covered imperative and passive closes
but not that declarative inflection. One `answer_accountably` uptake correctly
identified the missing dated evidential link, but the recognizer required a
different corrective surface. The prospective repair admits those bounded
forms, rejects evidential “the record closes in on ...”, and recognizes a
named missing evidence/link/record/result/test/warrant only when an explicit
identification verb is present.

These changes remove observed measurement confounds; they do not rescue the
sixth packet or validate the six divergence detectors. A seventh packet must
come from a new clean commit and again pass 24/24 sealed children, 192/192
analysis coverage, exact structured parity, and zero delivery mismatch before
the 96 observe decisions can be frozen for two independent V4 annotations.
The prospective checkpoint passes lint, all 35 derivation worlds, the focused
mechanism/integrity and response/progression suites, 34 prompt/world boundary
tests, 8,444/8,444 hermetic root tests, 137/137 tutor-core tests, and 490/490
source workplan validations.

## Seventh execution and V4 annotation result — execution valid, measurement gate failed (11 August 2026)

The seventh matrix ran from clean detached commit
`22142b7b897365695c929dfa1a0e47cb71f27512`. It crossed every execution
boundary for the first time: 24/24 sealed eight-turn dialogues were valid,
192/192 learner-analysis calls completed, structured live/replay parity was
192/192 with zero mismatches, and all 192 delivery-application checks matched.
The study used 599 model calls. Its 96-case all-observe corpus had SHA-256
`1526079a0bb32ea493c37f7c58e6a1595a8c52b688bdc07e8b40dbe1ee4a392d`.

Two isolated Luna readers then completed all 96 cases within the separately
authorized 24-call ceiling. Reader A labelled 33 transition-positive and 63
negative cases; reader B labelled 34 positive and 62 negative; neither used
`uncertain`. The collection process nevertheless exposed an annotation
instrument defect. Array-shaped batches allowed one wrong-ID response per
reader and one zero-output call; the complete intended IDs were recovered by
repartitioning within the fixed call cap. Validation also required declared
mechanical normalization: reader A had 84 field edits and reader B 86. Most
were `primary_warrant_basis=none` paired with a non-`hold` family or blank
dimension notes copied from that reader's case note. One row per reader needed
an explicit reader-intent correction from an internally contradictory `none`
basis to the positive basis described by the rest of that reader's labels.
These transformations are disclosed; they are not a reusable annotation
procedure.

The frozen scorer failed. Raw agreement was 0.698, with 67 scored hard
consensuses and 29 disagreements. Decision quality was TP=17, TN=32, FP=5,
FN=13: precision 0.773 passed, but recall 0.567, accuracy 0.731, and successor
transition accuracy 0.545 failed. Mechanism-wide exact consensus was 0.323.
Request/proposal macro-F1 was 0.143, obligation lifecycle accuracy 0.750, and
commitment-transition, candidate-override, and primary-basis accuracies were
0.704, 0.662, and 0.709. Closure safety had zero violations.

Only pacing passed every six-axis gate (consensus 0.969, ten non-aligned cases,
interpretation macro-F1 0.973, magnitude 0.901, persistence 0.967, joint
accuracy 0.911). Conceptual and epistemic each had only one non-aligned
consensus case. Interactional consensus was 0.698 and interpretation macro-F1
0.589. Engagement interpretation macro-F1 was 0.628. Strategy-exhaustion
interpretation macro-F1 was 0.621. The natural corpus contained no hard-
consensus obligation-persistence or obligation-resolution cases and only two
complete-inquiry cases, so those targets also failed for insufficient support.

This result separates three claims. Runtime integration, replay parity, and
delivery application are now demonstrated for this automated two-world matrix.
Pacing classification is validated only inside the same matrix. The overall
warrant mechanism and the other five divergence detectors are not validated.
No downstream outcome or learning comparison is licensed.

## Prospective post-V4 correction and two-corpus validation

The failed V4 corpus is burned. Its labels may diagnose bounded errors but may
not be rescored as a pass. That audit found three prospective corrections:

1. Extend the finite public-speech grammar to the observed disjoint forms:
   next-clue result requests; `let's`/`can we`/`may I` test proposals; exact
   tutor-selection requests; criterion questions; and declarative learner
   record-entry acts. Clause precedence prevents a selection or record entry
   from creating false tutor-owned result debt.
2. Treat explicit analytic work as conceptually aligned unless a public stall
   or low-agency deferral actually occurs. Treat a newly opened same-turn
   obligation as current uptake, not persistent interactional failure; older,
   overdue, or reactivated debt remains divergent.
3. Replace ad hoc annotation repair with deterministic reader packets keyed by
   exact opaque sample ID. The assembler rejects missing/extra IDs, requires
   substantive case and dimension notes, and records only two predeclared
   canonicalizations (`none -> hold`, `uncertain -> uncertain`). Any other
   inconsistency fails closed.

Natural sampling cannot guarantee dense support for rare lifecycle and
divergence states. A separately authored, prospectively frozen
`targeted_challenge` corpus therefore contains at least eight result requests,
eight proposed tests, eight persistence cases, six resolution cases, eight
complete inquiries, twelve incomplete inquiries, and two designed non-aligned
cases per divergence axis. Its private support plan is hash-bound but not sent
to readers.

The targeted corpus is a **diagnostic instrument, not a gate corpus**. Its
labels may expose detector failures and motivate a bounded repair, but neither
its cases nor its scores may satisfy a pass/fail threshold, estimate prevalence
or false-positive rates, or establish validation. Any repair it motivates
burns it relative to the repaired implementation.

The pass/fail gate remains the representative `natural_prevalence` frame:
after the last diagnostic-driven repair, generate the already-declared two-
world, six-profile observe/active matrix with one new eight-turn dialogue per
cell and master seed 401; annotate every decision from all twelve observe
dialogues, exactly 96 cases, without prediction balancing, down-sampling, or
post-hoc selection. The active dialogues remain execution/parity evidence and
do not enter annotation. That representative corpus alone is scored against
the unchanged thresholds in `ADAPTIVE_WARRANT_DECISION_GATE`. If it lacks a
required rare-state denominator, the result is inconclusive and fails closed;
challenge cases may not supplement it. This sampling frame and threshold rule
are declared here before any targeted-challenge reader labels are accepted.

The burned-corpus replay after the bounded code correction is diagnostic only:
request/proposal macro-F1 rises from 0.143 to 0.656 and conceptual
interpretation macro-F1 from 0.405 to 0.743, while interactional remains weak
at 0.566. Those values motivate the fresh validation; they are not evidence of
passage. The next model-backed act is therefore annotation of the separately
frozen diagnostic challenge under a new exact authorization. After any repair
and a clean checkpoint, a newly generated representative natural corpus gets a
separate freeze and authorization. It alone can pass the mechanism gate; this
is not another read or rescore of the seventh packet.

## Targeted-challenge collection instrument correction — 11 August 2026

The first authorized read of the 24-case diagnostic challenge stopped before
consensus or unblinding. Its digest-bound packets contained both the final V4
reader-envelope instruction in the handbook and the per-call batch envelope in
the response template. Reader A used the batch envelope once, then returned
two responses with V4 identity fields; a structurally constrained retry still
used the V4 schema literal. The assembler rejected these responses exactly as
designed. Four model calls were used, Reader B was never run, the key remained
private, and the diagnostic freeze is burned. API rejections during schema
validation produced no annotations and are not model calls.

Prospectively, each batch now has one packet-specific output schema. It fixes
the batch schema literal and every binding field, declares exactly the eight
opaque sample IDs, and closes every case and dimension object to extra fields.
That schema is embedded in the transmitted packet, emitted separately for the
CLI structured-output control, included by hash in the authorization contract,
and rechecked by the assembler. The final V4 `annotator_id` and
`annotation_run_id` are introduced only after all batches pass. This is an
instrument repair, not detector evidence. The next diagnostic must be newly
frozen from a clean commit and separately authorized; no labels from this
failed collection may be repaired or scored.

The next clean freeze confirmed that the envelope correction worked but exposed
two narrower semantic-response omissions. Across three Reader A calls, every
batch binding and opaque ID was exact, yet five resolved obligations retained
open-source turns and six positive warrants used invented, undeclared action
family names. All three batches were invalid, so three retries plus Reader B's
three planned calls would exceed the eight-call ceiling. The run stopped at
3/8 without Reader B, key access, editing, or scoring; that freeze is burned.

The prospective schema now enumerates the corpus's exact declared action
families instead of accepting any non-empty string. The transmitted packet and
schema descriptions also make the lifecycle invariant explicit: source turns
represent unresolved debt only, so resolved states require an empty array and
open/overdue/deferred states require a source. This remains collection-
instrument repair, not detector evidence. It requires another clean freeze and
authorization before readers resume.

## Completed targeted diagnostic and prospective V5 repair — 11 August 2026

The clean `8af328eafc9ca7151f6d31ef2ef376af6cb44bb6` challenge freeze completed
two independent 24-case reads in six calls with zero normalization edits. Raw
warrant agreement was 0.875; 21 hard-consensus decisions yielded precision
1.000, recall/accuracy 0.952, request/proposal macro-F1 1.000, and zero closure
safety violations. The challenge remains gate-ineligible, so none of these
figures establishes mechanism passage.

The lifecycle score exposed a deterministic defect: repeated unresolved
requests retained only `created_turn`, yielding 0/8 exact persistence despite
both readers identifying creation and reminder turns. The commitment field
also conflated transient public-obligation fulfilment with a change to the
held pedagogical family. Prospectively, the ledger retains all unresolved
source/reminder turns, and only pedagogical or terminal decision kinds can set
`commitment_transition_warranted`; response-level obligation fulfilment and
candidate-safety vetoes remain candidate corrections.

Reader disagreements also exposed underspecified annotation boundaries.
`aligned` now explicitly covers successful norm satisfaction, including record
growth, analytic work, and voluntary agency; `productive` is reserved for a
useful departure from the stated norm. Resolved lifecycle state persists at
the next decision with an empty unresolved-source list, and `none` means no
obligation occurred. Contract defeat belongs to strategy exhaustion unless
separate public interactional trouble exists. Positive basis labels must be
licensed by the supplied public contract, completion/close state, or actionable
debt. A polite permission to ask a result question is not itself low-agency
deferral.

A dedicated targeted-challenge scorer now owns this manifest type. It validates
both blind responses and independent identities before key access and always
emits `pass_fail_gate=not_applicable`; it cannot accidentally route challenge
rows through `ADAPTIVE_WARRANT_DECISION_GATE`. These prospective changes burn
the completed diagnostic relative to the repaired implementation. One clean
diagnostic confirmation precedes the already declared representative 96-case
natural frame, which remains the sole mechanism gate.
