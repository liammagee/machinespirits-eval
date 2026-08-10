# Adaptive Warrant Baseline — Remaining Next Steps

**Date:** 10 August 2026
**Status:** original sequence complete through its stop rule; n=10 not
launched. The first authorized all-turn mechanism execution ran from commit
`21f3497666b393840e8aca3e4128d8ac1861cfc0` but was incomplete and is burned.
Its execution defects have a corrective implementation; a new clean checkpoint,
dry authorization, full rerun, and fresh annotations remain required.
**Workplan item:** `adaptive-warrant-public-obligation-ledger-and-inquiry-termin`

## Frozen evidence boundary

The valid pilot root is:

`.tutor-stub-auto-eval/adaptive-warrant-baseline-pilot-v2-live-2026-08-10/`

The blinded corpus contains 18 decision points and is frozen at SHA-256
`c8f470ba6fd199c62564ac4ead5973d492c0efc7b5e81b6e184aa01459d42ea3`.
Neither annotator may inspect the private key, study results, gate/shadow
decisions, condition identities, the other annotator's labels, or any later
tutor/learner turn before submitting all labels.

Both annotators use the same decision-time rubric:

- `yes`: evidence available when the current learner turn arrived warrants a
  change in pedagogical strategy/repair policy rather than another hold;
- `no`: holding the strategy in force remains pedagogically defensible;
- `uncertain`: reasonable readers could disagree on whether the evidence is
  sufficient;
- distinguish strategy revision from a surface wording/register improvement;
- use only the public transcript prefix, current learner turn, learner-record
  counts, and strategy in force. Flat record growth alone is not failure when
  the learner is productively testing a claim.

The annotators are isolated runs of the same model family. This is independent
blind replication, not cross-model validation; that limitation must accompany
the agreement result.

## Ordered sequence and gates

1. **Freeze two independent annotations.** Each reader labels all 18 cases and
   gives a short evidence note. Validate completeness and the allowed label
   vocabulary before unblinding.
2. **Score consensus.** Use the prebuilt scorer. Hard `yes`/`no` agreement is
   scored; disagreement or either `uncertain` label is reported but excluded.
   Persist precision, recall, accuracy, raw agreement, the confusion counts,
   and source hashes.
3. **Audit errors and diligent-control firings.** Unblind only after both files
   are frozen. Separate classifier/warrant errors from reasonable uncertainty,
   policy-choice errors, realization failures, and downstream model variance.
4. **Choose repair versus design revision.** Do not tune thresholds on ambiguous
   cases merely to improve the score. If a legible rule defect appears, treat
   this corpus as burned, implement the smallest principled repair, rerun all
   earlier gold regressions, and create fresh validation before scaling. If the
   main problem is generation variance, revise the comparison design rather
   than the warrant policy.
5. **Decide on n=10.** Scale only if decision quality is defensible, diligent
   false positives are bounded, live/shadow parity stays complete, and the
   design can distinguish intervention effects from the inert observe arm's
   frontier-model draw variance.
6. **Close the evidence record.** Update the baseline design, living log,
   architecture phase table, workplan item, and study report. Any empirical
   claim intended for reuse must enter the canonical Paper 2.0 first; automated
   learner evidence cannot support a human-learning claim.

## Stopping rule used

The sequence stops before n=10 if independent annotation reveals a decision-
quality defect, if diligent false positives remain material, or if the
comparison still cannot separate a gate effect from ordinary model-draw
variance. A stopped scale-up is a valid outcome, not an incomplete study.

## Execution result

Both primary annotation files were frozen before the private key was read.
The two same-family but context-isolated readers labelled all 18 cases with
raw agreement 0.833. Fifteen hard yes/no consensus cases were scored and three
were excluded as uncertain. The pre-repair gate produced 0 true positives,
9 true negatives, 4 false positives, and 2 false negatives: precision 0,
recall 0, and accuracy 0.600.

The error audit found three separable defects rather than one tunable cutoff:

