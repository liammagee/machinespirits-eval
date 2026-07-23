import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  TUTOR_STUB_TRANSCRIPT_HTML_SCHEMA,
  buildTutorStubReplayJavascript,
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
      {
        role: 'assistant',
        content: 'You are right to keep those claims separate. Now compare the process mark with the custody record.',
      },
    ],
    turns: [
      {
        turn: 1,
        learner: 'Does <this> identify the hand?',
        learnerResponseProvenance: {
          schema: 'machinespirits.tutor-stub.learner-response-provenance.v1',
          authorship: 'human',
          humanGenerated: true,
          aiGenerated: false,
          aiAssisted: false,
          humanInLoop: true,
          origin: 'human_direct',
          inputMethod: 'terminal',
        },
        learnerInput: {
          tutorFeedback: {
            requested: true,
            supplied: true,
            rating: 'down',
            targetTutorTurn: 0,
            targetTutorTurnId: 'html-test:opening',
          },
        },
        tutor: 'You are right to keep those claims separate. Now compare the process mark with the custody record.',
        classification: {
          turn: { summary: 'The learner asks what the residue licenses.' },
          overall: { trajectory: 'careful inquiry' },
        },
        tutorLearnerDagModel: { adopted: ['p1'], missing: ['p2'] },
        tutorLearnerDagUpdate: {
          preflight: {
            schema: 'machinespirits.tutor-stub.learner-dag-preflight.v1',
            computedBeforeModelCall: true,
            eligiblePublicPremiseIds: ['p1'],
            possibleNextDerivations: [],
            authority: { commitsProgress: false },
          },
          accepted: { adopt: ['p1'], derive: [] },
          rejected: [],
        },
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
          actorial_part: 'record_keeper',
          actorial_part_label: 'keeper of the trial-book',
        },
        previousRegisterEfficacy: { status: 'no_prior_turn' },
        responseConfigurationAudit: { visible_axis_count: 6, axis_count: 6 },
        feedbackAdaptationPlan: {
          schema: 'machinespirits.tutor-stub.feedback-adaptation-plan.v1',
          rating: 'down',
          changedAxes: ['engagement_stance'],
        },
        feedbackAdaptationAudit: {
          schema: 'machinespirits.tutor-stub.feedback-adaptation-audit.v1',
          passed: true,
          changedAxes: ['engagement_stance'],
        },
        feedbackObservation: {
          schema: 'machinespirits.tutor-stub.feedback-observation.v1',
          causalClaim: false,
          feedback: { rating: 'down', helpfulness: -1 },
          outcomes: { subjectiveHelpfulness: -1, objectiveProgress: null },
        },
        responseComposition: {
          uptake: 'You are right to keep those claims separate.',
          development: 'Now compare the process mark with the custody record.',
          audit: { ok: true },
          atomicAssistantTurn: true,
        },
      },
    ],
    settings: {
      lab: { id: 'human_scaffold', maturity: 'stable', audience: 'learner_safe' },
      recipe: {
        schema: 'machinespirits.tutor-stub.session-recipe.v1',
        version: 1,
        configHash: 'recipe-hash-123',
        relaunchCommand: "npm run tutor:stub -- --resume '.tutor-stub-traces/html-test.jsonl'",
      },
      world: {
        id: 'world_005_marrick',
        title: 'The Light Shillings',
        question: 'Whose hand struck the false shillings?',
      },
      learner: { mode: 'mixed', profileId: 'diligent' },
      tutor: {
        instanceId: 'dramatic-detective',
        instanceTitle: 'The Dramatic Detective Tutor',
        activeRef: 'dramatic-detective@v1',
        rolePromptHash: 'abc123',
        modelRef: 'codex.gpt-5.6-sol',
        provider: 'codex',
        model: 'gpt-5.6-sol',
        maxTokens: 4096,
      },
      register: { policy: 'field', engagementStanceTemperature: 0.85 },
      dagFactDropout: { rate: 0.15 },
      tuning: {
        mode: 'on',
        activeRef: 'dramatic-detective@v1',
        stableVersion: 1,
        canaryVersion: null,
        candidates: [
          {
            id: 'cand-example',
            status: 'approval_required',
            baseVersion: 1,
            evidence: { reason: 'too_abstract', reasonLabel: 'too abstract', comment: 'Use the scene.' },
            proposal: { scope: 'tutor_prompt', rule: 'Use concrete public objects.' },
            replay: { publicMessages: [] },
          },
        ],
      },
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

test('transcript HTML renders raw, script, swimlane, analysis, prompt, settings, relaunch, and replay views', () => {
  const html = renderTutorStubTranscriptHtml(fixtureSnapshot());

  for (const view of [
    'raw',
    'script',
    'swimlanes',
    'analysis',
    'prompts',
    'settings',
    'tuning',
    'relaunch',
    'replay',
  ]) {
    assert.match(html, new RegExp(`data-view="${view}"`, 'u'));
    assert.match(html, new RegExp(`data-panel="${view}"`, 'u'));
  }
  assert.match(html, /FULL TUTOR BASE PROMPT/u);
  assert.match(html, /dramatic-detective@v1/u);
  assert.match(html, /cand-example/u);
  assert.match(html, /FULL EFFECTIVE TUTOR SYSTEM PROMPT/u);
  assert.match(html, /FULL USED LEARNER USER PROMPT/u);
  assert.match(html, /The unresolved evidentiary distinction calls for a calm re-anchor/u);
  assert.match(html, /Learning pace:<\/b> accelerating/u);
  assert.match(html, /pace: accelerating \(3 moves\)/u);
  assert.match(html, /part: keeper of the trial book/u);
  assert.match(html, /&quot;missing&quot;: \[/u);
  assert.match(html, /DAG preflight and committed update/u);
  assert.match(html, /machinespirits\.tutor-stub\.learner-dag-preflight\.v1/u);
  assert.match(html, /register\.engagementStanceTemperature/u);
  assert.match(html, /0\.85/u);
  assert.match(html, /Does &lt;this&gt; identify the hand\?/u);
  assert.match(html, /data-machine-spirits-house-style="machinespirits\.house-style\.v1"/u);
  assert.match(html, /data-machine-spirits-house-backdrop="machinespirits\.house-style\.v1"/u);
  assert.match(html, /<body class="ms-house-style transcript-page">/u);
  assert.match(html, /class="hero ms-panel"/u);
  assert.match(html, /class="eyebrow ms-kicker"/u);
  assert.match(html, /class="ms-display"/u);
  assert.match(html, /class="ms-tab active" aria-selected="true"/u);
  assert.match(html, /class="copy-code ms-button"/u);
  assert.match(html, /Machine Spirits house style · machinespirits\.house-style\.v1/u);
  assert.doesNotMatch(html, /Does <this> identify the hand\?/u);
  assert.equal((html.match(/data-response-composition="continuous-performance"/gu) || []).length, 2);
  assert.doesNotMatch(html, /<small>responds<\/small>|<small>develops<\/small>/u);
  assert.match(html, /Response to that rating:<\/b> the one-turn adaptation was visible/u);
  assert.match(html, /Rated-response learning record/u);
  assert.match(html, /machinespirits\.tutor-stub\.feedback-observation\.v1/u);
  assert.match(html, /Response shape:<\/b> one continuous reply with learner uptake and development/u);
  assert.match(html, /Previous tutor reply: 👎 not helpful/u);
  assert.match(html, /Human-authored learner response · terminal/u);
  assert.match(html, /data-learner-authorship="human"/u);
  assert.match(html, /\[AUTHORSHIP\] Human-authored learner response/u);
  assert.match(html, /&quot;human&quot;: 1/u);
  assert.match(html, /Learner rating of the previous tutor reply:<\/b> 👎 not helpful/u);
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
  assert.match(html, />Replay JS<\/button>/u);
  assert.match(html, />Relaunch<\/button>/u);
  assert.match(html, /Copy relaunch command/u);
  assert.match(html, /recipe-hash-123/u);
  assert.match(html, /npm run tutor:stub -- --resume/u);
  assert.match(html, /data-replay-message-count="3"/u);
  assert.match(html, /https:\/\/api\.openai\.com\/v1\/responses/u);
  assert.match(html, /process\.env\.OPENAI_API_KEY/u);
  assert.match(html, /const messages = \[/u);
  assert.match(html, /Does &lt;this&gt; identify the hand\?/u);
});

test('replay JavaScript preserves exact public message order without harness prompts', () => {
  const javascript = buildTutorStubReplayJavascript(fixtureSnapshot());

  assert.ok(javascript.indexOf('Read the first mark.') < javascript.indexOf('Does <this> identify the hand?'));
  assert.ok(
    javascript.indexOf('Does <this> identify the hand?') <
      javascript.indexOf('You are right to keep those claims separate.'),
  );
  assert.equal(
    javascript.includes(
      'You are right to keep those claims separate. Now compare the process mark with the custody record.',
    ),
    true,
  );
  assert.match(javascript, /model: "gpt-5\.6-sol"/u);
  assert.match(javascript, /input: messages/u);
  assert.doesNotMatch(javascript, /FULL TUTOR BASE PROMPT/u);
  assert.doesNotMatch(javascript, /missing/u);
});

test('replay JavaScript uses the Anthropic Messages API for Claude transcripts', () => {
  const snapshot = fixtureSnapshot();
  snapshot.settings.tutor = {
    modelRef: 'claude-code.sonnet',
    provider: 'claude-code',
    model: 'claude-sonnet-5',
    maxTokens: 2048,
  };
  const javascript = buildTutorStubReplayJavascript(snapshot);

  assert.match(javascript, /https:\/\/api\.anthropic\.com\/v1\/messages/u);
  assert.match(javascript, /process\.env\.ANTHROPIC_API_KEY/u);
  assert.match(javascript, /model: "claude-sonnet-5"/u);
  assert.match(javascript, /max_tokens: 2048/u);
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
        env: {
          ...process.env,
          TUTOR_STUB_OPENING_REALIZER: 'deterministic',
          TUTOR_STUB_SUMMARY_OPEN: '0',
        },
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
  assert.doesNotMatch(html, /(?:src|href)=["']https?:\/\//u);
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
  assert.match(html, /Private behavior brief/u);
  assert.match(html, /Base tutor system prompt/u);
  assert.match(html, /register\.policy/u);
  assert.match(html, /dagFactDropout\.rate/u);
});
