# Adaptive Warrant Baseline — Remaining Next Steps

**Date:** 10 August 2026
**Status:** original sequence complete through its stop rule; n=10 not
launched. Seven authorized all-turn mechanism packets are burned. The seventh
closed runtime validity at 24/24 dialogues and 192/192 parity/delivery, but its
96-case V4 semantic gate failed. The immediate next instrument is an authored
24-case diagnostic challenge. It may guide repair but cannot pass the gate;
only a later fresh representative 96-case natural frame may do that.
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

## Current restart boundary after the second authorized run

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

The second authorized run from
`cf1336f03a46b92080921c4722e964090193646e` confirmed that those corrections
worked: selector and delivery instrumentation no longer failed globally, all
12 observe rows completed, and 152/152 valid decisions had exact structured
parity. It still failed because five of 12 active rows exhausted response
recovery on `public_obligation_unresolved`. The active obligation target could
include incidental text outside the directed request; one criterion form
(`what evidence can put ...`) created false debt; and terminal recovery could
preserve a non-answering uptake while placing its valid deferral after the
authored source, outside the obligation-owned slot.

The new bounded repair:

1. extracts the directed result clause before creating target identity;
2. removes request/rhetorical terms from that identity and recognizes the
   observed `put/place` criterion construction;
3. forces deterministic obligation deferral into uptake before any due source;
4. uses a compact typed target label rather than a verbatim learner-question
   echo; and
5. replaces the duplicate terminal deferral with a declarative continuation
   once uptake has already resolved the obligation.

The focused study/delivery preflight now includes the terminal fallback and
turn-progression suites and passes 160/160. The complete hermetic suite passes
8,427/8,427 root tests and 137/137 tutor-core tests; derivation quality passes
35/35 worlds, prompt/world integrity passes 22/22, and workplan validation
passes 490/490. The next ordered steps are therefore: create and push a clean
commit; generate a new dry-run authorization request from that exact commit;
approve that new digest; rerun all 24 dialogues; freeze a new 96-case packet;
obtain two fresh independent blind annotations; then run the already frozen
consensus/precision/recall and mechanism scorer. No outcome comparison is
licensed unless every execution and mechanism gate passes.

## Current restart boundary after the third authorized run

The clean `b3cb1d19a619557752c063feb3669aa1563f59d9` execution under digest
`eee15ccd11eee4913a24d038c96da86e9e68b79fb458b2aa7b4eb1130239b7a5`
collected 24/24 rows but did not complete the mechanism study. Twenty-two
children were valid, two active children were sealed `evidence_invalid`, and
the 176 valid decisions retained 176/176 exact structured live/replay parity.
Delivery application still had 11 mismatched decisions and 19 issues. This
third run and packet are burned and must not be annotated for passage.

The remaining defects were narrower than the prior execution:

1. a request for the next copyable `WF-11` line was misclassified as a request
   for a newly supplied evidence result, while hyphenated-identifier splitting
   admitted `wf-` and an empty token;
2. a valid public-result deferral automatically reactivated on the next turn,
   even without a learner reminder or target-matching evidence release, so
   stale debt controlled later unrelated turns; and
3. one deterministic recovery path let a writable entry displace the active
   obligation sentence, leaving the deferral after an authored source. The
   final progression audit correctly failed that child.

The corrective sequence is now implementation-only and uses no model calls:

1. classify copyable wording requests separately and normalize identifier
   terms without empty or dangling-hyphen values;
2. keep accountable deferrals nonblocking until a matching public release or
   explicit reminder, with exact live/offline lifecycle parity coverage;
3. give active public debt final ownership of the first fallback sentence,
   ahead of writable-entry substitution and every authored source, and audit
   that actual public boundary rather than an inferred semantic segment;
4. run the focused mechanism, terminal guard-accounting, progression,
   prompt/world, derivation, workplan, and full hermetic suites;
5. commit and push a new clean checkpoint, then generate a new dry
   authorization request from its exact SHA; and
6. stop for approval of the new digest before any fourth model-backed run.

Steps 1–4 are complete at this checkpoint. The exact study preflight passes
163/163 mechanism tests, 35/35 derivation worlds, and 22/22 prompt/world checks;
the full hermetic suite passes 8,430/8,430 root tests and 137/137 tutor-core
tests; both workplan checks pass 490/490 items. Step 5 is the next boundary.