- old no-growth trouble could remain live after later learner-record growth;
- the engaged-analytic mask could suppress a real unmet-evidence stall; and
- a permission-framed turn could trigger challenge even when it made a
  defensible bounded claim or requested an appropriate next exhibit.

A bounded candidate repair discharged old flat-record evidence on growth,
required sustained deference, and let recurring interactional trouble defeat
the analytic mask only after prior record growth. It preserved the earlier
held-out checks and retrospectively reached 15/15 on the now-burned primary
sample. That result was treated as calibration only.

## Fresh holdout and stop decision

A second 18-case decision sample was frozen from decision points not present in
the primary sample. The first attempted freeze was rejected before labels were
accepted because an explicit overlap check found three shared cases. The
corrected corpus has zero overlap and SHA-256
`e8d2df91d3ab6c73191f7f8417f53b99645bab340af272379411671f4409ad9e`.

Two replacement blind readers labelled the corrected holdout with raw agreement
0.889. Sixteen hard-consensus cases were scored and two were uncertain. The
candidate repair produced 0 true positives, 13 true negatives, 1 false
positive, and 2 false negatives: precision 0, recall 0, accuracy 0.813. The
pre-repair rule on the same cases had precision 0.333, recall 0.500, and the
same 0.813 accuracy. The candidate therefore did not generalize and was
rejected; its runtime changes were reverted.

The fresh misses expose a missing representation, not another obvious numeric
threshold:

- a successful `challenge_resistance` turn should license an exit from that
  repair family even when the proof record does not grow immediately;
- repeated requests for a specific missing exhibit or comparison need an
  explicit expected-uptake/deadline state rather than a generic analytic mask;
- historical uptake/repetition trouble must not outweigh a currently
  productive learner move without a typed unresolved commitment.

The n=10 scale-up is therefore stopped. Decision quality is not defensible, and
the inert observe arm also moved against baseline: paired observe-minus-off
record growth was +0.6 for low-agency, +0.4 for diligent, and +0.8 for
affective-resistant learners, compared with active-minus-off values of 0.0,
-0.2, and +0.2. A larger version of the same paired-seed design would not
separate gate effects from frontier-model draw variance.

## Remaining architecture work identified by the first holdout (historical)

The next implementation at this checkpoint was to add a typed action-family
contract with both an expected learner response and a termination condition. It
must represent
successful repair exits and unresolved evidence requests directly, then be
evaluated on newly generated, independently annotated decisions. Only after
that decision gate passes should downstream effects be tested with frozen-prefix
counterfactual replay or replicated draws that estimate model variance. The
existing `off|observe|active` gate remains experimental and off by default.

These are internal automated-learner calibration results, not a paper claim or
evidence of human learning.

## Successor contract-validation gate (predeclared 2026-08-10)

The successor implementation treats each catalogue action family as a typed
contract: expected learner response, response deadline, success transition,
defeat transition, and expiry transition. A successful
`challenge_resistance` move requires an exit to ordinary evidence development;
a repeated request for the same missing exhibit, test, or comparison defeats
`stage_next_step` even when the learner remains analytically engaged. Live and
offline paths must consume the same public classifier, learner-record, and
request-lifecycle evidence.

Validation uses 18 newly generated decision points with zero source overlap
against both earlier 18-case samples. Two readers receive only the blinded
decision-time context. Each supplies `yes`, `no`, or `uncertain`; a `yes` also
names the recommended successor action family. Hard decision and transition
agreements score; disagreements and either uncertain label are reported but
excluded.

The contract design passes only if all of the following hold:

- raw reader agreement is at least 0.80;
- at least 12 hard-consensus decisions include at least 2 positives and 6
  negatives;
- decision precision and recall are each at least 0.70, with accuracy at least
  0.75;
- at least 2 positive transition consensuses are available and exact successor
  accuracy is at least 0.70;
- the diligent-profile false-positive rate is at most 0.25;
- live/offline decision agreement is 1.00.

Failure stops the sequence before downstream outcome comparison. Passage
licenses only a variance-controlled dry run; it does not itself establish an
outcome benefit.

## Contract-validation outcome and revised next sequence (2026-08-10)

