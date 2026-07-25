import { runDeepPaperChecks, splitPaper } from './paperManifestDeepValidator.js';

export function createPaperManifestReporter() {
  const entries = [];
  const counts = { pass: 0, warn: 0, fail: 0 };

  function add(type, message) {
    entries.push({ type, message });
    if (Object.hasOwn(counts, type)) counts[type]++;
  }

  return {
    heading: (message) => add('heading', message),
    subheading: (message) => add('subheading', message),
    pass: (message) => add('pass', message),
    warn: (message) => add('warn', message),
    fail: (message) => add('fail', message),
    result() {
      return {
        entries: entries.map((entry) => ({ ...entry })),
        passCount: counts.pass,
        warnCount: counts.warn,
        failCount: counts.fail,
        exitCode: counts.fail > 0 ? 1 : 0,
      };
    },
  };
}

function validateManifestShape(manifest, report) {
  if (!manifest || typeof manifest !== 'object') {
    report.fail('Manifest was not provided or is not a JSON object');
    return false;
  }
  if (!Array.isArray(manifest.key_evaluations)) {
    report.fail('Manifest key_evaluations must be an array');
    return false;
  }
  if (!manifest.totals || typeof manifest.totals !== 'object') {
    report.fail('Manifest totals must be an object');
    return false;
  }

  const totalKeys = [
    'expected_scored',
    'expected_attempts',
    'evaluations',
    'opus_primary_count',
    'sonnet_primary_count',
  ];
  let valid = true;
  for (const key of totalKeys) {
    if (!Number.isFinite(manifest.totals[key])) {
      report.fail(`Manifest totals.${key} must be a finite number`);
      valid = false;
    }
  }
  for (const [index, evaluation] of manifest.key_evaluations.entries()) {
    const prefix = `Manifest key_evaluations[${index}]`;
    if (!evaluation || typeof evaluation !== 'object') {
      report.fail(`${prefix} must be an object`);
      valid = false;
      continue;
    }
    if (!evaluation.label) {
      report.fail(`${prefix}.label is required`);
      valid = false;
    }
    if (!Array.isArray(evaluation.run_ids) || evaluation.run_ids.length === 0) {
      report.fail(`${prefix}.run_ids must be a non-empty array`);
      valid = false;
    }
    if (typeof evaluation.primary_judge_pattern !== 'string') {
      report.fail(`${prefix}.primary_judge_pattern must be a string`);
      valid = false;
    }
    if (!Number.isFinite(evaluation.expected_scored)) {
      report.fail(`${prefix}.expected_scored must be a finite number`);
      valid = false;
    }
    if (!Number.isFinite(evaluation.expected_attempts)) {
      report.fail(`${prefix}.expected_attempts must be a finite number`);
      valid = false;
    }
  }
  return valid;
}