After a fourth run, continue only if all 24 children are valid, all 192 learner-
analysis calls are present, structured parity is exact, and delivery mismatch
is zero. Then—and only then—freeze the 96 observe cases, obtain two fresh
independent annotations, and run the existing consensus/precision/recall and
mechanism scorer. Any failure burns that packet and stops before outcome work.

## Current restart boundary after the fourth authorized run

The clean `f0d67e02bea393cf1b28e74bef4036ffdc88c5f3` execution under digest
`3eaac28e565b5bdcd5db48d1d2a078fffc7395051e52091322e69b3aa8d2dea3`
reached 24/24 valid sealed children, 192/192 learner-analysis calls, and 192/192
exact structured live/replay comparisons. It still stopped before annotation:
six delivery decisions had eight issues and the study status was
`invalid_delivery_application`. This fourth packet is burned.

Five decision failures were bounded audit misses: two incident-record closure
phrases, two exact accountable deferrals whose host sentence average was just
over the plain threshold, and one next-step action whose owned development was
lengthened by a fixed authored clue quotation. One failure was architectural:
a historical `deferred` obligation was correctly nonblocking in the ledger but
was incorrectly included in the inquiry-completion open count, causing a
grounded terminal close to be vetoed as `stage_next_step`.

The next no-model sequence is:

1. count only `open`, `overdue`, and `reactivated` obligation rows as closure
   blockers, retaining `deferred` for event-based bookkeeping;
2. evaluate family realization on its owned response segment and exclude fixed
   authored-source speech before measuring that segment;
3. recognize the exact public-only deferral and the two licensed closure
   surfaces, and shorten the redundant deterministic handoff;
4. run exact saved-surface, lifecycle, study preflight, derivation,
   prompt/world, workplan, and full hermetic checks;
5. commit and push the clean correction, generate a fresh dry authorization
   request from that exact SHA, and stop for the new digest's approval; and
6. run a fresh fifth matrix only after that approval.

Steps 1–4 are complete. The study preflight passes 164/164 mechanism tests,
35/35 derivation worlds, and 22/22 prompt/world checks. The full hermetic suite
passes 8,435/8,435 root tests and 137/137 tutor-core tests. Step 5 is the current
boundary.

After the fifth run, proceed to annotation only if all 24 children are valid,
all 192 analysis calls are present, structured parity remains exact, and
delivery mismatch is zero. Freeze the new 96 observe cases, obtain two fresh
independent annotations, and run the unchanged consensus/precision/recall and
mechanism scorer. Any failed support or mechanism gate burns that corpus and
continues to prohibit outcome comparison.

## Current restart boundary after the fifth authorized run

The clean `a1316a07e91dfa3bc3a1fc8438aaf213953188b2` execution under digest
`fe8ff714aba05d30cc67759abbba78366c7dc76c497981f23ed4d6f1b7cca792`
reached 24/24 sealed children, 192/192 analysis calls, and 192/192 exact
structured parity. Two delivery checks still failed, so the run and its
annotation packet are burned.

The remaining sequence is:

1. retain the two prospective audit corrections: exclude exact authored source
   spans from host-owned realization metrics and recognize only a bounded same-
   sentence record-antecedent `close it` form;
2. freeze the new shared six-dimensional projection in gate V5, input V2, and
   shadow V0.3, with exact live/offline parity regressions;
3. use the V4 corpus/response/scorer protocol to measure conceptual,
   interactional, engagement, pacing, epistemic, and strategy-exhaustion
   interpretation, magnitude, and persistence independently;
4. run focused, lint, world/prompt, workplan, and full hermetic verification;
5. commit and push a clean checkpoint, generate its dry authorization request,
   and execute a sixth 24-dialogue matrix under the standing in-scope
   authorization; and
6. only if execution is fully valid, obtain two isolated annotations of all 96
   observe decisions and run the frozen scorer. Each divergence dimension must
   have sufficient non-aligned support and pass its own accuracy gates.

