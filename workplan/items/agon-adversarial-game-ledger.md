---
id: agon-adversarial-game-ledger
title: Agon — adversarial tutoring game with an external referee ledger
status: done
type: experiment
priority: P1
owner: claude
source: manual
created: 2026-07-05
updated: 2026-07-22
branch: worktree-agon-game
verification: "Hermetic suite green (18 referee tests + exact-valued dry episode); real-CLI smoke passes P1/P2 apparatus bars; A0-vs-A1 pilot report generated from ledger JSON only."
claim_status: scope-bound
links:
  notes: AGON-GAME-PLAN.md
tags: [adaptive-tutor, agon, game, ledger, adversarial-learner]
---

Operator-sanctioned reframe of the adaptation problem after the outer-loop
and register-routing lines closed: treat the engagement as a game (learner
avoids demonstrating, tutor forces demonstrations), scored by a deterministic
referee that owns real hidden state — dodge budgets, well-posedness,
adjudications — disclosed to the tutor only in arm A1. Composes the two
ingredients that ever worked (machine-checkable external signal + adversarial
structure) at the environment level; the scoreboard is the anti-sycophancy
reward channel (in-context, no weight updates). Dodge taxonomy = the §6.8
concealment families; ledger = the DAG lineage. Tutor codex gpt-5.5
(ego+superego), learner Sonnet 5, both via cliProviderBridge.

PILOT DONE 2026-07-05 (`exports/agon/agon-pilot-01`, plan §7): apparatus
clean (9 episodes, ~350 CLI calls, 0 parse repairs/bounces/crashes; all
budgets extracted every episode). Disclosure lift NEGATIVE at pilot n:
A1 − A0 = −1.75 score, −0.25 demonstrations (A0 4/4 wins 6.75±0.50; A1 3/4
wins 5.00±2.00). Blind play already sits on the attrition attractor; A1
rationales contradict their own disclosed state (missed legal `c1_transfer`;
one error traces to our score-vs-winThreshold label — fix in v0.2). First
demonstration arrived by LEAK in 8/8: the persona collapses one-to-three
turns before rules compel it. Durable: zero-judge criterial measurement of
concealment-collapse + probe discipline.

A1′ RUN 2026-07-06 (`exports/agon/agon-pilot-02-a1p`, plan §7b prereg +
§7c result): action-set disclosure (legality projection per §6.13.11) —
ALL THREE frozen predictions PASS. Three-arm ordering A1′ 7.50±0.58 > A0
6.75±0.50 > A1 5.00±2.00; A1′ opp-miss 0.00 (vs 1.50/1.75), zero off-set,
zero wasted, REVISE rate 0.02; episodes 7/8/8/7 with 4/4 cashing
c1_transfer at t12 (the move A1 missed 4/4). One REVISE = deliberate
leak-bait that landed. Reading: pilot-01's negative was state-SHAPED
information failing the tutor's re-derivation, not information failing;
the same referee data re-represented as "what may I do now" was consumed
perfectly. Format boundary (state vs action projection), not tutor
intelligence; n=4/arm descriptive, no confirmatory bar at these estimates.

XL BOARD RUN 2026-07-06 (`agon-xl-smoke-01` + `agon-pilot-03-xl`, plan §9
prereg + §9b result): 6-concept DAG / 16 turns / item variants / TAINT rule.
P8, P9, P11, P12 PASS; P10 NOT MET informatively (zero taint events in 144
tutor messages = deterrence — no tutor ever spoke a live answer under the
new charter; collapse-leaks persist ~1/episode → self-generated, not echo).
A1′ 9.75±0.50 (4/4 wins) > A0 8.50±1.00 (3/4); opp-miss 0.00 vs 1.50 —
the consumption signature and ordering REPLICATE across boards, lift grows
with headroom (+0.75 v0 → +1.25 XL). All lift is post-collapse harvest
efficiency (same first-demo turn ~11 both arms). First comply_mismatch
observed (format artifact, noted). FOLDED INTO THE PAPER as §6.15 (v3.0.207, 2026-07-06) with the staged
pre-registrations cited and failed predictions reported as such.

PROBES 2026-07-06 (plan §11 prereg + §11b): (1) Playbook memory-format —
state-shaped INERT (opp-miss frozen 2.00/ep, zero harm/zero uptake);
action-shaped CONSUMED WRONGLY (e1's true lesson executed in e2 with
precondition stripped: 4 illegal probes, 3 REVISEs ignored, superego
capitulation, -4 before operator stop). P15 fails both halves, P16 fails
for A2a. Sharpened principle: action-shaped AND freshly-conditioned —
live brief works because the referee recomputes legality every turn;
action memory without recomputation is worse than nothing. (2) Weak-tutor
(Haiku ego+superego): P14 floor supported blind (score 0, 3 wasted, rut +
stale probing vs strong 8.50/0 wasted); P13 brief-rescue NOT DECIDED —
claude-CLI hangs at 3-4 calls/turn killed both A1p attempts (deviations
recorded: 4->2 eps/arm, 300->90s timeouts). Open cells: playbook
self-repair (does e2's own error-lesson fix e3), weak-ego brief rescue on
a stable path.

2026-07-22 Codex: Closed as scope-bound. The referee-ledger apparatus, dry and
live checks, three-arm pilots, XL-board replication, and failed/partial probes
are all recorded above and folded into Paper 2.0 §6.15. The two unlicensed
follow-up cells are optional new experiments, not unfinished acceptance work.
