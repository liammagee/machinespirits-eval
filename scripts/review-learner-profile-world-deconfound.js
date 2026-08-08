#!/usr/bin/env node

/**
 * Validate and render the free design-stage bundle for the learner-profile
 * world deconfound. This command makes no model calls and cannot launch the
 * paid cells. It exists so the exact persona transplants can be adjudicated
 * before a certificate or runner is added.
 *
 * Usage:
 *   node scripts/review-learner-profile-world-deconfound.js
 *   node scripts/review-learner-profile-world-deconfound.js --check
 *   node scripts/review-learner-profile-world-deconfound.js --json
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import yaml from 'yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_CONFIG = path.join(ROOT, 'config', 'learner-profile-world-deconfound.yaml');
const EXPECTED_SCHEMA = 'machinespirits.tutor-stub.learner-profile-world-deconfound.v1';
const WORLD_FILES = Object.freeze({
  world_030_rowan_flat: 'config/drama-derivation/world-030-rowan-flat.yaml',
  world_033_alder_row_redoubt: 'config/drama-derivation/world-033-alder-row-redoubt.yaml',
});
const EXPECTED_CELLS = Object.freeze({
  record_keeper: 'world_030_rowan_flat',
  tenant: 'world_033_alder_row_redoubt',
});
const REQUIRED_BRIEF_HEADINGS = Object.freeze([
  'Who this is:',
  'Recurring behavior:',
  'Triggers:',
  'Do not normalize away the profile:',
  'Public-turn rules:',
  'Visible voice:',
  'Repair behavior:',
]);

function fail(message) {
  throw new Error(`learner-profile world deconfound: ${message}`);
}

function requireValue(value, message) {
  if (!value) fail(message);
}

function readYaml(filePath) {
  return yaml.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256(text) {
  return crypto.createHash('sha256').update(String(text)).digest('hex');
}

function containsInsensitive(text, needle) {
  const escaped = String(needle)
    .replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
    .replace(/\s+/gu, '\\s+');
  return new RegExp(`(?:^|[^\\p{L}\\p{N}_])${escaped}(?=$|[^\\p{L}\\p{N}_])`, 'iu').test(String(text));
}

function validateFile(root, relativePath, label) {
  requireValue(typeof relativePath === 'string' && relativePath.length, `${label} path is required`);
  const absolute = path.resolve(root, relativePath);
  requireValue(absolute.startsWith(`${path.resolve(root)}${path.sep}`), `${label} must stay inside the repository`);
  requireValue(fs.existsSync(absolute), `${label} does not exist: ${relativePath}`);
  return absolute;
}

function validateBrief(personaId, label, brief) {
  requireValue(typeof brief === 'string' && brief.trim(), `${personaId} ${label} private brief is required`);
  for (const heading of REQUIRED_BRIEF_HEADINGS) {
    requireValue(brief.includes(heading), `${personaId} ${label} brief is missing ${heading}`);
  }
}

function validatePersona(design, personaId, root) {
  const persona = design.personas?.[personaId];
  requireValue(persona, `persona ${personaId} is required`);
  const expectedTarget = EXPECTED_CELLS[personaId];
  const expectedSource = Object.keys(WORLD_FILES).find((worldId) => worldId !== expectedTarget);
  requireValue(persona.source?.world === expectedSource, `${personaId} source world must be ${expectedSource}`);
  requireValue(persona.transplant?.world === expectedTarget, `${personaId} target world must be ${expectedTarget}`);
  requireValue(
    Array.isArray(persona.conduct_invariants) && persona.conduct_invariants.length >= 4,
    `${personaId} must declare at least four conduct invariants`,
  );
  validateBrief(personaId, 'source', persona.source?.private_brief);
  validateBrief(personaId, 'transplant', persona.transplant?.private_brief);
  requireValue(
    persona.transplant?.public_learner_voice?.trim(),
    `${personaId} public learner-voice override is required`,
  );

  const sourceWorldPath = validateFile(root, WORLD_FILES[expectedSource], `${personaId} source world`);
  const targetWorldPath = validateFile(root, WORLD_FILES[expectedTarget], `${personaId} target world`);
  const sourceWorld = readYaml(sourceWorldPath);
  const targetWorld = readYaml(targetWorldPath);
  requireValue(sourceWorld.id === expectedSource, `${personaId} source world id does not match its file`);
  requireValue(targetWorld.id === expectedTarget, `${personaId} target world id does not match its file`);
  requireValue(sourceWorld.learner_voice?.trim(), `${personaId} source world has no learner_voice`);
  requireValue(targetWorld.learner_voice?.trim(), `${personaId} target world has no learner_voice to override`);

  const forbidden = persona.transplant?.forbidden_source_surface;
  requireValue(Array.isArray(forbidden) && forbidden.length, `${personaId} forbidden source-surface list is required`);
  for (const term of forbidden) {
    requireValue(
      !containsInsensitive(persona.transplant.private_brief, term),
      `${personaId} transplant private brief leaks source-world surface: ${term}`,
    );
    requireValue(
      !containsInsensitive(persona.transplant.public_learner_voice, term),
      `${personaId} public learner-voice override leaks source-world surface: ${term}`,
    );
  }

  return {
    id: personaId,
    sourceWorld: expectedSource,
    targetWorld: expectedTarget,
    sourcePromptSha256: sha256(persona.source.private_brief),
    transplantPromptSha256: sha256(persona.transplant.private_brief),
    publicLearnerVoiceSha256: sha256(persona.transplant.public_learner_voice),
    invariants: [...persona.conduct_invariants],
  };
}

export function readLearnerProfileWorldDeconfoundDesign(configPath = DEFAULT_CONFIG) {
  return readYaml(path.resolve(configPath));
}

export function validateLearnerProfileWorldDeconfoundDesign(design, { root = ROOT } = {}) {
  requireValue(design?.schema === EXPECTED_SCHEMA, `schema must be ${EXPECTED_SCHEMA}`);
  requireValue(design.status === 'adjudicated', 'status must remain adjudicated');
  requireValue(design.freeze?.user_adjudication === 'approved', 'user adjudication must remain approved');
  requireValue(/^\d{4}-\d{2}-\d{2}$/u.test(design.freeze?.adjudicated_on), 'adjudicated_on must be a date');
  requireValue(design.freeze?.paid_authorization === 'not_authorized', 'paid calls must remain not_authorized');
  requireValue(design.freeze?.third_persona === 'omit', 'third-persona choice must remain omit');

  validateFile(root, design.runtime?.baseline_manifest, 'baseline manifest');
  const recoveryInstrument = design.runtime?.recovery_instrument;
  validateFile(root, recoveryInstrument?.pressure, 'pressure instrument');
  requireValue(recoveryInstrument?.quiet_version === 'qd-v1', 'quiet instrument must remain qd-v1');
  requireValue(
    recoveryInstrument?.status === 'restore_exact_before_certificate',
    'qd-v1 must remain an explicit pre-certificate restoration gate',
  );
  requireValue(
    Array.isArray(recoveryInstrument?.quiet_source_commits) &&
      recoveryInstrument.quiet_source_commits.length === 2 &&
      recoveryInstrument.quiet_source_commits.every((sha) => /^[0-9a-f]{40}$/u.test(sha)),
    'qd-v1 must retain both exact source commits',
  );
  requireValue(design.runtime?.venue === 'attended_local', 'venue must be attended_local');
  requireValue(design.runtime?.attempts_per_job === 1, 'attempts_per_job must be exactly 1 before authorization');

  const personaReports = Object.keys(EXPECTED_CELLS).map((personaId) => validatePersona(design, personaId, root));
  for (const personaReport of personaReports) {
    const approved = design.freeze?.approved_artifacts?.[personaReport.id];
    requireValue(approved, `${personaReport.id} approved artifact hashes are required`);
    requireValue(
      approved.transplant_prompt_sha256 === personaReport.transplantPromptSha256,
      `${personaReport.id} transplanted private brief changed after adjudication`,
    );
    requireValue(
      approved.public_learner_voice_sha256 === personaReport.publicLearnerVoiceSha256,
      `${personaReport.id} public learner voice changed after adjudication`,
    );
  }
  const cells = design.paid_design?.cells;
  requireValue(Array.isArray(cells) && cells.length === 2, 'paid design must contain exactly two crossed cells');
  const seen = new Set();
  let dialogues = 0;
  for (const cell of cells) {
    requireValue(
      EXPECTED_CELLS[cell.persona] === cell.world,
      `unexpected crossed cell ${cell.persona} in ${cell.world}`,
    );
    requireValue(!seen.has(cell.persona), `duplicate crossed cell for ${cell.persona}`);
    seen.add(cell.persona);
    requireValue(cell.repeats === 5, `${cell.id} must remain at five dialogues`);
    const schedulePath = validateFile(root, cell.stress_schedule, `${cell.id} stress schedule`);
    const schedule = readYaml(schedulePath);
    requireValue(
      schedule.world === cell.world,
      `${cell.id} stress schedule targets ${schedule.world}, not ${cell.world}`,
    );
    dialogues += cell.repeats;
  }
  requireValue(dialogues === 10, `crossed design must total ten dialogues, got ${dialogues}`);
  requireValue(design.paid_design?.new_dialogues === dialogues, 'new_dialogues must equal the crossed-cell total');
  requireValue(
    design.readings?.classifier?.includes('leave-one-out'),
    'reading must retain leave-one-out classification',
  );
  requireValue(design.readings?.pass_bar === 0.8, 'pass bar must remain 0.8');

  return {
    schema: design.schema,
    status: design.status,
    userAdjudication: design.freeze.user_adjudication,
    adjudicatedOn: design.freeze.adjudicated_on,
    paidAuthorization: design.freeze.paid_authorization,
    thirdPersona: design.freeze.third_persona,
    dialogues,
    recoveryInstrument: {
      pressure: recoveryInstrument.pressure,
      quietVersion: recoveryInstrument.quiet_version,
      status: recoveryInstrument.status,
    },
    models: {
      tutor: design.runtime.tutor_model,
      learner: design.runtime.learner_model,
      analysis: design.runtime.analysis_model,
    },
    personas: personaReports,
  };
}

function fenced(text) {
  return ['```text', String(text).trim(), '```'].join('\n');
}

export function renderLearnerProfileWorldDeconfoundReview(design, report) {
  const blocks = [
    '# Learner-profile/world deconfound — design review',
    '',
    `Status: **${report.status}**. Paid authorization: **${report.paidAuthorization}**.`,
    '',
    'This is a zero-model review surface. It cannot launch either crossed cell.',
    '',
    `Adjudicated: **${report.userAdjudication}** on ${report.adjudicatedOn}.`,
    '',
    '## Approved scope decision',
    '',
    `Third persona: **${report.thirdPersona}**. ${design.freeze.third_persona_reason}`,
  ];

  for (const personaReport of report.personas) {
    const persona = design.personas[personaReport.id];
    blocks.push(
      '',
      `## ${personaReport.id.replaceAll('_', ' ')}: ${personaReport.sourceWorld} → ${personaReport.targetWorld}`,
      '',
      'Conduct invariants:',
      '',
      ...personaReport.invariants.map((item) => `- ${item}`),
      '',
      'Public learner-voice override:',
      '',
      fenced(persona.transplant.public_learner_voice),
      '',
      'Exact transplanted private brief:',
      '',
      fenced(persona.transplant.private_brief),
      '',
      `Source prompt SHA-256: ${personaReport.sourcePromptSha256}`,
      `Transplant prompt SHA-256: ${personaReport.transplantPromptSha256}`,
    );
  }

  blocks.push(
    '',
    '## Frozen paid design after adjudication',
    '',
    `- ${report.dialogues} new dialogues: five per crossed cell.`,
    `- Tutor: ${report.models.tutor}; learner: ${report.models.learner}; analysis: ${report.models.analysis}.`,
    '- Existing source-world dialogues are reused; no source cell is rerun.',
    '- Delivery is verified before outcomes are read.',
    '- The original 80% persona-recovery bar and all world/partial branches remain unchanged.',
    `- Recovery instrument: ${report.recoveryInstrument.pressure} plus ${report.recoveryInstrument.quietVersion}.`,
    '- The current tree contains qd-v2. Restore exact qd-v1 as a frozen replay artifact and reproduce the original 56/64 reading before certification.',
    '',
    '## Remaining gates before a runner or certificate',
    '',
    '1. Restore and validate the exact qd-v1 replay instrument.',
    '2. Separately authorize the ten paid dialogues and their named external payloads.',
  );
  return `${blocks.join('\n')}\n`;
}

function parseArgs(argv) {
  const args = { config: DEFAULT_CONFIG, check: false, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--check') args.check = true;
    else if (arg === '--json') args.json = true;
    else if (arg === '--config') args.config = path.resolve(argv[++index]);
    else fail(`unknown argument: ${arg}`);
  }
  return args;
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const design = readLearnerProfileWorldDeconfoundDesign(args.config);
  const report = validateLearnerProfileWorldDeconfoundDesign(design);
  if (args.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else if (args.check) {
    process.stdout.write(
      `learner-profile world deconfound: valid adjudicated zero-model design; ${report.dialogues} paid dialogues remain unauthorized; qd-v1 restoration pending\n`,
    );
  } else process.stdout.write(renderLearnerProfileWorldDeconfoundReview(design, report));
  return report;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
