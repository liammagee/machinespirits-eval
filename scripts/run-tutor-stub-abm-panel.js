#!/usr/bin/env node
/**
 * Launch a tutor-stub ABM learner panel.
 *
 * This builds on the ABM learner-population work by using the same 9
 * personas as automated learner profiles, then measuring how the tutor-stub
 * responds: register mix, action-family mix, register efficacy, field
 * movement, and tutor-side learner-DAG closure.
 *
 * No model calls happen unless --live is passed.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { loadPersona } from '../services/abmLearnerPopulation.js';
import { buildInteriorCharacterSheet } from '../services/learnerInteriorGate.js';
import { resolveEngagementRegister } from '../services/engagementRegisterRegistry.js';
import { parseTutorStubRegisterPolicyStack } from '../services/tutorStubRegisterPolicyComposition.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const DEFAULT_PERSONA_IDS = Object.freeze([
  'abm_novice_boredom_pinned',
  'abm_novice_frustration_unpinned',
  'abm_novice_compliant_unpinned',
  'abm_intermediate_irrelevance_pinned',
  'abm_intermediate_question_flood_unpinned',
  'abm_intermediate_rote_parroting_pinned',
  'abm_advanced_frustration_pinned',
  'abm_advanced_compliant_unpinned',
  'abm_advanced_boredom_unpinned',
]);

const DEFAULT_OUTPUT_DIR = 'exports/tutor-stub-abm-panel';
export const REGISTER_POLICIES = Object.freeze([
  'dynamic',
  'state',
  'field',
  'trajectory',
  'dynamical_system',
  'empirical_dynamical_system',
  'continuous_dynamical_system',
  'continuous_empirical_dynamical_system',
  'bland',
  'random',
]);

const CLI_OPTIONS = {
  check: { type: 'boolean', default: false },
  live: { type: 'boolean', default: false },
  'dry-run': { type: 'boolean', default: false },
  summarize: { type: 'string', default: '' },
  runs: { type: 'string', default: '1' },
  turns: { type: 'string', default: 'until-grounded' },
  personas: { type: 'string', default: 'all' },
  'output-dir': { type: 'string', default: process.env.TUTOR_STUB_ABM_OUTPUT_DIR || DEFAULT_OUTPUT_DIR },
  'run-id': { type: 'string', default: '' },
  model: { type: 'string', default: process.env.TUTOR_STUB_ABM_MODEL || 'codex.gpt-5.5' },
  'analysis-model': { type: 'string', default: process.env.TUTOR_STUB_ABM_ANALYSIS_MODEL || 'codex.gpt-5.5' },
  'auto-learner-model': {
    type: 'string',
    default: process.env.TUTOR_STUB_ABM_AUTO_LEARNER_MODEL || process.env.TUTOR_STUB_AUTO_LEARNER_MODEL || 'codex.gpt-5.5',
  },
  world: { type: 'string', default: process.env.TUTOR_STUB_ABM_WORLD || 'world_005_marrick' },
  'register-policy': { type: 'string', default: process.env.TUTOR_STUB_ABM_REGISTER_POLICY || 'dynamic' },
  'register-palette': { type: 'string', default: process.env.TUTOR_STUB_ABM_REGISTER_PALETTE || 'all' },
  'cli-effort': { type: 'string', default: process.env.TUTOR_STUB_ABM_CLI_EFFORT || '' },
  'safety-turns': { type: 'string', default: process.env.TUTOR_STUB_ABM_SAFETY_TURNS || '80' },
  'until-grounded': { type: 'boolean', default: false },
  'no-dag': { type: 'boolean', default: false },
  'no-field-viz': { type: 'boolean', default: false },
  'keep-going': { type: 'boolean', default: false },
  help: { type: 'boolean', short: 'h', default: false },
};

export function parseCliArgs(argv = process.argv.slice(2)) {
  return parseArgs({ args: argv, options: CLI_OPTIONS, allowPositionals: false }).values;
}

function printHelp() {
  console.log(`Usage:
  npm run tutor:stub:abm-panel -- --check
  npm run tutor:stub:abm-panel -- --dry-run --personas abm_novice_boredom_pinned,abm_advanced_compliant_unpinned
  npm run tutor:stub:abm-panel -- --live --runs 1
  npm run tutor:stub:abm-panel -- --summarize exports/tutor-stub-abm-panel/<run-id>

Options:
  --check                 validate/load the 9 ABM personas and print the panel
  --dry-run               print commands and write a plan, no model calls
  --live                  launch tutor-stub once per persona/run
  --summarize <dir>       rebuild the report from saved transcripts in a run dir
  --runs <n>              repetitions per persona (default: 1)
  --turns <n|until-grounded>
                          tutor-stub auto turns (default: until-grounded)
  --personas <all|csv>    subset of ABM persona ids (default: all)
  --output-dir <path>     artifact root (default: ${DEFAULT_OUTPUT_DIR})
  --run-id <id>           stable run id; default timestamped
  --model <ref>           tutor model (default: codex.gpt-5.5)
  --analysis-model <ref>  classifier + learner-DAG model (default: codex.gpt-5.5)
  --auto-learner-model <ref>
                          automated learner model (default: codex.gpt-5.5)
  --world <id|path|none>  tutor-stub detective world (default: world_005_marrick)
  --register-policy <${REGISTER_POLICIES.join('|')}>
                          append +state and/or +field for strong-change overlays
  --register-palette <all|safe|negative|non-simulated|csv>
  --cli-effort <level>    low, medium, high, xhigh, max, or config
  --until-grounded        legacy alias for --turns until-grounded
  --no-dag                omit tutor hidden proof-DAG
  --no-field-viz          skip per-dialogue field SVG/JSON
  --keep-going            continue after a failed child run
`);
}

function positiveInt(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

export function normalizeRegisterPolicy(value) {
  const stack = parseTutorStubRegisterPolicyStack(value || 'dynamic');
  if (REGISTER_POLICIES.includes(stack.primary)) return stack.id;
  throw new Error(`--register-policy must use a primary from: ${REGISTER_POLICIES.join(', ')}`);
}

export function autoTurnsArg(args) {
  if (args['until-grounded'] || args.turns === 'until-grounded') return 'until-grounded';
  return String(positiveInt(args.turns, '--turns'));
}

function safeTimestampForFile(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function resolveWorkspacePath(value) {
  return path.isAbsolute(value) ? value : path.join(ROOT, value);
}

function csv(value) {
  return String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

export function selectedPersonaIds(value = 'all') {
  if (!value || value === 'all') return [...DEFAULT_PERSONA_IDS];
  const ids = csv(value);
  for (const id of ids) loadPersona(id);
  return ids;
}

export function buildPanelDraws({ personaIds = DEFAULT_PERSONA_IDS, runs = 1 } = {}) {
  const draws = [];
  for (const personaId of personaIds) {
    for (let repeat = 1; repeat <= runs; repeat += 1) draws.push({ personaId, repeat });
  }
  return draws;
}

function escapeMd(value) {
  return String(value ?? '').replace(/\|/g, '/').replace(/\n/g, ' ');
}

function mdTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(escapeMd).join(' | ')} |`),
  ].join('\n');
}

function countBy(values) {
  const counts = {};
  for (const value of values) {
    const key = String(value || 'none');
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function formatCounts(counts) {
  return Object.entries(counts || {})
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, value]) => `${key} ${value}`)
    .join(', ');
}

function entropy(values) {
  const filtered = values.filter(Boolean);
  if (!filtered.length) return 0;
  const counts = Object.values(countBy(filtered));
  const total = filtered.length;
  const raw = counts.reduce((sum, count) => {
    const p = count / total;
    return sum - p * Math.log2(p);
  }, 0);
  return Number(raw.toFixed(3));
}

function canonicalRegister(value) {
  return resolveEngagementRegister(value, { fallback: value || null })?.register || value || null;
}

export function buildAbmAutoLearnerProfile(personaId) {
  const persona = loadPersona(personaId);
  const interior = persona.formal_interior;
  const resistance = (interior.resistance_markers || []).join(', ') || 'none';
  const filter = interior.engagement_filter?.description || 'none';
  return [
    '# ABM learner population profile',
    '',
    `Persona id: ${personaId}`,
    `Capability tier: ${persona.capability_tier}`,
    `Resistance style: ${persona.resistance_style}`,
    `Sycophancy mode: ${persona.sycophancy_mode}`,
    '',
    '# Persona frame',
    '',
    persona.persona_prompt_frame,
    '',
    '# Behavioral carry-over for this tutor-stub dialogue',
    '',
    '- Play this persona as a learner in the current public scene, even when the scene topic differs from the ABM source topic.',
    '- Keep the resistance style and sycophancy discipline stable across turns.',
    '- Use the public tutor transcript and public scene only; do not invent hidden evidence.',
    '- Do not mention ABM ids, blocking tokens, or this character sheet in public dialogue.',
    '- If the tutor gives a genuinely useful concrete route through your resistance, engage in your own words; otherwise keep the resistance visible.',
    '',
    '# Resistance markers',
    '',
    resistance,
    '',
    '# Engagement filter',
    '',
    filter,
    '',
    buildInteriorCharacterSheet(interior),
  ].join('\n');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function maybeReadFieldSummary(transcript, transcriptPath) {
  const rel = transcript?.fieldVisualization?.json;
  if (!rel) return null;
  const fieldPath = path.isAbsolute(rel) ? rel : path.join(ROOT, rel);
  if (!fs.existsSync(fieldPath)) {
    const sibling = path.join(path.dirname(transcriptPath), path.basename(rel));
    if (fs.existsSync(sibling)) return readJson(sibling).summary || null;
    return null;
  }
  return readJson(fieldPath).summary || null;
}

function efficacyRows(turns) {
  const rows = [];
  for (const turn of turns || []) {
    const efficacy = turn.previousRegisterEfficacy;
    if (!efficacy) continue;
    rows.push({
      register: canonicalRegister(efficacy.selected_register),
      label: efficacy.label || 'unknown',
      score: efficacy.progressScore ?? null,
      mismatch: efficacy.mismatch || null,
    });
  }
  return rows;
}

export function summarizeTutorStubTranscript({ transcript, transcriptPath = '', personaId, repeat = 1 } = {}) {
  const persona = loadPersona(personaId);
  const turns = transcript?.turns || [];
  const last = turns.at(-1) || {};
  const assessment = last.tutorLearnerDagModel?.assessment || {};
  const metrics = last.tutorLearnerDagModel?.metrics || {};
  const registers = turns.map((turn) => canonicalRegister(turn.registerSelection?.selected_register));
  const actionFamilies = turns.map((turn) => turn.registerSelection?.action_family || 'none');
  const requestTypes = turns.map(
    (turn) => turn.registerSelection?.request_type || turn.registerSelection?.learner_signal || 'unknown',
  );
  const efficacies = efficacyRows(turns);
  const leakCount = turns.filter((turn) => turn.tutorLeakAudit && turn.tutorLeakAudit.ok === false).length;
  const fieldSummary = maybeReadFieldSummary(transcript, transcriptPath);
  const groundedClosure = Boolean(
    assessment.bottleneck === 'grounded_asserted_secret' ||
      (assessment.finalSecretEntailed === true && assessment.assertedSecret === true),
  );
  const registerTransitions = registers
    .map((register, index) => (index === 0 ? register : `${registers[index - 1]}->${register}`))
    .filter(Boolean);
  return {
    schema: 'machinespirits.tutor-stub.abm-panel-row.v1',
    personaId,
    repeat,
    capabilityTier: persona.capability_tier,
    resistanceStyle: persona.resistance_style,
    sycophancyMode: persona.sycophancy_mode,
    transcript: transcriptPath ? path.relative(ROOT, transcriptPath) : null,
    trace: transcript?.trace || null,
    fieldVisualization: transcript?.fieldVisualization || null,
    turnCount: turns.length,
    groundedClosure,
    bestPathCoverage: Number(assessment.bestPathCoverage ?? 0),
    missingPremiseCount: Number(metrics.missingPremiseCount ?? assessment.missingPremiseCount ?? 0),
    bottleneck: assessment.bottleneck || 'unknown',
    leakCount,
    leakOk: leakCount === 0,
    finalLearner: last.learner || '',
    finalTutor: last.tutor || '',
    registers,
    registerCounts: countBy(registers),
    registerUniqueCount: new Set(registers.filter(Boolean)).size,
    registerEntropy: entropy(registers),
    registerTransitions,
    actionFamilyCounts: countBy(actionFamilies),
    requestTypeCounts: countBy(requestTypes),
    efficacyCounts: countBy(efficacies.map((row) => row.label)),
    efficacyRows: efficacies,
    field: fieldSummary
      ? {
          final: fieldSummary.final || null,
          delta: fieldSummary.fieldDelta || null,
          meanSpeed: fieldSummary.meanSpeed ?? null,
        }
      : null,
  };
}

export function summarizePanelRows(rows) {
  const scored = rows.filter((row) => row.status !== 'failed' && row.status !== 'dry_run');
  const byResistance = {};
  const byCapability = {};
  const allRegisters = [];
  for (const row of scored) {
    for (const register of row.registers || []) allRegisters.push(register);
    for (const [bucket, key] of [
      [byResistance, row.resistanceStyle],
      [byCapability, row.capabilityTier],
    ]) {
      if (!bucket[key]) bucket[key] = { rows: 0, grounded: 0, coverage: 0, registers: [] };
      bucket[key].rows += 1;
      if (row.groundedClosure) bucket[key].grounded += 1;
      bucket[key].coverage += row.bestPathCoverage || 0;
      bucket[key].registers.push(...(row.registers || []));
    }
  }
  const decorate = (bucket) =>
    Object.fromEntries(
      Object.entries(bucket).map(([key, value]) => [
        key,
        {
          rows: value.rows,
          grounded: value.grounded,
          meanCoverage: value.rows ? Number((value.coverage / value.rows).toFixed(3)) : 0,
          registerCounts: countBy(value.registers),
          registerEntropy: entropy(value.registers),
        },
      ]),
    );
  return {
    schema: 'machinespirits.tutor-stub.abm-panel-summary.v1',
    rows: scored.length,
    failedRows: rows.filter((row) => row.status === 'failed').length,
    dryRunRows: rows.filter((row) => row.status === 'dry_run').length,
    grounded: scored.filter((row) => row.groundedClosure).length,
    meanCoverage: scored.length
      ? Number((scored.reduce((sum, row) => sum + (row.bestPathCoverage || 0), 0) / scored.length).toFixed(3))
      : 0,
    registerCounts: countBy(allRegisters),
    registerEntropy: entropy(allRegisters),
    byResistance: decorate(byResistance),
    byCapability: decorate(byCapability),
  };
}

function rowFromSavedTranscript({ transcriptPath, personaId, repeat }) {
  const transcript = readJson(transcriptPath);
  return summarizeTutorStubTranscript({ transcript, transcriptPath, personaId, repeat });
}

function markdownReport({ runId, config, rows, summary }) {
  const rowTable = rows.map((row) => [
    row.personaId,
    row.repeat,
    row.capabilityTier,
    row.resistanceStyle,
    row.sycophancyMode,
    row.status || 'ok',
    row.turnCount ?? '',
    row.groundedClosure ? 'yes' : 'no',
    row.bestPathCoverage ?? '',
    row.missingPremiseCount ?? '',
    row.bottleneck || '',
    formatCounts(row.registerCounts),
    row.registerEntropy ?? '',
    formatCounts(row.efficacyCounts),
    row.field?.final
      ? `M ${row.field.final.learnerMastery}, R ${row.field.final.learnerRisk}, A ${row.field.final.tutorAlignment}, P ${row.field.final.jointMomentum}`
      : '',
    row.fieldVisualization?.svg || '',
  ]);

  const resistanceRows = Object.entries(summary.byResistance || {}).map(([style, value]) => [
    style,
    value.rows,
    value.grounded,
    value.meanCoverage,
    formatCounts(value.registerCounts),
    value.registerEntropy,
  ]);

  const capabilityRows = Object.entries(summary.byCapability || {}).map(([tier, value]) => [
    tier,
    value.rows,
    value.grounded,
    value.meanCoverage,
    formatCounts(value.registerCounts),
    value.registerEntropy,
  ]);

  return [
    '# Tutor-Stub ABM Learner Panel',
    '',
    `Run: \`${runId}\``,
    '',
    `Tutor: \`${config.model}\` · learner: \`${config.autoLearnerModel}\` · analysis: \`${config.analysisModel}\` · world: \`${config.world}\``,
    `Register policy: \`${config.registerPolicy}\` · palette: \`${config.registerPalette}\` · turns: \`${config.turns}\` · runs/persona: ${config.runs}`,
    '',
    '## Summary',
    '',
    `Rows: **${summary.rows}** · grounded: **${summary.grounded}/${summary.rows}** · mean coverage: **${summary.meanCoverage}**`,
    `Register entropy: **${summary.registerEntropy}** · register counts: ${formatCounts(summary.registerCounts) || 'none'}`,
    '',
    '## By Resistance Style',
    '',
    mdTable(['Resistance', 'Rows', 'Grounded', 'Mean coverage', 'Registers', 'Entropy'], resistanceRows),
    '',
    '## By Capability Tier',
    '',
    mdTable(['Capability', 'Rows', 'Grounded', 'Mean coverage', 'Registers', 'Entropy'], capabilityRows),
    '',
    '## Rows',
    '',
    mdTable(
      [
        'Persona',
        'r',
        'Capability',
        'Resistance',
        'Sycophancy',
        'Status',
        'Turns',
        'Grounded',
        'Coverage',
        'Missing',
        'Bottleneck',
        'Registers',
        'Reg entropy',
        'Efficacy',
        'Final field',
        'Field SVG',
      ],
      rowTable,
    ),
    '',
  ].join('\n');
}

function writePanelArtifacts({ runDir, runId, config, rows }) {
  fs.mkdirSync(runDir, { recursive: true });
  const summary = summarizePanelRows(rows);
  const payload = { runId, config, summary, rows };
  const summaryPath = path.join(runDir, 'summary.json');
  const reportPath = path.join(runDir, 'report.md');
  const rowsPath = path.join(runDir, 'rows.jsonl');
  fs.writeFileSync(summaryPath, `${JSON.stringify(payload, null, 2)}\n`);
  fs.writeFileSync(reportPath, markdownReport({ runId, config, rows, summary }));
  fs.writeFileSync(rowsPath, rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : ''));
  return { summaryPath, reportPath, rowsPath, summary };
}

function tutorStubArgs({ draw, args, savePath, tracesDir }) {
  const profile = buildAbmAutoLearnerProfile(draw.personaId);
  const autoTurns = autoTurnsArg(args);
  const childArgs = [
    'scripts/tutor-stub.js',
    '--auto-learner',
    '--auto-turns',
    autoTurns,
    '--auto-safety-turns',
    String(positiveInt(args['safety-turns'], '--safety-turns')),
    '--model',
    args.model,
    '--classifier-model',
    args['analysis-model'],
    '--learner-record-model',
    args['analysis-model'],
    '--auto-learner-model',
    args['auto-learner-model'],
    '--auto-learner-profile',
    profile,
    '--tutor-learner-dag',
    '--world',
    args.world,
    '--register-policy',
    args['register-policy'],
    '--register-palette',
    args['register-palette'],
    '--trace-dir',
    tracesDir,
    '--save',
    savePath,
    '--no-stream',
    '--no-interim-animation',
    '--learner',
    `ABM automated learner ${draw.personaId}, repeat ${draw.repeat}.`,
  ];
  if (!args['no-dag']) childArgs.push('--dag');
  if (!args['no-field-viz']) childArgs.push('--field-viz');
  if (args['cli-effort']) childArgs.push('--cli-effort', args['cli-effort']);
  return childArgs;
}

function commandForDisplay(parts) {
  const redacted = [];
  for (let index = 0; index < parts.length; index += 1) {
    redacted.push(parts[index]);
    if (parts[index] === '--auto-learner-profile') {
      redacted.push('[ABM learner profile omitted]');
      index += 1;
    }
  }
  return ['node', ...redacted].map((part) => JSON.stringify(part)).join(' ');
}

function printPanelCheck(personaIds) {
  console.log('# Tutor-stub ABM learner panel\n');
  console.log('| Persona | Capability | Resistance | Sycophancy | Blocking token |');
  console.log('| --- | --- | --- | --- | --- |');
  for (const personaId of personaIds) {
    const persona = loadPersona(personaId);
    console.log(
      `| ${personaId} | ${persona.capability_tier} | ${persona.resistance_style} | ${persona.sycophancy_mode} | ${persona.formal_interior.blocking_element.id} |`,
    );
  }
  console.log(`\n${personaIds.length} persona(s) validate. Use --dry-run to see child tutor-stub commands, or --live to execute.`);
}

function summarizeExistingRun(runDir, args) {
  const transcriptsDir = path.join(runDir, 'transcripts');
  if (!fs.existsSync(transcriptsDir)) throw new Error(`no transcripts dir found at ${transcriptsDir}`);
  const rows = [];
  for (const file of fs.readdirSync(transcriptsDir).filter((name) => name.endsWith('.json')).sort()) {
    const match = file.match(/^(.*)__r(\d+)\.json$/);
    if (!match) continue;
    rows.push(
      rowFromSavedTranscript({
        transcriptPath: path.join(transcriptsDir, file),
        personaId: match[1],
        repeat: Number.parseInt(match[2], 10),
      }),
    );
  }
  const runId = path.basename(runDir);
  const config = {
    mode: 'summarize',
    runs: null,
    turns: null,
    model: args.model,
    analysisModel: args['analysis-model'],
    autoLearnerModel: args['auto-learner-model'],
    world: args.world,
    registerPolicy: args['register-policy'],
    registerPalette: args['register-palette'],
  };
  return writePanelArtifacts({ runDir, runId, config, rows });
}

export function runPanel(argv = process.argv.slice(2)) {
  const args = parseCliArgs(argv);
  if (args.help) {
    printHelp();
    return { status: 'help' };
  }
  args['register-policy'] = normalizeRegisterPolicy(args['register-policy']);

  const personaIds = selectedPersonaIds(args.personas);
  if (args.check) {
    printPanelCheck(personaIds);
    return { status: 'check', personas: personaIds.length };
  }

  if (args.summarize) {
    const runDir = resolveWorkspacePath(args.summarize);
    const written = summarizeExistingRun(runDir, args);
    console.log(`[abm-panel] wrote ${path.relative(ROOT, written.reportPath)}`);
    return { status: 'summarized', ...written };
  }

  if (!args.live && !args['dry-run']) {
    printHelp();
    throw new Error('model calls require --live; use --check or --dry-run for no-spend validation');
  }

  const runs = positiveInt(args.runs, '--runs');
  const runId = args['run-id'] || `tutor-stub-abm-panel-${safeTimestampForFile()}`;
  const outputRoot = resolveWorkspacePath(args['output-dir']);
  const runDir = path.join(outputRoot, runId);
  const transcriptsDir = path.join(runDir, 'transcripts');
  const tracesDir = path.join(runDir, 'traces');
  fs.mkdirSync(transcriptsDir, { recursive: true });
  fs.mkdirSync(tracesDir, { recursive: true });

  const config = {
    mode: args.live ? 'live' : 'dry_run',
    runs,
    turns: autoTurnsArg(args),
    personas: personaIds,
    model: args.model,
    analysisModel: args['analysis-model'],
    autoLearnerModel: args['auto-learner-model'],
    world: args.world,
    registerPolicy: args['register-policy'],
    registerPalette: args['register-palette'],
    cliEffort: args['cli-effort'] || null,
  };

  const rows = [];
  for (const draw of buildPanelDraws({ personaIds, runs })) {
    const key = `${draw.personaId}__r${draw.repeat}`;
    const savePath = path.join(transcriptsDir, `${key}.json`);
    const childArgs = tutorStubArgs({ draw, args, savePath, tracesDir });
    console.log(`\n[abm-panel] ${key}`);
    console.log(commandForDisplay(childArgs));
    if (args['dry-run']) {
      rows.push({
        schema: 'machinespirits.tutor-stub.abm-panel-row.v1',
        status: 'dry_run',
        personaId: draw.personaId,
        repeat: draw.repeat,
        ...personaFields(draw.personaId),
        command: ['node', ...childArgs],
      });
      continue;
    }

    const child = spawnSync(process.execPath, childArgs, {
      cwd: ROOT,
      stdio: 'inherit',
      env: {
        ...process.env,
        TUTOR_STUB_ABM_PERSONA_ID: draw.personaId,
        TUTOR_STUB_ABM_REPEAT: String(draw.repeat),
      },
    });
    if (child.status !== 0) {
      rows.push({
        schema: 'machinespirits.tutor-stub.abm-panel-row.v1',
        status: 'failed',
        personaId: draw.personaId,
        repeat: draw.repeat,
        ...personaFields(draw.personaId),
        exitCode: child.status,
        signal: child.signal || null,
        command: ['node', ...childArgs],
      });
      const written = writePanelArtifacts({ runDir, runId, config, rows });
      if (!args['keep-going']) {
        console.error(`[abm-panel] child failed; partial report ${path.relative(ROOT, written.reportPath)}`);
        process.exit(child.status || 1);
      }
      continue;
    }
    rows.push({ status: 'ok', ...rowFromSavedTranscript({ transcriptPath: savePath, ...draw }) });
    writePanelArtifacts({ runDir, runId, config, rows });
  }

  const written = writePanelArtifacts({ runDir, runId, config, rows });
  console.log(`\n[abm-panel] wrote ${path.relative(ROOT, written.reportPath)}`);
  console.log(
    `[abm-panel] rows=${written.summary.rows} grounded=${written.summary.grounded}/${written.summary.rows} meanCoverage=${written.summary.meanCoverage} registerEntropy=${written.summary.registerEntropy}`,
  );
  return { status: args.live ? 'live' : 'dry_run', runDir, ...written };
}

function personaFields(personaId) {
  const persona = loadPersona(personaId);
  return {
    capabilityTier: persona.capability_tier,
    resistanceStyle: persona.resistance_style,
    sycophancyMode: persona.sycophancy_mode,
  };
}

const isMain = process.argv[1] && process.argv[1].endsWith('run-tutor-stub-abm-panel.js');
if (isMain) {
  try {
    runPanel();
  } catch (error) {
    console.error(`[abm-panel] error: ${error.message}`);
    process.exit(1);
  }
}
