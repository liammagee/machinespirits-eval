import fs from 'node:fs';
import path from 'node:path';
import {
  buildTutorStubExplanatoryDebugFrame as explanatoryDebugFrame,
  buildTutorStubExplanatoryDebugPrompt as explanatoryDebugPrompt,
  cleanTutorStubExplanatoryDebugProse as cleanExplanatoryDebugProse,
  fallbackTutorStubExplanatoryDebugProse as fallbackExplanatoryDebugProse,
  tutorStubRegisterPolicyCalculation as registerPolicyCalculation,
} from './tutorStubExplanatoryDebug.js';
import { projectTutorStubTurnAnalysisLines } from './tutorStubTurnAnalysisPresentation.js';
import { projectTutorStubTechnicalAnalysisLines } from './tutorStubTechnicalAnalysisPresentation.js';
import { projectTutorStubTechnicalDebugLines } from './tutorStubTechnicalDebugPresentation.js';
import {
  compactTutorStubCloseoutCounts as compactCounts,
  countTutorStubCloseoutRows as countBy,
  summarizeTutorStubGuardAccounting as summarizeTutorGuardAccounting,
} from './tutorStubCloseoutProjection.js';
import { projectTutorStubCloseoutReportLines } from './tutorStubCloseoutReportPresentation.js';
import { buildTutorStubTurnTiming, formatTutorStubTurnTiming } from './tutorStubTurnTiming.js';
import {
  formatTutorStubSafeTimestamp as safeTimestampForFile,
  formatTutorStubStateTurnDebugId as turnDebugId,
} from './tutorStubDebugIdentity.js';
import { normalizeStoredRegisterEfficacy, normalizeStoredRegisterSelection } from './tutorStubRegisterPolicy.js';
import { buildTutorStubLightweightDialogueField as buildLightweightDialogueField } from './tutorStubFieldTurnProjection.js';
import {
  projectTutorStubFieldVisualizationLines,
  projectTutorStubLightweightFieldLines,
  renderTutorStubLightweightFieldSvg as renderLightweightFieldSvg,
} from './tutorStubFieldPresentation.js';
import { summarizeTutorStubResponseConfigurationAudits } from './tutorStubResponseConfiguration.js';
import { tutorStubComprehensionSnapshot } from './tutorStubComprehensionState.js';
import { tutorStubReleasePacingSnapshot } from './tutorStubReleasePacing.js';
import {
  buildTutorStubLearningSummary as buildDialogueLearningSummary,
  tutorStubDialogueCaseStatus as dialogueCaseStatus,
} from './tutorStubLearningSummary.js';
import { tutorStubResponseMetadataLine as metadataLine } from './tutorStubResponseDetails.js';

