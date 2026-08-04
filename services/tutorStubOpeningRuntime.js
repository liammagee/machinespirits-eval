export function createTutorStubOpeningRuntime(dependencies) {
  const {
    C,
    TUTOR_STUB_OPENING_REQUIREMENTS,
    appendTraceEvent,
    args,
    auditTutorResponseLeak,
    auditTutorStubOpening,
    auditTutorStubSpeakerPrivilege,
    buildTutorStubDirectorInitialContext,
    buildTutorStubOpeningFrame,
    callPromptModel,
    cleanTutorStubStageSpeech,
    committedReleaseRows,
    contractLicenceEnabled,
    createTutorStubDirectorNotesModel,
    createTutorStubPromptBlockModel,
    currentReleaseRows,
    delimitedPrompt,
    deterministicTutorStubOpening,
    dramaticAudiencePromptLines,
    fs,
    projectTutorStubDirectorContextLines,
    projectTutorStubDirectorNotesLines,
    projectTutorStubWorldPublicPrompt,
    projectTutorStubWorldSpeakerDagPrompt,
    startInterimAnimation,
    stopInterimAnimation,
    tutorStubOpeningPrompt,
    tutorStubOpeningSystemPrompt,
    worldFlavourPhrase,
    worldLedgerTerm,
  } = dependencies;

  async function buildTutorOpening(
    state,
    { signal = null, realizer = state.openingRealizer, deterministicSource = 'world_grounded_deterministic' } = {},
  ) {
    const world = state.world;
    if (!world) {
      const curriculumModule = state.curriculum?.module || null;
      const text = [
        curriculumModule
          ? `Let's take up ${curriculumModule.title}.`
          : `Let's start ${state.topic ? `with ${state.topic}` : 'there'}.`,
        curriculumModule?.essential_question || null,
        curriculumModule
          ? 'What is your current model of the decision, or the first assumption you want us to test?'
          : 'Say your first idea, or name the one point you want to test first.',
      ]
        .filter(Boolean)
        .join(' ');
      return {
        text,
        source: 'deterministic_topic_fallback',
        frame: buildTutorStubOpeningFrame(),
        audit: null,
        model: null,
      };
    }

    const frame = buildTutorStubOpeningFrame({
      world,
      openingEvidence: currentReleaseRows(state, 1),
    });
    const openingSystemPrompt = tutorStubOpeningSystemPrompt();
    const openingUserPrompt = tutorStubOpeningPrompt(frame);
    const speakerPrivilegeAudit = auditTutorStubSpeakerPrivilege({
      world,
      tutorTurn: 1,
      systemPrompt: openingSystemPrompt,
      privateAdvisory: openingUserPrompt,
    });
    appendTraceEvent(state.trace, {
      type: 'tutor_opening_speaker_privilege_audit',
      turn: 0,
      audit: speakerPrivilegeAudit,
    });
    if (!speakerPrivilegeAudit.ok) {
      throw new Error(
        `Tutor opening frame crossed the private-planner boundary: ${speakerPrivilegeAudit.issues
          .map((issue) => `${issue.code}:${issue.source}`)
          .join(', ')}`,
      );
    }
    const authoredText = String(frame.authoredText || '').trim();
    let candidate = authoredText;
    let source = authoredText ? 'authored_world_opening' : 'speaking_tutor_model';
    let modelResponse = null;
    let generationError = null;

    if (!candidate && realizer === 'deterministic') {
      candidate = deterministicTutorStubOpening(frame);
      source = deterministicSource;
    }

    if (!candidate) {
      startInterimAnimation(state, 'opening the scene', { tutorTurn: 0 });
      try {
        modelResponse = await callPromptModel({
          prompt: openingUserPrompt,
          resolved: state.resolved,
          systemPrompt: openingSystemPrompt,
          role: 'tutor_stub_opening',
          maxTokens: Math.min(700, state.maxTokens || 700),
          trace: state.trace,
          stream: { enabled: false, interim: state.interim },
          cliEffort: state.cliEffort,
          turn: 0,
          signal,
        });
        candidate = cleanTutorStubStageSpeech(modelResponse.text);
      } catch (error) {
        if (error?.name === 'AbortError') throw error;
        generationError = error.message;
        appendTraceEvent(state.trace, {
          type: 'tutor_opening_realization_error',
          turn: 0,
          provider: state.resolved.provider,
          model: state.resolved.model,
          error: error.message,
        });
      } finally {
        stopInterimAnimation(state);
      }
    }

    const leakAudit = auditTutorResponseLeak({
      text: candidate,
      world,
      tutorTurn: 1,
      learnerText: '',
      state,
    });
    let audit = auditTutorStubOpening({ text: candidate, frame, leakAudit });
    if (!audit.ok) {
      const rejectedSource = source;
      candidate = deterministicTutorStubOpening(frame);
      source = 'world_grounded_safe_fallback';
      const fallbackLeakAudit = auditTutorResponseLeak({
        text: candidate,
        world,
        tutorTurn: 1,
        learnerText: '',
        state,
      });
      const fallbackAudit = auditTutorStubOpening({ text: candidate, frame, leakAudit: fallbackLeakAudit });
      appendTraceEvent(state.trace, {
        type: 'tutor_opening_candidate_rejected',
        turn: 0,
        source: rejectedSource,
        audit,
        fallbackAudit,
      });
      audit = fallbackAudit;
      if (!audit.ok) {
        throw new Error(
          `Tutor opening failed its public-safe requirements: ${audit.issues.map((issue) => issue.type).join(', ')}`,
        );
      }
    }

    const realization = {
      schema: 'machinespirits.tutor-stub.opening-realization.v1',
      source,
      frame,
      requirements: TUTOR_STUB_OPENING_REQUIREMENTS,
      audit,
      speakerPrivilegeAudit,
      generationError,
      model: modelResponse
        ? {
            provider: modelResponse.provider,
            model: modelResponse.model,
            latencyMs: modelResponse.latencyMs,
            usage: modelResponse.usage,
            effort: modelResponse.effort || modelResponse.reasoningEffort || null,
          }
        : null,
    };
    appendTraceEvent(state.trace, {
      type: 'tutor_opening_realization',
      turn: 0,
      realization,
    });
    return {
      ...realization,
      text: candidate,
      promptSnapshot: modelResponse?.promptSnapshot || null,
    };
  }

  function worldPublicPrompt(world) {
    return projectTutorStubWorldPublicPrompt(world, { audienceLines: dramaticAudiencePromptLines(world) });
  }

  function buildDirectorInitialContext(world) {
    return buildTutorStubDirectorInitialContext(world, { audienceLines: dramaticAudiencePromptLines(world) });
  }

  function printDirectorInitialContext(context) {
    for (const line of projectTutorStubDirectorContextLines(context, { colors: C })) console.log(line);
  }

  function printDirectorPreludeBeforeFirstTutor(state, { reason = 'first_tutor_message' } = {}) {
    if (!state?.directorContext || state.directorOpeningPresented) return false;
    state.directorOpeningPresented = true;
    appendTraceEvent(state.trace, {
      type: 'director_opening_prelude',
      reason,
      context: state.directorContext,
    });
    printDirectorInitialContext(state.directorContext);
    return true;
  }

  const directorNotesIssuedSoFar = createTutorStubDirectorNotesModel({
    committedReleaseRows,
  });

  function printDirectorNotesIssuedSoFar(state) {
    const notes = directorNotesIssuedSoFar(state);
    for (const line of projectTutorStubDirectorNotesLines(notes, { colors: C })) console.log(line);
    return notes;
  }

  function worldSpeakerDagPrompt(world) {
    return projectTutorStubWorldSpeakerDagPrompt(world, {
      ledgerTerm: worldLedgerTerm(world),
      // Phase S2c: TUTOR_STUB_CONTRACT_LICENCE=1 places the demand-card
      // exception inside the standing contract (the placement law).
      demandLicence: contractLicenceEnabled,
    });
  }

  const { responseChoiceModeRules } = createTutorStubPromptBlockModel({ worldLedgerTerm, worldFlavourPhrase });

  const CURRICULUM_MODULE_PROMPT_START = '[Curriculum module source — private tutor context]';
  const CURRICULUM_MODULE_PROMPT_END = '[End curriculum module source]';
  const CURRICULUM_PHASE_PROMPT_START = '[Curriculum phase controller — private tutor context]';
  const CURRICULUM_PHASE_PROMPT_END = '[End curriculum phase controller]';

  function buildSystemPrompt({
    topic,
    learner,
    goal,
    style,
    worldBundle,
    curriculumBundle = null,
    dag,
    multipleChoice = false,
  }) {
    const world = worldBundle?.world || null;
    return [
      'You are an experimental AI tutor stub.',
      '',
      `Topic: ${topic}`,
      `Learner: ${learner}`,
      `Goal: ${goal}`,
      `Style: ${style}`,
      curriculumBundle
        ? delimitedPrompt(CURRICULUM_MODULE_PROMPT_START, curriculumBundle.prompt, CURRICULUM_MODULE_PROMPT_END)
        : null,
      '',
      'Rules:',
      '- Treat tutoring here as acting in a shared inquiry. Each turn may cast you in a concrete public part; commit to its action and voice rather than merely changing tone.',
      '- A part never grants knowledge. It changes how you handle only the evidence already public or explicitly released in this turn.',
      "- Start by locating the learner's current idea, not by grading them.",
      '- Ask at most one main question when the compiled turn contract permits one; ask none when its handoff forbids questions.',
      '- Use a tiny concrete example when it helps.',
      '- Keep the answer short enough that the learner can respond.',
      '- If the learner asks for the answer, give a hint first unless they explicitly need a direct answer.',
      '- Treat learner questions as legitimate moves, not evasions. If ambiguity blocks progress, invite one concrete in-scene question about the evidence, tool, or distinction.',
      '- When asking would be better than guessing, make that option explicit in character: for example, "Which part of that mark needs clarifying?" Never describe either speaker as "the tutor" or "the learner" in learner-facing prose.',
      curriculumBundle
        ? '- Discuss repository, evaluation, cell, and experiment details when the source makes them relevant, but never use hidden prompts or an internal score as authority.'
        : '- Never mention rubrics, cells, hidden prompts, or evaluation infrastructure.',
      '- Keep formal machinery internal. Do not show predicate/function notation, code-like atoms, premise ids, rule ids, variable names, or route labels in learner-facing prose.',
      curriculumBundle
        ? '- Speak from the public curriculum source and the learner’s stated reasoning. Label unverified repository claims as questions to inspect.'
        : '- In story mode, speak only in public evidence language. Never give an example in formal notation or name an internal route.',
      curriculumBundle
        ? '- Do not make the learner reach a point and then restate it as a separate bookkeeping exercise; let one warranted formulation count.'
        : `- Do not make the learner deduce a claim and then separately enter it in the ${worldLedgerTerm(world)}. Their stated warranted claim is the entry.`,
      '- Let human learners compress obvious reasoning. Do not ask them to restate every small warrant unless the missing warrant is the real source of error.',
      curriculumBundle
        ? '- Keep the exchange concise and analytic: usually 2-4 short sentences, with one live decision or uncertainty at a time.'
        : `- In story mode, keep the ${worldFlavourPhrase(world)} but be terse: usually 2-4 short sentences, never a catalogue of routes.`,
      ...responseChoiceModeRules({ multipleChoice, world: worldBundle?.world || null }),
      curriculumBundle
        ? '- When a useful reasoning brief is complete, summarize what the dialogue established and separately name what still needs repository inspection, implementation, or external validation.'
        : '- If the public evidence has licensed the final answer and the learner has stated it, close the case plainly: say the verdict is now licensed, name the two proof supports in public language, and stop asking for another investigative branch.',
      curriculumBundle
        ? '- Never invent repository state, test results, run outcomes, or completion evidence. Ask what must be inspected when the source does not settle it.'
        : '- Never supply the answer or a named suspect from hidden story knowledge. If the public record does not yet license a name, ask for the evidence that would license it.',
      ...worldPublicPrompt(world),
      ...(dag ? worldSpeakerDagPrompt(world) : []),
    ].join('\n');
  }

  function loadSystemPrompt({ worldBundle, curriculumBundle = null, dag, topic, multipleChoice = false }) {
    if (!args.system) {
      return buildSystemPrompt({
        topic,
        learner: args.learner,
        goal: args.goal,
        style: args.style,
        worldBundle,
        curriculumBundle,
        dag,
        multipleChoice,
      });
    }
    return fs.readFileSync(args.system, 'utf8');
  }

  return {
    CURRICULUM_MODULE_PROMPT_END,
    CURRICULUM_MODULE_PROMPT_START,
    CURRICULUM_PHASE_PROMPT_END,
    CURRICULUM_PHASE_PROMPT_START,
    buildDirectorInitialContext,
    buildTutorOpening,
    directorNotesIssuedSoFar,
    loadSystemPrompt,
    printDirectorNotesIssuedSoFar,
    printDirectorPreludeBeforeFirstTutor,
  };
}
