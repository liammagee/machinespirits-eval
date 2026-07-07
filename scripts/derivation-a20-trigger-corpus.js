#!/usr/bin/env node
/**
 * A20 conduct-policy trigger corpus miner.
 *
 * Pure artifact analysis: reads existing dramatic derivation result files and
 * selector summaries, then emits candidate local policy triggers. No LLM calls,
 * no replay execution, and no runtime behavior changes.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const A20_TRIGGER_CORPUS_SCHEMA = 'dramatic-derivation.a20-conduct-policy.trigger-corpus.v0';
export const A20_POLICY_FIXTURES_SCHEMA = 'dramatic-derivation.a20-conduct-policy.fixtures.v0';

const DEFAULT_LOOP_DIR = 'exports/dramatic-derivation/loop';
const DEFAULT_EPISODE_DIR = 'exports/dramatic-derivation/episodes';
const DEFAULT_SELECTOR_SUMMARY = 'exports/dramatic-derivation/selector-consolidation-all.json';
const DEFAULT_OUT_DIR = 'exports/dramatic-derivation/a20-conduct-policy';

const FAILURE_LABELS = new Set([
  'policy_failure',
  'guard_failure',
  'generator_compliance_failure',
  'visible_projection_failure',
  'detector_artifact',
  'world_instability',
  'valid_negative',
]);

function rel(p) {
  return path.relative(process.cwd(), p);
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function oneLine(value, max = 180) {
  if (value == null) return null;
  const s = String(value).replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1)}...` : s;
}

function cell(value) {
  if (value == null || value === '') return ' ';
  return String(value).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function countBy(items, keyFn) {
  const out = {};
  for (const item of items) {
    const key = keyFn(item);
    out[key] = (out[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

function finalD(result) {
  const last = result.trajectory?.at?.(-1) ?? result.trajectory?.[result.trajectory.length - 1];
  if (Number.isFinite(last?.D)) return last.D;
  if (Number.isFinite(result.finalD)) return result.finalD;
  return null;
}

function inferArm(label = '') {
  const flags = [];
  if (/sameturn|same-turn/.test(label)) flags.push('same_turn');
  const noDebt = /nodebt|no-debt|no_proof_debt/.test(label);
  if (noDebt) flags.push('noProofDebt');
  else if (/(^|[-_])(debt|proof-debt|proof_debt|groupdebt)([-_]|$)/.test(label)) flags.push('proofDebt');

  let arm = 'unknown';
  if (/baseline/.test(label)) arm = 'baseline';
  else if (/selective/.test(label)) arm = 'selective';
  else if (/visible/.test(label)) arm = 'visible';
  else if (/hidden/.test(label)) arm = 'hidden';
  else if (/guard/.test(label)) arm = 'guarded';
  else if (/replay|episode/.test(label)) arm = 'episode';

  if (flags.includes('same_turn')) return `${arm}+same_turn`;
  if (flags.includes('proofDebt')) return `${arm}+proofDebt`;
  return arm;
}

function resultLabelFromFile(file) {
  return path.basename(path.dirname(file));
}

function collectResultFiles(root) {
  if (!root || !existsSync(root)) return [];
  const out = [];
  const visit = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = path.join(dir, name);
      let st;
      try {
        st = statSync(p);
      } catch {
        continue;
      }
      if (st.isDirectory()) visit(p);
      else if (name === 'result.json') out.push(p);
    }
  };
  visit(root);
  return out.sort();
}

function firstLineAtOrAfter(result, role, turn, maxAhead = 2) {
  return (
    (result.transcript || []).find(
      (line) => line.role === role && Number.isFinite(line.turn) && line.turn >= turn && line.turn <= turn + maxAhead,
    ) || null
  );
}

function nextLearnerLine(result, turn) {
  return (result.transcript || []).find((line) => line.role === 'learner' && line.turn >= turn) || null;
}

function actualMoveFamily(line) {
  const move = line?.meta?.move || null;
  const intent = move?.intent || null;
  if (!move && line?.meta?.assertionGate?.blocked) return 'block_assertion';
  if (line?.meta?.proofDebt?.active || intent === 'restore') return 'repair_dependency';
  if (intent === 'release') return 'release_next_evidence';
  if (intent === 'consolidate') return 'consolidate_subproof';
  if (intent === 'confront') return 'repair_dependency';
  if (intent === 'test') return 'ask_diagnostic';
  return intent || null;
}

function addTrigger(triggers, run, fields) {
  const trigger = {
    schema: A20_TRIGGER_CORPUS_SCHEMA,
    id: [
      run.label,
      fields.triggerType,
      `t${fields.turn ?? 'na'}`,
      fields.premiseId || fields.comparisonKey || fields.expectedMoveFamily || 'event',
    ]
      .join(':')
      .replace(/\s+/g, '_'),
    source: run.source,
    sourceKind: run.sourceKind,
    label: run.label,
    worldId: run.worldId,
    currentArm: run.currentArm,
    verdict: run.verdict,
    finalD: run.finalD,
    firstForcedTurn: run.firstForcedTurn,
    assertedGroundedTurn: run.assertedGroundedTurn,
    forcedAssertedGap: run.forcedAssertedGap,
    ...fields,
  };
  if (trigger.failureClass && !FAILURE_LABELS.has(trigger.failureClass)) {
    throw new Error(`unknown failureClass ${trigger.failureClass} for ${trigger.id}`);
  }
  triggers.push(trigger);
}

function summarizeRun(file, result) {
  const label = resultLabelFromFile(file);
  const source = rel(file);
  const forced = result.firstForcedTurn ?? null;
  const asserted = result.assertedGroundedTurn ?? null;
  return {
    label,
    source,
    sourceKind: source.includes('/episodes/') ? 'episode' : 'loop',
    worldId: result.worldId ?? null,
    currentArm: inferArm(label),
    verdict: result.verdict ?? null,
    turnsPlayed: result.turnsPlayed ?? null,
    finalD: finalD(result),
    firstForcedTurn: forced,
    assertedGroundedTurn: asserted,
    forcedAssertedGap: Number.isFinite(forced) && Number.isFinite(asserted) ? asserted - forced : null,
  };
}

function collectDependencyRepairTriggers(result, run) {
  const events = Array.isArray(result.corruption?.ledger) ? result.corruption.ledger : [];
  const triggers = [];
  const usedRepairs = new Set();
  const seenPremises = new Set();
  for (const decay of events.filter((event) => event.type === 'decay')) {
    if (seenPremises.has(decay.premiseId)) continue;
    seenPremises.add(decay.premiseId);
    const repairIndex = events.findIndex(
      (event, index) =>
        !usedRepairs.has(index) &&
        event.type === 'repair' &&
        event.premiseId === decay.premiseId &&
        event.turn >= decay.turn,
    );
    const repair = repairIndex >= 0 ? events[repairIndex] : null;
    if (repair) usedRepairs.add(repairIndex);
    if (!repair && run.verdict === 'grounded_anagnorisis') continue;

    const triggerTurn = repair?.turn ?? decay.turn + 1;
    const tutor = firstLineAtOrAfter(result, 'tutor', triggerTurn, 1);
    const learner = nextLearnerLine(result, triggerTurn);
    const actual = actualMoveFamily(tutor);
    const success = repair?.via === 'tutor' && actual === 'repair_dependency';
    addTrigger(triggers, run, {
      triggerType: 'dependency_repair_needed',
      turn: triggerTurn,
      premiseId: decay.premiseId ?? null,
      expectedMoveFamily: 'repair_dependency',
      actualMoveFamily: actual,
      status: success ? 'reference_success' : 'candidate_failure',
      failureClass: success ? null : repair?.via === 'tutor' ? 'generator_compliance_failure' : 'guard_failure',
      blockedActions: ['invite_final_assertion', 'release_unrelated_evidence'],
      localUptakeExpectation: `learner should re-seat ${decay.premiseId} or use it before advancing`,
      evidence: {
        decayTurn: decay.turn,
        repairTurn: repair?.turn ?? null,
        repairVia: repair?.via ?? null,
        tutorExcerpt: oneLine(tutor?.text),
        learnerExcerpt: oneLine(learner?.text),
      },
    });
  }
  return triggers;
}

function collectAssertionGapTriggers(result, run) {
  const triggers = [];
  if (Number.isFinite(run.forcedAssertedGap) && run.forcedAssertedGap > 0) {
    const tutor = firstLineAtOrAfter(result, 'tutor', run.firstForcedTurn, 1);
    const learner = nextLearnerLine(result, run.firstForcedTurn);
    addTrigger(triggers, run, {
      triggerType: 'final_assertion_available_but_delayed',
      turn: run.firstForcedTurn,
      premiseId: null,
      expectedMoveFamily: 'invite_final_assertion',
      actualMoveFamily: actualMoveFamily(tutor),
      status: 'candidate_failure',
      failureClass: 'policy_failure',
      blockedActions: ['continue_dependency_repair', 'release_unrelated_evidence'],
      localUptakeExpectation: 'learner should assert once the public board entails the answer',
      evidence: {
        gap: run.forcedAssertedGap,
        tutorExcerpt: oneLine(tutor?.text),
        learnerExcerpt: oneLine(learner?.text),
      },
    });
  }

  const blocked = (result.transcript || []).find(
    (line) => line.role === 'learner' && line.meta?.assertionGate?.blocked,
  );
  if (blocked) {
    addTrigger(triggers, run, {
      triggerType: 'unsupported_assertion_blocked',
      turn: blocked.turn,
      premiseId: null,
      expectedMoveFamily: 'block_assertion',
      actualMoveFamily: 'block_assertion',
      status: 'reference_success',
      failureClass: null,
      blockedActions: ['accept_unsupported_assertion', 'treat_local_fluency_as_entitlement'],
      localUptakeExpectation: 'learner should continue reasoning instead of taking an unsupported final answer',
      evidence: {
        attempted: blocked.meta.assertionGate.attempted ?? blocked.meta.asserts ?? null,
        reason: blocked.meta.assertionGate.reason ?? null,
        learnerExcerpt: oneLine(blocked.text),
      },
    });
  }
  return triggers;
}

function collectVisibleConflictTriggers(result, run) {
  const triggers = [];
  const line = (result.transcript || []).find((row) => {
    const d = row.meta?.releaseDecision;
    return (
      row.role === 'tutor' &&
      (d?.consolidationGuard?.visiblePushIgnored ||
        (d?.visibleGuard?.blocked && d?.played) ||
        (d?.visibleGuard?.forcedSafe && d?.hybridGuard?.accepted === false))
    );
  });
  if (!line) return triggers;
  const d = line.meta.releaseDecision;
  const expected =
    d?.visibleGuard?.forcedSafe && d?.hybridGuard?.accepted === false ? 'ask_diagnostic' : 'release_next_evidence';
  addTrigger(triggers, run, {
    triggerType: 'visible_hidden_conflict',
    turn: line.turn,
    premiseId: d?.played || d?.visibleGuard?.candidate || d?.pacingGuard?.candidate || null,
    expectedMoveFamily: expected,
    actualMoveFamily: actualMoveFamily(line),
    status: 'candidate_conflict',
    failureClass: 'visible_projection_failure',
    blockedActions: ['trust_visible_signal_without_hidden_check'],
    localUptakeExpectation:
      'policy should either follow certified hidden safety or ask a diagnostic when projection conflicts',
    evidence: {
      visibleGuard: d?.visibleGuard ?? null,
      pacingGuard: d?.pacingGuard ?? null,
      hybridGuard: d?.hybridGuard ?? null,
      tutorExcerpt: oneLine(line.text),
    },
  });
  return triggers;
}

function collectRecognitionTriggers(result, run) {
  const line = (result.transcript || []).find(
    (row) => row.role === 'tutor' && row.meta?.scene?.recognitionNeed?.active === true,
  );
  if (!line) return [];
  const hasRecognitionAct = Array.isArray(line.meta?.phaticRecognition) && line.meta.phaticRecognition.length > 0;
  const triggers = [];
  addTrigger(triggers, run, {
    triggerType: 'recognition_rupture_active',
    turn: line.turn,
    premiseId: line.meta?.move?.targetPremise ?? null,
    expectedMoveFamily: 'repair_recognition_rupture',
    actualMoveFamily: hasRecognitionAct ? 'repair_recognition_rupture' : actualMoveFamily(line),
    status: hasRecognitionAct ? 'reference_success' : 'candidate_failure',
    failureClass: hasRecognitionAct ? null : 'policy_failure',
    blockedActions: ['increase_proof_pressure_without_acknowledgement'],
    localUptakeExpectation: 'learner should acknowledge being heard before proof pressure resumes',
    evidence: {
      recognitionNeed: line.meta.scene.recognitionNeed,
      tutorExcerpt: oneLine(line.text),
    },
  });
  return triggers;
}

export function collectTriggersFromResult(file, result) {
  const run = summarizeRun(file, result);
  const triggers = [
    ...collectDependencyRepairTriggers(result, run),
    ...collectAssertionGapTriggers(result, run),
    ...collectVisibleConflictTriggers(result, run),
    ...collectRecognitionTriggers(result, run),
  ];
  return { run, triggers };
}

function selectorArmLabel(arms, armName) {
  return arms?.[armName]?.label ?? null;
}

export function collectSelectorSummaryTriggers(selectorSummaryPath = DEFAULT_SELECTOR_SUMMARY) {
  if (!selectorSummaryPath || !existsSync(selectorSummaryPath)) return [];
  const summary = readJson(selectorSummaryPath);
  const triggers = [];
  for (const comparison of summary.comparisons || []) {
    if (!comparison || !['strict_v_positive', 'visible_route_failure'].includes(comparison.classification)) continue;
    const intervention =
      comparison.firstSelectedGuardIntervention || comparison.selected?.guardInterventions?.[0] || null;
    const selected = comparison.selected || {};
    const hidden = comparison.arms?.hidden || null;
    const source = rel(selectorSummaryPath);
    const baseRun = {
      label: comparison.key?.replace(/\t/g, '-') || `${comparison.group}-r${comparison.run}`,
      source,
      sourceKind: 'selector_comparison',
      worldId: comparison.worldId ?? null,
      currentArm: selected.arm || 'selective',
      verdict: selected.grounded ? 'grounded_anagnorisis' : (selected.verdict ?? null),
      finalD: selected.finalD ?? null,
      firstForcedTurn: null,
      assertedGroundedTurn: null,
      forcedAssertedGap: null,
    };
    addTrigger(triggers, baseRun, {
      triggerType:
        comparison.classification === 'strict_v_positive'
          ? 'valid_alternative_route_candidate'
          : 'visible_route_negative_transfer',
      turn: intervention?.turn ?? comparison.divergence?.turn ?? null,
      premiseId: intervention?.premise ?? null,
      comparisonKey: comparison.key ?? null,
      expectedMoveFamily: comparison.classification === 'strict_v_positive' ? 'ask_diagnostic' : 'repair_dependency',
      actualMoveFamily: intervention ? `${intervention.guard}_${intervention.kind}` : null,
      status:
        comparison.classification === 'strict_v_positive'
          ? 'candidate_hidden_hurts'
          : 'candidate_visible_negative_transfer',
      failureClass: comparison.classification === 'strict_v_positive' ? null : 'visible_projection_failure',
      blockedActions:
        comparison.classification === 'strict_v_positive'
          ? ['continue_hidden_delay_without_diagnostic', 'repair_dependency_without_public_check']
          : ['trust_visible_route_without_certification'],
      localUptakeExpectation:
        comparison.classification === 'strict_v_positive'
          ? 'policy should test whether public conduct licenses a route not served by hidden delay'
          : 'policy should fail closed to hidden/proofDebt or ask diagnostic before visible intervention',
      evidence: {
        classification: comparison.classification,
        reasons: comparison.reasons || [],
        selectedLabel: selected.label ?? null,
        hiddenLabel: hidden?.label ?? null,
        baselineLabel: selectorArmLabel(comparison.arms, 'baseline'),
        visibleLabel: selectorArmLabel(comparison.arms, 'visible'),
        selectedGate: selected.gate ?? null,
        intervention,
        divergence: comparison.divergence ?? null,
      },
    });
  }
  return triggers;
}

function triggerScoreForDependencyFixture(trigger) {
  let score = 0;
  if (trigger.triggerType === 'dependency_repair_needed') score += 20;
  if (trigger.status === 'reference_success') score += 10;
  if (trigger.verdict === 'grounded_anagnorisis') score += 5;
  if ((trigger.currentArm || '').includes('proofDebt')) score += 100;
  if ((trigger.currentArm || '').startsWith('hidden')) score += 20;
  if (/guard|selective/.test(trigger.currentArm || '')) score += 3;
  if (trigger.worldId === 'world_004_withercombe') score += 2;
  return score;
}

export function chooseFirstPolicyFixtures(triggers) {
  const dependency = [...triggers]
    .filter((t) => t.triggerType === 'dependency_repair_needed' && t.status === 'reference_success')
    .sort(
      (a, b) => triggerScoreForDependencyFixture(b) - triggerScoreForDependencyFixture(a) || a.id.localeCompare(b.id),
    )[0];
  const hiddenHurts = [...triggers]
    .filter((t) => t.triggerType === 'valid_alternative_route_candidate')
    .sort((a, b) => (a.worldId === 'world_006_hethel' ? -1 : 1) || a.id.localeCompare(b.id))[0];
  return [
    dependency && {
      fixtureId: 'a20-fixture-001-dependency-repair-reference',
      role: 'dependency repair case where hidden + proofDebt is already right',
      triggerId: dependency.id,
      source: dependency.source,
      worldId: dependency.worldId,
      turn: dependency.turn,
      expectedMoveFamily: dependency.expectedMoveFamily,
      reason: 'Use this as the conservative positive-control fixture before adding policy freedom.',
    },
    hiddenHurts && {
      fixtureId: 'a20-fixture-002-hidden-hurts-candidate',
      role: 'case where hidden/proofDebt plausibly delays or over-repairs a learner-owned move',
      triggerId: hiddenHurts.id,
      source: hiddenHurts.source,
      worldId: hiddenHurts.worldId,
      turn: hiddenHurts.turn,
      expectedMoveFamily: hiddenHurts.expectedMoveFamily,
      reason:
        'Use this as the first counterweight against turning hidden + proofDebt into an implicit always-H policy.',
    },
  ].filter(Boolean);
}

function freezeFirstPolicyFixtures(summary) {
  const triggersById = new Map(summary.triggers.map((trigger) => [trigger.id, trigger]));
  return {
    schema: A20_POLICY_FIXTURES_SCHEMA,
    generatedAt: summary.generatedAt,
    sourceCorpusSchema: summary.schema,
    sourceRoots: summary.sourceRoots,
    selectorSummaryPath: summary.selectorSummaryPath,
    fixtures: summary.firstPolicyFixtures.map((fixture) => {
      const trigger = triggersById.get(fixture.triggerId);
      if (!trigger) throw new Error(`cannot freeze missing trigger ${fixture.triggerId}`);
      return {
        fixtureId: fixture.fixtureId,
        role: fixture.role,
        reason: fixture.reason,
        trigger,
      };
    }),
  };
}

export function analyzeArtifacts({
  roots = [DEFAULT_LOOP_DIR, DEFAULT_EPISODE_DIR],
  selectorSummaryPath = DEFAULT_SELECTOR_SUMMARY,
} = {}) {
  const files = roots.flatMap(collectResultFiles);
  const runs = [];
  const triggers = [];
  const skipped = [];

  for (const file of files) {
    try {
      const result = readJson(file);
      const mined = collectTriggersFromResult(file, result);
      runs.push(mined.run);
      triggers.push(...mined.triggers);
    } catch (err) {
      skipped.push({ source: rel(file), reason: err.message });
    }
  }

  try {
    triggers.push(...collectSelectorSummaryTriggers(selectorSummaryPath));
  } catch (err) {
    skipped.push({ source: rel(selectorSummaryPath), reason: err.message });
  }

  triggers.sort(
    (a, b) =>
      (a.worldId || '').localeCompare(b.worldId || '') ||
      a.triggerType.localeCompare(b.triggerType) ||
      (a.turn ?? Infinity) - (b.turn ?? Infinity) ||
      a.id.localeCompare(b.id),
  );

  return {
    schema: A20_TRIGGER_CORPUS_SCHEMA,
    generatedAt: new Date().toISOString(),
    sourceRoots: roots.map((root) => rel(root)),
    selectorSummaryPath: selectorSummaryPath && existsSync(selectorSummaryPath) ? rel(selectorSummaryPath) : null,
    runCount: runs.length,
    triggerCount: triggers.length,
    counts: {
      byType: countBy(triggers, (t) => t.triggerType),
      byWorld: countBy(triggers, (t) => t.worldId || 'unknown'),
      byStatus: countBy(triggers, (t) => t.status || 'unknown'),
      byFailureClass: countBy(triggers, (t) => t.failureClass || 'none'),
    },
    firstPolicyFixtures: chooseFirstPolicyFixtures(triggers),
    triggers,
    skipped,
  };
}

function renderCounts(counts) {
  return Object.entries(counts)
    .map(([key, value]) => `${key}:${value}`)
    .join(', ');
}

export function renderMarkdown(summary) {
  const lines = [];
  lines.push('# A20 Conduct-Policy Trigger Corpus');
  lines.push('');
  lines.push(`Generated: ${summary.generatedAt}`);
  lines.push('');
  lines.push(
    'Pure artifact analysis. No LLM calls, no replay execution, and no runtime policy changes. ' +
      'The corpus is a fixture-selection surface for the A20 conduct-policy compiler.',
  );
  lines.push('');
  lines.push('## Sources');
  lines.push('');
  lines.push(`- Result roots: ${summary.sourceRoots.map((root) => `\`${root}\``).join(', ')}`);
  lines.push(`- Selector summary: ${summary.selectorSummaryPath ? `\`${summary.selectorSummaryPath}\`` : 'not found'}`);
  lines.push(`- Runs mined: ${summary.runCount}`);
  lines.push(`- Triggers emitted: ${summary.triggerCount}`);
  lines.push('- Frozen first-fixture JSON: `first-policy-fixtures.json`');
  lines.push('');
  lines.push('## Counts');
  lines.push('');
  lines.push(`- By type: ${renderCounts(summary.counts.byType) || 'none'}`);
  lines.push(`- By world: ${renderCounts(summary.counts.byWorld) || 'none'}`);
  lines.push(`- By status: ${renderCounts(summary.counts.byStatus) || 'none'}`);
  lines.push(`- By failure class: ${renderCounts(summary.counts.byFailureClass) || 'none'}`);
  lines.push('');
  lines.push('## First Policy Fixtures');
  lines.push('');
  if (summary.firstPolicyFixtures.length) {
    lines.push('| fixture | role | world | source | turn | expected move | trigger |');
    lines.push('|---|---|---|---|---:|---|---|');
    for (const fixture of summary.firstPolicyFixtures) {
      lines.push(
        `| ${cell(fixture.fixtureId)} | ${cell(fixture.role)} | ${cell(fixture.worldId)} | ` +
          `\`${cell(fixture.source)}\` | ${cell(fixture.turn)} | ${cell(fixture.expectedMoveFamily)} | ` +
          `\`${cell(fixture.triggerId)}\` |`,
      );
    }
  } else {
    lines.push('- none selected');
  }
  lines.push('');
  for (const fixture of summary.firstPolicyFixtures) {
    lines.push(`- ${fixture.fixtureId}: ${fixture.reason}`);
  }
  lines.push('');
  lines.push('## Trigger Table');
  lines.push('');
  lines.push(
    '| id | type | world | arm | turn | expected | actual | status | failure | blocked actions | source | evidence |',
  );
  lines.push('|---|---|---|---|---:|---|---|---|---|---|---|---|');
  for (const t of summary.triggers) {
    const evidence =
      t.evidence?.reason ||
      t.evidence?.classification ||
      t.evidence?.tutorExcerpt ||
      t.evidence?.learnerExcerpt ||
      t.localUptakeExpectation;
    lines.push(
      `| \`${cell(t.id)}\` | ${cell(t.triggerType)} | ${cell(t.worldId)} | ${cell(t.currentArm)} | ` +
        `${cell(t.turn)} | ${cell(t.expectedMoveFamily)} | ${cell(t.actualMoveFamily)} | ${cell(t.status)} | ` +
        `${cell(t.failureClass || 'none')} | ${cell((t.blockedActions || []).join(', '))} | ` +
        `\`${cell(t.source)}\` | ${cell(oneLine(evidence, 110))} |`,
    );
  }
  if (summary.skipped.length) {
    lines.push('');
    lines.push('## Skipped');
    lines.push('');
    for (const skipped of summary.skipped) {
      lines.push(`- \`${skipped.source}\`: ${skipped.reason}`);
    }
  }
  lines.push('');
  lines.push('## Caveats');
  lines.push('');
  lines.push('- Trigger labels are pre-policy fixture candidates, not outcome claims.');
  lines.push(
    '- Selector-comparison triggers import report-level classifications and should be treated as candidates for replay/fresh validation.',
  );
  lines.push('- Episode-derived triggers preserve their original prefix and are debugging evidence only.');
  lines.push('- A conduct policy should be implemented only after fixtures are frozen from this corpus.');
  lines.push('');
  return lines.join('\n');
}

export function writeOutputs(summary, outDir = DEFAULT_OUT_DIR) {
  mkdirSync(outDir, { recursive: true });
  const jsonlPath = path.join(outDir, 'trigger-corpus.jsonl');
  const summaryPath = path.join(outDir, 'trigger-corpus-summary.json');
  const reportPath = path.join(outDir, 'trigger-corpus-report.md');
  const fixturesPath = path.join(outDir, 'first-policy-fixtures.json');
  writeFileSync(jsonlPath, `${summary.triggers.map((t) => JSON.stringify(t)).join('\n')}\n`);
  writeFileSync(
    summaryPath,
    JSON.stringify(
      {
        schema: summary.schema,
        generatedAt: summary.generatedAt,
        sourceRoots: summary.sourceRoots,
        selectorSummaryPath: summary.selectorSummaryPath,
        runCount: summary.runCount,
        triggerCount: summary.triggerCount,
        counts: summary.counts,
        firstPolicyFixtures: summary.firstPolicyFixtures,
        skipped: summary.skipped,
      },
      null,
      2,
    ),
  );
  writeFileSync(reportPath, renderMarkdown(summary));
  writeFileSync(fixturesPath, JSON.stringify(freezeFirstPolicyFixtures(summary), null, 2));
  return { jsonlPath, summaryPath, reportPath, fixturesPath };
}

export function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    roots: [DEFAULT_LOOP_DIR, DEFAULT_EPISODE_DIR],
    selectorSummaryPath: DEFAULT_SELECTOR_SUMMARY,
    outDir: DEFAULT_OUT_DIR,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--loop') args.roots[0] = argv[++i];
    else if (arg === '--episodes') args.roots[1] = argv[++i];
    else if (arg === '--root') args.roots.push(argv[++i]);
    else if (arg === '--selector-summary') args.selectorSummaryPath = argv[++i];
    else if (arg === '--out') args.outDir = argv[++i];
    else if (arg === '--no-episodes') args.roots = args.roots.filter((root) => root !== DEFAULT_EPISODE_DIR);
    else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  args.roots = [...new Set(args.roots.filter(Boolean))];
  return args;
}

function usage() {
  return `Usage:
  node scripts/derivation-a20-trigger-corpus.js [options]

Options:
  --loop <dir>              Loop result root. Default: ${DEFAULT_LOOP_DIR}
  --episodes <dir>          Episode result root. Default: ${DEFAULT_EPISODE_DIR}
  --no-episodes             Mine loop artifacts only.
  --root <dir>              Additional result root; can be repeated.
  --selector-summary <file> Selector consolidation JSON. Default: ${DEFAULT_SELECTOR_SUMMARY}
  --out <dir>               Output directory. Default: ${DEFAULT_OUT_DIR}
`;
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(usage());
    return;
  }
  const summary = analyzeArtifacts({ roots: args.roots, selectorSummaryPath: args.selectorSummaryPath });
  const outputs = writeOutputs(summary, args.outDir);
  console.log(`A20 trigger corpus written: ${outputs.jsonlPath}`);
  console.log(`summary written:            ${outputs.summaryPath}`);
  console.log(`report written:             ${outputs.reportPath}`);
  console.log(`fixtures written:           ${outputs.fixturesPath}`);
  console.log(`runs mined: ${summary.runCount}; triggers emitted: ${summary.triggerCount}`);
  console.log(`first fixtures: ${summary.firstPolicyFixtures.map((f) => f.fixtureId).join(', ') || 'none'}`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main();
  } catch (err) {
    console.error(err.stack || err.message);
    process.exitCode = 1;
  }
}
