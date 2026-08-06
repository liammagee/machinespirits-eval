import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export function createDialogueLogRepository({ logsRoot, fileSystem = fs, hashFactory = createHash }) {
  const dialogueLogsDir = path.join(logsRoot, 'tutor-dialogues');

  function loadDialogueLog(dialogueId) {
    if (!dialogueId) return null;

    const direct = path.join(dialogueLogsDir, `${dialogueId}.json`);
    if (fileSystem.existsSync(direct)) {
      try {
        return JSON.parse(fileSystem.readFileSync(direct, 'utf-8'));
      } catch {
        return null;
      }
    }

    let files;
    try {
      files = fileSystem
        .readdirSync(dialogueLogsDir)
        .filter((file) => file.includes(dialogueId) && file.endsWith('.json'));
    } catch {
      return null;
    }
    if (files.length === 0) return null;

    try {
      return JSON.parse(fileSystem.readFileSync(path.join(dialogueLogsDir, files[0]), 'utf-8'));
    } catch {
      return null;
    }
  }

  function loadImmutableDialogueLog(contentHash) {
    if (!contentHash) return { log: null, verified: false };

    const hashPath = path.join(dialogueLogsDir, `${contentHash}.json`);
    if (!fileSystem.existsSync(hashPath)) return { log: null, verified: false };

    try {
      const content = fileSystem.readFileSync(hashPath, 'utf-8');
      const log = JSON.parse(content);
      const recomputed = hashFactory('sha256')
        .update(JSON.stringify(log, null, 2))
        .digest('hex');
      return { log, verified: recomputed === contentHash };
    } catch {
      return { log: null, verified: false };
    }
  }

  return Object.freeze({ loadDialogueLog, loadImmutableDialogueLog });
}
