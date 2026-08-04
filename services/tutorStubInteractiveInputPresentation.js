export function createTutorStubInteractiveInputPresentation({
  C,
  ROOT,
  TUTOR_STUB_FEEDBACK_REASONS,
  groupedWorldEntries,
  humanDirectedRegisterPalette,
  isProcessingTurn,
  learnerProfileContract,
  learnerProfileIds,
  learnerProfileSpeakerLabel,
  listTutorStubCurriculumModules,
  listTutorStubLabs,
  loadTutorStubCurriculum,
  mixedLearner,
  oneLine,
  output,
  state,
  tutorModelChoiceEntries,
  tutorStubCanonicalCommandToken,
  tutorStubCommandAvailable,
  tutorStubCommandSummary,
  tutorStubCommandTokens,
  tutorStubConfigurableActorialPartIds,
  tutorStubStaticCommandCompletions,
}) {
  function mixedLearnerProfilePresentation(suggestion = null) {
    const profileId = suggestion?.profileId || mixedLearner.profileId || null;
    const contract = profileId ? learnerProfileContract(profileId) : null;
    return {
      id: profileId || 'custom',
      name: contract?.intent?.shortName || 'Custom learner',
      speakerLabel: learnerProfileSpeakerLabel(profileId),
      pattern: contract?.intent?.failureOperator || oneLine(suggestion?.profile || mixedLearner.profile, { max: 180 }),
      signal:
        oneLine(suggestion?.profileSignal, { max: 220 }) ||
        'This draft was generated under the active profile; no separate visible-behavior note was returned.',
    };
  }

  function mixedLearnerPromptText() {
    if (state.interaction?.mode === 'coach') return `${C.brightYellow}${C.bold}coach >${C.reset} `;
    if (state.interaction?.mode === 'auto') return `${C.brightBlue}${C.bold}auto >${C.reset} `;
    if (!mixedLearner.enabled) return `${C.brightGreen}${C.bold}learner >${C.reset} `;
    return `${C.brightGreen}${C.bold}${mixedLearnerProfilePresentation().speakerLabel} >${C.reset} `;
  }

  function printMixedLearnerProfilePresentation(suggestion, { verb = 'drafted as' } = {}) {
    const presentation = mixedLearnerProfilePresentation(suggestion);
    console.log(`${C.magenta}profile >${C.reset} ${presentation.id} — ${presentation.name}`);
    console.log(`${C.dim}  tends to: ${presentation.pattern}${C.reset}`);
    console.log(`${C.dim}  ${verb === 'drafted as' ? 'this draft' : verb}: ${presentation.signal}${C.reset}`);
  }

  function mixedLearnerCompletionForLine(line) {
    if (!mixedLearner.enabled || isProcessingTurn() || state.interaction?.mode !== 'learner') return null;
    const suggestion = mixedLearner.suggestion;
    const text = String(suggestion?.text || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) return null;
    const raw = String(line || '');
    const trimmed = raw.trimStart();
    if (trimmed.startsWith('/')) return null;
    if (!trimmed) return text;
    return text.toLowerCase().startsWith(raw.trim().toLowerCase()) ? text : null;
  }

  function slashCommandCompletionForLine(line, { fallback = false } = {}) {
    const raw = String(line || '');
    const trimmed = raw.trimStart();
    if (!trimmed.startsWith('/')) return { candidates: [], replacement: raw };

    const completionMode = state.passthrough?.enabled ? 'passthrough' : 'normal';
    const commandOptions = { mode: completionMode, capabilities: state.capabilities };
    const requestedCommand = trimmed.split(/\s+/u)[0];
    if (
      tutorStubCanonicalCommandToken(requestedCommand) &&
      !tutorStubCommandAvailable(requestedCommand, commandOptions)
    ) {
      return { candidates: [], replacement: trimmed };
    }

    let pool = tutorStubCommandTokens(commandOptions);
    if (trimmed.startsWith('/mode ')) {
      pool = tutorStubStaticCommandCompletions('/mode', commandOptions);
    } else if (trimmed.startsWith('/debug ')) {
      pool = tutorStubStaticCommandCompletions('/debug', commandOptions);
    } else if (trimmed.startsWith('/feedback ')) {
      pool = [
        ...tutorStubStaticCommandCompletions('/feedback', commandOptions),
        ...Object.keys(TUTOR_STUB_FEEDBACK_REASONS).map((reason) => `/feedback down ${reason}`),
      ];
    } else if (trimmed.startsWith('/down ')) {
      pool = Object.keys(TUTOR_STUB_FEEDBACK_REASONS).map((reason) => `/down ${reason}`);
    } else if (trimmed.startsWith('/up ')) {
      pool = Object.keys(TUTOR_STUB_FEEDBACK_REASONS)
        .filter((reason) => reason.startsWith('helpful_') || reason === 'custom')
        .map((reason) => `/up ${reason}`);
    } else if (trimmed.startsWith('/tune ')) {
      pool = tutorStubStaticCommandCompletions('/tune', commandOptions);
    } else if (trimmed.startsWith('/theme ')) {
      pool = tutorStubStaticCommandCompletions('/theme', commandOptions);
    } else if (trimmed.startsWith('/motion ')) {
      pool = tutorStubStaticCommandCompletions('/motion', commandOptions);
    } else if (trimmed.startsWith('/random ')) {
      pool = tutorStubStaticCommandCompletions('/random', commandOptions);
    } else if (trimmed.startsWith('/committee ')) {
      pool = tutorStubStaticCommandCompletions('/committee', commandOptions);
    } else if (trimmed.startsWith('/register ')) {
      pool = [
        ...tutorStubStaticCommandCompletions('/register', commandOptions),
        ...humanDirectedRegisterPalette().map((stance) => `/register ${stance}`),
      ];
    } else if (trimmed.startsWith('/tutor ')) {
      pool = [
        ...tutorStubStaticCommandCompletions('/tutor', commandOptions),
        ...tutorStubConfigurableActorialPartIds().map((part) => `/tutor ${part}`),
      ];
    } else if (trimmed.startsWith('/learner ')) {
      pool = [
        ...tutorStubStaticCommandCompletions('/learner', commandOptions),
        ...learnerProfileIds().map((profileId) => `/learner ${profileId}`),
      ];
    } else if (trimmed.startsWith('/character ')) {
      pool = [
        ...tutorStubStaticCommandCompletions('/character', commandOptions),
        ...tutorStubConfigurableActorialPartIds().map((part) => `/character ${part}`),
        ...tutorStubConfigurableActorialPartIds().map((part) => `/character tutor ${part}`),
        ...learnerProfileIds().map((profileId) => `/character learner ${profileId}`),
      ];
    } else if (trimmed.startsWith('/settings model ')) {
      const modelCompletions = [
        '/settings model default',
        ...tutorModelChoiceEntries(state.modelRef).map((entry) => `/settings model ${entry.ref}`),
      ];
      pool = trimmed === '/settings model ' ? modelCompletions.slice(0, 16) : modelCompletions;
    } else if (trimmed.startsWith('/settings ')) {
      pool = tutorStubStaticCommandCompletions('/settings', commandOptions);
    } else if (trimmed.startsWith('/analysis ')) {
      pool = tutorStubStaticCommandCompletions('/analysis', commandOptions);
    } else if (trimmed.startsWith('/proof ')) {
      pool = tutorStubStaticCommandCompletions('/proof', commandOptions);
    } else if (trimmed.startsWith('/demo ')) {
      pool = tutorStubStaticCommandCompletions('/demo', commandOptions);
    } else if (trimmed.startsWith('/transcript ') || trimmed.startsWith('/html ')) {
      const command = trimmed.startsWith('/html ') ? '/html' : '/transcript';
      pool = tutorStubStaticCommandCompletions(command, commandOptions);
    } else if (trimmed.startsWith('/voice ')) {
      pool = tutorStubStaticCommandCompletions('/voice', commandOptions);
    } else if (trimmed.startsWith('/meta ') || trimmed.startsWith('/director ')) {
      const command = trimmed.startsWith('/meta ') ? '/meta' : '/director';
      const staticMatches = tutorStubStaticCommandCompletions(command, commandOptions).filter((candidate) =>
        candidate.startsWith(trimmed),
      );
      pool = staticMatches.length ? staticMatches : [trimmed];
    } else if (trimmed.startsWith('/lab ')) {
      pool = [
        ...tutorStubStaticCommandCompletions('/lab', commandOptions),
        ...listTutorStubLabs().map((entry) => `/lab ${entry.id}`),
      ];
    } else if (trimmed.startsWith('/profile ')) {
      pool = [
        ...tutorStubStaticCommandCompletions('/profile', commandOptions),
        ...learnerProfileIds().map((profileId) => `/profile ${profileId}`),
      ];
    } else if (trimmed.startsWith('/scenario ')) {
      pool = groupedWorldEntries().map(({ world }) => `/scenario ${world.id}`);
    } else if (trimmed.startsWith('/board ')) {
      try {
        const bundle = loadTutorStubCurriculum('workplan', { root: ROOT });
        pool = listTutorStubCurriculumModules(bundle).map((module) => `/board ${module.id}`);
      } catch {
        pool = ['/board'];
      }
    }
    const sortedPool = [...new Set(pool)].toSorted();
    const matches = sortedPool.filter((candidate) => candidate.startsWith(trimmed));
    return {
      candidates: matches.length || !fallback ? matches : sortedPool,
      replacement: trimmed,
    };
  }

  function slashCommandPaletteForLine(line) {
    const raw = String(line || '');
    const trimmed = raw.trimStart();
    if (!trimmed.startsWith('/')) return [];
    const { candidates } = slashCommandCompletionForLine(trimmed);
    const commands = [...new Set(candidates.map((candidate) => candidate.trimEnd()))].toSorted();
    const terminalWidth = Math.max(48, Number(output.columns) || 100);
    const countLabel =
      trimmed === '/'
        ? `${commands.length} available`
        : `${commands.length} ${commands.length === 1 ? 'match' : 'matches'} for ${trimmed}`;
    const header = `${C.brightCyan}${C.bold}slash commands${C.reset}${C.dim} · ${countLabel}${C.reset}`;
    if (!commands.length) {
      return [header, `${C.dim}  no match · Backspace to widen the list, or use /help${C.reset}`];
    }

    const visibleLimit = Math.max(4, Math.min(10, (Number(output.rows) || 24) - 7));
    const visibleCommands = commands.slice(0, visibleLimit);
    const widest = Math.max(...visibleCommands.map((command) => command.length));
    const commandWidth = Math.max(14, Math.min(42, Math.floor(terminalWidth * 0.42), widest));
    const summaryWidth = Math.max(16, terminalWidth - commandWidth - 5);
    const rows = visibleCommands.map((command) => {
      const commandLabel = oneLine(command, { max: commandWidth });
      const summary = oneLine(tutorStubCommandSummary(command) || 'run this command', { max: summaryWidth });
      return `  ${C.cyan}${commandLabel.padEnd(commandWidth)}${C.reset}  ${C.dim}${summary}${C.reset}`;
    });
    const hiddenCount = commands.length - visibleCommands.length;
    if (hiddenCount > 0) {
      rows.push(`${C.dim}  … ${hiddenCount} more · keep typing to narrow the list${C.reset}`);
    }
    rows.push(`${C.dim}  Tab completes · /help shows command groups${C.reset}`);
    return [header, ...rows];
  }

  return {
    mixedLearnerCompletionForLine,
    mixedLearnerProfilePresentation,
    mixedLearnerPromptText,
    printMixedLearnerProfilePresentation,
    slashCommandCompletionForLine,
    slashCommandPaletteForLine,
  };
}
