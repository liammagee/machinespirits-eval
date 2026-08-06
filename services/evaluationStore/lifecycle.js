import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createEvaluationStore } from './createEvaluationStore.js';

const DEFAULT_ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
let defaultStore = null;

export function startDefaultEvaluationStore(options = {}) {
  if (defaultStore?.isOpen) return defaultStore;
  defaultStore = createEvaluationStore({ rootDir: DEFAULT_ROOT_DIR, ...options });
  return defaultStore;
}

/**
 * Compatibility fallback for legacy facade consumers. It is intentionally
 * lazy: importing the facade remains side-effect free, while the first actual
 * store operation retains the historical default path behavior.
 */
export function getDefaultEvaluationStore(options = {}) {
  return defaultStore?.isOpen ? defaultStore : startDefaultEvaluationStore(options);
}

export function stopDefaultEvaluationStore() {
  if (!defaultStore) return false;
  const store = defaultStore;
  defaultStore = null;
  return store.close();
}

export function hasDefaultEvaluationStore() {
  return defaultStore?.isOpen === true;
}
