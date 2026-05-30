import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';

import { resolvePromptPath, EVAL_PROMPTS_DIR, createLocalPromptLoader } from '../localPromptLoader.js';
import * as learnerConfig from '../learnerConfigLoader.js';

// ============================================================================
// Regression guard for the learner (and tutor) ego/superego prompt-loading bug.
//
// THE BUG: prompts referenced by `prompt_file` in config/learner-agents.yaml were
// resolved against tutor-core's bundled prompts/ dir (inside node_modules), NOT
// this repo's prompts/. So a learner prompt edited here never took effect, and a
// file MISSING from tutor-core (e.g. learner-superego-recognition-authentic.md was
// absent from the eval repo) silently fell through to a generic
// "You are simulating part of a learner's internal experience. (Prompt file ...
// not found)" default. The Oedipus learner superego that actually ran was a
// tutor-core file we were not even reading.
//
// THE FIX: localPromptLoader resolves eval/prompts FIRST, and every configured
// prompt now exists locally (complete superset). These tests fail loudly if either
// property regresses — including if a concurrent tutor-core→eval refactor drops a
// file or re-points the loader.
// ============================================================================

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const LEARNER_AGENTS_YAML = path.join(REPO_ROOT, 'config', 'learner-agents.yaml');

// Recursively collect every `prompt_file:` value declared anywhere in the config.
function collectPromptFiles(node, acc = new Set()) {
  if (!node || typeof node !== 'object') return acc;
  if (Array.isArray(node)) {
    for (const v of node) collectPromptFiles(v, acc);
    return acc;
  }
  for (const [k, v] of Object.entries(node)) {
    if (k === 'prompt_file' && typeof v === 'string' && v.trim()) acc.add(v.trim());
    else collectPromptFiles(v, acc);
  }
  return acc;
}

const configuredPromptFiles = (() => {
  const raw = fs.readFileSync(LEARNER_AGENTS_YAML, 'utf-8');
  return [...collectPromptFiles(yaml.parse(raw))];
})();

const NOT_FOUND_MARKERS = [
  'not found', // tutor-core "Prompt file X not found." + getDefaultPrompt sentinel
  'simulating part of a learner', // generic getDefaultPrompt last-resort fallback
];

describe('learner prompt resolution (no silent fallback)', () => {
  it('declares at least one ego_superego learner prompt to guard', () => {
    assert.ok(configuredPromptFiles.length > 0, 'no prompt_file entries found in learner-agents.yaml');
  });

  it('every configured learner prompt_file resolves to a real file in the EVAL repo', () => {
    const offenders = [];
    for (const file of configuredPromptFiles) {
      const resolved = resolvePromptPath(file);
      if (!resolved) {
        offenders.push(`${file} → UNRESOLVED (exists in neither eval nor tutor-core)`);
        continue;
      }
      // Must resolve to THIS repo's prompts/, not node_modules — that is the bug.
      if (!resolved.startsWith(EVAL_PROMPTS_DIR)) {
        offenders.push(`${file} → resolved outside eval prompts/: ${resolved}`);
      }
    }
    assert.deepEqual(offenders, [], `learner prompts not owned by eval repo:\n${offenders.join('\n')}`);
  });

  it('never returns the generic "not found" default for a configured learner prompt', () => {
    const loader = createLocalPromptLoader();
    for (const file of configuredPromptFiles) {
      const content = loader.loadPrompt(file).toLowerCase();
      for (const marker of NOT_FOUND_MARKERS) {
        assert.ok(
          !content.includes(marker),
          `prompt ${file} loaded the silent fallback (matched "${marker}") — file is missing from eval/prompts`,
        );
      }
    }
  });

  it('the Oedipus learner profile (ego_superego_recognition_authentic) loads a real superego prompt end-to-end', () => {
    const cfg = learnerConfig.getAgentConfig('superego', 'ego_superego_recognition_authentic');
    assert.ok(cfg && typeof cfg.prompt === 'string', 'no superego config resolved');
    assert.ok(cfg.prompt.length > 500, `superego prompt suspiciously short (${cfg.prompt.length} chars) — fallback?`);
    assert.match(cfg.prompt, /SUPEREGO dimension of a learner/i);

    const meta = learnerConfig.getPromptMetadata('learner-superego-recognition-authentic.md');
    assert.ok(meta.source && !meta.source.includes('node_modules'), `resolved from node_modules: ${meta.source}`);
  });
});

describe('learner superego is bidirectional (suspicious OF THE EGO, both directions)', () => {
  // Structural guard for the monotonic-superego defect: the prompt that actually
  // ran only ever pushed the ego toward MORE doubt (authenticity/"add friction"),
  // never interrogating an over-hedging ego. A learner whose superego only ratifies
  // caution never adapts. These assertions fail if the prompt regresses to a single
  // critique direction. (Structural, not behavioural — it guards the instruction set.)
  const promptPath = path.join(EVAL_PROMPTS_DIR, 'learner-superego-recognition-authentic.md');
  const text = fs.readFileSync(promptPath, 'utf-8');
  const lower = text.toLowerCase();

  it('frames the superego as suspicious of the Ego (Freudian), not of the world', () => {
    assert.match(text, /suspicious \*?\*?of the Ego/i);
    assert.match(lower, /do not simply ratify|don't simply ratify|never simply ratify/);
  });

  it('retains the over-claiming / premature-closure critique direction', () => {
    assert.ok(
      /premature closure/i.test(text) || /over-?claim/i.test(text) || /claiming a conclusion/i.test(text),
      'lost the over-claiming critique vector',
    );
  });

  it('adds the over-hedging / evasion / under-commitment critique direction', () => {
    // The missing vector that caused the bug: catching an ego that hides behind doubt.
    assert.match(lower, /hedg|deferring|under-commit|avoidance|evasi/);
    assert.match(lower, /defen[cs]e/); // names the hedge as a possible defense
    assert.match(lower, /commit/); // pushes toward commitment when evidence warrants
  });

  it('keeps the yes-man guardrail (commit on own evidence, not deference to the tutor)', () => {
    assert.match(lower, /deference|please|social pressure/);
    assert.match(lower, /own (reasoning|evidence|inference)/);
  });
});
