import { createHash } from 'node:crypto';

import { projectTutorStubCurriculumProgressLines } from '../services/curriculum/tutorStubCurriculumProgressPresentation.js';
import { assert, fs, path, plainTerminalText, ROOT, spawnSync, test } from './helpers/tutorStubInteractiveHarness.js';

const COLORS = { brightCyan: '<cyan>', bold: '<bold>', dim: '<dim>', reset: '</>' };
const LIVE_PROGRESS_HASH = '5256a00d8ff9926ab9f94234ba8db7ed09579ef4627d330bab205e005396d894';

function progressFixture() {
  return {
    curriculum: { id: 'course', title: 'Evidence Course' },
    currentModule: { id: 'M2' },
    currentPhase: 'independent_check',
    currentPhaseEvidenceCount: 1,
    completionAuthority: 'external_workplan_verification_only',
    modules: [
      {
        id: 'M1',
        title: 'Claims',
        status: 'mastered',
        available: true,
        missingPrerequisiteModuleIds: [],
        phaseEvidenceCounts: { diagnostic: 1, scaffold: 1, independent_check: 1, transfer: 1 },
      },
      {
        id: 'M2',
        title: 'Warrants',
        status: 'in_progress',
        available: true,
        missingPrerequisiteModuleIds: [],
        phaseEvidenceCounts: { diagnostic: 1, scaffold: 2, independent_check: 1, transfer: 0 },
      },
      {
        id: 'M3',
        title: 'Counterexamples',
        status: 'not_started',
        available: false,
        missingPrerequisiteModuleIds: ['M2', 'M0'],
        phaseEvidenceCounts: { diagnostic: 0, scaffold: 0, independent_check: 0, transfer: 0 },
      },
    ],
  };
}

test('curriculum progress projection preserves ordering, markers, evidence, locks, authority, colors, and immutability', () => {
  const progress = progressFixture();
  const before = structuredClone(progress);
  const lines = projectTutorStubCurriculumProgressLines(progress, { colors: COLORS });

  assert.deepEqual(progress, before, 'presentation must not mutate the public progress projection');
  assert.equal(Object.isFrozen(lines), true);
  assert.deepEqual(lines, [
    '<cyan><bold>course progress ></> Evidence Course',
    '  ✓ M1 · Claims · mastered · 4 evidence turns',
    '  ◆ M2 · Warrants · in_progress · 4 evidence turns',
    '  ◇ M3 · Counterexamples · not_started · 0 evidence turns · waiting for M2, M0',
    '<dim>  current phase: independent check · 1 evidence turn</>',
    '<dim>  /next advances attempted diagnostic/scaffold work; independent check and transfer require /next pass or /next revise</>',
    '<dim>  dialogue progress never completes or closes the external workplan item</>',
    '',
  ]);
});

test('curriculum progress projection preserves unavailable and session-authority branches', () => {
  assert.deepEqual(projectTutorStubCurriculumProgressLines(null, { colors: COLORS }), [
    '<dim>curriculum progress is available only in a curriculum session</>\n',
  ]);

  const progress = progressFixture();
  progress.completionAuthority = 'session_mastery_only';
  progress.currentPhaseEvidenceCount = 2;
  const lines = projectTutorStubCurriculumProgressLines(progress);
  assert.equal(lines.at(-3), '  current phase: independent check · 2 evidence turns');
  assert.equal(
    lines.some((line) => line.includes('external workplan item')),
    false,
  );
  assert.equal(lines.at(-1), '');
});

test('the CLI retains public projection, return values, and terminal ownership while live /progress stays byte-identical', () => {
  const cliSource = fs.readFileSync(path.join(ROOT, 'scripts', 'tutor-stub.js'), 'utf8');
  const serviceSource = fs.readFileSync(
    path.join(ROOT, 'services', 'curriculum', 'tutorStubCurriculumProgressPresentation.js'),
    'utf8',
  );
  const compositionSource = fs.readFileSync(
    path.join(ROOT, 'services', 'tutorStubInteractiveApplicationComposition.js'),
    'utf8',
  );
  const controllerSource = fs.readFileSync(
    path.join(ROOT, 'services', 'tutorStubInteractiveSessionController.js'),
    'utf8',
  );
  const progressSlice = controllerSource.slice(
    controllerSource.indexOf('function printCurriculumProgress'),
    controllerSource.indexOf(
      '\n  function activateCurriculumModule',
      controllerSource.indexOf('function printCurriculumProgress'),
    ),
  );

  assert.match(cliSource, /createTutorStubInteractiveApplicationComposition/u);
  assert.match(compositionSource, /createTutorStubInteractiveSessionController/u);
  assert.match(progressSlice, /curriculumProgressSnapshot/u);
  assert.match(progressSlice, /projectTutorStubCurriculumProgressLines/u);
  assert.match(progressSlice, /console\.log/u);
  assert.match(progressSlice, /return progress/u);
  assert.doesNotMatch(progressSlice, /course progress|evidence turn|completionAuthority|missingPrerequisiteModuleIds/u);
  assert.doesNotMatch(serviceSource, /\b(?:console|fs|process|fetch)\s*\./u);

  const result = spawnSync(
    process.execPath,
    [
      'scripts/tutor-stub.js',
      '--model',
      'codex.gpt-5.6-terra',
      '--no-opening',
      '--no-closeout-report',
      '--no-interim-animation',
      '--no-stream',
      '--no-trace',
      '--no-remember-settings',
      '--curriculum',
      'curriculum/ai-foundations.curriculum.yaml',
      '--module',
      'AF1',
    ],
    {
      cwd: ROOT,
      encoding: 'utf8',
      input: '/progress\n/quit\n',
      env: { ...process.env, TUTOR_STUB_REMEMBER_SETTINGS: '0' },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  const plain = plainTerminalText(result.stdout);
  const report = plain.slice(plain.indexOf('course progress >')).trimEnd();
  assert.notEqual(plain.indexOf('course progress >'), -1, plain);
  assert.equal(report.split('\n').length, 16);
  assert.equal(Buffer.byteLength(report), 1740);
  assert.equal(createHash('sha256').update(report).digest('hex'), LIVE_PROGRESS_HASH);
});
