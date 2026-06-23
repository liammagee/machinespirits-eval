# Scriptorium dashboard UX audit and best-of-breed plan

Date: 2026-06-23

Scope: the canonical poetics Scriptorium served by `npm run poetics:serve`
at `http://127.0.0.1:3466`, including the dashboard front door, script
browser, proof-run index, live composer, run launcher, reference surfaces, and
folded-in static tools such as chat, adjudication, and pilot admin.

## Evidence gathered

- Runtime: the normal Node launcher failed because `better-sqlite3` is currently
  built for the Electron ABI. The app served cleanly through:
  `ELECTRON_RUN_AS_NODE=1 ./node_modules/.bin/electron scripts/serve-poetics-browser.mjs`.
- Route sweep: `/`, `/browse`, `/derivation`, `/compose/live`, `/runs`,
  `/ontology`, `/rubric`, `/curriculum`, `/replays`, `/board`, `/summary`,
  `/story`, `/repertoire`, `/chat/`, `/adjudication/`, and `/pilot-admin/`
  rendered with HTTP 200 after slash normalization where relevant.
- Browser sweep: no console errors were observed across the major Scriptorium
  routes at desktop or mobile viewports.
- Data state: `poetics_items`, `poetics_scores`, `poetics_runs`,
  `poetics_labels`, `poetics_review_flags`, `poetics_tutor_adaptations`, and
  `evaluation_results` are empty in this checkout. The proof-run corpus is
  populated from 59 `exports/dramatic-derivation/loop/*/diagnosis.json`
  artifacts.
- Tests: this passed under the Electron runtime:
  `ELECTRON_RUN_AS_NODE=1 ./node_modules/.bin/electron --test --test-force-exit tests/poeticsReportBrowser.test.js tests/poeticsJobRunner.test.js tests/desktopRouteParity.test.js`
  with 49 passing tests.
- Screenshots captured during audit:
  `/tmp/scriptorium-ux-audit/home-desktop.png`,
  `/tmp/scriptorium-ux-audit/browse-desktop.png`,
  `/tmp/scriptorium-ux-audit/derivation-desktop.png`,
  `/tmp/scriptorium-ux-audit/compose-desktop.png`,
  `/tmp/scriptorium-ux-audit/runs-desktop.png`,
  `/tmp/scriptorium-ux-audit/home-mobile.png`,
  `/tmp/scriptorium-ux-audit/browse-mobile.png`,
  `/tmp/scriptorium-ux-audit/chat-mobile.png`.

## Current strengths

1. The app has a strong conceptual identity: paper/ink styling, literary
   vocabulary, and a recognizably local research-instrument character.
2. `railHtml()` is a good single source for the primary Scriptorium rail, and
   `rail-inject.js` prevents the folded-in static tools from becoming fully
   separate applications.
3. The run launcher treats metered work carefully. Job-planning tests cover free
   versus quota versus metered paths.
4. The proof-run index is evidence-rich: grouped runs, outcomes, proof progress,
   backend chips, elapsed/cost columns, and direct artifact links.
5. The live composer starts from a plain-language user intent, offers a free
   preview mode, then exposes deeper dials. That is the right direction for a
   best-of-breed research tool.
6. The dashboard has real empty states, not broken states. The script browser
   does not crash when the DB corpus is empty.

## Product diagnosis

The Scriptorium is currently a powerful local instrument with a coherent
editorial aesthetic, but it is not yet a best-of-breed dashboard. It exposes
too much machinery too early, the mobile shell is structurally broken, and the
main task flows are not organized around user intent.

The core product problem is not missing functionality alone. It is that the app
does not yet make a new or returning operator feel oriented, confident, and in
control across the full loop:

1. understand current evidence,
2. inspect a corpus item,
3. generate or replay a new item,
4. watch job progress and cost,
5. compare outcomes,
6. flag or adjudicate cases,
7. turn findings into the workplan or paper trail.

The raw surfaces exist, but the loop is still distributed across dense pages,
small controls, route knowledge, and local conventions.

## P0 UX issues

### P0.1 True responsive shell

Issue: at 390 px mobile width, the shared rail and several page shells produce
document widths around 1,200-1,350 px. The user must pan sideways, and the rail
dominates every page.

Evidence:
- `/` mobile document width: about 1,255 px.
- `/browse` mobile document width: about 1,352 px.
- `/derivation` mobile document width: about 1,255 px.
- `/compose/live` mobile document width: about 1,241 px.
- `/chat` mobile document width: about 1,036 px.
- `.rail__btn` entries are 23-26 px tall, below common touch-target guidance.

