export async function runTranscriptCommand(context) {
  const { expandRunId, args, getOption, getFlag, evaluationStore, theme, projectTranscriptArtifacts } = context;

  const runId = expandRunId(args.find((a) => !a.startsWith('--') && a !== 'transcript'));
  if (!runId) {
    console.error(
      'Usage: eval-cli.js transcript <runId> [--scenario <id>] [--profile <name>] [--dialogue <id>] [--all-matches] [--detail play|compact|messages-only|full|bilateral]',
    );
    process.exit(1);
  }

  const scenarioFilter = getOption('scenario') || getOption('test') || null;
  const profileFilter = getOption('profile') || null;
  const dialogueFilter = getOption('dialogue') || getOption('dialogue-id') || null;
  const showAllMatches = getFlag('all-matches');
  // Determine detail level: --compact and --messages-only are shortcuts, --detail is explicit
  let detailLevel = getOption('detail') || 'play';
  if (getFlag('compact')) detailLevel = 'compact';
  if (getFlag('messages-only')) detailLevel = 'messages-only';
  if (getFlag('full')) detailLevel = 'full';
  if (getFlag('bilateral')) detailLevel = 'bilateral';

  let results = evaluationStore.getResults(runId, {
    scenarioId: scenarioFilter,
    profileName: profileFilter,
  });

  if (dialogueFilter) {
    const exact = results.filter((r) => (r.dialogueId || '') === dialogueFilter);
    results = exact.length > 0 ? exact : results.filter((r) => (r.dialogueId || '').includes(dialogueFilter));
    if (!showAllMatches && results.length > 1) {
      results = [results[results.length - 1]];
    }
  }

  if (results.length === 0) {
    console.log(`\nNo results found for run: ${runId}`);
    if (scenarioFilter) console.log(`  scenario filter: ${scenarioFilter}`);
    if (profileFilter) console.log(`  profile filter: ${profileFilter}`);
    if (dialogueFilter) console.log(`  dialogue filter: ${dialogueFilter}`);
    return;
  }

  console.log(`\nTranscripts for run: ${theme.id(runId)} (${results.length} results, detail: ${detailLevel})\n`);
  if (scenarioFilter) console.log(`${theme.dim('scenario filter:')} ${scenarioFilter}`);
  if (profileFilter) console.log(`${theme.dim('profile filter:')} ${profileFilter}`);
  if (dialogueFilter) {
    console.log(`${theme.dim('dialogue filter:')} ${dialogueFilter}${showAllMatches ? '' : ' (latest match only)'}`);
  }
  if (scenarioFilter || profileFilter || dialogueFilter) console.log('');

  for (const result of results) {
    console.log(theme.dim('='.repeat(80)));
    console.log(`Scenario: ${theme.header(result.scenarioName || result.scenarioId)}`);
    console.log(`Profile:  ${theme.model(result.profileName || `${result.provider}/${result.model}`)}`);
    console.log(
      `Score:    ${theme.score(result.tutorFirstTurnScore != null ? result.tutorFirstTurnScore.toFixed(1) : '--')}  |  Success: ${result.success ? theme.success('true') : theme.error('false')}`,
    );
    console.log(theme.dim('-'.repeat(80)));

    // Try dialogue log file first (rich trace with metadata)
    let printed = false;
    if (result.dialogueId) {
      const dialogue = evaluationStore.loadDialogueLog(result.dialogueId);
      if (dialogue) {
        const trace = dialogue.dialogueTrace || [];
        if (trace.length > 0) {
          const projection = projectTranscriptArtifacts({
            trace,
            turnResults: dialogue.turnResults || [],
            learnerContext: dialogue.learnerContext || '',
            scenarioName: result.scenarioName || result.scenarioId,
            profileName: result.profileName || '',
            totalTurns: dialogue.totalTurns || 0,
            detail: detailLevel,
          });

          console.log(projection.formatted);

          if (projection.judged?.publicTranscript || projection.judged?.fullTranscript) {
            console.log(theme.dim('Judge-visible transcript (public):'));
            console.log(projection.judged.publicTranscript || '(missing)');
            console.log('');
            console.log(theme.dim('Judge-visible transcript (full/internal):'));
            console.log(projection.judged.fullTranscript || '(missing)');
            console.log('');
          }

          if (projection.diagnostics?.effectCount > 0) {
            console.log(theme.warn('Projection Diagnostics:'));
            for (const effect of projection.diagnostics.effects) {
              const sev = effect.severity?.toUpperCase?.() || 'INFO';
              console.log(`  - [${sev}] ${effect.message}`);
              for (const step of effect.remedialSteps || []) {
                console.log(`      remediation: ${step}`);
              }
            }
            console.log('');
          }
          printed = true;
        }
      }
    }

    // Fall back to legacy format (suggestions / raw response from DB)
    if (!printed) {
      if (result.suggestions?.length > 0) {
        console.log('Suggestions:');
        for (const s of result.suggestions) {
          const text = typeof s === 'string' ? s : s.text || s.content || JSON.stringify(s);
          console.log(`  \u2022 ${text}`);
        }
        console.log('');
      }
      if (result.evaluationReasoning) {
        console.log('Judge reasoning:');
        console.log(`  ${result.evaluationReasoning}`);
        console.log('');
      }
    }

    if (result.errorMessage) {
      console.log(`ERROR: ${result.errorMessage}`);
      console.log('');
    }
  }

  // Also check for interaction evals
  const interactionEvals = evaluationStore.listInteractionEvals({ limit: 200 });
  const runInteractions = interactionEvals.filter((e) => e.runId === runId);

  if (runInteractions.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('  INTERACTION TRANSCRIPTS');
    console.log('='.repeat(80));

    for (const ie of runInteractions) {
      const full = evaluationStore.getInteractionEval(ie.evalId);
      if (!full) continue;

      console.log(`\nScenario: ${full.scenarioName || full.scenarioId}`);
      console.log(`Tutor:    ${full.tutorProfile}  |  Learner: ${full.learnerProfile}`);
      console.log(`Turns:    ${full.turnCount}  |  Score: ${full.judgeOverallScore ?? '--'}`);
      console.log('-'.repeat(80));

      if (full.formattedTranscript) {
        console.log(full.formattedTranscript);
      } else if (full.turns?.length > 0) {
        for (const turn of full.turns) {
          const speaker = (turn.phase || turn.role || 'unknown').toUpperCase();
          console.log(`[Turn ${turn.turnNumber || '?'}] ${speaker}:`);
          console.log(turn.externalMessage || turn.content || '');
          console.log('');
        }
      }
    }
  }
}
