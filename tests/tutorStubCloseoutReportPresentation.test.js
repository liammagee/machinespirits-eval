import { createHash } from 'node:crypto';

import { projectTutorStubCloseoutReportLines } from '../services/tutorStubCloseoutReportPresentation.js';
import {
  assert,
  fs,
  installFakeCodex,
  os,
  path,
  plainTerminalText,
  ROOT,
  spawnSync,
  test,
} from './helpers/tutorStubInteractiveHarness.js';

const COLORS = { cyan: '<cyan>', dim: '<dim>', reset: '</>' };
const LIVE_CLOSEOUT_HASH = 'e3ca5f7f59498d709331946f65417197bbd9ba22f54b8ae6d7c77b185013c92c';

function densePayload() {
  return {
    turnCount: 2,
    trainingReuse: { status: 'training_candidate', requested: 'mixed', humanSubjectClass: 'human' },
    finalAssessment: { bestPathCoverage: 0.625, missingPremiseCount: 2, bottleneck: 'warrant_gap' },
    field: {
      final: { learnerMastery: 0.7, learnerRisk: 0.2, tutorAlignment: 0.8, jointMomentum: 0.6 },
      fieldDelta: { learnerMastery: 0.3, learnerRisk: -0.1 },
    },
    learning: { progress: { acceleratedTurnCount: 1, maxSupportedMoves: 3 } },
    releasePacing: {
      baseSpeed: 1.5,
      counts: { accelerationSignals: 2, decelerationSignals: 1, early: 1 },
    },
    responseConfigurationVisibility: {
      turns: 2,
      mean_realization_rate: 0.875,
      pairwise_visible_difference_rate: 0.5,
      distinct_configuration_count: 2,
    },
    guardAccounting: {
      originalCandidateAcceptedTurns: 1,
      accountedTurns: 2,
      mechanicalRepairTurns: 1,
      modelRepairTurns: 1,
      deterministicFallbackTurns: 0,
      finalDeliveryAuditFailures: 1,
      meanTutorGenerationLatencyMs: 123.6,
    },
    humanDiscourse: {
      config: { scaffoldActive: true },
      finalStatus: 'public_grounded',
      proofDebtStatus: 'open',
      sideArcCount: 1,
      openProofDebtCount: 2,
      elidedBridgeCount: 1,
      questionSupportModes: { bounded_choice: 2, none: 1 },
    },
    comprehension: {
      features: { unresolvedTerms: ['cupel'], explainedTerms: ['blank'], languageOpacity: 0.4 },
    },
    finalTurn: {
      turnId: 'turn-fixed',
      learner: '  The cupel   term is still unclear.  ',
      tutor: 'I will explain the cupel, then return to the residue comparison.',
      leakOk: false,
    },
  };
}

test('closeout report projection preserves dense ordering, wording, colors, and optional sections', () => {
  const payload = densePayload();
  const before = structuredClone(payload);
  const lines = projectTutorStubCloseoutReportLines({
    reason: 'report_during_turn',
    tracePath: 'dialogue-logs/fixed.jsonl',
    payload,
    lastTurn: { dialogueClosure: { lifecycle: { phase: 'awaiting_checkin' } } },
    registerCounts: 'precise 1, warm 1',
    bottleneckCounts: 'warrant_gap 2',
    colors: COLORS,
  });

  assert.deepEqual(payload, before, 'presentation must not mutate the report payload');
  assert.equal(Object.isFrozen(lines), true);
  assert.deepEqual(lines, [
    '<cyan>session summary ></> summary requested while the next response was being prepared; 2 completed turn(s)',
    '<dim>  technical trace: dialogue-logs/fixed.jsonl</>',
    '<dim>  training reuse: training candidate; requested mixed; human</>',
    '<dim>  outcome: The conclusion was stated; one optional final check-in remains.</>',
    '<dim>  reasoning progress: 63% of the strongest proof path; 2 evidence step(s) still missing; current sticking point warrant gap; answer-secrecy check failed</>',
    '<dim>  interaction measures: learner progress 0.7, pressure 0.2, tutor alignment 0.8, momentum 0.6; progress change +0.3, pressure change -0.1</>',
    '<dim>  tutor styles used: precise 1, warm 1</>',
    '<dim>  learner pace: accelerated on 1 turn(s); longest supported leap 3 moves</>',
    '<dim>  clue pace: 1.5x base; 2 faster request(s), 1 slower request(s); 1 clue(s) released early</>',
    '<dim>  intended tutor style visible in wording: 88%; visible difference between styles 50% across 2 configuration(s)</>',
    '<dim>  response checks: first drafts accepted 1/2; mechanical repairs 1; model rewrites 1; safe fallbacks 0; final check failures 1; mean tutor generation 124ms</>',
    '<dim>  sticking points seen: warrant_gap 2</>',
    '<dim>  human-friendly reasoning: public_grounded; deferred proof steps open; side questions 1; open deferred steps 2; obvious steps carried forward 1; question support bounded_choice 2, none 1</>',
    '<dim>  language help: still unclear cupel; explained blank; difficulty 0.4</>',
    '<dim>  technical turn id: turn-fixed</>',
    '<dim>  last learner: The cupel term is still unclear.</>',
    '<dim>  last tutor: I will explain the cupel, then return to the residue comparison.</>\n',
  ]);
});

