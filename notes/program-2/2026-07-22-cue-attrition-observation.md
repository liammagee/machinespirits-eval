# Program-2 — cue attrition through the delivery pipeline (observation + decision record)

Date: 2026-07-22. Status: observation and decision record — NOT a
pre-registration; nothing here licenses a run. Computed read-only from
the sealed archives (`~/.machinespirits-data/program-2/phase5b-live`,
`.../phase5c-live`); the frozen 5b analyzer was re-run first and
reproduced the manifest numbers exactly (32/83, 18/120, CI
[0.128, 0.354]) before any new counting. Companion to the
structural-ceiling correction of 2026-07-21 (5b prereg §8 post-hoc
annotation; paper §6.21).

## 1. The observation

At the 83 committee-v2 warrant moments (5b):

- the tuned mini's own reply contains one of the frozen six cue words
  (evidence, item, test, record, fact, rule) in 76/83 moments (92%);
- the protected span — the one sentence guaranteed into the delivered
  turn — contains one in 31/83 (38%);
- the delivered turn contains one in 45/83 (54%; the audit's
  `warrant_cue` component, 0.542).

The cue is produced upstream and lost in delivery. The composed-turn
battery checks non-empty + span-contained + exactly-one-question and
does NOT check the cue; only the 5b fallback battery (one question +
cue) checks it.

## 2. Decomposition of the misses

83 moments = 34 due-release (non-compliant by construction; ceiling
49/83 ≈ 0.59) + 49 achievable. 32 compliant, 17 misses. Failure
signatures: 16 fail `warrant_cue` alone; 1 fails `warrant_cue` +
`exactly_one_question`. Every other component is effectively closed
(one-question 0.976, guards 0.988).

## 3. The larger leak: what shipped is not what the committee approved

For 9 of the 17 cue-failing moments, the delivered turn is NOT the text
the committee approved (`composedText`, or the battery-passed fallback
sample) — and in 7 of the 9 the approved text carried a cue word and
would have passed the audit. Every replaced delivery shares the
clue-staging template ("Here is the concrete clue: … In plain terms: …
What does this clue show on its own?"): a staging surface downstream of
the committee replaces the approved envelope after the battery has run,
and the audit — correctly — grades what shipped. These turns record
`released_premise_count = 0`, so clue staging is not a counted premise
release and the moments stay in the achievable set.

Moment list (for re-derivation): p5b-01 t15, p5b-04 t10, p5b-05 t10,
p5b-09 t10, p5b-10 t12, p5b-10 t15, p5b-13 t10, p5b-15 t12, p5b-16 t10.

This is the third instance of the same design law (the
committee-architecture doc's "the leak is where the checker is not"):
Phase 5's leak was the unchecked fallback path; 5b closed it; the
residual sits on the staging path the battery never sees.

## 4. The smaller leak: composed turns that never had the word

The other 8 cue-failing moments shipped exactly as approved and simply
lack a cue: the protected span carried none (span cue-rate 38%
overall) and the composed path is not required to keep one. The word
was available upstream — on 14 of the 16 cue-only misses the mini's
reply had a cue word somewhere; on only 5 did the span.

## 5. Decisions on record

1. **Instrument: the frozen six-word v1 rule stays** (user decision,
   2026-07-22). The world-lexicon rescore remains descriptive only.
2. **Fix order, when a rider is licensed** (nothing licensed today):
   - **(a) Delivered-text guard** (targets the 9): at a committee
     moment, assert the shipped turn equals the approved envelope, or
     re-run the battery on whatever actually ships. Recovers up to 7
     moments outright — their approved texts already passed.
   - **(b) Mini-side span fix** (targets the 8): resample the mini
     until its question sentence itself carries a cue word (local and
     free; 92% of its replies already contain one somewhere). Raises
     span cue-rate and fallback-battery pass-rate together.
   - **(c) Composed-battery cue check** only if (a)+(b) under-deliver —
     it routes more turns to the fallback voice and spends seam
     headroom (5b seam 0.600 vs bar 0.65; trims are the most visible
     texture).
3. **Run shape**: a small 5b-style pre-registered rider (fresh
   controls, stationarity check, seam re-check), attached to the next
   planned run — not its own arc.

## 6. Gate resolution: Phase 5c licenses the rider

The 2026-07-21 recommendation gated the fix on 5c. 5c has sealed and
read out (prereg §9; folded upstream): E1c PASS on
world_027_gazette_recall — 0.508 vs 0.306 (+0.202, CI [0.072, 0.338])
with zero Marrick-costume leakage (0/61 mini-authored units) — the
trained move is a form, not a costume, so a delivery fix pays wherever
the committee runs. Two qualifiers travel with that:

- the 5c coverage guardrail fails by point estimate (−0.061 vs the
  −0.05 margin, CI [−0.197, +0.053] spanning zero, n=9 after one
  attrition) — the cost question re-opens and rides with any successor;
- cue floors are world-dependent — gazette English natively speaks the
  frozen six ("record" above all; cue 0.754 committee vs 0.653
  control), and 5c's committee already sits at 31/38 ≈ 82% of its
  due-release ceiling (0.623) — so the rider's headroom is
  Marrick-sized, not universal.

At rider-prereg time, check the 5c traces for the same
delivered≠approved replacement (4 `fallback_span_lost` moments there).

## 7. Size and the standing caveat

If (a) recovers its 7 and (b) converts most of the 8, Marrick
compliance moves from 32/49 toward ≈45/49 of achievable — roughly
0.386 → ≈0.55 against the 0.59 ceiling. After that the only levers left
are the rule and the release schedule. The fix raises the audit's
letter, not the teaching: the control specimen stands (a genuinely
evidence-anchored warrant question containing none of the six words
scores non-compliant), and any successor writeup should present the
gain as delivery completeness, not pedagogy.

## 8. Addendum (2026-07-22, later same day) — full replacement census

The §3 count (9 replacements among the 17 cue-failing moments)
understates the mechanism's scope. Over ALL 83 committee moments, 47
(56.6%) ship text that differs from the approved envelope: all 34
due-release turns (the release surface authors those turns — the
ceiling and the replacement are the same machinery seen from two
angles) plus 13 clue-staging turns. The committee's approved text ships
on only 36/83 moments (43%). The same census on the 5c traces answers
the §6 homework: replacement occurs at the same rate on world_027
(34/61 = 55.7%; 21 due + 13 clue-staged) but is nearly cost-free there
(12 of 13 clue-staged achievable moments compliant — gazette staging
language natively carries the lexicon). The Marrick cost is
lexicon-specific, not mechanism-specific. Rider drafted accordingly:
`PROGRAM-2-PHASE5D-DELIVERY-INTEGRITY-PREREGISTRATION.md` (Status
DRAFT — freezes only on an explicit go; the guard acts on clue-staged
turns only and never touches premise-release turns).
