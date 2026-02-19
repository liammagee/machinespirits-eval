/**
 * Tests for contentResolver — validates that both bundled content packages
 * (philosophy 479 and elementary 101) load correctly and satisfy the eval
 * scenarios' content references.
 *
 * Run: node --test tests/contentResolver.test.js
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';
import fs from 'fs';

import * as contentResolver from '../services/contentResolver.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

// Content package paths
const PHILOSOPHY_CONTENT = path.join(REPO_ROOT, 'content');
const ELEMENTARY_CONTENT = path.join(REPO_ROOT, 'content-test-elementary');

// Load scenarios to check all content references
const SCENARIOS_PATH = path.join(REPO_ROOT, 'config', 'suggestion-scenarios.yaml');
const scenarios = yaml.parse(fs.readFileSync(SCENARIOS_PATH, 'utf-8'));

// Extract all current_content refs from scenarios
function extractContentRefs(scenarioConfig) {
  const refs = new Set();
  const scenarioList = scenarioConfig?.scenarios || scenarioConfig;
  for (const [, scenario] of Object.entries(scenarioList)) {
    if (scenario?.current_content) {
      refs.add(scenario.current_content);
    }
    // Multi-turn scenarios may have per-turn content
    if (Array.isArray(scenario?.turns)) {
      for (const turn of scenario.turns) {
        if (turn?.current_content) refs.add(turn.current_content);
      }
    }
  }
  return [...refs];
}

// ============================================================================
// Philosophy content (bundled 479)
// ============================================================================

describe('contentResolver — philosophy content (479)', () => {
  before(() => {
    contentResolver.configure({ contentPackagePath: PHILOSOPHY_CONTENT });
  });

  it('isConfigured() returns true', () => {
    assert.ok(contentResolver.isConfigured(), 'should be configured');
  });

  it('lists course 479', () => {
    const courses = contentResolver.listAvailableCourses();
    assert.ok(courses.includes('479'), `should include 479, got: ${courses}`);
  });

  it('loads course 479 metadata with title and objectives', () => {
    const meta = contentResolver.loadCourseMeta('479');
    assert.ok(meta, 'should load course.md frontmatter');
    assert.ok(meta.title, 'should have title');
    assert.ok(meta.instructor, 'should have instructor');
    assert.ok(Array.isArray(meta.objectives) && meta.objectives.length > 0, 'should have objectives');
  });

  it('loads all 8 lectures', () => {
    for (let i = 1; i <= 8; i++) {
      const raw = contentResolver.loadLecture(`479-lecture-${i}`);
      assert.ok(raw, `should load 479-lecture-${i}`);
      assert.ok(raw.length > 500, `479-lecture-${i} should have substantial content (got ${raw.length} chars)`);
    }
  });

  it('parses lecture markdown into slides', () => {
    const raw = contentResolver.loadLecture('479-lecture-3');
    const { slides } = contentResolver.parseLectureMarkdown(raw);
    assert.ok(slides.length > 1, `should have multiple slides, got ${slides.length}`);
  });

  it('resolves all scenario current_content references', () => {
    const refs = extractContentRefs(scenarios);
    const philosophy479Refs = refs.filter(r => r.startsWith('479-'));
    assert.ok(philosophy479Refs.length > 0, 'should have 479 refs in scenarios');

    for (const ref of philosophy479Refs) {
      const raw = contentResolver.loadLecture(ref);
      assert.ok(raw, `scenario ref "${ref}" should load`);
      assert.ok(raw.length > 100, `scenario ref "${ref}" should have content (${raw.length} chars)`);
    }
  });

  it('builds curriculum context for 479-lecture-3', () => {
    const ctx = contentResolver.buildCurriculumContext({ currentContent: '479-lecture-3' });
    assert.ok(ctx, 'should build context');
    assert.ok(ctx.includes('479'), 'should mention course 479');
    assert.ok(ctx.includes('[CURRENT]'), 'should mark current lecture');
    assert.ok(ctx.length > 1000, `context should be substantial (got ${ctx.length} chars)`);
  });

  it('resolveScenarioContent extracts current_content', () => {
    const result = contentResolver.resolveScenarioContent({
      current_content: '479-lecture-5',
    });
    assert.equal(result.currentContent, '479-lecture-5');
    assert.deepEqual(result.courseIds, ['479']);
  });

  it('resolveScenarioContent falls back to learner_context regex', () => {
    const result = contentResolver.resolveScenarioContent({
      learner_context: 'Currently viewing: 479-lecture-2\nSome other context',
    });
    assert.equal(result.currentContent, '479-lecture-2');
    assert.deepEqual(result.courseIds, ['479']);
  });

  it('validateContent returns no errors', () => {
    const errors = contentResolver.validateContent();
    assert.deepEqual(errors, [], `should have no errors, got: ${errors.join('; ')}`);
  });
});

// ============================================================================
// Elementary content (bundled 101)
// ============================================================================

describe('contentResolver — elementary content (101)', () => {
  before(() => {
    contentResolver.configure({ contentPackagePath: ELEMENTARY_CONTENT });
  });

  it('isConfigured() returns true', () => {
    assert.ok(contentResolver.isConfigured(), 'should be configured');
  });

  it('lists course 101', () => {
    const courses = contentResolver.listAvailableCourses();
    assert.ok(courses.includes('101'), `should include 101, got: ${courses}`);
  });

  it('loads course 101 metadata with title', () => {
    const meta = contentResolver.loadCourseMeta('101');
    assert.ok(meta, 'should load course.md frontmatter');
    assert.ok(meta.title, 'should have title');
    assert.ok(meta.instructor, 'should have instructor');
  });

  it('loads elementary lectures', () => {
    const raw = contentResolver.loadLecture('101-lecture-1');
    assert.ok(raw, 'should load 101-lecture-1');
    assert.ok(raw.length > 100, `should have content (got ${raw.length} chars)`);
  });

  it('builds curriculum context for 101-lecture-1', () => {
    const ctx = contentResolver.buildCurriculumContext({ currentContent: '101-lecture-1' });
    assert.ok(ctx, 'should build context');
    assert.ok(ctx.includes('101'), 'should mention course 101');
    assert.ok(ctx.includes('[CURRENT]'), 'should mark current lecture');
  });

  it('validateContent returns no errors', () => {
    const errors = contentResolver.validateContent();
    assert.deepEqual(errors, [], `should have no errors, got: ${errors.join('; ')}`);
  });
});

// ============================================================================
// Scenario coverage — verify no dangling content references
// ============================================================================

describe('contentResolver — scenario content coverage', () => {
  it('all scenario current_content refs point to existing content', () => {
    const refs = extractContentRefs(scenarios);
    assert.ok(refs.length > 0, 'should find content refs in scenarios');

    const missing = [];
    for (const ref of refs) {
      const parsed = ref.match(/^(\d+)-lecture-(\d+)$/);
      if (!parsed) {
        missing.push(`${ref} (invalid format)`);
        continue;
      }
      const courseId = parsed[1];

      // Determine which content package has this course
      let contentPath;
      if (courseId === '479') {
        contentPath = PHILOSOPHY_CONTENT;
      } else if (courseId === '101') {
        contentPath = ELEMENTARY_CONTENT;
      } else {
        // For courses not bundled (e.g. 480), just warn
        continue;
      }

      contentResolver.configure({ contentPackagePath: contentPath });
      const raw = contentResolver.loadLecture(ref);
      if (!raw) {
        missing.push(ref);
      }
    }

    assert.deepEqual(missing, [], `missing content for refs: ${missing.join(', ')}`);
  });

  it('480-lecture-3 ref is documented as not bundled', () => {
    // Scenario "adversarial_tester" references 480-lecture-3 which is in the
    // full content-philosophy package but not in the bundled subset.
    // This test documents the gap — it's acceptable because the eval falls
    // back gracefully when content is missing (no curriculum context).
    const refs = extractContentRefs(scenarios);
    const unbundled = refs.filter(r => !r.startsWith('479-') && !r.startsWith('101-'));
    if (unbundled.length > 0) {
      // Verify these refs are from course 480 only
      for (const ref of unbundled) {
        assert.match(ref, /^480-/, `unexpected unbundled ref: ${ref} (expected only 480-*)`);
      }
    }
  });
});
