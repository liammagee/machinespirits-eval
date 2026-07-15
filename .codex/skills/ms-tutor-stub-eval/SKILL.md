---
name: ms-tutor-stub-eval
description: Run, resume, analyze, or configure the tutor-stub detective-world tutor experiments, including human-driven tutor sessions, automated single-learner policy evals, ABM learner panels, field/state reports, register-policy comparisons, multi-eval/cross-run summaries, cross-run field trajectories, and quota/token-failure recovery.
allowed-tools: Bash, Read, Grep, Glob
---

# Tutor Stub Eval

Use this skill for `scripts/tutor-stub.js`, `scripts/run-tutor-stub-auto-eval.js`,
`scripts/run-tutor-stub-qa-matrix.js`, `scripts/run-tutor-stub-abm-panel.js`,
`scripts/analyze-tutor-stub-field-traces.js`, and
`scripts/analyze-tutor-stub-auto-evals.js`.
Work from the repo root.

## Intake

If the user has not supplied enough detail, ask at most 1-3 concise questions.
Use defaults when the user does not answer or asks to "just run it".

Key choices and defaults:

- Mode: `human`, `auto-eval`, `resume`, `abm-panel`, `analyze`, `multi-eval`; default `auto-eval` for comparisons, `human` when the user will play the learner.
- Pure-chat baseline: `npm run tutor:stub:passthrough`. This is an explicit
  speaker-only control, not an alias for `direct`: each learner line produces
  exactly one speaking-model call with only the system setup, complete public
  user/assistant history, and the latest learner message. It starts without a
  tutor opening and bypasses the classifier, learner-DAG, register selection,
  discourse scaffold, response composition, response guards/repairs, release
  planner, closure policy, mixed prefetch, turn feedback, and learning summary.
  The JSONL trace remains on for call-count and payload auditing. Passthrough
  sessions may load the last scenario and speaking model as setup but never
  overwrite remembered teaching settings; use `/settings model` to change the
  sole active model.
- World: default `world_005_marrick`.
- Register policies: default comparison `negative,bland,dynamic,state,field,trajectory,dynamical_system,empirical_dynamical_system,continuous_dynamical_system,continuous_empirical_dynamical_system,random`; adaptive-only comparison `dynamic,state,field,trajectory,dynamical_system,empirical_dynamical_system,continuous_dynamical_system,continuous_empirical_dynamical_system`.
- QA policy suites: `core` is the routine baseline + discrete adaptive comparison (`bland,dynamic,state,field,trajectory,dynamical_system,empirical_dynamical_system`); `controls` is `negative,bland,random`; `pressure` is the cheap `field,negative` screen for pressure-sensitive learner profiles; `sentinel` is the representative five-policy ladder (`bland,field,trajectory,dynamical_system,negative`) for the 60-dialogue sentinel-profile `n=3` comparison; `frontier` adds the richer/continuous state policies against `bland`; `audit` is the expensive all-policy sweep. `focused` aliases `core`; `full`/`all` alias `audit`.
- Trajectory policy: `--register-policy trajectory` leaves `field` unchanged and adds recent finite-difference velocity/slope/acceleration/risk-trend adjustments for benchmarking against `field`.
- Dynamical-system policy: `--register-policy dynamical_system` maps a continuous state/derivative vector through theory priors plus within-dialogue empirical efficacy corrections; `dynamical-system` is accepted as an alias.
- Composed register policies: append `+state`, `+field`, or both to an adaptive
  primary, for example `--register-policy dynamical_system+state+field`. The
  primary selects first. Each overlay then makes a deterministic counter-choice
  and receives a normalized turn-change score; only an overlay at or above
  `--register-overlay-threshold` (default `0.7`) that recommends a different
  stance may take control. If several qualify, the strongest wins, with stack
  order breaking ties. `bland`, `random`, and `negative` reject overlays so
  control arms remain uncontaminated. Auto-eval accepts composed policy ids in
  `--policies`, such as `--policies bland,dynamical_system+state+field`.
- Empirical dynamical-system policy: run `node scripts/build-tutor-stub-register-priors.js` first, then use `--register-policy empirical_dynamical_system` to add cross-run prior corrections; `empirical-dynamical-system` is accepted as an alias.
- Continuous dynamical-system policies: `continuous_dynamical_system` and `continuous_empirical_dynamical_system` keep `selected_register` and `register_vector` as compatibility aliases while using `engagement_stance` and a weighted engagement-stance blend internally; hyphen aliases are accepted. The empirical variant uses the same register-priors file as `empirical_dynamical_system`.
- Adaptive-performance temperature: default `0.15`. Use the backward-compatible `--register-temperature <n>` launch flag or `/settings stance-temp <n>` (`/settings temp` remains an alias). Lower values sharpen the dominant engagement stance and independently selected actorial part; higher values broaden those two distributions. Action family, audience register, lexical accessibility, and scene immersion remain deterministic and are never temperature-scaled. The supported range is `0.05` to `3.0`. Live changes invalidate and regenerate mixed suggestion analysis/prefetch state.
- Accumulated DAG-fact dropout: default `0` (off). Use `--dag-fact-dropout <0..1>` and optional deterministic `--dag-fact-dropout-seed <n>`, or change the live rate with `/settings dropout <0..1>`. Only adopted public premises are eligible; background facts are immune; facts receive two grace turns; at most two may be dropped concurrently. A learner can repair a dropped fact by explicitly using or re-adopting it. The public transcript remains intact, exact dropped premise ids stay in technical traces rather than tutor speech, and `0` stops new losses without silently restoring already dropped facts. Live changes invalidate mixed suggestion analysis/prefetch state.
- Clue release speed: default `1.0`. Use `--release-speed <0.5..2>` or `/settings release-speed <0.5..2>` (`pace` and `speed` are aliases). `1` follows authored clue timing; lower stretches the remaining schedule and higher compresses it. Explicit public requests such as “move it along” or “one clue at a time” adapt the effective pace further. At most one authored release batch is introduced per tutor turn (a deliberately co-released premise group stays together), and all evidence, question-support, and leak guards remain active. Pace changes are recorded in turn traces, transcript settings, debug explanations, and learning summaries.
- Every newly available clue is also a visible dramatic beat. After responding to the learner, the tutor lets a character, object, interruption, gesture, or spoken line signal the clue inside the scene; enacts `director` releases as their source (for example a witness or clerk); and handles `tutor` releases as concrete exhibits. It does not announce “let's role-play,” “I'll be the clerk,” or “back to the case.” The selected engagement stance supplies a concrete performance tactic within the selected part, so the same authored source can sound brisk, precise, warm, witnessing, charismatic, or deliberately negative without changing its evidence. The response guard rejects meta-theatrical announcements, opaque clue dumps, missing enactment, merely named characters, unrealized performance tactics, and releases that never hand the evidence to the learner. Worlds may refine the default with `release_schedule[].presentation.mode`, `.role`, and `.cue`; those fields may costume only the linked public premise and must not add evidence.
- Tutor openings hardwire only four requirements: enact the public situation, keep the exact public question visible, imply no unavailable evidence, and invite observation or clarification when no clue is available. A world may supply exact public speech in `opening_frame.authored_text` or narrow the public frame with `opening_frame.situation`; otherwise the active speaking tutor model (Terra by default) realizes the setting, question, presentation metadata, and opening-only clue surfaces. Every candidate receives a structural plus evidence-boundary audit before history commit; failures use a world-grounded deterministic fallback rather than the former shared “Keep the case question in view” boilerplate.
- DAG discourse mode: default `strict_dag` is the proof-audit baseline. Use `--dag-mode human_scaffold` or `--dag-mode defeasible_human_scaffold` when testing the human-facing scaffold that allows ordinary-language warrant framing, side arcs, compressed human inference, and internal proof debt while the strict DAG remains the audit.
- Negative floor: `--register-policy negative` samples only `ironic`, `sarcastic`, and `face_threat`; use it as an explicit lower-bound/control arm, not as recommended pedagogy.
- Automated learner profile: default `diligent`; vary with `--auto-learner-profile-id answer_seeking|skeptical|overconfident|low_agency|memory_limited|premature_closure|proof_skipper|false_memory|contradiction_keeper|affective_resistant|low_trust_skeptic|fast_learner|slow_learner`, or list presets with `--list-learner-profiles`. Built-ins are structured learner-profile contracts (`machinespirits.tutor-stub.learner-profile-contract.v3`) rendered into automated-learner prompts and preserved in report config. The first six are core profiles; the latter eight are sharper stress profiles. `fast_learner` grounds the current warrant then asks for the next clue; `slow_learner` retains evidence but asks to settle one clue at a time.
- Learner profile suites: `core` is the routine robustness suite; `sentinel` is the cheap discrimination screen; `stress` is targeted failure-mode probing; `audit` is the expensive all-profile sweep. `all` remains accepted as an alias for `audit`, but do not use it as the default QA matrix.
- Runs: default `3` for baseline comparisons, `5` for core/frontier policy comparisons, `1` for ABM panels.
- Models: default speaking tutor `codex.gpt-5.6-terra` at `medium` CLI effort; analysis/classifier/DAG `codex.gpt-5.6-sol`; automated learner `codex.gpt-5.6-terra`. This intentionally places the stronger model at learner interpretation rather than public response realization.
- Named tutor partition: the default speaking tutor is the versioned
  `dramatic-detective` instance from `config/tutor-instances.yaml`. Its role
  prompt, policy pack, model defaults, active version, and prompt hash are
  recorded separately from the selected model. Use `--list-tutors`, select
  with `--tutor <id>`, and pin an immutable version with
  `--tutor <id>@vN`. A running dialogue never changes tutor version beneath
  itself; promotion or rollback affects the next run.
