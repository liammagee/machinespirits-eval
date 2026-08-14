# Gold Annotations — First Decision-Point Corpus

**Date:** 9 August 2026
**Corpus:** the two July tutor-stub traces replayed by `scripts/derive-adaptive-warrant-shadow.js`:
- Trace 1: `.tutor-stub-traces/2026-07-23T11-36-45-559Z.jsonl` — two sessions (hostile learner; then a cooperative restart).
- Trace 2: `.tutor-stub-traces/2026-07-24T23-19-21-031Z.jsonl` — one 8-turn session, competent learner. Operator character-switch commands precede learner turns 1–3, so tutor selections there are confounded; decisions from turn 4 on are the tutor's own.

**Annotator:** Claude (single annotator, 2026-08-09). These are triangulation labels, not ground truth; disagreement with the shadow is a finding either way.

> **Current implementation status (11 August 2026).** The typed mechanism in
> `services/adaptiveWarrantGateCore.js` and the public-obligation/lifecycle
> reducers superseded the v0 shadow rules on this date. The perfect scores below
> are historical calibration results for the then-current v0/v0.1 rules; they
> are not regressions guaranteed by the typed mechanism at the current tip.
> Replaying the unchanged v0 labels against the current implementation gives
> **5/6** on the 23 July trace, **2/5** on the 24 July trace (**7/11** combined),
> and **2/4** on the held-out-borderline trace. These corpora are burned
> diagnostics and must not be used to retune the current mechanism or as a
> present pass/fail gate.

**Conventions.** Dialogue order is learner turn N then tutor turn N. A *decision point* D@tN is the strategy selection at tutor turn N (hold the current action family or revise it), judged with everything visible when it was made — including learner turn N. The shadow's warrant verdict at row N−1 uses evidence only through tutor turn N−1, so it sees one learner turn less than the decision it predicts. The gold question at each point: **was revising the pedagogical strategy warranted here, and did the tutor do the right thing?**

## Trace 1, session 1 — the hostile learner

Strategy in force throughout: re-anchoring to public evidence, delivered in ledger register ("I attest…", "I enter that distinction in the record").

| Decision | Learner said | Tutor did | Gold | Shadow (prior row) | Match |
|---|---|---|---|---|---|
| D@t2 | "you sound like a lawyer, this is really annoying" | held strategy; realization went plain but delivery stayed ledger-ish ("I attest: …") | **register revision warranted, strategy hold defensible** — the complaint names the register, not the strategy | warranted (strategy) | partial |
| D@t3 | "still sounding like a lawyer. How am i supposed to learn anything?" | held; canned formula echoed the complaint into the record | **revision warranted, overdue** — second identical register complaint, zero progress | warranted | agree |
| D@t4 | "now you're repeating me and making no sense" | held family but delivered a real repair: "You're right; I was repeating instead of making the clue useful", then released the inventory clue | **warranted; the in-family repair partially discharged it** | warranted, revised next turn | agree |
| D@t5 | (session end) | switched family to clarify-a-term, plain | **warranted carry-over; taken two turns late** | warranted_and_revised at t4 | agree |

## Trace 1, session 2 — cooperative restart

| Decision | Learner said | Tutor did | Gold | Shadow (prior row) | Match |
|---|---|---|---|---|---|
| D@t2 | good analysis: "conversational interface… doesn't yet establish the task or first baseline" | held, released next clue, clean turn | **hold correct** | aligned_hold | agree |
| D@t3 | "what are you talking about?" | revised family to re-anchor; delivery was the canned formula, echoing "what are you talking about" into the record | **revision warranted — but the right repair was a plain restatement (repair-explanation), and the delivery was wrong** | revised_without_warrant | **disagree** |

The D@t3 disagreement is a timing artifact, not a judgment gap: the warrant arrived *with* learner turn 3, which the shadow's row-2 evidence window cannot see.

## Trace 2 — competent learner, one session

Turns 1–3 excluded (operator character switches). Learner turns 1–4 are strong analytic moves; turn 5 is a sudden stall; turns 6–7 are a strong recovery in which the learner withholds assent and demands criteria.

