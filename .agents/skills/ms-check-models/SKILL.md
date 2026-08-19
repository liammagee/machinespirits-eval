---
name: ms-check-models
description: Check rate limits and availability of current OpenRouter models using the live provider registry
argument-hint: "[openrouter-alias-or-model-id]"
---

Check model availability and rate limits.

## Steps

1. Run the rate limit probe:
   ```bash
   node scripts/test-rate-limit.js $ARGUMENTS
   ```
   With no argument the script probes its current default. The probe makes a
   small paid request; invoking this skill is authority for the requested probe.

2. Report clearly:
   - Whether the model is available or rate-limited
   - Remaining requests out of limit
   - When the limit resets (include the user's local time when useful)
   - If rate-limited, suggest when to retry

3. If the user wants to check multiple models, run probes in parallel:
   ```bash
   node scripts/test-rate-limit.js <alias-1>
   node scripts/test-rate-limit.js <alias-2>
   ```

Do not maintain an alias list in this skill. Read the current
`providers.openrouter.models` keys in `config/providers.yaml`, or pass a full
OpenRouter model ID. Historical experiment model ids remain provenance, not
recommendations for new runs.