- Tutor tuning is off by default. Use `--tuning capture` to record feedback
  evidence only, `--tuning on` to create typed review candidates, or
  `--tuning canary` to run the approved canary version. The ignored local
  store defaults to `.tutor-stub-tuning/` and may be relocated with
  `TUTOR_STUB_TUNING_DIR` or `--tuning-dir`. Raw comments remain evidence and
  are never interpolated into the speaking prompt. Only the bounded reason
  taxonomy compiles candidate rules. Promotion is a gated loop:
  `/tune review` -> `/tune approve <candidate>` -> run the frozen-prefix replay
  or canary -> `/tune validate <candidate> up|down` ->
  `/tune promote <candidate>`. Use `/tune rollback [vN]` to restore a previous
  stable version. Candidate replay JSON preserves the exact system prompt,
  public prefix, model settings, prompt hash, rated turn, and candidate overlay.
- Human interactive sessions remember the selected scenario and learner
  profile (including a custom profile), named tutor instance, tuning mode,
  plus the last speaking-tutor model,
  engagement-stance temperature, DAG-fact dropout rate, clue release speed,
  register primary and overlays, and overlay threshold in
  `.tutor-stub-traces/last-settings.json`.
  Explicit CLI/environment values win; automated, one-shot, piped, and eval
  runs neither load nor write this file. Use `--no-remember-settings` for a
  clean interactive launch or `TUTOR_STUB_SETTINGS_FILE` to relocate it.
- Model provenance: treat the observed tutor, analysis, and learner models in
  `profile-discrimination.md/json` as authoritative. A requested model in
  `qa-plan.json` is configuration intent only. Once a same-model profile gate
  passes at `n=3`, a different-model rerun is optional cross-model robustness,
  not a prerequisite for profile discrimination.
- Parallelism: default `8` for `auto-eval`; ABM panel is currently serial.
- Turn stopping: default `--turns until-grounded --safety-turns 120`.
- Token cap: default `--max-tokens 4096` for `auto-eval` and resumes to avoid output-limit failures.
- Speaker history: tutor and learner calls always replay the complete public dialogue as speaker-relative `user`/`assistant` messages. Direct API providers retain native roles; the Codex/Claude CLI bridge alone flattens them at the transport boundary.
- Analysis memory compaction: default on; `--history-turns 4` controls the raw recent window plus compact state/field/dialogue summaries used by auxiliary classifier, learner-record, and clarification prompts. `--no-memory-summary` disables those auxiliary summaries; it does not change speaker-history replay.
- Trace/output dir: default `.tutor-stub-auto-eval/<descriptive-run-id>` for auto-eval, `exports/tutor-stub-abm-panel` for ABM.
- Eval ledger: default `.tutor-stub-auto-eval/ledger.jsonl` plus `.tutor-stub-auto-eval/ledger.md`; this is local/ignored. Use `--no-ledger` to skip. For SQL querying, ingest JSON summaries into `data/evaluations.db` with `npm run tutor:stub:ingest`.
- Debug turn ids: automatic `turn id > <run-id>:tNNN` lines appear only in persistent technical debug mode. `/id` (aliases `/turn-id`, `/debug-id`) always prints the last completed or in-progress id plus the exact JSONL trace path and copies that complete diagnostic block to the system clipboard for pasting into Codex. Clipboard failure is non-fatal and leaves the printed block available for manual selection.

Do not recommend `codex.mini`, `codex.gpt-mini`, or `codex.gpt-5-mini`; the local
Codex ChatGPT-account route rejects those. Use `codex.gpt-5.6-terra` for the
CLI-backed speaking tutor, `codex.gpt-5.6-sol` for classification and learner-DAG
interpretation, `codex.gpt-5.6-terra` for the automated learner, or `openai.mini`
/ `openrouter.gpt-mini` for GPT mini.

## Prompt and World Authoring Boundary

Follow `docs/tutor-stub-prompt-and-world-authoring.md` when changing prompts,
authoring a dramatic-derivation world, or compiling a curriculum module into
this world format.

- The deterministic harness is the private planner and has the full world
  contract. It is not an LLM role.
