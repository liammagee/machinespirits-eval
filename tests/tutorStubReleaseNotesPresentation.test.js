import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { projectTutorStubReleaseNotesLines } from '../services/tutorStubReleaseNotesPresentation.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const COLORS = Object.freeze({
  accent: '<accent>',
  bold: '<bold>',
  brightCyan: '<bright-cyan>',
  dim: '<dim>',
  reset: '<reset>',
});

function commits(start, count) {
  return Object.freeze(
    Array.from({ length: count }, (_, index) =>
      Object.freeze({ shortHash: `h${start + index}`, subject: `subject ${start + index}` }),
    ),
  );
}

function terminalBytes(lines) {
  return lines.map((line) => `${line}\n`).join('');
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

test('empty release-note projection pins pluralization and the trailing blank line', () => {
  const input = {
    notes: Object.freeze({ hours: 24, relevantCommitCount: 0, through: null, groups: Object.freeze([]) }),
    colors: COLORS,
  };
  const before = structuredClone(input);
  const lines = projectTutorStubReleaseNotesLines(input);
  const output = terminalBytes(lines);

  assert.equal(sha256(output), 'bab399e5981e63c94c18d46b639c16ac4fd6af3bb2e3209243510bc6e7bb4da6');
  assert.equal(lines.length, 2);
  assert.match(output, /last 24 hours · 0 relevant commits/u);
  assert.match(output, /no tutor-stub commits landed in this window<reset>\n\n$/u);
  assert.deepEqual(input, before, 'empty release-note projection must not mutate its inputs');
});

test('grouped release-note projection pins singular labels, visibility limits, and exact bytes', () => {
  const input = {
    notes: Object.freeze({
      hours: 48,
      relevantCommitCount: 15,
      through: Object.freeze({ shortHash: 'h1' }),
      groups: Object.freeze([
        Object.freeze({
          id: 'dialogue_flow',
          title: 'Dialogue flow',
          effect: 'move forward',
          lookFor: 'less circling',
          commits: commits(1, 1),
        }),
        Object.freeze({
          id: 'validation',
          title: 'Verification',
          effect: 'freeze evidence',
          lookFor: 'stable tests',
          commits: commits(2, 6),
        }),
        Object.freeze({
          id: 'other',
          title: 'Other changes',
          effect: 'inspect first',
          lookFor: 'read commits',
          commits: commits(8, 8),
        }),
      ]),
    }),
    colors: COLORS,
  };
  const before = structuredClone(input);
  const lines = projectTutorStubReleaseNotesLines(input);
  const output = terminalBytes(lines);

  assert.equal(sha256(output), 'bc520457d38f73e77054f7fd250b0309d343a67a3fef85795feca460e5dd1398');
  assert.match(output, /last 48 hours · through h1 · 15 relevant commits/u);
  assert.match(output, /Dialogue flow<reset><dim> · 1 commit<reset>/u);
  assert.match(output, /Verification<reset><dim> · 6 commits<reset>[\s\S]*h5 ·<reset> subject 5/u);
  assert.doesNotMatch(output, /h6 ·<reset>|h7 ·<reset>/u);
  assert.match(output, /Other changes<reset><dim> · 8 commits<reset>[\s\S]*h13 ·<reset> subject 13/u);
  assert.doesNotMatch(output, /h14 ·<reset>|h15 ·<reset>/u);
  assert.equal(output.match(/\+ 2 earlier commits in this window/gu)?.length, 2);
  assert.match(
    output,
    /Verification commits are separated from changes that directly affect an exchange\.<reset>\n\n$/u,
  );
  assert.deepEqual(input, before, 'grouped release-note projection must not mutate its inputs');
});

test('the public presentation runtime retains Git loading, time-window normalization, terminal writes, and return value', () => {
  const cliSource = fs.readFileSync(path.join(ROOT, 'scripts', 'tutor-stub.js'), 'utf8');
  const serviceSource = fs.readFileSync(path.join(ROOT, 'services', 'tutorStubReleaseNotesPresentation.js'), 'utf8');
  const runtimeSource = fs.readFileSync(path.join(ROOT, 'services', 'tutorStubPublicPresentationRuntime.js'), 'utf8');
  const releaseNotesSlice = runtimeSource.slice(
    runtimeSource.indexOf('function printTutorStubReleaseNotes'),
    runtimeSource.indexOf('\n  return {', runtimeSource.indexOf('function printTutorStubReleaseNotes')),
  );

  assert.match(cliSource, /createTutorStubPublicPresentationRuntime/u);
  assert.match(runtimeSource, /from '\.\/tutorStubReleaseNotesPresentation\.js';/u);
  assert.match(releaseNotesSlice, /normalizeTutorStubReleaseNotesHours/u);
  assert.match(releaseNotesSlice, /loadTutorStubReleaseNotes\(\{ cwd: ROOT, hours \}\)/u);
  assert.match(releaseNotesSlice, /projectTutorStubReleaseNotesLines/u);
  assert.match(releaseNotesSlice, /writeLine\(line\)/u);
  assert.match(releaseNotesSlice, /return notes/u);
  assert.doesNotMatch(releaseNotesSlice, /This view is rebuilt from Git each time/u);
  assert.match(serviceSource, /export function projectTutorStubReleaseNotesLines/u);
  assert.doesNotMatch(serviceSource, /^import\s/mu);
  assert.doesNotMatch(serviceSource, /\b(?:execFileSync|fs|console|process|fetch|Date\.now)\s*[.(]/u);
});
