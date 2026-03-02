/**
 * Prompt Versioning Tests
 *
 * Verifies:
 *   - getPromptMetadata() extracts version from <!-- version: X.Y --> comment
 *   - getPromptMetadata() computes a 16-char SHA-256 content hash
 *   - Prompts without version comments return version: null
 *   - loadPrompt() still returns string content (no breaking change)
 *   - All tagged prompt files have extractable metadata
 *   - DB columns exist and are populated by storeResult()
 *   - storeRejudgment() propagates prompt version columns from original
 *   - collectPromptVersions() returns metadata for registered cells
 */

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============================================================================
// 1. Unit tests for getPromptMetadata (tutor-core configLoaderBase)
// ============================================================================

import { configLoaderBase } from '@machinespirits/tutor-core';
const { createPromptLoader } = configLoaderBase;

describe('Prompt versioning: configLoaderBase', () => {
  // Create a temporary prompt loader pointing to tutor-core's prompts
  const promptLoader = createPromptLoader(null);

  it('extracts version from a tagged prompt file', () => {
    // tutor-ego.md has <!-- version: 1.0 --> on line 2
    const meta = promptLoader.getPromptMetadata('tutor-ego.md');
    assert.equal(meta.version, '1.0', 'Should extract version 1.0');
    assert.equal(meta.filename, 'tutor-ego.md');
    assert.ok(meta.contentHash, 'Should have a contentHash');
    assert.equal(meta.contentHash.length, 16, 'Hash should be 16 hex chars');
    assert.match(meta.contentHash, /^[0-9a-f]{16}$/, 'Hash should be lowercase hex');
  });

  it('returns null version for untagged files', () => {
    // PROMPT_SCHEMA.md has no version comment
    const meta = promptLoader.getPromptMetadata('PROMPT_SCHEMA.md');
    assert.equal(meta.version, null, 'Untagged file should return null version');
    assert.ok(meta.contentHash, 'Should still compute a content hash');
  });

  it('loadPrompt still returns a string (no breaking change)', () => {
    const content = promptLoader.loadPrompt('tutor-ego.md');
    assert.equal(typeof content, 'string', 'loadPrompt should return string');
    assert.ok(content.length > 0, 'Content should not be empty');
    // The version comment should be stripped along with the title by the regex
    // (it follows the title line which gets removed)
  });

  it('produces deterministic hashes for the same file', () => {
    const meta1 = promptLoader.getPromptMetadata('tutor-ego.md');
    promptLoader.clearPromptCache();
    const meta2 = promptLoader.getPromptMetadata('tutor-ego.md');
    assert.equal(meta1.contentHash, meta2.contentHash, 'Same file should produce same hash');
    assert.equal(meta1.version, meta2.version, 'Same file should produce same version');
  });

  it('different files produce different hashes', () => {
    const meta1 = promptLoader.getPromptMetadata('tutor-ego.md');
    const meta2 = promptLoader.getPromptMetadata('tutor-ego-recognition.md');
    assert.notEqual(meta1.contentHash, meta2.contentHash, 'Different files should have different hashes');
  });
});

// ============================================================================
// 2. Re-export tests: tutorConfigLoader and learnerConfigLoader
// ============================================================================

import { tutorConfigLoader } from '@machinespirits/tutor-core';
import * as learnerConfigLoader from '../services/learnerConfigLoader.js';