- The speaking tutor receives only the public scene, public rule glosses,
  public dialogue, current public evidence, and a bounded response action.
  Never pass it the answer, future evidence, proof paths, IDs, or formal facts,
  even inside negative examples.
- Automated learners receive behavior-only briefs. Quantitative recurrence,
  scoring, classifier, DAG, and discrimination targets remain in the external
  profile contract and analyzers.
- Runtime prompt calls are fail-closed on budgets and the speaker-privilege
  boundary. A tutor prompt that fails only because identical long instruction
  lines were composed twice is compacted once, recorded as
  `prompt_audit_recovery`, and re-audited. A speaker-privilege failure blocks
  the contaminated call and permits one deterministic rebuild from the public
  turn contract only: base speaker rules, public continuity and evidence,
  response composition, any due dramatic release, the compact response
  configuration, and the learner message. The rebuilt prompt must pass both
  privilege and budget/duplication audits before a fresh call may proceed;
  otherwise the turn still stops.
- Every world must explicitly author `temporal_frame`, `scene_ecology`,
  `narrative_diction`, `ledger_term`, and `summary`.

Before any model-backed run, execute:

```bash
npm run derivation:quality
node --test tests/tutorStubPromptAudit.test.js tests/derivationWorldQuality.test.js
```

Use the normal `tutor-stub.js --dry-run --dag ...` JSON to verify that the
deterministic planner and the base prompt audits are recorded and passing.

## Human Learner Session

Use the mnemonic presets for common interactive checks:

```bash
npm run tutor:stub:passthrough     # pure speaker baseline; one model call per turn
npm run tutor:stub:direct          # no DAG interpretation, human types turns
npm run tutor:stub:direct:mixed    # no DAG interpretation, learner drafts available
npm run tutor:stub:scaffold        # human-facing DAG scaffold, human types turns
npm run tutor:stub:scaffold:mixed  # human-facing DAG scaffold, learner drafts available
npm run tutor:stub:demo            # clean guided live tour plus analysis and HTML evidence
```

Inside either scaffold, `/demo` runs the same guided tour against the current
scene and settings: three bounded automated learner-tutor turns, the latest
plain-language analysis, the seven-view transcript HTML, and the compact
outcome report. It then returns control without ending the session. `/demo N`
uses `N` turns, capped at eight; `/reset` cancels safely while it is running.

Use passthrough when testing the model and setup without the tutoring harness:

```bash
npm run tutor:stub:passthrough -- --world world_005_marrick
```

Type the first learner message after launch. The compact passthrough command
surface keeps `/settings model`, `/status`, `/transcript`, `/director`, `/id`,
`/scenario`, `/reset`, `/help`, and `/quit`; teaching-policy commands are
rejected because their mechanisms are not active.

Use when the user will type learner turns manually:

```bash
npm run tutor:stub -- \
  --world world_005_marrick \
  --dag \
  --tutor-learner-dag \
  --dag-mode defeasible_human_scaffold \
  --register-policy field \
  --cli-effort medium \
  --history-turns 4 \
  --max-tokens 4096
```

Useful variants:

- Interactive sessions have three live roles. `/mode learner` (or `/learner`)
  makes typed lines public learner speech. `/mode coach` (or `/coach`) makes
  typed lines private, high-priority suggestions for the next tutor response;
  `/coach <text>` switches and queues in one command. Coach guidance is never
  added to public history, is constrained by evidence/leak/closure guards, is
  stored on the tutor turn for audit, and invalidates stale mixed tutor
  prefetches. In mixed mode, queue guidance and use `/use` to send the drafted
  learner turn; in human mode, switch back with `/learner` and type the public
  learner response.
- `/mode auto` (or `/auto`) hands the current public transcript to the existing
  automated learner loop and plays both roles until grounded closure or the
  configured safety cap. `/auto 5` runs exactly five more learner-tutor turns
  and then returns to the prior learner/coach role. It uses the active learner
  profile and `--auto-learner-model`; it does not restart the scene or repeat an
  existing opening.
- Human learner mode requests optional feedback after each displayed tutor
  opening or completed tutor response. With an empty learner prompt, press
  Left for not helpful or Right for helpful; the rating applies immediately
  without Enter. Once any text is present, those keys retain normal cursor
  movement. `👍`, `👎`, `/up`, and `/down` remain available, and simply sending
  the next learner line skips the rating. The structured
  `tutorFeedback` envelope is copied onto every fragment in that learner turn,
  kept out of public speech, persisted in traces/transcript HTML, and used as
  one subjective signal in the tutor's next efficacy assessment and register
  history. It also creates a private, one-response adaptation contract tied to
  the exact rated response. A down-rating requires a transcript-visible change
  in configuration or realization; an up-rating preserves useful qualities
  while still answering the learner's new words. The result is audited and
  stored as a `feedback-observation.v1` record that joins the rated tutor
  response, learner reply, objective progress, and next tutor adaptation.
  A smaller `feedback-rating-record.v1` is written immediately, so the rating
  survives `/quit` even when no subsequent learner turn is sent; the enriched
  observation supersedes it during prior fitting.
  Subjective helpfulness and objective progress remain separate channels, and
  the record explicitly makes no causal claim. Use `/feedback on|off|clear` or
  `--no-turn-feedback`; it is on by default for human sessions and absent from
  fully automated learner turns.
  A rating may carry a typed reason and a short evidence comment, for example
  `/down too_abstract Uses labels instead of the objects in the scene` or
  `/up helpful_pacing`. `/tune reasons` lists the bounded taxonomy. The typed
  reason guides the next one-turn adaptation and, only when tuning is on,
  creates a tutor-version candidate; the free-form comment is retained for
  review but never becomes an instruction.
- Interactive TTY sessions keep a persistent editable command line beneath the
  animated activity line while tutor, learner, analysis, clarification, or auto
  work is running. Readline is not paused in `/auto`: commands such as
  `/status`, `/analysis`, `/transcript`, `/field`, `/coach`, and `/quit` can be
  entered while generation continues, and partially typed commands survive
  activity redraws and completed model output. API text streams are displayed
  as a completed block while this command surface is live so token writes do
  not corrupt the input cursor; non-interactive streaming behavior is unchanged.
- The live prompt supports ordinary terminal selection editing: Shift+Left/Right
  selects characters; Alt/Option+Shift+Left/Right and
  Ctrl+Shift+Left/Right select words; Shift+Home/End selects to either end of
  the line. Alt/Option+Left/Right and Ctrl+Left/Right move by word. Typing or
  pressing Backspace/Delete replaces or removes the selection, which remains
  visibly highlighted across background redraws.
- `/status` prints the current role, turn, learner profile, mixed-cache state,
  register policy/temperature, DAG dropout, closure phase, and pending/applied
  coach guidance. Role prompts and tutor/system output use distinct terminal
  colors; `/help` is the compact command index.
