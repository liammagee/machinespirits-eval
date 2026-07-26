/**
 * Pure presentation primitives for the tutor-stub interim/loading surface.
 * Timers, animation state, TTY detection, terminal writes, and panel data
 * assembly remain in the CLI.
 */

export function formatTutorStubSignedInterimNumber(value, { decimals = 2 } = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric === 0) return null;
  return `${numeric > 0 ? '+' : ''}${numeric.toFixed(decimals)}`;
}

export function summarizeTutorStubInterimCapabilities(state) {
  const bits = [];
  if (state?.classifier?.enabled) bits.push('learner reading');
  if (state?.learnerDag?.enabled) bits.push('reasoning progress');
  if (state?.register?.enabled) bits.push('response style');
  if (state?.dag) bits.push('evidence pacing');
  return bits.length ? bits.join(', ') : 'plain tutor response';
}

export function tutorStubInterimLevel(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 'not available';
  if (numeric < 0.25) return 'low';
  if (numeric < 0.5) return 'developing';
  if (numeric < 0.75) return 'strong';
  return 'very strong';
}

export function tutorStubPlainInterimBottleneck(value) {
  const labels = {
    release_or_pacing_gap: 'the learner needs the next usable piece of evidence',
    warrant_gap: 'the learner needs a clearer reasoning link',
    unsupported_assertion: 'the conclusion has moved beyond the evidence',
    grounded_asserted_secret: 'the conclusion is supported and stated',
    grounded_unasserted_secret: 'the conclusion is supported but not yet stated',
  };
  return labels[value] || String(value || 'the next useful learner move').replaceAll('_', ' ');
}

export function tutorStubInterimCliHintPanels(active) {
  const state = active.state || {};
  const phase = String(active.basePhase || active.phase || '').toLowerCase();
  const hints = [
    {
      label: 'CLI hint',
      tone: 'neutral',
      text: 'type / to browse | type to filter | Tab completes | /help groups commands',
    },
  ];

  if (state.passthrough?.enabled) {
    hints.push({
      label: 'While waiting',
      tone: 'neutral',
      text: '/status and /transcript stay live | /scenario changes the case | /reset cancels unfinished work',
    });
    return hints;
  }

  if (phase.includes('scenario') || phase.includes('opening')) {
    hints.push({
      label: 'Change setup',
      tone: 'neutral',
      text: '/scenario switches case | /profile changes learner | /settings adjusts models and pacing',
    });
  } else if (state.interaction?.mode === 'coach') {
    hints.push({
      label: 'Coach controls',
      tone: 'neutral',
      text: '/coach adds private guidance | /mode learner returns control | /analysis inspects the exchange',
    });
  } else if (state.interaction?.mode === 'auto' || state.interaction?.autoRunning) {
    hints.push({
      label: 'Auto controls',
      tone: 'neutral',
      text: '/status checks progress | /analysis inspects the exchange | /reset cancels safely',
    });
  } else {
    hints.push({
      label: 'Next moves',
      tone: 'neutral',
      text: '/clue asks for direction | /suggest previews a reply | /coach privately guides the tutor',
    });
  }

  return hints;
}
