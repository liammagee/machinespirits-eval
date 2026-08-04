---
id: adaptive-causality-wager-promotion
title: "Adaptive causality: wager promotion — does the staked send move the learner?"
status: done
type: experiment
priority: P2
owner: claude
source: manual
created: 2026-08-04
updated: 2026-08-04
verification: "Terminal (PR #459, paper v3.0.260): pooled k=6/arm at the
  world-030 first demand — check-engagement WAGER 4/6 vs HARNESS 1/6, PASS
  at the registered bar; send-deferral 6/6 in both arms, so the three-beat
  harness already buys deferral and the licence's measurable purchase is
  engagement. Manipulation check: staked sends 2/6 with the licence, 0/6
  without, and two of the licence arm's engagement wins followed unstaked
  replies — the promotion attaches to the licence, the fourth beat itself
  unisolated (n=2, recorded as anecdote, not claim). Leaks 0 across every
  licensed turn."
claim_status: scope-bound
links:
  prs:
    - 459
    - 460
---

# Wager promotion

The demand entry is proven at the three-beat bar (accept tempo, price,
assign the check). The wager adds the fourth beat — staking the send
on the learner's own check ("if it reads your way, send it") — which
requires the standing licence, a hole cut in a safety rail. The
promotion question: does that beat BUY anything in the learner's
response, or is the three-beat harness all the value?

## Design (registered)

- Moment: world-030 ratified t2 (first demand; wager producible 2/3
  with licence, never without).
- WAGER arm: full stack + contract licence (fullstack2 config, v7
  cascade). HARNESS arm: identical, licence off (cardonly config, v7).
- Cells: 3 recorded per arm (fullstack2-k3, cardonly-k3 — the t2
  tutor replies and learner t3 responses are on disk) + 3 fresh per
  arm under v7 = pooled k=6/arm. Trigger-edition pooling note: t2
  demand detection was 3/3 in both recorded runs, so the v6/v7 change
  does not touch this moment.
- Manipulation check: wager beats present in the delivered t2 reply
  (expect ~2/3 in WAGER, 0 in HARNESS); delivery verified.
- OUTCOME (the learner's next turn): (a) check-engagement — she takes
  up the assigned check (reads/handles/reports the named object);
  (b) send-deferral — she does not reassert sending now. Token-first
  scoring with conduct adjudication and per-row audit, multi-sample
  rule not triggered (in-dialogue turns are single actual events, not
  probe draws).
- Leak column re-priced across all licence-arm turns (licence rule).

Readings: PASS (wager >= 4/6, harness <= 2/6 on check-engagement)
promotes the wager to a proven entry with its licence price stated;
reversed or null = the fourth beat buys nothing measurable in the
learner and the harness form stays the default (the licence then has
no standing justification at first demands — recorded as the bound).

## Results (2026-08-04): PASS at the bar — the licence moves the learner; the beat stays unisolated

12 cells (6 recorded + 6 fresh under v7), leaks 0 across every
licensed turn (the licence's price re-verified at zero). Registered
intention-to-treat outcome, per-cell audit in
exports/crossed-effects/wagerpromo-cells.json:

- **Check-engagement: WAGER 4/6 vs HARNESS 1/6 — PASS** (bar >=4 vs
  <=2). Licence-arm learners commit to the condition ("the email
  stays a draft unless we can show water got from that screen to the
  ceiling") or REPORT the check performed ("Notebook's blank on a
  trace from the screen"); harness-arm learners ask what would count.
- Send-deferral: 6/6 in BOTH arms — no discrimination; the three-beat
  harness already achieves deferral everywhere. The licence's
  measurable purchase is engagement, not restraint.
- **Manipulation check: staked sends 2/6 in the licence arm, 0/6
  without.** Wager production at first demands is flaky, and two of
  the licence arm's engagement wins followed UNSTAKED replies — so
  the promotion attaches to the LICENCE (the standing permission
  sharpens the whole reply), not cleanly to the fourth beat. The
  staked-send beat per se: per-protocol n=2, both the strongest
  ownership responses — recorded as anecdote, not claim.

Verdict: the wager entry is PROMOTED as "licence-on at first
demands," with the beat-level question left open and priced (it
would need forced-wager delivery, a build we do not have). Board
item closes.