- Add `--resume-last` to continue the latest dialogue in the trace dir.
- Add `--register-policy bland` for a non-dynamic-feeling baseline.
- Add `--model` only when overriding the default speaking tutor
  `codex.gpt-5.6-terra`; classifier and learner-record roles retain their
  separate `codex.gpt-5.6-sol` default, while the automated learner retains
  `codex.gpt-5.6-terra`.
- Use `--all-models <provider.alias>` when the same model should run the tutor,
  classifier, learner-DAG analysis, and automated/mixed learner. This launch
  override wins over all four role-specific model settings and is recorded in
  dry-run, trace, and transcript provenance. The live keyboard settings panel
  mirrors this with `One model for all roles`, then exposes independent selectors
  for `Tutor voice`, `Learner interpretation`, `Reasoning tracker`, and `Learner
  voice`. `/settings models all <provider.alias>` changes all four together;
  `/settings models tutor|classifier|reasoning|learner <provider.alias>` changes
  one role and clears the live override. `/settings model <provider.alias>`
  remains the tutor-only compatibility command. Every change records provenance,
  persists for the next interactive session, and refreshes stale mixed caches.
  When interpretation is combined with learner-DAG analysis, the classifier row
  is visibly inactive and the reasoning tracker row identifies itself as the
  owner of the combined call. Full public-history replay is already active for
  both speakers from session start. CLI providers are
  stateless subprocesses: the bridge flattens those ordered `user`/`assistant`
  messages under `Conversation so far`, then appends the composite current-turn
  prompt under `Latest message`.
- Multiple choice is opt-in globally with `--multiple-choice`, but the human
  scaffold may use one bounded public-safe choice after uncertainty when an
  open question would otherwise ask the learner to invent unstaged information.
- Codex speaking-tutor calls default to `gpt-5.6-terra` at `medium` effort; pass
  `--cli-effort low|high|xhigh` only for an intentional override.
- Add `--mixed-learner` for manual play with a prefetched clue-answer pair after
  each tutor turn. Use `/clue` or `/hint` for non-revealing direction, press Tab
  on an empty learner prompt to insert the answer for editing, or use
  `/suggest`, `/use`, `/regen`.
- Mixed suggestions may be questions. The ready line, `/clue`, and `/suggest`
  label the proposed move as `ask a question` or `respond`; question clues say
  what uncertainty to ask about without revealing the exact wording. The first
  tutor line establishes that asking which clue or term is unclear is a valid
  public move. Later tutor prompts name the live clue plainly and repeat that
  permission when the learner signals difficulty or the needed evidence is not
  yet public, rather than privately expecting the learner to infer it.
- Mixed artifacts also carry a separate `profile_signal`: a short account of
  how the visible draft expresses the active learner profile. The full ready
  notice and compact profile card appear once per active profile. An
  interactive TTY shows the scrolling scenario picker only when it has neither
  a saved scenario nor an explicit `--world`. The repository default
  (`world_005_marrick`) supplies the first-run highlight; Up/Down,
  Page Up/Down, Home/End, and Enter navigate and select. The highlighted
  scenario shows its public question, opening setting, and discipline. The
  chosen world is applied before the system prompt, DAG, director context, and
  opening are built. Resumed, returning, non-interactive, and non-TTY runs
  retain their selected world without another prompt. A mixed session asks for
  a learner profile only when it has neither a saved profile nor an explicit
  `--auto-learner-profile`; Enter accepts `diligent` on the first run. In a TTY,
  all built-in profiles appear in a scrolling menu: Up/Down moves the highlight
  and Enter selects it. Beneath the menu, `does >` describes the highlighted
  learner's recurring public behavior and `edge >` explains how it differs from
  its declared nearest-neighbour profile. Stress entries are labeled `stress
  probe` to make clear that they sharpen a core boundary rather than claiming
  to be an unrelated taxonomy. The initial highlight is the launch profile
  (`diligent` by default), and the viewport scrolls across both core and stress
  profiles. Pipes and other non-TTY callers retain the typed-ID profile
  fallback; there, `list`, `stress`, and `all` browse profile groups and Tab
  completes picker commands and ids.
  Before any clue or answer generation, the same first-run prelude asks only
  for dialogue settings that are not already saved or explicitly supplied:
  engagement-stance temperature when the active policy uses it (`0.15` is the
  recommended default), accumulated DAG-fact dropout when the learner DAG is
  enabled (`0` is the recommended reliable-memory default), and clue release
  speed. Enter accepts the repository default. Explicit command-line overrides
  always win. Returning, resumed, and `--no-opening` sessions skip completed
  setup steps, so normal startup proceeds directly into the scene. The opening
  tutor text is then buffered until
  that first notice and card are ready. The card is printed, then the selected
  scenario's director block is printed once as the final visible prelude
  immediately before the first tutor line. This makes the stage directions and
  opening speech read as one script opening while keeping the controls legible.
  Later suggestions activate Tab
  silently so they do not interrupt the dramatic flow. `/suggest` and `/use`
  still expose the profile id, intended pattern, and visible expression on
  demand; only the learner response is inserted or spoken, so this metadata
  does not break the dramatic frame.
- `/scenario` opens the same scrolling scenario picker on demand; `/scenario
  <id>` selects directly in a pipe or script. Selecting one closes and reports
  the current inquiry, then launches a fresh trace for the new world while
  retaining the active profile and dialogue settings. At natural closure the
  CLI writes and opens the learning summary, asks whether to do another
  scenario, and opens this picker on `y`; Enter or `n` ends the session.
- Learner suggestions and clarifications are kept inside the dramatic frame,
  and tutor prompts require the same: generated speech addresses the other
  speaker directly and does not say `the tutor`, `the learner`, `the dialogue`,
  `the prompt`, or that a question is `pending`. Clarification restates the
  live question directly.
- `/explain [phrase]` and natural vocabulary questions such as `what does cupel
  mean?` update a persistent comprehension side-state without advancing the
  learner DAG. Unresolved terms raise `language_opacity` and
  `compression_need`, favour plain/warm explanation, and suppress charismatic
  or negative pressure. A successful gloss marks the term explained while
  retaining recent clarification pressure for the next turn; unresolved and
  explained terms survive memory compaction, traces, resumes, reports, and
  mixed-cache regeneration. Inspect them with `/analysis` or `/analysis
  technical`.
- A single learner turn may adopt several already-staged public premises and
  voice several supported intermediate conclusions. The extractor returns the
  full warranted chain rather than truncating it after one step; unstaged or
  underived follow-ups remain rejected. Accepted spans are recorded as
  `learnerAdvance`, deterministically update `reasoning_span`, `learning_pace`,
  evidence use, agency, and rubric floors, and feed the field, trajectory,
  dynamical state, policy overlays, engagement stance, response configuration,
  transcript, closeout, learning summary, and auto-eval reports. An accelerated
  turn favours brisk/precise peer-level continuation and tells the tutor to
  credit the whole chain and test only the next unresolved edge. Bland, random,
  negative, comprehension, dropout, closure, and predeclared-pressure controls
  retain their declared priority or non-adaptive behavior.
