# 068a — Reviewer GO note: outcome-study pilot block

**Date:** 13 August 2026. Authority: ruling + direction 068, ruling 064a,
report 066 (two-sided review PASS), Amendment 1, the frozen pilot manifest.

**GO** for the pilot block only:

- Executable entry point: `scripts/run-adaptive-warrant-outcome-pilot.js`,
  built at commit `67c4cf6d`, launched at the HEAD that contains the
  068-directed input-seam amendment (diff confined to the input seam and
  its tests; reviewer checks the diff post-run).
- Scope: 18 dialogues (6 bare / 6 gated / 6 standing-permission), seeds
  515–517, frozen manifest order, 144 expected cases, 2+2 fresh readers
  per case, caps 42,000/14,000, reader concurrency two, run-record path
  always passed. Plan: 18 + 288 + 288 = **594** calls.
- Plus ONE schema-acceptance ping call authorized by ruling 068:
  total spend **595**; counter 3,523 → 4,118 of 11,337.
- Analyses cite the consensus value, never a single reader's value.
- The post-generation `annotationCaseFingerprint` guard is mandatory
  before any reader call.
- The 72-dialogue main block stays UNAUTHORIZED; it needs its own go note
  after the pilot ruling.

GO note 063a stays consumed. If any launch guard refuses: stop, report,
commit, end — do not amend anything beyond this note's stated scope.