describe('Prompt versioning: config loader re-exports', () => {
  it('tutorConfigLoader exports getPromptMetadata', () => {
    assert.equal(
      typeof tutorConfigLoader.getPromptMetadata,
      'function',
      'tutorConfigLoader should export getPromptMetadata',
    );
  });

  it('tutorConfigLoader.getPromptMetadata returns valid metadata', () => {
    const meta = tutorConfigLoader.getPromptMetadata('tutor-ego.md');
    assert.equal(meta.version, '1.0');
    assert.equal(meta.contentHash.length, 16);
  });

  it('learnerConfigLoader exports getPromptMetadata', () => {
    assert.equal(
      typeof learnerConfigLoader.getPromptMetadata,
      'function',
      'learnerConfigLoader should export getPromptMetadata',
    );
  });

  it('learnerConfigLoader.getPromptMetadata returns valid metadata for learner prompts', () => {
    const meta = learnerConfigLoader.getPromptMetadata('learner-unified.md');
    assert.equal(meta.version, '1.0');
    assert.equal(meta.contentHash.length, 16);
  });
});

// ============================================================================
// 3. All prompt files should have version tags
// ============================================================================

describe('Prompt versioning: all prompt files tagged', () => {
  const promptsDir = path.resolve(__dirname, '..', 'node_modules', '@machinespirits', 'tutor-core', 'prompts');
  // Follow symlink to actual directory
  const realPromptsDir = fs.realpathSync(promptsDir);

  const promptFiles = fs.readdirSync(realPromptsDir).filter((f) => f.endsWith('.md') && f !== 'PROMPT_SCHEMA.md');

  for (const filename of promptFiles) {
    it(`${filename} has <!-- version: X.Y --> tag`, () => {
      const content = fs.readFileSync(path.join(realPromptsDir, filename), 'utf-8');
      const versionMatch = content.match(/<!--\s*version:\s*([\d.]+)\s*-->/);
      assert.ok(versionMatch, `${filename} should contain a version comment`);
      assert.match(versionMatch[1], /^\d+\.\d+$/, `Version should be in X.Y format`);
    });
  }
});

// ============================================================================
// 4. DB column tests
// ============================================================================

// Set up isolated test database BEFORE importing evaluationStore
const testDbPath = path.join(os.tmpdir(), `eval-prompt-ver-test-${Date.now()}.db`);
process.env.EVAL_DB_PATH = testDbPath;

const evaluationStore = await import('../services/evaluationStore.js');

