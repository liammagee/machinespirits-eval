# Workplan — the project's single working board

This folder is the **single source of truth for todos** across the whole project:
TODO items, daily-routine ideas, experiments, infra, paper tasks, maintenance.
It is meant to be read and written by every surface that touches the project —
humans, Claude Code, Codex, skills, the daily routine, the CLI, and the
scriptorium dashboard.

It exists because the project is large and the work was scattered across
`TODO.md`, dated `notes/`, daily-routine HTML, and the in-session task list.
This folder consolidates the *live work* into one structured, queryable place
without re-deriving the design history those other files hold.

## The one rule

**`workplan/` is the todo system; `items/` is the write source;
`BOARD.md` is the generated readable board.** Everything else is either a
derived view, historical context, or a cross-link. Concretely:

- One work item = one markdown file in `items/` with YAML frontmatter.
  Merge-friendly (two agents can add items on two branches without conflict),
  diffable, greppable.
- `BOARD.md` is the canonical human-readable board and `board.json` is the
  dashboard/machine view. Both are **generated** from `items/` by
  `scripts/workplan.js render`. Never hand-edit them.
- We **link, never copy.** An item points at the paper §, the `notes/` design
  doc, the `exports/` report, the run IDs, the atlas module, the PR. It does not
  restate them. `TODO.md` and `notes/` stay design history and rationale; they
  are not live todo boards.

If you find yourself pasting content that already lives in the paper, a note, or
an export, stop and link to it instead.

## Folder layout

```
workplan/
  README.md            ← this file: the contract every surface follows
  BOARD.md             ← generated rollup (human-readable). Do not edit.
  board.json           ← generated rollup (machine / dashboard). Do not edit.
  schema/
    item.schema.json   ← JSON Schema for item frontmatter (the CLI validates against it)
  items/
    <slug>.md          ← one work item each (the source of truth)
  inbox/
    README.md          ← the capture queue: where routines + quick notes land before triage
    <date>-<slug>.md   ← raw, un-triaged captures (daily-routine actions, dr/by-the-way ideas)
  playbook/
    git-and-workflow.md   ← branches, commits, PRs, worktrees, the daily-routine PR flow
    paper-lifecycle.md    ← claim → script → export → paper fold-in → version → atlas → publish
    research-atlas.md     ← the atlas manifest + claim-status grammar
    quality.md            ← QA, testing, verifiability (what "done" must prove)
```

## Item lifecycle

A small set of states. Most items move left-to-right; some get parked or dropped.

```
inbox  ->  triaged  ->  active  ->  review  ->  done  ->  archived
                          |                      ^
                          +--> blocked ----------+
                          +--> dropped
```

| state | meaning |
|---|---|
| `inbox` | captured, not yet shaped. Lives in `inbox/` until triaged. |
| `triaged` | shaped into a real item (has type, priority, verification) but not started. |
| `active` | someone is working it now (`owner` set, usually a `branch`). |
| `blocked` | can't proceed; `blocked_by` says why (another item, an external gate, budget). |
| `review` | work done, awaiting verification / PR review / cross-judge / human gate. |
| `done` | verification passed. For research items, the claim is folded into the paper. |
| `archived` | done + folded + no longer needs to be on the board. Kept for history. |
| `dropped` | decided not to do. Keep the file with a one-line reason — a "no" is a result. |

"Done" is not "I wrote the code." See `playbook/quality.md`: **every item declares
how its completion is checked, and that check has to actually pass.**

## Item schema (frontmatter)

Full machine schema in `schema/item.schema.json`. The fields:

| field | required | values / form | notes |
|---|---|---|---|
| `id` | yes | kebab slug, matches filename | stable; don't rename once referenced |
| `title` | yes | one line | |
| `status` | yes | `inbox`/`triaged`/`active`/`blocked`/`review`/`done`/`archived`/`dropped` | |
| `type` | yes | `experiment`/`infra`/`maintenance`/`research`/`paper`/`content`/`ops` | |
| `priority` | yes | `P0`/`P1`/`P2`/`P3` | P0 = drop-everything; P3 = someday |
| `owner` | yes | `human`/`claude`/`codex`/`gemini`/`unassigned` | who's driving it now |
| `source` | yes | `todo`/`daily-routine`/`manual`/`review`/`paper` | provenance of the idea |
| `created` | yes | `YYYY-MM-DD` | |
| `updated` | yes | `YYYY-MM-DD` | bump on every status change |
| `verification` | yes | one line | how we'll know it's actually done (see quality.md) |
| `branch` | no | git branch name | set when `active` |
| `blocked_by` | no | item id, or free text | required when `status: blocked` |
| `claim_status` | no | atlas grammar: `settled`/`scope-bound`/`exploratory`/`killed`/`speculative`/`methods`/`planned`/`future` | for research/paper items that yield a claim |
| `links` | no | map: `paper`, `notes`, `exports`, `runs`, `prs`, `atlas`, `items` | cross-links, never copies |
| `tags` | no | list | free, for filtering |
| `depends_on` | no | list of item ids | shown on the board; flagged until each dep is `done`; cycles rejected |
| `milestone` | no | milestone id (see `milestones.yaml`) | groups the item under a timeline milestone |

