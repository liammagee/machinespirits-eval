# 102 — Codex report: steering/challenge decomposition build complete; HOLD

**Date:** 14 August 2026. **Registration:** 101. **Starting HEAD:**
`14fe96c9ead8e48e182fe22d6840110ec9cfe074`. **Paid model calls:** **0**.

## Boundary reached

All four zero-call build items in registration 101 are complete. The study is
built but not launched. The parent remains fail-closed until both a committed
reviewer GO note 103 and explicit human approval exist. No generation child,
reader child, model route, paid call, live run directory, archive mutation,
push, or `STATE.md` edit occurred.

There was no reader disagreement or semantic classification to adjudicate in
this build-only step.

## 1. `steering_only` condition

The outcome-study condition table now contains `steering_only`:

- warrant gate mode remains `active`;
- horizon, learner profile, models, prompt profile, world inputs, and all other
  runner arguments inherit the gated condition;
- the one new opt-out is
  `TUTOR_STUB_WARRANT_CHALLENGE_RESISTANCE=unselectable`, carried by
  `--warrant-challenge-resistance unselectable` through the auto-eval parent;
- `services/adaptiveWarrantPolicy.js` skips only the
  `challenge_resistance` branch when that opt-out is set, then evaluates the
  pre-existing next rule. The default remains `selectable`, so gated and the
  two inherited controls do not opt out and retain their prior behavior.

The registered focused test uses an input whose gated path selects
`challenge_resistance`. Gated still returns `challenge_resistance`; the
steering-only path falls through to `stage_next_step`.

Because the outcome manifests deliberately pin the policy source, the changed
policy digest was propagated through the standing-permission menu source
binding, pilot manifest, and inherited main-block manifest. The generated menu
still has exactly the same 63 entries and 87-row classification, and its full
byte guard passes. This was binding maintenance, not a change to any inherited
condition's prompt or policy behavior.

## 2. Registered launcher and guards

New entry point:
`scripts/run-adaptive-warrant-steering-decomposition.js`.

The parent reuses the 096 generation, freeze, one-case decision collection,
two-reader assembly, resume, quarantine/re-take, full-contract acceptance, and
scoring machinery. Its frozen arithmetic is:

- 12 seeds × 2 worlds × 2 conditions = **48 dialogues**;
- 24 gated and 24 steering-only dialogues, balanced by seed × world;
- 8 turns each = exactly **384 frozen decision cases**;
- two readers each = exactly **768 accepted responses**;
- failed-attempt allowance **32**;
- unchanged child-internal allowance **12**, so the authorization request is
  capped at **788** attempts;
- absolute reader attempt ceiling **800**;
- generation cap 48 × 30 = **1,440**;
- absolute run cap **2,240**; counter opening **8,355/19,337**.

The note-103 validator also requires the complete charge-bearing command, all
registered counts and pins, `steering_only`, and an explicit human-GO or
approval attestation before the paid path can pass.

The launcher checks the complete r52 instrument-freeze digest
`6a64b31fb57fa4a60e6ef4a42414c422d9b0e2964bdf6ee8491193fc026f3c5f`.
The decision-reader child was not edited and remains byte-pinned at
`c0a201300a66e32919d22aaac42e431f32bd1df595b582f7762928a148c2e6ad`.
The preparation/assembly child remains byte-pinned at
`332447730054e13f02d6d8af0d5c4a58130254e08abf838b87237df62d14fb95`.

Two fail-closed gates implement registration 101 exactly:

1. After all 48 generation jobs seal, and before corpus freezing or reader
   preparation, the deterministic zero-challenge guard reads every
   `steering_only` `turn_complete` event. Any delivered
   `challenge_resistance` sets status
   `generation_zero_challenge_guard_stop`; readers are not prepared or run.
2. The assembly gate requires the 384-case collection, 768 planned and
   full-contract-passing accepted responses, a complete child record, and no
   more than 800 attempts. Only then can scoring proceed.

M7/M8 remain report-only from stored generation-time events and are labeled
not reader-validated. The presence channel is absent. No pilot or main-block
data are pooled into this study.

## 3. Usage, HOLD, and zero-call dry-run evidence

Printed usage:

```text
Usage:
  node scripts/run-adaptive-warrant-steering-decomposition.js
  node scripts/run-adaptive-warrant-steering-decomposition.js --dry-run
  node scripts/run-adaptive-warrant-steering-decomposition.js --go-note docs/adaptation-refinement/relay/103-reviewer-go-note-steering-decomposition.md --accept-charges --out <fresh-dir> --instrument-freeze <freeze> [--resume]
```

Bare invocation exited 0 and printed:

```text
Adaptive-warrant steering decomposition: HOLD / zero-call plan only.
Entry point: scripts/run-adaptive-warrant-steering-decomposition.js
48 dialogues; seeds 536-540, 542-546, 548, 549; generation approximately 1300; decision readers 768; failed-attempt allowance 32; run cap 2240 calls.
Presence channel: disabled. Measures 7 and 8: report-only from stored events, not reader-validated.
A paid run requires committed docs/adaptation-refinement/relay/103-reviewer-go-note-steering-decomposition.md plus --accept-charges.
```

