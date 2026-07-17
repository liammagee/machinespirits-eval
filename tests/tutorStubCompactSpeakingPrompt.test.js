import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  buildTutorStubCompactNoSourceRequest,
  replaceTutorStubFrozenRequestWithCompactNoSourcePrompt,
  TUTOR_STUB_COMPACT_SPEAKING_PROMPT_SCHEMA,
} from '../services/tutorStubCompactSpeakingPrompt.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_PATH = path.join(
  ROOT,
  'tests',
  'fixtures',
  'tutor-stub-first-draft',
  'v33-tallow-answer-seeking-turn-5-request.json',
);
const LEARNER_TEXT = 'What should I put in the minutes about the chargers being dark during the stocktake?';
const PUBLIC_EVIDENCE = Object.freeze([
  "The depot's six new chargers draw their heaviest current in the evening, when the vans come home to plug in. The meeting noted the coincidence with satisfaction.",
  "The recording ammeter's pen chart for Thursday last, tabled as exhibit one: the streetlamps begin to dim at 18:40. The depot's chargers do not energise until 19:05, when the last van docks. The dip leads its suspect by twenty-five minutes.",
  "On the Thursday of the depot's annual stocktake the chargers stood dark all evening, every van parked cold — and Tallow Street browned out at 18:40 regardless, to the minute.",
]);