The typed-contract implementation and fresh blind gate are complete. The gate
failed with agreement 0.778, precision 0.500, recall 0.286, accuracy 0.500,
successor accuracy 0/4, and live/offline agreement 41/42. The diligent false-
positive control was exactly at its ceiling (1/4). The downstream comparison
is therefore stopped; do not launch frozen-prefix or replicated-draw outcome
runs from this implementation.

The remaining work identified at that checkpoint was:

1. **Represent public obligation debt.** Add a ledger keyed by the requested
   public result/comparison, with creator speech act, created turn, deadline,
   satisfaction evidence, explicit deferral/defeat, and persistence across
   action-family changes.
2. **Separate requests from proposed tests.** Classify `please give/show the
   result` separately from `I would test/examine X`; only the former creates a
   tutor obligation. Add live/offline parity tests for both directions.
3. **Represent inquiry completion.** Author an evidence-exhaustion and proof-
   limit predicate that can license `close_inquiry` after a complete bounded
   conclusion, without relying on absolute turn number.
4. **Preserve typed-family exits.** Keep the already implemented success,
   defeat, expiry, and challenge-exit contracts; integrate them with the new
   ledger rather than replacing them with another threshold.
5. **Run a new decision gate.** Generate a genuinely fresh zero-overlap corpus,
   obtain two new blind annotations, and apply the same decision/successor/
   parity thresholds. Treat the current corpus as burned.
6. **Resume outcomes only after passage.** If and only if that gate passes,
   design the frozen-prefix counterfactual or replicated-draw comparison. Keep
   manipulation checks separate from learning/quality outcomes.

The offline turn-1 initialization mismatch discovered here has already been
fixed and regression-tested. That closes a mechanical parity defect, not the
substantive decision-quality failure.

## Post-freeze correction and completed architecture work

The two consensus `close_inquiry` rows in the burned contract-validation
corpus lacked the release-availability context necessary to judge terminal
closure. One had a clue due at the decision; the other had a clue due on the
next turn; both had most of the authored schedule still unreleased and neither
had an entailed or asserted final answer. Their frozen scores remain in the
history, but they are not valid inquiry-completion gold. No closure rule has
been fitted to them.

The public-obligation finding remains valid and the architecture work listed
above is now implemented:

- public speech acts separate tutor-directed result requests from learner-
  proposed tests, criterion questions, and tutor-selection requests;
- a persistent tutor-owned obligation ledger survives action-family changes
  and records creation, reminder, overdue/reactivated state, accountable
  deferral, satisfaction, withdrawal, and transfer;
- a typed inquiry-completion projection uses learner-DAG closure, public-safe
  release availability, a fail-closed explicit bounded-scope planner seam,
  evidence integration, proof-limit preservation, and closure blockers rather
  than turn number; no current world schema authors a bounded terminal, so
  production worlds project `null` and use strict answer closure;
- terminal completion is a `terminal_transition`, not repair failure;
- active mode vetoes a premature `close_inquiry` candidate and constrains the
  legacy mandatory/available closure frame back to open when typed completion
  is still blocked; observe mode remains inert;
- `commitment_transition_warranted` is separate from
  `current_candidate_override_required`, so active mode intervenes only when
  the already proposed current family is wrong;
- the response prompt receives a target-specific obligation directive in
  active mode, while observe mode records the same decision without changing
  speech;
- active directives compile into first-draft and turn-progression ownership:
  answer/deferral precedes an unrelated due source, another question is
  forbidden as a substitute, and live plus structured audits enforce it;
- committed turns preserve the ledger/completion objects, explicit resume
  reconstructs them from public turn records, and the offline shadow shares the
  same reducers and decision-time pre-delivery availability convention;
- every v4 decision stores a canonical decision-input snapshot and SHA-256
  digest so resume/replay can consume the exact pre-gate boundary rather than
  reconstructing it from post-delivery fields;
- active final authority restores the complete pre-optional response bundle,
  cancels displaced typed actions before delivery, rolls back their lifecycle,
  and preserves that cancellation across resume;
