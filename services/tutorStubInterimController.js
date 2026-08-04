import { tutorStubCliMotionInterval, tutorStubCliSpinnerFrames } from './tutorStubCliTheme.js';
import {
  createTutorStubInterimState,
  formatTutorStubSignedInterimNumber,
  projectTutorStubInterimPanels,
  renderTutorStubInterimFrame,
  resolveTutorStubInterimState,
  summarizeTutorStubInterimCapabilities,
  summarizeTutorStubInterimField,
  summarizeTutorStubEvidenceTiming,
  summarizeTutorStubLearnerRecordUpdate,
  summarizeTutorStubPendingDagMovement,
  summarizeTutorStubPendingField,
  summarizeTutorStubPendingLearner,
  summarizeTutorStubPendingLearnerDag,
  summarizeTutorStubPendingObjective,
  summarizeTutorStubPendingRegister,
  summarizeTutorStubPendingTutorDag,
  tutorStubInterimCliHintPanels,
} from './tutorStubInterimPresentation.js';

export { createTutorStubInterimState, formatTutorStubSignedInterimNumber, resolveTutorStubInterimState };

export function createTutorStubInterimController({
  buildHumanDiscourseFrame,
  buildLightweightDialogueField,
  buildTutorDagSnapshot,
  colors,
  committedReleaseRows,
  currentReleaseRows,
  dagProgressFeatures,
  displayDiagnosticLabel,
  factSurface,
  formatEngagementStanceDistribution,
  getPresentation,
  lightweightFieldTurn,
  nextReleaseRow,
  output,
  plainStrategyText,
  scoreValue,
  write = (text) => process.stdout.write(text),
}) {
  function clearStatusLine() {
    write('\r\x1b[2K');
  }

  function printWithConcurrentTerminal(state, callback) {
    const terminal = state?.concurrentTerminal;
    return terminal?.enabled ? terminal.print(callback) : callback();
  }

  function interimAnimationAvailable(interim) {
    return Boolean(interim?.enabled && output.isTTY && getPresentation().motion !== 'off');
  }

  const compactInterimFieldSummary = (state) =>
    summarizeTutorStubInterimField(state, { buildLightweightDialogueField });

  const compactPendingObjectiveSummary = (state, context) =>
    summarizeTutorStubPendingObjective(state, context, { currentReleaseRows, plainStrategyText });

  const compactPendingLearnerSummary = (context) =>
    summarizeTutorStubPendingLearner(context, { scoreValue, plainStrategyText });

  const compactPendingDagMovementSummary = (state, context) =>
    summarizeTutorStubPendingDagMovement(state, context, { dagProgressFeatures });

  const compactLearnerRecordUpdateSummary = (state, context) =>
    summarizeTutorStubLearnerRecordUpdate(state, context, { factSurface });

  const compactPendingRegisterSummary = (context) =>
    summarizeTutorStubPendingRegister(context, {
      formatDistribution: formatEngagementStanceDistribution,
      displayDiagnosticLabel,
      plainStrategyText,
    });

  const compactEvidenceTimingSummary = (state, context) =>
    summarizeTutorStubEvidenceTiming(state, context, {
      currentReleaseRows,
      nextReleaseRow,
      committedReleaseRows,
    });

  const compactPendingTutorDagSummary = (state, context) =>
    summarizeTutorStubPendingTutorDag(state, context, { buildTutorDagSnapshot });

  const compactPendingFieldSummary = (state, context) =>
    summarizeTutorStubPendingField(state, context, {
      buildLightweightDialogueField,
      lightweightFieldTurn,
      buildTutorDagSnapshot,
    });

  function compactInterimPanels(active) {
    const context = active.context || {};
    return projectTutorStubInterimPanels({
      hints: tutorStubInterimCliHintPanels(active),
      tutorFocus: compactPendingObjectiveSummary(active.state, context),
      dialogueOutlook: compactPendingFieldSummary(active.state, context),
      reasoningChange: compactPendingDagMovementSummary(active.state, context),
      learnerReasoning: compactLearnerRecordUpdateSummary(active.state, context),
      evidencePacing: compactEvidenceTimingSummary(active.state, context),
      learnerReading: compactPendingLearnerSummary(context),
      reasoningState: summarizeTutorStubPendingLearnerDag(context),
      tutorStyle: compactPendingRegisterSummary(context),
      clueProgress: compactPendingTutorDagSummary(active.state, context),
      dialogueSoFar: compactInterimFieldSummary(active.state),
      fallback: summarizeTutorStubInterimCapabilities(active.state),
    });
  }

  function renderInterimStatus(active) {
    const presentation = getPresentation();
    active.tick += 1;
    return renderTutorStubInterimFrame({
      tick: active.tick,
      startedAt: active.startedAt,
      now: Date.now(),
      columns: output.columns,
      phase: active.basePhase || active.phase,
      panels: compactInterimPanels(active),
      frames: tutorStubCliSpinnerFrames(presentation),
      colors,
    });
  }

  function interimConcurrentTerminalIsVisible(active) {
    const terminal = active.state?.concurrentTerminal;
    return Boolean(terminal?.enabled && terminal.snapshot?.().surfaceVisible);
  }

  function clearRenderedInterimStatus(active) {
    if (!active?.rendered) return;
    if (active.renderTarget === 'concurrent') active.state.concurrentTerminal.clearStatus();
    else clearStatusLine();
  }

  function stopInterimAnimation(holder, { clear = true } = {}) {
    const interim = resolveTutorStubInterimState(holder);
    const active = interim?.active;
    if (!active) return false;
    if (active.interval) clearInterval(active.interval);
    interim.active = null;
    if (clear) clearRenderedInterimStatus(active);
    return true;
  }

  function startInterimAnimation(state, phase, context = null) {
    const interim = resolveTutorStubInterimState(state);
    stopInterimAnimation(interim, { clear: true });
    if (!interimAnimationAvailable(interim)) return null;

    interim.lastContext = context || null;
    const active = {
      state,
      context: context || {},
      phase,
      basePhase: phase,
      startedAt: Date.now(),
      tick: -1,
      interval: null,
      paused: false,
      rendered: false,
      renderTarget: null,
    };
    active.render = () => {
      if (active.paused) return;
      const rendered = `${renderInterimStatus(active)}${colors.reset}`;
      if (interimConcurrentTerminalIsVisible(active)) {
        if (active.renderTarget === 'direct') clearStatusLine();
        active.state.concurrentTerminal.setStatus(rendered);
        active.renderTarget = 'concurrent';
      } else {
        if (active.renderTarget === 'concurrent') active.state.concurrentTerminal.clearStatus();
        clearStatusLine();
        write(`${rendered}\r`);
        active.renderTarget = 'direct';
      }
      active.rendered = true;
    };
    interim.active = active;
    active.render();
    active.interval = setInterval(active.render, tutorStubCliMotionInterval(getPresentation()));
    active.interval.unref?.();
    return active;
  }

  function buildTutorInterimContext({
    learnerText,
    state,
    classification = null,
    tutorLearnerDag = null,
    registerSelection = null,
    previousRegisterEfficacy = null,
  }) {
    const tutorTurn = state.turns.length + 1;
    return {
      learnerText,
      tutorTurn,
      classification,
      tutorLearnerDag,
      registerSelection,
      previousRegisterEfficacy,
      tutorDagSnapshot: buildTutorDagSnapshot(state, tutorTurn),
      humanDiscourseFrame: buildHumanDiscourseFrame({
        state,
        tutorTurn,
        tutorLearnerDag,
        classification,
        learnerText,
      }),
    };
  }

  function pauseInterimAnimation(holder) {
    const interim = resolveTutorStubInterimState(holder);
    const active = interim?.active;
    if (!active || active.paused) return false;
    if (active.interval) clearInterval(active.interval);
    active.interval = null;
    active.paused = true;
    clearRenderedInterimStatus(active);
    return true;
  }

  function resumeInterimAnimation(holder) {
    const interim = resolveTutorStubInterimState(holder);
    const active = interim?.active;
    if (!active || !active.paused || !interimAnimationAvailable(interim)) return false;
    active.paused = false;
    active.render();
    active.interval = setInterval(active.render, tutorStubCliMotionInterval(getPresentation()));
    active.interval.unref?.();
    return true;
  }

  return {
    buildTutorInterimContext,
    clearStatusLine,
    pauseInterimAnimation,
    printWithConcurrentTerminal,
    resumeInterimAnimation,
    startInterimAnimation,
    stopInterimAnimation,
  };
}
