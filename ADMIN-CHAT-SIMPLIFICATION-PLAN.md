# Admin Chat Simplification + Drama Concierge — Implementation Plan

**Target surface:** `/admin/chat/` (web + Electron desktop, one codebase)
**Files:** `public/chat/index.html`, `routes/chatRoutes.js`, tests under `tests/`
**Date:** 2026-07-02
**Goal:** Keep every existing capability, but re-organize the page around the primary task — *launching a pedagogical drama* — and add a small AI concierge chat that helps the user pick options and stage the drama. Reduce, do not remove: research telemetry moves behind progressive disclosure.

---

## 0. Constraints (read before coding)

1. **One UI codebase.** Edit only `public/chat/**` and `routes/chatRoutes.js`. Never fork UI into `desktop/` (see `desktop/ARCHITECTURE.md`). The desktop app picks changes up automatically.
2. **Auth posture.** The page is served under `/admin/` (Design-A perimeter RBAC in `services/httpBasicAuth.js`, no-op on localhost). The frontend already computes `apiBase = '/admin/api/chat'` when under `/admin/`. Any new endpoint added to `chatRoutes.js` inherits both mounts — do not hardcode either prefix.
3. **Metered actions stay human-gated.** The concierge may *propose* configurations and *prefill* the `/admin/runs` launcher URL, but must never itself trigger a paid batch job. Live single-scene turns (existing `/turn`, `/learner-turn`) remain click-initiated by the user.
4. **Keep the techne aesthetic.** Reuse the existing paper/ink tokens, JetBrains Mono / Fraunces typography, and chip/drawer idioms already in the file. No new CSS framework.
5. **No new writable stores.** Concierge conversation state lives in memory + `localStorage` only. If a persistent store is ever added, it needs an env override registered in `desktop/paths.js` (packaged-app constraint).
6. **Tests must stay green:** `npm test` includes route-parity and chat API tests (`tests/chat-cells-api.test.js`, `tests/chat-orientation-helpers.test.js`). Extend, don't bypass.

---

## 1. Current state (summary of the audit)

The left configurator interleaves four concerns in one scroll column:

| Concern | Controls today |
|---|---|
| Content | topic input, curriculum drawer (11 packages, ~47 lectures, ~50 compiled scene sources) |
| Dramaturgy | §00 director mode / act / beat / scene / director note |
| Architecture | §01 approach (6), §01b charisma variant (3, conditional), §02 critic (5), §03 stance (3, conditional), §04 learner (2), advanced all-cells browser, ego/superego model overrides, CLI toggle |
| Research telemetry | resolves-to manifest, match score 11/11, relaxed-dimension trade-offs, existing-results note, pedagogical-orientation lineage, charisma frontier panel, compare-orientations panel with vocabulary diff |

Known defects to fix while restructuring:

- **D1 — chip overflow:** at common laptop widths §01's chip grid clips ("Minimalist" cut, "Charismatic" wraps out of view) and the persona strip overflows the right viewport edge with no wrap/scroll affordance.
- **D2 — primary CTA below the fold:** in "AI writes both" mode the *Start scene* button is not visible at 1545×784 without scrolling the right pane.
- **D3 — manual cell pick desyncs chips:** `pickCellDirectly()` sets `resolved` but leaves the §01–§04 chips showing the previous feature selection; the next chip click silently re-resolves away from the manual pick.
- **D4 — resolver `alternatives` unused:** `POST /resolve` returns up to 3 scored alternatives; the UI ignores them.
- **D5 — no persistence:** a page refresh loses the whole scene and configuration; there is no transcript export.
- **D6 — no pre-flight signal:** `OPENROUTER_API_KEY` absence is only discovered when the first turn errors; the server's dry-run path is unreachable from the UI.

---

## 2. Target information architecture

Three tiers, progressive disclosure. Default view fits above the fold.

