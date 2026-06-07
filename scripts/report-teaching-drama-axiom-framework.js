#!/usr/bin/env node
/**
 * A19 deterministic framework reporter.
 *
 * Reads the A19 protocol fixtures, validates them, and emits a claim-disciplined
 * Markdown or JSON report. No API calls are made.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validateTeachingDramaAxiomProtocol } from './validate-teaching-drama-axiom-protocol.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const DEFAULT_PROTOCOL = path.join(ROOT, 'config', 'teaching-drama-axioms', 'a19-protocol.yaml');
const DEFAULT_CONFIG = path.join(ROOT, 'config', 'teaching-drama-axioms', 'pilot-families.yaml');

function usage() {
  return `Usage:
  node scripts/report-teaching-drama-axiom-framework.js
    [--protocol config/teaching-drama-axioms/a19-protocol.yaml]
    [--config config/teaching-drama-axioms/pilot-families.yaml]
    [--out exports/a19/reports/framework.md]
    [--json]

This is zero-API and report-only.`;
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    protocol: DEFAULT_PROTOCOL,
    config: DEFAULT_CONFIG,
    out: null,
    json: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') args.help = true;
    else if (token === '--protocol') args.protocol = path.resolve(argv[++i]);
    else if (token === '--config') args.config = path.resolve(argv[++i]);
    else if (token === '--out') args.out = path.resolve(argv[++i]);
    else if (token === '--json') args.json = true;
    else throw new Error(`unknown arg: ${token}\n\n${usage()}`);
  }
  return args;
}

function denominatorSummary(cards) {
  const total = cards.length;
  const protocolReject = cards.filter((card) => card.verdict === 'protocol_reject').length;
  const artifact = cards.filter((card) => ['cue_leak', 'arbiter_disagreement'].includes(card.verdict)).length;
  const admitted = total - protocolReject - artifact;
  const policyHeadroom = cards.filter((card) => card.verdict === 'policy_headroom').length;
  return {
    total_cards: total,
    admitted_cards: admitted,
    protocol_reject_cards: protocolReject,
    artifact_cards: artifact,
    policy_headroom_cards: policyHeadroom,
  };
}

function renderMarkdown(report) {
  const denom = denominatorSummary(report.cards);
  const lines = [];
  lines.push('# A19 Teaching-Drama Axiom Framework Report', '');
  lines.push('Status: deterministic scaffold; zero API calls.', '');
  lines.push('## Provenance', '');
  lines.push(`- Protocol: \`${report.provenance.protocol_path}\``);
  lines.push(`- Protocol SHA-256: \`${report.provenance.protocol_sha256}\``);
  lines.push(`- Fixtures: \`${report.provenance.config_path}\``);
  lines.push(`- Fixtures SHA-256: \`${report.provenance.config_sha256}\``);
  lines.push(`- Validator: \`${report.provenance.validator}\``);
  lines.push('');
  lines.push('## Validation Summary', '');
  lines.push(`- Status: \`${report.status}\``);
  lines.push(`- Families: ${report.summary.families}`);
  lines.push(`- Cards: ${report.summary.cards}`);
  lines.push(`- Errors: ${report.summary.errors}`);
  lines.push(`- Warnings: ${report.summary.warnings}`);
  lines.push('');
  lines.push('## Denominators', '');
  lines.push('| denominator | count |');
  lines.push('| --- | ---: |');
  for (const [key, value] of Object.entries(denom)) lines.push(`| ${key} | ${value} |`);
  lines.push('');
  lines.push('No pooled success rate is reported here. Card-level verdicts and basis labels are the evidence unit.');
  lines.push('');
  lines.push('## Verdict Counts', '');
  lines.push('| verdict | count |');
  lines.push('| --- | ---: |');
  for (const [verdict, count] of Object.entries(report.summary.verdict_counts)) lines.push(`| ${verdict} | ${count} |`);
  lines.push('');
  lines.push('## Card Verdicts', '');
  lines.push('| family | sibling | verdict |');
  lines.push('| --- | --- | --- |');
  for (const card of report.cards) lines.push(`| ${card.family_id} | ${card.sibling_id} | ${card.verdict} |`);
  lines.push('');
  lines.push('## Issues', '');
  if (!report.issues.length) {
    lines.push('No validation issues.');
  } else {
    for (const issue of report.issues) lines.push(`- [${issue.severity}] ${issue.path}: ${issue.message}`);
  }
  lines.push('');
  lines.push('## Claims Not Licensed', '');
  for (const claim of report.non_claims) lines.push(`- ${claim}`);
  lines.push('- broad curricular transfer');
  lines.push('- a general adaptive-slope effect');
  lines.push('- a sidecar-paper claim that has not first landed in `paper-full-2.0.md`');
  lines.push('');
  lines.push('## Next Gates', '');
  lines.push('1. Freeze any protocol change as a new version before generation.');
  lines.push('2. Elicit attempt-1 failures only after fixture validation passes.');
  lines.push('3. Run S0/S1 held-out contrasts only with alias withholding and mechanical post-hoc mapping.');
  lines.push('4. Add blind adjudication and human double-coding before strong claims.');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function main() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const report = validateTeachingDramaAxiomProtocol({
    protocolPath: args.protocol,
    configPath: args.config,
  });
  const output = args.json
    ? `${JSON.stringify({ ...report, denominators: denominatorSummary(report.cards) }, null, 2)}\n`
    : renderMarkdown(report);
  if (args.out) {
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, output, 'utf8');
  } else {
    process.stdout.write(output);
  }
  if (report.status !== 'pass') process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

export { denominatorSummary, renderMarkdown };
