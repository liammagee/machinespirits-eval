export function createTutorStubInteractiveDirectorController(dependencies) {
  const {
    C,
    ROOT,
    TUTOR_STUB_CLI_DIRECTOR_SYSTEM_PROMPT,
    appendTraceEvent,
    buildTutorStubCliDirectorPrompt,
    callPromptModel,
    cleanTutorStubCliDirectorReply,
    clearStatusLine,
    clearTutorStubDirectorGuidance,
    displayDiagnosticLabel,
    explicitPerformanceDirectiveValue,
    getActorialPartDefinitions,
    getInterimState,
    isProcessingTurn,
    latestTutorMessage,
    learnerProfileDescription,
    learnerProfileIds,
    liveModelRoleRef,
    mixedLearner,
    mixedLearnerProfilePresentation,
    normalizeTutorStubCliDirectorQuestion,
    oneLine,
    printWithConcurrentTerminal,
    projectTutorStubProofDagArtifactPaths,
    projectTutorStubProofDagSemanticLayerLines,
    resetMixedLearnerSuggestion,
    setTutorStubDirectorGuidance,
    spawnSync,
    startInterimAnimation,
    startMixedLearnerPrefetch,
    state,
    stopInterimAnimation,
    tutorStubCanonicalCommandToken,
    tutorStubCommandSummary,
    tutorStubCommandTokens,
    tutorStubConfigurableActorialPartIds,
    tutorStubDirectorGuidanceSnapshot,
    tutorStubStaticCommandCompletions,
  } = dependencies;

  function cliDirectorApplicationContext() {
    const commandMode = state.passthrough?.enabled ? 'passthrough' : 'normal';
    const commandOptions = { mode: commandMode, capabilities: state.capabilities };
    const availableCommandTokens = tutorStubCommandTokens(commandOptions);
    const canonicalCommands = [
      ...new Set(availableCommandTokens.map((token) => tutorStubCanonicalCommandToken(token)).filter(Boolean)),
    ];
    const definitions = getActorialPartDefinitions();
    const profile = mixedLearnerProfilePresentation();
    return {
      authority: {
        scope: 'application_interface_only',
        mutatesSession: false,
        publicTranscriptChanged: false,
        excludedContext: ['concealed answer', 'hidden proof state', 'future clues', 'private tutor prompt'],
      },
      currentSession: {
        sessionMode: state.passthrough?.enabled ? 'passthrough' : mixedLearner.enabled ? 'mixed' : 'human',
        interactionRole: state.interaction?.mode || 'learner',
        completedTutorTurns: state.turns.length,
        scenario: state.world ? { id: state.world.id, title: state.world.title } : null,
        curriculum: state.curriculum
          ? { id: state.curriculum.id, title: state.curriculum.title, moduleId: state.curriculum.module?.id || null }
          : null,
        learnerProfile: mixedLearner.enabled
          ? { id: profile.id, name: profile.name, behavior: profile.pattern }
          : { id: null, name: 'Human learner', behavior: 'The operator supplies public learner turns directly.' },
        tutorCharacter: explicitPerformanceDirectiveValue(state, 'character') || 'auto',
        tutorStyle: explicitPerformanceDirectiveValue(state, 'register') || 'auto',
        tutorModel: state.modelRef,
        learnerInterpretationModel: liveModelRoleRef('classifier'),
        learnerReasoningModel: liveModelRoleRef('reasoning'),
        learnerVoiceModel: liveModelRoleRef('learner'),
        directorRequest: state.directorGuidance?.active?.text || null,
      },
      launchRecipes: [
        {
          command: 'npm run tutor:stub',
          behavior: 'open the mode picker; mixed tutor chat is the default selection',
        },
        {
          command: 'npm run tutor:stub:scaffold:mixed',
          behavior: 'launch mixed drafting with the human-facing DAG scaffold directly',
        },
        {
          command: 'npm run tutor:stub:direct:mixed',
          behavior: 'launch mixed drafting without the DAG scaffold',
        },
      ],
      commands: canonicalCommands.map((token) => ({
        token,
        aliases: availableCommandTokens.filter(
          (candidate) => candidate !== token && tutorStubCanonicalCommandToken(candidate) === token,
        ),
        summary: tutorStubCommandSummary(token),
        examples: tutorStubStaticCommandCompletions(token, commandOptions),
      })),
      tutorCharacters: tutorStubConfigurableActorialPartIds().map((id) => ({
        id,
        label: definitions[id]?.label || displayDiagnosticLabel(id),
        behavior: oneLine(definitions[id]?.contract, { max: 220 }),
        selectable: true,
      })),
      learnerProfiles: learnerProfileIds().map((id) => ({
        id,
        description: learnerProfileDescription(id),
        selectableInCurrentSession: mixedLearner.enabled,
      })),
      returnToScene: {
        automaticAfterAnswer: true,
        behavior: 'the latest tutor utterance is reprised, then the prior learner or coach prompt is restored',
      },
    };
  }

  async function answerCliDirectorQuestion(questionInput, { duringTurn = false, source = '/director ask' } = {}) {
    clearStatusLine();
    let question;
    try {
      question = normalizeTutorStubCliDirectorQuestion(questionInput);
    } catch (error) {
      console.log(`${C.red}director question error:${C.reset} ${error.message}`);
      console.log(`${C.dim}  use /director ask <question> or /meta ask <question>${C.reset}\n`);
      return { answered: false, error: error.message };
    }

    const context = cliDirectorApplicationContext();
    const resolved = state.learnerDag?.resolved || state.classifier?.resolved || state.resolved;
    const existingInterim = Boolean(getInterimState(state)?.active);
    if (!existingInterim) startInterimAnimation(state, 'asking director', { tutorTurn: state.turns.length });
    appendTraceEvent(state.trace, {
      type: 'cli_director_question_started',
      source,
      question,
      duringTurn,
      context,
      publicTranscriptChanged: false,
    });

    let response = null;
    let reply = '';
    try {
      response = await callPromptModel({
        prompt: buildTutorStubCliDirectorPrompt({ question, context }),
        resolved,
        systemPrompt: TUTOR_STUB_CLI_DIRECTOR_SYSTEM_PROMPT,
        role: 'tutor_stub_cli_director_help',
        maxTokens: Math.min(Number(state.maxTokens) || 700, 700),
        trace: state.trace,
        stream: { enabled: false, interim: state.interim },
        cliEffort: state.cliEffort,
        turn: state.turns.length,
      });
      reply = cleanTutorStubCliDirectorReply(response.text);
      if (!reply) throw new Error('the director returned an empty answer');
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      appendTraceEvent(state.trace, {
        type: 'cli_director_question_failed',
        source,
        question,
        duringTurn,
        error: error.message,
        publicTranscriptChanged: false,
      });
      printWithConcurrentTerminal(state, () => {
        console.log(`${C.red}director question failed:${C.reset} ${error.message}`);
        console.log(`${C.dim}  use /help for the current command surface; the tutor dialogue is unchanged${C.reset}\n`);
      });
      return { answered: false, error: error.message };
    } finally {
      if (!existingInterim) stopInterimAnimation(state);
    }

    printWithConcurrentTerminal(state, () => {
      console.log(`${C.brightCyan}${C.bold}director >${C.reset} ${reply}`);
      console.log(
        `${C.dim}  private app help · no setting changed · returning to the ${state.interaction?.mode === 'coach' ? 'coach' : 'tutor'} interaction${C.reset}\n`,
      );
    });
    appendTraceEvent(state.trace, {
      type: 'cli_director_answer',
      source,
      question,
      answer: reply,
      duringTurn,
      provider: response.provider,
      model: response.model,
      latencyMs: response.latencyMs,
      usage: response.usage || null,
      context,
      publicTranscriptChanged: false,
    });
    return { answered: true, question, answer: reply };
  }

  function printProofDagArtifactPaths() {
    const projection = projectTutorStubProofDagArtifactPaths({ colors: C });
    for (const line of projection.lines) console.log(line);
    return projection.rows;
  }

  function runProofDagLeanCheck() {
    const result = spawnSync(process.execPath, ['scripts/check-proof-dag-lean.js', '--require-lake'], {
      cwd: ROOT,
      encoding: 'utf8',
      env: process.env,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      const detail = [result.stdout, result.stderr]
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .join('\n');
      throw new Error(`Lean certificate check failed${detail ? `:\n${detail}` : ''}`);
    }
    const theoremCount = /World\s+\S+:\s+(\d+) authored proof-path theorem/u.exec(result.stdout)?.[1] || 'all';
    return {
      ok: true,
      theoremCount,
      command: 'npm run derivation:lean-cert:check',
    };
  }

  function printProofDagSemanticLayer(result, layer) {
    for (const line of projectTutorStubProofDagSemanticLayerLines({ result, layer, colors: C })) console.log(line);
  }

  async function handleProofDagCommand(argument = '', { duringTurn = false } = {}) {
    clearStatusLine();
    const parts = String(argument || '')
      .trim()
      .toLowerCase()
      .split(/\s+/u)
      .filter(Boolean);
    const action = parts[0] || 'check';
    const target = parts[1] || 'all';
    const usage = '/proof [check [lean|semantic] | inspect [authored|learner|tutor] | export | paths]';
    const validCheckTargets = new Set(['all', 'lean', 'semantic']);
    const validInspectTargets = new Set(['all', 'authored', 'learner', 'tutor']);

    if (action === 'help') {
      console.log(`${C.brightCyan}${C.bold}proof DAG >${C.reset} ${usage}`);
      console.log(
        `${C.dim}  /proof runs both checks; inspect reads the deterministic fixture; /analysis technical inspects this session's live DAG state${C.reset}\n`,
      );
      return { handled: true, ok: true, action };
    }
    if (action === 'paths') {
      const paths = printProofDagArtifactPaths();
      appendTraceEvent(state.trace, {
        type: 'proof_dag_verification_popup',
        action,
        target: 'all',
        paths: paths.map(([, file]) => file),
        duringTurn,
        publicTranscriptChanged: false,
      });
      return { handled: true, ok: true, action };
    }
    if (
      !['check', 'inspect', 'export'].includes(action) ||
      (action === 'check' && !validCheckTargets.has(target)) ||
      (action === 'inspect' && !validInspectTargets.has(target)) ||
      (action === 'export' && parts.length > 1)
    ) {
      console.log(`${C.red}proof error:${C.reset} use ${usage}\n`);
      return { handled: true, ok: false, action, reason: 'invalid_arguments' };
    }

    console.log(`${C.brightCyan}${C.bold}proof DAG >${C.reset} ${action} · deterministic Nocturne fixture`);
    if (state.world?.id && state.world.id !== 'world_001_nocturne') {
      console.log(
        `${C.dim}  current session is ${state.world.id}; these formal artifacts remain the fixed Nocturne fixture. Use /analysis technical for the live session.${C.reset}`,
      );
    }

    const outcome = {
      handled: true,
      ok: true,
      action,
      target,
      worldId: 'world_001_nocturne',
      lean: null,
      semantic: null,
    };
    try {
      if (action === 'check' && target !== 'semantic') {
        outcome.lean = runProofDagLeanCheck();
        console.log(
          `${C.green}  Lean: PASS${C.reset}${C.dim} · ${outcome.lean.theoremCount} authored proof-path theorems type-check${C.reset}`,
        );
      }

      if (action !== 'check' || target !== 'lean') {
        const { runProofDagSemanticWebExport } = await import('../scripts/export-proof-dag-semantic-web.js');
        const result = await runProofDagSemanticWebExport({
          world: 'config/drama-derivation/world-001-nocturne.yaml',
          outDir: 'tools/proof-dag-semantic-web/Generated/World001Nocturne',
          check: action !== 'export',
        });
        outcome.semantic = {
          conforms: result.validation.conforms,
          stale: result.stale,
          graphs: result.validation.graphs,
        };

        if (action === 'export') {
          console.log(
            `${C.green}  semantic export: PASS${C.reset}${C.dim} · ${result.stale.length ? `refreshed ${result.stale.join(', ')}` : 'artifacts already current'}${C.reset}`,
          );
        } else {
          console.log(
            `${C.green}  semantic web: PASS${C.reset}${C.dim} · source redaction audit, SHACL, and stale-artifact check passed${C.reset}`,
          );
        }

        const layers = action === 'inspect' ? (target === 'all' ? ['authored', 'learner', 'tutor'] : [target]) : [];
        for (const layer of layers) printProofDagSemanticLayer(result, layer);
        if (action !== 'inspect') {
          for (const [layer, graph] of Object.entries(result.validation.graphs)) {
            console.log(
              `${C.dim}    ${layer}: ${graph.quadCount} quads · SHACL ${graph.conforms ? 'conforms' : 'fails'}${C.reset}`,
            );
          }
        }
      }

      console.log(
        `${C.dim}  This does not replace or prove the live JS entitlement gate. /proof inspect learner shows the fixture; /analysis technical shows this session.${C.reset}\n`,
      );
    } catch (error) {
      outcome.ok = false;
      outcome.error = error.message;
      console.log(`${C.red}  FAIL:${C.reset} ${error.message}\n`);
    }

    appendTraceEvent(state.trace, {
      type: 'proof_dag_verification_popup',
      action,
      target,
      fixtureWorldId: outcome.worldId,
      currentWorldId: state.world?.id || null,
      ok: outcome.ok,
      lean: outcome.lean,
      semantic: outcome.semantic,
      error: outcome.error || null,
      duringTurn,
      publicTranscriptChanged: false,
    });
    return outcome;
  }

  function handleDirectorGuidanceCommand(argument = '', { duringTurn = false, source = '/meta' } = {}) {
    const request = String(argument || '').trim();
    const action = request.toLowerCase();
    clearStatusLine();
    if (state.passthrough?.enabled) {
      console.log(
        `${C.red}director request unavailable:${C.reset} passthrough has no private tutor-control layer; use ordinary chat or relaunch a normal tutor session\n`,
      );
      appendTraceEvent(state.trace, {
        type: 'director_guidance_rejected',
        source,
        request: request || null,
        reason: 'passthrough_has_no_private_tutor_control_layer',
        duringTurn,
        publicTranscriptChanged: false,
      });
      return { changed: false, reason: 'passthrough' };
    }

    if (!request || action === 'status') {
      const active = state.directorGuidance?.active || null;
      console.log(`${C.brightCyan}${C.bold}director request >${C.reset} ${active ? active.text : 'none'}`);
      console.log(
        `${C.dim}  ${
          active
            ? `private tutor-change guidance from turn ${active.effectiveFromTurn}; remains active until /meta clear`
            : 'use /meta <request> to change tutor delivery, or /director ask <question> for private app help'
        }${C.reset}\n`,
      );
      return { changed: false, active };
    }

    const effectiveFromTurn = state.turns.length + (duringTurn || isProcessingTurn() ? 2 : 1);
    if (['clear', 'off', 'reset'].includes(action)) {
      const previous = state.directorGuidance?.active || null;
      if (!previous) {
        console.log(`${C.brightCyan}${C.bold}director request >${C.reset} none active`);
        console.log(`${C.dim}  use /meta <request> to direct a change to later tutor replies${C.reset}\n`);
        return { changed: false, active: null };
      }
      clearTutorStubDirectorGuidance(state.directorGuidance, {
        source: `${source} ${action}`,
        effectiveFromTurn,
      });
      if (!duringTurn && !isProcessingTurn()) resetMixedLearnerSuggestion('director_guidance_cleared');
      appendTraceEvent(state.trace, {
        type: 'director_guidance_cleared',
        source,
        previous,
        directorGuidance: tutorStubDirectorGuidanceSnapshot(state.directorGuidance),
        effectiveFromTurn,
        duringTurn: Boolean(duringTurn || isProcessingTurn()),
        publicTranscriptChanged: false,
      });
      console.log(`${C.brightCyan}${C.bold}director request >${C.reset} cleared`);
      console.log(
        `${C.dim}  private tutor-change guidance stops from tutor turn ${effectiveFromTurn}; public dialogue and proof state are unchanged${C.reset}\n`,
      );
      if (mixedLearner.enabled && !duringTurn && !isProcessingTurn() && latestTutorMessage(state)) {
        startMixedLearnerPrefetch('director_guidance_cleared');
      }
      return { changed: true, active: null, previous };
    }

    let entry;
    try {
      entry = setTutorStubDirectorGuidance(state.directorGuidance, request, {
        source,
        effectiveFromTurn,
      });
    } catch (error) {
      console.log(`${C.red}director request error:${C.reset} ${error.message}\n`);
      return { changed: false, error: error.message };
    }
    if (!duringTurn && !isProcessingTurn()) resetMixedLearnerSuggestion('director_guidance_changed');
    appendTraceEvent(state.trace, {
      type: 'director_guidance_set',
      guidance: entry,
      directorGuidance: tutorStubDirectorGuidanceSnapshot(state.directorGuidance),
      duringTurn: Boolean(duringTurn || isProcessingTurn()),
      publicTranscriptChanged: false,
    });
    console.log(`${C.brightCyan}${C.bold}director request >${C.reset} ${entry.text}`);
    console.log(
      `${C.dim}  private control, not learner speech · applies from tutor turn ${entry.effectiveFromTurn} until /meta clear${C.reset}`,
    );
    console.log(
      `${C.dim}  changes delivery only; public evidence, proof state, release timing, closure, and safety remain authoritative${C.reset}`,
    );
    if (mixedLearner.enabled && !duringTurn && !isProcessingTurn() && latestTutorMessage(state)) {
      startMixedLearnerPrefetch('director_guidance_changed');
      console.log(`${C.dim}  rebuilding the next tutor response with this direction${C.reset}`);
    }
    console.log();
    return { changed: true, active: entry };
  }

  return {
    answerCliDirectorQuestion,
    handleDirectorGuidanceCommand,
    handleProofDagCommand,
  };
}
