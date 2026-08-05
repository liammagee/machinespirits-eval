# Documentation Map

The entry point for everything written in this repo. One hop from here reaches
every layer. The full illustrated survey (servers, layers, authority chain,
design systems, defect ledger) is the techne doc
[`notes/poetics/2026-08-05-documentation-map.html`](notes/poetics/2026-08-05-documentation-map.html)
— open the file directly, or serve it: `npm run poetics:serve`, then
`http://127.0.0.1:3466/map` (the "docs map" entry on the scriptorium rail).

## The six layers

1. **Agent instructions** — `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`: the same
   project memory cut for each agent. `.claude/style-rule.md` is the prose
   rule a hook injects on every turn.
2. **Repo root** — frozen plans and pre-registrations (a status line in the
   first three lines says which), theory notes, `README.md`, `CONTRIBUTING.md`,
   `DEPLOYMENT.md`. `TODO.md` is a historical archive. Frozen docs are cited by
   the paper at specific commits: grep the paper before moving or deleting one.
3. **`docs/`** — operational reference and research.
   `docs/research/paper-full-2.0.md` is canonical for every empirical claim;
   `docs/research/paper-full.md` is the legacy Paper 1.0. The atlas under
   `docs/research/atlas/` and `docs/ref-status.md` are generated.
4. **`workplan/`** — the live board. `workplan/items/*.md` is the source of
   truth; `BOARD.md` / `board.json` are generated views written only by CI on
   main. Contract: `workplan/README.md`.
5. **`notes/`** — dated working notes and design history, plus the techne HTML
   doc system in `notes/poetics/` (`TECHNE-DOCS.md` is its convention).
   `notes/daily-notes/README.md` governs research roundups.
6. **`exports/`** — run artifacts and analysis reports (mostly generated,
   mostly gitignored).

## Who rules what

- Empirical claims, numbers, tables — `docs/research/paper-full-2.0.md`;
  spin-offs inherit and may not originate claims.
- Live work — `workplan/items/`; every change reaching main names its card.
- Cell architecture — `config/tutor-agents.yaml`, never a doc's summary.
- Database schema — the migrations at the top of
  `services/evaluationStore.js`.
- Analysis scripts — `scripts/ANALYSIS-SCRIPTS.md` (registry) with
  `docs/analysis-toolkit-guide.md` (workflow).
- UX, web and desktop — `desktop/ARCHITECTURE.md`: one UI codebase.
- Prose — `.claude/style-rule.md`.

## Live work

The board is the queue: `workplan/BOARD.md` (generated view) over
`workplan/items/`. The most recent arc's living log is
`notes/2026-08-03-adaptive-causality-living-log.md`; earlier arcs live in
their closed root plans and the paper.

## Web surfaces

One Express route table (`services/evalSurfaces.js`), three hosts:

- `npm start` — standalone eval server, port 8081, guarded end to end.
- `npm run poetics:serve` — the scriptorium on port 3466 (idempotent restart);
  transcripts, board, doc views, `/admin` job launcher. Reading pages are
  public; the shared eval surfaces carry the same guard as the standalone
  server when credentials are set.
- `npm run desktop:dev` — the Electron app, same routes on an ephemeral
  loopback port (route parity is test-enforced).
- `npm run subject-explorer` — the subject-explorer surface alone, port 4505,
  loopback by default behind the shared guard (also mounted at `/subject` on
  all three hosts above).

## Regeneration

Each generated view has one writer:

- Board views — `node scripts/workplan.js render` (CI commits them on main;
  feature branches must not).
- Reference status — `npm run refs:render` / checked by `npm run refs:check`.
- Paper PDF — `cd docs/research && ./build.sh paper2` (the bare default still
  builds the legacy 1.0).
- Atlas — `npm run atlas:build` (projection of the paper; never edits it).
- Arc regions — `npm run poetics:arc-html`.

## Deploy

Human-gated throughout: publish scripts stage standalone HTML, PDFs and images
into `../machinespirits-content-philosophy/articles/ai-tutor/`; only that
repo's `./publish` pushes, and a GitHub Action redeploys machinespirits.org.
Long form: `DEPLOYMENT.md`.
