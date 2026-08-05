#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import {
  committeeMiniGenerate,
  extractCommitteeSpanV1,
  extractCuePreservingCommitteeSpanV2,
} from '../services/program2CommitteeEngine.js';
import { tutorStubPointOfActionTargetText } from '../services/tutorStubPointOfActionCoaching.js';
import { WEIGHTS_INTERFACE_RETEST_SPEC } from './run-program2-live-pilot.js';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function git(args) {
  const result = spawnSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr.trim() || `git ${args.join(' ')} failed`);
  return result.stdout.trim();
}

function sourceSnapshot(expectedSha) {
  const head = git(['rev-parse', 'HEAD']);
  const status = git(['status', '--porcelain']);
  if (expectedSha) {
    if (!/^[0-9a-f]{40}$/u.test(expectedSha)) throw new Error('--expected-sha requires a 40-character SHA');
    if (head !== expectedSha) throw new Error(`SHA mismatch: expected ${expectedSha}, checkout is ${head}`);
    if (status) throw new Error('--expected-sha local smoke requires a clean checkout');
  }
  const diff = spawnSync('git', ['diff', '--binary', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' });
  if (diff.status !== 0) throw new Error(diff.stderr.trim() || 'git diff failed');
  return {
    head,
    clean: !status,
    dirtyPathCount: status ? status.split('\n').filter(Boolean).length : 0,
    diffSha256: sha256(diff.stdout),
    launchEligible: Boolean(expectedSha) && !status,
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      'expected-sha': { type: 'string', default: '' },
      out: { type: 'string', default: 'exports/program2-weights-interface-retest-local-smoke/smoke.json' },
    },
  });
  const source = sourceSnapshot(values['expected-sha']);
  const systemPrompt =
    'You are the speaking tutor in a public-evidence detective lesson. Ask a bounded question and do not reveal a new clue.';
  const messages = [
    {
      role: 'user',
      content: [
        'Public record: the coins share a notched serif, and the guild says a sprung-heel burin makes that notch.',
        'Learner: So the die points away from Verrell, but I have skipped the step that connects the mark to the tool.',
        tutorStubPointOfActionTargetText('warrant_skip'),
      ].join('\n\n'),
    },
  ];
  const rows = [];
  for (const [weight, model] of Object.entries(WEIGHTS_INTERFACE_RETEST_SPEC.weights)) {
    const result = await committeeMiniGenerate({ model, systemPrompt, messages, temperature: 0 });
    const raw = String(result.text || '').trim();
    for (const spanInterface of WEIGHTS_INTERFACE_RETEST_SPEC.interfaces) {
      const extraction =
        spanInterface === 'v2' ? extractCuePreservingCommitteeSpanV2(raw) : extractCommitteeSpanV1(raw);
      rows.push({
        weight,
        model,
        spanInterface,
        raw,
        rawSha256: sha256(raw),
        latencyMs: result.latencyMs,
        extraction,
        pass:
          raw.length > 0 &&
          (extraction.status === 'no_span' ||
            (extraction.status === 'ok' &&
              extraction.span &&
              raw.replace(/\s+/gu, ' ').includes(extraction.span.replace(/\s+/gu, ' ')))),
      });
    }
  }
  const artifact = {
    schema: 'machinespirits.program2.weights-interface-retest-local-smoke.v1',
    generatedAt: new Date().toISOString(),
    excludedFromEndpoints: true,
    source,
    settings: { temperature: 0, numCtx: 16384, maxTokens: 4096, think: false },
    promptSha256: sha256(JSON.stringify({ systemPrompt, messages })),
    status: rows.every((row) => row.pass) ? 'pass' : 'fail',
    rows,
  };
  const out = path.resolve(REPO_ROOT, values.out);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(`[weights-interface-retest-local-smoke] ${artifact.status}: ${rows.length}/${rows.length} surfaces`);
  console.log(
    `[weights-interface-retest-local-smoke] source ${source.clean ? 'clean' : 'dirty'}; launch eligible ${source.launchEligible}`,
  );
  console.log(`[weights-interface-retest-local-smoke] wrote ${out}`);
  if (artifact.status !== 'pass') process.exitCode = 1;
}

if (path.resolve(process.argv[1] || '') === SCRIPT_PATH) {
  try {
    await main();
  } catch (error) {
    console.error(`[weights-interface-retest-local-smoke] ${error.stack || error.message}`);
    process.exit(1);
  }
}
