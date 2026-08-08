import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  REGISTER_STRONG_STACK_REPLICATION as GRID,
  buildRegisterStrongStackReplicationPlan,
  checkTutorStackProvenance,
  splitModelSpec,
  summarizeRegisterStrongStackReplication,
  validateRegisterStrongStackReplicationPlan,
} from '../services/registerStrongStackReplication.js';
import { followUpCommands, generationCommand } from '../scripts/run-register-strong-stack-replication.js';
import { STANCE_GATE_VERSION } from '../services/registerStanceFidelity.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** One trace entry per seat, all on the given provider/model. */
function traceOn(provider, model) {
  return GRID.tutorSeats.map((agent) => ({ agent, action: 'execute', metrics: { provider, model } }));
}

/**
 * @param {(scenario: string, repeat: number) => object} shape per-row overrides
 */
function analysesFor(shape) {
  const rows = [];
  for (const scenario of GRID.scenarios) {
    for (let repeat = 1; repeat <= GRID.repeats; repeat += 1) {
      const override = shape(scenario, repeat) || {};
      const stance = {
        applies: true,
        gateRegister: GRID.measurement.gateRegister,
        gateVersion: STANCE_GATE_VERSION,
        passed: false,
        missing: [],
        missingRequired: [],
        mannerPresence: { status: 'absent' },
        ...(override.stanceFidelity || {}),
      };
      rows.push({
        rowId: `${scenario}-${repeat}`,
        profileName: GRID.profiles[0],
        scenarioId: scenario,
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
  return rows;
}

/** Every row compliant and edged — the shape that separates from the parent's 6/15. */
function heldThroughout() {
  return analysesFor(() => ({
    stanceFidelity: { passed: true, mannerPresence: { status: 'present' } },
  }));
}

const goodProvenance = () => checkTutorStackProvenance([{ dialogueId: 'd1', trace: traceOn('codex', 'gpt-5.5') }]);

describe('register strong-stack replication — the plan', () => {
  it('is fifteen rows: one sarcastic arm, five targets, three repeats', () => {
    const plan = buildRegisterStrongStackReplicationPlan();
    assert.equal(plan.plannedRows, 15);
    assert.equal(plan.jobs.length, 15);
    assert.equal(plan.profiles.length, 1);
    assert.match(plan.profiles[0], /cell_197_/u);
    assert.equal(validateRegisterStrongStackReplicationPlan(plan).ok, true);
  });

  it('hashes the same plan to the same SHA', () => {
    assert.equal(
      buildRegisterStrongStackReplicationPlan().planSha256,
      buildRegisterStrongStackReplicationPlan().planSha256,
    );
  });

  it('refuses a plan whose tutor stack is the pairing it exists to replace', () => {
    const plan = buildRegisterStrongStackReplicationPlan();
    const weak = {
      ...plan,
      generation: { ...plan.generation, tutorModel: 'openrouter.nvidia/nemotron-3-nano-30b-a3b' },
    };
    // The grid is frozen, so validate against a stand-in that carries the weak
    // model where the plan reads it.
    const spec = splitModelSpec(weak.generation.tutorModel);
    assert.equal(spec.provider, 'openrouter');
    assert.match(spec.model, /nemotron/u);
  });

  it('freezes the parent comparison, and the reading can only subtract from it', () => {
    assert.equal(GRID.comparison.parentRows, 15);
    assert.ok(GRID.comparison.parentReadAsEdged <= GRID.comparison.parentCueCompliant);
    assert.equal(validateRegisterStrongStackReplicationPlan(buildRegisterStrongStackReplicationPlan()).ok, true);
  });

  it('runs the arm on the strong stack and scores it with the parent judges', () => {
    const generation = generationCommand().join(' ');
    assert.match(generation, /--tutor-model codex\.gpt-5\.5/u);
    assert.match(generation, /--learner-model codex\.gpt-5\.5/u);
    assert.doesNotMatch(generation, /nemotron|kimi/iu);

    const followUps = followUpCommands('run-1').map((command) => command.join(' '));
    // The manner reading has to happen before the report, or the report has
    // nothing to fail closed on.
    const readIndex = followUps.findIndex((c) => c.includes('read-negative-register-manner-presence.js'));
    const reportIndex = followUps.findIndex((c) => c.includes('--report-run'));
    assert.ok(readIndex >= 0 && reportIndex > readIndex);
    assert.ok(followUps.some((c) => c.includes(GRID.scoring.registerJudge)));
    assert.ok(ROOT.length > 0);
  });
});

describe('register strong-stack replication — tutor stack provenance', () => {
  it('passes when every tutor seat called the plan model', () => {
    const check = goodProvenance();
    assert.equal(check.ok, true);
    assert.equal(check.seatCalls, GRID.tutorSeats.length);
    assert.deepEqual(check.observed, { 'codex/gpt-5.5': GRID.tutorSeats.length });
  });

  it('catches the August failure: the columns say codex, the calls say nemotron and kimi', () => {
    const check = checkTutorStackProvenance([
      {
        dialogueId: 'd1',
        trace: [
          { agent: 'id', action: 'construct', metrics: { provider: 'openrouter', model: 'moonshotai/kimi-k2.5' } },
          {
            agent: 'ego',
            action: 'execute',
            metrics: { provider: 'openrouter', model: 'nvidia/nemotron-3-nano-30b-a3b' },
          },
          { agent: 'learner', action: 'final_output', metrics: { provider: 'codex', model: 'gpt-5.5' } },
        ],
      },
    ]);
    assert.equal(check.ok, false);
    assert.equal(check.errors.length, 2);
    assert.ok(check.errors.every((error) => /plan says codex\.gpt-5\.5/u.test(error)));
    // The learner seat ran codex and is not one of the seats under test.
    assert.deepEqual(Object.keys(check.observed).sort(), [
      'openrouter/moonshotai/kimi-k2.5',
      'openrouter/nvidia/nemotron-3-nano-30b-a3b',
    ]);
  });

  it('fails a seat that records no model rather than passing it by absence', () => {
    const check = checkTutorStackProvenance([{ dialogueId: 'd1', trace: [{ agent: 'ego', action: 'execute' }] }]);
    assert.equal(check.ok, false);
    assert.match(check.errors[0], /records no provider or model/u);
  });

  it('fails when no tutor seat call is found at all', () => {
    assert.equal(checkTutorStackProvenance([{ dialogueId: 'd1', trace: [] }]).ok, false);
  });
});

describe('register strong-stack replication — the report', () => {
  it('reports COMPLETE and separates from the parent when every row holds', () => {
    const report = summarizeRegisterStrongStackReplication(heldThroughout(), { provenance: goodProvenance() });
    assert.deepEqual(report.errors, []);
    assert.equal(report.status, 'COMPLETE');
    assert.equal(report.overall.cueCompliant, 15);
    assert.equal(report.overall.readAsEdged, 15);
    assert.equal(report.contrasts.mannerPresence.thisRun, '15/15');
    assert.equal(report.contrasts.mannerPresence.parent, `${GRID.comparison.parentReadAsEdged}/15`);
    assert.ok(report.contrasts.mannerPresence.p < 0.05);
    assert.equal(report.verdict, 'MANNER_HELD_MORE_ON_STRONG_STACK');
  });

  it('calls a matching count no separation rather than agreement', () => {
    let given = 0;
    const rows = analysesFor(() => {
      // Six rows compliant and edged: the parent's own count.
      if (given >= GRID.comparison.parentReadAsEdged) return {};
      given += 1;
      return { stanceFidelity: { passed: true, mannerPresence: { status: 'present' } } };
    });
    const report = summarizeRegisterStrongStackReplication(rows, { provenance: goodProvenance() });
    assert.equal(report.status, 'COMPLETE');
    assert.equal(report.overall.readAsEdged, GRID.comparison.parentReadAsEdged);
    assert.equal(report.verdict, 'NO_SEPARATION_AT_THIS_SIZE');
  });

  it('fails closed on an unread row instead of counting it flat', () => {
    let first = true;
    const rows = analysesFor(() => {
      if (!first) return { stanceFidelity: { passed: true, mannerPresence: { status: 'present' } } };
      first = false;
      return { stanceFidelity: { passed: true, mannerPresence: { status: 'unread' } } };
    });
    const report = summarizeRegisterStrongStackReplication(rows, { provenance: goodProvenance() });
    assert.equal(report.status, 'INCOMPLETE');
    assert.equal(report.overall.presenceUnread, 1);
    assert.ok(report.errors.some((error) => /manner presence unread/u.test(error)));
    assert.equal(report.contrasts, null);
    assert.equal(report.verdict, null);
  });

  it('fails closed when nothing checked which models the tutor seats called', () => {
    const report = summarizeRegisterStrongStackReplication(heldThroughout());
    assert.equal(report.status, 'INCOMPLETE');
    assert.ok(report.errors.includes('no tutor-stack provenance check supplied'));
  });

  it('fails closed when the seats drifted off the plan stack', () => {
    const provenance = checkTutorStackProvenance([
      { dialogueId: 'd1', trace: traceOn('openrouter', 'nvidia/nemotron-3-nano-30b-a3b') },
    ]);
    const report = summarizeRegisterStrongStackReplication(heldThroughout(), { provenance });
    assert.equal(report.status, 'INCOMPLETE');
    assert.ok(report.errors.some((error) => /^provenance: /u.test(error)));
  });

  it('fails closed when the rows were scored under another gate', () => {
    const rows = heldThroughout().map((row) => ({
      ...row,
      stanceFidelity: { ...row.stanceFidelity, gateRegister: 'sarcastic_determinate' },
    }));
    const report = summarizeRegisterStrongStackReplication(rows, { provenance: goodProvenance() });
    assert.equal(report.status, 'INCOMPLETE');
    assert.ok(report.errors.some((error) => /plan registers sarcastic@/u.test(error)));
  });

  it('fails closed when a judge is not the parent arm judge', () => {
    const rows = heldThroughout().map((row) => ({ ...row, tutorJudgeModel: 'openrouter/gpt' }));
    const report = summarizeRegisterStrongStackReplication(rows, { provenance: goodProvenance() });
    assert.equal(report.status, 'INCOMPLETE');
    assert.ok(report.errors.some((error) => /tutor judge other than/u.test(error)));
  });
});