- Tutor response configuration has six independent axes:
  `engagement_stance`, `action_family`, `actorial_part`, `audience_register`,
  `lexical_accessibility`, and `scene_immersion`. `selected_register` remains a
  backward-compatible alias for `engagement_stance`; it must not be used to
  derive the action family. The actorial part determines the public part the
  speaking tutor visibly plays—scene partner, examiner, record-keeper, authored
  clue source, advocate, skeptic, or closer—and receives only public/due
  evidence. An authored enacted clue role takes priority on its release turn.
  The speaking surface remains one continuous utterance: learner uptake and
  pedagogical development are separate trace functions, not two displayed
  paragraphs or voices. An authored clue source must speak its clue from
  inside the role in first person and quotation marks. A role-name prefix or
  stage direction such as `Front-desk clerk, opening the log:` describes the
  acting and must fail the dramatic and actorial guards.
  A hard stance override for comprehension, clue pacing, learner acceleration,
  or a declared pressure probe also replaces the stance distribution supplied
  to character selection with a one-hot distribution; the displaced blend is
  retained separately for trace diagnosis. This prevents character selection
  from acting on a stale pre-override stance.
  `child_accessible` audience register requires an
  explicit public age signal—ordinary confusion defaults to `adult_novice`,
  never to child-directed speech. Every completed tutor response stores a
  deterministic surface audit for whether each configured axis became visible
  in the transcript.
- In `defeasible_human_scaffold`, high-confidence adjacent ellipsis such as
  `it will be the same` is resolved against the immediately preceding
  single-referent public question. The strict learner-DAG may retain an audit
  gap, but the spoken tutor must treat that local question as answered. A
  response audit repairs or replaces drafts that merely ask the same question
  again in different words; case-closing/join answers are not compressed this
  way.
- Combined learner-analysis parsing repairs only a bounded one- or two-delimiter
  JSON truncation and promotes known `learner_record` / `register_selection`
  fields if the missing delimiter nested them under `classification`. It still
  rejects unterminated strings, trailing prose, and larger structural repairs.
- Before any learner-analysis model call, the deterministic harness freezes a
  public-only learner-DAG preflight: the prior public learner record, eligible
  committed premise ids, retractable premise ids, and conclusions reachable
  from current public evidence and public rules. The preflight is supplied as
  a constraint envelope, never as evidence that the learner voiced a move. The
  model maps free-form language to candidate updates; only the deterministic
  postprocessor may validate and commit them. The preflight, including its
  content hash, is stored in the trace and completed turn and appears in
  `/analysis technical`.
- DAG-backed dialogues have an explicit closure lifecycle. Strict grounded and
  asserted learner-DAG closure always requires a terminal tutor act. In human
  interactive sessions, a fully released authored tutor DAG also makes
  conversational closure available: if the tutor states the final verdict, it
  must explicitly close the case rather than ask another proof question. The
  tutor may offer exactly one optional learner check-in; its response must end
  the inquiry without another question. `no thanks` closes immediately without
  another model call. Automated eval stopping and grounded-rate metrics remain
  tied to strict learner-DAG closure, not conversational closure.
- Mixed mode also pre-analyzes the exact cached answer in the background. An
  unchanged Tab or `/use` submission reuses that result; edited text or changed
  turn state invalidates it and runs the normal analysis path.
- After that analysis, mixed mode speculatively generates the tutor response on
  a cloned state. It is reused only when the exact rendered classifier,
  learner-DAG, register, scaffold, transcript, and tutor configuration context
  still matches; otherwise the normal tutor call runs. Regeneration, clear,
  turn invalidation, and exit abort stale Codex subprocesses.
- Change the mixed learner interactively with `/profile <id>`. Use `/profile`
  for the current profile, `/profile list` for the six ordinary/core choices,
  `/profile list stress` for the eight specialist failure modes, `/profile list
  all` for the complete v3 registry, `/profile default` to restore the
  launch-time profile, or `/profile custom <description>` for an ad-hoc
  behavior sketch. Switching aborts and clears the old clue, answer, analysis,
  and prefetched tutor response before regenerating the full chain; Tab
  activates when the replacement answer's ready message appears.
- Visible speaker prompts use readable profile-aware names such as `A Diligent
  Learner >` and `An Answer-Seeking Learner >`; stable profile ids remain in
  traces, settings, reports, and commands. Automated learner output uses the
  same label with `(auto)` appended. A running Node process does not hot-reload
  source changes: use `/quit`, then relaunch the same command with
  `--resume-last` to keep the transcript while loading updated UI text.
- Use `/profile example` for a copyable custom profile. A useful custom sketch
  names an observable recurring behavior, the situation that triggers it, and
  the tutor support that permits progress, without adding hidden case facts.
  For example:

  ```text
  /profile custom The learner can identify individual clues but struggles to connect them. When asked for a conclusion, they repeat the newest clue. They progress only when the tutor asks them to connect two specific public facts.
  ```
- `/analysis` and `/a` default to a plain policy-centered account of the latest
  learner move, engagement-stance blend, independent action/audience/language/
  scene configuration, main signals, tutor aim, and transcript-visible
  realization count. Use `/analysis technical` or `/a technical` for the
  classifier labels, learner/tutor DAGs, field metrics, stance vectors,
  per-axis realization audit, scaffold audit, response checks, and trace path.
- The public CLI calls the combined safety/scaffold/question/closure mechanism
  the `response check`. A successful model rewrite appears as `response
  revised`; a deterministic replacement appears as `safe fallback used`.
  Never describe either one as a `leak-guard repair`: answer secrecy is only
  one of four possible triggers. `/analysis` gives a plain trigger summary and
  `/analysis technical` retains the exact per-check evidence and stable trace
  schema names.
- `/debug on` adds a short, LLM-written prose explanation after every completed
  tutor turn. In no more than three sentences it says what the learner appears
  to understand or need, how the interaction moved, and whether the engagement
  stance changed or held. Use `/debug show` for one prose explanation of the
  latest turn. The former exact diagnostic output remains available as
  `/debug technical` for a one-off view or `/debug on technical` for persistent
  output; `/debug on prose` returns to the default. Use `/debug off` to stop
  all automatic debug output, including turn ids, learner classifier details,
  learner/tutor DAGs, stance efficacy, stance distributions, and calculation
  reasons. Quiet mode retains only the public dialogue and one compact model
  line with latency, honest token availability, effort, current engagement
  stance, action family, and the selected in-scene character (the internal
  `actorial_part`). The mode survives `/reset`, appears with its format in
  `/status` and transcript settings, and writes an `explanatory_debug_output`
  trace event without changing the policy.
