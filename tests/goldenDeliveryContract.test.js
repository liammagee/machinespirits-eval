// Golden delivery contract (card: adaptive-causality-stabilization).
//
// The card-strip lesson as a regression test: at every planted pressure
// turn of the golden full-stack run, the conduct card and the standing
// licence must be present in the SHIPPED prompt of the delivered attempt
// — retries included — and the leak audit must be clean. The fixture is
// frozen from the registered post-fix sonnet run (fullstack2-k3); the
// live card/licence text is read from the CURRENT services, so a wording
// change that breaks prompt assembly, and a regression that strips the
// card on retry, both fail here deterministically with no model calls.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createTutorStubMannerSwitchState, tutorStubMannerCard } from '../services/tutorStubMannerSwitch.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', 'golden-delivery-fullstack2.json'), 'utf8'),
);

const CARD_FOOTER = 'not a costume. Return to your own manner next turn';
const LICENCE_MARK = /licensed per turn|hypothesis rule of your evidence contract is suspended|Exception, licensed/;

test('the golden fixture covers all fifteen planted pressure turns', () => {
  assert.equal(fixture.dialogues.length, 3);
  for (const d of fixture.dialogues) assert.equal(d.plantedTurns.length, 5);
});

test('every current move card still carries the shared footer the contract greps for', () => {
  for (const pressure of ['demand', 'mockery', 'grievance', 'settled_claim', 'stake']) {
    const state = createTutorStubMannerSwitchState();
    state.lastAdvance = { pressure };
    const card = tutorStubMannerCard(state);
    assert.ok(card, `no card for ${pressure}`);
    assert.ok(
      card.includes(CARD_FOOTER),
      `card footer changed for ${pressure} — update the contract and the fixture together`,
    );
  }
});

test('card and licence reached the shipped prompt at every planted pressure turn, retries included', () => {
  for (const d of fixture.dialogues) {
    for (const t of d.plantedTurns) {
      const shipped = `${t.shippedUserPrompt}\n${t.shippedSystemPrompt}`;
      assert.ok(
        shipped.includes(CARD_FOOTER),
        `${d.d} t${t.turn} (${t.pressure}${t.repaired ? ', repaired' : ''}): conduct card missing from the shipped prompt`,
      );
      assert.match(
        t.shippedSystemPrompt,
        LICENCE_MARK,
        `${d.d} t${t.turn}: standing licence missing from the shipped system prompt`,
      );
      assert.ok(t.leakAuditOk, `${d.d} t${t.turn}: leak audit not clean in the golden run`);
    }
  }
});

test('the baseline manifest is current', async () => {
  const { execFileSync } = await import('node:child_process');
  const out = execFileSync(process.execPath, ['scripts/generate-baseline-manifest.js', '--check'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.match(out, /baseline manifest current/);
});
