# 101 — Registration: steering/challenge decomposition study

**Date:** 14 August 2026. **Authority:** ruling 100 (§4: the causal
claim needs a fresh registration separating the steering from the
challenge). Written before any data for this study exist.

## Question

The main block (096, run `…main-block-live-2026-08-13`) showed the
gated condition breaks learner deference (19/24 vs 10/24 bare,
11/24 standing permission), but 12 of the 19 breaks happened with no
delivered challenge. Two mechanisms are confounded in "gated":

1. **Steering** — the warrant gate runs in active mode every turn,
   choosing the tutor's action family under explicit contracts.
2. **Challenge** — when the sensor arms (three straight deferential
   turns), the family `challenge_resistance` becomes selectable.

This study separates them: does steering alone produce the effect?

## Design

Two conditions, same worlds (101 and 102, SHA-pinned as in 096),
same 8-turn horizon, same low-agency learner profile:

- **gated** — exactly the main-block gated configuration, unchanged.
- **steering_only** — identical, except the policy never selects
  `challenge_resistance`: the challenge branch in
  `services/adaptiveWarrantPolicy.js` is skipped and evaluation
  falls through to the next rule. The sensor still runs and still
  logs its arming basis (kept for the report). Nothing else changes.

**Seeds: 12 fresh — 536, 537, 538, 539, 540, 542, 543, 544, 545,
546, 548, 549.** Search run by the reviewer before this commit
(misfire-M1 rule): any number 536–556 within twelve characters of
the word "seed" over `docs/`, `config/`, `scripts/`, `services/`,
`tests/`, plus run-directory names under `.tutor-stub-auto-eval/`,
`/private/tmp/adaptive-warrant-*`, and the private archive repo.
Seeds 541 and 547 are in use
(`config/drama-derivation/matrix-specs/null-scale-mirror-refusal.yaml`)
and are excluded. The driver's independent re-check stays mandatory.

Layout: 12 seeds × 2 worlds × 2 conditions = **48 dialogues**, 24
per condition, condition rotation balanced across seed × world as in
the main block.

## Readers and freeze

Decision-reader channel only; presence not fielded. Exact-count
freeze: 48 dialogues × 8 decision turns = **384 cases**, two readers
each = **768 planned reads**. Failed-attempt allowance **32**;
absolute reader attempt ceiling **800**. Same byte-pinned reader
child (`c0a201300a66e32919d22aaac42e431f32bd1df595b582f7762928a148c2e6ad`),
same r52 instrument freeze (digest `6a64b31f…`), same reader model
`codex.gpt-5.6-luna` on the Codex CLI route for both readers. The
094a acceptance rule stands: every accepted response passes the full
deterministic contract at acceptance.

## Call plan

Generation expected ~1,300 (main block averaged ~26 calls per
dialogue), cap 48 × 30 = **1,440**. Readers ≤ 800 attempts. Run
absolute cap **2,240**. Counter opens at 8,355/19,337; worst case
closes 10,595, inside the ceiling.

## Gates (fail-closed; nothing else gates)

1. **Assembly** — exactly 384 frozen cases; 768 accepted responses
   within the allowance; full contract passed at acceptance.
2. **Zero-challenge validity guard (deterministic, in-run)** — if
   any `steering_only` dialogue logs a delivered
   `challenge_resistance` turn, the condition is misbuilt: the run
   stops fail-closed at generation. This is a build-validity check
   on sealed events, no reader involved.

Predictions below are readings, not gates. M7/M8 stay report-only,
computed zero-call, labeled not reader-validated. No pooling with
the main block or any pilot; main-block numbers are citable as
context only.

## Predictions (from ruling-100 evidence)

- **P5a (steering carries the effect):** at least 15 of 24
  steering_only dialogues show a deference break (main-block gated
  19/24; controls 10–11/24).
- **P5b (decomposition rule, primary):** if fresh-gated breaks
  exceed steering_only breaks by **5 or more dialogues**, the
  challenge component has a causal part; if by 4 or fewer, steering
  suffices and the challenge adds nothing detectable at this size.
- **P5c (correctness moves with steering):** steering_only M1
  consensus correctness lands within 5 points of fresh-gated M1
  (main block: gated 87.5% vs controls 64.8%/68.3%).

Report-only: arming counts per condition; challenge counts in the
fresh gated batch; M3 streaks; M5/M6.

## Build items for the driver (zero paid calls)

1. Add a `steering_only` configuration to the outcome-study
   condition table (active gate, challenge family unselectable) with
   whatever flag/env plumbing the launchers need; the two control
   conditions and the gated configuration stay byte-identical in
   behavior.
2. A focused test: on inputs that today select
   `challenge_resistance`, the steering_only policy returns the
   fall-through action and the gated policy still returns
   `challenge_resistance`.
3. A main-block-style launcher for this study (48 jobs, the freeze,
   both readers, the guards above), reusing the 096 machinery;
   dry-run/mock path proven before any GO note.
4. Build report as relay note 102: digests, seed re-check, dry-run
   evidence, printed usage line. **No paid call before a reviewer GO
   note (103) and explicit human approval of the spend.**

## Bounds

Everything not named here inherits 096/096a unchanged (quarantine
and re-take path under 083d/052a, archive duty, never push,
STATE.md discipline).
