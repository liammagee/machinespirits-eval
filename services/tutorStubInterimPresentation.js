/**
 * Pure presentation primitives for the tutor-stub interim/loading surface.
 * Timers, animation state, TTY detection, terminal writes, and live panel data
 * computation remain in the CLI.
 */

export function createTutorStubInterimState({ enabled }) {
  return { enabled, active: null, lastContext: null };
}

export function resolveTutorStubInterimState(holder) {
  if (!holder) return null;
  if (
    Object.prototype.hasOwnProperty.call(holder, 'active') &&
    Object.prototype.hasOwnProperty.call(holder, 'enabled')
  ) {
    return holder;
  }
  return holder.interim || null;
}

export function findTutorStubPreviousLearnerDagModel(state, context) {
  const currentTurn = Number(context?.tutorTurn || 0);
  return [...(state?.turns || [])].reverse().find((turn) => !currentTurn || Number(turn.turn || 0) < currentTurn)
    ?.tutorLearnerDagModel;
}

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

export function projectTutorStubInterimPanels({
  hints = [],
  tutorFocus,
  dialogueOutlook,
  reasoningChange,
  learnerReasoning,
  evidencePacing,
  learnerReading,
  reasoningState,
  tutorStyle,
  clueProgress,
  dialogueSoFar,
  fallback,
}) {
  const panels = [
    ...hints,
    { label: 'Tutor focus', tone: 'focus', text: tutorFocus },
    { label: 'Dialogue outlook', tone: 'progress', text: dialogueOutlook },
    { label: 'Reasoning change', tone: 'progress', text: reasoningChange },
    { label: 'Learner reasoning', tone: 'learner', text: learnerReasoning },
    { label: 'Evidence pacing', tone: 'evidence', text: evidencePacing },
    { label: 'Learner reading', tone: 'learner', text: learnerReading },
    { label: 'Reasoning state', tone: 'progress', text: reasoningState },
    { label: 'Tutor style', tone: 'focus', text: tutorStyle },
    { label: 'Clue progress', tone: 'evidence', text: clueProgress },
    { label: 'Dialogue so far', tone: 'progress', text: dialogueSoFar },
  ].filter((panel) => panel.text);
  return panels.length ? panels : [{ label: 'Active checks', tone: 'neutral', text: fallback }];
}

function oneLine(value, { max = 220 } = {}) {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 3))}...`;
}

function interimToneColor(tone, colors) {
  if (tone === 'progress') return colors.green;
  if (tone === 'evidence') return colors.yellow;
  if (tone === 'learner') return colors.cyan;
  if (tone === 'focus') return colors.magenta;
  return colors.dim;
}

export function renderTutorStubInterimFrame({ tick, startedAt, now, columns, phase, panels, frames, colors }) {
  const frame = frames[tick % frames.length];
  const elapsed = ((now - startedAt) / 1000).toFixed(1).padStart(4);
  const width = Math.max(60, Math.min(columns || 140, 180) - 1);
  const panelIndex = Math.floor(tick / 4) % panels.length;
  const panel = panels[panelIndex];
  const compactPhase = oneLine(phase, { max: 28 });
  const prefix = `${frame} ${compactPhase} · ${elapsed}s · view ${panelIndex + 1}/${panels.length} | ${panel.label}: `;
  const panelText = oneLine(panel.text, { max: Math.max(12, width - prefix.length) });
  return [
    colors.accent2,
    frame,
    ' ',
    colors.bold,
    compactPhase,
    colors.reset,
    colors.dim,
    ` · ${elapsed}s · `,
    colors.reset,
    colors.yellow,
    `view ${panelIndex + 1}/${panels.length}`,
    colors.reset,
    colors.dim,
    ' | ',
    colors.reset,
    interimToneColor(panel.tone, colors),
    panel.label,
    colors.reset,
    `: ${panelText}`,
  ].join('');
}