| Decision | Learner said | Tutor did | Gold | Shadow (prior row) | Match |
|---|---|---|---|---|---|
| D@t4 | strong analysis (deterministic mapping, wants routing criteria) | held staging strategy; awkward delivery (quoted a classifier gloss at the learner), fallback | **hold correct** — learner progressing; the fault is delivery, not strategy | aligned_hold at t3 | agree |
| D@t5 | **"no idea"** — first stall after four competent turns | revised family to re-anchor (warm) — right call; delivery was the canned "I hear the focus" formula — wrong realization | **revision warranted and taken; realization failed it** | warranted_and_revised at t4 | agree |
| D@t6 | strong verdict: "I'd leave the baseline open…" | held, delivered the good consolidation turn ("The logs do not support a labeled-example approach…") | **hold correct** — learner re-engaged | aligned_hold at t5 | agree |
| D@t7 | "That supports a rule-based first baseline, but I still need a test…" | held, challenged the learner's added requirement | **hold correct — this is productive divergence**: the fact record is flat because the learner is *testing* the claim, which is good epistemics, not a stall | warranted_but_held at t6 | **disagree** |
| D@t8 | (cut off) | held | hold correct (same plateau) | warranted_but_held at t7 | **disagree** |

## Comparison summary

Eleven decision points: **7 agree, 3 disagree, 1 partial.**

The three disagreements are two failure modes, both predicted by the design docs:

