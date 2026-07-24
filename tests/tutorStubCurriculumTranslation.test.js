import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  TUTOR_STUB_CURRICULUM_TRANSLATION_LEVELS,
  TUTOR_STUB_CURRICULUM_TRANSLATION_SCHEMA,
  TUTOR_STUB_TUTOR_OUTPUT_TRANSLATION_SCHEMA,
  TUTOR_STUB_TUTOR_OUTPUT_TRANSLATOR_SYSTEM_PROMPT,
  buildTutorStubCurriculumTranslationPrompt,
  buildTutorStubTutorOutputTranslationPrompt,
  normalizeTutorStubCurriculumTranslationLevels,
  normalizeTutorStubTutorOutputTranslationLevels,
  parseTutorStubCurriculumTranslation,
  parseTutorStubTutorOutputTranslation,
  renderTutorStubCurriculumTranslation,
  renderTutorStubTutorOutputTranslation,
  tutorStubCurriculumTranslationSource,
} from '../services/tutorStubCurriculumTranslation.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const MODULE = Object.freeze({
  id: 'AF-T1',
  title: 'Evidence-bearing proof structures',
  essential_question: 'How does a directed acyclic graph make a conclusion inspectable?',
  main_artifact: 'A proof DAG with an auditable evidence path',
  knowledge_components: [
    { id: 'KC-1', statement: 'A directed acyclic graph has one-way edges and no directed loops.' },
    { id: 'KC-2', statement: 'Every conclusion must remain traceable to public evidence.' },
  ],
  canonical_tasks: ['Identify the premises that warrant the root conclusion.'],
  verifiers: ['Check that every non-leaf node follows from its incoming premises and that the graph is acyclic.'],
  misconception_signatures: ['Treating any earlier statement as sufficient evidence.'],
  mastery_gate: 'Build a valid graph and explain one complete evidence path without hidden premises.',
  transfer_challenge: 'Repair a cyclic argument without changing its licensed conclusion.',
});

function modelPayload(levels, source) {
  return JSON.stringify({
    variants: levels.map((level) => ({
      level,
      segments: Object.fromEntries(source.segments.map((entry) => [entry.id, `${level}: ${entry.text}`])),
    })),
  });
}

function installMockTranslator(binDir, kind) {
  const executable = path.join(binDir, 'codex');
  fs.mkdirSync(binDir, { recursive: true });
  const curriculumBody = `
  const marker = 'Return exactly this JSON shape and exactly these segment keys: ';
  const contractLine = input.split('\\n').find((line) => line.includes(marker));
  if (!contractLine) process.exit(2);
  const template = JSON.parse(contractLine.slice(contractLine.indexOf(marker) + marker.length));
  for (const variant of template.variants) {
    for (const id of Object.keys(variant.segments)) variant.segments[id] = variant.level + ' wording for ' + id;
  }
  return template;`;
  const tutorOutputBody = `
  const marker = 'Return exactly this JSON shape and these requested levels: ';
  const contractLine = input.split('\\n').find((line) => line.includes(marker));
  if (!contractLine || !input.includes('Latest public tutor utterance')) process.exit(2);
  const template = JSON.parse(contractLine.slice(contractLine.indexOf(marker) + marker.length));
  for (const variant of template.variants) variant.text = 'What does the public record show?';
  return template;`;
  fs.writeFileSync(
    executable,
    `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const outputIndex = args.indexOf('-o');
const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : null;
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  const buildResponse = () => {${kind === 'curriculum' ? curriculumBody : tutorOutputBody}
  };
  const response = JSON.stringify(buildResponse());
  if (outputPath) fs.writeFileSync(outputPath, response);
  process.stdout.write(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: response } }) + '\\n');
});
`,
    'utf8',
  );
  fs.chmodSync(executable, 0o755);
}

function runInteractiveCommand({ args, binDir, command, readyText }) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: ROOT,
      env: {
        ...process.env,
        PATH: `${binDir}${path.delimiter}${process.env.PATH || ''}`,
        CLI_PROVIDER_CODEX_TIMEOUT_MS: '5000',
        TUTOR_STUB_SUMMARY_OPEN: '0',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let quitSent = false;
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`translator CLI test timed out\n${stderr}\n${stdout}`));
    }, 20_000);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      if (!quitSent && stdout.includes(readyText)) {
        quitSent = true;
        setTimeout(() => child.stdin.end('/quit\n'), 50);
      }
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('exit', (status, signal) => {
      clearTimeout(timeout);
      resolve({ status, signal, stdout, stderr });
    });
    child.stdin.write(`${command}\n`);
  });
}

