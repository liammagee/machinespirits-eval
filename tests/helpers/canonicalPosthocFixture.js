import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const TUTOR_DIMENSIONS = [
  'perception_quality',
  'pedagogical_craft',
  'elicitation_quality',
  'adaptive_responsiveness',
  'recognition_quality',
  'productive_difficulty',
  'epistemic_integrity',
  'content_accuracy',
];

const LEARNER_DIMENSIONS = [
  'engagement_quality',
  'reasoning_quality',
  'epistemic_agency',
  'revision_quality',
  'transfer_quality',
  'metacognitive_awareness',
];

function clampScore(value) {
  return Math.max(1, Math.min(5, value));
}

function perTurnScores(overalls, dimensionScores, dimensions) {
  return Object.fromEntries(
    overalls.map((overallScore, turnIndex) => {
      const center = dimensionScores[turnIndex];
      const scores = Object.fromEntries(
        dimensions.map((dimension, index) => [dimension, { score: clampScore(center + ((index % 3) - 1) * 0.1) }]),
      );
      return [String(turnIndex), { turnIndex, overallScore, scores }];
    }),
  );
}

function buildDialogueLog(fixture, dialogue) {
  const dialogueTrace = [];
  const turnResults = [];
  for (let turnIndex = 0; turnIndex < dialogue.tutorMessages.length; turnIndex++) {
    const tutorMessage = dialogue.tutorMessages[turnIndex];
    const learnerMessage = dialogue.learnerMessages[turnIndex];
    dialogueTrace.push(
      {
        agent: 'ego',
        action: 'generate',
        turnIndex,
        round: turnIndex * 2,
        suggestions: [{ message: `${tutorMessage} Initial draft.` }],
      },
      {
        agent: 'ego_self_reflection',
        action: 'deliberation',
        turnIndex,
        detail: `The learner said something specific in turn ${turnIndex}; adapt this particular question.`,
      },
      {
        agent: 'superego_self_reflection',
        action: 'deliberation',
        turnIndex,
        detail: `The learner's response in turn ${turnIndex} needs a specific test rather than generic scaffolding.`,
      },
      {
        agent: 'ego',
        action: 'revise',
        turnIndex,
        round: turnIndex * 2 + 1,
        suggestions: [{ message: tutorMessage }],
      },
      { agent: 'tutor', action: 'final_output', turnIndex, detail: tutorMessage },
      { agent: 'learner', action: 'turn_action', turnIndex, detail: learnerMessage, contextSummary: learnerMessage },
      { agent: 'learner', action: 'final_output', turnIndex, detail: learnerMessage },
    );
    turnResults.push({ turnIndex, suggestions: [{ message: tutorMessage }] });
  }
  return {
    schemaVersion: fixture.traceSchemaVersion,
    dialogueId: dialogue.id,
    dialogueTrace,
    turnResults,
  };
}

function createSchema(db) {
  db.exec(`
    CREATE TABLE evaluation_results (
      id TEXT PRIMARY KEY,
      run_id TEXT,
      scenario_id TEXT,
      scenario_name TEXT,
      profile_name TEXT,
      model TEXT,
      ego_model TEXT,
      superego_model TEXT,
      factor_recognition INTEGER,
      factor_multi_agent_tutor INTEGER,
      factor_multi_agent_learner INTEGER,
      tutor_scores TEXT,
      learner_scores TEXT,
      suggestions TEXT,
      tutor_overall_score REAL,
      tutor_first_turn_score REAL,
      tutor_last_turn_score REAL,
      tutor_development_score REAL,
      learner_overall_score REAL,
      learner_holistic_overall_score REAL,
      overall_score REAL,
      scores_with_reasoning TEXT,
      success INTEGER,
      dialogue_id TEXT,
      dialogue_rounds INTEGER,
      created_at TEXT,
      judge_model TEXT,
      score_relevance REAL,
      score_specificity REAL,
      score_pedagogical REAL,
      score_personalization REAL,
      score_actionability REAL,
      score_tone REAL,
      tutor_rubric_version TEXT,
      learner_rubric_version TEXT,
      config_hash TEXT,
      dialogue_content_hash TEXT,
      prompt_content_hash TEXT,
      attempt_index INTEGER
    );
    CREATE TABLE within_test_change_metrics (
      run_id TEXT,
      dialogue_id TEXT,
      metric_version TEXT,
      method TEXT,
      side TEXT,
      first_score REAL,
      last_score REAL,
      delta_pts REAL,
      slope_per_turn REAL
    );
  `);
}

