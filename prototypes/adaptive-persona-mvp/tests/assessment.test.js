import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runRealAssessment } from '../src/assessmentHarness.js';
import {
  renderRubricComparisonHtml,
  runRubricComparison,
} from '../src/rubricComparison.js';

test('real assessment dry-run creates static and controller conditions', async () => {
  const [result] = await runRealAssessment({
    scenarioId: 'recognition_false_mastery_closed_loop',
    dryRun: true,
  });
  assert.ok(result.conditions.static_codex);
  assert.ok(result.conditions.controller_codex);
  assert.equal(result.conditions.controller_codex.counterfactualComparison.sameInitialLearnerTurn, true);
  assert.equal(result.conditions.controller_codex.counterfactualComparison.policyDiverged, true);
});

test('blind judge prompt excludes internal controller labels', async () => {
  const [result] = await runRealAssessment({
    scenarioId: 'recognition_false_mastery_closed_loop',
    conditions: ['controller_codex'],
    dryRun: true,
    keepPrompts: true,
  });
  const prompt = result.conditions.controller_codex.original.blindJudgePrompt;
  assert.ok(prompt.includes('You are intentionally not given policy labels'));
  assert.doesNotMatch(prompt, /selectedPolicy/);
  assert.doesNotMatch(prompt, /masteryDelta/);
  assert.doesNotMatch(prompt, /expectedPolicy/);
});

test('outcome tasks are attached and scored in dry-run assessment', async () => {
  const [result] = await runRealAssessment({
    scenarioId: 'structural_asymmetry_closed_loop',
    dryRun: true,
  });
  const branch = result.conditions.controller_codex.original;
  assert.equal(branch.outcomeTask.prompt.includes('asymmetry'), true);
  assert.equal(typeof branch.outcomeTask.success, 'boolean');
  assert.equal(typeof branch.blindJudge.weighted_score, 'number');
});

test('codex learner proxy mode keeps rule learner available and records learner prompts', async () => {
  const [result] = await runRealAssessment({
    scenarioId: 'recognition_false_mastery_closed_loop',
    conditions: ['controller_codex'],
    learnerMode: 'codex',
    dryRun: true,
    keepPrompts: true,
  });
  const branch = result.conditions.controller_codex.original;
  assert.equal(branch.learnerMode, 'codex');
  assert.ok(branch.learnerTrace.length >= 1);
  assert.ok(branch.learnerTrace[0].prompt.includes('Hidden learner persona'));
  assert.ok(branch.outcomeTask.learnerOutcomePrompt.includes('same LLM learner proxy'));
});

test('rubric comparison dry-run applies MVP and parent dialogue rubrics', async () => {
  const report = await runRubricComparison({
    scenarioId: 'fractions_denominator_size_closed_loop',
    dryRun: true,
  });
  const [result] = report.results;
  const branch = result.conditions.controller_codex.original;
  assert.equal(typeof branch.blindJudge.weighted_score, 'number');
  assert.equal(typeof branch.parentDialogueJudge.weighted_score, 'number');
  assert.equal(typeof result.comparisons.rubrics.mvpDelta, 'number');
  assert.equal(typeof result.comparisons.rubrics.parentDelta, 'number');

  const html = renderRubricComparisonHtml(report);
  assert.match(html, /MVP Adaptation Rubric/);
  assert.match(html, /Parent Dialogue Rubric/);
  assert.match(html, /Condition Comparison/);
  assert.match(html, /static_codex/);
  assert.match(html, /controller_codex/);
});

test('rubric comparison can target three non-philosophy curricula', async () => {
  const report = await runRubricComparison({
    scenarioIds: [
      'fractions_denominator_size_closed_loop',
      'ai_bias_single_cause_closed_loop',
      'stats_confounding_closed_loop',
    ],
    dryRun: true,
  });
  assert.deepEqual(report.results.map((r) => r.discipline), [
    'mathematics',
    'ai_literacy',
    'statistics',
  ]);
  assert.equal(report.results.length, 3);
});

test('disciplinary misconceptions trigger repair policy before transfer', async () => {
  for (const scenarioId of [
    'fractions_denominator_size_closed_loop',
    'ai_bias_single_cause_closed_loop',
    'stats_confounding_closed_loop',
  ]) {
    const [result] = await runRealAssessment({
      scenarioId,
      conditions: ['controller_codex'],
      dryRun: true,
    });
    const branch = result.conditions.controller_codex.original;
    assert.equal(branch.stateTrace[0].policy.selectedPolicy, 'misconception_repair');
    assert.equal(branch.stateTrace[0].policy.outcomeGate.status, 'repair_required');
    assert.ok(branch.stateTrace[0].policy.actionTemplate.mustDo.length > 0);
    assert.equal(branch.stateTrace[1].policy.selectedPolicy, 'transfer_challenge');
    assert.equal(branch.outcomeTask.success, true);
  }
});

