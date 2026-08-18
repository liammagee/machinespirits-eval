# 111 — BLOCK: the pilot's frozen reader bindings do not match

Date: 2026-08-15
Workplan item: guarded-learner-outcome-study
Follows: relay 110 (registration)
Status: **NO LAUNCH.** The approval to spend is held, not spent. Zero model
calls were made to find this.

## 1. What happened

The user approved the pilot spend. Before writing the GO note I re-computed
every pin the launcher checks. Two of eight fail, so the launcher would
refuse anyway, and the reason matters more than the refusal.

`verifyOutcomePilotReaderBindings` (`scripts/run-adaptive-warrant-outcome-pilot.js:207`)
checks seven bindings. Re-computed at branch HEAD `a8348fb9`:

| Binding | Result |
|---|---|
| `extraction_schema_digest` | **FAIL** |
| `reader_digest` | **FAIL** |
| `semantic_preparer` | pass |
| `decision_preparer` | pass |
| `decision_runner` | pass |
| `decision_handbook` | pass |
| `provider_response_schema` | not reached |

Relay 108 reported six pins re-hashing byte-identical, and that was true.
These two are a different kind of pin — a digest over a **schema plus the
bytes of the file that declares it** — and relay 108 did not check them.
That is the gap this note closes.

## 2. The two failures have different causes

### (a) `extraction_schema_digest` — moved by design

The digest hashes the extraction schema id, the event limits, and the bytes
of `services/adaptiveWarrantSemanticEvents.js`
(`services/adaptiveWarrantSemanticPreflight.js:55`). Commit `124294c1` added
the three defensive speech acts and the `defended_overclaim` label to that
file. So the digest **had** to move. It is the contract change showing up as
a number.

There is nothing to restore. A v3.3 arm cannot match a v3.2 seal, and the
pilot manifest is a v3.2 seal.

### (b) `reader_digest` — broken by a formatting pass, before this branch

The digest hashes three files, none of which this branch touches. It fails
on `origin/main` too. Bisected:

- at `a265c99b` (the commit that wrote the manifest): **passes**
- at `e729e1a8` (`style: apply prettier to warrant-fold files`): **fails**

The seal-breaking edit is reflowing and nothing else. Two template strings
pulled onto one line, one ternary wrapped. `git diff -w` over the two files
shows no changed token. A cosmetic commit landed after the seal and moved
bytes the seal pins.

This means the A1 pilot has not been launchable from `main` since
`e729e1a8`, independent of the guarded work.

## 3. What each one needs

**(b) is the repo's standing rule and is mechanical.** When a sealed byte
pin drifts, restore the bytes; never edit the frozen hashes. Restoring means
reverting the reflow in
`services/adaptiveWarrantSemanticAnnotation.js` and
`scripts/run-adaptive-warrant-semantic-schema-acceptance-ping.js` to their
`a265c99b` form. That is a change to `main`-line files, and the repo's
format hook will re-break it on the next edit, so the restore needs a guard
that holds it — a test that asserts these two files re-hash to the sealed
values, so a future prettier pass fails loudly instead of silently
unsealing the pilot.

**(a) is a human call and cannot be fixed by restoring anything.** Three
options, stated plainly:

1. **Re-seal a guarded manifest.** A separate pilot manifest for the
   defensive pole, pinned at v3.3, registered as its own seal. The passive
   A1 seal stays untouched. Cost: a new sealed artifact and the zero-call
   preparation that goes with it.
2. **Run the pilot on the auto-eval launcher**, the way smoke C ran, and
   score afterwards. Cost: the pilot loses the sealed launcher's guards —
   the interleaved assignment, the budget ledger, the reader-binding check.
   The registration's gate slots survive; the provenance is weaker.
3. **Drop the sealed-runner route for now** and hold the pilot until the
   passive arm's instrument is itself re-sealed at v3.3.

Option 1 keeps the registration as written. It is the recommendation.

## 4. What was not done

No GO note was written. No call was made. The approval stands unspent and
is not carried forward by this note — when the block clears, the spend
needs its own GO note quoting its own approval.

NEVER push this branch.
