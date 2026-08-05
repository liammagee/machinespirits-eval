import fs from 'fs';
import path from 'path';

const CHECKPOINT_VERSION = 1;

export function createEvaluationCheckpointStore({ rootDir }) {
  function checkpointFileName(profileName, scenarioId, attemptIndex = null) {
    const attemptSuffix = Number.isInteger(attemptIndex) && attemptIndex >= 0 ? `--attempt-${attemptIndex}` : '';
    return `${profileName}--${scenarioId}${attemptSuffix}`.replace(/[^a-zA-Z0-9_-]/g, '_') + '.json';
  }

  function writeCheckpoint(runId, scenarioId, profileName, state) {
    const dir = path.join(rootDir, runId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, checkpointFileName(profileName, scenarioId, state?.attemptIndex));
    const payload = {
      version: CHECKPOINT_VERSION,
      runId,
      scenarioId,
      profileName,
      timestamp: new Date().toISOString(),
      ...state,
    };
    fs.writeFileSync(filePath, JSON.stringify(payload));
    return filePath;
  }

  function loadCheckpoint(runId, scenarioId, profileName, attemptIndex = null) {
    const dir = path.join(rootDir, runId);
    const candidates = [path.join(dir, checkpointFileName(profileName, scenarioId, attemptIndex))];
    if (attemptIndex != null) candidates.push(path.join(dir, checkpointFileName(profileName, scenarioId)));
    for (const filePath of candidates) {
      if (!fs.existsSync(filePath)) continue;
      try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } catch {
        return null;
      }
    }
    return null;
  }

  function deleteCheckpoint(runId, scenarioId, profileName, attemptIndex = null) {
    const dir = path.join(rootDir, runId);
    const filePath = path.join(dir, checkpointFileName(profileName, scenarioId, attemptIndex));
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
    } catch {
      // Best-effort cleanup preserves the established resume contract.
    }
  }

  function listCheckpoints(runId) {
    const dir = path.join(rootDir, runId);
    if (!fs.existsSync(dir)) return [];
    const files = fs.readdirSync(dir).filter((file) => file.endsWith('.json'));
    const checkpoints = [];
    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
        if (data.version === CHECKPOINT_VERSION) checkpoints.push(data);
      } catch {
        // Corrupt checkpoint files are ignored exactly as before.
      }
    }
    return checkpoints;
  }

  return { deleteCheckpoint, listCheckpoints, loadCheckpoint, writeCheckpoint };
}
