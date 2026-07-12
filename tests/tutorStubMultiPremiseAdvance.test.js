import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function plainTerminalText(value) {
  // Build the ESC char dynamically so the ANSI-strip regex carries no
  // control-character escape in a literal (no-control-regex).
  const ansi = new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[ -/]*[@-~]`, 'gu');
  return String(value || '').replace(ansi, '');
}

test('one advanced learner turn can add several warranted DAG premises and changes the tutor stance', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-multi-premise-'));
  try {
    const worldPath = path.join(tmp, 'multi-premise-world.yaml');
    fs.writeFileSync(
      worldPath,
      `id: world_multi_premise_test
title: The Accelerated Heir
question: "Who is the rightful heir?"
question_pattern: [heir, "?x"]
secret:
  fact: [heir, marin]
  surface: "Marin is the rightful heir"
mirror:
  fact: [heir, joren]
rules:
  - id: R1_lineage
    if:
      - [child, "?x", "?y"]
      - [child, "?y", founder]
    then:
      - [grandchild, "?x", founder]
  - id: R2_heir
    if:
      - [grandchild, "?x", founder]
      - [bearsMark, "?x"]
    then:
      - [heir, "?x"]
premises:
  - id: p_child
    fact: [child, marin, tessa]
    surface: "Marin is Tessa's child"
  - id: p_founder
    fact: [child, tessa, founder]
    surface: "Tessa was the founder's daughter"
  - id: p_mark
    fact: [bearsMark, marin]
    surface: "Marin bears the house mark"
background: []
incompatible: []
proof_paths:
  - premises: [p_child, p_founder, p_mark]
release_schedule:
  - { turn: 1, premise: p_child, via: tutor }
  - { turn: 1, premise: p_founder, via: tutor }
  - { turn: 2, premise: p_mark, via: tutor }
slope:
  t_min: 2
  aporia_window: 2
turn_cap: 4
`,
      'utf8',
    );

    const fakeCodex = path.join(tmp, 'codex');
    const promptLog = path.join(tmp, 'prompts.log');
    fs.writeFileSync(
      fakeCodex,
      `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const outputIndex = args.indexOf('-o');
const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : null;
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  fs.appendFileSync(process.env.FAKE_CODEX_LOG, input + '\\n---CALL---\\n');
  const response = input.includes('# Learner-record extraction rules')
    ? JSON.stringify({
        classification: {
          turn: {
            summary: 'The learner connects both lineage facts and supplies their consequence.',
            request_type: 'stepwise_support_request',
            discourse_move: 'claim',
            evidence_use: 'none',
            epistemic_stance: 'exploratory',
            affect: 'calm',
            agency: 'passive',
            scores: {
              conceptual_engagement: { score: 1, reason: 'fixture lowball' },
              epistemic_readiness: { score: 1, reason: 'fixture lowball' }
            },
            pedagogical_need: 'Continue the lineage proof.'
          },
          overall: {
            summary: 'The learner is moving quickly.',
            trajectory: 'advancing',
            recurring_pattern: 'none',
            current_state: 'connecting evidence',
            next_best_tutor_move: 'Test the next unresolved edge.'
          }
        },
        learner_record: {
          adopt: ['p_child', 'p_founder'],
          derive: [['grandchild', 'marin', 'founder']],
          notes: 'Both public premises and their supported consequence were voiced.'
        },
        register_selection: {
          engagement_stance: 'warm',
          reviewer_signal: 'fixture deliberately proposes the slower stance',
          request_type: 'stepwise_support_request',
          engagement_stance_reason: 'fixture',
          expected_dag_move: 'one step',
          expected_field_move: 'one step',
          expected_progress_marker: 'one step',
          confidence: 0.8
        }
      })
    : 'You have already joined both lineage facts. What would the house mark now settle?';
  if (outputPath) fs.writeFileSync(outputPath, response);
  process.stdout.write(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: response } }) + '\\n');
});
`,
      'utf8',
    );
    fs.chmodSync(fakeCodex, 0o755);

    const result = spawnSync(
      process.execPath,
      [
        'scripts/tutor-stub.js',
        '--once',
        "Marin is Tessa's child, and Tessa is the founder's daughter, so Marin is the founder's grandchild.",
        '--world',
        worldPath,
        '--dag',
        '--tutor-learner-dag',
        '--register-policy',
        'dynamic',
        '--no-opening',
        '--no-closeout-report',
        '--no-interim-animation',
        '--no-stream',
        '--trace-dir',
        tmp,
      ],
      {
        cwd: ROOT,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${tmp}${path.delimiter}${process.env.PATH || ''}`,
          FAKE_CODEX_LOG: promptLog,
          CLI_PROVIDER_CODEX_TIMEOUT_MS: '5000',
          TUTOR_STUB_SUMMARY_OPEN: '0',
        },
      },
    );

    assert.equal(result.status, 0, result.stderr);
    const plain = plainTerminalText(result.stdout);
    assert.match(plain, /pace: accelerating; reasoning span: multi_step/u);
    assert.match(plain, /conceptual 4\/5, readiness 4\/5/u);
    assert.match(plain, /update: adopted 2, derived 1/u);
    assert.match(plain, /learner pace: accelerating — 3 warranted proof moves/u);
    assert.match(plain, /engagement stance > brisk/u);
    assert.match(plain, /source dynamic_learner_acceleration_guard/u);

    const events = fs
      .readdirSync(tmp)
      .filter((name) => name.endsWith('.jsonl'))
      .flatMap((name) => fs.readFileSync(path.join(tmp, name), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const turn = events.find((event) => event.type === 'turn_complete')?.turnRecord;
    assert.equal(turn.learnerAdvance.accelerated, true);
    assert.equal(turn.learnerAdvance.adoptedPremiseCount, 2);
    assert.equal(turn.learnerAdvance.derivedFactCount, 1);
    assert.equal(turn.classification.turn.learning_pace, 'accelerating');
    assert.equal(turn.registerSelection.selected_register, 'brisk');
    assert.equal(turn.responseConfiguration.action_family, 'clarify_distinction');
    assert.equal(turn.responseConfiguration.audience_register, 'informed_peer');
    assert.match(fs.readFileSync(promptLog, 'utf8'), /do not ask for any of them again/u);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
