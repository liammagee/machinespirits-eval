import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  adaptiveTraceScenarioContext,
  adaptiveTraceToDialogueLog,
  extractLearnerTurnsFromTrace,
  isAdaptiveTraceLog,
} from '../../services/adaptiveTraceProjection.js';
import { callModelCliText } from '../../services/cliProviderBridge.js';
import * as evalConfigLoader from '../../services/evalConfigLoader.js';
import { clearRubricPathOverride, setRubricPathOverride } from '../../services/evalConfigLoader.js';
import * as evaluationRunner from '../../services/evaluationRunner.js';
import * as evaluationStore from '../../services/evaluationStore.js';
import {
  buildBatchedLearnerPrompt,
  buildLearnerEvaluationPrompt,
  buildLearnerHolisticEvaluationPrompt,
  calculateLearnerOverallScore,
  clearLearnerRubricPathOverride,
  setLearnerRubricPathOverride,
} from '../../services/learnerRubricEvaluator.js';
import {
  buildBatchedPerTurnTutorPrompt,
  buildDialogueFullTranscript,
  buildDialoguePublicTranscript,
  buildDialogueQualityPrompt,
  buildEvaluationPrompt,
  buildLearnerDeliberationPrompt,
  buildPerTurnTutorEvaluationPrompt,
  buildTutorDeliberationPrompt,
  buildTutorHolisticEvaluationPrompt,
  calculateBaseScore,
  calculateDeliberationScore,
  calculateDialogueQualityScore,
  calculateOverallScore,
  calculateRecognitionScore,
  calculateTutorHolisticScore,
  clearDeliberationRubricPathOverride,
  clearDialogueRubricPathOverride,
  clearTutorHolisticRubricPathOverride,
  getAvailableJudge,
  hasTutorSuperego,
  setDeliberationRubricPathOverride,
  setDialogueRubricPathOverride,
  setTutorHolisticRubricPathOverride,
} from '../../services/rubricEvaluator.js';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = path.resolve(moduleDirectory, '..', '..', 'logs', 'tutor-dialogues');
const RUBRICS_DIR = path.resolve(moduleDirectory, '..', '..', 'config', 'rubrics');

function positiveIntEnv(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

const CLI_JUDGE_TIMEOUT_MS = positiveIntEnv('EVAL_CLI_JUDGE_TIMEOUT_MS', 600_000);

async function callSelectedCliJudgeText(judgeCli, model, prompt, role, effort = null) {
  return await callModelCliText({
    provider: judgeCli,
    model,
    prompt,
    role,
    timeoutMs: CLI_JUDGE_TIMEOUT_MS,
    effort,
  });
}

function resolveEvaluationScenarioAndDialogueLog(result) {
  const standardScenario = evalConfigLoader.getScenario(result.scenarioId);
  let dialogueLog = null;
  if (result.dialogueId) dialogueLog = evaluationStore.loadDialogueLog(result.dialogueId);
  if (standardScenario) return { scenario: standardScenario, dialogueLog };
  if (isAdaptiveTraceLog(dialogueLog)) {
    return {
      scenario: adaptiveTraceScenarioContext(dialogueLog, result),
      dialogueLog: adaptiveTraceToDialogueLog(dialogueLog),
    };
  }
  return { scenario: null, dialogueLog };
}

function resolveRubricPaths(version) {
  const directory = path.join(RUBRICS_DIR, `v${version}`);
  if (!fs.existsSync(directory)) throw new Error(`Rubric version directory not found: ${directory}`);
  const files = {
    tutor: path.join(directory, 'evaluation-rubric.yaml'),
    learner: path.join(directory, 'evaluation-rubric-learner.yaml'),
    tutorHolistic: path.join(directory, 'evaluation-rubric-tutor-holistic.yaml'),
    dialogue: path.join(directory, 'evaluation-rubric-dialogue.yaml'),
    deliberation: path.join(directory, 'evaluation-rubric-deliberation.yaml'),
  };
  for (const [key, filePath] of Object.entries(files)) {
    if (!fs.existsSync(filePath)) throw new Error(`Rubric file missing for ${key}: ${filePath}`);
  }
  return files;
}

function setAllRubricOverrides(paths) {
  setRubricPathOverride(paths.tutor);
  setLearnerRubricPathOverride(paths.learner);
  setTutorHolisticRubricPathOverride(paths.tutorHolistic);
  setDialogueRubricPathOverride(paths.dialogue);
  setDeliberationRubricPathOverride(paths.deliberation);
}

function clearAllRubricOverrides() {
  clearRubricPathOverride();
  clearLearnerRubricPathOverride();
  clearTutorHolisticRubricPathOverride();
  clearDialogueRubricPathOverride();
  clearDeliberationRubricPathOverride();
}

function resolveDefaultCliJudgeModelOverride(judgeCli) {
  try {
    return String(judgeCli || '').toLowerCase() === 'claude'
      ? evalConfigLoader.loadRubric()?.claude_code_judge?.model || null
      : null;
  } catch {
    return null;
  }
}

export const generationRubricDependencies = Object.freeze({
  clearAllRubricOverrides,
  getAvailableJudge,
  resolveRubricPaths,
  setAllRubricOverrides,
});

export const scoringCommandDependencies = Object.freeze({
  LOGS_DIR,
  buildBatchedLearnerPrompt,
  buildBatchedPerTurnTutorPrompt,
  buildDialogueFullTranscript,
  buildDialoguePublicTranscript,
  buildDialogueQualityPrompt,
  buildEvaluationPrompt,
  buildLearnerDeliberationPrompt,
  buildLearnerEvaluationPrompt,
  buildLearnerHolisticEvaluationPrompt,
  buildPerTurnTutorEvaluationPrompt,
  buildTutorDeliberationPrompt,
  buildTutorHolisticEvaluationPrompt,
  calculateBaseScore,
  calculateDeliberationScore,
  calculateDialogueQualityScore,
  calculateLearnerOverallScore,
  calculateOverallScore,
  calculateRecognitionScore,
  calculateTutorHolisticScore,
  callSelectedCliJudgeText,
  clearAllRubricOverrides,
  createHash,
  evalConfigLoader,
  evaluationRunner,
  evaluationStore,
  extractLearnerTurnsFromTrace,
  fs,
  getScenario: evalConfigLoader.getScenario,
  hasTutorSuperego,
  path,
  resolveDefaultCliJudgeModelOverride,
  resolveEvaluationScenarioAndDialogueLog,
  resolveRubricPaths,
  setAllRubricOverrides,
});
