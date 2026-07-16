#!/usr/bin/env node

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { call as callAI } from '../tutor-core/services/unifiedAIProviderService.js';
import { callAIWithCliBridge, isCliProvider } from '../services/cliProviderBridge.js';
import { loadWorld } from '../services/dramaticDerivation/world.js';
import { resolveTutorStubDevelopmentDirectModel } from '../services/tutorStubDevelopmentSpeakerTransport.js';
import { normalizeTokenUsage, tokenUsageFields } from '../services/tokenUsage.js';
import { buildTutorStubPromptSizeReportForRequest } from '../services/tutorStubPromptSizeReport.js';
import {
  auditTutorStubFrozenCandidate,
  extractTutorStubFrozenTurn,
  extractTutorStubRegressionFixture,
  refreshTutorStubFrozenFirstDraftRequest,
  summarizeTutorStubFrozenReplay,
  TUTOR_STUB_FROZEN_REPLAY_SCHEMA,
} from '../services/tutorStubFrozenReplay.js';
import {
  addTutorStubFrozenReplayAdmissionState,
  atomicWriteTutorStubFrozenReplayCheckpoint,
  runTutorStubFrozenReplayStopMode,
  validateTutorStubFrozenReplayStopMode,
} from '../services/tutorStubFrozenReplayCheckpoint.js';
import {
  parseTutorStubPerformanceAdjudication,
  tutorStubPerformanceAdjudicationSystemPrompt,
  tutorStubPerformanceAdjudicationUserPrompt,
} from '../services/tutorStubPerformanceAdjudication.js';
import { tutorStubActorialHostSurface } from '../services/tutorStubResponseConfiguration.js';
import { auditTutorStubPrompt } from '../services/tutorStubPromptAudit.js';
import {
  applyTutorStubJointPerformanceOwnershipAudit,
  composeTutorStubJointPerformanceFirstDraft,
  parseTutorStubJointPerformanceFirstDraft,
  replaceTutorStubFrozenRequestWithJointPerformancePrompt,
  TUTOR_STUB_JOINT_PERFORMANCE_AUDIT_SCHEMA,
  TUTOR_STUB_JOINT_PERFORMANCE_COMPOSITION_SCHEMA,
  TUTOR_STUB_JOINT_PERFORMANCE_FIRST_DRAFT_SCHEMA,
} from '../services/tutorStubJointPerformanceFirstDraft.js';
import {
  applyTutorStubStructuredSlotOwnershipAudit,
  composeTutorStubStructuredFirstDraft,
  parseTutorStubStructuredFirstDraft,
  replaceTutorStubFrozenRequestWithStructuredPrompt,
} from '../services/tutorStubStructuredFirstDraft.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORLD_DIR = path.join(ROOT, 'config', 'drama-derivation');