function v33Bundle(request) {
  const performanceStance =
    'Put the current public material under sharper contrast, consequence, or challenge while leaving refusal legible and avoiding status display. Do not request, offer, name, or direct a check, test, choice, move, or action in PERFORMANCE; HANDOFF owns that action.';
  return {
    turnId: '2026-07-16T07-03-36-147Z:t005',
    request,
    learnerText: LEARNER_TEXT,
    speakingResponseConfiguration: {
      engagement_stance: 'charismatic',
      action_family: 'stage_next_step',
      audience_register: 'adult_novice',
      lexical_accessibility: 'plain',
      scene_immersion: 'immersive',
      actorial_part: 'advocate',
      actorial_performance: {
        id: 'evidentiary_boundary',
        label: 'evidentiary boundary',
      },
    },
    firstDraftContract: {
      schema: 'machinespirits.tutor-stub.first-draft-turn-contract.v1',
      learner_move: 'Asks for wording about the stocktake evidence.',
      evidence: {
        active: false,
        sources: [],
        committed_public_surfaces: [...PUBLIC_EVIDENCE],
      },
      performance: {
        engagement_stance: 'charismatic',
        stance_instruction: 'Use sharper contrast, consequence, or challenge while leaving a concrete refusal path.',
        actorial_part: 'advocate',
        part_instruction:
          'Make the strongest presently licensed case in first person, then hand the learner a concrete way to test, resist, or break it.',
        tactic: 'evidentiary_boundary',
        tactic_label: 'evidentiary boundary',
        obligation_contract: {
          public_context: {
            world: {
              title: 'The Thursday Brownouts of Tallow Street',
              question: 'What browns out Tallow Street every Thursday evening?',
              narrative_diction: 'council minutes',
              ledger_term: 'meeting minutes',
              public_objects: ['meeting minutes'],
            },
            turn: {
              public_evidence: PUBLIC_EVIDENCE.map((surface) => ({ surface })),
              due_evidence: [],
            },
          },
        },
      },
      development: {
        action_family: 'stage_next_step',
        instruction:
          'No new evidence is available in this reply. Restage one already-public clue and state what it supports. Then name the next public check with a concrete verb such as test, check, compare, or trace. Do not ask the learner to invent unseen evidence. Put that concrete operation in the final handoff after the separate PERFORMANCE entry sentence. Do not turn the handoff into a request for the learner to name unspecified evidence.',
      },
      language: {
        audience_register: 'adult_novice',
        audience_instruction:
          'Presume adult intelligence but no domain fluency. Explain specialist terms locally, use one idea per sentence, and never equate confusion with low ability.',
        lexical_accessibility: 'plain',
        lexical_instruction:
          'Prefer common words, short sentences, and one relation at a time. Avoid unexplained specialist vocabulary.',
        scene_immersion: 'immersive',
        scene_instruction:
          'Make the action feel situated in the dramatic world through at least two concrete scene objects or setting-specific terms. Do not break the fourth wall.',
        host_sentence_word_target: 17,
      },
      progression: {
        learner_uptake: { learner_surface: LEARNER_TEXT },
        turn_focus_contract: {
          primary_surface: LEARNER_TEXT,
          primary_groups: [
            {
              surface: 'the chargers being dark during the stocktake',
              terms: ['charger', 'being', 'dark', 'during', 'stocktake'],
            },
          ],
          due_surfaces: [],
          semantic_focus_candidates: {
            summary: 'Asks for wording about the stocktake evidence',
            pedagogical_need: 'Help connect the idle chargers to ruling out the depot',
          },
        },
      },
    },
    jointPerformanceFirstDraft: {
      schema: 'machinespirits.tutor-stub.structured-first-draft.v2',
      host_plan: {
        schema: 'machinespirits.tutor-stub.joint-performance-host-plan.v2',
        ordered_surface_ids: ['uptake', 'performance_entry', 'performance_response', 'handoff'],
        slots: {
          uptake: {
            instruction:
              'Begin exactly “Write:” with one learner-sayable sentence licensed by the public record. Preserve actors, relation, and polarity; never reverse cause or evidentiary force. Carry forward this move: Asks for wording about the stocktake evidence.',
          },
          performance: {
            entry_instruction:
              'As advocate for the live case, without naming the role, Begin “My case is” and state a concrete public proposition, not merely whether the case is strong, weak, or limited. In this same PERFORMANCE ENTRY, make its limit explicit with public boundary language such as but, cannot, not yet, only, or does not establish. Do not defer the limit to PERFORMANCE RESPONSE.',
            response_instruction:
              'In that action, state the exact support and its limit with concrete boundary words such as “only,” “not yet,” or “does not establish.” Ask no question here. Use the delivered boundary tactic, not the requested pressure tactic.',
            compatibility_instruction:
              'Keep PERFORMANCE declarative: do not request, schedule, offer, or direct the next action.',
            stance_instruction: performanceStance,
          },
          source: { active: false },
          handoff: {
            instruction:
              'State the current public limit through the selected action; ask no question. Begin HANDOFF with “Next,” or “Now,” followed immediately by one concrete public operation: test, check, compare, or trace. Reuse a public object named in PERFORMANCE. A static statement that the case, claim, or accusation “breaks” is not a next operation.',
          },
        },
        axis_ownership: {
          audience_register: ['uptake', 'performance', 'handoff'],
          lexical_accessibility: ['uptake', 'performance', 'handoff'],
          scene_immersion: ['performance'],
          actorial_part: ['performance'],
          actorial_performance: ['performance'],
          engagement_stance: ['performance'],
          public_evidence: [],
          source_accessibility: [],
          action_family: ['handoff'],
        },
      },
    },
  };
}

