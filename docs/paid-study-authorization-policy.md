# Paid-Study Authorization Policy

Standing directive, 2026-08-22. Applies to every paid study registered
after this date. Revised 2026-09-03 to match the CLAUDE.md hard rule of
2026-08-21 ("NEVER build officious authorization"). Consumed historical
artifacts — requests, certificates, digests, authorization records — stay
exactly as they are: immutable evidence, never edited, never revalidated.

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

The same lesson applies to launch-time gates. Five predeclared gates plus a
digest-bound approval did not catch a real one-line instrument defect in the
boredom arc; the defect first ran in paid live running. A gate that would not
have caught a real defect is ceremony. The check that catches defects is a
regression test, not a signature.

## What a new paid study needs

Three things, and only these:

1. **A merged design file.** One file per study (markdown or YAML, under
   `config/` or `notes/`), merged to `main` before launch. It states the
   design: arms, scenarios, sample size, seed, models and judges,
   endpoints and thresholds, disposition rules for indeterminate or failed
   units, the attempt/spend ceiling, and the claim boundary. Everything
   the old registration carried, without the digest lists.
2. **A recorded launch commit.** The run launches from a commit that
   contains the design file. The runner writes that commit, its tree hash,
   and whether the checkout was dirty into the run ledger. This provenance
   is recorded, not enforced: the runner never refuses to run over a dirty
   tree, a branch checkout, or a later code commit. It refuses only a
   design file it cannot find at the named path.
3. **A signed GO note.** A note in `notes/` naming the design file path
   and the spend cap. Its first nonblank line is exactly `GO`; that
   structural declaration is authoritative, so incidental prose elsewhere
   in the note cannot revoke it. Integer ceilings are compared numerically,
   ignoring common thousands separators. The note may name the commit it
   was written against, for the record only. The approval is not bound to
   a commit SHA, a file digest, or a request-text hash. One signed note
   covers one study as registered — question, design, measurement rules,
   spend ceiling — including missing-work recovery of it, and stays valid
   until the study changes. A fix to a code defect after GO does not void
   it and needs no new signature. Nothing else licenses anything.

## What the shared runner enforces

These move out of per-study validators and into shared runner code,
tested once in CI:

- the ceiling from the design file, counted in attempts, fail-before-call;
- a create-once destination for each run or recovery segment;
- an append-only run ledger (commit, tree hash, dirty flag, seed,
  reservations, terminal attempt dispositions, pauses, resumptions, and
  failures);
- outcome-blind technical recovery and explicit operator pause under the
  unchanged study authorization, design, routes, seed, data scope, and hard
  ceiling; recovery resumes only missing work and never selects among outputs;
- a positive recovery reserve registered inside future hard ceilings, so an
  ordinary pause does not consume all completion capacity;
- the sealed archive to the private repo when the run ends.

These rails cost nothing at runtime and stay: spend ceilings, attended runs,
no resampling after a failure, no self-judging, indeterminate-means-stop.

New launchers use `services/paidStudyLaunchContract.js` to check the design
file and the GO note and to open the create-once destination, append-only run
ledger, and fail-before-call attempt budget before initializing a provider or
child process. `config/paid-study-launcher-inventory.json` records adoption and
the narrow historical/live-run exemptions; the inventory checker fails when a
new paid launcher is not classified. The helper records ordinary git
provenance in the ledger and does not refuse a launch over it. It does not
hash source files, create an authorization schema, or turn the GO note into a
second registration.

An explicit operator pause is a recoverable control event. A durable runner
moves through `pause_requested`, `paused`, and `resuming`, checkpoints at the
next safe boundary, and reports the exact missing-only resume scope. Every
reservation ends exactly once as `completed`, `failed`,
`cancelled_before_dispatch`, or `interrupted_after_dispatch`; a restart
reconciles stale reservations before dispatching new work. Dispatched attempts
remain charged to the original hard ceiling. A durably persisted response is
accepted once without redispatch. Scientific completeness requires zero
unexplained reservations, not zero interruptions.

### Resume horizon and dispatch invariant

A resumed automated dialogue interprets its configured turn count as the total
dialogue horizon. The runner must carry the actual resume request across the
CLI/application boundary into turn orchestration. Independently, the shared
dispatch ledger receives the registered maximum turn and rejects any attempt
above it before reservation and provider dispatch. This gives the horizon the
same fail-before-call protection as the spend ceiling.

Tests for a resumed runner cross the public application boundary and also prove
the dispatch ledger refuses an over-horizon turn without consuming a
reservation. If a process is interrupted, sealing it reconciles all durable
per-dispatch reservations and counts completed, failed, cancelled, and
interrupted attempts before admitting a fresh missing-work-only recovery.

## What is retired for new studies

Request JSONs with executable-closure digest lists; endpoint preflight
certificates; consumed-authorization records; HOLD packets; digest-bound
GO-request validators; and every re-pin PR they generate. Do not build
new instances of any of these.

Also banned, from the CLAUDE.md rule of 2026-08-21:

- binding an approval to a commit SHA, a file digest, or a request-text hash;
- freezing a request, voiding it after a fix, then asking for a new signature;
- byte-pinning source files, so that correcting a bug reads as a design change;
- authorization schema versions, GO-request packagers, re-approval ceremonies;
- a launch refusal over a dirty tree, a branch checkout, or a code commit
  made after the GO.

Byte pins are for sealed data inputs only (a held-out corpus, a validation
certificate). Never for code, never for the registration. A pin that
recomputes its own expectation is worse than no pin; delete it.

Also banned, from the CLAUDE.md rule of 2026-09-03: a new numbered sibling
file for a design, judge prompt, adjudicator, or corpus (`foo.v7.json`,
`FooV8.js`). Amend the file in place and commit. A new study gets a new
name. The structural ratchet (`npm run test:ratchets`) counts numbered
siblings under `config/`, `services/`, and `scripts/` and fails when a
count goes up. The historical GO-request checker and packager were deleted
on the same date (PR after #991); the consumed request JSONs under `config/`
stay as records.

## What replaces the tamper check

Git and the reviewer. A design file changed after signing is a new commit.
The run ledger records which commit ran; a reviewer diffs the design at that
commit against the design as signed. If the design differs, the study
changed and that GO does not cover the run. If only code differs, the study
did not change and the GO stands. Committing the signed note records
authorization without changing anything it names; there is no self-reference
or re-signing loop. Reviewers check diffs, not digests.

## What does not change

The scientific discipline lives in the design file and is untouched:
prospective registration before data, fail-closed dispositions, no
post-hoc threshold changes, no pooling across corpora or incomplete
blocks, claim boundaries, and the amendment rule — when the study changes,
change the design file, merge it, sign a fresh GO note. A code-defect fix
is not an amendment. Amendments remain prospective only.

## Revisions

- 2026-08-22: standing directive.
- 2026-09-03: aligned with the CLAUDE.md rule of 2026-08-21. Launch
  provenance is recorded, not enforced. The GO covers the study and
  survives code-defect fixes. No approval is bound to a SHA, a digest, or a
  request-text hash. `services/paidStudyLaunchContract.js` still refuses a
  dirty tree and a branch checkout; that refusal is out of policy and is to
  be reduced to recording, with its tests.
