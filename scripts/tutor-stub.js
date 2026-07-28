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
import { parseArgs } from 'node:util';
import { collectGitActivity, collectGitHubMetrics, collectSourceMetrics, renderReport } from './repository-metrics.js';
import { call as callAI, callStream as streamAI } from '../tutor-core/services/unifiedAIProviderService.js';
import { callAIWithCliBridge, isCliProvider, normalizeCliEffort } from '../services/cliProviderBridge.js';
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
import { loadWorld } from '../services/dramaticDerivation/world.js';
import {
  groupTutorStubWorldEntries,
  projectTutorStubWorldCatalogLines,
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
import { projectTutorStubCurriculumCatalogLines } from '../services/curriculum/tutorStubCurriculumCatalogPresentation.js';
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
  createTutorStubInterimState as createInterimState,
  formatTutorStubSignedInterimNumber as formatSignedInterimNumber,
  projectTutorStubInterimPanels,
  renderTutorStubInterimFrame,
  resolveTutorStubInterimState as getInterimState,
  summarizeTutorStubInterimCapabilities as compactInterimStateSummary,
  summarizeTutorStubInterimField,
  summarizeTutorStubEvidenceTiming,
  summarizeTutorStubPendingDagMovement,
  summarizeTutorStubPendingField,
  summarizeTutorStubPendingLearner,
  summarizeTutorStubPendingLearnerDag as compactPendingLearnerDagSummary,
  summarizeTutorStubPendingObjective,
  summarizeTutorStubPendingRegister,
  summarizeTutorStubPendingTutorDag,
  summarizeTutorStubLearnerRecordUpdate,
  tutorStubInterimCliHintPanels as compactInterimCliHintPanels,
} from '../services/tutorStubInterimPresentation.js';
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
import { assertTutorStubTurnAttemptCurrent } from '../services/tutorStubTurnAttempt.js';
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
  tutorStubCliMotionInterval,
  tutorStubCliPresentationSnapshot,
  tutorStubCliSpinnerFrames,
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
import {
  projectTutorStubCurriculumPickerEntries,
  projectTutorStubCurriculumPickerLines,
  projectTutorStubLaunchModePickerLines,
  projectTutorStubScenarioPickerEntries,
  projectTutorStubScenarioPickerLines,
} from '../services/tutorStubPickerPresentation.js';
import { TUTOR_STUB_LAUNCH_MODES, normalizeTutorStubLaunchMode } from '../services/tutorStubLaunchMode.js';
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
  committeeQuestionSentences,
  runCommitteeBattery,
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
import {
  appendPendingIntervention,
  closePendingIntervention,
  createPendingIntervention,
} from '../services/adaptiveTutor/interventionLedger.js';
import {
  buildTutorStubTypedActionDecision,
  tutorStubMoveFamilyForAction,
} from '../services/adaptiveTutor/tutorStubActionAdapter.js';
import {
  advanceScaffoldLifecycle,
  allowedMoveFamiliesForScaffoldPhase,
  createScaffoldLifecycle,
  SCAFFOLD_LIFECYCLE_SCHEMA,
  validateScaffoldLifecycle,
} from '../services/adaptiveTutor/scaffoldLifecycle.js';

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
};

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

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    tutor: { type: 'string', default: STUB.tutor },
    tuning: { type: 'string', default: STUB.tuning },
    'tuning-dir': { type: 'string', default: process.env.TUTOR_STUB_TUNING_DIR || '.tutor-stub-tuning' },
    'all-models': { type: 'string', default: STUB.allModels },
    model: { type: 'string', default: STUB.model },
    'classifier-model': { type: 'string', default: STUB.classifierModel },
    'no-classifier': { type: 'boolean', default: false },
    passthrough: { type: 'boolean', default: false },
    // Evaluate a bare turn, gate nothing. Passthrough fuses evaluation and
    // enforcement by returning the first draft untouched; this splits them, so
    // a baseline arm records the two contract-free audits and stays bare.
    'observe-audits': { type: 'boolean', default: false },
    'tutor-learner-dag': { type: 'boolean', default: false },
    'learner-record-model': { type: 'string', default: STUB.learnerRecordModel },
    'learner-analysis-prompt-profile': { type: 'string', default: STUB.learnerAnalysisPromptProfile },
    'learner-analysis-evidence-use-rubric': { type: 'string', default: STUB.learnerAnalysisEvidenceUseRubric },
    'no-register-selection': { type: 'boolean', default: false },
    'register-palette': { type: 'string', default: 'all' },
    'register-policy': { type: 'string', default: STUB.registerPolicy },
    'point-of-action-arm': { type: 'string', default: STUB.pointOfActionArm },
    committee: { type: 'boolean', default: false },
    'no-committee': { type: 'boolean', default: false },
    'committee-mini-model': { type: 'string', default: PROGRAM2_COMMITTEE_DEFAULTS.miniModel },
    'committee-ollama-url': { type: 'string', default: PROGRAM2_COMMITTEE_DEFAULTS.ollamaUrl },
    'committee-fallback-policy': {
      type: 'string',
      default: process.env.TUTOR_STUB_COMMITTEE_FALLBACK_POLICY || 'v1',
    },
    'register-overlay-threshold': { type: 'string', default: STUB.registerOverlayThreshold },
    // Predeclared pressure probe: at these learner turns the selected
    // register is forced hostile (face_threat) regardless of policy, so
    // post-trigger recovery can be scored as a designed event rather than a
    // policy-endogenous one. CSV of learner turn numbers, e.g. "6".
    'pressure-turns': { type: 'string', default: '' },
    'register-temperature': { type: 'string', default: STUB.registerTemperature },
    'light-adaptation': { type: 'boolean', default: STUB.lightAdaptation },
    'no-light-adaptation': { type: 'boolean', default: false },
    'light-adaptation-threshold': { type: 'string', default: STUB.lightAdaptationThreshold },
    'training-reuse': { type: 'string', default: STUB.trainingReuse },
    'no-training-reuse': { type: 'boolean', default: false },
    'human-subject-class': { type: 'string', default: STUB.humanSubjectClass },
    'dag-fact-dropout': { type: 'string', default: STUB.dagFactDropout },
    'dag-fact-dropout-seed': { type: 'string', default: STUB.dagFactDropoutSeed },
    'release-speed': { type: 'string', default: STUB.releaseSpeed },
    'run-seed': { type: 'string', default: STUB.runSeed },
    'eval-repeat': { type: 'string', default: '1' },
    'eval-job-id': { type: 'string', default: '' },
    'loop-mode': { type: 'string', default: 'strict' },
    'typed-actions': { type: 'boolean', default: STUB.typedActions },
    'typed-action-task-id': { type: 'string', default: STUB.typedActionTaskId },
    'typed-action-knowledge-component': { type: 'string', default: STUB.typedActionKnowledgeComponent },
    'typed-action-prerequisites': { type: 'string', default: STUB.typedActionPrerequisites },
    'typed-action-item-difficulty': { type: 'string', default: STUB.typedActionItemDifficulty },
    'typed-action-support-level': { type: 'string', default: STUB.typedActionSupportLevel },
    'register-empirical-prior': {
      type: 'string',
      default: process.env.TUTOR_STUB_REGISTER_EMPIRICAL_PRIOR || '',
    },
    'safe-registers': { type: 'boolean', default: false },
    topic: { type: 'string', default: STUB.topic },
    world: { type: 'string', default: STUB.world },
    curriculum: { type: 'string' },
    module: { type: 'string' },
    dag: { type: 'boolean', default: false },
    'dag-mode': { type: 'string', default: STUB.dagMode },
    'list-worlds': { type: 'boolean', default: false },
    'list-curriculum-modules': { type: 'boolean', default: false },
    'list-tutors': { type: 'boolean', default: false },
    'list-learner-profiles': { type: 'boolean', default: false },
    lab: { type: 'string', default: '' },
    'list-labs': { type: 'boolean', default: false },
    features: { type: 'boolean', default: false },
    'launch-mode': { type: 'string', default: process.env.TUTOR_STUB_LAUNCH_MODE || '' },
    'labelling-game': { type: 'boolean', default: false },
    'label-dataset': { type: 'string', default: '' },
    'label-coder': { type: 'string', default: '' },
    learner: { type: 'string', default: STUB.learner },
    goal: { type: 'string', default: STUB.goal },
    style: { type: 'string', default: STUB.style },
    system: { type: 'string' },
    once: { type: 'string' },
    'auto-learner': { type: 'boolean', default: false },
    'auto-learner-model': { type: 'string', default: STUB.autoLearnerModel },
    'auto-learner-profile': { type: 'string', default: STUB.autoLearnerProfile },
    'learner-character': { type: 'string', default: '' },
    'tutor-character': { type: 'string', default: '' },
    'auto-turns': { type: 'string', default: String(STUB.autoTurns) },
    'auto-safety-turns': { type: 'string', default: String(STUB.autoSafetyTurns) },
    'model-call-budget': { type: 'string', default: '' },
    'acknowledge-research-use': { type: 'boolean', default: false },
    'no-auto-stop-on-grounded': { type: 'boolean', default: false },
    'mixed-learner': { type: 'boolean', default: STUB.mixedLearner },
    'mixed-tutor-prefetch-policy': { type: 'string', default: STUB.mixedTutorPrefetchPolicy },
    'mixed-mode': { type: 'boolean', default: false },
    demo: { type: 'boolean', default: false },
    save: { type: 'string' },
    'prompt-book-context': { type: 'string' },
    'trace-dir': { type: 'string', default: STUB.traceDir },
    'settings-file': { type: 'string', default: STUB.settingsFile },
    theme: { type: 'string', default: STUB.cliTheme },
    motion: { type: 'string', default: STUB.motion },
    'no-color': { type: 'boolean', default: false },
    'no-remember-settings': {
      type: 'boolean',
      default: process.env.TUTOR_STUB_REMEMBER_SETTINGS === '0',
    },
    'no-trace': { type: 'boolean', default: false },
    'resume-last': { type: 'boolean', default: false },
    resume: { type: 'string', default: '' },
    recipe: { type: 'string', default: '' },
    'write-recipe': { type: 'string', default: '' },
    'acknowledge-drift': { type: 'boolean', default: false },
    'session-rpc': { type: 'boolean', default: false },
    'session-id': { type: 'string', default: '' },
    'no-stream': { type: 'boolean', default: false },
    'no-interim-animation': { type: 'boolean', default: false },
    'no-memory-summary': { type: 'boolean', default: false },
    'field-viz': { type: 'boolean', default: STUB.fieldViz },
    'multiple-choice': { type: 'boolean', default: STUB.multipleChoice },
    'no-opening': { type: 'boolean', default: false },
    'opening-realizer': { type: 'string', default: STUB.openingRealizer },
    'no-closeout-report': { type: 'boolean', default: false },
    'no-turn-feedback': { type: 'boolean', default: false },
    'no-response-details': { type: 'boolean', default: false },
    voice: { type: 'boolean', default: false },
    'voice-model': { type: 'string', default: STUB.voiceModel },
    'voice-name': { type: 'string', default: STUB.voiceName },
    'cli-effort': { type: 'string', default: STUB.cliEffort },
    temperature: { type: 'string', default: String(STUB.temperature) },
    'max-tokens': { type: 'string', default: String(STUB.maxTokens) },
    'history-turns': { type: 'string', default: String(STUB.historyTurns) },
    'show-prompt': { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

let selectedLabResolution = null;
let selectedLabAdmission = null;
let selectedLabModelCallBudget = null;
const program2ProviderBudget = createProgram2ProviderBudgetFromEnvironment();
let loadedSessionRecipe = null;
let loadedSessionRecipePath = null;
let resolvedResumeSource = null;
let loadedRecipeApplication = null;
let resumeRecipeApplication = null;
const resolvedLaunchOptionNames = new Set();

function applyTutorStubLabDefaults(id) {
  const base = resolveTutorStubLab(id);
  for (const [key, value] of Object.entries(base.cliOptions)) {
    if (key === 'lab' || rawCommandLineOptionProvided(key)) continue;
    args[key] = value;
    resolvedLaunchOptionNames.add(key);
  }
  args.lab = base.lab.id;
}

function prepareTutorStubLaunchConfiguration() {
  if (args.resume && args['resume-last']) {
    throw new Error('--resume and --resume-last are mutually exclusive; select one explicit resume source');
  }

  if (args.recipe) {
    loadedSessionRecipe = readTutorStubSessionRecipe(resolveWorkspacePath(args.recipe));
    loadedSessionRecipePath = loadedSessionRecipe.filePath;
    const explicitLab = rawCommandLineOptionProvided('lab') ? String(args.lab || '').trim() : '';
    const recipeLab = String(loadedSessionRecipe.config?.lab || '').trim();
    if (explicitLab && recipeLab && explicitLab !== recipeLab && !args['acknowledge-drift']) {
      throw new Error(
        `recipe lab drift: recipe selects ${recipeLab}, but --lab selects ${explicitLab}; rerun with --acknowledge-drift to inspect the effective lab configuration`,
      );
    }
  }

  const requestedLaunchMode = normalizeTutorStubLaunchMode(args['launch-mode'], { allowEmpty: true });
  const defaultLab = String(process.env.TUTOR_STUB_DEFAULT_LAB || '').trim();
  const defaultLabEligible = Boolean(
    defaultLab &&
    !args.lab &&
    !args.recipe &&
    !args.resume &&
    !args['resume-last'] &&
    !args.passthrough &&
    !args['auto-learner'] &&
    !args.curriculum &&
    !args.once &&
    !args['session-rpc'] &&
    !args['labelling-game'] &&
    requestedLaunchMode !== 'labelling-game',
  );
  const declaredLab = String(
    args.lab || loadedSessionRecipe?.config?.lab || (defaultLabEligible ? defaultLab : ''),
  ).trim();
  if (declaredLab) applyTutorStubLabDefaults(declaredLab);
  if (loadedSessionRecipe) {
    loadedRecipeApplication = applyTutorStubRecipeOptions(args, loadedSessionRecipe, {
      optionProvided: rawRecipeOptionProvided,
    });
    for (const key of loadedRecipeApplication.applied) resolvedLaunchOptionNames.add(key);
  }

  if (args.resume || args['resume-last']) {
    resolvedResumeSource = args.resume
      ? resolveTutorStubResumeSource(args.resume, {
          traceDir: resolveWorkspacePath(args['trace-dir']),
          cwd: ROOT,
        })
      : latestTutorStubResumeSource({
          traceDir: resolveWorkspacePath(args['trace-dir']),
          cwd: ROOT,
        });
    if (resolvedResumeSource && !loadedSessionRecipe) {
      const resumeLab = String(args.lab || resolvedResumeSource.recipe?.config?.lab || '').trim();
      if (resumeLab && !declaredLab) applyTutorStubLabDefaults(resumeLab);
      resumeRecipeApplication = applyTutorStubRecipeOptions(args, resolvedResumeSource.recipe, {
        optionProvided: rawRecipeOptionProvided,
      });
      for (const key of resumeRecipeApplication.applied) resolvedLaunchOptionNames.add(key);
    }
  }

  const resolvedLab = String(
    args.lab || loadedSessionRecipe?.config?.lab || resolvedResumeSource?.recipe?.config?.lab || '',
  ).trim();
  if (resolvedLab) selectedLabResolution = resolveTutorStubLab(resolvedLab, { overrides: args });
}

const informationalLaunchRequested = Boolean(
  args.help ||
  args['list-labs'] ||
  args.features ||
  args['list-worlds'] ||
  args['list-curriculum-modules'] ||
  args['list-tutors'] ||
  args['list-learner-profiles'],
);
if (!informationalLaunchRequested) prepareTutorStubLaunchConfiguration();

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

const { assertSupportedModelRefs, tutorModelChoiceEntries, resolveTutorModelSelection, visibleResolvedModel } =
  createTutorStubModelSelection({
    loadProviders,
    getProviderConfig,
    isCliProvider,
    resolveModel,
    unsupportedRefs: UNSUPPORTED_CODEX_MINI_REFS,
  });

function resolveWorkspacePath(value) {
  return path.isAbsolute(value) ? value : path.join(ROOT, value);
}

function rawCommandLineOptionProvided(name) {
  const flag = `--${name}`;
  return process.argv.slice(2).some((argument) => argument === flag || argument.startsWith(`${flag}=`));
}

function rawRecipeOptionProvided(name) {
  if (name === 'training-reuse') {
    return rawCommandLineOptionProvided('training-reuse') || rawCommandLineOptionProvided('no-training-reuse');
  }
  return rawCommandLineOptionProvided(name);
}

function commandLineOptionProvided(name) {
  return rawCommandLineOptionProvided(name) || resolvedLaunchOptionNames.has(name);
}

function resolvedTrainingReuseSource(rememberedSettings) {
  if (rawCommandLineOptionProvided('no-training-reuse')) return 'cli_opt_out';
  if (rawCommandLineOptionProvided('training-reuse')) return 'cli';
  if (process.env.TUTOR_STUB_TRAINING_REUSE !== undefined) return 'environment';
  if (loadedRecipeApplication?.applied?.includes('training-reuse')) return 'session_recipe';
  if (resumeRecipeApplication?.applied?.includes('training-reuse')) return 'resume_trace';
  if (rememberedSettings?.appliedFields?.includes('training_reuse')) return 'remembered_settings';
  if (resolvedLaunchOptionNames.has('training-reuse')) return 'resolved_launch_default';
  return 'repository_default';
}

function resolvedHumanSubjectClassSource() {
  if (rawCommandLineOptionProvided('human-subject-class')) return 'cli';
  if (process.env.TUTOR_STUB_HUMAN_SUBJECT_CLASS !== undefined) return 'environment';
  if (loadedRecipeApplication?.applied?.includes('human-subject-class')) return 'session_recipe';
  if (resumeRecipeApplication?.applied?.includes('human-subject-class')) return 'resume_trace';
  if (resolvedLaunchOptionNames.has('human-subject-class')) return 'resolved_launch_default';
  return 'repository_default';
}

function rememberedSettingExplicitSources() {
  const allModels = commandLineOptionProvided('all-models') || Boolean(process.env.TUTOR_STUB_ALL_MODELS);
  return {
    tutorInstance: commandLineOptionProvided('tutor') || Boolean(process.env.TUTOR_STUB_TUTOR),
    tuningMode: commandLineOptionProvided('tuning') || Boolean(process.env.TUTOR_STUB_TUNING),
    scenario: commandLineOptionProvided('world') || Boolean(process.env.TUTOR_STUB_WORLD),
    learnerProfile:
      commandLineOptionProvided('auto-learner-profile') ||
      commandLineOptionProvided('learner-character') ||
      Boolean(process.env.TUTOR_STUB_AUTO_LEARNER_PROFILE),
    allModelsRef: allModels,
    tutorModelRef: allModels || commandLineOptionProvided('model') || Boolean(process.env.TUTOR_STUB_MODEL),
    classifierModelRef:
      allModels || commandLineOptionProvided('classifier-model') || Boolean(process.env.TUTOR_STUB_CLASSIFIER_MODEL),
    learnerRecordModelRef:
      allModels ||
      commandLineOptionProvided('learner-record-model') ||
      Boolean(process.env.TUTOR_STUB_LEARNER_RECORD_MODEL),
    autoLearnerModelRef:
      allModels ||
      commandLineOptionProvided('auto-learner-model') ||
      Boolean(process.env.TUTOR_STUB_AUTO_LEARNER_MODEL),
    voiceModel: commandLineOptionProvided('voice-model') || Boolean(process.env.TUTOR_STUB_VOICE_MODEL),
    voiceName: commandLineOptionProvided('voice-name') || Boolean(process.env.TUTOR_STUB_VOICE_NAME),
    cliTheme: commandLineOptionProvided('theme') || Boolean(process.env.TUTOR_STUB_CLI_THEME),
    motion: commandLineOptionProvided('motion') || Boolean(process.env.TUTOR_STUB_MOTION),
    committeeEnabled:
      commandLineOptionProvided('committee') ||
      commandLineOptionProvided('no-committee') ||
      commandLineOptionProvided('point-of-action-arm') ||
      Boolean(process.env.TUTOR_STUB_POINT_OF_ACTION_ARM),
    engagementStanceTemperature:
      commandLineOptionProvided('register-temperature') || Boolean(process.env.TUTOR_STUB_REGISTER_TEMPERATURE),
    lightAdaptationEnabled:
      commandLineOptionProvided('light-adaptation') ||
      commandLineOptionProvided('no-light-adaptation') ||
      process.env.TUTOR_STUB_LIGHT_ADAPTATION !== undefined,
    trainingReuseEnabled:
      commandLineOptionProvided('training-reuse') ||
      commandLineOptionProvided('no-training-reuse') ||
      process.env.TUTOR_STUB_TRAINING_REUSE !== undefined,
    dagFactDropoutRate:
      commandLineOptionProvided('dag-fact-dropout') || Boolean(process.env.TUTOR_STUB_DAG_FACT_DROPOUT),
    releaseSpeed: commandLineOptionProvided('release-speed') || Boolean(process.env.TUTOR_STUB_RELEASE_SPEED),
    registerPolicy: commandLineOptionProvided('register-policy') || Boolean(process.env.TUTOR_STUB_REGISTER_POLICY),
    registerOverlayThreshold:
      commandLineOptionProvided('register-overlay-threshold') ||
      Boolean(process.env.TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD),
  };
}

function applyRememberedInteractiveDefaults({ interactiveSessionEnabled }) {
  const filePath = resolveWorkspacePath(args['settings-file']);
  const ttyDefault = Boolean(input.isTTY && output.isTTY);
  const nonTtyOptIn = process.env.TUTOR_STUB_REMEMBER_SETTINGS === '1';
  const enabled = Boolean(interactiveSessionEnabled && !args['no-remember-settings'] && (ttyDefault || nonTtyOptIn));
  const config = {
    enabled,
    writeEnabled: Boolean(enabled && !args['dry-run']),
    filePath,
    status: enabled ? 'missing' : 'disabled',
    loadedAt: null,
    savedAt: null,
    appliedFields: [],
    skippedExplicitFields: [],
    restoredAllModelsOverrideRef: null,
    warning: null,
  };
  if (!enabled) return config;

  const read = readTutorStubLastSettings(filePath);
  config.status = read.status;
  config.warning = read.error;
  if (read.status !== 'loaded') return config;
  config.loadedAt = read.settings.updatedAt;
  const saved = read.settings;
  const explicit = rememberedSettingExplicitSources();

  if (explicit.tutorInstance) {
    config.skippedExplicitFields.push('tutor_instance');
  } else if (saved.tutorInstanceRef) {
    args.tutor = saved.tutorInstanceRef;
    config.appliedFields.push('tutor_instance');
  }

  if (explicit.tuningMode) {
    config.skippedExplicitFields.push('tuning_mode');
  } else if (saved.tuningMode) {
    args.tuning = saved.tuningMode;
    config.appliedFields.push('tuning_mode');
  }

  if (explicit.scenario) {
    config.skippedExplicitFields.push('scenario');
  } else if (saved.scenarioId) {
    try {
      const savedWorld = resolveWorldRef(saved.scenarioId);
      args.world = savedWorld.filePath;
      config.appliedFields.push('scenario');
    } catch (error) {
      config.warning = `saved scenario ignored: ${error.message}`;
    }
  }

  if (explicit.learnerProfile) {
    config.skippedExplicitFields.push('learner_profile');
  } else if (saved.learnerProfileId || saved.learnerProfile) {
    if (saved.learnerProfileId && !learnerProfileIds().includes(saved.learnerProfileId)) {
      config.warning = [config.warning, `saved learner profile ignored: ${saved.learnerProfileId} is unavailable`]
        .filter(Boolean)
        .join('; ');
    } else {
      args['auto-learner-profile'] = saved.learnerProfileId || saved.learnerProfile;
      config.appliedFields.push('learner_profile');
    }
  }

  if (explicit.tutorModelRef) {
    config.skippedExplicitFields.push('tutor_model');
  } else {
    try {
      resolveTutorModelSelection(saved.tutorModelRef);
      args.model = saved.tutorModelRef;
      config.appliedFields.push('tutor_model');
    } catch (error) {
      config.warning = `saved tutor model ignored: ${error.message}`;
    }
  }

  const rememberedModelRoles = [
    {
      explicit: explicit.classifierModelRef,
      field: 'classifierModelRef',
      arg: 'classifier-model',
      applied: 'learner_interpretation_model',
    },
    {
      explicit: explicit.learnerRecordModelRef,
      field: 'learnerRecordModelRef',
      arg: 'learner-record-model',
      applied: 'learner_reasoning_model',
    },
    {
      explicit: explicit.autoLearnerModelRef,
      field: 'autoLearnerModelRef',
      arg: 'auto-learner-model',
      applied: 'learner_voice_model',
    },
  ];
  for (const role of rememberedModelRoles) {
    if (role.explicit) {
      config.skippedExplicitFields.push(role.applied);
      continue;
    }
    const savedRef = saved[role.field];
    if (!savedRef) continue;
    try {
      resolveTutorModelSelection(savedRef);
      args[role.arg] = savedRef;
      config.appliedFields.push(role.applied);
    } catch (error) {
      config.warning = [config.warning, `saved ${plainSettingName(role.applied)} ignored: ${error.message}`]
        .filter(Boolean)
        .join('; ');
    }
  }
  if (!explicit.allModelsRef && saved.allModelsOverrideRef) {
    const refs = [
      saved.tutorModelRef,
      saved.classifierModelRef,
      saved.learnerRecordModelRef,
      saved.autoLearnerModelRef,
    ];
    if (refs.every((ref) => ref === saved.allModelsOverrideRef)) {
      config.restoredAllModelsOverrideRef = saved.allModelsOverrideRef;
    }
  }

  if (explicit.voiceModel) {
    config.skippedExplicitFields.push('realtime_voice_model');
  } else if (saved.voiceModel) {
    try {
      args['voice-model'] = normalizeTutorStubVoiceModel(saved.voiceModel);
      config.appliedFields.push('realtime_voice_model');
    } catch (error) {
      config.warning = [config.warning, `saved Realtime voice model ignored: ${error.message}`]
        .filter(Boolean)
        .join('; ');
    }
  }

  if (explicit.voiceName) {
    config.skippedExplicitFields.push('realtime_voice_name');
  } else if (saved.voiceName) {
    try {
      args['voice-name'] = normalizeTutorStubVoiceName(saved.voiceName);
      config.appliedFields.push('realtime_voice_name');
    } catch (error) {
      config.warning = [config.warning, `saved Realtime voice name ignored: ${error.message}`]
        .filter(Boolean)
        .join('; ');
    }
  }

  if (explicit.cliTheme) {
    config.skippedExplicitFields.push('terminal_theme');
  } else {
    args.theme = saved.cliTheme;
    config.appliedFields.push('terminal_theme');
  }

  if (explicit.motion) {
    config.skippedExplicitFields.push('terminal_motion');
  } else {
    args.motion = saved.motion;
    config.appliedFields.push('terminal_motion');
  }

  if (explicit.committeeEnabled) {
    config.skippedExplicitFields.push('committee_mode');
  } else {
    args['point-of-action-arm'] = saved.committeeEnabled ? 'committee' : '';
    config.appliedFields.push('committee_mode');
  }

  if (explicit.engagementStanceTemperature) {
    config.skippedExplicitFields.push('engagement_stance_temperature');
  } else {
    args['register-temperature'] = String(saved.engagementStanceTemperature);
    config.appliedFields.push('engagement_stance_temperature');
  }

  if (explicit.lightAdaptationEnabled) {
    config.skippedExplicitFields.push('light_adaptation');
  } else {
    args['light-adaptation'] = saved.lightAdaptationEnabled;
    args['no-light-adaptation'] = !saved.lightAdaptationEnabled;
    config.appliedFields.push('light_adaptation');
  }

  if (explicit.trainingReuseEnabled) {
    config.skippedExplicitFields.push('training_reuse');
  } else {
    args['training-reuse'] = saved.trainingReuseEnabled ? 'on' : 'off';
    config.appliedFields.push('training_reuse');
  }

  if (explicit.dagFactDropoutRate) {
    config.skippedExplicitFields.push('dag_fact_dropout');
  } else {
    args['dag-fact-dropout'] = String(saved.dagFactDropoutRate);
    config.appliedFields.push('dag_fact_dropout');
  }

  if (explicit.releaseSpeed) {
    config.skippedExplicitFields.push('clue_release_speed');
  } else {
    args['release-speed'] = String(saved.releaseSpeed);
    config.appliedFields.push('clue_release_speed');
  }

  try {
    const savedPolicyStack = tutorStubRememberedPolicyStack(saved);
    parseTutorStubRegisterPolicyStack(savedPolicyStack);
    if (!explicit.registerPolicy) {
      args['register-policy'] = savedPolicyStack;
      config.appliedFields.push('register_policy', 'register_overlays');
    } else {
      const requested = parseTutorStubRegisterPolicyStack(args['register-policy']);
      if (
        requested.primary === saved.registerPolicy &&
        requested.overlays.length === 0 &&
        saved.registerOverlays.length
      ) {
        args['register-policy'] = savedPolicyStack;
        config.appliedFields.push('register_overlays');
        config.skippedExplicitFields.push('register_policy');
      } else {
        config.skippedExplicitFields.push('register_policy', 'register_overlays');
      }
    }
  } catch (error) {
    config.warning = [config.warning, `saved register policy ignored: ${error.message}`].filter(Boolean).join('; ');
  }

  if (explicit.registerOverlayThreshold) {
    config.skippedExplicitFields.push('register_overlay_threshold');
  } else {
    args['register-overlay-threshold'] = String(saved.registerOverlayThreshold);
    config.appliedFields.push('register_overlay_threshold');
  }
  return config;
}

const { loadRegisterEmpiricalPrior } = createTutorStubRegisterEmpiricalPriorModel({
  resolveWorkspacePath,
  defaultPath: path.join(ROOT, '.tutor-stub-auto-eval/register-empirical-priors.json'),
  existsSync: fs.existsSync,
  readFileSync: fs.readFileSync,
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

// One entry per presentation family, base world first, controlled variants
// indented after it — ten near-identical costumes stop reading as ten
// independent scenarios (presentation metadata, not register).
function groupedWorldEntries() {
  return groupTutorStubWorldEntries(selectableWorldSummaries());
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

function ruleText(rule, index) {
  const left = (rule.if || []).map(factText).join(' + ');
  const right = (rule.then || []).map(factText).join(' + ');
  return `${index + 1}. ${rule.id}: ${left} -> ${right}\n   ${String(rule.gloss || '').trim()}`;
}

function worldFiles() {
  return fs
    .readdirSync(WORLD_DIR)
    .filter((file) => /^world-.*\.yaml$/.test(file))
    .sort((a, b) => a.localeCompare(b))
    .map((file) => path.join(WORLD_DIR, file));
}

function loadWorldSummaries() {
  return worldFiles().map((filePath) => {
    const world = loadWorld(filePath);
    return { filePath, world };
  });
}

function selectableWorldSummaries() {
  return loadWorldSummaries().filter(({ world }) => world.eligibility?.status === 'production');
}

function printWorlds() {
  for (const line of projectTutorStubWorldCatalogLines(groupedWorldEntries(), { root: ROOT })) console.log(line);
}

function printCurriculumModules(ref) {
  const bundle = loadTutorStubCurriculum(ref, { root: ROOT });
  for (const line of projectTutorStubCurriculumCatalogLines(bundle, listTutorStubCurriculumModules(bundle)))
    console.log(line);
}

function printAutomatedLearnerProfiles() {
  console.log(learnerProfileListText());
}

function defaultLaunchModePickerAvailable() {
  return Boolean(
    process.argv.slice(2).length === 0 && input.isTTY && output.isTTY && typeof input.setRawMode === 'function',
  );
}

async function pickTutorStubLaunchModeWithKeyboard(defaultMode = 'chat') {
  const defaultId = normalizeTutorStubLaunchMode(defaultMode);
  let selectedIndex = Math.max(
    0,
    TUTOR_STUB_LAUNCH_MODES.findIndex((entry) => entry.id === defaultId),
  );
  let renderedLineCount = 0;
  const clearRenderedMenu = () => {
    if (!renderedLineCount) return;
    moveCursor(output, 0, -renderedLineCount);
    for (let index = 0; index < renderedLineCount; index += 1) {
      cursorTo(output, 0);
      clearLine(output, 0);
      if (index < renderedLineCount - 1) moveCursor(output, 0, 1);
    }
    if (renderedLineCount > 1) moveCursor(output, 0, -(renderedLineCount - 1));
    renderedLineCount = 0;
  };
  const renderMenu = () => {
    clearRenderedMenu();
    const lines = projectTutorStubLaunchModePickerLines({
      entries: TUTOR_STUB_LAUNCH_MODES,
      selectedIndex,
      columns: output.columns,
      colors: C,
    });
    for (const line of lines) output.write(`${line}\n`);
    renderedLineCount = lines.length;
  };

  const wasRaw = Boolean(input.isRaw);
  if (!wasRaw) input.setRawMode(true);

  return new Promise((resolve) => {
    let finished = false;
    const finish = (selection) => {
      if (finished) return;
      finished = true;
      input.removeListener('data', onData);
      if (!wasRaw) input.setRawMode(false);
      clearRenderedMenu();
      resolve(selection);
    };
    const moveSelection = (delta) => {
      selectedIndex = (selectedIndex + delta + TUTOR_STUB_LAUNCH_MODES.length) % TUTOR_STUB_LAUNCH_MODES.length;
      renderMenu();
    };
    const onData = (chunk) => {
      const characters = String(chunk || '');
      for (let index = 0; index < characters.length; index += 1) {
        const character = characters[index];
        if (character === '\u0003') return finish(null);
        if (character === '\u001b') {
          const arrowPrefix = characters[index + 1];
          const arrowDirection = characters[index + 2];
          if ((arrowPrefix === '[' || arrowPrefix === 'O') && ['A', 'B'].includes(arrowDirection)) {
            moveSelection(arrowDirection === 'A' ? -1 : 1);
            index += 2;
            continue;
          }
          return finish(null);
        }
        if (character === 'k') moveSelection(-1);
        else if (character === 'j') moveSelection(1);
        else if (character === '1') {
          selectedIndex = 0;
          renderMenu();
        } else if (character === '2') {
          selectedIndex = 1;
          renderMenu();
        } else if (character === '\r' || character === '\n') {
          return finish(TUTOR_STUB_LAUNCH_MODES[selectedIndex]);
        }
      }
    };
    input.on('data', onData);
    input.resume();
    renderMenu();
  });
}

function resolveWorldRef(ref) {
  if (!ref || ref === 'none' || ref === 'off' || ref === 'false') return null;

  const directPath = path.resolve(ROOT, ref);
  if (fs.existsSync(directPath)) {
    return { filePath: directPath, world: loadWorld(directPath) };
  }

  const byFileName = path.join(WORLD_DIR, ref.endsWith('.yaml') ? ref : `${ref}.yaml`);
  if (fs.existsSync(byFileName)) {
    return { filePath: byFileName, world: loadWorld(byFileName) };
  }

  const needle = ref.toLowerCase();
  const matches = loadWorldSummaries().filter(({ filePath, world }) => {
    const stem = path.basename(filePath, '.yaml').toLowerCase();
    return (
      world.id.toLowerCase() === needle ||
      stem === needle ||
      stem.startsWith(`world-${needle}-`) ||
      stem.endsWith(`-${needle}`) ||
      world.title.toLowerCase().includes(needle)
    );
  });
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    throw new Error(`Ambiguous --world "${ref}". Matches: ${matches.map((m) => m.world.id).join(', ')}`);
  }
  throw new Error(`Unknown --world "${ref}". Use --list-worlds to see available IDs.`);
}

async function pickInitialScenarioWithKeyboard(defaultWorldRef) {
  const defaultBundle = resolveWorldRef(defaultWorldRef);
  const entries = projectTutorStubScenarioPickerEntries({ groupedEntries: groupedWorldEntries(), defaultBundle });
  if (!entries.length) return null;

  let selectedIndex = Math.max(
    0,
    entries.findIndex((entry) => entry.id === defaultBundle?.world?.id),
  );
  const viewportHeight = Math.min(entries.length, Math.max(4, Math.min(8, Math.max(4, Number(output.rows || 24) - 9))));
  let viewportStart = Math.max(0, Math.min(selectedIndex, entries.length - viewportHeight));
  let renderedLineCount = 0;

  const keepSelectionVisible = () => {
    if (selectedIndex < viewportStart) viewportStart = selectedIndex;
    if (selectedIndex >= viewportStart + viewportHeight) viewportStart = selectedIndex - viewportHeight + 1;
  };
  const clearRenderedMenu = () => {
    if (!renderedLineCount) return;
    moveCursor(output, 0, -renderedLineCount);
    for (let index = 0; index < renderedLineCount; index += 1) {
      cursorTo(output, 0);
      clearLine(output, 0);
      if (index < renderedLineCount - 1) moveCursor(output, 0, 1);
    }
    if (renderedLineCount > 1) moveCursor(output, 0, -(renderedLineCount - 1));
    renderedLineCount = 0;
  };
  const renderMenu = () => {
    keepSelectionVisible();
    clearRenderedMenu();
    const lines = projectTutorStubScenarioPickerLines({
      entries,
      selectedIndex,
      viewportStart,
      viewportHeight,
      columns: output.columns,
      colors: C,
    });
    for (const line of lines) output.write(`${line}\n`);
    renderedLineCount = lines.length;
  };

  emitKeypressEvents(input);
  const priorKeypressListeners = input.listeners('keypress');
  for (const listener of priorKeypressListeners) input.removeListener('keypress', listener);
  const wasRaw = Boolean(input.isRaw);
  if (!wasRaw) input.setRawMode(true);

  return new Promise((resolve) => {
    const finish = (selection) => {
      input.removeListener('keypress', onKeypress);
      for (const listener of priorKeypressListeners) input.on('keypress', listener);
      if (!wasRaw) input.setRawMode(false);
      clearRenderedMenu();
      resolve(selection);
    };
    const moveSelection = (delta) => {
      selectedIndex = (selectedIndex + delta + entries.length) % entries.length;
      renderMenu();
    };
    const onKeypress = (character, key = {}) => {
      if ((key.ctrl && key.name === 'c') || key.name === 'escape') {
        finish(null);
        return;
      }
      if (key.name === 'up' || character === 'k') {
        moveSelection(-1);
        return;
      }
      if (key.name === 'down' || character === 'j') {
        moveSelection(1);
        return;
      }
      if (key.name === 'pageup') {
        moveSelection(-viewportHeight);
        return;
      }
      if (key.name === 'pagedown') {
        moveSelection(viewportHeight);
        return;
      }
      if (key.name === 'home') {
        selectedIndex = 0;
        renderMenu();
        return;
      }
      if (key.name === 'end') {
        selectedIndex = entries.length - 1;
        renderMenu();
        return;
      }
      if (key.name === 'return' || key.name === 'enter') finish(entries[selectedIndex]);
    };
    input.on('keypress', onKeypress);
    input.resume();
    renderMenu();
  });
}

async function pickWorkplanModuleWithKeyboard(defaultModuleRef = '') {
  const bundle = loadTutorStubCurriculum('workplan', { root: ROOT });
  const entries = projectTutorStubCurriculumPickerEntries({
    modules: bundle.curriculum.modules || [],
    entries: listTutorStubCurriculumModules(bundle),
  });
  if (!entries.length) return null;

  let selectedIndex = Math.max(
    0,
    entries.findIndex((entry) => entry.id === defaultModuleRef),
  );
  const viewportHeight = Math.min(entries.length, Math.max(4, Math.min(8, Math.max(4, Number(output.rows || 24) - 9))));
  let viewportStart = Math.max(0, Math.min(selectedIndex, entries.length - viewportHeight));
  let renderedLineCount = 0;

  const keepSelectionVisible = () => {
    if (selectedIndex < viewportStart) viewportStart = selectedIndex;
    if (selectedIndex >= viewportStart + viewportHeight) viewportStart = selectedIndex - viewportHeight + 1;
  };
  const clearRenderedMenu = () => {
    if (!renderedLineCount) return;
    moveCursor(output, 0, -renderedLineCount);
    for (let index = 0; index < renderedLineCount; index += 1) {
      cursorTo(output, 0);
      clearLine(output, 0);
      if (index < renderedLineCount - 1) moveCursor(output, 0, 1);
    }
    if (renderedLineCount > 1) moveCursor(output, 0, -(renderedLineCount - 1));
    renderedLineCount = 0;
  };
  const renderMenu = () => {
    keepSelectionVisible();
    clearRenderedMenu();
    const lines = projectTutorStubCurriculumPickerLines({
      entries,
      selectedIndex,
      viewportStart,
      viewportHeight,
      columns: output.columns,
      colors: C,
    });
    for (const line of lines) output.write(`${line}\n`);
    renderedLineCount = lines.length;
  };

  emitKeypressEvents(input);
  const priorKeypressListeners = input.listeners('keypress');
  for (const listener of priorKeypressListeners) input.removeListener('keypress', listener);
  const wasRaw = Boolean(input.isRaw);
  if (!wasRaw) input.setRawMode(true);

  return new Promise((resolve) => {
    const finish = (selection) => {
      input.removeListener('keypress', onKeypress);
      for (const listener of priorKeypressListeners) input.on('keypress', listener);
      if (!wasRaw) input.setRawMode(false);
      clearRenderedMenu();
      resolve(selection);
    };
    const moveSelection = (delta) => {
      selectedIndex = (selectedIndex + delta + entries.length) % entries.length;
      renderMenu();
    };
    const onKeypress = (character, key = {}) => {
      if ((key.ctrl && key.name === 'c') || key.name === 'escape') {
        finish(null);
        return;
      }
      if (key.name === 'up' || character === 'k') {
        moveSelection(-1);
        return;
      }
      if (key.name === 'down' || character === 'j') {
        moveSelection(1);
        return;
      }
      if (key.name === 'pageup') {
        moveSelection(-viewportHeight);
        return;
      }
      if (key.name === 'pagedown') {
        moveSelection(viewportHeight);
        return;
      }
      if (key.name === 'home') {
        selectedIndex = 0;
        renderMenu();
        return;
      }
      if (key.name === 'end') {
        selectedIndex = entries.length - 1;
        renderMenu();
        return;
      }
      if (key.name === 'return' || key.name === 'enter') finish(entries[selectedIndex]);
    };
    input.on('keypress', onKeypress);
    input.resume();
    renderMenu();
  });
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
  cloneValue: jsonClone,
});

function printDirectorNotesIssuedSoFar(state) {
  const notes = directorNotesIssuedSoFar(state);
  for (const line of projectTutorStubDirectorNotesLines(notes, { colors: C })) console.log(line);
  return notes;
}

function worldSpeakerDagPrompt(world) {
  return projectTutorStubWorldSpeakerDagPrompt(world, { ledgerTerm: worldLedgerTerm(world) });
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

function buildLearnerClassifierPrompt({ learnerText, state }) {
  const comprehensionContext = tutorStubComprehensionPrompt(state.comprehension, {
    turn: state.turns.length + 1,
  });
  return [
    '# Task',
    '',
    'Classify the learner input before the tutor responds.',
    'Spell out exactly two headline judgments:',
    '1. What the learner has done in this turn.',
    '2. What the learner has done overall across the dialogue so far.',
    comprehensionContext || null,
    '',
    '# Public tutoring context',
    '',
    `Topic: ${state.topic}`,
    classifierWorldContext(state),
    '',
    '# Previous public transcript',
    '',
    compactPublicTranscriptForPrompt(state, state.historyTurns),
    '',
    '# Current learner turn',
    '',
    learnerText,
    '',
    '# Compact pedagogical discourse rubric',
    '',
    'Conceptual engagement score:',
    '1 = parrots or only asks for an answer; 2 = procedural or surface focus; 3 = some conceptual engagement but mostly paraphrase; 4 = substantive connections or reasoning; 5 = constructs, tests, or revises an interpretation.',
    '',
    'Epistemic readiness score:',
    '1 = pure information reception; 2 = minimal metacognition; 3 = generic awareness of confusion or strategy; 4 = distinguishes genuine understanding from performance and asks evidence-generating questions; 5 = actively monitors bias, uncertainty, evidence, and what would count as knowing.',
    '',
    'Use these controlled labels where possible:',
    '- request_type: conceptual_clarity_request, stepwise_support_request, authority_refusal_or_status_challenge, plain_language_request, plain_simplification_followup, transfer_demand_or_named_material, vulnerability_or_moral_exposure, resistance_or_low_agency, answer_seeking_or_overreach, off_task_or_mixed',
    '- discourse_move: question, claim, hypothesis, inference, evidence_adoption, challenge, repair_request, affective_signal, answer_seeking, metacognitive_reflection, off_task',
    '- discourse_plane: object, instructional_meta, or mixed. Use instructional_meta when the learner is asking about the tutor’s wording, explanation, or terminology rather than making a claim about the subject matter. A request merely to slow clue pacing remains object-level scaffolding.',
    '- evidence_use: none, repeats_setup, cites_public_evidence, omits_warrant, links_evidence_to_rule, overleaps_evidence, distorts_public_evidence, revises_from_evidence',
    '- Use omits_warrant when the learner states a correct public clue and a conclusion but leaves out the bridge that licenses the conclusion. Do not call that links_evidence_to_rule merely because the bridge is easy to infer.',
    '- Use distorts_public_evidence only when the learner misstates, blends, or reassigns an already public clue. Use overleaps_evidence for a premature conclusion or missing warrant without distorted recall.',
    '- Precedence rule: choose distorts_public_evidence, not overleaps_evidence, when the learner says or implies that an earlier/public clue existed when it did not, changes what a public clue said, or blends two public clues into a false remembered detail. This remains true when the distortion also supports a premature conclusion.',
    '- Otherwise choose omits_warrant over links_evidence_to_rule when the bridge is absent; reserve overleaps_evidence for a claim that outruns the currently public evidence, especially a premature culprit or case-closing inference.',
    '- Resolve short answers, pronouns, and ellipsis against the immediately preceding tutor question before classifying them. A reply such as "it will be the same" can fully answer a local single-referent question even though it does not repeat the noun.',
    '- Do not label a contextually complete short answer confused, passive, or evidence-free merely because it omits words already supplied by the preceding question. Preserve any genuinely missing warrant as a separate strict-audit issue.',
    '- epistemic_stance: receptive, confused, exploratory, overconfident, resistant, answer_seeking, reflective, grounded',
    '- agency: passive, complying, attempting, steering, self_correcting',
    '',
    '# Request type registry',
    '',
    'Request type belongs to the logical armature: it describes what kind of move/device the learner turn calls for in the DAG or proof path. It is not the tutor engagement stance.',
    requestTypePromptRows(),
    '',
    '# JSON schema',
    '',
    JSON.stringify(
      {
        turn: {
          summary: 'plain-language sentence naming what the learner did in this turn',
          request_type: 'logical request type, not a tutor engagement stance',
          discourse_move: 'one controlled label',
          discourse_plane: 'object, instructional_meta, or mixed',
          evidence_use: 'one controlled label',
          epistemic_stance: 'one controlled label',
          affect: 'brief affect/energy label',
          agency: 'one controlled label',
          scores: {
            conceptual_engagement: { score: 1, reason: 'brief reason' },
            epistemic_readiness: { score: 1, reason: 'brief reason' },
          },
          pedagogical_need: 'what the tutor should attend to immediately',
        },
        overall: {
          summary: 'plain-language sentence naming what the learner has done overall',
          trajectory: 'how their participation is changing or not changing',
          recurring_pattern: 'dominant pattern across turns, or none yet',
          current_state: 'where the learner seems to be now',
          next_best_tutor_move: 'best immediate tutor move based on public evidence only',
        },
      },
      null,
      2,
    ),
  ]
    .filter((line) => line !== null)
    .join('\n');
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
    });
    throw err;
  }
}

async function callClassifierModel({
  prompt,
  resolved,
  trace = null,
  stream = null,
  cliEffort = null,
  turn = null,
  signal = null,
}) {
  return await callPromptModel({
    prompt,
    resolved,
    systemPrompt: CLASSIFIER_SYSTEM_PROMPT,
    role: 'tutor_stub_learner_classifier',
    maxTokens: 700,
    trace,
    stream,
    cliEffort,
    turn,
    signal,
  });
}

async function classifyLearnerInput({ learnerText, state, signal = null }) {
  const startedAt = Date.now();
  try {
    const prompt = buildLearnerClassifierPrompt({ learnerText, state });
    const raw = await callClassifierModel({
      prompt,
      resolved: state.classifier.resolved,
      trace: state.trace,
      stream: state.stream,
      cliEffort: state.cliEffort,
      turn: state.turns.length + 1,
      signal,
    });
    const { parsed, parseError } = parseClassifierJson(raw.text);
    return {
      ...parsed,
      parseError,
      provider: raw.provider,
      model: raw.model,
      latencyMs: raw.latencyMs,
      usage: raw.usage,
    };
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    return failedClassification({
      message: err.message,
      resolved: state.classifier.resolved,
      latencyMs: Date.now() - startedAt,
    });
  }
}

function printClassification(classification) {
  if (!classification) return;
  const turn = classification.turn || {};
  const overall = classification.overall || {};
  const presentation = {
    summary: turn.summary || 'No turn summary.',
    requestType: turn.request_type || 'unknown_request',
    discourseMove: turn.discourse_move || 'unknown',
    epistemicStance: turn.epistemic_stance || 'unknown',
    conceptual: scoreValue(turn.scores?.conceptual_engagement),
    readiness: scoreValue(turn.scores?.epistemic_readiness),
    learningPace: turn.learning_pace || '',
    reasoningSpan: turn.reasoning_span || '',
    overallSummary: overall.summary || 'No overall summary.',
    pedagogicalNeed: turn.pedagogical_need || overall.next_best_tutor_move || '',
    warning: classification.error || classification.parseError || '',
  };
  for (const line of projectTutorStubLearnerClassificationLines(presentation, { colors: C })) console.log(line);
}

const applyLearnerAdvanceAssessment = (classification, tutorLearnerDag) =>
  applyTutorStubLearnerAdvanceAssessment(classification, tutorLearnerDag, { scoreValue });

function clearStatusLine() {
  process.stdout.write('\r\x1b[2K');
}

function printWithConcurrentTerminal(state, callback) {
  const terminal = state?.concurrentTerminal;
  return terminal?.enabled ? terminal.print(callback) : callback();
}

function interimAnimationAvailable(interim) {
  return Boolean(interim?.enabled && output.isTTY && cliPresentation.motion !== 'off');
}

const compactInterimFieldSummary = (state) => summarizeTutorStubInterimField(state, { buildLightweightDialogueField });

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
  summarizeTutorStubEvidenceTiming(state, context, { currentReleaseRows, nextReleaseRow, committedReleaseRows });

const compactPendingTutorDagSummary = (state, context) =>
  summarizeTutorStubPendingTutorDag(state, context, { buildTutorDagSnapshot });

const compactPendingFieldSummary = (state, context) =>
  summarizeTutorStubPendingField(state, context, {
    buildLightweightDialogueField,
    lightweightFieldTurn,
    buildTutorDagSnapshot,
  });

function currentReleaseRows(state, tutorTurn) {
  return projectTutorStubCurrentReleaseRows(state?.releasePacing, state?.world, tutorTurn, {
    pointOfAction: state?.pointOfAction?.current || null,
    projectPremise: projectTutorStubSpeakerPublicPremise,
  });
}

function committedReleaseRows(state, throughTurn = Number.POSITIVE_INFINITY) {
  return projectTutorStubCommittedReleaseRows(state?.releasePacing, state?.world, throughTurn, {
    fallbackRows: stagedEvidenceRows,
    projectPremise: projectTutorStubSpeakerPublicPremise,
  });
}

function publicReleaseLedger(state, throughTurn = Number.POSITIVE_INFINITY) {
  return projectTutorStubPublicReleaseLedger(committedReleaseRows(state, throughTurn));
}

function learnerPublicEvidenceState(state, tutorTurn) {
  return projectTutorStubLearnerPublicEvidenceState(committedReleaseRows(state, tutorTurn));
}

function learnerDagPreflightForTurn(state, tutorTurn, { traceSource = null } = {}) {
  if (!state?.learnerDag?.enabled || !state.world) return null;
  const publicEvidence = learnerPublicEvidenceState(state, tutorTurn);
  const preflight = buildTutorStubLearnerDagPreflight({
    world: state.world,
    record: state.learnerDag.record,
    tutorTurn,
    publicStagedEvidence: publicEvidence.publicStagedEvidence,
  });
  if (traceSource) {
    appendTraceEvent(state.trace, {
      type: 'learner_dag_preflight',
      turn: tutorTurn,
      source: traceSource,
      timing: 'before_model_call',
      preflight,
    });
  }
  return preflight;
}

function nextReleaseRow(state) {
  return projectTutorStubNextReleaseRow(state?.releasePacing, state?.world);
}

function compactInterimPanels(active) {
  const context = active.context || {};
  return projectTutorStubInterimPanels({
    hints: compactInterimCliHintPanels(active),
    tutorFocus: compactPendingObjectiveSummary(active.state, context),
    dialogueOutlook: compactPendingFieldSummary(active.state, context),
    reasoningChange: compactPendingDagMovementSummary(active.state, context),
    learnerReasoning: compactLearnerRecordUpdateSummary(active.state, context),
    evidencePacing: compactEvidenceTimingSummary(active.state, context),
    learnerReading: compactPendingLearnerSummary(context),
    reasoningState: compactPendingLearnerDagSummary(context),
    tutorStyle: compactPendingRegisterSummary(context),
    clueProgress: compactPendingTutorDagSummary(active.state, context),
    dialogueSoFar: compactInterimFieldSummary(active.state),
    fallback: compactInterimStateSummary(active.state),
  });
}

function renderInterimStatus(active) {
  active.tick += 1;
  return renderTutorStubInterimFrame({
    tick: active.tick,
    startedAt: active.startedAt,
    now: Date.now(),
    columns: output.columns,
    phase: active.basePhase || active.phase,
    panels: compactInterimPanels(active),
    frames: tutorStubCliSpinnerFrames(cliPresentation),
    colors: C,
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

function startInterimAnimation(state, phase, context = null) {
  const interim = getInterimState(state);
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
    const rendered = `${renderInterimStatus(active)}${C.reset}`;
    if (interimConcurrentTerminalIsVisible(active)) {
      if (active.renderTarget === 'direct') clearStatusLine();
      active.state.concurrentTerminal.setStatus(rendered);
      active.renderTarget = 'concurrent';
    } else {
      if (active.renderTarget === 'concurrent') active.state.concurrentTerminal.clearStatus();
      clearStatusLine();
      process.stdout.write(`${rendered}\r`);
      active.renderTarget = 'direct';
    }
    active.rendered = true;
  };
  interim.active = active;
  active.render();
  active.interval = setInterval(active.render, tutorStubCliMotionInterval(cliPresentation));
  active.interval.unref?.();
  return active;
}

function stopInterimAnimation(holder, { clear = true } = {}) {
  const interim = getInterimState(holder);
  const active = interim?.active;
  if (!active) return false;
  if (active.interval) clearInterval(active.interval);
  interim.active = null;
  if (clear) clearRenderedInterimStatus(active);
  return true;
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
  const interim = getInterimState(holder);
  const active = interim?.active;
  if (!active || active.paused) return false;
  if (active.interval) clearInterval(active.interval);
  active.interval = null;
  active.paused = true;
  clearRenderedInterimStatus(active);
  return true;
}

function resumeInterimAnimation(holder) {
  const interim = getInterimState(holder);
  const active = interim?.active;
  if (!active || !active.paused || !interimAnimationAvailable(interim)) return false;
  active.paused = false;
  active.render();
  active.interval = setInterval(active.render, tutorStubCliMotionInterval(cliPresentation));
  active.interval.unref?.();
  return true;
}

function captureTraceProvenance(metadata) {
  // Step 0.2 of PRECONSCIOUS-FINAL-STRETCH-PLAN.md: every run header carries
  // the commit and a hash of the resolved configuration, so model/config
  // drift is detectable from the trace alone (the terra flag-forwarding
  // incident was only caught by cross-checking run_start metadata by hand).
  // Failure-tolerant: an unreadable git state must never block the CLI.
  return captureTutorStubRunProvenance(metadata, { hashCanonicalJson, captureGitProvenanceSummary, repoRoot: ROOT });
}

function createTraceState({ enabled, traceDir, metadata }) {
  if (!enabled) return { enabled: false };
  const dir = resolveWorkspacePath(traceDir);
  const runId = safeTimestampForFile();
  const filePath = path.join(dir, `${runId}.jsonl`);
  fs.mkdirSync(dir, { recursive: true });
  const enrichedMetadata = { ...(metadata || {}), provenance: captureTraceProvenance(metadata) };
  const trace = {
    enabled: true,
    dir,
    filePath,
    runId,
    seq: 0,
    metadata: enrichedMetadata,
  };
  appendTraceEvent(trace, {
    type: 'run_start',
    metadata: enrichedMetadata,
  });
  return trace;
}

function appendTraceEvent(trace, event) {
  if (!trace?.enabled) return;
  const entry = {
    ts: new Date().toISOString(),
    runId: trace.runId,
    seq: ++trace.seq,
    ...event,
  };
  if (!entry.turnId && entry.turn !== undefined && entry.turn !== null) {
    entry.turnId = formatTurnDebugId(trace.runId, entry.turn);
  } else if (!entry.turnId && entry.type === 'tutor_opening') {
    entry.turnId = openingDebugId(trace.runId);
  }
  fs.appendFileSync(trace.filePath, `${JSON.stringify(redactTraceSecrets(entry))}\n`);
}

function appendTutorStubTurnFailureTraceRecords(state, { sealed = false } = {}) {
  if (!state?.trace?.enabled || !state.turns?.length) return [];
  try {
    const events = buildTutorStubTurnFailureTraceEvents({
      runStart: {
        runId: state.trace.runId,
        metadata: state.trace.metadata || {},
      },
      turnRecords: state.turns,
      tracePath: traceDisplayPath(state.trace),
      traceSealed: sealed,
      opening: state.openingRealization?.text || '',
      phase: sealed ? 'sealed' : 'incremental',
      feedbackRecords: state.turnFailureFeedbackRecords || [],
    });
    for (const event of events) appendTraceEvent(state.trace, event);
    return events;
  } catch (error) {
    appendTraceEvent(state.trace, {
      type: 'turn_failure_recording_error',
      phase: sealed ? 'sealed' : 'incremental',
      turn: state.turns.at(-1)?.turn ?? null,
      error: String(error?.message || error),
      publicTranscriptChanged: false,
    });
    return [];
  }
}

function reserveTutorStubMeteredModelCall({ trace = null, role = 'unknown', turn = null } = {}) {
  if (!selectedLabModelCallBudget) return null;
  try {
    const reservation = selectedLabModelCallBudget.reserve({ role, turn });
    appendTraceEvent(trace, {
      type: 'model_call_budget_reserved',
      role,
      turn,
      admission: reservation,
    });
    return reservation;
  } catch (error) {
    appendTraceEvent(trace, {
      type: 'model_call_budget_exhausted',
      role,
      turn,
      admission: selectedLabModelCallBudget.snapshot(),
    });
    throw error;
  }
}

function reserveProgram2ProviderBudget({ maxTokens, trace = null, role = 'unknown', turn = null } = {}) {
  if (!program2ProviderBudget) return null;
  try {
    const reservation = program2ProviderBudget.reserve({ maxTokens });
    appendTraceEvent(trace, { type: 'program2_provider_budget_reserved', role, turn, ...reservation });
    return reservation;
  } catch (error) {
    appendTraceEvent(trace, {
      type: 'program2_provider_budget_denied',
      role,
      turn,
      requestedOutputTokens: Math.max(0, Number(maxTokens || 0)),
      ...program2ProviderBudget.snapshot(),
    });
    throw error;
  }
}

function printAutomaticTechnicalDetails(state, render) {
  return printTutorStubAutomaticTechnicalDetails(state, render, { print: printWithConcurrentTerminal });
}

function traceDisplayPath(trace) {
  return tutorStubTraceDisplayPath(trace, { relativePath: path.relative, repoRoot: ROOT });
}

function jsonClone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function restoreDirectorGuidanceState(state, events = []) {
  const lastClear = events.reduce(
    (index, event, candidate) => (event?.type === 'history_clear' ? candidate : index),
    -1,
  );
  const snapshot = [...events.slice(lastClear + 1)]
    .reverse()
    .map((event) => event?.directorGuidance || null)
    .find(Boolean);
  state.directorGuidance = createTutorStubDirectorGuidanceState(snapshot);
  return {
    restored: Boolean(snapshot),
    revision: state.directorGuidance.revision,
    active: Boolean(state.directorGuidance.active),
  };
}

function typedActionDecisionFromTurn(turn) {
  const candidates = [
    turn?.typedActionDecision,
    turn?.typed_action_decision,
    turn?.registerSelection?.typed_action_decision,
  ];
  return candidates.find((candidate) => candidate && typeof candidate === 'object' && candidate.contract_id) || null;
}

function restoreTypedActionState(state, turns, events = []) {
  if (!state.typedActions?.enabled) {
    return { enabled: false, restored: false, ledgerRecords: 0, pendingContractId: null, phase: null };
  }
  const lastClear = events.reduce(
    (index, event, candidate) => (event?.type === 'history_clear' ? candidate : index),
    -1,
  );
  const activeEvents = events.slice(lastClear + 1);
  const records = new Map();
  const order = [];
  const decisions = new Map();
  let lifecycle = null;
  const rememberRecord = (record) => {
    const contractId = record?.contract_id;
    if (!contractId) return;
    if (records.get(contractId)?.status === 'closed' && record.status !== 'closed') return;
    if (!records.has(contractId)) order.push(contractId);
    records.set(contractId, jsonClone(record));
  };
  const rememberDecision = (decision, pendingIntervention = null) => {
    const contractId = decision?.contract_id;
    if (!contractId || typeof decision !== 'object') return;
    decisions.set(contractId, jsonClone(decision));
    if (pendingIntervention?.contract_id === contractId) {
      rememberRecord(pendingIntervention);
      return;
    }
    if (!records.has(contractId) && decision.adaptation_contract?.contract_id === contractId) {
      rememberRecord(createPendingIntervention(decision.adaptation_contract));
    }
  };

  for (const event of activeEvents) {
    if (event?.type === 'tutor_typed_action_decision') {
      rememberDecision(event.decision, event.pendingIntervention);
    } else if (event?.type === 'tutor_typed_action_outcome_closed') {
      rememberRecord(event.outcome?.closed_record);
    } else if (event?.type === 'tutor_scaffold_lifecycle_transition' && event.lifecycle) {
      lifecycle = jsonClone(event.lifecycle);
    }
  }
  for (const turn of turns) {
    const decision = typedActionDecisionFromTurn(turn);
    if (decision) rememberDecision(decision);
    const closedRecord =
      turn?.typedActionOutcomeAfterNextLearner?.closed_record || turn?.typedActionPriorOutcome?.closed_record || null;
    if (closedRecord) rememberRecord(closedRecord);
  }

  const ledger = order.map((contractId) => records.get(contractId)).filter(Boolean);
  const pending = ledger.filter((record) => record.status === 'pending');
  if (pending.length > 1) {
    throw new Error(
      `resume typed-action trace has multiple pending interventions: ${pending.map((record) => record.contract_id).join(', ')}`,
    );
  }
  const pendingContractId = pending[0]?.contract_id || null;
  const currentDecision = pendingContractId ? decisions.get(pendingContractId) || null : null;
  if (pendingContractId && !currentDecision) {
    throw new Error(`resume typed-action trace is missing decision provenance for ${pendingContractId}`);
  }

  lifecycle =
    lifecycle ||
    [...turns]
      .reverse()
      .map((turn) => turn?.scaffoldLifecycle || null)
      .find(Boolean) ||
    createScaffoldLifecycle();
  if (pendingContractId && !lifecycle.pending_contract_id && currentDecision) {
    lifecycle = advanceScaffoldLifecycle(createScaffoldLifecycle(), {
      kind: 'typed_action_decision',
      turn: currentDecision.chosen_action?.turn || currentDecision.adaptation_contract?.turn_index || null,
      decision: currentDecision,
    }).lifecycle;
  }
  validateScaffoldLifecycle(lifecycle);
  if (pendingContractId && lifecycle.pending_contract_id !== pendingContractId) {
    throw new Error(
      `resume typed-action lifecycle pending contract ${lifecycle.pending_contract_id || 'none'} does not match ledger ${pendingContractId}`,
    );
  }
  if (!pendingContractId && lifecycle.pending_contract_id) {
    throw new Error(
      `resume typed-action lifecycle has orphaned pending contract ${lifecycle.pending_contract_id} without a ledger record`,
    );
  }
  state.typedActions.ledger = ledger;
  state.typedActions.currentDecision = currentDecision;
  state.typedActions.scaffoldLifecycle = lifecycle;
  return {
    enabled: true,
    restored: Boolean(ledger.length || currentDecision || lifecycle.transition_count),
    ledgerRecords: ledger.length,
    closedRecords: ledger.filter((record) => record.status === 'closed').length,
    pendingContractId,
    currentActionType: currentDecision?.chosen_action?.action_type || null,
    phase: lifecycle.phase,
    lifecycleTransitions: lifecycle.transition_count,
  };
}

function replayLearnerDagFromTurns(state, turns) {
  if (!state.learnerDag?.enabled || !state.world) return { replayed: 0, skipped: 0 };
  let replayed = 0;
  let skipped = 0;
  for (const turn of turns) {
    const accepted = turn?.tutorLearnerDagUpdate?.accepted;
    if (accepted) {
      const result = applyLearnerRecordUpdate({
        update: {
          adopt: accepted.adopt || [],
          retract: accepted.retract || [],
          derive: accepted.derive || [],
          hypothesis: accepted.hypothesis || null,
          assert_answer: accepted.assertAnswer || null,
          human_discourse: accepted.humanDiscourse || null,
        },
        state,
        tutorTurn: Number(turn.turn) || replayed + 1,
        learnerText: turn.learner || '',
        dropoutReplay: turn?.dagFactDropout || turn?.tutorLearnerDagUpdate?.dagFactDropout || { legacyNoDropout: true },
        ...learnerPublicEvidenceState(state, Number(turn.turn) || replayed + 1),
      });
      state.learnerDag.lastModel = result.model;
      replayed += 1;
      continue;
    }
    if (turn?.tutorLearnerDagModel) {
      state.learnerDag.lastModel = jsonClone(turn.tutorLearnerDagModel);
      skipped += 1;
    }
  }
  return { replayed, skipped };
}

function restoreDialogueFromTrace(state, resume, { currentWorld, restoreOpening = false }) {
  if (!resume?.turns?.length) return null;
  const turns = resume.turns.map((turn) => jsonClone(turn));
  state.turns = turns;
  state.history = [];
  if (restoreOpening) {
    const lastClearIndex = (resume.events || []).reduce(
      (index, event, candidate) => (event?.type === 'history_clear' ? candidate : index),
      -1,
    );
    const activeEvents = (resume.events || []).slice(lastClearIndex + 1);
    const opening = activeEvents.find(
      (event) => event?.type === 'tutor_opening' && typeof event.text === 'string' && event.text.trim(),
    );
    const openingRestatement = [...activeEvents]
      .reverse()
      .find(
        (event) =>
          event?.type === 'tutor_character_restatement_completed' &&
          event?.target?.targetKind === 'opening' &&
          typeof event.text === 'string' &&
          event.text.trim(),
      );
    if (opening) {
      state.history.push({ role: 'assistant', content: openingRestatement?.text || opening.text });
      if (openingRestatement) {
        state.openingRealization = {
          schema: 'machinespirits.tutor-stub.resumed-character-restated-opening.v1',
          originalText: opening.text,
          text: openingRestatement.text,
          characterRestatements: [jsonClone(openingRestatement)],
          source: 'resume_trace',
        };
      }
    }
  }
  for (const turn of turns) {
    if (turn.learner) state.history.push({ role: 'user', content: turn.learner });
    if (turn.tutor) state.history.push({ role: 'assistant', content: turn.tutor });
  }

  const register = restoreRegisterStateFromTurns(state, turns);
  const comprehension = restoreComprehensionState(state, turns, resume.events || []);
  const directorGuidance = restoreDirectorGuidanceState(state, resume.events || []);
  const learnerDag = replayLearnerDagFromTurns(state, turns);
  const typedActions = restoreTypedActionState(state, turns, resume.events || []);
  const storedClosure = turns.at(-1)?.dialogueClosure?.lifecycle || null;
  if (storedClosure && state.dialogueClosure?.enabled) {
    state.dialogueClosure = {
      ...state.dialogueClosure,
      ...jsonClone(storedClosure),
      enabled: true,
      allowCheckIn: state.dialogueClosure.allowCheckIn,
      allowAuthoredDagClosure: state.dialogueClosure.allowAuthoredDagClosure,
    };
  } else if (state.dialogueClosure?.enabled && turns.length) {
    const last = turns.at(-1);
    const frame = buildTutorStubDialogueClosureFrame({
      lifecycle: state.dialogueClosure,
      learnerDagModel: last?.tutorLearnerDagModel || null,
      tutorDagSnapshot: last?.tutorDag || null,
      answerTerm: answerTermForWorld(state.world),
    });
    const audit = auditTutorStubDialogueClosureResponse({ text: last?.tutor || '', frame });
    if (audit.ok && audit.closesDialogue) {
      state.dialogueClosure = advanceTutorStubDialogueClosure(state.dialogueClosure, {
        frame,
        audit,
        turn: last.turn,
      });
    } else if (audit.closesDialogue && state.dialogueClosure.allowCheckIn) {
      state.dialogueClosure = {
        ...state.dialogueClosure,
        phase: 'awaiting_checkin',
        reachedAtTurn: Number(last.turn) || null,
        basis: frame.basis || 'legacy_conversational_closure',
      };
    }
  }
  const warnings = [];
  const resumedWorld = resume.metadata?.world?.id || null;
  if (resumedWorld && currentWorld?.id && resumedWorld !== currentWorld.id) {
    warnings.push(`trace world ${resumedWorld} differs from current world ${currentWorld.id}`);
  }
  return {
    source: resume.filePath,
    turns: turns.length,
    register,
    comprehension,
    directorGuidance,
    learnerDag,
    typedActions,
    dialogueClosure: state.dialogueClosure,
    metadata: resume.metadata || null,
    warnings,
  };
}

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

async function classifyForTurn(learnerText, state, { signal = null } = {}) {
  if (!state.classifier.enabled) return null;
  startInterimAnimation(state, 'classifying learner');
  const classification = await classifyLearnerInput({ learnerText, state, signal });
  stopInterimAnimation(state);
  printAutomaticTechnicalDetails(state, () => printClassification(classification));
  return classification;
}

function activeDramaturgyAct(world, tutorTurn) {
  const acts = world?.dramaturgy?.acts;
  if (!Array.isArray(acts)) return null;
  const turn = Number(tutorTurn);
  if (!Number.isFinite(turn)) return null;
  const act = acts.find((entry) => {
    const [start, end] = Array.isArray(entry?.turns) ? entry.turns.map(Number) : [];
    return Number.isFinite(start) && Number.isFinite(end) && turn >= start && turn <= end;
  });
  if (!act) return null;
  return {
    act: act.act || null,
    title: String(act.title || '').trim() || null,
    intent: String(act.intent || '').trim() || null,
    turns: Array.isArray(act.turns) ? act.turns : null,
  };
}

function branchTemplateForEvidence(row = {}, world = null, { conclusionReady = false } = {}) {
  return buildTutorStubWorldScaffold({ world, evidence: row, conclusionReady });
}

function scaffoldBranchForTurn({ state, world, tutorTurn, tutorLearnerDag }) {
  if (!world) return branchTemplateForEvidence({}, world);
  const dueNow = currentReleaseRows(state, tutorTurn);
  if (dueNow.length) return branchTemplateForEvidence(dueNow[0], world);
  const latestReleased = committedReleaseRows(state, tutorTurn).at(-1);
  const assessment = tutorLearnerDag?.model?.assessment || tutorLearnerDag?.assessment || {};
  if (assessment.finalSecretEntailed || assessment.bottleneck === 'assertion_gap') {
    return branchTemplateForEvidence(latestReleased || {}, world, { conclusionReady: true });
  }
  if (latestReleased) return branchTemplateForEvidence(latestReleased, world);
  // A scheduled-but-not-due clue belongs to the private planner. The public
  // scaffold must remain open until that clue is actually due or released.
  return branchTemplateForEvidence({}, world);
}

function buildScaffoldState({ state, tutorTurn, dagMode, tutorLearnerDag }) {
  const world = state?.world || null;
  return projectTutorStubScaffoldState({
    dagMode,
    tutorTurn,
    activeAct: activeDramaturgyAct(world, tutorTurn),
    branch: scaffoldBranchForTurn({ state, world, tutorTurn, tutorLearnerDag }),
    dueNow: currentReleaseRows(state, tutorTurn),
    released: committedReleaseRows(state, tutorTurn),
    nextRelease: nextReleaseRow(state),
  });
}

function buildWarrantPremiseAudit({ dagMode, tutorLearnerDag, classification = null, learnerText = '', world = null }) {
  const model = tutorLearnerDag?.model || tutorLearnerDag || null;
  const record = model?.learnerRecord || {};
  const explicitWarrants = projectTutorStubPublicStocktakeRows(record.voicedDerived, 'voiced_derived_public_claim');
  const explicitPublicPremises = projectTutorStubPublicStocktakeRows(record.grounded, 'grounded_public_record');
  const extraction = normalizeHumanDiscourseExtraction(
    tutorLearnerDag?.accepted?.humanDiscourse || tutorLearnerDag?.extractor?.humanDiscourse,
  );
  const turn = classification?.turn || {};
  const overleap = /overleaps_evidence|distorts_public_evidence|overconfident|answer_seeking/iu.test(
    [turn.evidence_use, turn.epistemic_stance, turn.discourse_move].filter(Boolean).join(' '),
  );
  const heuristicMissingWarrants =
    overleap && explicitWarrants.length === 0
      ? [
          {
            surface: oneLine(learnerText, { max: 180 }),
            reason: 'classifier marked overreach or answer-seeking before an explicit public warrant was stored',
            source: 'heuristic_overleap',
          },
        ].filter((row) => row.surface)
      : [];
  const rejectedDebt = normalizeDiscourseRows(
    (tutorLearnerDag?.rejected || [])
      .filter((row) => row?.type === 'derive' || row?.type === 'assert' || row?.reason === 'not staged')
      .map((row) => ({
        surface: Array.isArray(row.value) ? factSurface(world, row.value) : String(row.value || ''),
        reason: row.reason || 'rejected by strict learner-DAG update',
      })),
    'strict_dag_rejection',
  );
  const strictProofAdoptions = [
    ...(tutorLearnerDag?.accepted?.adopt || []).map((premise) => ({
      surface: premise,
      source: 'strict_adopted_premise',
    })),
    ...(tutorLearnerDag?.accepted?.derive || []).map((fact) => ({
      surface: factSurface(world, fact),
      source: 'strict_derived_public_claim',
    })),
  ].filter((row) => row.surface);
  return projectTutorStubWarrantPremiseAudit({
    dagMode,
    model,
    extraction,
    explicitWarrants,
    explicitPublicPremises,
    heuristicMissingWarrants,
    rejectedDebt,
    strictProofAdoptions,
  });
}

function buildHumanDiscourseFrame({ state, tutorTurn, tutorLearnerDag, classification = null, learnerText = '' }) {
  const dagMode = state?.dagMode || 'strict_dag';
  const scaffoldState = buildScaffoldState({ state, tutorTurn, dagMode, tutorLearnerDag });
  const generousInference = resolveTutorStubGenerousInference({
    mode: dagMode,
    learnerText,
    previousTutorText: latestTutorMessage(state),
    branchId: scaffoldState.branch?.id || null,
    classification,
  });
  const conversationalCompletion = resolveTutorStubConversationalCompletion({
    mode: dagMode,
    learnerText,
    previousTutorText: latestTutorMessage(state),
    classification,
    tutorLearnerDag,
    generousInference,
  });
  if (tutorLearnerDag) tutorLearnerDag.conversationalCompletion = conversationalCompletion;
  const sideArc = buildSideArcState({
    dagMode,
    classification,
    learnerText,
    scaffoldState,
    generousInference,
  });
  const discoursePlane = resolveTutorStubDiscoursePlane({ learnerText, classification, sideArc });
  const warrantPremiseAudit = buildWarrantPremiseAudit({
    dagMode,
    tutorLearnerDag,
    classification,
    learnerText,
    world: state?.world || null,
  });
  const strictDag = buildStrictDagAuditState(tutorLearnerDag);
  const proofDebt = buildTutorStubProofDebtState({
    dagMode,
    warrantPremiseAudit,
    strictDag,
    classification,
    generousInference,
  });
  const questionSupport =
    dagMode === 'strict_dag' || discoursePlane.freeze_clue_release
      ? null
      : buildTutorStubQuestionSupport({
          tutorTurn,
          scaffoldState,
          assessment: tutorLearnerDag?.model?.assessment || tutorLearnerDag?.assessment || null,
          classification,
          learnerText,
          recentTurns: state?.turns || [],
          multipleChoice: Boolean(state?.multipleChoice),
        });
  return {
    schema: HUMAN_DISCOURSE_FRAME_SCHEMA,
    mode: dagMode,
    phase: HUMAN_DISCOURSE_PHASE,
    scaffoldActive: dagMode !== 'strict_dag',
    stepCompression: state?.humanDiscourse?.stepCompression || null,
    turn: tutorTurn,
    strictDag,
    scaffoldState,
    sideArc,
    discoursePlane,
    proofDebt,
    questionSupport,
    warrantPremiseAudit,
    generousInference,
    conversationalCompletion,
  };
}

function buildLearnerRecordPrompt({ learnerText, state, tutorTurn, dagPreflight = null }) {
  const staged = committedReleaseRows(state, tutorTurn);
  const comprehensionContext = tutorStubComprehensionPrompt(state.comprehension, { turn: tutorTurn });
  return [
    '# Task',
    '',
    'Extract a conservative public learner-record update from the current learner turn.',
    "This update feeds a tutor-side model of the learner DAG. It is not the learner's private state.",
    comprehensionContext || null,
    '',
    '# Public question',
    state.world.question,
    '',
    '# Public rules',
    ...state.world.rules.map(ruleText),
    '',
    dagPreflight ? '# Deterministic learner-DAG preflight — computed before this model call' : null,
    dagPreflight ? JSON.stringify(dagPreflight, null, 2) : null,
    dagPreflight
      ? 'This constrains possible updates but commits nothing. Extract only what the current learner turn actually expresses; deterministic validation follows this call.'
      : null,
    dagPreflight ? '' : null,
    '# Staged public evidence available at or before this turn',
    staged.length
      ? staged
          .map((row) => {
            return [
              `- ${row.premise} (staged turn ${row.turn} via ${row.via})`,
              `  surface: ${row.surface}`,
              `  fact: ${JSON.stringify(row.fact)}`,
            ].join('\n');
          })
          .join('\n')
      : '- none',
    '',
    '# Previous public transcript',
    compactPublicTranscriptForPrompt(state, state.historyTurns),
    '',
    '# Current learner turn',
    learnerText,
    '',
    '# Extraction rules',
    '',
    '- adopt: include only staged premise ids the learner explicitly accepts, uses, restates, or treats as evidence.',
    '- retract: include only staged premise ids the learner explicitly rejects or withdraws.',
    '- derive: include fact arrays only when the learner voices a conclusion supported by adopted/staged evidence and public rules.',
    '- Single-step trial-book rule: if the learner states a warranted conclusion from staged evidence, include both the supporting staged premise ids in adopt and the conclusion fact in derive. Do not require a separate "add it to the book" utterance.',
    '- Multi-premise advance: one learner turn may explicitly use several staged premises and may voice several supported intermediate conclusions. Return every warranted adoption and derivation in the order voiced; do not stop after the first valid proof move.',
    '- A follow-up premise supplied by the learner counts only when it is public and derivable from staged/adopted evidence plus the public rules. Never promote an unstaged story fact merely because it would accelerate the proof.',
    '- Resolve pronouns and elliptical answers against the immediately preceding tutor question. If a short reply such as "the same" unambiguously answers a single-referent local question, treat the resolved content as learner-voiced; do not require the learner to repeat the noun or name.',
    '- hypothesis: one short sentence if the learner offers a conjecture, uncertainty, or provisional theory.',
    '- assert_answer: the named answer candidate if the learner directly answers the public question; otherwise null.',
    '- human_discourse.proof_status: strict_proof, provisional_scaffold, side_arc, hidden_premise_risk, or unclear.',
    '- human_discourse.provisional_claims: claims the learner is allowed to hold provisionally before the strict proof is complete.',
    '- human_discourse.implied_warrants: inference rules the learner is using in ordinary language without spelling them out.',
    '- human_discourse.missing_warrants: warrants the learner needs before the claim counts as strict proof.',
    '- human_discourse.implied_public_premises: public assumptions suggested by the transcript but not yet stored as strict grounded premises.',
    '- human_discourse.suppressed_or_private_premises: premises the learner seems to rely on that are not public in the staged evidence.',
    '- human_discourse.common_sense_bridges: harmless everyday bridges that can be allowed provisionally but may need repair.',
    '- human_discourse.illicit_hidden_premises: any apparent use of hidden or unstaged story facts.',
    '- human_discourse.proof_debt_candidates: provisional leaps or missing warrants the tutor should keep visible for later repair.',
    '- human_discourse.side_arc: clarification, vocabulary, affective, trust, or off-path requests that should be answered briefly before returning to the proof path.',
    '- A wording-only or vocabulary-only clarification request is a non-DAG side-state: record it as a side arc, but do not adopt premises, derive facts, or assert an answer from the request itself.',
    '- Be conservative. Do not mark staged evidence adopted merely because it exists.',
    '',
    '# JSON schema',
    '',
    JSON.stringify(
      {
        adopt: ['premise_id'],
        retract: ['premise_id'],
        derive: [['predicate', 'arg1', 'arg2']],
        hypothesis: 'short hypothesis or null',
        assert_answer: 'candidate name or null',
        human_discourse: humanDiscourseExtractionSchema(),
        notes: 'brief reason for the extraction',
      },
      null,
      2,
    ),
  ]
    .filter((line) => line !== null)
    .join('\n');
}

function buildCombinedLearnerAnalysisPrompt({
  learnerText,
  state,
  tutorTurn,
  dagPreflight = null,
  tutorFeedback = null,
}) {
  const { publicStagedEvidence } = learnerPublicEvidenceState(state, tutorTurn);
  return buildTutorStubPublicLearnerAnalysisPrompt({
    learnerText,
    topic: state.topic,
    world: state.world,
    tutorTurn,
    publicTranscript: compactPublicTranscriptForPrompt(state, state.historyTurns),
    // Completed turns already contain their tutor response. Only the first
    // learner analysis needs the opening assistant message supplied
    // separately, matching the benchmark's T0 -> L1 chronology without
    // duplicating later tutor turns.
    currentTutorText: state.turns.length === 0 ? latestTutorMessage(state) : '',
    historyTurns: state.historyTurns,
    comprehensionContext: tutorStubComprehensionPrompt(state.comprehension, { turn: tutorTurn }),
    learnerDagEnabled: Boolean(state.dag),
    registerPolicy: state.register?.policy || null,
    registerEnabled: Boolean(state.register?.enabled),
    registerPalette: state.register?.palette || [],
    registerContext: {
      requestTypeRegistryPrompt: requestTypePromptRows(),
      selectionPolicyPrompt: engagementStanceSelectionPolicyPrompt(state),
      palettePrompt: engagementStancePalettePromptRows(state.register?.palette || []),
      priorPublicLearnerDagPrompt: learnerDagPromptSummary(state.learnerDag.lastModel),
      historyPrompt: registerHistoryPromptSummary(state),
      feedbackPrompt: tutorStubTurnFeedbackRegisterPrompt(tutorFeedback),
    },
    publicStagedEvidence,
    dagPreflight,
    promptProfile: state.learnerAnalysisPromptProfile,
    evidenceUseRubric: state.learnerAnalysisEvidenceUseRubric,
  });
}
async function extractLearnerRecordUpdate({ learnerText, state, tutorTurn, dagPreflight = null, signal = null }) {
  const prompt = buildLearnerRecordPrompt({ learnerText, state, tutorTurn, dagPreflight });
  const raw = await callPromptModel({
    prompt,
    resolved: state.learnerDag.resolved,
    systemPrompt: LEARNER_RECORD_SYSTEM_PROMPT,
    role: 'tutor_stub_learner_record',
    maxTokens: 700,
    trace: state.trace,
    stream: state.stream,
    cliEffort: state.cliEffort,
    turn: tutorTurn,
    signal,
  });
  const { parsed, parseError } = parseClassifierJson(raw.text);
  return {
    ...parsed,
    parseError,
    provider: raw.provider,
    model: raw.model,
    latencyMs: raw.latencyMs,
    usage: raw.usage,
  };
}

async function extractCombinedLearnerAnalysis({
  learnerText,
  state,
  tutorTurn,
  role = 'tutor_stub_learner_analysis',
  stream = state.stream,
  dagPreflight = null,
  preflightSource = 'combined_learner_analysis',
  tutorFeedback = null,
  signal = null,
}) {
  const effectiveDagPreflight =
    dagPreflight || learnerDagPreflightForTurn(state, tutorTurn, { traceSource: preflightSource });
  const prompt = buildCombinedLearnerAnalysisPrompt({
    learnerText,
    state,
    tutorTurn,
    dagPreflight: effectiveDagPreflight,
    tutorFeedback,
  });
  const raw = await extractTutorStubPublicLearnerAnalysis({
    learnerText,
    topic: state.topic,
    world: state.world,
    tutorTurn,
    prompt,
    dagPreflight: effectiveDagPreflight,
    callModel: callPromptModel,
    parseMode: TUTOR_STUB_PUBLIC_LEARNER_ANALYSIS_PARSE_MODES.INTERACTIVE,
    role,
    maxTokens: Math.max(2500, state.maxTokens || 0),
    modelCallOptions: {
      resolved: state.learnerDag.resolved,
      trace: state.trace,
      stream,
      cliEffort: state.cliEffort,
      signal,
    },
  });
  return {
    ...raw,
    dagPreflight: effectiveDagPreflight,
  };
}

function classificationFromCombinedAnalysis(raw, state) {
  const parsed = raw?.parsed || {};
  const source =
    parsed.classification ||
    parsed.learner_classification ||
    parsed.classifier ||
    (parsed.turn && parsed.overall ? parsed : null);

  if (!source) {
    return failedClassification({
      message: 'Combined learner analysis did not include a classification object.',
      resolved: state.learnerDag.resolved,
      latencyMs: raw?.latencyMs || 0,
      usage: raw?.usage,
    });
  }

  return {
    ...source,
    parseError: raw.parseError,
    provider: raw.provider,
    model: raw.model,
    latencyMs: raw.latencyMs,
    usage: raw.usage,
    combined: true,
  };
}

function learnerRecordFromCombinedAnalysis(raw) {
  const parsed = raw?.parsed || {};
  const source = parsed.learner_record || parsed.learnerRecord || parsed.public_record || parsed.record || {};
  return {
    ...source,
    parseError: raw.parseError,
    provider: raw.provider,
    model: raw.model,
    latencyMs: raw.latencyMs,
    usage: raw.usage,
    combined: true,
  };
}

function registerSelectionFromCombinedAnalysis(raw) {
  const parsed = raw?.parsed || {};
  return parsed.register_selection || parsed.registerSelection || parsed.tutor_register || parsed.register || null;
}

function evaluatePendingRegisterEfficacy(state, currentDagResult, classification = null, tutorFeedback = null) {
  if (!state.register?.enabled || !currentDagResult?.model) return null;
  const pending = [...state.register.history]
    .reverse()
    .find((entry) => !entry.efficacy && entry.turn < currentDagResult.model.turn);
  if (!pending) return null;
  pending.efficacy = registerEfficacyFromDagProgress({
    selection: pending,
    currentModel: currentDagResult.model,
    accepted: currentDagResult.accepted,
    state,
    classification,
    tutorFeedback,
  });
  return pending.efficacy;
}

function firstAvailableRegister(palette, names, fallback = 'precise') {
  for (const name of names) {
    if (palette.has(name)) return name;
  }
  return palette.has(fallback) ? fallback : [...palette][0] || fallback;
}

function briskRepeatPenalty(state) {
  const latest = latestRegisterSelection(state);
  const latestBad =
    latest?.selected_register === 'brisk' &&
    /no_clear_progress|regression_or_overreach/.test(latest.efficacy?.label || '');
  return Boolean(latestBad || recentRegisterCount(state, 'brisk') >= 2);
}

function shouldUseDynamicBrisk({ state, classification, assessment }) {
  const bottleneck = assessment.bottleneck || '';
  const hasDagGap = /release_or_pacing_gap|inference_gap/.test(bottleneck);
  const explicitStepwise = hasExplicitStepwiseSignal(classification);
  const latestMismatch = latestFieldStateMismatch(state);
  if (/field_without_dag|dag_without_field/.test(latestMismatch || '') && !explicitStepwise) return false;
  if (!hasDagGap || !explicitStepwise) return false;
  if (briskRepeatPenalty(state) && !explicitStepwise) return false;
  return true;
}

function fallbackRegisterSelection({ state, classification, tutorLearnerDag }) {
  const palette = new Set(state.register?.palette || []);
  const policy = state.register?.policy || 'dynamic';
  const assessment = tutorLearnerDag?.model?.assessment || {};
  const requestType = classification?.turn?.request_type || 'unknown_request';
  const move = classification?.turn?.discourse_move || 'unknown';
  const stance = classification?.turn?.epistemic_stance || 'unknown';
  const evidenceUse = classification?.turn?.evidence_use || 'unknown';
  const agency = classification?.turn?.agency || 'unknown';
  const latestMismatch = latestFieldStateMismatch(state);
  let selected = 'precise';
  let actionFamily = 'clarify_distinction';
  let reason = '';
  let expectedFieldMove = '';

  if (palette.has('witnessing') && /vulnerable|affective/.test(`${move} ${stance}`)) {
    selected = 'witnessing';
    actionFamily = 'receive_vulnerability';
    reason = 'The reviewer sees affective exposure as the strongest current public cue.';
    expectedFieldMove = 'Lower learner risk enough for a concrete public-evidence move to become possible.';
  } else if (
    palette.has('precise') &&
    /challenge|omits_warrant|overleaps_evidence|distorts_public_evidence/.test(`${move} ${evidenceUse}`)
  ) {
    selected = 'precise';
    actionFamily = 'answer_accountably';
    reason =
      'The learner is challenging or overleaping the public evidence, so the tutor should hold the bid accountable.';
    expectedFieldMove = 'Shift from unsupported assertion toward a publicly warranted claim.';
  } else if (policy === 'dynamic' && latestMismatch === 'field_without_dag') {
    selected = firstAvailableRegister(palette, ['plain', 'precise', 'charismatic']);
    actionFamily = requestType === 'transfer_demand_or_named_material' ? 'ground_in_material' : 'compress_sayback';
    reason =
      'The previous register improved the learner field without proof-DAG movement; convert that preparatory movement into one public evidence claim.';
    expectedFieldMove = 'Turn improved orientation or agency into a learner-owned public-record statement.';
  } else if (policy === 'dynamic' && latestMismatch === 'dag_without_field') {
    selected = firstAvailableRegister(palette, ['plain', 'precise', 'witnessing']);
    actionFamily = 'compress_sayback';
    reason =
      'The proof-DAG advanced while learner field movement flattened; ask the learner to own the reason for the step before pushing another premise.';
    expectedFieldMove = 'Recover agency and explanatory ownership around the evidence just adopted.';
  } else if (
    palette.has('charismatic') &&
    /resistant|overconfident|answer_seeking|complying|passive/.test(`${stance} ${evidenceUse} ${agency}`)
  ) {
    selected = 'charismatic';
    actionFamily = 'challenge_resistance';
    reason =
      'Low-agency, answer-seeking, or overconfident posture warrants a compact challenge rather than another stepwise hint.';
    expectedFieldMove = 'Increase learner agency or evidence-seeking without supplying the concealed answer.';
  } else if (
    policy === 'dynamic' &&
    palette.has('brisk') &&
    shouldUseDynamicBrisk({ state, classification, assessment })
  ) {
    selected = 'brisk';
    actionFamily = 'stage_next_step';
    reason = 'The learner is explicitly asking for stepwise help on the immediate evidence move.';
    expectedFieldMove = 'Make the next learner-owned inference easier without turning it into a menu or answer.';
  } else if (!palette.has(selected)) {
    selected = firstAvailableRegister(palette, ['precise', 'charismatic', 'plain', 'warm', 'witnessing', 'brisk']);
  }

  if (!reason) {
    reason =
      policy === 'dynamic' && selected !== 'brisk'
        ? 'Dynamic fallback selected after missing or invalid model register output; brisk pacing is non-default.'
        : 'Fallback register selected after missing or invalid model register output.';
  }
  if (!expectedFieldMove) {
    expectedFieldMove = 'Improve the learner field enough that the next public evidence move becomes more likely.';
  }

  return {
    selected_register: selected,
    request_type: requestType,
    action_family: actionFamily,
    legacy_selected_register: preferredLegacyRegister({ register: selected, requestType, actionFamily }),
    reviewer_signal: `${requestType}; ${move}`,
    register_reason: reason,
    evidence_span: classification?.turn?.summary || '',
    risk_flags: [],
    expected_dag_move: 'Elicit one public, checkable learner move that can update the learner-DAG record.',
    expected_field_move: expectedFieldMove,
    expected_progress_marker:
      'Next learner turn adopts staged evidence, voices a derivable inference, or corrects an overreach.',
    confidence: 0.25,
    warning: 'fallback_register_selection',
    source: 'local_fallback_register_selection',
  };
}

function fixedBlandEngagementStanceSelection({ state, classification }) {
  const palette = new Set(state.register?.palette || []);
  const selected = firstAvailableRegister(palette, ['plain', 'precise', 'brisk']);
  const requestType = classification?.turn?.request_type || 'bland_baseline';
  return {
    selected_register: selected,
    request_type: requestType,
    action_family: 'baseline_plain_response',
    legacy_selected_register: preferredLegacyRegister({
      register: selected,
      requestType,
      actionFamily: 'baseline_plain_response',
    }),
    reviewer_signal: 'fixed_bland_policy',
    register_reason:
      selected === 'plain'
        ? 'Bland policy fixes a plain non-adaptive baseline register.'
        : 'Bland policy requested plain, but the active palette did not include it; selected the nearest available baseline register.',
    evidence_span: classification?.turn?.summary || '',
    risk_flags: [],
    expected_dag_move: 'No adaptive register-specific DAG move is predicted for the bland baseline.',
    expected_field_move:
      'Use the fixed plain stance as a control condition for comparison with adaptive register policies.',
    expected_progress_marker: 'Observe learner-DAG and field movement without adaptive register selection.',
    confidence: null,
    source: 'fixed_bland_register_policy',
  };
}

function policySamplingContext(state, decisionKind, { policy = null } = {}) {
  const experiment = state.experiment || {};
  return {
    runSeed: experiment.runSeed ?? 1,
    profile: experiment.profile || automatedLearnerProfileId(args['auto-learner-profile']) || 'custom',
    policy: policy || state.register?.policy || 'unknown',
    repeat: experiment.repeat ?? 1,
    learnerTurn: state.turns.length + 1,
    decisionKind,
    jobId: experiment.jobId || null,
  };
}

function uniformEngagementStanceDistribution(registers) {
  const probability = registers.length ? 1 / registers.length : 0;
  return registers.map((register) => ({ register, weight: 1, probability }));
}

function explicitPerformanceDirectiveValue(state, axis) {
  const value = String(state.performanceDirectives?.[axis] || '').trim();
  return value || null;
}

function resolveTutorStubCharacterChoice(value) {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  const normalized = raw.replace(/[\s-]+/gu, '_');
  const definitions = getActorialPartDefinitions();
  const options = tutorStubConfigurableActorialPartIds();
  const byLabel = Object.fromEntries(
    options.map((id) => [
      String(definitions[id]?.label || id)
        .toLowerCase()
        .replace(/[\s-]+/gu, '_'),
      id,
    ]),
  );
  return {
    raw,
    normalized,
    definitions,
    options,
    clearing: EXPLICIT_PERFORMANCE_CLEAR_WORDS.has(raw),
    id: normalizeTutorStubActorialPartId(byLabel[normalized] || normalized),
  };
}

function explicitEngagementStanceSelection({ classification, stance }) {
  const definition = getEngagementStanceDefinition(stance) || {};
  const distribution = [
    {
      engagement_stance: stance,
      register: stance,
      weight: 1,
      probability: 1,
      sourceScore: 1,
    },
  ];
  const requestType = classification?.turn?.request_type || 'explicit_register_directive';
  return {
    selected_register: stance,
    engagement_stance: stance,
    request_type: requestType,
    action_family: null,
    legacy_selected_register: preferredLegacyRegister({
      register: stance,
      requestType,
      actionFamily: null,
    }),
    reviewer_signal: 'explicit_register_directive',
    register_reason: `The session explicitly directed the engagement stance to ${stance} with /register; learner assessment still selects the independent teaching action, audience, language, and scene axes.`,
    evidence_span: classification?.turn?.summary || '',
    risk_flags: Array.isArray(definition.risk_flags) ? [...definition.risk_flags] : [],
    expected_dag_move: 'Follow the normal public-evidence and learner-DAG plan without changing the directed stance.',
    expected_field_move: 'Observe the learner response without letting the assessment replace the directed stance.',
    expected_progress_marker: 'Measure the next learner move under the explicitly directed stance.',
    confidence: 1,
    source: 'explicit_register_directive',
    distribution,
    engagement_stance_distribution: distribution,
    selected_probability: 1,
    explicit_directive: {
      schema: 'machinespirits.tutor-stub.explicit-performance-directive.v1',
      axis: 'engagement_stance',
      value: stance,
      applied: true,
      assessment_influence: false,
    },
  };
}

function explicitPerformanceActorialPartSelection({ inputs, baseSelection, character }) {
  if (!baseSelection) return baseSelection;
  if (baseSelection.locked === true) {
    return {
      ...baseSelection,
      explicit_directive: {
        schema: 'machinespirits.tutor-stub.explicit-performance-directive.v1',
        axis: 'actorial_part',
        value: character,
        applied: false,
        assessment_influence: false,
        outcome: 'structural_lock',
        reason: baseSelection.lock_reason || 'licensed_closeout',
      },
    };
  }
  const selected = tutorStubRandomizableActorialPartIds().includes(character)
    ? selectTutorStubActorialPart({
        ...inputs,
        selectedPartOverride: character,
      })
    : {
        ...baseSelection,
        id: character,
        label: oneLine(getActorialPartDefinitions()[character]?.label) || displayDiagnosticLabel(character),
        contract: oneLine(getActorialPartDefinitions()[character]?.contract),
      };
  return {
    ...selected,
    probability: 1,
    score: null,
    temperature: null,
    pre_directive_distribution: selected.distribution,
    distribution: [{ part: character, weight: 1, probability: 1 }],
    drivers: [],
    reason: `The session explicitly directed the host character to ${character} with /character; learner assessment still selects the independent teaching action, audience, language, and scene axes.`,
    selection_method: 'explicit_character_directive',
    explicit_directive: {
      schema: 'machinespirits.tutor-stub.explicit-performance-directive.v1',
      axis: 'actorial_part',
      value: character,
      applied: true,
      assessment_influence: false,
    },
  };
}

function performanceTemperatureScope({
  policy,
  explicitRegister,
  explicitCharacter,
  randomStance,
  randomCharacter,
  lightStance = false,
  lightCharacter = false,
}) {
  const axes = [];
  if (!explicitRegister && !randomStance && !lightStance) axes.push('engagement_stance');
  if (!explicitCharacter && !randomCharacter && !lightCharacter) axes.push('actorial_part');
  if (!axes.length) {
    return {
      applied: false,
      scope:
        lightStance && lightCharacter
          ? 'bypassed_for_light_adaptation_engagement_stance_and_actorial_part'
          : randomStance && randomCharacter
            ? 'bypassed_for_random_engagement_stance_and_actorial_part'
            : 'bypassed_by_explicit_or_random_directives',
    };
  }
  if (!registerTemperatureApplies(policy)) {
    return { applied: false, scope: 'saved_but_not_used_by_policy' };
  }
  return {
    applied: true,
    scope: axes.join('_and_'),
  };
}

function randomEngagementStanceSelection({ state, classification, performanceMode = false, lightAdaptation = null }) {
  const lightMode = lightAdaptation?.triggered === true;
  const activePalette = state.register?.palette || [];
  const humanUsablePalette = activePalette.filter(
    (register) => getEngagementStanceDefinition(register)?.simulated_only !== true,
  );
  const eligiblePalette = humanUsablePalette.length ? humanUsablePalette : activePalette;
  const tutorTurn = state.turns.length + 1;
  const publicEvidenceAvailable = Boolean(
    committedReleaseRows(state, tutorTurn).length || currentReleaseRows(state, tutorTurn).length,
  );
  const previousRegister = state.register?.history?.at(-1)?.selected_register || null;
  const palette =
    (performanceMode || lightMode) && eligiblePalette.length > 1
      ? eligiblePalette.filter((register) => register !== previousRegister)
      : eligiblePalette;
  const distribution = uniformEngagementStanceDistribution(palette);
  const policyId = lightMode ? 'light_adaptation' : performanceMode ? 'random_performance' : null;
  const sampled = sampleTutorStubPolicyDistribution(
    distribution,
    policySamplingContext(
      state,
      lightMode
        ? 'light_adaptation_engagement_stance'
        : performanceMode
          ? 'random_performance_engagement_stance'
          : 'random_engagement_stance',
      policyId ? { policy: policyId } : {},
    ),
  );
  const selected = sampled.entry?.register || firstAvailableRegister(new Set(palette), ['precise', 'plain', 'brisk']);
  const requestType = lightMode
    ? 'continued_learner_difficulty'
    : performanceMode
      ? 'random_performance'
      : classification?.turn?.request_type || 'random_policy';
  return {
    selected_register: selected,
    request_type: requestType,
    action_family: null,
    legacy_selected_register: preferredLegacyRegister({
      register: selected,
      requestType,
      actionFamily: null,
    }),
    reviewer_signal: lightMode
      ? 'continued_learner_confusion_or_frustration'
      : performanceMode
        ? 'random_performance_mode'
        : 'random_policy',
    register_reason: lightMode
      ? `Light adaptation activated after ${lightAdaptation.streak} consecutive learner-difficulty turns and sampled a different non-simulated stance when possible; the assessment triggered the draw but did not choose its result.`
      : performanceMode
        ? 'Random performance mode sampled uniformly from the full non-simulated stance palette, excluding the immediately previous stance when alternatives exist. Learner assessment did not influence this choice.'
        : 'Random register policy sampled uniformly from the active palette; this choice is not a classifier- or learner-DAG-based recommendation.',
    evidence_span: performanceMode || lightMode ? '' : classification?.turn?.summary || '',
    risk_flags: [],
    expected_dag_move:
      'No register-specific DAG move is predicted; preserve evidence safety while following the sampled register stance.',
    expected_field_move:
      'Observe whether the sampled stance changes learner agency, evidence use, stance, or conceptual engagement.',
    expected_progress_marker:
      'Use the next learner turn to observe whether this random register coincides with learner-DAG progress.',
    confidence: null,
    source: lightMode
      ? 'light_stochastic_adaptation'
      : performanceMode
        ? 'random_performance_mode'
        : 'random_register_policy',
    distribution,
    selected_probability: sampled.entry?.probability ?? null,
    random: sampled.audit,
    ...(lightMode
      ? {
          light_adaptation: {
            ...lightAdaptation,
            previous_register_excluded: palette.length < eligiblePalette.length ? previousRegister : null,
            eligible_registers: eligiblePalette,
            public_evidence_available: publicEvidenceAvailable,
            structural_filter: 'simulated_only_excluded',
          },
        }
      : performanceMode
        ? {
            random_performance: {
              enabled: true,
              assessment_influence: false,
              previous_register_excluded: palette.length < eligiblePalette.length ? previousRegister : null,
              eligible_registers: eligiblePalette,
              public_evidence_available: publicEvidenceAvailable,
              structural_filter: 'simulated_only_excluded',
            },
          }
        : {}),
  };
}

function randomPerformanceActorialPartSelection({ state, inputs, baseSelection, lightAdaptation = null }) {
  const lightMode = lightAdaptation?.triggered === true;
  const modeKey = lightMode ? 'light_adaptation' : 'random_performance';
  if (!baseSelection || baseSelection.locked === true) {
    return baseSelection
      ? {
          ...baseSelection,
          [modeKey]: {
            ...(lightMode ? lightAdaptation : {}),
            enabled: true,
            assessment_influence: false,
            outcome: 'structural_lock',
            reason: baseSelection.lock_reason || 'licensed_closeout',
          },
        }
      : baseSelection;
  }
  const allParts = tutorStubRandomizableActorialPartIds();
  const previousPart = inputs.recentActorialParts?.at(-1) || null;
  const parts = allParts.length > 1 ? allParts.filter((part) => part !== previousPart) : allParts;
  const probability = parts.length ? 1 / parts.length : 0;
  const distribution = parts.map((part) => ({ part, weight: 1, probability }));
  const sampled = sampleTutorStubPolicyDistribution(
    distribution.map((row) => ({ register: row.part, weight: row.weight, probability: row.probability })),
    policySamplingContext(state, lightMode ? 'light_adaptation_actorial_part' : 'random_performance_actorial_part', {
      policy: modeKey,
    }),
  );
  const selectedPart = sampled.entry?.register || parts[0] || baseSelection.id;
  const selected = selectTutorStubActorialPart({
    ...inputs,
    selectedPartOverride: selectedPart,
  });
  return {
    ...selected,
    probability: sampled.entry?.probability ?? probability,
    score: null,
    temperature: null,
    distribution,
    drivers: [],
    reason: lightMode
      ? `Light adaptation activated after ${lightAdaptation.streak} consecutive learner-difficulty turns and sampled a different host character when possible; the assessment triggered the draw but did not choose its result.`
      : 'Random performance mode sampled uniformly from the full host-character range, excluding the immediately previous part when alternatives exist. Learner assessment did not influence this choice.',
    selection_method: lightMode ? 'light_adaptation_seeded_uniform' : 'random_performance_seeded_uniform',
    random: sampled.audit,
    [modeKey]: {
      ...(lightMode ? lightAdaptation : {}),
      enabled: true,
      assessment_influence: false,
      previous_part_excluded: parts.length < allParts.length ? previousPart : null,
      eligible_parts: allParts,
    },
  };
}

function negativeEngagementStanceSelection({ state, classification }) {
  const active = new Set(state.register?.palette || []);
  const palette = NEGATIVE_FLOOR_REGISTERS.filter((register) => active.has(register));
  const population = palette.length ? palette : NEGATIVE_FLOOR_REGISTERS;
  const distribution = uniformEngagementStanceDistribution(population);
  const sampled = sampleTutorStubPolicyDistribution(
    distribution,
    policySamplingContext(state, 'negative_floor_engagement_stance'),
  );
  const selected = sampled.entry?.register || 'ironic';
  return {
    selected_register: selected,
    request_type: classification?.turn?.request_type || 'negative_floor_policy',
    action_family: null,
    legacy_selected_register: preferredLegacyRegister({
      register: selected,
      requestType: classification?.turn?.request_type || 'negative_floor_policy',
      actionFamily: null,
    }),
    reviewer_signal: 'negative_floor_policy',
    register_reason:
      'Negative register floor sampled uniformly from ironic, sarcastic, and face_threat; this is a deliberate floor/control, not a recommended adaptive stance.',
    evidence_span: classification?.turn?.summary || '',
    risk_flags: ['negative_floor'],
    expected_dag_move:
      'No beneficial register-specific DAG move is predicted; preserve evidence safety while measuring whether negative stance harms uptake or agency.',
    expected_field_move:
      'Measure recognition cost, learner agency narrowing, disengagement, or coerced progress under a negative-only register floor.',
    expected_progress_marker:
      'Compare learner-DAG progress against field movement and recognition-cost signals after the negative stance.',
    confidence: null,
    source: 'negative_register_policy',
    distribution,
    selected_probability: sampled.entry?.probability ?? null,
    random: { ...sampled.audit, floor: NEGATIVE_FLOOR_REGISTERS },
  };
}

function expectedFieldMoveForRegister(selected, features) {
  const relation = features.field?.relation || 'unknown';
  if (Number(features.comprehension?.pressure || 0) > 0) {
    return 'Repair the wording gap with one immediate plain-language gloss before advancing the proof.';
  }
  if (features.dag.finalSecretEntailed && features.dag.assertedSecret) {
    return 'Close the now-warranted inquiry without opening another proof step.';
  }
  if (features.dag.finalSecretEntailed) return 'Invite the compact warranted verdict without adding another premise.';
  if (features.dag.assertedSecret) return 'Test the public warrant for the proposed verdict before accepting it.';
  if (features.advance?.accelerated) {
    return 'Credit the learner’s compressed chain, keep the quicker pace, and test only the next unresolved edge.';
  }
  if (relation === 'field_without_dag') {
    return 'Convert the learner field movement into one public evidence claim or warrant.';
  }
  if (relation === 'dag_without_field') {
    return 'Recover learner agency and ownership around the proof step that just moved.';
  }
  if (relation === 'neither_progress') {
    return 'Change the interaction posture enough to make either learner agency or evidence use move next.';
  }
  if (selected === 'witnessing') return 'Lower affective risk while preserving one concrete check.';
  if (selected === 'charismatic') return 'Interrupt low-agency compliance and create a learner-owned public move.';
  if (selected === 'ironic') return 'Let the learner notice the mismatch without turning the learner into the target.';
  if (selected === 'sarcastic') return 'Test whether a dry edge disrupts rote performance while leaving a repair path.';
  if (selected === 'face_threat')
    return 'Measure whether local face threat changes uptake while preserving a minimal repair path.';
  if (selected === 'brisk') return 'Increase pace without turning the next inference into an answer dump.';
  if (selected === 'plain') return "Make the next move sayable in the learner's own words.";
  return 'Sharpen the learner field toward one accountable public statement.';
}

function fallbackPolicySamplingContext(decisionKind) {
  // Every run path supplies state; this fixed context exists so that even a
  // state-less draw stays seeded and replayable (it is deterministic and
  // constant by construction — there is no turn identity without state).
  return {
    runSeed: 1,
    profile: 'interactive',
    policy: 'unknown',
    repeat: 1,
    learnerTurn: 1,
    decisionKind,
    jobId: null,
  };
}

function sampleEngagementStanceDistribution(distribution, { state = null, decisionKind = 'engagement_stance' } = {}) {
  const context = state ? policySamplingContext(state, decisionKind) : fallbackPolicySamplingContext(decisionKind);
  const sampled = sampleTutorStubPolicyDistribution(distribution, context);
  return { entry: sampled.entry, random: sampled.audit };
}

function selectEngagementStanceDistribution(
  distribution,
  { deterministic = false, state = null, decisionKind = 'engagement_stance' } = {},
) {
  if (!deterministic) return sampleEngagementStanceDistribution(distribution, { state, decisionKind });
  return {
    entry: distribution[0] || null,
    random: {
      method: 'argmax_policy_overlay',
      value: null,
      threshold: null,
    },
  };
}

function formatEngagementStanceDistribution(distribution, { limit = 5 } = {}) {
  const entries = Array.isArray(distribution) ? distribution : [];
  if (!entries.length) return '';
  return entries
    .slice(0, limit)
    .map((entry) => `${entry.register}:${Math.round(Number(entry.probability || 0) * 100)}%`)
    .join(', ');
}

function fieldEngagementStanceSelection({ state, classification, tutorLearnerDag, deterministic = false }) {
  const { features, scores, drivers } = buildFieldRegisterScores({ state, classification, tutorLearnerDag });
  const distribution = normalizeEngagementStanceDistribution(scores, { temperature: state.register?.temperature });
  const sampled = selectEngagementStanceDistribution(distribution, {
    deterministic,
    state,
    decisionKind: 'field_engagement_stance',
  });
  const selected =
    sampled.entry?.register || firstAvailableRegister(new Set(state.register?.palette || []), ['precise', 'plain']);
  const actionFamily = null;
  const selectedProbability = sampled.entry?.probability ?? null;
  const driverText = drivers.slice(0, 5).join('; ') || 'base field-policy weights only';
  return {
    selected_register: selected,
    request_type: features.requestType,
    action_family: actionFamily,
    legacy_selected_register: preferredLegacyRegister({
      register: selected,
      requestType: features.requestType,
      actionFamily,
    }),
    reviewer_signal: `${features.field.relation}; ${features.discourseMove}; ${features.epistemicStance}; ${features.agency}`,
    register_reason: `Field policy sampled from local engagement-stance distribution. Main drivers: ${driverText}.`,
    evidence_span: classification?.turn?.summary || '',
    risk_flags: [],
    expected_dag_move:
      Number(features.comprehension?.pressure || 0) > 0
        ? 'Hold learner-DAG advancement while the wording gap is repaired.'
        : features.dag.finalSecretEntailed && features.dag.assertedSecret
          ? 'Close the warranted proof without asking for another premise.'
          : features.dag.finalSecretEntailed
            ? 'Invite the learner’s compact warranted verdict without adding another premise.'
            : features.dag.assertedSecret
              ? 'Test the warrant for the proposed verdict before accepting it.'
              : features.advance?.accelerated
                ? 'Accept every warranted learner-supplied premise and inference already made; probe only the next unresolved proof edge.'
                : features.field.relation === 'field_without_dag'
                  ? 'Elicit one public evidence claim that converts learner-field movement into proof-state movement.'
                  : 'Elicit one public, checkable learner move that can update the learner-DAG record.',
    expected_field_move: expectedFieldMoveForRegister(selected, features),
    expected_progress_marker:
      'Next learner turn should show movement in agency, evidence use, epistemic stance, or learner-DAG coverage.',
    confidence: selectedProbability,
    source: 'field_register_policy',
    distribution,
    selected_probability: selectedProbability,
    field_policy: {
      schema: 'machinespirits.tutor-stub.field-register-policy.v1',
      features,
      scores: Object.fromEntries(Object.entries(scores).map(([register, score]) => [register, roundField(score)])),
      drivers,
      random: sampled.random,
    },
  };
}

function trajectoryRiskFlags(trajectory) {
  return Object.entries(trajectory.flags || {})
    .filter(([, value]) => value)
    .map(([key]) => `trajectory_${key}`);
}

function expectedTrajectoryDagMove(features, trajectory) {
  const flags = trajectory.flags || {};
  if (features.dag.finalSecretEntailed && features.dag.assertedSecret) {
    return 'Close the proof path without adding another premise or making the learner repeat the completed chain.';
  }
  if (features.dag.finalSecretEntailed) return 'Invite the compact warranted verdict without adding another premise.';
  if (features.dag.assertedSecret) return 'Test the warrant for the proposed verdict before accepting it.';
  if (flags.learnerAcceleration) {
    return 'Preserve every warranted step in the learner’s compressed chain and move directly to its next unresolved edge.';
  }
  if (flags.coerciveProgress) {
    return 'Hold proof-state progress until the learner can own the warrant without rising recognition risk.';
  }
  if (flags.fieldOnlyDrift) {
    return 'Convert improving learner posture into one public evidence adoption or warranted claim.';
  }
  if (flags.dagOnlyDrift) {
    return 'Ask the learner to explain the proof step already moving in the learner-DAG.';
  }
  if (flags.plateau) {
    return 'Change the local posture enough to create either learner-field movement or proof-state movement.';
  }
  if (features.dag.finalSecretEntailed || features.dag.assertedSecret) {
    return 'Close the proof path by having the learner state the public warrant for the answer.';
  }
  return 'Elicit one public, checkable learner move that changes the recent learner-field or learner-DAG trajectory.';
}

function expectedTrajectoryMoveForRegister(selected, features, trajectory) {
  const flags = trajectory.flags || {};
  if (features.dag.finalSecretEntailed && features.dag.assertedSecret) {
    return 'Use the learner’s completed chain for a concise, accountable closeout.';
  }
  if (features.dag.finalSecretEntailed) return 'Turn the completed chain into one compact learner-owned verdict.';
  if (features.dag.assertedSecret) return 'Slow only enough to test the warrant behind the proposed verdict.';
  if (flags.learnerAcceleration && !flags.nearClosure) {
    return 'Match the learner’s faster pace: acknowledge the chain once, then extend or test its next edge.';
  }
  if (flags.coerciveProgress) {
    return 'Trade speed for learner ownership: reduce risk while keeping one accountable public check.';
  }
  if (flags.riskRising) {
    return 'Lower rising field risk before asking for another proof-state advance.';
  }
  if (flags.plateau) {
    return 'Break a flat recent trajectory with a different learner-owned commitment.';
  }
  if (flags.fieldRegression) {
    return 'Recover agency, evidence use, or epistemic stance after negative field movement.';
  }
  if (flags.fieldOnlyDrift) {
    return 'Turn improved orientation into a sayable public claim.';
  }
  if (flags.dagOnlyDrift) {
    return 'Make the learner own the proof movement already appearing in the DAG.';
  }
  if (flags.stableConvergence) {
    return 'Preserve convergent field and DAG momentum without overprompting.';
  }
  return expectedFieldMoveForRegister(selected, features);
}

function trajectoryEngagementStanceSelection({ state, classification, tutorLearnerDag }) {
  const { features, trajectory, scores, drivers, baseScores, baseDrivers } = buildTrajectoryRegisterScores({
    state,
    classification,
    tutorLearnerDag,
  });
  const distribution = normalizeEngagementStanceDistribution(scores, { temperature: state.register?.temperature });
  const sampled = sampleEngagementStanceDistribution(distribution, {
    state,
    decisionKind: 'trajectory_engagement_stance',
  });
  const selected =
    sampled.entry?.register || firstAvailableRegister(new Set(state.register?.palette || []), ['precise', 'plain']);
  const actionFamily = null;
  const selectedProbability = sampled.entry?.probability ?? null;
  const driverText = drivers.slice(0, 6).join('; ') || 'trajectory policy used field baseline only';
  return {
    selected_register: selected,
    request_type: features.requestType,
    action_family: actionFamily,
    legacy_selected_register: preferredLegacyRegister({
      register: selected,
      requestType: features.requestType,
      actionFamily,
    }),
    reviewer_signal: `${features.field.relation}; fieldSlope=${trajectory.field.slope ?? 'n/a'}; dagSlope=${
      trajectory.dag.slope ?? 'n/a'
    }; riskSlope=${trajectory.risk.slope ?? 'n/a'}`,
    register_reason: `Trajectory policy sampled from field baseline plus recent finite-difference dynamics. Main drivers: ${driverText}.`,
    evidence_span: classification?.turn?.summary || '',
    risk_flags: trajectoryRiskFlags(trajectory),
    expected_dag_move: expectedTrajectoryDagMove(features, trajectory),
    expected_field_move: expectedTrajectoryMoveForRegister(selected, features, trajectory),
    expected_progress_marker:
      'Next learner turn should improve the recent trajectory: field score, proof coverage, ownership, or risk trend.',
    confidence: selectedProbability,
    source: 'trajectory_register_policy',
    distribution,
    selected_probability: selectedProbability,
    trajectory_policy: {
      schema: 'machinespirits.tutor-stub.trajectory-register-policy.v1',
      base_field_schema: 'machinespirits.tutor-stub.field-register-policy.v1',
      features,
      trajectory,
      base_scores: Object.fromEntries(
        Object.entries(baseScores).map(([register, score]) => [register, roundField(score)]),
      ),
      scores: Object.fromEntries(Object.entries(scores).map(([register, score]) => [register, roundField(score)])),
      base_drivers: baseDrivers,
      drivers,
      random: sampled.random,
    },
  };
}

function dynamicalSystemRiskFlags(system) {
  return Object.entries(system.state_vector || {})
    .filter(([key, value]) => Number(value) >= 0.7 && /risk|coercion|stagnation|regression|gap|deficit/iu.test(key))
    .map(([key]) => `dynamical_${key}`);
}

function expectedDynamicalDagMove(features, system) {
  const vector = system.state_vector || {};
  if (numberOr(vector.language_opacity) > 0) {
    return 'Hold proof-state advancement while the tutor repairs the learner-visible wording gap.';
  }
  if (numberOr(vector.coercion_risk) > 0.55) {
    return 'Stabilize learner ownership before taking more proof-state progress.';
  }
  if (numberOr(vector.warrant_gap) > 0.6) {
    return 'Elicit one public warrant that makes the current claim accountable.';
  }
  if (numberOr(vector.evidence_gap) > 0.6) {
    return 'Move one missing public premise into the learner-owned record.';
  }
  if (numberOr(vector.closure_pressure) > 0.65) {
    return 'Close by having the learner state the public evidence chain for the answer.';
  }
  if (features.dag.finalSecretEntailed || features.dag.assertedSecret) {
    return 'Convert near-closure into a public, warranted final statement.';
  }
  return 'Move the system toward evidence grounding, learner ownership, or accountable closure.';
}

function expectedDynamicalMoveForRegister(selected, features, system) {
  const vector = system.state_vector || {};
  if (numberOr(vector.language_opacity) > 0) {
    return 'Gloss the unresolved or recently queried term before applying further proof pressure.';
  }
  if (numberOr(vector.affective_risk) > 0.6 || numberOr(vector.coercion_risk) > 0.55) {
    return 'Reduce safety or coercion pressure while preserving one checkable public move.';
  }
  if (numberOr(vector.agency_deficit) > 0.65) {
    return 'Increase learner-owned commitment instead of supplying the next inference.';
  }
  if (numberOr(vector.warrant_gap) > 0.6) {
    return 'Turn the current claim into a warranted public statement.';
  }
  if (numberOr(vector.stagnation) > 0.6) {
    return 'Perturb a stuck trajectory without sacrificing recognition safety.';
  }
  if (numberOr(vector.momentum) > 0.55 && selected === 'brisk') {
    return 'Use the available pace to carry one learner-owned proof step.';
  }
  return expectedTrajectoryMoveForRegister(selected, features, system.trajectory || {});
}

function dynamicalSystemEngagementStanceSelection({ state, classification, tutorLearnerDag, useCorpusPrior = false }) {
  const { features, trajectory, system, empirical, corpusEmpirical, logits, scores, drivers } =
    buildDynamicalSystemRegisterScores({
      state,
      classification,
      tutorLearnerDag,
      useCorpusPrior,
    });
  const distribution = normalizeEngagementStanceDistribution(scores, { temperature: 1 });
  const sampled = sampleEngagementStanceDistribution(distribution, {
    state,
    decisionKind: useCorpusPrior
      ? 'empirical_dynamical_system_engagement_stance'
      : 'dynamical_system_engagement_stance',
  });
  const selected =
    sampled.entry?.register || firstAvailableRegister(new Set(state.register?.palette || []), ['precise', 'plain']);
  const actionFamily = null;
  const selectedProbability = sampled.entry?.probability ?? null;
  const selectedContributions = registerAffinityContributions(selected, system.state_vector).slice(0, 6);
  const driverText =
    [
      ...drivers.slice(0, 4),
      selectedContributions.length
        ? `selected ${selected}: ${selectedContributions
            .map((row) => `${row.axis}${row.contribution >= 0 ? '+' : ''}${roundField(row.contribution)}`)
            .join(', ')}`
        : null,
    ]
      .filter(Boolean)
      .join('; ') || 'dynamical-system base priors only';
  return {
    selected_register: selected,
    request_type: features.requestType,
    action_family: actionFamily,
    legacy_selected_register: preferredLegacyRegister({
      register: selected,
      requestType: features.requestType,
      actionFamily,
    }),
    reviewer_signal: `attractors=${topNumericEntries(system.attractors, { limit: 3 }).join(', ')}; vector=${topNumericEntries(
      system.state_vector,
      { limit: 3 },
    ).join(', ')}`,
    register_reason: `${
      useCorpusPrior ? 'Empirical dynamical-system' : 'Dynamical-system'
    } policy sampled from theory affinity matrix plus local${
      useCorpusPrior ? ' and cross-run' : ''
    } efficacy correction. Main drivers: ${driverText}.`,
    evidence_span: classification?.turn?.summary || '',
    risk_flags: dynamicalSystemRiskFlags(system),
    expected_dag_move: expectedDynamicalDagMove(features, system),
    expected_field_move: expectedDynamicalMoveForRegister(selected, features, system),
    expected_progress_marker:
      'Next learner turn should move the system vector toward lower gap/risk and higher ownership, grounding, or closure.',
    confidence: selectedProbability,
    source: useCorpusPrior ? 'empirical_dynamical_system_register_policy' : 'dynamical_system_register_policy',
    distribution,
    selected_probability: selectedProbability,
    dynamical_system_policy: {
      schema: 'machinespirits.tutor-stub.dynamical-system-register-policy.v1',
      mapping: {
        type: useCorpusPrior
          ? 'softmax_affinity_matrix_with_local_and_corpus_empirical_correction'
          : 'softmax_affinity_matrix_with_empirical_correction',
        temperature: state.register?.temperature ?? DYNAMICAL_SYSTEM_TEMPERATURE,
        theory_priors:
          'recognition safety, learner ownership, accountable warranting, proof-state closure, and controlled productive disruption',
        affinity_matrix_version: 'v1',
      },
      state_vector: system.state_vector,
      derivative_vector: system.derivative_vector,
      attractors: system.attractors,
      selected_affinity: DYNAMICAL_SYSTEM_REGISTER_AFFINITY[selected] || {},
      selected_contributions: selectedContributions.map((row) => ({
        axis: row.axis,
        weight: row.weight,
        value: roundField(row.value),
        contribution: roundField(row.contribution),
      })),
      empirical,
      corpus_empirical: corpusEmpirical,
      logits: Object.fromEntries(Object.entries(logits).map(([register, logit]) => [register, roundField(logit)])),
      scores: Object.fromEntries(Object.entries(scores).map(([register, score]) => [register, roundField(score)])),
      drivers,
      trajectory,
      features,
      random: sampled.random,
    },
  };
}

function continuousDynamicalSystemEngagementStanceSelection({
  state,
  classification,
  tutorLearnerDag,
  useCorpusPrior = false,
}) {
  const { features, trajectory, system, empirical, corpusEmpirical, logits, scores, drivers } =
    buildDynamicalSystemRegisterScores({
      state,
      classification,
      tutorLearnerDag,
      useCorpusPrior,
    });
  const definitions = getEngagementStanceDefinitions();
  const blend = buildContinuousEngagementStanceVector({
    scores,
    palette: state.register?.palette || [],
    definitions,
    allowUnsafe: state.register?.continuousUnsafe === true,
  });
  const selected =
    blend.selectedRegister || firstAvailableRegister(new Set(state.register?.palette || []), ['precise', 'plain']);
  const actionFamily = null;
  const selectedProbability = blend.selectedProbability ?? null;
  const selectedContributions = registerAffinityContributions(selected, system.state_vector).slice(0, 6);
  const blendInstruction = continuousEngagementStanceInstruction(blend, definitions);
  const continuousPolicy = buildContinuousRegisterPolicyMetadata({
    blend,
    temperature: state.register?.temperature ?? DYNAMICAL_SYSTEM_TEMPERATURE,
    useCorpusPrior,
    empirical,
    corpusEmpirical,
    styleInstruction: blendInstruction,
  });
  const driverText =
    [
      `blend ${blend.dominantBlend || selected}`,
      ...drivers.slice(0, 4),
      selectedContributions.length
        ? `selected ${selected}: ${selectedContributions
            .map((row) => `${row.axis}${row.contribution >= 0 ? '+' : ''}${roundField(row.contribution)}`)
            .join(', ')}`
        : null,
    ]
      .filter(Boolean)
      .join('; ') || 'continuous dynamical-system base priors only';
  return {
    selected_register: selected,
    request_type: features.requestType,
    action_family: actionFamily,
    legacy_selected_register: preferredLegacyRegister({
      register: selected,
      requestType: features.requestType,
      actionFamily,
    }),
    reviewer_signal: `continuous blend=${blend.dominantBlend}; attractors=${topNumericEntries(system.attractors, {
      limit: 3,
    }).join(', ')}; vector=${topNumericEntries(system.state_vector, { limit: 3 }).join(', ')}`,
    register_reason: `${
      useCorpusPrior ? 'Continuous empirical dynamical-system' : 'Continuous dynamical-system'
    } policy blended register anchors from theory affinity matrix plus local${
      useCorpusPrior ? ' and cross-run' : ''
    } efficacy correction. Main drivers: ${driverText}.`,
    evidence_span: classification?.turn?.summary || '',
    risk_flags: dynamicalSystemRiskFlags(system),
    expected_dag_move: expectedDynamicalDagMove(features, system),
    expected_field_move: expectedDynamicalMoveForRegister(selected, features, system),
    expected_progress_marker:
      'Next learner turn should show the continuous stance blend moving the system vector toward lower gap/risk and higher ownership, grounding, or closure.',
    confidence: selectedProbability,
    source: useCorpusPrior
      ? 'continuous_empirical_dynamical_system_register_policy'
      : 'continuous_dynamical_system_register_policy',
    distribution: blend.rows,
    selected_probability: selectedProbability,
    register_vector: blend.vector,
    register_vector_entropy_bits: blend.entropyBits,
    continuous_register_policy: continuousPolicy,
    dynamical_system_policy: {
      schema: 'machinespirits.tutor-stub.dynamical-system-register-policy.v1',
      mapping: {
        type: useCorpusPrior
          ? 'softmax_affinity_matrix_with_local_and_corpus_empirical_correction'
          : 'softmax_affinity_matrix_with_empirical_correction',
        temperature: state.register?.temperature ?? DYNAMICAL_SYSTEM_TEMPERATURE,
        theory_priors:
          'recognition safety, learner ownership, accountable warranting, proof-state closure, and controlled productive disruption',
        affinity_matrix_version: 'v1',
      },
      state_vector: system.state_vector,
      derivative_vector: system.derivative_vector,
      attractors: system.attractors,
      selected_affinity: DYNAMICAL_SYSTEM_REGISTER_AFFINITY[selected] || {},
      selected_contributions: selectedContributions.map((row) => ({
        axis: row.axis,
        weight: row.weight,
        value: roundField(row.value),
        contribution: roundField(row.contribution),
      })),
      empirical,
      corpus_empirical: corpusEmpirical,
      logits: Object.fromEntries(Object.entries(logits).map(([register, logit]) => [register, roundField(logit)])),
      scores: Object.fromEntries(Object.entries(scores).map(([register, score]) => [register, roundField(score)])),
      drivers,
      trajectory,
      features,
      continuous_register_policy: {
        register_vector: continuousPolicy.register_vector,
        entropy_bits: continuousPolicy.entropy_bits,
        dominant_blend: continuousPolicy.dominant_blend,
      },
    },
  };
}

function expectedStateMoveForRegister(selected, features) {
  if (Number(features.comprehension?.pressure || 0) > 0) {
    return 'Resolve the current vocabulary or wording gap before asking for another proof move.';
  }
  if (features.dag.finalSecretEntailed || features.dag.assertedSecret) {
    return 'Move the current learner state toward accountable closure without adding new evidence.';
  }
  if (features.advance?.accelerated) {
    return 'Address the learner as an informed peer, credit the full chain, and test only the next unresolved distinction.';
  }
  if (features.dag.bottleneck === 'premature_assertion') {
    return 'Move the learner from naming a verdict to naming the public support that licenses it.';
  }
  if (features.dag.bottleneck === 'assertion_gap') {
    return 'Move the learner from held evidence to a warranted final assertion.';
  }
  if (
    /answer_seeking|passive|complying/iu.test(`${features.epistemicStance} ${features.agency} ${features.evidenceUse}`)
  ) {
    return 'Move the learner from dependent answer-seeking to one small public commitment.';
  }
  if (selected === 'witnessing') return 'Lower current affective risk while keeping one concrete public test.';
  if (selected === 'warm') return 'Restore current learner readiness enough for the next evidence claim.';
  if (selected === 'charismatic') return 'Interrupt current low-agency posture and demand one owned move.';
  if (selected === 'precise') return 'Sharpen the current claim, distinction, or warrant into a checkable line.';
  if (selected === 'brisk') return 'Advance the current proof bottleneck with one learner-owned next step.';
  return 'Move the current learner state toward one public, checkable evidence statement.';
}

function stateEngagementStanceSelection({ state, classification, tutorLearnerDag, deterministic = false }) {
  const { features, scores, drivers } = buildStateRegisterScores({ state, classification, tutorLearnerDag });
  const distribution = normalizeEngagementStanceDistribution(scores, { temperature: state.register?.temperature });
  const sampled = selectEngagementStanceDistribution(distribution, {
    deterministic,
    state,
    decisionKind: 'state_engagement_stance',
  });
  const selected =
    sampled.entry?.register || firstAvailableRegister(new Set(state.register?.palette || []), ['precise', 'plain']);
  const actionFamily = null;
  const selectedProbability = sampled.entry?.probability ?? null;
  const driverText = drivers.slice(0, 5).join('; ') || 'base state-policy weights only';
  return {
    selected_register: selected,
    request_type: features.requestType,
    action_family: actionFamily,
    legacy_selected_register: preferredLegacyRegister({
      register: selected,
      requestType: features.requestType,
      actionFamily,
    }),
    reviewer_signal: `${features.dag.bottleneck}; ${features.discourseMove}; ${features.epistemicStance}; ${features.agency}`,
    register_reason: `State policy sampled from current classifier/DAG distribution. Main drivers: ${driverText}.`,
    evidence_span: classification?.turn?.summary || '',
    risk_flags: [],
    expected_dag_move:
      Number(features.comprehension?.pressure || 0) > 0
        ? 'Hold learner-DAG advancement while the wording gap is repaired.'
        : features.dag.finalSecretEntailed && features.dag.assertedSecret
          ? 'Close the warranted proof without asking for another premise.'
          : features.dag.finalSecretEntailed
            ? 'Invite the learner’s compact warranted verdict without adding another premise.'
            : features.dag.assertedSecret
              ? 'Test the warrant for the proposed verdict before accepting it.'
              : features.advance?.accelerated
                ? 'Preserve the learner’s full multi-premise advance and ask only about the next unresolved proof edge.'
                : 'Elicit one public, checkable learner move that addresses the current learner-DAG bottleneck.',
    expected_field_move: expectedStateMoveForRegister(selected, features),
    expected_progress_marker:
      'Next learner turn should improve the current state: public evidence use, agency, assertion quality, or learner-DAG coverage.',
    confidence: selectedProbability,
    source: 'state_register_policy',
    distribution,
    selected_probability: selectedProbability,
    state_policy: {
      schema: 'machinespirits.tutor-stub.state-register-policy.v1',
      features,
      scores: Object.fromEntries(Object.entries(scores).map(([register, score]) => [register, roundField(score)])),
      drivers,
      random: sampled.random,
    },
  };
}

function registerPolicySelectionSummary(selection) {
  return {
    selected_register: selection?.selected_register || selection?.engagement_stance || null,
    source: selection?.source || null,
    reason: selection?.register_reason || selection?.engagement_stance_reason || null,
    selected_probability: selection?.selected_probability ?? selection?.confidence ?? null,
    distribution: Array.isArray(selection?.distribution) ? selection.distribution : null,
  };
}

function composeRegisterPolicySelection({ primarySelection, state, classification, tutorLearnerDag }) {
  const overlays = Array.isArray(state.register?.overlays) ? state.register.overlays : [];
  if (!overlays.length) return primarySelection;
  const primaryRegister = primarySelection?.selected_register || primarySelection?.engagement_stance || null;
  const threshold = state.register?.overlayThreshold ?? DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD;
  const evaluated = overlays.map((overlay, index) => {
    const candidate =
      overlay === 'state'
        ? stateEngagementStanceSelection({
            state,
            classification,
            tutorLearnerDag,
            deterministic: true,
          })
        : fieldEngagementStanceSelection({
            state,
            classification,
            tutorLearnerDag,
            deterministic: true,
          });
    const evaluation = evaluateTutorStubRegisterPolicyOverlay({
      overlay,
      state,
      classification,
      candidate,
      primaryRegister,
      threshold,
    });
    return {
      ...evaluation,
      order: index,
      candidate,
      candidate_reason: candidate.register_reason || null,
      candidate_distribution: candidate.distribution || null,
    };
  });
  const winner = evaluated
    .filter((entry) => entry.eligible)
    .sort((a, b) => b.signal_strength - a.signal_strength || a.order - b.order)[0];
  const composition = {
    schema: TUTOR_STUB_REGISTER_POLICY_COMPOSITION_SCHEMA,
    policy_stack: tutorStubRegisterPolicyStackId(state.register.policy, overlays),
    primary_policy: state.register.policy,
    overlay_policies: [...overlays],
    overlay_threshold: threshold,
    primary_selection: registerPolicySelectionSummary(primarySelection),
    overlay_evaluations: evaluated.map(({ candidate: _candidate, order: _order, ...entry }) => entry),
    activated_overlay: winner?.policy || null,
    activated_strength: winner?.signal_strength ?? null,
  };
  if (!winner) {
    return {
      ...primarySelection,
      policy_composition: composition,
    };
  }
  const candidate = winner.candidate;
  const reason = `${winner.policy} overlay replaced the ${state.register.policy} choice ${primaryRegister} with ${
    candidate.selected_register
  }: turn-change strength ${winner.signal_strength} met threshold ${threshold}. ${candidate.register_reason || ''}`.trim();
  return {
    ...primarySelection,
    ...candidate,
    register_reason: reason,
    engagement_stance_reason: reason,
    source: `register_policy_overlay_${winner.policy}`,
    policy_composition: composition,
  };
}

let cachedPressureTurns = null;
function predeclaredPressureTurns() {
  if (cachedPressureTurns) return cachedPressureTurns;
  cachedPressureTurns = new Set(
    String(args['pressure-turns'] || '')
      .split(',')
      .map((part) => Number.parseInt(part.trim(), 10))
      .filter((value) => Number.isFinite(value) && value > 0),
  );
  return cachedPressureTurns;
}

function applyEngagementStanceOverride(source, stance, patch = {}) {
  const priorDistribution =
    source?.engagement_stance_distribution || (Array.isArray(source?.distribution) ? source.distribution : null);
  const lockedDistribution = [
    {
      engagement_stance: stance,
      register: stance,
      weight: 1,
      probability: 1,
      sourceScore: 1,
    },
  ];
  return {
    ...source,
    ...patch,
    engagement_stance: stance,
    selected_register: stance,
    pre_override_engagement_stance_distribution: priorDistribution,
    distribution: lockedDistribution,
    engagement_stance_distribution: lockedDistribution,
    selected_probability: 1,
  };
}

function characterDefaultEngagementStance(character, classification, tutorLearnerDag) {
  const definition = getActorialPartDefinitions()[character] || {};
  const defaults = Array.isArray(definition.default_engagement_stances)
    ? definition.default_engagement_stances.filter(
        (stance) =>
          getEngagementStanceDefinition(stance) && getEngagementStanceDefinition(stance)?.simulated_only !== true,
      )
    : [];
  if (!defaults.length) return null;
  const signal = [
    classification?.turn?.request_type,
    classification?.turn?.discourse_move,
    classification?.turn?.evidence_use,
    classification?.turn?.epistemic_stance,
    classification?.turn?.agency,
    tutorLearnerDag?.model?.assessment?.bottleneck,
  ]
    .filter(Boolean)
    .join(' ');
  const sharperMismatch =
    /(?:answer_seeking|challenge_resistance|distorts_public_evidence|overconfident|overleaps_evidence|premature_assertion|resistant|resistance_or_low_agency)/iu.test(
      signal,
    );
  return sharperMismatch && defaults.includes('sarcastic')
    ? 'sarcastic'
    : defaults.includes('ironic')
      ? 'ironic'
      : defaults[0];
}

function normalizeResponseConfigurationSelection(
  rawSelection,
  { state, classification, tutorLearnerDag, raw, learnerText = '' },
) {
  if (!state.register?.enabled) return null;
  const palette = new Set(state.register.palette || []);
  const policy = state.register?.policy || 'dynamic';
  const discoursePlane = resolveTutorStubDiscoursePlane({ learnerText, classification });
  const instructionalMetaRepair = discoursePlane.plane === 'instructional_meta';
  const explicitRegister = explicitPerformanceDirectiveValue(state, 'register');
  const explicitCharacter = explicitPerformanceDirectiveValue(state, 'character');
  const characterDefaultStance = explicitRegister
    ? null
    : characterDefaultEngagementStance(explicitCharacter, classification, tutorLearnerDag);
  const lightAdaptation = buildTutorStubLightAdaptationDecision({
    enabled: state.lightAdaptation?.enabled === true,
    threshold: state.lightAdaptation?.threshold,
    state,
    classification,
    learnerText,
  });
  const lightAdaptationTriggered = lightAdaptation.triggered === true;
  const randomPerformanceEnabled = state.randomPerformance?.enabled === true;
  const randomStanceEnabled = randomPerformanceEnabled && !explicitRegister && !lightAdaptationTriggered;
  const randomCharacterEnabled = randomPerformanceEnabled && !explicitCharacter && !lightAdaptationTriggered;
  const externalStanceDirective = Boolean(lightAdaptationTriggered || explicitRegister || randomStanceEnabled);
  if (lightAdaptationTriggered) {
    rawSelection = randomEngagementStanceSelection({ state, classification, lightAdaptation });
  } else if (explicitRegister) {
    rawSelection = explicitEngagementStanceSelection({ classification, stance: explicitRegister });
  } else if (randomStanceEnabled) {
    rawSelection = randomEngagementStanceSelection({ state, classification, performanceMode: true });
  } else if (policy === 'random') {
    rawSelection = randomEngagementStanceSelection({ state, classification });
  } else if (policy === 'negative') {
    rawSelection = negativeEngagementStanceSelection({ state, classification });
  } else if (policy === 'field') {
    rawSelection = fieldEngagementStanceSelection({ state, classification, tutorLearnerDag });
  } else if (policy === 'trajectory') {
    rawSelection = trajectoryEngagementStanceSelection({ state, classification, tutorLearnerDag });
  } else if (policy === 'dynamical_system') {
    rawSelection = dynamicalSystemEngagementStanceSelection({ state, classification, tutorLearnerDag });
  } else if (policy === 'empirical_dynamical_system') {
    rawSelection = dynamicalSystemEngagementStanceSelection({
      state,
      classification,
      tutorLearnerDag,
      useCorpusPrior: true,
    });
  } else if (policy === 'continuous_dynamical_system') {
    rawSelection = continuousDynamicalSystemEngagementStanceSelection({ state, classification, tutorLearnerDag });
  } else if (policy === 'continuous_empirical_dynamical_system') {
    rawSelection = continuousDynamicalSystemEngagementStanceSelection({
      state,
      classification,
      tutorLearnerDag,
      useCorpusPrior: true,
    });
  } else if (policy === 'state') {
    rawSelection = stateEngagementStanceSelection({ state, classification, tutorLearnerDag });
  } else if (policy === 'bland') {
    rawSelection = fixedBlandEngagementStanceSelection({ state, classification });
  }
  const normalizedRawSelection =
    typeof rawSelection === 'string' ? { engagement_stance: rawSelection } : rawSelection || {};
  const requested = String(
    normalizedRawSelection.engagement_stance ||
      normalizedRawSelection.selected_register ||
      normalizedRawSelection.register ||
      '',
  ).trim();
  const requestedResolution = resolveEngagementStance(requested);
  const requestedRegister = requestedResolution?.register || requested;
  const requestedIsKnown = Boolean(requestedRegister && palette.has(requestedRegister));
  const dynamicBriskBlocked = Boolean(
    !externalStanceDirective &&
    requestedIsKnown &&
    policy === 'dynamic' &&
    requestedRegister === 'brisk' &&
    !shouldUseDynamicBrisk({ state, classification, assessment: tutorLearnerDag?.model?.assessment || {} }),
  );
  let source =
    externalStanceDirective || policy === 'random'
      ? normalizedRawSelection
      : requestedIsKnown && !dynamicBriskBlocked
        ? normalizedRawSelection
        : fallbackRegisterSelection({ state, classification, tutorLearnerDag });
  if (!externalStanceDirective) {
    source = composeRegisterPolicySelection({
      primarySelection: source,
      state,
      classification,
      tutorLearnerDag,
    });
  }
  const comprehensionPressure = Number(
    tutorStubComprehensionFeatures(state.comprehension, {
      turn: tutorLearnerDag?.model?.turn ?? state.turns.length + 1,
    }).pressure || 0,
  );
  if (
    !externalStanceDirective &&
    policy === 'dynamic' &&
    comprehensionPressure > 0 &&
    !['plain', 'warm', 'precise'].includes(
      String(source.engagement_stance || source.selected_register || source.register || ''),
    )
  ) {
    source = applyEngagementStanceOverride(source, 'plain', {
      register_reason: `Comprehension side-state overrode challenge pressure at ${comprehensionPressure}; use one immediate plain-language gloss.`,
      expected_dag_move: 'Hold learner-DAG advancement while the wording gap is repaired.',
      expected_field_move: 'Resolve the vocabulary or wording gap before asking for another proof move.',
      source: 'dynamic_comprehension_guard',
    });
  }
  const releasePacing = tutorStubReleasePacingSnapshot(state.releasePacing, state.world);
  if (
    !externalStanceDirective &&
    comprehensionPressure === 0 &&
    releasePacing?.signal?.direction &&
    releasePacing.signal.direction !== 'steady' &&
    releasePacing.signal.source !== 'no_current_signal'
  ) {
    const requestedPace = releasePacing.signal.direction;
    const paceStance =
      requestedPace === 'accelerate'
        ? palette.has('brisk')
          ? 'brisk'
          : palette.has('precise')
            ? 'precise'
            : null
        : palette.has('warm')
          ? 'warm'
          : palette.has('plain')
            ? 'plain'
            : null;
    if (paceStance) {
      source = applyEngagementStanceOverride(source, paceStance, {
        register_reason:
          requestedPace === 'accelerate'
            ? `The learner asked for faster progress, so the tutor shifts to ${paceStance} while the clue-release controller brings one public clue forward.`
            : `The learner asked for more time, so the tutor shifts to ${paceStance} while the clue-release controller holds back new evidence.`,
        engagement_stance_reason:
          requestedPace === 'accelerate'
            ? `The learner asked for faster progress, so the tutor shifts to ${paceStance} while the clue-release controller brings one public clue forward.`
            : `The learner asked for more time, so the tutor shifts to ${paceStance} while the clue-release controller holds back new evidence.`,
        reviewer_signal: releasePacing.signal.reason,
        expected_dag_move:
          requestedPace === 'accelerate'
            ? 'Stage one newly available public clue and advance without re-testing a settled premise.'
            : 'Consolidate one public premise without releasing another clue yet.',
        expected_field_move:
          requestedPace === 'accelerate'
            ? 'Convert learner impatience into visible forward motion.'
            : 'Reduce pace pressure while preserving learner agency.',
        source: `learner_release_pacing_${requestedPace}`,
      });
    }
  }
  const learnerAdvance = tutorLearnerDag?.advance || tutorLearnerDag?.model?.learnerAdvance || null;
  if (
    !externalStanceDirective &&
    policy === 'dynamic' &&
    comprehensionPressure === 0 &&
    learnerAdvance?.accelerated &&
    tutorLearnerDag?.model?.assessment?.finalSecretEntailed !== true &&
    tutorLearnerDag?.model?.assessment?.assertedSecret !== true
  ) {
    const currentStanceForAcceleration = String(
      source.engagement_stance || source.selected_register || source.register || 'plain',
    );
    const acceleratedStance = palette.has('brisk')
      ? 'brisk'
      : palette.has('precise')
        ? 'precise'
        : currentStanceForAcceleration;
    source = applyEngagementStanceOverride(source, acceleratedStance, {
      register_reason: `Learner-owned acceleration guard: ${learnerAdvance.supportedMoveCount} warranted proof moves were accepted, so the stance shifts to ${acceleratedStance} and tests only the next unresolved edge.`,
      engagement_stance_reason: `Learner-owned acceleration guard: ${learnerAdvance.supportedMoveCount} warranted proof moves were accepted, so the stance shifts to ${acceleratedStance} and tests only the next unresolved edge.`,
      reviewer_signal: `accelerating learner supplied ${learnerAdvance.supportedMoveCount} warranted proof moves`,
      expected_dag_move:
        'Preserve the entire learner-supplied chain and ask only about the next unresolved public proof edge.',
      expected_field_move: 'Match the learner’s quicker pace without forcing a restatement of already warranted steps.',
      source: 'dynamic_learner_acceleration_guard',
    });
  }
  if (!externalStanceDirective && characterDefaultStance) {
    const definition = getEngagementStanceDefinition(characterDefaultStance) || {};
    source = applyEngagementStanceOverride(source, characterDefaultStance, {
      register_reason: `The explicitly selected ${explicitCharacter} character defaults to ${characterDefaultStance} so its recurring dramatic action can expose the current mismatch. Use /register to direct another voice independently.`,
      engagement_stance_reason: `The explicitly selected ${explicitCharacter} character defaults to ${characterDefaultStance}; an explicit /register choice still takes precedence.`,
      reviewer_signal: `character default engagement stance: ${explicitCharacter}`,
      risk_flags: Array.isArray(definition.risk_flags) ? [...definition.risk_flags] : [],
      expected_field_move: 'Expose the gap in the learner-facing claim while preserving a concrete route to repair it.',
      source: 'explicit_character_default_engagement_stance',
      character_default_engagement_stance: true,
    });
  }
  const pressureProbeTurn = tutorLearnerDag?.model?.turn ?? state.turns.length + 1;
  if (!externalStanceDirective && predeclaredPressureTurns().has(pressureProbeTurn)) {
    source = applyEngagementStanceOverride(source, 'face_threat', {
      register_reason: `Predeclared pressure probe: hostile register forced at learner turn ${pressureProbeTurn} by design, independent of the register policy. The policy resumes control next turn.`,
      expected_dag_move: 'Learner-DAG advancement may stall or regress this turn; recovery is measured afterward.',
      expected_field_move: 'Interactional pressure spikes by design this turn.',
      source: 'predeclared_pressure_probe',
      predeclared_pressure: true,
    });
  }
  if (instructionalMetaRepair) {
    source = applyEngagementStanceOverride(source, 'plain', {
      register_reason:
        'Instructional repair overrides proof-facing performance pressure for this turn; use plain, unadorned language before returning to the inquiry.',
      engagement_stance_reason:
        'Instructional repair overrides proof-facing performance pressure for this turn; use plain, unadorned language before returning to the inquiry.',
      reviewer_signal: 'learner requested repair of the explanation itself',
      expected_dag_move: 'Keep learner-DAG state unchanged while the explanation is repaired.',
      expected_field_move: 'Resolve the wording gap without releasing evidence or asking another proof question.',
      source: 'instructional_meta_repair',
    });
  }
  const selectedRaw = String(source.engagement_stance || source.selected_register || source.register || '').trim();
  const selectedResolution = resolveEngagementStance(selectedRaw, { fallback: 'precise' });
  const selected = selectedResolution?.register || selectedRaw;
  const definition = getEngagementStanceDefinition(selected) || {};
  const requestType = String(
    source.request_type ||
      selectedResolution?.request_type ||
      classification?.turn?.request_type ||
      classification?.turn?.discourse_move ||
      'unknown',
  );
  const proposedActionFamily = String(source.action_family || selectedResolution?.action_family || '');
  const policyStack = tutorStubRegisterPolicyStackId(policy, state.register?.overlays || []);
  const configurationInputs = {
    engagementStance: selected,
    legacySelectedRegister: source.legacy_selected_register || selectedResolution?.legacy_selected_register || null,
    stanceDistribution: source.engagement_stance_distribution || source.distribution || null,
    stanceVector: source.engagement_stance_vector || source.register_vector || null,
    temperature: state.register?.temperature ?? DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
    policy: lightAdaptationTriggered
      ? 'light_adaptation'
      : explicitRegister
        ? 'explicit_register_directive'
        : characterDefaultStance
          ? 'character_default_engagement_stance'
          : randomStanceEnabled
            ? 'random_performance'
            : policyStack,
    learnerText,
    classification,
    tutorLearnerDag,
    comprehension: tutorStubComprehensionFeatures(state.comprehension, {
      turn: tutorLearnerDag?.model?.turn ?? state.turns.length + 1,
    }),
    world: state.world,
    proposedActionFamily: proposedActionFamily || null,
    releasePacing: tutorStubReleasePacingSnapshot(state.releasePacing, state.world),
    dueEvidence: discoursePlane.freeze_clue_release
      ? []
      : currentReleaseRows(state, tutorLearnerDag?.model?.turn ?? state.turns.length + 1),
    recentActorialParts: (state.register?.history || [])
      .map((entry) => entry.actorial_part || entry.response_configuration?.actorial_part)
      .filter(Boolean),
    discoursePlane,
  };
  let responseConfiguration = buildTutorStubResponseConfiguration(configurationInputs);
  const actorialInputs = {
    engagementStance: configurationInputs.engagementStance,
    stanceDistribution: configurationInputs.stanceDistribution,
    actionFamily: responseConfiguration.action_family,
    temperature: configurationInputs.temperature,
    classification,
    tutorLearnerDag,
    comprehension: configurationInputs.comprehension,
    world: state.world,
    dueEvidence: configurationInputs.dueEvidence,
    recentActorialParts: configurationInputs.recentActorialParts,
  };
  if (lightAdaptationTriggered) {
    const sampledSelection = randomPerformanceActorialPartSelection({
      state,
      inputs: actorialInputs,
      baseSelection: responseConfiguration.actorial_part_selection,
      lightAdaptation,
    });
    responseConfiguration = buildTutorStubResponseConfiguration({
      ...configurationInputs,
      actorialPartOverride: sampledSelection,
    });
    responseConfiguration.selection_reasons.actorial_part = sampledSelection?.reason || 'structural closeout lock';
  } else if (explicitCharacter) {
    const directedSelection = explicitPerformanceActorialPartSelection({
      inputs: actorialInputs,
      baseSelection: responseConfiguration.actorial_part_selection,
      character: explicitCharacter,
    });
    responseConfiguration = buildTutorStubResponseConfiguration({
      ...configurationInputs,
      actorialPartOverride: directedSelection,
    });
    responseConfiguration.selection_reasons.actorial_part =
      directedSelection?.reason || 'The licensed closeout character takes structural priority.';
  } else if (randomCharacterEnabled) {
    const sampledSelection = randomPerformanceActorialPartSelection({
      state,
      inputs: actorialInputs,
      baseSelection: responseConfiguration.actorial_part_selection,
    });
    responseConfiguration = buildTutorStubResponseConfiguration({
      ...configurationInputs,
      actorialPartOverride: sampledSelection,
    });
    responseConfiguration.selection_reasons.actorial_part = sampledSelection?.reason || 'structural closeout lock';
  } else if (
    registerTemperatureApplies(policy) &&
    responseConfiguration.actorial_part_selection?.distribution?.length &&
    responseConfiguration.actorial_part_selection.locked !== true
  ) {
    const sampledPart = sampleTutorStubPolicyDistribution(
      responseConfiguration.actorial_part_selection.distribution.map((row) => ({
        register: row.part,
        weight: row.weight,
        probability: row.probability,
      })),
      policySamplingContext(state, 'actorial_part'),
    );
    const sampledSelection = selectTutorStubActorialPart({
      engagementStance: configurationInputs.engagementStance,
      stanceDistribution: configurationInputs.stanceDistribution,
      actionFamily: responseConfiguration.action_family,
      temperature: configurationInputs.temperature,
      classification,
      tutorLearnerDag,
      comprehension: configurationInputs.comprehension,
      world: state.world,
      dueEvidence: configurationInputs.dueEvidence,
      recentActorialParts: configurationInputs.recentActorialParts,
      selectedPartOverride: sampledPart.entry?.register || responseConfiguration.actorial_part,
    });
    sampledSelection.random = sampledPart.audit;
    responseConfiguration = buildTutorStubResponseConfiguration({
      ...configurationInputs,
      actorialPartOverride: sampledSelection,
    });
  }
  const randomPerformanceActive = randomStanceEnabled || randomCharacterEnabled;
  if (randomPerformanceEnabled) {
    responseConfiguration.random_performance = {
      schema: 'machinespirits.tutor-stub.random-performance-selection.v1',
      enabled: randomPerformanceActive,
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
      stance_random: randomStanceEnabled ? source.random || null : null,
      actorial_part_random: randomCharacterEnabled
        ? responseConfiguration.actorial_part_selection?.random || null
        : null,
      hard_constraints_preserved: ['dialogue_closure', 'evidence_release', 'response_safety'],
    };
  }
  responseConfiguration.light_adaptation = {
    ...lightAdaptation,
    engagement_stance_draw: source.light_adaptation || null,
    actorial_part_draw: responseConfiguration.actorial_part_selection?.light_adaptation || null,
    engagement_stance_random: lightAdaptationTriggered ? source.random || null : null,
    actorial_part_random: lightAdaptationTriggered
      ? responseConfiguration.actorial_part_selection?.random || null
      : null,
    applied: lightAdaptationTriggered,
    applied_axes: lightAdaptationTriggered
      ? [
          'engagement_stance',
          responseConfiguration.actorial_part_selection?.locked === true ? null : 'actorial_part',
        ].filter(Boolean)
      : [],
    overridden_directives: lightAdaptationTriggered
      ? [
          explicitRegister ? 'engagement_stance' : null,
          explicitCharacter ? 'actorial_part' : null,
          randomPerformanceEnabled ? 'random_performance' : null,
        ].filter(Boolean)
      : [],
  };
  if (explicitRegister || explicitCharacter) {
    responseConfiguration.performance_directives = {
      schema: 'machinespirits.tutor-stub.explicit-performance-directives.v1',
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
            applied:
              !lightAdaptationTriggered &&
              responseConfiguration.actorial_part_selection?.explicit_directive?.applied !== false,
            outcome: lightAdaptationTriggered
              ? 'overridden_by_light_adaptation'
              : responseConfiguration.actorial_part_selection?.explicit_directive?.outcome || 'applied',
            assessment_influence: false,
          }
        : null,
      hard_constraints_preserved: [
        'dialogue_closure',
        'authored_evidence_source',
        'evidence_release',
        'response_safety',
      ],
    };
  }
  const temperatureSelection = performanceTemperatureScope({
    policy,
    explicitRegister: explicitRegister || characterDefaultStance,
    explicitCharacter,
    randomStance: randomStanceEnabled,
    randomCharacter: randomCharacterEnabled,
    lightStance: lightAdaptationTriggered,
    lightCharacter: lightAdaptationTriggered,
  });
  responseConfiguration.temperature_scope = temperatureSelection.scope;
  const actionFamily = responseConfiguration.action_family;
  const reviewerSignal = String(
    source.reviewer_signal ||
      source.register_signal ||
      source.learner_signal ||
      source.learnerSignal ||
      classification?.turn?.pedagogical_need ||
      requestType,
  );
  const selection = {
    schema: 'machinespirits.tutor-stub.response-configuration-selection.v5',
    register_ontology_version: getRegisterOntologyVersion(),
    policy: policyStack,
    primary_policy: policy,
    overlay_policies: [...(state.register?.overlays || [])],
    activated_policy: lightAdaptationTriggered
      ? 'light_adaptation'
      : explicitRegister
        ? 'explicit_register_directive'
        : randomStanceEnabled
          ? 'random_performance'
          : source.policy_composition?.activated_overlay || policy,
    policy_composition: source.policy_composition || null,
    turn: tutorLearnerDag?.model?.turn ?? state.turns.length + 1,
    engagement_stance: selected,
    selected_register: selected,
    selected_mode: selected,
    legacy_selected_register:
      source.legacy_selected_register ||
      selectedResolution?.legacy_selected_register ||
      preferredLegacyRegister({ register: selected, requestType, actionFamily }),
    action_family: actionFamily || null,
    discourse_plane: structuredClone(discoursePlane),
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
    valence: definition.valence || null,
    router_selectable: definition.router_selectable === true,
    simulated_only: definition.simulated_only === true,
    request_type: requestType,
    reviewer_signal: reviewerSignal,
    learner_signal: requestType,
    engagement_stance_reason: String(
      source.engagement_stance_reason || source.stance_reason || source.register_reason || source.reason || '',
    ),
    register_reason: String(
      source.engagement_stance_reason || source.stance_reason || source.register_reason || source.reason || '',
    ),
    evidence_span: String(source.evidence_span || source.evidence || ''),
    risk_flags: Array.isArray(source.risk_flags) ? source.risk_flags.map(String) : [],
    expected_dag_move: String(source.expected_dag_move || ''),
    expected_field_move: String(source.expected_field_move || source.expected_learner_field_move || ''),
    expected_progress_marker: String(source.expected_progress_marker || ''),
    temperature: state.register?.temperature ?? DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
    engagement_stance_temperature: state.register?.temperature ?? DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
    temperature_scope: temperatureSelection.scope,
    temperature_applied: temperatureSelection.applied,
    confidence: Number.isFinite(Number(source.confidence)) ? Number(source.confidence) : null,
    selected_probability: Number.isFinite(Number(source.selected_probability))
      ? Number(source.selected_probability)
      : null,
    distribution: Array.isArray(source.distribution) ? source.distribution : null,
    engagement_stance_distribution: Array.isArray(source.engagement_stance_distribution)
      ? source.engagement_stance_distribution
      : Array.isArray(source.distribution)
        ? source.distribution
        : null,
    pre_override_engagement_stance_distribution: Array.isArray(source.pre_override_engagement_stance_distribution)
      ? source.pre_override_engagement_stance_distribution
      : null,
    register_vector:
      source.register_vector && typeof source.register_vector === 'object' ? source.register_vector : null,
    engagement_stance_vector:
      source.engagement_stance_vector && typeof source.engagement_stance_vector === 'object'
        ? source.engagement_stance_vector
        : source.register_vector && typeof source.register_vector === 'object'
          ? source.register_vector
          : null,
    register_vector_entropy_bits: Number.isFinite(Number(source.register_vector_entropy_bits))
      ? Number(source.register_vector_entropy_bits)
      : null,
    field_policy: source.field_policy || null,
    trajectory_policy: source.trajectory_policy || null,
    dynamical_system_policy: source.dynamical_system_policy || null,
    continuous_register_policy: source.continuous_register_policy || null,
    response_configuration: responseConfiguration,
    light_adaptation: responseConfiguration.light_adaptation,
    state_policy: source.state_policy || null,
    source: source.source || 'combined_learner_analysis',
    ...(source.predeclared_pressure === true ? { predeclared_pressure: true } : {}),
    random: source.random || null,
    random_performance: randomPerformanceEnabled
      ? {
          schema: 'machinespirits.tutor-stub.random-performance-selection.v1',
          enabled: randomPerformanceActive,
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
            action_family: true,
            audience_register: true,
            lexical_accessibility: true,
            scene_immersion: true,
          },
          engagement_stance: randomStanceEnabled ? source.random || null : null,
          actorial_part: randomCharacterEnabled ? responseConfiguration.actorial_part_selection?.random || null : null,
          hard_constraints_preserved: ['dialogue_closure', 'evidence_release', 'response_safety'],
        }
      : null,
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
                  applied:
                    !lightAdaptationTriggered &&
                    responseConfiguration.actorial_part_selection?.explicit_directive?.applied !== false,
                  outcome: lightAdaptationTriggered
                    ? 'overridden_by_light_adaptation'
                    : responseConfiguration.actorial_part_selection?.explicit_directive?.outcome || 'applied',
                  assessment_influence: false,
                }
              : null,
            assessment_influence: {
              engagement_stance: !explicitRegister,
              actorial_part: !explicitCharacter,
              action_family: true,
              audience_register: true,
              lexical_accessibility: true,
              scene_immersion: true,
            },
            hard_constraints_preserved: [
              'dialogue_closure',
              'authored_evidence_source',
              'evidence_release',
              'response_safety',
            ],
          }
        : null,
    model: raw ? { provider: raw.provider, model: raw.model, latencyMs: raw.latencyMs, usage: raw.usage } : null,
    selectedAtDag: tutorLearnerDag?.model || null,
    efficacy: null,
  };
  if (source.warning) {
    selection.warning = source.warning;
  } else if (!requestedIsKnown && selection.source === 'combined_learner_analysis') {
    selection.warning = source.warning || `invalid_register_selection:${requested || 'missing'}`;
  } else if (dynamicBriskBlocked) {
    selection.warning = 'dynamic_policy_brisk_demoted';
    selection.original_register = requested;
  }
  selection.response_configuration.compatibility.legacy_selected_register = selection.legacy_selected_register;
  state.register.history.push(selection);
  state.register.current = selection;
  return selection;
}

function emptyTutorLearnerDagModel(state, tutorTurn, dagPreflight = null) {
  const record = state.learnerDag.record;
  const world = state.world;
  const previousModel = state.learnerDag.lastModel || state.turns?.at(-1)?.tutorLearnerDagModel || null;
  const dagFactDropout = applyTutorStubDagFactDropout({
    dropout: state.learnerDag.dropout,
    board: record.board,
    world,
    turn: tutorTurn,
  });
  const snapshot = buildLearnerDagSnapshot(world, {
    turn: tutorTurn,
    boardFacts: [...record.board.values()],
    validFacts: [...record.board.values()],
    voiced: record.voiced,
    hypotheses: record.hypotheses,
    ledger: publicReleaseLedger(state, tutorTurn),
    source: 'tutor_stub_tutor_learner_dag_model',
  });
  record.snapshots.push(snapshot);
  const learnerDag = buildLearnerDag(record.snapshots, world);
  const proxyDagMemory = buildLearnerProxyDagMemory({
    turn: tutorTurn,
    questionPattern: world.questionPattern,
    rules: world.rules,
    groundedFacts: [...record.board.values()],
    voiced: record.voiced,
    hypotheses: record.hypotheses,
    factSurface: (fact) => factSurface(world, fact),
  });
  const model = buildTutorLearnerDagModel({
    turn: tutorTurn,
    role: 'tutor',
    proxyDagMemory,
    assessment: learnerDag.assessment,
  });
  model.memoryReliability = projectTutorStubDagMemoryReliability(dagFactDropout);
  const advance = buildTutorStubLearnerAdvance({ beforeModel: previousModel, afterModel: model });
  model.learnerAdvance = advance;
  return { model, dagFactDropout, advance, preflight: dagPreflight };
}

async function buildTutorLearnerDagForTurn(
  learnerText,
  state,
  { dagPreflight = null, signal = null, isCurrent = null, classification = null } = {},
) {
  if (!state.learnerDag.enabled || !state.world) return null;
  const tutorTurn = state.turns.length + 1;
  startInterimAnimation(state, 'modeling learner DAG', { learnerText, tutorTurn });
  try {
    const extractedUpdate = await extractLearnerRecordUpdate({ learnerText, state, tutorTurn, dagPreflight, signal });
    assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
    const discoursePlane = resolveTutorStubDiscoursePlane({ learnerText, classification });
    const update = freezeTutorStubLearnerRecordUpdateForDiscoursePlane({
      update: extractedUpdate,
      discoursePlane,
    });
    const result = applyLearnerRecordUpdate({
      update,
      state,
      tutorTurn,
      learnerText,
      ...learnerPublicEvidenceState(state, tutorTurn),
    });
    result.preflight = dagPreflight;
    state.learnerDag.lastModel = result.model;
    stopInterimAnimation(state);
    printAutomaticTechnicalDetails(state, () => printTutorLearnerDagModel(result));
    return result;
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    const empty = emptyTutorLearnerDagModel(state, tutorTurn, dagPreflight);
    const model = empty.model;
    const result = {
      model,
      preflight: dagPreflight,
      advance: empty.advance,
      dagFactDropout: empty.dagFactDropout,
      accepted: {
        adopt: [],
        retract: [],
        derive: [],
        hypothesis: null,
        assertAnswer: null,
        humanDiscourse: normalizeHumanDiscourseExtraction(),
      },
      rejected: [],
      extractor: {
        error: err.message,
        provider: state.learnerDag.resolved.provider,
        model: state.learnerDag.resolved.model,
      },
    };
    state.learnerDag.lastModel = result.model;
    stopInterimAnimation(state);
    printAutomaticTechnicalDetails(state, () => printTutorLearnerDagModel(result));
    return result;
  }
}

function updateComprehensionForLearnerTurn({ learnerText, state, classification, tutorTurn, recordTrace = true }) {
  const request = detectTutorStubComprehensionRequest({
    text: learnerText,
    classification,
    source: 'learner_turn',
    turn: tutorTurn,
  });
  const previous = state.comprehension?.lastRequest || null;
  const duplicate = Boolean(
    request.detected &&
    previous &&
    Number(previous.turn) === Number(request.turn) &&
    previous.source === request.source &&
    previous.text === request.text,
  );
  if (request.detected) {
    if (duplicate) {
      if (request.requestType) previous.requestType = request.requestType;
    } else {
      applyTutorStubComprehensionRequest(state.comprehension, request);
    }
    if (recordTrace) {
      appendTraceEvent(state.trace, {
        type: 'comprehension_request',
        turn: tutorTurn,
        source: request.source,
        requestType: request.requestType,
        terms: request.terms,
        generic: request.generic,
        text: request.text,
        deduplicated: duplicate,
        advancesLearnerDag: false,
        state: tutorStubComprehensionSnapshot(state.comprehension, { turn: tutorTurn }),
      });
    }
  }
  return {
    request,
    snapshot: tutorStubComprehensionSnapshot(state.comprehension, { turn: tutorTurn }),
  };
}

function updateReleasePacingForLearnerTurn({
  learnerText,
  state,
  classification,
  tutorLearnerDag,
  tutorTurn,
  recordTrace = true,
}) {
  const releasePacing = advanceTutorStubReleasePacing({
    pacing: state.releasePacing,
    world: state.world,
    turn: tutorTurn,
    learnerText,
    classification,
    tutorLearnerDag,
    conversationalCompletion: tutorLearnerDag?.conversationalCompletion || null,
  });
  if (!releasePacing) return null;
  if (recordTrace) {
    appendTraceEvent(state.trace, {
      type: 'release_pacing_update',
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

function resolveConversationalCompletionForLearnerTurn({ learnerText, state, classification, tutorLearnerDag }) {
  const conversationalCompletion = resolveTutorStubConversationalCompletion({
    mode: state?.dagMode || 'strict_dag',
    learnerText,
    previousTutorText: latestTutorMessage(state),
    classification,
    tutorLearnerDag,
  });
  if (tutorLearnerDag) tutorLearnerDag.conversationalCompletion = conversationalCompletion;
  return conversationalCompletion;
}

function tutorStubNewEvidenceAvailable(state) {
  return !tutorStubReleaseScheduleExhausted(tutorStubReleasePacingSnapshot(state?.releasePacing, state?.world));
}

function applyConversationalCompletionForLearnerTurn(state, registerSelection, conversationalCompletion) {
  const application = applyTutorStubConversationalCompletionSelection(registerSelection, conversationalCompletion, {
    newEvidenceAvailable: tutorStubNewEvidenceAvailable(state),
  });
  if (state.register?.enabled && application.selection) {
    if (state.register.history.at(-1)?.turn === application.selection.turn) {
      state.register.history[state.register.history.length - 1] = application.selection;
    }
    state.register.current = application.selection;
  }
  return application.selection;
}

async function analyzeLearnerTurnCombined(
  learnerText,
  state,
  { precomputedRaw = null, signal = null, isCurrent = null, tutorFeedback = null } = {},
) {
  const tutorTurn = state.turns.length + 1;
  const startedAt = Date.now();
  updateComprehensionForLearnerTurn({
    learnerText,
    state,
    classification: null,
    tutorTurn,
    recordTrace: false,
  });
  startInterimAnimation(state, 'analyzing learner', { learnerText, tutorTurn });
  let raw = precomputedRaw?.dagPreflight ? precomputedRaw : null;
  if (precomputedRaw && !precomputedRaw.dagPreflight) {
    appendTraceEvent(state.trace, {
      type: 'learner_dag_preflight_cache_rejected',
      turn: tutorTurn,
      reason: 'missing_pre_model_preflight',
    });
  }

  try {
    raw = raw || (await extractCombinedLearnerAnalysis({ learnerText, state, tutorTurn, tutorFeedback, signal }));
    assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
    const classification = classificationFromCombinedAnalysis(raw, state);
    const discoursePlane = resolveTutorStubDiscoursePlane({ learnerText, classification });
    const update = freezeTutorStubLearnerRecordUpdateForDiscoursePlane({
      update: learnerRecordFromCombinedAnalysis(raw),
      discoursePlane,
    });
    const tutorLearnerDag = applyLearnerRecordUpdate({
      update,
      state,
      tutorTurn,
      learnerText,
      ...learnerPublicEvidenceState(state, tutorTurn),
    });
    tutorLearnerDag.preflight = raw.dagPreflight || null;
    applyLearnerAdvanceAssessment(classification, tutorLearnerDag);
    resolveConversationalCompletionForLearnerTurn({ learnerText, state, classification, tutorLearnerDag });
    state.learnerDag.lastModel = tutorLearnerDag.model;
    updateComprehensionForLearnerTurn({ learnerText, state, classification, tutorTurn });
    updateReleasePacingForLearnerTurn({ learnerText, state, classification, tutorLearnerDag, tutorTurn });
    const previousRegisterEfficacy = evaluatePendingRegisterEfficacy(
      state,
      tutorLearnerDag,
      classification,
      tutorFeedback,
    );
    let registerSelection = normalizeResponseConfigurationSelection(registerSelectionFromCombinedAnalysis(raw), {
      state,
      classification,
      tutorLearnerDag,
      raw,
      learnerText,
    });
    registerSelection = applyConversationalCompletionForLearnerTurn(
      state,
      registerSelection,
      tutorLearnerDag?.conversationalCompletion || null,
    );
    stopInterimAnimation(state);
    printAutomaticTechnicalDetails(state, () => {
      printClassification(classification);
      printTutorLearnerDagModel(tutorLearnerDag);
      printResponseConfigurationSelection(registerSelection, previousRegisterEfficacy);
    });
    return { classification, tutorLearnerDag, registerSelection, previousRegisterEfficacy };
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    const classification = failedClassification({
      message: err.message,
      resolved: state.learnerDag.resolved,
      latencyMs: Date.now() - startedAt,
    });
    const empty = emptyTutorLearnerDagModel(state, tutorTurn, raw?.dagPreflight || null);
    const model = empty.model;
    const tutorLearnerDag = {
      model,
      preflight: raw?.dagPreflight || null,
      advance: empty.advance,
      dagFactDropout: empty.dagFactDropout,
      accepted: {
        adopt: [],
        retract: [],
        derive: [],
        hypothesis: null,
        assertAnswer: null,
        humanDiscourse: normalizeHumanDiscourseExtraction(),
      },
      rejected: [],
      extractor: {
        error: err.message,
        provider: state.learnerDag.resolved.provider,
        model: state.learnerDag.resolved.model,
      },
    };
    state.learnerDag.lastModel = tutorLearnerDag.model;
    resolveConversationalCompletionForLearnerTurn({ learnerText, state, classification, tutorLearnerDag });
    updateComprehensionForLearnerTurn({ learnerText, state, classification, tutorTurn });
    updateReleasePacingForLearnerTurn({ learnerText, state, classification, tutorLearnerDag, tutorTurn });
    const previousRegisterEfficacy = evaluatePendingRegisterEfficacy(
      state,
      tutorLearnerDag,
      classification,
      tutorFeedback,
    );
    let registerSelection = normalizeResponseConfigurationSelection(null, {
      state,
      classification,
      tutorLearnerDag,
      raw: null,
      learnerText,
    });
    registerSelection = applyConversationalCompletionForLearnerTurn(
      state,
      registerSelection,
      tutorLearnerDag?.conversationalCompletion || null,
    );
    stopInterimAnimation(state);
    printAutomaticTechnicalDetails(state, () => {
      printClassification(classification);
      printTutorLearnerDagModel(tutorLearnerDag);
      printResponseConfigurationSelection(registerSelection, previousRegisterEfficacy);
    });
    return { classification, tutorLearnerDag, registerSelection, previousRegisterEfficacy };
  }
}

async function analyzeLearnerTurn(
  learnerText,
  state,
  { precomputedRaw = null, signal = null, isCurrent = null, tutorFeedback = null } = {},
) {
  printWithConcurrentTerminal(state, () => printTurnDebugLine(state, state.turns.length + 1));
  assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
  if (state.classifier.enabled && state.learnerDag.enabled && state.world) {
    return await analyzeLearnerTurnCombined(learnerText, state, {
      precomputedRaw,
      signal,
      isCurrent,
      tutorFeedback,
    });
  }

  updateComprehensionForLearnerTurn({
    learnerText,
    state,
    classification: null,
    tutorTurn: state.turns.length + 1,
    recordTrace: false,
  });
  const dagPreflight = learnerDagPreflightForTurn(state, state.turns.length + 1, {
    traceSource: 'separate_classifier_and_learner_record',
  });
  const classification = await classifyForTurn(learnerText, state, { signal });
  assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
  updateComprehensionForLearnerTurn({
    learnerText,
    state,
    classification,
    tutorTurn: state.turns.length + 1,
  });
  const tutorLearnerDag = await buildTutorLearnerDagForTurn(learnerText, state, {
    dagPreflight,
    signal,
    isCurrent,
    classification,
  });
  assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
  applyLearnerAdvanceAssessment(classification, tutorLearnerDag);
  resolveConversationalCompletionForLearnerTurn({ learnerText, state, classification, tutorLearnerDag });
  updateReleasePacingForLearnerTurn({
    learnerText,
    state,
    classification,
    tutorLearnerDag,
    tutorTurn: state.turns.length + 1,
  });
  const previousRegisterEfficacy = evaluatePendingRegisterEfficacy(
    state,
    tutorLearnerDag,
    classification,
    tutorFeedback,
  );
  let registerSelection = normalizeResponseConfigurationSelection(null, {
    state,
    classification,
    tutorLearnerDag,
    raw: null,
    learnerText,
  });
  registerSelection = applyConversationalCompletionForLearnerTurn(
    state,
    registerSelection,
    tutorLearnerDag?.conversationalCompletion || null,
  );
  printAutomaticTechnicalDetails(state, () =>
    printResponseConfigurationSelection(registerSelection, previousRegisterEfficacy),
  );
  return { classification, tutorLearnerDag, registerSelection, previousRegisterEfficacy };
}

function printTutorLearnerDagModel(result) {
  for (const line of projectTutorStubLearnerDagLines(result, { colors: C })) console.log(line);
}

function responseConfigurationPresentation(selection, previousEfficacy = null) {
  const partDistribution = selection?.actorial_part_selection?.distribution
    ? selection.actorial_part_selection.distribution
        .slice(0, 4)
        .map((row) => `${displayDiagnosticLabel(row.part)} ${Math.round(Number(row.probability || 0) * 100)}%`)
        .join(', ')
    : null;
  return {
    previousEfficacy,
    fieldDelta: previousEfficacy
      ? formatSignedInterimNumber(previousEfficacy.field?.delta, { decimals: 3 }) || '0'
      : '0',
    selection,
    distribution: selection ? formatEngagementStanceDistribution(selection.distribution) : '',
    partDistribution,
  };
}

function printResponseConfigurationSelection(selection, previousEfficacy = null) {
  for (const line of projectTutorStubResponseConfigurationLines(
    responseConfigurationPresentation(selection, previousEfficacy),
    { colors: C },
  )) {
    console.log(line);
  }
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

async function callTutor({
  learnerText,
  history,
  state = null,
  systemPrompt,
  resolved,
  temperature,
  maxTokens,
  historyTurns,
  world,
  dag,
  classification,
  tutorLearnerDagModel,
  registerSelection,
  humanDiscourseFrame = null,
  dialogueClosureFrame = null,
  trace = null,
  stream = null,
  cliEffort = null,
  roleBase = 'tutor_stub_tutor',
  learnerMessages = null,
  tutorFeedback = null,
  feedbackAdaptationPlan = null,
  deferStreamOutput = false,
  passthrough = false,
  signal = null,
}) {
  const messageContext = tutorMessageContext(state, history);
  const context = messageContext.messages;
  const recentTutorTexts = context.filter((message) => message.role === 'assistant').map((message) => message.content);
  const tutorTurn = Math.floor(history.length / 2) + 1;
  // Freeze the speaking boundary once for the whole call. Release pacing is
  // transactional and can be rolled back or committed after generation; every
  // candidate in this call must nevertheless be judged against exactly the
  // evidence that appeared in the original speaking prompt.
  const speakerPublicPremiseIds = new Set(
    passthrough
      ? []
      : snapshotTutorStubPublicPremiseIds({
          committedEvidence: committedReleaseRows(state, tutorTurn),
          dueEvidence: currentReleaseRows(state, tutorTurn),
        }),
  );
  const tutorMemory = passthrough
    ? null
    : [
        '[Tutor context continuity]',
        `All ${messageContext.replayedMessageCount} previous public user/assistant messages are replayed in their original order for this model call.`,
        '[End tutor context continuity]',
      ].join('\n');
  const advisory = passthrough ? null : classifierTutorContext(classification);
  const learnerDagAdvisory = passthrough
    ? null
    : tutorLearnerDagModelContext(tutorLearnerDagModel, {
        releasedEvidence: dag && world ? committedReleaseRows(state, tutorTurn) : [],
      });
  const instructionalMetaRepair = Boolean(
    !passthrough && humanDiscourseFrame?.discoursePlane?.plane === 'instructional_meta',
  );
  const dramaticReleaseFrame = passthrough
    ? { active: false, entries: [] }
    : buildTutorStubDramaticReleaseFrame({
        dueEvidence: instructionalMetaRepair ? [] : currentReleaseRows(state, tutorTurn),
        world: state.world,
      });
  const responseConfiguration = registerSelection?.response_configuration || registerSelection || null;
  const committedPublicEvidence = passthrough ? [] : committedReleaseRows(state, tutorTurn);
  const duePublicEvidence = passthrough || instructionalMetaRepair ? [] : currentReleaseRows(state, tutorTurn);
  const publicCounterpressure = passthrough
    ? null
    : resolveTutorStubPublicCounterpressure({
        world,
        publicEvidence: committedPublicEvidence,
        dueEvidence: duePublicEvidence,
      });
  const performanceObligationContract = passthrough
    ? null
    : compileTutorStubPerformanceObligationContract({
        responseConfiguration,
        publicWorld: {
          visibility: 'public',
          title: world?.title,
          setting: world?.setting,
          question: world?.question || world?.publicQuestion,
          summary: world?.openingFrame?.situation || world?.openingSituation,
          temporal_frame: world?.presentation?.temporal_frame,
          narrative_diction: world?.presentation?.narrative_diction,
          ledger_term: world?.presentation?.ledger_term,
          public_objects: [world?.presentation?.ledger_term].filter(Boolean),
          audience_context: world?.audience?.context || null,
        },
        publicTurn: {
          visibility: 'public',
          learner_move: learnerText,
          pressure_target: publicCounterpressure?.pressureTarget || null,
          contrary_evidence: publicCounterpressure ? [publicCounterpressure.contraryEvidence] : [],
          public_evidence: committedPublicEvidence,
          due_evidence: duePublicEvidence,
        },
      });
  const speakingResponseConfiguration =
    performanceObligationContract?.tactic_applicability?.applicable === false
      ? {
          ...structuredClone(responseConfiguration || {}),
          actorial_performance: structuredClone(
            performanceObligationContract.selection?.actorial_performance ||
              responseConfiguration?.actorial_performance ||
              {},
          ),
          speaking_transition: structuredClone(performanceObligationContract.selection?.speaking_transition || null),
        }
      : responseConfiguration;
  const firstDraftHumanDiscourseAdvisory = passthrough
    ? null
    : humanDiscourseTutorContext(humanDiscourseFrame, {
        includeQuestionSupport: false,
        includeDefaultResponseShape: false,
      });
  const instructionalMetaRestatementAdvisory = instructionalMetaRepair
    ? [
        '[Tutor-only instructional repair target]',
        recentTutorTexts.length
          ? 'Restatement target: the immediately preceding public tutor message already present in replayed dialogue. Restate its meaning without copying its difficult wording.'
          : 'No preceding public tutor message is replayed. Explain the public task in plain words without repeating the inquiry question verbatim.',
        'Do not quote the public inquiry question and do not output a question mark. This turn repairs wording only.',
        '[End tutor-only instructional repair target]',
      ].join('\n')
    : null;
  const responseCompositionFrame = passthrough
    ? { active: false }
    : buildTutorStubResponseCompositionFrame({
        learnerText,
        classification,
        tutorLearnerDag: tutorLearnerDagModel,
        registerSelection,
        dramaticReleaseFrame,
        dialogueClosureFrame,
        conversationalCompletion: humanDiscourseFrame?.conversationalCompletion || null,
        publicFocusMapping: humanDiscourseFrame?.scaffoldState?.branch?.publicRelationMap || null,
        recentTutorTexts,
        discoursePlane: humanDiscourseFrame?.discoursePlane || null,
      });
  const firstDraftContract = passthrough
    ? null
    : buildTutorStubFirstDraftContract({
        learnerText,
        responseConfiguration: speakingResponseConfiguration,
        responseCompositionFrame,
        dramaticReleaseFrame,
        committedPublicEvidence,
        questionSupport: humanDiscourseFrame?.questionSupport || null,
        dialogueClosureFrame,
        performanceObligationContract,
        sourceAccessibilityPolicy: speakingResponseConfiguration?.source_accessibility_policy || 'direct_only',
        sourceAccessibilityOwner: 'post_source_sentence',
      });
  const firstDraftContractAdvisory = passthrough ? null : tutorStubFirstDraftContractPrompt(firstDraftContract);
  const comprehensionAdvisory = passthrough
    ? null
    : tutorStubComprehensionPrompt(state?.comprehension, { turn: tutorTurn });
  const directorGuidanceAdvisory = passthrough
    ? null
    : tutorStubDirectorGuidancePrompt(state?.directorGuidance, { tutorTurn });
  const coachAdvisory = passthrough ? null : tutorCoachGuidanceContext(state, { tutorTurn });
  const pointOfActionAdvisory = passthrough ? null : tutorStubPointOfActionPrompt(state?.pointOfAction?.current);
  const tuningAdvisory = passthrough ? null : tutorStubTuningTurnAdvisory(state?.tuning);
  const tutorFeedbackAdvisory = passthrough
    ? null
    : tutorStubTurnFeedbackPrompt(tutorFeedback, { adaptationPlan: feedbackAdaptationPlan });
  // The original speaking attempt receives one compiled performance contract.
  // Keep the detailed configuration/composition/release surfaces for audited
  // recovery, where a failed axis must be named precisely, instead of making
  // the first draft reconcile the same requirements several times.
  const effectiveSystemPrompt = systemPrompt;
  const learnerMessageCount = Array.isArray(learnerMessages) ? learnerMessages.length : 1;
  const learnerPrompt = passthrough
    ? learnerText
    : learnerMessageCount > 1
      ? `Learner says in ${learnerMessageCount} consecutive messages before your reply (treat them as one compound turn):\n${learnerText}`
      : `Learner says:\n${learnerText}`;
  const speakerAdvisoryParts = [
    tutorMemory,
    dag && world && !instructionalMetaRepair ? dagTurnContext(state, tutorTurn, tutorLearnerDagModel) : null,
    advisory,
    learnerDagAdvisory,
    firstDraftHumanDiscourseAdvisory,
    instructionalMetaRestatementAdvisory,
    comprehensionAdvisory,
    directorGuidanceAdvisory,
    coachAdvisory,
    pointOfActionAdvisory,
    tuningAdvisory,
    tutorFeedbackAdvisory,
    // Keep the executable contract nearest the learner line so later analysis
    // advisories cannot bury the actual speaking task.
    firstDraftContractAdvisory,
  ]
    .filter(Boolean)
    .map((text) => sanitizeTutorStubSpeakerAdvisory({ world: dag ? world : null, tutorTurn, text }));
  const promptParts = [...speakerAdvisoryParts, learnerPrompt].filter(Boolean);
  const userPrompt = promptParts.join('\n\n');
  const machineAdvisoryParts = [...speakerAdvisoryParts].filter(Boolean);
  let effectiveSpeakerSystemPrompt = effectiveSystemPrompt;
  let effectiveSpeakerUserPrompt = userPrompt;
  let effectiveSpeakerInstructionTexts = [systemPrompt, ...machineAdvisoryParts].filter(Boolean);
  let speakerPrivilegeAudit = passthrough
    ? {
        schema: 'machinespirits.tutor-stub.speaker-privilege-audit.v1',
        ok: true,
        bypassed: true,
        reason: 'passthrough_uses_only_system_setup_public_history_and_latest_user_message',
      }
    : auditTutorStubSpeakerPrivilege({
        world: dag ? world : null,
        tutorTurn,
        systemPrompt: effectiveSystemPrompt,
        privateAdvisory: machineAdvisoryParts.join('\n\n'),
      });
  if (!speakerPrivilegeAudit.ok) {
    const blockedAudit = speakerPrivilegeAudit;
    appendTraceEvent(trace, {
      type: 'tutor_speaker_privilege_audit',
      turn: tutorTurn,
      audit: blockedAudit,
    });
    const recovery = recoverTutorStubSpeakerPrompt({
      world: dag ? world : null,
      tutorTurn,
      baseSystemPrompt: systemPrompt,
      continuityPrompt: tutorMemory,
      publicEvidencePrompt: dag && world ? dagTurnContext(state, tutorTurn, tutorLearnerDagModel) : null,
      firstDraftContractPrompt: firstDraftContractAdvisory,
      learnerPrompt,
      messageHistory: context,
    });
    appendTraceEvent(trace, {
      type: 'tutor_speaker_privilege_recovery',
      turn: tutorTurn,
      method: recovery.method,
      applied: recovery.applied,
      originalIssues: blockedAudit.issues.map((issue) => ({ code: issue.code, source: issue.source })),
      speakerPrivilegeAudit: recovery.speakerPrivilegeAudit,
      promptAudit: recovery.promptAudit,
    });
    if (!recovery.applied) {
      const error = new Error(
        `Speaking-tutor prompt crossed the private-planner boundary and public-only recovery failed: ${blockedAudit.issues
          .map((issue) => `${issue.code}:${issue.source}`)
          .join(', ')}`,
      );
      error.code = 'TUTOR_SPEAKER_PRIVILEGE_RECOVERY_FAILED';
      throw error;
    }
    effectiveSpeakerSystemPrompt = recovery.systemPrompt;
    effectiveSpeakerUserPrompt = recovery.userPrompt;
    effectiveSpeakerInstructionTexts = recovery.instructionTexts;
    speakerPrivilegeAudit = {
      ...recovery.speakerPrivilegeAudit,
      recovery: {
        applied: true,
        method: recovery.method,
        originalIssues: blockedAudit.issues.map((issue) => ({ code: issue.code, source: issue.source })),
      },
    };
  }
  const leakGuardEnabled = Boolean(!passthrough && dag && world);
  const scaffoldGuardEnabled = Boolean(!passthrough && humanDiscourseFrame?.generousInference?.applied);
  const questionSupportGuardEnabled = Boolean(!passthrough && humanDiscourseFrame?.questionSupport?.guardRequired);
  const dramaticReleaseGuardEnabled = Boolean(!passthrough && dramaticReleaseFrame.active);
  const actorialRealizationGuardEnabled = Boolean(
    !passthrough && responseConfiguration?.actorial_part && responseConfiguration?.actorial_performance,
  );
  const responseCompositionGuardEnabled = Boolean(!passthrough && responseCompositionFrame.active);
  const repetitionGuardEnabled = Boolean(!passthrough && recentTutorTexts.length > 0);
  const closureGuardEnabled = Boolean(
    dialogueClosureFrame?.enabled && (dialogueClosureFrame.mandatory || dialogueClosureFrame.available),
  );
  const responseGuardEnabled =
    leakGuardEnabled ||
    scaffoldGuardEnabled ||
    questionSupportGuardEnabled ||
    dramaticReleaseGuardEnabled ||
    actorialRealizationGuardEnabled ||
    responseCompositionGuardEnabled ||
    repetitionGuardEnabled ||
    closureGuardEnabled;
  const guards = {
    enabled: responseGuardEnabled,
    leak: leakGuardEnabled,
    humanScaffold: scaffoldGuardEnabled,
    questionSupport: questionSupportGuardEnabled,
    dramaticRelease: dramaticReleaseGuardEnabled,
    actorialRealization: actorialRealizationGuardEnabled,
    responseComposition: responseCompositionGuardEnabled,
    repetition: repetitionGuardEnabled,
    dialogueClosure: closureGuardEnabled,
  };
  const canStreamTutor = Boolean(stream?.enabled && providerSupportsStreaming(resolved));
  const tutorStreamMode = canStreamTutor ? (responseGuardEnabled || deferStreamOutput ? 'buffered' : 'live') : 'none';
  let tutorModelCallSequence = 0;

  async function invokeTutorAttempt({
    attemptUserPrompt,
    role,
    streamMode = 'none',
    repairAttempt = 0,
    systemPromptOverride = null,
    instructionTextsOverride = null,
    privilegeAdvisoryOverride = null,
  }) {
    const startedAt = new Date().toISOString();
    const instructionTexts =
      instructionTextsOverride || (passthrough ? [systemPrompt] : effectiveSpeakerInstructionTexts);
    let attemptSystemPrompt = systemPromptOverride || effectiveSpeakerSystemPrompt;
    let effectiveAttemptUserPrompt = attemptUserPrompt;
    let effectiveInstructionTexts = instructionTexts;
    let attemptSpeakerPrivilegeAudit = speakerPrivilegeAudit;
    if (!passthrough && (systemPromptOverride || instructionTextsOverride)) {
      attemptSpeakerPrivilegeAudit = auditTutorStubSpeakerPrivilege({
        world: dag ? world : null,
        tutorTurn,
        systemPrompt: attemptSystemPrompt,
        privateAdvisory:
          privilegeAdvisoryOverride === null
            ? effectiveInstructionTexts.slice(1).join('\n\n')
            : privilegeAdvisoryOverride,
      });
      appendTraceEvent(trace, {
        type: 'tutor_speaker_privilege_audit',
        role,
        turn: tutorTurn,
        repairAttempt,
        audit: attemptSpeakerPrivilegeAudit,
      });
      if (!attemptSpeakerPrivilegeAudit.ok) {
        const error = new Error(
          `Tutor recovery prompt crossed the private-planner boundary: ${attemptSpeakerPrivilegeAudit.issues
            .map((issue) => `${issue.code}:${issue.source}`)
            .join(', ')}`,
        );
        error.code = 'TUTOR_RECOVERY_SPEAKER_PRIVILEGE_FAILED';
        error.speakerPrivilegeAudit = attemptSpeakerPrivilegeAudit;
        throw error;
      }
    }
    let promptAudit = passthrough
      ? {
          schema: 'machinespirits.tutor-stub.prompt-audit.v1',
          surface: 'tutor_turn_passthrough',
          ok: true,
          bypassed: true,
          reason: 'preserve_exact_system_history_and_user_payload',
          violations: [],
          duplicateInstructionLines: [],
        }
      : auditTutorStubPrompt({
          surface: 'tutor_turn',
          systemPrompt: attemptSystemPrompt,
          userPrompt: effectiveAttemptUserPrompt,
          messageHistory: context,
          instructionTexts: effectiveInstructionTexts,
        });
    const duplicateOnlyFailure =
      !passthrough &&
      !promptAudit.ok &&
      promptAudit.duplicateInstructionLines?.length > 0 &&
      promptAudit.violations.every((violation) => violation.code === 'duplicate_instruction_lines');
    if (duplicateOnlyFailure) {
      const originalAudit = promptAudit;
      const actualPromptRecovery = recoverTutorStubDuplicateInstructionLines({
        texts: [attemptSystemPrompt, effectiveAttemptUserPrompt],
        duplicateInstructionLines: originalAudit.duplicateInstructionLines,
      });
      const instructionRecovery = recoverTutorStubDuplicateInstructionLines({
        texts: effectiveInstructionTexts,
        duplicateInstructionLines: originalAudit.duplicateInstructionLines,
      });
      [attemptSystemPrompt, effectiveAttemptUserPrompt] = actualPromptRecovery.texts;
      effectiveInstructionTexts = instructionRecovery.texts;
      const recoveredAudit = auditTutorStubPrompt({
        surface: 'tutor_turn',
        systemPrompt: attemptSystemPrompt,
        userPrompt: effectiveAttemptUserPrompt,
        messageHistory: context,
        instructionTexts: effectiveInstructionTexts,
      });
      const recovery = {
        applied: actualPromptRecovery.applied && instructionRecovery.applied && recoveredAudit.ok,
        method: 'deduplicate_exact_instruction_lines',
        originalDuplicateInstructionLines: originalAudit.duplicateInstructionLines,
        removedPromptLineCount: actualPromptRecovery.removedLines.length,
        removedInstructionLineCount: instructionRecovery.removedLines.length,
      };
      promptAudit = { ...recoveredAudit, recovery };
      appendTraceEvent(trace, {
        type: 'prompt_audit_recovery',
        role,
        turn: tutorTurn,
        repairAttempt,
        recovery,
        audit: promptAudit,
      });
    }
    if (!promptAudit.ok) {
      appendTraceEvent(trace, {
        type: 'prompt_audit_failed',
        role,
        turn: tutorTurn,
        repairAttempt,
        audit: promptAudit,
      });
      const error = new Error(
        `Tutor prompt audit failed: ${promptAudit.violations.map((violation) => violation.code).join(', ')}${
          promptAudit.duplicateInstructionLines?.length
            ? `; repeated instruction: ${promptAudit.duplicateInstructionLines[0].line}`
            : ''
        }`,
      );
      error.code = 'TUTOR_PROMPT_AUDIT_FAILED';
      error.promptAudit = promptAudit;
      throw error;
    }
    const request = {
      systemPrompt: attemptSystemPrompt,
      messages: [...context, { role: 'user', content: effectiveAttemptUserPrompt }],
      config: {
        temperature,
        maxTokens,
        historyTurns,
        leakGuard: leakGuardEnabled,
        scaffoldGuard: scaffoldGuardEnabled,
        questionSupportGuard: questionSupportGuardEnabled,
        actorialRealizationGuard: actorialRealizationGuardEnabled,
        responseCompositionGuard: responseCompositionGuardEnabled,
        repetitionGuard: repetitionGuardEnabled,
        closureGuard: closureGuardEnabled,
        repairAttempt,
        messageHistoryMode: messageContext.historyMode,
        availableMessageCount: messageContext.availableMessageCount,
        replayedMessageCount: messageContext.replayedMessageCount,
        replayedUserMessageCount: messageContext.userMessageCount,
        replayedAssistantMessageCount: messageContext.assistantMessageCount,
        contextActivatedBy: messageContext.activatedBy,
        firstDraftContractSchema: firstDraftContract?.schema || null,
        firstDraftCompatibilityDecisions: firstDraftContract?.compatibility?.decisions || [],
        passthrough,
        promptAudit,
        speakerPrivilegeAudit: attemptSpeakerPrivilegeAudit,
      },
    };
    if (cliEffort) request.config.cliEffort = cliEffort;
    const useStreamingApi = streamMode === 'live' || streamMode === 'buffered';
    reserveProgram2ProviderBudget({ maxTokens, trace, role, turn: tutorTurn });
    reserveTutorStubMeteredModelCall({ trace, role, turn: tutorTurn });
    let response;
    if (isCliProvider(resolved.provider)) {
      const result = await callAIWithCliBridge(
        { provider: resolved.provider, model: resolved.model },
        attemptSystemPrompt,
        effectiveAttemptUserPrompt,
        role,
        { messageHistory: context, effort: cliEffort, signal },
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
      };
    } else if (useStreamingApi) {
      const sink = streamMode === 'live' ? createConsoleTokenSink(role, stream?.interim) : null;
      let final = null;
      for await (const chunk of streamAI({
        provider: resolved.provider,
        model: resolved.model,
        systemPrompt: attemptSystemPrompt,
        messages: request.messages,
        preset: 'socratic',
        config: { temperature, maxTokens },
      })) {
        if (chunk.type === 'text_delta') {
          if (sink) sink.write(chunk.content);
        } else if (chunk.type === 'done') {
          final = chunk;
        }
      }
      const streamed = sink ? sink.finish() : false;
      response = {
        text: final?.content || '',
        provider: final?.provider || resolved.provider,
        model: final?.model || resolved.model,
        latencyMs: final?.latencyMs || 0,
        usage: final?.usage || null,
        streamed,
        generatedWithStreaming: true,
        bufferedStream: streamMode === 'buffered',
      };
    } else {
      const result = await callAI({
        provider: resolved.provider,
        model: resolved.model,
        systemPrompt: attemptSystemPrompt,
        messages: request.messages,
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

    response.guardCallId = `${tutorTurn}:${++tutorModelCallSequence}`;
    response.guardRole = role;
    response.firstDraftContract = firstDraftContract ? jsonClone(firstDraftContract) : null;
    response.promptSnapshot = {
      systemPrompt: attemptSystemPrompt,
      userPrompt: effectiveAttemptUserPrompt,
      messageHistory: context,
      role,
      repairAttempt,
      config: request.config,
      promptAudit,
      speakerPrivilegeAudit: attemptSpeakerPrivilegeAudit,
      firstDraftContract: response.firstDraftContract,
    };
    appendTraceEvent(trace, {
      type: 'model_call',
      role,
      turn: tutorTurn,
      startedAt,
      provider: response.provider,
      model: response.model,
      request,
      response: {
        text: response.text,
        latencyMs: response.latencyMs,
        usage: response.usage,
        tokenUsageAvailable: response.tokenUsageAvailable,
        streamed: Boolean(response.streamed),
        effort: response.effort || response.reasoningEffort || null,
      },
    });
    return response;
  }

  function auditTutorDraft(response, { role, attempt, auditConfiguration = speakingResponseConfiguration }) {
    let responseCompositionAudit = responseCompositionGuardEnabled
      ? auditTutorStubResponseComposition({
          text: response.text,
          frame: responseCompositionFrame,
          learnerText,
          firstDraftContract,
        })
      : { ok: true, active: false, issues: [], segments: null };
    const composedText = formatTutorStubResponseComposition(responseCompositionAudit);
    if (responseCompositionAudit.ok && composedText) {
      response.text = composedText;
      responseCompositionAudit = auditTutorStubResponseComposition({
        text: response.text,
        frame: responseCompositionFrame,
        learnerText,
        firstDraftContract,
      });
    }
    response.responseComposition = responseCompositionAudit.segments || null;
    response.responseCompositionFrame = responseCompositionFrame;
    response.responseCompositionAudit = responseCompositionAudit;
    const liveTurnProgressionAudit =
      firstDraftContract?.progression?.complete === true
        ? auditTutorStubLiveTurnProgressionV1({
            contract: firstDraftContract.progression,
            text: response.text,
            responseComposition: responseCompositionAudit,
            authoredSourceTexts: (firstDraftContract.evidence?.sources || []).map((source) => source?.text),
          })
        : {
            schema: 'machinespirits.tutor-stub.live-turn-progression-audit.v1',
            active: false,
            ok: true,
            scope: 'whole_response_terminal_boundary',
            slot_ownership_inferred: false,
            issues: [],
          };
    const liveSourceActionAlignmentAudit = firstDraftContract
      ? auditTutorStubLiveSourceActionAlignmentV1({
          text: response.text,
          firstDraftContract,
        })
      : {
          schema: 'machinespirits.tutor-stub.live-source-action-alignment-audit.v1',
          active: false,
          ok: true,
          scope: 'exact_source_occurrence_and_nearest_pre_source_host_boundary',
          slot_ownership_inferred: false,
          issues: [],
        };
    const leakAudit = leakGuardEnabled
      ? auditTutorResponseLeak({
          text: response.text,
          world,
          tutorTurn,
          learnerText,
          state,
          publicPremiseIds: speakerPublicPremiseIds,
        })
      : { ok: true, leaks: [] };
    const scaffoldAudit = scaffoldGuardEnabled
      ? auditTutorStubGenerousInferenceResponse({
          text: response.text,
          resolution: humanDiscourseFrame.generousInference,
        })
      : { ok: true, issues: [], similarity: 0 };
    const questionSupportAudit = questionSupportGuardEnabled
      ? auditTutorStubQuestionSupportResponse({
          text: response.text,
          support: humanDiscourseFrame.questionSupport,
        })
      : { ok: true, issues: [] };
    const dramaticReleaseAudit = dramaticReleaseGuardEnabled
      ? auditTutorStubDramaticReleaseResponse({
          text: response.text,
          frame: dramaticReleaseFrame,
          sourceAccessibilityAudit: liveSourceActionAlignmentAudit,
        })
      : { ok: true, active: false, issues: [] };
    const releaseDeliveryAudit = auditTutorStubReleaseDelivery({
      text: response.text,
      world,
      premiseIds: dramaticReleaseFrame.entries.map((entry) => entry.premise).filter(Boolean),
    });
    const liveConfigurationSurface = tutorStubLiveResponseConfigurationSurface({
      text: response.text,
      liveSourceActionAlignmentAudit,
    });
    const responseConfigurationAudit = actorialRealizationGuardEnabled
      ? auditTutorStubResponseConfiguration({
          text: liveConfigurationSurface.text,
          configuration: auditConfiguration,
          world,
          composition: response.responseComposition,
          performanceObligationContract,
        })
      : null;
    if (responseConfigurationAudit) {
      responseConfigurationAudit.live_source_axis_ownership = {
        active: liveConfigurationSurface.active,
        reason: liveConfigurationSurface.reason,
        excluded_spans: liveConfigurationSurface.excluded_spans,
      };
    }
    const actorialRealizationAudit = responseConfigurationAudit?.actorial_realization || {
      ok: true,
      issues: [],
      active: false,
    };
    response.deliveryResponseConfiguration = jsonClone(auditConfiguration || null);
    response.responseConfigurationTransition = jsonClone(
      auditConfiguration?.recovery_transition || auditConfiguration?.speaking_transition || null,
    );
    const repetitionAudit = repetitionGuardEnabled
      ? auditTutorStubRepetitionResponse({ text: response.text, recentTutorTexts })
      : { ok: true, issues: [], maxSimilarity: 0 };
    const closureAudit = closureGuardEnabled
      ? auditTutorStubDialogueClosureResponse({ text: response.text, frame: dialogueClosureFrame })
      : { ok: true, closesDialogue: false, invitesCheckIn: false, issues: [] };
    if (leakGuardEnabled) {
      appendTraceEvent(trace, {
        type: 'tutor_response_audit',
        role,
        turn: tutorTurn,
        attempt,
        ok: leakAudit.ok,
        leaks: leakAudit.leaks,
        publicPremiseIds: [...speakerPublicPremiseIds],
        duePremiseIds: dramaticReleaseFrame.entries.map((entry) => entry.premise).filter(Boolean),
      });
    }
    if (scaffoldGuardEnabled) {
      appendTraceEvent(trace, {
        type: 'tutor_human_scaffold_audit',
        role,
        turn: tutorTurn,
        attempt,
        ok: scaffoldAudit.ok,
        issues: scaffoldAudit.issues,
        similarity: scaffoldAudit.similarity,
        generousInference: humanDiscourseFrame.generousInference,
      });
    }
    if (questionSupportGuardEnabled) {
      appendTraceEvent(trace, {
        type: 'tutor_question_support_audit',
        role,
        turn: tutorTurn,
        attempt,
        ok: questionSupportAudit.ok,
        issues: questionSupportAudit.issues,
        support: humanDiscourseFrame.questionSupport,
      });
    }
    if (dramaticReleaseGuardEnabled) {
      appendTraceEvent(trace, {
        type: 'tutor_dramatic_release_audit',
        role,
        turn: tutorTurn,
        attempt,
        ok: dramaticReleaseAudit.ok,
        issues: dramaticReleaseAudit.issues,
        frame: dramaticReleaseFrame,
      });
    }
    if (actorialRealizationGuardEnabled) {
      appendTraceEvent(trace, {
        type: 'tutor_actorial_realization_audit',
        role,
        turn: tutorTurn,
        attempt,
        ok: actorialRealizationAudit.ok,
        issues: actorialRealizationAudit.issues,
        selectedPart: auditConfiguration?.actorial_part,
        selectedPartLabel: auditConfiguration?.actorial_part_label,
        selectedPerformance: auditConfiguration?.actorial_performance,
        originallySelectedPart: responseConfiguration?.actorial_part,
        responseConfigurationTransition: response.responseConfigurationTransition,
        responseConfigurationAudit,
      });
    }
    if (responseCompositionGuardEnabled) {
      appendTraceEvent(trace, {
        type: 'tutor_response_composition_audit',
        role,
        turn: tutorTurn,
        attempt,
        ok: responseCompositionAudit.ok,
        issues: responseCompositionAudit.issues,
        frame: responseCompositionFrame,
        segments: responseCompositionAudit.segments,
      });
    }
    if (firstDraftContract) {
      appendTraceEvent(trace, {
        type: 'tutor_live_turn_progression_audit',
        role,
        turn: tutorTurn,
        attempt,
        ok: liveTurnProgressionAudit.ok,
        active: liveTurnProgressionAudit.active,
        scope: liveTurnProgressionAudit.scope,
        slotOwnershipInferred: liveTurnProgressionAudit.slot_ownership_inferred,
        issues: liveTurnProgressionAudit.issues,
        audit: liveTurnProgressionAudit,
      });
      appendTraceEvent(trace, {
        type: 'tutor_live_source_action_alignment_audit',
        role,
        turn: tutorTurn,
        attempt,
        ok: liveSourceActionAlignmentAudit.ok,
        active: liveSourceActionAlignmentAudit.active,
        scope: liveSourceActionAlignmentAudit.scope,
        slotOwnershipInferred: liveSourceActionAlignmentAudit.slot_ownership_inferred,
        issues: liveSourceActionAlignmentAudit.issues,
        directAccessible: liveSourceActionAlignmentAudit.direct_accessible,
        compensationRequired: liveSourceActionAlignmentAudit.compensation_required,
        compensationContractReady: liveSourceActionAlignmentAudit.compensation_contract_ready,
        compensationVisible: liveSourceActionAlignmentAudit.compensation_visible,
        effectiveMode: liveSourceActionAlignmentAudit.effective_mode,
        sourceAccessibility: liveSourceActionAlignmentAudit.source_accessibility,
        audit: liveSourceActionAlignmentAudit,
      });
    }
    if (repetitionGuardEnabled) {
      appendTraceEvent(trace, {
        type: 'tutor_repetition_audit',
        role,
        turn: tutorTurn,
        attempt,
        ok: repetitionAudit.ok,
        issues: repetitionAudit.issues,
        maxSimilarity: repetitionAudit.maxSimilarity,
      });
    }
    if (closureGuardEnabled) {
      appendTraceEvent(trace, {
        type: 'tutor_dialogue_closure_audit',
        role,
        turn: tutorTurn,
        attempt,
        ok: closureAudit.ok,
        closesDialogue: closureAudit.closesDialogue,
        invitesCheckIn: closureAudit.invitesCheckIn,
        issues: closureAudit.issues,
        frame: dialogueClosureFrame,
      });
    }
    return {
      ok:
        leakAudit.ok &&
        scaffoldAudit.ok &&
        questionSupportAudit.ok &&
        dramaticReleaseAudit.ok &&
        releaseDeliveryAudit.ok &&
        actorialRealizationAudit.ok &&
        responseCompositionAudit.ok &&
        liveTurnProgressionAudit.ok &&
        liveSourceActionAlignmentAudit.ok &&
        repetitionAudit.ok &&
        closureAudit.ok,
      leakAudit,
      scaffoldAudit,
      questionSupportAudit,
      dramaticReleaseAudit,
      releaseDeliveryAudit,
      actorialRealizationAudit,
      responseConfigurationAudit,
      responseCompositionAudit,
      liveTurnProgressionAudit,
      liveSourceActionAlignmentAudit,
      repetitionAudit,
      closureAudit,
    };
  }

  function preservableTutorUptake(audits) {
    if (
      (audits?.liveTurnProgressionAudit?.issues || []).some((issue) => issue.type === 'learner_uptake_not_realized')
    ) {
      return '';
    }
    if (
      (audits?.responseCompositionAudit?.issues || []).some((issue) =>
        ['missing_learner_uptake', 'generic_learner_uptake', 'verbatim_learner_echo'].includes(issue.type),
      )
    ) {
      return '';
    }
    const uptake = String(audits?.responseCompositionAudit?.segments?.uptake || '').trim();
    if (!uptake) return '';
    if (
      /\?/u.test(uptake) ||
      /^(?:what|which|who|whose|where|when|why|how|can|could|do|does|did|is|are|was|were|have|has|had|may|might|shall|should|will|would)\b/iu.test(
        uptake,
      )
    ) {
      return '';
    }
    if (/^(?:correct|exactly(?: so)?|fair|good|just so|right|yes)[.!]?$/iu.test(uptake)) return '';
    // A safe opening is not worth preserving when it is the very repetition
    // that caused this draft to be rejected. Let the deterministic uptake
    // selector choose a fresh acknowledgement for the repair/fallback.
    if (!auditTutorStubRepetitionResponse({ text: uptake, recentTutorTexts }).ok) return '';
    if (dramaticReleaseFrame?.active) {
      const duePremiseIds = dramaticReleaseFrame.entries.map((entry) => entry?.premise).filter(Boolean);
      const uptakeDeliveryAudit = auditTutorStubReleaseDelivery({
        text: uptake,
        world,
        premiseIds: duePremiseIds,
      });
      if (uptakeDeliveryAudit.deliveredPremises.length) return '';
      const uptakeReleaseAudit = auditTutorStubDramaticReleaseResponse({ text: uptake, frame: dramaticReleaseFrame });
      if (
        uptakeReleaseAudit.entranceVisible ||
        uptakeReleaseAudit.enactmentVisible ||
        uptakeReleaseAudit.exhibitHandoffVisible
      ) {
        return '';
      }
    }
    if (!leakGuardEnabled) return uptake;
    const uptakeLeakAudit = auditTutorResponseLeak({
      text: uptake,
      world,
      tutorTurn,
      learnerText,
      state,
      publicPremiseIds: speakerPublicPremiseIds,
    });
    return uptakeLeakAudit.ok ? uptake : '';
  }

  function ensureFallbackComposition(text, uptake) {
    const candidate = composeTutorStubFallbackWithUptake({ text, uptake });
    const baseAudit = auditTutorStubResponseComposition({
      text: candidate,
      frame: responseCompositionFrame,
      learnerText,
      firstDraftContract,
    });
    return baseAudit.ok ? formatTutorStubResponseComposition(baseAudit) || candidate : candidate;
  }

  function withTutorDeliveryDecision(
    audits,
    { allowActorialAdvisory = false, advisoryReason = null, role, attempt, terminalFallback = false } = {},
  ) {
    const deliveryDecision = tutorStubGuardDeliveryDecision(tutorStubGuardIssueRows(audits), {
      allowActorialAdvisory,
      terminalFallback,
    });
    const result = {
      ...audits,
      deliveryOk: deliveryDecision.ok,
      deliveryDecision,
    };
    if (deliveryDecision.ok && deliveryDecision.advisoryIssues.length) {
      appendTraceEvent(trace, {
        type: 'tutor_response_delivery_advisory',
        role,
        turn: tutorTurn,
        attempt,
        accepted: true,
        advisoryIssues: deliveryDecision.advisoryIssues,
        reason: advisoryReason || 'optional actorial realization did not outweigh the passing hard response checks',
      });
    }
    return result;
  }

  function attachTutorDraftAudits(response, audits) {
    response.leakAudit = audits.leakAudit;
    response.scaffoldAudit = audits.scaffoldAudit;
    response.questionSupportAudit = audits.questionSupportAudit;
    response.dramaticReleaseAudit = audits.dramaticReleaseAudit;
    response.releaseDeliveryAudit = audits.releaseDeliveryAudit;
    response.actorialRealizationAudit = audits.actorialRealizationAudit;
    response.liveTurnProgressionAudit = audits.liveTurnProgressionAudit;
    response.liveSourceActionAlignmentAudit = audits.liveSourceActionAlignmentAudit;
    response.repetitionAudit = audits.repetitionAudit;
    response.closureAudit = audits.closureAudit;
    response.deliveryDecision = audits.deliveryDecision || null;
    return response;
  }

  function tutorResponseFromSimplifiedRecovery(recoveryResponse, text, candidateKind) {
    return {
      ...recoveryResponse,
      text,
      recoveryCandidateKind: candidateKind,
      recoveryStrategy: {
        schema: 'machinespirits.tutor-stub.guard-recovery.v1',
        parseMode: 'single_plain_text',
        parsed: Boolean(String(text || '').trim()),
        error: String(text || '').trim() ? null : 'empty simplified recovery candidate',
      },
    };
  }

  if (firstDraftContract) {
    appendTraceEvent(trace, {
      type: 'tutor_first_draft_contract',
      turn: tutorTurn,
      contract: firstDraftContract,
      publicTranscriptChanged: false,
    });
  }

  // Program-2 Phase 5 committee first draft
  // (PROGRAM-2-PHASE5-LIVE-PILOT-PREREGISTRATION.md §2): at warrant_skip
  // moments in the committee arm, the local mini writes the reply, the
  // frontier composes the turn around the mini's question span verbatim, and
  // the fail-closed battery decides which text becomes the first draft. The
  // chosen draft then passes through the standard guard/repair pipeline
  // below, identical to every other arm.
  async function invokeCommitteeFirstDraft() {
    const momentTurn = state.pointOfAction.current;
    const activation = tutorStubPointOfActionTargetText('warrant_skip');
    const miniUserPrompt = `${effectiveSpeakerUserPrompt}\n\n${activation}`;
    const miniStartedAt = new Date().toISOString();
    let miniText = '';
    let miniLatencyMs = 0;
    let miniError = null;
    reserveTutorStubMeteredModelCall({ trace, role: `${roleBase}_committee_mini`, turn: tutorTurn });
    try {
      const mini = await committeeMiniGenerate({
        url: state.committee.ollamaUrl,
        model: state.committee.miniModel,
        systemPrompt: effectiveSpeakerSystemPrompt,
        messages: [...context, { role: 'user', content: miniUserPrompt }],
        numCtx: state.committee.numCtx,
        maxTokens,
        timeoutMs: state.committee.timeoutMs,
      });
      miniText = String(mini.text || '').trim();
      miniLatencyMs = mini.latencyMs;
    } catch (err) {
      miniError = String(err?.message || err).slice(0, 300);
    }
    appendTraceEvent(trace, {
      type: 'model_call',
      role: `${roleBase}_committee_mini`,
      turn: tutorTurn,
      startedAt: miniStartedAt,
      provider: 'ollama',
      model: state.committee.miniModel,
      request: {
        systemPrompt: effectiveSpeakerSystemPrompt,
        messages: [...context, { role: 'user', content: miniUserPrompt }],
        config: { temperature: 0, numCtx: state.committee.numCtx, maxTokens, think: false },
      },
      response: { text: miniText, latencyMs: miniLatencyMs, error: miniError },
    });
    const miniResponseEnvelope = (deliveredText = miniText) => ({
      text: deliveredText,
      provider: 'ollama',
      model: state.committee.miniModel,
      latencyMs: miniLatencyMs,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0 },
      tokenUsageAvailable: false,
      guardCallId: `${tutorTurn}:${++tutorModelCallSequence}`,
      guardRole: roleBase,
      firstDraftContract: firstDraftContract ? jsonClone(firstDraftContract) : null,
      promptSnapshot: {
        systemPrompt: effectiveSpeakerSystemPrompt,
        userPrompt: miniUserPrompt,
        messageHistory: context,
        role: `${roleBase}_committee_mini`,
        repairAttempt: 0,
        config: { temperature: 0, maxTokens, committee: true },
        promptAudit: null,
        speakerPrivilegeAudit: speakerPrivilegeAudit,
      },
    });
    // Phase 5b fallback resolution
    // (PROGRAM-2-PHASE5B-FALLBACK-BATTERY-PREREGISTRATION.md §2): under
    // policy v2 the fallback text must pass the same one-question + cue
    // battery — greedy first, then up to two resamples at the frozen
    // sampled temperature, then the cue-preserving trim. Policy v1 ships
    // the greedy reply unchecked (the Phase 5 behavior).
    async function resolveCommitteeFallbackEnvelope() {
      const fallback = { policy: state.committee.fallbackPolicy || 'v1', resolution: 'v1_unchecked', resamples: 0 };
      let deliveredText = miniText;
      if (fallback.policy === 'v2') {
        if (committeeFallbackBatteryPass(miniText)) {
          fallback.resolution = 'selected_greedy';
        } else {
          let selected = null;
          for (let attempt = 1; attempt <= 2 && !selected; attempt += 1) {
            fallback.resamples = attempt;
            reserveTutorStubMeteredModelCall({
              trace,
              role: `${roleBase}_committee_mini_resample`,
              turn: tutorTurn,
            });
            try {
              const resampleStartedAt = new Date().toISOString();
              const sample = await committeeMiniGenerate({
                url: state.committee.ollamaUrl,
                model: state.committee.miniModel,
                systemPrompt: effectiveSpeakerSystemPrompt,
                messages: [...context, { role: 'user', content: miniUserPrompt }],
                numCtx: state.committee.numCtx,
                maxTokens,
                timeoutMs: state.committee.timeoutMs,
                temperature: 0.35,
              });
              const sampleText = String(sample.text || '').trim();
              appendTraceEvent(trace, {
                type: 'model_call',
                role: `${roleBase}_committee_mini_resample`,
                turn: tutorTurn,
                startedAt: resampleStartedAt,
                provider: 'ollama',
                model: state.committee.miniModel,
                request: { config: { temperature: 0.35, resample: attempt } },
                response: { text: sampleText, latencyMs: sample.latencyMs },
              });
              if (committeeFallbackBatteryPass(sampleText)) selected = sampleText;
            } catch (err) {
              appendTraceEvent(trace, {
                type: 'program2_committee_resample_error',
                turn: tutorTurn,
                attempt,
                error: String(err?.message || err).slice(0, 200),
              });
              break;
            }
          }
          if (selected) {
            fallback.resolution = `selected_sampled_${fallback.resamples}`;
            deliveredText = selected;
          } else {
            const trimmed = trimCommitteeFallback(miniText);
            fallback.resolution = trimmed.changed ? 'trimmed' : 'unchanged';
            deliveredText = trimmed.text;
          }
        }
      }
      moment.fallback = fallback;
      moment.deliveredFallbackText = deliveredText === miniText ? null : deliveredText;
      return miniResponseEnvelope(deliveredText);
    }
    const moment = {
      schema: PROGRAM2_COMMITTEE_SCHEMA,
      turn: tutorTurn,
      trigger: momentTurn.assigned_trigger,
      miniModel: state.committee.miniModel,
      miniLatencyMs,
      miniError,
      miniText,
      span: null,
      spanSentenceCount: 0,
      composedText: null,
      composerLatencyMs: null,
      composerError: null,
      battery: null,
      source: null,
    };
    let chosen;
    if (miniError || !miniText) {
      moment.source = 'frontier_mini_unavailable';
      chosen = await invokeTutorAttempt({
        attemptUserPrompt: effectiveSpeakerUserPrompt,
        role: roleBase,
        streamMode: tutorStreamMode,
        repairAttempt: 0,
      });
    } else {
      const spans = committeeQuestionSentences(miniText);
      moment.spanSentenceCount = spans.length;
      if (!spans.length) {
        moment.source = 'fallback_no_span';
        chosen = await resolveCommitteeFallbackEnvelope();
      } else {
        const span = spans.join(' ');
        moment.span = span;
        const compositionBlock = buildCommitteeCompositionBlock(span);
        try {
          const composer = await invokeTutorAttempt({
            attemptUserPrompt: `${effectiveSpeakerUserPrompt}\n\n${compositionBlock}`,
            role: `${roleBase}_committee_composer`,
            streamMode: 'none',
            repairAttempt: 0,
            instructionTextsOverride: [...effectiveSpeakerInstructionTexts, compositionBlock],
          });
          moment.composedText = composer.text;
          moment.composerLatencyMs = composer.latencyMs;
          const battery = runCommitteeBattery({ composedText: composer.text, span });
          moment.battery = battery;
          if (battery.pass) {
            moment.source = 'composed';
            chosen = composer;
            chosen.guardRole = roleBase;
          } else {
            moment.source =
              battery.failedCheck === 'span_contained'
                ? 'fallback_span_lost'
                : battery.failedCheck === 'exactly_one_question'
                  ? 'fallback_multi_question'
                  : 'fallback_empty';
            chosen = await resolveCommitteeFallbackEnvelope();
          }
        } catch (err) {
          moment.composerError = String(err?.message || err).slice(0, 300);
          moment.source = 'fallback_error';
          chosen = await resolveCommitteeFallbackEnvelope();
        }
      }
    }
    appendTraceEvent(trace, {
      type: 'program2_committee_moment',
      turn: tutorTurn,
      moment,
    });
    chosen.committeeMoment = moment;
    return chosen;
  }

  try {
    const attempts = [];
    const repairsApplied = [];
    const committeeMomentActive = Boolean(
      !passthrough && state?.committee?.enabled && state?.pointOfAction?.current?.assigned_trigger === 'warrant_skip',
    );
    let response = committeeMomentActive
      ? await invokeCommitteeFirstDraft()
      : await invokeTutorAttempt({
          attemptUserPrompt: effectiveSpeakerUserPrompt,
          role: roleBase,
          streamMode: tutorStreamMode,
          repairAttempt: 0,
        });

    if (passthrough) {
      response.passthrough = true;
      return response;
    }
    if (!responseGuardEnabled) {
      attempts.push(tutorGuardAttemptEnvelope({ kind: 'original_candidate', attempt: 0, response }));
      return attachTutorGuardAccounting({
        response,
        state,
        trace,
        tutorTurn,
        role: roleBase,
        guards,
        attempts,
        repairsApplied,
        finalSource: 'original_candidate',
        outcome: 'unguarded_original',
      });
    }

    const learnerRequestedPlainStyle = tutorStubLearnerRequestedPlainStyle(learnerText, classification);
    const originalDraftAudits = auditTutorDraft(response, { role: roleBase, attempt: 0 });
    let audits = withTutorDeliveryDecision(originalDraftAudits, {
      allowActorialAdvisory:
        learnerRequestedPlainStyle ||
        tutorStubActorialPerformanceMayBeAdvisory(
          originalDraftAudits.actorialRealizationAudit,
          originalDraftAudits.responseConfigurationAudit,
        ),
      advisoryReason: learnerRequestedPlainStyle
        ? 'explicit learner style request outranks optional actorial realization'
        : 'the selected host part and every hard response check are visible; only the optional performance tactic remains below the deterministic threshold',
      role: roleBase,
      attempt: 0,
    });
    attempts.push(tutorGuardAttemptEnvelope({ kind: 'original_candidate', attempt: 0, response, audits }));
    if (audits.deliveryOk) {
      attachTutorDraftAudits(response, audits);
      if (response.bufferedStream) {
        response.guardedStreamReplay = true;
      }
      return attachTutorGuardAccounting({
        response,
        state,
        trace,
        tutorTurn,
        role: roleBase,
        guards,
        attempts,
        repairsApplied,
        finalSource: 'original_candidate',
        finalAudits: audits,
        outcome: audits.ok ? 'guarded_original_accepted' : 'guarded_original_accepted_with_advisory',
      });
    }

    const hostPartRepair = repairTutorStubMissingActorialPart({
      text: response.text,
      deliveryDecision: audits.deliveryDecision,
      responseConfiguration: speakingResponseConfiguration,
      responseComposition: audits.responseCompositionAudit?.segments,
    });
    if (hostPartRepair.changed) {
      const hostPartResponse = {
        ...response,
        text: hostPartRepair.text,
      };
      const hostPartAttempt = attempts.length;
      const hostPartAudits = withTutorDeliveryDecision(
        auditTutorDraft(hostPartResponse, {
          role: `${roleBase}_actorial_part_repair`,
          attempt: hostPartAttempt,
        }),
        { role: `${roleBase}_actorial_part_repair`, attempt: hostPartAttempt },
      );
      const hostPartRepairSpans = exactTutorRepairSpans(response.text, hostPartResponse.text);
      attempts.push(
        tutorGuardAttemptEnvelope({
          kind: 'actorial_part_repair_candidate',
          attempt: hostPartAttempt,
          response: hostPartResponse,
          audits: hostPartAudits,
          repairedSpans: hostPartRepairSpans,
        }),
      );
      repairsApplied.push({
        kind: 'mechanical_actorial_part_repair',
        fromAttempt: 0,
        toAttempt: hostPartAttempt,
        triggeredBy: tutorStubGuardIssueRows(audits),
        guardedSpans: attempts[0].guardedSpans,
        repairedSpans: hostPartRepairSpans,
        cue: hostPartRepair.cue,
      });
      appendTraceEvent(trace, {
        type: 'tutor_response_mechanical_repair',
        role: `${roleBase}_actorial_part_repair`,
        turn: tutorTurn,
        attempt: hostPartAttempt,
        repairKind: 'missing_actorial_host_part',
        accepted: hostPartAudits.deliveryOk,
        cue: hostPartRepair.cue,
        text: hostPartRepair.text,
      });
      if (hostPartAudits.deliveryOk) {
        attachTutorDraftAudits(hostPartResponse, hostPartAudits);
        hostPartResponse.repaired = true;
        hostPartResponse.mechanicalRepair = true;
        if (hostPartResponse.bufferedStream) hostPartResponse.guardedStreamReplay = true;
        return attachTutorGuardAccounting({
          response: hostPartResponse,
          state,
          trace,
          tutorTurn,
          role: roleBase,
          guards,
          attempts,
          repairsApplied,
          finalSource: 'actorial_part_repair_candidate',
          finalAudits: hostPartAudits,
          outcome: 'guarded_actorial_part_repair_accepted',
        });
      }
    }

    const firstRepairTriggers = tutorStubGuardIssueRows(audits);
    const firstPreservedUptake = preservableTutorUptake(audits);
    const firstRepairUptake =
      firstPreservedUptake ||
      deterministicTutorStubTurnProgressionUptake({
        contract: firstDraftContract?.progression || null,
        recentTutorTexts,
        variationKey: `${stateRunDebugId(state)}:${tutorTurn}`,
        learnerEchoGuard: (candidate) => tutorStubSubstantiveLearnerEcho(candidate, learnerText),
        defaultUptake: deterministicTutorStubLearnerUptake({
          learnerText,
          classification,
          actionFamily: responseCompositionFrame.selected_action_family || null,
          recentTutorTexts,
          world,
        }),
      });
    // Keep recovery materially smaller than the normal speaking prompt while
    // sanitizing every retained contract at the current release boundary.
    // The former raw reconstruction leaked private IDs/future facts; reusing
    // every safe speaking advisory avoided that leak but made late-turn repair
    // calls unnecessarily large and prone to CLI timeouts.
    const simplifiedRecoveryConfiguration = buildTutorStubSimplifiedRecoveryConfiguration(
      speakingResponseConfiguration,
      { closureRequired: dialogueClosureFrame?.mandatory === true },
    );
    const minimalRecoveryPrompt = tutorStubSimplifiedRecoveryPrompt({
      configuration: simplifiedRecoveryConfiguration,
      firstDraftContract,
    });
    const publicRecoveryMachinePacket = [
      dag && world && !instructionalMetaRepair ? dagTurnContext(state, tutorTurn, tutorLearnerDagModel) : null,
      firstDraftHumanDiscourseAdvisory,
      instructionalMetaRestatementAdvisory,
      comprehensionAdvisory,
      directorGuidanceAdvisory,
      coachAdvisory,
      tutorFeedbackAdvisory,
    ]
      .filter(Boolean)
      .map((text) =>
        sanitizeTutorStubSpeakerAdvisory({
          world: dag ? world : null,
          tutorTurn,
          text,
        }),
      )
      .filter(Boolean);
    const publicRecoveryPacket = [...publicRecoveryMachinePacket, learnerPrompt];
    const recoveryPrompt = tutorResponseRecoveryPrompt({
      publicPacket: publicRecoveryPacket,
      hardIssues: audits.deliveryDecision?.hardIssues || [],
      leakAudit: audits.leakAudit,
      scaffoldAudit: audits.scaffoldAudit,
      questionSupportAudit: audits.questionSupportAudit,
      dramaticReleaseAudit: audits.dramaticReleaseAudit,
      actorialRealizationAudit: audits.actorialRealizationAudit,
      responseConfigurationAudit: audits.responseConfigurationAudit,
      responseConfiguration: simplifiedRecoveryConfiguration,
      responseCompositionAudit: audits.responseCompositionAudit,
      liveTurnProgressionAudit: audits.liveTurnProgressionAudit,
      liveSourceActionAlignmentAudit: audits.liveSourceActionAlignmentAudit,
      repetitionAudit: audits.repetitionAudit,
      closureAudit: audits.closureAudit,
      dialogueClosureFrame,
      minimalRecoveryPrompt,
    });
    const recoveryControlPrompt = tutorResponseRecoveryPrompt({
      publicPacket: [],
      hardIssues: audits.deliveryDecision?.hardIssues || [],
      leakAudit: audits.leakAudit,
      scaffoldAudit: audits.scaffoldAudit,
      questionSupportAudit: audits.questionSupportAudit,
      dramaticReleaseAudit: audits.dramaticReleaseAudit,
      actorialRealizationAudit: audits.actorialRealizationAudit,
      responseConfigurationAudit: audits.responseConfigurationAudit,
      responseConfiguration: simplifiedRecoveryConfiguration,
      responseCompositionAudit: audits.responseCompositionAudit,
      liveTurnProgressionAudit: audits.liveTurnProgressionAudit,
      liveSourceActionAlignmentAudit: audits.liveSourceActionAlignmentAudit,
      repetitionAudit: audits.repetitionAudit,
      closureAudit: audits.closureAudit,
      dialogueClosureFrame,
      minimalRecoveryPrompt,
    });
    const recoveryPrivilegeAdvisory = [recoveryControlPrompt, ...publicRecoveryMachinePacket]
      .filter(Boolean)
      .join('\n\n');
    const simplifiedRecoveryResponse = await invokeTutorAttempt({
      attemptUserPrompt: recoveryPrompt,
      role: `${roleBase}_recovery`,
      streamMode: canStreamTutor ? 'buffered' : 'none',
      repairAttempt: 1,
      systemPromptOverride: systemPrompt,
      instructionTextsOverride: [systemPrompt, ...publicRecoveryMachinePacket],
      privilegeAdvisoryOverride: recoveryPrivilegeAdvisory,
    });
    const recoveryCandidate = {
      schema: 'machinespirits.tutor-stub.guard-recovery.v1',
      ok: Boolean(String(simplifiedRecoveryResponse.text || '').trim()),
      parseMode: 'single_plain_text',
      text: String(simplifiedRecoveryResponse.text || '').trim(),
      error: String(simplifiedRecoveryResponse.text || '').trim() ? null : 'empty simplified recovery candidate',
    };
    appendTraceEvent(trace, {
      type: 'tutor_response_recovery_candidate',
      role: `${roleBase}_recovery`,
      turn: tutorTurn,
      modelCallCount: 1,
      parse: {
        schema: recoveryCandidate.schema,
        ok: recoveryCandidate.ok,
        mode: recoveryCandidate.parseMode,
        error: recoveryCandidate.error,
      },
      recoveryTransition: simplifiedRecoveryConfiguration.recovery_transition,
      failedHardChecks: audits.deliveryDecision?.hardIssues || [],
      candidate: { kind: 'plain_recovery_candidate', text: recoveryCandidate.text },
    });

    response = tutorResponseFromSimplifiedRecovery(
      simplifiedRecoveryResponse,
      recoveryCandidate.text,
      'plain_recovery_candidate',
    );
    const plainRecoveryDraftAudits = auditTutorDraft(response, {
      role: `${roleBase}_plain_recovery`,
      attempt: 1,
      auditConfiguration: simplifiedRecoveryConfiguration,
    });
    audits = withTutorDeliveryDecision(plainRecoveryDraftAudits, {
      allowActorialAdvisory: tutorStubPlainRecoveryAllowsActorialAdvisory({
        loopMode: state?.loopMode,
        learnerRequestedPlainStyle,
      }),
      advisoryReason: learnerRequestedPlainStyle
        ? 'explicit learner style request outranks optional actorial realization'
        : 'diagnostic collection preserves a safe plain recovery while recording optional actorial misses',
      role: `${roleBase}_plain_recovery`,
      attempt: 1,
    });
    const plainRecoveryResponse = response;
    const plainRecoveryAudits = audits;
    const modelRepairSpans = exactTutorRepairSpans(attempts[0].candidate.text, response.text);
    attempts.push(
      tutorGuardAttemptEnvelope({
        kind: 'plain_recovery_candidate',
        attempt: 1,
        response,
        audits,
        repairedSpans: modelRepairSpans,
      }),
    );
    repairsApplied.push({
      kind: 'model_plain_recovery',
      fromAttempt: 0,
      toAttempt: 1,
      triggeredBy: firstRepairTriggers,
      guardedSpans: attempts[0].guardedSpans,
      repairedSpans: modelRepairSpans,
      generatedInSameModelCall: false,
      recoveryTransition: simplifiedRecoveryConfiguration.recovery_transition,
    });
    if (audits.deliveryOk) {
      attachTutorDraftAudits(response, audits);
      response.repaired = true;
      response.plainRecovery = true;
      if (response.bufferedStream) {
        response.guardedStreamReplay = true;
      }
      return attachTutorGuardAccounting({
        response,
        state,
        trace,
        tutorTurn,
        role: roleBase,
        guards,
        attempts,
        repairsApplied,
        finalSource: 'plain_recovery_candidate',
        finalAudits: audits,
        outcome: 'guarded_plain_recovery_accepted',
      });
    }

    const recoveryCompositionIssues = (plainRecoveryAudits?.responseCompositionAudit?.issues || []).filter((issue) =>
      ['missing_learner_uptake', 'generic_learner_uptake', 'learner_selected_test_not_acknowledged'].includes(
        issue.type,
      ),
    );
    const recoveryDevelopment = String(
      plainRecoveryAudits?.responseCompositionAudit?.segments?.development || '',
    ).trim();
    if (firstRepairUptake && recoveryCompositionIssues.length && recoveryDevelopment) {
      const compositionRepairAttempt = attempts.length;
      const compositionRepairText = composeTutorStubGuardUptakeDevelopment({
        uptake: firstRepairUptake,
        development: recoveryDevelopment,
      });
      const compositionResponse = tutorResponseFromSimplifiedRecovery(
        simplifiedRecoveryResponse,
        compositionRepairText,
        'composition_repair_candidate',
      );
      const compositionDraftAudits = auditTutorDraft(compositionResponse, {
        role: `${roleBase}_composition_repair`,
        attempt: compositionRepairAttempt,
        auditConfiguration: simplifiedRecoveryConfiguration,
      });
      const compositionAudits = withTutorDeliveryDecision(compositionDraftAudits, {
        allowActorialAdvisory: tutorStubPlainRecoveryAllowsActorialAdvisory({
          loopMode: state?.loopMode,
          learnerRequestedPlainStyle,
        }),
        advisoryReason:
          'the mechanically recomposed recovery preserves the selected host part and passes every hard response check; only the optional performance tactic remains below the visibility threshold',
        role: `${roleBase}_composition_repair`,
        attempt: compositionRepairAttempt,
      });
      const compositionRepairSpans = exactTutorRepairSpans(plainRecoveryResponse.text, compositionRepairText);
      attempts.push(
        tutorGuardAttemptEnvelope({
          kind: 'composition_repair_candidate',
          attempt: compositionRepairAttempt,
          response: compositionResponse,
          audits: compositionAudits,
          repairedSpans: compositionRepairSpans,
        }),
      );
      repairsApplied.push({
        kind: 'mechanical_composition_repair',
        fromAttempt: 1,
        toAttempt: compositionRepairAttempt,
        triggeredBy: recoveryCompositionIssues.map((issue) => ({ guard: 'response_composition', ...issue })),
        guardedSpans: attempts[1].guardedSpans,
        repairedSpans: compositionRepairSpans,
      });
      appendTraceEvent(trace, {
        type: 'tutor_response_mechanical_repair',
        role: `${roleBase}_composition_repair`,
        turn: tutorTurn,
        attempt: compositionRepairAttempt,
        repairKind: 'learner_uptake_plus_policy_development',
        accepted: compositionAudits.deliveryOk,
        text: compositionRepairText,
      });
      if (compositionAudits.deliveryOk) {
        attachTutorDraftAudits(compositionResponse, compositionAudits);
        compositionResponse.repaired = true;
        compositionResponse.mechanicalRepair = true;
        if (compositionResponse.bufferedStream) compositionResponse.guardedStreamReplay = true;
        return attachTutorGuardAccounting({
          response: compositionResponse,
          state,
          trace,
          tutorTurn,
          role: roleBase,
          guards,
          attempts,
          repairsApplied,
          finalSource: 'composition_repair_candidate',
          finalAudits: compositionAudits,
          outcome: 'guarded_composition_repair_accepted',
        });
      }
    }

    const clarificationRepair = repairTutorStubMissingClarificationInvitation({
      text: plainRecoveryResponse.text,
      deliveryDecision: plainRecoveryAudits.deliveryDecision,
    });
    if (clarificationRepair.changed) {
      const clarificationAttempt = attempts.length;
      const clarificationResponse = tutorResponseFromSimplifiedRecovery(
        simplifiedRecoveryResponse,
        clarificationRepair.text,
        'question_support_repair_candidate',
      );
      const clarificationAudits = withTutorDeliveryDecision(
        auditTutorDraft(clarificationResponse, {
          role: `${roleBase}_question_support_repair`,
          attempt: clarificationAttempt,
          auditConfiguration: simplifiedRecoveryConfiguration,
        }),
        { role: `${roleBase}_question_support_repair`, attempt: clarificationAttempt },
      );
      const clarificationRepairSpans = exactTutorRepairSpans(plainRecoveryResponse.text, clarificationRepair.text);
      attempts.push(
        tutorGuardAttemptEnvelope({
          kind: 'question_support_repair_candidate',
          attempt: clarificationAttempt,
          response: clarificationResponse,
          audits: clarificationAudits,
          repairedSpans: clarificationRepairSpans,
        }),
      );
      repairsApplied.push({
        kind: 'mechanical_clarification_invitation',
        fromAttempt: 1,
        toAttempt: clarificationAttempt,
        triggeredBy: tutorStubGuardIssueRows(plainRecoveryAudits),
        guardedSpans: attempts[1].guardedSpans,
        repairedSpans: clarificationRepairSpans,
      });
      appendTraceEvent(trace, {
        type: 'tutor_response_mechanical_repair',
        role: `${roleBase}_question_support_repair`,
        turn: tutorTurn,
        attempt: clarificationAttempt,
        repairKind: 'missing_clarification_invitation',
        accepted: clarificationAudits.deliveryOk,
        text: clarificationRepair.text,
      });
      if (clarificationAudits.deliveryOk) {
        attachTutorDraftAudits(clarificationResponse, clarificationAudits);
        clarificationResponse.repaired = true;
        clarificationResponse.mechanicalRepair = true;
        if (clarificationResponse.bufferedStream) clarificationResponse.guardedStreamReplay = true;
        return attachTutorGuardAccounting({
          response: clarificationResponse,
          state,
          trace,
          tutorTurn,
          role: roleBase,
          guards,
          attempts,
          repairsApplied,
          finalSource: 'question_support_repair_candidate',
          finalAudits: clarificationAudits,
          outcome: 'guarded_question_support_repair_accepted',
        });
      }
    }

    const openRecallRepair = repairTutorStubUnanswerableOpenRecall({
      text: plainRecoveryResponse.text,
      deliveryDecision: plainRecoveryAudits.deliveryDecision,
    });
    if (openRecallRepair.changed) {
      const openRecallAttempt = attempts.length;
      const openRecallResponse = tutorResponseFromSimplifiedRecovery(
        simplifiedRecoveryResponse,
        openRecallRepair.text,
        'question_support_repair_candidate',
      );
      const openRecallAudits = withTutorDeliveryDecision(
        auditTutorDraft(openRecallResponse, {
          role: `${roleBase}_question_support_repair`,
          attempt: openRecallAttempt,
          auditConfiguration: simplifiedRecoveryConfiguration,
        }),
        { role: `${roleBase}_question_support_repair`, attempt: openRecallAttempt },
      );
      const openRecallRepairSpans = exactTutorRepairSpans(plainRecoveryResponse.text, openRecallRepair.text);
      attempts.push(
        tutorGuardAttemptEnvelope({
          kind: 'question_support_repair_candidate',
          attempt: openRecallAttempt,
          response: openRecallResponse,
          audits: openRecallAudits,
          repairedSpans: openRecallRepairSpans,
        }),
      );
      repairsApplied.push({
        kind: 'mechanical_unanswerable_open_recall_removal',
        fromAttempt: 1,
        toAttempt: openRecallAttempt,
        triggeredBy: tutorStubGuardIssueRows(plainRecoveryAudits),
        guardedSpans: attempts[1].guardedSpans,
        repairedSpans: openRecallRepairSpans,
      });
      appendTraceEvent(trace, {
        type: 'tutor_response_mechanical_repair',
        role: `${roleBase}_question_support_repair`,
        turn: tutorTurn,
        attempt: openRecallAttempt,
        repairKind: 'unanswerable_open_recall_removal',
        accepted: openRecallAudits.deliveryOk,
        text: openRecallRepair.text,
      });
      if (openRecallAudits.deliveryOk) {
        attachTutorDraftAudits(openRecallResponse, openRecallAudits);
        openRecallResponse.repaired = true;
        openRecallResponse.mechanicalRepair = true;
        if (openRecallResponse.bufferedStream) openRecallResponse.guardedStreamReplay = true;
        return attachTutorGuardAccounting({
          response: openRecallResponse,
          state,
          trace,
          tutorTurn,
          role: roleBase,
          guards,
          attempts,
          repairsApplied,
          finalSource: 'question_support_repair_candidate',
          finalAudits: openRecallAudits,
          outcome: 'guarded_question_support_repair_accepted',
        });
      }
    }

    const sourceVoiceRepairBases = [
      {
        kind: 'plain_recovery_candidate',
        attempt: 1,
        response: plainRecoveryResponse,
        audits: plainRecoveryAudits,
        auditConfiguration: simplifiedRecoveryConfiguration,
      },
    ];
    for (const base of sourceVoiceRepairBases) {
      const mechanical = repairTutorStubThirdPersonSourceLeadIn({
        text: base.response.text,
        dramaticReleaseFrame,
        responseConfiguration: simplifiedRecoveryConfiguration,
      });
      if (!mechanical.changed) continue;
      const sourceRepairAttempt = attempts.length;
      const sourceResponse = tutorResponseFromSimplifiedRecovery(
        simplifiedRecoveryResponse,
        mechanical.text,
        'source_voice_repair_candidate',
      );
      const sourceAudits = withTutorDeliveryDecision(
        auditTutorDraft(sourceResponse, {
          role: `${roleBase}_source_voice_repair`,
          attempt: sourceRepairAttempt,
          auditConfiguration: base.auditConfiguration,
        }),
        { role: `${roleBase}_source_voice_repair`, attempt: sourceRepairAttempt },
      );
      const sourceRepairSpans = exactTutorRepairSpans(base.response.text, mechanical.text);
      attempts.push(
        tutorGuardAttemptEnvelope({
          kind: 'source_voice_repair_candidate',
          attempt: sourceRepairAttempt,
          response: sourceResponse,
          audits: sourceAudits,
          repairedSpans: sourceRepairSpans,
        }),
      );
      repairsApplied.push({
        kind: 'mechanical_source_voice_repair',
        fromAttempt: base.attempt,
        toAttempt: sourceRepairAttempt,
        triggeredBy: tutorStubGuardIssueRows(base.audits),
        guardedSpans: attempts.find((attempt) => attempt.attempt === base.attempt)?.guardedSpans || [],
        repairedSpans: sourceRepairSpans,
        replacements: mechanical.replacements,
      });
      appendTraceEvent(trace, {
        type: 'tutor_response_mechanical_repair',
        role: `${roleBase}_source_voice_repair`,
        turn: tutorTurn,
        attempt: sourceRepairAttempt,
        repairKind: 'third_person_source_lead_in',
        basedOn: base.kind,
        accepted: sourceAudits.deliveryOk,
        replacements: mechanical.replacements,
        text: mechanical.text,
      });
      response = sourceResponse;
      audits = sourceAudits;
      if (sourceAudits.deliveryOk) {
        attachTutorDraftAudits(sourceResponse, sourceAudits);
        sourceResponse.repaired = true;
        sourceResponse.mechanicalRepair = true;
        if (sourceResponse.bufferedStream) sourceResponse.guardedStreamReplay = true;
        return attachTutorGuardAccounting({
          response: sourceResponse,
          state,
          trace,
          tutorTurn,
          role: roleBase,
          guards,
          attempts,
          repairsApplied,
          finalSource: 'source_voice_repair_candidate',
          finalAudits: sourceAudits,
          outcome: 'guarded_source_voice_repair_accepted',
        });
      }
    }

    // Self-correction pass — the last rung before the terminal safety text.
    //
    // The deterministic fallback is allowed to publish while the disposition
    // catalog downgrades a conversational-integrity finding to an advisory. The
    // finding is the same one that killed every model draft on this turn, so the
    // learner receives a turn that quietly changed course and is never told. One
    // more attempt is offered here, with a brief whose addressee is the learner
    // rather than the guard. Nothing about it is templated: the model may
    // disclose the near-miss in the register of the scene, or simply answer
    // well and say nothing. Only two things are checked that no other guard
    // covers — that a disclosed near-miss corresponds to a draft the tutor
    // actually produced, and that the apparatus is never named.
    const priorDisclosure = detectTutorStubSelfCorrectionDisclosure(recentTutorTexts.at(-1) || '');
    const disclosableCorrection = priorDisclosure.disclosed
      ? { disclosable: false, reason: 'the previous published turn already disclosed a self-correction' }
      : tutorStubDisclosableGuardCorrection({ audits, attempts });
    if (disclosableCorrection.disclosable) {
      const disclosureAttempt = attempts.length;
      const priorDisclosureAttempt = attempts.at(-1);
      const disclosureBrief = tutorStubSelfCorrectionDisclosurePrompt({
        correction: disclosableCorrection,
        learnerText,
        turnProgressionContract: firstDraftContract?.progression || null,
        minimalRecoveryPrompt,
      });
      const disclosureUserPrompt = [
        tutorResponseRecoveryPrompt({
          publicPacket: publicRecoveryPacket,
          hardIssues: audits.deliveryDecision?.hardIssues || [],
          leakAudit: audits.leakAudit,
          scaffoldAudit: audits.scaffoldAudit,
          questionSupportAudit: audits.questionSupportAudit,
          dramaticReleaseAudit: audits.dramaticReleaseAudit,
          actorialRealizationAudit: audits.actorialRealizationAudit,
          responseConfigurationAudit: audits.responseConfigurationAudit,
          responseConfiguration: simplifiedRecoveryConfiguration,
          responseCompositionAudit: audits.responseCompositionAudit,
          liveTurnProgressionAudit: audits.liveTurnProgressionAudit,
          liveSourceActionAlignmentAudit: audits.liveSourceActionAlignmentAudit,
          repetitionAudit: audits.repetitionAudit,
          closureAudit: audits.closureAudit,
          dialogueClosureFrame,
          minimalRecoveryPrompt,
        }),
        disclosureBrief,
      ]
        .filter(Boolean)
        .join('\n\n');
      let disclosureModelResponse = null;
      try {
        disclosureModelResponse = await invokeTutorAttempt({
          attemptUserPrompt: disclosureUserPrompt,
          role: `${roleBase}_self_correction`,
          streamMode: canStreamTutor ? 'buffered' : 'none',
          repairAttempt: disclosureAttempt,
          systemPromptOverride: systemPrompt,
          instructionTextsOverride: [systemPrompt, ...publicRecoveryMachinePacket],
          privilegeAdvisoryOverride: recoveryPrivilegeAdvisory,
        });
      } catch (disclosureError) {
        // The safety text below is still reachable. A failed extra call must
        // never cost the turn that would otherwise have shipped.
        appendTraceEvent(trace, {
          type: 'tutor_response_self_correction_pass_unavailable',
          role: `${roleBase}_self_correction`,
          turn: tutorTurn,
          attempt: disclosureAttempt,
          error: disclosureError?.message || String(disclosureError),
        });
      }
      const disclosureText = String(disclosureModelResponse?.text || '').trim();
      if (disclosureText) {
        const disclosureResponse = tutorResponseFromSimplifiedRecovery(
          disclosureModelResponse,
          disclosureText,
          'self_correction_candidate',
        );
        const disclosureDraftAudits = auditTutorDraft(disclosureResponse, {
          role: `${roleBase}_self_correction`,
          attempt: disclosureAttempt,
          auditConfiguration: simplifiedRecoveryConfiguration,
        });
        disclosureDraftAudits.selfCorrectionDisclosureAudit = auditTutorStubSelfCorrectionDisclosure({
          text: disclosureText,
          priorAttemptTexts: attempts.map((entry) => entry?.candidate?.text || '').filter(Boolean),
        });
        const disclosureAudits = withTutorDeliveryDecision(disclosureDraftAudits, {
          role: `${roleBase}_self_correction`,
          attempt: disclosureAttempt,
        });
        const disclosed = disclosureDraftAudits.selfCorrectionDisclosureAudit.disclosed;
        const disclosureRepairSpans = exactTutorRepairSpans(priorDisclosureAttempt.candidate.text, disclosureText);
        attempts.push(
          tutorGuardAttemptEnvelope({
            kind: 'self_correction_candidate',
            attempt: disclosureAttempt,
            response: disclosureResponse,
            audits: disclosureAudits,
            repairedSpans: disclosureRepairSpans,
          }),
        );
        repairsApplied.push({
          kind: 'model_self_correction_pass',
          fromAttempt: priorDisclosureAttempt.attempt,
          toAttempt: disclosureAttempt,
          triggeredBy: disclosableCorrection.findings,
          guardedSpans: priorDisclosureAttempt.guardedSpans,
          repairedSpans: disclosureRepairSpans,
          disclosedNearMiss: disclosed,
        });
        appendTraceEvent(trace, {
          type: 'tutor_response_self_correction_pass',
          role: `${roleBase}_self_correction`,
          turn: tutorTurn,
          attempt: disclosureAttempt,
          waivedFindings: disclosableCorrection.findings,
          nearMiss: disclosableCorrection.nearMiss,
          disclosed,
          marker: disclosureDraftAudits.selfCorrectionDisclosureAudit.marker,
          disclosureIssues: disclosureDraftAudits.selfCorrectionDisclosureAudit.issues,
          accepted: disclosureAudits.deliveryOk,
          text: disclosureText,
        });
        if (disclosureAudits.deliveryOk) {
          attachTutorDraftAudits(disclosureResponse, disclosureAudits);
          disclosureResponse.repaired = true;
          disclosureResponse.selfCorrectionPass = true;
          disclosureResponse.disclosedSelfCorrection = disclosed;
          if (disclosureResponse.bufferedStream) disclosureResponse.guardedStreamReplay = true;
          return attachTutorGuardAccounting({
            response: disclosureResponse,
            state,
            trace,
            tutorTurn,
            role: roleBase,
            guards,
            attempts,
            repairsApplied,
            finalSource: 'self_correction_candidate',
            outcome: disclosed ? 'guarded_self_correction_disclosed' : 'guarded_self_correction_pass_accepted',
            finalAudits: disclosureAudits,
          });
        }
      }
    }

    const closureFallbackSelected = Boolean(
      closureGuardEnabled && (dialogueClosureFrame.mandatory || audits.closureAudit.closesDialogue),
    );
    const fallbackContext = {
      support: humanDiscourseFrame?.questionSupport || null,
      world,
      learnerText,
      dueEvidence: currentReleaseRows(state, tutorTurn),
      latestEvidence: humanDiscourseFrame?.scaffoldState?.releaseState?.latestReleased || null,
      recentTutorTexts,
    };
    const fallbackRequiresSpecificUptake =
      (audits?.responseCompositionAudit?.issues || []).some(
        (issue) => issue.type === 'learner_selected_test_not_acknowledged',
      ) || tutorStubLearnerSelectedToolMarkPath(learnerText);
    const deterministicFallbackUptake = deterministicTutorStubTurnProgressionUptake({
      contract: firstDraftContract?.progression || null,
      recentTutorTexts,
      variationKey: `${stateRunDebugId(state)}:${tutorTurn}`,
      learnerEchoGuard: (candidate) => tutorStubSubstantiveLearnerEcho(candidate, learnerText),
      defaultUptake: deterministicTutorStubLearnerUptake({
        learnerText,
        classification,
        actionFamily: responseCompositionFrame.selected_action_family || null,
        recentTutorTexts,
        world,
      }),
    });
    const candidateFallbackUptake = fallbackRequiresSpecificUptake
      ? deterministicFallbackUptake
      : preservableTutorUptake(audits) || firstRepairUptake || deterministicFallbackUptake;
    const fallbackUptake =
      firstDraftContract?.opening?.writable_entry_requested === true && !/^Write:\s*[“"]/u.test(candidateFallbackUptake)
        ? deterministicTutorStubWritableEntryUptake({ firstDraftContract })
        : candidateFallbackUptake;
    // Question support and live progression can coexist with the human
    // scaffold. Their compiled contract must select the fallback; the older
    // generous-inference text does not realize bounded choices or declarative
    // handoff ownership.
    const configuredContinuationFallbackRequired = Boolean(
      questionSupportGuardEnabled ||
      actorialRealizationGuardEnabled ||
      firstDraftContract?.progression?.complete === true,
    );
    const baseFallbackText = instructionalMetaRepair
      ? deterministicTutorStubConfiguredContinuationFallback({
          uptake: fallbackUptake,
          responseConfiguration: simplifiedRecoveryConfiguration,
          support: null,
          world,
          learnerText,
          turnProgressionContract: firstDraftContract?.progression || null,
          recentTutorTexts,
          variationKey: `${stateRunDebugId(state)}:${tutorTurn}`,
        })
      : closureFallbackSelected
        ? deterministicTutorStubClosureResponse(dialogueClosureFrame, {
            responseConfiguration: simplifiedRecoveryConfiguration,
          })
        : dramaticReleaseGuardEnabled
          ? deterministicTutorStubDramaticReleaseFallback({
              frame: dramaticReleaseFrame,
              support: humanDiscourseFrame?.questionSupport || null,
              uptake: fallbackUptake,
              responseConfiguration: simplifiedRecoveryConfiguration,
              variationKey: `${stateRunDebugId(state)}:${tutorTurn}`,
              avoidQuestion: humanDiscourseFrame?.conversationalCompletion?.sourceTutorQuestion || '',
              turnProgressionContract: firstDraftContract?.progression || null,
              sourceAccessibilityContract: firstDraftContract?.evidence?.source_accessibility || null,
              world,
            })
          : configuredContinuationFallbackRequired
            ? deterministicTutorStubConfiguredContinuationFallback({
                uptake: fallbackUptake,
                responseConfiguration: simplifiedRecoveryConfiguration,
                support: humanDiscourseFrame?.questionSupport || null,
                world,
                learnerText,
                turnProgressionContract: firstDraftContract?.progression || null,
                recentTutorTexts,
                variationKey: `${stateRunDebugId(state)}:${tutorTurn}`,
              })
            : scaffoldGuardEnabled
              ? deterministicGenerousInferenceFallback(fallbackContext)
              : deterministicTutorStubContextualFallback(fallbackContext);
    const fallbackText =
      dramaticReleaseGuardEnabled || instructionalMetaRepair
        ? baseFallbackText
        : ensureFallbackComposition(baseFallbackText, fallbackUptake);
    const fallbackClosureAudit = closureGuardEnabled
      ? auditTutorStubDialogueClosureResponse({ text: fallbackText, frame: dialogueClosureFrame })
      : audits.closureAudit;
    const fallbackQuestionSupportAudit = questionSupportGuardEnabled
      ? auditTutorStubQuestionSupportResponse({
          text: fallbackText,
          support: humanDiscourseFrame.questionSupport,
        })
      : audits.questionSupportAudit;
    const fallback = {
      text: fallbackText,
      provider: resolved.provider,
      model: resolved.model,
      latencyMs: response.latencyMs || 0,
      usage: response.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0 },
      effort: response.effort || response.reasoningEffort || cliEffort || null,
      reasoningEffort: response.reasoningEffort || response.effort || cliEffort || null,
      leakAudit: audits.leakAudit,
      scaffoldAudit: audits.scaffoldAudit,
      questionSupportAudit: fallbackQuestionSupportAudit,
      dramaticReleaseAudit: audits.dramaticReleaseAudit,
      actorialRealizationAudit: audits.actorialRealizationAudit,
      responseCompositionAudit: audits.responseCompositionAudit,
      repetitionAudit: audits.repetitionAudit,
      closureAudit: fallbackClosureAudit,
      repaired: true,
      deterministicFallback: true,
      deterministicClosure: closureFallbackSelected,
      tokenUsageAvailable: response.tokenUsageAvailable,
      promptSnapshot: response.promptSnapshot || null,
    };
    if (canStreamTutor) {
      fallback.guardedStreamReplay = true;
    }
    const fallbackAttempt = attempts.length;
    const priorAttempt = attempts.at(-1);
    const fallbackDraftAudits = auditTutorDraft(fallback, {
      role: `${roleBase}_fallback`,
      attempt: fallbackAttempt,
      auditConfiguration: simplifiedRecoveryConfiguration,
    });
    const fallbackAudits = withTutorDeliveryDecision(fallbackDraftAudits, {
      allowActorialAdvisory: tutorStubActorialPerformanceMayBeAdvisory(
        fallbackDraftAudits.actorialRealizationAudit,
        fallbackDraftAudits.responseConfigurationAudit,
      ),
      advisoryReason:
        'the deterministic fallback is the terminal safety text — known conversational-integrity, dramatic-form, and optional actorial-realization findings on it are recorded as advisories instead of killing the dialogue; evidence, clue-transaction and closure boundaries remain hard',
      role: `${roleBase}_fallback`,
      attempt: fallbackAttempt,
      terminalFallback: true,
    });
    attachTutorDraftAudits(fallback, fallbackAudits);
    const fallbackRepairSpans = exactTutorRepairSpans(priorAttempt.candidate.text, fallbackText);
    attempts.push(
      tutorGuardAttemptEnvelope({
        kind: 'deterministic_fallback',
        attempt: fallbackAttempt,
        response: fallback,
        audits: fallbackAudits,
        repairedSpans: fallbackRepairSpans,
      }),
    );
    repairsApplied.push({
      kind: 'deterministic_fallback',
      fromAttempt: priorAttempt.attempt,
      toAttempt: fallbackAttempt,
      triggeredBy: tutorStubGuardIssueRows(audits),
      guardedSpans: priorAttempt.guardedSpans,
      repairedSpans: fallbackRepairSpans,
    });
    if (!fallbackAudits.deliveryOk) {
      const rejectedIssues = tutorStubGuardIssueRows(fallbackAudits);
      const exhaustedAccounting = buildTutorGuardAccounting({
        response: fallback,
        state,
        tutorTurn,
        guards,
        attempts,
        repairsApplied,
        finalSource: 'rejected_deterministic_fallback',
        finalAudits: fallbackAudits,
        outcome: 'guard_exhausted_without_public_delivery',
      });
      appendTraceEvent(trace, {
        type: 'tutor_response_fallback_rejected',
        role: roleBase,
        turn: tutorTurn,
        issues: rejectedIssues,
        text: fallbackText,
      });
      appendTraceEvent(trace, {
        type: 'tutor_response_guard_exhausted',
        role: roleBase,
        turn: tutorTurn,
        accounting: exhaustedAccounting,
        publicDelivery: null,
      });
      const terminalFailure = {
        schema: 'machinespirits.tutor-stub.terminal-fallback-failure.v1',
        turn: tutorTurn,
        attemptCount: attempts.length,
        hardIssues: fallbackAudits.deliveryDecision?.hardIssues || [],
        rejectedFallbackText: fallbackText,
        tracePath: trace?.filePath || null,
      };
      const error = new Error(
        tutorStubTerminalFallbackFailureMessage(fallbackAudits.deliveryDecision, {
          candidateText: fallbackText,
          attemptCount: attempts.length,
          tracePath: trace?.filePath || null,
        }),
      );
      error.code = 'TUTOR_FALLBACK_AUDIT_FAILED';
      error.tutorGuardAccounting = exhaustedAccounting;
      error.tutorFallbackFailure = terminalFailure;
      throw error;
    }
    appendTraceEvent(trace, {
      type: 'tutor_response_fallback',
      role: roleBase,
      turn: tutorTurn,
      leaks: audits.leakAudit.leaks,
      scaffoldIssues: audits.scaffoldAudit.issues,
      questionSupportIssues: audits.questionSupportAudit.issues,
      dramaticReleaseIssues: audits.dramaticReleaseAudit.issues,
      actorialRealizationIssues: audits.actorialRealizationAudit.issues,
      responseCompositionIssues: audits.responseCompositionAudit.issues,
      liveTurnProgressionIssues: audits.liveTurnProgressionAudit.issues,
      liveSourceActionAlignmentIssues: audits.liveSourceActionAlignmentAudit.issues,
      repetitionIssues: audits.repetitionAudit.issues,
      closureIssues: audits.closureAudit.issues,
      text: fallbackText,
    });
    return attachTutorGuardAccounting({
      response: fallback,
      state,
      trace,
      tutorTurn,
      role: roleBase,
      guards,
      attempts,
      repairsApplied,
      finalSource: 'deterministic_fallback',
      finalAudits: fallbackAudits,
      outcome: 'guarded_deterministic_fallback',
    });
  } catch (err) {
    appendTraceEvent(trace, {
      type: err?.name === 'AbortError' ? 'model_call_aborted' : 'model_call_error',
      role: roleBase,
      turn: tutorTurn,
      provider: resolved.provider,
      model: resolved.model,
      error: err.message,
      ...(err?.tutorFallbackFailure ? { terminalFailure: err.tutorFallbackFailure } : {}),
    });
    throw err;
  }
}

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
  const raw = await callPromptModel({
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
  return {
    ...raw,
    text: cleanAutomatedLearnerReply(raw.text),
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

async function runPassthroughTurn(learnerText, state, runtimeOptions = {}) {
  assertTutorStubTurnAttemptCurrent(runtimeOptions);
  const tutorTurn = state.turns.length + 1;
  const turnId = turnDebugId(state, tutorTurn);
  const learnerInput = runtimeOptions.learnerInput ? jsonClone(runtimeOptions.learnerInput) : null;
  const learnerResponseProvenance = jsonClone(
    learnerInput?.provenance || runtimeOptions.learnerResponseProvenance || createTutorStubLearnerResponseProvenance(),
  );
  const response = await callTutor({
    learnerText,
    history: state.history,
    state,
    systemPrompt: state.systemPrompt,
    resolved: state.resolved,
    temperature: state.temperature,
    maxTokens: state.maxTokens,
    historyTurns: state.historyTurns,
    world: null,
    dag: false,
    classification: null,
    tutorLearnerDagModel: null,
    registerSelection: null,
    humanDiscourseFrame: null,
    dialogueClosureFrame: null,
    trace: state.trace,
    stream: state.stream,
    cliEffort: state.cliEffort,
    multipleChoice: false,
    roleBase: 'tutor_stub_passthrough',
    learnerMessages: learnerInput?.messages || null,
    deferStreamOutput: Boolean(runtimeOptions.isCurrent),
    passthrough: true,
    signal: runtimeOptions.signal || null,
  });
  response.tutorRef = state.tuning?.activeRef || state.tutorInstance?.ref || null;
  assertTutorStubTurnAttemptCurrent(runtimeOptions);
  const turnTiming = recordTutorStubTurnTiming({
    response,
    state,
    tutorTurn,
    timingContext: runtimeOptions.turnTiming,
  });

  // Observed audits, if asked for. They run here rather than inside `callTutor`
  // for a reason: by this point the draft is already the delivered line, so
  // there is no code path by which a result could send it back. The audits are
  // read-only witnesses to a turn that has already happened.
  //
  // Both are computed on exactly the inputs the guarded arm gives them — the
  // world, the turn index, the draft, the learner message, and the replayed
  // public assistant messages — and `recentTutorTexts` is read *before* this
  // turn is pushed onto the history, so the tutor is never compared with
  // itself.
  const observedAuditsRequested = Boolean(state.passthrough?.observedAudits);
  const observedLeakAudit =
    observedAuditsRequested && state.world
      ? auditTutorResponseLeak({
          text: response.text,
          world: state.world,
          tutorTurn,
          learnerText,
          state,
        })
      : null;
  const observedRepetitionAudit = observedAuditsRequested
    ? auditTutorStubRepetitionResponse({
        text: response.text,
        recentTutorTexts: tutorMessageContext(state, state.history)
          .messages.filter((message) => message.role === 'assistant')
          .map((message) => message.content),
      })
    : null;
  const observedAudits = observedAuditsRequested
    ? buildTutorStubObservedAudits({
        leakAudit: observedLeakAudit,
        repetitionAudit: observedRepetitionAudit,
        response,
      })
    : null;

  state.history.push({ role: 'user', content: learnerText });
  state.history.push({ role: 'assistant', content: response.text });
  const turnRecord = {
    turnId,
    turn: tutorTurn,
    tutorRef: response.tutorRef,
    learner: learnerText,
    learnerResponseProvenance,
    ...(learnerInput
      ? {
          learnerInput,
          learnerMessages: learnerInput.messages,
        }
      : {}),
    passthrough: true,
    observedAudits,
    tutorLeakAudit: observedLeakAudit,
    tutorRepetitionAudit: observedRepetitionAudit,
    // Named and left null on purpose. Each of these scores a draft against a
    // per-turn contract the bare arm never builds, so an absent value here
    // means "no referent", not "passed".
    tutorQuestionSupportAudit: null,
    tutorDramaticReleaseAudit: null,
    tutorHumanScaffoldAudit: null,
    tutorDialogueClosureAudit: null,
    tutorLiveSourceActionAlignmentAudit: null,
    tutorResponseRepaired: false,
    tutorDeterministicFallback: false,
    classification: null,
    tutorLearnerDagModel: null,
    registerSelection: null,
    responseConfiguration: null,
    responseComposition: null,
    tutor: response.text,
    prompts: {
      tutor: response.promptSnapshot || null,
    },
    provider: response.provider,
    model: response.model,
    latencyMs: response.latencyMs,
    usage: response.usage,
    tokenUsageAvailable: response.tokenUsageAvailable,
    turnTiming,
  };
  state.turns.push(turnRecord);
  appendTraceEvent(state.trace, {
    type: 'learner_response_provenance_recorded',
    turnId,
    turn: tutorTurn,
    provenance: learnerResponseProvenance,
  });
  appendTraceEvent(state.trace, {
    type: 'passthrough_turn_complete',
    turnId,
    turn: tutorTurn,
    modelCallCount: 1,
    requestSurface: ['system_setup', 'full_public_history', 'latest_learner_message'],
    observedAudits: Boolean(observedAudits),
  });
  if (observedAudits) {
    appendTraceEvent(state.trace, {
      type: 'passthrough_observed_audits',
      turnId,
      turn: tutorTurn,
      ...observedAudits,
    });
  }
  appendTraceEvent(state.trace, {
    type: 'turn_complete',
    turnId,
    turn: tutorTurn,
    turnRecord,
  });
  appendTutorStubTurnFailureTraceRecords(state);
  return {
    ...response,
    passthrough: true,
    observedAudits,
    dagSnapshot: null,
    registerSelection: null,
    releasePacing: null,
  };
}

async function runOneTurn(
  inputText,
  state,
  classification = null,
  tutorLearnerDag = null,
  registerSelection = null,
  previousRegisterEfficacy = null,
  precomputedResponse = null,
  runtimeOptions = {},
) {
  const learnerText = String(inputText || '').trim();
  if (!learnerText) {
    appendTraceEvent(state.trace, {
      type: 'empty_learner_turn_rejected',
      turn: state.turns.length + 1,
    });
    throw new Error('empty learner turn: no tutor response can be generated without learner text');
  }
  if (state.passthrough?.enabled) {
    return runPassthroughTurn(learnerText, state, runtimeOptions);
  }
  const learnerInput = runtimeOptions.learnerInput ? jsonClone(runtimeOptions.learnerInput) : null;
  const learnerResponseProvenance = jsonClone(
    learnerInput?.provenance || runtimeOptions.learnerResponseProvenance || createTutorStubLearnerResponseProvenance(),
  );
  assertTutorStubTurnAttemptCurrent(runtimeOptions);
  const tutorTurn = state.turns.length + 1;
  const turnId = turnDebugId(state, tutorTurn);
  const humanDiscourseFrame =
    buildHumanDiscourseFrame({
      state,
      tutorTurn,
      tutorLearnerDag,
      classification,
      learnerText,
    }) || {};
  const instructionalMetaRepair = humanDiscourseFrame?.discoursePlane?.plane === 'instructional_meta';
  const { tutorDagSnapshot: dagSnapshot, frame: dialogueClosureFrame } = tutorDialogueClosureFrameForTurn({
    state,
    tutorTurn,
    tutorLearnerDag,
  });
  const comprehensionBeforeTutor = tutorStubComprehensionSnapshot(state.comprehension, { turn: tutorTurn });
  const dagFactDropout = tutorLearnerDag?.dagFactDropout || null;
  const directorGuidance = tutorStubDirectorGuidanceEntry(state.directorGuidance, tutorTurn);
  const coachGuidance = precomputedResponse?.deterministicClosure
    ? []
    : tutorCoachGuidanceEntries(state, tutorTurn).map((entry) => ({ ...entry }));
  const stateObservation = buildTutorStubStateObservation({
    turnRecord: {
      turn: tutorTurn,
      learner: learnerText,
      learnerResponseProvenance,
      tutorFeedback: learnerInput?.tutorFeedback || null,
      classification,
      tutorLearnerDagModel: tutorLearnerDag?.model || null,
      tutorLearnerDagUpdate: tutorLearnerDag
        ? {
            preflight: tutorLearnerDag.preflight || null,
            accepted: tutorLearnerDag.accepted || null,
            rejected: tutorLearnerDag.rejected || [],
            extractor: tutorLearnerDag.extractor || null,
            dagFactDropout,
          }
        : null,
      humanDiscourseFrame,
      scaffoldState: humanDiscourseFrame.scaffoldState,
      proofDebt: humanDiscourseFrame.proofDebt,
      warrantPremiseAudit: humanDiscourseFrame.warrantPremiseAudit,
      releasePacing: tutorStubReleasePacingSnapshot(state.releasePacing, state.world),
    },
    previousObservation: state.turns.at(-1)?.stateObservation || null,
    previousTurnRecords: state.turns,
    provenance: {
      prediction_origin: 'after_learner_observation_before_tutor_realization',
      observed_before_tutor_call: true,
    },
  });

  const dynamicalState = state.pointOfAction?.enabled
    ? buildDynamicalSystemState({ state, classification, tutorLearnerDag })
    : null;
  const pointOfAction = state.pointOfAction?.enabled
    ? buildTutorStubPointOfActionTurn({
        arm: state.pointOfAction.arm,
        turn: tutorTurn,
        stagnation: dynamicalState?.state_vector?.stagnation || 0,
        proposedActionFamily:
          registerSelection?.action_family || registerSelection?.response_configuration?.action_family || null,
        previousActionFamilies: state.turns
          .map((turn) => turn?.registerSelection?.action_family || turn?.responseConfiguration?.action_family)
          .filter(Boolean),
        evidenceUse: classification?.turn?.evidence_use || null,
        unresolvedTerms: comprehensionBeforeTutor?.features?.unresolvedTerms || [],
        nearClosure: dynamicalState?.trajectory?.flags?.nearClosure === true,
        closeInquiry: registerSelection?.action_family === 'close_inquiry' || dialogueClosureFrame?.mandatory === true,
        duePremises: instructionalMetaRepair ? [] : currentReleaseRows(state, tutorTurn).map((row) => row.premise),
      })
    : null;
  if (state.pointOfAction) state.pointOfAction.current = pointOfAction;
  if (pointOfAction) {
    appendTraceEvent(state.trace, {
      type: 'point_of_action_assignment',
      turn: tutorTurn,
      turnId,
      pointOfAction,
    });
    registerSelection = applyTutorStubPointOfActionConstraint(registerSelection, pointOfAction);
  }

  if (dagFactDropout?.droppedNow?.length || dagFactDropout?.repairedNow?.length) {
    appendTraceEvent(state.trace, {
      type: 'dag_fact_dropout_update',
      turn: tutorTurn,
      turnId,
      dropout: dagFactDropout,
    });
  }

  const typedAction =
    state.typedActions?.enabled && precomputedResponse?.deterministicClosure
      ? {
          registerSelection,
          decision: null,
          priorOutcome: closePriorTypedAction({ state, learnerText, turn: tutorTurn }),
        }
      : planTypedAction({
          state,
          learnerText,
          stateObservation,
          turn: tutorTurn,
          classification,
          tutorLearnerDag,
          registerSelection,
        });
  registerSelection = typedAction.registerSelection;
  registerSelection = applyTutorStubPointOfActionConstraint(registerSelection, pointOfAction);
  const completionSelection = applyTutorStubConversationalCompletionSelection(
    registerSelection,
    humanDiscourseFrame.conversationalCompletion,
    { newEvidenceAvailable: tutorStubNewEvidenceAvailable(state) },
  );
  registerSelection = completionSelection.selection;
  if (humanDiscourseFrame.conversationalCompletion?.resolved) {
    if (state.register?.enabled && registerSelection) {
      if (state.register.history.at(-1)?.turn === registerSelection.turn) {
        state.register.history[state.register.history.length - 1] = registerSelection;
      }
      state.register.current = registerSelection;
    }
    appendTraceEvent(state.trace, {
      type: 'conversational_completion_resolution',
      turn: tutorTurn,
      turnId,
      completion: humanDiscourseFrame.conversationalCompletion,
      actionFamilyBefore: completionSelection.previousActionFamily,
      actionFamilyAfter:
        registerSelection?.response_configuration?.action_family || registerSelection?.action_family || null,
      actionFamilyChanged: completionSelection.changed,
    });
  }
  const tutorFeedback = learnerInput?.tutorFeedback || null;
  const feedbackTargetTurn = findTutorStubFeedbackTargetTurn({
    feedback: tutorFeedback,
    turns: state.turns,
    opening: {
      turnId: openingDebugId(stateRunDebugId(state)),
      text: state.history.find((message) => message.role === 'assistant')?.content || '',
      provider: state.openingRealization?.provider || null,
      model: state.openingRealization?.model || null,
    },
  });
  const feedbackAdaptationPlan = buildTutorStubFeedbackAdaptationPlan({
    feedback: tutorFeedback,
    targetTurn: feedbackTargetTurn,
    nextSelection: registerSelection,
  });
  assertTutorStubTurnAttemptCurrent(runtimeOptions);
  if (
    precomputedResponse?.speculativeCacheHit &&
    pointOfAction?.assigned_trigger &&
    pointOfAction.arm !== 'standing_book'
  ) {
    appendTraceEvent(state.trace, {
      type: 'mixed_learner_tutor_prefetch_bypassed',
      turn: tutorTurn,
      reason: 'point_of_action_intervention_must_precede_tutor_output_generation',
    });
    precomputedResponse = null;
  }
  if (precomputedResponse?.speculativeCacheHit && typedAction.decision) {
    appendTraceEvent(state.trace, {
      type: 'mixed_learner_tutor_prefetch_bypassed',
      turn: tutorTurn,
      reason: 'typed_action_must_precede_tutor_output_generation',
    });
    precomputedResponse = null;
  }
  if (precomputedResponse?.speculativeCacheHit && feedbackAdaptationPlan) {
    appendTraceEvent(state.trace, {
      type: 'mixed_learner_tutor_prefetch_bypassed',
      turn: tutorTurn,
      reason: 'rated_response_adaptation_contract_must_precede_tutor_output_generation',
    });
    precomputedResponse = null;
  }
  const response =
    precomputedResponse ||
    (await callTutor({
      learnerText,
      history: state.history,
      state,
      systemPrompt: state.systemPrompt,
      resolved: state.resolved,
      temperature: state.temperature,
      maxTokens: state.maxTokens,
      historyTurns: state.historyTurns,
      world: state.world,
      dag: state.dag,
      classification,
      tutorLearnerDagModel: tutorLearnerDag,
      registerSelection,
      humanDiscourseFrame,
      dialogueClosureFrame,
      trace: state.trace,
      stream: state.stream,
      cliEffort: state.cliEffort,
      multipleChoice: state.multipleChoice,
      learnerMessages: learnerInput?.messages || null,
      tutorFeedback,
      feedbackAdaptationPlan,
      deferStreamOutput: Boolean(runtimeOptions.isCurrent),
      signal: runtimeOptions.signal || null,
    }));
  response.tutorRef = state.tuning?.activeRef || state.tutorInstance?.ref || null;
  assertTutorStubTurnAttemptCurrent(runtimeOptions);
  const priorDialogueClosure = state.dialogueClosure;
  state.dialogueClosure = advanceTutorStubDialogueClosure(priorDialogueClosure, {
    frame: dialogueClosureFrame,
    audit: response.closureAudit,
    turn: tutorTurn,
  });
  if (state.dialogueClosure?.phase !== priorDialogueClosure?.phase) {
    appendTraceEvent(state.trace, {
      type: 'dialogue_closure_transition',
      turn: tutorTurn,
      from: priorDialogueClosure?.phase || 'open',
      to: state.dialogueClosure.phase,
      basis: state.dialogueClosure.basis,
      audit: response.closureAudit || null,
    });
  }

  const selectedResponseConfiguration = registerSelection?.response_configuration || registerSelection || null;
  const deliveredResponseConfiguration = response.deliveryResponseConfiguration || selectedResponseConfiguration;
  const recordedFinalDeliveryAudit =
    response.guardAccounting?.finalDelivery?.audits?.responseConfigurationAudit || null;
  const responseConfigurationAudit =
    recordedFinalDeliveryAudit ||
    auditTutorStubResponseConfiguration({
      text: response.text,
      configuration: deliveredResponseConfiguration,
      world: state.world,
      composition: response.responseComposition,
    });
  const selectedResponseConfigurationAudit = response.deliveryResponseConfiguration
    ? auditTutorStubResponseConfiguration({
        text: response.text,
        configuration: selectedResponseConfiguration,
        world: state.world,
        composition: response.responseComposition,
      })
    : responseConfigurationAudit;
  if (responseConfigurationAudit) {
    appendTraceEvent(state.trace, {
      type: 'response_configuration_audit',
      turn: tutorTurn,
      turnId,
      configuration: deliveredResponseConfiguration,
      selectedConfiguration: selectedResponseConfiguration,
      deliveredConfiguration: deliveredResponseConfiguration,
      configurationTransition: response.responseConfigurationTransition || null,
      selectedAudit: selectedResponseConfigurationAudit,
      audit: responseConfigurationAudit,
    });
  }

  const feedbackAdaptationAudit = auditTutorStubFeedbackAdaptation({
    plan: feedbackAdaptationPlan,
    targetTurn: feedbackTargetTurn,
    currentTurn: {
      turn: tutorTurn,
      turnId,
      tutor: response.text,
      responseConfiguration: deliveredResponseConfiguration,
      responseConfigurationAudit,
      responseComposition: response.responseComposition || null,
      responseCompositionAudit: response.responseCompositionAudit || null,
    },
  });

  const comprehensionResponse = applyTutorStubComprehensionResponse(state.comprehension, {
    text: response.text,
    turn: tutorTurn,
    source: 'tutor_turn',
  });
  const comprehensionAfterTutor = comprehensionResponse.snapshot;
  if (comprehensionResponse.explainedTerms.length || comprehensionBeforeTutor.lastRequest?.turn === tutorTurn) {
    appendTraceEvent(state.trace, {
      type: 'comprehension_response',
      turn: tutorTurn,
      explainedTerms: comprehensionResponse.explainedTerms,
      unresolvedTerms: comprehensionAfterTutor?.features?.unresolvedTerms || [],
      comprehensionState: comprehensionAfterTutor,
    });
  }

  const dueReleaseRows = instructionalMetaRepair ? [] : currentReleaseRows(state, tutorTurn);
  const dramaticReleaseFrame = buildTutorStubDramaticReleaseFrame({
    dueEvidence: dueReleaseRows,
    world: state.world,
  });
  const duePremiseIds = dueReleaseRows.map((row) => row?.premise).filter(Boolean);
  const releaseDeliveryAudit =
    response.releaseDeliveryAudit ||
    auditTutorStubReleaseDelivery({
      text: response.text,
      world: state.world,
      premiseIds: duePremiseIds,
    });
  response.releaseDeliveryAudit = releaseDeliveryAudit;
  if (duePremiseIds.length) {
    appendTraceEvent(state.trace, {
      type: 'release_delivery_audit',
      turn: tutorTurn,
      turnId,
      audit: releaseDeliveryAudit,
    });
  }

  const releasePacing = commitTutorStubReleasePacing({
    pacing: state.releasePacing,
    world: state.world,
    turn: tutorTurn,
    deliveredPremises: releaseDeliveryAudit.deliveredPremises,
  });
  if (releasePacing) {
    appendTraceEvent(state.trace, {
      type: 'release_pacing_committed',
      turn: tutorTurn,
      turnId,
      releasedNow: releasePacing.releasedNow,
      notDeliveredNow: releasePacing.notDeliveredNow,
      direction: releasePacing.direction,
      effectiveSpeed: releasePacing.effectiveSpeed,
      nextRelease: releasePacing.nextRelease,
      releasePacing,
    });
  }

  const pointOfActionCompliance = auditTutorStubPointOfActionCompliance({
    turn: pointOfAction,
    tutorText: response.text,
    releasedPremiseCount: releasePacing?.releasedNow?.length || 0,
    realizedActionFamily:
      registerSelection?.action_family || registerSelection?.response_configuration?.action_family || null,
    guardsPassed:
      response.leakAudit?.ok !== false &&
      response.scaffoldAudit?.ok !== false &&
      response.questionSupportAudit?.ok !== false &&
      response.dramaticReleaseAudit?.ok !== false &&
      response.repetitionAudit?.ok !== false &&
      response.closureAudit?.ok !== false &&
      response.guardAccounting?.finalDelivery?.auditOk !== false,
  });
  if (pointOfAction) {
    const completedPointOfAction = { ...pointOfAction, compliance: pointOfActionCompliance };
    state.pointOfAction.current = completedPointOfAction;
    state.pointOfAction.history.push(completedPointOfAction);
    appendTraceEvent(state.trace, {
      type: 'point_of_action_compliance',
      turn: tutorTurn,
      turnId,
      compliance: pointOfActionCompliance,
    });
  }

  const feedbackObservation = buildTutorStubFeedbackObservation({
    feedback: tutorFeedback,
    targetTurn: feedbackTargetTurn,
    learnerTurn: {
      turn: tutorTurn,
      turnId,
      text: learnerText,
      messageCount: learnerInput?.messageCount || learnerInput?.messages?.length || 1,
      messages: learnerInput?.messages || null,
      learnerResponseProvenance,
      classification,
    },
    currentTurn: {
      turn: tutorTurn,
      turnId,
      tutor: response.text,
      responseConfiguration: deliveredResponseConfiguration,
      responseConfigurationAudit,
      responseComposition: response.responseComposition || null,
      responseCompositionAudit: response.responseCompositionAudit || null,
      tutorLeakAudit: response.leakAudit || null,
      tutorHumanScaffoldAudit: response.scaffoldAudit || null,
      tutorQuestionSupportAudit: response.questionSupportAudit || null,
      tutorDramaticReleaseAudit: response.dramaticReleaseAudit || null,
      tutorRepetitionAudit: response.repetitionAudit || null,
      tutorDialogueClosureAudit: response.closureAudit || null,
      tutorResponseRepaired: Boolean(response.repaired),
      tutorDeterministicFallback: Boolean(response.deterministicFallback),
    },
    previousRegisterEfficacy,
    adaptationPlan: feedbackAdaptationPlan,
    adaptationAudit: feedbackAdaptationAudit,
    provenance: {
      runId: stateRunDebugId(state),
      trace: state.trace?.filePath ? path.relative(ROOT, state.trace.filePath) : null,
      worldId: state.world?.id || null,
      learnerProfileId: state.learnerProfileId || null,
      interactionMode: state.interaction?.mode || 'learner',
      learnerResponseAuthorship: learnerResponseProvenance.authorship,
      trainingReuse: jsonClone(state.trainingReuse),
    },
  });

  const turnTiming = recordTutorStubTurnTiming({
    response,
    state,
    tutorTurn,
    classification,
    tutorLearnerDag,
    timingContext: runtimeOptions.turnTiming,
  });

  state.history.push({ role: 'user', content: learnerText });
  state.history.push({ role: 'assistant', content: response.text });
  if (directorGuidance) {
    appendTraceEvent(state.trace, {
      type: 'director_guidance_applied',
      turn: tutorTurn,
      turnId,
      guidance: directorGuidance,
      publicTranscriptChanged: false,
    });
  }
  if (coachGuidance.length && state.coach) {
    const appliedIds = new Set(coachGuidance.map((entry) => entry.id));
    state.coach.pending = state.coach.pending.filter((entry) => !appliedIds.has(entry.id));
    state.coach.history.push({
      turn: tutorTurn,
      turnId,
      guidance: coachGuidance,
      tutor: response.text,
      appliedAt: new Date().toISOString(),
    });
    appendTraceEvent(state.trace, {
      type: 'coach_guidance_applied',
      turn: tutorTurn,
      turnId,
      guidance: coachGuidance,
      publicTranscriptChanged: false,
    });
  }
  const turnRecord = {
    turnId,
    turn: tutorTurn,
    tutorRef: response.tutorRef,
    learner: learnerText,
    learnerResponseProvenance,
    ...(learnerInput
      ? {
          learnerInput,
          learnerMessages: learnerInput.messages,
        }
      : {}),
    directorGuidance,
    coachGuidance,
    stateObservation,
    classification,
    tutorLearnerDagModel: tutorLearnerDag?.model || null,
    learnerAdvance: tutorLearnerDag?.advance || tutorLearnerDag?.model?.learnerAdvance || null,
    tutorLearnerDagUpdate: tutorLearnerDag
      ? {
          preflight: tutorLearnerDag.preflight || null,
          accepted: tutorLearnerDag.accepted || null,
          rejected: tutorLearnerDag.rejected || [],
          extractor: tutorLearnerDag.extractor || null,
          advance: tutorLearnerDag.advance || tutorLearnerDag.model?.learnerAdvance || null,
          dagFactDropout,
        }
      : null,
    dagFactDropout,
    humanDiscourseFrame,
    scaffoldState: humanDiscourseFrame.scaffoldState,
    sideArc: humanDiscourseFrame.sideArc,
    proofDebt: humanDiscourseFrame.proofDebt,
    warrantPremiseAudit: humanDiscourseFrame.warrantPremiseAudit,
    generousInference: humanDiscourseFrame.generousInference,
    conversationalCompletion: humanDiscourseFrame.conversationalCompletion,
    questionSupport: humanDiscourseFrame.questionSupport,
    dramaticRelease: {
      frame: dramaticReleaseFrame,
      audit: response.dramaticReleaseAudit || null,
    },
    releasePacing,
    releaseDeliveryAudit,
    comprehension: {
      beforeTutor: comprehensionBeforeTutor,
      afterTutor: comprehensionAfterTutor,
    },
    dialogueClosure: {
      frame: dialogueClosureFrame,
      audit: response.closureAudit || null,
      lifecycle: state.dialogueClosure,
    },
    closureCheckIn: dialogueClosureFrame.phase === 'final_checkin_response',
    pointOfAction: state.pointOfAction?.current || null,
    registerSelection,
    responseConfiguration: jsonClone(registerSelection?.response_configuration || null),
    deliveredResponseConfiguration: jsonClone(
      response.deliveryResponseConfiguration || registerSelection?.response_configuration || null,
    ),
    responseConfigurationTransition: jsonClone(response.responseConfigurationTransition || null),
    selectedResponseConfigurationAudit,
    responseConfigurationAudit,
    firstDraftContract: jsonClone(response.firstDraftContract || null),
    feedbackAdaptationPlan,
    feedbackAdaptationAudit,
    feedbackObservation,
    responseComposition: {
      frame: jsonClone(response.responseCompositionFrame || null),
      audit: jsonClone(response.responseCompositionAudit || null),
      uptake: response.responseComposition?.uptake || null,
      development: response.responseComposition?.development || null,
      segmentation: response.responseComposition?.method || null,
      atomicAssistantTurn: true,
    },
    previousRegisterEfficacy,
    ...(typedAction.decision || typedAction.priorOutcome
      ? {
          typedActionDecision: jsonClone(typedAction.decision),
          typedActionPriorOutcome: jsonClone(typedAction.priorOutcome),
          scaffoldLifecycle: jsonClone(state.typedActions.scaffoldLifecycle),
          scaffoldLifecycleTransitions: [
            typedAction.priorOutcome?.scaffold_lifecycle_transition,
            typedAction.decision?.scaffold_lifecycle?.transition,
          ]
            .filter(Boolean)
            .map((transition) => jsonClone(transition)),
        }
      : {}),
    tutor: response.text,
    tutorDag: dagSnapshot,
    tutorLeakAudit: response.leakAudit || null,
    tutorHumanScaffoldAudit: response.scaffoldAudit || null,
    tutorQuestionSupportAudit: response.questionSupportAudit || null,
    tutorDramaticReleaseAudit: response.dramaticReleaseAudit || null,
    tutorLiveSourceActionAlignmentAudit: response.liveSourceActionAlignmentAudit || null,
    tutorSourceAccessibility: response.liveSourceActionAlignmentAudit
      ? {
          directAccessible: response.liveSourceActionAlignmentAudit.direct_accessible,
          compensationRequired: response.liveSourceActionAlignmentAudit.compensation_required,
          compensationContractReady: response.liveSourceActionAlignmentAudit.compensation_contract_ready,
          compensationVisible: response.liveSourceActionAlignmentAudit.compensation_visible,
          effectiveMode: response.liveSourceActionAlignmentAudit.effective_mode,
        }
      : null,
    tutorRepetitionAudit: response.repetitionAudit || null,
    tutorDialogueClosureAudit: response.closureAudit || null,
    tutorResponseRepaired: Boolean(response.repaired),
    tutorDeterministicFallback: Boolean(response.deterministicFallback),
    tutorDeterministicClosure: Boolean(response.deterministicClosure),
    prompts: {
      tutor: response.promptSnapshot || null,
    },
    tutorGuardAccounting: response.guardAccounting || null,
    provider: response.provider,
    model: response.model,
    latencyMs: response.latencyMs,
    usage: response.usage,
    tokenUsageAvailable: response.tokenUsageAvailable,
    turnTiming,
  };
  state.turns.push(turnRecord);
  appendTraceEvent(state.trace, {
    type: 'learner_response_provenance_recorded',
    turnId,
    turn: tutorTurn,
    provenance: learnerResponseProvenance,
  });
  if (feedbackObservation) {
    recordTutorStubTuningFeedback(state.tuning, feedbackObservation);
    appendTraceEvent(state.trace, {
      type: 'tutor_feedback_observation',
      turnId,
      turn: tutorTurn,
      observation: feedbackObservation,
      publicTranscriptChanged: false,
    });
  }
  appendTraceEvent(state.trace, {
    type: 'turn_complete',
    turnId,
    turn: tutorTurn,
    turnRecord,
  });
  appendTutorStubTurnFailureTraceRecords(state);
  return {
    ...response,
    dagSnapshot,
    registerSelection: jsonClone(registerSelection || null),
    releasePacing: jsonClone(releasePacing),
  };
}

async function runAnalyzedTutorTurn(
  learnerText,
  state,
  { precomputedRaw = null, signal = null, isCurrent = null, learnerInput = null } = {},
) {
  const startedAtMs = Date.now();
  const analysisStartedAtMs = Date.now();
  const { classification, tutorLearnerDag, registerSelection, previousRegisterEfficacy } = await analyzeLearnerTurn(
    learnerText,
    state,
    { precomputedRaw, signal, isCurrent },
  );
  const analysisCompletedAtMs = Date.now();
  assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
  startInterimAnimation(
    state,
    'calling tutor',
    buildTutorInterimContext({
      learnerText,
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
      learnerText,
      state,
      classification,
      tutorLearnerDag,
      registerSelection,
      previousRegisterEfficacy,
      null,
      {
        signal,
        isCurrent,
        learnerInput,
        turnTiming: {
          startedAtMs,
          analysisStartedAtMs,
          analysisCompletedAtMs,
          tutorStartedAtMs,
          analysisSource: precomputedRaw?.dagPreflight ? 'precomputed' : 'foreground',
          tutorSource: 'foreground',
        },
      },
    );
  } catch (error) {
    error.tutorDiagnosticContext = jsonClone({
      learnerText,
      learnerResponseProvenance: learnerInput?.provenance || null,
      turn: state.turns.length + 1,
      classification,
      tutorLearnerDag,
      registerSelection,
      previousRegisterEfficacy,
      dueReleaseRows: currentReleaseRows(state, state.turns.length + 1),
      releasePacing: tutorStubReleasePacingSnapshot(state.releasePacing, state.world),
    });
    throw error;
  } finally {
    stopInterimAnimation(state);
  }
  assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
  printWithConcurrentTerminal(state, () => {
    if (automaticTechnicalDetailsEnabled(state)) printTutorDagSnapshot(response.dagSnapshot);
    printResponseDetails(response, state);
    printDirectorPreludeBeforeFirstTutor(state, { reason: 'first_generated_tutor_response' });
    printTutorResponse(response, state.stream);
  });
  await printExplanatoryDebugTurn(state, { signal, isCurrent });
  assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
  writeFieldVisualization(state, { reason: 'turn_complete' });
  return response;
}

async function emitTutorOpeningToState(state, { enabled = true, reason = 'start', signal = null } = {}) {
  if (!enabled || state.history.length) return null;
  const openingRealization = await buildTutorOpening(state, { signal });
  const opening = openingRealization.text;
  state.openingRealization = openingRealization;
  state.history.push({ role: 'assistant', content: opening });
  acknowledgeTutorStubOpeningRelease({ pacing: state.releasePacing, world: state.world });
  const turnId = openingDebugId(stateRunDebugId(state));
  appendTraceEvent(state.trace, {
    type: 'tutor_opening',
    turnId,
    reason,
    text: opening,
    realization: openingRealization,
  });
  printOpeningDebugLine(state);
  printDirectorPreludeBeforeFirstTutor(state, { reason });
  console.log(`${C.magenta}tutor >${C.reset} ${opening}\n`);
  return opening;
}

function learnerDagReachedGroundedClosure(state) {
  const model = state.turns.at(-1)?.tutorLearnerDagModel || null;
  return tutorStubLearnerDagGrounded(model);
}

function quarantinedGuardAccounting(error, quarantineAudit) {
  const exhausted = jsonClone(error?.tutorGuardAccounting || null);
  const safeText = TUTOR_STUB_QUARANTINE_CONTINUATION;
  return {
    ...(exhausted || {
      schema: TUTOR_GUARD_ACCOUNTING_SCHEMA,
      guards: {},
      attempts: [],
      repairsApplied: [],
      originalCandidate: null,
    }),
    outcome: 'quarantined_after_recoverable_turn_failure',
    exhaustedFinalDelivery: exhausted?.finalDelivery || null,
    finalDelivery: {
      source: 'mechanical_public_safe_quarantine',
      provider: 'harness',
      model: 'mechanical-quarantine-v1',
      deterministicFallback: false,
      deterministicClosure: false,
      candidate: {
        start: 0,
        end: safeText.length,
        text: safeText,
        offsetEncoding: 'utf16_code_units',
      },
      audits: quarantineAudit,
      auditOk: quarantineAudit.ok,
    },
  };
}

function commitTutorStubQuarantinedTurn({ state, learnerText, learnerInput = null, error, failure, transaction }) {
  const tutorTurn = state.turns.length + 1;
  const turnId = turnDebugId(state, tutorTurn);
  const text = TUTOR_STUB_QUARANTINE_CONTINUATION;
  const mechanicalAudit = auditTutorStubQuarantineContinuation(text);
  const leakAudit =
    state.dag && state.world
      ? auditTutorResponseLeak({ text, world: state.world, tutorTurn, learnerText, state })
      : { ok: true, leaks: [] };
  const quarantineAudit = {
    ...mechanicalAudit,
    leakAudit,
    ok: mechanicalAudit.ok && leakAudit.ok,
  };
  if (!quarantineAudit.ok) {
    const corruption = new Error('Mechanical quarantine continuation failed its public-safety audit');
    corruption.code = 'TUTOR_QUARANTINE_STATE_CORRUPTION';
    corruption.quarantineAudit = quarantineAudit;
    throw corruption;
  }

  const firstQuarantinedTurn = state.diagnosticCollection.firstQuarantinedTurn || tutorTurn;
  state.diagnosticCollection.firstQuarantinedTurn = firstQuarantinedTurn;
  state.diagnosticCollection.quarantinedTurns.push(tutorTurn);
  const accounting = quarantinedGuardAccounting(error, quarantineAudit);
  const lastValidModel = state.turns.at(-1)?.tutorLearnerDagModel || state.learnerDag?.lastModel || null;
  const releasePacing = tutorStubReleasePacingSnapshot(state.releasePacing, state.world);
  const learnerResponseProvenance = jsonClone(learnerInput?.provenance || createTutorStubLearnerResponseProvenance());
  const turnRecord = {
    turnId,
    turn: tutorTurn,
    learner: learnerText,
    learnerResponseProvenance,
    ...(learnerInput
      ? {
          learnerInput: jsonClone(learnerInput),
          learnerMessages: jsonClone(learnerInput.messages || []),
        }
      : {}),
    tutor: text,
    quarantined: true,
    trajectoryContaminated: true,
    contaminationOriginTurn: firstQuarantinedTurn,
    quarantine: {
      schema: 'machinespirits.tutor-stub.quarantined-turn.v1',
      failure,
      error: {
        name: error?.name || 'Error',
        code: error?.code || null,
        message: error?.message || String(error),
      },
      audit: quarantineAudit,
      transaction: {
        rolledBack: true,
        publicHistoryLengthBefore: transaction.history.length,
        completedTurnCountBefore: transaction.turns.length,
        clueReleaseCommitted: false,
        preservedLastValidPublicState: true,
      },
      attempted: jsonClone(error?.tutorDiagnosticContext || null),
    },
    classification: null,
    tutorLearnerDagModel: jsonClone(lastValidModel),
    tutorLearnerDagUpdate: null,
    registerSelection: null,
    responseConfiguration: null,
    responseConfigurationAudit: null,
    responseComposition: null,
    releasePacing,
    releaseDeliveryAudit: {
      schema: 'machinespirits.tutor-stub.release-delivery-audit.v1',
      ok: true,
      deliveredPremises: [],
      missingPremises: [],
      quarantined: true,
    },
    tutorLeakAudit: leakAudit,
    tutorResponseRepaired: false,
    tutorDeterministicFallback: false,
    tutorGuardAccounting: accounting,
    provider: 'harness',
    model: 'mechanical-quarantine-v1',
    latencyMs: 0,
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0 },
    tokenUsageAvailable: true,
  };
  state.history.push({ role: 'user', content: learnerText });
  state.history.push({ role: 'assistant', content: text });
  state.turns.push(turnRecord);
  appendTraceEvent(state.trace, {
    type: 'learner_response_provenance_recorded',
    turn: tutorTurn,
    turnId,
    provenance: learnerResponseProvenance,
  });
  appendTraceEvent(state.trace, {
    type: 'diagnostic_turn_transaction_rolled_back',
    turn: tutorTurn,
    turnId,
    failure,
    clueReleaseCommitted: false,
    publicHistoryLengthRestored: transaction.history.length,
    completedTurnCountRestored: transaction.turns.length,
  });
  appendTraceEvent(state.trace, {
    type: 'tutor_quarantine_continuation',
    turn: tutorTurn,
    turnId,
    text,
    audit: quarantineAudit,
    guardAccounting: accounting,
    publicDelivery: 'mechanical_public_safe_quarantine',
  });
  appendTraceEvent(state.trace, {
    type: 'turn_complete',
    turn: tutorTurn,
    turnId,
    turnRecord,
  });
  appendTutorStubTurnFailureTraceRecords(state);
  return {
    text,
    provider: 'harness',
    model: 'mechanical-quarantine-v1',
    latencyMs: 0,
    usage: turnRecord.usage,
    tokenUsageAvailable: true,
    guardAccounting: accounting,
    quarantined: true,
  };
}

async function runAutomatedLearnerDialogue({
  state,
  firstMessage = '',
  openingEnabled = true,
  autoLearnerResolved,
  autoLearnerProfile,
  autoTurns,
  autoSafetyTurns,
  autoStopOnGrounded,
  cliEffort = null,
  signal = null,
  isCurrent = null,
}) {
  assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
  const autoLearnerSpeakerLabel = learnerProfileSpeakerLabel(automatedLearnerProfileId(autoLearnerProfile));
  appendTraceEvent(state.trace, {
    type: 'auto_learner_run_start',
    model: autoLearnerResolved,
    profile: autoLearnerProfile,
    maxTurns: autoTurns,
    untilGrounded: autoTurns === null,
    safetyTurns: autoSafetyTurns,
    stopOnGrounded: autoStopOnGrounded,
  });
  if (!firstMessage) {
    await emitTutorOpeningToState(state, { enabled: openingEnabled, reason: 'auto_start', signal });
  }

  let nextLearnerText = firstMessage.trim();
  let reason = 'auto_turn_cap';
  for (let i = 0; autoTurns === null || i < autoTurns; i += 1) {
    assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
    if (autoTurns === null && i >= autoSafetyTurns) {
      reason = 'auto_safety_turn_cap';
      break;
    }
    const turnNumber = state.turns.length + 1;
    const turnId = turnDebugId(state, turnNumber);
    let precomputedRaw = null;
    let learnerResponseProvenance = nextLearnerText
      ? createTutorStubLearnerResponseProvenance({
          authorship: 'human',
          origin: 'launch_first_message',
          inputMethod: 'command_line_argument',
          humanInLoop: true,
        })
      : null;
    if (!nextLearnerText) {
      startInterimAnimation(state, 'calling auto learner', { tutorTurn: turnNumber });
      let generated;
      try {
        generated = await generateAutomatedLearnerTurn({
          state,
          resolved: autoLearnerResolved,
          profile: autoLearnerProfile,
          turnNumber,
          stream: { enabled: false, interim: state.interim },
          cliEffort,
          signal,
        });
      } finally {
        stopInterimAnimation(state);
      }
      const enforced = await enforceAutomatedLearnerProfile({
        state,
        resolved: autoLearnerResolved,
        profile: autoLearnerProfile,
        turnNumber,
        generated,
        cliEffort,
        signal,
        isCurrent,
      });
      assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
      generated = enforced.generated;
      precomputedRaw = enforced.precomputedRaw;
      nextLearnerText = generated.text;
      let deterministicFallback = false;
      if (!nextLearnerText) {
        nextLearnerText = deterministicAutomatedLearnerFallback({ state });
        deterministicFallback = true;
        appendTraceEvent(state.trace, {
          type: 'auto_learner_empty_fallback',
          turn: turnNumber,
          text: nextLearnerText,
          provider: generated.provider,
          model: generated.model,
        });
      }
      learnerResponseProvenance = createTutorStubLearnerResponseProvenance({
        authorship: 'ai',
        origin: 'automated_learner',
        inputMethod: 'automated_learner',
        humanInLoop: false,
        modelRef: state.autoLearner?.modelRef || null,
        provider: generated.provider || autoLearnerResolved?.provider || null,
        model: generated.model || autoLearnerResolved?.model || null,
        learnerProfileId: automatedLearnerProfileId(autoLearnerProfile),
        automation: {
          profileRepaired: enforced.repaired,
          profileAdherencePassed: enforced.passed,
          deterministicFallback,
        },
      });
      appendTraceEvent(state.trace, {
        type: 'auto_learner_turn',
        turn: turnNumber,
        text: nextLearnerText,
        provider: generated.provider,
        model: generated.model,
        latencyMs: generated.latencyMs,
        usage: generated.usage,
        profileRepaired: enforced.repaired,
        profileAdherencePassed: enforced.passed,
        learnerResponseProvenance,
      });
      printWithConcurrentTerminal(state, () => {
        printTurnDebugLine(state, turnNumber);
        console.log(`${C.brightBlue}${C.bold}${autoLearnerSpeakerLabel} (auto) >${C.reset} ${nextLearnerText}\n`);
      });
    } else {
      printWithConcurrentTerminal(state, () => {
        printTurnDebugLine(state, turnNumber);
        console.log(`${C.brightBlue}${C.bold}${autoLearnerSpeakerLabel} (auto) >${C.reset} ${nextLearnerText}\n`);
      });
    }

    const receivedAt = new Date().toISOString();
    const learnerInput = {
      schema: 'machinespirits.tutor-stub.compound-learner-turn.v1',
      compoundTurnId: `${turnId}:learner`,
      turn: turnNumber,
      turnId,
      revision: 1,
      messageCount: 1,
      messages: [
        {
          index: 1,
          text: nextLearnerText,
          receivedAt,
          provenance: jsonClone(learnerResponseProvenance),
        },
      ],
      tutorFeedback: null,
      combinedText: nextLearnerText,
      coalescedBeforeTutorReply: false,
      provenance: jsonClone(learnerResponseProvenance),
    };

    const diagnosticCollection = state.loopMode === TUTOR_STUB_DIAGNOSTIC_COLLECTION_MODE;
    const transaction = diagnosticCollection ? snapshotTutorStubDiagnosticTransaction(state) : null;
    if (diagnosticCollection) {
      appendTraceEvent(state.trace, {
        type: 'diagnostic_turn_transaction_started',
        turn: turnNumber,
        publicHistoryLength: transaction.history.length,
        completedTurnCount: transaction.turns.length,
        releasePacing: tutorStubReleasePacingSnapshot(transaction.releasePacing, state.world),
      });
    }
    try {
      await runAnalyzedTutorTurn(nextLearnerText, state, {
        precomputedRaw,
        signal,
        isCurrent,
        learnerInput,
      });
      if (diagnosticCollection) {
        appendTraceEvent(state.trace, {
          type: 'diagnostic_turn_transaction_committed',
          turn: turnNumber,
          publicHistoryLength: state.history.length,
          completedTurnCount: state.turns.length,
        });
      }
    } catch (error) {
      if (!diagnosticCollection) throw error;
      const failure = classifyTutorStubDiagnosticFailure(error);
      if (failure.disposition !== 'quarantine') {
        appendTraceEvent(state.trace, {
          type: 'diagnostic_collection_aborted',
          turn: turnNumber,
          failure,
          error: { name: error?.name || 'Error', code: error?.code || null, message: error.message },
        });
        throw error;
      }
      restoreTutorStubDiagnosticTransaction(state, transaction);
      const quarantine = commitTutorStubQuarantinedTurn({
        state,
        learnerText: nextLearnerText,
        learnerInput,
        error,
        failure,
        transaction,
      });
      printWithConcurrentTerminal(state, () => {
        printResponseDetails(quarantine, state, { suffix: '; quarantined diagnostic turn' });
        printTutorResponse(quarantine, state.stream);
      });
    }
    assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
    nextLearnerText = '';

    if (autoStopOnGrounded && learnerDagReachedGroundedClosure(state)) {
      reason = 'auto_grounded_closure';
      break;
    }
  }
  assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
  appendTraceEvent(state.trace, {
    type: 'auto_learner_run_end',
    reason,
    turns: state.turns.length,
  });
  return { reason, turns: state.turns.length };
}

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

  function sessionRuntimeStateSnapshot() {
    const publicMessages = state.history.map((message) => ({
      role: message.role,
      content: String(message.content || ''),
    }));
    const expectedOpeningMessageCount = state.turns.length * 2 + (state.resumeHandoff ? 2 : 1);
    const opening =
      publicMessages.length === expectedOpeningMessageCount && publicMessages[0]?.role === 'assistant'
        ? jsonClone(publicMessages[0])
        : null;
    return {
      capabilityMode: state.capabilities.mode,
      worldId: state.world?.id || null,
      curriculumModuleId: state.curriculum?.module?.id || null,
      curriculumModuleTitle: state.curriculum?.module?.title || null,
      topic: state.curriculum?.module?.title || state.world?.title || state.topic,
      curriculumProgress:
        curriculumBundle && state.curriculum?.runtime
          ? tutorStubCurriculumPublicProjection(curriculumBundle, state.curriculum.runtime)
          : null,
      interactionMode: state.interaction?.mode || null,
      turnCount: state.turns.length,
      publicMessageCount: state.history.length,
      opening,
      resumeHandoff: state.resumeHandoff ? jsonClone(state.resumeHandoff) : null,
      publicMessages,
      dialogueClosurePhase: state.dialogueClosure?.phase || null,
      learnerProfileId: state.learnerProfileId || null,
      tutorInstanceRef: state.tuning?.activeRef || state.tutorInstance?.id || null,
      committeeEnabled: state.committee?.enabled === true,
      committeeModel: state.committee?.miniModel || null,
    };
  }

  function recordSessionRuntimeEvent(event) {
    appendTraceEvent(state.trace, {
      type: event.traceEvent || 'session_runtime_event',
      sessionRuntimeSchema: event.schema,
      sessionId: event.sessionId,
      sequence: event.sequence,
      runtimeEvent: event.event,
      runtimeStatus: event.status,
      runtimeRevision: event.revision,
      at: event.at,
      details: event.details,
      publicTranscriptChanged: false,
    });
  }

  function rejectUnavailableSessionCommand({ token, reasons, capabilityMode, context }) {
    clearStatusLine();
    console.log(
      `${C.dim}${token} is unavailable in this ${capabilityMode} session${
        reasons.length ? `: ${reasons.join('; ')}` : ''
      }; use /help for the active command surface${C.reset}\n`,
    );
    appendTraceEvent(state.trace, {
      type: state.passthrough?.enabled ? 'passthrough_command_rejected' : 'command_capability_rejected',
      command: token,
      capabilityMode,
      reasons,
      duringTurn: Boolean(context?.duringTurn),
      publicTranscriptChanged: false,
    });
    return true;
  }

  function handleUnknownSessionCommand({ input: commandInput, context }) {
    clearStatusLine();
    console.log(
      `${C.red}unknown command:${C.reset} ${commandInput}${C.dim} · type / to browse or use /help${C.reset}\n`,
    );
    appendTraceEvent(state.trace, {
      type: 'unknown_slash_command',
      command: commandInput,
      duringTurn: Boolean(context?.duringTurn),
    });
    return true;
  }

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

  function currentRememberedSettingsSnapshot() {
    return {
      scenarioId: state.world?.id || null,
      learnerProfileId: state.learnerProfileId || null,
      learnerProfile: state.learnerProfileId ? null : state.learnerProfile || null,
      tutorInstanceRef: state.tutorInstance.id,
      tuningMode: state.tuning.mode,
      tutorModelRef: state.modelRef,
      classifierModelRef: state.classifier?.modelRef || args['classifier-model'],
      learnerRecordModelRef: state.learnerDag?.modelRef || args['learner-record-model'],
      autoLearnerModelRef: state.autoLearner?.modelRef || args['auto-learner-model'],
      allModelsOverrideRef: state.modelRouting?.allRolesOverrideRef || null,
      voiceModel: state.voice?.model || voiceModel,
      voiceName: state.voice?.voice || voiceName,
      cliTheme: cliPresentation.themeId,
      motion: cliPresentation.requestedMotion,
      committeeEnabled: state.committee?.enabled === true,
      lightAdaptationEnabled: state.lightAdaptation?.enabled === true,
      trainingReuseEnabled: state.trainingReuse?.requested === 'on',
      engagementStanceTemperature: state.register?.temperature ?? DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
      dagFactDropoutRate: state.learnerDag?.dropout?.rate ?? DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_RATE,
      releaseSpeed: state.releasePacing?.baseSpeed ?? DEFAULT_TUTOR_STUB_RELEASE_SPEED,
      registerPolicy: state.register?.policy || STUB.registerPolicy,
      registerOverlays: [...(state.register?.overlays || [])],
      registerOverlayThreshold: state.register?.overlayThreshold ?? DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD,
    };
  }

  function persistCurrentInteractiveSettings(reason, overrides = {}) {
    if (!state.rememberedSettings?.writeEnabled) return null;
    try {
      const saved = writeTutorStubLastSettings(state.rememberedSettings.filePath, {
        ...currentRememberedSettingsSnapshot(),
        ...overrides,
      });
      state.rememberedSettings.status = 'saved';
      state.rememberedSettings.savedAt = saved.updatedAt;
      state.rememberedSettings.warning = null;
      appendTraceEvent(state.trace, {
        type: 'interactive_settings_remembered',
        schema: saved.schema,
        reason,
        file: path.relative(ROOT, state.rememberedSettings.filePath),
        savedAt: saved.updatedAt,
        settings: saved,
      });
      return saved;
    } catch (error) {
      state.rememberedSettings.status = 'write_error';
      state.rememberedSettings.warning = error.message;
      appendTraceEvent(state.trace, {
        type: 'interactive_settings_remember_error',
        reason,
        file: path.relative(ROOT, state.rememberedSettings.filePath),
        error: error.message,
      });
      return null;
    }
  }

  function forgetRememberedInteractiveSettings({ source = 'settings' } = {}) {
    const result = clearTutorStubLastSettings(state.rememberedSettings.filePath);
    state.rememberedSettings.enabled = false;
    state.rememberedSettings.writeEnabled = false;
    state.rememberedSettings.status = 'forgotten';
    state.rememberedSettings.savedAt = null;
    appendTraceEvent(state.trace, {
      type: 'interactive_settings_forgotten',
      source,
      file: path.relative(ROOT, state.rememberedSettings.filePath),
      existed: result.existed,
      currentSessionChanged: false,
    });
    return result;
  }

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
  let voiceBridge = null;
  let resolveInteractive = null;
  const interactiveDone = new Promise((resolve) => {
    resolveInteractive = resolve;
  });

  function voiceRuntimeSnapshot() {
    return {
      schema: state.voice.schema,
      enabled: Boolean(voiceBridge && state.voice.enabled),
      model: state.voice.model,
      voice: state.voice.voice,
      transcriptionModel: state.voice.transcriptionModel,
      apiKeyConfigured: Boolean(process.env.OPENAI_API_KEY),
      bridge: voiceBridge?.snapshot() || state.voice.bridge || null,
      lastStartedAt: state.voice.lastStartedAt,
      lastStoppedAt: state.voice.lastStoppedAt,
      deliveryCount: state.voice.deliveries.length,
      interruptions: state.voice.interruptions,
      authority: 'existing_cli_analysis_dag_register_guard_pipeline',
      automaticRealtimeResponses: false,
    };
  }

  function publishAcceptedTutorToVoice({
    text,
    turn = null,
    turnId = null,
    response = null,
    reason = 'accepted_tutor_text',
  } = {}) {
    if (!voiceBridge || !state.voice.enabled || !String(text || '').trim()) return null;
    const selection = response?.registerSelection || null;
    const delivery = voiceBridge.publishTutor({
      text,
      turn,
      turnId,
      register: selection?.engagement_stance || selection?.selected_register || null,
      character:
        selection?.actorial_part_label ||
        selection?.response_configuration?.actorial_part_label ||
        selection?.actorial_part ||
        selection?.response_configuration?.actorial_part ||
        null,
      reason,
    });
    state.voice.deliveries.push({
      deliveryId: delivery.deliveryId,
      turn,
      turnId,
      reason,
      acceptedAt: delivery.acceptedAt,
      text,
    });
    appendTraceEvent(state.trace, {
      type: 'voice_tutor_delivery',
      schema: delivery.schema,
      delivery,
      canonicalTextSource: reason,
      publicTranscriptChanged: false,
    });
    return delivery;
  }

  async function stopVoiceBridge(reason = 'voice_disabled') {
    if (!voiceBridge) return null;
    const bridge = voiceBridge;
    voiceBridge = null;
    state.voice.enabled = false;
    state.voice.lastStoppedAt = new Date().toISOString();
    try {
      const snapshot = await bridge.stop(reason);
      state.voice.bridge = snapshot;
      return snapshot;
    } catch (error) {
      appendTraceEvent(state.trace, {
        type: 'voice_bridge_stop_error',
        reason,
        error: error.message,
        publicTranscriptChanged: false,
      });
      return null;
    }
  }

  async function startVoiceBridge({ open = true, restart = false, source = 'slash' } = {}) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured in this worktree');
    }
    if (restart && voiceBridge) await stopVoiceBridge('voice_configuration_changed');
    if (!voiceBridge) {
      voiceBridge = createTutorStubVoiceBridge({
        apiKey: process.env.OPENAI_API_KEY,
        model: state.voice.model,
        voice: state.voice.voice,
        title: state.world?.title ? `${state.world.title} · Voice` : 'Tutor Stub Voice',
        runId: state.debugRunId,
        onLearnerTranscript: async ({ text, itemId, receivedAt, source: transcriptSource }) => {
          printWithConcurrentTerminal(state, () => {
            clearStatusLine();
            console.log(`${C.brightGreen}${C.bold}learner · voice >${C.reset} ${text}\n`);
          });
          appendTraceEvent(state.trace, {
            type: 'voice_learner_transcript',
            schema: 'machinespirits.tutor-stub.voice-learner-transcript.v1',
            text,
            itemId,
            receivedAt,
            source: transcriptSource,
            whileTutorPending: Boolean(processingTurn),
            compoundTurnPolicy: 'same_as_typed_learner_input',
            publicTranscriptStatus: 'pending_compound_turn',
          });
          const routed = sessionRuntime.step(text, { kind: 'learner', context: { source: 'voice' } });
          return {
            ...routed,
            turn: activeLearnerTurn?.turn || state.turns.length + 1,
          };
        },
        onInterrupt: async ({ reason, receivedAt }) => {
          state.voice.interruptions += 1;
          appendTraceEvent(state.trace, {
            type: 'voice_learner_barge_in',
            schema: 'machinespirits.tutor-stub.voice-interruption.v1',
            reason,
            receivedAt,
            tutorSpeechCancelledImmediately: true,
            modelAttemptCancellation: 'when_the_completed_transcript_fragment_joins_the_compound_turn',
            activeLearnerTurnId: activeLearnerTurn?.id || null,
            publicTranscriptChanged: false,
          });
          return { tutorSpeechCancelled: true, awaitingTranscript: true };
        },
        onSpokenTranscript: async ({ deliveryId, transcript, canonical, matchesCanonical, receivedAt }) => {
          appendTraceEvent(state.trace, {
            type: 'voice_spoken_transcript_audit',
            schema: 'machinespirits.tutor-stub.voice-spoken-transcript-audit.v1',
            deliveryId,
            transcript,
            canonical,
            matchesCanonical,
            receivedAt,
            canonicalTextRemainsAuthoritative: true,
            publicTranscriptChanged: false,
          });
          return { matchesCanonical, canonicalTextRemainsAuthoritative: true };
        },
        onEvent: (event) => {
          appendTraceEvent(state.trace, {
            ...event,
            type: `voice_${String(event.type || 'event').replace(/^voice_/u, '')}`,
            publicTranscriptChanged: false,
          });
        },
      });
      const started = await voiceBridge.start();
      state.voice.enabled = true;
      state.voice.lastStartedAt = new Date().toISOString();
      state.voice.bridge = voiceBridge.snapshot();
      appendTraceEvent(state.trace, {
        type: 'voice_runtime_enabled',
        source,
        voice: voiceRuntimeSnapshot(),
        publicTranscriptChanged: false,
      });
      const latest = latestTutorMessage(state);
      if (latest) {
        const latestTurn = state.turns.at(-1);
        publishAcceptedTutorToVoice({
          text: latest,
          turn: latestTurn?.turn || 0,
          turnId: latestTurn?.turnId || openingDebugId(stateRunDebugId(state)),
          response: latestTurn,
          reason: latestTurn ? 'latest_accepted_tutor_text_on_voice_start' : 'accepted_opening_on_voice_start',
        });
      }
      if (open && process.env.TUTOR_STUB_VOICE_OPEN !== '0') voiceBridge.open();
      return { ...started, opened: Boolean(open && process.env.TUTOR_STUB_VOICE_OPEN !== '0') };
    }
    if (open && process.env.TUTOR_STUB_VOICE_OPEN !== '0') voiceBridge.open();
    return { ...voiceBridge.snapshot(), url: voiceBridge.browserUrl(), opened: Boolean(open) };
  }

  async function handleVoiceCommand(argument = '', { source = 'slash' } = {}) {
    clearStatusLine();
    const [actionRaw = 'on', valueRaw = '', ...rest] = String(argument || '')
      .trim()
      .split(/\s+/u);
    const action = actionRaw.toLowerCase() || 'on';
    const value = [valueRaw, ...rest].filter(Boolean).join(' ');
    try {
      if (action === 'off' || action === 'stop') {
        if (!voiceBridge) {
          console.log(`${C.dim}voice is already off${C.reset}\n`);
          return true;
        }
        await stopVoiceBridge('voice_command_off');
        console.log(`${C.brightCyan}${C.bold}voice >${C.reset} off`);
        console.log(`${C.dim}  the text dialogue remains active in this terminal${C.reset}\n`);
        return true;
      }
      if (action === 'status') {
        const snapshot = voiceRuntimeSnapshot();
        console.log(
          `${C.brightCyan}${C.bold}voice >${C.reset} ${snapshot.enabled ? 'on' : 'off'} · ${snapshot.model} · ${snapshot.voice}`,
        );
        console.log(
          `${C.dim}  ${snapshot.apiKeyConfigured ? 'API key available server-side' : 'OPENAI_API_KEY missing'} · Realtime cannot answer independently · ${snapshot.deliveryCount} accepted tutor deliveries · ${snapshot.interruptions} interruptions${C.reset}`,
        );
        if (snapshot.bridge?.url) console.log(`${C.dim}  ${snapshot.bridge.url}${C.reset}`);
        console.log();
        return true;
      }
      if (action === 'model') {
        if (!value) {
          console.log(`${C.brightCyan}${C.bold}voice models >${C.reset} ${TUTOR_STUB_VOICE_MODELS.join(' · ')}`);
          console.log(
            `${C.dim}  current: ${state.voice.model}; changing it restarts an active voice session${C.reset}\n`,
          );
          return true;
        }
        const previous = state.voice.model;
        state.voice.model = normalizeTutorStubVoiceModel(value);
        const remembered = persistCurrentInteractiveSettings('realtime_voice_model_changed');
        if (voiceBridge) await startVoiceBridge({ open: true, restart: true, source: 'voice_model_changed' });
        console.log(`${C.brightCyan}${C.bold}voice model >${C.reset} ${previous} → ${state.voice.model}`);
        console.log(
          `${C.dim}  separate from the four text-model roles${remembered ? '; remembered for next time' : ''}${C.reset}\n`,
        );
        return true;
      }
      if (action === 'speaker' || action === 'name') {
        if (!value) {
          console.log(`${C.brightCyan}${C.bold}voice speaker >${C.reset} ${state.voice.voice}\n`);
          return true;
        }
        const previous = state.voice.voice;
        state.voice.voice = normalizeTutorStubVoiceName(value);
        const remembered = persistCurrentInteractiveSettings('realtime_voice_name_changed');
        if (voiceBridge) await startVoiceBridge({ open: true, restart: true, source: 'voice_name_changed' });
        console.log(`${C.brightCyan}${C.bold}voice speaker >${C.reset} ${previous} → ${state.voice.voice}`);
        console.log(
          `${C.dim}  ${remembered ? 'remembered for next time' : 'applies to the next voice session'}${C.reset}\n`,
        );
        return true;
      }
      if (!['on', 'open', 'start'].includes(action)) {
        throw new Error(
          'use /voice, /voice open, /voice status, /voice off, /voice model <model>, or /voice speaker <name>',
        );
      }
      if (activeAutoRun)
        throw new Error('automation is running; use /reset or wait for it to finish before opening learner voice');
      if (state.interaction?.mode !== 'learner') setInteractionMode('learner', { announce: false });
      const started = await startVoiceBridge({ open: true, source });
      console.log(
        `${C.brightCyan}${C.bold}voice >${C.reset} ${voiceBridge ? 'ready' : 'off'} · ${state.voice.model} · ${state.voice.voice}`,
      );
      console.log(`${C.dim}  ${started.url}${C.reset}`);
      console.log(
        `${C.dim}  microphone speech joins the normal learner turn; only accepted tutor text is spoken; browser ${started.opened ? 'opened' : 'opening is disabled by TUTOR_STUB_VOICE_OPEN=0'}${C.reset}\n`,
      );
      return true;
    } catch (error) {
      console.log(`${C.red}voice error:${C.reset} ${error.message}\n`);
      appendTraceEvent(state.trace, {
        type: 'voice_command_error',
        action,
        value: value || null,
        error: error.message,
        publicTranscriptChanged: false,
      });
      return true;
    }
  }

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

  function applyTutorModelSelection(
    modelRef,
    { source = 'settings', usedDefault = false, deferEffects = false, preserveAllOverride = false } = {},
  ) {
    const selection = resolveTutorModelSelection(modelRef);
    const previousRef = state.modelRef;
    const previousResolved = state.resolved;
    state.modelRef = selection.modelRef;
    state.resolved = selection.resolved;
    state.temperature = effectiveTemperatureForModel(selection.resolved, state.requestedTemperature);
    args.model = selection.modelRef;
    visibleModel = visibleResolvedModel(selection.resolved, selection.providerConfig);
    const changed = previousRef !== selection.modelRef || previousResolved.model !== selection.resolved.model;
    if (changed && !preserveAllOverride) state.modelRouting.allRolesOverrideRef = null;
    const contextReplayRecorded = Boolean(changed && source !== 'initial_settings' && state.history.length > 0);
    if (contextReplayRecorded) {
      state.tutorContext = {
        ...state.tutorContext,
        modelRef: selection.modelRef,
      };
    }
    const invalidated = changed && !deferEffects ? resetMixedLearnerSuggestion('tutor_model_changed') : null;
    const remembered = changed && !deferEffects ? persistCurrentInteractiveSettings('tutor_model_changed') : null;
    appendTraceEvent(state.trace, {
      type: source === 'initial_settings' ? 'mixed_learner_initial_tutor_model_selected' : 'tutor_model_changed',
      schema: 'machinespirits.tutor-stub.tutor-model-selection.v1',
      source,
      previousRef,
      modelRef: selection.modelRef,
      provider: selection.resolved.provider,
      model: selection.resolved.model,
      cli: isCliProvider(selection.resolved.provider),
      usedDefault,
      changed,
      rememberedAt: remembered?.updatedAt || null,
      effectiveTurn: state.turns.length + 1,
      contextReplay: contextReplayRecorded
        ? {
            schema: 'machinespirits.tutor-stub.tutor-context-replay.v2',
            historyMode: state.tutorContext.historyMode,
            publicMessageCount: tutorStubPublicMessagesForSpeaker(state.history, { speaker: 'tutor' }).length,
            includesRoles: ['user', 'assistant'],
            persistence: 'every_subsequent_tutor_call_in_this_dialogue',
            alreadyActive: true,
          }
        : null,
      cacheRefresh: invalidated
        ? {
            priorStateCleared: Boolean(invalidated.hadState),
            analysisDiscarded: Boolean(invalidated.discardedAnalysis),
            tutorResponseDiscarded: Boolean(invalidated.discardedTutorResponse),
          }
        : null,
    });
    return { ...selection, previousRef, changed, invalidated };
  }

  const liveModelRoleDefinitions = {
    tutor: {
      label: 'Tutor voice',
      setting: 'tutor',
      defaultRef: STUB.model,
    },
    classifier: {
      label: 'Learner interpretation',
      setting: 'classifier',
      defaultRef: STUB.classifierModel,
    },
    reasoning: {
      label: 'Learner reasoning tracker',
      setting: 'reasoning',
      defaultRef: STUB.learnerRecordModel,
    },
    learner: {
      label: 'Learner voice',
      setting: 'learner',
      defaultRef: STUB.autoLearnerModel,
    },
  };

  function liveModelRoleRef(role) {
    if (role === 'tutor') return state.modelRef;
    if (role === 'classifier') return state.classifier?.modelRef || args['classifier-model'];
    if (role === 'reasoning') return state.learnerDag?.modelRef || args['learner-record-model'];
    if (role === 'learner') return state.autoLearner?.modelRef || args['auto-learner-model'];
    throw new Error(`unknown model role: ${role}`);
  }

  function liveModelRoleSnapshot(role) {
    const modelRef = liveModelRoleRef(role);
    const resolvedRole =
      role === 'tutor'
        ? state.resolved
        : role === 'classifier'
          ? state.classifier?.resolved || resolveModel(modelRef)
          : role === 'reasoning'
            ? state.learnerDag?.resolved || resolveModel(modelRef)
            : state.autoLearner?.resolved || resolveModel(modelRef);
    const providerConfigRole = getProviderConfig(resolvedRole.provider);
    return {
      role,
      label: liveModelRoleDefinitions[role].label,
      modelRef,
      resolved: visibleResolvedModel(resolvedRole, providerConfigRole),
      active:
        role === 'tutor' ||
        (role === 'classifier' && state.classifier?.enabled && !state.classifier?.combined) ||
        (role === 'reasoning' && state.learnerDag?.enabled) ||
        (role === 'learner' && learnerSuggestionEnabled),
      combinedOwner: role === 'reasoning' && Boolean(state.classifier?.enabled && state.classifier?.combined),
    };
  }

  function refreshVisibleClassifierConfig() {
    visibleClassifierConfig = classifierEnabled
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
  }

  function applyRoleModelSelection(
    role,
    modelRef,
    { source = 'live_settings', deferEffects = false, preserveAllOverride = false } = {},
  ) {
    if (role === 'tutor') {
      return applyTutorModelSelection(modelRef, {
        source,
        deferEffects,
        preserveAllOverride,
      });
    }
    const selection = resolveTutorModelSelection(modelRef);
    const previousRef = liveModelRoleRef(role);
    const changed = previousRef !== selection.modelRef;
    if (role === 'classifier') {
      args['classifier-model'] = selection.modelRef;
      state.classifier.modelRef = selection.modelRef;
      state.classifier.resolved = selection.resolved;
      classifierResolved = selection.resolved;
      classifierProviderConfig = selection.providerConfig;
      visibleClassifierModel = visibleResolvedModel(selection.resolved, selection.providerConfig);
    } else if (role === 'reasoning') {
      args['learner-record-model'] = selection.modelRef;
      state.learnerDag.modelRef = selection.modelRef;
      state.learnerDag.resolved = selection.resolved;
      learnerRecordResolved = selection.resolved;
      learnerRecordProviderConfig = selection.providerConfig;
      visibleLearnerRecordModel = visibleResolvedModel(selection.resolved, selection.providerConfig);
    } else if (role === 'learner') {
      args['auto-learner-model'] = selection.modelRef;
      state.autoLearner = {
        modelRef: selection.modelRef,
        resolved: selection.resolved,
        providerConfig: selection.providerConfig,
      };
      mixedLearner.resolved = selection.resolved;
      autoLearnerResolved = selection.resolved;
      autoLearnerProviderConfig = selection.providerConfig;
      visibleAutoLearnerModel = visibleResolvedModel(selection.resolved, selection.providerConfig);
    } else {
      throw new Error(`unknown model role: ${role}`);
    }
    refreshVisibleClassifierConfig();
    if (changed && !preserveAllOverride) state.modelRouting.allRolesOverrideRef = null;
    const invalidated = changed && !deferEffects ? resetMixedLearnerSuggestion(`${role}_model_changed`) : null;
    const remembered = changed && !deferEffects ? persistCurrentInteractiveSettings(`${role}_model_changed`) : null;
    appendTraceEvent(state.trace, {
      type: 'role_model_changed',
      schema: 'machinespirits.tutor-stub.role-model-selection.v1',
      source,
      role,
      previousRef,
      modelRef: selection.modelRef,
      provider: selection.resolved.provider,
      model: selection.resolved.model,
      changed,
      effectiveTurn: state.turns.length + 1,
      rememberedAt: remembered?.updatedAt || null,
      cacheRefresh: invalidated
        ? {
            priorStateCleared: Boolean(invalidated.hadState),
            analysisDiscarded: Boolean(invalidated.discardedAnalysis),
            tutorResponseDiscarded: Boolean(invalidated.discardedTutorResponse),
          }
        : null,
    });
    return { ...selection, previousRef, changed, invalidated };
  }

  function applyAllRoleModelSelection(modelRef, { source = 'live_settings' } = {}) {
    const selection = resolveTutorModelSelection(modelRef);
    const previousOverrideRef = state.modelRouting.allRolesOverrideRef;
    state.modelRouting.allRolesOverrideRef = selection.modelRef;
    const results = Object.keys(liveModelRoleDefinitions).map((role) =>
      applyRoleModelSelection(role, selection.modelRef, {
        source: `${source}_all_roles`,
        deferEffects: true,
        preserveAllOverride: true,
      }),
    );
    const changed = results.some((result) => result.changed) || previousOverrideRef !== selection.modelRef;
    const invalidated = changed ? resetMixedLearnerSuggestion('all_role_models_changed') : null;
    const remembered = changed ? persistCurrentInteractiveSettings('all_role_models_changed') : null;
    appendTraceEvent(state.trace, {
      type: 'all_role_models_changed',
      schema: 'machinespirits.tutor-stub.all-models-override.v1',
      source,
      modelRef: selection.modelRef,
      changed,
      effectiveTurn: state.turns.length + 1,
      roles: Object.keys(liveModelRoleDefinitions),
      rememberedAt: remembered?.updatedAt || null,
      cacheRefresh: invalidated
        ? {
            priorStateCleared: Boolean(invalidated.hadState),
            analysisDiscarded: Boolean(invalidated.discardedAnalysis),
            tutorResponseDiscarded: Boolean(invalidated.discardedTutorResponse),
          }
        : null,
    });
    return { ...selection, changed, results, invalidated };
  }

  async function pickInitialTutorModelWithKeyboard(defaultRef) {
    const entries = tutorModelChoiceEntries(defaultRef);
    if (!entries.length) return null;
    let selectedIndex = Math.max(
      0,
      entries.findIndex((entry) => entry.ref === defaultRef),
    );
    const viewportHeight = Math.min(entries.length, Math.max(4, Math.min(8, Number(output.rows || 24) - 7)));
    let viewportStart = Math.max(0, Math.min(selectedIndex, entries.length - viewportHeight));
    let renderedLineCount = 0;
    const keepVisible = () => {
      if (selectedIndex < viewportStart) viewportStart = selectedIndex;
      if (selectedIndex >= viewportStart + viewportHeight) viewportStart = selectedIndex - viewportHeight + 1;
    };
    const clearMenu = () => {
      if (!renderedLineCount) return;
      moveCursor(output, 0, -renderedLineCount);
      for (let index = 0; index < renderedLineCount; index += 1) {
        cursorTo(output, 0);
        clearLine(output, 0);
        if (index < renderedLineCount - 1) moveCursor(output, 0, 1);
      }
      if (renderedLineCount > 1) moveCursor(output, 0, -(renderedLineCount - 1));
      renderedLineCount = 0;
    };
    const render = () => {
      keepVisible();
      clearMenu();
      const width = Math.max(60, Math.min(Number(output.columns || 100), 140));
      const visible = entries.slice(viewportStart, viewportStart + viewportHeight);
      const selected = entries[selectedIndex];
      const lines = [
        `${C.dim}${viewportStart > 0 ? `  ↑ ${viewportStart} more` : '  '}${C.reset}`,
        ...visible.map((entry, offset) => {
          const active = viewportStart + offset === selectedIndex;
          const plain = `${active ? '›' : ' '} ${entry.ref.padEnd(32)} ${oneLine(entry.model, { max: width - 38 })}`;
          return active ? `${C.cyan}${C.bold}${plain}${C.reset}` : plain;
        }),
        `${C.dim}${viewportStart + viewportHeight < entries.length ? `  ↓ ${entries.length - viewportStart - viewportHeight} more` : '  '}${C.reset}`,
        `${C.brightYellow}${C.bold}  uses >${C.reset} ${selected.provider} → ${selected.model} · ${selected.access}`,
      ];
      for (const line of lines) output.write(`${line}\n`);
      renderedLineCount = lines.length;
    };
    emitKeypressEvents(input);
    const priorListeners = input.listeners('keypress');
    for (const listener of priorListeners) input.removeListener('keypress', listener);
    const wasRaw = Boolean(input.isRaw);
    if (!wasRaw) input.setRawMode(true);
    return new Promise((resolve) => {
      const finish = (selection) => {
        input.removeListener('keypress', onKeypress);
        for (const listener of priorListeners) input.on('keypress', listener);
        if (!wasRaw) input.setRawMode(false);
        clearMenu();
        resolve(selection);
      };
      const move = (delta) => {
        selectedIndex = (selectedIndex + delta + entries.length) % entries.length;
        render();
      };
      const onKeypress = (character, key = {}) => {
        if ((key.ctrl && key.name === 'c') || key.name === 'escape') return finish(null);
        if (key.name === 'up' || character === 'k') return move(-1);
        if (key.name === 'down' || character === 'j') return move(1);
        if (key.name === 'pageup') return move(-viewportHeight);
        if (key.name === 'pagedown') return move(viewportHeight);
        if (key.name === 'home') {
          selectedIndex = 0;
          render();
          return;
        }
        if (key.name === 'end') {
          selectedIndex = entries.length - 1;
          render();
          return;
        }
        if (key.name === 'return' || key.name === 'enter') finish(entries[selectedIndex]);
      };
      input.on('keypress', onKeypress);
      input.resume();
      render();
    });
  }

  function liveSettingsPickerAvailable() {
    return Boolean(input.isTTY && output.isTTY && typeof input.setRawMode === 'function');
  }

  async function pickLiveSettingsActionWithKeyboard(defaultIndex = 0, draft = null) {
    const dropout = tutorStubDagFactDropoutSnapshot(state.learnerDag?.dropout);
    const overlays = new Set(draft?.overlays || state.register?.overlays || []);
    const draftTrainingReuseEnabled = draft?.trainingReuseEnabled ?? state.trainingReuse?.requested === 'on';
    const draftTrainingReuse = resolveTutorStubTrainingReuse({
      requested: draftTrainingReuseEnabled ? 'on' : 'off',
      source: 'settings_panel_preview',
      humanSubjectClass: state.trainingReuse?.declaredHumanSubjectClass,
      humanSubjectClassSource: state.trainingReuse?.humanSubjectClassSource,
      humanInputExpected: state.trainingReuse?.humanInputExpected,
    });
    const entries = [
      {
        id: 'all_models',
        label: 'One model for all roles',
        value: draft?.allModelsOverrideRef || 'off · roles selected separately',
        description: 'Choose one model for tutor voice, learner interpretation, reasoning, and learner voice.',
      },
      {
        id: 'tutor_model',
        label: 'Tutor voice',
        value: draft?.tutorModelRef || state.modelRef,
        description: 'Choose the model that writes the public tutor response.',
      },
      {
        id: 'classifier_model',
        label: 'Learner interpretation',
        value: `${draft?.classifierModelRef || liveModelRoleRef('classifier')}${
          state.classifier?.combined ? ' · combined/inactive' : state.classifier?.enabled ? '' : ' · inactive'
        }`,
        description: state.classifier?.combined
          ? 'Saved separately, but the reasoning tracker currently performs this interpretation in its combined call.'
          : 'Choose the model that classifies what the learner just said.',
      },
      {
        id: 'reasoning_model',
        label: 'Reasoning tracker',
        value: `${draft?.reasoningModelRef || liveModelRoleRef('reasoning')}${
          state.learnerDag?.enabled ? ' · includes interpretation' : ' · inactive'
        }`,
        description: 'Choose the model that maps the learner turn onto the public reasoning record.',
      },
      {
        id: 'learner_model',
        label: 'Learner voice',
        value: `${draft?.learnerModelRef || liveModelRoleRef('learner')}${
          learnerSuggestionEnabled ? '' : ' · inactive'
        }`,
        description: 'Choose the model that writes automated turns and mixed-mode learner suggestions.',
      },
      {
        id: 'theme',
        label: 'Terminal theme',
        value: tutorStubCliThemeOptions().find((option) => option.id === (draft?.theme || cliPresentation.themeId))
          ?.label,
        description: 'Cycle a live color preview. No-color terminals keep the same hierarchy without color.',
      },
      {
        id: 'motion',
        label: 'Terminal motion',
        value: draft?.motion || cliPresentation.requestedMotion,
        description: 'Choose full, subtle, automatic, or still progress motion.',
      },
      {
        id: 'stance_temp',
        label: 'Teaching-style range',
        value: String(draft?.temperature ?? state.register?.temperature ?? registerTemperature),
        description: 'Lower concentrates the strongest teaching style; higher mixes in more alternatives.',
      },
      {
        id: 'dropout',
        label: 'Evidence-memory dropout',
        value: `${draft?.dropoutRate ?? dropout.rate}${state.learnerDag?.enabled ? '' : ' · inactive'}`,
        description:
          'Set the chance that previously understood evidence is temporarily forgotten and can be recovered.',
      },
      {
        id: 'release_speed',
        label: 'Clue release speed',
        value: `${draft?.releaseSpeed ?? state.releasePacing?.baseSpeed ?? DEFAULT_TUTOR_STUB_RELEASE_SPEED}x`,
        description:
          'Set the baseline pace for new clues. The dialogue can still speed up or slow down when the learner asks.',
      },
      {
        id: 'light_adaptation',
        label: 'Difficulty shift',
        value: `${(draft?.lightAdaptationEnabled ?? state.lightAdaptation?.enabled === true) ? 'on' : 'off'}${
          state.register?.enabled ? '' : ' · inactive'
        }`,
        description:
          'After repeated confusion or frustration, make a replayable shift in tutor style and host character.',
      },
      {
        id: 'training_reuse',
        label: 'Training reuse',
        value: `${draftTrainingReuseEnabled ? 'on' : 'off'} · ${tutorStubTrainingReuseLabel(draftTrainingReuse)}`,
        description:
          'Allow owner-authored or mixed dialogue to be reviewed as a future training candidate, or opt it out.',
      },
      {
        id: 'state_overlay',
        label: 'Turn-change override',
        value: overlays.has('state') ? 'on' : 'off',
        description: 'Let a strong change in the latest learner turn alter the teaching style immediately.',
      },
      {
        id: 'field_overlay',
        label: 'Conversation override',
        value: overlays.has('field') ? 'on' : 'off',
        description: 'Let a strong change in the conversation as a whole alter the teaching style.',
      },
      {
        id: 'overlay_threshold',
        label: 'Override sensitivity',
        value: String(
          draft?.overlayThreshold ?? state.register?.overlayThreshold ?? DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD,
        ),
        description: 'Lower values react more often; higher values wait for a clearer change.',
      },
      {
        id: 'forget',
        label: 'Forget saved settings',
        value: draft?.forgetSavedSettings
          ? 'yes · apply on Done'
          : state.rememberedSettings?.enabled
            ? 'no · remembering on'
            : 'no · nothing saved',
        description: 'Choose whether Done should forget saved defaults; Escape leaves them untouched.',
      },
      {
        id: 'done',
        label: 'Done — apply and return',
        value: 'press Enter',
        description: 'Apply every pending change and return to the current learner or coach prompt.',
      },
    ];
    let selectedIndex = Math.max(0, Math.min(Number(defaultIndex) || 0, entries.length - 1));
    let renderedLineCount = 0;
    const clearMenu = () => {
      if (!renderedLineCount) return;
      moveCursor(output, 0, -renderedLineCount);
      for (let index = 0; index < renderedLineCount; index += 1) {
        cursorTo(output, 0);
        clearLine(output, 0);
        if (index < renderedLineCount - 1) moveCursor(output, 0, 1);
      }
      if (renderedLineCount > 1) moveCursor(output, 0, -(renderedLineCount - 1));
      renderedLineCount = 0;
    };
    const render = () => {
      clearMenu();
      const width = Math.max(68, Math.min(Number(output.columns || 100), 140));
      const valueWidth = Math.max(16, Math.min(38, Math.floor(width * 0.34)));
      const selected = entries[selectedIndex];
      const entryLines = entries.flatMap((entry, index) => {
        const active = index === selectedIndex;
        const value = oneLine(entry.value, { max: valueWidth }).padEnd(valueWidth);
        const plain = `${active ? '›' : ' '} ${entry.label.padEnd(21)} ${value}`;
        const row = active
          ? `${entry.id === 'done' ? C.brightGreen : C.cyan}${C.bold}${plain}${C.reset}`
          : entry.id === 'done'
            ? `${C.green}${plain}${C.reset}`
            : `${C.dim}${plain}${C.reset}`;
        return entry.id === 'done'
          ? [`${C.dim}  ${'─'.repeat(Math.max(24, Math.min(width - 4, 64)))}${C.reset}`, row]
          : [row];
      });
      const lines = [
        `${C.brightCyan}${C.bold}Settings · choose what to change${C.reset}`,
        `${C.dim}  ↑/↓ move · Enter edit or toggle · Esc discard changes and return${C.reset}`,
        ...entryLines,
        `${C.brightYellow}${C.bold}  about >${C.reset} ${oneLine(selected.description, {
          max: Math.max(44, width - 11),
        })}`,
      ];
      for (const line of lines) output.write(`${line}\n`);
      renderedLineCount = lines.length;
    };
    emitKeypressEvents(input);
    const priorListeners = input.listeners('keypress');
    for (const listener of priorListeners) input.removeListener('keypress', listener);
    const wasRaw = Boolean(input.isRaw);
    if (!wasRaw) input.setRawMode(true);
    return new Promise((resolve) => {
      const finish = (selection) => {
        input.removeListener('keypress', onKeypress);
        for (const listener of priorListeners) input.on('keypress', listener);
        if (!wasRaw) input.setRawMode(false);
        clearMenu();
        resolve(selection);
      };
      const move = (delta) => {
        selectedIndex = (selectedIndex + delta + entries.length) % entries.length;
        render();
      };
      const onKeypress = (character, key = {}) => {
        if ((key.ctrl && key.name === 'c') || key.name === 'escape') return finish(null);
        if (key.name === 'up' || character === 'k') return move(-1);
        if (key.name === 'down' || character === 'j') return move(1);
        if (key.name === 'home') {
          selectedIndex = 0;
          render();
          return;
        }
        if (key.name === 'end') {
          selectedIndex = entries.length - 1;
          render();
          return;
        }
        if (key.name === 'return' || key.name === 'enter') {
          finish({ ...entries[selectedIndex], index: selectedIndex });
        }
      };
      input.on('keypress', onKeypress);
      input.resume();
      render();
    });
  }

  async function pickLiveNumericSettingWithKeyboard({
    label,
    value,
    min,
    max,
    step,
    coarseStep,
    recommended,
    explanation,
  }) {
    let selected = Number(value);
    let renderedLineCount = 0;
    const precision = Math.max(
      String(step).split('.')[1]?.length || 0,
      String(coarseStep).split('.')[1]?.length || 0,
      2,
    );
    const normalize = (next) => Number(Math.max(min, Math.min(max, next)).toFixed(precision));
    const clearMenu = () => {
      if (!renderedLineCount) return;
      moveCursor(output, 0, -renderedLineCount);
      for (let index = 0; index < renderedLineCount; index += 1) {
        cursorTo(output, 0);
        clearLine(output, 0);
        if (index < renderedLineCount - 1) moveCursor(output, 0, 1);
      }
      if (renderedLineCount > 1) moveCursor(output, 0, -(renderedLineCount - 1));
      renderedLineCount = 0;
    };
    const render = () => {
      clearMenu();
      const width = Math.max(68, Math.min(Number(output.columns || 100), 140));
      const barWidth = Math.max(18, Math.min(36, width - 42));
      const position = Math.round(((selected - min) / Math.max(max - min, Number.EPSILON)) * barWidth);
      const bar = `${'━'.repeat(position)}●${'─'.repeat(Math.max(0, barWidth - position))}`;
      const lines = [
        `${C.brightCyan}${C.bold}${label}${C.reset}`,
        `${C.cyan}${C.bold}  ${bar}  ${selected}${C.reset}`,
        `${C.dim}  range ${min}–${max} · ←/→ ${step} · PgUp/PgDn ${coarseStep} · R recommended ${recommended}${C.reset}`,
        `${C.brightYellow}${C.bold}  effect >${C.reset} ${oneLine(explanation, { max: Math.max(44, width - 12) })}`,
        `${C.dim}  Enter keep · Esc back · saved only when you choose Done${C.reset}`,
      ];
      for (const line of lines) output.write(`${line}\n`);
      renderedLineCount = lines.length;
    };
    emitKeypressEvents(input);
    const priorListeners = input.listeners('keypress');
    for (const listener of priorListeners) input.removeListener('keypress', listener);
    const wasRaw = Boolean(input.isRaw);
    if (!wasRaw) input.setRawMode(true);
    return new Promise((resolve) => {
      const finish = (next) => {
        input.removeListener('keypress', onKeypress);
        for (const listener of priorListeners) input.on('keypress', listener);
        if (!wasRaw) input.setRawMode(false);
        clearMenu();
        resolve(next);
      };
      const adjust = (delta) => {
        selected = normalize(selected + delta);
        render();
      };
      const onKeypress = (character, key = {}) => {
        if ((key.ctrl && key.name === 'c') || key.name === 'escape') return finish(null);
        if (key.name === 'left' || key.name === 'down' || character === 'h' || character === 'j') {
          return adjust(-step);
        }
        if (key.name === 'right' || key.name === 'up' || character === 'l' || character === 'k') {
          return adjust(step);
        }
        if (key.name === 'pageup') return adjust(coarseStep);
        if (key.name === 'pagedown') return adjust(-coarseStep);
        if (String(character || '').toLowerCase() === 'r') {
          selected = normalize(recommended);
          render();
          return;
        }
        if (key.name === 'return' || key.name === 'enter') finish(selected);
      };
      input.on('keypress', onKeypress);
      input.resume();
      render();
    });
  }

  async function pickInitialMixedLearnerProfileWithKeyboard(defaultProfileId) {
    const coreIds = new Set(learnerProfileSuiteIds('core'));
    const entries = learnerProfileIds().map((id) => {
      const contract = learnerProfileContract(id);
      const presentation = learnerProfilePickerPresentation(id);
      return {
        id,
        label: contract?.intent?.shortName || id,
        group: presentation?.group || (coreIds.has(id) ? 'core' : 'stress probe'),
        description: presentation?.description || contract?.behaviorContract?.stableFailure?.description || '',
        voice: presentation?.voice || contract?.publicVoice?.signature || '',
        nearestNeighbor: presentation?.nearestNeighbor || null,
        contrast: presentation?.contrast || null,
      };
    });
    if (!mixedLearner.profileId) {
      entries.unshift({
        id: null,
        label: 'Custom launch profile',
        group: 'custom',
        description: oneLine(mixedLearner.profile, { max: 180 }),
        voice: 'Uses the custom launch prompt without a named public voice contract.',
        nearestNeighbor: null,
        contrast: null,
      });
    }
    let selectedIndex = Math.max(
      0,
      entries.findIndex((entry) => (entry.id || 'custom') === defaultProfileId),
    );
    const viewportHeight = Math.min(
      entries.length,
      Math.max(4, Math.min(8, Math.max(4, Number(output.rows || 24) - 8))),
    );
    let viewportStart = Math.max(0, Math.min(selectedIndex, entries.length - viewportHeight));
    let renderedLineCount = 0;

    const keepSelectionVisible = () => {
      if (selectedIndex < viewportStart) viewportStart = selectedIndex;
      if (selectedIndex >= viewportStart + viewportHeight) {
        viewportStart = selectedIndex - viewportHeight + 1;
      }
    };
    const clearRenderedMenu = () => {
      if (!renderedLineCount) return;
      moveCursor(output, 0, -renderedLineCount);
      for (let index = 0; index < renderedLineCount; index += 1) {
        cursorTo(output, 0);
        clearLine(output, 0);
        if (index < renderedLineCount - 1) moveCursor(output, 0, 1);
      }
      if (renderedLineCount > 1) moveCursor(output, 0, -(renderedLineCount - 1));
      renderedLineCount = 0;
    };
    const renderMenu = () => {
      keepSelectionVisible();
      clearRenderedMenu();
      const width = Math.max(48, Math.min(Number(output.columns || 100), 140));
      const visible = entries.slice(viewportStart, viewportStart + viewportHeight);
      const selectedEntry = entries[selectedIndex];
      const descriptionWidth = Math.max(32, width - 11);
      const lines = [
        `${C.dim}${viewportStart > 0 ? `  ↑ ${viewportStart} more` : '  '}${C.reset}`,
        ...visible.map((entry, visibleIndex) => {
          const absoluteIndex = viewportStart + visibleIndex;
          const selected = absoluteIndex === selectedIndex;
          const id = entry.id || 'custom';
          const plain = `${selected ? '›' : ' '} ${id.padEnd(24)} ${oneLine(entry.label, {
            max: Math.max(12, width - 38),
          })} [${entry.group}]`;
          return selected ? `${C.cyan}${C.bold}${plain}${C.reset}` : plain;
        }),
        `${C.dim}${
          viewportStart + viewportHeight < entries.length
            ? `  ↓ ${entries.length - viewportStart - viewportHeight} more`
            : '  '
        }${C.reset}`,
        `${C.brightYellow}${C.bold}  pattern >${C.reset} ${oneLine(selectedEntry.description, {
          max: descriptionWidth,
        })}`,
        `${C.cyan}${C.bold}  sounds >${C.reset} ${oneLine(selectedEntry.voice, { max: descriptionWidth })}`,
        selectedEntry.nearestNeighbor && selectedEntry.contrast
          ? `${C.dim}  differs > from ${selectedEntry.nearestNeighbor}: ${oneLine(selectedEntry.contrast, {
              max: Math.max(24, width - selectedEntry.nearestNeighbor.length - 20),
            })}${C.reset}`
          : `${C.dim}  differs > baseline for ordinary partial reasoning and repair${C.reset}`,
      ];
      for (const line of lines) output.write(`${line}\n`);
      renderedLineCount = lines.length;
    };

    emitKeypressEvents(input);
    const priorKeypressListeners = input.listeners('keypress');
    for (const listener of priorKeypressListeners) input.removeListener('keypress', listener);
    const wasRaw = Boolean(input.isRaw);
    if (!wasRaw) input.setRawMode(true);

    return new Promise((resolve) => {
      const finish = (selection) => {
        input.removeListener('keypress', onKeypress);
        for (const listener of priorKeypressListeners) input.on('keypress', listener);
        if (!wasRaw) input.setRawMode(false);
        clearRenderedMenu();
        resolve(selection);
      };
      const moveSelection = (delta) => {
        selectedIndex = (selectedIndex + delta + entries.length) % entries.length;
        renderMenu();
      };
      const onKeypress = (character, key = {}) => {
        if ((key.ctrl && key.name === 'c') || key.name === 'escape') {
          finish(null);
          return;
        }
        if (key.name === 'up' || character === 'k') {
          moveSelection(-1);
          return;
        }
        if (key.name === 'down' || character === 'j') {
          moveSelection(1);
          return;
        }
        if (key.name === 'pageup') {
          moveSelection(-viewportHeight);
          return;
        }
        if (key.name === 'pagedown') {
          moveSelection(viewportHeight);
          return;
        }
        if (key.name === 'home') {
          selectedIndex = 0;
          renderMenu();
          return;
        }
        if (key.name === 'end') {
          selectedIndex = entries.length - 1;
          renderMenu();
          return;
        }
        if (key.name === 'return' || key.name === 'enter') finish(entries[selectedIndex]);
      };
      input.on('keypress', onKeypress);
      input.resume();
      renderMenu();
    });
  }

  async function pickLiveTutorRegisterWithKeyboard(defaultRegisterId = 'auto') {
    const definitions = getEngagementStanceDefinitions();
    const palette = humanDirectedRegisterPalette();
    const entries = [
      {
        id: 'auto',
        label: 'Adaptive selection',
        group: 'automatic',
        signature: 'The conversation chooses how the tutor sounds on each turn.',
        contrast: 'Character remains independent: it controls what the tutor does in the scene.',
      },
      ...palette
        .filter((id) => definitions[id]?.simulated_only !== true)
        .map((id) => ({
          id,
          label: displayDiagnosticLabel(id),
          group: definitions[id]?.router_selectable === true ? 'adaptive-core' : 'full-range',
          signature: oneLine(definitions[id]?.public_signature || definitions[id]?.stance_contract, { max: 220 }),
          contrast: oneLine(definitions[id]?.contrast, { max: 220 }),
        })),
    ];
    let selectedIndex = Math.max(
      0,
      entries.findIndex((entry) => entry.id === (defaultRegisterId || 'auto')),
    );
    const viewportHeight = Math.min(entries.length, Math.max(4, Math.min(8, Number(output.rows || 24) - 9)));
    let viewportStart = Math.max(0, Math.min(selectedIndex, entries.length - viewportHeight));
    let renderedLineCount = 0;
    const keepVisible = () => {
      if (selectedIndex < viewportStart) viewportStart = selectedIndex;
      if (selectedIndex >= viewportStart + viewportHeight) viewportStart = selectedIndex - viewportHeight + 1;
    };
    const clearMenu = () => {
      if (!renderedLineCount) return;
      moveCursor(output, 0, -renderedLineCount);
      for (let index = 0; index < renderedLineCount; index += 1) {
        cursorTo(output, 0);
        clearLine(output, 0);
        if (index < renderedLineCount - 1) moveCursor(output, 0, 1);
      }
      if (renderedLineCount > 1) moveCursor(output, 0, -(renderedLineCount - 1));
      renderedLineCount = 0;
    };
    const render = () => {
      keepVisible();
      clearMenu();
      const width = Math.max(60, Math.min(Number(output.columns || 100), 140));
      const visible = entries.slice(viewportStart, viewportStart + viewportHeight);
      const selected = entries[selectedIndex];
      const lines = [
        `${C.dim}${viewportStart > 0 ? `  ↑ ${viewportStart} more` : '  '}${C.reset}`,
        ...visible.map((entry, offset) => {
          const active = viewportStart + offset === selectedIndex;
          const plain = `${active ? '›' : ' '} ${entry.id.padEnd(16)} ${oneLine(entry.label, {
            max: Math.max(12, width - 38),
          })} [${entry.group}]`;
          return active ? `${C.brightMagenta}${C.bold}${plain}${C.reset}` : plain;
        }),
        `${C.dim}${
          viewportStart + viewportHeight < entries.length
            ? `  ↓ ${entries.length - viewportStart - viewportHeight} more`
            : '  '
        }${C.reset}`,
        `${C.brightYellow}${C.bold}  sounds >${C.reset} ${oneLine(selected.signature, {
          max: Math.max(36, width - 13),
        })}`,
        `${C.dim}  differs > ${oneLine(selected.contrast, { max: Math.max(34, width - 13) })}${C.reset}`,
        `${C.dim}  register changes voice; tutor character changes the repeated public action${C.reset}`,
      ];
      for (const line of lines) output.write(`${line}\n`);
      renderedLineCount = lines.length;
    };
    emitKeypressEvents(input);
    const priorListeners = input.listeners('keypress');
    for (const listener of priorListeners) input.removeListener('keypress', listener);
    const wasRaw = Boolean(input.isRaw);
    if (!wasRaw) input.setRawMode(true);
    return new Promise((resolve) => {
      const finish = (selection) => {
        input.removeListener('keypress', onKeypress);
        for (const listener of priorListeners) input.on('keypress', listener);
        if (!wasRaw) input.setRawMode(false);
        clearMenu();
        resolve(selection);
      };
      const move = (delta) => {
        selectedIndex = (selectedIndex + delta + entries.length) % entries.length;
        render();
      };
      const onKeypress = (character, key = {}) => {
        if ((key.ctrl && key.name === 'c') || key.name === 'escape') return finish(null);
        if (key.name === 'up' || character === 'k') return move(-1);
        if (key.name === 'down' || character === 'j') return move(1);
        if (key.name === 'pageup') return move(-viewportHeight);
        if (key.name === 'pagedown') return move(viewportHeight);
        if (key.name === 'home') {
          selectedIndex = 0;
          render();
          return;
        }
        if (key.name === 'end') {
          selectedIndex = entries.length - 1;
          render();
          return;
        }
        if (key.name === 'return' || key.name === 'enter') finish(entries[selectedIndex]);
      };
      input.on('keypress', onKeypress);
      input.resume();
      render();
    });
  }

  async function pickLiveTutorCharacterWithKeyboard(defaultCharacterId = 'auto') {
    const definitions = getActorialPartDefinitions();
    const entries = [
      {
        id: 'auto',
        label: 'Adaptive selection',
        group: 'automatic',
        signature:
          'Return character choice to light adaptation, random performance, or the configured teaching policy.',
        contrast: 'Register remains independent: it controls how that action sounds.',
      },
      ...tutorStubConfigurableActorialPartIds().map((id) => ({
        id,
        label: definitions[id]?.label || displayDiagnosticLabel(id),
        group: 'full-range',
        signature: oneLine(definitions[id]?.public_signature || definitions[id]?.contract, { max: 220 }),
        contrast: oneLine(definitions[id]?.contrast, { max: 220 }),
      })),
    ];
    let selectedIndex = Math.max(
      0,
      entries.findIndex((entry) => entry.id === (defaultCharacterId || 'auto')),
    );
    const viewportHeight = Math.min(entries.length, Math.max(4, Math.min(8, Number(output.rows || 24) - 7)));
    let viewportStart = Math.max(0, Math.min(selectedIndex, entries.length - viewportHeight));
    let renderedLineCount = 0;
    const keepVisible = () => {
      if (selectedIndex < viewportStart) viewportStart = selectedIndex;
      if (selectedIndex >= viewportStart + viewportHeight) viewportStart = selectedIndex - viewportHeight + 1;
    };
    const clearMenu = () => {
      if (!renderedLineCount) return;
      moveCursor(output, 0, -renderedLineCount);
      for (let index = 0; index < renderedLineCount; index += 1) {
        cursorTo(output, 0);
        clearLine(output, 0);
        if (index < renderedLineCount - 1) moveCursor(output, 0, 1);
      }
      if (renderedLineCount > 1) moveCursor(output, 0, -(renderedLineCount - 1));
      renderedLineCount = 0;
    };
    const render = () => {
      keepVisible();
      clearMenu();
      const width = Math.max(60, Math.min(Number(output.columns || 100), 140));
      const visible = entries.slice(viewportStart, viewportStart + viewportHeight);
      const selected = entries[selectedIndex];
      const lines = [
        `${C.dim}${viewportStart > 0 ? `  ↑ ${viewportStart} more` : '  '}${C.reset}`,
        ...visible.map((entry, offset) => {
          const active = viewportStart + offset === selectedIndex;
          const plain = `${active ? '›' : ' '} ${entry.id.padEnd(24)} ${oneLine(entry.label, {
            max: Math.max(12, width - 42),
          })} [${entry.group}]`;
          return active ? `${C.brightMagenta}${C.bold}${plain}${C.reset}` : plain;
        }),
        `${C.dim}${
          viewportStart + viewportHeight < entries.length
            ? `  ↓ ${entries.length - viewportStart - viewportHeight} more`
            : '  '
        }${C.reset}`,
        `${C.brightYellow}${C.bold}  does >${C.reset} ${oneLine(selected.signature, { max: Math.max(36, width - 11) })}`,
        `${C.dim}  differs > ${oneLine(selected.contrast, { max: Math.max(34, width - 13) })}${C.reset}`,
        `${C.dim}  character changes the repeated public action; register changes its voice${C.reset}`,
      ];
      for (const line of lines) output.write(`${line}\n`);
      renderedLineCount = lines.length;
    };
    emitKeypressEvents(input);
    const priorListeners = input.listeners('keypress');
    for (const listener of priorListeners) input.removeListener('keypress', listener);
    const wasRaw = Boolean(input.isRaw);
    if (!wasRaw) input.setRawMode(true);
    return new Promise((resolve) => {
      const finish = (selection) => {
        input.removeListener('keypress', onKeypress);
        for (const listener of priorListeners) input.on('keypress', listener);
        if (!wasRaw) input.setRawMode(false);
        clearMenu();
        resolve(selection);
      };
      const move = (delta) => {
        selectedIndex = (selectedIndex + delta + entries.length) % entries.length;
        render();
      };
      const onKeypress = (character, key = {}) => {
        if ((key.ctrl && key.name === 'c') || key.name === 'escape') return finish(null);
        if (key.name === 'up' || character === 'k') return move(-1);
        if (key.name === 'down' || character === 'j') return move(1);
        if (key.name === 'pageup') return move(-viewportHeight);
        if (key.name === 'pagedown') return move(viewportHeight);
        if (key.name === 'home') {
          selectedIndex = 0;
          render();
          return;
        }
        if (key.name === 'end') {
          selectedIndex = entries.length - 1;
          render();
          return;
        }
        if (key.name === 'return' || key.name === 'enter') finish(entries[selectedIndex]);
      };
      input.on('keypress', onKeypress);
      input.resume();
      render();
    });
  }

  async function pickLiveCharacterTargetWithKeyboard(defaultTarget = 'learner') {
    const learnerCharacter = mixedLearner.enabled
      ? mixedLearner.profileId || 'custom'
      : state.autoLearner?.enabled
        ? state.autoLearner.profileId || 'custom'
        : 'human learner';
    const tutorCharacter = state.register?.enabled
      ? explicitPerformanceDirectiveValue(state, 'character') || 'auto'
      : 'adaptive delivery off';
    const entries = [
      {
        id: 'learner',
        label: 'Learner',
        value: learnerCharacter,
        description: 'Choose the visible learner behavior profile used by mixed drafting.',
      },
      {
        id: 'tutor',
        label: 'Tutor',
        value: tutorCharacter,
        description: 'Choose the in-scene host part used to realize subsequent tutor turns.',
      },
    ];
    let selectedIndex = Math.max(
      0,
      entries.findIndex((entry) => entry.id === defaultTarget),
    );
    let renderedLineCount = 0;
    const clearMenu = () => {
      if (!renderedLineCount) return;
      moveCursor(output, 0, -renderedLineCount);
      for (let index = 0; index < renderedLineCount; index += 1) {
        cursorTo(output, 0);
        clearLine(output, 0);
        if (index < renderedLineCount - 1) moveCursor(output, 0, 1);
      }
      if (renderedLineCount > 1) moveCursor(output, 0, -(renderedLineCount - 1));
      renderedLineCount = 0;
    };
    const render = () => {
      clearMenu();
      const width = Math.max(56, Math.min(Number(output.columns || 100), 140));
      const selected = entries[selectedIndex];
      const lines = [
        `${C.brightCyan}${C.bold}Character · choose learner or tutor${C.reset}`,
        `${C.dim}  ↑/↓ move · Enter choose · Esc return${C.reset}`,
        ...entries.map((entry, index) => {
          const active = index === selectedIndex;
          const plain = `${active ? '›' : ' '} ${entry.label.padEnd(10)} ${oneLine(entry.value, {
            max: Math.max(18, width - 19),
          })}`;
          if (!active) return `${C.dim}${plain}${C.reset}`;
          const color = entry.id === 'learner' ? C.cyan : C.brightMagenta;
          return `${color}${C.bold}${plain}${C.reset}`;
        }),
        `${C.brightYellow}${C.bold}  about >${C.reset} ${oneLine(selected.description, {
          max: Math.max(38, width - 11),
        })}`,
      ];
      for (const line of lines) output.write(`${line}\n`);
      renderedLineCount = lines.length;
    };
    emitKeypressEvents(input);
    const priorListeners = input.listeners('keypress');
    for (const listener of priorListeners) input.removeListener('keypress', listener);
    const wasRaw = Boolean(input.isRaw);
    if (!wasRaw) input.setRawMode(true);
    return new Promise((resolve) => {
      const finish = (selection) => {
        input.removeListener('keypress', onKeypress);
        for (const listener of priorListeners) input.on('keypress', listener);
        if (!wasRaw) input.setRawMode(false);
        clearMenu();
        resolve(selection);
      };
      const move = (delta) => {
        selectedIndex = (selectedIndex + delta + entries.length) % entries.length;
        render();
      };
      const onKeypress = (character, key = {}) => {
        if ((key.ctrl && key.name === 'c') || key.name === 'escape') return finish(null);
        if (key.name === 'up' || character === 'k') return move(-1);
        if (key.name === 'down' || character === 'j') return move(1);
        if (key.name === 'home') {
          selectedIndex = 0;
          render();
          return;
        }
        if (key.name === 'end') {
          selectedIndex = entries.length - 1;
          render();
          return;
        }
        if (key.name === 'return' || key.name === 'enter') finish(entries[selectedIndex]);
      };
      input.on('keypress', onKeypress);
      input.resume();
      render();
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

  function transcriptPayload() {
    return {
      ...visibleModel,
      tutorInstance: {
        id: state.tutorInstance.id,
        title: state.tutorInstance.title,
        activeRef: state.tuning.activeRef,
        rolePromptHash: state.tutorInstance.rolePromptHash,
      },
      tuning: {
        ...tutorStubTuningSnapshot(state.tuning),
        candidates: listTutorStubTuningCandidates(state.tuning),
      },
      modelRouting: {
        allRolesOverrideRef: state.modelRouting?.allRolesOverrideRef || null,
        roles: Object.fromEntries(
          Object.keys(liveModelRoleDefinitions).map((role) => [role, liveModelRoleSnapshot(role)]),
        ),
      },
      voice: voiceRuntimeSnapshot(),
      classifier: classifierEnabled ? visibleClassifierConfig : null,
      tutorLearnerDag: tutorLearnerDagEnabled ? visibleLearnerRecordModel : null,
      dagFactDropout: tutorStubDagFactDropoutSnapshot(state.learnerDag.dropout),
      releasePacing: tutorStubReleasePacingSnapshot(state.releasePacing, state.world),
      openingRealization: jsonClone(state.openingRealization),
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
      randomPerformance: jsonClone(state.randomPerformance),
      lightAdaptation: jsonClone(state.lightAdaptation),
      trainingReuse: jsonClone(state.trainingReuse),
      performanceDirectives: jsonClone(state.performanceDirectives),
      dialogueClosure: state.dialogueClosure,
      comprehension: tutorStubComprehensionSnapshot(state.comprehension, { turn: state.turns.length + 1 }),
      interaction: jsonClone(state.interaction),
      turnFeedback: jsonClone(state.turnFeedback),
      responseDetails: jsonClone(state.responseDetails),
      explanatoryDebug: jsonClone(state.explanatoryDebug),
      coach: jsonClone(state.coach),
      directorGuidance: tutorStubDirectorGuidanceSnapshot(state.directorGuidance),
      directorContext,
      trace: traceDisplayPath(state.trace),
      lab: jsonClone(state.lab),
      sessionRecipe: jsonClone(state.sessionRecipe),
      fieldVisualization: state.fieldViz?.lastWrite || null,
      world: worldBundle ? { id: worldBundle.world.id, title: worldBundle.world.title, dag: args.dag } : null,
      turns: state.turns,
    };
  }

  function currentTranscriptHtmlSnapshot() {
    const opening = state.history?.[0]?.role === 'assistant' ? state.history[0].content : null;
    const dropout = tutorStubDagFactDropoutSnapshot(state.learnerDag?.dropout);
    const learnerProfile = mixedLearnerProfilePresentation(mixedLearner.suggestion);
    const learnerMode = mixedLearner.enabled ? 'mixed' : 'human';
    const interactionMode = state.interaction?.mode || 'learner';
    const learnerPromptHistory = mixedLearner.enabled ? jsonClone(mixedLearner.promptHistory) : [];
    const nextLearnerTurn = state.turns.length + 1;
    const tutorPromptTurns = state.turns
      .filter((turn) => turn.prompts?.tutor)
      .map((turn) => ({
        turn: turn.turn,
        turnId: turn.turnId,
        ...jsonClone(turn.prompts.tutor),
      }));
    const relaunchCommand = state.trace?.enabled
      ? tutorStubExactRelaunchCommand({ resume: path.relative(ROOT, state.trace.filePath) })
      : loadedSessionRecipePath
        ? tutorStubExactRelaunchCommand({ recipePath: path.relative(ROOT, loadedSessionRecipePath) })
        : null;

    return redactTraceSecrets({
      schema: TUTOR_STUB_TRANSCRIPT_HTML_SCHEMA,
      generatedAt: new Date().toISOString(),
      runId: state.debugRunId,
      title: state.world?.title || state.topic || 'Tutor Stub Transcript',
      directorContext: jsonClone(state.directorContext),
      directorNotes: directorNotesIssuedSoFar(state),
      directorGuidance: tutorStubDirectorGuidanceSnapshot(state.directorGuidance),
      opening,
      history: jsonClone(state.history),
      turns: jsonClone(state.turns),
      settings: {
        presentation: tutorStubCliPresentationSnapshot(cliPresentation),
        responseDetails: jsonClone(state.responseDetails),
        allModelsOverride: state.modelRouting?.allRolesOverrideRef
          ? {
              schema: 'machinespirits.tutor-stub.all-models-override.v1',
              modelRef: state.modelRouting.allRolesOverrideRef,
              roles: Object.keys(liveModelRoleDefinitions),
            }
          : null,
        modelRouting: {
          schema: state.modelRouting?.schema || 'machinespirits.tutor-stub.model-routing.v1',
          allRolesOverrideRef: state.modelRouting?.allRolesOverrideRef || null,
          roles: Object.fromEntries(
            Object.keys(liveModelRoleDefinitions).map((role) => [role, liveModelRoleSnapshot(role)]),
          ),
        },
        voice: voiceRuntimeSnapshot(),
        run: {
          id: state.debugRunId,
          completedTurns: state.turns.length,
          mode: interactionMode,
          learnerMode,
        },
        lab: jsonClone(state.lab),
        recipe: {
          schema: state.sessionRecipe.schema,
          version: state.sessionRecipe.version,
          configHash: state.sessionRecipe.configHash,
          sourceRecipe: loadedSessionRecipePath ? path.relative(ROOT, loadedSessionRecipePath) : null,
          sourceRecipeDrift: jsonClone(state.recipeSource?.drift || null),
          sourceRecipeDriftAcknowledged: Boolean(state.recipeSource?.driftAcknowledged),
          resumeSource: state.resume?.source ? path.relative(ROOT, state.resume.source) : null,
          resumeDrift: jsonClone(state.resume?.drift || null),
          driftAcknowledged: Boolean(state.resume?.driftAcknowledged),
          relaunchCommand,
        },
        world: state.world
          ? {
              id: state.world.id,
              title: state.world.title,
              discipline: state.world.discipline || null,
              question: state.world.question || state.world.publicQuestion || null,
            }
          : {
              id: null,
              title: state.topic,
              discipline: null,
              question: null,
            },
        tutor: {
          instanceId: state.tutorInstance.id,
          instanceTitle: state.tutorInstance.title,
          activeRef: state.tuning.activeRef,
          sourceVersion: state.tutorInstance.sourceVersion,
          rolePromptPath: path.relative(ROOT, state.tutorInstance.rolePromptPath),
          rolePromptHash: state.tutorInstance.rolePromptHash,
          policyPack: jsonClone(state.tutorInstance.policyPack),
          modelRef: state.modelRef,
          provider: state.resolved.provider,
          model: state.resolved.model,
          temperature: state.temperature,
          maxTokens: state.maxTokens,
          cliEffort: state.cliEffort || null,
        },
        classifier: {
          enabled: classifierEnabled,
          combinedWithLearnerDag: combinedLearnerAnalysisEnabled,
          modelRef: args['classifier-model'],
          activeModelRef: classifierEnabled
            ? combinedLearnerAnalysisEnabled
              ? args['learner-record-model']
              : args['classifier-model']
            : null,
          provider: liveModelRoleSnapshot('classifier').resolved.provider,
          model: liveModelRoleSnapshot('classifier').resolved.model,
        },
        learnerRecord: {
          enabled: tutorLearnerDagEnabled,
          modelRef: args['learner-record-model'],
          provider: visibleLearnerRecordModel?.provider || null,
          model: visibleLearnerRecordModel?.model || null,
        },
        learner: {
          mode: learnerMode,
          profileId: mixedLearner.enabled ? learnerProfile.id : null,
          profileName: mixedLearner.enabled ? learnerProfile.name : null,
          profilePattern: mixedLearner.enabled ? learnerProfile.pattern : null,
          modelRef: args['auto-learner-model'],
          provider: visibleAutoLearnerModel?.provider || null,
          model: visibleAutoLearnerModel?.model || null,
        },
        coach: {
          mode: interactionMode === 'coach',
          pending: jsonClone(state.coach?.pending || []),
          applied: jsonClone(state.coach?.history || []),
          publicTranscriptChanged: false,
        },
        directorGuidance: tutorStubDirectorGuidanceSnapshot(state.directorGuidance),
        turnFeedback: {
          enabled: Boolean(state.turnFeedback?.enabled),
          optional: true,
          pending: tutorStubTurnFeedbackLabel(tutorStubTurnFeedbackEnvelope(state.turnFeedback)),
          completedRatings: jsonClone(state.turnFeedback?.history || []),
          automatedLearner: 'disabled',
          typedReasons: Object.keys(TUTOR_STUB_FEEDBACK_REASONS),
        },
        tuning: {
          ...tutorStubTuningSnapshot(state.tuning),
          candidates: listTutorStubTuningCandidates(state.tuning),
          rawCommentsEnterPrompt: false,
          promotionGate: 'approve_to_canary_then_validate_helpful_then_promote',
        },
        automation: {
          available: Boolean(autoLearnerResolved),
          running: Boolean(state.interaction?.autoRunning),
          modelRef: args['auto-learner-model'],
          provider: visibleAutoLearnerModel?.provider || null,
          model: visibleAutoLearnerModel?.model || null,
          profileId: mixedLearner.profileId || 'custom',
          defaultTurns: autoTurns ?? 'until-grounded',
          safetyTurns: autoSafetyTurns,
          stopOnGrounded: autoStopOnGrounded,
        },
        learnerResponseProvenance: summarizeTutorStubLearnerResponseProvenance(state.turns),
        trainingReuse: jsonClone(state.trainingReuse),
        dag: {
          tutorDagEnabled: Boolean(state.dag),
          learnerDagEnabled: tutorLearnerDagEnabled,
          interpretation: state.dagMode,
          discoursePhase: state.humanDiscourse?.phase || null,
          generousInference: Boolean(state.humanDiscourse?.behaviorChange),
        },
        dagFactDropout: dropout,
        releasePacing: tutorStubReleasePacingSnapshot(state.releasePacing, state.world),
        register: {
          enabled: state.register?.enabled || false,
          policy: tutorStubRegisterPolicyStackId(state.register?.policy, state.register?.overlays),
          primaryPolicy: state.register?.policy || null,
          overlayPolicies: state.register?.overlays || [],
          overlayThreshold: state.register?.overlayThreshold ?? null,
          palette: state.register?.palette || [],
          engagementStanceTemperature: state.register?.temperature ?? null,
          temperatureScope: 'engagement_stance_and_actorial_part',
          current: state.register?.current || null,
          empiricalPriorStatus: state.register?.empiricalPriorStatus || null,
        },
        randomPerformance: jsonClone(state.randomPerformance),
        lightAdaptation: jsonClone(state.lightAdaptation),
        performanceDirectives: jsonClone(state.performanceDirectives),
        rememberedDefaults: {
          enabled: Boolean(state.rememberedSettings?.enabled),
          status: state.rememberedSettings?.status || 'disabled',
          file: path.relative(ROOT, state.rememberedSettings?.filePath || rememberedSettings.filePath),
          loadedAt: state.rememberedSettings?.loadedAt || null,
          savedAt: state.rememberedSettings?.savedAt || null,
          appliedFields: state.rememberedSettings?.appliedFields || [],
          scope: 'human_interactive_sessions_only',
        },
        dialogue: {
          memorySummary: Boolean(state.memory?.enabled),
          rawHistoryTurns: state.historyTurns,
          tutorMessageHistory: {
            mode: state.tutorContext?.historyMode || 'full_public_replay',
            activatedBy: state.tutorContext?.activatedBy || 'session_start',
            activatedAtTurn: state.tutorContext?.activatedAtTurn ?? null,
            publicMessageCount: tutorStubPublicMessagesForSpeaker(state.history, { speaker: 'tutor' }).length,
          },
          multipleChoice: state.multipleChoice,
          opening: {
            enabled: openingEnabled,
            realization: jsonClone(state.openingRealization),
            requirements: TUTOR_STUB_OPENING_REQUIREMENTS,
          },
          closeoutReport: closeoutReportEnabled,
          closure: jsonClone(state.dialogueClosure),
        },
        output: {
          stream: state.stream?.enabled || false,
          trace: state.trace?.enabled ? traceDisplayPath(state.trace) : 'off',
          fieldVisualization: state.fieldViz?.enabled || false,
          explanatoryDebug: jsonClone(state.explanatoryDebug),
          learningSummary: {
            enabled: learningSummaryReportConfig.enabled,
            automaticOnConclusion: learningSummaryReportConfig.enabled,
            requiresCompletedTurn: true,
            publicEvidenceOnly: true,
            launchInInteractiveTty: process.env.TUTOR_STUB_SUMMARY_OPEN !== '0',
          },
          concurrentCommands: {
            enabled: concurrentTerminal.enabled,
            activityLine: 'above_prompt',
            inputLine: 'persistent_bottom_line',
            acceptsDuringAutoMode: true,
          },
        },
      },
      prompts: {
        tutor: {
          baseSystemPrompt: state.systemPrompt,
          namedInstance: {
            id: state.tutorInstance.id,
            title: state.tutorInstance.title,
            activeRef: state.tuning.activeRef,
            rolePrompt: state.tutorInstance.rolePrompt,
            rolePromptHash: state.tutorInstance.rolePromptHash,
            reviewedMemory: tutorStubTuningPrompt(state.tuning),
          },
          turns: tutorPromptTurns,
        },
        learner: {
          mode: learnerMode,
          interactionMode,
          activeSystemPrompt: mixedLearner.enabled
            ? mixedLearnerArtifactsSystemPrompt(mixedLearner.profile)
            : 'Human learner input is active; no learner model system prompt is used.',
          nextUserPrompt: mixedLearner.enabled
            ? buildMixedLearnerArtifactsPrompt({
                state,
                profile: mixedLearner.profile,
                turnNumber: nextLearnerTurn,
              })
            : 'Human learner input is active; no learner model user prompt is used.',
          history: learnerPromptHistory,
        },
      },
    });
  }

  function writeCurrentTranscriptHtml({ launch = true, duringTurn = false } = {}) {
    const filePath = path.join(traceDir, `${state.debugRunId}-transcript.html`);
    const absolute = writeTutorStubTranscriptHtml({
      snapshot: currentTranscriptHtmlSnapshot(),
      filePath,
    });
    const shouldLaunch = launch && process.env.TUTOR_STUB_TRANSCRIPT_OPEN !== '0';
    let launchResult = null;
    if (shouldLaunch) launchResult = launchTutorStubTranscriptHtml(absolute);
    const displayPath = path.relative(ROOT, absolute);
    console.log(`${C.cyan}transcript HTML >${C.reset} ${displayPath}`);
    console.log(
      `${C.dim}  ${shouldLaunch ? 'opened in the default browser' : 'written without opening'}; ${state.turns.length} completed turn${state.turns.length === 1 ? '' : 's'}${duringTurn ? '; the in-progress turn is excluded' : ''}${C.reset}\n`,
    );
    appendTraceEvent(state.trace, {
      type: 'transcript_html_snapshot',
      schema: TUTOR_STUB_TRANSCRIPT_HTML_SCHEMA,
      filePath: displayPath,
      turns: state.turns.length,
      duringTurn,
      launched: Boolean(launchResult),
    });
    return { filePath: absolute, launched: Boolean(launchResult) };
  }

  function writeFinalLearningSummary(reason) {
    if (!learningSummaryReportConfig.enabled) return null;
    if (!state.turns.length) return null;
    const summary = buildDialogueLearningSummary(state, { reason, trace: traceDisplayPath(state.trace) });
    summary.session = {
      learnerProfile: args['auto-learner-profile'] || null,
      tutorInstanceId: state.tutorInstance.id,
      tutorInstanceTitle: state.tutorInstance.title,
      tutorRef: state.tuning.activeRef,
      tutorModelRef: state.modelRef,
      tutorProvider: state.resolved.provider,
      tutorModel: state.resolved.model,
      registerPolicy: tutorStubRegisterPolicyStackId(state.register?.policy, state.register?.overlays),
      engagementStanceTemperature: state.register?.temperature ?? null,
      dagMode: state.dagMode,
    };
    summary.tuning = {
      ...tutorStubTuningSnapshot(state.tuning),
      candidates: listTutorStubTuningCandidates(state.tuning),
      promotionPolicy: 'candidate -> canary -> helpful replay validation -> stable promotion',
    };
    const filePath = path.join(traceDir, `${state.debugRunId}-learning-summary.html`);
    const absolute = writeTutorStubLearningSummaryHtml({ summary, filePath });
    const shouldLaunch = Boolean(output.isTTY && process.env.TUTOR_STUB_SUMMARY_OPEN !== '0');
    let launchResult = null;
    if (shouldLaunch) launchResult = launchTutorStubTranscriptHtml(absolute);
    const displayPath = path.relative(ROOT, absolute);
    console.log(`${C.brightGreen}${C.bold}learning summary >${C.reset} ${displayPath}`);
    console.log(
      `${C.dim}  ${shouldLaunch ? 'opened in the default browser' : 'written; browser launch is available in an interactive terminal'} · ${summary.turnCount} completed turn${summary.turnCount === 1 ? '' : 's'}${C.reset}\n`,
    );
    appendTraceEvent(state.trace, {
      type: 'learning_summary_html',
      schema: TUTOR_STUB_LEARNING_SUMMARY_HTML_SCHEMA,
      reason,
      filePath: displayPath,
      turns: summary.turnCount,
      learnerResponseProvenance: summary.learnerResponseProvenance,
      trainingReuse: summary.trainingReuse,
      natural: summary.completion.natural,
      launched: Boolean(launchResult),
    });
    return { filePath: absolute, launched: Boolean(launchResult), summary };
  }

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

  function relaunchArgumentsForScenario(filePath) {
    const current = process.argv.slice(2);
    const next = [];
    const replacedValueOptions = new Set([
      '--all-models',
      '--world',
      '--auto-learner-profile',
      '--model',
      '--classifier-model',
      '--learner-record-model',
      '--auto-learner-model',
      '--register-temperature',
      '--dag-fact-dropout',
      '--release-speed',
      '--register-policy',
      '--register-overlay-threshold',
    ]);
    for (let index = 0; index < current.length; index += 1) {
      const argument = current[index];
      if (argument === '--resume-last') continue;
      if (replacedValueOptions.has(argument)) {
        index += 1;
        continue;
      }
      if ([...replacedValueOptions].some((option) => argument.startsWith(`${option}=`))) continue;
      next.push(argument);
    }
    const modelArguments = state.modelRouting?.allRolesOverrideRef
      ? ['--all-models', state.modelRouting.allRolesOverrideRef]
      : [
          '--model',
          state.modelRef,
          '--classifier-model',
          args['classifier-model'],
          '--learner-record-model',
          args['learner-record-model'],
          '--auto-learner-model',
          args['auto-learner-model'],
        ];
    next.push(
      '--world',
      filePath,
      '--auto-learner-profile',
      state.learnerProfileId || state.learnerProfile,
      ...modelArguments,
      '--register-temperature',
      String(state.register?.temperature ?? registerTemperature),
      '--dag-fact-dropout',
      String(state.learnerDag?.dropout?.rate ?? dagFactDropoutRate),
      '--release-speed',
      String(state.releasePacing?.baseSpeed ?? releaseSpeed),
      '--register-policy',
      tutorStubRegisterPolicyStackId(state.register?.policy, state.register?.overlays),
      '--register-overlay-threshold',
      String(state.register?.overlayThreshold ?? registerOverlayThreshold),
    );
    return next;
  }

  function relaunchWithScenario(selection, reason = 'scenario_changed') {
    const scenarioId = selection?.id || selection?.world?.id;
    const title = selection?.title || selection?.world?.title;
    const filePath = selection?.filePath;
    if (!scenarioId || !filePath) throw new Error('scenario selection is incomplete');
    persistCurrentInteractiveSettings('scenario_selected', { scenarioId });
    appendTraceEvent(state.trace, {
      type: 'next_scenario_selected',
      reason,
      previousScenarioId: state.world?.id || null,
      scenarioId,
      title,
      file: path.relative(ROOT, filePath),
    });
    awaitingAnotherScenario = false;
    exiting = true;
    stopInterimAnimation(state);
    concurrentTerminal.close();
    resetMixedLearnerSuggestion(reason);
    finalizeInteractive(reason);
    rl.close();
    console.log(`${C.brightGreen}${C.bold}next scenario >${C.reset} ${scenarioId} — ${title}`);
    console.log(`${C.dim}  starting a fresh inquiry with your learner profile and dialogue settings${C.reset}\n`);
    const child = spawnSync(
      process.execPath,
      [fileURLToPath(import.meta.url), ...relaunchArgumentsForScenario(filePath)],
      {
        cwd: process.cwd(),
        env: process.env,
        stdio: 'inherit',
      },
    );
    if (child.error) {
      console.log(`${C.red}scenario launch error:${C.reset} ${child.error.message}`);
      process.exitCode = 1;
    } else if (child.signal) {
      process.exitCode = 1;
    } else {
      process.exitCode = child.status ?? 0;
    }
    resolveInteractive();
  }

  function relaunchArgumentsForWorkplanModule(moduleId) {
    const current = process.argv.slice(2);
    const next = [];
    const replacedValueOptions = new Set([
      '--all-models',
      '--world',
      '--curriculum',
      '--module',
      '--system',
      '--auto-learner-profile',
      '--model',
      '--classifier-model',
      '--learner-record-model',
      '--auto-learner-model',
      '--register-temperature',
      '--dag-fact-dropout',
      '--release-speed',
      '--register-policy',
      '--register-overlay-threshold',
    ]);
    const removedBooleanOptions = new Set([
      '--resume-last',
      '--dag',
      '--tutor-learner-dag',
      '--list-curriculum-modules',
    ]);
    for (let index = 0; index < current.length; index += 1) {
      const argument = current[index];
      if ([...removedBooleanOptions].some((option) => argument === option || argument.startsWith(`${option}=`))) {
        continue;
      }
      if (replacedValueOptions.has(argument)) {
        index += 1;
        continue;
      }
      if ([...replacedValueOptions].some((option) => argument.startsWith(`${option}=`))) continue;
      next.push(argument);
    }
    const modelArguments = state.modelRouting?.allRolesOverrideRef
      ? ['--all-models', state.modelRouting.allRolesOverrideRef]
      : [
          '--model',
          state.modelRef,
          '--classifier-model',
          args['classifier-model'],
          '--learner-record-model',
          args['learner-record-model'],
          '--auto-learner-model',
          args['auto-learner-model'],
        ];
    next.push(
      '--curriculum',
      'workplan',
      '--module',
      moduleId,
      '--auto-learner-profile',
      state.learnerProfileId || state.learnerProfile,
      ...modelArguments,
      '--register-temperature',
      String(state.register?.temperature ?? registerTemperature),
      '--dag-fact-dropout',
      String(state.learnerDag?.dropout?.rate ?? dagFactDropoutRate),
      '--release-speed',
      String(state.releasePacing?.baseSpeed ?? releaseSpeed),
      '--register-policy',
      tutorStubRegisterPolicyStackId(state.register?.policy, state.register?.overlays),
      '--register-overlay-threshold',
      String(state.register?.overlayThreshold ?? registerOverlayThreshold),
    );
    return next;
  }

  function relaunchWithWorkplanModule(selection, reason = 'board_item_changed') {
    const moduleId = selection?.id || selection?.module?.id;
    const title = selection?.title || selection?.module?.title;
    if (!moduleId || !title) throw new Error('workplan selection is incomplete');
    appendTraceEvent(state.trace, {
      type: 'next_curriculum_module_selected',
      reason,
      sourceRef: 'workplan:live',
      previousCurriculumModuleId: state.curriculum?.module?.id || null,
      previousScenarioId: state.world?.id || null,
      moduleId,
      title,
    });
    awaitingAnotherScenario = false;
    exiting = true;
    stopInterimAnimation(state);
    concurrentTerminal.close();
    resetMixedLearnerSuggestion(reason);
    finalizeInteractive(reason);
    rl.close();
    console.log(`${C.brightGreen}${C.bold}next board item >${C.reset} ${moduleId} — ${title}`);
    console.log(
      `${C.dim}  starting a fresh reflective inquiry from the live workplan with your learner profile and dialogue settings${C.reset}\n`,
    );
    const child = spawnSync(
      process.execPath,
      [fileURLToPath(import.meta.url), ...relaunchArgumentsForWorkplanModule(moduleId)],
      {
        cwd: process.cwd(),
        env: process.env,
        stdio: 'inherit',
      },
    );
    if (child.error) {
      console.log(`${C.red}board launch error:${C.reset} ${child.error.message}`);
      process.exitCode = 1;
    } else if (child.signal) {
      process.exitCode = 1;
    } else {
      process.exitCode = child.status ?? 0;
    }
    resolveInteractive();
  }

  async function chooseAnotherScenario(argument = '', { reason = 'scenario_changed', duringTurn = false } = {}) {
    clearStatusLine();
    if (duringTurn || processingTurn) {
      console.log(
        `${C.dim}scenario change not started; run /scenario again after the current tutor response completes${C.reset}\n`,
      );
      return false;
    }
    let selection = null;
    const requested = String(argument || '').trim();
    if (requested) {
      try {
        const bundle = resolveWorldRef(requested);
        selection = {
          id: bundle.world.id,
          title: bundle.world.title,
          filePath: bundle.filePath,
          world: bundle.world,
        };
      } catch (error) {
        console.log(`${C.red}scenario error:${C.reset} ${error.message}\n`);
        return false;
      }
    } else if (input.isTTY && output.isTTY && typeof input.setRawMode === 'function') {
      scenarioPickerActive = true;
      initialSetupStage = 'scenario';
      console.log(`${C.cyan}Pick another scenario${C.reset}`);
      console.log(`${C.dim}  ↑/↓ scroll · Enter select · highlighted scenario described below · Esc return${C.reset}`);
      try {
        selection = await pickInitialScenarioWithKeyboard(state.world?.id || args.world);
      } finally {
        scenarioPickerActive = false;
        initialSetupStage = 'off';
      }
      if (!selection) {
        rl.setPrompt(
          awaitingAnotherScenario
            ? `${C.brightCyan}${C.bold}another scenario? [y/N] >${C.reset} `
            : mixedLearnerPromptText(),
        );
        console.log(`${C.dim}scenario picker closed; the current inquiry is unchanged${C.reset}\n`);
        return false;
      }
    } else {
      console.log(`${C.cyan}scenario >${C.reset} type /scenario <id> to start another inquiry`);
      console.log(`${C.dim}  run with --list-worlds outside the dialogue to browse scenario ids${C.reset}\n`);
      return false;
    }
    relaunchWithScenario(selection, reason);
    return true;
  }

  async function chooseWorkplanModule(argument = '', { reason = 'board_item_changed', duringTurn = false } = {}) {
    clearStatusLine();
    if (duringTurn || processingTurn) {
      console.log(
        `${C.dim}board change not started; run /board again after the current tutor response completes${C.reset}\n`,
      );
      return false;
    }
    let selection = null;
    const requested = String(argument || '').trim();
    if (requested) {
      try {
        const selected = tutorStubCurriculumBundle('workplan', requested, { root: ROOT });
        selection = {
          id: selected.module.id,
          title: selected.module.title,
          module: selected.module,
        };
      } catch (error) {
        console.log(`${C.red}board error:${C.reset} ${error.message}\n`);
        return false;
      }
    } else if (input.isTTY && output.isTTY && typeof input.setRawMode === 'function') {
      scenarioPickerActive = true;
      initialSetupStage = 'board';
      console.log(`${C.cyan}Pick a workplan item${C.reset}`);
      console.log(
        `${C.dim}  ↑/↓ scroll · Enter select · highlighted card described below · Esc return · reads workplan/items live${C.reset}`,
      );
      try {
        selection = await pickWorkplanModuleWithKeyboard(state.curriculum?.module?.id || '');
      } catch (error) {
        console.log(`${C.red}board error:${C.reset} ${error.message}\n`);
        return false;
      } finally {
        scenarioPickerActive = false;
        initialSetupStage = 'off';
      }
      if (!selection) {
        rl.setPrompt(
          awaitingAnotherScenario
            ? `${C.brightCyan}${C.bold}another scenario? [y/N] >${C.reset} `
            : mixedLearnerPromptText(),
        );
        console.log(`${C.dim}board picker closed; the current inquiry is unchanged${C.reset}\n`);
        return false;
      }
    } else {
      printCurriculumModules('workplan');
      console.log(`${C.cyan}board >${C.reset} type /board <item-id> to start a reflective inquiry\n`);
      return false;
    }
    relaunchWithWorkplanModule(selection, reason);
    return true;
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

  function emitResumeHandoff(reason = 'start', { display = true } = {}) {
    if (!resumedDialogue || state.resumeHandoff || !state.turns.length) return state.resumeHandoff?.text || null;
    const handoff = buildTutorStubResumeHandoff({ world: state.world, turns: state.turns });
    if (!handoff) return null;
    state.resumeHandoff = handoff;
    state.history.push({ role: 'assistant', content: handoff.text });
    appendTraceEvent(state.trace, {
      type: 'tutor_resume_handoff',
      reason,
      ...handoff,
    });
    if (display && !exiting) {
      console.log(`${C.magenta}tutor >${C.reset} ${handoff.text}\n`);
    }
    return handoff.text;
  }

  async function emitOpeningPrompt(
    reason = 'start',
    { display = true, signal = null, realizer = null, deterministicSource = null } = {},
  ) {
    if (!openingEnabled || state.history.length) return null;
    const openingRealization = await buildTutorOpening(state, {
      signal,
      ...(realizer ? { realizer } : {}),
      ...(deterministicSource ? { deterministicSource } : {}),
    });
    const opening = openingRealization.text;
    state.openingRealization = openingRealization;
    state.history.push({ role: 'assistant', content: opening });
    acknowledgeTutorStubOpeningRelease({ pacing: state.releasePacing, world: state.world });
    const turnId = openingDebugId(stateRunDebugId(state));
    appendTraceEvent(state.trace, {
      type: 'tutor_opening',
      turnId,
      reason,
      text: opening,
      realization: openingRealization,
    });
    if (display) printInteractiveTutorOpening(opening);
    return opening;
  }

  function resetInteractiveState() {
    const currentRegisterTemperature =
      state.register?.temperature ?? registerTemperature ?? DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE;
    const currentRegisterOverlays = [...(state.register?.overlays || registerPolicyOverlays)];
    const currentRegisterOverlayThreshold =
      state.register?.overlayThreshold ?? registerOverlayThreshold ?? DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD;
    const currentDagFactDropout = tutorStubDagFactDropoutSnapshot(state.learnerDag?.dropout);
    const currentReleaseSpeed = state.releasePacing?.baseSpeed ?? releaseSpeed;
    state.history = [];
    state.turns = [];
    state.openingRealization = null;
    state.resumeHandoff = null;
    state.coach = { pending: [], history: [] };
    state.turnFeedback = createTutorStubTurnFeedbackState({ enabled: state.turnFeedback?.enabled !== false });
    mixedLearner.promptHistory = [];
    state.printedDebugIds = new Set();
    state.directorOpeningPresented = false;
    state.tutorContext = {
      schema: 'machinespirits.tutor-stub.tutor-context-policy.v2',
      historyMode: 'full_public_replay',
      activatedBy: 'dialogue_reset',
      activatedAtTurn: null,
      modelRef: state.modelRef,
    };
    state.dialogueClosure = { ...dialogueClosureConfig };
    state.learnerDag = createLearnerDagState({
      enabled: tutorLearnerDagEnabled,
      modelRef: args['learner-record-model'],
      resolved: learnerRecordResolved,
      world: worldBundle?.world || null,
      dropout: {
        rate: currentDagFactDropout.rate,
        seed: currentDagFactDropout.seed,
        graceTurns: currentDagFactDropout.graceTurns,
        maxConcurrent: currentDagFactDropout.maxConcurrent,
      },
    });
    state.comprehension = createTutorStubComprehensionState();
    state.releasePacing = createTutorStubReleasePacingState({
      world: state.world,
      speed: currentReleaseSpeed,
    });
    state.typedActions = {
      enabled: state.typedActions?.enabled || false,
      config: state.typedActions?.config || typedActionConfig,
      ledger: [],
      currentDecision: null,
      scaffoldLifecycle: createScaffoldLifecycle(),
    };
    if (state.fieldViz) state.fieldViz.lastWrite = null;
    state.register = {
      enabled: registerSelectionEnabled,
      palette: registerPalette,
      policy: registerPolicy,
      overlays: currentRegisterOverlays,
      overlayThreshold: currentRegisterOverlayThreshold,
      temperature: currentRegisterTemperature,
      continuousUnsafe: continuousUnsafeRegisterAnchorsEnabled,
      empiricalPrior: registerEmpiricalPrior.prior,
      empiricalPriorStatus: registerEmpiricalPrior.status,
      empiricalPriorPath: registerEmpiricalPrior.filePath,
      current: null,
      history: [],
    };
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

  async function handleDialogueSettings(argument = '', { duringTurn = false } = {}) {
    clearStatusLine();
    const parts = String(argument || '')
      .trim()
      .split(/\s+/u)
      .filter(Boolean);
    const temperatureNames = ['temp', 'temperature', 'stance-temp'];
    const dropoutNames = ['dropout', 'dag-dropout', 'dag-fact-dropout'];
    const releaseSpeedNames = ['release-speed', 'release_speed', 'pace', 'speed'];
    const lightAdaptationNames = ['light', 'light-adaptation', 'difficulty-shift'];
    const trainingReuseNames = ['training-reuse', 'training_reuse', 'data-reuse', 'data_use'];
    const modelNames = ['model', 'tutor-model'];
    const modelRoleAliases = {
      tutor: 'tutor',
      speaker: 'tutor',
      classifier: 'classifier',
      interpretation: 'classifier',
      assessment: 'classifier',
      reasoning: 'reasoning',
      tracker: 'reasoning',
      'learner-record': 'reasoning',
      learner: 'learner',
      'learner-voice': 'learner',
      auto: 'learner',
    };
    if (state.passthrough?.enabled && !parts.length) {
      console.log(`${C.cyan}passthrough settings >${C.reset}`);
      console.log(
        `${C.dim}  speaker model: ${state.modelRef} → ${state.resolved.provider}/${state.resolved.model}; effort ${state.cliEffort || 'provider default'}${C.reset}`,
      );
      printTrainingReuseStatus();
      console.log(
        `${C.dim}  use /settings model, /settings training-reuse on|off, /theme, or /motion; teaching-policy settings are bypassed${C.reset}\n`,
      );
      return;
    }
    if (
      state.passthrough?.enabled &&
      ![...modelNames, ...trainingReuseNames, 'theme', 'motion'].includes(String(parts[0] || '').toLowerCase())
    ) {
      console.log(
        `${C.dim}only the speaker model, training reuse, and terminal appearance are adjustable in passthrough mode; use /settings model, /settings training-reuse, /theme, or /motion${C.reset}\n`,
      );
      return;
    }
    if (!parts.length) {
      if (liveSettingsPickerAvailable() && !duringTurn) {
        await openLiveSettingsPanel();
      } else {
        printDialogueSettings();
        if (duringTurn && liveSettingsPickerAvailable()) {
          console.log(`${C.dim}  interactive editing is available after the current tutor turn completes${C.reset}\n`);
        }
      }
      return;
    }
    if (parts.length === 1 && modelNames.includes(parts[0].toLowerCase())) {
      if (liveSettingsPickerAvailable() && !duringTurn) await chooseLiveTutorModel();
      else printTutorModelChoices();
      return;
    }
    if (
      parts.length === 1 &&
      [...temperatureNames, ...dropoutNames, ...releaseSpeedNames].includes(parts[0].toLowerCase())
    ) {
      if (liveSettingsPickerAvailable() && !duringTurn) {
        const requested = parts[0].toLowerCase();
        await chooseLiveNumericSetting(
          temperatureNames.includes(requested)
            ? 'stance_temp'
            : releaseSpeedNames.includes(requested)
              ? 'release_speed'
              : 'dropout',
        );
      } else {
        printDialogueSettings();
      }
      return;
    }
    const setting = parts[0].toLowerCase();
    if (trainingReuseNames.includes(setting)) {
      if (parts.length > 2) {
        console.log(`${C.red}settings error:${C.reset} use /settings training-reuse on|off|status\n`);
        return;
      }
      handleTrainingReuseSetting(parts[1] || 'status');
      return;
    }
    if (lightAdaptationNames.includes(setting)) {
      if (parts.length > 2) {
        console.log(`${C.red}settings error:${C.reset} use /settings light, or /settings light on|off|status\n`);
        return;
      }
      handleLightAdaptationCommand(parts[1] || 'status', { duringTurn });
      return;
    }
    if (setting === 'theme') {
      if (parts.length === 1) {
        console.log(`${C.accent}${C.bold}themes >${C.reset} current ${cliPresentation.themeLabel}`);
        console.log(`${C.dim}  choose ${TUTOR_STUB_CLI_THEME_IDS.join(' · ')}${C.reset}\n`);
        return;
      }
      try {
        const previous = cliPresentation.themeId;
        args.theme = normalizeTutorStubCliThemeId(parts[1], { strict: true });
        configureCliPresentation({
          theme: args.theme,
          motion: cliPresentation.requestedMotion,
          noColor: args['no-color'],
        });
        state.presentation = tutorStubCliPresentationSnapshot(cliPresentation);
        rl.setPrompt(mixedLearnerPromptText());
        const remembered = persistCurrentInteractiveSettings('terminal_theme_changed');
        appendTraceEvent(state.trace, {
          type: 'terminal_presentation_changed',
          axis: 'theme',
          previous,
          current: cliPresentation.themeId,
          presentation: state.presentation,
          duringTurn,
        });
        console.log(`${C.accent}${C.bold}settings >${C.reset} theme → ${cliPresentation.themeLabel}`);
        console.log(
          `${C.dim}  ${tutorStubCliThemePreview(cliPresentation)}${remembered ? ' · remembered' : ''}${C.reset}\n`,
        );
      } catch (error) {
        console.log(`${C.danger}settings error:${C.reset} ${error.message}\n`);
      }
      return;
    }
    if (setting === 'motion') {
      if (parts.length === 1) {
        console.log(
          `${C.accent2}${C.bold}motion >${C.reset} ${cliPresentation.requestedMotion} selected · ${cliPresentation.motion} active`,
        );
        console.log(`${C.dim}  choose ${TUTOR_STUB_CLI_MOTION_IDS.join(' · ')}${C.reset}\n`);
        return;
      }
      try {
        const previous = cliPresentation.requestedMotion;
        args.motion = normalizeTutorStubCliMotion(parts[1], { strict: true });
        configureCliPresentation({
          theme: cliPresentation.themeId,
          motion: args.motion,
          noColor: args['no-color'],
        });
        state.presentation = tutorStubCliPresentationSnapshot(cliPresentation);
        const remembered = persistCurrentInteractiveSettings('terminal_motion_changed');
        appendTraceEvent(state.trace, {
          type: 'terminal_presentation_changed',
          axis: 'motion',
          previous,
          current: cliPresentation.requestedMotion,
          resolved: cliPresentation.motion,
          presentation: state.presentation,
          duringTurn,
        });
        console.log(
          `${C.accent2}${C.bold}settings >${C.reset} motion → ${cliPresentation.requestedMotion} (${cliPresentation.motion} here)`,
        );
        console.log(`${C.dim}  ${remembered ? 'remembered for next time' : 'applies to this session'}${C.reset}\n`);
      } catch (error) {
        console.log(`${C.danger}settings error:${C.reset} ${error.message}\n`);
      }
      return;
    }
    if (setting === 'models') {
      if (parts.length === 1) {
        printDialogueSettings();
        return;
      }
      const requestedRole = String(parts[1] || '').toLowerCase();
      const role = modelRoleAliases[requestedRole] || null;
      if (requestedRole !== 'all' && !role) {
        console.log(
          `${C.red}settings error:${C.reset} use /settings models all|tutor|classifier|reasoning|learner [provider.alias]\n`,
        );
        return;
      }
      if (parts.length === 2) {
        if (liveSettingsPickerAvailable() && !duringTurn) {
          if (requestedRole === 'all') {
            console.log(`${C.brightCyan}${C.bold}One model for all roles · choose with ↑/↓ and Enter${C.reset}`);
            const selection = await pickInitialTutorModelWithKeyboard(
              state.modelRouting?.allRolesOverrideRef || state.modelRef,
            );
            if (selection) await handleDialogueSettings(`models all ${selection.ref}`);
          } else {
            await chooseLiveRoleModel(role);
          }
        } else if (requestedRole === 'all') {
          printTutorModelChoices();
        } else {
          printModelChoices(role);
        }
        return;
      }
      if (parts.length !== 3) {
        console.log(
          `${C.red}settings error:${C.reset} use /settings models all|tutor|classifier|reasoning|learner <provider.alias>\n`,
        );
        return;
      }
      if (duringTurn) {
        console.log(`${C.dim}model routing is unchanged while a tutor turn is in progress${C.reset}`);
        console.log(`${C.dim}  change it after the response so each turn uses one stable route${C.reset}\n`);
        appendTraceEvent(state.trace, {
          type: 'role_model_change_rejected',
          reason: 'turn_in_progress',
          role: requestedRole,
          requested: parts[2],
          turn: state.turns.length + 1,
        });
        return;
      }
      const defaultRef = requestedRole === 'all' ? STUB.model : liveModelRoleDefinitions[role].defaultRef;
      const requestedRef = parts[2].toLowerCase() === 'default' ? defaultRef : parts[2];
      let selected;
      try {
        selected =
          requestedRole === 'all'
            ? applyAllRoleModelSelection(requestedRef, { source: 'live_settings' })
            : applyRoleModelSelection(role, requestedRef, { source: 'live_settings' });
      } catch (error) {
        console.log(`${C.red}settings error:${C.reset} ${error.message}\n`);
        return;
      }
      const label = requestedRole === 'all' ? 'all roles' : liveModelRoleDefinitions[role].label.toLowerCase();
      if (!selected.changed && state.modelRouting?.allRolesOverrideRef === requestedRef) {
        console.log(`${C.cyan}settings >${C.reset} ${label} already use ${selected.modelRef}\n`);
        return;
      }
      console.log(
        `${C.cyan}settings >${C.reset} ${label} → ${selected.modelRef}; applies from turn ${state.turns.length + 1}`,
      );
      console.log(`${C.dim}  resolved as ${selected.resolved.provider}/${selected.resolved.model}${C.reset}`);
      if (requestedRole === 'all') {
        console.log(
          `${C.dim}  tutor, interpretation, reasoning tracker, and learner voice now share this model${C.reset}`,
        );
      } else {
        console.log(`${C.dim}  other model roles keep their current selections${C.reset}`);
      }
      if (latestTutorMessage(state)) {
        startMixedLearnerPrefetch(`${requestedRole}_model_changed`);
        console.log(
          `${C.dim}  rebuilding any affected learner suggestion, analysis, and prefetched tutor reply${C.reset}`,
        );
      }
      console.log();
      return;
    }
    if (setting === 'forget' && parts.length === 1) {
      if (duringTurn) {
        console.log(`${C.dim}saved settings cannot be changed while the tutor is responding${C.reset}\n`);
        return;
      }
      const forgotten = forgetRememberedInteractiveSettings({ source: 'live_settings' });
      console.log(
        `${C.cyan}settings >${C.reset} ${forgotten.existed ? 'saved settings forgotten' : 'there were no saved settings'}`,
      );
      console.log(`${C.dim}  this conversation is unchanged; the next one starts from its launch settings${C.reset}\n`);
      return;
    }
    if (modelNames.includes(setting)) {
      if (parts.length !== 2) {
        console.log(`${C.red}settings error:${C.reset} use /settings model or /settings model <provider.alias>\n`);
        return;
      }
      if (duringTurn) {
        console.log(`${C.dim}tutor model is unchanged while a tutor turn is in progress${C.reset}`);
        console.log(`${C.dim}  change it after the response so the whole turn uses one model${C.reset}\n`);
        appendTraceEvent(state.trace, {
          type: 'tutor_model_change_rejected',
          reason: 'turn_in_progress',
          requested: parts[1],
          turn: state.turns.length + 1,
        });
        return;
      }
      const requestedRef = parts[1].toLowerCase() === 'default' ? STUB.model : parts[1];
      let selected;
      try {
        selected = applyTutorModelSelection(requestedRef, { source: 'live_settings' });
      } catch (error) {
        console.log(`${C.red}settings error:${C.reset} ${error.message}\n`);
        return;
      }
      if (!selected.changed) {
        console.log(`${C.cyan}settings >${C.reset} tutor model already ${selected.modelRef}\n`);
        return;
      }
      console.log(
        `${C.cyan}settings >${C.reset} tutor model ${selected.previousRef || 'previous'} → ${selected.modelRef}; applies from turn ${state.turns.length + 1}`,
      );
      console.log(`${C.dim}  resolved as ${selected.resolved.provider}/${selected.resolved.model}${C.reset}`);
      console.log(
        `${C.dim}  the new tutor model will continue replaying all ${
          tutorStubPublicMessagesForSpeaker(state.history, { speaker: 'tutor' }).length
        } earlier public messages before every later response${C.reset}`,
      );
      if (mixedLearner.enabled && latestTutorMessage(state)) {
        startMixedLearnerPrefetch('tutor_model_changed');
        console.log(`${C.dim}  rebuilding the learner suggestion, its analysis, and the next tutor response${C.reset}`);
      }
      console.log();
      return;
    }
    if (setting === 'policy' || setting === 'policies' || setting === 'overlay' || setting === 'overlays') {
      if (parts.length === 1) {
        printDialogueSettings();
        return;
      }
      if (duringTurn) {
        console.log(`${C.dim}teaching-style overrides cannot be changed while the tutor is responding${C.reset}`);
        console.log(`${C.dim}  change them afterward so the whole turn uses one set of settings${C.reset}\n`);
        appendTraceEvent(state.trace, {
          type: 'register_policy_composition_change_rejected',
          reason: 'turn_in_progress',
          requested: parts.slice(1),
          turn: state.turns.length + 1,
        });
        return;
      }
      const action = String(parts[1] || '').toLowerCase();
      let nextOverlays = [...(state.register?.overlays || [])];
      let nextThreshold = state.register?.overlayThreshold ?? DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD;
      try {
        if (action === 'add') {
          const overlay = String(parts[2] || '')
            .toLowerCase()
            .replace(/-/gu, '_');
          if (parts.length !== 3 || !TUTOR_STUB_REGISTER_OVERLAY_POLICIES.includes(overlay)) {
            throw new Error(`policy add expects ${TUTOR_STUB_REGISTER_OVERLAY_POLICIES.join(' or ')}`);
          }
          nextOverlays = [...new Set([...nextOverlays, overlay])];
        } else if (action === 'remove') {
          const overlay = String(parts[2] || '')
            .toLowerCase()
            .replace(/-/gu, '_');
          if (parts.length !== 3 || !TUTOR_STUB_REGISTER_OVERLAY_POLICIES.includes(overlay)) {
            throw new Error(`policy remove expects ${TUTOR_STUB_REGISTER_OVERLAY_POLICIES.join(' or ')}`);
          }
          nextOverlays = nextOverlays.filter((entry) => entry !== overlay);
        } else if (action === 'clear') {
          if (parts.length !== 2) throw new Error('policy clear takes no additional argument');
          nextOverlays = [];
        } else if (action === 'threshold') {
          if (parts.length !== 3) throw new Error('policy threshold expects one number from 0 to 1');
          nextThreshold = normalizeTutorStubRegisterOverlayThreshold(parts[2], {
            label: 'register overlay threshold',
          });
        } else {
          throw new Error('use policy add <state|field>, remove <state|field>, clear, or threshold <0-1>');
        }
        parseTutorStubRegisterPolicyStack(tutorStubRegisterPolicyStackId(state.register.policy, nextOverlays));
      } catch (error) {
        console.log(`${C.red}settings error:${C.reset} ${error.message}\n`);
        return;
      }
      const previous = {
        overlays: [...(state.register?.overlays || [])],
        threshold: state.register?.overlayThreshold ?? DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD,
      };
      const unchanged =
        previous.threshold === nextThreshold &&
        previous.overlays.length === nextOverlays.length &&
        previous.overlays.every((overlay, index) => overlay === nextOverlays[index]);
      if (unchanged) {
        console.log(
          `${C.cyan}settings >${C.reset} teaching approach is already ${tutorStubRegisterPolicyStackId(
            state.register.policy,
            state.register.overlays,
          )}; override sensitivity ${nextThreshold}\n`,
        );
        return;
      }
      state.register.overlays = nextOverlays;
      state.register.overlayThreshold = nextThreshold;
      const invalidated = resetMixedLearnerSuggestion('register_policy_composition_changed');
      const remembered = persistCurrentInteractiveSettings('register_policy_composition_changed');
      appendTraceEvent(state.trace, {
        type: 'register_policy_composition_changed',
        schema: TUTOR_STUB_REGISTER_POLICY_COMPOSITION_SCHEMA,
        primaryPolicy: state.register.policy,
        previous,
        overlays: nextOverlays,
        threshold: nextThreshold,
        policyStack: tutorStubRegisterPolicyStackId(state.register.policy, nextOverlays),
        effectiveTurn: state.turns.length + 1,
        rememberedAt: remembered?.updatedAt || null,
        cacheRefresh: {
          priorStateCleared: Boolean(invalidated?.hadState),
          analysisDiscarded: Boolean(invalidated?.discardedAnalysis),
          tutorResponseDiscarded: Boolean(invalidated?.discardedTutorResponse),
        },
      });
      console.log(
        `${C.cyan}settings >${C.reset} teaching approach ${tutorStubRegisterPolicyStackId(
          state.register.policy,
          nextOverlays,
        )}; override sensitivity ${nextThreshold}; applies from turn ${state.turns.length + 1}`,
      );
      console.log(
        `${C.dim}  the normal approach selects first; a strong turn or conversation change can override it${C.reset}`,
      );
      if (mixedLearner.enabled && latestTutorMessage(state)) {
        startMixedLearnerPrefetch('register_policy_composition_changed');
        console.log(`${C.dim}  rebuilding the learner suggestion, its analysis, and the next tutor response${C.reset}`);
      }
      console.log();
      return;
    }
    if (![...temperatureNames, ...dropoutNames, ...releaseSpeedNames].includes(setting) || parts.length !== 2) {
      console.log(
        `${C.red}settings error:${C.reset} use /settings, /settings model [provider.alias], /settings stance-temp <n>, /settings dropout <0-1>, /settings light on|off, /settings release-speed <0.5-2>, /settings policy add <state|field>, or /settings forget`,
      );
      console.log(
        `${C.dim}  examples: /settings model codex.gpt-5.6-luna | /settings temp 0.4 | /settings dropout 0.15 | /settings light off | /settings release-speed 1.5${C.reset}\n`,
      );
      return;
    }
    if (duringTurn) {
      console.log(`${C.dim}dialogue settings cannot be changed while the tutor is responding${C.reset}`);
      console.log(`${C.dim}  change them afterward so the whole turn uses one value${C.reset}\n`);
      appendTraceEvent(state.trace, {
        type: 'dialogue_setting_change_rejected',
        setting,
        reason: 'turn_in_progress',
        requested: parts[1],
        turn: state.turns.length + 1,
      });
      return;
    }

    if (dropoutNames.includes(setting)) {
      let nextRate;
      try {
        nextRate = normalizeTutorStubDagFactDropoutRate(parts[1], { label: 'evidence-memory dropout' });
      } catch (error) {
        console.log(`${C.red}settings error:${C.reset} ${error.message}\n`);
        return;
      }
      const previousRate = state.learnerDag.dropout.rate;
      if (nextRate === previousRate) {
        console.log(`${C.cyan}settings >${C.reset} evidence-memory dropout is already ${nextRate}\n`);
        return;
      }
      state.learnerDag.dropout.rate = nextRate;
      const invalidated = resetMixedLearnerSuggestion('dag_fact_dropout_changed');
      const remembered = persistCurrentInteractiveSettings('dag_fact_dropout_changed');
      appendTraceEvent(state.trace, {
        type: 'dag_fact_dropout_changed',
        schema: 'machinespirits.tutor-stub.dag-fact-dropout-change.v1',
        previous: previousRate,
        rate: nextRate,
        seed: state.learnerDag.dropout.seed,
        effectiveTurn: state.turns.length + 1,
        activeDroppedCount: Object.keys(state.learnerDag.dropout.activeDropped || {}).length,
        rememberedAt: remembered?.updatedAt || null,
        cacheRefresh: {
          priorStateCleared: Boolean(invalidated?.hadState),
          analysisDiscarded: Boolean(invalidated?.discardedAnalysis),
          tutorResponseDiscarded: Boolean(invalidated?.discardedTutorResponse),
        },
      });
      console.log(
        `${C.cyan}settings >${C.reset} evidence-memory dropout ${previousRate} → ${nextRate}; applies from turn ${state.turns.length + 1}`,
      );
      console.log(
        `${C.dim}  ${nextRate === 0 ? 'new forgetting is off; anything already forgotten can still be recalled in dialogue or reset with /reset' : 'previously understood evidence can now be temporarily forgotten at this per-turn rate'}${C.reset}`,
      );
      if (!state.learnerDag.enabled) {
        console.log(`${C.dim}  saved but inactive because learner evidence tracking is off${C.reset}`);
      }
      if (mixedLearner.enabled && latestTutorMessage(state)) {
        startMixedLearnerPrefetch('dag_fact_dropout_changed');
        console.log(`${C.dim}  rebuilding the learner suggestion, its analysis, and the next tutor response${C.reset}`);
      }
      console.log();
      return;
    }

    if (releaseSpeedNames.includes(setting)) {
      let nextSpeed;
      try {
        nextSpeed = normalizeTutorStubReleaseSpeed(parts[1], { label: 'clue release speed' });
      } catch (error) {
        console.log(`${C.red}settings error:${C.reset} ${error.message}\n`);
        return;
      }
      const previousSpeed = state.releasePacing?.baseSpeed ?? DEFAULT_TUTOR_STUB_RELEASE_SPEED;
      if (nextSpeed === previousSpeed) {
        console.log(`${C.cyan}settings >${C.reset} clue release speed is already ${nextSpeed}x\n`);
        return;
      }
      const releasePacing = setTutorStubReleaseSpeed({
        pacing: state.releasePacing,
        world: state.world,
        speed: nextSpeed,
        turn: state.turns.length + 1,
      });
      const invalidated = resetMixedLearnerSuggestion('release_speed_changed');
      const remembered = persistCurrentInteractiveSettings('release_speed_changed');
      appendTraceEvent(state.trace, {
        type: 'release_speed_changed',
        schema: 'machinespirits.tutor-stub.release-speed-change.v1',
        previous: previousSpeed,
        speed: nextSpeed,
        effectiveSpeed: releasePacing?.effectiveSpeed ?? nextSpeed,
        effectiveTurn: state.turns.length + 1,
        rememberedAt: remembered?.updatedAt || null,
        releasePacing,
        cacheRefresh: {
          priorStateCleared: Boolean(invalidated?.hadState),
          analysisDiscarded: Boolean(invalidated?.discardedAnalysis),
          tutorResponseDiscarded: Boolean(invalidated?.discardedTutorResponse),
        },
      });
      console.log(
        `${C.cyan}settings >${C.reset} clue release speed ${previousSpeed}x → ${nextSpeed}x; applies from turn ${state.turns.length + 1}`,
      );
      console.log(
        `${C.dim}  1x follows the authored schedule; the learner can still ask to move faster or slow down${C.reset}`,
      );
      if (mixedLearner.enabled && latestTutorMessage(state)) {
        startMixedLearnerPrefetch('release_speed_changed');
        console.log(`${C.dim}  rebuilding the learner suggestion, its analysis, and the next tutor response${C.reset}`);
      }
      console.log();
      return;
    }

    let nextTemperature;
    try {
      nextTemperature = normalizeTutorStubEngagementStanceTemperature(parts[1], {
        label: 'teaching-style range',
      });
    } catch (error) {
      console.log(`${C.red}settings error:${C.reset} ${error.message}\n`);
      return;
    }
    const previousTemperature = state.register?.temperature ?? registerTemperature;
    if (nextTemperature === previousTemperature) {
      console.log(`${C.cyan}settings >${C.reset} teaching-style range is already ${nextTemperature}\n`);
      return;
    }

    state.register.temperature = nextTemperature;
    const invalidated = resetMixedLearnerSuggestion('register_temperature_changed');
    const remembered = persistCurrentInteractiveSettings('register_temperature_changed');
    appendTraceEvent(state.trace, {
      type: 'register_temperature_changed',
      schema: 'machinespirits.tutor-stub.engagement-stance-temperature-change.v1',
      previous: previousTemperature,
      temperature: nextTemperature,
      policy: state.register.policy,
      active: registerTemperatureApplies(state.register.policy),
      scope: 'engagement_stance_and_actorial_part',
      effectiveTurn: state.turns.length + 1,
      rememberedAt: remembered?.updatedAt || null,
      cacheRefresh: {
        priorStateCleared: Boolean(invalidated?.hadState),
        analysisDiscarded: Boolean(invalidated?.discardedAnalysis),
        tutorResponseDiscarded: Boolean(invalidated?.discardedTutorResponse),
      },
    });
    console.log(
      `${C.cyan}settings >${C.reset} teaching-style range ${previousTemperature} → ${nextTemperature}; applies to style and part from turn ${state.turns.length + 1}`,
    );
    console.log(
      `${C.dim}  ${nextTemperature < previousTemperature ? 'the next style and part choices will be sharper' : 'the next style and part choices will be broader'}${C.reset}`,
    );
    if (!registerTemperatureApplies(state.register.policy)) {
      console.log(
        `${C.dim}  the current teaching approach, ${plainPolicyLabel(state.register.policy)}, does not use this setting${C.reset}`,
      );
    }
    if (mixedLearner.enabled && latestTutorMessage(state)) {
      startMixedLearnerPrefetch('register_temperature_changed');
      console.log(`${C.dim}  rebuilding the learner suggestion, its analysis, and the next tutor response${C.reset}`);
    }
    console.log();
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

  function executeSlashCommand({ canonicalToken, token: invokedToken = canonicalToken, argument = '', context = {} }) {
    const duringTurn = Boolean(context.duringTurn);
    const command = canonicalToken;
    const commandArg = argument;
    const trimmed = [command, commandArg].filter(Boolean).join(' ');
    if (trimmed === '/quit' || trimmed === '/exit') {
      if (duringTurn) {
        discardPendingInteractiveAuto('exit_requested_during_turn', { source: invokedToken });
        stopInterimAnimation(state);
        concurrentTerminal.close();
        clearStatusLine();
        console.log(`${C.dim}exit requested; stopping this stub now${C.reset}`);
        void stopVoiceBridge('exit_requested_during_turn');
        resetMixedLearnerSuggestion('exit_requested_during_turn');
        finalizeInteractive('exit_requested_during_turn');
        process.exit(0);
      }
      requestExit('exit');
      return true;
    }
    if ((command === '/reset' || command === '/clear') && !commandArg) {
      return resetInteractiveDialogue({ command, duringTurn });
    }
    const pausedInterim = duringTurn ? pauseInterimAnimation(state) : false;
    let slashCommandFinished = false;
    const finishSlashCommand = ({ reprise = true } = {}) => {
      if (slashCommandFinished) return;
      slashCommandFinished = true;
      if (reprise) repriseLatestTutorUtterance(command, { duringTurn });
      if (pausedInterim || (duringTurn && state.interim?.active?.paused)) resumeInterimAnimation(state);
    };
    if (command === '/theme') {
      try {
        const requested = commandArg ? normalizeTutorStubCliThemeId(commandArg, { strict: true }) : null;
        if (requested) {
          const previous = cliPresentation.themeId;
          args.theme = requested;
          configureCliPresentation({
            theme: requested,
            motion: cliPresentation.requestedMotion,
            noColor: args['no-color'],
          });
          state.presentation = tutorStubCliPresentationSnapshot(cliPresentation);
          rl.setPrompt(mixedLearnerPromptText());
          const remembered = persistCurrentInteractiveSettings('terminal_theme_changed');
          appendTraceEvent(state.trace, {
            type: 'terminal_presentation_changed',
            axis: 'theme',
            previous,
            current: requested,
            presentation: state.presentation,
            duringTurn,
          });
          console.log(
            `${C.accent}${C.bold}theme >${C.reset} ${cliPresentation.themeLabel} · ${cliPresentation.themeDescription}`,
          );
          console.log(`${C.dim}  ${tutorStubCliThemePreview(cliPresentation)}${C.reset}`);
          console.log(`${C.dim}  ${remembered ? 'remembered for next time' : 'applies to this session'}${C.reset}\n`);
        } else {
          console.log(
            `${C.accent}${C.bold}themes >${C.reset} ${cliPresentation.themeLabel} is active · /theme <name> switches instantly`,
          );
          for (const option of tutorStubCliThemeOptions()) {
            const marker = option.id === cliPresentation.themeId ? `${C.success}◆${C.reset}` : `${C.border}◇${C.reset}`;
            console.log(
              `  ${marker} ${option.id.padEnd(13)} ${C.bold}${option.label}${C.reset} ${C.dim}— ${option.description}${C.reset}`,
            );
          }
          console.log(`${C.dim}  NO_COLOR and --no-color are always respected${C.reset}\n`);
        }
      } catch (error) {
        console.log(`${C.danger}theme error:${C.reset} ${error.message}\n`);
      }
      finishSlashCommand();
      return true;
    }
    if (command === '/motion') {
      try {
        const requested = commandArg ? normalizeTutorStubCliMotion(commandArg, { strict: true }) : null;
        if (requested) {
          const previous = cliPresentation.requestedMotion;
          args.motion = requested;
          configureCliPresentation({
            theme: cliPresentation.themeId,
            motion: requested,
            noColor: args['no-color'],
          });
          state.presentation = tutorStubCliPresentationSnapshot(cliPresentation);
          const remembered = persistCurrentInteractiveSettings('terminal_motion_changed');
          appendTraceEvent(state.trace, {
            type: 'terminal_presentation_changed',
            axis: 'motion',
            previous,
            current: requested,
            resolved: cliPresentation.motion,
            presentation: state.presentation,
            duringTurn,
          });
          console.log(
            `${C.accent2}${C.bold}motion >${C.reset} ${requested}${
              requested === cliPresentation.motion ? '' : ` → ${cliPresentation.motion} in this terminal`
            }`,
          );
          console.log(
            `${C.dim}  full is fluid · subtle is calm · off is still; auto respects TTY, CI, and reduced-motion signals${remembered ? ' · remembered' : ''}${C.reset}\n`,
          );
        } else {
          console.log(
            `${C.accent2}${C.bold}motion >${C.reset} ${cliPresentation.requestedMotion} selected · ${cliPresentation.motion} active`,
          );
          console.log(`${C.dim}  choose ${TUTOR_STUB_CLI_MOTION_IDS.join(' · ')}${C.reset}\n`);
        }
      } catch (error) {
        console.log(`${C.danger}motion error:${C.reset} ${error.message}\n`);
      }
      finishSlashCommand();
      return true;
    }
    if (command === '/committee') {
      handleCommitteeCommand(commandArg, { duringTurn });
      finishSlashCommand();
      return true;
    }
    if (command === '/details') {
      handleResponseDetailsCommand(commandArg, { duringTurn, source: '/details' });
      finishSlashCommand();
      return true;
    }
    if (command === '/random') {
      handleRandomPerformanceCommand(commandArg, { duringTurn });
      finishSlashCommand();
      return true;
    }
    if (command === '/light') {
      handleLightAdaptationCommand(commandArg, { duringTurn });
      finishSlashCommand();
      return true;
    }
    if (command === '/register' || command === '/character') {
      const barePerformanceControl = !String(commandArg || '').trim();
      const mappedCharacterArgument =
        command !== '/character'
          ? commandArg
          : invokedToken === '/tutor'
            ? ['tutor', commandArg].filter(Boolean).join(' ')
            : invokedToken === '/learner'
              ? ['learner', commandArg].filter(Boolean).join(' ')
              : commandArg;
      const result =
        command === '/character'
          ? handleCharacterCommand(mappedCharacterArgument, { duringTurn })
          : handleExplicitPerformanceDirectiveCommand('register', commandArg, { duringTurn });
      if (result && typeof result.then === 'function') {
        const promise = Promise.resolve(result).then(
          (outcome) => {
            finishSlashCommand({ reprise: !barePerformanceControl && outcome?.suppressReprise !== true });
            return outcome;
          },
          (error) => {
            finishSlashCommand();
            throw error;
          },
        );
        promise.tutorStubBlocksPrompt = !duringTurn;
        return promise;
      }
      finishSlashCommand({ reprise: !barePerformanceControl && result?.suppressReprise !== true });
      return result || true;
    }
    if (command === '/up' || command === '/down' || command === '/feedback') {
      const action =
        command === '/up'
          ? ['up', commandArg].filter(Boolean).join(' ')
          : command === '/down'
            ? ['down', commandArg].filter(Boolean).join(' ')
            : commandArg;
      handleTutorFeedbackCommand(action, { duringTurn });
      finishSlashCommand();
      return true;
    }
    if (command === '/tune') {
      handleTutorTuningCommand(commandArg);
      finishSlashCommand();
      return true;
    }
    if (trimmed === '/help') {
      clearStatusLine();
      printInteractiveHelp(state);
      appendTraceEvent(state.trace, { type: 'interactive_help', turns: state.turns.length, duringTurn });
      if (duringTurn) console.log(`${C.dim}tutor is still thinking; slash commands remain available${C.reset}\n`);
      finishSlashCommand();
      return true;
    }
    if (trimmed === '/status') {
      clearStatusLine();
      printInteractiveStatus();
      appendTraceEvent(state.trace, { type: 'interactive_status', turns: state.turns.length, duringTurn });
      finishSlashCommand();
      return true;
    }
    if (command === '/features') {
      clearStatusLine();
      printTutorStubFeatureMap(state);
      appendTraceEvent(state.trace, {
        type: 'interactive_feature_map',
        turns: state.turns.length,
        duringTurn,
        publicTranscriptChanged: false,
      });
      finishSlashCommand();
      return true;
    }
    if (command === '/lab') {
      clearStatusLine();
      const requested = commandArg.trim();
      const active = state.lab?.id ? getTutorStubLab(state.lab.id) : null;
      if (!requested) {
        console.log(
          `${C.brightCyan}${C.bold}lab >${C.reset} ${active ? `${active.id} · ${active.title}` : 'custom session (no named lab)'}`,
        );
        if (active) {
          console.log(
            `${C.dim}  ${active.audience} · ${active.maturity} · ${active.costClass} cost · ${active.summary}${C.reset}`,
          );
        }
        console.log(`${C.dim}  use /lab list to browse; changing labs requires an explicit relaunch${C.reset}\n`);
      } else if (requested === 'list') {
        console.log(`${C.brightCyan}${C.bold}capability labs${C.reset}`);
        console.log(formatTutorStubLabList());
        console.log('');
      } else {
        const selected = getTutorStubLab(requested);
        if (!selected) {
          console.log(`${C.red}lab error:${C.reset} unknown lab "${requested}"; use /lab list\n`);
        } else {
          console.log(`${C.brightCyan}${C.bold}${selected.title}${C.reset} · ${selected.id}`);
          console.log(
            `${C.dim}  ${selected.audience} · ${selected.maturity} · ${selected.costClass} cost · ${selected.summary}${C.reset}`,
          );
          const admissionFlags =
            selected.id === 'research_controls'
              ? ' --model-call-budget 120 --acknowledge-research-use'
              : selected.id === 'automated_eval'
                ? ' --model-call-budget 120'
                : '';
          console.log(`${C.dim}  relaunch: npm run tutor:stub -- --lab '${selected.id}'${admissionFlags}${C.reset}\n`);
        }
      }
      appendTraceEvent(state.trace, {
        type: 'interactive_lab_catalog',
        requested: requested || null,
        activeLabId: state.lab?.id || null,
        duringTurn,
        publicTranscriptChanged: false,
      });
      finishSlashCommand();
      return true;
    }
    if (command === '/release-notes') {
      clearStatusLine();
      try {
        const releaseNotes = printTutorStubReleaseNotes(commandArg);
        appendTraceEvent(state.trace, {
          type: 'release_notes_popup',
          duringTurn,
          hours: releaseNotes.hours,
          generatedAt: releaseNotes.generatedAt,
          windowStart: releaseNotes.windowStart,
          relevantCommitCount: releaseNotes.relevantCommitCount,
          through: releaseNotes.through
            ? {
                hash: releaseNotes.through.hash,
                shortHash: releaseNotes.through.shortHash,
                subject: releaseNotes.through.subject,
              }
            : null,
          groups: releaseNotes.groups.map((group) => ({
            id: group.id,
            title: group.title,
            commitCount: group.commits.length,
          })),
          publicTranscriptChanged: false,
        });
        if (duringTurn) {
          console.log(
            `${C.dim}tutor is still thinking; release notes reflect the latest completed Git state${C.reset}\n`,
          );
        }
      } catch (error) {
        console.log(`${C.red}release notes error:${C.reset} ${error.message}\n`);
        appendTraceEvent(state.trace, {
          type: 'release_notes_error',
          duringTurn,
          argument: commandArg,
          error: error.message,
          publicTranscriptChanged: false,
        });
      }
      finishSlashCommand();
      return true;
    }
    if (command === '/metrics') {
      clearStatusLine();
      try {
        if (commandArg) throw new Error('/metrics takes no arguments');
        const source = collectSourceMetrics();
        const gitActivity = collectGitActivity();
        const github = process.env.REPOSITORY_METRICS_GITHUB === '0' ? null : collectGitHubMetrics();
        console.log(`${renderReport({ source, gitActivity, github })}\n`);
        appendTraceEvent(state.trace, {
          type: 'repository_metrics_popup',
          duringTurn,
          repositoryFiles: source.repositoryFiles,
          sourceFiles: source.sourceFiles,
          skippedSourceFiles: source.skippedSourceFiles,
          lines: source.totals,
          git: {
            branch: gitActivity.branch,
            commitCount: gitActivity.commitCount,
            latestCommit: gitActivity.latest.sha,
          },
          github,
          publicTranscriptChanged: false,
        });
        if (duringTurn) {
          console.log(
            `${C.dim}tutor is still thinking; metrics reflect the current working tree and available GitHub state${C.reset}\n`,
          );
        }
      } catch (error) {
        console.log(`${C.red}metrics error:${C.reset} ${error.message}\n`);
        appendTraceEvent(state.trace, {
          type: 'repository_metrics_error',
          duringTurn,
          argument: commandArg || null,
          error: error.message,
          publicTranscriptChanged: false,
        });
      }
      finishSlashCommand();
      return true;
    }
    if (command === '/debug') {
      clearStatusLine();
      const parts = commandArg.toLowerCase().split(/\s+/u).filter(Boolean);
      const action = parts[0] || '';
      const requestedFormat = parts[1] || null;
      const validFormat = (value) => value === 'prose' || value === 'technical';
      if (!action) {
        const formatLabel = state.explanatoryDebug?.format === 'technical' ? 'technical details' : 'plain explanation';
        console.log(
          `${C.brightBlue}${C.bold}debug >${C.reset} ${state.explanatoryDebug?.enabled ? 'on' : 'off'} · ${
            formatLabel
          }`,
        );
        console.log(
          `${C.dim}  off shows only the dialogue and compact response line; /debug on adds a short plain explanation; /debug technical shows all diagnostic evidence once${C.reset}\n`,
        );
        finishSlashCommand();
        return true;
      }
      if (action === 'on' && parts.length <= 2 && (!requestedFormat || validFormat(requestedFormat))) {
        const format = requestedFormat || 'prose';
        state.explanatoryDebug.enabled = true;
        state.explanatoryDebug.format = format;
        appendTraceEvent(state.trace, {
          type: 'explanatory_debug_mode_changed',
          enabled: true,
          format,
          duringTurn,
          effectiveTurn: state.turns.length + 1,
        });
        console.log(
          `${C.brightBlue}${C.bold}debug >${C.reset} on · ${format === 'technical' ? 'technical details' : 'plain explanation'}`,
        );
        console.log(
          `${C.dim}  the ${duringTurn ? 'current' : 'next'} completed turn will show ${
            format === 'prose'
              ? 'a short model-written explanation'
              : 'the learner analysis, calculations, and teaching-style decision'
          }${C.reset}\n`,
        );
        finishSlashCommand();
        return true;
      }
      if (action === 'off' && parts.length === 1) {
        state.explanatoryDebug.enabled = false;
        appendTraceEvent(state.trace, {
          type: 'explanatory_debug_mode_changed',
          enabled: false,
          format: state.explanatoryDebug.format || 'prose',
          duringTurn,
          effectiveTurn: state.turns.length + 1,
        });
        console.log(`${C.brightBlue}${C.bold}debug >${C.reset} off`);
        console.log(
          `${C.dim}  automatic explanations stopped; the dialogue and compact response line remain; /debug show is still available${C.reset}\n`,
        );
        finishSlashCommand();
        return true;
      }
      const oneOffFormat =
        action === 'technical' && parts.length === 1
          ? 'technical'
          : action === 'prose' && parts.length === 1
            ? 'prose'
            : (action === 'show' || action === 'once') &&
                parts.length <= 2 &&
                (!requestedFormat || validFormat(requestedFormat))
              ? requestedFormat || 'prose'
              : null;
      if (oneOffFormat) {
        return printExplanatoryDebugTurn(state, { force: true, format: oneOffFormat }).finally(finishSlashCommand);
      }
      console.log(
        `${C.red}debug error:${C.reset} use /debug on [prose|technical], /debug off, /debug show [prose|technical], or /debug technical\n`,
      );
      finishSlashCommand();
      return true;
    }
    if (command === '/coach') {
      discardPendingInteractiveAuto('interaction_mode_changed', { source: invokedToken, announce: true });
      setInteractionMode('coach', { announce: !commandArg });
      if (commandArg) queueCoachGuidance(commandArg, { duringTurn });
      finishSlashCommand();
      return true;
    }
    if (command === '/demo') {
      const promise = runInteractiveDemo(commandArg, { duringTurn, source: 'slash' });
      finishSlashCommand();
      return promise;
    }
    if (command === '/auto') {
      const promise = runInteractiveAutoMode(commandArg, { duringTurn, source: invokedToken });
      finishSlashCommand();
      return promise;
    }
    if (command === '/mode') {
      const [requestedModeRaw = '', ...rest] = commandArg.split(/\s+/u).filter(Boolean);
      const requestedMode = requestedModeRaw.toLowerCase();
      const modeArgument = rest.join(' ');
      if (!requestedMode) {
        clearStatusLine();
        printInteractionModeBanner();
        finishSlashCommand();
        return true;
      }
      if (requestedMode === 'auto') {
        const promise = runInteractiveAutoMode(modeArgument, { duringTurn, source: invokedToken });
        finishSlashCommand();
        return promise;
      }
      if (requestedMode === 'coach') {
        discardPendingInteractiveAuto('interaction_mode_changed', { source: invokedToken, announce: true });
        setInteractionMode('coach', { announce: !modeArgument });
        if (modeArgument) queueCoachGuidance(modeArgument, { duringTurn });
        finishSlashCommand();
        return true;
      }
      if (requestedMode === 'learner' && !modeArgument) {
        discardPendingInteractiveAuto('interaction_mode_changed', { source: invokedToken, announce: true });
        setInteractionMode('learner');
        finishSlashCommand();
        return true;
      }
      clearStatusLine();
      console.log(`${C.red}mode error:${C.reset} use /mode learner, /mode coach [guidance], or /mode auto [turns]\n`);
      finishSlashCommand();
      return true;
    }
    if (command === '/scenario') {
      const promise = chooseAnotherScenario(commandArg, {
        reason: awaitingAnotherScenario ? 'next_scenario_after_closure' : 'scenario_changed_by_user',
        duringTurn,
      }).finally(finishSlashCommand);
      promise.tutorStubBlocksPrompt = true;
      return promise;
    }
    if (command === '/board') {
      const promise = chooseWorkplanModule(commandArg, {
        reason: 'board_item_changed_by_user',
        duringTurn,
      }).finally(finishSlashCommand);
      promise.tutorStubBlocksPrompt = true;
      return promise;
    }
    if (command === '/module') {
      const result = handleCurriculumModuleCommand(commandArg, { duringTurn });
      finishSlashCommand({ reprise: false });
      return result;
    }
    if (command === '/next') {
      const result = handleCurriculumNextCommand(commandArg, { duringTurn });
      finishSlashCommand({ reprise: false });
      return result;
    }
    if (command === '/progress') {
      clearStatusLine();
      const progress = printCurriculumProgress();
      appendTraceEvent(state.trace, {
        type: 'curriculum_progress_popup',
        schema: 'machinespirits.tutor-stub.curriculum-progression.v1',
        moduleId: progress?.currentModule?.id || null,
        phase: progress?.currentPhase || null,
        duringTurn,
        publicTranscriptChanged: false,
        externalCompletionInferred: false,
      });
      finishSlashCommand({ reprise: false });
      return true;
    }
    if (command === '/proof') {
      const promise = handleProofDagCommand(commandArg, { duringTurn }).finally(finishSlashCommand);
      promise.tutorStubBlocksPrompt = !duringTurn;
      return promise;
    }
    if (command === '/settings') {
      const promise = handleDialogueSettings(commandArg, { duringTurn }).finally(finishSlashCommand);
      promise.tutorStubBlocksPrompt = !duringTurn && liveSettingsPickerAvailable();
      return promise;
    }
    if (command === '/transcript' || command === '/html') {
      clearStatusLine();
      const option = commandArg.toLowerCase();
      if (option && !['no-open', 'write'].includes(option)) {
        console.log(`${C.red}transcript error:${C.reset} use ${command} or ${command} no-open\n`);
      } else {
        writeCurrentTranscriptHtml({ launch: !option, duringTurn });
      }
      finishSlashCommand();
      return true;
    }
    if (command === '/voice') {
      const promise = handleVoiceCommand(commandArg, { source: 'slash' }).finally(finishSlashCommand);
      return promise;
    }
    if (command === '/meta') {
      const directorQuestion = commandArg.match(/^ask(?:\s+([\s\S]*))?$/iu);
      if (directorQuestion) {
        const promise = answerCliDirectorQuestion(directorQuestion[1] || '', {
          duringTurn,
          source: `${invokedToken} ask`,
        }).finally(finishSlashCommand);
        promise.tutorStubBlocksPrompt = !duringTurn;
        return promise;
      }
      const result = handleDirectorGuidanceCommand(commandArg, { duringTurn, source: invokedToken });
      finishSlashCommand({ reprise: false });
      return result || true;
    }
    if (command === '/director') {
      const directorQuestion = invokedToken !== '/notes' ? commandArg.match(/^ask(?:\s+([\s\S]*))?$/iu) : null;
      if (directorQuestion) {
        const promise = answerCliDirectorQuestion(directorQuestion[1] || '', {
          duringTurn,
          source: `${invokedToken} ask`,
        }).finally(finishSlashCommand);
        promise.tutorStubBlocksPrompt = !duringTurn;
        return promise;
      }
      if (commandArg && invokedToken !== '/notes') {
        const result = handleDirectorGuidanceCommand(commandArg, { duringTurn, source: invokedToken });
        finishSlashCommand({ reprise: false });
        return result || true;
      }
      clearStatusLine();
      if (commandArg) {
        console.log(`${C.red}director notes error:${C.reset} /notes takes no argument; use /meta <request>\n`);
      } else {
        const notes = printDirectorNotesIssuedSoFar(state);
        appendTraceEvent(state.trace, {
          type: 'director_notes_reprise',
          command,
          duringTurn,
          throughTurn: notes.throughTurn,
          openingIncluded: Boolean(notes.opening),
          releasedNoteCount: notes.releases.length,
          notes,
          publicTranscriptChanged: false,
        });
        if (duringTurn) {
          console.log(
            `${C.dim}tutor is still thinking; future and in-progress director notes remain withheld${C.reset}\n`,
          );
        }
      }
      finishSlashCommand();
      return true;
    }
    if (command === '/analysis' || command === '/a') {
      clearStatusLine();
      const analysisMode = commandArg.toLowerCase();
      const technical = ['technical', 'tech', 'evidence', 'debug'].includes(analysisMode);
      if (analysisMode && !technical) {
        console.log(`${C.red}unknown analysis mode:${C.reset} ${commandArg}`);
        console.log(`${C.dim}  use /analysis or /analysis technical${C.reset}\n`);
      } else {
        printCurrentTurnAnalysis(state, { technical });
      }
      appendTraceEvent(state.trace, {
        type: 'analysis_popup',
        turn: state.turns[state.turns.length - 1]?.turn || null,
        duringTurn,
        mode: technical ? 'technical' : 'plain',
      });
      if (duringTurn) console.log(`${C.dim}tutor is still thinking; showing the latest completed turn${C.reset}\n`);
      finishSlashCommand();
      return true;
    }
    if (trimmed === '/field' || trimmed === '/f') {
      clearStatusLine();
      const field = printLightweightDialogueField(state);
      appendTraceEvent(state.trace, {
        type: 'field_popup',
        turn: state.turns[state.turns.length - 1]?.turn || null,
        duringTurn,
        field,
      });
      if (duringTurn) console.log(`${C.dim}tutor is still thinking; field excludes the in-progress turn${C.reset}\n`);
      finishSlashCommand();
      return true;
    }
    if (trimmed === '/viz' || trimmed === '/v' || trimmed === '/visualization') {
      clearStatusLine();
      const viz = printFieldVisualization(state, { reason: duringTurn ? 'viz_during_turn' : 'viz' });
      appendTraceEvent(state.trace, {
        type: 'field_visualization_popup',
        turn: state.turns[state.turns.length - 1]?.turn || null,
        duringTurn,
        viz: viz
          ? {
              svg: viz.svgDisplayPath,
              json: viz.jsonDisplayPath,
              turnCount: viz.field.turnCount,
            }
          : null,
      });
      if (duringTurn)
        console.log(`${C.dim}tutor is still thinking; visualization excludes the in-progress turn${C.reset}\n`);
      finishSlashCommand();
      return true;
    }
    if (command === '/clarify' || command === '/explain' || command === '/c') {
      return runClarificationCommand(commandArg, { duringTurn }).finally(finishSlashCommand);
    }
    if (command === '/translate') {
      const curriculumView = Boolean(state.curriculum?.module);
      return runCurriculumTranslationCommand(commandArg, { duringTurn }).finally(() =>
        finishSlashCommand({ reprise: curriculumView }),
      );
    }
    if (trimmed === '/report' || trimmed === '/r') {
      clearStatusLine();
      const report = printDialogueCloseout(state, {
        reason: duringTurn ? 'report_during_turn' : 'report',
        trace: state.trace,
      });
      appendTraceEvent(state.trace, {
        type: 'closeout_report_popup',
        turn: state.turns[state.turns.length - 1]?.turn || null,
        duringTurn,
        report,
      });
      if (duringTurn)
        console.log(`${C.dim}tutor is still thinking; closeout excludes the in-progress turn${C.reset}\n`);
      finishSlashCommand();
      return true;
    }
    if (trimmed === '/id' || trimmed === '/turn-id' || trimmed === '/debug-id') {
      clearStatusLine();
      const debug = printCurrentDebugId(state, { duringTurn });
      appendTraceEvent(state.trace, {
        type: 'debug_id_popup',
        turn: state.turns[state.turns.length - 1]?.turn || null,
        duringTurn,
        debug,
      });
      if (duringTurn)
        console.log(`${C.dim}tutor is still thinking; the in-progress trace may still be incomplete${C.reset}\n`);
      finishSlashCommand();
      return true;
    }
    if (trimmed === '/suggest') {
      showMixedLearnerSuggestion({ duringTurn });
      appendTraceEvent(state.trace, {
        type: 'mixed_learner_suggestion_popup',
        turn: mixedLearner.suggestion?.turn || state.turns.length + 1,
        duringTurn,
        ready: Boolean(mixedLearner.suggestion?.text),
        pending: Boolean(mixedLearner.pending),
      });
      finishSlashCommand();
      return true;
    }
    if (command === '/profile') {
      handleMixedLearnerProfileCommand(commandArg, { duringTurn });
      finishSlashCommand();
      return true;
    }
    if (trimmed === '/clue' || trimmed === '/hint') {
      showMixedLearnerClue({ duringTurn });
      appendTraceEvent(state.trace, {
        type: 'mixed_learner_clue_popup',
        turn: mixedLearner.suggestion?.turn || state.turns.length + 1,
        duringTurn,
        ready: Boolean(mixedLearner.suggestion?.clue),
        pending: Boolean(mixedLearner.pending),
      });
      finishSlashCommand();
      return true;
    }
    if (trimmed === '/use' || trimmed === '/accept') {
      acceptMixedLearnerSuggestion({ duringTurn });
      finishSlashCommand();
      return true;
    }
    if (trimmed === '/regen') {
      clearStatusLine();
      if (!mixedLearner.enabled) {
        console.log(`${C.dim}learner suggestions are off; start with --mixed-learner to use /regen${C.reset}\n`);
      } else if (duringTurn) {
        console.log(`${C.dim}tutor is still thinking; /regen is available after the tutor responds${C.reset}\n`);
      } else {
        startMixedLearnerPrefetch('regen', { force: true });
        console.log(`${C.dim}rebuilding the learner clue and suggestion${C.reset}\n`);
      }
      finishSlashCommand();
      return true;
    }
    clearStatusLine();
    console.log(`${C.red}unknown command:${C.reset} ${trimmed}${C.dim} · type / to browse or use /help${C.reset}\n`);
    appendTraceEvent(state.trace, { type: 'unknown_slash_command', command: trimmed, duringTurn });
    finishSlashCommand();
    return true;
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