test('hard-mode learner can persist, forget, and require repeated repair', async () => {
  const [result] = await runRealAssessment({
    scenarioId: 'hard_ai_bias_resistant_closed_loop',
    conditions: ['controller_reflexive_psychodynamic_codex'],
    dryRun: true,
    keepPrompts: true,
  });
  const branch = result.conditions.controller_reflexive_psychodynamic_codex.original;
  assert.equal(result.challengeProfile.mode, 'hard');
  assert.equal(branch.challengeProfile.mode, 'hard');
  assert.equal(branch.stateTrace.length, 3);
  assert.equal(branch.stateTrace[0].policy.selectedPolicy, 'misconception_repair');
  assert.equal(branch.stateTrace[1].policy.selectedPolicy, 'misconception_repair');
  assert.equal(branch.stateTrace[2].policy.selectedPolicy, 'transfer_challenge');
  assert.match(branch.transcript.map((turn) => turn.content).join('\n'), /not convinced|abstract|gender/i);
  assert.match(branch.blindJudgePrompt, /Hard-mode scoring addendum/);
});

test('hard statistics challenge state escalates into concrete confounder repair', async () => {
  const [result] = await runRealAssessment({
    scenarioId: 'hard_stats_confounding_skeptical_closed_loop',
    conditions: ['controller_reflexive_psychodynamic_codex'],
    dryRun: true,
    keepPrompts: true,
  });
  const branch = result.conditions.controller_reflexive_psychodynamic_codex.original;
  assert.equal(branch.stateTrace[0].challengeState.level, 'active');
  assert.equal(branch.stateTrace[1].challengeState.level, 'escalated');
  assert.equal(branch.stateTrace[1].policy.selectedPolicy, 'misconception_repair');
  assert.match(branch.stateTrace[1].policy.challengeDirective, /confounder|third variable/i);
  assert.match(branch.stateTrace[1].policy.challengeDirective, /matched|controlled/i);
  assert.match(branch.stateTrace[1].tutorMessage, /confounder|third variable/i);
  assert.notEqual(branch.stateTrace[0].tutorMessage, branch.stateTrace[1].tutorMessage);
  assert.equal(branch.outcomeTask.success, true);
});

test('held-out hard curricula have domain repair contracts', async () => {
  for (const [scenarioId, expectedPattern] of [
    ['heldout_argument_warrant_resistant_closed_loop', /warrant|counterargument|stronger evidence/i],
    ['heldout_science_variable_control_resistant_closed_loop', /one variable|controlled|fair test/i],
    ['heldout_programming_debugging_resistant_closed_loop', /reproduce|root cause|regression/i],
    ['heldout_social_measurement_resistant_closed_loop', /construct|valid|reliability|comparison/i],
  ]) {
    const [result] = await runRealAssessment({
      scenarioId,
      conditions: ['controller_reflexive_psychodynamic_codex'],
      dryRun: true,
      keepPrompts: true,
    });
    const branch = result.conditions.controller_reflexive_psychodynamic_codex.original;
    assert.equal(branch.challengeProfile.mode, 'hard');
    assert.equal(branch.stateTrace[0].policy.selectedPolicy, 'misconception_repair');
    assert.match(branch.stateTrace[0].policy.actionTemplate.messageFrame, expectedPattern);
    assert.match(branch.stateTrace[0].policy.challengeDirective, expectedPattern);
  }
});

test('hidden-state trap curricula probe before repair and de-escalate ready branches', async () => {
  for (const [scenarioId, expectedPattern] of [
    ['trap_argument_warrant_false_mastery_closed_loop', /warrant|counterargument|stronger evidence/i],
    ['trap_science_variable_control_false_mastery_closed_loop', /one variable|controlled|fair test/i],
    ['trap_programming_debugging_false_mastery_closed_loop', /reproduce|root cause|regression/i],
    ['trap_social_measurement_false_mastery_closed_loop', /construct|validity|reliability|comparison/i],
  ]) {
    const [result] = await runRealAssessment({
      scenarioId,
      conditions: ['controller_reflexive_psychodynamic_codex'],
      dryRun: true,
      keepPrompts: true,
    });
    const original = result.conditions.controller_reflexive_psychodynamic_codex.original;
    const counterfactual = result.conditions.controller_reflexive_psychodynamic_codex.counterfactual;
    assert.equal(result.challengeProfile.hidden_state_trap, true);
    assert.equal(original.stateTrace[0].policy.selectedPolicy, 'teach_back');
    assert.equal(original.stateTrace[0].evidence.domainDiagnosis.repairNeeded, false);
    assert.equal(original.stateTrace[1].policy.selectedPolicy, 'misconception_repair');
    assert.match(original.stateTrace[1].policy.actionTemplate.messageFrame, expectedPattern);
    assert.equal(counterfactual.stateTrace[0].policy.selectedPolicy, 'teach_back');
    assert.ok(counterfactual.stateTrace.some((turn) => turn.policy.selectedPolicy === 'productive_struggle_hold'));
    assert.equal(original.outcomeTask.success, true);
    assert.equal(counterfactual.outcomeTask.success, true);
  }
});

