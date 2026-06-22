#!/usr/bin/env node
/**
 * Analyze a Plan 2.5 prefix-branch replay against its predeclared screen gate.
 *
 * The analyzer is intentionally model-free: it reads the replay manifest, design
 * YAML, score JSON(s), and branch transcripts, then emits pass/fail reports.
 * Fresh-scene batteries can use several critic score files; branch promotion is
 * decided by the design's required_critic_agreement.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';
import { recognitionOriginForScoreRow } from './lib/recognitionOrigin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

function usage() {
  return `Usage:
  node scripts/analyze-plan25-branch-screen.js --run-dir <replay-output-dir> [--out-dir <dir>] [--score-files <a.json,b.json>]

The run directory must contain manifest.json. Score files are read from
manifest.outputs.scores, manifest.outputs.score, or --score-files.
`;
}

function parseArgs(argv = process.argv.slice(2)) {
  const opts = { runDir: null, outDir: null, scoreFiles: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--run-dir':
        opts.runDir = path.resolve(argv[++i]);
        break;
      case '--out-dir':
        opts.outDir = path.resolve(argv[++i]);
        break;
      case '--score-files':
        opts.scoreFiles.push(
          ...String(argv[++i] || '')
            .split(',')
            .map((p) => p.trim())
            .filter(Boolean)
            .map((p) => path.resolve(p)),
        );
        break;
      case '--help':
      case '-h':
        opts.help = true;
        break;
      default:
        throw new Error(`Unknown arg: ${arg}\n\n${usage()}`);
    }
  }
  return opts;
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function readYaml(p) {
  return yaml.parse(fs.readFileSync(p, 'utf8')) || {};
}

function resolveRoot(relativeOrAbsolute) {
  return path.isAbsolute(relativeOrAbsolute)
    ? relativeOrAbsolute
    : path.resolve(ROOT, relativeOrAbsolute);
}

function rowId(row = {}) {
  return row.id || row.item_id || row.itemId || row.tid || row.condition || row.key;
}

function parseTranscriptTurns(raw) {
  const turns = [];
  const blocks = String(raw || '')
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  for (const block of blocks) {
    const match = block.match(/^(STAGE|TUTOR|LEARNER):\s*([\s\S]*)$/);
    if (match) {
      turns.push({ role: match[1], text: match[2].trim() });
    } else if (turns.length) {
      turns[turns.length - 1].text += `\n\n${block}`;
    }
  }
  return turns;
}

function learnerSuffixTextFromTranscript(transcriptText = '', manifestBranch = {}) {
  const turns = parseTranscriptTurns(transcriptText);
  if (!turns.length) return '';
  const prefixCount = Number(manifestBranch?.turn_counts?.prefix);
  const suffixTurns = Number.isFinite(prefixCount) ? turns.slice(prefixCount) : turns.slice(-2);
  const learnerSuffix = suffixTurns.filter((turn) => turn.role === 'LEARNER').map((turn) => turn.text);
  if (learnerSuffix.length) return learnerSuffix.join('\n\n');
  const lastLearner = [...turns].reverse().find((turn) => turn.role === 'LEARNER');
  return lastLearner?.text || '';
}

function originFor(row = {}, learnerSuffixText = '') {
  const learnerText = String(learnerSuffixText || '').trim();
  if (!learnerText) return recognitionOriginForScoreRow(row);
  return recognitionOriginForScoreRow({
    ...row,
    actionalBreakthroughEvidence: [row.actionalBreakthroughEvidence, learnerText].filter(Boolean).join('\n'),
  });
}

function scoreAt(origin, key) {
  const value = Number(origin?.scores?.[key]);
  return Number.isFinite(value) ? value : 0;
}

const SMALL_WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const TENS_WORDS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function intToWords(n) {
  const value = Number(n);
  if (!Number.isInteger(value) || value < 0 || value > 999) return null;
  if (value < 20) return SMALL_WORDS[value];
  if (value < 100) {
    const ten = Math.floor(value / 10);
    const one = value % 10;
    return one ? `${TENS_WORDS[ten]}-${SMALL_WORDS[one]}` : TENS_WORDS[ten];
  }
  const hundred = Math.floor(value / 100);
  const rem = value % 100;
  return rem ? `${SMALL_WORDS[hundred]} hundred ${intToWords(rem)}` : `${SMALL_WORDS[hundred]} hundred`;
}

function legacyAliasesForRequiredNumber(needle) {
  const s = String(needle?.value ?? needle);
  if (s === '94') {
    return ['94', 'ninety-four', 'ninety four', '940/1000', '940 over 1000', 'nine-forty over a thousand'];
  }
  if (s === '16.7') {
    return ['16.7', '17', 'seventeen', '10/(10+50)', '10/60', '10 over 60', 'ten over sixty'];
  }
  return [s];
}

function aliasesForRequiredNumber(needle) {
  const spec = typeof needle === 'object' && needle ? needle : { value: needle };
  const value = String(spec.value ?? '').trim();
  const aliases = new Set([...legacyAliasesForRequiredNumber(spec), value, ...(spec.aliases || [])].filter(Boolean));
  const bareNumber = value.replace(/%$/, '');
  const n = Number(bareNumber);
  if (Number.isFinite(n)) {
    aliases.add(String(n));
    aliases.add(`${n}%`);
    if (Number.isInteger(n)) {
      aliases.add(`${n}.0`);
      const words = intToWords(n);
      if (words) {
        aliases.add(words);
        aliases.add(words.replace(/-/g, ' '));
      }
    } else {
      const rounded = Math.round(n);
      aliases.add(String(rounded));
      aliases.add(`${rounded}%`);
      const roundedWords = intToWords(rounded);
      if (roundedWords) {
        aliases.add(roundedWords);
        aliases.add(roundedWords.replace(/-/g, ' '));
      }
    }
  }
  return [...aliases].map((alias) => String(alias).toLowerCase());
}

function containsAllNumbers(text, numbers = []) {
  const lower = String(text || '').toLowerCase();
  return numbers.every((needle) => aliasesForRequiredNumber(needle).some((alias) => lower.includes(alias)));
}

function requiredNumberLabels(numbers = []) {
  return numbers.map((n) => (typeof n === 'object' && n ? n.value : n)).join(', ');
}

function evalBranch({ key, criterion = {}, row, manifestBranch = {}, transcriptText, critic = null }) {
  const learnerSuffixText = learnerSuffixTextFromTranscript(transcriptText, manifestBranch);
  const origin = originFor(row, learnerSuffixText);
  const form = row?.formClass || row?.form_class || 'unknown';
  const checks = [];
  const add = (name, pass, detail) => checks.push({ name, pass: Boolean(pass), detail });

  if (criterion.required_form) add('required_form', form === criterion.required_form, `${form} == ${criterion.required_form}`);
  if (criterion.required_origin) add('required_origin', origin.class === criterion.required_origin, `${origin.class} == ${criterion.required_origin}`);
  if (criterion.required_subtype) {
    add(
      'required_subtype',
      origin.mechanismSubtype === criterion.required_subtype,
      `${origin.mechanismSubtype} == ${criterion.required_subtype}`,
    );
  }
  if (Array.isArray(criterion.allowed_origins) && criterion.allowed_origins.length) {
    add('allowed_origins', criterion.allowed_origins.includes(origin.class), `${origin.class} in ${criterion.allowed_origins.join(', ')}`);
  }
  if (Array.isArray(criterion.allowed_subtypes) && criterion.allowed_subtypes.length) {
    add(
      'allowed_subtypes',
      criterion.allowed_subtypes.includes(origin.mechanismSubtype),
      `${origin.mechanismSubtype} in ${criterion.allowed_subtypes.join(', ')}`,
    );
  }
  if (Array.isArray(criterion.disallowed_subtypes) && criterion.disallowed_subtypes.length) {
    add(
      'disallowed_subtypes',
      !criterion.disallowed_subtypes.includes(origin.mechanismSubtype),
      `${origin.mechanismSubtype} not in ${criterion.disallowed_subtypes.join(', ')}`,
    );
  }

  const minimums = [
    ['learner_self_reframe_min', 'learnerSelfReframe'],
    ['learner_action_min', 'learnerAction'],
    ['tutor_mechanism_min', 'tutorAdaptiveMechanism'],
    ['adaptive_mechanism_quality_min', 'adaptiveMechanismQuality'],
  ];
  for (const [criterionKey, scoreKey] of minimums) {
    if (criterion[criterionKey] != null) {
      const actual = scoreAt(origin, scoreKey);
      add(criterionKey, actual >= Number(criterion[criterionKey]), `${actual} >= ${criterion[criterionKey]}`);
    }
  }

  if (Array.isArray(criterion.required_learner_numbers) && criterion.required_learner_numbers.length) {
    add(
      'required_learner_numbers',
      containsAllNumbers(learnerSuffixText, criterion.required_learner_numbers),
      `${requiredNumberLabels(criterion.required_learner_numbers)} present in learner suffix`,
    );
  }

  if (criterion.no_metric_repair_leak) {
    const violations = manifestBranch?.suffix_forbidden_audit?.violations || [];
    add('no_metric_repair_leak', violations.length === 0, violations.length ? violations.join(', ') : 'no violations');
  }

  return {
    key,
    critic,
    pass: checks.every((check) => check.pass),
    form,
    origin: origin.class || 'unknown',
    subtype: origin.mechanismSubtype || 'unknown',
    scores: origin.scores || {},
    checks,
  };
}

function scoreFilesFromManifest(manifest, opts) {
  if (opts.scoreFiles?.length) {
    return opts.scoreFiles.map((p) => ({ label: path.basename(p, path.extname(p)), path: p }));
  }
  if (manifest.outputs?.scores && typeof manifest.outputs.scores === 'object') {
    return Object.entries(manifest.outputs.scores).map(([label, p]) => ({ label, path: resolveRoot(p) }));
  }
  if (manifest.outputs?.score) {
    return [{ label: path.basename(manifest.outputs.score, path.extname(manifest.outputs.score)), path: resolveRoot(manifest.outputs.score) }];
  }
  return [];
}

function scoreRowsByCritic(scoreFiles) {
  return scoreFiles.map(({ label, path: scorePath }) => {
    if (!fs.existsSync(scorePath)) throw new Error(`Score file not found: ${scorePath}`);
    const scores = readJson(scorePath);
    return {
      label,
      path: scorePath,
      rows: new Map((scores.scored || []).map((row) => [rowId(row), row])),
    };
  });
}

function agreementRequiredFor(design, criterion) {
  const n = Number(
    criterion.required_critic_agreement ??
      design.success_criteria?.required_critic_agreement ??
      design.required_critic_agreement ??
      1,
  );
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function aggregateBranch({ key, criterion, manifestBranch, transcriptText, critics, design }) {
  const criticResults = critics.map((critic) => {
    const row = critic.rows.get(key);
    if (!row) {
      return {
        key,
        critic: critic.label,
        pass: false,
        form: 'missing',
        origin: 'missing',
        subtype: 'missing',
        scores: {},
        checks: [{ name: 'score_row_present', pass: false, detail: `No score row for ${key}` }],
      };
    }
    return evalBranch({ key, criterion, row, manifestBranch, transcriptText, critic: critic.label });
  });
  const requiredAgreement = Math.min(agreementRequiredFor(design, criterion), criticResults.length || 1);
  const passCount = criticResults.filter((result) => result.pass).length;
  return {
    key,
    pass: passCount >= requiredAgreement,
    required_critic_agreement: requiredAgreement,
    critic_pass_count: passCount,
    critic_results: criticResults,
    form: criticResults.map((r) => `${r.critic}:${r.form}`).join(', '),
    origin: criticResults.map((r) => `${r.critic}:${r.origin}`).join(', '),
    subtype: criticResults.map((r) => `${r.critic}:${r.subtype}`).join(', '),
  };
}

function markdownReport({ runDir, scoreFiles, manifest, branchResults, pass }) {
  const lines = [
    '# Plan 2.5 Branch Screen Analysis',
    '',
    `Run: \`${path.relative(ROOT, runDir)}\``,
    `Score files: ${scoreFiles.map((s) => `\`${path.relative(ROOT, s.path)}\``).join(', ')}`,
    `Mode: \`${manifest.mode || manifest.learner_generation?.mode || 'unknown'}\``,
    `Overall: **${pass ? 'PASS' : 'FAIL'}**`,
    '',
    '| Branch | Form | Origin | Subtype | Gate |',
    '|---|---:|---:|---:|---:|',
  ];
  for (const result of branchResults) {
    lines.push(
      `| \`${result.key}\` | ${result.form} | ${result.origin} | ${result.subtype} | ${
        result.pass ? 'PASS' : 'FAIL'
      } (${result.critic_pass_count}/${result.required_critic_agreement}) |`,
    );
  }
  lines.push('', '## Checks', '');
  for (const result of branchResults) {
    lines.push(`### ${result.key}`, '');
    for (const criticResult of result.critic_results) {
      lines.push(`#### ${criticResult.critic}`, '');
      for (const check of criticResult.checks) {
        lines.push(`- ${check.pass ? 'PASS' : 'FAIL'} ${check.name}: ${check.detail}`);
      }
      lines.push('');
    }
  }
  return `${lines.join('\n').trim()}\n`;
}

function main() {
  const opts = parseArgs();
  if (opts.help) {
    process.stdout.write(usage());
    return;
  }
  if (!opts.runDir) throw new Error(`Missing --run-dir\n\n${usage()}`);
  const runDir = opts.runDir;
  const manifestPath = path.join(runDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) throw new Error(`manifest.json not found in ${runDir}`);
  const manifest = readJson(manifestPath);
  const designPath = resolveRoot(manifest.design);
  if (!fs.existsSync(designPath)) throw new Error(`Design not found: ${designPath}`);
  const design = readYaml(designPath);
  const scoreFiles = scoreFilesFromManifest(manifest, opts);
  if (!scoreFiles.length) throw new Error('No score files found in manifest; pass --score-files.');
  const critics = scoreRowsByCritic(scoreFiles);
  const criteria = design.success_criteria?.cheap_replay_screen || {};

  const branchResults = Object.keys(design.branches || {}).map((key) => {
    const manifestBranch = manifest.branches?.[key] || {};
    const transcriptPath = manifestBranch.transcript ? resolveRoot(manifestBranch.transcript) : null;
    const transcriptText = transcriptPath && fs.existsSync(transcriptPath) ? fs.readFileSync(transcriptPath, 'utf8') : '';
    return aggregateBranch({
      key,
      criterion: criteria[key] || {},
      manifestBranch,
      transcriptText,
      critics,
      design,
    });
  });

  const pass = branchResults.every((result) => result.pass);
  const outDir = opts.outDir || runDir;
  fs.mkdirSync(outDir, { recursive: true });
  const report = {
    schema: 'plan25_branch_screen_analysis_v0_2',
    generated_at: new Date().toISOString(),
    run_dir: path.relative(ROOT, runDir),
    design: path.relative(ROOT, designPath),
    scores: scoreFiles.map((s) => ({ label: s.label, path: path.relative(ROOT, s.path) })),
    pass,
    branch_results: branchResults,
  };
  const jsonPath = path.join(outDir, 'screen-analysis.json');
  const mdPath = path.join(outDir, 'screen-analysis.md');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(mdPath, markdownReport({ runDir, scoreFiles, manifest, branchResults, pass }), 'utf8');

  for (const result of branchResults) {
    process.stdout.write(
      `${result.pass ? 'PASS' : 'FAIL'} ${result.key}: ${result.critic_pass_count}/${result.required_critic_agreement} critics\n`,
    );
  }
  process.stdout.write(`Overall: ${pass ? 'PASS' : 'FAIL'}\n`);
  process.stdout.write(`Report: ${path.relative(ROOT, mdPath)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  aliasesForRequiredNumber,
  containsAllNumbers,
  evalBranch,
  learnerSuffixTextFromTranscript,
  parseArgs,
};
