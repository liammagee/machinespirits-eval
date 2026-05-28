# Patch plan — missing Gemini r02 controls

## What's missing

Extension batch `phase2-gemini-author-probe-20260528-ext` produced 18 target
scores (3 anchors × 3 arms × 2 reps) but only **4 control scores** out of the
intended 8. The r02 controls fell over before reaching the scorer:

```
config/poetics-calibration/phase2-gemini-author-probe-20260528-ext/
  control-r01/  d4, d10-emphatic, d25-hard-trap, d26-hard-trap   → scored
  control-r02/  d4, d10-emphatic, d25-hard-trap, d26-hard-trap   → quality-gated out
```

The transcripts exist on disk; only the scores are absent.

## Why they failed

Failure mode: agy (Gemini 3.5 Flash) returned output the engine's
`extractTutorMessage()` parser couldn't read. When `externalMessage` came back
empty, `services/learnerTutorInteractionEngine.js:1740-1744` substituted the
hardcoded stock fallback:

> "I see what you're saying. Let me think about that for a moment. Could you
> tell me more about what's confusing you?"

This fired ~3× per drama, leaving zero genuine learner turns; the
`too_few_learner_turns` quality gate then blocked scoring. The new
`tutor_stock_fallback` warning (added this commit) makes this visible at write
time so it can't silently land again.

A separate issue ended the batch: agy hit `TerminalQuotaError` (
`QUOTA_EXHAUSTED`, reset in ~22h) mid-run on `target-r01` T18-D42 prefix
generation. So further runs against the same quota pool aren't immediate.

## Options

### A — accept r01 as sufficient, do nothing
Cheapest. The four r01 control scores already serve their job (negative
anchors for the cross-author triangulation; no recognition emitted). Case file
4 already notes the r02-controls gap and points at the new warning. Defensible
if we treat controls as "show at least one rep clears the floor," which they
do.

### B — diagnose then re-run only the r02 controls
Cost: agy quota for 4 dramas + scorer pass.
1. Read one failed r02 control transcript to see exactly what agy returned
   that failed `extractTutorMessage`. Likely candidates: missing `[EXTERNAL]`
   block, wrapped in code fence, leading prose before the block.
2. If the parser is over-strict, loosen it (preferred — fixes the root cause
   for future agy runs).
3. If agy is non-deterministically malformed, add a single retry on
   parse-failure inside `callGeminiCli` before the engine ever sees an empty
   message.
4. Re-run with `--only-controls --reps r02` after the quota window resets
   (~22h from `2026-05-28T15:23Z` → after `2026-05-29T13:30Z`).

### C — swap generator for r02 controls only
Cost: claude or codex tokens for 4 control dramas.
Treat agy as the established author for the target arm and r01 controls;
generate r02 controls under a different bridge. Defensible if we only want
the cells filled, but it confounds the "is this generator-agnostic?" question
we were trying to answer with the cross-author probe.

## Recommendation

**B with a parser-fix preference.** A quick read of one failed transcript will
tell us whether the agy output is recoverable. If yes, fix the parser, then
re-run controls when quota resets. If the parser is fine and agy genuinely
returned empty content, fall back to a single retry in the bridge. Either way,
the new `tutor_stock_fallback` warning makes it audible the next time it
happens.

Don't pick C unless B reveals an agy-side malformity we can't fix. The
generator-independence story is weaker if half the controls switch authors.

## Concrete next step (when ready)

```bash
# 1. Read what the failed parser saw (pick one)
ls config/poetics-calibration/phase2-gemini-author-probe-20260528-ext/control-r02/d4/transcripts/

# 2. Probe the parser locally
node -e "const {extractTutorMessage} = require('./services/learnerTutorInteractionEngine.js'); console.log(extractTutorMessage(require('fs').readFileSync('<one-raw-output-path>', 'utf8')));"

# 3. After quota resets — re-run only r02 controls
node scripts/run-poetics-production-batch.js \
  --root config/poetics-calibration/phase2-gemini-author-probe-20260528-ext \
  --only control-r02 \
  --generator gemini
```
