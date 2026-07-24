#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { loadWorld } from '../services/dramaticDerivation/world.js';
import {
  auditTutorStubClueDeliveryMultiplicity,
  deterministicTutorStubDramaticReleaseFallback,
} from '../services/tutorStubDramaticRelease.js';
import {
  deterministicTutorStubConfiguredContinuationFallback,
  tutorStubSubstantiveLearnerEcho,
} from '../services/tutorStubResponseComposition.js';
import { auditTutorStubFrozenCandidate, auditTutorStubFrozenLeak } from '../services/tutorStubFrozenReplay.js';
import { selectTutorStubDeterministicFallbackUptake } from '../services/tutorStubTurnProgressionContract.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_CONFIG = path.join(ROOT, 'config', 'tutor-stub-final-audit-reliability-gate.json');
const DEFAULT_OUT = path.join(ROOT, 'exports', 'program2-final-audit-reliability-gate', 'replay-classification.json');

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readJsonl(file) {
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function oneLine(value) {
  return String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function issueKeys(issues = []) {
  return issues.map((issue) => `${issue.guard || 'unknown'}:${issue.type || 'failed'}`);
}

function exactArrayEqual(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function worldPathForId(worldId) {
  const worldDir = path.join(ROOT, 'config', 'drama-derivation');
  const file = fs
    .readdirSync(worldDir)
    .filter((entry) => entry.endsWith('.yaml'))
    .map((entry) => path.join(worldDir, entry))
    .find((candidate) => loadWorld(candidate).id === worldId);
  if (!file) throw new Error(`world not found: ${worldId}`);
  return file;
}

export function analyzeTutorStubFinalAuditTraceCase({ spec, tracePath, world }) {
  const bytes = fs.readFileSync(tracePath);
  const traceSha256 = sha256(bytes);
  const events = readJsonl(tracePath);
  const turn = Number(spec.turn);
  const rejected = events.findLast((event) => event.type === 'tutor_response_fallback_rejected' && event.turn === turn);
  const exhausted = events.findLast((event) => event.type === 'tutor_response_guard_exhausted' && event.turn === turn);
  const contractEvent = events.findLast((event) => event.type === 'tutor_first_draft_contract' && event.turn === turn);
  const learnerEvent = events.findLast((event) => event.type === 'auto_learner_turn' && event.turn === turn);
  const fallbackAttempt = exhausted?.accounting?.attempts?.findLast(
    (attempt) => attempt.kind === 'deterministic_fallback',
  );
  if (!rejected || !exhausted || !contractEvent || !fallbackAttempt) {
    throw new Error(`${spec.id} does not contain one complete rejected deterministic fallback at turn ${turn}`);
  }
  const observedIssues = issueKeys(rejected.issues);
  const priorTurns = events
    .filter((event) => event.type === 'turn_complete' && Number(event.turn) < turn)
    .map((event) => ({
      turn: Number(event.turn),
      learner: event.turnRecord?.learner || '',
      tutor: event.turnRecord?.tutor || '',
    }));
  const publicPremiseIds = fallbackAttempt.audits?.leakAudit?.publicPremiseIds || [];
  const learnerText = learnerEvent?.text || contractEvent.contract?.progression?.learner_uptake?.learner_surface || '';
  const safeFocus = oneLine(spec.safeFocus);
  const contractFocus = oneLine(contractEvent.contract?.progression?.turn_focus_contract?.primary_surface);
  const safeUptake = `I keep your point about “${safeFocus}” in view.`;
  const safeLeakAudit = auditTutorStubFrozenLeak({
    text: safeUptake,
    world,
    tutorTurn: turn,
    learnerText,
    priorTurns,
    publicPremiseIds,
  });
  const dramaticEvent = events.findLast(
    (event) => event.type === 'tutor_dramatic_release_audit' && event.turn === turn && event.role.endsWith('_fallback'),
  );
  const dueSourceText = (contractEvent.contract?.evidence?.sources || []).map((source) => source.text).join(' ');
  const safeMultiplicityAudit = auditTutorStubClueDeliveryMultiplicity({
    text: [safeUptake, dueSourceText].filter(Boolean).join(' '),
    frame: dramaticEvent?.frame || null,
  });
  const checks = {
    trace_hash_matches: traceSha256 === spec.traceSha256,
    recorded_failure_reproduced: exactArrayEqual(observedIssues, spec.expectedIssues),
    terminal_outcome_reproduced: exhausted.accounting?.outcome === 'guard_exhausted_without_public_delivery',
    safe_focus_is_archived_public_input:
      Boolean(safeFocus) && contractFocus.toLocaleLowerCase().includes(safeFocus.toLocaleLowerCase()),
    safe_focus_clears_unchanged_leak_audit: safeLeakAudit.ok,
    safe_focus_clears_unchanged_release_multiplicity_audit: safeMultiplicityAudit.ok,
  };
  const safeReplacementExists =
    checks.safe_focus_is_archived_public_input &&
    checks.safe_focus_clears_unchanged_leak_audit &&
    checks.safe_focus_clears_unchanged_release_multiplicity_audit;
  const inferredClassification = safeReplacementExists
    ? 'fallback_construction_defect'
    : observedIssues.some((issue) => issue.startsWith('leak:'))
      ? 'true_unsafe_draft'
      : 'audit_input_mismatch';
  checks.classification_matches = inferredClassification === spec.classification;
  const recentTutorTexts = priorTurns.map((row) => row.tutor).filter(Boolean);
  const candidateGuard = (candidate) => {
    const text = oneLine(candidate);
    if (!text) return false;
    const leak = auditTutorStubFrozenLeak({
      text,
      world,
      tutorTurn: turn,
      learnerText,
      priorTurns,
      publicPremiseIds,
    });
    if (!leak.ok) return false;
    return auditTutorStubClueDeliveryMultiplicity({
      text: [text, dueSourceText].filter(Boolean).join(' '),
      frame: dramaticEvent?.frame || null,
    }).ok;
  };
  const archivedUptake = fallbackAttempt.audits?.responseCompositionAudit?.segments?.uptake || '';
  const repairUptake = selectTutorStubDeterministicFallbackUptake({
    contract: contractEvent.contract?.progression || null,
    candidates: [archivedUptake],
    recentTutorTexts,
    variationKey: `${events[0]?.runId || 'run'}:${turn}`,
    learnerEchoGuard: (candidate) => tutorStubSubstantiveLearnerEcho(candidate, learnerText),
    candidateGuard,
  });
  const responseCompositionEvent = events.findLast(
    (event) =>
      event.type === 'tutor_response_composition_audit' &&
      event.turn === turn &&
      String(event.role || '').endsWith('_fallback'),
  );
  const deliveryConfiguration = fallbackAttempt.deliveryConfiguration || null;
  const repairCandidate = dramaticEvent?.frame?.active
    ? deterministicTutorStubDramaticReleaseFallback({
        frame: dramaticEvent.frame,
        uptake: repairUptake,
        responseConfiguration: deliveryConfiguration,
        variationKey: `${events[0]?.runId || 'run'}:${turn}`,
        turnProgressionContract: contractEvent.contract?.progression || null,
        sourceAccessibilityContract: contractEvent.contract?.evidence?.source_accessibility || null,
        candidateGuard,
      })
    : deterministicTutorStubConfiguredContinuationFallback({
        uptake: repairUptake,
        responseConfiguration: deliveryConfiguration,
        world,
        learnerText,
        turnProgressionContract: contractEvent.contract?.progression || null,
        recentTutorTexts,
        variationKey: `${events[0]?.runId || 'run'}:${turn}`,
        candidateGuard,
      });
  const repairBundle = {
    turn,
    learnerText,
    priorTurns,
    priorTutorTexts: recentTutorTexts,
    selectedResponseConfiguration: deliveryConfiguration,
    speakingResponseConfiguration: deliveryConfiguration,
    firstDraftContract: contractEvent.contract,
    performanceObligationContract: contractEvent.contract?.performance?.obligation_contract || null,
    frames: {
      responseComposition: responseCompositionEvent?.frame || null,
      dramaticRelease: dramaticEvent?.frame || null,
      questionSupport: null,
      dialogueClosure: null,
      generousInference: null,
    },
    guards: exhausted.accounting?.guards || {},
    publicPremiseIds,
    duePremiseIds: (dramaticEvent?.frame?.entries || []).map((entry) => entry.premise).filter(Boolean),
  };
  const repairAudit = auditTutorStubFrozenCandidate({
    bundle: repairBundle,
    world,
    text: repairCandidate,
    deliveryConfiguration,
    candidateKind: 'deterministic_fallback',
  });
  checks.repair_candidate_passes_unchanged_final_audits = repairAudit.ok;
  return {
    id: spec.id,
    trace: path.relative(ROOT, tracePath),
    turn,
    traceSha256,
    modelCallsMadeByReplay: 0,
    observedIssues,
    classification: inferredClassification,
    cause: spec.cause,
    archivedFallback: rejected.text,
    safeFocus,
    safeUptake,
    safeReplacementExists,
    safeAudit: {
      leak: safeLeakAudit,
      clueDeliveryMultiplicity: safeMultiplicityAudit,
    },
    repair: {
      uptake: repairUptake,
      candidate: repairCandidate,
      audit: repairAudit,
    },
    checks,
    ok: Object.values(checks).every(Boolean),
  };
}

export function runTutorStubFinalAuditReliabilityReplay({ configPath = DEFAULT_CONFIG, outPath = null } = {}) {
  const resolvedConfig = path.resolve(configPath);
  const config = readJson(resolvedConfig);
  const world = loadWorld(worldPathForId(config.worldId));
  const cases = config.cases.map((spec) =>
    analyzeTutorStubFinalAuditTraceCase({
      spec,
      tracePath: path.resolve(ROOT, spec.trace),
      world,
    }),
  );
  const artifact = {
    schema: 'machinespirits.tutor-stub.final-audit-reliability-replay.v1',
    generatedAt: new Date().toISOString(),
    config: path.relative(ROOT, resolvedConfig),
    worldId: config.worldId,
    modelCallsMadeByReplay: 0,
    cases,
    summary: {
      cases: cases.length,
      reproduced: cases.filter((row) => row.checks.recorded_failure_reproduced).length,
      classified: cases.filter((row) => row.checks.classification_matches).length,
      fallbackConstructionDefects: cases.filter((row) => row.classification === 'fallback_construction_defect').length,
      trueUnsafeDrafts: cases.filter((row) => row.classification === 'true_unsafe_draft').length,
      auditInputMismatches: cases.filter((row) => row.classification === 'audit_input_mismatch').length,
      repaired: cases.filter((row) => row.checks.repair_candidate_passes_unchanged_final_audits).length,
    },
    ok: cases.length === 4 && cases.every((row) => row.ok),
  };
  if (outPath) {
    const target = path.resolve(outPath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${JSON.stringify(artifact, null, 2)}\n`);
  }
  return artifact;
}

async function main() {
  const { values } = parseArgs({
    options: {
      config: { type: 'string', default: DEFAULT_CONFIG },
      out: { type: 'string', default: DEFAULT_OUT },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    console.log('Usage: node scripts/replay-tutor-stub-final-audit-reliability.mjs [--config FILE] [--out FILE]');
    return;
  }
  const artifact = runTutorStubFinalAuditReliabilityReplay({ configPath: values.config, outPath: values.out });
  console.log(
    `[final-audit-reliability] ${artifact.ok ? 'PASS' : 'FAIL'}: ${artifact.summary.reproduced}/${artifact.summary.cases} reproduced, ${artifact.summary.classified}/${artifact.summary.cases} classified, 0 model calls`,
  );
  console.log(`[final-audit-reliability] ${path.relative(ROOT, path.resolve(values.out))}`);
  if (!artifact.ok) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`[final-audit-reliability] ${error.stack || error.message}`);
    process.exitCode = 1;
  });
}
