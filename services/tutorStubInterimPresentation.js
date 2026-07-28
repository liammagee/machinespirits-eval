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

export function summarizeTutorStubInterimField(state, { buildLightweightDialogueField } = {}) {
  if (!state?.turns?.length) return summarizeTutorStubInterimCapabilities(state);
  const field = buildLightweightDialogueField(state.turns);
  const final = field.summary.final;
  const bottleneck = tutorStubPlainInterimBottleneck(final.bottleneck);
  return [
    `learner understanding ${tutorStubInterimLevel(final.learnerMastery)}`,
    `pressure ${tutorStubInterimLevel(final.learnerRisk)}`,
    `tutor fit ${tutorStubInterimLevel(final.tutorAlignment)}`,
    `momentum ${tutorStubInterimLevel(final.jointMomentum)}`,
    bottleneck,
  ].join(' | ');
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

export function summarizeTutorStubPendingLearnerDag(context) {
  const model = context?.tutorLearnerDag?.model || context?.tutorLearnerDagModel || null;
  if (!model) return null;
  const metrics = model.metrics || {};
  const assessment = model.assessment || {};
  const missing = metrics.missingPremiseCount ?? assessment.missingPremiseCount ?? 0;
  return [
    `turn ${model.turn || context.tutorTurn || '?'}`,
    `${metrics.groundedCount || 0} public facts held`,
    `${metrics.voicedDerivedCount || 0} inferences stated`,
    `${missing} evidence pieces still needed`,
    tutorStubPlainInterimBottleneck(assessment.bottleneck),
  ].join(' | ');
}

export function summarizeTutorStubPendingLearner(context, { scoreValue, plainStrategyText } = {}) {
  if (!context?.learnerText && !context?.classification) return null;
  const turn = context.classification?.turn || {};
  const overall = context.classification?.overall || {};
  const scores = turn.scores || {};
  const move = String(turn.discourse_move || 'still being read').replaceAll('_', ' ');
  const stance = String(turn.epistemic_stance || 'still being read').replaceAll('_', ' ');
  const need = turn.pedagogical_need || overall.next_best_tutor_move || '';
  const bits = [
    `turn ${context.tutorTurn || '?'}`,
    `${move}; ${stance}`,
    `conceptual engagement ${tutorStubInterimLevel(Number(scoreValue(scores.conceptual_engagement)) / 5)}`,
    `evidence awareness ${tutorStubInterimLevel(Number(scoreValue(scores.epistemic_readiness)) / 5)}`,
  ];
  if (need) bits.push(`needs: ${oneLine(plainStrategyText(need), { max: 62 })}`);
  if (!context.classification && context.learnerText) bits.push(oneLine(context.learnerText, { max: 72 }));
  return bits.join(' | ');
}

export function summarizeTutorStubPendingRegister(
  context,
  { formatDistribution, displayDiagnosticLabel, plainStrategyText } = {},
) {
  const selection = context?.registerSelection;
  const efficacy = context?.previousRegisterEfficacy;
  if (!selection && !efficacy) return null;
  const bits = [];
  if (selection) {
    const blend = formatDistribution(selection.distribution, { limit: 4 });
    bits.push(blend ? `blend ${blend}` : `led by ${selection.selected_register || 'unknown'}`);
    if (selection.actorial_part_label || selection.actorial_part) {
      bits.push(
        `playing ${oneLine(selection.actorial_part_label || displayDiagnosticLabel(selection.actorial_part), { max: 42 })}`,
      );
    }
    if (selection.actorial_performance?.label) {
      bits.push(`through ${oneLine(selection.actorial_performance.label, { max: 32 })}`);
    }
    if (selection.expected_field_move) {
      bits.push(`aim: ${oneLine(plainStrategyText(selection.expected_field_move), { max: 68 })}`);
    }
  }
  if (efficacy) {
    const result =
      efficacy.label === 'positive_progress'
        ? 'helped'
        : efficacy.label === 'regression_or_overreach'
          ? 'hurt progress'
          : 'had no clear effect yet';
    bits.push(`last ${efficacy.selected_register || 'style'} ${result}`);
    if (efficacy.learnerFeedback?.rating) {
      bits.push(`learner rated it ${efficacy.learnerFeedback.rating === 'up' ? 'helpful' : 'not helpful'}`);
    }
  }
  return bits.join(' | ');
}

export function summarizeTutorStubPendingDagMovement(state, context, { dagProgressFeatures } = {}) {
  const model = context?.tutorLearnerDag?.model || context?.tutorLearnerDagModel || null;
  if (!model) return null;
  const previous = findTutorStubPreviousLearnerDagModel(state, context);
  const currentFeatures = dagProgressFeatures(model);
  const previousFeatures = dagProgressFeatures(previous);
  const coverageDelta = formatTutorStubSignedInterimNumber(
    currentFeatures.bestPathCoverage - previousFeatures.bestPathCoverage,
  );
  const groundedDelta = currentFeatures.groundedCount - previousFeatures.groundedCount;
  const voicedDelta = currentFeatures.voicedDerivedCount - previousFeatures.voicedDerivedCount;
  const answersDelta = currentFeatures.answerCandidateCount - previousFeatures.answerCandidateCount;
  const missingDelta = currentFeatures.missingPremiseCount - previousFeatures.missingPremiseCount;
  const deltas = [
    coverageDelta ? `path coverage ${coverageDelta}` : null,
    groundedDelta
      ? `${Math.abs(groundedDelta)} public fact${Math.abs(groundedDelta) === 1 ? '' : 's'} ${groundedDelta > 0 ? 'added' : 'lost'}`
      : null,
    voicedDelta
      ? `${Math.abs(voicedDelta)} inference${Math.abs(voicedDelta) === 1 ? '' : 's'} ${voicedDelta > 0 ? 'added' : 'lost'}`
      : null,
    answersDelta
      ? `${Math.abs(answersDelta)} answer candidate${Math.abs(answersDelta) === 1 ? '' : 's'} ${answersDelta > 0 ? 'added' : 'removed'}`
      : null,
    missingDelta
      ? `${Math.abs(missingDelta)} needed piece${Math.abs(missingDelta) === 1 ? '' : 's'} ${missingDelta < 0 ? 'resolved' : 'added'}`
      : null,
  ].filter(Boolean);
  const assessment = model.assessment || {};
  return [
    `turn ${model.turn || context.tutorTurn || '?'}`,
    deltas.length ? deltas.join(', ') : 'no clear reasoning movement yet',
    assessment.finalSecretEntailed
      ? 'the conclusion is supported'
      : assessment.assertedSecret
        ? 'the conclusion was stated too early'
        : 'the conclusion remains open',
  ].join(' | ');
}

export function summarizeTutorStubLearnerRecordUpdate(state, context, { factSurface } = {}) {
  const result = context?.tutorLearnerDag;
  if (!result?.accepted && !result?.rejected?.length) return null;
  const accepted = result.accepted || {};
  const adopted = (accepted.adopt || []).join(',') || null;
  const retracted = (accepted.retract || []).join(',') || null;
  const derived = (accepted.derive || []).map((fact) => oneLine(factSurface(state.world, fact), { max: 34 }));
  const rejected = result.rejected?.length || 0;
  const bits = [
    `turn ${context.tutorTurn || result.model?.turn || '?'}`,
    adopted ? `${accepted.adopt.length} evidence piece${accepted.adopt.length === 1 ? '' : 's'} accepted` : null,
    retracted ? `${accepted.retract.length} evidence piece${accepted.retract.length === 1 ? '' : 's'} withdrawn` : null,
    derived.length ? `new inference: ${derived.slice(0, 2).join('; ')}` : null,
    accepted.hypothesis ? `working idea: ${oneLine(accepted.hypothesis, { max: 52 })}` : null,
    accepted.assertAnswer ? `proposed answer: ${accepted.assertAnswer}` : null,
    rejected ? `${rejected} unsupported update${rejected === 1 ? '' : 's'} ignored` : null,
  ].filter(Boolean);
  return bits.length > 1 ? bits.join(' | ') : null;
}

export function summarizeTutorStubPendingObjective(state, context, { currentReleaseRows, plainStrategyText } = {}) {
  if (!context?.learnerText && !context?.classification && !context?.tutorLearnerDag?.model) return null;
  const turn = context.classification?.turn || {};
  const overall = context.classification?.overall || {};
  const assessment = context.tutorLearnerDag?.model?.assessment || {};
  const selection = context.registerSelection || {};
  const bottleneck = tutorStubPlainInterimBottleneck(
    assessment.bottleneck || turn.pedagogical_need || 'awaiting analysis',
  );
  const register = selection.selected_register
    ? `style led by ${selection.selected_register}`
    : 'style still being chosen';
  const target =
    selection.expected_dag_move ||
    overall.next_best_tutor_move ||
    turn.pedagogical_need ||
    'choose one learner-owned next move';
  const due = currentReleaseRows(state, context.tutorTurn).map((row) => row.premise);
  return [
    `turn ${context.tutorTurn || '?'}`,
    `focus: ${oneLine(bottleneck, { max: 54 })}`,
    register,
    due.length ? `${due.length} new clue${due.length === 1 ? '' : 's'} available now` : null,
    `aim: ${oneLine(plainStrategyText(target), { max: 76 })}`,
  ]
    .filter(Boolean)
    .join(' | ');
}

export function summarizeTutorStubEvidenceTiming(
  state,
  context,
  { currentReleaseRows, nextReleaseRow, committedReleaseRows } = {},
) {
  const world = state?.world;
  const tutorTurn = Number(context?.tutorTurn || (state?.turns?.length || 0) + 1);
  if (!world || !Number.isFinite(tutorTurn)) return null;
  const dueNow = currentReleaseRows(state, tutorTurn);
  const next = nextReleaseRow(state);
  const last = committedReleaseRows(state, tutorTurn).at(-1) || null;
  const dueSummary = dueNow.length
    ? `available now: ${oneLine(dueNow[0].surface, { max: 78 })}`
    : last
      ? 'no new evidence this turn; earlier evidence remains available'
      : 'no case evidence has been introduced yet';
  const nextSummary = next
    ? `next new clue is planned for turn ${next.turn} from the ${next.via === 'director' ? 'scene' : 'tutor'}`
    : 'all planned clues are available';
  return `turn ${tutorTurn} | ${dueSummary} | ${nextSummary}`;
}

export function summarizeTutorStubPendingTutorDag(state, context, { buildTutorDagSnapshot } = {}) {
  const snapshot =
    context?.tutorDagSnapshot || buildTutorDagSnapshot(state, context?.tutorTurn || state?.turns?.length + 1);
  if (!snapshot) return null;
  const next = snapshot.nextRelease
    ? `next clue planned for turn ${snapshot.nextRelease.turn}`
    : 'all planned clues are available';
  return `turn ${snapshot.turn} | ${snapshot.leavesReleased} of ${snapshot.leavesTotal} key clues revealed | ${next}`;
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
