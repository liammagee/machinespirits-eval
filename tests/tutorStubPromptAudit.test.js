import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  auditTutorStubPrompt,
  auditTutorStubSpeakerPrivilege,
  recoverTutorStubDuplicateInstructionLines,
} from '../services/tutorStubPromptAudit.js';
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

test('exact duplicate-only prompt rows can be compacted and re-audited safely', () => {
  const repeated =
    '- A learner-derived bookkeeping row is repeated across two internal summaries before the speaking tutor is called.';
  const original = auditTutorStubPrompt({
    surface: 'tutor_turn',
    systemPrompt: 'Keep the response grounded in the public exchange.',
    userPrompt: `Open reasoning obligations:\n${repeated}\nMissing warrants:\n${repeated}`,
    instructionTexts: [`Open reasoning obligations:\n${repeated}\nMissing warrants:\n${repeated}`],
  });
  assert.equal(original.ok, false);

  const actual = recoverTutorStubDuplicateInstructionLines({
    texts: ['Keep the response grounded in the public exchange.', `Open reasoning obligations:\n${repeated}\nMissing warrants:\n${repeated}`],
    duplicateInstructionLines: original.duplicateInstructionLines,
  });
  const instructions = recoverTutorStubDuplicateInstructionLines({
    texts: [`Open reasoning obligations:\n${repeated}\nMissing warrants:\n${repeated}`],
    duplicateInstructionLines: original.duplicateInstructionLines,
  });
  const recovered = auditTutorStubPrompt({
    surface: 'tutor_turn',
    systemPrompt: actual.texts[0],
    userPrompt: actual.texts[1],
    instructionTexts: instructions.texts,
  });

  assert.equal(actual.applied, true);
  assert.equal(instructions.applied, true);
  assert.equal(actual.removedLines.length, 1);
  assert.equal(recovered.ok, true);
  assert.equal(actual.texts.join('\n').split(repeated).length - 1, 1);
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

test('learner-grounded clues and overreach bookkeeping each appear once in tutor instruction prompts', () => {
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
    response = input.includes('Write learner turn 3')
      ? "means there's more than one culprit. But what is the kettle queue?"
      : input.includes('Write learner turn 2')
        ? 'The badge log puts Dario in the kitchen at noon, so I will keep that clue in the record.'
        : 'Can we start with the badge log?';
  } else if (input.includes('# Learner-record extraction rules')) {
    const overreach = input.includes("means there's more than one culprit. But what is the kettle queue?");
    const badgeIsPublic = input.includes('- p_noon (staged turn');
    response = JSON.stringify({
      classification: {
        turn: {
          summary: overreach
            ? 'Learner overreads the second badge while asking what the kettle queue means.'
            : badgeIsPublic
              ? 'Learner adopts the public badge entry.'
              : 'Learner asks to see the badge entry.',
          request_type: overreach ? 'off_task_or_mixed' : 'stepwise_support_request',
          discourse_move: overreach ? 'question' : badgeIsPublic ? 'evidence_adoption' : 'question',
          evidence_use: overreach ? 'overleaps_evidence' : badgeIsPublic ? 'cites_public_evidence' : 'none',
          epistemic_stance: badgeIsPublic ? 'grounded' : 'exploratory',
          affect: 'neutral',
          agency: 'attempting',
          scores: {
            conceptual_engagement: { score: 3, reason: 'Uses the live record.' },
            epistemic_readiness: { score: 3, reason: 'Keeps claims evidence-bound.' }
          },
          pedagogical_need: overreach ? 'Clarify the phrase and distinguish entry from guilt.' : 'Continue with the next public clue.'
        },
        overall: {
          summary: 'Learner is working from public evidence.',
          trajectory: 'evidence-oriented',
          recurring_pattern: 'none',
          current_state: 'tracking the badge record',
          next_best_tutor_move: 'Introduce the next public clue.'
        }
      },
      learner_record: overreach
        ? {
            adopt: ['p_noon', 'p_crew'],
            hypothesis: 'There is more than one culprit.',
            human_discourse: {
              proof_status: 'provisional_scaffold',
              provisional_claims: ['There is more than one culprit.'],
              missing_warrants: ['Two kitchen entries do not establish taking or multiple culprits.'],
              side_arc: 'Asks what “the kettle queue” means.'
            }
          }
        : badgeIsPublic ? { adopt: ['p_noon'] } : {}
    });
  } else if (input.includes("means there's more than one culprit. But what is the kettle queue?")) {
    response = 'You are right that two badge entries do not prove two culprits. “The kettle queue” means the people waiting beside the kettle, who remember seeing the crew. What do the two entries establish, and what remains unproved?';
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
        '3',
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
        timeout: 20_000,
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
    const thirdTutorCall = events.find(
      (event) => event.type === 'model_call' && event.role === 'tutor_stub_tutor' && event.turn === 3,
    );
    assert.ok(thirdTutorCall, 'expected a completed third tutor call after the overreach classification');
    assert.equal(thirdTutorCall.request.config.promptAudit.ok, true);
    const thirdTutorPrompt = thirdTutorCall.request.messages.at(-1)?.content || '';
    const heuristicLine =
      "- means there's more than one culprit. But what is the kettle queue? — classifier marked overreach or answer-seeking before an explicit public warrant was stored";
    assert.equal(thirdTutorPrompt.split(heuristicLine).length - 1, 1);
    assert.equal(thirdTutorPrompt.split('Two kitchen entries do not establish taking or multiple culprits.').length - 1, 1);
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
  assert.match(dryRun.systemPrompt, /adaptive scene actor/u);
  assert.match(dryRun.systemPrompt, /A part never grants knowledge/u);
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
