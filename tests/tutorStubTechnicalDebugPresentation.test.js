import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { projectTutorStubTechnicalDebugLines } from '../services/tutorStubTechnicalDebugPresentation.js';
import { runInteractive } from './helpers/tutorStubInteractiveHarness.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COLORS = Object.freeze({
  brightBlue: '<blue>',
  brightCyan: '<cyan>',
  brightYellow: '<yellow>',
  brightMagenta: '<magenta>',
  bold: '<bold>',
  dim: '<dim>',
  reset: '<reset>',
});

function terminalBytes(lines) {
  return lines.map((line) => `${line}\n`).join('');
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

test('technical-debug projection preserves dense calculation and decision branches', () => {
  const input = {
    turn: {
      turn: 3,
      classification: {
        turn: {
          summary: 'The learner joined two public clues.',
          request_type: 'evidence_synthesis',
          discourse_move: 'supported_inference',
          evidence_use: 'integrated',
          epistemic_stance: 'testing',
          agency: 'leading',
        },
        overall: { summary: 'The inquiry is converging.' },
      },
      tutorLearnerDagModel: {
        assessment: { bestPathCoverage: 0.75, missingPremiseCount: 1, bottleneck: 'p4' },
        metrics: { groundedCount: 3, missingPremiseCount: 1 },
      },
      releasePacing: {
        baseSpeed: 1,
        effectiveSpeed: 1.5,
        direction: 'accelerate',
        signal: { reason: 'The learner supplied a warranted chain.' },
        releasedNow: ['p3', 'p4'],
      },
    },
    turnIdentifier: 'fixture:t003',
    selection: {
      engagement_stance: 'precise',
      selected_register: 'precise',
      policy: 'field',
      activated_policy: 'trajectory',
      temperature: 0.7,
      random_performance: { enabled: true },
      policy_composition: {
        activated_overlay: 'trajectory',
        activated_strength: 0.8,
        overlay_threshold: 0.6,
      },
      register_reason: 'Test the warrant without taking over.',
      action_family: 'test_warrant',
      audience_register: 'domain_apprentice',
      lexical_accessibility: 'plain_language',
      scene_immersion: 'inside_archive',
      dynamical_system_policy: {
        state_vector: { momentum: 0.8, risk: 0.2, evidence_gap: 0.5 },
        derivative_vector: { momentum: 0.2, risk: -0.3, evidence_gap: -0.1 },
        scores: { precise: 0.9, warm: 0.4, playful: 0.1 },
      },
    },
    previousSelection: { engagement_stance: 'warm' },
    policyCalculation: {
      features: {
        field: { beforeScore: 0.2, afterScore: 0.45, delta: 0.25, relation: 'productive' },
        dag: {
          progressScore: 0.75,
          progress: 0.5,
          bestPathCoverage: 0.75,
          missingPremiseCount: 1,
          bottleneck: 'p4',
        },
      },
      scores: { precise: 0.9, warm: 0.4 },
      drivers: ['learner offered a supported inference'],
    },
    field: {
      rows: [
        { learnerMastery: 0.2, learnerRisk: 0.5, tutorAlignment: 0.4, jointMomentum: 0.2 },
        {
          learnerMastery: 0.6,
          learnerRisk: 0.3,
          tutorAlignment: 0.7,
          jointMomentum: 0.65,
          calculation: {
            inputs: {
              conceptual: 0.8,
              readiness: 0.75,
              coverage: 0.7,
              grounded: 0.6,
              missing: 0.25,
              overreach: 0.1,
              registerConfidence: 0.82,
              efficacyScore: 0.7,
              brevity: 0.9,
              leakOk: true,
              masteryGain: 0.4,
              coverageGain: 0.3,
              releasedShare: 0.5,
            },
          },
        },
      ],
    },
    distribution: 'precise 65%, warm 35%',
    registerPolicy: 'field',
    registerTemperature: 1,
    colors: COLORS,
  };
  const before = structuredClone(input);
  const lines = projectTutorStubTechnicalDebugLines(input);
  const output = terminalBytes(lines);

  assert.equal(sha256(output), '3232e696654b999d21d1e3639524abd27da702b12a0795ed57fd3a29e4bcd494');
  assert.match(output, /A · learner analysis<reset>/u);
  assert.match(output, /policy input field: surface 0\.2 → 0\.45 \(Δ \+0\.25\); relation=productive/u);
  assert.match(output, /mastery calculation: 0\.34×0\.8 \+ 0\.26×0\.75/u);
  assert.match(output, /field updated for next turn: mastery=0\.6 \(\+0\.4\); risk=0\.3 \(-0\.2\)/u);
  assert.match(output, /system vector: momentum=0\.8, evidence_gap=0\.5, risk=0\.2/u);
  assert.match(output, /register change: warm → precise/u);
  assert.match(output, /random performance: engagement stance and host character sampled/u);
  assert.match(output, /overlay result: trajectory overrode the primary at strength 0\.8/u);
  assert.match(output, /clue release pace: 1x base → 1\.5x effective \(accelerate\)/u);
  assert.match(output, /response configuration: action=test_warrant; audience=domain_apprentice/u);
  assert.equal(Object.isFrozen(lines), true);
  assert.deepEqual(input, before);
});

test('technical-debug projection preserves no-turn and sparse fallback contracts', () => {
  assert.deepEqual(projectTutorStubTechnicalDebugLines({ colors: COLORS }), [
    '<blue><bold>debug explain ><reset> no completed turns yet\n',
  ]);

  const initial = terminalBytes(
    projectTutorStubTechnicalDebugLines({
      turn: { turn: 1, classification: {}, tutorLearnerDagModel: {} },
      turnIdentifier: 'run:t001',
      selection: { selected_register: 'plain' },
      policyCalculation: { features: null, scores: { plain: 0.4 }, drivers: ['plain fallback'] },
      registerPolicy: 'dynamic',
      registerTemperature: 0.5,
      colors: COLORS,
    }),
  );
  assert.match(initial, /reading: No classifier summary was stored\./u);
  assert.match(initial, /reasoning record: coverage=n\/a; grounded=0; missing=n\/a; bottleneck=unknown/u);
  assert.match(initial, /stance scores: plain=0\.4/u);
  assert.match(initial, /register change: initial choice → plain/u);
  assert.match(initial, /policy path: stack=dynamic; activated=off; temperature=0\.5/u);
  assert.match(initial, /decision basis: plain fallback/u);
  assert.match(initial, /response configuration: action=none; audience=unknown; language=unknown; scene=unknown/u);
  assert.doesNotMatch(initial, /policy input field:|mastery calculation:/u);

  const held = terminalBytes(
    projectTutorStubTechnicalDebugLines({
      turn: { turn: 2 },
      selection: {
        selected_register: 'plain',
        policy_composition: { activated_overlay: null, overlay_threshold: 0.7 },
      },
      previousSelection: { selected_register: 'plain' },
      policyCalculation: { features: null, scores: null, drivers: [] },
    }),
  );
  assert.match(held, /register change: plain held/u);
  assert.match(held, /overlay result: no overlay crossed 0\.7; primary retained/u);
});

test('the CLI retains gating, live preparation, trace persistence, and terminal ownership', async () => {
  const cliSource = fs.readFileSync(path.join(ROOT, 'scripts', 'tutor-stub.js'), 'utf8');
  const serviceSource = fs.readFileSync(path.join(ROOT, 'services', 'tutorStubTechnicalDebugPresentation.js'), 'utf8');
  const printSlice = cliSource.slice(
    cliSource.indexOf('function printExplanatoryDebugTechnical'),
    cliSource.indexOf('function explanatoryDebugModel'),
  );

  assert.match(cliSource, /from '\.\.\/services\/tutorStubTechnicalDebugPresentation\.js';/u);
  assert.match(printSlice, /state\.explanatoryDebug\?\.enabled/u);
  assert.match(printSlice, /printWithConcurrentTerminal/u);
  assert.match(printSlice, /normalizeStoredRegisterSelection/u);
  assert.match(printSlice, /registerPolicyCalculation/u);
  assert.match(printSlice, /buildLightweightDialogueField/u);
  assert.match(printSlice, /formatEngagementStanceDistribution/u);
  assert.match(printSlice, /projectTutorStubTechnicalDebugLines/u);
  assert.match(printSlice, /for \(const line of lines\) console\.log\(line\)/u);
  assert.match(printSlice, /appendTraceEvent\(state\.trace/u);
  assert.doesNotMatch(serviceSource, /\b(?:spawnSync|fs|console|process|fetch|Date\.now)\s*[.(]/u);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-technical-debug-presentation-'));
  try {
    const result = await runInteractive({
      tmp,
      args: [
        '--no-opening',
        '--no-classifier',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--trace-dir',
        tmp,
        '--world',
        'world_005_marrick',
        '--run-seed',
        '314159',
        '--no-color',
      ],
      initialInput: 'The assay still confuses me.\n',
      followupInputs: [{ afterPlainIncludes: 'tutor >', text: '/debug technical\n' }],
      stopWhen: (plain) => /debug explain >[\s\S]*?\/debug on returns to concise prose\n\n/u.test(plain),
      timeoutMs: 20_000,
      env: {
        NO_COLOR: '1',
        TUTOR_STUB_REMEMBER_SETTINGS: '0',
        TUTOR_STUB_SUMMARY_OPEN: '0',
      },
    });
    const block = result.plain.match(
      /debug explain > turn 1 · [^\n]+\n[\s\S]*?\/debug on returns to concise prose\n\n/u,
    )?.[0];
    const normalized = block?.replace(/turn 1 · [^\n]+:t001/u, 'turn 1 · <run>:t001');
    assert.equal(Buffer.byteLength(normalized), 1316);
    assert.equal(sha256(normalized), '5f5d63300c55e4402bfc1a8f9ac7aa911655151757612d7f2ba3de16985eac6d');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
