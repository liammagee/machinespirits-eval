/**
 * Ask the presence question and remember the answer.
 *
 * Split from `services/registerMannerPresence.js` so the stance gate can import
 * the pure half — prompt, parse, reading shape — without pulling a CLI bridge
 * and a filesystem into `strategyLedger`'s scene loop. Everything that costs
 * money or touches disk lives here.
 *
 * Determinism comes from three things and no fourth: the reader model is pinned,
 * the prompt is versioned, and every answer is cached under a hash of both plus
 * the two turns. So re-reading a corpus is free after the first pass, an edited
 * turn gets a fresh answer instead of the old one, and a bumped prompt version
 * invalidates the whole cache rather than mixing two questions' answers.
 *
 * The reader runs on a different model family from the writer (`codex.gpt-5.5`
 * generates the tutor turns), so a `present` verdict is not a model marking its
 * own work.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { callModelCliText } from './cliProviderBridge.js';
import {
  buildMannerPresencePrompt,
  mannerPresenceApplies,
  mannerPresenceCacheKey,
  mannerPresenceReading,
  parseMannerPresenceReply,
  unreadMannerPresence,
} from './registerMannerPresence.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const DEFAULT_PRESENCE_READER = Object.freeze({
  provider: 'claude-code',
  model: 'claude-sonnet-5',
});

export function presenceReaderLabel({ provider, model } = {}) {
  return `${provider || DEFAULT_PRESENCE_READER.provider}/${model || DEFAULT_PRESENCE_READER.model}`;
}

/**
 * Under `exports/` by default and relocatable through `EVAL_EXPORTS_DIR`, so
 * tests and alternate hosts can keep the cache outside the source tree.
 * `REGISTER_PRESENCE_CACHE_DIR` overrides it outright for hermetic runs.
 */
export function presenceCacheDir(env = process.env) {
  if (env.REGISTER_PRESENCE_CACHE_DIR) return path.resolve(env.REGISTER_PRESENCE_CACHE_DIR);
  if (env.EVAL_EXPORTS_DIR) return path.resolve(env.EVAL_EXPORTS_DIR, 'register-manner-presence');
  return path.join(ROOT, 'exports', 'register-manner-presence');
}

// One small file per reading rather than one index file. Reads and writes stay
// independent, so a pool of readers cannot lose an answer to a concurrent
// read-modify-write of a shared index.
function cachePath(dir, key) {
  return path.join(dir, `${key}.json`);
}

function readCache(dir, key) {
  try {
    return JSON.parse(fs.readFileSync(cachePath(dir, key), 'utf8'));
  } catch {
    return null;
  }
}

function writeCache(dir, key, reading) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(cachePath(dir, key), `${JSON.stringify(reading, null, 2)}\n`);
  } catch {
    // A cache that cannot be written costs another call, not a wrong answer.
  }
}

/**
 * The stored answer for this turn, or null when there is none. Reads a file and
 * nothing else — no network, no cost — so a report can pick up whatever a paid
 * pass already read without itself becoming a paid step. Callers hand the result
 * straight to `evaluateRegisterStanceFidelity` as `presenceReading`, and a null
 * lands there as `not_supplied`, which is what it is.
 */
export function lookupMannerPresence({
  registerName,
  learnerMessage = '',
  tutorMessage = '',
  provider,
  model,
  env = process.env,
} = {}) {
  if (!mannerPresenceApplies(registerName)) return null;
  if (!String(tutorMessage || '').trim()) return null;
  const reader = presenceReaderLabel({ provider, model });
  return readCache(presenceCacheDir(env), mannerPresenceCacheKey({ reader, learnerMessage, tutorMessage }));
}

/**
 * @returns {Promise<{reading: object, fromCache: boolean}>} the reading always,
 *   including when nothing was asked. A caller never has to tell "the manner is
 *   absent" apart from "nobody asked" — `status` says which, `reason` says why.
 */
export async function readMannerPresence({
  registerName,
  learnerMessage = '',
  tutorMessage = '',
  provider = DEFAULT_PRESENCE_READER.provider,
  model = DEFAULT_PRESENCE_READER.model,
  cache = true,
  timeoutMs,
  env = process.env,
  // Test seam. The three cache rules below — a hit costs nothing, a failed call
  // is not remembered, a parse failure is — are the whole of this module's
  // determinism claim, and they cannot be checked against a paid reader.
  callText = callModelCliText,
} = {}) {
  if (!mannerPresenceApplies(registerName)) {
    return { reading: unreadMannerPresence('register_not_edged'), fromCache: false };
  }
  return readPresenceOfTurn({ learnerMessage, tutorMessage, provider, model, cache, timeoutMs, env, callText });
}

/**
 * The same question, the same cache, no register gate. For report-only reads
 * of turns OUTSIDE the edged registers — e.g. a leak check asking whether a
 * warm-arm turn carries an edge it should not. The gate above exists because
 * no presence question is validated to GATE a non-edged arm; a report-only
 * read that expects "no" is a different use and states it by calling this.
 * Never use this to pass an edged arm's fidelity floor around the gate.
 */
export async function readPresenceOfTurn({
  learnerMessage = '',
  tutorMessage = '',
  provider = DEFAULT_PRESENCE_READER.provider,
  model = DEFAULT_PRESENCE_READER.model,
  cache = true,
  timeoutMs,
  env = process.env,
  callText = callModelCliText,
} = {}) {
  if (!String(tutorMessage || '').trim()) {
    return { reading: unreadMannerPresence('no_tutor_turn'), fromCache: false };
  }

  const reader = presenceReaderLabel({ provider, model });
  const key = mannerPresenceCacheKey({ reader, learnerMessage, tutorMessage });
  const dir = presenceCacheDir(env);

  if (cache) {
    const hit = readCache(dir, key);
    if (hit) return { reading: hit, fromCache: true };
  }

  let text;
  try {
    text = await callText({
      provider,
      model,
      prompt: buildMannerPresencePrompt({ learnerMessage, tutorMessage }),
      role: 'register-manner-presence-reader',
      ...(timeoutMs ? { timeoutMs } : {}),
    });
  } catch (error) {
    // Not cached: a failed call is a gap to retry, not an answer to remember.
    return { reading: unreadMannerPresence(`reader_error:${error.message}`, { reader }), fromCache: false };
  }

  const reading = mannerPresenceReading({
    reader,
    parsed: parseMannerPresenceReply(text),
    tutorMessage,
    cacheKey: key,
  });
  // A parse failure is cached as unread on purpose: the same turn asked the same
  // way produced unusable output once and will again, and a re-read pass that
  // silently re-bought it every time would hide that.
  if (cache) writeCache(dir, key, reading);
  return { reading, fromCache: false };
}

export default {
  DEFAULT_PRESENCE_READER,
  lookupMannerPresence,
  presenceCacheDir,
  presenceReaderLabel,
  readMannerPresence,
  readPresenceOfTurn,
};
