#!/usr/bin/env node
/**
 * A21 Hethel trigger-fixture builder.
 *
 * Pure local artifact pass: reads the A21 autopsy JSON, extracts a safe public
 * prefix for the primary trigger, and writes the trigger fixture plus the frozen
 * four-action candidate set. No LLM calls and no replay execution.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { defaultHethelActionSet, validateA21ActionSet } from '../services/dramaticDerivation/index.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const OUT_DIR = 'exports/dramatic-derivation/a21-action-value';
const DEFAULT_AUTOPSY = path.join(OUT_DIR, 'hethel-autopsy.json');
const FIXTURE_SCHEMA = 'dramatic-derivation.a21.trigger-fixture.v0';
const FORBIDDEN_KEYS = new Set([
  'secret',
  'proofPath',
  'proof_path',
  'rawBoard',
  'raw_board',
  'corruptionLedger',
  'corruption_ledger',
  'hiddenBoard',
  'hidden_board',
  'sourcePremiseIds',
  'sourceProofPathIds',
  'trajectoryD',
  'dNow',
  'dIfRestored',
  'deltaD',
]);

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : fallback;
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function rel(file) {
  return path.relative(ROOT, file);
}

function resolveRunDir(input) {
  const resolved = path.resolve(ROOT, input);
  if (existsSync(path.join(resolved, 'result.json'))) return resolved;
  throw new Error(`a21 fixture: missing source run ${input}`);
}

function hashObject(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function sanitizeMove(move = {}) {
  return {
    figure: move.figure || null,
    intent: move.intent || null,
    targetPremise: move.targetPremise || move.target_premise || null,
  };
}

function sanitizeTranscriptEntry(entry) {
  const meta = {};
  if (entry.meta?.release) meta.release = entry.meta.release;
  if (entry.meta?.phase) {
    meta.phase = {
      name: entry.meta.phase.name || null,
      intent: entry.meta.phase.intent || null,
      turn: entry.meta.phase.turn ?? null,
    };
  }
  if (entry.meta?.move) meta.move = sanitizeMove(entry.meta.move);
  if (entry.role === 'learner') {
    meta.adopt = entry.meta?.adopt || [];
    meta.retract = entry.meta?.retract || [];
    meta.derive = entry.meta?.derive || [];
    meta.hypothesis = entry.meta?.hypothesis || null;
    meta.asserts = entry.meta?.asserts || null;
  }
  return {
    turn: Number(entry.turn),
    role: entry.role,
    text: entry.text || '',
    meta,
  };
}

function scanForbiddenKeys(value, pathParts = []) {
  if (!value || typeof value !== 'object') return [];
  const leaks = [];
  for (const [key, child] of Object.entries(value)) {
    const pathLabel = [...pathParts, key].join('.');
    if (FORBIDDEN_KEYS.has(key)) leaks.push(pathLabel);
    leaks.push(...scanForbiddenKeys(child, [...pathParts, key]));
  }
  return leaks;
}

function rowAt(turns, turn) {
  return (turns || []).find((row) => Number(row.turn) === Number(turn)) || null;
}

function releaseContextFrom(row) {
  const decision = row?.releaseDecision || {};
  return {
    targetPremise: row?.released || decision.played || 'p_point',
    releasedAtTrigger: row?.released || null,
    safeTurns: decision?.safeTurns?.p_point || row?.releaseDue || [],
    scheduledTurn: decision?.scheduledTurn ?? null,
    offset: decision?.offset ?? null,
    forced: decision?.forced || null,
  };
}

function inferDiagnosticHistory(prefix) {
  const diagnostics = prefix.filter(
    (entry) =>
      entry.role === 'tutor' &&
      (entry.meta?.move?.intent === 'test' || entry.meta?.move?.intent === 'confront') &&
      !entry.meta?.release,
  );
  return {
    count: diagnostics.length,
    lastDiagnosticTurn: diagnostics.length ? diagnostics[diagnostics.length - 1].turn : null,
    answeredSubstantively: Math.max(0, diagnostics.length - 1),
    repeatedWithoutNewEvidence: Math.max(0, diagnostics.length - 1),
  };
}

function buildFixture(autopsy) {
  const divergence = autopsy.primaryDivergence;
  if (!divergence?.triggerTurn) throw new Error('a21 fixture: autopsy has no primary trigger turn');
  const prefixSource = autopsy.failedOverlay;
  const prefixThroughTurn = Number(divergence.prefixThroughTurn);
  const sourceRunDir = resolveRunDir(prefixSource.runDir);
  const sourceResult = readJson(path.join(sourceRunDir, 'result.json'));
  const prefix = (sourceResult.transcript || [])
    .filter((entry) => Number(entry.turn) <= prefixThroughTurn)
    .map(sanitizeTranscriptEntry);
  const hiddenTrigger = rowAt(autopsy.hidden.turns, divergence.triggerTurn);
  const failedTrigger = rowAt(autopsy.failedOverlay.turns, divergence.triggerTurn);
  const diagnosticHistory = inferDiagnosticHistory(prefix);
  const fixture = {
    schema: FIXTURE_SCHEMA,
    fixtureId: 'hethel-trigger-fixture',
    generatedAt: new Date().toISOString(),
    sourceAutopsy: 'exports/dramatic-derivation/a21-action-value/hethel-autopsy.json',
    sourceRuns: {
      prefixSource: prefixSource.runDir,
      hiddenSuccess: autopsy.hidden.runDir,
      failedOverlay: autopsy.failedOverlay.runDir,
    },
    worldId: autopsy.hidden.worldId || autopsy.failedOverlay.worldId,
    trigger: {
      turn: Number(divergence.triggerTurn),
      prefixThroughTurn,
      primaryLabel: divergence.primaryLabel,
      secondaryLabels: divergence.secondaryLabels || [],
      summary: divergence.summary,
    },
    publicProofSummary: {
      proofDistanceBeforeAction: failedTrigger?.DBefore ?? hiddenTrigger?.DBefore ?? null,
      hiddenProofDistanceAfterObservedAction: hiddenTrigger?.DAfter ?? null,
      failedProofDistanceAfterObservedAction: failedTrigger?.DAfter ?? null,
      finalHiddenVerdict: autopsy.hidden.verdict,
      finalFailedVerdict: autopsy.failedOverlay.verdict,
    },
    releaseContext: {
      targetPremise: 'p_point',
      hiddenObserved: releaseContextFrom(hiddenTrigger),
      failedObserved: releaseContextFrom(failedTrigger),
    },
    publicLearnerState: {
      stateId: 'hethel-trigger-fixture:learner',
      misconception: 'mirror_dead_predicate',
      frustration: diagnosticHistory.repeatedWithoutNewEvidence > 0 ? 'medium' : 'low',
      engagement: 'engaged',
      confidence: 'low',
      evidenceSeen: {
        m_record: true,
        p_point: false,
        p_surface: false,
        p_mark: false,
        p_brand: false,
      },
      dependencyOwned: {
        m_record: true,
        p_point: false,
        p_surface: false,
        p_mark: false,
        p_brand: false,
      },
      dependencyEchoedOnly: {
        p_point: true,
      },
      alternativeRouteCandidate: false,
      diagnosticHistory,
      proofProgress: {
        D: failedTrigger?.DBefore ?? hiddenTrigger?.DBefore ?? 5,
        lastDDelta: 0,
        turnsSinceDDecrease: prefixThroughTurn,
        releasesOnSchedule: [],
        delayedReleases: [],
        earlyReleases: [],
      },
      transitionFlags: {
        targetDependencyRepaired: false,
        learnerCanUsePPoint: false,
        learnerCanUsePSurface: false,
        learnerReadyForFinalAssertion: false,
      },
    },
    publicTranscriptPrefix: prefix,
    observedAtTrigger: {
      hiddenAction: {
        actionFamily: hiddenTrigger?.tutorActionFamily || null,
        targetPremise: hiddenTrigger?.tutorMove?.targetPremise || null,
        released: hiddenTrigger?.released || null,
        DAfter: hiddenTrigger?.DAfter ?? null,
      },
      failedAction: {
        actionFamily: failedTrigger?.tutorActionFamily || null,
        targetPremise: failedTrigger?.tutorMove?.targetPremise || null,
        released: failedTrigger?.released || null,
        selectedConductMoveFamily: failedTrigger?.conductPolicy?.selectedMoveFamily || null,
        conductReasonCode: failedTrigger?.conductPolicy?.reasonCode || null,
        DAfter: failedTrigger?.DAfter ?? null,
      },
    },
    nonLeakConstraints: {
      forbiddenKeys: [...FORBIDDEN_KEYS].sort(),
      tutorFacingFields: ['publicTranscriptPrefix', 'publicLearnerState', 'releaseContext'],
    },
  };
  fixture.fixtureHash = hashObject({
    worldId: fixture.worldId,
    trigger: fixture.trigger,
    publicProofSummary: fixture.publicProofSummary,
    publicLearnerState: fixture.publicLearnerState,
    publicTranscriptPrefix: fixture.publicTranscriptPrefix,
  });
  return fixture;
}

function validateFixture(fixture, actionSet) {
  if (fixture.schema !== FIXTURE_SCHEMA) throw new Error(`a21 fixture: unsupported schema ${fixture.schema}`);
  if (fixture.trigger?.turn !== 4 || fixture.trigger?.prefixThroughTurn !== 3) {
    throw new Error('a21 fixture: expected Hethel t4 trigger with prefix through t3');
  }
  const leaks = scanForbiddenKeys({
    publicTranscriptPrefix: fixture.publicTranscriptPrefix,
    publicLearnerState: fixture.publicLearnerState,
    releaseContext: fixture.releaseContext,
  });
  if (leaks.length) throw new Error(`a21 fixture: forbidden public fixture keys: ${leaks.join(', ')}`);
  validateA21ActionSet(actionSet);
  if (actionSet.actions.length !== 4 || actionSet.winnerActionId) {
    throw new Error('a21 fixture: action set must contain exactly four actions and no winner');
  }
  return { ok: true, leaks: [] };
}

function renderMarkdown({ fixture, actionSet, validation }) {
  const lines = [];
  lines.push('# A21 Hethel Trigger Fixture');
  lines.push('');
  lines.push(`Generated: ${fixture.generatedAt}`);
  lines.push('');
  lines.push(`- Fixture ID: \`${fixture.fixtureId}\``);
  lines.push(`- Fixture hash: \`${fixture.fixtureHash}\``);
  lines.push(`- Trigger turn: ${fixture.trigger.turn}`);
  lines.push(`- Prefix source: \`${fixture.sourceRuns.prefixSource}\``);
  lines.push(`- Prefix through turn: ${fixture.trigger.prefixThroughTurn}`);
  lines.push(`- Primary label: \`${fixture.trigger.primaryLabel}\``);
  lines.push(`- Validation: ${validation.ok ? 'pass' : 'FAIL'}`);
  lines.push('');
  lines.push('## Candidate Actions');
  lines.push('');
  lines.push('| action | family | release now | hold | risk |');
  lines.push('|---|---|---|---|---|');
  for (const action of actionSet.actions) {
    lines.push(
      `| ${action.actionId} | ${action.moveFamily} | ${action.releaseDirectives.releaseNow.join(', ') || ' '} | ` +
        `${action.releaseDirectives.hold.join(', ') || ' '} | ${action.knownRisks[0]} |`,
    );
  }
  lines.push('');
  lines.push('## Boundary');
  lines.push('');
  lines.push(
    'The fixture preserves the failed overlay dialogue prefix through turn 3, then leaves turn 4 open for action-value trials. Observed hidden/failed turn-4 outcomes are stored only as provenance, not as an encoded winner.',
  );
  return `${lines.join('\n')}\n`;
}

export function buildTriggerFixtureFromAutopsy(autopsy) {
  const fixture = buildFixture(autopsy);
  const actionSet = defaultHethelActionSet({ fixtureId: fixture.fixtureId });
  const validation = validateFixture(fixture, actionSet);
  return { fixture, actionSet, validation };
}

function main() {
  const autopsyPath = path.resolve(ROOT, arg('autopsy', DEFAULT_AUTOPSY));
  const fixtureOut = path.resolve(ROOT, arg('out', path.join(OUT_DIR, 'hethel-trigger-fixture.json')));
  const actionsOut = path.resolve(ROOT, arg('actions-out', path.join(OUT_DIR, 'action-set.json')));
  const reportOut = path.resolve(ROOT, arg('report-out', path.join(OUT_DIR, 'hethel-trigger-fixture.md')));
  const autopsy = readJson(autopsyPath);
  const { fixture, actionSet, validation } = buildTriggerFixtureFromAutopsy(autopsy);
  fixture.sourceAutopsy = rel(autopsyPath);
  mkdirSync(path.dirname(fixtureOut), { recursive: true });
  mkdirSync(path.dirname(actionsOut), { recursive: true });
  mkdirSync(path.dirname(reportOut), { recursive: true });
  writeFileSync(fixtureOut, `${JSON.stringify(fixture, null, 2)}\n`);
  writeFileSync(actionsOut, `${JSON.stringify(actionSet, null, 2)}\n`);
  writeFileSync(reportOut, renderMarkdown({ fixture, actionSet, validation }));
  console.log(`fixture json:   ${rel(fixtureOut)}`);
  console.log(`action set:     ${rel(actionsOut)}`);
  console.log(`fixture report: ${rel(reportOut)}`);
  console.log(`fixture hash:   ${fixture.fixtureHash}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