Plan:
- Replace the flat mobile rail with a compact app bar: brand, current surface,
  command/search button, menu button.
- Move the full nav into an overlay or drawer grouped as: Observe, Create,
  Review, Reference, Admin.
- Keep primary task CTAs in page content, not only in the rail.
- Ensure `html.scrollWidth <= viewportWidth + 2` for every major route at
  390x844.
- Raise interactive target height to at least 40 px, with 44 px preferred on
  touch layouts.

Acceptance:
- No horizontal document overflow on `/`, `/browse`, `/derivation`,
  `/compose/live`, `/runs`, `/board`, and `/chat` at 390x844.
- Rail controls remain keyboard reachable and visible with focus.
- Current route is readable without opening the menu.

Implementation seams:
- `scripts/browse-poetics-scripts.js`: `railHtml()`, `NAV_PRIMARY`,
  `NAV_GROUPS`, `.rail*` CSS.
- `public/components/rail-inject.js` and `public/components/techne.css` for
  static surface parity.

### P0.2 Information architecture and user roles

Issue: the homepage calls itself "Eval control room", the product is named
Scriptorium, and the rail mixes reading, creation, reference, admin, and
research operations. A first-time user sees many nouns before learning which
workflow to choose.

Plan:
- Rename the front door to "Scriptorium" or "Scriptorium control room"; keep
  "eval" as a mode or domain, not the main identity.
- Define role-based entry points:
  - Reader: inspect scripts, proof runs, replays.
  - Builder: compose a scene, launch a run.
  - Reviewer: flags, labels, adjudication.
  - Operator: job queue, costs, pilot/admin.
  - Researcher: ontology, rubric, paper notes, workplan.
- Rebuild the home screen as a command center with role cards, current system
  health, recent activity, and next actions.
- Keep the reflexive pedagogy note, but move it below operational orientation.

Acceptance:
- A new user can choose a task in under 10 seconds without knowing route names.
- The top five actions are expressed as verbs: "Read evidence", "Compose",
  "Launch", "Review flags", "Open workplan".

### P0.3 Empty script corpus is a first-run workflow, not a blank state

Issue: the DB-backed script corpus is empty while proof runs are populated. The
dashboard shows `0 scripts` and `/browse` offers "Generate a script", but the
system does not explain whether the empty corpus is expected, how to ingest
artifacts, or what the best first safe action is.

Plan:
- Add a first-run setup panel when `poetics_items = 0`:
  - "Use sample fixture",
  - "Ingest existing artifacts",
  - "Generate mock script",
  - "Open proof runs instead".
- Show the exact command behind each action, with cost class.
- Give `/browse` a richer empty scaffold: what will appear here, which tables
  back it, and one-click safe mock generation.
- Add a DB/source health card on the dashboard with "script DB empty" versus
  "proof artifacts present".

Acceptance:
- Empty script DB can be resolved without reading code or remembering CLI
  names.
- The safe mock path never spends money.
- Dashboard makes the split between DB corpus and file-based proof corpus
  explicit.

### P0.4 Accessibility baseline

Issue: several high-impact controls lack durable labels or rely on placeholders.
Small controls and glyph-heavy buttons are common.

Observed examples:
- `/browse` filters (`runSelect`, `disciplineSelect`, `roleSelect`,
  `formSelect`, search input, labeller input) do not expose visible label text
  through `label[for]`.
- `/compose/live` textareas `g-desc`, `composerInput`, and input `saveName`
  are not labeled.
- `grid` and `theme` controls lack clear button labels beyond terse visible
  text.
- Seat cards concatenate as "I play theLearner" and "justWatch" in accessible
  text.

Plan:
- Add proper labels or `aria-label` for every form control.
- Convert icon/glyph commands to icon plus accessible text, with tooltips where
  needed.
- Fix seat-card markup so heading and body text are separated for assistive
  technology.
- Add a focused accessibility smoke test that checks unlabeled controls,
  duplicate landmarks, hit-target size, and horizontal overflow.

Acceptance:
- Zero unlabeled `input`, `select`, or `textarea` on core routes.
- All actionable controls have a stable accessible name.
- New regression test fails on horizontal overflow at mobile breakpoints.

### P0.5 Run launcher task model

Issue: `/runs` is safe but command-oriented. Six tabs expose form machinery
before the user has selected a goal. This is powerful for maintainers but not
best-of-breed for operators.

