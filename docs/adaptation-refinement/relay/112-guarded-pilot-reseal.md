# Relay 112 — the guarded pilot gets its own seal

**Status: BLOCK CLEARED for the two digests. STILL NO LAUNCH.** The approval to
spend is still held, not spent. A launch needs its own committed GO note.

Relay 111 reported two failing launcher pins and offered three ways out. The
user chose option 1: re-seal a separate manifest for the guarded pole at
contract v3.3, and leave the passive A1 seal alone. This note records what was
built, what it proves, and the one thing it does not fix.

## 1. What was built

`scripts/seal-guarded-warrant-outcome-manifest.js` — a zero-call script. It
reads the A1 manifest, re-checks every inherited pin against the working tree,
re-computes the two digests that moved, and writes

    docs/adaptation-refinement/guarded-pilot/guarded-pilot-manifest.json

The A1 directory is untouched. The A1 manifest still fails at HEAD, which is
correct: it is a v3.2 seal and it should not silently start passing.

## 2. Why a re-pin is allowed here and not in general

A sealed pin exists so that a byte change stops the run. Re-pinning by hand
would defeat that. So the script does not trust the word "reflow". For every
file behind a re-pinned digest it parses the sealed-commit version and the
working-tree version, strips positions from both parse trees, and compares
them.

| File | Bytes | Program |
|---|---|---|
| `services/adaptiveWarrantSemanticEvents.js` | moved | **changed** |
| `services/adaptiveWarrantSemanticAnnotation.js` | moved | same |
| `scripts/prepare-adaptive-warrant-semantic-annotations.js` | same | same |
| `scripts/run-adaptive-warrant-semantic-schema-acceptance-ping.js` | moved | same |

Three of the four files are formatting. The one real change is the v3.3 act
catalogue, which is the study. A file whose program changed may only be
re-pinned when it is named on the command line as a contract change, and a
named file that did not change is also a failure. Both refusals are tested.

The sealed commit is `a265c99b`, the commit that wrote the A1 manifest.

## 3. The persona now reaches the fingerprints

A defect turned up while wiring this. The freshness guard
`guardOutcomePilotPreparation` hardcoded `low_agency`, so the guarded pole's
18 planned runs would have been fingerprinted as the passive pole's. It now
takes the persona from the manifest. The two poles share no candidate
fingerprint, which is what the guard is for. The launcher also refuses when
`--learner-profile` disagrees with the manifest.

The default is still `low_agency`, so a manifest that names no persona — that
is, the A1 seal — behaves exactly as before.

## 4. What this does NOT fix

**The frozen presence readers cannot name the three defensive acts.** The
response schema they answer under was minted before v3.3:

    /private/tmp/adaptive-warrant-v3-schema-ping-62e4fd0a-r47-s514/response.schema.json
    sha 44b4807e25f0620e2677ed49031dec558daa6f0aeec0f20a97b85ec2c6cb6bc1

Machine-checked: it enumerates 15 acts. Missing are
`learner_overclaim_assertion`, `learner_evidence_dismissal`,
`learner_evidence_demand`. The seal records this rather than inheriting it
quietly.

What that costs, slot by slot:

- gate slots (a) and (b) read the live gate trace, not the readers. Unaffected.
- gate slot (c) needs the readers to run and agree. It does not need them to
  name a new act. Unaffected.
- registered endpoint 5, the defensive-act counts, is report-only. Under the
  frozen schema a defensive demand is absorbed into the nearest old act — the
  same mislabel smoke C showed. So endpoint 5 must come from the live
  extractor, not the frozen readers, or it must be dropped.

Minting a v3.3 response schema costs **one paid call** through the
schema-acceptance ping, whose own cap is 1. That call needs its own GO note and
its own approval. It is not part of the pilot's 1,116.

**Correction, 15 August.** The heading above is wrong, and so is the sentence
under it. The readers at HEAD **can** name the three defensive acts: the
preparer builds a fresh response schema per batch from the live act catalogue
(`scripts/prepare-adaptive-warrant-semantic-annotations.js:192`), and that
catalogue is v3.3. The acceptance artifact above is only checked for a `passed`
status; its schema never reaches a reader.

The real gap runs the other way. The readers answer under a **larger** schema
than the provider was ever tested against, and the launcher pin meant to catch
that compares the carried-over acceptance hash to the carried-over manifest pin
— two numbers from the same stale seal. It passes and proves nothing. The seal
now records `provider_response_schema_pin: inherited_unproved`
(`auditProviderResponseSchemaPin`), and clearing it is rung 0 of the pilot GO
note: one ping at v3.3, then a zero-call re-seal with `--schema-acceptance`.
The slot-by-slot reading above still stands — no gate slot depends on it.

**Resolved, 15 August: endpoint 5 moves to the live extractor. No call needed.**
The warrant gate already stores a validated v3.3 semantic-event extraction on
every decision, and it is the extraction the gate acted on, so the counts and
the gate agree by construction. `scripts/report-adaptive-warrant-defensive-acts.js`
reads it. On smoke C, all 8 turns are measurable and the run holds 7 over-claim
assertions, 1 evidence dismissal and 0 evidence demands. A turn the extractor
could not read is named as unmeasured; it never becomes a zero. Relay 110 §3
endpoint 5 is amended to say so.

## 5. Ledger fields are stale on purpose

The launcher asserts `planned_calls` against a frozen literal, so the four
counter fields are carried over by value. They record where the call counter
stood when A1 was sealed. They are flagged `stale: true` in the seal and must be
re-read at GO time.

## 6. Tests

`tests/adaptiveWarrantGuardedPilotReseal.test.js`, 13 tests: the A1 seal is
untouched and still a v3.2 seal; the guarded manifest re-pins exactly two
digests and inherits the rest; both manifests pass the launcher guard under
their own persona; the persona changes every prepared-run fingerprint; a
mismatched persona is refused from both sides; an undeclared program change is
refused; a declared non-change is refused; the drift classifier separates the
reflow from the real change; the response-schema gap is recorded.

## 7. Standing

NEVER push this branch.
