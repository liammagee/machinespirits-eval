import { createHash } from 'node:crypto';

import {
  groupTutorStubWorldEntries,
  projectTutorStubWorldCatalogLines,
  tutorStubWorldFamilyKey,
  tutorStubWorldPickerSummary,
  tutorStubWorldPresentation,
} from '../services/tutorStubWorldPresentation.js';
import { assert, fs, path, ROOT, spawnSync, test } from './helpers/tutorStubInteractiveHarness.js';

const LIVE_WORLD_CATALOG_HASH = 'a7f97c026e1f19d18d56b3f061ecf51772a76c22fa2dc121df9a58d91dafd42c';

test('world presentation and picker summaries preserve authored and fallback semantics', () => {
  const presentation = { summary: 'Authored summary.', temporal_frame: 'contemporary' };
  assert.equal(tutorStubWorldPresentation({ presentation }), presentation);
  assert.deepEqual(tutorStubWorldPresentation(null), {});
  assert.equal(tutorStubWorldPickerSummary({ presentation }), 'Authored summary.');
  assert.equal(
    tutorStubWorldPickerSummary({ setting: '  First sentence.   Second sentence follows.  ', question: 'Fallback?' }),
    'First sentence.',
  );
  assert.equal(tutorStubWorldPickerSummary({ setting: '', question: 'Fallback question?' }), 'Fallback question?');
});

test('world catalogue projection preserves families, variants, tags, paths, order, and immutability', () => {
  const fixtureRoot = path.join(ROOT, 'fixture-root');
  const entries = [
    {
      filePath: path.join(fixtureRoot, 'worlds', 'base.yaml'),
      world: {
        id: 'world_base',
        title: 'The Base World',
        setting: 'A fallback setting. More detail.',
        presentation: { temporal_frame: 'period', narrative_diction: 'plain archival' },
      },
      isVariant: false,
      familySize: 2,
    },
    {
      filePath: path.join(fixtureRoot, 'worlds', 'variant.yaml'),
      world: { id: 'world_variant', title: 'The Variant' },
      isVariant: true,
      familySize: 2,
    },
    {
      filePath: path.join(fixtureRoot, 'worlds', 'solo.yaml'),
      world: { id: 'world_solo', title: 'The Solo World', question: 'What happened?' },
      isVariant: false,
      familySize: 1,
    },
  ];
  const before = structuredClone(entries);
  const lines = projectTutorStubWorldCatalogLines(entries, { root: fixtureRoot });

  assert.deepEqual(entries, before);
  assert.equal(Object.isFrozen(lines), true);
  assert.deepEqual(lines, [
    'world_base                             The Base World [period, plain archival] — family of 2',
    '  worlds/base.yaml',
    '  A fallback setting.',
    '  ↳ world_variant                      The Variant',
    'world_solo                             The Solo World',
    '  worlds/solo.yaml',
    '  What happened?',
  ]);
  assert.deepEqual(projectTutorStubWorldCatalogLines(), []);
});

test('world family grouping preserves family order, base selection, identity, and input immutability', () => {
  const variantFirst = { id: 'variant-first', presentation: { family: 'family-a', variant_of: 'base-a' } };
  const base = { id: 'base-a', presentation: { family: 'family-a' } };
  const variantLast = { id: 'variant-last', presentation: { family: 'family-a', variant_of: 'base-a' } };
  const variantOnly = { id: 'variant-only', presentation: { family: 'family-b', variant_of: 'missing-base' } };
  const entries = [
    { filePath: '/variant-first', world: variantFirst },
    { filePath: '/base', world: base },
    { filePath: '/variant-last', world: variantLast },
    { filePath: '/variant-only', world: variantOnly },
  ];
  const before = structuredClone(entries);
  const grouped = groupTutorStubWorldEntries(entries);

  assert.equal(tutorStubWorldFamilyKey(base), 'family-a');
  assert.equal(tutorStubWorldFamilyKey({ id: 'fallback' }), 'fallback');
  assert.deepEqual(
    grouped.map(({ world, isVariant, familySize }) => ({ id: world.id, isVariant, familySize })),
    [
      { id: 'base-a', isVariant: false, familySize: 3 },
      { id: 'variant-first', isVariant: true, familySize: 3 },
      { id: 'variant-last', isVariant: true, familySize: 3 },
      { id: 'variant-only', isVariant: false, familySize: 1 },
    ],
  );
  assert.equal(grouped[0].world, base);
  assert.equal(grouped[1].world, variantFirst);
  assert.deepEqual(entries, before);
  assert.deepEqual(groupTutorStubWorldEntries(), []);
});

test('the CLI retains world loading, grouping, and terminal ownership while live catalogue output stays byte-identical', () => {
  const cliSource = fs.readFileSync(path.join(ROOT, 'scripts', 'tutor-stub.js'), 'utf8');
  const serviceSource = fs.readFileSync(path.join(ROOT, 'services', 'tutorStubWorldPresentation.js'), 'utf8');
  const printSlice = cliSource.slice(
    cliSource.indexOf('function printWorlds'),
    cliSource.indexOf('\nfunction printCurriculumModules', cliSource.indexOf('function printWorlds')),
  );

  assert.match(printSlice, /groupedWorldEntries/u);
  assert.match(printSlice, /projectTutorStubWorldCatalogLines/u);
  assert.match(printSlice, /console\.log/u);
  assert.doesNotMatch(printSlice, /temporal_frame|narrative_diction|familyNote|worldPickerSummary/u);
  assert.doesNotMatch(serviceSource, /\b(?:console|fs|process|fetch)\s*\./u);

  const result = spawnSync(process.execPath, ['scripts/tutor-stub.js', '--list-worlds'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.equal(result.stdout.split('\n').length - 1, 71);
  assert.equal(Buffer.byteLength(result.stdout), 6670);
  assert.equal(createHash('sha256').update(result.stdout).digest('hex'), LIVE_WORLD_CATALOG_HASH);
});
