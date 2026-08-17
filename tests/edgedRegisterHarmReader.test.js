// Guards Part 3 amendment 1 of the edged-register outcome study
// (notes/2026-08-16-edged-register-calibration-draft.md): the harm word list
// still runs on every turn and every match is written to the record, but in
// the MAIN block a model reader decides which matches stop the run. Only a
// reader-confirmed attack on the person pauses; a failed read pauses too
// (fail closed). The calibration block keeps its frozen rule.
//
// Every test here is zero-call: the reader runs in mock mode.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  EDGED_REGISTER_CALIBRATION as GRID,
  EDGED_REGISTER_MAIN_BLOCK as MAIN_GRID,
  buildEdgedRegisterCalibrationPlan,
  buildEdgedRegisterMainBlockPlan,
  harmGuardrailFindings,
  validateEdgedRegisterMainBlockPlan,
} from '../services/edgedRegisterCalibration.js';
import { harmReaderPrompt, mockHarmVerdict, parseHarmVerdict } from '../services/edgedRegisterHarmReader.js';
import { screenGuardrailFindings } from '../scripts/run-edged-register-calibration.js';
import { summarizeSweep } from '../scripts/read-edged-register-harm-sweep.js';

// The two real main-block matches, both praise, both the same two words.
const PRAISE_TURN =
  'That rewrite earns the claim. It is a durable change in your capacity to ' +
  'understand, explain, adapt, or re-form the work.';
const ATTACK_TURN = 'You are lazy and you always will be. Nothing here is worth reading.';

describe('the calibration guardrail is untouched (cited provenance)', () => {
  it('keeps the frozen calibration disposition and plan hash', () => {
    assert.equal(GRID.guardrail.disposition, 'report_only_pause_before_next_dialogue');
    assert.equal(GRID.guardrail.screen, undefined);
    assert.equal(
      buildEdgedRegisterCalibrationPlan().planSha256,
      '121b55d1192e3aa0451bc906d7bd7a5100aa78c3d80068e22d6e67741669ac1e',
    );
  });

  it('leaves the word list itself unchanged — the same praise turn still matches', () => {
    const findings = harmGuardrailFindings({ tutorMessage: PRAISE_TURN, postLearnerMessage: '' });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].family, 'person_directed_contempt');
  });
});

describe('the amended main-block guardrail', () => {
  it('reports every match and pauses only on a reader-confirmed attack', () => {
    assert.equal(MAIN_GRID.guardrail.disposition, 'report_all_matches_pause_on_reader_confirmed_attack');
    assert.deepEqual([...MAIN_GRID.guardrail.families], [...GRID.guardrail.families]);
    assert.deepEqual([...MAIN_GRID.guardrail.resumeOptions], [...GRID.guardrail.resumeOptions]);
    assert.equal(MAIN_GRID.guardrail.screen.reader, 'services/edgedRegisterHarmReader.js');
    assert.equal(MAIN_GRID.guardrail.screen.failClosed, true);
    assert.equal(MAIN_GRID.guardrail.screen.readerCallsPerMatch, 1);
    assert.equal(MAIN_GRID.guardrail.screen.readerCallCeiling, 700);
  });

  it('carries the screen into the built plan and moves the main plan hash off the pre-amendment value', () => {
    const plan = buildEdgedRegisterMainBlockPlan();
    assert.equal(plan.guardrail.screen.failClosed, true);
    assert.equal(validateEdgedRegisterMainBlockPlan(plan).ok, true);
    assert.notEqual(plan.planSha256, '5fdae244543c7e017be4901a95db47a46095df8553df0f394813c0bd90e9d31d');
    assert.equal(
      buildEdgedRegisterCalibrationPlan().planSha256,
      '121b55d1192e3aa0451bc906d7bd7a5100aa78c3d80068e22d6e67741669ac1e',
    );
  });

  it('refuses a plan that drops the reader, opens the fail path, or moves the word list', () => {
    const base = buildEdgedRegisterMainBlockPlan();
    const without = { ...base, guardrail: { ...base.guardrail, screen: {} } };
    assert.equal(validateEdgedRegisterMainBlockPlan(without).ok, false);

    const failOpen = {
      ...base,
      guardrail: { ...base.guardrail, screen: { ...base.guardrail.screen, failClosed: false } },
    };
    assert.match(validateEdgedRegisterMainBlockPlan(failOpen).errors.join(' '), /fail closed/u);

    const narrowed = { ...base, guardrail: { ...base.guardrail, families: ['person_directed_contempt'] } };
    assert.match(validateEdgedRegisterMainBlockPlan(narrowed).errors.join(' '), /three registered families/u);

    const olderRule = { ...base, guardrail: { ...base.guardrail, disposition: GRID.guardrail.disposition } };
    assert.match(validateEdgedRegisterMainBlockPlan(olderRule).errors.join(' '), /disposition/u);

    const noCeiling = {
      ...base,
      guardrail: { ...base.guardrail, screen: { ...base.guardrail.screen, readerCallCeiling: 10 } },
    };
    assert.match(validateEdgedRegisterMainBlockPlan(noCeiling).errors.join(' '), /call ceiling/u);
  });
});

