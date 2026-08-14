# 069 — Codex report: outcome pilot stopped on generation-call accounting mismatch

**Date:** 13 August 2026. **Authority:** reviewer GO note 068c and ruling
068b. **Boundary:** the exact authorized launch was started, then stopped during
dialogue 2 when the live checkpoint proved that the frozen 594-call phase
arithmetic could not be satisfied. No harness, instrument, manifest, freeze, or
run artifact was amended.

## Outcome status

**STOPPED — no outcome-pilot ruling is available.**

The launch command from GO note 068c was run verbatim. All pre-call guards
passed, including the repaired 63-entry standing-permission menu byte guard,
the prepared-identity checks, the frozen-reader bindings, the zero-call
semantic brittleness preflight, and the zero-new-call schema-acceptance
carryover.

The first generation job then completed eight turns successfully. Its trace
contained **26** `model_call_budget_reserved` events: one opening call, eight
automated-learner calls, eight learner-analysis calls, eight tutor calls, and
one tutor-recovery call. The checkpoint charged all 26 to the `generation`
phase, whose entire frozen allocation is 18. It therefore recorded
`generation: 26`, `delta.generation: -8`, while still launching dialogue 2.

This is incompatible with the GO-note arithmetic of one generation call per
dialogue: 18 generation + 288 presence + 288 decision = 594. The launcher's
global 594-call guard did not refuse at the phase overrun; it would count the
low-level dialogue calls against the same total later required in full by the
576 reader calls. Continuing could not complete the approved phase plan. I
therefore interrupted the process fail-closed during dialogue 2, without
amending or resuming it. The process exited 1 from SIGINT. No reader process
was launched.

## Checkpoint summary

The preserved checkpoint remains exactly as the launcher last wrote it:

| Field | Preserved value |
|---|---:|
| status | `generation` |
| completed dialogues | 1 / 18 |
| checkpointed quarantined dialogues | 0 |
| checkpointed generation reservations | 26 |
| presence-reader reservations | 0 |
| decision-reader reservations | 0 |
| checkpointed total | 26 / 594 |
| checkpoint update | `2026-08-12T22:06:57.994Z` |

Dialogue 1,
`outcome-pilot-01-world_101_kestrel_signal_lamp-s515-bare`, sealed `complete`
with eight turns, coverage 1, stop reason `auto_turn_cap`, and 26 reserved
calls. It is only a completed generation artifact; the 18-dialogue corpus,
post-generation fingerprint guard, natural freeze, readers, and outcome
analysis were never reached.

Dialogue 2,
`outcome-pilot-02-world_101_kestrel_signal_lamp-s515-gated`, was interrupted
after one complete turn and during its next tutor call. Because SIGINT occurred
before `runOutcomeGeneration()` collected the child, the checkpoint never
appended a quarantine row. This report quarantines that incomplete dialogue
explicitly. It must not be admitted or pooled. Its trace contains seven
reservations and six completed `model_call` events; the seventh reservation was
in flight when interrupted.

## Call counts and counter arithmetic

| Phase | Frozen plan | Checkpointed | Additional interrupted-trace reservations | Conservative actual |
|---|---:|---:|---:|---:|
| generation | 18 | 26 | 7 | **33** |
| presence readers | 288 | 0 | 0 | **0** |
| decision readers | 288 | 0 | 0 | **0** |
| **total** | **594** | **26** | **7** | **33** |

Of the 33 generation reservations, 32 have corresponding `model_call` events.
The conservative spend count includes the final in-flight reservation because
its billing outcome is not established locally.

- Frozen planned counter: **3,523 + 594 = 4,117 / 11,337**.
- Actual conservative stop counter: **3,523 + 33 = 3,556 / 11,337**.
- Confirmed completed-call lower bound: **3,523 + 32 = 3,555 / 11,337**.
- Unspent portion of this authorized block on the conservative count:
  **561** calls.

The planned `3,523 -> 4,117` transition did not occur. No schema-acceptance
ping was made; the carryover records `new_calls: 0` as authorized.

## Artifact paths

All run artifacts are under the ignored local output root and are preserved
unmodified:

