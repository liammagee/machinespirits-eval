import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  projectTutorStubCurriculumPickerEntries,
  projectTutorStubCurriculumPickerLines,
  projectTutorStubLaunchModePickerLines,
  projectTutorStubScenarioPickerEntries,
  projectTutorStubScenarioPickerLines,
} from '../services/tutorStubPickerPresentation.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const colors = Object.freeze({
  bold: '<b>',
  brightYellow: '<y>',
  cyan: '<c>',
  dim: '<d>',
  reset: '</>',
});

test('scenario picker entry projection preserves family variants and custom defaults', () => {
  const base = Object.freeze({
    id: 'world-base',
    title: 'Base world',
    discipline: '',
    question: 'Base question?',
    setting: 'Base setting.',
    presentation: Object.freeze({ summary: 'Authored summary.' }),
  });
  const variant = Object.freeze({
    id: 'world-variant',
    title: 'Variant world',
    discipline: 'History',
    question: 'Variant question?',
    learnerVoice: 'Variant voice.',
  });
  const custom = Object.freeze({
    id: 'world-custom',
    title: 'Custom world',
    question: 'Custom question?',
    learnerVoice: 'Custom voice.',
  });
  const groupedEntries = Object.freeze([
    Object.freeze({ filePath: '/world-base.yaml', world: base, isVariant: false }),
    Object.freeze({ filePath: '/world-variant.yaml', world: variant, isVariant: true }),
  ]);
  const before = structuredClone(groupedEntries);
  const entries = projectTutorStubScenarioPickerEntries({
    groupedEntries,
    defaultBundle: Object.freeze({ filePath: '/custom.yaml', world: custom }),
  });

  assert.deepEqual(
    entries.map(({ id, title, discipline, description, filePath }) => ({
      id,
      title,
      discipline,
      description,
      filePath,
    })),
    [
      {
        id: 'world-custom',
        title: 'Custom world',
        discipline: 'Custom reasoning drama',
        description: 'Custom voice.',
        filePath: '/custom.yaml',
      },
      {
        id: 'world-base',
        title: 'Base world',
        discipline: 'Authored reasoning drama',
        description: 'Authored summary.',
        filePath: '/world-base.yaml',
      },
      {
        id: 'world-variant',
        title: '↳ Variant world',
        discipline: 'History',
        description: 'Variant question?',
        filePath: '/world-variant.yaml',
      },
    ],
  );
  assert.equal(entries[0].world, custom);
  assert.equal(entries[1].world, base);
  assert.deepEqual(groupedEntries, before);
});

test('curriculum picker entry projection joins public rows to authored modules without mutation', () => {
  const modules = Object.freeze([
    Object.freeze({ id: 'module-a', workplan_binding: Object.freeze({ declared_completion_verification: 'A' }) }),
  ]);
  const entries = Object.freeze([
    Object.freeze({ id: 'module-a', title: 'A' }),
    Object.freeze({ id: 'module-missing', title: 'Missing' }),
  ]);
  const projected = projectTutorStubCurriculumPickerEntries({ modules, entries });

  assert.equal(projected[0].module, modules[0]);
  assert.equal(projected[1].module, null);
  assert.deepEqual(entries, [
    { id: 'module-a', title: 'A' },
    { id: 'module-missing', title: 'Missing' },
  ]);
});

test('launch picker projection preserves selection, truncation, colors, and instructions', () => {
  const entries = Object.freeze([
    Object.freeze({
      id: 'chat',
      label: 'Mixed tutor chat',
      description: 'Open the default human and AI conversation.',
    }),
    Object.freeze({
      id: 'labelling-game',
      label: 'Labelling game',
      description: 'Human-label the deliberately long superego taxonomy or tutor-stub impasse corpus.',
    }),
  ]);
  const before = structuredClone(entries);
  const lines = projectTutorStubLaunchModePickerLines({ entries, selectedIndex: 1, columns: 58, colors });

  assert.deepEqual(lines, [
    '  Mixed tutor chat     Open the default human and AI...',
    '<c><b>› Labelling game       Human-label the deliberately ...</>',
    '<y><b>  launches ></> Labelling game',
    '<d>  ↑/↓ move · Enter launch · Esc quit · Mixed tutor chat is the default</>',
  ]);
  assert.equal(Object.isFrozen(lines), true);
  assert.deepEqual(entries, before);
});

