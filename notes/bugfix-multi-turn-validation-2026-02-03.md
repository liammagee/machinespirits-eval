# Bugfix: Multi-turn Evaluation Issues

**Date:** 2026-02-03

## Bug 1: requiredMissing/forbiddenFound not aggregated

The `runMultiTurnTest` function was not aggregating the `requiredMissing` and `forbiddenFound` arrays from individual turn results. While `passesRequired` and `passesForbidden` were correctly aggregated as booleans, the detailed arrays were omitted from the return object.

**Fix:** Added aggregation before the return statement:
```js
const requiredMissing = [...new Set(turnResults.flatMap(t => t.requiredMissing || []))];
const forbiddenFound = [...new Set(turnResults.flatMap(t => t.forbiddenFound || []))];
```

## Bug 2: Failed tests not stored in database

When a multi-turn test threw an error (e.g., "Turn 4 failed to generate suggestions"), the error handler attempted to store a failed result but used:
```js
provider: config.provider || null,
model: config.model || null,
```

For profile-based configs, provider/model are nested under `config.ego.provider` and `config.ego.model`. The top-level values are undefined, violating the database's `NOT NULL` constraint and causing the INSERT to silently fail.

**Fix:** Updated error handlers in both `runEvaluation` and `resumeEvaluation` to properly extract provider/model:
```js
provider: config.provider || config.ego?.provider || 'unknown',
model: config.model || config.ego?.model || 'unknown',
egoModel: config.egoModel
  ? `${config.egoModel.provider}.${config.egoModel.model}`
  : config.ego ? `${config.ego.provider}.${config.ego.model}` : null,
superegoModel: config.superegoModel
  ? `${config.superegoModel.provider}.${config.superegoModel.model}`
  : config.superego ? `${config.superego.provider}.${config.superego.model}` : null,
```

Also added failed result storage to `resumeEvaluation` error handler (was missing entirely).

## Bug 3: totalTests overwritten on completion

The `updateRun` call at completion was overwriting `totalTests` with the number of results stored:
```js
totalTests: results.length  // 45 instead of 48
```

This made it appear that 45/45 tests passed when actually 45/48 passed (3 failed).

**Fix:** Removed `totalTests` from the `updateRun` call to preserve the original expected count set at run initialization. The status command will now correctly show "45/48" for runs with failures.

## Verification

- `npm test` passes (193/193)
- Run `eval-2026-02-03-0339c17d` investigation showed 3 test_error events that were not stored
- Future runs with failures will correctly show expected vs actual counts
