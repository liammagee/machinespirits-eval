# 023 — Protocol note: unattended mode (human authorized, 12 Aug)

**Date:** 12 August 2026
**Authority:** human direction in chat (12 Aug, ~14:20): "continue
unattended until further notice … we need the matrix passed as a
minimal before halting." This note amends the relay protocol; direction
022 remains the current work order.

## What changes

1. **Reviewer re-invocation.** While unattended mode is active, the
   reviewer (Claude session holding the relay watch) may re-invoke the
   driver headless whenever the driver is idle and a committed
   direction is pending, using the standing nudge template below. The
   committed relay files remain the sole authority channel; the nudge
   only points at them. The driver lease `DRIVER-LEASE-2026-08-12-D`
   carries across re-invocations.
2. **Pre-authorized envelope for the driver** (no human, no reviewer
   stop needed):
   - timebox-class repairs (transport, schema, provenance,
     non-evaluability, mechanical matching/derivation) with focused
     tests and preflight cover — never semantic-contract or rubric
     changes;
   - zero-call counterfactual replays, and diagnostic probes on burned
     turns capped at 48 calls each, outputs never evidence;
   - relaunch at the next reserve seed (order: 507, 508, 509, 510)
     when a replay or probe predicts discard ≤ 15%; each burned seed's
     corpus joins the exclusion set;
   - the matrix gate ruling itself, per the frozen thresholds and
     ruling 010's fallback (mechanism consensus < 0.75 with binary
     ≥ 0.80 cuts the typing layer; binary carries).
3. **Reviewer-gated transitions** (reviewer direction required, but no
   human): matrix gate pass → prereg freeze from
   `2026-08-12_outcome-study-design-draft.md` → reviewer audits the
   frozen prereg → outcome pilot (~450 calls) → reviewer audits pilot
   → main block (~1,800 calls, conditions interleaved round-robin).
   The reviewer rules on each transition in a committed direction.
4. **Hard stops that wait for the human** (driver and reviewer both
   halt and hold):
   - reserve seeds exhausted (510 burned) without a matrix pass;
   - any repair that would touch the semantic contract, rubric, or
     certified instrument;
   - any needed value or authority absent from the written record;
   - unattended new-call budget exhausted: **4,000 provider calls**
     from this note forward, all runners combined;
   - suspected contamination or provenance anomaly.
5. **Reporting unchanged.** The driver writes numbered reports; the
   reviewer keeps STATE.md current and logs each re-invocation in its
   direction. Every report states calls spent; the reviewer keeps the
   running budget total.

## Standing nudge template (reviewer → driver, headless)

> You are the relay driver, lease DRIVER-LEASE-2026-08-12-D. Read
> docs/adaptation-refinement/relay/STATE.md and the current direction
> it names, then proceed under the unattended envelope of note 023.
> Commit reports as usual. Stop only at a 023 hard stop or the current
> direction's stop.

## Exit

Unattended mode ends when the human says so in chat. The minimum goal
before any voluntary halt: the representative matrix gate has ruled
PASS. If it rules fail after all reserve seeds, that is a hard stop,
not a failure to be worked around.
