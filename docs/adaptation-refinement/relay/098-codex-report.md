# 098 — Codex report: main-block build stopped at seed-freshness gate

**Date:** 13 August 2026. **Authority:** direction 097. **Boundary:**
structural stop during task 2, before any build edit, test, model call, or run
launch.

## Outcome

The outcome main block was **not built or launched**. Direction 097 requires a
proof that every proposed seed from 518 through 529 appears in no prior
diagnostic, smoke, pilot, or burned run directory. That proof is false for
seeds **518** and **519**:

- `.tutor-stub-auto-eval/sensor-fix-smoke-A-s518-2026-08-13` is a sealed,
  completed smoke corpus. Its run plan passes `--run-seed 518`, uses world 102,
  runs eight turns, and uses the low-agency permission-seeking learner profile.
- `.tutor-stub-auto-eval/bad-learner-smoke-B-s519-2026-08-13` is a sealed,
  completed smoke corpus. Its run plan passes `--run-seed 519`, uses world 102,
  and runs eight turns.

The first overlap is also the same permission-seeking persona and one of the
same frozen worlds required for the main block. Direction 097 provides no
authority to substitute seeds, waive freshness, delete or relabel the smoke
corpora, or change the registered 518–529 range. The driver therefore stopped
instead of inventing a replacement plan.

No harness, launcher, manifest, study plan, scorer, test, child runner, frozen
instrument, or paid artifact was changed. No paid or zero-call model route was
invoked. Nothing was pushed.

## Searches run

The initial directory inventory searched both local artifact roots for all
adaptive-warrant diagnostic, smoke, pilot, outcome, matrix, and burned-run
shapes:

```bash
find .tutor-stub-auto-eval /private/tmp -maxdepth 2 -type d 2>/dev/null \
  | rg 'adaptive-warrant|outcome|pilot|smoke|diagnostic|burn|matrix' \
  | sort
```

That inventory exposed the two named smoke directories. The follow-up search
then limited matches to executable run-seed metadata in run plans, run states,
traces, and logs, and limited the result paths to the relevant corpus/run
families:

```bash
rg -l -U --hidden \
  --glob 'run-plan.json' --glob 'run-state.json' --glob '*.jsonl' --glob '*.log' \
  '(--run-seed"?[[:space:]]*,?[[:space:]]*"?(518|519|520|521|522|523|524|525|526|527|528|529)\b|"run_seed"[[:space:]]*:[[:space:]]*(518|519|520|521|522|523|524|525|526|527|528|529)\b)' \
  .tutor-stub-auto-eval /private/tmp 2>/dev/null \
  | rg 'adaptive-warrant|outcome|pilot|smoke|diagnostic|matrix|burn' \
  | sort
```

It returned exactly two files:

```text
.tutor-stub-auto-eval/bad-learner-smoke-B-s519-2026-08-13/run-plan.json
.tutor-stub-auto-eval/sensor-fix-smoke-A-s518-2026-08-13/run-plan.json
```

Direct `jq` inspection of each plan confirmed the argument pairs
`["--run-seed", "518"]` and `["--run-seed", "519"]`. Direct inspection of
each `run-seal.json` confirmed `status: complete`, one successful result, eight
analyzed public turns, and learner-analysis coverage 1. Seeds 520–529 had no
exact adaptive-run metadata hit in the searched roots, but the registered set
fails freshness because 518 and 519 are already burned.

## Evidence digests

| Artifact | SHA-256 |
|---|---|
| Direction 097 | `4640285ed50aeec89b5ff52206a9ef7c85b78c3b09258fd2c0bf24fa91fe83bd` |
| Relay state read before action | `2300c397c55fa4e5435d6a029645bd2d1539e479e030d7ecd454dc20b9e8368d` |
| Seed-518 smoke run plan | `35e00bad5634278f99e26c0d85bfdb34e3dfec11ecd5d451bb3e923df7754c6c` |
| Seed-518 smoke seal | `79d654eb313eb18bb3061682cd901d6226fcd571f18bf1dd4f500bbcbf50093b` |
| Seed-519 smoke run plan | `f2e6a0244b61e452f96db483a958199474acd5063750412524053deb3dde08ea` |
| Seed-519 smoke seal | `3571507239d3f8d5670d6e3fa2e1a7a03c1e959e8296aa33ddf805c10cc0f60c` |
| Frozen decision-reader child, unchanged | `c0a201300a66e32919d22aaac42e431f32bd1df595b582f7762928a148c2e6ad` |

The only tracked file changed by this stop is this report. Its committed blob
identity and commit identity are supplied by Git; no build-file digest exists
because no build file was changed.

## Tests and call arithmetic

No tests were run: task 2 is a mandatory pre-build identity gate, and it failed
before the task-6 test implementation existed. Running unrelated tests could
not establish seed freshness or authorize a substitute seed plan.

The registered but unbuilt arithmetic remains:

- generation: approximately 2,000 calls for 72 dialogues;
- decision readers: 576 cases × 2 readers = 1,152 planned calls;
- failed-attempt allowance: 48;
- total: approximately 3,200 calls.

Actual calls in direction 097/this report: **0**. The counter therefore remains
**5,274 / 19,337**, with **14,063** remaining. No presence channel was built or
fielded, and no reader process was launched.

## Required ruling before continuation

Continuation requires a new committed reviewer direction that supplies a
fresh, pre-registered 12-seed range or explicitly resolves the seed-518 and
seed-519 prior-smoke overlap. The current human GO does not resolve this
contradiction because it approved registration 096 as written, whose freshness
claim the local run evidence disproves. The main-block GO note 097a must not be
cut from this build state.