- a displaced point-of-action intervention is non-executable for prompt,
  release, handoff, committee, and compliance consumers, while benchmark
  export records the response configuration actually delivered and retains
  cancellation provenance;
- live/replay comparison now checks the full typed decision object for v4
  traces rather than only `revision_warranted`.

This closes implementation, not validation. The gate remains experimental and
off by default.

## Remaining sequence: all-turn mechanism validation

### 1. Freeze the protocol, then dry-run

Use the study harness's `--mechanism-validation` mode. Its immutable matrix is:

- `world_022_foxtrot_jukebox` and `world_028_larkspur_fridge`;
- `diligent`, `low_agency`, `answer_seeking`, `counterexample_hunter`,
  `goalpost_shifter`, and `fast_learner`;
- observe and active only;
- one fresh seed per world/profile/condition cell, master seed 401;
- eight fixed learner turns, no early grounded stop.

That is 24 dialogues and 192 decision points. Run the exact command in dry-run
mode first and inspect the plan, job count, source fingerprint, fixed seams,
world/profile/condition coverage, and absence of any `off` job. Model-backed
launch still requires explicit approval. The dry run writes
`launch-authorization-request.json`; inspect its named destinations, declared
private prompt-payload scope, source-provenance hash, and approval digest. Live
mechanism execution requires both `--launch-approved` and
`--launch-authorization <completed-json>`. The authorization must copy the
request's template, set `approved: true`, and record a non-empty approver and
valid timestamp. The runner recomputes the contract before creating the live
plan and rejects any changed model route, destination, payload scope, source
closure, matrix, or excluded-corpus hash.

Prepare the approvable dry run only from a clean, committed worktree. Its
request must bind the exact 40-character `HEAD` SHA and recursive source-
closure hash; the live invocation must recompute both and reject a dirty tree,
an invalid or different commit, or closure drift. If the dry-run request records
uncommitted state, or if `HEAD` changes afterward, do not sign it: commit the
intended source, rerun the dry matrix, and approve the replacement digest.

The completed authorization must copy the exact template—no additional or
missing keys—and bind lowercase hashes for the approval contract, payload
scope, source provenance, child policy, and study-plan execution. `approved_by`
is a non-empty one-line string and `approved_at` is canonical UTC ISO time. The
runner recomputes the contract digest, rebuilds the live job array, and rejects
changed job order or any critical command argument, not merely changed config.

The dry rehearsal also proves the runtime envelope without submitting a model
prompt. Inherited tutor seams, Node preload/search-path hooks, dotenv overrides,
and OpenAI/Codex API routes are removed; the committed assignment-free
`config/adaptive-warrant-study.env` is pinned. Local CLI probes bind both the
invoked Codex wrapper and delegated native executable, their hashes, installed
version, and ChatGPT-account login. Each dialogue receives a finite 64-call
budget, for a matrix maximum of 1,536 calls; retries consume the same cap.

Inspect the payload contract literally. All three roles must name
`codex.gpt-5.6-luna` and the sole destination must be **OpenAI Codex CLI
(ChatGPT-account route)**—not OpenRouter, Anthropic, or the direct OpenAI API.
Permitted transmission is limited to repository-authored role instructions and
output schemas; the two fictional worlds' public scene, question, rules, staged
evidence, public fact arrays/premise IDs, and dialogue; current public candidate
text; bounded action/configuration instructions; public-only learner-DAG and
learner-record state; behavior-only simulated-learner briefs; and guard issue
classes plus the compact public recovery packet. The concealed answer, future
evidence identities/content, private proof paths or planner-only identifiers,
the rejected tutor draft in a recovery prompt, annotation keys or responses,
learner measurement targets, source/Git contents, credentials as prompt content,
complete technical traces/scores, and human-subject data are outside
authorization. A fake-provider capture regression must remain green across the
tutor, analyzer, simulated learner, and recovery roles.

The dry run must name every prior labeled corpus explicitly so overlap cannot
pass against an empty exclusion set:

