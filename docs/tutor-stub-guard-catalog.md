# What the tutor-stub guards check, and what each is for

Assessment recorded 2026-07-30, from the gate-3 follow-up experiments. Source
of truth for dispositions: `services/tutorStubGuardDisposition.js` (catalog
version 5). This document is the paper-facing account of what is checked at
the tutor's mouth, why, and what the enforcement itself was measured to cost.
Paper destination: the §6.23 line of `docs/research/paper-full-2.0.md`.

## The delivery pipeline in one paragraph

Every tutor draft passes a row of deterministic audits before delivery. An
audit finding is an *issue*; the disposition catalog says whether an issue is
hard (vetoes the draft), advisory (recorded, never vetoes), or report-only.
When every candidate a turn produces is vetoed, a deterministic fallback
template ships instead. The templates are register-fixed procedural prose
("Keep only what the public evidence already shows"), so a high veto rate has
an audible signature: the dialogue goes liturgical.

## The five families

**1. Evidence safety** — protects the meaning of the measurement.
`leak` (all types): private facts, the concealed answer, future clues, and
unsupported claims must not enter public speech. `dramatic_release.
source_perspective_drift`: a clue keeps its authored source's viewpoint.
A leaked answer voids the dialogue's outcome reading; these are contracts,
correctly binary, and never advisory under any policy.

**2. Clue bookkeeping** — protects the release transaction.
`release_delivery.missing_due_evidence`, `release_delivery.
release_delivery_audit_failed`, `dramatic_release.duplicate_clue_delivery`.
A release only commits when the clue is actually present, once. Contracts;
correctly binary.

**3. Conversation integrity** — protects the learner from a bad partner.
`live_turn_progression_v1` (answer the learner, keep the turn's typed focus,
required handoff question, question ownership); `question_support` (direct
response, no proof-jargon, nothing unanswerable); `response_composition`
(six misread types: a proposed move is not a completed one, a conditional is
not a claim, settled points stay settled); `repetition` (repeated sentence /
response / opening, and `tutor_turn_without_advance` — the novelty channel);
`human_scaffold.redundant_local_requestion`. This family was calibrated
against the failure modes of weaker model stacks that looped and stonewalled.

**4. Closure integrity** — protects the endpoint. `dialogue_closure`: close
explicitly, once, not early, without reopening proof work. Contract; binary.

**5. Costume (dramatic realization)** — verifies the treatment was
administered. `actorial_realization` (selected part, performance tactic),
presentation-mode realization, `live_source_action_alignment_v1`, surface
uptake types, `response_configuration.axis_not_visible`. These measure
whether the experimental variable (the assigned character work) is visible
in the delivered text.

## What enforcement was measured to cost (2026-07-30)

Setting: world-033 (the Alder Row minimal pair), resisting learner, bare
tutor, one dialogue per condition; the baseline is gate-3 dialogue d1
(`exports/tutor-stub-outcome/misconception-gate-3`).

| condition | fallback turns |
|---|---|
| baseline (all guards hard) | 26/40 (65%) |
| style guards advisory (`TUTOR_STUB_STYLE_GUARDS_ADVISORY=1`) | 13/27 (48%) |
| characterful contemporary learner (custom brief) | 9/25 (36%) |
| both | 8/23 (35%) |
| both + advance window 3 | 12/21 (57%) |
| style advisory + advance window 3, stock learner | 10/25 (40%) |

The last two rows say less than they appear to: single dialogues, and the
fallback rate swings hard between same-condition runs (8/23 vs 12/21), so the
per-type failure-mode profile is the stable readout, not the rate. More
telling: in all four follow-up dialogues the novelty channel
(`tutor_turn_without_advance`) fired zero times — every one closed promptly
and no stall formed. The stall regime is a tail event (one dialogue in five
at gate-3), so the consolidation-killer only bites in dialogues already going
badly.

The window itself was therefore verified by exact replay of the recorded
stall (gate-3 d1, 40 turns) through `auditTutorStubAdvanceResponse`: window 1
fires on 20 of 40 shipped turns, isolated dips and deep stall alike; window 3
forgives 9 turns — every isolated dip and the first two turns of each run —
and still fires 11 times, all inside the genuine stall stretches (23, 27–30,
35–40). The mechanism discriminates consolidation from stalling on the real
case. Caveat: the replay scores shipped turns; live, a forgiven draft changes
what follows.

Readings, each visible in the traces:

- Under load — a resisting learner, a long stall — the model often cannot
  satisfy the whole checklist at once, the draft dies, and the template
  ships. The template performs no character, so **enforcing the costume
  produces its absence exactly when character is most needed** (family 5
  enforced as a veto works against its own goal).
- The two levers overlap rather than compound: the characterful learner's
  plain-style objections already demote the costume checklist on the turns
  where she objects, and her varied turns dissolve most stall conditions.
- The ~35% floor belongs to family 3. The residue drafts it vetoes read as
  bounded, consolidating teaching (e.g. "That keeps the sight-glass log from
  proving more than it says…" — vetoed as `tutor_turn_without_advance`,
  replaced by a template). The per-turn novelty check encodes *every turn
  must advance*, but half of good teaching practice deliberately does not
  advance: backtrack, slow down, reinforce and test. A per-turn binary here
  criminalizes consolidation.

## The same measurement at scale (2026-08-05)

The table above is single dialogues. The fallible-learner Phase-B run is the
first large sample: nine conditions, 1,156 tutor turns, one model (codex
gpt-5.6-terra), on the post-fix tree with every guard default unchanged.

