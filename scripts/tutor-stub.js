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
 * Edit the STUB defaults or the opening runtime prompt builder, then run:
 *   npm run tutor:stub
 *   npm run tutor:stub -- --model openai.mini
 *   npm run tutor:stub -- --model openrouter.sonnet-5
 *   npm run tutor:stub -- --model claude-code.sonnet
 */

import 'dotenv/config';

import fs from 'node:fs';
import path from 'node:path';
import { emitKeypressEvents } from 'node:readline';

import { stdin as input, stdout as output } from 'node:process';
import { fileURLToPath } from 'node:url';

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
  projectTutorStubPublicWorldSummary as publicWorldSummary,
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
import { tutorStubCurriculumBundle } from '../services/curriculum/tutorStubCurriculum.js';
import {
  createTutorStubCurriculumRuntime,
  tutorStubCurriculumPrivatePrompt,
  tutorStubCurriculumPublicProjection,
} from '../services/curriculum/tutorStubCurriculumRuntime.js';

import {
  TUTOR_STUB_CURRICULUM_TRANSLATOR_SYSTEM_PROMPT,
  TUTOR_STUB_TUTOR_OUTPUT_TRANSLATOR_SYSTEM_PROMPT,
  buildTutorStubCurriculumTranslationPrompt,
  buildTutorStubTutorOutputTranslationPrompt,
  parseTutorStubCurriculumTranslation,
  parseTutorStubTutorOutputTranslation,
} from '../services/tutorStubCurriculumTranslation.js';

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
} from '../services/tutorStubPromptBlocks.js';

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
  learnerProfileIds,
  learnerProfileListText,
  learnerProfilePrompt,
  learnerProfileSpeakerLabel,
} from './tutor-stub-learner-profile-contracts.js';
import {
  TUTOR_STUB_LEARNER_RESPONSE_PROVENANCE_SCHEMA,
  createTutorStubLearnerResponseProvenance,
} from '../services/tutorStubLearnerResponseProvenance.js';
import { buildTutorStubTurnFailureTraceEvents } from '../services/tutorStubTurnFailureBackfill.js';
import { launchTutorStubTranscriptHtml } from '../services/tutorStubTranscriptHtml.js';
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
} from '../services/tutorStubLearningSummary.js';
import {
  tutorStubDisplayDiagnosticLabel as displayDiagnosticLabel,
  tutorStubPlainSettingName as plainSettingName,
  tutorStubPlainStrategyText as plainStrategyText,
} from '../services/tutorStubResponseDetails.js';
import {
  createTutorStubInterimController,
  createTutorStubInterimState as createInterimState,
  formatTutorStubSignedInterimNumber as formatSignedInterimNumber,
  resolveTutorStubInterimState as getInterimState,
} from '../services/tutorStubInterimController.js';
import { createTutorStubLearnerEvidenceRuntime } from '../services/tutorStubLearnerEvidenceRuntime.js';
import { createTutorStubLearnerAnalysisRuntime } from '../services/tutorStubLearnerAnalysisRuntime.js';
import { createTutorStubPublicPresentationRuntime } from '../services/tutorStubPublicPresentationRuntime.js';
import { createTutorStubDebugReportRuntime } from '../services/tutorStubDebugReportRuntime.js';
import { createTutorStubLaunchSummaryPresentation } from '../services/tutorStubLaunchSummaryPresentation.js';
import { createTutorStubAutomatedLearnerGenerationRuntime } from '../services/tutorStubAutomatedLearnerGenerationRuntime.js';
import { createTutorStubTypedActionPlanningRuntime } from '../services/tutorStubTypedActionPlanningRuntime.js';
import { createTutorStubClarificationTranslationRuntime } from '../services/tutorStubClarificationTranslationRuntime.js';
import { createTutorStubOpeningRuntime } from '../services/tutorStubOpeningRuntime.js';
import { createTutorStubPromptTransport } from '../services/tutorStubPromptTransport.js';
import { createTutorStubRecoveryAccountingRuntime } from '../services/tutorStubRecoveryAccountingRuntime.js';
import { createTutorStubInteractiveApplicationComposition } from '../services/tutorStubInteractiveApplicationComposition.js';
import { createTutorStubInteractiveCommandComposition } from '../services/tutorStubInteractiveCommandComposition.js';
import {
  listTutorStubTutorInstances,
  resolveTutorStubTutorInstance,
  tutorStubTutorInstancePrompt,
} from '../services/tutorStubTutorInstance.js';
import {
  TUTOR_STUB_FEEDBACK_REASONS,
  createTutorStubTuningRuntime,
  listTutorStubTuningCandidates,
  normalizeTutorStubTuningMode,
  recordTutorStubTuningFeedback,
  tutorStubTuningPrompt,
  tutorStubTuningSnapshot,
  tutorStubTuningTurnAdvisory,
} from '../services/tutorStubTuning.js';
import {
  DEFAULT_TUTOR_STUB_VOICE_MODEL,
  DEFAULT_TUTOR_STUB_VOICE_NAME,
  normalizeTutorStubVoiceModel,
  normalizeTutorStubVoiceName,
} from '../services/tutorStubVoiceBridge.js';
import { copyTutorStubTextToClipboard, formatTutorStubDebugClipboardText } from '../services/tutorStubClipboard.js';
import {
  createTutorStubTurnFeedbackState,
  tutorStubTurnFeedbackArrowRating,
  tutorStubTurnFeedbackEscapeDismissal,
  tutorStubTurnFeedbackEnvelope,
  tutorStubTurnFeedbackPrompt,
  tutorStubTurnFeedbackRegisterPrompt,
} from '../services/tutorStubTurnFeedback.js';
import {
  auditTutorStubFeedbackAdaptation,
  buildTutorStubFeedbackAdaptationPlan,
  buildTutorStubFeedbackObservation,
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
  compactTutorStubPublicMessagesForBudget,
  createCompactTutorStubPublicTranscriptForPrompt,
  latestTutorStubMessage as latestTutorMessage,
  tutorStubTutorMessageContext as tutorMessageContext,
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
} from '../services/tutorStubTrainingReuse.js';

