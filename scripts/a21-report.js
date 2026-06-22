#!/usr/bin/env node
/**
 * A21 policy patch proposal renderer.
 *
 * Phase 8 only: convert action-value evidence into a proposed-only policy patch
 * document. This script does not modify runtime policy or authorize replay/paid
 * validation.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildA21PolicyPatchProposal } from '../services/dramaticDerivation/index.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const OUT_DIR = 'exports/dramatic-derivation/a21-action-value';
const DEFAULT_ANALYSIS = path.join(OUT_DIR, 'action-value-report.json');
const DEFAULT_FIXTURE = path.join(OUT_DIR, 'hethel-trigger-fixture.json');
const DEFAULT_OUT = path.join(OUT_DIR, 'policy-patch-proposal.md');
const DEFAULT_JSON_OUT = path.join(OUT_DIR, 'policy-patch-proposal.json');

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

function rel(file) {
  return path.relative(ROOT, file);
}

function yamlScalar(value) {
  if (Array.isArray(value)) return `[${value.map(yamlScalar).join(', ')}]`;
  if (value && typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'string') return JSON.stringify(value);
  return String(value);
}

function renderPatchYaml(proposal) {
  const lines = [];
  lines.push(`policy_patch_id: ${proposal.policy_patch_id}`);
  lines.push(`status: ${proposal.status}`);
  lines.push(`promoted: ${proposal.promoted}`);
  lines.push(`runtime_behavior_changed: ${proposal.runtime_behavior_changed}`);
  lines.push('applies_when:');
  for (const [key, value] of Object.entries(proposal.applies_when)) {
    lines.push(`  ${key}: ${yamlScalar(value)}`);
  }
  lines.push('prefer:');
  for (const [key, value] of Object.entries(proposal.prefer)) {
    lines.push(`  ${key}: ${yamlScalar(value)}`);
  }
  lines.push('block:');
  for (const item of proposal.block) lines.push(`  - ${item}`);
  lines.push('diagnostic_budget:');
  for (const [key, value] of Object.entries(proposal.diagnostic_budget)) {
    lines.push(`  ${key}: ${yamlScalar(value)}`);
  }
  lines.push('release_conditions:');
  for (const [key, value] of Object.entries(proposal.release_conditions)) {
    lines.push(`  ${key}: ${yamlScalar(value)}`);
  }
  lines.push('expected_transition:');
  for (const [key, value] of Object.entries(proposal.expected_transition)) {
    lines.push(`  ${JSON.stringify(key)}: ${yamlScalar(value)}`);
  }
  lines.push('kill_if:');
  for (const item of proposal.replay_gate.kill_if) lines.push(`  - ${item}`);
  return lines.join('\n');
}

function renderMarkdown({ proposal, analysisPath, fixturePath, command }) {
  const lines = [];
  lines.push('# A21 Proposed Policy Patch');
  lines.push('');
  lines.push(`Generated: ${proposal.generatedAt}`);
  lines.push('');
  lines.push('## Boundary');
  lines.push('');
  lines.push('- Status: proposed only.');
  lines.push('- Runtime policy changes: none.');
  lines.push('- Selector defaults changed: false.');
  lines.push('- Conduct policy changed: false.');
  lines.push('- Fresh paid run authorized: false.');
  lines.push('- Next required gate: Phase 9 Hethel replay against hidden+proofDebt.');
  lines.push('');
  lines.push('## Sources');
  lines.push('');
  lines.push(`- Analysis: \`${rel(analysisPath)}\``);
  lines.push(`- Fixture: \`${rel(fixturePath)}\``);
  lines.push(`- Fixture hash: \`${proposal.source.fixtureHash}\``);
  lines.push(`- Decision category: \`${proposal.source.decisionCategory}\``);
  lines.push(`- Command: \`${command}\``);
  lines.push('');
  lines.push('## Patch Spec');
  lines.push('');
  lines.push('```yaml');
  lines.push(renderPatchYaml(proposal));
  lines.push('```');
  lines.push('');
  lines.push('## Evidence');
  lines.push('');
  lines.push('| comparator | action | reward | mean D delta | delayed release | aporia | notes |');
  lines.push('|---|---|---:|---:|---:|---:|---|');
  const top = proposal.evidence.topAction;
  const diagnostic = proposal.evidence.diagnosticComparator;
  const repair = proposal.evidence.repairComparator;
  const consolidation = proposal.evidence.consolidationComparator;
  if (top) {
    lines.push(
      `| preferred | ${top.actionId} | ${top.meanReward} | ${top.meanDDelta} | 0 | ${top.aporiaRate} | on-schedule public release |`,
    );
  }
  if (diagnostic) {
    lines.push(
      `| failed overlay pattern | ${diagnostic.actionId} | ${diagnostic.meanReward} | 0 | ${diagnostic.delayedReleaseRate} | ${diagnostic.aporiaRate} | repeated diagnostic after budget exhaustion |`,
    );
  }
  if (repair) {
    lines.push(
      `| close alternative | ${repair.actionId} | ${repair.meanReward} |  | ${repair.delayedReleaseRate} |  | owns target but holds current release |`,
    );
  }
  if (consolidation) {
    lines.push(
      `| lower alternative | ${consolidation.actionId} | ${consolidation.meanReward} |  | ${consolidation.delayedReleaseRate} |  | release starvation risk |`,
    );
  }
  lines.push('');
  lines.push('## Replay Gate');
  lines.push('');
  lines.push(`- S0: ${proposal.replay_gate.candidateArms.S0}`);
  lines.push(`- S1: ${proposal.replay_gate.candidateArms.S1}`);
  lines.push('');
  lines.push('Pass only if:');
  for (const item of proposal.replay_gate.pass_if) lines.push(`- ${item}`);
  lines.push('');
  lines.push('Stop if:');
  for (const item of proposal.replay_gate.kill_if) lines.push(`- ${item}`);
  lines.push('');
  lines.push('## Known Failure Modes');
  lines.push('');
  for (const item of proposal.known_failure_modes) lines.push(`- ${item}`);
  lines.push('');
  lines.push('## Interpretation');
  lines.push('');
  if (proposal.status === 'proposed_only') {
    lines.push(
      'The patch is deliberately narrower than A20 conduct policy: it applies only when a Hethel-like visible/hidden diagnostic loop has exhausted its public budget and the current public release is authorized. It proposes releasing the public `p_point` rather than repeating diagnostics or consolidating while the due release is held.',
    );
  } else {
    lines.push('The action-value analysis did not justify a proposed patch. No replay or paid run should follow.');
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function main() {
  const smoke = flag('smoke');
  const analysisPath = path.resolve(ROOT, arg('analysis', DEFAULT_ANALYSIS));
  const fixturePath = path.resolve(ROOT, arg('fixture', DEFAULT_FIXTURE));
  const outPath = path.resolve(ROOT, arg('out', smoke ? path.join(OUT_DIR, 'policy-patch-proposal-smoke.md') : DEFAULT_OUT));
  const jsonOutPath = path.resolve(
    ROOT,
    arg('json-out', smoke ? path.join(OUT_DIR, 'policy-patch-proposal-smoke.json') : DEFAULT_JSON_OUT),
  );
  if (!existsSync(analysisPath)) throw new Error(`a21-report: missing analysis ${analysisPath}`);
  if (!existsSync(fixturePath)) throw new Error(`a21-report: missing fixture ${fixturePath}`);
  const analysis = readJson(analysisPath);
  const fixture = readJson(fixturePath);
  const proposal = buildA21PolicyPatchProposal({ analysis, fixture });
  const command = `node scripts/a21-report.js --analysis ${rel(analysisPath)} --out ${rel(outPath)}`;
  mkdirSync(path.dirname(outPath), { recursive: true });
  mkdirSync(path.dirname(jsonOutPath), { recursive: true });
  writeFileSync(jsonOutPath, `${JSON.stringify(proposal, null, 2)}\n`);
  writeFileSync(outPath, renderMarkdown({ proposal, analysisPath, fixturePath, command }));
  console.log(`proposal: ${rel(outPath)}`);
  console.log(`json:     ${rel(jsonOutPath)}`);
  console.log(`status:   ${proposal.status}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
