import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { auditTutorStubPrompt, auditTutorStubSpeakerPrivilege } from '../services/tutorStubPromptAudit.js';
import {
  learnerProfileContractSummary,
  learnerProfileIds,
  learnerProfilePrompt,
} from '../scripts/tutor-stub-learner-profile-contracts.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LARKSPUR_BADGE_SURFACE =
  'The badge log has Dario in the kitchen at 12:02 — mug in hand, by his own cheerful admission, and not one bit sorry about the last two times.';

test('prompt audit rejects oversized and duplicated instruction surfaces', () => {
  const repeated = 'Keep this deliberately long instruction exactly once so competing prompt rules remain visible.';
  const audit = auditTutorStubPrompt({
    surface: 'default',
    systemPrompt: `${repeated}\n${repeated}`,
    budget: { maxChars: 40, maxApproxTokens: 10 },
  });

  assert.equal(audit.ok, false);
  assert.deepEqual(
    new Set(audit.violations.map((violation) => violation.code)),
    new Set(['character_budget_exceeded', 'approximate_token_budget_exceeded', 'duplicate_instruction_lines']),
  );
});

test('speaker privilege audit rejects planner-only answer and future evidence', () => {
  const world = {
    secret: { fact: ['owns', 'answer'], surface: 'The concealed answer belongs to Ada' },
    mirror: { fact: ['owns', 'mirror'] },
    rules: [{ id: 'R_private' }],
    premises: [{ id: 'p_future', fact: ['found', 'future'], surface: 'A future sealed letter names Ada' }],
    releaseSchedule: [{ turn: 3, premise: 'p_future' }],
  };
  const audit = auditTutorStubSpeakerPrivilege({
    world,
    tutorTurn: 1,
    systemPrompt: 'The concealed answer belongs to Ada.',
    privateAdvisory: 'A future sealed letter names Ada.',
  });

  assert.equal(audit.ok, false);
  assert.ok(audit.issues.some((issue) => issue.code === 'concealed_answer_surface'));
  assert.ok(audit.issues.some((issue) => issue.code === 'future_evidence_surface'));
});

