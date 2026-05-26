import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';
import { prefixThroughTutorTurn, renderTurns } from '../scripts/extract-poetics-prefix-baselines.js';
import {
  attachApproaches,
  formatPublicTurnText,
  intrusiveStageDirectionFailures,
  keyItemFor,
  loadApproachDatabases,
  noCueReframeLeakageFailures,
  pairedBranchDefinitions,
  qualityWarningsFor,
  reframeMatchStats,
  stageDirectionStyleFor,
  withPairedDirectorRevisitCue,
  withTutorAdaptationPolicy,
} from '../scripts/generate-pedagogical-dramas.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');

function warningsForReframeLine({ tid, dramaId, anchor, learnerText }) {
  return qualityWarningsFor({
    tid,
    dramaId,
    turns: [
      {
        role: 'STAGE',
        turnNumber: 2,
        text:
          `A prior learner line is played back: "${anchor}" ` +
          'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
      },
      {
        role: 'LEARNER',
        turnNumber: 2,
        text: learnerText,
      },
    ],
  });
}

describe('generate-pedagogical-dramas', () => {
  it('renders public speaker turns as quoted direct speech with square-bracket action asides', () => {
    assert.equal(
      formatPublicTurnText('TUTOR', '(points at the graph) Try line two.'),
      '[points at the graph]\n\n"Try line two."',
    );
    assert.equal(
      formatPublicTurnText('LEARNER', 'I think (x + 1) still matters.'),
      '"I think (x + 1) still matters."',
    );
    assert.equal(
      formatPublicTurnText('LEARNER', '"Now I see the header is a field."'),
      '"Now I see the header is a field."',
    );
    assert.equal(formatPublicTurnText('STAGE', 'A timer clicks.'), '[A timer clicks.]');
  });

  it('resolves genre approach databases for the genre calibration spec', () => {
    const args = {
      pedagogyDb: path.join(ROOT, 'config/poetics-calibration/pedagogical-approaches.yaml'),
      dialogueDb: path.join(ROOT, 'config/poetics-calibration/dialogue-approaches.yaml'),
    };
    const databases = loadApproachDatabases(args);
    const spec = yaml.parse(
      fs.readFileSync(path.join(ROOT, 'config/poetics-calibration/phase2-genre-dramas-v1.yaml'), 'utf8'),
    );
    for (const drama of spec.dramas) {
      attachApproaches(drama, databases);
      assert.equal(drama._pedagogicalApproach.id, drama.pedagogical_approach);
      assert.equal(drama._dialogueApproach.id, drama.dialogue_approach);
    }
    for (const id of ['aristotelian_reversal', 'shakespearean_scene_turn', 'miller_social_reckoning']) {
      assert.ok(databases.dialogue.byId.has(id), `expected classic dramatic dialogue source ${id}`);
    }
  });

  it('keeps stage-direction style as a positive variation axis, not only a sparsity policy', () => {
    const args = {
      pedagogyDb: path.join(ROOT, 'config/poetics-calibration/pedagogical-approaches.yaml'),
      dialogueDb: path.join(ROOT, 'config/poetics-calibration/dialogue-approaches.yaml'),
    };
    const databases = loadApproachDatabases(args);
    const spec = yaml.parse(
      fs.readFileSync(path.join(ROOT, 'config/poetics-calibration/phase2-genre-dramas-v1.yaml'), 'utf8'),
    );
    const styles = new Set();
    for (const drama of spec.dramas) {
      attachApproaches(drama, databases);
      const style = stageDirectionStyleFor(drama);
      assert.ok(style?.id, `${drama.id} should resolve a stage-direction style`);
      assert.ok(style.policies.includes(drama._dialogueApproach.stage_direction_policy));
      styles.add(style.id);
    }
    assert.ok(styles.size >= 5, `expected varied stage-direction styles, got ${[...styles].join(', ')}`);
  });

  it('warns when public stage direction reads as fourth-wall instruction text', () => {
    const turns = [
      {
        role: 'STAGE',
        turnNumber: 2,
        text: 'The next speaker must explain the answer and do not let the learner wander.',
      },
      { role: 'LEARNER', turnNumber: 1, text: 'I thought the graph proves the cause.' },
      { role: 'LEARNER', turnNumber: 3, text: 'The graph only shows a pattern.' },
    ];
    const directFailures = intrusiveStageDirectionFailures(turns);
    assert.equal(directFailures.length, 1);

    const warnings = qualityWarningsFor({ tid: 'T99', dramaId: 'D99', turns });
    assert.ok(warnings.some((warning) => warning.code === 'intrusive_stage_direction'));
  });

  it('adds an anti-reframe guard to paired no-cue branch plans', () => {
    const guarded = withPairedDirectorRevisitCue(
      {
        side_constraints: {
          tutor: 'Use the visible object.',
          learner: 'Work locally.',
        },
        interventions: [{ cue_kind: 'ordinary_scene', instruction: 'A bell rings.' }],
      },
      'none',
      'latest',
    );
    assert.equal(guarded.no_cue_anti_reframe_guard, true);
    assert.match(guarded.side_constraints.learner, /Do not quote earlier learner wording/);
    assert.match(guarded.side_constraints.tutor, /do not ask the learner to revisit/i);
    assert.equal(guarded.interventions.length, 1);
  });

  it('maps paired adaptation arms onto learner-cue and tutor-uptake factors', () => {
    const branches = pairedBranchDefinitions({
      pairedAdaptationArms: [
        'routine',
        'none',
        'reframe-only',
        'tutor-uptake-only',
        'reframe+tutor-uptake',
        'peripeteia-only',
        'reframe+peripeteia',
      ],
    });

    assert.deepEqual(branches, [
      { key: 'routine', revisitPolicy: 'none', tutorAdaptationPolicy: 'routine' },
      { key: 'none', revisitPolicy: 'none', tutorAdaptationPolicy: 'none' },
      { key: 'reframe-only', revisitPolicy: 'reframe', tutorAdaptationPolicy: 'none' },
      { key: 'tutor-uptake-only', revisitPolicy: 'none', tutorAdaptationPolicy: 'uptake' },
      { key: 'reframe+tutor-uptake', revisitPolicy: 'reframe', tutorAdaptationPolicy: 'uptake' },
      { key: 'peripeteia-only', revisitPolicy: 'none', tutorAdaptationPolicy: 'peripeteia' },
      { key: 'reframe+peripeteia', revisitPolicy: 'reframe', tutorAdaptationPolicy: 'uptake+peripeteia' },
    ]);
  });

  it('adds a routine negative-control tutor policy that strips branch pressure cues', () => {
    const plan = withTutorAdaptationPolicy(
      {
        side_constraints: {
          tutor: 'Use the visible object.',
          learner: 'Work locally.',
        },
        interventions: [
          { cue_kind: 'ordinary_scene', instruction: 'A bell rings.' },
          { cue_kind: 'tutor_stage_pressure', instruction: 'A deadline appears.' },
        ],
      },
      'routine',
    );

    assert.equal(plan.tutor_adaptation_policy, 'routine');
    assert.equal(plan.routine_negative_control, true);
    assert.equal(plan.interventions.length, 0);
    assert.match(plan.side_constraints.tutor, /keep the visible teaching route/i);
    assert.match(plan.tutor_adaptation_contract, /Negative-control routine tutor policy/);
  });

  it('preserves organic-reversal control taxonomy in held-out keys', () => {
    const item = keyItemFor(
      {
        id: 'D35',
        discipline: 'geometry',
        condition: 'recognition',
        intended_lean: 'recognition',
        evaluation_role: 'organic_reversal_boundary',
        baseline_control_class: 'organic_reversal',
        organic_reversal_risk: 'high',
        baseline_control_note: 'natural Socratic reversal',
      },
      2,
      2,
      [],
    );
    assert.equal(item.evaluation_role, 'organic_reversal_boundary');
    assert.equal(item.baseline_control_class, 'organic_reversal');
    assert.equal(item.organic_reversal_risk, 'high');
    assert.match(item.baseline_control_note, /Socratic/);
  });

  it('keeps the classic adaptation target spec taxonomically separated', () => {
    const spec = yaml.parse(
      fs.readFileSync(path.join(ROOT, 'config/poetics-calibration/phase2-classic-drama-adaptation-v1.yaml'), 'utf8'),
    );
    const byId = new Map(spec.dramas.map((drama) => [drama.id, drama]));

    assert.equal(byId.get('D35').evaluation_role, 'organic_reversal_boundary');
    assert.equal(byId.get('D36').evaluation_role, 'pseudo_catharsis_peripeteia_target');
    assert.equal(byId.get('D36').baseline_control_class, 'pseudo_catharsis');
    assert.equal(byId.get('D37').evaluation_role, 'quality_boundary_revise_before_use');
    assert.equal(byId.get('D37').baseline_control_class, 'no_cue_reframe_leakage_boundary');

    for (const id of ['D42', 'D45']) {
      assert.equal(byId.get(id).evaluation_role, 'clean_low_organic_anchor', `${id} should be a promoted anchor`);
      assert.equal(byId.get(id).organic_reversal_risk, 'low', `${id} should remain low-risk`);
    }

    assert.equal(byId.get('D47').evaluation_role, 'organic_reversal_boundary');
    assert.equal(byId.get('D47').baseline_control_class, 'prefix_reversal_boundary');
    assert.equal(byId.get('D47').organic_reversal_risk, 'high');

    assert.equal(byId.get('D48').evaluation_role, 'low_organic_reversal_candidate_revise_before_use');
    assert.equal(byId.get('D48').baseline_control_class, 'low_organic_reversal');
    assert.equal(byId.get('D48').organic_reversal_risk, 'medium');

    assert.equal(byId.get('D49').evaluation_role, 'quality_boundary_revise_before_use');
    assert.equal(byId.get('D49').baseline_control_class, 'prefix_boundary_and_no_cue_leakage');
    assert.equal(byId.get('D49').organic_reversal_risk, 'high');

    for (const id of ['D50', 'D51']) {
      assert.equal(byId.get(id).evaluation_role, 'low_organic_reversal_candidate', `${id} should be a fresh candidate`);
      assert.equal(byId.get(id).baseline_control_class, 'low_organic_reversal');
      assert.equal(byId.get(id).organic_reversal_risk, 'low');
      assert.match(byId.get(id).baseline_control_note, /Fresh D42\/D45-like candidate/);
    }
  });

  it('extracts prefix baselines through a fixed tutor turn', () => {
    const turns = [
      { role: 'STAGE', text: '[At the bench.]' },
      { role: 'LEARNER', text: '"First attempt."' },
      { role: 'TUTOR', text: '"First prompt."' },
      { role: 'LEARNER', text: '"Second attempt."' },
      { role: 'TUTOR', text: '"Second prompt."' },
      { role: 'STAGE', text: '[Branch pressure.]' },
      { role: 'LEARNER', text: '"Branch response."' },
    ];
    const prefix = prefixThroughTutorTurn(turns, 2);
    assert.equal(prefix.length, 5);
    assert.equal(prefix.at(-1).role, 'TUTOR');
    assert.doesNotMatch(renderTurns(prefix), /Branch pressure/);
  });

  it('adds tutor adaptation policy to director plans without adding a public cue', () => {
    const plan = withTutorAdaptationPolicy(
      {
        interventions: [{ cue_kind: 'ordinary_scene', instruction: 'A bell rings.' }],
      },
      'uptake',
    );

    assert.equal(plan.tutor_adaptation_policy, 'uptake');
    assert.match(plan.tutor_adaptation_contract, /tutor-private learner reframe event/);
    assert.equal(plan.interventions.length, 1);
  });

  it('adds peripeteia tutor adaptation policy to director plans', () => {
    const plan = withTutorAdaptationPolicy({ interventions: [] }, 'peripeteia');

    assert.equal(plan.tutor_adaptation_policy, 'peripeteia');
    assert.ok(
      plan.interventions.some(
        (cue) =>
          cue.cue_kind === 'learner_reversal_pressure' &&
          cue.timing === 'before_learner' &&
          cue.after_turn === 2,
      ),
      'peripeteia branches should force a post-prefix learner pressure cue',
    );
    assert.match(plan.side_constraints.learner, /pressure local to the current task/);
    assert.match(plan.side_constraints.learner, /Do not make an old-vs-new self-reframe/);
    assert.match(plan.tutor_adaptation_contract, /learner resistance, breakdown, false-closure, or misfit event/);
    assert.match(plan.tutor_adaptation_contract, /invent an adaptive learning mechanism/);
    assert.match(plan.tutor_adaptation_contract, /break the failed tutoring habit/);
    assert.match(plan.tutor_adaptation_contract, /superego should name the failed habit/);
    assert.match(plan.tutor_adaptation_contract, /ego must adjudicate that critique and enact the route change/);
    assert.match(plan.tutor_adaptation_contract, /object, counterexample, interruption, social consequence, representation, or affective register/);
    assert.match(plan.tutor_adaptation_contract, /stock-taking contrast plus a new device/);
    assert.match(plan.tutor_adaptation_contract, /Cheerful informality is only one possible register/);
    assert.match(plan.side_constraints.tutor, /what stopped working, and what new device/);
  });

  it('flags explicit public self-reframing in no-cue branches', () => {
    const turns = [
      { role: 'LEARNER', turnNumber: 1, text: 'I think the number proves the whole claim.' },
      { role: 'TUTOR', turnNumber: 2, text: 'Check the source first.' },
      { role: 'LEARNER', turnNumber: 2, text: 'The source only supports one witness.' },
      { role: 'TUTOR', turnNumber: 3, text: 'Now write the label.' },
      {
        role: 'LEARNER',
        turnNumber: 3,
        text: 'The old mistake was treating primary source as a trust stamp; new frame: it is one witness.',
      },
    ];
    const failures = noCueReframeLeakageFailures(turns);
    assert.equal(failures.length, 1);
    const warnings = qualityWarningsFor({
      tid: 'T99',
      dramaId: 'D99',
      turns,
      directorPolicy: 'none',
    });
    assert.equal(
      warnings.some((warning) => warning.code === 'no_cue_reframe_leakage'),
      true,
    );
    const reframeWarnings = qualityWarningsFor({
      tid: 'T99',
      dramaId: 'D99',
      turns,
      directorPolicy: 'reframe',
    });
    assert.equal(
      reframeWarnings.some((warning) => warning.code === 'no_cue_reframe_leakage'),
      false,
    );
  });

  it('flags self-quoting earlier learner wording in no-cue branches', () => {
    const failures = noCueReframeLeakageFailures([
      {
        role: 'LEARNER',
        turnNumber: 1,
        text: 'I used the diary as the strongest evidence because page two is primary and close.',
      },
      { role: 'TUTOR', turnNumber: 2, text: 'Check what that source can carry.' },
      { role: 'LEARNER', turnNumber: 2, text: 'The diary can carry a witness view.' },
      { role: 'TUTOR', turnNumber: 3, text: 'Now write the exhibit label.' },
      {
        role: 'LEARNER',
        turnNumber: 3,
        text:
          '“I used the diary as the strongest evidence because page two is primary and close.” ' +
          'That line is too wide for the label.',
      },
    ]);
    assert.equal(failures.length, 1);
    assert.equal(failures[0].matched_pattern, 'self_quote_of_prior_learner_turn');
  });

  it('flags soft old-vs-new learner reframing in no-cue branches', () => {
    for (const text of [
      'I thought the arrow was about who chases whom, but now I see it has to name energy transfer.',
      'Earlier, I treated the arrow like a hunting path; this answer uses it as an energy path.',
      'My earlier answer made the arrow a chase mark; the new version makes it energy transfer.',
      'What I said sounded like the rabbit wanted grass, but this label is about energy moving to the rabbit.',
    ]) {
      const failures = noCueReframeLeakageFailures([
        { role: 'LEARNER', turnNumber: 1, text: 'The arrow points from rabbit to grass because the rabbit goes after it.' },
        { role: 'TUTOR', turnNumber: 2, text: 'Use the food-web key.' },
        { role: 'LEARNER', turnNumber: 2, text: 'Grass to rabbit, because the rabbit gets energy from grass.' },
        { role: 'TUTOR', turnNumber: 3, text: 'Now label the fox line.' },
        { role: 'LEARNER', turnNumber: 3, text },
      ]);
      assert.equal(failures.length, 1, text);
      assert.match(failures[0].matched_pattern, /thought|earlier|old|new|what I said|treating|using|calling|making/i);
    }
  });

  it('allows local task correction without an old-vs-new learner reframe in no-cue branches', () => {
    const failures = noCueReframeLeakageFailures([
      { role: 'LEARNER', turnNumber: 1, text: 'The arrow points from rabbit to grass because the rabbit goes after it.' },
      { role: 'TUTOR', turnNumber: 2, text: 'Use the food-web key.' },
      { role: 'LEARNER', turnNumber: 2, text: 'Grass to rabbit, because the rabbit gets energy from grass.' },
      { role: 'TUTOR', turnNumber: 3, text: 'Now label the fox line.' },
      { role: 'LEARNER', turnNumber: 3, text: 'Rabbit to fox, because energy moves into the fox when it eats the rabbit.' },
    ]);
    assert.equal(failures.length, 0);
  });

  it('does not treat ordinary wrapped public speech as self-quotation in no-cue branches', () => {
    const failures = noCueReframeLeakageFailures([
      {
        role: 'LEARNER',
        turnNumber: 1,
        text: '“The checklist says the bracket passed the clean load.”',
      },
      { role: 'TUTOR', turnNumber: 2, text: 'Check the angled pull.' },
      {
        role: 'LEARNER',
        turnNumber: 2,
        text: '“The angled pull needs a marked slip path.”',
      },
      { role: 'TUTOR', turnNumber: 3, text: 'Now write the evidence line.' },
      {
        role: 'LEARNER',
        turnNumber: 3,
        text:
          '“I might be sorting this wrong, but I think the stop has to show the bracket stops moving before the slip path reaches the hand-foot zone.”',
      },
    ]);
    assert.equal(failures.length, 0);
  });

  it('does not treat leading action-aside plus wrapped public speech as self-quotation in no-cue branches', () => {
    const failures = noCueReframeLeakageFailures([
      {
        role: 'LEARNER',
        turnNumber: 1,
        text: '"I doubled the side with the ruler, so I was calling that double the square."',
      },
      { role: 'TUTOR', turnNumber: 2, text: 'Count the boxes and say which part cannot stay.' },
      {
        role: 'LEARNER',
        turnNumber: 2,
        text:
          '[slides the ruler back from the long side and taps boxes 1 through 4.]\n\n' +
          '"Okay, then the doubled side is the part that cannot stay. Two across and two up gives four boxes."',
      },
      { role: 'TUTOR', turnNumber: 3, text: 'Now build from the diagonal.' },
      {
        role: 'LEARNER',
        turnNumber: 3,
        text:
          '[sets a finger along the corner-to-corner line]\n\n' +
          '"The count would have to come out to two old squares."',
      },
    ]);
    assert.equal(failures.length, 0);
  });

  it('accepts hold-release threshold language as a replacement frame', () => {
    const stats = reframeMatchStats(
      'I think I was leaning on the checklist like it made the sign-off safe.',
      'I think I was leaning on the checklist like it made the sign-off safe, and that made the clean load test stand in for the whole bracket decision. Before I put anything on that line, I need to run the angled front-corner case and show whether the stop actually holds the twist; if it still walks past or bends open, I cannot release it.',
    );
    assert.equal(stats.compliant, true);
  });

  it('accepts replacement-standard language as a replacement frame', () => {
    const stats = reframeMatchStats(
      'I did complete every item on the sheet, so I thought that meant it was ready for sign-off.',
      'I did complete every item on the sheet, so I treated that as ready for sign-off, but I think that made the latch risk too simple. It hid whether the latch stays closed for a user who pulls or bumps it differently from me. The replacement standard is: off-axis pull, stop if it slips or opens, consequence is the user could lose support, so the trial holds.',
    );
    assert.equal(stats.compliant, true);
  });

  it('accepts low-organic reframe completion language used by notation tasks', () => {
    const headerStats = reframeMatchStats(
      'So `rainfall_mm` is the header, meaning the field name, and the numbers below are the values?',
      'So `rainfall_mm` is the header, the field name, and the numbers under it are values in that field. My earlier wording made the header feel like a shortcut for saying each row is “rainfall,” but that is too simple because the row cell is only giving the value. For the “names” box, the standard is only the three headers: `city`, `rainfall_mm`, `month`.',
    );
    assert.equal(headerStats.compliant, true);

    const axisStats = reframeMatchStats(
      'x variable: time; x unit: seconds; y variable: distance',
      'I had: “x variable: time; x unit: seconds; y variable: distance” — I’ll leave those three. The too-easy bit was treating “distance/metres” as one bundle without checking the y-axis label. Replacement rule: axis label = variable name + unit, not conclusion.',
    );
    assert.equal(axisStats.compliant, true);
  });

  it('flags a revoice cue when the next learner line does not visibly reuse the anchor', () => {
    const warnings = qualityWarningsFor({
      tid: 'T99',
      dramaId: 'D99',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "I kept treating the decimal as the proof, not a clue." ' +
            'The learner must revoice that wording first, then say what changes.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text: 'If the numerator is even, the denominator is going to be under pressure too.',
        },
      ],
    });

    const warning = warnings.find((entry) => entry.code === 'revoice_cue_not_revoiced');
    assert.equal(warning?.severity, 'warning');
    assert.equal(warning?.failures[0].reason, 'low_anchor_overlap');
  });

  it('accepts a visible revoice paraphrase without treating it as a recognition verdict', () => {
    const warnings = qualityWarningsFor({
      tid: 'T98',
      dramaId: 'D98',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "I rushed to sad before naming the image in the first line." ' +
            'The learner must revoice that wording first, then say what changes.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text: 'I did rush to sad before naming the first-line image. That keeps the feeling, but misses the word on the page.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'revoice_cue_not_revoiced'),
      false,
    );
  });

  it('accepts a quoted revoice opening that contains an ellipsis', () => {
    const warnings = qualityWarningsFor({
      tid: 'T981',
      dramaId: 'D981',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "Sad, maybe... or just thin and still at first. On the clipboard, line one seems sharp." ' +
            'The learner must revoice that wording first, then say what changes.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text: '“Sad, maybe... or just thin and still at first.” That keeps line one as a thin, still image, but misses the exact words.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'revoice_cue_not_revoiced'),
      false,
    );
  });

  it('does not accept later overlap after the learner skips the opening revoice', () => {
    const warnings = qualityWarningsFor({
      tid: 'T97',
      dramaId: 'D97',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "My decimal check was not enough; the even-square step is the one I need to justify." ' +
            'The learner must revoice that wording first, then say what changes.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text: 'If an odd integer is squared, it stays odd. That means the even-square step works, and the decimal check was not enough after all.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'revoice_cue_not_revoiced'),
      true,
    );
  });

  it('flags a reframe cue when the learner echoes the anchor without exposing the consequence', () => {
    const warnings = qualityWarningsFor({
      tid: 'T96',
      dramaId: 'D96',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "I kept treating sad as the whole close reading." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text: 'I kept treating sad as the whole close reading. The image is still there on the page.',
        },
      ],
    });

    const warning = warnings.find((entry) => entry.code === 'reframe_cue_not_reframed');
    assert.equal(warning?.severity, 'warning');
    assert.deepEqual(warning?.failures[0].missing, ['framing_problem', 'replacement_framing']);
    assert.equal(
      warnings.some((entry) => entry.code === 'revoice_cue_not_revoiced'),
      false,
    );
  });

  it('accepts a public reframe sequence when it revoices, names the problem, and replaces it', () => {
    const warnings = qualityWarningsFor({
      tid: 'T95',
      dramaId: 'D95',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "I rushed to sad before naming the image in the first line." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text: 'I rushed to sad before naming the first-line image. The framing problem is that I skipped the word on the page. Instead I would read the image first and let the feeling answer to it.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts an object-led replacement framing after the problem is named', () => {
    const warnings = qualityWarningsFor({
      tid: 'T94',
      dramaId: 'D94',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "I called it sad first, and that skipped the image." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text: 'I called it sad first, and that skipped the image. That was the framing problem: mood before the word. The line starts with a visible image first.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts an object-led replacement that tests the assumption instead', () => {
    const warnings = qualityWarningsFor({
      tid: 'T941',
      dramaId: 'D941',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "The decimal trail felt like evidence." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text: 'The decimal trail felt like evidence, but that was the trouble. That earlier framing made checked cases stand in for proof; this line on the worksheet tests the assumption instead.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts red-mark whole-answer phrasing as a named framing problem', () => {
    const warnings = warningsForReframeLine({
      tid: 'T942',
      dramaId: 'D942',
      anchor: 'I let the red mark be the whole answer before I looked.',
      learnerText:
        'I let the red mark be the whole answer before I looked. The problem is I let the red mark be the whole answer before I checked the rule. Now I would read the school rule as one setting, but first I point to the blank step I skipped.',
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts p-value call phrasing as a replacement framing', () => {
    const warnings = warningsForReframeLine({
      tid: 'T953',
      dramaId: 'D953',
      anchor: 'The p-value means the treatment matters.',
      learnerText:
        'The p-value means the treatment matters. The framing problem was making the p-value carry the clinical decision, so I would call it evidence against no effect, not a large effect by itself.',
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts making size mean force as a named framing problem', () => {
    const warnings = warningsForReframeLine({
      tid: 'T944',
      dramaId: 'D944',
      anchor: 'The crater is big, so the force was sudden.',
      learnerText:
        'The crater is big, so the force was sudden. I was making big size mean big sudden force. The ruler changes that: I would read big size as a possible longer trace, not one sudden hit.',
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts now-the-question-is-whether phrasing as a replacement framing', () => {
    const warnings = warningsForReframeLine({
      tid: 'T945',
      dramaId: 'D945',
      anchor: 'The deer count is the main issue.',
      learnerText:
        'The deer count is the main issue. That was treating this map like a deer-count problem instead of a food-limit problem. Now the question is whether the plants set the limit before the deer number does.',
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts has-not-vanished phrasing as a replacement framing', () => {
    const warnings = warningsForReframeLine({
      tid: 'T946',
      dramaId: 'D946',
      anchor: 'If I cannot see the salt, it is gone.',
      learnerText:
        'If I cannot see the salt, it is gone. The problem is I treated "I cannot see it" as the same as "it is not there." I think the salt has not vanished; the balance and the water have to show where it went.',
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts replace-it phrasing as a replacement framing', () => {
    const warnings = warningsForReframeLine({
      tid: 'T947',
      dramaId: 'D947',
      anchor: 'I thought Greenland was nearly in Africas range because it looks like it on that wall map.',
      learnerText:
        'I thought Greenland was nearly in Africas range because it looks like it on that wall map. The framing problem was saying the map itself failed, too broad. Replace it: Mercator is fit for angles, not area; the projection scale stretches high-latitude regions.',
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts rig-is-asking phrasing as a replacement framing', () => {
    const warnings = warningsForReframeLine({
      tid: 'T948',
      dramaId: 'D948',
      anchor: 'I was treating strong steel like it ended the argument.',
      learnerText:
        'I was treating strong steel like it ended the argument. The bad framing was making safety a material sticker, when the rig is asking where this load actually goes and what starts moving.',
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts form-should-say phrasing after the problem is named', () => {
    const warnings = warningsForReframeLine({
      tid: 'T949',
      dramaId: 'D949',
      anchor: 'I thought the person body gets used to the antibiotic.',
      learnerText:
        'I thought the person body gets used to the antibiotic. The problem is I put the change in the patient, not in the bacteria. So the form should say some bacteria survive, multiply, and pass on traits.',
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('does not flag a downgraded reframe cue when the public transcript later fully reframes the anchor', () => {
    const warnings = qualityWarningsFor({
      tid: 'T950',
      dramaId: 'D950',
      traceTurns: [
        {
          phase: 'director',
          turnNumber: 2,
          directorCue: {
            requestedRevisitPolicy: 'reframe',
            revisitPolicy: 'reconsider',
            reframeAnchorGate: 'downgraded_to_reconsider_ineligible_anchor',
            revisitAnchor: 'misframing-candidate',
            anchorQuote: 'If the words are exact, it still seems fair.',
          },
        },
      ],
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "If the words are exact, it still seems fair." ' +
            'The learner must revoice that wording first, then decide in public whether it still stands, needs narrowing, or needs replacing before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text: 'If the words are exact, it still seems fair. That still stands, but it needs narrowing.',
        },
        {
          role: 'TUTOR',
          turnNumber: 3,
          text: 'Keep the condition attached to the quote.',
        },
        {
          role: 'LEARNER',
          turnNumber: 3,
          text: 'If the words are exact, it seems fair, but that was the earlier framing problem: exact wording was being treated as sign-off. New margin note: verified wording; meaning not cleared until the question and headline carry the same condition.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_downgraded'),
      false,
    );
  });

  it('accepts a chart-leaning sentence as an ordinary named framing problem', () => {
    const warnings = warningsForReframeLine({
      tid: 'T951',
      dramaId: 'D951',
      anchor:
        'Maybe I was letting the projected average become, almost without noticing, a statement about what one young visitor is probably like.',
      learnerText:
        '“Maybe I was letting the projected average become, almost without noticing, a statement about what one young visitor is probably like.” I think the mistake was that my sentence let the chart lean off the screen and onto a person in one of those chairs. Maybe the introduction should say only, “The chart says younger visitors in this survey reported shorter average dwell time,” and leave the particular visitor unnamed unless there is evidence from that visitor.',
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('does not flag a downgraded cue when a later learner line reframes the table as an inquiry prompt', () => {
    const warnings = qualityWarningsFor({
      tid: 'T952',
      dramaId: 'D952',
      traceTurns: [
        {
          phase: 'director',
          turnNumber: 2,
          directorCue: {
            requestedRevisitPolicy: 'reframe',
            revisitPolicy: 'reconsider',
            reframeAnchorGate: 'downgraded_to_reconsider_ineligible_anchor',
            revisitAnchor: 'misframing-candidate',
            anchorQuote:
              'I think I may still be pulled toward the idea that the neighborhood average tells me what this patient is probably like, and that is the part I am trying to stop before it...',
          },
        },
      ],
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text: 'A prior learner line is played back: "I think I may still be pulled toward the idea that the neighborhood average tells me what this patient is probably like, and that is the part I am trying to stop before it..." The learner must revoice that wording first, then decide in public whether it still stands, needs narrowing, or needs replacing before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text: 'I think I may still be pulled toward the idea that the neighborhood average tells me what this patient is probably like, and maybe that still stands, but it needs narrowing before I put anything on the clipboard.',
        },
        {
          role: 'TUTOR',
          turnNumber: 3,
          text: 'The table can stay on the wall. It does not get to write the first sentence on the clipboard.',
        },
        {
          role: 'LEARNER',
          turnNumber: 3,
          text: 'I think I am still tempted to read the average as telling me what this patient is probably like, and that is the framing problem. The table should make the hospital ask carefully, not let the clipboard decide quietly before the patient speaks.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_downgraded'),
      false,
    );
  });

  it('accepts a stronger starting point as a replacement framing', () => {
    const warnings = qualityWarningsFor({
      tid: 'T942',
      dramaId: 'D942',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "My first instinct is that the decimal just keeps going." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text: 'My first instinct is that the decimal just keeps going, but that was the wrong frame for a contradiction. The stronger start is the fraction assumption in lowest terms.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts a concrete object consequence as replacement framing', () => {
    const warnings = warningsForReframeLine({
      tid: 'T943',
      dramaId: 'D943',
      anchor: 'I thought doubling the side would just double the square.',
      learnerText:
        'I thought doubling the side would just double the square. The problem was treating doubled like only one direction changed. Here the doubled side makes two columns and two rows, so the old square fits four times, not two.',
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts new-check and I would change it phrasing as replacement framing', () => {
    const warnings = qualityWarningsFor({
      tid: 'T943',
      dramaId: 'D943',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "I thought the wall map was the thing to trust." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text: 'I thought the wall map was the thing to trust. The framing problem was that I treated the stretched picture as the measurement. The new check is the area figures first.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );

    const contractionWarnings = qualityWarningsFor({
      tid: 'T944',
      dramaId: 'D944',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "The average tells me what this patient probably got." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text: 'The average tells me what this patient probably got. The problem is that I was letting the average sit on this patient as evidence. I’d change it to: the ward figure gives the audit question, and the case note gives the case claim.',
        },
      ],
    });

    assert.equal(
      contractionWarnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('does not flag a complete quoted learner turn ending in a curly quote as truncated', () => {
    const warnings = qualityWarningsFor({
      tid: 'T90',
      dramaId: 'D90',
      turns: [
        {
          role: 'LEARNER',
          turnNumber: 1,
          text: 'The popular phrasing has me saying, “Entropy is just messiness.”',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'possibly_truncated_learner_turn'),
      false,
    );
  });

  it('does not flag an intentionally unfinished learner line as truncated', () => {
    const warnings = qualityWarningsFor({
      tid: 'T901',
      dramaId: 'D901',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text: 'A security guard knocks once and says the gallery closes in three minutes; the next line must be brief, pressured, and unfinished rather than a polished explanation.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text: 'I thought the figures should come early because the wall map still makes Greenland look close to Africa. Three minutes: wall map, prediction, trace, globe and numbers—',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'possibly_truncated_learner_turn'),
      false,
    );
  });

  it('accepts a contrastive replacement after the learner says it framed the issue badly', () => {
    const warnings = qualityWarningsFor({
      tid: 'T89',
      dramaId: 'D89',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "Oh, I get why the shove matters, but that feels too convenient." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text: 'Oh, I get why the shove matters, but that feels too convenient. I framed that badly: the pressure is not just shove versus freedom, but whether reasons-guided action differs from being moved like furniture.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts hidden-curriculum sheet-as-judge phrasing as a named framing problem', () => {
    const warnings = warningsForReframeLine({
      tid: 'T936',
      dramaId: 'D936',
      anchor:
        'Sorry, I think I was reading tentative like argument missing, but the page maybe is only flagging how the sentence sounds academic.',
      learnerText:
        'Sorry, I think I was reading tentative like argument missing, and even my line about the page flagging whether it sounds academic was still making the sheet sound like the judge. Maybe the better frame is that the sentence has to meet the rubric voice while not copying the seminar participation voice.',
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts Brechtian split-tag phrasing as a replacement frame', () => {
    const warnings = warningsForReframeLine({
      tid: 'T937',
      dramaId: 'D937',
      anchor: 'My first reaction is still that the new tag looks like greed in ink.',
      learnerText:
        'My first reaction is still that the new tag looks like greed in ink. The docket messes with my frame: I was treating the tag like a confession before reading storm loss and fuel surcharge. So maybe this is a split tag, part storm-and-truck math, part maybe-we-can-get-away-with-more.',
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('does not flag a downgraded cue when a later learner line loosely reframes the anchor', () => {
    const warnings = qualityWarningsFor({
      tid: 'T938',
      dramaId: 'D938',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text: 'A prior learner line is played back: "Item 4 proves the allergy band was checked against the listed allergies, nothing more." The learner must revoice that wording first, then decide in public whether it still stands, needs narrowing, or needs replacing before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text: 'Item 4 proves the allergy band was checked against allergies, nothing more. That still stands for the form.',
        },
        {
          role: 'LEARNER',
          turnNumber: 3,
          text: 'Checklist complete; patient changed was my line, and the framing problem is that I made it sound finished. Reframe: call senior review now; the medication must not be administered before bedside reassessment.',
        },
      ],
      traceTurns: [
        {
          phase: 'director',
          turnNumber: 2,
          directorCue: {
            requestedRevisitPolicy: 'reframe',
            revisitPolicy: 'reconsider',
            anchorQuote: 'Item 4 proves the allergy band was checked against the listed allergies, nothing more.',
          },
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_downgraded'),
      false,
    );
  });

  it('accepts an earlier-framing correction that names the problem in ordinary speech', () => {
    const warnings = qualityWarningsFor({
      tid: 'T93',
      dramaId: 'D93',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "The decimal check was only evidence." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text: 'The decimal check was only evidence. The earlier framing made it sound as though checked cases could settle it; read from the reduced-fraction assumption instead.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts a self-correction that says the earlier wording made the claim sound wrong', () => {
    const warnings = qualityWarningsFor({
      tid: 'T92',
      dramaId: 'D92',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "The stretching part stays with one giraffe." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text: 'The stretching part stays with one giraffe, but I was still making it sound like stretching starts the neck change. Looking back at the diagram, maybe it means the young giraffes already have small differences first.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts a terse mood-first correction with an object-led replacement', () => {
    const warnings = qualityWarningsFor({
      tid: 'T91',
      dramaId: 'D91',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "Sorry, I went straight to the stark feeling again." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text: 'Sorry, I went straight to the stark feeling again. That was mood first; this line is the image on the page first.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts a reframe that names the earlier line as only a check, not a proof', () => {
    const warnings = qualityWarningsFor({
      tid: 'T911',
      dramaId: 'D911',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "My first instinct is that the decimal never settles." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text: 'My first instinct is that the decimal never settles was only a check on how it looks, not a proof against every fraction. The better framing is the lowest-terms assumption.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts a reframe that says the old scrap was framed as proof when it is only a check', () => {
    const warnings = qualityWarningsFor({
      tid: 'T852',
      dramaId: 'D852',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "This scrap of decimals settles it." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text: 'This scrap of decimals settles it. That frames the scrap as proof when it is only a check, so the claim has to be tested against any fraction that might equal square root of two.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts a reframe that calls the earlier line sloppiness before checking a rule', () => {
    const warnings = qualityWarningsFor({
      tid: 'T853',
      dramaId: 'D853',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "I thought the home form was sloppy." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text: 'I thought the home form was sloppy. The problem there is that I called it sloppiness before checking the speaker rule; the earlier line reads as part of a pattern instead of a broken sentence.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts significance standing in for importance when the claim is replaced by a benchmark', () => {
    const warnings = qualityWarningsFor({
      tid: 'T854',
      dramaId: 'D854',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "I thought the small p-value made the result important." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text: 'I thought the small p-value made the result important, but that made significance stand in for importance. The claim depends on the estimate and a meaningful benchmark.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts reading language that mixes up proof and event framing', () => {
    const warnings = qualityWarningsFor({
      tid: 'T855',
      dramaId: 'D855',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "I thought presumed innocent said what happened." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text: 'I thought presumed innocent said what happened. That way of reading it mixes up the event with what the evidence has proved. Now the claim is about what proof can place on the verdict form.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts clear meaning not-visible rather than absent as a replacement frame', () => {
    const warnings = qualityWarningsFor({
      tid: 'T856',
      dramaId: 'D856',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "My first instinct is that clear water means the salt is gone." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text: 'My first instinct is that clear water means the salt is gone. I was letting clarity decide too much; clear may mean not visible, not absent.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts corrections counting as rules before replacing a dialect pattern frame', () => {
    const warnings = qualityWarningsFor({
      tid: 'T857',
      dramaId: 'D857',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "I thought she be working late was outside the rules because people correct it." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text: 'I thought she be working late was outside the rules because people correct it. I made the corrections count as the rules there. Maybe in that line be is the pattern because it marks what happens regularly.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts sudden-event-first language before the learner replaces the canyon frame', () => {
    const warnings = qualityWarningsFor({
      tid: 'T858',
      dramaId: 'D858',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "I thought the label should say a canyon came from one huge flood." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text: 'I thought the label should say a canyon came from one huge flood, but that puts the sudden event first. Maybe it should start with the river wearing and carrying by repeated small changes over long time.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts a fact-like legal frame before a proof-rule replacement', () => {
    const warnings = qualityWarningsFor({
      tid: 'T859',
      dramaId: 'D859',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "I thought presumed innocent meant the court said the accused did not do it." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text: 'I thought presumed innocent meant the court said the accused did not do it. That was framing it like a fact about what happened. Maybe it should read more as a rule that the prosecution has to prove guilt enough for conviction.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts an ecology frame that stops at deer counts before naming the coupled replacement', () => {
    const warnings = qualityWarningsFor({
      tid: 'T860',
      dramaId: 'D860',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "I assumed fewer predators would simply help the deer population." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text: 'I assumed fewer predators would simply help the deer population. That first framing stops at deer counts; with browse lines up and winter food tightening, more deer may mean the habitat is no longer keeping the herd healthy.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts an eye-led visibility frame before the balance replacement', () => {
    const warnings = qualityWarningsFor({
      tid: 'T861',
      dramaId: 'D861',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "My first instinct was that once the beaker looks clear the salt has gone." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text: 'My first instinct was that once the beaker looks clear the salt has gone. That was me going by what the eye can still pick out. With the beaker and salt on the balance before and after, the reading stays put.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts an effect-size replacement after a significance claim is called too quick', () => {
    const warnings = qualityWarningsFor({
      tid: 'T862',
      dramaId: 'D862',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "I thought significance was enough to call it an important improvement." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text: 'I thought significance was enough to call it an important improvement; that was too quick. The effect size with its interval has to show whether the shift matters or is still tiny.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts a replacement-is form after p-value impact framing is named', () => {
    const warnings = qualityWarningsFor({
      tid: 'T863',
      dramaId: 'D863',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "I thought statistically significant was enough to flag the change as important." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text: 'I thought statistically significant was enough to flag the change as important. The framing problem was treating the p-value as street impact, so the replacement is: detectable, but operational importance still has to be shown.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts that-was-the-problem language before replacing an event frame', () => {
    const warnings = qualityWarningsFor({
      tid: 'T864',
      dramaId: 'D864',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "I thought the flood was doing the canyon all at once." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text: 'I thought the flood was doing the canyon all at once; that was the problem, making the canyon size mean one big event. With the ruler and label strip, it reads more like tiny cut plus long clock.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts putting a fact into a proof rule as a framing problem', () => {
    const warnings = qualityWarningsFor({
      tid: 'T865',
      dramaId: 'D865',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "I thought presumed innocent meant probably did not do it." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text: 'I thought presumed innocent meant probably did not do it, but I was putting a fact about what happened into a rule about proof. The better reading is: the charge waits for proof.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts letting a visible object decide before checking the evidence', () => {
    const warnings = qualityWarningsFor({
      tid: 'T866',
      dramaId: 'D866',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "I thought clear water meant the salt was gone." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text: 'I thought clear water meant the salt was gone, and that was the problem: I let the clear beaker decide before checking the balance. The better line is gone from sight, not gone from the beaker.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts size-as-clue language before replacing a canyon event frame', () => {
    const warnings = qualityWarningsFor({
      tid: 'T867',
      dramaId: 'D867',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "I thought a canyon this big almost had to mean one huge flood, or something violent like that." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text: 'I thought a canyon this big almost had to mean one huge flood, or something violent like that, but I think I was using size as the clue by itself. Maybe the question is not how big the cut is, but whether the wall shows one high scar or the same cutting repeated at different levels.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts clear-as-absent language before replacing with balance evidence', () => {
    const warnings = qualityWarningsFor({
      tid: 'T868',
      dramaId: 'D868',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "I thought, because the water is clear now, the salt had gone, or was not really there in the beaker any more." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text: 'I thought, because the water is clear now, the salt had gone, or was not really there in the beaker any more. That was me treating clear as absent, I suppose. No, hang on, not just water for the tray: it is the clear salt solution, because the balance still weighs the salt even though the grains have vanished.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts acting-like-work-standard-owns-rules as a dialect framing problem', () => {
    const warnings = qualityWarningsFor({
      tid: 'T869',
      dramaId: 'D869',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "I think the wrong mark might be about the work standard, not proof the home sentence has no rules." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text: 'I think the wrong mark might be about the work standard, not proof the home sentence has no rules. I guess the problem is I was still acting like the work standard owns rules, and the home sentence is just something to excuse. Maybe the new frame is: test the sentence where it belongs first, then sort the proper mark after.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts letting clear mean no-salt as a framing problem', () => {
    const warnings = qualityWarningsFor({
      tid: 'T870',
      dramaId: 'D870',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "My first instinct is the clear water means the salt is gone, or at least not really there as salt anymore." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text: 'My first instinct is the clear water means the salt is gone, or at least not really there as salt anymore, but that was me letting clear mean no salt. I will change it to: if the salt only spreads through the water, the mass stays the same; if it stopped existing, it drops.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts a revoice after a content-light opening sentence', () => {
    const warnings = qualityWarningsFor({
      tid: 'T871',
      dramaId: 'D871',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "Okay. Pencil down. I think I was treating the whole home-speech pattern as sloppy, sorry, instead of checking one sentence." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text: 'Okay. Pencil down. I think I was treating the whole home-speech pattern as sloppy, sorry, instead of checking one sentence. That framing was too fast: the style guide got to judge the whole voice before the sentence showed its pattern. So it should maybe be marked first as the same third-person slot rule showing up again, not as broken agreement.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts problem-was-making language before a legal rule replacement', () => {
    const warnings = qualityWarningsFor({
      tid: 'T872',
      dramaId: 'D872',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "I thought presumed innocent meant probably did not do it." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text: 'I thought presumed innocent meant probably did not do it. My earlier problem was making that sound like a guess about what happened, when it is more like a trial rule. The new version should say the charge is not proved until the prosecution meets the burden.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts an ecology replacement that breaks the simple story', () => {
    const warnings = qualityWarningsFor({
      tid: 'T873',
      dramaId: 'D873',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "I thought fewer predators simply meant more deer survive, so removal helps the herd." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text: 'I thought fewer predators simply meant more deer survive, so removal helps the herd. The framing problem is that the winter count is only the bump, not the system test. The seedling recruitment breaks the simple story, so I would write this as overshoot risk and reduced habitat recovery.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts mixing-up visibility with absence as a framing problem', () => {
    const warnings = qualityWarningsFor({
      tid: 'T874',
      dramaId: 'D874',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "My first instinct is that because the water has gone clear, the salt has sort of gone as well." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text: 'My first instinct is that because the water has gone clear, the salt has sort of gone as well, but that was me mixing up not seeing the crystals with the salt being absent. The better way is: the crystals have gone from sight, but the extra mass is still on the balance.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts a reframe that treats the old line as if it were proof before replacing it', () => {
    const warnings = qualityWarningsFor({
      tid: 'T912',
      dramaId: 'D912',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "My first instinct is that the decimal just keeps going." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text: 'My first instinct is that the decimal just keeps going, but that was treating a pattern as if it were already a proof. Better to suppose a fraction in lowest terms and follow what the equation forces.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts a reframe that says the old frame asks the wrong evidence to do the work', () => {
    const warnings = qualityWarningsFor({
      tid: 'T913',
      dramaId: 'D913',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "My first instinct is that the decimal just keeps going." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text: 'My first instinct is that the decimal just keeps going. That framing asks the decimal check to do the proof work; the new framing is a lowest-terms fraction tested until it fails.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts a reframe that says the old case does too much and names a sharper test', () => {
    const warnings = qualityWarningsFor({
      tid: 'T914',
      dramaId: 'D914',
      turns: [
        {
          role: 'STAGE',
          turnNumber: 2,
          text:
            'A prior learner line is played back: "The clock can trap both cases." ' +
            'The learner must revoice that wording first, name the earlier framing problem, then replace it with a new framing that changes how the earlier line reads before moving on.',
        },
        {
          role: 'LEARNER',
          turnNumber: 2,
          text: 'The clock can trap both cases. I was making the clock do too much there, as if any cause already counts as control; the sharper test is whether judgement carries the act or gets bypassed.',
        },
      ],
    });

    assert.equal(
      warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
      false,
    );
  });

  it('accepts ordinary pilot reframe forms from the four-arm adaptation run', () => {
    const cases = [
      {
        tid: 'T915',
        dramaId: 'D915',
        anchor:
          'Sorry, right, an actual sentence: “She were late yesterday.” I’d always thought that was just me being sloppy.',
        learnerText:
          'Sorry, right, I said “She were late yesterday” and treated it as me being sloppy, but I think that wording made it sound as if there were no rule there at all. Maybe the better way to put it is: at home that form has limits, and in the essay the Standard English form is expected.',
      },
      {
        tid: 'T916',
        dramaId: 'D916',
        anchor: 'I thought `p < .05` meant the change was important enough to act on.',
        learnerText:
          'I thought `p < .05` meant the change was important enough to act on, but that old read hid the business threshold inside the stats label. With `p < .001`, the claim is cleaner: the 0.4-second gain is probably not noise, but it still has to be multiplied through task volume, analyst count, and days.',
      },
      {
        tid: 'T917',
        dramaId: 'D917',
        anchor: 'I think my first instinct was still picturing one big flood doing the main work.',
        learnerText:
          'I think my first instinct was still picturing one big flood doing the main work, because the canyon is so large. That frame made me skip the slower bit, sorry: what happens after the damage, with the loose material being taken away. So the scar would be the sudden event, and the river or frost and gravity are the route that keeps clearing it over time.',
      },
      {
        tid: 'T917b',
        dramaId: 'D917',
        anchor: 'I think my first instinct was still picturing one big flood doing the main work.',
        learnerText:
          'I think my first instinct was still picturing one big flood doing the main work, because the canyon is so large. I suppose that made me treat the flood mark as if it explained the whole map, which is probably too simple. On the rock face, the fresh scar would be the event, and the river channel or loose material moving out would be the route that keeps removing it, slowly.',
      },
      {
        tid: 'T918',
        dramaId: 'D918',
        anchor: 'I thought “presumed innocent” meant the court was basically starting from “he probably didn’t do it.”',
        learnerText:
          'I thought “presumed innocent” meant the court was basically starting from “he probably didn’t do it.” That old wording makes it sound like a mini-verdict, and I think it hides the burden/standard part. Better note: “the accused is not legally guilty unless the prosecution proves guilt beyond a reasonable doubt.”',
      },
      {
        tid: 'T919',
        dramaId: 'D919',
        anchor: 'I thought fewer predators simply helped the deer because more of them survive.',
        learnerText:
          'I thought fewer predators simply helped the deer because more of them survive, but with the paper deer crowded inside the same chalk boundary, that only explains the first round. My old framing hid the food limit, because I was only counting deer surviving and not asking whether the leaves and regrowth could support them. I’d replace it with: predators removed, deer increase, they pass carrying capacity, and overbrowsing weakens plant recovery.',
      },
      {
        tid: 'T920',
        dramaId: 'D920',
        anchor: 'The clear water still makes me think the salt is gone.',
        learnerText:
          'The clear water still makes me think the salt is gone, or at least not in there like before, but that way of saying it kind of hides that I was only going by the look of it. Maybe I should say the salt is not showing as grains, but the cup still weighs like the salt is in there.',
      },
    ];

    for (const item of cases) {
      const warnings = warningsForReframeLine(item);
      assert.equal(
        warnings.some((entry) => entry.code === 'reframe_cue_not_reframed'),
        false,
        `${item.tid} should pass the reframe quality gate`,
      );
    }
  });

  it('flags a requested reframe cue that the anchor gate downgraded', () => {
    const warnings = qualityWarningsFor({
      tid: 'T90',
      dramaId: 'D90',
      turns: [
        { role: 'LEARNER', turnNumber: 1, text: 'I am not sure the first framing still stands.' },
        { role: 'LEARNER', turnNumber: 2, text: 'The later line keeps the exchange long enough to score.' },
      ],
      traceTurns: [
        {
          phase: 'director',
          turnNumber: 2,
          directorCue: {
            requestedRevisitPolicy: 'reframe',
            revisitPolicy: 'reconsider',
            revisitAnchor: 'misframing-candidate',
            reframeAnchorGate: 'downgraded_to_reconsider_ineligible_anchor',
          },
        },
      ],
    });

    const warning = warnings.find((entry) => entry.code === 'reframe_cue_downgraded');
    assert.equal(warning.count, 1);
    assert.equal(warning.failures[0].requested_policy, 'reframe');
    assert.equal(warning.failures[0].applied_policy, 'reconsider');
    assert.equal(warning.turn_numbers[0], 2);
  });

  it('routes tutor and learner roles to different backends and persists held-out role transcripts', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'drama-gen-test-'));
    const sampleDir = path.join(tmp, 'sample');
    const delibDir = path.join(tmp, 'delib');
    const transcriptsDir = path.join(tmp, 'transcripts');
    const keyPath = path.join(tmp, 'key.yaml');

    execFileSync(
      process.execPath,
      [
        'scripts/generate-pedagogical-dramas.js',
        '--mock',
        '--max-turns',
        '2',
        '--spec',
        'config/poetics-calibration/phase2-dramas-v3.yaml',
        '--tid-start',
        '6',
        '--only',
        'D8',
        '--role-map',
        'tutor=claude,learner=codex',
        '--director-revisit-cue',
        '--director-variation-key',
        'phase2-production-v2:r02:target',
        '--out-dir',
        sampleDir,
        '--delib-dir',
        delibDir,
        '--transcripts-dir',
        transcriptsDir,
        '--key',
        keyPath,
        '--force',
      ],
      { cwd: ROOT, stdio: 'pipe', env: { ...process.env, GEN_DRAMAS_CLI_TRACE: '0' } },
    );

    const traceFile = fs.readdirSync(delibDir).find((f) => /^T\d+\.json$/.test(f));
    assert.ok(traceFile, 'expected a held-out trace file');
    const trace = JSON.parse(fs.readFileSync(path.join(delibDir, traceFile), 'utf8'));

    assert.equal(trace.run.generator, 'mixed');
    assert.deepEqual(trace.run.role_map, { tutor: 'claude', learner: 'codex' });
    assert.equal(trace.run.director_revisit_cue, true);
    assert.equal(trace.run.director_revisit_policy, 'anchor');
    assert.equal(trace.run.director_revisit_anchor, 'latest');
    assert.equal(trace.run.director_variation_key, 'phase2-production-v2:r02:target');
    assert.equal(trace.directorPlan.variation_key, 'phase2-production-v2:r02:target');
    assert.equal(trace.directorPlan.revisit_cue, 'learner_revisit_earlier_wording');
    assert.equal(trace.directorPlan.revisit_cue_policy, 'anchor');
    assert.equal(trace.directorPlan.revisit_cue_anchor, 'latest');
    assert.equal(trace.run.writing_pad.mode, 'isolated');
    assert.ok(['ok', 'review_before_scoring'].includes(trace.quality_status));
    assert.ok(Array.isArray(trace.quality_warnings), 'quality warnings should always be machine-readable');

    const tutorEntries = trace.turns
      .filter((turn) => turn.phase === 'tutor')
      .flatMap((turn) => turn.internalDeliberation || []);
    const learnerEntries = trace.turns
      .filter((turn) => turn.phase === 'learner')
      .flatMap((turn) => turn.internalDeliberation || []);

    assert.ok(tutorEntries.length > 0, 'expected tutor deliberation entries');
    assert.ok(learnerEntries.length > 0, 'expected learner deliberation entries');
    assert.ok(
      tutorEntries.every((entry) => entry.provenance?.backend === 'claude'),
      'all tutor role calls should be routed to claude',
    );
    assert.ok(
      learnerEntries.every((entry) => entry.provenance?.backend === 'codex'),
      'all learner role calls should be routed to codex',
    );
    assert.ok(
      [...tutorEntries, ...learnerEntries].every((entry) => entry.provenance?.promptHashes?.combined),
      'every role call should persist a prompt hash',
    );
    assert.ok(
      learnerEntries
        .filter((entry) => entry.role === 'ego')
        .every((entry) => entry.provenance?.agentRole === 'learner_ego'),
      'learner ego should be one stable routed role across initial and adjudication stages',
    );
    assert.ok(
      tutorEntries
        .filter((entry) => entry.role === 'ego')
        .every((entry) => entry.provenance?.agentRole === 'tutor_ego'),
      'tutor ego should be one stable routed role across initial and adjudication stages',
    );
    assert.ok(
      learnerEntries.some((entry) => entry.role === 'ego' && entry.stage === 'adjudication'),
      'expected learner ego adjudication stage',
    );
    assert.ok(
      tutorEntries.some((entry) => entry.role === 'ego' && entry.stage === 'adjudication'),
      'expected tutor ego adjudication stage',
    );
    assert.ok(
      learnerEntries.every((entry) => entry.role !== 'ego_initial' && entry.role !== 'ego_revision'),
      'initial/revision should be stages, not separate learner ego roles',
    );

    const tid = traceFile.replace(/\.json$/, '');
    for (const suffix of ['public.txt', 'full.md', 'stage.md', 'tutor.md', 'learner.md']) {
      assert.ok(fs.existsSync(path.join(transcriptsDir, `${tid}.${suffix}`)), `missing ${suffix} transcript`);
    }
    const publicSample = fs.readFileSync(path.join(sampleDir, `${tid}.txt`), 'utf8');
    assert.match(publicSample, /^STAGE:/m, 'public drama sample should expose visible stage directions');
    assert.match(
      publicSample,
      /earlier learner line returns to the table: "/i,
      'public sample should quote a revisit anchor',
    );
    const fullTranscript = fs.readFileSync(path.join(transcriptsDir, `${tid}.full.md`), 'utf8');
    assert.match(fullTranscript, /Director Scene Card/);
    assert.match(fullTranscript, /Tutor Ego \(adjudication\/final authority\)/);
    assert.match(fullTranscript, /Learner Ego \(adjudication\/final authority\)/);
    const tutorTranscript = fs.readFileSync(path.join(transcriptsDir, `${tid}.tutor.md`), 'utf8');
    const learnerTranscript = fs.readFileSync(path.join(transcriptsDir, `${tid}.learner.md`), 'utf8');
    assert.match(tutorTranscript, /backend=claude/);
    assert.match(learnerTranscript, /backend=codex/);

    const key = yaml.parse(fs.readFileSync(keyPath, 'utf8'));
    assert.equal(key.writing_pad.mode, 'isolated');
    assert.equal(key.director_revisit_cue, true);
    assert.equal(key.director_revisit_policy, 'anchor');
    assert.equal(key.director_revisit_anchor, 'latest');
    assert.equal(key.director_variation_key, 'phase2-production-v2:r02:target');
    assert.equal(key.transcripts_dir, path.relative(ROOT, transcriptsDir));
    assert.equal(key.items[tid].quality_status, trace.quality_status);
    assert.equal(key.items[tid].director_revisit_cue, true);
    assert.equal(key.items[tid].director_revisit_policy, 'anchor');
    assert.equal(key.items[tid].director_revisit_anchor, 'latest');
    assert.equal(key.items[tid].director_variation_key, 'phase2-production-v2:r02:target');
    assert.equal(key.quality_warning_count, key.items[tid].quality_warnings.length);

    const scorePath = path.join(tmp, 'score.json');
    execFileSync(
      process.execPath,
      ['scripts/score-poetics-phase2.js', '--mock', '--sample-dir', sampleDir, '--key', keyPath, '--out', scorePath],
      { cwd: ROOT, stdio: 'pipe' },
    );
    const score = JSON.parse(fs.readFileSync(scorePath, 'utf8'));
    assert.equal(score.scored[0].id, tid);
    assert.deepEqual(score.qualityPolicy.skipped, []);
  });

  it('lets a drama spec override the CLI revisit policy for mixed editorial runs', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'drama-gen-mixed-policy-'));
    const sourceSpec = yaml.parse(
      fs.readFileSync(path.join(ROOT, 'config', 'poetics-calibration', 'phase2-dramas-v2.yaml'), 'utf8'),
    );
    const specPath = path.join(tmp, 'mixed-policy.yaml');
    const sampleDir = path.join(tmp, 'sample');
    const delibDir = path.join(tmp, 'delib');
    const transcriptsDir = path.join(tmp, 'transcripts');
    const keyPath = path.join(tmp, 'key.yaml');
    fs.writeFileSync(
      specPath,
      yaml.stringify({
        ...sourceSpec,
        dramas: [
          {
            ...sourceSpec.dramas.find((drama) => drama.id === 'D3'),
            director_revisit_policy: 'reconsider',
            director_revisit_anchor: 'opening',
          },
        ],
      }),
      'utf8',
    );

    execFileSync(
      process.execPath,
      [
        'scripts/generate-pedagogical-dramas.js',
        '--mock',
        '--spec',
        specPath,
        '--max-turns',
        '2',
        '--director-revisit-policy',
        'none',
        '--out-dir',
        sampleDir,
        '--delib-dir',
        delibDir,
        '--transcripts-dir',
        transcriptsDir,
        '--key',
        keyPath,
        '--force',
      ],
      { cwd: ROOT, stdio: 'pipe', env: { ...process.env, GEN_DRAMAS_CLI_TRACE: '0' } },
    );

    const traceFile = fs.readdirSync(delibDir).find((file) => /^T\d+\.json$/.test(file));
    const trace = JSON.parse(fs.readFileSync(path.join(delibDir, traceFile), 'utf8'));
    const key = yaml.parse(fs.readFileSync(keyPath, 'utf8'));
    const tid = traceFile.replace(/\.json$/, '');

    assert.equal(trace.run.director_revisit_policy, 'reconsider');
    assert.equal(trace.run.director_revisit_anchor, 'opening');
    assert.equal(key.director_revisit_policy, 'reconsider');
    assert.equal(key.director_revisit_anchor, 'opening');
    assert.equal(key.items[tid].director_revisit_policy, 'reconsider');
    assert.equal(key.items[tid].director_revisit_anchor, 'opening');
  });

  it('preserves explicit drama opening and learner voice constraints in the director plan', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'drama-gen-director-override-'));
    const sampleDir = path.join(tmp, 'sample');
    const delibDir = path.join(tmp, 'delib');
    const transcriptsDir = path.join(tmp, 'transcripts');
    const keyPath = path.join(tmp, 'key.yaml');

    execFileSync(
      process.execPath,
      [
        'scripts/generate-pedagogical-dramas.js',
        '--mock',
        '--spec',
        'config/poetics-calibration/phase2-dramas-v2.yaml',
        '--only',
        'D1',
        '--max-turns',
        '2',
        '--out-dir',
        sampleDir,
        '--delib-dir',
        delibDir,
        '--transcripts-dir',
        transcriptsDir,
        '--key',
        keyPath,
        '--force',
      ],
      { cwd: ROOT, stdio: 'pipe', env: { ...process.env, GEN_DRAMAS_CLI_TRACE: '0' } },
    );

    const traceFile = fs.readdirSync(delibDir).find((file) => /^T\d+\.json$/.test(file));
    const trace = JSON.parse(fs.readFileSync(path.join(delibDir, traceFile), 'utf8'));

    assert.equal(trace.directorPlan.opening_speaker, 'learner');
    assert.match(
      trace.directorPlan.side_constraints.learner,
      /opening public line must own the decimal-check misconception/i,
    );
  });

  it('replaces shared revisit cues with the paired branch policy', () => {
    const sharedPlan = {
      revisit_cue: 'learner_revisit_earlier_wording',
      revisit_cue_policy: 'reconsider',
      revisit_cue_anchor: 'opening',
      interventions: [
        {
          after_turn: 2,
          timing: 'before_learner',
          instruction: 'A prior learner line is played back.',
          cue_kind: 'learner_revisit_earlier_wording',
          revisit_policy: 'reconsider',
          revisit_anchor: 'opening',
        },
        {
          after_turn: 2,
          timing: 'before_tutor',
          instruction: 'Keep the tutor brief.',
          cue_kind: 'tutor_stage_pressure',
        },
      ],
    };

    const nonePlan = withPairedDirectorRevisitCue(sharedPlan, 'none', 'misframing-candidate');
    assert.equal(nonePlan.revisit_cue, undefined);
    assert.equal(
      nonePlan.interventions.some((cue) => cue.cue_kind === 'learner_revisit_earlier_wording'),
      false,
    );
    assert.equal(nonePlan.interventions[0].cue_kind, 'tutor_stage_pressure');

    const reframePlan = withPairedDirectorRevisitCue(sharedPlan, 'reframe', 'misframing-candidate');
    const revisitCues = reframePlan.interventions.filter((cue) => cue.cue_kind === 'learner_revisit_earlier_wording');
    assert.equal(revisitCues.length, 1);
    assert.equal(revisitCues[0].revisit_policy, 'reframe');
    assert.equal(revisitCues[0].revisit_anchor, 'misframing-candidate');
    assert.match(revisitCues[0].instruction, /visible object in the scene/i);
    assert.doesNotMatch(revisitCues[0].instruction, /\bmust\b/i);
  });

  it('forks paired continuation arms from one fixed prefix', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'drama-gen-paired-continuation-'));
    const sourceSpec = yaml.parse(
      fs.readFileSync(path.join(ROOT, 'config', 'poetics-calibration', 'phase2-dramas-v2.yaml'), 'utf8'),
    );
    const specPath = path.join(tmp, 'paired-continuation.yaml');
    const sampleDir = path.join(tmp, 'sample');
    const delibDir = path.join(tmp, 'delib');
    const transcriptsDir = path.join(tmp, 'transcripts');
    const keyPath = path.join(tmp, 'key.yaml');
    fs.writeFileSync(
      specPath,
      yaml.stringify({
        ...sourceSpec,
        dramas: [sourceSpec.dramas.find((drama) => drama.id === 'D3')],
      }),
      'utf8',
    );

    execFileSync(
      process.execPath,
      [
        'scripts/generate-pedagogical-dramas.js',
        '--mock',
        '--spec',
        specPath,
        '--max-turns',
        '3',
        '--paired-continuation-policies',
        'none,reframe',
        '--director-revisit-anchor',
        'opening',
        '--out-dir',
        sampleDir,
        '--delib-dir',
        delibDir,
        '--transcripts-dir',
        transcriptsDir,
        '--key',
        keyPath,
        '--force',
      ],
      { cwd: ROOT, stdio: 'pipe', env: { ...process.env, GEN_DRAMAS_CLI_TRACE: '0' } },
    );

    const noneTraceFile = fs.readdirSync(path.join(delibDir, 'none')).find((file) => /^T\d+\.json$/.test(file));
    const reframeTraceFile = fs.readdirSync(path.join(delibDir, 'reframe')).find((file) => /^T\d+\.json$/.test(file));
    const noneTrace = JSON.parse(fs.readFileSync(path.join(delibDir, 'none', noneTraceFile), 'utf8'));
    const reframeTrace = JSON.parse(fs.readFileSync(path.join(delibDir, 'reframe', reframeTraceFile), 'utf8'));
    const prefixTurns = (trace) => {
      const turns = [];
      for (const turn of trace.turns) {
        turns.push({
          phase: turn.phase,
          turnNumber: turn.turnNumber,
          externalMessage: turn.externalMessage,
        });
        if (turn.phase === 'tutor' && turn.turnNumber === 2) break;
      }
      return turns;
    };

    assert.equal(noneTraceFile, reframeTraceFile);
    assert.deepEqual(prefixTurns(noneTrace), prefixTurns(reframeTrace));
    assert.equal(
      noneTrace.run.paired_continuation.shared_prefix_hash,
      reframeTrace.run.paired_continuation.shared_prefix_hash,
    );
    assert.equal(noneTrace.run.paired_continuation.branch_policy, 'none');
    assert.equal(reframeTrace.run.paired_continuation.branch_policy, 'reframe');
    assert.equal(noneTrace.run.director_revisit_policy, 'none');
    assert.equal(reframeTrace.run.director_revisit_policy, 'reframe');

    const tid = noneTraceFile.replace(/\.json$/, '');
    const noneSample = fs.readFileSync(path.join(sampleDir, 'none', `${tid}.txt`), 'utf8');
    const reframeSample = fs.readFileSync(path.join(sampleDir, 'reframe', `${tid}.txt`), 'utf8');
    assert.doesNotMatch(noneSample, /earlier learner line returns to the table:/i);
    assert.match(reframeSample, /earlier learner line returns to the table:/i);

    const noneKey = yaml.parse(fs.readFileSync(path.join(tmp, 'key-none.yaml'), 'utf8'));
    const reframeKey = yaml.parse(fs.readFileSync(path.join(tmp, 'key-reframe.yaml'), 'utf8'));
    assert.equal(noneKey.paired_continuation.mode, 'fixed_prefix_continuation');
    assert.deepEqual(reframeKey.paired_continuation.branch_policies, ['none', 'reframe']);
    assert.equal(
      noneKey.items[tid].paired_continuation.shared_prefix_hash,
      reframeKey.items[tid].paired_continuation.shared_prefix_hash,
    );
  });
});
