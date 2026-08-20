# Runtime and Policy Defaults

Read this reference before composing or changing a tutor-stub launch: modes, worlds, policies, profiles, models, stopping, output paths, remembered settings, or runtime semantics.

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
- Composed register policies: append `+state`, `+field`, `+edge_timing`, or an
  ordered combination to an adaptive primary, for example
  `--register-policy field+edge_timing`. The
  primary selects first. Each overlay then makes a deterministic counter-choice
  and receives a normalized turn-change score; only an overlay at or above
  `--register-overlay-threshold` (default `0.7`) that recommends a different
  stance may take control. If several qualify, the strongest wins, with stack
  order breaking ties. `bland`, `random`, and `negative` reject overlays so
  control arms remain uncontaminated. Auto-eval accepts composed policy ids in
  `--policies`, such as `--policies bland,dynamical_system+state+field`.
- Resistance-timed edge overlay: `+edge_timing` is opt-in and deterministic. It
  maps publicly expressed boredom or rote parroting to sarcasm, irrelevance or
  a question flood to irony, frustration to a non-edged charismatic stance,
  and content-bearing uptake to precise/plain consolidation. Plain-language
  repair and exposed affect close the edge; explicit register direction and
  existing hard guards retain precedence. The register-selection trace records
  the active menu, timing choice, final applied register, and any later guard.
  Inspect the plain transition with `/analysis` and the full envelope with
  `/analysis technical`. This is the frozen Stage 1 timing seam, not a validated
  learning policy and not a default.
- Empirical dynamical-system policy: run `node scripts/build-tutor-stub-register-priors.js` first, then use `--register-policy empirical_dynamical_system` to add cross-run prior corrections; `empirical-dynamical-system` is accepted as an alias.
- Continuous dynamical-system policies: `continuous_dynamical_system` and `continuous_empirical_dynamical_system` keep `selected_register` and `register_vector` as compatibility aliases while using `engagement_stance` and a weighted engagement-stance blend internally; hyphen aliases are accepted. The empirical variant uses the same register-priors file as `empirical_dynamical_system`.
- Adaptive-performance temperature: default `0.15`. Use the backward-compatible `--register-temperature <n>` launch flag or `/settings stance-temp <n>` (`/settings temp` remains an alias). Lower values sharpen the dominant engagement stance and independently selected actorial part; higher values broaden those two distributions. Action family, audience register, lexical accessibility, and scene immersion remain deterministic and are never temperature-scaled. The supported range is `0.05` to `3.0`. Live changes invalidate and regenerate mixed suggestion analysis/prefetch state.
- Light stochastic adaptation: on by default in ordinary adaptive interactive
  sessions; dedicated automated/control, one-shot, passthrough, and
  no-learner-analysis runs remain off unless explicitly opted in. Use
  `--light-adaptation` or `--no-light-adaptation` at launch, and `/settings
  light on|off|status` or the shorter `/light on|off|status` interactively.
  The keyboard settings panel exposes the same remembered `Difficulty shift`
  toggle. After two
  consecutive public learner turns showing confusion or frustration (adjust
  with `--light-adaptation-threshold <2..8>`), the harness makes seeded,
  replayable uniform draws for engagement stance and actorial host part,
  excluding their immediately previous values when alternatives exist. The
  learner assessment triggers but does not select the new pair. This shallow
  trigger outranks `/register`, `/character`, `/random`, and the configured
  deep register policy for those two axes on that turn; teaching action,
  audience, lexical accessibility, scene, authored evidence, licensed closure,
  and response safety remain authoritative. A resolved/grounded learner turn
  resets the streak. The mode is session-only and survives `/reset`.