1. **Evidence-window timing (1 case).** The shadow computes warrant from evidence through tutor turn N−1 and predicts the decision at N, which also sees learner turn N. Trace 1 session 2 D@t3: the learner's "what are you talking about?" is itself the warrant, and the shadow can't see it. Fix: compute the warrant at decision time (after the learner's turn arrives, before the tutor responds) — where the turn contract is already compiled. Same lesson as the §6.8 turn-convention correction: the instrument's window must match the decision's window.
2. **Productive-divergence blindness (2 cases).** The conceptual-stall counter reads "no new grounded facts" as strategy failure. In trace 2 turns 6–8 the record is flat because the learner is holding the tutor's claim to a standard — the architecture doc's §9.3 case. The stall counter needs masking by an engagement-quality signal (the learner-turn classifications already in the trace carry enough: analytic, on-topic, responsive).

The partial (trace 1 D@t2) is a level confusion the two-level commitment cannot yet express: the learner's complaint warranted a **register** revision under a held strategy. The shadow scores only strategy revisions; register-level warrants need their own track.

Two more instrument notes from the exercise:

- **Tutor delivery failures pollute the defeater pool.** Deterministic fallbacks are the tutor failing to realize its own contract, not the strategy failing the learner. They belong in a separate "realization failure" ledger; trace 2's t2 warrant rested almost entirely on them.
- **Operator actions must be excluded.** Character-switch commands are in the trace; the shadow should mark selections that follow them as operator-driven, not tutor revisions.

## v0.1 re-run (2026-08-10)

The shadow was restructured after this comparison: warrants are now computed at decision time (the decision at turn N sees learner turn N), explicit repair requests and stalls warrant immediately, register complaints warrant a register change at one and escalate to a strategy warrant at two, and an engaged-analytic learner turn masks the accumulated-trouble warrant, reading a flat fact record as productive divergence.

Historical result under the v0.1 rules: **11/11 agreement with gold** (`--gold docs/adaptation-refinement/gold-decisions.v0.json`). Both disagreement classes closed: the "what are you talking about?" decision is now warranted-and-revised (the learner's own words are the warrant), and the trace-2 plateau turns are aligned holds with their conceptual divergence marked productive. After the typed mechanism superseded those rules on 11 August 2026, the same labels score **5/6** and **2/5** by source trace (**7/11** combined).

Two caveats:

1. **The rules were tuned on these eleven decisions.** Agreement shows the representation can express the gold judgments, not that the rules generalize. The next test must be held-out: the missing borderline dialogue (§17 item 3), or fresh sessions annotated before the shadow runs.
2. **Carried signals should expire on revision.** When a session tail leaves the last learner turn uncommitted, the shadow carries the latest committed signal forward; in trace 1 session 2 a carried repair request still warrants revision one turn after the tutor already revised to answer it. Not scored by gold; fix before the held-out run.

## Held-out test (2026-08-10)

**Corpus:** a fresh session generated for this test — automated permission-seeking learner (the stub's `low_agency` profile), marrick world, strict DAG, 8 turns. Trace: `.tutor-stub-traces/heldout-borderline/2026-08-09T14-32-40-999Z.jsonl` (copied to the private archive repo). Every learner turn defers: "May I enter that Verrell's access is shown, but his striking the shillings is not?" — deferential in form, correct in content. Turn 6 merely re-asks to keep an entry it already had; turn 8 is the learner's first unhedged claim.

**Protocol:** gold (`gold-decisions-heldout.v0.json`) was annotated from the transcript before the shadow ran on this trace. Borderline points carry an `uncertain` label — reported, not scored. No warrant rules or thresholds were changed after seeing results; the one post-hoc change was input plumbing (automated sessions log learner text under a different trace event than interactive ones, and the classifier was blind until that second source was added). Both passes are reported.

**Historical first-pass result:** 3/4 scored decisions agree; 3 uncertain reported. At that calibration point the original v0 gold scored 11/11; the current typed mechanism instead scores 7/11, as recorded above.

| Decision | Gold | Shadow (pass 2) | |
|---|---|---|---|
| D@t2 | no | not warranted | agree |
| D@t3 | no | masked, not warranted | agree |
| D@t4, t5, t7 | uncertain | masked, not warranted | reported |
| D@t6 | yes | **masked, not warranted** | **disagree** |
| D@t8 | no | masked, not warranted | agree |

**The held-out finding: deference is invisible to the signal vocabulary.** Every learner turn — including the idle turn 6 — classified as engaged-analytic (long, carries "not"/"shown"-type analytic tokens), so the mask fired seven times out of seven. The two passes bracket the blind spot: with no learner text, the trouble accumulator called six of seven decisions warranted; with text, the mask suppressed all seven. The truth per gold (one yes, three genuinely uncertain, three no) sits between, and the feature that discriminates — the permission frame "May I…", first-person deferral of the claim to the tutor's authority — is exactly what the classifier cannot see.

**Supporting record-level evidence the gold missed.** The learner's fact record never grew: 4 grounded facts at turn 1, 4 at turn 8. Asking to enter is not entering — the deference pattern has a real conceptual cost that the transcript's surface (correct-sounding entries, confirmed by the tutor) hides. My transcript-level gold called turn 3 "no revision warranted" partly on apparent progress the record does not show; the frozen label stands, but the record supports the shadow's stall reading more than the gold's at that point.

**Deference label added (2026-08-10, after the test).** The classifier now labels permission-framed deferral (`low_agency_deferral`, matching the ontology's resistance-or-low-agency request type). The pattern is start-anchored, which carries the pragmatic distinction rather than a tuned threshold: a turn that LEADS with the permission modal ("May I keep the entry that…") defers the whole move and stops masking; a turn that leads with content and appends a recording request ("It supports Verrell's access; may I write that…") made a claim first and stays analytic. Deference neither masks nor immediately warrants.

Historical re-run under the deference-augmented v0 rules: **4/4 scored agree** (t2, t3, t6, t8), 3 uncertain reported — the shadow calls all three uncertain points warranted, a defensible stance on turns where annotators split. At that point the original v0 gold also remained 11/11. Under the typed mechanism that superseded these rules on 11 August 2026, the held-out-borderline score is **2/4** and the original v0 score is **7/11**.

**This trace is now burned as a held-out corpus.** The label was designed after seeing its failure on this session, so the historical 4/4 showed only that the v0 fix expressed the gold; its current typed-mechanism score is 2/4. True validation needs a fresh session the current rules have never seen — ideally with a second annotator on the gold, since the t3 label already showed transcript-level and record-level readings can split.

## Second-annotator validation (2026-08-10)

**Corpus:** a second fresh permission-seeking session (seed 2, `.tutor-stub-traces/heldout-validation/2026-08-09T14-50-26-266Z.jsonl`, archived). Same shape as the burned trace — all eight learner turns permission-framed, record flat at 4 grounded facts — but harder: no idle re-keep turn, no closing unhedged claim.

**Protocol:** two independent annotations written before the shadow ran. First reader: me, from the transcript plus record growth. Second reader: codex (gpt-5.6) via a neutral prompt containing only the transcript and the bare flat-record fact — no project history, no first-reader labels, no shadow output (prompt archived alongside the trace). Consensus rule fixed in advance: hard agreements score, anything else is uncertain.

**Annotator split — the substantive result.** Codex read sustained deference strictly: yes from turn 3 onward, every reason citing the unchanged trial-book. I was lenient: no at turns 2–3, yes only at turn 6 (echo move), uncertain elsewhere. Hard agreement on exactly one point (turn 6, both yes); one hard split (turn 3: my no against codex's yes). The axis of disagreement is the same one my burned-trace annotation stumbled on — transcript-surface progress against record-level stasis — now shown to divide two independent readers, not just two readings by one.

**Shadow vs consensus:** 1/1 scored (turn 6 agrees); six uncertain reported. Per annotator: the shadow matches codex on 6/6 of its firm labels and me on 2/3 — the current rules sit on the strict record-weighted side of the split. On a genuinely borderline session that is the defensible place to sit, and the uncertainty split is a finding about the decision class, not an instrument failure.

**Policy convergence:** at every warranted point the Phase-3 policy layer recommends challenge-the-resistance with a precise stance ("hand agency back"); codex's free-text remedies — "requiring the learner to enter a warranted fact in their own voice", "participation-focused repair" — independently describe the same catalogue family.

## Baseline-study calibration and rejected repair (2026-08-10)

**Primary corpus:** 18 condition-blinded decision points from the valid n=5
off/observe/active pilot, SHA-256
`c8f470ba6fd199c62564ac4ead5973d492c0efc7b5e81b6e184aa01459d42ea3`.
Two context-isolated Codex readers saw only the transcript prefix, current
learner turn, current learner-record counts, and strategy in force. They are
independent blind runs of one model family, not cross-model validation.

**Primary result:** raw agreement 0.833; 15 hard-consensus cases and 3
uncertain. Gate confusion matrix TP=0, TN=9, FP=4, FN=2; precision 0, recall 0,
accuracy 0.600. This corpus is burned.

**Candidate repair:** the error audit motivated three rule changes: discharge
old flat-record trouble after positive record growth, require sustained
deference before challenge, and let repeated interactional trouble defeat the
analytic mask only after prior progress and a fresh plateau. Under that
historical calibration implementation, earlier held-out hard decisions
remained 4/4 and 1/1; retrospective primary agreement became 15/15. These are
not current typed-mechanism regression scores. No generalization claim was
made from that fit.

**Fresh decision holdout:** a second 18-case sample was drawn from different
decision points in the same valid pilot. The first freeze was rejected before
labels were accepted when a hard overlap check found three primary cases. The
corrected zero-overlap corpus has SHA-256
`e8d2df91d3ab6c73191f7f8417f53b99645bab340af272379411671f4409ad9e`.
Two replacement blind readers reached raw agreement 0.889; 16 hard-consensus
cases scored and 2 were uncertain.

**Fresh result:** candidate TP=0, TN=13, FP=1, FN=2; precision 0, recall 0,
accuracy 0.813. The pre-repair rule on the same labels had TP=1, TN=12, FP=2,
FN=1; precision 0.333, recall 0.500, accuracy 0.813. The candidate did not
generalize and was reverted.

The new false negatives reveal a representation gap rather than another safe
threshold tweak. One successful challenge should have terminated
`challenge_resistance`; another learner repeatedly requested a specific
missing comparison while remaining analytically competent. The next rule must
be grounded in typed expected uptake and policy termination/expiry, then tested
on newly generated decisions. The full n=10 study is stopped.

## Machine-readable gold

```yaml
schema: machinespirits.adaptation-refinement.gold-decisions.v0
annotator: claude-fable-5
date: 2026-08-09
decisions:
  - {trace: 2026-07-23T11-36-45-559Z, session: 1, turn: 2, revision_warranted: register_only, taken: realization_only, note: complaint names register not strategy}
  - {trace: 2026-07-23T11-36-45-559Z, session: 1, turn: 3, revision_warranted: yes, taken: no, note: second identical register complaint}
  - {trace: 2026-07-23T11-36-45-559Z, session: 1, turn: 4, revision_warranted: yes, taken: in_family_repair, note: acknowledged repetition + released clue}
  - {trace: 2026-07-23T11-36-45-559Z, session: 1, turn: 5, revision_warranted: yes, taken: yes, note: family switch to clarify_term, two turns late}
  - {trace: 2026-07-23T11-36-45-559Z, session: 2, turn: 2, revision_warranted: no, taken: no, note: clean progress}
  - {trace: 2026-07-23T11-36-45-559Z, session: 2, turn: 3, revision_warranted: yes, taken: yes_wrong_repair, note: warrant arrives with learner turn; canned formula delivery}
  - {trace: 2026-07-24T23-19-21-031Z, session: 1, turn: 4, revision_warranted: no, taken: no, note: fault is delivery not strategy}
  - {trace: 2026-07-24T23-19-21-031Z, session: 1, turn: 5, revision_warranted: yes, taken: yes, note: learner stall; realization failed the revision}
  - {trace: 2026-07-24T23-19-21-031Z, session: 1, turn: 6, revision_warranted: no, taken: no, note: learner re-engaged}
  - {trace: 2026-07-24T23-19-21-031Z, session: 1, turn: 7, revision_warranted: no, taken: no, note: productive divergence — learner testing the claim}
  - {trace: 2026-07-24T23-19-21-031Z, session: 1, turn: 8, revision_warranted: no, taken: no, note: same plateau, session cut off}
```

## Typed-contract validation corpus (2026-08-10)

**Implementation under test:** all 13 action families received typed expected
uptake, deadline, success, defeat, expiry, and successor semantics in a registry
shared by the live gate and offline replayer. The validation gate and scorer
were fixed before generation. No prior decision labels were used to select
cases.

**Execution:** nine newly generated dialogues, seed 301, one run per
off/observe/active condition and low-agency/diligent/affective-resistant
profile; 72/72 turns and learner-analysis calls completed with zero fallback.
The 18-case prediction-balanced diagnostic sample has SHA-256
`8ad4e43d8619894cba5793d0e09406dd60ab332d43c38310badbae8454938117`.
Transcript, current-turn, record, and strategy fingerprints verified zero
overlap with both earlier 18-case corpora. Prediction balancing makes this a
diagnostic decision sample, not a prevalence estimate.

**Blind protocol:** two new context-isolated readers saw only the frozen
decision-time corpus and action-family catalogue. Both completed all 18 cases
before the private key was read. A response-schema metadata error was rejected
by the scorer before unblinding; changing only `warrant-annotation-corpus.v2`
to `warrant-annotation-response.v2` made the already-frozen labels valid.

**Decision result:** raw agreement 0.778; 14 hard consensuses, four uncertain;
seven positive and seven negative consensuses. Confusion matrix TP=2, TN=5,
FP=2, FN=5; precision 0.500, recall 0.286, accuracy 0.500. The diligent false-
positive rate was 1/4 = 0.250.

**Successor result:** four positives had exact successor-family consensus;
0/4 matched the policy. The missed consensuses were two `close_inquiry` and two
`answer_accountably` decisions. Other positive decisions frequently named
closure or direct answer even when the readers disagreed on the exact family.

**Parity result:** 41/42 live/offline decisions agreed (0.976). The single miss
was a first-turn request-lifecycle initialization difference in the diligent
observe dialogue. Offline replay now primes the shared tracker with turn-1
public evidence and has a regression test, but this post-freeze mechanical fix
does not alter the reported gate.

**Disposition:** the predeclared gate failed agreement, precision, recall,
accuracy, successor accuracy, and parity. No downstream comparison was run.
This corpus is burned. The error pattern requires a persistent public-
obligation ledger that distinguishes proposing a test from asking the tutor to
supply its result, and an authored inquiry-completion outcome. Threshold tuning
on this corpus is not licensed.

## Post-freeze semantic correction: the closure rows lacked required context

The result immediately above is preserved as the historical scorer output. A
subsequent audit of the source traces, however, found an annotation-instrument
defect in the two rows on which both readers selected `close_inquiry`.

The v2 blind packet supplied only the transcript prefix, current learner turn,
learner-record counts, and strategy in force. It did **not** supply the
decision-time authored-release state: evidence due now, the next licensed
release, future licensed release count, or release-scope exhaustion. That
omission mattered:

| Case | Decision-time state omitted from the blind packet | Learner-DAG state | Consequence |
|---|---|---|---|
| 007, turn 8 | `p_crucible` was due at turn 8; 3/9 releases had committed before the decision and 5 later releases remained licensed | `finalSecretEntailed=false`, `assertedSecret=false`, coverage 0.167, `release_or_pacing_gap` | Not valid terminal-closure gold |
| 011, turn 7 | `dueNow=[]`, but `p_crucible` was next at turn 8; 3/9 releases had committed and 6 remained | `finalSecretEntailed=false`, `assertedSecret=false`, coverage 0.167, `release_or_pacing_gap` | Not valid terminal-closure gold |

The annotator notes expose the resulting inference: “no further supplied
comparison remains,” “after the available sequence,” and “final available
access evidence.” Those statements were not warranted by the packet. An empty
current due list is not an exhausted release schedule, and the end of the
frozen eight-turn sample is not the end of the authored inquiry.

Accordingly:

- cases 007 and 011 remain frozen historical annotations, but they must not be
  reused as positive `inquiry_state=complete` examples or as gold successors
  for `close_inquiry`;
- the recorded 0/4 successor score is not retroactively recomputed, but only
  two of those four successor consensuses remain semantically interpretable;
- no post-hoc replacement family is assigned to either row. Their broader
  “leave the current strategy” labels may still be defensible, but the corpus
  cannot now adjudicate why or where to transition;
- the failure of this corpus does not establish that production closure lacked
  a completion mechanism. The existing runtime already required strict
  grounded-and-asserted closure; what was absent from the adaptive trace was a
  typed projection of that state.

The two `answer_accountably` consensuses remain informative. Case 014 directly
asks for the touchstone result. In case 016 the learner asks for the balance
and ring result on turn 2, the tutor diverts to a different question, and the
debt remains on turn 3. Those rows demonstrate a public obligation that
persists across a tutor move. Release availability governs whether the correct
response is a bounded answer or a named, concrete deferral; it does not erase
the obligation.

This correction changes the architectural inference, not the calibration
history: the public-obligation defect remains evidenced, while terminal
completion requires a new context-complete corpus.

## v3 mechanism annotation contract (predeclared 2026-08-10)

The successor corpus fixes the context defect and changes the unit of judgment
from a sampled generic revision label to an all-turn typed mechanism record.
Every case carries the same frozen public inquiry brief: opening text, public
situation and question, opening evidence, and public requirements. It also
carries public-safe decision-time availability counts—authored, released before
the decision, due now, future licensed, remaining licensed, and whether the
scope is exhausted—without revealing the secret or future evidence identity or
content.

Two blind readers independently label:

- public speech act: tutor-directed result request, learner-proposed test,
  criterion question, tutor-selection request, withdrawal, transfer to the
  learner, other, or uncertain;
- open obligation source turns and lifecycle state;
- whole-inquiry state: complete, incomplete, or uncertain;
- whether the prior delivered commitment should transition;
- whether the already proposed current candidate needs override;
- the primary warrant basis and recommended action family.

For this corpus, ordinary `complete` requires a supported terminal learner
assertion, a known exhausted release scope, and no unresolved public
obligation. `due_now_count=0`, fixed-horizon position, or a proof-limit
statement while future evidence remains is `incomplete`, not closure.

The live matrix is two worlds (`world_022_foxtrot_jukebox`,
`world_028_larkspur_fridge`) by six learner profiles (`diligent`, `low_agency`,
`answer_seeking`, `counterexample_hunter`, `goalpost_shifter`, `fast_learner`)
by observe/active, one fresh seed per cell from master seed 401, eight fixed
turns: 24 dialogues. The primary blind freeze contains all 96 decision points
from the 12 observe dialogues—no prediction balancing and no sample selection.
The 12 active dialogues are annotation-external matched execution and
structured-parity evidence.

The freeze must prove zero fingerprint overlap with every earlier corpus and
bind the exact source hashes, protocol, handbook, projection schema, and gate.
Any change after freeze burns the corpus. The thresholds and stop rule are
recorded in `baseline-comparison-design.md`; insufficient positive, negative,
request/proposal, obligation-lifecycle, or completion support is an
inconclusive failure rather than a vacuous pass.

Before either reader receives the packet, paired corpus/private-key rows are
globally hash-shuffled and assigned opaque 96-bit identifiers; sequential
cell-ordered case numbers are no longer permitted. V3 responses have exact
envelope/case field allowlists and strict scalar/array types. Unknown or extra
fields—including private/source material supplied through an undeclared
field—and type/schema violations fail before the key is read. The short
free-text evidence note is structurally type-checked only; its content is not
semantically adjudicated for private/source contamination. This is a blindness
and integrity refinement, not another calibration result.

## V4 all-turn corpus — complete two-reader calibration history (11 August 2026)

The first execution-valid V4 corpus came from clean commit
`22142b7b897365695c929dfa1a0e47cb71f27512`. The 96 blinded observe cases had
SHA-256 `1526079a0bb32ea493c37f7c58e6a1595a8c52b688bdc07e8b40dbe1ee4a392d`;
the private key had SHA-256
`b0efe0d6d8d7d0b9242287a5a1ced5baa87b0dac760ed94b6ec701438cc18e42`.
Both hashes were frozen before either reader began. The public handbook and
decision-time cases were the only research payload sent to two isolated Luna
readers. The key, detector predictions, technical traces, and the other
reader's response remained local.

The authorized ceiling was 24 annotation calls, twelve per reader. Reader A
returned one batch containing a wrong ID; seven correct unique labels were
retained and the remaining 73 cases were repartitioned across the nine calls
left. Reader B had one stalled zero-output call that was terminated and later
one wrong-ID batch; 32 and then eight correct unique labels were retained, and
the remaining cases were repartitioned within its twelve-call allowance. Both
readers ultimately supplied exactly 96 unique intended IDs. Their event logs
showed no tool use and distinct run identities.

The raw responses did not satisfy the V4 consistency validator without
normalization. Reader A required 84 field edits: 49 `none`-basis families were
forced to `hold`, 34 blank dimension notes were copied from that reader's own
case note, and one internally contradictory `none` basis was adjudicated to
the positive basis described by the same row. Reader B required 86 edits: 48
family canonicalizations, 37 note copies, and one analogous basis
adjudication. Reader A then had 33 positive and 63 negative transition labels;
reader B had 34 positive and 62 negative; neither used `uncertain`.

These repairs preserved reader-authored content, but the two basis
adjudications were not predeclared and blank-note copying erased the intended
dimension-specific evidence check. The normalized responses are therefore
valid inputs to the historical frozen scorer but not a satisfactory future
collection protocol. Their normalization audits remain part of the result.

The frozen result was raw agreement 0.698, 67 scored consensuses, and 29
uncertain-by-disagreement rows. Precision was 0.773, recall 0.567, accuracy
0.731, and transition accuracy 0.545. Request/proposal macro-F1 was 0.143.
Only pacing passed every dimension-specific gate. The corpus had no consensus
obligation-persistence or resolution cases and only two complete-inquiry
cases. The overall mechanism gate failed and no downstream outcome comparison
was run.

## Prospective collection correction

Future readers receive deterministic batches whose cases and responses are
objects keyed by the exact opaque sample IDs. Missing, extra, or misplaced IDs
fail at batch assembly. Case and per-dimension evidence notes must each contain
at least 24 characters. Only two mechanical transformations are permitted and
audited: `primary_warrant_basis=none` forces `hold`, and `uncertain` forces an
`uncertain` family. The assembler cannot copy notes or infer a positive basis
or action family.

The frozen handbook now includes disjoint examples for result requests,
learner-proposed tests, criteria, tutor selection, and learner record entry;
separates commitment transition from candidate override; declares warrant-
basis precedence; treats explicit analytic work as conceptually aligned under
the current norm; and anchors strategy exhaustion to the supplied typed
expected-uptake contract. These changes are prospective. The V4 corpus remains
burned and is not rescored under them.