test('closeout report projection preserves no-turn and sparse omission contracts', () => {
  assert.deepEqual(projectTutorStubCloseoutReportLines({ reason: 'exit', tracePath: 'trace.jsonl', colors: COLORS }), [
    '<cyan>session summary ></> ended by you; no completed tutor turns',
    '<dim>  technical trace: trace.jsonl</>',
    '<dim>  start with the tutor opening prompt, then enter one learner turn to build a report</>\n',
  ]);

  const payload = densePayload();
  payload.finalAssessment = { bestPathCoverage: null, missingPremiseCount: 0, bottleneck: null };
  payload.field.fieldDelta = { learnerMastery: -0.2, learnerRisk: 0 };
  payload.learning.progress = { acceleratedTurnCount: 0, maxSupportedMoves: 0 };
  payload.releasePacing = null;
  payload.responseConfigurationVisibility.turns = 0;
  payload.guardAccounting.meanTutorGenerationLatencyMs = null;
  payload.humanDiscourse.config = { scaffoldActive: false };
  payload.comprehension.features = { unresolvedTerms: [], explainedTerms: [], languageOpacity: 0 };
  payload.finalTurn.leakOk = null;
  payload.finalTurn.tutor = 'x'.repeat(240);
  const lines = projectTutorStubCloseoutReportLines({ payload, lastTurn: null });

  assert.equal(
    lines.some((line) => line.includes('learner pace:')),
    false,
  );
  assert.equal(
    lines.some((line) => line.includes('clue pace:')),
    false,
  );
  assert.equal(
    lines.some((line) => line.includes('intended tutor style')),
    false,
  );
  assert.equal(
    lines.some((line) => line.includes('human-friendly reasoning:')),
    false,
  );
  assert.equal(
    lines.some((line) => line.includes('language help:')),
    false,
  );
  assert.match(lines[3], /reasoning progress: 0%.*answer-secrecy check not available/u);
  assert.match(lines[4], /progress change -0\.2, pressure change \+0/u);
  assert.match(lines.at(-1), /x{217}\.\.\.\n$/u);
});

test('the CLI retains report assembly and effects while live closeout output stays byte-identical', () => {
  const cliSource = fs.readFileSync(path.join(ROOT, 'scripts', 'tutor-stub.js'), 'utf8');
  const serviceSource = fs.readFileSync(path.join(ROOT, 'services', 'tutorStubCloseoutReportPresentation.js'), 'utf8');
  const closeoutSlice = cliSource.slice(
    cliSource.indexOf('function printDialogueCloseout'),
    cliSource.indexOf('\nfunction dagTurnContext', cliSource.indexOf('function printDialogueCloseout')),
  );

  assert.match(cliSource, /projectTutorStubCloseoutReportLines/u);
  assert.match(closeoutSlice, /buildLightweightDialogueField/u);
  assert.match(closeoutSlice, /buildDialogueLearningSummary/u);
  assert.match(closeoutSlice, /traceDisplayPath/u);
  assert.match(closeoutSlice, /for \(const line of lines\) console\.log\(line\)/u);
  assert.match(closeoutSlice, /return payload/u);
  assert.doesNotMatch(closeoutSlice, /reasoning progress:|response checks:|sticking points seen:/u);
  assert.doesNotMatch(serviceSource, /\b(?:console|fs|process|fetch)\s*\./u);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-closeout-live-'));
  try {
    installFakeCodex(tmp);
    const result = spawnSync(
      process.execPath,
      [
        'scripts/tutor-stub.js',
        '--model',
        'codex.gpt-5.6-terra',
        '--settings-file',
        path.join(tmp, 'settings.json'),
        '--world',
        'none',
        '--no-opening',
        '--no-classifier',
        '--no-register-selection',
        '--no-stream',
        '--no-interim-animation',
        '--no-trace',
        '--no-remember-settings',
        '--once',
        'I would compare the residue before naming a person.',
      ],
      {
        cwd: ROOT,
        encoding: 'utf8',
        timeout: 15_000,
        env: {
          ...process.env,
          PATH: `${tmp}${path.delimiter}${process.env.PATH || ''}`,
          CLI_PROVIDER_CODEX_TIMEOUT_MS: '5000',
          TUTOR_STUB_OPENING_REALIZER: 'deterministic',
        },
      },
    );
    assert.equal(result.status, 0, `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
    const plain = plainTerminalText(result.stdout);
    const start = plain.indexOf('session summary >');
    const end = plain.indexOf('\nlearning summary >', start);
    assert.notEqual(start, -1, plain);
    const normalized = plain
      .slice(start, end === -1 ? undefined : end)
      .replace(/mean tutor generation \d+ms/gu, 'mean tutor generation <ms>')
      .replace(/technical turn id: [^\n]+/gu, 'technical turn id: <turn-id>')
      .trimEnd();
    assert.equal(Buffer.byteLength(normalized), 1208);
    assert.equal(createHash('sha256').update(normalized).digest('hex'), LIVE_CLOSEOUT_HASH);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
