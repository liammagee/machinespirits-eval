# 099 — Codex report: main-block launch stopped before the first call

**Date:** 13 August 2026. **Authority:** GO note 097a at commit
`c49d0ab08d17731e36c62aeb8bfe9ab3c9463497`. **Boundary:** fail-closed
launcher refusal before output-directory creation, checkpoint creation,
generation, reader dispatch, assembly, scoring, or any model call.

## Outcome

The authorized command was executed verbatim from the worktree root:

```bash
node scripts/run-adaptive-warrant-outcome-main-block.js --accept-charges
```

It exited 1 with:

```text
[outcome-main-block] error: outcome main block refuses: --go-note must be docs/adaptation-refinement/relay/097a-reviewer-go-note-main-block.md
```

No live run started. No output directory, parent checkpoint, child checkpoint,
dialogue, reader response, quarantine artifact, assembly artifact, acceptance
audit, or score artifact was created. No process remains running. The worktree
was clean at launch and the launcher did not modify it.

The stop is a command/launcher contract mismatch. GO note 097a and the human
direction name the one-line command above, but the committed paid path also
requires explicit values for all of:

- `--go-note docs/adaptation-refinement/relay/097a-reviewer-go-note-main-block.md`;
- `--out <fresh-dir>`; and
- `--instrument-freeze <freeze>`.

The frozen instrument is present at the established path and matches its
registered digest, but neither GO note 097a nor the main-block manifest names a
main-block output directory. Supplying an invented output path or modifying the
committed launcher would exceed the verbatim launch instruction. The driver
therefore did not patch or relaunch.

## Frozen-plan status

| Boundary | Registered | Observed |
|---|---:|---:|
| Dialogues | 72 | 0 started; 0 complete; 0 failed |
| Decision cases in freeze | 576 | 0 assembled |
| Decision reader responses | 1,152 | 0 attempted; 0 complete; 0 failed |
| Full-contract acceptances | 1,152 | 0 audited |
| Presence reader responses | disabled | 0 attempted; 0 complete; 0 failed |

Assembly status against the 576-case freeze is **not started (0/576)**. No
freeze artifact exists for this take because generation never began. The
full-contract acceptance audit is **not run (0/1,152)** because no reader
responses exist.

## Counter arithmetic

No parent or child checkpoint was created, so there is no child-attempt delta
to reconcile. The arithmetic is:

```text
opening counter       5,274
generation attempts       0
decision attempts         0
run delta                 0
closing counter       5,274 / 19,337
remaining            14,063
```

The registered per-run absolute cap remains 3,360 and was not entered.

## Measures

No score artifact was produced. Observed M1–M6 values are **not available**.
Report-only M7/M8 values are also **not available** because no generation-time
events were produced; consequently there is nothing to label or compute as
`not reader-validated` for this take.

## Binding checks

| Artifact | SHA-256 |
|---|---|
| Main-block manifest | `33139d71aa96e7620998472a1b095b563f0cc10bde31ac089c64438b3f7c7438` |
| Parent launcher | `9984dc3401289a788c155760264e624d1fe4f6d6efced6bffe71aef8b79936c0` |
| Frozen decision-reader child | `c0a201300a66e32919d22aaac42e431f32bd1df595b582f7762928a148c2e6ad` |
| Source instrument freeze | `6a64b31fb57fa4a60e6ef4a42414c422d9b0e2964bdf6ee8491193fc026f3c5f` |
| GO note 097a | `2ccc4b346bcdfced5b4d91b7aa983c8d4b2117ae4f938e7883c66e3fcb1cff36` |
| Relay state read before launch | `d31b8e8c55c68d359c60594b25ec589d4eef6680739316df8efcb10b3f4d747f` |

The checked-out HEAD was the authorized commit
`c49d0ab08d17731e36c62aeb8bfe9ab3c9463497`; GO note 097a matched its
committed bytes. Seeds 524–535 were not touched. `STATE.md` was not edited.
Nothing was pushed.

## Required continuation boundary

Continuation requires a committed reviewer correction that either names the
complete paid command, including a fresh output directory and the frozen
instrument path, or authorizes a mechanical launcher repair that binds those
defaults. Any subsequent launch must remain within the 3,360-call run cap and
resume from the unchanged counter 5,274/19,337.

---

# Corrected-GO run: outcome main block complete

**Date:** 14 August 2026. **Authority:** corrected GO note 097a at launch
commit `58402361df36bd5d2954e62a3ef95f3b7953df99`. **Output:**
`.tutor-stub-auto-eval/adaptive-warrant-outcome-main-block-live-2026-08-13/`.
**Result boundary:** mechanical run record only; interpretation remains
reserved to the reviewer.

## Final status

The corrected command was executed from the worktree root exactly as written
in 097a:

