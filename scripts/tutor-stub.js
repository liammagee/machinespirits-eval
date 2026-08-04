#!/usr/bin/env node

/**
 * Tiny editable AI tutor stub.
 *
 * This is deliberately much smaller than the full evaluation/chat stack:
 * - no server
 * - no DB writes
 * - no cell registry
 * - no rubric scoring
 *
 * Edit the STUB defaults or buildSystemPrompt() below, then run:
 *   npm run tutor:stub
 *   npm run tutor:stub -- --model openai.mini
 *   npm run tutor:stub -- --model openrouter.sonnet-5
 *   npm run tutor:stub -- --model claude-code.sonnet
 */

import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { clearLine, cursorTo, emitKeypressEvents, moveCursor } from 'node:readline';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { fileURLToPath } from 'node:url';
import { collectGitActivity, collectGitHubMetrics, collectSourceMetrics, renderReport } from './repository-metrics.js';
import { call as callAI, callStream as streamAI } from '../tutor-core/services/unifiedAIProviderService.js';
import { callAIWithCliBridge, isCliProvider, normalizeCliEffort } from '../services/cliProviderBridge.js';
import { tutorStubCliPolicyRetryDecision } from '../services/tutorStubCliPolicyRetry.js';
import { getProviderConfig, loadProviders, resolveModel } from '../services/evalConfigLoader.js';
import {
  captureTutorStubRunProvenance,
  redactTraceSecrets,
  tutorStubTraceDisplayPath,
} from '../services/traceSchema.js';
import { runLabellingGameCli } from '../services/labellingGameCli.js';
import { buildTutorDesireDag } from '../services/dramaticDerivation/beliefDesire.js';
import { factKey } from '../services/dramaticDerivation/chainer.js';
import { buildLearnerDag, buildLearnerDagSnapshot } from '../services/dramaticDerivation/learnerDag.js';
import {
  buildLearnerProxyDagMemory,
  buildTutorLearnerDagModel,
} from '../services/dramaticDerivation/proxyDagMemory.js';
import {
  getActorialPartDefinitions,
  getEngagementStanceDefinition,
  getEngagementStanceDefinitions,
  getEngagementStanceNames,
  getRegisterOntologyVersion,
  getRequestTypeDefinitions,
  resolveEngagementStance,
} from '../services/engagementRegisterRegistry.js';
import {
  tutorStubWorldFlavourPhrase as worldFlavourPhrase,
  tutorStubWorldLedgerTerm as worldLedgerTerm,
} from '../services/tutorStubWorldPresentation.js';
import {
  projectTutorStubWorldPublicPrompt,
  projectTutorStubWorldSpeakerDagPrompt,
} from '../services/tutorStubWorldPromptContext.js';
import {
  TUTOR_STUB_HUMAN_DISCOURSE_PHASE as HUMAN_DISCOURSE_PHASE,
  buildTutorStubHumanDiscourseRunConfig as buildHumanDiscourseRunConfig,
} from '../services/tutorStubHumanDiscourseConfig.js';
import {
  buildTutorStubRegisterPalette,
  createTutorStubRegisterPromptVocabulary,
} from '../services/tutorStubRegisterPalette.js';
import { projectTutorStubExactRepairSpans as exactTutorRepairSpans } from '../services/tutorStubGuardSpanProjection.js';
import { projectTutorStubGuardAttemptEnvelope } from '../services/tutorStubGuardAttemptProjection.js';
import { projectTutorStubScaffoldState } from '../services/tutorStubScaffoldState.js';
import { projectTutorStubSideArcState as buildSideArcState } from '../services/tutorStubSideArcState.js';
import {
  projectTutorStubPublicStocktakeRows,
  projectTutorStubWarrantPremiseAudit,
} from '../services/tutorStubWarrantPremiseAudit.js';
import { projectTutorStubStrictDagAuditState as buildStrictDagAuditState } from '../services/tutorStubStrictDagAuditState.js';
import {
  createTutorStubCurrentDebugReporter,
  createTutorStubDebugLinePrinters,
  formatTutorStubOpeningDebugId as openingDebugId,
  formatTutorStubSafeTimestamp as safeTimestampForFile,
  formatTutorStubStateTurnDebugId as turnDebugId,
  formatTutorStubTurnDebugId as formatTurnDebugId,
  printTutorStubAutomaticTechnicalDetails,
  resolveTutorStubStateRunDebugId as stateRunDebugId,
  tutorStubAutomaticTechnicalDetailsEnabled as automaticTechnicalDetailsEnabled,
} from '../services/tutorStubDebugIdentity.js';
import {
  listTutorStubCurriculumModules,
  loadTutorStubCurriculum,
  renderTutorStubCurriculumModule,
  selectTutorStubCurriculumModule,
  tutorStubCurriculumBundle,
} from '../services/curriculum/tutorStubCurriculum.js';
import {
  advanceTutorStubCurriculumRuntime,
  createTutorStubCurriculumRuntime,
  recordTutorStubCurriculumEvidence,
  selectTutorStubCurriculumRuntimeModule,
  tutorStubCurriculumPrivatePrompt,
  tutorStubCurriculumPublicProjection,
} from '../services/curriculum/tutorStubCurriculumRuntime.js';
import { projectTutorStubCurriculumProgressLines } from '../services/curriculum/tutorStubCurriculumProgressPresentation.js';
import {
  TUTOR_STUB_CURRICULUM_TRANSLATOR_SYSTEM_PROMPT,
  TUTOR_STUB_TUTOR_OUTPUT_TRANSLATOR_SYSTEM_PROMPT,
  buildTutorStubCurriculumTranslationPrompt,
  buildTutorStubTutorOutputTranslationPrompt,
  normalizeTutorStubCurriculumTranslationLevels,
  normalizeTutorStubTutorOutputTranslationLevels,
  parseTutorStubCurriculumTranslation,
  parseTutorStubTutorOutputTranslation,
  renderTutorStubCurriculumTranslation,
  renderTutorStubTutorOutputTranslation,
} from '../services/tutorStubCurriculumTranslation.js';
import {
  consumeMixedLearnerReadyAnnouncement,
  invalidateMixedLearnerCache,
  mixedLearnerAnalysisCacheKey,
  mixedLearnerGhostText,
  mixedLearnerSuggestionMove,
  mixedLearnerTutorPrefetchDecision,
  parseMixedLearnerArtifacts,
  refreshMixedLearnerPrompt,
  renderMixedLearnerGhostText,
} from '../services/mixedLearnerArtifacts.js';
import { cleanTutorStubClarificationSpeech, cleanTutorStubStageSpeech } from '../services/tutorStubStageSpeech.js';
import {
  auditTutorStubGenerousInferenceResponse,
  deterministicTutorStubGenerousInferenceFallback as deterministicGenerousInferenceFallback,
  resolveTutorStubGenerousInference,
} from '../services/tutorStubGenerousInference.js';
import {
  applyTutorStubConversationalCompletionSelection,
  resolveTutorStubConversationalCompletion,
} from '../services/tutorStubConversationalCompletion.js';
import {
  auditTutorStubQuestionSupportResponse,
  buildTutorStubQuestionSupport,
} from '../services/tutorStubQuestionSupport.js';
import {
  auditTutorStubReleaseDelivery,
  auditTutorStubRepetitionResponse,
  deterministicTutorStubContextualFallback,
  snapshotTutorStubPublicPremiseIds,
} from '../services/tutorStubResponseGuard.js';
import { buildTutorStubObservedAudits } from '../services/tutorStubObservedAudits.js';
import { formatTutorStubFact as factText } from '../services/tutorStubFactModel.js';
import {
  createTutorStubPublicEvidenceModel,
  projectTutorStubLearnerPublicEvidenceState,
  projectTutorStubPublicReleaseLedger,
} from '../services/tutorStubPublicEvidence.js';
import { createTutorStubResponseLeakAudit } from '../services/tutorStubResponseLeakAudit.js';
import { compactTutorStubOneLine as oneLine } from '../services/tutorStubTextProjection.js';
import { effectiveTutorStubModelTemperature as effectiveTemperatureForModel } from '../services/tutorStubModelTemperature.js';
import {
  parseTutorStubAutoTurns as parseAutoTurns,
  parseTutorStubCommaSeparatedStrings as commaSeparatedStrings,
  parseTutorStubNumber as parseNumber,
  parseTutorStubOptionalBoundedInt as parseOptionalBoundedInt,
  parseTutorStubPositiveInt as parsePositiveInt,
} from '../services/tutorStubCliParsing.js';
import {
  createTutorStubPromptBlockModel,
  delimitTutorStubPrompt as delimitedPrompt,
  replaceDelimitedTutorStubPrompt as replaceDelimitedPrompt,
} from '../services/tutorStubPromptBlocks.js';
import {
  TUTOR_STUB_CHARACTER_RESTATEMENT_SCHEMA,
  TUTOR_STUB_CHARACTER_RESTATEMENT_SYSTEM_PROMPT,
  auditTutorStubCharacterRestatement,
  buildTutorStubCharacterRestatementPrompt,
  cleanTutorStubCharacterRestatement,
} from '../services/tutorStubCharacterRestatement.js';
import {
  TUTOR_STUB_DIAGNOSTIC_COLLECTION_MODE,
  TUTOR_STUB_QUARANTINE_CONTINUATION,
  auditTutorStubQuarantineContinuation,
  classifyTutorStubDiagnosticFailure,
  normalizeTutorStubLoopMode,
  restoreTutorStubDiagnosticTransaction,
  snapshotTutorStubDiagnosticTransaction,
} from '../services/tutorStubDiagnosticCollection.js';
import {
  auditTutorStubDramaticReleaseResponse,
  buildTutorStubDramaticReleaseFrame,
  deterministicTutorStubDramaticReleaseFallback,
  prepareTutorStubDueClueUptake,
} from '../services/tutorStubDramaticRelease.js';
import { buildTutorStubWorldScaffold } from '../services/tutorStubWorldScaffold.js';
import { buildTutorStubResumeHandoff } from '../services/tutorStubResumeHandoff.js';
import { buildTutorStubProofDebtState } from '../services/tutorStubProofDebt.js';
import {
  TUTOR_STUB_PUBLIC_LEARNER_ANALYSIS_PARSE_MODES,
  TUTOR_STUB_EVIDENCE_USE_RUBRIC_DEFAULT,
  TUTOR_STUB_PUBLIC_LEARNER_ANALYSIS_PROMPT_PROFILES,
  TUTOR_STUB_LEARNER_DAG_PREFLIGHT_SCHEMA,
  applyTutorStubPublicLearnerRecordUpdate as applyLearnerRecordUpdate,
  buildTutorStubLearnerDagPreflight,
  buildTutorStubPublicLearnerAnalysisPrompt,
  extractTutorStubPublicLearnerAnalysis,
  normalizeTutorStubEvidenceUseRubric,
  normalizeTutorStubPublicLearnerAnalysisPromptProfile,
  normalizeTutorStubHumanDiscourseExtraction as normalizeHumanDiscourseExtraction,
  normalizeTutorStubHumanDiscourseRows as normalizeDiscourseRows,
  parseTutorStubPublicLearnerAnalysisInteractive as parseClassifierJson,
  tutorStubHumanDiscoursePromptSchema as humanDiscourseExtractionSchema,
  tutorStubPublicFactSurface as factSurface,
  tutorStubPublicStagedEvidence as stagedEvidenceRows,
} from '../services/tutorStubPublicLearnerAnalysis.js';
import {
  advanceTutorStubDialogueClosure,
  auditTutorStubDialogueClosureResponse,
  buildTutorStubDialogueClosureFrame,
  createTutorStubDialogueClosureLifecycle,
  deterministicTutorStubClosureResponse,
  tutorStubClosureAcknowledgement,
  tutorStubLearnerDagGrounded,
} from '../services/tutorStubDialogueClosure.js';
import {
  DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
  MAX_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
  MIN_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
  normalizeTutorStubEngagementStanceTemperature,
} from '../services/tutorStubRegisterTemperature.js';
import {
  DEFAULT_TUTOR_STUB_LIGHT_ADAPTATION_THRESHOLD,
  TUTOR_STUB_LIGHT_ADAPTATION_SCHEMA,
  buildTutorStubLightAdaptationDecision,
  normalizeTutorStubLightAdaptationThreshold,
} from '../services/tutorStubLightAdaptation.js';
import {
  DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_RATE,
  DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_SEED,
  TUTOR_STUB_DAG_FACT_DROPOUT_SCHEMA,
  applyTutorStubDagFactDropout,
  createTutorStubDagFactDropoutState,
  normalizeTutorStubDagFactDropoutRate,
  normalizeTutorStubDagFactDropoutSeed,
  projectTutorStubDagMemoryReliability,
  tutorStubDagFactDropoutSnapshot,
} from '../services/tutorStubDagFactDropout.js';
import {
  applyTutorStubComprehensionRequest,
  applyTutorStubComprehensionResponse,
  createTutorStubComprehensionState,
  detectTutorStubComprehensionRequest,
  restoreTutorStubComprehensionState as restoreComprehensionState,
  tutorStubComprehensionFeatures,
  tutorStubComprehensionPrompt,
  tutorStubComprehensionSnapshot,
} from '../services/tutorStubComprehensionState.js';
import {
  buildContinuousRegisterPolicyMetadata,
  buildContinuousEngagementStanceVector,
  continuousEngagementStanceInstruction,
} from '../services/tutorStubContinuousRegister.js';
import {
  auditTutorStubResponseConfiguration,
  buildTutorStubResponseConfiguration,
  normalizeTutorStubActorialPartId,
  selectTutorStubActorialPart,
  selectTutorStubActorialPerformance,
  summarizeTutorStubResponseConfigurationAudits,
  tutorStubConfigurableActorialPartIds,
  tutorStubRandomizableActorialPartIds,
} from '../services/tutorStubResponseConfiguration.js';
import { dramaticAudiencePromptLines } from '../services/tutorStubRegisterPragmatics.js';
import {
  freezeTutorStubLearnerRecordUpdateForDiscoursePlane,
  resolveTutorStubDiscoursePlane,
} from '../services/tutorStubDiscoursePlane.js';
import {
  auditTutorStubResponseComposition,
  buildTutorStubResponseCompositionFrame,
  composeTutorStubFallbackWithUptake,
  deterministicTutorStubConfiguredContinuationFallback,
  deterministicTutorStubLearnerUptake,
  deterministicTutorStubWritableEntryUptake,
  formatTutorStubResponseComposition,
  tutorStubLearnerSelectedToolMarkPath,
  tutorStubSubstantiveLearnerEcho,
} from '../services/tutorStubResponseComposition.js';
import {
  buildTutorStubFirstDraftContract,
  tutorStubFirstDraftContractPrompt,
} from '../services/tutorStubFirstDraftContract.js';
import {
  auditTutorStubLiveTurnProgressionV1,
  deterministicTutorStubTurnProgressionHandoff,
  deterministicTutorStubTurnProgressionUptake,
} from '../services/tutorStubTurnProgressionContract.js';
import {
  auditTutorStubLiveSourceActionAlignmentV1,
  tutorStubLiveResponseConfigurationSurface,
} from '../services/tutorStubLiveFirstDraftAudit.js';
import { compileTutorStubPerformanceObligationContract } from '../services/tutorStubPerformanceObligationContract.js';
import { projectTutorStubSpeakerPublicPremise } from '../services/tutorStubSpeakerPublicPremise.js';
import { resolveTutorStubPublicCounterpressure } from '../services/tutorStubCounterpressure.js';
import {
  tutorStubGuardIssueRows,
  tutorStubTerminalFallbackFailureMessage,
} from '../services/tutorStubGuardDisposition.js';
import {
  auditTutorStubSelfCorrectionDisclosure,
  detectTutorStubSelfCorrectionDisclosure,
  tutorStubDisclosableGuardCorrection,
  tutorStubSelfCorrectionDisclosurePrompt,
} from '../services/tutorStubSelfCorrectionDisclosure.js';
import {
  buildTutorStubSimplifiedRecoveryConfiguration,
  composeTutorStubGuardUptakeDevelopment,
  repairTutorStubMissingClarificationInvitation,
  repairTutorStubMissingActorialPart,
  repairTutorStubUnanswerableOpenRecall,
  repairTutorStubThirdPersonSourceLeadIn,
  tutorStubActorialPerformanceMayBeAdvisory,
  tutorStubGuardDeliveryDecision,
  tutorStubLearnerRequestedPlainStyle,
  tutorStubPlainRecoveryAllowsActorialAdvisory,
  tutorStubSimplifiedRecoveryPrompt,
} from '../services/tutorStubGuardRecovery.js';
import {
  auditTutorStubPrompt,
  auditTutorStubSpeakerPrivilege,
  recoverTutorStubDuplicateInstructionLines,
  recoverTutorStubSpeakerPrompt,
  sanitizeTutorStubSpeakerAdvisory,
  tutorStubPromptArchitecture,
  tutorStubPromptSurfaceForRole,
} from '../services/tutorStubPromptAudit.js';
import {
  learnerProfileContract,
  learnerProfileDescription,
  learnerProfileIds,
  learnerProfileListText,
  learnerProfilePickerPresentation,
  learnerProfilePrompt,
  learnerProfileSpeakerLabel,
  learnerProfileSuiteIds,
} from './tutor-stub-learner-profile-contracts.js';
import {
  TUTOR_STUB_LEARNER_RESPONSE_PROVENANCE_SCHEMA,
  aggregateTutorStubLearnerResponseProvenance,
  createTutorStubLearnerResponseProvenance,
  summarizeTutorStubLearnerResponseProvenance,
} from '../services/tutorStubLearnerResponseProvenance.js';
import { buildTutorStubTurnFailureTraceEvents } from '../services/tutorStubTurnFailureBackfill.js';
import {
  TUTOR_STUB_TRANSCRIPT_HTML_SCHEMA,
  launchTutorStubTranscriptHtml,
  writeTutorStubTranscriptHtml,
} from '../services/tutorStubTranscriptHtml.js';
import { writeTutorStubLearningSummaryHtml } from '../services/tutorStubLearningSummaryHtml.js';
import {
  createTutorStubConsoleTokenSink,
  renderTutorStubStreamLabel,
  replayTutorStubTextAsConsoleStream,
  tutorStubProviderSupportsEventStreaming as providerSupportsEventStreaming,
  tutorStubProviderSupportsTokenStreaming as providerSupportsStreaming,
} from '../services/tutorStubDevelopmentSpeakerTransport.js';
import {
  TUTOR_STUB_LEARNING_SUMMARY_HTML_SCHEMA,
  buildTutorStubLearningSummary as buildDialogueLearningSummary,
  tutorStubDialogueCaseStatus as dialogueCaseStatus,
} from '../services/tutorStubLearningSummary.js';
import {
  buildTutorStubExplanatoryDebugFrame as explanatoryDebugFrame,
  buildTutorStubExplanatoryDebugPrompt as explanatoryDebugPrompt,
  cleanTutorStubExplanatoryDebugProse as cleanExplanatoryDebugProse,
  fallbackTutorStubExplanatoryDebugProse as fallbackExplanatoryDebugProse,
  tutorStubRegisterPolicyCalculation as registerPolicyCalculation,
} from '../services/tutorStubExplanatoryDebug.js';
import {
  tutorStubDisplayDiagnosticLabel as displayDiagnosticLabel,
  tutorStubPlainList as plainList,
  tutorStubPlainPolicyLabel as plainPolicyLabel,
  tutorStubPlainSettingName as plainSettingName,
  tutorStubPlainStrategyText as plainStrategyText,
  tutorStubResponseMetadataLine as metadataLine,
} from '../services/tutorStubResponseDetails.js';
import { projectTutorStubTurnAnalysisLines } from '../services/tutorStubTurnAnalysisPresentation.js';
import { projectTutorStubTechnicalAnalysisLines } from '../services/tutorStubTechnicalAnalysisPresentation.js';
import { projectTutorStubTechnicalDebugLines } from '../services/tutorStubTechnicalDebugPresentation.js';
import {
  compactTutorStubCloseoutCounts as compactCounts,
  countTutorStubCloseoutRows as countBy,
  summarizeTutorStubGuardAccounting as summarizeTutorGuardAccounting,
} from '../services/tutorStubCloseoutProjection.js';
import { projectTutorStubCloseoutReportLines } from '../services/tutorStubCloseoutReportPresentation.js';
import {
  createTutorStubInterimController,
  createTutorStubInterimState as createInterimState,
  formatTutorStubSignedInterimNumber as formatSignedInterimNumber,
  resolveTutorStubInterimState as getInterimState,
} from '../services/tutorStubInterimController.js';
import { createTutorStubLearnerEvidenceRuntime } from '../services/tutorStubLearnerEvidenceRuntime.js';
import { createTutorStubLearnerAnalysisRuntime } from '../services/tutorStubLearnerAnalysisRuntime.js';
import {
  listTutorStubTutorInstances,
  resolveTutorStubTutorInstance,
  tutorStubTutorInstancePrompt,
} from '../services/tutorStubTutorInstance.js';
import {
  TUTOR_STUB_FEEDBACK_REASONS,
  approveTutorStubTuningCandidate,
  createTutorStubTuningRuntime,
  listTutorStubTuningCandidates,
  normalizeTutorStubTuningMode,
  promoteTutorStubTuningCandidate,
  readTutorStubTuningCandidate,
  recordTutorStubTuningFeedback,
  recordTutorStubTuningNote,
  rejectTutorStubTuningCandidate,
  rollbackTutorStubTutorVersion,
  setTutorStubTuningMode,
  synthesizeTutorStubTuningCandidate,
  tutorStubTuningPrompt,
  tutorStubTuningReplayPath,
  tutorStubTuningSnapshot,
  tutorStubTuningTurnAdvisory,
  validateTutorStubTuningCandidate,
} from '../services/tutorStubTuning.js';
import { createTutorStubConcurrentTerminal } from '../services/tutorStubConcurrentTerminal.js';
import { createTutorStubLineSelection } from '../services/tutorStubLineSelection.js';
import {
  DEFAULT_TUTOR_STUB_VOICE_MODEL,
  DEFAULT_TUTOR_STUB_VOICE_NAME,
  TUTOR_STUB_VOICE_MODELS,
  createTutorStubVoiceBridge,
  normalizeTutorStubVoiceModel,
  normalizeTutorStubVoiceName,
} from '../services/tutorStubVoiceBridge.js';
import { copyTutorStubTextToClipboard, formatTutorStubDebugClipboardText } from '../services/tutorStubClipboard.js';
import { loadTutorStubReleaseNotes, normalizeTutorStubReleaseNotesHours } from '../services/tutorStubReleaseNotes.js';
import {
  clearTutorStubTurnFeedbackRating,
  clearTutorStubTurnFeedbackTarget,
  commitTutorStubTurnFeedback,
  createTutorStubTurnFeedbackState,
  requestTutorStubTurnFeedback,
  setTutorStubTurnFeedbackEnabled,
  setTutorStubTurnFeedbackRating,
  tutorStubTurnFeedbackArrowRating,
  tutorStubTurnFeedbackEscapeDismissal,
  tutorStubTurnFeedbackEnvelope,
  tutorStubTurnFeedbackLabel,
  tutorStubTurnFeedbackPrompt,
  tutorStubTurnFeedbackRegisterPrompt,
} from '../services/tutorStubTurnFeedback.js';
import { buildTutorStubTurnTiming, formatTutorStubTurnTiming } from '../services/tutorStubTurnTiming.js';
import {
  auditTutorStubFeedbackAdaptation,
  buildTutorStubFeedbackAdaptationPlan,
  buildTutorStubFeedbackObservation,
  buildTutorStubFeedbackRatingRecord,
  findTutorStubFeedbackTargetTurn,
} from '../services/tutorStubFeedbackLearning.js';
import {
  TUTOR_STUB_OPENING_REQUIREMENTS,
  auditTutorStubOpening,
  buildTutorStubOpeningFrame,
  deterministicTutorStubOpening,
  tutorStubOpeningPrompt,
  tutorStubOpeningSystemPrompt,
} from '../services/tutorStubOpening.js';
import {
  buildTutorStubTutorMessageContext,
  compactTutorStubPublicMessagesForBudget,
  projectTutorStubCompactPublicTranscript,
  tutorStubPublicMessagesForSpeaker,
} from '../services/tutorStubPublicHistory.js';
import { buildTutorStubLearnerAdvance } from '../services/tutorStubLearnerAdvance.js';
import {
  clearTutorStubLastSettings,
  readTutorStubLastSettings,
  tutorStubRememberedPolicyStack,
  writeTutorStubLastSettings,
} from '../services/tutorStubLastSettings.js';
import {
  normalizeTutorStubHumanSubjectClass,
  normalizeTutorStubTrainingReuseSetting,
  resolveTutorStubTrainingReuse,
  tutorStubTrainingReuseLabel,
} from '../services/tutorStubTrainingReuse.js';
import { projectTutorStubTrainingReuseStatusLines } from '../services/tutorStubTrainingReusePresentation.js';
import { projectTutorStubDialogueSettingsLines } from '../services/tutorStubDialogueSettingsPresentation.js';
import {
  createTutorStubModelSelection,
  projectTutorStubModelChoiceLines,
} from '../services/tutorStubModelChoicePresentation.js';
import {
  buildTutorStubDirectorInitialContext,
  createTutorStubDirectorNotesModel,
  projectTutorStubDirectorContextLines,
  projectTutorStubDirectorNotesLines,
} from '../services/tutorStubDirectorPresentation.js';
import {
  projectTutorStubClassifierWorldContext as classifierWorldContext,
  projectTutorStubLearnerClassificationLines,
} from '../services/tutorStubLearnerClassificationPresentation.js';
import {
  applyTutorStubLearnerAdvanceAssessment,
  buildTutorStubFailedClassification as failedClassification,
} from '../services/tutorStubLearnerClassification.js';
import {
  projectTutorStubLearnerDagLines,
  projectTutorStubLearnerDagPromptSummary as learnerDagPromptSummary,
} from '../services/tutorStubLearnerDagPresentation.js';
import { projectTutorStubResponseConfigurationLines } from '../services/tutorStubResponseConfigurationPresentation.js';
import { projectTutorStubResponsePolicyContext } from '../services/tutorStubResponsePolicyContext.js';
import { restoreTutorStubRegisterStateFromTurns as restoreRegisterStateFromTurns } from '../services/tutorStubRegisterStateRestoration.js';
import { replayTutorStubLearnerDagFromTurns } from '../services/tutorStubLearnerDagRestoration.js';
import { assertTutorStubTurnAttemptCurrent } from '../services/tutorStubTurnAttempt.js';
import { restoreTutorStubTypedActionState as restoreTypedActionState } from '../services/tutorStubTypedActionRestoration.js';
import {
  projectTutorStubDialogueClosureContext,
  projectTutorStubHumanDiscourseContext,
  projectTutorStubLearnerClassifierContext,
  projectTutorStubLearnerDagModelContext,
} from '../services/tutorStubTutorPromptContext.js';
import {
  tutorStubCanonicalCommandToken,
  tutorStubCommandAvailable,
  tutorStubCommandHelpRows,
  tutorStubCommandReturnsToScene,
  tutorStubCommandSummary,
  tutorStubCommandTokens,
  tutorStubStaticCommandCompletions,
} from '../services/tutorStubCommandRegistry.js';
import {
  clearTutorStubDirectorGuidance,
  createTutorStubDirectorGuidanceState,
  mergeConcurrentTutorStubDirectorGuidance,
  restoreTutorStubDirectorGuidanceState as restoreDirectorGuidanceState,
  setTutorStubDirectorGuidance,
  tutorStubDirectorGuidanceEntry,
  tutorStubDirectorGuidancePrompt,
  tutorStubDirectorGuidanceSnapshot,
} from '../services/tutorStubDirectorGuidance.js';
import {
  TUTOR_STUB_CLI_DIRECTOR_SYSTEM_PROMPT,
  buildTutorStubCliDirectorPrompt,
  cleanTutorStubCliDirectorReply,
  normalizeTutorStubCliDirectorQuestion,
} from '../services/tutorStubCliDirector.js';
import {
  assertTutorStubCapabilityCompatibility,
  resolveTutorStubCapabilities,
  tutorStubCapabilityFeatureRows,
} from '../services/tutorStubCapabilities.js';
import {
  MAX_TUTOR_STUB_MODEL_CALL_BUDGET,
  assertTutorStubLabRequirements,
  createTutorStubModelCallBudget,
  formatTutorStubLabList,
  getTutorStubLab,
  listTutorStubLabs,
  resolveTutorStubLab,
  resolveTutorStubMeteredLabAdmission,
  tutorStubLabTraceMetadata,
} from '../services/tutorStubLabs.js';
import {
  applyTutorStubRecipeOptions,
  assertTutorStubResumeCompatibility,
  buildTutorStubSessionRecipe,
  compareTutorStubResumeRecipe,
  createTutorStubRecipeModelIdentityResolver,
  latestTutorStubResumeSource,
  readTutorStubSessionRecipe,
  resolveTutorStubResumeSource,
  tutorStubExactRelaunchCommand,
  writeTutorStubSessionRecipe,
} from '../services/tutorStubSessionRecipe.js';
import {
  TUTOR_STUB_SESSION_RUNTIME_SCHEMA,
  TUTOR_STUB_SESSION_RUNTIME_VERSION,
  createTutorStubCommandHandlers,
  createTutorStubSessionRuntime,
} from '../services/tutorStubSessionRuntime.js';
import { runTutorStubSessionRpc } from '../services/tutorStubSessionRpc.js';
import {
  TUTOR_STUB_CLI_MOTION_IDS,
  TUTOR_STUB_CLI_THEME_IDS,
  createTutorStubCliPresentation,
  normalizeTutorStubCliMotion,
  normalizeTutorStubCliThemeId,
  tutorStubCliMasthead,
  tutorStubCliPresentationSnapshot,
  tutorStubCliThemeOptions,
  tutorStubCliThemePreview,
} from '../services/tutorStubCliTheme.js';
import { renderTutorStubCliHelp } from '../services/tutorStubCliHelp.js';
import { projectTutorStubFeatureMapLines } from '../services/tutorStubFeatureMap.js';
import { projectTutorStubInteractiveHelpLines } from '../services/tutorStubInteractiveHelp.js';
import { projectTutorStubReleaseNotesLines } from '../services/tutorStubReleaseNotesPresentation.js';
import {
  projectTutorStubDagSnapshot,
  projectTutorStubDagSnapshotLines,
} from '../services/tutorStubDagSnapshotPresentation.js';
import {
  projectTutorStubProofDagArtifactPaths,
  projectTutorStubProofDagSemanticLayerLines,
} from '../services/tutorStubProofCommandPresentation.js';
import {
  projectTutorStubInteractionModeBannerLines,
  projectTutorStubInteractionModeLabel,
} from '../services/tutorStubInteractionModePresentation.js';
import { normalizeTutorStubLaunchMode } from '../services/tutorStubLaunchMode.js';
import { projectTutorStubSessionStatusLines } from '../services/tutorStubSessionStatusPresentation.js';
import {
  DEFAULT_TUTOR_STUB_RELEASE_SPEED,
  MAX_TUTOR_STUB_RELEASE_SPEED,
  MIN_TUTOR_STUB_RELEASE_SPEED,
  acknowledgeTutorStubOpeningRelease,
  advanceTutorStubReleasePacing,
  commitTutorStubReleasePacing,
  createTutorStubReleasePacingState,
  normalizeTutorStubReleaseSpeed,
  projectTutorStubCommittedReleaseRows,
  projectTutorStubCurrentReleaseRows,
  projectTutorStubNextReleaseRow,
  restoreTutorStubReleasePacingFromTurns,
  setTutorStubReleaseSpeed,
  tutorStubReleasePacingSnapshot,
  tutorStubReleaseScheduleExhausted,
} from '../services/tutorStubReleasePacing.js';
import {
  advanceTutorStubMannerSwitch,
  advanceTutorStubQuietCheck,
  compileTutorStubTriggerArtifact,
  createTutorStubMannerSwitchState,
  createTutorStubQuietCheckState,
  tutorStubMannerCard,
  tutorStubQuietCheckCard,
  TUTOR_STUB_MANNER_SWITCH_SCHEMA,
  TUTOR_STUB_MOVE_CARDS_EXEMPLAR_VERSION,
  TUTOR_STUB_MOVE_CARDS_LICENCE_VERSION,
  TUTOR_STUB_MOVE_CARDS_VERSION,
  TUTOR_STUB_QUIET_CHECK_SCHEMA,
} from '../services/tutorStubMannerSwitch.js';
import {
  createTutorStubQuietDetectorState,
  detectTutorStubQuietState,
  tutorStubQuietStateCard,
} from '../services/tutorStubQuietDetector.js';
import { renderTutorStubDueSource } from '../services/tutorStubDueSourceRenderer.js';
import { composeTutorStubClueSpanReplacement } from '../services/tutorStubDramaticRelease.js';
import {
  loadTutorStubStressSchedule,
  tutorStubStressDirective,
  tutorStubStressPlantForTurn,
  TUTOR_STUB_STRESS_SCHEDULE_SCHEMA,
} from '../services/tutorStubStressSchedule.js';
import {
  buildDynamicalSystemRegisterScores,
  buildDynamicalSystemState,
  buildFieldRegisterScores,
  buildStateRegisterScores,
  buildTrajectoryRegisterScores,
  dagProgressFeatures,
  DYNAMICAL_SYSTEM_REGISTER_AFFINITY,
  DYNAMICAL_SYSTEM_TEMPERATURE,
  hasExplicitStepwiseSignal,
  latestRegisterEfficacy,
  latestRegisterSelection,
  normalizeEngagementStanceDistribution,
  normalizeStoredRegisterEfficacy,
  normalizeStoredRegisterSelection,
  numberOr,
  preferredLegacyRegister,
  recentRegisterCount,
  registerAffinityContributions,
  registerEfficacyFromDagProgress,
  roundField,
  scoreValue,
  topNumericEntries,
} from '../services/tutorStubRegisterPolicy.js';
import { normalizeTutorStubDagMode } from '../services/tutorStubDagFeatures.js';
import { createTutorStubRegisterEmpiricalPriorModel } from '../services/tutorStubRegisterEmpiricalPrior.js';
import { projectTutorStubRegisterHistoryPrompt } from '../services/tutorStubRegisterHistoryProjection.js';
import {
  buildTutorStubLightweightDialogueField as buildLightweightDialogueField,
  projectTutorStubLightweightFieldTurn as lightweightFieldTurn,
} from '../services/tutorStubFieldTurnProjection.js';
import {
  projectTutorStubFieldVisualizationLines,
  projectTutorStubLightweightFieldLines,
  renderTutorStubLightweightFieldSvg as renderLightweightFieldSvg,
} from '../services/tutorStubFieldPresentation.js';
import {
  applyTutorStubPointOfActionConstraint,
  auditTutorStubPointOfActionCompliance,
  buildTutorStubPointOfActionTurn,
  normalizeTutorStubPointOfActionArm,
  reconcileTutorStubPointOfActionHandoffEligibility,
  tutorStubPointOfActionPrompt,
  tutorStubPointOfActionStandingBook,
  tutorStubPointOfActionTargetText,
} from '../services/tutorStubPointOfActionCoaching.js';
import {
  PROGRAM2_COMMITTEE_DEFAULTS,
  PROGRAM2_COMMITTEE_SCHEMA,
  buildCommitteeCompositionBlock,
  committeeFallbackBatteryPass,
  committeeMiniGenerate,
  runCommitteeBattery,
  selectCommitteeCompositionQuestion,
  trimCommitteeFallback,
} from '../services/program2CommitteeEngine.js';
import { createProgram2ProviderBudgetFromEnvironment } from '../services/program2ExperimentSafety.js';
import {
  DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD,
  TUTOR_STUB_REGISTER_OVERLAY_POLICIES,
  TUTOR_STUB_REGISTER_POLICY_COMPOSITION_SCHEMA,
  evaluateTutorStubRegisterPolicyOverlay,
  normalizeTutorStubRegisterOverlayThreshold,
  parseTutorStubRegisterPolicyStack,
  tutorStubRegisterPolicyStackId,
} from '../services/tutorStubRegisterPolicyComposition.js';
import { sampleTutorStubPolicyDistribution } from '../services/tutorStubPolicySampler.js';
import { captureGitProvenanceSummary, hashCanonicalJson } from '../services/experimentRunArtifacts.js';
import { buildTutorStubStateObservation } from '../services/adaptiveTutor/tutorStubStateAdapter.js';
import {
  ADAPTATION_ACTIONS,
  estimateLearnerStateBelief,
  selectPedagogicalAction,
} from '../services/adaptiveTutor/actionPolicy.js';
import { createAdaptationContract } from '../services/adaptiveTutor/adaptationContract.js';
import { appendPendingIntervention, closePendingIntervention } from '../services/adaptiveTutor/interventionLedger.js';
import {
  buildTutorStubTypedActionDecision,
  tutorStubMoveFamilyForAction,
} from '../services/adaptiveTutor/tutorStubActionAdapter.js';
import {
  advanceScaffoldLifecycle,
  allowedMoveFamiliesForScaffoldPhase,
  createScaffoldLifecycle,
  SCAFFOLD_LIFECYCLE_SCHEMA,
} from '../services/adaptiveTutor/scaffoldLifecycle.js';
import {
  createTutorStubTutorTurnPipeline,
  TUTOR_STUB_SPEAKER_GATED_BLOCK_IDS,
} from '../services/tutorStubTutorTurnPipeline.js';
import { createTutorStubCommandRuntime } from '../services/tutorStubCommandRuntime.js';
import { createTutorStubTraceRuntime } from '../services/tutorStubTraceRuntime.js';
import {
  createTutorStubLearningSummaryRuntime,
  createTutorStubSessionOrchestration,
} from '../services/tutorStubSessionOrchestration.js';
import { createTutorStubSessionStateRuntime } from '../services/tutorStubSessionStateRuntime.js';
import { createTutorStubResponsePolicy } from '../services/tutorStubResponsePolicy.js';
import { createTutorStubTurnOrchestration } from '../services/tutorStubTurnOrchestration.js';
import { createTutorStubVoiceController } from '../services/tutorStubVoiceController.js';
import { createTutorStubModelPickerController } from '../services/tutorStubModelPickerController.js';
import { parseTutorStubCliArguments } from '../services/tutorStubCliArguments.js';
import { createTutorStubLaunchRuntime } from '../services/tutorStubLaunchRuntime.js';
import { createTutorStubScenarioController } from '../services/tutorStubScenarioController.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORLD_DIR = path.join(ROOT, 'config/drama-derivation');
const UNSUPPORTED_CODEX_MINI_REFS = new Set(['codex.mini', 'codex.gpt-mini', 'codex.gpt-5-mini']);
const NEGATIVE_FLOOR_REGISTERS = ['ironic', 'sarcastic', 'face_threat'];
const DAG_MODES = ['strict_dag', 'human_scaffold', 'defeasible_human_scaffold'];
const HUMAN_DISCOURSE_FRAME_SCHEMA = 'machinespirits.tutor-stub.human-discourse-frame.v1';
const TUTOR_GUARD_ACCOUNTING_SCHEMA = 'machinespirits.tutor-stub.guard-accounting.v1';
const TUTOR_TYPED_ACTION_CONFIG_SCHEMA = 'machinespirits.tutor-stub.typed-action-runtime-config.v1';
const TUTOR_TYPED_ACTION_OUTCOME_SCHEMA = 'machinespirits.tutor-stub.typed-action-outcome.v1';
const DEFAULT_TUTOR_MODEL_REF = 'codex.gpt-5.6-terra';
const DEFAULT_INTERPRETATION_MODEL_REF = 'codex.gpt-5.6-sol';
const DEFAULT_AUTO_LEARNER_MODEL_REF = 'codex.gpt-5.6-terra';
const DEFAULT_INTERACTIVE_COMMITTEE_FALLBACK_POLICY = 'v2';

const STUB = {
  tutor: process.env.TUTOR_STUB_TUTOR || 'dramatic-detective',
  tuning: process.env.TUTOR_STUB_TUNING || 'off',
  allModels: process.env.TUTOR_STUB_ALL_MODELS || '',
  model: process.env.TUTOR_STUB_MODEL || DEFAULT_TUTOR_MODEL_REF,
  classifierModel: process.env.TUTOR_STUB_CLASSIFIER_MODEL || DEFAULT_INTERPRETATION_MODEL_REF,
  learnerRecordModel:
    process.env.TUTOR_STUB_LEARNER_RECORD_MODEL ||
    process.env.TUTOR_STUB_CLASSIFIER_MODEL ||
    DEFAULT_INTERPRETATION_MODEL_REF,
  learnerAnalysisPromptProfile:
    process.env.TUTOR_STUB_LEARNER_ANALYSIS_PROMPT_PROFILE ||
    TUTOR_STUB_PUBLIC_LEARNER_ANALYSIS_PROMPT_PROFILES.BASELINE,
  learnerAnalysisEvidenceUseRubric:
    process.env.TUTOR_STUB_LEARNER_ANALYSIS_EVIDENCE_USE_RUBRIC || TUTOR_STUB_EVIDENCE_USE_RUBRIC_DEFAULT,
  mixedTutorPrefetchPolicy: process.env.TUTOR_STUB_MIXED_TUTOR_PREFETCH_POLICY || 'always',
  topic: process.env.TUTOR_STUB_TOPIC || 'fractions',
  world: process.env.TUTOR_STUB_WORLD || 'world_005_marrick',
  learner: 'A curious learner who may be partly right, partly confused, and unsure how to explain their thinking.',
  goal: 'Help the learner make one small conceptual move. Prefer concrete examples and, when the compiled turn contract permits, one focused question over explanation dumps.',
  style: 'Calm, concise, Socratic, and specific. Do not perform the whole solution unless the learner is truly stuck.',
  temperature: 0.35,
  maxTokens: 2000,
  historyTurns: Number.parseInt(process.env.TUTOR_STUB_HISTORY_TURNS || '4', 10),
  memorySummary: process.env.TUTOR_STUB_MEMORY_SUMMARY !== '0',
  traceDir: process.env.TUTOR_STUB_TRACE_DIR || '.tutor-stub-traces',
  settingsFile: process.env.TUTOR_STUB_SETTINGS_FILE || '.tutor-stub-traces/last-settings.json',
  cliTheme: process.env.TUTOR_STUB_CLI_THEME || 'nocturne',
  motion: process.env.TUTOR_STUB_MOTION || 'auto',
  stream: process.env.TUTOR_STUB_STREAM !== '0',
  interimAnimation: process.env.TUTOR_STUB_INTERIM_ANIMATION !== '0',
  cliEffort: process.env.TUTOR_STUB_CLI_EFFORT || 'medium',
  registerPolicy: process.env.TUTOR_STUB_REGISTER_POLICY || 'dynamic',
  pointOfActionArm: process.env.TUTOR_STUB_POINT_OF_ACTION_ARM || '',
  registerOverlayThreshold:
    process.env.TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD || String(DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD),
  registerTemperature:
    process.env.TUTOR_STUB_REGISTER_TEMPERATURE || String(DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE),
  lightAdaptation: process.env.TUTOR_STUB_LIGHT_ADAPTATION === '1',
  lightAdaptationThreshold:
    process.env.TUTOR_STUB_LIGHT_ADAPTATION_THRESHOLD || String(DEFAULT_TUTOR_STUB_LIGHT_ADAPTATION_THRESHOLD),
  trainingReuse: process.env.TUTOR_STUB_TRAINING_REUSE || 'on',
  humanSubjectClass: process.env.TUTOR_STUB_HUMAN_SUBJECT_CLASS || 'owner_operator',
  dagFactDropout: process.env.TUTOR_STUB_DAG_FACT_DROPOUT || String(DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_RATE),
  dagFactDropoutSeed: process.env.TUTOR_STUB_DAG_FACT_DROPOUT_SEED || String(DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_SEED),
  releaseSpeed: process.env.TUTOR_STUB_RELEASE_SPEED || String(DEFAULT_TUTOR_STUB_RELEASE_SPEED),
  runSeed: process.env.TUTOR_STUB_RUN_SEED || '1',
  typedActions: process.env.TUTOR_STUB_TYPED_ACTIONS === '1',
  typedActionTaskId: process.env.TUTOR_STUB_TYPED_ACTION_TASK_ID || 'tutor-stub-public-reasoning',
  typedActionKnowledgeComponent:
    process.env.TUTOR_STUB_TYPED_ACTION_KNOWLEDGE_COMPONENT || 'public-evidence-to-warrant-linkage',
  typedActionPrerequisites:
    process.env.TUTOR_STUB_TYPED_ACTION_PREREQUISITES || 'identify public evidence,state a warranted link',
  typedActionItemDifficulty: process.env.TUTOR_STUB_TYPED_ACTION_ITEM_DIFFICULTY || '0.5',
  typedActionSupportLevel: process.env.TUTOR_STUB_TYPED_ACTION_SUPPORT_LEVEL || '',
  dagMode: process.env.TUTOR_STUB_DAG_MODE || 'strict_dag',
  multipleChoice: process.env.TUTOR_STUB_MULTIPLE_CHOICE === '1',
  opening: process.env.TUTOR_STUB_OPENING !== '0',
  openingRealizer: process.env.TUTOR_STUB_OPENING_REALIZER || 'model',
  closeoutReport: process.env.TUTOR_STUB_CLOSEOUT_REPORT !== '0',
  fieldViz: process.env.TUTOR_STUB_FIELD_VIZ === '1',
  autoLearnerModel: process.env.TUTOR_STUB_AUTO_LEARNER_MODEL || DEFAULT_AUTO_LEARNER_MODEL_REF,
  autoTurns: process.env.TUTOR_STUB_AUTO_TURNS || 'until-grounded',
  autoSafetyTurns: Number.parseInt(process.env.TUTOR_STUB_AUTO_SAFETY_TURNS || '80', 10),
  autoLearnerProfile: process.env.TUTOR_STUB_AUTO_LEARNER_PROFILE || 'diligent',
  mixedLearner: process.env.TUTOR_STUB_MIXED_LEARNER === '1',
  turnFeedback: process.env.TUTOR_STUB_TURN_FEEDBACK !== '0',
  responseDetails: process.env.TUTOR_STUB_RESPONSE_DETAILS !== '0',
  voiceModel: process.env.TUTOR_STUB_VOICE_MODEL || DEFAULT_TUTOR_STUB_VOICE_MODEL,
  voiceName: process.env.TUTOR_STUB_VOICE_NAME || DEFAULT_TUTOR_STUB_VOICE_NAME,
  speakerAdvisoryBlocks: process.env.TUTOR_STUB_SPEAKER_ADVISORY_BLOCKS || '',
};

/**
 * Which private advisory blocks get pasted into the speaking model's final user
 * message. Ids match the feature registry the A/B bench measures them under
 * (`services/tutorStubAbArms.js`).
 *
 * The bench ran each block on its own against a bare tutor across three frozen
 * dialogues. The continuity note, the learner classifier and the redacted
 * learner-DAG readout all landed inside the noise band, and together they cost
 * about 1,250 characters a turn. They are off by default here.
 *
 * This drops them from the *prompt* only. Everything upstream still computes
 * them: the turn contract quotes the classifier's reading of the learner word
 * for word, and the planner picks its move after reading the DAG. Turning these
 * off stops pasting the working next to the answer; it does not remove the
 * working.
 */
const DEFAULT_SPEAKER_ADVISORY_BLOCKS = Object.freeze([
  'evidence_window',
  // Kept on: its own bench reading (-1.9) sits inside the band but never
  // changed sign, and it is the block that claims the human-scaffold and
  // question-support checks. Needs its own run before it can come out.
  'human_scaffold',
  'first_draft_contract',
]);

/**
 * `all` restores every block, `none` clears them, otherwise a comma-separated
 * subset. Fails closed on an unknown id: silently ignoring a typo would let a
 * run report a prompt shape it did not have.
 */
function resolveSpeakerAdvisoryBlocks(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return new Set(DEFAULT_SPEAKER_ADVISORY_BLOCKS);
  if (text === 'all') return new Set(TUTOR_STUB_SPEAKER_GATED_BLOCK_IDS);
  if (text === 'none') return new Set();
  const requested = text
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  const unknown = requested.filter((id) => !TUTOR_STUB_SPEAKER_GATED_BLOCK_IDS.includes(id));
  if (unknown.length) {
    throw new Error(
      `unknown speaker advisory block: ${unknown.join(', ')} (known: ${TUTOR_STUB_SPEAKER_GATED_BLOCK_IDS.join(', ')})`,
    );
  }
  return new Set(requested);
}

const SPEAKER_ADVISORY_BLOCKS = resolveSpeakerAdvisoryBlocks(STUB.speakerAdvisoryBlocks);

let cliPresentation = createTutorStubCliPresentation({
  theme: STUB.cliTheme,
  motion: STUB.motion,
  output,
  env: process.env,
});
const C = { ...cliPresentation.colors };
const { printTurnDebugLine, printOpeningDebugLine } = createTutorStubDebugLinePrinters({
  write: console.log,
  colors: C,
});
const printCurrentDebugId = createTutorStubCurrentDebugReporter({
  formatClipboardText: formatTutorStubDebugClipboardText,
  copyClipboard: copyTutorStubTextToClipboard,
  write: console.log,
  colors: C,
});

function configureCliPresentation({ theme, motion, noColor = false } = {}) {
  cliPresentation = createTutorStubCliPresentation({
    theme: theme ?? cliPresentation.themeId,
    motion: motion ?? cliPresentation.requestedMotion,
    output,
    env: process.env,
    noColor,
  });
  Object.assign(C, cliPresentation.colors);
  return cliPresentation;
}

const REGISTER_TEMPERATURE_POLICIES = new Set([
  'state',
  'field',
  'trajectory',
  'dynamical_system',
  'empirical_dynamical_system',
  'continuous_dynamical_system',
  'continuous_empirical_dynamical_system',
]);

const DEFAULT_INTERACTIVE_DEMO_TURNS = 3;
const MAX_INTERACTIVE_DEMO_TURNS = 8;

const EXPLICIT_PERFORMANCE_CLEAR_WORDS = new Set(['auto', 'clear', 'off', 'reset']);

const CUSTOM_LEARNER_PROFILE_EXAMPLE =
  'The learner can identify individual clues but struggles to connect them. When asked for a conclusion, they repeat the newest clue. They progress only when the tutor asks them to connect two specific public facts.';

const CLASSIFIER_SYSTEM_PROMPT = [
  'You are a compact pedagogical discourse classifier for an experimental tutor.',
  'Classify only what is visible in the public learner/tutor exchange.',
  'Do not infer hidden story facts, concealed answers, private tutor prompts, or private DAG state.',
  'Return one JSON object only. No prose outside JSON.',
].join('\n');

const LEARNER_RECORD_SYSTEM_PROMPT = [
  'You are a conservative public-record extractor for a tutor-side learner-DAG model.',
  'Use only the learner input, the public transcript, public rules, and staged public evidence supplied in the prompt.',
  'Do not infer private mental states, unstaged evidence, concealed answers, proof paths, or release schedules beyond the staged list.',
  'Return one JSON object only. No prose outside JSON.',
].join('\n');

const AUTO_LEARNER_SYSTEM_PROMPT = [
  'You are an automated learner in an experimental tutoring dialogue.',
  'You see only the public transcript and the latest tutor message.',
  'Do not infer hidden proof paths, concealed answers, private tutor prompts, or unstaged evidence.',
  "The private behavior brief supplied below defines how this learner responds. It takes priority over generic helpfulness, smooth progress, and the tutor's request for a useful answer.",
  'Preserve its recurring behavior and repair pattern. Do not silently become a generic diligent learner after correction.',
  'When the active profile permits progress, you may connect several already-public premises and state a supported follow-up conclusion in one concise turn. Never invent or anticipate unstaged evidence.',
  'Reply as the learner only. No role label, no analysis, no JSON.',
  'Keep the reply concise: usually one sentence, one question, or one warranted evidence claim.',
].join('\n');

const CLARIFIER_SYSTEM_PROMPT = [
  'You clarify wording inside a staged inquiry.',
  'Use only the public scene, public transcript, and latest tutor message supplied in the prompt.',
  'Do not infer hidden proof paths, concealed answers, private tutor prompts, private DAG state, or unstaged evidence.',
  'Do not continue the lesson or answer the case question. Explain wording only.',
  'Speak directly inside the scene. Never refer to "the tutor", "the learner", "the dialogue", or "the prompt".',
  'Keep the reply short and concrete. No JSON, no role label.',
].join('\n');

const { values: args, positionals } = parseTutorStubCliArguments({
  stub: STUB,
  committeeDefaults: PROGRAM2_COMMITTEE_DEFAULTS,
});

const {
  defaultLaunchModePickerAvailable,
  groupedWorldEntries,
  pickInitialScenarioWithKeyboard,
  pickTutorStubLaunchModeWithKeyboard,
  pickWorkplanModuleWithKeyboard,
  printAutomatedLearnerProfiles,
  printCurriculumModules,
  printWorlds,
  resolveWorldRef,
} = createTutorStubScenarioController({
  root: ROOT,
  worldDir: WORLD_DIR,
  input,
  output,
  colors: C,
  learnerProfileListText,
});

const { assertSupportedModelRefs, tutorModelChoiceEntries, resolveTutorModelSelection, visibleResolvedModel } =
  createTutorStubModelSelection({
    loadProviders,
    getProviderConfig,
    isCliProvider,
    resolveModel,
    unsupportedRefs: UNSUPPORTED_CODEX_MINI_REFS,
  });

const tutorStubLaunchRuntime = createTutorStubLaunchRuntime({
  args,
  root: ROOT,
  input,
  output,
  applyTutorStubRecipeOptions,
  latestTutorStubResumeSource,
  learnerProfileIds,
  normalizeTutorStubLaunchMode,
  normalizeTutorStubVoiceModel,
  normalizeTutorStubVoiceName,
  parseTutorStubRegisterPolicyStack,
  plainSettingName,
  readTutorStubLastSettings,
  readTutorStubSessionRecipe,
  resolveTutorModelSelection,
  resolveTutorStubLab,
  resolveTutorStubResumeSource,
  resolveWorldRef,
  tutorStubRememberedPolicyStack,
});
const {
  applyRememberedInteractiveDefaults,
  commandLineOptionProvided,
  loadedRecipeApplication,
  loadedSessionRecipe,
  rawCommandLineOptionProvided,
  rememberedSettingExplicitSources,
  resumeRecipeApplication,
  resolvedHumanSubjectClassSource,
  resolvedResumeSource,
  resolvedTrainingReuseSource,
  resolveWorkspacePath,
  selectedLabResolution,
} = tutorStubLaunchRuntime;
let { loadedSessionRecipePath } = tutorStubLaunchRuntime;

let selectedLabAdmission = null;
let selectedLabModelCallBudget = null;
const program2ProviderBudget = createProgram2ProviderBudgetFromEnvironment();

configureCliPresentation({
  theme: args.theme,
  motion: args.motion,
  noColor: args['no-color'],
});

function printHelp() {
  console.log(
    renderTutorStubCliHelp({
      STUB,
      PROGRAM2_COMMITTEE_DEFAULTS,
      MIN_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
      MAX_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
      MIN_TUTOR_STUB_RELEASE_SPEED,
      MAX_TUTOR_STUB_RELEASE_SPEED,
      MAX_TUTOR_STUB_MODEL_CALL_BUDGET,
      TUTOR_STUB_CLI_THEME_IDS,
      TUTOR_STUB_CLI_MOTION_IDS,
      DEFAULT_INTERACTIVE_DEMO_TURNS,
      TUTOR_STUB_VOICE_MODELS,
    }),
  );
}

const { loadRegisterEmpiricalPrior } = createTutorStubRegisterEmpiricalPriorModel({
  resolveWorkspacePath,
  defaultPath: path.join(ROOT, '.tutor-stub-auto-eval/register-empirical-priors.json'),
  existsSync: fs.existsSync,
  readFileSync: fs.readFileSync,
});

const {
  buildHumanDiscourseFrame,
  committedReleaseRows,
  currentReleaseRows,
  learnerDagPreflightForTurn,
  learnerPublicEvidenceState,
  nextReleaseRow,
  publicReleaseLedger,
} = createTutorStubLearnerEvidenceRuntime({
  HUMAN_DISCOURSE_FRAME_SCHEMA,
  HUMAN_DISCOURSE_PHASE,
  appendTraceEvent: (...values) => appendTraceEvent(...values),
  buildSideArcState,
  buildStrictDagAuditState,
  buildTutorStubProofDebtState,
  buildTutorStubQuestionSupport,
  buildTutorStubWorldScaffold,
  buildTutorStubLearnerDagPreflight,
  factSurface,
  latestTutorMessage,
  normalizeDiscourseRows,
  normalizeHumanDiscourseExtraction,
  oneLine,
  projectTutorStubCommittedReleaseRows,
  projectTutorStubCurrentReleaseRows,
  projectTutorStubLearnerPublicEvidenceState,
  projectTutorStubNextReleaseRow,
  projectTutorStubPublicReleaseLedger,
  projectTutorStubPublicStocktakeRows,
  projectTutorStubScaffoldState,
  projectTutorStubSpeakerPublicPremise,
  projectTutorStubWarrantPremiseAudit,
  resolveTutorStubConversationalCompletion,
  resolveTutorStubDiscoursePlane,
  resolveTutorStubGenerousInference,
  stagedEvidenceRows,
});

const publicEvidenceModel = createTutorStubPublicEvidenceModel({ committedReleaseRows, currentReleaseRows });
const { answerTermForWorld } = publicEvidenceModel;
const { auditTutorResponseLeak } = createTutorStubResponseLeakAudit({ publicEvidenceModel });

function tutorResponseRecoveryPrompt({
  publicPacket = [],
  hardIssues = [],
  leakAudit = null,
  scaffoldAudit = null,
  questionSupportAudit = null,
  dramaticReleaseAudit = null,
  actorialRealizationAudit = null,
  responseConfigurationAudit = null,
  responseConfiguration = null,
  responseCompositionAudit = null,
  liveTurnProgressionAudit = null,
  liveSourceActionAlignmentAudit = null,
  repetitionAudit = null,
  closureAudit = null,
  dialogueClosureFrame = null,
  minimalRecoveryPrompt = '',
}) {
  const partCue = {
    scene_partner:
      'Use a first-person shared-scene action such as making room beside a named public object for the learner.',
    examiner:
      'Use a first-person examining action such as holding, turning, comparing, or testing a named public object.',
    record_keeper:
      'Use a first-person record action such as opening, reading, marking, or entering a named public record.',
    advocate:
      'Put a bounded public case in your own voice and explicitly invite the learner to break, test, or challenge it.',
    skeptic:
      'Voice a first-person objection or hold the live claim against a named public fact before stating its limit.',
    foreperson: 'Enter the supported finding in your own voice and close the inquiry without another proof question.',
  }[responseConfiguration?.actorial_part];
  const tacticCue = {
    unadorned_report: 'Keep that action direct, short, and unadorned.',
    evidentiary_boundary:
      'State both the exact support and its limit with words such as only, not yet, or does not establish.',
    rapid_handoff: 'Move straight from the public object or line to one short question.',
    shared_scene_invitation: 'Make physical room beside the public object and invite the learner’s reading.',
    measured_testimony: 'Let the public words stand while refusing to force a stronger judgment.',
    dramatic_counterpressure:
      'Press the public evidence against the room’s easy verdict, then hand its test to the learner.',
    exposed_mismatch: 'Expose the mismatch through the public object rather than explaining the irony.',
    dry_counterexample: 'Use the public object as a dry counterexample and leave a concrete repair path.',
    adversarial_pressure: 'Put direct pressure on the claim, not on the learner, and name the public test.',
  }[responseConfiguration?.actorial_performance?.id];
  const rows = (guard, issues, { includeReason = true } = {}) =>
    (issues || [])
      .map(
        (issue, index) =>
          `${index + 1}. ${guard}:${issue.type}${includeReason && issue.reason ? ` - ${issue.reason}` : ''}`,
      )
      .join('\n');
  const hardIssueKeys = new Set((hardIssues || []).map((issue) => `${issue.guard || ''}:${issue.type || ''}`));
  const hardFor = (guard, issues) =>
    (issues || []).filter((issue) => hardIssueKeys.has(`${guard}:${issue.type || ''}`));
  // Leak reasons can contain a concealed answer term. The recovery model needs
  // the failure class, not the private string that triggered it.
  const leakIssues = hardFor('leak', leakAudit?.leaks);
  const scaffoldIssues = hardFor('human_scaffold', scaffoldAudit?.issues);
  const questionSupportIssues = hardFor('question_support', questionSupportAudit?.issues);
  const dramaticReleaseIssues = hardFor('dramatic_release', dramaticReleaseAudit?.issues);
  const actorialRealizationIssues = hardFor('actorial_realization', actorialRealizationAudit?.issues);
  const responseCompositionIssues = hardFor('response_composition', responseCompositionAudit?.issues);
  const liveTurnProgressionIssues = hardFor('live_turn_progression_v1', liveTurnProgressionAudit?.issues);
  const liveSourceActionAlignmentIssues = hardFor(
    'live_source_action_alignment_v1',
    liveSourceActionAlignmentAudit?.issues,
  );
  const repetitionIssues = hardFor('repetition', repetitionAudit?.issues);
  const closureIssues = hardFor('dialogue_closure', closureAudit?.issues);
  const leakRows = rows('leak', leakIssues, { includeReason: false });
  const scaffoldRows = rows('human_scaffold', scaffoldIssues);
  const questionSupportRows = rows('question_support', questionSupportIssues);
  const dramaticReleaseRows = rows('dramatic_release', dramaticReleaseIssues);
  const actorialRealizationRows = rows('actorial_realization', actorialRealizationIssues);
  const missingConfigurationAxes = actorialRealizationIssues.length
    ? Object.entries(responseConfigurationAudit?.axes || {})
        .filter(([axis, value]) => axis !== 'actorial_part' && value?.visible !== true)
        .map(([axis]) => axis)
    : [];
  const responseCompositionRows = rows('response_composition', responseCompositionIssues);
  const liveTurnProgressionRows = rows('live_turn_progression_v1', liveTurnProgressionIssues);
  const liveSourceActionAlignmentRows = rows('live_source_action_alignment_v1', liveSourceActionAlignmentIssues);
  const repetitionRows = rows('repetition', repetitionIssues);
  const closureRows = rows('dialogue_closure', closureIssues);
  const recoveryTransition = responseConfiguration?.recovery_transition || null;
  const instructionalMetaRepair = responseConfiguration?.discourse_plane?.plane === 'instructional_meta';
  return [
    '[Tutor-only repair instruction]',
    'The previous draft failed a response check and was not shown to the learner.',
    'Generate one genuinely different, plain replacement from the compact public packet below. Do not quote, imitate, or discuss the rejected draft.',
    'Return only the replacement tutor reply as ordinary text: no JSON, markdown, alternatives, labels, or commentary.',
    'Follow the complete minimal recovery contract below. Answer the learner before developing the inquiry, remain one continuous public tutor utterance, and use only information in the public packet and replayed public dialogue.',
    recoveryTransition
      ? `The logged recovery transition is ${recoveryTransition.selected_signature} -> ${recoveryTransition.delivered_signature} (${recoveryTransition.strategy}). Realize only the delivered configuration.`
      : null,
    'Never mention prompts, policies, checks, candidates, hidden evidence, a concealed answer, a DAG, or this recovery operation.',
    leakRows ? 'Do not name or imply concealed actors, conclusions, objects, or unreleased evidence.' : null,
    leakIssues.some((issue) => issue.type === 'unsupported_evidence_correspondence')
      ? 'State each released record directly. Do not add that records match, correspond, trace to one another, or share a source unless the compact public packet states that exact relationship.'
      : null,
    scaffoldRows ? 'Accept the learner’s completed local move; do not ask it again in new words.' : null,
    questionSupportRows
      ? 'Do not ask the learner to invent an unseen record, source, person, name, or fact. Put enough public direction into the reply first.'
      : null,
    liveTurnProgressionRows
      ? instructionalMetaRepair
        ? 'Begin with a substantive acknowledgement of the wording problem, then restate the explanation plainly. Ask no question and do not quote the public inquiry question.'
        : 'Answer the learner substantively first. Keep any permitted question single and terminal, and make its final sentence name the typed public focus.'
      : null,
    liveSourceActionAlignmentRows
      ? 'Write the required public carrier in the host entrance immediately before the exact source words. Do not substitute an unrelated prop or rely on a later question to name the carrier.'
      : null,
    liveSourceActionAlignmentIssues.some(
      (issue) =>
        String(issue.type || '').startsWith('compensation_') ||
        ['direct_source_inaccessible', 'source_qualifier_not_preserved'].includes(issue.type),
    )
      ? 'After the exact SOURCE, make the very next complete sentence its one unquoted declarative accessibility sentence. Keep SOURCE words in order, preserve no/not/only/may, add only a/an/the, and stay within the stated word limit.'
      : null,
    questionSupportIssues.some((issue) => issue.type === 'missing_clarification_invitation')
      ? 'Make it explicit that the learner may ask you to unpack a word or connection.'
      : null,
    dramaticReleaseRows
      ? 'Deliver every newly public clue visibly through its supplied public source or exhibit, without announcing a role-play.'
      : null,
    dramaticReleaseAudit?.active && responseConfiguration?.actorial_part_selection?.authored_role
      ? `The required newly public clue source is ${responseConfiguration.actorial_part_selection.authored_role}; put its supplied evidence in first-person quoted speech without a role label.`
      : null,
    dramaticReleaseAudit?.active
      ? 'Never say “let’s role-play,” “I’ll be,” “I’ll take the part,” “speaking as,” or “back to us.”'
      : null,
    actorialRealizationRows
      ? `Visibly perform ${responseConfiguration?.actorial_part_label || responseConfiguration?.actorial_part || 'the delivered public part'} without a role label or stage direction. Host-part contract: ${responseConfiguration?.actorial_part_selection?.contract || 'take the delivered public part through concrete first-person action or speech'}`
      : null,
    actorialRealizationRows
      ? `Performance contract: ${responseConfiguration?.actorial_performance?.contract || 'make the selected tactic transcript-visible through concrete action or direct speech'}`
      : null,
    actorialRealizationRows && partCue ? `Concrete host-part cue: ${partCue}` : null,
    actorialRealizationRows && tacticCue ? `Concrete performance cue: ${tacticCue}` : null,
    questionSupportIssues.some((issue) => issue.type === 'missing_bounded_choice')
      ? 'Offer an unmistakable two-way public choice. If the minimal recovery contract permits a question, you may ask “Which should we test first: A) this public clue, or B) that public clue?” If it forbids questions, state the options declaratively, for example “Choose one way forward: A) inspect this public clue, or B) leave the conclusion open.” Do not disguise the choice as open recall.'
      : null,
    missingConfigurationAxes.length
      ? `Make these delivered configuration axes plainly visible: ${missingConfigurationAxes.join(', ')}.`
      : null,
    responseCompositionRows
      ? 'Respond to the learner’s actual contribution first, then develop the inquiry in the same voice and paragraph.'
      : null,
    responseCompositionIssues.some((issue) => issue.type === 'resolved_point_reopened')
      ? 'The learner already answered the immediately preceding local question. Credit or qualify that answer once, then move to a genuinely new public clue or implication; do not ask the same distinction again.'
      : null,
    responseCompositionIssues.some((issue) => issue.type === 'unsupported_endorsement_request')
      ? 'Do not ask the learner to endorse a stronger proposition than their answer and the public evidence support.'
      : null,
    responseConfiguration?.surface_budgets?.max_average_sentence_words
      ? `Keep average sentence length at or below ${responseConfiguration.surface_budgets.max_average_sentence_words} words.`
      : null,
    repetitionRows ? 'Do not repeat a recent tutor reply or restate the same question in different words.' : null,
    closureRows
      ? 'Explicitly say that the case, book, or inquiry is closed. Do not reopen the proof or ask another evidentiary question.'
      : null,
    closureRows && dialogueClosureFrame?.allowCheckIn
      ? 'You may ask exactly one optional final check-in about whether a link should be revisited; ask no other question.'
      : null,
    closureRows && !dialogueClosureFrame?.allowCheckIn
      ? 'Do not ask any question. This is the terminal tutor turn.'
      : null,
    minimalRecoveryPrompt,
    '',
    '[Compact public recovery packet]',
    ...(Array.isArray(publicPacket) ? publicPacket : [publicPacket]).filter(Boolean),
    '[End compact public recovery packet]',
    '',
    '[Response-check failures]',
    ...[
      leakRows,
      scaffoldRows,
      questionSupportRows,
      dramaticReleaseRows,
      actorialRealizationRows,
      responseCompositionRows,
      repetitionRows,
      closureRows,
    ].filter(Boolean),
    '[End response-check failures]',
    '[End tutor-only repair instruction]',
  ]
    .filter((line) => line !== null)
    .join('\n');
}

function tutorGuardAttemptEnvelope({ kind, attempt, response, audits = null, repairedSpans = [] }) {
  return projectTutorStubGuardAttemptEnvelope({
    kind,
    attempt,
    response,
    audits,
    issues: audits ? tutorStubGuardIssueRows(audits) : [],
    repairedSpans,
  });
}

function buildTutorGuardAccounting({
  response,
  state,
  tutorTurn,
  guards,
  attempts,
  repairsApplied,
  finalSource,
  finalAudits = null,
  outcome,
}) {
  const finalText = String(response?.text || '');
  const generationCalls = [
    ...new Map(
      (attempts || [])
        .map((attemptRow) => attemptRow?.generation)
        .filter((generation) => generation?.callId)
        .map((generation) => [generation.callId, generation]),
    ).values(),
  ];
  const totalUsage = generationCalls.reduce(
    (totals, generation) => {
      const usage = generation.usage || {};
      totals.inputTokens += Number(usage.inputTokens || 0);
      totals.outputTokens += Number(usage.outputTokens || 0);
      totals.totalTokens += Number(
        usage.totalTokens || Number(usage.inputTokens || 0) + Number(usage.outputTokens || 0),
      );
      totals.cost += Number(usage.cost || 0);
      return totals;
    },
    { inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0 },
  );
  const generation = {
    modelCallCount: generationCalls.length,
    originalCandidateLatencyMs: Number(generationCalls[0]?.latencyMs || 0),
    recoveryLatencyMs: generationCalls.slice(1).reduce((sum, call) => sum + Number(call.latencyMs || 0), 0),
    totalModelLatencyMs: generationCalls.reduce((sum, call) => sum + Number(call.latencyMs || 0), 0),
    tokenUsageAvailable:
      generationCalls.length > 0 && generationCalls.every((call) => call.tokenUsageAvailable === true),
    usage: totalUsage,
    calls: generationCalls,
  };
  return jsonClone({
    schema: TUTOR_GUARD_ACCOUNTING_SCHEMA,
    turn: tutorTurn,
    policy: state?.experiment?.policy || state?.register?.policy || null,
    profile: state?.experiment?.profile || null,
    guards,
    outcome,
    originalCandidate: attempts[0] || null,
    attempts,
    repairsApplied,
    generation,
    finalDelivery: {
      source: finalSource,
      provider: response?.provider || null,
      model: response?.model || null,
      deliveryConfiguration: jsonClone(response?.deliveryResponseConfiguration || null),
      configurationTransition: jsonClone(response?.responseConfigurationTransition || null),
      deterministicFallback: Boolean(response?.deterministicFallback),
      deterministicClosure: Boolean(response?.deterministicClosure),
      candidate: {
        start: 0,
        end: finalText.length,
        text: finalText,
        offsetEncoding: 'utf16_code_units',
      },
      audits: finalAudits,
      auditOk: finalAudits?.deliveryOk ?? finalAudits?.ok ?? null,
    },
  });
}

function attachTutorGuardAccounting({
  response,
  state,
  trace,
  tutorTurn,
  role = 'tutor_stub_tutor',
  guards,
  attempts,
  repairsApplied,
  finalSource,
  finalAudits = null,
  outcome,
}) {
  const accounting = buildTutorGuardAccounting({
    response,
    state,
    tutorTurn,
    guards,
    attempts,
    repairsApplied,
    finalSource,
    finalAudits,
    outcome,
  });
  response.guardAccounting = accounting;
  response.finalCandidateLatencyMs = Number(response.latencyMs || 0);
  if (accounting.generation?.modelCallCount) {
    response.latencyMs = accounting.generation.totalModelLatencyMs;
    response.usage = accounting.generation.usage;
    response.tokenUsageAvailable = accounting.generation.tokenUsageAvailable;
  }
  appendTraceEvent(trace, {
    type: 'tutor_response_guard_accounting',
    role,
    turn: tutorTurn,
    accounting,
  });
  return response;
}

async function buildTutorOpening(
  state,
  { signal = null, realizer = state.openingRealizer, deterministicSource = 'world_grounded_deterministic' } = {},
) {
  const world = state.world;
  if (!world) {
    const curriculumModule = state.curriculum?.module || null;
    const text = [
      curriculumModule
        ? `Let's take up ${curriculumModule.title}.`
        : `Let's start ${state.topic ? `with ${state.topic}` : 'there'}.`,
      curriculumModule?.essential_question || null,
      curriculumModule
        ? 'What is your current model of the decision, or the first assumption you want us to test?'
        : 'Say your first idea, or name the one point you want to test first.',
    ]
      .filter(Boolean)
      .join(' ');
    return {
      text,
      source: 'deterministic_topic_fallback',
      frame: buildTutorStubOpeningFrame(),
      audit: null,
      model: null,
    };
  }

  const frame = buildTutorStubOpeningFrame({
    world,
    openingEvidence: currentReleaseRows(state, 1),
  });
  const openingSystemPrompt = tutorStubOpeningSystemPrompt();
  const openingUserPrompt = tutorStubOpeningPrompt(frame);
  const speakerPrivilegeAudit = auditTutorStubSpeakerPrivilege({
    world,
    tutorTurn: 1,
    systemPrompt: openingSystemPrompt,
    privateAdvisory: openingUserPrompt,
  });
  appendTraceEvent(state.trace, {
    type: 'tutor_opening_speaker_privilege_audit',
    turn: 0,
    audit: speakerPrivilegeAudit,
  });
  if (!speakerPrivilegeAudit.ok) {
    throw new Error(
      `Tutor opening frame crossed the private-planner boundary: ${speakerPrivilegeAudit.issues
        .map((issue) => `${issue.code}:${issue.source}`)
        .join(', ')}`,
    );
  }
  const authoredText = String(frame.authoredText || '').trim();
  let candidate = authoredText;
  let source = authoredText ? 'authored_world_opening' : 'speaking_tutor_model';
  let modelResponse = null;
  let generationError = null;

  if (!candidate && realizer === 'deterministic') {
    candidate = deterministicTutorStubOpening(frame);
    source = deterministicSource;
  }

  if (!candidate) {
    startInterimAnimation(state, 'opening the scene', { tutorTurn: 0 });
    try {
      modelResponse = await callPromptModel({
        prompt: openingUserPrompt,
        resolved: state.resolved,
        systemPrompt: openingSystemPrompt,
        role: 'tutor_stub_opening',
        maxTokens: Math.min(700, state.maxTokens || 700),
        trace: state.trace,
        stream: { enabled: false, interim: state.interim },
        cliEffort: state.cliEffort,
        turn: 0,
        signal,
      });
      candidate = cleanTutorStubStageSpeech(modelResponse.text);
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      generationError = error.message;
      appendTraceEvent(state.trace, {
        type: 'tutor_opening_realization_error',
        turn: 0,
        provider: state.resolved.provider,
        model: state.resolved.model,
        error: error.message,
      });
    } finally {
      stopInterimAnimation(state);
    }
  }

  const leakAudit = auditTutorResponseLeak({
    text: candidate,
    world,
    tutorTurn: 1,
    learnerText: '',
    state,
  });
  let audit = auditTutorStubOpening({ text: candidate, frame, leakAudit });
  if (!audit.ok) {
    const rejectedSource = source;
    candidate = deterministicTutorStubOpening(frame);
    source = 'world_grounded_safe_fallback';
    const fallbackLeakAudit = auditTutorResponseLeak({
      text: candidate,
      world,
      tutorTurn: 1,
      learnerText: '',
      state,
    });
    const fallbackAudit = auditTutorStubOpening({ text: candidate, frame, leakAudit: fallbackLeakAudit });
    appendTraceEvent(state.trace, {
      type: 'tutor_opening_candidate_rejected',
      turn: 0,
      source: rejectedSource,
      audit,
      fallbackAudit,
    });
    audit = fallbackAudit;
    if (!audit.ok) {
      throw new Error(
        `Tutor opening failed its public-safe requirements: ${audit.issues.map((issue) => issue.type).join(', ')}`,
      );
    }
  }

  const realization = {
    schema: 'machinespirits.tutor-stub.opening-realization.v1',
    source,
    frame,
    requirements: TUTOR_STUB_OPENING_REQUIREMENTS,
    audit,
    speakerPrivilegeAudit,
    generationError,
    model: modelResponse
      ? {
          provider: modelResponse.provider,
          model: modelResponse.model,
          latencyMs: modelResponse.latencyMs,
          usage: modelResponse.usage,
          effort: modelResponse.effort || modelResponse.reasoningEffort || null,
        }
      : null,
  };
  appendTraceEvent(state.trace, {
    type: 'tutor_opening_realization',
    turn: 0,
    realization,
  });
  return {
    ...realization,
    text: candidate,
    promptSnapshot: modelResponse?.promptSnapshot || null,
  };
}

function worldPublicPrompt(world) {
  return projectTutorStubWorldPublicPrompt(world, { audienceLines: dramaticAudiencePromptLines(world) });
}

function buildDirectorInitialContext(world) {
  return buildTutorStubDirectorInitialContext(world, { audienceLines: dramaticAudiencePromptLines(world) });
}

function printDirectorInitialContext(context) {
  for (const line of projectTutorStubDirectorContextLines(context, { colors: C })) console.log(line);
}

function printDirectorPreludeBeforeFirstTutor(state, { reason = 'first_tutor_message' } = {}) {
  if (!state?.directorContext || state.directorOpeningPresented) return false;
  state.directorOpeningPresented = true;
  appendTraceEvent(state.trace, {
    type: 'director_opening_prelude',
    reason,
    context: state.directorContext,
  });
  printDirectorInitialContext(state.directorContext);
  return true;
}

const directorNotesIssuedSoFar = createTutorStubDirectorNotesModel({
  committedReleaseRows,
});

function printDirectorNotesIssuedSoFar(state) {
  const notes = directorNotesIssuedSoFar(state);
  for (const line of projectTutorStubDirectorNotesLines(notes, { colors: C })) console.log(line);
  return notes;
}

function worldSpeakerDagPrompt(world) {
  return projectTutorStubWorldSpeakerDagPrompt(world, {
    ledgerTerm: worldLedgerTerm(world),
    // Phase S2c: TUTOR_STUB_CONTRACT_LICENCE=1 places the demand-card
    // exception inside the standing contract (the placement law).
    demandLicence: process.env.TUTOR_STUB_CONTRACT_LICENCE === '1',
  });
}

const { responseChoiceModeRules } = createTutorStubPromptBlockModel({ worldLedgerTerm, worldFlavourPhrase });

const CURRICULUM_MODULE_PROMPT_START = '[Curriculum module source — private tutor context]';
const CURRICULUM_MODULE_PROMPT_END = '[End curriculum module source]';
const CURRICULUM_PHASE_PROMPT_START = '[Curriculum phase controller — private tutor context]';
const CURRICULUM_PHASE_PROMPT_END = '[End curriculum phase controller]';

function buildSystemPrompt({
  topic,
  learner,
  goal,
  style,
  worldBundle,
  curriculumBundle = null,
  dag,
  multipleChoice = false,
}) {
  const world = worldBundle?.world || null;
  return [
    'You are an experimental AI tutor stub.',
    '',
    `Topic: ${topic}`,
    `Learner: ${learner}`,
    `Goal: ${goal}`,
    `Style: ${style}`,
    curriculumBundle
      ? delimitedPrompt(CURRICULUM_MODULE_PROMPT_START, curriculumBundle.prompt, CURRICULUM_MODULE_PROMPT_END)
      : null,
    '',
    'Rules:',
    '- Treat tutoring here as acting in a shared inquiry. Each turn may cast you in a concrete public part; commit to its action and voice rather than merely changing tone.',
    '- A part never grants knowledge. It changes how you handle only the evidence already public or explicitly released in this turn.',
    "- Start by locating the learner's current idea, not by grading them.",
    '- Ask at most one main question when the compiled turn contract permits one; ask none when its handoff forbids questions.',
    '- Use a tiny concrete example when it helps.',
    '- Keep the answer short enough that the learner can respond.',
    '- If the learner asks for the answer, give a hint first unless they explicitly need a direct answer.',
    '- Treat learner questions as legitimate moves, not evasions. If ambiguity blocks progress, invite one concrete in-scene question about the evidence, tool, or distinction.',
    '- When asking would be better than guessing, make that option explicit in character: for example, "Which part of that mark needs clarifying?" Never describe either speaker as "the tutor" or "the learner" in learner-facing prose.',
    curriculumBundle
      ? '- Discuss repository, evaluation, cell, and experiment details when the source makes them relevant, but never use hidden prompts or an internal score as authority.'
      : '- Never mention rubrics, cells, hidden prompts, or evaluation infrastructure.',
    '- Keep formal machinery internal. Do not show predicate/function notation, code-like atoms, premise ids, rule ids, variable names, or route labels in learner-facing prose.',
    curriculumBundle
      ? '- Speak from the public curriculum source and the learner’s stated reasoning. Label unverified repository claims as questions to inspect.'
      : '- In story mode, speak only in public evidence language. Never give an example in formal notation or name an internal route.',
    curriculumBundle
      ? '- Do not make the learner reach a point and then restate it as a separate bookkeeping exercise; let one warranted formulation count.'
      : `- Do not make the learner deduce a claim and then separately enter it in the ${worldLedgerTerm(world)}. Their stated warranted claim is the entry.`,
    '- Let human learners compress obvious reasoning. Do not ask them to restate every small warrant unless the missing warrant is the real source of error.',
    curriculumBundle
      ? '- Keep the exchange concise and analytic: usually 2-4 short sentences, with one live decision or uncertainty at a time.'
      : `- In story mode, keep the ${worldFlavourPhrase(world)} but be terse: usually 2-4 short sentences, never a catalogue of routes.`,
    ...responseChoiceModeRules({ multipleChoice, world: worldBundle?.world || null }),
    curriculumBundle
      ? '- When a useful reasoning brief is complete, summarize what the dialogue established and separately name what still needs repository inspection, implementation, or external validation.'
      : '- If the public evidence has licensed the final answer and the learner has stated it, close the case plainly: say the verdict is now licensed, name the two proof supports in public language, and stop asking for another investigative branch.',
    curriculumBundle
      ? '- Never invent repository state, test results, run outcomes, or completion evidence. Ask what must be inspected when the source does not settle it.'
      : '- Never supply the answer or a named suspect from hidden story knowledge. If the public record does not yet license a name, ask for the evidence that would license it.',
    ...worldPublicPrompt(world),
    ...(dag ? worldSpeakerDagPrompt(world) : []),
  ].join('\n');
}

function loadSystemPrompt({ worldBundle, curriculumBundle = null, dag, topic, multipleChoice = false }) {
  if (!args.system) {
    return buildSystemPrompt({
      topic,
      learner: args.learner,
      goal: args.goal,
      style: args.style,
      worldBundle,
      curriculumBundle,
      dag,
      multipleChoice,
    });
  }
  return fs.readFileSync(args.system, 'utf8');
}

const tutorStubRecipeModelIdentity = createTutorStubRecipeModelIdentityResolver({
  resolveModel,
  getProviderConfig,
  visibleResolvedModel,
});

function printResponseDetails(meta, state, { suffix = '' } = {}) {
  if (!state?.responseDetails?.enabled) return false;
  console.log(`${C.dim}${metadataLine(meta)}${suffix}${C.reset}`);
  const timingLine = formatTutorStubTurnTiming(meta?.turnTiming);
  if (timingLine) console.log(`${C.dim}${timingLine}${C.reset}`);
  console.log('');
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

const normalizeDagMode = (value) => normalizeTutorStubDagMode(value, { modes: DAG_MODES });

function buildRegisterPalette(mode) {
  const definitions = getEngagementStanceDefinitions();
  return buildTutorStubRegisterPalette(mode, {
    definitions,
    safeNames: getEngagementStanceNames({ includeArmAssigned: false }),
    negativeFloorNames: NEGATIVE_FLOOR_REGISTERS,
    resolveStance: resolveEngagementStance,
  });
}

function humanDirectedRegisterPalette() {
  const definitions = getEngagementStanceDefinitions();
  return Object.keys(definitions).filter((name) => definitions[name]?.simulated_only !== true);
}

const { engagementStancePalettePromptRows, requestTypePromptRows } = createTutorStubRegisterPromptVocabulary({
  getEngagementStanceDefinition,
  getRequestTypeDefinitions,
});

const registerHistoryPromptSummary = (state) =>
  projectTutorStubRegisterHistoryPrompt(state, { normalizeSelection: normalizeStoredRegisterSelection });

function latestFieldStateMismatch(state) {
  return latestRegisterEfficacy(state)?.mismatch || null;
}

function engagementStanceSelectionPolicyPrompt(state) {
  const policy = state.register?.policy || 'dynamic';
  const overlays = state.register?.overlays || [];
  const latest = latestRegisterSelection(state);
  const latestEfficacy = latest?.efficacy?.label || 'pending';
  const recentBrisk = recentRegisterCount(state, 'brisk');
  const lines =
    policy === 'random'
      ? [
          '- Engagement-stance policy: random. The runtime will sample a register locally from the active palette.',
          '- Do not choose or justify an engagement stance in the model output for this policy.',
        ]
      : policy === 'negative'
        ? [
            '- Engagement-stance policy: negative. The runtime will sample locally only from ironic, sarcastic, and face_threat.',
            '- Do not choose or justify an engagement stance in the model output for this policy.',
          ]
        : policy === 'bland'
          ? [
              '- Engagement-stance policy: bland. The runtime uses a fixed plain register as a non-adaptive baseline.',
              '- Do not choose or justify an engagement stance in the model output for this policy.',
            ]
          : policy === 'trajectory'
            ? [
                '- Engagement-stance policy: trajectory. The runtime maps recent learner-field and learner-DAG trajectory into a local engagement-stance distribution.',
                '- Do not choose or justify an engagement stance in the model output for this policy.',
              ]
            : policy === 'dynamical_system'
              ? [
                  '- Engagement-stance policy: dynamical_system. The runtime maps a continuous state/derivative vector through theory priors plus local efficacy evidence.',
                  '- Do not choose or justify an engagement stance in the model output for this policy.',
                ]
              : policy === 'empirical_dynamical_system'
                ? [
                    '- Engagement-stance policy: empirical_dynamical_system. The runtime maps a continuous state/derivative vector through theory priors, local efficacy evidence, and cross-run empirical priors.',
                    '- Do not choose or justify an engagement stance in the model output for this policy.',
                  ]
                : policy === 'continuous_dynamical_system'
                  ? [
                      '- Engagement-stance policy: continuous_dynamical_system. The runtime maps a continuous state/derivative vector through theory priors plus local efficacy evidence into a weighted engagement-stance blend.',
                      '- Do not choose or justify an engagement stance in the model output for this policy.',
                    ]
                  : policy === 'continuous_empirical_dynamical_system'
                    ? [
                        '- Engagement-stance policy: continuous_empirical_dynamical_system. The runtime maps a continuous state/derivative vector through theory priors, local efficacy evidence, and cross-run empirical priors into a weighted engagement-stance blend.',
                        '- Do not choose or justify an engagement stance in the model output for this policy.',
                      ]
                    : [
                        '- Engagement-stance policy: dynamic. The up-front reviewer chooses the register; do not treat the learner request type as the register.',
                        '- Brisk pacing is available but must not be the default register.',
                        '- Penalize repeating the same register, especially brisk. A repeated register needs a concrete reviewer reason grounded in the current public turn.',
                        '- Use brisk only when tight pacing is the needed stance: explicit step-by-step request, visible procedural confusion about the immediate next evidence move, or a newly staged evidence item that needs one learner-owned inference.',
                        '- Do not choose brisk merely because the learner-DAG still has a release_or_pacing_gap, inference_gap, missing premise, or incomplete proof path.',
                        '- If the previous brisk choice produced no_clear_progress or regression_or_overreach, choose a non-brisk register unless the current learner explicitly asks for step-by-step help.',
                        '- Good dynamic alternatives: precise for a distinction/error in terms or accountable warrant; plain for compression/transfer; charismatic for resistant, rote, answer-seeking, or low-agency compliance; witnessing for affective exposure.',
                      ];
  if (latest) {
    lines.push(`- Last register: ${latest.selected_register}; observed efficacy: ${latestEfficacy}.`);
    if (latest.efficacy?.mismatch) {
      lines.push(
        `- Last field/state relation: ${latest.efficacy.mismatch}; field delta ${
          formatSignedInterimNumber(latest.efficacy.field?.delta, { decimals: 3 }) || '0'
        }, DAG progress ${latest.efficacy.dagProgress ? 'yes' : 'no'}.`,
      );
    }
  }
  if (policy === 'dynamic' && recentBrisk) {
    lines.push(`- Recent brisk count: ${recentBrisk} in the last four selections. Treat this as a repetition penalty.`);
  }
  if (policy === 'dynamic') {
    lines.push(
      '- If the last relation was field_without_dag, treat that as preparatory success: use plain or precise to convert the emerging learner move into one public evidence claim.',
    );
    lines.push(
      '- If the last relation was dag_without_field, the proof state moved but learner agency flattened: ask the learner to restate why the evidence matters in their own words before pushing another proof step.',
    );
  }
  if (overlays.length) {
    lines.push(
      `- Added strong-change policies: ${overlays.join(', ')}. Make the primary ${policy} choice normally; the runtime evaluates these overlays afterward and records whether one takes control.`,
    );
  }
  return lines.join('\n');
}

async function callPromptModel({
  prompt: promptInput,
  messageHistory = [],
  resolved,
  systemPrompt: systemPromptInput,
  role,
  maxTokens = 700,
  trace = null,
  stream = null,
  cliEffort = null,
  turn = null,
  signal = null,
  historyTurns = null,
}) {
  let prompt = promptInput;
  let systemPrompt = systemPromptInput;
  const startedAt = new Date().toISOString();
  const shouldStream = Boolean(stream?.enabled && !stream?.deferOutput && providerSupportsStreaming(resolved));
  let publicMessageHistory = (Array.isArray(messageHistory) ? messageHistory : []).map((message) => ({
    role: message?.role === 'assistant' ? 'assistant' : 'user',
    content: String(message?.content || ''),
  }));
  let promptAudit = auditTutorStubPrompt({
    surface: tutorStubPromptSurfaceForRole(role),
    systemPrompt,
    userPrompt: prompt,
    messageHistory: publicMessageHistory,
  });
  const budgetViolationCodes = new Set(['character_budget_exceeded', 'approximate_token_budget_exceeded']);
  const hasBudgetViolation = promptAudit.violations.some((violation) => budgetViolationCodes.has(violation.code));
  if (role === 'tutor_stub_auto_learner' && hasBudgetViolation && historyTurns !== null) {
    const originalAudit = promptAudit;
    const nonHistoryText = [systemPrompt, prompt].filter(Boolean).join('\n\n');
    const historyBoundaryChars = nonHistoryText ? 2 : 0;
    const compaction = compactTutorStubPublicMessagesForBudget(publicMessageHistory, {
      maxHistoryChars: Math.max(0, originalAudit.budget.maxChars - nonHistoryText.length - historyBoundaryChars),
      recentTurns: historyTurns,
    });
    if (compaction.applied) {
      publicMessageHistory = compaction.messages;
      const recoveredAudit = auditTutorStubPrompt({
        surface: tutorStubPromptSurfaceForRole(role),
        systemPrompt,
        userPrompt: prompt,
        messageHistory: publicMessageHistory,
      });
      const budgetRecovered = recoveredAudit.violations.every((violation) => !budgetViolationCodes.has(violation.code));
      appendTraceEvent(trace, {
        type: 'prompt_audit_recovery',
        role,
        turn,
        recovery: {
          applied: budgetRecovered,
          method: 'budget_window_public_history',
          historyMode: compaction.historyMode,
          availableMessageCount: compaction.availableMessageCount,
          replayedMessageCount: compaction.replayedMessageCount,
          omittedMessageCount: compaction.omittedMessageCount,
          originalHistoryChars: compaction.originalChars,
          replayedHistoryChars: compaction.replayedChars,
          recentTurns: compaction.recentTurns,
          maxHistoryChars: compaction.maxHistoryChars,
          originalViolations: originalAudit.violations,
        },
        audit: recoveredAudit,
      });
      if (budgetRecovered) {
        promptAudit = {
          ...recoveredAudit,
          recovery: {
            applied: true,
            method: 'budget_window_public_history',
            omittedMessageCount: compaction.omittedMessageCount,
          },
        };
      }
    }
  }
  // Backport of the Phase 5b Amendment-1 pinned-runtime patch
  // (committee-runtime-main-reconciliation): endgame dialogue naturally
  // repeats the verdict sentence across prompt sections, and a duplicate-only
  // audit failure is recoverable by deduplication — exactly as
  // invokeTutorAttempt already recovers — instead of a fatal that kills a
  // nearly-complete dialogue.
  const duplicateOnlyPromptFailure =
    !promptAudit.ok &&
    promptAudit.duplicateInstructionLines?.length > 0 &&
    promptAudit.violations.every((violation) => violation.code === 'duplicate_instruction_lines');
  if (duplicateOnlyPromptFailure) {
    const originalAudit = promptAudit;
    const recovery = recoverTutorStubDuplicateInstructionLines({
      texts: [systemPrompt, prompt],
      duplicateInstructionLines: originalAudit.duplicateInstructionLines,
    });
    [systemPrompt, prompt] = recovery.texts;
    const recoveredAudit = auditTutorStubPrompt({
      surface: tutorStubPromptSurfaceForRole(role),
      systemPrompt,
      userPrompt: prompt,
      messageHistory: publicMessageHistory,
    });
    appendTraceEvent(trace, {
      type: 'prompt_audit_recovery',
      role,
      turn,
      recovery: {
        applied: recovery.applied && recoveredAudit.ok,
        method: 'deduplicate_exact_instruction_lines',
        originalDuplicateInstructionLines: originalAudit.duplicateInstructionLines,
        removedPromptLineCount: recovery.removedLines.length,
      },
      audit: recoveredAudit,
    });
    if (recoveredAudit.ok) promptAudit = { ...recoveredAudit, recovery: { applied: true } };
  }
  const requestMessages = [...publicMessageHistory, { role: 'user', content: prompt }];
  if (!promptAudit.ok) {
    appendTraceEvent(trace, {
      type: 'prompt_audit_failed',
      role,
      turn,
      audit: promptAudit,
    });
    throw new Error(
      `Prompt audit failed for ${role}: ${promptAudit.violations.map((violation) => violation.code).join(', ')}`,
    );
  }
  reserveProgram2ProviderBudget({ maxTokens, trace, role, turn });
  reserveTutorStubMeteredModelCall({ trace, role, turn });
  try {
    let response;
    if (isCliProvider(resolved.provider)) {
      const onEvent =
        resolved.provider === 'codex'
          ? (event) => {
              const item = event?.item || {};
              appendTraceEvent(trace, {
                type: 'cli_stream_event',
                role,
                turn,
                eventType: event?.type || 'unknown',
                itemType: item?.type || null,
              });
              if (!stream?.enabled) return;
              const active = getInterimState(stream?.interim)?.active;
              if (!active) return;
              const phase =
                event?.type === 'thread.started'
                  ? 'starting Codex'
                  : event?.type === 'turn.started'
                    ? 'model working'
                    : event?.type === 'item.started' && item?.type
                      ? item.type.replaceAll('_', ' ')
                      : event?.type === 'item.completed' && item?.type === 'agent_message'
                        ? 'finalizing result'
                        : null;
              if (phase) active.phase = `${active.basePhase || active.phase} · ${phase}`;
            }
          : null;
      const result = await callAIWithCliBridge(
        { provider: resolved.provider, model: resolved.model },
        systemPrompt,
        prompt,
        role,
        { messageHistory: publicMessageHistory, effort: cliEffort, onEvent, signal },
      );
      response = {
        text: result.text,
        provider: result.provider,
        model: result.model,
        latencyMs: result.latencyMs,
        usage: {
          inputTokens: result.inputTokens || 0,
          outputTokens: result.outputTokens || 0,
          totalTokens: (result.inputTokens || 0) + (result.outputTokens || 0),
          cost: result.cost || 0,
        },
        effort: result.effort || result.reasoningEffort || null,
        reasoningEffort: result.reasoningEffort || result.effort || null,
        tokenUsageAvailable: result.tokenUsageAvailable,
        streamedEvents: result.streamedEvents || 0,
        invalidStreamLines: result.invalidStreamLines || 0,
        outputSource: result.outputSource || null,
      };
    } else if (shouldStream) {
      const temperature = effectiveTemperatureForModel(resolved, 0.1);
      const sink = createConsoleTokenSink(role, stream?.interim);
      let final = null;
      for await (const chunk of streamAI({
        provider: resolved.provider,
        model: resolved.model,
        systemPrompt,
        messages: requestMessages,
        preset: 'socratic',
        config: { temperature, maxTokens },
      })) {
        if (chunk.type === 'text_delta') {
          sink.write(chunk.content);
        } else if (chunk.type === 'done') {
          final = chunk;
        }
      }
      const streamed = sink.finish();
      response = {
        text: final?.content || '',
        provider: final?.provider || resolved.provider,
        model: final?.model || resolved.model,
        latencyMs: final?.latencyMs || 0,
        usage: final?.usage || null,
        streamed,
      };
    } else {
      const temperature = effectiveTemperatureForModel(resolved, 0.1);
      const result = await callAI({
        provider: resolved.provider,
        model: resolved.model,
        systemPrompt,
        messages: requestMessages,
        preset: 'socratic',
        config: { temperature, maxTokens },
      });
      response = {
        text: result.content,
        provider: result.provider,
        model: result.model,
        latencyMs: result.latencyMs,
        usage: result.usage,
      };
    }

    response.promptSnapshot = {
      systemPrompt,
      userPrompt: prompt,
      messageHistory: publicMessageHistory,
      role,
      promptAudit,
    };
    appendTraceEvent(trace, {
      type: 'model_call',
      role,
      turn,
      startedAt,
      provider: response.provider,
      model: response.model,
      request: {
        systemPrompt,
        prompt,
        messageHistory: publicMessageHistory,
        messages: requestMessages,
        maxTokens,
        cliEffort,
        promptAudit,
      },
      response: {
        text: response.text,
        latencyMs: response.latencyMs,
        usage: response.usage,
        streamed: Boolean(response.streamed),
        effort: response.effort || response.reasoningEffort || null,
        streamedEvents: response.streamedEvents || 0,
        invalidStreamLines: response.invalidStreamLines || 0,
        outputSource: response.outputSource || null,
      },
    });
    response.promptAudit = promptAudit;
    return response;
  } catch (err) {
    appendTraceEvent(trace, {
      type: err?.name === 'AbortError' ? 'model_call_aborted' : 'model_call_error',
      role,
      turn,
      startedAt,
      provider: resolved.provider,
      model: resolved.model,
      request: {
        systemPrompt,
        prompt,
        messageHistory: publicMessageHistory,
        messages: requestMessages,
        maxTokens,
        promptAudit,
      },
      error: err.message,
      ...(err?.code === 'CLI_PROVIDER_POLICY_VIOLATION'
        ? { cliPolicyViolation: tutorStubCliPolicyRetryDecision(err, { alreadyUsed: true }) }
        : {}),
    });
    throw err;
  }
}

const {
  buildTutorInterimContext,
  clearStatusLine,
  pauseInterimAnimation,
  printWithConcurrentTerminal,
  resumeInterimAnimation,
  startInterimAnimation,
  stopInterimAnimation,
} = createTutorStubInterimController({
  buildHumanDiscourseFrame,
  buildLightweightDialogueField,
  buildTutorDagSnapshot,
  colors: C,
  committedReleaseRows,
  currentReleaseRows,
  dagProgressFeatures,
  displayDiagnosticLabel,
  factSurface,
  formatEngagementStanceDistribution: (...values) => formatEngagementStanceDistribution(...values),
  getPresentation: () => cliPresentation,
  lightweightFieldTurn,
  nextReleaseRow,
  output,
  plainStrategyText,
  scoreValue,
  write: (text) => process.stdout.write(text),
});

const {
  appendTraceEvent,
  appendTutorStubTurnFailureTraceRecords,
  createTraceState,
  jsonClone,
  printAutomaticTechnicalDetails,
  reserveProgram2ProviderBudget,
  reserveTutorStubMeteredModelCall,
  restoreDialogueFromTrace,
  traceDisplayPath,
} = createTutorStubTraceRuntime({
  ROOT,
  advanceTutorStubDialogueClosure,
  answerTermForWorld,
  applyLearnerRecordUpdate,
  auditTutorStubDialogueClosureResponse,
  buildTutorStubDialogueClosureFrame,
  buildTutorStubTurnFailureTraceEvents,
  captureGitProvenanceSummary,
  captureTutorStubRunProvenance,
  formatTurnDebugId,
  fs,
  getSelectedLabModelCallBudget: () => selectedLabModelCallBudget,
  hashCanonicalJson,
  learnerPublicEvidenceState,
  openingDebugId,
  path,
  printTutorStubAutomaticTechnicalDetails,
  printWithConcurrentTerminal,
  program2ProviderBudget,
  redactTraceSecrets,
  replayTutorStubLearnerDagFromTurns,
  resolveWorkspacePath,
  restoreComprehensionState,
  restoreDirectorGuidanceState,
  restoreRegisterStateFromTurns,
  restoreTypedActionState,
  safeTimestampForFile,
  tutorStubTraceDisplayPath,
});

function streamLabel(role) {
  return renderTutorStubStreamLabel(role, C);
}

function createConsoleTokenSink(role, interim = null) {
  return createTutorStubConsoleTokenSink({
    role,
    interim,
    resolveInterimState: getInterimState,
    stopInterimAnimation,
    clearStatusLine,
    write: (text) => process.stdout.write(text),
    renderLabel: streamLabel,
  });
}

function replayTextAsConsoleStream(role, text, stream = null) {
  return replayTutorStubTextAsConsoleStream(role, text, stream, { createSink: createConsoleTokenSink });
}

function printTutorResponse(response, stream = null) {
  if (response.guardedStreamReplay) {
    response.streamed = replayTextAsConsoleStream('tutor_stub_tutor', response.text, stream);
    return;
  }
  if (!response.streamed) {
    console.log(`${C.brightMagenta}${C.bold}tutor >${C.reset} ${response.text.trim()}`);
  }
}

const {
  evaluatePendingRegisterEfficacy,
  explicitPerformanceActorialPartSelection,
  explicitPerformanceDirectiveValue,
  formatEngagementStanceDistribution,
  normalizeResponseConfigurationSelection,
  performanceTemperatureScope,
  policySamplingContext,
  randomPerformanceActorialPartSelection,
  registerSelectionFromCombinedAnalysis,
  resolveTutorStubCharacterChoice,
} = createTutorStubResponsePolicy({
  DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
  DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD,
  DYNAMICAL_SYSTEM_REGISTER_AFFINITY,
  DYNAMICAL_SYSTEM_TEMPERATURE,
  EXPLICIT_PERFORMANCE_CLEAR_WORDS,
  NEGATIVE_FLOOR_REGISTERS,
  TUTOR_STUB_REGISTER_POLICY_COMPOSITION_SCHEMA,
  args,
  automatedLearnerProfileId,
  buildContinuousEngagementStanceVector,
  buildContinuousRegisterPolicyMetadata,
  buildDynamicalSystemRegisterScores,
  buildFieldRegisterScores,
  buildStateRegisterScores,
  buildTrajectoryRegisterScores,
  buildTutorStubLightAdaptationDecision,
  buildTutorStubResponseConfiguration,
  committedReleaseRows,
  continuousEngagementStanceInstruction,
  currentReleaseRows,
  displayDiagnosticLabel,
  evaluateTutorStubRegisterPolicyOverlay,
  getActorialPartDefinitions,
  getEngagementStanceDefinition,
  getEngagementStanceDefinitions,
  getRegisterOntologyVersion,
  hasExplicitStepwiseSignal,
  latestFieldStateMismatch,
  latestRegisterSelection,
  normalizeEngagementStanceDistribution,
  normalizeTutorStubActorialPartId,
  numberOr,
  oneLine,
  preferredLegacyRegister,
  recentRegisterCount,
  registerAffinityContributions,
  registerEfficacyFromDagProgress,
  registerTemperatureApplies,
  resolveEngagementStance,
  resolveTutorStubDiscoursePlane,
  roundField,
  sampleTutorStubPolicyDistribution,
  selectTutorStubActorialPart,
  topNumericEntries,
  tutorStubComprehensionFeatures,
  tutorStubConfigurableActorialPartIds,
  tutorStubRandomizableActorialPartIds,
  tutorStubRegisterPolicyStackId,
  tutorStubReleasePacingSnapshot,
});

const {
  analyzeLearnerTurn,
  applyConversationalCompletionForLearnerTurn,
  applyLearnerAdvanceAssessment,
  classificationFromCombinedAnalysis,
  extractCombinedLearnerAnalysis,
  learnerRecordFromCombinedAnalysis,
  resolveConversationalCompletionForLearnerTurn,
  tutorStubNewEvidenceAvailable,
  updateComprehensionForLearnerTurn,
} = createTutorStubLearnerAnalysisRuntime({
  CLASSIFIER_SYSTEM_PROMPT,
  LEARNER_RECORD_SYSTEM_PROMPT,
  TUTOR_STUB_PUBLIC_LEARNER_ANALYSIS_PARSE_MODES,
  applyLearnerRecordUpdate,
  applyTutorStubComprehensionRequest,
  applyTutorStubConversationalCompletionSelection,
  applyTutorStubDagFactDropout,
  applyTutorStubLearnerAdvanceAssessment,
  appendTraceEvent,
  assertTutorStubTurnAttemptCurrent,
  buildLearnerDag,
  buildLearnerDagSnapshot,
  buildLearnerProxyDagMemory,
  buildTutorLearnerDagModel,
  buildTutorStubLearnerAdvance,
  buildTutorStubPublicLearnerAnalysisPrompt,
  callPromptModel,
  classifierWorldContext,
  colors: C,
  committedReleaseRows,
  compactPublicTranscriptForPrompt,
  detectTutorStubComprehensionRequest,
  displayDiagnosticLabel,
  engagementStancePalettePromptRows,
  engagementStanceSelectionPolicyPrompt,
  evaluatePendingRegisterEfficacy,
  extractTutorStubPublicLearnerAnalysis,
  factSurface,
  factText,
  failedClassification,
  formatEngagementStanceDistribution,
  formatSignedInterimNumber,
  freezeTutorStubLearnerRecordUpdateForDiscoursePlane,
  humanDiscourseExtractionSchema,
  latestTutorMessage,
  learnerDagPreflightForTurn,
  learnerDagPromptSummary,
  learnerPublicEvidenceState,
  normalizeHumanDiscourseExtraction,
  normalizeResponseConfigurationSelection,
  parseClassifierJson,
  printAutomaticTechnicalDetails,
  printLine: (line) => console.log(line),
  printTurnDebugLine,
  printWithConcurrentTerminal,
  projectTutorStubDagMemoryReliability,
  projectTutorStubLearnerClassificationLines,
  projectTutorStubLearnerDagLines,
  projectTutorStubResponseConfigurationLines,
  publicReleaseLedger,
  registerHistoryPromptSummary,
  registerSelectionFromCombinedAnalysis,
  requestTypePromptRows,
  resolveTutorStubConversationalCompletion,
  resolveTutorStubDiscoursePlane,
  scoreValue,
  startInterimAnimation,
  stopInterimAnimation,
  tutorStubComprehensionPrompt,
  tutorStubComprehensionSnapshot,
  tutorStubReleasePacingSnapshot,
  tutorStubReleaseScheduleExhausted,
  tutorStubTurnFeedbackRegisterPrompt,
  updateReleasePacingForLearnerTurn,
});

// Opt-in manner switch (TUTOR_STUB_MANNER_SWITCH=1): butler ↔ exacting
// schoolmaster, driven by deterministic learner-pressure classification with
// pacing-style hysteresis. Advanced here beside release pacing so every
// learner-turn path updates it; the pipeline reads state.mannerSwitch.card.
const MANNER_SWITCH_ENABLED = process.env.TUTOR_STUB_MANNER_SWITCH === '1';

// TUTOR_STUB_MANNER_TRIGGER=<artifact.json> selects a trigger version
// (config/manner-trigger/); unset uses the built-in v1 patterns.
const MANNER_TRIGGER_PATH = process.env.TUTOR_STUB_MANNER_TRIGGER || null;

// Phase Q1: TUTOR_STUB_QUIET_CHECK=<gap> arms the scheduled quiet check —
// after <gap> consecutive pressure-silent learner turns, one quiet-repair
// card. Requires the manner switch (the classifier supplies "silent").
const QUIET_CHECK_GAP = Number(process.env.TUTOR_STUB_QUIET_CHECK) || 0;

// Phase Q2: TUTOR_STUB_QUIET_DETECTOR=1 arms the typed quiet-state
// detector — confusion, flatness, or quiet defiance on a pressure-silent
// turn hands the tutor that state's typed card. Requires the manner switch.
const QUIET_DETECTOR_ENABLED = process.env.TUTOR_STUB_QUIET_DETECTOR === '1';

// Phase H1: TUTOR_STUB_CARD_EXEMPLARS=1 appends a worked example of the
// move's shape to cards that carry one (currently: demand). The cards
// version travels in every switch trace so arms never pool across it.
const CARD_EXEMPLARS_ENABLED = process.env.TUTOR_STUB_CARD_EXEMPLARS === '1';

// Phase S2: TUTOR_STUB_CARD_LICENCE=1 adds the scoped contract exception to
// cards that carry one (currently: demand). Leak audits are co-primary.
const CARD_LICENCE_ENABLED = process.env.TUTOR_STUB_CARD_LICENCE === '1';

// Phase L2: TUTOR_STUB_CARD_DOSE_LADDER=1 escalates a state's card one dose
// step each time that state RECURS after a carded moment (the repair missed
// for this learner): dose 1 = card, 2 = +exemplar, 3 = +exemplar+licence.
// Dial-setting only — no learner description enters any prompt.
const CARD_DOSE_LADDER = process.env.TUTOR_STUB_CARD_DOSE_LADDER === '1';
// TUTOR_STUB_CARD_FORCE='9=settled_claim,10=stake' (crossed-effects arms).
const CARD_FORCE_MAP = (() => {
  const raw = process.env.TUTOR_STUB_CARD_FORCE;
  if (!raw) return null;
  const map = new Map();
  for (const part of raw.split(',')) {
    const [turn, card] = part.split('=').map((x) => x.trim());
    if (turn && card) map.set(Number(turn), card);
  }
  return map.size ? map : null;
})();
let mannerTriggerCache;
function activeMannerTrigger() {
  if (!MANNER_TRIGGER_PATH) return null;
  if (mannerTriggerCache === undefined) {
    mannerTriggerCache = compileTutorStubTriggerArtifact(
      JSON.parse(fs.readFileSync(path.resolve(MANNER_TRIGGER_PATH), 'utf8')),
    );
  }
  return mannerTriggerCache;
}

function updateMannerSwitchForLearnerTurn({ learnerText, state, tutorTurn, recordTrace = true }) {
  if (!MANNER_SWITCH_ENABLED || !state) return null;
  state.mannerSwitch = state.mannerSwitch || createTutorStubMannerSwitchState(activeMannerTrigger());
  advanceTutorStubMannerSwitch(state.mannerSwitch, { learnerText, turn: tutorTurn });
  let cardOptions = { exemplars: CARD_EXEMPLARS_ENABLED, licence: CARD_LICENCE_ENABLED };
  if (CARD_DOSE_LADDER) {
    // Recurrence of a previously-carded state = the repair missed for this
    // learner; that state's dose climbs one step (1 card, 2 +exemplar,
    // 3 +exemplar+licence). Stamped in the switch trace event.
    state.cardDose = state.cardDose || {};
    const dosePressure = state.mannerSwitch.lastAdvance?.pressure;
    if (dosePressure && dosePressure !== 'neutral' && dosePressure !== 'concession') {
      const entry = (state.cardDose[dosePressure] = state.cardDose[dosePressure] || { seen: 0, dose: 1 });
      if (entry.seen > 0) entry.dose = Math.min(3, entry.seen + 1);
      entry.seen += 1;
      cardOptions = { exemplars: entry.dose >= 2, licence: entry.dose >= 3 };
      state.mannerSwitch.currentDose = entry.dose;
    } else {
      state.mannerSwitch.currentDose = null;
    }
  }
  state.mannerSwitch.card = tutorStubMannerCard(state.mannerSwitch, cardOptions);
  // Crossed-effects experiment knob (card: adaptive-causality-crossed-effects).
  // TUTOR_STUB_CARD_FORCE='9=settled_claim,10=stake' forces the named card
  // at the named tutor turn regardless of detection ('none' suppresses).
  // Fixed/random/oracle policies are realized by the launcher setting this
  // per dialogue; the router arm leaves it unset. Stamped in-trace.
  if (CARD_FORCE_MAP && CARD_FORCE_MAP.has(tutorTurn)) {
    const forced = CARD_FORCE_MAP.get(tutorTurn);
    const naturalCard = state.mannerSwitch.card;
    state.mannerSwitch.card =
      forced === 'none'
        ? null
        : forced.startsWith('quiet:')
          ? tutorStubQuietStateCard(forced.slice(6))
          : tutorStubMannerCard({ lastAdvance: { pressure: forced } }, cardOptions);
    if (recordTrace) {
      appendTraceEvent(state.trace, {
        type: 'tutor_card_force',
        turn: tutorTurn,
        forced,
        displacedNaturalCard: Boolean(naturalCard),
        cardActive: Boolean(state.mannerSwitch.card),
      });
    }
  }
  // Phase Q2 (TUTOR_STUB_QUIET_DETECTOR=1): typed quiet-state detection on
  // card-silent turns. A move card outranks it — pressure is never quiet.
  if (QUIET_DETECTOR_ENABLED && !state.mannerSwitch.card) {
    state.quietDetector = state.quietDetector || createTutorStubQuietDetectorState();
    const detection = detectTutorStubQuietState(state.quietDetector, learnerText, {
      pressure: state.mannerSwitch.lastAdvance?.pressure || null,
    });
    state.mannerSwitch.card = tutorStubQuietStateCard(detection.type);
    if (recordTrace) {
      appendTraceEvent(state.trace, {
        type: 'tutor_quiet_detect',
        turn: tutorTurn,
        quietType: detection.type,
        version: state.quietDetector.version,
        cardActive: Boolean(state.mannerSwitch.card),
      });
    }
  }
  // Phase Q1 (TUTOR_STUB_QUIET_CHECK=<gap>): harness-timed quiet-repair card
  // on long pressure-silent stretches. A move card outranks it — pressure is
  // never quiet — so the quiet card fills only card-silent turns.
  if (QUIET_CHECK_GAP && !state.mannerSwitch.card) {
    state.quietCheck = state.quietCheck || createTutorStubQuietCheckState({ gapAt: QUIET_CHECK_GAP });
    advanceTutorStubQuietCheck(state.quietCheck, {
      turn: tutorTurn,
      pressure: state.mannerSwitch.lastAdvance?.pressure || null,
    });
    state.mannerSwitch.card = tutorStubQuietCheckCard(state.quietCheck);
    if (recordTrace) {
      appendTraceEvent(state.trace, {
        type: 'tutor_quiet_check',
        schema: TUTOR_STUB_QUIET_CHECK_SCHEMA,
        turn: tutorTurn,
        ...state.quietCheck.lastAdvance,
        cardActive: Boolean(state.mannerSwitch.card),
      });
    }
  } else if (QUIET_CHECK_GAP && state.quietCheck) {
    // Pressure turn: the quiet counter resets through advance so stretches
    // are measured between pressures, not across them.
    advanceTutorStubQuietCheck(state.quietCheck, {
      turn: tutorTurn,
      pressure: state.mannerSwitch.lastAdvance?.pressure || 'pressure',
    });
  }
  if (recordTrace) {
    appendTraceEvent(state.trace, {
      type: 'tutor_manner_switch',
      schema: TUTOR_STUB_MANNER_SWITCH_SCHEMA,
      turn: tutorTurn,
      ...state.mannerSwitch.lastAdvance,
      cardActive: Boolean(state.mannerSwitch.card),
      cardsVersion: CARD_DOSE_LADDER
        ? 'mc-v4-dose-ladder'
        : CARD_LICENCE_ENABLED
          ? TUTOR_STUB_MOVE_CARDS_LICENCE_VERSION
          : CARD_EXEMPLARS_ENABLED
            ? TUTOR_STUB_MOVE_CARDS_EXEMPLAR_VERSION
            : TUTOR_STUB_MOVE_CARDS_VERSION,
      dose: state.mannerSwitch.currentDose ?? null,
    });
  }
  return state.mannerSwitch;
}

function updateReleasePacingForLearnerTurn({
  learnerText,
  state,
  classification,
  tutorLearnerDag,
  tutorTurn,
  recordTrace = true,
}) {
  updateMannerSwitchForLearnerTurn({ learnerText, state, tutorTurn, recordTrace });
  // Frozen pacing (TUTOR_STUB_RELEASE_PACING=fixed): the stress bench needs a
  // controlled timetable — planted impatience otherwise reads as an accelerate
  // signal and compresses the world, giving arms unequal plant exposure
  // (observed 2026-07-31: a book arm closed at turn 15 and saw 4 of 11
  // plants). Freezing blinds the pacing engine's signal inputs; the authored
  // schedule runs at speed 1.
  const pacingFrozen = process.env.TUTOR_STUB_RELEASE_PACING === 'fixed';
  const releasePacing = advanceTutorStubReleasePacing({
    pacing: state.releasePacing,
    world: state.world,
    turn: tutorTurn,
    learnerText: pacingFrozen ? '' : learnerText,
    classification: pacingFrozen ? null : classification,
    tutorLearnerDag,
    conversationalCompletion: pacingFrozen ? null : tutorLearnerDag?.conversationalCompletion || null,
  });
  if (!releasePacing) return null;
  if (recordTrace) {
    appendTraceEvent(state.trace, {
      type: 'release_pacing_update',
      ...(pacingFrozen ? { pacingFrozen: true } : {}),
      turn: tutorTurn,
      direction: releasePacing.direction,
      baseSpeed: releasePacing.baseSpeed,
      effectiveSpeed: releasePacing.effectiveSpeed,
      signal: releasePacing.signal,
      dueNow: releasePacing.dueNow,
      nextRelease: releasePacing.nextRelease,
      releasePacing,
    });
  }
  return releasePacing;
}

function responseConfigurationContext(
  selection,
  { multipleChoice = false, humanDiscourseFrame = null, dialogueClosureFrame = null, world = null } = {},
) {
  return projectTutorStubResponsePolicyContext(selection, {
    multipleChoice,
    humanDiscourseFrame,
    dialogueClosureFrame,
    world,
    ledgerTerm: worldLedgerTerm(world),
  });
}

function tutorPromptSurfaceKey(value) {
  return String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function tutorLearnerDagModelContext(result, { releasedEvidence = [] } = {}) {
  return projectTutorStubLearnerDagModelContext(result, { releasedEvidence });
}

function humanDiscourseTutorContext(frame, { includeQuestionSupport = true, includeDefaultResponseShape = true } = {}) {
  return projectTutorStubHumanDiscourseContext(frame, { includeQuestionSupport, includeDefaultResponseShape });
}

function dialogueClosureTutorContext(frame) {
  return projectTutorStubDialogueClosureContext(frame);
}

function createLearnerDagState({ enabled, modelRef = null, resolved, world, dropout = null }) {
  const board = new Map();
  if (world) {
    for (const fact of world.background || []) board.set(factKey(fact), fact);
  }
  return {
    enabled,
    modelRef,
    resolved,
    dropout: createTutorStubDagFactDropoutState(dropout || {}),
    record: {
      board,
      voiced: [],
      voicedKeys: new Set(),
      hypotheses: [],
      snapshots: [],
    },
  };
}

function tutorMessageContext(state, history) {
  return buildTutorStubTutorMessageContext(history, {
    modelRef: state?.modelRef || null,
    activatedBy: state?.tutorContext?.activatedBy || 'session_start',
  });
}

function compactPublicTranscriptForPrompt(state, limit, { includeAnalysis = true } = {}) {
  return projectTutorStubCompactPublicTranscript(state?.turns || [], limit, {
    memoryEnabled: Boolean(state?.memory?.enabled),
    historyTurns: state?.historyTurns ?? STUB.historyTurns,
    includeAnalysis,
  });
}

function classifierTutorContext(classification) {
  return projectTutorStubLearnerClassifierContext(classification);
}

function buildTutorDagSnapshot(state, tutorTurn) {
  if (!state.dag || !state.world || !state.tutorDag) return null;
  return projectTutorStubDagSnapshot({
    dag: state.tutorDag,
    world: state.world,
    tutorTurn,
    releasedRows: committedReleaseRows(state, tutorTurn),
    nextRelease: nextReleaseRow(state),
  });
}

function printTutorDagSnapshot(snapshot) {
  for (const line of projectTutorStubDagSnapshotLines({ snapshot, colors: C })) console.log(line);
}

function printTutorStubFeatureMap(state = null) {
  const featureRows = tutorStubCapabilityFeatureRows(state?.capabilities || null);
  let activeContext = null;
  if (state) {
    const mode = state.passthrough?.enabled ? 'passthrough' : state.interaction?.mode || 'learner';
    const content = state.curriculum?.module?.title
      ? `curriculum: ${state.curriculum.module.title}`
      : state.world?.title
        ? `scenario: ${state.world.title}`
        : `topic: ${state.topic}`;
    const hiddenAlwaysOnCapabilities = new Set(['public_dialogue', 'presentation', 'transcript']);
    const activeMechanisms = (state.capabilities?.active || [])
      .filter((id) => !hiddenAlwaysOnCapabilities.has(id))
      .map((id) => state.capabilities.capabilities[id]?.label)
      .filter(Boolean);
    activeContext = { mode, content, mechanisms: activeMechanisms };
  }
  const lines = projectTutorStubFeatureMapLines({ featureRows, activeContext, colors: C });
  for (const line of lines) console.log(line);
}

function printInteractiveHelp(state = null) {
  const mode = state?.passthrough?.enabled ? 'passthrough' : 'normal';
  const commandOptions = { mode, capabilities: state?.capabilities || null };
  const commandAvailability =
    mode === 'normal'
      ? Object.fromEntries(
          ['/feedback', '/committee', '/random', '/suggest', '/board', '/proof'].map((token) => [
            token,
            tutorStubCommandAvailable(token, commandOptions),
          ]),
        )
      : {};
  const lines = projectTutorStubInteractiveHelpLines({
    mode,
    helpRows: tutorStubCommandHelpRows(commandOptions),
    commandAvailability,
    learningSummaryActive: Boolean(state?.capabilities?.capabilities?.learning_summary?.active),
    colors: C,
  });
  for (const line of lines) {
    console.log(line);
  }
}

function printTutorStubReleaseNotes(hoursArg = '') {
  const hours = normalizeTutorStubReleaseNotesHours(hoursArg);
  const notes = loadTutorStubReleaseNotes({ cwd: ROOT, hours });
  const lines = projectTutorStubReleaseNotesLines({ notes, colors: C });
  for (const line of lines) console.log(line);
  return notes;
}

function registerTemperatureApplies(policy) {
  return REGISTER_TEMPERATURE_POLICIES.has(String(policy || ''));
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
  for (const line of lines) console.log(line);
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
    for (const line of projectTutorStubTechnicalDebugLines({ colors: C })) console.log(line);
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
  for (const line of lines) console.log(line);
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
    console.log(`${C.brightBlue}${C.bold}debug >${C.reset} no completed turns yet\n`);
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
    console.log(`${C.brightBlue}${C.bold}debug >${C.reset} turn ${turn.turn} · prose${generated ? '' : ' fallback'}`);
    console.log(`${C.dim}${prose}${C.reset}`);
    console.log(`${C.dim}  technical evidence: /debug technical · stop: /debug off${C.reset}\n`);
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
  for (const line of lines) console.log(line);
}

function printLightweightDialogueField(state) {
  const field = state.turns.length ? buildLightweightDialogueField(state.turns) : null;
  for (const line of projectTutorStubLightweightFieldLines(field, { colors: C })) console.log(line);
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
    for (const line of projectTutorStubFieldVisualizationLines(null, { colors: C })) console.log(line);
    return null;
  }
  const result = writeFieldVisualization(state, { reason, force: true });
  if (!result) return null;
  for (const line of projectTutorStubFieldVisualizationLines(result, { colors: C })) console.log(line);
  return result;
}

function printDialogueCloseout(state, { reason = 'report', trace = state.trace } = {}) {
  const tracePath = traceDisplayPath(trace);
  if (!state.turns.length) {
    for (const line of projectTutorStubCloseoutReportLines({ reason, tracePath, colors: C })) console.log(line);
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
  for (const line of lines) console.log(line);
  return payload;
}

function dagTurnContext(state, tutorTurn, tutorLearnerDagModel = null) {
  const world = state?.world;
  if (!world) return '';
  const learnerDagModel = tutorLearnerDagModel?.model || tutorLearnerDagModel || null;
  const learnerGroundedSurfaceKeys = new Set(
    (learnerDagModel?.learnerRecord?.grounded || []).map((row) => tutorPromptSurfaceKey(row?.surface)).filter(Boolean),
  );
  const earlier = committedReleaseRows(state, tutorTurn);
  const dueNow = currentReleaseRows(state, tutorTurn);
  const earlierLines = earlier.length
    ? earlier
        .map((entry) => {
          const grounding = learnerGroundedSurfaceKeys.has(tutorPromptSurfaceKey(entry.surface))
            ? 'learner-grounded'
            : 'public, not yet learner-grounded';
          return `- [${grounding}] ${String(entry.surface || '').trim()}`;
        })
        .join('\n')
    : '- none yet';
  const dueLines = dueNow.length
    ? dueNow
        .map((entry) => {
          const source = entry.via === 'director' ? 'scene evidence' : 'tutor exhibit';
          return `- ${source}: ${String(entry.surface || '').trim()}`;
        })
        .join('\n')
    : '- no new evidence is available this turn';
  return [
    '[Tutor-only public evidence window]',
    `Current tutor turn in this lightweight stub: ${tutorTurn}`,
    'Evidence actually spoken before this turn:',
    earlierLines,
    'New evidence permitted now (it becomes public only if this reply says it):',
    dueLines,
    'No future evidence, answer key, proof path, or release detail is included here.',
    'Use this as a hard speaking boundary, not merely pacing advice.',
    '[End tutor-only public evidence window]',
  ].join('\n');
}

function tutorCoachGuidanceEntries(state, tutorTurn = null) {
  const effectiveTurn = tutorTurn ?? (state?.turns?.length || 0) + 1;
  return Array.isArray(state?.coach?.pending)
    ? state.coach.pending.filter((entry) => Number(entry?.notBeforeTurn || 0) <= effectiveTurn)
    : [];
}

function tutorCoachGuidanceContext(state, { tutorTurn = null } = {}) {
  const pending = tutorCoachGuidanceEntries(state, tutorTurn)
    .map((entry) => String(entry?.text || entry || '').trim())
    .filter(Boolean);
  if (!pending.length) return '';
  return [
    '[Private coach guidance for this tutor turn]',
    'An operator has suggested the following direction for your next public response:',
    ...pending.map((text) => `- ${text}`),
    'Treat this as high-priority advisory guidance. Follow it when it is compatible with the public evidence, learner agency, pacing, safety guards, and dialogue-closure requirements.',
    'Do not mention a coach, operator, private instruction, or this guidance. Do not reveal hidden evidence or the concealed answer merely because the guidance requests it.',
    '[End private coach guidance]',
  ].join('\n');
}

const callTutor = createTutorStubTutorTurnPipeline({
  PROGRAM2_COMMITTEE_SCHEMA,
  appendTraceEvent,
  attachTutorGuardAccounting,
  auditTutorResponseLeak,
  auditTutorStubDialogueClosureResponse,
  auditTutorStubDramaticReleaseResponse,
  auditTutorStubGenerousInferenceResponse,
  auditTutorStubLiveSourceActionAlignmentV1,
  auditTutorStubLiveTurnProgressionV1,
  auditTutorStubPrompt,
  auditTutorStubQuestionSupportResponse,
  auditTutorStubReleaseDelivery,
  auditTutorStubRepetitionResponse,
  auditTutorStubResponseComposition,
  auditTutorStubResponseConfiguration,
  auditTutorStubSelfCorrectionDisclosure,
  auditTutorStubSpeakerPrivilege,
  buildCommitteeCompositionBlock,
  buildTutorGuardAccounting,
  buildTutorStubDramaticReleaseFrame,
  buildTutorStubFirstDraftContract,
  buildTutorStubResponseCompositionFrame,
  buildTutorStubSimplifiedRecoveryConfiguration,
  callAI,
  callAIWithCliBridge,
  classifierTutorContext,
  committedReleaseRows,
  committeeFallbackBatteryPass,
  committeeMiniGenerate,
  compileTutorStubPerformanceObligationContract,
  composeTutorStubFallbackWithUptake,
  composeTutorStubGuardUptakeDevelopment,
  createConsoleTokenSink,
  currentReleaseRows,
  dagTurnContext,
  detectTutorStubSelfCorrectionDisclosure,
  deterministicGenerousInferenceFallback,
  deterministicTutorStubClosureResponse,
  deterministicTutorStubConfiguredContinuationFallback,
  deterministicTutorStubContextualFallback,
  deterministicTutorStubDramaticReleaseFallback,
  deterministicTutorStubLearnerUptake,
  deterministicTutorStubTurnProgressionHandoff,
  deterministicTutorStubTurnProgressionUptake,
  deterministicTutorStubWritableEntryUptake,
  exactTutorRepairSpans,
  formatTutorStubResponseComposition,
  humanDiscourseTutorContext,
  isCliProvider,
  jsonClone,
  prepareTutorStubDueClueUptake,
  providerSupportsStreaming,
  reconcileTutorStubPointOfActionHandoffEligibility,
  recoverTutorStubDuplicateInstructionLines,
  recoverTutorStubSpeakerPrompt,
  repairTutorStubMissingActorialPart,
  repairTutorStubMissingClarificationInvitation,
  repairTutorStubThirdPersonSourceLeadIn,
  repairTutorStubUnanswerableOpenRecall,
  reserveProgram2ProviderBudget,
  reserveTutorStubMeteredModelCall,
  resolveTutorStubPublicCounterpressure,
  runCommitteeBattery,
  sanitizeTutorStubSpeakerAdvisory,
  selectCommitteeCompositionQuestion,
  snapshotTutorStubPublicPremiseIds,
  speakerAdvisoryBlocks: SPEAKER_ADVISORY_BLOCKS,
  styleGuardsAdvisory: process.env.TUTOR_STUB_STYLE_GUARDS_ADVISORY === '1',
  guardBoundaryPolicy: process.env.TUTOR_STUB_GUARD_POLICY === 'shadow_advisory' ? 'shadow_advisory' : 'strict',
  // Q3: TUTOR_STUB_CORRUPT_RELIEF=1 demotes ALL hard guard issues to
  // advisory at deliberately-corrupted turns so the model's repair ships.
  corruptReliefTurn: (turn) => process.env.TUTOR_STUB_CORRUPT_RELIEF === '1' && Boolean(CORRUPT_TURNS[turn]),
  // Untangling 1: TUTOR_STUB_CLUE_INSERTION=1 keeps the model draft at
  // release-only failures and appends the due clue's rendered sentences.
  clueInsertion: process.env.TUTOR_STUB_CLUE_INSERTION === '1',
  composeClueSpanReplacement: composeTutorStubClueSpanReplacement,
  // Phase S revisit: TUTOR_STUB_CARD_AFTER_LEARNER=1 places the manner card
  // after the learner's line — the last thing the model reads (P1 finding).
  cardAfterLearner: process.env.TUTOR_STUB_CARD_AFTER_LEARNER === '1',
  renderTutorStubDueSource,
  stateRunDebugId,
  streamAI,
  trimCommitteeFallback,
  tutorCoachGuidanceContext,
  tutorGuardAttemptEnvelope,
  tutorLearnerDagModelContext,
  tutorMessageContext,
  tutorResponseRecoveryPrompt,
  tutorStubActorialPerformanceMayBeAdvisory,
  tutorStubComprehensionPrompt,
  tutorStubDirectorGuidancePrompt,
  tutorStubDisclosableGuardCorrection,
  tutorStubFirstDraftContractPrompt,
  tutorStubGuardDeliveryDecision,
  tutorStubGuardIssueRows,
  tutorStubLearnerRequestedPlainStyle,
  tutorStubLearnerSelectedToolMarkPath,
  tutorStubLiveResponseConfigurationSurface,
  tutorStubPlainRecoveryAllowsActorialAdvisory,
  tutorStubPointOfActionPrompt,
  tutorStubPointOfActionTargetText,
  tutorStubSelfCorrectionDisclosurePrompt,
  tutorStubSimplifiedRecoveryPrompt,
  tutorStubSubstantiveLearnerEcho,
  tutorStubTerminalFallbackFailureMessage,
  tutorStubTuningTurnAdvisory,
  tutorStubTurnFeedbackPrompt,
  worldLedgerTerm,
});

function saveTranscript(filePath, transcript) {
  fs.writeFileSync(filePath, `${JSON.stringify(transcript, null, 2)}\n`);
}

function publicWorldSummary(world) {
  if (!world) return 'No detective-story world is active; respond to the tutor topic directly.';
  return [
    `World: ${world.id} - ${world.title}`,
    `Discipline: ${world.discipline || 'investigation'}`,
    `Public question: ${world.question || world.publicQuestion || 'unknown'}`,
    'Opening situation:',
    String(world.openingFrame?.situation || world.setting || world.opening || world.openingSituation || '').trim() ||
      '(none supplied)',
    world.learnerVoice ? `Learner voice: ${world.learnerVoice}` : null,
    ...dramaticAudiencePromptLines(world),
  ]
    .filter(Boolean)
    .join('\n');
}

function latestTutorMessage(state) {
  return [...(state?.history || [])].reverse().find((message) => message.role === 'assistant')?.content || '';
}

function buildTutorClarificationPrompt({ state, term = '' }) {
  const latestTutor = latestTutorMessage(state);
  const requestedTerm = String(term || '').trim();
  const comprehensionContext = tutorStubComprehensionPrompt(state.comprehension, {
    turn: state.turns.length,
  });
  return [
    '# Public scene',
    '',
    publicWorldSummary(state.world),
    '',
    '# Public transcript',
    '',
    compactPublicTranscriptForPrompt(state, state.historyTurns, { includeAnalysis: false }),
    '',
    '# Latest line to clarify',
    '',
    latestTutor || '(No tutor message is available yet.)',
    '',
    '# Learner clarification request',
    '',
    requestedTerm
      ? `Explain this term or phrase from the line above: "${requestedTerm}".`
      : 'No term was supplied. Pick up to three likely confusing words or phrases from the latest tutor message and explain them.',
    comprehensionContext || null,
    '',
    '# Output rules',
    '',
    '- Use only public wording already in the transcript.',
    '- Do not add new evidence, new suspects, hidden conclusions, or next proof steps.',
    '- Prefer one short paragraph, or at most three bullets.',
    '- If the requested term is not in the latest tutor message or public transcript, say so briefly and ask which phrase the learner means.',
    '- If the latest line ended with a question, explain the wording and then restate that live question directly. Never say that a tutor question is "pending".',
  ]
    .filter((line) => line !== null)
    .join('\n');
}

function cleanClarificationReply(text, latestTutor = '') {
  const cleaned = String(text || '')
    .replace(/^```(?:text|markdown)?/iu, '')
    .replace(/```$/u, '')
    .replace(/^\s*(clarify|clarification|explain|explanation)\s*:\s*/iu, '')
    .trim();
  return cleanTutorStubClarificationSpeech(cleaned, latestTutor);
}

async function generateTutorClarification({ state, term = '', resolved, cliEffort = null, signal = null }) {
  const raw = await callPromptModel({
    prompt: buildTutorClarificationPrompt({ state, term }),
    resolved,
    systemPrompt: CLARIFIER_SYSTEM_PROMPT,
    role: 'tutor_stub_clarifier',
    maxTokens: 500,
    trace: state.trace,
    stream: { enabled: false },
    cliEffort,
    turn: state.turns.length,
    signal,
  });
  return {
    ...raw,
    text: cleanClarificationReply(raw.text, latestTutorMessage(state)),
  };
}

async function generateTutorStubCurriculumTranslation({ state, levels, signal = null }) {
  const request = buildTutorStubCurriculumTranslationPrompt({
    module: state.curriculum?.module,
    levels,
  });
  const requestedMaxTokens = levels.length === 1 ? 1_600 : 3_800;
  const raw = await callPromptModel({
    prompt: request.prompt,
    resolved: state.resolved,
    systemPrompt: TUTOR_STUB_CURRICULUM_TRANSLATOR_SYSTEM_PROMPT,
    role: 'tutor_stub_curriculum_translator',
    maxTokens: Math.min(Number(state.maxTokens) || requestedMaxTokens, requestedMaxTokens),
    trace: state.trace,
    stream: { enabled: false },
    cliEffort: state.cliEffort,
    turn: state.turns.length,
    signal,
  });
  return {
    ...raw,
    translation: parseTutorStubCurriculumTranslation(raw.text, {
      module: state.curriculum.module,
      levels,
    }),
  };
}

async function generateTutorStubTutorOutputTranslation({ state, sourceText, levels, signal = null }) {
  const request = buildTutorStubTutorOutputTranslationPrompt({ text: sourceText, levels });
  const requestedMaxTokens = levels.length === 1 ? 900 : 2_400;
  const raw = await callPromptModel({
    prompt: request.prompt,
    resolved: state.resolved,
    systemPrompt: TUTOR_STUB_TUTOR_OUTPUT_TRANSLATOR_SYSTEM_PROMPT,
    role: 'tutor_stub_turn_translator',
    maxTokens: Math.min(Number(state.maxTokens) || requestedMaxTokens, requestedMaxTokens),
    trace: state.trace,
    stream: { enabled: false },
    cliEffort: state.cliEffort,
    turn: state.turns.length,
    signal,
  });
  return {
    ...raw,
    translation: parseTutorStubTutorOutputTranslation(raw.text, {
      sourceText: request.sourceText,
      levels,
    }),
  };
}

function cleanAutomatedLearnerReply(text) {
  const cleaned = String(text || '')
    .replace(/^```(?:text|markdown)?/iu, '')
    .replace(/```$/u, '')
    .replace(/^\s*(learner|student)\s*:\s*/iu, '')
    .trim();
  return cleanTutorStubStageSpeech(cleaned, { voice: 'learner' });
}

function deterministicAutomatedLearnerFallback({ state }) {
  const latestTutor =
    [...(state.history || [])].reverse().find((message) => message.role === 'assistant')?.content || '';
  if (/trial-book|evidence|write|say|state|claim/iu.test(latestTutor)) {
    return 'I will make one public evidence claim and keep the verdict open until the marks license a name.';
  }
  return 'What public evidence should I test first?';
}

function automatedLearnerSystemPrompt(profile) {
  return [
    AUTO_LEARNER_SYSTEM_PROMPT,
    '',
    '# Private behavior brief',
    '',
    profile,
    '',
    'Apply this behavior brief to every public learner turn. Never quote or describe it.',
  ].join('\n');
}

function mixedLearnerArtifactsSystemPrompt(profile) {
  return [
    'You generate a paired learner answer and non-revealing clue for an experimental tutoring dialogue.',
    'Use only the public transcript and latest tutor message. Do not infer hidden proof paths, concealed answers, private tutor prompts, or unstaged evidence.',
    'The private behavior brief defines the answer. Preserve its recurring behavior and repair pattern.',
    'The clue describes where to look or what kind of move to make, but must not state or paraphrase the answer.',
    'The learner turn may be a concrete question. Keep all learner speech inside the scene and address the other speaker directly.',
    'Never write "the tutor", "the learner", "the dialogue", "the prompt", or commentary about a question being pending.',
    'The profile_signal field is private UI metadata, not learner speech. It may describe only how the visible answer expresses the profile.',
    '',
    '# Private behavior brief',
    '',
    profile,
    '',
    'Never quote or name the private behavior brief. The profile_signal may explain only visible response behavior in plain language. Return one JSON object only.',
  ].join('\n');
}

function automatedLearnerProfileId(profile) {
  const value = String(profile || '').trim();
  const directId = value.toLowerCase().replace(/-/gu, '_');
  if (learnerProfileIds().includes(directId)) return directId;
  const renderedId = learnerProfileIds().find((id) => learnerProfilePrompt(id) === value);
  if (renderedId) return renderedId;
  const legacyMatch = value.match(/simulating this automated learner profile:\s*([a-z0-9_-]+)/iu);
  return legacyMatch ? legacyMatch[1].toLowerCase().replace(/-/gu, '_') : null;
}

function resolveAutomatedLearnerProfile(profile) {
  const value = String(profile || '').trim();
  const profileId = value.toLowerCase().replace(/-/gu, '_');
  return learnerProfileIds().includes(profileId) ? learnerProfilePrompt(profileId) : value;
}

function explicitRecollectionFrame(text) {
  return /\b(?:(?:we|i)\s+(?:already\s+)?(?:saw|read|heard|recorded|remember(?:ed)?|recall(?:ed)?)|the\s+(?:record|trial-book|book)\s+(?:already\s+)?(?:said|showed|recorded|proved))\b/iu.test(
    String(text || ''),
  );
}

function automatedLearnerMarkerValue(turn, field) {
  const classifier = turn?.classification?.turn || {};
  const fields = {
    requestType: classifier.request_type,
    discourseMove: classifier.discourse_move,
    evidenceUse: classifier.evidence_use,
    epistemicStance: classifier.epistemic_stance,
    agency: classifier.agency,
    explicitRecollection: explicitRecollectionFrame(turn?.learner),
  };
  return fields[field] ?? null;
}

function automatedLearnerMarkerMatches(turn, clause) {
  return clause.every((group) => (group.values || []).includes(automatedLearnerMarkerValue(turn, group.field)));
}

function publicTutorPressure(text) {
  return /\b(miraculously|marvelous|wonderful|conveniently|apparently|nice trick|escape route|safe performance|hiding behind|not doing the work|lets you avoid|pressing|do not stall|don['’]t stall|fog and vibes|answer vending machine|mob|jab|jabs)\b/iu.test(
    String(text || ''),
  );
}

function negativeRegisterPressure(selection) {
  return NEGATIVE_FLOOR_REGISTERS.includes(selection?.selected_register);
}

function automatedLearnerProfileRuntimeState({ state, profile, turnNumber }) {
  const profileId = automatedLearnerProfileId(profile);
  const contract = learnerProfileContract(profileId);
  const observability = contract?.observabilityContract;
  if (!contract || !observability) return null;
  const policy = state.register?.policy || 'unknown';
  const eligiblePolicies = observability.eligiblePolicies || ['*'];
  const policyEligible = eligiblePolicies.includes('*') || eligiblePolicies.includes(policy);
  const latestTutor =
    [...(state.history || [])].reverse().find((message) => message.role === 'assistant')?.content || '';
  const currentStimulusEligible =
    observability.eligibility === 'public_tutor_pressure'
      ? publicTutorPressure(latestTutor) || negativeRegisterPressure(state.turns?.at(-1)?.registerSelection)
      : true;
  const eligible = policyEligible && currentStimulusEligible;
  const clauses = observability.markerClauses || [];
  const completedTurns = state.turns || [];
  const openingTutor = state.history?.[0]?.role === 'assistant' ? state.history[0].content : '';
  const priorTurns = policyEligible
    ? completedTurns.filter((turn, index) => {
        if (observability.eligibility !== 'public_tutor_pressure') return true;
        const stimulus = index === 0 ? openingTutor : completedTurns[index - 1]?.tutor;
        const stimulusSelection = index === 0 ? null : completedTurns[index - 1]?.registerSelection;
        return publicTutorPressure(stimulus) || negativeRegisterPressure(stimulusSelection);
      })
    : [];
  const observed = priorTurns.filter((turn) =>
    clauses.some((clause) => clause.length && automatedLearnerMarkerMatches(turn, clause)),
  ).length;
  const mustShowByTurn = Number(observability.mustShowByTurn || 0);
  const targetRate = Number(observability.minEligibleRate || 0);
  const eligibleOpportunities = priorTurns.length + (eligible ? 1 : 0);
  const targetCount =
    eligible && (!mustShowByTurn || turnNumber >= mustShowByTurn) ? Math.ceil(eligibleOpportunities * targetRate) : 0;
  const deadlineDue = eligible && mustShowByTurn > 0 && turnNumber >= mustShowByTurn && observed === 0;
  const requiredNow = Boolean(eligible && (deadlineDue || observed < targetCount));
  return {
    profileId,
    contract,
    observability,
    eligible,
    priorEligibleTurns: priorTurns.length,
    observed,
    targetCount,
    mustShowByTurn,
    requiredNow,
  };
}

function automatedLearnerProfileRuntime({ state, profile, turnNumber }) {
  const runtime = automatedLearnerProfileRuntimeState({ state, profile, turnNumber });
  if (!runtime) return '';
  return [
    '# Private behavior cue',
    '',
    `The latest public tutor move ${runtime.eligible ? 'does' : 'does not'} trigger the recurring behavior in the brief.`,
    runtime.requiredNow
      ? `This turn MUST visibly perform the recurring behavior: ${runtime.contract.intent.failureOperator}. Do not combine it with a fully repaired or fully warranted answer in the same turn.`
      : 'This turn may repair or progress if the behavior brief permits, but the recurring behavior remains active later.',
    'This cue is private. Never mention briefs, triggers, profiles, markers, or experimental conditions publicly.',
  ].join('\n');
}

// Opt-in stress schedule (TUTOR_STUB_STRESS_SCHEDULE=<path>): planted learner
// states with adjudicated repairs. Loaded once, lazily; each planted turn's
// directive is injected into the learner prompt verbatim and traced, so the
// bench knows exactly which turns carry authored stress.
const STRESS_SCHEDULE_PATH = process.env.TUTOR_STUB_STRESS_SCHEDULE || null;
let stressScheduleCache;
function activeStressSchedule() {
  if (!STRESS_SCHEDULE_PATH) return null;
  if (stressScheduleCache === undefined) {
    stressScheduleCache = loadTutorStubStressSchedule(path.resolve(STRESS_SCHEDULE_PATH));
  }
  return stressScheduleCache;
}

function stressPlantForLearnerTurn(state, turnNumber, { recordTrace = true } = {}) {
  const schedule = activeStressSchedule();
  if (!schedule) return null;
  const plant = tutorStubStressPlantForTurn(schedule, turnNumber);
  if (plant && recordTrace && state?.trace) {
    appendTraceEvent(state.trace, {
      type: 'learner_stress_plant',
      schema: TUTOR_STUB_STRESS_SCHEDULE_SCHEMA,
      scheduleId: schedule.scheduleId,
      turn: turnNumber,
      state: plant.state,
      rightRepair: plant.rightRepair,
      alsoRight: plant.alsoRight,
    });
  }
  return plant;
}

// Phase Q3 (TUTOR_STUB_CORRUPT="<turn>:<kind>,..."): deterministic
// post-generation corruption of the learner's reply — the corrupted text
// becomes her turn everywhere (history, trace, the tutor's view), so she
// must live with it. Kinds: `truncate` (cut mid-sentence at ~60% of words),
// `termswap` (TUTOR_STUB_CORRUPT_SWAP="right term=wrong term"). Confusion
// by construction, not by acting — isolates the repair question.
const CORRUPT_TURNS = Object.fromEntries(
  (process.env.TUTOR_STUB_CORRUPT || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.split(':'))
    .map(([t, kind]) => [Number(t), kind]),
);

function applyTutorStubCorruption(state, turnNumber, text) {
  const kind = CORRUPT_TURNS[turnNumber];
  if (!kind) return text;
  let corrupted = text;
  if (kind === 'truncate') {
    const words = String(text).split(/\s+/);
    corrupted = `${words.slice(0, Math.max(4, Math.floor(words.length * 0.6))).join(' ')} —`;
  } else if (kind === 'termswap') {
    const [right, wrong] = String(process.env.TUTOR_STUB_CORRUPT_SWAP || '').split('=');
    if (right && wrong) {
      // Fuzzy matcher (Q3 pilot lesson): "basin hose" must also catch
      // "basin's cold-water hose" — words of the right term may carry a
      // possessive and up to two interleaved words.
      const fuzzy = right.trim().split(/\s+/).join("(?:['’]s)?(?:\\s+[\\w'’-]+){0,2}\\s+");
      corrupted = String(text).replace(new RegExp(`\\b${fuzzy}\\b`, 'gi'), wrong);
    }
  }
  if (corrupted !== text && state?.trace) {
    appendTraceEvent(state.trace, {
      type: 'learner_corruption',
      turn: turnNumber,
      kind,
      beforeChars: text.length,
      afterChars: corrupted.length,
    });
  }
  return corrupted;
}

function buildAutomatedLearnerPrompt({ state, profile, turnNumber, adherenceFeedback = '' }) {
  const hasTutorMessage = Boolean(latestTutorMessage(state));
  return [
    automatedLearnerProfileRuntime({ state, profile, turnNumber }),
    '',
    '# Public scene',
    '',
    publicWorldSummary(state.world),
    '',
    '# Dialogue context',
    '',
    hasTutorMessage
      ? 'The public dialogue precedes this task as native chat messages. Tutor speech is `user`; your own earlier learner speech is `assistant`. In a long run, an explicit omission marker may replace older turns while preserving the latest tutor-led window.'
      : 'There is no prior tutor message. Start by asking or stating what you would investigate first.',
    '',
    '# Task',
    '',
    tutorStubStressDirective(stressPlantForLearnerTurn(state, turnNumber)),
    stressPlantForLearnerTurn(state, turnNumber, { recordTrace: false }) ? '' : null,
    adherenceFeedback || null,
    adherenceFeedback ? '' : null,
    `Write learner turn ${turnNumber}. Use only public evidence and the public transcript.`,
    'First preserve the private behavior brief. A required distortion, omitted warrant, refusal, resistance, or withheld evidence step takes priority over generic progress.',
    `Only when the profile permits progress: if the tutor asks for a ${worldLedgerTerm(state?.world)} line, write one concise public evidence claim and treat it as both deduction and book entry.`,
    'Only when the profile permits progress: if several already-public premises form a warranted chain, you may state the connected premises and their supported follow-up conclusion in the same concise turn. Do not stop artificially after one step, but never add unstaged evidence.',
    'Only when the profile permits a help request: if you are stuck, ask one concrete question about what evidence would count.',
    'Write only speech the learner could say aloud inside the scene. Address the other speaker as "you"; never refer to "the tutor", "the learner", "the dialogue", or "the prompt".',
  ].join('\n');
}

async function generateAutomatedLearnerTurn({
  state,
  resolved,
  profile,
  turnNumber,
  adherenceFeedback = '',
  stream = null,
  cliEffort = null,
  signal = null,
}) {
  const prompt = buildAutomatedLearnerPrompt({ state, profile, turnNumber, adherenceFeedback });
  const systemPrompt = automatedLearnerSystemPrompt(profile);
  const messageHistory = tutorStubPublicMessagesForSpeaker(state.history, { speaker: 'learner' });
  const call = () =>
    callPromptModel({
      prompt,
      messageHistory,
      resolved,
      systemPrompt,
      role: 'tutor_stub_auto_learner',
      maxTokens: 900,
      trace: state.trace,
      stream,
      cliEffort,
      turn: turnNumber,
      signal,
      historyTurns: state.historyTurns,
    });
  let raw;
  try {
    raw = await call();
  } catch (error) {
    const retryLedger = state.cliPolicyRetryLedger || (state.cliPolicyRetryLedger = {});
    const retryKey = 'tutor_stub_auto_learner:codex_policy';
    const decision = tutorStubCliPolicyRetryDecision(error, { alreadyUsed: retryLedger[retryKey] === true });
    appendTraceEvent(state.trace, {
      type: 'cli_policy_retry_decision',
      role: 'tutor_stub_auto_learner',
      turn: turnNumber,
      decision,
      publicTranscriptChanged: false,
    });
    if (!decision.retry) throw error;
    retryLedger[retryKey] = true;
    raw = await call();
  }
  return {
    ...raw,
    text: applyTutorStubCorruption(state, turnNumber, cleanAutomatedLearnerReply(raw.text)),
    promptSnapshot: {
      systemPrompt,
      userPrompt: prompt,
      messageHistory: raw.promptSnapshot?.messageHistory || messageHistory,
      turn: turnNumber,
      promptAudit: raw.promptAudit,
    },
  };
}

function buildMixedLearnerArtifactsPrompt({ state, profile, turnNumber }) {
  return [
    buildAutomatedLearnerPrompt({ state, profile, turnNumber }),
    '',
    '# Mixed learner artifacts',
    '',
    'Return one JSON object with exactly four string fields: "move", "clue", "answer", and "profile_signal".',
    'move: "ask_question" when the learner turn asks a useful question; otherwise "respond".',
    'answer: the learner turn requested above. It may be a direct in-scene question when clarification is the best next move.',
    'clue: a short directional cue that helps a human learner understand what kind of move the tutor is inviting.',
    'profile_signal: one short plain-language observation explaining how this exact answer visibly expresses the active learner profile. Describe behavior only; do not name a contract, failure operator, classifier label, hidden fact, or private instruction.',
    'When move is "ask_question", make the clue begin with "Ask" and name what uncertainty or evidence to ask about without writing the exact question.',
    'The clue must not contain, paraphrase, quote, complete, or reveal the answer. It may name the distinction, evidence source, operation, or question to attend to.',
    'The answer must be speakable inside the scene. Never mention "the tutor", "the learner", "the dialogue", "the prompt", or say a question is pending.',
    'Keep the clue under 18 words and the answer concise. Return JSON only.',
  ].join('\n');
}

async function generateMixedLearnerArtifacts({
  state,
  resolved,
  profile,
  turnNumber,
  cliEffort = null,
  signal = null,
}) {
  const prompt = buildMixedLearnerArtifactsPrompt({ state, profile, turnNumber });
  const systemPrompt = mixedLearnerArtifactsSystemPrompt(profile);
  const messageHistory = tutorStubPublicMessagesForSpeaker(state.history, { speaker: 'learner' });
  const raw = await callPromptModel({
    prompt,
    messageHistory,
    resolved,
    systemPrompt,
    role: 'tutor_stub_mixed_learner_artifacts',
    maxTokens: 1100,
    trace: state.trace,
    stream: { enabled: false, interim: state.interim },
    cliEffort,
    turn: turnNumber,
    signal,
  });
  const artifacts = parseMixedLearnerArtifacts(raw.text);
  const answer = cleanAutomatedLearnerReply(artifacts.answer);
  return {
    ...raw,
    answer,
    clue: artifacts.clue,
    move: mixedLearnerSuggestionMove(answer, artifacts.move),
    profileSignal: artifacts.profileSignal,
    parsedArtifacts: artifacts.parsed,
    promptSnapshot: {
      systemPrompt,
      userPrompt: prompt,
      messageHistory,
      turn: turnNumber,
      promptAudit: raw.promptAudit,
    },
  };
}

function automatedLearnerDraftMatchesRuntime({ text, raw, state, runtime }) {
  if (!runtime?.requiredNow) return true;
  const classification = classificationFromCombinedAnalysis(raw, state);
  const syntheticTurn = { learner: text, classification };
  return (runtime.observability.markerClauses || []).some(
    (clause) => clause.length > 0 && automatedLearnerMarkerMatches(syntheticTurn, clause),
  );
}

function automatedLearnerRepairInstruction(profileId) {
  if (profileId === 'answer_seeking') {
    return 'Keep seeking supplied wording, but respond to the current public clue. Either ask for the next line using one concrete clue term, or copy part of the line just offered as a tentative entry. Do not repeat an earlier learner sentence verbatim.';
  }
  if (profileId === 'proof_skipper') {
    return 'State an unsupported downstream attribution, source, actor, or public-record judgment as if the clue were sufficient; do not merely restate the clue. Remove because, since, so, therefore, if, then, would need, would want, and any sentence that explains or requests the missing bridge. Do not hedge or ask a question.';
  }
  if (profileId === 'false_memory') {
    return 'Begin naturally with "We already saw", "I remember", "The record said", or an equivalent explicit recollection, then state one concrete observation that the public record did not actually establish. Misquote the clue itself rather than drawing a bad inference from a true clue. Do not hedge, describe a future test, or correct the distortion in this turn.';
  }
  if (profileId === 'affective_resistant') {
    return "Object to the tutor's pressure only. Do not add a clue, public-record line, warrant, inference, or useful evidence step in the same turn.";
  }
  return 'Make the required failure public and unmistakable without repairing it in the same turn.';
}

async function enforceAutomatedLearnerProfile({
  state,
  resolved,
  profile,
  turnNumber,
  generated,
  cliEffort = null,
  signal = null,
  isCurrent = null,
}) {
  assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
  const runtime = automatedLearnerProfileRuntimeState({ state, profile, turnNumber });
  const canPreclassify = Boolean(state.classifier.enabled && state.learnerDag.enabled && state.world);
  if (!runtime?.requiredNow || !canPreclassify || !generated.text) {
    return { generated, precomputedRaw: null, repaired: false, passed: null };
  }

  const maxRepairs = 2;
  let candidate = generated;
  let raw = null;
  let passed = false;
  let repairs = 0;
  while (repairs <= maxRepairs) {
    raw = await extractCombinedLearnerAnalysis({
      learnerText: candidate.text,
      state,
      tutorTurn: turnNumber,
      preflightSource: 'automated_learner_profile_adherence',
      signal,
    });
    assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
    passed = automatedLearnerDraftMatchesRuntime({ text: candidate.text, raw, state, runtime });
    if (passed || repairs === maxRepairs) break;
    appendTraceEvent(state.trace, {
      type: 'auto_learner_profile_repair_requested',
      turn: turnNumber,
      profile: runtime.profileId,
      attempt: repairs + 1,
      failureOperator: runtime.contract.intent.failureOperator,
      draft: candidate.text,
    });
    const repaired = await generateAutomatedLearnerTurn({
      state,
      resolved,
      profile,
      turnNumber,
      adherenceFeedback: `Your previous draft was too normalized and did not visibly perform the required failure operator (${runtime.contract.intent.failureOperator}). Rewrite the learner turn. ${automatedLearnerRepairInstruction(runtime.profileId)} Keep it natural and concise.`,
      stream: { enabled: false, interim: state.interim },
      cliEffort,
      signal,
    });
    assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
    if (repaired.text) candidate = repaired;
    repairs += 1;
  }
  appendTraceEvent(state.trace, {
    type: 'auto_learner_profile_adherence',
    turn: turnNumber,
    profile: runtime.profileId,
    required: true,
    passed,
    repaired: repairs > 0,
    repairAttempts: repairs,
  });
  return { generated: candidate, precomputedRaw: raw, repaired: repairs > 0, passed };
}

function tutorDialogueClosureFrameForTurn({ state, tutorTurn, tutorLearnerDag }) {
  const tutorDagSnapshot = buildTutorDagSnapshot(state, tutorTurn);
  return {
    tutorDagSnapshot,
    frame: buildTutorStubDialogueClosureFrame({
      lifecycle: state.dialogueClosure,
      learnerDagModel: tutorLearnerDag?.model || tutorLearnerDag || null,
      tutorDagSnapshot,
      answerTerm: answerTermForWorld(state.world),
    }),
  };
}

function typedActionStateBelief({ state, learnerText, stateObservation, turn }) {
  const dialogue = state.turns.flatMap((row) => [
    { role: 'learner', content: row.learner || '' },
    { role: 'tutor', content: row.tutor || '' },
  ]);
  dialogue.push({ role: 'learner', content: learnerText });
  const belief = estimateLearnerStateBelief({
    dialogue,
    interventionLedger: state.typedActions.ledger,
    turnIndex: turn,
  });
  belief.axes = {
    ...belief.axes,
    proof: stateObservation.axes.proof,
    release: stateObservation.axes.release,
    ownership: stateObservation.axes.ownership,
    conceptual_mastery: stateObservation.axes.conceptual_mastery,
    metacognitive_accuracy: stateObservation.axes.metacognitive_accuracy,
    affective_readiness: stateObservation.axes.affective_readiness,
  };
  return belief;
}

function advanceRuntimeScaffoldLifecycle(state, event) {
  if (!state.typedActions?.enabled) return null;
  const result = advanceScaffoldLifecycle(state.typedActions.scaffoldLifecycle, event);
  state.typedActions.scaffoldLifecycle = result.lifecycle;
  appendTraceEvent(state.trace, {
    type: 'tutor_scaffold_lifecycle_transition',
    turn: event.turn,
    transition: result.transition,
    lifecycle: result.lifecycle,
  });
  return result;
}

function scaffoldLifecycleActionGate(lifecycle) {
  const phase = lifecycle?.phase || 'diagnose';
  const allowedMoveFamilies = allowedMoveFamiliesForScaffoldPhase(phase);
  const allowedActionTypes = ADAPTATION_ACTIONS.filter((action) =>
    allowedMoveFamilies.includes(tutorStubMoveFamilyForAction(action.action_type)),
  ).map((action) => action.action_type);
  if (!allowedActionTypes.length) {
    throw new Error(`typed scaffold lifecycle phase ${phase} has no permitted pedagogical actions`);
  }
  return {
    phase,
    allowedMoveFamilies,
    allowedActionTypes,
    policySpec: {
      id: `tutor-stub-scaffold-lifecycle-${phase}`,
      version: '1.0',
      module_id: `scaffold_lifecycle:${phase}`,
      spec_hash: `scaffold-lifecycle.v1:${phase}:${allowedActionTypes.join(',')}`,
      action_policy: {
        allowed_action_families: allowedActionTypes,
        preferred_action_families: allowedActionTypes,
        disallowed_action_families: ADAPTATION_ACTIONS.map((action) => action.action_type).filter(
          (actionType) => !allowedActionTypes.includes(actionType),
        ),
      },
    },
  };
}

function closePriorTypedAction({ state, learnerText, turn }) {
  if (!state.typedActions?.enabled) return null;
  const result = closePendingIntervention({
    ledger: state.typedActions.ledger,
    learnerTurn: learnerText,
    turnIndex: turn,
    config: { semanticOutcomeObserver: true },
  });
  state.typedActions.ledger = result.ledger;
  if (!result.closedRecord) return null;
  const envelope = {
    schema: TUTOR_TYPED_ACTION_OUTCOME_SCHEMA,
    contract_id: result.closedRecord.contract_id,
    decision_turn: result.closedRecord.turn_index,
    observation_turn: turn,
    public_learner_observation: learnerText,
    outcome: result.closedRecord.outcome,
    observed_transition: result.closedRecord.observed_transition,
    evidence: result.closedRecord.evidence,
    evidence_contract: result.closedRecord.evidence_contract || null,
    policy_update: result.closedRecord.policy_update || null,
    closed_record: result.closedRecord,
  };
  const lifecycle = advanceRuntimeScaffoldLifecycle(state, {
    kind: 'closed_public_outcome',
    turn,
    outcome: envelope,
  });
  envelope.scaffold_lifecycle_transition = lifecycle?.transition || null;
  envelope.scaffold_lifecycle = lifecycle?.lifecycle || null;
  const priorTurn = [...state.turns]
    .reverse()
    .find((row) => Number(row.turn) === Number(result.closedRecord.turn_index));
  if (priorTurn?.typedActionDecision) priorTurn.typedActionOutcomeAfterNextLearner = jsonClone(envelope);
  appendTraceEvent(state.trace, {
    type: 'tutor_typed_action_outcome_closed',
    turn,
    decisionTurn: result.closedRecord.turn_index,
    outcome: envelope,
  });
  return envelope;
}

function typedActionRegisterSelection({
  state,
  learnerText,
  classification,
  tutorLearnerDag,
  registerSelection,
  decision,
}) {
  const register =
    registerSelection?.engagement_stance ||
    registerSelection?.selected_register ||
    decision.register_selection.engagement_stance ||
    'precise';
  const baseConfiguration =
    registerSelection?.response_configuration ||
    buildTutorStubResponseConfiguration({
      engagementStance: register,
      legacySelectedRegister: register,
      temperature: state.register?.temperature ?? DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
      policy: state.register?.policy || 'typed_action',
      learnerText,
      classification,
      tutorLearnerDag,
      comprehension: tutorStubComprehensionFeatures(state.comprehension, { turn: state.turns.length + 1 }),
      world: state.world,
    });
  const patch = decision.response_configuration_patch;
  const actorialInputs = {
    engagementStance: register,
    stanceDistribution:
      baseConfiguration.engagement_stance_distribution || registerSelection?.engagement_stance_distribution || null,
    actionFamily: patch.action_family,
    temperature: state.register?.temperature ?? DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
    classification,
    tutorLearnerDag,
    comprehension: tutorStubComprehensionFeatures(state.comprehension, { turn: state.turns.length + 1 }),
    world: state.world,
    dueEvidence: currentReleaseRows(state, state.turns.length + 1),
    recentActorialParts: (state.register?.history || [])
      .filter((entry) => Number(entry.turn) < state.turns.length + 1)
      .map((entry) => entry.actorial_part || entry.response_configuration?.actorial_part)
      .filter(Boolean),
  };
  let actorialPart = selectTutorStubActorialPart(actorialInputs);
  const explicitRegister = explicitPerformanceDirectiveValue(state, 'register');
  const explicitCharacter = explicitPerformanceDirectiveValue(state, 'character');
  const lightAdaptation = registerSelection?.light_adaptation || baseConfiguration.light_adaptation || null;
  const lightAdaptationTriggered = lightAdaptation?.triggered === true;
  const randomStanceEnabled =
    state.randomPerformance?.enabled === true && !explicitRegister && !lightAdaptationTriggered;
  const randomCharacterEnabled =
    state.randomPerformance?.enabled === true && !explicitCharacter && !lightAdaptationTriggered;
  if (lightAdaptationTriggered) {
    actorialPart = randomPerformanceActorialPartSelection({
      state,
      inputs: actorialInputs,
      baseSelection: actorialPart,
      lightAdaptation,
    });
  } else if (explicitCharacter) {
    actorialPart = explicitPerformanceActorialPartSelection({
      inputs: actorialInputs,
      baseSelection: actorialPart,
      character: explicitCharacter,
    });
  } else if (randomCharacterEnabled) {
    actorialPart = randomPerformanceActorialPartSelection({
      state,
      inputs: actorialInputs,
      baseSelection: actorialPart,
    });
  } else if (
    registerTemperatureApplies(state.register?.policy) &&
    actorialPart.distribution.length &&
    actorialPart.locked !== true
  ) {
    const sampledPart = sampleTutorStubPolicyDistribution(
      actorialPart.distribution.map((row) => ({
        register: row.part,
        weight: row.weight,
        probability: row.probability,
      })),
      policySamplingContext(state, 'typed_action_actorial_part'),
    );
    actorialPart = selectTutorStubActorialPart({
      ...actorialInputs,
      selectedPartOverride: sampledPart.entry?.register || actorialPart.id,
    });
    actorialPart.random = sampledPart.audit;
  }
  const responseConfiguration = {
    ...jsonClone(baseConfiguration),
    action_family: patch.action_family,
    actorial_part: actorialPart.id,
    actorial_part_label: actorialPart.label,
    actorial_part_selection: actorialPart,
    actorial_performance: selectTutorStubActorialPerformance({
      engagementStance: register,
      actorialPart: actorialPart.id,
    }),
    support_level: patch.support_level,
    task_id: patch.task_id,
    knowledge_component: patch.knowledge_component,
    item_difficulty: patch.item_difficulty,
    typed_action_schema: decision.schema,
    light_adaptation: lightAdaptation
      ? {
          ...lightAdaptation,
          engagement_stance_random: lightAdaptationTriggered ? registerSelection?.random || null : null,
          actorial_part_random: lightAdaptationTriggered ? actorialPart.random || null : null,
          applied: lightAdaptationTriggered,
          applied_axes: lightAdaptationTriggered
            ? ['engagement_stance', actorialPart.locked === true ? null : 'actorial_part'].filter(Boolean)
            : [],
        }
      : null,
    random_performance: state.randomPerformance?.enabled
      ? {
          schema: 'machinespirits.tutor-stub.random-performance-selection.v1',
          enabled: randomStanceEnabled || randomCharacterEnabled,
          configured: true,
          active_axes: [
            randomStanceEnabled ? 'engagement_stance' : null,
            randomCharacterEnabled ? 'actorial_part' : null,
          ].filter(Boolean),
          explicitly_directed_axes: [
            explicitRegister ? 'engagement_stance' : null,
            explicitCharacter ? 'actorial_part' : null,
          ].filter(Boolean),
          assessment_influence: {
            engagement_stance: false,
            actorial_part: false,
            other_axes: true,
          },
          stance_random: randomStanceEnabled ? registerSelection?.random || null : null,
          actorial_part_random: randomCharacterEnabled ? actorialPart.random || null : null,
          hard_constraints_preserved: ['dialogue_closure', 'evidence_release', 'response_safety'],
        }
      : baseConfiguration.random_performance || null,
    performance_directives:
      explicitRegister || explicitCharacter
        ? {
            schema: 'machinespirits.tutor-stub.explicit-performance-directives.v1',
            precedence: 'light_adaptation_then_explicit_axis_then_random_axis_then_adaptive_policy',
            register: explicitRegister
              ? {
                  value: explicitRegister,
                  applied: !lightAdaptationTriggered,
                  outcome: lightAdaptationTriggered ? 'overridden_by_light_adaptation' : 'applied',
                  assessment_influence: false,
                }
              : null,
            character: explicitCharacter
              ? {
                  value: explicitCharacter,
                  applied: !lightAdaptationTriggered && actorialPart.explicit_directive?.applied !== false,
                  outcome: lightAdaptationTriggered
                    ? 'overridden_by_light_adaptation'
                    : actorialPart.explicit_directive?.outcome || 'applied',
                  assessment_influence: false,
                }
              : null,
            hard_constraints_preserved: [
              'dialogue_closure',
              'authored_evidence_source',
              'evidence_release',
              'response_safety',
            ],
          }
        : baseConfiguration.performance_directives || null,
    selection_reasons: {
      ...(baseConfiguration.selection_reasons || {}),
      action_family: `Selected by the opt-in typed pedagogical-action policy as ${decision.chosen_action.action_type}.`,
      actorial_part: actorialPart.reason,
      support_level: 'Selected independently from move family, engagement stance, and task.',
      task: 'Supplied by the explicit typed-action task configuration.',
    },
  };
  const definition = getEngagementStanceDefinition(register) || {};
  const effective = {
    ...(registerSelection ? jsonClone(registerSelection) : {}),
    schema: registerSelection?.schema || 'machinespirits.tutor-stub.response-configuration-selection.v5',
    policy: registerSelection?.policy || state.register?.policy || 'typed_action',
    turn: registerSelection?.turn || state.turns.length + 1,
    engagement_stance: register,
    selected_register: register,
    selected_mode: register,
    legacy_selected_register: registerSelection?.legacy_selected_register || register,
    action_family: patch.action_family,
    support_level: patch.support_level,
    task_id: patch.task_id,
    knowledge_component: patch.knowledge_component,
    item_difficulty: patch.item_difficulty,
    addressee_profile: responseConfiguration.addressee_profile,
    audience_register: responseConfiguration.audience_register,
    register_pragmatics: responseConfiguration.register_pragmatics,
    lexical_accessibility: responseConfiguration.lexical_accessibility,
    scene_immersion: responseConfiguration.scene_immersion,
    actorial_part: responseConfiguration.actorial_part,
    actorial_part_label: responseConfiguration.actorial_part_label,
    actorial_part_selection: responseConfiguration.actorial_part_selection,
    actorial_performance: responseConfiguration.actorial_performance,
    unresolved_terms: responseConfiguration.unresolved_terms,
    light_adaptation: responseConfiguration.light_adaptation,
    performance_directives: responseConfiguration.performance_directives,
    valence: registerSelection?.valence || definition.valence || null,
    request_type:
      registerSelection?.request_type ||
      classification?.turn?.request_type ||
      classification?.turn?.discourse_move ||
      'unknown',
    reviewer_signal:
      registerSelection?.reviewer_signal || classification?.turn?.pedagogical_need || 'typed pedagogical action',
    register_reason: registerSelection?.register_reason || 'Default precise stance for the typed-action runtime.',
    response_configuration: responseConfiguration,
    typed_action_decision: decision,
    source: registerSelection?.source || 'typed_action_runtime',
  };
  if (state.register?.enabled) {
    if (state.register.history.length && state.register.history.at(-1)?.turn === effective.turn) {
      state.register.history[state.register.history.length - 1] = effective;
    } else {
      state.register.history.push(effective);
    }
    state.register.current = effective;
  }
  return effective;
}

function planTypedAction({
  state,
  learnerText,
  stateObservation,
  turn,
  classification,
  tutorLearnerDag,
  registerSelection,
}) {
  if (!state.typedActions?.enabled) {
    return { registerSelection, decision: null, priorOutcome: null };
  }
  const priorOutcome = closePriorTypedAction({ state, learnerText, turn });
  const stateBelief = typedActionStateBelief({ state, learnerText, stateObservation, turn });
  const lifecycleBeforeDecision = jsonClone(state.typedActions.scaffoldLifecycle);
  const lifecycleGate = scaffoldLifecycleActionGate(lifecycleBeforeDecision);
  const selection = selectPedagogicalAction({
    stateBelief,
    interventionLedger: state.typedActions.ledger,
    mode: 'closed_loop',
    config: {
      maxActionCandidates: ADAPTATION_ACTIONS.length,
      worldAdaptationSpec: lifecycleGate.policySpec,
    },
  });
  const considered = new Set(selection.candidateActions.map((candidate) => candidate.action_type));
  const vetoes = ADAPTATION_ACTIONS.filter((action) => !considered.has(action.action_type)).map((action) => {
    const moveFamily = tutorStubMoveFamilyForAction(action.action_type);
    const lifecycleVeto = !lifecycleGate.allowedMoveFamilies.includes(moveFamily);
    return {
      action_type: action.action_type,
      move_family: moveFamily,
      stage: lifecycleVeto ? 'scaffold_lifecycle_gate' : 'state_conditioned_candidate_generation',
      disposition: lifecycleVeto ? 'vetoed' : 'not_considered',
      reason: lifecycleVeto
        ? `Move family ${moveFamily} is not permitted during scaffold phase ${lifecycleGate.phase}.`
        : 'The current public learner-state hypotheses did not place this action in the policy candidate set.',
    };
  });
  const register = registerSelection?.engagement_stance || registerSelection?.selected_register || 'precise';
  let decision = buildTutorStubTypedActionDecision({
    selection,
    stateBelief,
    task: state.typedActions.config.task,
    register,
    supportLevel: state.typedActions.config.supportLevel,
    selectionProbability: 1,
    vetoes,
    modelVersion: 'programmatic/adaptive-action-policy',
  });
  const contractId = `${stateRunDebugId(state)}-typed-action-t${turn}`;
  const contract = createAdaptationContract({
    contractId,
    dialogueId: stateRunDebugId(state),
    turnIndex: turn,
    stateBelief,
    selectedAction: decision.chosen_action,
    candidateActions: selection.candidateActions,
    gateResult: { allowed: true, violations: [], repairs: [] },
    policyMode: 'closed_loop',
    worldAdaptationSpec: selection.worldAdaptationSpec,
  });
  decision = jsonClone({
    ...decision,
    contract_id: contractId,
    decision_provenance: {
      timing: 'after_current_public_learner_observation_before_tutor_output',
      public_observation_schema: stateObservation.schema,
      public_only: true,
      selection_method: 'deterministic_closed_loop_argmax',
      propensity: {
        selected_action_probability: 1,
        method: 'deterministic_policy',
      },
      candidate_universe: ADAPTATION_ACTIONS.map((action) => action.action_type),
      considered_candidates: selection.candidateActions.map((candidate) => candidate.action_type),
      vetoed_or_not_considered: vetoes.map((row) => row.action_type),
      task_axis_source: 'explicit_typed_action_config',
      register_axis_source: registerSelection ? 'existing_tutor_stub_register_policy' : 'typed_action_precise_fallback',
      support_axis_source:
        state.typedActions.config.supportLevel === null ? 'action_default' : 'explicit_typed_action_config',
      scaffold_lifecycle_gate: {
        phase: lifecycleGate.phase,
        allowed_move_families: lifecycleGate.allowedMoveFamilies,
        allowed_action_types: lifecycleGate.allowedActionTypes,
        policy_spec: lifecycleGate.policySpec,
      },
    },
    adaptation_contract: contract,
  });
  const lifecycleDecision = advanceRuntimeScaffoldLifecycle(state, {
    kind: 'typed_action_decision',
    turn,
    decision,
  });
  decision = jsonClone({
    ...decision,
    scaffold_lifecycle: {
      before: lifecycleBeforeDecision,
      transition: lifecycleDecision.transition,
      after: lifecycleDecision.lifecycle,
    },
  });
  const pending = appendPendingIntervention(state.typedActions.ledger, contract);
  state.typedActions.ledger = pending.ledger;
  state.typedActions.currentDecision = decision;
  const effectiveRegisterSelection = typedActionRegisterSelection({
    state,
    learnerText,
    classification,
    tutorLearnerDag,
    registerSelection,
    decision,
  });
  appendTraceEvent(state.trace, {
    type: 'tutor_typed_action_decision',
    turn,
    phase: 'before_tutor_output',
    stateObservation,
    decision,
    pendingIntervention: pending.pendingIntervention,
  });
  console.log(
    `${C.cyan}typed action >${C.reset} ${decision.chosen_action.action_type}; move ${
      decision.chosen_action.move_family
    }; support ${decision.chosen_action.support_level}; task ${decision.chosen_action.task_id}; stance ${register}`,
  );
  return { registerSelection: effectiveRegisterSelection, decision, priorOutcome };
}

const { runAutomatedLearnerDialogue, runOneTurn } = createTutorStubTurnOrchestration({
  C,
  ROOT,
  TUTOR_GUARD_ACCOUNTING_SCHEMA,
  TUTOR_STUB_DIAGNOSTIC_COLLECTION_MODE,
  TUTOR_STUB_QUARANTINE_CONTINUATION,
  acknowledgeTutorStubOpeningRelease,
  advanceTutorStubDialogueClosure,
  analyzeLearnerTurn,
  appendTraceEvent,
  appendTutorStubTurnFailureTraceRecords,
  applyTutorStubComprehensionResponse,
  applyTutorStubConversationalCompletionSelection,
  applyTutorStubPointOfActionConstraint,
  assertTutorStubTurnAttemptCurrent,
  auditTutorResponseLeak,
  auditTutorStubFeedbackAdaptation,
  auditTutorStubPointOfActionCompliance,
  auditTutorStubQuarantineContinuation,
  auditTutorStubReleaseDelivery,
  auditTutorStubRepetitionResponse,
  auditTutorStubResponseConfiguration,
  automatedLearnerProfileId,
  automaticTechnicalDetailsEnabled,
  buildDynamicalSystemState,
  buildHumanDiscourseFrame,
  buildTutorInterimContext,
  buildTutorOpening,
  buildTutorStubDramaticReleaseFrame,
  buildTutorStubFeedbackAdaptationPlan,
  buildTutorStubFeedbackObservation,
  buildTutorStubObservedAudits,
  buildTutorStubPointOfActionTurn,
  buildTutorStubStateObservation,
  callTutor,
  classifyTutorStubDiagnosticFailure,
  closePriorTypedAction,
  commitTutorStubReleasePacing,
  createTutorStubLearnerResponseProvenance,
  currentReleaseRows,
  deterministicAutomatedLearnerFallback,
  enforceAutomatedLearnerProfile,
  findTutorStubFeedbackTargetTurn,
  generateAutomatedLearnerTurn,
  jsonClone,
  learnerProfileSpeakerLabel,
  openingDebugId,
  path,
  planTypedAction,
  printDirectorPreludeBeforeFirstTutor,
  printExplanatoryDebugTurn,
  printOpeningDebugLine,
  printResponseDetails,
  printTurnDebugLine,
  printTutorDagSnapshot,
  printTutorResponse,
  printWithConcurrentTerminal,
  recordTutorStubTuningFeedback,
  recordTutorStubTurnTiming,
  restoreTutorStubDiagnosticTransaction,
  snapshotTutorStubDiagnosticTransaction,
  startInterimAnimation,
  stateRunDebugId,
  stopInterimAnimation,
  turnDebugId,
  tutorCoachGuidanceEntries,
  tutorDialogueClosureFrameForTurn,
  tutorMessageContext,
  tutorStubComprehensionSnapshot,
  tutorStubDirectorGuidanceEntry,
  tutorStubLearnerDagGrounded,
  tutorStubNewEvidenceAvailable,
  tutorStubReleasePacingSnapshot,
  writeFieldVisualization,
});

async function main() {
  if (args.help) {
    printHelp();
    return;
  }
  if (args['list-labs']) {
    console.log(formatTutorStubLabList());
    return;
  }
  if (args.features) {
    printTutorStubFeatureMap();
    return;
  }
  if (args['list-worlds']) {
    printWorlds();
    return;
  }
  if (args['list-curriculum-modules']) {
    if (!args.curriculum) throw new Error('--list-curriculum-modules requires --curriculum <workplan|path>');
    printCurriculumModules(args.curriculum);
    return;
  }
  if (args['list-tutors']) {
    for (const tutor of listTutorStubTutorInstances()) {
      console.log(`${tutor.id}@v${tutor.source_version || 1}\t${tutor.title}\t${tutor.description || ''}`);
    }
    return;
  }
  if (args['list-learner-profiles']) {
    printAutomatedLearnerProfiles();
    return;
  }
  if (selectedLabResolution) {
    assertTutorStubLabRequirements(selectedLabResolution, args);
    selectedLabAdmission = resolveTutorStubMeteredLabAdmission(selectedLabResolution, args);
    selectedLabModelCallBudget = createTutorStubModelCallBudget(selectedLabAdmission);
  }
  const resumeRequested = Boolean(args.resume || args['resume-last']);
  const requestedLaunchMode = normalizeTutorStubLaunchMode(args['launch-mode'], { allowEmpty: true });
  if (args['labelling-game'] && requestedLaunchMode && requestedLaunchMode !== 'labelling-game') {
    throw new Error('--labelling-game conflicts with --launch-mode chat');
  }
  const launchPickerEnabled = !args['labelling-game'] && !requestedLaunchMode && defaultLaunchModePickerAvailable();
  let launchMode = args['labelling-game'] ? 'labelling-game' : requestedLaunchMode || 'chat';
  if (launchPickerEnabled) {
    console.log(`${C.brightCyan}${C.bold}Machine Spirits${C.reset}`);
    console.log(`${C.dim}Choose a mode${C.reset}\n`);
    const selection = await pickTutorStubLaunchModeWithKeyboard('chat');
    if (!selection) return;
    launchMode = selection.id;
  }
  while (launchMode === 'labelling-game') {
    if (launchPickerEnabled) console.log(`${C.cyan}${C.bold}mode >${C.reset} Labelling game\n`);
    await runLabellingGameCli({
      datasetId: args['label-dataset'],
      coderId: args['label-coder'],
    });
    if (!launchPickerEnabled) return;
    console.log(`\n${C.dim}Choose a mode${C.reset}\n`);
    const selection = await pickTutorStubLaunchModeWithKeyboard('chat');
    if (!selection) return;
    launchMode = selection.id;
  }
  if (launchPickerEnabled) {
    const chatMode = args.lab === 'mixed_drafting' ? 'Mixed tutor chat' : 'Tutor chat';
    console.log(`${C.cyan}${C.bold}mode >${C.reset} ${chatMode}\n`);
  }

  args.theme = normalizeTutorStubCliThemeId(args.theme, { strict: true });
  args.motion = normalizeTutorStubCliMotion(args.motion, { strict: true });
  configureCliPresentation({
    theme: args.theme,
    motion: args.motion,
    noColor: args['no-color'],
  });

  const explicitPointOfActionArm =
    commandLineOptionProvided('point-of-action-arm') || Boolean(process.env.TUTOR_STUB_POINT_OF_ACTION_ARM);
  if (args.committee && args['no-committee']) {
    throw new Error('--committee and --no-committee cannot be used together');
  }
  if (
    args.committee &&
    explicitPointOfActionArm &&
    normalizeTutorStubPointOfActionArm(args['point-of-action-arm']) !== 'committee'
  ) {
    throw new Error('--committee conflicts with the explicit --point-of-action-arm value');
  }
  if (args['no-committee'] && explicitPointOfActionArm) {
    throw new Error('--no-committee conflicts with --point-of-action-arm');
  }
  if (args.committee) args['point-of-action-arm'] = 'committee';
  if (args['no-committee']) args['point-of-action-arm'] = '';

  const passthroughEnabled = Boolean(args.passthrough);
  const observedAuditsEnabled = Boolean(args['observe-audits']);
  if (observedAuditsEnabled && !passthroughEnabled) {
    // A guarded run already evaluates all seven audits and records them as
    // guard results. Accepting the flag there would write a second, weaker copy
    // of two of them under a name that promises no enforcement, which is a
    // reading hazard rather than a feature.
    throw new Error(
      '--observe-audits requires --passthrough: a guarded run already records these audits as enforced guard results',
    );
  }
  if (passthroughEnabled) {
    args.dag = false;
    args['tutor-learner-dag'] = false;
    args['no-classifier'] = true;
    args['no-register-selection'] = true;
    args['typed-actions'] = false;
    args['point-of-action-arm'] = '';
    // Passthrough defaults to pure human chat, but an evaluation harness needs a
    // genuinely bare arm that still talks to itself: passthrough is the only
    // mode that bypasses the guard suite, first-draft recovery and the closure
    // lifecycle, and a bare arm is useless as a comparison if nobody answers it.
    // An explicit --auto-learner therefore survives; everything else passthrough
    // strips stays stripped, and the automated-learner labs still gate the flag.
    if (!commandLineOptionProvided('auto-learner')) args['auto-learner'] = false;
    args['mixed-learner'] = false;
    args['mixed-mode'] = false;
    args['no-memory-summary'] = true;
    args['multiple-choice'] = false;
    args['no-opening'] = true;
    args['no-closeout-report'] = true;
    args['no-turn-feedback'] = true;
    args['no-interim-animation'] = true;
    args['field-viz'] = false;
    args.tuning = 'off';
  }

  let tutorInstance = resolveTutorStubTutorInstance(args.tutor);
  let tuningMode = normalizeTutorStubTuningMode(args.tuning);
  if (!commandLineOptionProvided('model') && !process.env.TUTOR_STUB_MODEL && tutorInstance.modelDefaults.tutor) {
    args.model = tutorInstance.modelDefaults.tutor;
  }
  if (
    !commandLineOptionProvided('classifier-model') &&
    !process.env.TUTOR_STUB_CLASSIFIER_MODEL &&
    tutorInstance.modelDefaults.interpretation
  ) {
    args['classifier-model'] = tutorInstance.modelDefaults.interpretation;
  }
  if (
    !commandLineOptionProvided('learner-record-model') &&
    !process.env.TUTOR_STUB_LEARNER_RECORD_MODEL &&
    tutorInstance.modelDefaults.interpretation
  ) {
    args['learner-record-model'] = tutorInstance.modelDefaults.interpretation;
  }
  if (
    !commandLineOptionProvided('auto-learner-model') &&
    !process.env.TUTOR_STUB_AUTO_LEARNER_MODEL &&
    tutorInstance.modelDefaults.learner
  ) {
    args['auto-learner-model'] = tutorInstance.modelDefaults.learner;
  }

  let allModelsOverrideRef = String(args['all-models'] || '').trim() || null;
  if (allModelsOverrideRef) {
    args.model = allModelsOverrideRef;
    args['classifier-model'] = allModelsOverrideRef;
    args['learner-record-model'] = allModelsOverrideRef;
    args['auto-learner-model'] = allModelsOverrideRef;
  }
  if (commandLineOptionProvided('learner-character')) {
    if (
      commandLineOptionProvided('auto-learner-profile') &&
      String(args['auto-learner-profile']).trim() !== String(args['learner-character']).trim()
    ) {
      throw new Error('--learner-character conflicts with --auto-learner-profile');
    }
    args['auto-learner-profile'] = args['learner-character'];
  }
  const interactiveSessionIntent = Boolean(!args['auto-learner'] && !args.once && !positionals.join(' ').trim());
  const explicitRememberedSources = rememberedSettingExplicitSources();
  const rememberedSettings = applyRememberedInteractiveDefaults({
    interactiveSessionEnabled: interactiveSessionIntent,
  });
  if (
    interactiveSessionIntent &&
    !passthroughEnabled &&
    !explicitRememberedSources.committeeEnabled &&
    !rememberedSettings.appliedFields.includes('committee_mode')
  ) {
    args['point-of-action-arm'] = 'committee';
  }
  const committeeFallbackPolicyExplicit =
    commandLineOptionProvided('committee-fallback-policy') || Boolean(process.env.TUTOR_STUB_COMMITTEE_FALLBACK_POLICY);
  if ((args.committee || (interactiveSessionIntent && !passthroughEnabled)) && !committeeFallbackPolicyExplicit) {
    args['committee-fallback-policy'] = DEFAULT_INTERACTIVE_COMMITTEE_FALLBACK_POLICY;
  }
  args['committee-fallback-policy'] = String(args['committee-fallback-policy'] || '')
    .trim()
    .toLowerCase();
  if (!['v1', 'v2'].includes(args['committee-fallback-policy'])) {
    throw new Error('--committee-fallback-policy must be v1 or v2');
  }
  if (args.module && !args.curriculum) {
    throw new Error('--module requires --curriculum <workplan|path>');
  }
  let curriculumBundle = null;
  let curriculumRuntime = null;
  if (args.curriculum) {
    if (args.system) throw new Error('--curriculum cannot be combined with --system because --system replaces it');
    if (args.dag || args['tutor-learner-dag']) {
      throw new Error(
        'A canonical curriculum module is not a proof DAG. Remove --dag/--tutor-learner-dag, or hand-author and validate a dramatic-derivation world for this module.',
      );
    }
    if (commandLineOptionProvided('world') && !['none', 'off', 'false'].includes(String(args.world).toLowerCase())) {
      throw new Error(
        '--curriculum cannot be combined with an active --world; use the curriculum module or a separately authored world',
      );
    }
    curriculumBundle = tutorStubCurriculumBundle(args.curriculum, args.module, { root: ROOT });
    curriculumRuntime = createTutorStubCurriculumRuntime(curriculumBundle, { moduleId: curriculumBundle.module.id });
    // A remembered scenario must not silently costume or constrain reflective
    // curriculum work. The curriculum source is complete public context and
    // intentionally runs without a scenario proof DAG.
    args.world = 'none';
  }
  args.theme = normalizeTutorStubCliThemeId(args.theme, { strict: true });
  args.motion = normalizeTutorStubCliMotion(args.motion, { strict: true });
  configureCliPresentation({
    theme: args.theme,
    motion: args.motion,
    noColor: args['no-color'],
  });
  tutorInstance = resolveTutorStubTutorInstance(args.tutor);
  tuningMode = normalizeTutorStubTuningMode(args.tuning);
  if (!allModelsOverrideRef && rememberedSettings.restoredAllModelsOverrideRef) {
    allModelsOverrideRef = rememberedSettings.restoredAllModelsOverrideRef;
  }
  const allModelsOverride = allModelsOverrideRef
    ? {
        schema: 'machinespirits.tutor-stub.all-models-override.v1',
        modelRef: allModelsOverrideRef,
        source:
          rememberedSettings.restoredAllModelsOverrideRef === allModelsOverrideRef
            ? 'remembered_settings'
            : commandLineOptionProvided('all-models')
              ? 'cli'
              : 'environment',
        precedence: 'overrides_all_role_specific_model_settings',
        roles: ['tutor', 'classifier', 'learner_dag_analysis', 'automated_or_mixed_learner'],
      }
    : null;
  args['auto-learner-profile'] = resolveAutomatedLearnerProfile(args['auto-learner-profile']);

  const temperature = parseNumber(args.temperature, '--temperature', { min: 0, max: 2 });
  const voiceModel = normalizeTutorStubVoiceModel(args['voice-model']);
  const voiceName = normalizeTutorStubVoiceName(args['voice-name']);
  const voiceLaunchRequested = Boolean(args.voice);
  const registerTemperature = normalizeTutorStubEngagementStanceTemperature(args['register-temperature'], {
    label: '--register-temperature',
  });
  // Recipe replay marks captured options as resolved launch sources, including
  // an explicitly captured `light-adaptation: false`. Treat the boolean value,
  // not mere option presence, as the opt-in/opt-out signal so passthrough
  // recipes remain valid and deterministic.
  const lightAdaptationCliOptIn = commandLineOptionProvided('light-adaptation') && Boolean(args['light-adaptation']);
  const lightAdaptationCliOptOut =
    commandLineOptionProvided('no-light-adaptation') && Boolean(args['no-light-adaptation']);
  if (lightAdaptationCliOptIn && lightAdaptationCliOptOut) {
    throw new Error('--light-adaptation cannot be combined with --no-light-adaptation');
  }
  const lightAdaptationRemembered = rememberedSettings.appliedFields.includes('light_adaptation');
  const lightAdaptationRequested = lightAdaptationCliOptOut
    ? false
    : lightAdaptationCliOptIn
      ? true
      : lightAdaptationRemembered
        ? Boolean(args['light-adaptation'])
        : process.env.TUTOR_STUB_LIGHT_ADAPTATION !== undefined
          ? STUB.lightAdaptation
          : interactiveSessionIntent && !passthroughEnabled;
  const lightAdaptationAvailable = Boolean(!passthroughEnabled && !args['no-register-selection']);
  const lightAdaptationEnabled = Boolean(lightAdaptationRequested && lightAdaptationAvailable);
  // Session recipes and config hashes record the effective value rather than
  // the raw parser default, so relaunches reproduce this mode boundary.
  args['light-adaptation'] = lightAdaptationEnabled;
  args['no-light-adaptation'] = !lightAdaptationEnabled;
  const lightAdaptationThreshold = normalizeTutorStubLightAdaptationThreshold(args['light-adaptation-threshold']);
  const lightAdaptationExplicitOptIn = lightAdaptationCliOptIn || process.env.TUTOR_STUB_LIGHT_ADAPTATION === '1';
  if (lightAdaptationExplicitOptIn && passthroughEnabled) {
    throw new Error('--light-adaptation is unavailable in --passthrough because learner assessment is disabled');
  }
  if (lightAdaptationExplicitOptIn && args['no-register-selection']) {
    throw new Error('--light-adaptation requires teaching-style selection; remove --no-register-selection');
  }
  const dagFactDropoutRate = normalizeTutorStubDagFactDropoutRate(args['dag-fact-dropout'], {
    label: '--dag-fact-dropout',
  });
  const dagFactDropoutSeed = normalizeTutorStubDagFactDropoutSeed(args['dag-fact-dropout-seed'], {
    label: '--dag-fact-dropout-seed',
  });
  const releaseSpeed = normalizeTutorStubReleaseSpeed(args['release-speed'], {
    label: '--release-speed',
  });
  const loopMode = normalizeTutorStubLoopMode(args['loop-mode'], { label: '--loop-mode' });
  const openingRealizer = String(args['opening-realizer'] || 'model')
    .trim()
    .toLowerCase();
  if (!['model', 'deterministic'].includes(openingRealizer)) {
    throw new Error('--opening-realizer must be model or deterministic');
  }
  const experimentRunSeed = normalizeTutorStubDagFactDropoutSeed(args['run-seed'], {
    label: '--run-seed',
  });
  const experimentRepeat = parsePositiveInt(args['eval-repeat'], '--eval-repeat');
  const typedActionsEnabled = Boolean(args['typed-actions']);
  const typedActionSupportLevel = parseOptionalBoundedInt(
    args['typed-action-support-level'],
    '--typed-action-support-level',
    { min: 0, max: 3 },
  );
  const typedActionTask = {
    taskId: String(args['typed-action-task-id'] || '').trim(),
    knowledgeComponent: String(args['typed-action-knowledge-component'] || '').trim(),
    prerequisitePath: commaSeparatedStrings(args['typed-action-prerequisites']),
    itemDifficulty: parseNumber(args['typed-action-item-difficulty'], '--typed-action-item-difficulty', {
      min: 0,
      max: 1,
    }),
  };
  if (typedActionsEnabled && (!typedActionTask.taskId || !typedActionTask.knowledgeComponent)) {
    throw new Error('--typed-actions requires non-empty task id and knowledge component');
  }
  const typedActionConfig = {
    schema: TUTOR_TYPED_ACTION_CONFIG_SCHEMA,
    enabled: typedActionsEnabled,
    defaultOff: true,
    policyMode: 'closed_loop',
    decisionTiming: 'after_current_public_learner_observation_before_tutor_output',
    outcomeHorizon: 'next_public_learner_observation',
    selectionMethod: 'deterministic_closed_loop_argmax',
    selectionProbability: 1,
    scaffoldLifecycle: {
      enabled: typedActionsEnabled,
      schema: SCAFFOLD_LIFECYCLE_SCHEMA,
      phases: ['diagnose', 'support', 'observe_uptake', 'fade', 'independent_work', 'transfer', 'recover'],
      drivenBy: ['typed_action_decision', 'closed_public_outcome'],
    },
    supportLevel: typedActionSupportLevel,
    task: typedActionTask,
  };
  const dagFactDropoutConfig = {
    schema: TUTOR_STUB_DAG_FACT_DROPOUT_SCHEMA,
    rate: dagFactDropoutRate,
    seed: dagFactDropoutSeed,
    enabled: dagFactDropoutRate > 0,
    graceTurns: 2,
    maxConcurrent: 2,
    eligibleFacts: 'adopted_public_premises_only',
    backgroundFactsImmune: true,
    visibility: 'conduct',
  };
  const releasePacingConfig = {
    schema: 'machinespirits.tutor-stub.release-pacing.v1',
    baseSpeed: releaseSpeed,
    adaptive: true,
    range: [MIN_TUTOR_STUB_RELEASE_SPEED, MAX_TUTOR_STUB_RELEASE_SPEED],
    directLearnerRequests: true,
    maxReleaseBatchesPerTutorTurn: 1,
  };
  const maxTokens = parsePositiveInt(args['max-tokens'], '--max-tokens');
  const historyTurns = parsePositiveInt(args['history-turns'], '--history-turns');
  const memorySummaryEnabled = Boolean(STUB.memorySummary && !args['no-memory-summary']);
  const autoLearnerEnabled = Boolean(args['auto-learner']);
  const mixedLearnerRequested = Boolean(args['mixed-learner'] || args['mixed-mode']);
  const mixedLearnerEnabled = Boolean(mixedLearnerRequested && !autoLearnerEnabled);
  const interactiveSessionEnabled = interactiveSessionIntent;
  const turnFeedbackEnabled = Boolean(
    STUB.turnFeedback && !args['no-turn-feedback'] && interactiveSessionEnabled && !autoLearnerEnabled,
  );
  const responseDetailsEnabled = Boolean(STUB.responseDetails && !args['no-response-details']);
  const learnerSuggestionEnabled = Boolean(
    !passthroughEnabled && (autoLearnerEnabled || mixedLearnerEnabled || interactiveSessionEnabled),
  );
  // Suggesting learner turns to a human is a harness feature and stays off under
  // passthrough. Resolving a learner model is not the same question: if the
  // automated learner is going to speak, it needs a model whatever the tutor is
  // running. Keeping these separate is what lets an evaluation harness point a
  // learner at a bare tutor.
  const learnerModelRequired = Boolean(learnerSuggestionEnabled || autoLearnerEnabled);
  const autoTurns = parseAutoTurns(args['auto-turns']);
  const autoSafetyTurns = parsePositiveInt(args['auto-safety-turns'], '--auto-safety-turns');
  const autoStopOnGrounded = !args['no-auto-stop-on-grounded'];
  if (autoLearnerEnabled && autoTurns === null && !autoStopOnGrounded) {
    throw new Error(
      '--auto-turns until-grounded requires grounded-closure stopping; remove --no-auto-stop-on-grounded',
    );
  }
  const launchWorldBundle = resolveWorldRef(args.world);
  const rememberedScenarioAvailable = rememberedSettings.appliedFields.includes('scenario');
  const existingScenarioAvailable = Boolean(explicitRememberedSources.scenario || rememberedScenarioAvailable);
  const initialScenarioPickerEnabled = Boolean(
    interactiveSessionEnabled &&
    STUB.opening &&
    !args['no-opening'] &&
    !resumeRequested &&
    launchWorldBundle &&
    !existingScenarioAvailable,
  );
  const initialScenarioKeyboardMenuActive = Boolean(
    initialScenarioPickerEnabled &&
    !args['dry-run'] &&
    input.isTTY &&
    output.isTTY &&
    typeof input.setRawMode === 'function',
  );
  let initialScenarioSelection = null;
  if (initialScenarioKeyboardMenuActive) {
    const defaultScenarioId = launchWorldBundle.world.id;
    console.log(`${C.cyan}Pick a scenario${C.reset}`);
    console.log(
      `${C.dim}  ↑/↓ scroll · Enter select · highlighted scenario described below · Esc quit · ${defaultScenarioId} selected by default${C.reset}`,
    );
    const selection = await pickInitialScenarioWithKeyboard(args.world);
    if (!selection) {
      console.log(`${C.dim}scenario picker cancelled${C.reset}`);
      return;
    }
    args.world = selection.filePath;
    initialScenarioSelection = {
      scenarioId: selection.id,
      title: selection.title,
      defaultScenarioId,
      usedDefault: selection.id === defaultScenarioId,
      selectionMethod: 'keyboard_menu',
    };
    console.log(`${C.cyan}scenario >${C.reset} ${selection.id} — ${selection.title}\n`);
  }
  const worldBundle = resolveWorldRef(args.world);
  const directorContext = buildDirectorInitialContext(worldBundle?.world || null);
  const effectiveTopic =
    curriculumBundle && args.topic === STUB.topic
      ? curriculumBundle.module.title
      : worldBundle && args.topic === STUB.topic
        ? worldBundle.world.title
        : args.topic;
  const dagMode = normalizeDagMode(args['dag-mode']);
  const pointOfActionArm = normalizeTutorStubPointOfActionArm(args['point-of-action-arm']);
  const multipleChoiceEnabled = Boolean(args['multiple-choice']);
  assertSupportedModelRefs({
    '--model': args.model,
    '--classifier-model': args['classifier-model'],
    '--learner-record-model': args['learner-record-model'],
    '--auto-learner-model': args['auto-learner-model'],
  });
  let systemPrompt = loadSystemPrompt({
    worldBundle,
    curriculumBundle,
    dag: args.dag,
    topic: effectiveTopic,
    multipleChoice: multipleChoiceEnabled,
  });
  const tuning = createTutorStubTuningRuntime({
    instance: tutorInstance,
    mode: tuningMode,
    dir: args['tuning-dir'],
    write: !args['dry-run'],
  });
  systemPrompt = `${systemPrompt}\n\n${tutorStubTutorInstancePrompt(tutorInstance)}`;
  const reviewedTutorMemory = tutorStubTuningPrompt(tuning);
  if (reviewedTutorMemory) systemPrompt = `${systemPrompt}\n\n${reviewedTutorMemory}`;
  // Green Room prompt-book injection (GREEN-ROOM-PLAN.md §0.1.6): a static,
  // per-performance role memory appended to the tutor system prompt. Frozen
  // for the whole run; craft guidance only — never overrides world rules or
  // the release schedule.
  if (args['prompt-book-context']) {
    const promptBookText = fs.readFileSync(path.resolve(args['prompt-book-context']), 'utf8');
    systemPrompt = `${systemPrompt}\n\n[Prompt book — your durable role memory from prior performances. Honour its notes as craft guidance; it never overrides world rules or the release schedule.]\n${promptBookText}\n[End prompt book]`;
    console.log(`[greenroom] prompt book injected: ${promptBookText.length} chars from ${args['prompt-book-context']}`);
  }
  if (pointOfActionArm === 'standing_book') {
    const standingBook = tutorStubPointOfActionStandingBook();
    systemPrompt = `${systemPrompt}\n\n${standingBook}`;
    console.log(`[step4] standing point-of-action book injected: ${standingBook.length} chars`);
  }
  if (curriculumBundle && curriculumRuntime) {
    systemPrompt = `${systemPrompt}\n\n${delimitedPrompt(
      CURRICULUM_PHASE_PROMPT_START,
      tutorStubCurriculumPrivatePrompt(curriculumBundle, curriculumRuntime),
      CURRICULUM_PHASE_PROMPT_END,
    )}`;
  }
  const promptArchitecture = tutorStubPromptArchitecture({
    dagEnabled: Boolean(args.dag && worldBundle),
  });
  promptArchitecture.audit.baseSystem = auditTutorStubPrompt({
    surface: 'tutor_system',
    systemPrompt,
    instructionTexts: [systemPrompt],
  });
  promptArchitecture.audit.baseSpeakerPrivilege = auditTutorStubSpeakerPrivilege({
    world: args.dag ? worldBundle?.world || null : null,
    tutorTurn: 0,
    systemPrompt,
  });
  if (!promptArchitecture.audit.baseSystem.ok) {
    throw new Error(
      `Base prompt audit failed: ${promptArchitecture.audit.baseSystem.violations
        .map((violation) => violation.code)
        .join(', ')}`,
    );
  }
  if (!promptArchitecture.audit.baseSpeakerPrivilege.ok) {
    throw new Error(
      `Base speaking-tutor prompt crossed the private-planner boundary: ${promptArchitecture.audit.baseSpeakerPrivilege.issues
        .map((issue) => `${issue.code}:${issue.source}`)
        .join(', ')}`,
    );
  }
  const tutorDag = args.dag && worldBundle ? buildTutorDesireDag(worldBundle.world) : null;
  const resolved = resolveModel(args.model);
  const providerConfig = getProviderConfig(resolved.provider);
  let autoLearnerResolved = learnerModelRequired ? resolveModel(args['auto-learner-model']) : null;
  let autoLearnerProviderConfig = autoLearnerResolved ? getProviderConfig(autoLearnerResolved.provider) : null;
  const classifierEnabled = !args['no-classifier'];
  const tutorLearnerDagEnabled = Boolean(args['tutor-learner-dag'] && worldBundle);
  const humanDiscourseConfig = buildHumanDiscourseRunConfig({
    dagMode,
    dagEnabled: args.dag,
    tutorLearnerDagEnabled,
  });
  const humanDiscoursePreviewFrame = buildHumanDiscourseFrame({
    state: {
      world: worldBundle?.world || null,
      dag: args.dag,
      dagMode,
      humanDiscourse: humanDiscourseConfig,
      turns: [],
    },
    tutorTurn: 1,
    tutorLearnerDag: null,
    classification: null,
    learnerText: '',
  });
  const combinedLearnerAnalysisEnabled = Boolean(classifierEnabled && tutorLearnerDagEnabled);
  const registerPolicyStack = parseTutorStubRegisterPolicyStack(args['register-policy']);
  const registerPolicy = registerPolicyStack.primary;
  const registerPolicyOverlays = registerPolicyStack.overlays;
  const registerOverlayThreshold = normalizeTutorStubRegisterOverlayThreshold(args['register-overlay-threshold'], {
    label: '--register-overlay-threshold',
  });
  const experimentConfig = {
    schema: 'machinespirits.tutor-stub.experiment-identity.v1',
    runSeed: experimentRunSeed,
    profile: automatedLearnerProfileId(args['auto-learner-profile']) || 'custom',
    policy: registerPolicy,
    repeat: experimentRepeat,
    jobId: String(args['eval-job-id'] || '').trim() || null,
    dagFactDropoutSeed,
    independentSeeds: true,
  };
  const registerEmpiricalPrior = loadRegisterEmpiricalPrior(args['register-empirical-prior'], {
    policy: registerPolicy,
  });
  const registerPaletteMode =
    registerPolicy === 'negative' ? 'negative' : args['safe-registers'] ? 'safe' : args['register-palette'];
  const registerPalette = buildRegisterPalette(registerPaletteMode);
  const randomRegisterSelectionEnabled = registerPolicy === 'random';
  const negativeRegisterSelectionEnabled = registerPolicy === 'negative';
  const fieldRegisterSelectionEnabled = registerPolicy === 'field';
  const trajectoryRegisterSelectionEnabled = registerPolicy === 'trajectory';
  const dynamicalSystemRegisterSelectionEnabled = registerPolicy === 'dynamical_system';
  const empiricalDynamicalSystemRegisterSelectionEnabled = registerPolicy === 'empirical_dynamical_system';
  const continuousDynamicalSystemRegisterSelectionEnabled = registerPolicy === 'continuous_dynamical_system';
  const continuousEmpiricalDynamicalSystemRegisterSelectionEnabled =
    registerPolicy === 'continuous_empirical_dynamical_system';
  const continuousRegisterSelectionEnabled = Boolean(
    continuousDynamicalSystemRegisterSelectionEnabled || continuousEmpiricalDynamicalSystemRegisterSelectionEnabled,
  );
  const continuousUnsafeRegisterAnchorsEnabled = Boolean(
    continuousRegisterSelectionEnabled &&
    !args['safe-registers'] &&
    /(^|,)(all|simulated|negative|negative-floor|ironic|sarcastic|face_threat)(,|$)/iu.test(
      String(args['register-palette'] || ''),
    ),
  );
  const stateRegisterSelectionEnabled = registerPolicy === 'state';
  const registerSelectionEnabled = Boolean(
    !args['no-register-selection'] &&
    registerPalette.length &&
    (combinedLearnerAnalysisEnabled ||
      randomRegisterSelectionEnabled ||
      negativeRegisterSelectionEnabled ||
      lightAdaptationEnabled),
  );
  const requestedTutorCharacter = resolveTutorStubCharacterChoice(args['tutor-character']);
  const initialTutorCharacter =
    requestedTutorCharacter.raw && !requestedTutorCharacter.clearing ? requestedTutorCharacter.id : null;
  if (initialTutorCharacter && !requestedTutorCharacter.options.includes(initialTutorCharacter)) {
    throw new Error(`--tutor-character must be one of ${requestedTutorCharacter.options.join(', ')}, or auto`);
  }
  if (initialTutorCharacter && !registerSelectionEnabled) {
    throw new Error(
      '--tutor-character requires adaptive delivery; remove --no-register-selection and enable learner analysis',
    );
  }
  let classifierResolved =
    classifierEnabled && !combinedLearnerAnalysisEnabled ? resolveModel(args['classifier-model']) : null;
  let classifierProviderConfig = classifierResolved ? getProviderConfig(classifierResolved.provider) : null;
  let learnerRecordResolved = tutorLearnerDagEnabled ? resolveModel(args['learner-record-model']) : null;
  let learnerRecordProviderConfig = learnerRecordResolved ? getProviderConfig(learnerRecordResolved.provider) : null;
  const firstMessage = args.once || positionals.join(' ').trim() || '';
  if (
    rawCommandLineOptionProvided('training-reuse') &&
    rawCommandLineOptionProvided('no-training-reuse') &&
    args['no-training-reuse']
  ) {
    throw new Error('--training-reuse cannot be combined with --no-training-reuse');
  }
  const requestedTrainingReuse = args['no-training-reuse']
    ? 'off'
    : normalizeTutorStubTrainingReuseSetting(args['training-reuse'], { label: '--training-reuse' });
  const humanSubjectClass = normalizeTutorStubHumanSubjectClass(args['human-subject-class'], {
    label: '--human-subject-class',
  });
  const trainingReuseConfig = resolveTutorStubTrainingReuse({
    requested: requestedTrainingReuse,
    source: resolvedTrainingReuseSource(rememberedSettings),
    humanSubjectClass,
    humanSubjectClassSource: resolvedHumanSubjectClassSource(),
    humanInputExpected: Boolean(interactiveSessionIntent || firstMessage),
  });
  // Recipes store the canonical requested value. The effective status remains
  // fail-closed for external/unknown users and is recorded separately.
  args['training-reuse'] = trainingReuseConfig.requested;
  args['human-subject-class'] = trainingReuseConfig.declaredHumanSubjectClass;
  let visibleModel = visibleResolvedModel(resolved, providerConfig);
  let visibleAutoLearnerModel = autoLearnerResolved
    ? visibleResolvedModel(autoLearnerResolved, autoLearnerProviderConfig)
    : null;
  let visibleClassifierModel = classifierResolved
    ? visibleResolvedModel(classifierResolved, classifierProviderConfig)
    : null;
  let visibleLearnerRecordModel = learnerRecordResolved
    ? visibleResolvedModel(learnerRecordResolved, learnerRecordProviderConfig)
    : null;
  let visibleClassifierConfig = classifierEnabled
    ? combinedLearnerAnalysisEnabled
      ? {
          combined: true,
          classifierModelRef: args['classifier-model'],
          modelRef: args['learner-record-model'],
          resolved: visibleLearnerRecordModel,
        }
      : {
          modelRef: args['classifier-model'],
          resolved: visibleClassifierModel,
        }
    : { enabled: false };
  const effectiveTemperature = effectiveTemperatureForModel(resolved, temperature);
  const traceEnabled = !args['no-trace'];
  const traceDir = resolveWorkspacePath(args['trace-dir']);
  const streamEnabled = Boolean(STUB.stream && !args['no-stream']);
  const interimAnimationEnabled = Boolean(STUB.interimAnimation && !args['no-interim-animation']);
  const fieldVisualizationEnabled = Boolean(args['field-viz']);
  const openingEnabled = Boolean(STUB.opening && !args['no-opening']);
  const openingFramePreview = buildTutorStubOpeningFrame({
    world: worldBundle?.world || null,
    openingEvidence: worldBundle
      ? worldBundle.world.releaseSchedule
          .filter((entry) => Number(entry.turn) === 1)
          .map((entry) => ({
            premise: entry.premise,
            via: entry.via,
            surface: worldBundle.world.premiseById.get(entry.premise)?.surface || '',
          }))
      : [],
  });
  const closeoutReportEnabled = Boolean(STUB.closeoutReport && !args['no-closeout-report']);
  const dialogueClosureConfig = createTutorStubDialogueClosureLifecycle({
    enabled: Boolean(
      args.dag && worldBundle && (!autoLearnerEnabled || (tutorLearnerDagEnabled && autoStopOnGrounded)),
    ),
    allowCheckIn: Boolean(!autoLearnerEnabled && !firstMessage),
    allowAuthoredDagClosure: Boolean(!autoLearnerEnabled),
  });
  const cliEffort = normalizeCliEffort(args['cli-effort']);
  const learnerAnalysisPromptProfile = normalizeTutorStubPublicLearnerAnalysisPromptProfile(
    args['learner-analysis-prompt-profile'],
  );
  const learnerAnalysisEvidenceUseRubric = normalizeTutorStubEvidenceUseRubric(
    args['learner-analysis-evidence-use-rubric'],
  );
  const mixedTutorPrefetchPolicy = String(args['mixed-tutor-prefetch-policy'] || 'always')
    .trim()
    .toLowerCase();
  if (!['always', 'analysis_only'].includes(mixedTutorPrefetchPolicy)) {
    throw new Error('--mixed-tutor-prefetch-policy must be always or analysis_only');
  }
  const tutorStreamState = !streamEnabled
    ? 'off'
    : providerSupportsEventStreaming(resolved)
      ? 'cli_events'
      : !providerSupportsStreaming(resolved)
        ? 'unavailable_cli_buffered'
        : args.dag && worldBundle
          ? 'guarded_after_audit'
          : interactiveSessionEnabled
            ? 'buffered_for_concurrent_input'
            : 'live';
  const resumeCandidate = resolvedResumeSource;
  const rememberedDialogueSettingsAvailable = rememberedSettings.status === 'loaded';
  const initialProfilePromptEnabled = Boolean(
    mixedLearnerEnabled &&
    !explicitRememberedSources.learnerProfile &&
    !rememberedSettings.appliedFields.includes('learner_profile'),
  );
  const initialTemperaturePromptEnabled = Boolean(
    registerSelectionEnabled &&
    registerTemperatureApplies(registerPolicy) &&
    !rememberedDialogueSettingsAvailable &&
    !explicitRememberedSources.engagementStanceTemperature,
  );
  const initialDropoutPromptEnabled = Boolean(
    tutorLearnerDagEnabled && !rememberedDialogueSettingsAvailable && !explicitRememberedSources.dagFactDropoutRate,
  );
  const initialReleaseSpeedPromptEnabled = Boolean(
    worldBundle && !rememberedDialogueSettingsAvailable && !explicitRememberedSources.releaseSpeed,
  );
  const initialMixedLearnerSetupEnabled = Boolean(
    mixedLearnerEnabled &&
    openingEnabled &&
    !firstMessage &&
    !resumeCandidate &&
    (initialProfilePromptEnabled ||
      initialTemperaturePromptEnabled ||
      initialDropoutPromptEnabled ||
      initialReleaseSpeedPromptEnabled),
  );
  const instantExistingScenarioOpening = Boolean(
    interactiveSessionEnabled &&
    openingEnabled &&
    !firstMessage &&
    !resumeRequested &&
    rememberedScenarioAvailable &&
    rememberedDialogueSettingsAvailable &&
    !initialMixedLearnerSetupEnabled,
  );
  const startupOpeningRealizer =
    openingFramePreview.realization === 'authored_world_opening'
      ? 'authored_world_opening'
      : instantExistingScenarioOpening
        ? 'deterministic'
        : openingRealizer;
  const openingConfig = {
    enabled: openingEnabled,
    printedByDefault: Boolean(openingEnabled && !firstMessage),
    schema: openingFramePreview.schema,
    realization:
      startupOpeningRealizer === 'authored_world_opening'
        ? startupOpeningRealizer
        : startupOpeningRealizer === 'model'
          ? 'speaking_tutor_model'
          : instantExistingScenarioOpening
            ? 'remembered_scenario_instant_opening'
            : 'world_grounded_deterministic',
    speakingModelRef: startupOpeningRealizer === 'model' ? args.model : null,
    authoredTextAvailable: Boolean(openingFramePreview.authoredText),
    requirements: TUTOR_STUB_OPENING_REQUIREMENTS,
    safetyAudit: true,
    fallback: 'world_grounded_safe_fallback',
    startup: {
      mode: instantExistingScenarioOpening ? 'instant_existing_scenario' : 'normal',
      restoredScenario: rememberedScenarioAvailable,
      blocksOnOpeningModel: startupOpeningRealizer === 'model',
      blocksOnMixedPrefetch: Boolean(mixedLearnerEnabled && !instantExistingScenarioOpening),
    },
  };
  const initialScenarioPickerConfig = {
    enabled: initialScenarioPickerEnabled,
    defaultScenarioId: launchWorldBundle?.world?.id || null,
    selectedScenarioId: worldBundle?.world?.id || null,
    keyboardMenu: true,
    activeInThisTerminal: initialScenarioKeyboardMenuActive,
    navigation: ['up', 'down', 'pageup', 'pagedown', 'home', 'end', 'enter'],
    descriptionFields: ['question', 'setting', 'discipline'],
    nonTtyFallback: '--world',
    selection: initialScenarioSelection,
    reason: initialScenarioPickerEnabled
      ? 'no_saved_or_explicit_scenario'
      : existingScenarioAvailable
        ? 'existing_scenario_restored_or_explicit'
        : resumeRequested
          ? 'resume_requested'
          : 'not_interactive_opening',
  };
  const mixedLearnerStartupPrompts = {
    enabled: initialMixedLearnerSetupEnabled,
    // Model selection was removed from first-run setup (2026-07-12): the
    // launch/default model is used and stays changeable via `/settings model`.
    order: [
      ...(initialProfilePromptEnabled ? ['learner_profile'] : []),
      ...(initialTemperaturePromptEnabled ? ['engagement_stance_temperature'] : []),
      ...(initialDropoutPromptEnabled ? ['dag_fact_dropout'] : []),
      ...(initialReleaseSpeedPromptEnabled ? ['clue_release_speed'] : []),
    ],
    tutorModel: {
      enabled: false,
      firstRunSelection: false,
      default: args.model,
      recommended: STUB.model,
      liveCommand: '/settings model <provider.alias>',
    },
    engagementStanceTemperature: {
      enabled: initialTemperaturePromptEnabled,
      default: registerTemperature,
      recommended: DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
      range: [MIN_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE, MAX_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE],
    },
    dagFactDropout: {
      enabled: initialDropoutPromptEnabled,
      default: dagFactDropoutRate,
      recommended: DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_RATE,
      range: [0, 1],
      seed: dagFactDropoutSeed,
    },
    clueReleaseSpeed: {
      enabled: initialReleaseSpeedPromptEnabled,
      default: releaseSpeed,
      recommended: DEFAULT_TUTOR_STUB_RELEASE_SPEED,
      range: [MIN_TUTOR_STUB_RELEASE_SPEED, MAX_TUTOR_STUB_RELEASE_SPEED],
      adaptive: true,
    },
  };
  const interactiveRoleModes = {
    enabled: Boolean(interactiveSessionEnabled && !passthroughEnabled),
    default: 'learner',
    modes: ['learner', 'coach', 'auto'],
    commands: {
      learner: ['/mode learner'],
      coach: ['/mode coach [guidance]', '/coach [guidance]'],
      auto: ['/mode auto [turns]', '/auto [turns]'],
      demo: ['/demo [turns]'],
      status: '/status',
    },
    coach: {
      private: true,
      appliesTo: 'next_tutor_turn',
      publicTranscriptChanged: false,
      evidenceAndSafetyGuardsRemainActive: true,
    },
    auto: {
      modelRef: args['auto-learner-model'],
      resolved: visibleAutoLearnerModel,
      profileId: automatedLearnerProfileId(args['auto-learner-profile']),
      defaultTurns: autoTurns ?? 'until-grounded',
      safetyTurns: autoSafetyTurns,
      stopOnGrounded: autoStopOnGrounded,
    },
    demo: {
      launchRequested: Boolean(args.demo),
      command: '/demo [turns]',
      defaultTurns: DEFAULT_INTERACTIVE_DEMO_TURNS,
      maxTurns: MAX_INTERACTIVE_DEMO_TURNS,
      sequence: ['bounded_live_dialogue', 'plain_analysis', 'transcript_html', 'compact_outcome_report'],
      returnsControl: true,
    },
    concurrentCommandSurface: {
      enabled: interactiveSessionEnabled,
      activityLine: 'above_prompt',
      inputLine: 'persistent_bottom_line',
      acceptsCommandsDuringTutorTurn: true,
      acceptsCommandsDuringAutoMode: true,
      streamingDisplay: 'buffered_while_command_line_is_live',
    },
    compoundLearnerTurns: {
      schema: 'machinespirits.tutor-stub.compound-learner-turn.v1',
      enabled: interactiveSessionEnabled,
      boundary: 'until_tutor_response_is_displayed',
      additionalMessages: 'abort_or_invalidate_then_regenerate',
      tracePreservesTypedMessages: true,
      analysisAndTutorView: 'one_compound_learner_turn',
    },
    learnerResponseProvenance: {
      schema: TUTOR_STUB_LEARNER_RESPONSE_PROVENANCE_SCHEMA,
      categories: ['human', 'ai', 'hybrid', 'unknown'],
      recordedOn: ['learner_message_fragment', 'completed_turn', 'trace_event', 'html_transcript', 'learning_summary'],
      humanSources: ['terminal', 'voice_transcription', 'command_line_argument'],
      aiSources: ['automated_learner', 'mixed_suggestion_accepted'],
      hybridSource: 'mixed_suggestion_edited',
      compoundAggregation: true,
    },
  };
  const turnFeedbackConfig = {
    schema: 'machinespirits.tutor-stub.turn-feedback-config.v1',
    enabled: turnFeedbackEnabled,
    defaultOn: true,
    optional: true,
    scope: 'human_learner_mode',
    ratings: ['up', 'down'],
    commands: ['/up [reason]', '/down [reason] [comment]', '/feedback up|down|clear|on|off'],
    reasons: Object.keys(TUTOR_STUB_FEEDBACK_REASONS),
    keyboardShortcuts: {
      scope: 'empty_input_line_with_pending_rating',
      immediate: true,
      leftArrow: 'down',
      rightArrow: 'up',
      escape: 'disable_for_session',
    },
    learnerMessageField: 'tutorFeedback',
    automatedLearner: 'disabled',
    tutorSelfAssessment: true,
    liveAdaptation: {
      horizon: 'next_tutor_response_only',
      private: true,
      observableChangeAudited: true,
      safetyPrecedence: true,
    },
    learningRecord: {
      schema: 'machinespirits.tutor-stub.feedback-observation.v1',
      joinsRatedResponseToLearnerReplyAndNextTutorOutcome: true,
      separatesSubjectiveHelpfulnessFromObjectiveProgress: true,
      causalClaim: false,
    },
  };
  const responseDetailsConfig = {
    schema: 'machinespirits.tutor-stub.response-details.v1',
    enabled: responseDetailsEnabled,
    defaultOn: true,
    scope: 'terminal_session',
    order: 'before_tutor_speech',
    timingSchema: 'machinespirits.tutor-stub.turn-timing.v1',
    timingScope: 'foreground_wait_from_accepted_learner_input',
    command: '/details on|off|status',
    launchFlag: '--no-response-details',
    environment: 'TUTOR_STUB_RESPONSE_DETAILS=0',
    publicTranscriptChanged: false,
  };
  const explanatoryDebugConfig = {
    enabledByDefault: false,
    defaultFormat: 'prose',
    command: '/debug on [prose|technical]|off|show [prose|technical]|technical',
    prose: {
      generatedBy: 'llm',
      targetWords: '45-80',
      maxSentences: 3,
    },
    technicalSections: ['learner_analysis', 'field_calculations', 'register_consequence'],
    automaticAfterCompletedTurn: true,
  };
  const learningSummaryReportConfig = {
    enabled: Boolean(!passthroughEnabled && (autoLearnerEnabled || firstMessage || interactiveSessionEnabled)),
    automaticOnConversationEnd: true,
    requiresCompletedTurn: true,
    format: 'html',
    publicEvidenceOnly: true,
    launchInInteractiveTty: process.env.TUTOR_STUB_SUMMARY_OPEN !== '0',
  };
  const rememberedSettingsConfig = {
    enabled: rememberedSettings.enabled,
    writeEnabled: Boolean(rememberedSettings.writeEnabled && !passthroughEnabled),
    file: path.relative(ROOT, rememberedSettings.filePath),
    status: rememberedSettings.status,
    loadedAt: rememberedSettings.loadedAt,
    appliedFields: [...rememberedSettings.appliedFields],
    skippedExplicitFields: [...rememberedSettings.skippedExplicitFields],
    warning: rememberedSettings.warning,
    scope: 'human_interactive_sessions_only',
    precedence: 'explicit_cli_or_environment_then_remembered_then_repository_default',
  };
  const learnerDagPreflightConfig = {
    schema: TUTOR_STUB_LEARNER_DAG_PREFLIGHT_SCHEMA,
    enabled: tutorLearnerDagEnabled,
    timing: 'before_first_learner_analysis_model_call',
    inputs: ['prior_public_learner_record', 'committed_public_evidence', 'public_rules'],
    output: ['eligible_public_premise_ids', 'possible_next_derivations'],
    semanticMapping: 'analysis_model_maps_free_text_to_candidate_updates',
    commitAuthority: 'deterministic_postprocessor_after_model',
  };
  const passthroughConfig = {
    schema: 'machinespirits.tutor-stub.passthrough.v1',
    enabled: passthroughEnabled,
    modelCallsPerTurn: passthroughEnabled ? 1 : null,
    requestSurface: passthroughEnabled ? ['system_setup', 'full_public_history', 'latest_learner_message'] : null,
    // Observation is not a bypass reversal: every entry in `bypassed` below
    // stays bypassed with this on. The audits run after the draft is final and
    // cannot send it back, so the call count and request surface are unchanged.
    observedAudits: observedAuditsEnabled,
    bypassed: passthroughEnabled
      ? [
          'learner_classifier',
          'learner_dag',
          'register_selection',
          'human_discourse_scaffold',
          'response_composition',
          'response_checks_and_repair',
          'release_planner',
          'dialogue_closure',
          'mixed_prefetch',
          'tutor_feedback',
          'learning_summary',
        ]
      : [],
  };
  const capabilitySnapshot = resolveTutorStubCapabilities({
    passthrough: passthroughEnabled,
    interactive: interactiveSessionEnabled,
    world: Boolean(worldBundle),
    curriculum: Boolean(curriculumBundle),
    dag: Boolean(args.dag && worldBundle),
    learnerDag: tutorLearnerDagEnabled,
    classifier: classifierEnabled,
    registerSelection: registerSelectionEnabled,
    mixedLearner: mixedLearnerEnabled,
    autoLearner: autoLearnerEnabled,
    demo: Boolean(args.demo),
    turnFeedback: turnFeedbackEnabled,
    tuning: tuningMode !== 'off',
    voice: voiceLaunchRequested,
    trace: traceEnabled,
    fieldVisualization: fieldVisualizationEnabled,
    learningSummary: learningSummaryReportConfig.enabled,
    responseChecks: !passthroughEnabled,
  });
  assertTutorStubCapabilityCompatibility(capabilitySnapshot);
  const selectedLabMetadata = selectedLabResolution
    ? {
        ...tutorStubLabTraceMetadata(selectedLabResolution),
        resolvedCapabilities: [...capabilitySnapshot.active],
        admission: selectedLabAdmission,
      }
    : null;
  const sessionRecipe = buildTutorStubSessionRecipe({
    args,
    lab: selectedLabResolution?.lab?.id || null,
    identity: {
      schema: TUTOR_STUB_SESSION_RUNTIME_SCHEMA,
      world: worldBundle?.world?.id ? { id: worldBundle.world.id } : curriculumBundle ? { id: null } : null,
      prompt: {
        systemPromptHash: hashCanonicalJson({ systemPrompt }),
        tutorRolePromptHash: tutorInstance.rolePromptHash,
      },
      tutor: {
        ref: tuning.activeRef,
        rolePromptHash: tutorInstance.rolePromptHash,
      },
      models: {
        tutor: tutorStubRecipeModelIdentity(args.model, visibleModel),
        classifier: tutorStubRecipeModelIdentity(args['classifier-model'], visibleClassifierModel),
        reasoning: tutorStubRecipeModelIdentity(args['learner-record-model'], visibleLearnerRecordModel),
        learner: tutorStubRecipeModelIdentity(args['auto-learner-model'], visibleAutoLearnerModel),
      },
    },
  });
  const recipeDrift = loadedSessionRecipe
    ? compareTutorStubResumeRecipe(loadedSessionRecipe, sessionRecipe, {
        extraDrift: (loadedRecipeApplication?.explicitOverrides || []).map((entry) => ({
          ...entry,
          axis: `option.${entry.axis}`,
        })),
      })
    : null;
  if (recipeDrift) {
    assertTutorStubResumeCompatibility(recipeDrift, {
      acknowledgeDrift: args['acknowledge-drift'],
      context: 'recipe',
    });
  }
  const resumeDrift = resumeCandidate
    ? compareTutorStubResumeRecipe(resumeCandidate.recipe, sessionRecipe, {
        extraDrift: (resumeRecipeApplication?.explicitOverrides || []).map((entry) => ({
          ...entry,
          axis: `option.${entry.axis}`,
        })),
      })
    : null;
  if (resumeDrift) {
    assertTutorStubResumeCompatibility(resumeDrift, { acknowledgeDrift: args['acknowledge-drift'] });
  }
  const loadedRecipeProvenance = loadedSessionRecipe
    ? {
        source: path.relative(ROOT, loadedSessionRecipe.filePath),
        drift: recipeDrift,
        driftAcknowledged: Boolean(args['acknowledge-drift'] && !recipeDrift?.ok),
      }
    : null;
  if (args['write-recipe']) {
    loadedSessionRecipePath = writeTutorStubSessionRecipe({
      recipe: sessionRecipe,
      filePath: resolveWorkspacePath(args['write-recipe']),
    });
  }

  if (args['show-prompt']) {
    console.log(`${C.dim}--- system prompt ---${C.reset}`);
    console.log(systemPrompt);
    console.log(`${C.dim}--- end system prompt ---${C.reset}\n`);
  }

  if (args['dry-run']) {
    console.log(
      JSON.stringify(
        {
          modelRef: args.model,
          resolved: visibleModel,
          tutorInstance: {
            id: tutorInstance.id,
            title: tutorInstance.title,
            requestedRef: args.tutor,
            activeRef: tuning.activeRef,
            sourceVersion: tutorInstance.sourceVersion,
            rolePromptPath: path.relative(ROOT, tutorInstance.rolePromptPath),
            rolePromptHash: tutorInstance.rolePromptHash,
            policyPack: tutorInstance.policyPack,
            modelDefaults: tutorInstance.modelDefaults,
          },
          tuning: tutorStubTuningSnapshot(tuning),
          allModelsOverride,
          voice: {
            schema: 'machinespirits.tutor-stub.voice-runtime.v1',
            launchRequested: voiceLaunchRequested,
            model: voiceModel,
            voice: voiceName,
            transcriptionModel: 'gpt-realtime-whisper',
            apiKeyConfigured: Boolean(process.env.OPENAI_API_KEY),
            automaticRealtimeResponses: false,
            authority: 'existing_cli_analysis_dag_register_guard_pipeline',
          },
          rememberedSettings: rememberedSettingsConfig,
          trainingReuse: trainingReuseConfig,
          lab: selectedLabMetadata,
          sessionRecipe,
          recipeFile: loadedSessionRecipePath ? path.relative(ROOT, loadedSessionRecipePath) : null,
          recipeSource: loadedRecipeProvenance,
          resume: resumeCandidate
            ? {
                source: path.relative(ROOT, resumeCandidate.filePath),
                runId: resumeCandidate.runId,
                turns: resumeCandidate.turns.length,
                migration: resumeCandidate.migration,
                drift: resumeDrift,
                driftAcknowledged: Boolean(args['acknowledge-drift'] && !resumeDrift?.ok),
              }
            : { requested: resumeRequested, found: false },
          passthrough: passthroughConfig,
          capabilities: capabilitySnapshot,
          sessionRuntime: {
            schema: TUTOR_STUB_SESSION_RUNTIME_SCHEMA,
            version: TUTOR_STUB_SESSION_RUNTIME_VERSION,
            lifecycle: ['create', 'load', 'resume', 'step', 'reset', 'finalize'],
            stateIsolation: 'per_runtime_instance',
            commandHandlers: 'registry_owned',
            traceEvents: 'versioned_session_event_envelopes',
          },
          topic: effectiveTopic,
          curriculum: curriculumBundle
            ? {
                id: curriculumBundle.curriculum.id,
                title: curriculumBundle.curriculum.title,
                sourceRef: curriculumBundle.sourceRef,
                sourceHash: curriculumBundle.curriculum.source?.source_hash || null,
                moduleId: curriculumBundle.module.id,
                moduleTitle: curriculumBundle.module.title,
                mode: 'public_reflective_non_dag',
                completionAuthority: curriculumRuntime.completionAuthority,
              }
            : null,
          world: worldBundle
            ? {
                id: worldBundle.world.id,
                title: worldBundle.world.title,
                file: path.relative(ROOT, worldBundle.filePath),
                dag: args.dag,
              }
            : null,
          scenarioPicker: initialScenarioPickerConfig,
          humanDiscourse: humanDiscourseConfig,
          humanDiscoursePreviewFrame,
          comprehensionSideState: {
            enabled: true,
            schema: 'machinespirits.tutor-stub.comprehension-side-state.v1',
            sources: ['learner_turn', 'slash_explain'],
            advancesLearnerDag: false,
          },
          dagFactDropout: dagFactDropoutConfig,
          releasePacing: releasePacingConfig,
          loopExecution: {
            mode: loopMode,
            fixedPublicSafeQuarantine: loopMode === TUTOR_STUB_DIAGNOSTIC_COLLECTION_MODE,
            recoverableFailurePolicy:
              loopMode === TUTOR_STUB_DIAGNOSTIC_COLLECTION_MODE
                ? 'rollback_turn_state_commit_mechanical_quarantine_and_continue'
                : 'fail_fast',
          },
          experiment: experimentConfig,
          typedPedagogicalActions: typedActionConfig,
          responseConfiguration: {
            schema: 'machinespirits.tutor-stub.response-configuration.v3',
            primaryStanceField: 'engagement_stance',
            independentAxes: [
              'engagement_stance',
              'action_family',
              'addressee_profile',
              'lexical_accessibility',
              'scene_immersion',
              'actorial_part',
            ],
            temperatureScope: 'engagement_stance_and_actorial_part',
            transcriptVisibilityAudit: true,
          },
          randomPerformance: {
            available: registerSelectionEnabled,
            enabled: false,
            slashCommand: '/random',
            scope: ['engagement_stance', 'actorial_part'],
            assessmentInfluence: false,
            preservedControls: ['action_family', 'evidence_release', 'dialogue_closure', 'response_safety'],
          },
          lightAdaptation: {
            schema: TUTOR_STUB_LIGHT_ADAPTATION_SCHEMA,
            available: registerSelectionEnabled,
            enabled: lightAdaptationEnabled,
            threshold: lightAdaptationThreshold,
            slashCommand: '/light on|off|status',
            settingsCommand: '/settings light on|off|status',
            defaultScope: 'adaptive_interactive_sessions',
            rememberedPreference: true,
            trigger: 'continued_learner_confusion_or_frustration',
            scope: ['engagement_stance', 'actorial_part'],
            selectionMethod: 'seeded_uniform_excluding_previous',
            preservedControls: [
              'action_family',
              'authored_evidence_source',
              'evidence_release',
              'dialogue_closure',
              'response_safety',
            ],
          },
          performanceDirectives: {
            available: registerSelectionEnabled,
            sessionOnly: true,
            register: null,
            character: initialTutorCharacter,
            slashCommands: ['/register', '/character'],
            precedence: 'light_adaptation_then_explicit_axis_then_random_axis_then_adaptive_policy',
          },
          promptArchitecture,
          learnerAnalysisPromptProfile,
          learnerAnalysisEvidenceUseRubric,
          directorContext,
          temperature: effectiveTemperature,
          requestedTemperature: temperature,
          cliEffort: cliEffort || null,
          classifier: visibleClassifierConfig,
          tutorLearnerDag: tutorLearnerDagEnabled
            ? {
                modelRef: args['learner-record-model'],
                resolved: visibleLearnerRecordModel,
                combinedClassifier: combinedLearnerAnalysisEnabled,
                preflight: learnerDagPreflightConfig,
                multiPremiseAdvance: {
                  enabled: true,
                  schema: 'machinespirits.tutor-stub.learner-advance.v1',
                  validation: 'staged_public_evidence_and_public_rules',
                  downstream: [
                    'classification',
                    'field',
                    'trajectory',
                    'register',
                    'response_configuration',
                    'reports',
                  ],
                },
              }
            : { enabled: false, requested: Boolean(args['tutor-learner-dag']) },
          autoLearner: autoLearnerEnabled
            ? {
                enabled: true,
                modelRef: args['auto-learner-model'],
                resolved: visibleAutoLearnerModel,
                maxTurns: autoTurns ?? 'until-grounded',
                untilGrounded: autoTurns === null,
                safetyTurns: autoTurns === null ? autoSafetyTurns : null,
                stopOnGrounded: autoStopOnGrounded,
                profileId: automatedLearnerProfileId(args['auto-learner-profile']),
                profile: args['auto-learner-profile'],
              }
            : { enabled: false },
          mixedLearner: mixedLearnerEnabled
            ? {
                enabled: true,
                modelRef: args['auto-learner-model'],
                resolved: visibleAutoLearnerModel,
                profileId: automatedLearnerProfileId(args['auto-learner-profile']),
                profile: args['auto-learner-profile'],
                clue: '/clue or /hint',
                accept: 'Tab on an empty learner prompt, /use, or /accept',
                inspect: '/suggest',
                regenerate: '/regen',
                tutorPrefetchPolicy: mixedTutorPrefetchPolicy,
                profilePresentation: {
                  promptLabel: true,
                  intendedPattern: true,
                  visibleExpression: 'profile_signal',
                  readyAnnouncement: 'once_per_profile',
                  firstTutorOrdering: 'ready_profile_then_director_then_tutor',
                  initialPicker: {
                    enabled: initialMixedLearnerSetupEnabled,
                    defaultProfileId: automatedLearnerProfileId(args['auto-learner-profile']) || 'custom',
                    keyboardMenu: true,
                    navigation: ['up', 'down', 'enter'],
                    nonTtyFallback: 'typed_profile_id',
                  },
                },
                startupPrompts: mixedLearnerStartupPrompts,
              }
            : { enabled: false, requested: mixedLearnerRequested },
          interactiveRoleModes,
          turnFeedback: turnFeedbackConfig,
          responseDetails: responseDetailsConfig,
          explanatoryDebug: explanatoryDebugConfig,
          learningSummaryReport: learningSummaryReportConfig,
          registerSelection: registerSelectionEnabled
            ? {
                enabled: true,
                palette: registerPalette,
                policy: registerPolicyStack.id,
                primaryPolicy: registerPolicy,
                overlayPolicies: registerPolicyOverlays,
                overlayThreshold: registerOverlayThreshold,
                temperature: registerTemperature,
                engagementStanceTemperature: registerTemperature,
                temperatureScope: 'engagement_stance_and_actorial_part',
                combinedLearnerAnalysis: combinedLearnerAnalysisEnabled,
                localFieldPolicy: fieldRegisterSelectionEnabled,
                localTrajectoryPolicy: trajectoryRegisterSelectionEnabled,
                localDynamicalSystemPolicy: dynamicalSystemRegisterSelectionEnabled,
                localEmpiricalDynamicalSystemPolicy: empiricalDynamicalSystemRegisterSelectionEnabled,
                localContinuousDynamicalSystemPolicy: continuousDynamicalSystemRegisterSelectionEnabled,
                localContinuousEmpiricalDynamicalSystemPolicy:
                  continuousEmpiricalDynamicalSystemRegisterSelectionEnabled,
                continuousUnsafeRegisterAnchors: continuousUnsafeRegisterAnchorsEnabled,
                localStatePolicy: stateRegisterSelectionEnabled,
                random: randomRegisterSelectionEnabled,
                negative: negativeRegisterSelectionEnabled,
                empiricalPrior: {
                  status: registerEmpiricalPrior.status,
                  path: registerEmpiricalPrior.filePath ? path.relative(ROOT, registerEmpiricalPrior.filePath) : null,
                  observationCount: registerEmpiricalPrior.prior?.source?.observationCount ?? null,
                },
              }
            : { enabled: false },
          pointOfAction: pointOfActionArm
            ? {
                enabled: true,
                arm: pointOfActionArm,
                detectorVersion: 'step4-frozen-2026-07-14.v1',
                eligibleTurns: [3, 24],
                triggerPriority: ['stagnant_repeat', 'warrant_skip'],
                committee:
                  pointOfActionArm === 'committee'
                    ? {
                        model: args['committee-mini-model'],
                        fallbackPolicy: args['committee-fallback-policy'],
                        control: '/committee on|off|status',
                      }
                    : null,
              }
            : { enabled: false },
          maxTokens,
          historyTurns,
          speakerHistory: {
            mode: 'full_public_replay',
            perspectives: ['tutor', 'learner'],
            roles: ['system', 'user', 'assistant'],
            directApiTransport: 'native_messages',
            cliTransport: 'flattened_at_bridge_boundary',
            automatedLearnerBudgetFallback: {
              enabled: true,
              trigger: 'prompt_audit_budget_violation',
              mode: 'budget_window_public_replay',
              recentTurns: historyTurns,
              publicOnly: true,
            },
          },
          memorySummary: {
            enabled: memorySummaryEnabled,
            rawRecentTurns: historyTurns,
            publicSummary: memorySummaryEnabled,
            scope: 'auxiliary_analysis_prompts',
          },
          trace: traceEnabled
            ? {
                enabled: true,
                dir: path.relative(ROOT, traceDir),
              }
            : { enabled: false },
          stream: {
            enabled: streamEnabled,
            tutor: tutorStreamState,
            tutorLive: tutorStreamState === 'live',
            tutorGuardedAfterAudit: tutorStreamState === 'guarded_after_audit',
            classifier:
              streamEnabled && classifierResolved
                ? providerSupportsStreaming(classifierResolved) || providerSupportsEventStreaming(classifierResolved)
                : false,
            learnerAnalysis:
              streamEnabled && learnerRecordResolved
                ? providerSupportsStreaming(learnerRecordResolved) ||
                  providerSupportsEventStreaming(learnerRecordResolved)
                : false,
          },
          opening: openingConfig,
          closeoutReport: { enabled: closeoutReportEnabled },
          dialogueClosure: dialogueClosureConfig,
          multipleChoice: { enabled: multipleChoiceEnabled },
          interimAnimation: {
            enabled: interimAnimationEnabled,
            activeInThisTerminal: Boolean(interimAnimationEnabled && output.isTTY && cliPresentation.motion !== 'off'),
          },
          presentation: tutorStubCliPresentationSnapshot(cliPresentation),
          fieldVisualization: {
            enabled: fieldVisualizationEnabled,
            dir: path.relative(ROOT, traceDir),
            automaticAfterTurns: fieldVisualizationEnabled,
            slashCommand: '/viz',
          },
          resumeLast: resumeRequested
            ? resumeCandidate
              ? {
                  source: path.relative(ROOT, resumeCandidate.filePath),
                  turns: resumeCandidate.turns.length,
                  world: resumeCandidate.metadata?.world || null,
                }
              : { requested: true, found: false, traceDir: path.relative(ROOT, traceDir) }
            : { requested: false },
          systemPrompt,
          firstMessage: firstMessage || null,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (!resolved.isConfigured && !isCliProvider(resolved.provider)) {
    const envName = providerConfig.api_key_env || 'provider API key';
    throw new Error(`${args.model} is not configured. Set ${envName} or choose a CLI-backed model.`);
  }
  if (
    classifierEnabled &&
    !combinedLearnerAnalysisEnabled &&
    !classifierResolved.isConfigured &&
    !isCliProvider(classifierResolved.provider)
  ) {
    const envName = classifierProviderConfig.api_key_env || 'provider API key';
    throw new Error(`${args['classifier-model']} is not configured. Set ${envName} or choose a CLI-backed classifier.`);
  }
  if (tutorLearnerDagEnabled && !learnerRecordResolved.isConfigured && !isCliProvider(learnerRecordResolved.provider)) {
    const envName = learnerRecordProviderConfig.api_key_env || 'provider API key';
    throw new Error(
      `${args['learner-record-model']} is not configured. Set ${envName} or choose a CLI-backed learner-record model.`,
    );
  }
  if (learnerModelRequired && !autoLearnerResolved.isConfigured && !isCliProvider(autoLearnerResolved.provider)) {
    const envName = autoLearnerProviderConfig.api_key_env || 'provider API key';
    throw new Error(
      `${args['auto-learner-model']} is not configured. Set ${envName} or choose a CLI-backed automated learner model.`,
    );
  }

  const trace = createTraceState({
    enabled: traceEnabled,
    traceDir: args['trace-dir'],
    metadata: {
      modelRef: args.model,
      resolved: visibleModel,
      tutorInstance: {
        schema: tutorInstance.schema,
        id: tutorInstance.id,
        title: tutorInstance.title,
        requestedRef: args.tutor,
        activeRef: tuning.activeRef,
        rolePromptPath: path.relative(ROOT, tutorInstance.rolePromptPath),
        rolePromptHash: tutorInstance.rolePromptHash,
        policyPack: tutorInstance.policyPack,
      },
      tuning: tutorStubTuningSnapshot(tuning),
      allModelsOverride,
      rememberedSettings: rememberedSettingsConfig,
      trainingReuse: trainingReuseConfig,
      lab: selectedLabMetadata,
      sessionRecipe,
      recipeFile: loadedSessionRecipePath ? path.relative(ROOT, loadedSessionRecipePath) : null,
      recipeSource: loadedRecipeProvenance,
      resume: resumeCandidate
        ? {
            source: path.relative(ROOT, resumeCandidate.filePath),
            runId: resumeCandidate.runId,
            turns: resumeCandidate.turns.length,
            migration: resumeCandidate.migration,
            drift: resumeDrift,
            driftAcknowledged: Boolean(args['acknowledge-drift'] && !resumeDrift?.ok),
          }
        : { requested: resumeRequested, found: false },
      passthrough: passthroughConfig,
      capabilities: capabilitySnapshot,
      humanDiscourse: humanDiscourseConfig,
      scenarioPicker: initialScenarioPickerConfig,
      comprehensionSideState: {
        enabled: true,
        schema: 'machinespirits.tutor-stub.comprehension-side-state.v1',
        sources: ['learner_turn', 'slash_explain'],
        advancesLearnerDag: false,
      },
      dagFactDropout: dagFactDropoutConfig,
      releasePacing: releasePacingConfig,
      loopExecution: {
        mode: loopMode,
        fixedPublicSafeQuarantine: loopMode === TUTOR_STUB_DIAGNOSTIC_COLLECTION_MODE,
        recoverableFailurePolicy:
          loopMode === TUTOR_STUB_DIAGNOSTIC_COLLECTION_MODE
            ? 'rollback_turn_state_commit_mechanical_quarantine_and_continue'
            : 'fail_fast',
      },
      experiment: experimentConfig,
      typedPedagogicalActions: typedActionConfig,
      responseConfiguration: {
        schema: 'machinespirits.tutor-stub.response-configuration.v3',
        primaryStanceField: 'engagement_stance',
        independentAxes: [
          'engagement_stance',
          'action_family',
          'addressee_profile',
          'lexical_accessibility',
          'scene_immersion',
          'actorial_part',
        ],
        temperatureScope: 'engagement_stance_and_actorial_part',
        transcriptVisibilityAudit: true,
      },
      randomPerformance: {
        available: registerSelectionEnabled,
        enabled: false,
        slashCommand: '/random',
        scope: ['engagement_stance', 'actorial_part'],
        assessmentInfluence: false,
        preservedControls: ['action_family', 'evidence_release', 'dialogue_closure', 'response_safety'],
      },
      lightAdaptation: {
        schema: TUTOR_STUB_LIGHT_ADAPTATION_SCHEMA,
        available: registerSelectionEnabled,
        enabled: lightAdaptationEnabled,
        threshold: lightAdaptationThreshold,
        slashCommand: '/light on|off|status',
        settingsCommand: '/settings light on|off|status',
        defaultScope: 'adaptive_interactive_sessions',
        rememberedPreference: true,
        trigger: 'continued_learner_confusion_or_frustration',
        scope: ['engagement_stance', 'actorial_part'],
        selectionMethod: 'seeded_uniform_excluding_previous',
        preservedControls: [
          'action_family',
          'authored_evidence_source',
          'evidence_release',
          'dialogue_closure',
          'response_safety',
        ],
      },
      performanceDirectives: {
        available: registerSelectionEnabled,
        sessionOnly: true,
        register: null,
        character: initialTutorCharacter,
        slashCommands: ['/register', '/character'],
        precedence: 'light_adaptation_then_explicit_axis_then_random_axis_then_adaptive_policy',
      },
      pointOfAction: pointOfActionArm
        ? {
            enabled: true,
            arm: pointOfActionArm,
            detectorVersion: 'step4-frozen-2026-07-14.v1',
            eligibleTurns: [3, 24],
            triggerPriority: ['stagnant_repeat', 'warrant_skip'],
            committee:
              pointOfActionArm === 'committee'
                ? {
                    model: args['committee-mini-model'],
                    fallbackPolicy: args['committee-fallback-policy'],
                    control: '/committee on|off|status',
                  }
                : null,
          }
        : { enabled: false },
      promptArchitecture,
      classifier: visibleClassifierConfig,
      tutorLearnerDag: tutorLearnerDagEnabled ? visibleLearnerRecordModel : null,
      learnerDagPreflight: learnerDagPreflightConfig,
      autoLearner: autoLearnerEnabled
        ? {
            enabled: true,
            modelRef: args['auto-learner-model'],
            resolved: visibleAutoLearnerModel,
            maxTurns: autoTurns ?? 'until-grounded',
            untilGrounded: autoTurns === null,
            safetyTurns: autoTurns === null ? autoSafetyTurns : null,
            stopOnGrounded: autoStopOnGrounded,
            profileId: automatedLearnerProfileId(args['auto-learner-profile']),
            profile: args['auto-learner-profile'],
          }
        : { enabled: false },
      mixedLearner: mixedLearnerEnabled
        ? {
            enabled: true,
            modelRef: args['auto-learner-model'],
            resolved: visibleAutoLearnerModel,
            profileId: automatedLearnerProfileId(args['auto-learner-profile']),
            profile: args['auto-learner-profile'],
            clue: '/clue or /hint',
            accept: 'Tab on an empty learner prompt, /use, or /accept',
            inspect: '/suggest',
            regenerate: '/regen',
            profilePresentation: {
              promptLabel: true,
              intendedPattern: true,
              visibleExpression: 'profile_signal',
              readyAnnouncement: 'once_per_profile',
              firstTutorOrdering: 'ready_profile_then_director_then_tutor',
              initialPicker: {
                enabled: initialMixedLearnerSetupEnabled,
                defaultProfileId: automatedLearnerProfileId(args['auto-learner-profile']) || 'custom',
                keyboardMenu: true,
                navigation: ['up', 'down', 'enter'],
                nonTtyFallback: 'typed_profile_id',
              },
            },
            startupPrompts: mixedLearnerStartupPrompts,
          }
        : { enabled: false, requested: mixedLearnerRequested },
      learnerResponseProvenance: interactiveRoleModes.learnerResponseProvenance,
      interactiveRoleModes,
      turnFeedback: turnFeedbackConfig,
      responseDetails: responseDetailsConfig,
      explanatoryDebug: explanatoryDebugConfig,
      learningSummaryReport: learningSummaryReportConfig,
      registerSelection: registerSelectionEnabled
        ? {
            enabled: true,
            palette: registerPalette,
            policy: registerPolicyStack.id,
            primaryPolicy: registerPolicy,
            overlayPolicies: registerPolicyOverlays,
            overlayThreshold: registerOverlayThreshold,
            temperature: registerTemperature,
            engagementStanceTemperature: registerTemperature,
            temperatureScope: 'engagement_stance_and_actorial_part',
            combinedLearnerAnalysis: combinedLearnerAnalysisEnabled,
            localFieldPolicy: fieldRegisterSelectionEnabled,
            localTrajectoryPolicy: trajectoryRegisterSelectionEnabled,
            localDynamicalSystemPolicy: dynamicalSystemRegisterSelectionEnabled,
            localEmpiricalDynamicalSystemPolicy: empiricalDynamicalSystemRegisterSelectionEnabled,
            localContinuousDynamicalSystemPolicy: continuousDynamicalSystemRegisterSelectionEnabled,
            localContinuousEmpiricalDynamicalSystemPolicy: continuousEmpiricalDynamicalSystemRegisterSelectionEnabled,
            continuousUnsafeRegisterAnchors: continuousUnsafeRegisterAnchorsEnabled,
            localStatePolicy: stateRegisterSelectionEnabled,
            random: randomRegisterSelectionEnabled,
            negative: negativeRegisterSelectionEnabled,
            empiricalPrior: {
              status: registerEmpiricalPrior.status,
              path: registerEmpiricalPrior.filePath ? path.relative(ROOT, registerEmpiricalPrior.filePath) : null,
              observationCount: registerEmpiricalPrior.prior?.source?.observationCount ?? null,
            },
          }
        : { enabled: false },
      cliEffort: cliEffort || null,
      learnerAnalysisPromptProfile,
      learnerAnalysisEvidenceUseRubric,
      mixedTutorPrefetchPolicy,
      stream: {
        enabled: streamEnabled,
        tutor: tutorStreamState,
        tutorLive: tutorStreamState === 'live',
        tutorBufferedForConcurrentInput: tutorStreamState === 'buffered_for_concurrent_input',
        tutorGuardedAfterAudit: tutorStreamState === 'guarded_after_audit',
        classifier:
          streamEnabled && classifierResolved
            ? providerSupportsStreaming(classifierResolved) || providerSupportsEventStreaming(classifierResolved)
            : false,
        learnerAnalysis:
          streamEnabled && learnerRecordResolved
            ? providerSupportsStreaming(learnerRecordResolved) || providerSupportsEventStreaming(learnerRecordResolved)
            : false,
      },
      memorySummary: {
        enabled: memorySummaryEnabled,
        rawRecentTurns: historyTurns,
        publicSummary: memorySummaryEnabled,
        scope: 'auxiliary_analysis_prompts',
      },
      speakerHistory: {
        mode: 'full_public_replay',
        perspectives: ['tutor', 'learner'],
        roles: ['system', 'user', 'assistant'],
        directApiTransport: 'native_messages',
        cliTransport: 'flattened_at_bridge_boundary',
        automatedLearnerBudgetFallback: {
          enabled: true,
          trigger: 'prompt_audit_budget_violation',
          mode: 'budget_window_public_replay',
          recentTurns: historyTurns,
          publicOnly: true,
        },
      },
      opening: openingConfig,
      closeoutReport: { enabled: closeoutReportEnabled },
      dialogueClosure: dialogueClosureConfig,
      multipleChoice: { enabled: multipleChoiceEnabled },
      interimAnimation: {
        enabled: interimAnimationEnabled,
        activeInThisTerminal: Boolean(interimAnimationEnabled && output.isTTY && cliPresentation.motion !== 'off'),
      },
      presentation: tutorStubCliPresentationSnapshot(cliPresentation),
      fieldVisualization: {
        enabled: fieldVisualizationEnabled,
        dir: path.relative(ROOT, traceDir),
        automaticAfterTurns: fieldVisualizationEnabled,
        slashCommand: '/viz',
      },
      resumeLast: resumeRequested
        ? resumeCandidate
          ? {
              source: path.relative(ROOT, resumeCandidate.filePath),
              turns: resumeCandidate.turns.length,
              world: resumeCandidate.metadata?.world || null,
            }
          : { requested: true, found: false, traceDir: path.relative(ROOT, traceDir) }
        : { requested: false },
      world: worldBundle ? { id: worldBundle.world.id, title: worldBundle.world.title, dag: args.dag } : null,
      curriculum: curriculumBundle
        ? {
            id: curriculumBundle.curriculum.id,
            title: curriculumBundle.curriculum.title,
            sourceRef: curriculumBundle.sourceRef,
            sourceHash: curriculumBundle.curriculum.source?.source_hash || null,
            moduleId: curriculumBundle.module.id,
            moduleTitle: curriculumBundle.module.title,
            mode: 'public_reflective_non_dag',
            completionAuthority: curriculumRuntime.completionAuthority,
          }
        : null,
      firstMessage: firstMessage || null,
    },
  });
  if (initialScenarioSelection) {
    appendTraceEvent(trace, {
      type: 'initial_scenario_selected',
      ...initialScenarioSelection,
    });
  }
  appendTraceEvent(trace, {
    type: 'capability_snapshot_resolved',
    schema: capabilitySnapshot.schema,
    registryVersion: capabilitySnapshot.registryVersion,
    mode: capabilitySnapshot.mode,
    active: capabilitySnapshot.active,
    available: capabilitySnapshot.available,
    compatibility: capabilitySnapshot.compatibility,
    publicTranscriptChanged: false,
  });
  const interim = createInterimState({ enabled: interimAnimationEnabled });

  const state = {
    topic: effectiveTopic,
    systemPrompt,
    promptArchitecture,
    tutorInstance,
    tuning,
    learnerProfileId: automatedLearnerProfileId(args['auto-learner-profile']),
    learnerProfile: args['auto-learner-profile'],
    modelRef: args.model,
    resolved,
    modelRouting: {
      schema: 'machinespirits.tutor-stub.model-routing.v1',
      allRolesOverrideRef: allModelsOverrideRef,
    },
    rememberedSettings: {
      ...rememberedSettingsConfig,
      filePath: rememberedSettings.filePath,
      savedAt: rememberedSettings.savedAt,
    },
    trainingReuse: trainingReuseConfig,
    presentation: tutorStubCliPresentationSnapshot(cliPresentation),
    responseDetails: { ...responseDetailsConfig },
    capabilities: capabilitySnapshot,
    lab: selectedLabMetadata,
    sessionRecipe,
    recipeSource: loadedRecipeProvenance,
    resume: resumeCandidate
      ? {
          source: resumeCandidate.filePath,
          runId: resumeCandidate.runId,
          migration: resumeCandidate.migration,
          drift: resumeDrift,
          driftAcknowledged: Boolean(args['acknowledge-drift'] && !resumeDrift?.ok),
        }
      : null,
    passthrough: passthroughConfig,
    learnerResponseProvenance: interactiveRoleModes.learnerResponseProvenance,
    turnFailureFeedbackRecords: [],
    requestedTemperature: temperature,
    temperature: effectiveTemperature,
    maxTokens,
    historyTurns,
    learnerAnalysisPromptProfile,
    learnerAnalysisEvidenceUseRubric,
    mixedTutorPrefetchPolicy,
    tutorContext: {
      schema: 'machinespirits.tutor-stub.tutor-context-policy.v2',
      historyMode: 'full_public_replay',
      activatedBy: 'session_start',
      activatedAtTurn: null,
      modelRef: args.model,
    },
    memory: {
      enabled: memorySummaryEnabled,
    },
    curriculum: curriculumBundle
      ? {
          id: curriculumBundle.curriculum.id,
          title: curriculumBundle.curriculum.title,
          sourceRef: curriculumBundle.sourceRef,
          sourceHash: curriculumBundle.curriculum.source?.source_hash || null,
          module: curriculumBundle.module,
          mode: 'public_reflective_non_dag',
          runtime: curriculumRuntime,
        }
      : null,
    world: worldBundle?.world || null,
    openingRealization: null,
    resumeHandoff: null,
    openingRealizer,
    directorContext,
    directorOpeningPresented: false,
    directorGuidance: createTutorStubDirectorGuidanceState(),
    dag: args.dag,
    dagMode,
    humanDiscourse: humanDiscourseConfig,
    dialogueClosure: { ...dialogueClosureConfig },
    tutorDag,
    classifier: {
      enabled: classifierEnabled,
      modelRef: args['classifier-model'],
      resolved: classifierResolved,
      combined: combinedLearnerAnalysisEnabled,
    },
    learnerDag: createLearnerDagState({
      enabled: tutorLearnerDagEnabled,
      modelRef: args['learner-record-model'],
      resolved: learnerRecordResolved,
      world: worldBundle?.world || null,
      dropout: {
        rate: dagFactDropoutRate,
        seed: dagFactDropoutSeed,
      },
    }),
    autoLearner: {
      modelRef: args['auto-learner-model'],
      resolved: autoLearnerResolved,
      providerConfig: autoLearnerProviderConfig,
    },
    comprehension: createTutorStubComprehensionState(),
    releasePacing: createTutorStubReleasePacingState({
      world: worldBundle?.world || null,
      speed: releaseSpeed,
    }),
    loopMode,
    diagnosticCollection: {
      enabled: loopMode === TUTOR_STUB_DIAGNOSTIC_COLLECTION_MODE,
      firstQuarantinedTurn: null,
      quarantinedTurns: [],
    },
    register: {
      enabled: registerSelectionEnabled,
      palette: registerPalette,
      policy: registerPolicy,
      overlays: [...registerPolicyOverlays],
      overlayThreshold: registerOverlayThreshold,
      temperature: registerTemperature,
      continuousUnsafe: continuousUnsafeRegisterAnchorsEnabled,
      empiricalPrior: registerEmpiricalPrior.prior,
      empiricalPriorStatus: registerEmpiricalPrior.status,
      empiricalPriorPath: registerEmpiricalPrior.filePath,
      current: null,
      history: [],
    },
    randomPerformance: {
      schema: 'machinespirits.tutor-stub.random-performance-mode.v1',
      enabled: false,
      scope: ['engagement_stance', 'actorial_part'],
      assessmentInfluence: false,
      sessionOnly: true,
    },
    lightAdaptation: {
      schema: TUTOR_STUB_LIGHT_ADAPTATION_SCHEMA,
      enabled: lightAdaptationEnabled,
      threshold: lightAdaptationThreshold,
      scope: ['engagement_stance', 'actorial_part'],
      trigger: 'continued_learner_confusion_or_frustration',
      selectionMethod: 'seeded_uniform_excluding_previous',
      rememberedPreference: true,
    },
    performanceDirectives: {
      schema: 'machinespirits.tutor-stub.explicit-performance-directives.v1',
      register: null,
      character: initialTutorCharacter,
      sessionOnly: true,
      precedence: 'light_adaptation_then_explicit_axis_then_random_axis_then_adaptive_policy',
    },
    pointOfAction: {
      enabled: Boolean(pointOfActionArm),
      arm: pointOfActionArm,
      current: null,
      history: [],
    },
    committee: {
      enabled: pointOfActionArm === 'committee',
      miniModel: args['committee-mini-model'],
      ollamaUrl: args['committee-ollama-url'],
      fallbackPolicy: args['committee-fallback-policy'] === 'v2' ? 'v2' : 'v1',
      numCtx: PROGRAM2_COMMITTEE_DEFAULTS.numCtx,
      timeoutMs: PROGRAM2_COMMITTEE_DEFAULTS.timeoutMs,
    },
    experiment: experimentConfig,
    typedActions: {
      enabled: typedActionConfig.enabled,
      config: typedActionConfig,
      ledger: [],
      currentDecision: null,
      scaffoldLifecycle: createScaffoldLifecycle(),
    },
    trace,
    debugRunId: trace.runId || safeTimestampForFile(),
    printedDebugIds: new Set(),
    interim,
    stream: {
      enabled: streamEnabled,
      interim,
    },
    fieldViz: {
      enabled: fieldVisualizationEnabled,
      dir: traceDir,
      runId: trace.runId || safeTimestampForFile(),
    },
    cliEffort,
    multipleChoice: multipleChoiceEnabled,
    interaction: {
      mode: 'learner',
      previousMode: 'learner',
      autoRunning: false,
    },
    turnFeedback: createTutorStubTurnFeedbackState({
      enabled: turnFeedbackEnabled,
      automatedLearner: autoLearnerEnabled,
    }),
    explanatoryDebug: {
      enabled: false,
      format: 'prose',
    },
    voice: {
      schema: 'machinespirits.tutor-stub.voice-runtime.v1',
      enabled: false,
      model: voiceModel,
      voice: voiceName,
      transcriptionModel: 'gpt-realtime-whisper',
      bridge: null,
      lastStartedAt: null,
      lastStoppedAt: null,
      deliveries: [],
      interruptions: 0,
    },
    coach: {
      pending: [],
      history: [],
    },
    history: [],
    turns: [],
  };

  const {
    forgetRememberedInteractiveSettings,
    handleUnknownSessionCommand,
    persistCurrentInteractiveSettings,
    recordSessionRuntimeEvent,
    rejectUnavailableSessionCommand,
    sessionRuntimeStateSnapshot,
  } = createTutorStubSessionStateRuntime({
    C,
    DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_RATE,
    DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
    DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD,
    DEFAULT_TUTOR_STUB_RELEASE_SPEED,
    ROOT,
    STUB,
    appendTraceEvent,
    args,
    clearStatusLine,
    clearTutorStubLastSettings,
    curriculumBundle,
    getCliPresentation: () => cliPresentation,
    jsonClone,
    path,
    state,
    tutorStubCurriculumPublicProjection,
    voiceModel,
    voiceName,
    writeTutorStubLastSettings,
  });

  const { writeFinalLearningSummary } = createTutorStubLearningSummaryRuntime({
    C,
    ROOT,
    TUTOR_STUB_LEARNING_SUMMARY_HTML_SCHEMA,
    appendTraceEvent,
    args,
    buildDialogueLearningSummary,
    launchTutorStubTranscriptHtml,
    learningSummaryReportConfig,
    listTutorStubTuningCandidates,
    output,
    path,
    state,
    traceDir,
    traceDisplayPath,
    tutorStubRegisterPolicyStackId,
    tutorStubTuningSnapshot,
    writeTutorStubLearningSummaryHtml,
  });

  const sessionRuntime = createTutorStubSessionRuntime({
    id: args['session-id'] || state.debugRunId,
    capabilities: state.capabilities,
    initialState: sessionRuntimeStateSnapshot(),
    commandHandlers: createTutorStubCommandHandlers(executeSlashCommand),
    onEvent: recordSessionRuntimeEvent,
    adapters: {
      snapshot: sessionRuntimeStateSnapshot,
      step: ({ payload }) =>
        routeLearnerText(payload.input, {
          source: payload.context?.source || 'runtime',
          provenance: payload.context?.provenance || null,
          awaitCompletion: Boolean(payload.context?.awaitCompletion),
        }),
      reset: ({ payload }) => performInteractiveDialogueReset(payload),
      finalize: ({ payload }) => performInteractiveFinalize(payload.reason),
      commandUnavailable: rejectUnavailableSessionCommand,
      unknownCommand: handleUnknownSessionCommand,
    },
  });
  sessionRuntime.load({ source: 'cli_launch', state: sessionRuntimeStateSnapshot() });

  const resumedDialogue = resumeRequested
    ? restoreDialogueFromTrace(state, resumeCandidate, {
        currentWorld: worldBundle?.world || null,
        restoreOpening: Boolean(args['session-rpc']),
      })
    : null;
  if (resumedDialogue) {
    restoreTutorStubReleasePacingFromTurns({
      pacing: state.releasePacing,
      world: state.world,
      turns: state.turns,
    });
    state.turnFeedback.history = state.turns
      .map((turn) => {
        const feedback = turn.learnerInput?.tutorFeedback || null;
        return feedback?.requested
          ? {
              ...jsonClone(feedback),
              learnerTurn: turn.turn,
              learnerTurnId: turn.turnId || null,
              restored: true,
            }
          : null;
      })
      .filter(Boolean);
    appendTraceEvent(state.trace, {
      type: 'resume_loaded',
      source: path.relative(ROOT, resumedDialogue.source),
      turns: resumedDialogue.turns,
      register: resumedDialogue.register,
      directorGuidance: resumedDialogue.directorGuidance,
      learnerDag: resumedDialogue.learnerDag,
      typedActions: resumedDialogue.typedActions,
      dialogueClosure: resumedDialogue.dialogueClosure,
      warnings: resumedDialogue.warnings,
    });
  } else if (resumeRequested) {
    appendTraceEvent(state.trace, {
      type: 'resume_empty',
      traceDir: path.relative(ROOT, traceDir),
    });
  }
  if (resumeRequested) {
    sessionRuntime.resume({
      source: resumedDialogue ? path.relative(ROOT, resumedDialogue.source) : null,
      found: Boolean(resumedDialogue),
      turns: resumedDialogue?.turns || 0,
      state: sessionRuntimeStateSnapshot(),
    });
  }
  if (output.isTTY) {
    console.log(
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
  console.log(
    `${output.isTTY ? '' : '\n'}${C.accent2}tutor-stub${C.reset} ${C.bold}${state.tuning.activeRef}${C.reset} ${C.dim}· ${args.model} -> ${visibleModel.provider}/${visibleModel.model} · tuning ${state.tuning.mode}${C.reset}`,
  );
  if (passthroughEnabled) {
    console.log(`${C.brightCyan}${C.bold}passthrough >${C.reset} pure speaker chat · one model call per turn`);
    console.log(`${C.dim}request: unchanged system setup + full public history + latest learner message${C.reset}`);
    if (observedAuditsEnabled) {
      console.log(
        `${C.dim}observed audits: leak and repetition are evaluated and recorded after each turn; nothing is gated, repaired or replaced${C.reset}`,
      );
    }
    console.log(
      `${C.dim}setup: ${worldBundle ? `${worldBundle.world.id} — ${worldBundle.world.title}` : effectiveTopic}${C.reset}`,
    );
    console.log(`${C.dim}technical trace: ${trace.enabled ? traceDisplayPath(trace) : 'off'}${C.reset}`);
    console.log(`${C.dim}type a message to begin · /settings model changes the speaker · /quit exits${C.reset}\n`);
  } else {
    if (allModelsOverride) {
      console.log(
        `${C.dim}one model for every role: ${allModelsOverride.modelRef} (tutor, learner analysis, reasoning tracker, and automated/suggested learner)${C.reset}`,
      );
    }
    if (rememberedSettings.status === 'loaded' && rememberedSettings.appliedFields.length) {
      console.log(
        `${C.dim}saved settings: restored ${plainList(rememberedSettings.appliedFields.map(plainSettingName))} from the last interactive session${C.reset}`,
      );
    } else if (rememberedSettings.warning) {
      console.log(`${C.yellow}saved settings warning:${C.reset} ${rememberedSettings.warning}`);
    }
    if (classifierEnabled && combinedLearnerAnalysisEnabled) {
      console.log(
        `${C.dim}learner analysis: one combined reading via ${args['learner-record-model']} → ${visibleLearnerRecordModel.provider}/${visibleLearnerRecordModel.model}${C.reset}`,
      );
    } else if (classifierEnabled) {
      console.log(
        `${C.dim}learner analysis: ${args['classifier-model']} → ${visibleClassifierModel.provider}/${visibleClassifierModel.model}${C.reset}`,
      );
    } else {
      console.log(`${C.dim}learner analysis: off${C.reset}`);
    }
    if (tutorLearnerDagEnabled) {
      console.log(
        `${C.dim}learner reasoning tracker: on via ${args['learner-record-model']} → ${visibleLearnerRecordModel.provider}/${visibleLearnerRecordModel.model}${C.reset}`,
      );
    } else if (args['tutor-learner-dag'] && !worldBundle) {
      console.log(`${C.dim}learner reasoning tracker: unavailable because no scenario is active${C.reset}`);
    } else {
      console.log(`${C.dim}learner reasoning tracker: off${C.reset}`);
    }
    console.log(
      `${C.dim}reasoning mode: ${displayDiagnosticLabel(dagMode)} (${humanDiscourseConfig.phase}; ${
        humanDiscourseConfig.behaviorChange ? 'human-friendly inference active' : 'strict proof audit'
      })${C.reset}`,
    );
    if (autoLearnerEnabled) {
      const autoTurnSummary = autoTurns === null ? `until grounded; safety ${autoSafetyTurns}` : `${autoTurns}`;
      console.log(
        `${C.dim}automated learner: ${args['auto-learner-model']} → ${visibleAutoLearnerModel.provider}/${visibleAutoLearnerModel.model}; ${autoTurnSummary}; stop when complete: ${autoStopOnGrounded ? 'yes' : 'no'}${C.reset}`,
      );
    } else if (mixedLearnerEnabled) {
      console.log(
        `${C.dim}learner suggestions: on via ${args['auto-learner-model']} → ${visibleAutoLearnerModel.provider}/${visibleAutoLearnerModel.model}; use /clue, Tab, /suggest, /use, or /regen${C.reset}`,
      );
    } else if (mixedLearnerRequested) {
      console.log(`${C.dim}learner suggestions: off while the automated learner is running${C.reset}`);
    } else if (interactiveSessionEnabled && visibleAutoLearnerModel) {
      console.log(
        `${C.dim}interactive roles: learner + private coach; /auto hands off to ${visibleAutoLearnerModel.provider}/${visibleAutoLearnerModel.model}${C.reset}`,
      );
    } else {
      console.log(`${C.dim}automated learner: off${C.reset}`);
    }
    if (typedActionConfig.enabled) {
      console.log(
        `${C.dim}typed pedagogical actions: on | task ${typedActionTask.taskId} | knowledge component ${
          typedActionTask.knowledgeComponent
        } | difficulty ${typedActionTask.itemDifficulty} | support ${
          typedActionSupportLevel === null ? 'action default' : typedActionSupportLevel
        }${C.reset}`,
      );
    }
    if (registerSelectionEnabled) {
      console.log(
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
        console.log(
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
        console.log(
          `${C.dim}style blend sources: ${
            continuousUnsafeRegisterAnchorsEnabled ? 'active palette' : 'safe router-selectable only'
          }${C.reset}`,
        );
      }
    } else {
      console.log(`${C.dim}teaching-style selection: off${C.reset}`);
    }
    if (trace.enabled) {
      console.log(`${C.dim}technical trace: ${traceDisplayPath(trace)}${C.reset}`);
    } else {
      console.log(`${C.dim}technical trace: off${C.reset}`);
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
      console.log(`${C.dim}live output: ${streamSummary}${C.reset}`);
    } else {
      console.log(`${C.dim}live output: off${C.reset}`);
    }
    console.log(
      `${C.dim}terminal appearance: ${cliPresentation.themeLabel} · ${cliPresentation.motion} motion · ${cliPresentation.colorMode}; /theme and /motion change it live${C.reset}`,
    );
    console.log(
      `${C.dim}progress display: ${
        interimAnimationEnabled
          ? output.isTTY && cliPresentation.motion !== 'off'
            ? `on (${cliPresentation.motion})`
            : 'off in this terminal'
          : 'off'
      }${C.reset}`,
    );
    console.log(
      `${C.dim}interaction chart: ${
        fieldVisualizationEnabled ? `on -> ${path.relative(ROOT, traceDir)}` : 'off (/viz writes on demand)'
      }${C.reset}`,
    );
    console.log(`${C.dim}opening scene: ${openingEnabled && !firstMessage ? 'on' : 'off'}${C.reset}`);
    console.log(`${C.dim}terminal summary at the end: ${closeoutReportEnabled ? 'on' : 'off'}${C.reset}`);
    console.log(
      `${C.dim}optional tutor thumbs feedback: ${turnFeedbackEnabled ? 'on' : 'off'}${autoLearnerEnabled ? ' (automated learner)' : ''}${C.reset}`,
    );
    console.log(
      `${C.dim}compact response + timing details: ${responseDetailsEnabled ? 'on' : 'off'} · /details changes this for the session${C.reset}`,
    );
    if (learningSummaryReportConfig.enabled) {
      console.log(
        `${C.dim}learning summary: automatic HTML on conclusion${
          process.env.TUTOR_STUB_SUMMARY_OPEN === '0' ? '; browser launch off' : '; opens in an interactive terminal'
        }${C.reset}`,
      );
    }
    console.log(
      `${C.dim}natural ending: ${dialogueClosureConfig.enabled ? `on; ${dialogueClosureConfig.allowCheckIn ? 'one optional final check-in' : 'close without a check-in'}` : 'off'}${C.reset}`,
    );
    if (cliEffort) {
      console.log(`${C.dim}cli effort: ${cliEffort}${C.reset}`);
    }
    if (resumedDialogue) {
      console.log(
        `${C.dim}resume: loaded ${resumedDialogue.turns} turn(s) from ${path.relative(ROOT, resumedDialogue.source)}${C.reset}`,
      );
      if (resumedDialogue.learnerDag.skipped) {
        console.log(
          `${C.dim}resume: rebuilt ${resumedDialogue.learnerDag.replayed} reasoning snapshot(s) and reused ${resumedDialogue.learnerDag.skipped}${C.reset}`,
        );
      }
      if (resumedDialogue.typedActions.enabled) {
        console.log(
          `${C.dim}resume: typed actions restored ${resumedDialogue.typedActions.ledgerRecords} ledger record(s); phase ${
            resumedDialogue.typedActions.phase
          }; pending ${resumedDialogue.typedActions.pendingContractId || 'none'}${C.reset}`,
        );
      }
      for (const warning of resumedDialogue.warnings) {
        console.log(`${C.red}resume warning${C.reset}${C.dim}: ${warning}${C.reset}`);
      }
      if (state.dialogueClosure?.phase === 'awaiting_checkin') {
        console.log(
          `${C.cyan}resume closure >${C.reset} the saved dialogue had already stated its verdict; one final learner check-in remains`,
        );
      } else if (state.dialogueClosure?.phase === 'closed') {
        console.log(`${C.cyan}resume closure >${C.reset} the saved dialogue is already closed`);
      }
    } else if (resumeRequested) {
      console.log(`${C.dim}resume: no completed dialogue found in ${path.relative(ROOT, traceDir)}${C.reset}`);
    }
    if (temperature !== effectiveTemperature) {
      console.log(
        `${C.dim}temperature: requested ${temperature}; using ${effectiveTemperature} because ${visibleModel.model} only supports the default${C.reset}`,
      );
    }
    if (worldBundle) {
      console.log(
        `${C.dim}scenario: ${worldBundle.world.id} — ${worldBundle.world.title}${args.dag ? ' | proof map on' : ' | proof map off'}${C.reset}`,
      );
    }
    console.log(
      `${C.dim}topic: ${effectiveTopic} | type / for commands | /reset to recover | /quit to exit${C.reset}\n`,
    );
  }

  if (autoLearnerEnabled) {
    const result = await runAutomatedLearnerDialogue({
      state,
      firstMessage,
      openingEnabled,
      autoLearnerResolved,
      autoLearnerProfile: args['auto-learner-profile'],
      autoTurns,
      autoSafetyTurns,
      autoStopOnGrounded,
      cliEffort,
    });
    appendTraceEvent(state.trace, { type: 'run_end', reason: result.reason, turns: state.turns.length });
    appendTutorStubTurnFailureTraceRecords(state, { sealed: true });
    if (args.save) {
      saveTranscript(args.save, {
        ...visibleModel,
        classifier: classifierEnabled ? visibleClassifierConfig : null,
        tutorLearnerDag: tutorLearnerDagEnabled ? visibleLearnerRecordModel : null,
        dagFactDropout: tutorStubDagFactDropoutSnapshot(state.learnerDag.dropout),
        autoLearner: {
          enabled: true,
          modelRef: args['auto-learner-model'],
          resolved: visibleAutoLearnerModel,
          maxTurns: autoTurns ?? 'until-grounded',
          untilGrounded: autoTurns === null,
          safetyTurns: autoTurns === null ? autoSafetyTurns : null,
          stopOnGrounded: autoStopOnGrounded,
          profile: args['auto-learner-profile'],
        },
        registerSelection: registerSelectionEnabled
          ? {
              enabled: true,
              palette: registerPalette,
              policy: tutorStubRegisterPolicyStackId(state.register.policy, state.register.overlays),
              primaryPolicy: state.register.policy,
              overlayPolicies: state.register.overlays,
              overlayThreshold: state.register.overlayThreshold,
              temperature: state.register.temperature,
              history: state.register.history,
            }
          : null,
        dialogueClosure: state.dialogueClosure,
        comprehension: tutorStubComprehensionSnapshot(state.comprehension, { turn: state.turns.length + 1 }),
        directorContext,
        trace: traceDisplayPath(state.trace),
        fieldVisualization: state.fieldViz?.lastWrite || null,
        world: worldBundle ? { id: worldBundle.world.id, title: worldBundle.world.title, dag: args.dag } : null,
        turns: state.turns,
      });
    }
    if (closeoutReportEnabled) {
      const report = printDialogueCloseout(state, { reason: result.reason, trace: state.trace });
      appendTraceEvent(state.trace, { type: 'closeout_report', reason: result.reason, report });
    }
    try {
      writeFinalLearningSummary(result.reason);
    } catch (error) {
      console.log(`${C.red}learning summary error:${C.reset} ${error.message}\n`);
      appendTraceEvent(state.trace, { type: 'learning_summary_error', reason: result.reason, error: error.message });
    }
    return;
  }

  if (firstMessage) {
    const startedAtMs = Date.now();
    const analysisStartedAtMs = Date.now();
    const analysis = state.passthrough?.enabled
      ? {
          classification: null,
          tutorLearnerDag: null,
          registerSelection: null,
          previousRegisterEfficacy: null,
        }
      : await analyzeLearnerTurn(firstMessage, state);
    const analysisCompletedAtMs = Date.now();
    const { classification, tutorLearnerDag, registerSelection, previousRegisterEfficacy } = analysis;
    startInterimAnimation(
      state,
      state.passthrough?.enabled ? 'calling speaker' : 'calling tutor',
      state.passthrough?.enabled
        ? { learnerText: firstMessage, tutorTurn: 1 }
        : buildTutorInterimContext({
            learnerText: firstMessage,
            state,
            classification,
            tutorLearnerDag,
            registerSelection,
            previousRegisterEfficacy,
          }),
    );
    let response;
    const tutorStartedAtMs = Date.now();
    try {
      response = await runOneTurn(
        firstMessage,
        state,
        classification,
        tutorLearnerDag,
        registerSelection,
        previousRegisterEfficacy,
        null,
        {
          learnerResponseProvenance: createTutorStubLearnerResponseProvenance({
            authorship: 'human',
            origin: 'launch_first_message',
            inputMethod: 'command_line_argument',
            humanInLoop: true,
          }),
          turnTiming: {
            startedAtMs,
            analysisStartedAtMs,
            analysisCompletedAtMs,
            tutorStartedAtMs,
            analysisSource: state.passthrough?.enabled ? 'disabled' : 'foreground',
            tutorSource: 'foreground',
          },
        },
      );
    } finally {
      stopInterimAnimation(state);
    }
    if (automaticTechnicalDetailsEnabled(state)) printTutorDagSnapshot(response.dagSnapshot);
    printResponseDetails(response, state);
    if (!state.passthrough?.enabled) {
      printDirectorPreludeBeforeFirstTutor(state, { reason: 'first_message_response' });
    }
    printTutorResponse(response, state.stream);
    await printExplanatoryDebugTurn(state);
    writeFieldVisualization(state, { reason: 'once' });
    appendTraceEvent(state.trace, { type: 'run_end', reason: 'once', turns: state.turns.length });
    appendTutorStubTurnFailureTraceRecords(state, { sealed: true });
    if (args.save) {
      saveTranscript(args.save, {
        ...visibleModel,
        classifier: classifierEnabled ? visibleClassifierConfig : null,
        tutorLearnerDag: tutorLearnerDagEnabled ? visibleLearnerRecordModel : null,
        dagFactDropout: tutorStubDagFactDropoutSnapshot(state.learnerDag.dropout),
        registerSelection: registerSelectionEnabled
          ? {
              enabled: true,
              palette: registerPalette,
              policy: tutorStubRegisterPolicyStackId(state.register.policy, state.register.overlays),
              primaryPolicy: state.register.policy,
              overlayPolicies: state.register.overlays,
              overlayThreshold: state.register.overlayThreshold,
              temperature: state.register.temperature,
              history: state.register.history,
            }
          : null,
        dialogueClosure: state.dialogueClosure,
        comprehension: tutorStubComprehensionSnapshot(state.comprehension, { turn: state.turns.length + 1 }),
        directorContext,
        trace: traceDisplayPath(state.trace),
        fieldVisualization: state.fieldViz?.lastWrite || null,
        world: worldBundle ? { id: worldBundle.world.id, title: worldBundle.world.title, dag: args.dag } : null,
        turns: state.turns,
      });
    }
    if (closeoutReportEnabled) {
      const report = printDialogueCloseout(state, { reason: 'once', trace: state.trace });
      appendTraceEvent(state.trace, { type: 'closeout_report', reason: 'once', report });
    }
    try {
      writeFinalLearningSummary('once');
    } catch (error) {
      console.log(`${C.red}learning summary error:${C.reset} ${error.message}\n`);
      appendTraceEvent(state.trace, { type: 'learning_summary_error', reason: 'once', error: error.message });
    }
    return;
  }

  const mixedLearner = {
    enabled: mixedLearnerEnabled,
    resolved: autoLearnerResolved,
    profile: args['auto-learner-profile'],
    defaultProfile: args['auto-learner-profile'],
    profileId: automatedLearnerProfileId(args['auto-learner-profile']),
    seq: 0,
    pending: null,
    suggestion: null,
    draftInsertion: null,
    error: null,
    artifactAbortController: null,
    analysisCache: null,
    readyAnnouncementProfileKey: null,
    promptHistory: [],
    cacheStats: {
      analysisStarted: 0,
      analysisHits: 0,
      analysisMisses: 0,
      tutorStarted: 0,
      tutorHits: 0,
      tutorMisses: 0,
      discarded: 0,
      errors: 0,
    },
  };

  function mixedLearnerProfilePresentation(suggestion = null) {
    const profileId = suggestion?.profileId || mixedLearner.profileId || null;
    const contract = profileId ? learnerProfileContract(profileId) : null;
    return {
      id: profileId || 'custom',
      name: contract?.intent?.shortName || 'Custom learner',
      speakerLabel: learnerProfileSpeakerLabel(profileId),
      pattern: contract?.intent?.failureOperator || oneLine(suggestion?.profile || mixedLearner.profile, { max: 180 }),
      signal:
        oneLine(suggestion?.profileSignal, { max: 220 }) ||
        'This draft was generated under the active profile; no separate visible-behavior note was returned.',
    };
  }

  function mixedLearnerPromptText() {
    if (state.interaction?.mode === 'coach') return `${C.brightYellow}${C.bold}coach >${C.reset} `;
    if (state.interaction?.mode === 'auto') return `${C.brightBlue}${C.bold}auto >${C.reset} `;
    if (!mixedLearner.enabled) return `${C.brightGreen}${C.bold}learner >${C.reset} `;
    return `${C.brightGreen}${C.bold}${mixedLearnerProfilePresentation().speakerLabel} >${C.reset} `;
  }

  function printMixedLearnerProfilePresentation(suggestion, { verb = 'drafted as' } = {}) {
    const presentation = mixedLearnerProfilePresentation(suggestion);
    console.log(`${C.magenta}profile >${C.reset} ${presentation.id} — ${presentation.name}`);
    console.log(`${C.dim}  tends to: ${presentation.pattern}${C.reset}`);
    console.log(`${C.dim}  ${verb === 'drafted as' ? 'this draft' : verb}: ${presentation.signal}${C.reset}`);
  }

  let initialSetupStage = 'off';
  const rl = readline.createInterface({
    input,
    output,
    prompt: mixedLearnerPromptText(),
    completer(line) {
      if (initialSetupStage === 'profile') {
        const raw = String(line || '');
        const normalized = raw.trim().toLowerCase().replace(/-/gu, '_');
        const candidates = ['list', 'stress', 'all', ...learnerProfileIds()];
        const matches = candidates.filter((candidate) => candidate.startsWith(normalized));
        return [matches.length ? matches : candidates, raw];
      }
      if (initialSetupStage === 'model') {
        const raw = String(line || '');
        const normalized = raw.trim().toLowerCase();
        const candidates = tutorModelChoiceEntries(state.modelRef).map((entry) => entry.ref);
        const matches = candidates.filter((candidate) => candidate.toLowerCase().startsWith(normalized));
        return [matches.length ? matches : candidates, raw];
      }
      const mixedCompletion = mixedLearnerCompletionForLine(line);
      if (mixedCompletion) return [[mixedCompletion], line];
      const completion = slashCommandCompletionForLine(line, { fallback: true });
      return [completion.candidates, completion.replacement];
    },
  });
  const lineSelection = createTutorStubLineSelection({ rl, output });
  const concurrentTerminal = createTutorStubConcurrentTerminal({
    rl,
    output,
    decorateLine: () => {
      lineSelection.decorateLine();
      renderMixedLearnerGhostText({
        rl,
        output,
        text: mixedLearnerGhostText({
          enabled: mixedLearner.enabled,
          suggestion: mixedLearner.suggestion,
          line: rl.line,
          processingTurn,
          interactionMode: state.interaction?.mode,
          interfaceBlocked:
            exiting ||
            initialSetupStage !== 'off' ||
            scenarioPickerActive ||
            awaitingAnotherScenario ||
            interactiveDemoRunning,
        }),
        style: (text) => `${C.dim}${text}${C.reset}`,
      });
    },
  });
  state.concurrentTerminal = concurrentTerminal;
  state.interim.concurrentTerminal = concurrentTerminal;
  let slashPaletteRefreshHandle = null;
  let onInteractiveKeypress = null;
  let processingTurn = false;
  let clarificationInFlight = null;
  let translationInFlight = null;
  let scenarioPickerActive = false;
  let awaitingAnotherScenario = false;
  let interactiveDemoRunning = false;
  let exiting = false;
  let finalized = false;
  const pendingLearnerLines = [];
  let activeLearnerTurn = null;
  let activeAutoRun = null;
  let pendingAutoRequest = null;
  let pendingAutoRequestSequence = 0;
  let resolveInteractive = null;
  const interactiveDone = new Promise((resolve) => {
    resolveInteractive = resolve;
  });

  const { handleVoiceCommand, publishAcceptedTutorToVoice, stopVoiceBridge, voiceRuntimeSnapshot } =
    createTutorStubVoiceController({
      C,
      TUTOR_STUB_VOICE_MODELS,
      appendTraceEvent,
      clearStatusLine,
      createTutorStubVoiceBridge,
      getActiveAutoRun: () => activeAutoRun,
      getActiveLearnerTurn: () => activeLearnerTurn,
      isProcessingTurn: () => processingTurn,
      latestTutorMessage,
      normalizeTutorStubVoiceModel,
      normalizeTutorStubVoiceName,
      openingDebugId,
      persistCurrentInteractiveSettings,
      printWithConcurrentTerminal,
      sessionRuntime,
      setInteractionMode,
      state,
      stateRunDebugId,
    });

  const {
    applyAllRoleModelSelection,
    applyRoleModelSelection,
    applyTutorModelSelection,
    liveModelRoleDefinitions,
    liveModelRoleRef,
    liveModelRoleSnapshot,
    liveSettingsPickerAvailable,
    pickInitialMixedLearnerProfileWithKeyboard,
    pickInitialTutorModelWithKeyboard,
    pickLiveCharacterTargetWithKeyboard,
    pickLiveNumericSettingWithKeyboard,
    pickLiveSettingsActionWithKeyboard,
    pickLiveTutorCharacterWithKeyboard,
    pickLiveTutorRegisterWithKeyboard,
  } = createTutorStubModelPickerController({
    C,
    DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD,
    DEFAULT_TUTOR_STUB_RELEASE_SPEED,
    STUB,
    appendTraceEvent,
    args,
    classifierEnabled,
    clearLine,
    combinedLearnerAnalysisEnabled,
    cursorTo,
    displayDiagnosticLabel,
    effectiveTemperatureForModel,
    emitKeypressEvents,
    explicitPerformanceDirectiveValue,
    getActorialPartDefinitions,
    getCliPresentation: () => cliPresentation,
    getEngagementStanceDefinitions,
    getProviderConfig,
    humanDirectedRegisterPalette,
    input,
    isCliProvider,
    learnerProfileContract,
    learnerProfileIds,
    learnerProfilePickerPresentation,
    learnerProfileSuiteIds,
    learnerSuggestionEnabled,
    mixedLearner,
    moveCursor,
    oneLine,
    output,
    persistCurrentInteractiveSettings,
    registerTemperature,
    resetMixedLearnerSuggestion,
    resolveModel,
    resolveTutorModelSelection,
    resolveTutorStubTrainingReuse,
    setModelBinding(name, value) {
      if (name === 'visibleModel') visibleModel = value;
      else if (name === 'classifierResolved') classifierResolved = value;
      else if (name === 'classifierProviderConfig') classifierProviderConfig = value;
      else if (name === 'visibleClassifierModel') visibleClassifierModel = value;
      else if (name === 'learnerRecordResolved') learnerRecordResolved = value;
      else if (name === 'learnerRecordProviderConfig') learnerRecordProviderConfig = value;
      else if (name === 'visibleLearnerRecordModel') visibleLearnerRecordModel = value;
      else if (name === 'autoLearnerResolved') autoLearnerResolved = value;
      else if (name === 'autoLearnerProviderConfig') autoLearnerProviderConfig = value;
      else if (name === 'visibleAutoLearnerModel') visibleAutoLearnerModel = value;
      else if (name === 'visibleClassifierConfig') visibleClassifierConfig = value;
      else throw new Error(`unknown model binding: ${name}`);
    },
    state,
    tutorModelChoiceEntries,
    tutorStubCliThemeOptions,
    tutorStubConfigurableActorialPartIds,
    tutorStubDagFactDropoutSnapshot,
    tutorStubPublicMessagesForSpeaker,
    tutorStubTrainingReuseLabel,
    visibleClassifierModel,
    visibleLearnerRecordModel,
    visibleResolvedModel,
  });

  function mixedLearnerCompletionForLine(line) {
    if (!mixedLearner.enabled || processingTurn || state.interaction?.mode !== 'learner') return null;
    const suggestion = mixedLearner.suggestion;
    const text = String(suggestion?.text || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) return null;
    const raw = String(line || '');
    const trimmed = raw.trimStart();
    if (trimmed.startsWith('/')) return null;
    if (!trimmed) return text;
    return text.toLowerCase().startsWith(raw.trim().toLowerCase()) ? text : null;
  }

  function slashCommandCompletionForLine(line, { fallback = false } = {}) {
    const raw = String(line || '');
    const trimmed = raw.trimStart();
    if (!trimmed.startsWith('/')) return { candidates: [], replacement: raw };

    const completionMode = state.passthrough?.enabled ? 'passthrough' : 'normal';
    const commandOptions = { mode: completionMode, capabilities: state.capabilities };
    const requestedCommand = trimmed.split(/\s+/u)[0];
    if (
      tutorStubCanonicalCommandToken(requestedCommand) &&
      !tutorStubCommandAvailable(requestedCommand, commandOptions)
    ) {
      return { candidates: [], replacement: trimmed };
    }

    let pool = tutorStubCommandTokens(commandOptions);
    if (trimmed.startsWith('/mode ')) {
      pool = tutorStubStaticCommandCompletions('/mode', commandOptions);
    } else if (trimmed.startsWith('/debug ')) {
      pool = tutorStubStaticCommandCompletions('/debug', commandOptions);
    } else if (trimmed.startsWith('/feedback ')) {
      pool = [
        ...tutorStubStaticCommandCompletions('/feedback', commandOptions),
        ...Object.keys(TUTOR_STUB_FEEDBACK_REASONS).map((reason) => `/feedback down ${reason}`),
      ];
    } else if (trimmed.startsWith('/down ')) {
      pool = Object.keys(TUTOR_STUB_FEEDBACK_REASONS).map((reason) => `/down ${reason}`);
    } else if (trimmed.startsWith('/up ')) {
      pool = Object.keys(TUTOR_STUB_FEEDBACK_REASONS)
        .filter((reason) => reason.startsWith('helpful_') || reason === 'custom')
        .map((reason) => `/up ${reason}`);
    } else if (trimmed.startsWith('/tune ')) {
      pool = tutorStubStaticCommandCompletions('/tune', commandOptions);
    } else if (trimmed.startsWith('/theme ')) {
      pool = tutorStubStaticCommandCompletions('/theme', commandOptions);
    } else if (trimmed.startsWith('/motion ')) {
      pool = tutorStubStaticCommandCompletions('/motion', commandOptions);
    } else if (trimmed.startsWith('/random ')) {
      pool = tutorStubStaticCommandCompletions('/random', commandOptions);
    } else if (trimmed.startsWith('/committee ')) {
      pool = tutorStubStaticCommandCompletions('/committee', commandOptions);
    } else if (trimmed.startsWith('/register ')) {
      pool = [
        ...tutorStubStaticCommandCompletions('/register', commandOptions),
        ...humanDirectedRegisterPalette().map((stance) => `/register ${stance}`),
      ];
    } else if (trimmed.startsWith('/tutor ')) {
      pool = [
        ...tutorStubStaticCommandCompletions('/tutor', commandOptions),
        ...tutorStubConfigurableActorialPartIds().map((part) => `/tutor ${part}`),
      ];
    } else if (trimmed.startsWith('/learner ')) {
      pool = [
        ...tutorStubStaticCommandCompletions('/learner', commandOptions),
        ...learnerProfileIds().map((profileId) => `/learner ${profileId}`),
      ];
    } else if (trimmed.startsWith('/character ')) {
      pool = [
        ...tutorStubStaticCommandCompletions('/character', commandOptions),
        ...tutorStubConfigurableActorialPartIds().map((part) => `/character ${part}`),
        ...tutorStubConfigurableActorialPartIds().map((part) => `/character tutor ${part}`),
        ...learnerProfileIds().map((profileId) => `/character learner ${profileId}`),
      ];
    } else if (trimmed.startsWith('/settings model ')) {
      const modelCompletions = [
        '/settings model default',
        ...tutorModelChoiceEntries(state.modelRef).map((entry) => `/settings model ${entry.ref}`),
      ];
      pool = trimmed === '/settings model ' ? modelCompletions.slice(0, 16) : modelCompletions;
    } else if (trimmed.startsWith('/settings ')) {
      pool = tutorStubStaticCommandCompletions('/settings', commandOptions);
    } else if (trimmed.startsWith('/analysis ')) {
      pool = tutorStubStaticCommandCompletions('/analysis', commandOptions);
    } else if (trimmed.startsWith('/proof ')) {
      pool = tutorStubStaticCommandCompletions('/proof', commandOptions);
    } else if (trimmed.startsWith('/demo ')) {
      pool = tutorStubStaticCommandCompletions('/demo', commandOptions);
    } else if (trimmed.startsWith('/transcript ') || trimmed.startsWith('/html ')) {
      const command = trimmed.startsWith('/html ') ? '/html' : '/transcript';
      pool = tutorStubStaticCommandCompletions(command, commandOptions);
    } else if (trimmed.startsWith('/voice ')) {
      pool = tutorStubStaticCommandCompletions('/voice', commandOptions);
    } else if (trimmed.startsWith('/meta ') || trimmed.startsWith('/director ')) {
      const command = trimmed.startsWith('/meta ') ? '/meta' : '/director';
      const staticMatches = tutorStubStaticCommandCompletions(command, commandOptions).filter((candidate) =>
        candidate.startsWith(trimmed),
      );
      pool = staticMatches.length ? staticMatches : [trimmed];
    } else if (trimmed.startsWith('/lab ')) {
      pool = [
        ...tutorStubStaticCommandCompletions('/lab', commandOptions),
        ...listTutorStubLabs().map((entry) => `/lab ${entry.id}`),
      ];
    } else if (trimmed.startsWith('/profile ')) {
      pool = [
        ...tutorStubStaticCommandCompletions('/profile', commandOptions),
        ...learnerProfileIds().map((profileId) => `/profile ${profileId}`),
      ];
    } else if (trimmed.startsWith('/scenario ')) {
      pool = groupedWorldEntries().map(({ world }) => `/scenario ${world.id}`);
    } else if (trimmed.startsWith('/board ')) {
      try {
        const bundle = loadTutorStubCurriculum('workplan', { root: ROOT });
        pool = listTutorStubCurriculumModules(bundle).map((module) => `/board ${module.id}`);
      } catch {
        pool = ['/board'];
      }
    }
    const sortedPool = [...new Set(pool)].toSorted();
    const matches = sortedPool.filter((candidate) => candidate.startsWith(trimmed));
    return {
      candidates: matches.length || !fallback ? matches : sortedPool,
      replacement: trimmed,
    };
  }

  function slashCommandPaletteForLine(line) {
    const raw = String(line || '');
    const trimmed = raw.trimStart();
    if (!trimmed.startsWith('/')) return [];
    const { candidates } = slashCommandCompletionForLine(trimmed);
    const commands = [...new Set(candidates.map((candidate) => candidate.trimEnd()))].toSorted();
    const terminalWidth = Math.max(48, Number(output.columns) || 100);
    const countLabel =
      trimmed === '/'
        ? `${commands.length} available`
        : `${commands.length} ${commands.length === 1 ? 'match' : 'matches'} for ${trimmed}`;
    const header = `${C.brightCyan}${C.bold}slash commands${C.reset}${C.dim} · ${countLabel}${C.reset}`;
    if (!commands.length) {
      return [header, `${C.dim}  no match · Backspace to widen the list, or use /help${C.reset}`];
    }

    const visibleLimit = Math.max(4, Math.min(10, (Number(output.rows) || 24) - 7));
    const visibleCommands = commands.slice(0, visibleLimit);
    const widest = Math.max(...visibleCommands.map((command) => command.length));
    const commandWidth = Math.max(14, Math.min(42, Math.floor(terminalWidth * 0.42), widest));
    const summaryWidth = Math.max(16, terminalWidth - commandWidth - 5);
    const rows = visibleCommands.map((command) => {
      const commandLabel = oneLine(command, { max: commandWidth });
      const summary = oneLine(tutorStubCommandSummary(command) || 'run this command', { max: summaryWidth });
      return `  ${C.cyan}${commandLabel.padEnd(commandWidth)}${C.reset}  ${C.dim}${summary}${C.reset}`;
    });
    const hiddenCount = commands.length - visibleCommands.length;
    if (hiddenCount > 0) {
      rows.push(`${C.dim}  … ${hiddenCount} more · keep typing to narrow the list${C.reset}`);
    }
    rows.push(`${C.dim}  Tab completes · /help shows command groups${C.reset}`);
    return [header, ...rows];
  }

  function resetMixedLearnerSuggestion(reason, { preserveAnalysisCache = false } = {}) {
    if (!mixedLearner.enabled) return;
    mixedLearner.draftInsertion = null;
    const cachedAnalysis = mixedLearner.analysisCache;
    const cachedAnalysisSnapshot = cachedAnalysis
      ? {
          key: cachedAnalysis.key,
          status: cachedAnalysis.status,
          tutorStatus: cachedAnalysis.tutorStatus,
          turn: cachedAnalysis.turn,
          turnId: cachedAnalysis.turnId,
        }
      : null;
    const invalidated = invalidateMixedLearnerCache(mixedLearner, { preserveAnalysisCache });
    if (invalidated.discardedAnalysis) {
      mixedLearner.cacheStats.discarded += 1;
      appendTraceEvent(state.trace, {
        type: 'mixed_learner_analysis_cache_discarded',
        reason,
        turn: cachedAnalysisSnapshot.turn,
        turnId: cachedAnalysisSnapshot.turnId,
        status: cachedAnalysisSnapshot.status,
        tutorStatus: cachedAnalysisSnapshot.tutorStatus,
        tutorResponseDiscarded: invalidated.discardedTutorResponse,
        key: cachedAnalysisSnapshot.key,
      });
    }
    if (invalidated.hadState) {
      appendTraceEvent(state.trace, {
        type: 'mixed_learner_suggestion_cleared',
        reason,
        turns: state.turns.length,
      });
    }
    return invalidated;
  }

  function currentMixedLearnerAnalysisKey(answer, turnNumber = state.turns.length + 1, tutorFeedback = null) {
    const dagPreflight = learnerDagPreflightForTurn(state, turnNumber);
    return mixedLearnerAnalysisCacheKey({
      answer: String(answer || '').trim(),
      turn: turnNumber,
      history: state.history,
      world: state.world?.id || null,
      learnerDag: state.learnerDag?.lastModel
        ? {
            turn: state.learnerDag.lastModel.turn || null,
            metrics: state.learnerDag.lastModel.metrics || null,
            assessment: state.learnerDag.lastModel.assessment || null,
          }
        : null,
      learnerDagPreflightHash: dagPreflight?.contentSha256 || null,
      registerPolicy: tutorStubRegisterPolicyStackId(state.register?.policy, state.register?.overlays),
      randomPerformance: Boolean(state.randomPerformance?.enabled),
      lightAdaptation: {
        enabled: Boolean(state.lightAdaptation?.enabled),
        threshold: state.lightAdaptation?.threshold ?? DEFAULT_TUTOR_STUB_LIGHT_ADAPTATION_THRESHOLD,
      },
      performanceDirectives: {
        register: explicitPerformanceDirectiveValue(state, 'register'),
        character: explicitPerformanceDirectiveValue(state, 'character'),
      },
      directorGuidance: tutorStubDirectorGuidanceSnapshot(state.directorGuidance),
      registerOverlayThreshold: state.register?.overlayThreshold ?? null,
      registerTemperature: state.register?.temperature ?? null,
      dagFactDropout: tutorStubDagFactDropoutSnapshot(state.learnerDag?.dropout),
      releasePacing: tutorStubReleasePacingSnapshot(state.releasePacing, state.world),
      comprehension: tutorStubComprehensionSnapshot(state.comprehension, { turn: turnNumber }),
      registerHistory: (state.register?.history || []).map((entry) => ({
        turn: entry.turn || null,
        selectedRegister: entry.selected_register || null,
        source: entry.source || null,
      })),
      tutorFeedback: tutorFeedback?.supplied ? { rating: tutorFeedback.rating } : null,
      analysisModel: state.learnerDag?.resolved || state.classifier?.resolved || null,
      learnerProfile: mixedLearner.profile,
      dagMode: state.dagMode,
      systemPrompt: state.systemPrompt,
      schema: 'mixed-learner-analysis-cache.v1',
    });
  }

  function cloneStateForMixedLearnerSpeculation() {
    return {
      ...state,
      history: structuredClone(state.history),
      turns: structuredClone(state.turns),
      world: structuredClone(state.world),
      learnerDag: structuredClone(state.learnerDag),
      comprehension: structuredClone(state.comprehension),
      releasePacing: structuredClone(state.releasePacing),
      register: structuredClone(state.register),
      randomPerformance: structuredClone(state.randomPerformance),
      lightAdaptation: structuredClone(state.lightAdaptation),
      performanceDirectives: structuredClone(state.performanceDirectives),
      dialogueClosure: structuredClone(state.dialogueClosure),
      directorGuidance: structuredClone(state.directorGuidance),
      coach: structuredClone(state.coach),
      stream: { enabled: false, interim: state.interim },
    };
  }

  function cloneStateForInteractiveLearnerAttempt() {
    return {
      ...state,
      history: structuredClone(state.history),
      turns: structuredClone(state.turns),
      learnerDag: structuredClone(state.learnerDag),
      comprehension: structuredClone(state.comprehension),
      releasePacing: structuredClone(state.releasePacing),
      register: structuredClone(state.register),
      lightAdaptation: structuredClone(state.lightAdaptation),
      randomPerformance: structuredClone(state.randomPerformance),
      performanceDirectives: structuredClone(state.performanceDirectives),
      dialogueClosure: structuredClone(state.dialogueClosure),
      typedActions: structuredClone(state.typedActions),
      directorGuidance: structuredClone(state.directorGuidance),
      coach: structuredClone(state.coach),
      stream: { ...state.stream, interim: state.interim, deferOutput: true },
    };
  }

  function replayConcurrentComprehensionChanges(target, baseline, current) {
    const baselineHistoryLength = baseline?.history?.length || 0;
    const concurrentEntries = (current?.history || []).slice(baselineHistoryLength);
    for (const entry of concurrentEntries) {
      if (entry?.type === 'request') {
        applyTutorStubComprehensionRequest(target, {
          ...entry,
          detected: true,
          schema: 'machinespirits.tutor-stub.comprehension-request.v1',
        });
      } else if (entry?.type === 'response') {
        applyTutorStubComprehensionResponse(target, {
          text: entry.text,
          turn: entry.turn,
          source: entry.source,
          force: true,
          terms: entry.terms,
        });
      }
    }
    return target;
  }

  function mergeConcurrentCoachChanges(attemptCoach, baselineCoach, currentCoach) {
    const merged = structuredClone(attemptCoach || { pending: [], history: [] });
    const baselinePendingIds = new Set((baselineCoach?.pending || []).map((entry) => entry.id));
    const baselineHistoryKeys = new Set(
      (baselineCoach?.history || []).map((entry) => `${entry.turn || 0}:${entry.appliedAt || ''}`),
    );
    const mergedPendingIds = new Set((merged.pending || []).map((entry) => entry.id));
    for (const entry of currentCoach?.pending || []) {
      if (!baselinePendingIds.has(entry.id) && !mergedPendingIds.has(entry.id)) {
        merged.pending.push(structuredClone(entry));
        mergedPendingIds.add(entry.id);
      }
    }
    const mergedHistoryKeys = new Set(
      (merged.history || []).map((entry) => `${entry.turn || 0}:${entry.appliedAt || ''}`),
    );
    for (const entry of currentCoach?.history || []) {
      const key = `${entry.turn || 0}:${entry.appliedAt || ''}`;
      if (!baselineHistoryKeys.has(key) && !mergedHistoryKeys.has(key)) {
        merged.history.push(structuredClone(entry));
        mergedHistoryKeys.add(key);
      }
    }
    return merged;
  }

  function commitInteractiveLearnerAttempt(attemptState, baseline) {
    const currentComprehension = state.comprehension;
    const currentDirectorGuidance = state.directorGuidance;
    const currentCoach = state.coach;
    state.history = attemptState.history;
    state.turns = attemptState.turns;
    state.learnerDag = attemptState.learnerDag;
    state.releasePacing = attemptState.releasePacing;
    state.register = attemptState.register;
    state.dialogueClosure = attemptState.dialogueClosure;
    state.typedActions = attemptState.typedActions;
    state.comprehension = replayConcurrentComprehensionChanges(
      attemptState.comprehension,
      baseline.comprehension,
      currentComprehension,
    );
    state.directorGuidance = mergeConcurrentTutorStubDirectorGuidance(
      attemptState.directorGuidance,
      baseline.directorGuidance,
      currentDirectorGuidance,
    );
    state.coach = mergeConcurrentCoachChanges(attemptState.coach, baseline.coach, currentCoach);
  }

  function mixedLearnerTutorContextKey({
    learnerText,
    classification,
    tutorLearnerDag,
    registerSelection,
    humanDiscourseFrame,
    dialogueClosureFrame,
    tutorFeedback = null,
    comprehensionState = state.comprehension,
    runtimeState = state,
  }) {
    return mixedLearnerAnalysisCacheKey({
      learnerText,
      history: runtimeState.history,
      classifier: classifierTutorContext(classification),
      learnerDag: tutorLearnerDagModelContext(tutorLearnerDag?.model || tutorLearnerDag, {
        releasedEvidence: committedReleaseRows(runtimeState, runtimeState.turns.length + 1),
      }),
      learnerDagPreflightHash: tutorLearnerDag?.preflight?.contentSha256 || null,
      dagFactDropout: tutorStubDagFactDropoutSnapshot(runtimeState.learnerDag?.dropout),
      releasePacing: tutorStubReleasePacingSnapshot(runtimeState.releasePacing, runtimeState.world),
      register: responseConfigurationContext(registerSelection, {
        world: runtimeState?.world || null,
        multipleChoice: runtimeState.multipleChoice,
        humanDiscourseFrame,
        dialogueClosureFrame,
      }),
      humanDiscourse: humanDiscourseTutorContext(humanDiscourseFrame),
      dialogueClosure: dialogueClosureTutorContext(dialogueClosureFrame),
      comprehension: tutorStubComprehensionPrompt(comprehensionState, {
        turn: runtimeState.turns.length + 1,
      }),
      dagTurn:
        runtimeState.dag && runtimeState.world
          ? dagTurnContext(runtimeState, runtimeState.turns.length + 1, tutorLearnerDag)
          : null,
      coachGuidance: tutorCoachGuidanceContext(runtimeState),
      directorGuidance: tutorStubDirectorGuidancePrompt(runtimeState.directorGuidance, {
        tutorTurn: runtimeState.turns.length + 1,
      }),
      tutorFeedback: tutorFeedback?.supplied ? { rating: tutorFeedback.rating } : null,
      systemPrompt: runtimeState.systemPrompt,
      tutorModel: runtimeState.resolved,
      temperature: runtimeState.temperature,
      maxTokens: runtimeState.maxTokens,
      historyTurns: runtimeState.historyTurns,
      schema: 'mixed-learner-tutor-cache.v1',
    });
  }

  async function startMixedLearnerTutorPrefetch(entry, raw) {
    if (mixedLearner.analysisCache !== entry || exiting) return null;
    const prefetchDecision = mixedLearnerTutorPrefetchDecision({
      policy: state.mixedTutorPrefetchPolicy,
      typedActionsEnabled: state.typedActions?.enabled,
    });
    if (!prefetchDecision.enabled) {
      entry.tutorStatus = 'disabled';
      appendTraceEvent(state.trace, {
        type: 'mixed_learner_tutor_prefetch_skipped',
        turn: entry.turn,
        turnId: entry.turnId,
        reason: prefetchDecision.reason,
      });
      return null;
    }
    entry.tutorStatus = 'pending';
    entry.tutorStartedAt = Date.now();
    mixedLearner.cacheStats.tutorStarted += 1;
    try {
      const speculativeState = cloneStateForMixedLearnerSpeculation();
      const classification = classificationFromCombinedAnalysis(raw, speculativeState);
      const discoursePlane = resolveTutorStubDiscoursePlane({ learnerText: entry.answer, classification });
      const update = freezeTutorStubLearnerRecordUpdateForDiscoursePlane({
        update: learnerRecordFromCombinedAnalysis(raw),
        discoursePlane,
      });
      const tutorLearnerDag = applyLearnerRecordUpdate({
        update,
        state: speculativeState,
        tutorTurn: entry.turn,
        learnerText: entry.answer,
        ...learnerPublicEvidenceState(speculativeState, entry.turn),
      });
      tutorLearnerDag.preflight = raw.dagPreflight || null;
      applyLearnerAdvanceAssessment(classification, tutorLearnerDag);
      resolveConversationalCompletionForLearnerTurn({
        learnerText: entry.answer,
        state: speculativeState,
        classification,
        tutorLearnerDag,
      });
      speculativeState.learnerDag.lastModel = tutorLearnerDag.model;
      updateComprehensionForLearnerTurn({
        learnerText: entry.answer,
        state: speculativeState,
        classification,
        tutorTurn: entry.turn,
        recordTrace: false,
      });
      updateReleasePacingForLearnerTurn({
        learnerText: entry.answer,
        state: speculativeState,
        classification,
        tutorLearnerDag,
        tutorTurn: entry.turn,
        recordTrace: false,
      });
      evaluatePendingRegisterEfficacy(speculativeState, tutorLearnerDag, classification);
      let registerSelection = normalizeResponseConfigurationSelection(registerSelectionFromCombinedAnalysis(raw), {
        state: speculativeState,
        classification,
        tutorLearnerDag,
        raw,
        learnerText: entry.answer,
      });
      registerSelection = applyConversationalCompletionForLearnerTurn(
        speculativeState,
        registerSelection,
        tutorLearnerDag?.conversationalCompletion || null,
      );
      const humanDiscourseFrame = buildHumanDiscourseFrame({
        state: speculativeState,
        tutorTurn: entry.turn,
        tutorLearnerDag,
        classification,
        learnerText: entry.answer,
      });
      const { frame: dialogueClosureFrame } = tutorDialogueClosureFrameForTurn({
        state: speculativeState,
        tutorTurn: entry.turn,
        tutorLearnerDag,
      });
      entry.tutorContextKey = mixedLearnerTutorContextKey({
        learnerText: entry.answer,
        classification,
        tutorLearnerDag,
        registerSelection,
        humanDiscourseFrame,
        dialogueClosureFrame,
        comprehensionState: speculativeState.comprehension,
        runtimeState: speculativeState,
      });
      appendTraceEvent(state.trace, {
        type: 'mixed_learner_tutor_prefetch_start',
        turn: entry.turn,
        turnId: entry.turnId,
        requestId: entry.requestId,
        analysisKey: entry.key,
        tutorContextKey: entry.tutorContextKey,
      });
      entry.tutorPromise = callTutor({
        learnerText: entry.answer,
        history: speculativeState.history,
        state: speculativeState,
        systemPrompt: speculativeState.systemPrompt,
        resolved: speculativeState.resolved,
        temperature: speculativeState.temperature,
        maxTokens: speculativeState.maxTokens,
        historyTurns: speculativeState.historyTurns,
        world: speculativeState.world,
        dag: speculativeState.dag,
        classification,
        tutorLearnerDagModel: tutorLearnerDag,
        registerSelection,
        humanDiscourseFrame,
        dialogueClosureFrame,
        trace: state.trace,
        stream: { enabled: false, interim: state.interim },
        cliEffort: speculativeState.cliEffort,
        multipleChoice: speculativeState.multipleChoice,
        roleBase: 'tutor_stub_tutor_prefetch',
        signal: entry.abortController.signal,
      });
      const response = await entry.tutorPromise;
      if (mixedLearner.analysisCache !== entry || exiting) return null;
      entry.tutorStatus = 'ready';
      entry.tutorResponse = response;
      appendTraceEvent(state.trace, {
        type: 'mixed_learner_tutor_prefetch_ready',
        turn: entry.turn,
        turnId: entry.turnId,
        requestId: entry.requestId,
        tutorContextKey: entry.tutorContextKey,
        latencyMs: Date.now() - entry.tutorStartedAt,
      });
      return response;
    } catch (err) {
      if (err?.name === 'AbortError') return null;
      if (mixedLearner.analysisCache === entry) {
        entry.tutorStatus = 'error';
        entry.tutorError = err.message;
      }
      mixedLearner.cacheStats.errors += 1;
      appendTraceEvent(state.trace, {
        type: 'mixed_learner_tutor_prefetch_error',
        turn: entry.turn,
        turnId: entry.turnId,
        requestId: entry.requestId,
        error: err.message,
      });
      return null;
    }
  }

  async function takeMixedLearnerTutorPrefetch(
    entry,
    {
      learnerText,
      classification,
      tutorLearnerDag,
      registerSelection,
      humanDiscourseFrame,
      dialogueClosureFrame,
      tutorFeedback = null,
    },
  ) {
    if (!entry || mixedLearner.analysisCache !== entry) return null;
    const liveContextKey = mixedLearnerTutorContextKey({
      learnerText,
      classification,
      tutorLearnerDag,
      registerSelection,
      humanDiscourseFrame,
      dialogueClosureFrame,
      tutorFeedback,
    });
    if (!entry.tutorContextKey || entry.tutorContextKey !== liveContextKey) {
      mixedLearner.cacheStats.tutorMisses += 1;
      appendTraceEvent(state.trace, {
        type: 'mixed_learner_tutor_cache_miss',
        turn: entry.turn,
        turnId: entry.turnId,
        reason: !entry.tutorContextKey ? 'not_prefetched' : 'context_changed',
        cachedKey: entry.tutorContextKey || null,
        liveKey: liveContextKey,
      });
      mixedLearner.analysisCache = null;
      return null;
    }
    const waited = entry.tutorStatus === 'pending';
    if (waited) {
      startInterimAnimation(state, 'awaiting prefetched tutor response', {
        learnerText,
        tutorTurn: entry.turn,
        classification,
        tutorLearnerDag,
        registerSelection,
      });
      await entry.tutorPromise;
      stopInterimAnimation(state);
    }
    if (!entry.tutorResponse || entry.tutorStatus !== 'ready') {
      mixedLearner.cacheStats.tutorMisses += 1;
      appendTraceEvent(state.trace, {
        type: 'mixed_learner_tutor_cache_miss',
        turn: entry.turn,
        turnId: entry.turnId,
        reason: entry.tutorError ? 'prefetch_error' : 'prefetch_unavailable',
        key: liveContextKey,
      });
      mixedLearner.analysisCache = null;
      return null;
    }
    const response = { ...entry.tutorResponse, speculativeCacheHit: true };
    mixedLearner.analysisCache = null;
    mixedLearner.cacheStats.tutorHits += 1;
    appendTraceEvent(state.trace, {
      type: 'mixed_learner_tutor_cache_hit',
      turn: entry.turn,
      turnId: entry.turnId,
      key: liveContextKey,
      waited,
      ageMs: Date.now() - entry.tutorStartedAt,
    });
    return response;
  }

  function startMixedLearnerAnalysisPrefetch({ answer, turnNumber, turnId, requestId }) {
    if (!state.classifier.enabled || !state.learnerDag.enabled || !state.world || !answer) return false;
    const key = currentMixedLearnerAnalysisKey(answer, turnNumber);
    const analysisState = cloneStateForMixedLearnerSpeculation();
    updateComprehensionForLearnerTurn({
      learnerText: answer,
      state: analysisState,
      classification: null,
      tutorTurn: turnNumber,
      recordTrace: false,
    });
    const entry = {
      key,
      answer,
      turn: turnNumber,
      turnId,
      requestId,
      status: 'pending',
      startedAt: Date.now(),
      raw: null,
      error: null,
      promise: null,
      tutorStatus: 'idle',
      tutorContextKey: null,
      tutorPromise: null,
      tutorResponse: null,
      tutorError: null,
      abortController: new AbortController(),
    };
    mixedLearner.analysisCache = entry;
    mixedLearner.cacheStats.analysisStarted += 1;
    appendTraceEvent(state.trace, {
      type: 'mixed_learner_analysis_prefetch_start',
      turn: turnNumber,
      turnId,
      requestId,
      key,
    });
    entry.promise = extractCombinedLearnerAnalysis({
      learnerText: answer,
      state: analysisState,
      tutorTurn: turnNumber,
      role: 'tutor_stub_learner_analysis_prefetch',
      preflightSource: 'mixed_learner_analysis_prefetch',
      stream: { enabled: false, interim: state.interim },
      signal: entry.abortController.signal,
    })
      .then((raw) => {
        if (mixedLearner.analysisCache !== entry) return null;
        entry.status = 'ready';
        entry.raw = raw;
        appendTraceEvent(state.trace, {
          type: 'mixed_learner_analysis_prefetch_ready',
          turn: turnNumber,
          turnId,
          requestId,
          key,
          latencyMs: Date.now() - entry.startedAt,
        });
        void startMixedLearnerTutorPrefetch(entry, raw);
        return raw;
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return null;
        if (mixedLearner.analysisCache === entry) {
          entry.status = 'error';
          entry.error = err.message;
        }
        mixedLearner.cacheStats.errors += 1;
        appendTraceEvent(state.trace, {
          type: 'mixed_learner_analysis_prefetch_error',
          turn: turnNumber,
          turnId,
          requestId,
          key,
          error: err.message,
        });
        return null;
      });
    return true;
  }

  async function takeMixedLearnerAnalysisPrefetch(learnerText, tutorFeedback = null) {
    if (!mixedLearner.enabled) return null;
    const entry = mixedLearner.analysisCache;
    const answer = String(learnerText || '').trim();
    const expectedKey = currentMixedLearnerAnalysisKey(answer, state.turns.length + 1, tutorFeedback);
    if (!entry || entry.answer !== answer || entry.key !== expectedKey) {
      mixedLearner.cacheStats.analysisMisses += 1;
      appendTraceEvent(state.trace, {
        type: 'mixed_learner_analysis_cache_miss',
        turn: state.turns.length + 1,
        reason: !entry ? 'not_prefetched' : entry.answer !== answer ? 'answer_changed' : 'state_changed',
        cachedKey: entry?.key || null,
        submittedKey: expectedKey,
      });
      return null;
    }
    const waited = entry.status === 'pending';
    if (waited) {
      startInterimAnimation(state, 'awaiting prefetched learner analysis', {
        learnerText: answer,
        tutorTurn: state.turns.length + 1,
      });
      await entry.promise;
      stopInterimAnimation(state);
    }
    if (!entry.raw || entry.status !== 'ready') {
      mixedLearner.cacheStats.analysisMisses += 1;
      appendTraceEvent(state.trace, {
        type: 'mixed_learner_analysis_cache_miss',
        turn: entry.turn,
        turnId: entry.turnId,
        reason: entry.error ? 'prefetch_error' : 'prefetch_unavailable',
        key: entry.key,
      });
      return null;
    }
    mixedLearner.cacheStats.analysisHits += 1;
    appendTraceEvent(state.trace, {
      type: 'mixed_learner_analysis_cache_hit',
      turn: entry.turn,
      turnId: entry.turnId,
      key: entry.key,
      waited,
      ageMs: Date.now() - entry.startedAt,
    });
    return { raw: entry.raw, entry };
  }

  function startMixedLearnerPrefetch(reason = 'turn_complete', { force = false, refreshPrompt = true } = {}) {
    if (!mixedLearner.enabled || exiting || state.dialogueClosure?.phase === 'closed') return false;
    const turnNumber = state.turns.length + 1;
    const turnId = turnDebugId(state, turnNumber);
    if (!force && (mixedLearner.pending?.turn === turnNumber || mixedLearner.suggestion?.turn === turnNumber)) {
      return false;
    }
    if (force) resetMixedLearnerSuggestion(reason);
    const requestId = mixedLearner.seq + 1;
    mixedLearner.seq = requestId;
    mixedLearner.pending = { requestId, turn: turnNumber, turnId };
    mixedLearner.suggestion = null;
    mixedLearner.error = null;
    const artifactAbortController = new AbortController();
    mixedLearner.artifactAbortController = artifactAbortController;
    appendTraceEvent(state.trace, {
      type: 'mixed_learner_prefetch_start',
      turn: turnNumber,
      turnId,
      requestId,
      reason,
      model: mixedLearner.resolved,
    });
    const prefetchPromise = generateMixedLearnerArtifacts({
      state,
      resolved: mixedLearner.resolved,
      profile: mixedLearner.profile,
      turnNumber,
      cliEffort,
      signal: artifactAbortController.signal,
    })
      .then((generated) => {
        if (mixedLearner.artifactAbortController === artifactAbortController) {
          mixedLearner.artifactAbortController = null;
        }
        const text = String(generated.answer || '').trim();
        const clue = String(generated.clue || '').trim();
        const move = mixedLearnerSuggestionMove(text, generated.move);
        const profileSignal = String(generated.profileSignal || '').trim() || null;
        if (!mixedLearner.enabled || mixedLearner.seq !== requestId || exiting) {
          appendTraceEvent(state.trace, {
            type: 'mixed_learner_prefetch_discarded',
            turn: turnNumber,
            turnId,
            requestId,
            reason: exiting ? 'exiting' : 'stale',
          });
          return;
        }
        mixedLearner.pending = null;
        const promptSnapshot = generated.promptSnapshot
          ? {
              ...generated.promptSnapshot,
              requestId,
              profileId: mixedLearner.profileId,
            }
          : null;
        if (promptSnapshot) {
          mixedLearner.promptHistory.push(promptSnapshot);
          if (mixedLearner.promptHistory.length > 100) mixedLearner.promptHistory.shift();
        }
        mixedLearner.suggestion = {
          requestId,
          turn: turnNumber,
          turnId,
          text,
          clue: clue || null,
          move,
          profileId: mixedLearner.profileId,
          profile: mixedLearner.profile,
          profileSignal,
          provider: generated.provider,
          model: generated.model,
          latencyMs: generated.latencyMs,
          usage: generated.usage,
          promptSnapshot,
        };
        appendTraceEvent(state.trace, {
          type: 'mixed_learner_suggestion_ready',
          turn: turnNumber,
          turnId,
          requestId,
          text,
          clue: clue || null,
          move,
          profileId: mixedLearner.profileId,
          profileSignal,
          parsedArtifacts: generated.parsedArtifacts,
          provider: generated.provider,
          model: generated.model,
          latencyMs: generated.latencyMs,
          usage: generated.usage,
        });
        const analysisWarming = startMixedLearnerAnalysisPrefetch({
          answer: text,
          turnNumber,
          turnId,
          requestId,
        });
        if (!processingTurn && !exiting) {
          printWithConcurrentTerminal(state, () => {
            clearStatusLine();
            if (consumeMixedLearnerReadyAnnouncement(mixedLearner)) {
              const technicalSuffix = automaticTechnicalDetailsEnabled(state)
                ? ` · ${turnId}${analysisWarming ? ' · learner analysis running' : ''}`
                : '';
              console.log(
                `${C.brightGreen}learner suggestion ready >${C.reset} ${move === 'ask_question' ? 'ask a question' : 'respond'}${technicalSuffix}`,
              );
              console.log(
                `${C.dim}  dark text is a preview · Tab inserts it for editing · /clue guides · /suggest shows · /use sends${C.reset}`,
              );
              printMixedLearnerProfilePresentation(mixedLearner.suggestion);
              appendTraceEvent(state.trace, {
                type: 'mixed_learner_ready_announcement',
                turn: turnNumber,
                turnId,
                profileId: mixedLearner.profileId,
                move,
              });
            }
            if (refreshPrompt && !concurrentTerminal.enabled) refreshMixedLearnerPrompt(rl);
          });
        }
      })
      .catch((err) => {
        if (mixedLearner.artifactAbortController === artifactAbortController) {
          mixedLearner.artifactAbortController = null;
        }
        if (err?.name === 'AbortError') return;
        if (!mixedLearner.enabled || mixedLearner.seq !== requestId) return;
        mixedLearner.pending = null;
        mixedLearner.error = { turn: turnNumber, turnId, message: err.message };
        appendTraceEvent(state.trace, {
          type: 'mixed_learner_prefetch_error',
          turn: turnNumber,
          turnId,
          requestId,
          error: err.message,
        });
        if (!processingTurn && !exiting) {
          printWithConcurrentTerminal(state, () => {
            clearStatusLine();
            console.log(
              `${C.red}learner suggestion error:${C.reset} ${err.message}${C.dim} · use /regen to retry${C.reset}`,
            );
            if (refreshPrompt && !concurrentTerminal.enabled) refreshMixedLearnerPrompt(rl);
          });
        }
      });
    return prefetchPromise;
  }

  function showMixedLearnerSuggestion({ duringTurn = false } = {}) {
    clearStatusLine();
    if (!mixedLearner.enabled) {
      console.log(`${C.dim}learner suggestions are off; start with --mixed-learner to enable them${C.reset}\n`);
      return;
    }
    if (mixedLearner.suggestion?.text) {
      console.log(
        `${C.cyan}learner suggestion >${C.reset} ${mixedLearner.suggestion.move === 'ask_question' ? 'ask a question' : 'respond'}`,
      );
      printMixedLearnerProfilePresentation(mixedLearner.suggestion);
      console.log(`${mixedLearner.suggestion.text}\n`);
      return;
    }
    if (mixedLearner.pending) {
      console.log(`${C.dim}the learner suggestion is still being drafted; use /suggest again shortly${C.reset}\n`);
      return;
    }
    if (mixedLearner.error) {
      console.log(
        `${C.red}learner suggestion error:${C.reset} ${mixedLearner.error.message}${C.dim} · use /regen to retry${C.reset}\n`,
      );
      return;
    }
    if (duringTurn) {
      console.log(`${C.dim}the tutor is still responding; the next learner suggestion starts afterward${C.reset}\n`);
      return;
    }
    console.log(`${C.dim}no learner suggestion is ready; starting one now${C.reset}\n`);
    startMixedLearnerPrefetch('suggest');
  }

  function showMixedLearnerClue({ duringTurn = false } = {}) {
    clearStatusLine();
    if (!mixedLearner.enabled) {
      console.log(`${C.dim}learner suggestions are off; start with --mixed-learner to use /clue${C.reset}\n`);
      return;
    }
    if (mixedLearner.suggestion?.clue) {
      console.log(
        `${C.cyan}learner clue >${C.reset} ${mixedLearner.suggestion.move === 'ask_question' ? 'ask a question' : 'respond'}`,
      );
      console.log(`${mixedLearner.suggestion.clue}\n`);
      return;
    }
    if (mixedLearner.suggestion?.text) {
      console.log(
        `${C.dim}the answer is ready, but no safe non-revealing clue was returned; /regen retries the pair${C.reset}\n`,
      );
      return;
    }
    if (mixedLearner.pending) {
      console.log(`${C.dim}the clue and learner suggestion are still being drafted${C.reset}\n`);
      return;
    }
    if (mixedLearner.error) {
      console.log(
        `${C.red}learner suggestion error:${C.reset} ${mixedLearner.error.message}${C.dim} · use /regen to retry${C.reset}\n`,
      );
      return;
    }
    if (duringTurn) {
      console.log(`${C.dim}the tutor is still responding; clue generation starts afterward${C.reset}\n`);
      return;
    }
    console.log(`${C.dim}no learner clue is ready; starting the clue and suggestion now${C.reset}\n`);
    startMixedLearnerPrefetch('clue');
  }

  function printMixedLearnerProfileList(listScope = 'core', { picker = false } = {}) {
    const scopeConfig = {
      core: { suite: 'core', label: 'ordinary choices' },
      stress: { suite: 'stress', label: 'specialist failure modes' },
      all: { suite: 'audit', label: 'complete v3 registry' },
      audit: { suite: 'audit', label: 'complete v3 registry' },
    }[
      String(listScope || 'core')
        .trim()
        .toLowerCase()
    ];
    if (!scopeConfig) return false;
    const profileIds = learnerProfileSuiteIds(scopeConfig.suite);
    console.log(`${C.cyan}learner profiles > ${scopeConfig.label} (${profileIds.length})${C.reset}`);
    console.log(learnerProfileListText({ ids: profileIds, includeSuites: false }));
    if (picker) {
      console.log(
        `${C.dim}  choose a learner by entering one profile id above; browse list (ordinary), stress, or all${C.reset}\n`,
      );
    } else if (scopeConfig.suite === 'core') {
      console.log(
        `${C.dim}  specialist profiles: /profile list stress · complete registry: /profile list all${C.reset}\n`,
      );
    } else {
      console.log(`${C.dim}  ordinary choices: /profile list · complete registry: /profile list all${C.reset}\n`);
    }
    return true;
  }

  function handleMixedLearnerProfileCommand(argument = '', { duringTurn = false } = {}) {
    clearStatusLine();
    if (!mixedLearner.enabled) {
      console.log(`${C.dim}learner suggestions are off; start with --mixed-learner to use /profile${C.reset}\n`);
      return;
    }
    const requested = String(argument || '').trim();
    if (!requested) {
      const label = mixedLearner.profileId
        ? `${mixedLearner.profileId}: ${learnerProfileDescription(mixedLearner.profileId)}`
        : `custom: ${oneLine(mixedLearner.profile, { max: 180 })}`;
      console.log(`${C.cyan}learner profile >${C.reset} ${label}`);
      console.log(
        `${C.dim}  use /profile list, /profile list stress, /profile list all, /profile example, /profile <id>, /profile default, or /profile custom <description>${C.reset}\n`,
      );
      return;
    }
    if (requested === 'list' || requested.startsWith('list ')) {
      const listScope = requested.slice('list'.length).trim().toLowerCase() || 'core';
      if (!printMixedLearnerProfileList(listScope)) {
        console.log(`${C.red}unknown learner profile list: ${listScope}${C.reset}`);
        console.log(`${C.dim}  use /profile list, /profile list stress, or /profile list all${C.reset}\n`);
      }
      return;
    }
    if (requested === 'example') {
      console.log(`${C.cyan}custom learner profile example >${C.reset}`);
      console.log(`/profile custom ${CUSTOM_LEARNER_PROFILE_EXAMPLE}`);
      console.log(
        `${C.dim}  describe an observable pattern, its trigger, and the tutor support that permits progress; do not add hidden case facts${C.reset}\n`,
      );
      return;
    }

    let nextProfile;
    let nextProfileId = null;
    if (requested === 'default') {
      nextProfile = mixedLearner.defaultProfile;
      nextProfileId = automatedLearnerProfileId(nextProfile);
    } else if (requested.startsWith('custom ')) {
      nextProfile = requested.slice('custom '.length).trim();
      if (!nextProfile) {
        console.log(`${C.red}profile error:${C.reset} custom profile text is empty\n`);
        return;
      }
    } else {
      nextProfileId = requested.toLowerCase().replace(/-/gu, '_');
      if (!learnerProfileIds().includes(nextProfileId)) {
        console.log(`${C.red}unknown learner profile:${C.reset} ${requested}`);
        console.log(
          `${C.dim}  use /profile list, /profile list stress, or /profile list all to see valid ids${C.reset}\n`,
        );
        return;
      }
      nextProfile = learnerProfilePrompt(nextProfileId);
    }

    const previousProfileId = mixedLearner.profileId;
    const invalidated = resetMixedLearnerSuggestion('profile_changed');
    mixedLearner.profile = nextProfile;
    mixedLearner.profileId = nextProfileId;
    state.learnerProfile = nextProfile;
    state.learnerProfileId = nextProfileId;
    args['auto-learner-profile'] = nextProfile;
    rl.setPrompt(mixedLearnerPromptText());
    const remembered = persistCurrentInteractiveSettings('learner_profile_changed');
    appendTraceEvent(state.trace, {
      type: 'mixed_learner_profile_changed',
      previousProfileId,
      profileId: nextProfileId,
      custom: !nextProfileId,
      duringTurn,
      turn: state.turns.length + 1,
      cacheRefresh: {
        priorStateCleared: Boolean(invalidated?.hadState),
        analysisDiscarded: Boolean(invalidated?.discardedAnalysis),
        tutorResponseDiscarded: Boolean(invalidated?.discardedTutorResponse),
      },
      rememberedAt: remembered?.updatedAt || null,
    });
    const label = nextProfileId ? `${nextProfileId}: ${learnerProfileDescription(nextProfileId)}` : 'custom profile';
    console.log(`${C.cyan}learner profile >${C.reset} switched to ${label}`);
    if (duringTurn) {
      console.log(`${C.dim}  applies when the current tutor response completes${C.reset}\n`);
    } else if (latestTutorMessage(state)) {
      startMixedLearnerPrefetch('profile_changed');
      console.log(
        `${C.dim}  discarded the old clue and suggestion; rebuilding them for the current turn; Tab activates when the new suggestion is ready${C.reset}\n`,
      );
    } else {
      console.log(`${C.dim}  applies after the next tutor message${C.reset}\n`);
    }
  }

  function applyInitialMixedLearnerProfile(profileId, { usedDefault = false, selectionMethod = 'typed' } = {}) {
    if (profileId) {
      mixedLearner.profileId = profileId;
      mixedLearner.profile = learnerProfilePrompt(profileId);
    }
    state.learnerProfileId = mixedLearner.profileId || null;
    state.learnerProfile = mixedLearner.profile;
    args['auto-learner-profile'] = mixedLearner.profile;
    appendTraceEvent(state.trace, {
      type: 'mixed_learner_initial_profile_selected',
      profileId: profileId || null,
      custom: !profileId,
      usedDefault,
      selectionMethod,
    });
  }

  async function runInitialMixedLearnerSetup() {
    if (!initialMixedLearnerSetupEnabled || !mixedLearner.enabled || !openingEnabled || state.history.length)
      return true;
    const defaultProfileId = mixedLearner.profileId || 'custom';
    const keyboardMenuEnabled = Boolean(input.isTTY && output.isTTY && typeof input.setRawMode === 'function');
    if (initialProfilePromptEnabled) {
      console.log(`${C.cyan}Pick a learner profile${C.reset}`);
      if (keyboardMenuEnabled) {
        console.log(
          `${C.dim}  ↑/↓ scroll · Enter select · highlighted learner described below · Esc quit · ${defaultProfileId} selected by default${C.reset}`,
        );
      } else {
        console.log(`${C.dim}  enter a profile id and press Enter, or press Enter for ${defaultProfileId}${C.reset}`);
        console.log(
          `${C.dim}  browse groups: list = ordinary profiles · stress = stress profiles · all = every profile${C.reset}`,
        );
      }
    }

    const queuedLines = [];
    let resolveNextLine = null;
    const enqueueLine = (line) => {
      if (resolveNextLine) {
        const resolve = resolveNextLine;
        resolveNextLine = null;
        resolve(line);
      } else {
        queuedLines.push(line);
      }
    };
    const nextLine = () =>
      queuedLines.length
        ? Promise.resolve(queuedLines.shift())
        : new Promise((resolve) => {
            resolveNextLine = resolve;
          });
    const onLine = (line) => enqueueLine(line);
    const onSigint = () => enqueueLine('/quit');
    let lineListenersAttached = false;
    const attachLineListeners = () => {
      if (lineListenersAttached) return;
      rl.on('line', onLine);
      rl.on('SIGINT', onSigint);
      lineListenersAttached = true;
    };
    try {
      let profileSelected = !initialProfilePromptEnabled;
      if (initialProfilePromptEnabled && keyboardMenuEnabled) {
        const selection = await pickInitialMixedLearnerProfileWithKeyboard(defaultProfileId);
        if (!selection) {
          requestExit('initial_profile_picker_exit');
          return false;
        }
        applyInitialMixedLearnerProfile(selection.id, {
          usedDefault: (selection.id || 'custom') === defaultProfileId,
          selectionMethod: 'keyboard_menu',
        });
        const selectedLabel = selection.id ? `${selection.id} — ${selection.label}` : `custom — ${selection.label}`;
        console.log(`${C.cyan}learner profile >${C.reset} ${selectedLabel}\n`);
        profileSelected = true;
      } else if (initialProfilePromptEnabled) {
        initialSetupStage = 'profile';
        attachLineListeners();
        while (!exiting) {
          rl.setPrompt(`${C.bold}learner profile [${defaultProfileId}] >${C.reset} `);
          rl.prompt();
          const answer = await nextLine();
          const rawRequested = String(answer || '')
            .trim()
            .toLowerCase();
          if (rawRequested === '/quit' || rawRequested === 'quit' || rawRequested === 'exit') {
            requestExit('initial_profile_picker_exit');
            return false;
          }
          const requested = rawRequested.replace(/^\/profile(?:\s+|$)/u, '');
          const browseScope =
            requested === 'list' || requested === 'core'
              ? 'core'
              : requested === 'stress' || requested === 'list stress'
                ? 'stress'
                : requested === 'all' || requested === 'audit' || requested === 'list all'
                  ? 'all'
                  : null;
          if (browseScope) {
            printMixedLearnerProfileList(browseScope, { picker: true });
            continue;
          }
          if (!requested) {
            applyInitialMixedLearnerProfile(mixedLearner.profileId, {
              usedDefault: true,
              selectionMethod: 'typed_default',
            });
            console.log();
            profileSelected = true;
            break;
          }
          const profileId = requested.replace(/-/gu, '_');
          if (!learnerProfileIds().includes(profileId)) {
            console.log(`${C.red}unknown learner profile: ${requested}${C.reset}`);
            console.log(`${C.dim}  type list, stress, or all to browse; press Enter for ${defaultProfileId}${C.reset}`);
            continue;
          }
          applyInitialMixedLearnerProfile(profileId, {
            usedDefault: false,
            selectionMethod: 'typed_profile_id',
          });
          console.log();
          profileSelected = true;
          break;
        }
      }
      if (!profileSelected || exiting) return false;

      const temperaturePromptEnabled = Boolean(
        initialTemperaturePromptEnabled && state.register?.enabled && registerTemperatureApplies(state.register.policy),
      );
      const dropoutPromptEnabled = Boolean(initialDropoutPromptEnabled && state.learnerDag?.enabled);
      const releaseSpeedPromptEnabled = Boolean(initialReleaseSpeedPromptEnabled && state.world && state.releasePacing);

      const promptForSetting = async ({ stage, label, defaultValue, recommendedValue, guidance, normalize }) => {
        console.log(`${C.dim}  ${guidance}${C.reset}`);
        while (!exiting) {
          initialSetupStage = stage;
          const defaultLabel =
            defaultValue === recommendedValue
              ? `${defaultValue}; recommended`
              : `${defaultValue}; recommended ${recommendedValue}`;
          rl.setPrompt(`${C.bold}${label} [${defaultLabel}] >${C.reset} `);
          rl.prompt();
          const answer = String((await nextLine()) || '').trim();
          if (['/quit', 'quit', 'exit'].includes(answer.toLowerCase())) {
            requestExit('initial_settings_exit');
            return null;
          }
          if (!answer) return { value: defaultValue, usedDefault: true };
          try {
            return { value: normalize(answer), usedDefault: false };
          } catch (error) {
            console.log(`${C.red}setting error:${C.reset} ${error.message}`);
          }
        }
        return null;
      };

      // First-run model selection was removed (user directive 2026-07-12): the
      // launch/default model is used as-is and stays changeable at runtime via
      // `/settings model`. Record the default in the trace so provenance is
      // unchanged; applying the same ref is a no-op that skips the prefetch.
      const appliedTutorModel = applyTutorModelSelection(state.modelRef, {
        source: 'initial_settings',
        usedDefault: true,
      });
      attachLineListeners();

      if (temperaturePromptEnabled || dropoutPromptEnabled || releaseSpeedPromptEnabled) {
        console.log(`${C.cyan}Tune the dialogue${C.reset}`);
        console.log(`${C.dim}  press Enter to accept each launch value; recommendations are shown beside it${C.reset}`);
      }

      let temperatureSelection = null;
      if (temperaturePromptEnabled) {
        temperatureSelection = await promptForSetting({
          stage: 'temperature',
          label: 'teaching-style range',
          defaultValue: state.register.temperature,
          recommendedValue: DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
          guidance: `0.15 strongly concentrates the leading teaching style and part to play; higher values mix in more alternatives (${MIN_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE}-${MAX_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE})`,
          normalize: (value) =>
            normalizeTutorStubEngagementStanceTemperature(value, {
              label: 'teaching-style range',
            }),
        });
        if (!temperatureSelection) return false;
        state.register.temperature = temperatureSelection.value;
        console.log();
      }

      let dropoutSelection = null;
      if (dropoutPromptEnabled) {
        dropoutSelection = await promptForSetting({
          stage: 'dropout',
          label: 'evidence-memory dropout',
          defaultValue: state.learnerDag.dropout.rate,
          recommendedValue: DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_RATE,
          guidance:
            '0 keeps previously understood evidence reliable; values above 0 simulate occasional, recoverable forgetting (0-1)',
          normalize: (value) => normalizeTutorStubDagFactDropoutRate(value, { label: 'evidence-memory dropout' }),
        });
        if (!dropoutSelection) return false;
        state.learnerDag.dropout.rate = dropoutSelection.value;
        console.log();
      }

      let releaseSpeedSelection = null;
      if (releaseSpeedPromptEnabled) {
        releaseSpeedSelection = await promptForSetting({
          stage: 'release_speed',
          label: 'clue release speed',
          defaultValue: state.releasePacing.baseSpeed,
          recommendedValue: DEFAULT_TUTOR_STUB_RELEASE_SPEED,
          guidance: `1 follows the authored clue schedule; lower slows it and higher brings clues forward (${MIN_TUTOR_STUB_RELEASE_SPEED}-${MAX_TUTOR_STUB_RELEASE_SPEED}). Direct learner requests can adapt it further.`,
          normalize: (value) => normalizeTutorStubReleaseSpeed(value, { label: 'clue release speed' }),
        });
        if (!releaseSpeedSelection) return false;
        setTutorStubReleaseSpeed({
          pacing: state.releasePacing,
          world: state.world,
          speed: releaseSpeedSelection.value,
          turn: state.turns.length + 1,
        });
        console.log();
      }

      appendTraceEvent(state.trace, {
        type: 'mixed_learner_initial_settings_selected',
        schema: 'machinespirits.tutor-stub.initial-dialogue-settings.v1',
        tutorModel: {
          modelRef: appliedTutorModel.modelRef,
          provider: appliedTutorModel.resolved.provider,
          model: appliedTutorModel.resolved.model,
          recommended: STUB.model,
          usedDefault: true,
          selectionSkipped: true,
        },
        engagementStanceTemperature: temperatureSelection
          ? {
              value: temperatureSelection.value,
              recommended: DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
              usedDefault: temperatureSelection.usedDefault,
            }
          : null,
        dagFactDropout: dropoutSelection
          ? {
              value: dropoutSelection.value,
              recommended: DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_RATE,
              seed: state.learnerDag.dropout.seed,
              usedDefault: dropoutSelection.usedDefault,
            }
          : null,
        clueReleaseSpeed: releaseSpeedSelection
          ? {
              value: releaseSpeedSelection.value,
              recommended: DEFAULT_TUTOR_STUB_RELEASE_SPEED,
              adaptive: true,
              usedDefault: releaseSpeedSelection.usedDefault,
            }
          : null,
      });
      return true;
    } finally {
      initialSetupStage = 'off';
      if (lineListenersAttached) {
        rl.removeListener('line', onLine);
        rl.removeListener('SIGINT', onSigint);
      }
      resolveNextLine = null;
      rl.setPrompt(mixedLearnerPromptText());
    }
  }

  function acceptMixedLearnerSuggestion({ duringTurn = false } = {}) {
    clearStatusLine();
    if (!mixedLearner.enabled) {
      console.log(`${C.dim}learner suggestions are off; start with --mixed-learner to use /use${C.reset}\n`);
      return;
    }
    if (duringTurn) {
      console.log(
        `${C.dim}tutor is still thinking; /use is available once the current tutor response completes${C.reset}\n`,
      );
      return;
    }
    const suggestion = mixedLearner.suggestion;
    if (!suggestion?.text) {
      showMixedLearnerSuggestion({ duringTurn });
      return;
    }
    const provenance = createTutorStubLearnerResponseProvenance({
      authorship: 'ai',
      origin: 'mixed_suggestion_accepted',
      inputMethod: 'slash_use',
      humanInLoop: true,
      modelRef: state.autoLearner?.modelRef || null,
      provider: suggestion.provider || mixedLearner.resolved?.provider || null,
      model: suggestion.model || mixedLearner.resolved?.model || null,
      learnerProfileId: suggestion.profileId || mixedLearner.profileId || null,
      suggestion: {
        requestId: suggestion.requestId,
        turn: suggestion.turn,
        turnId: suggestion.turnId,
        acceptedUnchanged: true,
        edited: false,
      },
    });
    mixedLearner.suggestion = null;
    mixedLearner.draftInsertion = null;
    appendTraceEvent(state.trace, {
      type: 'mixed_learner_suggestion_accepted',
      turn: suggestion.turn,
      turnId: suggestion.turnId,
      requestId: suggestion.requestId,
      text: suggestion.text,
      move: suggestion.move,
      profileId: suggestion.profileId,
      profileSignal: suggestion.profileSignal,
      learnerResponseProvenance: provenance,
      duringTurn,
    });
    printMixedLearnerProfilePresentation(suggestion, { verb: 'visible in response' });
    console.log(`${C.bold}learner(mixed) >${C.reset} ${suggestion.text}\n`);
    if (processingTurn || duringTurn) {
      if (extendActiveLearnerTurn(suggestion.text, provenance)) return;
      pendingLearnerLines.push({ text: suggestion.text, provenance });
      console.log(`${C.dim}learner reply queued (${pendingLearnerLines.length} waiting)${C.reset}`);
      return;
    }
    void processLearnerLine(suggestion.text, provenance);
  }

  const {
    chooseAnotherScenario,
    chooseWorkplanModule,
    emitOpeningPrompt,
    emitResumeHandoff,
    resetInteractiveState,
    transcriptPayload,
    writeCurrentTranscriptHtml,
  } = createTutorStubSessionOrchestration({
    C,
    DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
    DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD,
    ROOT,
    TUTOR_STUB_FEEDBACK_REASONS,
    TUTOR_STUB_OPENING_REQUIREMENTS,
    TUTOR_STUB_TRANSCRIPT_HTML_SCHEMA,
    acknowledgeTutorStubOpeningRelease,
    appendTraceEvent,
    args,
    autoLearnerResolved,
    autoSafetyTurns,
    autoStopOnGrounded,
    autoTurns,
    buildMixedLearnerArtifactsPrompt,
    buildTutorOpening,
    buildTutorStubResumeHandoff,
    classifierEnabled,
    clearStatusLine,
    closeoutReportEnabled,
    combinedLearnerAnalysisEnabled,
    concurrentTerminal,
    continuousUnsafeRegisterAnchorsEnabled,
    createLearnerDagState,
    createScaffoldLifecycle,
    createTutorStubComprehensionState,
    createTutorStubReleasePacingState,
    createTutorStubTurnFeedbackState,
    dagFactDropoutRate,
    dialogueClosureConfig,
    directorContext,
    directorNotesIssuedSoFar,
    entrypointPath: fileURLToPath(import.meta.url),
    finalizeInteractive,
    getCliPresentation: () => cliPresentation,
    input,
    isAwaitingAnotherScenario: () => awaitingAnotherScenario,
    isExiting: () => exiting,
    isProcessingTurn: () => processingTurn,
    jsonClone,
    launchTutorStubTranscriptHtml,
    learnerRecordResolved,
    learningSummaryReportConfig,
    listTutorStubTuningCandidates,
    liveModelRoleDefinitions,
    liveModelRoleSnapshot,
    loadedSessionRecipePath,
    mixedLearner,
    mixedLearnerArtifactsSystemPrompt,
    mixedLearnerProfilePresentation,
    mixedLearnerPromptText,
    openingDebugId,
    openingEnabled,
    output,
    path,
    persistCurrentInteractiveSettings,
    pickInitialScenarioWithKeyboard,
    pickWorkplanModuleWithKeyboard,
    printCurriculumModules,
    printInteractiveTutorOpening,
    redactTraceSecrets,
    registerEmpiricalPrior,
    registerOverlayThreshold,
    registerPalette,
    registerPolicy,
    registerPolicyOverlays,
    registerSelectionEnabled,
    registerTemperature,
    releaseSpeed,
    rememberedSettings,
    resetMixedLearnerSuggestion,
    resolveInteractive,
    resolveWorldRef,
    resumedDialogue,
    rl,
    setAwaitingAnotherScenario: (value) => {
      awaitingAnotherScenario = value;
    },
    setExiting: (value) => {
      exiting = value;
    },
    setInitialSetupStage: (value) => {
      initialSetupStage = value;
    },
    setScenarioPickerActive: (value) => {
      scenarioPickerActive = value;
    },
    spawnSync,
    state,
    stateRunDebugId,
    stopInterimAnimation,
    summarizeTutorStubLearnerResponseProvenance,
    traceDir,
    traceDisplayPath,
    tutorLearnerDagEnabled,
    tutorStubCliPresentationSnapshot,
    tutorStubComprehensionSnapshot,
    tutorStubCurriculumBundle,
    tutorStubDagFactDropoutSnapshot,
    tutorStubDirectorGuidanceSnapshot,
    tutorStubExactRelaunchCommand,
    tutorStubPublicMessagesForSpeaker,
    tutorStubRegisterPolicyStackId,
    tutorStubReleasePacingSnapshot,
    tutorStubTuningPrompt,
    tutorStubTuningSnapshot,
    tutorStubTurnFeedbackEnvelope,
    tutorStubTurnFeedbackLabel,
    typedActionConfig,
    visibleAutoLearnerModel,
    visibleClassifierConfig,
    visibleLearnerRecordModel,
    visibleModel,
    voiceRuntimeSnapshot,
    worldBundle,
    writeTutorStubTranscriptHtml,
  });

  function performInteractiveFinalize(reason) {
    if (finalized) return;
    finalized = true;
    appendTraceEvent(state.trace, {
      type: 'tutor_tuning_session_closed',
      reason,
      tuning: tutorStubTuningSnapshot(state.tuning),
      candidates: listTutorStubTuningCandidates(state.tuning),
      publicTranscriptChanged: false,
    });
    appendTraceEvent(state.trace, {
      type: 'run_end',
      reason,
      turns: state.turns.length,
      mixedLearnerCache: { ...mixedLearner.cacheStats },
      learnerResponseProvenance: summarizeTutorStubLearnerResponseProvenance(state.turns),
      trainingReuse: jsonClone(state.trainingReuse),
    });
    appendTutorStubTurnFailureTraceRecords(state, { sealed: true });
    if (closeoutReportEnabled) {
      const report = printDialogueCloseout(state, { reason, trace: state.trace });
      appendTraceEvent(state.trace, { type: 'closeout_report', reason, report });
    }
    if (args.save) {
      saveTranscript(args.save, transcriptPayload());
    }
    try {
      writeFinalLearningSummary(reason);
    } catch (error) {
      console.log(`${C.red}learning summary error:${C.reset} ${error.message}\n`);
      appendTraceEvent(state.trace, { type: 'learning_summary_error', reason, error: error.message });
    }
  }

  function finalizeInteractive(reason) {
    return sessionRuntime.finalize(reason);
  }

  function requestExit(reason) {
    exiting = true;
    discardPendingInteractiveAuto(reason, { source: 'session_exit' });
    activeLearnerTurn?.abortController?.abort();
    if (activeAutoRun) activeAutoRun.cancelledReason = reason;
    activeAutoRun?.abortController?.abort();
    if (clarificationInFlight) clarificationInFlight.cancelledReason = reason;
    clarificationInFlight?.abortController?.abort();
    if (translationInFlight) translationInFlight.cancelledReason = reason;
    translationInFlight?.abortController?.abort();
    stopInterimAnimation(state);
    void stopVoiceBridge(reason);
    concurrentTerminal.close();
    resetMixedLearnerSuggestion(reason);
    finalizeInteractive(reason);
    rl.close();
    resolveInteractive();
  }

  function refreshCurriculumPrompt() {
    if (!curriculumBundle || !state.curriculum?.runtime) return;
    curriculumBundle.prompt = renderTutorStubCurriculumModule(curriculumBundle, curriculumBundle.module);
    state.systemPrompt = replaceDelimitedPrompt(
      state.systemPrompt,
      CURRICULUM_MODULE_PROMPT_START,
      curriculumBundle.prompt,
      CURRICULUM_MODULE_PROMPT_END,
    );
    state.systemPrompt = replaceDelimitedPrompt(
      state.systemPrompt,
      CURRICULUM_PHASE_PROMPT_START,
      tutorStubCurriculumPrivatePrompt(curriculumBundle, state.curriculum.runtime),
      CURRICULUM_PHASE_PROMPT_END,
    );
  }

  function curriculumProgressSnapshot() {
    return curriculumBundle && state.curriculum?.runtime
      ? tutorStubCurriculumPublicProjection(curriculumBundle, state.curriculum.runtime)
      : null;
  }

  function printCurriculumProgress() {
    const progress = curriculumProgressSnapshot();
    for (const line of projectTutorStubCurriculumProgressLines(progress, { colors: C })) console.log(line);
    return progress;
  }

  function activateCurriculumModule(moduleId, { allowDirectEntry = false, source = '/module' } = {}) {
    if (!curriculumBundle || !state.curriculum?.runtime) return { selected: false, reason: 'no_curriculum' };
    const module = selectTutorStubCurriculumModule(curriculumBundle, moduleId);
    const outcome = selectTutorStubCurriculumRuntimeModule(
      state.curriculum.runtime,
      curriculumBundle.curriculum,
      module.id,
      { allowDirectEntry },
    );
    if (!outcome.selected) return outcome;
    const previousModuleId = state.curriculum.module?.id || null;
    curriculumBundle.module = module;
    state.curriculum.module = module;
    state.topic = module.title;
    refreshCurriculumPrompt();
    appendTraceEvent(state.trace, {
      type: 'curriculum_module_activated',
      schema: 'machinespirits.tutor-stub.curriculum-progression.v1',
      source,
      previousModuleId,
      moduleId: module.id,
      phase: state.curriculum.runtime.currentPhase,
      directEntry: outcome.directEntry,
      publicTranscriptChanged: false,
      externalCompletionInferred: false,
    });
    return { ...outcome, module };
  }

  function handleCurriculumModuleCommand(argument = '', { duringTurn = false } = {}) {
    clearStatusLine();
    const requested = String(argument || '').trim();
    if (!requested) {
      printCurriculumProgress();
      console.log(`${C.dim}  choose an available module with /module <id>${C.reset}\n`);
      return true;
    }
    if (duringTurn || processingTurn) {
      console.log(
        `${C.dim}module change not started; run /module again after the current tutor response completes${C.reset}\n`,
      );
      return false;
    }
    try {
      const outcome = activateCurriculumModule(requested);
      if (!outcome.selected) {
        console.log(
          `${C.yellow}module locked:${C.reset} complete ${outcome.missing.join(', ')} in this session, or start that module directly in a fresh session\n`,
        );
        return false;
      }
      console.log(`${C.brightGreen}${C.bold}module >${C.reset} ${outcome.module.id} — ${outcome.module.title}`);
      console.log(
        `${C.dim}  ${state.curriculum.runtime.currentPhase.replaceAll('_', ' ')} phase · public history retained${C.reset}\n`,
      );
      return true;
    } catch (error) {
      console.log(`${C.red}module error:${C.reset} ${error.message}\n`);
      return false;
    }
  }

  function handleCurriculumNextCommand(argument = '', { duringTurn = false } = {}) {
    clearStatusLine();
    if (duringTurn || processingTurn) {
      console.log(`${C.dim}curriculum progression waits for the current tutor response to complete${C.reset}\n`);
      return false;
    }
    const decision =
      String(argument || '')
        .trim()
        .toLowerCase() || null;
    let outcome;
    try {
      outcome = advanceTutorStubCurriculumRuntime(state.curriculum.runtime, {
        decision,
        actor: 'human_operator',
      });
    } catch (error) {
      console.log(`${C.red}next error:${C.reset} ${error.message}; use /next, /next pass, or /next revise\n`);
      return false;
    }
    if (!outcome.advanced) {
      const message =
        outcome.reason === 'evidence_required'
          ? 'respond to the current course task before advancing'
          : 'record an explicit decision with /next pass or /next revise';
      console.log(`${C.yellow}next >${C.reset} ${message}\n`);
      return false;
    }
    appendTraceEvent(state.trace, {
      type: 'curriculum_phase_advanced',
      schema: 'machinespirits.tutor-stub.curriculum-progression.v1',
      moduleId: outcome.moduleId || state.curriculum.module.id,
      outcome: outcome.outcome,
      phase: outcome.phase,
      decision,
      decisionActor: decision ? 'human_operator' : null,
      publicTranscriptChanged: false,
      externalCompletionInferred: false,
    });
    if (outcome.outcome === 'module_mastered') {
      const progress = curriculumProgressSnapshot();
      const next = progress.modules.find(
        (module) => module.id !== outcome.moduleId && module.available && module.status !== 'mastered',
      );
      if (next) {
        const selected = activateCurriculumModule(next.id, { source: '/next' });
        console.log(`${C.brightGreen}${C.bold}module mastered >${C.reset} ${outcome.moduleId}`);
        console.log(`${C.cyan}next module >${C.reset} ${selected.module.id} — ${selected.module.title}\n`);
      } else {
        refreshCurriculumPrompt();
        console.log(
          `${C.brightGreen}${C.bold}course complete >${C.reset} all available modules have explicit transfer passes\n`,
        );
      }
      return true;
    }
    refreshCurriculumPrompt();
    console.log(
      `${C.brightGreen}${C.bold}next phase >${C.reset} ${state.curriculum.runtime.currentPhase.replaceAll('_', ' ')}`,
    );
    if (outcome.outcome === 'revision_requested') {
      console.log(
        `${C.dim}  the existing public evidence is retained; the tutor returns to a bounded scaffold${C.reset}`,
      );
    }
    console.log('');
    return true;
  }

  function offerAnotherScenario(reason = 'dialogue_grounded_closure') {
    if (awaitingAnotherScenario || exiting) return;
    pendingLearnerLines.length = 0;
    resetMixedLearnerSuggestion(reason);
    finalizeInteractive(reason);
    awaitingAnotherScenario = true;
    rl.setPrompt(`${C.brightCyan}${C.bold}another scenario? [y/N] >${C.reset} `);
    console.log(`${C.brightGreen}${C.bold}scenario complete >${C.reset} would you like to do another scenario?`);
    console.log(
      `${C.dim}  y opens the scenario picker · Enter or n ends the session · /report revisits this inquiry${C.reset}\n`,
    );
    promptIfIdle();
  }

  function interactionModeLabel() {
    return projectTutorStubInteractionModeLabel({
      mode: state.interaction?.mode || 'learner',
      mixedEnabled: mixedLearner.enabled,
      colors: C,
    });
  }

  function printInteractionModeBanner({ detail = true } = {}) {
    for (const line of projectTutorStubInteractionModeBannerLines({
      mode: state.interaction?.mode || 'learner',
      mixedEnabled: mixedLearner.enabled,
      detail,
      colors: C,
    }))
      console.log(line);
  }

  function setInteractionMode(mode, { announce = true } = {}) {
    const normalized = String(mode || '')
      .trim()
      .toLowerCase();
    if (!['learner', 'coach', 'auto'].includes(normalized)) {
      throw new Error('mode must be learner, coach, or auto');
    }
    const previous = state.interaction.mode;
    if (normalized !== 'auto') state.interaction.previousMode = normalized;
    state.interaction.mode = normalized;
    rl.setPrompt(mixedLearnerPromptText());
    appendTraceEvent(state.trace, {
      type: 'interactive_mode_changed',
      previous,
      mode: normalized,
      turn: state.turns.length + 1,
    });
    if (announce) printInteractionModeBanner();
  }

  function printInteractiveStatus() {
    if (state.passthrough?.enabled) {
      for (const line of projectTutorStubSessionStatusLines({
        status: {
          surface: 'passthrough',
          turn: state.turns.length + 1,
          model: { ref: state.modelRef, provider: state.resolved.provider, model: state.resolved.model },
          setup: state.world ? `${state.world.id} — ${state.world.title}` : state.topic,
          publicMessageCount: state.history.length,
          appearance: cliPresentation,
          voice: state.voice,
        },
        colors: C,
      }))
        console.log(line);
      return;
    }
    const dropout = tutorStubDagFactDropoutSnapshot(state.learnerDag?.dropout);
    const releasePacing = tutorStubReleasePacingSnapshot(state.releasePacing, state.world);
    const profile = mixedLearnerProfilePresentation(mixedLearner.suggestion);
    const policy = tutorStubRegisterPolicyStackId(state.register?.policy, state.register?.overlays);
    const directedRegister = explicitPerformanceDirectiveValue(state, 'register');
    const directedCharacter = explicitPerformanceDirectiveValue(state, 'character');
    const directorDirection = state.directorGuidance?.active || null;
    const randomPerformanceAxes = [!directedRegister ? 'style' : null, !directedCharacter ? 'character' : null].filter(
      Boolean,
    );
    const closure = state.dialogueClosure?.phase || 'open';
    const coachPending = state.coach?.pending?.length || 0;
    const suggestion = mixedLearner.enabled
      ? mixedLearner.suggestion?.text
        ? 'ready'
        : mixedLearner.pending
          ? 'warming'
          : 'idle'
      : 'off';
    const modelRouting = state.modelRouting?.allRolesOverrideRef
      ? { allRolesOverrideRef: state.modelRouting.allRolesOverrideRef }
      : {
          allRolesOverrideRef: null,
          classifierRef: liveModelRoleRef('classifier'),
          reasoningRef: liveModelRoleRef('reasoning'),
          learnerRef: liveModelRoleRef('learner'),
        };
    for (const line of projectTutorStubSessionStatusLines({
      status: {
        surface: 'normal',
        modeLabel: interactionModeLabel(),
        turn: state.turns.length + 1,
        learner: { id: profile.id, name: profile.name, suggestion },
        tutor: { ref: state.tuning?.activeRef || state.tutorInstance?.ref || 'unpartitioned' },
        model: { ref: state.modelRef, provider: state.resolved.provider, model: state.resolved.model },
        modelRouting,
        committee: state.committee,
        voice: state.voice,
        teaching: {
          approachLabel: plainPolicyLabel(state.register?.policy),
          policyId: policy,
          styleRange: state.register?.temperature,
          dropoutRate: dropout.rate,
          baseSpeed: releasePacing?.baseSpeed ?? 1,
          effectiveSpeed: releasePacing?.effectiveSpeed ?? 1,
        },
        randomPerformance: { enabled: state.randomPerformance?.enabled, axes: randomPerformanceAxes },
        lightAdaptation: state.lightAdaptation,
        directedPerformance: { register: directedRegister, character: directedCharacter },
        directorRequest: directorDirection
          ? {
              text: oneLine(directorDirection.text, { max: 120 }),
              effectiveFromTurn: directorDirection.effectiveFromTurn,
            }
          : null,
        conversation: {
          closureLabel: displayDiagnosticLabel(closure),
          coachPending,
          coachUsed: state.coach?.history?.length || 0,
        },
        autoHandoff: { pending: pendingAutoRequest, running: state.interaction?.autoRunning },
        turnFeedback: {
          enabled: state.turnFeedback?.enabled,
          label: state.turnFeedback?.enabled
            ? tutorStubTurnFeedbackLabel(tutorStubTurnFeedbackEnvelope(state.turnFeedback))
            : null,
        },
        responseDetails: state.responseDetails,
        tuning: {
          mode: state.tuning?.mode,
          stableVersion: state.tuning?.manifest?.stableVersion ?? state.tutorInstance?.sourceVersion ?? 1,
          canaryVersion: state.tuning?.manifest?.canaryVersion,
          sessionCandidateCount: state.tuning?.sessionCandidateIds?.length || 0,
        },
        appearance: cliPresentation,
        explanatoryDebug: state.explanatoryDebug,
      },
      colors: C,
    }))
      console.log(line);
  }

  function cliDirectorApplicationContext() {
    const commandMode = state.passthrough?.enabled ? 'passthrough' : 'normal';
    const commandOptions = { mode: commandMode, capabilities: state.capabilities };
    const availableCommandTokens = tutorStubCommandTokens(commandOptions);
    const canonicalCommands = [
      ...new Set(availableCommandTokens.map((token) => tutorStubCanonicalCommandToken(token)).filter(Boolean)),
    ];
    const definitions = getActorialPartDefinitions();
    const profile = mixedLearnerProfilePresentation();
    return {
      authority: {
        scope: 'application_interface_only',
        mutatesSession: false,
        publicTranscriptChanged: false,
        excludedContext: ['concealed answer', 'hidden proof state', 'future clues', 'private tutor prompt'],
      },
      currentSession: {
        sessionMode: state.passthrough?.enabled ? 'passthrough' : mixedLearner.enabled ? 'mixed' : 'human',
        interactionRole: state.interaction?.mode || 'learner',
        completedTutorTurns: state.turns.length,
        scenario: state.world ? { id: state.world.id, title: state.world.title } : null,
        curriculum: state.curriculum
          ? { id: state.curriculum.id, title: state.curriculum.title, moduleId: state.curriculum.module?.id || null }
          : null,
        learnerProfile: mixedLearner.enabled
          ? { id: profile.id, name: profile.name, behavior: profile.pattern }
          : { id: null, name: 'Human learner', behavior: 'The operator supplies public learner turns directly.' },
        tutorCharacter: explicitPerformanceDirectiveValue(state, 'character') || 'auto',
        tutorStyle: explicitPerformanceDirectiveValue(state, 'register') || 'auto',
        tutorModel: state.modelRef,
        learnerInterpretationModel: liveModelRoleRef('classifier'),
        learnerReasoningModel: liveModelRoleRef('reasoning'),
        learnerVoiceModel: liveModelRoleRef('learner'),
        directorRequest: state.directorGuidance?.active?.text || null,
      },
      launchRecipes: [
        {
          command: 'npm run tutor:stub',
          behavior: 'open the mode picker; mixed tutor chat is the default selection',
        },
        {
          command: 'npm run tutor:stub:scaffold:mixed',
          behavior: 'launch mixed drafting with the human-facing DAG scaffold directly',
        },
        {
          command: 'npm run tutor:stub:direct:mixed',
          behavior: 'launch mixed drafting without the DAG scaffold',
        },
      ],
      commands: canonicalCommands.map((token) => ({
        token,
        aliases: availableCommandTokens.filter(
          (candidate) => candidate !== token && tutorStubCanonicalCommandToken(candidate) === token,
        ),
        summary: tutorStubCommandSummary(token),
        examples: tutorStubStaticCommandCompletions(token, commandOptions),
      })),
      tutorCharacters: tutorStubConfigurableActorialPartIds().map((id) => ({
        id,
        label: definitions[id]?.label || displayDiagnosticLabel(id),
        behavior: oneLine(definitions[id]?.contract, { max: 220 }),
        selectable: true,
      })),
      learnerProfiles: learnerProfileIds().map((id) => ({
        id,
        description: learnerProfileDescription(id),
        selectableInCurrentSession: mixedLearner.enabled,
      })),
      returnToScene: {
        automaticAfterAnswer: true,
        behavior: 'the latest tutor utterance is reprised, then the prior learner or coach prompt is restored',
      },
    };
  }

  async function answerCliDirectorQuestion(questionInput, { duringTurn = false, source = '/director ask' } = {}) {
    clearStatusLine();
    let question;
    try {
      question = normalizeTutorStubCliDirectorQuestion(questionInput);
    } catch (error) {
      console.log(`${C.red}director question error:${C.reset} ${error.message}`);
      console.log(`${C.dim}  use /director ask <question> or /meta ask <question>${C.reset}\n`);
      return { answered: false, error: error.message };
    }

    const context = cliDirectorApplicationContext();
    const resolved = state.learnerDag?.resolved || state.classifier?.resolved || state.resolved;
    const existingInterim = Boolean(getInterimState(state)?.active);
    if (!existingInterim) startInterimAnimation(state, 'asking director', { tutorTurn: state.turns.length });
    appendTraceEvent(state.trace, {
      type: 'cli_director_question_started',
      source,
      question,
      duringTurn,
      context,
      publicTranscriptChanged: false,
    });

    let response = null;
    let reply = '';
    try {
      response = await callPromptModel({
        prompt: buildTutorStubCliDirectorPrompt({ question, context }),
        resolved,
        systemPrompt: TUTOR_STUB_CLI_DIRECTOR_SYSTEM_PROMPT,
        role: 'tutor_stub_cli_director_help',
        maxTokens: Math.min(Number(state.maxTokens) || 700, 700),
        trace: state.trace,
        stream: { enabled: false, interim: state.interim },
        cliEffort: state.cliEffort,
        turn: state.turns.length,
      });
      reply = cleanTutorStubCliDirectorReply(response.text);
      if (!reply) throw new Error('the director returned an empty answer');
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      appendTraceEvent(state.trace, {
        type: 'cli_director_question_failed',
        source,
        question,
        duringTurn,
        error: error.message,
        publicTranscriptChanged: false,
      });
      printWithConcurrentTerminal(state, () => {
        console.log(`${C.red}director question failed:${C.reset} ${error.message}`);
        console.log(`${C.dim}  use /help for the current command surface; the tutor dialogue is unchanged${C.reset}\n`);
      });
      return { answered: false, error: error.message };
    } finally {
      if (!existingInterim) stopInterimAnimation(state);
    }

    printWithConcurrentTerminal(state, () => {
      console.log(`${C.brightCyan}${C.bold}director >${C.reset} ${reply}`);
      console.log(
        `${C.dim}  private app help · no setting changed · returning to the ${state.interaction?.mode === 'coach' ? 'coach' : 'tutor'} interaction${C.reset}\n`,
      );
    });
    appendTraceEvent(state.trace, {
      type: 'cli_director_answer',
      source,
      question,
      answer: reply,
      duringTurn,
      provider: response.provider,
      model: response.model,
      latencyMs: response.latencyMs,
      usage: response.usage || null,
      context,
      publicTranscriptChanged: false,
    });
    return { answered: true, question, answer: reply };
  }

  function printProofDagArtifactPaths() {
    const projection = projectTutorStubProofDagArtifactPaths({ colors: C });
    for (const line of projection.lines) console.log(line);
    return projection.rows;
  }

  function runProofDagLeanCheck() {
    const result = spawnSync(process.execPath, ['scripts/check-proof-dag-lean.js', '--require-lake'], {
      cwd: ROOT,
      encoding: 'utf8',
      env: process.env,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      const detail = [result.stdout, result.stderr]
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .join('\n');
      throw new Error(`Lean certificate check failed${detail ? `:\n${detail}` : ''}`);
    }
    const theoremCount = /World\s+\S+:\s+(\d+) authored proof-path theorem/u.exec(result.stdout)?.[1] || 'all';
    return {
      ok: true,
      theoremCount,
      command: 'npm run derivation:lean-cert:check',
    };
  }

  function printProofDagSemanticLayer(result, layer) {
    for (const line of projectTutorStubProofDagSemanticLayerLines({ result, layer, colors: C })) console.log(line);
  }

  async function handleProofDagCommand(argument = '', { duringTurn = false } = {}) {
    clearStatusLine();
    const parts = String(argument || '')
      .trim()
      .toLowerCase()
      .split(/\s+/u)
      .filter(Boolean);
    const action = parts[0] || 'check';
    const target = parts[1] || 'all';
    const usage = '/proof [check [lean|semantic] | inspect [authored|learner|tutor] | export | paths]';
    const validCheckTargets = new Set(['all', 'lean', 'semantic']);
    const validInspectTargets = new Set(['all', 'authored', 'learner', 'tutor']);

    if (action === 'help') {
      console.log(`${C.brightCyan}${C.bold}proof DAG >${C.reset} ${usage}`);
      console.log(
        `${C.dim}  /proof runs both checks; inspect reads the deterministic fixture; /analysis technical inspects this session's live DAG state${C.reset}\n`,
      );
      return { handled: true, ok: true, action };
    }
    if (action === 'paths') {
      const paths = printProofDagArtifactPaths();
      appendTraceEvent(state.trace, {
        type: 'proof_dag_verification_popup',
        action,
        target: 'all',
        paths: paths.map(([, file]) => file),
        duringTurn,
        publicTranscriptChanged: false,
      });
      return { handled: true, ok: true, action };
    }
    if (
      !['check', 'inspect', 'export'].includes(action) ||
      (action === 'check' && !validCheckTargets.has(target)) ||
      (action === 'inspect' && !validInspectTargets.has(target)) ||
      (action === 'export' && parts.length > 1)
    ) {
      console.log(`${C.red}proof error:${C.reset} use ${usage}\n`);
      return { handled: true, ok: false, action, reason: 'invalid_arguments' };
    }

    console.log(`${C.brightCyan}${C.bold}proof DAG >${C.reset} ${action} · deterministic Nocturne fixture`);
    if (state.world?.id && state.world.id !== 'world_001_nocturne') {
      console.log(
        `${C.dim}  current session is ${state.world.id}; these formal artifacts remain the fixed Nocturne fixture. Use /analysis technical for the live session.${C.reset}`,
      );
    }

    const outcome = {
      handled: true,
      ok: true,
      action,
      target,
      worldId: 'world_001_nocturne',
      lean: null,
      semantic: null,
    };
    try {
      if (action === 'check' && target !== 'semantic') {
        outcome.lean = runProofDagLeanCheck();
        console.log(
          `${C.green}  Lean: PASS${C.reset}${C.dim} · ${outcome.lean.theoremCount} authored proof-path theorems type-check${C.reset}`,
        );
      }

      if (action !== 'check' || target !== 'lean') {
        const { runProofDagSemanticWebExport } = await import('./export-proof-dag-semantic-web.js');
        const result = await runProofDagSemanticWebExport({
          world: 'config/drama-derivation/world-001-nocturne.yaml',
          outDir: 'tools/proof-dag-semantic-web/Generated/World001Nocturne',
          check: action !== 'export',
        });
        outcome.semantic = {
          conforms: result.validation.conforms,
          stale: result.stale,
          graphs: result.validation.graphs,
        };

        if (action === 'export') {
          console.log(
            `${C.green}  semantic export: PASS${C.reset}${C.dim} · ${result.stale.length ? `refreshed ${result.stale.join(', ')}` : 'artifacts already current'}${C.reset}`,
          );
        } else {
          console.log(
            `${C.green}  semantic web: PASS${C.reset}${C.dim} · source redaction audit, SHACL, and stale-artifact check passed${C.reset}`,
          );
        }

        const layers = action === 'inspect' ? (target === 'all' ? ['authored', 'learner', 'tutor'] : [target]) : [];
        for (const layer of layers) printProofDagSemanticLayer(result, layer);
        if (action !== 'inspect') {
          for (const [layer, graph] of Object.entries(result.validation.graphs)) {
            console.log(
              `${C.dim}    ${layer}: ${graph.quadCount} quads · SHACL ${graph.conforms ? 'conforms' : 'fails'}${C.reset}`,
            );
          }
        }
      }

      console.log(
        `${C.dim}  This does not replace or prove the live JS entitlement gate. /proof inspect learner shows the fixture; /analysis technical shows this session.${C.reset}\n`,
      );
    } catch (error) {
      outcome.ok = false;
      outcome.error = error.message;
      console.log(`${C.red}  FAIL:${C.reset} ${error.message}\n`);
    }

    appendTraceEvent(state.trace, {
      type: 'proof_dag_verification_popup',
      action,
      target,
      fixtureWorldId: outcome.worldId,
      currentWorldId: state.world?.id || null,
      ok: outcome.ok,
      lean: outcome.lean,
      semantic: outcome.semantic,
      error: outcome.error || null,
      duringTurn,
      publicTranscriptChanged: false,
    });
    return outcome;
  }

  function handleDirectorGuidanceCommand(argument = '', { duringTurn = false, source = '/meta' } = {}) {
    const request = String(argument || '').trim();
    const action = request.toLowerCase();
    clearStatusLine();
    if (state.passthrough?.enabled) {
      console.log(
        `${C.red}director request unavailable:${C.reset} passthrough has no private tutor-control layer; use ordinary chat or relaunch a normal tutor session\n`,
      );
      appendTraceEvent(state.trace, {
        type: 'director_guidance_rejected',
        source,
        request: request || null,
        reason: 'passthrough_has_no_private_tutor_control_layer',
        duringTurn,
        publicTranscriptChanged: false,
      });
      return { changed: false, reason: 'passthrough' };
    }

    if (!request || action === 'status') {
      const active = state.directorGuidance?.active || null;
      console.log(`${C.brightCyan}${C.bold}director request >${C.reset} ${active ? active.text : 'none'}`);
      console.log(
        `${C.dim}  ${
          active
            ? `private tutor-change guidance from turn ${active.effectiveFromTurn}; remains active until /meta clear`
            : 'use /meta <request> to change tutor delivery, or /director ask <question> for private app help'
        }${C.reset}\n`,
      );
      return { changed: false, active };
    }

    const effectiveFromTurn = state.turns.length + (duringTurn || processingTurn ? 2 : 1);
    if (['clear', 'off', 'reset'].includes(action)) {
      const previous = state.directorGuidance?.active || null;
      if (!previous) {
        console.log(`${C.brightCyan}${C.bold}director request >${C.reset} none active`);
        console.log(`${C.dim}  use /meta <request> to direct a change to later tutor replies${C.reset}\n`);
        return { changed: false, active: null };
      }
      clearTutorStubDirectorGuidance(state.directorGuidance, {
        source: `${source} ${action}`,
        effectiveFromTurn,
      });
      if (!duringTurn && !processingTurn) resetMixedLearnerSuggestion('director_guidance_cleared');
      appendTraceEvent(state.trace, {
        type: 'director_guidance_cleared',
        source,
        previous,
        directorGuidance: tutorStubDirectorGuidanceSnapshot(state.directorGuidance),
        effectiveFromTurn,
        duringTurn: Boolean(duringTurn || processingTurn),
        publicTranscriptChanged: false,
      });
      console.log(`${C.brightCyan}${C.bold}director request >${C.reset} cleared`);
      console.log(
        `${C.dim}  private tutor-change guidance stops from tutor turn ${effectiveFromTurn}; public dialogue and proof state are unchanged${C.reset}\n`,
      );
      if (mixedLearner.enabled && !duringTurn && !processingTurn && latestTutorMessage(state)) {
        startMixedLearnerPrefetch('director_guidance_cleared');
      }
      return { changed: true, active: null, previous };
    }

    let entry;
    try {
      entry = setTutorStubDirectorGuidance(state.directorGuidance, request, {
        source,
        effectiveFromTurn,
      });
    } catch (error) {
      console.log(`${C.red}director request error:${C.reset} ${error.message}\n`);
      return { changed: false, error: error.message };
    }
    if (!duringTurn && !processingTurn) resetMixedLearnerSuggestion('director_guidance_changed');
    appendTraceEvent(state.trace, {
      type: 'director_guidance_set',
      guidance: entry,
      directorGuidance: tutorStubDirectorGuidanceSnapshot(state.directorGuidance),
      duringTurn: Boolean(duringTurn || processingTurn),
      publicTranscriptChanged: false,
    });
    console.log(`${C.brightCyan}${C.bold}director request >${C.reset} ${entry.text}`);
    console.log(
      `${C.dim}  private control, not learner speech · applies from tutor turn ${entry.effectiveFromTurn} until /meta clear${C.reset}`,
    );
    console.log(
      `${C.dim}  changes delivery only; public evidence, proof state, release timing, closure, and safety remain authoritative${C.reset}`,
    );
    if (mixedLearner.enabled && !duringTurn && !processingTurn && latestTutorMessage(state)) {
      startMixedLearnerPrefetch('director_guidance_changed');
      console.log(`${C.dim}  rebuilding the next tutor response with this direction${C.reset}`);
    }
    console.log();
    return { changed: true, active: entry };
  }

  function queueCoachGuidance(text, { duringTurn = false } = {}) {
    const guidance = String(text || '').trim();
    if (!guidance) {
      setInteractionMode('coach');
      return null;
    }
    const notBeforeTurn = state.turns.length + (duringTurn || processingTurn ? 2 : 1);
    const entry = {
      id: `coach-${String((state.coach?.pending?.length || 0) + (state.coach?.history?.length || 0) + 1).padStart(3, '0')}`,
      text: guidance,
      createdAt: new Date().toISOString(),
      notBeforeTurn,
    };
    state.coach.pending.push(entry);
    if (!duringTurn && !processingTurn) {
      resetMixedLearnerSuggestion('coach_guidance_added');
    }
    appendTraceEvent(state.trace, {
      type: 'coach_guidance_queued',
      guidance: entry,
      duringTurn: Boolean(duringTurn || processingTurn),
      publicTranscriptChanged: false,
    });
    clearStatusLine();
    console.log(`${C.brightYellow}${C.bold}coach queued >${C.reset} ${guidance}`);
    console.log(
      `${C.dim}  private; applies to tutor turn ${notBeforeTurn}${duringTurn || processingTurn ? ' after the response already in flight' : ''}${C.reset}`,
    );
    if (mixedLearner.enabled && !duringTurn && !processingTurn && latestTutorMessage(state)) {
      startMixedLearnerPrefetch('coach_guidance_added');
      console.log(`${C.dim}  rebuilding the learner suggestion and next tutor response with this guidance${C.reset}`);
    }
    console.log();
    return entry;
  }

  function parseInteractiveAutoTurns(value) {
    const raw = String(value || '')
      .trim()
      .toLowerCase();
    if (!raw || ['until-grounded', 'grounded', 'all'].includes(raw)) return null;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isInteger(parsed) || parsed <= 0 || String(parsed) !== raw) {
      throw new Error('auto expects a positive turn count or until-grounded');
    }
    return parsed;
  }

  function parseInteractiveDemoTurns(value) {
    const raw = String(value || '').trim();
    if (!raw) return DEFAULT_INTERACTIVE_DEMO_TURNS;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isInteger(parsed) || parsed <= 0 || String(parsed) !== raw) {
      throw new Error(`demo expects a whole-number turn count from 1 to ${MAX_INTERACTIVE_DEMO_TURNS}`);
    }
    if (parsed > MAX_INTERACTIVE_DEMO_TURNS) {
      throw new Error(`demo is capped at ${MAX_INTERACTIVE_DEMO_TURNS} turns; use /auto for a longer run`);
    }
    return parsed;
  }

  async function runInteractiveDemo(argument = '', { duringTurn = false, source = 'slash' } = {}) {
    clearStatusLine();
    if (state.passthrough?.enabled) {
      console.log(
        `${C.dim}the guided harness demonstration is unavailable in passthrough mode because the harness is intentionally bypassed${C.reset}\n`,
      );
      return { started: false, reason: 'passthrough' };
    }
    if (duringTurn || processingTurn || interactiveDemoRunning) {
      console.log(
        `${C.dim}demonstration not started; run /demo again after the current tutor response completes${C.reset}\n`,
      );
      return { started: false, reason: 'busy' };
    }
    if (!latestTutorMessage(state)) {
      console.log(`${C.dim}the demonstration needs a visible tutor opening; use /reset, then /demo${C.reset}\n`);
      return { started: false, reason: 'no_tutor_message' };
    }

    let requestedTurns;
    try {
      requestedTurns = parseInteractiveDemoTurns(argument);
    } catch (error) {
      console.log(`${C.red}demo error:${C.reset} ${error.message}\n`);
      return { started: false, reason: 'invalid_turn_count' };
    }

    const startingTurns = state.turns.length;
    const policy = tutorStubRegisterPolicyStackId(state.register?.policy, state.register?.overlays);
    const enabledMechanisms = [
      state.classifier?.enabled ? 'learner interpretation' : null,
      state.learnerDag?.enabled ? 'reasoning-map tracking' : null,
      state.register?.enabled ? 'adaptive teaching style and character' : null,
      state.dag ? 'authored evidence DAG' : null,
      'response checks',
      'trace and report evidence',
    ].filter(Boolean);
    const disabledCoreMechanisms = [
      !state.classifier?.enabled ? 'learner interpretation' : null,
      !state.learnerDag?.enabled ? 'reasoning-map tracking' : null,
      !state.register?.enabled ? 'adaptive teaching style' : null,
      !state.dag ? 'authored evidence DAG' : null,
    ].filter(Boolean);

    interactiveDemoRunning = true;
    appendTraceEvent(state.trace, {
      type: 'interactive_harness_demo_started',
      schema: 'machinespirits.tutor-stub.interactive-harness-demo.v1',
      source,
      requestedTurns,
      startingTurns,
      worldId: state.world?.id || null,
      learnerProfileId: mixedLearner.profileId || state.learnerProfileId || null,
      tutorRef: state.tuning?.activeRef || null,
      policy,
      enabledMechanisms,
      publicTranscriptChanged: false,
    });

    console.log(
      `${C.brightCyan}${C.bold}╭─ guided harness demonstration${C.reset} ${C.dim}· ${requestedTurns} live turn${requestedTurns === 1 ? '' : 's'}${C.reset}`,
    );
    console.log(`${C.cyan}│  1 · dialogue${C.reset}       the automated learner and tutor continue the public scene`);
    console.log(
      `${C.cyan}│  2 · interpretation${C.reset} the harness reads progress and chooses the next teaching action`,
    );
    console.log(
      `${C.cyan}│  3 · evidence${C.reset}       the transcript, prompts, settings, analysis, and replay are preserved`,
    );
    console.log(
      `${C.cyan}╰─ configuration${C.reset}   ${state.world?.title || state.topic} · ${state.tuning?.activeRef || state.tutorInstance?.id || 'tutor'} · ${mixedLearner.profileId || state.learnerProfileId || 'learner'} · ${policy}`,
    );
    console.log(`${C.dim}  active: ${enabledMechanisms.join(' · ')}${C.reset}`);
    if (disabledCoreMechanisms.length) {
      console.log(
        `${C.yellow}  limited tour:${C.reset} ${disabledCoreMechanisms.join(', ')} ${disabledCoreMechanisms.length === 1 ? 'is' : 'are'} off in this session`,
      );
    }
    console.log(`${C.dim}  commands remain live while the models work; /reset cancels safely${C.reset}\n`);

    let transcript = null;
    let report = null;
    let demoError = null;
    try {
      const autoOutcome = await runInteractiveAutoMode(String(requestedTurns), { duringTurn: false });
      if (autoOutcome?.reason === 'cancelled') {
        appendTraceEvent(state.trace, {
          type: 'interactive_harness_demo_cancelled',
          schema: 'machinespirits.tutor-stub.interactive-harness-demo.v1',
          source,
          requestedTurns,
          startingTurns,
          endingTurns: state.turns.length,
          reason: autoOutcome.cancelledReason || 'cancelled',
          publicTranscriptChanged: false,
        });
        console.log(
          `${C.yellow}${C.bold}demonstration cancelled >${C.reset} ${autoOutcome.cancelledReason || 'control returned'}\n`,
        );
        return { started: true, reason: 'cancelled' };
      }
      if (autoOutcome?.reason === 'error') throw new Error(autoOutcome.error || 'automated demonstration failed');
      if (autoOutcome?.started === false) throw new Error('automated demonstration could not start');
      const completedTurns = Math.max(0, state.turns.length - startingTurns);

      console.log(`${C.brightCyan}${C.bold}demo readout · learner interpretation${C.reset}`);
      if (state.turns.length) printCurrentTurnAnalysis(state, { technical: false });
      else console.log(`${C.dim}  no tutor turn completed, so there is no learner interpretation to show${C.reset}\n`);

      console.log(`${C.brightCyan}${C.bold}demo readout · inspectable evidence${C.reset}`);
      transcript = writeCurrentTranscriptHtml({ launch: true, duringTurn: false });
      report = printDialogueCloseout(state, { reason: 'interactive_demo', trace: state.trace });

      appendTraceEvent(state.trace, {
        type: 'interactive_harness_demo_completed',
        schema: 'machinespirits.tutor-stub.interactive-harness-demo.v1',
        source,
        requestedTurns,
        startingTurns,
        completedTurns,
        endingTurns: state.turns.length,
        transcript: transcript?.filePath ? path.relative(ROOT, transcript.filePath) : null,
        transcriptLaunched: Boolean(transcript?.launched),
        reportAvailable: Boolean(report),
        closurePhase: state.dialogueClosure?.phase || null,
        publicTranscriptChanged: false,
      });

      console.log(
        `${C.brightGreen}${C.bold}demonstration complete >${C.reset} ${completedTurns} new turn${completedTurns === 1 ? '' : 's'} · control returned`,
      );
      console.log(
        `${C.dim}  ${
          state.dialogueClosure?.phase === 'closed'
            ? 'the inquiry reached closure; choose another scenario or finish the session'
            : 'continue as the learner, use ←/→ to rate the latest tutor response, inspect /analysis technical, or run /demo again'
        }${C.reset}\n`,
      );
      return { started: true, completedTurns, transcript, report };
    } catch (error) {
      demoError = error;
      appendTraceEvent(state.trace, {
        type: 'interactive_harness_demo_failed',
        schema: 'machinespirits.tutor-stub.interactive-harness-demo.v1',
        source,
        requestedTurns,
        startingTurns,
        endingTurns: state.turns.length,
        error: error.message,
        publicTranscriptChanged: false,
      });
      console.log(`${C.red}demo error:${C.reset} ${error.message}\n`);
      return { started: true, reason: 'failed', error: error.message };
    } finally {
      interactiveDemoRunning = false;
      if (demoError && state.interaction?.mode === 'auto') {
        setInteractionMode(state.interaction.previousMode === 'coach' ? 'coach' : 'learner', { announce: false });
      }
    }
  }

  function interactiveAutoTurnLabel(requestedTurns) {
    return requestedTurns === null
      ? `until grounded · safety cap ${autoSafetyTurns}`
      : `${requestedTurns} turn${requestedTurns === 1 ? '' : 's'}`;
  }

  function discardPendingInteractiveAuto(reason, { source = null, announce = false } = {}) {
    const pending = pendingAutoRequest;
    if (!pending) return null;
    pendingAutoRequest = null;
    appendTraceEvent(state.trace, {
      type: 'interactive_auto_queue_discarded',
      requestId: pending.id,
      reason,
      source: source || pending.source,
      afterTurn: pending.afterTurn,
      requestedTurns: pending.requestedTurns,
      publicTranscriptChanged: false,
    });
    if (announce) {
      console.log(
        `${C.dim}queued auto handoff cancelled · ${String(reason || 'cancelled').replaceAll('_', ' ')}${C.reset}\n`,
      );
    }
    return pending;
  }

  function queuePendingInteractiveAuto({ argument = '', requestedTurns = null, source = '/auto' } = {}) {
    const previous = pendingAutoRequest;
    const queuedLearnerLinesDiscarded = pendingLearnerLines.length;
    pendingLearnerLines.length = 0;
    const pending = {
      id: `${stateRunDebugId(state)}:auto-queue:${++pendingAutoRequestSequence}`,
      argument: String(argument || '').trim(),
      requestedTurns,
      source,
      afterTurn: activeLearnerTurn?.turn || state.turns.length + 1,
      queuedAt: new Date().toISOString(),
    };
    pendingAutoRequest = pending;
    appendTraceEvent(state.trace, {
      type: 'interactive_auto_queued',
      requestId: pending.id,
      source,
      afterTurn: pending.afterTurn,
      requestedTurns,
      safetyTurns: autoSafetyTurns,
      replacedRequestId: previous?.id || null,
      queuedLearnerLinesDiscarded,
      publicTranscriptChanged: false,
    });
    console.log(
      `${C.brightBlue}${C.bold}auto queued >${C.reset} starts after tutor turn ${pending.afterTurn} · ${interactiveAutoTurnLabel(
        requestedTurns,
      )}`,
    );
    if (previous) console.log(`${C.dim}  replaced the earlier queued auto request${C.reset}`);
    if (queuedLearnerLinesDiscarded) {
      console.log(
        `${C.dim}  discarded ${queuedLearnerLinesDiscarded} queued manual learner turn${queuedLearnerLinesDiscarded === 1 ? '' : 's'} because auto now owns the handoff${C.reset}`,
      );
    }
    console.log(`${C.dim}  /mode learner, /mode coach, /reset, or /quit cancels this handoff${C.reset}\n`);
    return { started: false, queued: true, reason: 'queued', requestId: pending.id };
  }

  function startPendingInteractiveAuto({ afterTurn, reason = 'tutor_response_completed' } = {}) {
    const pending = pendingAutoRequest;
    if (!pending) return false;
    pendingAutoRequest = null;
    appendTraceEvent(state.trace, {
      type: 'interactive_auto_queue_started',
      requestId: pending.id,
      source: pending.source,
      afterTurn: afterTurn || pending.afterTurn,
      requestedTurns: pending.requestedTurns,
      reason,
      publicTranscriptChanged: false,
    });
    void runInteractiveAutoMode(pending.argument, {
      duringTurn: false,
      source: pending.source,
      queuedRequestId: pending.id,
    });
    return true;
  }

  async function runInteractiveAutoMode(
    argument = '',
    { duringTurn = false, source = '/auto', queuedRequestId = null } = {},
  ) {
    clearStatusLine();
    let requestedTurns;
    try {
      requestedTurns = parseInteractiveAutoTurns(argument);
    } catch (error) {
      console.log(`${C.red}auto mode error:${C.reset} ${error.message}\n`);
      return { started: false, reason: 'invalid_turn_count', error: error.message };
    }
    const activeAutoLearnerResolved = state.autoLearner?.resolved || autoLearnerResolved;
    const activeAutoLearnerProviderConfig = state.autoLearner?.providerConfig || autoLearnerProviderConfig;
    if (!activeAutoLearnerResolved?.isConfigured && !isCliProvider(activeAutoLearnerResolved?.provider)) {
      const envName = activeAutoLearnerProviderConfig?.api_key_env || 'provider API key';
      console.log(
        `${C.red}auto mode error:${C.reset} ${args['auto-learner-model']} is not configured; set ${envName}\n`,
      );
      return { started: false, reason: 'model_not_configured' };
    }
    if (activeAutoRun) {
      console.log(`${C.dim}automation is already running; wait for learner mode to resume or use /reset${C.reset}\n`);
      return { started: false, reason: 'already_running' };
    }
    if (duringTurn || processingTurn) {
      if (activeLearnerTurn) return queuePendingInteractiveAuto({ argument, requestedTurns, source });
      console.log(`${C.dim}auto mode did not start; run /auto again after the current work completes${C.reset}\n`);
      return { started: false, reason: 'busy' };
    }
    resetMixedLearnerSuggestion('interactive_auto_started');
    const pendingFeedback = tutorStubTurnFeedbackEnvelope(state.turnFeedback);
    clearTutorStubTurnFeedbackTarget(state.turnFeedback);
    if (pendingFeedback.requested) {
      appendTraceEvent(state.trace, {
        type: 'tutor_turn_feedback_cancelled',
        reason: 'automated_learner_handoff',
        feedback: pendingFeedback,
        publicTranscriptChanged: false,
      });
    }
    setInteractionMode('auto', { announce: false });
    state.interaction.autoRunning = true;
    processingTurn = true;
    const active = {
      id: `${stateRunDebugId(state)}:auto:${Date.now()}`,
      abortController: new AbortController(),
      cancelledReason: null,
    };
    activeAutoRun = active;
    const isCurrent = () => !exiting && activeAutoRun === active && !active.abortController.signal.aborted;
    const capLabel = interactiveAutoTurnLabel(requestedTurns);
    console.log(
      `${C.dim}╭─${C.reset} ${interactionModeLabel()} ${C.dim}mode · ${capLabel} · profile ${mixedLearner.profileId || 'custom'}${C.reset}`,
    );
    console.log(`${C.dim}╰─ tutor and learner now continue from the public transcript${C.reset}\n`);
    appendTraceEvent(state.trace, {
      type: 'interactive_auto_handoff',
      turn: state.turns.length + 1,
      maxTurns: requestedTurns,
      safetyTurns: autoSafetyTurns,
      profileId: mixedLearner.profileId,
      source,
      queuedRequestId,
    });
    try {
      const result = await runAutomatedLearnerDialogue({
        state,
        firstMessage: '',
        openingEnabled,
        autoLearnerResolved: activeAutoLearnerResolved,
        autoLearnerProfile: mixedLearner.profile,
        autoTurns: requestedTurns,
        autoSafetyTurns,
        autoStopOnGrounded,
        cliEffort,
        signal: active.abortController.signal,
        isCurrent,
      });
      assertTutorStubTurnAttemptCurrent({ signal: active.abortController.signal, isCurrent });
      if (result.reason === 'auto_grounded_closure' || state.dialogueClosure?.phase === 'closed') {
        printWithConcurrentTerminal(state, () =>
          console.log(`${C.brightGreen}${C.bold}automation complete >${C.reset} grounded closure reached\n`),
        );
        offerAnotherScenario('interactive_auto_grounded_closure');
        return { started: true, reason: result.reason, result };
      }
      const returnMode = state.interaction.previousMode === 'coach' ? 'coach' : 'learner';
      setInteractionMode(returnMode, { announce: false });
      printWithConcurrentTerminal(state, () => {
        console.log(`${C.brightBlue}${C.bold}automation paused >${C.reset} ${result.reason.replaceAll('_', ' ')}`);
        console.log(
          `${C.dim}  ${state.turns.length} total completed turn${state.turns.length === 1 ? '' : 's'}; use /auto to continue${C.reset}\n`,
        );
      });
      return { started: true, reason: result.reason, result };
    } catch (error) {
      if (error?.name === 'AbortError' && active.cancelledReason) {
        appendTraceEvent(state.trace, {
          type: 'interactive_auto_discarded',
          autoRunId: active.id,
          reason: active.cancelledReason,
        });
        return { started: true, reason: 'cancelled', cancelledReason: active.cancelledReason };
      }
      setInteractionMode(state.interaction.previousMode === 'coach' ? 'coach' : 'learner', { announce: false });
      printWithConcurrentTerminal(state, () => console.log(`${C.red}auto mode error:${C.reset} ${error.message}\n`));
      appendTraceEvent(state.trace, { type: 'interactive_auto_error', error: error.message });
      return { started: true, reason: 'error', error: error.message };
    } finally {
      if (activeAutoRun === active) {
        activeAutoRun = null;
        state.interaction.autoRunning = false;
        processingTurn = false;
        if (!exiting) {
          rl.setPrompt(
            awaitingAnotherScenario
              ? `${C.brightCyan}${C.bold}another scenario? [y/N] >${C.reset} `
              : mixedLearnerPromptText(),
          );
        }
      }
    }
  }

  function promptIfIdle() {
    if (!exiting) concurrentTerminal.show();
  }

  async function runClarificationCommand(term = '', { duringTurn = false } = {}) {
    clearStatusLine();
    const latestTutor = latestTutorMessage(state);
    if (!latestTutor) {
      console.log(`${C.cyan}clarify >${C.reset} no tutor message is available yet`);
      console.log(
        `${C.dim}  start the dialogue first, then use /clarify [phrase] after tutor wording that needs explanation${C.reset}\n`,
      );
      appendTraceEvent(state.trace, {
        type: 'clarification_unavailable',
        reason: 'no_tutor_message',
        duringTurn,
      });
      return;
    }
    if (clarificationInFlight) {
      console.log(`${C.dim}clarification is already running; wait for it to finish, then try again${C.reset}\n`);
      appendTraceEvent(state.trace, {
        type: 'clarification_skipped',
        reason: 'already_in_flight',
        duringTurn,
      });
      return;
    }

    const clarificationAttempt = {
      id: `${stateRunDebugId(state)}:clarify:${Date.now()}`,
      abortController: new AbortController(),
      cancelledReason: null,
    };
    clarificationInFlight = clarificationAttempt;
    const requestedTerm = String(term || '').trim();
    const comprehensionRequest = detectTutorStubComprehensionRequest({
      explicitTerm: requestedTerm,
      text: requestedTerm || 'Explain the latest tutor wording.',
      source: 'slash_explain',
      turn: state.turns.length,
    });
    applyTutorStubComprehensionRequest(state.comprehension, comprehensionRequest);
    resetMixedLearnerSuggestion('comprehension_request');
    appendTraceEvent(state.trace, {
      type: 'comprehension_request',
      source: 'slash_explain',
      turn: state.turns.length,
      terms: comprehensionRequest.terms,
      generic: comprehensionRequest.generic,
      text: comprehensionRequest.text,
      advancesLearnerDag: false,
      comprehensionState: tutorStubComprehensionSnapshot(state.comprehension, { turn: state.turns.length }),
    });
    appendTraceEvent(state.trace, {
      type: 'clarification_start',
      term: requestedTerm || null,
      duringTurn,
      turn: state.turns.length,
    });
    try {
      console.log(
        `${C.dim}clarifying${requestedTerm ? ` "${oneLine(requestedTerm, { max: 80 })}"` : ' latest tutor wording'}...${C.reset}`,
      );
      const response = await generateTutorClarification({
        state,
        term: requestedTerm,
        resolved: state.resolved,
        cliEffort: state.cliEffort,
        signal: clarificationAttempt.abortController.signal,
      });
      assertTutorStubTurnAttemptCurrent({
        signal: clarificationAttempt.abortController.signal,
        isCurrent: () => clarificationInFlight === clarificationAttempt,
      });
      printWithConcurrentTerminal(state, () => {
        clearStatusLine();
        console.log(`${C.cyan}clarify >${C.reset} ${response.text}\n`);
        if (duringTurn) {
          console.log(
            `${C.dim}tutor is still thinking; clarification used the latest completed tutor message${C.reset}\n`,
          );
        }
      });
      const comprehensionResponse = applyTutorStubComprehensionResponse(state.comprehension, {
        text: response.text,
        turn: state.turns.length,
        source: 'slash_explain',
        force: true,
        terms: comprehensionRequest.terms,
      });
      appendTraceEvent(state.trace, {
        type: 'comprehension_response',
        source: 'slash_explain',
        turn: state.turns.length,
        explainedTerms: comprehensionResponse.explainedTerms,
        advancesLearnerDag: false,
        comprehensionState: comprehensionResponse.snapshot,
      });
      appendTraceEvent(state.trace, {
        type: 'clarification_complete',
        term: requestedTerm || null,
        duringTurn,
        turn: state.turns.length,
        text: response.text,
        provider: response.provider,
        model: response.model,
        latencyMs: response.latencyMs,
        usage: response.usage,
      });
    } catch (err) {
      if (err?.name === 'AbortError' && clarificationAttempt.cancelledReason) {
        appendTraceEvent(state.trace, {
          type: 'clarification_discarded',
          clarificationId: clarificationAttempt.id,
          reason: clarificationAttempt.cancelledReason,
        });
        return;
      }
      printWithConcurrentTerminal(state, () => {
        clearStatusLine();
        console.log(`${C.red}clarify error:${C.reset} ${err.message}\n`);
      });
      appendTraceEvent(state.trace, {
        type: 'clarification_error',
        term: requestedTerm || null,
        duringTurn,
        turn: state.turns.length,
        error: err.message,
      });
    } finally {
      if (clarificationInFlight === clarificationAttempt) {
        clarificationInFlight = null;
        if (!duringTurn) startMixedLearnerPrefetch('comprehension_state_changed');
      }
    }
  }

  async function runTutorOutputTranslationCommand(levelArgument = '', { duringTurn = false } = {}) {
    clearStatusLine();
    const sourceText = String(latestTutorMessage(state) || '').trim();
    if (!sourceText) {
      console.log(`${C.cyan}translate >${C.reset} no tutor message is available yet`);
      console.log(`${C.dim}  ask the tutor something first, then use /translate${C.reset}\n`);
      appendTraceEvent(state.trace, {
        type: 'tutor_output_translation_unavailable',
        reason: 'no_tutor_message',
        duringTurn,
        publicTranscriptChanged: false,
      });
      return;
    }
    let levels;
    try {
      levels = normalizeTutorStubTutorOutputTranslationLevels(levelArgument);
    } catch (error) {
      console.log(`${C.red}translate error:${C.reset} ${error.message}\n`);
      appendTraceEvent(state.trace, {
        type: 'tutor_output_translation_error',
        argument: levelArgument || null,
        duringTurn,
        error: error.message,
        publicTranscriptChanged: false,
      });
      return;
    }
    if (translationInFlight) {
      console.log(`${C.dim}translation is already running; wait for it to finish, then try again${C.reset}\n`);
      appendTraceEvent(state.trace, {
        type: 'tutor_output_translation_skipped',
        reason: 'already_in_flight',
        levels,
        duringTurn,
        publicTranscriptChanged: false,
      });
      return;
    }

    const attempt = {
      id: `${stateRunDebugId(state)}:translate:${Date.now()}`,
      abortController: new AbortController(),
      cancelledReason: null,
    };
    translationInFlight = attempt;
    appendTraceEvent(state.trace, {
      type: 'tutor_output_translation_start',
      schema: 'machinespirits.tutor-stub.tutor-output-translation-request.v1',
      translationId: attempt.id,
      levels,
      duringTurn,
      publicTranscriptChanged: false,
    });
    try {
      console.log(
        `${C.dim}rewriting the latest tutor reply in ${levels.length === 1 ? levels[0] : 'basic through proficient'} English...${C.reset}`,
      );
      const response = await generateTutorStubTutorOutputTranslation({
        state,
        sourceText,
        levels,
        signal: attempt.abortController.signal,
      });
      assertTutorStubTurnAttemptCurrent({
        signal: attempt.abortController.signal,
        isCurrent: () => translationInFlight === attempt,
      });
      const rendered = renderTutorStubTutorOutputTranslation(response.translation);
      printWithConcurrentTerminal(state, () => {
        clearStatusLine();
        console.log(`${C.brightCyan}${C.bold}translate >${C.reset} latest tutor reply`);
        console.log(`${C.dim}  temporary wording view; the transcript and tutor state are unchanged${C.reset}\n`);
        console.log(`${rendered}\n`);
        if (duringTurn) {
          console.log(
            `${C.dim}tutor is still thinking; this rewrote the previous completed reply and did not change the pending turn${C.reset}\n`,
          );
        }
      });
      appendTraceEvent(state.trace, {
        type: 'tutor_output_translation_complete',
        schema: response.translation.schema,
        translationId: attempt.id,
        levels,
        duringTurn,
        translation: response.translation,
        provider: response.provider,
        model: response.model,
        latencyMs: response.latencyMs,
        usage: response.usage,
        publicTranscriptChanged: false,
      });
    } catch (error) {
      if (error?.name === 'AbortError' && attempt.cancelledReason) {
        appendTraceEvent(state.trace, {
          type: 'tutor_output_translation_discarded',
          translationId: attempt.id,
          reason: attempt.cancelledReason,
          publicTranscriptChanged: false,
        });
        return;
      }
      printWithConcurrentTerminal(state, () => {
        clearStatusLine();
        console.log(`${C.red}translate error:${C.reset} ${error.message}\n`);
      });
      appendTraceEvent(state.trace, {
        type: 'tutor_output_translation_error',
        translationId: attempt.id,
        levels,
        duringTurn,
        error: error.message,
        publicTranscriptChanged: false,
      });
    } finally {
      if (translationInFlight === attempt) translationInFlight = null;
    }
  }

  async function runCurriculumTranslationCommand(levelArgument = '', { duringTurn = false } = {}) {
    const module = state.curriculum?.module || null;
    if (!module) return runTutorOutputTranslationCommand(levelArgument, { duringTurn });
    clearStatusLine();
    let levels;
    try {
      levels = normalizeTutorStubCurriculumTranslationLevels(levelArgument);
    } catch (error) {
      console.log(`${C.red}translate error:${C.reset} ${error.message}\n`);
      appendTraceEvent(state.trace, {
        type: 'curriculum_translation_error',
        moduleId: module.id,
        argument: levelArgument || null,
        duringTurn,
        error: error.message,
        publicTranscriptChanged: false,
      });
      return;
    }
    if (translationInFlight) {
      console.log(`${C.dim}translation is already running; wait for it to finish, then try again${C.reset}\n`);
      appendTraceEvent(state.trace, {
        type: 'curriculum_translation_skipped',
        reason: 'already_in_flight',
        moduleId: module.id,
        levels,
        duringTurn,
        publicTranscriptChanged: false,
      });
      return;
    }

    const attempt = {
      id: `${stateRunDebugId(state)}:translate:${Date.now()}`,
      abortController: new AbortController(),
      cancelledReason: null,
    };
    translationInFlight = attempt;
    appendTraceEvent(state.trace, {
      type: 'curriculum_translation_start',
      schema: 'machinespirits.tutor-stub.curriculum-translation-request.v1',
      translationId: attempt.id,
      moduleId: module.id,
      moduleTitle: module.title,
      levels,
      duringTurn,
      publicTranscriptChanged: false,
    });
    try {
      console.log(
        `${C.dim}translating ${module.title} into ${levels.length === 1 ? levels[0] : 'basic through proficient'} English...${C.reset}`,
      );
      const response = await generateTutorStubCurriculumTranslation({
        state,
        levels,
        signal: attempt.abortController.signal,
      });
      assertTutorStubTurnAttemptCurrent({
        signal: attempt.abortController.signal,
        isCurrent: () => translationInFlight === attempt,
      });
      const rendered = renderTutorStubCurriculumTranslation(response.translation);
      printWithConcurrentTerminal(state, () => {
        clearStatusLine();
        console.log(`${C.brightCyan}${C.bold}translate >${C.reset} ${module.id} · ${module.title}`);
        console.log(
          `${C.dim}  wording changes only; the canonical curriculum and its checks remain authoritative${C.reset}\n`,
        );
        console.log(`${rendered}\n`);
        if (duringTurn) {
          console.log(
            `${C.dim}tutor is still thinking; this view used the active curriculum source and did not change the pending turn${C.reset}\n`,
          );
        }
      });
      appendTraceEvent(state.trace, {
        type: 'curriculum_translation_complete',
        schema: response.translation.schema,
        translationId: attempt.id,
        moduleId: module.id,
        levels,
        duringTurn,
        translation: response.translation,
        provider: response.provider,
        model: response.model,
        latencyMs: response.latencyMs,
        usage: response.usage,
        publicTranscriptChanged: false,
      });
    } catch (error) {
      if (error?.name === 'AbortError' && attempt.cancelledReason) {
        appendTraceEvent(state.trace, {
          type: 'curriculum_translation_discarded',
          translationId: attempt.id,
          moduleId: module.id,
          reason: attempt.cancelledReason,
          publicTranscriptChanged: false,
        });
        return;
      }
      printWithConcurrentTerminal(state, () => {
        clearStatusLine();
        console.log(`${C.red}translate error:${C.reset} ${error.message}\n`);
      });
      appendTraceEvent(state.trace, {
        type: 'curriculum_translation_error',
        translationId: attempt.id,
        moduleId: module.id,
        levels,
        duringTurn,
        error: error.message,
        publicTranscriptChanged: false,
      });
    } finally {
      if (translationInFlight === attempt) translationInFlight = null;
    }
  }

  function printInteractiveTutorOpening(opening) {
    if (!opening || exiting) return false;
    printOpeningDebugLine(state);
    printDirectorPreludeBeforeFirstTutor(state, { reason: 'interactive_opening' });
    console.log(`${C.magenta}tutor >${C.reset} ${opening}\n`);
    publishAcceptedTutorToVoice({
      text: opening,
      turn: 0,
      turnId: openingDebugId(stateRunDebugId(state)),
      reason: 'accepted_tutor_opening',
    });
    printTutorFeedbackRequest({
      tutorTurn: 0,
      tutorTurnId: openingDebugId(stateRunDebugId(state)),
      kind: 'opening',
    });
    return true;
  }

  async function performInteractiveDialogueReset({ command = '/reset', duringTurn = false } = {}) {
    const learnerAttempt = activeLearnerTurn;
    const autoAttempt = activeAutoRun;
    const queuedAutoRequest = pendingAutoRequest;
    const clarificationAttempt = clarificationInFlight;
    const translationAttempt = translationInFlight;
    const queuedLearnerLines = pendingLearnerLines.length;
    const interrupted = Boolean(
      learnerAttempt ||
      autoAttempt ||
      queuedAutoRequest ||
      clarificationAttempt ||
      translationAttempt ||
      duringTurn ||
      processingTurn,
    );

    stopInterimAnimation(state);
    discardPendingInteractiveAuto('dialogue_reset', { source: command });
    if (learnerAttempt) {
      learnerAttempt.cancelledReason = 'dialogue_reset';
      activeLearnerTurn = null;
      learnerAttempt.abortController?.abort();
    }
    if (autoAttempt) {
      autoAttempt.cancelledReason = 'dialogue_reset';
      activeAutoRun = null;
      autoAttempt.abortController?.abort();
    }
    if (clarificationAttempt) {
      clarificationAttempt.cancelledReason = 'dialogue_reset';
      clarificationInFlight = null;
      clarificationAttempt.abortController.abort();
    }
    if (translationAttempt) {
      translationAttempt.cancelledReason = 'dialogue_reset';
      translationInFlight = null;
      translationAttempt.abortController.abort();
    }
    processingTurn = false;
    pendingLearnerLines.length = 0;
    awaitingAnotherScenario = false;
    resetMixedLearnerSuggestion('dialogue_reset');
    resetInteractiveState();

    if (state.interaction?.mode === 'auto') {
      state.interaction.mode = state.interaction.previousMode === 'coach' ? 'coach' : 'learner';
    }
    if (state.interaction) state.interaction.autoRunning = false;
    rl.setPrompt(mixedLearnerPromptText());

    appendTraceEvent(state.trace, {
      type: 'history_clear',
      reason: 'dialogue_reset',
      command,
      duringTurn,
      interrupted,
    });
    appendTraceEvent(state.trace, {
      type: 'interactive_dialogue_reset',
      command,
      interrupted,
      interruptedLearnerTurn: learnerAttempt
        ? {
            turn: learnerAttempt.turn,
            turnId: learnerAttempt.turnId,
            revision: learnerAttempt.revision,
            messageCount: learnerAttempt.fragments.length,
          }
        : null,
      interruptedAutoRunId: autoAttempt?.id || null,
      interruptedQueuedAutoRequestId: queuedAutoRequest?.id || null,
      interruptedClarificationId: clarificationAttempt?.id || null,
      interruptedTranslationId: translationAttempt?.id || null,
      interruptedCurriculumTranslationId: state.curriculum?.module ? translationAttempt?.id || null : null,
      queuedLearnerLinesDiscarded: queuedLearnerLines,
      directorGuidance: tutorStubDirectorGuidanceSnapshot(state.directorGuidance),
      preserved: ['scenario', 'learner_profile', 'settings', 'director_guidance'],
    });
    clearStatusLine();
    console.log(
      `${C.brightCyan}${C.bold}dialogue reset >${C.reset} ${
        interrupted ? 'unfinished work cancelled; ' : ''
      }starting this scenario again`,
    );
    console.log(
      `${C.dim}  previous turns discarded · learner profile, settings, and director request kept${C.reset}\n`,
    );
    const opening = await emitOpeningPrompt('reset');
    if (opening) startMixedLearnerPrefetch('reset_opening');
    return true;
  }

  function resetInteractiveDialogue(options = {}) {
    return sessionRuntime.reset({ reason: 'dialogue_reset', ...options });
  }

  function trainingReuseStatusLines(prefix = 'training reuse') {
    const reuse = state.trainingReuse;
    return projectTutorStubTrainingReuseStatusLines({
      prefix,
      label: tutorStubTrainingReuseLabel(reuse),
      requested: reuse.requested,
      humanSubjectLabel: displayDiagnosticLabel(reuse.humanSubjectClass),
      sourceLabel: displayDiagnosticLabel(reuse.source),
      failClosed: reuse.failClosed,
      status: reuse.status,
      colors: C,
    });
  }

  function printTrainingReuseStatus(prefix = 'training reuse') {
    const lines = trainingReuseStatusLines(prefix);
    for (const line of lines) {
      console.log(line);
    }
  }

  function handleTrainingReuseSetting(value = 'status', { source = 'live_settings' } = {}) {
    const action = String(value || 'status')
      .trim()
      .toLowerCase();
    if (action === 'status') {
      console.log(`${C.cyan}training reuse >${C.reset}`);
      printTrainingReuseStatus('current session');
      console.log();
      return true;
    }
    let requested;
    try {
      requested = normalizeTutorStubTrainingReuseSetting(action, { label: 'training reuse' });
    } catch (error) {
      console.log(`${C.red}settings error:${C.reset} ${error.message}; use on, off, or status\n`);
      return false;
    }
    const previous = state.trainingReuse;
    state.trainingReuse = resolveTutorStubTrainingReuse({
      requested,
      source,
      humanSubjectClass: previous.declaredHumanSubjectClass,
      humanSubjectClassSource: previous.humanSubjectClassSource,
      humanInputExpected: previous.humanInputExpected,
    });
    args['training-reuse'] = state.trainingReuse.requested;
    const remembered = persistCurrentInteractiveSettings('training_reuse_changed');
    appendTraceEvent(state.trace, {
      type: 'training_reuse_changed',
      previous,
      trainingReuse: state.trainingReuse,
      rememberedAt: remembered?.updatedAt || null,
      source,
      publicTranscriptChanged: false,
    });
    console.log(`${C.cyan}training reuse >${C.reset} ${tutorStubTrainingReuseLabel(state.trainingReuse)}`);
    printTrainingReuseStatus('current session');
    console.log();
    return true;
  }

  function printDialogueSettings() {
    const explicitRegister = explicitPerformanceDirectiveValue(state, 'register');
    const explicitCharacter = explicitPerformanceDirectiveValue(state, 'character');
    const temperatureSelection = performanceTemperatureScope({
      policy: state.register?.policy,
      explicitRegister,
      explicitCharacter,
      randomStance: state.randomPerformance?.enabled === true && !explicitRegister,
      randomCharacter: state.randomPerformance?.enabled === true && !explicitCharacter,
    });
    const randomPerformanceAxes = [!explicitRegister ? 'style' : null, !explicitCharacter ? 'character' : null].filter(
      Boolean,
    );
    const modelRoles = Object.keys(liveModelRoleDefinitions).map(liveModelRoleSnapshot);
    const dropout = tutorStubDagFactDropoutSnapshot(state.learnerDag?.dropout);
    const pace = tutorStubReleasePacingSnapshot(state.releasePacing, state.world);
    const lines = projectTutorStubDialogueSettingsLines({
      settings: {
        allRolesOverrideRef: state.modelRouting?.allRolesOverrideRef,
        modelRoles,
        classifierCombined: state.classifier?.combined,
        tutorEffort: state.cliEffort,
        appearance: {
          themeLabel: cliPresentation.themeLabel,
          requestedMotion: cliPresentation.requestedMotion,
          motion: cliPresentation.motion,
        },
        committee: {
          enabled: state.committee?.enabled,
          miniModel: state.committee?.miniModel,
          fallbackPolicy: state.committee?.fallbackPolicy,
        },
        publicMessageCount: tutorStubPublicMessagesForSpeaker(state.history, { speaker: 'tutor' }).length,
        teaching: {
          policyLabel: plainPolicyLabel(state.register?.policy),
          policyStackId: tutorStubRegisterPolicyStackId(state.register?.policy, state.register?.overlays),
          overlays: state.register?.overlays,
          overlayThreshold: state.register?.overlayThreshold ?? DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD,
          styleRange: state.register?.temperature ?? registerTemperature,
          temperatureSelection: {
            applied: temperatureSelection.applied,
            scope: temperatureSelection.scope,
            scopeLabel: displayDiagnosticLabel(temperatureSelection.scope),
          },
          randomPerformance: {
            enabled: state.randomPerformance?.enabled,
            axes: randomPerformanceAxes,
          },
          lightAdaptation: {
            enabled: state.lightAdaptation?.enabled,
            threshold: state.lightAdaptation?.threshold,
          },
          directedPerformance: {
            register: explicitRegister,
            character: explicitCharacter,
          },
        },
        dropout,
        releasePacing: {
          baseSpeed: pace?.baseSpeed ?? DEFAULT_TUTOR_STUB_RELEASE_SPEED,
          effectiveSpeed: pace?.effectiveSpeed ?? DEFAULT_TUTOR_STUB_RELEASE_SPEED,
          direction: pace?.direction || 'steady',
        },
        rememberedSettings: {
          enabled: state.rememberedSettings?.enabled,
          status: state.rememberedSettings?.status || 'disabled',
        },
      },
      trainingReuseLines: trainingReuseStatusLines(),
      colors: C,
    });
    for (const line of lines) {
      console.log(line);
    }
  }

  function printModelChoices(role = 'tutor') {
    const definition = liveModelRoleDefinitions[role];
    const currentRef = liveModelRoleRef(role);
    const entries = tutorModelChoiceEntries(currentRef);
    const lines = projectTutorStubModelChoiceLines({ definition, currentRef, entries, colors: C });
    for (const line of lines) {
      console.log(line);
    }
  }

  function printTutorModelChoices() {
    printModelChoices('tutor');
  }

  async function chooseLiveTutorModel() {
    console.log(`${C.brightCyan}${C.bold}Tutor model · choose with ↑/↓ and Enter${C.reset}`);
    const selection = await pickInitialTutorModelWithKeyboard(state.modelRef);
    if (!selection) return false;
    await handleDialogueSettings(`model ${selection.ref}`);
    return true;
  }

  async function chooseLiveRoleModel(role) {
    const definition = liveModelRoleDefinitions[role];
    console.log(`${C.brightCyan}${C.bold}${definition.label} · choose with ↑/↓ and Enter${C.reset}`);
    const selection = await pickInitialTutorModelWithKeyboard(liveModelRoleRef(role));
    if (!selection) return false;
    await handleDialogueSettings(`models ${definition.setting} ${selection.ref}`);
    return true;
  }

  async function pickLiveNumericSettingValue(setting, value = undefined) {
    if (setting === 'stance_temp') {
      return pickLiveNumericSettingWithKeyboard({
        label: 'Teaching-style range',
        value: value ?? state.register?.temperature ?? registerTemperature,
        min: MIN_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
        max: MAX_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
        step: 0.05,
        coarseStep: 0.25,
        recommended: DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
        explanation: 'Lower values concentrate the strongest style; higher values retain more alternative signals.',
      });
    }
    if (setting === 'dropout') {
      return pickLiveNumericSettingWithKeyboard({
        label: 'Evidence-memory dropout',
        value: value ?? state.learnerDag?.dropout?.rate ?? DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_RATE,
        min: 0,
        max: 1,
        step: 0.05,
        coarseStep: 0.1,
        recommended: DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_RATE,
        explanation: 'Zero keeps understood evidence reliable; higher values simulate recoverable forgetting.',
      });
    }
    if (setting === 'release_speed') {
      return pickLiveNumericSettingWithKeyboard({
        label: 'Clue release speed',
        value: value ?? state.releasePacing?.baseSpeed ?? DEFAULT_TUTOR_STUB_RELEASE_SPEED,
        min: MIN_TUTOR_STUB_RELEASE_SPEED,
        max: MAX_TUTOR_STUB_RELEASE_SPEED,
        step: 0.05,
        coarseStep: 0.25,
        recommended: DEFAULT_TUTOR_STUB_RELEASE_SPEED,
        explanation: 'One follows the authored schedule; lower slows new clues and higher brings them forward.',
      });
    }
    return pickLiveNumericSettingWithKeyboard({
      label: 'Override sensitivity',
      value: value ?? state.register?.overlayThreshold ?? DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD,
      min: 0,
      max: 1,
      step: 0.05,
      coarseStep: 0.1,
      recommended: DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD,
      explanation: 'Lower values react more often; higher values wait for a stronger conversational change.',
    });
  }

  async function chooseLiveNumericSetting(setting) {
    const next = await pickLiveNumericSettingValue(setting);
    if (next === null) return false;
    const command =
      setting === 'stance_temp'
        ? `stance-temp ${next}`
        : setting === 'dropout'
          ? `dropout ${next}`
          : setting === 'release_speed'
            ? `release-speed ${next}`
            : `policy threshold ${next}`;
    await handleDialogueSettings(command);
    return true;
  }

  function createLiveSettingsDraft() {
    return {
      allModelsOverrideRef: state.modelRouting?.allRolesOverrideRef || null,
      tutorModelRef: state.modelRef,
      classifierModelRef: liveModelRoleRef('classifier'),
      reasoningModelRef: liveModelRoleRef('reasoning'),
      learnerModelRef: liveModelRoleRef('learner'),
      theme: state.presentation?.theme || cliPresentation.themeId,
      motion: state.presentation?.motion || cliPresentation.requestedMotion,
      temperature: state.register?.temperature ?? registerTemperature,
      dropoutRate: state.learnerDag?.dropout?.rate ?? DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_RATE,
      releaseSpeed: state.releasePacing?.baseSpeed ?? DEFAULT_TUTOR_STUB_RELEASE_SPEED,
      lightAdaptationEnabled: state.lightAdaptation?.enabled === true,
      trainingReuseEnabled: state.trainingReuse?.requested === 'on',
      overlays: [...(state.register?.overlays || [])],
      overlayThreshold: state.register?.overlayThreshold ?? DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD,
      forgetSavedSettings: false,
    };
  }

  function liveSettingsDraftChangeIds(draft) {
    const currentOverlays = state.register?.overlays || [];
    const changes = [];
    if (
      draft.allModelsOverrideRef &&
      [draft.tutorModelRef, draft.classifierModelRef, draft.reasoningModelRef, draft.learnerModelRef].every(
        (ref) => ref === draft.allModelsOverrideRef,
      ) &&
      draft.allModelsOverrideRef !== state.modelRouting?.allRolesOverrideRef
    ) {
      changes.push('all_models');
    } else {
      if (draft.tutorModelRef !== state.modelRef) changes.push('tutor_model');
      if (draft.classifierModelRef !== liveModelRoleRef('classifier')) changes.push('classifier_model');
      if (draft.reasoningModelRef !== liveModelRoleRef('reasoning')) changes.push('reasoning_model');
      if (draft.learnerModelRef !== liveModelRoleRef('learner')) changes.push('learner_model');
    }
    if (draft.temperature !== (state.register?.temperature ?? registerTemperature)) changes.push('stance_temp');
    if (draft.theme !== (state.presentation?.theme || cliPresentation.themeId)) changes.push('theme');
    if (draft.motion !== (state.presentation?.motion || cliPresentation.requestedMotion)) changes.push('motion');
    if (draft.dropoutRate !== (state.learnerDag?.dropout?.rate ?? DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_RATE)) {
      changes.push('dropout');
    }
    if (draft.releaseSpeed !== (state.releasePacing?.baseSpeed ?? DEFAULT_TUTOR_STUB_RELEASE_SPEED)) {
      changes.push('release_speed');
    }
    if (draft.lightAdaptationEnabled !== (state.lightAdaptation?.enabled === true)) {
      changes.push('light_adaptation');
    }
    if (draft.trainingReuseEnabled !== (state.trainingReuse?.requested === 'on')) {
      changes.push('training_reuse');
    }
    if (
      currentOverlays.length !== draft.overlays.length ||
      currentOverlays.some((overlay) => !draft.overlays.includes(overlay))
    ) {
      changes.push('overlays');
    }
    if (
      draft.overlayThreshold !== (state.register?.overlayThreshold ?? DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD)
    ) {
      changes.push('overlay_threshold');
    }
    if (draft.forgetSavedSettings) changes.push('forget');
    return changes;
  }

  async function applyLiveSettingsDraft(draft) {
    const changes = liveSettingsDraftChangeIds(draft);
    if (changes.includes('all_models')) {
      await handleDialogueSettings(`models all ${draft.allModelsOverrideRef}`);
    } else {
      if (changes.includes('tutor_model')) await handleDialogueSettings(`models tutor ${draft.tutorModelRef}`);
      if (changes.includes('classifier_model')) {
        await handleDialogueSettings(`models classifier ${draft.classifierModelRef}`);
      }
      if (changes.includes('reasoning_model')) {
        await handleDialogueSettings(`models reasoning ${draft.reasoningModelRef}`);
      }
      if (changes.includes('learner_model')) await handleDialogueSettings(`models learner ${draft.learnerModelRef}`);
    }
    if (changes.includes('stance_temp')) await handleDialogueSettings(`stance-temp ${draft.temperature}`);
    if (changes.includes('theme')) await handleDialogueSettings(`theme ${draft.theme}`);
    if (changes.includes('motion')) await handleDialogueSettings(`motion ${draft.motion}`);
    if (changes.includes('dropout')) await handleDialogueSettings(`dropout ${draft.dropoutRate}`);
    if (changes.includes('release_speed')) await handleDialogueSettings(`release-speed ${draft.releaseSpeed}`);
    if (changes.includes('light_adaptation')) {
      await handleDialogueSettings(`light ${draft.lightAdaptationEnabled ? 'on' : 'off'}`);
    }
    if (changes.includes('training_reuse')) {
      await handleDialogueSettings(`training-reuse ${draft.trainingReuseEnabled ? 'on' : 'off'}`);
    }
    if (changes.includes('overlays')) {
      const currentOverlays = [...(state.register?.overlays || [])];
      for (const overlay of currentOverlays.filter((entry) => !draft.overlays.includes(entry))) {
        await handleDialogueSettings(`policy remove ${overlay}`);
      }
      for (const overlay of draft.overlays.filter((entry) => !currentOverlays.includes(entry))) {
        await handleDialogueSettings(`policy add ${overlay}`);
      }
    }
    if (changes.includes('overlay_threshold')) {
      await handleDialogueSettings(`policy threshold ${draft.overlayThreshold}`);
    }
    if (changes.includes('forget')) await handleDialogueSettings('forget');
    return changes;
  }

  async function openLiveSettingsPanel() {
    const draft = createLiveSettingsDraft();
    appendTraceEvent(state.trace, {
      type: 'settings_panel_opened',
      turn: state.turns.length + 1,
      modelRef: state.modelRef,
      policyStack: tutorStubRegisterPolicyStackId(state.register?.policy, state.register?.overlays),
    });
    let selectedIndex = 0;
    let reason = 'cancelled';
    let changedSettings = [];
    while (!exiting) {
      const action = await pickLiveSettingsActionWithKeyboard(selectedIndex, draft);
      if (!action) {
        reason = 'cancelled';
        changedSettings = liveSettingsDraftChangeIds(draft);
        break;
      }
      selectedIndex = action.index;
      if (action.id === 'done') {
        changedSettings = await applyLiveSettingsDraft(draft);
        reason = changedSettings.length ? 'applied' : 'unchanged';
        break;
      }
      appendTraceEvent(state.trace, {
        type: 'settings_panel_action_selected',
        action: action.id,
        turn: state.turns.length + 1,
      });
      if (
        action.id === 'all_models' ||
        action.id === 'tutor_model' ||
        action.id === 'classifier_model' ||
        action.id === 'reasoning_model' ||
        action.id === 'learner_model'
      ) {
        const role =
          action.id === 'all_models'
            ? 'all'
            : action.id === 'tutor_model'
              ? 'tutor'
              : action.id === 'classifier_model'
                ? 'classifier'
                : action.id === 'reasoning_model'
                  ? 'reasoning'
                  : 'learner';
        const label = role === 'all' ? 'One model for all roles' : liveModelRoleDefinitions[role].label;
        const currentRef =
          role === 'all'
            ? draft.allModelsOverrideRef || draft.tutorModelRef
            : role === 'tutor'
              ? draft.tutorModelRef
              : role === 'classifier'
                ? draft.classifierModelRef
                : role === 'reasoning'
                  ? draft.reasoningModelRef
                  : draft.learnerModelRef;
        console.log(`${C.brightCyan}${C.bold}${label} · choose with ↑/↓ and Enter${C.reset}`);
        console.log(`${C.dim}  Esc back · saved only when you choose Done${C.reset}`);
        const selection = await pickInitialTutorModelWithKeyboard(currentRef);
        if (selection && role === 'all') {
          draft.allModelsOverrideRef = selection.ref;
          draft.tutorModelRef = selection.ref;
          draft.classifierModelRef = selection.ref;
          draft.reasoningModelRef = selection.ref;
          draft.learnerModelRef = selection.ref;
        } else if (selection) {
          draft.allModelsOverrideRef = null;
          if (role === 'tutor') draft.tutorModelRef = selection.ref;
          else if (role === 'classifier') draft.classifierModelRef = selection.ref;
          else if (role === 'reasoning') draft.reasoningModelRef = selection.ref;
          else draft.learnerModelRef = selection.ref;
        }
      } else if (
        action.id === 'stance_temp' ||
        action.id === 'dropout' ||
        action.id === 'release_speed' ||
        action.id === 'overlay_threshold'
      ) {
        const draftValue =
          action.id === 'stance_temp'
            ? draft.temperature
            : action.id === 'dropout'
              ? draft.dropoutRate
              : action.id === 'release_speed'
                ? draft.releaseSpeed
                : draft.overlayThreshold;
        const next = await pickLiveNumericSettingValue(action.id, draftValue);
        if (next !== null) {
          if (action.id === 'stance_temp') draft.temperature = next;
          else if (action.id === 'dropout') draft.dropoutRate = next;
          else if (action.id === 'release_speed') draft.releaseSpeed = next;
          else draft.overlayThreshold = next;
        }
      } else if (action.id === 'theme') {
        const current = TUTOR_STUB_CLI_THEME_IDS.indexOf(draft.theme);
        draft.theme = TUTOR_STUB_CLI_THEME_IDS[(current + 1) % TUTOR_STUB_CLI_THEME_IDS.length];
        configureCliPresentation({
          theme: draft.theme,
          motion: draft.motion,
          noColor: args['no-color'],
        });
        rl.setPrompt(mixedLearnerPromptText());
      } else if (action.id === 'motion') {
        const current = TUTOR_STUB_CLI_MOTION_IDS.indexOf(draft.motion);
        draft.motion = TUTOR_STUB_CLI_MOTION_IDS[(current + 1) % TUTOR_STUB_CLI_MOTION_IDS.length];
        configureCliPresentation({
          theme: draft.theme,
          motion: draft.motion,
          noColor: args['no-color'],
        });
      } else if (action.id === 'state_overlay' || action.id === 'field_overlay') {
        const overlay = action.id === 'state_overlay' ? 'state' : 'field';
        draft.overlays = draft.overlays.includes(overlay)
          ? draft.overlays.filter((entry) => entry !== overlay)
          : [...draft.overlays, overlay];
      } else if (action.id === 'light_adaptation') {
        draft.lightAdaptationEnabled = !draft.lightAdaptationEnabled;
      } else if (action.id === 'training_reuse') {
        draft.trainingReuseEnabled = !draft.trainingReuseEnabled;
      } else if (action.id === 'forget') {
        draft.forgetSavedSettings = !draft.forgetSavedSettings;
      }
    }
    appendTraceEvent(state.trace, {
      type: 'settings_panel_closed',
      reason,
      changedSettings,
      changesDiscarded: reason === 'cancelled' ? changedSettings : [],
      turn: state.turns.length + 1,
      modelRef: state.modelRef,
      policyStack: tutorStubRegisterPolicyStackId(state.register?.policy, state.register?.overlays),
    });
    if (reason === 'cancelled') {
      configureCliPresentation({
        theme: state.presentation?.theme || args.theme,
        motion: state.presentation?.motion || args.motion,
        noColor: args['no-color'],
      });
      rl.setPrompt(mixedLearnerPromptText());
      console.log(
        `${C.dim}settings cancelled · ${changedSettings.length ? 'unsaved changes discarded' : 'nothing changed'}${C.reset}\n`,
      );
    } else {
      console.log(
        `${C.dim}${reason === 'applied' ? 'settings applied' : 'settings unchanged'} · returning to dialogue${C.reset}\n`,
      );
    }
  }

  function handleDialogueSettings(...parameters) {
    return commandRuntime.handleDialogueSettings(...parameters);
  }

  function repriseLatestTutorUtterance(command, { duringTurn = false } = {}) {
    if (duringTurn || exiting || !tutorStubCommandReturnsToScene(command)) return false;
    const utterance = String(latestTutorMessage(state) || '').trim();
    if (!utterance) return false;
    console.log(`${C.brightMagenta}${C.bold}tutor ↻ >${C.reset} ${utterance}\n`);
    appendTraceEvent(state.trace, {
      type: 'tutor_utterance_reprise',
      command,
      turn: state.turns[state.turns.length - 1]?.turn || 0,
      text: utterance,
      publicTranscriptChanged: false,
    });
    return true;
  }

  function latestTutorFeedbackTarget() {
    const turn = state.turns.at(-1);
    if (turn?.tutor) {
      return {
        tutorTurn: turn.turn,
        tutorTurnId: turn.turnId || turnDebugId(state, turn.turn),
        kind: 'tutor_response',
      };
    }
    if (state.history?.[0]?.role === 'assistant') {
      return {
        tutorTurn: 0,
        tutorTurnId: openingDebugId(stateRunDebugId(state)),
        kind: 'opening',
      };
    }
    return null;
  }

  function handleResponseDetailsCommand(action = '', { duringTurn = false, source = 'command' } = {}) {
    clearStatusLine();
    const normalized = String(action || 'status')
      .trim()
      .toLowerCase();
    if (!normalized || normalized === 'status') {
      console.log(`${C.accent}${C.bold}response details >${C.reset} ${state.responseDetails?.enabled ? 'on' : 'off'}`);
      console.log(
        `${C.dim}  compact model, foreground timing, token, and tutor-style details appear before tutor speech; /details on|off${C.reset}\n`,
      );
      return true;
    }
    if (normalized !== 'on' && normalized !== 'off') {
      console.log(`${C.danger}details error:${C.reset} use /details on, /details off, or /details status\n`);
      return true;
    }
    const previous = Boolean(state.responseDetails?.enabled);
    const enabled = normalized === 'on';
    state.responseDetails = {
      ...(state.responseDetails || responseDetailsConfig),
      enabled,
    };
    appendTraceEvent(state.trace, {
      type: 'terminal_response_details_changed',
      source,
      previous,
      enabled,
      duringTurn,
      effectiveTurn: state.turns.length + 1,
      publicTranscriptChanged: false,
    });
    console.log(`${C.accent}${C.bold}response details >${C.reset} ${enabled ? 'on' : 'off'}`);
    console.log(
      `${C.dim}  ${enabled ? 'compact details will appear before tutor speech' : 'model and timing details are hidden for the rest of this session unless re-enabled'}${C.reset}\n`,
    );
    return true;
  }

  function printTutorFeedbackRequest(target = latestTutorFeedbackTarget()) {
    if (!target || !state.turnFeedback?.enabled || state.interaction?.mode === 'auto' || exiting) return false;
    const feedback = requestTutorStubTurnFeedback(state.turnFeedback, target);
    if (!feedback) return false;
    console.log(
      `${C.brightYellow}optional tutor feedback >${C.reset} ${C.red}← 👎 not helpful${C.reset} · ${C.brightGreen}👍 helpful →${C.reset} · ${C.dim}empty prompt; no Enter · Esc hides for session · or just reply${C.reset}\n`,
    );
    appendTraceEvent(state.trace, {
      type: 'tutor_turn_feedback_requested',
      turn: target.tutorTurn,
      turnId: target.tutorTurnId,
      kind: target.kind,
      feedback,
      publicTranscriptChanged: false,
    });
    return true;
  }

  function handleTutorFeedbackCommand(action = '', { duringTurn = false, source = 'command' } = {}) {
    clearStatusLine();
    const rawAction = String(action || '').trim();
    const [ratingAction = '', reasonAction = '', ...commentParts] = rawAction.split(/\s+/u);
    const normalized = ratingAction.toLowerCase();
    if (!normalized) {
      const feedback = tutorStubTurnFeedbackEnvelope(state.turnFeedback);
      console.log(
        `${C.brightYellow}${C.bold}tutor feedback >${C.reset} ${state.turnFeedback?.enabled ? 'on' : 'off'} · ${tutorStubTurnFeedbackLabel(feedback)}`,
      );
      console.log(
        `${C.dim}  optional and private · on an empty prompt use ← for down, → for up, or Esc to hide for the session; 👍, 👎, /up, /down, and /feedback also work${C.reset}\n`,
      );
      return true;
    }
    if (normalized === 'on') {
      setTutorStubTurnFeedbackEnabled(state.turnFeedback, true);
      appendTraceEvent(state.trace, {
        type: 'tutor_turn_feedback_setting_changed',
        enabled: true,
        source,
        duringTurn,
        effectiveTurn: state.turns.length + 1,
        publicTranscriptChanged: false,
      });
      console.log(`${C.brightYellow}${C.bold}tutor feedback >${C.reset} on · optional`);
      if (!duringTurn && latestTutorFeedbackTarget()) printTutorFeedbackRequest();
      else console.log(`${C.dim}  the next displayed tutor message will invite a rating${C.reset}\n`);
      return true;
    }
    if (normalized === 'off') {
      setTutorStubTurnFeedbackEnabled(state.turnFeedback, false);
      appendTraceEvent(state.trace, {
        type: 'tutor_turn_feedback_setting_changed',
        enabled: false,
        source,
        duringTurn,
        effectiveTurn: state.turns.length + 1,
        publicTranscriptChanged: false,
      });
      console.log(`${C.brightYellow}${C.bold}tutor feedback >${C.reset} off`);
      console.log(`${C.dim}  no rating will be attached to later learner messages${C.reset}\n`);
      return true;
    }
    if (duringTurn || processingTurn) {
      console.log(`${C.dim}the tutor is already responding; rate the next tutor message after it appears${C.reset}\n`);
      return true;
    }
    if (normalized === 'clear') {
      const feedback = clearTutorStubTurnFeedbackRating(state.turnFeedback);
      console.log(`${C.brightYellow}${C.bold}tutor feedback >${C.reset} ${tutorStubTurnFeedbackLabel(feedback)}`);
      console.log(`${C.dim}  no rating will accompany your next learner message unless you choose one${C.reset}\n`);
      appendTraceEvent(state.trace, {
        type: 'tutor_turn_feedback_cleared',
        turn: feedback?.targetTutorTurn ?? null,
        turnId: feedback?.targetTutorTurnId || null,
        publicTranscriptChanged: false,
      });
      return true;
    }
    if (normalized !== 'up' && normalized !== 'down') {
      console.log(
        `${C.red}feedback error:${C.reset} use /feedback up [reason], /feedback down [reason] [comment], /feedback clear, /feedback on, or /feedback off\n`,
      );
      return true;
    }
    let reason = null;
    let comment = '';
    if (reasonAction) {
      const candidateReason = reasonAction.toLowerCase().replace(/[\s-]+/gu, '_');
      if (TUTOR_STUB_FEEDBACK_REASONS[candidateReason]) {
        reason = candidateReason;
        comment = commentParts.join(' ');
      } else {
        reason = 'custom';
        comment = [reasonAction, ...commentParts].join(' ');
      }
    }
    let feedback;
    try {
      feedback = setTutorStubTurnFeedbackRating(state.turnFeedback, normalized, { reason, comment });
    } catch (error) {
      console.log(`${C.red}feedback error:${C.reset} ${error.message}\n`);
      return true;
    }
    if (!feedback) {
      console.log(`${C.dim}no tutor message is awaiting feedback; continue the dialogue first${C.reset}\n`);
      return true;
    }
    console.log(
      `${C.brightYellow}${C.bold}tutor feedback >${C.reset} ${tutorStubTurnFeedbackLabel(feedback)} · ${C.dim}private; send your learner reply whenever ready${C.reset}\n`,
    );
    const feedbackTargetTurn = findTutorStubFeedbackTargetTurn({
      feedback,
      turns: state.turns,
      opening: {
        turnId: openingDebugId(stateRunDebugId(state)),
        text: state.history.find((message) => message.role === 'assistant')?.content || '',
        provider: state.openingRealization?.provider || null,
        model: state.openingRealization?.model || null,
      },
    });
    const ratingRecord = buildTutorStubFeedbackRatingRecord({
      feedback,
      targetTurn: feedbackTargetTurn,
      provenance: {
        runId: stateRunDebugId(state),
        trace: state.trace?.filePath ? path.relative(ROOT, state.trace.filePath) : null,
        worldId: state.world?.id || null,
        learnerProfileId: state.learnerProfileId || null,
        interactionMode: state.interaction?.mode || 'learner',
        inputSource: source,
        trainingReuse: jsonClone(state.trainingReuse),
      },
    });
    appendTraceEvent(state.trace, {
      type: 'tutor_turn_feedback_selected',
      turn: feedback.targetTutorTurn,
      turnId: feedback.targetTutorTurnId,
      rating: feedback.rating,
      supplied: feedback.supplied,
      inputSource: source,
      publicTranscriptChanged: false,
    });
    if (ratingRecord) {
      state.turnFailureFeedbackRecords.push(ratingRecord);
      appendTraceEvent(state.trace, {
        type: 'tutor_feedback_rating_recorded',
        turn: feedback.targetTutorTurn,
        turnId: feedback.targetTutorTurnId,
        record: ratingRecord,
        publicTranscriptChanged: false,
      });
      appendTutorStubTurnFailureTraceRecords(state);
      const ratedPromptSnapshot =
        feedbackTargetTurn?.prompts?.tutor ||
        (feedback.targetKind === 'opening' ? state.openingRealization?.promptSnapshot || null : null);
      const replaySystemPrompt = ratedPromptSnapshot?.systemPrompt || state.systemPrompt;
      const replayMessageHistory = Array.isArray(ratedPromptSnapshot?.messageHistory)
        ? ratedPromptSnapshot.messageHistory
        : state.history.slice(0, -1).map((message) => ({ role: message.role, content: message.content }));
      const tuningCandidate = synthesizeTutorStubTuningCandidate(state.tuning, {
        rating: feedback.rating,
        reason: feedback.reason,
        comment: feedback.comment,
        observation: ratingRecord,
        publicMessages: replayMessageHistory,
        runId: stateRunDebugId(state),
        targetTurnId: feedback.targetTutorTurnId,
        systemPromptHash: hashCanonicalJson({ systemPrompt: replaySystemPrompt }),
        systemPrompt: replaySystemPrompt,
        speaker: {
          userPrompt: ratedPromptSnapshot?.userPrompt || '',
          modelRef: state.modelRef,
          provider: state.resolved.provider,
          model: state.resolved.model,
          temperature: state.temperature,
          maxTokens: state.maxTokens,
          effort: state.cliEffort,
        },
      });
      if (tuningCandidate) {
        appendTraceEvent(state.trace, {
          type: 'tutor_tuning_candidate_created',
          candidate: tuningCandidate,
          publicTranscriptChanged: false,
        });
        console.log(
          `${C.brightCyan}tuning candidate >${C.reset} ${tuningCandidate.id} · ${displayDiagnosticLabel(tuningCandidate.status)} · ${tuningCandidate.evidence.reasonLabel}`,
        );
        console.log(
          `${C.dim}  /tune review · raw comment retained as evidence, never inserted into the tutor prompt${C.reset}\n`,
        );
      }
    }
    return true;
  }

  function printTutorTuningStatus() {
    const snapshot = tutorStubTuningSnapshot(state.tuning);
    console.log(
      `${C.brightCyan}${C.bold}tutor tuning >${C.reset} ${snapshot.mode} · ${snapshot.activeRef} · stable v${snapshot.stableVersion}${snapshot.canaryVersion ? ` · canary v${snapshot.canaryVersion}` : ''}`,
    );
    console.log(
      `${C.dim}  ${snapshot.sessionFeedbackCount} feedback observation${snapshot.sessionFeedbackCount === 1 ? '' : 's'} this session · ${snapshot.sessionCandidateIds.length} candidate${snapshot.sessionCandidateIds.length === 1 ? '' : 's'} · ${snapshot.policyRuleCount} active learned rule${snapshot.policyRuleCount === 1 ? '' : 's'}${C.reset}`,
    );
    console.log(
      `${C.dim}  evidence store: ${path.relative(ROOT, snapshot.storeDir)} · /tune reasons · /tune review${C.reset}\n`,
    );
    return snapshot;
  }

  function handleTutorTuningCommand(argument = '') {
    clearStatusLine();
    const raw = String(argument || '').trim();
    const [actionRaw = 'status', id = '', value = '', ...rest] = raw.split(/\s+/u).filter(Boolean);
    const action = actionRaw.toLowerCase();
    try {
      if (action === 'status') {
        printTutorTuningStatus();
        return true;
      }
      if (action === 'on' || action === 'capture' || action === 'off' || action === 'canary') {
        const snapshot = setTutorStubTuningMode(state.tuning, action, { instance: state.tutorInstance });
        persistCurrentInteractiveSettings('tuning_mode_changed');
        appendTraceEvent(state.trace, {
          type: 'tutor_tuning_mode_changed',
          mode: snapshot.mode,
          activeRef: snapshot.activeRef,
          publicTranscriptChanged: false,
        });
        console.log(`${C.brightCyan}${C.bold}tutor tuning >${C.reset} ${snapshot.mode}`);
        console.log(
          `${C.dim}  ${snapshot.mode === 'capture' ? 'feedback is recorded as evidence, but no candidates are synthesized' : snapshot.enabled ? 'feedback is captured and typed candidates can be reviewed' : 'no tuning evidence or candidates will be written'}; the current tutor remains pinned to ${snapshot.activeRef}${C.reset}\n`,
        );
        return true;
      }
      if (action === 'reasons') {
        console.log(`${C.brightCyan}${C.bold}feedback reasons >${C.reset}`);
        for (const [reason, definition] of Object.entries(TUTOR_STUB_FEEDBACK_REASONS)) {
          console.log(`  ${reason.padEnd(24)} ${definition.label}`);
        }
        console.log(
          `${C.dim}  example: /down too_abstract Uses labels instead of the objects in the scene${C.reset}\n`,
        );
        return true;
      }
      if (action === 'note') {
        const text = [id, value, ...rest].filter(Boolean).join(' ');
        const note = recordTutorStubTuningNote(state.tuning, text, {
          runId: stateRunDebugId(state),
          turn: state.turns.length + 1,
        });
        appendTraceEvent(state.trace, { type: 'tutor_tuning_note', note, publicTranscriptChanged: false });
        console.log(`${C.brightCyan}${C.bold}tuning note >${C.reset} ${note.text}`);
        console.log(`${C.dim}  provisional in this session; it is not a promoted tutor rule${C.reset}\n`);
        return true;
      }
      if (action === 'review') {
        const candidates = listTutorStubTuningCandidates(state.tuning);
        console.log(`${C.brightCyan}${C.bold}tuning candidates >${C.reset} ${candidates.length}`);
        if (!candidates.length)
          console.log(`${C.dim}  none yet; use /tune on and add a reason to a thumbs-down${C.reset}`);
        for (const candidate of candidates.slice(-12)) {
          console.log(
            `  ${candidate.id} · ${displayDiagnosticLabel(candidate.status)} · ${candidate.evidence?.reasonLabel || 'manual review'}`,
          );
          console.log(`${C.dim}    ${candidate.proposal?.rule || candidate.proposal?.explanation || ''}${C.reset}`);
        }
        console.log();
        return true;
      }
      if (!id && action !== 'rollback') throw new Error(`/tune ${action} needs a candidate id`);
      if (action === 'show') {
        const candidate = readTutorStubTuningCandidate(state.tuning, id);
        console.log(JSON.stringify(candidate, null, 2));
        return true;
      }
      if (action === 'approve') {
        const result = approveTutorStubTuningCandidate(state.tuning, id);
        console.log(
          `${C.brightYellow}${C.bold}candidate approved >${C.reset} ${id} → canary ${state.tutorInstance.id}@v${result.version.version}`,
        );
        console.log(
          `${C.dim}  test with --tutor ${state.tutorInstance.id}@v${result.version.version} or --tuning canary; then /tune validate ${id} up|down${C.reset}\n`,
        );
        return true;
      }
      if (action === 'reject') {
        const candidate = rejectTutorStubTuningCandidate(state.tuning, id, [value, ...rest].join(' '));
        console.log(`${C.brightYellow}${C.bold}candidate rejected >${C.reset} ${candidate.id}\n`);
        return true;
      }
      if (action === 'replay') {
        const replayPath = tutorStubTuningReplayPath(state.tuning, id);
        console.log(`${C.brightCyan}${C.bold}frozen-prefix replay >${C.reset} ${path.relative(ROOT, replayPath)}`);
        console.log(
          `${C.dim}  exact public messages, tutor version, prompt hash, target turn, and candidate overlay are preserved${C.reset}\n`,
        );
        return true;
      }
      if (action === 'validate') {
        const candidate = validateTutorStubTuningCandidate(state.tuning, id, value, rest.join(' '));
        console.log(
          `${C.brightYellow}${C.bold}candidate validation >${C.reset} ${candidate.id} · ${candidate.validation.rating === 'up' ? 'helpful' : 'not helpful'}\n`,
        );
        return true;
      }
      if (action === 'promote') {
        const candidate = promoteTutorStubTuningCandidate(state.tuning, id);
        console.log(
          `${C.brightGreen}${C.bold}tutor promoted >${C.reset} ${state.tutorInstance.id}@v${candidate.promotedVersion} is now stable`,
        );
        console.log(
          `${C.dim}  this running dialogue stays pinned to ${state.tuning.activeRef}; the next run uses the promoted version${C.reset}\n`,
        );
        return true;
      }
      if (action === 'rollback') {
        const requested = id === 'previous' ? null : id;
        const result = rollbackTutorStubTutorVersion(state.tuning, requested);
        console.log(
          `${C.brightYellow}${C.bold}tutor rolled back >${C.reset} v${result.fromVersion} → v${result.toVersion}`,
        );
        console.log(
          `${C.dim}  this running dialogue remains pinned; the next run uses the restored stable version${C.reset}\n`,
        );
        return true;
      }
      throw new Error(
        'use /tune status|on|off|reasons|note|review|show|approve|reject|replay|validate|promote|rollback',
      );
    } catch (error) {
      console.log(`${C.red}tuning error:${C.reset} ${error.message}\n`);
      return true;
    }
  }

  function handleRandomPerformanceCommand(argument = '', { duringTurn = false } = {}) {
    clearStatusLine();
    const action = String(argument || '')
      .trim()
      .toLowerCase();
    if (!state.register?.enabled) {
      console.log(`${C.dim}random performance is unavailable because teaching-style selection is off${C.reset}`);
      console.log(`${C.dim}  start without --no-register-selection to use /random${C.reset}\n`);
      return true;
    }
    if (action && !['on', 'off', 'status'].includes(action)) {
      console.log(`${C.red}random error:${C.reset} use /random, /random on, /random off, or /random status\n`);
      return true;
    }
    const previous = state.randomPerformance?.enabled === true;
    const directedAxes = [
      explicitPerformanceDirectiveValue(state, 'register') ? 'style' : null,
      explicitPerformanceDirectiveValue(state, 'character') ? 'host character' : null,
    ].filter(Boolean);
    const randomAxes = ['style', 'host character'].filter((axis) => !directedAxes.includes(axis));
    if (action === 'status') {
      console.log(`${C.brightMagenta}${C.bold}random performance >${C.reset} ${previous ? 'on' : 'off'}`);
      console.log(
        `${C.dim}  ${
          previous
            ? randomAxes.length
              ? `${randomAxes.join(' and ')} ${randomAxes.length === 1 ? 'is' : 'are'} sampled without learner-assessment influence${directedAxes.length ? `; directed ${directedAxes.join(' and ')} remains locked` : ''}`
              : 'both performance axes are explicitly directed, so no random draw is currently active'
            : 'the configured adaptive teaching approach controls every axis that is not explicitly directed'
        }; evidence release, action choice, closure, and response safety remain active${C.reset}\n`,
      );
      return true;
    }
    const enabled = action === 'on' ? true : action === 'off' ? false : !previous;
    if (enabled === previous) {
      console.log(`${C.brightMagenta}${C.bold}random performance >${C.reset} already ${enabled ? 'on' : 'off'}\n`);
      return true;
    }
    state.randomPerformance = {
      schema: 'machinespirits.tutor-stub.random-performance-mode.v1',
      enabled,
      scope: ['engagement_stance', 'actorial_part'],
      assessmentInfluence: false,
      sessionOnly: true,
    };
    const turnInProgress = Boolean(duringTurn || processingTurn);
    const effectiveTurn = state.turns.length + 1;
    const invalidated = turnInProgress ? null : resetMixedLearnerSuggestion('random_performance_mode_changed');
    appendTraceEvent(state.trace, {
      type: 'random_performance_mode_changed',
      schema: 'machinespirits.tutor-stub.random-performance-mode-change.v1',
      previous,
      enabled,
      effectiveTurn,
      effectiveSelection: turnInProgress ? 'next_not_yet_completed_selection' : 'next_selection',
      duringTurn: turnInProgress,
      assessmentInfluence: {
        engagementStance: false,
        actorialPart: false,
        actionAndSafetyPipeline: true,
      },
      cacheRefresh: invalidated
        ? {
            priorStateCleared: Boolean(invalidated.hadState),
            analysisDiscarded: Boolean(invalidated.discardedAnalysis),
            tutorResponseDiscarded: Boolean(invalidated.discardedTutorResponse),
          }
        : { deferredUntilCurrentTurnCompletes: turnInProgress },
      publicTranscriptChanged: false,
    });
    console.log(`${C.brightMagenta}${C.bold}random performance >${C.reset} ${enabled ? 'on' : 'off'}`);
    console.log(
      `${C.dim}  ${
        enabled
          ? randomAxes.length
            ? `${randomAxes.join(' and ')} will change randomly without learner-assessment influence${directedAxes.length ? `; directed ${directedAxes.join(' and ')} remains locked` : ''}`
            : 'both performance axes are explicitly directed, so /random is armed but has no active axis'
          : directedAxes.length
            ? `directed ${directedAxes.join(' and ')} remains locked; every other performance axis returns to ${plainPolicyLabel(state.register?.policy)}`
            : `style and host character return to ${plainPolicyLabel(state.register?.policy)}`
      }; applies to the ${turnInProgress ? 'next teaching-style selection not already completed' : `next turn (${effectiveTurn})`}${C.reset}`,
    );
    console.log(
      `${C.dim}  evidence release, teaching action, dialogue closure, and response safety still use the normal harness${C.reset}`,
    );
    if (mixedLearner.enabled && !turnInProgress && latestTutorMessage(state)) {
      startMixedLearnerPrefetch('random_performance_mode_changed');
      console.log(`${C.dim}  rebuilding the learner suggestion and next tutor response${C.reset}`);
    }
    console.log();
    return true;
  }

  function handleLightAdaptationCommand(argument = '', { duringTurn = false } = {}) {
    clearStatusLine();
    const action = String(argument || '')
      .trim()
      .toLowerCase();
    if (!state.register?.enabled) {
      console.log(`${C.dim}light adaptation is unavailable because teaching-style selection is off${C.reset}`);
      console.log(`${C.dim}  start without --no-register-selection to use /light${C.reset}\n`);
      return true;
    }
    if (action && !['on', 'off', 'status'].includes(action)) {
      console.log(`${C.red}light error:${C.reset} use /light, /light on, /light off, or /light status\n`);
      return true;
    }
    const previous = state.lightAdaptation?.enabled === true;
    const threshold = state.lightAdaptation?.threshold ?? DEFAULT_TUTOR_STUB_LIGHT_ADAPTATION_THRESHOLD;
    if (action === 'status') {
      console.log(`${C.brightMagenta}${C.bold}light adaptation >${C.reset} ${previous ? 'on' : 'off'}`);
      console.log(
        `${C.dim}  after ${threshold} consecutive learner turns showing confusion or frustration, style and host character are sampled with seeded replayable draws and must differ from the previous pair when alternatives exist${C.reset}`,
      );
      console.log(
        `${C.dim}  this trigger outranks /register, /character, /random, and the deeper adaptive policy for those two axes only; authored evidence, teaching action, closure, and response safety remain active${C.reset}\n`,
      );
      return true;
    }
    const enabled = action === 'on' ? true : action === 'off' ? false : !previous;
    if (enabled === previous) {
      console.log(`${C.brightMagenta}${C.bold}light adaptation >${C.reset} already ${enabled ? 'on' : 'off'}\n`);
      return true;
    }
    state.lightAdaptation = {
      ...state.lightAdaptation,
      schema: TUTOR_STUB_LIGHT_ADAPTATION_SCHEMA,
      enabled,
      threshold,
      scope: ['engagement_stance', 'actorial_part'],
      trigger: 'continued_learner_confusion_or_frustration',
      selectionMethod: 'seeded_uniform_excluding_previous',
      rememberedPreference: true,
    };
    const turnInProgress = Boolean(duringTurn || processingTurn);
    const effectiveTurn = state.turns.length + 1;
    const invalidated = turnInProgress ? null : resetMixedLearnerSuggestion('light_adaptation_mode_changed');
    const remembered = persistCurrentInteractiveSettings('light_adaptation_mode_changed');
    appendTraceEvent(state.trace, {
      type: 'light_adaptation_mode_changed',
      schema: 'machinespirits.tutor-stub.light-adaptation-mode-change.v1',
      previous,
      enabled,
      threshold,
      effectiveTurn,
      effectiveSelection: turnInProgress ? 'next_not_yet_completed_selection' : 'next_selection',
      duringTurn: turnInProgress,
      publicTranscriptChanged: false,
      rememberedAt: remembered?.updatedAt || null,
      cacheRefresh: invalidated
        ? {
            priorStateCleared: Boolean(invalidated.hadState),
            analysisDiscarded: Boolean(invalidated.discardedAnalysis),
            tutorResponseDiscarded: Boolean(invalidated.discardedTutorResponse),
          }
        : { deferredUntilCurrentTurnCompletes: turnInProgress },
    });
    console.log(`${C.brightMagenta}${C.bold}light adaptation >${C.reset} ${enabled ? 'on' : 'off'}`);
    console.log(
      `${C.dim}  ${
        enabled
          ? `after ${threshold} consecutive confused/frustrated learner turns, the next style and host character shift stochastically`
          : `the configured ${plainPolicyLabel(state.register?.policy)} approach now controls adaptation without this unconditional shift`
      }; applies to the ${turnInProgress ? 'next teaching-style selection not already completed' : `next turn (${effectiveTurn})`}${C.reset}`,
    );
    console.log(
      `${C.dim}  seeded draws are replayable; authored evidence, teaching action, dialogue closure, and response safety stay in control${C.reset}`,
    );
    if (remembered) console.log(`${C.dim}  remembered as the default for the next interactive session${C.reset}`);
    if (mixedLearner.enabled && !turnInProgress && latestTutorMessage(state)) {
      startMixedLearnerPrefetch('light_adaptation_mode_changed');
      console.log(`${C.dim}  rebuilding the learner suggestion and next tutor response${C.reset}`);
    }
    console.log();
    return true;
  }

  function handleCommitteeCommand(argument = '', { duringTurn = false } = {}) {
    clearStatusLine();
    const action = String(argument || '')
      .trim()
      .toLowerCase();
    if (action && !['on', 'off', 'status'].includes(action)) {
      console.log(
        `${C.red}committee error:${C.reset} use /committee, /committee on, /committee off, or /committee status\n`,
      );
      return true;
    }
    const previous = state.committee?.enabled === true;
    if (action === 'status') {
      console.log(`${C.brightMagenta}${C.bold}learned committee >${C.reset} ${previous ? 'on' : 'off'}`);
      console.log(
        `${C.dim}  ${
          previous
            ? `${state.committee.miniModel} supplies a warrant question only when the detector finds a warrant gap; fallback ${state.committee.fallbackPolicy}`
            : 'the frontier tutor writes every response without the learned Qwen warrant specialist'
        } · /committee toggles${C.reset}\n`,
      );
      return true;
    }
    if (duringTurn || processingTurn) {
      console.log(`${C.dim}committee mode can change after the tutor response already in flight completes${C.reset}\n`);
      return true;
    }
    const enabled = action === 'on' ? true : action === 'off' ? false : !previous;
    if (enabled === previous) {
      console.log(`${C.brightMagenta}${C.bold}learned committee >${C.reset} already ${enabled ? 'on' : 'off'}\n`);
      return true;
    }
    state.committee.enabled = enabled;
    state.pointOfAction.enabled = enabled;
    state.pointOfAction.arm = enabled ? 'committee' : null;
    state.pointOfAction.current = null;
    args['point-of-action-arm'] = enabled ? 'committee' : '';
    const effectiveTurn = state.turns.length + 1;
    const invalidated = resetMixedLearnerSuggestion('committee_mode_changed');
    const remembered = persistCurrentInteractiveSettings('committee_mode_changed', { committeeEnabled: enabled });
    appendTraceEvent(state.trace, {
      type: 'committee_mode_changed',
      schema: 'machinespirits.tutor-stub.committee-mode-change.v1',
      previous,
      enabled,
      effectiveTurn,
      miniModel: state.committee.miniModel,
      fallbackPolicy: state.committee.fallbackPolicy,
      cacheRefresh: {
        priorStateCleared: Boolean(invalidated?.hadState),
        analysisDiscarded: Boolean(invalidated?.discardedAnalysis),
        tutorResponseDiscarded: Boolean(invalidated?.discardedTutorResponse),
      },
      remembered: Boolean(remembered),
      publicTranscriptChanged: false,
    });
    console.log(`${C.brightMagenta}${C.bold}learned committee >${C.reset} ${enabled ? 'on' : 'off'}`);
    console.log(
      `${C.dim}  ${
        enabled
          ? `${state.committee.miniModel} will supply warrant-gap questions; the frontier composes around them and fallback ${state.committee.fallbackPolicy} remains fail-closed`
          : 'the frontier tutor will write every response without the learned Qwen specialist'
      }; applies from turn ${effectiveTurn}${remembered ? ' · remembered for next time' : ' · this session only'}${C.reset}`,
    );
    if (mixedLearner.enabled && latestTutorMessage(state)) {
      startMixedLearnerPrefetch('committee_mode_changed');
      console.log(`${C.dim}  rebuilding the learner suggestion and next tutor response${C.reset}`);
    }
    console.log();
    return true;
  }

  function tutorCharacterDisplayLabel(characterId, definitions = getActorialPartDefinitions()) {
    if (!characterId) return 'Automatic';
    const label = definitions[characterId]?.label || displayDiagnosticLabel(characterId);
    return String(label || '').replace(/^./u, (character) => character.toUpperCase());
  }

  function tutorCharacterPlainEffect(characterId) {
    return (
      {
        scene_partner: 'work through the problem alongside you',
        examiner: 'ask you to inspect and test the evidence',
        record_keeper: 'organize the shared record and keep its distinctions clear',
        advocate: 'present the strongest version of the live case',
        skeptic: 'test claims before accepting them',
        satirist: 'spot polished contradictions and expose them through irony or dry sarcasm',
        adversarial_teacher: 'actively test your ideas with subject-based counterexamples or alternatives',
        exacting_schoolmaster: 'ask for one precise, subject-appropriate piece of work',
      }[characterId] || 'use the selected character'
    );
  }

  function handleExplicitPerformanceDirectiveCommand(
    axis,
    argument = '',
    { duringTurn = false, deferMixedPrefetch = false } = {},
  ) {
    clearStatusLine();
    const command = axis === 'register' ? '/register' : '/character';
    const publicAxis = axis === 'register' ? 'teaching style' : 'tutor character';
    if (!state.register?.enabled) {
      console.log(`${C.dim}${publicAxis} direction is unavailable because teaching-style selection is off${C.reset}`);
      console.log(`${C.dim}  start without --no-register-selection to use ${command}${C.reset}\n`);
      return true;
    }

    if (axis === 'register' && !String(argument || '').trim() && liveSettingsPickerAvailable() && !duringTurn) {
      console.log(
        `${C.brightMagenta}${C.bold}Tutor register · choose how the voice sounds with ↑/↓ and Enter${C.reset}`,
      );
      return pickLiveTutorRegisterWithKeyboard(explicitPerformanceDirectiveValue(state, 'register') || 'auto').then(
        (selection) => {
          if (!selection) return { suppressReprise: true, selected: false };
          return Promise.resolve(
            handleExplicitPerformanceDirectiveCommand('register', selection.id, { duringTurn: false }),
          ).then((outcome) => ({
            ...(outcome && typeof outcome === 'object' ? outcome : {}),
            suppressReprise: true,
            selected: true,
            value: selection.id,
          }));
        },
      );
    }

    const rawAction = String(argument || '')
      .trim()
      .toLowerCase();
    const normalizedAction = rawAction.replace(/[\s-]+/gu, '_');
    const current = explicitPerformanceDirectiveValue(state, axis);
    const characterChoice = resolveTutorStubCharacterChoice(rawAction);
    const definitions = characterChoice.definitions;
    const characterOptions = characterChoice.options;
    const resolvedRegister = resolveEngagementStance(normalizedAction)?.register || normalizedAction;
    const requestedValue = axis === 'register' ? resolvedRegister : characterChoice.id;
    const options = axis === 'register' ? humanDirectedRegisterPalette() : characterOptions;

    if (!rawAction || rawAction === 'status') {
      console.log(`${C.brightMagenta}${C.bold}${publicAxis} direction >${C.reset} ${current || 'auto'}`);
      if (axis === 'register') {
        for (const option of options) {
          const definition = getEngagementStanceDefinition(option) || {};
          const group = definition.simulated_only
            ? 'simulated-only'
            : definition.router_selectable
              ? 'adaptive-core'
              : 'full-range';
          console.log(
            `${C.dim}  ${option.padEnd(13)} [${group}] ${oneLine(
              definition.public_signature || definition.stance_contract,
              { max: 120 },
            )}${C.reset}`,
          );
        }
        console.log(`${C.dim}  register changes how the tutor sounds; character changes what it does${C.reset}`);
      } else {
        for (const option of options) {
          console.log(
            `${C.dim}  ${option.padEnd(15)} ${definitions[option]?.label || displayDiagnosticLabel(option)}${C.reset}`,
          );
        }
      }
      console.log(
        `${C.dim}  ${command} <choice> locks this axis · ${command} auto returns it to ${state.randomPerformance?.enabled ? '/random or ' : ''}the adaptive teaching approach${C.reset}\n`,
      );
      return true;
    }

    const clearing = EXPLICIT_PERFORMANCE_CLEAR_WORDS.has(rawAction);
    if (axis === 'register' && !clearing && getEngagementStanceDefinition(requestedValue)?.simulated_only === true) {
      console.log(
        `${C.red}${publicAxis} error:${C.reset} ${requestedValue} is a simulated-only evaluation condition and cannot be used in an interactive learner session\n`,
      );
      return true;
    }
    if (!clearing && !options.includes(requestedValue)) {
      console.log(`${C.red}${publicAxis} error:${C.reset} choose ${options.join(', ')}, or use ${command} auto\n`);
      return true;
    }
    const next = clearing ? null : requestedValue;
    if (next === current) {
      const displayValue = axis === 'character' ? tutorCharacterDisplayLabel(next, definitions) : next || 'auto';
      console.log(`${C.brightMagenta}${C.bold}${publicAxis} >${C.reset} already ${displayValue}\n`);
      return true;
    }

    state.performanceDirectives = {
      ...state.performanceDirectives,
      schema: 'machinespirits.tutor-stub.explicit-performance-directives.v1',
      [axis]: next,
      sessionOnly: true,
      precedence: 'explicit_axis_then_random_axis_then_adaptive_policy',
    };
    const turnInProgress = Boolean(duringTurn || processingTurn);
    const effectiveTurn = state.turns.length + 1;
    const reason = `explicit_${axis}_directive_changed`;
    const invalidated = turnInProgress ? null : resetMixedLearnerSuggestion(reason);
    appendTraceEvent(state.trace, {
      type: 'explicit_performance_directive_changed',
      schema: 'machinespirits.tutor-stub.explicit-performance-directive-change.v1',
      axis: axis === 'register' ? 'engagement_stance' : 'actorial_part',
      previous: current,
      value: next,
      effectiveTurn,
      effectiveSelection: turnInProgress ? 'next_not_yet_completed_selection' : 'next_selection',
      duringTurn: turnInProgress,
      randomPerformanceEnabled: state.randomPerformance?.enabled === true,
      precedence: 'explicit_axis_then_random_axis_then_adaptive_policy',
      assessmentInfluence: false,
      cacheRefresh: invalidated
        ? {
            priorStateCleared: Boolean(invalidated.hadState),
            analysisDiscarded: Boolean(invalidated.discardedAnalysis),
            tutorResponseDiscarded: Boolean(invalidated.discardedTutorResponse),
          }
        : { deferredUntilCurrentTurnCompletes: turnInProgress },
      publicTranscriptChanged: false,
    });

    if (axis === 'character') {
      console.log(
        `${C.brightMagenta}${C.bold}tutor character >${C.reset} ${tutorCharacterDisplayLabel(next, definitions)}`,
      );
      if (next) {
        console.log(`${C.dim}  Tutor replies will ${tutorCharacterPlainEffect(next)}.${C.reset}`);
        const defaultStances = getActorialPartDefinitions()[next]?.default_engagement_stances || [];
        if (defaultStances.length) {
          console.log(
            `${C.dim}  When /register is automatic, this character defaults to ${defaultStances.join(
              ' or ',
            )}; an explicit /register choice still wins.${C.reset}`,
          );
        }
        console.log(`${C.dim}  Clue-givers and the closing scene may temporarily use another character.${C.reset}`);
        console.log(`${C.dim}  Choose Tutor → Auto, or type /tutor auto, to return to adaptive selection.${C.reset}`);
      } else {
        console.log(
          `${C.dim}  The tutor can now choose its character ${
            state.randomPerformance?.enabled ? 'through random variation' : 'as the conversation changes'
          }.${C.reset}`,
        );
      }
      if (turnInProgress) {
        console.log(`${C.dim}  This starts after the current tutor reply.${C.reset}`);
      }
    } else {
      console.log(`${C.brightMagenta}${C.bold}${publicAxis} direction >${C.reset} ${next || 'auto'}`);
      const definition = next ? getEngagementStanceDefinition(next) : null;
      if (definition?.public_signature) {
        console.log(
          `${C.dim}  Tutor replies will sound distinct in this way: ${oneLine(definition.public_signature)}${C.reset}`,
        );
      }
      if (definition?.router_selectable === false) {
        console.log(
          `${C.dim}  This is a full-range ${definition.valence || 'dramatic'} register; conservative --safe-registers routing omits it, while full-range policies and /random may choose it.${C.reset}`,
        );
      }
      console.log(
        `${C.dim}  ${
          next
            ? `${publicAxis} is locked for subsequent tutor turns`
            : `${publicAxis} returns to ${state.randomPerformance?.enabled ? 'the /random draw' : plainPolicyLabel(state.register?.policy)}`
        }; applies to the ${turnInProgress ? 'next selection not already completed' : `next turn (${effectiveTurn})`}${C.reset}`,
      );
      console.log(
        `${C.dim}  the tutor character still follows its own command, /random, or the adaptive policy; evidence, closure, and response safety remain active${C.reset}`,
      );
    }
    if (mixedLearner.enabled && !turnInProgress && latestTutorMessage(state) && !deferMixedPrefetch) {
      startMixedLearnerPrefetch(reason);
      console.log(`${C.dim}  rebuilding the learner suggestion and next tutor response${C.reset}`);
    }
    console.log();
    return {
      handled: true,
      changed: true,
      axis,
      previous: current,
      value: next,
      reason,
      turnInProgress,
      mixedPrefetchDeferred: Boolean(deferMixedPrefetch && mixedLearner.enabled && !turnInProgress),
    };
  }

  function deterministicTutorCharacterRestatement(previousText, characterId) {
    const lead =
      {
        scene_partner: 'Let us take the same point together:',
        examiner: 'Inspect the same point directly:',
        record_keeper: 'Enter the same point this way:',
        advocate: 'Here is the strongest form of the same case:',
        skeptic: 'Test the same point before accepting it:',
        adversarial_teacher: 'Challenge the same idea within the subject itself:',
        exacting_schoolmaster: 'Show the same required learning step precisely:',
      }[characterId] || 'Put the same point another way:';
    return cleanTutorStubCharacterRestatement(`${lead} ${String(previousText || '').trim()}`);
  }

  function applyTutorCharacterRestatementToState({ previousText, text, record }) {
    const historyIndex = [...(state.history || [])]
      .map((message, index) => ({ message, index }))
      .reverse()
      .find(({ message }) => message.role === 'assistant')?.index;
    if (!Number.isInteger(historyIndex)) return null;
    state.history[historyIndex] = { ...state.history[historyIndex], content: text };

    const lastTurn = state.turns.at(-1);
    let targetKind = 'opening';
    let targetTurn = 0;
    let targetTurnId = openingDebugId(stateRunDebugId(state));
    if (lastTurn?.tutor === previousText) {
      targetKind = 'tutor_response';
      targetTurn = lastTurn.turn;
      targetTurnId = lastTurn.turnId || turnDebugId(state, lastTurn.turn);
      lastTurn.tutorOriginal = lastTurn.tutorOriginal || previousText;
      lastTurn.tutor = text;
      lastTurn.characterRestatements = [...(lastTurn.characterRestatements || []), jsonClone(record)];
    } else if (state.openingRealization) {
      state.openingRealization = {
        ...state.openingRealization,
        originalText: state.openingRealization.originalText || previousText,
        text,
        characterRestatements: [...(state.openingRealization.characterRestatements || []), jsonClone(record)],
      };
    }
    return { targetKind, targetTurn, targetTurnId, historyIndex };
  }

  async function restateLatestTutorForCharacter(characterId, { source = '/character tutor' } = {}) {
    const previousText = String(latestTutorMessage(state) || '').trim();
    if (!previousText || !characterId || exiting) return { suppressReprise: false, restated: false };
    const definitions = getActorialPartDefinitions();
    const definition = definitions[characterId] || {};
    const lastTurn = state.turns.at(-1);
    const tutorTurn = lastTurn?.tutor === previousText ? Number(lastTurn.turn) || state.turns.length : 0;
    const learnerText = lastTurn?.tutor === previousText ? lastTurn.learner || '' : '';
    const permittedText = (state.history || []).map((message) => message.content).join('\n');
    const prompt = buildTutorStubCharacterRestatementPrompt({
      previousText,
      characterId,
      characterLabel: definition.label,
      characterContract: definition.contract,
      publicWorld: publicWorldSummary(state.world),
    });
    appendTraceEvent(state.trace, {
      type: 'tutor_character_restatement_started',
      schema: TUTOR_STUB_CHARACTER_RESTATEMENT_SCHEMA,
      source,
      turn: tutorTurn,
      characterId,
      previousText,
      publicTranscriptChanged: false,
    });

    let response = null;
    let candidate = '';
    let generationError = null;
    startInterimAnimation(state, 'rephrasing tutor', { tutorTurn });
    try {
      response = await callPromptModel({
        prompt,
        resolved: state.resolved,
        systemPrompt: TUTOR_STUB_CHARACTER_RESTATEMENT_SYSTEM_PROMPT,
        role: 'tutor_stub_character_clarifier',
        maxTokens: Math.min(Number(state.maxTokens) || 420, 420),
        trace: state.trace,
        stream: { enabled: false },
        cliEffort: state.cliEffort,
        turn: tutorTurn,
      });
      candidate = cleanTutorStubCharacterRestatement(response.text);
    } catch (error) {
      generationError = error;
    } finally {
      stopInterimAnimation(state);
    }

    let restatementAudit = auditTutorStubCharacterRestatement({
      previousText,
      text: candidate,
      characterId,
      permittedText,
    });
    let leakAudit =
      candidate && state.dag && state.world
        ? auditTutorResponseLeak({
            text: candidate,
            world: state.world,
            tutorTurn,
            learnerText,
            state,
          })
        : { ok: true, leaks: [] };
    let deterministicFallback = false;
    if (generationError || !candidate || !restatementAudit.ok || !leakAudit.ok) {
      deterministicFallback = true;
      candidate = deterministicTutorCharacterRestatement(previousText, characterId);
      restatementAudit = auditTutorStubCharacterRestatement({
        previousText,
        text: candidate,
        characterId,
        permittedText,
      });
      leakAudit =
        state.dag && state.world
          ? auditTutorResponseLeak({
              text: candidate,
              world: state.world,
              tutorTurn,
              learnerText,
              state,
            })
          : { ok: true, leaks: [] };
    }

    const record = {
      schema: TUTOR_STUB_CHARACTER_RESTATEMENT_SCHEMA,
      source,
      characterId,
      characterLabel: definition.label || displayDiagnosticLabel(characterId),
      previousText,
      text: candidate,
      deterministicFallback,
      generationError: generationError?.message || null,
      provider: response?.provider || (deterministicFallback ? 'harness' : null),
      model: response?.model || (deterministicFallback ? 'deterministic-character-restatement-v1' : null),
      latencyMs: response?.latencyMs || 0,
      usage: response?.usage || null,
      promptSnapshot: response?.promptSnapshot || null,
      audit: {
        ...restatementAudit,
        leakAudit,
        ok: restatementAudit.ok && leakAudit.ok,
      },
    };
    const target = applyTutorCharacterRestatementToState({ previousText, text: candidate, record });
    appendTraceEvent(state.trace, {
      type: 'tutor_character_restatement_completed',
      ...record,
      target,
      publicTranscriptChanged: true,
      transcriptOperation: 'replace_latest_tutor_utterance',
    });
    sessionRuntime.sync('tutor_character_restatement_completed');
    clearStatusLine();
    console.log(`${C.brightMagenta}${C.bold}tutor ↻ >${C.reset} ${candidate}\n`);
    publishAcceptedTutorToVoice({
      text: candidate,
      turn: target?.targetTurn ?? tutorTurn,
      turnId: target?.targetTurnId || null,
      reason: 'accepted_tutor_character_restatement',
    });
    printTutorFeedbackRequest(latestTutorFeedbackTarget());
    if (mixedLearner.enabled && latestTutorMessage(state)) {
      startMixedLearnerPrefetch('explicit_character_directive_changed');
      console.log(
        `${C.dim}  rebuilding the learner suggestion and next tutor response from this restatement${C.reset}\n`,
      );
    }
    return { suppressReprise: true, restated: true, record, target };
  }

  function applyTutorCharacterChoice(argument, { duringTurn = false, source = '/character tutor' } = {}) {
    const previous = explicitPerformanceDirectiveValue(state, 'character');
    const canRestate = Boolean(!duringTurn && !processingTurn && latestTutorMessage(state));
    const result = handleExplicitPerformanceDirectiveCommand('character', argument, {
      duringTurn,
      deferMixedPrefetch: canRestate,
    });
    const current = explicitPerformanceDirectiveValue(state, 'character');
    if (current !== previous && current && canRestate) {
      return restateLatestTutorForCharacter(current, { source });
    }
    return result;
  }

  function handleCharacterCommand(argument = '', { duringTurn = false } = {}) {
    const requested = String(argument || '').trim();
    const [target = '', ...rest] = requested.split(/\s+/u);
    const normalizedTarget = target.toLowerCase();
    const targetArgument = rest.join(' ');

    if (!requested && liveSettingsPickerAvailable() && !duringTurn) {
      clearStatusLine();
      return pickLiveCharacterTargetWithKeyboard().then((selection) => {
        if (!selection) return { suppressReprise: true, selected: false };
        return Promise.resolve(handleCharacterCommand(selection.id, { duringTurn: false })).then((outcome) => ({
          ...(outcome && typeof outcome === 'object' ? outcome : {}),
          suppressReprise: true,
          selected: outcome?.selected !== false,
          target: outcome?.target || selection.id,
        }));
      });
    }
    if (!requested || normalizedTarget === 'status') {
      clearStatusLine();
      const learnerCharacter = mixedLearner.enabled
        ? mixedLearner.profileId || 'custom'
        : state.autoLearner?.enabled
          ? state.autoLearner.profileId || 'custom'
          : 'human learner';
      const tutorCharacter = state.register?.enabled
        ? explicitPerformanceDirectiveValue(state, 'character') || 'auto'
        : 'adaptive delivery off';
      console.log(`${C.brightMagenta}${C.bold}character controls >${C.reset}`);
      console.log(`${C.cyan}  learner character >${C.reset} ${learnerCharacter}`);
      console.log(`${C.brightMagenta}  tutor character >${C.reset} ${tutorCharacter}`);
      console.log(
        `${C.dim}  /learner [profile] · /tutor [part] · full /character learner|tutor forms and legacy /profile still work${C.reset}\n`,
      );
      return !requested ? { handled: true, suppressReprise: true } : true;
    }
    if (normalizedTarget === 'learner') {
      if (!targetArgument && mixedLearner.enabled && liveSettingsPickerAvailable() && !duringTurn) {
        clearStatusLine();
        console.log(`${C.cyan}${C.bold}Learner character · choose with ↑/↓ and Enter${C.reset}`);
        return pickInitialMixedLearnerProfileWithKeyboard(mixedLearner.profileId || 'custom').then((selection) => {
          if (!selection) return { suppressReprise: true, selected: false };
          const requestedProfile = selection.id ? selection.id : `custom ${mixedLearner.profile}`;
          handleMixedLearnerProfileCommand(requestedProfile, { duringTurn: false });
          return { suppressReprise: true, selected: true, target: 'learner', value: selection.id || 'custom' };
        });
      }
      handleMixedLearnerProfileCommand(targetArgument, { duringTurn });
      return true;
    }
    if (normalizedTarget === 'tutor') {
      if (!targetArgument && liveSettingsPickerAvailable() && !duringTurn) {
        clearStatusLine();
        console.log(`${C.brightMagenta}${C.bold}Tutor character · choose with ↑/↓ and Enter${C.reset}`);
        return pickLiveTutorCharacterWithKeyboard(explicitPerformanceDirectiveValue(state, 'character') || 'auto').then(
          (selection) => {
            if (!selection) return { suppressReprise: true, selected: false };
            return Promise.resolve(
              applyTutorCharacterChoice(selection.id, {
                duringTurn: false,
                source: '/character tutor selector',
              }),
            ).then((outcome) => ({
              ...(outcome && typeof outcome === 'object' ? outcome : {}),
              suppressReprise: true,
              selected: true,
              target: 'tutor',
              value: selection.id,
            }));
          },
        );
      }
      return applyTutorCharacterChoice(targetArgument, { duringTurn });
    }
    return applyTutorCharacterChoice(requested, { duringTurn, source: '/character legacy' });
  }

  const commandRuntime = createTutorStubCommandRuntime({
    C,
    DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD,
    DEFAULT_TUTOR_STUB_RELEASE_SPEED,
    STUB,
    TUTOR_STUB_CLI_MOTION_IDS,
    TUTOR_STUB_CLI_THEME_IDS,
    TUTOR_STUB_REGISTER_OVERLAY_POLICIES,
    TUTOR_STUB_REGISTER_POLICY_COMPOSITION_SCHEMA,
    acceptMixedLearnerSuggestion,
    answerCliDirectorQuestion,
    appendTraceEvent,
    applyAllRoleModelSelection,
    applyRoleModelSelection,
    applyTutorModelSelection,
    args,
    chooseAnotherScenario,
    chooseLiveNumericSetting,
    chooseLiveRoleModel,
    chooseLiveTutorModel,
    chooseWorkplanModule,
    clearStatusLine,
    collectGitActivity,
    collectGitHubMetrics,
    collectSourceMetrics,
    concurrentTerminal,
    configureCliPresentation,
    discardPendingInteractiveAuto,
    finalizeInteractive,
    forgetRememberedInteractiveSettings,
    formatTutorStubLabList,
    getCliPresentation: () => cliPresentation,
    getTutorStubLab,
    handleCharacterCommand,
    handleCommitteeCommand,
    handleCurriculumModuleCommand,
    handleCurriculumNextCommand,
    handleDirectorGuidanceCommand,
    handleExplicitPerformanceDirectiveCommand,
    handleLightAdaptationCommand,
    handleMixedLearnerProfileCommand,
    handleProofDagCommand,
    handleRandomPerformanceCommand,
    handleResponseDetailsCommand,
    handleTrainingReuseSetting,
    handleTutorFeedbackCommand,
    handleTutorTuningCommand,
    handleVoiceCommand,
    isAwaitingAnotherScenario: () => awaitingAnotherScenario,
    latestTutorMessage,
    liveModelRoleDefinitions,
    liveSettingsPickerAvailable,
    mixedLearner,
    mixedLearnerPromptText,
    normalizeTutorStubCliMotion,
    normalizeTutorStubCliThemeId,
    normalizeTutorStubDagFactDropoutRate,
    normalizeTutorStubEngagementStanceTemperature,
    normalizeTutorStubRegisterOverlayThreshold,
    normalizeTutorStubReleaseSpeed,
    openLiveSettingsPanel,
    parseTutorStubRegisterPolicyStack,
    pauseInterimAnimation,
    persistCurrentInteractiveSettings,
    pickInitialTutorModelWithKeyboard,
    plainPolicyLabel,
    printCurrentDebugId,
    printCurrentTurnAnalysis,
    printCurriculumProgress,
    printDialogueCloseout,
    printDialogueSettings,
    printDirectorNotesIssuedSoFar,
    printExplanatoryDebugTurn,
    printFieldVisualization,
    printInteractionModeBanner,
    printInteractiveHelp,
    printInteractiveStatus,
    printLightweightDialogueField,
    printModelChoices,
    printTrainingReuseStatus,
    printTutorModelChoices,
    printTutorStubFeatureMap,
    printTutorStubReleaseNotes,
    queueCoachGuidance,
    registerTemperature,
    registerTemperatureApplies,
    renderReport,
    repriseLatestTutorUtterance,
    requestExit,
    resetInteractiveDialogue,
    resetMixedLearnerSuggestion,
    resumeInterimAnimation,
    rl,
    runClarificationCommand,
    runCurriculumTranslationCommand,
    runInteractiveAutoMode,
    runInteractiveDemo,
    setInteractionMode,
    setTutorStubReleaseSpeed,
    showMixedLearnerClue,
    showMixedLearnerSuggestion,
    startMixedLearnerPrefetch,
    state,
    stopInterimAnimation,
    stopVoiceBridge,
    tutorStubCliPresentationSnapshot,
    tutorStubCliThemeOptions,
    tutorStubCliThemePreview,
    tutorStubPublicMessagesForSpeaker,
    tutorStubRegisterPolicyStackId,
    writeCurrentTranscriptHtml,
  });

  function executeSlashCommand(...parameters) {
    return commandRuntime.executeSlashCommand(...parameters);
  }

  function handleSlashCommand(trimmed, { duringTurn = false } = {}) {
    if (
      !String(trimmed || '')
        .trim()
        .startsWith('/')
    )
      return false;
    return sessionRuntime.step(trimmed, { kind: 'command', context: { duringTurn } });
  }

  function humanLearnerResponseProvenance(source = 'terminal') {
    return createTutorStubLearnerResponseProvenance({
      authorship: 'human',
      origin: source === 'voice' ? 'human_voice' : 'human_direct',
      inputMethod: source === 'voice' ? 'voice_transcription' : 'terminal',
      humanInLoop: true,
    });
  }

  function mixedDraftLearnerResponseProvenance(insertion, submittedText) {
    if (!insertion?.suggestion) return null;
    const suggestion = insertion.suggestion;
    const acceptedUnchanged = String(submittedText || '').trim() === String(suggestion.text || '').trim();
    return createTutorStubLearnerResponseProvenance({
      authorship: acceptedUnchanged ? 'ai' : 'hybrid',
      origin: acceptedUnchanged ? 'mixed_suggestion_accepted' : 'mixed_suggestion_edited',
      inputMethod: acceptedUnchanged ? 'tab_completion' : 'tab_completion_then_edit',
      humanInLoop: true,
      modelRef: state.autoLearner?.modelRef || null,
      provider: suggestion.provider || mixedLearner.resolved?.provider || null,
      model: suggestion.model || mixedLearner.resolved?.model || null,
      learnerProfileId: suggestion.profileId || mixedLearner.profileId || null,
      suggestion: {
        requestId: suggestion.requestId,
        turn: suggestion.turn,
        turnId: suggestion.turnId,
        acceptedUnchanged,
        edited: !acceptedUnchanged,
      },
    });
  }

  function compoundLearnerInput(active, revision = active.revision) {
    const messages = active.fragments.map((fragment, index) => ({
      index: index + 1,
      text: fragment.text,
      receivedAt: fragment.receivedAt,
      provenance: jsonClone(fragment.provenance),
      tutorFeedback: jsonClone(active.tutorFeedback),
    }));
    const provenance = aggregateTutorStubLearnerResponseProvenance(messages.map((message) => message.provenance));
    return {
      schema: 'machinespirits.tutor-stub.compound-learner-turn.v1',
      compoundTurnId: active.id,
      turn: active.turn,
      turnId: active.turnId,
      revision,
      messageCount: messages.length,
      messages,
      tutorFeedback: jsonClone(active.tutorFeedback),
      combinedText: messages.map((message) => message.text).join('\n'),
      coalescedBeforeTutorReply: messages.length > 1,
      provenance,
    };
  }

  function extendActiveLearnerTurn(text, provenance = humanLearnerResponseProvenance()) {
    const active = activeLearnerTurn;
    if (!active || active.responseDisplayed || active.committed) return false;
    const previousRevision = active.revision;
    const receivedAt = new Date().toISOString();
    active.fragments.push({ text, receivedAt, provenance: jsonClone(provenance) });
    active.revision += 1;
    resetMixedLearnerSuggestion('learner_turn_extended');
    appendTraceEvent(state.trace, {
      type: 'learner_turn_fragment_received',
      schema: 'machinespirits.tutor-stub.compound-learner-turn.v1',
      turn: active.turn,
      turnId: active.turnId,
      compoundTurnId: active.id,
      fragmentIndex: active.fragments.length,
      revision: active.revision,
      text,
      receivedAt,
      learnerResponseProvenance: jsonClone(provenance),
      tutorFeedback: jsonClone(active.tutorFeedback),
      whileTutorPending: true,
      publicTranscriptStatus: 'pending_compound_turn',
    });
    appendTraceEvent(state.trace, {
      type: 'learner_turn_attempt_superseded',
      turn: active.turn,
      turnId: active.turnId,
      compoundTurnId: active.id,
      previousRevision,
      revision: active.revision,
      messageCount: active.fragments.length,
      reason: 'additional_learner_message_before_tutor_reply',
    });
    active.abortController?.abort();
    console.log(
      `${C.cyan}learner turn updated >${C.reset} added message ${active.fragments.length}; restarting the tutor with all ${active.fragments.length} messages`,
    );
    console.log(`${C.dim}  the messages stay separate in the trace and count as one learner turn${C.reset}\n`);
    return true;
  }

  async function processLearnerLine(
    initialText,
    provenance = humanLearnerResponseProvenance(),
    { throwOnError = false } = {},
  ) {
    if (exiting) return;
    if (state.dialogueClosure?.phase === 'closed') {
      offerAnotherScenario('dialogue_grounded_closure');
      return;
    }

    const tutorTurn = state.turns.length + 1;
    const turnId = turnDebugId(state, tutorTurn);
    const active = {
      id: `${turnId}:learner`,
      turn: tutorTurn,
      turnId,
      revision: 1,
      fragments: [{ text: initialText, receivedAt: new Date().toISOString(), provenance: jsonClone(provenance) }],
      tutorFeedback: tutorStubTurnFeedbackEnvelope(state.turnFeedback),
      abortController: null,
      responseDisplayed: false,
      committed: false,
    };
    activeLearnerTurn = active;
    processingTurn = true;
    let completedTurn = false;
    let committedTurn = null;
    appendTraceEvent(state.trace, {
      type: 'learner_turn_fragment_received',
      schema: 'machinespirits.tutor-stub.compound-learner-turn.v1',
      turn: tutorTurn,
      turnId,
      compoundTurnId: active.id,
      fragmentIndex: 1,
      revision: 1,
      text: initialText,
      receivedAt: active.fragments[0].receivedAt,
      learnerResponseProvenance: jsonClone(provenance),
      tutorFeedback: jsonClone(active.tutorFeedback),
      whileTutorPending: false,
      publicTranscriptStatus: 'pending_compound_turn',
    });

    try {
      while (!exiting && !completedTurn && activeLearnerTurn === active) {
        const learnerInput = compoundLearnerInput(active);
        const revision = learnerInput.revision;
        const learnerText = learnerInput.combinedText;
        const abortController = new AbortController();
        active.abortController = abortController;
        const isCurrent = () =>
          !exiting && activeLearnerTurn === active && active.revision === revision && !abortController.signal.aborted;
        const attemptState = cloneStateForInteractiveLearnerAttempt();
        const baseline = {
          comprehension: structuredClone(state.comprehension),
          directorGuidance: structuredClone(state.directorGuidance),
          coach: structuredClone(state.coach),
        };
        const startedAtMs = Date.now();
        const turnTiming = {
          startedAtMs,
          analysisStartedAtMs: startedAtMs,
          analysisCompletedAtMs: startedAtMs,
          tutorStartedAtMs: startedAtMs,
          analysisSource: 'disabled',
          tutorSource: 'foreground',
        };
        appendTraceEvent(state.trace, {
          type: 'learner_turn_attempt_started',
          turn: tutorTurn,
          turnId,
          compoundTurnId: active.id,
          revision,
          messageCount: learnerInput.messageCount,
          messages: learnerInput.messages,
          learnerResponseProvenance: learnerInput.provenance,
        });

        try {
          const closureAcknowledgement = Boolean(
            attemptState.dialogueClosure?.phase === 'awaiting_checkin' && tutorStubClosureAcknowledgement(learnerText),
          );
          if (!closureAcknowledgement && !attemptState.passthrough?.enabled) {
            turnTiming.analysisStartedAtMs = Date.now();
          }
          const prefetchedAnalysis =
            closureAcknowledgement || attemptState.passthrough?.enabled
              ? null
              : await takeMixedLearnerAnalysisPrefetch(learnerText, learnerInput.tutorFeedback);
          assertTutorStubTurnAttemptCurrent({ signal: abortController.signal, isCurrent });
          resetMixedLearnerSuggestion('learner_turn_started', {
            preserveAnalysisCache: Boolean(prefetchedAnalysis?.entry),
          });

          let response;
          let completionReason = 'turn_complete';
          if (attemptState.passthrough?.enabled) {
            turnTiming.tutorStartedAtMs = Date.now();
            startInterimAnimation(attemptState, 'calling speaker', { learnerText, tutorTurn });
            try {
              response = await runOneTurn(learnerText, attemptState, null, null, null, null, null, {
                signal: abortController.signal,
                isCurrent,
                learnerInput,
                turnTiming,
              });
            } finally {
              stopInterimAnimation(attemptState);
            }
            completionReason = 'passthrough_turn_complete';
          } else if (closureAcknowledgement) {
            turnTiming.analysisSource = 'deterministic';
            turnTiming.analysisCompletedAtMs = Date.now();
            turnTiming.tutorStartedAtMs = Date.now();
            turnTiming.tutorSource = 'deterministic';
            const inheritedModel = attemptState.turns.at(-1)?.tutorLearnerDagModel || null;
            const tutorLearnerDag = { model: inheritedModel };
            const { frame } = tutorDialogueClosureFrameForTurn({
              state: attemptState,
              tutorTurn,
              tutorLearnerDag,
            });
            const text = deterministicTutorStubClosureResponse(frame, { acknowledgement: true });
            const closureAudit = auditTutorStubDialogueClosureResponse({ text, frame });
            printWithConcurrentTerminal(state, () => printTurnDebugLine(state, tutorTurn));
            response = await runOneTurn(
              learnerText,
              attemptState,
              {
                turn: {
                  summary: 'Learner declines the optional final check-in.',
                  request_type: 'off_task_or_mixed',
                  discourse_move: 'claim',
                  evidence_use: 'none',
                  epistemic_stance: 'grounded',
                  affect: 'settled',
                  agency: 'steering',
                  scores: {},
                  pedagogical_need: 'Close the inquiry without another question.',
                },
                overall: {
                  summary: 'The learner accepts dialogue closure.',
                  trajectory: 'terminal closure',
                  current_state: 'settled',
                  next_best_tutor_move: 'Close the inquiry.',
                },
              },
              tutorLearnerDag,
              null,
              null,
              {
                text,
                provider: attemptState.resolved.provider,
                model: attemptState.resolved.model,
                latencyMs: 0,
                usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0 },
                leakAudit: { ok: true, leaks: [] },
                scaffoldAudit: { ok: true, issues: [], similarity: 0 },
                closureAudit,
                deterministicClosure: true,
              },
              { signal: abortController.signal, isCurrent, learnerInput, turnTiming },
            );
            completionReason = 'dialogue_closure_acknowledgement';
          } else {
            const { classification, tutorLearnerDag, registerSelection, previousRegisterEfficacy } =
              await analyzeLearnerTurn(learnerText, attemptState, {
                precomputedRaw: prefetchedAnalysis?.raw || null,
                signal: abortController.signal,
                isCurrent,
                tutorFeedback: learnerInput.tutorFeedback,
              });
            turnTiming.analysisCompletedAtMs = Date.now();
            turnTiming.analysisSource = prefetchedAnalysis?.entry ? 'prefetched' : 'foreground';
            assertTutorStubTurnAttemptCurrent({ signal: abortController.signal, isCurrent });
            const humanDiscourseFrame = buildHumanDiscourseFrame({
              state: attemptState,
              tutorTurn,
              tutorLearnerDag,
              classification,
              learnerText,
            });
            const { frame: dialogueClosureFrame } = tutorDialogueClosureFrameForTurn({
              state: attemptState,
              tutorTurn,
              tutorLearnerDag,
            });
            turnTiming.tutorStartedAtMs = Date.now();
            const prefetchedResponse = await takeMixedLearnerTutorPrefetch(prefetchedAnalysis?.entry, {
              learnerText,
              classification,
              tutorLearnerDag,
              registerSelection,
              humanDiscourseFrame,
              dialogueClosureFrame,
              tutorFeedback: learnerInput.tutorFeedback,
            });
            turnTiming.tutorSource = prefetchedResponse ? 'prefetched' : 'foreground';
            assertTutorStubTurnAttemptCurrent({ signal: abortController.signal, isCurrent });
            if (!prefetchedResponse) {
              startInterimAnimation(
                attemptState,
                'calling tutor',
                buildTutorInterimContext({
                  learnerText,
                  state: attemptState,
                  classification,
                  tutorLearnerDag,
                  registerSelection,
                  previousRegisterEfficacy,
                }),
              );
            }
            try {
              response = await runOneTurn(
                learnerText,
                attemptState,
                classification,
                tutorLearnerDag,
                registerSelection,
                previousRegisterEfficacy,
                prefetchedResponse,
                { signal: abortController.signal, isCurrent, learnerInput, turnTiming },
              );
            } finally {
              stopInterimAnimation(attemptState);
            }
          }

          assertTutorStubTurnAttemptCurrent({ signal: abortController.signal, isCurrent });
          commitInteractiveLearnerAttempt(attemptState, baseline);
          const committedTutorFeedback = commitTutorStubTurnFeedback(state.turnFeedback, {
            learnerTurn: tutorTurn,
            learnerTurnId: turnId,
          });
          active.committed = true;
          active.responseDisplayed = true;
          appendTraceEvent(state.trace, {
            type: 'learner_turn_compound_committed',
            schema: learnerInput.schema,
            turn: tutorTurn,
            turnId,
            compoundTurnId: active.id,
            revision,
            messageCount: learnerInput.messageCount,
            messages: learnerInput.messages,
            combinedText: learnerInput.combinedText,
            tutorFeedback: learnerInput.tutorFeedback,
            learnerResponseProvenance: learnerInput.provenance,
          });
          if (state.curriculum?.runtime) {
            recordTutorStubCurriculumEvidence(state.curriculum.runtime, {
              text: learnerInput.combinedText,
              turnId,
            });
            appendTraceEvent(state.trace, {
              type: 'curriculum_phase_evidence_recorded',
              schema: 'machinespirits.tutor-stub.curriculum-progression.v1',
              moduleId: state.curriculum.runtime.currentModuleId,
              phase: state.curriculum.runtime.currentPhase,
              turn: tutorTurn,
              turnId,
              source: 'public_learner_turn',
              publicTranscriptChanged: false,
              externalCompletionInferred: false,
            });
          }
          appendTraceEvent(state.trace, {
            type: 'learner_turn_tutor_feedback_committed',
            turn: tutorTurn,
            turnId,
            compoundTurnId: active.id,
            feedback: committedTutorFeedback,
            publicTranscriptChanged: false,
          });
          printWithConcurrentTerminal(state, () => {
            if (automaticTechnicalDetailsEnabled(state)) printTutorDagSnapshot(response.dagSnapshot);
            printResponseDetails(response, state);
            if (!state.passthrough?.enabled) {
              printDirectorPreludeBeforeFirstTutor(state, {
                reason: closureAcknowledgement
                  ? 'closure_response_without_opening'
                  : 'generated_response_without_opening',
              });
            }
            printTutorResponse(response, state.stream);
            printTutorFeedbackRequest({ tutorTurn, tutorTurnId: turnId, kind: 'tutor_response' });
          });
          publishAcceptedTutorToVoice({
            text: response.text,
            turn: tutorTurn,
            turnId,
            response,
            reason: 'accepted_guarded_tutor_response',
          });
          await printExplanatoryDebugTurn(state, { signal: abortController.signal, isCurrent });
          if (state.dialogueClosure?.phase === 'awaiting_checkin') {
            printWithConcurrentTerminal(state, () => {
              console.log(
                `${C.cyan}dialogue closing >${C.reset} the verdict has reached closure; one optional learner check-in remains`,
              );
              console.log(
                `${C.dim}  reply once to revisit a link, or say “no thanks” to close immediately${C.reset}\n`,
              );
            });
          }
          writeFieldVisualization(state, { reason: completionReason });
          completedTurn = true;
          committedTurn = {
            turn: tutorTurn,
            turnId,
            learner: learnerInput.combinedText,
            tutor: response.text,
            provider: response.provider || state.resolved?.provider || null,
            model: response.model || state.resolved?.model || null,
            completionReason,
          };
          if (sessionRuntime.status === 'active') sessionRuntime.sync('learner_turn_committed');
        } catch (err) {
          stopInterimAnimation(attemptState);
          if (err?.name === 'AbortError' && activeLearnerTurn !== active) {
            appendTraceEvent(state.trace, {
              type: 'learner_turn_attempt_discarded',
              turn: tutorTurn,
              turnId,
              compoundTurnId: active.id,
              revision,
              reason: active.cancelledReason || 'learner_turn_cancelled',
              error: null,
            });
            break;
          }
          if (active.revision !== revision) {
            appendTraceEvent(state.trace, {
              type: 'learner_turn_attempt_discarded',
              turn: tutorTurn,
              turnId,
              compoundTurnId: active.id,
              revision,
              replacedByRevision: active.revision,
              reason: 'additional_learner_message_before_tutor_reply',
              error: err?.name === 'AbortError' ? null : err.message,
            });
            continue;
          }
          if (exiting && err?.name === 'AbortError') break;
          throw err;
        } finally {
          if (active.abortController === abortController) active.abortController = null;
        }
      }
    } catch (err) {
      stopInterimAnimation(state);
      if (throwOnError) throw err;
      printWithConcurrentTerminal(state, () => {
        clearStatusLine();
        console.error(`${C.red}error:${C.reset} ${err.message}\n`);
      });
    } finally {
      const ownsActiveTurn = activeLearnerTurn === active;
      if (ownsActiveTurn) activeLearnerTurn = null;
      if (!activeLearnerTurn && !activeAutoRun) processingTurn = false;
      if (!exiting && ownsActiveTurn && !active.cancelledReason) {
        if (state.dialogueClosure?.phase === 'closed') {
          discardPendingInteractiveAuto('dialogue_closed', { source: 'turn_completion', announce: true });
          offerAnotherScenario('dialogue_grounded_closure');
        } else if (completedTurn && startPendingInteractiveAuto({ afterTurn: tutorTurn })) {
          // The deferred automation owns the next learner turn, so do not warm
          // or display a mixed-mode draft for the now-superseded manual prompt.
        } else {
          if (!completedTurn) {
            discardPendingInteractiveAuto('tutor_turn_failed', { source: 'turn_completion', announce: true });
          }
          const next = pendingLearnerLines.shift();
          if (next) {
            printWithConcurrentTerminal(state, () =>
              console.log(`${C.dim}running queued learner turn (${pendingLearnerLines.length} still queued)${C.reset}`),
            );
            void processLearnerLine(next.text, next.provenance);
          } else {
            if (completedTurn) startMixedLearnerPrefetch('turn_complete');
            promptIfIdle();
          }
        }
      }
    }
    return committedTurn;
  }

  function routeLearnerText(text, { source = 'terminal', provenance = null, awaitCompletion = false } = {}) {
    const trimmed = String(text || '').trim();
    if (!trimmed || exiting) return { accepted: false, reason: 'empty_or_exiting' };
    const interactionMode = state.interaction?.mode || 'learner';
    const learnerResponseProvenance =
      interactionMode === 'learner'
        ? provenance || humanLearnerResponseProvenance(source === 'voice' ? 'voice' : 'terminal')
        : null;
    appendTraceEvent(state.trace, {
      type: 'learner_input_routed',
      source,
      text: trimmed,
      duringTurn: processingTurn,
      interactionMode,
      ...(learnerResponseProvenance ? { learnerResponseProvenance } : {}),
      publicTranscriptStatus: 'pending_compound_turn',
    });
    if (interactionMode === 'coach') {
      const pausedInterim = processingTurn ? pauseInterimAnimation(state) : false;
      queueCoachGuidance(trimmed, { duringTurn: processingTurn });
      if (pausedInterim) resumeInterimAnimation(state);
      return { accepted: true, route: 'coach_guidance' };
    }
    if (processingTurn && interactionMode === 'auto') {
      console.log(`${C.dim}automation is running; enter a slash command, or wait for learner mode to resume${C.reset}`);
      appendTraceEvent(state.trace, {
        type: 'auto_mode_non_command_ignored',
        text: trimmed,
        turn: state.turns.length + 1,
        source,
      });
      return { accepted: false, reason: 'auto_mode_running' };
    }
    if (processingTurn && pendingAutoRequest) {
      console.log(
        `${C.dim}auto handoff is queued; enter a slash command, use /mode learner to cancel it, or wait for automation${C.reset}`,
      );
      appendTraceEvent(state.trace, {
        type: 'auto_queue_non_command_ignored',
        requestId: pendingAutoRequest.id,
        text: trimmed,
        turn: state.turns.length + 1,
        source,
      });
      return { accepted: false, reason: 'auto_mode_queued' };
    }
    if (processingTurn) {
      const pausedInterim = pauseInterimAnimation(state);
      if (extendActiveLearnerTurn(trimmed, learnerResponseProvenance)) {
        if (pausedInterim) resumeInterimAnimation(state);
        return { accepted: true, route: 'compound_learner_turn' };
      }
      pendingLearnerLines.push({ text: trimmed, provenance: learnerResponseProvenance });
      console.log(
        `${C.dim}queued next learner turn (${pendingLearnerLines.length} queued); use /analysis, /transcript, /field, /viz, or /clarify while waiting${C.reset}`,
      );
      appendTraceEvent(state.trace, {
        type: 'learner_turn_queued',
        queued: pendingLearnerLines.length,
        reason: 'previous_tutor_response_already_displayed',
        source,
        learnerResponseProvenance,
      });
      if (pausedInterim) resumeInterimAnimation(state);
      return { accepted: true, route: 'next_learner_turn_queue' };
    }
    const pendingTurn = processLearnerLine(trimmed, learnerResponseProvenance, { throwOnError: awaitCompletion });
    if (awaitCompletion) {
      return pendingTurn.then((turn) => ({ accepted: true, route: 'new_learner_turn', turn }));
    }
    void pendingTurn;
    return { accepted: true, route: 'new_learner_turn' };
  }

  const initialSetupCompleted = await runInitialMixedLearnerSetup();
  if (!initialSetupCompleted) {
    await interactiveDone;
    return;
  }
  persistCurrentInteractiveSettings(resumedDialogue ? 'resume_loaded' : 'session_ready');

  if (args['session-rpc']) {
    const rpcInput = fs.createReadStream('', { fd: 3, autoClose: false });
    const rpcOutput = fs.createWriteStream('', { fd: 4, autoClose: false });
    try {
      const opening = await emitOpeningPrompt('session_rpc_start', {
        display: false,
        realizer: 'deterministic',
        deterministicSource: 'session_rpc',
      });
      const resumeHandoff = opening ? null : emitResumeHandoff('session_rpc_start', { display: false });
      if ((opening || resumeHandoff) && sessionRuntime.status === 'active') {
        sessionRuntime.sync(opening ? 'opening_committed' : 'resume_handoff_committed');
      }
      await runTutorStubSessionRpc({ input: rpcInput, output: rpcOutput, runtime: sessionRuntime });
    } finally {
      if (sessionRuntime.status === 'active') await sessionRuntime.finalize('session_rpc_closed');
      rl.close();
      rpcInput.destroy();
      rpcOutput.end();
    }
    return;
  }

  if (input.isTTY && output.isTTY) {
    emitKeypressEvents(input, rl);
    onInteractiveKeypress = (character, key) => {
      if (key?.name === 'tab') {
        const completion = mixedLearnerCompletionForLine(rl.line);
        if (completion && mixedLearner.suggestion?.text) {
          mixedLearner.draftInsertion = {
            insertedAt: new Date().toISOString(),
            lineBeforeInsertion: rl.line,
            completion,
            suggestion: jsonClone(mixedLearner.suggestion),
          };
          appendTraceEvent(state.trace, {
            type: 'mixed_learner_suggestion_inserted',
            turn: mixedLearner.suggestion.turn,
            turnId: mixedLearner.suggestion.turnId,
            requestId: mixedLearner.suggestion.requestId,
            inputMethod: 'tab_completion',
            publicTranscriptChanged: false,
          });
        }
      }
      const feedbackInterfaceBlocked = Boolean(
        exiting || initialSetupStage !== 'off' || scenarioPickerActive || awaitingAnotherScenario,
      );
      const pendingTutorFeedback = tutorStubTurnFeedbackEnvelope(state.turnFeedback);
      const escapeDismissesFeedback = tutorStubTurnFeedbackEscapeDismissal({
        line: rl.line,
        key,
        feedback: pendingTutorFeedback,
        interactiveMode: state.interaction?.mode,
        interfaceBlocked: feedbackInterfaceBlocked,
        selectionActive: lineSelection.snapshot().active,
      });
      if (escapeDismissesFeedback) {
        lineSelection.clear();
        handleTutorFeedbackCommand('off', { source: 'empty_prompt_escape' });
        promptIfIdle();
        return;
      }
      const arrowRating = tutorStubTurnFeedbackArrowRating({
        line: rl.line,
        key,
        feedback: pendingTutorFeedback,
        busy: processingTurn,
        interactiveMode: state.interaction?.mode,
        interfaceBlocked: feedbackInterfaceBlocked,
      });
      if (arrowRating) {
        lineSelection.clear();
        handleTutorFeedbackCommand(arrowRating, {
          source: key.name === 'right' ? 'empty_prompt_right_arrow' : 'empty_prompt_left_arrow',
        });
        promptIfIdle();
        return;
      }
      lineSelection.handleKeypress(character, key);
      if (slashPaletteRefreshHandle) clearImmediate(slashPaletteRefreshHandle);
      slashPaletteRefreshHandle = setImmediate(() => {
        slashPaletteRefreshHandle = null;
        if (exiting || initialSetupStage !== 'off') return;
        const paletteChanged = concurrentTerminal.setPalette(slashCommandPaletteForLine(rl.line));
        if (!paletteChanged) concurrentTerminal.show();
      });
    };
    input.on('keypress', onInteractiveKeypress);
  }

  printInteractionModeBanner({ detail: false });

  rl.on('line', (line) => {
    lineSelection.clear();
    concurrentTerminal.acceptLine();
    if (scenarioPickerActive) return;
    const trimmed = line.trim();
    const draftInsertion = mixedLearner.draftInsertion;
    mixedLearner.draftInsertion = null;
    const draftProvenance = trimmed ? mixedDraftLearnerResponseProvenance(draftInsertion, trimmed) : null;
    if (trimmed === '👍' || trimmed === '👎') {
      handleTutorFeedbackCommand(trimmed === '👍' ? 'up' : 'down', {
        duringTurn: processingTurn,
        source: 'emoji_line',
      });
      promptIfIdle();
      return;
    }
    if (awaitingAnotherScenario && !trimmed) {
      requestExit('dialogue_grounded_closure');
      return;
    }
    if (awaitingAnotherScenario && !trimmed.startsWith('/')) {
      const answer = trimmed.toLowerCase();
      if (['n', 'no', 'no thanks', 'quit', 'exit'].includes(answer)) {
        requestExit('dialogue_grounded_closure');
        return;
      }
      if (['y', 'yes', 'another', 'another scenario'].includes(answer)) {
        void chooseAnotherScenario('', { reason: 'next_scenario_after_closure' }).finally(() => {
          if (!exiting) promptIfIdle();
        });
        return;
      }
      console.log(`${C.dim}type y to choose another scenario, or press Enter to finish${C.reset}`);
      promptIfIdle();
      return;
    }
    if (!trimmed) {
      promptIfIdle();
      return;
    }
    const slashResult = handleSlashCommand(trimmed, { duringTurn: processingTurn });
    if (slashResult) {
      if (typeof slashResult.then === 'function') {
        if (!slashResult.tutorStubBlocksPrompt) promptIfIdle();
        void slashResult.finally(() => {
          promptIfIdle();
        });
      } else {
        promptIfIdle();
      }
      return;
    }
    sessionRuntime.step(trimmed, {
      kind: 'learner',
      context: { source: 'terminal', provenance: draftProvenance },
    });
    promptIfIdle();
  });

  rl.on('SIGINT', () => {
    stopInterimAnimation(state);
    console.log();
    requestExit('sigint');
  });

  rl.on('close', () => {
    exiting = true;
    stopInterimAnimation(state);
    void stopVoiceBridge('terminal_closed');
    if (slashPaletteRefreshHandle) clearImmediate(slashPaletteRefreshHandle);
    if (onInteractiveKeypress) input.removeListener('keypress', onInteractiveKeypress);
    concurrentTerminal.close();
    if (!finalized) finalizeInteractive('exit');
    resolveInteractive();
  });

  const deferOpeningForMixedPrelude = Boolean(mixedLearner.enabled && !instantExistingScenarioOpening);
  const opening = await emitOpeningPrompt('start', {
    display: !deferOpeningForMixedPrelude,
    realizer: instantExistingScenarioOpening ? 'deterministic' : null,
    deterministicSource: instantExistingScenarioOpening ? 'remembered_scenario_instant_opening' : null,
  });
  if (opening) {
    const openingPrefetch = startMixedLearnerPrefetch('opening', {
      refreshPrompt: !deferOpeningForMixedPrelude,
    });
    if (deferOpeningForMixedPrelude) {
      if (openingPrefetch) {
        startInterimAnimation(state, 'preparing scenario', { tutorTurn: state.turns.length + 1 });
        try {
          await openingPrefetch;
        } finally {
          stopInterimAnimation(state);
        }
      }
      printInteractiveTutorOpening(opening);
    }
  } else if (resumedDialogue) {
    const resumeHandoff = emitResumeHandoff('interactive_start');
    if (resumeHandoff) startMixedLearnerPrefetch('resume_handoff');
  }

  if (voiceLaunchRequested && !exiting) {
    await handleVoiceCommand('on', { source: 'launch_flag' });
  }

  if (args.demo && !exiting) {
    await runInteractiveDemo('', { source: 'launch_flag' });
  }

  promptIfIdle();
  await interactiveDone;
}

main().catch((err) => {
  console.error(`${C.red}Fatal:${C.reset} ${err.message}`);
  process.exit(1);
});
