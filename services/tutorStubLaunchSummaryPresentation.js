import path from 'node:path';
import {
  tutorStubDisplayDiagnosticLabel as displayDiagnosticLabel,
  tutorStubPlainList as plainList,
  tutorStubPlainPolicyLabel as plainPolicyLabel,
  tutorStubPlainSettingName as plainSettingName,
} from './tutorStubResponseDetails.js';
import {
  tutorStubProviderSupportsEventStreaming as providerSupportsEventStreaming,
  tutorStubProviderSupportsTokenStreaming as providerSupportsStreaming,
} from './tutorStubDevelopmentSpeakerTransport.js';
import { tutorStubCliMasthead } from './tutorStubCliTheme.js';
import { tutorStubRegisterPolicyStackId } from './tutorStubRegisterPolicyComposition.js';

export function createTutorStubLaunchSummaryPresentation({
  C,
  ROOT,
  getCliPresentation,
  output,
  traceDisplayPath,
  writeLine = console.log,
}) {
  function printTutorStubLaunchSummary({
    state,
    worldBundle,
    args,
    visibleModel,
    passthroughEnabled,
    observedAuditsEnabled,
    effectiveTopic,
    trace,
    allModelsOverride,
    rememberedSettings,
    classifierEnabled,
    combinedLearnerAnalysisEnabled,
    visibleLearnerRecordModel,
    visibleClassifierModel,
    tutorLearnerDagEnabled,
    humanDiscourseConfig,
    dagMode,
    autoLearnerEnabled,
    autoTurns,
    autoSafetyTurns,
    autoStopOnGrounded,
    visibleAutoLearnerModel,
    mixedLearnerEnabled,
    mixedLearnerRequested,
    interactiveSessionEnabled,
    typedActionConfig,
    typedActionTask,
    typedActionSupportLevel,
    registerSelectionEnabled,
    registerPalette,
    empiricalDynamicalSystemRegisterSelectionEnabled,
    continuousEmpiricalDynamicalSystemRegisterSelectionEnabled,
    registerEmpiricalPrior,
    continuousRegisterSelectionEnabled,
    continuousUnsafeRegisterAnchorsEnabled,
    streamEnabled,
    tutorStreamState,
    classifierResolved,
    learnerRecordResolved,
    interimAnimationEnabled,
    fieldVisualizationEnabled,
    traceDir,
    openingEnabled,
    firstMessage,
    closeoutReportEnabled,
    turnFeedbackEnabled,
    responseDetailsEnabled,
    learningSummaryReportConfig,
    summaryBrowserLaunchEnabled,
    dialogueClosureConfig,
    cliEffort,
    resumedDialogue,
    resumeRequested,
    temperature,
    effectiveTemperature,
  }) {
    const cliPresentation = getCliPresentation();
    if (output.isTTY) {
      writeLine(
        `\n${tutorStubCliMasthead(
          {
            eyebrow: 'MACHINE SPIRITS · LIVE INQUIRY',
            title: worldBundle?.world?.title || 'Tutor studio',
            subtitle: `${state.tuning.activeRef} · ${cliPresentation.themeLabel} · ${cliPresentation.motion} motion`,
            width: Math.min(output.columns || 68, 76),
          },
          cliPresentation,
        )}`,
      );
    }
    writeLine(
      `${output.isTTY ? '' : '\n'}${C.accent2}tutor-stub${C.reset} ${C.bold}${state.tuning.activeRef}${C.reset} ${C.dim}· ${args.model} -> ${visibleModel.provider}/${visibleModel.model} · tuning ${state.tuning.mode}${C.reset}`,
    );
    if (passthroughEnabled) {
      writeLine(`${C.brightCyan}${C.bold}passthrough >${C.reset} pure speaker chat · one model call per turn`);
      writeLine(`${C.dim}request: unchanged system setup + full public history + latest learner message${C.reset}`);
      if (observedAuditsEnabled) {
        writeLine(
          `${C.dim}observed audits: leak and repetition are evaluated and recorded after each turn; nothing is gated, repaired or replaced${C.reset}`,
        );
      }
      writeLine(
        `${C.dim}setup: ${worldBundle ? `${worldBundle.world.id} — ${worldBundle.world.title}` : effectiveTopic}${C.reset}`,
      );
      writeLine(`${C.dim}technical trace: ${trace.enabled ? traceDisplayPath(trace) : 'off'}${C.reset}`);
      writeLine(`${C.dim}type a message to begin · /settings model changes the speaker · /quit exits${C.reset}\n`);
    } else {
      if (allModelsOverride) {
        writeLine(
          `${C.dim}one model for every role: ${allModelsOverride.modelRef} (tutor, learner analysis, reasoning tracker, and automated/suggested learner)${C.reset}`,
        );
      }
      if (rememberedSettings.status === 'loaded' && rememberedSettings.appliedFields.length) {
        writeLine(
          `${C.dim}saved settings: restored ${plainList(rememberedSettings.appliedFields.map(plainSettingName))} from the last interactive session${C.reset}`,
        );
      } else if (rememberedSettings.warning) {
        writeLine(`${C.yellow}saved settings warning:${C.reset} ${rememberedSettings.warning}`);
      }
      if (classifierEnabled && combinedLearnerAnalysisEnabled) {
        writeLine(
          `${C.dim}learner analysis: one combined reading via ${args['learner-record-model']} → ${visibleLearnerRecordModel.provider}/${visibleLearnerRecordModel.model}${C.reset}`,
        );
      } else if (classifierEnabled) {
        writeLine(
          `${C.dim}learner analysis: ${args['classifier-model']} → ${visibleClassifierModel.provider}/${visibleClassifierModel.model}${C.reset}`,
        );
      } else {
        writeLine(`${C.dim}learner analysis: off${C.reset}`);
      }
      if (tutorLearnerDagEnabled) {
        writeLine(
          `${C.dim}learner reasoning tracker: on via ${args['learner-record-model']} → ${visibleLearnerRecordModel.provider}/${visibleLearnerRecordModel.model}${C.reset}`,
        );
      } else if (args['tutor-learner-dag'] && !worldBundle) {
        writeLine(`${C.dim}learner reasoning tracker: unavailable because no scenario is active${C.reset}`);
      } else {
        writeLine(`${C.dim}learner reasoning tracker: off${C.reset}`);
      }
      writeLine(
        `${C.dim}reasoning mode: ${displayDiagnosticLabel(dagMode)} (${humanDiscourseConfig.phase}; ${
          humanDiscourseConfig.behaviorChange ? 'human-friendly inference active' : 'strict proof audit'
        })${C.reset}`,
      );
      if (autoLearnerEnabled) {
        const autoTurnSummary = autoTurns === null ? `until grounded; safety ${autoSafetyTurns}` : `${autoTurns}`;
        writeLine(
          `${C.dim}automated learner: ${args['auto-learner-model']} → ${visibleAutoLearnerModel.provider}/${visibleAutoLearnerModel.model}; ${autoTurnSummary}; stop when complete: ${autoStopOnGrounded ? 'yes' : 'no'}${C.reset}`,
        );
      } else if (mixedLearnerEnabled) {
        writeLine(
          `${C.dim}learner suggestions: on via ${args['auto-learner-model']} → ${visibleAutoLearnerModel.provider}/${visibleAutoLearnerModel.model}; use /clue, Tab, /suggest, /use, or /regen${C.reset}`,
        );
      } else if (mixedLearnerRequested) {
        writeLine(`${C.dim}learner suggestions: off while the automated learner is running${C.reset}`);
      } else if (interactiveSessionEnabled && visibleAutoLearnerModel) {
        writeLine(
          `${C.dim}interactive roles: learner + private coach; /auto hands off to ${visibleAutoLearnerModel.provider}/${visibleAutoLearnerModel.model}${C.reset}`,
        );
      } else {
        writeLine(`${C.dim}automated learner: off${C.reset}`);
      }
      if (typedActionConfig.enabled) {
        writeLine(
          `${C.dim}typed pedagogical actions: on | task ${typedActionTask.taskId} | knowledge component ${
            typedActionTask.knowledgeComponent
          } | difficulty ${typedActionTask.itemDifficulty} | support ${
            typedActionSupportLevel === null ? 'action default' : typedActionSupportLevel
          }${C.reset}`,
        );
      }
      if (registerSelectionEnabled) {
        writeLine(
          `${C.dim}teaching style: ${plainPolicyLabel(state.register.policy)} | available stances [${registerPalette.join(', ')}] | policy ${tutorStubRegisterPolicyStackId(
            state.register.policy,
            state.register.overlays,
          )} | override sensitivity ${state.register.overlayThreshold} | style range ${state.register.temperature}${C.reset}`,
        );
        if (
          empiricalDynamicalSystemRegisterSelectionEnabled ||
          continuousEmpiricalDynamicalSystemRegisterSelectionEnabled ||
          registerEmpiricalPrior.status === 'loaded'
        ) {
          const priorPath = registerEmpiricalPrior.filePath
            ? path.relative(ROOT, registerEmpiricalPrior.filePath)
            : 'none';
          writeLine(
            `${C.dim}cross-run style evidence: ${
              registerEmpiricalPrior.status === 'loaded_holdout_not_passed'
                ? 'available but not steering (independent-run check not passed)'
                : registerEmpiricalPrior.status === 'loaded_legacy_requires_rebuild'
                  ? 'legacy artifact not steering (rebuild to add deduplication and independent-run checks)'
                  : registerEmpiricalPrior.status
            }${priorPath ? ` | ${priorPath}` : ''}${C.reset}`,
          );
        }
        if (continuousRegisterSelectionEnabled) {
          writeLine(
            `${C.dim}style blend sources: ${
              continuousUnsafeRegisterAnchorsEnabled ? 'active palette' : 'safe router-selectable only'
            }${C.reset}`,
          );
        }
      } else {
        writeLine(`${C.dim}teaching-style selection: off${C.reset}`);
      }
      if (trace.enabled) {
        writeLine(`${C.dim}technical trace: ${traceDisplayPath(trace)}${C.reset}`);
      } else {
        writeLine(`${C.dim}technical trace: off${C.reset}`);
      }
      if (streamEnabled) {
        const streamBits = [
          tutorStreamState === 'live' ? 'tutor live' : null,
          tutorStreamState === 'buffered_for_concurrent_input' ? 'tutor buffered while command line is live' : null,
          tutorStreamState === 'guarded_after_audit' ? 'tutor guarded-after-audit' : null,
          tutorStreamState === 'cli_events' ? 'tutor CLI events' : null,
          classifierResolved && providerSupportsStreaming(classifierResolved) ? 'learner analysis' : null,
          learnerRecordResolved && providerSupportsStreaming(learnerRecordResolved) ? 'reasoning tracker' : null,
          classifierResolved && providerSupportsEventStreaming(classifierResolved) ? 'learner-analysis events' : null,
          learnerRecordResolved && providerSupportsEventStreaming(learnerRecordResolved)
            ? 'reasoning-tracker events'
            : null,
        ].filter(Boolean);
        const streamSummary = streamBits.length
          ? `on for ${streamBits.join(', ')}`
          : tutorStreamState === 'unavailable_cli_buffered'
            ? 'requested, but tutor provider is CLI-buffered'
            : 'requested, but selected providers are CLI-buffered';
        writeLine(`${C.dim}live output: ${streamSummary}${C.reset}`);
      } else {
        writeLine(`${C.dim}live output: off${C.reset}`);
      }
      writeLine(
        `${C.dim}terminal appearance: ${cliPresentation.themeLabel} · ${cliPresentation.motion} motion · ${cliPresentation.colorMode}; /theme and /motion change it live${C.reset}`,
      );
      writeLine(
        `${C.dim}progress display: ${
          interimAnimationEnabled
            ? output.isTTY && cliPresentation.motion !== 'off'
              ? `on (${cliPresentation.motion})`
              : 'off in this terminal'
            : 'off'
        }${C.reset}`,
      );
      writeLine(
        `${C.dim}interaction chart: ${
          fieldVisualizationEnabled ? `on -> ${path.relative(ROOT, traceDir)}` : 'off (/viz writes on demand)'
        }${C.reset}`,
      );
      writeLine(`${C.dim}opening scene: ${openingEnabled && !firstMessage ? 'on' : 'off'}${C.reset}`);
      writeLine(`${C.dim}terminal summary at the end: ${closeoutReportEnabled ? 'on' : 'off'}${C.reset}`);
      writeLine(
        `${C.dim}optional tutor thumbs feedback: ${turnFeedbackEnabled ? 'on' : 'off'}${autoLearnerEnabled ? ' (automated learner)' : ''}${C.reset}`,
      );
      writeLine(
        `${C.dim}compact response + timing details: ${responseDetailsEnabled ? 'on' : 'off'} · /details changes this for the session${C.reset}`,
      );
      if (learningSummaryReportConfig.enabled) {
        writeLine(
          `${C.dim}learning summary: automatic HTML on conclusion${
            !summaryBrowserLaunchEnabled ? '; browser launch off' : '; opens in an interactive terminal'
          }${C.reset}`,
        );
      }
      writeLine(
        `${C.dim}natural ending: ${dialogueClosureConfig.enabled ? `on; ${dialogueClosureConfig.allowCheckIn ? 'one optional final check-in' : 'close without a check-in'}` : 'off'}${C.reset}`,
      );
      if (cliEffort) {
        writeLine(`${C.dim}cli effort: ${cliEffort}${C.reset}`);
      }
      if (resumedDialogue) {
        writeLine(
          `${C.dim}resume: loaded ${resumedDialogue.turns} turn(s) from ${path.relative(ROOT, resumedDialogue.source)}${C.reset}`,
        );
        if (resumedDialogue.learnerDag.skipped) {
          writeLine(
            `${C.dim}resume: rebuilt ${resumedDialogue.learnerDag.replayed} reasoning snapshot(s) and reused ${resumedDialogue.learnerDag.skipped}${C.reset}`,
          );
        }
        if (resumedDialogue.typedActions.enabled) {
          writeLine(
            `${C.dim}resume: typed actions restored ${resumedDialogue.typedActions.ledgerRecords} ledger record(s); phase ${
              resumedDialogue.typedActions.phase
            }; pending ${resumedDialogue.typedActions.pendingContractId || 'none'}${C.reset}`,
          );
        }
        for (const warning of resumedDialogue.warnings) {
          writeLine(`${C.red}resume warning${C.reset}${C.dim}: ${warning}${C.reset}`);
        }
        if (state.dialogueClosure?.phase === 'awaiting_checkin') {
          writeLine(
            `${C.cyan}resume closure >${C.reset} the saved dialogue had already stated its verdict; one final learner check-in remains`,
          );
        } else if (state.dialogueClosure?.phase === 'closed') {
          writeLine(`${C.cyan}resume closure >${C.reset} the saved dialogue is already closed`);
        }
      } else if (resumeRequested) {
        writeLine(`${C.dim}resume: no completed dialogue found in ${path.relative(ROOT, traceDir)}${C.reset}`);
      }
      if (temperature !== effectiveTemperature) {
        writeLine(
          `${C.dim}temperature: requested ${temperature}; using ${effectiveTemperature} because ${visibleModel.model} only supports the default${C.reset}`,
        );
      }
      if (worldBundle) {
        writeLine(
          `${C.dim}scenario: ${worldBundle.world.id} — ${worldBundle.world.title}${args.dag ? ' | proof map on' : ' | proof map off'}${C.reset}`,
        );
      }
      writeLine(
        `${C.dim}topic: ${effectiveTopic} | type / for commands | /reset to recover | /quit to exit${C.reset}\n`,
      );
    }
  }

  return { printTutorStubLaunchSummary };
}
