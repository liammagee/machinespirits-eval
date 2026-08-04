#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import YAML from 'yaml';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
export const DEFAULT_LEDGER = path.join(
  REPO_ROOT,
  'config',
  'tutor-prompt-agency-audit-v1.yaml',
);
export const DEFAULT_REPORT = path.join(
  REPO_ROOT,
  'notes',
  '2026-08-05-tutor-prompt-agency-control-audit.md',
);

const PROMPT_FILE_PATTERN = /^tutor-(?:ego|superego|id-director).*\.md$/;
const FINDING_STATUSES = new Set(['protective', 'problematic', 'gray']);

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function collectPromptReferences(value, result = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) collectPromptReferences(item, result);
    return result;
  }
  if (!value || typeof value !== 'object') return result;
  for (const [key, nested] of Object.entries(value)) {
    if (
      key === 'prompt_file'
      && typeof nested === 'string'
      && PROMPT_FILE_PATTERN.test(path.basename(nested))
    ) {
      result.add(path.basename(nested));
    }
    collectPromptReferences(nested, result);
  }
  return result;
}

function readYaml(relativePath, root = REPO_ROOT) {
  return YAML.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function sameMembers(actual, expected) {
  return actual.length === expected.length
    && actual.every((value, index) => value === expected[index]);
}

function summarizeDimension(findings) {
  const statuses = new Set(findings.map((finding) => finding.status));
  if (statuses.has('protective') && statuses.has('problematic')) return 'mixed';
  if (statuses.has('problematic')) return 'problematic';
  if (statuses.has('gray')) return 'gray';
  if (statuses.has('protective')) return 'protective';
  return 'no_evidence';
}

function roleFor(file) {
  if (file === 'tutor-id-director.md') return 'id-director';
  if (file.startsWith('tutor-superego')) return 'superego';
  return 'ego';
}

export function buildTutorPromptAgencyAudit({
  root = REPO_ROOT,
  ledgerPath = DEFAULT_LEDGER,
} = {}) {
  const ledger = YAML.parse(fs.readFileSync(ledgerPath, 'utf8'));
  const errors = [];
  const dimensions = ledger.dimensions ?? [];
  const dimensionIds = dimensions.map((dimension) => dimension.id);
  if (dimensionIds.length !== 8 || new Set(dimensionIds).size !== 8) {
    errors.push('ledger must freeze exactly eight unique dimensions');
  }

  const active = new Set();
  for (const configFile of ledger.inventory?.config_files ?? []) {
    collectPromptReferences(readYaml(configFile, root), active);
  }
  for (const directFile of ledger.inventory?.direct_prompt_files ?? []) {
    active.add(path.basename(directFile));
  }
  const activeFiles = [...active].sort();

  const promptDirectory = path.join(root, 'prompts');
  const candidateFiles = fs.readdirSync(promptDirectory)
    .filter((file) => PROMPT_FILE_PATTERN.test(file))
    .sort();
  const discoveredExclusions = candidateFiles
    .filter((file) => !active.has(file))
    .sort();
  const declaredExclusions = (ledger.inventory?.excluded_prompt_files ?? [])
    .map((entry) => path.basename(entry.file))
    .sort();
  if (!sameMembers(discoveredExclusions, declaredExclusions)) {
    errors.push(
      `inactive prompt inventory drift: discovered [${discoveredExclusions.join(', ')}], declared [${declaredExclusions.join(', ')}]`,
    );
  }

  const audits = ledger.audits ?? [];
  const auditedFiles = audits.map((audit) => audit.file).sort();
  if (!sameMembers(activeFiles, auditedFiles)) {
    errors.push(
      `active prompt inventory drift: active [${activeFiles.join(', ')}], audited [${auditedFiles.join(', ')}]`,
    );
  }

  const promptResults = [];
  for (const audit of audits) {
    const promptPath = path.join(promptDirectory, audit.file);
    if (!fs.existsSync(promptPath)) {
      errors.push(`${audit.file}: prompt file is missing`);
      continue;
    }
    const content = fs.readFileSync(promptPath, 'utf8');
    const actualHash = sha256(content);
    if (actualHash !== audit.sha256) {
      errors.push(`${audit.file}: SHA-256 drift (${actualHash}, expected ${audit.sha256})`);
    }

    const findings = audit.findings ?? [];
    for (const finding of findings) {
      if (!dimensionIds.includes(finding.dimension)) {
        errors.push(`${audit.file}: unknown dimension ${finding.dimension}`);
      }
      if (!FINDING_STATUSES.has(finding.status)) {
        errors.push(`${audit.file}: invalid status ${finding.status}`);
      }
      if (!finding.snippet || !content.includes(finding.snippet)) {
        errors.push(`${audit.file}: evidence snippet not found for ${finding.dimension}`);
      }
      if (!finding.rationale) {
        errors.push(`${audit.file}: missing rationale for ${finding.dimension}`);
      }
    }

    const scores = Object.fromEntries(
      dimensionIds.map((dimension) => [
        dimension,
        summarizeDimension(findings.filter((finding) => finding.dimension === dimension)),
      ]),
    );
    promptResults.push({
      file: audit.file,
      role: roleFor(audit.file),
      sha256: actualHash,
      scores,
      findings,
      audit_note: audit.audit_note,
    });
  }

  const resultByFile = new Map(promptResults.map((result) => [result.file, result]));
  const comparisons = (ledger.comparisons ?? []).map((comparison) => {
    const left = resultByFile.get(comparison.left);
    const right = resultByFile.get(comparison.right);
    if (!left || !right) {
      errors.push(`${comparison.id}: comparison references an unaudited prompt`);
      return { ...comparison, dimensions: [] };
    }
    return {
      ...comparison,
      dimensions: dimensionIds.map((dimension) => ({
        dimension,
        left: left.scores[dimension],
        right: right.scores[dimension],
        parity: left.scores[dimension] === right.scores[dimension],
      })),
    };
  });

  const mirrorDrift = [];
  const corePromptDirectory = path.join(root, 'tutor-core', 'prompts');
  for (const file of activeFiles) {
    const localPath = path.join(promptDirectory, file);
    const corePath = path.join(corePromptDirectory, file);
    if (!fs.existsSync(localPath) || !fs.existsSync(corePath)) continue;
    const localHash = sha256(fs.readFileSync(localPath, 'utf8'));
    const coreHash = sha256(fs.readFileSync(corePath, 'utf8'));
    if (localHash !== coreHash) mirrorDrift.push({ file, localHash, coreHash });
  }

  const cellCounts = Object.fromEntries(
    ['protective', 'problematic', 'mixed', 'gray', 'no_evidence'].map((status) => [status, 0]),
  );
  for (const prompt of promptResults) {
    for (const status of Object.values(prompt.scores)) cellCounts[status] += 1;
  }

  return {
    schema_version: ledger.schema_version,
    framework: ledger.framework,
    valid: errors.length === 0,
    errors,
    dimensions,
    inventory: {
      active_count: activeFiles.length,
      active_files: activeFiles,
      excluded: ledger.inventory?.excluded_prompt_files ?? [],
      mirror_drift: mirrorDrift,
    },
    summary: {
      prompt_count: promptResults.length,
      dimension_cell_count: promptResults.length * dimensionIds.length,
      ...cellCounts,
    },
    prompts: promptResults,
    comparisons,
    conclusions: ledger.conclusions ?? [],
    proposed_changes: ledger.proposed_changes ?? [],
  };
}

function tableEscape(value) {
  return String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
}

export function renderTutorPromptAgencyAuditMarkdown(result) {
  const dimensionNames = new Map(result.dimensions.map((dimension) => [dimension.id, dimension.name]));
  const icon = {
    protective: '+',
    problematic: '-',
    mixed: '+/-',
    gray: '?',
    no_evidence: '0',
  };
  const lines = [
    '# Tutor prompt user-agency and control audit',
    '',
    `Frozen framework: ${result.framework.name} (${result.framework.source})`,
    '',
    '> This is a deterministic, prompt-level screening audit, not evidence about tutor behaviour or learner outcomes. A zero means no in-scope prompt evidence, not proof that the deployed system lacks the safeguard.',
    '',
    '## Scope and method',
    '',
    `The inventory is derived from the two active tutor profile registries plus the direct reflection prompt. It covers **${result.summary.prompt_count} active prompt files** and **${result.summary.dimension_cell_count} prompt-by-dimension cells**. Prompt SHA-256 hashes and quoted evidence spans are checked on every run. No model calls are made.`,
    '',
    `Scale: \`+\` protective instruction; \`-\` problematic instruction; \`?\` gray/contestable instruction; \`0\` no in-scope evidence. Missing dimensions in the ledger are deliberately materialized as \`0\`.`,
    '',
    '| Dimension | Frozen question |',
    '|---|---|',
    ...result.dimensions.map((dimension) => `| ${dimension.id} ${tableEscape(dimension.name)} | ${tableEscape(dimension.question)} |`),
    '',
    '## Results',
    '',
    `Across all cells: **${result.summary.protective} protective**, **${result.summary.problematic} problematic**, **${result.summary.mixed} mixed**, **${result.summary.gray} gray**, and **${result.summary.no_evidence} no-evidence** ratings.`,
    '',
    `| Prompt | ${result.dimensions.map((dimension) => dimension.id).join(' | ')} |`,
    `|---|${result.dimensions.map(() => '---:').join('|')}|`,
    ...result.prompts.map((prompt) => `| \`${prompt.file}\` | ${result.dimensions.map((dimension) => icon[prompt.scores[dimension.id]]).join(' | ')} |`),
    '',
    '## Recognition/placebo parity',
    '',
  ];

  for (const comparison of result.comparisons) {
    lines.push(
      `### ${comparison.title}`,
      '',
      comparison.conclusion,
      '',
      '| Dimension | Recognition | Placebo | Same category? |',
      '|---|---:|---:|---:|',
      ...comparison.dimensions.map((entry) => `| ${entry.dimension} ${dimensionNames.get(entry.dimension)} | ${icon[entry.left]} | ${icon[entry.right]} | ${entry.parity ? 'yes' : 'no'} |`),
      '',
    );
  }

  lines.push('## Evidence-bearing findings', '');
  for (const prompt of result.prompts) {
    if (prompt.findings.length === 0) continue;
    lines.push(`### \`${prompt.file}\``, '');
    if (prompt.audit_note) lines.push(prompt.audit_note, '');
    for (const finding of prompt.findings) {
      lines.push(
        `- **${finding.dimension} ${finding.status}:** “${finding.snippet}” — ${finding.rationale}`,
      );
    }
    lines.push('');
  }

  lines.push('## Gaps, discrepancies, and exclusions', '');
  for (const conclusion of result.conclusions) lines.push(`- ${conclusion}`);
  for (const exclusion of result.inventory.excluded) {
    lines.push(`- Excluded \`${exclusion.file}\`: ${exclusion.reason}`);
  }
  for (const drift of result.inventory.mirror_drift) {
    lines.push(`- Local/core mirror drift: \`${drift.file}\` differs between \`prompts/\` and \`tutor-core/prompts/\`. The eval-local copy was scored because local-first loading makes it authoritative for this repository.`);
  }

  lines.push('', '## Prospective decisions', '');
  if (result.proposed_changes.length === 0) {
    lines.push('No prompt changes are proposed by this audit.');
  } else {
    for (const change of result.proposed_changes) lines.push(`- ${change}`);
  }
  lines.push(
    '',
    'Any prompt change must be a separately approved prospective intervention with new prompt versions. Historical prompts and their prior evaluation provenance must not be rewritten.',
    '',
    '## Reproduce',
    '',
    '```bash',
    'npm run audit:tutor-prompt-agency',
    'npm run audit:tutor-prompt-agency:report',
    'node --test tests/tutorPromptAgencyAudit.test.js',
    '```',
  );
  return lines.join('\n');
}

function parseArgs(argv) {
  const options = { json: false, output: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') options.json = true;
    else if (arg === '--write-report') options.output = DEFAULT_REPORT;
    else if (arg === '--output') options.output = path.resolve(argv[++index]);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

export function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const result = buildTutorPromptAgencyAudit();
  if (!result.valid) {
    for (const error of result.errors) console.error(`audit:tutor-prompt-agency: ${error}`);
    process.exitCode = 1;
    return result;
  }
  const output = options.json
    ? `${JSON.stringify(result, null, 2)}\n`
    : `${renderTutorPromptAgencyAuditMarkdown(result)}\n`;
  if (options.output) {
    fs.writeFileSync(options.output, output);
    console.log(`audit:tutor-prompt-agency: wrote ${path.relative(REPO_ROOT, options.output)}`);
  } else {
    process.stdout.write(output);
  }
  return result;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