test('hard AI transfer requires explicit rejection of gender removal sufficiency', async () => {
  const [result] = await runRealAssessment({
    scenarioId: 'hard_ai_bias_resistant_closed_loop',
    conditions: ['controller_reflexive_psychodynamic_codex'],
    dryRun: true,
    keepPrompts: true,
  });
  const branch = result.conditions.controller_reflexive_psychodynamic_codex.counterfactual;
  const transcript = branch.transcript.map((turn) => turn.content).join('\n');
  assert.equal(branch.stateTrace[1].policy.selectedPolicy, 'transfer_challenge');
  assert.match(branch.stateTrace[1].policy.actionTemplate.messageFrame, /gender removal is not enough/i);
  assert.match(transcript, /removing gender is not enough/i);
  assert.equal(branch.outcomeTask.success, true);
});

test('resolved hard-mode repair consolidates instead of repeating transfer', async () => {
  const [result] = await runRealAssessment({
    scenarioId: 'hard_ai_bias_resistant_closed_loop',
    conditions: ['controller_reflexive_psychodynamic_codex'],
    dryRun: true,
    keepPrompts: true,
  });
  const branch = result.conditions.controller_reflexive_psychodynamic_codex.counterfactual;
  assert.equal(branch.stateTrace[2].policy.selectedPolicy, 'summarize_and_check');
  assert.equal(branch.stateTrace[2].challengeState.resolvedTurns, 2);
  assert.match(branch.stateTrace[2].policy.actionTemplate.messageFrame, /Do not repeat the same resume-screener transfer/i);
});

test('challenge-state ablation removes hard-mode directives', async () => {
  const [result] = await runRealAssessment({
    scenarioId: 'hard_stats_confounding_skeptical_closed_loop',
    conditions: ['controller_reflexive_psychodynamic_no_challenge_codex'],
    dryRun: true,
    keepPrompts: true,
  });
  const branch = result.conditions.controller_reflexive_psychodynamic_no_challenge_codex.original;
  assert.equal(branch.stateTrace[0].challengeState, null);
  assert.equal(branch.stateTrace[0].policy.challengeDirective, '');
  assert.doesNotMatch(branch.stateTrace[0].policy.actionTemplate.messageFrame, /Hard-mode repair/i);
});

test('outcome-gate ablation stops forced misconception repair policy', async () => {
  const [result] = await runRealAssessment({
    scenarioId: 'hard_ai_bias_resistant_closed_loop',
    conditions: ['controller_reflexive_psychodynamic_no_outcome_gate_codex'],
    dryRun: true,
    keepPrompts: true,
  });
  const branch = result.conditions.controller_reflexive_psychodynamic_no_outcome_gate_codex.original;
  assert.equal(branch.stateTrace[0].policy.outcomeGate.status, 'disabled');
  assert.notEqual(branch.stateTrace[0].policy.selectedPolicy, 'misconception_repair');
});

test('ego-only and memoryless ablations are traceable', async () => {
  const [egoOnly] = await runRealAssessment({
    scenarioId: 'fractions_denominator_size_closed_loop',
    conditions: ['controller_reflexive_psychodynamic_ego_only_codex'],
    dryRun: true,
    keepPrompts: true,
  });
  const egoBranch = egoOnly.conditions.controller_reflexive_psychodynamic_ego_only_codex.original;
  assert.equal(egoBranch.stateTrace[0].reflexiveTrace.superegoCritique.adaptation_risk, 'superego_disabled');
  assert.equal(egoBranch.stateTrace[0].reflexiveTrace.prompts.superegoPrompt, null);

  const [memoryless] = await runRealAssessment({
    scenarioId: 'hard_ai_bias_resistant_closed_loop',
    conditions: ['controller_reflexive_psychodynamic_no_memory_codex'],
    dryRun: true,
    keepPrompts: true,
  });
  const memorylessBranch = memoryless.conditions.controller_reflexive_psychodynamic_no_memory_codex.original;
  assert.equal(memorylessBranch.stateTrace[1].reflexiveMemory.priorCritiques.length, 0);
  assert.equal(memorylessBranch.stateTrace[1].reflexiveMemory.repairDebts.length, 0);
});

test('reflexive controller records ego-superego revision trace', async () => {
  const [result] = await runRealAssessment({
    scenarioId: 'stats_confounding_closed_loop',
    conditions: ['controller_reflexive_codex'],
    dryRun: true,
  });
  const branch = result.conditions.controller_reflexive_codex.original;
  assert.equal(branch.stateTrace[0].policy.selectedPolicy, 'misconception_repair');
  assert.ok(branch.stateTrace[0].reflexiveTrace.egoDraft.draft_message);
  assert.ok(branch.stateTrace[0].reflexiveTrace.superegoCritique.required_revision);
  assert.ok(branch.stateTrace[0].reflexiveTrace.egoRevision.tutor_message);
  assert.match(branch.stateTrace[0].reflexiveMemory.currentFocus, /repair|transfer|evidence/i);
});
