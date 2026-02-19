/**
 * Content Resolver
 *
 * Loads actual course content (markdown lectures) from the content package
 * repo on disk, builds structured curriculum context strings, and provides
 * them to tutorApi.buildContext() so the tutor can give content-specific
 * responses during evaluations.
 *
 * Uses mtime-based caching (same pattern as evalConfigLoader).
 */

import fs from 'fs';
import path from 'path';

// ── Configuration ──────────────────────────────────────────────────────────────

let contentPackagePath = null;
let maxLectureChars = 50000;
let includeSpeakerNotes = true;

// ── Caches (mtime-based) ──────────────────────────────────────────────────────

/** @type {Map<string, {data: any, mtime: number}>} */
const courseMetaCache = new Map();
/** @type {Map<string, {data: string, mtime: number}>} */
const lectureRawCache = new Map();

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Set the content package root directory.
 *
 * @param {Object} opts
 * @param {string} opts.contentPackagePath - Absolute or eval-relative path
 * @param {number} [opts.maxLectureChars]
 * @param {boolean} [opts.includeSpeakerNotes]
 */
export function configure(opts) {
  if (opts.contentPackagePath) {
    contentPackagePath = opts.contentPackagePath;
  }
  if (opts.maxLectureChars != null) {
    maxLectureChars = opts.maxLectureChars;
  }
  if (opts.includeSpeakerNotes != null) {
    includeSpeakerNotes = opts.includeSpeakerNotes;
  }
}

/**
 * Whether the resolver is configured and the content directory exists.
 */
export function isConfigured() {
  if (!contentPackagePath) return false;
  try {
    return fs.statSync(path.join(contentPackagePath, 'courses')).isDirectory();
  } catch {
    return false;
  }
}

// ── Course Metadata ───────────────────────────────────────────────────────────

/**
 * Parse YAML frontmatter from a course.md file.
 *
 * @param {string} courseId - e.g. "479"
 * @returns {Object|null} Parsed frontmatter object
 */
