/**
 * Local-first prompt loader (eval repo owns its prompts).
 *
 * Background: tutor-core's `configLoaderBase.createPromptLoader` resolves every
 * prompt against tutor-core's OWN `prompts/` dir (a module-level constant), so a
 * prompt edited in the eval repo would never load — the active text silently came
 * from `node_modules/@machinespirits/tutor-core/prompts/`. That cost us real time
 * (the Oedipus learner superego that actually ran was a tutor-core file, not the
 * eval copy we were reading). This loader makes the eval repo's `prompts/` the
 * authoritative source: it resolves `prompts/<file>` first and falls back to
 * tutor-core only for any file not yet copied locally.
 *
 * It is otherwise a faithful drop-in for tutor-core's createPromptLoader — same
 * title-strip, same `<!-- version: X.Y -->` extraction, same 16-char content hash,
 * same mtime cache, same `{ loadPrompt, getPromptMetadata, getPromptCacheStatus,
 * getCachedPrompts, clearPromptCache }` surface — so callers (learnerConfigLoader,
 * the tutor wrapper) need no other changes and provenance columns stay populated.
 */
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { configLoaderBase } from '../tutor-core/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Eval repo's prompts/ is the source of truth.
export const EVAL_PROMPTS_DIR = path.resolve(__dirname, '..', 'prompts');
// tutor-core's bundled prompts/ — fallback for any file not yet copied into eval.
// Resolved defensively: a concurrent effort is folding tutor-core into this repo,
// after which this export may move or disappear. Since eval/prompts is a complete
// superset, losing this fallback must never break resolution — so guard it.
let CORE_PROMPTS_DIR = null;
try {
  CORE_PROMPTS_DIR = configLoaderBase?.PROMPTS_DIR || null;
} catch {
  CORE_PROMPTS_DIR = null;
}

/**
 * Resolve a prompt filename to an absolute path, preferring the eval repo and
 * falling back to tutor-core (if still present). Returns null if it exists in
 * neither place.
 */
export function resolvePromptPath(filename) {
  // MECHANISM-ABLATION toggle: OEDIPUS_SUPEREGO_V1=1 routes the learner superego to
  // the pre-`260cdc6` monotonic v1 variant, isolating whether the bidirectional
  // superego (vs premise-licensing) drives Oedipus discovery. Default keeps v2.
  if (
    (process.env.OEDIPUS_SUPEREGO_V1 === '1' || process.env.OEDIPUS_SUPEREGO_V1 === 'on') &&
    filename === 'learner-superego-recognition-authentic.md'
  ) {
    filename = 'learner-superego-recognition-authentic-v1.md';
  }
  const local = path.join(EVAL_PROMPTS_DIR, filename);
  if (fs.existsSync(local)) return local;
  if (CORE_PROMPTS_DIR) {
    const core = path.join(CORE_PROMPTS_DIR, filename);
    if (fs.existsSync(core)) return core;
  }
  return null;
}

/**
 * Create a local-first prompt loader. API-compatible with
 * tutor-core's configLoaderBase.createPromptLoader.
 *
 * @param {Function|null} defaultPromptFn - fallback (filename) => string when a
 *   prompt exists in neither dir. If null, returns a "not found" sentinel.
 */
export function createLocalPromptLoader(defaultPromptFn = null) {
  // Cache keyed by filename → { content, mtime, version, contentHash, source }
  const promptCache = new Map();

  function loadPrompt(filename, forceReload = false) {
    const promptPath = resolvePromptPath(filename);

    try {
      if (!promptPath) {
        if (defaultPromptFn) return defaultPromptFn(filename);
        return `Prompt file ${filename} not found.`;
      }

      const stats = fs.statSync(promptPath);
      const cached = promptCache.get(filename);

      // Cache hit only if the resolved path AND its mtime are unchanged.
      if (!forceReload && cached && cached.mtime === stats.mtimeMs && cached.source === promptPath) {
        return cached.content;
      }

      const rawContent = fs.readFileSync(promptPath, 'utf-8');
      // Remove markdown title (first line starting with #) — matches tutor-core.
      const content = rawContent.replace(/^#[^\n]*\n+/, '').trim();

      // Extract version from <!-- version: X.Y --> comment.
      const versionMatch = rawContent.match(/<!--\s*version:\s*([\d.]+)\s*-->/);
      const version = versionMatch ? versionMatch[1] : null;

      // 16-char SHA-256 of the raw file (matches tutor-core's provenance hash).
      const contentHash = createHash('sha256').update(rawContent).digest('hex').slice(0, 16);

      const wasChanged = cached && (cached.mtime !== stats.mtimeMs || cached.source !== promptPath);
      promptCache.set(filename, { content, mtime: stats.mtimeMs, version, contentHash, source: promptPath });

      if (wasChanged) {
        console.log(`[Hot Reload] Prompt reloaded: ${filename}`);
      }
      return content;
    } catch (err) {
      console.warn(`Failed to load prompt ${filename}:`, err.message);
      if (defaultPromptFn) return defaultPromptFn(filename);
      return `Prompt file ${filename} not found.`;
    }
  }

  function clearPromptCache() {
    promptCache.clear();
  }

  function getPromptCacheStatus() {
    const status = {};
    for (const [filename, { mtime, source }] of promptCache.entries()) {
      let currentMtime = null;
      let needsReload = false;
      try {
        // Re-resolve: a file could have appeared locally since it was cached.
        const current = resolvePromptPath(filename);
        currentMtime = current ? fs.statSync(current).mtimeMs : null;
        needsReload = current !== source || currentMtime !== mtime;
      } catch {
        // File may have been deleted.
      }
      status[filename] = {
        cachedMtime: new Date(mtime).toISOString(),
        currentMtime: currentMtime ? new Date(currentMtime).toISOString() : null,
        source,
        needsReload,
      };
    }
    return status;
  }

  function getCachedPrompts() {
    return Array.from(promptCache.keys());
  }

  function getPromptMetadata(filename) {
    if (!promptCache.has(filename)) {
      loadPrompt(filename);
    }
    const cached = promptCache.get(filename);
    return {
      version: cached?.version || null,
      contentHash: cached?.contentHash || null,
      source: cached?.source || null,
      filename,
    };
  }

  return {
    loadPrompt,
    clearPromptCache,
    getPromptCacheStatus,
    getCachedPrompts,
    getPromptMetadata,
  };
}
