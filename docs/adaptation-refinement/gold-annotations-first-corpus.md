# Gold Annotations — First Decision-Point Corpus

**Date:** 9 August 2026
**Corpus:** the two July tutor-stub traces replayed by `scripts/derive-adaptive-warrant-shadow.js`:
- Trace 1: `.tutor-stub-traces/2026-07-23T11-36-45-559Z.jsonl` — two sessions (hostile learner; then a cooperative restart).
- Trace 2: `.tutor-stub-traces/2026-07-24T23-19-21-031Z.jsonl` — one 8-turn session, competent learner. Operator character-switch commands precede learner turns 1–3, so tutor selections there are confounded; decisions from turn 4 on are the tutor's own.

**Annotator:** Claude (single annotator, 2026-08-09). These are triangulation labels, not ground truth; disagreement with the shadow is a finding either way.

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

Result: **11/11 agreement with gold** (`--gold docs/adaptation-refinement/gold-decisions.v0.json`). Both disagreement classes closed: the "what are you talking about?" decision is now warranted-and-revised (the learner's own words are the warrant), and the trace-2 plateau turns are aligned holds with their conceptual divergence marked productive.

Two caveats:

1. **The rules were tuned on these eleven decisions.** Agreement shows the representation can express the gold judgments, not that the rules generalize. The next test must be held-out: the missing borderline dialogue (§17 item 3), or fresh sessions annotated before the shadow runs.
2. **Carried signals should expire on revision.** When a session tail leaves the last learner turn uncommitted, the shadow carries the latest committed signal forward; in trace 1 session 2 a carried repair request still warrants revision one turn after the tutor already revised to answer it. Not scored by gold; fix before the held-out run.

## Held-out test (2026-08-10)

**Corpus:** a fresh session generated for this test — automated permission-seeking learner (the stub's `low_agency` profile), marrick world, strict DAG, 8 turns. Trace: `.tutor-stub-traces/heldout-borderline/2026-08-09T14-32-40-999Z.jsonl` (copied to the private archive repo). Every learner turn defers: "May I enter that Verrell's access is shown, but his striking the shillings is not?" — deferential in form, correct in content. Turn 6 merely re-asks to keep an entry it already had; turn 8 is the learner's first unhedged claim.

**Protocol:** gold (`gold-decisions-heldout.v0.json`) was annotated from the transcript before the shadow ran on this trace. Borderline points carry an `uncertain` label — reported, not scored. No warrant rules or thresholds were changed after seeing results; the one post-hoc change was input plumbing (automated sessions log learner text under a different trace event than interactive ones, and the classifier was blind until that second source was added). Both passes are reported.

**Result:** 3/4 scored decisions agree; 3 uncertain reported. Original-gold regression intact (11/11).

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

Re-run on this corpus: **4/4 scored agree** (t2, t3, t6, t8), 3 uncertain reported — the shadow calls all three uncertain points warranted, a defensible stance on turns where annotators split. Original-gold regression stays 11/11.

**This trace is now burned as a held-out corpus.** The label was designed after seeing its failure on this session, so 4/4 here shows the fix expresses the gold, nothing more. True validation needs a fresh session the current rules have never seen — ideally with a second annotator on the gold, since the t3 label already showed transcript-level and record-level readings can split.

## Second-annotator validation (2026-08-10)

**Corpus:** a second fresh permission-seeking session (seed 2, `.tutor-stub-traces/heldout-validation/2026-08-09T14-50-26-266Z.jsonl`, archived). Same shape as the burned trace — all eight learner turns permission-framed, record flat at 4 grounded facts — but harder: no idle re-keep turn, no closing unhedged claim.

**Protocol:** two independent annotations written before the shadow ran. First reader: me, from the transcript plus record growth. Second reader: codex (gpt-5.6) via a neutral prompt containing only the transcript and the bare flat-record fact — no project history, no first-reader labels, no shadow output (prompt archived alongside the trace). Consensus rule fixed in advance: hard agreements score, anything else is uncertain.

**Annotator split — the substantive result.** Codex read sustained deference strictly: yes from turn 3 onward, every reason citing the unchanged trial-book. I was lenient: no at turns 2–3, yes only at turn 6 (echo move), uncertain elsewhere. Hard agreement on exactly one point (turn 6, both yes); one hard split (turn 3: my no against codex's yes). The axis of disagreement is the same one my burned-trace annotation stumbled on — transcript-surface progress against record-level stasis — now shown to divide two independent readers, not just two readings by one.

**Shadow vs consensus:** 1/1 scored (turn 6 agrees); six uncertain reported. Per annotator: the shadow matches codex on 6/6 of its firm labels and me on 2/3 — the current rules sit on the strict record-weighted side of the split. On a genuinely borderline session that is the defensible place to sit, and the uncertainty split is a finding about the decision class, not an instrument failure.

**Policy convergence:** at every warranted point the Phase-3 policy layer recommends challenge-the-resistance with a precise stance ("hand agency back"); codex's free-text remedies — "requiring the learner to enter a warranted fact in their own voice", "participation-focused repair" — independently describe the same catalogue family.

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
