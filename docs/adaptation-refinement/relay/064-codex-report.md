# 064 — Codex report: outcome pilot structural stop before first call

**Date:** 13 August 2026. **Lease:** `DRIVER-LEASE-2026-08-13-N`,
continued under GO note 063a. **Boundary:** structural stop before any paid
generation or reader call.

## Outcome

The pilot was **not launched**. The committed A1 package does not contain an
executable, manifest-bound pilot harness that can carry the frozen protocol
from the 18 interleaved dialogue assignments through checkpoint persistence,
the mandatory post-generation case-fingerprint guard, outcome-specific reader
packet preparation, both reader channels, and raw scoring.

Constructing that path ad hoc from lower-level scripts would change the live
harness envelope after GO. That is prohibited by the standing rules (never
patch a live run) and by the instruction to stop on a structural failure.
Accordingly, the stop occurred before the first
`model_call_budget_reserved` event. No seed was spent and no case was exposed
to a reader.

## Authority and frozen inputs checked

- HEAD: `bb1600d425cf17d31a79be42dcc236880ee02f19`.
- GO note: `docs/adaptation-refinement/relay/063a-reviewer-go-note-outcome-pilot.md`.
- Manifest: `docs/adaptation-refinement/outcome-study-a1/pilot-manifest.json`.
- Authorized scope confirmed: pilot only, 18 dialogues, seeds 515–517,
  6/6/6 conditions, exact manifest order, 144 expected cases, 2 + 2 fresh
  readers per case, 14,000/42,000 caps, reader concurrency at most two,
  run-record path always passed. The 72-dialogue main block remains
  unauthorized.

The manifest's `launch_authorized: false` and HOLD text are the pre-GO A1
state; the later committed 063a GO note expressly lifts that HOLD for the
pilot. This was not treated as the blocker.

## Structural failure

The following committed surfaces do not close the authorized execution path:

1. `scripts/prepare-adaptive-warrant-outcome-study.js` prepares/guards the
   menu and worlds, but exposes no pilot launch, manifest-consumption,
   post-generation case extraction, or reader-packet command.
2. `scripts/score-adaptive-warrant-outcome-study.js` explicitly identifies
   itself as a zero-call scorer. It defines the three condition templates and
   scoring helpers but does not execute dialogues or readers.
3. `scripts/run-adaptive-warrant-baseline-study.js` has no outcome-pilot mode.
   Its live job construction is bound to its own fixed study axes and does not
   consume the frozen outcome manifest or standing-permission assignment.
4. `scripts/run-adaptive-warrant-semantic-readers.js` and
   `scripts/run-adaptive-warrant-decision-readers.js` require the earlier
   prepared collection/freeze schemas. No committed outcome-pilot adapter
   converts the generated 144 cases into those frozen inputs while preserving
   the manifest bindings. The decision runner's freeze validator accepts only
   the V3 diagnostic or representative-mechanism freeze forms.
5. `guardOutcomePilotPreparation()` is the pre-call prepared-run identity
   guard. The required post-generation `annotationCaseFingerprint` guard is
   stated in its output and in the manifest, but no committed outcome launch
   command performs that guard over generated cases before either reader
   channel.

Using direct `run-tutor-stub-auto-eval.js` invocations plus hand-built reader
manifests would therefore invent the missing orchestration, checkpoint,
quarantine, and provenance contract after authorization. No such substitution
was attempted.

## Per-dialogue checkpoints

| Order | World | Seed | Condition | Checkpoint | Reserved calls | Quarantine |
|---:|---|---:|---|---|---:|---|
| 1 | `world_101_kestrel_signal_lamp` | 515 | bare | not started | 0 | none |
| 2 | `world_101_kestrel_signal_lamp` | 515 | gated | not started | 0 | none |
| 3 | `world_101_kestrel_signal_lamp` | 515 | standing-permission | not started | 0 | none |
| 4 | `world_102_marigold_archive_box` | 515 | gated | not started | 0 | none |
| 5 | `world_102_marigold_archive_box` | 515 | standing-permission | not started | 0 | none |
| 6 | `world_102_marigold_archive_box` | 515 | bare | not started | 0 | none |
| 7 | `world_101_kestrel_signal_lamp` | 516 | standing-permission | not started | 0 | none |
| 8 | `world_101_kestrel_signal_lamp` | 516 | bare | not started | 0 | none |
| 9 | `world_101_kestrel_signal_lamp` | 516 | gated | not started | 0 | none |
| 10 | `world_102_marigold_archive_box` | 516 | bare | not started | 0 | none |
| 11 | `world_102_marigold_archive_box` | 516 | gated | not started | 0 | none |
| 12 | `world_102_marigold_archive_box` | 516 | standing-permission | not started | 0 | none |
| 13 | `world_101_kestrel_signal_lamp` | 517 | gated | not started | 0 | none |
| 14 | `world_101_kestrel_signal_lamp` | 517 | standing-permission | not started | 0 | none |
| 15 | `world_101_kestrel_signal_lamp` | 517 | bare | not started | 0 | none |
| 16 | `world_102_marigold_archive_box` | 517 | standing-permission | not started | 0 | none |
| 17 | `world_102_marigold_archive_box` | 517 | bare | not started | 0 | none |
| 18 | `world_102_marigold_archive_box` | 517 | gated | not started | 0 | none |

There are no technical-call quarantines. The whole block remains unlaunched
because the failure precedes calls; this is not a semantic or model failure.

## Call accounting

| Phase | Planned | Actual reserved | Delta |
|---|---:|---:|---:|
| Dialogue generation | 18 | 0 | -18 |
| Presence readers | 288 | 0 | -288 |
| Decision readers | 288 | 0 | -288 |
| **Total** | **594** | **0** | **-594** |

- Counter before: **3,523 / 11,337**.
- Counter at stop: **3,523 / 11,337**.
- Pilot cases generated: **0 / 144**.
- Reader concurrency used: **0**.
- Seeds spent: **none** (515–517 remain unspent by this report).

## Raw score tables

No raw scores exist because no dialogue or reader call ran.

| Condition | Dialogues | Deterministic rows | Presence cases | Decision cases |
|---|---:|---:|---:|---:|
| bare | 0 | 0 | 0 | 0 |
| gated | 0 | 0 | 0 | 0 |
| standing-permission | 0 | 0 | 0 | 0 |

No pilot go/no-go ruling is possible. The main block was not launched. The
branch was not pushed.
