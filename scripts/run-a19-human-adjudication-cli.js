#!/usr/bin/env node
/**
 * Interactive A19 human adjudication CLI.
 *
 * This is a thin prompt layer over the blinded assignment/codebook artifacts.
 * It writes the same JSON coder file that the validator and merge/report
 * scripts already consume.
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import theme from '../services/cliTheme.js';
import { validateA19HumanCoderFile } from './validate-a19-human-coder-file.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_ASSIGNMENT = path.join(
  ROOT,
  'exports',
  'a19',
  'human-coder-assignments',
  'moral-disclosure-standing-repair-a.assignment.json',
);
const DEFAULT_CODEBOOK = path.join(
  ROOT,
  'exports',
  'a19',
  'adjudication-codebooks',
  'learner-standing-v01.codebook.json',
);
const DEFAULT_CODER_ROLE = 'expert_or_semi_expert';

function usage() {
  return `Usage:
  node scripts/run-a19-human-adjudication-cli.js \\
    [--assignment exports/a19/human-coder-assignments/moral-disclosure-standing-repair-a.assignment.json] \\
    [--codebook exports/a19/adjudication-codebooks/learner-standing-v01.codebook.json] \\
    [--out-dir exports/a19/human-coder-submissions/moral-disclosure-standing-repair-a] \\
    [--out exports/a19/human-coder-submissions/moral-disclosure-standing-repair-a/coder-001.json] \\
    [--coder-id coder-001] [--coder-role expert_or_semi_expert] [--overwrite]

Offline only. Prompts through the blinded assignment, writes one coder JSON file,
and validates it immediately.`;
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    assignment: DEFAULT_ASSIGNMENT,
    codebook: DEFAULT_CODEBOOK,
    outDir: null,
    out: null,
    coderId: null,
    coderRole: DEFAULT_CODER_ROLE,
    overwrite: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') args.help = true;
    else if (token === '--assignment') args.assignment = path.resolve(argv[++i]);
    else if (token === '--codebook') args.codebook = path.resolve(argv[++i]);
    else if (token === '--out-dir') args.outDir = path.resolve(argv[++i]);
    else if (token === '--out') args.out = path.resolve(argv[++i]);
    else if (token === '--coder-id') args.coderId = argv[++i];
    else if (token === '--coder-role') args.coderRole = argv[++i];
    else if (token === '--overwrite') args.overwrite = true;
    else throw new Error(`unknown arg: ${token}\n\n${usage()}`);
  }
  if (args.help) return args;
  if (!fs.existsSync(args.assignment)) throw new Error(`assignment not found: ${args.assignment}`);
  if (!fs.existsSync(args.codebook)) throw new Error(`codebook not found: ${args.codebook}`);
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function repoRel(filePath) {
  return path.relative(ROOT, path.resolve(filePath));
}

function defaultSuffix(defaultValue) {
  return defaultValue === '' ? '' : ` ${theme.defaultValue(defaultValue)}`;
}

function validationSeverity(severity) {
  if (severity === 'error') return theme.error(severity);
  if (severity === 'warning') return theme.warn(severity);
  return theme.status(severity);
}

function formatTranscript(text) {
  return String(text || '')
    .split('\n')
    .map((line) =>
      line.replace(/^(STAGE|LEARNER|TUTOR):/u, (_match, role) => `${theme.transcriptRole(role)}${theme.dim(':')}`),
    )
    .join('\n');
}

function assignmentSlug(assignmentPath) {
  const base = path.basename(assignmentPath);
  return base.endsWith('.assignment.json') ? base.replace(/\.assignment\.json$/u, '') : base.replace(/\.json$/u, '');
}

export function defaultSubmissionDirForAssignment(assignmentPath) {
  return path.join(ROOT, 'exports', 'a19', 'human-coder-submissions', assignmentSlug(assignmentPath));
}

export function nextCoderId(outDir) {
  if (!fs.existsSync(outDir)) return 'coder-001';
  const indexes = fs
    .readdirSync(outDir)
    .map((entry) => /^coder-(\d+)\.json$/u.exec(entry)?.[1])
    .filter(Boolean)
    .map((entry) => Number.parseInt(entry, 10))
    .filter(Number.isFinite);
  const next = indexes.length ? Math.max(...indexes) + 1 : 1;
  return `coder-${String(next).padStart(3, '0')}`;
}

export function buildCoderSubmission({
  assignment,
  codebook,
  coderId,
  coderRole = DEFAULT_CODER_ROLE,
  armJudgments,
  pairwiseJudgment,
  codebookFeedback = { ambiguous_terms: [], suggested_revision: '' },
  codedAt = new Date().toISOString(),
}) {
  return {
    coder_file_version: 'a19-human-coder-v01',
    coder_id: coderId,
    coder_role: coderRole,
    packet_id: assignment.packet_id,
    packet_sha256: assignment.packet_sha256,
    codebook_id: codebook.codebook_id,
    coded_at: codedAt,
    arm_judgments: assignment.arms.map((arm) =>
      armJudgments.find((judgment) => judgment.arm_public_id === arm.arm_public_id),
    ),
    pairwise_judgment: pairwiseJudgment,
    codebook_feedback: codebookFeedback,
  };
}

function printChoices(choices, descriptions = {}) {
  choices.forEach((choice, index) => {
    const description = descriptions[choice] ? theme.choiceDescription(` - ${descriptions[choice]}`) : '';
    output.write(`  ${theme.choiceIndex(`${index + 1}.`)} ${theme.choiceValue(choice)}${description}\n`);
  });
}

async function promptLine(rl, label, { defaultValue = '', required = true } = {}) {
  for (;;) {
    const answer = (await rl.question(`${theme.prompt(label)}${defaultSuffix(defaultValue)}: `)).trim();
    const value = answer || defaultValue;
    if (!required || value) return value;
    output.write(`${theme.warn('A value is required.')}\n`);
  }
}

async function chooseOne(rl, label, choices, { defaultValue = null, descriptions = {} } = {}) {
  for (;;) {
    output.write(`\n${theme.header(label)}\n`);
    printChoices(choices, descriptions);
    const defaultLabel = defaultValue ? ` ${theme.defaultValue(defaultValue)}` : '';
    const answer = (await rl.question(`${theme.prompt('Choose number or value')}${defaultLabel}: `)).trim();
    if (!answer && defaultValue) return defaultValue;
    const index = Number.parseInt(answer, 10);
    if (Number.isInteger(index) && index >= 1 && index <= choices.length) return choices[index - 1];
    if (choices.includes(answer)) return answer;
    output.write(`${theme.warn(`Invalid choice. Use 1-${choices.length} or an exact value.`)}\n`);
  }
}

async function chooseMany(rl, label, choices, { defaultValues = ['none'], descriptions = {} } = {}) {
  for (;;) {
    output.write(`\n${theme.header(label)}\n`);
    printChoices(choices, descriptions);
    const answer = (
      await rl.question(
        `${theme.prompt('Choose comma-separated numbers or values')} ${theme.defaultValue(defaultValues.join(', '))}: `,
      )
    ).trim();
    const parts = answer
      ? answer
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean)
      : defaultValues;
    const values = parts.map((part) => {
      const index = Number.parseInt(part, 10);
      if (Number.isInteger(index) && index >= 1 && index <= choices.length) return choices[index - 1];
      return part;
    });
    const unknown = values.filter((entry) => !choices.includes(entry));
    if (unknown.length) {
      output.write(`${theme.warn(`Invalid choice(s): ${unknown.join(', ')}`)}\n`);
      continue;
    }
    if (values.includes('none') && values.length > 1) {
      output.write(`${theme.warn('Use `none` by itself, or select one or more concrete excluded moves.')}\n`);
      continue;
    }
    return [...new Set(values)];
  }
}

async function chooseBoolean(rl, label, { defaultValue = false } = {}) {
  const defaultText = defaultValue ? 'yes' : 'no';
  for (;;) {
    const answer = (await rl.question(`${theme.prompt(label)} ${theme.defaultValue(defaultText)}: `))
      .trim()
      .toLowerCase();
    if (!answer) return defaultValue;
    if (['y', 'yes', 'true', '1'].includes(answer)) return true;
    if (['n', 'no', 'false', '0'].includes(answer)) return false;
    output.write(`${theme.warn('Answer yes or no.')}\n`);
  }
}

async function promptConfidence(rl) {
  for (;;) {
    const answer = (await rl.question(`${theme.prompt('Confidence, 0 to 1')} ${theme.defaultValue('0.5')}: `)).trim();
    const value = answer ? Number.parseFloat(answer) : 0.5;
    if (Number.isFinite(value) && value >= 0 && value <= 1) return value;
    output.write(`${theme.warn('Confidence must be a number from 0 to 1.')}\n`);
  }
}

function descriptionsById(entries = []) {
  return Object.fromEntries(entries.map((entry) => [entry.id, entry.description]));
}

function labelDescriptions(codebook) {
  return {
    [codebook.target_label]: codebook.target_definition,
    ...(codebook.near_miss_guidance || {}),
  };
}

async function collectEvidenceSpans(rl, { codebook }) {
  const supportChoices = [
    'primary_label',
    'target_status',
    'target_granularity_risk',
    ...codebook.required_obligations.map((entry) => entry.id),
    ...codebook.excluded_moves,
  ];
  const spans = [];
  for (;;) {
    const quote = await promptLine(rl, 'Evidence quote, short copied phrase');
    const supports = await chooseOne(rl, 'What does this quote support?', supportChoices, {
      defaultValue: 'primary_label',
    });
    spans.push({ quote, supports });
    const addAnother = await chooseBoolean(rl, 'Add another evidence quote?', { defaultValue: false });
    if (!addAnother) return spans;
  }
}

async function collectArmJudgment(rl, { arm, codebook }) {
  output.write(`\n${theme.divider('='.repeat(60))}\n`);
  output.write(`${theme.header(arm.arm_public_id)}\n`);
  output.write(`${theme.divider('='.repeat(60))}\n`);
  output.write(`${formatTranscript(arm.transcript)}\n`);
  output.write(`${theme.divider('='.repeat(60))}\n`);
  if (arm.visible_alias_audit?.instruction) {
    output.write(`${theme.warn('Alias audit note:')} ${theme.dim(arm.visible_alias_audit.instruction)}\n`);
  }

  const primaryLabel = await chooseOne(
    rl,
    'Primary repair label',
    [codebook.target_label, ...codebook.near_miss_labels],
    {
      defaultValue: 'unclear',
      descriptions: labelDescriptions(codebook),
    },
  );
  const targetStatus = await chooseOne(rl, 'Target status', codebook.target_status_values, { defaultValue: 'unclear' });
  const targetGranularityRisk = await chooseBoolean(rl, 'Target-granularity risk present?', { defaultValue: false });
  const obligations = {};
  const obligationDescriptions = descriptionsById(codebook.required_obligations);
  for (const obligation of codebook.required_obligations) {
    obligations[obligation.id] = await chooseOne(
      rl,
      `Obligation: ${obligation.id} - ${obligationDescriptions[obligation.id]}`,
      codebook.obligation_values,
      { defaultValue: 'unclear' },
    );
  }
  const excludedMovesPresent = await chooseMany(rl, 'Excluded moves present', ['none', ...codebook.excluded_moves], {
    defaultValues: ['none'],
  });
  const evidenceSpans = await collectEvidenceSpans(rl, { codebook });
  const rationale = await promptLine(rl, 'Rationale, 2-5 sentences');
  const confidence = await promptConfidence(rl);
  return {
    arm_public_id: arm.arm_public_id,
    primary_label: primaryLabel,
    target_status: targetStatus,
    target_granularity_risk: targetGranularityRisk,
    obligations,
    excluded_moves_present: excludedMovesPresent,
    evidence_spans: evidenceSpans,
    rationale,
    confidence,
  };
}

async function collectPairwiseJudgment(rl, { codebook }) {
  const betterArmPublicId = await chooseOne(
    rl,
    'Which arm better restores learner standing?',
    codebook.pairwise_better_arm_values,
    { defaultValue: 'unclear' },
  );
  const betterForTargetReason = await chooseBoolean(rl, 'Is that preference for the target construct reason?', {
    defaultValue: betterArmPublicId !== 'unclear' && betterArmPublicId !== 'neither',
  });
  const reason = await promptLine(rl, 'Pairwise reason');
  const aliasLeakageAssessment = await chooseOne(
    rl,
    'Visible answer-key hint or alias leakage assessment',
    codebook.alias_leakage_assessment_values,
    { defaultValue: 'none_observed' },
  );
  return {
    better_arm_public_id: betterArmPublicId,
    better_for_target_reason: betterForTargetReason,
    reason,
    alias_leakage_assessment: aliasLeakageAssessment,
  };
}

async function collectCodebookFeedback(rl) {
  const ambiguousTermsRaw = await promptLine(rl, 'Ambiguous codebook terms, comma-separated', {
    defaultValue: '',
    required: false,
  });
  const suggestedRevision = await promptLine(rl, 'Suggested codebook revision, optional', {
    defaultValue: '',
    required: false,
  });
  return {
    ambiguous_terms: ambiguousTermsRaw
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
    suggested_revision: suggestedRevision,
  };
}

async function maybeConfirmOverwrite(rl, outPath, overwrite) {
  if (overwrite || !fs.existsSync(outPath)) return;
  const ok = await chooseBoolean(rl, `Output exists: ${repoRel(outPath)}. Overwrite?`, { defaultValue: false });
  if (!ok) throw new Error('aborted without overwriting existing coder file');
}

async function runInteractive(args) {
  const assignment = readJson(args.assignment);
  const codebook = readJson(args.codebook);
  const outDir = args.outDir || defaultSubmissionDirForAssignment(args.assignment);
  fs.mkdirSync(outDir, { recursive: true });
  const defaultCoderId = args.coderId || nextCoderId(outDir);
  const rl = readline.createInterface({ input, output });
  try {
    output.write(`\n${theme.header('A19 human adjudication CLI')}\n`);
    output.write(
      `${theme.warn('Use only the blinded assignment and codebook.')} ${theme.dim(
        'Do not inspect the assignment key or packet before coding.',
      )}\n`,
    );
    output.write(`${theme.key('Assignment:')} ${theme.filePath(repoRel(args.assignment))}\n`);
    output.write(`${theme.key('Codebook:')} ${theme.filePath(repoRel(args.codebook))}\n\n`);

    const coderId = await promptLine(rl, 'Coder ID', { defaultValue: defaultCoderId });
    const coderRole = await promptLine(rl, 'Coder role', { defaultValue: args.coderRole });
    const outPath = args.out || path.join(outDir, `${coderId}.json`);
    await maybeConfirmOverwrite(rl, outPath, args.overwrite);

    const armJudgments = [];
    for (const arm of assignment.arms) {
      armJudgments.push(await collectArmJudgment(rl, { arm, codebook }));
    }
    const pairwiseJudgment = await collectPairwiseJudgment(rl, { codebook });
    const codebookFeedback = await collectCodebookFeedback(rl);
    const coder = buildCoderSubmission({
      assignment,
      codebook,
      coderId,
      coderRole,
      armJudgments,
      pairwiseJudgment,
      codebookFeedback,
    });
    writeJson(outPath, coder);
    const validation = validateA19HumanCoderFile({
      assignmentPath: args.assignment,
      coderPath: outPath,
      codebookPath: args.codebook,
    });
    output.write(`\n${theme.success('Wrote')} ${theme.filePath(repoRel(outPath))}\n`);
    output.write(`${theme.key('Validation status:')} ${theme.status(validation.status)}\n`);
    if (validation.issues.length) {
      for (const issue of validation.issues) {
        output.write(`- ${validationSeverity(issue.severity)}: ${theme.filePath(issue.path)}: ${issue.message}\n`);
      }
    }
    if (validation.status !== 'pass') process.exitCode = 1;
  } finally {
    rl.close();
  }
}

async function main() {
  const args = parseArgs();
  if (args.help) {
    output.write(`${usage()}\n`);
    return;
  }
  await runInteractive(args);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(theme.error(error.message));
    process.exit(1);
  });
}