import { createTutorStubModelSelection } from '../services/tutorStubModelChoicePresentation.js';
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
  projectTutorStubHumanDiscourseContext as humanDiscourseTutorContext,
  projectTutorStubLearnerClassifierContext as classifierTutorContext,
  projectTutorStubLearnerDagModelContext as tutorLearnerDagModelContext,
  tutorPromptSurfaceKey,
} from '../services/tutorStubTutorPromptContext.js';
import { createTutorStubLearnerDagState as createLearnerDagState } from '../services/tutorStubLearnerDagState.js';

import {
  createTutorStubDirectorGuidanceState,
  restoreTutorStubDirectorGuidanceState as restoreDirectorGuidanceState,
  tutorStubDirectorGuidanceEntry,
  tutorStubDirectorGuidancePrompt,
} from '../services/tutorStubDirectorGuidance.js';

import {
  assertTutorStubCapabilityCompatibility,
  resolveTutorStubCapabilities,
} from '../services/tutorStubCapabilities.js';
import {
  assertTutorStubLabRequirements,
  createTutorStubModelCallBudget,
  formatTutorStubLabList,
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
  createTutorStubCliPresentation,
  normalizeTutorStubCliMotion,
  normalizeTutorStubCliThemeId,
  tutorStubCliPresentationSnapshot,
} from '../services/tutorStubCliTheme.js';

import { normalizeTutorStubLaunchMode } from '../services/tutorStubLaunchMode.js';

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
  extractCommitteeSpanV1,
  extractCuePreservingCommitteeSpanV2,
  resolveCueBlindCommitteeDelivery,
  runCommitteeBattery,
  runCueBlindCommitteeBattery,
  selectCommitteeCompositionQuestion,
  trimCommitteeFallback,
} from '../services/program2CommitteeEngine.js';
import { createProgram2ProviderBudgetFromEnvironment } from '../services/program2ExperimentSafety.js';
import {
  DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD,
  TUTOR_STUB_REGISTER_POLICY_COMPOSITION_SCHEMA,
  evaluateTutorStubRegisterPolicyOverlay,
  normalizeTutorStubRegisterOverlayThreshold,
  parseTutorStubRegisterPolicyStack,
  tutorStubRegisterPolicyStackId,
} from '../services/tutorStubRegisterPolicyComposition.js';
import { sampleTutorStubPolicyDistribution } from '../services/tutorStubPolicySampler.js';
import { captureGitProvenanceSummary, hashCanonicalJson } from '../services/experimentRunArtifacts.js';
import { buildTutorStubStateObservation } from '../services/adaptiveTutor/tutorStubStateAdapter.js';
import { createScaffoldLifecycle, SCAFFOLD_LIFECYCLE_SCHEMA } from '../services/adaptiveTutor/scaffoldLifecycle.js';
import {
  createTutorStubTutorTurnPipeline,
  TUTOR_STUB_SPEAKER_GATED_BLOCK_IDS,
} from '../services/tutorStubTutorTurnPipeline.js';
import { createTutorStubTraceRuntime } from '../services/tutorStubTraceRuntime.js';
import { createTutorStubLearningSummaryRuntime } from '../services/tutorStubSessionOrchestration.js';
import { createTutorStubSessionStateRuntime } from '../services/tutorStubSessionStateRuntime.js';
import { createTutorStubResponsePolicy } from '../services/tutorStubResponsePolicy.js';
import { createTutorStubTurnOrchestration } from '../services/tutorStubTurnOrchestration.js';
import { parseTutorStubCliArguments } from '../services/tutorStubCliArguments.js';
import { createTutorStubLaunchRuntime } from '../services/tutorStubLaunchRuntime.js';
import { createTutorStubLaunchApplicationContext } from '../services/tutorStubLaunchApplicationContext.js';
import { createTutorStubApplicationTraceContext } from '../services/tutorStubApplicationTraceContext.js';
import { createTutorStubApplicationState } from '../services/tutorStubApplicationState.js';
import { runTutorStubNonInteractiveApplication } from '../services/tutorStubNonInteractiveApplication.js';
import { runTutorStubLaunchPresentation } from '../services/tutorStubLaunchPresentation.js';
import { createTutorStubSessionApplicationContext } from '../services/tutorStubSessionApplicationContext.js';
import { createTutorStubSessionApplicationRuntime } from '../services/tutorStubSessionApplicationRuntime.js';
import { createTutorStubScenarioController } from '../services/tutorStubScenarioController.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORLD_DIR = path.join(ROOT, 'config/drama-derivation');
const UNSUPPORTED_CODEX_MINI_REFS = new Set(['codex.mini', 'codex.gpt-mini', 'codex.gpt-5-mini']);
const NEGATIVE_FLOOR_REGISTERS = ['ironic', 'sarcastic', 'face_threat'];
const DAG_MODES = ['strict_dag', 'human_scaffold', 'defeasible_human_scaffold'];
const HUMAN_DISCOURSE_FRAME_SCHEMA = 'machinespirits.tutor-stub.human-discourse-frame.v1';
const TUTOR_GUARD_ACCOUNTING_SCHEMA = 'machinespirits.tutor-stub.guard-accounting.v1';
const TUTOR_TYPED_ACTION_CONFIG_SCHEMA = 'machinespirits.tutor-stub.typed-action-runtime-config.v1';
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