test('translation source keeps inspectable curriculum item boundaries without exposing teaching-only misconceptions', () => {
  const source = tutorStubCurriculumTranslationSource(MODULE);

  assert.equal(source.moduleId, 'AF-T1');
  assert.deepEqual(
    source.segments.map((entry) => entry.id),
    [
      'title',
      'essential_question',
      'main_artifact',
      'knowledge_component_kc-1',
      'knowledge_component_kc-2',
      'canonical_task_01',
      'verifier_01',
      'mastery_gate',
      'transfer_challenge',
    ],
  );
  assert.equal(
    source.segments.some((entry) => /earlier statement/u.test(entry.text)),
    false,
  );
});

test('bare translate selects all levels while a named level selects one', () => {
  assert.equal(normalizeTutorStubCurriculumTranslationLevels(''), TUTOR_STUB_CURRICULUM_TRANSLATION_LEVELS);
  assert.equal(normalizeTutorStubCurriculumTranslationLevels('all'), TUTOR_STUB_CURRICULUM_TRANSLATION_LEVELS);
  assert.deepEqual(normalizeTutorStubCurriculumTranslationLevels('basic'), ['basic']);
  assert.deepEqual(normalizeTutorStubCurriculumTranslationLevels('proficient'), ['proficient']);
  assert.throws(() => normalizeTutorStubCurriculumTranslationLevels('simple'), /use \/translate/u);
});

test('bare translate selects basic English for a tutor-output fallback', () => {
  assert.deepEqual(normalizeTutorStubTutorOutputTranslationLevels(''), ['basic']);
  assert.equal(normalizeTutorStubTutorOutputTranslationLevels('all'), TUTOR_STUB_CURRICULUM_TRANSLATION_LEVELS);
  assert.deepEqual(normalizeTutorStubTutorOutputTranslationLevels('proficient'), ['proficient']);
  assert.throws(() => normalizeTutorStubTutorOutputTranslationLevels('simple'), /use \/translate/u);
});

test('tutor-output translation is bounded to the latest public utterance and renders a temporary variant', () => {
  const sourceText = 'Before we traverse the proof DAG, what does the public cupel mark actually show?';
  const request = buildTutorStubTutorOutputTranslationPrompt({ text: sourceText, levels: ['basic'] });

  assert.equal(request.sourceText, sourceText);
  assert.match(request.prompt, /Latest public tutor utterance/u);
  assert.match(TUTOR_STUB_TUTOR_OUTPUT_TRANSLATOR_SYSTEM_PROMPT, /world-specific jargon/u);
  assert.doesNotMatch(request.prompt, /hidden premise|release schedule|concealed answer/iu);

  const translation = parseTutorStubTutorOutputTranslation(
    JSON.stringify({ variants: [{ level: 'basic', text: 'What does the public mark show?' }] }),
    { sourceText, levels: ['basic'] },
  );
  assert.equal(translation.schema, TUTOR_STUB_TUTOR_OUTPUT_TRANSLATION_SCHEMA);
  assert.deepEqual(translation.levels, ['basic']);
  assert.equal(renderTutorStubTutorOutputTranslation(translation), 'BASIC ENGLISH\nWhat does the public mark show?');
  assert.throws(
    () =>
      parseTutorStubTutorOutputTranslation(JSON.stringify({ variants: [{ level: 'basic', text: '' }] }), {
        sourceText,
        levels: ['basic'],
      }),
    /blank text/u,
  );
});

test('translation prompt requires exact segment preservation at every requested language level', () => {
  const request = buildTutorStubCurriculumTranslationPrompt({
    module: MODULE,
    levels: ['basic', 'proficient'],
  });

  assert.deepEqual(request.levels, ['basic', 'proficient']);
  assert.match(request.prompt, /exactly these segment keys/u);
  assert.match(request.prompt, /Do not omit, merge, split, rename, or add segments/u);
  assert.match(request.prompt, /knowledge_component_kc-1/u);
  assert.doesNotMatch(request.prompt, /Treating any earlier statement/u);
});

