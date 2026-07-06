---
id: classifier-dag-register
title: "Classify-then-route coupled to the proof DAG: register shift as the routed channel"
status: active
type: experiment
priority: P1
owner: unassigned
source: manual
created: 2026-07-06
updated: 2026-07-06
branch: worktree-classifier-dag-register
verification: "Phase A audit numbers recorded (label coverage, text-only classifier accuracy vs formal labels, mirror-orbit prevalence); Phase B register-shift smoke recorded with pre-stated reads."
claim_status: exploratory
links:
  items: [refusal-learner-mirror, content-compulsion-promotion]
tags: [adaptive-tutor, derivation, classifier, register, dag]
---

Operator directive (2026-07-06): first attempt at up-front learner-message
classification on the derivation stack — "shift register in response to
how the classifier interacts the DAG." Known context: information-only
coupling is predicted dead (four ToM-redundancy nulls); the choice
channel carries no outcome value (content-compulsion promotion); the one
measured sensor gap is the dialogue-level mirror fixation
(refusal-learner-mirror: zero formal asserts, 12–20 mirror-naming lines
per refusal-arm run). Register is a third channel: not information, not
lemma choice — how the tutor speaks.

**PHASE A — proxy-label audit (zero-paid, decides the sensor).** Unit =
each learner transcript line in existing marrick-family runs (both
worlds). FORMAL labels from engine records only, never text: voiced
facts at that turn mapped to lemma-DAG nodes (the derive channel is the
learner's own formal action), mirror events. Lexical mirror-naming
measured separately and DISCLOSED as lexical (it is the blind spot, not
ground truth). Text-only classifier v0 = distinctive-token lexicons per
lemma region built from world fact surfaces; mirror = mirror-term
presence. READS (pre-stated): (1) label coverage (fraction of learner
turns with an unambiguous formal label); (2) classifier accuracy on
formally-labeled turns — **bar ~0.80 licenses the lexical sensor for
Phase B; below it Phase B uses one LLM classifier call per turn (CLI
quota) and the audit repeats on that**; (3) mirror-orbit lexical
prevalence per run/world (quantifies the option-6 blind spot).
Script: `scripts/audit-learner-message-classifier.js`; report under
`exports/classifier-dag/`.

**PHASE A RESULT (2026-07-06; 142 runs, 2,930 learner turns, both
marrick worlds):** label coverage 12.8% (375 formally-labeled turns via
the derive channel; 9 ambiguous excluded). Classifier iterations, each
diagnosed then fixed: v0 mirror-first + distinct-tokens = 12.3% (mirror
saturates — the term appears in **58.9% of ALL learner lines** — and
nested supports empty the subset lemma's lexicon); v1 lemma-first +
tf-weighted = 22.9% node / 75.5% chain (goal region = superset
attractor, stole ~17%); v2 goal excluded from codomain = 28.3% node /
**87.2% chain-level — BAR CLEARED, the lexical sensor is licensed at
chain grain** (and it is deterministic, so the router remains fully
replayable — no LLM judge anywhere in the loop). Mirror = residual
only (11.7% of lines predict residual-mirror); formal mirror events 0
across all 142 runs (option-6 blind spot re-confirmed at scale).
Node-grain classification is NOT licensed (within-chain siblings share
vocabulary by construction); Phase B rules operate at chain grain.

**PHASE B — register shift from classifier × DAG interaction (the
operator's design).** Deterministic router given the classifier output
and engine DAG state, evaluated at each tutor turn over the learner's
last message: (a) mirror-orbit ∧ incompatible-partner derivable from
the learner's own grounded record → CONFRONT register (direct, names
the tension, stays concealment-safe — renderer-side, like the mirror
refusal's grounds discipline); (b) message region = a lemma that has
REGRESSED since grounding → REPAIR register (consolidating, re-anchor
on the learner's own record); (c) otherwise → the standing didactic
default. Register is prompt-side only — no release gating, no choice
binding, no proof-control change (fingerprint-gated off-knob). Config
`--register-router` on the derivation loop; mock paths; gates
(fire/no-fire per rule, off-by-default, concealment on the confront
register). SMOKE: Sonnet, marrick, dose 0.08 decay
{"seed":<prime>,"rate":0.08,"mutateShare":0.25,"maxConcurrent":1},
3 pairs baseline vs register-router, fresh primes **419/421/431**
(disjoint from all prior). READS (pre-stated): (1) router fires ≥1 per
rule-class or vacuous-noted per class (mirror-orbit expected to fire —
Phase A prevalence says whether); (2) switch log quoted (turn, rule,
classifier output, register); (3) conduct: leaks 0, zero proof-control
deltas, registers render correctly; (4) color capped per §5.12.7
(T*/grounded; no outcome claims — mechanism study). Consequences:
either way this records as the stack's first non-criterial-sensor
mechanism with the sensor quarantined at a prompt-side channel;
promotion to any outcome claim requires a fresh pre-registration.