const tutorStubRecipeModelIdentity = createTutorStubRecipeModelIdentityResolver({
  resolveModel,
  getProviderConfig,
  visibleResolvedModel,
});

const {
  buildTutorDagSnapshot,
  printInteractiveHelp,
  printTutorDagSnapshot,
  printTutorStubFeatureMap,
  printTutorStubReleaseNotes,
  printHelp,
} = createTutorStubPublicPresentationRuntime({
  C,
  DEFAULT_INTERACTIVE_DEMO_TURNS,
  PROGRAM2_COMMITTEE_DEFAULTS,
  ROOT,
  STUB,
  committedReleaseRows,
  nextReleaseRow,
  writeLine: (...values) => console.log(...values),
});

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

const compactPublicTranscriptForPrompt = createCompactTutorStubPublicTranscriptForPrompt({
  defaultHistoryTurns: STUB.historyTurns,
});

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

const { callPromptModel, createConsoleTokenSink, printTutorResponse } = createTutorStubPromptTransport({
  C,
  appendTraceEvent,
  auditTutorStubPrompt,
  callAI,
  callAIWithCliBridge,
  clearStatusLine,
  compactTutorStubPublicMessagesForBudget,
  createTutorStubConsoleTokenSink,
  effectiveTemperatureForModel,
  getInterimState,
  isCliProvider,
  providerSupportsStreaming,
  recoverTutorStubDuplicateInstructionLines,
  renderTutorStubStreamLabel,
  replayTutorStubTextAsConsoleStream,
  reserveProgram2ProviderBudget,
  reserveTutorStubMeteredModelCall,
  stopInterimAnimation,
  streamAI,
  tutorStubCliPolicyRetryDecision,
  tutorStubPromptSurfaceForRole,
  write: (text) => process.stdout.write(text),
});

const {
  attachTutorGuardAccounting,
  buildTutorGuardAccounting,
  tutorGuardAttemptEnvelope,
  tutorResponseRecoveryPrompt,
} = createTutorStubRecoveryAccountingRuntime({
  TUTOR_GUARD_ACCOUNTING_SCHEMA,
  appendTraceEvent,
  jsonClone,
  projectTutorStubGuardAttemptEnvelope,
  tutorStubGuardIssueRows,
});

const {
  CURRICULUM_MODULE_PROMPT_END,
  CURRICULUM_MODULE_PROMPT_START,
  CURRICULUM_PHASE_PROMPT_END,
  CURRICULUM_PHASE_PROMPT_START,
  buildDirectorInitialContext,
  buildTutorOpening,
  directorNotesIssuedSoFar,
  loadSystemPrompt,
  printDirectorNotesIssuedSoFar,
  printDirectorPreludeBeforeFirstTutor,
} = createTutorStubOpeningRuntime({
  C,
  TUTOR_STUB_OPENING_REQUIREMENTS,
  appendTraceEvent,
  args,
  auditTutorResponseLeak,
  auditTutorStubOpening,
  auditTutorStubSpeakerPrivilege,
  buildTutorStubDirectorInitialContext,
  buildTutorStubOpeningFrame,
  callPromptModel,
  cleanTutorStubStageSpeech,
  committedReleaseRows,
  contractLicenceEnabled: process.env.TUTOR_STUB_CONTRACT_LICENCE === '1',
  createTutorStubDirectorNotesModel,
  createTutorStubPromptBlockModel,
  currentReleaseRows,
  delimitedPrompt,
  deterministicTutorStubOpening,
  dramaticAudiencePromptLines,
  fs,
  projectTutorStubDirectorContextLines,
  projectTutorStubDirectorNotesLines,
  projectTutorStubWorldPublicPrompt,
  projectTutorStubWorldSpeakerDagPrompt,
  startInterimAnimation,
  stopInterimAnimation,
  tutorStubOpeningPrompt,
  tutorStubOpeningSystemPrompt,
  worldFlavourPhrase,
  worldLedgerTerm,
});

const { generateTutorClarification, generateTutorStubCurriculumTranslation, generateTutorStubTutorOutputTranslation } =
  createTutorStubClarificationTranslationRuntime({
    CLARIFIER_SYSTEM_PROMPT,
    TUTOR_STUB_CURRICULUM_TRANSLATOR_SYSTEM_PROMPT,
    TUTOR_STUB_TUTOR_OUTPUT_TRANSLATOR_SYSTEM_PROMPT,
    buildTutorStubCurriculumTranslationPrompt,
    buildTutorStubTutorOutputTranslationPrompt,
    callPromptModel,
    cleanTutorStubClarificationSpeech,
    compactPublicTranscriptForPrompt,
    latestTutorMessage,
    parseTutorStubCurriculumTranslation,
    parseTutorStubTutorOutputTranslation,
    publicWorldSummary,
    tutorStubComprehensionPrompt,
  });

