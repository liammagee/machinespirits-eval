# Paid-Study Authorization Policy

Standing directive, 2026-08-22. Applies to every paid study registered
after this date. Consumed historical artifacts — requests, certificates,
digests, authorization records — stay exactly as they are: immutable
evidence, never edited, never revalidated.

## Why

The digest-bound request machinery (per-file SHA-256 closures, endpoint
certificates, HOLD packets, consumed-authorization records, digest-bound
validators) re-builds inside JSON files what git already does with one
commit hash. Its cost is measured: any legitimate runtime change — a Node
version, a dependency, a lint pass — breaks a digest somewhere and forces
a re-pin PR, and the 2026-08-21/22 window produced about thirty such PRs.
The two real integrity catches it made that week (a calibration PR editing
pinned inputs; V6 wiring touching a consumed V3 request) are both visible
in a plain git diff review. The protections are worth keeping; this
transport for them is not.

## What a new paid study needs

Three things, and only these:

1. **A merged design file.** One file per study (markdown or YAML, under
   `config/` or `notes/`), merged to `main` before launch. It states the
   design: arms, scenarios, sample size, seed, models and judges,
   endpoints and thresholds, disposition rules for indeterminate or failed
   units, the attempt/spend ceiling, and the claim boundary. Everything
   the old registration carried, without the digest lists.
2. **A launch commit.** The run launches from a clean, detached checkout
   of a named commit that contains the design file. The runner records
   that commit in the run ledger and refuses a dirty tree or a mismatched
   design path.
3. **A signed GO note.** A note in `notes/` naming the design file path,
   the launch commit, and the spend cap. Its first nonblank line is exactly
   `GO`; that structural declaration is authoritative, so incidental prose
   elsewhere in the note cannot revoke it. Integer ceilings are compared
   numerically, ignoring common thousands separators. The commit recording
   the signed note may descend from the frozen launch commit, but it is not a
   new launch commit and the note never names its own commit. One signed note
   licenses one launch. Nothing else licenses anything.

## What the shared runner enforces

These move out of per-study validators and into shared runner code,
tested once in CI:

- the ceiling from the design file, counted in attempts, fail-before-call;
- a create-once destination; no resume, rerun, replacement, or selection
  without a fresh GO note;
- an append-only run ledger (commit, seed, calls, failures);
- the sealed archive to the private repo when the run ends.

## What is retired for new studies

Request JSONs with executable-closure digest lists; endpoint preflight
certificates; consumed-authorization records; HOLD packets; digest-bound
GO-request validators; and every re-pin PR they generate. Do not build
new instances of any of these.

## What replaces the tamper check

Git. A design file changed after signing is a new commit; a run whose
recorded launch commit does not contain the signed design file as signed
is void. Committing the signed note records authorization without changing the
launch commit it names; there is no self-reference or re-signing loop.
Reviewers check diffs, not digests.

## What does not change

The scientific discipline lives in the design file and is untouched:
prospective registration before data, fail-closed dispositions, no
post-hoc threshold changes, no pooling across corpora or incomplete
blocks, claim boundaries, and the amendment rule — change the design
file, merge it, sign a fresh GO note. Amendments remain prospective only.