No downstream outcome or learning comparison is licensed until both delivery
validity and the full typed mechanism gate pass. A zero-support “all aligned”
dimension is an inconclusive instrument result, not a pass.

Steps 1–4 are complete at the prospective sixth-run checkpoint. The final
semantic audit also made accountable `deferred` debt nonblocking in the frozen
handbook and closure-safety scorer, matching the live and replay projectors.
Verification passes 167/167 exact mechanism tests, 35/35 derivation worlds,
22/22 prompt/world checks, 8,444/8,444 root tests, 137/137 tutor-core tests,
and 490/490 workplan validations. Step 5—clean commit, push, dry request, and
standing-authorized execution—is now the active boundary.

## Current restart boundary after the sixth authorized run

The clean `853ad817b224723d69c48c24f58281b79a79f8cb` execution under digest
`bcfdb4383bda20c30a820bbd2ac7c904bb44307cc7e269f1ee71183c71799507`
used 584 calls, reached 22/24 valid children, and preserved 176/176 structured
parity. It failed on two false learner-record obligations and five finite
delivery recognizer misses. The packet is burned.

The remaining sequence is now:

1. retain the prospective non-obligation `learner_record_entry_request` act
   and its shared writable-entry grammar, with the genuine result-request
   negative control;
2. retain exact delivery controls for declarative `record closes` termination
   and named-missing-warrant uptake, including pursuit and unrelated-gap
   negatives;
3. commit and push the fully verified clean checkpoint, generate its digest-
   bound dry request, and run a seventh 24-dialogue matrix under the standing
   in-scope authorization;
4. only if that execution has 24 valid sealed children, 192/192 analysis
   coverage, exact parity, and zero delivery mismatch, freeze all 96 observe
   decisions; and
5. obtain two isolated V4 annotations, then run the frozen scorer. Every one of
   the six divergence dimensions must have non-aligned support and pass its
   interpretation, magnitude, persistence, and joint gates.

The sixth result strengthens only a narrow claim: the shared projector is
replay-deterministic on valid decisions. It does not establish detector
validity, mechanism decision quality, or downstream benefit.

The prospective repair checkpoint passes lint, 35/35 derivation worlds, the
focused mechanism/integrity and response/progression suites, 34/34 prompt/world
boundary tests, 8,444/8,444 hermetic root tests, 137/137 tutor-core tests, and
490/490 source workplan validation. The clean commit is the active boundary.

## Current restart boundary after the seventh V4 scorer

The clean `22142b7b897365695c929dfa1a0e47cb71f27512` execution is fully valid at
the runtime boundary: 24/24 dialogues, 192/192 learner-analysis calls,
192/192 structured live/replay parity, and 192/192 delivery application. The
two authorized independent readers completed the 96-case corpus, but the
frozen semantic gate failed: agreement 0.698, recall 0.567, accuracy 0.731,
transition accuracy 0.545, mechanism exact-consensus rate 0.323, and request/
proposal macro-F1 0.143. Only pacing passed every divergence gate. Missing
obligation-persistence, obligation-resolution, completion, conceptual, and
epistemic support also made a natural-corpus-only validation impossible.

The remaining sequence is now:

1. retain the bounded speech-act and divergence corrections derived from the
   burned-corpus audit, but never report its retrospective replay as passage;
2. use the deterministic keyed batch preparer/assembler for both readers, with
   minimum evidence-note length and auditable canonicalization only;
3. author and locally validate a separate targeted challenge corpus plus
   private diagnostic-coverage plan for the predeclared speech-act,
   obligation-lifecycle, inquiry-completion, and six-axis non-aligned minima;
4. freeze and independently annotate that diagnostic challenge under a new
   exact payload authorization; use it only to probe failures and motivate
   bounded repairs, never to satisfy a gate threshold;
5. after the last repair, generate and freeze the representative natural frame
   already declared in `baseline-comparison-design.md`: all 96 observe
   decisions from a fresh two-world, six-profile, eight-turn matrix, with no
   prediction balancing or post-hoc selection;
6. obtain two independent annotations for that natural corpus and apply the
   unchanged declared thresholds to it alone. Missing rare-state support is an
   inconclusive failure and cannot be filled with challenge cases; and