const {
  automatedLearnerCorruptionEnabled,
  automatedLearnerProfileId,
  buildMixedLearnerArtifactsPrompt,
  deterministicAutomatedLearnerFallback,
  enforceAutomatedLearnerProfile,
  generateAutomatedLearnerTurn,
  generateMixedLearnerArtifacts,
  mixedLearnerArtifactsSystemPrompt,
  resolveAutomatedLearnerProfile,
} = createTutorStubAutomatedLearnerGenerationRuntime({
  appendTraceEvent,
  callPromptModel,
  classificationFromCombinedAnalysis: (...values) => classificationFromCombinedAnalysis(...values),
  extractCombinedLearnerAnalysis: (...values) => extractCombinedLearnerAnalysis(...values),
  learnerProfileContract,
  learnerProfileIds,
  learnerProfilePrompt,
  negativeFloorRegisters: NEGATIVE_FLOOR_REGISTERS,
});

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

const {
  printCurrentTurnAnalysis,
  printDialogueCloseout,
  printExplanatoryDebugTurn,
  printFieldVisualization,
  printLightweightDialogueField,
  printResponseDetails,
  recordTutorStubTurnTiming,
  writeFieldVisualization,
} = createTutorStubDebugReportRuntime({
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
  writeLine: (...values) => console.log(...values),
});

const { printTutorStubLaunchSummary } = createTutorStubLaunchSummaryPresentation({
  C,
  ROOT,
  getCliPresentation: () => cliPresentation,
  output,
  traceDisplayPath,
  writeLine: (...values) => console.log(...values),
});

