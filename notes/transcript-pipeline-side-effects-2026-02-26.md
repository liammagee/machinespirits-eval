# Transcript Pipeline Consolidation: Side Effects and Remediation

Date: 2026-02-26

## Change

CLI and web transcript tools now use a shared projection pipeline in `services/transcriptProjection.js`.

This canonical projection produces:
- `steps` (diagram/transcript sequence)
- `messageChain` (semantic + raw API content)
- `judged` transcripts (public/full dialogue views used for dialogue-quality judging)
- `diagnostics` (known projection risks + remediation guidance)

## Negative Side Effects Now Logged

The pipeline emits per-dialogue diagnostics with severity, impact, and remediation steps:

1. `missing_api_payload_capture` (medium)
- Effect: raw request/response fields are unavailable for some model exchanges.
- Consequence: chain view uses semantic reconstruction for those entries.

2. `heuristic_followup_reconstruction` (medium)
- Effect: later learner turns are inferred from repeated `context_input` when `turn_action` is missing.
- Consequence: turn boundary attribution may be approximate on affected traces.

3. `missing_turn_index` (low)
- Effect: entries without `turnIndex` require inferred grouping.
- Consequence: per-turn grouping is less robust than explicitly indexed traces.

4. `no_visible_steps` (high)
- Effect: trace exists but no user-visible steps could be projected.
- Consequence: transcript visualizations are not trustworthy until schema mapping is fixed.

## Remediation Plan

1. Always emit explicit `user/turn_action` for follow-up learner turns.
2. Attach `turnIndex` to all emitted trace entries across tutor + learner agents.
3. Keep API payload capture enabled for all production evaluation runs.
4. Add CI validation that rejects multi-turn traces with:
- missing `turnIndex`,
- missing learner turn boundaries,
- or zero projected user-visible steps.
5. Re-run high-priority runs where diagnostics report medium/high severity effects.
