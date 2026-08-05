export function formatTraceEntry(entry) {
  // Legacy format
  if (entry.role || entry.speaker) {
    const role = (entry.role || entry.speaker).toUpperCase();
    const content = entry.content || entry.message || entry.text || '';
    return `[${role}] ${content}`;
  }

  // Structured multi-agent format
  const agent = (entry.agent || 'unknown').toUpperCase();
  const action = entry.action || '';

  switch (action) {
    case 'context_input': {
      const ctx = entry.contextData || {};
      const parts = [];
      if (ctx.currentPage) parts.push(ctx.currentPage.replace(/^\*+:\s*/, ''));
      if (ctx.strugglesCount) parts.push(`${ctx.strugglesCount} struggle signals`);
      if (ctx.sessions) parts.push(`${ctx.sessions} prior sessions`);
      return `[CONTEXT] ${parts.length ? parts.join(', ') : '(scenario input)'}`;
    }
    case 'generate': {
      const titles = (entry.suggestions || []).map((s) => s.title || s.type).join('; ');
      return `[EGO → SUPEREGO] Generated: ${titles}`;
    }
    case 'review': {
      const verdict = entry.verdict || {};
      const approved = entry.approved ?? verdict.approved;
      const tag = approved ? '✓ APPROVED' : '→ REVISE';
      const feedback = entry.feedback || verdict.feedback || '';
      const summary = feedback.length > 200 ? feedback.substring(0, 200) + '…' : feedback;
      return `[SUPEREGO ${tag}] ${summary}`;
    }
    case 'revise': {
      const titles = (entry.suggestions || []).map((s) => s.title || s.type).join('; ');
      return `[EGO revised] ${titles}`;
    }
    case 'final_output': {
      const detail = entry.contextSummary || entry.detail || `Turn ${(entry.turnIndex || 0) + 1} complete`;
      return `[OUTPUT] ${detail}`;
    }
    case 'turn_action': {
      const learnerMsg = entry.contextSummary || entry.detail || '';
      return `[LEARNER] ${learnerMsg}`;
    }
    default: {
      const content = entry.content || entry.message || entry.text || entry.contextSummary || action;
      return `[${agent}:${action}] ${content}`;
    }
  }
}

/**
 * Build a scenario×profile grid from JSONL events.
 * Returns { scenarios, profiles, grid, completedTests, totalTests, runDone }.
 */