test('a learner-grounded released clue appears once in the next tutor instruction prompt', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-grounded-prompt-'));
  try {
    const fakeCodex = path.join(tmp, 'codex');
    fs.writeFileSync(
      fakeCodex,
      `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const outputIndex = args.indexOf('-o');
const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : null;
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  let response;
  if (input.includes('You are an automated learner in an experimental tutoring dialogue.')) {
    response = input.includes('Write learner turn 2')
      ? 'The badge log puts Dario in the kitchen at noon, so I will keep that clue in the record.'
      : 'Can we start with the badge log?';
  } else if (input.includes('# Learner-record extraction rules')) {
    const badgeIsPublic = input.includes('- p_noon (staged turn');
    response = JSON.stringify({
      classification: {
        turn: {
          summary: badgeIsPublic ? 'Learner adopts the public badge entry.' : 'Learner asks to see the badge entry.',
          request_type: 'stepwise_support_request',
          discourse_move: badgeIsPublic ? 'evidence_adoption' : 'question',
          evidence_use: badgeIsPublic ? 'cites_public_evidence' : 'none',
          epistemic_stance: badgeIsPublic ? 'grounded' : 'exploratory',
          affect: 'neutral',
          agency: 'attempting',
          scores: {
            conceptual_engagement: { score: 3, reason: 'Uses the live record.' },
            epistemic_readiness: { score: 3, reason: 'Keeps claims evidence-bound.' }
          },
          pedagogical_need: 'Continue with the next public clue.'
        },
        overall: {
          summary: 'Learner is working from public evidence.',
          trajectory: 'evidence-oriented',
          recurring_pattern: 'none',
          current_state: 'tracking the badge record',
          next_best_tutor_move: 'Introduce the next public clue.'
        }
      },
      learner_record: badgeIsPublic ? { adopt: ['p_noon'] } : {}
    });
  } else if (input.includes(${JSON.stringify(LARKSPUR_BADGE_SURFACE)})) {
    response = ${JSON.stringify(
      `I'm going to give you another piece of information. Let's role-play it: I'll be the badge clerk reading the log. “${LARKSPUR_BADGE_SURFACE}” Back to the case: what does this badge entry change?`,
    )};
  } else {
    response = 'Good—keep that badge entry in the record while we examine the next public clue.';
  }
  if (outputPath) fs.writeFileSync(outputPath, response);
  process.stdout.write(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: response } }) + '\\n');
});
`,
      'utf8',
    );
    fs.chmodSync(fakeCodex, 0o755);

    const result = spawnSync(
      process.execPath,
      [
        'scripts/tutor-stub.js',
        '--world',
        'world_028_larkspur_fridge',
        '--dag',
        '--tutor-learner-dag',
        '--auto-learner',
        '--auto-turns',
        '2',
        '--dag-mode',
        'defeasible_human_scaffold',
        '--no-register-selection',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--trace-dir',
        tmp,
      ],
      {
        cwd: ROOT,
        encoding: 'utf8',
        timeout: 15_000,
        env: {
          ...process.env,
          PATH: `${tmp}${path.delimiter}${process.env.PATH || ''}`,
          CLI_PROVIDER_CODEX_TIMEOUT_MS: '5000',
          TUTOR_STUB_SUMMARY_OPEN: '0',
        },
      },
    );

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const events = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    assert.equal(events.some((event) => event.type === 'prompt_audit_failed'), false);
    const secondTutorCall = events.find(
      (event) => event.type === 'model_call' && event.role === 'tutor_stub_tutor' && event.turn === 2,
    );
    assert.ok(secondTutorCall, 'expected a completed second tutor call');
    assert.equal(secondTutorCall.request.config.promptAudit.ok, true);
    const tutorInstructionPrompt = secondTutorCall.request.messages.at(-1)?.content || '';
    assert.equal(tutorInstructionPrompt.split(LARKSPUR_BADGE_SURFACE).length - 1, 1);
    assert.match(tutorInstructionPrompt, /\[learner-grounded\].*badge log has Dario/iu);
    assert.match(tutorInstructionPrompt, /1 released public evidence item currently learner-grounded/iu);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('DAG dry run keeps private proof planning out of the speaking tutor prompt', () => {
  const dryRun = JSON.parse(
    execFileSync(
      process.execPath,
      [
        'scripts/tutor-stub.js',
        '--dry-run',
        '--no-trace',
        '--world',
        'world_005_marrick',
        '--dag',
        '--tutor-learner-dag',
        '--dag-mode',
        'defeasible_human_scaffold',
      ],
      { cwd: ROOT, encoding: 'utf8' },
    ),
  );

  assert.equal(dryRun.promptArchitecture.planner.owner, 'deterministic_harness');
  assert.equal(dryRun.promptArchitecture.planner.modelCall, false);
  assert.equal(dryRun.promptArchitecture.audit.baseSystem.ok, true);
  assert.equal(dryRun.promptArchitecture.audit.baseSpeakerPrivilege.ok, true);
  assert.match(dryRun.systemPrompt, /Speaking-tutor evidence contract/u);
  assert.match(dryRun.systemPrompt, /A private deterministic planner owns the answer/u);
  assert.doesNotMatch(dryRun.systemPrompt, /The false shillings were struck by Edony/u);
  assert.doesNotMatch(dryRun.systemPrompt, /Concealed answer|Hidden premise ledger|Authored proof path/u);
  assert.doesNotMatch(dryRun.systemPrompt, /meltedAt\(|p_holder|R1_blank/u);
});

test('learner prompts contain behavior only while measurement targets stay external', () => {
  const measurementLanguage =
    /Target recurrence|Behavioral signature|Score bands|Coverage velocity|Minimum markers|Must first appear|mustRecurMinRate|traceSignatureTargets|dagSignatureTargets/iu;

  for (const id of learnerProfileIds()) {
    const prompt = learnerProfilePrompt(id);
    const summary = learnerProfileContractSummary(id);
    assert.match(prompt, /private behavior brief/u, id);
    assert.match(prompt, /Recurring behavior:/u, id);
    assert.doesNotMatch(prompt, measurementLanguage, id);
    assert.doesNotMatch(prompt, new RegExp(`\\b${id}\\b`, 'u'), id);
    assert.ok(summary.traceSignatureTargets, id);
    assert.ok(summary.dagSignatureTargets, id);
    assert.ok(Object.hasOwn(summary, 'observabilityContract'), id);
  }
});
