import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Database from 'better-sqlite3';

import * as memory from '../services/memory/learnerMemoryService.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODULE_PATH = path.join(ROOT, 'services', 'memory', 'learnerMemoryService.js');

function openTemporaryStore(t) {
  memory.closeLearnerMemoryStore();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'learner-memory-service-'));
  const dbPath = path.join(directory, 'learner-memory.db');
  memory.openLearnerMemoryStore({ dbPath });
  t.after(() => {
    memory.closeLearnerMemoryStore();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return { directory, dbPath };
}

test('importing the quarantined reserve does not create storage', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'learner-memory-import-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const moduleUrl = `${pathToFileURL(MODULE_PATH).href}?pure-import=${Date.now()}`;
  const source = `
    process.env.EVAL_WRITING_PAD_DIR = ${JSON.stringify(directory)};
    const memory = await import(${JSON.stringify(moduleUrl)});
    process.stdout.write(JSON.stringify(memory.getLearnerMemoryStoreStatus()));
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', source], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, EVAL_WRITING_PAD_DIR: directory },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).open, false);
  assert.deepEqual(fs.readdirSync(directory), []);
});

test('explicit lifecycle exposes quarantine status and prevents path switching', (t) => {
  const { dbPath, directory } = openTemporaryStore(t);
  const status = memory.getLearnerMemoryStoreStatus();

  assert.equal(status.maturity, 'quarantined_experimental_reserve');
  assert.equal(status.productionConsumer, false);
  assert.equal(status.open, true);
  assert.equal(status.dbPath, dbPath);
  assert.equal(status.schemaVersion, 1);
  assert.equal(memory.checkDatabaseHealth(), true);
  assert.equal(memory.openLearnerMemoryStore().dbPath, dbPath);
  assert.throws(() => memory.openLearnerMemoryStore({ dbPath: path.join(directory, 'other.db') }), /already open/);
  assert.equal(memory.closeLearnerMemoryStore(), true);
  assert.equal(memory.closeLearnerMemoryStore(), false);
});

test('schema and CRUD contract persist across an explicit close and reopen', (t) => {
  const { dbPath } = openTemporaryStore(t);
  const learnerId = 'learner-a';

  const root = memory.getOrCreateLearnerMemory(learnerId);
  assert.equal(root.learner_id, learnerId);
  memory.updateLastSession(learnerId, 'session-1');

  const concept = memory.upsertConceptState(learnerId, 'fractions', {
    label: 'Fractions',
    level: 'developing',
    confidence: 0.7,
    addSource: 'session-1',
    addStruggle: { note: 'denominator comparison' },
  });
  assert.equal(concept.level, 'developing');
  assert.deepEqual(concept.sources, ['session-1']);
  assert.equal(concept.struggles.length, 1);

  const episode = memory.createEpisode({
    learnerId,
    sessionId: 'session-1',
    type: 'insight',
    content: 'Common denominators align the units',
    concepts: ['fractions'],
    importance: 0.8,
  });
  memory.incrementEpisodeRetrieval(episode.id);
  assert.equal(memory.getRecentEpisodes(learnerId)[0].retrieval_count, 1);

  memory.createSessionSummary({
    learnerId,
    sessionId: 'session-1',
    conceptsTouched: ['fractions'],
    unresolvedQuestions: ['When should denominators be multiplied?'],
    narrativeSummary: 'Compared fractions using common denominators',
  });
  assert.deepEqual(memory.getSessionSummary('session-1').conceptsTouched, ['fractions']);

  const thread = memory.createThread({
    learnerId,
    topic: 'fractions',
    question: 'When should denominators be multiplied?',
    originSession: 'session-1',
  });
  assert.equal(
    memory.updateThread(thread.id, { addPartialAnswer: 'For unlike denominators' }).partialAnswers.length,
    1,
  );

  memory.upsertPersonalDefinition(learnerId, 'denominator', 'the size of each part', 0.8);
  assert.equal(memory.getPersonalDefinitions(learnerId)[0].term, 'denominator');
  memory.createConnection({
    learnerId,
    conceptA: 'fractions',
    conceptB: 'ratios',
    relationship: 'both compare quantities',
  });
  assert.equal(memory.getConnections(learnerId).length, 1);

  const preferences = memory.updatePreferences(learnerId, {
    prefersExamplesFirst: false,
    prefersSocraticMode: true,
    effectiveStrategies: ['worked contrast'],
  });
  assert.equal(preferences.prefersExamplesFirst, false);
  assert.equal(preferences.prefersSocraticMode, true);
  assert.deepEqual(preferences.effectiveStrategies, ['worked contrast']);

  const milestone = memory.createMilestone({
    learnerId,
    type: 'first_breakthrough',
    title: 'Compared unlike fractions',
    conceptId: 'fractions',
  });
  assert.equal(memory.getUnacknowledgedMilestones(learnerId).length, 1);
  memory.acknowledgeMilestone(milestone.id);
  assert.equal(memory.getUnacknowledgedMilestones(learnerId).length, 0);

  memory.logAgentCost({
    learnerId,
    sessionId: 'session-1',
    agentRole: 'tutor',
    architecture: 'rich-memory-smoke',
    inputTokens: 100,
    outputTokens: 25,
    latencyMs: 50,
    model: 'fake',
  });
  assert.equal(memory.getCostStats(learnerId).total_calls, 1);
  assert.match(memory.buildContextInjection(learnerId).narrativeSummary, /Compared fractions/);

  memory.closeLearnerMemoryStore();
  memory.openLearnerMemoryStore({ dbPath });
  assert.equal(memory.getConceptState(learnerId, 'fractions').level, 'developing');
  assert.equal(memory.getRecentEpisodes(learnerId).length, 1);
});

test('decay and due-for-review retrieval use persisted timestamps', (t) => {
  const { dbPath } = openTemporaryStore(t);
  const learnerId = 'learner-decay';
  memory.getOrCreateLearnerMemory(learnerId);
  memory.upsertConceptState(learnerId, 'ratios', {
    label: 'Ratios',
    level: 'developing',
    decayRate: 0.2,
  });
  const episode = memory.createEpisode({
    learnerId,
    sessionId: 'session-old',
    type: 'insight',
    content: 'Ratios preserve relative size',
    importance: 0.8,
  });
  memory.closeLearnerMemoryStore();

  const inspection = new Database(dbPath);
  inspection.prepare("UPDATE concept_states SET last_engaged = '2020-01-01' WHERE learner_id = ?").run(learnerId);
  inspection.prepare("UPDATE episodes SET timestamp = '2020-01-01' WHERE id = ?").run(episode.id);
  inspection.close();

  memory.openLearnerMemoryStore({ dbPath });
  assert.equal(memory.getConceptsDueForReview(learnerId)[0].concept_id, 'ratios');
  memory.decayEpisodeImportance(30, 0.5);
  assert.equal(memory.getRecentEpisodes(learnerId)[0].importance, 0.4);
});

test('incompatible reserve schema is reset narrowly and versioned', (t) => {
  memory.closeLearnerMemoryStore();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'learner-memory-migration-'));
  const dbPath = path.join(directory, 'learner-memory.db');
  t.after(() => {
    memory.closeLearnerMemoryStore();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  const legacy = new Database(dbPath);
  legacy.exec('CREATE TABLE tutor_session_summaries (legacy_id TEXT PRIMARY KEY)');
  legacy.close();

  memory.openLearnerMemoryStore({ dbPath });
  assert.equal(memory.checkDatabaseHealth(), true);
  memory.closeLearnerMemoryStore();

  const inspection = new Database(dbPath, { readonly: true });
  const columns = inspection.pragma('table_info(tutor_session_summaries)').map(({ name }) => name);
  assert.ok(columns.includes('learner_id'));
  assert.equal(inspection.pragma('user_version', { simple: true }), 1);
  inspection.close();
});

test('both permitted experiment consumers complete their zero-model paths', () => {
  const smoke = spawnSync(process.execPath, ['scripts/smoke-rich-memory-arc.js', '--sessions', '2'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(smoke.status, 0, smoke.stderr);
  assert.match(smoke.stdout, /OK — rich store accumulates/);

  const experiment = spawnSync(
    process.execPath,
    ['scripts/run-rich-memory-arc-experiment.js', '--sessions', '1', '--learners', '1', '--arms', 'baseline,rich'],
    { cwd: ROOT, encoding: 'utf8', env: { ...process.env, ANTHROPIC_API_KEY: '' } },
  );
  assert.equal(experiment.status, 0, experiment.stderr);
  assert.match(experiment.stdout, /dry-run OK/);
});