`--dry-run` returned `status: passed`, `zero_model_calls: true`,
`model_calls: 0`, 48 jobs, 24 per condition, with all six checks true:
study plan, job count, every job dry-run, steering-only active,
steering-only challenge unselectable, and gated unchanged. The mock guard test
also passed 24 sealed steering-only traces with zero challenges and rejected a
synthetic delivered challenge. The synthetic assembly test passed at 800
attempts and failed at 801.

A paid-form invocation without `--go-note` exited 1 at the note-103 guard,
before checking the supplied freeze and before creating its requested output
directory:

```text
[steering-decomposition] error: steering decomposition refuses: --go-note must be docs/adaptation-refinement/relay/103-reviewer-go-note-steering-decomposition.md
```

## 4. Independent seed-freshness re-check

The driver independently re-checked seeds 536–540, 542–546, 548, and 549 over
the registered source roots and over run metadata and directory names under:

- `.tutor-stub-auto-eval/`;
- `/private/tmp`;
- `/Users/lmagee/Dev/machinespirits/machinespirits-eval-private`.

The exact-number source-proximity search found only the current relay state and
the new study manifest, launcher, and tests. It found no prior corpus, run, or
private-archive use. An initial deliberately broad textual pass also surfaced
historical prose containing the integer `2,540`; that is not seed 540. The
exact-number rerun excluded comma-thousands substrings.

The run-metadata search over `run-plan.json`, `run-state.json`,
`run-seal.json`, and `run-events.jsonl` returned **zero files**. The
`s<seed>` / `seed-<seed>` directory-name search returned **zero directories**.
The launcher's independent zero-call audit inspected **8,112** metadata files
across the three roots and returned:

```json
{
  "status": "passed",
  "hits": []
}
```

Seeds 541 and 547 remain excluded as registered and were not added to the
study.

## 5. Digests

| File | SHA-256 |
|---|---|
| `docs/adaptation-refinement/outcome-study-a1/steering-decomposition-manifest.json` | `6e1640d14bcd42ed986356fec9d96481a7f08641ca5d369082bfa00fc5eca715` |
| `scripts/run-adaptive-warrant-steering-decomposition.js` | `99fc7b02afc4c482cbf1545b0ecae4a91746125c23844c2076b353b6f8266a13` |
| `services/adaptiveWarrantPolicy.js` | `8e17f23bab13270b83a10597ca820b08607b42e6757640c23b70dab25bf60837` |
| `scripts/run-tutor-stub-auto-eval.js` | `c646cf39bb9783dc6ac9c50c540fc8a2fe1450b8116cc2635010fadaeb604260` |
| `scripts/run-adaptive-warrant-outcome-pilot.js` | `1349c8ec962831e045632430e7bf007175659222d66c89c007c040901e0ab39d` |
| `scripts/score-adaptive-warrant-outcome-study.js` | `e7270a0331adfd9e9fa329628d3b54a48140d564ba5d118e9db876a612ad65f9` |
| `scripts/prepare-adaptive-warrant-outcome-study.js` | `408a91282a435a9aee12cbc838d3b59b62ba6d5abda915405115c6a905a68363` |
| `docs/adaptation-refinement/outcome-study-a1/standing-permission-menu.json` | `30a240eebc18a431a712a51e645660783aa070d3762e50b6ccc18bc8b8bda94a` |
| `docs/adaptation-refinement/outcome-study-a1/pilot-manifest.json` | `75137d3a7f057fb675e6b0e9bfcd8b35f671a96fba775ac6c6c445955a7532e6` |
| `docs/adaptation-refinement/outcome-study-a1/main-block-manifest.json` | `efdb547b57280cdc646d61892eeb82c82ae9f49909e17794b83017c154202600` |
| `tests/adaptiveWarrantGate.test.js` | `33697005b24004ecaf13c6e0773f34ba21019e2d0bd8acc390e3fd05c91af869` |
| `tests/adaptiveWarrantOutcomeStudy.test.js` | `edbd8a51c4caf4a706f5e70931fbd3002b3b4e1a941f9af61e25dba8c2c3fa51` |
| `tests/adaptiveWarrantSteeringDecomposition.test.js` | `8b14b03339af6466c733b5b0b0c61dec2c4d9ff38cb889e0929da2c9c00885e2` |

This report's blob and the final commit identity are supplied by Git; a
self-digest would be recursive.

## 6. Verification and handoff

- Focused Node suites:
  `adaptiveWarrantGate`, `adaptiveWarrantOutcomePilot`,
  `adaptiveWarrantOutcomeStudy`, `adaptiveWarrantSteeringDecomposition`,
  `adaptiveWarrantSemanticAnnotation`, and
  `adaptiveWarrantAnnotationCollection`: **175 passed, 0 failed**.
- Targeted ESLint over all changed JavaScript and test files: passed.
- `git diff --check`: passed.
- `STATE.md`: unchanged.
- Paid calls: **0**; counter remains **8,355/19,337**.

Boundary: **build complete; HOLD**. Wait for reviewer verification, committed
GO note 103, and explicit human approval. Never push.
