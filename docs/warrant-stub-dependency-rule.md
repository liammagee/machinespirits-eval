# Dependency rule: warrant modules and tutor-stub

**Date stated:** 16 August 2026.
**Card:** `warrant-stub-dependency-boundary-rule`.
**Enforced by:** `tests/warrantStubDependencyBoundary.test.js`.

## The rule

The warrant layer — the warrant-gate, action-contract, and
obligation-ledger modules (`services/adaptiveWarrant*.js`) — must not
import tutor-stub files (`services/tutorStub*.js`).

The other direction is allowed: tutor-stub files may import warrant
modules freely.

## Why

The warrant layer decides if the tutor may change its plan. The survey
note (`notes/2026-08-16-harness-reconciliation-survey.md`) found that
this layer is meant to be general, but back-imports tie it to the
tutor-stub runtime. With back-imports in place, the cell world cannot
use the warrant layer on its own, and each change can tighten the knot.
The tutor-core seam shows the working pattern: a stated one-way rule
plus an enforcing test keeps a layer extractable.

## The ratchet

Today's back-imports are frozen in an allowlist inside the test. The
list may only shrink:

- a new back-import fails the test;
- a removed back-import must also be removed from the allowlist, or the
  test fails as stale.

Comments and plain path strings do not count; only real `import`,
`export ... from`, and dynamic `import()` edges do.

## What waits

Removing the listed back-imports is the later extraction step of the
staged reconciliation path. It waits until the live warrant validation
line (card
`adaptive-warrant-public-obligation-ledger-and-inquiry-termin`) closes,
because that line fingerprints the exact files an extraction would
move. This rule and test add files only; they edit nothing inside that
fingerprinted set.