```
┌────────────────────────────┬──────────────────────────────────┐
│ TIER 1 · STAGE             │  §V SCRIPT (unchanged right pane)│
│  ◦ Concierge chat strip    │                                  │
│  ◦ Topic / source picker   │                                  │
│  ◦ Tutor preset chips (6)  │                                  │
│  ◦ Persona picker          │                                  │
│  ◦ Author mode (3 buttons) │                                  │
│  ◦ [ Start scene → ]       │  composer (existing, mode-aware) │
├────────────────────────────┤                                  │
│ TIER 2 · ▸ fine controls   │                                  │
│  critic · stance · learner │                                  │
│  director act/beat/scene   │                                  │
│  model overrides · CLI     │                                  │
├────────────────────────────┤                                  │
│ TIER 3 · ▸ research dossier│                                  │
│  resolves-to manifest ·    │                                  │
│  results · lineage ·       │                                  │
│  compare · charisma ·      │                                  │
│  all-cells browser         │                                  │
└────────────────────────────┴──────────────────────────────────┘
```

- **Tier 1 (always visible):** concierge + the five decisions that actually launch a drama (topic/source, tutor preset, persona, author mode, start). Tutor preset = the existing §01 approach chips. Everything else defaults sensibly.
- **Tier 2 (one `<details>` drawer, "fine controls"):** §00 director grid, §02 critic, §03 stance, §04 learner architecture, model overrides, CLI toggle. All existing controls, unchanged bindings.
- **Tier 3 (one `<details>` drawer, "research dossier"):** everything currently in the manifest below the pigment strip — existing-results note, orientation lineage, charisma frontier, compare panel, trade-offs — plus the advanced all-cells browser. Keep a *one-line* always-visible resolution readout in Tier 1: `∴ cell_1_base_single_unified · exact 11/11` (click → opens the dossier).

The "batch-generate scripts" action moves next to *Start scene* as a secondary button labeled **"batch via launcher →"** (still a plain link to `/admin/runs?…`, prefilled as today).

---

## 3. Drama Concierge (new feature)

A compact chat strip at the top of Tier 1. The user types what they want in plain language ("stage a recognition scene about fractions with an anxious learner, make the tutor charismatic"); the assistant replies with a short explanation **plus a machine-readable proposal** the UI can apply with one click. The concierge never mutates state directly — the user clicks *Apply* or *Apply & start scene*.

### 3.1 Backend: `POST /assist` in `routes/chatRoutes.js`

Request:

```json
{
  "messages": [{ "role": "user|assistant", "content": "..." }],
  "currentConfig": {
    "features": { "approach": "...", "critic": "...", "stance": "...", "learnerModel": "...", "charismaVariant": "..." },
    "topic": "...", "curriculumRef": null, "lectureRef": null,
    "director": { "mode": "...", "act": "...", "beat": "...", "scene": "...", "note": "..." },
    "personaId": "...", "mode": "human|teacher|auto"
  },
  "useClaudeCli": false,
  "dryRun": false
}
```

Response:

```json
{
  "message": "prose reply for the chat strip (markdown ok)",
  "proposal": {
    "features": { "...only keys being changed..." },
    "topic": "...", "curriculumRef": "...|null", "lectureRef": "...|null",
    "director": { "...partial..." },
    "personaId": "...", "mode": "auto",
    "action": "none|start_scene|open_batch_launcher",
    "rationale": "one sentence per changed field, for the preview card"
  },
  "resolved": { "name": "cell_...", "matchQuality": "exact|closest" },
  "totals": { "latencyMs": 0, "outputTokens": 0 }
}
```

Implementation notes:

1. **Catalog builder** `buildAssistCatalog()` — a compact, cached (per-process, TTL ~5 min) text block the system prompt embeds:
   - the 5 feature dimensions with their legal values and one-line semantics (source: the existing chip hint strings — keep a single JS constant so UI hints and catalog stay in sync);
   - persona list from `PERSONA_SKETCHES`;
   - scene sources: `listCurriculumSceneSources()` refs + labels + one-line summaries (clip to ~4k chars);
   - curriculum packages/lectures: package label + course title + lecture titles only;
   - director vocabulary (mode/act/beat legal values with the one-line meanings already in the UI).
   Do **not** embed all 125 cell descriptions; the resolver owns cell choice. The assistant only speaks the feature vocabulary.
