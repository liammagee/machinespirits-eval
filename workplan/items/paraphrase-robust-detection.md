---
id: paraphrase-robust-detection
title: "Paraphrase-robust detection: token-bag state anchors compiled from the ratified schedules (trigger v5)"
status: active
type: experiment
priority: P1
owner: claude
source: manual
created: 2026-08-02
updated: 2026-08-02
verification: "Gate registered before any tuning: v5 must (a) catch at least
  half of the known missed re-phrasings (the escalation dialogues' unheard
  repeat demands and repeat mockery at t6/t8/t10 — the L2 and S-revisit
  misses), (b) hold the w033 bench at >=17/20 classification, and (c) hold
  calm false alarms <=2/dialogue on the standing calm set. Miss any clause =
  v5 rejected, patterns stay, the ladder's classifier rung (stage 3 proper)
  becomes the next candidate."
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