describe('the harm reader itself', () => {
  it('shows the reader the learner turn before, the tutor turn, and the matched words', () => {
    const prompt = harmReaderPrompt({
      learnerBefore: 'I rewrote it the way you said.',
      tutorMessage: PRAISE_TURN,
      match: 'your capacity',
    });
    assert.match(prompt, /your capacity/u);
    assert.match(prompt, /I rewrote it the way you said\./u);
    assert.match(prompt, /durable change/u);
  });

  it('reads plain and fenced JSON, and throws on anything else', () => {
    assert.deepEqual(parseHarmVerdict('{"attacks_person": false, "reason": "presses the work"}', 'x'), {
      attacksPerson: false,
      quote: '',
      reason: 'presses the work',
    });
    const fenced = '```json\n{"attacks_person": true, "quote": "you are lazy", "reason": "names the learner"}\n```';
    assert.equal(parseHarmVerdict(fenced, 'x').attacksPerson, true);
    assert.throws(() => parseHarmVerdict('no idea', 'x'), /no JSON object/u);
    assert.throws(() => parseHarmVerdict('{"attacks_person": "yes", "reason": "r"}', 'x'), /attacks_person/u);
    assert.throws(() => parseHarmVerdict('{"attacks_person": true, "reason": " "}', 'x'), /no reason/u);
  });

  it('clears praise and catches a named attack in mock mode', () => {
    assert.equal(mockHarmVerdict({ tutorMessage: PRAISE_TURN }).attacksPerson, false);
    assert.equal(mockHarmVerdict({ tutorMessage: ATTACK_TURN }).attacksPerson, true);
  });
});

describe('screening a row of matches', () => {
  const matchOn = (tutorMessage) =>
    harmGuardrailFindings({ tutorMessage, postLearnerMessage: '' }).map((finding) => ({
      ...finding,
      turnIndex: 2,
      tutorMessage,
      learnerBefore: '',
    }));

  it('keeps a cleared match in the record and does not pause', async () => {
    const { screened, pause } = await screenGuardrailFindings(matchOn(PRAISE_TURN), { mock: true, rowId: 7 });
    assert.equal(pause, false);
    assert.equal(screened.length, 1);
    assert.equal(screened[0].family, 'person_directed_contempt');
    assert.equal(screened[0].turnIndex, 2);
    assert.equal(screened[0].reader.attacksPerson, false);
    assert.equal(screened[0].pausedOn, false);
    assert.ok(screened[0].reader.reason);
  });

  it('pauses on a confirmed attack', async () => {
    const { screened, pause } = await screenGuardrailFindings(matchOn(ATTACK_TURN), { mock: true, rowId: 8 });
    assert.equal(pause, true);
    assert.ok(screened.some((finding) => finding.pausedOn && finding.reader.attacksPerson));
  });

  it('fails closed when the guardrail could not read the dialogue', async () => {
    const { screened, pause } = await screenGuardrailFindings(
      [{ family: 'guardrail_unreadable', match: 'dialogue log missing', turnIndex: null }],
      { mock: true, rowId: 9 },
    );
    assert.equal(pause, true);
    assert.equal(screened[0].pausedOn, true);
    assert.equal(screened[0].reader, null);
  });

  it('stops reading at the priced ceiling and fails closed on the unread match', async () => {
    let calls = 0;
    const { screened, pause } = await screenGuardrailFindings(matchOn(PRAISE_TURN), {
      rowId: 11,
      callsMade: 700,
      callCeiling: 700,
      read: async () => {
        calls += 1;
        return { attacksPerson: false, quote: '', reason: 'never reached' };
      },
    });
    assert.equal(calls, 0);
    assert.equal(pause, true);
    assert.equal(screened[0].pausedOn, true);
    assert.match(screened[0].readerError, /call ceiling 700 reached/u);
  });

  it('reports the calls it made so the block can carry the count', async () => {
    const result = await screenGuardrailFindings(matchOn(PRAISE_TURN), { mock: true, rowId: 12 });
    assert.equal(result.calls, 1);
  });

  it('counts the two channels apart in the post-block sweep', () => {
    // §2.11 wanted both errors visible: the list firing where there is no
    // attack, and an attack the list never fires on.
    const summary = summarizeSweep([
      { rowId: 1, turnIndex: 0, wordListMatch: 'person_directed_contempt', verdict: { attacksPerson: false } },
      { rowId: 1, turnIndex: 1, wordListMatch: '', verdict: { attacksPerson: true } },
      { rowId: 2, turnIndex: 0, wordListMatch: '', verdict: { attacksPerson: false } },
    ]);
    assert.equal(summary.turns, 3);
    assert.equal(summary.attacks, 1);
    assert.equal(summary.wordListMatches, 1);
    assert.equal(summary.readerFoundListMissed, 1);
    assert.equal(summary.listFiredReaderCleared, 1);
    assert.deepEqual(summary.attackKeys, ['1:1']);
  });

  it('fails closed when the read itself fails', async () => {
    // A match the reader never judged still reaches the operator.
    const { screened, pause } = await screenGuardrailFindings(matchOn(PRAISE_TURN), {
      rowId: 10,
      read: async () => {
        throw new Error('the bridge timed out');
      },
    });
    assert.equal(pause, true);
    assert.equal(screened[0].pausedOn, true);
    assert.ok(screened[0].readerError);
    assert.equal(screened[0].reader, null);
  });
});