- `/transcript` (alias `/html`) refreshes one run-specific, self-contained HTML
  snapshot and opens it in the default browser. It includes raw, script,
  swimlane, analysis, prompt, settings, and Replay JS views; all completed public turns;
  the selected world, model, learner-profile, DAG, register, temperature,
  dropout, memory, stream, and closure options; the full tutor and mixed-learner
  prompts retained so far; and the learner/DAG analysis plus rationale used for
  each register selection. Use `/transcript no-open` to write without launching
  a browser. During a model call, the snapshot deliberately stops at the last
  completed turn. Replay JS contains a minimal provider API request plus the
  exact completed public `user`/`assistant` message sequence. It excludes
  director notes, hidden prompts, DAG state, classifiers, register calculations,
  and response-check machinery. CLI-backed runs are labeled honestly because
  the standalone replay needs the corresponding vendor API key and model
  access. A persistent director-notes ledger remains visible above all seven
  views. It contains the opening directions and only director-issued scene
  notes released through the last completed turn; future notes stay withheld.
  The opening is labeled as an unnumbered prelude, and completed learner-to-
  tutor exchanges begin at turn 1. Swimlanes render the learner message before
  its tutor reply instead of placing the later reply first in the row.
- `/director` (alias `/notes`) repeats the same opening directions and released
  director notes in the CLI, then returns to the live scene with the usual
  tutor-utterance reprise. It never prints future or in-progress director notes
  and records `publicTranscriptChanged: false` in the trace.
- Every tutor-stub conversation with at least one completed tutor turn also
  writes `<run-id>-learning-summary.html` when it concludes, whether through
  natural grounded closure, `/quit`, SIGINT, or the automated learner reaching
  closure. In a real interactive terminal the report opens automatically;
  `TUTOR_STUB_SUMMARY_OPEN=0` suppresses browser launch but still writes it.
  The learner-centred report uses only public dialogue, public learner-record
  evidence, and learner-visible clarification state, so an early exit does not
  disclose unreleased premises or the concealed answer. Finalization is
  idempotent and excludes any tutor turn still in progress.
- In an interactive TTY, `/settings` opens a keyboard control panel rather than
  a read-only dump. Its public labels are Tutor model, Teaching-style range,
  Evidence-memory dropout, Turn-change override, Conversation override, and
  Override sensitivity; the commands and trace schemas retain their technical
  names. Up/Down selects one of these or the separated green
  `Done — apply and return` action; Enter opens a model chooser or numeric
  slider, toggles a pending overlay, or applies the panel when that action is selected.
  Left/Right makes fine slider changes, Page Up/Down makes coarse changes, `R`
  restores the recommended value, Enter accepts that pending edit, and Escape backs out. The panel
  stays open for several edits; `Done — apply and return` commits all pending
  changes, while Escape from the panel discards all of them. Pipes and non-TTY callers retain the settings
  summary and direct command behavior.
  Successful direct `/settings ...` commands are written immediately; panel
  changes are written only when Done is selected, becoming the defaults for the next
  human interactive session. The settings panel's `Forget saved defaults` row,
  or `/settings forget`, deletes that local file without changing the current
  session. `/settings` reports whether remembered defaults are active and where
  they are stored.
  `/settings model` opens the configured tutor-model chooser in a TTY and lists
  configured choices otherwise; `/settings models` shows the complete live
  routing. `/settings models all codex.gpt-5.6-luna` applies a single-model
  override, while `/settings models tutor|classifier|reasoning|learner <ref>`
  splits a role back out. Model changes are rejected during an in-flight tutor turn and
  invalidate mixed suggestion/analysis/tutor-prefetch state before regeneration.
  After a live change, every subsequent tutor request continues replaying all
  prior public `user` and `assistant` messages in original order; `/reset`
  starts a new dialogue with the same full role-history policy.
  `/settings stance-temp` opens its slider in a TTY, while `/settings
  stance-temp 0.4` sharpens subsequent locally selected stance
  distributions; `/settings stance-temp 1.4` broadens them. No other response
  axis is temperature-scaled. `/settings dropout` likewise opens its slider;
  `/settings release-speed` opens the clue-pacing slider, while `/settings
  release-speed 1.5` brings the remaining authored clues forward. All direct
  forms remain available for fast or scripted changes. Interactive
  editing and direct changes are rejected while a tutor turn is in progress so
  each turn has one deterministic setting.
- When `/settings` or another detour command finishes, the CLI prints the latest
  tutor utterance again as `tutor ↻ >` immediately before restoring the
  learner/coach prompt. This applies to help, status, debug, analysis, field,
  visualization, transcript, clarification, report, id, and profile views. The
  reprise is terminal-only (`publicTranscriptChanged: false`), is suppressed
  while a tutor response is still generating, and is not added after immediate
  learner actions such as `/clue`, `/suggest`, `/use`, or `/regen`.
- `/reset` is the recovery command. It works while a human or automated tutor
  turn is still generating: abort the in-flight model work, discard queued
  learner lines and every mixed-artifact cache, reset the transcript and
  learner/register trajectory, then reopen the same scenario. Preserve the
  learner profile and live settings. Record both the `history_clear` boundary
  and `interactive_dialogue_reset` provenance. `/clear` is a backward-compatible
  alias.
- `/settings policy add state` and `/settings policy add field` add live
  strong-change overlays without replacing the primary policy. Use `/settings
  policy remove <state|field>`, `/settings policy clear`, or `/settings policy
  threshold <0..1>` to adjust them. Changes invalidate mixed learner analysis
  and tutor-prefetch caches, apply from the next turn, survive `/reset`, and are
  recorded in traces, `/analysis technical`, and transcript HTML.
- `/settings dropout 0.15` gives each eligible accumulated public premise a
  seeded 15% per-turn chance of leaving the active learner DAG; `/settings
  dropout 0` disables new losses. Dropout is harness-owned, not a role-play
  instruction, and a visible lapse independently selects the
  `reanchor_public_evidence` action family.
- Interim waiting lines rotate labeled plain-language views such as Tutor
  focus, Evidence pacing, Learner reading, Reasoning state, Tutor style, and
  Clue progress. `view n/N` is a carousel position, not a score; restrained
  color distinguishes phase, view number, and panel category.
- Type `/` during a run to open the live slash-command palette above the
  editable prompt. Keep typing to filter it and press Tab to complete; the
  palette remains usable while tutor or learner generation continues. Commands
  include `/demo [turns]`, `/analysis`, `/settings [model|temp n|dropout n]`, `/field`, `/viz`,
  `/transcript`, `/director`, `/notes`, `/clarify [phrase]`, `/explain [phrase]`, `/id`, `/profile`,
  `/clue`, `/hint`, `/suggest`, `/use`, `/regen`, and `/quit`.
- Consecutive public learner lines entered before the tutor reply appears form
  one compound learner turn. Each added line aborts or invalidates the current
  analysis/tutor attempt, every assessment is regenerated from the full input,
  and only the latest transactional state commits. The JSONL trace preserves
  each typed fragment plus the superseded-attempt lifecycle; the public history
  stores one user message and one completed turn with `learnerMessages`.

## Automated Single-Learner Eval

Use for policy comparisons with one generic automated learner:

