export function projectTutorStubRegisterHistoryPrompt(state, { normalizeSelection } = {}) {
  const history = state?.register?.history || [];
  if (!history.length) return 'No prior tutor-register choices.';
  return history
    .slice(-6)
    .map((entry) => {
      const normalized = normalizeSelection(entry);
      const efficacy = normalized?.efficacy
        ? `${normalized.efficacy.label} (DAG score ${normalized.efficacy.progressScore}; ${
            normalized.efficacy.learnerFeedback?.rating
              ? `learner rating ${normalized.efficacy.learnerFeedback.rating}; `
              : ''
          }${normalized.efficacy.summary})`
        : 'pending next learner turn';
      return `Turn ${entry.turn}: ${normalized?.selected_register || 'unknown'} — ${entry.register_reason || 'no reason'}; efficacy: ${efficacy}`;
    })
    .join('\n');
}