const { values: args } = parseArgs({
  options: {
    trace: { type: 'string' },
    turns: { type: 'string' },
    draws: { type: 'string', default: '1' },
    concurrency: { type: 'string', default: '1' },
    out: { type: 'string' },
    'write-fixture': { type: 'string' },
    'audit-fixture': { type: 'string' },
    'adjudicate-report': { type: 'string' },
    'development-seed': { type: 'string', default: '' },
    'development-direct-model': { type: 'string', default: '' },
    'original-only': { type: 'boolean', default: false },
    'stop-on-first-rejection': { type: 'boolean', default: false },
    'structured-generation': { type: 'boolean', default: false },
    'joint-performance-generation': { type: 'boolean', default: false },
    'source-accessibility-policy': { type: 'string', default: 'direct_only' },
    'semantic-adjudication': { type: 'boolean', default: false },
    'adjudicator-model': { type: 'string' },
    'adjudicator-effort': { type: 'string' },
    'reuse-adjudication': { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
});

function usage() {
  return `Usage:
  node scripts/replay-tutor-stub-frozen-turns.js --trace TRACE --turns 2,3,7,10 --draws 1 --original-only --semantic-adjudication --out report.json
  node scripts/replay-tutor-stub-frozen-turns.js --trace TRACE --turns 4,6,9 --draws 1 --original-only --structured-generation --out report.json
  node scripts/replay-tutor-stub-frozen-turns.js --trace TRACE --turns 4,6,9 --draws 1 --original-only --joint-performance-generation --out report.json
  node scripts/replay-tutor-stub-frozen-turns.js --trace TRACE --turns 5 --draws 1 --original-only --joint-performance-generation --source-accessibility-policy direct_or_compensated_v1 --out report.json
  node scripts/replay-tutor-stub-frozen-turns.js --trace TRACE --turns 4,6,9 --draws 1 --original-only --stop-on-first-rejection --concurrency 1 --out report.json
  node scripts/replay-tutor-stub-frozen-turns.js --trace TRACE --turns 5 --draws 1 --original-only --development-seed 123 --development-direct-model openai.standard --out report.json
  node scripts/replay-tutor-stub-frozen-turns.js --trace TRACE --turns 1,2 --write-fixture fixture.json
  node scripts/replay-tutor-stub-frozen-turns.js --audit-fixture fixture.json --out audit.json
  node scripts/replay-tutor-stub-frozen-turns.js --adjudicate-report original-screen.json --reuse-adjudication --out reaudited.json

The live path regenerates only the original speaking-tutor candidate. It never
invokes tutor repair, deterministic fallback, learner generation, learner
classification, DAG analysis, or dialogue continuation. Rejected text is kept
inside the JSON artifact and is never printed as public tutor speech.

--stop-on-first-rejection is a predeclared, sequential original-only screen. It
atomically checkpoints --out before generation and after every completed draw,
then closes admission at the first strict rejection.

--development-direct-model is a tool-free, cross-model prompt-screening path.
It requires a non-held-out development seed, is recorded as non-equivalent,
and never counts as Codex CLI or held-out acceptance.`;
}

function structuredGenerationFailureAudit(error, { jointPerformance = false } = {}) {
  const reason = error instanceof Error ? error.message : String(error || 'unknown structured generation error');
  const structuralType =
    /(?:structured|joint performance) (?:first draft|composition|source) invalid: ([a-z_]+)/u.exec(reason)?.[1] ||
    'malformed_structured_output';
  const guard = jointPerformance ? 'jointPerformanceGenerationAudit' : 'structuredGenerationAudit';
  const cluster = `${guard}:${structuralType}`;
  const issue = {
    type: structuralType,
    reason,
  };
  return {
    schema: TUTOR_STUB_FROZEN_REPLAY_SCHEMA,
    ok: false,
    safetyFailure: false,
    auditedText: '',
    failureClusters: [cluster],
    hardFailureClusters: [cluster],
    advisoryFailureClusters: [],
    reportOnlyFailureClusters: [],
    shadowAdvisoryFailureClusters: [],
    deliveryDecision: {
      ok: false,
      hardIssues: [{ guard, ...issue }],
      advisoryIssues: [],
      reportOnlyIssues: [],
    },
    audits: {
      [guard]: { ok: false, active: true, issues: [issue] },
      actorialRealizationAudit: {
        ok: false,
        active: false,
        issues: [{ type: 'candidate_not_composed', reason: 'malformed structured output was not exposed' }],
      },
    },
    performanceAdjudicationEligibility: {
      eligible: false,
      reason: 'candidate_not_composed',
    },
    performanceAdjudication: null,
  };
}

function auditOriginalCandidate({
  bundle,
  world,
  candidate,
  composition = null,
  jointPerformance = false,
  performanceAdjudication = null,
}) {
  const wholeResponseAudit = auditTutorStubFrozenCandidate({
    bundle,
    world,
    text: candidate,
    candidateKind: 'original_candidate',
    performanceAdjudication,
    jointPerformanceComposition: jointPerformance ? composition : null,
  });
  if (!composition) return wholeResponseAudit;
  if (jointPerformance) {
    return applyTutorStubJointPerformanceOwnershipAudit({
      audit: wholeResponseAudit,
      composition,
      candidate,
      configuration: bundle.speakingResponseConfiguration || bundle.selectedResponseConfiguration,
      world,
      performanceObligationContract: bundle.performanceObligationContract,
      progressionContract: bundle.firstDraftContract?.progression || null,
      sourceAccessibility: bundle.firstDraftContract?.evidence?.source_accessibility || null,
    });
  }
  return applyTutorStubStructuredSlotOwnershipAudit({
    audit: wholeResponseAudit,
    composition,
    candidate,
    configuration: bundle.speakingResponseConfiguration || bundle.selectedResponseConfiguration,
    world,
    performanceObligationContract: bundle.performanceObligationContract,
  });
}

function summarizeScreenResults(results = []) {
  const summary = summarizeTutorStubFrozenReplay(results);
  const structuredRows = results.filter((row) => row.structuredGeneration);
  const jointRows = results.filter((row) => row.jointPerformanceGeneration);
  if (!structuredRows.length && !jointRows.length) return summary;
  const transportNormalizations = jointRows.flatMap((row) =>
    (row.jointPerformanceGeneration?.parsed?.transport_normalizations || []).map((normalization) => ({
      turn: row.turn,
      turnId: row.turnId || null,
      draw: row.draw || null,
      ...normalization,
    })),
  );
  const sourceAccessibilityRows = jointRows.map((row) =>
    row.audit?.audits?.sourceAccessibilityAudit ||
    row.jointPerformanceGeneration?.composition?.sourceAccessibilityAudit ||
    row.sourceAccessibility ||
    null,
  );
  const sourceAccessibilityModes = sourceAccessibilityRows.reduce((counts, audit) => {
    const mode = audit?.effective_mode || 'unreported';
    counts[mode] = Number(counts[mode] || 0) + 1;
    return counts;
  }, {});
  return {
    ...summary,
    ...(structuredRows.length
      ? {
          structuredModelOutputs: structuredRows.length,
          structuredCompositions: structuredRows.filter((row) => row.structuredGeneration?.ok === true).length,
          structuredCompositionFailures: structuredRows.filter((row) => row.structuredGeneration?.ok === false).length,
          structuredCompositionsClassifiedAsRepair: 0,
          structuredCompositionsClassifiedAsFallback: 0,
        }
      : {}),
    ...(jointRows.length
      ? {
          jointPerformanceModelOutputs: jointRows.length,
          jointPerformanceCompositions: jointRows.filter((row) => row.jointPerformanceGeneration?.ok === true).length,
          jointPerformanceCompositionFailures: jointRows.filter((row) => row.jointPerformanceGeneration?.ok === false)
            .length,
          jointPerformanceCompositionsClassifiedAsRepair: 0,
          jointPerformanceCompositionsClassifiedAsFallback: 0,
          transportNormalizedOutputs: jointRows.filter(
            (row) => row.jointPerformanceGeneration?.parsed?.transport_normalizations?.length > 0,
          ).length,
          transportNormalizationCount: transportNormalizations.length,
          transportNormalizations,
          sourceAccessibilityModes,
          sourceAccessibilityVisible: sourceAccessibilityRows.filter((audit) => audit?.visible === true).length,
          sourceAccessibilityFailures: sourceAccessibilityRows.filter((audit) => audit?.ok === false).length,
        }
      : {}),
  };
}

function parsedModelReference(value) {
  const ref = String(value || '').trim();
  if (!ref) return null;
  const separator = ref.indexOf('.');
  if (separator <= 0 || separator === ref.length - 1) {
    throw new Error('--adjudicator-model must use provider.model notation');
  }
  return { provider: ref.slice(0, separator), model: ref.slice(separator + 1) };
}

function positiveInt(value, label, { max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    throw new Error(`${label} must be an integer from 1 to ${max}`);
  }
  return parsed;
}

function selectedTurns(value) {
  const rows = String(value || '')
    .split(',')
    .map((item) => Number.parseInt(item.trim(), 10))
    .filter(Number.isInteger);
  if (!rows.length) throw new Error('--turns requires one or more comma-separated turn numbers');
  return [...new Set(rows)];
}

function writeJson(filePath, value) {
  const target = path.resolve(filePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
  return target;
}

function worldPathForId(worldId) {
  const files = fs
    .readdirSync(WORLD_DIR)
    .filter((name) => /^world-.*\.yaml$/u.test(name))
    .map((name) => path.join(WORLD_DIR, name));
  const matches = files.filter((file) => loadWorld(file).id === worldId);
  if (matches.length !== 1) throw new Error(`expected exactly one world file for ${worldId}, found ${matches.length}`);
  return matches[0];
}

function worldForBundle(bundle) {
  return loadWorld(worldPathForId(bundle.worldId));
}

async function generateOriginal(bundle, { directDevelopmentModel = null } = {}) {
  const request = bundle.request || {};
  const messages = request.messages || [];
  const latest = messages.at(-1);
  if (!latest || latest.role !== 'user') throw new Error(`frozen turn ${bundle.turn} has no final user request`);
  const history = messages.slice(0, -1);
  const started = Date.now();
  let result;
  if (!directDevelopmentModel && isCliProvider(request.provider)) {
    result = await callAIWithCliBridge(
      { provider: request.provider, model: request.model },
      request.systemPrompt,
      latest.content,
      'tutor_stub_tutor_frozen_screen',
      { messageHistory: history, effort: request.effort || request.config?.cliEffort || null },
    );
    const tokenUsage = normalizeTokenUsage(result, { available: result.tokenUsageAvailable });
    const promptSizeReport = buildTutorStubPromptSizeReportForRequest({
      callId: `${bundle.turnId || `turn-${bundle.turn}`}:original`,
      provider: result.provider || request.provider,
      model: result.model || request.model,
      request,
      usage: result,
    });
    return {
      text: result.text || '',
      provider: result.provider || request.provider,
      model: result.model || request.model,
      effort: result.effort || result.reasoningEffort || request.effort || null,
      latencyMs: Number(result.latencyMs || Date.now() - started),
      usage: tokenUsageFields(tokenUsage),
      tokenUsageAvailable: tokenUsage.tokenUsageAvailable,
      promptSizeReport,
    };
  }
  const effectiveRequest = directDevelopmentModel
    ? { ...request, provider: directDevelopmentModel.provider, model: directDevelopmentModel.model }
    : request;
  result = await callAI({
    provider: effectiveRequest.provider,
    model: effectiveRequest.model,
    systemPrompt: request.systemPrompt,
    messages,
    preset: 'socratic',
    config: {
      temperature: Number(request.config?.temperature ?? 0.35),
      maxTokens: Number(request.config?.maxTokens ?? 4096),
    },
  });
  const tokenUsage = normalizeTokenUsage(result.usage);
  const promptSizeReport = buildTutorStubPromptSizeReportForRequest({
    callId: `${bundle.turnId || `turn-${bundle.turn}`}:original`,
    provider: result.provider || request.provider,
    model: result.model || request.model,
    request,
    usage: result.usage,
  });
  return {
    text: result.content || '',
    provider: result.provider || effectiveRequest.provider,
    model: result.model || effectiveRequest.model,
    effort: request.effort || null,
    latencyMs: Number(result.latencyMs || Date.now() - started),
    usage: tokenUsageFields(tokenUsage),
    tokenUsageAvailable: tokenUsage.tokenUsageAvailable,
    promptSizeReport,
    transport: directDevelopmentModel
      ? {
          kind: 'direct_provider_development_non_equivalent',
          acceptanceEligible: false,
          equivalentToFrozenModelTransport: false,
          frozenProvider: request.provider,
          frozenModel: request.model,
          effectiveProvider: effectiveRequest.provider,
          effectiveModel: effectiveRequest.model,
        }
      : {
          kind: 'direct_provider_frozen_request',
          acceptanceEligible: false,
          equivalentToFrozenModelTransport: true,
          frozenProvider: request.provider,
          frozenModel: request.model,
          effectiveProvider: effectiveRequest.provider,
          effectiveModel: effectiveRequest.model,
        },
  };
}

async function adjudicateOriginal({ bundle, candidate, deterministicAudit }) {
  const eligibility = deterministicAudit.performanceAdjudicationEligibility;
  if (eligibility?.eligible !== true) {
    return { called: false, eligibility, adjudication: null, latencyMs: 0, error: null };
  }
  const override = parsedModelReference(args['adjudicator-model']);
  const selected = override || bundle.semanticAdjudicatorDefault;
  if (!selected?.provider || !selected?.model) {
    return {
      called: false,
      eligibility,
      adjudication: null,
      latencyMs: 0,
      error: 'no saved or explicit semantic adjudicator model',
    };
  }
  const configuration = bundle.selectedResponseConfiguration;
  const hostCandidate = tutorStubActorialHostSurface(configuration, candidate);
  const systemPrompt = tutorStubPerformanceAdjudicationSystemPrompt();
  const userPrompt = tutorStubPerformanceAdjudicationUserPrompt({
    candidate: hostCandidate,
    contract: bundle.performanceObligationContract,
  });
  const promptAudit = auditTutorStubPrompt({
    surface: 'performance_adjudication',
    systemPrompt,
    userPrompt,
    instructionTexts: [systemPrompt],
  });
  if (!promptAudit.ok) {
    return {
      called: false,
      eligibility,
      adjudication: null,
      latencyMs: 0,
      error: `semantic adjudication prompt audit failed: ${promptAudit.violations.map((row) => row.code).join(', ')}`,
      promptAudit,
    };
  }
  const started = Date.now();
  try {
    let raw;
    let responseModel;
    let usage = null;
    const effort = args['adjudicator-effort'] || selected.effort || 'low';
    if (isCliProvider(selected.provider)) {
      const result = await callAIWithCliBridge(
        { provider: selected.provider, model: selected.model },
        systemPrompt,
        userPrompt,
        'tutor_stub_performance_adjudication',
        { messageHistory: [], effort },
      );
      raw = result.text || '';
      responseModel = `${result.provider || selected.provider}.${result.model || selected.model}`;
      usage = normalizeTokenUsage(result, { available: result.tokenUsageAvailable });
    } else {
      const result = await callAI({
        provider: selected.provider,
        model: selected.model,
        systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        preset: 'socratic',
        config: { temperature: 0, maxTokens: 1200 },
      });
      raw = result.content || '';
      responseModel = `${result.provider || selected.provider}.${result.model || selected.model}`;
      usage = normalizeTokenUsage(result.usage);
    }
    const adjudication = parseTutorStubPerformanceAdjudication({
      raw,
      candidate: hostCandidate,
      contract: bundle.performanceObligationContract,
    });
    return {
      called: true,
      eligibility,
      adjudication,
      raw,
      model: responseModel,
      effort,
      latencyMs: Date.now() - started,
      usage: tokenUsageFields(usage),
      tokenUsageAvailable: usage.tokenUsageAvailable,
      error: null,
      promptAudit,
      candidateSurface: 'adaptive_host_public_text',
    };
  } catch (error) {
    return {
      called: true,
      eligibility,
      adjudication: null,
      model: `${selected.provider}.${selected.model}`,
      effort: args['adjudicator-effort'] || selected.effort || 'low',
      latencyMs: Date.now() - started,
      usage: null,
      error: error.message,
      promptAudit,
    };
  }
}

async function mapLimit(items, limit, fn) {
  const output = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      output[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return output;
}

function auditFixture(fixture) {
  const results = [];
  for (const testCase of fixture.cases || []) {
    const world = worldForBundle(testCase.bundle);
    for (const candidate of testCase.candidates || []) {
      const currentAudit = auditTutorStubFrozenCandidate({
        bundle: testCase.bundle,
        world,
        text: candidate.text,
        deliveryConfiguration: candidate.deliveryConfiguration,
        candidateKind: candidate.kind,
      });
      const hasExpectedCorrection = typeof candidate.expectedCurrentAuditOk === 'boolean';
      const expectedClusters = Array.isArray(candidate.expectedFailureClusters)
        ? candidate.expectedFailureClusters
        : [];
      const recognitionCorrectionConfirmed =
        hasExpectedCorrection &&
        currentAudit.ok === candidate.expectedCurrentAuditOk &&
        expectedClusters.every((cluster) => currentAudit.hardFailureClusters.includes(cluster));
      results.push({
        caseId: testCase.id,
        turn: testCase.turn,
        worldId: testCase.worldId,
        learnerProfile: testCase.learnerProfile,
        candidateKind: candidate.kind,
        attempt: candidate.attempt,
        recordedAuditOk: candidate.recordedAuditOk,
        currentAuditOk: currentAudit.ok,
        recognitionImproved: candidate.recordedAuditOk === false && currentAudit.ok === true,
        recognitionCorrectionExpected: hasExpectedCorrection,
        recognitionCorrectionConfirmed,
        expectationReason: candidate.expectationReason || null,
        recognitionRegressed:
          candidate.recordedAuditOk === true && currentAudit.ok === false && !recognitionCorrectionConfirmed,
        safetyFailure: currentAudit.safetyFailure,
        recordedFailureClusters: candidate.recordedFailureClusters,
        currentFailureClusters: currentAudit.hardFailureClusters,
        audit: currentAudit,
      });
    }
  }
  return {
    schema: TUTOR_STUB_FROZEN_REPLAY_SCHEMA,
    mode: 'model_free_regression',
    sourceFixture: fixture.sourceTrace || null,
    cases: fixture.cases?.length || 0,
    candidates: results.length,
    auditRecognitionImprovements: results.filter((row) => row.recognitionImproved).length,
    auditRecognitionCorrections: results.filter((row) => row.recognitionCorrectionConfirmed).length,
    auditRecognitionCorrectionMismatches: results.filter(
      (row) => row.recognitionCorrectionExpected && !row.recognitionCorrectionConfirmed,
    ).length,
    auditRecognitionRegressions: results.filter((row) => row.recognitionRegressed).length,
    safetyFailures: results.filter((row) => row.safetyFailure).length,
    results,
  };
}

async function main() {
  if (args.help) {
    console.log(usage());
    return;
  }
  const structuredGeneration = Boolean(args['structured-generation']);
  const jointPerformanceGeneration = Boolean(args['joint-performance-generation']);
  const sourceAccessibilityPolicy = String(args['source-accessibility-policy'] || 'direct_only');
  if (!['direct_only', 'direct_or_compensated_v1'].includes(sourceAccessibilityPolicy)) {
    throw new Error('--source-accessibility-policy must be direct_only or direct_or_compensated_v1');
  }
  if (structuredGeneration && jointPerformanceGeneration) {
    throw new Error('--structured-generation and --joint-performance-generation are mutually exclusive');
  }
  if (sourceAccessibilityPolicy !== 'direct_only' && !jointPerformanceGeneration) {
    throw new Error('--source-accessibility-policy direct_or_compensated_v1 requires --joint-performance-generation');
  }
  if (args['audit-fixture']) {
    const fixture = JSON.parse(fs.readFileSync(path.resolve(args['audit-fixture']), 'utf8'));
    const report = auditFixture(fixture);
    if (args.out) writeJson(args.out, report);
    console.log(
      `model-free audit: ${report.candidates} candidates; ${report.auditRecognitionImprovements} recognition improvements; ${report.auditRecognitionCorrections} expected corrections; ${report.auditRecognitionRegressions} regressions; ${report.safetyFailures} safety failures`,
    );
    if (report.auditRecognitionRegressions > 0 || report.auditRecognitionCorrectionMismatches > 0) {
      process.exitCode = 1;
    }
    return;
  }
  if (args['adjudicate-report']) {
    if (!args.out) throw new Error('--out is required with --adjudicate-report');
    const sourcePath = path.resolve(args['adjudicate-report']);
    const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
    const bundlesByTurn = new Map((source.bundles || []).map((bundle) => [Number(bundle.turn), bundle]));
    const concurrency = positiveInt(args.concurrency || '1', '--concurrency', { max: 3 });
    const results = await mapLimit(source.results || [], concurrency, async (row) => {
      const bundle = bundlesByTurn.get(Number(row.turn));
      if (!bundle) throw new Error(`screen report has no frozen bundle for turn ${row.turn}`);
      if (row.structuredGeneration?.ok === false || row.jointPerformanceGeneration?.ok === false) {
        return {
          ...row,
          semanticAdjudication: {
            called: false,
            eligibility: row.audit?.performanceAdjudicationEligibility || null,
            adjudication: null,
            latencyMs: 0,
            error: null,
            skipReason: 'structured candidate was not composed',
          },
        };
      }
      const world = worldForBundle(bundle);
      const deterministicAudit = auditOriginalCandidate({
        bundle,
        world,
        candidate: row.candidate,
        composition: row.jointPerformanceGeneration?.composition || row.structuredGeneration?.composition || null,
        jointPerformance: Boolean(row.jointPerformanceGeneration),
      });
      const reusableRaw = args['reuse-adjudication'] ? row.semanticAdjudication?.raw : null;
      const semanticAdjudication = reusableRaw
        ? {
            ...row.semanticAdjudication,
            adjudication: parseTutorStubPerformanceAdjudication({
              raw: reusableRaw,
              candidate: tutorStubActorialHostSurface(bundle.selectedResponseConfiguration, row.candidate),
              contract: bundle.performanceObligationContract,
            }),
            reusedRaw: true,
            newModelCall: false,
          }
        : await adjudicateOriginal({
            bundle,
            candidate: row.candidate,
            deterministicAudit,
          });
      const audit = semanticAdjudication.adjudication
        ? auditOriginalCandidate({
            bundle,
            world,
            candidate: row.candidate,
            composition: row.jointPerformanceGeneration?.composition || row.structuredGeneration?.composition || null,
            jointPerformance: Boolean(row.jointPerformanceGeneration),
            performanceAdjudication: semanticAdjudication.adjudication,
          })
        : deterministicAudit;
      return { ...row, deterministicAudit, semanticAdjudication, audit };
    });
    const report = {
      ...source,
      mode: source.jointPerformanceGeneration
        ? 'original_only_joint_performance_screen_semantic_reaudit'
        : source.structuredGeneration
          ? 'original_only_structured_screen_semantic_reaudit'
          : 'original_only_screen_semantic_reaudit',
      sourceReport: sourcePath,
      regeneratedTutorCandidates: false,
      reusedSavedAdjudication: Boolean(args['reuse-adjudication']),
      semanticAdjudication: true,
      adjudicatorModelOverride: args['adjudicator-model'] || source.adjudicatorModelOverride || null,
      adjudicatorEffortOverride: args['adjudicator-effort'] || source.adjudicatorEffortOverride || null,
      summary: summarizeScreenResults(results),
      results,
    };
    const target = writeJson(args.out, report);
    console.log(
      `semantic re-audit: ${report.summary.originalCandidatesAccepted}/${report.summary.draws} accepted; ${report.summary.semanticRecognitionCorrections} recognition corrections; ${report.summary.semanticAdjudicatorCalls} adjudicator calls; ${report.summary.semanticAdjudicatorErrors} errors`,
    );
    console.log(`semantic re-audit report: ${target}`);
    return;
  }
  if (!args.trace) throw new Error('--trace is required');
  const tracePath = path.resolve(args.trace);
  const turns = selectedTurns(args.turns);
  if (args['write-fixture']) {
    const fixture = extractTutorStubRegressionFixture({ tracePath, turns });
    const target = writeJson(args['write-fixture'], fixture);
    console.log(`wrote ${fixture.cases.length} frozen regression cases to ${target}`);
    return;
  }
  if (!args['original-only']) {
    throw new Error('live frozen replay requires --original-only so recovery and continuation cannot run');
  }
  const directDevelopmentModel = resolveTutorStubDevelopmentDirectModel({
    modelRef: args['development-direct-model'],
    developmentSeed: args['development-seed'],
  });
  const draws = positiveInt(args.draws, '--draws', { max: 20 });
  const concurrency = positiveInt(args.concurrency, '--concurrency', { max: 3 });
  const bundles = turns.map((turn) => {
    const extracted = extractTutorStubFrozenTurn({ tracePath, turn });
    const refreshed = refreshTutorStubFrozenFirstDraftRequest({
      bundle: extracted,
      world: worldForBundle(extracted),
      sourceAccessibilityPolicy,
    });
    if (jointPerformanceGeneration) return replaceTutorStubFrozenRequestWithJointPerformancePrompt(refreshed);
    return structuredGeneration ? replaceTutorStubFrozenRequestWithStructuredPrompt(refreshed) : refreshed;
  });
  const jobs = bundles.flatMap((bundle) => Array.from({ length: draws }, (_, index) => ({ bundle, draw: index + 1 })));
  const runJob = async ({ bundle, draw }) => {
    const generated = await generateOriginal(bundle, { directDevelopmentModel });
    const world = worldForBundle(bundle);
    let candidate = generated.text;
    let structuredResult = null;
    if (structuredGeneration || jointPerformanceGeneration) {
      try {
        const parse = jointPerformanceGeneration
          ? parseTutorStubJointPerformanceFirstDraft
          : parseTutorStubStructuredFirstDraft;
        const compose = jointPerformanceGeneration
          ? composeTutorStubJointPerformanceFirstDraft
          : composeTutorStubStructuredFirstDraft;
        const parsed = parse(generated.text, {
          maxWordsPerSlot:
            bundle.firstDraftContract?.language?.host_sentence_word_target ||
            bundle.firstDraftContract?.language?.max_average_sentence_words ||
            null,
        });
        const composition = compose({
          structured: parsed,
          dramaticReleaseFrame: bundle.frames?.dramaticRelease,
          ...(jointPerformanceGeneration
            ? { sourceAccessibility: bundle.firstDraftContract?.evidence?.source_accessibility || null }
            : {}),
        });
        candidate = composition.text;
        structuredResult = {
          ok: true,
          raw: generated.text,
          parsed,
          composition,
          error: null,
        };
      } catch (error) {
        candidate = null;
        structuredResult = {
          ok: false,
          raw: generated.text,
          parsed: null,
          composition: null,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
    if ((structuredGeneration || jointPerformanceGeneration) && !candidate) {
      const audit = structuredGenerationFailureAudit(structuredResult?.error, {
        jointPerformance: jointPerformanceGeneration,
      });
      console.log(
        `turn ${bundle.turn} draw ${draw}: rejected; ${generated.latencyMs} ms generation; ${audit.hardFailureClusters[0]}`,
      );
      return {
        turn: bundle.turn,
        turnId: bundle.turnId,
        worldId: bundle.worldId,
        learnerProfile: bundle.learnerProfile,
        draw,
        developmentSeed: args['development-seed'] || null,
        model: `${generated.provider}.${generated.model}`,
        effort: generated.effort,
        latencyMs: generated.latencyMs,
        usage: generated.usage,
        tokenUsageAvailable: generated.tokenUsageAvailable,
        promptSizeReport: generated.promptSizeReport,
        transport: generated.transport || {
          kind: 'codex_cli_model_specific',
          acceptanceEligible: true,
          equivalentToFrozenModelTransport: true,
        },
        candidate: null,
        candidateProvenance: {
          kind: jointPerformanceGeneration
            ? 'joint_performance_model_output_rejected_before_composition'
            : 'structured_model_output_rejected_before_composition',
          recoveryStage: false,
        },
        ...(jointPerformanceGeneration
          ? { jointPerformanceGeneration: structuredResult }
          : { structuredGeneration: structuredResult }),
        deterministicAudit: audit,
        semanticAdjudication: {
          called: false,
          eligibility: audit.performanceAdjudicationEligibility,
          adjudication: null,
          latencyMs: 0,
          error: null,
        },
        audit,
      };
    }
    const deterministicAudit = auditOriginalCandidate({
      bundle,
      world,
      candidate,
      composition: structuredResult?.composition || null,
      jointPerformance: jointPerformanceGeneration,
    });
    const semanticAdjudication = args['semantic-adjudication']
      ? await adjudicateOriginal({ bundle, candidate, deterministicAudit })
      : { called: false, eligibility: deterministicAudit.performanceAdjudicationEligibility, latencyMs: 0 };
    const audit = semanticAdjudication.adjudication
      ? auditOriginalCandidate({
          bundle,
          world,
          candidate,
          composition: structuredResult?.composition || null,
          jointPerformance: jointPerformanceGeneration,
          performanceAdjudication: semanticAdjudication.adjudication,
        })
      : deterministicAudit;
    const accepted = audit.ok && audit.audits?.actorialRealizationAudit?.ok;
    console.log(
      `turn ${bundle.turn} draw ${draw}: ${accepted ? 'accepted' : 'rejected'}; ${generated.latencyMs} ms generation${semanticAdjudication.called ? ` + ${semanticAdjudication.latencyMs} ms semantic recognition` : ''}; ${audit.hardFailureClusters.join(', ') || (audit.audits?.actorialRealizationAudit?.ok ? 'no hard failures' : 'performance tactic not realized')}`,
    );
    return {
      turn: bundle.turn,
      turnId: bundle.turnId,
      worldId: bundle.worldId,
      learnerProfile: bundle.learnerProfile,
      draw,
      developmentSeed: args['development-seed'] || null,
      model: `${generated.provider}.${generated.model}`,
      effort: generated.effort,
      latencyMs: generated.latencyMs,
      usage: generated.usage,
      tokenUsageAvailable: generated.tokenUsageAvailable,
      promptSizeReport: generated.promptSizeReport,
      transport: generated.transport || {
        kind: 'codex_cli_model_specific',
        acceptanceEligible: true,
        equivalentToFrozenModelTransport: true,
      },
      candidate,
      sourceAccessibility:
        audit.audits?.sourceAccessibilityAudit || structuredResult?.composition?.sourceAccessibilityAudit || null,
      ...(jointPerformanceGeneration
        ? {
            candidateProvenance: { kind: 'joint_performance_original_composition', recoveryStage: false },
            jointPerformanceGeneration: structuredResult,
          }
        : structuredGeneration
          ? {
              candidateProvenance: { kind: 'structured_original_composition', recoveryStage: false },
              structuredGeneration: structuredResult,
            }
          : {}),
      deterministicAudit,
      semanticAdjudication,
      audit,
    };
  };
  const reportBase = {
    schema: TUTOR_STUB_FROZEN_REPLAY_SCHEMA,
    mode: directDevelopmentModel
      ? 'original_only_direct_provider_development_screen_non_equivalent'
      : jointPerformanceGeneration
      ? 'original_only_joint_performance_screen'
      : structuredGeneration
        ? 'original_only_structured_screen'
        : 'original_only_screen',
    originalOnly: true,
    ...(structuredGeneration ? { structuredGeneration: true } : {}),
    ...(jointPerformanceGeneration
      ? {
          jointPerformanceGeneration: true,
          jointPerformanceSchema: TUTOR_STUB_JOINT_PERFORMANCE_FIRST_DRAFT_SCHEMA,
          jointPerformanceCompositionSchema: TUTOR_STUB_JOINT_PERFORMANCE_COMPOSITION_SCHEMA,
          jointPerformanceAuditSchema: TUTOR_STUB_JOINT_PERFORMANCE_AUDIT_SCHEMA,
        }
      : {}),
    sourceTrace: tracePath,
    turns,
    drawsPerTurn: draws,
    concurrency,
    developmentSeed: args['development-seed'] || null,
    speakerTransport: directDevelopmentModel
      ? {
          kind: 'direct_provider_development_non_equivalent',
          requestedModelRef: args['development-direct-model'],
          provider: directDevelopmentModel.provider,
          model: directDevelopmentModel.model,
          acceptanceEligible: false,
          consumesHeldOutOrAcceptanceSeed: false,
        }
      : {
          kind: 'frozen_model_transport',
          provider: bundles[0]?.request?.provider || null,
          model: bundles[0]?.request?.model || null,
          acceptanceEligible: true,
        },
    sourceAccessibilityPolicy,
    semanticAdjudication: Boolean(args['semantic-adjudication']),
    adjudicatorModelOverride: args['adjudicator-model'] || null,
    adjudicatorEffortOverride: args['adjudicator-effort'] || null,
    invariants: {
      priorDialogueRegenerated: false,
      learnerGenerated: false,
      learnerClassified: false,
      learnerDagUpdated: false,
      modelRepairInvoked: false,
      deterministicFallbackInvoked: false,
      dialogueContinued: false,
      unsafeCandidatePubliclyExposed: false,
      runtimeDialoguePathChanged: false,
      directProviderScreenCountsAsCodexCliAcceptance: false,
      ...(structuredGeneration ? { deterministicStructuredCompositionInvoked: true } : {}),
      ...(jointPerformanceGeneration ? { deterministicJointPerformanceCompositionInvoked: true } : {}),
    },
    bundles,
  };
  const buildReport = (results, admissionState = null, admissionPolicy = null) =>
    addTutorStubFrozenReplayAdmissionState(
      {
        ...reportBase,
        summary: summarizeScreenResults(results),
        results,
      },
      { admissionState, admissionPolicy },
    );
  const stopMode = validateTutorStubFrozenReplayStopMode({
    enabled: Boolean(args['stop-on-first-rejection']),
    originalOnly: Boolean(args['original-only']),
    concurrency,
    out: args.out,
  });
  let results;
  let report;
  let target;
  if (stopMode.enabled) {
    const outcome = await runTutorStubFrozenReplayStopMode({
      jobs,
      runJob,
      checkpoint: ({ results: partialResults, admissionState }) => {
        report = buildReport(partialResults, admissionState, stopMode);
        target = atomicWriteTutorStubFrozenReplayCheckpoint(args.out, report);
      },
    });
    results = outcome.results;
    report = buildReport(results, outcome.admissionState, stopMode);
  } else {
    results = await mapLimit(jobs, concurrency, runJob);
    report = buildReport(results);
    if (!args.out) throw new Error('--out is required for live replay so every candidate and audit is preserved');
    target = writeJson(args.out, report);
  }
  console.log(`frozen original-only report: ${target}`);
  console.log(
    `accepted ${report.summary.originalCandidatesAccepted}/${report.summary.draws}; safety failures ${report.summary.safetyFailures}; mean original latency ${Math.round(report.summary.meanOriginalLatencyMs || 0)} ms${stopMode.enabled ? `; status ${report.status}` : ''}`,
  );
}

main().catch((error) => {
  console.error(`error: ${error.message}`);
  process.exitCode = 1;
});