2. **System prompt** (new file `prompts/chat-assist-concierge.md`, loaded via the existing `loadPromptFile()` — the eval repo's `prompts/` is authoritative): role = "stage manager for a pedagogical drama"; instructions: ask at most one clarifying question when genuinely ambiguous, otherwise propose; always return the JSON contract; never invent refs/ids not in the catalog; explain trade-offs in one or two sentences of plain language.
3. **Output contract enforcement:** ask the model for a single JSON object (```json fenced); parse with a tolerant extractor (strip fences, `JSON.parse`, on failure retry once with a "return only JSON" nudge, on second failure return `{ message: rawText, proposal: null }`). Validate `proposal` server-side: every field run through the same normalizers the real endpoints use (`normalizeFeatures`, persona id ∈ known set, refs ∈ catalog, director enums). Drop invalid fields, note the drop in `message`.
4. **After validation, call the resolver internally** (`deriveTarget` + `scoreCell` over the same candidate list `/resolve` uses) and include the resolved cell + matchQuality in the response, so the UI preview can say "this resolves to cell_7 (exact)".
5. **Model routing:** reuse `callClaudeCli()` when `useClaudeCli`, else `callModel()` with `OPENROUTER_API_KEY`. Default model: a cheap alias from `config/providers.yaml` (pick the same default the learner endpoint uses; make it overridable via `CHAT_ASSIST_MODEL` env). Temperature 0.2, maxTokens ~900.
6. **`dryRun: true`** returns a canned deterministic proposal (mirror `buildDryRunTutorTurn` style) so tests and keyless environments work.
7. Cap `messages` history at the last 12 entries server-side.

### 3.2 Frontend: concierge strip in `public/chat/index.html`

- New Alpine state: `assist: { open: true, messages: [], input: '', pending: false, proposal: null, proposalResolved: null }`.
- UI: a bordered strip above the topic input. Collapsed = a single input line with placeholder *"describe the drama you want to stage…"* + a ▸ history toggle. Expanded = last few exchanges rendered with the existing `md()` helper, small mono metadata.
- On response with a `proposal`: render a **proposal card** — table of `field → new value` (with `rationale`), the resolution line ("resolves to *cell_7_recog_multi_psycho* · exact"), and buttons:
  - **Apply** — `applyProposal(p)`: deep-merge into `features`, `topic`, `director`, `personaId`, `mode`, set `lectureRef`/`curriculumRef`, then `await resolve()`. Nothing else.
  - **Apply & start scene** — apply, set `mode='auto'` if proposal says so, then call the existing `step()`.
  - **Open batch launcher** (only when `action === 'open_batch_launcher'`) — apply, then navigate to `runLauncherHref()`.
- `applyProposal` must be the *only* write path — one function, unit-testable, no scattered assignments.
- Send `currentConfig` on every assist call so the model can do incremental edits ("keep everything, just make the learner adversarial").
- Concierge availability: on init, `GET /assist/health` (tiny new endpoint returning `{ ok, provider: 'openrouter'|'claude-cli'|'none' }`); when `none`, show the strip disabled with the message "set OPENROUTER_API_KEY or enable the CLI toggle" — this also fixes D6 for the whole page (show the same warning near *Start scene*).

---

## 4. Simplification work items (ordered)

### Phase A — layout restructure (no behavior change)
1. Restructure the left column into the three tiers of §2. Move existing markup wholesale; do not rewrite bindings. Tier 2 and Tier 3 are `<details class="drawer">` using the existing `curriculum-drawer` summary idiom.
2. Add the always-visible one-line resolution readout in Tier 1 (name + matchQuality chip + score), clicking it opens Tier 3.
3. Move the mode toggle + Start/Send into Tier 1 (left column), keeping the composer textarea on the right pane. The right pane keeps a mirrored *Start scene* button in auto mode (fixes D2 by having the CTA in the always-visible left column).
4. Relabel for plain language (labels only, ids/state unchanged):
   - "§01 Approach" → "Tutor style"; "§02 Inner critic" → "Inner critic (superego)"; "§04 Learner architecture" → "Simulated learner mind"; "scene author" → "Who writes the lines?".
   - Toolbar `cli off / opus 4.7` button → "substrate: cell models | local claude" with the same toggle behavior.
5. Fix D1: chips grid `grid-template-columns: repeat(auto-fit, minmax(104px, 1fr))` + allow 2-row wrap; persona strip `flex-wrap: wrap` (or `overflow-x: auto` with a visible fade + scroll affordance — prefer wrap).
6. Toolbar chapter links re-pointed at the new tier anchors (Stage / Fine controls / Dossier / Script).

### Phase B — concierge
7. Backend `POST /assist` + `GET /assist/health` + prompt file + catalog builder (§3.1).
8. Frontend strip + proposal card + `applyProposal()` (§3.2).

### Phase C — state sync and small functional fixes
9. Fix D3: when `pickCellDirectly(cell)` is used, either (a) reverse-map the cell to nearest features via a new helper `featuresFromCell(cell)` (prompt-type → approach/critic/stance, superego → critic, learner arch → learnerModel, idDirector → charismatic) and set the chips accordingly, or, where the map is lossy, (b) set a visible `manualPick` flag that renders a "manual: cell_x ×" pill and greys out the chips until cleared. Do (a) when lossless, (b) fallback otherwise.
10. Fix D4: render `alternatives` from `/resolve` as up to 3 ghost rows under the resolution readout ("close: c104 · −2 · relaxed: promptType"); clicking one applies it as a manual pick.
11. Fix D5: persist `{features, topic, refs, director, personaId, mode, modelOverrides, turns}` to `localStorage` (key `ms-chat-session-v1`) on change (debounced); on init, offer "restore previous scene? (n turns)" as a dismissible strip. Add "export transcript" button producing a downloadable markdown file (turns + deliberation + config header) via a `Blob` link — no server round-trip.
12. Error turns get a "retry" button that re-issues the failed call with the same payload (store the payload on the error turn).

### Phase D — tests + docs
13. `tests/chat-assist-api.test.js`: dryRun contract (proposal validates, invalid fields dropped, resolver attached); health endpoint; history capping.
14. Extend `tests/chat-cells-api.test.js` only if response shapes changed (they should not).
15. New `tests/chat-apply-proposal.test.js` if `applyProposal`/`featuresFromCell` are extracted into `public/chat/orientation-helpers.js`-style module (`public/chat/assist-helpers.js`) — mirror the existing `window.OH` pattern (`window.AH`), which is what makes them node-testable.
16. Route-parity + desktop: no action needed (same route table), but run `npm test` and confirm the parity test passes.
17. Update `workplan/`: add an item card for this arc, `node scripts/workplan.js render && node scripts/workplan.js validate`.

---

## 5. Acceptance criteria

1. At 1440×900 the default view shows: concierge strip, topic, six tutor-style chips (all visible, none clipped), persona row, author-mode toggle, *Start scene*, and the one-line resolution readout — with no scrolling in the left column.
2. Typing "stage a drama about the master–slave dialectic with a charismatic tutor and an anxious learner, AI plays both sides" into the concierge yields a proposal card that, when applied, sets approach=charismatic, personaId=struggling_anxious, mode=auto, topic set — and *Apply & start scene* produces a learner turn + tutor turn using the existing endpoints.
3. Every control that exists today is still reachable (Tier 2/3 drawers), and every existing endpoint keeps its request/response shape.
4. The concierge cannot spend money without a user click: no assist response ever triggers `/turn`, `/learner-turn`, or a job launch by itself.
5. Manual cell pick and chip state can no longer contradict each other (D3).
6. Refresh restores the previous scene on request (D5); transcript export downloads a markdown file.
7. `npm test` green, including new assist tests, with no `OPENROUTER_API_KEY` in the environment (dryRun paths).
8. Works identically in the Electron worktree (`npm run desktop:dev`) with zero `desktop/` changes.

## 6. Out of scope

- Streaming turn output (worth doing later; keep the stage-label spinner).
- Any change to eval semantics, cell YAML, rubrics, or the `/admin/runs` job runner.
- Persisting concierge conversations server-side.
- Non-admin/public exposure of the assist endpoint.
