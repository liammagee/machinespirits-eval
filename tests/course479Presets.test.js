// FREEZE: the course-479 Tutor Lab concept presets. Each preset must name a
// frozen course479 profile, cite only real lecture IDs (and cite them in its
// own curriculum text), and actually run through the dialogue engine — the
// preset's learner picture must reach the model verbatim. Background:
// COURSE-479-PLAN.md; profile freeze: tests/course479ProfileSet.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PRESETS_PATH = path.join(REPO_ROOT, 'config', 'course-479-presets.yaml');
const LECTURE_ID_RE = /^479-lecture-[1-8]$/;
const REQUIRED_FIELDS = [
  'id',
  'title',
  'lecture_ids',
  'default_profile',
  'student_brief',
  'try_this',
  'learner_context',
  'curriculum_context',
  'opening_message',
];

const doc = parseYaml(fs.readFileSync(PRESETS_PATH, 'utf8'));
const tutorAgents = parseYaml(
  fs.readFileSync(path.join(REPO_ROOT, 'tutor-core', 'config', 'tutor-agents.yaml'), 'utf8'),
);

test('preset file shape: version, course, unique complete presets', () => {
  assert.equal(doc.version, '1.0');
  assert.equal(doc.course, '479');
  assert.ok(Array.isArray(doc.presets) && doc.presets.length >= 6, 'expected at least 6 presets');

  const ids = doc.presets.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length, 'preset ids must be unique');

  for (const preset of doc.presets) {
    for (const field of REQUIRED_FIELDS) {
      const value = preset[field];
      const empty =
        value == null || (typeof value === 'string' && !value.trim()) || (Array.isArray(value) && !value.length);
      assert.ok(!empty, `preset ${preset.id}: field ${field} missing or empty`);
    }
  }
});

test('every default_profile is a frozen course479 profile', () => {
  for (const preset of doc.presets) {
    assert.match(
      preset.default_profile,
      /^course479_/,
      `preset ${preset.id}: default profile must come from the frozen set`,
    );
    assert.ok(
      tutorAgents.profiles?.[preset.default_profile],
      `preset ${preset.id}: profile ${preset.default_profile} not in tutor-core config`,
    );
  }
});

test('lecture ids are real and cited in the preset own curriculum text', () => {
  for (const preset of doc.presets) {
    for (const lectureId of preset.lecture_ids) {
      assert.match(lectureId, LECTURE_ID_RE, `preset ${preset.id}: bad lecture id ${lectureId}`);
      assert.ok(
        preset.curriculum_context.includes(lectureId),
        `preset ${preset.id}: ${lectureId} not mentioned in its curriculum_context`,
      );
    }
  }
});

test('each preset runs through the dialogue engine and its learner picture reaches the model', async () => {
  const core = await import(path.join(REPO_ROOT, 'tutor-core', 'index.js'));
  const { setExternalAIProviderHook, clearExternalAIProviderHook } = await import(
    path.join(REPO_ROOT, 'tutor-core', 'services', 'externalAIProvider.js')
  );

  const logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'course479-presets-'));
  core.setLogDir(logDir);
  core.setQuietMode(true);

  try {
    for (const preset of doc.presets) {
      let egoSawLearnerContext = false;
      setExternalAIProviderHook({
        handles: (provider) => provider === 'stub',
        call: async (request) => {
          const isSuperego = request.messages
            .map((m) => m.content)
            .join('')
            .includes('Suggestions to Review');
          if (!isSuperego) {
            const allText = request.messages.map((m) => m.content).join('\n');
            // First line of the preset's learner picture must arrive verbatim.
            const firstLine = preset.learner_context.trim().split('\n')[0].trim();
            egoSawLearnerContext = allText.includes(firstLine);
          }
          return {
            text: isSuperego
              ? JSON.stringify({ approved: true, interventionType: 'none', feedback: 'ok', metrics: {} })
              : JSON.stringify([
                  { type: 'review', title: 'T', message: 'M', actionTarget: preset.lecture_ids[0], reasoning: 'R' },
                ]),
            model: request.model,
            provider: 'stub',
          };
        },
      });

      const profile = tutorAgents.profiles[preset.default_profile];
      const result = await core.runDialogue(
        {
          learnerContext: preset.learner_context,
          curriculumContext: preset.curriculum_context,
          simulationsContext: 'None.',
        },
        {
          profileName: preset.default_profile,
          egoModel: 'stub.m',
          superegoModel: profile.superego ? 'stub.m' : null,
        },
      );

      assert.ok(egoSawLearnerContext, `preset ${preset.id}: learner_context never reached the model`);
      assert.ok(
        Array.isArray(result.suggestions) && result.suggestions.length > 0,
        `preset ${preset.id}: dialogue produced no suggestions`,
      );
    }
  } finally {
    clearExternalAIProviderHook();
    fs.rmSync(logDir, { recursive: true, force: true });
  }
});