7. advance to a variance-controlled active-versus-observe outcome study only
   if that representative gate passes. Human learning and causal benefit
   remain a later study.

Steps 1–2 and the diagnostic support validation machinery for steps 3–4 are
now implemented. The next construction task is the actual prospectively
authored challenge cases and their private support mapping, followed by a
clean commit and new authorization request. Current no-model verification passes lint,
35/35 worlds, 22/22 prompt/world checks, the 171-test exact preflight,
8,448/8,448 hermetic root tests, 137/137 tutor-core tests, and 490/490 source
workplan items. The prior 24-call annotation authorization is exhausted and
does not cover those new payloads.

## Current restart boundary after the first targeted-challenge reader attempt

The clean `4b5f321eaaf6343627a760a2d8d329161d1af23f` challenge freeze and digest
`04709440caed8cdb871791b57f808adcd0d698652d25b338e70eff4635eb37c0`
reached the reader boundary but exposed incompatible per-batch and assembled-
V4 envelope instructions. Four genuine Luna calls were used, four authorized
calls were left unused, Reader B was not run, and no private key or score was
read. The freeze is burned.

The remaining sequence is now:

1. commit and push the packet-specific, hash-bound output-schema repair after
   focused and full no-model verification (now green: focused 42/42, root
   8,452/8,452, tutor-core 137/137, lint, and workplan 490/490);
2. create a detached clean worktree at that commit and rebuild the same
   diagnostic design as a new freeze with new sample and packet hashes;
3. inspect the manifest, exact packet schemas, diagnostic-only boundary,
   overlap proof, and bounded call plan before requesting a new authorization;
4. obtain two independent Luna reader files and require both to assemble with
   zero manual edits beyond the two predeclared family canonicalizations;
5. only then read the private diagnostic key and report disagreement and
   field/dimension errors as probes, never as gate passage;
6. apply any bounded detector repair prospectively, which burns that diagnostic
   relative to the repaired code; and
7. freeze and annotate the already declared representative 96-case natural
   frame. Only that frame can own the unchanged pass/fail thresholds.

No downstream outcome run is licensed.

## Current restart boundary after the second targeted-challenge reader attempt

The clean `a903737693182e815c268675c2e669f23a7159bc` freeze fixed the batch/V4
envelope conflict, but all three Reader A batches failed semantic validation:
five resolved obligations retained unresolved source turns, and six positive
warrants used undeclared action-family names. The run stopped at 3/8 model
calls because three Reader A retries plus three Reader B calls would exceed the
ceiling. Reader B was not run, the key stayed closed, and no score was produced.

The next sequence is unchanged in inferential terms but has one additional
instrument prerequisite:

1. verify, commit, and push the exact action-family enum plus explicit
   obligation/source lifecycle constraint;
2. freeze the diagnostic again from that clean commit and inspect the new
   packet/schema hashes and bounded authorization request;
3. collect both readers only if every batch assembles without undeclared
   repair;
4. use the diagnostic score only to probe detectors and motivate prospective
   repair; and
5. reserve pass/fail inference for the later representative 96-case natural
   frame under the already declared thresholds.

No downstream outcome run is licensed.

## Current restart boundary after the completed targeted diagnostic

The clean `8af328eafc9ca7151f6d31ef2ef376af6cb44bb6` freeze completed two
independent 24-case reads in 6/8 calls with zero normalization edits. Raw
warrant agreement was 0.875; the diagnostic showed strong request/proposal,
transition, completion, override, basis, and closure behavior, but exact
obligation persistence was 0/8. It also exposed ambiguity in productive versus
aligned divergence and response-level versus commitment-level revision. The
challenge is diagnostic only and did not pass a gate.

The prospective repair is implemented: retain all unresolved reminder turns;
restrict commitment transition to pedagogical/terminal decision kinds; narrow
low-agency detection so polite question prefaces do not count; clarify
dimension, lifecycle, and basis rules in each reader packet; fail closed on
publicly inconsistent bases; and use the dedicated gate-ineligible challenge
scorer instead of the representative-study scorer.

The remaining sequence is:

1. complete full no-model verification, commit, and push this bounded repair;
2. freeze one final 24-case diagnostic from the clean commit and inspect its
   support, packet, provenance, call-budget, and authorization bindings;
