#!/usr/bin/env node
/**
 * A21 Hethel contrastive autopsy.
 *
 * Pure local artifact pass: compares the hidden+proofDebt Hethel success with
 * failed overlay/replay artifacts, locates the first material action-value
 * divergence, and writes a compact report. No LLM calls and no replay execution.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const OUT_DIR = 'exports/dramatic-derivation/a21-action-value';
const DEFAULT_HIDDEN_RUN = 'exports/dramatic-derivation/loop/hethel-phase5g-a20-fresh-hidden-r1';
const DEFAULT_FAILED_RUN = 'exports/dramatic-derivation/loop/hethel-phase5g-a20-fresh-selective-v4-r1';
const DEFAULT_COMPARE_RUNS = [
  'exports/dramatic-derivation/episodes/phase6-hethel-progress-policy-replay-from-t4',
  'exports/dramatic-derivation/episodes/phase6-hethel-safe-now-replay-from-t4',
  'exports/dramatic-derivation/episodes/phase6-hethel-entitlement-replay-from-t4',
];

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : fallback;
}

function flag(name) {
  return process.argv.includes(`--${name}`);
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function resolveRunDir(input) {
  const resolved = path.resolve(ROOT, input);
  if (existsSync(path.join(resolved, 'result.json'))) return resolved;
  if (resolved.endsWith('result.json') || resolved.endsWith('diagnosis.json')) return path.dirname(resolved);
  throw new Error(`a21 autopsy: missing run artifact directory ${input}`);
}

function rel(file) {
  return path.relative(ROOT, file);
}

function truncate(value, max = 140) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

function byTurn(items = []) {
  const out = new Map();
  for (const item of items) {
    if (!Number.isFinite(Number(item?.turn))) continue;
    out.set(Number(item.turn), item);
  }
  return out;
}

function transcriptByTurn(transcript = []) {
  const grouped = new Map();
  for (const entry of transcript) {
    const turn = Number(entry?.turn);
    if (!Number.isFinite(turn)) continue;
    if (!grouped.has(turn)) grouped.set(turn, { turn, director: [], tutor: null, learner: null, all: [] });
    const row = grouped.get(turn);
    row.all.push(entry);
    if (entry.role === 'director') row.director.push(entry);
    if (entry.role === 'tutor') row.tutor = entry;
    if (entry.role === 'learner') row.learner = entry;
  }
  return grouped;
}

function intentToFamily({ intent, release, proofDebt } = {}) {
  if (proofDebt?.active || intent === 'restore') return 'repair_dependency';
  if (release || intent === 'release') return 'release_next_evidence';
  if (intent === 'test' || intent === 'confront') return 'ask_diagnostic';
  if (intent === 'consolidate' || intent === 'orient') return 'consolidate_subproof';
  return intent || 'none';
}

function conductSummary(policy) {
  if (!policy) return null;
  if (policy.active === false) return { active: false, reasonCode: policy.reasonCode || 'inactive' };
  return {
    active: true,
    selectedMoveFamily: policy.selectedMoveFamily || null,
    reasonCode: policy.reasonCode || null,
    triggerType: policy.triggerType || null,
    targetPremise: policy.targetPremise || null,
    enforcement: policy.enforcement
      ? {
          enabled: policy.enforcement.enabled === true,
          applied: policy.enforcement.applied === true,
          reason: policy.enforcement.reason || null,
        }
      : null,
    generatorOk: policy.generatorCompliance?.ok ?? null,
  };
}

function duePremises(decision) {
  const due = [];
  const safeTurns = decision?.pacingGuard?.safeTurns || {};
  for (const [premise, turns] of Object.entries(safeTurns)) {
    if (Array.isArray(turns) && turns.map(Number).includes(Number(decision.turn))) due.push(premise);
  }
  if (decision?.scheduledTurn === decision?.turn && decision?.played) due.push(decision.played);
  return [...new Set(due)];
}

function proofDebtAt(result, turn) {
  const detection = (result.proofDebt?.detections || []).find((row) => Number(row.turn) === turn) || null;
  const action = (result.proofDebt?.actions || []).find((row) => Number(row.turn) === turn) || null;
  if (!detection && !action) return null;
  return {
    detected: Boolean(detection),
    action: Boolean(action),
    target: action?.target || detection?.debts?.[0]?.premiseId || null,
    repaired: action?.repaired ?? null,
    moveIntent: action?.moveIntent || null,
  };
}

function summarizeRun(runDir, role) {
  const result = readJson(path.join(runDir, 'result.json'));
  const diagnosis = readJson(path.join(runDir, 'diagnosis.json'));
  const grouped = transcriptByTurn(result.transcript || []);
  const trajectory = byTurn(result.trajectory || []);
  const releaseDecisionMap = byTurn(diagnosis.releaseDeviations?.decisions || []);
  const maxTurn = Math.max(
    Number(result.turnsPlayed || diagnosis.turnsPlayed || 0),
    ...[...grouped.keys()],
    ...[...trajectory.keys()],
  );
  const turns = [];
  for (let turn = 1; turn <= maxTurn; turn += 1) {
    const entries = grouped.get(turn) || { turn, director: [], tutor: null, learner: null, all: [] };
    const tutor = entries.tutor;
    const learner = entries.learner;
    const move = tutor?.meta?.move || {};
    const releaseDecision = tutor?.meta?.releaseDecision || releaseDecisionMap.get(turn) || null;
    const proofDebt = tutor?.meta?.proofDebt || proofDebtAt(result, turn);
    const release = tutor?.meta?.release || move.release || releaseDecision?.played || null;
    const actionFamily = intentToFamily({ intent: move.intent, release, proofDebt });
    const dAfter = trajectory.get(turn)?.D ?? diagnosis.dCurve?.[turn - 1] ?? null;
    const dBefore = trajectory.get(turn - 1)?.D ?? (turn === 1 ? null : diagnosis.dCurve?.[turn - 2] ?? null);
    turns.push({
      turn,
      DBefore: dBefore,
      DAfter: dAfter,
      tutorActionFamily: actionFamily,
      tutorMove: {
        figure: move.figure || null,
        intent: move.intent || null,
        targetPremise: move.targetPremise || move.target_premise || null,
      },
      tutorActionSummary: `${actionFamily}${move.targetPremise ? `:${move.targetPremise}` : ''}${
        release ? ` release=${release}` : ''
      }`,
      learnerSummary: truncate(learner?.text || ''),
      tutorSummary: truncate(tutor?.text || ''),
      directorReleases: entries.director.map((line) => line.meta?.release).filter(Boolean),
      released: release,
      releaseDue: releaseDecision ? duePremises(releaseDecision) : [],
      releaseDecision: releaseDecision
        ? {
            played: releaseDecision.played || null,
            scheduledTurn: releaseDecision.scheduledTurn ?? null,
            offset: releaseDecision.offset ?? null,
            forced: releaseDecision.forced || null,
            overridden: releaseDecision.overridden === true,
            visibleBlocked: releaseDecision.visibleGuard?.blocked === true,
            visibleReason: releaseDecision.visibleGuard?.reason || null,
            consolidationHeld: releaseDecision.consolidationGuard?.held === true,
            consolidationReason: releaseDecision.consolidationGuard?.reason || null,
            conductPolicyEnforcement: releaseDecision.conductPolicyEnforcement || null,
            safeTurns: releaseDecision.pacingGuard?.safeTurns || {},
          }
        : null,
      proofDebt,
      conductPolicy: conductSummary(tutor?.meta?.conductPolicy),
    });
  }
  return {
    role,
    label: diagnosis.label || path.basename(runDir),
    runDir: rel(runDir),
    worldId: result.worldId || diagnosis.worldId || null,
    verdict: diagnosis.verdict || result.verdict || null,
    turnsPlayed: diagnosis.turnsPlayed || result.turnsPlayed || null,
    firstForcedTurn: diagnosis.firstForcedTurn ?? result.firstForcedTurn ?? null,
    assertedGroundedTurn: diagnosis.assertedGroundedTurn ?? result.assertedGroundedTurn ?? null,
    forcedToAssertedGap: diagnosis.forcedToAssertedGap ?? null,
    proofDebt: diagnosis.proofDebt || null,
    releaseDeviations: diagnosis.releaseDeviations
      ? {
          played: diagnosis.releaseDeviations.played,
          onSchedule: diagnosis.releaseDeviations.onSchedule,
          early: diagnosis.releaseDeviations.early,
          held: diagnosis.releaseDeviations.held,
          forced: diagnosis.releaseDeviations.forced,
          overridden: diagnosis.releaseDeviations.overridden,
          reasons: diagnosis.releaseDeviations.reasons || [],
        }
      : null,
    prefixIntegrity: diagnosis.episode?.prefixIntegrity || null,
    turns,
  };
}

function findPrimaryDivergence(hidden, failed) {
  const failedRows = byTurn(failed.turns);
  const hiddenRows = byTurn(hidden.turns);
  const maxTurn = Math.min(hidden.turnsPlayed || hidden.turns.length, failed.turnsPlayed || failed.turns.length);
  for (let turn = 1; turn <= maxTurn; turn += 1) {
    const h = hiddenRows.get(turn);
    const f = failedRows.get(turn);
    if (!h || !f) continue;
    const hiddenMaterialRelease = Boolean(h.released && h.releaseDue.includes(h.released));
    const failedMissedDueRelease = Boolean(!f.released && (f.releaseDue.includes(h.released) || h.releaseDue.length));
    const dDiverged = h.DAfter != null && f.DAfter != null && Number(h.DAfter) < Number(f.DAfter);
    if ((hiddenMaterialRelease && failedMissedDueRelease) || (hiddenMaterialRelease && dDiverged)) {
      const failedDiagnostic = f.tutorActionFamily === 'ask_diagnostic' || f.conductPolicy?.selectedMoveFamily === 'ask_diagnostic';
      return {
        triggerTurn: turn,
        prefixThroughTurn: Math.max(0, turn - 1),
        primaryLabel: 'release_starvation',
        secondaryLabels: failedDiagnostic ? ['diagnostic_overuse'] : [],
        summary:
          'The successful hidden+proofDebt run releases the proof-critical p_point on schedule; the failed overlay keeps asking/holding and delays the release, so D does not fall at the trigger.',
        hiddenAction: h,
        failedAction: f,
        observedDownstreamEffect: {
          hiddenFinalVerdict: hidden.verdict,
          failedFinalVerdict: failed.verdict,
          hiddenDAtTrigger: h.DAfter,
          failedDAtTrigger: f.DAfter,
          hiddenFirstForcedTurn: hidden.firstForcedTurn,
          failedFirstForcedTurn: failed.firstForcedTurn,
        },
      };
    }
  }
  return {
    triggerTurn: null,
    prefixThroughTurn: null,
    primaryLabel: 'detector_artifact',
    secondaryLabels: [],
    summary: 'No material release/proof-distance divergence was detected by the local autopsy heuristic.',
    hiddenAction: null,
    failedAction: null,
    observedDownstreamEffect: {},
  };
}

function cell(value) {
  if (Array.isArray(value)) return value.length ? value.join(', ') : ' ';
  if (value == null || value === '') return 'n/a';
  return String(value).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function compactAction(row) {
  if (!row) return ' ';
  const conduct = row.conductPolicy?.active ? `; policy=${row.conductPolicy.selectedMoveFamily}/${row.conductPolicy.reasonCode}` : '';
  const offset = row.releaseDecision?.offset != null ? `; offset=${row.releaseDecision.offset}` : '';
  return `${row.tutorActionFamily}:${row.tutorMove.targetPremise || '-'}${row.released ? `; release=${row.released}` : ''}${conduct}${offset}`;
}

function renderMarkdown(report) {
  const lines = [];
  const { hidden, failedOverlay, primaryDivergence } = report;
  lines.push('# A21 Hethel Contrastive Autopsy');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push('');
  lines.push('## Sources');
  lines.push('');
  lines.push(`- Hidden success: \`${hidden.runDir}\` -> ${hidden.verdict}, forced ${cell(hidden.firstForcedTurn)}, asserted ${cell(hidden.assertedGroundedTurn)}`);
  lines.push(`- Failed overlay: \`${failedOverlay.runDir}\` -> ${failedOverlay.verdict}, forced ${cell(failedOverlay.firstForcedTurn)}, asserted ${cell(failedOverlay.assertedGroundedTurn)}`);
  for (const run of report.comparisonRuns) {
    lines.push(`- Comparator: \`${run.runDir}\` -> ${run.verdict}; prefix ${run.prefixIntegrity?.ok === true ? 'ok' : 'n/a'}`);
  }
  lines.push('');
  lines.push('## Primary Trigger');
  lines.push('');
  lines.push(`- Trigger turn: ${cell(primaryDivergence.triggerTurn)}`);
  lines.push(`- Prefix through turn: ${cell(primaryDivergence.prefixThroughTurn)}`);
  lines.push(`- Primary label: \`${primaryDivergence.primaryLabel}\``);
  lines.push(`- Secondary labels: ${cell(primaryDivergence.secondaryLabels)}`);
  lines.push(`- Interpretation: ${primaryDivergence.summary}`);
  lines.push('');
  lines.push('## Turn Table');
  lines.push('');
  lines.push('| turn | hidden D | hidden action | failed D | failed action | failed learner summary | note |');
  lines.push('|---:|---:|---|---:|---|---|---|');
  const hiddenRows = byTurn(hidden.turns);
  const failedRows = byTurn(failedOverlay.turns);
  const maxTurn = Math.min(12, Math.max(hidden.turnsPlayed || 0, failedOverlay.turnsPlayed || 0));
  for (let turn = 1; turn <= maxTurn; turn += 1) {
    const h = hiddenRows.get(turn);
    const f = failedRows.get(turn);
    const note =
      turn === primaryDivergence.triggerTurn
        ? 'PRIMARY DIVERGENCE'
        : f?.releaseDecision?.visibleReason || f?.conductPolicy?.reasonCode || '';
    lines.push(
      `| ${turn} | ${cell(h?.DAfter)} | ${cell(compactAction(h))} | ${cell(f?.DAfter)} | ${cell(
        compactAction(f),
      )} | ${cell(f?.learnerSummary)} | ${cell(note)} |`,
    );
  }
  lines.push('');
  lines.push('## Comparator Snapshot');
  lines.push('');
  lines.push('| run | verdict | t4 action | t4 D | release deviations | later failure signal |');
  lines.push('|---|---|---|---:|---|---|');
  for (const run of report.comparisonRuns) {
    const row = byTurn(run.turns).get(primaryDivergence.triggerTurn);
    const later = run.verdict === 'cap_reached' ? 'cap reached before grounding' : run.verdict;
    lines.push(
      `| ${cell(run.label)} | ${cell(run.verdict)} | ${cell(compactAction(row))} | ${cell(row?.DAfter)} | ` +
        `${cell(`held=${run.releaseDeviations?.held ?? 0}, early=${run.releaseDeviations?.early ?? 0}`)} | ${cell(later)} |`,
    );
  }
  lines.push('');
  lines.push('## Interpretation');
  lines.push('');
  lines.push(
    'The first material divergence is not a new world type. It is a concrete action choice at a proof-critical release point: hidden+proofDebt releases `p_point`; the failed overlay spends the turn on diagnostic/consolidation pressure and delays the release.',
  );
  lines.push(
    'This supports A21 as an action-value microbench: compare candidate actions from the same t4 prefix before proposing any runtime policy patch.',
  );
  return `${lines.join('\n')}\n`;
}

export function buildAutopsy({ hiddenRun, failedRun, comparisonRuns = [] }) {
  const hidden = summarizeRun(resolveRunDir(hiddenRun), 'hidden_success');
  const failedOverlay = summarizeRun(resolveRunDir(failedRun), 'failed_overlay');
  const comparisons = comparisonRuns.map((run) => summarizeRun(resolveRunDir(run), 'comparator'));
  const primaryDivergence = findPrimaryDivergence(hidden, failedOverlay);
  return {
    schema: 'dramatic-derivation.a21.hethel-autopsy.v0',
    generatedAt: new Date().toISOString(),
    hidden,
    failedOverlay,
    comparisonRuns: comparisons,
    primaryDivergence,
  };
}

function main() {
  const outMd = path.resolve(ROOT, arg('out', path.join(OUT_DIR, 'hethel-autopsy.md')));
  const outJson = path.resolve(ROOT, arg('json-out', outMd.replace(/\.md$/u, '.json')));
  const compareArg = arg('compare-runs', null);
  const comparisonRuns = compareArg ? compareArg.split(',').map((item) => item.trim()).filter(Boolean) : DEFAULT_COMPARE_RUNS;
  const report = buildAutopsy({
    hiddenRun: arg('hidden-run', DEFAULT_HIDDEN_RUN),
    failedRun: arg('failed-run', DEFAULT_FAILED_RUN),
    comparisonRuns: flag('no-comparators') ? [] : comparisonRuns,
  });
  mkdirSync(path.dirname(outMd), { recursive: true });
  mkdirSync(path.dirname(outJson), { recursive: true });
  writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(outMd, renderMarkdown(report));
  console.log(`autopsy json:   ${rel(outJson)}`);
  console.log(`autopsy report: ${rel(outMd)}`);
  console.log(`trigger: turn ${report.primaryDivergence.triggerTurn} (${report.primaryDivergence.primaryLabel})`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
