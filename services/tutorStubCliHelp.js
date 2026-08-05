/**
 * Pure launch-time help projection for the tutor-stub CLI.
 * Argument parsing, terminal output, runtime defaults, and command handling
 * remain owned by scripts/tutor-stub.js.
 */
export function renderTutorStubCliHelp({
  STUB,
  PROGRAM2_COMMITTEE_DEFAULTS,
  MIN_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
  MAX_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
  MIN_TUTOR_STUB_RELEASE_SPEED,
  MAX_TUTOR_STUB_RELEASE_SPEED,
  MAX_TUTOR_STUB_MODEL_CALL_BUDGET,
  TUTOR_STUB_CLI_THEME_IDS,
  TUTOR_STUB_CLI_MOTION_IDS,
  DEFAULT_INTERACTIVE_DEMO_TURNS,
  TUTOR_STUB_VOICE_MODELS,
}) {
  return `Usage:
  npm run tutor:stub -- [options]
  node scripts/tutor-stub.js [options] [first learner message]

Default npm launch:
  mixed_drafting (human scaffold + inspectable AI learner drafts)
  choose explicitly with --lab mixed_drafting; use --list-labs for alternatives

Options:
  --tutor <id[@vN]>     named, versioned speaking-tutor instance
                         (default: ${STUB.tutor})
  --tuning <off|capture|on|canary>
                         capture feedback and create reviewable tutor-version
                         candidates; canary runs the approved candidate version
                         (default: ${STUB.tuning})
  --tuning-dir <path>   local evidence, version, candidate, and replay store
                         (default: .tutor-stub-tuning; env TUTOR_STUB_TUNING_DIR)
  --passthrough          pure speaker baseline: system setup + full public
                         history + latest learner message; exactly one model
                         call per turn, with analysis and harness policy off
  --all-models <ref>     use one provider alias for tutor, classifier,
                         learner-DAG analysis, and automated/mixed learner;
                         overrides all four role-specific model flags
  --model <ref>          provider alias from config/providers.yaml
                         examples: openai.mini, openrouter.sonnet-5,
                         codex.gpt-5.6-terra, claude-code.sonnet
                         (default speaking tutor: ${STUB.model})
  --point-of-action-arm <standing_book|triggered_placebo|side_coach|compiled_constraint|committee|silent_control>
                         frozen final-stretch Step 4 intervention arm, plus
                         the Phase 5 live-pilot arms: committee (local mini
                         writes the warrant question, the frontier composes
                         around it verbatim, fail-closed battery decides) and
                         silent_control (detector logs only, no intervention)
  --point-of-action-opportunity-protocol <off|first_admissible_warrant_v1>
                         retest-only controlled exposure: between turns 15-21,
                         use the first no-release turn whose final handoff
                         permits a question; requires the committee arm
  --committee            use the learned Qwen warrant specialist in human chat
                         (the interactive default; shorthand for the committee arm)
  --no-committee         keep human chat on the frontier-only response path;
                         the choice is remembered and /committee changes it live
  --committee-mini-model <name>
                         ollama model tag for the committee mini
                         (default: ${PROGRAM2_COMMITTEE_DEFAULTS.miniModel})
  --committee-ollama-url <url>
                         local ollama endpoint for the committee mini
                         (default: ${PROGRAM2_COMMITTEE_DEFAULTS.ollamaUrl})
  --committee-span-interface <v1|v2>
                         v1 retains all question sentences; v2 selects one
                         cue-preserving, non-generative span
  --committee-fallback-policy <v1|v2|cue_blind>
                         v1 ships the greedy mini reply unchecked (Phase 5);
                         v2 applies the fallback battery: greedy check, two
                         resamples, cue-preserving trim (Phase 5b); cue_blind
                         is reserved for the weights x interface experiment
  --classifier-model <ref>
                         learner-input classifier model (default: ${STUB.classifierModel})
  --no-classifier        skip the upfront learner-input classifier
  --tutor-learner-dag    track the learner's public evidence and reasoning privately
  --learner-record-model <ref>
                         model for --tutor-learner-dag; when the classifier is
                         also on, this single call returns both outputs
                         (default: ${STUB.learnerRecordModel})
  --learner-analysis-prompt-profile <baseline|compact_v1>
                         learner-analysis prompt profile; compact_v1 removes
                         only duplicate question text and JSON indentation
  --no-register-selection
                         keep tutor speaking style fixed instead of adapting it
  --register-palette <all|safe|negative|non-simulated|csv>
                         tutor-register palette for selection (default: all);
                         all includes every register in the registry
  --register-policy <dynamic|state|field|trajectory|dynamical_system|empirical_dynamical_system|continuous_dynamical_system|continuous_empirical_dynamical_system|bland|random|negative>
                         dynamic lets the reviewer choose; field maps observed
                         field/DAG movement to a local probability distribution;
                         trajectory extends field with recent velocity, slope,
                         acceleration, and risk trends;
                         dynamical_system maps a continuous state/derivative
                         vector through theory priors plus empirical efficacy;
                         empirical_dynamical_system additionally loads
                         cross-run empirical priors when available;
                         continuous_* variants keep a nearest register label
                         but pass a weighted engagement-stance blend to the tutor;
                         state maps current classifier/DAG state to a local
                         probability distribution;
                         bland fixes a plain non-adaptive baseline register;
                         random samples uniformly from the active palette;
                         negative samples only ironic, sarcastic, face_threat
                         (default: ${STUB.registerPolicy}); append +state and/or
                         +field to add strong-change overlays, for example
                         dynamical_system+state+field
  --register-overlay-threshold <n>
                         minimum normalized turn-change strength in [0,1]
                         before an added state/field policy may override the
                         primary policy (default: ${STUB.registerOverlayThreshold})
  --safe-registers       limit automatic tutor-register selection to the
                         conservative router palette; explicit /register keeps
                         every non-simulated dramatic choice available
  --register-empirical-prior <path|auto|off>
                         JSON prior built by
                         scripts/build-tutor-stub-register-priors.js;
                         empirical_dynamical_system defaults to auto
  --register-temperature <n>
                         teaching-style range; lower concentrates the strongest
                         style and part, higher mixes in more alternatives (default: ${STUB.registerTemperature};
                         range: ${MIN_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE}-${MAX_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE})
  --light-adaptation     enable seeded style + character shifts after continued
                         learner confusion or frustration (default in ordinary
                         adaptive interactive sessions)
  --no-light-adaptation  disable those difficulty-triggered shifts
  --light-adaptation-threshold <n>
                         consecutive difficult learner turns required before
                         the light shift activates (default: ${STUB.lightAdaptationThreshold}; range: 2-8)
  --training-reuse <on|off>
                         allow or opt this owner-operated human/mixed session
                         out of future governed training-corpus candidacy
                         (default: ${STUB.trainingReuse})
  --no-training-reuse   opt this session and its descendants out of training use
  --human-subject-class <owner_operator|external_user|unknown>
                         provenance class for human input; external and unknown
                         always fail closed to do_not_train
  --dag-fact-dropout <n> probability in [0,1] that previously understood
                         evidence is temporarily forgotten after a learner turn
                         (default: ${STUB.dagFactDropout}; off at 0)
  --dag-fact-dropout-seed <n>
                         non-negative deterministic seed for fact dropout
                         (default: ${STUB.dagFactDropoutSeed})
  --release-speed <n>    base clue-release speed: 1 follows the authored schedule,
                         lower slows it, higher releases clues sooner; explicit
                         learner pace requests adapt it further (default: ${STUB.releaseSpeed};
                         range: ${MIN_TUTOR_STUB_RELEASE_SPEED}-${MAX_TUTOR_STUB_RELEASE_SPEED})
  --run-seed <n>         non-negative master seed for policy draws (default: ${STUB.runSeed})
  --eval-repeat <n>      repetition identity used in policy draw keys (default: 1)
  --eval-job-id <id>     optional stable job identity used in policy draw keys
  --loop-mode <strict|diagnostic>
                         strict fails the turn when every guarded response is
                         rejected; diagnostic rolls back recoverable turn state,
                         emits a fixed public-safe quarantine continuation, and
                         continues collecting the requested fixed horizon
  --typed-actions        opt into Plan 2 typed pedagogical-action selection;
                         default off, with the decision persisted before output
  --typed-action-task-id <id>
                         stable task identity for typed actions
  --typed-action-knowledge-component <text>
                         knowledge component targeted by the task
  --typed-action-prerequisites <csv>
                         ordered prerequisite path for the task
  --typed-action-item-difficulty <0..1>
                         task difficulty supplied independently of move/support/register
  --typed-action-support-level <0..3>
                         optional fixed support level; blank uses the action default
  --world <id|path|none> detective-story world (default: ${STUB.world})
  --curriculum <workplan|path>
                         load the live workplan or a canonical curriculum YAML
                         as public reflective source material (non-DAG mode)
  --module <id>          module/card to load from --curriculum
  --list-curriculum-modules
                         list modules in --curriculum and exit
  --dag                  add hidden proof DAG + release schedule to tutor prompt;
                         also prints the tutor desire-DAG after each turn
  --dag-mode <strict_dag|human_scaffold|defeasible_human_scaffold>
                         label the proof-discourse mode for traces/reports.
                         Phase 1 records scaffold/debt/side-arc fields without
                         changing tutor behavior (default: ${STUB.dagMode})
  --list-worlds          list available detective-story worlds and exit
  --launch-mode <chat|labelling-game>
                         choose the top-level launch surface; plain interactive
                         launches show a keyboard mode picker (default: chat)
  --labelling-game       run the consolidated human-labelling harness instead
                         of starting a tutoring dialogue (compatibility alias)
  --label-dataset <id>   superego-taxonomy or tutor-stub-impasses
  --label-coder <id>     rater id for the labelling output sidecar;
                         overrides LABELLING_GAME_CODER from .env
  --list-tutors          list named, partitioned tutor instances and exit
  --list-learner-profiles
                         list built-in automated learner profiles and exit
  --list-labs            list versioned capability labs and exit without model calls
  --lab <id>             apply a declared lab configuration; explicit flags win
                         (use --list-labs for audience, maturity, cost, and safety)
  --features             show the tutor-stub capability map and quick starts
  --topic <text>         tutoring topic (default: ${STUB.topic})
  --learner <text>       learner sketch
  --goal <text>          tutor objective
  --style <text>         tutor style constraints
  --system <path>        replace generated system prompt with a file
  --once <text>          run one turn and exit
  --auto-learner         run unattended with an LLM learner
  --auto-learner-model <ref>
                         provider alias for the automated learner
                         (default: ${STUB.autoLearnerModel})
  --auto-learner-profile <id|text>
                         built-in profile id or custom learner behavior sketch
                         (default: diligent)
  --learner-character <id|text>
                         character-facing alias for --auto-learner-profile
  --tutor-character <part>
                         lock the tutor host part for this session; the same
                         full dramatic range is available to adaptive policies
  --auto-turns <n|until-grounded>
                         maximum learner turns in --auto-learner mode, or
                         until-grounded to stop only at grounded closure
                         (default: ${STUB.autoTurns})
  --auto-safety-turns <n>
                         runaway guard used when --auto-turns until-grounded
                         (default: ${STUB.autoSafetyTurns})
  --model-call-budget <n>
                         required hard cap for automated_eval and research_controls;
                         every attempted provider call consumes one slot
                         (range: 1-${MAX_TUTOR_STUB_MODEL_CALL_BUDGET})
  --acknowledge-research-use
                         required on every research_controls launch; this consent
                         flag is deliberately not persisted in session recipes
  --no-auto-stop-on-grounded
                         keep running until --auto-turns even after the
                         learner-DAG reaches grounded asserted-secret closure
  --mixed-learner        manual interactive mode with a background learner clue
                         and suggested reply after each tutor response; the prompt,
                         /suggest, and /use show how it expresses the active profile;
                         use /clue, Tab, /suggest, /use, or /regen
  --mixed-mode           alias for --mixed-learner
  --demo                 run the guided harness demonstration after the opening;
                         the same tour is available inside a scaffold with /demo
  --save <path>          write transcript JSON on exit
  --trace-dir <path>     write JSONL model-call traces here
                         (default: ${STUB.traceDir})
  --settings-file <path> local remembered interactive settings
                         (default: ${STUB.settingsFile})
  --theme <name>         terminal theme: ${TUTOR_STUB_CLI_THEME_IDS.join(', ')}
                         (default: ${STUB.cliTheme}; env TUTOR_STUB_CLI_THEME)
  --motion <level>       terminal motion: ${TUTOR_STUB_CLI_MOTION_IDS.join(', ')}
                         auto respects TTY, CI, and reduced-motion signals
                         (default: ${STUB.motion}; env TUTOR_STUB_MOTION)
  --no-color             disable terminal color; NO_COLOR is also respected
  --no-remember-settings
                         ignore and do not update the last interactive settings
  --no-trace             disable automatic local tracing
  --resume-last          resume the newest completed dialogue found in trace-dir
  --resume <run-id|path> resume an explicit trace; this always wins over mtime
  --recipe <path>        load a versioned, hash-verified session recipe
  --write-recipe <path>  write the fully resolved recipe before the first model call
  --acknowledge-drift    explicitly permit recorded world/prompt/tutor/model/schema
                         drift while resuming; otherwise resume fails closed
  --no-stream            disable token streaming for API-backed model calls
  --no-interim-animation disable the temporary state/field status animation
                         shown while model calls are waiting
  --no-memory-summary    disable compact state/field dialogue memory in prompts
  --field-viz            write/update lightweight field SVG + JSON artifacts
                         in trace-dir after each completed turn
  --multiple-choice      allow compact multiple-choice tutor prompts
                         (off by default)
  --no-opening           do not print the tutor's default opening prompt
  --opening-realizer <model|deterministic>
                         realize unauthored public openings with the speaking
                         tutor model (default) or the world-grounded fallback
  --no-closeout-report   do not print the compact dialogue closeout on exit
  --no-turn-feedback     do not ask for optional thumbs feedback after tutor
                         messages (on by default in human learner mode)
  --no-response-details  hide the compact model, timing breakdown, token, and
                         tutor-style details for this session
  --voice                launch the local browser voice companion after the
                         opening (also available at any time with /voice)
  --voice-model <model>  OpenAI Realtime renderer, separate from the four
                         text-model roles (default: ${STUB.voiceModel})
  --voice-name <voice>   Realtime speaking voice (default: ${STUB.voiceName})
  --cli-effort <level>   effort for codex/claude-code CLI calls:
                         low, medium, high, xhigh, max, or config
                         (default: ${STUB.cliEffort})
  --mixed-tutor-prefetch-policy <always|analysis_only>
                         warm the full tutor reply (current default), or warm
                         only the learner analysis until the learner submits
  --temperature <n>      API temperature (default: ${STUB.temperature})
  --max-tokens <n>       response token cap for API providers (default: ${STUB.maxTokens})
  --history-turns <n>    raw recent turns kept in compact analysis prompts
                         and the auto-learner overflow fallback (default: ${STUB.historyTurns});
                         speaker calls otherwise replay full role history
  --show-prompt          print the system prompt before starting
  --dry-run              print resolved config and first payload, but do not call a model
  --help                 show this message

Interactive commands:
  /demo [turns]          run a guided live harness tour (default: ${DEFAULT_INTERACTIVE_DEMO_TURNS} turns)
  /theme [name]          inspect or switch the live terminal theme
  /motion [level]        inspect or switch full, subtle, or off motion
  /details [on|off|status]
                         show or hide compact response and turn-timing details
  /analysis              explain the learner reading and teaching approach plainly
  /analysis technical    show the full classifier, reasoning-map, field, and trace evidence
  /a                     alias for /analysis
  /proof                 check the Nocturne Lean certificate and semantic-web projections
  /proof check [lean|semantic]
                         run both proof checks or one named check
  /proof inspect [authored|learner|tutor]
                         inspect graph counts, boundaries, and artifact paths
  /proof export          regenerate and validate the semantic-web fixture
  /proof paths           show the raw certificate and graph artifact locations
  /field                 show a lightweight interaction-field trajectory
  /f                     alias for /field
  /viz                   write a lightweight field SVG + JSON now
  /v                     alias for /viz
  /clarify [phrase]      explain a complex or unclear term from tutor dialogue
  /explain [phrase]      alias for /clarify
  /c [phrase]            alias for /clarify
  /translate [level]     rewrite the latest tutor reply in contemporary standard
                         English (basic by default); in a curriculum session,
                         translate the canonical module (all levels by default)
  /report                show the compact dialogue closeout report
  /r                     alias for /report
  /director              repeat all director notes issued so far
  /director ask <question>
                         privately ask the director how to use this CLI/session
  /director <request>    privately direct a persistent change to later tutor replies
  /meta ask <question>   explicit alias for a private CLI/session question
  /meta <request>        explicit alias for a learner-to-director tutor-change request
  /meta [status|clear]   inspect or clear the active private director request
  /notes                 view-only alias for bare /director
  Left/Right on an empty prompt
                         rate the latest tutor message down/up immediately
  Escape on an empty prompt
                         hide optional tutor feedback for the rest of the session
  /up, /down             rate the latest tutor message helpful or unhelpful
                         without sending a learner turn
  /feedback [up|down] [reason] [comment]
                         inspect, set, clear, enable, or disable optional ratings
  /tune                  show the named tutor version and tuning status
  /tune on|off|reasons|review
                         capture typed feedback and inspect bounded candidates
  /tune approve|replay|validate|promote|rollback ...
                         test and explicitly promote or revert a tutor version
  /scenario              choose another scenario and start it as a new inquiry
  /scenario <id>         start a named scenario directly
  /board                 choose a live workplan card and start a reflective inquiry
  /board <item-id>       start a named workplan card directly
  /voice                 start or reopen the browser microphone companion
  /voice status|off      inspect or stop the local voice bridge
  /voice model <model>   choose ${TUTOR_STUB_VOICE_MODELS.join(' or ')}
  /voice speaker <name>  choose the speaking voice for the next voice session
  /settings              open the live keyboard settings panel (TTY)
  /settings model        choose a configured tutor model (TTY) or list models
  /settings model <ref>  change the speaking tutor model for subsequent turns
  /settings models       show every tutor/learner model role
  /settings models all <ref>
                         use one model for every role
  /settings models tutor|classifier|reasoning|learner <ref>
                         change one role independently
  /settings temp [n]     adjust or set teaching-style range
  /settings dropout [n]  adjust or set recoverable evidence-memory loss (0-1)
  /settings light [on|off|status]
                         configure difficulty-triggered style + character shifts
  /settings training-reuse [on|off|status]
                         inspect or change training-corpus candidacy for this session
  /settings release-speed [n]
                         adjust or set clue-release speed (0.5-2)
  /settings forget       stop using the saved defaults after this session
  /release-notes [hours]
                         show recent tutor-stub changes and their expected effects
  /metrics               show repository source, Git, and available GitHub metrics
  /features              show the capability map, quick starts, and active mode
  /lab [list|id]         show the active lab or a safe lab's relaunch command
  /id                    show and copy the current debug id and trace path
  /turn-id, /debug-id    aliases for /id (automatic ids require technical debug)
  /character            choose learner or tutor character controls
  /character learner [profile]
                         choose or switch the mixed learner behavior profile
  /character tutor [part]
                         choose and lock the tutor part; restates the last intent
  /learner [profile]     alias for /character learner [profile]
  /tutor [part]          alias for /character tutor [part]
  /mode learner|coach|auto
                         switch the role played by subsequent terminal input
  /profile               show the active suggested-learner profile
  /profile list          list the six ordinary learner profiles
  /profile list stress   list ten specialist failure-mode profiles
  /profile list all      list the complete v3 profile registry
  /profile example       show a copyable custom-profile example
  /profile <id>          switch profile and regenerate mixed artifacts
  /profile default       restore the command-line/default profile
  /profile custom <text> use a custom learner behavior sketch
  /clue, /hint           show the ready non-revealing learner clue
  /suggest               show the ready response and its profile expression
  /use                   show the profile expression, then submit the response
  /regen                 regenerate clue, answer, analysis, and tutor response
  /reset                 cancel unfinished work and restart this scenario
  /clear                 alias for /reset
  /help                  show interactive commands
  /quit                  exit

Passthrough baseline:
  npm run tutor:stub:passthrough
                         starts without an opening or auxiliary model calls;
                         type the first learner message to begin pure chat

Prompt editing:
  Alt/Option+Left/Right or Ctrl+Left/Right
                         move by word
  Shift+Left/Right       select by character
  Alt/Option+Shift+Left/Right or Ctrl+Shift+Left/Right
                         select by word
  Shift+Home/End         select to the beginning/end of the line
  Type or press Backspace/Delete to replace/remove selected text

Environment:
  OPENAI_API_KEY         required for openai.* and the /voice Realtime bridge
  OPENROUTER_API_KEY     required for openrouter.*
  TUTOR_STUB_ALL_MODELS  optional one-model override for all four model roles
  TUTOR_STUB_MODEL       optional default model override
  TUTOR_STUB_CLASSIFIER_MODEL
                         optional default classifier model override
  TUTOR_STUB_LEARNER_RECORD_MODEL
                         optional default learner-record / combined-analysis model override
  TUTOR_STUB_LEARNER_ANALYSIS_PROMPT_PROFILE
                         baseline (default) or compact_v1
  TUTOR_STUB_TOPIC       optional default topic override
  TUTOR_STUB_WORLD       optional default detective-story world
  TUTOR_STUB_TURN_FEEDBACK=0
                         disable optional per-message thumbs feedback
  TUTOR_STUB_RESPONSE_DETAILS=0
                         hide compact response and timing details by default
  TUTOR_STUB_DAG_MODE    optional DAG discourse mode: strict_dag,
                         human_scaffold, or defeasible_human_scaffold
  TUTOR_STUB_LIGHT_ADAPTATION=0|1
                         disable or explicitly enable difficulty-triggered shifts
  TUTOR_STUB_TRACE_DIR   optional default trace directory
  TUTOR_STUB_SETTINGS_FILE
                         optional remembered-settings file path
  TUTOR_STUB_REMEMBER_SETTINGS=0
                         disable remembered interactive settings; =1 also
                         enables them for non-TTY harness tests
  TUTOR_STUB_STREAM=0    disable token streaming by default
  TUTOR_STUB_INTERIM_ANIMATION=0
                         disable interim state/field animation by default
  TUTOR_STUB_FIELD_VIZ=1 enable field visualization artifacts by default
  TUTOR_STUB_MULTIPLE_CHOICE=1
                         enable multiple-choice prompts by default
  TUTOR_STUB_OPENING=0   disable default tutor opening prompt
  TUTOR_STUB_OPENING_REALIZER
                         model (default) or deterministic
  TUTOR_STUB_CLIPBOARD=0 disable automatic clipboard copying for /id
  TUTOR_STUB_CLOSEOUT_REPORT=0
                         disable default closeout report
  TUTOR_STUB_SUMMARY_OPEN=0
                         still write the automatic learning summary on
                         conclusion, but do not launch it
  TUTOR_STUB_CLI_EFFORT  optional default CLI effort override
  TUTOR_STUB_REGISTER_POLICY
                         optional default register policy: dynamic, state,
                         field, trajectory, dynamical_system,
                         empirical_dynamical_system,
                         continuous_dynamical_system,
                         continuous_empirical_dynamical_system, bland, random,
                         or negative
  TUTOR_STUB_REGISTER_EMPIRICAL_PRIOR
                         optional JSON prior path for empirical register mapping
  TUTOR_STUB_REGISTER_TEMPERATURE
                         optional default register-selection temperature
  TUTOR_STUB_TYPED_ACTIONS=1
                         enable opt-in typed pedagogical-action selection
  TUTOR_STUB_TYPED_ACTION_TASK_ID
  TUTOR_STUB_TYPED_ACTION_KNOWLEDGE_COMPONENT
  TUTOR_STUB_TYPED_ACTION_PREREQUISITES
  TUTOR_STUB_TYPED_ACTION_ITEM_DIFFICULTY
  TUTOR_STUB_TYPED_ACTION_SUPPORT_LEVEL
                         optional typed-action task/support defaults
  TUTOR_STUB_AUTO_LEARNER_MODEL
                         optional default automated learner model
  TUTOR_STUB_AUTO_TURNS  optional default automated learner turn cap
  TUTOR_STUB_AUTO_SAFETY_TURNS
                         optional runaway guard for until-grounded mode
  TUTOR_STUB_AUTO_LEARNER_PROFILE
                         optional built-in id or custom automated learner profile
  TUTOR_STUB_MIXED_LEARNER=1
                         enable mixed manual/autocomplete learner mode
  TUTOR_STUB_MIXED_TUTOR_PREFETCH_POLICY
                         always (default) or analysis_only
`;
}