export function loadCourseMeta(courseId) {
  if (!contentPackagePath) return null;

  const filePath = path.join(contentPackagePath, 'courses', courseId, 'course.md');

  try {
    const stats = fs.statSync(filePath);
    const cached = courseMetaCache.get(courseId);
    if (cached && cached.mtime === stats.mtimeMs) {
      return cached.data;
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const meta = parseFrontmatter(raw);
    courseMetaCache.set(courseId, { data: meta, mtime: stats.mtimeMs });
    return meta;
  } catch {
    return null;
  }
}

// ── Lecture Loading ───────────────────────────────────────────────────────────

/**
 * Load a lecture's raw markdown content.
 *
 * @param {string} lectureRef - e.g. "479-lecture-3"
 * @returns {string|null} Raw markdown text
 */
export function loadLecture(lectureRef) {
  if (!contentPackagePath) return null;

  const parsed = parseLectureRef(lectureRef);
  if (!parsed) return null;

  const filePath = path.join(contentPackagePath, 'courses', parsed.courseId, `lecture-${parsed.lectureNum}.md`);

  try {
    const stats = fs.statSync(filePath);
    const cached = lectureRawCache.get(lectureRef);
    if (cached && cached.mtime === stats.mtimeMs) {
      return cached.data;
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    lectureRawCache.set(lectureRef, { data: raw, mtime: stats.mtimeMs });
    return raw;
  } catch {
    return null;
  }
}

/**
 * Parse lecture markdown into slides and speaker notes.
 *
 * @param {string} raw - Raw markdown content
 * @returns {{ slides: string[], notes: string[] }}
 */
export function parseLectureMarkdown(raw) {
  // Split on slide delimiter (--- on its own line)
  const slides = raw
    .split(/\n---\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  const notes = [];
  const contentSlides = [];

  for (const slide of slides) {
    // Extract ```notes ... ``` blocks
    const noteMatch = slide.match(/```notes\s*\n([\s\S]*?)```/);
    if (noteMatch) {
      notes.push(noteMatch[1].trim());
    }
    contentSlides.push(slide);
  }

  return { slides: contentSlides, notes };
}

// ── Curriculum Context Builder ────────────────────────────────────────────────

/**
 * Build the formatted curriculum context string that gets passed to
 * tutorApi.buildContext() as the second argument.
 *
 * @param {Object} opts
 * @param {string|null} opts.currentContent - Lecture ref, e.g. "479-lecture-3"
 * @param {string[]} [opts.courseIds] - Course IDs to include (derived from currentContent if omitted)
 * @returns {string|null}
 */
export function buildCurriculumContext(opts = {}) {
  if (!isConfigured()) return null;

  const { currentContent = null, courseIds: explicitCourseIds } = opts;

  // Determine course IDs to include
  let courseIds = explicitCourseIds;
  if (!courseIds && currentContent) {
    const parsed = parseLectureRef(currentContent);
    if (parsed) courseIds = [parsed.courseId];
  }
  if (!courseIds || courseIds.length === 0) {
    console.warn(
      '[contentResolver] No course hint provided (missing current_content or course_ids on scenario) — skipping curriculum context',
    );
    return null;
  }

  const parts = [];

  for (const courseId of courseIds) {
    const meta = loadCourseMeta(courseId);
    if (!meta) continue;

    // Course overview
    parts.push(`## Course: EPOL ${courseId} - ${meta.title || courseId}`);
    if (meta.instructor)
      parts.push(`Instructor: ${meta.instructor}${meta.semester ? ` | Semester: ${meta.semester}` : ''}`);
    if (meta.description) parts.push(`Description: ${meta.description.trim()}`);
    if (meta.objectives?.length) {
      parts.push('Objectives:');
      for (const obj of meta.objectives) {
        parts.push(`- ${obj}`);
      }
    }

    // Lecture listing
    const lectures = listCourseLectures(courseId);
    if (lectures.length > 0) {
      parts.push('');
      parts.push('### Lecture Overview');
      for (let i = 0; i < lectures.length; i++) {
        const ref = `${courseId}-lecture-${i + 1}`;
        const title = getLectureTitle(courseId, i + 1) || `Lecture ${i + 1}`;
        const marker = ref === currentContent ? ' **[CURRENT]**' : '';
        parts.push(`${i + 1}. ${title} (${ref})${marker}`);
      }
    }
  }

  // Current lecture full content
  if (currentContent) {
    const raw = loadLecture(currentContent);
    if (raw) {
      parts.push('');
      parts.push('---');
      parts.push('');
      parts.push(`## Current Lecture Content: ${currentContent}`);
      parts.push('');

      let lectureText = raw;

      // Optionally strip speaker notes
      if (!includeSpeakerNotes) {
        lectureText = lectureText.replace(/```notes\s*\n[\s\S]*?```/g, '');
      }

      // Apply character limit
      if (lectureText.length > maxLectureChars) {
        lectureText = lectureText.slice(0, maxLectureChars) + '\n\n[... truncated for token budget ...]';
      }

      parts.push(lectureText);
    }
  }

  const result = parts.join('\n');
  return result || null;
}

// ── Scenario Content Resolution ───────────────────────────────────────────────

/**
 * Extract the content reference for a scenario.
 *
 * Looks for:
 *   1. `scenario.current_content` (explicit field)
 *   2. Regex match "Currently viewing: XXX-lecture-N" in learner_context
 *
 * @param {Object} scenario
 * @returns {{ currentContent: string|null, courseIds: string[] }}
 */
export function resolveScenarioContent(scenario) {
  let currentContent = scenario?.current_content || null;

  // Fallback: extract from learner_context text
  if (!currentContent && scenario?.learner_context) {
    const match = scenario.learner_context.match(/Currently viewing[:\s]*(\d+-lecture-\d+)/i);
    if (match) {
      currentContent = match[1];
    }
  }

  // Derive courseIds: explicit scenario field takes priority, then derive from currentContent
  const courseIds = scenario?.course_ids ? [...scenario.course_ids] : [];
  if (currentContent) {
    const parsed = parseLectureRef(currentContent);
    if (parsed && !courseIds.includes(parsed.courseId)) {
      courseIds.push(parsed.courseId);
    }
  }

  return { currentContent, courseIds };
}

// ── Discovery ─────────────────────────────────────────────────────────────────

/**
 * List all available course IDs by scanning the courses/ directory.
 *
 * @returns {string[]}
 */
export function listAvailableCourses() {
  if (!contentPackagePath) return [];

  const coursesDir = path.join(contentPackagePath, 'courses');
  try {
    return fs.readdirSync(coursesDir).filter((name) => {
      const courseDir = path.join(coursesDir, name);
      return fs.statSync(courseDir).isDirectory() && fs.existsSync(path.join(courseDir, 'course.md'));
    });
  } catch {
    return [];
  }
}

/**
 * Validate all content can load. Returns errors (empty array = OK).
 *
 * @returns {string[]} Array of error messages
 */
export function validateContent() {
  const errors = [];

  if (!isConfigured()) {
    errors.push(`Content package not configured or not found at: ${contentPackagePath || '(not set)'}`);
    return errors;
  }

  const courses = listAvailableCourses();
  if (courses.length === 0) {
    errors.push('No courses found in content package');
    return errors;
  }

  for (const courseId of courses) {
    const meta = loadCourseMeta(courseId);
    if (!meta) {
      errors.push(`Course ${courseId}: failed to load course.md frontmatter`);
      continue;
    }
    if (!meta.title) {
      errors.push(`Course ${courseId}: missing title in frontmatter`);
    }

    const lectures = listCourseLectures(courseId);
    for (let i = 0; i < lectures.length; i++) {
      const ref = `${courseId}-lecture-${i + 1}`;
      const raw = loadLecture(ref);
      if (!raw) {
        errors.push(`Lecture ${ref}: failed to load`);
      } else if (raw.length < 50) {
        errors.push(`Lecture ${ref}: suspiciously short (${raw.length} chars)`);
      }
    }
  }

  return errors;
}

// ── Internal Helpers ──────────────────────────────────────────────────────────

import yaml from 'yaml';

/**
 * Parse YAML frontmatter delimited by --- from a markdown file.
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  try {
    return yaml.parse(match[1]);
  } catch {
    return null;
  }
}

/**
 * Parse a lecture reference like "479-lecture-3" into components.
 */
function parseLectureRef(ref) {
  const match = ref.match(/^(\d+)-lecture-(\d+)$/);
  if (!match) return null;
  return { courseId: match[1], lectureNum: match[2] };
}

/**
 * List lecture files for a course (sorted numerically).
 */
function listCourseLectures(courseId) {
  if (!contentPackagePath) return [];
  const courseDir = path.join(contentPackagePath, 'courses', courseId);
  try {
    return fs
      .readdirSync(courseDir)
      .filter((f) => /^lecture-\d+\.md$/.test(f))
      .sort((a, b) => {
        const na = parseInt(a.match(/\d+/)[0], 10);
        const nb = parseInt(b.match(/\d+/)[0], 10);
        return na - nb;
      });
  } catch {
    return [];
  }
}

/**
 * Get the title of a lecture by reading its first heading.
 */
function getLectureTitle(courseId, lectureNum) {
  const ref = `${courseId}-lecture-${lectureNum}`;
  const raw = loadLecture(ref);
  if (!raw) return null;

  // Look for first ## or # heading
  const match = raw.match(/^#{1,2}\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

export default {
  configure,
  isConfigured,
  loadCourseMeta,
  loadLecture,
  parseLectureMarkdown,
  buildCurriculumContext,
  resolveScenarioContent,
  listAvailableCourses,
  validateContent,
};
