import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  TUTOR_STUB_TRANSCRIPT_HTML_SCHEMA,
  launchTutorStubTranscriptHtml,
  renderTutorStubTranscriptHtml,
  writeTutorStubTranscriptHtml,
} from '../services/tutorStubTranscriptHtml.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fixtureSnapshot() {
  return {
    schema: TUTOR_STUB_TRANSCRIPT_HTML_SCHEMA,
    generatedAt: '2026-07-12T01:02:03.000Z',
    runId: 'html-test',
    directorContext: { stageNotes: 'The assay waits.' },
    directorNotes: {
      schema: 'machinespirits.tutor-stub.director-notes.v1',
      throughTurn: 1,
      opening: {
        stageNotes: 'The assay waits.',
        tutorCharacter: 'The tutor waits for evidence.',
        learnerCharacter: 'The learner keeps the assay book.',
        registerNote: 'Keep the scene restrained.',
      },
      releases: [
        {
          turn: 1,
          premise: 'p1',
          via: 'director',
          surface: 'The first public assay note is now on the table.',
        },
      ],
    },
    opening: 'Read the first mark.',
    history: [
      { role: 'assistant', content: 'Read the first mark.' },
      { role: 'user', content: 'Does <this> identify the hand?' },
      { role: 'assistant', content: 'It identifies a process, not yet a hand.' },
    ],
    turns: [
      {
        turn: 1,
        learner: 'Does <this> identify the hand?',
        tutor: 'It identifies a process, not yet a hand.',
        classification: {
          turn: { summary: 'The learner asks what the residue licenses.' },
          overall: { trajectory: 'careful inquiry' },
        },
        tutorLearnerDagModel: { adopted: ['p1'], missing: ['p2'] },
        learnerAdvance: {
          pace: 'accelerating',
          accelerated: true,
          supportedMoveCount: 3,
          adoptedPremiseCount: 2,
          derivedFactCount: 1,
        },
        registerSelection: {
          engagement_stance: 'warm',
          register_reason: 'The unresolved evidentiary distinction calls for a calm re-anchor.',
        },
        responseConfiguration: {
          action_family: 'reanchor_public_evidence',
          audience_register: 'adult_novice',
          lexical_accessibility: 'plain_language',
          scene_immersion: 'fully_in_scene',
        },
        previousRegisterEfficacy: { status: 'no_prior_turn' },
        responseConfigurationAudit: { visible_axis_count: 5, axis_count: 5 },
      },
    ],
    settings: {
      world: {
        id: 'world_005_marrick',
        title: 'The Light Shillings',
        question: 'Whose hand struck the false shillings?',
      },
      learner: { mode: 'mixed', profileId: 'diligent' },
      register: { policy: 'field', engagementStanceTemperature: 0.85 },
      dagFactDropout: { rate: 0.15 },
    },
    prompts: {
      tutor: {
        baseSystemPrompt: 'FULL TUTOR BASE PROMPT',
        turns: [
          {
            turn: 1,
            systemPrompt: 'FULL EFFECTIVE TUTOR SYSTEM PROMPT',
            userPrompt: 'FULL TUTOR USER PROMPT',
            messageHistory: [{ role: 'assistant', content: 'Read the first mark.' }],
          },
        ],
      },
      learner: {
        mode: 'mixed',
        activeSystemPrompt: 'FULL LEARNER SYSTEM PROMPT',
        nextUserPrompt: 'FULL NEXT LEARNER USER PROMPT',
        history: [
          {
            turn: 1,
            requestId: 4,
            profileId: 'diligent',
            systemPrompt: 'FULL USED LEARNER SYSTEM PROMPT',
            userPrompt: 'FULL USED LEARNER USER PROMPT',
          },
        ],
      },
    },
  };
}

