import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  REGISTER_MOCK_PRAISE_PROBE as GRID,
  armOf,
  armProfiles,
  buildRegisterMockPraiseProbePlan,
  checkTutorStackProvenance,
  findMockPraiseTokens,
  hasMockPraise,
  summarizeRegisterMockPraiseProbe,
  validateRegisterMockPraiseProbePlan,
} from '../services/registerMockPraiseProbe.js';
import { followUpCommands, generationCommand } from '../scripts/run-register-mock-praise-probe.js';
import { STANCE_GATE_VERSION } from '../services/registerStanceFidelity.js';

// A turn that grants merit in words, and one that diagnoses without granting.
const PRAISE_TURN = 'Wonderful: the tidy formula does the walking for you. Next, name the step where the work happens.';
const PLAIN_TURN = 'You are stuck at the hinge, not the slogan. Next, write the step where the servant acts.';

/** One trace entry per tutor seat, all on the given provider/model. */
function traceOn(provider, model) {
  return GRID.tutorSeats.map((agent) => ({ agent, action: 'execute', metrics: { provider, model } }));
}

const goodProvenance = () => checkTutorStackProvenance([{ dialogueId: 'd1', trace: traceOn('codex', 'gpt-5.5') }]);

/**
 * Thirty rows, both arms, every measure present. `shape(arm, index)` returns
 * per-row overrides; index counts 0..14 within the arm.
 */
function analysesFor(shape) {
  const rows = [];
  for (const [armName, arm] of Object.entries(GRID.arms)) {
    let index = 0;
    for (const scenario of GRID.scenarios) {
      for (let repeat = 1; repeat <= GRID.repeats; repeat += 1) {
        const override = shape(armName, index) || {};
        index += 1;
        const stance = {
          applies: true,
          gateRegister: arm.register,
          gateVersion: STANCE_GATE_VERSION,
          passed: true,
          missing: [],
          missingRequired: [],
          mannerPresence: { status: 'absent' },
          ...(override.stanceFidelity || {}),
        };
        rows.push({
          rowId: `${armName}-${scenario}-${repeat}`,
          profileName: arm.profile,
          scenarioId: scenario,
          tutorMessage: PLAIN_TURN,
          tutorV22Score: 60,
          tutorRubricVersion: '2.2',
          tutorJudgeModel: GRID.scoring.tutorJudgeLabel,
          registerRubricScore: 70,
          registerJudgeModel: GRID.scoring.registerJudge,
          positiveOutcome: true,
          ...override,
          stanceFidelity: stance,
        });
      }
    }
  }
  return rows;
}

const present = { stanceFidelity: { mannerPresence: { status: 'present' } } };

/** The registered screen shape: treatment perfect, control at the stored 11/15. */
function screenShape(armName, index) {
  if (armName === 'treatment') return { tutorMessage: PRAISE_TURN, ...present };
  return index < 11 ? { tutorMessage: PRAISE_TURN, ...present } : {};
}

describe('register mock-praise probe — the detector', () => {
  it('finds granted praise, in order, lowercased', () => {
    assert.deepEqual(findMockPraiseTokens('Wonderful — a tidy, efficient dodge. Of course.'), [
      'wonderful',
      'tidy',
      'efficient',
      'of course',
    ]);
  });

  it('matches whole words and phrases only', () => {
    assert.equal(hasMockPraise('You cleverly avoided the work.'), false); // not "clever"
    assert.equal(hasMockPraise('That is a nice trick.'), true);
    assert.equal(hasMockPraise('That is nice.'), false); // "nice" alone is not on the list
    assert.equal(hasMockPraise(PLAIN_TURN), false);
    assert.equal(hasMockPraise(null), false);
  });
});

