#!/usr/bin/env node
// Backfill dialogue_content_hash and config_hash for runs missing them.
// Usage: node scripts/backfill-hashes.js <runId>

import Database from 'better-sqlite3';
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

const runId = process.argv[2];
if (!runId) {
  console.error('Usage: node scripts/backfill-hashes.js <runId>');
  process.exit(1);
}

const db = new Database('data/evaluations.db');
const logDir = 'logs/tutor-dialogues';

const rows = db.prepare(`
  SELECT id, dialogue_id, profile_name, provider, model, ego_model, superego_model,
         hyperparameters, factor_recognition, factor_multi_agent_tutor, factor_multi_agent_learner,
         learner_architecture, conversation_mode
  FROM evaluation_results
  WHERE run_id = ? AND (dialogue_content_hash IS NULL OR config_hash IS NULL)
`).all(runId);

console.log(`Found ${rows.length} rows to backfill for ${runId}`);

if (rows.length === 0) {
  console.log('Nothing to do.');
  db.close();
  process.exit(0);
}

const updateStmt = db.prepare(`
  UPDATE evaluation_results
  SET dialogue_content_hash = ?, config_hash = ?
  WHERE id = ?
`);

let updated = 0;
let skipped = 0;

const txn = db.transaction(() => {
  for (const row of rows) {
    // Compute dialogue_content_hash
    let contentHash = null;
    if (row.dialogue_id) {
      const logPath = path.join(logDir, `${row.dialogue_id}.json`);
      if (fs.existsSync(logPath)) {
        const content = fs.readFileSync(logPath, 'utf8');
        const parsed = JSON.parse(content);
        contentHash = createHash('sha256').update(JSON.stringify(parsed, null, 2)).digest('hex');
      }
    }

    // Compute config_hash (mirrors computeConfigHash from evaluationRunner.js)
    const hyp = row.hyperparameters ? JSON.parse(row.hyperparameters) : null;
    const factorRecog = row.factor_recognition !== null ? Boolean(row.factor_recognition) : null;
    const factorMultiTutor = row.factor_multi_agent_tutor !== null ? Boolean(row.factor_multi_agent_tutor) : null;
    const factorMultiLearner = row.factor_multi_agent_learner !== null ? Boolean(row.factor_multi_agent_learner) : null;

    const snapshot = {
      profileName: row.profile_name || null,
      provider: row.provider || null,
      model: row.model || null,
      egoModel: row.ego_model || null,
      superegoModel: row.superego_model || null,
      hyperparameters: hyp || null,
      superegoHyperparameters: null,
      factors: {
        recognition: factorRecog,
        multi_agent_tutor: factorMultiTutor,
        multi_agent_learner: factorMultiLearner,
      },
      learnerArchitecture: row.learner_architecture || null,
      learnerModelOverride: null,
      disableSuperego: false,
      conversationMode: row.conversation_mode || null,
    };
    const configHash = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');

    if (contentHash) {
      updateStmt.run(contentHash, configHash, row.id);
      updated++;
    } else {
      skipped++;
    }
  }
});

txn();
console.log(`Backfilled: ${updated} rows updated, ${skipped} skipped (no log file)`);

// Verify
const check = db.prepare(`
  SELECT COUNT(*) as total, COUNT(dialogue_content_hash) as has_hash, COUNT(config_hash) as has_config
  FROM evaluation_results WHERE run_id = ?
`).get(runId);
console.log(`Verification: ${check.has_hash}/${check.total} content hashes, ${check.has_config}/${check.total} config hashes`);

db.close();
