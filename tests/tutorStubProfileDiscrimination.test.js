import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function turnEvent(turn, { request, move, evidence, stance, agency, affect, conceptual, epistemic, coverage, missing }) {
  return {
    ts: `2026-07-09T00:00:0${turn}.000Z`,
    runId: 'synthetic',
    seq: turn + 1,
    type: 'turn_complete',
    turn,
    turnRecord: {
      turn,
      learner: `learner turn ${turn}`,
      tutor: `tutor turn ${turn}`,
      classification: {
        turn: {
          summary: `${move} with ${evidence}`,
          request_type: request,
          discourse_move: move,
          evidence_use: evidence,
          epistemic_stance: stance,
          affect,
          agency,
          scores: {
            conceptual_engagement: { score: conceptual },
            epistemic_readiness: { score: epistemic },
          },
          pedagogical_need: 'synthetic need',
        },
      },
      tutorLearnerDagModel: {
        assessment: {
          bestPathCoverage: coverage,
          missingPremiseCount: missing,
          bottleneck: missing ? 'learner_integration_gap' : 'grounded_asserted_secret',
        },
        metrics: {
          missingPremiseCount: missing,
          groundedCount: Math.round(coverage * 6),
        },
      },
      registerSelection: {
        policy: 'field',
        selected_register: turn % 2 ? 'precise' : 'warm',
        distribution: [
          { register: 'precise', probability: 0.6 },
          { register: 'warm', probability: 0.4 },
        ],
      },
    },
  };
}

function writeTrace(root, profile, turns) {
  const dir = path.join(root, profile, 'traces', 'field-r1');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'trace.jsonl');
  const events = [
    {
      ts: '2026-07-09T00:00:00.000Z',
      runId: 'synthetic',
      seq: 1,
      type: 'run_start',
      metadata: {
        world: { id: 'world_005_marrick' },
        resolved: { provider: 'codex', model: 'gpt-5.5' },
        classifier: { resolved: { model: 'gpt-5.5' } },
      },
    },
    ...turns,
  ];
  fs.writeFileSync(file, `${events.map((event) => JSON.stringify(event)).join('\n')}\n`);
}

test('profile discrimination analyzer writes compacted traces and cosine report', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-profile-discrimination-'));
  try {
    writeTrace(tmp, 'diligent', [
      turnEvent(1, {
        request: 'conceptual_clarity_request',
        move: 'metacognitive_reflection',
        evidence: 'none',
        stance: 'reflective',
        agency: 'steering',
        affect: 'cautious',
        conceptual: 4,
        epistemic: 5,
        coverage: 0,
        missing: 6,
      }),
      turnEvent(2, {
        request: 'conceptual_clarity_request',
        move: 'inference',
        evidence: 'links_evidence_to_rule',
        stance: 'grounded',
        agency: 'attempting',
        affect: 'cautious',
        conceptual: 5,
        epistemic: 5,
        coverage: 0.33,
        missing: 4,
      }),
    ]);
    writeTrace(tmp, 'proof_skipper', [
      turnEvent(1, {
        request: 'stepwise_support_request',
        move: 'claim',
        evidence: 'overleaps_evidence',
        stance: 'overconfident',
        agency: 'attempting',
        affect: 'eager',
        conceptual: 3,
        epistemic: 2,
        coverage: 0,
        missing: 6,
      }),
      turnEvent(2, {
        request: 'stepwise_support_request',
        move: 'claim',
        evidence: 'overleaps_evidence',
        stance: 'overconfident',
        agency: 'attempting',
        affect: 'eager',
        conceptual: 3,
        epistemic: 2,
        coverage: 0.16,
        missing: 5,
      }),
    ]);

    const compactedDir = path.join(tmp, 'compacted');
    const report = JSON.parse(
      execFileSync(
        process.execPath,
        [
          'scripts/analyze-tutor-stub-profile-discrimination.js',
          '--trace-root',
          tmp,
          '--write-compacted',
          compactedDir,
          '--json',
        ],
        { cwd: ROOT, encoding: 'utf8' },
      ),
    );

    assert.equal(report.schema, 'machinespirits.tutor-stub.profile-discrimination.v2');
    assert.equal(report.summary.profiles, 2);
    assert.equal(report.summary.traces, 2);
    assert.equal(report.input.compactedWrites.length, 2);
    assert.ok(report.summary.averagePairwiseCosine < 0.5);
    assert.equal(report.gate.mode, 'contract_conditioned');
    assert.equal(report.gate.conditioned.profiles[0].profile, 'proof_skipper');
    assert.equal(report.profiles.find((profile) => profile.profile === 'proof_skipper').observability.observedRate, 1);

    const compactedFiles = fs.readdirSync(path.join(compactedDir, 'diligent'));
    assert.equal(compactedFiles.length, 1);
    const compacted = JSON.parse(fs.readFileSync(path.join(compactedDir, 'diligent', compactedFiles[0]), 'utf8'));
    assert.equal(compacted.schema, 'machinespirits.tutor-stub.compacted-trace.v1');
    assert.equal(compacted.run.profile, 'diligent');
    assert.equal(compacted.turns[0].classifier.discourseMove, 'metacognitive_reflection');
    assert.equal(compacted.turns[0].text, undefined);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
