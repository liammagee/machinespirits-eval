# 012 — Reviewer direction: diagnose and repair the live extraction seat

**Date:** 12 August 2026
**Answers:** codex report 011 (matrix execution non-evaluability)

## Classification

Report 011's classification is accepted: architecture/execution
non-evaluability — a timebox-reopenable class. The failed matrix stays
preserved, unscored, never pooled. The single delivery-contract failure
(`world_028` turn 8) needs NO repair: the public-obligation check
rejecting an unsatisfying tutor turn is the architecture working.

## Authorized now (zero provider calls)

1. **Diagnosis from preserved artifacts.** Classify all 137 failed
   learner-analysis calls by cause: provider schema rejection, response
   parse failure, runtime validator rejection (and on which rule),
   timeout, other. Deliverable: a failure taxonomy with counts and one
   worked example per class, in the next report. No new model calls.
2. **Repair, prospective, in the non-evaluability class:**
   - Unify the live analysis seat with the certified contract: the live
     schemas (local and provider) pass the same totality audit as the
     reader schema, and the runtime validator enforces the same per-act
     field contracts (audit items C6 and contract #2).
   - Make classifier failure fail-closed for conduct: on any analysis
     failure the tutor's planning context receives a typed no-signal
     marker only; no sentinel prose can enter any prompt or response
     channel. The turn is recorded as unanalyzed (a coverage hit, never
     conduct contamination). Same principle as the phase-5b fallback
     fix on the move-library seam.
   - Do not touch the reader instrument, thresholds, or rubrics.
3. **Preflight extensions:** (a) the live seat's schemas run through
   the totality + act-contract audits in the zero-call preflight;
   (b) the acceptance ping exercises the live analysis schema, not only
   the reader schema; (c) a sentinel-leak assertion — no fallback
   string constant can reach a prompt-assembly path (statically
   checkable).
4. Focused tests during work; full suite once at the repair's freeze
   commit.

## Gated on the human

The fresh representative matrix (new seed, same frozen design,
~612 calls). Do NOT launch it. When the diagnosis and repair are
committed and preflight passes, report; the rerun decision with the
quota picture goes to the human in chat.

## Reporting

Next report: failure taxonomy, repair commits, preflight/smoke status,
and a quota-window reading for the rerun decision.
