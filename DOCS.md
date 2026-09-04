# Documentation Map

The entry point for everything written in this repo. One hop from here reaches
every layer. The full illustrated survey (servers, layers, authority chain,
design systems, defect ledger) is the techne doc
[`notes/poetics/2026-08-05-documentation-map.html`](notes/poetics/2026-08-05-documentation-map.html)
— open the file directly, or serve it: `npm run poetics:serve`, then
`http://127.0.0.1:3466/map` (the "docs map" entry on the scriptorium rail).

## The six layers

1. **Agent instructions** — `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`:
   provider-specific operating instructions that share the authority contracts
   in this map. `.claude/style-rule.md` is the prose rule a Claude hook injects
   on every turn.
2. **Repo root** — frozen plans and pre-registrations (a status line in the
   first three lines says which), theory notes, `README.md`, `CONTRIBUTING.md`,
   `DEPLOYMENT.md`. `TODO.md` is a historical archive. Frozen docs are cited by
   the paper at specific commits: grep the paper before moving or deleting one,
   and when a frozen doc needs correcting, add a dated *[Editor's note …]* —
   never rewrite it. Waiver: the four lowercase analysis notes at root predate
   the ALL-CAPS naming convention and keep their names (one is paper-cited).
3. **`docs/`** — operational reference and research.
   `docs/research/paper-full-2.0.md` is canonical for every empirical claim;
   `docs/research/paper-full.md` is the legacy Paper 1.0. The atlas under
   `docs/research/atlas/` and `docs/ref-status.md` are generated.
4. **`workplan/`** — the live board. `workplan/items/*.md` is the source of
   truth; the CLI and Scriptorium build board data directly from those files.
   `BOARD.md` / `board.json` are ignored, explicit local exports. Contract:
   `workplan/README.md`.
5. **`notes/`** — dated working notes and design history, plus the techne HTML
   doc system in `notes/poetics/` (`TECHNE-DOCS.md` is its convention).
   `notes/daily-notes/README.md` governs research roundups. Two generated
   files live here in place (`provable-discourse.snapshot.json`,
   `paper-claim-audit.json`) — their writers own them; edit neither by hand.
6. **`exports/`** — run artifacts and analysis reports. Ignored by default;
   the exception is the policy: an artifact a paper section cites may be
   force-added (`git add -f`) and stays tracked. Never assume an exports path
   resolves in a fresh clone unless it is tracked.

## Who rules what

- Empirical claims, numbers, tables — `docs/research/paper-full-2.0.md`;
  spin-offs inherit and may not originate claims.
- Live work — `workplan/items/`; every change reaching main names its card.
- Cell architecture — `config/tutor-agents.yaml`, never a doc's summary.
- Database schema — the migrations at the top of
  `services/evaluationStore.js`.
- Analysis scripts — `scripts/ANALYSIS-SCRIPTS.md` (registry) with
  `docs/analysis-toolkit-guide.md` (workflow).
- Local CI and Actions-outage fallback — `docs/local-ci.md`.
- UX and web surfaces — `public/`, `routes/`, and
  `scripts/browse-poetics-scripts.js`.
- Prose — `.claude/style-rule.md`.

## Live work

The board is the queue: use `node scripts/workplan.js summary`, the list
commands, or the Scriptorium `/board` view over `workplan/items/`. The most
recent arc's living log is
`notes/2026-08-03-adaptive-causality-living-log.md`; earlier arcs live in
their closed root plans and the paper.

For adaptive tutoring specifically, three documents carry three scopes:
`ADAPTIVE-TUTOR-KERNEL-CONTRACT.md` names the canonical kernel
(`services/adaptiveTutor/`), its interfaces and every surface around it; the
living log above assesses the evidence; `ADAPTIVE-TUTOR-ACTIVE-PLAN.md` is the
closed A20 conduct-policy arc and its reopening gate.

Public adaptive-tutor dialogue comparisons share the contract in
`docs/dramatic-dialogue-renderer.md`. Its documentation map distinguishes the
frozen instrumentation A/B, free-running showcase, and registered crossed-action
example, including the claim boundary for each.

## Web surfaces

One Express route table (`services/evalSurfaces.js`), three hosts:

- `npm start` — standalone eval server, port 8081, guarded end to end.
- `npm run poetics:serve` — the scriptorium on port 3466 (idempotent restart);
  transcripts, board, doc views, `/admin` job launcher. Reading pages are
  public; the shared eval surfaces carry the same guard as the standalone
  server when credentials are set.
- `npm run subject-explorer` — the subject-explorer surface alone, port 4505,
  loopback by default behind the shared guard (also mounted at `/subject` on
  the shared hosts above).

## Regeneration

One verb for the cheap views: `npm run docs:refresh` — renders the reference
status, validates the atlas manifest, validates workplan source and in-memory
renderability, and reports tracked output changes. `-- --arc` adds the arc
regions (excluded by default: timestamp churn). Each view's own writer, for
when you want just one:

- Board export — `node scripts/workplan.js render` writes ignored local
  `workplan/BOARD.md` and `workplan/board.json` compatibility files.
- Reference status — `npm run refs:render` / checked by `npm run refs:check`.
- Paper PDF — `cd docs/research && ./build.sh` (canonical Paper 2.0 is now the
  default; `full` builds the legacy 1.0 and says so). Not part of
  `docs:refresh` — needs LaTeX and minutes.
- Atlas — `npm run atlas:build` (projection of the paper; never edits it).
- Arc regions — `npm run poetics:arc-html`.

Versioned PDFs beside the paper sources are untracked local artifacts. Keep
rule: newest version per family, plus anything the published site carries;
`npm run docs:prune-pdfs` applies it (dry run by default, `-- --apply` to
delete; every version rebuilds from the committed markdown).

## Deploy

Human-gated throughout: publish scripts stage standalone HTML, PDFs and images
into `../machinespirits-content-philosophy/articles/ai-tutor/`; only that
repo's `./publish` pushes, and a GitHub Action redeploys machinespirits.org.
Long form: `DEPLOYMENT.md`.
