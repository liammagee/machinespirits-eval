#!/usr/bin/env node

// Fixture gate for the sarcastic_determinate register + negation-recovery
// measure. Deterministic checks run free; `--judge <model>` additionally
// validates the judge path (a handful of sonnet-class calls) and must agree
// with every expected verdict before the judge path may score a paid run.
//
//   node scripts/run-sarcasm-determinate-exemplar-test.js
//   node scripts/run-sarcasm-determinate-exemplar-test.js --judge claude-code.sonnet-5

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import yaml from 'yaml';

import { evaluateRegisterStanceFidelity } from '../services/registerStanceFidelity.js';
import {
  evaluateNegationRecoveryDeterministic,
  buildNegationRecoveryJudgePrompt,
  parseNegationRecoveryJudgeReply,
} from '../services/negationRecovery.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = path.join(ROOT, 'config/register-exemplars/sarcasm-determinate-negation.yaml');

async function callJudge(judgeToken, prompt) {
  const { default: evalConfigLoader } = await import('../services/evalConfigLoader.js');
  const resolved = evalConfigLoader.resolveModel(judgeToken);
  if (resolved.provider !== 'claude-code') {
    throw new Error(`judge validation supports claude-code tokens only, got ${judgeToken}`);
  }
  const { callClaudeCodeJudge } = await import('../services/rubricEvaluator.js');
  return callClaudeCodeJudge(prompt, { model: resolved.model });
}

async function main() {
  const { values } = parseArgs({ options: { judge: { type: 'string', default: '' } } });
  const fixture = yaml.parse(fs.readFileSync(FIXTURE, 'utf8'));
  const registerName = fixture.register;
  const failures = [];
  const lines = [];

  for (const exemplar of fixture.exemplars) {
    const stance = evaluateRegisterStanceFidelity({
      registerName,
      tutorMessage: exemplar.tutor_message,
      learnerMessage: exemplar.learner_message,
      postLearnerMessage: exemplar.post_learner_message,
    });
    const stanceOk = stance.label === exemplar.expected.stance_fidelity;
    if (!stanceOk) {
      failures.push(
        `${exemplar.id}: stance label ${stance.label} (score ${stance.score}, missing ${stance.missing.join('|') || 'none'}) expected ${exemplar.expected.stance_fidelity}`,
      );
    }

    let recoveryNote = 'skipped_no_authored_correction';
    if (exemplar.corrected_claim) {
      const recovery = evaluateNegationRecoveryDeterministic({
        correctedClaim: exemplar.corrected_claim,
        postLearnerMessage: exemplar.post_learner_message,
      });
      const recoveryOk = recovery.recovered === Boolean(exemplar.expected.negation_recovery);
      recoveryNote = `deterministic ${recovery.recovered} (overlap ${recovery.overlap})`;
      if (!recoveryOk) {
        failures.push(
          `${exemplar.id}: deterministic recovery ${recovery.recovered} (overlap ${recovery.overlap}) expected ${exemplar.expected.negation_recovery}`,
        );
      }
    }

    lines.push(`${stanceOk ? 'ok  ' : 'FAIL'} ${exemplar.id}: label ${stance.label}; recovery ${recoveryNote}`);
  }

  if (values.judge) {
    for (const exemplar of fixture.exemplars) {
      const prompt = buildNegationRecoveryJudgePrompt({
        tutorMessage: exemplar.tutor_message,
        postLearnerMessage: exemplar.post_learner_message,
      });
      const reply = parseNegationRecoveryJudgeReply(await callJudge(values.judge, prompt));
      if (reply.parseError) {
        failures.push(`${exemplar.id}: judge reply unparseable (${reply.parseError})`);
        lines.push(`FAIL ${exemplar.id}: judge parse error`);
        continue;
      }
      const judgeOk = reply.recovered === Boolean(exemplar.expected.negation_recovery);
      if (!judgeOk) {
        failures.push(
          `${exemplar.id}: judge recovery ${reply.recovered} expected ${exemplar.expected.negation_recovery} (evidence: ${reply.voicedEvidence || 'none'})`,
        );
      }
      lines.push(
        `${judgeOk ? 'ok  ' : 'FAIL'} ${exemplar.id}: judge named=${reply.namedTargetClaim} recovered=${reply.recovered}`,
      );
    }
  }

  console.log(lines.join('\n'));
  console.log(
    `\n${fixture.exemplars.length} exemplars; ${failures.length} failure(s)${values.judge ? ' (judge pass included)' : ' (deterministic only)'}`,
  );
  if (failures.length) {
    console.error(failures.map((f) => `  - ${f}`).join('\n'));
    process.exit(1);
  }
}

await main();
