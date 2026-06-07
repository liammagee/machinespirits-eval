#!/usr/bin/env node
/**
 * A19 attempt-1 materializer.
 *
 * Zero-API implementation slice: validate A19 teaching-drama axiom fixtures,
 * materialize attempt-1 and held-out S0/S1 transcript stubs, and write next
 * commands that reuse the A18 recursive replay gate plus the A19 blind
 * adjudication scaffold.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import yaml from 'yaml';
import { validateTeachingDramaAxiomProtocol } from './validate-teaching-drama-axiom-protocol.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const DEFAULT_PROTOCOL = path.join(ROOT, 'config', 'teaching-drama-axioms', 'a19-protocol.yaml');
const DEFAULT_CONFIG = path.join(ROOT, 'config', 'teaching-drama-axioms', 'pilot-families.yaml');
const DEFAULT_OUT_DIR = path.join(ROOT, 'exports', 'a19', 'materialized-attempts');

function usage() {
  return `Usage:
  node scripts/materialize-teaching-drama-axiom-attempts.js
    [--protocol config/teaching-drama-axioms/a19-protocol.yaml]
    [--config config/teaching-drama-axioms/pilot-families.yaml]
    [--out-dir exports/a19/materialized-attempts]
    [--family family_id]
    [--dry-run] [--force]

This is zero-API. It writes deterministic stubs and next-step commands only.`;
}

export function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    protocol: DEFAULT_PROTOCOL,
    config: DEFAULT_CONFIG,
    outDir: DEFAULT_OUT_DIR,
    familyId: null,
    dryRun: false,
    force: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') args.help = true;
    else if (token === '--protocol') args.protocol = path.resolve(argv[++i]);
    else if (token === '--config') args.config = path.resolve(argv[++i]);
    else if (token === '--out-dir') args.outDir = path.resolve(argv[++i]);
    else if (token === '--family') args.familyId = argv[++i];
    else if (token === '--dry-run') args.dryRun = true;
    else if (token === '--force') args.force = true;
    else throw new Error(`unknown arg: ${token}\n\n${usage()}`);
  }
  return args;
}

function readYaml(filePath) {
  return yaml.parse(fs.readFileSync(filePath, 'utf8'));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function repoRel(filePath) {
  return path.relative(ROOT, path.resolve(filePath));
}

function safeSlug(value) {
  return String(value || 'missing')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function commandString(cmd) {
  return cmd.map((part) => (/\s/.test(String(part)) ? JSON.stringify(part) : String(part))).join(' ');
}

function replayCommandFor(
  transcriptPath,
  { outDir = null, policyMemoryPath = null, generator = 'mock', checker = 'mock' } = {},
) {
  const cmd = [
    'node',
    'scripts/replay-discursive-transcript.js',
    '--transcript',
    repoRel(transcriptPath),
    '--generator',
    generator,
    '--checker',
    checker,
    '--recursive-tutor-learning-gate',
  ];
  if (outDir) cmd.push('--out-dir', repoRel(outDir));
  if (policyMemoryPath) cmd.push('--policy-memory', repoRel(policyMemoryPath));
  return cmd;
}

function defaultAxiomPathFor(family) {
  return path.join(ROOT, 'exports', 'a19', 'axioms', safeSlug(family.family_id), 'axiom.json');
}

function axiomInductionCommandFor({ family, attempt1Dir, axiomPath }) {
  return [
    'node',
    'scripts/induce-teaching-drama-axiom.js',
    '--family',
    family.family_id,
    '--attempt1-dir',
    repoRel(attempt1Dir),
    '--out',
    repoRel(axiomPath),
    '--memory-jsonl',
    'exports/a19/axioms/admitted-axioms.jsonl',
  ];
}

function blindCommandFor({ s0Path, s1Path, sibling, familyId, outPath }) {
  return [
    'node',
    'scripts/blind-teaching-drama-axiom-adjudication.js',
    '--mock',
    '--s0',
    repoRel(s0Path),
    '--s1',
    repoRel(s1Path),
    '--target-aliases',
    asArray(sibling.target_aliases).join('|'),
    '--decoy-aliases',
    asArray(sibling.decoy_aliases).join('|'),
    '--option-space',
    sibling.blind_adjudication?.neutral_option_space || 'repair A | repair B | repair C',
    '--family-id',
    familyId,
    '--sibling-id',
    sibling.sibling_id,
    '--out',
    repoRel(outPath),
  ];
}

function freeTextBlindCommandFor({ s0Path, s1Path, sibling, family, outPath }) {
  return [
    'node',
    'scripts/blind-teaching-drama-axiom-adjudication.js',
    '--free-text',
    '--s0',
    repoRel(s0Path),
    '--s1',
    repoRel(s1Path),
    '--target-aliases',
    asArray(sibling.target_aliases).join('|'),
    '--decoy-aliases',
    asArray(sibling.decoy_aliases).join('|'),
    '--target-repair-type',
    family.target_policy?.repair_type || '',
    '--decoy-repair-types',
    asArray(family.plausible_repairs)
      .filter((repair) => repair !== family.target_policy?.policy_id)
      .join('|'),
    '--option-space',
    sibling.blind_adjudication?.neutral_option_space || 'repair A | repair B | repair C',
    '--family-id',
    family.family_id,
    '--sibling-id',
    sibling.sibling_id,
    '--out',
    repoRel(outPath),
  ];
}

function renderTrainingTranscript(family) {
  const seed = family.training_seed || {};
  const tutorAttempt =
    seed.baseline_tutor_attempt ||
    `I will apply the old repair "${seed.old_rule_decoy}" unless the learner makes the failure undeniable.`;
  return [
    `# A19 Training Seed: ${seed.seed_id || family.family_id}`,
    '',
    `FAMILY: ${family.family_id}`,
    'PHASE: attempt1_training_seed',
    '',
    `STAGE: ${seed.public_setup || ''}`,
    `LEARNER: ${seed.learner_resistance || ''}`,
    `TUTOR: ${tutorAttempt}`,
    '',
    `EXPECTED_FAILURE: ${seed.expected_failure || ''}`,
    `OLD_RULE_DECOY: ${seed.old_rule_decoy || ''}`,
    '',
    'CLAIM_BOUNDARY: simulated_teacher_as_learner_not_human_learning',
    '',
  ].join('\n');
}

function tutorLineForArm(sibling, armName) {
  const arm = sibling.fixture_adjudication?.[armName] || {};
  if (arm.committed_option_class === 'target') {
    return `I will ${asArray(sibling.target_aliases)[0]} before choosing the next teaching move.`;
  }
  if (arm.committed_option_class === 'decoy') {
    return `I will ${asArray(sibling.decoy_aliases)[0]} and keep the original teaching path moving.`;
  }
  return 'I cannot commit to a repair yet, so I will pause rather than force a strategy.';
}

function renderHeldoutTranscript({ family, sibling, armName }) {
  const arm = sibling.fixture_adjudication?.[armName] || {};
  const learnerResistance = sibling.learner_resistance || family.training_seed?.learner_resistance || '';
  return [
    `# A19 Held-Out Fixture: ${sibling.sibling_id} ${armName.toUpperCase()}`,
    '',
    `FAMILY: ${family.family_id}`,
    `SIBLING: ${sibling.sibling_id}`,
    `ARM: ${armName === 's0' ? 'S0_no_policy' : 'S1_policy_memory'}`,
    '',
    `STAGE: ${sibling.public_setup || ''}`,
    `LEARNER: ${learnerResistance}`,
    `TUTOR: ${tutorLineForArm(sibling, armName)}`,
    '',
    `FIXTURE_BASIS_LABEL: ${arm.basis_label || 'not_adjudicated'}`,
    'CLAIM_BOUNDARY: simulated_teacher_as_learner_not_human_learning',
    '',
  ].join('\n');
}

function renderHeldoutBaseTranscript({ family, sibling }) {
  const learnerResistance = sibling.learner_resistance || family.training_seed?.learner_resistance || '';
  return [
    `# A19 Held-Out Base: ${sibling.sibling_id}`,
    '',
    `FAMILY: ${family.family_id}`,
    `SIBLING: ${sibling.sibling_id}`,
    'PHASE: heldout_sibling_base',
    '',
    `STAGE: ${sibling.public_setup || ''}`,
    `LEARNER: ${learnerResistance}`,
    `TUTOR: I will apply the old repair "${family.training_seed?.old_rule_decoy || 'unknown_old_rule'}" unless the learner makes the failure undeniable.`,
    '',
    `HEADROOM_PREDICTION: ${sibling.headroom_prediction || ''}`,
    'CLAIM_BOUNDARY: simulated_teacher_as_learner_not_human_learning',
    '',
  ].join('\n');
}

function axiomTemplate(family) {
  return {
    schema_version: 'a19-teaching-drama-axiom-template-v0.1',
    family_id: family.family_id,
    status: 'template_unfilled_from_attempt1',
    training_seed_id: family.training_seed?.seed_id || null,
    old_rule_decoy: family.training_seed?.old_rule_decoy || null,
    target_policy: {
      policy_id: family.target_policy?.policy_id || null,
      trigger: family.target_policy?.trigger || null,
      avoid_move: family.target_policy?.avoid_move || null,
      preferred_move: family.target_policy?.preferred_move || null,
      applicability_conditions: asArray(family.target_policy?.applicability_conditions),
      anti_conditions: asArray(family.target_policy?.anti_conditions),
      repair_type: family.target_policy?.repair_type || null,
    },
    plausible_repairs: asArray(family.plausible_repairs),
    evidence_required: [
      'attempt-1 failure elicited under frozen protocol',
      'S0/S1 held-out transcripts generated with aliases withheld from critic',
      'card-level basis label before any denominator aggregation',
    ],
    non_claim_boundary: 'simulated_teacher_as_learner_not_human_learning',
  };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function buildAttemptMaterializationPlan({
  protocolPath = DEFAULT_PROTOCOL,
  configPath = DEFAULT_CONFIG,
  outDir = DEFAULT_OUT_DIR,
  familyId = null,
} = {}) {
  const config = readYaml(configPath);
  const validation = validateTeachingDramaAxiomProtocol({ protocolPath, configPath, familyId });
  const selectedFamilies = asArray(config?.families).filter((family) => !familyId || family.family_id === familyId);
  const families = selectedFamilies.map((family) => {
    const familyDir = path.join(outDir, safeSlug(family.family_id));
    const trainingTranscript = path.join(familyDir, 'attempt1.full.md');
    const axiomPath = path.join(familyDir, 'axiom-template.json');
    const admittedAxiomPath = defaultAxiomPathFor(family);
    const attempt1ReplayDir = path.join(familyDir, 'attempt1-replay');
    const axiomInductionCommand = axiomInductionCommandFor({
      family,
      attempt1Dir: attempt1ReplayDir,
      axiomPath: admittedAxiomPath,
    });
    const heldout = asArray(family.heldout_siblings).map((sibling) => {
      const siblingDir = path.join(familyDir, safeSlug(sibling.sibling_id));
      const heldoutBasePath = path.join(siblingDir, 'heldout-base.full.md');
      const s0Path = path.join(siblingDir, 's0-public.full.md');
      const s1Path = path.join(siblingDir, 's1-public.full.md');
      const blindReport = path.join(siblingDir, 'blind-adjudication.fixture.json');
      const freeTextBlindReport = path.join(siblingDir, 'blind-adjudication.free-text.json');
      const s1AxiomReplayDir = path.join(
        ROOT,
        'exports',
        'a19',
        'real-s0s1',
        safeSlug(family.family_id),
        safeSlug(sibling.sibling_id),
        's1-axiom-replay',
      );
      const protocolReject = sibling.protocol_reject === true;
      return {
        sibling_id: sibling.sibling_id,
        protocol_reject: protocolReject,
        protocol_reject_reason: sibling.protocol_reject_reason || null,
        expected_card_verdict:
          sibling.fixture_adjudication?.expected_card_verdict || sibling.expected_card_verdict || null,
        heldout_base_transcript: protocolReject ? null : heldoutBasePath,
        s0_public_transcript: protocolReject ? null : s0Path,
        s1_public_transcript: protocolReject ? null : s1Path,
        blind_adjudication_report: protocolReject ? null : blindReport,
        blind_adjudication_command: protocolReject
          ? null
          : blindCommandFor({ s0Path, s1Path, sibling, familyId: family.family_id, outPath: blindReport }),
        blind_adjudication_command_text: protocolReject
          ? null
          : commandString(
              blindCommandFor({ s0Path, s1Path, sibling, familyId: family.family_id, outPath: blindReport }),
            ),
        free_text_blind_adjudication_report: protocolReject ? null : freeTextBlindReport,
        free_text_blind_adjudication_command: protocolReject
          ? null
          : freeTextBlindCommandFor({ s0Path, s1Path, sibling, family, outPath: freeTextBlindReport }),
        free_text_blind_adjudication_command_text: protocolReject
          ? null
          : commandString(freeTextBlindCommandFor({ s0Path, s1Path, sibling, family, outPath: freeTextBlindReport })),
        s1_axiom_replay_dir: protocolReject ? null : s1AxiomReplayDir,
        s1_axiom_replay_command: protocolReject
          ? null
          : replayCommandFor(heldoutBasePath, { outDir: s1AxiomReplayDir, policyMemoryPath: admittedAxiomPath }),
        s1_axiom_replay_command_text: protocolReject
          ? null
          : commandString(
              replayCommandFor(heldoutBasePath, { outDir: s1AxiomReplayDir, policyMemoryPath: admittedAxiomPath }),
            ),
      };
    });
    return {
      family_id: family.family_id,
      training_seed_id: family.training_seed?.seed_id || null,
      family_dir: familyDir,
      attempt1_training_transcript: trainingTranscript,
      axiom_template: axiomPath,
      admitted_axiom_path: admittedAxiomPath,
      attempt1_replay_dir: attempt1ReplayDir,
      attempt1_replay_command: replayCommandFor(trainingTranscript, { outDir: attempt1ReplayDir }),
      attempt1_replay_command_text: commandString(replayCommandFor(trainingTranscript, { outDir: attempt1ReplayDir })),
      axiom_induction_command: axiomInductionCommand,
      axiom_induction_command_text: commandString(axiomInductionCommand),
      heldout,
      local_gate_status:
        validation.status === 'pass' ? 'ready_for_attempt1_materialization' : 'blocked_by_static_validation',
    };
  });
  return {
    kind: 'teaching_drama_axiom_attempt_materialization_plan',
    created_at: new Date().toISOString(),
    claim_boundary: 'simulated_teacher_as_learner_not_human_learning',
    source_protocol: repoRel(protocolPath),
    source_config: repoRel(configPath),
    out_dir: outDir,
    validation,
    families,
    stop_rule:
      'Do not run paid generation, panels, retrieval, fine-tuning, DPO, process reward modeling, or self-edits until this zero-API protocol is frozen.',
  };
}

export function materializeAttemptFixtures({
  protocolPath = DEFAULT_PROTOCOL,
  configPath = DEFAULT_CONFIG,
  outDir = DEFAULT_OUT_DIR,
  familyId = null,
  force = false,
} = {}) {
  const plan = buildAttemptMaterializationPlan({ protocolPath, configPath, outDir, familyId });
  if (plan.validation.status !== 'pass') {
    throw new Error(`static validation failed: ${plan.validation.summary.errors} errors`);
  }
  if (fs.existsSync(outDir)) {
    if (!force) throw new Error(`output exists: ${outDir} (pass --force to overwrite)`);
    fs.rmSync(outDir, { recursive: true, force: true });
  }
  fs.mkdirSync(outDir, { recursive: true });
  const config = readYaml(configPath);
  const selectedFamilies = asArray(config?.families).filter((family) => !familyId || family.family_id === familyId);

  for (const family of selectedFamilies) {
    const familyPlan = plan.families.find((entry) => entry.family_id === family.family_id);
    fs.mkdirSync(familyPlan.family_dir, { recursive: true });
    fs.writeFileSync(familyPlan.attempt1_training_transcript, renderTrainingTranscript(family), 'utf8');
    writeJson(familyPlan.axiom_template, axiomTemplate(family));
    for (const sibling of asArray(family.heldout_siblings)) {
      const heldoutPlan = familyPlan.heldout.find((entry) => entry.sibling_id === sibling.sibling_id);
      if (heldoutPlan.protocol_reject) {
        writeJson(path.join(familyPlan.family_dir, safeSlug(sibling.sibling_id), 'protocol-reject.json'), {
          sibling_id: sibling.sibling_id,
          protocol_reject: true,
          protocol_reject_reason: sibling.protocol_reject_reason,
          expected_card_verdict: sibling.expected_card_verdict,
        });
        continue;
      }
      fs.mkdirSync(path.dirname(heldoutPlan.s0_public_transcript), { recursive: true });
      fs.writeFileSync(heldoutPlan.heldout_base_transcript, renderHeldoutBaseTranscript({ family, sibling }), 'utf8');
      fs.writeFileSync(
        heldoutPlan.s0_public_transcript,
        renderHeldoutTranscript({ family, sibling, armName: 's0' }),
        'utf8',
      );
      fs.writeFileSync(
        heldoutPlan.s1_public_transcript,
        renderHeldoutTranscript({ family, sibling, armName: 's1' }),
        'utf8',
      );
    }
  }

  writeJson(path.join(outDir, 'static-validation.json'), plan.validation);
  writeJson(path.join(outDir, 'attempt-materialization-plan.json'), plan);
  const commands = [];
  for (const family of plan.families) {
    commands.push(`# ${family.family_id} attempt-1 replay through A18 recursive gate`);
    commands.push(family.attempt1_replay_command_text);
    commands.push(`# ${family.family_id} fixture blind adjudication for admitted held-out cards`);
    for (const sibling of family.heldout) {
      if (sibling.blind_adjudication_command_text) commands.push(sibling.blind_adjudication_command_text);
      else commands.push(`# ${sibling.sibling_id}: protocol_reject (${sibling.protocol_reject_reason})`);
    }
    commands.push(`# ${family.family_id} axiom induction after a real attempt-1 survivor`);
    commands.push(family.axiom_induction_command_text);
    commands.push(`# ${family.family_id} S1 replay commands use exactly one admitted axiom, not revision.json`);
    for (const sibling of family.heldout) {
      if (sibling.s1_axiom_replay_command_text) commands.push(sibling.s1_axiom_replay_command_text);
      else commands.push(`# ${sibling.sibling_id}: protocol_reject (${sibling.protocol_reject_reason})`);
    }
  }
  commands.push('# A19 attempt-1 gate summary after replay artifacts exist');
  commands.push(
    commandString([
      'npm',
      'run',
      'a19:attempt1',
      '--',
      '--out-dir',
      repoRel(outDir),
      '--out',
      'notes/adaptive_2_0/a19-attempt1-fixture-gate-report.md',
    ]),
  );
  fs.writeFileSync(path.join(outDir, 'next-commands.sh'), `${commands.join('\n')}\n`, 'utf8');
  return plan;
}

export function runMaterializer(rawArgs = process.argv.slice(2)) {
  const args = Array.isArray(rawArgs) ? parseArgs(rawArgs) : { ...parseArgs([]), ...rawArgs };
  if (args.help) return { help: usage() };
  return args.dryRun
    ? buildAttemptMaterializationPlan({
        protocolPath: args.protocol,
        configPath: args.config,
        outDir: args.outDir,
        familyId: args.familyId,
      })
    : materializeAttemptFixtures({
        protocolPath: args.protocol,
        configPath: args.config,
        outDir: args.outDir,
        familyId: args.familyId,
        force: args.force,
      });
}

function main() {
  const plan = runMaterializer();
  if (plan.help) {
    process.stdout.write(`${plan.help}\n`);
    return;
  }
  process.stdout.write(
    `A19 attempt materialization: ${plan.validation.status}\n` +
      `families=${plan.families.length} out_dir=${repoRel(plan.out_dir)}\n`,
  );
  if (plan.validation.status !== 'pass') process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
