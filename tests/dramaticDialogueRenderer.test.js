import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  DRAMATIC_DIALOGUE_INTERCHANGE_SCHEMA,
  DRAMATIC_DIALOGUE_RENDERER_SCHEMA,
  renderDramaticDialogueFragment,
  renderDramaticDialogueStyles,
  validateDramaticDialogueInterchange,
} from '../services/dramaticDialogueRenderer.js';
import { buildStressComparisonDramaticDialogue } from '../scripts/render-stress-comparison.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function dialogue(layout = 'shared-learner') {
  const arms = [
    { id: 'bare', label: 'Bare tutor', baseline: true },
    { id: 'proof', label: 'Proof-DAG tutor' },
  ];
  if (layout === 'shared-learner') {
    return {
      schema: DRAMATIC_DIALOGUE_INTERCHANGE_SCHEMA,
      id: 'frozen-turn',
      label: 'Frozen learner contrast',
      layout,
      arms,
      turns: [
        {
          id: 'turn-2',
          turn: 2,
          messages: [
            {
              id: 'turn-2-learner',
              speaker: 'learner',
              turn: 2,
              arm: null,
              text: 'The same learner text — punctuation & spacing stay put.',
              delivery: { label: 'identical for every arm', status: 'frozen', tone: 'muted' },
            },
            {
              id: 'turn-2-bare',
              speaker: 'tutor',
              turn: 2,
              arm: 'bare',
              text: 'Check the record.',
              verdict: { label: 'rubric fail', status: 'fail' },
              provenance: { sourceId: 'case-2__bare', quoteExact: true },
            },
            {
              id: 'turn-2-proof',
              speaker: 'tutor',
              turn: 2,
              arm: 'proof',
              text: 'Check the physical path in the record.',
              verdict: { label: 'rubric pass', status: 'pass' },
              ruling: { label: 'human ruling pending', status: 'indeterminate' },
              gloss: 'This reply asks for the missing causal link.',
            },
          ],
        },
      ],
    };
  }

  const activeArms = layout === 'single' ? arms.slice(0, 1) : arms;
  return {
    schema: DRAMATIC_DIALOGUE_INTERCHANGE_SCHEMA,
    id: `${layout}-turn`,
    label: `${layout} dialogue`,
    layout,
    arms: activeArms,
    turns: [
      {
        id: 'turn-1',
        turn: 1,
        messages: activeArms.flatMap((arm) => [
          { id: `${arm.id}-learner`, speaker: 'learner', turn: 1, arm: arm.id, text: 'Why?' },
          { id: `${arm.id}-tutor`, speaker: 'tutor', turn: 1, arm: arm.id, text: 'Let us test it.' },
        ]),
      },
    ],
  };
}

test('the interchange accepts only declared public dialogue fields', () => {
  const value = dialogue();
  assert.equal(validateDramaticDialogueInterchange(value), value);
  assert.throws(
    () =>
      validateDramaticDialogueInterchange({
        ...value,
        turns: [
          {
            ...value.turns[0],
            messages: [{ ...value.turns[0].messages[0], hiddenLearnerState: { resistance: 'identity' } }],
          },
        ],
      }),
    /unsupported field\(s\): hiddenLearnerState/u,
  );
  assert.throws(() => validateDramaticDialogueInterchange({ ...value, proofDag: {} }), /proofDag/u);
  assert.throws(
    () => validateDramaticDialogueInterchange({ ...dialogue('single'), arms: dialogue().arms }),
    /exactly one arm/u,
  );
  assert.throws(
    () =>
      validateDramaticDialogueInterchange({
        ...value,
        turns: [
          {
            ...value.turns[0],
            messages: [
              ...value.turns[0].messages,
              { id: 'arm-learner', speaker: 'learner', turn: 2, arm: 'bare', text: 'Private branch.' },
            ],
          },
        ],
      }),
    /arm-specific messages must be tutor messages/u,
  );
});