- Accumulated DAG-fact dropout: default `0` (off). Use `--dag-fact-dropout <0..1>` and optional deterministic `--dag-fact-dropout-seed <n>`, or change the live rate with `/settings dropout <0..1>`. Only adopted public premises are eligible; background facts are immune; facts receive two grace turns; at most two may be dropped concurrently. A learner can repair a dropped fact by explicitly using or re-adopting it. The public transcript remains intact, exact dropped premise ids stay in technical traces rather than tutor speech, and `0` stops new losses without silently restoring already dropped facts. Live changes invalidate mixed suggestion analysis/prefetch state.
- Clue release speed: default `1.0`. Use `--release-speed <0.5..2>` or `/settings release-speed <0.5..2>` (`pace` and `speed` are aliases). `1` follows authored clue timing; lower stretches the remaining schedule and higher compresses it. Explicit public requests such as “move it along” or “one clue at a time” adapt the effective pace further. At most one authored release batch is introduced per tutor turn (a deliberately co-released premise group stays together), and all evidence, question-support, and leak guards remain active. Pace changes are recorded in turn traces, transcript settings, debug explanations, and learning summaries.
- Every newly available clue is also a visible dramatic beat. After responding to the learner, the tutor lets a character, object, interruption, gesture, or spoken line signal the clue inside the scene; enacts `director` releases as their source (for example a witness or clerk); and handles `tutor` releases as concrete exhibits. It does not announce “let's role-play,” “I'll be the clerk,” or “back to the case.” The selected engagement stance supplies a concrete performance tactic within the selected part, so the same authored source can sound brisk, precise, warm, witnessing, charismatic, or deliberately negative without changing its evidence. The response guard rejects meta-theatrical announcements, opaque clue dumps, missing enactment, merely named characters, unrealized performance tactics, and releases that never hand the evidence to the learner. Worlds may refine the default with `release_schedule[].presentation.mode`, `.role`, and `.cue`; those fields may costume only the linked public premise and must not add evidence.
- Tutor openings hardwire only four requirements: enact the public situation, keep the exact public question visible, imply no unavailable evidence, and invite observation or clarification when no clue is available. A world may supply exact public speech in `opening_frame.authored_text` or narrow the public frame with `opening_frame.situation`; otherwise the active speaking tutor model (Terra by default) realizes the setting, question, presentation metadata, and opening-only clue surfaces. Every candidate receives a structural plus evidence-boundary audit before history commit; failures use a world-grounded deterministic fallback rather than the former shared “Keep the case question in view” boilerplate.
- DAG discourse mode: default `strict_dag` is the proof-audit baseline. Use `--dag-mode human_scaffold` or `--dag-mode defeasible_human_scaffold` when testing the human-facing scaffold that allows ordinary-language warrant framing, side arcs, compressed human inference, and internal proof debt while the strict DAG remains the audit.
- Negative floor: `--register-policy negative` samples only `ironic`, `sarcastic`, and `face_threat`; use it as an explicit lower-bound/control arm, not as recommended pedagogy.
- Automated learner profile: default `diligent`; vary with `--auto-learner-profile answer_seeking|skeptical|overconfident|low_agency|memory_limited|premature_closure|proof_skipper|false_memory|contradiction_keeper|affective_resistant|low_trust_skeptic|counterexample_hunter|goalpost_shifter|bored|frame_defiant|fast_learner|slow_learner` (or the character-facing alias `--learner-character`), or list presets with `--list-learner-profiles`. Built-ins are structured learner-profile contracts (`machinespirits.tutor-stub.learner-profile-contract.v4`) rendered into automated-learner prompts and preserved in report config. The first six are core profiles; the latter twelve are sharper stress profiles. `bored` withholds effort without permission-seeking; `frame_defiant` disputes jurisdiction over the inquiry frame rather than evidence, tone, or trust. `counterexample_hunter` tests every rule with a counterexample, `goalpost_shifter` raises a new acceptance condition, `fast_learner` grounds the current reasoning link then asks for the next clue, and `slow_learner` retains evidence but asks to settle one clue at a time.
- Learner profile suites: `core` is the routine robustness suite; `sentinel` is the cheap discrimination screen; `stress` is targeted failure-mode probing; `audit` is the expensive all-profile sweep. `all` remains accepted as an alias for `audit`, but do not use it as the default QA matrix.
- Runs: default `3` for baseline comparisons, `5` for core/frontier policy comparisons, `1` for ABM panels.
- Models: the interactive named tutor defaults to speaking tutor `codex.gpt-5.6-terra` at `medium` CLI effort, analysis/classifier/DAG `codex.gpt-5.6-sol`, and automated learner `codex.gpt-5.6-terra`. Generic auto-eval, QA-matrix, and ABM-panel launches instead default every otherwise-unpinned Codex role to `codex.gpt-5.6-luna`. Explicit launch overrides and frozen experiment pins always win.
- Learned warrant committee: human interactive chat defaults to the local
  `program2-sft-instruct-v2` Qwen specialist with fallback policy `v2`. It is
  consulted only on detected `warrant_skip` moments; the frontier tutor still
  composes the delivered turn, and mini-model unavailability falls back to the
  frontier path. Use `/committee on|off|status` inside a session (no argument
  toggles), or `--committee` / `--no-committee` at launch. The preference is
  remembered. Automated, one-shot, passthrough, and eval runs retain explicit
  arm selection and do not inherit the human-chat default; use
  `--point-of-action-arm committee --committee-fallback-policy v2` when an
  experiment intentionally needs the validated committee path.