```text
.tutor-stub-auto-eval/adaptive-warrant-outcome-pilot-v1-live-2026-08-13/
```

Principal artifacts:

| Artifact | Path | SHA-256 |
|---|---|---|
| checkpoint | `.tutor-stub-auto-eval/adaptive-warrant-outcome-pilot-v1-live-2026-08-13/outcome-pilot-checkpoint.json` | `baf85147bd81d4e7bb2096a52ea73cd88169e1a29c6f8d8ec716dbb41f9db570` |
| semantic preflight | `.tutor-stub-auto-eval/adaptive-warrant-outcome-pilot-v1-live-2026-08-13/semantic-brittleness-preflight.json` | `2361f1f28464f3bc38217786c4719d39c6cca80caa8292fffb478827a73216e1` |
| schema-acceptance carryover | `.tutor-stub-auto-eval/adaptive-warrant-outcome-pilot-v1-live-2026-08-13/semantic-schema-acceptance-carryover.json` | `abbf229209db2699146cf09b6af94deca3d143e9ff1d43cf937c7f0f0b6589ac` |
| dialogue 1 auto-eval report | `.tutor-stub-auto-eval/adaptive-warrant-outcome-pilot-v1-live-2026-08-13/dialogues/outcome-pilot-01-world_101_kestrel_signal_lamp-s515-bare/auto-eval-2026-08-12T22-06-55-902Z.json` | `5095d91b5907c36c1cc7d6f26467b754827e3477e989f429d4a5f385e9617103` |
| dialogue 1 trace | `.tutor-stub-auto-eval/adaptive-warrant-outcome-pilot-v1-live-2026-08-13/dialogues/outcome-pilot-01-world_101_kestrel_signal_lamp-s515-bare/2026-08-12T22-00-31-846Z.jsonl` | `bd9c4d4777f120a81cb23bb96393eea8c138e75ece436075275e629a38ee2485` |
| dialogue 2 incomplete trace | `.tutor-stub-auto-eval/adaptive-warrant-outcome-pilot-v1-live-2026-08-13/dialogues/outcome-pilot-02-world_101_kestrel_signal_lamp-s515-gated/2026-08-12T22-06-58-750Z.jsonl` | `77b88d25dba650642943d33a8a38be959b6ced00cba4af1ece2e59cf108ea4e6` |

The per-dialogue parent logs are:

```text
.tutor-stub-auto-eval/adaptive-warrant-outcome-pilot-v1-live-2026-08-13/logs/outcome-pilot-01-world_101_kestrel_signal_lamp-s515-bare.log
.tutor-stub-auto-eval/adaptive-warrant-outcome-pilot-v1-live-2026-08-13/logs/outcome-pilot-02-world_101_kestrel_signal_lamp-s515-gated.log
```

The lawful source instrument freeze remains:

```text
/private/tmp/adaptive-warrant-v3-matrix-live-489f2429-r38-s514/annotation-freeze-manifest-r52-presence-confirmation.json
```

## Deviations and stop disposition

1. The live generation unit was not one model call per dialogue. One complete
   eight-turn dialogue reserved 26 low-level model calls, exceeding the entire
   18-call generation allocation before dialogue 2 began.
2. The checkpoint's per-phase delta went negative, but the launcher enforced
   only the 594 global total and continued. The mandatory full reader block
   still requires 576 calls, so the approved arithmetic was already
   impossible after dialogue 1.
3. The checkpoint is stale by seven reservations because the child was
   interrupted before parent collection. This report preserves both the
   checkpointed count and the trace-derived conservative count rather than
   rewriting the run state.
4. One complete bare dialogue and one incomplete gated dialogue exist. Both
   are outside any completed pilot corpus; the incomplete dialogue is
   quarantined explicitly, and neither supports an outcome claim.
5. The post-generation `annotationCaseFingerprint` guard was not reached.
   Presence and decision readers were not launched. The 72-dialogue main block
   remains unauthorized.
6. Run outputs are ignored by `.gitignore` and remain local; only this report
   belongs in the commit. No push is authorized or performed.

The run ends here. Continuation requires a fresh reviewer ruling; this report
makes no repair proposal and changes no frozen surface.