describe('register mock-praise probe — the plan', () => {
  it('is thirty rows: two arms, five targets, three repeats, in one batch', () => {
    const plan = buildRegisterMockPraiseProbePlan();
    assert.equal(plan.plannedRows, 30);
    assert.equal(plan.jobs.length, 30);
    assert.equal(plan.jobs.filter((job) => job.arm === 'control').length, 15);
    assert.equal(plan.jobs.filter((job) => job.arm === 'treatment').length, 15);
    assert.equal(validateRegisterMockPraiseProbePlan(plan).ok, true);
  });

  it('hashes the same plan to the same SHA', () => {
    assert.equal(buildRegisterMockPraiseProbePlan().planSha256, buildRegisterMockPraiseProbePlan().planSha256);
  });

  it('pins the detector token list into the hashed plan', () => {
    const plan = buildRegisterMockPraiseProbePlan();
    assert.ok(plan.mockPraiseTokens.includes('wonderful'));
    assert.ok(plan.mockPraiseTokens.includes('clever'));
  });

  it('names which arm asks and states what this size cannot see', () => {
    assert.equal(GRID.arms.treatment.asksForMockPraise, true);
    assert.equal(GRID.arms.control.asksForMockPraise, false);
    assert.notEqual(GRID.arms.control.register, GRID.arms.treatment.register);
    // The frozen power fact: a perfect treatment cannot separate from 11/15.
    assert.match(GRID.detectability.separatingOutcomes[0], /does not separate/u);
    assert.equal(GRID.detectability.smallestSeparatingTreatment, null);
  });

  it('resolves rows to arms by profile and rejects strangers', () => {
    assert.equal(armOf(GRID.arms.control.profile), 'control');
    assert.equal(armOf(GRID.arms.treatment.profile), 'treatment');
    assert.equal(armOf('cell_1_base_single_unified'), null);
  });

  it('generates both arms in one invocation on the strong stack', () => {
    const generation = generationCommand().join(' ');
    assert.match(generation, new RegExp(`--profiles ${armProfiles(GRID).join(',')}`, 'u'));
    assert.match(generation, /--tutor-model codex\.gpt-5\.5/u);
    assert.doesNotMatch(generation, /nemotron|kimi/iu);

    const followUps = followUpCommands('run-1').map((command) => command.join(' '));
    const readIndex = followUps.findIndex((c) => c.includes('read-negative-register-manner-presence.js'));
    const reportIndex = followUps.findIndex((c) => c.includes('--report-run'));
    assert.ok(readIndex >= 0 && reportIndex > readIndex);
  });
});

