# 030 — Direction: human ruling = option 1. Amend two contract rules (v3.1), license and spend seed 510.

**Date:** 12 August 2026
**Authority:** human ruling in chat, 12 Aug ~17:20 — "fix the two
rules, re-register openly, spend seed 510 on the amended contract",
with standing leave to proceed unattended as far as the written record
warrants. Note 023's envelope resumes under this direction.

## The ruling

Option 1 of report 029: keep the certified reader, keep the seat
(codex.gpt-5.6-luna, handbook_v1 prompt), keep every registered
threshold, and amend the live semantic-event contract at exactly the
two rules the zero-call diagnosis showed carry 22 of the 25 seed-509
discards (STATE, commit `ad68f14c`; tally script
`scripts/tally-semantic-replay-residuals.py`).

This is an open, disclosed, post-hoc amendment: it was chosen after
seeing seeds 503–509 fail. Those corpora stay burned and are never
scored. Seed 510 is the first corpus under the amended contract, and
its gate is a fresh test. Every later report and paper section that
uses seed-510 data must carry one line stating this amendment history.

## Amendment A — generic request target (pre-declared values)

Where a request act (at minimum the tutor-directed public result
request) must name a catalogue target, the analysis MAY give the
literal string `"unspecified"` as the target's catalogue ID
(`target_id`) and as the requested action's object ID
(`action_object_id`) — but only when the learner's words name no
catalogue item. Rules:

1. `"unspecified"` is valid ONLY on request acts. On any other act it
   stays invalid.
2. The empty string stays invalid everywhere. The model must choose:
   a real catalogue ID or the sentinel.
3. Downstream consumers treat an `"unspecified"` target as a generic
   evidence request. It never counts as naming any catalogue item.
4. The analysis-prompt handbook gains one sentence stating rule 1–2 in
   the model's instructions. No other prompt text changes.

## Amendment B — value sets on non-request acts (pre-declared values)

The rule that forbids requested-value-type and component sets on
non-request acts (`value_component_sets_forbidden_for_non_request`) is
REMOVED. Value and component sets are permitted on any act and are
descriptive. The act label alone says whether the event is a request.
The handbook sentence that states the old prohibition is deleted;
nothing else in the prompt changes.

## Frozen (unchanged from the registration)

Coverage ceiling 15% with the 10-turn floor; the seat and model; the
prompt except the two handbook sentences above; audit caps
56,000 chars / 14,000 tokens; worlds, profiles, conditions, 8 turns;
the matrix shape (24 dialogues); note 023's hard stops and the
4,000-call budget (1,085 spent). No retroactive scoring of burned
corpora under v3.1 — the licensing replay below predicts coverage
only and is never used for outcomes.

## Licensing seed 510 (in order; steps 1–3 zero-call)

1. **Implement v3.1.** Bump the semantic-contract version to 3.1 in
   the contract and validator. Focused tests: sentinel accepted on
   request acts; empty string rejected; sentinel rejected on
   non-request acts; value sets accepted on non-request acts; every
   other rule unchanged (non-literal spans, non-public identifiers,
   atomicity still discard).
2. **Zero-call replay** of the 131 retained seed-509 returned analyses
   under the v3.1 validator. Predicted discard must be ≤15%. The
   reviewer's tally predicts 3 of 25 discards remain (2.34% of
   completed turns); the replay is authoritative. If it predicts
   >15%, STOP — human hard stop, do not launch.
3. **Preflights as before:** exact zero-call instrument-ready
   preflight, probe/live prompt byte-parity, focused suite green.
4. **Launch the seed-510 matrix** under note 023's envelope. The
   report splits unanalyzed turns by cause class as always.

## After the matrix

If seed 510 passes the coverage gate, rule the matrix gate on the
registered criterion and continue under note 023's reviewer-gated
chain: pre-registration freeze, then pilot, then main block, minding
the 4,000-call budget. If seed 510 coverage-halts, that is a human
hard stop — seeds are exhausted and no further amendment authority
exists in writing.
