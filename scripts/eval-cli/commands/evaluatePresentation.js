export function isMultiTurnResult(result) {
  if (!result.dialogueId) return false;
  // Messages-mode stores only Turn 0 in suggestions; check dialogueRounds or conversationMode
  if (result.conversationMode === 'messages' && result.dialogueRounds > 1) return true;
  return Array.isArray(result.suggestions) && result.suggestions.length > 1;
}

export function printEvaluateSummary(succeeded, failed, totalAttempted, scores, evalStartTime) {
  const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const evalEndTime = new Date();

  console.log('\n' + '='.repeat(50));
  console.log('  EVALUATE SUMMARY');
  console.log('='.repeat(50));
  console.log(`  Finished:  ${evalEndTime.toLocaleString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`);
  if (evalStartTime) {
    console.log(`  Duration:  ${((evalEndTime - evalStartTime) / 1000 / 60).toFixed(1)} min`);
  }
  console.log(`  Total:     ${totalAttempted}`);
  console.log(`  Succeeded: ${succeeded}`);
  console.log(`  Failed:    ${failed}`);
  if (scores.length > 0) {
    console.log(`  Avg score: ${avgScore.toFixed(1)}`);
  }
  console.log('');
}
