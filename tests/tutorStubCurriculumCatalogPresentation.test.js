import { createHash } from 'node:crypto';

import { projectTutorStubCurriculumCatalogLines } from '../services/curriculum/tutorStubCurriculumCatalogPresentation.js';
import { assert, fs, path, ROOT, spawnSync, test } from './helpers/tutorStubInteractiveHarness.js';

const LIVE_CATALOG_HASH = 'ded71f142f94e2960d289b988b0930bf5356c332b9fc831303be25e1b1aaacf7';

test('curriculum catalogue projection preserves headers, optional state, ordering, and immutability', () => {
  const input = {
    curriculum: { id: 'course', title: 'Evidence Course' },
    sourceRef: 'curriculum/evidence.yaml',
  };
  const modules = [
    { id: 'M1', title: 'Claims', priority: 'P1', status: 'active', owner: 'codex' },
    { id: 'M2', title: 'Warrants', priority: null, status: 'triaged', owner: null },
    { id: 'M3', title: 'Counterexamples', priority: null, status: null, owner: null },
  ];
  const before = structuredClone(input);
  const modulesBefore = structuredClone(modules);
  const lines = projectTutorStubCurriculumCatalogLines(input, modules);

  assert.deepEqual(input, before, 'presentation must not mutate public catalogue data');
  assert.deepEqual(modules, modulesBefore, 'presentation must not mutate public module data');
  assert.equal(Object.isFrozen(lines), true);
  assert.deepEqual(lines, [
    'Evidence Course (course)',
    '  source: curriculum/evidence.yaml',
    '  M1  [P1 · active · codex]',
    '    Claims',
    '  M2  [triaged]',
    '    Warrants',
    '  M3',
    '    Counterexamples',
  ]);
  assert.deepEqual(
    projectTutorStubCurriculumCatalogLines({
      curriculum: { id: 'empty', title: 'Empty Course' },
      sourceRef: 'workplan:live',
    }),
    ['Empty Course (empty)', '  source: workplan:live'],
  );
  assert.deepEqual(projectTutorStubCurriculumCatalogLines(), []);
});

test('the CLI retains catalogue loading and terminal ownership while canonical output stays byte-identical', () => {
  const cliSource = fs.readFileSync(path.join(ROOT, 'scripts', 'tutor-stub.js'), 'utf8');
  const serviceSource = fs.readFileSync(
    path.join(ROOT, 'services', 'curriculum', 'tutorStubCurriculumCatalogPresentation.js'),
    'utf8',
  );
  const catalogSlice = cliSource.slice(
    cliSource.indexOf('function printCurriculumModules'),
    cliSource.indexOf('\nfunction printAutomatedLearnerProfiles', cliSource.indexOf('function printCurriculumModules')),
  );

  assert.match(catalogSlice, /loadTutorStubCurriculum/u);
  assert.match(catalogSlice, /listTutorStubCurriculumModules/u);
  assert.match(catalogSlice, /projectTutorStubCurriculumCatalogLines/u);
  assert.match(catalogSlice, /console\.log/u);
  assert.doesNotMatch(catalogSlice, /\.priority|\.status|\.owner|source:/u);
  assert.doesNotMatch(serviceSource, /\b(?:console|fs|path|process|fetch)\s*\./u);

  const result = spawnSync(
    process.execPath,
    ['scripts/tutor-stub.js', '--list-curriculum-modules', '--curriculum', 'curriculum/ai-foundations.curriculum.yaml'],
    { cwd: ROOT, encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.equal(result.stdout.split('\n').length - 1, 28);
  assert.equal(Buffer.byteLength(result.stdout), 852);
  assert.equal(createHash('sha256').update(result.stdout).digest('hex'), LIVE_CATALOG_HASH);
});