function insertRows(db, fixture) {
  const insert = db.prepare(`
    INSERT INTO evaluation_results (
      id, run_id, scenario_id, scenario_name, profile_name, model, ego_model, superego_model,
      factor_recognition, factor_multi_agent_tutor, factor_multi_agent_learner,
      tutor_scores, learner_scores, suggestions, tutor_overall_score, tutor_first_turn_score,
      tutor_last_turn_score, tutor_development_score, learner_overall_score,
      learner_holistic_overall_score, overall_score, scores_with_reasoning, success,
      dialogue_id, dialogue_rounds, created_at, judge_model,
      score_relevance, score_specificity, score_pedagogical, score_personalization,
      score_actionability, score_tone, tutor_rubric_version, learner_rubric_version,
      config_hash, dialogue_content_hash, prompt_content_hash, attempt_index
    ) VALUES (
      @id, @run_id, @scenario_id, @scenario_name, @profile_name, @model, @ego_model, @superego_model,
      @factor_recognition, @factor_multi_agent_tutor, @factor_multi_agent_learner,
      @tutor_scores, @learner_scores, @suggestions, @tutor_overall_score, @tutor_first_turn_score,
      @tutor_last_turn_score, @tutor_development_score, @learner_overall_score,
      @learner_holistic_overall_score, @overall_score, @scores_with_reasoning, @success,
      @dialogue_id, @dialogue_rounds, @created_at, @judge_model,
      @score_relevance, @score_specificity, @score_pedagogical, @score_personalization,
      @score_actionability, @score_tone, @tutor_rubric_version, @learner_rubric_version,
      @config_hash, @dialogue_content_hash, @prompt_content_hash, @attempt_index
    )
  `);
  const insertMetric = db.prepare(`
    INSERT INTO within_test_change_metrics (
      run_id, dialogue_id, metric_version, method, side,
      first_score, last_score, delta_pts, slope_per_turn
    ) VALUES (?, ?, 'within-test-v2-aligned-proxy', 'rubric', 'learner', ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    for (const dialogue of fixture.dialogues) {
      const tutorScores = perTurnScores(dialogue.tutorScores, dialogue.tutorDimensionScores, TUTOR_DIMENSIONS);
      const learnerScores = perTurnScores(dialogue.learnerScores, dialogue.learnerDimensionScores, LEARNER_DIMENSIONS);
      const suggestions = JSON.stringify([{ message: dialogue.tutorMessages.at(-1) }]);
      const finalTutorDimensions = tutorScores['2'].scores;
      const common = {
        run_id: fixture.runId,
        scenario_id: dialogue.scenarioId,
        scenario_name: `Fixture ${dialogue.scenarioId}`,
        profile_name: dialogue.profileName,
        model: 'fixture.model',
        ego_model: 'fixture.ego',
        superego_model: null,
        factor_recognition: dialogue.recognition ? 1 : 0,
        factor_multi_agent_tutor: 0,
        factor_multi_agent_learner: 1,
        tutor_scores: JSON.stringify(tutorScores),
        learner_scores: JSON.stringify(learnerScores),
        suggestions,
        tutor_overall_score: dialogue.tutorScores.at(-1),
        tutor_last_turn_score: dialogue.tutorScores.at(-1),
        tutor_development_score: dialogue.tutorScores.at(-1) - dialogue.tutorScores[0],
        learner_overall_score: dialogue.learnerScores.at(-1),
        learner_holistic_overall_score: dialogue.learnerScores.at(-1),
        overall_score: dialogue.primaryScore,
        scores_with_reasoning: JSON.stringify(finalTutorDimensions),
        success: 1,
        dialogue_id: dialogue.id,
        dialogue_rounds: 3,
        created_at: '2026-07-01T00:00:00.000Z',
        tutor_rubric_version: '2.2',
        learner_rubric_version: '2.2',
        config_hash: dialogue.recognition ? 'config-recognition-v1' : 'config-baseline-v1',
        dialogue_content_hash: `dialogue-hash-${dialogue.id}`,
        prompt_content_hash: dialogue.recognition ? 'prompt-recognition-v1' : 'prompt-baseline-v1',
        attempt_index: 0,
      };
      for (const [suffix, judgeModel, score] of [
        ['primary', fixture.primaryJudge, dialogue.primaryScore],
        ['secondary', fixture.secondaryJudge, dialogue.secondaryScore],
      ]) {
        const dimensionScore = score / 20;
        insert.run({
          ...common,
          id: `${dialogue.id}-${suffix}`,
          judge_model: judgeModel,
          tutor_first_turn_score: score,
          score_relevance: dimensionScore,
          score_specificity: clampScore(dimensionScore + 0.1),
          score_pedagogical: clampScore(dimensionScore - 0.1),
          score_personalization: dimensionScore,
          score_actionability: clampScore(dimensionScore + 0.2),
          score_tone: clampScore(dimensionScore - 0.2),
        });
      }
      const learnerFirst = dialogue.learnerScores[0];
      const learnerLast = dialogue.learnerScores.at(-1);
      insertMetric.run(
        fixture.runId,
        dialogue.id,
        learnerFirst,
        learnerLast,
        learnerLast - learnerFirst,
        (learnerLast - learnerFirst) / 2,
      );
    }

    insert.run({
      id: 'missing-data-row',
      run_id: fixture.runId,
      scenario_id: 'scenario-missing',
      scenario_name: 'Missing data sentinel',
      profile_name: 'cell_1_base_single_unified',
      model: 'fixture.model',
      ego_model: 'fixture.ego',
      superego_model: null,
      factor_recognition: 0,
      factor_multi_agent_tutor: 0,
      factor_multi_agent_learner: 0,
      tutor_scores: null,
      learner_scores: null,
      suggestions: null,
      tutor_overall_score: null,
      tutor_first_turn_score: null,
      tutor_last_turn_score: null,
      tutor_development_score: null,
      learner_overall_score: null,
      learner_holistic_overall_score: null,
      overall_score: null,
      scores_with_reasoning: null,
      success: 0,
      dialogue_id: null,
      dialogue_rounds: null,
      created_at: '2026-07-01T00:00:00.000Z',
      judge_model: null,
      score_relevance: null,
      score_specificity: null,
      score_pedagogical: null,
      score_personalization: null,
      score_actionability: null,
      score_tone: null,
      tutor_rubric_version: null,
      learner_rubric_version: null,
      config_hash: null,
      dialogue_content_hash: null,
      prompt_content_hash: null,
      attempt_index: 0,
    });
  });
  transaction();
}

export function materializeCanonicalPosthocFixture(fixture, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  const dbPath = path.join(targetDir, 'evaluations.db');
  const logsDir = path.join(targetDir, 'tutor-dialogues');
  fs.mkdirSync(logsDir, { recursive: true });
  const db = new Database(dbPath);
  try {
    createSchema(db);
    insertRows(db, fixture);
  } finally {
    db.close();
  }
  for (const dialogue of fixture.dialogues) {
    const log = buildDialogueLog(fixture, dialogue);
    fs.writeFileSync(path.join(logsDir, `${dialogue.id}.json`), `${JSON.stringify(log, null, 2)}\n`);
  }
  return { dbPath, logsDir };
}

function stripTimestamps(value) {
  if (Array.isArray(value)) return value.map(stripTimestamps);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== 'generatedAt' && key !== 'generated_at')
      .map(([key, entry]) => [key, stripTimestamps(entry)]),
  );
}

function roundNumbers(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value * 1_000_000_000) / 1_000_000_000;
  }
  if (Array.isArray(value)) return value.map(roundNumbers);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, roundNumbers(entry)]));
}

export function projectCanonicalPosthocOutputs(outputDir) {
  const read = (name) => JSON.parse(fs.readFileSync(path.join(outputDir, name), 'utf8'));
  const effects = stripTimestamps(read('effects.json'));
  const traces = stripTimestamps(read('mechanism-traces.json'));
  const trajectories = stripTimestamps(read('trajectories.json'));
  const stagnation = stripTimestamps(read('stagnation.json'));
  const reliability = stripTimestamps(read('reliability.json'));
  const projection = {
    manifest: read('pipeline-manifest.json'),
    effects: {
      profiles: Object.fromEntries(
        Object.entries(effects.profiles).map(([name, stats]) => [
          name,
          { n: stats.n, mean: stats.ci.mean, sdInputs: stats.scores },
        ]),
      ),
      comparisons: effects.comparisons,
      dimensions: effects.dimensions,
    },
    traces: {
      summary: traces.summary,
      dialogueIds: traces.measures.map((measure) => measure.dialogueId).sort(),
    },
    trajectories: {
      config: trajectories.config,
      summary: trajectories.summary,
      calibration: trajectories.calibration,
      meanOverallTrajectories: Object.fromEntries(
        Object.entries(trajectories.meanTrajectories).map(([condition, values]) => [
          condition,
          {
            n: values.n,
            tutor: values.tutor.map((turn) => turn.overallMean),
            learner: values.learner.map((turn) => turn.overallMean),
          },
        ]),
      ),
      hypothesisTests: {
        tutorPerceptionSlope: trajectories.hypothesisTests.H1_tutor_dimension_slopes.perception_quality,
        learnerEngagementSlope: trajectories.hypothesisTests.H1_learner_dimension_slopes.engagement_quality,
        asymmetry: trajectories.hypothesisTests.H2_tutor_learner_asymmetry,
        overallSlope: trajectories.hypothesisTests.overall_slope,
      },
      dialogueSlopes: trajectories.dialogues.map((dialogue) => ({
        dialogueId: dialogue.dialogueId,
        condition: dialogue.condition,
        tutorOverallSlope: dialogue.tutorOverallSlope,
        learnerOverallSlope: dialogue.learnerOverallSlope,
      })),
    },
    stagnation: {
      runs: stagnation.runs,
      metricVersion: stagnation.metricVersion,
      coverage: stagnation.coverage,
      runSummaries: stagnation.runSummaries,
      recognitionEffects: stagnation.recognitionEffects,
      featureMeansByDelta: stagnation.featureMeansByDelta,
      featureMeansByRecognition: stagnation.featureMeansByRecognition,
      tailFailureStats: stagnation.tailFailureStats,
      worst: stagnation.worst.map((row) => ({
        scenarioId: row.scenarioId,
        profileName: row.profileName,
        delta: row.delta,
      })),
      best: stagnation.best.map((row) => ({
        scenarioId: row.scenarioId,
        profileName: row.profileName,
        delta: row.delta,
      })),
    },
    reliability,
  };
  return roundNumbers(projection);
}