```bash
npm run tutor:stub:auto-eval -- \
  --runs 3 \
  --policies negative,bland,dynamic,state,field,trajectory,dynamical_system,empirical_dynamical_system,continuous_dynamical_system,continuous_empirical_dynamical_system,random \
  --parallelism 8 \
  --progress-interval 30 \
  --turns until-grounded \
  --safety-turns 120 \
  --auto-learner-profile-id diligent \
  --world world_005_marrick \
  --dag-mode strict_dag \
  --cli-effort medium \
  --history-turns 4 \
  --max-tokens 4096 \
  --trace-dir .tutor-stub-auto-eval/baseline-register-policy-p8 \
  --keep-going
```

Focused adaptive comparison:

```bash
npm run tutor:stub:auto-eval -- \
  --runs 5 \
  --policies dynamic,state,field,trajectory,dynamical_system,empirical_dynamical_system,continuous_dynamical_system,continuous_empirical_dynamical_system \
  --parallelism 8 \
  --progress-interval 30 \
  --turns until-grounded \
  --safety-turns 120 \
  --world world_005_marrick \
  --dag-mode strict_dag \
  --cli-effort medium \
  --history-turns 4 \
  --max-tokens 4096 \
  --trace-dir .tutor-stub-auto-eval/adaptive-register-policy-p8 \
  --keep-going
```

Always dry-run first when changing model refs, policies, or directories:

```bash
npm run tutor:stub:auto-eval -- --dry-run <same flags>
```

Build/update repository-informed register priors before using
`empirical_dynamical_system`. The builder scans both auto-eval and human
interactive traces by default, deduplicates repeated run/turn observations,
keeps human helpfulness separate from objective DAG/field progress, and marks
corpus corrections ineligible unless they improve a chronological
independent-run holdout. Human preference summaries remain advisory-only:

```bash
npm run tutor:stub:register-priors -- \
  --out .tutor-stub-auto-eval/register-empirical-priors.json
```

To add an existing auto-eval summary to the local ledger without re-running
models:

```bash
npm run tutor:stub:auto-eval -- \
  --report-from .tutor-stub-auto-eval/<run>/auto-eval-YYYY-MM-DDTHH-MM-SS-sssZ.json
```

## Resume Failed Auto-Eval Rows

Find the latest summary:

```bash
find .tutor-stub-auto-eval -type f -name 'auto-eval-*.json' -print0 | xargs -0 ls -lt | head
```

Retry only failed rows:

```bash
npm run tutor:stub:auto-eval -- \
  --resume-from .tutor-stub-auto-eval/<run>/auto-eval-YYYY-MM-DDTHH-MM-SS-sssZ.json \
  --resume-statuses failed \
  --parallelism 6 \
  --progress-interval 30 \
  --history-turns 4 \
  --max-tokens 4096 \
  --keep-going
```

If failures say `max_tokens or model output limit was reached`, increase
`--max-tokens`. `--history-turns 4` can reduce auxiliary analysis prompts but
does not compact tutor or learner speaker history. If failures are quota/network
failures, keep the same token cap and rerun after quota/network recovery.

## ABM Learner Panel

Validate personas:

```bash
npm run tutor:stub:abm-panel -- --check
```

Run the full 9-persona panel once per persona:

```bash
npm run tutor:stub:abm-panel -- \
  --live \
  --runs 1 \
  --turns until-grounded \
  --safety-turns 120 \
  --world world_005_marrick \
  --register-policy field \
  --register-palette all \
  --cli-effort medium \
  --keep-going
```

ABM panel output lives under `exports/tutor-stub-abm-panel/<run-id>/`. Rebuild a
panel report from saved artifacts:

The ABM wrapper inherits full speaker-history replay plus tutor-stub's compact
auxiliary-analysis defaults; it does not expose `--history-turns` directly.

```bash
npm run tutor:stub:abm-panel -- --summarize exports/tutor-stub-abm-panel/<run-id>
```

## Reproducible Policy x Learner QA Matrix

Use when the user wants the difference between policies to be robust across
automated learner types, or wants a comprehensive QA environment rather than a
single-policy/single-learner report. The runner writes `qa-plan.json` first,
then one normal auto-eval report per learner profile, then consolidated
`qa-matrix.md` and `qa-matrix.json` robustness reports.

Dry-run the full command expansion first:

```bash
npm run tutor:stub:qa -- --suite core --runs 1 --dry-run
```

Run the core seven-policy QA matrix:

```bash
npm run tutor:stub:qa -- \
  --suite core \
  --runs 1 \
  --profiles diligent,answer_seeking,skeptical,overconfident,low_agency,memory_limited \
  --turns until-grounded \
  --safety-turns 120 \
  --parallelism 6 \
  --world world_005_marrick \
  --cli-effort medium \
  --history-turns 4 \
  --max-tokens 4096 \
  --keep-going
```

Use `--suite pressure` for the cheap `field,negative` profile-discrimination
screen. After it passes, pair `--suite sentinel --profile-suite sentinel
--runs 3` for the representative 60-dialogue comparison. Use `--suite
frontier` when comparing `field`, `trajectory`, the
dynamical-system policies, and continuous policies against `bland`. Use
`--suite adaptive` only when you intentionally want adaptive policies without
same-run controls. Use `--suite audit` when you also need the `negative` floor,
`random` control, and every adaptive policy. `focused` aliases `core`;
`full`/`all` alias `audit`.
Use `--profile-suite sentinel` for a cheaper profile screen (`diligent`,
`proof_skipper`, `false_memory`, `affective_resistant`) and `--profile-suite
stress` for only the sharper failure-mode profiles. Use `--profile-suite audit`
only for an intentional all-profile sweep; `all` is a backward-compatible alias.
Explicit `--profiles` overrides the profile suite.
When testing `affective_resistant`, include a pressure arm such as
`--policies field,negative` so the profile has a real interactional trigger.
Use `--from-dir .tutor-stub-auto-eval/qa-matrix-<timestamp>` to rebuild only the
consolidated reports from existing per-learner summaries.

## Reading the Report Index Console

Regenerate the console with `node scripts/run-tutor-stub-auto-eval.js --index
--index-root .tutor-stub-auto-eval`; live runners also refresh it on their
progress ticks. On the selected-evaluation card:

- **Status chip**: `running` = a runner wrote `run-state.json` within the last
  15 minutes; `stale` = a runner went quiet mid-plan (check its log under Run
  Operations); `completed` = no active runner, verdicts read the latest saved
  report per profile. Hover the chip for the same explanation in place.
- **Progress strip** (under the card head): `X/Y trials finished (%)`, profile
  completion, per-profile live chips, and last-activity age. A `repair pass`
  chip means a `--resume-from ... --resume-statuses failed` pass: it re-plans
  only previously failed trials, so its denominator is smaller than the
  original grid; earlier finished trials stay on disk and in the report.
- **Verdict banner**: `Outcome achieved` = some arm reached >=95% grounded
  closure and >=95% coverage. `Adaptation advantage not established` = no
  non-baseline policy crossed the evidence thresholds (contingency NMI >=0.05
  with >=6 state-action observations; >=3 scored transitions with positive mean
  reward proxy; benefit >+0.02 vs baseline). While the card is `running` the
  banner carries an explicit interim-read caveat.