| | turns | canned | model as written |
|---|---|---|---|
| false_memory × rowan (bare / contract / empty plan) | 332 | 43% / 43% / 55% | 8% / 25% / 3% |
| low_agency × greyfen | 425 | 69% / 63% / 66% | 1% / 28% / 1% |
| low_agency × rowan | 399 | 74% / 66% / 71% | 0% / 21% / 2% |
| all | 1156 | 62% | 10% |

Pass rate by candidate kind: the model as first written 10% (n=1156), plain
rewrite 20% (997), self-correction 28% (144), composition repair 28% (130),
actorial part repair 71% (62), source voice repair 0% (17). The template
passes 100% by construction, being built from the checks — it is not a
candidate the ladder had and declined.

Findings against the model's first draft, by family: live turn progression
1264, actorial realization 949, dramatic release 516, live source action
alignment 295, repetition 249, response composition 123, closure 62. The three
busiest single checks are `tutor_turn_without_advance` (978 firings across all
attempts), `handoff_loses_turn_focus` (917) and `learner_uptake_not_realized`
(872). Only 297 of 1,041 rejected drafts failed one family alone, so no single
relaxation moves the rate much.

Two things this adds to the 2026-07-30 reading. First, the rate is worse in
harder cells — the bare tutor facing a deferential learner got 0 of 127 turns
through as composed — so the fallback rate tracks dialogue difficulty, and the
number above is this run's, not a constant. Second, it is not equal across
arms: an arm carrying a per-turn contract spoke in its own words 21–28% of the
time against a bare arm's 0–1%. Any comparison between such arms is partly a
comparison between a model tutor and a fixed script, and should say so.

## The design rule this yields

Binary where it is a transaction, graded where it is a judgment. Families 1,
2, 4 stay binary: a 5% chance of leaking the answer is not a small cost, it
voids the measurement. Family 5 should not veto at all — score it and report
treatment fidelity. Family 3 is a quality judgment already computed as a
graded score and compressed to a boolean; the correction is windowed
evidence, not per-turn verdicts. Literal probabilistic acceptance (accept
with probability p) was considered and rejected: it destroys determinism,
which is what makes the outcome channel judge-free and every comparison
clean.

## The regime this licenses (recorded 2026-08-06 — NOT in force until the validity study completes)

Three measurements now sit behind the design rule. The replay
(`scripts/replay-guard-fallback-delivery.js`): of the 717 Phase-B template
turns, 91% had a model draft that clears the catalog's shadow-advisory column,
and none of the deliverable drafts carried an evidence-safety, clue-bookkeeping
or closure finding. The retry analysis: the rewrite clears 70% of the findings
it is named, and still fails 80% of the time on checks it was not named — the
conjunction fails, not the feedback loop. The validity study
(`scripts/guard-validity-study.js`, Sonnet judge, blind single-text scoring
after a pairwise probe showed the template is identifiable side by side):
interim, at 33 of ~150 pairs, the vetoed draft scores 4.15 against the shipped
template's 2.73 overall, and the template has not won a single turn outright.

If the full sample holds that shape, the regime becomes:

1. **Sort every check by what it protects.** The three contract families —
   evidence safety, clue bookkeeping, closure — keep binary vetoes with the
   template as last resort. Every quality judgment (uptake, advance, focus,
   costume, repetition) records and never vetoes. Stalling is the one middle
   case: veto only over a window of consecutive stalled turns.
2. **Ship the model's words; findings ride as data** — five channels replace
   the veto: per-condition fidelity instruments; findings from turn N fed into
   turn N+1's request; windowed tripwires that end-and-exclude a drowning
   dialogue rather than ghost-write it; findings as a preference order among
   the model's own drafts; and template/finding rates stamped on every run for
   analysis-side filtering.
3. **A veto must earn its place.** The replay-plus-blind-scoring loop is cheap
   and repeatable; a family keeps its veto only if what ships in its name
   outscores what it rejects. Re-run it when guards change or the author model
   family changes.
4. **New checks enter report-only** and are promoted to veto only on validity
   evidence. Any promotion or default change bumps the catalog version; runs
   under different catalog versions never pool.

Cards: `guard-policy-default-flip` (the switch, gated on the full study),
`guard-findings-feed-forward`, `tutor-stub-template-rate-audit`,
`phase-b-rerun-under-flipped-policy` (user-gated). Until the flip lands,
every default below stays as it is.

## Knobs (both opt-in, default off, recorded in traces)

- `TUTOR_STUB_STYLE_GUARDS_ADVISORY=1` — actorial part/tactic misses are
  advisory for every draft (`services/tutorStubTutorTurnPipeline.js`); the
  delivery decision records the experiment as its advisory reason.
- `TUTOR_STUB_ADVANCE_WINDOW=k` — `tutor_turn_without_advance` fires only
  when the candidate closes a run of k consecutive below-floor turns
  (`auditTutorStubAdvanceResponse`, `services/tutorStubResponseGuard.js`).
  One consolidating turn is teaching; a run is a stall. A suppressed firing
  is recorded (`windowSuppressed`, `stallRun`, `stallWindow`), so the
  channel keeps measuring even when it does not veto. Default 1 preserves
  per-turn behaviour byte-for-byte for recorded and preregistered runs.

Any change to default dispositions or windows must bump the disposition
catalog version and note trace incomparability, per the header of
`services/tutorStubGuardDisposition.js`.
