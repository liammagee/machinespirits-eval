---
name: ms-big-picture
description: State-of-the-nation report and off-the-rails audit — board health, velocity, paper stability, CI, and standing-discipline checks. Read-only and free by default; pass "deep" to also run the deterministic validators.
argument-hint: [deep] [days=14] [save]
---

Produce a big-picture report on the whole programme: where the research stands, where
the engineering stands, and whether the current work is still governed by the board,
the paper discipline, and CI. The point is perspective during heads-down phases (QA,
refactoring, rubric surgery) when it is easy to lose sight of the arc.

Ground rules:

- **Read-only by default.** Gather facts with the commands below. Never start eval
  runs, never call paid APIs, never run `npm test` from this skill. If a check fails,
  recommend the follow-up command instead of running it.
- **In-repo sources only** (board, paper, git, gh). Auto-memory may be used as a
  secondary cross-check for closed arcs, but the board lanes and the paper changelog
  are authoritative.
- **Fixed report shape** (below), so successive reports are comparable.
- Default window is 14 days; a number in `$ARGUMENTS` overrides it.

## 1. Gather facts

```bash
DAYS=14   # override from arguments

# Board (generated header carries counts + timestamp; items/ is source of truth)
sed -n '2,7p' workplan/BOARD.md
node scripts/workplan.js list --status active
node scripts/workplan.js list --status review
node scripts/workplan.js list --blocked
node scripts/workplan.js list --status triaged

# Velocity and work mix
git log --since="$DAYS days ago" --oneline | wc -l
git log --since="$DAYS days ago" --oneline --grep="Merge pull request" | wc -l
git log --since="$DAYS days ago" --no-merges --format=%s | grep -oE '^[a-z]+' | sort | uniq -c | sort -rn | head -8

# Direct-to-main work: first-parent, non-merge commits that are neither the
# serialized board renderer nor workplan card maintenance (both sanctioned).
# `wp:pr-link` only runs on pull_request events, so these skipped the
# card-link check — they are unlinked, not necessarily ungoverned.
git log --first-parent --since="$DAYS days ago" --no-merges --format="%h %s" | grep -vE " (workplan:|chore\(workplan\):)"

# For each one, decide whether a card actually covers it. Cards rarely record
# SHAs, so match on the files it touched and on topic:
git show --stat --format="" <sha> | head
grep -rl "<a service or script the commit added>" workplan/items/

# CI and open queue
gh run list --limit 10 | cat
gh pr list --limit 15 | cat

# Paper: current version, then the newest entries in Appendix F.
# NOTE: the changelog is NOT in file order — sort by version, then read the top
# entries by locating their lines.
grep -m1 '^version:' docs/research/paper-full-2.0.md
grep -oE '^\*\*v[0-9.]+\*\* \([0-9-]+\)' docs/research/paper-full-2.0.md | sort -V | tail -6

# Research-roundup cadence
ls notes/daily-notes/ | tail -5
```

Then Read the 3–5 newest revision entries in full (grep the version string for its
line number, read ~8 lines each) and classify each one:

- **claim-changing** — adds a §, adds/edits numbers, N-counts, run IDs, verdicts;
- **audit-correction** — a claim audit or independent re-derivation fixed a stated figure;
- **hygiene** — cross-references, framing, agenda reconciliation, formatting.

## 2. Rails checks

Score each pass / warn / fail with one line of evidence.

- **R1 — All work is board-governed.** Ask whether each direct-to-main commit is
  *covered by a card*, not merely whether it went through a PR — the PR route is the
  enforcement mechanism, card coverage is the invariant. A commit with no card behind
  it is a governance gap: fail, name it, and propose the card. A commit whose card
  exists but never records it is a traceability gap: warn, and say the branch
  protection / trailer options are the durable fix. Note in the report that
  direct-to-main pushes still run the full CI suite (`test.yml` triggers on push to
  main); only `wp:pr-link` and the source-only generated check are skipped.
- **R2 — Paper moves only deliberately.** Every claim-changing entry in the window
  states its provenance (pre-registration tier, run IDs) and has a board card.
  Audit-corrections are a *good* sign (the checking machinery firing), not a failure.
  Silent number changes without a changelog entry: fail. Quiet paper during an
  engineering burst: pass.
- **R3 — Closed arcs stay closed.** No active or triaged card re-opens work whose
  lane or `claim_status` is settled, killed, archived, or dropped. Check ids/titles of
  the open set against those lanes; when in doubt Read the item's frontmatter.
- **R4 — Blocked means external.** Every blocked card's blocker names a dependency
  outside the codebase (IRB, human coders, corpus growth, a killed prerequisite).
  An engineering blocker hiding in the blocked lane, or a blocked card untouched
  for >30 days with no note: warn.
- **R5 — Green and fresh.** Latest main CI runs green; `BOARD.md` generated
  timestamp within ~48h of the last merge; renders happen on main only. Before
  blaming a red lane on the PR under it, check whether main's own latest run is
  red the same way — some checks compare a committed generated file against live
  repo state, so an action taken outside any PR turns every open PR red at once.
  `docs/ref-status.md` is the known instance: pushing a tag by hand makes
  `npm run refs:check` fail on every branch until someone runs
  `npm run refs:render` and commits. Report a repo-wide red as one finding with
  one owner, not as a fault in each PR that inherits it.
- **R6 — WIP is bounded.** triaged+active+review ≤ ~25; review lane ≤ ~8; no review
  card whose PR already merged (spot-check card ids against the recent merge log) —
  merged-but-still-in-review cards: warn, list them.
- **R7 — Standing disciplines hold.** Spot-check, don't exhaustively audit: rubric
  changes are versioned (new version id / relabel, never in-place edits); the
  nemotron/kimi default warning is still wired (`services/stackDefaultWarning.js`);
  generated views carry the GENERATED header and only renderer commits touch them.

## 3. Deep mode (only when `$ARGUMENTS` contains "deep")

Additionally run the deterministic validators and fold their verdicts into R2/R5:

```bash
npm run wp:check          # on main; use npm run wp:source-check on a feature branch
node scripts/eval-cli.js validate-config
npm run provenance:validate
node scripts/validate-paper-manifest.js
```

Still no test suite and no paid calls: if a validator fails, report it and recommend
the fix, don't escalate.

## 4. Report shape (mandatory)

1. **Verdict paragraph first** — "on rails" or "drifting", plus the single biggest
   risk, in plain sentences.
2. **Where the programme is** — two short paragraphs: the research phase (what the
   paper's newest entries show it is doing), then the engineering phase (what the
   commit mix and active cards show).
3. **Status table** — board lanes, open PRs, CI, commits + merged PRs in window,
   work mix, paper version + date of last claim-changing entry, last roundup date.
4. **Rails table** — R1–R7, verdict + one-line evidence each.
5. **Watch items** — numbered, max 5, each one sentence ending in a concrete action.
6. **One-sentence close.**

Style: plain sentences throughout; no coined shorthand, no arrow chains, never the
word "honest"/"honestly". If run on a feature branch or a dirty tree, say so at the
top. If `$ARGUMENTS` contains "save", also write the report to
`notes/big-picture/YYYY-MM-DD.md` (create the directory if needed).