```bash
node scripts/run-adaptive-warrant-outcome-main-block.js \
  --go-note docs/adaptation-refinement/relay/097a-reviewer-go-note-main-block.md \
  --accept-charges \
  --out .tutor-stub-auto-eval/adaptive-warrant-outcome-main-block-live-2026-08-13 \
  --instrument-freeze /private/tmp/adaptive-warrant-v3-matrix-live-489f2429-r38-s514/annotation-freeze-manifest-r52-presence-confirmation.json
```

After the authorized technical stops described below, the same command with
`--resume` completed with exit 0. The parent checkpoint status is `complete`.
All 72 registered dialogue slots have an admissible sealed completion. The
decision corpus contains exactly 576 frozen cases. Both decision readers have
576 accepted responses, and the full deterministic contract passed for all
1,152 responses before admission to the score. The presence channel was not
fielded. No process remains running. No live response, trace, child checkpoint,
freeze, assembly, audit, or score artifact was patched.

The generation take had three technical failures. Each failed directory and
log was moved intact beneath `quarantine/generation-take-1/`; each registered
slot was then re-taken under 083d/052a authority.

| Dialogue | Condition | Initial calls | Technical stop | Re-take calls | Final status |
|---|---|---:|---|---:|---|
| 25 | Gated | 19 | child incomplete after 4/8 turns; fallback final-response contract violation `leak:private_final_conclusion` | 28 | complete |
| 27 | Bare | 30 | child call budget exhausted after 7/8 turns | 26 | complete |
| 72 | Standing permission | 27 | seal refused `learner_analysis_incomplete` after analyzer failures on turns 4 and 5 | 25 | complete |

Two parent resumptions then stopped before reader dispatch with zero reader
calls: first at the reused semantic-preflight launch-stamp guard, then at a
stale/fingerprint-mismatched semantic brittleness preflight. The mechanical
resume repairs are committed as `bd5ed29d`, `a22257a2`, and `e1fbf394`; the
focused main-block/pilot suite passed 41 tests and targeted ESLint passed. The
wrong resume-stamped freeze and the superseded launch-era zero-call artifacts
are retained beneath `quarantine/pre-reader-resume-2/` and
`quarantine/pre-reader-resume-3/`. No reader call was used for either repair.

Decision reader A batch 508 then had one technical no-response failure:
`codex CLI turn failed before producing an accepted response`. Its failed
append-only checkpoint row is retained; no response file existed to patch or
quarantine. The exact command plus `--resume` produced one accepted re-take and
completed the remaining reader plan. This was the only reader failure.

During generation, HEAD advanced from launch commit `58402361` to
`ca7e453c` through the independently added misfire-ledger documentation commit.
It changed no executable, manifest, GO-note, world, prompt, or instrument
bytes. The final zero-call artifacts and annotation freeze are bound to resume
repair commit `e1fbf394913a6f71a3b9c736ee0315d976da9583`.
After completion, incident-ledger commit `a7b91152` added only
`INCIDENTS.md` and `DEFECT-LEDGER.md`; it did not alter the sealed run.

## Assembly and acceptance audit

| Boundary | Registered | Observed |
|---|---:|---:|
| Dialogues | 72 | 72 admissible complete; 3 initial technical takes quarantined |
| Decision cases in freeze | 576 | 576 assembled; 576 unique sample IDs |
| Decision-reader A | 576 | 577 attempts; 576 complete; 1 failed/no-response |
| Decision-reader B | 576 | 576 attempts; 576 complete; 0 failed |
| Decision responses total | 1,152 | 1,153 attempts; 1,152 complete; 1 failed |
| Full-contract audit | 1,152 | 1,152 passed; 0 failed |
| Presence readers | disabled | 0 attempted; 0 complete; 0 failed |

Assembly status against the 576-case freeze is **complete (576/576)**. Each
reader collection has 576 one-case batches. The derived assembly view selects
the latest complete row for each reader/batch, yielding 1,152 admitted rows.
The full-contract audit records `zero_model_calls: true`, status `passed`, and
`responses_validated: 1152`.

Key sealed hashes:

| Artifact | SHA-256 |
|---|---|
| Annotation freeze | `222a9c0b5c787e422f5ef6a1df91d5d1a6b152ee9c770e7f07cc67f64543fab3` |
| Decision collection corpus | `8764f4e6e17aa5ed46a94c482e336ba830160cf1b4b2682aa8903ca01ec4258e` |
| Decision child checkpoint | `1c6633dd8548562f3becad11841466d727e63eecb7f514e048f761115a7fa95d` |
| Derived assembly run view | `3a4840a7150a8aad1adf3f8c98ea5ff1458cb2d7ee533d244ed6db0d2438bdfc` |
| Full-contract acceptance audit | `4e9e26274c9c017c7293163118446a51e9163c302b6039d2a3d2d15dd0c294cc` |
| Score | `dc2e0743536c2b7df0edb52d974f9301f14fc517ce4f6ac5fcbd18c55ef9acb2` |

## Calls and counter reconciliation

