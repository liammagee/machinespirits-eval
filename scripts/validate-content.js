#!/usr/bin/env node

/**
 * Content Validation CLI
 *
 * Validates that the content package is accessible and all lectures load
 * correctly. Also previews parsed content for debugging.
 *
 * Usage:
 *   node scripts/validate-content.js                        # Validate all content
 *   node scripts/validate-content.js --lecture 479-lecture-3 # Show parsed lecture
 *   node scripts/validate-content.js --preview 479-lecture-3 # Show full curriculum context
 *   node scripts/validate-content.js --scenarios             # Check all scenarios' content refs
 */

import * as contentResolver from '../services/contentResolver.js';
import * as evalConfigLoader from '../services/evalConfigLoader.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

function initContentResolver() {
  const contentConfig = evalConfigLoader.getContentConfig();
  if (!contentConfig?.content_package_path) {
    console.error('Error: No content.content_package_path in config/eval-settings.yaml');
    process.exit(1);
  }

  contentResolver.configure({
    contentPackagePath: contentConfig.content_package_path,
    maxLectureChars: contentConfig.max_lecture_chars,
    includeSpeakerNotes: contentConfig.include_speaker_notes,
  });

  if (!contentResolver.isConfigured()) {
    console.error(`Error: Content directory not found at: ${contentConfig.content_package_path}`);
    process.exit(1);
  }

  return contentConfig;
}

// ── Commands ──────────────────────────────────────────────────────────────────

function validateAll() {
  const config = initContentResolver();
  console.log(`Content package: ${config.content_package_path}`);
  console.log('');

  const courses = contentResolver.listAvailableCourses();
  console.log(`Found ${courses.length} course(s): ${courses.join(', ')}`);
  console.log('');

  for (const courseId of courses) {
    const meta = contentResolver.loadCourseMeta(courseId);
    if (meta) {
      console.log(`  [${courseId}] ${meta.title || '(no title)'}`);
      if (meta.instructor) console.log(`         Instructor: ${meta.instructor}`);
      if (meta.objectives?.length) console.log(`         Objectives: ${meta.objectives.length}`);
    } else {
      console.log(`  [${courseId}] ERROR: could not load course.md`);
    }
  }

  console.log('');
  const errors = contentResolver.validateContent();
  if (errors.length === 0) {
    console.log('Validation PASSED - all content loads correctly.');
  } else {
    console.log(`Validation FAILED - ${errors.length} error(s):`);
    for (const err of errors) {
      console.log(`  - ${err}`);
    }
    process.exit(1);
  }
}

function showLecture(lectureRef) {
  initContentResolver();

  const raw = contentResolver.loadLecture(lectureRef);
  if (!raw) {
    console.error(`Error: Could not load lecture "${lectureRef}"`);
    process.exit(1);
  }

  const parsed = contentResolver.parseLectureMarkdown(raw);
  console.log(`Lecture: ${lectureRef}`);
  console.log(`Total characters: ${raw.length}`);
  console.log(`Slides: ${parsed.slides.length}`);
  console.log(`Speaker notes blocks: ${parsed.notes.length}`);
  console.log('');

  for (let i = 0; i < parsed.slides.length; i++) {
    const slide = parsed.slides[i];
    const preview = slide.slice(0, 120).replace(/\n/g, ' ');
    console.log(`  Slide ${i + 1}: ${preview}${slide.length > 120 ? '...' : ''}`);
  }

  if (parsed.notes.length > 0) {
    console.log('');
    console.log('Speaker Notes:');
    for (let i = 0; i < parsed.notes.length; i++) {
      const preview = parsed.notes[i].slice(0, 100).replace(/\n/g, ' ');
      console.log(`  [${i + 1}] ${preview}${parsed.notes[i].length > 100 ? '...' : ''}`);
    }
  }
}

function previewCurriculum(lectureRef) {
  initContentResolver();

  const context = contentResolver.buildCurriculumContext({
    currentContent: lectureRef,
  });

  if (!context) {
    console.error(`Error: Could not build curriculum context for "${lectureRef}"`);
    process.exit(1);
  }

  console.log(`Curriculum context for: ${lectureRef}`);
  console.log(`Total characters: ${context.length}`);
  console.log('='.repeat(80));
  console.log(context);
  console.log('='.repeat(80));
}

function checkScenarios() {
  initContentResolver();

  const scenarios = evalConfigLoader.listScenarios();
  console.log(`Checking ${scenarios.length} scenario(s) for content references...\n`);

  let resolved = 0;
  let unresolved = 0;
  let noContent = 0;

  for (const scenarioMeta of scenarios) {
    const scenario = evalConfigLoader.getScenario(scenarioMeta.id);
    const { currentContent } = contentResolver.resolveScenarioContent(scenario);

    if (currentContent) {
      const raw = contentResolver.loadLecture(currentContent);
      if (raw) {
        console.log(`  [OK]   ${scenarioMeta.id} → ${currentContent} (${raw.length} chars)`);
        resolved++;
      } else {
        console.log(`  [FAIL] ${scenarioMeta.id} → ${currentContent} (NOT FOUND)`);
        unresolved++;
      }
    } else {
      console.log(`  [NONE] ${scenarioMeta.id} → no content reference (will use course overview only)`);
      noContent++;
    }
  }

  console.log('');
  console.log(`Results: ${resolved} resolved, ${unresolved} failed, ${noContent} no content ref`);

  if (unresolved > 0) {
    process.exit(1);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`Usage:
  node scripts/validate-content.js                        # Validate all content
  node scripts/validate-content.js --lecture 479-lecture-3 # Show parsed lecture
  node scripts/validate-content.js --preview 479-lecture-3 # Show full curriculum context
  node scripts/validate-content.js --scenarios             # Check all scenarios' content refs`);
  process.exit(0);
}

if (args.includes('--lecture')) {
  const idx = args.indexOf('--lecture');
  const ref = args[idx + 1];
  if (!ref) {
    console.error('Missing lecture ref');
    process.exit(1);
  }
  showLecture(ref);
} else if (args.includes('--preview')) {
  const idx = args.indexOf('--preview');
  const ref = args[idx + 1];
  if (!ref) {
    console.error('Missing lecture ref');
    process.exit(1);
  }
  previewCurriculum(ref);
} else if (args.includes('--scenarios')) {
  checkScenarios();
} else {
  validateAll();
}
