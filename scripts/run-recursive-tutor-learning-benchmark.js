#!/usr/bin/env node
/**
 * A18 recursive tutor-learning benchmark harness.
 *
 * Zero-API implementation slice: validate artificial resistant scenario
 * families, materialize training/held-out transcript stubs, and write next-step
 * replay commands that reuse the existing discursive replay checker with the
 * recursive tutor-learning gate.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const DEFAULT_CONFIG = path.join(ROOT, 'config', 'recursive-tutor-learning', 'pilot-families.yaml');
const DEFAULT_OUT_DIR = path.join(ROOT, 'exports', 'recursive-tutor-learning', 'a18-pilot-local');

function usage() {
  return `Usage:
  node scripts/run-recursive-tutor-learning-benchmark.js
    [--config config/recursive-tutor-learning/pilot-families.yaml]
    [--out-dir exports/recursive-tutor-learning/a18-pilot-local]
    [--dry-run] [--force]

This is zero-API. It validates and materializes attempt-chain fixtures; it does
not call generator/checker CLIs.`;
}

export function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    config: DEFAULT_CONFIG,
    outDir: DEFAULT_OUT_DIR,
    dryRun: false,
    force: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--help' || token === '-h') args.help = true;
    else if (token === '--config') args.config = path.resolve(argv[++i]);
    else if (token === '--out-dir') args.outDir = path.resolve(argv[++i]);
    else if (token === '--dry-run') args.dryRun = true;
    else if (token === '--force') args.force = true;
    else throw new Error(`unknown arg: ${token}\n\n${usage()}`);
  }
  return args;
}

function readYaml(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`config not found: ${filePath}`);
  return yaml.parse(fs.readFileSync(filePath, 'utf8'));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function textFieldsForLeakage(family, seedLike) {
  return [
    ['public_setup', seedLike.public_setup],
    ['learner_resistance', seedLike.learner_resistance],
    ['baseline_tutor_attempt', seedLike.baseline_tutor_attempt],
  ].map(([field, value]) => ({
    family_id: family.family_id,
    seed_id: seedLike.seed_id || seedLike.sibling_id || null,
    field,
    text: String(value || ''),
  }));
}

function containsPhrase(text, phrase) {
  return String(text || '').toLowerCase().includes(String(phrase || '').toLowerCase());
}

function validateRequired(value, pathLabel, issues) {
  if (value == null || value === '') {
    issues.push({ severity: 'error', code: 'missing_required', path: pathLabel });
  }
}

export function validateBenchmarkConfig(config) {
  const issues = [];
  validateRequired(config?.meta?.schema_version, 'meta.schema_version', issues);
  const families = asArray(config?.families);
  if (!families.length) issues.push({ severity: 'error', code: 'no_families', path: 'families' });

  for (const [index, family] of families.entries()) {
    const prefix = `families[${index}]`;
    validateRequired(family.family_id, `${prefix}.family_id`, issues);
    validateRequired(family.obstruction_type, `${prefix}.obstruction_type`, issues);
    validateRequired(family.local_rule?.private_rule, `${prefix}.local_rule.private_rule`, issues);
    validateRequired(family.success_criterion, `${prefix}.success_criterion`, issues);
    const shortcuts = asArray(family.forbidden_shortcuts);
    if (!shortcuts.length) issues.push({ severity: 'error', code: 'missing_forbidden_shortcuts', path: prefix });

    const seed = family.training_seed || {};
    for (const field of ['seed_id', 'public_setup', 'learner_resistance', 'baseline_tutor_attempt', 'expected_failure']) {
      validateRequired(seed[field], `${prefix}.training_seed.${field}`, issues);
    }
    if (!asArray(family.heldout_siblings).length) {
      issues.push({ severity: 'error', code: 'no_heldout_siblings', path: `${prefix}.heldout_siblings` });
    }

    const publicParts = [
      ...textFieldsForLeakage(family, seed),
      ...asArray(family.heldout_siblings).flatMap((sibling) => textFieldsForLeakage(family, sibling)),
    ];
    for (const phrase of shortcuts) {
      for (const part of publicParts) {
        if (containsPhrase(part.text, phrase)) {
          issues.push({
            severity: 'error',
            code: 'forbidden_shortcut_leak',
            family_id: family.family_id,
            seed_id: part.seed_id,
            field: part.field,
            phrase,
          });
        }
      }
    }

    for (const [siblingIndex, sibling] of asArray(family.heldout_siblings).entries()) {
      const siblingPrefix = `${prefix}.heldout_siblings[${siblingIndex}]`;
      for (const field of ['sibling_id', 'public_setup', 'learner_resistance', 'baseline_tutor_attempt']) {
        validateRequired(sibling[field], `${siblingPrefix}.${field}`, issues);
      }
      if (sibling.public_setup === seed.public_setup) {
        issues.push({
          severity: 'error',
          code: 'heldout_duplicates_training_setup',
          path: `${siblingPrefix}.public_setup`,
          family_id: family.family_id,
        });
      }
    }
  }

  return {
    valid: !issues.some((issue) => issue.severity === 'error'),
    issues,
  };
}

function safeSlug(value) {
  return String(value || 'item')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function repoRel(filePath) {
  return path.relative(ROOT, path.resolve(filePath));
}

function renderTranscript({ family, caseId, phase, publicSetup, learnerResistance, tutorAttempt }) {
  return `# A18 Recursive Tutor-Learning Fixture

## Public Performance

\`\`\`text
STAGE: ${publicSetup}

LEARNER: "${learnerResistance}"

TUTOR: "${tutorAttempt}"

LEARNER: "I can compare those parts, but I am still using the part that looks most active unless there is a clearer public test."
\`\`\`

## Held-Out A18 Metadata

\`\`\`json
${JSON.stringify(
  {
    claim_boundary: 'simulated_teacher_as_learner_not_human_learning',
    family_id: family.family_id,
    case_id: caseId,
    phase,
    obstruction_type: family.obstruction_type,
    private_local_rule: family.local_rule?.private_rule || null,
    success_criterion: family.success_criterion,
    forbidden_shortcuts: family.forbidden_shortcuts || [],
  },
  null,
  2,
)}
\`\`\`
`;
}

function replayCommandFor(transcriptPath, policyMemoryPath = null) {
  const cmd = [
    'node',
    'scripts/replay-discursive-transcript.js',
    '--transcript',
    repoRel(transcriptPath),
    '--generator',
    'mock',
    '--checker',
    'mock',
    '--recursive-tutor-learning-gate',
  ];
  if (policyMemoryPath) cmd.push('--policy-memory', repoRel(policyMemoryPath));
  return cmd;
}

function commandString(cmd) {
  return cmd.map((part) => (/\s/.test(String(part)) ? JSON.stringify(part) : String(part))).join(' ');
}

function strategyRevisionTemplate(family) {
  return {
    family_id: family.family_id,
    status: 'template_unfilled',
    diagnostic_trigger: null,
    avoid_move: null,
    preferred_move: null,
    material_constraint: null,
    uptake_test: null,
    transfer_warning: null,
    expiry_condition: null,
    evidence_required: 'Fill from attempt-1 public learner resistance before any held-out replay.',
  };
}

export function buildAttemptChainPlan(config, { outDir = DEFAULT_OUT_DIR } = {}) {
  const validation = validateBenchmarkConfig(config);
  const families = asArray(config?.families).map((family) => {
    const familyDir = path.join(outDir, safeSlug(family.family_id));
    const trainingTranscript = path.join(familyDir, 'training-seed.full.md');
    const policyRevision = path.join(familyDir, 'policy-revision-template.json');
    const heldout = asArray(family.heldout_siblings).map((sibling) => {
      const transcript = path.join(familyDir, `${safeSlug(sibling.sibling_id)}.heldout.full.md`);
      return {
        sibling_id: sibling.sibling_id,
        transcript,
        replay_command: replayCommandFor(transcript, policyRevision),
        replay_command_text: commandString(replayCommandFor(transcript, policyRevision)),
      };
    });
    return {
      family_id: family.family_id,
      obstruction_type: family.obstruction_type,
      training_seed_id: family.training_seed?.seed_id || null,
      family_dir: familyDir,
      training_transcript: trainingTranscript,
      policy_revision_template: policyRevision,
      attempt1_replay_command: replayCommandFor(trainingTranscript),
      attempt1_replay_command_text: commandString(replayCommandFor(trainingTranscript)),
      heldout,
      local_gate_status: validation.valid ? 'ready_for_attempt1' : 'blocked_by_static_validation',
    };
  });
  return {
    kind: 'recursive_tutor_learning_attempt_chain_plan',
    created_at: new Date().toISOString(),
    claim_boundary: config?.meta?.claim_boundary || 'simulated_teacher_as_learner_not_human_learning',
    source_config: null,
    out_dir: outDir,
    validation,
    families,
    stop_rule: 'Do not run panel until at least one held-out family survives local gate without leakage, organic drift, or coherence confound.',
  };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function materializeAttemptChain(config, { configPath = DEFAULT_CONFIG, outDir = DEFAULT_OUT_DIR, force = false } = {}) {
  if (fs.existsSync(outDir)) {
    if (!force) throw new Error(`output exists: ${outDir} (pass --force to overwrite)`);
    fs.rmSync(outDir, { recursive: true, force: true });
  }
  fs.mkdirSync(outDir, { recursive: true });
  const plan = buildAttemptChainPlan(config, { outDir });
  plan.source_config = repoRel(configPath);

  for (const family of asArray(config.families)) {
    const familyPlan = plan.families.find((entry) => entry.family_id === family.family_id);
    fs.mkdirSync(familyPlan.family_dir, { recursive: true });
    fs.writeFileSync(
      familyPlan.training_transcript,
      renderTranscript({
        family,
        caseId: family.training_seed.seed_id,
        phase: 'training_seed_attempt1',
        publicSetup: family.training_seed.public_setup,
        learnerResistance: family.training_seed.learner_resistance,
        tutorAttempt: family.training_seed.baseline_tutor_attempt,
      }),
      'utf8',
    );
    writeJson(familyPlan.policy_revision_template, strategyRevisionTemplate(family));
    for (const sibling of asArray(family.heldout_siblings)) {
      const heldoutPlan = familyPlan.heldout.find((entry) => entry.sibling_id === sibling.sibling_id);
      fs.writeFileSync(
        heldoutPlan.transcript,
        renderTranscript({
          family,
          caseId: sibling.sibling_id,
          phase: 'heldout_sibling_baseline',
          publicSetup: sibling.public_setup,
          learnerResistance: sibling.learner_resistance,
          tutorAttempt: sibling.baseline_tutor_attempt,
        }),
        'utf8',
      );
    }
  }

  writeJson(path.join(outDir, 'static-validation.json'), plan.validation);
  writeJson(path.join(outDir, 'attempt-chain-plan.json'), plan);
  const commands = [];
  for (const family of plan.families) {
    commands.push(`# ${family.family_id} attempt 1`);
    commands.push(family.attempt1_replay_command_text);
    commands.push(`# ${family.family_id} held-out after filling ${repoRel(family.policy_revision_template)}`);
    for (const sibling of family.heldout) commands.push(sibling.replay_command_text);
  }
  fs.writeFileSync(path.join(outDir, 'next-commands.sh'), `${commands.join('\n')}\n`, 'utf8');
  return plan;
}

export function runBenchmark(rawArgs = process.argv.slice(2)) {
  const args = Array.isArray(rawArgs) ? parseArgs(rawArgs) : { ...parseArgs([]), ...rawArgs };
  if (args.help) return { help: usage() };
  const config = readYaml(args.config);
  const plan = args.dryRun
    ? buildAttemptChainPlan(config, { outDir: args.outDir })
    : materializeAttemptChain(config, { configPath: args.config, outDir: args.outDir, force: args.force });
  plan.source_config = repoRel(args.config);
  return plan;
}

function main() {
  try {
    const result = runBenchmark();
    if (result.help) {
      console.log(result.help);
      return;
    }
    console.log(
      JSON.stringify(
        {
          out_dir: repoRel(result.out_dir),
          families: result.families.length,
          valid: result.validation.valid,
          issues: result.validation.issues.length,
          status_counts: result.families.reduce((acc, family) => {
            acc[family.local_gate_status] = (acc[family.local_gate_status] || 0) + 1;
            return acc;
          }, {}),
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(error.message || String(error));
    process.exitCode = 1;
  }
}

if (process.argv[1] === __filename) main();

