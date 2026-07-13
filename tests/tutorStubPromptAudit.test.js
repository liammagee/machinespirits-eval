import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
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
