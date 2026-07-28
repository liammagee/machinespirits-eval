---
id: workplan-commit-trailer-check
title: Commit-trailer check for work pushed straight to main
status: review
type: infra
priority: P2
owner: claude
source: manual
created: 2026-07-27
updated: 2026-07-27
verification: >-
  `npm run wp:commit-link` reads a commit message with the same grammar
  `wp:pr-link` reads a PR body, accepting `Workplan-item:` and `Workplan item:`
  and explicit N/A and rejecting an id no card defines; it walks the
  first-parent line only, exempts merge commits, squash-merge subjects and
  `workplan/`-only commits, and fails naming each unlinked commit; a push-to-main
  workflow runs it unfiltered by path; replayed over `2026-07-22..origin/main` it
  classifies 220 of 234 first-parent commits as exempt and reports exactly the 14
  direct pushes the board audit found by hand.
claim_status: planned
branch: claude/workplan-commit-trailer-check
links:
  code:
    - scripts/check-commit-workplan-trailer.js
    - scripts/lib/workplanLink.js
    - scripts/check-pr-workplan-link.js
    - .github/workflows/workplan-commit-trailer.yml
    - tests/workplan.test.js
  items:
    - big-picture-state-of-the-nation-skill-and-board-traceability
tags:
  - workplan
  - governance
  - ci
---

`wp:pr-link` asks every pull request which card it belongs to, and
`.github/workflows/workplan-validate.yml` gates that step on `pull_request`
events. Nothing asked the same of work pushed straight to `main`. The
[[big-picture-state-of-the-nation-skill-and-board-traceability]] audit found
fourteen such commits on the first-parent line since 2026-07-22 — all real work,
all traceable to a card by hand, none of it recorded anywhere a tool could see.

This is option 1 from that card: keep the fast lane, make it checkable.

**The grammar is shared, not duplicated.** `scripts/lib/workplanLink.js` now owns
what counts as a link, and both `check-pr-workplan-link.js` and the new
`check-commit-workplan-trailer.js` read it. A link valid on one surface is valid
on the other; the alternative is two rules and agents following neither. The one
widening: the git trailer spelling `Workplan-item:` now parses everywhere, so a
message written with `git commit --trailer` is canonical rather than tolerated.

**It walks `--first-parent` only.** A merge brings a branch's commits onto main
and those were reviewed as a PR, so demanding a trailer on each would make an
author write the link once per commit. On the first-parent line the distinction
this check needs falls out for free: merges are PR arrivals, non-merges are
direct pushes.

**Exemptions are path-based where they can be.** A commit whose files are all
under `workplan/` is the record itself and cannot be asked to cite a record —
that covers the renderer bot and card maintenance without trusting a subject
prefix anyone could type. The one convention-trust left is GitHub's `(#123)`
squash-merge subject; it is exempted and printed, so a suspicious one is visible
in the log rather than silent.

**It is a tripwire, not a gate.** It runs on `push` to `main`, after the fact,
and cannot block anything. A red run means a commit reached main with no card
behind it, and the remedy is to record it on a card by hand — you cannot amend a
commit that is already on main. The affordance that actually prevents the
situation is local:

```bash
npm run wp:commit-link -- --range origin/main..HEAD
```

The workflow is deliberately a separate file with no `paths:` filter.
`workplan-validate.yml`'s push trigger is filtered to workplan-ish paths, which
excludes precisely the application-code commits this exists to catch.

**Not done here, deliberately.** No git hook. The repo already has a chainable
pre-push hook pattern (`scripts/tutor-pr-benchmark-hook.js`, with
`install`/`uninstall` and a `pre-push.machinespirits-before-*` chain), so wiring
this in as a second link is cheap and would move the check from after-the-fact
to genuinely preventive. It is not built because a hook that rejects pushes is a
bigger change to how everyone works than a check that reports, and that is the
maintainer's call. Branch protection — option 2 on the parent card — remains
untaken, along with its trap: the renderer in `workplan-render-main.yml` pushes
`HEAD:main` as `github-actions[bot]`, so protection without a bypass actor for
it stops the board publishing.

**Adoption.** The convention is in `workplan/README.md` under "The one rule" and
mirrored into `CLAUDE.md` and `AGENTS.md`, since a convention no agent reads is
not implemented. The fourteen historical commits are left as they are; they are
already recorded on the parent card.