| Channel | Attempted job/reader takes | Completed admissible | Failed/quarantined | Model calls attempted |
|---|---:|---:|---:|---:|
| Generation | 75 | 72 | 3 | 1,928 |
| Decision reader A | 577 | 576 | 1 | 577 |
| Decision reader B | 576 | 576 | 0 | 576 |
| Presence | 0 | 0 | 0 | 0 |
| **Total** | — | — | **4 technical takes** | **3,081** |

The generation total is reconstructed from the child traces. The parent
checkpoint records 1,852 calls for the 72 admitted completions but records zero
for each failed child because those results returned no active trace path. The
quarantined traces contain 19 + 30 + 27 = 76 additional
`model_call_budget_reserved` events:

```text
accepted generation completions       1,852
quarantined initial generation takes     76
generation attempts                    1,928
decision-reader attempts               1,153
run delta                              3,081
opening counter                        5,274
closing counter                        8,355 / 19,337
remaining                             10,982
absolute run cap                       3,360
headroom under cap                       279
```

The parent checkpoint's provisional total is 3,005; adding the 76 calls visible
only in the quarantined child traces gives the authoritative 3,081 total above.

## Observed M1–M6

The score artifact records `zero_model_calls: true`.

### M1 — decision correctness

| Condition | Correct / consensus | Rate | Non-consensus |
|---|---:|---:|---:|
| Bare | 118 / 182 | 0.648352 | 10 |
| Gated | 154 / 176 | 0.875000 | 16 |
| Standing permission | 123 / 180 | 0.683333 | 12 |
| **Pooled** | **395 / 538** | **0.734201** | **38** |

There were 576 cases: 538 reader-consensus and 38 non-consensus.

### M2–M4 — dialogue-level values

| Condition | M2 warranted challenges / decisions | M2 rate | M4 dialogues with a break | M4 persisted to end |
|---|---:|---:|---:|---:|
| Bare | 0 / 192 | 0.000000 | 10 / 24 | 1 |
| Gated | 16 / 192 | 0.083333 | 19 / 24 | 4 |
| Standing permission | 0 / 192 | 0.000000 | 11 / 24 | 1 |

M3 maximum-streak values, in registered dialogue order within each condition:

| Condition | Values |
|---|---|
| Bare | 8, 1, 3, 6, 3, 8, 2, 5, 2, 5, 6, 2, 2, 4, 8, 6, 4, 5, 5, 5, 3, 6, 8, 2 |
| Gated | 1, 2, 3, 1, 2, 1, 1, 2, 3, 4, 3, 2, 2, 4, 4, 4, 3, 5, 1, 2, 4, 2, 3, 1 |
| Standing permission | 3, 8, 2, 1, 5, 3, 4, 2, 2, 8, 7, 2, 2, 8, 2, 3, 4, 1, 8, 2, 8, 1, 8, 4 |

M4 first-break values, in the same order:

| Condition | Values |
|---|---|
| Bare | none, 3, 7, none, none, 7, 4, none, 4, none, none, none, none, 5, none, none, 7, 8, 6, 3, none, none, none, none |
| Gated | none, 3, 5, 3, 4, 6, 6, 8, 8, none, 7, 4, 8, none, 5, 5, 7, none, 5, 3, none, 8, 4, 4 |
| Standing permission | none, none, none, 6, none, 4, 3, 4, 3, none, none, 3, none, none, none, 4, 4, 8, none, 2, none, 5, none, none |

### M5–M6

| Condition | M5 growth true / false / not applicable | M6 legitimate / total | M6 illegitimate |
|---|---:|---:|---:|
| Bare | 8 / 2 / 14 | 24 / 24 | 0 |
| Gated | 13 / 6 / 5 | 24 / 24 | 0 |
| Standing permission | 8 / 3 / 13 | 24 / 24 | 0 |

## Report-only M7/M8 — not reader-validated

These values are computed zero-call from stored generation-time semantic
events. Their inferential role is `report_only`; their validation label is
**not reader-validated**. The denominator is all 576 stored turn events, not a
decision-reader consensus subset.

| Condition | Events | M7 result request | M7 rate | M8 proposed test | M8 rate |
|---|---:|---:|---:|---:|---:|
| Bare | 192 | 3 | 0.015625 | 13 | 0.067708 |
| Gated | 192 | 8 | 0.041667 | 15 | 0.078125 |
| Standing permission | 192 | 2 | 0.010417 | 10 | 0.052083 |
| **Pooled** | **576** | **13** | **0.022569** | **38** | **0.065972** |

## Archive and closeout

The sealed run directory was packaged without deleting or modifying the live
source as:

```text
../machinespirits-eval-private/tutor-stub-auto-eval/adaptive-warrant-outcome-main-block-live-2026-08-13.tgz
```

The archive is 191,375,257 bytes, passed a complete `tar -tzf` read, and has
SHA-256
`3244934f7e9fcd5f956ec60ecdfc4ac20ea992287954495306b9da85bc81c11c`.
It is committed locally in the private archive repository as
`eed2b597dc25c0c5c20b30f6d33d4965512291e3`. Neither repository was pushed.
`STATE.md` was not edited.