export function createTutorStubDebugReportRuntime({
  C,
  ROOT,
  STUB,
  appendTraceEvent,
  assertTutorStubTurnAttemptCurrent,
  callPromptModel,
  formatEngagementStanceDistribution,
  getInterimState,
  jsonClone,
  printWithConcurrentTerminal,
  resolveWorkspacePath,
  startInterimAnimation,
  stopInterimAnimation,
  traceDisplayPath,
  writeLine = console.log,
}) {
  function printResponseDetails(meta, state, { suffix = '' } = {}) {
    if (!state?.responseDetails?.enabled) return false;
    writeLine(`${C.dim}${metadataLine(meta)}${suffix}${C.reset}`);
    const timingLine = formatTutorStubTurnTiming(meta?.turnTiming);
    if (timingLine) writeLine(`${C.dim}${timingLine}${C.reset}`);
    writeLine('');
    return true;
  }

  function recordTutorStubTurnTiming({
    response,
    state,
    tutorTurn,
    classification = null,
    tutorLearnerDag = null,
    timingContext = null,
  }) {
    if (!timingContext?.startedAtMs) return null;
    const turnTiming = buildTutorStubTurnTiming({
      ...timingContext,
      completedAtMs: Date.now(),
      classification,
      tutorLearnerDag,
      response,
    });
    response.turnTiming = turnTiming;
    appendTraceEvent(state.trace, {
      type: 'turn_timing_breakdown',
      turn: tutorTurn,
      turnId: turnDebugId(state, tutorTurn),
      timing: turnTiming,
      publicTranscriptChanged: false,
    });
    return turnTiming;
  }

  function printCurrentTurnAnalysis(state, { technical = false } = {}) {
    if (technical) return printCurrentTurnTechnicalAnalysis(state);
    const turn = state.turns[state.turns.length - 1] || null;
    const registerSelection = turn ? normalizeStoredRegisterSelection(turn.registerSelection || null) : null;
    const previousEfficacy = turn ? normalizeStoredRegisterEfficacy(turn.previousRegisterEfficacy || null) : null;
    const lines = projectTutorStubTurnAnalysisLines({
      turn,
      registerSelection,
      previousEfficacy,
      policy: registerSelection?.primary_policy || state.register?.policy || 'off',
      distribution: formatEngagementStanceDistribution(registerSelection?.distribution, { limit: 4 }),
      colors: C,
    });
    for (const line of lines) writeLine(line);
  }

  function printExplanatoryDebugTechnical(state, { force = false, terminalWrapped = false } = {}) {
    if (!force && !state.explanatoryDebug?.enabled) return false;
    if (!terminalWrapped && state.concurrentTerminal?.enabled) {
      return printWithConcurrentTerminal(state, () =>
        printExplanatoryDebugTechnical(state, { force, terminalWrapped: true }),
      );
    }
    const turn = state.turns.at(-1) || null;
    if (!turn) {
      for (const line of projectTutorStubTechnicalDebugLines({ colors: C })) writeLine(line);
      return false;
    }

    const previousTurn = state.turns.at(-2) || null;
    const selection = normalizeStoredRegisterSelection(turn.registerSelection || null);
    const previousSelection = normalizeStoredRegisterSelection(previousTurn?.registerSelection || null);
    const policyCalculation = registerPolicyCalculation(selection);
    const field = buildLightweightDialogueField(state.turns);
    const fieldRow = field.rows.at(-1) || null;
    const currentRegister = selection?.engagement_stance || selection?.selected_register || 'off';
    const previousRegister = previousSelection?.engagement_stance || previousSelection?.selected_register || 'none';
    const registerChanged = previousRegister !== 'none' && previousRegister !== currentRegister;
    const activatedPolicy = selection?.activated_policy || selection?.primary_policy || selection?.policy || 'off';
    const lines = projectTutorStubTechnicalDebugLines({
      turn,
      turnIdentifier: turn.turnId || turnDebugId(state, turn.turn),
      selection,
      previousSelection,
      policyCalculation,
      field,
      distribution: formatEngagementStanceDistribution(selection?.distribution, { limit: 4 }),
      registerPolicy: state.register?.policy || 'off',
      registerTemperature: state.register?.temperature ?? null,
      colors: C,
    });
    for (const line of lines) writeLine(line);
    appendTraceEvent(state.trace, {
      type: 'explanatory_debug_output',
      format: 'technical',
      turn: turn.turn,
      turnId: turn.turnId || null,
      field: fieldRow,
      register: {
        previous: previousRegister,
        selected: currentRegister,
        changed: registerChanged,
        policy: selection?.policy || state.register?.policy || 'off',
        activatedPolicy,
      },
    });
    return true;
  }

  function explanatoryDebugModel(state) {
    if (state.learnerDag?.enabled && state.learnerDag.resolved) return state.learnerDag.resolved;
    if (state.classifier?.enabled && state.classifier.resolved) return state.classifier.resolved;
    return state.resolved;
  }

  async function printExplanatoryDebugTurn(
    state,
    { force = false, format = null, signal = null, isCurrent = null } = {},
  ) {
    if (!force && !state.explanatoryDebug?.enabled) return false;
    const selectedFormat = format || state.explanatoryDebug?.format || 'prose';
    if (selectedFormat === 'technical') return printExplanatoryDebugTechnical(state, { force: true });

    const turn = state.turns.at(-1) || null;
    if (!turn) {
      writeLine(`${C.brightBlue}${C.bold}debug >${C.reset} no completed turns yet\n`);
      return false;
    }

    const frame = explanatoryDebugFrame(state, turn);
    const resolved = explanatoryDebugModel(state);
    let response = null;
    let prose = '';
    let generated = true;
    const existingInterim = Boolean(getInterimState(state)?.active);
    if (!existingInterim) startInterimAnimation(state, 'explaining turn', { tutorTurn: turn.turn });
    try {
      response = await callPromptModel({
        prompt: explanatoryDebugPrompt(frame),
        resolved,
        systemPrompt:
          'You explain a tutoring harness to its operator. Be exact, terse, and readable. This is private meta-commentary, not dialogue in the scene.',
        role: 'tutor_stub_explanatory_debug',
        maxTokens: 220,
        trace: state.trace,
        stream: { enabled: false, interim: state.interim },
        cliEffort: state.cliEffort,
        turn: turn.turn,
        signal,
      });
      assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
      prose = cleanExplanatoryDebugProse(response.text);
      if (!prose) throw new Error('empty explanatory debug response');
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      generated = false;
      prose = fallbackExplanatoryDebugProse(frame);
      appendTraceEvent(state.trace, {
        type: 'explanatory_debug_fallback',
        turn: turn.turn,
        turnId: turn.turnId || null,
        error: error.message,
      });
    } finally {
      if (!existingInterim) stopInterimAnimation(state);
    }

    assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
    printWithConcurrentTerminal(state, () => {
      writeLine(`${C.brightBlue}${C.bold}debug >${C.reset} turn ${turn.turn} · prose${generated ? '' : ' fallback'}`);
      writeLine(`${C.dim}${prose}${C.reset}`);
      writeLine(`${C.dim}  technical evidence: /debug technical · stop: /debug off${C.reset}\n`);
    });
    appendTraceEvent(state.trace, {
      type: 'explanatory_debug_output',
      format: 'prose',
      generated,
      turn: turn.turn,
      turnId: turn.turnId || null,
      text: prose,
      provider: response?.provider || resolved?.provider || null,
      model: response?.model || resolved?.model || null,
      latencyMs: response?.latencyMs || null,
      usage: response?.usage || null,
      frame,
    });
    return true;
  }

  function printCurrentTurnTechnicalAnalysis(state) {
    const turn = state.turns[state.turns.length - 1] || null;
    const registerSelection = turn ? normalizeStoredRegisterSelection(turn.registerSelection || null) : null;
    const previousEfficacy = turn ? normalizeStoredRegisterEfficacy(turn.previousRegisterEfficacy || null) : null;
    const field = turn ? buildLightweightDialogueField(state.turns) : null;
    const lines = projectTutorStubTechnicalAnalysisLines({
      turn,
      turnIdentifier: turn ? turn.turnId || turnDebugId(state, turn.turn) : null,
      registerSelection,
      previousEfficacy,
      distribution: formatEngagementStanceDistribution(registerSelection?.distribution, { limit: 7 }),
      tracePath: turn ? traceDisplayPath(state.trace) : '',
      field,
      classifierEnabled: Boolean(state.classifier?.enabled),
      learnerDagEnabled: Boolean(state.learnerDag?.enabled),
      registerEnabled: Boolean(state.register?.enabled),
      registerTemperature: state.register?.temperature ?? null,
      tutorDagEnabled: Boolean(state.dag),
      colors: C,
    });
    for (const line of lines) writeLine(line);
  }

  function printLightweightDialogueField(state) {
    const field = state.turns.length ? buildLightweightDialogueField(state.turns) : null;
    for (const line of projectTutorStubLightweightFieldLines(field, { colors: C })) writeLine(line);
    return field;
  }

  function fieldVizBasePath(state) {
    const viz = state.fieldViz || {};
    const dir = viz.dir || resolveWorkspacePath(STUB.traceDir);
    const runId = viz.runId || state.trace?.runId || safeTimestampForFile();
    viz.dir = dir;
    viz.runId = runId;
    state.fieldViz = viz;
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, `${runId}-field`);
  }

  function writeFieldVisualization(state, { reason = 'field_viz', force = false } = {}) {
    if (!force && !state.fieldViz?.enabled) return null;
    if (!state.turns.length) return null;
    const field = buildLightweightDialogueField(state.turns);
    const basePath = fieldVizBasePath(state);
    const svgPath = `${basePath}.svg`;
    const jsonPath = `${basePath}.json`;
    fs.writeFileSync(svgPath, renderLightweightFieldSvg(field, { title: 'Tutor Stub Interaction Field' }));
    fs.writeFileSync(jsonPath, `${JSON.stringify(field, null, 2)}\n`);
    const result = {
      field,
      svgPath,
      jsonPath,
      svgDisplayPath: path.relative(ROOT, svgPath),
      jsonDisplayPath: path.relative(ROOT, jsonPath),
    };
    state.fieldViz.lastWrite = {
      svg: result.svgDisplayPath,
      json: result.jsonDisplayPath,
      turnCount: field.turnCount,
    };
    appendTraceEvent(state.trace, {
      type: 'field_visualization_write',
      reason,
      svg: result.svgDisplayPath,
      json: result.jsonDisplayPath,
      turnCount: field.turnCount,
      summary: field.summary,
    });
    return result;
  }

  function printFieldVisualization(state, { reason = 'viz' } = {}) {
    if (!state.turns.length) {
      for (const line of projectTutorStubFieldVisualizationLines(null, { colors: C })) writeLine(line);
      return null;
    }
    const result = writeFieldVisualization(state, { reason, force: true });
    if (!result) return null;
    for (const line of projectTutorStubFieldVisualizationLines(result, { colors: C })) writeLine(line);
    return result;
  }

  function printDialogueCloseout(state, { reason = 'report', trace = state.trace } = {}) {
    const tracePath = traceDisplayPath(trace);
    if (!state.turns.length) {
      for (const line of projectTutorStubCloseoutReportLines({ reason, tracePath, colors: C })) writeLine(line);
      return null;
    }

    const field = buildLightweightDialogueField(state.turns);
    const last = state.turns[state.turns.length - 1] || {};
    const assessment = last.tutorLearnerDagModel?.assessment || {};
    const metrics = last.tutorLearnerDagModel?.metrics || {};
    const registerCounts = compactCounts(
      countBy(
        state.turns,
        (turn) => normalizeStoredRegisterSelection(turn.registerSelection)?.selected_register || 'none',
      ),
    );
    const bottleneckCounts = compactCounts(
      countBy(state.turns, (turn) => turn.tutorLearnerDagModel?.assessment?.bottleneck || 'unknown'),
    );
    const responseConfigurationVisibility = summarizeTutorStubResponseConfigurationAudits(
      state.turns.map((turn) => turn.responseConfigurationAudit),
    );
    const guardAccounting = summarizeTutorGuardAccounting(state.turns, {
      policy: state.experiment?.policy || state.register?.policy || null,
      profile: state.experiment?.profile || null,
    });
    const payload = {
      schema: 'machinespirits.tutor-stub.closeout-report.v1',
      reason,
      turnCount: state.turns.length,
      trace: tracePath,
      trainingReuse: jsonClone(state.trainingReuse),
      finalStatus: dialogueCaseStatus(last),
      finalAssessment: {
        bottleneck: assessment.bottleneck || null,
        bestPathCoverage: assessment.bestPathCoverage ?? null,
        finalSecretEntailed: assessment.finalSecretEntailed === true,
        assertedSecret: assessment.assertedSecret === true,
        missingPremiseCount: Number(metrics.missingPremiseCount ?? assessment.missingPremiseCount ?? 0),
      },
      humanDiscourse: {
        config: state.humanDiscourse || null,
        finalFrame: last.humanDiscourseFrame || null,
        finalStatus: last.humanDiscourseFrame?.warrantPremiseAudit?.proofStatus || null,
        proofDebtStatus: last.humanDiscourseFrame?.proofDebt?.status || null,
        sideArcCount: state.turns.filter((turn) => turn.humanDiscourseFrame?.sideArc?.detected).length,
        openProofDebtCount: state.turns.reduce(
          (sum, turn) => sum + Number(turn.humanDiscourseFrame?.proofDebt?.counts?.open || 0),
          0,
        ),
        elidedBridgeCount: state.turns.reduce(
          (sum, turn) => sum + Number(turn.humanDiscourseFrame?.proofDebt?.counts?.elided || 0),
          0,
        ),
        questionSupportModes: Object.fromEntries(
          countBy(state.turns, (turn) => turn.humanDiscourseFrame?.questionSupport?.modality || 'none'),
        ),
        questionSupportRepairCount: state.turns.filter(
          (turn) => turn.tutorResponseRepaired && turn.humanDiscourseFrame?.questionSupport?.guardRequired,
        ).length,
      },
      comprehension: tutorStubComprehensionSnapshot(state.comprehension, {
        turn: state.turns.length + 1,
      }),
      releasePacing: tutorStubReleasePacingSnapshot(state.releasePacing, state.world),
      responseConfigurationVisibility,
      guardAccounting,
      dialogueClosure: last.dialogueClosure?.lifecycle || state.dialogueClosure || null,
      field: field.summary,
      finalTurn: {
        turnId: last.turnId || turnDebugId(state, last.turn),
        learner: last.learner || '',
        tutor: last.tutor || '',
        engagementStance:
          normalizeStoredRegisterSelection(last.registerSelection)?.engagement_stance ||
          normalizeStoredRegisterSelection(last.registerSelection)?.selected_register ||
          null,
        register: normalizeStoredRegisterSelection(last.registerSelection)?.selected_register || null,
        responseConfiguration: last.responseConfiguration || null,
        responseConfigurationAudit: last.responseConfigurationAudit || null,
        leakOk: last.tutorLeakAudit?.ok ?? null,
        closure: last.dialogueClosure || null,
      },
      learning: buildDialogueLearningSummary(state, { reason, trace: traceDisplayPath(state.trace) }),
    };

    const lines = projectTutorStubCloseoutReportLines({
      reason,
      tracePath,
      payload,
      lastTurn: last,
      registerCounts,
      bottleneckCounts,
      colors: C,
    });
    for (const line of lines) writeLine(line);
    return payload;
  }

  return {
    printCurrentTurnAnalysis,
    printDialogueCloseout,
    printExplanatoryDebugTurn,
    printFieldVisualization,
    printLightweightDialogueField,
    printResponseDetails,
    recordTutorStubTurnTiming,
    writeFieldVisualization,
  };
}
