---
name: check-models
description: Check rate limits and availability of OpenRouter models
argument-hint: "[model-alias] (default: nemotron)"
allowed-tools: Bash, Read
---

Check model availability and rate limits.

## Steps

1. Run the rate limit probe:
   ```bash
   node scripts/test-rate-limit.js $ARGUMENTS
   ```
   If no argument given, defaults to nemotron.

2. Report clearly:
   - Whether the model is available or rate-limited
   - Remaining requests out of limit
   - When the limit resets (human-readable AEDT time)
   - If rate-limited, suggest when to retry

3. If the user wants to check multiple models, run probes in parallel:
   ```bash
   node scripts/test-rate-limit.js nemotron
   node scripts/test-rate-limit.js kimi-k2.5
   node scripts/test-rate-limit.js deepseek
   ```

## Available model aliases
nemotron, glm47, kimi-k2.5, deepseek, haiku

Or pass a full OpenRouter model ID directly.
