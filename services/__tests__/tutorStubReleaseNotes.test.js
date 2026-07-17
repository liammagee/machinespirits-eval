import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildTutorStubReleaseNotes,
  loadTutorStubReleaseNotes,
  normalizeTutorStubReleaseNotesHours,
  parseTutorStubGitLog,
} from '../tutorStubReleaseNotes.js';

function commit(shortHash, subject, files = ['scripts/tutor-stub.js']) {
  return {
    hash: shortHash.padEnd(40, '0'),
    shortHash,
    committedAt: '2026-07-16T09:00:00+10:00',
    subject,
    files,
  };
}

test('release notes group product changes by their expected visible effect', () => {
  const notes = buildTutorStubReleaseNotes(
    [
      commit('11111111', 'fix(tutor-stub): avoid reopening resolved clue questions'),
      commit('11111112', 'fix(tutor-stub): close supported learner answers'),
      commit('22222222', 'fix(tutor-stub): recognize natural clue performances'),
      commit('33333333', 'fix(tutor-stub): sanitize recovery prompt boundaries'),
      commit('44444444', 'feat(tutor-stub): add voice companion and CLI themes'),
      commit('55555555', 'test(tutor-stub): predeclare fresh recovery matrix'),
      commit('66666666', 'chore: update unrelated package', ['package-lock.json']),
    ],
    { hours: 24, generatedAt: new Date('2026-07-16T10:00:00.000Z') },
  );

  assert.equal(notes.schema, 'machinespirits.tutor-stub.release-notes.v1');
  assert.equal(notes.relevantCommitCount, 6);
  assert.deepEqual(
    notes.groups.map((group) => [group.id, group.commits.length]),
    [
      ['dialogue_flow', 2],
      ['dramatic_delivery', 1],
      ['safe_recovery', 1],
      ['cli_experience', 1],
      ['validation', 1],
    ],
  );
  assert.match(notes.groups[0].effect, /credit an answered step/u);
  assert.match(notes.groups[1].lookFor, /one coherent voice/u);
  assert.match(notes.groups[4].effect, /do not directly change a tutor line/u);
});

test('release notes include generically named commits when they touch tutor-stub files', () => {
  const notes = buildTutorStubReleaseNotes([
    commit('77777777', 'refactor: simplify live inspection', ['services/tutorStubResponseGuard.js']),
    commit('88888888', 'docs: update paper', ['docs/research/paper-full-2.0.md']),
  ]);

  assert.equal(notes.relevantCommitCount, 1);
  assert.equal(notes.groups[0].id, 'other');
  assert.match(notes.groups[0].lookFor, /Open the named commit/u);
});

test('release note Git log parser retains commit metadata and changed files', () => {
  const commits = parseTutorStubGitLog(
    '@@@abcdef123456\tabcdef12\t2026-07-16T09:00:00+10:00\tfix(tutor-stub): keep context\n' +
      '\nservices/tutorStubResponseGuard.js\nscripts/tutor-stub.js\n' +
      '@@@fedcba654321\tfedcba65\t2026-07-16T08:00:00+10:00\tdocs: unrelated\n\ndocs/other.md',
  );

  assert.equal(commits.length, 2);
  assert.equal(commits[0].shortHash, 'abcdef12');
  assert.deepEqual(commits[0].files, ['services/tutorStubResponseGuard.js', 'scripts/tutor-stub.js']);
  assert.equal(commits[1].subject, 'docs: unrelated');
});

test('release note window defaults to 24 hours and rejects ambiguous values', () => {
  assert.equal(normalizeTutorStubReleaseNotesHours(''), 24);
  assert.equal(normalizeTutorStubReleaseNotesHours('48'), 48);
  assert.throws(() => normalizeTutorStubReleaseNotesHours('1.5'), /whole number/u);
  assert.throws(() => normalizeTutorStubReleaseNotesHours('200'), /whole number/u);
});

test('release notes explain a missing Git checkout in user-facing language', () => {
  assert.throws(
    () => loadTutorStubReleaseNotes({ cwd: '/definitely/not/a/git/checkout' }),
    /not running inside a readable Git checkout/u,
  );
});
