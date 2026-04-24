# Chat UI Integration Handoff (2026-04-24)

A snapshot of eval-repo and tutor-core changes from the 2026-04-22 → 2026-04-24 critical-review + A10/A10b cycle that may affect the chat UI session. Written for the chat-UI session author to pick up when convenient.

**Bottom line**: the chat UI does not *need* any code changes to keep working — the changes below are mostly automatic pickup (new cells appear in your cell-picker without any edit) plus *optional enhancement opportunities* (pedagogical-orientation grouping, tooltips, effect-size chips). Your session's in-progress files (`server.js` mods, `routes/chatRoutes.js`, `public/chat/*`, `content-*`) remain untracked and are your call on when/how to commit.

## What I committed in the eval-repo (commit `2120683`, tag `v3.0.49`)

Paper arc: v3.0.42 → v3.0.49 across three days. Seven revisions, four new experiments (A10, A10b, A11, A12), one bug discovery/retraction (bug_007), one framing reframe. Details in `docs/research/paper-full-2.0.md` Appendix E "April 2026 arc summary".

Directly affecting your chat UI:

### 1. Two new cells are in `config/tutor-agents.yaml`

- `cell_95_base_matched_single_unified` — single-agent, recognition off, `prompt_type: matched_pedagogical`, `ego.prompt_file: tutor-ego-matched-pedagogical.md`
- `cell_96_base_behaviorist_single_unified` — single-agent, recognition off, `prompt_type: matched_behaviorist`, `ego.prompt_file: tutor-ego-matched-behaviorist.md`

Both are density controls for the A10/A10b pedagogical-orientation comparison in paper §7.9. They will appear automatically in any chat-UI cell list that scans `config/tutor-agents.yaml` via `evalConfigLoader.loadTutorAgents()?.profiles`. No code change needed.

### 2. Two new prompts exist in tutor-core's `prompts/`

- `tutor-ego-matched-pedagogical.md` (2,835 words, Hegelian-descendant constructivist grounding)
- `tutor-ego-matched-behaviorist.md` (2,957 words, Skinner/Gagné/Keller/Thorndike/Rosenshine grounding)

Your `loadPromptFile()` in `routes/chatRoutes.js:~38` checks both the eval-repo `prompts/` and the tutor-core `prompts/` directories, so these will load correctly. Confirmed working.

### 3. NEW: `pedagogical_orientations:` metadata block in `config/tutor-agents.yaml`

This is the piece most relevant to your chat UI. A new top-level map keyed by `prompt_type`, carrying structured metadata for each of five orientations (base, placebo, recognition, matched_pedagogical, matched_behaviorist). Each entry has:

- `family` — `transmission` / `neutral` / `intersubjective`
- `subfamily` (optional) — e.g., `hegelian_recognition`, `hegelian_constructivist`, `behaviorist_explicit_instruction`
- `short_label` — display name
- `lineage` — theorists cited
- `view_of_learner`, `role_of_tutor`, `key_mechanism` — three-axis characterisation
- `vocabulary[]` — distinctive terms
- `prompt_file`, `approx_length_words`
- `evaluation_effect_pooled_d_vs_base` — where measured (recognition $d = 1.21$; matched-pedagogical $d = 1.05$; matched-behaviorist $d = -0.89$)
- `evaluation_note` — human-readable summary where relevant

Canonical reference: `docs/pedagogical-taxonomy.md` (also new, has a JS consumption example and suggested UX moves). Authoritative text form of the same information.

### 4. bug_007 fix does not affect your chat UI

Context: we discovered on 2026-04-23 that `services/evaluationRunner.js::resolveEvalProfile` had no dispatch branch for new `prompt_type` values, so cell_95 silently fell back to `'budget'` profile and ran the base prompt for the entire A10 v1 run. Fixed in commit `2120683`. *This bug did not affect your chat UI* — your `chatRoutes.js` bypasses the profile resolution entirely by loading `profile.ego.prompt_file` directly from YAML (your line ~757). Confirmed by code audit during the retraction. No change needed on your side.

### 5. Paper v3.0.49 positions recognition as one member of the intersubjective family

Reframe from "recognition specifically works" to "intersubjective-pedagogy orientation works; recognition is one effective operationalisation." Details in paper abstract, §1, §9 broader implication. Relevant if you want chat UI tooltips to match the paper's current framing.

