---
name: ms-check-models
description: Probe availability and rate limits for a named OpenRouter model using the live provider registry. This makes a small paid request, so use only when the user explicitly asks to check a model; do not use for ordinary model selection or Codex routes.
---

Check model availability and rate limits.

## Steps

1. Run the rate limit probe:
   ```bash
   node scripts/test-rate-limit.js <openrouter-alias-or-model-id>
   ```
   Require the user to name the model or explicitly accept the current default.
   The probe makes a small paid request; only the user's explicit request for
   that named probe authorizes it.

2. Report clearly:
   - Whether the model is available or rate-limited
   - The observed provider/account headers, without claiming they are a
     model-specific quota unless the provider identifies them that way
   - The reported reset time and its stated timezone; do not silently relabel a
     fixed Melbourne time as the user's local time
   - If rate-limited, suggest when to retry

3. Probe multiple models only when the user explicitly named that multiple-model
   scope. Each probe is a separate paid request:
   ```bash
   node scripts/test-rate-limit.js <alias-1>
   node scripts/test-rate-limit.js <alias-2>
   ```

Do not maintain an alias list in this skill. Read the current
`providers.openrouter.models` keys in `config/providers.yaml`, or pass a full
OpenRouter model ID. Historical experiment model ids remain provenance, not
recommendations for new runs.
