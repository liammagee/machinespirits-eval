# Bugfix: Multi-turn requiredMissing/forbiddenFound Aggregation

**Date:** 2026-02-03

## Bug

The `runMultiTurnTest` function in `services/evaluationRunner.js` was not aggregating the `requiredMissing` and `forbiddenFound` arrays from individual turn results. While `passesRequired` and `passesForbidden` were correctly aggregated as booleans (using `turnResults.every(...)`), the detailed arrays showing which specific items were missing or found were omitted from the return object.

This caused `storeResult` to store empty arrays via the `|| []` fallback, making it impossible to diagnose which required/forbidden patterns failed in multi-turn scenarios.

## Root Cause

The return object in `runMultiTurnTest` (around line 1555-1556) included:
```js
passesRequired: turnResults.every(t => t.passesRequired),
passesForbidden: turnResults.every(t => t.passesForbidden),
```

But did not include the corresponding `requiredMissing` and `forbiddenFound` arrays that detail the actual failures.

## Fix

Added aggregation before the return statement:
```js
const requiredMissing = [...new Set(turnResults.flatMap(t => t.requiredMissing || []))];
const forbiddenFound = [...new Set(turnResults.flatMap(t => t.forbiddenFound || []))];
```

And included these in the return object:
```js
requiredMissing,
forbiddenFound,
```

Using `Set` ensures deduplication when the same pattern fails across multiple turns.

## Verification

- `npm test` should pass with same results (184/193, 9 pre-existing kimi model failures)
- Future runs should populate `required_missing` and `forbidden_found` columns correctly
- Query to verify fix: `SELECT required_missing FROM evaluation_results WHERE passes_required = 0 AND required_missing = '[]'` should return no rows for new runs