describe('Prompt versioning: DB storage', () => {
  after(() => {
    try {
      fs.unlinkSync(testDbPath);
    } catch {
      /* ignore */
    }
    try {
      fs.unlinkSync(testDbPath + '-wal');
    } catch {
      /* ignore */
    }
    try {
      fs.unlinkSync(testDbPath + '-shm');
    } catch {
      /* ignore */
    }
  });

  it('storeResult stores prompt version columns', () => {
    const run = evaluationStore.createRun({ description: 'prompt-version-test' });
    const rowId = evaluationStore.storeResult(run.id, {
      scenarioId: 'test-scenario',
      scenarioName: 'Test Scenario',
      provider: 'openrouter',
      model: 'test-model',
      profileName: 'cell_1_base_single_unified',
      suggestions: [{ text: 'test' }],
      success: true,
      latencyMs: 100,
      inputTokens: 50,
      outputTokens: 50,
      tutorEgoPromptVersion: '1.0',
      tutorSuperegoPromptVersion: null,
      learnerPromptVersion: '1.0',
      promptContentHash: 'abcdef0123456789',
    });

    const result = evaluationStore.getResultById(rowId);
    assert.equal(result.tutorEgoPromptVersion, '1.0', 'tutor_ego_prompt_version should be stored');
    assert.equal(
      result.tutorSuperegoPromptVersion,
      null,
      'tutor_superego_prompt_version should be null for single-agent',
    );
    assert.equal(result.learnerPromptVersion, '1.0', 'learner_prompt_version should be stored');
    assert.equal(result.promptContentHash, 'abcdef0123456789', 'prompt_content_hash should be stored');
  });

  it('storeRejudgment propagates prompt version columns', () => {
    const run = evaluationStore.createRun({ description: 'rejudge-prompt-test' });
    const rowId = evaluationStore.storeResult(run.id, {
      scenarioId: 'test-scenario',
      scenarioName: 'Test Scenario',
      provider: 'openrouter',
      model: 'test-model',
      profileName: 'cell_5_recog_single_unified',
      suggestions: [{ text: 'test' }],
      success: true,
      latencyMs: 100,
      inputTokens: 50,
      outputTokens: 50,
      tutorEgoPromptVersion: '1.0',
      tutorSuperegoPromptVersion: '1.0',
      learnerPromptVersion: '1.0',
      promptContentHash: '1234567890abcdef',
    });

    const original = evaluationStore.getResultById(rowId);
    const rejudgeId = evaluationStore.storeRejudgment(original, {
      scores: { relevance: 4.0 },
      overallScore: 4.0,
      judgeModel: 'test-judge',
    });

    const rejudged = evaluationStore.getResultById(rejudgeId);
    assert.equal(rejudged.tutorEgoPromptVersion, '1.0', 'Rejudge should propagate tutor ego prompt version');
    assert.equal(rejudged.tutorSuperegoPromptVersion, '1.0', 'Rejudge should propagate tutor superego prompt version');
    assert.equal(rejudged.learnerPromptVersion, '1.0', 'Rejudge should propagate learner prompt version');
    assert.equal(rejudged.promptContentHash, '1234567890abcdef', 'Rejudge should propagate prompt content hash');
  });

  it('existing rows without prompt versions have NULL columns', () => {
    const run = evaluationStore.createRun({ description: 'null-prompt-test' });
    const rowId = evaluationStore.storeResult(run.id, {
      scenarioId: 'test-scenario',
      scenarioName: 'Test Scenario',
      provider: 'openrouter',
      model: 'test-model',
      suggestions: [{ text: 'test' }],
      success: true,
      latencyMs: 100,
      inputTokens: 50,
      outputTokens: 50,
      // No prompt version fields
    });

    const result = evaluationStore.getResultById(rowId);
    assert.equal(result.tutorEgoPromptVersion, null);
    assert.equal(result.tutorSuperegoPromptVersion, null);
    assert.equal(result.learnerPromptVersion, null);
    assert.equal(result.promptContentHash, null);
  });
});

// ============================================================================
// 5. Cross-boundary: prompt versions extractable for registered cells
// ============================================================================

import { loadTutorAgents } from '../services/evalConfigLoader.js';

describe('Prompt versioning: cross-boundary (registered cells)', () => {
  const evalProfiles = loadTutorAgents()?.profiles || {};
  const cellNames = Object.keys(evalProfiles).filter((name) => /^cell_\d/.test(name));

  // Spot-check a representative sample (not all ~90, just key ones)
  const sampleCells = cellNames.filter(
    (name) =>
      name.includes('cell_1_') ||
      name.includes('cell_5_') ||
      name.includes('cell_7_') ||
      name.includes('cell_22_') ||
      name.includes('cell_71_') ||
      name.includes('cell_86_'),
  );

  for (const cellName of sampleCells) {
    it(`${cellName}: tutor ego prompt has extractable metadata`, () => {
      const profile = evalProfiles[cellName];
      if (profile?.ego?.prompt_file) {
        const meta = tutorConfigLoader.getPromptMetadata(profile.ego.prompt_file);
        assert.ok(meta.version, `${cellName} ego prompt ${profile.ego.prompt_file} should have a version`);
        assert.ok(meta.contentHash, `${cellName} ego prompt should have a hash`);
      }
    });

    it(`${cellName}: tutor superego prompt has extractable metadata (if configured)`, () => {
      const profile = evalProfiles[cellName];
      if (profile?.superego?.prompt_file) {
        const meta = tutorConfigLoader.getPromptMetadata(profile.superego.prompt_file);
        assert.ok(meta.version, `${cellName} superego prompt ${profile.superego.prompt_file} should have a version`);
        assert.ok(meta.contentHash, `${cellName} superego prompt should have a hash`);
      }
    });
  }
});
