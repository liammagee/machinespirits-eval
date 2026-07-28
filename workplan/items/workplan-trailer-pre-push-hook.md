---
id: workplan-trailer-pre-push-hook
title: Report unlinked commits before the push, not after
status: done
type: infra
priority: P3
owner: claude
source: manual
created: 2026-07-28
updated: 2026-07-28
verification: "Installing the hook preserves and chains any existing pre-push hook in either install order; a push to main carrying a commit with no workplan trailer prints the same report CI would print and still completes; a push to any other ref runs no check; flipping WORKPLAN_TRAILER_HOOK_ENFORCEMENT=blocking rejects the push."
claim_status: methods
links:
  notes:
    - workplan/playbook/git-and-workflow.md
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/325
tags:
  - workplan
  - ci
  - git-hooks
milestone: board-pm
branch: claude/workplan-trailer-prepush
---

`scripts/check-commit-workplan-trailer.js` runs in CI on `push`. That timing is
the problem it cannot solve for itself: by the time it reports, the commit is on
main and the message can no longer be amended, so the only remaining fix is
recording the commit on a card after the fact. The check's own docstring already
points at the answer — run it with `--range origin/main..HEAD` before pushing —
but nothing made that happen.

This adds a pre-push link that does it automatically:

- `services/workplanTrailerPrePushHook.js` — wrapper renderer, installer,
  stdin parser, ref-range selection, enforcement classification.
- `scripts/workplan-trailer-hook.js` — `install` / `uninstall` / `pre-push`.
- `npm run wp:trailer-hook:install`, `npm run wp:trailer-hook:uninstall`.

**Report-only by design.** It always exits 0 unless
`WORKPLAN_TRAILER_HOOK_ENFORCEMENT=blocking` is set. A hook that rejects pushes
changes how everyone works, and the trailer rule is new enough that its false-fire
rate on legitimate work is unknown. Reporting first lets that be measured before
anyone decides to gate on it. It also makes the link order-independent in the
hook chain, since a check that can never fail cannot be defeated by running in
the wrong position.

**Scope is deliberately narrow.** Only checks whose verdict depends solely on
what is being pushed belong in a pre-push hook. The trailer rule qualifies — it
reads the commits in the pushed range and nothing else. `refs:check`,
`skills:permissions:check` and the test suite do not: they fail repo-wide from
work done outside any one push, so putting them here would reject pushes for
reasons the pusher did not cause.

Follow-ups, neither blocking:

- The wrapper/sidecar mechanics duplicate `services/tutorStubPrBenchmarkHook.js`.
  They were copied rather than shared because that module is under active
  refactoring (`codebase-refactoring-program`). Extracting a common installer is
  worth doing once that settles.
- Whether to move to `blocking` is a calibration question, answerable only after
  the report has run for a while. Revisit with evidence, not preference.
- `check-commit-workplan-trailer.js` resolves card ids from `workplan/items/` on
  disk, not from the pushed commit's own tree. When you push the branch you are
  checked out on — the normal case, and what CI does — those are the same thing.
  Pushing a branch you are not on (`git push origin other-branch:main`) resolves
  ids against the wrong tree and can report a linked commit as unlinked. Report-only
  makes that a false alarm rather than a blocked push, which is one more reason
  not to gate on it yet.

## Log

2026-07-28 — merged as PR #325, all 10 CI checks green. Verification met by
the 11 tests in `tests/workplanTrailerPrePushHook.test.js`: chaining holds in
both install orders, a preserved hook's non-zero exit short-circuits before
this one runs, a push to a non-protected ref runs no check, and the same
failing range reports under the default and rejects under
`WORKPLAN_TRAILER_HOOK_ENFORCEMENT=blocking`.

Installing it in a given checkout stays a manual step. The installer renames
the incumbent hook to a sidecar, and an agent sandbox that forbids writes
under `.git/hooks` can create that file but not set its exec bit, which
leaves a chain that rejects every push. Run `npm run wp:trailer-hook:install`
yourself rather than from a sandboxed shell.
