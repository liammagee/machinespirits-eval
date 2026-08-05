export function runEvaluateReview({ evaluationStore, profileFilter, runId, scenarioFilter, verbose }) {
  const results = evaluationStore.getResults(runId, {
    scenarioId: scenarioFilter,
    profileName: profileFilter,
  });

  if (results.length === 0) {
    console.error(`No results found for run: ${runId}`);
    process.exit(1);
  }

  const evaluated = results.filter((result) => result.baseScore != null);
  if (evaluated.length === 0) {
    console.log('No evaluated results to review. Run evaluate first.');
    return;
  }

  console.log(`\nReviewing ${evaluated.length} evaluated result(s) for run: ${runId}\n`);

  for (let index = 0; index < evaluated.length; index++) {
    const result = evaluated[index];
    const profileName = result.profileName || `${result.provider}/${result.model}`;
    const dimensionScores = Object.entries(result.scores || {})
      .filter(([, value]) => value != null)
      .map(([key, value]) => `${key}=${typeof value === 'object' ? value.score : value}`)
      .join(' ');

    console.log(
      `[${index + 1}/${evaluated.length}] ${result.scenarioId} / ${profileName} ... ${result.tutorFirstTurnScore?.toFixed(1) ?? '--'}  (${dimensionScores})`,
    );

    const suggestion =
      result.dialogueId && result.suggestions?.length > 1
        ? result.suggestions[result.suggestions.length - 1]
        : result.suggestions?.[0];
    if (suggestion) {
      const suggestionText =
        typeof suggestion === 'string'
          ? suggestion
          : suggestion.message || suggestion.text || suggestion.content || JSON.stringify(suggestion);
      const excerpt =
        suggestionText.length > 200
          ? `${suggestionText.slice(0, 200).replace(/\n/g, ' ')}...`
          : suggestionText.replace(/\n/g, ' ');
      console.log(`     Suggestion: ${excerpt}`);
    }

    if (result.evaluationReasoning) {
      const excerpt =
        result.evaluationReasoning.length > 300
          ? `${result.evaluationReasoning.slice(0, 300).replace(/\n/g, ' ')}...`
          : result.evaluationReasoning.replace(/\n/g, ' ');
      console.log(`     Judge: ${excerpt}`);
    }

    if (verbose && result.scores) {
      for (const [dimension, value] of Object.entries(result.scores)) {
        if (typeof value === 'object' && value?.reasoning) {
          const excerpt =
            value.reasoning.length > 150
              ? `${value.reasoning.slice(0, 150).replace(/\n/g, ' ')}...`
              : value.reasoning.replace(/\n/g, ' ');
          console.log(`       ${dimension} (${value.score}): ${excerpt}`);
        }
      }
    }
    console.log('');
  }

  const scores = evaluated.map((result) => result.tutorFirstTurnScore).filter((score) => score != null);
  if (scores.length > 0) {
    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const standardDeviation = Math.sqrt(
      scores.reduce((sum, score) => sum + (score - average) ** 2, 0) / (scores.length - 1),
    );
    console.log(`Reviewed ${evaluated.length} results: avg=${average.toFixed(1)} sd=${standardDeviation.toFixed(1)}`);
  }
}