test('transcript HTML renders raw, script, swimlane, analysis, prompt, and settings views', () => {
  const html = renderTutorStubTranscriptHtml(fixtureSnapshot());

  for (const view of ['raw', 'script', 'swimlanes', 'analysis', 'prompts', 'settings']) {
    assert.match(html, new RegExp(`data-view="${view}"`, 'u'));
    assert.match(html, new RegExp(`data-panel="${view}"`, 'u'));
  }
  assert.match(html, /FULL TUTOR BASE PROMPT/u);
  assert.match(html, /FULL EFFECTIVE TUTOR SYSTEM PROMPT/u);
  assert.match(html, /FULL USED LEARNER USER PROMPT/u);
  assert.match(html, /The unresolved evidentiary distinction calls for a calm re-anchor/u);
  assert.match(html, /Learning pace:<\/b> accelerating/u);
  assert.match(html, /pace: accelerating \(3 moves\)/u);
  assert.match(html, /&quot;missing&quot;: \[/u);
  assert.match(html, /register\.engagementStanceTemperature/u);
  assert.match(html, /0\.85/u);
  assert.match(html, /Does &lt;this&gt; identify the hand\?/u);
  assert.doesNotMatch(html, /Does <this> identify the hand\?/u);
  assert.equal((html.match(/data-director-notes/gu) || []).length, 1);
  assert.ok(html.indexOf('data-director-notes') < html.indexOf('class="tabs"'));
  assert.match(html, /Director notes so far/u);
  assert.match(html, /The first public assay note is now on the table\./u);
  assert.match(html, /Future notes remain withheld\./u);
  assert.match(html, /\[OPENING · TUTOR\]/u);
  assert.match(html, /\[TURN 1 · LEARNER\]/u);
  assert.match(html, /\[TURN 1 · TUTOR REPLY\]/u);
  assert.doesNotMatch(html, /<b>0<\/b>/u);
  assert.match(html, /class="opening-badge">open<\/b>/u);
  const swimlane = html.slice(html.indexOf('data-panel="swimlanes"'), html.indexOf('data-panel="analysis"'));
  assert.ok(swimlane.indexOf('data-swim-role="learner"') < swimlane.indexOf('data-swim-role="tutor-reply"'));
  assert.match(swimlane, /The opening is an unnumbered prelude\./u);
});

test('/director repeats only notes issued so far and records the non-transcript reprise', () => {
  const traceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-director-notes-'));
  try {
    const run = spawnSync(
      process.execPath,
      [
        'scripts/tutor-stub.js',
        '--world',
        'world_005_marrick',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--trace-dir',
        traceDir,
      ],
      {
        cwd: ROOT,
        encoding: 'utf8',
        input: '/director\n/quit\n',
        env: { ...process.env, TUTOR_STUB_SUMMARY_OPEN: '0' },
      },
    );

    assert.equal(run.status, 0, run.stderr || run.stdout);
    const notesIndex = run.stdout.indexOf('director notes so far >');
    assert.ok(notesIndex >= 0, run.stdout);
    const reprise = run.stdout.slice(notesIndex);
    assert.match(reprise, /opening directions/u);
    assert.match(reprise, /through the opening; future notes remain withheld/u);
    assert.doesNotMatch(reprise, /turn 2 · scene note/u);
    const events = fs
      .readdirSync(traceDir)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(traceDir, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const event = events.find((entry) => entry.type === 'director_notes_reprise');
    assert.equal(event.throughTurn, 0);
    assert.equal(event.openingIncluded, true);
    assert.equal(event.releasedNoteCount, 0);
    assert.equal(event.publicTranscriptChanged, false);
  } finally {
    fs.rmSync(traceDir, { recursive: true, force: true });
  }
});

test('transcript HTML writer creates parent directories and writes a self-contained page', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-html-writer-'));
  const filePath = path.join(dir, 'nested', 'transcript.html');

  const written = writeTutorStubTranscriptHtml({ snapshot: fixtureSnapshot(), filePath });

  assert.equal(written, path.resolve(filePath));
  assert.equal(fs.existsSync(written), true);
  const html = fs.readFileSync(written, 'utf8');
  assert.match(html, /^<!doctype html>/u);
  assert.doesNotMatch(html, /https?:\/\//u);
});

test('transcript HTML launcher selects the platform browser command', () => {
  const calls = [];
  const fakeChild = { once() {}, unref() {} };
  const result = launchTutorStubTranscriptHtml('/tmp/example transcript.html', {
    platform: 'darwin',
    spawnImpl(command, args, options) {
      calls.push({ command, args, options });
      return fakeChild;
    },
  });

  assert.equal(result.command, 'open');
  assert.deepEqual(calls, [
    {
      command: 'open',
      args: ['/tmp/example transcript.html'],
      options: { detached: true, stdio: 'ignore' },
    },
  ]);
});

test('interactive /transcript writes a mixed-mode snapshot without calling a model', () => {
  const traceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-html-cli-'));
  const run = spawnSync(
    process.execPath,
    [
      'scripts/tutor-stub.js',
      '--world',
      'world_005_marrick',
      '--dag',
      '--tutor-learner-dag',
      '--mixed-learner',
      '--no-opening',
      '--no-closeout-report',
      '--no-interim-animation',
      '--no-stream',
      '--trace-dir',
      traceDir,
    ],
    {
      cwd: ROOT,
      encoding: 'utf8',
      input: '/transcript no-open\n/quit\n',
      env: { ...process.env, TUTOR_STUB_TRANSCRIPT_OPEN: '0' },
    },
  );

  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.match(run.stdout, /transcript HTML >/u);
  assert.match(run.stdout, /written without opening/u);
  const htmlFiles = fs.readdirSync(traceDir).filter((name) => name.endsWith('-transcript.html'));
  assert.equal(htmlFiles.length, 1);
  const html = fs.readFileSync(path.join(traceDir, htmlFiles[0]), 'utf8');
  assert.match(html, /The Light Shillings/u);
  assert.match(html, /Private learner-profile contract/u);
  assert.match(html, /Base tutor system prompt/u);
  assert.match(html, /register\.policy/u);
  assert.match(html, /dagFactDropout\.rate/u);
});