## What I committed in the tutor-core repo (commit `bf2b61f` on main)

Completes the bug_007 fix at the tutor-core side:
- Registered `matched_pedagogical` and `matched_behaviorist` profiles in tutor-core's `config/tutor-agents.yaml`
- Added the two prompt files to tutor-core's `prompts/`

Your `loadPromptFile()` looks at `node_modules/@machinespirits/tutor-core/prompts/` (symlinked to the local tutor-core repo), so these are immediately available via the symlink. On a fresh clone + `npm install` from the published tutor-core package, someone would need a compatible package version; for your local dev workflow this is already working.

## Optional enhancements for the chat UI

None of these are required. Each one lights up a capability the new metadata enables.

### A. Group cells by pedagogical orientation in the cell-picker

Pseudo:
```js
const tutorAgents = evalConfigLoader.loadTutorAgents();
const orientations = tutorAgents.pedagogical_orientations || {};
const groups = {};  // { intersubjective: [...], transmission: [...], neutral: [...] }
for (const [cellName, profile] of Object.entries(tutorAgents.profiles)) {
  if (!cellName.startsWith('cell_')) continue;
  const orientation = orientations[profile?.factors?.prompt_type];
  if (!orientation) continue;  // cell uses a prompt_type without metadata
  (groups[orientation.family] ||= []).push({ cellName, profile, orientation });
}
// Render three headers: "Intersubjective (Hegelian family)", "Transmission",
// "Neutral / placebo", with cells grouped under each.
```

### B. Orientation tooltip on cell hover

When hovering cell X:
```js
const promptType = profile.factors?.prompt_type;
const o = orientations[promptType];
if (o) {
  showTooltip({
    title: o.short_label,
    family: o.family,
    view: o.view_of_learner,
    role: o.role_of_tutor,
    mechanism: o.key_mechanism,
    lineage: o.lineage,
  });
}
```

### C. Effect-size chip

Where `o.evaluation_effect_pooled_d_vs_base` is defined (recognition, matched-pedagogical, matched-behaviorist), render a small chip like `"d = 1.21 vs base"` or `"d = -0.89 (below base)"` next to the cell name. Grounds the UI in empirical findings.

### D. Side-by-side comparison mode

For the research-affordance your UI is already pointing at — start the same scenario with two cells in split panes. The `vocabulary[]` lists are useful for highlighting orientation-distinctive words in the generated tutor output.

Full consumption example with data-binding-ready code: `docs/pedagogical-taxonomy.md` → "For the chat UI" section.

## What you still need to commit on your side

Your session has these untracked or modified files that my commits did *not* touch:

- `server.js` (modified) — your chat-routes + chat-public-dir integration
- `routes/chatRoutes.js` (new) — your chat API handler
- `public/chat/` (new directory) — your chat UI static assets
- `content-ethics-ai/`, `content-history-tech/`, `content-stats-skeptics/` (new) — new content packages you've been authoring

These are your work to commit when you're ready. I stayed out of them intentionally. If you want eval-repo to carry a coherent "chat UI shipped" commit, stage these yourself with a message describing the chat UI feature. If you want to keep them local for now, they'll sit as untracked until you decide.

## Quick-reference cross-links

- Paper §7.9 (density alternative resolved at orientation-family level): `docs/research/paper-full-2.0.md`
- Canonical taxonomy reference: `docs/pedagogical-taxonomy.md`
- YAML metadata: `config/tutor-agents.yaml` → `pedagogical_orientations:` (top-level)
- Eval-repo commit: `2120683 paper v3.0.49: April critical-review arc (v3.0.42 → v3.0.49)`, tag `v3.0.49`
- Tutor-core commit: `bf2b61f Add matched_pedagogical and matched_behaviorist profiles for A10/A10b density controls`
- TODO cleanup (A10 resolved, A13/D6 added, operational lessons): `TODO.md`

## Questions / sync points

If it's useful, I can:
- Commit your currently-untracked chat-UI files on your behalf (I'd prefer you review the commit message and scope first — not my place to author commits for your feature)
- Add a sixth pedagogical orientation (e.g., cognitivist-only, pure Socratic) if you want to extend the comparison before a chat-UI launch
- Write chat-UI code that consumes the `pedagogical_orientations:` metadata if you want a concrete diff to apply

Say which, and when.