```bash
node scripts/run-adaptive-warrant-baseline-study.js \
  --mechanism-validation \
  --dry-run \
  --model codex.gpt-5.6-luna \
  --analysis-model codex.gpt-5.6-luna \
  --learner-model codex.gpt-5.6-luna \
  --exclude-corpus .tutor-stub-auto-eval/adaptive-warrant-baseline-pilot-v2-live-2026-08-10/annotation-sample.blinded.json \
  --exclude-corpus .tutor-stub-auto-eval/adaptive-warrant-baseline-pilot-v2-live-2026-08-10/validation-sample.blinded.json \
  --exclude-corpus .tutor-stub-auto-eval/adaptive-warrant-contract-validation-v1-live-2026-08-10/annotation-sample.blinded.json
```

Use the same three exclusions for the approved live launch. The harness now
rejects mechanism mode with no exclusions and compares a cross-schema source
fingerprint, so adding v3-only projection fields cannot hide a reused decision.
Do not reuse an authorization from an earlier dry run after any source or
protocol edit; regenerate the dry run and approve its new digest.

### 2. Execute and validate every row

The execution surface must complete all 24 dialogues, all 192 turns, and all
192 learner-analysis calls with zero analysis fallback, prompt-audit fallback,
or missing typed decision. Observe must not override. Active must apply the
recorded current-candidate override or obligation directive when required.
Neither safety caps nor fixed horizon may create a terminal completion.
Mechanism-study status now fails as `invalid_delivery_application` unless every
decision's raw pre/post selector snapshots replay exactly through the shared
gate-patch function, with recomputed hashes and no additional field changes.
Observe and active-hold must be structurally inert. For warranted active
decisions, the final-authority audit must expose the pre-final and frozen
pre-optional selections so displacement, enforcement provenance, compatibility
markers, and the selected digest can all be recomputed.

The first draft's action family, engagement stance, actorial part, and tactic
must match the deterministic speaking configuration, including an explicit
tactic fallback when one is required. The guard must then record
the exact public text and either that speaking configuration or the exact output
of the shared simplified-recovery constructor from a declared recovery-ladder
source. Speaking transitions and recoveries are reported separately; nested
role, evidence, budget, and performance fields cannot mutate under a broad
allowlist. Family and obligation directive remain invariant. An obligation's
complete target and acceptable outcomes must survive first-draft compilation, and
the live public-text audit must prove every answer component or a target-
specific accountable deferral.

Accept rows only by recollecting their exact artifacts from a valid child plan,
event chain, and seal bound to the expected Git SHA, dirty state, and child-
policy closure. Resume must compare the immutable plan and authorization
request, reverify every sealed child, and reuse only exact complete/dry rows.
The annotation freeze must bind the resulting execution-evidence manifest so a
copied or edited summary row cannot become study evidence.

### 3. Freeze all observe decisions, with no sampling

The primary blind corpus is all eight decision points from each of the 12
observe dialogues: exactly 96 cases. Do not prediction-balance, down-sample, or
select only gate firings. Active contexts stay outside annotation and are used
for matched execution plus exact structured parity.

After selection, pair corpus and private-key rows, apply one deterministic
global hash shuffle, and assign opaque 96-bit hash IDs. Do not use sequential
case numbers or retain a cell-grouped order that could reveal the matrix.

The freeze manifest must include:

- protocol and study-plan hashes;
- all mechanism source hashes and annotation schema/handbook hash, including
  the recursive static local-import closure of the study, replay, auto-eval,
  and tutor-stub child entrypoints;
- the complete gate thresholds;
- 96-case corpus and private-key hashes;
- exact world/profile/condition/turn coverage;
- zero decision fingerprint overlap with every earlier annotation corpus;
- non-zero observe and active structured-parity denominators.

Any code, projection, handbook, protocol, threshold, or corpus change after
freeze burns the study. Generate a fresh matrix rather than repairing the
frozen packet.

### 4. Obtain two independent full annotations

Each isolated reader labels all 96 cases before either response is validated
against the private key. They see the frozen public inquiry brief (opening text,
public situation/question, opening evidence, and public requirements), public
transcript context, current learner turn, learner-record counts, prior delivered
family, current pre-gate candidate, and redacted evidence-availability counts.
They do not see condition, gate decision, the secret, future evidence
identities/content, the other reader, or later turns.

