import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import {
  buildNegativeRegisterEffectGridPlan,
  NEGATIVE_REGISTER_EFFECT_GRID,
  summarizeNegativeRegisterEffects,
  validateNegativeRegisterEffectGridPlan,
} from '../services/negativeRegisterEffectGrid.js';
import {
  assertNegativeRegisterLaunchAuthorization,
  followUpCommands,
  generationCommand,
} from '../scripts/run-negative-register-effect-estimation-grid.js';

const exec = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(__dirname, '..', 'scripts', 'run-negative-register-effect-estimation-grid.js');

function completeAnalyses() {
  const analyses = [];
  for (const [profileIndex, profileName] of NEGATIVE_REGISTER_EFFECT_GRID.profiles.entries()) {
    for (const scenarioId of NEGATIVE_REGISTER_EFFECT_GRID.scenarios) {
      const targetSignal = scenarioId.replace('charisma_desire_resistance_breakthrough_', '');
      for (let repeat = 1; repeat <= NEGATIVE_REGISTER_EFFECT_GRID.repeats; repeat += 1) {
        const faithful = repeat !== 2;
        const invalid = repeat === 3 && profileIndex === 2;
        analyses.push({
          rowId: `${profileIndex}-${targetSignal}-${repeat}`,
          profileName,
          scenarioId,
          targetSignal,
          arm: ['ironic', 'sarcastic', 'face_threat'][profileIndex],
          verdict: repeat === 1 ? 'candidate_router_breakthrough' : 'partial_uptake',
          tutorV22Score: 70 + profileIndex,
          tutorRubricVersion: '2.2',
          tutorJudgeModel: 'claude-code/sonnet-5',
          registerRubricScore: 60 + repeat,
          registerJudgeModel: 'claude-code.sonnet-5',
          stanceFidelity: {
            applies: true,
            countsAsArmEvidence: faithful && !invalid,
            countsAsExcludedNoncompliance: !faithful,
            countsAsInvalidViolation: invalid,
          },
        });
      }
    }
  }
  return analyses;
}

describe('negative-register effect estimation grid', () => {
  it('freezes a deterministic balanced 3 x 5 x 3 plan', () => {
    const first = buildNegativeRegisterEffectGridPlan();
    const second = buildNegativeRegisterEffectGridPlan();
    const validation = validateNegativeRegisterEffectGridPlan(first);

    assert.equal(validation.ok, true);
    assert.equal(first.plannedRows, 45);
    assert.equal(first.jobs.length, 45);
    assert.equal(validation.observedCells, 15);
    assert.equal(first.planSha256, second.planSha256);
    assert.equal(new Set(first.jobs.map((job) => `${job.profile}:${job.scenario}:${job.repeat}`)).size, 45);
  });

  it('pins comparable generation and Sonnet-class scoring seams', () => {
    const generation = generationCommand();
    const followUps = followUpCommands('eval-example');

    assert.equal(generation[generation.indexOf('--runs') + 1], '3');
    assert.equal(generation[generation.indexOf('--tutor-model') + 1], 'codex.gpt-5.5');
    assert.equal(generation[generation.indexOf('--learner-model') + 1], 'codex.gpt-5.5');
    assert.ok(generation.includes('--skip-rubric'));
    assert.deepEqual(followUps[0].slice(2, 5), ['evaluate', 'eval-example', '--tutor-only']);
    assert.equal(followUps[1][followUps[1].indexOf('--judge') + 1], 'claude-code.sonnet-5');
  });

  it('reports assigned and faithful estimands with exclusions and invalid violations kept separate', () => {
    const report = summarizeNegativeRegisterEffects(completeAnalyses());
    const faceThreat = report.byArm.find((row) => row.key === 'face_threat');

    assert.equal(report.status, 'COMPLETE');
    assert.equal(report.observedRows, 45);
    assert.equal(report.byTargetArm.length, 15);
    assert.equal(faceThreat.assignedRows, 15);
    assert.equal(faceThreat.faithfulRows, 5);
    assert.equal(faceThreat.excludedNoncompliance, 5);
    assert.equal(faceThreat.invalidViolations, 5);
    assert.equal(faceThreat.assignedPositiveOutcomes, 5);
    assert.equal(faceThreat.faithfulPositiveOutcomes, 5);
    assert.equal(faceThreat.assignedTutorV22Mean, 72);
  });

  it('fails closed when coverage or required scores are incomplete', () => {
    const analyses = completeAnalyses();
    analyses.pop();
    analyses[0].registerRubricScore = null;
    const report = summarizeNegativeRegisterEffects(analyses);

    assert.equal(report.status, 'INCOMPLETE');
    assert.match(report.errors.join('\n'), /expected 3 rows, found 2/);
    assert.match(report.errors.join('\n'), /missing register-rubric scores/);
  });

  it('runs the default dry-run without creating an evaluation DB or logs', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'negative-register-grid-'));
    const dbPath = path.join(tmpDir, 'evaluations.db');
    const logsPath = path.join(tmpDir, 'logs');
    const outputPath = path.join(tmpDir, 'output');
    try {
      const { stdout } = await exec(process.execPath, [SCRIPT, '--dry-run', '--output-dir', outputPath], {
        timeout: 15000,
        env: { ...process.env, EVAL_DB_PATH: dbPath, EVAL_LOGS_DIR: logsPath },
      });
      assert.match(stdout, /0 model calls; 45 rows/);
      assert.equal(fs.existsSync(dbPath), false);
      assert.equal(fs.existsSync(logsPath), false);
      const artifact = JSON.parse(fs.readFileSync(path.join(outputPath, 'plan.json'), 'utf8'));
      assert.equal(artifact.validation.ok, true);
      assert.equal(artifact.paidLaunchStatus, 'locked_pending_explicit_user_approval');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('rejects paid launch authorization without an exact commit SHA', () => {
    assert.throws(() => assertNegativeRegisterLaunchAuthorization(''), /exact 40-character clean commit SHA/);
  });

  it('rejects contradictory dry-run and paid-launch flags before generation', async () => {
    await assert.rejects(
      exec(process.execPath, [SCRIPT, '--dry-run', '--launch-approved'], { timeout: 15000 }),
      /choose either --dry-run or --launch-approved/,
    );
  });
});