3. collect two independent Luna readers under the standing bounded
   authorization, stopping on any schema or semantic inconsistency;
4. score with the dedicated diagnostic scorer and make another prospective
   repair only if a localized detector or instrument defect remains;
5. after diagnostic stability, generate the predeclared fresh two-world,
   six-profile, 96-observe-decision `natural_prevalence` corpus;
6. obtain two independent labels and apply the unchanged mechanism thresholds
   to that representative corpus alone; and
7. run no downstream outcome comparison unless the representative gate passes.

## Current restart boundary after the candidate-safety diagnostic repair

The clean `7f743988268b7f3baf15c8db249c423a331278a8` diagnostic completed both
independent 24-case Luna reads in 6/8 calls. It achieved 1.000 binary precision,
recall, and accuracy, plus exact request/proposal, persistence, completion, and
candidate-override performance. It remained diagnostic-only and emitted no
pass/fail decision.

One genuine measurement confound remained: the typed
`candidate_safety_override` decision had no corresponding reader basis, so the
scorer mislabeled an incomplete-inquiry veto as `inquiry_completion`. The
prospective instrument now exposes `candidate_safety` separately, tests that
mapping, and states explicitly that a fulfilled request remains `satisfied` at
the next decision rather than resetting to `none`.

The remaining sequence is:

1. verify, commit, and push this narrow vocabulary repair;
2. freeze the same 24-case diagnostic from that clean commit and collect two
   isolated Luna reads under the standing eight-call ceiling;
3. score it only as a diagnostic and permit no further repair unless a new,
   localized detector or instrument defect appears;
4. if stable, generate the predeclared fresh two-world, six-profile,
   96-observe-decision `natural_prevalence` corpus;
5. obtain two independent labels and apply the unchanged mechanism thresholds
   to that representative corpus alone; and
6. run no downstream outcome comparison unless the representative gate passes.

## Current restart boundary after the reader-backed support audit

The clean `6a5074df74bb0e7be6f954f6ab988ad21d64655d` diagnostic completed at the
8/8-call ceiling with two 24-case readers and zero final normalization edits.
Binary warrant, request/proposal, lifecycle, persistence, completion,
candidate-override, and primary-basis metrics were all 1.000 on their
hard-consensus denominators. It remained diagnostic-only.

Its authored support plan did not fully survive independent reading: resolution
support was 4/6, conceptual non-aligned support 0/2, and strategy-exhaustion
support 1/2. The scorer now exposes this as `diagnostic_support` rather than
leaving the shortfall implicit. The prospective challenge adds clear redundant
resolution, conceptual-repair, and defeated-contract cases; packet guidance and
policy metadata now preserve the same layer boundaries.

The remaining sequence is:

1. verify, commit, and push the support-reporting and challenge-clarity repair;
2. freeze and independently annotate the strengthened 24-case diagnostic;
3. require both typed accuracy and every reader-backed diagnostic-support
   minimum, while still emitting no gate result;
4. if supported, freeze the already-predeclared fresh 96-case representative
   natural frame and apply the unchanged gate to it alone; and
5. run no downstream outcome comparison unless that representative gate passes.

## Current restart boundary after the obligation-reader audit

The clean `6706305255e5f71b904b5ed7c16b7001833818a7` diagnostic completed both
24-case readers in 6/8 calls with zero normalization edits. Binary agreement
and accuracy were perfect and every divergence support minimum passed, but the
new reader-backed audit correctly returned `insufficient_support`: result
requests 6/8, exact persistence 3/8, and resolution 5/6.

The remaining disagreement is localized to lifecycle and compound-act reading.
The prospective instrument now states exactly when `open` becomes `overdue`,
preserves overdue on reminder, gives a direct result-request clause precedence,
and makes prior satisfaction explicit in every resolution probe.

The remaining sequence is:

1. verify, commit, and push this bounded annotation-boundary repair;
2. freeze and independently annotate one new 24-case diagnostic;
3. require every reader-backed support minimum and inspect typed accuracy;
4. if supported, freeze the predeclared 96-case representative natural frame
   and apply the unchanged gate to it alone; and
5. run no downstream outcome comparison unless the representative gate passes.
