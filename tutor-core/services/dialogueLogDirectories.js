import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TUTOR_CORE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_LOG_ROOT = process.env.TUTOR_CORE_LOG_DIR || path.join(TUTOR_CORE_ROOT, 'logs');

let currentLogRoot = DEFAULT_LOG_ROOT;

export function getTutorCoreLogDirectories() {
  return {
    root: currentLogRoot,
    api: path.join(currentLogRoot, 'tutor-api'),
    debug: path.join(currentLogRoot, 'tutor-debug'),
    dialogues: path.join(currentLogRoot, 'tutor-dialogues'),
    interactions: path.join(currentLogRoot, 'interaction-evals'),
  };
}

export function setTutorCoreLogRoot(logRoot) {
  currentLogRoot = logRoot;
  return getTutorCoreLogDirectories();
}