function queryEvaluationCounts(db, evaluation) {
  const placeholders = evaluation.run_ids.map(() => '?').join(',');
  const profileClause = evaluation.profile_filter ? ' AND profile_name LIKE ?' : '';
  const parameters = [
    ...evaluation.run_ids,
    evaluation.primary_judge_pattern,
    ...(evaluation.profile_filter ? [evaluation.profile_filter] : []),
  ];
  const scoreColumn = evaluation.unit === 'learner turn' ? 'learner_overall_score' : 'tutor_first_turn_score';
  return db
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN ${scoreColumn} IS NOT NULL THEN 1 ELSE 0 END) AS scored
         FROM evaluation_results
        WHERE run_id IN (${placeholders})
          AND judge_model LIKE ?${profileClause}`,
    )
    .get(...parameters);
}

function validateRuns(manifest, db, fixStatus, report) {
  report.heading('Level 1: Manifest ↔ DB');
  report.subheading('Per-Run Validation');
  let computedAttempts = 0;
  let computedScored = 0;

  for (const evaluation of manifest.key_evaluations) {
    const row = queryEvaluationCounts(db, evaluation);
    const actualTotal = row?.total ?? 0;
    const actualScored = row?.scored ?? 0;

    for (const runId of evaluation.run_ids) {
      const run = db.prepare('SELECT status FROM evaluation_runs WHERE id = ?').get(runId);
      if (!run) {
        report.fail(`${evaluation.label}: run ${runId} not found in evaluation_runs`);
      } else if (run.status !== 'completed') {
        if (fixStatus) {
          db.prepare(
            "UPDATE evaluation_runs SET status = 'completed', completed_at = datetime('now') WHERE id = ?",
          ).run(runId);
          report.warn(`${evaluation.label}: ${runId} was '${run.status}', fixed to 'completed'`);
        } else {
          report.fail(
            `${evaluation.label}: ${runId} status='${run.status}' (expected 'completed'). Use --fix-status to fix.`,
          );
        }
      }
    }

    if (actualScored !== evaluation.expected_scored) {
      const qualifier = evaluation.unit === 'learner turn' ? 'learner scored' : 'scored';
      report.fail(`${evaluation.label}: ${qualifier}=${actualScored}, expected=${evaluation.expected_scored}`);
    } else if (evaluation.unit !== 'learner turn' && actualTotal < evaluation.expected_scored) {
      report.fail(`${evaluation.label}: total=${actualTotal} < scored=${evaluation.expected_scored}`);
    } else if (evaluation.unit === 'learner turn') {
      report.pass(`${evaluation.label}: ${actualScored} learner-scored`);
    } else {
      report.pass(`${evaluation.label}: ${actualScored} scored (${actualTotal} total)`);
    }
    computedAttempts += evaluation.expected_attempts;
    computedScored += evaluation.expected_scored;
  }

  report.subheading('Totals');
  if (computedScored !== manifest.totals.expected_scored) {
    report.fail(`Scored total: sum of rows=${computedScored}, manifest=${manifest.totals.expected_scored}`);
  } else {
    report.pass(`Scored total: ${computedScored}`);
  }
  if (computedAttempts !== manifest.totals.expected_attempts) {
    report.fail(`Attempts total: sum of rows=${computedAttempts}, manifest=${manifest.totals.expected_attempts}`);
  } else {
    report.pass(`Attempts total: ${computedAttempts}`);
  }
  if (manifest.key_evaluations.length !== manifest.totals.evaluations) {
    report.fail(
      `Evaluation count: ${manifest.key_evaluations.length} rows, manifest says ${manifest.totals.evaluations}`,
    );
  } else {
    report.pass(`Evaluation count: ${manifest.key_evaluations.length}`);
  }

  report.subheading('Judge Accounting');
  let opusCount = 0;
  let sonnetCount = 0;
  const sonnetRuns = [];
  for (const evaluation of manifest.key_evaluations) {
    if (evaluation.primary_judge_pattern.includes('sonnet')) {
      sonnetCount++;
      sonnetRuns.push(...evaluation.run_ids);
    } else {
      opusCount++;
    }
  }
  if (opusCount === manifest.totals.opus_primary_count) {
    report.pass(`Opus primary: ${opusCount}`);
  } else {
    report.fail(`Opus primary: counted ${opusCount}, manifest says ${manifest.totals.opus_primary_count}`);
  }
  if (sonnetCount === manifest.totals.sonnet_primary_count) {
    report.pass(`Sonnet primary: ${sonnetCount} (${sonnetRuns.join(', ')})`);
  } else {
    report.fail(`Sonnet primary: counted ${sonnetCount}, manifest says ${manifest.totals.sonnet_primary_count}`);
  }
}

function validatePaperProse(manifest, paper, report) {
  report.subheading('Paper Prose');
  const expectedScored = manifest.totals.expected_scored.toLocaleString();
  const expectedAttempts = manifest.totals.expected_attempts.toLocaleString();
  const scoredPattern = new RegExp(`N[=≈]\\s*${expectedScored}`, 'g');
  const scoredMatches = paper.match(scoredPattern) || [];
  if (scoredMatches.length >= 4) {
    report.pass(`N=${expectedScored} appears ${scoredMatches.length} times in paper`);
  } else {
    report.warn(`N=${expectedScored} appears only ${scoredMatches.length} times (expected ≥4)`);
  }

  const { body } = splitPaper(paper);
  const stalePatterns = [/N[=≈]\s*3,047/g, /N[=≈]\s*3,112/g, /N[=≈]\s*2,906/g, /N[=≈]\s*3,292/g, /N[=≈]\s*3,347/g];
  for (const pattern of stalePatterns) {
    const matches = body.match(pattern) || [];
    if (matches.length > 0) {
      report.fail(`Stale N value found in body: ${pattern.source} appears ${matches.length} times`);
    }
  }

  const totalsRowPattern = new RegExp(`\\*\\*${expectedAttempts}\\*\\*.*\\*\\*${expectedScored}\\*\\*`);
  if (totalsRowPattern.test(paper)) {
    report.pass(`Table 2 totals row matches: ${expectedAttempts}/${expectedScored}`);
  } else {
    report.fail(`Table 2 totals row doesn't match expected ${expectedAttempts}/${expectedScored}`);
  }

  const runIds = [...new Set(manifest.key_evaluations.flatMap((evaluation) => evaluation.run_ids))];
  const missingRunIds = runIds.filter((runId) => !paper.includes(runId));
  for (const runId of missingRunIds) report.fail(`Run ${runId} not found in paper`);
  if (missingRunIds.length === 0) {
    report.pass(`All ${runIds.length} unique run IDs found in paper`);
  }
}

export function validatePaperManifest({
  manifest,
  db,
  paper,
  fixStatus = false,
  deep = false,
  manifestPath = 'manifest input',
  databasePath = 'database input',
  paperPath = 'paper input',
} = {}) {
  const report = createPaperManifestReporter();
  if (!manifest) {
    report.fail(`Manifest not found or unreadable: ${manifestPath}`);
    return report.result();
  }
  if (!validateManifestShape(manifest, report)) return report.result();

  if (!db) {
    report.fail(`Database not found or unreadable: ${databasePath}`);
  } else {
    try {
      validateRuns(manifest, db, fixStatus, report);
    } catch (error) {
      report.fail(`Database validation failed: ${error.message}`);
    }
  }

  if (typeof paper !== 'string') {
    report.fail(`Paper not found or unreadable: ${paperPath}`);
  } else {
    validatePaperProse(manifest, paper, report);
    if (deep) runDeepPaperChecks({ manifest, paper, report });
  }
  return report.result();
}
