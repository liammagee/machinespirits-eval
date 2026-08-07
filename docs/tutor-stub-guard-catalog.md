# What the tutor-stub guards check, and what each is for

Assessment recorded 2026-07-30, from the gate-3 follow-up experiments. Source
of truth for dispositions: `services/tutorStubGuardDisposition.js` (catalog
version 6; live default `shadow_advisory` from 2026-08-07 — see "The study
finished, and the default flipped"). This document is the paper-facing account of what is checked at
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

## Every rate needs its policy attached (2026-08-07)

A rate on its own means nothing here. `scripts/census-guard-template-rate.js`
reads any run's traces and reports turns, template rate, model-as-written rate
and pass rate by candidate kind, stamped with two things that decide how to
read them: which counter it used, and which guard policy the run was decided
under. Both come off the traces — the policy from
`attempt.audits.deliveryDecision.boundaryPolicy`, so it is recorded fact, not
inferred.

Run over the 24 runs on this machine carrying traces, the runs sort perfectly
by policy and not at all by tutor:

| policy | runs | turns | template | model as written |
|---|---|---|---|---|
| shadow advisory | 19 | 1711 | 7% | 67% |
| strict | 5 | 1665 | 62% | 9% |

Every shadow run lands at 4–39% template; every strict run at 60–100%. The
spread within each group is small next to the gap between them. Before the
policy was read off the traces this looked like a tutor-family split, because
the shadow runs happen to be the claude-seated ones and the strict runs the
codex-seated ones. It is not a family split.

The catalog stores both the strict and the shadow disposition on every
finding, and the trace keeps them, so each run can be re-scored under the
policy it did not run under, exactly and for free. That has one limit worth
stating: only *first drafts* can be re-scored. A run that shipped at attempt 0
never generated the rewrite a stricter policy would have demanded, so a
counterfactual template rate would be invention. The first-draft pass rate is
recorded for every run under both policies, and it is the measure that holds
the policy fixed:

| tutor | drafts | pass, strict | pass, shadow |
|---|---|---|---|
| claude-opus-5 | 77 | 1% | 73% |
| claude-sonnet-5 | 1640 | 3% | 67% |
| codex gpt-5.6-terra | 1659 | 8% | 61% |

Read across, not down. The policy moves the pass rate by a factor of eight to
seventy; the tutor moves it by a few points. Under strict the codex tutor
passes *more* often than either claude model, which is the opposite of what
the run-level rates suggested.

This does not overturn §6.24's boundary observation that the thresholds are
calibrated on one family's prose. That claim rests on the 2026-07-31
cross-family probe, where sonnet fell back on 20 of 25 turns against codex's
14 of 23 at the same settings, and the direction survives here: under strict,
sonnet drafts are vetoed on 97% of turns and codex drafts on 92%. What changes
is the size. On first drafts at a fixed policy the family gap is a few points,
not the order-of-magnitude gap the unstamped run rates implied. Anything
citing a template rate should name the policy beside it, and two rates under
different policies should never be set against each other.

Two limits on the census itself. The 2026-07-31 probe runs behind the §6.24
sentence are not on this machine — `exports/` is not tracked, so artifacts
differ per checkout — and could not be stamped. And the greenroom run of
2026-07-12 predates the catalog: it counts 314 turns at 6% template and 89%
model-as-written, but its audits are leak checks alone, so the counter stamps
it `pre-catalog` and it belongs in neither group above.

**A correction to the family table above.** The 2026-08-05 counts were built
by walking the audits object by hand and missed three families. Counted with
the project's own issue extractor, Phase B's first drafts also carry 587
`response_configuration` findings — the second-largest source, ahead of
dramatic release — plus 68 `leak` and 20 `release_delivery`. The seven
families already listed are unchanged. The lesson is the same one that caught
an earlier cut of this work: the audits object has a different shape per
guard, so counting its keys measures the shape, not the findings.

**What the guards catch that no policy change touches.** Of first drafts,
12–14% carry a finding in one of the three safety categories — evidence
integrity, clue bookkeeping, closure integrity — and the rate is close across
tutors (codex 12%, sonnet 14%, opus 5% on 77 drafts). These stay hard under
the shadow policy as well as the strict one, so they are already inside the
61–73% shadow pass rate and the proposed flip does not reach them. Relaxing
the policy is a decision about the quality families only; roughly one first
draft in eight is stopped for a reason that will keep stopping it.

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

## The study finished, and the default flipped (2026-08-07)

The validity study ran to 108 complete pairs and was stopped there. Each pair
is one vetoed draft and the template that shipped in its place, scored one text
at a time by a Sonnet judge that never saw the other, on uptake, advance and
fit.

| | draft | template | draft wins | ties | template wins |
|---|---|---|---|---|---|
| overall | 4.17 | 2.51 | 91 | 15 | 2 |
| uptake | 4.67 | 2.75 | 87 | 19 | 2 |
| advance | 4.12 | 2.63 | 73 | 31 | 4 |
| fit | 4.57 | 2.44 | 97 | 10 | 1 |

No guard family favours the template: live turn progression 4.40 v 2.73
(n=30), mixed findings 4.08 v 2.00 (n=26), repetition 3.53 v 2.37 (n=19),
actorial realization 4.22 v 2.06 (n=18), dramatic release 4.75 v 4.25 (n=8),
response composition 4.25 v 2.50 (n=4), source alignment 4.67 v 3.67 (n=3).
Dramatic release is the closest, and even there the draft leads.

So the live default is now `shadow_advisory`
(`services/tutorStubTutorTurnPipeline.js`, resolved by the CLI from
`TUTOR_STUB_GUARD_POLICY`); `strict` is the opt-in. Quality findings record and
no longer veto; evidence safety, clue bookkeeping and closure still veto, and
an unrecognised finding still fails closed.
`tests/tutorStubGuardAccounting.test.js` runs one fixture under both policies: the same draft, the same seven findings,
a fixed template under strict and the tutor's own words under the default.

Two things deliberately did **not** change with it.

**The catalog version stays 6.** The version records the rule table. No rule
moved — only which column the runtime reads. Bumping to 7 would say the 19
shadow-policy runs already on disk cannot pool with runs made after the flip,
and they can, exactly: they were decided under the same column by the same
rules. Comparability follows the `boundaryPolicy` stamp each trace already
carries, not the run date.

**The advance window stays 1.** Under shadow, `tutor_turn_without_advance` is
advisory anyway, so windowing it changes the advisory count and nothing about
delivery. It is a measurement question now, and belongs in its own change.

**The library default stays strict.** `decideTutorStubGuardDelivery` still
answers under the strict column when called bare, because the first-draft
campaign machinery in `services/tutorStubJointPerformanceFirstDraft.js` calls
it that way and was calibrated that way. Any new analysis must pass a policy: a
bare call answers a question about the strict column, which is not the regime
live dialogues are decided under.

## Which recorded runs survive the flip, and which do not (2026-08-07)

The flip does not invalidate a run for having a high template rate. It
invalidates a *comparison* whose conclusion depends on who wrote the prose.
Dialogues closed at every template rate on record, including the two runs that
shipped 100% template, so evidence-driven closure — did the learner reach the
world's conclusion, in how many turns, off which clues — is untouched. What
the template ruins is any reading of the tutor's words, and any contrast
between tutor versions that the guards watered down unequally.

**(a) Effectively archived — the finding needs re-running.**

- `fallible-phaseB` (1156 turns, 62% template) and `fallible-phaseA` (423
  turns, 60%). These are the registered contrast between a bare tutor and a
  contract-carrying one. The contract version spoke its own words on 21–28% of
  turns and the bare version on 0–1%, so the two conditions were silenced to
  different degrees by the apparatus rather than by the manipulation. The
  measured difference is not separable from that. Re-running is card
  `phase-b-rerun-under-flipped-policy`, and it is gated on your go-ahead for
  the spend.
- `fallible-phaseB-smoke` (80 turns, 65%). A pilot for the above; it goes
  wherever Phase B goes.
- `figure-fresh` and `figure-probe` (3 turns each, 100% template). Every
  delivered word is a template. Nothing about the tutor is readable in them.

**(b) Sound as they stand, but not comparable across the boundary.**

- The 19 shadow-policy runs (`crossed-k3` 581 turns, `flatpromo-k3` 250,
  `repertoire-k3` 230, `lostretest-k3` 111, `stakecausal` 103,
  `figure-fresh-shadow` 62, and thirteen smaller ones). These already ran under
  the column that is now the default, at 4–39% template. They pool with runs
  made after the flip. They must not be set against Phase A or Phase B — that
  is a 7%-template group against a 62%-template group, and the gap between
  policies is larger than any effect these runs report.
- Phase A and Phase B for anything that does not depend on the tutor's prose:
  closure counts, turns to closure, which clues were released, learner-side
  measures. Those readings stand. Only the tutor-text and between-version
  readings are archived.
- `greenroom-gate1-2026-07-12` (314 turns, 6% template, 89% model as written).
  It predates the catalog and ran leak checks alone, so its low template rate
  is not a shadow-policy rate. Stamped `pre-catalog`; it belongs to neither
  group.
- The 2026-07-31 cross-family probe behind the §6.24 sentence. Its artifacts
  are not on this machine (`exports/` is untracked), so it could not be
  stamped. Its direction survives the census, its magnitude does not — cite it
  for the direction only.

The rule that follows: never put two template rates side by side, and never
pool runs across the `boundaryPolicy` stamp. `scripts/census-guard-template-rate.js`
reads the stamp off any run's traces, so this is a check, not a memory
exercise.

## The regime this licenses (recorded 2026-08-06, in force from 2026-08-07)

Three measurements now sit behind the design rule. The replay
(`scripts/replay-guard-fallback-delivery.js`): of the 717 Phase-B template
turns, 91% had a model draft that clears the catalog's shadow-advisory column,
and none of the deliverable drafts carried an evidence-safety, clue-bookkeeping
or closure finding. The retry analysis: the rewrite clears 70% of the findings
it is named, and still fails 80% of the time on checks it was not named — the
conjunction fails, not the feedback loop. The validity study
(`scripts/guard-validity-study.js`, Sonnet judge, blind single-text scoring
after a pairwise probe showed the template is identifiable side by side): at
108 pairs the vetoed draft scores 4.17 against the shipped template's 2.51, and
the template wins 2 pairs of 108. The section above has the full readout.

The sample held that shape, so the regime is:

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
   evidence. A rule change bumps the catalog version; runs under different
   catalog versions never pool. A change to which column the runtime reads is
   not a rule change — it is stamped per delivery, and runs under different
   stamps never pool either.

Point 1 is now the default and point 4 is the standing rule. Point 2's five
channels are unbuilt except the last, which the census provides. Point 3's loop
ran once, on this flip.

Cards: `guard-policy-default-flip` (done 2026-08-07),
`guard-findings-feed-forward`, `tutor-stub-template-rate-audit`,
`phase-b-rerun-under-flipped-policy` (user-gated).

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
