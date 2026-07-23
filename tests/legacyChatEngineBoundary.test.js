import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { loadTutorAgents } from '../services/evalConfigLoader.js';
import {
  LEGACY_CHAT_ENGINE_ID,
  LEGACY_CHAT_ENGINE_SCHEMA,
  LEGACY_CHAT_REPRESENTATIVE_CELLS,
  loadCurriculumContext,
  loadPromptFile,
  runTutorTurn,
} from '../services/legacyChatEngine.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('legacy chat has one named domain boundary for non-route consumers', () => {
  assert.equal(LEGACY_CHAT_ENGINE_SCHEMA, 'machinespirits.legacy-chat-engine.v1');
  assert.equal(LEGACY_CHAT_ENGINE_ID, 'cell_lab');
  assert.equal(typeof runTutorTurn, 'function');
  assert.equal(typeof loadCurriculumContext, 'function');
  assert.equal(typeof loadPromptFile, 'function');

  for (const relativePath of ['services/pilotAutoplay.js', 'services/poetics/liveCompose.js']) {
    const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    assert.match(source, /legacyChatEngine\.js/u, `${relativePath} must use the domain entrypoint`);
    assert.doesNotMatch(source, /routes\/chatRoutes\.js/u, `${relativePath} must not import the Express route`);
  }

  const routeSource = fs.readFileSync(path.join(ROOT, 'routes/chatRoutes.js'), 'utf8');
  assert.match(routeSource, /services\/legacyChatPromptLoader\.js/u);
  assert.doesNotMatch(routeSource, /function loadPromptFile\(/u);
});

test('representative cell_lab profiles freeze the extraction compatibility matrix', () => {
  assert.deepEqual(LEGACY_CHAT_REPRESENTATIVE_CELLS, [
    'cell_1_base_single_unified',
    'cell_7_recog_multi_unified',
    'cell_86_messages_recog_multi_unified',
    'cell_107_id_director_witness_exemplars',
  ]);
  const profiles = loadTutorAgents({ forceReload: true })?.profiles || {};
  const observed = Object.fromEntries(
    LEGACY_CHAT_REPRESENTATIVE_CELLS.map((id) => {
      const profile = profiles[id];
      assert.ok(profile, `missing representative legacy chat profile: ${id}`);
      return [
        id,
        {
          hasSuperego: Boolean(profile.superego),
          promptType: profile.factors?.prompt_type || null,
          conversationMode: profile.conversation_mode || null,
          idDirector: profile.factors?.id_director === true,
        },
      ];
    }),
  );
  assert.deepEqual(observed, {
    cell_1_base_single_unified: {
      hasSuperego: false,
      promptType: 'base',
      conversationMode: null,
      idDirector: false,
    },
    cell_7_recog_multi_unified: {
      hasSuperego: true,
      promptType: 'recognition',
      conversationMode: null,
      idDirector: false,
    },
    cell_86_messages_recog_multi_unified: {
      hasSuperego: true,
      promptType: 'recognition',
      conversationMode: 'messages',
      idDirector: false,
    },
    cell_107_id_director_witness_exemplars: {
      hasSuperego: true,
      promptType: 'base',
      conversationMode: null,
      idDirector: true,
    },
  });
});

test('legacy prompt and curriculum loaders preserve both source families', () => {
  assert.match(loadPromptFile('tutor-ego.md'), /tutor/iu);

  const lecture = loadCurriculumContext('1001-lecture-1');
  assert.equal(lecture?.kind, 'lecture');
  assert.equal(lecture?.sourceRef, '1001-lecture-1');
  assert.ok(lecture?.text);
  assert.doesNotMatch(lecture.text, /```notes/u);

  const drama = loadCurriculumContext({ curriculumRef: 'drama:rhetorical#D_AF1_CURRICULUM_ADAPTIVE' });
  assert.equal(drama?.kind, 'rhetorical_drama');
  assert.equal(drama?.moduleId, 'AF1');
  assert.ok(drama?.directorSeed);
});
