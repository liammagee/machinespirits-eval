# Launch protocol v2 — one approval, one preflight

Operator directive 2026-08-23. Applies from the next paid study. Do not touch
the live Gate 1 launcher or run.

## Removed

- GO/DRAFT note parsing; digest matching against note text; the
  note-commit-must-descend-from-launch-commit check; re-signature after a code
  fix; the separate dry-run round trip before signing; the clean detached
  worktree requirement.

## Kept, in code, as hard rails

- Fail-before-call spend ceiling.
- Create-once destination; failed roots preserved, never reused or pooled.
- Typed kill rules and floors frozen in the design file.
- Attended run; no resample after failure; generator excluded from voting.

## The flow — one attended invocation

1. Load both designs; validate against schema; check every world named in a
   design exists in the world catalog (the defect that caused stop 1).
2. Build the model-route table from the designs alone and ping each CLI route
   at zero cost. The child invocation is built from this same table, so an
   undeclared route cannot run (the defect that caused stop 2).
3. Refuse if planned calls exceed the ceiling. Destination must be absent.
4. Print one screen: study, design paths with computed digests, route table,
   job count, planned calls, ceiling, destination.
5. Ask once for typed approval (or `--signed-by "Name"` in an attended
   terminal). Write `approval.json` into the run root: who, when, commit,
   dirty flag, digests, routes, cap. This file is the authorization record.
6. Spend.

`--dry-run` = steps 1–4, then exit with zero calls.

## Human rules — protocol doc, not code

- One approval covers the study: its question, design, measurement rules and
  ceiling. Re-ask only if one of those changes. A code fix never voids it.
- Provenance is recorded, not enforced: commit and dirty flag go into
  `approval.json`; a dirty tree warns, it does not refuse.
