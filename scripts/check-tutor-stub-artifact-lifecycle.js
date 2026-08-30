#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const REQUIRED_ARCHIVE_BUILDERS = Object.freeze([
  'scripts/prepare-learner-profile-world-deconfound.js',
  'scripts/run-contract-outcome-pilot.js',
  'scripts/run-figure-clean-test.js',
  'scripts/run-guard-findings-feed-forward.js',
  'scripts/run-program2-live-pilot.js',
  'scripts/run-step4-point-of-action-gate.js',
  'scripts/run-tutor-stub-boredom-action-register-proof-dag.js',
  'scripts/run-tutor-stub-resistance-action-register-crossed.js',
  'scripts/run-tutor-stub-resistance-action-register-confirmation.js',
  'scripts/run-tutor-stub-resistance-action-register-manipulation-validation.js',
  'scripts/run-tutor-stub-resistance-warm-nonwarm-confirmation.js',
  'scripts/run-tutor-stub-defiant-warrant-pilot.js',
  'scripts/run-tutor-stub-resistant-learner-calibration.js',
  'scripts/run-tutor-stub-abm-panel.js',
  'scripts/run-tutor-stub-auto-eval.js',
  'services/tutorStubLatencyBenchmark.js',
  'services/tutorStubShowcase.js',
]);

export const DIRECT_CALLER_EXEMPTIONS = Object.freeze({
  'scripts/tutor-stub-surface-ci-policy.js': 'source-path inventory only; it never launches tutor-stub',
  'scripts/run-adaptive-warrant-baseline-study.js':
    'source-provenance inventory only; it launches run-tutor-stub-auto-eval.js, where required archival is enforced',
  'scripts/run-adaptive-warrant-outcome-pilot.js':
    'zero-call prompt preflight renders tutor-stub argument lists only; empirical dialogues launch run-tutor-stub-auto-eval.js, where required archival is enforced',
  'scripts/run-tutor-stub-latency-benchmark.js':
    'launches commands built by services/tutorStubLatencyBenchmark.js, where required archival is enforced',
  'scripts/run-tutor-stub-qa-matrix.js': 'launches run-tutor-stub-auto-eval.js, where required archival is enforced',
  'scripts/tutor-stub-remote.js': 'launches the web server; product sessions are interactive and opt in separately',
  'services/tutorStubProcessSessionFactory.js':
    'interactive web session infrastructure; product sessions remain opt-in',
});

function sourceFiles(directory) {
  const found = [];
  const stack = [directory];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(absolute);
      else if (/\.(?:js|mjs)$/u.test(entry.name)) found.push(absolute);
    }
  }
  return found;
}

export function discoverTutorStubDirectCallerCandidates(root = ROOT) {
  const candidates = [];
  for (const area of ['scripts', 'services']) {
    for (const absolute of sourceFiles(path.join(root, area))) {
      if (absolute === fileURLToPath(import.meta.url)) continue;
      const source = fs.readFileSync(absolute, 'utf8');
      if (!source.includes('tutor-stub.js')) continue;
      if (!/\b(?:spawn|spawnSync|execFile|execFileSync)\b/u.test(source)) continue;
      candidates.push(path.relative(root, absolute).split(path.sep).join('/'));
    }
  }
  return candidates.sort();
}

export function auditTutorStubArtifactLifecycle(root = ROOT) {
  const errors = [];
  const required = new Set(REQUIRED_ARCHIVE_BUILDERS);
  const exempt = new Set(Object.keys(DIRECT_CALLER_EXEMPTIONS));
  const candidates = discoverTutorStubDirectCallerCandidates(root);

  for (const relative of REQUIRED_ARCHIVE_BUILDERS) {
    const absolute = path.join(root, relative);
    if (!fs.existsSync(absolute)) {
      errors.push(`${relative}: registered required builder is missing`);
      continue;
    }
    const source = fs.readFileSync(absolute, 'utf8');
    if (!/\.\.\.requiredTutorStubArtifactArchiveArgs\(\)/u.test(source)) {
      errors.push(`${relative}: empirical builder does not request required tutor-stub artifact archival`);
    }
  }

  for (const relative of candidates) {
    if (!required.has(relative) && !exempt.has(relative)) {
      errors.push(`${relative}: direct tutor-stub caller is not classified as required or exempt`);
    }
  }
  for (const relative of exempt) {
    if (!candidates.includes(relative)) {
      errors.push(`${relative}: stale direct-caller exemption`);
    }
  }

  return { ok: errors.length === 0, candidates, errors };
}

function main() {
  const result = auditTutorStubArtifactLifecycle(ROOT);
  if (!result.ok) {
    console.error('tutor-stub artifact lifecycle audit failed:');
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `tutor-stub artifact lifecycle: ${REQUIRED_ARCHIVE_BUILDERS.length} required builders; ${result.candidates.length} direct callers classified`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main();