- **Evidence numbers** (`contingency` / `benefit` / `positive x% / n`): defined
  in the collapsible "How to read these numbers" guide on the Verdict,
  Profile x Policy, and 3D Lab views. Key trap: `n0` means zero scored
  strategy transitions, i.e. missing evidence, not a measured zero effect.
- **3D Lab safeguard**: verdicts are computed only from the flat 2D numbers;
  the 3D projection re-plots them for cluster-spotting and stays locked until
  every plotted point is inspectable as a 2D row (depth/perspective can make
  weak separation look strong).

## Profile Discrimination From Compacted Traces

Use this after a sentinel/stress pilot to test whether learner profiles produce
separable behavior. The analyzer reads full JSONL once, emits compacted
behavior-only traces, then computes profile-pair cosine similarity from
classifier labels, scalar scores, DAG counters, and register-field state.

```bash
npm run analyze:tutor-stub-profile-discrimination -- \
  --trace-root .tutor-stub-auto-eval/<qa-or-profile-screen-run> \
  --write-compacted .tutor-stub-auto-eval/<qa-or-profile-screen-run>/compacted-traces \
  --out .tutor-stub-auto-eval/<qa-or-profile-screen-run>/profile-discrimination.md
```

Use `--json` for a machine-readable report. A useful initial gate is average
pairwise cosine `< 0.85` and max similarity to `diligent < 0.90`; if the gate
fails, the profile prompts are probably not yet differentiated enough to justify
larger runs.
Document the learner-profile robustness evidence and interpretation in
`docs/tutor-stub-learner-profile-robustness.md` when profile schemas or gates
change.

## Field/State Analysis

For ordinary tutor-stub traces:

```bash
npm run analyze:tutor-stub-fields -- \
  --traces-dir .tutor-stub-traces \
  --out /tmp/tutor-stub-field-report.md
```

For auto-eval traces with per-job subdirectories, analyze explicit trace files:

```bash
find .tutor-stub-auto-eval/<run>/traces -name '*.jsonl' -print0 \
  | xargs -0 node scripts/analyze-tutor-stub-field-traces.js --out /tmp/tutor-stub-field-report.md
```

## Multi-Eval / Cross-Run Field

Use when comparing several ingested DB summaries, `auto-eval-*.json` summaries,
or the local ledger.
This treats each eval as a point in a cross-run field with axes for reliability,
effective grounded closure, coverage, turn efficiency, register diversity, and
leak discipline.

Default mode reads `data/evaluations.db` tutor-stub tables when present, then
supplements from the local ledger and discovered report directories:

```bash
npm run analyze:tutor-stub-auto-evals -- \
  --latest 12 \
  --out .tutor-stub-auto-eval/cross-run-field.md
```

DB-only:

```bash
npm run analyze:tutor-stub-auto-evals -- \
  --latest 12 \
  --no-ledger \
  --no-dir \
  --out .tutor-stub-auto-eval/cross-run-field.md
```

From explicit summary files:

```bash
npm run analyze:tutor-stub-auto-evals -- \
  .tutor-stub-auto-eval/<run-a>/auto-eval-*.json \
  .tutor-stub-auto-eval/<run-b>/auto-eval-*.json \
  --out .tutor-stub-auto-eval/cross-run-field.md
```

Use `--json` for machine-readable output. Use `--policies state,field,trajectory,dynamical_system,empirical_dynamical_system,continuous_dynamical_system,continuous_empirical_dynamical_system,dynamic`
to focus policy rows. Use `--no-db` for a filesystem-only report.

## SQL Ingest

Use when the user wants SQL queries across tutor-stub eval summaries. This writes
namespaced tables into `data/evaluations.db`; it does not force tutor-stub rows
into `evaluation_results`.

```bash
npm run tutor:stub:ingest -- \
  .tutor-stub-auto-eval/<run>/auto-eval-YYYY-MM-DDTHH-MM-SS-sssZ.json
```

Ingest the newest local summaries:

```bash
npm run tutor:stub:ingest -- --latest 12
```

Useful views after ingest:

- `v_tutor_stub_policy_summary`
- `v_tutor_stub_register_effects`
- `v_tutor_stub_turn_training`
- `v_tutor_stub_failures`

SQL coverage includes run/row/policy/stance/effectiveness summaries plus
`tutor_stub_turn_frames`, a per-turn table for transition/reward modeling. It
normalizes stance vectors, the legacy selected-register alias, independent
action/audience/lexical/scene fields, response-configuration audits,
learner/DAG/field state, dynamical state and derivative vectors, transcript
text, response metadata, and next-turn deltas. The full row JSON is still
preserved for backward-compatible reconstruction.

Example:

```bash
sqlite3 data/evaluations.db "
SELECT auto_learner_profile_id, policy, rows, ok_rate, grounded_rate, mean_turns_ok
FROM v_tutor_stub_policy_summary
ORDER BY auto_learner_profile_id, grounded_rate DESC, mean_turns_ok ASC;"
```

## Reading Results

Prefer the latest `auto-eval-*.json` / `.html` in the trace dir. Report:

- `ok/failed`, and whether failures are technical or pedagogical.
- Grounded closure rate, mean turns, mean coverage, missing premise count.
- Per-policy comparison: `negative`, `bland`, `dynamic`, `state`, `field`, `trajectory`, `dynamical_system`, `empirical_dynamical_system`, `continuous_dynamical_system`, `continuous_empirical_dynamical_system`, `random`.
- Engagement-stance entropy and dominant stances (`register` remains a legacy report label in older artifacts).
- Response-configuration realization rate and pairwise transcript-visible difference rate; `n/a` means the run did not contain two distinct configurations to compare.
- DAG-fact dropout opportunities, drops, re-adoptions, and active dropped facts at the end when `--dag-fact-dropout` is non-zero.
- Clue-release pace signals, explicit faster/slower requests, final effective speed, and early/on-time/late release counts.
- Bottlenecks: `learner_integration_gap`, `release_or_pacing_gap`, `assertion_gap`, `premature_assertion`, `grounded_asserted_secret`.
- Check `.tutor-stub-auto-eval/ledger.md` for the local cross-run ledger before comparing recent evals.
- For multi-eval comparisons, prefer `npm run analyze:tutor-stub-auto-evals`
  over ad hoc parsing; report the run trajectory and policy field table.

Interpretation guardrails:

- Failed rows are not always pedagogical failures; inspect logs for quota,
  network, unsupported model, and max-token errors.
- `auto_safety_turn_cap` is an incomplete/timeout-like outcome even when row
  status is `ok`.
- Compare `state`, `field`, `trajectory`, `dynamical_system`, `empirical_dynamical_system`, `continuous_dynamical_system`, and `continuous_empirical_dynamical_system` only against a baseline/control if `bland` or
  `random` is present.
