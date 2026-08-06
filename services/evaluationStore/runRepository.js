import { createHash } from 'node:crypto';

function requireFunction(value, name) {
  if (typeof value !== 'function') throw new TypeError(`${name} must be a function`);
  return value;
}

function parseRunRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    createdAt: row.created_at,
    description: row.description,
    totalScenarios: row.total_scenarios,
    totalConfigurations: row.total_configurations,
    totalTests: row.total_tests,
    status: row.status,
    completedAt: row.completed_at,
    metadata: JSON.parse(row.metadata || '{}'),
    gitCommit: row.git_commit,
    packageVersion: row.package_version,
  };
}

function normalizeAttemptIndex(value) {
  if (value == null || value === '') return null;
  const attemptIndex = Number(value);
  return Number.isInteger(attemptIndex) && attemptIndex >= 0 ? attemptIndex : null;
}

/**
 * Create the evaluation-run repository around one migrated database connection.
 * Result projection, generation identity, process liveness, and manifest writes
 * remain explicit inputs so repository ownership does not create module cycles.
 */
export function createRunRepository(options = {}) {
  const {
    db,
    generateRunId,
    getResults,
    generationIdentity,
    uniqueGenerationResults,
    expectedTestsForRun,
    writeRunManifest,
    isPidAlive,
    now = () => Date.now(),
    logger = console,
  } = options;

  if (!db?.prepare || !db?.transaction) throw new TypeError('db must be a migrated better-sqlite3 connection');
  requireFunction(generateRunId, 'generateRunId');
  requireFunction(getResults, 'getResults');
  requireFunction(generationIdentity, 'generationIdentity');
  requireFunction(uniqueGenerationResults, 'uniqueGenerationResults');
  requireFunction(expectedTestsForRun, 'expectedTestsForRun');
  requireFunction(writeRunManifest, 'writeRunManifest');
  requireFunction(isPidAlive, 'isPidAlive');
  requireFunction(now, 'now');

  const nowIso = () => new Date(now()).toISOString();

  function createRun(runOptions = {}) {
    const { description = null, totalScenarios = 0, totalConfigurations = 0, metadata = {} } = runOptions;
    const id = generateRunId();

    db.prepare(
      `INSERT INTO evaluation_runs (
        id, created_at, description, total_scenarios, total_configurations,
        metadata, git_commit, package_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      nowIso(),
      description,
      totalScenarios,
      totalConfigurations,
      JSON.stringify(metadata),
      metadata.gitCommit || null,
      metadata.packageVersion || null,
    );

    return {
      id,
      description,
      totalScenarios,
      totalConfigurations,
      status: 'running',
      createdAt: nowIso(),
    };
  }

  function getRun(runId) {
    return parseRunRow(db.prepare('SELECT * FROM evaluation_runs WHERE id = ?').get(runId));
  }

  function updateRun(runId, updates) {
    const { status, totalTests, completedAt, metadata } = updates;

    if (metadata) {
      const existing = getRun(runId);
      const mergedMetadata = { ...(existing?.metadata || {}), ...metadata };
      db.prepare('UPDATE evaluation_runs SET metadata = ? WHERE id = ?').run(JSON.stringify(mergedMetadata), runId);
    }

    const assignments = [];
    const values = [];
    if (status) {
      assignments.push('status = ?');
      values.push(status);
    }
    if (totalTests != null) {
      assignments.push('total_tests = ?');
      values.push(totalTests);
    }
    if (status === 'completed' || completedAt != null) {
      assignments.push('completed_at = ?');
      values.push(completedAt || nowIso());
    }
    if (assignments.length > 0) {
      db.prepare(`UPDATE evaluation_runs SET ${assignments.join(', ')} WHERE id = ?`).run(...values, runId);
    }
  }

  function listRuns(listOptions = {}) {
    const { limit = null, status = null } = listOptions;
    let query = 'SELECT * FROM evaluation_runs';
    const params = [];

    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }
    query += ' ORDER BY created_at DESC';
    if (limit) {
      query += ' LIMIT ?';
      params.push(limit);
    }

    const rows = db.prepare(query).all(...params);
    const scenarioStmt = db.prepare(`
      SELECT DISTINCT scenario_name FROM evaluation_results
      WHERE run_id = ? AND scenario_name IS NOT NULL
      ORDER BY scenario_name
    `);
    const resultCountStmt = db.prepare(`
      SELECT COUNT(*) as completed,
             SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
             AVG(COALESCE(tutor_overall_score, tutor_first_turn_score, overall_score)) as avg_score,
             AVG(tutor_holistic_overall_score) as avg_tutor_holistic_score,
             AVG(learner_overall_score) as avg_learner_score,
             AVG(learner_holistic_overall_score) as avg_learner_holistic_score,
             AVG(dialogue_quality_score) as avg_dialogue_score,
             AVG(dialogue_quality_internal_score) as avg_dialogue_internal_score,
             COUNT(DISTINCT judge_model) as judge_count
      FROM evaluation_results
      WHERE run_id = ?
        AND (judge_model IS NULL OR judge_model = (
          SELECT judge_model FROM evaluation_results
          WHERE run_id = ? AND judge_model IS NOT NULL
          ORDER BY created_at ASC LIMIT 1
        ))
    `);
    const modelStmt = db.prepare(`
      SELECT DISTINCT ego_model FROM evaluation_results
      WHERE run_id = ? AND ego_model IS NOT NULL
      ORDER BY ego_model
    `);
    const superegoModelStmt = db.prepare(`
      SELECT DISTINCT superego_model FROM evaluation_results
      WHERE run_id = ? AND superego_model IS NOT NULL
      ORDER BY superego_model
    `);
    const profileStmt = db.prepare(`
      SELECT DISTINCT profile_name FROM evaluation_results
      WHERE run_id = ? AND profile_name IS NOT NULL
      ORDER BY profile_name
    `);

    const extractAlias = (raw) => {
      if (!raw) return null;
      const dotIndex = raw.indexOf('.');
      return dotIndex !== -1 ? raw.slice(dotIndex + 1) : raw;
    };

    return rows.map((row) => {
      const scenarioNames = scenarioStmt
        .all(row.id)
        .map((scenario) => scenario.scenario_name)
        .filter(Boolean);
      const counts = resultCountStmt.get(row.id, row.id);
      const models = [
        ...new Set(
          [
            ...modelStmt.all(row.id).map((model) => extractAlias(model.ego_model)),
            ...superegoModelStmt.all(row.id).map((model) => extractAlias(model.superego_model)),
          ].filter(Boolean),
        ),
      ];
      const profileNames = profileStmt
        .all(row.id)
        .map((profile) => profile.profile_name)
        .filter(Boolean);
      const fingerprintInput = [...models].sort().join('|');
      const modelFingerprint = fingerprintInput
        ? createHash('sha256').update(fingerprintInput).digest('hex').slice(0, 6)
        : null;
      const completedResults = counts?.completed || 0;
      const totalTests = row.total_tests || 0;
      const progressPct = totalTests > 0 ? Math.min(100, Math.round((completedResults / totalTests) * 100)) : null;

      let durationMs = null;
      if (row.created_at) {
        const start = new Date(row.created_at).getTime();
        if (row.status === 'running') durationMs = now() - start;
        else if (row.completed_at) durationMs = new Date(row.completed_at).getTime() - start;
      }

      return {
        id: row.id,
        createdAt: row.created_at,
        description: row.description,
        totalScenarios: row.total_scenarios,
        totalConfigurations: row.total_configurations,
        totalTests,
        completedResults,
        successfulResults: counts?.successful || 0,
        avgScore: counts?.avg_score || null,
        avgTutorHolisticScore: counts?.avg_tutor_holistic_score || null,
        avgLearnerScore: counts?.avg_learner_score || null,
        avgLearnerHolisticScore: counts?.avg_learner_holistic_score || null,
        avgDialogueScore: counts?.avg_dialogue_score || null,
        avgDialogueInternalScore: counts?.avg_dialogue_internal_score || null,
        judgeCount: counts?.judge_count || 1,
        progressPct,
        durationMs,
        status: row.status,
        completedAt: row.completed_at,
        scenarioNames,
        models,
        profileNames,
        modelFingerprint,
        metadata: JSON.parse(row.metadata || '{}'),
      };
    });
  }

  function completeRun(runId) {
    const run = getRun(runId);
    if (!run) throw new Error(`Run not found: ${runId}`);
    if (run.status === 'completed') {
      return { alreadyCompleted: true, runId, message: 'Run was already marked as completed' };
    }

    const results = getResults(runId);
    const generationResults = uniqueGenerationResults(results);
    const expectedTests = expectedTestsForRun(run);
    if (results.length === 0) {
      updateRun(runId, { status: 'failed', totalTests: expectedTests, completedAt: nowIso() });
      return {
        runId,
        status: 'failed',
        message: 'No results found - marked as failed',
        resultsFound: 0,
        storedRows: 0,
        expectedTests,
      };
    }

    const lastResultTime = results.reduce((latest, result) => {
      const time = new Date(result.createdAt).getTime();
      return time > latest ? time : latest;
    }, 0);
    const completedAt = new Date(lastResultTime).toISOString();
    updateRun(runId, { status: 'completed', totalTests: expectedTests, completedAt });

    const completionRate = expectedTests > 0 ? (generationResults.length / expectedTests) * 100 : 0;
    const profileBreakdown = {};
    for (const result of generationResults) {
      const profile = result.profileName || 'unknown';
      profileBreakdown[profile] = (profileBreakdown[profile] || 0) + 1;
    }
    writeRunManifest(runId, run, results, completedAt);

    return {
      runId,
      status: 'completed',
      message: 'Run marked as completed with partial results',
      resultsFound: generationResults.length,
      storedRows: results.length,
      expectedTests,
      completionRate: Math.round(completionRate),
      completedAt,
      profileBreakdown,
      wasPartial: generationResults.length < expectedTests,
    };
  }

  function findIncompleteRuns(findOptions = {}) {
    const { olderThanMinutes = 30 } = findOptions;
    const cutoffTime = new Date(now() - olderThanMinutes * 60 * 1000).toISOString();
    const rows = db
      .prepare(
        `SELECT * FROM evaluation_runs
         WHERE status = 'running' AND created_at < ?
         ORDER BY created_at DESC`,
      )
      .all(cutoffTime);

    return rows.map((row) => {
      const storedResults = getResults(row.id);
      const metadata = JSON.parse(row.metadata || '{}');
      const pid = metadata?.pid;
      return {
        id: row.id,
        createdAt: row.created_at,
        description: row.description,
        totalScenarios: row.total_scenarios,
        totalConfigurations: row.total_configurations,
        expectedTests:
          row.total_tests || row.total_scenarios * row.total_configurations * (Number(metadata.runsPerConfig) || 1),
        resultsFound: uniqueGenerationResults(storedResults).length,
        storedRows: storedResults.length,
        ageMinutes: Math.round((now() - new Date(row.created_at).getTime()) / 60000),
        metadata,
        pid,
        pidAlive: isPidAlive(pid),
      };
    });
  }

  function autoCompleteStaleRuns(staleOptions = {}) {
    const { olderThanMinutes = 30, dryRun = false } = staleOptions;
    const incompleteRuns = findIncompleteRuns({ olderThanMinutes });
    const staleRuns = incompleteRuns.filter((run) => {
      const pid = run.metadata?.pid;
      const alive = isPidAlive(pid);
      if (alive) logger.log(`  Skipping ${run.id}: pid ${pid} still running`);
      return !alive;
    });

    if (dryRun) {
      return {
        dryRun: true,
        found: incompleteRuns.length,
        stale: staleRuns.length,
        skippedAlive: incompleteRuns.length - staleRuns.length,
        runs: staleRuns,
      };
    }

    const completed = [];
    for (const run of staleRuns) {
      try {
        completed.push(completeRun(run.id));
      } catch (error) {
        completed.push({ runId: run.id, status: 'error', error: error.message });
      }
    }
    return {
      found: incompleteRuns.length,
      stale: staleRuns.length,
      skippedAlive: incompleteRuns.length - staleRuns.length,
      completed: completed.length,
      runs: completed,
    };
  }

  function deleteRun(runId) {
    const deleteAudit = db.prepare(`
      DELETE FROM score_audit
      WHERE result_id IN (SELECT id FROM evaluation_results WHERE run_id = ?)
    `);
    const deleteResults = db.prepare('DELETE FROM evaluation_results WHERE run_id = ?');
    const deleteInteractionEvals = db.prepare('DELETE FROM interaction_evaluations WHERE run_id = ?');
    const deleteRunRow = db.prepare('DELETE FROM evaluation_runs WHERE id = ?');

    return db.transaction(() => {
      const auditInfo = deleteAudit.run(runId);
      const resultsInfo = deleteResults.run(runId);
      const interactionInfo = deleteInteractionEvals.run(runId);
      const runInfo = deleteRunRow.run(runId);
      return {
        deletedAuditRows: auditInfo.changes,
        deletedResults: resultsInfo.changes,
        deletedInteractionEvals: interactionInfo.changes,
        deletedRuns: runInfo.changes,
      };
    })();
  }

  function getIncompleteTests(runId, profiles, scenarios, incompleteOptions = {}) {
    const run = getRun(runId);
    if (!run) throw new Error(`Run not found: ${runId}`);

    const runsPerConfigValue = incompleteOptions.runsPerConfig ?? run.metadata?.runsPerConfig ?? 1;
    const runsPerConfig = Number(runsPerConfigValue);
    if (!Number.isInteger(runsPerConfig) || runsPerConfig < 1) {
      throw new Error(`Invalid runsPerConfig for ${runId}: ${runsPerConfigValue}`);
    }

    const completedAttempts = new Map();
    const legacyGenerations = new Map();
    for (const result of getResults(runId)) {
      if (result.success === false || result.success === 0) continue;
      const pair = `${result.profileName}:${result.scenarioId}`;
      const attemptIndex = normalizeAttemptIndex(result.attemptIndex);
      if (attemptIndex != null && attemptIndex < runsPerConfig) {
        if (!completedAttempts.has(pair)) completedAttempts.set(pair, new Set());
        completedAttempts.get(pair).add(attemptIndex);
        continue;
      }
      if (!legacyGenerations.has(pair)) legacyGenerations.set(pair, new Set());
      legacyGenerations.get(pair).add(generationIdentity(result));
    }

    for (const [pair, identities] of legacyGenerations.entries()) {
      if (!completedAttempts.has(pair)) completedAttempts.set(pair, new Set());
      const attempts = completedAttempts.get(pair);
      for (const _identity of identities) {
        const openAttempt = Array.from({ length: runsPerConfig }, (_, index) => index).find(
          (index) => !attempts.has(index),
        );
        if (openAttempt == null) break;
        attempts.add(openAttempt);
      }
    }

    const allTests = [];
    const remainingTests = [];
    for (const profile of profiles) {
      for (const scenario of scenarios) {
        const pair = `${profile}:${scenario.id}`;
        const attempts = completedAttempts.get(pair) || new Set();
        for (let attemptIndex = 0; attemptIndex < runsPerConfig; attemptIndex++) {
          const test = {
            profile,
            scenarioId: scenario.id,
            scenarioName: scenario.name,
            attemptIndex,
            runNum: attemptIndex,
          };
          allTests.push(test);
          if (!attempts.has(attemptIndex)) remainingTests.push(test);
        }
      }
    }

    const totalExpected = allTests.length;
    const completed = totalExpected - remainingTests.length;
    const progress = totalExpected > 0 ? (completed / totalExpected) * 100 : 0;
    return {
      runId,
      totalExpected,
      completed,
      remaining: remainingTests.length,
      progress: Math.round(progress),
      remainingTests,
      runsPerConfig,
      status: run.status,
      canResume: remainingTests.length > 0 && run.status === 'running',
    };
  }

  return Object.freeze({
    createRun,
    updateRun,
    getRun,
    listRuns,
    completeRun,
    findIncompleteRuns,
    autoCompleteStaleRuns,
    deleteRun,
    getIncompleteTests,
  });
}
