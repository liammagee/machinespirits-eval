# 105 — Reviewer verification and ruling: steering/challenge decomposition

**Date:** 15 August 2026. **Rules on:** report 104 (`7005e640`; run
`adaptive-warrant-steering-decomposition-live-2026-08-14`, GO note
103 at `1dec824c`). **Method:** zero-call. Every check reads
committed files, sealed run artifacts, or the score; no model was
called.

## 1. Verification against registration 101

All checks pass.

- **Assembly gate: PASS.** Freeze holds exactly 384 cases. Both
  readers have 384 accepted responses each, 768 total, all with the
  full deterministic contract passed at acceptance. Failed-attempt
  allowance unused (the mid-run attempted/completed gap of one was
  an in-flight call, not a failure; the final child record shows
  768/768). Presence channel not fielded; no pooling.
- **Zero-challenge validity guard: PASS, recomputed.** The reviewer
  re-read all 192 gate outcome events across the 24 steering_only
  dialogues: zero delivered `challenge_resistance`. The condition
  is built as registered.
- **Counter arithmetic: PASS.** Generation 1,336 attempts (1,256
  admitted + 80 recovered from the three quarantined child traces)
  ≤ cap 1,440. Reader attempts 768 ≤ ceiling 800. Run total 2,104
  ≤ cap 2,240 (margin 136). Counter closes 8,355 + 2,104 =
  **10,459 / 19,337**.
- **Pins: PASS.** Reader child re-hashed by the reviewer:
  `c0a20130…`, unchanged. r52 instrument freeze digest `6a64b31f…`
  re-hashed at launch by the reviewer (note 103) and checked by the
  launcher. Reader model and route as registered for both readers.
- **Score recomputation: PASS.** The reviewer recomputed from the
  sealed score, independent of the report: breaks gated 16/24,
  steering_only 13/24; M1 consensus correctness gated 150/179 =
  83.80%, steering_only 125/174 = 71.84%. All match report 104.
- **Hygiene: PASS.** Worktree clean; branch not pushed; report
  commit carries the trailer; `STATE.md` untouched by the driver;
  quarantined first takes intact. Archive verified by the reviewer:
  commit `9dcd39ef` in the private repo, 220,206,888 bytes, SHA-256
  `92d9e37d…` re-hashed and matching.

## 2. Ruling on in-run events

All three generation child failures (dialogues 19, 22, 30 — seeds
540, 542, 544) are **technical class** under 083d/052a: quarantined
intact, disclosed, re-taken within the allowance. The one mid-run
repair (`8153622a`) fixed the resume seed-freshness check, which had
flagged this run's own automatic private-archive mirror as prior
seed use; the diff touches the launcher's exclusion list and tests
only. No content, pin, or frozen artifact changed mid-run.

One disclosed deviation, ruled benign: the annotation freeze stamps
the repair commit `8153622a`, not the launch commit `1dec824c`,
because the freeze was first written after the resume. The two
commits differ only in resume bookkeeping and tests; every content
pin is byte-identical across them. Watch item: the decomposition
launcher should retain the launch stamp on resumed freezes, as the
main-block launcher does since defect 18.

The run is **valid** under registration 101.

## 3. Prediction verdicts (registered in 101)

| Prediction | Registered bar | Observed | Verdict |
|---|---|---|---|
| P5a | steering_only breaks ≥ 15/24 | 13/24 | **FAIL** |
| P5b | gated − steering_only ≥ 5 dialogues → challenge causal; ≤ 4 → steering suffices at this size | 16 − 13 = 3 | **≤ 4 branch: no detectable challenge effect on breaks** |
| P5c | steering_only M1 within 5 points of gated | 83.80 − 71.84 = 11.96 points | **FAIL** |

Report-only context, recomputed: gated delivered 45 challenge
policy turns across 17 dialogues (the main block had 16 across 11);
sensor-armed turns gated 48 vs steering_only 70; steering_only
maximum deference streaks run longer (median 4 vs 3.5).

## 4. Reviewer interpretation

The decomposition did not return the clean answer either branch of
P5b imagined.

- **On deference breaks, the two conditions are close** (16 vs 13;
  the registered rule reads a 3-dialogue gap as no detectable
  challenge effect at this size). But steering alone also missed
  its own bar (13 < 15), and the fresh gated batch replicated below
  the main block (16/24 vs 19/24). With main-block controls at
  10–11/24 as context only, steering_only sits between control and
  gated levels.
- **On decision correctness the conditions separate cleanly.**
  Gated replicates its main-block level (83.8% vs 87.5%); steering
  alone falls to 71.8%, near the main-block controls (64.8%,
  68.3%). Removing the challenge family cost about 12 points of
  correctness, against a registered prediction of within 5.

**What may be claimed:** the full active gate's effect replicates
on fresh seeds (16/24 breaks, 83.8% correctness). The challenge
family is load-bearing for decision correctness: an otherwise
identical gate without it loses about 12 points (registered
comparison, P5c). **What may not be claimed:** that steering alone
suffices (P5a failed); that the challenge component drives the
break count (3-dialogue gap, under the registered threshold); or
any single-mechanism story for the break effect — the two outcome
channels decompose differently, and saying why (challenges as
correctness repairs delivered at the right moments, or something
else) needs a fresh registration.

## 5. Standing state

Counter 10,459/19,337. No further paid run is authorized. Next
step is interpretive: fold rulings 100 and 105 into the paper
section, then the fold-to-main plan.