The body is free markdown: context, acceptance criteria, and a running log
(date-stamped lines). Keep it short — link out for detail.

## Web UI — editable board + timeline

The board renders as a live web UI (the same surface in the browser dev server and
the Scriptorium desktop app), backed by the **same write path as the CLI**:

- **`/board`** — a kanban by status. Drag a card between lanes to change its status;
  click a card to edit every field (including **milestone** and **depends on**); the
  lane **+** adds an item; **Delete** removes one. Writes land in `items/` and
  re-render `board.json`.
- **`/timeline`** — milestones from `milestones.yaml` (id, title, target date, status,
  optional git `tag`) with a progress bar over each milestone's items, plus a live
  **GitHub** panel (open PRs, releases/tags, recent commits) for the `origin` repo via
  the `gh` CLI. Items link to their `branch` on GitHub; add/edit milestones inline.

`milestones.yaml` is the source of truth for milestones (manage from `/timeline` or by
hand). All web writes need the repo on disk — a packaged desktop app's board is
read-only.

## The surfaces (the contract)

Everyone reads this README first, then:

1. **Agents (Claude Code, Codex, Gemini).** Read `items/` + `playbook/`. Create
   and edit item files directly — they're plain markdown. Set `owner` to
   yourself and `branch` when you pick one up. The CLI (`add`/`triage`/`set`)
   auto-renders the views; only run `workplan render` after hand-editing item
   files. Follow the playbook; if you deviate, say so in the item log.

2. **CLI (`scripts/workplan.js`).** The programmatic surface:
   `list`, `show <id>`, `add`, `triage <inbox-file>`, `set <id> <field> <value>`,
   `validate` (frontmatter ⇄ schema), `check` (validate items and prove the
   generated board files are current), `render` (regenerate `BOARD.md` +
   `board.json`), `ingest` (pull from `TODO.md` + `notes/daily-notes/`). Wired
   into `npm run wp:*`.

3. **Skill (`/ms-workplan`).** The conversational entry. Routes a request
   ("what's active?", "capture this", "what's blocked on budget?") to the right
   CLI command and explains the conventions. Definition:
   `.claude/skills/ms-workplan/SKILL.md`, mirrored to
   `.agents/skills/ms-workplan/SKILL.md` and `.codex/skills/ms-workplan/SKILL.md`
   by `npm run skills:sync` (`config/agent-skill-sync.json` is the mirror list).

4. **Routines (daily research roundup).** Each paper's "Project relevance" note
   is dropped into `inbox/` as `<date>-arxiv-<id>.md`, de-duped by arXiv id the
   same way the roundup de-dupes. This is automated by
   `.github/workflows/workplan-ingest.yml`, which runs `wp:ingest --daily` when a
   roundup PR opens and commits the captures to that PR. They sit in `inbox/`
   until a human or agent triages them into `items/` — the routine never writes
   straight to `items/`, so capture and commitment stay separate on purpose.

5. **GitHub.** GitHub is an integration surface, not the source of truth.
   `.github/workflows/workplan-validate.yml` runs `npm run wp:check`,
   `npm run wp:test`, and the PR workplan-link check. The PR template requires
   `Workplan item: <id or N/A>`, validated by
   `scripts/check-pr-workplan-link.js`. `.github/workflows/workplan-github-mirror.yml`
   can manually mirror selected statuses (default: `active,blocked`) to GitHub
   Issues through `scripts/workplan-github-mirror.js`; it dry-runs unless the
   workflow input or local command passes `--apply`. Those issues carry a
   `<!-- workplan-id: ... -->` marker and point back to the item file.

6. **Scriptorium dashboard.** Reads the generated `board.json` and serves the
   editable `/board` plus the GitHub-aware `/timeline` when running from a repo
   checkout. Mutations still go through the same item-file write path as the CLI,
   so the dashboard, generated board, and item files stay aligned.

## How this relates to what already exists

This folder **replaces scattered todo tracking** while still pointing at the
older context:

- **`TODO.md`** — archived design reference / sweep history. Open items from it
  have been ported into `items/` with `source: todo` and a link back. New work
  is captured in `workplan/items/`, not appended to `TODO.md`.
- **`notes/` and `notes/poetics/`** — dated design notes and arc ledgers. Items
  link to the relevant note; the note keeps the reasoning.
- **`notes/daily-notes/`** — the research roundups. Their actions flow into
  `inbox/`. The tiling/dedup convention there is unchanged.
- **`docs/research/atlas/`** — the published research atlas. Research items reuse
  its `claim_status` grammar and link to the atlas module they feed.
- **provable-discourse** (`npm run paper:provable-discourse`) — the paper's
  claim-verification engine. Paper items reference the claim they touch; see
  `playbook/paper-lifecycle.md`.

## Conventions, in one breath

Capture in `inbox/`, commit in `items/`, generate the views, link everything,
copy nothing, and let every item say how it will prove it's done. The playbook
holds the rest.
