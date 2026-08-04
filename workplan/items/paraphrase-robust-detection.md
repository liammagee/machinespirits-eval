---
id: paraphrase-robust-detection
title: "Paraphrase-robust detection: token-bag state anchors compiled from the
  ratified schedules (trigger v5)"
status: done
type: experiment
priority: P1
owner: claude
source: manual
created: 2026-08-02
updated: 2026-08-04
verification: "Gate registered before any tuning: v5 must (a) catch at least
  half of the known missed re-phrasings (the escalation dialogues' unheard
  repeat demands and repeat mockery at t6/t8/t10 — the L2 and S-revisit misses),
  (b) hold the w033 bench at >=17/20 classification, and (c) hold calm false
  alarms <=2/dialogue on the standing calm set. Miss any clause = v5 rejected,
  patterns stay, the ladder's classifier rung (stage 3 proper) becomes the next
  candidate."
claim_status: methods
depends_on:
  - adaptation-plan-3-phase-l
tags:
  - tutor-stub
  - adaptation
  - manner-switch
---

The measured failure (twice decisive): the lexical trigger wears to exact
phrasings — v4 caught the tenant's first ultimatum 21/21 and heard NONE of
her re-phrased second and third demands; her second mockery escaped the
same way. Pattern editions are a treadmill; the palette cannot grow on
them.

The v5 design — deterministic, free, replayable (the trigger's standing
principles): per-state TOKEN BAGS compiled from every ratified realize
text and sample line across both worlds (the schedules are labeled data —
the Phase L asset), classification by content-token overlap against each
state's bag with thresholds calibrated on the recorded corpus, ties
broken by the existing pattern layer (v4 kept as a first pass; bags only
extend recall). Rationale: re-phrasings preserve content words ("send",
"unless", "invoice voice", "kitchen words") while dodging exact patterns;
bags key on what survives paraphrase. Versioned artifact
(config/manner-trigger/v5.json) with the compiler script committed;
offline scorecard extended to include the escalation dialogues as the
held-out paraphrase set.

## Verdict (2026-08-03): v5 passes its letter and fails its purpose — not adopted as robustness

Built and swept. At threshold 5 all three registered clauses pass:
missed re-phrasings 13/13, w033 bench 17/20 (= v4), calm alarms
1.80/dialogue (= v4), quiet wrong-fires 0/6. **But the leave-one-out
check — bags compiled from only the two ratified schedules, tested on
the escalation re-phrasings — scores 0/13.** The bags memorize
authored directive lines; at the calm-safe threshold they generalize
to nothing. The 13/13 is real only because the escalation schedule
fed the compiler.

Disposition: v5 (artifact + compiler + bag support in the classifier,
all committed and versioned) is retained as OPERATIONAL COVERAGE of
the authored schedules — re-runs of the dose ladder and the repeat
demands will now be heard, which unblocks those benches — and is NOT
the paraphrase-robustness answer. Per the card's fail branch, the
ladder's stage-3 classifier (cheap features, trained on one schedule
set, evaluated on a held-out schedule AND world) is the next
candidate, for a fresh session. The leave-one-out protocol used here
is the evaluation standard that candidate must pass.

## Stage-3 result (2026-08-03): the classifier alone TIES; the cascade PASSES the gate

Trainer/evaluator committed (`scripts/train-pressure-classifier-v6.js`):
one-vs-rest logistic over world-neutral cheap features (pattern hits,
closed-class ultimatum/deadline/imperative cues, style counts), trained
on w033's 675 recorded turns only, evaluated leave-one-world-out on
w030's 394 plus the calm set. Alone: 67/162 held-out pressure recall vs
v4's 68 at equal calm alarms (1.80) — a tie; the ladder's stop rule
would apply. **In cascade** (patterns first; classifier only on
pattern-silent turns at threshold 0.7, where its calm alarms are 0.00):
**held-out recall 84/162 vs v4's 68 — sixteen new catches — at
unchanged calm alarms and +4/232 held-out neutral false-fires. Gate 3
met by the cascade configuration.** Next (small, fresh session): ship
the cascade as a versioned artifact (weights + threshold in
config/manner-trigger/v6-cascade.json) with classifier support in the
trigger service, then the live re-runs the dose ladder and repeat
demands have been waiting on.

## Cascade shipped + live re-runs (2026-08-03): 15/15 heard on both benches

The v6 cascade artifact shipped (`config/manner-trigger/v6-cascade.json`;
patterns → schedule bags → stage-3 classifier at 0.7 on silent turns)
and both waiting benches re-ran live under it. Escalation bench
(l2v6-k3): every planted moment heard 15/15, doses stamped 1→2→3 as
authored, ruled tally 12/15 (80%) — see the phase-l card for the wager
result the hearing unlocked. Full-stack bench (fullstack-k3, ratified
schedule): 15/15 pressure plants heard, zero leaks. Detection is no
longer the binding limit on either bench; the l2 wear finding (5/13
uncarded) is repaired in place. Tags archived `exports/l2v6-tags.json`,
`exports/fullstack-tags.json`. Card closes.
