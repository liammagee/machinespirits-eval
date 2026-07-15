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
  recoverTutorStubSpeakerPrompt,
  sanitizeTutorStubSpeakerAdvisory,
} from '../services/tutorStubPromptAudit.js';
import { loadWorld } from '../services/dramaticDerivation/world.js';
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

test('speaker prompt recovery discards contaminated advisory and preserves the public turn contract', () => {
  const world = loadWorld(path.join(ROOT, 'config/drama-derivation/world-005-marrick.yaml'));
  const future = world.releaseSchedule.find((row) => row.turn > 1);
  const futureSurface = world.premiseById.get(future.premise).surface;
  const contaminated = auditTutorStubSpeakerPrivilege({
    world,
    tutorTurn: 1,
    systemPrompt: 'Respond only from the public exchange.',
    privateAdvisory: `A machine advisory accidentally included: ${futureSurface}`,
  });
  assert.equal(contaminated.ok, false);

  const recovered = recoverTutorStubSpeakerPrompt({
    world,
    tutorTurn: 1,
    baseSystemPrompt: 'Respond only from the public exchange.',
    continuityPrompt: 'Continue from the complete public dialogue.',
    publicEvidencePrompt: 'No public clue has yet established who handled the blanks.',
    responseCompositionPrompt: 'First answer the learner, then develop the inquiry.',
    responseConfigurationPrompt: 'Style: warm. Character: scene partner.',
    learnerPrompt: 'Learner says: I am not sure where to begin.',
  });

  assert.equal(recovered.applied, true);
  assert.equal(recovered.speakerPrivilegeAudit.ok, true);
  assert.equal(recovered.promptAudit.ok, true);
  assert.match(recovered.userPrompt, /I am not sure where to begin/u);
  assert.match(recovered.userPrompt, /Character: scene partner/u);
  assert.doesNotMatch(
    recovered.userPrompt,
    new RegExp(futureSurface.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u'),
  );
});

test('speaker prompt recovery remains fail-closed when a retained public surface is itself contaminated', () => {
  const world = loadWorld(path.join(ROOT, 'config/drama-derivation/world-005-marrick.yaml'));
  const future = world.releaseSchedule.find((row) => row.turn > 1);
  const futureSurface = world.premiseById.get(future.premise).surface;
  const recovered = recoverTutorStubSpeakerPrompt({
    world,
    tutorTurn: 1,
    baseSystemPrompt: 'Respond only from the public exchange.',
    publicEvidencePrompt: `Incorrectly labelled public evidence: ${futureSurface}`,
    learnerPrompt: 'Learner says: What is public so far?',
  });

  assert.equal(recovered.applied, false);
  assert.equal(recovered.speakerPrivilegeAudit.ok, false);
  assert.ok(recovered.speakerPrivilegeAudit.issues.some((issue) => issue.code === 'future_evidence_surface'));
});

test('speaker advisories neutralize private bookkeeping ids without admitting future evidence', () => {
  const world = loadWorld(path.join(ROOT, 'config/drama-derivation/world-005-marrick.yaml'));
  const sanitized = sanitizeTutorStubSpeakerAdvisory({
    world,
    text: 'Explain R1_blank one premise at a time, but do not treat p_holder as public.',
  });

  assert.doesNotMatch(sanitized, /R1_blank|p_holder/u);
  assert.match(sanitized, /relevant public evidence rule/u);
  assert.match(sanitized, /relevant public evidence item/u);

  const recovered = recoverTutorStubSpeakerPrompt({
    world,
    tutorTurn: 5,
    baseSystemPrompt: 'Speak only from the public scene and dialogue.',
    publicEvidencePrompt: 'Only the already-spoken assay and crucible claims are public.',
    responseCompositionPrompt: 'The learner asks for R1_blank to be unpacked slowly.',
    responseConfigurationPrompt: 'Apply R1_blank explicitly without naming p_holder.',
    learnerPrompt: 'Learner says: What would tie this metal to one crucible?',
  });

  assert.equal(recovered.applied, true);
  assert.equal(recovered.speakerPrivilegeAudit.ok, true);
  assert.doesNotMatch(recovered.userPrompt, /R1_blank|p_holder/u);
});

test('public-only speaker recovery passes every authored clue-release boundary', () => {
  const worldDir = path.join(ROOT, 'config/drama-derivation');
  const worldFiles = fs
    .readdirSync(worldDir)
    .filter((name) => /^world-.*\.yaml$/u.test(name))
    .sort();
  let checkedWindows = 0;
  let rejectedFutureSurfaces = 0;

  for (const file of worldFiles) {
    const world = loadWorld(path.join(worldDir, file));
    const lastReleaseTurn = Math.max(0, ...world.releaseSchedule.map((row) => row.turn));
    for (let tutorTurn = 0; tutorTurn <= lastReleaseTurn; tutorTurn += 1) {
      const releasedSurfaces = world.releaseSchedule
        .filter((row) => row.turn <= tutorTurn)
        .map((row) => world.premiseById.get(row.premise)?.surface)
        .filter(Boolean);
      const recovered = recoverTutorStubSpeakerPrompt({
        world,
        tutorTurn,
        baseSystemPrompt: 'Speak only from the public scene and dialogue.',
        publicEvidencePrompt: releasedSurfaces.length
          ? `Public evidence now available:\n${releasedSurfaces.map((surface) => `- ${surface}`).join('\n')}`
          : 'No contingent evidence is public yet.',
        responseCompositionPrompt: 'Respond to the learner before developing the inquiry.',
        responseConfigurationPrompt: 'Style: precise. Character: evidence examiner.',
        learnerPrompt: 'Learner says: What can the current evidence establish?',
      });
      assert.equal(
        recovered.applied,
        true,
        `${world.id} turn ${tutorTurn}: ${JSON.stringify({
          privilege: recovered.speakerPrivilegeAudit.issues,
          prompt: recovered.promptAudit.violations,
        })}`,
      );
      checkedWindows += 1;

      const next = world.releaseSchedule.find((row) => row.turn > tutorTurn);
      const nextSurface = next ? world.premiseById.get(next.premise)?.surface : null;
      if (!nextSurface) continue;
      const contaminated = auditTutorStubSpeakerPrivilege({
        world,
        tutorTurn,
        systemPrompt: recovered.systemPrompt,
        privateAdvisory: `${recovered.userPrompt}\n${nextSurface}`,
      });
      assert.equal(contaminated.ok, false, `${world.id} turn ${tutorTurn} should reject its next clue`);
      assert.ok(contaminated.issues.some((issue) => issue.code === 'future_evidence_surface'));
      rejectedFutureSurfaces += 1;
    }
  }

  assert.ok(checkedWindows > 100, `expected broad release-boundary coverage; got ${checkedWindows}`);
  assert.ok(rejectedFutureSurfaces > 50, `expected broad future-clue rejection; got ${rejectedFutureSurfaces}`);
});

test('a clue postponed by slower pacing stays out of the speaking-tutor prompt', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-postponed-clue-'));
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
    response = 'I have no idea. Slow down.';
  } else if (input.includes('Analyze the learner input once before the tutor responds.')) {
    response = JSON.stringify({
      classification: {
        turn: {
          summary: 'Learner is confused and explicitly asks for slower pacing.',
          request_type: 'stepwise_support_request',
          discourse_move: 'repair_request',
          evidence_use: 'none',
          epistemic_stance: 'confused',
          affect: 'overwhelmed',
          agency: 'attempting',
          scores: {
            conceptual_engagement: { score: 1, reason: 'No clue is available yet.' },
            epistemic_readiness: { score: 2, reason: 'Requests a slower first step.' }
          },
          pedagogical_need: 'Slow down and offer one concrete starting point.'
        },
        overall: {
          summary: 'Learner needs one step at a time.',
          trajectory: 'initial confusion',
          recurring_pattern: 'none',
          current_state: 'waiting for a concrete starting point',
          next_best_tutor_move: 'Acknowledge the confusion and orient without adding a clue.'
        }
      },
      learner_record: {
        human_discourse: { proof_status: 'side_arc' },
        notes: 'No public evidence was adopted.'
      }
    });
  } else {
    response = "That's all right—we'll slow down. Start with the empty incident log: what kind of check would feel concrete?";
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
        '1',
        '--dag-mode',
        'defeasible_human_scaffold',
        '--register-policy',
        'continuous_dynamical_system',
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
    const pacing = events.find((event) => event.type === 'release_pacing_update' && event.turn === 1);
    assert.ok(pacing, 'expected the first-turn pacing update');
    assert.equal(pacing.direction, 'decelerate');
    assert.deepEqual(pacing.releasePacing?.dueNow, []);
    const completed = events.find((event) => event.type === 'turn_complete' && event.turn === 1);
    assert.ok(completed, 'expected the slowed turn to complete');
    const selection = completed.turnRecord.registerSelection;
    assert.equal(selection.engagement_stance, 'warm');
    assert.equal(selection.source, 'learner_release_pacing_decelerate');
    assert.deepEqual(
      selection.engagement_stance_distribution.map((row) => [row.engagement_stance, row.probability]),
      [['warm', 1]],
    );
    assert.ok(selection.pre_override_engagement_stance_distribution?.length > 0);
    const characterStanceDrivers = selection.response_configuration.actorial_part_selection.drivers.filter(
      (driver) => driver.source.startsWith('stance:'),
    );
    assert.ok(characterStanceDrivers.length > 0);
    assert.ok(characterStanceDrivers.every((driver) => driver.source === 'stance:warm'));
    const speakerPrivilegeAudits = events.filter((event) => event.type === 'tutor_speaker_privilege_audit');
    assert.equal(
      speakerPrivilegeAudits.every((event) => event.audit?.ok === true),
      true,
      `postponed clue produced a failed speaking-boundary audit: ${JSON.stringify(speakerPrivilegeAudits)}`,
    );
    assert.equal(
      speakerPrivilegeAudits.some((event) =>
        event.audit?.issues?.some((issue) => issue.code === 'future_evidence_surface'),
      ),
      false,
      `postponed clue crossed the speaking boundary: ${JSON.stringify(speakerPrivilegeAudits)}`,
    );
    const tutorCall = events.find(
      (event) => event.type === 'model_call' && event.role === 'tutor_stub_tutor' && event.turn === 1,
    );
    assert.ok(tutorCall, 'expected the speaking tutor to run after the clue was postponed');
    const tutorPrompt = tutorCall.request.messages.at(-1)?.content || '';
    assert.doesNotMatch(tutorPrompt, new RegExp(LARKSPUR_BADGE_SURFACE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u'));
    assert.doesNotMatch(tutorPrompt, /visitor badge|visitor code|WF-11|outside crew in hi-vis/iu);
    assert.doesNotMatch(tutorPrompt, /Act intent:|Next evidence window:/u);
    assert.match(tutorPrompt, /Current branch: opening The Lunchbox on Shelf Two/u);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
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
      `Badge clerk, finger on the visitor log: “${LARKSPUR_BADGE_SURFACE}” What does this badge entry change?`,
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