test('shared-learner rendering preserves public text and keeps verdicts separate from rulings', () => {
  const value = dialogue();
  const html = renderDramaticDialogueFragment(value, { diffAgainstArm: 'bare', showProvenance: true });
  assert.match(html, new RegExp(`data-dd-schema="${DRAMATIC_DIALOGUE_RENDERER_SCHEMA}"`, 'u'));
  assert.match(html, /The same learner text — punctuation &amp; spacing stay put\./u);
  assert.match(html, /data-dd-kind="verdict" data-dd-status="pass"/u);
  assert.match(html, /data-dd-kind="ruling" data-dd-status="indeterminate"/u);
  assert.match(html, /Plain language/u);
  assert.match(html, /case-2__bare/u);
  assert.match(html, /<mark class="dd__added">physical<\/mark>/u);

  const unruled = structuredClone(value);
  delete unruled.turns[0].messages[2].ruling;
  const unruledHtml = renderDramaticDialogueFragment(unruled);
  assert.ok(!/data-dd-kind="ruling"/u.test(unruledHtml), 'the renderer must not invent a ruling');
});

test('single and parallel layouts use the same message contract', () => {
  for (const layout of ['single', 'parallel']) {
    const value = dialogue(layout);
    const html = renderDramaticDialogueFragment(value);
    assert.match(html, new RegExp(`data-dd-layout="${layout}"`, 'u'));
    assert.equal((html.match(/data-dd-message-id=/gu) || []).length, value.turns[0].messages.length);
  }
});

test('shared styles carry explicit reader controls and narrow-screen fallbacks', () => {
  const css = renderDramaticDialogueStyles();
  assert.match(css, /body\[data-dd-diff='off'\]/u);
  assert.match(css, /body\[data-dd-stack='on'\]/u);
  assert.match(css, /@media \(max-width: 56rem\)/u);
  assert.match(css, /overflow-wrap: anywhere/u);
});

test('the stress comparison adapter separates the delivered verdict from an explicit ruling', () => {
  const columns = [
    {
      col: { label: 'bare' },
      rows: [
        {
          d: 'D1',
          turn: 2,
          learner: '  Same   public learner turn. ',
          reply: ' Bare reply. ',
          tag: 'reopen',
          hit: true,
          verdict: false,
          overridden: true,
          why: 'Human ruling reversed the raw tag.',
        },
      ],
    },
    {
      col: { label: 'instrumented' },
      rows: [
        {
          d: 'D1',
          turn: 2,
          learner: 'Same public learner turn.',
          reply: 'Instrumented reply.',
          tag: 'split-stake',
          dose: 1,
          hit: true,
          verdict: true,
          overridden: false,
        },
      ],
    },
  ];
  const value = buildStressComparisonDramaticDialogue(columns, {
    k: 'D1:2',
    d: 'D1',
    turn: 2,
    pressure: 'identity stake',
  });
  assert.equal(value.turns[0].messages[0].text, 'Same public learner turn.');
  const ruled = value.turns[0].messages.find((message) => message.arm === 'arm-0');
  assert.equal(ruled.text, 'Bare reply.');
  assert.deepEqual(ruled.verdict, { label: 'miss', status: 'fail' });
  assert.deepEqual(ruled.ruling, { label: 'ruled', status: 'fail', tone: 'ink' });
});

test('the checked-in Techne fixture is valid and synchronized into the explainer', () => {
  const fixturePath = path.join(ROOT, 'notes', 'poetics', 'fixtures', 'adaptive-tutor-crossed-dialogue.json');
  const reportPath = path.join(ROOT, 'notes', 'poetics', '2026-08-29-adaptive-tutor-from-null-to-control.html');
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  validateDramaticDialogueInterchange(fixture);

  const check = spawnSync(process.execPath, ['scripts/sync-dramatic-dialogue-fixtures.js', '--check'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(check.status, 0, check.stderr);
  const html = fs.readFileSync(reportPath, 'utf8');
  assert.match(html, /data-dd-dialogue-id="adaptive-tutor-crossed-endgame"/u);
  for (const message of fixture.turns.flatMap((turn) => turn.messages)) {
    const visibleText = message.text.replace(
      /[&<>"']/gu,
      (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
    );
    assert.ok(html.includes(visibleText), `${message.id} public text is copied into the report`);
  }
});