describe('register mock-praise probe — the report', () => {
  it('registers the likely outcome: a perfect treatment still does not separate from 11/15', () => {
    const report = summarizeRegisterMockPraiseProbe(analysesFor(screenShape), { provenance: goodProvenance() });
    assert.deepEqual(report.errors, []);
    assert.equal(report.status, 'COMPLETE');
    assert.equal(report.contrasts.mannerPresence.treatment, '15/15');
    assert.equal(report.contrasts.mannerPresence.control, '11/15');
    assert.ok(report.contrasts.mannerPresence.p > 0.05);
    assert.equal(report.verdict, 'NO_SEPARATION_AT_THIS_SIZE');
    // But the manipulation check is answerable at this size.
    assert.equal(report.manipulationHeld, true);
    assert.equal(report.contrasts.mockPraiseDelivery.treatment, '15/15');
    assert.equal(report.contrasts.mockPraiseDelivery.control, '11/15');
  });

  it('separates when the control arm falls far enough', () => {
    const report = summarizeRegisterMockPraiseProbe(
      analysesFor((armName, index) => {
        if (armName === 'treatment') return { tutorMessage: PRAISE_TURN, ...present };
        return index < 6 ? { tutorMessage: PRAISE_TURN, ...present } : {};
      }),
      { provenance: goodProvenance() },
    );
    assert.equal(report.status, 'COMPLETE');
    assert.ok(report.contrasts.mannerPresence.p < 0.05);
    assert.equal(report.verdict, 'MOCK_PRAISE_RAISES_MANNER');
  });

  it('pools the device test over both arms', () => {
    // Control mirrors the stored table: 10 praise+edged, 1 praise+flat,
    // 1 plain+edged, 3 plain+flat. Treatment all praise+edged.
    const report = summarizeRegisterMockPraiseProbe(
      analysesFor((armName, index) => {
        if (armName === 'treatment') return { tutorMessage: PRAISE_TURN, ...present };
        if (index < 10) return { tutorMessage: PRAISE_TURN, ...present };
        if (index === 10) return { tutorMessage: PRAISE_TURN };
        if (index === 11) return { tutorMessage: PLAIN_TURN, ...present };
        return {};
      }),
      { provenance: goodProvenance() },
    );
    assert.equal(report.status, 'COMPLETE');
    assert.equal(report.contrasts.mockPraisePredictsEdge.withPraise, '25/26');
    assert.equal(report.contrasts.mockPraisePredictsEdge.withoutPraise, '1/4');
    assert.ok(report.contrasts.mockPraisePredictsEdge.p < 0.05);
  });

  it('reports a failed manipulation before any verdict is read', () => {
    // Both arms deliver the same praise: the ask changed nothing.
    const report = summarizeRegisterMockPraiseProbe(
      analysesFor(() => ({ tutorMessage: PRAISE_TURN, ...present })),
      { provenance: goodProvenance() },
    );
    assert.equal(report.status, 'COMPLETE');
    assert.equal(report.manipulationHeld, false);
    assert.equal(report.verdict, 'NO_SEPARATION_AT_THIS_SIZE');
  });

  it('reports the tutor-score cost as a per-arm delta', () => {
    const report = summarizeRegisterMockPraiseProbe(
      analysesFor((armName) =>
        armName === 'treatment' ? { tutorMessage: PRAISE_TURN, tutorV22Score: 55, ...present } : present,
      ),
      { provenance: goodProvenance() },
    );
    assert.equal(report.status, 'COMPLETE');
    assert.equal(report.tutorCost.treatment, 55);
    assert.equal(report.tutorCost.control, 60);
    assert.equal(report.tutorCost.delta, -5);
  });

  it('fails closed on an unread row instead of counting it flat', () => {
    let first = true;
    const report = summarizeRegisterMockPraiseProbe(
      analysesFor((armName) => {
        if (armName !== 'treatment') return present;
        if (!first) return present;
        first = false;
        return { stanceFidelity: { mannerPresence: { status: 'unread' } } };
      }),
      { provenance: goodProvenance() },
    );
    assert.equal(report.status, 'INCOMPLETE');
    assert.equal(report.arms.treatment.presenceUnread, 1);
    assert.ok(report.errors.some((error) => /manner presence unread/u.test(error)));
    assert.equal(report.contrasts, null);
    assert.equal(report.verdict, null);
  });

  it('fails closed when the treatment arm was scored under the plain gate', () => {
    const report = summarizeRegisterMockPraiseProbe(
      analysesFor((armName) =>
        armName === 'treatment'
          ? { stanceFidelity: { gateRegister: 'sarcastic', ...present.stanceFidelity } }
          : present,
      ),
      { provenance: goodProvenance() },
    );
    assert.equal(report.status, 'INCOMPLETE');
    assert.ok(
      report.errors.some((error) =>
        /treatment arm scored under sarcastic@.*plan registers sarcastic_mock_praise@/u.test(error),
      ),
    );
  });

  it('fails closed when an arm is short of rows', () => {
    const rows = analysesFor(screenShape).filter(
      (row) => !row.rowId.startsWith('control-') || !row.rowId.endsWith('-3'),
    );
    const report = summarizeRegisterMockPraiseProbe(rows, { provenance: goodProvenance() });
    assert.equal(report.status, 'INCOMPLETE');
    assert.ok(report.errors.some((error) => /control arm: expected 15 rows, found 10/u.test(error)));
  });

  it('fails closed when nothing checked which models the tutor seats called', () => {
    const report = summarizeRegisterMockPraiseProbe(analysesFor(screenShape));
    assert.equal(report.status, 'INCOMPLETE');
    assert.ok(report.errors.includes('no tutor-stack provenance check supplied'));
  });

  it('fails closed when the seats drifted off the plan stack', () => {
    const provenance = checkTutorStackProvenance([
      { dialogueId: 'd1', trace: traceOn('openrouter', 'nvidia/nemotron-3-nano-30b-a3b') },
    ]);
    assert.equal(provenance.ok, false);
    const report = summarizeRegisterMockPraiseProbe(analysesFor(screenShape), { provenance });
    assert.equal(report.status, 'INCOMPLETE');
    assert.ok(report.errors.some((error) => /^provenance: /u.test(error)));
  });

  it('fails a seat that records no model rather than passing it by absence', () => {
    const check = checkTutorStackProvenance([{ dialogueId: 'd1', trace: [{ agent: 'ego', action: 'execute' }] }]);
    assert.equal(check.ok, false);
    assert.match(check.errors[0], /records no provider or model/u);
    assert.equal(checkTutorStackProvenance([{ dialogueId: 'd1', trace: [] }]).ok, false);
  });
});