Plan:
- Introduce a goal-first launcher:
  - "Generate a new script",
  - "Replay a script",
  - "Run a proof-DAG derivation",
  - "Score existing artifacts",
  - "Run curriculum drama".
- Each goal opens a guided wizard with:
  - recommended safe default,
  - required fields,
  - advanced fields collapsed,
  - live command preview,
  - cost/quota badge,
  - validation checklist,
  - final confirmation only when money or external calls are involved.
- Keep the current tabbed raw launcher as an "advanced command builder".

Acceptance:
- A mock derivation and a mock generation can be launched without understanding
  file paths.
- Metered paths require explicit typed confirmation and show estimated risk.
- The job queue shows progress, logs, artifacts, cancel/retry, and next action.

## P1 UX issues

### P1.1 Script browser as an evidence workbench

Plan:
- Add saved views: all scripts, unscored, flagged, recognition, trap, recent,
  by discipline.
- Add item preview cards when no row is selected.
- Add compare mode: select two scripts or replay/original and show public text,
  scores, critic evidence, labels, and metadata side by side.
- Make filters visibly labeled and show active filter chips.
- Add keyboard shortcuts for search focus, next/previous item, and tab switch.

Acceptance:
- A reviewer can find, inspect, compare, flag, and label a case without leaving
  `/browse`.

### P1.2 Proof-run index density and drill-down

Plan:
- Keep the table for expert scanning, but add a summary layer per group:
  success rate, common failure events, median turns, real/mock split, latest run.
- Add collapsible group sections with sticky group headers.
- Add "compare selected runs" for a grounded versus failed pair.
- Add a visual proof path on the index row, not only in detail pages.
- Make "what the columns mean" more prominent for first-time users.

Acceptance:
- A user can answer "what changed between the best and worst run in this group?"
  from the UI in one path.

### P1.3 Live composer state model

Plan:
- Separate setup, live scene, scoring, and saved artifact states visually.
- Show who controls the next turn and whether it is free, quota, or metered.
- Treat "free preview" as a persistent mode badge.
- Add "reset scene", "save draft", and "copy replay command" flows.
- Show the generated spec before launching live interaction.

Acceptance:
- The user can tell whether they are configuring, chatting, scoring, or saving.
- No paid turn can happen without a visible spend mode.

### P1.4 Workplan integration

Plan:
- Promote UX issues into workplan epics after this audit is accepted.
- Add a dashboard board view grouped by UX roadmap phase.
- Let issue cards link to source routes, notes, and verification commands.
- Keep mutations in CLI/item files as the existing workplan contract requires.

Acceptance:
- The Scriptorium can show its own improvement roadmap without becoming a
  second source of truth.

### P1.5 Static surface convergence

Issue: `/chat`, `/adjudication`, and `/pilot-admin` are folded in by rail
injection, but they still feel like separate products and inherit mobile
overflow.

Plan:
- Define a shared app-shell contract for static tools:
  - injected rail/drawer,
  - consistent page title area,
  - route-local toolbar,
  - shared form/control sizing,
  - shared empty/error/loading states.
- Audit `/chat` separately because it is a dense, high-value tool with its own
  complex layout.

Acceptance:
- Static surfaces feel like Scriptorium modules, not embedded legacy pages.

## P2 best-of-breed feature set

These are not polish items. They are the features that make the dashboard feel
like a mature research cockpit instead of a route collection.

1. Global command palette: jump to routes, run commands, saved views, recent
   artifacts, and workplan items.
2. Unified job center: every spawned local job has status, cost class, logs,
   output paths, retry, cancel, and "open result".
3. Evidence graph: scripts, proof runs, replays, scores, labels, flags, paper
   sections, and workplan items link bidirectionally.
4. Comparison workbench: side-by-side scripts, proof runs, replays, or scoring
   passes, with aligned turns and critic evidence.
5. Saved views and permalinks: every filtered dashboard state is shareable and
   restorable from URL.
6. Role-aware onboarding: reader/builder/reviewer/operator/researcher paths
   with progress and recommended next actions.
7. Data health monitor: DB tables, artifact directories, stale live runs,
   failed jobs, unscored items, open flags, missing transcripts, and schema
   drift.
8. Cost and safety cockpit: clear separation of free/mock, quota, and metered
   actions across all creation/scoring flows.
9. Accessibility and responsive QA gate: no merge without viewport, keyboard,
   labels, focus, and no-console checks.
10. Desktop parity report: Electron route parity plus visual smoke evidence for
    the web shell and folded-in tools.

## Sequenced roadmap

### Phase 0 - UX safety net

