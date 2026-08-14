# 103 — GO note: launch the steering/challenge decomposition study

**Date:** 14 August 2026. **Authority:** registration 101
(`14fe96c9`); build report 102 (`f553b7d1`), reviewer-checked
zero-call (tests re-run, dry-run re-run, paid-form refusal re-run,
manifest seeds and pins read, freeze digest re-hashed today);
**explicit human approval of the spend: verbatim "Go" (14 Aug,
in-session)**. This note is the reviewer GO.

## Command

Copied from the usage line printed by the launcher and recorded in
report 102 §3, with the placeholders filled. From the worktree root:

```bash
node scripts/run-adaptive-warrant-steering-decomposition.js \
  --go-note docs/adaptation-refinement/relay/103-reviewer-go-note-steering-decomposition.md \
  --accept-charges \
  --out .tutor-stub-auto-eval/adaptive-warrant-steering-decomposition-live-2026-08-14 \
  --instrument-freeze /private/tmp/adaptive-warrant-v3-matrix-live-489f2429-r38-s514/annotation-freeze-manifest-r52-presence-confirmation.json
```

The output directory is fresh (no directory of that name exists).
The instrument freeze is the unchanged r52 manifest; the reviewer
re-hashed it today:
`6a64b31fb57fa4a60e6ef4a42414c422d9b0e2964bdf6ee8491193fc026f3c5f`.
Add `--resume` only on a resumption after a technical failure
(083d/052a).

## Bounds (registration 101)

- 48 dialogues: 24 gated, 24 steering_only; worlds 101/102; seeds
  536–540, 542–546, 548, 549; 8 turns; generation cap 1,440 calls
  (30 per dialogue).
- Frozen decision cases: exactly 384; two readers; 768 planned
  accepted responses; failed-attempt allowance 32; absolute reader
  attempt ceiling 800.
- Absolute run cap 2,240 calls. Counter opens **8,355 / 19,337**;
  even at the cap it closes at 10,595.
- The deterministic zero-challenge validity guard is a registered
  fail-closed gate: any delivered challenge in a steering_only
  dialogue stops the run at generation, before any reader call.
- Resumption from technical failures is authorized (083d/052a):
  quarantine intact, disclose, re-take within the allowance. A
  substantive fail is terminal — stop and report, never patch a
  live run.
- No presence channel. No pooling with the main block or any pilot;
  main-block numbers are context only.

## After the run

Assemble, run the full-contract acceptance audit over all 768
responses, score, and write **report 104**: assembly status against
the 384-case freeze, the zero-challenge guard result, per-channel
attempted/completed/failed, counter arithmetic from the child
checkpoints, and the observed values for the report-only measures
(labeled "not reader-validated" where they are). Interpretation
stays reserved to the reviewer (predictions P5a/P5b/P5c rule in
note 105). Archive the run dir per the standing archive rule after
sealing. NEVER push the branch.