- Browser voice companion: use `/voice` in an interactive session, or launch
  with `--voice`. The default renderer is `gpt-realtime-2.1-mini` with the
  `marin` voice; switch with `/voice model gpt-realtime-2.1` or
  `/voice speaker <name>`. This is a fifth, independent model role and is never
  changed by `--all-models`: OpenAI Realtime transcribes microphone speech and
  voices only the accepted tutor text, while the existing learner analysis,
  DAG, register, response checks, trace, and compound-turn restart path remain
  authoritative. The standard `OPENAI_API_KEY` stays in the local server;
  automatic Realtime replies are disabled. Use `/voice status` and `/voice off`
  to inspect or stop it. For a credential/schema smoke without a browser, run
  `node scripts/smoke-tutor-stub-realtime.js`.
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
  plus the last speaking-tutor model, Realtime voice model and voice name,
  terminal theme and motion preference, learned-committee preference,
  light-adaptation preference, engagement-stance temperature, DAG-fact dropout
  rate, clue release speed,
  register primary and overlays, and overlay threshold in
  `.tutor-stub-traces/last-settings.json`.
  Explicit CLI/environment values win; automated, one-shot, piped, and eval
  runs neither load nor write this file. Use `--no-remember-settings` for a
  clean interactive launch or `TUTOR_STUB_SETTINGS_FILE` to relocate it.
- Training reuse is a separate remembered governance setting. Owner-operated
  human and mixed-authorship sessions default to `training_candidate`; use
  `--training-reuse off`, `--no-training-reuse`, or `/settings training-reuse
  off` to mark the source and descendants `do_not_train`. `/settings
  training-reuse on|off|status` and the keyboard **Training reuse** row expose
  the live state. `--human-subject-class external_user|unknown` always fails
  closed to `do_not_train`; automated-only sessions report `not_applicable`.
  The resolved setting is recorded in session recipes, `run_start`, transcript
  settings, feedback provenance, closeout, learning summaries, and `run_end`;
  trace resume reapplies the latest live choice.
- Model provenance: treat the observed tutor, analysis, and learner models in
  `profile-discrimination.md/json` as authoritative. A requested model in
  `qa-plan.json` is configuration intent only. Once a same-model profile gate
  passes at `n=3`, a different-model rerun is optional cross-model robustness,
  not a prerequisite for profile discrimination.
- Parallelism: default `8` for `auto-eval`; ABM panel is currently serial.
- Turn stopping: default `--turns until-grounded --safety-turns 120`.
- Token cap: default `--max-tokens 4096` for `auto-eval` and resumes to avoid output-limit failures.
- Speaker history: tutor and learner calls normally replay the complete public dialogue as speaker-relative `user`/`assistant` messages. If a long automated-learner replay alone would exceed its audited prompt budget, that call keeps a tutor-led recent window and an explicit public omission marker; other audit failures remain fail-closed. Direct API providers retain native roles; the Codex/Claude CLI bridge alone flattens them at the transport boundary.
- Analysis memory compaction: default on; `--history-turns 4` controls the raw recent window plus compact state/field/dialogue summaries used by auxiliary classifier, learner-record, and clarification prompts. It also sets the recent-turn target for the automated-learner budget fallback. `--no-memory-summary` disables auxiliary summaries but does not disable the budget fallback.
- Trace/output dir: default `.tutor-stub-auto-eval/<descriptive-run-id>` for auto-eval, `exports/tutor-stub-abm-panel` for ABM.
- Eval ledger: default `.tutor-stub-auto-eval/ledger.jsonl` plus `.tutor-stub-auto-eval/ledger.md`; this is local/ignored. Use `--no-ledger` to skip. For SQL querying, ingest JSON summaries into `data/evaluations.db` with `npm run tutor:stub:ingest`.
- Debug turn ids: automatic `turn id > <run-id>:tNNN` lines appear only in persistent technical debug mode. `/id` (aliases `/turn-id`, `/debug-id`) always prints the last completed or in-progress id plus the exact JSONL trace path and copies that complete diagnostic block to the system clipboard for pasting into Codex. Clipboard failure is non-fatal and leaves the printed block available for manual selection.
- Live release notes: `/release-notes` rebuilds a 24-hour tutor-stub change view
  from Git on each invocation; `/release-notes <hours>` accepts 1-168. It groups
  product commits by their expected dialogue, recovery, dramatic-delivery, or
  CLI effect and separates verification-only commits. It is available in normal
  and passthrough modes, never enters public message history, and reprises the
  latest tutor utterance before returning to the scene.

Do not recommend `codex.mini`, `codex.gpt-mini`, or `codex.gpt-5-mini`; the local
Codex ChatGPT-account route rejects those. Use `codex.gpt-5.6-terra` for the
CLI-backed speaking tutor, `codex.gpt-5.6-sol` for classification and learner-DAG
interpretation, `codex.gpt-5.6-terra` for the automated learner, or `openai.mini`
/ `openrouter.gpt-mini` for GPT mini.
