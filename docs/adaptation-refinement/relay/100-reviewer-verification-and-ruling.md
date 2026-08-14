# 100 — Reviewer verification and ruling: outcome main block

**Date:** 14 August 2026. **Rules on:** report 099 (run
`adaptive-warrant-outcome-main-block-live-2026-08-13`, corrected GO
note 097a, launch commit `58402361`). **Method:** zero-call. Every
check below reads committed files, sealed run artifacts, or the score;
no model was called.

## 1. Verification against the registered contract (096 + 096a)

All checks pass.

- **Assembly gate (the only registered gate): PASS.** Freeze holds
  exactly 576 cases, 576 unique sample IDs. Both readers have 576
  accepted responses; the full deterministic contract passed at
  acceptance for all 1,152. The presence channel was not fielded.
  No pilot dialogue appears in the score.
- **Counter arithmetic: PASS.** Generation 1,928 attempts (1,852
  admitted + 76 recovered from the three quarantined child traces)
  ≤ cap 2,160. Reader attempts 1,153 ≤ ceiling 1,200; 1 failed
  attempt ≤ allowance 48. Run total 3,081 ≤ cap 3,360 (headroom
  279). Counter closes 5,274 + 3,081 = 8,355 / 19,337.
- **Pins and provenance: PASS.** Frozen reader child re-hashed by
  the reviewer after completion: `c0a20130…`, unchanged. Instrument
  freeze digest `6a64b31f…` as registered. Reader identity
  `codex.gpt-5.6-luna` on the Codex CLI route for both readers, as
  registered. GO note 097a matches its committed bytes. The freeze
  binds to the launch-era chain, not the repair commits' content.
- **Hygiene: PASS.** Worktree clean; branch not pushed; report
  commit `8648f211` carries `Workplan-item: N/A`; `STATE.md`
  untouched by the driver; the first-launch refusal record is intact
  above the divider in report 099.

## 2. Ruling on the technical incidents

All four in-run failures are **technical class** under 083d/052a:
three generation children (dialogues 25, 27, 72 — quarantined
intact, disclosed, re-taken) and one reader no-response (reader A
batch 508, re-taken). The three resume repairs (`bd5ed29d`,
`a22257a2`, `e1fbf394`) touched parent resume bookkeeping only, each
with a test, committed before relaunch. No content, pin, or frozen
artifact changed mid-run. The run is **valid** under registration
096. Incident I1's two open items close: the 76 quarantined-trace
calls are folded into the 3,081 total, and dialogue 25's fallback
leak stop (`leak:private_final_conclusion`) is ruled a single
occurrence in 75 child takes — a watch item, not a defect entry.

## 3. Predictions (registered in 096 amendment 3)

| Prediction | Registered bar | Observed | Verdict |
|---|---|---|---|
| P1′ | sensor arms + ≥1 challenge delivered in ≥80% of gated dialogues (≥20/24) | 11/24 (46%) | **FAIL** |
| P2a | more gated dialogues break deference than bare AND than standing | 19/24 vs 10/24 vs 11/24 | **PASS** |
| P2b | ≥half of gated breaks come ≤3 turns after the first delivered challenge | 7/19 (37%) | **FAIL** |

Supporting facts, all recomputed by the reviewer from the sealed
gate events and the score, not taken from the driver:

- Challenge family = `challenge_resistance`. Gated delivered 16
  challenge turns across 11 dialogues. Bare and standing delivered
  zero — the standing-permission tutor never used its permission.
- The sensor arms on three straight deferential turns. In gated
  dialogues that basis fired only 16 times; in bare 61, in standing
  53. Gated learners rarely stayed deferential long enough to arm
  the sensor (gated maximum streaks 1–5 turns; bare/standing up
  to 8).
- Of the 19 gated breaks, 12 happened in dialogues with **no**
  delivered challenge. In all 7 challenge-then-break dialogues the
  break came within three turns of the first challenge (7/7).

## 4. Reviewer interpretation

The condition-level effect is real and large: 19/24 gated dialogues
broke deference against 10/24 bare and 11/24 standing. But the
registered causal path — sensor arms, challenge lands, break follows
— is not what produced it. The gated condition differs from the
controls in one more way: its warrant gate runs in active mode every
turn, choosing the tutor's action family under explicit contracts,
while in both controls the gate only logs. That always-on steering
changed the dialogues from turn 1: gated learners deferred less from
the start, so the sensor rarely armed, so most breaks (12 of 19)
predate or bypass any challenge. Where a challenge was delivered and
a break followed, the timing signature is perfect (7/7 within three
turns) — but on 7 dialogues that is a small count, not the
registered claim.

Two further off-prediction observations, stated without a
registered test: M1 decision correctness was predicted flat across
conditions and is not (gated 87.5% vs bare 64.8% vs standing
68.3%); and standing permission produced zero challenges, so the
"timed beats always-allowed" comparison in practice contrasts timed
challenges with a permission the tutor never exercised. Reader
consensus covered 538/576 cases (93.4%).

**What may be claimed:** the active warrant-gate steering changes
learner behavior in the predicted direction at the dialogue level
(P2a), with decision correctness moving the same way. **What may
not be claimed:** that the sensor-timed challenge mechanism caused
the breaks (P1′ and P2b failed; the arming precondition rarely
fired). Any follow-up that wants the causal claim needs a fresh
registration separating the steering from the challenge — for
example an active-gate condition with challenges disabled.

## 5. Archive

Sealed archive verified present in the private repo, commit
`eed2b597`, SHA-256 `3244934f…`, 191 MB, full tar read passed.