test('compact-no-source.v1 compiles the exact V33 request below 2500 estimated tokens', () => {
  const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  const bundle = v33Bundle(fixture.request);
  const original = structuredClone(bundle);
  const result = buildTutorStubCompactNoSourceRequest(bundle);
  const latest = result.request.messages.at(-1).content;

  assert.equal(result.schema, TUTOR_STUB_COMPACT_SPEAKING_PROMPT_SCHEMA);
  assert.equal(result.compilation.promptSize.authoredTotal.estimatedTokens, 2354);
  assert.ok(result.compilation.promptSize.authoredTotal.estimatedTokens <= 2500);
  assert.ok(result.compilation.promptSize.authoredTotal.estimatedTokens < 4930);
  assert.deepEqual(result.request.messages.slice(0, -1), fixture.request.messages.slice(0, -1));
  assert.deepEqual(bundle, original, 'the opt-in compiler must not mutate its frozen input');
  assert.equal(result.request.provider, fixture.request.provider);
  assert.equal(result.request.model, fixture.request.model);
  assert.equal(result.request.effort, fixture.request.effort);
  assert.match(latest, /LATEST LEARNER \(exact\): What should I put in the minutes/iu);
  assert.match(latest, /TURN FOCUS \(exact\): What should I put in the minutes/iu);
  for (const surface of PUBLIC_EVIDENCE) assert.ok(latest.includes(surface));
  for (const [axis, selected] of Object.entries(result.compilation.selectedResponseAxes)) {
    assert.match(latest, new RegExp(`${axis}=${selected}`, 'u'));
  }
  assert.match(
    latest,
    /\{"uptake":"\.\.\.","performance":\{"entry":"\.\.\.","response":"\.\.\."\},"handoff":"\.\.\."\}/u,
  );
  assert.match(latest, /UPTAKE owns the direct response/iu);
  assert.match(latest, /PERFORMANCE ENTRY owns the advocate part/iu);
  assert.match(latest, /PERFORMANCE RESPONSE owns evidentiary_boundary \(evidentiary boundary\)/iu);
  assert.match(latest, /HANDOFF alone owns stage_next_step/iu);
  assert.match(
    latest,
    /HANDOFF FOCUS: Keep both the public subject and its condition visible.*the chargers being dark during the stocktake/iu,
  );
  const measured = Object.fromEntries(result.compilation.promptSize.sections.map((section) => [section.id, section]));
  for (const section of [
    'world_scene',
    'evidence_safety',
    'named_tutor',
    'public_evidence_window',
    'scaffold',
    'host_plan',
  ]) {
    assert.ok(measured[section].chars > 0, `${section} should remain attributable`);
  }
  assert.equal(measured.classifier.chars, 0);
  assert.equal(measured.learner_dag.chars, 0);
  assert.doesNotMatch(
    `${result.request.systemPrompt}\n${latest}`,
    /learner classifier|learner-DAG|human discourse scaffold|best-path coverage|proof debt|bottleneck/iu,
  );
});

test('typed charismatic ownership stays in PERFORMANCE entry through compact compilation', () => {
  const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  const bundle = v33Bundle(fixture.request);
  bundle.jointPerformanceFirstDraft.host_plan.slots.performance.engagement_operation_contract = {
    schema: 'machinespirits.tutor-stub.engagement-operation.v1',
    active: true,
    id: 'public_pressure_collision',
    owner: 'performance_entry',
  };
  bundle.jointPerformanceFirstDraft.host_plan.slots.performance.entry_instruction =
    'Say exactly “I set this against the claim: depot chargers stayed inactive; Tallow Street brownout continued.”';

  const result = buildTutorStubCompactNoSourceRequest(bundle);
  const latest = result.request.messages.at(-1).content;

  assert.match(latest, /PERFORMANCE ENTRY owns the advocate part and the charismatic stance/iu);
  assert.match(latest, /Say exactly “I set this against the claim:/iu);
  assert.doesNotMatch(latest, /Begin exactly “My case is/iu);
  assert.match(latest, /PERFORMANCE RESPONSE owns evidentiary_boundary \(evidentiary boundary\):/iu);
  assert.doesNotMatch(latest, /PERFORMANCE RESPONSE owns[^\n]*charismatic stance/iu);
});

test('frozen-bundle replacement is opt-in and preserves the V2 request shape', () => {
  const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  const bundle = v33Bundle(fixture.request);
  const refreshed = replaceTutorStubFrozenRequestWithCompactNoSourcePrompt(bundle);

  assert.notEqual(refreshed, bundle);
  assert.equal(refreshed.compactSpeakingPrompt.mode, 'compact-no-source.v1');
  assert.equal(refreshed.compactSpeakingPrompt.v2OutputShapePreserved, true);
  assert.deepEqual(refreshed.request.messages.slice(0, -1), bundle.request.messages.slice(0, -1));
  assert.deepEqual(refreshed.request.config, bundle.request.config, 'live request settings and audits stay untouched');
});

test('compact-no-source.v1 rejects a turn with due evidence before changing the request', () => {
  const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  const bundle = v33Bundle(fixture.request);
  bundle.firstDraftContract.evidence.active = true;
  bundle.firstDraftContract.evidence.sources = [{ surface: 'A new clue.' }];

  assert.throws(() => buildTutorStubCompactNoSourceRequest(bundle), /cannot compile a turn with current due evidence/u);
  assert.equal(bundle.request, fixture.request);
});