test('translation parser validates every source key and renders each variant separately', () => {
  const source = tutorStubCurriculumTranslationSource(MODULE);
  const translation = parseTutorStubCurriculumTranslation(
    modelPayload(TUTOR_STUB_CURRICULUM_TRANSLATION_LEVELS, source),
    { module: MODULE, levels: TUTOR_STUB_CURRICULUM_TRANSLATION_LEVELS },
  );

  assert.equal(translation.schema, TUTOR_STUB_CURRICULUM_TRANSLATION_SCHEMA);
  assert.deepEqual(
    translation.variants.map((variant) => variant.level),
    TUTOR_STUB_CURRICULUM_TRANSLATION_LEVELS,
  );
  const rendered = renderTutorStubCurriculumTranslation(translation);
  assert.match(rendered, /BASIC ENGLISH/u);
  assert.match(rendered, /PROFICIENT ENGLISH/u);
  assert.match(rendered, /How the work is checked:/u);
  assert.doesNotMatch(rendered, /KC-1:/u);

  const invalid = JSON.parse(modelPayload(['basic'], source));
  delete invalid.variants[0].segments.verifier_01;
  assert.throws(
    () => parseTutorStubCurriculumTranslation(JSON.stringify(invalid), { module: MODULE, levels: ['basic'] }),
    /missing verifier_01/u,
  );
});

test('interactive curriculum command renders one requested level without advancing dialogue state', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-curriculum-translate-'));
  try {
    const binDir = path.join(tmp, 'bin');
    const traceDir = path.join(tmp, 'traces');
    installMockTranslator(binDir, 'curriculum');
    const result = await runInteractiveCommand({
      args: [
        'scripts/tutor-stub.js',
        '--no-opening',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--no-remember-settings',
        '--curriculum',
        'curriculum/ai-foundations.curriculum.yaml',
        '--module',
        'AF1',
        '--trace-dir',
        traceDir,
      ],
      binDir,
      command: '/translate basic',
      readyText: 'BASIC ENGLISH',
    });

    assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
    assert.match(result.stdout, /translate > AF1 · AI systems, tasks, and agents/u);
    assert.match(result.stdout, /BASIC ENGLISH/u);
    assert.match(result.stdout, /basic wording for essential_question/u);
    assert.doesNotMatch(result.stdout, /INTERMEDIATE ENGLISH/u);
    assert.doesNotMatch(result.stdout, /translate error/u);
    const tracePath = fs
      .readdirSync(traceDir)
      .map((name) => path.join(traceDir, name))
      .find((filePath) => filePath.endsWith('.jsonl'));
    const trace = fs.readFileSync(tracePath, 'utf8');
    assert.match(trace, /"type":"curriculum_translation_complete"/u);
    assert.match(trace, /"publicTranscriptChanged":false/u);
    assert.doesNotMatch(trace, /"type":"learner_turn_fragment_received"/u);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('interactive direct command rewrites the latest tutor output without replacing or reprising it', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-output-translate-'));
  try {
    const binDir = path.join(tmp, 'bin');
    const traceDir = path.join(tmp, 'traces');
    installMockTranslator(binDir, 'tutor-output');
    const result = await runInteractiveCommand({
      args: [
        'scripts/tutor-stub.js',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--no-remember-settings',
        '--opening-realizer',
        'deterministic',
        '--world',
        'world_005_marrick',
        '--trace-dir',
        traceDir,
      ],
      binDir,
      command: '/translate',
      readyText: 'What does the public record show?',
    });

    assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
    assert.match(result.stdout, /translate > latest tutor reply/u);
    assert.match(result.stdout, /temporary wording view; the transcript and tutor state are unchanged/u);
    assert.match(result.stdout, /BASIC ENGLISH\s+What does the public record show\?/u);
    assert.doesNotMatch(result.stdout, /INTERMEDIATE ENGLISH/u);
    assert.doesNotMatch(result.stdout, /tutor ↻ >/u);
    const tracePath = fs
      .readdirSync(traceDir)
      .map((name) => path.join(traceDir, name))
      .find((filePath) => filePath.endsWith('.jsonl'));
    const trace = fs.readFileSync(tracePath, 'utf8');
    assert.match(trace, /"type":"tutor_output_translation_complete"/u);
    assert.match(trace, /"schema":"machinespirits\.tutor-stub\.tutor-output-translation\.v1"/u);
    assert.match(trace, /"publicTranscriptChanged":false/u);
    assert.doesNotMatch(trace, /"transcriptOperation":"replace_latest_tutor_utterance"/u);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