test('scenario picker projection preserves viewport boundaries and selected detail', () => {
  const entries = Object.freeze([
    Object.freeze({ id: 'world_001', title: 'First', question: 'Q1?', description: 'S1', discipline: 'D1' }),
    Object.freeze({ id: 'world_002', title: 'Second', question: 'Q2?', description: 'S2', discipline: 'D2' }),
    Object.freeze({ id: 'world_003', title: 'Third', question: 'Q3?', description: 'S3', discipline: 'D3' }),
    Object.freeze({ id: 'world_004', title: 'Fourth', question: 'Q4?', description: 'S4', discipline: 'D4' }),
  ]);
  const lines = projectTutorStubScenarioPickerLines({
    entries,
    selectedIndex: 2,
    viewportStart: 1,
    viewportHeight: 2,
    columns: 100,
    colors,
  });

  assert.deepEqual(lines, [
    '<d>  ↑ 1 more</>',
    '  world_002                     Second',
    '<c><b>› world_003                     Third</>',
    '<d>  ↓ 1 more</>',
    '<y><b>  question ></> Q3?',
    '<d>  setting > S3</>',
    '<d>  discipline > D3</>',
  ]);
  assert.equal(Object.isFrozen(lines), true);
});

test('curriculum picker projection preserves state and optional verification detail', () => {
  const entries = Object.freeze([
    Object.freeze({
      id: 'module-a',
      title: 'First module',
      essentialQuestion: 'What changed?',
      priority: 'P1',
      status: 'active',
      owner: 'codex',
      module: Object.freeze({
        workplan_binding: Object.freeze({ declared_completion_verification: 'All checks pass.' }),
      }),
    }),
    Object.freeze({
      id: 'module-b',
      title: 'Second module',
      essentialQuestion: 'What remains?',
      module: null,
    }),
  ]);
  const selected = projectTutorStubCurriculumPickerLines({
    entries,
    selectedIndex: 0,
    viewportStart: 0,
    viewportHeight: 2,
    columns: 100,
    colors,
  });
  const sparse = projectTutorStubCurriculumPickerLines({
    entries,
    selectedIndex: 1,
    viewportStart: 0,
    viewportHeight: 2,
    columns: 100,
  });

  assert.deepEqual(selected, [
    '<d>  </>',
    '<c><b>› module-a                               First module</>',
    '  module-b                               Second module',
    '<d>  </>',
    '<y><b>  inquiry ></> What changed?',
    '<d>  state > P1 · active · codex</>',
    '<d>  verifies > All checks pass.</>',
  ]);
  assert.deepEqual(sparse.slice(-2), ['  inquiry > What remains?', '  state > open']);
  assert.equal(
    sparse.some((line) => line.includes('verifies >')),
    false,
  );
});

test('the CLI retains picker state, key handling, terminal writes, and entry ownership', () => {
  const source = fs.readFileSync(path.join(ROOT, 'scripts/tutor-stub.js'), 'utf8');
  const service = fs.readFileSync(path.join(ROOT, 'services/tutorStubPickerPresentation.js'), 'utf8');

  assert.match(source, /async function pickTutorStubLaunchModeWithKeyboard/u);
  assert.match(source, /async function pickInitialScenarioWithKeyboard/u);
  assert.match(source, /async function pickWorkplanModuleWithKeyboard/u);
  assert.match(source, /const moveSelection = \(delta\) =>/u);
  assert.match(source, /input\.on\('keypress', onKeypress\)/u);
  assert.match(source, /for \(const line of lines\) output\.write/u);
  assert.match(source, /groupedEntries: groupedWorldEntries\(\)/u);
  assert.match(source, /const bundle = loadTutorStubCurriculum\('workplan'/u);
  assert.doesNotMatch(service, /node:readline|process|console\.|output\.|input\./u);
});