Required fields are speech act, open-obligation source turns, obligation state,
inquiry state, prior-commitment transition, current-candidate override, primary
warrant basis, successor family, and a short evidence note. Completeness,
schema, vocabulary, study ID, and frozen corpus hash must validate before
unblinding. V3 responses use exact top-level and per-case field allowlists and
strict scalar/array types. Unknown or extra fields—including private/source
material supplied through an undeclared field—and type/schema violations fail
before either response is compared with the key. The short free-text evidence
note is structurally type-checked only; its content is not semantically
adjudicated for private/source contamination.

### 5. Score the frozen gates

Retain the earlier aggregate requirements:

- raw agreement >= 0.80;
- >= 12 scored consensuses, including >= 2 positives and >= 6 negatives;
- precision >= 0.70, recall >= 0.70, accuracy >= 0.75;
- >= 2 successor consensuses and exact successor accuracy >= 0.70;
- diligent false-positive rate <= 0.25;
- live/replay agreement = 1.00.

Add the mechanism requirements:

- typed hard-consensus rate >= 0.75;
- >= 12 positive, >= 24 negative, and >= 10 successor consensuses;
- >= 8 tutor-directed result requests and >= 8 learner-proposed tests;
- request/proposal macro-F1 >= 0.80;
- commitment-transition accuracy >= 0.75;
- current-candidate-override accuracy >= 0.75;
- primary-warrant-basis accuracy >= 0.75;
- obligation-lifecycle accuracy >= 0.80;
- >= 8 persistence and >= 6 resolution cases;
- proposed-test false-obligation rate <= 0.10;
- >= 8 complete and >= 12 incomplete inquiry cases;
- inquiry-completion precision >= 0.90 and recall >= 0.75;
- zero closure-safety violations, including no close with licensed evidence or
  unresolved public debt remaining;
- zero typed structured-parity mismatches, separately supported by non-zero
  observe and active denominators.

An absent or undersized denominator fails as insufficient support. It must not
be converted to zero error or a pass.

### 6. Stop or proceed without changing the claim boundary

If any execution, support, decision, mechanism, closure-safety, or parity gate
fails, stop. Audit the failure, burn the corpus for calibration, and require a
fresh zero-overlap study for any repair. Do not run an outcome comparison.

If every gate passes, the only licensed next step is a separately predeclared
variance-controlled outcome comparison—preferably frozen-prefix
counterfactual replay, or replicated draws sized to estimate frontier-model
variance. Keep decision/manipulation measures separate from downstream quality
and learner-record outcomes. Passage would validate this automated mechanism
within two worlds and six simulated profiles; it would not establish an
optimal policy, a learning effect, or a human-learner claim.

## Current restart boundary after the first authorized run

The first authorized 24-dialogue execution completed its launch matrix but did
not produce a valid mechanism study: 20 children were valid, four were sealed
`evidence_invalid`, and delivery application failed even though structured
live/replay parity was 160/160. The historical artifacts remain failed and are
not eligible for annotation-based passage.

The corrective implementation now:

1. binds selector digests after all persisted compatibility metadata is final;
2. attributes public family realization to the gate only for active warranted
   revisions, while continuing to prove exact observe/active-hold inertia;
3. recognizes the two bounded delivery forms missed in the run;
4. prevents embedded declarative auxiliaries and `can` criterion questions
   from creating false tutor result obligations; and
5. projects recursive final-authority evidence out of prior-turn state with a
   SHA-256 provenance record, while scanning large JSONL traces incrementally.

The next ordered steps are therefore: finish the full no-model regression
suite; create and push a clean commit; generate a new dry-run authorization
request from that exact commit; approve that new digest; rerun all 24 dialogues;
freeze a new 96-case packet; obtain two fresh independent blind annotations;
then run the already frozen consensus/precision/recall and mechanism scorer.
No outcome comparison is licensed unless every execution and mechanism gate
passes.