const { closePriorTypedAction, planTypedAction, tutorDialogueClosureFrameForTurn } =
  createTutorStubTypedActionPlanningRuntime({
    C,
    answerTermForWorld,
    appendTraceEvent,
    buildTutorDagSnapshot,
    currentReleaseRows,
    explicitPerformanceActorialPartSelection,
    explicitPerformanceDirectiveValue,
    jsonClone,
    policySamplingContext,
    randomPerformanceActorialPartSelection,
    registerTemperatureApplies,
    stateRunDebugId,
    writeLine: (...values) => console.log(...values),
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

function registerTemperatureApplies(policy) {
  return REGISTER_TEMPERATURE_POLICIES.has(String(policy || ''));
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
  resolveCueBlindCommitteeDelivery,
  resolveTutorStubPublicCounterpressure,
  runCommitteeBattery,
  runCueBlindCommitteeBattery,
  sanitizeTutorStubSpeakerAdvisory,
  extractCommitteeSpanV1,
  extractCuePreservingCommitteeSpanV2,
  selectCommitteeCompositionQuestion,
  snapshotTutorStubPublicPremiseIds,
  speakerAdvisoryBlocks: SPEAKER_ADVISORY_BLOCKS,
  styleGuardsAdvisory: process.env.TUTOR_STUB_STYLE_GUARDS_ADVISORY === '1',
  guardBoundaryPolicy: process.env.TUTOR_STUB_GUARD_POLICY === 'shadow_advisory' ? 'shadow_advisory' : 'strict',
  // Q3: TUTOR_STUB_CORRUPT_RELIEF=1 demotes ALL hard guard issues to
  // advisory at deliberately-corrupted turns so the model's repair ships.
  corruptReliefTurn: (turn) => process.env.TUTOR_STUB_CORRUPT_RELIEF === '1' && automatedLearnerCorruptionEnabled(turn),
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

  const launchApplicationContext = await createTutorStubLaunchApplicationContext({
    C,
    DEFAULT_INTERACTIVE_COMMITTEE_FALLBACK_POLICY,
    MAX_TUTOR_STUB_RELEASE_SPEED,
    MIN_TUTOR_STUB_RELEASE_SPEED,
    ROOT,
    SCAFFOLD_LIFECYCLE_SCHEMA,
    STUB,
    TUTOR_STUB_DAG_FACT_DROPOUT_SCHEMA,
    TUTOR_TYPED_ACTION_CONFIG_SCHEMA,
    applyRememberedInteractiveDefaults,
    args,
    assertSupportedModelRefs,
    buildDirectorInitialContext,
    commaSeparatedStrings,
    commandLineOptionProvided,
    configureCliPresentation,
    createTutorStubCurriculumRuntime,
    input,
    normalizeDagMode,
    normalizeTutorStubCliMotion,
    normalizeTutorStubCliThemeId,
    normalizeTutorStubDagFactDropoutRate,
    normalizeTutorStubDagFactDropoutSeed,
    normalizeTutorStubEngagementStanceTemperature,
    normalizeTutorStubLightAdaptationThreshold,
    normalizeTutorStubLoopMode,
    normalizeTutorStubPointOfActionArm,
    normalizeTutorStubReleaseSpeed,
    normalizeTutorStubTuningMode,
    normalizeTutorStubVoiceModel,
    normalizeTutorStubVoiceName,
    output,
    parseAutoTurns,
    parseNumber,
    parseOptionalBoundedInt,
    parsePositiveInt,
    pickInitialScenarioWithKeyboard,
    positionals,
    rememberedSettingExplicitSources,
    resolveAutomatedLearnerProfile,
    resolveTutorStubTutorInstance,
    resolveWorldRef,
    resumeRequested,
    tutorStubCurriculumBundle,
  });
  if (!launchApplicationContext) return;
  const interactiveCallbacks = {};
  const {
    autoLearnerEnabled,
    autoSafetyTurns,
    autoStopOnGrounded,
    autoTurns,
    curriculumBundle,
    curriculumRuntime,
    dagFactDropoutRate,
    dagFactDropoutSeed,
    dagMode,
    directorContext,
    effectiveTopic,
    existingScenarioAvailable,
    experimentRepeat,
    experimentRunSeed,
    explicitRememberedSources,
    initialScenarioKeyboardMenuActive,
    initialScenarioPickerEnabled,
    initialScenarioSelection,
    interactiveSessionEnabled,
    interactiveSessionIntent,
    launchWorldBundle,
    learnerModelRequired,
    learnerSuggestionEnabled,
    lightAdaptationEnabled,
    mixedLearnerEnabled,
    multipleChoiceEnabled,
    observedAuditsEnabled,
    openingRealizer,
    passthroughEnabled,
    pointOfActionArm,
    registerTemperature,
    releaseSpeed,
    rememberedScenarioAvailable,
    rememberedSettings,
    responseDetailsEnabled,
    temperature,
    tuningMode,
    turnFeedbackEnabled,
    tutorInstance,
    typedActionConfig,
    voiceLaunchRequested,
    worldBundle,
  } = launchApplicationContext;

  const sessionApplicationContext = createTutorStubSessionApplicationContext({
    CURRICULUM_PHASE_PROMPT_END,
    CURRICULUM_PHASE_PROMPT_START,
    DEFAULT_INTERACTIVE_DEMO_TURNS,
    DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_RATE,
    DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
    DEFAULT_TUTOR_STUB_RELEASE_SPEED,
    MAX_INTERACTIVE_DEMO_TURNS,
    MAX_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
    MAX_TUTOR_STUB_RELEASE_SPEED,
    MIN_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
    MIN_TUTOR_STUB_RELEASE_SPEED,
    ROOT,
    STUB,
    TUTOR_STUB_FEEDBACK_REASONS,
    TUTOR_STUB_LEARNER_DAG_PREFLIGHT_SCHEMA,
    TUTOR_STUB_LEARNER_RESPONSE_PROVENANCE_SCHEMA,
    TUTOR_STUB_OPENING_REQUIREMENTS,
    TUTOR_STUB_SESSION_RUNTIME_SCHEMA,
    args,
    assertTutorStubCapabilityCompatibility,
    assertTutorStubResumeCompatibility,
    auditTutorStubPrompt,
    auditTutorStubSpeakerPrivilege,
    autoLearnerEnabled,
    autoSafetyTurns,
    autoStopOnGrounded,
    autoTurns,
    automatedLearnerProfileId,
    buildHumanDiscourseFrame,
    buildHumanDiscourseRunConfig,
    buildRegisterPalette,
    buildTutorDesireDag,
    buildTutorStubOpeningFrame,
    buildTutorStubSessionRecipe,
    compareTutorStubResumeRecipe,
    createTutorStubDialogueClosureLifecycle,
    createTutorStubTuningRuntime,
    curriculumBundle,
    curriculumRuntime,
    dagFactDropoutRate,
    dagFactDropoutSeed,
    dagMode,
    delimitedPrompt,
    effectiveTemperatureForModel,
    effectiveTopic,
    existingScenarioAvailable,
    experimentRepeat,
    experimentRunSeed,
    explicitRememberedSources,
    fs,
    getProviderConfig,
    hashCanonicalJson,
    initialScenarioKeyboardMenuActive,
    initialScenarioPickerEnabled,
    initialScenarioSelection,
    interactiveSessionEnabled,
    interactiveSessionIntent,
    launchWorldBundle,
    learnerModelRequired,
    lightAdaptationEnabled,
    loadRegisterEmpiricalPrior,
    loadSystemPrompt,
    loadedRecipeApplication,
    loadedSessionRecipe,
    mixedLearnerEnabled,
    multipleChoiceEnabled,
    normalizeCliEffort,
    normalizeTutorStubEvidenceUseRubric,
    normalizeTutorStubHumanSubjectClass,
    normalizeTutorStubPublicLearnerAnalysisPromptProfile,
    normalizeTutorStubRegisterOverlayThreshold,
    normalizeTutorStubTrainingReuseSetting,
    observedAuditsEnabled,
    openingRealizer,
    parseTutorStubRegisterPolicyStack,
    passthroughEnabled,
    path,
    pointOfActionArm,
    positionals,
    providerSupportsEventStreaming,
    providerSupportsStreaming,
    rawCommandLineOptionProvided,
    registerTemperature,
    registerTemperatureApplies,
    releaseSpeed,
    rememberedScenarioAvailable,
    rememberedSettings,
    resolveModel,
    resolveTutorStubCapabilities,
    resolveTutorStubCharacterChoice,
    resolveTutorStubTrainingReuse,
    resolveWorkspacePath,
    resolvedHumanSubjectClassSource,
    resolvedResumeSource,
    resolvedTrainingReuseSource,
    responseDetailsEnabled,
    resumeRecipeApplication,
    resumeRequested,
    selectedLabAdmission,
    selectedLabResolution,
    temperature,
    tuningMode,
    turnFeedbackEnabled,
    tutorInstance,
    tutorStubCurriculumPrivatePrompt,
    tutorStubLabTraceMetadata,
    tutorStubPointOfActionStandingBook,
    tutorStubPromptArchitecture,
    tutorStubRecipeModelIdentity,
    tutorStubTuningPrompt,
    tutorStubTutorInstancePrompt,
    visibleResolvedModel,
    voiceLaunchRequested,
    worldBundle,
  });
  let {
    autoLearnerProviderConfig,
    autoLearnerResolved,
    learnerRecordResolved,
    visibleAutoLearnerModel,
    visibleClassifierConfig,
    visibleClassifierModel,
    visibleLearnerRecordModel,
    visibleModel,
  } = sessionApplicationContext;
  const {
    classifierEnabled,
    cliEffort,
    closeoutReportEnabled,
    combinedLearnerAnalysisEnabled,
    continuousUnsafeRegisterAnchorsEnabled,
    dialogueClosureConfig,
    initialDropoutPromptEnabled,
    initialMixedLearnerSetupEnabled,
    initialProfilePromptEnabled,
    initialReleaseSpeedPromptEnabled,
    initialTemperaturePromptEnabled,
    instantExistingScenarioOpening,
    learningSummaryReportConfig,
    openingEnabled,
    registerEmpiricalPrior,
    registerOverlayThreshold,
    registerPalette,
    registerPolicy,
    registerPolicyOverlays,
    registerSelectionEnabled,
    responseDetailsConfig,
    traceDir,
    tutorLearnerDagEnabled,
  } = sessionApplicationContext;

  const launchPresentationResult = runTutorStubLaunchPresentation({
    launchApplicationContext,
    sessionApplicationContext,
    C,
    ROOT,
    TUTOR_STUB_DIAGNOSTIC_COLLECTION_MODE,
    TUTOR_STUB_LIGHT_ADAPTATION_SCHEMA,
    TUTOR_STUB_SESSION_RUNTIME_SCHEMA,
    TUTOR_STUB_SESSION_RUNTIME_VERSION,
    args,
    automatedLearnerProfileId,
    cliPresentation,
    isCliProvider,
    loadedSessionRecipe,
    loadedSessionRecipePath,
    output,
    providerSupportsEventStreaming,
    providerSupportsStreaming,
    resolveWorkspacePath,
    resumeRequested,
    tutorStubCliPresentationSnapshot,
    tutorStubTuningSnapshot,
    writeTutorStubSessionRecipe,
  });
  loadedSessionRecipePath = launchPresentationResult.loadedSessionRecipePath;
  const { loadedRecipeProvenance } = launchPresentationResult;
  if (launchPresentationResult.completed) return;
  const { interim, trace } = createTutorStubApplicationTraceContext({
    launchApplicationContext,
    sessionApplicationContext,
    ROOT,
    TUTOR_STUB_DIAGNOSTIC_COLLECTION_MODE,
    TUTOR_STUB_LIGHT_ADAPTATION_SCHEMA,
    appendTraceEvent,
    args,
    automatedLearnerProfileId,
    cliPresentation,
    createInterimState,
    createTraceState,
    loadedRecipeProvenance,
    loadedSessionRecipePath,
    output,
    providerSupportsEventStreaming,
    providerSupportsStreaming,
    resumeRequested,
    tutorStubCliPresentationSnapshot,
    tutorStubTuningSnapshot,
  });

  const state = createTutorStubApplicationState({
    launchApplicationContext,
    sessionApplicationContext,
    PROGRAM2_COMMITTEE_DEFAULTS,
    TUTOR_STUB_DIAGNOSTIC_COLLECTION_MODE,
    TUTOR_STUB_LIGHT_ADAPTATION_SCHEMA,
    args,
    automatedLearnerProfileId,
    cliPresentation,
    createLearnerDagState,
    createScaffoldLifecycle,
    createTutorStubComprehensionState,
    createTutorStubDirectorGuidanceState,
    createTutorStubReleasePacingState,
    createTutorStubTurnFeedbackState,
    interim,
    loadedRecipeProvenance,
    rememberedSettings,
    safeTimestampForFile,
    trace,
    tutorStubCliPresentationSnapshot,
  });

  const {
    forgetRememberedInteractiveSettings,
    persistCurrentInteractiveSettings,
    resumedDialogue,
    sessionRuntime,
    writeFinalLearningSummary,
  } = createTutorStubSessionApplicationRuntime({
    launchApplicationContext,
    sessionApplicationContext,
    C,
    DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_RATE,
    DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
    DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD,
    DEFAULT_TUTOR_STUB_RELEASE_SPEED,
    ROOT,
    STUB,
    TUTOR_STUB_LEARNING_SUMMARY_HTML_SCHEMA,
    appendTraceEvent,
    args,
    buildDialogueLearningSummary,
    clearStatusLine,
    clearTutorStubLastSettings,
    createTutorStubCommandHandlers,
    createTutorStubLearningSummaryRuntime,
    createTutorStubSessionRuntime,
    createTutorStubSessionStateRuntime,
    executeSlashCommand: (...parameters) => interactiveCallbacks.executeSlashCommand(...parameters),
    getCliPresentation: () => cliPresentation,
    jsonClone,
    launchTutorStubTranscriptHtml,
    listTutorStubTuningCandidates,
    output,
    performInteractiveDialogueReset: (...parameters) =>
      interactiveCallbacks.performInteractiveDialogueReset(...parameters),
    performInteractiveFinalize: (...parameters) => interactiveCallbacks.performInteractiveFinalize(...parameters),
    printTutorStubLaunchSummary,
    rememberedSettings,
    restoreDialogueFromTrace,
    restoreTutorStubReleasePacingFromTurns,
    resumeRequested,
    routeLearnerText: (...parameters) => interactiveCallbacks.routeLearnerText(...parameters),
    state,
    trace,
    traceDisplayPath,
    tutorStubCurriculumPublicProjection,
    tutorStubRegisterPolicyStackId,
    tutorStubTuningSnapshot,
    writeTutorStubLastSettings,
    writeTutorStubLearningSummaryHtml,
  });

  const nonInteractiveCompleted = await runTutorStubNonInteractiveApplication({
    launchApplicationContext,
    sessionApplicationContext,
    C,
    analyzeLearnerTurn,
    appendTraceEvent,
    appendTutorStubTurnFailureTraceRecords,
    args,
    automaticTechnicalDetailsEnabled,
    buildTutorInterimContext,
    createTutorStubLearnerResponseProvenance,
    printDialogueCloseout,
    printDirectorPreludeBeforeFirstTutor,
    printExplanatoryDebugTurn,
    printResponseDetails,
    printTutorDagSnapshot,
    printTutorResponse,
    runAutomatedLearnerDialogue,
    runOneTurn,
    saveTranscript,
    startInterimAnimation,
    state,
    stopInterimAnimation,
    traceDisplayPath,
    tutorStubComprehensionSnapshot,
    tutorStubDagFactDropoutSnapshot,
    tutorStubRegisterPolicyStackId,
    writeFieldVisualization,
    writeFinalLearningSummary,
  });
  if (nonInteractiveCompleted) return;
  function setInteractiveModelBinding(name, value) {
    if (name === 'visibleModel') visibleModel = value;
    else if (name === 'classifierResolved') sessionApplicationContext.classifierResolved = value;
    else if (name === 'classifierProviderConfig') sessionApplicationContext.classifierProviderConfig = value;
    else if (name === 'visibleClassifierModel') visibleClassifierModel = value;
    else if (name === 'learnerRecordResolved') learnerRecordResolved = value;
    else if (name === 'learnerRecordProviderConfig') sessionApplicationContext.learnerRecordProviderConfig = value;
    else if (name === 'visibleLearnerRecordModel') visibleLearnerRecordModel = value;
    else if (name === 'autoLearnerResolved') autoLearnerResolved = value;
    else if (name === 'autoLearnerProviderConfig') autoLearnerProviderConfig = value;
    else if (name === 'visibleAutoLearnerModel') visibleAutoLearnerModel = value;
    else if (name === 'visibleClassifierConfig') visibleClassifierConfig = value;
    else throw new Error('unknown model binding: ' + name);
  }

  const interactiveCompositionDependencies = {
    C,
    CURRICULUM_MODULE_PROMPT_END,
    CURRICULUM_MODULE_PROMPT_START,
    CURRICULUM_PHASE_PROMPT_END,
    CURRICULUM_PHASE_PROMPT_START,
    CUSTOM_LEARNER_PROFILE_EXAMPLE,
    DEFAULT_INTERACTIVE_DEMO_TURNS,
    EXPLICIT_PERFORMANCE_CLEAR_WORDS,
    MAX_INTERACTIVE_DEMO_TURNS,
    ROOT,
    STUB,
    analyzeLearnerTurn,
    appendTraceEvent,
    appendTutorStubTurnFailureTraceRecords,
    applyConversationalCompletionForLearnerTurn,
    applyLearnerAdvanceAssessment,
    args,
    auditTutorResponseLeak,
    autoLearnerProviderConfig,
    autoLearnerResolved,
    autoSafetyTurns,
    autoStopOnGrounded,
    autoTurns,
    automatedLearnerProfileId,
    buildHumanDiscourseFrame,
    buildMixedLearnerArtifactsPrompt,
    buildTutorInterimContext,
    buildTutorOpening,
    callPromptModel,
    callTutor,
    classificationFromCombinedAnalysis,
    classifierEnabled,
    clearStatusLine,
    cliEffort,
    closeoutReportEnabled,
    combinedLearnerAnalysisEnabled,
    committedReleaseRows,
    configureCliPresentation,
    continuousUnsafeRegisterAnchorsEnabled,
    curriculumBundle,
    dagFactDropoutRate,
    dagTurnContext,
    dialogueClosureConfig,
    directorContext,
    directorNotesIssuedSoFar,
    evaluatePendingRegisterEfficacy,
    explicitPerformanceDirectiveValue,
    extractCombinedLearnerAnalysis,
    forgetRememberedInteractiveSettings,
    generateMixedLearnerArtifacts,
    generateTutorClarification,
    generateTutorStubCurriculumTranslation,
    generateTutorStubTutorOutputTranslation,
    groupedWorldEntries,
    humanDirectedRegisterPalette,
    initialDropoutPromptEnabled,
    initialMixedLearnerSetupEnabled,
    initialProfilePromptEnabled,
    initialReleaseSpeedPromptEnabled,
    initialTemperaturePromptEnabled,
    jsonClone,
    learnerDagPreflightForTurn,
    learnerPublicEvidenceState,
    learnerRecordFromCombinedAnalysis,
    learnerRecordResolved,
    learnerSuggestionEnabled,
    learningSummaryReportConfig,
    loadedSessionRecipePath,
    mixedLearnerArtifactsSystemPrompt,
    mixedLearnerEnabled,
    normalizeResponseConfigurationSelection,
    openingEnabled,
    pauseInterimAnimation,
    performanceTemperatureScope,
    persistCurrentInteractiveSettings,
    pickInitialScenarioWithKeyboard,
    pickWorkplanModuleWithKeyboard,
    printCurrentDebugId,
    printCurrentTurnAnalysis,
    printCurriculumModules,
    printDialogueCloseout,
    printDirectorNotesIssuedSoFar,
    printDirectorPreludeBeforeFirstTutor,
    printExplanatoryDebugTurn,
    printFieldVisualization,
    printInteractiveHelp,
    printLightweightDialogueField,
    printOpeningDebugLine,
    printResponseDetails,
    printTurnDebugLine,
    printTutorDagSnapshot,
    printTutorResponse,
    printTutorStubFeatureMap,
    printTutorStubReleaseNotes,
    printWithConcurrentTerminal,
    registerEmpiricalPrior,
    registerOverlayThreshold,
    registerPalette,
    registerPolicy,
    registerPolicyOverlays,
    registerSelectionEnabled,
    registerSelectionFromCombinedAnalysis,
    registerTemperature,
    registerTemperatureApplies,
    releaseSpeed,
    rememberedSettings,
    resolveConversationalCompletionForLearnerTurn,
    resolveTutorModelSelection,
    resolveTutorStubCharacterChoice,
    resolveWorldRef,
    responseConfigurationContext,
    responseDetailsConfig,
    resumeInterimAnimation,
    resumedDialogue,
    runAutomatedLearnerDialogue,
    runOneTurn,
    saveTranscript,
    sessionRuntime,
    startInterimAnimation,
    state,
    stopInterimAnimation,
    traceDir,
    traceDisplayPath,
    tutorCoachGuidanceContext,
    tutorDialogueClosureFrameForTurn,
    tutorLearnerDagEnabled,
    tutorModelChoiceEntries,
    typedActionConfig,
    updateComprehensionForLearnerTurn,
    updateReleasePacingForLearnerTurn,
    visibleAutoLearnerModel,
    visibleClassifierConfig,
    visibleClassifierModel,
    visibleLearnerRecordModel,
    visibleModel,
    visibleResolvedModel,
    worldBundle,
    writeFieldVisualization,
    writeFinalLearningSummary,
    entrypointPath: fileURLToPath(import.meta.url),
    getCliPresentation: () => cliPresentation,
    setModelBinding: setInteractiveModelBinding,
  };

  const interactiveApplication = createTutorStubInteractiveApplicationComposition({
    ...interactiveCompositionDependencies,
    callbacks: interactiveCallbacks,
  });
  const interactiveCommands = createTutorStubInteractiveCommandComposition({
    ...interactiveCompositionDependencies,
    application: interactiveApplication,
  });
  Object.assign(interactiveCallbacks, interactiveApplication, interactiveCommands);

  const {
    chooseAnotherScenario,
    emitOpeningPrompt,
    emitResumeHandoff,
    finalizeInteractive,
    handleVoiceCommand,
    printInteractionModeBanner,
    requestExit,
    runInitialMixedLearnerSetup,
    startMixedLearnerPrefetch,
    stopVoiceBridge,
    terminalHost,
  } = interactiveApplication;
  const {
    handleSlashCommand,
    handleTutorFeedbackCommand,
    mixedDraftLearnerResponseProvenance,
    printInteractiveTutorOpening,
    promptIfIdle,
    runInteractiveDemo,
  } = interactiveCommands;
  await terminalHost.run({
    appendTraceEvent,
    args,
    chooseAnotherScenario,
    emitKeypressEvents,
    emitOpeningPrompt,
    emitResumeHandoff,
    finalizeInteractive,
    fs,
    handleSlashCommand,
    handleTutorFeedbackCommand,
    handleVoiceCommand,
    instantExistingScenarioOpening,
    jsonClone,
    mixedDraftLearnerResponseProvenance,
    persistCurrentInteractiveSettings,
    printInteractionModeBanner,
    printInteractiveTutorOpening,
    promptIfIdle,
    requestExit,
    resumedDialogue,
    runInitialMixedLearnerSetup,
    runInteractiveDemo,
    runTutorStubSessionRpc,
    sessionRuntime,
    startInterimAnimation,
    startMixedLearnerPrefetch,
    stopInterimAnimation,
    stopVoiceBridge,
    tutorStubTurnFeedbackArrowRating,
    tutorStubTurnFeedbackEnvelope,
    tutorStubTurnFeedbackEscapeDismissal,
    voiceLaunchRequested,
  });
}

main().catch((err) => {
  console.error(`${C.red}Fatal:${C.reset} ${err.message}`);
  process.exit(1);
});
