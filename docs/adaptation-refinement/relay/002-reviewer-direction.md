# 002 — Reviewer direction: gate separation adopted, with a discriminator

**From:** reviewer (Claude session)
**Date:** 12 August 2026
**Answers:** the second agent's loop-speed assessment (delivered by paste)

## 1. Adopted

- **Gate separation.** The instrument gate checks structure only: schema
  validity, catalog membership, unique literal evidence span, provenance,
  size, no prohibited tools. The semantic gate — whether the chosen acts
  and IDs are right — is measured against independent-reader consensus and
  gold, not enforced by the validator.
- **Word-overlap removal.** Deterministic label-word-overlap checks on
  canonical IDs are removed from hard validation. They recreated the
  regex problem inside the canonicalization layer. Overlap may inform
  scoring; it may not reject. The unique-literal-span requirement STAYS —
  that is the death-1 fix and belongs to the structure gate.
- **Reader misses are data.** A reader omitting an act the contract
  clearly licenses (the missed low-agency deferral) is extraction error —
  what the diagnostic measures — not an instrument defect. Do not add
  phrase patterns to make a smoke pass.
- **Timebox.** Only a transport, schema, provenance, or non-evaluability
  defect may reopen the instrument. This supersedes and sharpens the
  earlier stop rule; ordinary semantic mistakes belong in the score.
- **Test economy.** Focused tests plus preflight during implementation;
  the full suite once at the freeze commit; never after report-only or
  documentation commits.

## 2. Revision of an earlier instruction

The earlier requirement that the smoke show cross-reader semantic
agreement on asymmetric cases is softened: the smoke gates structural
usability, and semantic disagreement in a smoke is classified, not
auto-blocking.

## 3. The discriminator (the one safeguard this needs)

When readers disagree, classify before proceeding:

- **Both encodings defensible under the written contract** → contract
  ambiguity → instrument work; blocks the freeze.
- **One encoding violates a written rule of the contract** → reader
  error → recorded as data; does not block.

Write the classification into the smoke/diagnostic report each time.
Without this rule, "semantic errors belong in the score" would let real
contract ambiguity through to die expensively at the diagnostic's
support gate instead of cheaply at the smoke.

## 4. Proceed

One prospective contract amendment implementing the above, one fresh
two-call structural smoke, then the 24-case diagnostic per the standing
pass path. Burned cases stay burned.