Deliverables:
- Add a browser smoke script for core routes at desktop and mobile sizes.
- Check console errors, horizontal overflow, unlabeled controls, duplicate
  landmarks, and minimum target size.
- Store screenshots or a compact HTML report under `outputs/`.

Verification:
- `npm run scriptorium:ux-smoke` or equivalent passes.
- CI can run the smoke without paid calls.

### Phase 1 - Responsive shell and navigation

Deliverables:
- Mobile app bar plus drawer.
- Re-grouped nav taxonomy.
- Better current-location affordance.
- 40-44 px controls for touch layouts.

Verification:
- No horizontal overflow on the core route list at 390x844 and 768x1024.
- Keyboard navigation can open/close nav groups and reach every route.

### Phase 2 - Dashboard front door

Deliverables:
- Rename/reframe home as Scriptorium control room.
- Role cards and next-action panel.
- Data health: script DB empty/full, proof artifacts count, open flags, jobs.
- Recent activity with explicit corpus source.

Verification:
- Empty DB plus populated proof artifacts produces an honest first-run state.
- Non-empty fixture DB produces useful operations/signal/recent panels.

### Phase 3 - Evidence workbenches

Deliverables:
- `/browse` saved views, labeled filters, compare mode, active filter chips.
- `/derivation` group summaries, collapsible groups, compare mode, better
  explanation of table columns.
- `/replays` promoted from sparse route to first-class comparison surface.

Verification:
- Reviewer can inspect and compare a case from each corpus without route
  guessing.

### Phase 4 - Creation flows

Deliverables:
- Goal-first run launcher wizard.
- Advanced command builder retained.
- Live composer state model, generated spec preview, save/copy/reset flows.
- Unified cost badges and confirmation model.

Verification:
- Mock generation, mock derivation, replay dry-run, and score dry-run are
  launchable from the UI and produce visible job records.

### Phase 5 - Review and workplan loop

Deliverables:
- Review queue entry points from dashboard and browse.
- Flag resolution and human-label progress summaries.
- Workplan roadmap view that links to accepted UX epics.

Verification:
- A flagged item can be found, reviewed, linked to a workplan item, and marked
  as resolved through the supported source-of-truth workflow.

### Phase 6 - Static tools and desktop quality

Deliverables:
- Shared static-surface shell for chat, adjudication, pilot admin.
- Chat mobile/responsive redesign or explicit desktop-only mode with clear
  message.
- Electron-specific smoke for shell, route parity, and native startup state.

Verification:
- `/chat/`, `/adjudication/`, and `/pilot-admin/` pass the same shell
  responsive/accessibility gates as the server-rendered Scriptorium routes.

## Suggested first implementation slice

Start with the shell because every other improvement inherits it.

1. Add the UX smoke script and capture current failures as expected red tests.
2. Refactor `railHtml()` into desktop rail plus mobile app bar/drawer.
3. Add labels and aria names to the rail controls.
4. Fix mobile overflow on `/`, `/browse`, `/derivation`, `/compose/live`,
   `/runs`, `/board`, and `/chat/`.
5. Re-run route parity, poetics browser tests, and the new UX smoke.

This is the highest-leverage slice because it turns the current app from a
desktop-only local instrument into a resilient product shell.

## Workplan coordination

This audit is tracked on the project board as seven linked epics:

- `scriptorium-ux-safety-net`
- `scriptorium-responsive-shell-navigation`
- `scriptorium-control-room-first-run`
- `scriptorium-evidence-workbenches`
- `scriptorium-creation-flows`
- `scriptorium-review-workplan-loop`
- `scriptorium-static-tools-desktop-quality`

The note remains the detailed source for evidence and rationale; the workplan
items are the execution surface and should carry status, owner, branch, and
verification updates as work proceeds.

## Definition of best-of-breed for this app

Scriptorium is best-of-breed when a researcher can sit down at a fresh local
checkout and, without remembering CLI commands, safely:

1. understand what evidence exists and what is missing,
2. inspect scripts, proof runs, and replays with linked evidence,
3. generate or replay work under clear cost controls,
4. watch and recover local jobs,
5. compare outcomes and identify failures,
6. record review/adjudication decisions,
7. connect a finding to the workplan and paper trail,
8. do all of the above on desktop and tablet/mobile widths without broken
   layout or inaccessible controls.

That is the target state. The current implementation has the necessary raw
surfaces, but the product shell, first-run loop, evidence workbench, and
creation/review workflows need systematic consolidation before the dashboard
reaches that bar.
