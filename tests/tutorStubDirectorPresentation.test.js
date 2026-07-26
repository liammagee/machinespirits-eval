import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  projectTutorStubDirectorContextLines,
  projectTutorStubDirectorNotesLines,
} from '../services/tutorStubDirectorPresentation.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COLORS = Object.freeze({ cyan: '<cyan>', dim: '<dim>', reset: '<reset>' });

function terminalBytes(lines) {
  return lines.map((line) => `${line}\n`).join('');
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

test('director-context projection pins multiline fields, audience order, exact bytes, and immutability', () => {
  const context = {
    stageNotes: 'Set the room.\nKeep the answer hidden.',
    tutorCharacter: 'A patient examiner.',
    learnerCharacter: 'An alert investigator.',
    audienceContext: 'A public gallery.\nNo private proof.',
    registerNote: 'Stay inside the scene.',
  };
  const before = structuredClone(context);
  const lines = projectTutorStubDirectorContextLines(context, { colors: COLORS });
  const output = terminalBytes(lines);

  assert.equal(sha256(output), 'fbb20c983a71000fb9ba450ed33d80ddc27dc1d1f342652350fa025416fd4aef');
  assert.match(output, /^<cyan>director context ><reset>\n/u);
  assert.match(output, /<dim> {2}stage:<reset> Set the room\.\n {4}Keep the answer hidden\./u);
  assert.match(output, /<dim> {2}audience:<reset> A public gallery\.\n {4}No private proof\./u);
  assert.match(output, /<dim> {2}voice:<reset> Stay inside the scene\.\n\n$/u);
  assert.equal(Object.isFrozen(lines), true);
  assert.deepEqual(context, before);
});

test('director-notes projection distinguishes no issued notes from opening and released scene notes', () => {
  assert.deepEqual(projectTutorStubDirectorNotesLines({}, { colors: COLORS }), [
    '<cyan>director notes so far ><reset>',
    '<dim>  none have been issued yet<reset>\n',
  ]);

  const notes = {
    throughTurn: 2,
    opening: {
      stageNotes: 'Set the room.',
      tutorCharacter: 'Keep the record.',
      learnerCharacter: 'Test the evidence.',
      registerNote: 'Use public terms.',
    },
    releases: [{ turn: 2, surface: 'Tap the ledger.\nName the public mark.' }],
  };
  const before = structuredClone(notes);
  const lines = projectTutorStubDirectorNotesLines(notes, { colors: COLORS });
  const output = terminalBytes(lines);

  assert.equal(sha256(output), '73afe308cc51e0f89b38092126ba15072ed0223667123215a7d404607b5046c4');
  assert.match(output, /<dim> {2}opening directions<reset>/u);
  assert.match(output, /<dim> {2}turn 2 · scene note<reset>\n {4}Tap the ledger\.\n {4}Name the public mark\./u);
  assert.match(output, /through completed turn 2; future notes remain withheld<reset>\n\n$/u);
  assert.equal(Object.isFrozen(lines), true);
  assert.deepEqual(notes, before);
});

test('real director context and reprise retain their exact no-model terminal bytes', () => {
  const result = spawnSync(
    process.execPath,
    [
      'scripts/tutor-stub.js',
      '--world',
      'world_005_marrick',
      '--no-closeout-report',
      '--no-interim-animation',
      '--no-stream',
      '--no-trace',
      '--no-remember-settings',
      '--no-color',
    ],
    {
      cwd: ROOT,
      encoding: 'utf8',
      input: '/director\n/quit\n',
      timeout: 15_000,
      env: {
        ...process.env,
        NO_COLOR: '1',
        TUTOR_STUB_OPENING_REALIZER: 'deterministic',
        TUTOR_STUB_SUMMARY_OPEN: '0',
        TUTOR_STUB_REMEMBER_SETTINGS: '0',
      },
    },
  );
  const context = result.stdout.match(/director context >[\s\S]*?\n\n(?=tutor >)/u)?.[0] || '';
  const reprise = result.stdout.match(/director notes so far >[\s\S]*?future notes remain withheld\n\n/u)?.[0] || '';

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(Buffer.byteLength(context), 1463);
  assert.equal(sha256(context), 'c2682db022585f73378c0b5c20ea02616fc1f61055618b206c6f0af27ce66484');
  assert.equal(Buffer.byteLength(reprise), 1541);
  assert.equal(sha256(reprise), '5fcedc2e33e8d2a98b1c1399928d49eb69f77ea73f06e050d4c936e4f8bd5e4e');
});

test('the CLI retains director-state derivation, withholding, traces, terminal writes, and command ownership', () => {
  const cliSource = fs.readFileSync(path.join(ROOT, 'scripts', 'tutor-stub.js'), 'utf8');
  const serviceSource = fs.readFileSync(path.join(ROOT, 'services', 'tutorStubDirectorPresentation.js'), 'utf8');
  const preludeSlice = cliSource.slice(
    cliSource.indexOf('function printDirectorPreludeBeforeFirstTutor'),
    cliSource.indexOf('function directorNotesIssuedSoFar'),
  );
  const notesSlice = cliSource.slice(
    cliSource.indexOf('function directorNotesIssuedSoFar'),
    cliSource.indexOf('function worldSpeakerDagPrompt'),
  );

  assert.match(cliSource, /from '\.\.\/services\/tutorStubDirectorPresentation\.js';/u);
  assert.match(preludeSlice, /state\.directorOpeningPresented = true/u);
  assert.match(preludeSlice, /appendTraceEvent/u);
  assert.match(notesSlice, /committedReleaseRows/u);
  assert.match(notesSlice, /projectTutorStubDirectorNotesLines/u);
  assert.match(notesSlice, /console\.log\(line\)/u);
  assert.match(cliSource, /type: 'director_notes_reprise'/u);
  assert.match(cliSource, /if \(command === '\/director'/u);
  assert.doesNotMatch(serviceSource, /^import\s/mu);
  assert.doesNotMatch(serviceSource, /\b(?:spawnSync|fs|console|process|fetch|Date\.now)\s*[.(]/u);
});
